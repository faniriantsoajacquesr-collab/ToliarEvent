const supabase = require('../utils/supabase');
const { isPlatformAdmin } = require('../utils/organizationAccess');

/**
 * GET /api/auth/admin/organizations/pending
 * Liste les organisations en attente (admin plateforme uniquement)
 */
const listPendingOrganizations = async (req, res) => {
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
};

/**
 * PATCH /api/auth/admin/organizations/:id/status
 * Valide ou refuse une organisation (admin plateforme uniquement)
 * body: { status: 'active' | 'rejected' }
 */
const updateOrganizationStatus = async (req, res) => {
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
};

module.exports = {
  listPendingOrganizations,
  updateOrganizationStatus,
};
