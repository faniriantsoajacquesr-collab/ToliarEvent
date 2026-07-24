export type TicketScanAction = 'activate' | 'use';

export type TicketDbStatus = 'valid' | 'vendu' | 'utilise';
export type TicketUiStatus = 'Valide' | 'Payé' | 'Utilisé';

export function normalizeTicketDbStatus(status: string | null | undefined): TicketDbStatus {
  const normalized = String(status || 'valid')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  if (normalized === 'vendu') return 'vendu';
  if (normalized === 'utilise') return 'utilise';
  return 'valid';
}

export function mapTicketDbStatusToUi(status: string | null | undefined): TicketUiStatus {
  const dbStatus = normalizeTicketDbStatus(status);
  if (dbStatus === 'vendu') return 'Payé';
  if (dbStatus === 'utilise') return 'Utilisé';
  return 'Valide';
}

export function parseTicketIdFromQr(decodedText: string): string {
  let ticketId = decodedText || '';
  try {
    const url = new URL(decodedText);
    const parts = url.pathname.split('/').filter(Boolean);
    if (parts.length > 0) ticketId = parts[parts.length - 1];
  } catch {
    // Not a URL — keep decodedText as-is
  }
  return ticketId.trim();
}
