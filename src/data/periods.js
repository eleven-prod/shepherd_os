// Shepherd OS tracks church fiscal years (Sep–Aug, matching the source
// POR report), not calendar years — quarters are defined relative to
// that. FY2025-26 (Sep 2025–Aug 2026) is the one real, reported year so
// far, backed by the original Excel import plus the August 2026
// backfill from Data Entry (see the note on UNREPORTED_MONTHS below).
// FY2026-27 (Sep 2026–Aug 2027) is the new church year that just
// started — it's listed here so admins can select it in the period
// selector, but every one of its months is flagged unreported (below)
// until real figures exist for them, so Historical mode shows a clean
// "no data yet" rather than fabricated zeros.

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
  { key: '2026-09-01', label: 'September 2026' },
  { key: '2026-10-01', label: 'October 2026' },
  { key: '2026-11-01', label: 'November 2026' },
  { key: '2026-12-01', label: 'December 2026' },
  { key: '2027-01-01', label: 'January 2027' },
  { key: '2027-02-01', label: 'February 2027' },
  { key: '2027-03-01', label: 'March 2027' },
  { key: '2027-04-01', label: 'April 2027' },
  { key: '2027-05-01', label: 'May 2027' },
  { key: '2027-06-01', label: 'June 2027' },
  { key: '2027-07-01', label: 'July 2027' },
  { key: '2027-08-01', label: 'August 2027' },
]

// August 2026 wasn't yet reported when the original Excel import was
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
//
// FY2026-27 (Sep 2026 onward) is the new church year — nothing has
// been reported for it yet, so every one of its months stays flagged
// unreported until it's backfilled the same way August was, one real
// month at a time as the year actually happens.
export const UNREPORTED_MONTHS = new Set(['2026-09-01', '2026-10-01', '2026-11-01', '2026-12-01', '2027-01-01', '2027-02-01', '2027-03-01', '2027-04-01', '2027-05-01', '2027-06-01', '2027-07-01', '2027-08-01'])

export const QUARTERS = [
  { key: 'FY25-26-Q1', label: 'Q1: Sep–Nov 2025', months: ['2025-09-01', '2025-10-01', '2025-11-01'] },
  { key: 'FY25-26-Q2', label: 'Q2: Dec 2025–Feb 2026', months: ['2025-12-01', '2026-01-01', '2026-02-01'] },
  { key: 'FY25-26-Q3', label: 'Q3: Mar–May 2026', months: ['2026-03-01', '2026-04-01', '2026-05-01'] },
  { key: 'FY25-26-Q4', label: 'Q4: Jun–Aug 2026', months: ['2026-06-01', '2026-07-01', '2026-08-01'] },
  { key: 'FY26-27-Q1', label: 'Q1: Sep–Nov 2026', months: ['2026-09-01', '2026-10-01', '2026-11-01'] },
  { key: 'FY26-27-Q2', label: 'Q2: Dec 2026–Feb 2027', months: ['2026-12-01', '2027-01-01', '2027-02-01'] },
  { key: 'FY26-27-Q3', label: 'Q3: Mar–May 2027', months: ['2027-03-01', '2027-04-01', '2027-05-01'] },
  { key: 'FY26-27-Q4', label: 'Q4: Jun–Aug 2027', months: ['2027-06-01', '2027-07-01', '2027-08-01'] },
]

// One full-year option per fiscal year — FY2025-26 is the closed,
// reported year; FY2026-27 is the one just starting, offered so it's
// selectable but entirely unreported (via UNREPORTED_MONTHS above)
// until real months get backfilled into it.
export const ANNUAL_OPTIONS = [
  { key: 'FY2025-26', label: 'Full Year: Sep 2025 – Aug 2026', months: MONTHS.slice(0, 12).map((m) => m.key) },
  { key: 'FY2026-27', label: 'Full Year: Sep 2026 – Aug 2027', months: MONTHS.slice(12, 24).map((m) => m.key) },
]

// Kept as the single most-recently-closed year, for any existing code
// that still wants "the" annual period rather than a list of them.
export const ANNUAL = ANNUAL_OPTIONS[0]

// Monthly/Quarterly used to be reachable here too — restored, but see
// PeriodContext's `granularities` (role-gated to admins only for now):
// everyone else still only ever sees ['Annual'], same as before.
export const GRANULARITIES = ['Annual', 'Quarterly', 'Monthly']

/** Returns the list of {key,label,months} options for a given granularity. */
export function optionsFor(granularity) {
  if (granularity === 'Monthly') return MONTHS.map((m) => ({ ...m, months: [m.key] }))
  if (granularity === 'Quarterly') return QUARTERS
  return ANNUAL_OPTIONS
}

/** A sensible default: the most recently REPORTED month (skips unreported months). */
export function defaultMonthlyKey() {
  const reported = MONTHS.filter((m) => !UNREPORTED_MONTHS.has(m.key))
  return reported[reported.length - 1].key
}

/**
 * True when EVERY month in a selected period is unreported — e.g. the
 * new church year before any of it has been backfilled. Distinguished
 * from a period that's only partly unreported (like a quarter with one
 * trailing month not yet in), which still has real figures worth
 * showing for the months that were reported.
 */
export function isFullyUnreported(months) {
  return months.length > 0 && months.every((m) => UNREPORTED_MONTHS.has(m))
}
