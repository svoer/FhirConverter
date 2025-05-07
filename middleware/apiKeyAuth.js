/**
 * Middleware pour l'authentification par clé API
 */

const crypto = require('crypto');
const Database = require('better-sqlite3');
const db = new Database('./storage/db/fhirhub.db', { fileMustExist: false });

/**
 * Vérifie la validité d'une clé API
 */
function verifyApiKey(req, res, next) {
  // Pour les routes de documentation, autoriser sans authentification lorsqu'appelées par le chatbot
  if (req.originalUrl.includes('/api/documentation/summary') && req.headers['x-chatbot-request'] === 'true') {
    return next();
  }

  try {
    // Récupérer la clé API de l'en-tête ou du paramètre de requête
    const apiKey = req.headers['x-api-key'] || req.query.api_key || 'dev-key';
    
    if (!apiKey) {
      return res.status(401).json({ error: 'Clé API requise' });
    }
    
    // Hacher la clé pour la comparer avec celle stockée en base
    const hashedKey = crypto.createHash('sha256').update(apiKey).digest('hex');
    
    // Vérifier si la clé existe et est active
    const apiKeyData = db.prepare(`
      SELECT k.*, a.id as app_id, a.name as app_name
      FROM api_keys k
      JOIN applications a ON k.application_id = a.id
      WHERE (k.key = ? OR k.hashed_key = ?) AND k.is_active = 1
    `).get(apiKey, hashedKey);
    
    if (!apiKeyData) {
      console.warn(`[API] Tentative d'accès avec une clé API invalide: ${apiKey.substring(0, 8)}...`);
      return res.status(401).json({ error: 'Clé API invalide ou inactive' });
    }
    
    // Mettre à jour la date de dernière utilisation
    db.prepare(`
      UPDATE api_keys
      SET last_used_at = datetime('now')
      WHERE id = ?
    `).run(apiKeyData.id);
    
    // Ajouter les informations de l'application à la requête
    req.apiKey = apiKeyData;
    req.app = {
      id: apiKeyData.app_id,
      name: apiKeyData.app_name
    };
    
    // Continuer
    next();
  } catch (error) {
    console.error('[API] Erreur lors de la vérification de la clé API:', error);
    return res.status(500).json({ error: 'Erreur lors de la vérification de la clé API' });
  }
}

module.exports = {
  verifyApiKey
};