/**
 * Middleware d'authentification combiné
 * Autorise l'accès si l'utilisateur est authentifié par JWT OU par clé API
 */
const jwtAuth = require('./jwtAuth');
const crypto = require('crypto');

// Fonction pour hacher une valeur (pour les clés API)
function hashValue(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

/**
 * Middleware pour vérifier l'authentification JWT ou API Key
 * @returns {Function} Middleware Express
 */
function authCombined() {
  return async (req, res, next) => {
    // Vérification si une authentification JWT est présente
    const authHeader = req.headers.authorization;
    const hasJwt = authHeader && authHeader.startsWith('Bearer ');
    
    // Vérification si une authentification API Key est présente
    const apiKey = req.header('X-API-KEY');
    const hasApiKey = !!apiKey;
    
    if (!hasJwt && !hasApiKey) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: 'Authentification requise (JWT ou API Key)'
      });
    }
    
    // Flag pour savoir si l'une des authentifications a réussi
    let authSuccess = false;
    
    // Test authentification JWT si présente
    if (hasJwt) {
      const jwtMiddleware = jwtAuth({ required: false });
      
      await new Promise(resolve => {
        jwtMiddleware(req, res, () => {
          if (req.user) {
            authSuccess = true;
          }
          resolve();
        });
      });
      
      if (authSuccess) {
        return next();
      }
    }
    
    // Test authentification API Key si présente
    if (hasApiKey) {
      try {
        // Vérifier la clé dans la base de données
        const db = req.app.locals.db;
        const hashedKey = hashValue(apiKey);
        
        const keyData = db.prepare(`
          SELECT 
            ak.id, ak.application_id, ak.key, ak.is_active, ak.expires_at,
            a.name as app_name, a.cors_origins, a.settings
          FROM api_keys ak
          JOIN applications a ON ak.application_id = a.id
          WHERE ak.hashed_key = ? AND ak.is_active = 1
        `).get(hashedKey);
        
        if (keyData) {
          // Vérifier si la clé a expiré
          if (!keyData.expires_at || new Date(keyData.expires_at) >= new Date()) {
            // Mettre à jour la date de dernière utilisation
            db.prepare(`
              UPDATE api_keys
              SET last_used_at = datetime('now')
              WHERE id = ?
            `).run(keyData.id);
            
            // Ajouter les informations de clé API à la requête
            req.apiKey = keyData;
            req.application = {
              id: keyData.application_id,
              name: keyData.app_name,
              settings: keyData.settings ? JSON.parse(keyData.settings) : {},
              corsOrigins: keyData.cors_origins ? keyData.cors_origins.split(',') : []
            };
            
            authSuccess = true;
            return next();
          }
        }
      } catch (error) {
        console.error('[AUTH COMBINED]', error);
      }
    }
    
    // Si aucune authentification n'a réussi
    return res.status(401).json({
      success: false,
      error: 'Unauthorized',
      message: 'Authentification invalide'
    });
  };
}

module.exports = authCombined;