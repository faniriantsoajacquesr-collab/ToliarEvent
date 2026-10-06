const supabase = require('../utils/supabase');

/**
 * DELETE /api/auth/events/:id
 * Supprime un événement (admin requis)
 */
const deleteEvent = async (req, res) => {
  try {
    const access_token = req.headers.authorization?.split('Bearer ')[1];
    const { id } = req.params;

    if (!access_token) return res.status(401).json({ success: false, error: 'Token requis' });

    const { data: authData, error: authError } = await supabase.auth.getUser(access_token);
    if (authError || !authData.user) return res.status(401).json({ success: false, error: 'Authentification invalide' });

    const db = supabase.createClientWithAuth(access_token);

    // fetch event to check organization
    const { data: eventRows, error: eventError } = await db.from('events').select('*').eq('id', id).limit(1);
    if (eventError) return res.status(400).json({ success: false, error: eventError.message });
    if (!eventRows || eventRows.length === 0) return res.status(404).json({ success: false, error: 'Événement introuvable' });
    const event = eventRows[0];

    // ensure user is admin of the organization
    const { data: memberRows } = await db.from('organization_members').select('*').eq('organization_id', event.organization_id).eq('profile_id', authData.user.id).limit(1);
    if (!memberRows || memberRows.length === 0 || memberRows[0].role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Accès refusé: administrateur requis' });
    }

    // delete dependent posts first, then event
    const { error: postsDelErr } = await db.from('posts').delete().eq('event_id', id);
    if (postsDelErr) return res.status(400).json({ success: false, error: postsDelErr.message });

    const { error: eventDelErr } = await db.from('events').delete().eq('id', id);
    if (eventDelErr) return res.status(400).json({ success: false, error: eventDelErr.message });

    return res.json({ success: true, message: 'Événement supprimé' });
  } catch (error) {
    console.error('Erreur DELETE event:', error);
    return res.status(500).json({ success: false, error: 'Erreur lors de la suppression de l\'événement' });
  }
};

/**
 * GET /api/auth/events
 * Query: ?organization_id=UUID
 * Retourne les événements d'une organisation (membre requis)
 */
