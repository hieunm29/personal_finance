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

export interface CategoryGroupWithCategories extends CategoryGroup {
  categories: Category[]
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
  assetId: string | null
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
  asset: Asset | null
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

export interface CategoryBudgetWithProgress {
  id: string
  budgetId: string
  categoryId: string
  limitAmount: number // cents
  category: { id: string; name: string; icon: string | null; color: string | null }
  spent: number // cents
  remaining: number // cents (có thể âm nếu vượt)
  percentage: number // 0-100+
}

export interface BudgetWithProgress {
  id: string
  userId: string
  month: string
  totalLimit: number // cents
  createdAt: string
  updatedAt: string
  totalSpent: number // cents
  remaining: number // cents
  percentage: number // 0-100+
  categories: CategoryBudgetWithProgress[]
}

export interface BudgetHistory {
  month: string // YYYY-MM
  totalLimit: number // cents
  totalSpent: number // cents
  overage: number // cents: dương = vượt, âm = còn dư
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

export interface RecurringTemplate {
  id: string
  userId: string
  type: TransactionType
  amount: number // cents
  categoryId: string
  walletId: string
  assetId: string | null
  note: string | null
  interval: RecurrenceInterval
  startDate: string
  endDate: string | null
  lastGeneratedDate: string | null
  isActive: boolean
  createdAt: string
}

export interface RecurringWithRelations extends RecurringTemplate {
  category: Category
  wallet: Wallet
}

export interface TransactionSummary {
  totalIncome: number // cents
  totalExpense: number // cents
  totalBalance: number // cents
}

export interface ApiError {
  error: {
    message: string
    code?: string
  }
}

// ═══════════════════════════════════════════════════════════
// Asset analytics types
// ═══════════════════════════════════════════════════════════
export interface AssetAllocationItem {
  type: AssetType
  label: string
  totalValue: number
  percentage: number
}

export interface NetWorthData {
  netWorth: number
  totalAssets: number
  totalDebt: number
  byType: AssetAllocationItem[]
}

export interface NetWorthHistoryPoint {
  month: string // YYYY-MM
  netWorth: number
}

// ═══════════════════════════════════════════════════════════
// Dashboard types
// ═══════════════════════════════════════════════════════════
export interface TopExpenseCategory {
  categoryId: string | null
  categoryName: string
  categoryIcon: string | null
  categoryColor: string | null
  amount: number
  percentage: number
}

export interface MonthlyChartPoint {
  month: string // YYYY-MM
  income: number
  expense: number
}

export interface BudgetProgressItem {
  categoryId: string
  categoryName: string
  limit: number
  spent: number
}

export interface DashboardData {
  totalIncome: number
  totalExpense: number
  netAmount: number
  prevMonthIncome: number
  prevMonthExpense: number
  totalBalance: number
  netWorth: number | null
  recentTransactions: TransactionWithRelations[]
  topExpenseCategories: TopExpenseCategory[]
  monthlyChart: MonthlyChartPoint[]
  budgetProgress: BudgetProgressItem[] | null
}

// ═══════════════════════════════════════════════════════════
// Report types
// ═══════════════════════════════════════════════════════════
export interface MonthlyOverview {
  totalIncome: number
  totalExpense: number
  transactionCount: number
  incomeCount: number
  expenseCount: number
  difference: number
}

export interface MonthComparison {
  incomeChangePercent: number | null
  expenseChangePercent: number | null
}

export interface CategoryExpense {
  categoryId: string
  categoryName: string
  categoryIcon: string | null
  categoryColor: string | null
  totalAmount: number
  percentage: number
  transactionCount: number
}

export interface TrendDataPoint {
  month: string
  totalIncome: number
  totalExpense: number
  averageExpense: number
}

export interface BudgetComparisonItem {
  categoryId: string
  categoryName: string
  categoryIcon: string | null
  budgetAmount: number
  actualAmount: number
  percentage: number
}

export interface AnnualSummaryItem {
  month: string
  income: number
  expense: number
  difference: number
}

export interface AnnualSummary {
  monthly: AnnualSummaryItem[]
  totalIncome: number
  totalExpense: number
  averageIncome: number
  averageExpense: number
}

export type DateFilterPreset = 'this_week' | 'this_month' | 'this_quarter' | 'this_year' | 'last_month' | 'last_year'

export interface DateRange {
  startDate: string
  endDate: string
}

export interface ReportDateFilter {
  filter: DateFilterPreset
  startDate: string
  endDate: string
}
