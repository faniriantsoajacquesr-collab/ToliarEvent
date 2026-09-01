/** Colonne libellés verticaux (bande latérale ticket). */

import { getContrastTextColor, normalizeHexColor } from '../../utils/badgeQrLayout';

type TicketLabelColumnProps = {
  heightPx: number;
  ticketLine?: string;
  brandLine?: string;
  backgroundColor?: string;
  labelColor?: string;
  widthPx?: number;
  className?: string;
};

export function formatTicketMarginLine(ticketNumber?: string | number, ticketType?: string) {
  const num = ticketNumber != null ? `#${ticketNumber}` : '···';
  const type = ticketType?.trim() || 'Standard';
  return `Ticket N° ${num} | ${type}`;
}

export function TicketLabelColumn({
  heightPx,
  ticketLine = 'Ticket N° ··· | Standard',
  brandLine = 'Made with ToliarEvent',
  backgroundColor = '#0a0a0a',
  labelColor,
  widthPx,
  className = '',
}: TicketLabelColumnProps) {
  const bg = normalizeHexColor(backgroundColor, '#0a0a0a');
  const fg = labelColor ?? getContrastTextColor(bg);
  const colW = widthPx ?? Math.max(10, Math.min(heightPx * 0.14, 28));

  return (
    <div
      className={`flex flex-row items-center justify-center gap-0.5 pointer-events-none shrink-0 ${className}`}
      style={{
        width: `${colW}px`,
        height: `${heightPx}px`,
        backgroundColor: bg,
        color: fg,
        borderLeft: '1px solid rgba(255,255,255,0.12)',
      }}
    >
      <span
        className="font-semibold uppercase tracking-wide opacity-95 leading-none"
        style={{ writingMode: 'vertical-rl', textOrientation: 'mixed', fontSize: Math.max(5, heightPx * 0.045) }}
      >
        {ticketLine}
      </span>
      <span
        className="opacity-65 tracking-wider leading-none"
        style={{ writingMode: 'vertical-rl', textOrientation: 'mixed', fontSize: Math.max(4, heightPx * 0.038) }}
      >
        {brandLine}
      </span>
    </div>
  );
}
