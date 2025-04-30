/**
 * Middleware d'authentification pour les routes protégées
 * Permet de restreindre l'accès aux routes en fonction du rôle de l'utilisateur
 * 
 * @module middleware/authMiddleware
 */

/**
 * Middleware qui vérifie si l'utilisateur est authentifié
 * @returns {Function} Middleware Express
 */
function authenticated(req, res, next) {
  if (!req.isAuthenticated || !req.isAuthenticated()) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized',
      message: 'Authentification requise'
    });
  }
  
  next();
}

/**
 * Middleware qui vérifie si l'utilisateur est un administrateur
 * @returns {Function} Middleware Express
 */
function adminRequired(req, res, next) {
  if (!req.isAuthenticated || !req.isAuthenticated()) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized',
      message: 'Authentification requise'
    });
  }
  
  // Vérifier si l'utilisateur est un administrateur
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      error: 'Forbidden',
      message: 'Vous devez être administrateur pour accéder à cette ressource'
    });
  }
  
  next();
}

module.exports = {
  authenticated,
  adminRequired
};