/**
 * Service de gestion des applications FHIRHub
 * Fournit les méthodes pour créer, mettre à jour, supprimer et lister
 * les applications qui utilisent l'API FHIRHub
 */

const { db } = require('../db');
const { applications, apiKeys, applicationParameters, applicationFolders } = require('../db/schema');
const { eq, and, desc, isNull, sql } = require('drizzle-orm');
const uuid = require('uuid');
const apiKeyService = require('./apiKeyService');

/**
 * Récupérer toutes les applications
 * @param {Object} options - Options de filtrage et de pagination
 * @returns {Promise<Array>} Liste des applications
 */
async function getAllApplications(options = {}) {
  const { active, limit = 100, offset = 0, orderBy = 'createdAt', orderDir = 'desc' } = options;
  
  let query = db.select().from(applications);
  
  // Filtrer par statut si demandé
  if (active !== undefined) {
    query = query.where(eq(applications.active, active));
  }
  
  // Applique l'ordre et la pagination
  const order = orderDir.toLowerCase() === 'asc' ? sql`${applications[orderBy]}` : sql`${applications[orderBy]} DESC`;
  
  return await query
    .orderBy(order)
    .limit(limit)
    .offset(offset);
}

/**
 * Récupérer une application par son ID
 * @param {number} id - ID de l'application
 * @returns {Promise<Object|null>} Application trouvée ou null
 */
async function getApplicationById(id) {
  const [application] = await db.select()
    .from(applications)
    .where(eq(applications.id, id));
  
  return application || null;
}

/**
 * Récupérer le détail complet d'une application avec ses clés API et paramètres
 * @param {number} id - ID de l'application
 * @returns {Promise<Object|null>} Application avec ses relations
 */
async function getApplicationDetails(id) {
  const [application] = await db.select()
    .from(applications)
    .where(eq(applications.id, id));
  
  if (!application) return null;
  
  // Récupérer les clés API associées
  const appApiKeys = await db.select()
    .from(apiKeys)
    .where(eq(apiKeys.applicationId, id));
  
  // Récupérer les paramètres associés
  const appParams = await db.select()
    .from(applicationParameters)
    .where(eq(applicationParameters.applicationId, id));
  
  // Récupérer les dossiers associés
  const appFolders = await db.select()
    .from(applicationFolders)
    .where(eq(applicationFolders.applicationId, id));
  
  return {
    ...application,
    apiKeys: appApiKeys,
    parameters: appParams,
    folders: appFolders
  };
}

/**
 * Créer une nouvelle application
 * @param {Object} data - Données de l'application
 * @returns {Promise<Object>} Application créée
 */
async function createApplication(data) {
  const { name, description, contactEmail, contactName, logo, settings } = data;
  
  const [application] = await db.insert(applications)
    .values({
      name,
      description,
      contactEmail,
      contactName,
      logo,
      settings: settings || {},
      active: true,
      createdAt: new Date(),
      updatedAt: new Date()
    })
    .returning();
  
  // Créer automatiquement une clé API de production pour l'application
  if (application) {
    await apiKeyService.createApiKey({
      applicationId: application.id,
      name: 'Production',
      active: true
    });
  }
  
  return application;
}

/**
 * Mettre à jour une application existante
 * @param {number} id - ID de l'application
 * @param {Object} data - Données à mettre à jour
 * @returns {Promise<Object|null>} Application mise à jour ou null
 */
async function updateApplication(id, data) {
  const { name, description, contactEmail, contactName, logo, settings, active } = data;
  
  const [application] = await db.update(applications)
    .set({
      ...(name !== undefined && { name }),
      ...(description !== undefined && { description }),
      ...(contactEmail !== undefined && { contactEmail }),
      ...(contactName !== undefined && { contactName }),
      ...(logo !== undefined && { logo }),
      ...(settings !== undefined && { settings }),
      ...(active !== undefined && { active }),
      updatedAt: new Date()
    })
    .where(eq(applications.id, id))
    .returning();
  
  return application || null;
}

/**
 * Supprimer une application
 * @param {number} id - ID de l'application
 * @returns {Promise<boolean>} True si supprimée avec succès
 */
async function deleteApplication(id) {
  // Drizzle ORM gère les suppressions en cascade grâce aux relations définies
  const result = await db.delete(applications)
    .where(eq(applications.id, id));
  
  return result.count > 0;
}

/**
 * Ajouter un paramètre à une application
 * @param {number} applicationId - ID de l'application
 * @param {Object} paramData - Données du paramètre
 * @returns {Promise<Object>} Paramètre créé
 */
async function addApplicationParameter(applicationId, paramData) {
  const { name, value, description, type = 'string' } = paramData;
  
  const [parameter] = await db.insert(applicationParameters)
    .values({
      applicationId,
      name,
      value,
      description,
      type,
      createdAt: new Date(),
      updatedAt: new Date()
    })
    .returning();
  
  return parameter;
}

/**
 * Mettre à jour un paramètre d'application
 * @param {number} parameterId - ID du paramètre
 * @param {Object} paramData - Données à mettre à jour
 * @returns {Promise<Object|null>} Paramètre mis à jour ou null
 */
async function updateApplicationParameter(parameterId, paramData) {
  const { value, description, type } = paramData;
  
  const [parameter] = await db.update(applicationParameters)
    .set({
      ...(value !== undefined && { value }),
      ...(description !== undefined && { description }),
      ...(type !== undefined && { type }),
      updatedAt: new Date()
    })
    .where(eq(applicationParameters.id, parameterId))
    .returning();
  
  return parameter || null;
}

/**
 * Supprimer un paramètre d'application
 * @param {number} parameterId - ID du paramètre
 * @returns {Promise<boolean>} True si supprimé avec succès
 */
async function deleteApplicationParameter(parameterId) {
  const result = await db.delete(applicationParameters)
    .where(eq(applicationParameters.id, parameterId));
  
  return result.count > 0;
}

/**
 * Ajouter un dossier à une application
 * @param {number} applicationId - ID de l'application
 * @param {Object} folderData - Données du dossier
 * @returns {Promise<Object>} Dossier créé
 */
async function addApplicationFolder(applicationId, folderData) {
  const { folderPath, description, isMonitored = true } = folderData;
  
  const [folder] = await db.insert(applicationFolders)
    .values({
      applicationId,
      folderPath,
      description,
      isMonitored,
      createdAt: new Date()
    })
    .returning();
  
  return folder;
}

/**
 * Supprimer un dossier d'application
 * @param {number} folderId - ID du dossier
 * @returns {Promise<boolean>} True si supprimé avec succès
 */
async function deleteApplicationFolder(folderId) {
  const result = await db.delete(applicationFolders)
    .where(eq(applicationFolders.id, folderId));
  
  return result.count > 0;
}

module.exports = {
  getAllApplications,
  getApplicationById,
  getApplicationDetails,
  createApplication,
  updateApplication,
  deleteApplication,
  addApplicationParameter,
  updateApplicationParameter,
  deleteApplicationParameter,
  addApplicationFolder,
  deleteApplicationFolder
};