import { useState, useMemo } from 'react'
import { useCategories, useToggleCategoryVisibility, useDeleteCategory } from '../hooks/useCategories'
import { useCategoryGroups } from '../hooks/useCategoryGroups'
import CategoryForm from '../components/category/CategoryForm'
import CategoryGroupForm from '../components/category/CategoryGroupForm'
import DeleteCategoryDialog from '../components/category/DeleteCategoryDialog'
import { apiClient } from '../services/apiClient'
import type { CategoryWithGroup, CategoryGroup, CategoryType } from '@pf/shared'

type TabType = 'expense' | 'income'

interface GroupedCategories {
  group: CategoryGroup
  categories: CategoryWithGroup[]
}

function groupByGroup(groups: CategoryGroup[], cats: CategoryWithGroup[]): GroupedCategories[] {
  const map = new Map<string, GroupedCategories>()
  // Seed all groups (including empty ones)
  for (const g of groups) map.set(g.id, { group: g, categories: [] })
  // Fill categories
  for (const cat of cats) {
    if (!cat.group) continue
    if (!map.has(cat.group.id)) map.set(cat.group.id, { group: cat.group, categories: [] })
    map.get(cat.group.id)!.categories.push(cat)
  }
  return Array.from(map.values()).sort((a, b) => a.group.sortOrder - b.group.sortOrder)
}

// ─── Simple Modal wrapper ─────────────────────────────────────
function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <h2 className="text-base font-semibold text-gray-900">{title}</h2>
          <button onClick={onClose} className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600">✕</button>
        </div>
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  )
}

// ─── Modal state types ────────────────────────────────────────
type CreateCatModal = { groupId: string; type: CategoryType }
type EditCatModal = { cat: CategoryWithGroup }
type DeleteCatModal = { cat: CategoryWithGroup; transactionCount: number }
type EditGroupModal = { group: CategoryGroup }

