const supabase = require('../utils/supabase');

/**
 * GET /api/auth/events/landing-pages
 * Query: ?organization_id=UUID
 * Retourne les publications (landing pages) d'une organisation.
 */
const listLandingPages = async (req, res) => {
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
};

/**
 * GET /api/auth/events/public
 * Retourne les événements publiés (landing page is_published = true), sans authentification.
 */
const listPublicEvents = async (req, res) => {
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
};

/**
 * PUT /api/auth/events/:id/landing-page/publish
 * Met à jour le statut publié de la landing page.
 */
const publishLandingPage = async (req, res) => {
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
};

/**
 * GET /api/auth/events/:id/landing-page
 * Récupère la landing page de l'événement pour un administrateur
 */
const getLandingPage = async (req, res) => {
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
};

/**
 * GET /api/auth/events/:id/public-landing-page
 * Récupère la landing page publique d'un événement publié.
 * Si la landing page n'existe pas ou n'est pas publiée, retourne les données d'événement seules.
 */
const getPublicLandingPage = async (req, res) => {
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
};

/**
 * POST /api/auth/events/:id/landing-page/upload-image
 * Upload une image de landing page dans le bucket Supabase publication_images.
 */
const uploadImage = async (req, res) => {
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
};

/**
 * PUT /api/auth/events/:id/landing-page
 * Met à jour ou crée la landing page de l'événement (admin requis)
 */
const saveLandingPage = async (req, res) => {
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
};

module.exports = {
  listLandingPages,
  listPublicEvents,
  publishLandingPage,
  getLandingPage,
  getPublicLandingPage,
  uploadImage,
  saveLandingPage,
};
