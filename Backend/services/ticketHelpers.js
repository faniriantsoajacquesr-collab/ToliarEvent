function sanitizeTicketSearchInput(raw) {
  return String(raw).trim().replace(/^#/, '').replace(/[,().%\\]/g, '');
}

function filterTicketIdsBySearch(tickets, search) {
  const cleaned = sanitizeTicketSearchInput(search);
  if (!cleaned) return tickets.map((ticket) => ticket.id);

  const searchLower = cleaned.toLowerCase();
  const hexSearch = searchLower.replace(/-/g, '');

  return tickets
    .filter((ticket) => {
      const holderMatch = (ticket.holder_name || '').toLowerCase().includes(searchLower);
      const typeMatch = (ticket.ticket_type || '').toLowerCase().includes(searchLower);
      const idMatch = ticket.id.replace(/-/g, '').toLowerCase().includes(hexSearch);
      const numberMatch = /^\d+$/.test(cleaned) && ticket.number === parseInt(cleaned, 10);

      const sellerProfile = ticket.sold_by_profile;
      const sellerFirstName = (sellerProfile?.first_name || '').toLowerCase();
      const sellerLastName = (sellerProfile?.last_name || '').toLowerCase();
      const sellerFullName = `${sellerFirstName} ${sellerLastName}`.trim();
      const sellerMatch =
        sellerFirstName.includes(searchLower) ||
        sellerLastName.includes(searchLower) ||
        sellerFullName.includes(searchLower);

      return holderMatch || typeMatch || idMatch || numberMatch || sellerMatch;
    })
    .map((ticket) => ticket.id);
}

async function resolveTicketSearchIds(db, eventId, ticketType, search) {
  let lookupQuery = db
    .from('tickets')
    .select(`
      id,
      holder_name,
      ticket_type,
      number,
      sold_by_profile:profiles!tickets_sold_by_fkey(first_name, last_name)
    `)
    .eq('event_id', eventId);

  if (ticketType && ticketType !== 'all') {
    lookupQuery = lookupQuery.eq('ticket_type', ticketType);
  }

  const { data: searchableTickets, error } = await lookupQuery;
  if (error) throw error;

  return filterTicketIdsBySearch(searchableTickets || [], search);
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const SCANNED_STATUSES = new Set(['utilisé', 'utilise', 'used']);

const VALID_STATUSES = new Set(['valid', 'valide']);

const SOLD_STATUSES = new Set(['vendu']);

function isTicketValidStatus(status) {
  return VALID_STATUSES.has(String(status || '').toLowerCase());
}

function ticketValidResetPayload(now = new Date().toISOString()) {
  return {
    status: 'valid',
    sold_by: null,
    scanned_by: null,
    updated_at: now,
  };
}

async function resolveTicketByScanInput(dbAdmin, rawTicketId, eventId) {
  const cleaned = sanitizeTicketSearchInput(rawTicketId);
  if (!cleaned) return { ticket: null };

  if (UUID_REGEX.test(cleaned)) {
    let query = dbAdmin.from('tickets').select('*').eq('id', cleaned);
    if (eventId) query = query.eq('event_id', eventId);
    const { data, error } = await query.maybeSingle();
    if (error) throw error;
    return { ticket: data || null };
  }

  if (!eventId) {
    return { ticket: null, needsEventId: true };
  }

  const { data: tickets, error } = await dbAdmin
    .from('tickets')
    .select('*')
    .eq('event_id', eventId);
  if (error) throw error;

  const hexSearch = cleaned.replace(/-/g, '').toLowerCase();
  const matches = (tickets || []).filter((ticket) =>
    ticket.id.replace(/-/g, '').toLowerCase().startsWith(hexSearch)
  );

  if (matches.length === 1) return { ticket: matches[0] };
  if (matches.length > 1) return { ticket: null, ambiguous: true, count: matches.length };
  return { ticket: null };
}

async function canUserScanTicketsForEvent(dbAdmin, userId, eventId) {
  const { data: eventData, error: eventError } = await dbAdmin
    .from('events')
    .select('organization_id')
    .eq('id', eventId)
    .single();
  if (eventError || !eventData) return { allowed: false, reason: 'event_not_found' };

  const { data: memberRows } = await dbAdmin
    .from('organization_members')
    .select('role')
    .eq('organization_id', eventData.organization_id)
    .eq('profile_id', userId)
    .limit(1);

  if (memberRows?.length && memberRows[0].role === 'admin') {
    return { allowed: true, role: 'admin' };
  }

  const { data: staffRows } = await dbAdmin
    .from('event_staff')
    .select('status')
    .eq('event_id', eventId)
    .eq('profile_id', userId)
    .limit(1);

  const staffStatus = (staffRows?.[0]?.status || '').toLowerCase();
  if (
    staffRows?.length &&
    (staffStatus === 'valide' || staffStatus === 'validé' || staffStatus.includes('valid'))
  ) {
    return { allowed: true, role: 'staff' };
  }

  return { allowed: false, reason: 'forbidden' };
}

module.exports = {
  sanitizeTicketSearchInput,
  filterTicketIdsBySearch,
  resolveTicketSearchIds,
  UUID_REGEX,
  SCANNED_STATUSES,
  VALID_STATUSES,
  SOLD_STATUSES,
  isTicketValidStatus,
  ticketValidResetPayload,
  resolveTicketByScanInput,
  canUserScanTicketsForEvent,
};
