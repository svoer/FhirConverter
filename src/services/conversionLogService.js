/**
 * Service de journalisation des conversions HL7 vers FHIR
 * Enregistre et gère l'historique des conversions par application
 */

const { db } = require('../db/schema');
const { v4: uuidv4 } = require('uuid');
const { getApplicationById } = require('./applicationService');
const { getApiKeyById } = require('./apiKeyService');
const fs = require('fs');
const path = require('path');

/**
 * Créer un nouvel enregistrement de conversion
 * @param {Object} conversionData - Données de la conversion
 * @returns {Object} Conversion créée
 */
function createConversionLog(conversionData) {
  const { 
    app_id, 
    api_key_id, 
    source_type, 
    source_name, 
    source_size, 
    resource_count,
    status = 'success',
    error_message
  } = conversionData;
  
  try {
    // Générer un ID unique pour la conversion
    const conversionId = conversionData.conversion_id || uuidv4();
    
    const result = db.prepare(`
      INSERT INTO conversions (
        conversion_id, app_id, api_key_id, 
        source_type, source_name, source_size, 
        resource_count, status, error_message,
        completed_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `).run(
      conversionId,
      app_id,
      api_key_id,
      source_type,
      source_name,
      source_size,
      resource_count,
      status,
      error_message
    );
    
    // Mettre à jour les statistiques de l'application
    if (app_id) {
      updateAppStats(app_id, {
        conversion_count: 1,
        success_count: status === 'success' ? 1 : 0,
        error_count: status === 'error' ? 1 : 0,
        resource_count: resource_count || 0
      });
    }
    
    return getConversionById(conversionId);
  } catch (error) {
    console.error('Erreur lors de la création du log de conversion:', error);
    throw new Error(`Impossible de créer le log: ${error.message}`);
  }
}

/**
 * Mettre à jour les statistiques d'une application
 * @param {number} appId - ID de l'application
 * @param {Object} stats - Statistiques à ajouter
 * @private
 */
