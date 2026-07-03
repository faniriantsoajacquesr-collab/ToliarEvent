const express = require('express');
const supabase = require('../utils/supabase');

const router = express.Router();

// GET /api/auth/organization-members?organization_id=...&q=...&filter=all|pending
router.get('/', async (req, res) => {
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

    if (q && typeof q === 'string') {
      query = query.ilike('profiles.first_name', `%${q}%`).or(`profiles.last_name.ilike.%${q}%`);
    }

    const { data: members, error: membersError } = await query.order('created_at', { ascending: false });
    if (membersError) return res.status(400).json({ success: false, error: membersError.message });

    return res.json({ success: true, members });
  } catch (error) {
    console.error('Erreur GET organization-members:', error);
    res.status(500).json({ success: false, error: 'Erreur lors de la récupération des membres de l\'organisation' });
  }
});

// PATCH /api/auth/organization-members/:id
router.patch('/:id', async (req, res) => {
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

// DELETE /api/auth/organization-members/:id
router.delete('/:id', async (req, res) => {
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

module.exports = router;
