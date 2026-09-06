import { useState } from 'react'
import SectionHeader from '../components/SectionHeader'
import StatusBadge from '../components/StatusBadge'
import PyaGrowth from '../components/PyaGrowth'
import PyaBarChart from '../components/PyaBarChart'
import ParentSubsetPanel from '../components/ParentSubsetPanel'
import DonutChart from '../components/DonutChart'
import OverlappingTargetBarChart from '../components/OverlappingTargetBarChart'
import { LoadingSpinner } from '../components/Spinner'
import { commas } from '../data/api'
import { useAppData } from '../context/DataContext'
import { usePeriod } from '../context/PeriodContext'

export default function PeopleGrowth() {
  const { data } = useAppData()
  const { monthlySeries, monthlySeriesLoading, monthlySeriesError, refetchMonthlySeries } = usePeriod()
  const [trendArea, setTrendArea] = useState(null)
  const {
    totalMembers,
    totalMembersPya,
    activeMembers,
    activeMembersPya,
    attendanceKpi,
    firstTimersKpi,
    firstTimerFunnel,
    areaPeopleStats,
    cat1Demographics,
    cat2Demographics,
  } = data

  const maxCount = firstTimerFunnel[0].count
  const funnelPalette = ['#3c76f1', '#ffbb38', '#6e8fa3', '#8e5b45', '#366ad9']

  // Church-wide Workers total isn't tracked as its own figure — it's
  // computed by summing the per-area Workers numbers (editable in Admin
  // Console → Area People) rather than needing a separate database field.
  const workers = (areaPeopleStats || []).reduce(
    (sum, a) => ({
      fullTime: sum.fullTime + (a.fullTimeWorkers || 0),
      partTime: sum.partTime + (a.partTimeWorkers || 0),
      volunteer: sum.volunteer + (a.volunteerWorkers || 0),
      total: sum.total + (a.totalWorkers || 0),
    }),
    { fullTime: 0, partTime: 0, volunteer: 0, total: 0 },
  )

  return (
    <div className="scroll-page">
      <SectionHeader title="Membership" subtitle="Category 1, Category 2, Attendance, First Timers, and Workers" />

      {/* --- Category 1 / Category 2 / Rate --- */}
      <SectionBlock title="Membership" subtitle="Category 2 is a subset of Category 1 — PYA is each category's own benchmark, not a third category">
        <div className="two-col">
          <ParentSubsetPanel
            parentLabel="Category 1 ( SSAM+LGAM+ SSAM/LGAM)"
            parentActual={totalMembers}
            parentPya={totalMembersPya}
            parentMonths={monthlySeries?.total?.membership?.months}
            parentDemographics={cat1Demographics}
            subsetLabel="Category 2 ( SSAM+ SSAM/LGAM)"
            subsetActual={activeMembers}
            subsetPya={activeMembersPya}
            subsetMonths={monthlySeries?.total?.activeMembership?.months}
            subsetDemographics={cat2Demographics}
            rateLabel="Rate"
            formatter={commas}
            parentColor="#082253"
            subsetColor="#3c76f1"
          />
          <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <div className="label" style={{ marginBottom: 12, alignSelf: 'flex-start' }}>
              Category 2 vs Category 1
            </div>
            <DonutChart
              segments={[
                { label: 'Category 2', value: activeMembers, color: '#2f6fb3' },
                { label: 'Category 1', value: Math.max(0, totalMembers - activeMembers), color: '#3c76f1' },
              ]}
              centerLabel="Category 1"
              centerValue={commas(totalMembers)}
            />
          </div>
        </div>
      </SectionBlock>

      {/* --- Sunday Service Attendance (with PYA + monthly trend) vs Category 2 (actual only, for reference) --- */}
      <SectionBlock title="Sunday Service Attendance" subtitle="Overlapping against Category 2, colored by whether that month passed its own target">
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', marginBottom: 16 }}>
          <div className="card" style={{ minWidth: 0 }}>
            <div style={{ display: 'flex' }}>
              <div className="label" style={{ flex: 1 }}>
                Sunday Service Attendance
              </div>
              <StatusBadge status={attendanceKpi.status} compact />
            </div>
            <PyaGrowth pya={attendanceKpi.target} actual={attendanceKpi.actual} formatter={(v) => v.toFixed(0)} />
          </div>
          <div className="card" style={{ minWidth: 0 }}>
            <div className="label">Category 2 ( SSAM+ SSAM/LGAM)</div>
            <div className="stat-large" style={{ marginTop: 8 }}>
              {commas(activeMembers)}
            </div>
            <div className="caption" style={{ marginTop: 4 }}>
              Actual only — no PYA comparison here
            </div>
          </div>
        </div>

        <div className="body-muted" style={{ marginBottom: 4, fontSize: 13 }}>
          Monthly Trend — Category 2 (background) vs Attendance (Target Passed / Target Missed)
        </div>
        <OverlappingTargetBarChart
          months={(monthlySeries?.total?.attendance?.months || []).map((m) => ({
            label: m.label,
            front: m.unreported ? null : m.value,
            // Category 2's background bar uses the LIVE, Admin-editable
            // value (same number every month) rather than the frozen
            // historical import — if the church updates Category 2 in
            // Admin Console later, this chart picks that up automatically
            // instead of staying stuck on last year's imported figures.
            background: m.unreported ? null : activeMembers,
          }))}
          backgroundKey="background"
          backgroundLabel="Category 2"
          target={(activeMembers || 0) * 0.6}
          pyaValue={monthlySeries?.total?.attendance?.pya || 0}
          pyaBarLabel="SSA PYA"
          valueFormatter={(v) => commas(Math.round(v))}
        />
        <div className="caption" style={{ marginTop: 8 }}>
          The blue bar is Attendance's own real PYA ({commas(Math.round(monthlySeries?.total?.attendance?.pya || 0))}) — a different number from the pass/fail Target ({commas(Math.round(activeMembers * 0.6))}), which is set at 60% of Category 2's current Actual ({commas(activeMembers)}).
        </div>
      </SectionBlock>

      {/* --- First Timers --- */}
      <SectionBlock title="First Timers">
        <div style={{ display: 'flex' }}>
          <div style={{ flex: 1 }} />
          <StatusBadge status={firstTimersKpi.status} />
        </div>
        <div style={{ marginTop: 10, marginBottom: 18 }}>
          <PyaGrowth pya={firstTimersKpi.target} actual={firstTimersKpi.actual} formatter={commas} />
        </div>

        <div className="body-muted" style={{ marginBottom: 12 }}>
          Discipleship Pipeline: Evangelized → Pre-Encounter → Encounter → Post-Encounter → Water Baptized
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {firstTimerFunnel.map((stage, i) => (
            <div key={stage.label}>
              <div style={{ display: 'flex' }}>
                <div style={{ flex: 1, fontSize: 14 }}>{stage.label}</div>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{stage.count}</div>
              </div>
              <div style={{ marginTop: 4, height: 8, borderRadius: 6, background: 'var(--surface-muted)', overflow: 'hidden' }}>
                <div
                  style={{
                    width: `${(stage.count / maxCount) * 100}%`,
                    height: '100%',
                    background: funnelPalette[i % funnelPalette.length],
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </SectionBlock>

      {/* --- Workers --- */}
      <SectionBlock title="Workers" subtitle="Summed across all areas — edit per-area figures in Admin Console → Area People">
        <div style={{ display: 'flex', gap: 32, flexWrap: 'wrap' }}>
          <Fact label="Full-time" value={commas(workers.fullTime)} />
          <Fact label="Part-time" value={commas(workers.partTime)} />
          <Fact label="Volunteer" value={commas(workers.volunteer)} />
          <Fact label="Total" value={commas(workers.total)} />
        </div>
      </SectionBlock>

      {/* --- Trends (PYA + monthly, church-wide and per-area) --- */}
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>Trends</h2>
        <div className="body-muted" style={{ marginBottom: 14 }}>
          Each chart's first bar is PYA (dashed line marks it across the whole chart) — the rest are the real monthly trend.
        </div>

        {monthlySeriesLoading ? (
          <LoadingSpinner label="Loading trend charts..." />
        ) : monthlySeriesError ? (
          <div className="card" style={{ textAlign: 'center', padding: 24 }}>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>Couldn't load trend charts</div>
            <div className="body-muted" style={{ marginBottom: 14 }}>
              {monthlySeriesError}
            </div>
            <button
              onClick={refetchMonthlySeries}
              style={{ padding: '9px 16px', borderRadius: 8, border: 'none', background: 'var(--primary)', color: 'white', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}
            >
              Try again
            </button>
          </div>
        ) : (
          monthlySeries && (
            <>
              <SectionBlock title="Church-Wide">
                <TrendsGrid series={monthlySeries.total} />
              </SectionBlock>

              <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
                {monthlySeries.byArea.map((a) => (
                  <button
                    key={a.areaName}
                    onClick={() => setTrendArea(a.areaName)}
                    style={{
                      padding: '7px 14px',
                      borderRadius: 999,
                      border: '1px solid var(--line)',
                      background: (trendArea || monthlySeries.byArea[0]?.areaName) === a.areaName ? 'var(--primary)' : 'var(--surface)',
                      color: (trendArea || monthlySeries.byArea[0]?.areaName) === a.areaName ? 'white' : 'var(--ink)',
                      fontSize: 12.5,
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    {a.areaName}
                  </button>
                ))}
              </div>

              {monthlySeries.byArea
                .filter((a) => a.areaName === (trendArea || monthlySeries.byArea[0]?.areaName))
                .map((a) => (
                  <SectionBlock key={a.areaName} title={a.areaName} subtitle={a.isMainChurch ? 'Main Church' : 'Extension Church'}>
                    <TrendsGrid series={a} />
                  </SectionBlock>
                ))}
            </>
          )
        )}
      </div>

      {/* --- By Area (unchanged) --- */}
      {areaPeopleStats && areaPeopleStats.length > 0 && (
        <div className="card" style={{ marginTop: 8, padding: 8, overflowX: 'auto' }}>
          <div style={{ padding: '12px 12px 4px' }}>
            <h2 style={{ fontSize: 15, fontWeight: 700 }}>By Area</h2>
            <div className="body-muted" style={{ marginTop: 2 }}>
              Membership, attendance, first-timers, and workers for the Main Church and each Extension Church.
            </div>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 720, marginTop: 8 }}>
            <thead>
              <tr style={{ background: 'var(--surface-muted)' }}>
                {['Area', 'Membership', 'Attendance', 'First Timers', 'Workers'].map((h) => (
                  <th key={h} style={{ textAlign: 'left', padding: '10px 14px', fontSize: 12.5, fontWeight: 700, color: 'var(--ink-muted)' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {areaPeopleStats.map((a) => (
                <tr key={a.id} style={{ borderTop: '1px solid var(--line)' }}>
                  <td style={{ padding: '10px 14px' }}>
                    <div style={{ fontWeight: 700, fontSize: 13.5 }}>{a.areaName}</div>
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        padding: '2px 7px',
                        borderRadius: 999,
                        color: a.isMainChurch ? '#00698c' : '#256e42',
                        background: a.isMainChurch ? '#e0f7ff' : '#e8f8ee',
                      }}
                    >
                      {a.isMainChurch ? 'MAIN CHURCH' : 'EXTENSION CHURCH'}
                    </span>
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    <div style={{ fontSize: 13.5, fontWeight: 600 }}>
                      {a.membershipActual} / {a.membershipTarget}
                    </div>
                    <StatusBadge status={a.membershipStatus} compact />
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    <div style={{ fontSize: 13.5, fontWeight: 600 }}>
                      {a.attendanceActual.toFixed(0)} / {a.attendanceTarget.toFixed(0)}
                    </div>
                    <StatusBadge status={a.attendanceStatus} compact />
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    <div style={{ fontSize: 13.5, fontWeight: 600 }}>
                      {a.firstTimersActual} / {a.firstTimersTarget}
                    </div>
                    <StatusBadge status={a.firstTimersStatus} compact />
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    <div style={{ fontSize: 13.5, fontWeight: 600 }}>{a.totalWorkers}</div>
                    <div className="caption">{a.volunteerWorkers} volunteer</div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function TrendsGrid({ series }) {
  const charts = [
    ['attendance', 'Sunday Service Attendance', (v) => v.toFixed(0)],
    ['firstTimers', 'First Timers', commas],
    ['totalWorkers', 'Workers', commas],
  ]
  return (
    <div>
      {charts.map(([key, label, formatter]) => (
        <div key={key} style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 2 }}>{label}</div>
          <PyaBarChart pya={series[key]?.pya || 0} months={series[key]?.months || []} color="var(--primary)" valueFormatter={formatter} height={180} />
        </div>
      ))}
    </div>
  )
}

function SectionBlock({ title, subtitle, children }) {
  return (
    <div className="card" style={{ marginBottom: 20 }}>
      <h2 style={{ fontSize: 15, fontWeight: 700 }}>{title}</h2>
      {subtitle && (
        <div className="body-muted" style={{ marginTop: 2, marginBottom: 4 }}>
          {subtitle}
        </div>
      )}
      <div style={{ marginTop: 12 }}>{children}</div>
    </div>
  )
}

function Fact({ label, value, color }) {
  return (
    <div>
      <div className="label">{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, marginTop: 3, color: color || 'var(--ink)' }}>{value}</div>
    </div>
  )
}
