/**
 * Giờ Việt Nam (UTC+7, không có giờ mùa hè). Server có thể chạy ở múi giờ khác (VM thường là UTC),
 * nên mọi chỗ cần "hôm nay / mấy giờ" của người dùng đều đi qua đây.
 */
const TIME_ZONE = 'Asia/Ho_Chi_Minh'

export interface VnClock {
  /** YYYY-MM-DD */
  date: string
  /** 0–23 */
  hour: number
  /** 0–59 */
  minute: number
  /** 0 = Chủ nhật … 6 = Thứ bảy */
  weekday: number
}

const timeFormat = new Intl.DateTimeFormat('en-GB', {
  timeZone: TIME_ZONE,
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})

export function vnClock(now: Date = new Date()): VnClock {
  const date = now.toLocaleDateString('sv', { timeZone: TIME_ZONE })
  const parts = timeFormat.formatToParts(now)
  const hour = Number(parts.find((part) => part.type === 'hour')?.value)
  const minute = Number(parts.find((part) => part.type === 'minute')?.value)
  const weekday = new Date(`${date}T00:00:00Z`).getUTCDay()
  return { date, hour, minute, weekday }
}
