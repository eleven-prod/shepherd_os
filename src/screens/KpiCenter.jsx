import { useState } from 'react'
import SectionHeader from '../components/SectionHeader'
import StatusBadge from '../components/StatusBadge'
import AchievementBar from '../components/AchievementBar'
import { commas, peso, createKpiTarget } from '../data/api'
import { useAppData } from '../context/DataContext'

export default function KpiCenter() {
  const { data, refetch } = useAppData()
  const [sheetOpen, setSheetOpen] = useState(false)

  const grouped = {}
  for (const k of data.allKpis) {
    grouped[k.category] = grouped[k.category] || []
    grouped[k.category].push(k)
  }

  return (
    <div className="scroll-page">
      <SectionHeader
        title="KPI Center"
        subtitle="Every KPI: Target → Actual → Achievement → Variance → Status → Trend"
        trailing={
          <button
            onClick={() => setSheetOpen(true)}
            style={{
              background: 'var(--primary)',
              color: 'white',
              border: 'none',
              borderRadius: 10,
              padding: '10px 16px',
              fontWeight: 700,
              fontSize: 13.5,
              cursor: 'pointer',
            }}
          >
            + New Target
          </button>
        }
      />

      {Object.entries(grouped).map(([category, kpis]) => (
        <div key={category} style={{ marginBottom: 8 }}>
          <div className="label" style={{ margin: '12px 0 10px' }}>
            {category.toUpperCase()}
          </div>
          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
            {kpis.map((k) => (
              <KpiCard key={k.id ?? k.name} kpi={k} />
            ))}
          </div>
        </div>
      ))}

      {sheetOpen && <NewTargetSheet onClose={() => setSheetOpen(false)} onCreated={refetch} />}
    </div>
  )
}

function KpiCard({ kpi }) {
  const formatter = kpi.unit === '₱' ? peso : kpi.unit === '%' ? (v) => `${Math.round(v)}%` : commas

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex' }}>
        <div style={{ flex: 1, minWidth: 0, fontWeight: 700, fontSize: 14, overflowWrap: 'break-word' }}>{kpi.name}</div>
        <StatusBadge status={kpi.status} compact />
      </div>

      <div style={{ marginTop: 14 }}>
        <AchievementBar label="" target={kpi.target} actual={kpi.actual} formatter={formatter} />
      </div>

      <div style={{ flex: 1 }} />
      <hr className="divider" style={{ margin: '16px 0 10px' }} />
      <div style={{ display: 'flex' }}>
        <div className="caption">{kpi.period}</div>
        <div style={{ flex: 1 }} />
        {kpi.momChangePct != null && (
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: kpi.momChangePct >= 0 ? 'var(--status-on-target)' : 'var(--status-critical)',
            }}
          >
            {kpi.momChangePct >= 0 ? '▲' : '▼'} {Math.abs(kpi.momChangePct).toFixed(1)}%
          </div>
        )}
      </div>
    </div>
  )
}

const CATEGORIES = ['People & Growth', 'Life Groups', 'Outreach', 'Financial', 'Ministry']
const FREQUENCIES = ['Weekly', 'Monthly', 'Quarterly', 'Annual']

function NewTargetSheet({ onClose, onCreated }) {
  const [name, setName] = useState('')
  const [category, setCategory] = useState(CATEGORIES[0])
  const [target, setTarget] = useState('')
  const [frequency, setFrequency] = useState(FREQUENCIES[1])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const inputStyle = {
    width: '100%',
    padding: '11px 14px',
    borderRadius: 10,
    border: 'none',
    background: 'var(--surface-muted)',
    fontSize: 14,
    fontFamily: 'inherit',
  }

  async function handleCreate() {
    if (!name.trim()) {
      setError('Give the KPI a name first.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      await createKpiTarget({ name: name.trim(), category, target, frequency })
      await onCreated() // refetch shared data so the new KPI shows up immediately
      onClose()
    } catch (err) {
      setError(err.message || 'Could not save this target — try again.')
      setSaving(false)
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(30,42,34,0.35)',
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        zIndex: 2000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'var(--surface)',
          borderRadius: '20px 20px 0 0',
          padding: '20px 24px 28px',
          width: '100%',
          maxWidth: 520,
          boxShadow: '0 -8px 30px rgba(0,0,0,0.15)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ width: 40, height: 4, borderRadius: 2, background: 'var(--line)', margin: '0 auto 16px' }} />
        <h1 className="serif" style={{ fontSize: 20, fontWeight: 700 }}>
          New KPI Target
        </h1>
        <div className="body-muted" style={{ marginTop: 4, marginBottom: 20 }}>
          Leadership defines a target — Shepherd OS calculates the rest. Saved to your Supabase database.
        </div>

        <Field label="KPI Name">
          <input style={inputStyle} placeholder="e.g. First Timers" value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <div style={{ height: 14 }} />
        <Field label="Category">
          <select style={inputStyle} value={category} onChange={(e) => setCategory(e.target.value)}>
            {CATEGORIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </Field>
        <div style={{ height: 14, display: 'flex', gap: 14 }} />
        <div style={{ display: 'flex', gap: 14 }}>
          <div style={{ flex: 1 }}>
            <Field label="Target Value">
              <input style={inputStyle} type="number" placeholder="e.g. 70" value={target} onChange={(e) => setTarget(e.target.value)} />
            </Field>
          </div>
          <div style={{ flex: 1 }}>
            <Field label="Frequency">
              <select style={inputStyle} value={frequency} onChange={(e) => setFrequency(e.target.value)}>
                {FREQUENCIES.map((f) => (
                  <option key={f}>{f}</option>
                ))}
              </select>
            </Field>
          </div>
        </div>

        {error && <div style={{ marginTop: 14, color: 'var(--status-critical)', fontSize: 13 }}>{error}</div>}

        <button
          onClick={handleCreate}
          disabled={saving}
          style={{
            width: '100%',
            marginTop: 24,
            padding: 14,
            borderRadius: 10,
            border: 'none',
            background: saving ? 'var(--primary-light, #4c7a50)' : 'var(--primary)',
            color: 'white',
            fontWeight: 700,
            fontSize: 14,
            cursor: saving ? 'default' : 'pointer',
          }}
        >
          {saving ? 'Saving...' : 'Create Target'}
        </button>
      </div>
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div>
      <div className="label" style={{ marginBottom: 6 }}>
        {label}
      </div>
      {children}
    </div>
  )
}
