const express = require('express');
const supabase = require('../utils/supabase');
const { getFrontendUrl } = require('../utils/helpers');
const {
  organizationAccessMiddleware,
  isPlatformAdmin,
} = require('../utils/organizationAccess');

const router = express.Router();

router.use(organizationAccessMiddleware);

/**
 * POST /api/auth/signup
 * Crée un nouvel utilisateur et envoie un email de confirmation
 */
router.post('/signup', async (req, res) => {
  try {
    const { email, password, metadata = {} } = req.body;

    // Validation
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email et mot de passe sont requis',
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        error: 'Le mot de passe doit contenir au moins 8 caractères',
      });
    }

    // Créer l'utilisateur avec confirmation par email
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${getFrontendUrl()}/auth/confirm-email`,
        data: metadata,
      },
    });

    if (error) {
      console.error('Supabase signup error:', error); // Ajout de cette ligne pour un débogage plus détaillé
      return res.status(400).json({
        success: false,
        error: error.message,
      });
    }

    return res.status(201).json({
      success: true,
      message: 'Compte créé avec succès. Vérifiez votre email pour confirmer votre compte.',
      user: {
        id: data.user?.id,
        email: data.user?.email,
        created_at: data.user?.created_at,
      },
    });
  } catch (error) {
    console.error('Erreur signup:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la création du compte',
    });
  }
});

/**
 * DELETE /api/auth/events/:id
 * Supprime un événement (admin requis)
 */
router.delete('/events/:id', async (req, res) => {
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
});

/**
 * GET /api/auth/events
 * Query: ?organization_id=UUID
 * Retourne les événements d'une organisation (membre requis)
 */
router.get('/events', async (req, res) => {
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
});

/**
 * GET /api/auth/event-categories
 * Retourne les catégories d'événements
 */
router.get('/event-categories', async (req, res) => {
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
});

/**
 * GET /api/auth/events/landing-pages
 * Query: ?organization_id=UUID
 * Retourne les publications (landing pages) d'une organisation.
 */
router.get('/events/landing-pages', async (req, res) => {
  try {
    const access_token = req.headers.authorization?.split('Bearer ')[1];
    const orgQuery = req.query.organization_id;
    const organization_id = Array.isArray(orgQuery) ? orgQuery[0] : orgQuery;

    if (!access_token) return res.status(401).json({ success: false, error: 'Token requis' });
    if (!organization_id || typeof organization_id !== 'string') return res.status(400).json({ success: false, error: 'organization_id requis' });

    const { data: authData, error: authError } = await supabase.auth.getUser(access_token);
    if (authError || !authData.user) return res.status(401).json({ success: false, error: 'Authentification invalide' });

    const dbAdmin = supabase.admin || supabase;
    const { data: memberRows } = await dbAdmin.from('organization_members').select('*').eq('organization_id', organization_id).eq('profile_id', authData.user.id).limit(1);
    if (!memberRows || memberRows.length === 0) return res.status(403).json({ success: false, error: 'Accès refusé' });

    const { data: events, error: eventsError } = await dbAdmin.from('events').select('id, title').eq('organization_id', organization_id).order('start_date', { ascending: true });
    if (eventsError) return res.status(400).json({ success: false, error: eventsError.message });

    const eventIds = (events || []).map((event) => event.id);
    let publications = [];

    if (eventIds.length > 0) {
      const { data: landingPages, error: landingPagesError } = await dbAdmin.from('event_landing_pages').select('*').in('event_id', eventIds);
      if (landingPagesError) return res.status(400).json({ success: false, error: landingPagesError.message });

      const landingByEventId = (landingPages || []).reduce((acc, page) => {
        acc[page.event_id] = page;
        return acc;
      }, {});

      publications = (events || []).reduce((result, event) => {
        const landing = landingByEventId[event.id];
        if (!landing) return result;
        result.push({
          eventId: event.id,
          eventTitle: event.title || event.name || 'Événement',
          heroTitle: landing.hero_title || landing.title || event.title || 'Publication',
          heroImage: landing.hero_image || '',
          isPublished: Boolean(landing.is_published),
          updatedAt: landing.updated_at || landing.created_at || null,
        });
        return result;
      }, []);
    }

    return res.json({ success: true, publications });
  } catch (error) {
    console.error('Erreur GET landing-pages:', error);
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

/**
 * GET /api/auth/events/public
 * Retourne les événements publiés (landing page is_published = true), sans authentification.
 */
router.get('/events/public', async (req, res) => {
  try {
    const dbAdmin = supabase.admin || supabase;

    const { data: landingPages, error: landingError } = await dbAdmin
      .from('event_landing_pages')
      .select('event_id, hero_image, hero_title, title')
      .eq('is_published', true);

    if (landingError) return res.status(400).json({ success: false, error: landingError.message });

    const eventIds = [...new Set((landingPages || []).map((lp) => lp.event_id).filter(Boolean))];

    const { data: categories, error: categoriesError } = await dbAdmin
      .from('event_categories')
      .select('id,name')
      .order('name', { ascending: true });

    if (categoriesError) return res.status(400).json({ success: false, error: categoriesError.message });

    if (eventIds.length === 0) {
      return res.json({ success: true, events: [], categories: categories || [], publications: [] });
    }

    const { data: events, error: eventsError } = await dbAdmin
      .from('events')
      .select('*, event_categories(name)')
      .in('id', eventIds)
      .order('start_date', { ascending: true });

    if (eventsError) return res.status(400).json({ success: false, error: eventsError.message });

    const publications = (landingPages || []).map((landing) => ({
      eventId: landing.event_id,
      heroImage: landing.hero_image || '',
      heroTitle: landing.hero_title || landing.title || '',
    }));

    return res.json({
      success: true,
      events: events || [],
      categories: categories || [],
      publications,
    });
  } catch (error) {
    console.error('Erreur GET events/public:', error);
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

/**
 * PUT /api/auth/events/:id/landing-page/publish
 * Met à jour le statut publié de la landing page.
 */
router.put('/events/:id/landing-page/publish', async (req, res) => {
  try {
    const access_token = req.headers.authorization?.split('Bearer ')[1];
    const { id } = req.params;
    const { is_published } = req.body || {};

    if (!access_token) return res.status(401).json({ success: false, error: 'Token requis' });
    if (!id) return res.status(400).json({ success: false, error: 'event_id requis' });
    if (typeof is_published !== 'boolean') return res.status(400).json({ success: false, error: 'is_published doit être un booléen' });

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

    const { data: updatedLanding, error: updateError } = await db
      .from('event_landing_pages')
      .update({ is_published })
      .eq('event_id', id)
      .select()
      .single();

    if (updateError) {
      console.error('Erreur update publish status landing page:', updateError);
      return res.status(400).json({ success: false, error: updateError.message });
    }

    return res.json({ success: true, landingPage: updatedLanding });
  } catch (error) {
    console.error('Erreur PUT publish landing page:', error);
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

/**
 * GET /api/auth/events/:id
 * Retourne un événement par son id (admin requis)
 */
router.get('/events/:id', async (req, res) => {
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
});

/**
 * GET /api/auth/events/:id/landing-page
 * Récupère la landing page de l'événement pour un administrateur
 */
router.get('/events/:id/landing-page', async (req, res) => {
  try {
    const access_token = req.headers.authorization?.split('Bearer ')[1];
    const { id } = req.params;

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
      return res.status(403).json({ success: false, error: 'Accès refusé' });
    }

    const { data, error: landingError } = await db.from('event_landing_pages').select('*').eq('event_id', id).maybeSingle();
    if (landingError) return res.status(400).json({ success: false, error: landingError.message });

    return res.json({ success: true, landingPage: data });
  } catch (error) {
    console.error('Erreur GET landing page:', error);
    return res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

/**
 * GET /api/auth/events/:id/public-landing-page
 * Récupère la landing page publique d'un événement publié.
 * Si la landing page n'existe pas ou n'est pas publiée, retourne les données d'événement seules.
 */
router.get('/events/:id/public-landing-page', async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) return res.status(400).json({ success: false, error: 'event_id requis' });

    const dbAdmin = supabase.admin || supabase;
    
    // Récupérer l'événement
    const { data: eventRows, error: eventError } = await dbAdmin
      .from('events')
      .select('*, event_categories(name)')
      .eq('id', id)
      .limit(1);

    if (eventError) return res.status(400).json({ success: false, error: eventError.message });
    if (!eventRows || eventRows.length === 0) {
      return res.status(404).json({ success: false, error: 'Événement introuvable' });
    }
    const event = eventRows[0];

    const { data: ticketTypes, error: ticketTypesError } = await dbAdmin
      .from('ticket_type')
      .select('*')
      .eq('event_id', id)
      .eq('is_active', true)
      .order('id', { ascending: true });

    if (ticketTypesError) {
      console.error('Erreur lors de la lecture des types de billets:', ticketTypesError);
    }

    // Récupérer la landing page si elle existe et est publiée
    const { data: landingPage, error: landingError } = await dbAdmin
      .from('event_landing_pages')
      .select('*')
      .eq('event_id', id)
      .eq('is_published', true)
      .maybeSingle();

    if (landingError) {
      console.error('Erreur lors de la lecture landing page:', landingError);
      // Continuer quand même avec l'événement seul
    }

    // Si landing page existe et est publiée, la retourner avec l'événement
    if (landingPage) {
      return res.json({ success: true, landingPage, event, ticketTypes: ticketTypes || [] });
    }

    // Sinon, retourner l'événement avec une landing page vide (va utiliser les données d'événement en fallback)
    return res.json({ success: true, landingPage: null, event, ticketTypes: ticketTypes || [] });
  } catch (error) {
    console.error('Erreur GET landing page publique:', error);
    return res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

/**
 * POST /api/auth/events/:id/landing-page/upload-image
 * Upload une image de landing page dans le bucket Supabase publication_images.
 */
router.post('/events/:id/landing-page/upload-image', async (req, res) => {
  try {
    const access_token = req.headers.authorization?.split('Bearer ')[1];
    const { id } = req.params;
    const { filePath, data, contentType } = req.body || {};

    if (!access_token) return res.status(401).json({ success: false, error: 'Token requis' });
    if (!id) return res.status(400).json({ success: false, error: 'event_id requis' });
    if (!filePath || typeof filePath !== 'string') return res.status(400).json({ success: false, error: 'filePath requis' });
    if (!data || typeof data !== 'string') return res.status(400).json({ success: false, error: 'data requis' });

    const { data: authData, error: authError } = await supabase.auth.getUser(access_token);
    if (authError || !authData.user) {
      return res.status(401).json({ success: false, error: 'Authentification invalide' });
    }

    const db = supabase.createClientWithAuth(access_token);
    const { data: eventRows, error: eventError } = await db.from('events').select('*').eq('id', id).limit(1);
    if (eventError) return res.status(400).json({ success: false, error: eventError.message });
    if (!eventRows || eventRows.length === 0) return res.status(404).json({ success: false, error: 'Événement introuvable' });
    const event = eventRows[0];

    const { data: memberRows } = await db.from('organization_members').select('*').eq('organization_id', event.organization_id).eq('profile_id', authData.user.id).limit(1);
    if (!memberRows || memberRows.length === 0 || memberRows[0].role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Accès refusé' });
    }

    const admin = supabase.admin;
    if (!admin) {
      return res.status(500).json({ success: false, error: 'Admin client non configuré' });
    }

    const buffer = Buffer.from(data, 'base64');
    const sanitizedFilePath = filePath
      .split('/')
      .map((segment) => segment.replace(/[^a-zA-Z0-9_.-]/g, '_').replace(/_+/g, '_'))
      .join('/');
    const storagePath = sanitizedFilePath;

    const { error: uploadError } = await admin.storage.from('publication_images').upload(storagePath, buffer, {
      contentType: contentType || 'image/jpeg',
      upsert: true,
    });

    if (uploadError) {
      console.error('Erreur upload image landing page:', uploadError);
      return res.status(500).json({ success: false, error: uploadError.message || 'Erreur de stockage' });
    }

    const { data: publicUrlData, error: publicUrlError } = admin.storage.from('publication_images').getPublicUrl(storagePath);
    if (publicUrlError) {
      console.error('Erreur getPublicUrl:', publicUrlError);
      return res.status(500).json({ success: false, error: publicUrlError.message || 'Erreur de génération de l’URL' });
    }

    return res.status(201).json({ success: true, path: storagePath, publicUrl: publicUrlData.publicUrl });
  } catch (error) {
    console.error('Erreur upload landing image:', error);
    return res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

/**
 * PUT /api/auth/events/:id/landing-page
 * Met à jour ou crée la landing page de l'événement (admin requis)
 */
router.put('/events/:id/landing-page', async (req, res) => {
  try {
    const access_token = req.headers.authorization?.split('Bearer ')[1];
    const { id } = req.params;
    const {
      eventId,
      title,
      heroTitle,
      heroSubtitle,
      customButtonText,
      dateText,
      publicDescription,
      heroImage,
      aboutTitle,
      aboutParagraphs,
      aboutImage,
      contactEmail,
      contactPhone,
      socialLinks,
      templateStyle,
      themePreset,
      hideAboutSection,
    } = req.body || {};

    if (!access_token) {
      return res.status(401).json({ success: false, error: 'Token requis' });
    }

    if (!id) {
      return res.status(400).json({ success: false, error: 'event_id requis' });
    }

    const invalidFields = [];

    const isString = (value) => typeof value === 'string' && value.trim().length > 0;
    const isOptionalString = (value) => value === undefined || typeof value === 'string';
    const isBoolean = (value) => typeof value === 'boolean';

    if (!isString(eventId)) invalidFields.push('eventId');
    if (eventId !== id) invalidFields.push('eventId (doit correspondre à l’ID de l’URL)');
    if (!isString(title)) invalidFields.push('title');
    if (!isString(heroTitle)) invalidFields.push('heroTitle');
    if (!isString(heroSubtitle)) invalidFields.push('heroSubtitle');
    if (!isString(customButtonText)) invalidFields.push('customButtonText');
    if (!isString(dateText)) invalidFields.push('dateText');
    if (!isString(publicDescription)) invalidFields.push('publicDescription');
    if (!isString(heroImage)) invalidFields.push('heroImage');
    if (!hideAboutSection) {
      if (!isString(aboutTitle)) invalidFields.push('aboutTitle');
      if (!Array.isArray(aboutParagraphs) || aboutParagraphs.some((item) => typeof item !== 'string')) {
        invalidFields.push('aboutParagraphs');
      }
    } else if (aboutParagraphs !== undefined && (!Array.isArray(aboutParagraphs) || aboutParagraphs.some((item) => typeof item !== 'string'))) {
      invalidFields.push('aboutParagraphs');
    }
    if (aboutImage !== undefined && typeof aboutImage !== 'string') invalidFields.push('aboutImage');
    if (!isString(contactEmail)) invalidFields.push('contactEmail');
    if (!isString(contactPhone)) invalidFields.push('contactPhone');
    if (!Array.isArray(socialLinks) || socialLinks.some((item) => {
      return (
        !item ||
        typeof item !== 'object' ||
        !['facebook', 'instagram', 'tiktok', 'linkedin', 'youtube', 'twitter', 'website'].includes(item.platform) ||
        typeof item.url !== 'string' ||
        item.url.trim().length === 0
      );
    })) {
      invalidFields.push('socialLinks');
    }
    if (!['default', 'compact', 'split'].includes(templateStyle)) invalidFields.push('templateStyle');
    if (!['indigo', 'cyberpunk', 'forest', 'crimson', 'amber'].includes(themePreset)) invalidFields.push('themePreset');
    if (!isBoolean(hideAboutSection)) invalidFields.push('hideAboutSection');

    if (invalidFields.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Payload invalide',
        invalidFields,
      });
    }

    const { data: authData, error: authError } = await supabase.auth.getUser(access_token);
    if (authError || !authData.user) {
      return res.status(401).json({ success: false, error: 'Authentification invalide' });
    }

    const db = supabase.createClientWithAuth(access_token);
    const { data: eventRows, error: eventError } = await db.from('events').select('*').eq('id', id).limit(1);
    if (eventError) return res.status(400).json({ success: false, error: eventError.message });
    if (!eventRows || eventRows.length === 0) return res.status(404).json({ success: false, error: 'Événement introuvable' });
    const event = eventRows[0];

    const { data: memberRows } = await db.from('organization_members').select('*').eq('organization_id', event.organization_id).eq('profile_id', authData.user.id).limit(1);
    if (!memberRows || memberRows.length === 0 || memberRows[0].role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Accès refusé' });
    }

    const landingPagePayload = {
      event_id: id,
      title,
      hero_title: heroTitle,
      hero_subtitle: heroSubtitle,
      custom_button_text: customButtonText,
      date_text: dateText,
      lieu: event.location || '',
      public_description: publicDescription,
      hero_image: heroImage,
      about_title: aboutTitle,
      about_paragraphs: aboutParagraphs,
      about_image: aboutImage,
      contact_email: contactEmail,
      contact_phone: contactPhone,
      social_links: socialLinks,
      template_style: templateStyle,
      theme_preset: themePreset,
      hide_about_section: hideAboutSection,
    };

    const { data: existingLanding, error: existingError } = await db
      .from('event_landing_pages')
      .select('id')
      .eq('event_id', id)
      .maybeSingle();

    if (existingError) {
      console.error('Erreur lecture landing page existante:', existingError);
      return res.status(500).json({ success: false, error: 'Erreur serveur' });
    }

    const { data: landingPage, error: upsertError } = await db
      .from('event_landing_pages')
      .upsert(landingPagePayload, { onConflict: 'event_id' })
      .select()
      .single();

    if (upsertError) {
      console.error('Erreur UPSERT landing page:', upsertError);
      return res.status(500).json({ success: false, error: 'Erreur lors de la sauvegarde de la landing page' });
    }

    return res.status(existingLanding ? 200 : 201).json({ success: true, landingPage });
  } catch (error) {
    console.error('Erreur PUT landing page:', error);
    return res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

/**
 * PUT /api/auth/events/:id
 * Met à jour un événement et ses postes associés (admin requis)
 */
router.put('/events/:id', async (req, res) => {
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
});

/**
 * POST /api/auth/generate-tickets-async
 * Body: { event_id, count, design_image_data|design_url, config, ticket_type }
 * Creates a generation job that will be processed asynchronously by a worker.
 * Returns: { success, job }
 */
router.post('/generate-tickets-async', async (req, res) => {
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
});

/**
 * POST /api/auth/login
 * Connecte un utilisateur avec email et mot de passe
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validation
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email et mot de passe sont requis',
      });
    }

    // Authentifier l'utilisateur
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return res.status(401).json({
        success: false,
        error: error.message,
      });
    }

    return res.json({
      success: true,
      message: 'Connexion réussie',
      user: {
        id: data.user?.id,
        email: data.user?.email,
        created_at: data.user?.created_at,
      },
      session: {
        access_token: data.session?.access_token,
        refresh_token: data.session?.refresh_token,
        expires_in: data.session?.expires_in,
      },
    });
  } catch (error) {
    console.error('Erreur login:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la connexion',
    });
  }
});

/**
 * POST /api/auth/logout
 * Déconnecte l'utilisateur
 */
router.post('/logout', async (req, res) => {
  try {
    const { error } = await supabase.auth.signOut();

    if (error) {
      return res.status(400).json({
        success: false,
        error: error.message,
      });
    }

    return res.json({
      success: true,
      message: 'Déconnexion réussie',
    });
  } catch (error) {
    console.error('Erreur logout:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la déconnexion',
    });
  }
});

/**
 * POST /api/auth/confirm-email
 * Confirme l'email de l'utilisateur avec un token
 */
router.post('/confirm-email', async (req, res) => {
  try {
    const { token_hash, type } = req.body;

    if (!token_hash || !type) {
      return res.status(400).json({
        success: false,
        error: 'token_hash et type sont requis',
      });
    }

    // Vérifier le token
    const { data, error } = await supabase.auth.verifyOtp({
      token_hash,
      type,
    });

    if (error) {
      return res.status(400).json({
        success: false,
        error: error.message,
      });
    }

    return res.json({
      success: true,
      message: 'Email confirmé avec succès',
      user: {
        id: data.user?.id,
        email: data.user?.email,
        email_confirmed_at: data.user?.email_confirmed_at,
      },
      session: {
        access_token: data.session?.access_token,
        refresh_token: data.session?.refresh_token,
      },
    });
  } catch (error) {
    console.error('Erreur confirm-email:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la confirmation de l\'email',
    });
  }
});

/**
 * POST /api/auth/refresh-token
 * Rafraîchit le token d'accès
 */
router.post('/refresh-token', async (req, res) => {
  try {
    const { refresh_token } = req.body;

    if (!refresh_token) {
      return res.status(400).json({
        success: false,
        error: 'refresh_token est requis',
      });
    }

    const { data, error } = await supabase.auth.refreshSession({
      refresh_token,
    });

    if (error) {
      return res.status(401).json({
        success: false,
        error: error.message,
      });
    }

    return res.json({
      success: true,
      session: {
        access_token: data.session?.access_token,
        refresh_token: data.session?.refresh_token,
        expires_in: data.session?.expires_in,
      },
    });
  } catch (error) {
    console.error('Erreur refresh-token:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors du rafraîchissement du token',
    });
  }
});


/**
 * GET /api/auth/organization-members
 * Query: ?organization_id=UUID&q=search&filter=all|pending
 * Retourne les membres d'une organisation (admin requis)
 */
router.get('/organization-members', async (req, res) => {
  try {
    const access_token = req.headers.authorization?.split('Bearer ')[1];
    const organization_id = req.query.organization_id;
    const q = req.query.q || '';
    const filter = req.query.filter || 'all';

    if (!access_token) return res.status(401).json({ success: false, error: 'Token requis' });
    if (!organization_id) return res.status(400).json({ success: false, error: 'organization_id requis' });

    const { data: authData, error: authError } = await supabase.auth.getUser(access_token);
    if (authError || !authData.user) return res.status(401).json({ success: false, error: 'Authentification invalide' });

    const db = supabase.createClientWithAuth(access_token);

    // Vérifier admin
    const { data: memberRows } = await db.from('organization_members').select('*').eq('organization_id', organization_id).eq('profile_id', authData.user.id).limit(1);
    if (!memberRows || memberRows.length === 0 || memberRows[0].role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Accès refusé: administrateur requis' });
    }

    let query = db.from('organization_members').select('id,organization_id,profile_id,role,is_validated,created_at,profiles(id,first_name,last_name,phone)').eq('organization_id', organization_id);

    if (filter === 'pending') query = query.eq('is_validated', false);
    if (filter === 'validated') query = query.eq('is_validated', true);

    if (q && typeof q === 'string') {
      // search by profile name
      query = query.ilike('profiles.first_name', `%${q}%`).or(`profiles.last_name.ilike(%${q}%)`);
    }

    const { data: members, error: membersError } = await query.order('created_at', { ascending: false });
    if (membersError) return res.status(400).json({ success: false, error: membersError.message });

    return res.json({ success: true, members });
  } catch (error) {
    console.error('Erreur GET organization-members:', error);
    res.status(500).json({ success: false, error: 'Erreur lors de la récupération des membres de l\'organisation' });
  }
});


/**
 * POST /api/auth/organization-members/bulk-action
 * Body: { member_ids: number[], action: 'validate'|'reject'|'delete' }
 */
router.post('/organization-members/bulk-action', async (req, res) => {
  try {
    const access_token = req.headers.authorization?.split('Bearer ')[1];
    const { member_ids, action } = req.body;

    if (!access_token) return res.status(401).json({ success: false, error: 'Token requis' });
    if (!Array.isArray(member_ids) || member_ids.length === 0) {
      return res.status(400).json({ success: false, error: 'member_ids requis (tableau non vide)' });
    }
    if (!['validate', 'reject', 'delete'].includes(action)) {
      return res.status(400).json({ success: false, error: 'Action invalide' });
    }

    const { data: authData, error: authError } = await supabase.auth.getUser(access_token);
    if (authError || !authData.user) return res.status(401).json({ success: false, error: 'Authentification invalide' });

    const db = supabase.createClientWithAuth(access_token);
    const ids = member_ids.map(Number).filter((id) => Number.isFinite(id));

    const { data: members, error: fetchErr } = await db
      .from('organization_members')
      .select('id, organization_id')
      .in('id', ids);

    if (fetchErr) return res.status(400).json({ success: false, error: fetchErr.message });
    if (!members?.length) return res.status(404).json({ success: false, error: 'Aucun membre trouvé' });

    const orgIds = [...new Set(members.map((m) => m.organization_id))];
    for (const orgId of orgIds) {
      const { data: adminRows } = await db
        .from('organization_members')
        .select('role')
        .eq('organization_id', orgId)
        .eq('profile_id', authData.user.id)
        .limit(1);
      if (!adminRows?.length || adminRows[0].role !== 'admin') {
        return res.status(403).json({ success: false, error: 'Accès refusé: administrateur requis' });
      }
    }

    const memberIds = members.map((m) => m.id);

    if (action === 'validate') {
      const { error: updateError } = await db
        .from('organization_members')
        .update({ is_validated: true })
        .in('id', memberIds);
      if (updateError) return res.status(400).json({ success: false, error: updateError.message });
      return res.json({
        success: true,
        message: `${memberIds.length} membre(s) validé(s) avec succès.`,
        processed_count: memberIds.length,
      });
    }

    const { error: deleteError } = await db.from('organization_members').delete().in('id', memberIds);
    if (deleteError) return res.status(400).json({ success: false, error: deleteError.message });

    return res.json({
      success: true,
      message: `${memberIds.length} membre(s) ${action === 'reject' ? 'refusé(s)' : 'supprimé(s)'} avec succès.`,
      processed_count: memberIds.length,
    });
  } catch (error) {
    console.error('Erreur POST organization-members/bulk-action:', error);
    res.status(500).json({ success: false, error: 'Erreur lors de l\'action groupée sur les membres' });
  }
});

/**
 * PATCH /api/auth/organization-members/:id
 * Met à jour un membre de l'organisation (admin requis)
 */
router.patch('/organization-members/:id', async (req, res) => {
  try {
    const access_token = req.headers.authorization?.split('Bearer ')[1];
    const id = Number(req.params.id);
    const payload = req.body;

    if (!access_token) return res.status(401).json({ success: false, error: 'Token requis' });

    const { data: authData, error: authError } = await supabase.auth.getUser(access_token);
    if (authError || !authData.user) return res.status(401).json({ success: false, error: 'Authentification invalide' });

    const db = supabase.createClientWithAuth(access_token);

    // fetch member to get organization_id
    const { data: rows, error: fetchErr } = await db.from('organization_members').select('*').eq('id', id).limit(1);
    if (fetchErr) return res.status(400).json({ success: false, error: fetchErr.message });
    if (!rows || rows.length === 0) return res.status(404).json({ success: false, error: 'Membre introuvable' });

    const member = rows[0];

    // verify admin rights
    const { data: adminRows } = await db.from('organization_members').select('*').eq('organization_id', member.organization_id).eq('profile_id', authData.user.id).limit(1);
    if (!adminRows || adminRows.length === 0 || adminRows[0].role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Accès refusé: administrateur requis' });
    }

    const { data: updated, error: updateError } = await db.from('organization_members').update(payload).eq('id', id).select().single();
    if (updateError) return res.status(400).json({ success: false, error: updateError.message });

    return res.json({ success: true, member: updated });
  } catch (error) {
    console.error('Erreur patch organization-member:', error);
    res.status(500).json({ success: false, error: 'Erreur lors de la mise à jour du membre' });
  }
});


/**
 * DELETE /api/auth/organization-members/:id
 * Supprime un membre de l'organisation (admin requis)
 */
router.delete('/organization-members/:id', async (req, res) => {
  try {
    const access_token = req.headers.authorization?.split('Bearer ')[1];
    const id = Number(req.params.id);

    if (!access_token) return res.status(401).json({ success: false, error: 'Token requis' });

    const { data: authData, error: authError } = await supabase.auth.getUser(access_token);
    if (authError || !authData.user) return res.status(401).json({ success: false, error: 'Authentification invalide' });

    const db = supabase.createClientWithAuth(access_token);

    // fetch member to get organization_id
    const { data: rows, error: fetchErr } = await db.from('organization_members').select('*').eq('id', id).limit(1);
    if (fetchErr) return res.status(400).json({ success: false, error: fetchErr.message });
    if (!rows || rows.length === 0) return res.status(404).json({ success: false, error: 'Membre introuvable' });

    const member = rows[0];

    // verify admin rights
    const { data: adminRows } = await db.from('organization_members').select('*').eq('organization_id', member.organization_id).eq('profile_id', authData.user.id).limit(1);
    if (!adminRows || adminRows.length === 0 || adminRows[0].role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Accès refusé: administrateur requis' });
    }

    const { error: deleteError } = await db.from('organization_members').delete().eq('id', id);
    if (deleteError) return res.status(400).json({ success: false, error: deleteError.message });

    return res.json({ success: true });
  } catch (error) {
    console.error('Erreur delete organization-member:', error);
    res.status(500).json({ success: false, error: 'Erreur lors de la suppression du membre' });
  }
});

/**
 * POST /api/auth/forgot-password
 * Envoie un email de réinitialisation du mot de passe
 */
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'Email est requis',
      });
    }

    const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${getFrontendUrl()}/auth/reset-password`,
    });

    if (error) {
      return res.status(400).json({
        success: false,
        error: error.message,
      });
    }

    return res.json({
      success: true,
      message: 'Email de réinitialisation envoyé. Vérifiez votre boîte de réception.',
    });
  } catch (error) {
    console.error('Erreur forgot-password:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la demande de réinitialisation',
    });
  }
});

