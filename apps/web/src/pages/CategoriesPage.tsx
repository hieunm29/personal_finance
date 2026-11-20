import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { CategoryGroup, CategoryType, CategoryWithGroup, CreateCategoryInput, UpdateCategoryInput } from '@pf/shared'
import {
  useCategories,
  useCategoryUsage,
  useCreateCategory,
  useDeleteCategory,
  useToggleCategoryVisibility,
  useUpdateCategory,
} from '../hooks/useCategories'
import { useCategoryGroups, useDeleteCategoryGroup } from '../hooks/useCategoryGroups'
import { apiClient } from '../services/apiClient'
import TransactionCategoryIcon from '../components/transaction/TransactionCategoryIcon'
import CategoryGroupForm from '../components/category/CategoryGroupForm'
import DeleteCategoryDialog from '../components/category/DeleteCategoryDialog'
import { COLOR_PRESET, ICON_PRESET } from '../components/category/CategoryForm'
import './categories.css'

type TabType = Extract<CategoryType, 'expense' | 'income'>
type EditorMode = 'edit' | 'create'

const ICON_CATEGORIES = [
  { id: 'all', label: 'Tất cả', icons: ICON_PRESET },
  { id: 'food', label: 'Ăn uống', icons: ['utensils', 'coffee', 'gift'] },
  { id: 'travel', label: 'Đi lại', icons: ['car', 'plane', 'dumbbell'] },
  { id: 'home', label: 'Nhà cửa', icons: ['house', 'home', 'zap', 'shield'] },
  { id: 'finance', label: 'Tài chính', icons: ['wallet', 'landmark', 'trending-up', 'chart-line'] },
]

function addAlpha(color: string | null | undefined, alpha = '1a') {
  return color && /^#[0-9a-f]{6}$/i.test(color) ? `${color}${alpha}` : '#eef2ff'
}

function groupByGroup(groups: CategoryGroup[], categories: CategoryWithGroup[]) {
  const map = new Map<string, { group: CategoryGroup; categories: CategoryWithGroup[] }>()
  for (const group of groups) map.set(group.id, { group, categories: [] })
  for (const category of categories) {
    if (!category.group) continue
    if (!map.has(category.group.id)) map.set(category.group.id, { group: category.group, categories: [] })
    map.get(category.group.id)!.categories.push(category)
  }
  return [...map.values()].sort((a, b) => a.group.sortOrder - b.group.sortOrder)
}

function IconButton({ label, children, onClick, disabled = false }: { label: string; children: ReactNode; onClick: (event: React.MouseEvent<HTMLButtonElement>) => void; disabled?: boolean }) {
  return <button type="button" className="cat-icon-button" aria-label={label} title={label} onClick={onClick} disabled={disabled}>{children}</button>
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return <div className="cat-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
    <div className="cat-modal" role="dialog" aria-modal="true" aria-label={title}>
      <div className="cat-modal-head"><h2>{title}</h2><IconButton label="Đóng" onClick={() => onClose()}>×</IconButton></div>
      <div className="cat-modal-body">{children}</div>
    </div>
  </div>
}

interface EditorProps {
  mode: EditorMode
  category: CategoryWithGroup | null
  type: TabType
  defaultGroupId?: string
  groups: CategoryGroup[]
  onClose: () => void
  onSaved: (category?: CategoryWithGroup) => void
  onDelete: (category: CategoryWithGroup) => void
}

