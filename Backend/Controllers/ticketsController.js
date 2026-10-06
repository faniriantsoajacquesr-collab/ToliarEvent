const supabase = require('../utils/supabase');
const { sanitizeTicketSearchInput, resolveTicketSearchIds, SCANNED_STATUSES, VALID_STATUSES, SOLD_STATUSES, isTicketValidStatus, ticketValidResetPayload, resolveTicketByScanInput, canUserScanTicketsForEvent } = require('../services/ticketHelpers');

/**
 * POST /api/auth/generate-tickets-async
 * Body: { event_id, count, design_image_data|design_url, config, ticket_type }
 * Creates a generation job that will be processed asynchronously by a worker.
 * Returns: { success, job }
 */
const generateTicketsAsync = async (req, res) => {
  try {
    const access_token = req.headers.authorization?.split('Bearer ')[1];
    if (!access_token) return res.status(401).json({ success: false, error: 'Token requis' });

    const { event_id } = req.body;
    if (!event_id) return res.status(400).json({ success: false, error: 'event_id requis' });

    const { data: authData, error: authError } = await supabase.auth.getUser(access_token);
    if (authError || !authData.user) return res.status(401).json({ success: false, error: 'Authentification invalide' });

    const db = supabase.createClientWithAuth(access_token);

    // verify event and admin rights
    const { data: eventRows, error: eventError } = await db.from('events').select('*').eq('id', event_id).limit(1);
    if (eventError) return res.status(400).json({ success: false, error: eventError.message });
    if (!eventRows || eventRows.length === 0) return res.status(404).json({ success: false, error: 'Événement introuvable' });
    const event = eventRows[0];

    const { data: memberRows } = await db.from('organization_members').select('*').eq('organization_id', event.organization_id).eq('profile_id', authData.user.id).limit(1);
    if (!memberRows || memberRows.length === 0 || memberRows[0].role !== 'admin') return res.status(403).json({ success: false, error: 'Accès refusé: administrateur requis' });

    const admin = supabase.admin;
    if (!admin) return res.status(500).json({ success: false, error: 'Admin client non configuré' });

    const payload = req.body;
    const { data: jobData, error: jobErr } = await admin.from('ticket_jobs').insert({ event_id, payload, status: 'pending' }).select().single();
    if (jobErr) return res.status(400).json({ success: false, error: jobErr.message });

    return res.status(201).json({ success: true, job: jobData });
  } catch (error) {
    console.error('Erreur generate-tickets-async:', error);
    return res.status(500).json({ success: false, error: 'Erreur interne lors de la création du job' });
  }
};

/**
 * POST /api/auth/generate-tickets
 * Body: { event_id, count, design_image_data (data URL), config }
 * Returns: { success, pdf_base64, filename, tickets }
 */