/**
 * POST /api/auth/reset-password
 * Réinitialise le mot de passe avec un nouveau
 */
router.post('/reset-password', async (req, res) => {
  try {
    const { new_password } = req.body;
    const access_token = req.headers.authorization?.split('Bearer ')[1];

    if (!new_password) {
      return res.status(400).json({
        success: false,
        error: 'new_password est requis',
      });
    }

    if (!access_token) {
      return res.status(401).json({
        success: false,
        error: 'Authentification requise',
      });
    }

    // Mettre à jour le mot de passe
    const { data, error } = await supabase.auth.updateUser({
      password: new_password,
    });

    if (error) {
      return res.status(400).json({
        success: false,
        error: error.message,
      });
    }

    return res.json({
      success: true,
      message: 'Mot de passe réinitialisé avec succès',
      user: {
        id: data.user?.id,
        email: data.user?.email,
      },
    });
  } catch (error) {
    console.error('Erreur reset-password:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la réinitialisation du mot de passe',
    });
  }
});

/**
 * GET /api/auth/user
 * Récupère les informations de l'utilisateur actuellement connecté
 */
router.get('/user', async (req, res) => {
  try {
    const access_token = req.headers.authorization?.split('Bearer ')[1];

    if (!access_token) {
      return res.status(401).json({
        success: false,
        error: 'Token d\'authentification requis',
      });
    }

    const { data, error } = await supabase.auth.getUser(access_token);

    if (error) {
      return res.status(401).json({
        success: false,
        error: error.message,
      });
    }

    return res.json({
      success: true,
      user: {
        id: data.user?.id,
        email: data.user?.email,
        email_confirmed_at: data.user?.email_confirmed_at,
        created_at: data.user?.created_at,
        metadata: data.user?.user_metadata,
      },
    });
  } catch (error) {
    console.error('Erreur get user:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la récupération de l\'utilisateur',
    });
  }
});

