/**
 * Service de gestion des logs et statistiques de conversion
 * Fournit des fonctions pour enregistrer, récupérer et analyser les conversions HL7 vers FHIR
 */

const { db } = require('../db/schema');
const { v4: uuidv4 } = require('uuid');
const { getApplicationById } = require('./applicationService');

/**
 * Créer un nouveau log de conversion
 * @param {Object} conversionData - Données de la conversion
 * @param {number} [conversionData.appId] - ID de l'application
 * @param {number} [conversionData.apiKeyId] - ID de la clé API
 * @param {string} conversionData.sourceType - Type de source ('file', 'text', 'api')
 * @param {string} [conversionData.sourceName] - Nom de la source (ex: nom du fichier)
 * @param {number} [conversionData.sourceSize] - Taille de la source en octets
 * @returns {Object} Log de conversion créé
 */
function createConversionLog(conversionData) {
  try {
    const conversionId = uuidv4();
    
    const result = db.prepare(`
      INSERT INTO conversions (
        conversion_id, app_id, api_key_id, source_type, 
        source_name, source_size, status
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      conversionId,
      conversionData.appId || null,
      conversionData.apiKeyId || null,
      conversionData.sourceType || 'api',
      conversionData.sourceName || null,
      conversionData.sourceSize || null,
      'pending'
    );
    
    return getConversionLogById(result.lastInsertRowid);
  } catch (error) {
    console.error('Erreur lors de la création du log de conversion:', error);
    throw new Error(`Impossible de créer le log de conversion: ${error.message}`);
  }
}

/**
 * Mettre à jour un log de conversion
 * @param {string} conversionId - ID de la conversion
 * @param {Object} updateData - Données à mettre à jour
 * @param {string} [updateData.status] - Statut de la conversion ('success', 'error')
 * @param {string} [updateData.errorMessage] - Message d'erreur
 * @param {number} [updateData.resourceCount] - Nombre de ressources générées
 * @returns {Object} Log de conversion mis à jour
 */
function updateConversionLog(conversionId, updateData) {
  try {
    const fields = [];
    const values = [];
    
    if (updateData.status) {
      fields.push('status = ?');
      values.push(updateData.status);
    }
    
    if (updateData.errorMessage !== undefined) {
      fields.push('error_message = ?');
      values.push(updateData.errorMessage);
    }
    
    if (updateData.resourceCount !== undefined) {
      fields.push('resource_count = ?');
      values.push(updateData.resourceCount);
    }
    
    if (updateData.status === 'success' || updateData.status === 'error') {
      fields.push('completed_at = CURRENT_TIMESTAMP');
      
      // Mettre à jour les statistiques
      updateAppStats(conversionId);
    }
    
    if (fields.length === 0) {
      return getConversionLogByUuid(conversionId);
    }
    
    const query = `
      UPDATE conversions
      SET ${fields.join(', ')}
      WHERE conversion_id = ?
    `;
    
    db.prepare(query).run(...values, conversionId);
    
    return getConversionLogByUuid(conversionId);
  } catch (error) {
    console.error('Erreur lors de la mise à jour du log de conversion:', error);
    throw new Error(`Impossible de mettre à jour le log de conversion: ${error.message}`);
  }
}

/**
 * Récupérer un log de conversion par son ID interne
 * @param {number} id - ID interne de la conversion
 * @returns {Object|null} Log de conversion ou null
 */
function getConversionLogById(id) {
  try {
    return db.prepare('SELECT * FROM conversions WHERE id = ?').get(id);
  } catch (error) {
    console.error('Erreur lors de la récupération du log de conversion:', error);
    throw new Error(`Impossible de récupérer le log de conversion: ${error.message}`);
  }
}

/**
 * Récupérer un log de conversion par son UUID
 * @param {string} uuid - UUID de la conversion
 * @returns {Object|null} Log de conversion ou null
 */
function getConversionLogByUuid(uuid) {
  try {
    return db.prepare('SELECT * FROM conversions WHERE conversion_id = ?').get(uuid);
  } catch (error) {
    console.error('Erreur lors de la récupération du log de conversion:', error);
    throw new Error(`Impossible de récupérer le log de conversion: ${error.message}`);
  }
}

/**
 * Récupérer les logs de conversion pour une application
 * @param {number} appId - ID de l'application
 * @param {Object} [options] - Options de pagination et filtrage
 * @param {number} [options.limit=10] - Nombre maximum de résultats
 * @param {number} [options.offset=0] - Décalage pour la pagination
 * @param {string} [options.status] - Filtrer par statut ('success', 'error', 'pending')
 * @param {string} [options.sortBy='created_at'] - Champ de tri
 * @param {string} [options.sortOrder='desc'] - Ordre de tri ('asc', 'desc')
 * @returns {Array} Logs de conversion
 */
function getConversionLogs(appId, options = {}) {
  const { 
    limit = 10, 
    offset = 0, 
    status, 
    sortBy = 'created_at', 
    sortOrder = 'desc' 
  } = options;
  
  try {
    let query = 'SELECT * FROM conversions WHERE app_id = ?';
    const params = [appId];
    
    if (status) {
      query += ' AND status = ?';
      params.push(status);
    }
    
    query += ` ORDER BY ${sortBy} ${sortOrder === 'desc' ? 'DESC' : 'ASC'}`;
    query += ' LIMIT ? OFFSET ?';
    params.push(limit, offset);
    
    return db.prepare(query).all(...params);
  } catch (error) {
    console.error('Erreur lors de la récupération des logs de conversion:', error);
    throw new Error(`Impossible de récupérer les logs de conversion: ${error.message}`);
  }
}

/**
 * Mettre à jour les statistiques d'une application suite à une conversion
 * @param {string} conversionId - ID de la conversion
 * @returns {boolean} Succès de la mise à jour
 */
function updateAppStats(conversionId) {
  try {
    // Récupérer les informations de la conversion
    const conversion = getConversionLogByUuid(conversionId);
    if (!conversion || !conversion.app_id) {
      return false;
    }
    
    // Obtenir la date du jour au format YYYY-MM-DD
    const today = new Date().toISOString().split('T')[0];
    
    // Vérifier si des statistiques existent déjà pour cette application et cette date
    const existingStats = db.prepare(`
      SELECT id FROM app_stats
      WHERE app_id = ? AND date = ?
    `).get(conversion.app_id, today);
    
    const isSuccess = conversion.status === 'success';
    const isError = conversion.status === 'error';
    const resourceCount = conversion.resource_count || 0;
    
    if (existingStats) {
      // Mettre à jour les statistiques existantes
      db.prepare(`
        UPDATE app_stats
        SET 
          conversion_count = conversion_count + 1,
          success_count = success_count + ?,
          error_count = error_count + ?,
          resource_count = resource_count + ?
        WHERE id = ?
      `).run(
        isSuccess ? 1 : 0,
        isError ? 1 : 0,
        resourceCount,
        existingStats.id
      );
    } else {
      // Créer de nouvelles statistiques
      db.prepare(`
        INSERT INTO app_stats (
          app_id, date, conversion_count, 
          success_count, error_count, resource_count
        )
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        conversion.app_id,
        today,
        1,
        isSuccess ? 1 : 0,
        isError ? 1 : 0,
        resourceCount
      );
    }
    
    return true;
  } catch (error) {
    console.error('Erreur lors de la mise à jour des statistiques:', error);
    return false; // Ne pas échouer l'opération principale
  }
}

