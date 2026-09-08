export default function SectionHeader({ title, subtitle, trailing }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
      {/* minWidth:0 let this column shrink all the way to nothing instead
          of ever triggering the wrap onto its own line — flex-wrap only
          kicks in once an item can't shrink any further and stops
          "fitting," so a title that CAN shrink infinitely (via
          overflow-wrap below) never forces the trailing element (e.g.
          PeriodSelector showing a long "Full Year: Sep 2025 – Aug 2026"
          label) down to the next line. It just squeezes the title into a
          sliver, wrapping every 2-3 characters. A real minWidth floor
          fixes that: once title+trailing can't both fit at a sane
          minimum, the row wraps title to its own full-width line above
          trailing, like it already does for shorter trailing content. */}
      <div style={{ flex: 1, minWidth: 180 }}>
        <h1 style={{ fontSize: 'var(--font-header)', fontWeight: 700, lineHeight: 1.2, overflowWrap: 'break-word' }}>
          {title}
        </h1>
        {subtitle && (
          <div className="body-muted" style={{ marginTop: 4, overflowWrap: 'break-word' }}>
            {subtitle}
          </div>
        )}
      </div>
      {trailing}
    </div>
  )
}
