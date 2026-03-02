import { z } from 'zod'

// ═══════════════════════════════════════════════════════════
// Auth schemas
// ═══════════════════════════════════════════════════════════
const passwordSchema = z
  .string()
  .min(8, 'Mật khẩu tối thiểu 8 ký tự')
  .regex(/[A-Z]/, 'Mật khẩu phải có ít nhất 1 chữ hoa')
  .regex(/[a-z]/, 'Mật khẩu phải có ít nhất 1 chữ thường')
  .regex(/[0-9]/, 'Mật khẩu phải có ít nhất 1 chữ số')

export const signUpSchema = z
  .object({
    email: z.string().email('Email không hợp lệ'),
    password: passwordSchema,
    confirmPassword: z.string().min(1, 'Vui lòng xác nhận mật khẩu'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Mật khẩu xác nhận không khớp',
    path: ['confirmPassword'],
  })

export const signInSchema = z.object({
  email: z.string().email('Email không hợp lệ'),
  password: z.string().min(1, 'Vui lòng nhập mật khẩu'),
})

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Vui lòng nhập mật khẩu hiện tại'),
    newPassword: passwordSchema,
    confirmNewPassword: z.string().min(1, 'Vui lòng xác nhận mật khẩu mới'),
  })
  .refine((data) => data.newPassword === data.confirmNewPassword, {
    message: 'Mật khẩu xác nhận không khớp',
    path: ['confirmNewPassword'],
  })

// ═══════════════════════════════════════════════════════════
// Transaction schemas
// ═══════════════════════════════════════════════════════════
export const createTransactionSchema = z.object({
  type: z.enum(['income', 'expense', 'transfer']),
  amount: z.number().positive('Số tiền phải lớn hơn 0'),
  categoryId: z.string().uuid('Category ID không hợp lệ'),
  walletId: z.string().uuid('Wallet ID không hợp lệ'),
  toWalletId: z.string().uuid().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Định dạng ngày: YYYY-MM-DD'),
  note: z.string().max(500).optional(),
  isRecurring: z.boolean().default(false),
})

export const updateTransactionSchema = createTransactionSchema.omit({ type: true }).partial()

export const transactionFilterSchema = z.object({
  type: z.enum(['income', 'expense', 'transfer']).optional(),
  categoryId: z.string().uuid().optional(),
  walletId: z.string().uuid().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  search: z.string().optional(),
  amountFrom: z.coerce.number().int().optional(),
  amountTo: z.coerce.number().int().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
})

export const createRecurringSchema = z.object({
  type: z.enum(['income', 'expense', 'transfer']),
  amount: z.number().int().positive('Số tiền phải lớn hơn 0'),
  categoryId: z.string().uuid('Category ID không hợp lệ'),
  walletId: z.string().uuid('Wallet ID không hợp lệ'),
  note: z.string().max(500).optional(),
  interval: z.enum(['weekly', 'monthly', 'yearly']),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Định dạng ngày: YYYY-MM-DD'),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
})

export const updateRecurringSchema = createRecurringSchema
  .pick({ amount: true, note: true, endDate: true })
  .extend({ isActive: z.boolean().optional() })
  .partial()

// ═══════════════════════════════════════════════════════════
// Category schemas
// ═══════════════════════════════════════════════════════════
export const createCategoryGroupSchema = z.object({
  name: z.string().min(1).max(100),
  type: z.enum(['income', 'expense']),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  sortOrder: z.number().int().default(0),
})

export const createCategorySchema = z.object({
  groupId: z.string().uuid(),
  name: z.string().min(1).max(100),
  type: z.enum(['income', 'expense']),
  icon: z.string().max(50).optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  sortOrder: z.number().int().default(0),
})

export const updateCategorySchema = createCategorySchema
  .pick({ name: true, icon: true, color: true })
  .partial()

export const updateCategoryGroupSchema = createCategoryGroupSchema
  .pick({ name: true, color: true })
  .partial()

export const deleteCategorySchema = z.object({
  replacementCategoryId: z.string().uuid().optional(),
})

// ═══════════════════════════════════════════════════════════
// Wallet schemas
// ═══════════════════════════════════════════════════════════
export const createWalletSchema = z.object({
  name: z.string().min(1).max(100),
  type: z.enum(['cash', 'bank', 'e-wallet']),
  initialBalance: z.number().default(0),
  isDefault: z.boolean().default(false),
})

export const updateWalletSchema = createWalletSchema.partial()

// ═══════════════════════════════════════════════════════════
// Budget schemas
// ═══════════════════════════════════════════════════════════
export const createBudgetSchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/, 'Định dạng tháng: YYYY-MM'),
  totalLimit: z.number().positive(),
  categoryBudgets: z.array(z.object({
    categoryId: z.string().uuid(),
    limitAmount: z.number().positive(),
  })).optional(),
})

// ═══════════════════════════════════════════════════════════
// Asset schemas
// ═══════════════════════════════════════════════════════════
export const createAssetSchema = z.object({
  type: z.enum(['cash', 'bank', 'gold', 'stock', 'savings', 'real_estate', 'debt']),
  name: z.string().min(1).max(200),
  currentValue: z.number().min(0),
  metadata: z.string().optional(),
  note: z.string().max(500).optional(),
})

export const updateAssetSchema = createAssetSchema.partial()

// ═══════════════════════════════════════════════════════════
// Settings schemas
// ═══════════════════════════════════════════════════════════
export const updateProfileSchema = z.object({
  displayName: z.string().min(1).max(100).optional(),
  currency: z.string().length(3).optional(),
  theme: z.enum(['light', 'dark', 'system']).optional(),
})

// ═══════════════════════════════════════════════════════════
// Inferred input types
// ═══════════════════════════════════════════════════════════
export type SignUpInput = z.infer<typeof signUpSchema>
export type SignInInput = z.infer<typeof signInSchema>
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>
export type CreateTransactionInput = z.infer<typeof createTransactionSchema>
export type UpdateTransactionInput = z.infer<typeof updateTransactionSchema>
export type TransactionFilter = z.infer<typeof transactionFilterSchema>
export type CreateRecurringInput = z.infer<typeof createRecurringSchema>
export type UpdateRecurringInput = z.infer<typeof updateRecurringSchema>
export type CreateCategoryGroupInput = z.infer<typeof createCategoryGroupSchema>
export type UpdateCategoryGroupInput = z.infer<typeof updateCategoryGroupSchema>
export type CreateCategoryInput = z.infer<typeof createCategorySchema>
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>
export type DeleteCategoryInput = z.infer<typeof deleteCategorySchema>
export type CreateWalletInput = z.infer<typeof createWalletSchema>
export type UpdateWalletInput = z.infer<typeof updateWalletSchema>
export type CreateBudgetInput = z.infer<typeof createBudgetSchema>
export type CreateAssetInput = z.infer<typeof createAssetSchema>
export type UpdateAssetInput = z.infer<typeof updateAssetSchema>
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>
