import { LockIcon } from '../components/Icons'
import { Fragment, useEffect, useState } from 'react'
import SectionHeader from '../components/SectionHeader'
import { sheetInputStyle } from '../components/FormSheet'
import { useAppData } from '../context/DataContext'
import { useAuth } from '../context/AuthContext'
import { fetchWeeklyEntries, upsertWeeklyEntry, recomputeMonthlyActual, fetchRecentSubmissions } from '../data/api'

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
const DEMOGRAPHIC_CATEGORIES = [
  ['attendance', 'Sunday Service Attendance'],
  ['firstTimers', 'SSA First Timers'],
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
  ['tithes', 'Tithes', 'financial'],
  ['offerings', 'Offering', 'financial'],
  ['pledges', 'Pledges', 'financial'],
  ['missionOffering', 'Mission', 'financial'],
  ['support', 'Support', 'financial'],
  ['numberOfTithers', 'Number of Tithers', 'people'],
]
const ALL_FIELD_KEYS = [...DEMOGRAPHIC_FIELD_KEYS, ...SIMPLE_FIELDS.map(([key]) => key)]

const FIELD_LABELS = Object.fromEntries([
  ...DEMOGRAPHIC_CATEGORIES.flatMap(([prefix, label]) => DEMOGRAPHICS.map(([dKey, dLabel]) => [`${prefix}${dKey}`, `${label} — ${dLabel}`])),
  ...SIMPLE_FIELDS.map(([key, label]) => [key, label]),
])
const ADMIN_ROLES = ['admin', 'pastor_mis']

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

  return (
    <div className="scroll-page">
      <SectionHeader
        title="Data Entry"
        subtitle="Enter each week's real numbers as they happen — the monthly total is the sum of everything entered this month."
      />
      {isAdmin && (
        <div className="card" style={{ marginBottom: 20, display: 'flex', alignItems: 'center', gap: 12 }}>
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
      <RecentSubmissions />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 32, marginTop: 20 }}>
        {churches.map((church) => (
          <div key={church.areaName} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <ChurchCard church={church} weeks={weeks} year={year} monthIndex={monthIndex} />
            <LifeGroupAreaCard areaName={church.areaName} weeks={weeks} year={year} monthIndex={monthIndex} />
          </div>
        ))}
      </div>
    </div>
  )
}

