/**
 * Service de base de données pour FHIRHub
 * Gère les connexions et les opérations sur la base de données SQLite
 */

const path = require('path');
const Database = require('better-sqlite3');

/**
 * Convertir une valeur pour qu'elle soit compatible avec SQLite
 * @param {any} value - Valeur à convertir
 * @returns {string|number|null} Valeur compatible avec SQLite
 * @private
 */
function convertToSQLiteValue(value) {
  if (value === null || value === undefined) {
    return null;
  }
  
  if (typeof value === 'boolean') {
    return value ? 1 : 0;
  }
  
  if (typeof value === 'object') {
    return JSON.stringify(value);
  }
  
  return value;
}

// Chemin de la base de données
const DB_PATH = path.join(__dirname, '../../data/fhirhub.db');

// Connexion à la base de données
let db = null;
let initialized = false;

/**
 * Initialiser la base de données
 * @returns {Promise<void>}
 */
async function initialize() {
  // Si déjà initialisé, retourner immédiatement
  if (initialized) {
    return Promise.resolve();
  }

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
    try {
      db = new Database(DB_PATH, { verbose: console.log });
      
      console.log('[DB] Connexion à la base de données établie');
      
      // Activer les clés étrangères
      db.pragma('foreign_keys = ON');
      
      // Créer les tables si elles n'existent pas
      createTables()
        .then(() => {
          console.log('[DB] Structure de la base de données vérifiée');
          initialized = true;
          resolve();
        })
        .catch(err => {
          console.error('[DB] Erreur lors de la création des tables:', err);
          reject(err);
        });
    } catch (err) {
      console.error('[DB] Erreur lors de la connexion à la base de données:', err);
      reject(err);
    }
  });
}

/**
 * Vérifier si la base de données est initialisée
 * @returns {boolean} Statut d'initialisation
 */
function isInitialized() {
  return initialized;
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
    schema.API_USAGE_LIMITS_SCHEMA,
    schema.AI_PROVIDERS_SCHEMA
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
        'INSERT OR IGNORE INTO applications (name, description, created_by) SELECT ?, ?, (SELECT id FROM users WHERE username = ?)',
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
  return new Promise((resolve) => {
    if (db) {
      try {
        db.close();
        console.log('[DB] Connexion à la base de données fermée');
        db = null;
        resolve();
      } catch (err) {
        console.error('[DB] Erreur lors de la fermeture de la connexion:', err);
        db = null;
        resolve();
      }
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
    try {
      ensureConnection();
      
      // Préparer les paramètres pour SQLite
      const safeParams = params.map(convertToSQLiteValue);
      
      // better-sqlite3 utilise "run" pour les requêtes sans résultat
      const result = db.prepare(sql).run(...safeParams);
      
      resolve({ 
        lastID: result.lastInsertRowid, 
        changes: result.changes 
      });
    } catch (err) {
      console.error('[DB] Erreur lors de l\'exécution de la requête:', err);
      reject(err);
    }
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
    try {
      ensureConnection();
      
      // Préparer les paramètres pour SQLite
      const safeParams = params.map(convertToSQLiteValue);
      
      // better-sqlite3 utilise "get" pour obtenir un seul résultat
      const row = db.prepare(sql).get(...safeParams);
      
      resolve(row || null);
    } catch (err) {
      console.error('[DB] Erreur lors de l\'exécution de la requête:', err);
      reject(err);
    }
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
    try {
      ensureConnection();
      
      // Préparer les paramètres pour SQLite
      const safeParams = params.map(convertToSQLiteValue);
      
      // better-sqlite3 utilise "all" pour obtenir tous les résultats
      const rows = db.prepare(sql).all(...safeParams);
      
      resolve(rows || []);
    } catch (err) {
      console.error('[DB] Erreur lors de l\'exécution de la requête:', err);
      reject(err);
    }
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
  isInitialized,
  close,
  run,
  get,
  query
};