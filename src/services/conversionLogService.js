/**
 * Service de gestion des logs de conversion
 * Enregistre et récupère les logs de conversion pour l'application FHIRHub
 */
const db = require('../db/dbService');
const conversionLogsExporter = require('../conversionLogsExporter');

/**
 * Enregistre un log de conversion
 * @param {Object} conversionData - Données de conversion à enregistrer
 * @returns {Object} - Log de conversion enregistré
 */
async function logConversion(conversionData) {
  try {
    // Valeurs par défaut
    const defaultData = {
      status: 'error',
      input_message: '',
      output_message: '',
      processing_time: 0,
      resource_count: 0,
      timestamp: new Date().toISOString(),
      api_key_id: null,
      application_id: null,
      user_id: null
    };

    // Fusionner avec les données fournies
    const data = { ...defaultData, ...conversionData };

    // Requête SQL dynamique pour s'adapter aux changements potentiels de schéma
    const columns = Object.keys(data).filter(key => 
      key !== 'id' && 
      key !== '_id' && 
      key !== 'application_name' && 
      key !== 'api_key_name'
    );
    
    const placeholders = columns.map(() => '?').join(', ');
    const values = columns.map(col => data[col]);

    const query = `
      INSERT INTO conversion_logs (${columns.join(', ')})
      VALUES (${placeholders})
    `;

    // Exécuter la requête
    const result = await db.run(query, values);
    
    // Récupérer l'ID généré
    const id = result.lastID;
    
    // Créer l'objet complet
    const logRecord = {
      id,
      ...data
    };

    // Si des informations sur l'application ou la clé API sont fournies, les récupérer
    if (data.application_id) {
      try {
        const app = await db.get(
          'SELECT name FROM applications WHERE id = ?', 
          [data.application_id]
        );
        if (app) {
          logRecord.application_name = app.name;
        }
      } catch (error) {
        console.error('[CONVERSION-LOGS] Erreur lors de la récupération des infos d\'application:', error);
      }
    }

    if (data.api_key_id) {
      try {
        const apiKey = await db.get(
          'SELECT description FROM api_keys WHERE id = ?', 
          [data.api_key_id]
        );
        if (apiKey) {
          logRecord.api_key_name = apiKey.description;
        }
      } catch (error) {
        console.error('[CONVERSION-LOGS] Erreur lors de la récupération des infos de clé API:', error);
      }
    }

    // Enregistrer pour les métriques en temps réel
    if (conversionLogsExporter && typeof conversionLogsExporter.logNewConversion === 'function') {
      conversionLogsExporter.logNewConversion({
        ...logRecord,
        input_preview: logRecord.input_message?.substring(0, 50) || 'No input'
      });
    }

    return logRecord;
  } catch (error) {
    console.error('[CONVERSION-LOGS] Erreur lors de l\'enregistrement du log:', error);
    throw error;
  }
}

/**
 * Récupère les logs de conversion avec filtrage
 * @param {Object} options - Options de filtrage
 * @returns {Array} - Liste des logs de conversion
 */
async function getConversionLogs(options = {}) {
  try {
    const {
      applicationId,
      apiKeyId,
      status,
      startDate,
      endDate,
      limit = 100,
      offset = 0
    } = options;

    // Construire la requête SQL dynamiquement
    let query = `
      SELECT 
        c.id, 
        c.api_key_id, 
        c.application_id, 
        SUBSTR(c.input_message, 1, 50) as input_preview,
        c.status, 
        c.processing_time, 
        c.timestamp,
        c.resource_count,
        a.name as application_name, 
        k.description as api_key_name
      FROM conversion_logs c
      LEFT JOIN applications a ON c.application_id = a.id
      LEFT JOIN api_keys k ON c.api_key_id = k.id
    `;

    const whereConditions = [];
    const params = [];

    // Ajouter les conditions de filtrage
    if (applicationId) {
      whereConditions.push('c.application_id = ?');
      params.push(applicationId);
    }

    if (apiKeyId) {
      whereConditions.push('c.api_key_id = ?');
      params.push(apiKeyId);
    }

    if (status) {
      whereConditions.push('c.status = ?');
      params.push(status);
    }

    if (startDate) {
      whereConditions.push('c.timestamp >= ?');
      params.push(startDate);
    }

    if (endDate) {
      whereConditions.push('c.timestamp <= ?');
      params.push(endDate);
    }

    // Ajouter la clause WHERE si nécessaire
    if (whereConditions.length > 0) {
      query += ' WHERE ' + whereConditions.join(' AND ');
    }

    // Ajouter tri et pagination
    query += ' ORDER BY c.timestamp DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    // Exécuter la requête
    return await db.all(query, params);
  } catch (error) {
    console.error('[CONVERSION-LOGS] Erreur lors de la récupération des logs:', error);
    throw error;
  }
}

