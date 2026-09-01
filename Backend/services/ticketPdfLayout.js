/**

 * Shared ticket PDF layout helpers — must stay in sync with Frontend/src/utils/badgeQrLayout.ts

 */



function clamp(value, min, max) {

  return Math.min(max, Math.max(min, value));

}



function getMaxColWidthMm(cols, colGap) {

  const SHEET_INNER = 210 - 8.4 * 2;

  return Math.floor((SHEET_INNER - colGap * Math.max(0, cols - 1)) / Math.max(1, cols));

}



const MARGIN_LABEL_COL_MM = 10;



function getMarginQrPosZoneMm(qrContainerMm) {

  return Math.max(18, qrContainerMm - MARGIN_LABEL_COL_MM);

}



function normalizeHexColor(value, fallback) {

  if (!value) return fallback;

  if (value === 'white') return '#ffffff';

  if (value === 'black') return '#111827';

  return /^#[0-9A-Fa-f]{6}$/.test(value) ? value : fallback;

}



function hexToRgb(hex, rgbFactory) {

  const h = normalizeHexColor(hex, '#000000').slice(1);

  return rgbFactory(

    parseInt(h.slice(0, 2), 16) / 255,

    parseInt(h.slice(2, 4), 16) / 255,

    parseInt(h.slice(4, 6), 16) / 255

  );

}



function getContrastTextColor(hex) {

  const h = normalizeHexColor(hex, '#ffffff').slice(1);

  const r = parseInt(h.slice(0, 2), 16);

  const g = parseInt(h.slice(2, 4), 16);

  const b = parseInt(h.slice(4, 6), 16);

  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

  return luminance > 0.55 ? '#111827' : '#ffffff';

}



function drawVerticalMarginLabel(page, { text, xPt, centerYPt, font, size, color, degrees }) {

  const textWidth = font.widthOfTextAtSize(text, size);

  page.drawText(text, {

    x: xPt,

    y: centerYPt - textWidth / 2,

    size,

    font,

    color,

    rotate: degrees(90),

  });

}



async function drawLabelStrip(page, {

  drawX,

  drawY,

  stripWmm,

  heightMm,

  mmToPt,

  rgb,

  qrBgHex,

  ticket,

  pdfDoc,

  degrees,

}) {

  const { StandardFonts } = require('pdf-lib');

  const textFont = await pdfDoc.embedFont(StandardFonts.Helvetica);

  const stripWPt = mmToPt(stripWmm);

  const stripHPt = mmToPt(heightMm);

  const ticketIdDisplay = ticket.number ? `#${ticket.number}` : String(ticket.id).slice(0, 8);

  const line1Text = `Ticket N° ${ticketIdDisplay} | ${ticket.ticket_type || 'Standard'}`;

  const line2Text = 'Made with ToliarEvent';

  const labelColor = hexToRgb(getContrastTextColor(qrBgHex), rgb);



  page.drawRectangle({

    x: drawX,

    y: drawY,

    width: stripWPt,

    height: stripHPt,

    color: hexToRgb(qrBgHex, rgb),

  });



  const centerYPt = drawY + stripHPt / 2;

  drawVerticalMarginLabel(page, {

    text: line1Text,

    xPt: drawX + stripWPt * 0.72,

    centerYPt,

    font: textFont,

    size: 5.5,

    color: labelColor,

    degrees,

  });

  drawVerticalMarginLabel(page, {

    text: line2Text,

    xPt: drawX + stripWPt * 0.28,

    centerYPt,

    font: textFont,

    size: 4.8,

    color: labelColor,

    degrees,

  });



  page.drawLine({

    start: { x: drawX + 0.5, y: drawY + 2 },

    end: { x: drawX + 0.5, y: drawY + stripHPt - 2 },

    thickness: 0.4,

    color: rgb(0.35, 0.35, 0.35),

  });

}



function normalizeSupportType(support) {

  if (support === 'ticket') return 'invitation';

  return support === 'badge' ? 'badge' : 'invitation';

}



