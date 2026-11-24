import { describe, expect, test } from 'bun:test'
import { vnClock } from './vnTime'

describe('vnClock', () => {
  test('đổi UTC sang giờ VN, kể cả khi qua ngày', () => {
    expect(vnClock(new Date('2026-11-20T19:30:00Z'))).toEqual({ date: '2026-11-21', hour: 2, minute: 30, weekday: 6 })
  })

  test('nửa đêm VN là giờ 0, không phải 24', () => {
    const clock = vnClock(new Date('2026-11-20T17:00:00Z'))
    expect(clock.hour).toBe(0)
    expect(clock.date).toBe('2026-11-21')
  })

  test('Chủ nhật có weekday = 0', () => {
    expect(vnClock(new Date('2026-11-22T03:00:00Z')).weekday).toBe(0)
  })
})
