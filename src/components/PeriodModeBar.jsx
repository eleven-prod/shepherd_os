import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { usePeriod } from '../context/PeriodContext'
import { isFullyUnreported } from '../data/periods'
import ModeToggle from './ModeToggle'
import PeriodSelector from './PeriodSelector'

// Kept in sync with DataEntry.jsx's own ADMIN_ROLES — not shared from
// there to avoid pulling a whole screen file into a shared component.
const ADMIN_ROLES = ['admin', 'pastor_mis']

/**
 * Admin-only Current/Historical switcher for screens that show a live
 * "This Month" snapshot (Financial, Life Groups, People & Growth) but
 * could also show a chosen past period's real figures from the POR
 * import (the same data Reports already uses). Non-admins never see
 * this bar — the screen behaves exactly as it did before this existed.
 *
 * Returns:
 *  - bar: the toggle + period selector JSX to render near the top of
 *    the screen (renders nothing for non-admins)
 *  - isHistorical: true only when an admin has actually switched to
 *    Historical mode — screens gate their data-swap on this
 *  - metrics/loading/error/selected: passed straight through from
 *    usePeriod() so a screen doesn't need to call it separately too
 *  - noDataYet: true when the selected period (e.g. a new church year
 *    that just started) has nothing reported for ANY of its months —
 *    screens should show a clean "no data yet" state instead of
 *    swapping in metrics that would just be zeros
 */
export function usePeriodMode() {
  const { role } = useAuth()
  const isAdmin = ADMIN_ROLES.includes(role)
  const [mode, setMode] = useState('Current')
  const isHistorical = isAdmin && mode === 'Historical'
  const { metrics, loading, error, refetch, selected, monthlySeries, liveMonthlySeries } = usePeriod()
  const noDataYet = isHistorical && !!selected && isFullyUnreported(selected.months)
  // The trend charts shown alongside "This Month" should follow the
  // same swap as everything else here: the live, current-fiscal-year
  // series normally, or the selected past period's own series once
  // Historical mode is on — never a mix of the two.
  const chartSeries = isHistorical ? monthlySeries : liveMonthlySeries

  const bar = isAdmin ? (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
      <ModeToggle mode={mode} onChange={setMode} />
      {mode === 'Historical' && <PeriodSelector />}
      {mode === 'Historical' && (
        <span className="caption" style={{ flexBasis: '100%' }}>
          {noDataYet
            ? `Nothing reported for ${selected?.label} yet.`
            : `Showing real figures for ${selected?.label} from the original POR data — not live Data Entry numbers.`}
        </span>
      )}
    </div>
  ) : null

  return { bar, isHistorical, metrics, loading, error, refetch, selected, monthlySeries, chartSeries, noDataYet }
}