function CategoryEditor({ mode, category, type, defaultGroupId, groups, onClose, onSaved, onDelete }: EditorProps) {
  const createMutation = useCreateCategory()
  const updateMutation = useUpdateCategory(category?.id ?? '')
  const toggleVisibility = useToggleCategoryVisibility()
  const { data: usageData } = useCategoryUsage(category?.id ?? null)
  const [name, setName] = useState('')
  const [color, setColor] = useState(COLOR_PRESET[0])
  const [icon, setIcon] = useState(ICON_PRESET[0])
  const [groupId, setGroupId] = useState(defaultGroupId ?? groups[0]?.id ?? '')
  const [iconSearch, setIconSearch] = useState('')
  const [iconCategory, setIconCategory] = useState('all')
  const isPending = createMutation.isPending || updateMutation.isPending
  const selectedGroup = groups.find((group) => group.id === (mode === 'edit' ? category?.groupId : groupId))
  const selectedVisible = category?.isVisible ?? true

  useEffect(() => {
    setName(category?.name ?? '')
    setColor(category?.color ?? COLOR_PRESET[0])
    setIcon(category?.icon ?? ICON_PRESET[0])
    setGroupId(category?.groupId ?? defaultGroupId ?? groups[0]?.id ?? '')
    setIconSearch('')
    setIconCategory('all')
  }, [category, defaultGroupId, groups])

  const iconOptions = useMemo(() => {
    const categoryIcons = ICON_CATEGORIES.find((item) => item.id === iconCategory)?.icons ?? ICON_PRESET
    const query = iconSearch.trim().toLowerCase()
    return categoryIcons.filter((item) => item.toLowerCase().includes(query))
  }, [iconCategory, iconSearch])

  const save = async () => {
    if (!name.trim() || (mode === 'create' && !groupId)) return
    try {
      if (mode === 'create') {
        const created = await createMutation.mutateAsync({ name: name.trim(), type, groupId, icon, color, sortOrder: 0 } satisfies CreateCategoryInput)
        onSaved(created.data)
      } else if (category) {
        const updated = await updateMutation.mutateAsync({ name: name.trim(), icon, color } satisfies UpdateCategoryInput)
        onSaved(updated.data)
      }
    } catch {
      // React Query exposes the server error in the editor; keep the draft open.
    }
  }

  const mutationError = createMutation.error ?? updateMutation.error

  return <div className="cat-editor-inner">
    <div className="cat-editor-head"><h2>{mode === 'create' ? 'Thêm danh mục' : 'Sửa danh mục'}</h2><IconButton label="Đóng" onClick={() => onClose()}>×</IconButton></div>
    <div className="cat-editor-body">
      <div className="cat-preview" style={{ background: `linear-gradient(135deg, ${addAlpha(color, '16')}, #fff7ed)`, borderColor: addAlpha(color, '55') }}>
        <div className="cat-preview-icon" style={{ backgroundColor: color }}><TransactionCategoryIcon icon={icon} name={name} size={26} color="#fff" /></div>
        <div><strong>{name || 'Tên danh mục'}</strong><span><b className={type}>{type === 'expense' ? 'Chi tiêu' : 'Thu nhập'}</b><i>→</i>{selectedGroup?.name ?? 'Chọn nhóm'}</span></div>
      </div>

      <label className="cat-field"><span>Tên danh mục <small>{name.length} / 30</small></span><input value={name} maxLength={30} onChange={(event) => setName(event.target.value)} placeholder="Ví dụ: Điện thoại" autoFocus={mode === 'create'} /></label>
      <div className="cat-locked-grid"><div><span>⌕ Loại</span><b>{type === 'expense' ? 'Chi tiêu' : 'Thu nhập'}</b></div><label><span>⌕ Nhóm</span>{mode === 'create' ? <select value={groupId} onChange={(event) => setGroupId(event.target.value)}>{groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}</select> : <b>{selectedGroup?.name ?? '—'}</b>}</label></div>
      <div className="cat-field"><span>Màu sắc</span><div className="cat-swatches">{COLOR_PRESET.map((preset) => <button type="button" key={preset} className={color === preset ? 'on' : ''} style={{ backgroundColor: preset }} aria-label={`Chọn màu ${preset}`} onClick={() => setColor(preset)}>{color === preset && '✓'}</button>)}</div></div>
      <div className="cat-field"><span>Biểu tượng <small>Đã chọn: {icon}</small></span><div className="cat-icon-search"><span aria-hidden="true">⌕</span><input value={iconSearch} onChange={(event) => setIconSearch(event.target.value)} placeholder="Tìm biểu tượng (vd: xe, cafe...)" /></div><div className="cat-icon-cats">{ICON_CATEGORIES.map((item) => <button type="button" key={item.id} className={iconCategory === item.id ? 'on' : ''} onClick={() => setIconCategory(item.id)}>{item.label}</button>)}</div><div className="cat-icon-grid">{iconOptions.map((option) => <button type="button" key={option} className={icon === option ? 'on' : ''} onClick={() => setIcon(option)} aria-label={`Chọn biểu tượng ${option}`}><TransactionCategoryIcon icon={option} size={20} /></button>)}</div></div>
      {mode === 'edit' && category && <div className="cat-visibility"><TransactionCategoryIcon icon="eye" size={18} color="#4f46e5" /><div><b>Hiển thị khi tạo giao dịch</b><span>{selectedVisible ? 'Tắt để ẩn khỏi danh sách chọn, giao dịch cũ vẫn giữ nguyên' : 'Đang ẩn khỏi danh sách chọn'}</span></div><button type="button" className={`cat-switch ${selectedVisible ? 'on' : ''}`} role="switch" aria-checked={selectedVisible} onClick={() => toggleVisibility.mutate(category.id)}><span /></button></div>}
      {mode === 'edit' && category && <div className="cat-usage"><span aria-hidden="true">ⓘ</span><span>Đang dùng trong <b>{usageData?.data.transactionCount ?? 0} giao dịch</b>. Thay đổi tên, màu và biểu tượng sẽ áp dụng cho tất cả.</span></div>}
      {mutationError && <p className="cat-error">{mutationError.message}</p>}
    </div>
    <div className="cat-editor-foot"><button type="button" className="cat-button danger ghost" onClick={() => category && onDelete(category)} disabled={isPending || mode === 'create' || category?.isDefault}>Xóa</button><span /><button type="button" className="cat-button ghost" onClick={() => onClose()} disabled={isPending}>Hủy</button><button type="button" className="cat-button primary" onClick={() => void save()} disabled={isPending || !name.trim() || (mode === 'create' && !groupId)}>{isPending ? 'Đang lưu...' : mode === 'create' ? 'Thêm danh mục' : 'Lưu thay đổi'}</button></div>
  </div>
}

