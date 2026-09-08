import { useState } from 'react'
import SectionHeader from '../components/SectionHeader'
import KpiStatCard from '../components/KpiStatCard'
import BarangayMap from '../components/BarangayMap'
import AttentionTile from '../components/AttentionTile'
import StatusBadge from '../components/StatusBadge'
import TrendChart from '../components/TrendChart'
import AchievementBar from '../components/AchievementBar'
import DonutChart from '../components/DonutChart'
import RankingBarChart from '../components/RankingBarChart'
import { peso, commas, statusFromAchievement } from '../data/api'
import { useAppData } from '../context/DataContext'

export default function Dashboard() {
  const { data } = useAppData()
  const [selected, setSelected] = useState(null)

  const {
    lifeGroupHeadcountKpi,
    firstTimersKpi,
    attendanceKpi,
    financialKpi,
    financialCategories,
    geographicCoverageKpi,
    lifeGroupAchievementPct,
    firstTimerAchievementPct,
    financialAchievementPct,
    reachAchievementPct,
    barangays,
    barangaysReached,
    totalBarangays,
    attentionItems,
    lifeGroups,
    totalLifeGroups,
    totalMembers,
    activeMembers,
    inactiveMembers,
    membershipGrowthPct,
  } = data

  const healthy = lifeGroups.filter((g) => g.achievementPct >= 100).length
  const attention = lifeGroups.filter((g) => g.achievementPct >= 80 && g.achievementPct < 100).length
  const critical = lifeGroups.filter((g) => g.achievementPct < 80).length

  // Overall Health — one glance answer to "how are we doing right now?",
  // averaged across the 5 pillars this page covers.
  const overallHealthPct =
    (lifeGroupAchievementPct + firstTimerAchievementPct + financialAchievementPct + reachAchievementPct + attendanceKpi.achievementPct) / 5
  const overallStatus = statusFromAchievement(overallHealthPct)

  return (
    <div className="scroll-page">
      <SectionHeader title="Main Overview" subtitle="See the church. Measure the mission. Manage the ministry." />

      {/* --- Overall Health --- */}
      <div className="card" style={{ marginBottom: 20, display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
        <div>
          <div className="label">Overall Health</div>
          <div className="stat-large" style={{ marginTop: 6, fontSize: 'var(--font-hero)' }}>
            {overallHealthPct.toFixed(0)}%
          </div>
        </div>
        <StatusBadge status={overallStatus} />
        <div className="body-muted" style={{ flex: 1, minWidth: 200 }}>
          Average achievement across Life Groups, First Timers, Attendance, Financial, and Geographic Reach.
        </div>
      </div>

      {/* --- Reach (map) + Immediate Attention --- */}
      <div className="two-col" style={{ marginBottom: 20 }}>
        <div className="card">
          <BarangayMap barangays={barangays} selectedName={selected?.name} onSelect={setSelected} />
        </div>

        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ color: 'var(--accent)' }}>⚑</span>
            <h2 style={{ fontSize: 15, fontWeight: 700 }}>Needs Attention</h2>
          </div>
          <div className="body-muted" style={{ marginTop: 4, marginBottom: 14 }}>
            Don&apos;t search for problems — see them.
          </div>
          <div className="attention-grid" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {attentionItems.slice(0, 4).map((item) => (
              <AttentionTile key={item.id ?? item.title} item={item} />
            ))}
          </div>
        </div>
      </div>

      <div className="kpi-row" style={{ marginBottom: 28 }}>
        <KpiStatCard
          label="LIFE GROUPS"
          achievementPct={lifeGroupAchievementPct}
          subtitle={`${lifeGroupHeadcountKpi.actual} / ${lifeGroupHeadcountKpi.target} headcount`}
          trend={lifeGroupHeadcountKpi.trend}
        />
        <KpiStatCard
          label="FIRST TIMERS"
          achievementPct={firstTimerAchievementPct}
          subtitle={`${firstTimersKpi.actual} / ${firstTimersKpi.target} this month`}
          trend={firstTimersKpi.trend}
        />
        <KpiStatCard
          label="FINANCIAL"
          achievementPct={financialAchievementPct}
          subtitle={`${peso(financialKpi.actual)} of ${peso(financialKpi.target)}`}
          trend={financialKpi.trend}
        />
        <KpiStatCard
          label="GEOGRAPHIC REACH"
          achievementPct={reachAchievementPct}
          subtitle={`${barangaysReached} / ${totalBarangays} barangays`}
          trend={geographicCoverageKpi.trend}
        />
      </div>

      {/* --- People --- */}
      <PillarSection title="People">
        <div className="two-col-reverse">
          <div>
            <Stat value={commas(totalMembers)} label="Total Members" />
            <div style={{ display: 'flex', gap: 28, marginTop: 16, flexWrap: 'wrap' }}>
              <Stat value={commas(activeMembers)} label="Category 2" />
              <Stat value={commas(inactiveMembers)} label="Not in Category 2" />
              <Stat value={`+${membershipGrowthPct}%`} label="Growth" color="var(--status-on-target)" />
            </div>
          </div>
          <div>
            <DonutChart
              segments={[
                { label: 'In Category 2', value: activeMembers, color: '#3c76f1' },
                { label: 'Not in Category 2', value: inactiveMembers, color: '#ffbb38' },
              ]}
              centerValue={commas(totalMembers)}
              centerLabel="Total"
              height={160}
            />
          </div>
        </div>
      </PillarSection>

      {/* --- Attendance --- */}
      <PillarSection title="Attendance">
        <div style={{ display: 'flex' }}>
          <div style={{ flex: 1 }} />
          <StatusBadge status={attendanceKpi.status} />
        </div>
        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', marginTop: 10 }}>
          <Stat value={attendanceKpi.actual.toFixed(0)} label="Average" />
          <Stat value={attendanceKpi.target.toFixed(0)} label="Target (PYA)" />
          <Stat value={`${attendanceKpi.achievementPct.toFixed(1)}%`} label="Achievement" />
        </div>
        <div style={{ marginTop: 14 }}>
          <TrendChart points={attendanceKpi.trend} color="var(--primary)" />
        </div>
      </PillarSection>

      {/* --- Financial --- */}
      <PillarSection title="Financial">
        <div style={{ display: 'flex', gap: 32, flexWrap: 'wrap', marginBottom: 16 }}>
          <Stat value={peso(financialKpi.actual)} label="This Month" />
          <Stat value={peso(financialKpi.target)} label="Target (PYA)" />
          <Stat value={`${financialKpi.achievementPct.toFixed(1)}%`} label="Achievement" />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {financialCategories.map((cat) => (
            <AchievementBar key={cat.name} label={cat.name} target={cat.target} actual={cat.actual} formatter={peso} />
          ))}
        </div>
      </PillarSection>

      {/* --- Life Groups --- */}
      <PillarSection title="Life Groups">
        <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap', marginBottom: 16 }}>
          <Stat value={totalLifeGroups} label="Groups" />
          <Stat value={`${lifeGroupHeadcountKpi.actual} / ${lifeGroupHeadcountKpi.target}`} label="Headcount" />
          <Stat value={healthy} label="Healthy" color="var(--status-on-target)" />
          <Stat value={attention} label="Attention" color="var(--status-attention)" />
          <Stat value={critical} label="Critical" color="var(--status-critical)" />
        </div>
        <div className="body-muted" style={{ marginBottom: 8, fontSize: 13 }}>
          By Church — Achievement Ranking
        </div>
        <RankingBarChart data={lifeGroups.map((g) => ({ label: g.name, value: g.achievementPct }))} />
      </PillarSection>
    </div>
  )
}

function PillarSection({ title, children }) {
  return (
    <div className="card" style={{ marginBottom: 20 }}>
      <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 14 }}>{title}</h2>
      {children}
    </div>
  )
}

function Stat({ value, label, color }) {
  return (
    <div>
      <div style={{ fontSize: 24, fontWeight: 800, color: color || 'var(--ink)' }}>{value}</div>
      <div className="label" style={{ marginTop: 2 }}>
        {label}
      </div>
    </div>
  )
}
