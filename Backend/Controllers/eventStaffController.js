const supabase = require('../utils/supabase');

/**
 * POST /api/auth/apply-event
 * Le staff postule à un événement
 * body: { event_id }
 */
const applyToEvent = async (req, res) => {
  try {
    const access_token = req.headers.authorization?.split('Bearer ')[1];
    const { event_id } = req.body;

    if (!access_token) return res.status(401).json({ success: false, error: 'Token requis' });
    if (!event_id) return res.status(400).json({ success: false, error: 'event_id requis' });

    const { data: authData, error: authError } = await supabase.auth.getUser(access_token);
    if (authError || !authData.user) return res.status(401).json({ success: false, error: 'Authentification invalide' });

    const db = supabase.createClientWithAuth(access_token);

    const { data: existingRows, error: existingError } = await db
      .from('event_staff')
      .select('id, status')
      .eq('event_id', event_id)
      .eq('profile_id', authData.user.id)
      .limit(1);

    if (existingError) return res.status(400).json({ success: false, error: existingError.message });

    if (existingRows?.length) {
      const existing = existingRows[0];
      const status = String(existing.status || '').toLowerCase();

      if (status === 'valide' || status === 'valid' || status === 'accepted') {
        return res.status(400).json({ success: false, error: 'Vous participez déjà à cet événement.' });
      }
      if (status === 'en_attente' || status === 'pending') {
        return res.status(400).json({ success: false, error: 'Votre candidature est déjà en attente de validation.' });
      }
      if (status === 'refuse' || status === 'rejected' || status.includes('refus')) {
        const { data: retried, error: retryError } = await db
          .from('event_staff')
          .update({ status: 'en_attente' })
          .eq('id', existing.id)
          .select()
          .single();
        if (retryError) return res.status(400).json({ success: false, error: retryError.message });
        return res.json({ success: true, application: retried, retried: true });
      }

      return res.status(400).json({ success: false, error: 'Candidature déjà existante pour cet événement.' });
    }

    const { data: applied, error: applyError } = await db
      .from('event_staff')
      .insert({ event_id, profile_id: authData.user.id, status: 'en_attente' })
      .select()
      .single();
    if (applyError) return res.status(400).json({ success: false, error: applyError.message });

    return res.status(201).json({ success: true, application: applied });
  } catch (error) {
    console.error('Erreur apply-event:', error);
    res.status(500).json({ success: false, error: 'Erreur lors de la candidature' });
  }
};

/**
 * POST /api/auth/event-staff/bulk-action
 * Body: { application_ids: number[], action: 'accept'|'reject'|'delete' }
 */
