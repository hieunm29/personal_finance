import { eq } from 'drizzle-orm'
import { db } from '../db'
import { userProfiles } from '../db/schema'
import type { UpdateProfileInput } from '@pf/shared'
import { revalueGoldAssetsForProfile } from './assetService'

export function getProfile(authUserId: string) {
  const profile = db
    .select()
    .from(userProfiles)
    .where(eq(userProfiles.authUserId, authUserId))
    .get()
  if (!profile) throw new Error('Profile not found')
  return profile
}

export function updateProfile(authUserId: string, data: UpdateProfileInput) {
  const profile = db
    .select()
    .from(userProfiles)
    .where(eq(userProfiles.authUserId, authUserId))
    .get()

  if (!profile) {
    throw new Error('Profile not found')
  }

  const nextGoldPricePerLuong = data.goldPricePerLuong
  const hasGoldPriceChange =
    nextGoldPricePerLuong !== undefined &&
    nextGoldPricePerLuong !== profile.goldPricePerLuong

  return db.transaction(() => {
    const updates: Record<string, unknown> = {
      updatedAt: new Date().toISOString(),
    }
    if (data.displayName !== undefined) updates.displayName = data.displayName
    if (data.currency !== undefined) updates.currency = data.currency
    if (data.theme !== undefined) updates.theme = data.theme
    if (hasGoldPriceChange) updates.goldPricePerLuong = nextGoldPricePerLuong

    const [updated] = db
      .update(userProfiles)
      .set(updates)
      .where(eq(userProfiles.authUserId, authUserId))
      .returning()
      .all()

    if (hasGoldPriceChange) {
      revalueGoldAssetsForProfile(profile.id, nextGoldPricePerLuong)
    }

    return updated
  })
}
