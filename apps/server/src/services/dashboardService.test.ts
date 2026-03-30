import { describe, expect, test } from 'bun:test'
import { getDashboardTotalAssets } from './dashboardService'

describe('getDashboardTotalAssets', () => {
  test('uses total assets instead of net worth for dashboard top card', () => {
    expect(
      getDashboardTotalAssets({
        totalAssets: 150_000_000,
        totalDebt: 120_000_000,
        netWorth: 30_000_000,
        byType: [],
      }),
    ).toBe(150_000_000)
  })

  test('returns zero when asset snapshot is unavailable', () => {
    expect(getDashboardTotalAssets(null)).toBe(0)
  })
})
