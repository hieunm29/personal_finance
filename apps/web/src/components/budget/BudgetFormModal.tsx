import { useEffect, useRef, useState } from 'react'
import { useCategories } from '../../hooks/useCategories'
import { useBudget, useUpsertBudget, useUpdateBudget } from '../../hooks/useBudget'
import { formatCurrency } from '../../utils/format'
import { getPreviousMonth } from '../../utils/date'

interface Props {
  isOpen: boolean
  onClose: () => void
  month: string
  existingBudget?: { id: string; totalLimit: number; categoryBudgets: Array<{ categoryId: string; limitAmount: number }> } | null
  currency?: string
}

const labelStyle: React.CSSProperties = { fontSize: '13px', fontWeight: 600, color: '#374151', display: 'block', marginBottom: '4px' }
const inputStyle: React.CSSProperties = { width: '100%', padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }
const primaryBtnStyle: React.CSSProperties = { padding: '8px 20px', background: '#4f46e5', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }
const cancelBtnStyle: React.CSSProperties = { padding: '8px 20px', background: '#fff', color: '#374151', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '14px', cursor: 'pointer' }

export default function BudgetFormModal({ isOpen, onClose, month, existingBudget, currency = 'VND' }: Props) {
  const [totalLimitInput, setTotalLimitInput] = useState<string>('')
  const [categoryInputs, setCategoryInputs] = useState<Record<string, string>>({})
  const [copyFromPrev, setCopyFromPrev] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const previousMonth = getPreviousMonth(month)
  const { data: prevBudgetRes, isLoading: isPrevLoading } = useBudget(previousMonth)
  const prevBudget = prevBudgetRes?.data ?? null

  const { data: categoriesRes } = useCategories('expense')
  const categories = categoriesRes?.data ?? []

  const upsertMutation = useUpsertBudget()
  const updateMutation = useUpdateBudget()
  const isPending = upsertMutation.isPending || updateMutation.isPending

  // Chỉ pre-fill khi modal mở lần đầu (isOpen false → true), tránh reset form khi query refetch
  const prevIsOpenRef = useRef(false)
  useEffect(() => {
    if (isOpen && !prevIsOpenRef.current) {
      setCopyFromPrev(false)
      setErrorMsg(null)
      if (existingBudget) {
        setTotalLimitInput(String(existingBudget.totalLimit / 100))
        const inputs: Record<string, string> = {}
        for (const cb of existingBudget.categoryBudgets) {
          inputs[cb.categoryId] = String(cb.limitAmount / 100)
        }
        setCategoryInputs(inputs)
      } else {
        setTotalLimitInput('')
        setCategoryInputs({})
      }
    }
    prevIsOpenRef.current = isOpen
  }, [isOpen, existingBudget])

  const totalLimit = parseFloat(totalLimitInput) || 0
  const totalCategoryLimit = Object.values(categoryInputs).reduce((sum, v) => sum + (parseFloat(v) || 0), 0)
  const warningText = totalCategoryLimit > totalLimit && totalLimit > 0
    ? `Tổng ngân sách danh mục (${formatCurrency(totalCategoryLimit * 100, currency)}) vượt ngân sách tổng (${formatCurrency(totalLimit * 100, currency)})`
    : null

  const isValidTotal = Number.isFinite(parseFloat(totalLimitInput)) && parseFloat(totalLimitInput) > 0

  // Khi user tự sửa field thì bỏ trạng thái "sao chép"
  function handleTotalChange(v: string) {
    setTotalLimitInput(v)
    if (copyFromPrev) setCopyFromPrev(false)
  }

  function handleCategoryChange(catId: string, v: string) {
    setCategoryInputs((prev) => ({ ...prev, [catId]: v }))
    if (copyFromPrev) setCopyFromPrev(false)
  }

  function handleSubmit() {
    if (!isValidTotal) return
    setErrorMsg(null)
    const totalLimitCents = Math.round(parseFloat(totalLimitInput) * 100)
    const cats = Object.entries(categoryInputs)
      .filter(([, v]) => v && parseFloat(v) > 0)
      .map(([categoryId, v]) => ({ categoryId, limitAmount: Math.round(parseFloat(v) * 100) }))

    const onError = (err: Error) => setErrorMsg(err.message || 'Có lỗi xảy ra, vui lòng thử lại')

    if (existingBudget) {
      updateMutation.mutate(
        { id: existingBudget.id, data: { totalLimit: totalLimitCents, categories: cats } },
        { onSuccess: onClose, onError }
      )
    } else {
      upsertMutation.mutate(
        { month, totalLimit: totalLimitCents, categories: cats },
        { onSuccess: onClose, onError }
      )
    }
  }

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        style={{ background: '#fff', borderRadius: '12px', width: '100%', maxWidth: '480px', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>
            {existingBudget ? 'Sửa ngân sách' : 'Tạo ngân sách'}
          </h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer' }}>×</button>
        </div>

        <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1 }}>
          <div style={{ marginBottom: '16px' }}>
            <label style={labelStyle}>Tháng</label>
            <input value={month} disabled style={{ ...inputStyle, background: '#f8fafc', color: '#94a3b8' }} />
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={labelStyle}>Ngân sách tổng (đ) *</label>
            <input
              type="number"
              min="0"
              step="1000"
              value={totalLimitInput}
              onChange={(e) => handleTotalChange(e.target.value)}
              placeholder="Ví dụ: 5000000"
              style={inputStyle}
            />
          </div>

          <div style={{ marginBottom: '16px', padding: '12px', background: '#f8fafc', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <input
              type="checkbox"
              id="copyFromPrev"
              checked={copyFromPrev}
              disabled={isPrevLoading || !prevBudget}
              onChange={(e) => {
                const checked = e.target.checked
                setCopyFromPrev(checked)
                if (checked && prevBudget) {
                  setTotalLimitInput(String(prevBudget.totalLimit / 100))
                  const inputs: Record<string, string> = {}
                  for (const cb of prevBudget.categoryBudgets) {
                    inputs[cb.categoryId] = String(cb.limitAmount / 100)
                  }
                  setCategoryInputs(inputs)
                } else {
                  if (existingBudget) {
                    setTotalLimitInput(String(existingBudget.totalLimit / 100))
                    const inputs: Record<string, string> = {}
                    for (const cb of existingBudget.categoryBudgets) {
                      inputs[cb.categoryId] = String(cb.limitAmount / 100)
                    }
                    setCategoryInputs(inputs)
                  } else {
                    setTotalLimitInput('')
                    setCategoryInputs({})
                  }
                }
              }}
            />
            <label htmlFor="copyFromPrev" style={{ fontSize: '14px', color: (!isPrevLoading && prevBudget) ? '#0f172a' : '#94a3b8', cursor: (!isPrevLoading && prevBudget) ? 'pointer' : 'not-allowed' }}>
              {isPrevLoading ? 'Đang tải...' : 'Sao chép từ tháng trước'}
              {!isPrevLoading && !prevBudget && <span style={{ fontSize: '12px', color: '#94a3b8', marginLeft: '6px' }}>(Tháng trước chưa có ngân sách)</span>}
            </label>
          </div>

          <div>
            <label style={{ ...labelStyle, display: 'block', marginBottom: '8px' }}>Ngân sách theo danh mục (tùy chọn)</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {categories.map((cat) => (
                <div key={cat.id} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ width: '140px', fontSize: '14px', color: '#0f172a', flexShrink: 0 }}>
                    {cat.icon ? `${cat.icon} ` : ''}{cat.name}
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="1000"
                    value={categoryInputs[cat.id] ?? ''}
                    onChange={(e) => handleCategoryChange(cat.id, e.target.value)}
                    placeholder="Không giới hạn"
                    style={{ ...inputStyle, flex: 1, padding: '6px 10px' }}
                  />
                </div>
              ))}
            </div>

            {warningText && (
              <p style={{ marginTop: '8px', fontSize: '13px', color: '#f59e0b' }}>⚠ {warningText}</p>
            )}
          </div>
        </div>

        {errorMsg && (
          <div style={{ padding: '8px 24px', background: '#fef2f2', borderTop: '1px solid #fecaca' }}>
            <p style={{ margin: 0, fontSize: '13px', color: '#dc2626' }}>⚠ {errorMsg}</p>
          </div>
        )}

        <div style={{ padding: '16px 24px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
          <button onClick={onClose} style={cancelBtnStyle}>Hủy</button>
          <button onClick={handleSubmit} disabled={!isValidTotal || isPending} style={primaryBtnStyle}>
            {isPending ? 'Đang lưu...' : 'Lưu'}
          </button>
        </div>
      </div>
    </div>
  )
}
