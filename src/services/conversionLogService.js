/**
 * Service de journalisation des conversions pour FHIRHub
 * Gère l'enregistrement et la récupération des journaux de conversion
 */

const dbService = require('./dbService');

/**
 * Journaliser une conversion
 * @param {Object} logData - Données du journal
 * @returns {Promise<Object>} Journal de conversion créé
 */
async function logConversion(logData) {
  try {
    // S'assurer que les champs obligatoires sont présents
    if (!logData.application_id || !logData.source_type || !logData.status) {
      throw new Error('Données de journal incomplètes');
    }
    
    // Préparer les données d'insertion
    const insertData = {
      api_key_id: logData.api_key_id || null,
      application_id: logData.application_id,
      source_type: logData.source_type,
      hl7_content: logData.hl7_content || '',
      fhir_content: logData.fhir_content || null,
      status: logData.status,
      processing_time: logData.processing_time || null,
      error_message: logData.error_message || null,
      ip_address: logData.ip_address || null
    };
    
    // Insérer le journal dans la base de données
    const result = await dbService.run(
      `INSERT INTO conversion_logs (
        api_key_id, application_id, source_type, hl7_content, fhir_content,
        status, processing_time, error_message, ip_address
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        insertData.api_key_id,
        insertData.application_id,
        insertData.source_type,
        insertData.hl7_content,
        insertData.fhir_content,
        insertData.status,
        insertData.processing_time,
        insertData.error_message,
        insertData.ip_address
      ]
    );
    
    // Récupérer le journal créé
    return { id: result.lastID, ...insertData };
  } catch (error) {
    console.error('[CONVERSION-LOG] Erreur lors de la journalisation de la conversion:', error);
    throw error;
  }
}

/**
 * Obtenir un journal de conversion par son ID
 * @param {number} id - ID du journal
 * @param {number} applicationId - ID de l'application (pour vérifier l'accès)
 * @returns {Promise<Object|null>} Journal de conversion ou null si non trouvé
 */
async function getConversion(id, applicationId) {
  try {
    return await dbService.get(
      `SELECT 
        c.id, c.api_key_id, c.application_id, c.source_type,
        c.status, c.processing_time, c.error_message, c.created_at,
        a.name as application_name, k.name as api_key_name
      FROM conversion_logs c
      LEFT JOIN applications a ON c.application_id = a.id
      LEFT JOIN api_keys k ON c.api_key_id = k.id
      WHERE c.id = ? AND c.application_id = ?`,
      [id, applicationId]
    );
  } catch (error) {
    console.error('[CONVERSION-LOG] Erreur lors de la récupération du journal de conversion:', error);
    return null;
  }
}

/**
 * Obtenir tous les journaux de conversion d'une application
 * @param {number} applicationId - ID de l'application
 * @param {number} limit - Nombre de journaux à récupérer
 * @param {number} page - Numéro de page
 * @returns {Promise<Array>} Journaux de conversion
 */
async function getConversions(applicationId, limit = 20, page = 1) {
  try {
    const offset = (page - 1) * limit;
    
    return await dbService.query(
      `SELECT 
        c.id, c.api_key_id, c.application_id, c.source_type,
        c.status, c.processing_time, c.error_message, c.created_at,
        a.name as application_name, k.name as api_key_name
      FROM conversion_logs c
      LEFT JOIN applications a ON c.application_id = a.id
      LEFT JOIN api_keys k ON c.api_key_id = k.id
      WHERE c.application_id = ?
      ORDER BY c.created_at DESC
      LIMIT ? OFFSET ?`,
      [applicationId, limit, offset]
    );
  } catch (error) {
    console.error('[CONVERSION-LOG] Erreur lors de la récupération des journaux de conversion:', error);
    return [];
  }
}

/**
 * Obtenir les détails complets d'un journal de conversion
 * @param {number} id - ID du journal
 * @param {number} applicationId - ID de l'application (pour vérifier l'accès)
 * @returns {Promise<Object|null>} Journal de conversion avec contenu complet ou null si non trouvé
 */
async function getConversionDetails(id, applicationId) {
  try {
    return await dbService.get(
      `SELECT *
      FROM conversion_logs
      WHERE id = ? AND application_id = ?`,
      [id, applicationId]
    );
  } catch (error) {
    console.error('[CONVERSION-LOG] Erreur lors de la récupération des détails du journal de conversion:', error);
    return null;
  }
}

/**
 * Supprimer un journal de conversion
 * @param {number} id - ID du journal
 * @param {number} applicationId - ID de l'application (pour vérifier l'accès)
 * @returns {Promise<boolean>} True si la suppression a réussi
 */
async function deleteConversion(id, applicationId) {
  try {
    const result = await dbService.run(
      'DELETE FROM conversion_logs WHERE id = ? AND application_id = ?',
      [id, applicationId]
    );
    
    return result.changes > 0;
  } catch (error) {
    console.error('[CONVERSION-LOG] Erreur lors de la suppression du journal de conversion:', error);
    return false;
  }
}

/**
 * Supprimer tous les journaux de conversion d'une application
 * @param {number} applicationId - ID de l'application
 * @returns {Promise<number>} Nombre de journaux supprimés
 */
async function deleteAllConversions(applicationId) {
  try {
    const result = await dbService.run(
      'DELETE FROM conversion_logs WHERE application_id = ?',
      [applicationId]
    );
    
    return result.changes;
  } catch (error) {
    console.error('[CONVERSION-LOG] Erreur lors de la suppression des journaux de conversion:', error);
    return 0;
  }
}

/**
 * Nettoyer les anciens journaux de conversion (rétention d'un mois)
 * @returns {Promise<number>} Nombre de journaux supprimés
 */
async function cleanupOldConversions() {
  try {
    const result = await dbService.run(
      `DELETE FROM conversion_logs 
      WHERE created_at < datetime('now', '-1 month')`
    );
    
    return result.changes;
  } catch (error) {
    console.error('[CONVERSION-LOG] Erreur lors du nettoyage des anciens journaux de conversion:', error);
    return 0;
  }
}

/**
 * Obtenir les statistiques de conversion pour une application
 * @param {number} applicationId - ID de l'application
 * @returns {Promise<Object>} Statistiques de conversion
 */
async function getAppStats(applicationId) {
  try {
    // Récupérer les statistiques générales
    const general = await dbService.get(
      `SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as success_count,
        SUM(CASE WHEN status != 'success' THEN 1 ELSE 0 END) as error_count,
        AVG(processing_time) as avg_processing_time
      FROM conversion_logs
      WHERE application_id = ?`,
      [applicationId]
    );
    
    // Récupérer les statistiques quotidiennes des 30 derniers jours
    const daily = await dbService.query(
      `SELECT 
        date(created_at) as date,
        COUNT(*) as total,
        SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as success_count,
        SUM(CASE WHEN status != 'success' THEN 1 ELSE 0 END) as error_count,
        AVG(processing_time) as avg_processing_time
      FROM conversion_logs
      WHERE application_id = ? AND created_at > datetime('now', '-30 days')
      GROUP BY date(created_at)
      ORDER BY date(created_at) DESC`,
      [applicationId]
    );
    
    // Récupérer les 10 conversions les plus récentes
    const recent = await dbService.query(
      `SELECT 
        c.id, c.source_type, c.status, c.processing_time, c.created_at,
        k.name as api_key_name
      FROM conversion_logs c
      LEFT JOIN api_keys k ON c.api_key_id = k.id
      WHERE c.application_id = ?
      ORDER BY c.created_at DESC
      LIMIT 10`,
      [applicationId]
    );
    
    return {
      general,
      daily,
      recent
    };
  } catch (error) {
    console.error('[CONVERSION-LOG] Erreur lors de la récupération des statistiques de conversion:', error);
    
    return {
      general: {
        total: 0,
        success_count: 0,
        error_count: 0,
        avg_processing_time: 0
      },
      daily: [],
      recent: []
    };
  }
}

module.exports = {
  logConversion,
  getConversion,
  getConversions,
  getConversionDetails,
  deleteConversion,
  deleteAllConversions,
  cleanupOldConversions,
  getAppStats
};