const bulkAction = async (req, res) => {
  try {
    const access_token = req.headers.authorization?.split('Bearer ')[1];
    const { application_ids, action } = req.body;

    if (!access_token) return res.status(401).json({ success: false, error: 'Token requis' });
    if (!Array.isArray(application_ids) || application_ids.length === 0) {
      return res.status(400).json({ success: false, error: 'application_ids requis (tableau non vide)' });
    }
    if (!['accept', 'reject', 'delete'].includes(action)) {
      return res.status(400).json({ success: false, error: 'Action invalide' });
    }

    const { data: authData, error: authError } = await supabase.auth.getUser(access_token);
    if (authError || !authData.user) return res.status(401).json({ success: false, error: 'Authentification invalide' });

    const db = supabase.createClientWithAuth(access_token);
    const dbAdmin = supabase.admin || supabase;
    const ids = application_ids.map(Number).filter((id) => Number.isFinite(id));

    const { data: applications, error: appsError } = await dbAdmin
      .from('event_staff')
      .select('id, event_id')
      .in('id', ids);

    if (appsError) return res.status(400).json({ success: false, error: appsError.message });
    if (!applications?.length) return res.status(404).json({ success: false, error: 'Aucune candidature trouvée' });

    const eventIds = [...new Set(applications.map((a) => a.event_id))];
    for (const eventId of eventIds) {
      const { data: eventRows, error: eventError } = await db.from('events').select('organization_id').eq('id', eventId).limit(1);
      if (eventError || !eventRows?.length) {
        return res.status(404).json({ success: false, error: 'Événement introuvable' });
      }
      const { data: memberRows } = await dbAdmin
        .from('organization_members')
        .select('role')
        .eq('organization_id', eventRows[0].organization_id)
        .eq('profile_id', authData.user.id)
        .limit(1);
      if (!memberRows?.length || memberRows[0].role !== 'admin') {
        return res.status(403).json({ success: false, error: 'Accès refusé' });
      }
    }

    const applicationIds = applications.map((a) => a.id);

    if (action === 'delete') {
      const { error: deleteError } = await dbAdmin.from('event_staff').delete().in('id', applicationIds);
      if (deleteError) return res.status(400).json({ success: false, error: deleteError.message });
      return res.json({
        success: true,
        message: `${applicationIds.length} candidature(s) supprimée(s) avec succès.`,
        processed_count: applicationIds.length,
      });
    }

    const newStatus = action === 'accept' ? 'valide' : 'refuse';
    const { error: updateError } = await dbAdmin
      .from('event_staff')
      .update({ status: newStatus })
      .in('id', applicationIds);
    if (updateError) return res.status(400).json({ success: false, error: updateError.message });

    return res.json({
      success: true,
      message: `${applicationIds.length} candidature(s) ${action === 'accept' ? 'validée(s)' : 'refusée(s)'} avec succès.`,
      processed_count: applicationIds.length,
    });
  } catch (error) {
    console.error('Erreur POST event-staff/bulk-action:', error);
    res.status(500).json({ success: false, error: 'Erreur lors de l\'action groupée sur les candidatures' });
  }
};

/**
 * POST /api/auth/event-staff/:id/validate
 * Valide ou rejette une candidature (admin de l'organisation de l'événement)
 * body: { action: 'accept'|'reject' }
 */
const validateStaff = async (req, res) => {
  try {
    const access_token = req.headers.authorization?.split('Bearer ')[1];
    const { id } = req.params;
    const { action } = req.body;

    if (!access_token) return res.status(401).json({ success: false, error: 'Token requis' });
    if (!['accept', 'reject'].includes(action)) return res.status(400).json({ success: false, error: 'Action invalide' });

    const { data: authData, error: authError } = await supabase.auth.getUser(access_token);
    if (authError || !authData.user) return res.status(401).json({ success: false, error: 'Authentification invalide' });

    const db = supabase.createClientWithAuth(access_token);

    // Récupérer la candidature
    const { data: applicationRows, error: appError } = await db.from('event_staff').select('*').eq('id', id).limit(1);
    if (appError) return res.status(400).json({ success: false, error: appError.message });
    if (!applicationRows || applicationRows.length === 0) return res.status(404).json({ success: false, error: 'Candidature introuvable' });

    const application = applicationRows[0];

    // Récupérer l'événement pour connaître l'organisation
    const { data: eventRows, error: eventError } = await db.from('events').select('*').eq('id', application.event_id).limit(1);
    if (eventError) return res.status(400).json({ success: false, error: eventError.message });
    if (!eventRows || eventRows.length === 0) return res.status(404).json({ success: false, error: 'Événement introuvable' });

    const event = eventRows[0];

    // Vérifier que l'utilisateur est admin de l'organisation
    const dbAdmin = supabase.admin || supabase;
    const { data: memberRows, error: memberErr } = await dbAdmin.from('organization_members').select('*').eq('organization_id', event.organization_id).eq('profile_id', authData.user.id).limit(1);
    console.debug('GET /event-staff - membership rows:', (memberRows || []).length, 'error:', memberErr);
    if (memberErr) {
      console.error('Error checking membership in /event-staff:', memberErr);
      return res.status(500).json({ success: false, error: 'Erreur lors de la vérification des droits' });
    }
    if (!memberRows || memberRows.length === 0 || memberRows[0].role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Accès refusé' });
    }

    const newStatus = action === 'accept' ? 'valide' : 'refuse';
    const { data: updated, error: updateError } = await db.from('event_staff').update({ status: newStatus }).eq('id', id).select().single();
    if (updateError) return res.status(400).json({ success: false, error: updateError.message });

    return res.json({ success: true, application: updated });
  } catch (error) {
    console.error('Erreur validate-application:', error);
    res.status(500).json({ success: false, error: 'Erreur lors de la validation de la candidature' });
  }
};

