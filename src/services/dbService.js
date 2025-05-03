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
  // Utiliser ALL_SCHEMAS pour garantir que toutes les tables sont créées
  const orderedSchemas = schema.ALL_SCHEMAS;
  
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
        'INSERT OR IGNORE INTO api_keys (application_id, key, hashed_key, description) SELECT (SELECT id FROM applications WHERE name = ?), ?, ?, ?',
        ['Application par défaut', 'dev-key', 'dev-key', 'Clé de développement']
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
 * Vérifie et répare la table workflows si nécessaire
 * @returns {Promise<boolean>} true si la table existe ou a été créée avec succès
 */
async function ensureWorkflowsTable() {
  try {
    // Vérifier si la table workflows existe
    const tableExists = await get("SELECT name FROM sqlite_master WHERE type='table' AND name='workflows'");
    
    if (!tableExists) {
      console.log('[DB] Table workflows manquante, création en cours...');
      
      // Importer le schéma de la table workflows
      const schema = require('../db/schema');
      const workflowsSchema = schema.WORKFLOWS_SCHEMA;
      
      // Créer la table
      const createTableQuery = `CREATE TABLE IF NOT EXISTS ${workflowsSchema.tableName} (${workflowsSchema.columns})`;
      console.log('[DB] Création de la table workflows:', createTableQuery.split('\n')[0]);
      
      await run(createTableQuery);
      
      // Vérifier que la table a été créée
      const checkTable = await get("SELECT name FROM sqlite_master WHERE type='table' AND name='workflows'");
      
      if (checkTable) {
        console.log('[DB] Table workflows créée avec succès');
        return true;
      } else {
        console.error('[DB] Échec de la création de la table workflows');
        return false;
      }
    } else {
      console.log('[DB] Table workflows existe déjà');
      return true;
    }
  } catch (error) {
    console.error('[DB] Erreur lors de la vérification/création de la table workflows:', error);
    return false;
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

/**
 * Vérifie et répare les tables si nécessaire
 * @param {Array<string>} tableNames - Liste des noms de tables à vérifier
 * @returns {Promise<Object>} Résultat de la vérification avec les tables manquantes et créées
 */
async function ensureTables(tableNames = []) {
  if (!tableNames || !Array.isArray(tableNames) || tableNames.length === 0) {
    // Par défaut, vérifier toutes les tables principales
    tableNames = [
      'users', 'applications', 'api_keys', 'workflows', 
      'conversion_logs', 'system_logs', 'ai_providers'
    ];
  }
  
  try {
    console.log(`[DB] Vérification de ${tableNames.length} tables...`);
    
    // Vérifier si les tables existent
    const existingTables = new Set();
    try {
      const tables = await query('SELECT name FROM sqlite_master WHERE type="table"');
      tables.forEach(table => existingTables.add(table.name));
      console.log(`[DB] Tables existantes: ${Array.from(existingTables).join(', ')}`);
    } catch (error) {
      console.error('[DB] Erreur lors de la vérification des tables existantes:', error);
    }
    
    // Importer le schéma
    const schema = require('../db/schema');
    
    // Résultats
    const result = {
      verified: tableNames.length,
      missing: [],
      created: [],
      failed: []
    };
    
    // Vérifier et créer les tables manquantes
    for (const tableName of tableNames) {
      if (!existingTables.has(tableName)) {
        console.log(`[DB] Table manquante: ${tableName}`);
        result.missing.push(tableName);
        
        try {
          const schemaConst = `${tableName.toUpperCase()}_SCHEMA`;
          if (schema[schemaConst]) {
            const tableSchema = schema[schemaConst];
            const createTableQuery = `CREATE TABLE IF NOT EXISTS ${tableSchema.tableName} (${tableSchema.columns})`;
            
            console.log(`[DB] Création de la table ${tableName}...`);
            await run(createTableQuery);
            
            // Vérifier que la table a été créée
            const checkTable = await get(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`, [tableName]);
            if (checkTable) {
              console.log(`[DB] Table ${tableName} créée avec succès`);
              result.created.push(tableName);
            } else {
              console.error(`[DB] Échec de la création de la table ${tableName}`);
              result.failed.push(tableName);
            }
          } else {
            console.error(`[DB] Schéma pour la table ${tableName} non trouvé`);
            result.failed.push(tableName);
          }
        } catch (createError) {
          console.error(`[DB] Erreur lors de la création de la table ${tableName}:`, createError);
          result.failed.push(tableName);
        }
      }
    }
    
    return result;
  } catch (error) {
    console.error('[DB] Erreur lors de la vérification des tables:', error);
    throw error;
  }
}

module.exports = {
  initialize,
  isInitialized,
  close,
  run,
  get,
  query,
  ensureWorkflowsTable,
  ensureTables
};