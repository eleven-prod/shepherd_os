import { supabase } from './supabaseClient'
import { UNREPORTED_MONTHS, MONTHS } from './periods'

// Metrics with "flow" behavior (a real count per month — sum across the
// selected period) vs "average" behavior (attendance — average across
// the period, since it's an average headcount, not a running total) vs
// "stock" behavior (membership/life groups — a snapshot, so we take the
// most recent reported month's value rather than summing or averaging).
const METRIC_SPECS = {
  attendance: { section: 'sunday_attendance', subsection: null, label: 'Total Membership', mode: 'average' },
  firstTimers: { section: 'first_timers', subsection: null, label: 'Total Membership', mode: 'sum' },
  membership: { section: 'category1_membership', subsection: null, label: 'Total Membership', mode: 'stock' },
  activeMembership: { section: 'category2_membership', subsection: null, label: 'Total Membership', mode: 'stock' },
  totalWorkers: { section: 'workers', subsection: null, label: 'Total Workers', mode: 'stock' },
  tithes: { section: 'finances', subsection: null, label: 'Tithes', mode: 'sum' },
  offerings: { section: 'finances', subsection: null, label: 'Offerings', mode: 'sum' },
  missionOffering: { section: 'finances', subsection: null, label: 'Mission Offering', mode: 'sum' },
  pledges: { section: 'finances', subsection: null, label: 'Pledges', mode: 'sum' },
  totalGiving: { section: 'finances', subsection: null, label: 'Total Tithes & Offering', mode: 'sum' },
  numberOfTithers: { section: 'finances', subsection: null, label: 'No. of  Monthly Tithers', mode: 'average' },
  lifeGroupMembership: { section: 'life_group_ministry', subsection: 'lg_membership', label: 'Total No. Of Life Group Membership', mode: 'stock' },
}

function aggregate(monthValues, mode, selectedMonths) {
  const reportedInSelection = monthValues.filter((r) => selectedMonths.includes(r.month) && !UNREPORTED_MONTHS.has(r.month))
  if (reportedInSelection.length === 0) return 0

  if (mode === 'sum') {
    return reportedInSelection.reduce((s, r) => s + Number(r.value), 0)
  }
  if (mode === 'average') {
    const sum = reportedInSelection.reduce((s, r) => s + Number(r.value), 0)
    return sum / reportedInSelection.length
  }
  // 'stock' — most recent reported month within the selection.
  const sorted = [...reportedInSelection].sort((a, b) => (a.month < b.month ? 1 : -1))
  return Number(sorted[0].value)
}

function computeMetricsForArea(metricsForThisArea, valueRows, selectedMonths) {
  const result = {}
  for (const [key, spec] of Object.entries(METRIC_SPECS)) {
    const metric = metricsForThisArea.find((m) => m.section === spec.section && (m.subsection ?? null) === spec.subsection && m.label === spec.label)
    if (!metric) {
      result[key] = { actual: 0, target: 0 }
      continue
    }
    const monthsForMetric = valueRows.filter((v) => v.metric_id === metric.id)
    const actual = aggregate(monthsForMetric, spec.mode, selectedMonths)

    // Prorate the annual PYA target to match the selected period's length
    // for sum-mode metrics (a fair "pace toward the annual goal"), but not
    // for average-mode (attendance) or stock-mode (membership) metrics,
    // where the raw PYA is already the right comparison basis regardless
    // of how many months are selected.
    let target = Number(metric.pya) || 0
    if (spec.mode === 'sum') {
      target = (target / 12) * selectedMonths.filter((m) => !UNREPORTED_MONTHS.has(m)).length
    }
    result[key] = { actual, target }
  }
  return result
}

