/**
 * Middleware combinant l'authentification JWT et API Key
 * Permet notamment aux administrateurs d'accéder aux routes protégées via Swagger
 * sans avoir à spécifier manuellement une clé API.
 * 
 * @module middleware/authCombined
 */

const jwt = require('jsonwebtoken');

/**
 * Crée une instance de middleware d'authentification combinée
 * @returns {Function} Middleware Express
 */
function createAuthCombinedMiddleware() {
  // Renvoyer le middleware
  return function authCombinedMiddleware(req, res, next) {
    const JWT_SECRET = process.env.JWT_SECRET || 'fhirhub-secret-key';
    
    try {
      // S'assurer que req.app et req.app.locals existent
      if (!req.app || !req.app.locals || !req.app.locals.db) {
        return res.status(500).json({
          success: false, 
          error: 'Server Configuration Error',
          message: 'Base de données non initialisée'
        });
      }
      
      const db = req.app.locals.db;
      
      // 1. Vérifier d'abord la présence d'un token JWT
      const authHeader = req.headers.authorization;
      
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1];
        
        try {
          // Vérifier et décoder le token
          const decoded = jwt.verify(token, JWT_SECRET);
          
          // Vérifier si l'utilisateur existe et a le rôle admin
          const user = db.prepare(`SELECT * FROM users WHERE id = ?`).get(decoded.id);
          
          if (user && user.role === 'admin') {
            // Si l'utilisateur est admin, pas besoin de vérifier la clé API
            req.user = user;
            return next();
          }
          
          // Si l'utilisateur n'est pas admin, continuer avec la vérification de la clé API
        } catch (error) {
          // Erreur avec le JWT - on continue avec la vérification de l'API Key
          console.log('[AUTH] JWT invalide ou expiré, vérification de la clé API');
        }
      }
      
      // 2. Vérifier ensuite la présence d'une clé API
      const apiKey = req.headers['x-api-key'];
      
      if (!apiKey) {
        return res.status(401).json({
          success: false,
          error: 'Unauthorized',
          message: 'Authentification requise (JWT ou clé API)'
        });
      }
      
      // Vérifier si la clé API existe dans la base de données
      const keyData = db.prepare(`
        SELECT ak.*, a.name as app_name
        FROM api_keys ak
        JOIN applications a ON ak.application_id = a.id
        WHERE ak.key = ? AND ak.active = 1
      `).get(apiKey);
      
      if (!keyData) {
        return res.status(401).json({
          success: false,
          error: 'Unauthorized',
          message: 'Clé API invalide ou inactive'
        });
      }
      
      // Stocker les informations de l'application dans req pour utilisation ultérieure
      req.apiKeyData = keyData;
      
      // Continuer avec la requête
      next();
    } catch (error) {
      console.error('[AUTH COMBINED]', error);
      
      return res.status(500).json({
        success: false,
        error: 'Server Error',
        message: 'Erreur lors de l\'authentification'
      });
    }
  };
}

// Exporter directement une instance du middleware pour simplifier l'importation
module.exports = createAuthCombinedMiddleware();