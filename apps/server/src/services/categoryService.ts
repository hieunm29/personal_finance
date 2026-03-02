import { eq, and, sql, max } from 'drizzle-orm'
import { db } from '../db'
import { categories, categoryGroups, userProfiles, transactions } from '../db/schema'
import type {
  CreateCategoryInput,
  UpdateCategoryInput,
  CreateCategoryGroupInput,
  UpdateCategoryGroupInput,
} from '@pf/shared'

// Resolve authUserId → userProfile.id
function getProfileId(authUserId: string): string {
  const profile = db
    .select({ id: userProfiles.id })
    .from(userProfiles)
    .where(eq(userProfiles.authUserId, authUserId))
    .get()
  if (!profile) throw Object.assign(new Error('Profile not found'), { status: 404 })
  return profile.id
}

// ─── Category Groups ────────────────────────────────────────

export function getCategoryGroups(authUserId: string, type?: 'income' | 'expense') {
  const profileId = getProfileId(authUserId)

  const conditions = [eq(categoryGroups.userId, profileId)]
  if (type) conditions.push(eq(categoryGroups.type, type))

  return db
    .select()
    .from(categoryGroups)
    .where(and(...conditions))
    .orderBy(categoryGroups.sortOrder)
    .all()
}

export function createCategoryGroup(authUserId: string, data: CreateCategoryGroupInput) {
  const profileId = getProfileId(authUserId)

  // Compute next sortOrder
  const result = db
    .select({ maxOrder: max(categoryGroups.sortOrder) })
    .from(categoryGroups)
    .where(eq(categoryGroups.userId, profileId))
    .get()
  const nextOrder = (result?.maxOrder ?? 0) + 1

  const id = crypto.randomUUID()
  db.insert(categoryGroups).values({
    id,
    userId: profileId,
    name: data.name,
    type: data.type,
    color: data.color ?? null,
    sortOrder: nextOrder,
    isDefault: false,
  }).run()

  return db
    .select()
    .from(categoryGroups)
    .where(eq(categoryGroups.id, id))
    .get()!
}

export function updateCategoryGroup(authUserId: string, id: string, data: UpdateCategoryGroupInput) {
  const profileId = getProfileId(authUserId)

  const group = db
    .select()
    .from(categoryGroups)
    .where(and(eq(categoryGroups.id, id), eq(categoryGroups.userId, profileId)))
    .get()
  if (!group) throw Object.assign(new Error('Category group not found'), { status: 404 })

  const updateData: Record<string, unknown> = {}
  if (data.name !== undefined) updateData.name = data.name
  if (data.color !== undefined) updateData.color = data.color

  db.update(categoryGroups).set(updateData).where(eq(categoryGroups.id, id)).run()

  return db
    .select()
    .from(categoryGroups)
    .where(eq(categoryGroups.id, id))
    .get()!
}

// ─── Categories ─────────────────────────────────────────────

export function getCategories(
  authUserId: string,
  type?: 'income' | 'expense',
  showHidden?: boolean,
) {
  const profileId = getProfileId(authUserId)

  const conditions = [eq(categories.userId, profileId)]
  if (type) conditions.push(eq(categories.type, type))
  if (!showHidden) conditions.push(eq(categories.isVisible, true))

  return db
    .select({
      id: categories.id,
      userId: categories.userId,
      groupId: categories.groupId,
      name: categories.name,
      type: categories.type,
      icon: categories.icon,
      color: categories.color,
      isVisible: categories.isVisible,
      isDefault: categories.isDefault,
      sortOrder: categories.sortOrder,
      createdAt: categories.createdAt,
      group: {
        id: categoryGroups.id,
        userId: categoryGroups.userId,
        name: categoryGroups.name,
        type: categoryGroups.type,
        color: categoryGroups.color,
        sortOrder: categoryGroups.sortOrder,
        isDefault: categoryGroups.isDefault,
        createdAt: categoryGroups.createdAt,
      },
    })
    .from(categories)
    .leftJoin(categoryGroups, eq(categories.groupId, categoryGroups.id))
    .where(and(...conditions))
    .orderBy(categoryGroups.sortOrder, categories.sortOrder)
    .all()
}