/**
 * Fetches real figures for exactly the given months, for the church-wide
 * TOTAL area AND each real operational area (Sta. Rita / Lumambayan /
 * Buli / Inclanay), aggregated appropriately per metric (sum/average/
 * stock — see METRIC_SPECS). Returns { total: {...}, byArea: [...] }.
 *
 * This queries the full monthly time series in por_metrics/
 * por_monthly_values (the original Excel import), not the single-
 * snapshot tables (org_stats, life_groups, etc.) the Admin Console edits.
 */
export async function fetchPeriodMetrics(selectedMonths) {
  if (!supabase) {
    throw new Error('Supabase is not configured yet — see .env.example.')
  }

  const { data: areaRows, error: areaErr } = await supabase.from('por_areas').select('id, name, barangay_name, is_extension_church')
  if (areaErr) throw new Error(`Failed to load areas: ${areaErr.message}`)

  const totalArea = areaRows.find((a) => a.name === 'TOTAL')
  const realAreas = areaRows.filter((a) => a.name !== 'TOTAL').sort((a, b) => a.name.localeCompare(b.name))
  if (!totalArea) throw new Error('Could not find the TOTAL area in por_areas.')

  const { data: metricsRows, error: metricsErr } = await supabase
    .from('por_metrics')
    .select('id, area_id, section, subsection, label, pya')
    .in(
      'area_id',
      areaRows.map((a) => a.id),
    )
  if (metricsErr) throw new Error(`Failed to load metrics: ${metricsErr.message}`)

  const neededMetricIds = metricsRows
    .filter((m) => Object.values(METRIC_SPECS).some((spec) => spec.section === m.section && (spec.subsection ?? null) === (m.subsection ?? null) && spec.label === m.label))
    .map((m) => m.id)

  const { data: valueRows, error: valuesErr } = await supabase.from('por_monthly_values').select('metric_id, month, value').in('metric_id', neededMetricIds)
  if (valuesErr) throw new Error(`Failed to load monthly values: ${valuesErr.message}`)

  const total = computeMetricsForArea(
    metricsRows.filter((m) => m.area_id === totalArea.id),
    valueRows,
    selectedMonths,
  )

  const byArea = realAreas.map((area) => ({
    areaName: area.barangay_name || area.name,
    isMainChurch: area.name === 'Sta Rita', // matched against add_main_church.sql's flag on barangays; por_areas itself has no main-church flag
    ...computeMetricsForArea(
      metricsRows.filter((m) => m.area_id === area.id),
      valueRows,
      selectedMonths,
    ),
  }))

  return { total, byArea }
}

// The church-wide TOTAL area's real, closed FY2025-26 totals per metric,
// computed once from the now-real 12 months of por_monthly_values (the
// original Excel import for Sep–Jul, plus the August 2026 backfill from
// Data Entry — see periods.js's UNREPORTED_MONTHS note). Used as the
// flat PYA reference line on the live FY2026-27 trend charts below, in
// place of the old Excel-import PYA figure — a real "Previous Year
// Accomplishment" now that FY2025-26 is a real closed year, not an
// estimate. Static rather than computed on every call since FY2025-26
// won't change again.
const FY2025_26_PYA = {
  attendance: 267.22222222222223,
  firstTimers: 358,
  membership: 917,
  activeMembership: 781,
  totalWorkers: 176,
  tithes: 1646585,
  offerings: 205849,
  missionOffering: 35356,
  pledges: 33252,
  totalGiving: 1852434,
  numberOfTithers: 253.1833333333333,
  lifeGroupMembership: 756,
}

// The real church names as they're keyed in weekly_entries.area_name —
// deliberately separate from por_areas' barangay_name spellings (mostly
// identical, but not guaranteed), since this reads Data Entry's own
// table directly rather than the POR import.
const REAL_AREAS = [
  { areaName: 'Sta. Rita', isMainChurch: true },
  { areaName: 'Buli', isMainChurch: false },
  { areaName: 'Inclanay', isMainChurch: false },
  { areaName: 'Lumambayan', isMainChurch: false },
]

