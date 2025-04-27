/**
 * Service de gestion des clés API
 * Permet la création, mise à jour, et validation des clés API utilisées
 * pour l'authentification des applications
 */

const { db } = require('../db');
const { apiKeys, applications } = require('../db/schema');
const { eq, and, desc, isNull } = require('drizzle-orm');
const crypto = require('crypto');

/**
 * Générer une nouvelle clé API unique
 * @returns {string} Clé API générée
 */
function generateApiKey() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Créer une nouvelle clé API pour une application
 * @param {Object} data - Données de la clé API
 * @returns {Promise<Object>} Clé API créée
 */
async function createApiKey(data) {
  const { applicationId, name, active = true, expiresAt = null } = data;
  
  // Générer une clé API unique
  const keyValue = generateApiKey();
  
  const [apiKey] = await db.insert(apiKeys)
    .values({
      applicationId,
      keyValue,
      name,
      active,
      expiresAt,
      createdAt: new Date()
    })
    .returning();
  
  return apiKey;
}

/**
 * Récupérer toutes les clés API d'une application
 * @param {number} applicationId - ID de l'application
 * @param {Object} options - Options de filtrage
 * @returns {Promise<Array>} Liste des clés API
 */
async function getApiKeysByApplication(applicationId, options = {}) {
  const { active, limit = 100, offset = 0 } = options;
  
  let query = db.select()
    .from(apiKeys)
    .where(eq(apiKeys.applicationId, applicationId));
  
  // Filtrer par statut si demandé
  if (active !== undefined) {
    query = query.where(eq(apiKeys.active, active));
  }
  
  return await query
    .orderBy(desc(apiKeys.createdAt))
    .limit(limit)
    .offset(offset);
}

/**
 * Récupérer une clé API par sa valeur
 * @param {string} keyValue - Valeur de la clé API
 * @returns {Promise<Object|null>} Clé API trouvée ou null
 */
async function getApiKeyByValue(keyValue) {
  const [apiKey] = await db.select({
    id: apiKeys.id,
    keyValue: apiKeys.keyValue,
    name: apiKeys.name,
    active: apiKeys.active,
    applicationId: apiKeys.applicationId,
    expiresAt: apiKeys.expiresAt,
    lastUsedAt: apiKeys.lastUsedAt,
    createdAt: apiKeys.createdAt,
    applicationName: applications.name
  })
  .from(apiKeys)
  .innerJoin(applications, eq(apiKeys.applicationId, applications.id))
  .where(eq(apiKeys.keyValue, keyValue));
  
  return apiKey || null;
}

/**
 * Activer ou désactiver une clé API
 * @param {number} id - ID de la clé API
 * @param {boolean} active - État d'activation
 * @returns {Promise<Object|null>} Clé API mise à jour ou null
 */
async function setApiKeyActive(id, active) {
  const [apiKey] = await db.update(apiKeys)
    .set({ active })
    .where(eq(apiKeys.id, id))
    .returning();
  
  return apiKey || null;
}

/**
 * Mettre à jour la date de dernière utilisation d'une clé API
 * @param {number} id - ID de la clé API
 * @returns {Promise<Object|null>} Clé API mise à jour ou null
 */
async function updateApiKeyLastUsed(id) {
  const [apiKey] = await db.update(apiKeys)
    .set({ lastUsedAt: new Date() })
    .where(eq(apiKeys.id, id))
    .returning();
  
  return apiKey || null;
}

/**
 * Révoquer (supprimer) une clé API
 * @param {number} id - ID de la clé API
 * @returns {Promise<boolean>} True si supprimée avec succès
 */
async function revokeApiKey(id) {
  const result = await db.delete(apiKeys)
    .where(eq(apiKeys.id, id));
  
  return result.count > 0;
}

/**
 * Valider une clé API
 * @param {string} keyValue - Valeur de la clé API à valider
 * @returns {Promise<Object|null>} Informations sur l'application si la clé est valide, null sinon
 */
async function validateApiKey(keyValue) {
  if (!keyValue) return null;
  
  const apiKey = await getApiKeyByValue(keyValue);
  
  // Vérifier si la clé existe et est active
  if (!apiKey || !apiKey.active) return null;
  
  // Vérifier si la clé n'est pas expirée
  if (apiKey.expiresAt && new Date(apiKey.expiresAt) < new Date()) return null;
  
  // Mettre à jour la date de dernière utilisation
  await updateApiKeyLastUsed(apiKey.id);
  
  return {
    apiKeyId: apiKey.id,
    applicationId: apiKey.applicationId,
    applicationName: apiKey.applicationName
  };
}

module.exports = {
  generateApiKey,
  createApiKey,
  getApiKeysByApplication,
  getApiKeyByValue,
  setApiKeyActive,
  updateApiKeyLastUsed,
  revokeApiKey,
  validateApiKey
};