import { describe, expect, test } from 'bun:test'
import { checkReply, finalizeReply } from './guard'
import { READ_TOOL_NAMES, WRITE_TOOL_NAMES } from './toolNames'

const proposal = '1. Chi 45.000đ – Ăn uống – Tiền mặt (Cà phê)\n2. Chi 120.000đ – Mua sắm\nTrả lời *ok* để ghi, hoặc nói chỗ cần sửa.'

describe('guard ở lượt chỉ-đề-xuất (tin có ảnh)', () => {
  test('số tiền đọc từ ảnh không cần tool: không bắt làm lại', () => {
    expect(checkReply(proposal, [], { proposalOnly: true }).action).toBe('accept')
  })

  test('mặc định (lượt thường) vẫn bắt số tiền không có tool đứng sau', () => {
    expect(checkReply(proposal, []).action).toBe('retry')
  })

  test('nói "Đã ghi" trong lượt đề xuất luôn sai: bắt làm lại bằng lời nhắc dành riêng', () => {
    const verdict = checkReply('Đã ghi: chi 45.000đ – Ăn uống.', [], { proposalOnly: true })
    expect(verdict.action).toBe('retry')
    if (verdict.action === 'retry') {
      expect(verdict.nudge).toContain('ĐỀ XUẤT')
      expect(verdict.nudge).not.toContain('create_transaction') // tool này không có trong lượt này
    }
  })

  test('sau khi thử lại vẫn bịa thì bị chặn cứng', () => {
    expect(finalizeReply('Đã chuyển 500.000đ: VPB → Tiền mặt.', [])).toMatch(/CHƯA chuyển được/)
  })

  test('đề xuất dạng "Chuyển khoản…" không có chữ "đã" thì không bị coi là khẳng định', () => {
    const reply = '1. Chuyển khoản 500.000đ cho Nguyễn Văn A\nTrả lời *ok* để ghi.'
    expect(checkReply(reply, [], { proposalOnly: true }).action).toBe('accept')
    expect(finalizeReply(reply, [])).toBe(reply)
  })
})

describe('tên tool dùng chung', () => {
  test('tool đọc và tool ghi không trùng nhau', () => {
    for (const name of READ_TOOL_NAMES) expect(WRITE_TOOL_NAMES.has(name)).toBe(false)
  })
})
