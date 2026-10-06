const supabase = require('../utils/supabase');

/**
 * GET /api/auth/ticket-types?event_id=UUID
 * Retourne les ticket-types pour un événement (l'utilisateur doit être membre de l'organisation)
 */
const listTypes = async (req, res) => {
  try {
    const access_token = req.headers.authorization?.split('Bearer ')[1];
    const event_id = req.query.event_id;
    if (!access_token) return res.status(401).json({ success: false, error: 'Token requis' });
    if (!event_id) return res.status(400).json({ success: false, error: 'event_id requis' });

    const { data: authData, error: authError } = await supabase.auth.getUser(access_token);
    if (authError || !authData.user) return res.status(401).json({ success: false, error: 'Authentification invalide' });

    const db = supabase.createClientWithAuth(access_token);

    const { data: eventRow, error: eventErr } = await db.from('events').select('organization_id').eq('id', event_id).single();
    if (eventErr || !eventRow) return res.status(404).json({ success: false, error: 'Événement introuvable' });

    const { data: memberRows } = await db.from('organization_members').select('id').eq('organization_id', eventRow.organization_id).eq('profile_id', authData.user.id).limit(1);
    if (!memberRows || memberRows.length === 0) return res.status(403).json({ success: false, error: 'Accès refusé: non membre de l\'organisation' });

    const { data: types, error: typesErr } = await db.from('ticket_type').select('*').eq('event_id', event_id).order('id', { ascending: true });
    if (typesErr) return res.status(400).json({ success: false, error: typesErr.message });
    return res.json({ success: true, ticket_types: types || [] });
  } catch (error) {
    console.error('Erreur GET ticket-type:', error);
    res.status(500).json({ success: false, error: 'Erreur interne' });
  }
};

/**
 * POST /api/auth/ticket-type
 * Body: { event_id: UUID, name: string, price?: number, currency?: string, benefits?: string[] }
 * Crée un nouveau ticket-type pour l'événement (admin requis)
 */
const createType = async (req, res) => {
  try {
    const access_token = req.headers.authorization?.split('Bearer ')[1];
    const { event_id, name, price, currency, benefits } = req.body;
    if (!access_token) return res.status(401).json({ success: false, error: 'Token requis' });
    if (!event_id || !name || !String(name).trim()) {
      return res.status(400).json({ success: false, error: 'event_id et name requis' });
    }

    const { data: authData, error: authError } = await supabase.auth.getUser(access_token);
    if (authError || !authData.user) return res.status(401).json({ success: false, error: 'Authentification invalide' });

    const db = supabase.createClientWithAuth(access_token);

    const { data: eventRow, error: eventErr } = await db.from('events').select('organization_id').eq('id', event_id).single();
    if (eventErr || !eventRow) return res.status(404).json({ success: false, error: 'Événement introuvable' });

    const { data: memberRows } = await db.from('organization_members').select('role').eq('organization_id', eventRow.organization_id).eq('profile_id', authData.user.id).limit(1);
    if (!memberRows || memberRows.length === 0 || memberRows[0].role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Accès refusé: administrateur requis' });
    }

    const normalizedBenefits = Array.isArray(benefits)
      ? benefits.filter((item) => typeof item === 'string' && item.trim()).map((item) => item.trim())
      : [];

    const insertPayload = {
      event_id,
      name: String(name).trim(),
      price: price != null && !Number.isNaN(Number(price)) ? Number(price) : 0,
      currency: currency || 'Ar',
      benefits: normalizedBenefits,
      created_at: new Date().toISOString(),
    };
    const { data: inserted, error: insertErr } = await db.from('ticket_type').insert(insertPayload).select().single();
    if (insertErr) return res.status(400).json({ success: false, error: insertErr.message });
    return res.json({ success: true, ticket_type: inserted });
  } catch (error) {
    console.error('Erreur POST ticket-type:', error);
    res.status(500).json({ success: false, error: 'Erreur interne' });
  }
};

/**
 * PUT /api/auth/ticket-type/:id
 * Body: { name?: string, price?: number, currency?: string, benefits?: string[] }
 * Met à jour un ticket-type (admin requis)
 */
const updateType = async (req, res) => {
  try {
    const access_token = req.headers.authorization?.split('Bearer ')[1];
    const { id } = req.params;
    const { name, price, currency, benefits } = req.body;
    if (!access_token) return res.status(401).json({ success: false, error: 'Token requis' });
    if (!id) return res.status(400).json({ success: false, error: 'id requis' });

    const { data: authData, error: authError } = await supabase.auth.getUser(access_token);
    if (authError || !authData.user) return res.status(401).json({ success: false, error: 'Authentification invalide' });

    const db = supabase.createClientWithAuth(access_token);

    const { data: existing, error: existingErr } = await db.from('ticket_type').select('id, event_id').eq('id', id).single();
    if (existingErr || !existing) return res.status(404).json({ success: false, error: 'Type de billet introuvable' });

    const { data: eventRow, error: eventErr } = await db.from('events').select('organization_id').eq('id', existing.event_id).single();
    if (eventErr || !eventRow) return res.status(404).json({ success: false, error: 'Événement introuvable' });

    const { data: memberRows } = await db.from('organization_members').select('role').eq('organization_id', eventRow.organization_id).eq('profile_id', authData.user.id).limit(1);
    if (!memberRows || memberRows.length === 0 || memberRows[0].role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Accès refusé: administrateur requis' });
    }

    const updatePayload = {};
    if (name != null && String(name).trim()) updatePayload.name = String(name).trim();
    if (price != null && !Number.isNaN(Number(price))) updatePayload.price = Number(price);
    if (currency != null) updatePayload.currency = currency;
    if (benefits != null) {
      updatePayload.benefits = Array.isArray(benefits)
        ? benefits.filter((item) => typeof item === 'string' && item.trim()).map((item) => item.trim())
        : [];
    }

    const { data: updated, error: updateErr } = await db.from('ticket_type').update(updatePayload).eq('id', id).select().single();
    if (updateErr) return res.status(400).json({ success: false, error: updateErr.message });
    return res.json({ success: true, ticket_type: updated });
  } catch (error) {
    console.error('Erreur PUT ticket-type:', error);
    res.status(500).json({ success: false, error: 'Erreur interne' });
  }
};

