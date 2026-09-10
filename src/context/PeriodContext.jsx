import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { GRANULARITIES, optionsFor, ANNUAL } from '../data/periods'
import { fetchPeriodMetrics, fetchMonthlySeries } from '../data/periodApi'
import { useAuth } from './AuthContext'

const PeriodContext = createContext(null)

// Kept in sync with DataEntry.jsx's own ADMIN_ROLES — not shared from
// there to avoid pulling a whole screen file into a context module.
const ADMIN_ROLES = ['admin', 'pastor_mis']

export function PeriodProvider({ children }) {
  const { role } = useAuth()
  // Monthly/Quarterly granularity (drilling into a specific past
  // period) is admin-only for now — everyone else still only ever sees
  // the single full-year Annual option, same as before this was
  // restored.
  const granularities = ADMIN_ROLES.includes(role) ? GRANULARITIES : ['Annual']

  const [granularity, setGranularityState] = useState('Annual')
  const [selectedKey, setSelectedKey] = useState(ANNUAL.key)
  const [metrics, setMetrics] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // The "PYA + monthly trend" bar charts always show the full year
  // regardless of the selected period, so this is fetched once on mount
  // rather than refetching every time the period selector changes.
  const [monthlySeries, setMonthlySeries] = useState(null)
  const [monthlySeriesLoading, setMonthlySeriesLoading] = useState(true)
  const [monthlySeriesError, setMonthlySeriesError] = useState(null)

  // Defensive clamp: if the role's allowed granularities no longer
  // include whatever's in state (e.g. an admin's role changes mid-
  // session), fall back to Annual rather than showing options for a
  // granularity this user shouldn't have.
  const effectiveGranularity = granularities.includes(granularity) ? granularity : 'Annual'
  const options = useMemo(() => optionsFor(effectiveGranularity), [effectiveGranularity])
  const selected = useMemo(() => options.find((o) => o.key === selectedKey) || options[0], [options, selectedKey])

  const setGranularity = useCallback((g) => {
    setGranularityState(g)
    const opts = optionsFor(g)
    setSelectedKey(opts[opts.length - 1].key) // default to the most recent period in that granularity
  }, [])

  // Sets granularity + key together in one go (used by the Apply button in
  // PeriodSelector) — React batches these into a single re-render inside
  // an event handler, so the fetch effect below only fires once instead
  // of twice (once for the granularity change, once for the key change).
  const applyPeriod = useCallback((g, key) => {
    setGranularityState(g)
    setSelectedKey(key)
  }, [])

  const load = useCallback(async (months) => {
    setLoading(true)
    setError(null)
    try {
      const result = await fetchPeriodMetrics(months)
      setMetrics(result)
    } catch (err) {
      console.error(err)
      setError(err.message || 'Could not load data for this period.')
    } finally {
      setLoading(false)
    }
  }, [])

  const loadMonthlySeries = useCallback(async () => {
    setMonthlySeriesLoading(true)
    setMonthlySeriesError(null)
    try {
      const result = await fetchMonthlySeries()
      setMonthlySeries(result)
    } catch (err) {
      console.error(err)
      setMonthlySeriesError(err.message || 'Could not load the monthly trend.')
    } finally {
      setMonthlySeriesLoading(false)
    }
  }, [])

  useEffect(() => {
    if (selected) load(selected.months)
  }, [selected, load])

  useEffect(() => {
    loadMonthlySeries()
  }, [loadMonthlySeries])

  const value = {
    granularity: effectiveGranularity,
    setGranularity,
    applyPeriod,
    granularities,
    options,
    selectedKey,
    setSelectedKey,
    selected,
    metrics,
    loading,
    error,
    refetch: () => selected && load(selected.months),
    monthlySeries,
    monthlySeriesLoading,
    monthlySeriesError,
    refetchMonthlySeries: loadMonthlySeries,
  }

  return <PeriodContext.Provider value={value}>{children}</PeriodContext.Provider>
}

export function usePeriod() {
  const ctx = useContext(PeriodContext)
  if (!ctx) throw new Error('usePeriod must be used within a PeriodProvider')
  return ctx
}
