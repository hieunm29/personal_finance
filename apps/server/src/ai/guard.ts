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
// "ghi(?!\s*nhớ)": "Đã ghi nhớ" là câu của trí nhớ dài hạn, kiểm tra riêng bằng MEMORY_CLAIM.
const claim = (verbs: string) => new RegExp(`(^|\\n)\\s*\\W{0,3}\\s*(đã|vừa)\\s+(${verbs})|mình\\s+(đã|vừa)\\s+(${verbs})`, 'i')
const WRITE_CLAIM = claim('ghi(?!\\s*nhớ)|thêm|nhập')
/** "Đã lưu" có thể là lưu giao dịch hoặc lưu ghi nhớ → chấp nhận một trong hai tool. */
const SAVE_CLAIM = claim('lưu')
const MEMORY_CLAIM = /(đã|vừa)\s+(ghi\s*nhớ|nhớ)|mình\s+sẽ\s+nhớ/i
const FORGET_CLAIM = /(đã|vừa)\s+(quên|bỏ\s+ghi\s*nhớ|xóa\s+ghi\s*nhớ|xoá\s+ghi\s*nhớ)/i
const UNDO_CLAIM = claim('hoàn tác|huỷ|hủy')
/** "Đã xóa" có thể là hoàn tác giao dịch hoặc quên một ghi nhớ. */
const DELETE_CLAIM = claim('xóa(?!\\s*ghi\\s*nhớ)|xoá(?!\\s*ghi\\s*nhớ)')
const MONEY_AMOUNT = /\d[\d.,]*\s?(đ|₫|vnđ|vnd|k\b|nghìn|ngàn|triệu|tr\b)/i

const READ_TOOLS = new Set(['search_transactions', 'get_monthly_summary', 'get_budget_status', 'get_net_worth'])
const WRITE_TOOLS = new Set(['create_transaction', 'undo_last_action', 'remember_fact', 'forget_fact'])

export type GuardVerdict =
  | { action: 'accept' }
  /** Yêu cầu model làm lại 1 lần, kèm lời nhắc. */
  | { action: 'retry'; nudge: string }

const succeeded = (log: ToolCallRecord[], ...names: string[]) => log.some((call) => names.includes(call.name) && call.ok)

/** Câu khẳng định nào chưa có tool thật đứng sau? */
function unbackedClaim(reply: string, log: ToolCallRecord[]): 'write' | 'undo' | 'remember' | 'forget' | null {
  if (MEMORY_CLAIM.test(reply) && !succeeded(log, 'remember_fact')) return 'remember'
  if (FORGET_CLAIM.test(reply) && !succeeded(log, 'forget_fact')) return 'forget'
  if (WRITE_CLAIM.test(reply) && !succeeded(log, 'create_transaction')) return 'write'
  if (SAVE_CLAIM.test(reply) && !succeeded(log, 'create_transaction', 'remember_fact')) return 'write'
  if (UNDO_CLAIM.test(reply) && !succeeded(log, 'undo_last_action')) return 'undo'
  if (DELETE_CLAIM.test(reply) && !succeeded(log, 'undo_last_action', 'forget_fact')) return 'undo'
  return null
}

const RETRY_NUDGE = {
  write: 'Bạn vừa nói đã ghi giao dịch nhưng chưa gọi create_transaction thành công trong lượt này, nên CHƯA có gì được ghi. ' +
    'Hãy gọi create_transaction ngay bây giờ (hoặc hỏi lại nếu thiếu thông tin), rồi mới xác nhận.',
  undo: 'Bạn vừa nói đã hoàn tác nhưng chưa gọi undo_last_action thành công trong lượt này. Hãy gọi tool rồi mới xác nhận.',
  remember: 'Bạn vừa nói đã ghi nhớ nhưng chưa gọi remember_fact thành công trong lượt này, nên CHƯA nhớ gì cả. ' +
    'Hãy gọi remember_fact ngay bây giờ rồi mới xác nhận. Nếu bạn chỉ đang liệt kê những điều đã nhớ từ trước, ' +
    'hãy viết lại câu trả lời bắt đầu bằng "Mình đang nhớ:" thay vì "đã ghi nhớ".',
  forget: 'Bạn vừa nói đã quên nhưng chưa gọi forget_fact thành công trong lượt này. Hãy gọi forget_fact rồi mới xác nhận.',
}

const BLOCKED_REPLY = {
  write: 'Xin lỗi, mình CHƯA ghi được giao dịch này. Bạn gửi lại giúp mình (kèm số tiền và nội dung) nhé.',
  undo: 'Xin lỗi, mình CHƯA hoàn tác được. Bạn thử gõ lại "hoàn tác" nhé.',
  remember: 'Xin lỗi, mình CHƯA ghi nhớ được điều này. Bạn nhắn lại "nhớ là …" giúp mình nhé.',
  forget: 'Xin lỗi, mình CHƯA quên được điều này. Bạn nhắn lại giúp mình nhé.',
}

export function checkReply(reply: string, log: ToolCallRecord[]): GuardVerdict {
  const claim = unbackedClaim(reply, log)
  if (claim) return { action: 'retry', nudge: RETRY_NUDGE[claim] }
  const usedAnyDataTool = log.some((call) => call.ok && (READ_TOOLS.has(call.name) || WRITE_TOOLS.has(call.name)))
  if (MONEY_AMOUNT.test(reply) && !usedAnyDataTool) {
    return {
      action: 'retry',
      nudge: 'Câu trả lời có số tiền nhưng bạn chưa gọi tool nào trong lượt này. Số liệu trong lịch sử có thể đã cũ hoặc sai. ' +
        'Nếu là thống kê, hãy gọi tool để lấy số liệu mới; nếu là ghi giao dịch, hãy gọi create_transaction; nếu chỉ đang hỏi lại người dùng thì trả lời lại y như cũ.',
    }
  }
  return { action: 'accept' }
}

/** Sau khi đã thử lại mà vẫn vi phạm: chỉ chặn cứng các câu NÓI ĐÃ GHI/HOÀN TÁC/NHỚ/QUÊN mà không có thật. */
export function finalizeReply(reply: string, log: ToolCallRecord[]): string {
  const claim = unbackedClaim(reply, log)
  return claim ? BLOCKED_REPLY[claim] : reply
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
