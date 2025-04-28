/**
 * Module de gestion de la base de données SQLite
 */
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { Application, ApiKey, ConversionLog } from '../../types';

// Charger les variables d'environnement
dotenv.config();

// Chemin de la base de données
const dbPath = process.env.DB_PATH || './data/fhirhub.db';

// Assurer que le répertoire de la base de données existe
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

// Créer la connexion à la base de données
const db = new Database(dbPath);

// Fonction pour initialiser la base de données
export function initDatabase(): void {
  console.log('Initialisation de la base de données SQLite...');
  
  // Activer les clés étrangères
  db.pragma('foreign_keys = ON');
  
  // Créer la table des applications
  db.exec(`
    CREATE TABLE IF NOT EXISTS applications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      type TEXT,
      description TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      properties TEXT,
      cors_domain TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);
  
  // Créer la table des clés API
  db.exec(`
    CREATE TABLE IF NOT EXISTS api_keys (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      application_id INTEGER NOT NULL,
      key TEXT NOT NULL UNIQUE,
      hashed_key TEXT NOT NULL,
      created_at TEXT NOT NULL,
      last_used_at TEXT,
      is_revoked INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE CASCADE
    )
  `);
  
  // Créer la table des logs de conversion
  db.exec(`
    CREATE TABLE IF NOT EXISTS conversion_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      api_key_id INTEGER NOT NULL,
      source_type TEXT NOT NULL,
      source_content TEXT NOT NULL,
      result_content TEXT NOT NULL,
      status TEXT NOT NULL,
      error_message TEXT,
      processing_time INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (api_key_id) REFERENCES api_keys(id) ON DELETE CASCADE
    )
  `);
  
  console.log('Base de données initialisée avec succès.');
}

// Fonction pour obtenir toutes les applications
export function getAllApplications(): Application[] {
  const stmt = db.prepare('SELECT * FROM applications ORDER BY id DESC');
  const applications = stmt.all() as Application[];
  
  // Parser les propriétés JSON
  return applications.map(app => ({
    ...app,
    properties: app.properties ? JSON.parse(app.properties as unknown as string) : undefined,
    is_active: Boolean(app.is_active)
  }));
}

// Fonction pour obtenir une application par ID
export function getApplicationById(id: number): Application | undefined {
  const stmt = db.prepare('SELECT * FROM applications WHERE id = ?');
  const application = stmt.get(id) as Application | undefined;
  
  if (application) {
    // Parser les propriétés JSON
    return {
      ...application,
      properties: application.properties ? JSON.parse(application.properties as unknown as string) : undefined,
      is_active: Boolean(application.is_active)
    };
  }
  
  return undefined;
}

// Fonction pour créer une nouvelle application
export function createApplication(application: Omit<Application, 'id' | 'created_at' | 'updated_at'>): Application {
  const now = new Date().toISOString();
  
  const stmt = db.prepare(`
    INSERT INTO applications (name, type, description, is_active, properties, cors_domain, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  
  const info = stmt.run(
    application.name,
    application.type || null,
    application.description || null,
    application.is_active ? 1 : 0,
    application.properties ? JSON.stringify(application.properties) : null,
    application.cors_domain || null,
    now,
    now
  );
  
  return {
    id: info.lastInsertRowid as number,
    ...application,
    created_at: now,
    updated_at: now
  };
}

// Fonction pour mettre à jour une application
export function updateApplication(id: number, application: Partial<Application>): Application | undefined {
  const existing = getApplicationById(id);
  
  if (!existing) {
    return undefined;
  }
  
  const now = new Date().toISOString();
  
  const stmt = db.prepare(`
    UPDATE applications
    SET 
      name = COALESCE(?, name),
      type = COALESCE(?, type),
      description = COALESCE(?, description),
      is_active = COALESCE(?, is_active),
      properties = COALESCE(?, properties),
      cors_domain = COALESCE(?, cors_domain),
      updated_at = ?
    WHERE id = ?
  `);
  
  stmt.run(
    application.name || null,
    application.type !== undefined ? application.type : null,
    application.description !== undefined ? application.description : null,
    application.is_active !== undefined ? (application.is_active ? 1 : 0) : null,
    application.properties !== undefined ? JSON.stringify(application.properties) : null,
    application.cors_domain !== undefined ? application.cors_domain : null,
    now,
    id
  );
  
  return getApplicationById(id);
}

// Fonction pour supprimer une application
export function deleteApplication(id: number): boolean {
  const stmt = db.prepare('DELETE FROM applications WHERE id = ?');
  const info = stmt.run(id);
  
  return info.changes > 0;
}

// Fonction pour créer une nouvelle clé API
export function createApiKey(applicationId: number, key: string, hashedKey: string): ApiKey {
  const now = new Date().toISOString();
  
  const stmt = db.prepare(`
    INSERT INTO api_keys (application_id, key, hashed_key, created_at, is_revoked)
    VALUES (?, ?, ?, ?, 0)
  `);
  
  const info = stmt.run(applicationId, key, hashedKey, now);
  
  return {
    id: info.lastInsertRowid as number,
    application_id: applicationId,
    key,
    hashed_key: hashedKey,
    created_at: now,
    last_used_at: null,
    is_revoked: false
  };
}

// Fonction pour obtenir une clé API par sa valeur
export function getApiKeyByKey(key: string): ApiKey | undefined {
  const stmt = db.prepare('SELECT * FROM api_keys WHERE key = ?');
  const apiKey = stmt.get(key) as ApiKey | undefined;
  
  if (apiKey) {
    return {
      ...apiKey,
      is_revoked: Boolean(apiKey.is_revoked)
    };
  }
  
  return undefined;
}

// Fonction pour obtenir une clé API par ID
export function getApiKeyById(id: number): ApiKey | undefined {
  const stmt = db.prepare('SELECT * FROM api_keys WHERE id = ?');
  const apiKey = stmt.get(id) as ApiKey | undefined;
  
  if (apiKey) {
    return {
      ...apiKey,
      is_revoked: Boolean(apiKey.is_revoked)
    };
  }
  
  return undefined;
}

// Fonction pour obtenir toutes les clés API d'une application
export function getApiKeysByApplicationId(applicationId: number): ApiKey[] {
  const stmt = db.prepare('SELECT * FROM api_keys WHERE application_id = ? ORDER BY created_at DESC');
  const apiKeys = stmt.all(applicationId) as ApiKey[];
  
  return apiKeys.map(key => ({
    ...key,
    is_revoked: Boolean(key.is_revoked)
  }));
}

// Fonction pour révoquer une clé API
export function revokeApiKey(id: number): boolean {
  const stmt = db.prepare('UPDATE api_keys SET is_revoked = 1 WHERE id = ?');
  const info = stmt.run(id);
  
  return info.changes > 0;
}

// Fonction pour mettre à jour la date de dernière utilisation d'une clé API
export function updateApiKeyLastUsed(id: number): boolean {
  const now = new Date().toISOString();
  
  const stmt = db.prepare('UPDATE api_keys SET last_used_at = ? WHERE id = ?');
  const info = stmt.run(now, id);
  
  return info.changes > 0;
}

// Fonction pour créer un log de conversion
export function createConversionLog(log: Omit<ConversionLog, 'id' | 'created_at'>): ConversionLog {
  const now = new Date().toISOString();
  
  const stmt = db.prepare(`
    INSERT INTO conversion_logs (
      api_key_id, source_type, source_content, result_content, 
      status, error_message, processing_time, created_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  
  const info = stmt.run(
    log.api_key_id,
    log.source_type,
    log.source_content,
    log.result_content,
    log.status,
    log.error_message || null,
    log.processing_time,
    now
  );
  
  return {
    id: info.lastInsertRowid as number,
    ...log,
    created_at: now
  };
}

// Fonction pour obtenir les logs de conversion d'une clé API
export function getConversionLogsByApiKeyId(apiKeyId: number, limit = 50, offset = 0): ConversionLog[] {
  const stmt = db.prepare(`
    SELECT * FROM conversion_logs 
    WHERE api_key_id = ? 
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?
  `);
  
  return stmt.all(apiKeyId, limit, offset) as ConversionLog[];
}

// Exporter l'instance de la base de données pour un usage direct si nécessaire
export default db;