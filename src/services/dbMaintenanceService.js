/**
 * Service de maintenance de la base de données pour FHIRHub
 * @module src/services/dbMaintenanceService
 * @description Fournit des fonctions pour vérifier et réparer l'intégrité de la base de données
 */

const dbService = require('./dbService');
const logger = require('./loggerService');
const path = require('path');
const fs = require('fs');
const { promisify } = require('util');

// Chemin du répertoire de sauvegarde
const BACKUP_DIR = path.join(process.cwd(), 'backups');

// S'assurer que le répertoire de sauvegarde existe
if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  console.log(`[DB-MAINTENANCE] Répertoire de sauvegarde créé: ${BACKUP_DIR}`);
}

/**
 * Effectuer une vérification complète de la base de données
 * @returns {Promise<Object>} Résultat de la vérification
 */
async function checkDatabaseIntegrity() {
  console.log('[DB-MAINTENANCE] Vérification de l\'intégrité de la base de données...');
  
  try {
    // Vérifier si la base de données est initialisée
    if (!dbService.isInitialized()) {
      console.warn('[DB-MAINTENANCE] Base de données non initialisée, initialisation en cours...');
      await dbService.initialize();
    }
    
    // Vérifier les tables principales
    const essentialTables = [
      'users', 
      'applications', 
      'api_keys', 
      'workflows', 
      'conversion_logs', 
      'system_logs', 
      'ai_providers'
    ];
    
    // Résultat de la vérification
    const result = {
      timestamp: new Date().toISOString(),
      status: 'ok',
      errors: [],
      tablesVerified: essentialTables.length,
      tablesCreated: [],
      tablesFailed: [],
      backupCreated: false
    };
    
    // Vérifier chaque table essentielle
    console.log(`[DB-MAINTENANCE] Vérification de ${essentialTables.length} tables essentielles...`);
    const tablesResult = await dbService.ensureTables(essentialTables);
    
    if (tablesResult.created.length > 0) {
      console.log(`[DB-MAINTENANCE] Tables créées: ${tablesResult.created.join(', ')}`);
      result.tablesCreated = tablesResult.created;
      result.status = 'repaired';
      
      // Journaliser la réparation
      logger.logSystemEvent('database_repair', `Tables réparées: ${tablesResult.created.join(', ')}`, {
        tables_repaired: tablesResult.created,
        tables_failed: tablesResult.failed
      });
    }
    
    if (tablesResult.failed.length > 0) {
      console.error(`[DB-MAINTENANCE] Tables non réparées: ${tablesResult.failed.join(', ')}`);
      result.tablesFailed = tablesResult.failed;
      result.status = 'error';
      result.errors.push(`Échec de la réparation des tables: ${tablesResult.failed.join(', ')}`);
      
      // Journaliser l'erreur
      logger.logSystemEvent('database_error', `Échec de la réparation des tables: ${tablesResult.failed.join(', ')}`, {
        tables_failed: tablesResult.failed
      }, 'ERROR');
      
      // Créer une sauvegarde de la base de données actuelle
      await createBackup();
      result.backupCreated = true;
    }
    
    // Vérifier l'utilisateur admin
    try {
      const adminExists = await dbService.get('SELECT id FROM users WHERE username = ?', ['admin']);
      
      if (!adminExists) {
        console.warn('[DB-MAINTENANCE] Utilisateur admin manquant, création en cours...');
        
        // Hasher le mot de passe avec bcrypt
        const bcrypt = require('bcrypt');
        const hashedPassword = await bcrypt.hash('adminfhirhub', 10);
        
        await dbService.run(
          'INSERT OR IGNORE INTO users (username, password, email, role) VALUES (?, ?, ?, ?)',
          ['admin', hashedPassword, 'admin@fhirhub.local', 'admin']
        );
        
        console.log('[DB-MAINTENANCE] Utilisateur admin créé');
        result.status = 'repaired';
        
        // Journaliser la réparation
        logger.logSystemEvent('database_repair', 'Utilisateur admin recréé', {
          user: 'admin'
        });
      }
    } catch (userErr) {
      console.error('[DB-MAINTENANCE] Erreur lors de la vérification/création de l\'utilisateur admin:', userErr);
      result.errors.push(`Erreur de vérification utilisateur: ${userErr.message}`);
      result.status = 'error';
    }
    
    // Vérifier les applications et clés API par défaut
    try {
      const defaultAppExists = await dbService.get('SELECT id FROM applications WHERE name = ?', ['Application par défaut']);
      
      if (!defaultAppExists) {
        console.warn('[DB-MAINTENANCE] Application par défaut manquante, création en cours...');
        
        await dbService.run(
          'INSERT OR IGNORE INTO applications (name, description, created_by) SELECT ?, ?, (SELECT id FROM users WHERE username = ?)',
          ['Application par défaut', 'Application générée automatiquement pour le développement', 'admin']
        );
        
        console.log('[DB-MAINTENANCE] Application par défaut créée');
        result.status = 'repaired';
        
        // Journaliser la réparation
        logger.logSystemEvent('database_repair', 'Application par défaut recréée', {
          app: 'Application par défaut'
        });
      }
      
      const defaultKeyExists = await dbService.get('SELECT id FROM api_keys WHERE key = ?', ['dev-key']);
      
      if (!defaultKeyExists && defaultAppExists) {
        console.warn('[DB-MAINTENANCE] Clé API par défaut manquante, création en cours...');
        
        await dbService.run(
          'INSERT OR IGNORE INTO api_keys (application_id, key, hashed_key, description) SELECT (SELECT id FROM applications WHERE name = ?), ?, ?, ?',
          ['Application par défaut', 'dev-key', 'dev-key', 'Clé de développement']
        );
        
        console.log('[DB-MAINTENANCE] Clé API par défaut créée');
        result.status = 'repaired';
        
        // Journaliser la réparation
        logger.logSystemEvent('database_repair', 'Clé API par défaut recréée', {
          key: 'dev-key'
        });
      }
    } catch (appErr) {
      console.error('[DB-MAINTENANCE] Erreur lors de la vérification/création des données par défaut:', appErr);
      result.errors.push(`Erreur de vérification données par défaut: ${appErr.message}`);
      result.status = 'error';
    }
    
    // Enregistrer les résultats dans le journal
    if (result.status === 'repaired') {
      logger.logSystemEvent('database_maintenance', 'Maintenance de base de données réussie avec réparations', result);
    } else if (result.status === 'error') {
      logger.logSystemEvent('database_maintenance', 'Maintenance de base de données terminée avec erreurs', result, 'ERROR');
    } else {
      logger.logSystemEvent('database_maintenance', 'Maintenance de base de données réussie sans réparation', result, 'INFO');
    }
    
    return result;
  } catch (error) {
    console.error('[DB-MAINTENANCE] Erreur critique lors de la vérification de la base de données:', error);
    
    // Journaliser l'erreur
    logger.logSystemEvent('database_critical_error', 'Erreur critique lors de la maintenance de la base de données', {
      error: error.message,
      stack: error.stack
    }, 'ERROR');
    
    // Créer une sauvegarde d'urgence
    try {
      await createBackup('emergency');
    } catch (backupErr) {
      console.error('[DB-MAINTENANCE] Échec de la sauvegarde d\'urgence:', backupErr);
    }
    
    throw error;
  }
}

