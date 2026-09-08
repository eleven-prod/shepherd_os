import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useNotifications } from '../context/NotificationContext'
import { BellIcon, PinIcon, ChatIcon } from './Icons'

export default function NotificationBell() {
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications()
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()

  function handleClickNotification(n) {
    if (!n.read) markAsRead(n.id)
    if (n.link) {
      navigate(n.link)
      setOpen(false)
    }
  }

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          position: 'relative',
          width: 38,
          height: 38,
          borderRadius: 10,
          border: '1px solid var(--line)',
          background: 'var(--surface)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 16,
        }}
      >
        <BellIcon size={17} />
        {unreadCount > 0 && (
          <span
            style={{
              position: 'absolute',
              top: -4,
              right: -4,
              minWidth: 17,
              height: 17,
              borderRadius: 999,
              background: 'var(--status-critical)',
              color: 'white',
              fontSize: 10,
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0 4px',
            }}
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 999 }} onClick={() => setOpen(false)} />
          <div
            style={{
              position: 'absolute',
              top: 'calc(100% + 8px)',
              right: 0,
              zIndex: 1000,
              width: 340,
              // Fixed 340px overflows off the left edge of narrow phones
              // (e.g. 320-360px viewports) since this panel is anchored to
              // the bell icon near the screen's right edge, not centered —
              // cap it to the viewport minus the header's side padding so
              // it always stays fully on-screen and readable.
              maxWidth: 'calc(100vw - 32px)',
              maxHeight: 420,
              overflowY: 'auto',
              background: 'var(--surface)',
              border: '1px solid var(--line)',
              borderRadius: 12,
              boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', padding: '12px 14px', borderBottom: '1px solid var(--line)' }}>
              <div style={{ fontWeight: 700, fontSize: 14, flex: 1 }}>Notifications</div>
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  style={{ background: 'none', border: 'none', color: 'var(--primary)', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                >
                  Mark all read
                </button>
              )}
            </div>

            {notifications.length === 0 ? (
              <div className="body-muted" style={{ padding: 24, textAlign: 'center' }}>
                Nothing yet.
              </div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  onClick={() => handleClickNotification(n)}
                  style={{
                    padding: '12px 14px',
                    borderBottom: '1px solid var(--line)',
                    cursor: n.link ? 'pointer' : 'default',
                    background: n.read ? 'transparent' : 'var(--accent-soft)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                    <span style={{ marginTop: 1 }}>{n.type === 'assignment' ? <PinIcon size={13} /> : <ChatIcon size={13} />}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: n.read ? 600 : 700, overflowWrap: 'break-word' }}>{n.title}</div>
                      {n.body && (
                        <div className="body-muted" style={{ marginTop: 2, fontSize: 12.5, overflowWrap: 'break-word' }}>
                          {n.body}
                        </div>
                      )}
                      <div className="caption" style={{ marginTop: 4 }}>
                        {new Date(n.created_at).toLocaleString()}
                      </div>
                    </div>
                    {!n.read && <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--primary)', marginTop: 4, flexShrink: 0 }} />}
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  )
}
