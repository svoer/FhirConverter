/**
 * Module définissant le schéma de la base de données SQLite pour FHIRHub
 * Ce module initialise la connexion à la base de données et définit les tables
 */

const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

// Créer le répertoire data s'il n'existe pas
const dataDir = path.join(__dirname, '../../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Chemin vers la base de données SQLite
const dbPath = path.join(dataDir, 'fhirhub.db');
const db = new Database(dbPath);

// Initialisation des tables
function initializeDatabase() {
  // Création de la table des utilisateurs
  db.prepare(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      last_login TEXT DEFAULT NULL
    )
  `).run();

  // Création de la table des applications
  db.prepare(`
    CREATE TABLE IF NOT EXISTS applications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      settings TEXT DEFAULT '{}',
      active INTEGER DEFAULT 1,
      retention_days INTEGER DEFAULT 30,
      created_by INTEGER DEFAULT 1
    )
  `).run();

  // Création de la table des clés API
  db.prepare(`
    CREATE TABLE IF NOT EXISTS api_keys (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      app_id INTEGER NOT NULL,
      api_key TEXT UNIQUE NOT NULL,
      description TEXT,
      environment TEXT DEFAULT 'development',
      expires_at TEXT DEFAULT NULL,
      revoked INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      last_used TEXT DEFAULT NULL,
      FOREIGN KEY (app_id) REFERENCES applications(id)
    )
  `).run();
  
  // Création de la table des paramètres d'application
  db.prepare(`
    CREATE TABLE IF NOT EXISTS app_params (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      app_id INTEGER NOT NULL,
      param_key TEXT NOT NULL,
      param_value TEXT,
      FOREIGN KEY (app_id) REFERENCES applications(id),
      UNIQUE(app_id, param_key)
    )
  `).run();

  // Création de la table des conversions
  db.prepare(`
    CREATE TABLE IF NOT EXISTS conversions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      conversion_id TEXT UNIQUE NOT NULL,
      app_id INTEGER,
      source_name TEXT,
      source_content TEXT,
      result_content TEXT,
      status TEXT,
      message TEXT,
      resource_count INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (app_id) REFERENCES applications(id)
    )
  `).run();

  // Création de la table des statistiques
  db.prepare(`
    CREATE TABLE IF NOT EXISTS app_stats (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      app_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      conversion_count INTEGER DEFAULT 0,
      success_count INTEGER DEFAULT 0,
      error_count INTEGER DEFAULT 0,
      resource_count INTEGER DEFAULT 0,
      FOREIGN KEY (app_id) REFERENCES applications(id),
      UNIQUE(app_id, date)
    )
  `).run();

  // Création d'un index pour accélérer les requêtes sur les conversions par app_id
  db.prepare(`
    CREATE INDEX IF NOT EXISTS idx_conversions_app_id
    ON conversions (app_id)
  `).run();

  // Vérification de l'existence d'un utilisateur admin
  const adminExists = db.prepare('SELECT COUNT(*) as count FROM users WHERE username = ?').get('admin');
  
  // Si aucun utilisateur admin n'existe, en créer un
  if (adminExists.count === 0) {
    db.prepare(`
      INSERT INTO users (username, password, role)
      VALUES (?, ?, ?)
    `).run('admin', 'adminfhirhub', 'admin');
    
    console.log('Utilisateur admin créé avec mot de passe par défaut');
  }

  // Vérification de l'existence d'une application par défaut
  const defaultAppExists = db.prepare('SELECT COUNT(*) as count FROM applications WHERE name = ?').get('Application par défaut');
  
  // Si aucune application par défaut n'existe, en créer une
  if (defaultAppExists.count === 0) {
    const result = db.prepare(`
      INSERT INTO applications (name, description, settings)
      VALUES (?, ?, ?)
    `).run('Application par défaut', 'Application créée automatiquement', JSON.stringify({
      maxHistoryDays: 30,
      enableLogging: true
    }));
    
    // Création d'une clé API pour cette application
    const apiKey = 'dev-key';
    db.prepare(`
      INSERT INTO api_keys (app_id, api_key, description)
      VALUES (?, ?, ?)
    `).run(result.lastInsertRowid, apiKey, 'Clé API par défaut');
    
    console.log('Application par défaut créée avec une clé API');
  }
}

// Initialiser la base de données
initializeDatabase();

module.exports = {
  db
};