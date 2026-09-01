import { useCallback, useEffect, useRef, useState } from 'react';
import {
  clamp,
  getContrastTextColor,
  getMarginQrPosZoneMm,
  getQrZoneWidthMm,
  MARGIN_LABEL_COL_MM,
  normalizeHexColor,
  qrCenterMmFromPercent,
  type QrLayoutFields,
  type SupportType,
} from '../../utils/badgeQrLayout';
import TicketMarginStrip from './TicketMarginStrip';
import { TicketLabelColumn } from './TicketLabelColumn';

const PREVIEW_HEIGHT_PX = 200;

type DragMode = 'move-qr' | 'resize-qr' | 'resize-margin' | null;

interface QrInteractivePreviewProps {
  supportType: SupportType;
  layout: QrLayoutFields;
  designWidthMm: number;
  designHeightMm: number;
  imgPreviewUrl: string | null;
  backgroundColor: string;
  designLabel?: string;
  onChange: (patch: Partial<QrLayoutFields>) => void;
}

export default function QrInteractivePreview({
  supportType,
  layout,
  designWidthMm,
  designHeightMm,
  imgPreviewUrl,
  backgroundColor,
  designLabel = 'Design',
  onChange,
}: QrInteractivePreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dragMode, setDragMode] = useState<DragMode>(null);
  const marginDragStart = useRef({ clientX: 0, marginMm: 50 });

  const pxPerMm = PREVIEW_HEIGHT_PX / Math.max(designHeightMm, 1);
  const qrZoneWidthMm = getQrZoneWidthMm(
    layout.qrLayoutMode,
    supportType,
    designHeightMm,
    layout.qrContainerMm
  );
  const labelStripMm = MARGIN_LABEL_COL_MM;
  const labelStripPx = labelStripMm * pxPerMm;
  const totalWidthMm =
    layout.qrLayoutMode === 'margin'
      ? designWidthMm + qrZoneWidthMm
      : designWidthMm + labelStripMm;
  const totalWidthPx = totalWidthMm * pxPerMm;

  const designWidthPx = designWidthMm * pxPerMm;
  const qrZoneWidthPx = qrZoneWidthMm * pxPerMm;
  const qrPosZoneMm =
    layout.qrLayoutMode === 'margin' ? getMarginQrPosZoneMm(layout.qrContainerMm) : designWidthMm;
  const qrPosZonePx =
    layout.qrLayoutMode === 'margin'
      ? Math.max(1, qrZoneWidthPx - labelStripPx)
      : designWidthPx;
  const qrSizePx = layout.qrSizeMm * pxPerMm;

  const containerBg = normalizeHexColor(layout.qrBg, '#0a0a0a');
  const qrFg = normalizeHexColor(layout.qrFg, '#000000');
  const labelColor = getContrastTextColor(containerBg);

  const { xMm, yMm } = qrCenterMmFromPercent(
    qrPosZoneMm,
    designHeightMm,
    layout.qrSizeMm,
    layout.qrPosX,
    layout.qrPosY
  );

  const qrLeftPx =
    layout.qrLayoutMode === 'margin'
      ? designWidthPx + xMm * pxPerMm
      : xMm * pxPerMm;
  const qrTopPx = yMm * pxPerMm;

  const clientToLocal = useCallback((clientX: number, clientY: number) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return { x: clientX - rect.left, y: clientY - rect.top };
  }, []);

  const pxToPercent = useCallback(
    (localX: number, localY: number) => {
      const zoneW = qrPosZonePx;
      const cx = layout.qrLayoutMode === 'margin' ? localX - designWidthPx : localX;
      return {
        posX: clamp((cx / Math.max(zoneW, 1)) * 100, 5, 95),
        posY: clamp((localY / PREVIEW_HEIGHT_PX) * 100, 5, 95),
      };
    },
    [designWidthPx, layout.qrLayoutMode, qrPosZonePx]
  );

  useEffect(() => {
    if (!dragMode) return;

    const onMove = (e: MouseEvent) => {
      const local = clientToLocal(e.clientX, e.clientY);

      if (dragMode === 'move-qr') {
        const { posX, posY } = pxToPercent(local.x, local.y);
        onChange({ qrPosX: posX, qrPosY: posY });
      } else if (dragMode === 'resize-qr') {
        const centerX =
          layout.qrLayoutMode === 'margin'
            ? designWidthPx + (layout.qrPosX / 100) * qrPosZonePx
            : (layout.qrPosX / 100) * designWidthPx;
        const centerY = (layout.qrPosY / 100) * PREVIEW_HEIGHT_PX;
        const dx = local.x - centerX;
        const dy = local.y - centerY;
        const halfPx = Math.max(Math.abs(dx), Math.abs(dy));
        const newSizeMm = clamp(
          (halfPx * 2) / pxPerMm,
          12,
          Math.min(designHeightMm * 0.85, qrPosZoneMm * 0.95)
        );
        onChange({ qrSizeMm: Math.round(newSizeMm) });
      } else if (dragMode === 'resize-margin') {
        const deltaMm = (e.clientX - marginDragStart.current.clientX) / pxPerMm;
        const newMarginMm = clamp(
          marginDragStart.current.marginMm + deltaMm,
          20,
          totalWidthMm - 30
        );
        onChange({ qrContainerMm: Math.round(newMarginMm) });
        marginDragStart.current = { clientX: e.clientX, marginMm: newMarginMm };
      }
    };

    const onUp = () => setDragMode(null);

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [
    clientToLocal,
    designHeightMm,
    designWidthPx,
    dragMode,
    layout.qrLayoutMode,
    layout.qrPosX,
    layout.qrPosY,
    onChange,
    pxPerMm,
    pxToPercent,
    qrPosZoneMm,
    qrPosZonePx,
    totalWidthMm,
  ]);

  if (supportType === 'badge') {
    return (
      <p className="text-xs app-text-muted text-center max-w-sm">
        Positionnement interactif disponible pour Ticket/Invitation. Utilisez l&apos;emplacement Recto/Verso pour les badges.
      </p>
    );
  }

  return (
    <div className="w-full flex flex-col items-center gap-5">
      <div className="flex flex-wrap items-center justify-center gap-2">
        <span className="landing-chip landing-chip--active text-[11px]">
          Glisser le QR pour le positionner
        </span>
        <span className="landing-chip text-[11px]">
          Poignée = redimensionner
        </span>
        {layout.qrLayoutMode === 'margin' && (
          <span className="landing-chip text-[11px] border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300">
            Bord droit = largeur marge
          </span>
        )}
      </div>

      <div
        ref={containerRef}
        className="relative badge-preview-frame rounded-lg overflow-hidden select-none flex flex-row border border-black"
        style={{ width: `${totalWidthPx}px`, height: `${PREVIEW_HEIGHT_PX}px` }}
      >
        <div
          className="flex items-center justify-center overflow-hidden shrink-0 relative"
          style={{ width: `${designWidthPx}px`, backgroundColor }}
        >
          {imgPreviewUrl ? (
            <img src={imgPreviewUrl} alt="design" className="w-full h-full object-contain object-left block pointer-events-none" draggable={false} />
          ) : (
            <span className="text-xs font-bold text-gray-400 text-center p-4 pointer-events-none">{designLabel}</span>
          )}
        </div>

        {layout.qrLayoutMode === 'margin' && qrZoneWidthPx > 0 && (
          <TicketMarginStrip
            widthPx={qrZoneWidthPx}
            heightPx={PREVIEW_HEIGHT_PX}
            backgroundColor={containerBg}
            labelColor={labelColor}
            showResizeHandle
            onResizeMarginStart={(e) => {
              e.preventDefault();
              e.stopPropagation();
              marginDragStart.current = { clientX: e.clientX, marginMm: layout.qrContainerMm };
              setDragMode('resize-margin');
            }}
          />
        )}

        {layout.qrLayoutMode === 'embedded' && (
          <TicketLabelColumn
            heightPx={PREVIEW_HEIGHT_PX}
            backgroundColor={containerBg}
            labelColor={labelColor}
            widthPx={labelStripPx}
          />
        )}

        <div
          className="absolute z-20 cursor-grab active:cursor-grabbing group"
          style={{
            left: `${qrLeftPx}px`,
            top: `${qrTopPx}px`,
            width: `${qrSizePx}px`,
            height: `${qrSizePx}px`,
          }}
          onMouseDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setDragMode('move-qr');
          }}
        >
          <div
            className="w-full h-full border-2 rounded flex items-center justify-center font-black text-[10px] shadow-lg ring-2 ring-[var(--landing-primary)]/25"
            style={{
              backgroundColor: containerBg,
              color: qrFg,
              borderColor: qrFg,
            }}
          >
            QR
          </div>
          <div
            role="button"
            aria-label="Redimensionner le QR"
            className="absolute -bottom-1.5 -right-1.5 w-4 h-4 rounded-full bg-[var(--landing-primary)] border-2 border-white shadow cursor-nwse-resize opacity-90 group-hover:scale-110 transition-transform"
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setDragMode('resize-qr');
            }}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 w-full max-w-lg">
        <div className="dash-stat-card !p-2.5 text-center">
          <p className="text-[10px] app-text-muted mb-0.5 uppercase tracking-wide">Taille QR</p>
          <p className="text-sm font-bold font-mono app-heading">{(layout.qrSizeMm / 10).toFixed(1)} cm</p>
        </div>
        {layout.qrLayoutMode === 'margin' && (
          <div className="dash-stat-card !p-2.5 text-center">
            <p className="text-[10px] app-text-muted mb-0.5 uppercase tracking-wide">Marge</p>
            <p className="text-sm font-bold font-mono app-heading">{(layout.qrContainerMm / 10).toFixed(1)} cm</p>
          </div>
        )}
        <div className="dash-stat-card !p-2.5 text-center">
          <p className="text-[10px] app-text-muted mb-0.5 uppercase tracking-wide">Position X</p>
          <p className="text-sm font-bold font-mono app-heading">{Math.round(layout.qrPosX)}%</p>
        </div>
        <div className="dash-stat-card !p-2.5 text-center">
          <p className="text-[10px] app-text-muted mb-0.5 uppercase tracking-wide">Position Y</p>
          <p className="text-sm font-bold font-mono app-heading">{Math.round(layout.qrPosY)}%</p>
        </div>
      </div>
    </div>
  );
}
