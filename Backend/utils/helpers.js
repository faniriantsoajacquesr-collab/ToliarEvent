/**
 * Helpers pour les réponses API
 */

/**
 * Réponse de succès
 */
const successResponse = (res, data = {}, statusCode = 200) => {
  return res.status(statusCode).json({
    success: true,
    ...data,
  });
};

/**
 * Réponse d'erreur
 */
const errorResponse = (res, error, statusCode = 500) => {
  return res.status(statusCode).json({
    success: false,
    error: typeof error === 'string' ? error : error.message,
  });
};

/**
 * Formater les données d'utilisateur pour la réponse
 */
const formatUserResponse = (user) => {
  return {
    id: user?.id,
    email: user?.email,
    email_confirmed_at: user?.email_confirmed_at,
    created_at: user?.created_at,
    metadata: user?.user_metadata,
  };
};

/**
 * Formater les données de session pour la réponse
 */
const formatSessionResponse = (session) => {
  return {
    access_token: session?.access_token,
    refresh_token: session?.refresh_token,
    expires_in: session?.expires_in,
    token_type: session?.token_type || 'Bearer',
  };
};

/**
 * Réponse de login réussie
 */
const loginSuccessResponse = (res, user, session) => {
  return successResponse(res, {
    message: 'Connexion réussie',
    user: formatUserResponse(user),
    session: formatSessionResponse(session),
  });
};

/**
 * Réponse de signup réussie
 */
const signupSuccessResponse = (res, user) => {
  return successResponse(res, {
    message: 'Compte créé avec succès. Vérifiez votre email pour confirmer votre compte.',
    user: formatUserResponse(user),
  }, 201);
};

/**
 * Réponse de confirmation d'email réussie
 */
const confirmEmailSuccessResponse = (res, user, session) => {
  return successResponse(res, {
    message: 'Email confirmé avec succès',
    user: formatUserResponse(user),
    session: formatSessionResponse(session),
  });
};

/**
 * Extraire le token du header Authorization
 */
const extractBearerToken = (authHeader) => {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.substring(7);
};

module.exports = {
  successResponse,
  errorResponse,
  formatUserResponse,
  formatSessionResponse,
  loginSuccessResponse,
  signupSuccessResponse,
  confirmEmailSuccessResponse,
  extractBearerToken,
};
