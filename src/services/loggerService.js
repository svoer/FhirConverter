/**
 * Service de journalisation pour FHIRHub
 * Permet d'enregistrer les événements et erreurs dans la base de données et les fichiers de logs
 */

const fs = require('fs');
const path = require('path');
const dbService = require('./dbService');

// Dossier contenant les fichiers de logs
const LOGS_DIR = path.join(process.cwd(), 'logs');

// Création du dossier logs s'il n'existe pas
if (!fs.existsSync(LOGS_DIR)) {
  fs.mkdirSync(LOGS_DIR, { recursive: true });
  console.log(`[LOGGER] Dossier de logs créé: ${LOGS_DIR}`);
}

/**
 * Niveaux de logs disponibles
 * @type {Object}
 */
const LOG_LEVELS = {
  DEBUG: 'DEBUG',
  INFO: 'INFO',
  WARN: 'WARNING',
  ERROR: 'ERROR',
  CRITICAL: 'CRITICAL'
};

/**
 * Journaliser un événement système
 * @param {string} eventType - Type d'événement
 * @param {string} message - Message décrivant l'événement
 * @param {Object} [details={}] - Détails supplémentaires sur l'événement
 * @param {string} [severity='INFO'] - Niveau de sévérité (DEBUG, INFO, WARNING, ERROR, CRITICAL)
 * @param {number} [userId=null] - ID de l'utilisateur associé à l'événement
 * @param {string} [ipAddress=null] - Adresse IP associée à l'événement
 * @returns {Promise<Object>} Entrée de journal créée
 */
async function logSystemEvent(eventType, message, details = {}, severity = 'INFO', userId = null, ipAddress = null) {
  try {
    // Convertir les détails en chaîne JSON si nécessaire
    const detailsJson = typeof details === 'object' ? JSON.stringify(details) : details;
    
    // Vérifier si la base de données est initialisée
    if (!dbService.isInitialized()) {
      console.warn('[LOGGER] Base de données non initialisée, journalisation dans le fichier uniquement');
      await logToFile(severity, eventType, message, detailsJson, userId, ipAddress);
      return null;
    }
    
    // Journaliser dans la base de données
    try {
      const log = await dbService.run(
        'INSERT INTO system_logs (event_type, message, details, severity, user_id, ip_address) VALUES (?, ?, ?, ?, ?, ?)',
        [eventType, message, detailsJson, severity, userId, ipAddress]
      );
      
      // Journaliser également dans le fichier pour redondance
      await logToFile(severity, eventType, message, detailsJson, userId, ipAddress);
      
      return {
        id: log.lastID,
        event_type: eventType,
        message,
        details,
        severity,
        user_id: userId,
        ip_address: ipAddress,
        created_at: new Date()
      };
    } catch (dbError) {
      console.error('[LOGGER] Erreur lors de la journalisation dans la base de données:', dbError);
      
      // Journaliser l'erreur dans le fichier
      await logToFile('ERROR', 'logger_error', `Erreur lors de la journalisation dans la base de données: ${dbError.message}`, JSON.stringify(dbError));
      
      // Journaliser l'événement original dans le fichier
      await logToFile(severity, eventType, message, detailsJson, userId, ipAddress);
      
      return null;
    }
  } catch (error) {
    console.error('[LOGGER] Erreur critique lors de la journalisation:', error);
    
    // Tentative de journalisation dans le fichier uniquement
    try {
      await logToFile('ERROR', 'logger_critical', `Erreur critique lors de la journalisation: ${error.message}`, JSON.stringify(error));
      await logToFile(severity, eventType, message, typeof details === 'object' ? JSON.stringify(details) : details, userId, ipAddress);
    } catch (fileError) {
      console.error('[LOGGER] Échec complet de la journalisation:', fileError);
    }
    
    return null;
  }
}

/**
 * Journaliser un message dans un fichier
 * @param {string} level - Niveau de log
 * @param {string} category - Catégorie de log
 * @param {string} message - Message à journaliser
 * @param {string} [details=''] - Détails supplémentaires
 * @param {number} [userId=null] - ID de l'utilisateur
 * @param {string} [ipAddress=''] - Adresse IP
 * @returns {Promise<void>}
 * @private
 */