/**
 * POST /api/auth/create-profile
 * Crée le profil utilisateur dans la table profiles
 */
router.post('/create-profile', async (req, res) => {
  try {
    const access_token = req.headers.authorization?.split('Bearer ')[1];

    if (!access_token) {
      return res.status(401).json({
        success: false,
        error: 'Token d\'authentification requis',
      });
    }

    // Vérifier l'utilisateur
    const { data: authData, error: authError } = await supabase.auth.getUser(access_token);

    if (authError || !authData.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentification invalide',
      });
    }

    const { first_name, last_name, phone } = req.body;

    // Validation - seulement prénom et nom requis
    if (!first_name || !last_name) {
      return res.status(400).json({
        success: false,
        error: 'Prénom et nom sont requis',
      });
    }

    // On utilise l'admin client pour contourner le RLS lors de la création du profil
    const dbAdmin = supabase.admin;
    if (!dbAdmin) {
      return res.status(500).json({ success: false, error: "Configuration serveur incomplète (Admin Key manquante)" });
    }

    const { data: profileData, error: profileError } = await dbAdmin
      .from('profiles')
      .insert({
        id: authData.user.id,
        first_name,
        last_name,
        phone: phone || null,
      })
      .select();

    if (profileError) {
      // Si le profil existe déjà, on le met à jour
      if (profileError.code === '23505') {
        const { data: updateData, error: updateError } = await dbAdmin
          .from('profiles')
          .update({
            first_name,
            last_name,
            phone: phone || null,
          })
          .eq('id', authData.user.id)
          .select();

        if (updateError) {
          return res.status(400).json({
            success: false,
            error: updateError.message,
          });
        }

        return res.json({
          success: true,
          message: 'Profil mis à jour avec succès',
          profile: updateData[0],
        });
      }

      return res.status(400).json({
        success: false,
        error: profileError.message,
      });
    }

    return res.status(201).json({
      success: true,
      message: 'Profil créé avec succès',
      profile: profileData[0],
    });
  } catch (error) {
    console.error('Erreur create-profile:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la création du profil',
    });
  }
});

/**
 * GET /api/auth/check-profile
 * Vérifie si l'utilisateur a un profil complété
 */
router.get('/check-profile', async (req, res) => {
  try {
    const access_token = req.headers.authorization?.split('Bearer ')[1];

    console.log('check-profile - incoming Authorization header:', req.headers.authorization ? '[present]' : '[missing]');
    console.log('check-profile - access_token length:', access_token ? access_token.length : 0);

    if (!access_token) {
      return res.status(401).json({
        success: false,
        error: 'Token d\'authentification requis',
      });
    }

    // Vérifier l'utilisateur
    const { data: authData, error: authError } = await supabase.auth.getUser(access_token);

    console.log('check-profile - supabase.auth.getUser error:', authError ? JSON.stringify(authError) : null);
    console.log('check-profile - supabase.auth.getUser user id:', authData?.user?.id || null);

    if (authError || !authData.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentification invalide',
      });
    }

    // Utiliser l'admin client pour vérifier l'état sans contraintes RLS
    const dbAdmin = supabase.admin || supabase;

    // Récupérer le profil (sans le rôle, car le rôle est dans organization_members)
    const { data: profileData, error: profileError } = await dbAdmin
      .from('profiles')
      .select('*')
      .eq('id', authData.user.id)
      .single();

    if (profileError || !profileData) {
      return res.json({
        success: true,
        hasProfile: false,
        hasOrganization: false
      });
    }

    // Récupérer les profile_skills pour le profil courant (s'il existe)
    let profileSkills = [];
    const { data: psData, error: psError } = await dbAdmin
      .from('profile_skills')
      .select('id,skill,skill_id, skills(name)')
      .eq('profile_id', profileData.id);

    if (!psError && psData) {
      profileSkills = (psData || []).map((r) => ({
        id: r.id,
        skill_id: r.skill_id || null,
        name: r.skills?.name || r.skill || null,
        raw: r.skill || null,
      }));
    }

    // Vérifier si l'utilisateur est membre d'une organisation
    const { data: memberData, error: memberError } = await dbAdmin
      .from('organization_members')
      .select('organization_id, role, organizations(id, name, status)')
      .eq('profile_id', authData.user.id)
      .limit(1)
      .maybeSingle();

    return res.json({
      success: true,
      hasProfile: true,
      hasOrganization: !!memberData,
      organizationStatus: memberData?.organizations?.status || null,
      organizationName: memberData?.organizations?.name || null,
      organizationId: memberData?.organization_id || null,
      profile: profileData,
      profile_skills: profileSkills,
      role: memberData ? memberData.role : null,
    });
  } catch (error) {
    console.error('Erreur check-profile:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la vérification du profil',
    });
  }
});

/**
 * GET /api/auth/skills
 * Récupère la liste des compétences disponibles
 */
router.get('/skills', async (req, res) => {
  try {
    const access_token = req.headers.authorization?.split('Bearer ')[1];

    if (!access_token) {
      return res.status(401).json({
        success: false,
        error: 'Token d\'authentification requis',
      });
    }

    // Vérifier l'utilisateur
    const { data: authData, error: authError } = await supabase.auth.getUser(access_token);

    if (authError || !authData.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentification invalide',
      });
    }

    const db = supabase.createClientWithAuth(access_token);

    // Récupérer le profil pour obtenir event_id
    const { data: profileData, error: profileError } = await db
      .from('profiles')
      .select('event_id')
      .eq('id', authData.user.id)
      .single();

    // Si pas de profil, récupérer tous les skills
    let query = db.from('skills').select('*');

    if (!profileError && profileData?.event_id) {
      query = query.eq('event_id', profileData.event_id);
    }

    const { data: skillsData, error: skillsError } = await query;

    if (skillsError) {
      return res.status(400).json({
        success: false,
        error: skillsError.message,
      });
    }

    return res.json({
      success: true,
      skills: skillsData || [],
    });
  } catch (error) {
    console.error('Erreur GET skills:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la récupération des compétences',
    });
  }
});

/**
 * POST /api/auth/profile-skills
 * Ajoute les compétences sélectionnées au profil de l'utilisateur
 */
router.post('/profile-skills', async (req, res) => {
  try {
    const access_token = req.headers.authorization?.split('Bearer ')[1];
    const { skill_ids, custom_skills } = req.body;

    if (!access_token) {
      return res.status(401).json({
        success: false,
        error: 'Token d\'authentification requis',
      });
    }

    if ((!skill_ids || !Array.isArray(skill_ids)) && (!custom_skills || !Array.isArray(custom_skills))) {
      return res.status(400).json({
        success: false,
        error: 'skill_ids ou custom_skills requis',
      });
    }

    // Vérifier l'utilisateur
    const { data: authData, error: authError } = await supabase.auth.getUser(access_token);

    if (authError || !authData.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentification invalide',
      });
    }

    const db = supabase.createClientWithAuth(access_token);

    // Récupérer le profil_id
    const { data: profileData, error: profileError } = await db
      .from('profiles')
      .select('id')
      .eq('id', authData.user.id)
      .single();

    if (profileError || !profileData) {
      return res.status(404).json({
        success: false,
        error: 'Profil non trouvé',
      });
    }

    // D'abord, supprimer les skills existants
    const { error: deleteError } = await db
      .from('profile_skills')
      .delete()
      .eq('profile_id', profileData.id);

    if (deleteError) {
      console.error('Erreur lors de la suppression des skills:', deleteError);
    }

    // Insérer les nouvelles skills (réutiliser skill_ids pour skills existantes et custom_skills pour skills libres)
    const profileSkillsData = [];
    if (Array.isArray(skill_ids)) {
      for (const skillId of skill_ids) {
        profileSkillsData.push({ profile_id: profileData.id, skill_id: skillId });
      }
    }
    if (Array.isArray(custom_skills)) {
      for (const custom of custom_skills) {
        if (typeof custom === 'string' && custom.trim()) {
          profileSkillsData.push({ profile_id: profileData.id, skill: custom.trim() });
        }
      }
    }

    let insertedData = [];
    if (profileSkillsData.length > 0) {
      const insertResult = await db.from('profile_skills').insert(profileSkillsData).select();
      if (insertResult.error) {
        return res.status(400).json({ success: false, error: insertResult.error.message });
      }
      insertedData = insertResult.data;
    }

    if (insertError) {
      return res.status(400).json({
        success: false,
        error: insertError.message,
      });
    }

    return res.json({
      success: true,
      message: 'Compétences ajoutées avec succès',
      profile_skills: insertedData,
    });
  } catch (error) {
    console.error('Erreur POST profile-skills:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de l\'ajout des compétences',
    });
  }
});

/**
 * POST /api/auth/create-organization
 * Crée une organisation et ajoute le user comme admin
 */
