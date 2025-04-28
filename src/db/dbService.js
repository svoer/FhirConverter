/**
 * Service de base de données pour FHIRHub
 * Ce module fournit des fonctions pour interagir avec la base de données SQLite
 */

const { db } = require('./schema');
const { v4: uuidv4 } = require('uuid');

/**
 * Récupérer une application par son ID
 * @param {number} appId - ID de l'application
 * @returns {Object|null} Application trouvée ou null
 */
function getApplicationById(appId) {
  try {
    return db.prepare('SELECT * FROM applications WHERE id = ?').get(appId);
  } catch (error) {
    console.error('[DB] Erreur lors de la récupération de l\'application:', error);
    return null;
  }
}

/**
 * Récupérer une application par le nom
 * @param {string} name - Nom de l'application
 * @returns {Object|null} Application trouvée ou null
 */
function getApplicationByName(name) {
  try {
    return db.prepare('SELECT * FROM applications WHERE name = ?').get(name);
  } catch (error) {
    console.error('[DB] Erreur lors de la récupération de l\'application par nom:', error);
    return null;
  }
}

/**
 * Vérifier si une clé API est valide
 * @param {string} apiKey - Clé API à vérifier
 * @returns {Object|null} Informations sur la clé API et l'application associée ou null
 */
function validateApiKey(apiKey) {
  try {
    const query = `
      SELECT 
        k.id as key_id, 
        k.app_id, 
        k.key, 
        k.is_active,
        a.name as app_name, 
        a.settings
      FROM api_keys k
      JOIN applications a ON k.app_id = a.id
      WHERE k.key = ? AND k.is_active = 1
    `;
    
    const apiKeyInfo = db.prepare(query).get(apiKey);
    
    if (apiKeyInfo) {
      // Mettre à jour la date de dernière utilisation
      db.prepare('UPDATE api_keys SET last_used = CURRENT_TIMESTAMP WHERE id = ?')
        .run(apiKeyInfo.key_id);
      
      // Essayer de parser les paramètres JSON
      try {
        apiKeyInfo.settings = JSON.parse(apiKeyInfo.settings);
      } catch (e) {
        apiKeyInfo.settings = {};
      }
    }
    
    return apiKeyInfo;
  } catch (error) {
    console.error('[DB] Erreur lors de la validation de la clé API:', error);
    return null;
  }
}

/**
 * Enregistrer une conversion dans l'historique
 * @param {Object} conversion - Données de la conversion
 * @returns {string} ID de la conversion créée
 */
