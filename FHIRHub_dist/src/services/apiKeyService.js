/**
 * Service de gestion des clés API pour FHIRHub
 * Permet de créer, gérer et valider des clés API pour chaque application
 */

const { db } = require('../db/schema');
const crypto = require('crypto');
const { getApplicationById } = require('./applicationService');

/**
 * Générer une nouvelle clé API unique
 * @param {string} prefix - Préfixe optionnel pour la clé
 * @returns {string} Clé API générée
 */
function generateApiKey(prefix = '') {
  const randomBytes = crypto.randomBytes(16).toString('hex');
  return `${prefix}${randomBytes}`;
}

/**
 * Créer une nouvelle clé API pour une application
 * @param {number} appId - ID de l'application
 * @param {Object} keyData - Données de la clé API
 * @returns {Object} Clé API créée
 */
function createApiKey(appId, keyData = {}) {
  const { description, environment, expires_at, custom_key } = keyData;
  
  try {
    // Vérifier si l'application existe
    const app = getApplicationById(appId);
    if (!app) {
      throw new Error('Application non trouvée');
    }
    
    // Générer ou utiliser une clé API
    const apiKey = custom_key || generateApiKey(environment === 'production' ? 'prod-' : 'dev-');
    
    // Calculer la date d'expiration si nécessaire
    let expirationDate = null;
    if (expires_at) {
      expirationDate = expires_at;
    } else if (keyData.expiration_days) {
      const date = new Date();
      date.setDate(date.getDate() + keyData.expiration_days);
      expirationDate = date.toISOString();
    }
    
    const result = db.prepare(`
      INSERT INTO api_keys (app_id, api_key, description, environment, expires_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      appId,
      apiKey,
      description || `Clé API ${environment || 'development'}`,
      environment || 'development',
      expirationDate
    );
    
    return getApiKeyById(result.lastInsertRowid);
  } catch (error) {
    console.error('Erreur lors de la création de la clé API:', error);
    throw new Error(`Impossible de créer la clé API: ${error.message}`);
  }
}

/**
 * Obtenir une clé API par son ID
 * @param {number} id - ID de la clé API
 * @returns {Object|null} Clé API trouvée ou null
 */
function getApiKeyById(id) {
  try {
    return db.prepare('SELECT * FROM api_keys WHERE id = ?').get(id);
  } catch (error) {
    console.error('Erreur lors de la récupération de la clé API:', error);
    throw new Error(`Impossible de récupérer la clé API: ${error.message}`);
  }
}

/**
 * Obtenir une clé API par sa valeur
 * @param {string} apiKey - Valeur de la clé API
 * @returns {Object|null} Clé API trouvée ou null
 */
function getApiKeyByValue(apiKey) {
  try {
    return db.prepare('SELECT * FROM api_keys WHERE api_key = ?').get(apiKey);
  } catch (error) {
    console.error('Erreur lors de la récupération de la clé API:', error);
    throw new Error(`Impossible de récupérer la clé API: ${error.message}`);
  }
}

/**
 * Révoquer une clé API
 * @param {number} id - ID de la clé API
 * @returns {boolean} Succès de la révocation
 */
function revokeApiKey(id) {
  try {
    const result = db.prepare(`
      UPDATE api_keys
      SET revoked = 1, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(id);
    
    return result.changes > 0;
  } catch (error) {
    console.error('Erreur lors de la révocation de la clé API:', error);
    throw new Error(`Impossible de révoquer la clé API: ${error.message}`);
  }
}

/**
 * Supprimer une clé API
 * @param {number} id - ID de la clé API
 * @returns {boolean} Succès de la suppression
 */
function deleteApiKey(id) {
  try {
    const result = db.prepare('DELETE FROM api_keys WHERE id = ?').run(id);
    return result.changes > 0;
  } catch (error) {
    console.error('Erreur lors de la suppression de la clé API:', error);
    throw new Error(`Impossible de supprimer la clé API: ${error.message}`);
  }
}

/**
 * Mettre à jour la date de dernière utilisation d'une clé API
 * @param {number} id - ID de la clé API
 * @returns {boolean} Succès de la mise à jour
 */
function updateApiKeyLastUsed(id) {
  try {
    const result = db.prepare(`
      UPDATE api_keys
      SET last_used = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(id);
    
    return result.changes > 0;
  } catch (error) {
    console.error('Erreur lors de la mise à jour de la date d\'utilisation:', error);
    return false; // Ne pas échouer l'opération principale si cette mise à jour échoue
  }
}

/**
 * Vérifier si une clé API est valide
 * @param {string} apiKey - Valeur de la clé API
 * @returns {Object|null} Informations sur la clé API si valide, null sinon
 */
function validateApiKey(apiKey) {
  try {
    const key = getApiKeyByValue(apiKey);
    
    if (!key) {
      return null; // Clé non trouvée
    }
    
    // Vérifier si la clé est révoquée
    if (key.revoked) {
      return null; // Clé révoquée
    }
    
    // Vérifier si la clé est expirée
    if (key.expires_at && new Date(key.expires_at) < new Date()) {
      return null; // Clé expirée
    }
    
    // Vérifier si l'application associée est active
    const app = getApplicationById(key.app_id);
    if (!app || !app.active) {
      return null; // Application inactive ou supprimée
    }
    
    // Mettre à jour la date de dernière utilisation (en arrière-plan)
    updateApiKeyLastUsed(key.id);
    
    return {
      key,
      app
    };
  } catch (error) {
    console.error('Erreur lors de la validation de la clé API:', error);
    return null;
  }
}

/**
 * Lister les clés API d'une application
 * @param {number} appId - ID de l'application
 * @param {Object} options - Options de filtrage
 * @returns {Array} Liste des clés API
 */
function listApiKeys(appId, options = {}) {
  const { active_only = true, environment, sortBy = 'created_at', sortOrder = 'desc' } = options;
  
  try {
    let query = 'SELECT * FROM api_keys WHERE app_id = ?';
    const params = [appId];
    
    if (active_only) {
      query += ' AND revoked = 0 AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)';
    }
    
    if (environment) {
      query += ' AND environment = ?';
      params.push(environment);
    }
    
    query += ` ORDER BY ${sortBy} ${sortOrder === 'desc' ? 'DESC' : 'ASC'}`;
    
    return db.prepare(query).all(...params);
  } catch (error) {
    console.error('Erreur lors de la récupération des clés API:', error);
    throw new Error(`Impossible de récupérer les clés API: ${error.message}`);
  }
}

/**
 * Prolonger la validité d'une clé API
 * @param {number} id - ID de la clé API
 * @param {number} days - Nombre de jours à ajouter
 * @returns {Object} Clé API mise à jour
 */
function extendApiKeyValidity(id, days) {
  try {
    const key = getApiKeyById(id);
    if (!key) {
      throw new Error('Clé API non trouvée');
    }
    
    // Calculer la nouvelle date d'expiration
    const expirationDate = key.expires_at 
      ? new Date(key.expires_at) 
      : new Date();
    
    expirationDate.setDate(expirationDate.getDate() + days);
    
    // Mettre à jour la date d'expiration
    db.prepare(`
      UPDATE api_keys
      SET expires_at = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(expirationDate.toISOString(), id);
    
    return getApiKeyById(id);
  } catch (error) {
    console.error('Erreur lors de la prolongation de la clé API:', error);
    throw new Error(`Impossible de prolonger la clé API: ${error.message}`);
  }
}

// Exporter les fonctions du service
module.exports = {
  generateApiKey,
  createApiKey,
  getApiKeyById,
  getApiKeyByValue,
  revokeApiKey,
  deleteApiKey,
  validateApiKey,
  listApiKeys,
  extendApiKeyValidity
};