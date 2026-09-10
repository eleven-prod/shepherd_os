// Shepherd OS covers a fiscal year Sep 2025 – Aug 2026 (matching the
// source POR report), not a calendar year — quarters are defined
// relative to that.

export const MONTHS = [
  { key: '2025-09-01', label: 'September 2025' },
  { key: '2025-10-01', label: 'October 2025' },
  { key: '2025-11-01', label: 'November 2025' },
  { key: '2025-12-01', label: 'December 2025' },
  { key: '2026-01-01', label: 'January 2026' },
  { key: '2026-02-01', label: 'February 2026' },
  { key: '2026-03-01', label: 'March 2026' },
  { key: '2026-04-01', label: 'April 2026' },
  { key: '2026-05-01', label: 'May 2026' },
  { key: '2026-06-01', label: 'June 2026' },
  { key: '2026-07-01', label: 'July 2026' },
  { key: '2026-08-01', label: 'August 2026' },
]

// August wasn't yet reported when the original Excel import was
// compiled, so it was flagged here to keep placeholder zeros out of
// Historical mode. Real August figures have since been backfilled into
// por_monthly_values: Attendance, First Timers, Number of Tithers, and
// Finances from actual Data Entry weekly submissions; Workers and Life
// Group headcount (church-wide and per area) from the current
// Admin-Console figures (a fair stand-in, since those rarely move
// month to month); Category 1/2 Membership church-wide only, from the
// PYA reference (917/781) — no source exists yet for a per-area
// Category 1/2 split, so those 8 rows are still 0 for August. If that
// starts looking wrong in the By Area Membership table, it needs a
// real per-area figure supplied, not a code fix.
export const UNREPORTED_MONTHS = new Set([])

export const QUARTERS = [
  { key: 'Q1', label: 'Q1: Sep–Nov 2025', months: ['2025-09-01', '2025-10-01', '2025-11-01'] },
  { key: 'Q2', label: 'Q2: Dec 2025–Feb 2026', months: ['2025-12-01', '2026-01-01', '2026-02-01'] },
  { key: 'Q3', label: 'Q3: Mar–May 2026', months: ['2026-03-01', '2026-04-01', '2026-05-01'] },
  { key: 'Q4', label: 'Q4: Jun–Aug 2026', months: ['2026-06-01', '2026-07-01', '2026-08-01'] },
]

export const ANNUAL = { key: 'FY2025-26', label: 'Full Year: Sep 2025 – Aug 2026', months: MONTHS.map((m) => m.key) }

// Monthly/Quarterly used to be reachable here too — restored, but see
// PeriodContext's `granularities` (role-gated to admins only for now):
// everyone else still only ever sees ['Annual'], same as before.
export const GRANULARITIES = ['Annual', 'Quarterly', 'Monthly']

/** Returns the list of {key,label,months} options for a given granularity. */
export function optionsFor(granularity) {
  if (granularity === 'Monthly') return MONTHS.map((m) => ({ ...m, months: [m.key] }))
  if (granularity === 'Quarterly') return QUARTERS
  return [ANNUAL]
}

/** A sensible default: the most recently REPORTED month (skips August). */
export function defaultMonthlyKey() {
  const reported = MONTHS.filter((m) => !UNREPORTED_MONTHS.has(m.key))
  return reported[reported.length - 1].key
}
