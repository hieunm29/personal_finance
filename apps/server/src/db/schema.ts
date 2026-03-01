import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core'
import { relations, sql } from 'drizzle-orm'

// ═══════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════
const id = () => text('id').primaryKey().$defaultFn(() => crypto.randomUUID())
const createdAt = () => text('created_at').notNull().default(sql`(datetime('now'))`)
const updatedAt = () => text('updated_at').notNull().default(sql`(datetime('now'))`)

// ═══════════════════════════════════════════════════════════
// better-auth tables
// ═══════════════════════════════════════════════════════════
export const user = sqliteTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: integer('email_verified', { mode: 'boolean' }).notNull().default(false),
  image: text('image'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
})

export const session = sqliteTable('session', {
  id: text('id').primaryKey(),
  expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
  token: text('token').notNull().unique(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
})

export const account = sqliteTable('account', {
  id: text('id').primaryKey(),
  accountId: text('account_id').notNull(),
  providerId: text('provider_id').notNull(),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  idToken: text('id_token'),
  accessTokenExpiresAt: integer('access_token_expires_at', { mode: 'timestamp' }),
  refreshTokenExpiresAt: integer('refresh_token_expires_at', { mode: 'timestamp' }),
  scope: text('scope'),
  password: text('password'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
})

export const verification = sqliteTable('verification', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }),
  updatedAt: integer('updated_at', { mode: 'timestamp' }),
})

// ═══════════════════════════════════════════════════════════
// App tables
// ═══════════════════════════════════════════════════════════
export const userProfiles = sqliteTable('user_profiles', {
  id: id(),
  authUserId: text('auth_user_id').notNull().unique(),
  displayName: text('display_name'),
  currency: text('currency').notNull().default('VND'),
  theme: text('theme').notNull().default('system'), // 'light' | 'dark' | 'system'
  createdAt: createdAt(),
  updatedAt: updatedAt(),
})

