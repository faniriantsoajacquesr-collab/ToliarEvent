const supabase = require('../utils/supabase');
const { getFrontendUrl } = require('../utils/helpers');

/**
 * Contrôleur pour la gestion de l'authentification
 */

// Signup
const signup = async (req, res) => {
  try {
    const { email, password, metadata = {} } = req.body;

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

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${getFrontendUrl()}/auth/confirm-email`,
        data: metadata,
      },
    });

    if (error) {
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
};

// Login
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email et mot de passe sont requis',
      });
    }

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

// Logout
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

// Confirm Email
const confirmEmail = async (req, res) => {
  try {
    const { token_hash, type } = req.body;

    if (!token_hash || !type) {
      return res.status(400).json({
        success: false,
        error: 'token_hash et type sont requis',
      });
    }

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

// Refresh Token
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

// Forgot Password
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

// Reset Password
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

// Get User
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
