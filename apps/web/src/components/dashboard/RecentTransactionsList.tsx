import { useNavigate } from 'react-router'
import { type TransactionWithRelations } from '@pf/shared'
import { formatCurrency } from '../../utils/format'
import TransactionCategoryIcon from '../transaction/TransactionCategoryIcon'
import './dashboard-details.css'

interface Props {
  transactions: TransactionWithRelations[]
  currency: string
  onEditTransaction: (id: string) => void
}

interface TransactionGroup {
  label: string
  items: TransactionWithRelations[]
}

function dateKey(date: string): string {
  return date.slice(0, 10)
}

function groupLabel(date: string): string {
  const target = new Date(`${dateKey(date)}T00:00:00`)
  const today = new Date()
  const current = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const dayDiff = Math.round((current.getTime() - target.getTime()) / 86_400_000)
  if (dayDiff === 0) return 'Hôm nay'
  if (dayDiff === 1) return 'Hôm qua'
  if (dayDiff >= 2 && dayDiff < 7) return 'Tuần này'
  return new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(target)
}

function groupTransactions(transactions: TransactionWithRelations[]): TransactionGroup[] {
  const groups: TransactionGroup[] = []
  const byLabel = new Map<string, TransactionGroup>()
  for (const transaction of transactions) {
    const key = groupLabel(transaction.date)
    let group = byLabel.get(key)
    if (!group) {
      group = { label: groupLabel(transaction.date), items: [] }
      byLabel.set(key, group)
      groups.push(group)
    }
    group.items.push(transaction)
  }
  return groups
}

export default function RecentTransactionsList({ transactions, currency, onEditTransaction }: Props) {
  const navigate = useNavigate()
  const groups = groupTransactions(transactions)

  const handleTransaction = (transaction: TransactionWithRelations) => {
    if (transaction.type === 'transfer') {
      navigate('/transactions')
      return
    }
    onEditTransaction(transaction.id)
  }

  if (transactions.length === 0) {
    return (
      <section className="db-card db-detail-transactions" aria-label="Giao dịch gần đây">
      <div className="db-card-head"><div><h2 className="db-card-title">Giao dịch gần đây</h2><p className="db-card-sub">{transactions.length} giao dịch mới nhất</p></div><button type="button" className="db-link" onClick={() => navigate('/transactions')}>Xem tất cả →</button></div>
        <div className="db-empty">Chưa có giao dịch. <button type="button" className="db-link" onClick={() => navigate('/transactions')}>Thêm giao dịch đầu tiên →</button></div>
      </section>
    )
  }

  return (
    <section className="db-card db-detail-transactions" aria-label="Giao dịch gần đây">
      <div className="db-card-head"><div><h2 className="db-card-title">Giao dịch gần đây</h2><p className="db-card-sub">{transactions.length} giao dịch mới nhất</p></div><button type="button" className="db-link" onClick={() => navigate('/transactions')}>Xem tất cả <span aria-hidden="true">→</span></button></div>
      <div className="db-detail-transaction-list">
        {groups.map((group, groupIndex) => (
          <div key={`${group.label}-${groupIndex}`} className="db-detail-transaction-group">
            <h3 className="db-detail-transaction-date">{group.label}</h3>
            {group.items.map((transaction) => {
              const isIncome = transaction.type === 'income'
              const isTransfer = transaction.type === 'transfer'
              const amountPrefix = isIncome ? '+' : isTransfer ? '' : '−'
              const amountClass = isIncome ? 'db-detail-positive' : isTransfer ? '' : 'db-detail-expense'
              return (
                <button key={transaction.id} type="button" className="db-detail-transaction" onClick={() => handleTransaction(transaction)} aria-label={`${transaction.category?.name ?? 'Giao dịch'}, ${formatCurrency(transaction.amount, currency)}`}>
                  <span className={`db-detail-transaction-icon ${isIncome ? 'is-income' : isTransfer ? 'is-transfer' : 'is-expense'}`} aria-hidden="true">{isTransfer ? '⇄' : <TransactionCategoryIcon icon={transaction.category?.icon ?? (isIncome ? 'briefcase' : 'wallet')} name={transaction.category?.name} size={18} />}</span>
                  <span className="db-detail-transaction-body"><span className="db-detail-transaction-name">{transaction.note || transaction.category?.name || 'Giao dịch'}</span><span className="db-detail-transaction-meta">{transaction.category?.name ?? 'Không phân loại'}{transaction.wallet?.name ? ` · ${transaction.wallet.name}` : ''}</span></span>
                  <span className={`db-detail-transaction-amount ${amountClass}`}>{amountPrefix}{formatCurrency(transaction.amount, currency)}</span>
                </button>
              )
            })}
          </div>
        ))}
      </div>
    </section>
  )
}