function computeMarginDesignDisplayMm(rowHeightMm, imgNatural, maxDesignWmm) {

  if (!imgNatural || !imgNatural.width) return maxDesignWmm;

  const aspectWidth = rowHeightMm * (imgNatural.height ? imgNatural.width / imgNatural.height : 1);

  return Math.min(maxDesignWmm, Math.max(10, Math.round(aspectWidth)));

}



function parseLayoutConfig(config, support, imgNatural = null) {

  const supportType = normalizeSupportType(support);

  const cols = config?.layoutOption === '1_col' ? 1 : config?.layoutOption === '2_col' ? 2 : 3;

  const colGap = Number(config?.colGap) || 0;

  const qrLayoutMode = config?.qrLayoutMode === 'embedded' ? 'embedded' : 'margin';

  const totalTicketHmm = config?.heightMm || (supportType === 'badge' ? 54 : 40);

  const qrSizeMm = Number(config?.qrSizeMm) || 40;

  const qrPosX = typeof config?.qrPosX === 'number' ? config.qrPosX : 50;

  const qrPosY = typeof config?.qrPosY === 'number' ? config.qrPosY : 50;

  const qrBg = normalizeHexColor(config?.qrBg, '#0a0a0a');

  const qrFg = normalizeHexColor(config?.qrFg, '#000000');



  let qrZoneWmm = 0;

  let designWmm = config?.widthMm || (supportType === 'badge' ? 85 : 100);

  let totalTicketWmm = designWmm;

  let labelStripWmm = 0;



  if (qrLayoutMode !== 'embedded' && supportType !== 'badge') {

    qrZoneWmm = Number(config?.qrContainerMm) || 50;

    labelStripWmm = MARGIN_LABEL_COL_MM;

    const maxTotalW = getMaxColWidthMm(cols, colGap);

    const maxDesignW = Math.max(10, maxTotalW - qrZoneWmm);

    const requestedDesignW =

      typeof config?.designWidthMm === 'number'

        ? config.designWidthMm

        : Math.max(10, (config?.widthMm || 100) - qrZoneWmm);

    designWmm = computeMarginDesignDisplayMm(totalTicketHmm, imgNatural, Math.min(requestedDesignW, maxDesignW));

    totalTicketWmm = designWmm + qrZoneWmm;

  } else if (qrLayoutMode === 'embedded' && supportType !== 'badge') {

    labelStripWmm = MARGIN_LABEL_COL_MM;

    const maxTotalW = getMaxColWidthMm(cols, colGap);

    const requestedDesignW =

      typeof config?.designWidthMm === 'number'

        ? config.designWidthMm

        : Math.max(10, (config?.widthMm || 100) - MARGIN_LABEL_COL_MM);

    designWmm = computeMarginDesignDisplayMm(

      totalTicketHmm,

      imgNatural,

      Math.min(requestedDesignW, maxTotalW - MARGIN_LABEL_COL_MM)

    );

    totalTicketWmm = designWmm + MARGIN_LABEL_COL_MM;

  } else if (supportType !== 'badge') {

    totalTicketWmm = Math.min(designWmm, getMaxColWidthMm(cols, colGap));

    designWmm = totalTicketWmm;

  } else {

    totalTicketWmm = designWmm;

  }



  return {

    qrLayoutMode,

    totalTicketWmm,

    totalTicketHmm,

    qrSizeMm,

    qrPosX,

    qrPosY,

    qrBg,

    qrFg,

    qrZoneWmm,

    designWmm,

    labelStripWmm,

  };

}



function qrPositionFromTopOrigin(zoneWmm, zoneHmm, sizeMm, posX, posY) {

  const cx = (posX / 100) * zoneWmm;

  const cy = (posY / 100) * zoneHmm;

  return {

    xMm: clamp(cx - sizeMm / 2, 0, Math.max(0, zoneWmm - sizeMm)),

    yMmFromTop: clamp(cy - sizeMm / 2, 0, Math.max(0, zoneHmm - sizeMm)),

  };

}



function buildQrColorOptions(config) {

  return {

    dark: normalizeHexColor(config?.qrFg, '#000000'),

    light: normalizeHexColor(config?.qrBg, '#ffffff'),

  };

}



