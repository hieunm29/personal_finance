import { describe, expect, it } from 'bun:test'
import { updateProfileSchema } from './schemas'

describe('updateProfileSchema', () => {
  it('allows updating gold price when display name is blank', () => {
    const result = updateProfileSchema.safeParse({
      displayName: '',
      goldPricePerLuong: 9_000_000_00,
    })

    expect(result.success).toBe(true)
    if (!result.success) return

    expect(result.data.displayName).toBeUndefined()
    expect(result.data.goldPricePerLuong).toBe(9_000_000_00)
  })

  it('trims non-empty display names', () => {
    const result = updateProfileSchema.safeParse({
      displayName: '  Hieu  ',
    })

    expect(result.success).toBe(true)
    if (!result.success) return

    expect(result.data.displayName).toBe('Hieu')
  })
})