/**
 * DELETE /api/auth/event-staff/:id
 * Supprime une candidature (admin requis)
 */
const deleteStaff = async (req, res) => {
  try {
    const access_token = req.headers.authorization?.split('Bearer ')[1];
    const id = Number(req.params.id);

    if (!access_token) return res.status(401).json({ success: false, error: 'Token requis' });

    const { data: authData, error: authError } = await supabase.auth.getUser(access_token);
    if (authError || !authData.user) return res.status(401).json({ success: false, error: 'Authentification invalide' });

    // fetch application to get event_id
    const { data: rows, error: fetchErr } = await supabase.from('event_staff').select('*').eq('id', id).limit(1);
    if (fetchErr) return res.status(400).json({ success: false, error: fetchErr.message });
    if (!rows || rows.length === 0) return res.status(404).json({ success: false, error: 'Candidature introuvable' });

    const application = rows[0];

    // verify admin on the event's organization
    const { data: eventRows, error: eventError } = await supabase.from('events').select('*').eq('id', application.event_id).limit(1);
    if (eventError) return res.status(400).json({ success: false, error: eventError.message });
    if (!eventRows || eventRows.length === 0) return res.status(404).json({ success: false, error: 'Événement introuvable' });

    const event = eventRows[0];

    const { data: memberRows } = await supabase.from('organization_members').select('*').eq('organization_id', event.organization_id).eq('profile_id', authData.user.id).limit(1);
    if (!memberRows || memberRows.length === 0 || memberRows[0].role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Accès refusé: administrateur requis' });
    }

    const { error: deleteError } = await supabase.from('event_staff').delete().eq('id', id);
    if (deleteError) return res.status(400).json({ success: false, error: deleteError.message });

    return res.json({ success: true });
  } catch (error) {
    console.error('Erreur delete event_staff:', error);
    return res.status(500).json({ success: false, error: 'Erreur lors de la suppression de la candidature' });
  }
};

/**
 * POST /api/auth/event-staff/my/:id/retry
 * Permet à un utilisateur de relancer sa candidature refusée (status → en_attente)
 */
const retryApplication = async (req, res) => {
  try {
    const access_token = req.headers.authorization?.split('Bearer ')[1];
    const id = Number(req.params.id);

    if (!access_token) return res.status(401).json({ success: false, error: 'Token requis' });
    if (!Number.isFinite(id)) return res.status(400).json({ success: false, error: 'Identifiant invalide' });

    const { data: authData, error: authError } = await supabase.auth.getUser(access_token);
    if (authError || !authData.user) return res.status(401).json({ success: false, error: 'Authentification invalide' });

    const db = supabase.createClientWithAuth(access_token);

    const { data: rows, error: fetchErr } = await db.from('event_staff').select('*').eq('id', id).limit(1);
    if (fetchErr) return res.status(400).json({ success: false, error: fetchErr.message });
    if (!rows?.length) return res.status(404).json({ success: false, error: 'Candidature introuvable' });

    const application = rows[0];

    if (application.profile_id !== authData.user.id) {
      return res.status(403).json({ success: false, error: 'Accès refusé' });
    }

    const status = String(application.status || '').toLowerCase();
    if (!(status === 'refuse' || status === 'rejected' || status.includes('refus'))) {
      return res.status(400).json({ success: false, error: 'Seules les candidatures refusées peuvent être relancées.' });
    }

    const { data: updated, error: updateError } = await db
      .from('event_staff')
      .update({ status: 'en_attente' })
      .eq('id', id)
      .select()
      .single();

    if (updateError) return res.status(400).json({ success: false, error: updateError.message });

    return res.json({
      success: true,
      application: updated,
      message: 'Candidature renvoyée pour validation.',
    });
  } catch (error) {
    console.error('Erreur POST event-staff/my retry:', error);
    return res.status(500).json({ success: false, error: 'Erreur lors de la relance de la candidature' });
  }
};

