import jsQR from 'jsqr';
import Tesseract from 'tesseract.js';
import { parseTicketIdFromQr } from './ticketScan';

export type ParsedTicketFromScreenshot = {
  id: string;
  number: number | null;
  ticket_type: string;
  price: number;
  enabled: boolean;
};

export type KnownTicketType = {
  name: string;
  price?: number;
};

type QrDetection = {
  id: string;
  centerX: number;
  centerY: number;
  bottomY: number;
  leftX: number;
  rightX: number;
};

type LabelCandidate = {
  number: number;
  ticket_type: string;
  centerX: number;
  centerY: number;
};

const UUID_IN_TEXT_REGEX = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
const MAX_SCAN_WIDTH = 3200;
const SCAN_SCALES = [1, 1.25, 1.5, 2];

function loadImageFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Impossible de lire l\'image'));
    };
    image.src = url;
  });
}

function extractTicketIdFromPayload(payload: string): string | null {
  const embeddedUuid = payload.match(UUID_IN_TEXT_REGEX);
  if (embeddedUuid) return embeddedUuid[0];

  const fromQr = parseTicketIdFromQr(payload);
  if (fromQr && UUID_IN_TEXT_REGEX.test(fromQr)) return fromQr;

  const trimmed = payload.trim();
  if (UUID_IN_TEXT_REGEX.test(trimmed)) return trimmed.match(UUID_IN_TEXT_REGEX)![0];

  return null;
}

