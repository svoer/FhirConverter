/**
 * Schéma de base de données pour FHIRHub
 * Définit la structure des tables et des relations dans la base de données SQLite
 */

const path = require('path');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();

// Chemin de la base de données
const DB_PATH = path.join(__dirname, '../../data/fhirhub.db');

// Définition du schéma (structure des tables)
const schema = {
  // Table des utilisateurs
  users: {
    id: 'INTEGER PRIMARY KEY AUTOINCREMENT',
    username: 'TEXT NOT NULL UNIQUE',
    password: 'TEXT NOT NULL',
    email: 'TEXT',
    role: 'TEXT NOT NULL DEFAULT "user"',
    created_at: 'TEXT NOT NULL DEFAULT (datetime("now"))',
    last_login: 'TEXT'
  },
  
  // Table des applications
  applications: {
    id: 'INTEGER PRIMARY KEY AUTOINCREMENT',
    name: 'TEXT NOT NULL',
    description: 'TEXT',
    owner_id: 'INTEGER NOT NULL',
    created_at: 'TEXT NOT NULL DEFAULT (datetime("now"))',
    updated_at: 'TEXT NOT NULL DEFAULT (datetime("now"))',
    'FOREIGN KEY (owner_id)': 'REFERENCES users(id) ON DELETE CASCADE'
  },
  
  // Table des clés API
  api_keys: {
    id: 'INTEGER PRIMARY KEY AUTOINCREMENT',
    application_id: 'INTEGER NOT NULL',
    key: 'TEXT NOT NULL UNIQUE',
    name: 'TEXT NOT NULL',
    environment: 'TEXT NOT NULL DEFAULT "development"',
    active: 'BOOLEAN NOT NULL DEFAULT 1',
    last_used: 'TEXT',
    created_at: 'TEXT NOT NULL DEFAULT (datetime("now"))',
    'FOREIGN KEY (application_id)': 'REFERENCES applications(id) ON DELETE CASCADE'
  },
  
  // Table des journaux de conversion
  conversion_logs: {
    id: 'INTEGER PRIMARY KEY AUTOINCREMENT',
    api_key_id: 'INTEGER NOT NULL',
    application_id: 'INTEGER NOT NULL',
    source_type: 'TEXT NOT NULL',
    hl7_content: 'TEXT NOT NULL',
    fhir_content: 'TEXT',
    status: 'TEXT NOT NULL',
    processing_time: 'INTEGER',
    error_message: 'TEXT',
    created_at: 'TEXT NOT NULL DEFAULT (datetime("now"))',
    'FOREIGN KEY (api_key_id)': 'REFERENCES api_keys(id) ON DELETE CASCADE',
    'FOREIGN KEY (application_id)': 'REFERENCES applications(id) ON DELETE CASCADE'
  },
  
  // Table des métriques de système
  system_metrics: {
    id: 'INTEGER PRIMARY KEY AUTOINCREMENT',
    cpu_usage: 'REAL',
    memory_usage: 'REAL',
    disk_usage: 'REAL',
    active_users: 'INTEGER',
    recorded_at: 'TEXT NOT NULL DEFAULT (datetime("now"))'
  }
};

/**
 * Générer les requêtes SQL de création de tables à partir du schéma
 * @returns {Array<string>} Requêtes SQL de création de tables
 */
function generateCreateTableQueries() {
  const queries = [];
  
  for (const [tableName, columns] of Object.entries(schema)) {
    const columnDefinitions = Object.entries(columns)
      .map(([columnName, definition]) => `${columnName} ${definition}`)
      .join(',\n    ');
    
    const query = `CREATE TABLE IF NOT EXISTS ${tableName} (\n    ${columnDefinitions}\n)`;
    queries.push(query);
  }
  
  return queries;
}

module.exports = {
  schema,
  generateCreateTableQueries,
  DB_PATH
};