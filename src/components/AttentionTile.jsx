import { STATUS_META, KPI_STATUS } from '../data/api'

const ICONS = {
  [KPI_STATUS.CRITICAL]: '⚠',
  [KPI_STATUS.ATTENTION]: '●',
  [KPI_STATUS.ON_TARGET]: '✓',
}

/** `compact` shrinks padding/font and drops the detail line to a single
 * truncated line — used when tiles sit in a multi-column grid (KPI
 * Center's Attention section) rather than a single full-width stack,
 * so more of them fit on screen at once. */
export default function AttentionTile({ item, compact = false }) {
  const meta = STATUS_META[item.severity]
  return (
    <div
      style={{
        display: 'flex',
        gap: compact ? 8 : 12,
        padding: compact ? '9px 10px' : 14,
        borderRadius: compact ? 10 : 12,
        background: meta.bg,
        opacity: 0.92,
        border: `1px solid ${meta.bg}`,
      }}
    >
      <div style={{ color: meta.fg, fontSize: compact ? 13 : 16, lineHeight: compact ? '18px' : '20px' }}>{ICONS[item.severity]}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontWeight: 700,
            fontSize: compact ? 13 : 14,
            overflow: compact ? 'hidden' : 'visible',
            textOverflow: compact ? 'ellipsis' : 'clip',
            whiteSpace: compact ? 'nowrap' : 'normal',
            overflowWrap: compact ? 'normal' : 'break-word',
          }}
        >
          {item.title}
        </div>
        {!compact && (
          <div className="body-muted" style={{ marginTop: 3, overflowWrap: 'break-word' }}>
            {item.detail}
          </div>
        )}
        <div className="caption" style={{ marginTop: compact ? 2 : 6, fontSize: compact ? 10.5 : undefined }}>
          {item.area.toUpperCase()}
        </div>
      </div>
    </div>
  )
}
