// ═══════════════════════════════════════════════════════════
// Enum types
// ═══════════════════════════════════════════════════════════
export type TransactionType = 'income' | 'expense' | 'transfer'
export type CategoryType = 'income' | 'expense'
export type WalletType = 'cash' | 'bank' | 'e-wallet'
export type AssetType = 'cash' | 'bank' | 'gold' | 'stock' | 'savings' | 'real_estate' | 'debt'
export type RecurrenceInterval = 'weekly' | 'monthly' | 'yearly'
export type ThemePreference = 'light' | 'dark' | 'system'

// ═══════════════════════════════════════════════════════════
// Entity types — khớp với DB schema (monetary = integer cents)
// ═══════════════════════════════════════════════════════════
export interface UserProfile {
  id: string
  authUserId: string
  displayName: string | null
  currency: string
  theme: ThemePreference
  createdAt: string
  updatedAt: string
}

export interface CategoryGroup {
  id: string
  userId: string
  name: string
  type: CategoryType
  color: string | null
  sortOrder: number
  isDefault: boolean
  createdAt: string
}

export interface Category {
  id: string
  userId: string
  groupId: string
  name: string
  type: CategoryType
  icon: string | null
  color: string | null
  isVisible: boolean
  isDefault: boolean
  sortOrder: number
  createdAt: string
}

export interface CategoryWithGroup extends Category {
  group: CategoryGroup
}

export interface Wallet {
  id: string
  userId: string
  name: string
  type: WalletType
  initialBalance: number // cents
  isDefault: boolean
  createdAt: string
  updatedAt: string
}

export interface Transaction {
  id: string
  userId: string
  type: TransactionType
  amount: number // cents
  categoryId: string
  walletId: string
  toWalletId: string | null
  date: string
  note: string | null
  isRecurring: boolean
  createdAt: string
  updatedAt: string
}

export interface TransactionWithRelations extends Transaction {
  category: Category
  wallet: Wallet
  toWallet: Wallet | null
}

export interface Budget {
  id: string
  userId: string
  month: string
  totalLimit: number // cents
  createdAt: string
  updatedAt: string
}

export interface CategoryBudget {
  id: string
  budgetId: string
  categoryId: string
  limitAmount: number // cents
}

export interface CategoryBudgetWithSpent extends CategoryBudget {
  category: Category
  spent: number // cents
}

export interface Asset {
  id: string
  userId: string
  type: AssetType
  name: string
  currentValue: number // cents
  metadata: string | null
  note: string | null
  createdAt: string
  updatedAt: string
}

export interface AssetHistory {
  id: string
  assetId: string
  date: string
  value: number // cents
  createdAt: string
}

// ═══════════════════════════════════════════════════════════
// API response types
// ═══════════════════════════════════════════════════════════
export interface PaginationMeta {
  page: number
  limit: number
  total: number
  totalPages: number
}

export interface PaginatedResponse<T> {
  data: T[]
  meta: PaginationMeta
}

export interface ApiError {
  error: {
    message: string
    code?: string
  }
}
