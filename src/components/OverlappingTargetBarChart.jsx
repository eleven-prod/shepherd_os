import { BarChart, Bar, Cell, LabelList, ReferenceLine, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

const CATEGORY2_COLOR = '#e1e1e1'
const PYA_COLOR = '#3c76f1'
const TARGET_PASSED_COLOR = '#00c781'
const TARGET_MISSED_COLOR = '#ff4040'

/**
 * "WSA bar inside Category 2 bar": a genuinely STACKED bar, not two
 * independent bars — Recharts groups independent (non-stacked) Bar
 * series side-by-side no matter what width you give them, so true
 * visual nesting has to be built as a stack instead:
 *   - bottom segment ("front") = WSA's actual value, colored by whether
 *     it passed the target (green) or missed it (red)
 *   - top segment ("remainder") = Category 2's value MINUS WSA's value —
 *     the "extra height" of Category 2 above WSA, shown in gray
 * Combined stack height = Category 2's real total, with WSA's own
 * portion clearly visible at the bottom in its own color. If WSA's value
 * exceeds Category 2's, there's no remainder — the whole bar is just the
 * colored WSA segment.
 *
 * IMPORTANT: `pyaValue` (WSA's own real historical PYA) and `target`
 * (the pass/fail threshold, e.g. 60% of Category 2) are genuinely
 * different numbers, not the same figure shown two ways — the leading
 * blue bar shows `pyaValue`, while the dashed reference line and every
 * month's green/red coloring are driven by `target`.
 */
export default function OverlappingTargetBarChart({
  months,
  backgroundKey,
  backgroundLabel,
  target,
  pyaValue,
  pyaBarLabel = 'WSA PYA',
  valueFormatter = (v) => Math.round(v).toString(),
  height = 300,
}) {
  if (!months || months.length === 0) return null

  const data = [
    { label: pyaBarLabel, front: pyaValue, remainder: 0, isPyaBar: true, passed: false },
    ...months.map((m) => {
      const front = m.front
      const bg = m.background
      const remainder = front != null && bg != null ? Math.max(0, bg - front) : null
      return {
        label: m.label,
        front,
        remainder,
        isPyaBar: false,
        passed: front != null && front >= target,
      }
    }),
  ]

  return (
    <div style={{ width: '100%', minWidth: 0 }}>
      <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} barGap={0} barCategoryGap="22%" margin={{ top: 24, right: 10, bottom: 0, left: 12 }}>
        <CartesianGrid stroke="var(--line)" vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 10.5, fill: 'var(--ink-faint)' }} axisLine={{ stroke: 'var(--line)' }} tickLine={false} interval={0} angle={-35} textAnchor="end" height={50} />
        <YAxis tick={{ fontSize: 11, fill: 'var(--ink-faint)' }} axisLine={false} tickLine={false} tickFormatter={valueFormatter} width={56} />
        <Tooltip
          formatter={(v, name, props) => {
            if (name === 'Category 2 (remainder)') return [valueFormatter((props.payload.front || 0) + v), backgroundLabel]
            return [valueFormatter(v), name]
          }}
          contentStyle={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 8, fontSize: 12 }}
        />
        <Legend
          payload={[
            { value: backgroundLabel, type: 'square', color: CATEGORY2_COLOR },
            { value: pyaBarLabel, type: 'square', color: PYA_COLOR },
            { value: 'Target Passed', type: 'square', color: TARGET_PASSED_COLOR },
            { value: 'Target Missed', type: 'square', color: TARGET_MISSED_COLOR },
          ]}
          wrapperStyle={{ fontSize: 11 }}
        />
        <ReferenceLine
          y={target}
          stroke="var(--ink-faint)"
          strokeDasharray="4 4"
          strokeWidth={1.25}
          // Positioned INSIDE the plot area (not past its right edge) —
          // 'right' rendered outside the chart's own bounds, which got
          // clipped since there wasn't enough margin reserved for it.
          // insideTopRight stays within the SVG's rendered area, so it
          // can't be cut off regardless of container width.
          label={{ value: `Target: ${valueFormatter(target)}`, position: 'insideTopRight', fontSize: 11, fill: 'var(--ink-muted)' }}
        />
        {/* Bottom segment — WSA's real value, colored by target status
            (or blue for the leading PYA bar). Drawn first in the stack. */}
        <Bar dataKey="front" name="Actual" stackId="ssaStack" barSize={40} radius={[0, 0, 0, 0]} isAnimationActive={false}>
          {data.map((entry, i) => (
            <Cell key={i} fill={entry.isPyaBar ? PYA_COLOR : entry.passed ? TARGET_PASSED_COLOR : TARGET_MISSED_COLOR} />
          ))}
          <LabelList dataKey="front" content={(props) => renderBarLabel(props, data[props.index], valueFormatter, pyaBarLabel)} />
        </Bar>
        {/* Top segment — the rest of Category 2's height above WSA,
            stacked directly on top so the combined bar reaches Category
            2's real total. */}
        <Bar dataKey="remainder" name="Category 2 (remainder)" stackId="ssaStack" fill={CATEGORY2_COLOR} barSize={40} radius={[3, 3, 0, 0]} isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer>
    </div>
  )
}

// The leading PYA bar gets a multi-line label (value, then its name
// split across 2 short lines) — every other bar just gets its single
// formatted value. Font sizes and line breaks are kept tight enough to
// fit within a 40px-wide bar without the text pushing past its edges.
function renderBarLabel(props, row, valueFormatter, pyaBarLabel) {
  const { x, y, width } = props
  if (row.front == null) return null
  const cx = x + width / 2
  if (row.isPyaBar) {
    // Break the label into short words so each line is narrow enough
    // for a 40px bar — "WSA PYA" as one line was still wider than the
    // bar itself even at a small font size.
    const words = pyaBarLabel.split(' ')
    return (
      <text x={cx} y={y + 20} textAnchor="middle" fontSize={11} fontWeight={700} fill="#fff">
        <tspan x={cx} dy="0" fontSize={13}>
          {valueFormatter(row.front)}
        </tspan>
        {words.map((word, i) => (
          <tspan key={i} x={cx} dy="13">
            {word}
          </tspan>
        ))}
      </text>
    )
  }
  return (
    <text x={cx} y={y + 18} textAnchor="middle" fontSize={11} fontWeight={700} fill="#fff">
      {valueFormatter(row.front)}
    </text>
  )
}
