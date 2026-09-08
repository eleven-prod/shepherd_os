const PYA_COLOR = '#969696'
const TARGET_COLOR = '#ffbb38'
const AA_MET_COLOR = '#00c781'
const AA_MISSED_COLOR = '#ff4040'

/**
 * Small reference visual: PYA, Target (optional), and AA side by side —
 * a quick "where do these three numbers stand relative to each other"
 * glance, kept separate from the monthly trend line so that chart isn't
 * sharing its scale with numbers of a very different magnitude.
 *
 * The AA bar is colored green if it meets/exceeds Target, red if it
 * falls short — same at-a-glance status signal used elsewhere in the
 * app, rather than a fixed neutral color regardless of performance.
 * When no target is given, AA falls back to a neutral color since
 * there's nothing to measure it against.
 *
 * Deliberately NOT a full Recharts chart — axes/grid/margins are all
 * overhead for something this simple, and made the original version
 * take up far more space than 3 bars need. This is plain, tightly
 * sized divs instead, with a fixed max-width so it doesn't stretch to
 * fill a wide column the way a ResponsiveContainer would.
 */
export default function PyaTargetActualBars({ pya, target, actual, valueFormatter = (v) => Math.round(v).toString(), maxHeight = 90 }) {
  const aaColor = target != null ? (actual >= target ? AA_MET_COLOR : AA_MISSED_COLOR) : PYA_COLOR
  const bars = [
    { label: 'PYA', value: pya, color: PYA_COLOR },
    ...(target != null ? [{ label: 'Target', value: target, color: TARGET_COLOR }] : []),
    { label: 'AA', value: actual, color: aaColor },
  ]
  const maxValue = Math.max(...bars.map((b) => b.value), 1)

  return (
    <div style={{ display: 'flex', gap: 14, alignItems: 'flex-end', maxWidth: 200, width: '100%', height: maxHeight + 44, overflow: 'hidden' }}>
      {bars.map((b) => (
        // minWidth:0 matters here: without it, a wide peso value (e.g. a
        // 6-7 digit amount) on the nowrap label below refuses to shrink
        // below its own content width, forcing this whole chart past its
        // 200px max-width with nothing to clip the overflow — exactly the
        // "flex item won't shrink" bug this app has hit before elsewhere.
        <div key={b.label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, minWidth: 0, height: '100%', justifyContent: 'flex-end' }}>
          <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--ink)', marginBottom: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>{valueFormatter(b.value)}</div>
          <div
            style={{
              width: 22,
              height: Math.max(4, (b.value / maxValue) * maxHeight),
              background: b.color,
              borderRadius: '4px 4px 0 0',
            }}
          />
          <div className="caption" style={{ marginTop: 4 }}>
            {b.label}
          </div>
        </div>
      ))}
    </div>
  )
}
