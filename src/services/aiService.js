/**
 * Service d'intelligence artificielle centralisé
 * Sert de point d'entrée pour les différentes fonctionnalités AI de FHIRHub
 */

const aiProviderService = require('./aiProviderService');
const aiHelpService = require('./aiHelpService');
const logger = require('../utils/logger');

// Initialisation du service
let initialized = false;

/**
 * Initialiser le service
 * @returns {Promise<void>}
 */
async function initialize() {
  try {
    if (initialized) {
      return;
    }
    
    logger.info('[AI Service] Initialisation du service AI...');
    
    // Initialiser les services dépendants
    await aiProviderService.initialize();
    
    initialized = true;
    logger.info('[AI Service] Service AI initialisé avec succès');
  } catch (error) {
    logger.error(`[AI Service] Erreur lors de l'initialisation du service AI: ${error.message}`);
    throw error;
  }
}

/**
 * Obtenir des suggestions d'aide contextuelles
 * @param {string} context - Contexte actuel (ex: workflow_editor, hl7_conversion)
 * @param {string} currentUrl - URL actuelle de l'utilisateur
 * @param {string} userRole - Rôle de l'utilisateur (ex: admin, user)
 * @returns {Promise<Array>} - Liste de suggestions d'aide
 */
async function getContextualHelpSuggestions(context, currentUrl, userRole) {
  try {
    if (!initialized) {
      await initialize();
    }
    
    return await aiHelpService.getContextualHelpSuggestions(context, currentUrl, userRole);
  } catch (error) {
    logger.error(`[AI Service] Erreur lors de la récupération des suggestions d'aide: ${error.message}`);
    // Utiliser les suggestions par défaut du service d'aide en cas d'erreur
    return aiHelpService._getDefaultSuggestions(context);
  }
}

/**
 * Répondre à une question utilisateur
 * @param {string} query - Question de l'utilisateur
 * @param {string} context - Contexte actuel
 * @param {string} currentUrl - URL actuelle
 * @returns {Promise<Object>} - Réponse et suggestions associées
 */
async function answerUserQuery(query, context, currentUrl) {
  try {
    if (!initialized) {
      await initialize();
    }
    
    return await aiHelpService.answerUserQuery(query, context, currentUrl);
  } catch (error) {
    logger.error(`[AI Service] Erreur lors de la réponse à la question: ${error.message}`);
    // Retourner une réponse par défaut en cas d'erreur
    return {
      answer: "Je suis désolé, je ne peux pas répondre à cette question pour le moment. Veuillez réessayer ultérieurement.",
      relatedSuggestions: aiHelpService._getDefaultSuggestions('default')
    };
  }
}

/**
 * Obtenir le fournisseur d'IA actif pour une tâche spécifique
 * @param {string} task - Tâche à effectuer (ex: help, chat, conversion)
 * @returns {Promise<Object|null>} - Fournisseur d'IA ou null si aucun n'est disponible
 */
async function getAIProviderForTask(task = 'help') {
  try {
    if (!initialized) {
      await initialize();
    }
    
    // Récupérer tous les fournisseurs actifs
    const activeProviders = await aiProviderService.getActiveProviders();
    
    if (!activeProviders || activeProviders.length === 0) {
      logger.warn(`[AI Service] Aucun fournisseur d'IA actif trouvé pour la tâche ${task}`);
      return null;
    }
    
    // Pour le moment, utiliser simplement le premier fournisseur actif
    // Dans une implémentation plus avancée, on pourrait choisir le fournisseur
    // en fonction de la tâche, du coût, des performances, etc.
    const provider = activeProviders[0];
    
    // Configurer le wrapper du fournisseur
    return await aiProviderService.getProviderWrapper(provider.id);
  } catch (error) {
    logger.error(`[AI Service] Erreur lors de la récupération du fournisseur d'IA: ${error.message}`);
    return null;
  }
}

module.exports = {
  initialize,
  getContextualHelpSuggestions,
  answerUserQuery,
  getAIProviderForTask
};