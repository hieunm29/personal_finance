import { describe, expect, test } from 'bun:test'
import {
  assertGoldManualValueUpdateAllowed,
  buildGoldRevaluationUpdates,
  calculateGoldAssetValue,
  parseGoldMetadata,
  serializeGoldMetadata,
} from './goldValuation'

describe('goldValuation', () => {
  test('calculates current value for luong assets', () => {
    expect(calculateGoldAssetValue({ unit: 'luong', quantity: 2 }, 9_000_000_000)).toBe(18_000_000_000)
  })

  test('calculates current value for chi assets', () => {
    expect(calculateGoldAssetValue({ unit: 'chi', quantity: 5 }, 9_000_000_000)).toBe(4_500_000_000)
  })

  test('rejects missing configured gold price', () => {
    expect(() => calculateGoldAssetValue({ unit: 'chi', quantity: 1 }, null)).toThrow(
      'Chưa cấu hình giá 1 lượng vàng',
    )
  })

  test('normalizes supported gold metadata and strips legacy fields', () => {
    expect(
      parseGoldMetadata(
        JSON.stringify({
          unit: 'chi',
          quantity: 2.5,
          buyPrice: 123,
        }),
      ),
    ).toEqual({
      unit: 'chi',
      quantity: 2.5,
    })
  })

  test('serializes normalized gold metadata', () => {
    expect(serializeGoldMetadata({ unit: 'luong', quantity: 1.2 })).toBe(
      JSON.stringify({ unit: 'luong', quantity: 1.2 }),
    )
  })

  test('builds revaluation updates for all gold assets', () => {
    expect(
      buildGoldRevaluationUpdates(
        [
          {
            id: 'gold-luong',
            metadata: JSON.stringify({ unit: 'luong', quantity: 2 }),
          },
          {
            id: 'gold-chi',
            metadata: JSON.stringify({ unit: 'chi', quantity: 5 }),
          },
        ],
        8_500_000_000,
      ),
    ).toEqual([
      {
        id: 'gold-luong',
        currentValue: 17_000_000_000,
        metadata: JSON.stringify({ unit: 'luong', quantity: 2 }),
      },
      {
        id: 'gold-chi',
        currentValue: 4_250_000_000,
        metadata: JSON.stringify({ unit: 'chi', quantity: 5 }),
      },
    ])
  })

  test('rejects manual value updates for gold assets', () => {
    expect(() => assertGoldManualValueUpdateAllowed('gold')).toThrow(
      'Giá trị vàng được tính từ giá 1 lượng vàng trong Cài đặt',
    )
  })
})
