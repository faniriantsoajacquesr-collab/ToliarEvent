const fetch = global.fetch || require('node-fetch');
module.exports = async function generateTickets({ admin, payload, frontendUrl = (process.env.FRONTEND_URL || 'https://app.local') }) {
  const QRCode = require('qrcode');
  const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');
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

  // Generate QR codes
  const qrDataUrls = {};
  for (const t of ticketsToInsert) {
    const payloadUrl = `${frontendUrl}/ticket/${t.id}`;
    const dataUrl = await QRCode.toDataURL(payloadUrl, { margin: 0 });
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

  // Page and layout config
  const A4_WIDTH_MM = 210;
  const A4_HEIGHT_MM = 297;
  const PAGE_MARGIN_MM = 8.4;

  const support = config?.supportType || 'ticket';
  const totalTicketWmm = config?.widthMm || (support === 'badge' ? 85 : 100);
  const totalTicketHmm = config?.heightMm || (support === 'badge' ? 54 : 40);

  let qrZoneWmm = 0;
  if (support === 'ticket') qrZoneWmm = totalTicketHmm;
  else if (support === 'invitation') qrZoneWmm = 50;

  const designWmm = totalTicketWmm - qrZoneWmm;

  const MM_TO_PT = 72 / 25.4;
  const PAGE_WIDTH = 595.28;
  const PAGE_HEIGHT = 841.89;
  const marginX = 16 * MM_TO_PT;
  const marginY = 16 * MM_TO_PT;

  const usableWidth = PAGE_WIDTH - (2 * marginX);
  const usableHeight = PAGE_HEIGHT - (2 * marginY);

  const colGapPt = (config.colGap || 0) * MM_TO_PT;
  const rowGapPt = (config.rowGap || 0) * MM_TO_PT;

  let cols = 1;
  if (config.layoutOption === '2_col') cols = 2;
  if (config.layoutOption === '3_col') cols = 3;

  const ticketWPt = mmToPt(totalTicketWmm);
  const ticketHPt = mmToPt(totalTicketHmm);
  const containerWidthPt = ticketWPt;
  const rowHeight = ticketHPt;

  let currentHeightTest = 0;
  let maxRowsPerPage = 0;
  const rowStep = rowHeight + rowGapPt;

  while (currentHeightTest + rowHeight <= usableHeight + 0.5) {
    maxRowsPerPage++;
    currentHeightTest += rowStep;
  }
  maxRowsPerPage = Math.max(1, maxRowsPerPage);

  const maxTicketsPerPage = maxRowsPerPage * cols;
  const tickets = (insertedTickets && insertedTickets.length > 0) ? insertedTickets : ticketsToInsert;
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bgImage = embeddedDesign;

  let currentPage = null;

  for (let i = 0; i < tickets.length; i++) {
    const ticket = tickets[i];
    const pageIndex = i % maxTicketsPerPage;

    if (pageIndex === 0) {
      currentPage = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    }

    const currentRow = Math.floor(pageIndex / cols);
    const currentCol = pageIndex % cols;
    const drawX = marginX + (currentCol * (containerWidthPt + colGapPt));
    const drawY = PAGE_HEIGHT - marginY - ((currentRow + 1) * rowHeight) - (currentRow * rowGapPt);

    const qrWidthMm = config.qrContainerMm || (support === 'ticket' ? totalTicketHmm : 50);
    const qrSize = qrWidthMm * MM_TO_PT;
    const qrX = drawX + containerWidthPt - qrSize - (4 * MM_TO_PT);
    const qrY = drawY + (rowHeight - qrSize) / 2;
    const designAreaWidthPt = Math.max(0, containerWidthPt - qrSize - (4 * MM_TO_PT));

    if (bgImage) {
      currentPage.drawImage(bgImage, {
        x: drawX,
        y: drawY,
        width: designAreaWidthPt,
        height: rowHeight,
      });
    } else {
      currentPage.drawRectangle({
        x: drawX,
        y: drawY,
        width: designAreaWidthPt,
        height: rowHeight,
        color: rgb(0.95, 0.95, 0.95),
      });
    }

    const qrBuffer = await QRCode.toBuffer(ticket.qr_code_url || `${frontendUrl}/ticket/${ticket.id}`, {
      margin: 1,
      width: Math.round(qrSize * 1.5)
    });
    const qrImage = await pdfDoc.embedPng(qrBuffer);

    currentPage.drawImage(qrImage, {
      x: qrX,
      y: qrY,
      width: qrSize,
      height: qrSize,
    });

    const labelFontSize = 10;
    const textPaddingLeftPt = 6 * MM_TO_PT;
    const availableTextWidthPt = qrX - drawX - textPaddingLeftPt - (2 * MM_TO_PT);

    const line1Text = payload.ticket_type ? payload.ticket_type.toUpperCase() : 'STANDARD';
    const line2Text = `N° ${String(ticket.number).padStart(4, '0')}`;

    const truncateToWidth = (f, size, str, maxW) => {
      if (f.widthOfTextAtSize(str, size) <= maxW) return str;
      let s = str;
      while (s.length > 0 && f.widthOfTextAtSize(s + '…', size) > maxW) {
        s = s.slice(0, -1);
      }
      return s.length === 0 ? '…' : s + '…';
    };

    const safeLine1 = truncateToWidth(font, labelFontSize, line1Text, availableTextWidthPt);
    const safeLine2 = truncateToWidth(font, labelFontSize - 1, line2Text, availableTextWidthPt);

    const textX = drawX + textPaddingLeftPt;
    const line1Y = drawY + (rowHeight * 0.5);
    const line2Y = line1Y - (labelFontSize + 4);

    currentPage.drawText(safeLine1, {
      x: textX,
      y: line1Y,
      size: labelFontSize,
      font: font,
      color: rgb(0.1, 0.1, 0.1),
    });

    currentPage.drawText(safeLine2, {
      x: textX,
      y: line2Y,
      size: labelFontSize - 1,
      font: font,
      color: rgb(0.4, 0.4, 0.4),
    });
  }

  const pdfBytes = await pdfDoc.save();
  const pdfBase64 = Buffer.from(pdfBytes).toString('base64');
  const filename = `${event_id}_tickets_${Date.now()}.pdf`;

  return { pdfBase64, filename, tickets: ticketsToInsert };
};