export const categoryGroups = sqliteTable('category_groups', {
  id: id(),
  userId: text('user_id').notNull().references(() => userProfiles.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  type: text('type').notNull(), // 'income' | 'expense'
  color: text('color'),
  sortOrder: integer('sort_order').notNull().default(0),
  isDefault: integer('is_default', { mode: 'boolean' }).notNull().default(false),
  createdAt: createdAt(),
})

export const categories = sqliteTable('categories', {
  id: id(),
  userId: text('user_id').notNull().references(() => userProfiles.id, { onDelete: 'cascade' }),
  groupId: text('group_id').notNull().references(() => categoryGroups.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  type: text('type').notNull(), // 'income' | 'expense'
  icon: text('icon'),
  color: text('color'),
  isVisible: integer('is_visible', { mode: 'boolean' }).notNull().default(true),
  isDefault: integer('is_default', { mode: 'boolean' }).notNull().default(false),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: createdAt(),
})

export const wallets = sqliteTable('wallets', {
  id: id(),
  userId: text('user_id').notNull().references(() => userProfiles.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  type: text('type').notNull(), // 'cash' | 'bank' | 'e-wallet'
  initialBalance: integer('initial_balance').notNull().default(0), // stored in cents
  isDefault: integer('is_default', { mode: 'boolean' }).notNull().default(false),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
})

export const transactions = sqliteTable('transactions', {
  id: id(),
  userId: text('user_id').notNull().references(() => userProfiles.id, { onDelete: 'cascade' }),
  type: text('type').notNull(), // 'income' | 'expense' | 'transfer'
  amount: integer('amount').notNull(), // stored in cents
  categoryId: text('category_id').notNull().references(() => categories.id),
  walletId: text('wallet_id').notNull().references(() => wallets.id),
  toWalletId: text('to_wallet_id').references(() => wallets.id),
  date: text('date').notNull(), // YYYY-MM-DD
  note: text('note'),
  isRecurring: integer('is_recurring', { mode: 'boolean' }).notNull().default(false),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
})

export const recurringTemplates = sqliteTable('recurring_templates', {
  id: id(),
  userId: text('user_id').notNull().references(() => userProfiles.id, { onDelete: 'cascade' }),
  type: text('type').notNull(), // 'income' | 'expense' | 'transfer'
  amount: integer('amount').notNull(), // stored in cents
  categoryId: text('category_id').notNull().references(() => categories.id),
  walletId: text('wallet_id').notNull().references(() => wallets.id),
  note: text('note'),
  interval: text('interval').notNull(), // 'weekly' | 'monthly' | 'yearly'
  startDate: text('start_date').notNull(), // YYYY-MM-DD
  endDate: text('end_date'),
  lastGeneratedDate: text('last_generated_date'),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdAt: createdAt(),
})

export const budgets = sqliteTable('budgets', {
  id: id(),
  userId: text('user_id').notNull().references(() => userProfiles.id, { onDelete: 'cascade' }),
  month: text('month').notNull(), // YYYY-MM
  totalLimit: integer('total_limit').notNull(), // stored in cents
  createdAt: createdAt(),
  updatedAt: updatedAt(),
})

export const categoryBudgets = sqliteTable('category_budgets', {
  id: id(),
  budgetId: text('budget_id').notNull().references(() => budgets.id, { onDelete: 'cascade' }),
  categoryId: text('category_id').notNull().references(() => categories.id),
  limitAmount: integer('limit_amount').notNull(), // stored in cents
})

export const assets = sqliteTable('assets', {
  id: id(),
  userId: text('user_id').notNull().references(() => userProfiles.id, { onDelete: 'cascade' }),
  type: text('type').notNull(), // 'cash' | 'bank' | 'gold' | 'stock' | 'savings' | 'real_estate' | 'debt'
  name: text('name').notNull(),
  currentValue: integer('current_value').notNull().default(0), // stored in cents
  metadata: text('metadata'),
  note: text('note'),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
})

export const assetHistory = sqliteTable('asset_history', {
  id: id(),
  assetId: text('asset_id').notNull().references(() => assets.id, { onDelete: 'cascade' }),
  date: text('date').notNull(), // YYYY-MM-DD
  value: integer('value').notNull(), // stored in cents
  createdAt: createdAt(),
})

// ═══════════════════════════════════════════════════════════
// Relations
// ═══════════════════════════════════════════════════════════
export const userProfilesRelations = relations(userProfiles, ({ many }) => ({
  categoryGroups: many(categoryGroups),
  categories: many(categories),
  wallets: many(wallets),
  transactions: many(transactions),
  budgets: many(budgets),
  assets: many(assets),
}))

export const categoryGroupsRelations = relations(categoryGroups, ({ one, many }) => ({
  user: one(userProfiles, { fields: [categoryGroups.userId], references: [userProfiles.id] }),
  categories: many(categories),
}))

export const categoriesRelations = relations(categories, ({ one }) => ({
  user: one(userProfiles, { fields: [categories.userId], references: [userProfiles.id] }),
  group: one(categoryGroups, { fields: [categories.groupId], references: [categoryGroups.id] }),
}))

export const walletsRelations = relations(wallets, ({ one }) => ({
  user: one(userProfiles, { fields: [wallets.userId], references: [userProfiles.id] }),
}))

export const transactionsRelations = relations(transactions, ({ one }) => ({
  user: one(userProfiles, { fields: [transactions.userId], references: [userProfiles.id] }),
  category: one(categories, { fields: [transactions.categoryId], references: [categories.id] }),
  wallet: one(wallets, { fields: [transactions.walletId], references: [wallets.id] }),
  toWallet: one(wallets, { fields: [transactions.toWalletId], references: [wallets.id] }),
}))

export const budgetsRelations = relations(budgets, ({ one, many }) => ({
  user: one(userProfiles, { fields: [budgets.userId], references: [userProfiles.id] }),
  categoryBudgets: many(categoryBudgets),
}))

export const categoryBudgetsRelations = relations(categoryBudgets, ({ one }) => ({
  budget: one(budgets, { fields: [categoryBudgets.budgetId], references: [budgets.id] }),
  category: one(categories, { fields: [categoryBudgets.categoryId], references: [categories.id] }),
}))

export const assetsRelations = relations(assets, ({ one, many }) => ({
  user: one(userProfiles, { fields: [assets.userId], references: [userProfiles.id] }),
  history: many(assetHistory),
}))

export const assetHistoryRelations = relations(assetHistory, ({ one }) => ({
  asset: one(assets, { fields: [assetHistory.assetId], references: [assets.id] }),
}))
