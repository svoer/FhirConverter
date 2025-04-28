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
  // Création des tables principales
  const tables = [
    // Table des utilisateurs
    `CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      email TEXT,
      role TEXT NOT NULL DEFAULT 'user',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      last_login TEXT
    )`,
    
    // Table des applications
    `CREATE TABLE IF NOT EXISTS applications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      owner_id INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
    )`,
    
    // Table des clés API
    `CREATE TABLE IF NOT EXISTS api_keys (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      application_id INTEGER NOT NULL,
      key TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      environment TEXT NOT NULL DEFAULT 'development',
      active BOOLEAN NOT NULL DEFAULT 1,
      last_used TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE CASCADE
    )`,
    
    // Table des journaux de conversion
    `CREATE TABLE IF NOT EXISTS conversion_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      api_key_id INTEGER NOT NULL,
      application_id INTEGER NOT NULL,
      source_type TEXT NOT NULL,
      hl7_content TEXT NOT NULL,
      fhir_content TEXT,
      status TEXT NOT NULL,
      processing_time INTEGER,
      error_message TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (api_key_id) REFERENCES api_keys(id) ON DELETE CASCADE,
      FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE CASCADE
    )`,
    
    // Table des métriques de système
    `CREATE TABLE IF NOT EXISTS system_metrics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cpu_usage REAL,
      memory_usage REAL,
      disk_usage REAL,
      active_users INTEGER,
      recorded_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`
  ];
  
  // Exécuter chaque requête de création de table
  for (const tableQuery of tables) {
    await run(tableQuery);
  }
  
  // Vérifier si l'utilisateur admin existe, sinon le créer
  const adminExists = await get('SELECT id FROM users WHERE username = ?', ['admin']);
  
  if (!adminExists) {
    console.log('[DB] Création de l\'utilisateur administrateur par défaut');
    
    // Hasher le mot de passe (dans une application réelle, utiliser bcrypt)
    const bcrypt = require('bcrypt');
    const hashedPassword = await bcrypt.hash('adminfhirhub', 10);
    
    await run(
      'INSERT INTO users (username, password, email, role) VALUES (?, ?, ?, ?)',
      ['admin', hashedPassword, 'admin@fhirhub.local', 'admin']
    );
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