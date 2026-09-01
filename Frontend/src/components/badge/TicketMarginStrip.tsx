/** Bande marge (mode marge) : zone QR + colonne libellés. */

import type { MouseEvent, ReactNode } from 'react';
import { getContrastTextColor, normalizeHexColor } from '../../utils/badgeQrLayout';
import { TicketLabelColumn } from './TicketLabelColumn';

type TicketMarginStripProps = {
  widthPx: number;
  heightPx: number;
  ticketLine?: string;
  brandLine?: string;
  backgroundColor?: string;
  labelColor?: string;
  className?: string;
  showResizeHandle?: boolean;
  onResizeMarginStart?: (e: MouseEvent) => void;
  children?: ReactNode;
};

export default function TicketMarginStrip({
  widthPx,
  heightPx,
  ticketLine,
  brandLine,
  backgroundColor = '#0a0a0a',
  labelColor,
  className = '',
  showResizeHandle = false,
  onResizeMarginStart,
  children,
}: TicketMarginStripProps) {
  const bg = normalizeHexColor(backgroundColor, '#0a0a0a');
  const labelColPx = Math.max(10, Math.min(widthPx * 0.28, 28));

  return (
    <div
      className={`relative shrink-0 overflow-hidden flex flex-row ${className}`}
      style={{ width: `${widthPx}px`, height: `${heightPx}px`, backgroundColor: bg }}
    >
      <div className="relative flex-1 min-w-0 h-full">{children}</div>

      <TicketLabelColumn
        heightPx={heightPx}
        ticketLine={ticketLine}
        brandLine={brandLine}
        backgroundColor={bg}
        labelColor={labelColor ?? getContrastTextColor(bg)}
        widthPx={labelColPx}
        className="border-l border-white/15"
      />

      {showResizeHandle && onResizeMarginStart && (
        <div
          role="separator"
          aria-label="Redimensionner la marge (bord droit)"
          className="absolute inset-y-0 right-0 w-3 cursor-ew-resize hover:bg-white/10 z-20 flex items-center justify-center group/handle"
          onMouseDown={onResizeMarginStart}
        >
          <div className="h-12 w-1 rounded-full bg-white/30 group-hover/handle:bg-white/60 group-hover/handle:w-1.5 transition-all" />
        </div>
      )}
    </div>
  );
}
