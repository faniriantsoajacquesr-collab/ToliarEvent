const supabase = require('../utils/supabase');

/**
 * GET /api/auth/skills
 * Récupère la liste des compétences disponibles
 */
const listSkills = async (req, res) => {
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
};

module.exports = {
  listSkills,
};
