/**
 * Service de gestion des logs de conversion
 * Enregistre et récupère les informations sur les conversions HL7 vers FHIR
 * Implémente également l'agrégation de statistiques pour le tableau de bord
 */

const { db } = require('../db');
const { conversionLogs, dashboardMetrics } = require('../db/schema');
const { eq, and, gte, lte, desc, sql, count, avg, sum } = require('drizzle-orm');
const { format, subDays, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth } = require('date-fns');

/**
 * Créer un nouveau log de conversion
 * @param {Object} logData - Données du log de conversion
 * @returns {Promise<Object>} Log de conversion créé
 */
async function createConversionLog(logData) {
  const {
    applicationId,
    apiKeyId,
    requestType,
    sourceFilename,
    targetFilename,
    status,
    message,
    errorDetails,
    conversionTime,
    inputSize,
    outputSize,
    requestIp,
    requestEndpoint,
    resourceCount
  } = logData;
  
  const [log] = await db.insert(conversionLogs)
    .values({
      applicationId,
      apiKeyId,
      requestType,
      sourceFilename,
      targetFilename,
      status,
      message,
      errorDetails,
      conversionTime,
      inputSize,
      outputSize,
      createdAt: new Date(),
      requestIp,
      requestEndpoint,
      resourceCount
    })
    .returning();
  
  // Mettre à jour les métriques du tableau de bord de manière asynchrone
  // sans attendre la fin pour ne pas ralentir la réponse API
  updateDashboardMetrics(applicationId).catch(err => {
    console.error('[LOG] Erreur lors de la mise à jour des métriques:', err);
  });
  
  return log;
}

/**
 * Récupérer les logs de conversion
 * @param {Object} options - Options de filtrage et de pagination
 * @returns {Promise<Array>} Liste des logs de conversion
 */
async function getConversionLogs(options = {}) {
  const {
    applicationId,
    apiKeyId,
    status,
    startDate,
    endDate,
    requestType,
    limit = 100,
    offset = 0
  } = options;
  
  let query = db.select().from(conversionLogs);
  
  // Appliquer les filtres
  if (applicationId) {
    query = query.where(eq(conversionLogs.applicationId, applicationId));
  }
  
  if (apiKeyId) {
    query = query.where(eq(conversionLogs.apiKeyId, apiKeyId));
  }
  
  if (status) {
    query = query.where(eq(conversionLogs.status, status));
  }
  
  if (requestType) {
    query = query.where(eq(conversionLogs.requestType, requestType));
  }
  
  if (startDate) {
    query = query.where(gte(conversionLogs.createdAt, new Date(startDate)));
  }
  
  if (endDate) {
    query = query.where(lte(conversionLogs.createdAt, new Date(endDate)));
  }
  
  return await query
    .orderBy(desc(conversionLogs.createdAt))
    .limit(limit)
    .offset(offset);
}

/**
 * Récupérer un log de conversion par son ID
 * @param {number} id - ID du log de conversion
 * @returns {Promise<Object|null>} Log de conversion trouvé ou null
 */
async function getConversionLogById(id) {
  const [log] = await db.select()
    .from(conversionLogs)
    .where(eq(conversionLogs.id, id));
  
  return log || null;
}

/**
 * Compter les logs de conversion
 * @param {Object} options - Options de filtrage
 * @returns {Promise<number>} Nombre de logs de conversion correspondant aux critères
 */
async function countConversionLogs(options = {}) {
  const {
    applicationId,
    apiKeyId,
    status,
    startDate,
    endDate,
    requestType
  } = options;
  
  let query = db.select({ count: count() }).from(conversionLogs);
  
  // Appliquer les filtres
  if (applicationId) {
    query = query.where(eq(conversionLogs.applicationId, applicationId));
  }
  
  if (apiKeyId) {
    query = query.where(eq(conversionLogs.apiKeyId, apiKeyId));
  }
  
  if (status) {
    query = query.where(eq(conversionLogs.status, status));
  }
  
  if (requestType) {
    query = query.where(eq(conversionLogs.requestType, requestType));
  }
  
  if (startDate) {
    query = query.where(gte(conversionLogs.createdAt, new Date(startDate)));
  }
  
  if (endDate) {
    query = query.where(lte(conversionLogs.createdAt, new Date(endDate)));
  }
  
  const result = await query;
  return result[0]?.count || 0;
}

