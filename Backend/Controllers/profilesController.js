const supabase = require('../utils/supabase');

/**
 * POST /api/auth/create-profile
 * Crée le profil utilisateur dans la table profiles
 */
const createProfile = async (req, res) => {
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
};

/**
 * GET /api/auth/check-profile
 * Vérifie si l'utilisateur a un profil complété
 */
const checkProfile = async (req, res) => {
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
};

/**
 * POST /api/auth/profile-skills
 * Ajoute les compétences sélectionnées au profil de l'utilisateur
 */
const setProfileSkills = async (req, res) => {
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
};

module.exports = {
  createProfile,
  checkProfile,
  setProfileSkills,
};