const generateTickets = async (req, res) => {
  try {
    const access_token = req.headers.authorization?.split('Bearer ')[1];
    if (!access_token) return res.status(401).json({ success: false, error: 'Token requis' }); // cite: 1

    const { event_id, count = 1, design_image_data, design_url, config } = req.body;
    if (!event_id || (!design_image_data && !design_url)) return res.status(400).json({ success: false, error: 'event_id et design_image_data ou design_url sont requis' });

    const { data: authData, error: authError } = await supabase.auth.getUser(access_token);
    if (authError || !authData.user) return res.status(401).json({ success: false, error: 'Authentification invalide' });

    const db = supabase.createClientWithAuth(access_token);

    // verify event and admin
    const { data: eventRows, error: eventError } = await db.from('events').select('*').eq('id', event_id).limit(1);
    if (eventError) return res.status(400).json({ success: false, error: eventError.message });
    if (!eventRows || eventRows.length === 0) return res.status(404).json({ success: false, error: 'Événement introuvable' });
    const event = eventRows[0];

    const { data: memberRows } = await db.from('organization_members').select('*').eq('organization_id', event.organization_id).eq('profile_id', authData.user.id).limit(1);
    if (!memberRows || memberRows.length === 0 || memberRows[0].role !== 'admin') return res.status(403).json({ success: false, error: 'Accès refusé: administrateur requis' });

    const admin = supabase.admin;
    if (!admin) return res.status(500).json({ success: false, error: 'Admin client non configuré' });

    let catalogType;
    try {
      catalogType = await require('../services/resolveTicketType')(admin, req.body);
    } catch (error) {
      return res.status(400).json({ success: false, error: error.message });
    }

    const ticket_type = catalogType.name;

    // server-side libs (load safely and provide helpful error if missing)
    let QRCode;
    let PDFDocument;
    try {
      QRCode = require('qrcode');
    } catch (err) {
      console.error('Missing dependency: qrcode', err);
      return res.status(500).json({ success: false, error: "Module 'qrcode' not installed. Run 'npm install qrcode pdf-lib' in Backend and restart." });
    }
    try {
      ({ PDFDocument } = require('pdf-lib'));
    } catch (err) {
      console.error('Missing dependency: pdf-lib', err);
      return res.status(500).json({ success: false, error: "Module 'pdf-lib' not installed. Run 'npm install qrcode pdf-lib' in Backend and restart." });
    }
    const { randomUUID } = require('crypto');

    // Phase 1: determine starting number per ticket_type and prepare ticket rows
    // Find current max number for this event and ticket_type (use admin client)
    let startNumber = 1;
    try {
      const { data: maxRow, error: maxErr } = await admin
        .from('tickets')
        .select('number')
        .eq('event_id', event_id)
        .eq('ticket_type', ticket_type)
        .order('number', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!maxErr && maxRow && typeof maxRow.number === 'number') {
        startNumber = Number(maxRow.number) + 1;
      }
    } catch (e) {
      console.warn('Could not determine max ticket number, default to 1', e);
    }

    const ticketsToInsert = [];
    for (let i = 0; i < Number(count); i++) {
      const id = randomUUID();
      ticketsToInsert.push({ id, event_id, ticket_type, price: catalogType.price, number: startNumber + i, created_at: new Date().toISOString() });
    }

    // Phase 2: insert into DB (admin client)
    let insertedTickets = [];
    try {
      const { data: inserted, error: insertErr } = await admin.from('tickets').insert(ticketsToInsert).select();
      if (insertErr) {
        console.warn('Insert tickets warning:', insertErr.message || insertErr);
      } else {
        insertedTickets = inserted || [];
      }
    } catch (err) {
      console.error('Erreur insertion tickets:', err);
    }

    // Phase 3: generate QR codes (data URLs)
    const qrDataUrls = {};
    const { buildQrColorOptions } = require('../services/ticketPdfLayout');
    const qrColors = buildQrColorOptions(config || {});
    for (const t of ticketsToInsert) {
      const payload = `${process.env.FRONTEND_URL || 'https://app.local'}/ticket/${t.id}`;
      const dataUrl = await QRCode.toDataURL(payload, { margin: 0, color: qrColors });
      qrDataUrls[t.id] = dataUrl;
    }

    // Phase 4: generate PDF pages (one ticket per page, matching design geometry)
    const mmToPt = (mm) => mm * 2.83464567; // 1 mm = 2.8346 points
    const pdfDoc = await PDFDocument.create();

    // parse design image data url and normalize with sharp to PNG buffer
    const Sharp = (() => {
      try {
        return require('sharp');
      } catch (err) {
        console.error('Missing dependency: sharp', err);
        return null;
      }
    })();

    let designBinary;
    if (design_url && typeof design_url === 'string') {
      try {
        const resp = await fetch(design_url);
        if (!resp.ok) {
          console.error('Failed to fetch design_url:', resp.status, resp.statusText);
          return res.status(400).json({ success: false, error: 'Impossible de récupérer le design via design_url' });
        }
        const arrayBuffer = await resp.arrayBuffer();
        designBinary = Buffer.from(arrayBuffer);
      } catch (err) {
        console.error('Erreur fetching design_url:', err);
        return res.status(400).json({ success: false, error: 'Erreur lors de la récupération de design_url' });
      }
    } else if (typeof design_image_data === 'string' && design_image_data.startsWith('data:')) {
      const parts = design_image_data.split(',');
      designBinary = Buffer.from(parts[1], 'base64');
    } else {
      designBinary = Buffer.from(design_image_data, 'base64');
    }

    let pngBuffer = designBinary;
    if (Sharp) {
      try {
        pngBuffer = await Sharp(designBinary).png().toBuffer();
      } catch (err) {
        console.warn('sharp conversion failed, will fallback to raw buffer', err);
      }
    }

    let embeddedDesign;
    try {
      embeddedDesign = await pdfDoc.embedPng(pngBuffer);
    } catch (ePng) {
      try {
        embeddedDesign = await pdfDoc.embedJpg(designBinary);
      } catch (eJpg) {
        console.error('Failed to embed design image as PNG or JPG', ePng, eJpg);
        return res.status(400).json({ success: false, error: 'Impossible d\'intégrer l\'image du design (format non supporté ou corrompu).' });
      }
    }

    // Configuration de la page A4 (210 x 297 mm)
    const A4_WIDTH_MM = 210;
    const A4_HEIGHT_MM = 297;
    // On utilise 8.4mm comme marge, ce qui correspond aux 32px de padding sur l'aperçu de 400px (16px/côté)
    const PAGE_MARGIN_MM = 8.4;

    const support = config?.supportType || 'ticket';
    const cols = config?.layoutOption === '1_col' ? 1 : config?.layoutOption === '2_col' ? 2 : 3;
    const rowGap = config?.rowGap || 0;
    const colGap = config?.colGap || 0;

    const { parseLayoutConfig, drawTicketOnPage } = require('../services/ticketPdfLayout');
    const ticketLayout = parseLayoutConfig(config, support);
    const { totalTicketWmm, totalTicketHmm } = ticketLayout;

    let currentPage = null;
    let currentY = A4_HEIGHT_MM - PAGE_MARGIN_MM; // Curseur de position verticale (Haut vers Bas)

    // Use insertedTickets (which include DB-assigned data) when available, otherwise fallback to ticketsToInsert
    const renderTickets = (insertedTickets && insertedTickets.length > 0) ? insertedTickets : ticketsToInsert;

    for (let i = 0; i < renderTickets.length; i++) {
      const colIdx = i % cols;
      const t = renderTickets[i];

      // Gestion du début d'une nouvelle ligne
      if (colIdx === 0 && i !== 0) {
        currentY -= (totalTicketHmm + rowGap);
      }

      // Gestion du saut de page (si la ligne dépasse la marge basse)
      if (!currentPage || (currentY - totalTicketHmm) < PAGE_MARGIN_MM) {
        currentPage = pdfDoc.addPage([mmToPt(A4_WIDTH_MM), mmToPt(A4_HEIGHT_MM)]);
        currentY = A4_HEIGHT_MM - PAGE_MARGIN_MM;
      }

      const currentX = PAGE_MARGIN_MM + (colIdx * (totalTicketWmm + colGap));
      
      // Dans pdf-lib, l'origine (0,0) est en BAS-GAUCHE.
      const drawX = mmToPt(currentX);
      const drawY = mmToPt(currentY - totalTicketHmm);

      await drawTicketOnPage({
        page: currentPage,
        pdfDoc,
        embeddedDesign,
        qrDataUrl: qrDataUrls[t.id],
        ticket: t,
        config,
        drawX,
        drawY,
        mmToPt,
      });
    }

    const pdfBytes = await pdfDoc.save();
    const pdfBase64 = Buffer.from(pdfBytes).toString('base64');

    return res.json({ success: true, pdf_base64: pdfBase64, filename: `${event_id}_tickets_${Date.now()}.pdf`, tickets: ticketsToInsert });
  } catch (error) {
    console.error('Erreur generate-tickets:', error);
    return res.status(500).json({ success: false, error: 'Erreur interne lors de la génération des billets' });
  }
};

