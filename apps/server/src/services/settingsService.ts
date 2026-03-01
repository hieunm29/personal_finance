import { eq } from 'drizzle-orm'
import { db } from '../db'
import { userProfiles } from '../db/schema'
import type { UpdateProfileInput } from '@pf/shared'

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
  const updates: Record<string, unknown> = {
    updatedAt: new Date().toISOString(),
  }
  if (data.displayName !== undefined) updates.displayName = data.displayName
  if (data.currency !== undefined) updates.currency = data.currency
  if (data.theme !== undefined) updates.theme = data.theme

  const [updated] = db
    .update(userProfiles)
    .set(updates)
    .where(eq(userProfiles.authUserId, authUserId))
    .returning()
    .all()
  return updated
}
