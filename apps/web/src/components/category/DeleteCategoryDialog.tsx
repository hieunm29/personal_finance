import { useState } from 'react'
import type { CategoryWithGroup } from '@pf/shared'

interface Props {
  category: CategoryWithGroup
  transactionCount: number
  allCategories: CategoryWithGroup[]
  onConfirm: (replacementCategoryId?: string) => void
  onCancel: () => void
  isPending: boolean
}

export default function DeleteCategoryDialog({
  category,
  transactionCount,
  allCategories,
  onConfirm,
  onCancel,
  isPending,
}: Props) {
  const [replacementId, setReplacementId] = useState('')

  // Danh sách thay thế: cùng type, khác category đang xóa, chỉ visible
  const replacementOptions = allCategories.filter(
    (c) => c.id !== category.id && c.type === category.type && c.isVisible,
  )

  const canConfirm = transactionCount === 0 || replacementId !== ''

  return (
    <div className="space-y-4">
      {transactionCount === 0 ? (
        <p className="text-sm text-gray-700">
          Bạn có chắc muốn xóa danh mục <strong>"{category.name}"</strong>?
          Hành động này không thể hoàn tác.
        </p>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-gray-700">
            Danh mục <strong>"{category.name}"</strong> có{' '}
            <strong className="text-orange-600">{transactionCount} giao dịch</strong>.
            Vui lòng chọn danh mục thay thế trước khi xóa:
          </p>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Danh mục thay thế <span className="text-red-500">*</span>
            </label>
            <select
              value={replacementId}
              onChange={(e) => setReplacementId(e.target.value)}
              className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            >
              <option value="">-- Chọn danh mục --</option>
              {replacementOptions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.group?.name ? `${c.group.name} / ` : ''}{c.name}
                </option>
              ))}
            </select>
            {replacementOptions.length === 0 && (
              <p className="mt-1 text-xs text-red-600">
                Không có danh mục thay thế khả dụng. Hãy tạo danh mục khác trước.
              </p>
            )}
          </div>
        </div>
      )}

      <div className="flex justify-end gap-3">
        <button
          type="button"
          onClick={onCancel}
          disabled={isPending}
          className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          Hủy
        </button>
        <button
          type="button"
          onClick={() => onConfirm(replacementId || undefined)}
          disabled={isPending || !canConfirm}
          className="rounded-md bg-red-500 px-4 py-2 text-sm font-medium text-white hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isPending ? 'Đang xóa...' : 'Xóa'}
        </button>
      </div>
    </div>
  )
}