function CategoryTile({ category, selected, onSelect, onToggle, onEdit, onDelete }: { category: CategoryWithGroup; selected: boolean; onSelect: () => void; onToggle: () => void; onEdit: () => void; onDelete: () => void }) {
  return <div className={`cat-tile ${selected ? 'selected' : ''} ${category.isVisible ? '' : 'hidden'}`} role="group" onClick={onSelect}>
    <div className="cat-tile-icon" style={{ color: category.color ?? '#64748b', backgroundColor: addAlpha(category.color) }}><TransactionCategoryIcon icon={category.icon} name={category.name} size={20} /></div><div className="cat-tile-copy"><b>{category.name}</b>{!category.isVisible && <span className="cat-pill">ĐÃ ẨN</span>} {!category.isDefault && <span className="cat-pill custom">TÙY CHỈNH</span>}<small>{!category.isVisible ? 'Không hiện khi tạo giao dịch' : ' '}</small></div><div className="cat-tile-actions"><IconButton label={category.isVisible ? 'Ẩn danh mục' : 'Hiện danh mục'} onClick={(event) => { event.stopPropagation(); onToggle() }}>{category.isVisible ? '◌' : '◉'}</IconButton><IconButton label="Sửa danh mục" onClick={(event) => { event.stopPropagation(); onEdit() }}>✎</IconButton>{!category.isDefault && <IconButton label="Xóa danh mục" onClick={(event) => { event.stopPropagation(); onDelete() }}>⌫</IconButton>}</div>
  </div>
}

