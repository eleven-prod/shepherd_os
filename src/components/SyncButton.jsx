import { useState } from 'react'
import { RefreshIcon } from './Icons'

/**
 * Manual "refresh now" button for the top of a screen. Calls whatever
 * async refetch function is passed in (e.g. DataContext's `refetch`,
 * or a period's `refetchMetrics`) and shows a spinning icon while it
 * runs. It deliberately does NOT navigate away, remount the screen, or
 * clear what's already on it — those refetches already update their
 * data in place once the new data lands (see DataContext/PeriodContext),
 * so this is a way to ask for fresh data on demand without losing your
 * place, rather than a full page reload.
 */
export default function SyncButton({ onSync, title = 'Refresh data' }) {
  const [syncing, setSyncing] = useState(false)
  const [justSynced, setJustSynced] = useState(false)

  async function handleClick() {
    if (syncing) return
    setSyncing(true)
    try {
      await onSync()
      setJustSynced(true)
      setTimeout(() => setJustSynced(false), 1500)
    } catch (err) {
      console.error(err)
    } finally {
      setSyncing(false)
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={syncing}
      title={title}
      aria-label={title}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '7px 10px',
        borderRadius: 8,
        border: '1px solid var(--line)',
        background: 'var(--surface)',
        color: justSynced ? 'var(--status-on-target)' : 'var(--ink-muted)',
        fontSize: 12.5,
        fontWeight: 700,
        cursor: syncing ? 'default' : 'pointer',
        opacity: syncing ? 0.7 : 1,
        whiteSpace: 'nowrap',
      }}
    >
      <span style={{ display: 'flex', animation: syncing ? 'shepherd-spin 0.9s linear infinite' : 'none' }}>
        <RefreshIcon size={13} />
      </span>
      {syncing ? 'Syncing...' : justSynced ? 'Synced ✓' : 'Sync'}
    </button>
  )
}
