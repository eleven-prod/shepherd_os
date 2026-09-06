import { useState } from 'react'
import SectionHeader from '../components/SectionHeader'
import BarangayMap from '../components/BarangayMap'
import TrendChart from '../components/TrendChart'
import { useAppData } from '../context/DataContext'

export default function GeographicReach() {
  const { data } = useAppData()
  const { barangays, totalBarangays, barangaysReached, geographicCoverageKpi, reachTargetPct } = data
  const [selected, setSelected] = useState(null)
  const gap = reachTargetPct - geographicCoverageKpi.actual

  const tiles = [
    ['Total Barangays', totalBarangays, null],
    ['Barangays Reached', barangaysReached, null],
    ['Coverage', `${geographicCoverageKpi.actual.toFixed(0)}%`, null],
    ['Gap to Target', `${gap.toFixed(0)}%`, 'var(--status-attention)'],
  ]

  return (
    <div className="scroll-page">
      <SectionHeader
        title="Geographic Reach"
        subtitle="Which barangays are we reaching — and where should outreach focus next?"
      />

      <div className="two-col">
        <div className="card">
          <h2 style={{ fontSize: 15, fontWeight: 700 }}>Reach Map</h2>
          <div className="body-muted" style={{ marginTop: 4, marginBottom: 14 }}>
            Click a barangay for detail
          </div>
          <BarangayMap barangays={barangays} selectedName={selected?.name} onSelect={setSelected} />
        </div>

        <div className="card">
          {!selected ? (
            <>
              <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>Coverage Trend</h2>
              <TrendChart points={geographicCoverageKpi.trend} color="var(--primary)" valueFormatter={(v) => `${v}%`} />
              <div className="body-muted" style={{ marginTop: 8 }}>
                Select a barangay on the map to see its detail here.
              </div>
            </>
          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <h2 style={{ fontSize: 15, fontWeight: 700, flex: 1, minWidth: 0, overflowWrap: 'break-word' }}>{selected.name}</h2>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    padding: '4px 10px',
                    borderRadius: 999,
                    color: selected.isMainChurch
                      ? '#00698c'
                      : selected.extensionChurch
                        ? '#256e42'
                        : selected.reached && selected.active === false
                          ? '#867a59'
                          : selected.reached
                            ? '#7f5833'
                            : '#797976',
                    background: selected.isMainChurch
                      ? '#e0f7ff'
                      : selected.extensionChurch
                        ? '#e8f8ee'
                        : selected.reached && selected.active === false
                          ? '#fdfbf3'
                          : selected.reached
                            ? '#fcf3eb'
                            : '#fafafa',
                  }}
                >
                  {selected.isMainChurch
                    ? 'Main Church'
                    : selected.extensionChurch
                      ? 'Extension Church'
                      : selected.reached && selected.active === false
                        ? 'Reached (Inactive)'
                        : selected.reached
                          ? 'Reached (Active)'
                          : 'Not Reached'}
                </span>
              </div>
              <div className="body-muted">
                {selected.area} · Pop. {selected.population}
              </div>
              <div style={{ marginTop: 16 }}>
                {selected.reached ? (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20 }}>
                    <Fact label="People Reached" value={selected.peopleReached} />
                    <Fact label="First Timers" value={selected.firstTimers} />
                    <Fact label="Life Groups" value={selected.lifeGroups} />
                    <Fact label="Households" value={selected.householdsReached} />
                    <Fact label="Outreach Activities" value={selected.outreachActivities} />
                    <Fact label="Growth" value={`${selected.growthPct >= 0 ? '+' : ''}${selected.growthPct.toFixed(0)}%`} />
                  </div>
                ) : (
                  <div className="body-muted">
                    No recorded outreach activity yet. Consider prioritizing this barangay for the next outreach cycle.
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', margin: '20px 0' }}>
        {tiles.map(([label, value, color]) => (
          <div className="card" key={label} style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <div className="label">{label}</div>
            <div style={{ fontSize: 26, fontWeight: 800, marginTop: 8, color: color || 'var(--ink)' }}>{value}</div>
          </div>
        ))}
      </div>

      <div className="card" style={{ marginTop: 20 }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>All Tracked Barangays</h2>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {barangays.map((b) => (
            <div
              key={b.name}
              onClick={() => setSelected(b)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '8px 4px',
                cursor: 'pointer',
                borderRadius: 8,
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface-muted)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  border: '1px solid rgba(0,0,0,0.15)',
                  background: b.isMainChurch
                    ? '#00BFFF'
                    : b.extensionChurch
                      ? '#45C978'
                      : b.reached && b.active === false
                        ? '#F4DFA3'
                        : b.reached
                          ? '#E8A05E'
                          : '#DDDCD8',
                  flexShrink: 0,
                }}
              />
              <div style={{ flex: 1, minWidth: 0, fontSize: 14, overflowWrap: 'break-word' }}>
                {b.name}
                {b.isMainChurch && (
                  <span
                    style={{
                      marginLeft: 8,
                      fontSize: 10,
                      fontWeight: 700,
                      color: '#00698c',
                      background: '#e0f7ff',
                      padding: '2px 6px',
                      borderRadius: 999,
                    }}
                  >
                    MAIN CHURCH
                  </span>
                )}
                {b.extensionChurch && (
                  <span
                    style={{
                      marginLeft: 8,
                      fontSize: 10,
                      fontWeight: 700,
                      color: '#256e42',
                      background: '#e8f8ee',
                      padding: '2px 6px',
                      borderRadius: 999,
                    }}
                  >
                    EXTENSION CHURCH
                  </span>
                )}
                {b.reached && !b.isMainChurch && !b.extensionChurch && b.active === false && (
                  <span
                    style={{
                      marginLeft: 8,
                      fontSize: 10,
                      fontWeight: 700,
                      color: '#867a59',
                      background: '#fdfbf3',
                      padding: '2px 6px',
                      borderRadius: 999,
                    }}
                  >
                    INACTIVE
                  </span>
                )}
              </div>
              <div className="body-muted">{b.area}</div>
              <div className="body-muted" style={{ width: 90, textAlign: 'right' }}>
                {b.reached ? `${b.peopleReached} people` : '—'}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function Fact({ label, value }) {
  return (
    <div style={{ width: 130 }}>
      <div className="label">{label}</div>
      <div style={{ fontSize: 18, fontWeight: 700, marginTop: 2 }}>{value}</div>
    </div>
  )
}