async function logToFile(level, category, message, details = '', userId = null, ipAddress = '') {
  // Vérifier que les paramètres sont valides
  if (!level || !category || !message) {
    console.error('[LOGGER] Paramètres invalides pour la journalisation dans un fichier');
    return;
  }
  
  try {
    // Obtenir la date courante pour le nom du fichier
    const now = new Date();
    const dateString = now.toISOString().split('T')[0]; // YYYY-MM-DD
    const timeString = now.toISOString().replace('T', ' ').substring(0, 19); // YYYY-MM-DD HH:MM:SS
    
    // Chemin du fichier de log
    const logFile = path.join(LOGS_DIR, `fhirhub_${dateString}.log`);
    
    // Formater la ligne de log
    let logLine = `[${timeString}] [${level}] [${category}] ${message}`;
    
    // Ajouter des informations supplémentaires si disponibles
    if (userId) {
      logLine += ` [User:${userId}]`;
    }
    
    if (ipAddress) {
      logLine += ` [IP:${ipAddress}]`;
    }
    
    if (details) {
      logLine += `\n  Details: ${details}`;
    }
    
    // Ajouter une nouvelle ligne à la fin
    logLine += '\n';
    
    // Écrire dans le fichier de log (mode append)
    fs.appendFileSync(logFile, logLine);
  } catch (error) {
    console.error('[LOGGER] Erreur lors de l\'écriture dans le fichier de log:', error);
    // Ne pas générer d'erreur supplémentaire pour éviter les boucles infinies
  }
}

/**
 * Récupérer les entrées de journal les plus récentes
 * @param {Object} options - Options de filtrage
 * @param {number} [options.limit=100] - Nombre maximum d'entrées à récupérer
 * @param {number} [options.offset=0] - Décalage pour la pagination
 * @param {string} [options.severity=null] - Filtrer par niveau de sévérité
 * @param {string} [options.eventType=null] - Filtrer par type d'événement
 * @param {number} [options.userId=null] - Filtrer par ID d'utilisateur
 * @param {Date} [options.startDate=null] - Date de début pour le filtrage
 * @param {Date} [options.endDate=null] - Date de fin pour le filtrage
 * @returns {Promise<Array>} Liste des entrées de journal
 */
async function getSystemLogs(options = {}) {
  // Valeurs par défaut
  const {
    limit = 100,
    offset = 0,
    severity = null,
    eventType = null,
    userId = null,
    startDate = null,
    endDate = null
  } = options;
  
  try {
    // Vérifier si la base de données est initialisée
    if (!dbService.isInitialized()) {
      console.warn('[LOGGER] Base de données non initialisée, impossible de récupérer les logs');
      return [];
    }
    
    // Construire la requête SQL de base
    let sql = 'SELECT * FROM system_logs WHERE 1=1';
    const params = [];
    
    // Ajouter les filtres si spécifiés
    if (severity) {
      sql += ' AND severity = ?';
      params.push(severity);
    }
    
    if (eventType) {
      sql += ' AND event_type = ?';
      params.push(eventType);
    }
    
    if (userId) {
      sql += ' AND user_id = ?';
      params.push(userId);
    }
    
    if (startDate) {
      sql += ' AND created_at >= ?';
      params.push(startDate.toISOString());
    }
    
    if (endDate) {
      sql += ' AND created_at <= ?';
      params.push(endDate.toISOString());
    }
    
    // Ajouter l'ordre et la pagination
    sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);
    
    // Exécuter la requête
    const logs = await dbService.query(sql, params);
    
    // Convertir les détails JSON en objets si nécessaire
    return logs.map(log => {
      try {
        if (log.details && typeof log.details === 'string') {
          log.details = JSON.parse(log.details);
        }
      } catch (e) {
        // Garder les détails sous forme de chaîne si le parsing échoue
      }
      return log;
    });
  } catch (error) {
    console.error('[LOGGER] Erreur lors de la récupération des logs système:', error);
    
    // Journaliser l'erreur
    await logToFile('ERROR', 'get_logs_error', `Erreur lors de la récupération des logs: ${error.message}`, JSON.stringify(error));
    
    return [];
  }
}

/**
 * Nettoyer les anciens logs
 * @param {number} [daysToKeep=30] - Nombre de jours de logs à conserver
 * @returns {Promise<number>} Nombre d'entrées supprimées
 */