/**
 * DELETE /api/auth/event-staff/my/:id
 * Permet à un utilisateur de retirer sa propre candidature (seulement si profile_id === auth user)
 */
const deleteMyApplication = async (req, res) => {
  try {
    const access_token = req.headers.authorization?.split('Bearer ')[1];
    const id = Number(req.params.id);

    if (!access_token) return res.status(401).json({ success: false, error: 'Token requis' });

    const { data: authData, error: authError } = await supabase.auth.getUser(access_token);
    if (authError || !authData.user) return res.status(401).json({ success: false, error: 'Authentification invalide' });

    const db = supabase.createClientWithAuth(access_token);

    const { data: rows, error: fetchErr } = await db.from('event_staff').select('*').eq('id', id).limit(1);
    if (fetchErr) return res.status(400).json({ success: false, error: fetchErr.message });
    if (!rows || rows.length === 0) return res.status(404).json({ success: false, error: 'Candidature introuvable' });

    const application = rows[0];

    if (application.profile_id !== authData.user.id) {
      return res.status(403).json({ success: false, error: 'Accès refusé' });
    }

    const { error: deleteError } = await db.from('event_staff').delete().eq('id', id);
    if (deleteError) return res.status(400).json({ success: false, error: deleteError.message });

    return res.json({ success: true });
  } catch (error) {
    console.error('Erreur delete my event_staff:', error);
    return res.status(500).json({ success: false, error: 'Erreur lors de la suppression de la candidature' });
  }
};

/**
 * GET /api/auth/event-staff
 * Liste les candidatures pour un événement (filtre event_id) avec infos profil et compétences
 * Query: ?event_id=UUID
 */
const listStaff = async (req, res) => {
  try {
    const access_token = req.headers.authorization?.split('Bearer ')[1];
    const event_id = req.query.event_id || req.query.id;

    if (!access_token) return res.status(401).json({ success: false, error: 'Token requis' });
    if (!event_id) return res.status(400).json({ success: false, error: 'event_id requis' });

    console.debug('GET /event-staff - event_id received:', event_id);

    const { data: authData, error: authError } = await supabase.auth.getUser(access_token);
    if (authError || !authData.user) return res.status(401).json({ success: false, error: 'Authentification invalide' });

    // Use client with auth to respect RLS and to ensure the event is accessible to the requesting user
    const db = supabase.createClientWithAuth ? supabase.createClientWithAuth(access_token) : supabase;
    const dbAdmin = supabase.admin || supabase;

    const { data: eventRows, error: eventError } = await db.from('events').select('*').eq('id', event_id).limit(1);
    if (eventError) {
      console.error('Error selecting event in /event-staff:', eventError);
      return res.status(400).json({ success: false, error: eventError.message });
    }
    console.debug('GET /event-staff - eventRows length:', (eventRows || []).length);
    if (!eventRows || eventRows.length === 0) return res.status(404).json({ success: false, error: 'Événement introuvable' });

    const event = eventRows[0];

    const status = (req.query.status || 'en_attente').toString();
    const allowedStatuses = ['en_attente', 'valide', 'refuse', 'all'];
    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({ success: false, error: 'Status invalide pour event-staff' });
    }

    const { data: memberRows } = await dbAdmin.from('organization_members').select('*').eq('organization_id', event.organization_id).eq('profile_id', authData.user.id).limit(1);
    if (!memberRows || memberRows.length === 0 || memberRows[0].role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Accès refusé' });
    }

    // Récupérer candidatures selon le statut demandé
    let appsQuery = dbAdmin
      .from('event_staff')
      .select('*, profiles:profiles(id, first_name, last_name, phone)')
      .eq('event_id', event_id);

    if (status !== 'all') {
      appsQuery = appsQuery.eq('status', status);
    }

    const { data: apps, error: appsError } = await appsQuery;
    if (appsError) return res.status(400).json({ success: false, error: appsError.message });

    // Enrichir chaque application avec skills names
    const enriched = await Promise.all((apps || []).map(async (app) => {
      // fetch skill ids via profile_skills
      const { data: ps, error: psError } = await dbAdmin.from('profile_skills').select('skill_id').eq('profile_id', app.profile_id);
      const skillIds = ps?.map(p => p.skill_id) || [];
      const { data: skillRows } = await dbAdmin.from('skills').select('*').in('id', skillIds);
      return { ...app, profile_skill_ids: skillIds, profile_skill_rows: skillRows };
    }));

    return res.json({ success: true, applications: enriched });
  } catch (error) {
    console.error('Erreur GET event-staff:', error);
    res.status(500).json({ success: false, error: 'Erreur lors de la récupération des candidatures' });
  }
};

