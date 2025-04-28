/**
 * Middleware d'authentification par clé API pour FHIRHub
 * Vérifie et valide les clés API fournies dans les requêtes
 */

const dbService = require('../services/dbService');

/**
 * Valider une clé API
 * @param {string} apiKey - Clé API à valider
 * @returns {Promise<Object|null>} Informations sur la clé API ou null si invalide
 */
async function validateApiKey(apiKey) {
  if (!apiKey) {
    return null;
  }
  
  try {
    // Rechercher la clé API dans la base de données
    const apiKeyInfo = await dbService.get(
      `SELECT 
         k.id, k.key, k.name, k.environment, k.active,
         a.id as application_id, a.name as application_name
       FROM api_keys k
       JOIN applications a ON k.application_id = a.id
       WHERE k.key = ? AND k.active = 1`,
      [apiKey]
    );
    
    if (!apiKeyInfo) {
      return null;
    }
    
    // Mettre à jour la date de dernière utilisation
    await dbService.run(
      'UPDATE api_keys SET last_used = datetime("now") WHERE id = ?',
      [apiKeyInfo.id]
    );
    
    return apiKeyInfo;
  } catch (error) {
    console.error('[API-KEY] Erreur lors de la validation de la clé API:', error);
    return null;
  }
}

/**
 * Middleware d'authentification par clé API
 * Recherche la clé API dans les en-têtes HTTP (x-api-key) ou les paramètres de requête (apiKey)
 * @param {Object} req - Requête Express
 * @param {Object} res - Réponse Express
 * @param {Function} next - Fonction suivante
 */
async function apiKeyAuth(req, res, next) {
  try {
    // Extraire la clé API des en-têtes HTTP ou des paramètres de requête
    const apiKey = req.headers['x-api-key'] || req.query.apiKey;
    
    // Si nous sommes en développement et qu'aucune clé n'est fournie, utiliser la clé de développement
    if (!apiKey && process.env.NODE_ENV === 'development') {
      const devKey = 'dev-key';
      console.log(`[API-KEY] Utilisation de la clé de développement: ${devKey}`);
      
      // Vérifier si la clé de développement existe, sinon la créer
      await ensureDevKey(devKey);
      
      // Ajouter les informations d'API à la requête
      req.apiKey = {
        id: 1,
        key: devKey,
        name: 'Clé de développement',
        environment: 'development',
        active: 1,
        application_id: 1,
        application_name: 'Application de développement'
      };
      
      return next();
    }
    
    // Valider la clé API
    const apiKeyInfo = await validateApiKey(apiKey);
    
    if (!apiKeyInfo) {
      return res.status(401).json({
        success: false,
        error: 'Clé API invalide',
        message: 'La clé API fournie est invalide ou inactive'
      });
    }
    
    // Ajouter les informations d'API à la requête
    req.apiKey = apiKeyInfo;
    
    next();
  } catch (error) {
    console.error('[API-KEY] Erreur dans le middleware d\'authentification:', error);
    
    res.status(500).json({
      success: false,
      error: 'Erreur serveur',
      message: 'Une erreur est survenue lors de la validation de la clé API'
    });
  }
}

/**
 * S'assurer que la clé de développement existe
 * @param {string} devKey - Clé de développement
 */
async function ensureDevKey(devKey) {
  try {
    // Vérifier si la clé de développement existe déjà
    const keyExists = await dbService.get('SELECT id FROM api_keys WHERE key = ?', [devKey]);
    
    if (keyExists) {
      return;
    }
    
    console.log('[API-KEY] Création de la clé de développement...');
    
    // Vérifier si l'application de développement existe
    let appId = await dbService.get('SELECT id FROM applications WHERE name = ?', ['Application de développement']);
    
    if (!appId) {
      // Obtenir l'ID de l'utilisateur admin
      const adminUser = await dbService.get('SELECT id FROM users WHERE username = ?', ['admin']);
      
      if (!adminUser) {
        console.error('[API-KEY] Utilisateur admin non trouvé. Impossible de créer l\'application de développement.');
        return;
      }
      
      // Créer l'application de développement
      const appResult = await dbService.run(
        'INSERT INTO applications (name, description, owner_id) VALUES (?, ?, ?)',
        ['Application de développement', 'Application automatique pour le développement', adminUser.id]
      );
      
      appId = { id: appResult.lastID };
    }
    
    // Créer la clé API de développement
    await dbService.run(
      'INSERT INTO api_keys (application_id, key, name, environment) VALUES (?, ?, ?, ?)',
      [appId.id, devKey, 'Clé de développement', 'development']
    );
    
    console.log('[API-KEY] Clé de développement créée avec succès');
  } catch (error) {
    console.error('[API-KEY] Erreur lors de la création de la clé de développement:', error);
  }
}

module.exports = {
  apiKeyAuth,
  validateApiKey
};