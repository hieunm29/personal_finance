import { describe, expect, test } from 'bun:test'
import { buildActionNote, checkReply, finalizeReply, stripActionNotes } from './guard'

const created = [{ name: 'create_transaction', ok: true, refId: 'tx-1' }]
const readOnly = [{ name: 'get_monthly_summary', ok: true }]

describe('hallucination guard', () => {
  test('claiming a write without create_transaction triggers a retry, then a hard block', () => {
    const reply = 'Đã ghi: thu 28.000.000đ – Lương – ví Tiền mặt.\nGõ *hoàn tác* nếu sai.'
    expect(checkReply(reply, []).action).toBe('retry')
    expect(checkReply(reply, readOnly).action).toBe('retry')
    expect(finalizeReply(reply, [])).toMatch(/CHƯA ghi được/)
  })

  test('a real write passes', () => {
    const reply = '✅ Đã ghi: chi 45.000đ – Cafe – ví Tiền mặt.'
    expect(checkReply(reply, created).action).toBe('accept')
    expect(finalizeReply(reply, created)).toBe(reply)
  })

  test('a failed write still counts as not written', () => {
    expect(checkReply('Mình đã ghi 45.000đ', [{ name: 'create_transaction', ok: false }]).action).toBe('retry')
  })

  test('undo claims need a successful undo_last_action', () => {
    expect(checkReply('Đã hoàn tác: Chi 45.000đ', []).action).toBe('retry')
    expect(checkReply('Đã hoàn tác: Chi 45.000đ', [{ name: 'undo_last_action', ok: true }]).action).toBe('accept')
  })

  test('statistics with amounts but no tool call trigger a retry', () => {
    expect(checkReply('Tháng 11: tổng thu 28.000.000đ', []).action).toBe('retry')
    expect(checkReply('Tháng 11: tổng thu 28.000.000đ', readOnly).action).toBe('accept')
    // Sau khi thử lại, câu thống kê không bị chặn cứng (chỉ chặn câu nói đã ghi/hoàn tác).
    expect(finalizeReply('Tháng 11: tổng thu 28.000.000đ', [])).toBe('Tháng 11: tổng thu 28.000.000đ')
  })

  test('plain chat and sentences about the user are not flagged', () => {
    expect(checkReply('Chào bạn! Mình giúp gì được?', []).action).toBe('accept')
    expect(checkReply('Bạn đã ghi 2 khoản chi tháng này.', readOnly).action).toBe('accept')
  })

  test('memory claims need the matching memory tool', () => {
    const remembered = [{ name: 'remember_fact', ok: true, refId: 'f-1' }]
    // "Đã ghi nhớ" không bị coi là ghi giao dịch.
    expect(checkReply('Đã ghi nhớ: cà phê ghi vào ví Momo.', remembered).action).toBe('accept')
    expect(checkReply('Đã ghi nhớ: cà phê ghi vào ví Momo.', []).action).toBe('retry')
    expect(finalizeReply('Đã ghi nhớ: cà phê ghi vào ví Momo.', [])).toMatch(/CHƯA ghi nhớ/)
    expect(checkReply('Mình đã quên điều đó rồi.', []).action).toBe('retry')
    expect(checkReply('Mình đã quên điều đó rồi.', [{ name: 'forget_fact', ok: true }]).action).toBe('accept')
    // Liệt kê điều đã nhớ từ trước không cần gọi tool.
    expect(checkReply('Mình đang nhớ: cà phê ghi vào ví Momo.', []).action).toBe('accept')
    // Ghi nhớ thành công không "bảo lãnh" cho câu ghi giao dịch.
    expect(checkReply('Đã ghi: chi 45.000đ – Cafe.', remembered).action).toBe('retry')
    // "Đã lưu" mơ hồ → chấp nhận cả remember_fact.
    expect(checkReply('Đã lưu lại sở thích của bạn.', remembered).action).toBe('accept')
  })

  test('action notes are recorded for history and never shown to the user', () => {
    expect(buildActionNote(created)).toBe('[Hệ thống ghi nhận: create_transaction thành công (id tx-1)]')
    expect(buildActionNote([])).toMatch(/không gọi công cụ nào/)
    expect(stripActionNotes('Đã ghi xong.\n[Hệ thống ghi nhận: create_transaction thành công]')).toBe('Đã ghi xong.')
  })
})