export default function CategoriesPage() {
  const [activeTab, setActiveTab] = useState<TabType>('expense')
  const [search, setSearch] = useState('')
  const [showHidden, setShowHidden] = useState(true)
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [selected, setSelected] = useState<CategoryWithGroup | null>(null)
  const [editorMode, setEditorMode] = useState<EditorMode>('edit')
  const [createGroupId, setCreateGroupId] = useState<string | undefined>()
  const [mobileEditorOpen, setMobileEditorOpen] = useState(false)
  const [createGroupOpen, setCreateGroupOpen] = useState(false)
  const [editGroup, setEditGroup] = useState<CategoryGroup | null>(null)
  const [deleteCategory, setDeleteCategory] = useState<CategoryWithGroup | null>(null)
  const [deleteCount, setDeleteCount] = useState(0)
  const [error, setError] = useState('')
  const editorDialogRef = useRef<HTMLDialogElement>(null)

  const categoriesQuery = useCategories(undefined, true)
  const groupsQuery = useCategoryGroups(activeTab)
  const toggleVisibility = useToggleCategoryVisibility()
  const deleteCategoryMutation = useDeleteCategory()
  const deleteGroupMutation = useDeleteCategoryGroup()
  const categories = categoriesQuery.data?.data ?? []
  const groups = groupsQuery.data?.data ?? []
  const filteredCategories = categories.filter((category) => category.type === activeTab && (showHidden || category.isVisible) && (!search.trim() || `${category.name} ${category.group?.name ?? ''}`.toLowerCase().includes(search.trim().toLowerCase())))
  const grouped = useMemo(() => groupByGroup(groups, filteredCategories), [groups, filteredCategories])
  const expenseCount = categories.filter((category) => category.type === 'expense').length
  const incomeCount = categories.filter((category) => category.type === 'income').length

  useEffect(() => {
    const current = selected && categories.find((category) => category.id === selected.id && category.type === activeTab)
    if (current) setSelected(current)
    else setSelected(categories.find((category) => category.type === activeTab && category.isVisible) ?? null)
  }, [activeTab, categories, selected])

  useEffect(() => {
    if (!mobileEditorOpen) { editorDialogRef.current?.close(); return }
    const dialog = editorDialogRef.current
    if (dialog && !dialog.open) dialog.showModal()
    return () => { if (dialog?.open) dialog.close() }
  }, [mobileEditorOpen])

  const openCategory = (category: CategoryWithGroup) => { setSelected(category); setEditorMode('edit'); setMobileEditorOpen(true) }
  const openCreate = (groupId?: string) => { setSelected(null); setEditorMode('create'); setCreateGroupId(groupId ?? groups[0]?.id); setMobileEditorOpen(true) }

  const openDelete = async (category: CategoryWithGroup) => {
    try {
      const response = await apiClient<{ meta?: { total?: number } }>(`/transactions?categoryId=${category.id}&limit=1`)
      setDeleteCount(response.meta?.total ?? 0)
      setDeleteCategory(category)
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Không thể kiểm tra giao dịch') }
  }

  const confirmDelete = async (replacementCategoryId?: string) => {
    if (!deleteCategory) return
    await deleteCategoryMutation.mutateAsync({ id: deleteCategory.id, replacementCategoryId })
    setDeleteCategory(null); setSelected(null); setMobileEditorOpen(false)
  }

  const handleDeleteGroup = async (group: CategoryGroup) => {
    if (group.isDefault || !window.confirm(`Xóa nhóm "${group.name}"?`)) return
    try { await deleteGroupMutation.mutateAsync(group.id) } catch (cause) { setError(cause instanceof Error ? cause.message : 'Không thể xóa nhóm') }
  }

  if (categoriesQuery.isLoading || groupsQuery.isLoading) return <div className="cat-page"><div className="cat-topbar"><div><h1>Danh mục</h1><p>Đang tải danh mục...</p></div></div><div className="cat-loading">{[1, 2, 3].map((item) => <div key={item} />)}</div></div>

  return <div className="cat-page">
    <header className="cat-topbar"><div><h1>Danh mục</h1><p>Sắp xếp các khoản thu chi theo nhóm để theo dõi dễ hơn</p></div><div className="cat-top-actions"><button type="button" className="cat-button" onClick={() => setCreateGroupOpen(true)}>⊞ <span>Nhóm mới</span></button><button type="button" className="cat-button primary" onClick={() => openCreate()}>＋ <span>Danh mục mới</span></button></div></header>
    <main className="cat-content">
      <div className="cat-toolbar"><div className="cat-tabs"><button type="button" className={activeTab === 'expense' ? 'on expense' : ''} onClick={() => setActiveTab('expense')}>↑ <span>Chi tiêu</span><b>{expenseCount}</b></button><button type="button" className={activeTab === 'income' ? 'on income' : ''} onClick={() => setActiveTab('income')}>↓ <span>Thu nhập</span><b>{incomeCount}</b></button></div><label className="cat-search"><span aria-hidden="true">⌕</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm danh mục..." /></label><label className="cat-hidden-toggle"><button type="button" className={`cat-switch ${showHidden ? 'on' : ''}`} role="switch" aria-checked={showHidden} onClick={() => setShowHidden((value) => !value)}><span /></button><span>Hiện mục đã ẩn ({categories.filter((category) => category.type === activeTab && !category.isVisible).length})</span></label></div>
      {error && <div className="cat-alert" role="alert">{error}<button type="button" onClick={() => setError('')}>×</button></div>}
      <div className="cat-split"><section className="cat-groups">{grouped.map(({ group, categories: groupCategories }) => { const hiddenCount = categories.filter((category) => category.type === activeTab && category.groupId === group.id && !category.isVisible).length; const groupTotal = categories.filter((category) => category.type === activeTab && category.groupId === group.id).length; const isCollapsed = collapsed.has(group.id); return <article className={`cat-group-card ${isCollapsed ? 'collapsed' : ''}`} key={group.id}><div className="cat-group-head"><div className="cat-group-icon" style={{ backgroundColor: group.color ?? '#64748b' }}><TransactionCategoryIcon icon={group.type === 'expense' ? 'shield' : 'briefcase'} size={18} color="#fff" /></div><div><h2>{group.name}</h2><p>{groupTotal} danh mục{hiddenCount > 0 ? ` · ${hiddenCount} đang ẩn` : ''}</p></div><span /><IconButton label="Sửa nhóm" onClick={(event) => { event.stopPropagation(); group.isDefault ? setCollapsed((current) => { const next = new Set(current); next.has(group.id) ? next.delete(group.id) : next.add(group.id); return next }) : setEditGroup(group) }}>•••</IconButton><IconButton label={isCollapsed ? 'Mở nhóm' : 'Thu gọn nhóm'} onClick={(event) => { event.stopPropagation(); setCollapsed((current) => { const next = new Set(current); next.has(group.id) ? next.delete(group.id) : next.add(group.id); return next }) }}>{isCollapsed ? '›' : '⌄'}</IconButton></div>{!isCollapsed && <div className="cat-tiles">{groupCategories.map((category) => <CategoryTile key={category.id} category={category} selected={selected?.id === category.id && editorMode === 'edit'} onSelect={() => openCategory(category)} onToggle={() => toggleVisibility.mutate(category.id)} onEdit={() => openCategory(category)} onDelete={() => void openDelete(category)} />)}<button type="button" className="cat-tile add" onClick={() => openCreate(group.id)}>＋ <span>Thêm vào {group.name}</span></button></div>}</article> })}<button type="button" className="cat-new-group" onClick={() => setCreateGroupOpen(true)}>⊞ <span>Tạo nhóm chi tiêu mới</span></button></section><aside className="cat-editor-desktop"><CategoryEditor mode={editorMode} category={selected} type={activeTab} defaultGroupId={createGroupId} groups={groups} onClose={() => setMobileEditorOpen(false)} onSaved={(category) => { if (category) setSelected(category); setEditorMode('edit'); setMobileEditorOpen(false) }} onDelete={(category) => void openDelete(category)} /></aside></div>
    </main>

    {mobileEditorOpen && <dialog ref={editorDialogRef} className="cat-editor-dialog" onCancel={(event) => { event.preventDefault(); setMobileEditorOpen(false) }} onClose={() => setMobileEditorOpen(false)}><CategoryEditor mode={editorMode} category={selected} type={activeTab} defaultGroupId={createGroupId} groups={groups} onClose={() => setMobileEditorOpen(false)} onSaved={(category) => { if (category) setSelected(category); setEditorMode('edit'); setMobileEditorOpen(false) }} onDelete={(category) => void openDelete(category)} /></dialog>}
    {createGroupOpen && <Modal title="Tạo nhóm mới" onClose={() => setCreateGroupOpen(false)}><CategoryGroupForm mode="create" defaultType={activeTab} onClose={() => setCreateGroupOpen(false)} /></Modal>}
    {editGroup && <Modal title="Sửa nhóm" onClose={() => setEditGroup(null)}><CategoryGroupForm mode="edit" defaultValues={editGroup} onClose={() => setEditGroup(null)} /><button type="button" className="cat-modal-delete" disabled={deleteGroupMutation.isPending} onClick={() => { void handleDeleteGroup(editGroup); setEditGroup(null) }}>Xóa nhóm</button></Modal>}
    {deleteCategory && <Modal title="Xóa danh mục" onClose={() => setDeleteCategory(null)}><DeleteCategoryDialog category={deleteCategory} transactionCount={deleteCount} allCategories={categories} onConfirm={confirmDelete} onCancel={() => setDeleteCategory(null)} isPending={deleteCategoryMutation.isPending} /></Modal>}
  </div>
}