/**
 * Compte le nombre total de logs correspondant aux critères
 * @param {Object} options - Options de filtrage
 * @returns {Number} - Nombre de logs
 */
async function countConversionLogs(options = {}) {
  try {
    const {
      applicationId,
      apiKeyId,
      status,
      startDate,
      endDate
    } = options;

    // Construire la requête SQL dynamiquement
    let query = 'SELECT COUNT(*) as count FROM conversion_logs c';

    const whereConditions = [];
    const params = [];

    // Ajouter les conditions de filtrage
    if (applicationId) {
      whereConditions.push('c.application_id = ?');
      params.push(applicationId);
    }

    if (apiKeyId) {
      whereConditions.push('c.api_key_id = ?');
      params.push(apiKeyId);
    }

    if (status) {
      whereConditions.push('c.status = ?');
      params.push(status);
    }

    if (startDate) {
      whereConditions.push('c.timestamp >= ?');
      params.push(startDate);
    }

    if (endDate) {
      whereConditions.push('c.timestamp <= ?');
      params.push(endDate);
    }

    // Ajouter la clause WHERE si nécessaire
    if (whereConditions.length > 0) {
      query += ' WHERE ' + whereConditions.join(' AND ');
    }

    // Exécuter la requête
    const result = await db.get(query, params);
    return result.count;
  } catch (error) {
    console.error('[CONVERSION-LOGS] Erreur lors du comptage des logs:', error);
    throw error;
  }
}

/**
 * Supprime les logs de conversion plus anciens qu'un certain nombre de jours
 * @param {Number} daysToKeep - Nombre de jours à conserver
 * @returns {Number} - Nombre de logs supprimés
 */
async function deleteOldLogs(daysToKeep = 30) {
  try {
    // Calculer la date limite
    const date = new Date();
    date.setDate(date.getDate() - daysToKeep);
    const limitDate = date.toISOString();

    // Exécuter la requête
    const result = await db.run(
      'DELETE FROM conversion_logs WHERE timestamp < ?',
      [limitDate]
    );

    return result.changes;
  } catch (error) {
    console.error('[CONVERSION-LOGS] Erreur lors de la suppression des anciens logs:', error);
    throw error;
  }
}

/**
 * Obtient les statistiques des conversions
 * @returns {Object} - Statistiques de conversion
 */
async function getConversionStats() {
  try {
    // Statistiques totales
    const totalStats = await db.get(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as success,
        SUM(CASE WHEN status != 'success' THEN 1 ELSE 0 END) as failure,
        AVG(processing_time) as avg_time,
        MAX(processing_time) as max_time,
        MIN(processing_time) as min_time,
        AVG(resource_count) as avg_resources
      FROM conversion_logs
    `);

    // Statistiques des dernières 24 heures
    const dayAgo = new Date();
    dayAgo.setDate(dayAgo.getDate() - 1);
    const dayAgoStr = dayAgo.toISOString();

    const recentStats = await db.get(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as success,
        SUM(CASE WHEN status != 'success' THEN 1 ELSE 0 END) as failure
      FROM conversion_logs
      WHERE timestamp >= ?
    `, [dayAgoStr]);

    // Statistiques par application
    const appStats = await db.all(`
      SELECT 
        a.id as application_id,
        a.name as application_name,
        COUNT(c.id) as conversion_count,
        SUM(CASE WHEN c.status = 'success' THEN 1 ELSE 0 END) as success_count,
        SUM(CASE WHEN c.status != 'success' THEN 1 ELSE 0 END) as failure_count
      FROM conversion_logs c
      LEFT JOIN applications a ON c.application_id = a.id
      GROUP BY c.application_id
      ORDER BY conversion_count DESC
      LIMIT 10
    `);

    return {
      total: totalStats,
      recent: recentStats,
      byApplication: appStats
    };
  } catch (error) {
    console.error('[CONVERSION-LOGS] Erreur lors de la récupération des statistiques:', error);
    throw error;
  }
}

/**
 * Récupère la liste des applications pour le filtrage
 * @returns {Array} - Liste des applications
 */
async function getApplicationsForFilter() {
  try {
    return await db.all(`
      SELECT DISTINCT 
        a.id, 
        a.name
      FROM applications a
      JOIN conversion_logs c ON a.id = c.application_id
      ORDER BY a.name
    `);
  } catch (error) {
    console.error('[CONVERSION-LOGS] Erreur lors de la récupération des applications:', error);
    return [];
  }
}

module.exports = {
  logConversion,
  getConversionLogs,
  countConversionLogs,
  deleteOldLogs,
  getConversionStats,
  getApplicationsForFilter
};