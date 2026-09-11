import { LockIcon } from '../components/Icons'
import { Fragment, forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import SectionHeader from '../components/SectionHeader'
import { sheetInputStyle } from '../components/FormSheet'
import PercentLoader from '../components/PercentLoader'
import { useAppData } from '../context/DataContext'
import { useAuth } from '../context/AuthContext'
import { fetchWeeklyEntries, upsertWeeklyEntry, recomputeMonthlyActual, fetchRecentSubmissions, subscribeToRecentSubmissions } from '../data/api'

// 2 categories get a full demographic breakdown (Men/Women/Young Adult/
// KKB/Children) instead of one flat number — each demographic is its
// own weekly-entry field (e.g. attendanceMen), and the category's own
// Total is auto-computed as the sum of its 5 demographics, both here
// for the current week and, via recomputeMonthlyActual, for the
// resulting monthly figure.
//
// Category 1/2 are deliberately NOT here — they're static membership
// counts (a snapshot), not a weekly flow metric like Attendance. Summing
// several weeks of "Category 1 Men" would incorrectly inflate what
// should be a single current count, unlike Attendance where multiple
// weeks legitimately do add up to a monthly total.
// Third element is a short label for the Weekly Progress table's
// per-category header row — that table already needs Field + up to 5
// week columns + Total, so the full names ("Worship Service
// Attendance", "WSA First Timers") were eating width that column
// values need. The entry form above it has plenty of room and keeps
// the full name (second element) for clarity.
const DEMOGRAPHIC_CATEGORIES = [
  ['attendance', 'Worship Service Attendance', 'WSA'],
  ['firstTimers', 'WSA First Timers', 'WSAFT'],
]
const DEMOGRAPHICS = [
  ['Men', 'Men'],
  ['Women', 'Women'],
  ['YoungAdult', 'Young Adult'],
  ['KKB', 'KKB'],
  ['Children', 'Children'],
]
const DEMOGRAPHIC_FIELD_KEYS = DEMOGRAPHIC_CATEGORIES.flatMap(([prefix]) => DEMOGRAPHICS.map(([dKey]) => `${prefix}${dKey}`))

// Everything else stays a single flat number, unchanged. Life Group
// Attendance/First Timers moved out to their own dedicated card below
// (LifeGroupCard) rather than being buried inside each general church
// card.
const SIMPLE_FIELDS = [
  ['numberOfTithers', 'Number of Tithers', 'people'],
  ['tithes', 'Tithes', 'financial'],
  ['offerings', 'Offering', 'financial'],
  ['pledges', 'Pledges', 'financial'],
  ['missionOffering', 'Mission', 'financial'],
  ['support', 'Support', 'financial'],
]
const ALL_FIELD_KEYS = [...DEMOGRAPHIC_FIELD_KEYS, ...SIMPLE_FIELDS.map(([key]) => key)]

const FIELD_LABELS = Object.fromEntries([
  ...DEMOGRAPHIC_CATEGORIES.flatMap(([prefix, label]) => DEMOGRAPHICS.map(([dKey, dLabel]) => [`${prefix}${dKey}`, `${label} — ${dLabel}`])),
  ...SIMPLE_FIELDS.map(([key, label]) => [key, label]),
])
const ADMIN_ROLES = ['admin', 'pastor_mis']

// Weekly Progress's Total column is a running sum across every week
// entered this month — meaningful for a flow metric (money given,
// attendance touches), but not for a headcount of DISTINCT people:
// summing "how many tithers this week" across 4 weeks doesn't give a
// real count of tithers for the month, it just adds the same returning
// people multiple times. Per request, WSA (all its demographic rows
// plus its category subtotal) and Number of Tithers show a dash in
// that column instead of a cumulative figure — the per-week values
// still show normally, only the monthly-sum column is suppressed.
const NO_CUMULATIVE_TOTAL_PREFIXES = new Set(['attendance'])
const NO_CUMULATIVE_TOTAL_KEYS = new Set(['numberOfTithers'])

// Shared boxed-section look for each category's own mini table/input
// group, in both the entry form and the Weekly Progress tables. Splitting
// what used to be one wide table (or one long flowing input list) into
// one bordered box per category (WSA, WSAFT, Financial; Life Group
// Attendance, Life Group First Timers, Number of Life Groups) makes each
// piece visually distinct, keeps each table narrow enough to rarely need
// its own horizontal scroll, and — since each box is just a normal block
// in a column — makes the whole card stack cleanly on mobile without any
// extra responsive logic of its own.
const CATEGORY_BOX_STYLE = {
  border: '1px solid var(--line)',
  borderRadius: 10,
  padding: '10px 12px',
}

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

function toDateStr(d) {
  return d.toISOString().slice(0, 10)
}

// Every Sunday in the given month — auto-computed and identical for
// every church, so "Week 1" always means the same real calendar date
// everywhere, instead of each Coordinator picking their own date and
// risking a mismatch between churches.
function sundaysInMonth(year, monthIndex) {
  const sundays = []
  const d = new Date(year, monthIndex, 1)
  while (d.getDay() !== 0) d.setDate(d.getDate() + 1)
  while (d.getMonth() === monthIndex) {
    sundays.push(toDateStr(d))
    d.setDate(d.getDate() + 7)
  }
  return sundays
}

// A week is still editable by a Coordinator through the day after it —
// matches the database's own deadline rule (lock_submitted_weeks.sql),
// so the UI shows the same lock state the database will actually
// enforce, rather than a UI that looks open but silently fails to save.
function isWithinDeadline(weekDateStr) {
  const deadline = new Date(weekDateStr + 'T00:00:00')
  deadline.setDate(deadline.getDate() + 1)
  deadline.setHours(23, 59, 59, 999)
  return new Date() <= deadline
}

function monthLabel(year, monthIndex) {
  return new Date(year, monthIndex, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

export default function DataEntry() {
  const { data } = useAppData()
  const { role } = useAuth()
  const isAdmin = ADMIN_ROLES.includes(role)
  const { areaPeopleStats } = data
  const churches = (areaPeopleStats || []).map((p) => ({ areaName: p.areaName, isMainChurch: p.isMainChurch }))

  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [monthIndex, setMonthIndex] = useState(today.getMonth())
  const weeks = sundaysInMonth(year, monthIndex)

  // Admin-only: browse any month back to when the app started tracking
  // data. Coordinators stay fixed on the current month — their workflow
  // is entering this week's numbers, not roaming through history.
  const YEAR_OPTIONS = []
  for (let y = today.getFullYear(); y >= 2025; y--) YEAR_OPTIONS.push(y)

  // Bumped by any card's own successful save — RecentSubmissions refetches
  // whenever this changes, so THIS tab's own save shows up immediately
  // without waiting on (or depending on) the realtime subscription.
  const [activityVersion, setActivityVersion] = useState(0)
  const bumpActivity = () => setActivityVersion((v) => v + 1)

  // Admins work one area at a time here rather than scrolling past every
  // church stacked on one page — a plain area selector, not a locked
  // "view as coordinator" preview. Admin keeps full edit rights and
  // month/year browsing no matter which area is selected. Coordinators
  // (non-admins) never see this selector — the backend already scopes
  // their data to their own single area.
  const [selectedAreaName, setSelectedAreaName] = useState(null)
  const activeAreaName = isAdmin ? selectedAreaName || churches[0]?.areaName : null
  const visibleChurches = isAdmin ? churches.filter((c) => c.areaName === activeAreaName) : churches

  // Every ChurchCard/LifeGroupAreaCard exposes save() via ref (see
  // useImperativeHandle in each) — keyed by areaName rather than a plain
  // array so a card unmounting (e.g. switching the area selector) can't
  // leave a stale ref behind for the Submit button to call.
  const churchRefs = useRef({})
  const lgRefs = useRef({})
  const [submitting, setSubmitting] = useState(false)
  const [submitProgress, setSubmitProgress] = useState(0)
  const [submitFlash, setSubmitFlash] = useState(false)
  const [submitError, setSubmitError] = useState(null)

  async function handleSubmitAll() {
    setSubmitting(true)
    setSubmitProgress(0)
    setSubmitError(null)
    try {
      const saves = []
      for (const church of visibleChurches) {
        const churchRef = churchRefs.current[church.areaName]
        const lgRef = lgRefs.current[church.areaName]
        if (churchRef) saves.push(churchRef.save())
        if (lgRef) saves.push(lgRef.save())
      }
      // Real, countable progress — each card's own save() is one
      // independent promise, so the percent reflects how many of them
      // have actually resolved rather than a simulated guess.
      const total = saves.length
      let completed = 0
      // Each card's own handleSave already calls onSaved (bumpActivity)
      // on its own success — no need to bump again here.
      await Promise.all(
        saves.map((p) =>
          p.then((result) => {
            completed += 1
            setSubmitProgress(total > 0 ? Math.round((completed / total) * 100) : 100)
            return result
          })
        )
      )
      setSubmitFlash(true)
      setTimeout(() => setSubmitFlash(false), 2000)
    } catch (err) {
      setSubmitError(err.message || 'Something went wrong saving one of the areas above.')
    } finally {
      setSubmitting(false)
      setSubmitProgress(0)
    }
  }

  return (
    <div className="scroll-page">
      <SectionHeader
        title="Data Entry"
        subtitle="Enter each week's real numbers as they happen — the monthly total is the sum of everything entered this month."
      />
      {isAdmin && (
        <div className="card" style={{ marginBottom: 20, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12 }}>
          <div className="label">Area</div>
          <select value={activeAreaName || ''} onChange={(e) => setSelectedAreaName(e.target.value)} style={{ ...sheetInputStyle, width: 'auto' }}>
            {churches.map((c) => (
              <option key={c.areaName} value={c.areaName}>
                {c.areaName}
              </option>
            ))}
          </select>
          <div className="label">Viewing</div>
          <select value={monthIndex} onChange={(e) => setMonthIndex(Number(e.target.value))} style={{ ...sheetInputStyle, width: 'auto' }}>
            {MONTH_NAMES.map((name, i) => (
              <option key={i} value={i}>
                {name}
              </option>
            ))}
          </select>
          <select value={year} onChange={(e) => setYear(Number(e.target.value))} style={{ ...sheetInputStyle, width: 'auto' }}>
            {YEAR_OPTIONS.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
          {(year !== today.getFullYear() || monthIndex !== today.getMonth()) && (
            <button
              onClick={() => {
                setYear(today.getFullYear())
                setMonthIndex(today.getMonth())
              }}
              style={{ background: 'none', border: 'none', color: 'var(--primary)', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}
            >
              Back to current month
            </button>
          )}
        </div>
      )}
      {/* .two-col-narrow keeps the same main-content + right-panel idea
          as .two-col (see theme.css) but with a slim fixed-width (260px)
          side column instead of a genuine 2/5 share of the row — Recent
          Submissions is a short activity feed, not content that needs
          to grow with the viewport. Collapses to a single stacked
          column below 720px so it moves below the entry cards on
          phones instead of squeezing beside them. */}
      <div className="two-col-narrow" style={{ marginTop: 20 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
          {visibleChurches.map((church) => (
            <div key={church.areaName} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <ChurchCard
                ref={(el) => {
                  if (el) churchRefs.current[church.areaName] = el
                  else delete churchRefs.current[church.areaName]
                }}
                church={church}
                weeks={weeks}
                year={year}
                monthIndex={monthIndex}
                onSaved={bumpActivity}
              />
              <LifeGroupAreaCard
                ref={(el) => {
                  if (el) lgRefs.current[church.areaName] = el
                  else delete lgRefs.current[church.areaName]
                }}
                areaName={church.areaName}
                weeks={weeks}
                year={year}
                monthIndex={monthIndex}
                onSaved={bumpActivity}
              />
            </div>
          ))}
          {/* Dedicated page-wide Submit, replacing each card's own "Save
              Week of ..." button. Placed here — inside the main column,
              right after the cards — rather than after the whole
              .two-col-narrow, so on mobile (where that grid collapses to
              one stacked column) Submit lands right after the cards it
              saves instead of below Recent Submissions. */}
          {submitError && <div style={{ color: 'var(--status-critical)', fontSize: 13 }}>{submitError}</div>}
          {submitting && (
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <PercentLoader progress={submitProgress} width={180} />
            </div>
          )}
          <button
            onClick={handleSubmitAll}
            disabled={submitting}
            style={{
              padding: '12px 0',
              borderRadius: 10,
              border: 'none',
              background: submitFlash ? 'var(--status-on-target)' : 'var(--primary)',
              color: 'white',
              fontWeight: 700,
              fontSize: 14,
              cursor: submitting ? 'default' : 'pointer',
              opacity: submitting ? 0.7 : 1,
            }}
          >
            {submitting ? `Saving... ${submitProgress}%` : submitFlash ? 'Saved ✓' : 'Submit'}
          </button>
        </div>
        <RecentSubmissions refreshKey={activityVersion} />
      </div>
    </div>
  )
}

const LifeGroupAreaCard = forwardRef(function LifeGroupAreaCard({ areaName, weeks, year, monthIndex, onSaved }, ref) {
  const { role } = useAuth()
  const isAdmin = ADMIN_ROLES.includes(role)

  const LG_HETERO_DEMOGRAPHICS = [...DEMOGRAPHICS, ['Hetero', 'Hetero']]
  const LG_CATEGORIES = [
    ['lgAttendance', 'Life Group Attendance', DEMOGRAPHICS],
    ['lgFirstTimers', 'Life Group First Timers', DEMOGRAPHICS],
    ['lgNumberOfGroups', 'Number of Life Groups', LG_HETERO_DEMOGRAPHICS],
  ]
  const LG_FIELD_KEYS = LG_CATEGORIES.flatMap(([prefix, , demographics]) => demographics.map(([dKey]) => `${prefix}${dKey}`))

  const [selectedWeek, setSelectedWeek] = useState(weeks.find((w) => isWithinDeadline(w)) || weeks[weeks.length - 1])
  const [form, setForm] = useState(Object.fromEntries(LG_FIELD_KEYS.map((key) => [key, ''])))
  const [entries, setEntries] = useState([])
  const [loadingEntries, setLoadingEntries] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [savedFlash, setSavedFlash] = useState(false)

  useEffect(() => {
    setSelectedWeek(weeks.find((w) => isWithinDeadline(w)) || weeks[weeks.length - 1])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weeks.join(',')])

  const locked = !isAdmin && !isWithinDeadline(selectedWeek)

  async function loadEntries() {
    setLoadingEntries(true)
    try {
      const data = await fetchWeeklyEntries(areaName, `${year}-${String(monthIndex + 1).padStart(2, '0')}-01`)
      setEntries(data)
      const forThisWeek = Object.fromEntries(LG_FIELD_KEYS.map((key) => [key, '']))
      for (const e of data) {
        if (e.week_start === selectedWeek && forThisWeek[e.field_key] !== undefined) {
          forThisWeek[e.field_key] = e.value
        }
      }
      setForm(forThisWeek)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoadingEntries(false)
    }
  }

  useEffect(() => {
    loadEntries()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedWeek])

  function set(key) {
    return (e) => setForm((f) => ({ ...f, [key]: e.target.value }))
  }

  async function handleSave() {
    // Nothing to save while locked (the deadline's passed and this isn't
    // an admin) — the page-wide Submit button calls every visible card's
    // save() without knowing which ones are locked, so this guard has to
    // live here rather than on a per-card button that no longer exists.
    if (locked) return
    setSaving(true)
    setError(null)
    try {
      const changedFields = LG_FIELD_KEYS.filter((key) => form[key] !== '')
      for (const key of changedFields) {
        await upsertWeeklyEntry(areaName, key, selectedWeek, form[key])
      }
      for (const key of changedFields) {
        // The month's actual START (day 1), not selectedWeek — passing a
        // mid-month Sunday here used to make recomputeMonthlyActual only
        // sum entries from that week onward, silently dropping earlier
        // weeks already saved this month from the pushed monthly total.
        await recomputeMonthlyActual(areaName, key, `${year}-${String(monthIndex + 1).padStart(2, '0')}-01`)
      }
      await loadEntries()
      onSaved?.()
      setSavedFlash(true)
      setTimeout(() => setSavedFlash(false), 2000)
    } catch (err) {
      setError(err.message)
      throw err // let the page-wide Submit button know this card failed
    } finally {
      setSaving(false)
    }
  }

  // Exposes save() so the single page-wide Submit button (in DataEntry)
  // can trigger every visible card's save at once — replaces each
  // card's own "Save Week of ..." button.
  useImperativeHandle(ref, () => ({ save: handleSave }))

  const totals = Object.fromEntries(LG_FIELD_KEYS.map((key) => [key, entries.filter((e) => e.field_key === key).reduce((s, e) => s + Number(e.value), 0)]))

  return (
    <div className="card" style={{ borderTop: '4px solid #00c781' }}>
      <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>{areaName} — Life Group</h2>
      <div className="body-muted" style={{ marginBottom: 14 }}>
        Attendance and First Timers for this Life Group, by demographic.
      </div>

      <div className="label" style={{ marginBottom: 6 }}>
        {monthLabel(year, monthIndex)}
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        {weeks.map((w, i) => {
          const weekLocked = !isAdmin && !isWithinDeadline(w)
          const isSelected = w === selectedWeek
          return (
            <button
              key={w}
              onClick={() => setSelectedWeek(w)}
              style={{
                padding: '8px 12px',
                borderRadius: 8,
                border: isSelected ? '2px solid var(--primary)' : '1px solid var(--line)',
                background: isSelected ? 'rgba(60,118,241,0.08)' : 'var(--surface)',
                fontSize: 12.5,
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 5,
              }}
            >
              {weekLocked && <LockIcon size={11} />}
              <span>
                Week {i + 1} — {new Date(w + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </span>
            </button>
          )
        })}
      </div>

      <div className="mobile-scroll-pane">
        <div className="two-col-form">
          <div>
            {locked && (
              <div style={{ background: 'var(--surface-muted)', border: '1px solid var(--line)', borderRadius: 10, padding: '16px 18px', marginBottom: 12 }}>
              <div style={{ fontWeight: 700, fontSize: 13.5, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                <LockIcon size={14} /> This week is locked
              </div>
              <div className="body-muted" style={{ fontSize: 13 }}>
                The entry window for this week has closed. Contact an Admin if a correction is needed.
              </div>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, opacity: locked ? 0.5 : 1 }}>
            {LG_CATEGORIES.map(([prefix, label, demographics]) => {
              const categoryTotal = demographics.reduce((sum, [dKey]) => sum + (Number(form[`${prefix}${dKey}`]) || 0), 0)
              return (
                <div key={prefix} style={CATEGORY_BOX_STYLE}>
                  <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>{label}</div>
                  {/* maxWidth keeps each label+input row compact — without
                      it, the row (a flex child in a stretch-aligned column)
                      stretches to the full column width and the label's
                      flex:1 then pushes the input all the way out to that
                      far edge, leaving a large empty gap between "Men" and
                      its box. Capping the row's own width keeps the input
                      close behind its label instead. */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5, maxWidth: 210 }}>
                    {demographics.map(([dKey, dLabel]) => (
                      <div key={dKey} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ flex: 1, minWidth: 0, fontSize: 13 }}>{dLabel}</div>
                        <input
                          type="number"
                          step={1}
                          value={form[`${prefix}${dKey}`]}
                          onChange={set(`${prefix}${dKey}`)}
                          disabled={locked}
                          style={{ ...sheetInputStyle, width: 84, padding: '9px 8px', textAlign: 'right' }}
                          placeholder="0"
                        />
                      </div>
                    ))}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 2 }}>
                      <div style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 700 }}>Total</div>
                      <div style={{ width: 84, textAlign: 'right', paddingRight: 8, fontWeight: 700, fontSize: 14 }}>{categoryTotal}</div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {error && <div style={{ color: 'var(--status-critical)', fontSize: 13, marginTop: 10 }}>{error}</div>}

          {/* No per-card save button anymore — the page-wide Submit
              button at the bottom saves every visible card at once.
              Still surface this card's own in-flight state so it's
              clear what the page-wide Submit is doing to it. */}
          {!locked && (saving || savedFlash) && (
            <div
              style={{
                marginTop: 12,
                fontSize: 12.5,
                fontWeight: 700,
                color: savedFlash ? 'var(--status-on-target)' : 'var(--ink-muted)',
              }}
            >
              {saving ? 'Saving...' : 'Saved ✓'}
            </div>
          )}
        </div>

        <div>
          <div className="label" style={{ marginBottom: 6 }}>
            {monthLabel(year, monthIndex)} — Weekly Progress
          </div>
          {loadingEntries ? (
            <div className="body-muted">Loading...</div>
          ) : (
            // One boxed table per category instead of a single wide table —
            // each box is now just Field + weeks + Total for its own few
            // rows, narrow enough to rarely need its own horizontal scroll,
            // and stacks cleanly as its own block on mobile.
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {LG_CATEGORIES.map(([prefix, label, demographics]) => (
                <div key={prefix} style={CATEGORY_BOX_STYLE}>
                  <div style={{ fontWeight: 700, fontSize: 12.5, marginBottom: 6 }}>{label}</div>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 320, fontSize: 11.5 }}>
                      <thead>
                        <tr style={{ background: 'var(--surface-muted)' }}>
                          <th style={{ textAlign: 'left', padding: '5px 6px', fontWeight: 700, color: 'var(--ink-muted)' }}>Field</th>
                          {weeks.map((w, i) => (
                            <th key={w} style={{ textAlign: 'right', padding: '5px 6px', fontWeight: 700, color: 'var(--ink-muted)' }}>
                              Wk {i + 1}
                            </th>
                          ))}
                          <th style={{ textAlign: 'right', padding: '5px 6px', fontWeight: 700, color: 'var(--ink)', position: 'sticky', right: 0, background: 'var(--surface-muted)', borderLeft: '1px solid var(--line)' }}>
                            Total
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {demographics.map(([dKey, dLabel]) => {
                          const fieldKey = `${prefix}${dKey}`
                          return (
                            <tr key={fieldKey} style={{ borderTop: '1px solid var(--line)' }}>
                              <td style={{ padding: '5px 6px' }}>{dLabel}</td>
                              {weeks.map((w) => {
                                const entry = entries.find((e) => e.field_key === fieldKey && e.week_start === w)
                                return (
                                  <td key={w} style={{ padding: '5px 6px', textAlign: 'right' }}>
                                    {entry ? entry.value : '—'}
                                  </td>
                                )
                              })}
                              <td style={{ padding: '5px 6px', textAlign: 'right', fontWeight: 700, position: 'sticky', right: 0, background: 'var(--surface)', borderLeft: '1px solid var(--line)' }}>{totals[fieldKey]}</td>
                            </tr>
                          )
                        })}
                        <tr style={{ borderTop: '1px solid var(--line)', background: 'var(--surface-muted)' }}>
                          <td style={{ padding: '5px 6px', fontWeight: 700 }}>Total</td>
                          {weeks.map((w) => {
                            const weekEntries = entries.filter((e) => e.week_start === w && demographics.some(([dKey]) => e.field_key === `${prefix}${dKey}`))
                            const weekTotal = weekEntries.reduce((sum, e) => sum + Number(e.value), 0)
                            return (
                              <td key={w} style={{ padding: '5px 6px', textAlign: 'right', fontWeight: 700 }}>
                                {weekEntries.length > 0 ? weekTotal : '—'}
                              </td>
                            )
                          })}
                          <td style={{ padding: '5px 6px', textAlign: 'right', fontWeight: 700, position: 'sticky', right: 0, background: 'var(--surface-muted)', borderLeft: '1px solid var(--line)' }}>
                            {demographics.reduce((sum, [dKey]) => sum + totals[`${prefix}${dKey}`], 0)}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        </div>
      </div>
    </div>
  )
})

// One save action in a ChurchCard/LifeGroupAreaCard writes one row per
// FIELD (upsertWeeklyEntry is called once per field), so a single
// submission of, say, the demographic attendance breakdown produces
// ~15-20 near-identical rows a second or two apart — same church, same
// submitter. Left ungrouped, that flooded this sidebar with repeats of
// the same event and blew past any reasonable height. Collapse
// consecutive rows that share a church and submitter and land within
// a minute of each other into a single event before rendering.
const SUBMISSION_BATCH_WINDOW_MS = 60_000

function groupIntoSubmissionEvents(rows) {
  const events = []
  for (const r of rows) {
    const t = new Date(r.updated_at).getTime()
    const last = events[events.length - 1]
    if (last && last.area_name === r.area_name && last.submitted_by === r.submitted_by && last.updated_at - t <= SUBMISSION_BATCH_WINDOW_MS) {
      continue // part of the same batch already represented by `last` (rows arrive newest-first)
    }
    events.push({ id: r.id, area_name: r.area_name, submitted_by: r.submitted_by, submitted_by_name: r.submitted_by_name, updated_at: t })
  }
  return events
}

const RECENT_SUBMISSIONS_SHOWN = 10

// Sidebar activity feed rather than a wide data table — now that this
// panel lives in the narrow right column of the .two-col layout, a
// 6-column table would just force horizontal scrolling inside a
// sidebar. Per the request, this also drops the specific-input detail
// (which field, what value) and keeps only what matters at a glance:
// which church, when it happened, and who submitted it — deduplicated
// to one line per actual submission, and height-capped with its own
// scroll so it can't outgrow the entry cards beside it.
function RecentSubmissions({ refreshKey }) {
  const [rows, setRows] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    // Fetch more raw rows than we'll display — grouping collapses many
    // field-level rows into few events, so a small raw limit could
    // leave fewer than RECENT_SUBMISSIONS_SHOWN events on screen.
    fetchRecentSubmissions(80)
      .then(setRows)
      .catch((err) => setError(err.message))
    // refreshKey changes the instant any card in THIS tab saves
    // successfully (see DataEntry's bumpActivity/onSaved) — refetching
    // here means the person doesn't have to wait for the realtime
    // round-trip below just to see their own save show up.
  }, [refreshKey])

  useEffect(() => {
    // Live updates for everyone ELSE'S saves — any INSERT/UPDATE on
    // weekly_entries from any user's session refetches this feed, so it
    // updates on its own without a page reload. Falls back to silence
    // (not an error) if the project hasn't enabled realtime replication
    // for this table yet — see subscribeToRecentSubmissions's comment.
    const unsubscribe = subscribeToRecentSubmissions(() => {
      fetchRecentSubmissions(80)
        .then(setRows)
        .catch((err) => setError(err.message))
    })
    return unsubscribe
  }, [])

  if (error) return null // quietly skip the log rather than blocking the whole page over it

  const events = rows ? groupIntoSubmissionEvents(rows).slice(0, RECENT_SUBMISSIONS_SHOWN) : null

  return (
    <div className="card">
      <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>Recent Submissions</h2>
      <div className="caption" style={{ marginBottom: 12 }}>
        Every church's activity — visible to everyone, not just Admins.
      </div>
      {!events ? (
        <div className="body-muted">Loading recent activity...</div>
      ) : events.length === 0 ? (
        <div className="body-muted">No submissions yet.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, maxHeight: 380, overflowY: 'auto' }}>
          {events.map((e) => (
            <div
              key={e.id}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 2,
                padding: '8px 2px',
                borderTop: '1px solid var(--line)',
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 700 }}>{e.area_name}</div>
              <div style={{ fontSize: 12, color: 'var(--ink-muted)' }}>{e.submitted_by_name || 'Unknown'}</div>
              <div style={{ fontSize: 11.5, color: 'var(--ink-faint)' }}>{new Date(e.updated_at).toLocaleString()}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

const ChurchCard = forwardRef(function ChurchCard({ church, weeks, year, monthIndex, onSaved }, ref) {
  const { areaName, isMainChurch } = church
  const { role } = useAuth()
  const isAdmin = ADMIN_ROLES.includes(role)

  const [selectedWeek, setSelectedWeek] = useState(weeks.find((w) => isWithinDeadline(w)) || weeks[weeks.length - 1])

  // weeks.find(...) above only runs once at mount — if an Admin switches
  // to a different month, `weeks` (a prop) changes, but selectedWeek
  // would otherwise stay stuck on a date from the OLD month that no
  // longer matches anything in the new one. Reset it whenever the
  // available weeks actually change.
  useEffect(() => {
    setSelectedWeek(weeks.find((w) => isWithinDeadline(w)) || weeks[weeks.length - 1])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weeks.join(',')])
  const [form, setForm] = useState(Object.fromEntries(ALL_FIELD_KEYS.map((key) => [key, ''])))
  const [entries, setEntries] = useState([])
  const [loadingEntries, setLoadingEntries] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [savedFlash, setSavedFlash] = useState(false)

  const locked = !isAdmin && !isWithinDeadline(selectedWeek)

  async function loadEntries() {
    setLoadingEntries(true)
    try {
      const data = await fetchWeeklyEntries(areaName, `${year}-${String(monthIndex + 1).padStart(2, '0')}-01`)
      setEntries(data)
      const forThisWeek = Object.fromEntries(ALL_FIELD_KEYS.map((key) => [key, '']))
      for (const e of data) {
        if (e.week_start === selectedWeek && forThisWeek[e.field_key] !== undefined) {
          forThisWeek[e.field_key] = e.value
        }
      }
      setForm(forThisWeek)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoadingEntries(false)
    }
  }

  useEffect(() => {
    loadEntries()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedWeek])

  function set(key) {
    return (e) => setForm((f) => ({ ...f, [key]: e.target.value }))
  }

  async function handleSave() {
    // See matching comment in LifeGroupAreaCard — the page-wide Submit
    // button calls save() on every visible card regardless of lock state.
    if (locked) return
    setSaving(true)
    setError(null)
    try {
      const changedFields = ALL_FIELD_KEYS.filter((key) => form[key] !== '')
      for (const key of changedFields) {
        await upsertWeeklyEntry(areaName, key, selectedWeek, form[key])
      }
      for (const key of changedFields) {
        // The month's actual START (day 1), not selectedWeek — passing a
        // mid-month Sunday here used to make recomputeMonthlyActual only
        // sum entries from that week onward, silently dropping earlier
        // weeks already saved this month from the pushed monthly total.
        await recomputeMonthlyActual(areaName, key, `${year}-${String(monthIndex + 1).padStart(2, '0')}-01`)
      }
      await loadEntries()
      onSaved?.()
      setSavedFlash(true)
      setTimeout(() => setSavedFlash(false), 2000)
    } catch (err) {
      setError(err.message)
      throw err
    } finally {
      setSaving(false)
    }
  }

  useImperativeHandle(ref, () => ({ save: handleSave }))

  const totals = Object.fromEntries(ALL_FIELD_KEYS.map((key) => [key, entries.filter((e) => e.field_key === key).reduce((s, e) => s + Number(e.value), 0)]))

  return (
    <div className="card" style={{ borderTop: '4px solid #3c76f1' }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 4 }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, flex: 1, minWidth: 0, overflowWrap: 'break-word' }}>{areaName}</h2>
        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            padding: '2px 8px',
            borderRadius: 999,
            color: isMainChurch ? '#00698c' : '#256e42',
            background: isMainChurch ? '#e0f7ff' : '#e8f8ee',
          }}
        >
          {isMainChurch ? 'MAIN CHURCH' : 'EXTENSION CHURCH'}
        </span>
      </div>

      {/* --- Week selector: every Sunday this month, auto-computed --- */}
      <div className="label" style={{ marginTop: 14, marginBottom: 6 }}>
        {monthLabel(year, monthIndex)}
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        {weeks.map((w, i) => {
          const weekLocked = !isAdmin && !isWithinDeadline(w)
          const isSelected = w === selectedWeek
          return (
            <button
              key={w}
              onClick={() => setSelectedWeek(w)}
              style={{
                padding: '8px 12px',
                borderRadius: 8,
                border: isSelected ? '2px solid var(--primary)' : '1px solid var(--line)',
                background: isSelected ? 'rgba(47,82,51,0.08)' : 'var(--surface)',
                fontSize: 12.5,
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 5,
              }}
            >
              {weekLocked && <LockIcon size={11} />}
              <span>
                Week {i + 1} — {new Date(w + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </span>
            </button>
          )
        })}
      </div>

      <div className="mobile-scroll-pane">
        <div className="two-col-form">
          {/* --- Weekly entry form --- */}
          <div>
            {locked ? (
            <div
              style={{
                background: 'var(--surface-muted)',
                border: '1px solid var(--line)',
                borderRadius: 10,
                padding: '16px 18px',
                marginBottom: 12,
              }}
            >
              <div style={{ fontWeight: 700, fontSize: 13.5, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}><LockIcon size={14} /> This week is locked</div>
              <div className="body-muted" style={{ fontSize: 13 }}>
                The entry window for this week has closed. Contact an Admin if a correction is needed.
              </div>
            </div>
          ) : null}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, opacity: locked ? 0.5 : 1 }}>
            {DEMOGRAPHIC_CATEGORIES.map(([prefix, label]) => {
              const categoryTotal = DEMOGRAPHICS.reduce((sum, [dKey]) => sum + (Number(form[`${prefix}${dKey}`]) || 0), 0)
              return (
                <div key={prefix} style={CATEGORY_BOX_STYLE}>
                  <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>{label}</div>
                  {/* maxWidth keeps each label+input row compact — without
                      it, the row (a flex child in a stretch-aligned column)
                      stretches to the full column width and the label's
                      flex:1 then pushes the input all the way out to that
                      far edge, leaving a large empty gap between "Men" and
                      its box. Capping the row's own width keeps the input
                      close behind its label instead. */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5, maxWidth: 210 }}>
                    {DEMOGRAPHICS.map(([dKey, dLabel]) => (
                      <div key={dKey} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ flex: 1, minWidth: 0, fontSize: 13 }}>{dLabel}</div>
                        {/* Counts (attendance headcounts, ~0-999) fit comfortably
                            in a narrow box — width:84 with tightened padding
                            (11px 14px -> 9px 8px) reclaims horizontal room for
                            the Weekly Progress table beside this form, and
                            right-aligning digits reads more like a numeric
                            column. Financial inputs below get their own wider
                            style since a peso amount can run 6+ digits. */}
                        <input
                          type="number"
                          step={1}
                          value={form[`${prefix}${dKey}`]}
                          onChange={set(`${prefix}${dKey}`)}
                          disabled={locked}
                          style={{ ...sheetInputStyle, width: 84, padding: '9px 8px', textAlign: 'right' }}
                          placeholder="0"
                        />
                      </div>
                    ))}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 2 }}>
                      <div style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 700 }}>Total</div>
                      <div style={{ width: 84, textAlign: 'right', paddingRight: 8, fontWeight: 700, fontSize: 14 }}>{categoryTotal}</div>
                    </div>
                  </div>
                </div>
              )
            })}

            {/* Financial/people fields get their own box, tighter gap (6
                instead of the 10 between category boxes above) and a
                wider input (84px -> 128px) — tithes/offering can run into
                6-figure peso amounts, which clipped inside the narrower
                84px box shared with the small headcount fields. */}
            <div style={CATEGORY_BOX_STYLE}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>Financial</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxWidth: 320 }}>
                {SIMPLE_FIELDS.map(([key, label, kind]) => (
                  <Fragment key={key}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ flex: 1, minWidth: 0, fontSize: 13 }}>{label}</div>
                      <input
                        type="number"
                        step={kind === 'financial' ? 'any' : 1}
                        value={form[key]}
                        onChange={set(key)}
                        disabled={locked}
                        style={{ ...sheetInputStyle, width: 128, padding: '9px 10px', textAlign: 'right' }}
                        placeholder="0"
                      />
                    </div>
                    {/* Combined Tithes + Offering figure — a church typically
                        reports these two together ("Total Tithes & Offering"),
                        so show the sum right after Offering, same visual
                        pattern as each demographic category's Total line. */}
                    {key === 'offerings' && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 2 }}>
                        <div style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 700 }}>Total TO</div>
                        <div style={{ width: 128, textAlign: 'right', paddingRight: 10, fontWeight: 700, fontSize: 14 }}>
                          {(Number(form.tithes) || 0) + (Number(form.offerings) || 0)}
                        </div>
                      </div>
                    )}
                  </Fragment>
                ))}
              </div>
            </div>
          </div>

          {error && <div style={{ color: 'var(--status-critical)', fontSize: 13, marginTop: 10 }}>{error}</div>}

          {/* No per-card save button anymore — see matching comment in
              LifeGroupAreaCard. */}
          {!locked && (saving || savedFlash) && (
            <div
              style={{
                marginTop: 12,
                fontSize: 12.5,
                fontWeight: 700,
                color: savedFlash ? 'var(--status-on-target)' : 'var(--ink-muted)',
              }}
            >
              {saving ? 'Saving...' : 'Saved ✓'}
            </div>
          )}
        </div>

        {/* --- Monthly progress --- */}
        <div>
          <div className="label" style={{ marginBottom: 6 }}>
            {monthLabel(year, monthIndex)} — Weekly Progress
          </div>
          {loadingEntries ? (
            <div className="body-muted">Loading...</div>
          ) : (
            // One boxed table per category (WSA, WSAFT, Financial) instead
            // of one wide table — mirrors the entry form's boxing above and
            // the same treatment on LifeGroupAreaCard, so each box stacks
            // cleanly as its own block on mobile.
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {DEMOGRAPHIC_CATEGORIES.map(([prefix, , shortLabel]) => (
                <div key={prefix} style={CATEGORY_BOX_STYLE}>
                  <div style={{ fontWeight: 700, fontSize: 12.5, marginBottom: 6 }}>{shortLabel}</div>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 320, fontSize: 11.5 }}>
                      <thead>
                        <tr style={{ background: 'var(--surface-muted)' }}>
                          <th style={{ textAlign: 'left', padding: '5px 6px', fontWeight: 700, color: 'var(--ink-muted)' }}>Field</th>
                          {weeks.map((w, i) => (
                            <th key={w} style={{ textAlign: 'right', padding: '5px 6px', fontWeight: 700, color: 'var(--ink-muted)' }}>
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                                {!isAdmin && !isWithinDeadline(w) && <LockIcon size={10} />}
                                Wk {i + 1}
                              </span>
                            </th>
                          ))}
                          {/* Sticky right:0 keeps Total visible at all times
                              even when the table has to scroll to fit Field +
                              every week column. */}
                          <th style={{ textAlign: 'right', padding: '5px 6px', fontWeight: 700, color: 'var(--ink)', position: 'sticky', right: 0, background: 'var(--surface-muted)', borderLeft: '1px solid var(--line)' }}>
                            Total
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {DEMOGRAPHICS.map(([dKey, dLabel]) => {
                          const fieldKey = `${prefix}${dKey}`
                          return (
                            <tr key={fieldKey} style={{ borderTop: '1px solid var(--line)' }}>
                              <td style={{ padding: '5px 6px' }}>{dLabel}</td>
                              {weeks.map((w) => {
                                const entry = entries.find((e) => e.field_key === fieldKey && e.week_start === w)
                                const title = entry ? `${entry.submitted_by_name || 'Unknown'} — ${new Date(entry.updated_at).toLocaleString()}` : undefined
                                return (
                                  <td key={w} title={title} style={{ padding: '5px 6px', textAlign: 'right', cursor: entry ? 'help' : 'default' }}>
                                    {entry ? entry.value : '—'}
                                  </td>
                                )
                              })}
                              <td style={{ padding: '5px 6px', textAlign: 'right', fontWeight: 700, position: 'sticky', right: 0, background: 'var(--surface)', borderLeft: '1px solid var(--line)' }}>
                                {NO_CUMULATIVE_TOTAL_PREFIXES.has(prefix) ? '—' : totals[fieldKey]}
                              </td>
                            </tr>
                          )
                        })}
                        <tr style={{ borderTop: '1px solid var(--line)', background: 'var(--surface-muted)' }}>
                          <td style={{ padding: '5px 6px', fontWeight: 700 }}>Total</td>
                          {weeks.map((w) => {
                            const weekEntries = entries.filter((e) => e.week_start === w && DEMOGRAPHICS.some(([dKey]) => e.field_key === `${prefix}${dKey}`))
                            const weekTotal = weekEntries.reduce((sum, e) => sum + Number(e.value), 0)
                            const title = weekEntries.length > 0 ? `${weekEntries.length} of 5 demographics entered` : undefined
                            return (
                              <td key={w} title={title} style={{ padding: '5px 6px', textAlign: 'right', fontWeight: 700, cursor: weekEntries.length > 0 ? 'help' : 'default' }}>
                                {weekEntries.length > 0 ? weekTotal : '—'}
                              </td>
                            )
                          })}
                          <td style={{ padding: '5px 6px', textAlign: 'right', fontWeight: 700, position: 'sticky', right: 0, background: 'var(--surface-muted)', borderLeft: '1px solid var(--line)' }}>
                            {NO_CUMULATIVE_TOTAL_PREFIXES.has(prefix) ? '—' : DEMOGRAPHICS.reduce((sum, [dKey]) => sum + totals[`${prefix}${dKey}`], 0)}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
              <div style={CATEGORY_BOX_STYLE}>
                <div style={{ fontWeight: 700, fontSize: 12.5, marginBottom: 6 }}>Financial</div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 320, fontSize: 11.5 }}>
                    <thead>
                      <tr style={{ background: 'var(--surface-muted)' }}>
                        <th style={{ textAlign: 'left', padding: '5px 6px', fontWeight: 700, color: 'var(--ink-muted)' }}>Field</th>
                        {weeks.map((w, i) => (
                          <th key={w} style={{ textAlign: 'right', padding: '5px 6px', fontWeight: 700, color: 'var(--ink-muted)' }}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                              {!isAdmin && !isWithinDeadline(w) && <LockIcon size={10} />}
                              Wk {i + 1}
                            </span>
                          </th>
                        ))}
                        <th style={{ textAlign: 'right', padding: '5px 6px', fontWeight: 700, color: 'var(--ink)', position: 'sticky', right: 0, background: 'var(--surface-muted)', borderLeft: '1px solid var(--line)' }}>
                          Total
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {SIMPLE_FIELDS.map(([key, label]) => (
                        <Fragment key={key}>
                          <tr style={{ borderTop: '1px solid var(--line)' }}>
                            <td style={{ padding: '5px 6px' }}>{label}</td>
                            {weeks.map((w) => {
                              const entry = entries.find((e) => e.field_key === key && e.week_start === w)
                              const title = entry
                                ? `${entry.submitted_by_name || 'Unknown'} — ${new Date(entry.updated_at).toLocaleString()}`
                                : undefined
                              return (
                                <td key={w} title={title} style={{ padding: '5px 6px', textAlign: 'right', cursor: entry ? 'help' : 'default' }}>
                                  {entry ? entry.value : '—'}
                                </td>
                              )
                            })}
                            <td style={{ padding: '5px 6px', textAlign: 'right', fontWeight: 700, position: 'sticky', right: 0, background: 'var(--surface)', borderLeft: '1px solid var(--line)' }}>
                              {NO_CUMULATIVE_TOTAL_KEYS.has(key) ? '—' : totals[key]}
                            </td>
                          </tr>
                          {/* Combined Tithes + Offering row, mirroring the
                              form's "Total TO" line above. */}
                          {key === 'offerings' && (
                            <tr style={{ borderTop: '1px solid var(--line)', background: 'var(--surface-muted)' }}>
                              <td style={{ padding: '5px 6px', fontWeight: 700 }}>Total TO</td>
                              {weeks.map((w) => {
                                const tithesEntry = entries.find((e) => e.field_key === 'tithes' && e.week_start === w)
                                const offeringEntry = entries.find((e) => e.field_key === 'offerings' && e.week_start === w)
                                const hasAny = Boolean(tithesEntry || offeringEntry)
                                const weekTotal = Number(tithesEntry?.value || 0) + Number(offeringEntry?.value || 0)
                                return (
                                  <td key={w} style={{ padding: '5px 6px', textAlign: 'right', fontWeight: 700 }}>
                                    {hasAny ? weekTotal : '—'}
                                  </td>
                                )
                              })}
                              <td style={{ padding: '5px 6px', textAlign: 'right', fontWeight: 700, position: 'sticky', right: 0, background: 'var(--surface-muted)', borderLeft: '1px solid var(--line)' }}>
                                {(totals.tithes || 0) + (totals.offerings || 0)}
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
        </div>
      </div>
    </div>
  )
})