function normalizeForMatch(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function matchKnownTicketType(
  rawType: string,
  knownTypes: KnownTicketType[],
  fallbackPrice = 0
): { name: string; price: number } {
  const cleaned = rawType.replace(/made with.*$/i, '').trim();
  const normalizedRaw = normalizeForMatch(cleaned);

  if (knownTypes.length === 0) {
    return { name: cleaned || 'Billet', price: fallbackPrice };
  }

  const exact = knownTypes.find((type) => normalizeForMatch(type.name) === normalizedRaw);
  if (exact) return { name: exact.name, price: Number(exact.price) || fallbackPrice };

  const contains = knownTypes.find((type) => {
    const normalizedName = normalizeForMatch(type.name);
    return normalizedRaw.includes(normalizedName) || normalizedName.includes(normalizedRaw);
  });
  if (contains) return { name: contains.name, price: Number(contains.price) || fallbackPrice };

  let best: KnownTicketType | null = null;
  let bestScore = Number.POSITIVE_INFINITY;
  for (const type of knownTypes) {
    const score = levenshtein(normalizedRaw, normalizeForMatch(type.name));
    if (score < bestScore) {
      bestScore = score;
      best = type;
    }
  }

  if (best && bestScore <= Math.max(3, Math.floor(normalizeForMatch(best.name).length / 3))) {
    return { name: best.name, price: Number(best.price) || fallbackPrice };
  }

  return { name: knownTypes[0].name, price: Number(knownTypes[0].price) || fallbackPrice };
}

function levenshtein(a: string, b: string): number {
  const matrix = Array.from({ length: b.length + 1 }, (_, i) => [i]);
  for (let j = 0; j <= a.length; j += 1) matrix[0][j] = j;

  for (let i = 1; i <= b.length; i += 1) {
    for (let j = 1; j <= a.length; j += 1) {
      const cost = b[i - 1] === a[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }

  return matrix[b.length][a.length];
}

function fixOcrLabelText(text: string): string {
  return text
    .replace(/[|¦]/g, '|')
    .replace(/ticket\s+n\s*[*°ºo™]?\s*/gi, 'Ticket N° ')
    .replace(/ticket\s+n°\s*/gi, 'Ticket N° ')
    .replace(/(\d)\s+[Il1]\s+/g, '$1 | ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeOcrText(text: string): string {
  return fixOcrLabelText(text);
}

export function parseTicketLabel(text: string): { number: number | null; ticket_type: string } {
  const normalized = normalizeOcrText(text);
  const withoutFooter = normalized.replace(/made with toliarevent.*$/gi, '').trim();

  // Format imprimé : "Ticket N° #105 | Prévente" — le numéro est toujours après #
  const hashMatch = withoutFooter.match(/#\s*(\d{1,6})/);
  const ticketMatch = withoutFooter.match(/ticket\s*n[°ºo*™]?\s*#?\s*(\d{1,6})/i);
  const number = hashMatch
    ? Number(hashMatch[1])
    : ticketMatch
      ? Number(ticketMatch[1])
      : null;

  let ticket_type = '';
  const typeMatch = withoutFooter.match(/\|\s*([^|\n]+)/i);
  if (typeMatch) {
    ticket_type = typeMatch[1].replace(/made with.*$/i, '').trim();
  } else if (number != null) {
    const afterNumber = withoutFooter.match(/#\s*\d{1,6}\s*(.+)$/i);
    if (afterNumber) {
      ticket_type = afterNumber[1]
        .replace(/^[\s|[\].-]+/, '')
        .replace(/made with.*$/i, '')
        .trim();
    }
  }

  if (/ticket\s*n/i.test(ticket_type)) {
    ticket_type = '';
  }

  return { number, ticket_type };
}

function scoreParsedLabel(parsed: { number: number | null; ticket_type: string }, rawText: string): number {
  let score = 0;
  if (parsed.number != null && parsed.number > 0 && parsed.number < 1_000_000) score += 100;
  if (/ticket/i.test(rawText)) score += 25;
  if (/#\s*\d/.test(rawText)) score += 15;
  if (parsed.ticket_type && !/ticket\s*n/i.test(parsed.ticket_type)) score += 20;
  if (/\|/.test(rawText)) score += 8;
  return score;
}

function splitLabelCrops(source: HTMLCanvasElement) {
  const topH = Math.max(32, Math.floor(source.height * 0.45));
  const topCrop = cropCanvas(source, 0, 0, source.width, topH);
  const numberW = Math.min(topCrop.width, Math.floor(topCrop.width * 0.8));
  const numberCrop = cropCanvas(topCrop, 0, 0, numberW, topH);
  return { topCrop, numberCrop };
}

function getBounds(location: {
  topLeftCorner: { x: number; y: number };
  topRightCorner: { x: number; y: number };
  bottomLeftCorner: { x: number; y: number };
  bottomRightCorner: { x: number; y: number };
}) {
  const xs = [
    location.topLeftCorner.x,
    location.topRightCorner.x,
    location.bottomLeftCorner.x,
    location.bottomRightCorner.x,
  ];
  const ys = [
    location.topLeftCorner.y,
    location.topRightCorner.y,
    location.bottomLeftCorner.y,
    location.bottomRightCorner.y,
  ];
  return {
    minX: Math.max(0, Math.floor(Math.min(...xs)) - 10),
    maxX: Math.ceil(Math.max(...xs)) + 10,
    minY: Math.max(0, Math.floor(Math.min(...ys)) - 10),
    maxY: Math.ceil(Math.max(...ys)) + 10,
  };
}

function maskRegion(data: Uint8ClampedArray, width: number, minX: number, minY: number, maxX: number, maxY: number) {
  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      const index = (y * width + x) * 4;
      data[index] = 255;
      data[index + 1] = 255;
      data[index + 2] = 255;
      data[index + 3] = 255;
    }
  }
}

function decodeAllQrCodes(imageData: ImageData, maxAttempts = 32): QrDetection[] {
  const working = new Uint8ClampedArray(imageData.data);
  const detections: QrDetection[] = [];
  const seenIds = new Set<string>();

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const result = jsQR(working, imageData.width, imageData.height, {
      inversionAttempts: 'attemptBoth',
    });
    if (!result) break;

    const ticketId = extractTicketIdFromPayload(result.data);
    const bounds = getBounds(result.location);

    if (ticketId && !seenIds.has(ticketId)) {
      detections.push({
        id: ticketId,
        centerX: (bounds.minX + bounds.maxX) / 2,
        centerY: (bounds.minY + bounds.maxY) / 2,
        bottomY: bounds.maxY,
        leftX: bounds.minX,
        rightX: bounds.maxX,
      });
      seenIds.add(ticketId);
    }

    maskRegion(working, imageData.width, bounds.minX, bounds.minY, bounds.maxX, bounds.maxY);
  }

  return detections;
}

function renderImageToCanvas(image: HTMLImageElement, scale: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas indisponible');

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas;
}

function cropCanvas(
  source: HTMLCanvasElement,
  x: number,
  y: number,
  width: number,
  height: number
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, width);
  canvas.height = Math.max(1, height);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas indisponible');

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(source, x, y, width, height, 0, 0, width, height);
  return canvas;
}

function enhanceForOcr(source: HTMLCanvasElement, mode: 'soft' | 'hard' = 'soft'): HTMLCanvasElement {
  const scale = 3;
  const canvas = document.createElement('canvas');
  canvas.width = source.width * scale;
  canvas.height = source.height * scale;
  const ctx = canvas.getContext('2d');
  if (!ctx) return source;

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const { data } = imageData;
  for (let i = 0; i < data.length; i += 4) {
    const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    let value = gray;
    if (mode === 'hard') {
      value = gray < 165 ? 0 : 255;
    } else {
      value = Math.max(0, Math.min(255, (gray - 40) * 1.35));
    }
    data[i] = value;
    data[i + 1] = value;
    data[i + 2] = value;
  }
  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

async function recognizeLabelParsed(
  canvas: HTMLCanvasElement
): Promise<{ number: number | null; ticket_type: string }> {
  const { topCrop, numberCrop } = splitLabelCrops(canvas);
  const attempts: Array<{ canvas: HTMLCanvasElement; lang: string; psm: string; preferNumber?: boolean }> = [
    { canvas: enhanceForOcr(numberCrop, 'hard'), lang: 'eng+fra', psm: '7', preferNumber: true },
    { canvas: enhanceForOcr(topCrop, 'hard'), lang: 'eng+fra', psm: '7' },
    { canvas: enhanceForOcr(topCrop, 'soft'), lang: 'eng+fra', psm: '7' },
    { canvas: enhanceForOcr(canvas, 'soft'), lang: 'eng+fra', psm: '6' },
  ];

  let bestNumber: number | null = null;
  let bestNumberScore = -1;
  let bestType = '';
  let bestTypeScore = -1;

  for (const attempt of attempts) {
    const { data } = await Tesseract.recognize(attempt.canvas, attempt.lang, {
      logger: () => undefined,
      tessedit_pageseg_mode: attempt.psm,
    });
    const text = data.text || '';
    const parsed = parseTicketLabel(text);
    const score = scoreParsedLabel(parsed, text);

    if (parsed.number != null) {
      const numberScore = score + (attempt.preferNumber ? 30 : 0);
      if (numberScore > bestNumberScore) {
        bestNumberScore = numberScore;
        bestNumber = parsed.number;
      }
    }

    if (parsed.ticket_type) {
      const typeScore = score + (/\|/.test(text) ? 12 : 0);
      if (typeScore > bestTypeScore) {
        bestTypeScore = typeScore;
        bestType = parsed.ticket_type;
      }
    }
  }

  return { number: bestNumber, ticket_type: bestType };
}

function scanCanvasAtOffset(
  canvas: HTMLCanvasElement,
  offsetX: number,
  offsetY: number,
  scaleToReference: number
): QrDetection[] {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return [];

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  return decodeAllQrCodes(imageData).map((detection) => ({
    id: detection.id,
    centerX: (offsetX + detection.centerX) / scaleToReference,
    centerY: (offsetY + detection.centerY) / scaleToReference,
    bottomY: (offsetY + detection.bottomY) / scaleToReference,
    leftX: (offsetX + detection.leftX) / scaleToReference,
    rightX: (offsetX + detection.rightX) / scaleToReference,
  }));
}

function scanRegions(canvas: HTMLCanvasElement, scaleToReference: number): QrDetection[] {
  const regions: Array<{ x: number; y: number; w: number; h: number }> = [
    { x: 0, y: 0, w: canvas.width, h: canvas.height },
    { x: 0, y: 0, w: Math.floor(canvas.width / 2), h: canvas.height },
    { x: Math.floor(canvas.width / 2), y: 0, w: Math.ceil(canvas.width / 2), h: canvas.height },
  ];

  const rowCount = 4;
  const rowHeight = Math.ceil(canvas.height / rowCount);
  for (let row = 0; row < rowCount; row += 1) {
    const y = row * rowHeight;
    const h = row === rowCount - 1 ? canvas.height - y : rowHeight;
    regions.push({ x: 0, y, w: Math.floor(canvas.width / 2), h });
    regions.push({ x: Math.floor(canvas.width / 2), y, w: Math.ceil(canvas.width / 2), h });
  }

  const merged = new Map<string, QrDetection>();
  for (const region of regions) {
    const slice = cropCanvas(canvas, region.x, region.y, region.w, region.h);
    const found = scanCanvasAtOffset(slice, region.x, region.y, scaleToReference);
    for (const detection of found) {
      merged.set(detection.id, detection);
    }
  }

  return Array.from(merged.values());
}

function detectAllTicketQrs(image: HTMLImageElement): { referenceCanvas: HTMLCanvasElement; detections: QrDetection[] } {
  const baseScale = image.naturalWidth > MAX_SCAN_WIDTH ? MAX_SCAN_WIDTH / image.naturalWidth : 1;
  const referenceCanvas = renderImageToCanvas(image, baseScale);
  const merged = new Map<string, QrDetection>();

  for (const scaleMultiplier of SCAN_SCALES) {
    const scanScale = baseScale * scaleMultiplier;
    const scanCanvas = renderImageToCanvas(image, scanScale);
    const scaleToReference = scanScale / baseScale;
    const found = scanRegions(scanCanvas, scaleToReference);
    for (const detection of found) {
      merged.set(detection.id, detection);
    }
  }

  const detections = Array.from(merged.values()).sort((a, b) => {
    if (Math.abs(a.centerY - b.centerY) > 50) return a.centerY - b.centerY;
    return a.centerX - b.centerX;
  });

  return { referenceCanvas, detections };
}

function extractLabelsFromPlainText(text: string): Array<{ number: number; ticket_type: string }> {
  const normalized = normalizeOcrText(text);
  const regex = /#\s*(\d{1,6})\s*(?:\|\s*([^|\n]+))?/gi;
  const labels: Array<{ number: number; ticket_type: string }> = [];
  let match = regex.exec(normalized);
  while (match) {
    labels.push({
      number: Number(match[1]),
      ticket_type: (match[2] || '').replace(/made with.*$/i, '').trim(),
    });
    match = regex.exec(normalized);
  }
  return labels;
}

async function extractLabelCandidates(canvas: HTMLCanvasElement): Promise<LabelCandidate[]> {
  const { data } = await Tesseract.recognize(enhanceForOcr(canvas, 'soft'), 'eng+fra', {
    logger: () => undefined,
    tessedit_pageseg_mode: '6',
  });

  const plainLabels = extractLabelsFromPlainText(data.text || '');
  return plainLabels.map((label, index) => ({
    number: label.number,
    ticket_type: label.ticket_type,
    centerX: canvas.width / 2,
    centerY: (canvas.height / (plainLabels.length + 1)) * (index + 1),
  }));
}

function assignLabelsToQrs(
  detections: QrDetection[],
  candidates: LabelCandidate[]
): Map<string, LabelCandidate> {
  type Pair = { qr: QrDetection; label: LabelCandidate; score: number };
  const pairs: Pair[] = [];

  for (const qr of detections) {
    for (const label of candidates) {
      if (label.centerY < qr.bottomY - 8) continue;
      const dy = label.centerY - qr.bottomY;
      if (dy > qr.bottomY * 0.25 + 120) continue;
      const dx = Math.abs(label.centerX - qr.centerX);
      pairs.push({ qr, label, score: dx + dy * 1.5 });
    }
  }

  pairs.sort((a, b) => a.score - b.score);

  const assigned = new Map<string, LabelCandidate>();
  const usedLabels = new Set<LabelCandidate>();

  for (const pair of pairs) {
    if (assigned.has(pair.qr.id) || usedLabels.has(pair.label)) continue;
    assigned.set(pair.qr.id, pair.label);
    usedLabels.add(pair.label);
  }

  return assigned;
}

async function ocrLabelBelowQr(
  sourceCanvas: HTMLCanvasElement,
  detection: QrDetection
): Promise<{ number: number | null; ticket_type: string }> {
  const qrWidth = Math.max(64, detection.rightX - detection.leftX);
  const cropW = Math.min(sourceCanvas.width, Math.ceil(qrWidth * 2.6));
  const cropX = Math.max(0, Math.floor(detection.centerX - cropW / 2));
  const cropY = Math.min(sourceCanvas.height - 1, Math.floor(detection.bottomY + 2));
  const cropH = Math.min(sourceCanvas.height - cropY, Math.max(90, Math.ceil(qrWidth * 0.95)));

  const labelCrop = cropCanvas(sourceCanvas, cropX, cropY, cropW, cropH);
  return recognizeLabelParsed(labelCrop);
}

export async function parseTicketScreenshot(
  file: File,
  defaultPrice = 0,
  knownTicketTypes: KnownTicketType[] = []
): Promise<ParsedTicketFromScreenshot[]> {
  const image = await loadImageFile(file);
  const { referenceCanvas, detections } = detectAllTicketQrs(image);

  if (detections.length === 0) {
    throw new Error(
      'Aucun QR code de billet détecté. Utilisez une capture nette, bien cadrée, avec les QR visibles (PNG/JPG).'
    );
  }

  const labelCandidates = await extractLabelCandidates(referenceCanvas);
  const assignedLabels = assignLabelsToQrs(detections, labelCandidates);

  if (assignedLabels.size < detections.length && labelCandidates.length === detections.length) {
    const sortedQrs = [...detections].sort((a, b) => {
      if (Math.abs(a.centerY - b.centerY) > 50) return a.centerY - b.centerY;
      return a.centerX - b.centerX;
    });
    const sortedLabels = [...labelCandidates].sort((a, b) => {
      if (Math.abs(a.centerY - b.centerY) > 50) return a.centerY - b.centerY;
      return a.centerX - b.centerX;
    });
    sortedQrs.forEach((qr, index) => {
      assignedLabels.set(qr.id, sortedLabels[index]);
    });
  }

  const parsed: ParsedTicketFromScreenshot[] = [];
  for (const detection of detections) {
    const directLabel = await ocrLabelBelowQr(referenceCanvas, detection);
    const matched = assignedLabels.get(detection.id);

    const number = directLabel.number ?? matched?.number ?? null;
    const rawType = directLabel.ticket_type || matched?.ticket_type || '';
    const resolvedType = matchKnownTicketType(rawType, knownTicketTypes, defaultPrice);

    parsed.push({
      id: detection.id,
      number,
      ticket_type: resolvedType.name,
      price: resolvedType.price || defaultPrice,
      enabled: number != null,
    });
  }

  return parsed;
}
