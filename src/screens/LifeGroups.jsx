import { useState } from 'react'
import SectionHeader from '../components/SectionHeader'
import StatusBadge from '../components/StatusBadge'
import TrendChart from '../components/TrendChart'
import RankingBarChart from '../components/RankingBarChart'
import { KPI_STATUS, commas } from '../data/api'
import { useAppData } from '../context/DataContext'

const DEMO_LABELS = [
  ['men', 'Men'],
  ['women', 'Women'],
  ['youngAdult', 'Young Adult'],
  ['kkb', 'KKB'],
  ['children', 'Children'],
  ['hetero', 'Hetero'],
]

export default function LifeGroups() {
  const { data } = useAppData()
  const { lifeGroups, lifeGroupHeadcountKpi, totalLifeGroups } = data
  const [filter, setFilter] = useState('All')
  const districts = ['All', ...new Set(lifeGroups.map((g) => g.district))]
  const filtered = filter === 'All' ? lifeGroups : lifeGroups.filter((g) => g.district === filter)

  const healthy = lifeGroups.filter((g) => g.status === KPI_STATUS.ON_TARGET).length
  const attention = lifeGroups.filter((g) => g.status === KPI_STATUS.ATTENTION).length
  const critical = lifeGroups.filter((g) => g.status === KPI_STATUS.CRITICAL).length

  // Church-wide demographic totals — summed across all churches, since
  // there's no separate church-wide table for this (only per-church data).
  const demoTotals = DEMO_LABELS.reduce((acc, [key]) => {
    acc[key] = lifeGroups.reduce(
      (sum, g) => ({
        target: sum.target + (g.demographics?.[key]?.target || 0),
        actual: sum.actual + (g.demographics?.[key]?.actual || 0),
      }),
      { target: 0, actual: 0 },
    )
    return acc
  }, {})

  return (
    <div className="scroll-page">
      <SectionHeader title="Life Groups" subtitle="Roll-up headcount by group, church-defined ministry area, and church total" />

      <div className="two-col-reverse">
        <div className="card">
          <div style={{ display: 'flex' }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, flex: 1, minWidth: 0 }}>Church-Wide Roll-Up</h2>
            <StatusBadge status={lifeGroupHeadcountKpi.status} />
          </div>
          <div className="stat-large" style={{ marginTop: 14 }}>
            {lifeGroupHeadcountKpi.actual} / {lifeGroupHeadcountKpi.target}
          </div>
          <div className="body-muted">
            {lifeGroupHeadcountKpi.achievementPct.toFixed(1)}% achievement · {totalLifeGroups} churches
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
            <CountChip label="Healthy" count={healthy} color="var(--status-on-target)" />
            <CountChip label="Attention" count={attention} color="var(--status-attention)" />
            <CountChip label="Critical" count={critical} color="var(--status-critical)" />
          </div>
        </div>

        <div className="card">
          <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>Headcount Trend</h2>
          <TrendChart points={lifeGroupHeadcountKpi.trend} color="var(--accent)" />
        </div>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 2 }}>By Church — Achievement Ranking</h2>
        <div className="body-muted" style={{ marginBottom: 12 }}>
          Who is closest to (or past) their headcount target?
        </div>
        <RankingBarChart data={lifeGroups.map((g) => ({ label: g.name, value: g.achievementPct }))} />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', marginTop: 24, marginBottom: 12 }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, flex: 1, minWidth: 0 }}>Churches</h2>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          style={{
            padding: '8px 12px',
            borderRadius: 8,
            border: '1px solid var(--line)',
            background: 'var(--surface)',
            fontSize: 13.5,
          }}
        >
          {districts.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
      </div>

      <div className="card desktop-only" style={{ padding: 8, overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 780 }}>
          <thead>
            <tr style={{ background: 'var(--surface-muted)' }}>
              {['Church', 'Ministry Area', 'Barangay', 'Leader', 'Headcount', 'Achievement', 'Status', 'LG Leaders', 'LG Attendance'].map((h) => (
                <th key={h} style={{ textAlign: 'left', padding: '10px 14px', fontSize: 12.5, fontWeight: 700, color: 'var(--ink-muted)' }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((g) => (
              <tr key={g.name} style={{ borderTop: '1px solid var(--line)' }}>
                <td style={{ padding: '10px 14px', fontWeight: 700, fontSize: 13.5 }}>{g.name}</td>
                <td style={{ padding: '10px 14px', fontSize: 13.5 }}>{g.district}</td>
                <td style={{ padding: '10px 14px', fontSize: 13.5 }}>{g.barangay}</td>
                <td style={{ padding: '10px 14px', fontSize: 13.5 }}>{g.leader}</td>
                <td style={{ padding: '10px 14px', fontSize: 13.5 }}>
                  {g.actualHeadcount} / {g.targetHeadcount}
                </td>
                <td style={{ padding: '10px 14px', fontSize: 13.5 }}>{g.achievementPct.toFixed(0)}%</td>
                <td style={{ padding: '10px 14px' }}>
                  <StatusBadge status={g.status} compact />
                </td>
                <td style={{ padding: '10px 14px', fontSize: 13.5 }}>
                  {g.leadersActual} / {g.leadersTarget}
                </td>
                <td style={{ padding: '10px 14px', fontSize: 13.5 }}>
                  {g.attendanceActual.toFixed(0)} / {g.attendanceTarget.toFixed(0)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mobile-only">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtered.map((g) => (
            <div key={g.name} className="card" style={{ padding: 14 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 14.5, overflowWrap: 'break-word' }}>{g.name}</div>
                  <div className="body-muted" style={{ marginTop: 2, overflowWrap: 'break-word' }}>
                    {g.barangay} · {g.district}
                  </div>
                </div>
                <StatusBadge status={g.status} compact />
              </div>
              <div style={{ display: 'flex', gap: 20, marginTop: 12, flexWrap: 'wrap' }}>
                <MobileStat label="Leader" value={g.leader} />
                <MobileStat label="Headcount" value={`${g.actualHeadcount} / ${g.targetHeadcount}`} />
                <MobileStat label="Achievement" value={`${g.achievementPct.toFixed(0)}%`} />
                <MobileStat label="LG Leaders" value={`${g.leadersActual} / ${g.leadersTarget}`} />
                <MobileStat label="LG Attendance" value={`${g.attendanceActual.toFixed(0)} / ${g.attendanceTarget.toFixed(0)}`} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* --- By Demographic --- */}
      <div style={{ marginTop: 24 }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>By Demographic</h2>

        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', marginBottom: 16 }}>
          {DEMO_LABELS.map(([key, label]) => {
            const t = demoTotals[key]
            const pct = t.target > 0 ? (t.actual / t.target) * 100 : 0
            const isLow = t.target > 0 && pct < 60
            return (
              <div className="card" key={key}>
                <div className="label">{label}</div>
                <div
                  style={{
                    fontSize: 22,
                    fontWeight: 800,
                    marginTop: 6,
                    color: isLow ? 'var(--status-critical)' : 'var(--ink)',
                  }}
                >
                  {commas(t.actual)}
                </div>
                <div className="caption" style={{ marginTop: 2 }}>
                  of {commas(t.target)} target
                </div>
              </div>
            )
          })}
        </div>

        <div className="card" style={{ padding: 8, overflowX: 'auto' }}>
          <div style={{ padding: '12px 12px 4px' }}>
            <div className="body-muted">Per church — actual vs target for each demographic.</div>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 720, marginTop: 8 }}>
            <thead>
              <tr style={{ background: 'var(--surface-muted)' }}>
                {['Church', ...DEMO_LABELS.map(([, label]) => label)].map((h) => (
                  <th key={h} style={{ textAlign: 'left', padding: '10px 14px', fontSize: 12.5, fontWeight: 700, color: 'var(--ink-muted)' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {lifeGroups.map((g) => (
                <tr key={g.name} style={{ borderTop: '1px solid var(--line)' }}>
                  <td style={{ padding: '10px 14px', fontWeight: 700, fontSize: 13.5 }}>{g.name}</td>
                  {DEMO_LABELS.map(([key]) => {
                    const d = g.demographics?.[key] || { target: 0, actual: 0 }
                    const pct = d.target > 0 ? (d.actual / d.target) * 100 : null
                    const isLow = pct != null && pct < 60
                    return (
                      <td key={key} style={{ padding: '10px 14px', fontSize: 13.5 }}>
                        <span style={{ color: isLow ? 'var(--status-critical)' : 'var(--ink)', fontWeight: isLow ? 700 : 400 }}>{d.actual}</span>
                        <span className="caption"> / {d.target}</span>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function MobileStat({ label, value }) {
  return (
    <div>
      <div className="caption">{label}</div>
      <div style={{ fontSize: 13.5, fontWeight: 600, marginTop: 2 }}>{value}</div>
    </div>
  )
}

function CountChip({ label, count, color }) {
  return (
    <div style={{ flex: 1, textAlign: 'center', padding: '10px 0', borderRadius: 10, background: `${color}1a` }}>
      <div style={{ fontSize: 18, fontWeight: 800, color }}>{count}</div>
      <div className="caption">{label}</div>
    </div>
  )
}
