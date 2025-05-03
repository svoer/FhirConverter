/**
 * Middleware combinant authentification par jeton JWT et clé API
 * Ce middleware unifié gère toutes les méthodes d'authentification pour FHIRHub
 */

const jwt = require('jsonwebtoken');

// Clé secrète pour vérifier les JWT (à déplacer dans une variable d'environnement en production)
const JWT_SECRET = process.env.JWT_SECRET || 'fhirhub-secret-key';

/**
 * Middleware qui accepte soit l'authentification utilisateur par token JWT, 
 * soit l'authentification par clé API
 * @param {Object} req - Requête Express
 * @param {Object} res - Réponse Express
 * @param {Function} next - Fonction suivante dans la chaîne de middleware
 */
function authCombined(req, res, next) {
  // Vérifier en priorité si une clé API est fournie dans les headers
  const apiKey = req.headers['x-api-key'];
  
  if (apiKey) {
    try {
      // Vérifier si la clé API est valide
      const db = req.app.locals.db;
      const keyData = db.prepare(`
          SELECT ak.*, a.name as app_name
          FROM api_keys ak
          JOIN applications a ON ak.application_id = a.id
          WHERE ak.key = ? AND ak.is_active = 1
      `).get(apiKey);
      
      if (keyData) {
        console.log(`[AUTH] Authentification réussie via clé API: ${apiKey.substring(0, 8)}...`);
        // Clé API valide, ajouter les informations à la requête et continuer
        req.apiKey = keyData;
        req.isApiAuthenticated = true;
        
        // Mettre à jour la date de dernière utilisation de la clé API
        db.prepare(`
          UPDATE api_keys
          SET last_used_at = datetime('now')
          WHERE id = ?
        `).run(keyData.id);
        
        return next();
      }
    } catch (error) {
      console.error('[AUTH] Erreur lors de la vérification de la clé API:', error);
    }
  }
  
  // Si pas de clé API valide, vérifier le token JWT
  const authHeader = req.headers.authorization;
  
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    
    try {
      // Vérifier et décoder le token
      const decoded = jwt.verify(token, JWT_SECRET);
      
      // Récupérer l'utilisateur depuis la base de données
      const db = req.app.locals.db;
      const user = db.prepare(`
        SELECT id, username, role, created_at 
        FROM users 
        WHERE id = ?
      `).get(decoded.id);
      
      if (user) {
        console.log(`[AUTH] Authentification JWT réussie pour l'utilisateur: ${user.username}`);
        // Ajouter l'utilisateur et le flag d'authentification à la requête
        req.user = user;
        req.isAuthenticated = function() { return true; };
        
        return next();
      } else {
        console.log(`[AUTH] Utilisateur non trouvé pour le token JWT (id: ${decoded.id})`);
      }
    } catch (error) {
      console.error('[AUTH] Erreur lors de la vérification du token JWT:', error.message);
    }
  }
  
  // Si aucune méthode d'authentification n'a réussi
  console.log('[AUTH] Authentification échouée - Accès non autorisé');
  return res.status(401).json({
    success: false,
    error: 'Unauthorized',
    message: 'Authentification requise. Veuillez fournir un token JWT valide ou une clé API.'
  });
}

module.exports = authCombined;