async function drawTicketOnPage({

  page,

  pdfDoc,

  embeddedDesign,

  qrDataUrl,

  ticket,

  config,

  drawX,

  drawY,

  mmToPt,

}) {

  const { rgb, degrees } = require('pdf-lib');

  const support = config?.supportType || 'ticket';

  const imgNatural = embeddedDesign

    ? { width: embeddedDesign.width, height: embeddedDesign.height }

    : null;

  const layout = parseLayoutConfig(config, support, imgNatural);

  const {

    qrLayoutMode,

    totalTicketHmm,

    qrSizeMm,

    qrPosX,

    qrPosY,

    qrBg,

    qrZoneWmm,

    designWmm,

    labelStripWmm,

  } = layout;



  const designWPt = mmToPt(designWmm);

  const designHPt = mmToPt(totalTicketHmm);

  const totalTicketWPt = mmToPt(layout.totalTicketWmm);

  const borderPt = Math.max(0.5, mmToPt(0.35));



  if (qrLayoutMode === 'margin' && qrZoneWmm > 0) {

    page.drawRectangle({

      x: drawX + mmToPt(designWmm),

      y: drawY,

      width: mmToPt(qrZoneWmm),

      height: designHPt,

      color: hexToRgb(qrBg, rgb),

    });

  }



  const { width: imgW, height: imgH } = embeddedDesign.scale(1);

  const scale = Math.min(designWPt / imgW, designHPt / imgH);

  const dw = imgW * scale;

  const dh = imgH * scale;



  page.drawImage(embeddedDesign, {

    x: drawX + (qrLayoutMode === 'embedded' ? (designWPt - dw) / 2 : 0),

    y: drawY + (designHPt - dh) / 2,

    width: dw,

    height: dh,

  });



  if (labelStripWmm > 0 && support !== 'badge') {

    const stripXmm = qrLayoutMode === 'margin' ? designWmm + qrZoneWmm - labelStripWmm : designWmm;

    await drawLabelStrip(page, {

      drawX: drawX + mmToPt(stripXmm),

      drawY,

      stripWmm: labelStripWmm,

      heightMm: totalTicketHmm,

      mmToPt,

      rgb,

      qrBgHex: qrBg,

      ticket,

      pdfDoc,

      degrees,

    });

  }



  const shouldDrawQr = qrLayoutMode === 'embedded' || qrZoneWmm > 0;

  if (shouldDrawQr && qrDataUrl) {

    const qrBuf = Buffer.from(qrDataUrl.split(',')[1], 'base64');

    const qrImage = await pdfDoc.embedPng(qrBuf).catch(() => pdfDoc.embedJpg(qrBuf));

    if (qrImage) {

      const qrSizePt = mmToPt(qrSizeMm);

      const qrPosZoneWmm =

        qrLayoutMode === 'embedded' ? designWmm : getMarginQrPosZoneMm(qrZoneWmm);

      const { xMm, yMmFromTop } = qrPositionFromTopOrigin(

        qrPosZoneWmm,

        totalTicketHmm,

        qrSizeMm,

        qrPosX,

        qrPosY

      );



      const zoneOffsetMm = qrLayoutMode === 'embedded' ? 0 : designWmm;

      const qx = drawX + mmToPt(zoneOffsetMm + xMm);

      const qy = drawY + mmToPt(totalTicketHmm - yMmFromTop - qrSizeMm);



      page.drawRectangle({

        x: qx - 1,

        y: qy - 1,

        width: qrSizePt + 2,

        height: qrSizePt + 2,

        color: hexToRgb(qrBg, rgb),

      });



      page.drawImage(qrImage, { x: qx, y: qy, width: qrSizePt, height: qrSizePt });

    }

  }



  page.drawRectangle({

    x: drawX,

    y: drawY,

    width: totalTicketWPt,

    height: designHPt,

    borderColor: rgb(0, 0, 0),

    borderWidth: borderPt,

  });

}



module.exports = {

  parseLayoutConfig,

  qrPositionFromTopOrigin,

  drawTicketOnPage,

  buildQrColorOptions,

  normalizeHexColor,

};


