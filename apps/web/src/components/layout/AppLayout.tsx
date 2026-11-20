import { useEffect, useRef, useState } from 'react'
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router'
import { useQueryClient } from '@tanstack/react-query'
import { authClient } from '../../lib/auth-client'
import DashboardIcon, { type DashboardIconName } from '../dashboard/DashboardIcon'
import './dashboard-layout.css'

const PAGE_TITLES: Record<string, string> = {
  '/': 'Dashboard',
  '/transactions': 'Giao dịch',
  '/categories': 'Danh mục',
  '/budget': 'Ngân sách',
  '/assets': 'Tài sản',
  '/reports': 'Báo cáo',
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

  if (
    location.pathname === '/' ||
    location.pathname === '/transactions' ||
    location.pathname.startsWith('/transactions/') ||
    location.pathname === '/categories' ||
    location.pathname === '/budget' ||
    location.pathname === '/assets' ||
    location.pathname === '/reports' ||
    location.pathname === '/settings'
  ) {
    return (
      <DashboardLayout
        userName={userName}
        userEmail={userEmail}
        avatarLetter={avatarLetter}
        onSignOut={handleSignOut}
        isSettings={location.pathname === '/settings'}
      />
    )
  }

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
            <SidebarNavItem to="/assets" icon="💰" label="Tài sản" />
            <SidebarNavItem to="/reports" icon="📈" label="Báo cáo" />
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

interface DashboardLayoutProps {
  userName: string
  userEmail: string
  avatarLetter: string
  onSignOut: () => Promise<void>
  isSettings: boolean
}

const DASHBOARD_NAV: Array<{
  section?: string
  items: Array<{ to: string; label: string; icon: DashboardIconName; end?: boolean }>
}> = [
  {
    section: 'Tổng quan',
    items: [{ to: '/', label: 'Dashboard', icon: 'dashboard', end: true }],
  },
  {
    section: 'Quản lý',
    items: [
      { to: '/transactions', label: 'Giao dịch', icon: 'transactions' },
      { to: '/categories', label: 'Danh mục', icon: 'categories' },
      { to: '/budget', label: 'Ngân sách', icon: 'budget' },
      { to: '/assets', label: 'Tài sản', icon: 'assets' },
      { to: '/reports', label: 'Báo cáo', icon: 'reports' },
    ],
  },
  {
    section: 'Hệ thống',
    items: [{ to: '/settings', label: 'Cài đặt', icon: 'settings' }],
  },
]

function DashboardLayout({ userName, userEmail, avatarLetter, onSignOut, isSettings }: DashboardLayoutProps) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const mobileToggleRef = useRef<HTMLButtonElement>(null)
  const mobileSidebarRef = useRef<HTMLElement>(null)

  useEffect(() => {
    if (!mobileNavOpen) return

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const focusableSelector =
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

    const focusFirstItem = () => {
      mobileSidebarRef.current?.querySelector<HTMLElement>(focusableSelector)?.focus()
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        setMobileNavOpen(false)
        return
      }

      if (event.key !== 'Tab' || !mobileSidebarRef.current) return

      const focusable = Array.from(
        mobileSidebarRef.current.querySelectorAll<HTMLElement>(focusableSelector),
      )
      if (focusable.length === 0) return

      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    focusFirstItem()
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', handleKeyDown)
      mobileToggleRef.current?.focus()
    }
  }, [mobileNavOpen])

  const closeMobileNav = () => setMobileNavOpen(false)

  return (
    <div className="db-app">
      <aside
        ref={mobileSidebarRef}
        className={`db-sidebar${mobileNavOpen ? ' is-open' : ''}`}
        aria-label="Điều hướng chính"
      >
        <div className="db-brand">
          <div className="db-brand-logo" aria-hidden="true">
            <DashboardIcon name="assets" />
          </div>
          <div>
            <div className="db-brand-name">Personal Finance</div>
            <div className="db-brand-sub">Quản lý tài chính</div>
          </div>
        </div>

        <nav className="db-nav">
          {DASHBOARD_NAV.map((group, groupIndex) => (
            <div className="db-nav-group" key={group.section ?? `group-${groupIndex}`}>
              {group.section && <div className="db-nav-label">{group.section}</div>}
              {group.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className="db-nav-item"
                  onClick={closeMobileNav}
                >
                  <DashboardIcon name={item.icon} />
                  <span>{item.label}</span>
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        <div className="db-user">
          <div className="db-avatar" aria-hidden="true">{avatarLetter}</div>
          <div className="db-user-copy">
            <div className="db-user-name">{userName}</div>
            <div className="db-user-mail">{userEmail}</div>
          </div>
          <button
            type="button"
            className="db-logout"
            onClick={onSignOut}
            title="Đăng xuất"
            aria-label="Đăng xuất"
          >
            <DashboardIcon name="logout" size={16} />
          </button>
        </div>
      </aside>

      {mobileNavOpen && (
        <button
          type="button"
          className="db-sidebar-backdrop"
          aria-label="Đóng menu"
          onClick={closeMobileNav}
        />
      )}

      <div className={`db-main${isSettings ? ' db-main--settings' : ''}`}>
        <button
          type="button"
          ref={mobileToggleRef}
          className="db-mobile-toggle"
          aria-label={mobileNavOpen ? 'Đóng menu điều hướng' : 'Mở menu điều hướng'}
          aria-expanded={mobileNavOpen}
          onClick={() => setMobileNavOpen((open) => !open)}
        >
          <span aria-hidden="true">{mobileNavOpen ? '×' : '☰'}</span>
        </button>
        <Outlet />
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
