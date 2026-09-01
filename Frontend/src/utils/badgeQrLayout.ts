export type QrLayoutMode = 'margin' | 'embedded';
export type SupportType = 'invitation' | 'badge';

export interface QrLayoutFields {
  qrLayoutMode: QrLayoutMode;
  qrContainerMm: number;
  qrSizeMm: number;
  qrPosX: number;
  qrPosY: number;
  /** Fond du conteneur / bande latérale (hex). */
  qrBg: string;
  /** Couleur des modules du QR code (hex). */
  qrFg: string;
}

export const DEFAULT_QR_LAYOUT: QrLayoutFields = {
  qrLayoutMode: 'margin',
  qrContainerMm: 50,
  qrSizeMm: 40,
  qrPosX: 50,
  qrPosY: 50,
  qrBg: '#0a0a0a',
  qrFg: '#000000',
};

export function normalizeHexColor(value: string | undefined, fallback: string): string {
  if (!value) return fallback;
  if (value === 'white') return '#ffffff';
  if (value === 'black') return '#111827';
  return /^#[0-9A-Fa-f]{6}$/.test(value) ? value : fallback;
}

export function getContrastTextColor(hex: string): string {
  const normalized = normalizeHexColor(hex, '#ffffff');
  const r = parseInt(normalized.slice(1, 3), 16);
  const g = parseInt(normalized.slice(3, 5), 16);
  const b = parseInt(normalized.slice(5, 7), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.55 ? '#111827' : '#ffffff';
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export const A4_WIDTH_MM = 210;
export const PAGE_MARGIN_MM = 8.4;
export const SHEET_INNER_WIDTH_MM = A4_WIDTH_MM - PAGE_MARGIN_MM * 2;

/** Colonne libellés verticaux (mm) — présente en mode marge et incrusté. */
export const MARGIN_LABEL_COL_MM = 10;

export function getLabelStripWidthMm(_qrLayoutMode: QrLayoutMode, supportType: SupportType): number {
  if (supportType === 'badge') return 0;
  return MARGIN_LABEL_COL_MM;
}

/** Zone de positionnement du QR dans la bande marge (hors colonne libellés). */
export function getMarginQrPosZoneMm(qrContainerMm: number): number {
  return Math.max(18, qrContainerMm - MARGIN_LABEL_COL_MM);
}

/** Largeur max d'une colonne billet sur A4 (mm). */
export function getMaxColWidthMm(cols: number, colGapMm: number): number {
  return Math.floor((SHEET_INNER_WIDTH_MM - colGapMm * Math.max(0, cols - 1)) / Math.max(1, cols));
}

export function capTicketWidthMm(widthMm: number, cols: number, colGapMm: number): number {
  return Math.min(widthMm, getMaxColWidthMm(cols, colGapMm));
}

/** Largeur d'affichage du visuel en mode marge (mm), selon le ratio image. */
export function computeMarginDesignDisplayMm(
  rowHeightMm: number,
  imgNatural: { width: number; height: number } | null,
  maxDesignWmm: number
): number {
  if (!imgNatural || imgNatural.width <= 0) return maxDesignWmm;
  const aspectWidth = rowHeightMm * (imgNatural.width / imgNatural.height);
  return Math.min(maxDesignWmm, Math.max(10, Math.round(aspectWidth)));
}

/** Largeur totale billet mode marge = visuel + bande QR (mm). */
export function computeMarginModeTotalMm(designDisplayMm: number, qrContainerMm: number): number {
  return designDisplayMm + qrContainerMm;
}

export function getMarginLayoutMm(params: {
  designWidthMm: number;
  rowHeightMm: number;
  qrContainerMm: number;
  cols: number;
  colGapMm: number;
  imgNatural: { width: number; height: number } | null;
}) {
  const { designWidthMm, rowHeightMm, qrContainerMm, cols, colGapMm, imgNatural } = params;
  const maxTotalW = getMaxColWidthMm(cols, colGapMm);
  const maxDesignW = Math.max(10, maxTotalW - qrContainerMm);
  const cappedDesignW = Math.min(designWidthMm, maxDesignW);
  const designDisplayMm = computeMarginDesignDisplayMm(rowHeightMm, imgNatural, cappedDesignW);
  const totalWidthMm = computeMarginModeTotalMm(designDisplayMm, qrContainerMm);
  return { designDisplayMm, totalWidthMm, qrZoneWidthMm: qrContainerMm };
}

/** Largeur de la bande marge (mm). 0 en mode incrusté ou badge. */
export function getQrZoneWidthMm(
  qrLayoutMode: QrLayoutMode,
  supportType: SupportType,
  _rowHeightMm: number,
  qrContainerMm: number
): number {
  if (qrLayoutMode === 'embedded' || supportType === 'badge') return 0;
  return qrContainerMm || 50;
}

export function computeRowHeightMm(
  imageAreaWidthMm: number,
  imgNatural: { width: number; height: number } | null,
  fallbackHeightMm = 54
): number {
  if (!imgNatural || imgNatural.width <= 0) return fallbackHeightMm;
  return Math.round(imageAreaWidthMm * (imgNatural.height / imgNatural.width));
}

export function qrCenterMmFromPercent(
  zoneWidthMm: number,
  zoneHeightMm: number,
  qrSizeMm: number,
  posX: number,
  posY: number
) {
  const half = qrSizeMm / 2;
  const cx = (posX / 100) * zoneWidthMm;
  const cy = (posY / 100) * zoneHeightMm;
  return {
    xMm: clamp(cx - half, 0, Math.max(0, zoneWidthMm - qrSizeMm)),
    yMm: clamp(cy - half, 0, Math.max(0, zoneHeightMm - qrSizeMm)),
  };
}

export function getEmbeddedDefaults(_supportType: SupportType): Pick<QrLayoutFields, 'qrPosX' | 'qrPosY' | 'qrSizeMm'> {
  return { qrPosX: 78, qrPosY: 68, qrSizeMm: 32 };
}

export function getMarginDefaults(_supportType: SupportType): Pick<QrLayoutFields, 'qrContainerMm' | 'qrSizeMm' | 'qrPosX' | 'qrPosY'> {
  return { qrContainerMm: 50, qrSizeMm: 40, qrPosX: 50, qrPosY: 50 };
}
