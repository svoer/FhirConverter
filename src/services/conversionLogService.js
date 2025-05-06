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
    if (!logData.application_id || !logData.status) {
      throw new Error('Données de journal incomplètes');
    }
    
    // Préparer les données d'insertion adaptées au schéma réel de la table
    const insertData = {
      api_key_id: logData.api_key_id || null,
      application_id: logData.application_id,
      input_message: logData.hl7_content || logData.input_message || '',
      output_message: logData.fhir_content || logData.output_message || null,
      status: logData.status,
      timestamp: new Date().toISOString(),
      processing_time: logData.processing_time || 0,
      resource_count: logData.resource_count || 0,
      user_id: logData.user_id || null
    };
    
    // Insérer le journal dans la base de données
    const result = await dbService.run(
      `INSERT INTO conversion_logs (
        api_key_id, application_id, input_message, output_message,
        status, timestamp, processing_time, resource_count, user_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        insertData.api_key_id,
        insertData.application_id,
        insertData.input_message,
        insertData.output_message,
        insertData.status,
        insertData.timestamp,
        insertData.processing_time,
        insertData.resource_count,
        insertData.user_id
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
        c.id, c.api_key_id, c.application_id, c.input_message,
        c.status, c.processing_time, c.timestamp,
        a.name as application_name, k.description as api_key_name
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
        c.id, c.api_key_id, c.application_id, c.input_message,
        c.status, c.processing_time, c.resource_count, c.timestamp,
        a.name as application_name, k.description as api_key_name
      FROM conversion_logs c
      LEFT JOIN applications a ON c.application_id = a.id
      LEFT JOIN api_keys k ON c.api_key_id = k.id
      WHERE c.application_id = ?
      ORDER BY c.timestamp DESC
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
      WHERE timestamp < datetime('now', '-1 month')`
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
    let daily = [];
    try {
      daily = await dbService.query(
        `SELECT 
          date(timestamp) as date,
          COUNT(*) as total,
          SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as success_count,
          SUM(CASE WHEN status != 'success' THEN 1 ELSE 0 END) as error_count,
          AVG(processing_time) as avg_processing_time
        FROM conversion_logs
        WHERE application_id = ? AND timestamp > datetime('now', '-30 days')
        GROUP BY date(timestamp)
        ORDER BY date(timestamp) DESC`,
        [applicationId]
      );
    } catch (error) {
      console.error('[CONVERSION-LOG] Erreur lors de la récupération des statistiques quotidiennes:', error);
    }
    
    // Récupérer les 10 conversions les plus récentes
    let recent = [];
    try {
      recent = await dbService.query(
        `SELECT 
          c.id, c.input_message as source_type, c.status, c.processing_time, c.timestamp as created_at,
          k.description as api_key_name
        FROM conversion_logs c
        LEFT JOIN api_keys k ON c.api_key_id = k.id
        WHERE c.application_id = ?
        ORDER BY c.timestamp DESC
        LIMIT 10`,
        [applicationId]
      );
    } catch (error) {
      console.error('[CONVERSION-LOG] Erreur lors de la récupération des conversions récentes:', error);
    }
    
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