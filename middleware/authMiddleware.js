/**
 * Middleware d'authentification pour les routes protégées
 * Permet de restreindre l'accès aux routes en fonction du rôle de l'utilisateur
 * 
 * @module middleware/authMiddleware
 */

const dbService = require('../src/services/dbService');

/**
 * Middleware qui vérifie si l'utilisateur est authentifié ou si une clé API valide est fournie
 * @returns {Function} Middleware Express
 */
function authenticatedOrApiKey(req, res, next) {
  // Vérifier si une clé API est fournie dans les headers
  const apiKey = req.headers['x-api-key'];
  
  // Si l'utilisateur est déjà authentifié, on continue
  if (req.isAuthenticated && req.isAuthenticated()) {
    console.log('[AUTH] Utilisateur déjà authentifié, accès autorisé');
    return next();
  }
  
  // Si une clé API est fournie, on la vérifie
  if (apiKey) {
    console.log(`[AUTH] Tentative d'authentification par clé API: ${apiKey.substring(0, 8)}...`);
    
    // Vérifier si la base de données est accessible
    if (!dbService.isInitialized()) {
      console.error('[AUTH] Base de données non initialisée lors de la vérification de la clé API');
      return res.status(500).json({
        success: false,
        error: 'Internal Server Error',
        message: 'Erreur de configuration du serveur'
      });
    }
    
    // Utiliser directement l'objet db du service dbService
    try {
      const db = req.app.locals.db;
      if (!db) {
        console.error('[AUTH] Connexion à la base de données non disponible');
        return res.status(500).json({
          success: false,
          error: 'Internal Server Error',
          message: 'Erreur de connexion à la base de données'
        });
      }
      
      // Utiliser une requête synchrone avec better-sqlite3
      const keyData = db.prepare(`
        SELECT ak.*, a.name as app_name
        FROM api_keys ak
        JOIN applications a ON ak.application_id = a.id
        WHERE ak.key = ? AND ak.is_active = 1
      `).get(apiKey);
      
      if (keyData) {
        console.log(`[AUTH] Authentification réussie via clé API: ${apiKey.substring(0, 8)}...`);
        
        // Mettre à jour la dernière utilisation
        db.prepare(`
          UPDATE api_keys
          SET last_used_at = datetime('now')
          WHERE id = ?
        `).run(keyData.id);
        
        // Clé API valide, ajouter les informations à la requête
        req.apiKey = keyData;
        req.isApiAuthenticated = true;
        
        return next();
      } else {
        console.warn(`[AUTH] Clé API invalide: ${apiKey.substring(0, 8)}...`);
      }
    } catch (error) {
      console.error('[AUTH] Erreur lors de la vérification de la clé API:', error);
    }
  }
  
  // Ni clé API ni authentification
  console.log('[AUTH] Authentification échouée - Accès non autorisé');
  return res.status(401).json({
    success: false,
    error: 'Unauthorized',
    message: 'Authentification ou clé API valide requise'
  });
}

/**
 * Middleware qui vérifie si l'utilisateur est authentifié
 * @returns {Function} Middleware Express
 */
function authenticated(req, res, next) {
  if (!req.isAuthenticated || !req.isAuthenticated()) {
    console.log('[AUTH] Accès refusé - Authentification requise');
    return res.status(401).json({
      success: false,
      error: 'Unauthorized',
      message: 'Authentification requise'
    });
  }
  
  console.log(`[AUTH] Utilisateur authentifié: ${req.user.username}`);
  next();
}

/**
 * Middleware qui vérifie si l'utilisateur est un administrateur
 * @returns {Function} Middleware Express
 */
function adminRequired(req, res, next) {
  if (!req.isAuthenticated || !req.isAuthenticated()) {
    console.log('[AUTH] Accès admin refusé - Authentification requise');
    return res.status(401).json({
      success: false,
      error: 'Unauthorized',
      message: 'Authentification requise'
    });
  }
  
  // Vérifier si l'utilisateur est un administrateur
  if (!req.user || req.user.role !== 'admin') {
    console.log(`[AUTH] Accès admin refusé pour l'utilisateur ${req.user.username} (rôle: ${req.user.role})`);
    return res.status(403).json({
      success: false,
      error: 'Forbidden',
      message: 'Vous devez être administrateur pour accéder à cette ressource'
    });
  }
  
  console.log(`[AUTH] Accès admin autorisé pour l'utilisateur ${req.user.username}`);
  next();
}

module.exports = {
  authenticated,
  adminRequired,
  authenticatedOrApiKey
};