/**
 * Créer une sauvegarde de la base de données
 * @param {string} [prefix='standard'] - Préfixe du fichier de sauvegarde
 * @returns {Promise<string>} Chemin du fichier de sauvegarde
 */
async function createBackup(prefix = 'standard') {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupFileName = `${prefix}_backup_${timestamp}.db`;
  const backupPath = path.join(BACKUP_DIR, backupFileName);
  
  console.log(`[DB-MAINTENANCE] Création d'une sauvegarde de la base de données: ${backupPath}`);
  
  try {
    // Obtenir le chemin de la base de données actuelle
    const dbPath = path.join(process.cwd(), 'data', 'fhirhub.db');
    
    // Copier le fichier de base de données
    fs.copyFileSync(dbPath, backupPath);
    
    console.log(`[DB-MAINTENANCE] Sauvegarde créée avec succès: ${backupPath}`);
    
    // Journaliser la sauvegarde
    logger.logSystemEvent('database_backup', 'Sauvegarde de la base de données créée', {
      backup_path: backupPath,
      backup_type: prefix
    });
    
    // Nettoyer les anciennes sauvegardes
    cleanOldBackups();
    
    return backupPath;
  } catch (error) {
    console.error(`[DB-MAINTENANCE] Erreur lors de la création de la sauvegarde:`, error);
    
    // Journaliser l'erreur
    logger.logSystemEvent('database_backup_error', 'Erreur lors de la création de la sauvegarde', {
      error: error.message,
      backup_path: backupPath
    }, 'ERROR');
    
    throw error;
  }
}

