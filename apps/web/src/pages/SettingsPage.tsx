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

const profileFormSchema = updateProfileSchema.omit({ goldPricePerLuong: true })

type ProfileFormValues = Omit<UpdateProfileInput, 'goldPricePerLuong'>

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
  } = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    values: {
      displayName: data?.data.displayName ?? '',
      currency: data?.data.currency as 'VND' | 'USD' | 'EUR' | undefined,
      theme: data?.data.theme as 'light' | 'dark' | 'system' | undefined,
    },
  })

  const onSubmit = async (formData: ProfileFormValues) => {
    setSaveStatus('idle')
    try {
      const normalizedDisplayName = formData.displayName?.trim()
      const payload: UpdateProfileInput = {
        currency: formData.currency,
        theme: formData.theme,
      }

      if (normalizedDisplayName) {
        payload.displayName = normalizedDisplayName
      }

      await apiClient('/settings/profile', { method: 'PUT', body: payload })
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.profile }),
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.assets }),
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.dashboard }),
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.reports }),
      ])
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

// ─── Zalo Link Section ──────────────────────────────────────

type ZaloLinkStatus = { linked: false } | { linked: true; displayName: string | null; createdAt: string }

function ZaloLinkSection() {
  const queryClient = useQueryClient()
  const [linkCode, setLinkCode] = useState<{ code: string; expiresAt: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ type: 'error' | 'info'; text: string } | null>(null)

  const { data: status, isPending, refetch, isFetching } = useQuery({
    queryKey: QUERY_KEYS.zaloLink,
    queryFn: () => apiClient<ZaloLinkStatus>('/integrations/zalo/status'),
  })

  const createCode = async () => {
    setBusy(true)
    setMessage(null)
    try {
      setLinkCode(await apiClient<{ code: string; expiresAt: string }>('/integrations/zalo/link-code', { method: 'POST' }))
    } catch {
      setMessage({ type: 'error', text: 'Không tạo được mã, thử lại' })
    } finally {
      setBusy(false)
    }
  }

  const checkLinked = async () => {
    setMessage(null)
    const { data } = await refetch()
    if (data?.linked) setLinkCode(null)
    else setMessage({ type: 'info', text: 'Chưa thấy liên kết. Hãy gửi mã cho bot rồi kiểm tra lại.' })
  }

  const unlinkZalo = async () => {
    if (!window.confirm('Hủy liên kết Zalo? Bot sẽ không nhận tin nhắn của bạn nữa.')) return
    setBusy(true)
    setMessage(null)
    try {
      await apiClient('/integrations/zalo', { method: 'DELETE' })
      await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.zaloLink })
    } catch {
      setMessage({ type: 'error', text: 'Hủy liên kết thất bại, thử lại' })
    } finally {
      setBusy(false)
    }
  }

  if (isPending) {
    return <div className="text-sm text-gray-400">Đang tải...</div>
  }

  const expiresAt = linkCode
    ? new Date(linkCode.expiresAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
    : ''

  return (
    <section className="rounded-lg bg-white p-6 shadow-sm">
      <h2 className="mb-4 text-base font-semibold text-gray-900">Liên kết Zalo</h2>

      <div className="space-y-4 max-w-md">
        {status?.linked ? (
          <>
            <p className="text-sm text-gray-700">
              <span className="text-green-600">✔</span> Đã liên kết với Zalo
              {status.displayName ? <>: <span className="font-medium">{status.displayName}</span></> : null}
            </p>
            <button
              type="button"
              onClick={unlinkZalo}
              disabled={busy}
              className="rounded-md border border-red-300 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy ? 'Đang hủy...' : 'Hủy liên kết'}
            </button>
          </>
        ) : linkCode ? (
          <>
            <div className="inline-block rounded-md border border-gray-300 bg-gray-50 px-4 py-2 font-mono text-2xl font-semibold tracking-widest text-gray-900">
              {linkCode.code}
            </div>
            <p className="text-sm text-gray-700">
              Gửi <span className="font-mono font-medium">/link {linkCode.code}</span> cho bot trên Zalo. Mã hết hạn lúc {expiresAt}.
            </p>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={checkLinked}
                disabled={isFetching}
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isFetching ? 'Đang kiểm tra...' : 'Tôi đã gửi, kiểm tra'}
              </button>
              <button type="button" onClick={createCode} disabled={busy} className="text-sm text-gray-500 hover:text-gray-700 disabled:opacity-50">
                Tạo mã mới
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="text-sm text-gray-700">Chat với trợ lý AI qua Zalo để ghi thu chi và hỏi thống kê.</p>
            <button
              type="button"
              onClick={createCode}
              disabled={busy}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy ? 'Đang tạo...' : 'Tạo mã liên kết'}
            </button>
          </>
        )}

        {message && (
          <p className={`text-sm ${message.type === 'error' ? 'text-red-600' : 'text-gray-500'}`}>{message.text}</p>
        )}
      </div>
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
      <ZaloLinkSection />
    </div>
  )
}