/**
 * GET /api/auth/my-event-application
 * Query: ?event_id=UUID
 * Retourne la candidature de l'utilisateur connecté pour un événement donné
 */
const getMyEventApplication = async (req, res) => {
  try {
    const access_token = req.headers.authorization?.split('Bearer ')[1];
    const event_id = req.query.event_id;

    if (!access_token) return res.status(401).json({ success: false, error: 'Token requis' });
    if (!event_id) return res.status(400).json({ success: false, error: 'event_id requis' });

    const { data: authData, error: authError } = await supabase.auth.getUser(access_token);
    if (authError || !authData.user) return res.status(401).json({ success: false, error: 'Authentification invalide' });

    const db = supabase.createClientWithAuth(access_token);

    const { data: application, error: appError } = await db
      .from('event_staff')
      .select('*, posts(name)') // Select post name for display
      .eq('event_id', event_id)
      .eq('profile_id', authData.user.id)
      .limit(1)
      .maybeSingle(); // Use maybeSingle to get null if no record found

    if (appError) {
      console.error('Erreur GET my-event-application:', appError);
      return res.status(400).json({ success: false, error: appError.message });
    }

    return res.json({ success: true, application: application });
  } catch (error) {
    console.error('Erreur GET my-event-application:', error);
    res.status(500).json({ success: false, error: 'Erreur lors de la récupération de la candidature' });
  }
};

/**
 * GET /api/auth/my-applications
 * Retourne toutes les candidatures (event_staff) du profil authentifié
 */
const listMyApplications = async (req, res) => {
  try {
    const access_token = req.headers.authorization?.split('Bearer ')[1];

    if (!access_token) return res.status(401).json({ success: false, error: 'Token requis' });

    const { data: authData, error: authError } = await supabase.auth.getUser(access_token);
    if (authError || !authData.user) return res.status(401).json({ success: false, error: 'Authentification invalide' });

    // Use admin client to bypass RLS and return joined event info
    const dbAdmin = supabase.admin || supabase;

    const { data: apps, error: appsError } = await dbAdmin
      .from('event_staff')
      .select('*, events(id, title, location, start_date, end_date, organizations(name)), posts(id, name)')
      .eq('profile_id', authData.user.id)
      .order('created_at', { ascending: false });

    if (appsError) {
      console.error('Erreur GET my-applications:', appsError);
      return res.status(400).json({ success: false, error: appsError.message });
    }

    // Normalize event fields for frontend compatibility (frontend expects `name`, `rawStartDate`, `rawEndDate`)
    const normalized = (apps || []).map((a) => {
      if (a.events) {
        a.events.name = a.events.title || a.events.name || null;
        a.events.rawStartDate = a.events.start_date || null;
        a.events.rawEndDate = a.events.end_date || null;
      }
      return a;
    });

    // Debug: log statuses returned for the authenticated user
    try {
      console.log('my-applications - user:', authData.user.id, 'applications statuses:', normalized.map(x => ({ id: x.id, status: x.status })) );
    } catch (e) {
      console.warn('my-applications - logging failed', e);
    }

    return res.json({ success: true, applications: normalized });
  } catch (error) {
    console.error('Erreur GET my-applications:', error);
    return res.status(500).json({ success: false, error: 'Erreur lors de la récupération des candidatures' });
  }
};

module.exports = {
  applyToEvent,
  bulkAction,
  validateStaff,
  deleteStaff,
  retryApplication,
  deleteMyApplication,
  listStaff,
  getMyEventApplication,
  listMyApplications,
};
