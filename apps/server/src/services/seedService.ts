import { eq } from 'drizzle-orm'
import { db } from '../db'
import {
  userProfiles,
  categoryGroups,
  categories,
  wallets,
} from '../db/schema'
import { DEFAULT_CATEGORY_GROUPS } from '@pf/shared'

export async function seedUserData(
  authUserId: string,
  displayName?: string | null,
) {
  // Idempotent: skip if profile already exists
  const existing = db
    .select()
    .from(userProfiles)
    .where(eq(userProfiles.authUserId, authUserId))
    .get()

  if (existing) return existing

  // Create user profile
  const [user] = db
    .insert(userProfiles)
    .values({
      authUserId,
      displayName: displayName ?? null,
      currency: 'VND',
      theme: 'system',
    })
    .returning()
    .all()

  // Seed default category groups and categories
  for (const group of DEFAULT_CATEGORY_GROUPS) {
    const [createdGroup] = db
      .insert(categoryGroups)
      .values({
        userId: user.id,
        name: group.name,
        type: group.type,
        color: group.color,
        sortOrder: group.sortOrder,
        isDefault: true,
      })
      .returning()
      .all()

    for (const cat of group.categories) {
      db.insert(categories)
        .values({
          userId: user.id,
          groupId: createdGroup.id,
          name: cat.name,
          type: group.type,
          icon: cat.icon,
          color: cat.color,
          sortOrder: cat.sortOrder,
          isDefault: true,
        })
        .run()
    }
  }

  // Create default wallet
  db.insert(wallets)
    .values({
      userId: user.id,
      name: 'Tiền mặt',
      type: 'cash',
      initialBalance: 0,
      isDefault: true,
    })
    .run()

  return user
}