/**
 * Nettoyer les anciennes sauvegardes (garder uniquement les 10 plus récentes)
 * @returns {Promise<number>} Nombre de fichiers supprimés
 */
async function cleanOldBackups() {
  console.log('[DB-MAINTENANCE] Nettoyage des anciennes sauvegardes...');
  
  try {
    // Lister tous les fichiers de sauvegarde
    const backupFiles = fs.readdirSync(BACKUP_DIR)
      .filter(file => file.endsWith('.db'))
      .map(file => ({
        name: file,
        path: path.join(BACKUP_DIR, file),
        stats: fs.statSync(path.join(BACKUP_DIR, file))
      }))
      .sort((a, b) => b.stats.mtimeMs - a.stats.mtimeMs); // Trier par date de modification (plus récent d'abord)
    
    // Garder uniquement les 10 plus récentes
    const filesToDelete = backupFiles.slice(10);
    
    // Supprimer les fichiers excédentaires
    for (const file of filesToDelete) {
      fs.unlinkSync(file.path);
      console.log(`[DB-MAINTENANCE] Suppression de l'ancienne sauvegarde: ${file.name}`);
    }
    
    console.log(`[DB-MAINTENANCE] ${filesToDelete.length} anciennes sauvegardes supprimées`);
    
    return filesToDelete.length;
  } catch (error) {
    console.error('[DB-MAINTENANCE] Erreur lors du nettoyage des anciennes sauvegardes:', error);
    return 0;
  }
}

/**
 * Exécuter la maintenance de la base de données de manière périodique
 * @param {number} [intervalMinutes=60] - Intervalle en minutes entre chaque vérification
 */
function startPeriodicMaintenance(intervalMinutes = 60) {
  console.log(`[DB-MAINTENANCE] Démarrage de la maintenance périodique (intervalle: ${intervalMinutes} minutes)`);
  
  // Vérification immédiate
  checkDatabaseIntegrity()
    .then(result => {
      console.log(`[DB-MAINTENANCE] Vérification initiale terminée, statut: ${result.status}`);
    })
    .catch(error => {
      console.error('[DB-MAINTENANCE] Erreur lors de la vérification initiale:', error);
    });
  
  // Définir l'intervalle pour les vérifications périodiques
  const interval = setInterval(() => {
    console.log('[DB-MAINTENANCE] Exécution de la maintenance périodique...');
    
    checkDatabaseIntegrity()
      .then(result => {
        console.log(`[DB-MAINTENANCE] Maintenance périodique terminée, statut: ${result.status}`);
      })
      .catch(error => {
        console.error('[DB-MAINTENANCE] Erreur lors de la maintenance périodique:', error);
      });
  }, intervalMinutes * 60 * 1000);
  
  // Retourner la fonction pour arrêter la maintenance
  return () => {
    console.log('[DB-MAINTENANCE] Arrêt de la maintenance périodique');
    clearInterval(interval);
  };
}

// Exporter les fonctions publiques
module.exports = {
  checkDatabaseIntegrity,
  createBackup,
  cleanOldBackups,
  startPeriodicMaintenance
};