function LifeGroupAreaCard({ areaName, weeks, year, monthIndex }) {
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
    setSaving(true)
    setError(null)
    try {
      const changedFields = LG_FIELD_KEYS.filter((key) => form[key] !== '')
      for (const key of changedFields) {
        await upsertWeeklyEntry(areaName, key, selectedWeek, form[key])
      }
      for (const key of changedFields) {
        await recomputeMonthlyActual(areaName, key, selectedWeek)
      }
      await loadEntries()
      setSavedFlash(true)
      setTimeout(() => setSavedFlash(false), 2000)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

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

      <div className="two-col">
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

          <div style={{ display: 'flex', flexDirection: 'column', gap: 18, opacity: locked ? 0.5 : 1 }}>
            {LG_CATEGORIES.map(([prefix, label, demographics]) => {
              const categoryTotal = demographics.reduce((sum, [dKey]) => sum + (Number(form[`${prefix}${dKey}`]) || 0), 0)
              return (
                <div key={prefix}>
                  <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>{label}</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingLeft: 10 }}>
                    {demographics.map(([dKey, dLabel]) => (
                      <div key={dKey} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ flex: 1, fontSize: 13 }}>{dLabel}</div>
                        <input
                          type="number"
                          step={1}
                          value={form[`${prefix}${dKey}`]}
                          onChange={set(`${prefix}${dKey}`)}
                          disabled={locked}
                          style={{ ...sheetInputStyle, width: 110 }}
                          placeholder="0"
                        />
                      </div>
                    ))}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 2 }}>
                      <div style={{ flex: 1, fontSize: 13, fontWeight: 700 }}>Total</div>
                      <div style={{ width: 110, textAlign: 'center', fontWeight: 700, fontSize: 14 }}>{categoryTotal}</div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {error && <div style={{ color: 'var(--status-critical)', fontSize: 13, marginTop: 10 }}>{error}</div>}

          {!locked && (
            <button
              onClick={handleSave}
              disabled={saving}
              style={{
                width: '100%',
                marginTop: 16,
                padding: '10px 0',
                borderRadius: 8,
                border: 'none',
                background: savedFlash ? 'var(--status-on-target)' : 'var(--primary)',
                color: 'white',
                fontWeight: 700,
                fontSize: 13.5,
                cursor: saving ? 'default' : 'pointer',
                opacity: saving ? 0.7 : 1,
              }}
            >
              {saving ? 'Saving...' : savedFlash ? 'Saved ✓' : `Save Week of ${selectedWeek}`}
            </button>
          )}
        </div>

        <div>
          <div className="label" style={{ marginBottom: 6 }}>
            {monthLabel(year, monthIndex)} — Weekly Progress
          </div>
          {loadingEntries ? (
            <div className="body-muted">Loading...</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 420, fontSize: 12 }}>
                <thead>
                  <tr style={{ background: 'var(--surface-muted)' }}>
                    <th style={{ textAlign: 'left', padding: '6px 8px', fontWeight: 700, color: 'var(--ink-muted)' }}>Field</th>
                    {weeks.map((w, i) => (
                      <th key={w} style={{ textAlign: 'right', padding: '6px 8px', fontWeight: 700, color: 'var(--ink-muted)' }}>
                        Wk {i + 1}
                      </th>
                    ))}
                    <th style={{ textAlign: 'right', padding: '6px 8px', fontWeight: 700, color: 'var(--ink)' }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {LG_CATEGORIES.map(([prefix, label, demographics]) => (
                    <Fragment key={prefix}>
                      <tr style={{ borderTop: '2px solid var(--line)' }}>
                        <td colSpan={weeks.length + 2} style={{ padding: '8px 8px 4px', fontWeight: 700, fontSize: 12.5 }}>
                          {label}
                        </td>
                      </tr>
                      {demographics.map(([dKey, dLabel]) => {
                        const fieldKey = `${prefix}${dKey}`
                        return (
                          <tr key={fieldKey} style={{ borderTop: '1px solid var(--line)' }}>
                            <td style={{ padding: '6px 8px 6px 18px' }}>{dLabel}</td>
                            {weeks.map((w) => {
                              const entry = entries.find((e) => e.field_key === fieldKey && e.week_start === w)
                              return (
                                <td key={w} style={{ padding: '6px 8px', textAlign: 'right' }}>
                                  {entry ? entry.value : '—'}
                                </td>
                              )
                            })}
                            <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 700 }}>{totals[fieldKey]}</td>
                          </tr>
                        )
                      })}
                      <tr style={{ borderTop: '1px solid var(--line)', background: 'var(--surface-muted)' }}>
                        <td style={{ padding: '6px 8px', fontWeight: 700 }}>Total</td>
                        {weeks.map((w) => {
                          const weekEntries = entries.filter((e) => e.week_start === w && demographics.some(([dKey]) => e.field_key === `${prefix}${dKey}`))
                          const weekTotal = weekEntries.reduce((sum, e) => sum + Number(e.value), 0)
                          return (
                            <td key={w} style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 700 }}>
                              {weekEntries.length > 0 ? weekTotal : '—'}
                            </td>
                          )
                        })}
                        <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 700 }}>
                          {demographics.reduce((sum, [dKey]) => sum + totals[`${prefix}${dKey}`], 0)}
                        </td>
                      </tr>
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function RecentSubmissions() {
  const [rows, setRows] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetchRecentSubmissions(15)
      .then(setRows)
      .catch((err) => setError(err.message))
  }, [])

  if (error) return null // quietly skip the log rather than blocking the whole page over it
  if (!rows) return <div className="body-muted">Loading recent activity...</div>

  return (
    <div className="card">
      <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>Recent Submissions</h2>
      <div className="caption" style={{ marginBottom: 12 }}>
        Every entry across every church — visible to everyone, not just Admins.
      </div>
      {rows.length === 0 ? (
        <div className="body-muted">No submissions yet.</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 640, fontSize: 12.5 }}>
            <thead>
              <tr style={{ background: 'var(--surface-muted)' }}>
                {['Church', 'Field', 'Week Of', 'Value', 'Submitted By', 'When'].map((h) => (
                  <th key={h} style={{ textAlign: 'left', padding: '8px 10px', fontWeight: 700, color: 'var(--ink-muted)' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} style={{ borderTop: '1px solid var(--line)' }}>
                  <td style={{ padding: '6px 10px' }}>{r.area_name}</td>
                  <td style={{ padding: '6px 10px' }}>{FIELD_LABELS[r.field_key] || r.field_key}</td>
                  <td style={{ padding: '6px 10px' }}>{r.week_start}</td>
                  <td style={{ padding: '6px 10px', fontWeight: 700 }}>{r.value}</td>
                  <td style={{ padding: '6px 10px' }}>{r.submitted_by_name || 'Unknown'}</td>
                  <td style={{ padding: '6px 10px', color: 'var(--ink-faint)' }}>{new Date(r.updated_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function ChurchCard({ church, weeks, year, monthIndex }) {
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
    setSaving(true)
    setError(null)
    try {
      const changedFields = ALL_FIELD_KEYS.filter((key) => form[key] !== '')
      for (const key of changedFields) {
        await upsertWeeklyEntry(areaName, key, selectedWeek, form[key])
      }
      for (const key of changedFields) {
        await recomputeMonthlyActual(areaName, key, selectedWeek)
      }
      await loadEntries()
      setSavedFlash(true)
      setTimeout(() => setSavedFlash(false), 2000)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const totals = Object.fromEntries(ALL_FIELD_KEYS.map((key) => [key, entries.filter((e) => e.field_key === key).reduce((s, e) => s + Number(e.value), 0)]))

  return (
    <div className="card" style={{ borderTop: '4px solid #3c76f1' }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 4 }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, flex: 1 }}>{areaName}</h2>
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

      <div className="two-col">
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

          <div style={{ display: 'flex', flexDirection: 'column', gap: 18, opacity: locked ? 0.5 : 1 }}>
            {DEMOGRAPHIC_CATEGORIES.map(([prefix, label]) => {
              const categoryTotal = DEMOGRAPHICS.reduce((sum, [dKey]) => sum + (Number(form[`${prefix}${dKey}`]) || 0), 0)
              return (
                <div key={prefix}>
                  <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>{label}</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingLeft: 10 }}>
                    {DEMOGRAPHICS.map(([dKey, dLabel]) => (
                      <div key={dKey} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ flex: 1, fontSize: 13 }}>{dLabel}</div>
                        <input
                          type="number"
                          step={1}
                          value={form[`${prefix}${dKey}`]}
                          onChange={set(`${prefix}${dKey}`)}
                          disabled={locked}
                          style={{ ...sheetInputStyle, width: 110 }}
                          placeholder="0"
                        />
                      </div>
                    ))}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 2 }}>
                      <div style={{ flex: 1, fontSize: 13, fontWeight: 700 }}>Total</div>
                      <div style={{ width: 110, textAlign: 'center', fontWeight: 700, fontSize: 14 }}>{categoryTotal}</div>
                    </div>
                  </div>
                </div>
              )
            })}

            {SIMPLE_FIELDS.map(([key, label, kind]) => (
              <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ flex: 1, fontSize: 13 }}>{label}</div>
                <input
                  type="number"
                  step={kind === 'financial' ? 'any' : 1}
                  value={form[key]}
                  onChange={set(key)}
                  disabled={locked}
                  style={{ ...sheetInputStyle, width: 110 }}
                  placeholder="0"
                />
              </div>
            ))}
          </div>

          {error && <div style={{ color: 'var(--status-critical)', fontSize: 13, marginTop: 10 }}>{error}</div>}

          {!locked && (
            <button
              onClick={handleSave}
              disabled={saving}
              style={{
                width: '100%',
                marginTop: 16,
                padding: '10px 0',
                borderRadius: 8,
                border: 'none',
                background: savedFlash ? 'var(--status-on-target)' : 'var(--primary)',
                color: 'white',
                fontWeight: 700,
                fontSize: 13.5,
                cursor: saving ? 'default' : 'pointer',
                opacity: saving ? 0.7 : 1,
              }}
            >
              {saving ? 'Saving...' : savedFlash ? 'Saved ✓' : `Save Week of ${selectedWeek}`}
            </button>
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
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 480, fontSize: 12 }}>
                <thead>
                  <tr style={{ background: 'var(--surface-muted)' }}>
                    <th style={{ textAlign: 'left', padding: '6px 8px', fontWeight: 700, color: 'var(--ink-muted)' }}>Field</th>
                    {weeks.map((w, i) => (
                      <th key={w} style={{ textAlign: 'right', padding: '6px 8px', fontWeight: 700, color: 'var(--ink-muted)' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                          {!isAdmin && !isWithinDeadline(w) && <LockIcon size={10} />}
                          Wk {i + 1}
                        </span>
                      </th>
                    ))}
                    <th style={{ textAlign: 'right', padding: '6px 8px', fontWeight: 700, color: 'var(--ink)' }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {DEMOGRAPHIC_CATEGORIES.map(([prefix, label]) => (
                    <Fragment key={prefix}>
                      <tr key={`${prefix}-header`} style={{ borderTop: '2px solid var(--line)' }}>
                        <td colSpan={weeks.length + 2} style={{ padding: '8px 8px 4px', fontWeight: 700, fontSize: 12.5 }}>
                          {label}
                        </td>
                      </tr>
                      {DEMOGRAPHICS.map(([dKey, dLabel]) => {
                        const fieldKey = `${prefix}${dKey}`
                        return (
                          <tr key={fieldKey} style={{ borderTop: '1px solid var(--line)' }}>
                            <td style={{ padding: '6px 8px 6px 18px' }}>{dLabel}</td>
                            {weeks.map((w) => {
                              const entry = entries.find((e) => e.field_key === fieldKey && e.week_start === w)
                              const title = entry ? `${entry.submitted_by_name || 'Unknown'} — ${new Date(entry.updated_at).toLocaleString()}` : undefined
                              return (
                                <td key={w} title={title} style={{ padding: '6px 8px', textAlign: 'right', cursor: entry ? 'help' : 'default' }}>
                                  {entry ? entry.value : '—'}
                                </td>
                              )
                            })}
                            <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 700 }}>{totals[fieldKey]}</td>
                          </tr>
                        )
                      })}
                      <tr key={`${prefix}-total`} style={{ borderTop: '1px solid var(--line)', background: 'var(--surface-muted)' }}>
                        <td style={{ padding: '6px 8px', fontWeight: 700 }}>Total</td>
                        {weeks.map((w) => {
                          const weekEntries = entries.filter((e) => e.week_start === w && DEMOGRAPHICS.some(([dKey]) => e.field_key === `${prefix}${dKey}`))
                          const weekTotal = weekEntries.reduce((sum, e) => sum + Number(e.value), 0)
                          const title = weekEntries.length > 0 ? `${weekEntries.length} of 5 demographics entered` : undefined
                          return (
                            <td key={w} title={title} style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 700, cursor: weekEntries.length > 0 ? 'help' : 'default' }}>
                              {weekEntries.length > 0 ? weekTotal : '—'}
                            </td>
                          )
                        })}
                        <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 700 }}>
                          {DEMOGRAPHICS.reduce((sum, [dKey]) => sum + totals[`${prefix}${dKey}`], 0)}
                        </td>
                      </tr>
                    </Fragment>
                  ))}
                  {SIMPLE_FIELDS.map(([key, label]) => (
                    <tr key={key} style={{ borderTop: '1px solid var(--line)' }}>
                      <td style={{ padding: '6px 8px' }}>{label}</td>
                      {weeks.map((w) => {
                        const entry = entries.find((e) => e.field_key === key && e.week_start === w)
                        const title = entry
                          ? `${entry.submitted_by_name || 'Unknown'} — ${new Date(entry.updated_at).toLocaleString()}`
                          : undefined
                        return (
                          <td key={w} title={title} style={{ padding: '6px 8px', textAlign: 'right', cursor: entry ? 'help' : 'default' }}>
                            {entry ? entry.value : '—'}
                          </td>
                        )
                      })}
                      <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 700 }}>{totals[key]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
