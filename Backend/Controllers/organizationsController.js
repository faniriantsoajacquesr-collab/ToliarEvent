const supabase = require('../utils/supabase');

/**
 * POST /api/auth/create-organization
 * Crée une organisation et ajoute le user comme admin
 */
const createOrganization = async (req, res) => {
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
};

/**
 * POST /api/auth/join-organization
 * Rejoindre une organisation via code d'invitation
 */
const joinOrganization = async (req, res) => {
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
};

/**
 * POST /api/auth/organization-skills
 * Ajoute des compétences pour une organisation (admin seulement)
 * body: { organization_id, skills: ["skill1", "skill2"] }
 */
const setOrganizationSkills = async (req, res) => {
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
};

/**
 * GET /api/auth/my-organization
 * Retourne l'organisation (et le membership) liée au profil authentifié, ou null
 */
const getMyOrganization = async (req, res) => {
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
};

module.exports = {
  createOrganization,
  joinOrganization,
  setOrganizationSkills,
  getMyOrganization,
};
