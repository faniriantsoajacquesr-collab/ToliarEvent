const fetch = global.fetch || require('node-fetch');
module.exports = async function generateTickets({ admin, payload, frontendUrl = (process.env.FRONTEND_URL || 'https://app.local') }) {
  const QRCode = require('qrcode');
  const { PDFDocument } = require('pdf-lib');
  const { randomUUID } = require('crypto');

  const Sharp = (() => {
    try {
      return require('sharp');
    } catch (err) {
      return null;
    }
  })();

  const { event_id, count = 1, design_image_data, design_url, config, ticket_type = 'standard' } = payload;

  // Phase 1: determine starting number per ticket_type
  let startNumber = 1;
  try {
    const { data: maxRow } = await admin
      .from('tickets')
      .select('number')
      .eq('event_id', event_id)
      .eq('ticket_type', ticket_type)
      .order('number', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (maxRow && typeof maxRow.number === 'number') startNumber = Number(maxRow.number) + 1;
  } catch (e) {
    // ignore
  }

  const ticketsToInsert = [];
  for (let i = 0; i < Number(count); i++) {
    const id = randomUUID();
    ticketsToInsert.push({ 
      id, 
      event_id, 
      ticket_type, 
      price: payload.price || 0, // Insertion du prix depuis le payload
      number: startNumber + i, 
      created_at: new Date().toISOString() 
    });
  }

  // Insert tickets
  let insertedTickets = [];
  try {
    const { data: inserted, error: insertErr } = await admin.from('tickets').insert(ticketsToInsert).select();
    if (!insertErr) insertedTickets = inserted || [];
  } catch (err) {
    // continue with ticketsToInsert
  }

  const { parseLayoutConfig, drawTicketOnPage, buildQrColorOptions } = require('./ticketPdfLayout');
  const qrColors = buildQrColorOptions(config || {});

  // Generate QR codes
  const qrDataUrls = {};
  for (const t of ticketsToInsert) {
    const payloadUrl = `${frontendUrl}/ticket/${t.id}`;
    const dataUrl = await QRCode.toDataURL(payloadUrl, { margin: 0, color: qrColors });
    qrDataUrls[t.id] = dataUrl;
  }

  // Build PDF
  const mmToPt = (mm) => mm * 2.83464567;
  const pdfDoc = await PDFDocument.create();

  // get design binary
  let designBinary;
  if (design_url && typeof design_url === 'string') {
    const resp = await fetch(design_url);
    if (!resp.ok) throw new Error('Failed to fetch design_url');
    const ab = await resp.arrayBuffer();
    designBinary = Buffer.from(ab);
  } else if (typeof design_image_data === 'string' && design_image_data.startsWith('data:')) {
    const parts = design_image_data.split(',');
    designBinary = Buffer.from(parts[1], 'base64');
  } else {
    designBinary = Buffer.from(design_image_data || '', 'base64');
  }

  let pngBuffer = designBinary;
  if (Sharp) {
    try {
      pngBuffer = await Sharp(designBinary).png().toBuffer();
    } catch (e) {
      // fallback
    }
  }

  let embeddedDesign;
  try {
    embeddedDesign = await pdfDoc.embedPng(pngBuffer);
  } catch (ePng) {
    try {
      embeddedDesign = await pdfDoc.embedJpg(designBinary);
    } catch (eJpg) {
      throw new Error('Failed to embed design image');
    }
  }

  const { parseLayoutConfig, drawTicketOnPage } = require('./ticketPdfLayout');

  const A4_WIDTH_MM = 210;
  const A4_HEIGHT_MM = 297;
  const PAGE_MARGIN_MM = 8.4;

  const support = config?.supportType || 'ticket';
  const cols = config?.layoutOption === '1_col' ? 1 : config?.layoutOption === '2_col' ? 2 : 3;
  const rowGap = config?.rowGap || 0;
  const colGap = config?.colGap || 0;
  const { totalTicketWmm, totalTicketHmm } = parseLayoutConfig(config, support);

  const tickets = (insertedTickets && insertedTickets.length > 0) ? insertedTickets : ticketsToInsert;

  let currentPage = null;
  let currentY = A4_HEIGHT_MM - PAGE_MARGIN_MM;

  for (let i = 0; i < tickets.length; i++) {
    const colIdx = i % cols;
    const ticket = tickets[i];

    if (colIdx === 0 && i !== 0) {
      currentY -= (totalTicketHmm + rowGap);
    }

    if (!currentPage || (currentY - totalTicketHmm) < PAGE_MARGIN_MM) {
      currentPage = pdfDoc.addPage([mmToPt(A4_WIDTH_MM), mmToPt(A4_HEIGHT_MM)]);
      currentY = A4_HEIGHT_MM - PAGE_MARGIN_MM;
    }

    const currentX = PAGE_MARGIN_MM + (colIdx * (totalTicketWmm + colGap));
    const drawX = mmToPt(currentX);
    const drawY = mmToPt(currentY - totalTicketHmm);

    await drawTicketOnPage({
      page: currentPage,
      pdfDoc,
      embeddedDesign,
      qrDataUrl: qrDataUrls[ticket.id],
      ticket,
      config,
      drawX,
      drawY,
      mmToPt,
    });
  }

  const pdfBytes = await pdfDoc.save();
  const pdfBase64 = Buffer.from(pdfBytes).toString('base64');
  const filename = `${event_id}_tickets_${Date.now()}.pdf`;

  return { pdfBase64, filename, tickets: ticketsToInsert };
};
