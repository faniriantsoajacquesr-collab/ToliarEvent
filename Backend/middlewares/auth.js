const supabase = require('../utils/supabase');

/**
 * Middleware pour vérifier l'authentification
 * Extrait et valide le token du header Authorization
 */
const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'Token d\'authentification requis',
      });
    }

    const token = authHeader.substring(7); // Enlever "Bearer "
    
    const { data, error } = await supabase.auth.getUser(token);

    if (error || !data.user) {
      return res.status(401).json({
        success: false,
        error: 'Token invalide ou expiré',
      });
    }

    // Ajouter l'utilisateur à la requête
    req.user = data.user;
    next();
  } catch (error) {
    console.error('Erreur middleware auth:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la vérification du token',
    });
  }
};

/**
 * Middleware pour les erreurs 404
 */
const notFoundMiddleware = (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Route non trouvée',
    path: req.path,
  });
};

/**
 * Middleware de validation des données
 */
const validateBody = (schema) => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: error.details[0].message,
      });
    }
    req.validatedBody = value;
    next();
  };
};

module.exports = {
  authMiddleware,
  notFoundMiddleware,
  validateBody,
};
