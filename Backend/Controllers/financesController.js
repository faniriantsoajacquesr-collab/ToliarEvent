const supabase = require('../utils/supabase');

/**
 * GET /api/auth/transactions-categories
 * Query: ?type=entree|sortie
 * Retourne les catégories disponibles pour le type demandé.
 */
const listCategories = async (req, res) => {
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
};

/**
 * POST /api/auth/transactions-categories
 * Body: { title, type }
 */
const createCategory = async (req, res) => {
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
};

/**
 * GET /api/auth/transactions
 * Query: ?organization_id=UUID&event_id=UUID
 */
const listTransactions = async (req, res) => {
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
};

/**
 * POST /api/auth/transactions
 * Body: { event_id, date, title, description?, amount, category_id, type, organization_id? }
 */
const createTransaction = async (req, res) => {
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
};

/**
 * PUT /api/auth/transactions/:id
 * Body: { event_id?, date?, title?, description?, amount?, category_id?, type? }
 */
const updateTransaction = async (req, res) => {
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
};

/**
 * DELETE /api/auth/transactions/:id
 */
const deleteTransaction = async (req, res) => {
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
};

module.exports = {
  listCategories,
  createCategory,
  listTransactions,
  createTransaction,
  updateTransaction,
  deleteTransaction,
};
