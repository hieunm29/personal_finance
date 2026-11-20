import type { ToolCallRecord } from './tools'

/**
 * Lớp chống "bịa" (hallucination guard).
 *
 * LLM có thể trả lời "Đã ghi…" mà KHÔNG gọi tool, hoặc tự đưa ra số liệu không lấy từ DB.
 * Không thể chỉ dựa vào prompt để ngăn việc này, nên code kiểm tra câu trả lời dựa trên
 * nhật ký tool THỰC SỰ đã chạy trong lượt (ToolCallRecord) — một nguồn sự thật do server nắm.
 */

// Chỉ bắt câu BOT tự xác nhận ("Đã ghi: …" ở đầu dòng, "mình đã ghi …"), không bắt
// câu kể về người dùng như "Bạn đã ghi 2 khoản chi tháng này".
const WRITE_CLAIM = /(^|\n)\s*\W{0,3}\s*(đã|vừa)\s+(ghi|lưu|thêm|nhập)|mình\s+(đã|vừa)\s+(ghi|lưu|thêm|nhập)/i
const UNDO_CLAIM = /(^|\n)\s*\W{0,3}\s*(đã|vừa)\s+(hoàn tác|xóa|xoá|huỷ|hủy)|mình\s+(đã|vừa)\s+(hoàn tác|xóa|xoá|huỷ|hủy)/i
const MONEY_AMOUNT = /\d[\d.,]*\s?(đ|₫|vnđ|vnd|k\b|nghìn|ngàn|triệu|tr\b)/i

const READ_TOOLS = new Set(['search_transactions', 'get_monthly_summary', 'get_budget_status', 'get_net_worth'])

export type GuardVerdict =
  | { action: 'accept' }
  /** Yêu cầu model làm lại 1 lần, kèm lời nhắc. */
  | { action: 'retry'; nudge: string }

const succeeded = (log: ToolCallRecord[], name: string) => log.some((call) => call.name === name && call.ok)

export function checkReply(reply: string, log: ToolCallRecord[]): GuardVerdict {
  if (WRITE_CLAIM.test(reply) && !succeeded(log, 'create_transaction')) {
    return {
      action: 'retry',
      nudge: 'Bạn vừa nói đã ghi giao dịch nhưng chưa gọi create_transaction thành công trong lượt này, nên CHƯA có gì được ghi. ' +
        'Hãy gọi create_transaction ngay bây giờ (hoặc hỏi lại nếu thiếu thông tin), rồi mới xác nhận.',
    }
  }
  if (UNDO_CLAIM.test(reply) && !succeeded(log, 'undo_last_action')) {
    return {
      action: 'retry',
      nudge: 'Bạn vừa nói đã hoàn tác nhưng chưa gọi undo_last_action thành công trong lượt này. Hãy gọi tool rồi mới xác nhận.',
    }
  }
  const usedAnyDataTool = log.some((call) => call.ok && (READ_TOOLS.has(call.name) || call.name === 'create_transaction' || call.name === 'undo_last_action'))
  if (MONEY_AMOUNT.test(reply) && !usedAnyDataTool) {
    return {
      action: 'retry',
      nudge: 'Câu trả lời có số tiền nhưng bạn chưa gọi tool nào trong lượt này. Số liệu trong lịch sử có thể đã cũ hoặc sai. ' +
        'Nếu là thống kê, hãy gọi tool để lấy số liệu mới; nếu là ghi giao dịch, hãy gọi create_transaction; nếu chỉ đang hỏi lại người dùng thì trả lời lại y như cũ.',
    }
  }
  return { action: 'accept' }
}

/** Sau khi đã thử lại mà vẫn vi phạm: chỉ chặn cứng các câu NÓI ĐÃ GHI/HOÀN TÁC mà không có thật. */
export function finalizeReply(reply: string, log: ToolCallRecord[]): string {
  if (WRITE_CLAIM.test(reply) && !succeeded(log, 'create_transaction')) {
    return 'Xin lỗi, mình CHƯA ghi được giao dịch này. Bạn gửi lại giúp mình (kèm số tiền và nội dung) nhé.'
  }
  if (UNDO_CLAIM.test(reply) && !succeeded(log, 'undo_last_action')) {
    return 'Xin lỗi, mình CHƯA hoàn tác được. Bạn thử gõ lại "hoàn tác" nhé.'
  }
  return reply
}

/**
 * Dòng ghi chú hành động thật, lưu kèm câu trả lời vào lịch sử. Khi đọc lại lịch sử, model thấy
 * rõ câu "Đã ghi…" luôn đi kèm một lần gọi tool thật → không học theo kiểu "chỉ nói mà không làm".
 */
export const ACTION_NOTE_PREFIX = '[Hệ thống ghi nhận:'

export function buildActionNote(log: ToolCallRecord[]): string {
  if (log.length === 0) return `${ACTION_NOTE_PREFIX} lượt này không gọi công cụ nào]`
  const parts = log.map((call) => `${call.name} ${call.ok ? 'thành công' : 'lỗi'}${call.refId ? ` (id ${call.refId})` : ''}`)
  return `${ACTION_NOTE_PREFIX} ${parts.join('; ')}]`
}

/** Model có thể bắt chước viết dòng ghi chú — xóa đi trước khi gửi cho người dùng. */
export function stripActionNotes(reply: string): string {
  return reply
    .split('\n')
    .filter((line) => !line.trim().startsWith(ACTION_NOTE_PREFIX))
    .join('\n')
    .trim()
}