function updateAppStats(appId, stats) {
  try {
    const today = new Date().toISOString().split('T')[0];
    
    // Vérifier si des stats existent déjà pour aujourd'hui
    const existingStats = db.prepare(
      'SELECT * FROM app_stats WHERE app_id = ? AND date = ?'
    ).get(appId, today);
    
    if (existingStats) {
      // Mettre à jour les stats existantes
      db.prepare(`
        UPDATE app_stats
        SET conversion_count = conversion_count + ?,
            success_count = success_count + ?,
            error_count = error_count + ?,
            resource_count = resource_count + ?
        WHERE id = ?
      `).run(
        stats.conversion_count || 0,
        stats.success_count || 0,
        stats.error_count || 0,
        stats.resource_count || 0,
        existingStats.id
      );
    } else {
      // Créer de nouvelles stats
      db.prepare(`
        INSERT INTO app_stats (app_id, date, conversion_count, success_count, error_count, resource_count)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        appId,
        today,
        stats.conversion_count || 0,
        stats.success_count || 0,
        stats.error_count || 0,
        stats.resource_count || 0
      );
    }
  } catch (error) {
    console.error('Erreur lors de la mise à jour des statistiques:', error);
    // Ne pas échouer l'opération principale si la mise à jour des stats échoue
  }
}

/**
 * Obtenir une conversion par son ID
 * @param {string} id - ID de la conversion
 * @returns {Object|null} Conversion trouvée ou null
 */
function getConversionById(id) {
  try {
    return db.prepare('SELECT * FROM conversions WHERE conversion_id = ?').get(id);
  } catch (error) {
    console.error('Erreur lors de la récupération de la conversion:', error);
    throw new Error(`Impossible de récupérer la conversion: ${error.message}`);
  }
}

/**
 * Sauvegarder le contenu HL7 source et le résultat FHIR d'une conversion
 * @param {string} conversionId - ID de la conversion
 * @param {string} hl7Content - Contenu HL7 source
 * @param {Object|string} fhirContent - Contenu FHIR résultant (objet ou JSON)
 * @returns {Object} Chemins des fichiers sauvegardés
 */
function saveConversionContent(conversionId, hl7Content, fhirContent) {
  try {
    // Créer les répertoires de stockage si nécessaires
    const dataDir = path.join(__dirname, '../../data');
    const conversionsDir = path.join(dataDir, 'conversions');
    
    if (!fs.existsSync(conversionsDir)) {
      fs.mkdirSync(conversionsDir, { recursive: true });
    }
    
    // Créer un sous-répertoire pour cette conversion
    const conversionDir = path.join(conversionsDir, conversionId);
    
    if (!fs.existsSync(conversionDir)) {
      fs.mkdirSync(conversionDir, { recursive: true });
    }
    
    // Sauvegarder le contenu HL7
    const hl7Path = path.join(conversionDir, 'source.hl7');
    fs.writeFileSync(hl7Path, hl7Content);
    
    // Sauvegarder le contenu FHIR
    const fhirPath = path.join(conversionDir, 'result.json');
    const fhirJson = typeof fhirContent === 'object' 
      ? JSON.stringify(fhirContent, null, 2) 
      : fhirContent;
    
    fs.writeFileSync(fhirPath, fhirJson);
    
    return {
      hl7Path: hl7Path.replace(dataDir, ''),
      fhirPath: fhirPath.replace(dataDir, '')
    };
  } catch (error) {
    console.error('Erreur lors de la sauvegarde du contenu de conversion:', error);
    throw new Error(`Impossible de sauvegarder le contenu: ${error.message}`);
  }
}

/**
 * Charger le contenu sauvegardé d'une conversion
 * @param {string} conversionId - ID de la conversion
 * @returns {Object} Contenu HL7 et FHIR
 */
function loadConversionContent(conversionId) {
  try {
    const dataDir = path.join(__dirname, '../../data');
    const conversionDir = path.join(dataDir, 'conversions', conversionId);
    
    if (!fs.existsSync(conversionDir)) {
      throw new Error('Contenu de conversion non trouvé');
    }
    
    const hl7Path = path.join(conversionDir, 'source.hl7');
    const fhirPath = path.join(conversionDir, 'result.json');
    
    let hl7Content = null;
    let fhirContent = null;
    
    if (fs.existsSync(hl7Path)) {
      hl7Content = fs.readFileSync(hl7Path, 'utf8');
    }
    
    if (fs.existsSync(fhirPath)) {
      const fhirRaw = fs.readFileSync(fhirPath, 'utf8');
      try {
        fhirContent = JSON.parse(fhirRaw);
      } catch (e) {
        fhirContent = fhirRaw;
      }
    }
    
    return { hl7Content, fhirContent };
  } catch (error) {
    console.error('Erreur lors du chargement du contenu de conversion:', error);
    throw new Error(`Impossible de charger le contenu: ${error.message}`);
  }
}

/**
 * Lister les conversions
 * @param {Object} options - Options de filtrage et de pagination
 * @returns {Object} Liste des conversions avec pagination
 */
function listConversions(options = {}) {
  const { 
    app_id,
    status,
    startDate,
    endDate,
    limit = 20,
    offset = 0,
    sortBy = 'created_at',
    sortOrder = 'desc'
  } = options;
  
  try {
    let query = 'SELECT * FROM conversions WHERE 1=1';
    const params = [];
    
    if (app_id) {
      query += ' AND app_id = ?';
      params.push(app_id);
    }
    
    if (status) {
      query += ' AND status = ?';
      params.push(status);
    }
    
    if (startDate) {
      query += ' AND created_at >= ?';
      params.push(startDate);
    }
    
    if (endDate) {
      query += ' AND created_at <= ?';
      params.push(endDate);
    }
    
    // Compter le total
    const countQuery = query.replace('SELECT *', 'SELECT COUNT(*)');
    const totalCount = db.prepare(countQuery).get(...params)['COUNT(*)'];
    
    // Ajouter tri et pagination
    query += ` ORDER BY ${sortBy} ${sortOrder === 'desc' ? 'DESC' : 'ASC'}`;
    query += ' LIMIT ? OFFSET ?';
    params.push(limit, offset);
    
    const conversions = db.prepare(query).all(...params);
    
    return {
      total: totalCount,
      limit,
      offset,
      conversions
    };
  } catch (error) {
    console.error('Erreur lors de la récupération des conversions:', error);
    throw new Error(`Impossible de récupérer les conversions: ${error.message}`);
  }
}

/**
 * Supprimer les conversions selon les règles de rétention des applications
 * @returns {number} Nombre de conversions supprimées
 */
function cleanupConversions() {
  try {
    // Récupérer toutes les applications avec leur durée de rétention
    const apps = db.prepare('SELECT id, retention_days FROM applications').all();
    let totalDeleted = 0;
    
    for (const app of apps) {
      // Calculer la date limite pour cette application
      const retentionDays = app.retention_days || 30;
      const date = new Date();
      date.setDate(date.getDate() - retentionDays);
      const retentionDate = date.toISOString();
      
      // Récupérer les IDs des conversions à supprimer
      const conversionsToDelete = db.prepare(`
        SELECT conversion_id FROM conversions
        WHERE app_id = ? AND created_at < ?
      `).all(app.id, retentionDate);
      
      // Supprimer les fichiers de chaque conversion
      for (const conv of conversionsToDelete) {
        try {
          const convDir = path.join(__dirname, '../../data/conversions', conv.conversion_id);
          if (fs.existsSync(convDir)) {
            fs.rmdirSync(convDir, { recursive: true });
          }
        } catch (e) {
          console.error(`Erreur lors de la suppression des fichiers de conversion ${conv.conversion_id}:`, e);
        }
      }
      
      // Supprimer les enregistrements de conversion
      const result = db.prepare(`
        DELETE FROM conversions
        WHERE app_id = ? AND created_at < ?
      `).run(app.id, retentionDate);
      
      totalDeleted += result.changes;
    }
    
    return totalDeleted;
  } catch (error) {
    console.error('Erreur lors du nettoyage des conversions:', error);
    throw new Error(`Impossible de nettoyer les conversions: ${error.message}`);
  }
}

/**
 * Obtenir des statistiques globales sur les conversions
 * @param {Object} options - Options de filtrage (période, etc.)
 * @returns {Object} Statistiques sur les conversions
 */
function getConversionStats(options = {}) {
  const { app_id, startDate, endDate } = options;
  
  try {
    let query = `
      SELECT 
        COUNT(*) as total_conversions,
        SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as success_count,
        SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) as error_count,
        SUM(resource_count) as total_resources,
        AVG(resource_count) as avg_resources,
        AVG(source_size) as avg_source_size
      FROM conversions
      WHERE 1=1
    `;
    const params = [];
    
    if (app_id) {
      query += ' AND app_id = ?';
      params.push(app_id);
    }
    
    if (startDate) {
      query += ' AND created_at >= ?';
      params.push(startDate);
    }
    
    if (endDate) {
      query += ' AND created_at <= ?';
      params.push(endDate);
    }
    
    const stats = db.prepare(query).get(...params);
    
    // Obtenir les statistiques par jour
    let timeSeriesQuery = `
      SELECT 
        date(created_at) as date,
        COUNT(*) as conversions,
        SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as successes,
        SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) as errors,
        SUM(resource_count) as resources
      FROM conversions
      WHERE 1=1
    `;
    
    if (app_id) {
      timeSeriesQuery += ' AND app_id = ?';
    }
    
    if (startDate) {
      timeSeriesQuery += ' AND created_at >= ?';
    }
    
    if (endDate) {
      timeSeriesQuery += ' AND created_at <= ?';
    }
    
    timeSeriesQuery += ' GROUP BY date(created_at) ORDER BY date(created_at)';
    
    const timeSeriesData = db.prepare(timeSeriesQuery).all(...params);
    
    return {
      summary: {
        totalConversions: stats.total_conversions || 0,
        successCount: stats.success_count || 0,
        errorCount: stats.error_count || 0,
        totalResources: stats.total_resources || 0,
        averageResources: Math.round((stats.avg_resources || 0) * 10) / 10,
        averageSourceSize: Math.round((stats.avg_source_size || 0) * 10) / 10,
        successRate: stats.total_conversions 
          ? Math.round((stats.success_count / stats.total_conversions) * 1000) / 10 
          : 0
      },
      timeSeries: timeSeriesData
    };
  } catch (error) {
    console.error('Erreur lors de la récupération des statistiques:', error);
    throw new Error(`Impossible de récupérer les statistiques: ${error.message}`);
  }
}

/**
 * Supprimer une conversion et ses fichiers associés
 * @param {string} conversionId - ID de la conversion
 * @returns {boolean} Succès de la suppression
 */
function deleteConversion(conversionId) {
  try {
    // Supprimer les fichiers
    const convDir = path.join(__dirname, '../../data/conversions', conversionId);
    if (fs.existsSync(convDir)) {
      fs.rmdirSync(convDir, { recursive: true });
    }
    
    // Supprimer l'enregistrement
    const result = db.prepare('DELETE FROM conversions WHERE conversion_id = ?').run(conversionId);
    
    return result.changes > 0;
  } catch (error) {
    console.error('Erreur lors de la suppression de la conversion:', error);
    throw new Error(`Impossible de supprimer la conversion: ${error.message}`);
  }
}

/**
 * Enregistrer une conversion (alias pour createConversionLog)
 * @param {Object} data - Données de la conversion
 * @returns {Object} Conversion créée
 */
function logConversion(data) {
  // Adapter les noms de propriétés pour correspondre à la structure de la base de données
  const conversionData = {
    conversion_id: data.conversionId,
    app_id: data.appId,
    api_key_id: data.apiKeyId,
    source_type: data.sourceType,
    source_name: data.sourceName,
    source_size: data.sourceSize,
    resource_count: data.resourceCount,
    status: data.status,
    error_message: data.errorMessage
  };
  
  return createConversionLog(conversionData);
}

/**
 * Obtenir les logs de conversion pour une application
 * @param {number} appId - Identifiant de l'application (optionnel)
 * @param {number} limit - Nombre maximum de résultats
 * @param {number} offset - Décalage pour la pagination
 * @returns {Array} Liste des conversions
 */
function getConversionLogs(appId, limit = 100, offset = 0) {
  const options = {
    limit,
    offset,
    sortBy: 'created_at',
    sortOrder: 'desc'
  };
  
  if (appId) {
    options.app_id = appId;
  }
  
  const result = listConversions(options);
  return result.conversions;
}

// Exporter les fonctions du service
module.exports = {
  createConversionLog,
  getConversionById,
  saveConversionContent,
  loadConversionContent,
  listConversions,
  cleanupConversions,
  getConversionStats,
  deleteConversion,
  logConversion,
  getConversionLogs
};