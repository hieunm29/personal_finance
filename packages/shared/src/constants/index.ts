export const CURRENCIES = ['VND', 'USD', 'EUR'] as const

// Default categories seeded for every new user
export const DEFAULT_CATEGORY_GROUPS = [
  // ── Expense ────────────────────────────────────────────
  {
    name: 'Thiết yếu',
    type: 'expense' as const,
    color: '#ef4444',
    sortOrder: 1,
    categories: [
      { name: 'Ăn uống',      icon: 'utensils',       color: '#ef4444', sortOrder: 1 },
      { name: 'Di chuyển',    icon: 'car',             color: '#f97316', sortOrder: 2 },
      { name: 'Nhà ở',        icon: 'house',           color: '#eab308', sortOrder: 3 },
      { name: 'Điện nước',    icon: 'zap',             color: '#84cc16', sortOrder: 4 },
      { name: 'Y tế',         icon: 'pill',            color: '#22c55e', sortOrder: 5 },
      { name: 'Bảo hiểm',     icon: 'shield',          color: '#06b6d4', sortOrder: 6 },
    ],
  },
  {
    name: 'Sinh hoạt',
    type: 'expense' as const,
    color: '#3b82f6',
    sortOrder: 2,
    categories: [
      { name: 'Mua sắm',           icon: 'shirt',       color: '#3b82f6', sortOrder: 1 },
      { name: 'Giáo dục',          icon: 'book-open',   color: '#8b5cf6', sortOrder: 2 },
      { name: 'Chăm sóc cá nhân',  icon: 'sparkles',    color: '#d946ef', sortOrder: 3 },
    ],
  },
  {
    name: 'Giải trí',
    type: 'expense' as const,
    color: '#ec4899',
    sortOrder: 3,
    categories: [
      { name: 'Cafe/Ăn ngoài', icon: 'coffee',     color: '#f43f5e', sortOrder: 1 },
      { name: 'Giải trí',      icon: 'gamepad-2',  color: '#ec4899', sortOrder: 2 },
      { name: 'Du lịch',       icon: 'plane',      color: '#14b8a6', sortOrder: 3 },
      { name: 'Thể thao',      icon: 'dumbbell',   color: '#10b981', sortOrder: 4 },
    ],
  },
  {
    name: 'Xã hội',
    type: 'expense' as const,
    color: '#f59e0b',
    sortOrder: 4,
    categories: [
      { name: 'Quà tặng', icon: 'gift',       color: '#f59e0b', sortOrder: 1 },
      { name: 'Từ thiện', icon: 'handshake',  color: '#6366f1', sortOrder: 2 },
    ],
  },
  // ── Income ─────────────────────────────────────────────
  {
    name: 'Thu nhập chính',
    type: 'income' as const,
    color: '#16a34a',
    sortOrder: 1,
    categories: [
      { name: 'Lương',    icon: 'briefcase',      color: '#16a34a', sortOrder: 1 },
      { name: 'Thưởng',   icon: 'party-popper',   color: '#15803d', sortOrder: 2 },
      { name: 'Phụ cấp',  icon: 'clipboard-list', color: '#4ade80', sortOrder: 3 },
    ],
  },
  {
    name: 'Thu nhập phụ',
    type: 'income' as const,
    color: '#0ea5e9',
    sortOrder: 2,
    categories: [
      { name: 'Freelance', icon: 'laptop', color: '#0ea5e9', sortOrder: 1 },
      { name: 'Cho thuê',  icon: 'home',   color: '#38bdf8', sortOrder: 2 },
    ],
  },
  {
    name: 'Đầu tư',
    type: 'income' as const,
    color: '#7c3aed',
    sortOrder: 3,
    categories: [
      { name: 'Lãi tiết kiệm', icon: 'landmark',    color: '#a78bfa', sortOrder: 1 },
      { name: 'Cổ tức',        icon: 'trending-up',  color: '#7c3aed', sortOrder: 2 },
      { name: 'Lãi cổ phiếu',  icon: 'chart-line',   color: '#6d28d9', sortOrder: 3 },
    ],
  },
  {
    name: 'Khác',
    type: 'income' as const,
    color: '#f472b6',
    sortOrder: 4,
    categories: [
      { name: 'Được tặng', icon: 'ribbon', color: '#f472b6', sortOrder: 1 },
      { name: 'Hoàn tiền', icon: 'wallet', color: '#fb923c', sortOrder: 2 },
    ],
  },
] as const
export const DEFAULT_CURRENCY = 'VND'

export const TRANSACTION_TYPES = ['income', 'expense', 'transfer'] as const
export const CATEGORY_TYPES = ['income', 'expense'] as const
export const WALLET_TYPES = ['cash', 'bank', 'e-wallet'] as const
export const ASSET_TYPES = ['cash', 'bank', 'gold', 'stock', 'savings', 'real_estate', 'debt'] as const
export const THEME_PREFERENCES = ['light', 'dark', 'system'] as const

// Query keys — dùng cho TanStack Query invalidation
export const QUERY_KEYS = {
  profile: ['profile'] as const,
  dashboard: ['dashboard'] as const,
  transactions: ['transactions'] as const,
  categories: ['categories'] as const,
  categoryGroups: ['category-groups'] as const,
  wallets: ['wallets'] as const,
  budgets: ['budgets'] as const,
  budgetProgress: ['budgets', 'progress'] as const,
  budgetHistory: ['budgets', 'history'] as const,
  assets: ['assets'] as const,
  reports: ['reports'] as const,
} as const

// Route paths
export const ROUTES = {
  login: '/login',
  register: '/register',
  dashboard: '/',
  transactions: '/transactions',
  categories: '/categories',
  budget: '/budget',
  assets: '/assets',
  reports: '/reports',
  settings: '/settings',
} as const
