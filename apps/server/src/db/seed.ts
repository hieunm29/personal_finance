import { db, sqlite } from './index'
import {
  userProfiles,
  categoryGroups,
  categories,
  wallets,
  transactions,
} from './schema'
import { DEFAULT_CATEGORY_GROUPS } from '@pf/shared'

const TEST_USER_AUTH_ID = 'aaaaaaaa-0000-0000-0000-000000000001'

async function seed() {
  console.log('Seeding database...')

  // Create test user profile
  const [user] = db.insert(userProfiles).values({
    authUserId: TEST_USER_AUTH_ID,
    displayName: 'Test User',
    currency: 'VND',
    theme: 'system',
  }).returning().all()

  console.log(`Created user: ${user.id}`)

  // Seed default category groups and categories
  for (const group of DEFAULT_CATEGORY_GROUPS) {
    const [createdGroup] = db.insert(categoryGroups).values({
      userId: user.id,
      name: group.name,
      type: group.type,
      color: group.color,
      sortOrder: group.sortOrder,
      isDefault: true,
    }).returning().all()

    for (const cat of group.categories) {
      db.insert(categories).values({
        userId: user.id,
        groupId: createdGroup.id,
        name: cat.name,
        type: group.type,
        icon: cat.icon,
        color: cat.color,
        sortOrder: cat.sortOrder,
        isDefault: true,
      }).run()
    }
  }

  console.log('Created default categories')

  // Create wallets
  const [cashWallet] = db.insert(wallets).values({
    userId: user.id,
    name: 'Tiền mặt',
    type: 'cash',
    initialBalance: 500000000, // 5,000,000 VND in cents
    isDefault: true,
  }).returning().all()

  const [bankWallet] = db.insert(wallets).values({
    userId: user.id,
    name: 'Vietcombank',
    type: 'bank',
    initialBalance: 1500000000, // 15,000,000 VND in cents
  }).returning().all()

  console.log('Created wallets')

  // Get some categories for transactions
  const allCategories = db.select().from(categories).all()
  const anuongCat = allCategories.find(c => c.name === 'Ăn uống')!
  const luongCat = allCategories.find(c => c.name === 'Lương')!
  const dichuyen = allCategories.find(c => c.name === 'Di chuyển')!

  // Create sample transactions (Jan-Feb 2026)
  const sampleTransactions = [
    { type: 'income' as const, amount: 2000000000, categoryId: luongCat.id, walletId: bankWallet.id, date: '2026-01-05', note: 'Lương tháng 1' },
    { type: 'expense' as const, amount: 15000000, categoryId: anuongCat.id, walletId: cashWallet.id, date: '2026-01-10', note: 'Cơm trưa' },
    { type: 'expense' as const, amount: 5000000, categoryId: dichuyen.id, walletId: cashWallet.id, date: '2026-01-12', note: 'Grab đi làm' },
    { type: 'income' as const, amount: 2000000000, categoryId: luongCat.id, walletId: bankWallet.id, date: '2026-02-05', note: 'Lương tháng 2' },
    { type: 'expense' as const, amount: 20000000, categoryId: anuongCat.id, walletId: cashWallet.id, date: '2026-02-08', note: 'Ăn tối' },
  ]

  for (const tx of sampleTransactions) {
    db.insert(transactions).values({
      userId: user.id,
      ...tx,
    }).run()
  }

  console.log('Created sample transactions')
  console.log('Seed complete!')
}

seed().catch(console.error)
