import { and, eq, inArray, ne } from 'drizzle-orm'
import { db } from '../db'
import { assets, categories, userProfiles, wallets } from '../db/schema'

/**
 * Lấy profileId (bảng user_profiles) từ authUserId (bảng user của better-auth).
 * Mọi service trong dự án đều nhận authUserId, nên AI cũng làm việc với authUserId.
 */
export function getProfileIdByAuthUser(authUserId: string): string {
  const profile = db.select({ id: userProfiles.id }).from(userProfiles)
    .where(eq(userProfiles.authUserId, authUserId)).get()
  if (!profile) throw Object.assign(new Error('Profile not found'), { status: 404 })
  return profile.id
}

export function getAuthUserIdByProfile(profileId: string): string | null {
  const profile = db.select({ authUserId: userProfiles.authUserId }).from(userProfiles)
    .where(eq(userProfiles.id, profileId)).get()
  return profile?.authUserId ?? null
}

export interface AccountOption {
  /** Giá trị truyền vào walletId của createTransaction (UUID ví cũ, hoặc 'asset-' + UUID tài khoản tiền mặt/ngân hàng). */
  id: string
  name: string
  /** cash/bank: tài sản có số dư thật; wallet: ví kiểu cũ, không có số dư. */
  kind: 'wallet' | 'bank' | 'cash'
  isDefault: boolean
  /** Số dư hiện tại (VND) — chỉ tài khoản cash/bank. */
  balanceVnd?: number
}

export interface CategoryOption {
  id: string
  name: string
  type: 'income' | 'expense'
}

export interface UserFinanceContext {
  categories: CategoryOption[]
  accounts: AccountOption[]
}

/**
 * Danh mục + ví/tài khoản của user. Đưa vào system prompt để Claude chọn đúng
 * categoryId / walletId mà không phải tốn thêm 1 lượt gọi tool để tra cứu.
 */
export function getUserFinanceContext(authUserId: string): UserFinanceContext {
  const profileId = getProfileIdByAuthUser(authUserId)

  const categoryRows = db.select({ id: categories.id, name: categories.name, type: categories.type })
    .from(categories)
    .where(and(eq(categories.userId, profileId), eq(categories.isVisible, true), ne(categories.type, 'transfer')))
    .orderBy(categories.type, categories.sortOrder)
    .all()

  const walletRows = db.select({ id: wallets.id, name: wallets.name, isDefault: wallets.isDefault })
    .from(wallets).where(eq(wallets.userId, profileId)).orderBy(wallets.createdAt).all()

  const accountRows = db.select({ id: assets.id, name: assets.name, type: assets.type, value: assets.currentValue })
    .from(assets).where(and(eq(assets.userId, profileId), inArray(assets.type, ['cash', 'bank'])))
    .orderBy(assets.createdAt).all()
  const asAccount = (row: (typeof accountRows)[number]) => ({
    id: `asset-${row.id}`, name: row.name, kind: row.type as 'cash' | 'bank', isDefault: false, balanceVnd: Math.round(row.value / 100),
  })

  return {
    categories: categoryRows.map((row) => ({ id: row.id, name: row.name, type: row.type as 'income' | 'expense' })),
    accounts: [
      ...accountRows.filter((row) => row.type === 'cash').map(asAccount),
      ...accountRows.filter((row) => row.type === 'bank').map(asAccount),
      ...walletRows.map((row) => ({ id: row.id, name: row.name, kind: 'wallet' as const, isDefault: row.isDefault })),
    ],
  }
}

/** Tài khoản mặc định: tiền mặt (có số dư) → ví cũ đánh dấu mặc định → tài khoản đầu tiên. */
export function getDefaultAccountId(context: UserFinanceContext): string | null {
  return (context.accounts.find((account) => account.kind === 'cash')
    ?? context.accounts.find((account) => account.isDefault)
    ?? context.accounts[0])?.id ?? null
}
