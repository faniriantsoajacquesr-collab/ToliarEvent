import QRCode from 'qrcode';

export type PurchasedTicketInfo = {
  id: string;
  number: number;
  ticket_type: string;
};

function getTicketQrPayload(ticketId: string): string {
  return `${window.location.origin}/ticket/${ticketId}`;
}

export async function generateTicketQrPng(ticket: PurchasedTicketInfo): Promise<Blob> {
  const canvas = document.createElement('canvas');
  const width = 420;
  const height = 540;
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Impossible de créer le canvas');

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);

  const qrCanvas = document.createElement('canvas');
  await QRCode.toCanvas(qrCanvas, getTicketQrPayload(ticket.id), {
    width: 300,
    margin: 2,
    color: { dark: '#0f172a', light: '#ffffff' },
  });

  const qrSize = 300;
  const qrX = (width - qrSize) / 2;
  const qrY = 36;
  ctx.drawImage(qrCanvas, qrX, qrY, qrSize, qrSize);

  const label = `Ticket n°${ticket.number} | ${ticket.ticket_type}`;
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 20px system-ui, -apple-system, Segoe UI, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, width / 2, qrY + qrSize + 40, width - 48);

  ctx.fillStyle = '#64748b';
  ctx.font = '500 13px system-ui, -apple-system, Segoe UI, sans-serif';
  ctx.fillText('Made with ToliarEvent', width / 2, height - 36);

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('Échec de la génération du PNG'));
        return;
      }
      resolve(blob);
    }, 'image/png');
  });
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export async function downloadTicketQrPngs(tickets: PurchasedTicketInfo[]) {
  for (const ticket of tickets) {
    const blob = await generateTicketQrPng(ticket);
    const safeType = ticket.ticket_type.replace(/[^\w\-]+/g, '_');
    downloadBlob(blob, `ticket-${ticket.number}-${safeType}.png`);
    if (tickets.length > 1) {
      await new Promise((resolve) => setTimeout(resolve, 300));
    }
  }
}