/**
 * Supprimer les logs de conversion antérieurs à une certaine date
 * @param {number} days - Nombre de jours à conserver
 * @returns {Promise<number>} Nombre de logs supprimés
 */
async function deleteOldLogs(days = 30) {
  const cutoffDate = subDays(new Date(), days);
  
  const result = await db.delete(conversionLogs)
    .where(lte(conversionLogs.createdAt, cutoffDate));
  
  return result.count;
}

/**
 * Mettre à jour les métriques du tableau de bord pour une application
 * @param {number} applicationId - ID de l'application (null pour toutes)
 * @returns {Promise<boolean>} True si la mise à jour a réussi
 */
async function updateDashboardMetrics(applicationId = null) {
  const today = new Date();
  
  // Périodes de temps
  const dayStart = startOfDay(today);
  const dayEnd = endOfDay(today);
  const weekStart = startOfWeek(today, { weekStartsOn: 1 }); // Lundi
  const weekEnd = endOfWeek(today, { weekStartsOn: 1 });
  const monthStart = startOfMonth(today);
  const monthEnd = endOfMonth(today);
  
  try {
    // Métriques journalières
    await updateMetricsForPeriod(applicationId, dayStart, dayEnd, 'daily');
    
    // Métriques hebdomadaires
    await updateMetricsForPeriod(applicationId, weekStart, weekEnd, 'weekly');
    
    // Métriques mensuelles
    await updateMetricsForPeriod(applicationId, monthStart, monthEnd, 'monthly');
    
    return true;
  } catch (error) {
    console.error('[METRICS] Erreur lors de la mise à jour des métriques:', error);
    return false;
  }
}

/**
 * Mettre à jour les métriques pour une période spécifique
 * @param {number} applicationId - ID de l'application (null pour toutes)
 * @param {Date} startDate - Date de début de la période
 * @param {Date} endDate - Date de fin de la période
 * @param {string} metricsType - Type de métriques ('daily', 'weekly', 'monthly')
 */
async function updateMetricsForPeriod(applicationId, startDate, endDate, metricsType) {
  // Requête de base pour les agrégations
  let baseQuery = db
    .select({
      totalCount: count(),
      successCount: count(sql`CASE WHEN ${conversionLogs.status} = 'success' THEN 1 END`),
      errorCount: count(sql`CASE WHEN ${conversionLogs.status} = 'error' THEN 1 END`),
      warningCount: count(sql`CASE WHEN ${conversionLogs.status} = 'warning' THEN 1 END`),
      avgTime: avg(conversionLogs.conversionTime)
    })
    .from(conversionLogs)
    .where(and(
      gte(conversionLogs.createdAt, startDate),
      lte(conversionLogs.createdAt, endDate)
    ));
  
  // Ajouter le filtre par application si nécessaire
  if (applicationId) {
    baseQuery = baseQuery.where(eq(conversionLogs.applicationId, applicationId));
  }
  
  // Exécuter la requête d'agrégation
  const [metrics] = await baseQuery;
  
  // Préparer les données pour l'insertion/mise à jour
  const metricsData = {
    date: startDate,
    applicationId,
    metricsType,
    conversionCount: metrics.totalCount || 0,
    successCount: metrics.successCount || 0,
    errorCount: metrics.errorCount || 0,
    warningCount: metrics.warningCount || 0,
    averageConversionTime: Math.round(metrics.avgTime || 0),
    data: {}, // Données supplémentaires si nécessaire
    updatedAt: new Date()
  };
  
  // Vérifier si une entrée existe déjà
  const existingQuery = db.select()
    .from(dashboardMetrics)
    .where(and(
      eq(dashboardMetrics.date, startDate),
      eq(dashboardMetrics.metricsType, metricsType),
      applicationId ? eq(dashboardMetrics.applicationId, applicationId) : isNull(dashboardMetrics.applicationId)
    ));
  
  const [existing] = await existingQuery;
  
  if (existing) {
    // Mettre à jour l'entrée existante
    await db.update(dashboardMetrics)
      .set(metricsData)
      .where(eq(dashboardMetrics.id, existing.id));
  } else {
    // Créer une nouvelle entrée
    await db.insert(dashboardMetrics)
      .values({
        ...metricsData,
        createdAt: new Date()
      });
  }
}

