import { Outlet, NavLink, useNavigate } from 'react-router'
import { useQueryClient } from '@tanstack/react-query'
import { authClient } from '../../lib/auth-client'

export default function AppLayout() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { data: session } = authClient.useSession()

  const handleSignOut = async () => {
    await authClient.signOut()
    queryClient.clear()
    navigate('/login')
  }

  return (
    <div className="flex min-h-screen flex-col">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-gray-200 bg-white px-6 py-3 shadow-sm">
        <nav className="flex items-center gap-1">
          <NavLink
            to="/"
            end
            className={({ isActive }) =>
              `rounded-md px-3 py-2 text-sm font-medium ${isActive ? 'bg-primary text-white' : 'text-gray-600 hover:bg-gray-100'}`
            }
          >
            Dashboard
          </NavLink>
          <NavLink
            to="/transactions"
            className={({ isActive }) =>
              `rounded-md px-3 py-2 text-sm font-medium ${isActive ? 'bg-primary text-white' : 'text-gray-600 hover:bg-gray-100'}`
            }
          >
            Giao dịch
          </NavLink>
          <NavLink
            to="/settings"
            className={({ isActive }) =>
              `rounded-md px-3 py-2 text-sm font-medium ${isActive ? 'bg-primary text-white' : 'text-gray-600 hover:bg-gray-100'}`
            }
          >
            Cài đặt
          </NavLink>
        </nav>

        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500">
            {session?.user?.email ?? ''}
          </span>
          <button
            onClick={handleSignOut}
            className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
          >
            Đăng xuất
          </button>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 bg-gray-50 p-6">
        <Outlet />
      </main>
    </div>
  )
}
