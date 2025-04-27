/**
 * Schéma de base de données pour FHIRHub
 * Définit les tables et relations pour la gestion des applications, API keys et logs
 * 
 * Ce module utilise Drizzle ORM pour définir le schéma PostgreSQL
 * permettant de stocker toutes les configurations du système
 */

const { pgTable, serial, text, timestamp, boolean, integer, json, uuid, unique, primaryKey } = require('drizzle-orm/pg-core');
const { relations } = require('drizzle-orm');

/**
 * Table des applications connectées à FHIRHub
 * Chaque application représente un établissement ou logiciel client
 */
const applications = pgTable('applications', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  logo: text('logo'),
  active: boolean('active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  contactEmail: text('contact_email'),
  contactName: text('contact_name'),
  settings: json('settings')
});

/**
 * Relations pour la table applications
 */
const applicationsRelations = relations(applications, ({ many }) => ({
  apiKeys: many(apiKeys),
  folders: many(applicationFolders),
  parameters: many(applicationParameters),
  logs: many(conversionLogs)
}));

/**
 * Table des clés API pour l'authentification
 * Chaque application peut avoir plusieurs clés API (prod, qualif, etc.)
 */
const apiKeys = pgTable('api_keys', {
  id: serial('id').primaryKey(),
  applicationId: integer('application_id').notNull().references(() => applications.id, { onDelete: 'cascade' }),
  keyValue: text('key_value').notNull().unique(),
  name: text('name').notNull(), // Ex: "Production", "Qualification"
  active: boolean('active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  expiresAt: timestamp('expires_at'),
  lastUsedAt: timestamp('last_used_at')
});

/**
 * Relations pour la table apiKeys
 */
const apiKeysRelations = relations(apiKeys, ({ one, many }) => ({
  application: one(applications, {
    fields: [apiKeys.applicationId],
    references: [applications.id]
  }),
  logs: many(conversionLogs)
}));

/**
 * Table des paramètres configurables par application
 * Permet d'ajouter des paramètres personnalisés à chaque application
 */
const applicationParameters = pgTable('application_parameters', {
  id: serial('id').primaryKey(),
  applicationId: integer('application_id').notNull().references(() => applications.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  value: text('value'),
  description: text('description'),
  type: text('type').default('string').notNull(), // string, number, boolean, json
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
}, (t) => ({
  // Chaque paramètre doit avoir un nom unique par application
  unq: unique().on(t.applicationId, t.name)
}));

/**
 * Relations pour la table applicationParameters
 */
const applicationParametersRelations = relations(applicationParameters, ({ one }) => ({
  application: one(applications, {
    fields: [applicationParameters.applicationId],
    references: [applications.id]
  })
}));

/**
 * Table des dossiers assignés aux applications
 * Pour les applications qui déposent des fichiers dans des répertoires surveillés
 */
const applicationFolders = pgTable('application_folders', {
  id: serial('id').primaryKey(),
  applicationId: integer('application_id').notNull().references(() => applications.id, { onDelete: 'cascade' }),
  folderPath: text('folder_path').notNull(),
  description: text('description'),
  isMonitored: boolean('is_monitored').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull()
});

/**
 * Relations pour la table applicationFolders
 */
const applicationFoldersRelations = relations(applicationFolders, ({ one }) => ({
  application: one(applications, {
    fields: [applicationFolders.applicationId],
    references: [applications.id]
  })
}));

/**
 * Table des logs de conversion
 * Enregistre toutes les opérations de conversion avec leur statut
 */
const conversionLogs = pgTable('conversion_logs', {
  id: serial('id').primaryKey(),
  applicationId: integer('application_id').references(() => applications.id, { onDelete: 'set null' }),
  apiKeyId: integer('api_key_id').references(() => apiKeys.id, { onDelete: 'set null' }),
  requestType: text('request_type').notNull(), // api, file, folder
  sourceFilename: text('source_filename'),
  targetFilename: text('target_filename'),
  status: text('status').notNull(), // success, error, warning
  message: text('message'),
  errorDetails: text('error_details'),
  conversionTime: integer('conversion_time'), // en ms
  inputSize: integer('input_size'), // taille en octets
  outputSize: integer('output_size'), // taille en octets
  createdAt: timestamp('created_at').defaultNow().notNull(),
  requestIp: text('request_ip'),
  requestEndpoint: text('request_endpoint'),
  resourceCount: integer('resource_count'), // nombre de ressources FHIR générées
});

/**
 * Relations pour la table conversionLogs
 */
const conversionLogsRelations = relations(conversionLogs, ({ one }) => ({
  application: one(applications, {
    fields: [conversionLogs.applicationId],
    references: [applications.id]
  }),
  apiKey: one(apiKeys, {
    fields: [conversionLogs.apiKeyId],
    references: [apiKeys.id]
  })
}));

/**
 * Table des métriques agrégées pour le dashboard
 * Stocke des statistiques précalculées pour optimiser l'affichage
 */
const dashboardMetrics = pgTable('dashboard_metrics', {
  id: serial('id').primaryKey(),
  date: timestamp('date').notNull(),
  applicationId: integer('application_id').references(() => applications.id, { onDelete: 'cascade' }),
  metricsType: text('metrics_type').notNull(), // daily, weekly, monthly
  conversionCount: integer('conversion_count').default(0).notNull(),
  successCount: integer('success_count').default(0).notNull(),
  errorCount: integer('error_count').default(0).notNull(),
  warningCount: integer('warning_count').default(0).notNull(),
  averageConversionTime: integer('average_conversion_time').default(0).notNull(),
  data: json('data'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
}, (t) => ({
  // Chaque métrique doit être unique par date, application et type
  unq: unique().on(t.date, t.applicationId, t.metricsType)
}));

/**
 * Relations pour la table dashboardMetrics
 */
const dashboardMetricsRelations = relations(dashboardMetrics, ({ one }) => ({
  application: one(applications, {
    fields: [dashboardMetrics.applicationId],
    references: [applications.id]
  })
}));

/**
 * Table des utilisateurs de l'interface d'administration
 */
const users = pgTable('users', {
  id: serial('id').primaryKey(),
  username: text('username').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  email: text('email').unique(),
  fullName: text('full_name'),
  role: text('role').default('user').notNull(), // admin, user
  active: boolean('active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  lastLoginAt: timestamp('last_login_at')
});

// Exportation des tables et relations
module.exports = {
  applications,
  apiKeys,
  applicationParameters,
  applicationFolders,
  conversionLogs,
  dashboardMetrics,
  users
};