/**
 * Récupérer les statistiques globales d'une application
 * @param {number} appId - ID de l'application
 * @returns {Object} Statistiques globales
 */
function getAppStats(appId) {
  try {
    // Vérifier si l'application existe
    const app = getApplicationById(appId);
    if (!app) {
      throw new Error('Application non trouvée');
    }
    
    // Statistiques globales
    const stats = db.prepare(`
      SELECT 
        COALESCE(SUM(conversion_count), 0) as total,
        COALESCE(SUM(success_count), 0) as success,
        COALESCE(SUM(error_count), 0) as failed,
        COALESCE(SUM(resource_count), 0) as resources
      FROM app_stats
      WHERE app_id = ?
    `).get(appId);
    
    // Dernière conversion
    const lastConversion = db.prepare(`
      SELECT created_at as lastConversion
      FROM conversions
      WHERE app_id = ?
      ORDER BY created_at DESC
      LIMIT 1
    `).get(appId);
    
    return {
      total: stats.total || 0,
      success: stats.success || 0,
      failed: stats.failed || 0,
      resources: stats.resources || 0,
      lastConversion: lastConversion ? lastConversion.lastConversion : null
    };
  } catch (error) {
    console.error('Erreur lors de la récupération des statistiques:', error);
    throw new Error(`Impossible de récupérer les statistiques: ${error.message}`);
  }
}

/**
 * Nettoyer les anciens logs de conversion
 * @returns {number} Nombre de logs supprimés
 */
function cleanupOldConversionLogs() {
  try {
    // Récupérer toutes les applications avec leur période de rétention
    const apps = db.prepare(`
      SELECT id, retention_days FROM applications
    `).all();
    
    let totalDeleted = 0;
    
    // Pour chaque application, supprimer les logs plus anciens que la période de rétention
    apps.forEach(app => {
      const retentionDays = app.retention_days || 30;
      
      const result = db.prepare(`
        DELETE FROM conversions
        WHERE app_id = ? AND created_at < datetime('now', '-' || ? || ' days')
      `).run(app.id, retentionDays);
      
      totalDeleted += result.changes;
    });
    
    return totalDeleted;
  } catch (error) {
    console.error('Erreur lors du nettoyage des logs de conversion:', error);
    return 0;
  }
}

/**
 * Récupérer les statistiques globales de conversion
 * @returns {Object} Statistiques globales
 */
function getGlobalStats() {
  try {
    // Statistiques globales
    const stats = db.prepare(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as success,
        SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) as error,
        SUM(resource_count) as resources
      FROM conversions
    `).get();
    
    // Dernière conversion
    const lastConversion = db.prepare(`
      SELECT created_at
      FROM conversions
      ORDER BY created_at DESC
      LIMIT 1
    `).get();
    
    return {
      total: stats.total || 0,
      success: stats.success || 0,
      error: stats.error || 0,
      resources: stats.resources || 0,
      lastConversion: lastConversion ? lastConversion.created_at : null
    };
  } catch (error) {
    console.error('Erreur lors de la récupération des statistiques globales:', error);
    throw new Error(`Impossible de récupérer les statistiques globales: ${error.message}`);
  }
}

module.exports = {
  createConversionLog,
  updateConversionLog,
  getConversionLogById,
  getConversionLogByUuid,
  getConversionLogs,
  getAppStats,
  cleanupOldConversionLogs,
  getGlobalStats
};