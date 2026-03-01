import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  updateProfileSchema,
  changePasswordSchema,
  QUERY_KEYS,
  CURRENCIES,
  type UpdateProfileInput,
  type ChangePasswordInput,
  type UserProfile,
} from '@pf/shared'
import { authClient } from '../lib/auth-client'
import { apiClient } from '../services/apiClient'

// ─── Profile Section ───────────────────────────────────────

function ProfileSection() {
  const queryClient = useQueryClient()
  const { data: session } = authClient.useSession()
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle')

  const { data, isPending } = useQuery({
    queryKey: QUERY_KEYS.profile,
    queryFn: () => apiClient<{ data: UserProfile }>('/settings/profile'),
  })

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<UpdateProfileInput>({
    resolver: zodResolver(updateProfileSchema),
    values: {
      displayName: data?.data.displayName ?? '',
      currency: data?.data.currency as 'VND' | 'USD' | 'EUR' | undefined,
      theme: data?.data.theme as 'light' | 'dark' | 'system' | undefined,
    },
  })

  const onSubmit = async (formData: UpdateProfileInput) => {
    setSaveStatus('idle')
    try {
      await apiClient('/settings/profile', { method: 'PUT', body: formData })
      await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.profile })
      setSaveStatus('success')
      setTimeout(() => setSaveStatus('idle'), 3000)
    } catch {
      setSaveStatus('error')
    }
  }

  if (isPending) {
    return <div className="text-sm text-gray-400">Đang tải...</div>
  }

  return (
    <section className="rounded-lg bg-white p-6 shadow-sm">
      <h2 className="mb-4 text-base font-semibold text-gray-900">Thông tin cá nhân</h2>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 max-w-md">
        <div>
          <label className="block text-sm font-medium text-gray-700">Email</label>
          <input
            type="email"
            value={session?.user?.email ?? ''}
            disabled
            className="mt-1 block w-full rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-500"
          />
        </div>

        <div>
          <label htmlFor="displayName" className="block text-sm font-medium text-gray-700">
            Tên hiển thị
          </label>
          <input
            id="displayName"
            type="text"
            {...register('displayName')}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            placeholder="Nhập tên hiển thị"
          />
          {errors.displayName && (
            <p className="mt-1 text-sm text-red-600">{errors.displayName.message}</p>
          )}
        </div>

        <div>
          <label htmlFor="currency" className="block text-sm font-medium text-gray-700">
            Tiền tệ mặc định
          </label>
          <select
            id="currency"
            {...register('currency')}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          >
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c === 'VND' ? 'VND — Việt Nam đồng' : c === 'USD' ? 'USD — US Dollar' : 'EUR — Euro'}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSubmitting ? 'Đang lưu...' : 'Lưu thay đổi'}
          </button>

          {saveStatus === 'success' && (
            <span className="text-sm text-green-600">Cập nhật thành công</span>
          )}
          {saveStatus === 'error' && (
            <span className="text-sm text-red-600">Lưu thất bại, thử lại</span>
          )}
        </div>
      </form>
    </section>
  )
}

// ─── Change Password Section ────────────────────────────────

function ChangePasswordSection() {
  const [serverError, setServerError] = useState('')
  const [success, setSuccess] = useState(false)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ChangePasswordInput>({
    resolver: zodResolver(changePasswordSchema),
  })

  const onSubmit = async (data: ChangePasswordInput) => {
    setServerError('')
    setSuccess(false)

    const { error } = await authClient.changePassword({
      currentPassword: data.currentPassword,
      newPassword: data.newPassword,
      revokeOtherSessions: false,
    })

    if (error) {
      setServerError(
        error.code === 'INVALID_PASSWORD'
          ? 'Mật khẩu hiện tại không đúng'
          : (error.message ?? 'Đổi mật khẩu thất bại'),
      )
      return
    }

    setSuccess(true)
    reset()
    setTimeout(() => setSuccess(false), 3000)
  }

  return (
    <section className="rounded-lg bg-white p-6 shadow-sm">
      <h2 className="mb-4 text-base font-semibold text-gray-900">Đổi mật khẩu</h2>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 max-w-md">
        {serverError && (
          <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{serverError}</div>
        )}

        <div>
          <label htmlFor="currentPassword" className="block text-sm font-medium text-gray-700">
            Mật khẩu hiện tại
          </label>
          <input
            id="currentPassword"
            type="password"
            {...register('currentPassword')}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
          {errors.currentPassword && (
            <p className="mt-1 text-sm text-red-600">{errors.currentPassword.message}</p>
          )}
        </div>

        <div>
          <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700">
            Mật khẩu mới
          </label>
          <input
            id="newPassword"
            type="password"
            {...register('newPassword')}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
          {errors.newPassword && (
            <p className="mt-1 text-sm text-red-600">{errors.newPassword.message}</p>
          )}
        </div>

        <div>
          <label htmlFor="confirmNewPassword" className="block text-sm font-medium text-gray-700">
            Xác nhận mật khẩu mới
          </label>
          <input
            id="confirmNewPassword"
            type="password"
            {...register('confirmNewPassword')}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
          {errors.confirmNewPassword && (
            <p className="mt-1 text-sm text-red-600">{errors.confirmNewPassword.message}</p>
          )}
        </div>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSubmitting ? 'Đang đổi...' : 'Đổi mật khẩu'}
          </button>

          {success && (
            <span className="text-sm text-green-600">Đổi mật khẩu thành công</span>
          )}
        </div>
      </form>
    </section>
  )
}

// ─── Page ───────────────────────────────────────────────────

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Cài đặt</h1>
      <ProfileSection />
      <ChangePasswordSection />
    </div>
  )
}