/**
 * GET /api/auth/tickets
 * Query: ?event_id=UUID
 * Retourne les tickets d'un événement
 */
const listTickets = async (req, res) => {
  try {
    const access_token = req.headers.authorization?.split('Bearer ')[1];
    const { event_id, search } = req.query; // Keep search parameter

    if (!access_token) return res.status(401).json({ success: false, error: 'Token requis' });
    if (!event_id) return res.status(400).json({ success: false, error: 'event_id requis' });

    const { data: authData, error: authError } = await supabase.auth.getUser(access_token);
    if (authError || !authData.user) return res.status(401).json({ success: false, error: 'Authentification invalide' });

    const db = supabase.createClientWithAuth(access_token);

    const { ticket_type } = req.query;

    if (search) {
      const cleaned = sanitizeTicketSearchInput(search);
      if (cleaned) {
        try {
          const matchingIds = await resolveTicketSearchIds(db, event_id, ticket_type, search);
          if (matchingIds.length === 0) {
            return res.json({ success: true, tickets: [] });
          }

          let query = db
            .from('tickets')
            .select(`
              *,
              sold_by_profile:profiles!tickets_sold_by_fkey(first_name, last_name),
              scanned_by_profile:profiles!tickets_scanned_by_fkey(first_name, last_name)
            `)
            .eq('event_id', event_id)
            .in('id', matchingIds);

          const { data: tickets, error: ticketsError } = await query.order('number', { ascending: false, nullsFirst: false });
          if (ticketsError) return res.status(400).json({ success: false, error: ticketsError.message });
          return res.json({ success: true, tickets });
        } catch (searchError) {
          console.error('Erreur recherche tickets:', searchError);
          return res.status(400).json({ success: false, error: searchError.message || 'Erreur lors de la recherche' });
        }
      }
    }

    let query = db
      .from('tickets')
      .select(`
        *,
        sold_by_profile:profiles!tickets_sold_by_fkey(first_name, last_name),
        scanned_by_profile:profiles!tickets_scanned_by_fkey(first_name, last_name)
      `)
      .eq('event_id', event_id);

    if (ticket_type && ticket_type !== 'all') {
      query = query.eq('ticket_type', ticket_type);
    }

    const { data: tickets, error: ticketsError } = await query.order('number', { ascending: false, nullsFirst: false });

    if (ticketsError) return res.status(400).json({ success: false, error: ticketsError.message });

    return res.json({ success: true, tickets });
  } catch (error) {
    console.error('Erreur GET tickets:', error);
    res.status(500).json({ success: false, error: 'Erreur lors de la récupération des billets' });
  }
};

