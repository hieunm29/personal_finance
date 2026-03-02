import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  createCategorySchema,
  updateCategorySchema,
  type CreateCategoryInput,
  type UpdateCategoryInput,
} from '@pf/shared'
import type { CategoryWithGroup, CategoryType } from '@pf/shared'
import { useCategoryGroups } from '../../hooks/useCategoryGroups'
import { useCreateCategory, useUpdateCategory } from '../../hooks/useCategories'

export const COLOR_PRESET = [
  '#ef4444', '#f97316', '#eab308', '#84cc16', '#22c55e', '#06b6d4',
  '#3b82f6', '#8b5cf6', '#d946ef', '#f43f5e', '#14b8a6', '#f59e0b',
]

export const ICON_PRESET = [
  'utensils', 'car', 'house', 'zap', 'pill', 'shield',
  'shirt', 'book-open', 'sparkles', 'coffee', 'gamepad-2', 'plane',
  'dumbbell', 'gift', 'handshake', 'briefcase', 'laptop', 'home',
  'landmark', 'trending-up', 'wallet', 'ribbon',
]

interface Props {
  mode: 'create' | 'edit'
  defaultValues?: Partial<CategoryWithGroup>
  defaultType?: CategoryType
  defaultGroupId?: string
  onClose: () => void
}

// ─── Shared UI pieces ────────────────────────────────────────
export function ColorPicker({ selectedColor, onSelect }: { selectedColor?: string; onSelect: (c: string) => void }) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-gray-700">Màu sắc</label>
      <div className="flex flex-wrap gap-2">
        {COLOR_PRESET.map((c) => (
          <button key={c} type="button" onClick={() => onSelect(c)}
            className={`h-7 w-7 rounded-full border-2 transition-transform ${selectedColor === c ? 'scale-110 border-gray-700' : 'border-transparent'}`}
            style={{ backgroundColor: c }}
          />
        ))}
      </div>
    </div>
  )
}