const FLOW_FIELD_KEYS = {
  attendance: ['attendanceMen', 'attendanceWomen', 'attendanceYoungAdult', 'attendanceKKB', 'attendanceChildren'],
  firstTimers: ['firstTimersMen', 'firstTimersWomen', 'firstTimersYoungAdult', 'firstTimersKKB', 'firstTimersChildren'],
  tithes: ['tithes'],
  offerings: ['offerings'],
  missionOffering: ['missionOffering'],
  pledges: ['pledges'],
  numberOfTithers: ['numberOfTithers'],
}

function monthRangeStrs(monthStart) {
  const start = new Date(monthStart)
  const end = new Date(start.getFullYear(), start.getMonth() + 1, 1)
  const fmt = (d) => d.toISOString().slice(0, 10)
  return { startStr: fmt(start), endStr: fmt(end) }
}

// Sundays in the same calendar month — same convention as api.js's own
// sundayCountInMonth, duplicated here to avoid a cross-module import for
// one small date helper (matches this codebase's existing pattern of
// small constants/helpers repeated per file rather than centralized).
function sundayCountInMonth(monthStart) {
  const start = new Date(monthStart)
  const d = new Date(start.getFullYear(), start.getMonth(), 1)
  let count = 0
  while (d.getMonth() === start.getMonth()) {
    if (d.getDay() === 0) count++
    d.setDate(d.getDate() + 1)
  }
  return count
}

/**
 * Computes one month's real live figures for one area from weekly_entries
 * — the same Data Entry source of truth Live/Current mode reads
 * everywhere else — for every flow/average metric. Returns null fields
 * with reported:false when nothing has been entered for that area/month
 * yet (e.g. the church hasn't started the new year's Data Entry), so the
 * caller can show "no data yet" instead of a fabricated zero.
 */
async function computeLiveMonthForArea(areaName, monthKey) {
  const { startStr, endStr } = monthRangeStrs(monthKey)
  const { data: rows, error } = await supabase
    .from('weekly_entries')
    .select('field_key, value')
    .eq('area_name', areaName)
    .gte('week_start', startStr)
    .lt('week_start', endStr)
  if (error) throw new Error(error.message)

  if (rows.length === 0) {
    return { reported: false }
  }

  const sumOf = (keys) => rows.filter((r) => keys.includes(r.field_key)).reduce((s, r) => s + Number(r.value), 0)
  const weeks = sundayCountInMonth(monthKey)

  const attendanceRaw = sumOf(FLOW_FIELD_KEYS.attendance)
  const numberOfTithersRaw = sumOf(FLOW_FIELD_KEYS.numberOfTithers)
  const tithes = sumOf(FLOW_FIELD_KEYS.tithes)
  const offerings = sumOf(FLOW_FIELD_KEYS.offerings)

  return {
    reported: true,
    attendance: weeks > 0 ? attendanceRaw / weeks : 0,
    firstTimers: sumOf(FLOW_FIELD_KEYS.firstTimers),
    tithes,
    offerings,
    missionOffering: sumOf(FLOW_FIELD_KEYS.missionOffering),
    pledges: sumOf(FLOW_FIELD_KEYS.pledges),
    totalGiving: tithes + offerings,
    numberOfTithers: weeks > 0 ? numberOfTithersRaw / weeks : 0,
  }
}

/**
 * Live, current-fiscal-year replacement for the months this app hasn't
 * closed out yet — Sep 2026 onward. Unlike fetchMonthlySeries (the
 * frozen FY2025-26 import), this reads weekly_entries directly, one
 * real month at a time, so a month with nothing entered yet shows as
 * "no data yet" instead of silently missing or (worse) reading as a
 * real zero. Stock metrics (Membership, Workers, Life Group headcount)
 * have no monthly history of their own in Data Entry — those are
 * reported as today's current live figure, flat across every month so
 * far, rather than invented per-month values.
 */
