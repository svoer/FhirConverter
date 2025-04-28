/**
 * Schéma de base de données pour FHIRHub
 * Définit les structures de tables et les relations
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// Assurer que le répertoire data existe
const dataDir = path.join(__dirname, '../../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Chemin vers la base de données
const dbPath = path.join(dataDir, 'fhirhub.db');

/**
 * Créer la base de données si elle n'existe pas
 * @returns {sqlite3.Database} Instance de base de données
 */
function createDatabase() {
  const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
      console.error('[DB] Erreur lors de la connexion à la base de données:', err.message);
      throw err;
    }
    console.log('[DB] Base de données initialisée avec succès');
  });
  
  return db;
}

/**
 * Initialiser le schéma de la base de données
 * @param {sqlite3.Database} db - Instance de base de données
 * @returns {Promise<void>}
 */
function initializeSchema(db) {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      // Table des utilisateurs
      db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        email TEXT,
        role TEXT NOT NULL DEFAULT 'user',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_login TIMESTAMP
      )`, (err) => {
        if (err) {
          console.error('[DB] Erreur lors de la création de la table users:', err.message);
          reject(err);
          return;
        }
      });

      // Table des applications
      db.run(`CREATE TABLE IF NOT EXISTS applications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        description TEXT,
        created_by INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        settings TEXT,
        FOREIGN KEY (created_by) REFERENCES users(id)
      )`, (err) => {
        if (err) {
          console.error('[DB] Erreur lors de la création de la table applications:', err.message);
          reject(err);
          return;
        }
      });

      // Table des clés API
      db.run(`CREATE TABLE IF NOT EXISTS api_keys (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        key TEXT UNIQUE NOT NULL,
        application_id INTEGER NOT NULL,
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_used TIMESTAMP,
        is_active BOOLEAN DEFAULT 1,
        FOREIGN KEY (application_id) REFERENCES applications(id)
      )`, (err) => {
        if (err) {
          console.error('[DB] Erreur lors de la création de la table api_keys:', err.message);
          reject(err);
          return;
        }
      });

      // Table des logs de conversion
      db.run(`CREATE TABLE IF NOT EXISTS conversion_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        api_key_id INTEGER,
        application_id INTEGER,
        source_type TEXT,
        hl7_content TEXT,
        fhir_content TEXT,
        status TEXT,
        processing_time INTEGER,
        error_message TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (api_key_id) REFERENCES api_keys(id),
        FOREIGN KEY (application_id) REFERENCES applications(id)
      )`, (err) => {
        if (err) {
          console.error('[DB] Erreur lors de la création de la table conversion_logs:', err.message);
          reject(err);
          return;
        }
      });

      // Créer l'utilisateur admin par défaut si la table est vide
      db.get('SELECT COUNT(*) as count FROM users', [], (err, row) => {
        if (err) {
          console.error('[DB] Erreur lors de la vérification des utilisateurs:', err.message);
          reject(err);
          return;
        }

        if (row.count === 0) {
          const bcrypt = require('bcrypt');
          const saltRounds = 10;
          const adminPassword = 'adminfhirhub';
          
          bcrypt.hash(adminPassword, saltRounds, (err, hash) => {
            if (err) {
              console.error('[DB] Erreur lors du hachage du mot de passe admin:', err.message);
              reject(err);
              return;
            }
            
            db.run(`INSERT INTO users (username, password, role) VALUES (?, ?, ?)`, 
              ['admin', hash, 'admin'], function(err) {
                if (err) {
                  console.error('[DB] Erreur lors de la création de l\'utilisateur admin:', err.message);
                  reject(err);
                  return;
                }
                
                console.log('[DB] Utilisateur admin créé avec succès');
                
                // Créer une application par défaut
                db.run(`INSERT INTO applications (name, description, created_by) VALUES (?, ?, ?)`,
                  ['Application par défaut', 'Application créée automatiquement', 1], function(err) {
                    if (err) {
                      console.error('[DB] Erreur lors de la création de l\'application par défaut:', err.message);
                      reject(err);
                      return;
                    }
                    
                    console.log('[DB] Application par défaut créée avec succès');
                    
                    // Créer une clé API par défaut
                    db.run(`INSERT INTO api_keys (key, application_id, description) VALUES (?, ?, ?)`,
                      ['dev-key', 1, 'Clé de développement'], function(err) {
                        if (err) {
                          console.error('[DB] Erreur lors de la création de la clé API par défaut:', err.message);
                          reject(err);
                          return;
                        }
                        
                        console.log('[DB] Clé API par défaut créée avec succès');
                        resolve();
                      });
                  });
              });
          });
        } else {
          resolve();
        }
      });
    });
  });
}

module.exports = {
  createDatabase,
  initializeSchema,
  dbPath
};