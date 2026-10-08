import { API_URL } from '../config/api';
import type { PurchasedTicketInfo } from '../utils/generateTicketQrPng';

export type Checkout = {
  id: string;
  status: 'pending' | 'failed' | 'expired' | 'paid';
  event_id: string;
  event_title: string;
  ticket_type: string;
  quantity: number;
  amount: number;
  expires_at: string | null;
  tickets: PurchasedTicketInfo[];
};
type Response = { success: boolean; error?: string; checkout: Checkout; payment_url?: string; warning?: string };
async function request(path: string, token: string, body?: unknown): Promise<Response> {
  const response = await fetch(`${API_URL}${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Checkout-Token': token },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(40000),
  });
  if (!response.headers.get('content-type')?.includes('application/json')) {
    throw new Error(response.status === 404
      ? 'Le serveur ne dispose pas encore des routes de paiement Papi. Déployez la nouvelle version du backend ou utilisez le backend local.'
      : `Le serveur de paiement a renvoyé une réponse inattendue (HTTP ${response.status}). Réessayez dans quelques instants.`);
  }
  const data = await response.json();
  if (!response.ok || !data.success) throw new Error(data.error || 'Impossible de joindre le service de paiement.');
  return data;
}
export const papiAPI = {
  create: (eventId: string, token: string, body: unknown) => request(`/events/${eventId}/checkout`, token, body),
  status: (id: string, token: string) => request(`/checkouts/${id}`, token),
  pay: (id: string, token: string) => request(`/checkouts/${id}/pay`, token, {}),
};
export function checkoutCredentials() {
  return { id: crypto.randomUUID(), token: Array.from(crypto.getRandomValues(new Uint8Array(32)), n => n.toString(16).padStart(2, '0')).join('') };
}
export function trackingPath(id: string, token: string) {
  return `/paiement/${id}#token=${token}`;
}
