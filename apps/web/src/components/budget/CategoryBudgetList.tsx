import { type CategoryBudgetWithProgress } from '@pf/shared'
import { formatCurrency } from '../../utils/format'

interface Props {
  categories: CategoryBudgetWithProgress[]
  currency?: string
  onEdit?: () => void
}

export default function CategoryBudgetList({ categories, currency = 'VND', onEdit }: Props) {
  if (categories.length === 0) {
    return (
      <div>
        <p style={{ color: '#94a3b8', fontSize: '14px' }}>Chưa đặt ngân sách theo danh mục</p>
        {onEdit && (
          <button
            onClick={onEdit}
            style={{ marginTop: '12px', fontSize: '13px', color: '#4f46e5', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
          >
            + Đặt ngân sách theo danh mục
          </button>
        )}
      </div>
    )
  }

  return (
    <div>
      {categories.map((cat) => (
        <div key={cat.categoryId} style={{ marginBottom: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
            <span style={{ fontSize: '14px', color: '#0f172a' }}>
              {cat.category.name}
            </span>
            <div style={{ fontSize: '14px' }}>
              <span style={{ color: cat.percentage >= 100 ? '#dc2626' : '#0f172a', fontWeight: 600 }}>
                {formatCurrency(cat.spent, currency)}
              </span>
              <span style={{ color: '#94a3b8' }}> / {formatCurrency(cat.limitAmount, currency)}</span>
            </div>
          </div>

          <div style={{ background: '#e2e8f0', borderRadius: '9999px', height: '8px', overflow: 'hidden' }}>
            <div style={{
              height: '100%',
              borderRadius: '9999px',
              transition: 'all 0.3s',
              width: `${Math.min(cat.percentage, 100)}%`,
              background: cat.percentage >= 100 ? '#dc2626' : cat.percentage >= 80 ? '#f59e0b' : '#16a34a',
            }} />
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '3px', fontSize: '12px', color: '#94a3b8' }}>
            <span>Còn lại: {formatCurrency(Math.max(0, cat.remaining), currency)}</span>
            <span>{cat.percentage}%</span>
          </div>
        </div>
      ))}

      {onEdit && (
        <button
          onClick={onEdit}
          style={{ marginTop: '12px', fontSize: '13px', color: '#4f46e5', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
        >
          + Đặt ngân sách theo danh mục
        </button>
      )}
    </div>
  )
}
