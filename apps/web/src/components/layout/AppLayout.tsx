import { Outlet, NavLink, useNavigate, useLocation } from 'react-router'
import { useQueryClient } from '@tanstack/react-query'
import { authClient } from '../../lib/auth-client'

const PAGE_TITLES: Record<string, string> = {
  '/': 'Dashboard',
  '/transactions': 'Giao dịch',
  '/categories': 'Danh mục',
  '/budget': 'Ngân sách',
  '/settings': 'Cài đặt',
}

function getPageTitle(pathname: string): string {
  return PAGE_TITLES[pathname] ?? 'Personal Finance'
}

function getAvatarLetter(name?: string | null, email?: string | null): string {
  const source = name ?? email ?? 'U'
  return source.charAt(0).toUpperCase()
}

export default function AppLayout() {
  const navigate = useNavigate()
  const location = useLocation()
  const queryClient = useQueryClient()
  const { data: session } = authClient.useSession()

  const handleSignOut = async () => {
    await authClient.signOut()
    queryClient.clear()
    navigate('/login')
  }

  const pageTitle = getPageTitle(location.pathname)
  const userName = session?.user?.name ?? session?.user?.email ?? ''
  const userEmail = session?.user?.email ?? ''
  const avatarLetter = getAvatarLetter(session?.user?.name, session?.user?.email)

  return (
    /* .app { display: flex; height: 100vh; overflow: hidden; } */
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>

      {/* ── Sidebar ── */}
      <aside
        style={{
          display: 'flex',
          width: '240px',
          flexShrink: 0,
          background: '#fff',
          borderRight: '1px solid #e2e8f0',
          flexDirection: 'column',
          overflowY: 'auto',
        }}
      >
        {/* Logo */}
        <div
          style={{
            padding: '20px 20px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            borderBottom: '1px solid #e2e8f0',
          }}
        >
          {/* .logo-icon */}
          <div
            style={{
              width: '36px',
              height: '36px',
              background: '#4f46e5',
              borderRadius: '10px',
              display: 'grid',
              placeItems: 'center',
              color: '#fff',
              fontSize: '18px',
              flexShrink: 0,
            }}
          >
            💰
          </div>
          <div>
            <div style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a', lineHeight: 1.2 }}>
              Personal Finance
            </div>
            <div style={{ fontSize: '11px', color: '#64748b', marginTop: '1px' }}>
              Quản lý tài chính
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1 }}>
          {/* Section: Tổng quan */}
          <div style={{ padding: '12px 12px 4px' }}>
            <div
              style={{
                fontSize: '11px',
                fontWeight: 600,
                color: '#94a3b8',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                padding: '0 8px',
                marginBottom: '4px',
              }}
            >
              Tổng quan
            </div>
            <SidebarNavItem to="/" end icon="📊" label="Dashboard" />
          </div>

          {/* Section: Quản lý */}
          <div style={{ padding: '12px 12px 4px' }}>
            <div
              style={{
                fontSize: '11px',
                fontWeight: 600,
                color: '#94a3b8',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                padding: '0 8px',
                marginBottom: '4px',
              }}
            >
              Quản lý
            </div>
            <SidebarNavItem to="/transactions" icon="💸" label="Giao dịch" />
            <SidebarNavItem to="/categories" icon="🗂️" label="Danh mục" />
            <SidebarNavItem to="/budget" icon="🎯" label="Ngân sách" />
          </div>

          {/* Section: no label */}
          <div style={{ padding: '12px 12px 4px' }}>
            <SidebarNavItem to="/settings" icon="⚙️" label="Cài đặt" />
          </div>
        </nav>

        {/* Footer */}
        <div
          style={{
            marginTop: 'auto',
            padding: '12px',
            borderTop: '1px solid #e2e8f0',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '8px',
              borderRadius: '8px',
            }}
          >
            {/* Avatar */}
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                background: '#4f46e5',
                color: '#fff',
                display: 'grid',
                placeItems: 'center',
                fontWeight: 700,
                fontSize: '14px',
                flexShrink: 0,
              }}
            >
              {avatarLetter}
            </div>
            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  fontSize: '13px',
                  fontWeight: 600,
                  color: '#0f172a',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {userName}
              </div>
              <div
                style={{
                  fontSize: '11px',
                  color: '#64748b',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {userEmail}
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* ── Main area ── */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Topbar */}
        <header
          style={{
            height: '60px',
            flexShrink: 0,
            background: '#fff',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 24px',
            gap: '16px',
          }}
        >
          <div>
            <span style={{ fontSize: '18px', fontWeight: 700, color: '#0f172a' }}>
              {pageTitle}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {/* Sign out icon button */}
            <button
              onClick={handleSignOut}
              title="Đăng xuất"
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                border: '1px solid #e2e8f0',
                background: '#fff',
                cursor: 'pointer',
                display: 'grid',
                placeItems: 'center',
                fontSize: '18px',
                transition: 'background .15s',
              }}
              onMouseEnter={e => {
                ;(e.currentTarget as HTMLButtonElement).style.background = '#f1f5f9'
              }}
              onMouseLeave={e => {
                ;(e.currentTarget as HTMLButtonElement).style.background = '#fff'
              }}
            >
              🚪
            </button>
          </div>
        </header>

        {/* Content */}
        <main
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '24px',
            background: '#f8fafc',
          }}
        >
          <Outlet />
        </main>
      </div>
    </div>
  )
}

/* ── Sub-components ── */

interface NavItemProps {
  to: string
  end?: boolean
  icon: string
  label: string
}

function SidebarNavItem({ to, end = false, icon, label }: NavItemProps) {
  return (
    <NavLink
      to={to}
      end={end}
      style={({ isActive }) => ({
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        padding: '9px 10px',
        borderRadius: '8px',
        cursor: 'pointer',
        color: isActive ? '#4f46e5' : '#64748b',
        fontSize: '14px',
        fontWeight: isActive ? 600 : 400,
        background: isActive ? '#eef2ff' : 'transparent',
        marginBottom: '2px',
        textDecoration: 'none',
        transition: 'all .15s',
      })}
      onMouseEnter={e => {
        const el = e.currentTarget as HTMLAnchorElement
        if (!el.getAttribute('aria-current')) {
          el.style.background = '#f1f5f9'
          el.style.color = '#0f172a'
        }
      }}
      onMouseLeave={e => {
        const el = e.currentTarget as HTMLAnchorElement
        if (!el.getAttribute('aria-current')) {
          el.style.background = 'transparent'
          el.style.color = '#64748b'
        }
      }}
    >
      <>
        <span style={{ width: '18px', textAlign: 'center', flexShrink: 0 }}>{icon}</span>
        <span>{label}</span>
      </>
    </NavLink>
  )
}
