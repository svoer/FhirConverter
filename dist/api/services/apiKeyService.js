"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createNewApiKey = createNewApiKey;
exports.validateApiKey = validateApiKey;
exports.revokeExistingApiKey = revokeExistingApiKey;
exports.getApiKeysForApplication = getApiKeysForApplication;
exports.getApiKeyDetails = getApiKeyDetails;
/**
 * Service de gestion des clés API
 */
const crypto_1 = __importDefault(require("crypto"));
const database_1 = require("../db/database");
/**
 * Génère une nouvelle clé API
 *
 * @returns Clé API générée
 */
function generateApiKey() {
    // Préfixe pour identifier les clés API de notre application
    const prefix = 'fhir_';
    // Générer une chaîne aléatoire de 32 caractères
    const randomBytes = crypto_1.default.randomBytes(16);
    const randomString = randomBytes.toString('hex');
    return `${prefix}${randomString}`;
}
/**
 * Hache une clé API pour le stockage sécurisé
 *
 * @param apiKey - Clé API à hacher
 * @returns Clé API hachée
 */
function hashApiKey(apiKey) {
    return crypto_1.default.createHash('sha256').update(apiKey).digest('hex');
}
/**
 * Crée une nouvelle clé API pour une application
 *
 * @param applicationId - ID de l'application
 * @returns Clé API créée
 */
function createNewApiKey(applicationId) {
    // Générer une nouvelle clé API
    const apiKey = generateApiKey();
    // Hacher la clé pour le stockage
    const hashedKey = hashApiKey(apiKey);
    // Créer la clé dans la base de données
    return (0, database_1.createApiKey)(applicationId, apiKey, hashedKey);
}
/**
 * Vérifie si une clé API est valide
 *
 * @param apiKey - Clé API à vérifier
 * @returns ApiKey si valide, undefined sinon
 */
function validateApiKey(apiKey) {
    if (!apiKey)
        return undefined;
    // Récupérer la clé API depuis la base de données
    const storedApiKey = (0, database_1.getApiKeyByKey)(apiKey);
    // Vérifier si la clé existe et n'est pas révoquée
    if (storedApiKey && !storedApiKey.is_revoked) {
        // Mettre à jour la date de dernière utilisation
        (0, database_1.updateApiKeyLastUsed)(storedApiKey.id);
        return storedApiKey;
    }
    return undefined;
}
/**
 * Révoque une clé API
 *
 * @param apiKeyId - ID de la clé API à révoquer
 * @returns true si la clé a été révoquée avec succès
 */
function revokeExistingApiKey(apiKeyId) {
    return (0, database_1.revokeApiKey)(apiKeyId);
}
/**
 * Récupère toutes les clés API d'une application
 *
 * @param applicationId - ID de l'application
 * @returns Liste des clés API
 */
function getApiKeysForApplication(applicationId) {
    return (0, database_1.getApiKeysByApplicationId)(applicationId);
}
/**
 * Récupère une clé API par son ID
 *
 * @param apiKeyId - ID de la clé API
 * @returns Clé API si trouvée, undefined sinon
 */
function getApiKeyDetails(apiKeyId) {
    return (0, database_1.getApiKeyById)(apiKeyId);
}