/**
 * POST /api/auth/tickets/bulk-delete
 * Body: { ticket_ids: string[] }
 * Supprime plusieurs billets (admin requis)
 */
const bulkDelete = async (req, res) => {
  try {
    const access_token = req.headers.authorization?.split('Bearer ')[1];
    const { ticket_ids } = req.body;

    if (!access_token) return res.status(401).json({ success: false, error: 'Token requis' });
    if (!Array.isArray(ticket_ids) || ticket_ids.length === 0) {
      return res.status(400).json({ success: false, error: 'ticket_ids requis (tableau non vide)' });
    }

    const { data: authData, error: authError } = await supabase.auth.getUser(access_token);
    if (authError || !authData.user) return res.status(401).json({ success: false, error: 'Authentification invalide' });

    const db = supabase.createClientWithAuth(access_token);

    const { data: ticketsData, error: ticketsError } = await db
      .from('tickets')
      .select('id, event_id')
      .in('id', ticket_ids);

    if (ticketsError) return res.status(400).json({ success: false, error: ticketsError.message });
    if (!ticketsData || ticketsData.length === 0) {
      return res.status(404).json({ success: false, error: 'Aucun billet trouvé.' });
    }

    const eventIds = [...new Set(ticketsData.map((t) => t.event_id))];
    for (const eventId of eventIds) {
      const { data: eventData, error: eventError } = await db
        .from('events')
        .select('organization_id')
        .eq('id', eventId)
        .single();
      if (eventError || !eventData) {
        return res.status(404).json({ success: false, error: 'Événement lié aux billets introuvable.' });
      }

      const { data: memberRows } = await db
        .from('organization_members')
        .select('role')
        .eq('organization_id', eventData.organization_id)
        .eq('profile_id', authData.user.id)
        .limit(1);

      if (!memberRows || memberRows.length === 0 || memberRows[0].role !== 'admin') {
        return res.status(403).json({ success: false, error: 'Accès refusé: administrateur requis pour supprimer des billets.' });
      }
    }

    const idsToDelete = ticketsData.map((t) => t.id);
    const { error: deleteError } = await db.from('tickets').delete().in('id', idsToDelete);

    if (deleteError) return res.status(400).json({ success: false, error: deleteError.message });

    return res.json({
      success: true,
      message: `${idsToDelete.length} billet(s) supprimé(s) avec succès.`,
      deleted_count: idsToDelete.length,
    });
  } catch (error) {
    console.error('Erreur POST tickets/bulk-delete:', error);
    res.status(500).json({ success: false, error: 'Erreur lors de la suppression des billets.' });
  }
};