const listEvents = async (req, res) => {
  try {
    const access_token = req.headers.authorization?.split('Bearer ')[1];
    const organization_id = req.query.organization_id;

    if (!access_token) return res.status(401).json({ success: false, error: 'Token requis' });
    if (!organization_id) return res.status(400).json({ success: false, error: 'organization_id requis' });

    const { data: authData, error: authError } = await supabase.auth.getUser(access_token);
    if (authError || !authData.user) return res.status(401).json({ success: false, error: 'Authentification invalide' });

    const db = supabase.createClientWithAuth(access_token);

    const { data: memberRows, error: memberError } = await db
      .from('organization_members')
      .select('*')
      .eq('organization_id', organization_id)
      .eq('profile_id', authData.user.id)
      .limit(1);

    if (memberError) return res.status(400).json({ success: false, error: memberError.message });
    if (!memberRows || memberRows.length === 0) {
      return res.status(403).json({ success: false, error: 'Accès refusé' });
    }

    const { data: events, error: eventsError } = await db
      .from('events')
      .select('*, posts(*), organizations(code), event_categories(name)')
      .eq('organization_id', organization_id)
      .order('start_date', { ascending: true });

    if (eventsError) return res.status(400).json({ success: false, error: eventsError.message });

    return res.json({ success: true, events: events || [] });
  } catch (error) {
    console.error('Erreur GET events:', error);
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
};

/**
 * GET /api/auth/event-categories
 * Retourne les catégories d'événements
 */
const listCategories = async (req, res) => {
  try {
    const access_token = req.headers.authorization?.split('Bearer ')[1];
    if (!access_token) return res.status(401).json({ success: false, error: 'Token requis' });

    const { data: authData, error: authError } = await supabase.auth.getUser(access_token);
    if (authError || !authData.user) return res.status(401).json({ success: false, error: 'Authentification invalide' });

    const db = supabase.createClientWithAuth(access_token);
    const { data: categories, error: categoriesError } = await db.from('event_categories').select('id,name').order('name', { ascending: true });
    if (categoriesError) return res.status(400).json({ success: false, error: categoriesError.message });

    return res.json({ success: true, categories: categories || [] });
  } catch (error) {
    console.error('Erreur GET event-categories:', error);
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
};

/**
 * GET /api/auth/events/:id
 * Retourne un événement par son id (admin requis)
 */
const getEvent = async (req, res) => {
  try {
    const access_token = req.headers.authorization?.split('Bearer ')[1];
    const { id } = req.params;

    if (!access_token) return res.status(401).json({ success: false, error: 'Token requis' });
    if (!id) return res.status(400).json({ success: false, error: 'event_id requis' });

    const { data: authData, error: authError } = await supabase.auth.getUser(access_token);
    if (authError || !authData.user) return res.status(401).json({ success: false, error: 'Authentification invalide' });

    const db = supabase.createClientWithAuth(access_token);
    const { data: eventRows, error: eventError } = await db.from('events').select('*, posts(*), organizations(code), event_categories(name)').eq('id', id).limit(1);
    if (eventError) return res.status(400).json({ success: false, error: eventError.message });
    if (!eventRows || eventRows.length === 0) return res.status(404).json({ success: false, error: 'Événement introuvable' });
    const event = eventRows[0];

    const { data: memberRows } = await db.from('organization_members').select('*').eq('organization_id', event.organization_id).eq('profile_id', authData.user.id).limit(1);
    if (!memberRows || memberRows.length === 0 || memberRows[0].role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Accès refusé' });
    }

    return res.json({ success: true, event });
  } catch (error) {
    console.error('Erreur GET event by id:', error);
    return res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
};

/**
 * PUT /api/auth/events/:id
 * Met à jour un événement et ses postes associés (admin requis)
 */
const updateEvent = async (req, res) => {
  try {
    const access_token = req.headers.authorization?.split('Bearer ')[1];
    const { id } = req.params;
    const { title, start_date, end_date, location, description, category_id, posts } = req.body;

    if (!access_token) return res.status(401).json({ success: false, error: 'Token requis' });
    if (!id) return res.status(400).json({ success: false, error: 'event_id requis' });

    const { data: authData, error: authError } = await supabase.auth.getUser(access_token);
    if (authError || !authData.user) return res.status(401).json({ success: false, error: 'Authentification invalide' });

    const db = supabase.createClientWithAuth(access_token);
    const { data: eventRows, error: eventError } = await db.from('events').select('*').eq('id', id).limit(1);
    if (eventError) return res.status(400).json({ success: false, error: eventError.message });
    if (!eventRows || eventRows.length === 0) return res.status(404).json({ success: false, error: 'Événement introuvable' });
    const event = eventRows[0];

    const { data: memberRows } = await db.from('organization_members').select('*').eq('organization_id', event.organization_id).eq('profile_id', authData.user.id).limit(1);
    if (!memberRows || memberRows.length === 0 || memberRows[0].role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Accès refusé: administrateur requis' });
    }

    const updatePayload = {};
    if (title !== undefined) updatePayload.title = title;
    if (start_date !== undefined) updatePayload.start_date = start_date;
    if (end_date !== undefined) updatePayload.end_date = end_date;
    if (location !== undefined) updatePayload.location = location;
    if (description !== undefined) updatePayload.description = description;
    if (category_id !== undefined && category_id !== '') updatePayload.category = category_id;

    const { data: updatedEvent, error: updateError } = await db.from('events').update(updatePayload).eq('id', id).select('*, event_categories(name)').single();
    if (updateError) return res.status(400).json({ success: false, error: updateError.message });

    if (Array.isArray(posts)) {
      const { error: deletePostsError } = await db.from('posts').delete().eq('event_id', id);
      if (deletePostsError) {
        console.error('Erreur suppression anciens postes:', deletePostsError);
      }

      if (posts.length > 0) {
        const postsToInsert = posts.map((p) => ({ event_id: id, name: p.name, slots_needed: p.slots_needed || 1 }));
        const { data: insertedPosts, error: postsError } = await db.from('posts').insert(postsToInsert).select();
        if (postsError) {
          console.error('Erreur insertion des postes:', postsError);
        } else {
          updatedEvent.posts = insertedPosts;
        }
      }
    }

    return res.json({ success: true, event: updatedEvent });
  } catch (error) {
    console.error('Erreur PUT event:', error);
    return res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
};

/**
 * POST /api/auth/create-event
 * Crée un événement lié à une organisation (admin) + ses postes requis
 */
const createEvent = async (req, res) => {
  try {
    const access_token = req.headers.authorization?.split('Bearer ')[1];
    const { title, start_date, end_date, location, description, category_id, organization_id, posts = [] } = req.body;

    if (!access_token) return res.status(401).json({ success: false, error: 'Token requis' });
    if (!title || !start_date || !end_date || !location || !organization_id) return res.status(400).json({ success: false, error: 'Champs manquants' });

    const { data: authData, error: authError } = await supabase.auth.getUser(access_token);
    if (authError || !authData.user) return res.status(401).json({ success: false, error: 'Authentification invalide' });

    // Use per-request client and verify admin
    const db = supabase.createClientWithAuth(access_token);
    const { data: memberRows } = await db.from('organization_members').select('*').eq('organization_id', organization_id).eq('profile_id', authData.user.id).limit(1);
    if (!memberRows || memberRows.length === 0 || memberRows[0].role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Accès refusé: administrateur requis' });
    }

    const insertPayload = { title, start_date, end_date, location, description, organization_id };
    if (category_id !== undefined && category_id !== '') insertPayload.category = category_id;

    const { data: eventData, error: eventError } = await db.from('events').insert(insertPayload).select('*, event_categories(name)').single();
    if (eventError) return res.status(400).json({ success: false, error: eventError.message });

    // If posts provided, insert them into posts table linked to the event
    if (Array.isArray(posts) && posts.length > 0) {
      // Normalize posts: { name, slots_needed }
      const postsToInsert = posts.map((p) => ({ event_id: eventData.id, name: p.name, slots_needed: p.slots_needed || 1 }));
      const { data: insertedPosts, error: postsError } = await db.from('posts').insert(postsToInsert).select();
      if (postsError) {
        // Log but don't fail the entire creation
        console.error('Erreur insertion posts:', postsError);
      } else {
        eventData.posts = insertedPosts;
      }
    }

    return res.status(201).json({ success: true, event: eventData });
  } catch (error) {
    console.error('Erreur create-event:', error);
    res.status(500).json({ success: false, error: 'Erreur lors de la création de l\'événement' });
  }
};

module.exports = {
  deleteEvent,
  listEvents,
  listCategories,
  getEvent,
  updateEvent,
  createEvent,
};