function getCategoryWithGroup(id: string) {
  return db
    .select({
      id: categories.id,
      userId: categories.userId,
      groupId: categories.groupId,
      name: categories.name,
      type: categories.type,
      icon: categories.icon,
      color: categories.color,
      isVisible: categories.isVisible,
      isDefault: categories.isDefault,
      sortOrder: categories.sortOrder,
      createdAt: categories.createdAt,
      group: {
        id: categoryGroups.id,
        userId: categoryGroups.userId,
        name: categoryGroups.name,
        type: categoryGroups.type,
        color: categoryGroups.color,
        sortOrder: categoryGroups.sortOrder,
        isDefault: categoryGroups.isDefault,
        createdAt: categoryGroups.createdAt,
      },
    })
    .from(categories)
    .leftJoin(categoryGroups, eq(categories.groupId, categoryGroups.id))
    .where(eq(categories.id, id))
    .get()
}

export function createCategory(authUserId: string, data: CreateCategoryInput) {
  const profileId = getProfileId(authUserId)

  // Verify group ownership
  const group = db
    .select()
    .from(categoryGroups)
    .where(and(eq(categoryGroups.id, data.groupId), eq(categoryGroups.userId, profileId)))
    .get()
  if (!group) throw Object.assign(new Error('Category group not found'), { status: 404 })

  // Unique name check (case-insensitive) within group
  const existing = db
    .select({ id: categories.id })
    .from(categories)
    .where(and(eq(categories.groupId, data.groupId), sql`lower(${categories.name}) = lower(${data.name})`))
    .get()
  if (existing) throw Object.assign(new Error('Tên danh mục đã tồn tại trong nhóm này'), { status: 409 })

  const id = crypto.randomUUID()
  db.insert(categories).values({
    id,
    userId: profileId,
    groupId: data.groupId,
    name: data.name,
    type: data.type,
    icon: data.icon ?? null,
    color: data.color ?? null,
    sortOrder: data.sortOrder ?? 0,
    isDefault: false,
  }).run()

  return getCategoryWithGroup(id)!
}

export function updateCategory(authUserId: string, id: string, data: UpdateCategoryInput) {
  const profileId = getProfileId(authUserId)

  const category = db
    .select()
    .from(categories)
    .where(and(eq(categories.id, id), eq(categories.userId, profileId)))
    .get()
  if (!category) throw Object.assign(new Error('Category not found'), { status: 404 })

  const updateData: Record<string, unknown> = {}
  if (data.name !== undefined) updateData.name = data.name
  if (data.icon !== undefined) updateData.icon = data.icon
  if (data.color !== undefined) updateData.color = data.color

  db.update(categories).set(updateData).where(eq(categories.id, id)).run()

  return getCategoryWithGroup(id)!
}

export function toggleCategoryVisibility(authUserId: string, id: string) {
  const profileId = getProfileId(authUserId)

  const category = db
    .select()
    .from(categories)
    .where(and(eq(categories.id, id), eq(categories.userId, profileId)))
    .get()
  if (!category) throw Object.assign(new Error('Category not found'), { status: 404 })

  db.update(categories)
    .set({ isVisible: !category.isVisible })
    .where(eq(categories.id, id))
    .run()

  return getCategoryWithGroup(id)!
}

export function getTransactionCountByCategory(authUserId: string, categoryId: string): number {
  const profileId = getProfileId(authUserId)

  const result = db
    .select({ count: sql<number>`count(*)` })
    .from(transactions)
    .where(and(eq(transactions.userId, profileId), eq(transactions.categoryId, categoryId)))
    .get()
  return result?.count ?? 0
}

export function deleteCategory(
  authUserId: string,
  id: string,
  replacementCategoryId?: string,
) {
  const profileId = getProfileId(authUserId)

  const category = db
    .select()
    .from(categories)
    .where(and(eq(categories.id, id), eq(categories.userId, profileId)))
    .get()
  if (!category) throw Object.assign(new Error('Category not found'), { status: 404 })
  if (category.isDefault) throw Object.assign(new Error('Không thể xóa danh mục mặc định'), { status: 400 })

  const count = getTransactionCountByCategory(authUserId, id)
  if (count > 0 && !replacementCategoryId) {
    throw Object.assign(new Error('Danh mục này có giao dịch. Vui lòng chọn danh mục thay thế'), { status: 400 })
  }

  if (replacementCategoryId) {
    // Verify ownership of replacement
    const replacement = db
      .select()
      .from(categories)
      .where(and(eq(categories.id, replacementCategoryId), eq(categories.userId, profileId)))
      .get()
    if (!replacement) throw Object.assign(new Error('Replacement category not found'), { status: 404 })

    // Re-assign transactions
    db.update(transactions)
      .set({ categoryId: replacementCategoryId })
      .where(eq(transactions.categoryId, id))
      .run()
  }

  db.delete(categories).where(eq(categories.id, id)).run()
}