/**
 * POST /api/auth/tickets/restore-printed
 * Body: { event_id, tickets: [{ id, number, ticket_type, price?, status? }] }
 * Ré-enregistre des billets imprimés supprimés par erreur (admin requis).
 */
const restorePrinted = async (req, res) => {
  try {
    const access_token = req.headers.authorization?.split('Bearer ')[1];
    const { event_id, tickets } = req.body;

    if (!access_token) return res.status(401).json({ success: false, error: 'Token requis' });
    if (!event_id) return res.status(400).json({ success: false, error: 'event_id requis' });
    if (!Array.isArray(tickets) || tickets.length === 0) {
      return res.status(400).json({ success: false, error: 'tickets requis (tableau non vide)' });
    }

    const { data: authData, error: authError } = await supabase.auth.getUser(access_token);
    if (authError || !authData.user) {
      return res.status(401).json({ success: false, error: 'Authentification invalide' });
    }

    const db = supabase.createClientWithAuth(access_token);
    const admin = supabase.admin;
    if (!admin) return res.status(500).json({ success: false, error: 'Admin client non configuré' });

    const { data: eventData, error: eventError } = await db
      .from('events')
      .select('organization_id')
      .eq('id', event_id)
      .single();
    if (eventError || !eventData) {
      return res.status(404).json({ success: false, error: 'Événement introuvable.' });
    }

    const { data: memberRows } = await db
      .from('organization_members')
      .select('role')
      .eq('organization_id', eventData.organization_id)
      .eq('profile_id', authData.user.id)
      .limit(1);

    if (!memberRows || memberRows.length === 0 || memberRows[0].role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Accès refusé: administrateur requis.' });
    }

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const now = new Date().toISOString();
    const restored = [];
    const skipped = [];
    const errors = [];

    for (const ticket of tickets) {
      const id = String(ticket.id || '').trim();
      const ticketType = String(ticket.ticket_type || '').trim();
      const number = Number(ticket.number);
      const price = Number(ticket.price ?? 0);
      const status = String(ticket.status || 'valid');

      if (!uuidRegex.test(id)) {
        errors.push({ id, error: 'ID billet invalide' });
        continue;
      }
      if (!ticketType) {
        errors.push({ id, error: 'Type de billet requis' });
        continue;
      }
      if (!Number.isFinite(number) || number <= 0) {
        errors.push({ id, error: 'Numéro de billet invalide' });
        continue;
      }

      const { data: existing } = await admin.from('tickets').select('id').eq('id', id).maybeSingle();
      if (existing) {
        skipped.push({ id, reason: 'already_exists' });
        continue;
      }

      const insertPayload = {
        id,
        event_id,
        ticket_type: ticketType,
        number,
        price: Number.isFinite(price) ? price : 0,
        status,
        holder_name: ticket.holder_name || null,
        sold_by: null,
        scanned_by: null,
        created_at: now,
        updated_at: now,
      };

      const { data: inserted, error: insertError } = await admin
        .from('tickets')
        .insert(insertPayload)
        .select('id, number, ticket_type, status')
        .single();

      if (insertError) {
        errors.push({ id, error: insertError.message });
        continue;
      }

      restored.push(inserted);
    }

    return res.json({
      success: true,
      message: `${restored.length} billet(s) ré-enregistré(s).`,
      restored,
      restored_count: restored.length,
      skipped,
      skipped_count: skipped.length,
      errors,
    });
  } catch (error) {
    console.error('Erreur POST tickets/restore-printed:', error);
    res.status(500).json({ success: false, error: 'Erreur lors du ré-enregistrement des billets.' });
  }
};

/**
 * POST /api/auth/tickets/bulk-update-status
 * Body: { ticket_ids: string[], status: 'vendu' | 'valid' }
 */
