/**
 * Service de gestion des logs de conversion pour FHIRHub
 * Enregistre et récupère les logs des conversions HL7 vers FHIR
 */

const dbService = require('./dbService');

/**
 * Journaliser une conversion
 * @param {Object} logData - Données du journal
 * @param {number} logData.apiKeyId - ID de la clé API utilisée
 * @param {number} logData.applicationId - ID de l'application
 * @param {string} logData.sourceType - Type de source ('direct', 'file')
 * @param {string} logData.hl7Content - Contenu HL7 d'origine
 * @param {string} [logData.fhirContent] - Contenu FHIR généré
 * @param {string} logData.status - Statut de la conversion ('success', 'error')
 * @param {number} [logData.processingTime] - Temps de traitement en ms
 * @param {string} [logData.errorMessage] - Message d'erreur (si statut = 'error')
 * @returns {Promise<Object>} Résultat de l'insertion
 */
async function logConversion(logData) {
  try {
    const result = await dbService.run(
      `INSERT INTO conversion_logs 
       (api_key_id, application_id, source_type, hl7_content, fhir_content, status, processing_time, error_message, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
      [
        logData.apiKeyId,
        logData.applicationId,
        logData.sourceType,
        logData.hl7Content,
        logData.fhirContent || null,
        logData.status,
        logData.processingTime || null,
        logData.errorMessage || null
      ]
    );
    
    return { 
      success: true, 
      id: result.lastID 
    };
  } catch (error) {
    console.error('[CONVERSION-LOG] Erreur lors de la journalisation de la conversion:', error);
    
    // Retourner un succès même en cas d'erreur pour ne pas bloquer le flux principal
    return { 
      success: false, 
      error: error.message 
    };
  }
}

/**
 * Récupérer une conversion spécifique
 * @param {number} id - ID de la conversion
 * @param {number} applicationId - ID de l'application
 * @returns {Promise<Object>} Détails de la conversion
 */
async function getConversion(id, applicationId) {
  try {
    const conversion = await dbService.get(
      `SELECT * FROM conversion_logs WHERE id = ? AND application_id = ?`,
      [id, applicationId]
    );
    
    if (!conversion) {
      return null;
    }
    
    // Convertir le contenu FHIR en objet JSON
    if (conversion.fhir_content) {
      try {
        conversion.fhir_content = JSON.parse(conversion.fhir_content);
      } catch (e) {
        console.error('[CONVERSION-LOG] Erreur de parsing JSON pour le contenu FHIR:', e);
      }
    }
    
    return conversion;
  } catch (error) {
    console.error('[CONVERSION-LOG] Erreur lors de la récupération de la conversion:', error);
    throw error;
  }
}

/**
 * Récupérer l'historique des conversions
 * @param {number} applicationId - ID de l'application
 * @param {number} [limit=10] - Nombre de conversions à récupérer
 * @param {number} [page=1] - Numéro de page
 * @returns {Promise<Array>} Liste des conversions
 */
async function getConversions(applicationId, limit = 10, page = 1) {
  try {
    const offset = (page - 1) * limit;
    
    const conversions = await dbService.query(
      `SELECT id, source_type, status, processing_time, error_message, created_at
       FROM conversion_logs 
       WHERE application_id = ?
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,
      [applicationId, limit, offset]
    );
    
    return conversions;
  } catch (error) {
    console.error('[CONVERSION-LOG] Erreur lors de la récupération des conversions:', error);
    throw error;
  }
}

/**
 * Récupérer les statistiques de conversion
 * @param {number} applicationId - ID de l'application
 * @returns {Promise<Object>} Statistiques de conversion
 */
async function getAppStats(applicationId) {
  try {
    // Statistiques générales
    const generalStats = await dbService.get(
      `SELECT 
         COUNT(*) as total,
         SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as success_count,
         SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) as error_count,
         AVG(CASE WHEN status = 'success' THEN processing_time ELSE NULL END) as avg_processing_time
       FROM conversion_logs
       WHERE application_id = ?`,
      [applicationId]
    );
    
    // Statistiques par jour (7 derniers jours)
    const dailyStats = await dbService.query(
      `SELECT 
         date(created_at) as day,
         COUNT(*) as count,
         SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as success_count,
         SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) as error_count
       FROM conversion_logs
       WHERE application_id = ? AND created_at >= datetime('now', '-7 days')
       GROUP BY date(created_at)
       ORDER BY day DESC`,
      [applicationId]
    );
    
    // Dernières conversions
    const recentConversions = await dbService.query(
      `SELECT id, source_type, status, processing_time, error_message, created_at
       FROM conversion_logs
       WHERE application_id = ?
       ORDER BY created_at DESC
       LIMIT 5`,
      [applicationId]
    );
    
    return {
      general: generalStats,
      daily: dailyStats,
      recent: recentConversions
    };
  } catch (error) {
    console.error('[CONVERSION-LOG] Erreur lors de la récupération des statistiques:', error);
    throw error;
  }
}

/**
 * Nettoyer les anciennes conversions
 * @param {number} daysToKeep - Nombre de jours à conserver
 * @returns {Promise<number>} Nombre de conversions supprimées
 */
async function cleanupOldConversions(daysToKeep = 30) {
  try {
    console.log('[DB] Nettoyage de l\'historique des conversions');
    
    const result = await dbService.run(
      `DELETE FROM conversion_logs
       WHERE created_at < datetime('now', '-' || ? || ' days')`,
      [daysToKeep]
    );
    
    console.log(`[DB] Nettoyage terminé : ${result.changes} conversion(s) supprimée(s)`);
    
    return result.changes;
  } catch (error) {
    console.error('[CONVERSION-LOG] Erreur lors du nettoyage des conversions:', error);
    throw error;
  }
}

module.exports = {
  logConversion,
  getConversion,
  getConversions,
  getAppStats,
  cleanupOldConversions
};