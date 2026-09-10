import SectionHeader from '../components/SectionHeader'
import StatusBadge from '../components/StatusBadge'
import AchievementBar from '../components/AchievementBar'
import PyaGrowth from '../components/PyaGrowth'
import PyaBarThenLineChart from '../components/PyaBarThenLineChart'
import PyaBarChart from '../components/PyaBarChart'
import PyaTargetActualBars from '../components/PyaTargetActualBars'
import { peso, commas, statusFromAchievement, achievementPct } from '../data/api'
import { useAppData } from '../context/DataContext'
import { usePeriodMode } from '../components/PeriodModeBar'

export default function Financial() {
  const { data } = useAppData()
  const { financialKpi: liveKpi, numberOfTithersKpi: liveNumberOfTithersKpi, financialCategories, areaFinancialStats: liveAreaFinancialStats, activeMembers } = data
  const { bar: periodBar, isHistorical, metrics, loading: metricsLoading, error: metricsError, refetch: refetchMetrics, monthlySeries } = usePeriodMode()

  // In Historical mode, swap the live "This Month" figures (from the
  // kpis table, kept current by Data Entry) for the selected past
  // period's real figures from the POR import — same data Reports
  // already shows, same {actual, target} shape, just without a
  // pre-computed status, so that's derived here to match.
  const kpi = isHistorical
    ? {
        actual: metrics?.total?.totalGiving?.actual ?? 0,
        target: metrics?.total?.totalGiving?.target ?? 0,
        status: statusFromAchievement(achievementPct(metrics?.total?.totalGiving?.actual ?? 0, metrics?.total?.totalGiving?.target ?? 0)),
      }
    : liveKpi
  const numberOfTithersKpi = isHistorical
    ? liveNumberOfTithersKpi && {
        actual: metrics?.total?.numberOfTithers?.actual ?? 0,
        target: metrics?.total?.numberOfTithers?.target ?? 0,
        status: statusFromAchievement(achievementPct(metrics?.total?.numberOfTithers?.actual ?? 0, metrics?.total?.numberOfTithers?.target ?? 0)),
      }
    : liveNumberOfTithersKpi
  const areaFinancialStats = isHistorical
    ? metrics?.byArea?.map((a) => ({
        id: a.areaName,
        areaName: a.areaName,
        isMainChurch: a.isMainChurch,
        tithesActual: a.tithes.actual,
        offeringsActual: a.offerings.actual,
        missionOfferingActual: a.missionOffering.actual,
        pledgesActual: a.pledges.actual,
        totalGivingActual: a.totalGiving.actual,
        totalGivingStatus: statusFromAchievement(achievementPct(a.totalGiving.actual, a.totalGiving.target)),
      }))
    : liveAreaFinancialStats

  const givingPya = monthlySeries?.total?.totalGiving?.pya || 0
  const growthTarget = givingPya * 1.3
  const remainingNeeded = growthTarget - kpi.actual

  // Same convention as Worship Service Attendance's target on the
  // Membership screen: 60% of Category 2's live (Admin-editable) Actual
  // value, not a fixed PYA-based figure — so it updates automatically if
  // Category 2 changes.
  const tithersTarget = (activeMembers || 0) * 0.6

  return (
    <div className="scroll-page">
      <SectionHeader title="Financial Status" subtitle="Monitoring only — not a replacement for full accounting" />
      {periodBar}

      {isHistorical && metricsLoading && <div className="body-muted" style={{ marginBottom: 16 }}>Loading figures for this period...</div>}
      {isHistorical && metricsError && (
        <div className="card" style={{ textAlign: 'center', padding: 24, marginBottom: 20 }}>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>Couldn't load this period</div>
          <div className="body-muted" style={{ marginBottom: 14 }}>
            {metricsError}
          </div>
          <button
            onClick={refetchMetrics}
            style={{ padding: '9px 16px', borderRadius: 8, border: 'none', background: 'var(--primary)', color: 'white', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}
          >
            Try again
          </button>
        </div>
      )}

      <div className="card">
        <div style={{ display: 'flex', gap: 20, alignItems: 'stretch', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 220, border: '1px solid var(--line)', borderRadius: 10, padding: '16px 20px' }}>
            <h2 style={{ fontSize: 15, fontWeight: 700 }}>Total Tithes and Offering — This Month</h2>
            <div style={{ marginTop: 16 }}>
              <PyaGrowth pya={kpi.target} actual={kpi.actual} formatter={peso} />
            </div>

            {growthTarget > 0 && (
              <div style={{ marginTop: 18 }}>
                <AchievementBar label="30% Increase of PYA vs AA" target={growthTarget} actual={kpi.actual} formatter={peso} />
                <div className="caption" style={{ marginTop: 6 }}>
                  {remainingNeeded > 0 ? (
                    <>{peso(remainingNeeded)} more needed to reach the growth target.</>
                  ) : (
                    <span style={{ color: 'var(--status-on-target)', fontWeight: 700 }}>
                      Target reached — {peso(Math.abs(remainingNeeded))} over.
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', alignItems: 'flex-end' }}>
            <StatusBadge status={kpi.status} />
            {growthTarget > 0 && (
              <div style={{ border: '1px solid var(--line)', borderRadius: 10, padding: '12px 16px' }}>
                <PyaTargetActualBars pya={givingPya} target={growthTarget} actual={kpi.actual} valueFormatter={peso} maxHeight={190} />
              </div>
            )}
          </div>
        </div>

        <div style={{ border: '1px solid var(--line)', borderRadius: 10, padding: '16px 20px', marginTop: 18 }}>
          <div className="body-muted" style={{ marginBottom: 4, fontSize: 13 }}>
            Monthly Trend — Month-to-Month
          </div>
          <PyaBarThenLineChart
            months={monthlySeries?.total?.totalGiving?.months || []}
            color="var(--accent)"
            valueFormatter={peso}
          />
        </div>
      </div>

      {numberOfTithersKpi && (
        <div className="card" style={{ marginTop: 20 }}>
          <div style={{ display: 'flex', gap: 20, alignItems: 'stretch', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 220, border: '1px solid var(--line)', borderRadius: 10, padding: '16px 20px' }}>
              <h2 style={{ fontSize: 15, fontWeight: 700 }}>Number of Tithers — This Month</h2>
              <div style={{ marginTop: 16 }}>
                <PyaGrowth pya={numberOfTithersKpi.target} actual={numberOfTithersKpi.actual} formatter={commas} />
              </div>
              {tithersTarget > 0 && (
                <div className="caption" style={{ marginTop: 10 }}>
                  Target is set at 60% of Category 2 ({commas(activeMembers)}) — real figure: {commas(Math.round(tithersTarget))}.
                </div>
              )}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', alignItems: 'flex-end' }}>
              <StatusBadge status={numberOfTithersKpi.status} />
              <div style={{ border: '1px solid var(--line)', borderRadius: 10, padding: '12px 16px' }}>
                <PyaTargetActualBars
                  pya={numberOfTithersKpi.target}
                  target={tithersTarget > 0 ? tithersTarget : null}
                  actual={numberOfTithersKpi.actual}
                  valueFormatter={commas}
                  maxHeight={130}
                />
              </div>
            </div>
          </div>
          <div style={{ border: '1px solid var(--line)', borderRadius: 10, padding: '16px 20px', marginTop: 18 }}>
            <div className="body-muted" style={{ marginBottom: 4, fontSize: 13 }}>
              Monthly Trend
            </div>
            <PyaBarChart
              pya={numberOfTithersKpi.target}
              months={monthlySeries?.total?.numberOfTithers?.months || []}
              color="var(--primary)"
              valueFormatter={(v) => commas(Math.round(v))}
            />
          </div>
        </div>
      )}

      <div className="card" style={{ marginTop: 20 }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>By Category</h2>
        <div className="caption" style={{ marginBottom: 14 }}>
          Bars compare Actual against PYA (Previous Year Accomplishment)
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {financialCategories.map((cat) => {
            const growthPct = cat.target > 0 ? ((cat.actual - cat.target) / cat.target) * 100 : null
            return (
              <div key={cat.name}>
                <AchievementBar label={cat.name} target={cat.target} actual={cat.actual} formatter={peso} />
                {growthPct != null && (
                  <div
                    className="caption"
                    style={{
                      marginTop: 2,
                      color: growthPct >= 0 ? 'var(--status-on-target)' : 'var(--status-critical)',
                      fontWeight: 700,
                    }}
                  >
                    {growthPct >= 0 ? '+' : ''}
                    {growthPct.toFixed(1)}% vs PYA
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {areaFinancialStats && areaFinancialStats.length > 0 && (
        <div className="card" style={{ marginTop: 20, padding: 8, overflowX: 'auto' }}>
          <div style={{ padding: '12px 12px 4px' }}>
            <h2 style={{ fontSize: 15, fontWeight: 700 }}>By Area</h2>
            <div className="body-muted" style={{ marginTop: 2 }}>
              Tithes, Offerings, Mission Offering, and Pledges for the Main Church and each Extension Church.
            </div>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 780, marginTop: 8 }}>
            <thead>
              <tr style={{ background: 'var(--surface-muted)' }}>
                {['Area', 'Tithes', 'Offerings', 'Mission Offering', 'Pledges', 'Total Giving'].map((h) => (
                  <th key={h} style={{ textAlign: 'left', padding: '10px 14px', fontSize: 12.5, fontWeight: 700, color: 'var(--ink-muted)' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {areaFinancialStats.map((a) => (
                <tr key={a.id} style={{ borderTop: '1px solid var(--line)' }}>
                  <td style={{ padding: '10px 14px' }}>
                    <div style={{ fontWeight: 700, fontSize: 13.5 }}>{a.areaName}</div>
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        color: a.isMainChurch ? '#00698c' : '#256e42',
                      }}
                    >
                      {a.isMainChurch ? 'Main Church' : 'Extension Church'}
                    </span>
                  </td>
                  <td style={{ padding: '10px 14px', fontSize: 13.5 }}>{peso(a.tithesActual)}</td>
                  <td style={{ padding: '10px 14px', fontSize: 13.5 }}>{peso(a.offeringsActual)}</td>
                  <td style={{ padding: '10px 14px', fontSize: 13.5 }}>{peso(a.missionOfferingActual)}</td>
                  <td style={{ padding: '10px 14px', fontSize: 13.5 }}>{peso(a.pledgesActual)}</td>
                  <td style={{ padding: '10px 14px' }}>
                    <div style={{ fontSize: 13.5, fontWeight: 700 }}>{peso(a.totalGivingActual)}</div>
                    <StatusBadge status={a.totalGivingStatus} compact />
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