router.post('/create-organization', async (req, res) => {
  try {
    const access_token = req.headers.authorization?.split('Bearer ')[1];
    const { name } = req.body;

    if (!access_token) {
      return res.status(401).json({ success: false, error: 'Token d\'authentification requis' });
    }

    if (!name) {
      return res.status(400).json({ success: false, error: 'Le nom de l\'organisation est requis' });
    }

    const { data: authData, error: authError } = await supabase.auth.getUser(access_token);
    if (authError || !authData.user) {
      return res.status(401).json({ success: false, error: 'Authentification invalide' });
    }

    const dbAdmin = supabase.admin || supabase;

    // Générer un code unique pour l'organisation
    let code;
    for (let i = 0; i < 5; i++) {
      code = Math.floor(100000 + Math.random() * 900000); // 6 digits
      const { data: exists } = await dbAdmin.from('organizations').select('id').eq('code', code).limit(1);
      if (!exists || exists.length === 0) break;
      code = null;
    }

    const { data: orgData, error: orgError } = await dbAdmin
      .from('organizations')
      .insert({ name, code, status: 'pending' })
      .select()
      .single();

    if (orgError) {
      return res.status(400).json({ success: false, error: orgError.message });
    }

    // Ajouter le user comme membre admin validé
    const { data: memberData, error: memberError } = await dbAdmin
      .from('organization_members')
      .insert({ organization_id: orgData.id, profile_id: authData.user.id, role: 'admin', is_validated: true })
      .select()
      .single();

    if (memberError) {
      return res.status(400).json({ success: false, error: memberError.message });
    }

    return res.status(201).json({ success: true, organization: orgData, member: memberData });
  } catch (error) {
    console.error('Erreur create-organization:', error);
    res.status(500).json({ success: false, error: 'Erreur lors de la création de l\'organisation' });
  }
});

/**
 * POST /api/auth/join-organization
 * Rejoindre une organisation via code d'invitation
 */
router.post('/join-organization', async (req, res) => {
  try {
    const access_token = req.headers.authorization?.split('Bearer ')[1];
    const { code } = req.body;

    if (!access_token) {
      return res.status(401).json({ success: false, error: 'Token d\'authentification requis' });
    }

    if (!code) {
      return res.status(400).json({ success: false, error: 'Le code d\'invitation est requis' });
    }

    const { data: authData, error: authError } = await supabase.auth.getUser(access_token);
    if (authError || !authData.user) {
      return res.status(401).json({ success: false, error: 'Authentification invalide' });
    }

    const dbAdmin = supabase.admin || supabase;

    // Vérifier l'organisation via Admin (car l'user n'est pas encore membre)
    const { data: orgs, error: orgError } = await dbAdmin.from('organizations').select('*').eq('code', code).limit(1);
    if (orgError) {
      return res.status(400).json({ success: false, error: orgError.message });
    }

    if (!orgs || orgs.length === 0) {
      return res.status(404).json({ success: false, error: 'Organisation introuvable pour ce code' });
    }

    const org = orgs[0];

    // Ajouter directement comme membre validé
    const { data: memberData, error: memberError } = await dbAdmin
      .from('organization_members')
      .insert({ organization_id: org.id, profile_id: authData.user.id, role: 'staff', is_validated: true })
      .select()
      .single();

    if (memberError) {
      return res.status(400).json({ success: false, error: memberError.message });
    }

    return res.json({ success: true, message: 'Adhésion à l\'organisation réussie', member: memberData });
  } catch (error) {
    console.error('Erreur join-organization:', error);
    res.status(500).json({ success: false, error: 'Erreur lors de la demande d\'adhésion' });
  }
});

/**
 * POST /api/auth/organization-skills
 * Ajoute des compétences pour une organisation (admin seulement)
 * body: { organization_id, skills: ["skill1", "skill2"] }
 */
router.post('/organization-skills', async (req, res) => {
  try {
    const access_token = req.headers.authorization?.split('Bearer ')[1];
    const { organization_id, skills } = req.body;

    if (!access_token) return res.status(401).json({ success: false, error: 'Token requis' });
    if (!organization_id || !Array.isArray(skills)) return res.status(400).json({ success: false, error: 'organization_id et skills sont requis' });

    const { data: authData, error: authError } = await supabase.auth.getUser(access_token);
    if (authError || !authData.user) return res.status(401).json({ success: false, error: 'Authentification invalide' });

    // Vérifier que l'utilisateur est admin de l'organisation
    const { data: memberRows } = await supabase.from('organization_members').select('*').eq('organization_id', organization_id).eq('profile_id', authData.user.id).limit(1);
    if (!memberRows || memberRows.length === 0 || memberRows[0].role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Accès refusé: administrateur requis' });
    }

    const insertData = skills.map((name) => ({ organization_id, name }));
    const { data: inserted, error: insertError } = await supabase.from('skills').insert(insertData).select();
    if (insertError) return res.status(400).json({ success: false, error: insertError.message });

    return res.status(201).json({ success: true, skills: inserted });
  } catch (error) {
    console.error('Erreur organization-skills:', error);
    res.status(500).json({ success: false, error: 'Erreur lors de l\'ajout des compétences' });
  }
});

/**
 * POST /api/auth/create-event
 * Crée un événement lié à une organisation (admin) + ses postes requis
 */
router.post('/create-event', async (req, res) => {
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
});

/**
 * POST /api/auth/apply-event
 * Le staff postule à un événement
 * body: { event_id }
 */
router.post('/apply-event', async (req, res) => {
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
});

/**
 * POST /api/auth/event-staff/bulk-action
 * Body: { application_ids: number[], action: 'accept'|'reject'|'delete' }
 */
router.post('/event-staff/bulk-action', async (req, res) => {
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
});

/**
 * POST /api/auth/event-staff/:id/validate
 * Valide ou rejette une candidature (admin de l'organisation de l'événement)
 * body: { action: 'accept'|'reject' }
 */
router.post('/event-staff/:id/validate', async (req, res) => {
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
});

/**
 * DELETE /api/auth/event-staff/:id
 * Supprime une candidature (admin requis)
 */
router.delete('/event-staff/:id', async (req, res) => {
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
});

/**
 * POST /api/auth/event-staff/my/:id/retry
 * Permet à un utilisateur de relancer sa candidature refusée (status → en_attente)
 */
router.post('/event-staff/my/:id/retry', async (req, res) => {
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
});

/**
 * DELETE /api/auth/event-staff/my/:id
 * Permet à un utilisateur de retirer sa propre candidature (seulement si profile_id === auth user)
 */
router.delete('/event-staff/my/:id', async (req, res) => {
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
});

/**
 * GET /api/auth/event-staff
 * Liste les candidatures pour un événement (filtre event_id) avec infos profil et compétences
 * Query: ?event_id=UUID
 */
router.get('/event-staff', async (req, res) => {
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
});

/**
 * GET /api/auth/my-organization
 * Retourne l'organisation (et le membership) liée au profil authentifié, ou null
 */
router.get('/my-organization', async (req, res) => {
  try {
    const access_token = req.headers.authorization?.split('Bearer ')[1];

    if (!access_token) {
      return res.status(401).json({ success: false, error: "Token d'authentification requis" });
    }

    const { data: authData, error: authError } = await supabase.auth.getUser(access_token);
    if (authError || !authData.user) return res.status(401).json({ success: false, error: 'Authentification invalide' });

    // Utiliser l'admin client pour trouver l'organisation associée
    const dbAdmin = supabase.admin || supabase;

    // Rechercher un membership pour le profil
    const { data: memberRows, error: memberError } = await dbAdmin
      .from('organization_members')
      .select('*, organizations(*)')
      .eq('profile_id', authData.user.id)
      .limit(1)
      .maybeSingle();

    if (memberError) {
      return res.status(400).json({ success: false, error: memberError.message });
    }

    if (!memberRows) {
      return res.json({ success: true, organization: null, member: null });
    }

    return res.json({ success: true, organization: memberRows.organizations || null, member: memberRows });
  } catch (error) {
    console.error('Erreur my-organization:', error);
    res.status(500).json({ success: false, error: 'Erreur lors de la récupération de l\'organisation' });
  }
});

/**
 * POST /api/auth/generate-tickets
 * Body: { event_id, count, design_image_data (data URL), config }
 * Returns: { success, pdf_base64, filename, tickets }
 */
router.post('/generate-tickets', async (req, res) => {
  try {
    const access_token = req.headers.authorization?.split('Bearer ')[1];
    if (!access_token) return res.status(401).json({ success: false, error: 'Token requis' }); // cite: 1

    const { event_id, count = 1, design_image_data, design_url, config, ticket_type = 'standard' } = req.body;
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
      ticketsToInsert.push({ id, event_id, ticket_type, price: req.body.price || 0, number: startNumber + i, created_at: new Date().toISOString() });
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
    for (const t of ticketsToInsert) {
      const payload = `${process.env.FRONTEND_URL || 'https://app.local'}/ticket/${t.id}`;
      const dataUrl = await QRCode.toDataURL(payload, { margin: 0 });
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

    // config.widthMm envoyé par le frontend est la largeur TOTALE (Design + Zone QR)
    // config.heightMm est la hauteur de la ligne (billet)
    const totalTicketWmm = config?.widthMm || (support === 'badge' ? 85 : 100);
    const totalTicketHmm = config?.heightMm || (support === 'badge' ? 54 : 40);

    let qrZoneWmm = 0;
    if (support === 'ticket') qrZoneWmm = totalTicketHmm; // QR carré à droite
    else if (support === 'invitation') qrZoneWmm = 50;   // Zone QR fixe de 5cm

    const designWmm = totalTicketWmm - qrZoneWmm;

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

      // 1. Dessiner le design (Fit contain dans sa zone)
      const designWPt = mmToPt(designWmm);
      const designHPt = mmToPt(totalTicketHmm);
      
      const { width: imgW, height: imgH } = embeddedDesign.scale(1);
      const scale = Math.min(designWPt / imgW, designHPt / imgH);
      const dw = imgW * scale;
      const dh = imgH * scale;
      
      currentPage.drawImage(embeddedDesign, {
        x: drawX + (designWPt - dw) / 2,
        y: drawY + (designHPt - dh) / 2,
        width: dw,
        height: dh
      });

      // 2. Dessiner le QR Code à droite du design
      if (qrZoneWmm > 0) {
        const qrBuf = Buffer.from(qrDataUrls[t.id].split(',')[1], 'base64');
        let qrImage = await pdfDoc.embedPng(qrBuf).catch(() => pdfDoc.embedJpg(qrBuf));

        if (qrImage) {
            const qrContainerWPt = mmToPt(qrZoneWmm);
            const qrContainerHPt = designHPt;

            const maxQrSizePt = Math.min(qrContainerWPt - 12, qrContainerHPt * 0.7);
            const qrSizePt = maxQrSizePt;

            const qx = drawX + designWPt + (qrContainerWPt - qrSizePt) / 2;
            const qy = drawY + (designHPt - qrSizePt - 6);

            currentPage.drawImage(qrImage, { x: qx, y: qy, width: qrSizePt, height: qrSizePt });

            const { rgb, StandardFonts } = require('pdf-lib');
            const textFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
            const labelFontSize = 7;
            
            const ticketIdDisplay = t.number ? `#${t.number}` : t.id.slice(0, 8);
            const line1Text = `Ticket N° ${ticketIdDisplay} | ${t.ticket_type || 'Standard'}`;
            const line2Text = `Made with ToliarEvent`;

            const lx1 = drawX + designWPt + (qrContainerWPt - textFont.widthOfTextAtSize(line1Text, labelFontSize)) / 2;
            const lx2 = drawX + designWPt + (qrContainerWPt - textFont.widthOfTextAtSize(line2Text, labelFontSize - 1)) / 2;

            currentPage.drawText(line1Text, {
              x: lx1,
              y: drawY + 16,
              size: labelFontSize,
              font: textFont,
              color: rgb(0.2, 0.2, 0.2),
          });

            currentPage.drawText(line2Text, {
              x: lx2,
              y: drawY + 6,
              size: labelFontSize - 1,
              font: textFont,
              color: rgb(0.5, 0.5, 0.5),
            });
        }
      }
    }

    const pdfBytes = await pdfDoc.save();
    const pdfBase64 = Buffer.from(pdfBytes).toString('base64');

    return res.json({ success: true, pdf_base64: pdfBase64, filename: `${event_id}_tickets_${Date.now()}.pdf`, tickets: ticketsToInsert });
  } catch (error) {
    console.error('Erreur generate-tickets:', error);
    return res.status(500).json({ success: false, error: 'Erreur interne lors de la génération des billets' });
  }
});

/**
 * GET /api/auth/my-event-application
 * Query: ?event_id=UUID
 * Retourne la candidature de l'utilisateur connecté pour un événement donné
 */
router.get('/my-event-application', async (req, res) => {
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
});

/**
 * GET /api/auth/my-applications
 * Retourne toutes les candidatures (event_staff) du profil authentifié
 */
router.get('/my-applications', async (req, res) => {
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
});

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

/**
 * GET /api/auth/tickets
 * Query: ?event_id=UUID
 * Retourne les tickets d'un événement
 */
router.get('/tickets', async (req, res) => {
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
});

/**
 * POST /api/auth/tickets/bulk-delete
 * Body: { ticket_ids: string[] }
 * Supprime plusieurs billets (admin requis)
 */
router.post('/tickets/bulk-delete', async (req, res) => {
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
});

/**
 * POST /api/auth/tickets/bulk-update-status
 * Body: { ticket_ids: string[], status: 'vendu' | 'valid' }
 */
router.post('/tickets/bulk-update-status', async (req, res) => {
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
});

/**
 * POST /api/auth/tickets/scan
 * Body: { ticket_id: string, event_id?: string, action: 'activate' | 'use' }
 * - activate : valid → vendu
 * - use      : vendu → utilise (refus si non activé)
 */
router.post('/tickets/scan', async (req, res) => {
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
});

/**
 * GET /api/auth/tickets/:id
 * Retourne les détails d'un billet spécifique
 */
router.get('/tickets/:id', async (req, res) => {
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
});


/**
 * DELETE /api/auth/tickets/:id
 * Supprime un billet (admin requis)
 */
router.delete('/tickets/:id', async (req, res) => {
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
});

/**
 * PUT /api/auth/tickets/:id
 * Met à jour un billet (admin requis)
 */
