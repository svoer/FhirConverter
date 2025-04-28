/**
 * Schéma de base de données pour FHIRHub
 * Définit les tables et relations de la base de données SQLite
 */

/**
 * Schéma de la table des utilisateurs
 * @type {Object}
 */
const USERS_SCHEMA = {
  tableName: 'users',
  columns: `
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    email TEXT UNIQUE,
    role TEXT NOT NULL DEFAULT 'user',
    first_name TEXT,
    last_name TEXT,
    last_login TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  `
};

/**
 * Schéma de la table des applications
 * @type {Object}
 */
const APPLICATIONS_SCHEMA = {
  tableName: 'applications',
  columns: `
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    owner_id INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (owner_id) REFERENCES users(id)
  `
};

/**
 * Schéma de la table des clés API
 * @type {Object}
 */
const API_KEYS_SCHEMA = {
  tableName: 'api_keys',
  columns: `
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    application_id INTEGER NOT NULL,
    key TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    environment TEXT NOT NULL DEFAULT 'development',
    active BOOLEAN NOT NULL DEFAULT 1,
    expires_at DATETIME,
    rate_limit INTEGER DEFAULT 100,
    usage_count INTEGER DEFAULT 0,
    last_used_at DATETIME,
    ip_restrictions TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE CASCADE
  `
};

/**
 * Schéma de la table des journaux de conversion
 * @type {Object}
 */
const CONVERSION_LOGS_SCHEMA = {
  tableName: 'conversion_logs',
  columns: `
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    api_key_id INTEGER,
    application_id INTEGER NOT NULL,
    source_type TEXT NOT NULL,
    hl7_content TEXT NOT NULL,
    fhir_content TEXT,
    status TEXT NOT NULL,
    processing_time INTEGER,
    error_message TEXT,
    ip_address TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (api_key_id) REFERENCES api_keys(id) ON DELETE SET NULL,
    FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE CASCADE
  `
};

/**
 * Schéma de la table des métriques système
 * @type {Object}
 */
const SYSTEM_METRICS_SCHEMA = {
  tableName: 'system_metrics',
  columns: `
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cpu_usage REAL,
    memory_usage REAL,
    disk_usage REAL,
    active_connections INTEGER,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  `
};

/**
 * Schéma de la table des notifications
 * @type {Object}
 */
const NOTIFICATIONS_SCHEMA = {
  tableName: 'notifications',
  columns: `
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'info',
    read BOOLEAN NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  `
};

/**
 * Schéma de la table des journaux d'activité API
 * @type {Object}
 */
const API_ACTIVITY_LOGS_SCHEMA = {
  tableName: 'api_activity_logs',
  columns: `
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    api_key_id INTEGER,
    application_id INTEGER NOT NULL,
    endpoint TEXT NOT NULL,
    method TEXT NOT NULL,
    status_code INTEGER NOT NULL,
    response_time INTEGER,
    ip_address TEXT,
    user_agent TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (api_key_id) REFERENCES api_keys(id) ON DELETE SET NULL,
    FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE CASCADE
  `
};

/**
 * Schéma de la table des limites d'utilisation des API
 * @type {Object}
 */
const API_USAGE_LIMITS_SCHEMA = {
  tableName: 'api_usage_limits',
  columns: `
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    application_id INTEGER NOT NULL,
    api_key_id INTEGER,
    daily_limit INTEGER DEFAULT 1000,
    monthly_limit INTEGER DEFAULT 10000,
    current_daily_usage INTEGER DEFAULT 0,
    current_monthly_usage INTEGER DEFAULT 0,
    last_reset_daily DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_reset_monthly DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE CASCADE,
    FOREIGN KEY (api_key_id) REFERENCES api_keys(id) ON DELETE CASCADE
  `
};

// Liste de tous les schémas
const ALL_SCHEMAS = [
  USERS_SCHEMA,
  APPLICATIONS_SCHEMA,
  API_KEYS_SCHEMA,
  CONVERSION_LOGS_SCHEMA,
  SYSTEM_METRICS_SCHEMA,
  NOTIFICATIONS_SCHEMA,
  API_ACTIVITY_LOGS_SCHEMA,
  API_USAGE_LIMITS_SCHEMA
];

module.exports = {
  USERS_SCHEMA,
  APPLICATIONS_SCHEMA,
  API_KEYS_SCHEMA,
  CONVERSION_LOGS_SCHEMA,
  SYSTEM_METRICS_SCHEMA,
  NOTIFICATIONS_SCHEMA,
  API_ACTIVITY_LOGS_SCHEMA,
  API_USAGE_LIMITS_SCHEMA,
  ALL_SCHEMAS
};