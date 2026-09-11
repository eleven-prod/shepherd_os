import { CalendarIcon } from './Icons'
import { useState } from 'react'
import { usePeriod } from '../context/PeriodContext'
import { optionsFor } from '../data/periods'
import PercentLoader from './PercentLoader'

/** Top-right date range control. Changes are staged locally and only take
 * effect (triggering a real data fetch) when Apply is clicked — Cancel
 * discards them. This avoids re-fetching on every single dropdown click
 * while the user is still deciding what they want. */
export default function PeriodSelector() {
  const { granularity, applyPeriod, granularities, selectedKey, selected, loading } = usePeriod()
  const [open, setOpen] = useState(false)
  const [localGranularity, setLocalGranularity] = useState(granularity)
  const [localKey, setLocalKey] = useState(selectedKey)

  // Re-sync the staged (local) selection to whatever's actually applied
  // whenever the popover opens, so it doesn't show stale picks from a
  // previously-cancelled attempt.
  function openPopover() {
    setLocalGranularity(granularity)
    setLocalKey(selectedKey)
    setOpen(true)
  }

  const localOptions = optionsFor(localGranularity)

  function handleLocalGranularityChange(g) {
    setLocalGranularity(g)
    const opts = optionsFor(g)
    setLocalKey(opts[opts.length - 1].key) // default to most recent within the newly chosen granularity
  }

  function handleApply() {
    applyPeriod(localGranularity, localKey)
    setOpen(false)
  }

  function handleCancel() {
    setLocalGranularity(granularity)
    setLocalKey(selectedKey)
    setOpen(false)
  }

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => (open ? handleCancel() : openPopover())}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '9px 14px',
          borderRadius: 10,
          border: '1px solid var(--line)',
          background: 'var(--surface)',
          fontSize: 13,
          fontWeight: 700,
          color: 'var(--ink)',
          cursor: 'pointer',
        }}
      >
        {loading ? (
          // No countable sub-steps for a single period fetch, so this is
          // a simulated percent — it eases toward 90% while the request
          // is in flight and completes to 100% the instant it resolves.
          <PercentLoader active width={64} height={5} />
        ) : (
          <>
            <span style={{ fontSize: 14, display: 'flex' }}>
              <CalendarIcon size={14} />
            </span>
            {selected?.label}
          </>
        )}
        <span style={{ fontSize: 9, color: 'var(--ink-faint)' }}>{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <>
          {/* Invisible backdrop — clicking outside the popover cancels, same as clicking Cancel. */}
          <div style={{ position: 'fixed', inset: 0, zIndex: 999 }} onClick={handleCancel} />
          <div
            style={{
              position: 'absolute',
              top: 'calc(100% + 8px)',
              right: 0,
              zIndex: 1000,
              background: 'var(--surface)',
              border: '1px solid var(--line)',
              borderRadius: 12,
              padding: 16,
              width: 260,
              // Same right-anchored-popover overflow risk as NotificationBell —
              // cap width to the viewport on narrow phones so it can't push
              // past the screen edge and get clipped.
              maxWidth: 'calc(100vw - 32px)',
              boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {granularities.length > 1 && (
              <>
                <div className="label" style={{ marginBottom: 6 }}>
                  Granularity
                </div>
                <select value={localGranularity} onChange={(e) => handleLocalGranularityChange(e.target.value)} style={selectStyle}>
                  {granularities.map((g) => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
                </select>
              </>
            )}

            <div className="label" style={{ margin: granularities.length > 1 ? '14px 0 6px' : '0 0 6px' }}>
              Period
            </div>
            <select value={localKey} onChange={(e) => setLocalKey(e.target.value)} style={selectStyle}>
              {localOptions.map((o) => (
                <option key={o.key} value={o.key}>
                  {o.label}
                </option>
              ))}
            </select>

            <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
              <button onClick={handleCancel} style={{ ...actionButtonStyle, background: 'var(--surface-muted)', color: 'var(--ink)' }}>
                Cancel
              </button>
              <button onClick={handleApply} style={{ ...actionButtonStyle, background: 'var(--primary)', color: 'white' }}>
                Apply
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

const selectStyle = {
  width: '100%',
  padding: '9px 10px',
  borderRadius: 8,
  border: '1px solid var(--line)',
  background: 'var(--surface-muted)',
  fontSize: 13,
  fontFamily: 'inherit',
  color: 'var(--ink)',
}

const actionButtonStyle = {
  flex: 1,
  padding: '10px 0',
  borderRadius: 8,
  border: 'none',
  fontWeight: 700,
  fontSize: 13,
  cursor: 'pointer',
}