const bulkUpdateStatus = async (req, res) => {
  try {
    const access_token = req.headers.authorization?.split('Bearer ')[1];
    const { ticket_ids, status } = req.body;

    if (!access_token) return res.status(401).json({ success: false, error: 'Token requis' });
    if (!Array.isArray(ticket_ids) || ticket_ids.length === 0) {
      return res.status(400).json({ success: false, error: 'ticket_ids requis (tableau non vide)' });
    }
    const normalizedStatus = status === 'valide' ? 'valid' : status;
    if (!['vendu', 'valid'].includes(normalizedStatus)) {
      return res.status(400).json({ success: false, error: 'status doit être vendu ou valid' });
    }

    const { data: authData, error: authError } = await supabase.auth.getUser(access_token);
    if (authError || !authData.user) return res.status(401).json({ success: false, error: 'Authentification invalide' });

    const db = supabase.createClientWithAuth(access_token);
    const admin = supabase.admin || supabase;

    const { data: ticketsData, error: ticketsError } = await db
      .from('tickets')
      .select('id, event_id, status')
      .in('id', ticket_ids);

    if (ticketsError) return res.status(400).json({ success: false, error: ticketsError.message });
    if (!ticketsData?.length) return res.status(404).json({ success: false, error: 'Aucun billet trouvé.' });

    const eventIds = [...new Set(ticketsData.map((t) => t.event_id))];
    for (const eventId of eventIds) {
      const { data: eventData, error: eventError } = await db
        .from('events')
        .select('organization_id')
        .eq('id', eventId)
        .single();
      if (eventError || !eventData) {
        return res.status(404).json({ success: false, error: 'Événement lié aux billets introuvable.' });
      }

      const { data: memberRows } = await db
        .from('organization_members')
        .select('role')
        .eq('organization_id', eventData.organization_id)
        .eq('profile_id', authData.user.id)
        .limit(1);

      if (!memberRows?.length || memberRows[0].role !== 'admin') {
        return res.status(403).json({ success: false, error: 'Accès refusé: administrateur requis.' });
      }
    }

    const blockedStatuses = ['utilisé', 'utilise', 'used'];
    const eligibleTickets = ticketsData.filter(
      (ticket) => !blockedStatuses.includes(String(ticket.status || '').toLowerCase())
    );
    const skippedCount = ticketsData.length - eligibleTickets.length;

    if (eligibleTickets.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Aucun billet éligible (les billets déjà scannés ne peuvent pas être modifiés).',
      });
    }

    const now = new Date().toISOString();
    const updatePayload =
      normalizedStatus === 'vendu'
        ? { status: 'vendu', sold_by: authData.user.id, updated_at: now }
        : ticketValidResetPayload(now);

    const eligibleIds = eligibleTickets.map((t) => t.id);
    const { error: updateError } = await admin.from('tickets').update(updatePayload).in('id', eligibleIds);

    if (updateError) return res.status(400).json({ success: false, error: updateError.message });

    const actionLabel = normalizedStatus === 'vendu' ? 'marqué(s) comme vendu' : 'marqué(s) comme valid';
    return res.json({
      success: true,
      updated_count: eligibleIds.length,
      skipped_count: skippedCount,
      message: `${eligibleIds.length} billet(s) ${actionLabel}${skippedCount > 0 ? ` (${skippedCount} ignoré(s), déjà scanné(s))` : ''}.`,
    });
  } catch (error) {
    console.error('Erreur POST tickets/bulk-update-status:', error);
    res.status(500).json({ success: false, error: 'Erreur lors de la mise à jour des billets.' });
  }
};

/**
 * POST /api/auth/tickets/scan
 * Body: { ticket_id: string, event_id?: string, action: 'activate' | 'use' }
 * - activate : valid → vendu
 * - use      : vendu → utilise (refus si non activé)
 */