async function cleanupOldLogs(daysToKeep = 30) {
  try {
    console.log(`[LOGGER] Nettoyage des logs plus anciens que ${daysToKeep} jours...`);
    
    // Vérifier si la base de données est initialisée
    if (!dbService.isInitialized()) {
      console.warn('[LOGGER] Base de données non initialisée, impossible de nettoyer les logs');
      return 0;
    }
    
    // Calculer la date limite
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
    const cutoffDateStr = cutoffDate.toISOString();
    
    // Supprimer les logs anciens
    const result = await dbService.run(
      'DELETE FROM system_logs WHERE created_at < ?',
      [cutoffDateStr]
    );
    
    const deletedCount = result.changes || 0;
    console.log(`[LOGGER] ${deletedCount} entrées de log supprimées`);
    
    // Journaliser l'opération
    await logSystemEvent(
      'logs_cleanup',
      `Nettoyage des logs plus anciens que ${daysToKeep} jours`,
      { deleted_count: deletedCount, cutoff_date: cutoffDateStr }
    );
    
    // Nettoyer également les fichiers de logs anciens
    await cleanupOldLogFiles(daysToKeep);
    
    return deletedCount;
  } catch (error) {
    console.error('[LOGGER] Erreur lors du nettoyage des logs:', error);
    
    // Journaliser l'erreur dans un fichier
    await logToFile('ERROR', 'logs_cleanup_error', `Erreur lors du nettoyage des logs: ${error.message}`, JSON.stringify(error));
    
    return 0;
  }
}

/**
 * Nettoyer les anciens fichiers de logs
 * @param {number} daysToKeep - Nombre de jours de logs à conserver
 * @returns {Promise<number>} Nombre de fichiers supprimés
 * @private
 */
async function cleanupOldLogFiles(daysToKeep) {
  try {
    // Calculer la date limite
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
    
    // Lister les fichiers de logs
    const logFiles = fs.readdirSync(LOGS_DIR)
      .filter(file => file.endsWith('.log'))
      .filter(file => {
        // Extraire la date du nom du fichier (format: fhirhub_YYYY-MM-DD.log)
        const dateMatch = file.match(/fhirhub_(\d{4}-\d{2}-\d{2})\.log/);
        if (!dateMatch) return false;
        
        const fileDate = new Date(dateMatch[1]);
        return fileDate < cutoffDate;
      });
    
    // Supprimer les fichiers anciens
    logFiles.forEach(file => {
      const filePath = path.join(LOGS_DIR, file);
      fs.unlinkSync(filePath);
      console.log(`[LOGGER] Fichier de log supprimé: ${file}`);
    });
    
    return logFiles.length;
  } catch (error) {
    console.error('[LOGGER] Erreur lors du nettoyage des fichiers de logs:', error);
    return 0;
  }
}

/**
 * Démarrer le nettoyage automatique des logs
 * @param {number} [intervalDays=1] - Intervalle en jours entre chaque nettoyage
 * @param {number} [daysToKeep=30] - Nombre de jours de logs à conserver
 * @returns {Function} Fonction pour arrêter le nettoyage automatique
 */
function startAutomaticCleanup(intervalDays = 1, daysToKeep = 30) {
  console.log(`[LOGGER] Démarrage du nettoyage automatique des logs (intervalle: ${intervalDays} jours, conservation: ${daysToKeep} jours)`);
  
  // Convertir les jours en millisecondes
  const intervalMs = intervalDays * 24 * 60 * 60 * 1000;
  
  // Exécuter le nettoyage immédiatement
  cleanupOldLogs(daysToKeep)
    .catch(error => console.error('[LOGGER] Erreur lors du nettoyage automatique initial des logs:', error));
  
  // Définir l'intervalle pour les nettoyages périodiques
  const interval = setInterval(() => {
    cleanupOldLogs(daysToKeep)
      .catch(error => console.error('[LOGGER] Erreur lors du nettoyage automatique périodique des logs:', error));
  }, intervalMs);
  
  // Retourner la fonction pour arrêter le nettoyage automatique
  return () => {
    console.log('[LOGGER] Arrêt du nettoyage automatique des logs');
    clearInterval(interval);
  };
}

// Exporter les fonctions et constantes publiques
module.exports = {
  LOG_LEVELS,
  logSystemEvent,
  getSystemLogs,
  cleanupOldLogs,
  startAutomaticCleanup
};