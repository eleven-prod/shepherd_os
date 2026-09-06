import { ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

/**
 * Standardized "Parent → Subset → Rate" pattern for anywhere one metric
 * is a subset of another (e.g. Category 2 members are a subset of
 * Category 1). Renders:
 *   1. Three KPI cards — Parent actual, Subset actual, and the derived
 *      Rate (subset ÷ parent) — each compared against ITS OWN PYA
 *      benchmark, since PYA is a benchmark per category, not a category
 *      of its own.
 *   2. One combined trend chart: parent & subset current values as thick
 *      solid lines, their PYA benchmarks as thin dashed lines in the same
 *      hue at low opacity — so PYA reads as reference context, not a
 *      competing trend.
 *
 * The gap between parent and subset is framed as "Rate" / "Not in
 * [subset]" — not automatically negative, since a subset naturally being
 * smaller than its parent is expected, not a problem by itself. Only the
 * PYA comparison (color-coded) says whether that's improving or not.
 */
export default function ParentSubsetPanel({
  parentLabel,
  parentActual,
  parentPya,
  parentMonths,
  parentDemographics,
  subsetLabel,
  subsetActual,
  subsetPya,
  subsetMonths,
  subsetDemographics,
  rateLabel = 'Rate',
  formatter = (v) => Math.round(v).toString(),
  parentColor = '#082253',
  subsetColor = '#3c76f1',
}) {
  const parentGrowthPct = parentPya > 0 ? ((parentActual - parentPya) / parentPya) * 100 : null
  const subsetGrowthPct = subsetPya > 0 ? ((subsetActual - subsetPya) / subsetPya) * 100 : null

  const rateActual = parentActual > 0 ? (subsetActual / parentActual) * 100 : 0
  const ratePya = parentPya > 0 ? (subsetPya / parentPya) * 100 : 0
  const ratePpChange = rateActual - ratePya // percentage points, not percent-of-percent

  const cards = [
    { label: parentLabel, value: formatter(parentActual), growth: parentGrowthPct, growthUnit: '%', demographics: parentDemographics },
    { label: subsetLabel, value: formatter(subsetActual), growth: subsetGrowthPct, growthUnit: '%', demographics: subsetDemographics },
    { label: rateLabel, value: `${rateActual.toFixed(1)}%`, growth: ratePpChange, growthUnit: 'pp' },
  ]

  // Build combined chart data — PYA is rendered as a flat dashed line
  // (same value repeated across every month) since it's a single
  // benchmark number, not its own monthly series.
  //
  // Unreported months (e.g. the current month, before it's been entered)
  // are passed as `null` rather than their raw 0 value — Recharts breaks
  // the line/area at a null point instead of drawing through it, so the
  // chart honestly stops where real data ends rather than plunging to a
  // misleading "cliff" at zero that would look like activity crashed.
  const chartData = (parentMonths || []).map((m, i) => {
    const subsetMonth = subsetMonths?.[i]
    return {
      label: m.label,
      parentCurrent: m.unreported ? null : m.value,
      subsetCurrent: subsetMonth == null || subsetMonth.unreported ? null : subsetMonth.value,
      parentPyaLine: parentPya,
      subsetPyaLine: subsetPya,
    }
  })

  return (
    <div>
      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', marginBottom: 18 }}>
        {cards.map((c) => (
          <div className="card" key={c.label} style={{ minWidth: 0 }}>
            <div className="label" style={{ overflowWrap: 'break-word' }}>
              {c.label}
            </div>
            <div
              style={{
                fontSize: 'clamp(18px, 5vw, 24px)',
                fontWeight: 800,
                marginTop: 6,
                overflowWrap: 'break-word',
                wordBreak: 'break-word',
              }}
            >
              {c.value}
            </div>
            {c.growth != null && (
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  marginTop: 4,
                  overflowWrap: 'break-word',
                  color: c.growth >= 0 ? 'var(--status-on-target)' : 'var(--status-critical)',
                }}
              >
                {c.growth >= 0 ? '+' : ''}
                {c.growth.toFixed(1)}
                {c.growthUnit} vs PYA
              </div>
            )}
            {c.demographics && (
              <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--line)', display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
                {[
                  ['Men', c.demographics.men],
                  ['Women', c.demographics.women],
                  ['Young Adult', c.demographics.youngAdult],
                  ['KKB', c.demographics.kkb],
                  ['Children', c.demographics.children],
                ].map(([dLabel, dValue]) => (
                  <div key={dLabel} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 11.5, minWidth: 0 }}>
                    <span className="body-muted" style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {dLabel}
                    </span>
                    <span style={{ fontWeight: 700, flexShrink: 0 }}>{formatter(dValue)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {chartData.length > 0 && (
        <div style={{ width: '100%', minWidth: 0 }}>
      <ResponsiveContainer width="100%" height={260}>
          <ComposedChart data={chartData} margin={{ top: 24, right: 10, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="parentFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={parentColor} stopOpacity={0.45} />
                <stop offset="95%" stopColor={parentColor} stopOpacity={0.05} />
              </linearGradient>
              <linearGradient id="subsetFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={subsetColor} stopOpacity={0.55} />
                <stop offset="95%" stopColor={subsetColor} stopOpacity={0.08} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="var(--line)" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 10.5, fill: 'var(--ink-faint)' }} axisLine={{ stroke: 'var(--line)' }} tickLine={false} interval={0} angle={-35} textAnchor="end" height={50} />
            <YAxis tick={{ fontSize: 11, fill: 'var(--ink-faint)' }} axisLine={false} tickLine={false} tickFormatter={formatter} width={56} />
            <Tooltip
              formatter={(v, name) => [formatter(v), name]}
              contentStyle={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 8, fontSize: 12 }}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            {/* Current values: smooth filled areas — the main visual story */}
            <Area
              type="natural"
              dataKey="parentCurrent"
              name={parentLabel}
              stroke={parentColor}
              strokeWidth={2.5}
              fill="url(#parentFill)"
              dot={false}
              isAnimationActive={false}
            />
            <Area
              type="natural"
              dataKey="subsetCurrent"
              name={subsetLabel}
              stroke={subsetColor}
              strokeWidth={2.5}
              fill="url(#subsetFill)"
              dot={false}
              isAnimationActive={false}
            />
            {/* PYA benchmarks: thin dashed lines, no fill — reference
                context sitting on top of the areas, not competing with them */}
            <Line
              type="natural"
              dataKey="parentPyaLine"
              name={`${parentLabel} PYA`}
              stroke={parentColor}
              strokeOpacity={0.5}
              strokeWidth={1.25}
              strokeDasharray="5 4"
              dot={false}
              isAnimationActive={false}
            />
            <Line
              type="natural"
              dataKey="subsetPyaLine"
              name={`${subsetLabel} PYA`}
              stroke={subsetColor}
              strokeOpacity={0.5}
              strokeWidth={1.25}
              strokeDasharray="5 4"
              dot={false}
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
    </div>
      )}

      {(parentMonths || []).some((m) => m.unreported) && (
        <div className="caption" style={{ marginTop: 4 }}>
          The most recent month isn&apos;t yet reported in the source data — the chart stops at the last real figure rather than showing a misleading drop to zero.
        </div>
      )}

      <div className="caption" style={{ marginTop: 8 }}>
        {rateLabel}: {rateActual.toFixed(1)}% · Not in {subsetLabel}: {(100 - rateActual).toFixed(1)}%
      </div>
    </div>
  )
}
