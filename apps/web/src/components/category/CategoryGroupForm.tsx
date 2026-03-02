import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  createCategoryGroupSchema,
  updateCategoryGroupSchema,
  type CreateCategoryGroupInput,
  type UpdateCategoryGroupInput,
} from '@pf/shared'
import type { CategoryGroup, CategoryType } from '@pf/shared'
import { useCreateCategoryGroup, useUpdateCategoryGroup } from '../../hooks/useCategoryGroups'

const COLOR_PRESET = [
  '#ef4444', '#f97316', '#eab308', '#84cc16', '#22c55e', '#06b6d4',
  '#3b82f6', '#8b5cf6', '#d946ef', '#f43f5e', '#14b8a6', '#f59e0b',
]

interface Props {
  mode: 'create' | 'edit'
  defaultValues?: Partial<CategoryGroup>
  defaultType?: CategoryType
  onClose: () => void
}

export default function CategoryGroupForm({ mode, defaultValues, defaultType, onClose }: Props) {
  const createMutation = useCreateCategoryGroup()
  const updateMutation = useUpdateCategoryGroup(defaultValues?.id ?? '')
  const isPending = createMutation.isPending || updateMutation.isPending

  const schema = mode === 'create' ? createCategoryGroupSchema : updateCategoryGroupSchema
  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      name: defaultValues?.name ?? '',
      type: defaultValues?.type ?? defaultType ?? 'expense',
      color: defaultValues?.color ?? COLOR_PRESET[0],
      sortOrder: 0,
    },
  })

  const selectedType = watch('type') as CategoryType
  const selectedColor = watch('color') as string

  const onSubmit = async (data: CreateCategoryGroupInput | UpdateCategoryGroupInput) => {
    if (mode === 'create') {
      await createMutation.mutateAsync(data as CreateCategoryGroupInput)
    } else {
      await updateMutation.mutateAsync(data as UpdateCategoryGroupInput)
    }
    onClose()
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {/* Type toggle — disabled when edit */}
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">Loại nhóm</label>
        {mode === 'edit' ? (
          <input
            type="text"
            value={defaultValues?.type === 'expense' ? 'Chi tiêu' : 'Thu nhập'}
            disabled
            className="block w-full rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-500"
          />
        ) : (
          <div className="flex gap-2">
            {(['expense', 'income'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setValue('type', t)}
                className={`flex-1 rounded-md border px-3 py-2 text-sm font-medium ${
                  selectedType === t
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-gray-300 text-gray-600 hover:bg-gray-50'
                }`}
              >
                {t === 'expense' ? 'Chi tiêu' : 'Thu nhập'}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Name */}
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">
          Tên nhóm <span className="text-red-500">*</span>
        </label>
        <input
          {...register('name')}
          type="text"
          maxLength={50}
          placeholder="Ví dụ: Công việc"
          className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
        />
        {errors.name && (
          <p className="mt-1 text-xs text-red-600">{errors.name.message as string}</p>
        )}
      </div>

      {/* Color */}
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">Màu sắc</label>
        <div className="flex flex-wrap gap-2">
          {COLOR_PRESET.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setValue('color', c)}
              className={`h-7 w-7 rounded-full border-2 transition-transform ${
                selectedColor === c ? 'scale-110 border-gray-700' : 'border-transparent'
              }`}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
      </div>

      {(createMutation.error || updateMutation.error) && (
        <p className="text-sm text-red-600">
          {createMutation.error?.message ?? updateMutation.error?.message}
        </p>
      )}

      <div className="flex justify-end gap-3 pt-2">
        <button
          type="button"
          onClick={onClose}
          disabled={isPending}
          className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          Hủy
        </button>
        <button
          type="submit"
          disabled={isPending}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {isPending ? 'Đang lưu...' : mode === 'create' ? 'Tạo nhóm' : 'Lưu thay đổi'}
        </button>
      </div>
    </form>
  )
}