const scanTicket = async (req, res) => {
  try {
    const access_token = req.headers.authorization?.split('Bearer ')[1];
    const { ticket_id, event_id, action = 'use' } = req.body;

    if (!access_token) return res.status(401).json({ success: false, error: 'Token requis' });
    if (!ticket_id) return res.status(400).json({ success: false, error: 'ticket_id requis' });
    if (action !== 'activate' && action !== 'use') {
      return res.status(400).json({ success: false, error: "action invalide (attendu: 'activate' ou 'use')" });
    }

    const { data: authData, error: authError } = await supabase.auth.getUser(access_token);
    if (authError || !authData.user) {
      return res.status(401).json({ success: false, error: 'Authentification invalide' });
    }

    const dbAdmin = supabase.admin;
    if (!dbAdmin) {
      return res.status(500).json({ success: false, error: 'Configuration serveur incomplète' });
    }

    const resolved = await resolveTicketByScanInput(dbAdmin, ticket_id, event_id || null);
    if (resolved.needsEventId) {
      return res.status(400).json({
        success: false,
        error: 'ID de billet incomplet : sélectionnez un événement ou scannez le QR complet.',
      });
    }
    if (resolved.ambiguous) {
      return res.status(400).json({
        success: false,
        error: `Plusieurs billets correspondent (${resolved.count}). Utilisez le QR code complet.`,
      });
    }

    const ticket = resolved.ticket;
    if (!ticket) {
      return res.status(404).json({ success: false, error: 'Billet introuvable.' });
    }

    const access = await canUserScanTicketsForEvent(dbAdmin, authData.user.id, ticket.event_id);
    if (!access.allowed) {
      if (access.reason === 'event_not_found') {
        return res.status(404).json({ success: false, error: 'Événement du billet introuvable.' });
      }
      return res.status(403).json({
        success: false,
        error: 'Accès refusé : seuls les administrateurs ou le staff validé peuvent scanner des billets.',
      });
    }

    const statusNorm = String(ticket.status || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const now = new Date().toISOString();
    const holderLabel = ticket.holder_name || 'Participant';

    if (SCANNED_STATUSES.has(statusNorm)) {
      return res.status(409).json({
        success: false,
        error: 'Ce billet a déjà été utilisé à l\'entrée.',
        ticket: { id: ticket.id, status: ticket.status, scanned_by: ticket.scanned_by },
      });
    }

    let updatePayload;
    let successMessage;

    if (action === 'activate') {
      if (SOLD_STATUSES.has(statusNorm)) {
        return res.json({
          success: true,
          message: 'Ce billet est déjà activé (vendu).',
          ticket,
          already_done: true,
        });
      }
      if (!VALID_STATUSES.has(statusNorm)) {
        return res.status(400).json({
          success: false,
          error: `Ce billet ne peut pas être activé (statut actuel : ${ticket.status || 'inconnu'}).`,
        });
      }
      updatePayload = { status: 'vendu', sold_by: authData.user.id, updated_at: now };
      successMessage = `Billet activé et marqué comme vendu pour ${holderLabel}.`;
    } else {
      if (!SOLD_STATUSES.has(statusNorm)) {
        return res.status(409).json({
          success: false,
          error_code: 'NOT_ACTIVATED',
          error: "Ce billet n'est pas encore activé et n'a donc pas été payé.",
          ticket_status: ticket.status,
        });
      }
      updatePayload = { status: 'utilise', scanned_by: authData.user.id, updated_at: now };
      successMessage = `Billet validé à l'entrée pour ${holderLabel}.`;
    }

    const { data: updated, error: updateError } = await dbAdmin
      .from('tickets')
      .update(updatePayload)
      .eq('id', ticket.id)
      .select(`
        *,
        sold_by_profile:profiles!tickets_sold_by_fkey(first_name, last_name),
        scanned_by_profile:profiles!tickets_scanned_by_fkey(first_name, last_name)
      `)
      .single();

    if (updateError) {
      return res.status(400).json({ success: false, error: updateError.message });
    }

    return res.json({
      success: true,
      message: successMessage,
      ticket: updated,
    });
  } catch (error) {
    console.error('Erreur POST tickets/scan:', error);
    res.status(500).json({ success: false, error: 'Erreur lors de la validation du billet.' });
  }
};

/**
 * GET /api/auth/tickets/:id
 * Retourne les détails d'un billet spécifique
 */
const getTicket = async (req, res) => {
  try {
    const access_token = req.headers.authorization?.split('Bearer ')[1];
    const { id } = req.params;

    if (!access_token) return res.status(401).json({ success: false, error: 'Token requis' });

    const { data: authData, error: authError } = await supabase.auth.getUser(access_token);
    if (authError || !authData.user) return res.status(401).json({ success: false, error: 'Authentification invalide' });

    const db = supabase.createClientWithAuth(access_token);

    const { data: ticket, error: ticketError } = await db
      .from('tickets')
      .select('*, sold_by_profile:profiles!tickets_sold_by_fkey(first_name, last_name)')
      .eq('id', id)
      .single();

    if (ticketError) return res.status(404).json({ success: false, error: 'Billet introuvable' });

    return res.json({ success: true, ticket });
  } catch (error) {
    console.error('Erreur GET ticket details:', error);
    res.status(500).json({ success: false, error: 'Erreur lors de la récupération du billet' });
  }
};

/**
 * DELETE /api/auth/tickets/:id
 * Supprime un billet (admin requis)
 */
const deleteTicket = async (req, res) => {
  try {
    const access_token = req.headers.authorization?.split('Bearer ')[1];
    const { id } = req.params;

    if (!access_token) return res.status(401).json({ success: false, error: 'Token requis' });

    const { data: authData, error: authError } = await supabase.auth.getUser(access_token);
    if (authError || !authData.user) return res.status(401).json({ success: false, error: 'Authentification invalide' });

    const db = supabase.createClientWithAuth(access_token);

    // First, check if the ticket exists and if the user has permission (e.g., is admin of the event's organization)
    const { data: ticketData, error: ticketError } = await db.from('tickets').select('event_id').eq('id', id).single();
    if (ticketError || !ticketData) {
      return res.status(404).json({ success: false, error: 'Billet introuvable ou erreur de récupération.' });
    }

    const { data: eventData, error: eventError } = await db.from('events').select('organization_id').eq('id', ticketData.event_id).single();
    if (eventError || !eventData) {
      return res.status(404).json({ success: false, error: 'Événement lié au billet introuvable.' });
    }

    const { data: memberRows } = await db.from('organization_members').select('role').eq('organization_id', eventData.organization_id).eq('profile_id', authData.user.id).limit(1);
    if (!memberRows || memberRows.length === 0 || memberRows[0].role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Accès refusé: administrateur requis pour supprimer des billets.' });
    }

    const { error: deleteError } = await db.from('tickets').delete().eq('id', id);

    if (deleteError) {
      return res.status(400).json({ success: false, error: deleteError.message });
    }

    return res.json({ success: true, message: 'Billet supprimé avec succès.' });
  } catch (error) {
    console.error('Erreur DELETE ticket:', error);
    res.status(500).json({ success: false, error: 'Erreur lors de la suppression du billet.' });
  }
};

/**
 * PUT /api/auth/tickets/:id
 * Met à jour un billet (admin requis)
 */
const updateTicket = async (req, res) => {
  try {
    const access_token = req.headers.authorization?.split('Bearer ')[1];
    const { id } = req.params;
    const { holder_name, ticket_type, price, status } = req.body;

    if (!access_token) return res.status(401).json({ success: false, error: 'Token requis' });

    const { data: authData, error: authError } = await supabase.auth.getUser(access_token);
    if (authError || !authData.user) return res.status(401).json({ success: false, error: 'Authentification invalide' });

    const db = supabase.createClientWithAuth(access_token);

    // Check permissions (similar to DELETE)
    const { data: ticketData, error: ticketError } = await db.from('tickets').select('event_id').eq('id', id).single();
    if (ticketError || !ticketData) return res.status(404).json({ success: false, error: 'Billet introuvable.' });
    const { data: eventData } = await db.from('events').select('organization_id').eq('id', ticketData.event_id).single();
    const { data: memberRows } = await db.from('organization_members').select('role').eq('organization_id', eventData.organization_id).eq('profile_id', authData.user.id).limit(1);
    if (!memberRows || memberRows.length === 0 || memberRows[0].role !== 'admin') return res.status(403).json({ success: false, error: 'Accès refusé: administrateur requis pour modifier des billets.' });

    const now = new Date().toISOString();
    const normalizedStatus = isTicketValidStatus(status) ? 'valid' : status;
    const updateData = {
      holder_name,
      ticket_type,
      price,
      status: normalizedStatus,
      updated_at: now,
    };
    if (isTicketValidStatus(status)) {
      updateData.sold_by = null;
      updateData.scanned_by = null;
    }

    const admin = supabase.admin || supabase;
    const { data: updatedTicket, error: updateError } = await admin.from('tickets').update(updateData).eq('id', id).select().single();

    if (updateError) return res.status(400).json({ success: false, error: updateError.message });
    return res.json({ success: true, ticket: updatedTicket });
  } catch (error) {
    console.error('Erreur PUT ticket:', error);
    res.status(500).json({ success: false, error: 'Erreur lors de la mise à jour du billet.' });
  }
};

module.exports = {
  generateTicketsAsync,
  generateTickets,
  listTickets,
  bulkDelete,
  restorePrinted,
  bulkUpdateStatus,
  scanTicket,
  getTicket,
  deleteTicket,
  updateTicket,
};