function saveConversion(conversion) {
  try {
    const conversionId = conversion.conversion_id || uuidv4();
    
    const stmt = db.prepare(`
      INSERT INTO conversions (
        conversion_id, app_id, source_name, source_content,
        result_content, status, message, resource_count
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      conversionId,
      conversion.app_id || null,
      conversion.source_name,
      conversion.source_content,
      conversion.result_content,
      conversion.status,
      conversion.message || '',
      conversion.resource_count || 0
    );
    
    // Mettre à jour les statistiques pour l'application
    if (conversion.app_id) {
      updateAppStats(conversion.app_id, conversion.status, conversion.resource_count || 0);
    }
    
    return conversionId;
  } catch (error) {
    console.error('[DB] Erreur lors de l\'enregistrement de la conversion:', error);
    return null;
  }
}

/**
 * Récupérer l'historique des conversions
 * @param {Object} options - Options de filtrage
 * @returns {Array} Liste des conversions
 */
function getConversionHistory(options = {}) {
  try {
    let query = `
      SELECT 
        id, conversion_id, app_id, source_name, 
        status, message, resource_count, created_at
      FROM conversions
    `;
    
    const params = [];
    const conditions = [];
    
    if (options.appId) {
      conditions.push('app_id = ?');
      params.push(options.appId);
    }
    
    if (options.status) {
      conditions.push('status = ?');
      params.push(options.status);
    }
    
    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }
    
    query += ' ORDER BY created_at DESC';
    
    if (options.limit) {
      query += ' LIMIT ?';
      params.push(options.limit);
    }
    
    return db.prepare(query).all(...params);
  } catch (error) {
    console.error('[DB] Erreur lors de la récupération de l\'historique:', error);
    return [];
  }
}

/**
 * Récupérer une conversion par son ID
 * @param {string} conversionId - ID de la conversion
 * @returns {Object|null} Conversion trouvée ou null
 */
function getConversionById(conversionId) {
  try {
    return db.prepare('SELECT * FROM conversions WHERE conversion_id = ?').get(conversionId);
  } catch (error) {
    console.error('[DB] Erreur lors de la récupération de la conversion:', error);
    return null;
  }
}

/**
 * Mettre à jour les statistiques d'une application
 * @param {number} appId - ID de l'application
 * @param {string} status - Statut de la conversion (success/error)
 * @param {number} resourceCount - Nombre de ressources générées
 * @returns {boolean} Succès de la mise à jour
 */
function updateAppStats(appId, status, resourceCount) {
  try {
    // Obtenir la date du jour au format YYYY-MM-DD
    const today = new Date().toISOString().split('T')[0];
    
    // Vérifier si une entrée existe déjà pour cette date
    const existing = db.prepare('SELECT id FROM app_stats WHERE app_id = ? AND date = ?')
      .get(appId, today);
    
    if (existing) {
      // Mettre à jour les statistiques existantes
      db.prepare(`
        UPDATE app_stats SET
          conversion_count = conversion_count + 1,
          success_count = success_count + CASE WHEN ? = 'success' THEN 1 ELSE 0 END,
          error_count = error_count + CASE WHEN ? = 'error' THEN 1 ELSE 0 END,
          resource_count = resource_count + ?
        WHERE id = ?
      `).run(status, status, resourceCount, existing.id);
    } else {
      // Créer une nouvelle entrée pour aujourd'hui
      db.prepare(`
        INSERT INTO app_stats (
          app_id, date, conversion_count,
          success_count, error_count, resource_count
        )
        VALUES (?, ?, 1, ?, ?, ?)
      `).run(
        appId,
        today,
        status === 'success' ? 1 : 0,
        status === 'error' ? 1 : 0,
        resourceCount
      );
    }
    
    return true;
  } catch (error) {
    console.error('[DB] Erreur lors de la mise à jour des statistiques:', error);
    return false;
  }
}

/**
 * Récupérer les statistiques d'une application
 * @param {number} appId - ID de l'application
 * @param {number} days - Nombre de jours à considérer
 * @returns {Array} Statistiques de l'application
 */
function getAppStats(appId, days = 30) {
  try {
    // Calculer la date limite
    const date = new Date();
    date.setDate(date.getDate() - days);
    const limitDate = date.toISOString().split('T')[0];
    
    return db.prepare(`
      SELECT * FROM app_stats
      WHERE app_id = ? AND date >= ?
      ORDER BY date ASC
    `).all(appId, limitDate);
  } catch (error) {
    console.error('[DB] Erreur lors de la récupération des statistiques:', error);
    return [];
  }
}

/**
 * Supprimer les anciennes conversions
 * @param {number} days - Supprimer les conversions plus anciennes que ce nombre de jours
 * @returns {number} Nombre d'entrées supprimées
 */
function purgeOldConversions(days = 30) {
  try {
    // Calculer la date limite
    const date = new Date();
    date.setDate(date.getDate() - days);
    const limitDate = date.toISOString();
    
    const result = db.prepare(`
      DELETE FROM conversions
      WHERE created_at < ?
    `).run(limitDate);
    
    return result.changes;
  } catch (error) {
    console.error('[DB] Erreur lors de la purge des anciennes conversions:', error);
    return 0;
  }
}

/**
 * Récupérer les informations système
 * @returns {Object} Informations sur le système
 */
function getSystemInfo() {
  try {
    const dbInfo = {
      conversionCount: db.prepare('SELECT COUNT(*) as count FROM conversions').get().count,
      successCount: db.prepare('SELECT COUNT(*) as count FROM conversions WHERE status = ?').get('success').count,
      errorCount: db.prepare('SELECT COUNT(*) as count FROM conversions WHERE status = ?').get('error').count,
      appCount: db.prepare('SELECT COUNT(*) as count FROM applications').get().count,
      apiKeyCount: db.prepare('SELECT COUNT(*) as count FROM api_keys').get().count
    };
    
    return dbInfo;
  } catch (error) {
    console.error('[DB] Erreur lors de la récupération des informations système:', error);
    return {
      conversionCount: 0,
      successCount: 0,
      errorCount: 0,
      appCount: 0,
      apiKeyCount: 0
    };
  }
}

module.exports = {
  getApplicationById,
  getApplicationByName,
  validateApiKey,
  saveConversion,
  getConversionHistory,
  getConversionById,
  updateAppStats,
  getAppStats,
  purgeOldConversions,
  getSystemInfo
};