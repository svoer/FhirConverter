/**
 * Middleware combinant authentification par jeton JWT et clé API
 */

const authMiddleware = require('./authMiddleware');

/**
 * Middleware qui accepte soit l'authentification utilisateur, soit l'authentification par clé API
 */
function authCombined(req, res, next) {
  // On utilise le middleware existant
  authMiddleware.authenticatedOrApiKey(req, res, next);
}

module.exports = authCombined;