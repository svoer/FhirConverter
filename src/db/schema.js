/**
 * Schéma de base de données SQLite pour FHIRHub
 * Gère les applications, paramètres et clés API de manière portable
 */

const sqlite3 = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Assurer que le répertoire data existe
const dataDir = path.join(__dirname, '../../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Initialiser la base de données
const dbPath = path.join(dataDir, 'fhirhub.db');
const db = sqlite3(dbPath);

// Activer les clés étrangères
db.pragma('foreign_keys = ON');

// Créer les tables si elles n'existent pas
function initializeDatabase() {
  // Table des utilisateurs
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      fullname TEXT,
      email TEXT,
      role TEXT NOT NULL DEFAULT 'user',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      last_login TIMESTAMP
    )
  `);

  // Table des applications
  db.exec(`
    CREATE TABLE IF NOT EXISTS applications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      description TEXT,
      active BOOLEAN DEFAULT 1,
      retention_days INTEGER DEFAULT 30,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      created_by INTEGER,
      FOREIGN KEY (created_by) REFERENCES users(id)
    )
  `);

  // Table des paramètres d'applications (extensible dynamiquement)
  db.exec(`
    CREATE TABLE IF NOT EXISTS app_params (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      app_id INTEGER NOT NULL,
      param_key TEXT NOT NULL,
      param_value TEXT,
      param_type TEXT DEFAULT 'string',
      description TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (app_id) REFERENCES applications(id) ON DELETE CASCADE,
      UNIQUE(app_id, param_key)
    )
  `);

  // Table des clés API
  db.exec(`
    CREATE TABLE IF NOT EXISTS api_keys (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      app_id INTEGER NOT NULL,
      api_key TEXT UNIQUE NOT NULL,
      description TEXT,
      environment TEXT DEFAULT 'development',
      revoked BOOLEAN DEFAULT 0,
      expires_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      last_used TIMESTAMP,
      FOREIGN KEY (app_id) REFERENCES applications(id) ON DELETE CASCADE
    )
  `);

  // Table supprimée : app_folders (monitoring)

  // Table des conversions HL7->FHIR
  db.exec(`
    CREATE TABLE IF NOT EXISTS conversions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      conversion_id TEXT UNIQUE NOT NULL,
      app_id INTEGER,
      api_key_id INTEGER,
      source_type TEXT,
      source_name TEXT,
      source_size INTEGER,
      resource_count INTEGER,
      status TEXT,
      error_message TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      completed_at TIMESTAMP,
      FOREIGN KEY (app_id) REFERENCES applications(id) ON DELETE SET NULL,
      FOREIGN KEY (api_key_id) REFERENCES api_keys(id) ON DELETE SET NULL
    )
  `);

  // Table des statistiques par application
  db.exec(`
    CREATE TABLE IF NOT EXISTS app_stats (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      app_id INTEGER NOT NULL,
      date DATE NOT NULL,
      conversion_count INTEGER DEFAULT 0,
      success_count INTEGER DEFAULT 0,
      error_count INTEGER DEFAULT 0,
      resource_count INTEGER DEFAULT 0,
      FOREIGN KEY (app_id) REFERENCES applications(id) ON DELETE CASCADE,
      UNIQUE(app_id, date)
    )
  `);

  console.log('Base de données initialisée avec succès');
  
  // Vérifier si l'utilisateur admin existe déjà
  const adminExists = db.prepare('SELECT id FROM users WHERE username = ?').get('admin');
  
  // Si l'admin n'existe pas, l'ajouter
  if (!adminExists) {
    // Mot de passe: adminfhirhub
    const adminPassword = '$2b$10$QJFFLbLCEMXdPC8dBHxgVOHCG7PiLBf4B5BWJ8WgnrDBVn3sQZr3m';
    
    db.prepare(`
      INSERT INTO users (username, password, fullname, email, role)
      VALUES (?, ?, ?, ?, ?)
    `).run('admin', adminPassword, 'Administrateur', 'admin@fhirhub.local', 'admin');
    
    console.log('Utilisateur admin créé avec succès');
  }
  
  // Vérifier si l'utilisateur standard existe déjà
  const userExists = db.prepare('SELECT id FROM users WHERE username = ?').get('user');
  
  // Si l'utilisateur standard n'existe pas, l'ajouter
  if (!userExists) {
    // Mot de passe: userfhirhub
    const userPassword = '$2b$10$0Z4Evm3HBJ0.HYZY6Gy7oekZpEFzQlQmEJzikVJFkwYpY3jLK8QZC';
    
    db.prepare(`
      INSERT INTO users (username, password, fullname, email, role)
      VALUES (?, ?, ?, ?, ?)
    `).run('user', userPassword, 'Utilisateur', 'user@fhirhub.local', 'user');
    
    console.log('Utilisateur standard créé avec succès');
  }
  
  // Vérifier si une clé API par défaut existe
  const apiKeyExists = db.prepare('SELECT id FROM api_keys WHERE api_key = ?').get('dev-key');
  
  // Si aucune clé API n'existe, créer l'application par défaut et sa clé
  if (!apiKeyExists) {
    // Créer une application par défaut
    const appResult = db.prepare(`
      INSERT INTO applications (name, description, retention_days, created_by)
      VALUES (?, ?, ?, ?)
    `).run('Application par défaut', 'Application créée automatiquement', 30, 1);
    
    const appId = appResult.lastInsertRowid;
    
    // Ajouter la clé API de développement
    db.prepare(`
      INSERT INTO api_keys (app_id, api_key, description, environment)
      VALUES (?, ?, ?, ?)
    `).run(appId, 'dev-key', 'Clé de développement par défaut', 'development');
    
    console.log('Application par défaut et clé API créées avec succès');
  }
}

// Exporter la connexion à la base de données et les fonctions
module.exports = {
  db,
  initializeDatabase
};