router.put('/tickets/:id', async (req, res) => {
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
});

/**
 * GET /api/auth/ticket-types?event_id=UUID
 * Retourne les ticket-types pour un événement (l'utilisateur doit être membre de l'organisation)
 */
router.get('/ticket-type', async (req, res) => {
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
});

/**
 * POST /api/auth/ticket-type
 * Body: { event_id: UUID, name: string, price?: number, currency?: string, benefits?: string[] }
 * Crée un nouveau ticket-type pour l'événement (admin requis)
 */
router.post('/ticket-type', async (req, res) => {
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
});

/**
 * PUT /api/auth/ticket-type/:id
 * Body: { name?: string, price?: number, currency?: string, benefits?: string[] }
 * Met à jour un ticket-type (admin requis)
 */
router.put('/ticket-type/:id', async (req, res) => {
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
});

/**
 * DELETE /api/auth/ticket-type/:id
 * Supprime un ticket-type (admin requis)
 */
router.delete('/ticket-type/:id', async (req, res) => {
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
});

/**
 * GET /api/auth/transactions-categories
 * Query: ?type=entree|sortie
 * Retourne les catégories disponibles pour le type demandé.
 */
router.get('/transactions-categories', async (req, res) => {
  try {
    const access_token = req.headers.authorization?.split('Bearer ')[1];
    const { type } = req.query;

    if (!access_token) return res.status(401).json({ success: false, error: 'Token requis' });

    const { data: authData, error: authError } = await supabase.auth.getUser(access_token);
    if (authError || !authData.user) return res.status(401).json({ success: false, error: 'Authentification invalide' });

    const db = supabase.createClientWithAuth(access_token);

    const query = db.from('transactions-categories').select('*').order('title', { ascending: true });
    if (type) query.eq('type', type);

    const { data: categories, error } = await query;

    if (error) {
      const fallbackCategories = [
        { title: 'Billetterie', pcg: '707', type: 'entree' },
        { title: 'Sponsor', pcg: '708', type: 'entree' },
        { title: 'Matériel', pcg: '606', type: 'sortie' },
        { title: 'Staff', pcg: '626', type: 'sortie' },
        { title: 'Logistique', pcg: '615', type: 'sortie' },
        { title: 'Divers', pcg: '627', type: 'sortie' },
      ];
      const filtered = fallbackCategories.filter((item) => !type || item.type === type);
      return res.json({ success: true, categories: filtered });
    }

    return res.json({ success: true, categories: categories || [] });
  } catch (error) {
    console.error('Erreur GET transactions-categories:', error);
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

/**
 * POST /api/auth/transactions-categories
 * Body: { title, type }
 */
router.post('/transactions-categories', async (req, res) => {
  try {
    const access_token = req.headers.authorization?.split('Bearer ')[1];
    const payload = req.body;

    if (!access_token) return res.status(401).json({ success: false, error: 'Token requis' });
    if (!payload?.title || !payload?.type) return res.status(400).json({ success: false, error: 'Titre et type requis' });

    const { data: authData, error: authError } = await supabase.auth.getUser(access_token);
    if (authError || !authData.user) return res.status(401).json({ success: false, error: 'Authentification invalide' });

    const db = supabase.createClientWithAuth(access_token);

    const insertPayload = {
      title: payload.title,
      pcg: payload.pcg || null,
      type: payload.type,
    };

    const { data: inserted, error: insertError } = await db.from('transactions-categories').insert(insertPayload).select().single();
    if (insertError) return res.status(400).json({ success: false, error: insertError.message });

    return res.status(201).json({ success: true, category: inserted });
  } catch (error) {
    console.error('Erreur POST transactions-categories:', error);
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

/**
 * GET /api/auth/transactions
 * Query: ?organization_id=UUID&event_id=UUID
 */
router.get('/transactions', async (req, res) => {
  try {
    const access_token = req.headers.authorization?.split('Bearer ')[1];
    const { organization_id, event_id } = req.query;

    if (!access_token) return res.status(401).json({ success: false, error: 'Token requis' });

    const { data: authData, error: authError } = await supabase.auth.getUser(access_token);
    if (authError || !authData.user) return res.status(401).json({ success: false, error: 'Authentification invalide' });

    const db = supabase.createClientWithAuth(access_token);

    let resolvedOrganizationId = organization_id || null;
    if (!resolvedOrganizationId) {
      const { data: membershipRows } = await db.from('organization_members').select('organization_id').eq('profile_id', authData.user.id).limit(1);
      if (membershipRows && membershipRows.length > 0) {
        resolvedOrganizationId = membershipRows[0].organization_id;
      }
    }

    if (!resolvedOrganizationId) return res.status(404).json({ success: false, error: 'Aucune organisation trouvée' });

    let query = db.from('transactions').select('*, category:"transactions-categories"(id,title,pcg,type)').eq('organization_id', resolvedOrganizationId).order('date', { ascending: false });
    if (event_id) query = query.eq('event_id', event_id);

    const { data: transactions, error: transactionsError } = await query;
    if (transactionsError) return res.status(400).json({ success: false, error: transactionsError.message });

    return res.json({ success: true, transactions: transactions || [] });
  } catch (error) {
    console.error('Erreur GET transactions:', error);
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});



0.
/**
 * POST /api/auth/transactions
 * Body: { event_id, date, title, description?, amount, category_id, type, organization_id? }
 */
router.post('/transactions', async (req, res) => {
  try {
    const access_token = req.headers.authorization?.split('Bearer ')[1];
    const payload = req.body;

    if (!access_token) return res.status(401).json({ success: false, error: 'Token requis' });
    if (!payload?.event_id || !payload?.title || typeof payload?.amount === 'undefined' || !payload?.category_id) {
      return res.status(400).json({ success: false, error: 'Événement, titre, catégorie et montant requis' });
    }

    const { data: authData, error: authError } = await supabase.auth.getUser(access_token);
    if (authError || !authData.user) return res.status(401).json({ success: false, error: 'Authentification invalide' });

    const db = supabase.createClientWithAuth(access_token);

    let resolvedOrganizationId = payload.organization_id || null;
    if (!resolvedOrganizationId) {
      const { data: membershipRows } = await db.from('organization_members').select('organization_id').eq('profile_id', authData.user.id).limit(1);
      if (membershipRows && membershipRows.length > 0) {
        resolvedOrganizationId = membershipRows[0].organization_id;
      }
    }

    if (!resolvedOrganizationId) return res.status(404).json({ success: false, error: 'Aucune organisation trouvée' });

    const normalizedType = String(payload.type || payload.kind || '').toLowerCase();
    const finalType = ['entree', 'recette', 'revenue', 'income'].includes(normalizedType)
      ? 'entree'
      : ['sortie', 'depense', 'expense', 'outgoing'].includes(normalizedType)
        ? 'sortie'
        : 'sortie';

    // To remain compatible with existing DB schema (may still use `label`), write label
    // and avoid sending unknown `title`/`description` columns which may not exist.
    const insertPayload = {
      event_id: payload.event_id,
      date: payload.date || new Date().toISOString().split('T')[0],
      label: payload.title || payload.description || payload.label || 'Sans libellé',
      // also store explicit description column when provided
      description: (payload.description !== undefined) ? payload.description : null,
      type: finalType,
      amount: Number(payload.amount),
      category: payload.category_id,
      created_by: authData.user.id,
      organization_id: resolvedOrganizationId,
    };

    const { data: inserted, error: insertError } = await db.from('transactions').insert(insertPayload).select().single();
    if (insertError) return res.status(400).json({ success: false, error: insertError.message });

    return res.status(201).json({ success: true, transaction: inserted });
  } catch (error) {
    console.error('Erreur POST transactions:', error);
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

/**
 * PUT /api/auth/transactions/:id
 * Body: { event_id?, date?, title?, description?, amount?, category_id?, type? }
 */
router.put('/transactions/:id', async (req, res) => {
  try {
    const access_token = req.headers.authorization?.split('Bearer ')[1];
    const id = req.params.id;
    const payload = req.body;

    if (!access_token) return res.status(401).json({ success: false, error: 'Token requis' });
    if (!id) return res.status(400).json({ success: false, error: 'ID requis' });

    const { data: authData, error: authError } = await supabase.auth.getUser(access_token);
    if (authError || !authData.user) return res.status(401).json({ success: false, error: 'Authentification invalide' });

    const db = supabase.createClientWithAuth(access_token);
    const normalizedPayload = { ...payload };
    if (payload.type) {
      const normalizedType = String(payload.type).toLowerCase();
      normalizedPayload.type = ['entree', 'recette', 'revenue', 'income'].includes(normalizedType)
        ? 'entree'
        : ['sortie', 'depense', 'expense', 'outgoing'].includes(normalizedType)
          ? 'sortie'
          : 'sortie';
    }
    if (payload.amount !== undefined) normalizedPayload.amount = Number(payload.amount);
    if (payload.category_id) normalizedPayload.category = payload.category_id;
    // Map incoming `title`/`description` to legacy `label` column for compatibility
    if (payload.title !== undefined) normalizedPayload.label = payload.title;
    else if (payload.description !== undefined) normalizedPayload.label = payload.description;
    else if (payload.label !== undefined) normalizedPayload.label = payload.label;

    // Preserve and set explicit `description` column when provided
    if (payload.description !== undefined) normalizedPayload.description = payload.description;

    // Remove client-side/transient keys that don't exist in DB schema
    delete normalizedPayload.title;
    delete normalizedPayload.category_id;
    delete normalizedPayload.categoryId;

    const { data: updated, error: updateError } = await db.from('transactions').update(normalizedPayload).eq('id', id).select().single();
    if (updateError) return res.status(400).json({ success: false, error: updateError.message });

    return res.json({ success: true, transaction: updated });
  } catch (error) {
    console.error('Erreur PUT transactions:', error);
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

/**
 * DELETE /api/auth/transactions/:id
 */
router.delete('/transactions/:id', async (req, res) => {
  try {
    const access_token = req.headers.authorization?.split('Bearer ')[1];
    const id = req.params.id;

    if (!access_token) return res.status(401).json({ success: false, error: 'Token requis' });
    if (!id) return res.status(400).json({ success: false, error: 'ID requis' });

    const { data: authData, error: authError } = await supabase.auth.getUser(access_token);
    if (authError || !authData.user) return res.status(401).json({ success: false, error: 'Authentification invalide' });

    const db = supabase.createClientWithAuth(access_token);
    const { error: deleteError } = await db.from('transactions').delete().eq('id', id);
    if (deleteError) return res.status(400).json({ success: false, error: deleteError.message });

    return res.json({ success: true });
  } catch (error) {
    console.error('Erreur DELETE transactions:', error);
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

// Debug route - returns authenticated user id and tests a per-user select on tickets
// GET /api/auth/whoami
router.get('/whoami', async (req, res) => {
  try {
    const access_token = req.headers.authorization?.split('Bearer ')[1];
    if (!access_token) return res.status(401).json({ success: false, error: 'Token requis' });

    const { data: authData, error: authError } = await supabase.auth.getUser(access_token);
    if (authError || !authData.user) return res.status(401).json({ success: false, error: 'Authentification invalide' });

    const db = supabase.createClientWithAuth(access_token);

    // Try a safe select on tickets to see if RLS allows it
    let canSelect = false;
    let sample = null;
    try {
      const { data: rows, error: ticketsErr } = await db.from('tickets').select('id,event_id,status').limit(1);
      if (ticketsErr) {
        console.warn('whoami: tickets select error:', ticketsErr.message || ticketsErr);
      } else if (rows && rows.length > 0) {
        canSelect = true;
        sample = rows[0];
      }
    } catch (e) {
      console.error('whoami: unexpected error during tickets select', e);
    }

    return res.json({ success: true, user: authData.user, canSelectTickets: canSelect, sampleTicket: sample });
  } catch (err) {
    console.error('whoami error:', err);
    return res.status(500).json({ success: false, error: 'Erreur interne' });
  }
});

// Dev-only debug route: return tickets and event_staff rows using admin client
// GET /api/auth/debug/tickets?event_id=<>&profile_id=<optional>
router.get('/debug/tickets', async (req, res) => {
  try {
    const access_token = req.headers.authorization?.split('Bearer ')[1];
    if (!access_token) return res.status(401).json({ success: false, error: 'Token requis' });

    const { data: authData, error: authError } = await supabase.auth.getUser(access_token);
    if (authError || !authData.user) return res.status(401).json({ success: false, error: 'Authentification invalide' });

    const event_id = req.query.event_id;
    const profile_id = req.query.profile_id || authData.user.id;

    const admin = supabase.admin;
    if (!admin) return res.status(500).json({ success: false, error: 'Admin client non configuré' });

    if (!event_id) return res.status(400).json({ success: false, error: 'event_id requis' });

    const { data: tickets, error: tErr } = await admin.from('tickets').select('id,event_id,status,sold_by,scanned_by,holder_name').eq('event_id', event_id).order('created_at', { ascending: false });
    if (tErr) console.error('debug tickets select error:', tErr);

    const { data: staffRows, error: sErr } = await admin.from('event_staff').select('id,event_id,profile_id,status').eq('event_id', event_id).eq('profile_id', profile_id);
    if (sErr) console.error('debug event_staff select error:', sErr);

    return res.json({ success: true, tickets: tickets || [], event_staff: staffRows || [] });
  } catch (err) {
    console.error('debug tickets route error:', err);
    return res.status(500).json({ success: false, error: 'Erreur interne' });
  }
});

/**
 * GET /api/auth/tasks
 * Query: ?event_id=UUID
 * Retourne les tâches d'un événement. Inclut le profil assigné si présent.
 */
router.get('/tasks', async (req, res) => {
  try {
    const access_token = req.headers.authorization?.split('Bearer ')[1];
    const event_id = req.query.event_id;

    if (!access_token) return res.status(401).json({ success: false, error: 'Token requis' });
    if (!event_id) return res.status(400).json({ success: false, error: 'event_id requis' });

    const { data: authData, error: authError } = await supabase.auth.getUser(access_token);
    if (authError || !authData.user) return res.status(401).json({ success: false, error: 'Authentification invalide' });

    const db = supabase.createClientWithAuth(access_token);

    // Retourner les tâches pour l'événement, joindre le profil assigné si disponible
    const { data: tasks, error: tasksError } = await db
      .from('tasks')
      .select('*, profiles:profiles(id,first_name,last_name)')
      .eq('event_id', event_id)
      .order('start_date', { ascending: true });

    if (tasksError) return res.status(400).json({ success: false, error: tasksError.message });

    return res.json({ success: true, tasks: tasks || [] });
  } catch (error) {
    console.error('Erreur GET tasks:', error);
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

/**
 * POST /api/auth/tasks
 * Body: { event_id, title, description, start_date, end_date, status, assigned_to }
 * Création de tâche (admin de l'organisation requis)
 */
router.post('/tasks', async (req, res) => {
  try {
    const access_token = req.headers.authorization?.split('Bearer ')[1];
    const payload = req.body;

    if (!access_token) return res.status(401).json({ success: false, error: 'Token requis' });
    if (!payload || !payload.event_id || !payload.title) return res.status(400).json({ success: false, error: 'Champs requis manquants' });

    const { data: authData, error: authError } = await supabase.auth.getUser(access_token);
    if (authError || !authData.user) return res.status(401).json({ success: false, error: 'Authentification invalide' });

    const db = supabase.createClientWithAuth(access_token);

    // Vérifier que l'utilisateur est admin de l'organisation de l'événement
    const { data: eventRows, error: eventError } = await db.from('events').select('*').eq('id', payload.event_id).limit(1);
    if (eventError) return res.status(400).json({ success: false, error: eventError.message });
    if (!eventRows || eventRows.length === 0) return res.status(404).json({ success: false, error: 'Événement introuvable' });
    const event = eventRows[0];

    const { data: memberRows } = await db.from('organization_members').select('*').eq('organization_id', event.organization_id).eq('profile_id', authData.user.id).limit(1);
    if (!memberRows || memberRows.length === 0 || memberRows[0].role !== 'admin') return res.status(403).json({ success: false, error: 'Accès refusé: administrateur requis' });

    const insertPayload = {
      event_id: payload.event_id,
      title: payload.title,
      description: payload.description || null,
      start_date: payload.start_date,
      end_date: payload.end_date,
      status: payload.status || 'Pas commencé',
      assigned_to: payload.assigned_to || null,
    };

    const { data: inserted, error: insertError } = await db.from('tasks').insert(insertPayload).select().single();
    if (insertError) return res.status(400).json({ success: false, error: insertError.message });

    return res.status(201).json({ success: true, task: inserted });
  } catch (error) {
    console.error('Erreur POST tasks:', error);
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

/**
 * PUT /api/auth/tasks/:id
 * Admin : mise à jour complète. Membre assigné (non-admin) : statut uniquement (RLS).
 */
router.put('/tasks/:id', async (req, res) => {
  try {
    const access_token = req.headers.authorization?.split('Bearer ')[1];
    const id = req.params.id;
    const payload = req.body;

    if (!access_token) return res.status(401).json({ success: false, error: 'Token requis' });
    if (!id) return res.status(400).json({ success: false, error: 'ID requis' });

    const { data: authData, error: authError } = await supabase.auth.getUser(access_token);
    if (authError || !authData.user) return res.status(401).json({ success: false, error: 'Authentification invalide' });

    const db = supabase.createClientWithAuth(access_token);

    const { data: rows, error: fetchErr } = await db.from('tasks').select('*').eq('id', id).limit(1);
    if (fetchErr) return res.status(400).json({ success: false, error: fetchErr.message });
    if (!rows || rows.length === 0) return res.status(404).json({ success: false, error: 'Tâche introuvable' });
    const task = rows[0];

    const { data: eventRows, error: eventError } = await db.from('events').select('*').eq('id', task.event_id).limit(1);
    if (eventError) return res.status(400).json({ success: false, error: eventError.message });
    if (!eventRows || eventRows.length === 0) return res.status(404).json({ success: false, error: 'Événement introuvable' });
    const event = eventRows[0];

    const { data: memberRows } = await db.from('organization_members').select('*').eq('organization_id', event.organization_id).eq('profile_id', authData.user.id).limit(1);
    if (!memberRows || memberRows.length === 0) {
      return res.status(403).json({ success: false, error: 'Accès refusé: membre de l\'organisation requis' });
    }

    const isAdmin = memberRows[0].role === 'admin';

    if (isAdmin) {
      const { data: updated, error: updateError } = await db.from('tasks').update(payload).eq('id', id).select().single();
      if (updateError) return res.status(400).json({ success: false, error: updateError.message });
      return res.json({ success: true, task: updated });
    }

    if (task.assigned_to !== authData.user.id) {
      return res.status(403).json({ success: false, error: 'Accès refusé: vous ne pouvez modifier que vos propres tâches.' });
    }
    if (!payload?.status || typeof payload.status !== 'string') {
      return res.status(400).json({ success: false, error: 'Seul le statut peut être modifié.' });
    }
    const forbiddenFields = ['title', 'description', 'start_date', 'end_date', 'assigned_to', 'event_id', 'required_skills'];
    const hasForbiddenChange = forbiddenFields.some((field) => payload[field] !== undefined && payload[field] !== task[field]);
    if (hasForbiddenChange) {
      return res.status(403).json({ success: false, error: 'Seul le statut peut être modifié.' });
    }

    const { error: rpcError } = await db.rpc('update_task_status_secure', {
      target_task_id: id,
      new_status: payload.status,
    });
    if (rpcError) return res.status(400).json({ success: false, error: rpcError.message });

    const { data: updated, error: fetchUpdatedErr } = await db.from('tasks').select('*').eq('id', id).single();
    if (fetchUpdatedErr) return res.status(400).json({ success: false, error: fetchUpdatedErr.message });

    return res.json({ success: true, task: updated });
  } catch (error) {
    console.error('Erreur PUT tasks:', error);
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

/**
 * DELETE /api/auth/tasks/:id
 * Supprime une tâche (admin requis)
 */
router.delete('/tasks/:id', async (req, res) => {
  try {
    const access_token = req.headers.authorization?.split('Bearer ')[1];
    const id = req.params.id;

    if (!access_token) return res.status(401).json({ success: false, error: 'Token requis' });
    if (!id) return res.status(400).json({ success: false, error: 'ID requis' });

    const { data: authData, error: authError } = await supabase.auth.getUser(access_token);
    if (authError || !authData.user) return res.status(401).json({ success: false, error: 'Authentification invalide' });

    const db = supabase.createClientWithAuth(access_token);

    // fetch task to get event_id
    const { data: rows, error: fetchErr } = await db.from('tasks').select('*').eq('id', id).limit(1);
    if (fetchErr) return res.status(400).json({ success: false, error: fetchErr.message });
    if (!rows || rows.length === 0) return res.status(404).json({ success: false, error: 'Tâche introuvable' });
    const task = rows[0];

    const { data: eventRows, error: eventError } = await db.from('events').select('*').eq('id', task.event_id).limit(1);
    if (eventError) return res.status(400).json({ success: false, error: eventError.message });
    if (!eventRows || eventRows.length === 0) return res.status(404).json({ success: false, error: 'Événement introuvable' });
    const event = eventRows[0];

    const { data: memberRows } = await db.from('organization_members').select('*').eq('organization_id', event.organization_id).eq('profile_id', authData.user.id).limit(1);
    if (!memberRows || memberRows.length === 0 || memberRows[0].role !== 'admin') return res.status(403).json({ success: false, error: 'Accès refusé: administrateur requis' });

    const { error: deleteError } = await db.from('tasks').delete().eq('id', id);
    if (deleteError) return res.status(400).json({ success: false, error: deleteError.message });

    return res.json({ success: true });
  } catch (error) {
    console.error('Erreur DELETE tasks:', error);
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

/**
 * PUT /api/auth/events/:id/ticket-types-active
 * Met à jour l'état is_active des types de billets selon les billets visibles
 * Body: { activeTicketNames: string[] }
 */
router.put('/events/:id/ticket-types-active', async (req, res) => {
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
});

/**
 * GET /api/auth/payment-methods
 * Liste publique des moyens de paiement actifs (Mobile Money).
 */
router.get('/payment-methods', async (req, res) => {
  try {
    const admin = supabase.admin || supabase;
    if (!admin) return res.status(500).json({ success: false, error: 'Admin client non configuré' });

    const { data, error } = await admin
      .from('payment_method')
      .select('id, Operateur, numero, account_holder, is_active')
      .eq('is_active', true)
      .order('id', { ascending: true });

    if (error) return res.status(400).json({ success: false, error: error.message });

    return res.json({ success: true, payment_methods: data || [] });
  } catch (error) {
    console.error('Erreur GET payment-methods:', error);
    return res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

/**
 * POST /api/auth/events/:id/purchase-ticket
 * Achat public de billet(s) via Mobile Money (sans authentification).
 * Body: { ticket_type_id, quantity?, buyer_name, buyer_phone, buyer_email?, buyer_address?, transaction_id, total_amount, payment_method }
 */
router.post('/events/:id/purchase-ticket', async (req, res) => {
  const { randomUUID } = require('crypto');

  try {
    const { id: eventId } = req.params;
    const {
      ticket_type_id,
      quantity = 1,
      buyer_name,
      buyer_phone,
      buyer_email,
      buyer_address,
      transaction_id,
      total_amount,
      payment_method,
    } = req.body || {};

    if (!eventId) return res.status(400).json({ success: false, error: 'event_id requis' });
    if (!ticket_type_id) return res.status(400).json({ success: false, error: 'ticket_type_id requis' });
    if (!buyer_name || typeof buyer_name !== 'string' || !buyer_name.trim()) {
      return res.status(400).json({ success: false, error: 'buyer_name requis' });
    }
    if (!buyer_phone || typeof buyer_phone !== 'string' || !buyer_phone.trim()) {
      return res.status(400).json({ success: false, error: 'buyer_phone requis' });
    }
    if (!payment_method) {
      return res.status(400).json({ success: false, error: 'payment_method requis' });
    }
    if (!transaction_id || typeof transaction_id !== 'string' || !transaction_id.trim()) {
      return res.status(400).json({ success: false, error: 'transaction_id requis' });
    }

    const normalizedTransactionId = transaction_id.trim().toUpperCase();
    const ticketQuantity = Math.max(1, Math.min(20, Number(quantity) || 1));

    const admin = supabase.admin || supabase;
    if (!admin) return res.status(500).json({ success: false, error: 'Admin client non configuré' });

    const { data: paymentMethodRows, error: paymentMethodError } = await admin
      .from('payment_method')
      .select('id, Operateur, numero, is_active')
      .eq('id', payment_method)
      .eq('is_active', true)
      .limit(1);

    if (paymentMethodError) return res.status(400).json({ success: false, error: paymentMethodError.message });
    if (!paymentMethodRows || paymentMethodRows.length === 0) {
      return res.status(400).json({ success: false, error: 'Moyen de paiement invalide ou inactif' });
    }

    const { data: eventRows, error: eventError } = await admin
      .from('events')
      .select('id, title')
      .eq('id', eventId)
      .limit(1);

    if (eventError) return res.status(400).json({ success: false, error: eventError.message });
    if (!eventRows || eventRows.length === 0) {
      return res.status(404).json({ success: false, error: 'Événement introuvable' });
    }

    const { data: ticketTypeRows, error: ticketTypeError } = await admin
      .from('ticket_type')
      .select('*')
      .eq('id', ticket_type_id)
      .eq('event_id', eventId)
      .eq('is_active', true)
      .limit(1);

    if (ticketTypeError) return res.status(400).json({ success: false, error: ticketTypeError.message });
    if (!ticketTypeRows || ticketTypeRows.length === 0) {
      return res.status(404).json({ success: false, error: 'Type de billet introuvable ou inactif' });
    }

    const ticketType = ticketTypeRows[0];
    const unitPrice = Number(ticketType.price) || 0;
    const expectedTotal = unitPrice * ticketQuantity;
    const submittedTotal = Number(total_amount);

    if (!Number.isFinite(submittedTotal) || Math.abs(submittedTotal - expectedTotal) > 0.01) {
      return res.status(400).json({ success: false, error: 'Montant total invalide' });
    }

    const { data: existingOrder, error: existingOrderError } = await admin
      .from('orders')
      .select('id')
      .eq('transaction_id', normalizedTransactionId)
      .maybeSingle();

    if (existingOrderError) return res.status(400).json({ success: false, error: existingOrderError.message });
    if (existingOrder) {
      return res.status(409).json({ success: false, error: 'Cette référence de transaction est déjà utilisée' });
    }

    let startNumber = 1;
    const ticketTypeName = ticketType.name || 'Billet';
    try {
      const { data: maxRow } = await admin
        .from('tickets')
        .select('number')
        .eq('event_id', eventId)
        .eq('ticket_type', ticketTypeName)
        .order('number', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (maxRow && typeof maxRow.number === 'number') {
        startNumber = Number(maxRow.number) + 1;
      }
    } catch (e) {
      console.warn('Could not determine max ticket number, default to 1', e);
    }

    const ticketsToInsert = [];
    for (let i = 0; i < ticketQuantity; i++) {
      ticketsToInsert.push({
        id: randomUUID(),
        event_id: eventId,
        ticket_type: ticketTypeName,
        price: unitPrice,
        status: 'valid',
        holder_name: buyer_name.trim(),
        sold_by: null,
        number: startNumber + i,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    }

    const { data: insertedTickets, error: ticketsInsertError } = await admin
      .from('tickets')
      .insert(ticketsToInsert)
      .select('id, number, ticket_type');

    if (ticketsInsertError || !insertedTickets || insertedTickets.length === 0) {
      console.error('Erreur insertion tickets achat en ligne:', ticketsInsertError);
      return res.status(500).json({ success: false, error: 'Erreur lors de la création des billets' });
    }

    const ticketIds = insertedTickets.map((ticket) => ticket.id);

    const { data: insertedOrder, error: orderInsertError } = await admin
      .from('orders')
      .insert({
        buyer_name: buyer_name.trim(),
        buyer_phone: buyer_phone.trim(),
        buyer_email: buyer_email?.trim() || null,
        buyer_address: buyer_address?.trim() || null,
        transaction_id: normalizedTransactionId,
        total_amount: expectedTotal,
        payment_status: 'pending',
        payment_method: Number(payment_method),
      })
      .select('id')
      .single();

    if (orderInsertError || !insertedOrder) {
      console.error('Erreur insertion order:', orderInsertError);
      await admin.from('tickets').delete().in('id', ticketIds);
      if (orderInsertError?.code === '23505') {
        return res.status(409).json({ success: false, error: 'Cette référence de transaction est déjà utilisée' });
      }
      return res.status(500).json({ success: false, error: 'Erreur lors de la création de la commande' });
    }

    const orderItemsPayload = ticketIds.map((ticketId) => ({
      order_id: insertedOrder.id,
      ticket_id: ticketId,
    }));

    const { error: orderItemsError } = await admin.from('order_items').insert(orderItemsPayload);

    if (orderItemsError) {
      console.error('Erreur insertion order_items:', orderItemsError);
      await admin.from('orders').delete().eq('id', insertedOrder.id);
      await admin.from('tickets').delete().in('id', ticketIds);
      return res.status(500).json({ success: false, error: 'Erreur lors de la liaison commande / billets' });
    }

    return res.status(201).json({
      success: true,
      order_id: insertedOrder.id,
      ticket_ids: ticketIds,
      tickets: insertedTickets.map((ticket) => ({
        id: ticket.id,
        number: ticket.number,
        ticket_type: ticket.ticket_type,
      })),
      message: 'Commande enregistrée avec succès',
    });
  } catch (error) {
    console.error('Erreur POST purchase-ticket:', error);
    return res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

/**
 * GET /api/auth/admin/organizations/pending
 * Liste les organisations en attente (admin plateforme uniquement)
 */
router.get('/admin/organizations/pending', async (req, res) => {
  try {
    const access_token = req.headers.authorization?.split('Bearer ')[1];
    if (!access_token) return res.status(401).json({ success: false, error: 'Token requis' });

    const { data: authData, error: authError } = await supabase.auth.getUser(access_token);
    if (authError || !authData.user) {
      return res.status(401).json({ success: false, error: 'Authentification invalide' });
    }

    if (!isPlatformAdmin(authData.user.email)) {
      return res.status(403).json({ success: false, error: 'Accès refusé: administrateur plateforme requis' });
    }

    const dbAdmin = supabase.admin || supabase;
    const { data: organizations, error } = await dbAdmin
      .from('organizations')
      .select('id, name, code, status, created_at')
      .eq('status', 'pending')
      .order('created_at', { ascending: true });

    if (error) return res.status(400).json({ success: false, error: error.message });

    return res.json({ success: true, organizations: organizations || [] });
  } catch (error) {
    console.error('Erreur admin organizations pending:', error);
    return res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

/**
 * PATCH /api/auth/admin/organizations/:id/status
 * Valide ou refuse une organisation (admin plateforme uniquement)
 * body: { status: 'active' | 'rejected' }
 */
router.patch('/admin/organizations/:id/status', async (req, res) => {
  try {
    const access_token = req.headers.authorization?.split('Bearer ')[1];
    const { id } = req.params;
    const { status } = req.body;

    if (!access_token) return res.status(401).json({ success: false, error: 'Token requis' });
    if (!['active', 'rejected'].includes(status)) {
      return res.status(400).json({ success: false, error: 'status doit être active ou rejected' });
    }

    const { data: authData, error: authError } = await supabase.auth.getUser(access_token);
    if (authError || !authData.user) {
      return res.status(401).json({ success: false, error: 'Authentification invalide' });
    }

    if (!isPlatformAdmin(authData.user.email)) {
      return res.status(403).json({ success: false, error: 'Accès refusé: administrateur plateforme requis' });
    }

    const dbAdmin = supabase.admin || supabase;
    const { data: org, error } = await dbAdmin
      .from('organizations')
      .update({ status })
      .eq('id', id)
      .eq('status', 'pending')
      .select('id, name, code, status, created_at')
      .maybeSingle();

    if (error) return res.status(400).json({ success: false, error: error.message });
    if (!org) {
      return res.status(404).json({ success: false, error: 'Organisation introuvable ou déjà traitée' });
    }

    return res.json({ success: true, organization: org });
  } catch (error) {
    console.error('Erreur admin organization status:', error);
    return res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

/**
 * GET /api/auth/events/:eventId/orders
 * Liste les commandes en ligne liées à un événement + KPIs (admin requis).
 * Query: ?payment_status=pending|validated|rejected|all (default all)
 */
router.get('/events/:eventId/orders', async (req, res) => {
  try {
    const access_token = req.headers.authorization?.split('Bearer ')[1];
    const { eventId } = req.params;
    const paymentStatusFilter = String(req.query.payment_status || 'all').toLowerCase();

    if (!access_token) return res.status(401).json({ success: false, error: 'Token requis' });
    if (!eventId) return res.status(400).json({ success: false, error: 'event_id requis' });

    const { data: authData, error: authError } = await supabase.auth.getUser(access_token);
    if (authError || !authData.user) {
      return res.status(401).json({ success: false, error: 'Authentification invalide' });
    }

    const db = supabase.createClientWithAuth(access_token);
    const admin = supabase.admin || supabase;

    const { data: eventData, error: eventError } = await db
      .from('events')
      .select('id, organization_id, title')
      .eq('id', eventId)
      .single();

    if (eventError || !eventData) {
      return res.status(404).json({ success: false, error: 'Événement introuvable' });
    }

    const { data: memberRows } = await db
      .from('organization_members')
      .select('role')
      .eq('organization_id', eventData.organization_id)
      .eq('profile_id', authData.user.id)
      .limit(1);

    if (!memberRows?.length || memberRows[0].role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Accès refusé: administrateur requis' });
    }

    const { data: eventTickets, error: ticketsError } = await admin
      .from('tickets')
      .select('id, number, ticket_type, status, holder_name')
      .eq('event_id', eventId);

    if (ticketsError) {
      return res.status(400).json({ success: false, error: ticketsError.message });
    }

    const ticketMap = new Map((eventTickets || []).map((ticket) => [ticket.id, ticket]));
    const eventTicketIds = [...ticketMap.keys()];

    if (eventTicketIds.length === 0) {
      return res.json({
        success: true,
        orders: [],
        kpis: {
          total_orders: 0,
          pending_orders: 0,
          validated_orders: 0,
          rejected_orders: 0,
          pending_amount: 0,
          validated_revenue: 0,
          pending_tickets: 0,
          validated_tickets: 0,
        },
      });
    }

    const { data: orderItems, error: orderItemsError } = await admin
      .from('order_items')
      .select('order_id, ticket_id')
      .in('ticket_id', eventTicketIds);

    if (orderItemsError) {
      return res.status(400).json({ success: false, error: orderItemsError.message });
    }

    const orderIds = [...new Set((orderItems || []).map((item) => item.order_id))];

    if (orderIds.length === 0) {
      return res.json({
        success: true,
        orders: [],
        kpis: {
          total_orders: 0,
          pending_orders: 0,
          validated_orders: 0,
          rejected_orders: 0,
          pending_amount: 0,
          validated_revenue: 0,
          pending_tickets: 0,
          validated_tickets: 0,
        },
      });
    }

    const { data: orders, error: ordersError } = await admin
      .from('orders')
      .select(`
        id,
        buyer_name,
        buyer_phone,
        buyer_email,
        buyer_address,
        transaction_id,
        total_amount,
        payment_status,
        payment_method,
        created_at
      `)
      .in('id', orderIds)
      .order('created_at', { ascending: false });

    if (ordersError) {
      return res.status(400).json({ success: false, error: ordersError.message });
    }

    const paymentMethodIds = [
      ...new Set((orders || []).map((order) => order.payment_method).filter(Boolean)),
    ];

    let paymentMethodMap = new Map();
    if (paymentMethodIds.length > 0) {
      const { data: paymentMethods } = await admin
        .from('payment_method')
        .select('id, Operateur, numero')
        .in('id', paymentMethodIds);
      paymentMethodMap = new Map((paymentMethods || []).map((method) => [method.id, method]));
    }

    const itemsByOrder = new Map();
    for (const item of orderItems || []) {
      if (!itemsByOrder.has(item.order_id)) itemsByOrder.set(item.order_id, []);
      const ticket = ticketMap.get(item.ticket_id);
      if (ticket) {
        itemsByOrder.get(item.order_id).push({
          id: ticket.id,
          number: ticket.number,
          ticket_type: ticket.ticket_type,
          status: ticket.status,
          holder_name: ticket.holder_name,
        });
      }
    }

    const enrichedOrders = (orders || []).map((order) => ({
      ...order,
      payment_method: paymentMethodMap.get(order.payment_method) || null,
      tickets: itemsByOrder.get(order.id) || [],
      ticket_count: (itemsByOrder.get(order.id) || []).length,
    }));

    const kpis = enrichedOrders.reduce(
      (acc, order) => {
        acc.total_orders += 1;
        const amount = Number(order.total_amount) || 0;
        const ticketCount = order.ticket_count || 0;

        if (order.payment_status === 'pending') {
          acc.pending_orders += 1;
          acc.pending_amount += amount;
          acc.pending_tickets += ticketCount;
        } else if (order.payment_status === 'validated') {
          acc.validated_orders += 1;
          acc.validated_revenue += amount;
          acc.validated_tickets += ticketCount;
        } else if (order.payment_status === 'rejected') {
          acc.rejected_orders += 1;
        }

        return acc;
      },
      {
        total_orders: 0,
        pending_orders: 0,
        validated_orders: 0,
        rejected_orders: 0,
        pending_amount: 0,
        validated_revenue: 0,
        pending_tickets: 0,
        validated_tickets: 0,
      }
    );

    const filteredOrders =
      paymentStatusFilter === 'all'
        ? enrichedOrders
        : enrichedOrders.filter((order) => order.payment_status === paymentStatusFilter);

    return res.json({ success: true, orders: filteredOrders, kpis });
  } catch (error) {
    console.error('Erreur GET event orders:', error);
    return res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

async function assertOrderAdminAccess(db, admin, authUserId, orderId) {
  const { data: orderItems, error: itemsError } = await admin
    .from('order_items')
    .select('ticket_id, tickets(id, event_id)')
    .eq('order_id', orderId);

  if (itemsError) throw new Error(itemsError.message);
  if (!orderItems?.length) throw new Error('Aucun billet associé à cette commande');

  const eventIds = [...new Set(orderItems.map((item) => item.tickets?.event_id).filter(Boolean))];
  if (eventIds.length !== 1) throw new Error('Commande invalide: billets multi-événements');

  const { data: eventData, error: eventError } = await db
    .from('events')
    .select('organization_id')
    .eq('id', eventIds[0])
    .single();

  if (eventError || !eventData) throw new Error('Événement introuvable');

  const { data: memberRows } = await db
    .from('organization_members')
    .select('role')
    .eq('organization_id', eventData.organization_id)
    .eq('profile_id', authUserId)
    .limit(1);

  if (!memberRows?.length || memberRows[0].role !== 'admin') {
    throw new Error('Accès refusé: administrateur requis');
  }

  return { ticketIds: orderItems.map((item) => item.ticket_id) };
}

async function devalidateSingleOrder(db, admin, authUserId, orderId) {
  const { data: order, error: orderError } = await admin
    .from('orders')
    .select('id, payment_status')
    .eq('id', orderId)
    .single();

  if (orderError || !order) throw new Error('Commande introuvable');
  if (order.payment_status !== 'validated') {
    throw new Error('Seules les commandes validées peuvent être dévalidées');
  }

  const { ticketIds } = await assertOrderAdminAccess(db, admin, authUserId, orderId);

  const { data: tickets, error: ticketsError } = await admin
    .from('tickets')
    .select('id, status')
    .in('id', ticketIds);

  if (ticketsError) throw new Error(ticketsError.message);

  const blocked = (tickets || []).filter((ticket) =>
    ['utilisé', 'utilise', 'used'].includes(String(ticket.status || '').toLowerCase())
  );
  if (blocked.length > 0) {
    throw new Error('Impossible de dévalider: des billets ont déjà été scannés');
  }

  const now = new Date().toISOString();

  const { error: orderUpdateError } = await admin
    .from('orders')
    .update({ payment_status: 'pending' })
    .eq('id', orderId);

  if (orderUpdateError) throw new Error(orderUpdateError.message);

  const { error: ticketsUpdateError } = await admin
    .from('tickets')
    .update(ticketValidResetPayload(now))
    .in('id', ticketIds);

  if (ticketsUpdateError) {
    await admin.from('orders').update({ payment_status: 'validated' }).eq('id', orderId);
    throw new Error(ticketsUpdateError.message);
  }

  return { orderId, ticketIds };
}

/**
 * POST /api/auth/orders/bulk-devalidate
 * Body: { order_ids: string[] }
 */
router.post('/orders/bulk-devalidate', async (req, res) => {
  try {
    const access_token = req.headers.authorization?.split('Bearer ')[1];
    const { order_ids } = req.body;

    if (!access_token) return res.status(401).json({ success: false, error: 'Token requis' });
    if (!Array.isArray(order_ids) || order_ids.length === 0) {
      return res.status(400).json({ success: false, error: 'order_ids requis (tableau non vide)' });
    }

    const { data: authData, error: authError } = await supabase.auth.getUser(access_token);
    if (authError || !authData.user) {
      return res.status(401).json({ success: false, error: 'Authentification invalide' });
    }

    const db = supabase.createClientWithAuth(access_token);
    const admin = supabase.admin || supabase;
    let devalidatedCount = 0;
    const errors = [];

    for (const orderId of order_ids) {
      try {
        await devalidateSingleOrder(db, admin, authData.user.id, orderId);
        devalidatedCount += 1;
      } catch (err) {
        errors.push({ order_id: orderId, error: err.message || 'Erreur de dévalidation' });
      }
    }

    return res.json({
      success: devalidatedCount > 0,
      devalidated_count: devalidatedCount,
      errors,
      message: `${devalidatedCount} commande(s) dévalidée(s) avec succès.`,
    });
  } catch (error) {
    console.error('Erreur POST orders/bulk-devalidate:', error);
    return res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

/**
 * POST /api/auth/orders/bulk-validate
 * Body: { order_ids: string[] }
 */
router.post('/orders/bulk-validate', async (req, res) => {
  try {
    const access_token = req.headers.authorization?.split('Bearer ')[1];
    const { order_ids } = req.body;

    if (!access_token) return res.status(401).json({ success: false, error: 'Token requis' });
    if (!Array.isArray(order_ids) || order_ids.length === 0) {
      return res.status(400).json({ success: false, error: 'order_ids requis (tableau non vide)' });
    }

    const { data: authData, error: authError } = await supabase.auth.getUser(access_token);
    if (authError || !authData.user) {
      return res.status(401).json({ success: false, error: 'Authentification invalide' });
    }

    const db = supabase.createClientWithAuth(access_token);
    const admin = supabase.admin || supabase;
    const now = new Date().toISOString();
    let validatedCount = 0;
    const errors = [];

    for (const orderId of order_ids) {
      try {
        const { data: order, error: orderError } = await admin
          .from('orders')
          .select('id, payment_status')
          .eq('id', orderId)
          .single();

        if (orderError || !order) {
          errors.push({ order_id: orderId, error: 'Commande introuvable' });
          continue;
        }
        if (order.payment_status !== 'pending') {
          errors.push({ order_id: orderId, error: 'Commande déjà traitée' });
          continue;
        }

        const { ticketIds } = await assertOrderAdminAccess(db, admin, authData.user.id, orderId);

        const { error: orderUpdateError } = await admin
          .from('orders')
          .update({ payment_status: 'validated' })
          .eq('id', orderId);

        if (orderUpdateError) {
          errors.push({ order_id: orderId, error: orderUpdateError.message });
          continue;
        }

        const { error: ticketsUpdateError } = await admin
          .from('tickets')
          .update({ status: 'vendu', sold_by: authData.user.id, updated_at: now })
          .in('id', ticketIds);

        if (ticketsUpdateError) {
          await admin.from('orders').update({ payment_status: 'pending' }).eq('id', orderId);
          errors.push({ order_id: orderId, error: ticketsUpdateError.message });
          continue;
        }

        validatedCount += 1;
      } catch (err) {
        errors.push({ order_id: orderId, error: err.message || 'Erreur de validation' });
      }
    }

    return res.json({
      success: validatedCount > 0,
      validated_count: validatedCount,
      errors,
      message: `${validatedCount} commande(s) validée(s) avec succès.`,
    });
  } catch (error) {
    console.error('Erreur POST orders/bulk-validate:', error);
    return res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

/**
 * POST /api/auth/orders/bulk-delete
 * Body: { order_ids: string[] }
 */
router.post('/orders/bulk-delete', async (req, res) => {
  try {
    const access_token = req.headers.authorization?.split('Bearer ')[1];
    const { order_ids } = req.body;

    if (!access_token) return res.status(401).json({ success: false, error: 'Token requis' });
    if (!Array.isArray(order_ids) || order_ids.length === 0) {
      return res.status(400).json({ success: false, error: 'order_ids requis (tableau non vide)' });
    }

    const { data: authData, error: authError } = await supabase.auth.getUser(access_token);
    if (authError || !authData.user) {
      return res.status(401).json({ success: false, error: 'Authentification invalide' });
    }

    const db = supabase.createClientWithAuth(access_token);
    const admin = supabase.admin || supabase;
    let deletedCount = 0;
    const errors = [];

    for (const orderId of order_ids) {
      try {
        const { data: order, error: orderError } = await admin
          .from('orders')
          .select('id')
          .eq('id', orderId)
          .single();

        if (orderError || !order) {
          errors.push({ order_id: orderId, error: 'Commande introuvable' });
          continue;
        }

        const { ticketIds } = await assertOrderAdminAccess(db, admin, authData.user.id, orderId);

        const { error: deleteOrderError } = await admin.from('orders').delete().eq('id', orderId);
        if (deleteOrderError) {
          errors.push({ order_id: orderId, error: deleteOrderError.message });
          continue;
        }

        if (ticketIds.length > 0) {
          const { error: deleteTicketsError } = await admin.from('tickets').delete().in('id', ticketIds);
          if (deleteTicketsError) {
            errors.push({ order_id: orderId, error: deleteTicketsError.message });
            continue;
          }
        }

        deletedCount += 1;
      } catch (err) {
        errors.push({ order_id: orderId, error: err.message || 'Erreur de suppression' });
      }
    }

    return res.json({
      success: deletedCount > 0,
      deleted_count: deletedCount,
      errors,
      message: `${deletedCount} commande(s) supprimée(s) avec succès.`,
    });
  } catch (error) {
    console.error('Erreur POST orders/bulk-delete:', error);
    return res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

/**
 * POST /api/auth/orders/:id/validate
 * Valide une commande en ligne : payment_status → validated, billets → vendu + sold_by admin.
 */
router.post('/orders/:id/validate', async (req, res) => {
  try {
    const access_token = req.headers.authorization?.split('Bearer ')[1];
    const { id: orderId } = req.params;

    if (!access_token) return res.status(401).json({ success: false, error: 'Token requis' });
    if (!orderId) return res.status(400).json({ success: false, error: 'order_id requis' });

    const { data: authData, error: authError } = await supabase.auth.getUser(access_token);
    if (authError || !authData.user) {
      return res.status(401).json({ success: false, error: 'Authentification invalide' });
    }

    const db = supabase.createClientWithAuth(access_token);
    const admin = supabase.admin || supabase;

    const { data: order, error: orderError } = await admin
      .from('orders')
      .select('id, payment_status, total_amount')
      .eq('id', orderId)
      .single();

    if (orderError || !order) {
      return res.status(404).json({ success: false, error: 'Commande introuvable' });
    }

    if (order.payment_status !== 'pending') {
      return res.status(400).json({ success: false, error: 'Cette commande a déjà été traitée' });
    }

    const { data: orderItems, error: itemsError } = await admin
      .from('order_items')
      .select('ticket_id, tickets(id, event_id)')
      .eq('order_id', orderId);

    if (itemsError) {
      return res.status(400).json({ success: false, error: itemsError.message });
    }

    if (!orderItems?.length) {
      return res.status(400).json({ success: false, error: 'Aucun billet associé à cette commande' });
    }

    const eventIds = [
      ...new Set(
        orderItems
          .map((item) => item.tickets?.event_id)
          .filter(Boolean)
      ),
    ];

    if (eventIds.length !== 1) {
      return res.status(400).json({ success: false, error: 'Commande invalide: billets multi-événements' });
    }

    const eventId = eventIds[0];

    const { data: eventData, error: eventError } = await db
      .from('events')
      .select('organization_id')
      .eq('id', eventId)
      .single();

    if (eventError || !eventData) {
      return res.status(404).json({ success: false, error: 'Événement introuvable' });
    }

    const { data: memberRows } = await db
      .from('organization_members')
      .select('role')
      .eq('organization_id', eventData.organization_id)
      .eq('profile_id', authData.user.id)
      .limit(1);

    if (!memberRows?.length || memberRows[0].role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Accès refusé: administrateur requis' });
    }

    const ticketIds = orderItems.map((item) => item.ticket_id);
    const now = new Date().toISOString();

    const { error: orderUpdateError } = await admin
      .from('orders')
      .update({ payment_status: 'validated' })
      .eq('id', orderId);

    if (orderUpdateError) {
      return res.status(400).json({ success: false, error: orderUpdateError.message });
    }

    const { data: updatedTickets, error: ticketsUpdateError } = await admin
      .from('tickets')
      .update({
        status: 'vendu',
        sold_by: authData.user.id,
        updated_at: now,
      })
      .in('id', ticketIds)
      .select('id, number, ticket_type, status, sold_by');

    if (ticketsUpdateError) {
      await admin.from('orders').update({ payment_status: 'pending' }).eq('id', orderId);
      return res.status(400).json({ success: false, error: ticketsUpdateError.message });
    }

    return res.json({
      success: true,
      order_id: orderId,
      tickets: updatedTickets,
      message: 'Paiement validé et billets marqués comme vendus',
    });
  } catch (error) {
    console.error('Erreur POST validate order:', error);
    return res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

/**
 * POST /api/auth/orders/:id/devalidate
 * Annule la validation d'une commande : payment_status → pending, billets → valide.
 */
router.post('/orders/:id/devalidate', async (req, res) => {
  try {
    const access_token = req.headers.authorization?.split('Bearer ')[1];
    const { id: orderId } = req.params;

    if (!access_token) return res.status(401).json({ success: false, error: 'Token requis' });
    if (!orderId) return res.status(400).json({ success: false, error: 'order_id requis' });

    const { data: authData, error: authError } = await supabase.auth.getUser(access_token);
    if (authError || !authData.user) {
      return res.status(401).json({ success: false, error: 'Authentification invalide' });
    }

    const db = supabase.createClientWithAuth(access_token);
    const admin = supabase.admin || supabase;

    const result = await devalidateSingleOrder(db, admin, authData.user.id, orderId);

    return res.json({
      success: true,
      order_id: result.orderId,
      ticket_ids: result.ticketIds,
      message: 'Commande dévalidée et billets remis en statut valide',
    });
  } catch (error) {
    console.error('Erreur POST devalidate order:', error);
    return res.status(400).json({ success: false, error: error.message || 'Erreur serveur' });
  }
});

/**
 * DELETE /api/auth/orders/:id
 * Supprime une commande en ligne et les billets associés (admin requis).
 */
router.delete('/orders/:id', async (req, res) => {
  try {
    const access_token = req.headers.authorization?.split('Bearer ')[1];
    const { id: orderId } = req.params;

    if (!access_token) return res.status(401).json({ success: false, error: 'Token requis' });
    if (!orderId) return res.status(400).json({ success: false, error: 'order_id requis' });

    const { data: authData, error: authError } = await supabase.auth.getUser(access_token);
    if (authError || !authData.user) {
      return res.status(401).json({ success: false, error: 'Authentification invalide' });
    }

    const db = supabase.createClientWithAuth(access_token);
    const admin = supabase.admin || supabase;

    const { data: order, error: orderError } = await admin
      .from('orders')
      .select('id, payment_status')
      .eq('id', orderId)
      .single();

    if (orderError || !order) {
      return res.status(404).json({ success: false, error: 'Commande introuvable' });
    }

    const { data: orderItems, error: itemsError } = await admin
      .from('order_items')
      .select('ticket_id, tickets(id, event_id)')
      .eq('order_id', orderId);

    if (itemsError) {
      return res.status(400).json({ success: false, error: itemsError.message });
    }

    if (!orderItems?.length) {
      return res.status(400).json({ success: false, error: 'Aucun billet associé à cette commande' });
    }

    const eventIds = [
      ...new Set(
        orderItems
          .map((item) => item.tickets?.event_id)
          .filter(Boolean)
      ),
    ];

    if (eventIds.length !== 1) {
      return res.status(400).json({ success: false, error: 'Commande invalide: billets multi-événements' });
    }

    const eventId = eventIds[0];

    const { data: eventData, error: eventError } = await db
      .from('events')
      .select('organization_id')
      .eq('id', eventId)
      .single();

    if (eventError || !eventData) {
      return res.status(404).json({ success: false, error: 'Événement introuvable' });
    }

    const { data: memberRows } = await db
      .from('organization_members')
      .select('role')
      .eq('organization_id', eventData.organization_id)
      .eq('profile_id', authData.user.id)
      .limit(1);

    if (!memberRows?.length || memberRows[0].role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Accès refusé: administrateur requis' });
    }

    const ticketIds = orderItems.map((item) => item.ticket_id);

    const { error: deleteOrderError } = await admin.from('orders').delete().eq('id', orderId);
    if (deleteOrderError) {
      return res.status(400).json({ success: false, error: deleteOrderError.message });
    }

    if (ticketIds.length > 0) {
      const { error: deleteTicketsError } = await admin.from('tickets').delete().in('id', ticketIds);
      if (deleteTicketsError) {
        return res.status(400).json({
          success: false,
          error: `Commande supprimée, mais erreur lors de la suppression des billets: ${deleteTicketsError.message}`,
        });
      }
    }

    return res.json({
      success: true,
      order_id: orderId,
      deleted_ticket_ids: ticketIds,
      message: 'Commande supprimée avec succès',
    });
  } catch (error) {
    console.error('Erreur DELETE order:', error);
    return res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

module.exports = router;
