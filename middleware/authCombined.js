/**
 * Middleware combiné pour l'authentification
 * Combine l'authentification par clé API et par JWT
 */

const apiKeyAuth = require('./apiKeyAuth');
const jwtAuth = require('./jwtAuth');

/**
 * Vérifie l'authentification par clé API ou par JWT
 * Laisse passer si l'un des deux est valide
 */
function checkAuth(req, res, next) {
  // Si la requête a un en-tête Authorization de type Bearer, utiliser JWT
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    return jwtAuth.verifyToken(req, res, next);
  }
  
  // Sinon, vérifier la clé API (dans l'en-tête x-api-key ou le paramètre api_key)
  return apiKeyAuth.verifyApiKey(req, res, next);
}

/**
 * Vérifie que l'utilisateur est administrateur
 * Nécessite une authentification JWT préalable
 */
function requireAdmin(req, res, next) {
  // Vérifier d'abord le token JWT
  jwtAuth.verifyToken(req, res, (err) => {
    if (err) {
      return res.status(401).json({ error: 'Authentification requise' });
    }
    
    // Vérifier que l'utilisateur est administrateur
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Droits administrateur requis' });
    }
    
    next();
  });
}

module.exports = {
  checkAuth,
  requireAdmin
};