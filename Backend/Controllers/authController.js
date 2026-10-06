const supabase = require('../utils/supabase');
const { getFrontendUrl } = require('../utils/helpers');

/**
 * POST /api/auth/signup
 * Inscription publique suspendue pendant l'accès anticipé.
 */
const signup = require('../utils/registrationClosed');

/**
 * POST /api/auth/login
 * Connecte un utilisateur avec email et mot de passe
 */
const login = async (req, res) => {
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
};

/**
 * POST /api/auth/logout
 * Déconnecte l'utilisateur
 */
const logout = async (req, res) => {
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
};

/**
 * POST /api/auth/confirm-email
 * Confirme l'email de l'utilisateur avec un token
 */
const confirmEmail = async (req, res) => {
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
};

/**
 * POST /api/auth/refresh-token
 * Rafraîchit le token d'accès
 */
const refreshToken = async (req, res) => {
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
};

/**
 * POST /api/auth/forgot-password
 * Envoie un email de réinitialisation du mot de passe
 */
const forgotPassword = async (req, res) => {
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
};

/**
 * POST /api/auth/reset-password
 * Réinitialise le mot de passe avec un nouveau
 */
const resetPassword = async (req, res) => {
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
};

/**
 * GET /api/auth/user
 * Récupère les informations de l'utilisateur actuellement connecté
 */
const getUser = async (req, res) => {
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
};

module.exports = {
  signup,
  login,
  logout,
  confirmEmail,
  refreshToken,
  forgotPassword,
  resetPassword,
  getUser,
};
