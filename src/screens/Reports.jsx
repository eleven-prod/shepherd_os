import SectionHeader from '../components/SectionHeader'
import { LoadingSpinner } from '../components/Spinner'
import PeriodSelector from '../components/PeriodSelector'
import PyaBarChart from '../components/PyaBarChart'
import { usePeriod } from '../context/PeriodContext'
import { peso, commas } from '../data/api'
import { UNREPORTED_MONTHS } from '../data/periods'

export default function Reports() {
  const { selected, metrics, loading, error, refetch, monthlySeries, monthlySeriesLoading } = usePeriod()

  return (
    <div className="scroll-page" style={{ maxWidth: 900 }}>
      <SectionHeader
        title="Reports"
        subtitle="Real figures for whatever period you pick below — not a fixed weekly/monthly template."
        trailing={<PeriodSelector />}
      />

      <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: 10,
            background: 'var(--accent-soft)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 18,
            color: 'var(--accent)',
            flexShrink: 0,
          }}
        >
          ▤
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 700, overflowWrap: 'break-word' }}>{selected?.label}</div>
          <div className="body-muted" style={{ overflowWrap: 'break-word' }}>Church-wide totals for this period, from the original POR data.</div>
        </div>
      </div>

      {loading ? (
        <LoadingSpinner label="Loading real figures for this period..." />
      ) : error ? (
        <div className="card" style={{ textAlign: 'center', padding: 24 }}>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>Couldn't load this period</div>
          <div className="body-muted" style={{ marginBottom: 14 }}>
            {error}
          </div>
          <button
            onClick={refetch}
            style={{
              padding: '9px 16px',
              borderRadius: 8,
              border: 'none',
              background: 'var(--primary)',
              color: 'white',
              fontWeight: 700,
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            Try again
          </button>
        </div>
      ) : (
        metrics && (
          <>
            <ReportSection title="Attendance & Membership">
              <MetricRow
                label="Average Weekly Attendance"
                actual={metrics.total.attendance.actual.toFixed(0)}
                target={metrics.total.attendance.target.toFixed(0)}
              />
              {monthlySeries && (
                <PyaBarChart pya={monthlySeries.total.attendance.pya} months={monthlySeries.total.attendance.months} color="var(--primary)" valueFormatter={(v) => v.toFixed(0)} />
              )}
              <MetricRow label="First Timers" actual={commas(metrics.total.firstTimers.actual)} target={commas(metrics.total.firstTimers.target)} />
              {monthlySeries && (
                <PyaBarChart pya={monthlySeries.total.firstTimers.pya} months={monthlySeries.total.firstTimers.months} color="var(--accent)" valueFormatter={commas} />
              )}
              <MetricRow label="Total Membership (as of period)" actual={commas(metrics.total.membership.actual)} target={null} />
            </ReportSection>

            <ReportSection title="Financial">
              <MetricRow label="Tithes" actual={peso(metrics.total.tithes.actual)} target={peso(metrics.total.tithes.target)} />
              {monthlySeries && (
                <PyaBarChart pya={monthlySeries.total.tithes.pya} months={monthlySeries.total.tithes.months} color="var(--accent)" valueFormatter={(v) => `₱${(v / 1000).toFixed(0)}K`} />
              )}
              <MetricRow label="Offerings" actual={peso(metrics.total.offerings.actual)} target={peso(metrics.total.offerings.target)} />
              <MetricRow label="Mission Offering" actual={peso(metrics.total.missionOffering.actual)} target={peso(metrics.total.missionOffering.target)} />
              <MetricRow label="Pledges" actual={peso(metrics.total.pledges.actual)} target={peso(metrics.total.pledges.target)} />
              <MetricRow label="Total Giving" actual={peso(metrics.total.totalGiving.actual)} target={peso(metrics.total.totalGiving.target)} bold />
              {monthlySeries && (
                <PyaBarChart
                  pya={monthlySeries.total.totalGiving.pya}
                  months={monthlySeries.total.totalGiving.months}
                  color="var(--primary)"
                  valueFormatter={(v) => `₱${(v / 1000).toFixed(0)}K`}
                />
              )}
            </ReportSection>

            <ReportSection title="Life Groups">
              <MetricRow label="Life Group Membership (as of period)" actual={commas(metrics.total.lifeGroupMembership.actual)} target={null} />
              {monthlySeries && (
                <PyaBarChart
                  pya={monthlySeries.total.lifeGroupMembership.pya}
                  months={monthlySeries.total.lifeGroupMembership.months}
                  color="var(--accent)"
                  valueFormatter={commas}
                />
              )}
            </ReportSection>

            {monthlySeriesLoading && (
              <div className="caption" style={{ marginBottom: 12 }}>
                Loading monthly trend charts...
              </div>
            )}

            <div style={{ marginBottom: 18 }}>
              <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>By Area</h2>
              <div className="card" style={{ padding: 8, overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 680 }}>
                  <thead>
                    <tr style={{ background: 'var(--surface-muted)' }}>
                      {['Area', 'Membership', 'Attendance', 'First Timers', 'Total Giving'].map((h) => (
                        <th key={h} style={{ textAlign: 'left', padding: '8px 12px', fontSize: 12, fontWeight: 700, color: 'var(--ink-muted)' }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {metrics.byArea.map((a) => (
                      <tr key={a.areaName} style={{ borderTop: '1px solid var(--line)' }}>
                        <td style={{ padding: '8px 12px', fontWeight: 700, fontSize: 13 }}>{a.areaName}</td>
                        <td style={{ padding: '8px 12px', fontSize: 13 }}>{commas(a.membership.actual)}</td>
                        <td style={{ padding: '8px 12px', fontSize: 13 }}>{a.attendance.actual.toFixed(0)}</td>
                        <td style={{ padding: '8px 12px', fontSize: 13 }}>{commas(a.firstTimers.actual)}</td>
                        <td style={{ padding: '8px 12px', fontSize: 13 }}>{peso(a.totalGiving.actual)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {selected?.months.some((m) => UNREPORTED_MONTHS.has(m)) && (
              <div className="caption" style={{ marginTop: 4 }}>
                Note: this period includes a month not yet reported in the source data — figures reflect only the months that were.
              </div>
            )}
          </>
        )
      )}
    </div>
  )
}

function ReportSection({ title, children }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>{title}</h2>
      <div className="card" style={{ padding: '4px 16px' }}>
        {children}
      </div>
    </div>
  )
}

function MetricRow({ label, actual, target, bold }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--line)' }}>
      <div style={{ flex: 1, minWidth: 0, fontSize: 14, fontWeight: bold ? 700 : 400, overflowWrap: 'break-word' }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 700 }}>
        {actual}
        {target != null && <span className="body-muted" style={{ fontWeight: 400 }}> {' '}/ {target} target</span>}
      </div>
    </div>
  )
}
