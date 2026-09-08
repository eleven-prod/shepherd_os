import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate, NavLink, useLocation } from 'react-router-dom'
import Sidebar from './components/Sidebar'
import { LoadingState, ErrorState } from './components/LoadingError'
import { DataProvider, useAppData } from './context/DataContext'
import { PeriodProvider } from './context/PeriodContext'
import { AuthProvider, useAuth } from './context/AuthContext'
import { NotificationProvider } from './context/NotificationContext'
import NotificationBell from './components/NotificationBell'
import Login from './screens/Login'
import PendingApproval from './screens/PendingApproval'
import Dashboard from './screens/Dashboard'
import PeopleGrowth from './screens/PeopleGrowth'
import LifeGroups from './screens/LifeGroups'
import GeographicReach from './screens/GeographicReach'
import Financial from './screens/Financial'
import KpiCenter from './screens/KpiCenter'
import Reports from './screens/Reports'
import ManagementAttention from './screens/ManagementAttention'
import Admin from './screens/Admin'
import DataEntry from './screens/DataEntry'

function useWindowWidth() {
  const [width, setWidth] = useState(window.innerWidth)
  useEffect(() => {
    const onResize = () => setWidth(window.innerWidth)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  return width
}

export default function App() {
  return (
    <AuthProvider>
      <AuthGate />
    </AuthProvider>
  )
}

// Only mounts DataProvider/PeriodProvider (which fetch app data) once
// we know the user is signed in AND has an assigned role — fetching
// earlier would just hit RLS-blocked empty results and look like a
// broken app instead of a clean "please sign in" experience.
function AuthGate() {
  const { session, isPending, loading } = useAuth()

  if (loading) return <LoadingState label="Loading Shepherd OS..." />
  if (!session) return <Login />
  if (isPending) return <PendingApproval />

  return (
    <DataProvider>
      <PeriodProvider>
        <NotificationProvider>
          <BrowserRouter>
            <AppShell />
          </BrowserRouter>
        </NotificationProvider>
      </PeriodProvider>
    </DataProvider>
  )
}

// Admin Console is reachable by anyone with edit rights on at least one
// resource — not just Admin/Pastor+MIS. RLS still blocks their actual
// writes per-table according to their real permissions; this just keeps
// someone with zero edit rights anywhere from landing on a page full of
// controls that would silently fail for them.
const RESOURCES = ['membership', 'life_groups', 'outreach', 'financial', 'attention', 'kpis', 'admin']

function AppShell() {
  const width = useWindowWidth()
  const collapsed = width < 900 && width >= 640
  const mobile = width < 640
  const { loading, error, refetch } = useAppData()
  const { canEdit, canView, signOut } = useAuth()
  const canAccessAdmin = RESOURCES.some((r) => canEdit(r))
  const canAccessDataEntry = canView('data_entry')

  return (
    <div style={{ display: 'flex', minHeight: '100vh', maxWidth: '100vw', overflowX: 'hidden' }}>
      {!mobile && <Sidebar collapsed={collapsed} />}
      {/* width:0 alongside flex:1 + minWidth:0 is a defensive addition for
          iOS Safari: some WebKit versions don't fully constrain a flex
          column child to its share of the row from flex:1/minWidth:0
          alone, letting a wide descendant several levels down (a grid,
          a chart) silently push this column — and everything after it —
          wider than the viewport. width:0 with flex-grow:1 forces the
          flex-basis to 0 so the final size comes purely from the
          available space, not from content. */}
      <div style={{ flex: 1, minWidth: 0, width: 0, display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10, padding: mobile ? '12px 16px 0' : '16px 24px 0' }}>
          {mobile && (
            // Sign Out normally lives in the sidebar, which is hidden on
            // mobile entirely — without this, mobile users would have no
            // way to sign out at all.
            <button
              onClick={signOut}
              aria-label="Sign out"
              style={{
                padding: '7px 12px',
                borderRadius: 8,
                border: '1px solid var(--line)',
                background: 'var(--surface)',
                color: 'var(--ink-muted)',
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Sign out
            </button>
          )}
          <NotificationBell />
        </div>
        {loading ? (
          <LoadingState label="Loading Shepherd OS..." />
        ) : error ? (
          <ErrorState message={error} onRetry={refetch} />
        ) : (
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/people" element={<PeopleGrowth />} />
            <Route path="/life-groups" element={<LifeGroups />} />
            <Route path="/outreach" element={<GeographicReach />} />
            <Route path="/financial" element={<Financial />} />
            <Route path="/kpi-center" element={<KpiCenter />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/attention" element={<ManagementAttention />} />
            <Route path="/data-entry" element={canAccessDataEntry ? <DataEntry /> : <Navigate to="/" replace />} />
            <Route path="/admin" element={canAccessAdmin ? <Admin /> : <Navigate to="/" replace />} />
          </Routes>
        )}
        {mobile && !loading && !error && <MobileNav />}
      </div>
    </div>
  )
}

// Same screen list and resource-gating as Sidebar.jsx — mobile users
// should be able to reach every screen their role allows, not a
// hardcoded subset. Previously this list only had 5 fixed items and
// ignored permissions entirely, meaning Financial, KPI Center, Reports,
// Data Entry, and Admin Console were unreachable on mobile regardless
// of role.
const MOBILE_NAV_ITEMS = [
  { to: '/', label: 'Overview', icon: '▦', resource: null },
  { to: '/people', label: 'Membership', icon: '◔', resource: 'membership' },
  { to: '/life-groups', label: 'Life Groups', icon: '◈', resource: 'life_groups' },
  { to: '/outreach', label: 'Outreach', icon: '⬡', resource: 'outreach' },
  { to: '/financial', label: 'Financial', icon: '$', resource: 'financial' },
  { to: '/kpi-center', label: 'KPI Center', icon: '◎', resource: 'kpis' },
  { to: '/reports', label: 'Reports', icon: '▤', resource: 'reports' },
  { to: '/attention', label: 'Attention', icon: '!', resource: 'attention' },
  { to: '/data-entry', label: 'Data Entry', icon: '✎', resource: 'data_entry' },
  { to: '/admin', label: 'Admin Console', icon: '⚙', resource: 'admin' },
]

const MOBILE_NAV_WINDOW_SIZE = 5

function MobileNav() {
  const location = useLocation()
  const { canView, canEdit } = useAuth()

  const items = MOBILE_NAV_ITEMS.filter((item) => {
    if (item.resource === null) return true
    if (item.to === '/admin') return RESOURCES.some((r) => canEdit(r))
    return canView(item.resource)
  })

  const currentIndex = Math.max(
    0,
    items.findIndex((item) => item.to === location.pathname),
  )

  // Shows a WINDOW of icons (5 at a time, directly tappable) rather
  // than just the single current screen — Prev/Next shifts which
  // window of icons is visible, so every screen stays reachable even
  // once there are more of them than fit on one row at once.
  const [windowStart, setWindowStart] = useState(0)
  const maxStart = Math.max(0, items.length - MOBILE_NAV_WINDOW_SIZE)

  // Bug found via screenshot: windowStart is local state that never
  // moved on its own — if the active page changed by any means other
  // than tapping an icon already visible in the current window (e.g.
  // landing on a page directly, or a page reached earlier from the
  // desktop sidebar), the nav bar kept showing its last window and the
  // wrong item highlighted as active. Snap the window to always include
  // the actual current page whenever the route changes.
  useEffect(() => {
    setWindowStart((prev) => {
      if (currentIndex >= prev && currentIndex < prev + MOBILE_NAV_WINDOW_SIZE) return prev
      return Math.min(currentIndex, maxStart)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex])

  const clampedStart = Math.min(windowStart, maxStart)
  const visible = items.slice(clampedStart, clampedStart + MOBILE_NAV_WINDOW_SIZE)
  const canGoPrev = clampedStart > 0
  const canGoNext = clampedStart < maxStart

  if (items.length === 0) return null

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        display: 'flex',
        alignItems: 'center',
        background: 'var(--surface)',
        borderTop: '1px solid var(--line)',
        padding: '6px 2px calc(6px + env(safe-area-inset-bottom, 0px))',
        zIndex: 100,
      }}
    >
      <button
        onClick={() => setWindowStart((s) => Math.max(0, s - MOBILE_NAV_WINDOW_SIZE))}
        disabled={!canGoPrev}
        aria-label="Show previous screens"
        style={{ background: 'none', border: 'none', fontSize: 18, padding: '8px 6px', color: canGoPrev ? 'var(--ink-muted)' : 'var(--line)', cursor: canGoPrev ? 'pointer' : 'default', flexShrink: 0 }}
      >
        ‹
      </button>
      {visible.map((item) => {
        const isActive = item.to === location.pathname
        return (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 2,
              padding: '6px 0',
              minWidth: 0,
              color: isActive ? 'var(--primary)' : 'var(--ink-muted)',
              textDecoration: 'none',
              fontSize: 10,
              fontWeight: isActive ? 700 : 400,
            }}
          >
            <span style={{ fontSize: 18 }}>{item.icon}</span>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}>{item.label}</span>
          </NavLink>
        )
      })}
      <button
        onClick={() => setWindowStart((s) => Math.min(maxStart, s + MOBILE_NAV_WINDOW_SIZE))}
        disabled={!canGoNext}
        aria-label="Show more screens"
        style={{ background: 'none', border: 'none', fontSize: 18, padding: '8px 6px', color: canGoNext ? 'var(--ink-muted)' : 'var(--line)', cursor: canGoNext ? 'pointer' : 'default', flexShrink: 0 }}
      >
        ›
      </button>
    </div>
  )
}
