/**
 * Service de base de données pour FHIRHub
 * Gère les connexions et les opérations sur la base de données SQLite
 */

const path = require('path');
const sqlite3 = require('sqlite3').verbose();

// Chemin de la base de données
const DB_PATH = path.join(__dirname, '../../data/fhirhub.db');

// Connexion à la base de données
let db = null;

/**
 * Initialiser la base de données
 * @returns {Promise<void>}
 */
async function initialize() {
  return new Promise((resolve, reject) => {
    console.log('[DB] Initialisation de la base de données...');
    console.log(`[DB] Chemin de la base de données: ${DB_PATH}`);
    
    // S'assurer que le répertoire data existe
    const fs = require('fs');
    const dataDir = path.dirname(DB_PATH);
    
    if (!fs.existsSync(dataDir)) {
      console.log(`[DB] Création du répertoire ${dataDir}`);
      fs.mkdirSync(dataDir, { recursive: true });
    }
    
    // Ouvrir la connexion à la base de données
    db = new sqlite3.Database(DB_PATH, (err) => {
      if (err) {
        console.error('[DB] Erreur lors de la connexion à la base de données:', err);
        return reject(err);
      }
      
      console.log('[DB] Connexion à la base de données établie');
      
      // Activer les clés étrangères
      db.run('PRAGMA foreign_keys = ON');
      
      // Créer les tables si elles n'existent pas
      createTables()
        .then(() => {
          console.log('[DB] Structure de la base de données vérifiée');
          resolve();
        })
        .catch(err => {
          console.error('[DB] Erreur lors de la création des tables:', err);
          reject(err);
        });
    });
  });
}

/**
 * Créer les tables de la base de données
 * @returns {Promise<void>}
 */
async function createTables() {
  // Importer les schémas
  const schema = require('../db/schema');
  
  // Création des tables principales dans un ordre spécifique pour respecter les contraintes de clés étrangères
  const orderedSchemas = [
    schema.USERS_SCHEMA,
    schema.APPLICATIONS_SCHEMA,
    schema.API_KEYS_SCHEMA,
    schema.CONVERSION_LOGS_SCHEMA,
    schema.SYSTEM_METRICS_SCHEMA,
    schema.NOTIFICATIONS_SCHEMA,
    schema.API_ACTIVITY_LOGS_SCHEMA,
    schema.API_USAGE_LIMITS_SCHEMA
  ];
  
  const tables = orderedSchemas.map(schema => 
    `CREATE TABLE IF NOT EXISTS ${schema.tableName} (${schema.columns})`
  );
  
  try {
    // Exécuter chaque requête de création de table
    for (const tableQuery of tables) {
      console.log('[DB] Création de table:', tableQuery.split('\n')[0]);
      await run(tableQuery);
    }

    // Vérifier si les tables existent réellement en exécutant une requête directe
    const tableCheck = await run("SELECT name FROM sqlite_master WHERE type='table' AND name='users'");
    console.log('[DB] Vérification des tables créées:', tableCheck);
    
    try {
      // Vérifier si l'utilisateur admin existe, sinon le créer
      const adminCheck = await get('SELECT id FROM users WHERE username = ?', ['admin']);
      
      if (!adminCheck) {
        console.log('[DB] Création de l\'utilisateur administrateur par défaut');
        
        // Hasher le mot de passe avec bcrypt
        const bcrypt = require('bcrypt');
        const hashedPassword = await bcrypt.hash('adminfhirhub', 10);
        
        await run(
          'INSERT INTO users (username, password, email, role) VALUES (?, ?, ?, ?)',
          ['admin', hashedPassword, 'admin@fhirhub.local', 'admin']
        );
      }
    } catch (err) {
      console.error('[DB] Erreur lors de la vérification/création de l\'utilisateur admin:', err);
      
      // Création d'urgence de l'utilisateur admin sans vérification préalable
      console.log('[DB] Tentative de création directe de l\'utilisateur admin');
      const bcrypt = require('bcrypt');
      const hashedPassword = await bcrypt.hash('adminfhirhub', 10);
      
      try {
        await run(
          'INSERT OR IGNORE INTO users (username, password, email, role) VALUES (?, ?, ?, ?)',
          ['admin', hashedPassword, 'admin@fhirhub.local', 'admin']
        );
      } catch (insertErr) {
        console.error('[DB] Erreur lors de la création directe de l\'utilisateur admin:', insertErr);
      }
    }
    
    // Création de l'application par défaut et de la clé API de développement
    console.log('[DB] Création de l\'application par défaut et de la clé API de développement');
    try {
      await run(
        'INSERT OR IGNORE INTO applications (name, description, owner_id) SELECT ?, ?, (SELECT id FROM users WHERE username = ?)',
        ['Application par défaut', 'Application générée automatiquement pour le développement', 'admin']
      );
      
      await run(
        'INSERT OR IGNORE INTO api_keys (application_id, key, name) SELECT (SELECT id FROM applications WHERE name = ?), ?, ?',
        ['Application par défaut', 'dev-key', 'Clé de développement']
      );
    } catch (appErr) {
      console.error('[DB] Erreur lors de la création de l\'application par défaut:', appErr);
    }
  } catch (error) {
    console.error('[DB] Erreur lors de la création des tables:', error);
    throw error;
  }
}

/**
 * Fermer la connexion à la base de données
 * @returns {Promise<void>}
 */
async function close() {
  return new Promise((resolve, reject) => {
    if (db) {
      db.close(err => {
        if (err) {
          console.error('[DB] Erreur lors de la fermeture de la connexion:', err);
          return reject(err);
        }
        
        console.log('[DB] Connexion à la base de données fermée');
        db = null;
        resolve();
      });
    } else {
      console.log('[DB] Pas de connexion à fermer');
      resolve();
    }
  });
}

/**
 * Exécuter une requête SQL sans récupérer de résultat
 * @param {string} sql - Requête SQL
 * @param {Array} params - Paramètres de la requête
 * @returns {Promise<Object>} Résultat de l'exécution
 */
async function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    ensureConnection();
    
    db.run(sql, params, function(err) {
      if (err) {
        console.error('[DB] Erreur lors de l\'exécution de la requête:', err);
        return reject(err);
      }
      
      resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

/**
 * Exécuter une requête SQL et récupérer un seul résultat
 * @param {string} sql - Requête SQL
 * @param {Array} params - Paramètres de la requête
 * @returns {Promise<Object|null>} Résultat de la requête
 */
async function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    ensureConnection();
    
    db.get(sql, params, (err, row) => {
      if (err) {
        console.error('[DB] Erreur lors de l\'exécution de la requête:', err);
        return reject(err);
      }
      
      resolve(row || null);
    });
  });
}

/**
 * Exécuter une requête SQL et récupérer tous les résultats
 * @param {string} sql - Requête SQL
 * @param {Array} params - Paramètres de la requête
 * @returns {Promise<Array>} Résultats de la requête
 */
async function query(sql, params = []) {
  return new Promise((resolve, reject) => {
    ensureConnection();
    
    db.all(sql, params, (err, rows) => {
      if (err) {
        console.error('[DB] Erreur lors de l\'exécution de la requête:', err);
        return reject(err);
      }
      
      resolve(rows || []);
    });
  });
}

/**
 * S'assurer que la connexion à la base de données est établie
 * @private
 */
function ensureConnection() {
  if (!db) {
    throw new Error('La connexion à la base de données n\'est pas établie. Appelez initialize() d\'abord.');
  }
}

module.exports = {
  initialize,
  close,
  run,
  get,
  query
};