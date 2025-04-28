/**
 * Service de base de données pour FHIRHub
 * Fournit des méthodes pour interagir avec la base de données SQLite
 */

const schema = require('../db/schema');
const sqlite3 = require('sqlite3').verbose();

let db = null;

/**
 * Initialiser la base de données
 * @returns {Promise<sqlite3.Database>} Instance de base de données
 */
async function initialize() {
  console.log('[DB] Initialisation de la base de données');
  
  if (db) {
    return db;
  }
  
  db = schema.createDatabase();
  
  try {
    await schema.initializeSchema(db);
    console.log('[DB] Schéma de base de données initialisé');
    return db;
  } catch (error) {
    console.error('[DB] Erreur lors de l\'initialisation du schéma:', error);
    throw error;
  }
}

/**
 * Exécuter une requête SQL avec des paramètres
 * @param {string} sql - Requête SQL
 * @param {Array} params - Paramètres de la requête
 * @returns {Promise<Array>} Résultats de la requête
 */
function query(sql, params = []) {
  return new Promise((resolve, reject) => {
    if (!db) {
      reject(new Error('La base de données n\'est pas initialisée'));
      return;
    }
    
    db.all(sql, params, (err, rows) => {
      if (err) {
        console.error('[DB] Erreur de requête SQL:', err.message);
        reject(err);
        return;
      }
      
      resolve(rows);
    });
  });
}

/**
 * Exécuter une requête SQL qui ne renvoie qu'une seule ligne
 * @param {string} sql - Requête SQL
 * @param {Array} params - Paramètres de la requête
 * @returns {Promise<Object>} Résultat de la requête
 */
function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    if (!db) {
      reject(new Error('La base de données n\'est pas initialisée'));
      return;
    }
    
    db.get(sql, params, (err, row) => {
      if (err) {
        console.error('[DB] Erreur de requête SQL:', err.message);
        reject(err);
        return;
      }
      
      resolve(row);
    });
  });
}

/**
 * Exécuter une requête SQL de modification (INSERT, UPDATE, DELETE)
 * @param {string} sql - Requête SQL
 * @param {Array} params - Paramètres de la requête
 * @returns {Promise<Object>} Résultat de la requête avec lastID et changes
 */
function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    if (!db) {
      reject(new Error('La base de données n\'est pas initialisée'));
      return;
    }
    
    db.run(sql, params, function(err) {
      if (err) {
        console.error('[DB] Erreur de requête SQL:', err.message);
        reject(err);
        return;
      }
      
      resolve({ 
        lastID: this.lastID, 
        changes: this.changes 
      });
    });
  });
}

/**
 * Exécuter plusieurs requêtes dans une transaction
 * @param {Function} callback - Fonction de rappel contenant les requêtes
 * @returns {Promise<any>} Résultat de la transaction
 */
function transaction(callback) {
  return new Promise((resolve, reject) => {
    if (!db) {
      reject(new Error('La base de données n\'est pas initialisée'));
      return;
    }
    
    db.serialize(() => {
      db.run('BEGIN TRANSACTION');
      
      try {
        const result = callback({
          query: query,
          get: get,
          run: run
        });
        
        db.run('COMMIT', err => {
          if (err) {
            console.error('[DB] Erreur lors de la validation de la transaction:', err.message);
            db.run('ROLLBACK');
            reject(err);
            return;
          }
          
          resolve(result);
        });
      } catch (error) {
        console.error('[DB] Erreur durant la transaction:', error.message);
        db.run('ROLLBACK');
        reject(error);
      }
    });
  });
}

/**
 * Fermer la connexion à la base de données
 * @returns {Promise<void>}
 */
function close() {
  return new Promise((resolve, reject) => {
    if (!db) {
      resolve();
      return;
    }
    
    db.close(err => {
      if (err) {
        console.error('[DB] Erreur lors de la fermeture de la base de données:', err.message);
        reject(err);
        return;
      }
      
      db = null;
      console.log('[DB] Connexion à la base de données fermée');
      resolve();
    });
  });
}

/**
 * Nettoyer les anciens enregistrements
 * @param {number} daysToKeep - Nombre de jours à conserver
 * @returns {Promise<number>} Nombre d'enregistrements supprimés
 */
async function cleanupOldRecords(daysToKeep = 30) {
  console.log('[DB] Nettoyage des anciens enregistrements de conversion...');
  
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
  
  const result = await run(
    'DELETE FROM conversion_logs WHERE created_at < datetime(?)',
    [cutoffDate.toISOString()]
  );
  
  console.log(`[DB] ${result.changes} ancien(s) enregistrement(s) supprimé(s)`);
  return result.changes;
}

module.exports = {
  initialize,
  query,
  get,
  run,
  transaction,
  close,
  cleanupOldRecords
};