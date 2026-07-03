/**
 * Configuration et constantes de l'application
 */

module.exports = {
  // Messages d'erreur
  ERROR_MESSAGES: {
    MISSING_CREDENTIALS: 'Email et mot de passe sont requis',
    INVALID_PASSWORD_LENGTH: 'Le mot de passe doit contenir au moins 8 caractères',
    INVALID_CREDENTIALS: 'Email ou mot de passe incorrect',
    TOKEN_REQUIRED: 'Token d\'authentification requis',
    TOKEN_INVALID: 'Token invalide ou expiré',
    EMAIL_REQUIRED: 'Email est requis',
    PASSWORD_REQUIRED: 'Mot de passe est requis',
    NEW_PASSWORD_REQUIRED: 'new_password est requis',
    TOKEN_HASH_REQUIRED: 'token_hash et type sont requis',
    REFRESH_TOKEN_REQUIRED: 'refresh_token est requis',
  },

  // Messages de succès
  SUCCESS_MESSAGES: {
    SIGNUP_SUCCESS: 'Compte créé avec succès. Vérifiez votre email pour confirmer votre compte.',
    LOGIN_SUCCESS: 'Connexion réussie',
    LOGOUT_SUCCESS: 'Déconnexion réussie',
    EMAIL_CONFIRMED: 'Email confirmé avec succès',
    PASSWORD_RESET_SENT: 'Email de réinitialisation envoyé. Vérifiez votre boîte de réception.',
    PASSWORD_RESET_SUCCESS: 'Mot de passe réinitialisé avec succès',
  },

  // Codes HTTP
  HTTP_STATUS: {
    OK: 200,
    CREATED: 201,
    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    INTERNAL_SERVER_ERROR: 500,
  },

  // Validation
  VALIDATION: {
    MIN_PASSWORD_LENGTH: 8,
    EMAIL_REGEX: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  },

  // Token expiration (en secondes)
  TOKEN_EXPIRATION: {
    ACCESS_TOKEN: 3600, // 1 heure
    REFRESH_TOKEN: 604800, // 7 jours
  },
};
