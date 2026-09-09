import { ComposedChart, Bar, Line, LabelList, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

/**
 * Month-by-month grouped bar comparison of two metrics — e.g. Category 2
 * vs Worship Service Attendance — with a PYA reference line shown for only
 * ONE of the two series (the other is actual-only, no PYA of its own in
 * this particular comparison).
 *
 * `months` must already include a `pyaLine` field on every row (the same
 * constant PYA value repeated), matching the pattern used in
 * ParentSubsetPanel — this is a plain data field, not a function-based
 * dataKey, since that's the tested/working approach elsewhere in the app.
 *
 * Unreported months are passed through as `null` by the caller (same
 * convention as PyaBarChart/ParentSubsetPanel) so a not-yet-reported
 * month shows as a gap rather than a misleading zero bar.
 */
export default function MonthlyComparisonChart({
  months,
  seriesAKey,
  seriesALabel,
  seriesAColor,
  seriesBKey,
  seriesBLabel,
  seriesBColor,
  valueFormatter = (v) => Math.round(v).toString(),
  height = 260,
}) {
  if (!months || months.length === 0) return null

  return (
    <div style={{ width: '100%', minWidth: 0 }}>
      <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={months} margin={{ top: 24, right: 10, bottom: 0, left: 0 }}>
        <CartesianGrid stroke="var(--line)" vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 10.5, fill: 'var(--ink-faint)' }} axisLine={{ stroke: 'var(--line)' }} tickLine={false} interval={0} angle={-35} textAnchor="end" height={50} />
        <YAxis tick={{ fontSize: 11, fill: 'var(--ink-faint)' }} axisLine={false} tickLine={false} tickFormatter={valueFormatter} width={56} />
        <Tooltip
          formatter={(v, name) => [v == null ? 'Not yet reported' : valueFormatter(v), name]}
          contentStyle={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 8, fontSize: 12 }}
        />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <Bar dataKey={seriesAKey} name={seriesALabel} fill={seriesAColor} radius={[4, 4, 0, 0]} isAnimationActive={false} barSize={20}>
          <LabelList dataKey={seriesAKey} position="inside" formatter={(v) => (v == null ? '' : valueFormatter(v))} style={{ fontSize: 11, fontWeight: 700, fill: '#fff' }} />
        </Bar>
        <Bar dataKey={seriesBKey} name={seriesBLabel} fill={seriesBColor} radius={[4, 4, 0, 0]} isAnimationActive={false} barSize={20}>
          <LabelList dataKey={seriesBKey} position="inside" formatter={(v) => (v == null ? '' : valueFormatter(v))} style={{ fontSize: 11, fontWeight: 700, fill: '#fff' }} />
        </Bar>
        {/* PYA reference — a flat dashed line for seriesB only, since
            seriesA (Category 2, in the usual case) doesn't have its own
            PYA in this particular comparison. */}
        <Line
          type="linear"
          dataKey="pyaLine"
          name={`${seriesBLabel} PYA`}
          stroke={seriesBColor}
          strokeOpacity={0.6}
          strokeWidth={1.5}
          strokeDasharray="5 4"
          dot={false}
          isAnimationActive={false}
        />
      </ComposedChart>
    </ResponsiveContainer>
    </div>
  )
}