export default function CategoriesPage() {
  const [activeTab, setActiveTab] = useState<TabType>('expense')

  // Modal state
  const [createCat, setCreateCat] = useState<CreateCatModal | null>(null)
  const [editCat, setEditCat] = useState<EditCatModal | null>(null)
  const [deleteCat, setDeleteCat] = useState<DeleteCatModal | null>(null)
  const [showCreateGroup, setShowCreateGroup] = useState(false)
  const [editGroup, setEditGroup] = useState<EditGroupModal | null>(null)

  const { data, isLoading } = useCategories(undefined, true)
  const { data: groupsData } = useCategoryGroups(activeTab)
  const toggleVisibility = useToggleCategoryVisibility()
  const deleteCategory = useDeleteCategory()

  const categories = data?.data ?? []
  const allGroups = groupsData?.data ?? []

  const grouped = useMemo(() => {
    const filtered = categories.filter((c) => c.type === activeTab)
    return groupByGroup(allGroups, filtered)
  }, [allGroups, categories, activeTab])

  const expenseCount = categories.filter((c) => c.type === 'expense').length
  const incomeCount = categories.filter((c) => c.type === 'income').length

  // Open delete dialog: fetch transaction count first
  const handleDeleteClick = async (cat: CategoryWithGroup) => {
    const res = await apiClient<{ meta: { total: number } }>(
      `/transactions?categoryId=${cat.id}&limit=1`,
    )
    setDeleteCat({ cat, transactionCount: res.meta.total })
  }

  const handleDeleteConfirm = async (replacementId?: string) => {
    if (!deleteCat) return
    await deleteCategory.mutateAsync({ id: deleteCat.cat.id, replacementCategoryId: replacementId })
    setDeleteCat(null)
  }

  if (isLoading) {
    return (
      <div className="mx-auto max-w-4xl">
        <h1 className="mb-6 text-2xl font-bold text-gray-900">Danh mục</h1>
        <div className="animate-pulse space-y-4">
          {[...Array(4)].map((_, i) => <div key={i} className="h-24 rounded-lg bg-gray-200" />)}
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="mb-6 text-2xl font-bold text-gray-900">Danh mục</h1>

      {/* Tabs */}
      <div className="mb-6 flex gap-1 rounded-lg bg-gray-100 p-1">
        <button onClick={() => setActiveTab('expense')}
          className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors ${activeTab === 'expense' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
        >Chi tiêu ({expenseCount})</button>
        <button onClick={() => setActiveTab('income')}
          className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors ${activeTab === 'income' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
        >Thu nhập ({incomeCount})</button>
      </div>

      {/* Groups */}
      <div className="space-y-4">
        {grouped.map(({ group, categories: groupCats }) => (
          <div key={group.id} className="rounded-lg border border-gray-200 bg-white">
            {/* Group header */}
            <div className="flex items-center gap-3 border-b border-gray-100 px-4 py-3">
              <div className="h-3 w-3 rounded-full" style={{ backgroundColor: group.color ?? '#6b7280' }} />
              <span className="font-semibold text-gray-800">{group.name}</span>
              <span className="text-xs text-gray-400">{groupCats.length} danh mục</span>
              {!group.isDefault && (
                <span className="rounded bg-blue-50 px-1.5 py-0.5 text-xs text-blue-600">Tùy chỉnh</span>
              )}
              <div className="ml-auto flex items-center gap-1">
                {/* Edit group — only non-default */}
                {!group.isDefault && (
                  <button onClick={() => setEditGroup({ group })}
                    className="rounded p-1 text-xs text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                    title="Sửa nhóm"
                  >✏️</button>
                )}
                {/* Add category to this group */}
                <button
                  onClick={() => setCreateCat({ groupId: group.id, type: group.type as CategoryType })}
                  className="rounded px-2 py-1 text-xs text-blue-600 hover:bg-blue-50"
                >+ Thêm</button>
              </div>
            </div>

            {/* Categories */}
            <div className="divide-y divide-gray-50">
              {groupCats.map((cat) => (
                <div key={cat.id}
                  className={`flex items-center gap-3 px-4 py-3 ${!cat.isVisible ? 'opacity-50' : ''}`}
                >
                  {/* Color circle */}
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-medium text-white"
                    style={{ backgroundColor: cat.color ?? '#6b7280' }}
                  >
                    {cat.icon ? cat.icon.charAt(0).toUpperCase() : cat.name.charAt(0)}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-900">{cat.name}</span>
                      {!cat.isVisible && (
                        <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-500">Ẩn</span>
                      )}
                      {cat.isDefault && (
                        <span className="rounded bg-gray-50 px-1.5 py-0.5 text-xs text-gray-400">Mặc định</span>
                      )}
                    </div>
                    {cat.icon && <span className="text-xs text-gray-400">{cat.icon}</span>}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1">
                    {/* Toggle visibility */}
                    <button
                      onClick={() => toggleVisibility.mutate(cat.id)}
                      disabled={toggleVisibility.isPending}
                      title={cat.isVisible ? 'Ẩn danh mục' : 'Hiện danh mục'}
                      className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 disabled:opacity-50"
                    >
                      {cat.isVisible ? '👁' : '🙈'}
                    </button>
                    {/* Edit */}
                    <button
                      onClick={() => setEditCat({ cat })}
                      title="Sửa danh mục"
                      className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                    >✏️</button>
                    {/* Delete — only non-default */}
                    {!cat.isDefault && (
                      <button
                        onClick={() => handleDeleteClick(cat)}
                        title="Xóa danh mục"
                        className="rounded p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500"
                      >🗑</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}

        {grouped.length === 0 && (
          <div className="py-12 text-center text-gray-400">Không có danh mục nào</div>
        )}

        {/* + Tạo nhóm mới */}
        <button
          onClick={() => setShowCreateGroup(true)}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-gray-300 px-4 py-3 text-sm text-gray-500 hover:border-blue-400 hover:text-blue-600"
        >
          + Tạo nhóm mới
        </button>
      </div>

      {/* ── Modals ─────────────────────────────────────────── */}

      {/* Create category */}
      {createCat && (
        <Modal title="Thêm danh mục" onClose={() => setCreateCat(null)}>
          <CategoryForm
            mode="create"
            defaultType={createCat.type}
            defaultGroupId={createCat.groupId}
            onClose={() => setCreateCat(null)}
          />
        </Modal>
      )}

      {/* Edit category */}
      {editCat && (
        <Modal title="Sửa danh mục" onClose={() => setEditCat(null)}>
          <CategoryForm
            mode="edit"
            defaultValues={editCat.cat}
            onClose={() => setEditCat(null)}
          />
        </Modal>
      )}

      {/* Delete category */}
      {deleteCat && (
        <Modal title="Xóa danh mục" onClose={() => setDeleteCat(null)}>
          <DeleteCategoryDialog
            category={deleteCat.cat}
            transactionCount={deleteCat.transactionCount}
            allCategories={categories}
            onConfirm={handleDeleteConfirm}
            onCancel={() => setDeleteCat(null)}
            isPending={deleteCategory.isPending}
          />
        </Modal>
      )}

      {/* Create group */}
      {showCreateGroup && (
        <Modal title="Tạo nhóm mới" onClose={() => setShowCreateGroup(false)}>
          <CategoryGroupForm
            mode="create"
            defaultType={activeTab}
            onClose={() => setShowCreateGroup(false)}
          />
        </Modal>
      )}

      {/* Edit group */}
      {editGroup && (
        <Modal title="Sửa nhóm" onClose={() => setEditGroup(null)}>
          <CategoryGroupForm
            mode="edit"
            defaultValues={editGroup.group}
            onClose={() => setEditGroup(null)}
          />
        </Modal>
      )}
    </div>
  )
}