/**
 * DELETE /api/auth/ticket-type/:id
 * Supprime un ticket-type (admin requis)
 */
const deleteType = async (req, res) => {
  try {
    const access_token = req.headers.authorization?.split('Bearer ')[1];
    const { id } = req.params;
    if (!access_token) return res.status(401).json({ success: false, error: 'Token requis' });
    if (!id) return res.status(400).json({ success: false, error: 'id requis' });

    const { data: authData, error: authError } = await supabase.auth.getUser(access_token);
    if (authError || !authData.user) return res.status(401).json({ success: false, error: 'Authentification invalide' });

    const db = supabase.createClientWithAuth(access_token);

    const { data: existing, error: existingErr } = await db.from('ticket_type').select('id, event_id').eq('id', id).single();
    if (existingErr || !existing) return res.status(404).json({ success: false, error: 'Type de billet introuvable' });

    const { data: eventRow, error: eventErr } = await db.from('events').select('organization_id').eq('id', existing.event_id).single();
    if (eventErr || !eventRow) return res.status(404).json({ success: false, error: 'Événement introuvable' });

    const { data: memberRows } = await db.from('organization_members').select('role').eq('organization_id', eventRow.organization_id).eq('profile_id', authData.user.id).limit(1);
    if (!memberRows || memberRows.length === 0 || memberRows[0].role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Accès refusé: administrateur requis' });
    }

    const { error: deleteErr } = await db.from('ticket_type').delete().eq('id', id);
    if (deleteErr) return res.status(400).json({ success: false, error: deleteErr.message });
    return res.json({ success: true });
  } catch (error) {
    console.error('Erreur DELETE ticket-type:', error);
    res.status(500).json({ success: false, error: 'Erreur interne' });
  }
};

/**
 * PUT /api/auth/events/:id/ticket-types-active
 * Met à jour l'état is_active des types de billets selon les billets visibles
 * Body: { activeTicketNames: string[] }
 */
const setActiveTypes = async (req, res) => {
  try {
    const access_token = req.headers.authorization?.split('Bearer ')[1];
    const { id } = req.params;
    const { activeTicketNames } = req.body || {};

    if (!access_token) return res.status(401).json({ success: false, error: 'Token requis' });
    if (!id) return res.status(400).json({ success: false, error: 'event_id requis' });
    if (!Array.isArray(activeTicketNames)) {
      return res.status(400).json({ success: false, error: 'activeTicketNames doit être un tableau' });
    }

    const { data: authData, error: authError } = await supabase.auth.getUser(access_token);
    if (authError || !authData.user) return res.status(401).json({ success: false, error: 'Authentification invalide' });

    const db = supabase.createClientWithAuth(access_token);
    const { data: eventRows, error: eventError } = await db.from('events').select('*').eq('id', id).limit(1);
    if (eventError) return res.status(400).json({ success: false, error: eventError.message });
    if (!eventRows || eventRows.length === 0) return res.status(404).json({ success: false, error: 'Événement introuvable' });
    const event = eventRows[0];

    const { data: memberRows } = await db.from('organization_members').select('*').eq('organization_id', event.organization_id).eq('profile_id', authData.user.id).limit(1);
    if (!memberRows || memberRows.length === 0 || memberRows[0].role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Accès refusé' });
    }

    // Récupérer tous les types de billets de l'événement
    const { data: ticketTypes, error: ticketTypesError } = await db.from('ticket_type').select('*').eq('event_id', id);
    if (ticketTypesError) {
      console.error('Erreur lecture ticket_type:', ticketTypesError);
      return res.status(400).json({ success: false, error: ticketTypesError.message });
    }

    // Mettre à jour chaque type de billet
    const updatePromises = (ticketTypes || []).map((ticketType) => {
      const isActive = activeTicketNames.includes(ticketType.name);
      return db.from('ticket_type').update({ is_active: isActive }).eq('id', ticketType.id);
    });

    const results = await Promise.all(updatePromises);
    const hasError = results.some((r) => r.error);
    if (hasError) {
      console.error('Erreur UPSERT ticket_type is_active');
      return res.status(500).json({ success: false, error: 'Erreur lors de la mise à jour des types de billets' });
    }

    return res.json({ success: true, message: 'Types de billets mis à jour' });
  } catch (error) {
    console.error('Erreur PUT ticket-types-active:', error);
    return res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
};

module.exports = {
  listTypes,
  createType,
  updateType,
  deleteType,
  setActiveTypes,
};