/**
 * Récupérer les métriques du tableau de bord
 * @param {Object} options - Options de filtrage
 * @returns {Promise<Array>} Métriques du tableau de bord
 */
async function getDashboardMetrics(options = {}) {
  const { applicationId, metricsType, startDate, endDate, limit = 100 } = options;
  
  let query = db.select().from(dashboardMetrics);
  
  // Appliquer les filtres
  if (applicationId) {
    query = query.where(eq(dashboardMetrics.applicationId, applicationId));
  }
  
  if (metricsType) {
    query = query.where(eq(dashboardMetrics.metricsType, metricsType));
  }
  
  if (startDate) {
    query = query.where(gte(dashboardMetrics.date, new Date(startDate)));
  }
  
  if (endDate) {
    query = query.where(lte(dashboardMetrics.date, new Date(endDate)));
  }
  
  return await query
    .orderBy(desc(dashboardMetrics.date))
    .limit(limit);
}

/**
 * Obtenir un résumé des statistiques pour le tableau de bord
 * @param {Object} options - Options de filtrage
 * @returns {Promise<Object>} Résumé des statistiques
 */
async function getStatsSummary(options = {}) {
  const { applicationId, startDate, endDate } = options;
  
  // Périodes par défaut si non spécifiées
  const effectiveStartDate = startDate ? new Date(startDate) : subDays(new Date(), 30);
  const effectiveEndDate = endDate ? new Date(endDate) : new Date();
  
  // Requête d'agrégation
  let query = db
    .select({
      totalCount: count(),
      successCount: count(sql`CASE WHEN ${conversionLogs.status} = 'success' THEN 1 END`),
      errorCount: count(sql`CASE WHEN ${conversionLogs.status} = 'error' THEN 1 END`),
      warningCount: count(sql`CASE WHEN ${conversionLogs.status} = 'warning' THEN 1 END`),
      avgTime: avg(conversionLogs.conversionTime),
      totalResources: sum(conversionLogs.resourceCount)
    })
    .from(conversionLogs)
    .where(and(
      gte(conversionLogs.createdAt, effectiveStartDate),
      lte(conversionLogs.createdAt, effectiveEndDate)
    ));
  
  // Ajouter le filtre par application si nécessaire
  if (applicationId) {
    query = query.where(eq(conversionLogs.applicationId, applicationId));
  }
  
  // Exécuter la requête
  const [summary] = await query;
  
  // Distribution par type de requête
  const requestTypesQuery = db
    .select({
      requestType: conversionLogs.requestType,
      count: count()
    })
    .from(conversionLogs)
    .where(and(
      gte(conversionLogs.createdAt, effectiveStartDate),
      lte(conversionLogs.createdAt, effectiveEndDate)
    ))
    .groupBy(conversionLogs.requestType);
  
  // Ajouter le filtre par application si nécessaire
  if (applicationId) {
    requestTypesQuery.where(eq(conversionLogs.applicationId, applicationId));
  }
  
  const requestTypes = await requestTypesQuery;
  
  // Construire le résultat final
  return {
    period: {
      start: effectiveStartDate,
      end: effectiveEndDate
    },
    conversions: {
      total: summary.totalCount || 0,
      success: summary.successCount || 0,
      error: summary.errorCount || 0,
      warning: summary.warningCount || 0
    },
    performance: {
      averageTime: Math.round(summary.avgTime || 0),
      totalResources: summary.totalResources || 0
    },
    distribution: {
      requestTypes: requestTypes.reduce((acc, item) => {
        acc[item.requestType] = item.count;
        return acc;
      }, {})
    }
  };
}

module.exports = {
  createConversionLog,
  getConversionLogs,
  getConversionLogById,
  countConversionLogs,
  deleteOldLogs,
  updateDashboardMetrics,
  getDashboardMetrics,
  getStatsSummary
};