/**
 * Middleware d'authentification par clé API
 * Vérifie la validité de la clé API et l'ajoute à la requête
 */

const dbService = require('../services/dbService');

/**
 * Middleware pour vérifier la clé API
 * La clé peut être fournie dans les en-têtes (x-api-key) ou en paramètre de requête (apiKey)
 * @param {Object} req - Requête Express
 * @param {Object} res - Réponse Express
 * @param {Function} next - Fonction next d'Express
 */
async function apiKeyAuth(req, res, next) {
  try {
    // Récupérer la clé API depuis l'en-tête ou le paramètre de requête
    const apiKey = req.headers['x-api-key'] || req.query.apiKey;
    
    // Si aucune clé n'est fournie
    if (!apiKey) {
      return res.status(401).json({
        success: false,
        error: 'Clé API manquante',
        message: 'Veuillez fournir une clé API valide dans l\'en-tête x-api-key ou le paramètre apiKey'
      });
    }
    
    // Vérifier si c'est la clé de développement
    if (apiKey === 'dev-key' && (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === undefined)) {
      req.apiKey = {
        id: 1,
        key: 'dev-key',
        application_id: 1,
        description: 'Clé de développement',
        is_active: true
      };
      req.application = {
        id: 1,
        name: 'Application par défaut',
        description: 'Application créée automatiquement'
      };
      next();
      return;
    }
    
    // Vérifier la clé API dans la base de données
    const apiKeyRecord = await dbService.get(
      `SELECT ak.*, a.name as app_name, a.description as app_description
       FROM api_keys ak
       JOIN applications a ON ak.application_id = a.id
       WHERE ak.key = ? AND ak.is_active = 1`,
      [apiKey]
    );
    
    // Si la clé n'est pas trouvée ou n'est pas active
    if (!apiKeyRecord) {
      return res.status(401).json({
        success: false,
        error: 'Clé API invalide',
        message: 'La clé API fournie n\'est pas valide ou n\'est plus active'
      });
    }
    
    // Mettre à jour la date de dernière utilisation
    await dbService.run(
      'UPDATE api_keys SET last_used = datetime("now") WHERE id = ?',
      [apiKeyRecord.id]
    );
    
    // Ajouter les informations à la requête
    req.apiKey = {
      id: apiKeyRecord.id,
      key: apiKeyRecord.key,
      application_id: apiKeyRecord.application_id,
      description: apiKeyRecord.description,
      is_active: apiKeyRecord.is_active
    };
    
    req.application = {
      id: apiKeyRecord.application_id,
      name: apiKeyRecord.app_name,
      description: apiKeyRecord.app_description
    };
    
    next();
  } catch (error) {
    console.error('[API-AUTH] Erreur lors de la vérification de la clé API:', error);
    
    res.status(500).json({
      success: false,
      error: 'Erreur interne du serveur',
      message: 'Une erreur est survenue lors de la vérification de la clé API'
    });
  }
}

module.exports = apiKeyAuth;