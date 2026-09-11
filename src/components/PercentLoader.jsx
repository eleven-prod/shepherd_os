import { useEffect, useRef, useState } from 'react'

/**
 * Small inline percent-based loading indicator: a thin horizontal bar
 * with a live percentage label next to it. Two ways to drive it:
 *
 *  - Real progress: pass `progress` (0-100) and the bar tracks it
 *    exactly — for actions with countable steps, like DataEntry's
 *    Submit (N of M area cards saved).
 *  - Simulated progress: omit `progress` and leave `active` true —
 *    there's no way to know how far along a single request really is,
 *    so the bar eases up toward 90% on its own while `active` stays
 *    true, then completes to 100% the instant `active` goes false.
 *    Used for actions with one request and no sub-steps to count, like
 *    PeriodSelector's Apply.
 */
export default function PercentLoader({ active = true, progress, width = 100, height = 6, color = 'var(--primary)' }) {
  const controlled = typeof progress === 'number'
  const [simulated, setSimulated] = useState(0)
  const frameRef = useRef(null)

  useEffect(() => {
    if (controlled) return
    if (!active) {
      setSimulated(100)
      const t = setTimeout(() => setSimulated(0), 300)
      return () => clearTimeout(t)
    }
    const start = performance.now()
    function tick(now) {
      const elapsed = now - start
      // Eases toward 90% and never quite reaches it while still active —
      // the last 10% is reserved for the real completion jump to 100%.
      setSimulated(90 * (1 - Math.exp(-elapsed / 700)))
      frameRef.current = requestAnimationFrame(tick)
    }
    frameRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frameRef.current)
  }, [active, controlled])

  const pct = controlled ? progress : simulated
  const clamped = Math.min(100, Math.max(0, pct))

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div style={{ width, height, borderRadius: height / 2, background: 'var(--surface-muted)', overflow: 'hidden', flexShrink: 0 }}>
        <div
          style={{
            width: `${clamped}%`,
            height: '100%',
            background: color,
            borderRadius: height / 2,
            transition: controlled ? 'width 0.25s ease' : 'width 0.1s linear',
          }}
        />
      </div>
      <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-muted)', minWidth: 28, textAlign: 'right' }}>{Math.round(clamped)}%</span>
    </div>
  )
}
