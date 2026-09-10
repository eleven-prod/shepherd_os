import { NavLink } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { SignOutIcon } from './Icons'

const SIDEBAR_BG = '#06183a' // Secondary-800, dark navy
const SIDEBAR_LINE = 'rgba(255,255,255,0.1)'
const SIDEBAR_TEXT_MUTED = '#97a6c4' // light blue-gray, readable against dark navy
const SIDEBAR_ACTIVE_BG = 'rgba(60,118,241,0.25)' // Primary blue, translucent

const NAV_ITEMS = [
  { to: '/', label: 'Overview', icon: '▦', end: true, resource: null }, // always shown to any assigned role
  { to: '/people', label: 'Membership', icon: '◔', resource: 'membership' },
  { to: '/life-groups', label: 'Life Groups', icon: '◈', resource: 'life_groups' },
  { to: '/outreach', label: 'Outreach', icon: '⬡', resource: 'outreach' },
  { to: '/financial', label: 'Financial', icon: '$', resource: 'financial' },
  { to: '/kpi-center', label: 'KPI Center', icon: '◎', resource: 'kpis' },
  { to: '/reports', label: 'Reports', icon: '▤', resource: 'reports' },
  { to: '/attention', label: 'Attention', icon: '!', resource: 'attention' },
  { to: '/data-entry', label: 'Data Entry', icon: '✎', resource: 'data_entry' },
]

const ROLE_LABELS = {
  admin: 'Admin',
  pastor_mis: 'Pastor and MIS',
  church_management_team: 'Church Management Team',
  church_coordinator: 'Church Coordinator',
  finance: 'Finance',
  life_group_leader: 'Life Group Leader',
}

const RESOURCES = ['membership', 'life_groups', 'outreach', 'financial', 'attention', 'kpis', 'admin']

export default function Sidebar({ collapsed }) {
  const { profile, role, permissions, canView, canEdit, signOut } = useAuth()
  const items = NAV_ITEMS.filter((item) => item.resource === null || canView(item.resource))
  // Admin Console is relevant to anyone with edit rights on at least one
  // resource, not just the two admin roles — Finance, Church Management
  // Team, etc. all need to reach it to actually use their edit access,
  // since that's the only place edit forms live right now.
  const canReachAdmin = RESOURCES.some((r) => canEdit(r))

  return (
    <div
      style={{
        width: collapsed ? 84 : 220,
        background: SIDEBAR_BG,
        borderRight: `1px solid ${SIDEBAR_LINE}`,
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
        // Fixed to exactly the viewport height and pinned there (sticky
        // top:0) — the sidebar itself never scrolls or grows taller than
        // the screen. If the nav list has more items than fit, THAT
        // scrolls on its own (overflowY:auto below), not the sidebar as a
        // whole; the logo header above and the profile/Sign out footer
        // below stay put either way.
        height: '100vh',
        position: 'sticky',
        top: 0,
      }}
    >
      <div style={{ padding: collapsed ? '22px 0' : '22px 20px', display: 'flex', alignItems: 'center', gap: 10, justifyContent: collapsed ? 'center' : 'flex-start' }}>
        <img
          src="/pwa-512.png"
          alt="Shepherd OS"
          style={{
            width: 34,
            height: 34,
            borderRadius: 9,
            flexShrink: 0,
            objectFit: 'contain',
          }}
        />
        {!collapsed && (
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: 0.4, color: '#ffffff' }}>SHEPHERD OS</div>
            <div style={{ fontSize: 11, fontWeight: 500, color: SIDEBAR_TEXT_MUTED }}>JIL Pinamalayan</div>
          </div>
        )}
      </div>
      <hr style={{ border: 'none', borderTop: `1px solid ${SIDEBAR_LINE}`, margin: '4px 0' }} />
      <nav style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            style={({ isActive }) => ({
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              justifyContent: collapsed ? 'center' : 'flex-start',
              margin: collapsed ? '3px 14px' : '3px 12px',
              padding: '11px 10px',
              borderRadius: 10,
              textDecoration: 'none',
              color: isActive ? '#ffffff' : SIDEBAR_TEXT_MUTED,
              background: isActive ? SIDEBAR_ACTIVE_BG : 'transparent',
              fontWeight: isActive ? 700 : 400,
              fontSize: 13.5,
            })}
          >
            <span style={{ fontSize: 16, width: 20, textAlign: 'center' }}>{item.icon}</span>
            {!collapsed && <span>{item.label}</span>}
          </NavLink>
        ))}
        {canReachAdmin && (
          <NavLink
            to="/admin"
            style={({ isActive }) => ({
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              justifyContent: collapsed ? 'center' : 'flex-start',
              margin: collapsed ? '3px 14px' : '3px 12px',
              padding: '11px 10px',
              borderRadius: 10,
              textDecoration: 'none',
              color: isActive ? '#ffffff' : SIDEBAR_TEXT_MUTED,
              background: isActive ? SIDEBAR_ACTIVE_BG : 'transparent',
              fontWeight: isActive ? 700 : 400,
              fontSize: 13.5,
            })}
          >
            <span style={{ fontSize: 16, width: 20, textAlign: 'center' }}>⚙</span>
            {!collapsed && <span>Admin Console</span>}
          </NavLink>
        )}
      </nav>
      <hr style={{ border: 'none', borderTop: `1px solid ${SIDEBAR_LINE}`, margin: '4px 0' }} />
      <div style={{ padding: collapsed ? '12px 8px' : '12px 16px' }}>
        {!collapsed && (
          <div style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 13, fontWeight: 700, overflowWrap: 'break-word', color: '#ffffff' }}>{profile?.full_name || 'User'}</div>
            <div style={{ fontSize: 11, fontWeight: 500, color: SIDEBAR_TEXT_MUTED }}>{ROLE_LABELS[role] || role}</div>
          </div>
        )}
        <button
          onClick={signOut}
          title="Sign out"
          style={{
            width: '100%',
            padding: '8px 0',
            borderRadius: 8,
            border: `1px solid ${SIDEBAR_LINE}`,
            background: 'rgba(255,255,255,0.06)',
            color: '#ffffff',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <SignOutIcon size={15} />
        </button>
      </div>
    </div>
  )
}
