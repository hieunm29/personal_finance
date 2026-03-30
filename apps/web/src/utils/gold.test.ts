import { describe, expect, test } from 'bun:test'
import {
  calculateGoldValueFromPrice,
  formatGoldQuantityLabel,
  getGoldPriceStatusMessage,
} from './gold'

describe('gold ui helpers', () => {
  test('calculates value preview for luong', () => {
    expect(calculateGoldValueFromPrice('luong', 2, 9_000_000_000)).toBe(18_000_000_000)
  })

  test('calculates value preview for chi', () => {
    expect(calculateGoldValueFromPrice('chi', 5, 9_000_000_000)).toBe(4_500_000_000)
  })

  test('formats quantity label', () => {
    expect(formatGoldQuantityLabel('chi', 3.5)).toBe('3.5 chỉ')
    expect(formatGoldQuantityLabel('luong', 1)).toBe('1 lượng')
  })

  test('returns missing-price message', () => {
    expect(getGoldPriceStatusMessage(null)).toBe('Chưa cấu hình giá 1 lượng vàng')
  })
})
