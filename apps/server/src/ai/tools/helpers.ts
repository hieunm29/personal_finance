import { aiConfig } from '../config'

/** DB lưu tiền theo cents (×100). AI làm việc với VND nguyên cho tự nhiên. */
export const vndToCents = (vnd: number): number => Math.round(vnd * 100)
export const centsToVnd = (cents: number): number => Math.round(cents / 100)

/** Ngày hôm nay theo giờ Việt Nam, dạng YYYY-MM-DD. */
export function todayVN(now: Date = new Date()): string {
  return now.toLocaleDateString('sv', { timeZone: aiConfig.timeZone })
}

/** Tháng hiện tại theo giờ Việt Nam, dạng YYYY-MM. */
export function currentMonthVN(now: Date = new Date()): string {
  return todayVN(now).slice(0, 7)
}

/** Giới hạn ghi chú giao dịch — trùng với schema `note: z.string().max(500)` của API web. */
export const MAX_NOTE_LENGTH = 500

/**
 * Tool ghi giao dịch gọi thẳng service, không qua validate của API web, nên phải tự giữ giới hạn
 * 500 ký tự (nếu không, sửa giao dịch đó trên web sẽ bị từ chối). Ghi chú hóa đơn có dạng
 * "Cửa hàng: Món 1 60.000; Món 2 18.900; …" → cắt ở ranh giới "; " gần nhất để không đứt giữa món.
 */
export function clampNote(note: string | undefined): string | undefined {
  const trimmed = note?.trim()
  if (!trimmed) return undefined
  if (trimmed.length <= MAX_NOTE_LENGTH) return trimmed
  const suffix = '; …'
  const head = trimmed.slice(0, MAX_NOTE_LENGTH - suffix.length)
  const boundary = head.lastIndexOf('; ')
  return (boundary > 0 ? head.slice(0, boundary) : head.trimEnd()) + suffix
}

/** Kết quả tool trả cho Claude luôn là chuỗi JSON gọn. */
export const json = (value: unknown): string => JSON.stringify(value)

/**
 * Lỗi nghiệp vụ ném ra trong tool sẽ được Tool Runner gửi lại cho Claude dưới dạng
 * tool_result có is_error=true → Claude đọc lỗi và tự sửa hoặc hỏi lại người dùng.
 */
export function toolFail(message: string): never {
  throw new Error(message)
}
