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

/** Kết quả tool trả cho Claude luôn là chuỗi JSON gọn. */
export const json = (value: unknown): string => JSON.stringify(value)

/**
 * Lỗi nghiệp vụ ném ra trong tool sẽ được Tool Runner gửi lại cho Claude dưới dạng
 * tool_result có is_error=true → Claude đọc lỗi và tự sửa hoặc hỏi lại người dùng.
 */
export function toolFail(message: string): never {
  throw new Error(message)
}