async function fetchCurrentFiscalYearSeries(monthsSoFar, stockNow) {
  const monthLabel = (m) => new Date(m + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
  const FLOW_KEYS = Object.keys(FLOW_FIELD_KEYS).concat(['totalGiving'])
  const STOCK_KEYS = ['membership', 'activeMembership', 'totalWorkers', 'lifeGroupMembership']

  function stockSeries() {
    const result = {}
    for (const key of STOCK_KEYS) {
      result[key] = {
        pya: FY2025_26_PYA[key] ?? 0,
        months: monthsSoFar.map((m) => ({ label: monthLabel(m), value: stockNow[key] ?? 0, unreported: false })),
      }
    }
    return result
  }

  async function seriesForArea(areaName) {
    const perMonth = await Promise.all(monthsSoFar.map((m) => computeLiveMonthForArea(areaName, m)))
    const result = { ...stockSeries() }
    for (const key of FLOW_KEYS) {
      result[key] = {
        pya: FY2025_26_PYA[key] ?? 0,
        months: monthsSoFar.map((m, i) => ({
          label: monthLabel(m),
          value: perMonth[i].reported ? perMonth[i][key] : 0,
          unreported: !perMonth[i].reported,
        })),
      }
    }
    return result
  }

  // Church-wide is the sum (flow/average metrics) of the 4 real areas —
  // there's no "TOTAL" church in Data Entry to read directly.
  const byArea = await Promise.all(
    REAL_AREAS.map(async (a) => ({
      areaName: a.areaName,
      isMainChurch: a.isMainChurch,
      ...(await seriesForArea(a.areaName)),
    })),
  )

  const total = { ...stockSeries() }
  for (const key of FLOW_KEYS) {
    total[key] = {
      pya: FY2025_26_PYA[key] ?? 0,
      months: monthsSoFar.map((m, i) => {
        const areaMonths = byArea.map((a) => a[key].months[i])
        const anyReported = areaMonths.some((am) => !am.unreported)
        // Attendance/Number of Tithers are already averaged per area
        // (raw weekly sum ÷ Sundays in the month) — since every area
        // shares the same calendar month, summing those averages is
        // the same as summing the raw totals and dividing once, so no
        // separate weeks-based math is needed here.
        const value = areaMonths.reduce((s, am) => s + am.value, 0)
        return { label: monthLabel(m), value: anyReported ? value : 0, unreported: !anyReported }
      }),
    }
  }

  return { total, byArea }
}

function seriesForRows(metricsForThisArea, valueRows) {
  const monthLabel = (m) => new Date(m + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
  const result = {}
  for (const [key, spec] of Object.entries(METRIC_SPECS)) {
    const metric = metricsForThisArea.find((m) => m.section === spec.section && (m.subsection ?? null) === spec.subsection && m.label === spec.label)
    if (!metric) {
      result[key] = { pya: 0, months: [] }
      continue
    }
    const rows = valueRows.filter((v) => v.metric_id === metric.id).sort((a, b) => (a.month < b.month ? -1 : 1))
    result[key] = {
      pya: Number(metric.pya) || 0,
      months: rows.map((r) => ({
        label: monthLabel(r.month),
        value: Number(r.value),
        unreported: UNREPORTED_MONTHS.has(r.month),
      })),
    }
  }
  return result
}

// The first day of the current (still-open) fiscal year — everything
// from here on has no frozen POR import to read, so it's computed live
// from weekly_entries instead (see fetchCurrentFiscalYearSeries above).
// Update this the next time a fiscal year closes and gets its own real
// backfill, the same way August 2026 was handled this year.
const CURRENT_FISCAL_YEAR_START = '2026-09-01'

function monthsSoFarInCurrentFiscalYear() {
  const now = new Date()
  const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
  return MONTHS.filter((m) => m.key >= CURRENT_FISCAL_YEAR_START && m.key <= todayKey).map((m) => m.key)
}

async function fetchStockNow() {
  const [{ data: org, error: orgErr }, { data: areaWorkers, error: workersErr }, { data: lifeGroups, error: lgErr }] = await Promise.all([
    supabase.from('org_stats').select('total_members, active_members').eq('id', 1).single(),
    supabase.from('area_people_stats').select('total_workers'),
    supabase.from('life_groups').select('actual_headcount'),
  ])
  if (orgErr) throw new Error(orgErr.message)
  if (workersErr) throw new Error(workersErr.message)
  if (lgErr) throw new Error(lgErr.message)
  return {
    membership: Number(org.total_members) || 0,
    activeMembership: Number(org.active_members) || 0,
    totalWorkers: areaWorkers.reduce((s, a) => s + Number(a.total_workers), 0),
    lifeGroupMembership: lifeGroups.reduce((s, g) => s + Number(g.actual_headcount), 0),
  }
}

/**
 * Fetches the full 12-month raw series (Sep–Aug, unaggregated) plus PYA
 * for each tracked metric, for the church-wide TOTAL area AND each real
 * operational area — used for the "PYA + monthly trend" bar charts on
 * Reports and Membership. Returns { total: {...}, byArea: [...] }, same
 * shape as fetchPeriodMetrics.
 *
 * Once the current fiscal year has begun (see CURRENT_FISCAL_YEAR_START),
 * this switches to fetchCurrentFiscalYearSeries — a live read of Data
 * Entry's weekly_entries for the months that have actually happened so
 * far this year, with the closed FY2025-26 year's real totals carried
 * over as the flat PYA reference line — instead of the frozen POR
 * import, which has no rows at all past August 2026 and never will.
 */
export async function fetchMonthlySeries() {
  if (!supabase) {
    throw new Error('Supabase is not configured yet — see .env.example.')
  }

  const monthsSoFar = monthsSoFarInCurrentFiscalYear()
  if (monthsSoFar.length > 0) {
    const stockNow = await fetchStockNow()
    return fetchCurrentFiscalYearSeries(monthsSoFar, stockNow)
  }

  const { data: areaRows, error: areaErr } = await supabase.from('por_areas').select('id, name, barangay_name, is_extension_church')
  if (areaErr) throw new Error(`Failed to load areas: ${areaErr.message}`)

  const totalArea = areaRows.find((a) => a.name === 'TOTAL')
  const realAreas = areaRows.filter((a) => a.name !== 'TOTAL').sort((a, b) => a.name.localeCompare(b.name))
  if (!totalArea) throw new Error('Could not find the TOTAL area in por_areas.')

  const { data: metricsRows, error: metricsErr } = await supabase
    .from('por_metrics')
    .select('id, area_id, section, subsection, label, pya')
    .in(
      'area_id',
      areaRows.map((a) => a.id),
    )
  if (metricsErr) throw new Error(`Failed to load metrics: ${metricsErr.message}`)

  const neededMetricIds = metricsRows
    .filter((m) => Object.values(METRIC_SPECS).some((spec) => spec.section === m.section && (spec.subsection ?? null) === (m.subsection ?? null) && spec.label === m.label))
    .map((m) => m.id)

  const { data: valueRows, error: valuesErr } = await supabase.from('por_monthly_values').select('metric_id, month, value').in('metric_id', neededMetricIds)
  if (valuesErr) throw new Error(`Failed to load monthly values: ${valuesErr.message}`)

  const total = seriesForRows(
    metricsRows.filter((m) => m.area_id === totalArea.id),
    valueRows,
  )

  const byArea = realAreas.map((area) => ({
    areaName: area.barangay_name || area.name,
    isMainChurch: area.name === 'Sta Rita',
    ...seriesForRows(
      metricsRows.filter((m) => m.area_id === area.id),
      valueRows,
    ),
  }))

  return { total, byArea }
}