export function IconPicker({ selectedIcon, onSelect }: { selectedIcon?: string; onSelect: (i: string) => void }) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-gray-700">Icon</label>
      <div className="flex max-h-28 flex-wrap gap-1 overflow-y-auto rounded-md border border-gray-200 p-2">
        {ICON_PRESET.map((icon) => (
          <button key={icon} type="button" onClick={() => onSelect(icon)}
            className={`rounded px-2 py-1 text-xs border ${selectedIcon === icon ? 'border-blue-500 bg-blue-50 text-blue-700 font-medium' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}
          >
            {icon}
          </button>
        ))}
      </div>
      {selectedIcon && <p className="mt-1 text-xs text-gray-400">Đã chọn: {selectedIcon}</p>}
    </div>
  )
}

// ─── Create Form ──────────────────────────────────────────────
function CreateForm({ defaultType, defaultGroupId, onClose }: {
  defaultType?: CategoryType
  defaultGroupId?: string
  onClose: () => void
}) {
  const createMutation = useCreateCategory()
  const { register, handleSubmit, watch, setValue, formState: { errors } } =
    useForm<CreateCategoryInput>({
      resolver: zodResolver(createCategorySchema),
      defaultValues: {
        name: '',
        type: defaultType ?? 'expense',
        groupId: defaultGroupId ?? '',
        icon: '',
        color: COLOR_PRESET[0],
        sortOrder: 0,
      },
    })

  const selectedType = watch('type')
  const selectedColor = watch('color')
  const selectedIcon = watch('icon')
  const { data: groupsData } = useCategoryGroups(selectedType)
  const groups = groupsData?.data ?? []

  useEffect(() => {
    if (!defaultGroupId) setValue('groupId', '')
  }, [selectedType, defaultGroupId, setValue])

  const onSubmit = async (data: CreateCategoryInput) => {
    await createMutation.mutateAsync(data)
    onClose()
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">Loại</label>
        <div className="flex gap-2">
          {(['expense', 'income'] as const).map((t) => (
            <button key={t} type="button" onClick={() => setValue('type', t)}
              className={`flex-1 rounded-md border px-3 py-2 text-sm font-medium ${selectedType === t ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-300 text-gray-600 hover:bg-gray-50'}`}
            >
              {t === 'expense' ? 'Chi tiêu' : 'Thu nhập'}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">
          Nhóm cha <span className="text-red-500">*</span>
        </label>
        <select {...register('groupId')}
          className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
        >
          <option value="">-- Chọn nhóm --</option>
          {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>
        {errors.groupId && <p className="mt-1 text-xs text-red-600">{errors.groupId.message}</p>}
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">
          Tên danh mục <span className="text-red-500">*</span>
        </label>
        <input {...register('name')} type="text" maxLength={50} placeholder="Ví dụ: Điện thoại"
          className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
        />
        {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name.message}</p>}
      </div>

      <ColorPicker selectedColor={selectedColor} onSelect={(c) => setValue('color', c)} />
      <IconPicker selectedIcon={selectedIcon} onSelect={(i) => setValue('icon', i)} />

      {createMutation.error && <p className="text-sm text-red-600">{createMutation.error.message}</p>}

      <div className="flex justify-end gap-3 pt-2">
        <button type="button" onClick={onClose} disabled={createMutation.isPending}
          className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >Hủy</button>
        <button type="submit" disabled={createMutation.isPending}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >{createMutation.isPending ? 'Đang lưu...' : 'Thêm danh mục'}</button>
      </div>
    </form>
  )
}

// ─── Edit Form ────────────────────────────────────────────────
function EditForm({ defaultValues, onClose }: {
  defaultValues: Partial<CategoryWithGroup>
  onClose: () => void
}) {
  const updateMutation = useUpdateCategory(defaultValues.id ?? '')
  const { register, handleSubmit, watch, setValue, formState: { errors } } =
    useForm<UpdateCategoryInput>({
      resolver: zodResolver(updateCategorySchema),
      defaultValues: {
        name: defaultValues.name ?? '',
        icon: defaultValues.icon ?? '',
        color: defaultValues.color ?? COLOR_PRESET[0],
      },
    })

  const selectedColor = watch('color')
  const selectedIcon = watch('icon')

  const onSubmit = async (data: UpdateCategoryInput) => {
    await updateMutation.mutateAsync(data)
    onClose()
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">Loại</label>
        <input type="text" value={defaultValues.type === 'expense' ? 'Chi tiêu' : 'Thu nhập'} disabled
          className="block w-full rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-500"
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">Nhóm cha</label>
        <input type="text" value={defaultValues.group?.name ?? ''} disabled
          className="block w-full rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-500"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">
          Tên danh mục <span className="text-red-500">*</span>
        </label>
        <input {...register('name')} type="text" maxLength={50}
          className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
        />
        {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name.message}</p>}
      </div>

      <ColorPicker selectedColor={selectedColor} onSelect={(c) => setValue('color', c)} />
      <IconPicker selectedIcon={selectedIcon} onSelect={(i) => setValue('icon', i)} />

      {updateMutation.error && <p className="text-sm text-red-600">{updateMutation.error.message}</p>}

      <div className="flex justify-end gap-3 pt-2">
        <button type="button" onClick={onClose} disabled={updateMutation.isPending}
          className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >Hủy</button>
        <button type="submit" disabled={updateMutation.isPending}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >{updateMutation.isPending ? 'Đang lưu...' : 'Lưu thay đổi'}</button>
      </div>
    </form>
  )
}

// ─── Public component ─────────────────────────────────────────
export default function CategoryForm({ mode, defaultValues, defaultType, defaultGroupId, onClose }: Props) {
  if (mode === 'edit' && defaultValues) {
    return <EditForm defaultValues={defaultValues} onClose={onClose} />
  }
  return <CreateForm defaultType={defaultType} defaultGroupId={defaultGroupId} onClose={onClose} />
}
