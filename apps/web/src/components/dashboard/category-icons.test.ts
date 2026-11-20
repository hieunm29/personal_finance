import { describe, expect, test } from 'bun:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router'
import type { TransactionWithRelations } from '@pf/shared'
import RecentTransactionsList from './RecentTransactionsList'
import BudgetProgressCard from './BudgetProgressCard'

const icons = ['utensils', 'party-popper', 'briefcase', 'shirt', 'house']

describe('Dashboard category icons', () => {
  test('recent transactions render category identifiers as SVG icons', () => {
    const transactions = icons.map((icon, index) => ({
      id: `transaction-${index}`, type: index === 1 || index === 2 ? 'income' : 'expense',
      amount: 100000, date: '2026-10-24', note: null,
      category: { name: `Category ${index}`, icon }, wallet: null,
    })) as unknown as TransactionWithRelations[]
    const markup = renderToStaticMarkup(createElement(MemoryRouter, null,
      createElement(RecentTransactionsList, { transactions, currency: 'VND', onEditTransaction: () => undefined }),
    ))
    for (const icon of icons) expect(markup).not.toContain(`>${icon}<`)
    expect(markup.match(/class="db-detail-transaction-icon[^\"]*"[^>]*><svg/g)?.length).toBe(icons.length)
  })

  test('budget category identifiers also render as SVG icons', () => {
    const markup = renderToStaticMarkup(createElement(MemoryRouter, null,
      createElement(BudgetProgressCard, {
        budgetProgress: [{ categoryId: 'food', categoryName: 'Ăn uống', spent: 100000, limit: 200000 }],
        progress: {
          id: 'budget', userId: 'user', month: '2026-10', totalLimit: 200000, totalSpent: 100000, remaining: 100000, percentage: 50, createdAt: '2026-10-01', updatedAt: '2026-10-01',
          categories: [{ id: 'category-budget', budgetId: 'budget', categoryId: 'food', limitAmount: 200000, spent: 100000, remaining: 100000, percentage: 50, category: { id: 'food', name: 'Ăn uống', icon: 'utensils', color: '#f59e0b' } }],
        },
      }),
    ))
    expect(markup).not.toContain('>utensils<')
    expect(markup).toMatch(/class="db-detail-budget-icon"[^>]*><svg/)
  })
})
