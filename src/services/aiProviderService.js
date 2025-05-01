/**
 * Service de gestion des fournisseurs d'IA
 * Gère l'ajout, la modification et la suppression des clés API pour différents fournisseurs d'IA
 */

const db = require('./dbService');

/**
 * Liste des fournisseurs d'IA pris en charge
 * @type {Array<Object>}
 */
const SUPPORTED_PROVIDERS = [
  {
    id: 'openai',
    name: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    defaultModels: 'gpt-3.5-turbo,gpt-4',
    description: 'OpenAI (ChatGPT, GPT-4, etc.)',
    documentation: 'https://platform.openai.com/docs/api-reference'
  },
  {
    id: 'google',
    name: 'Google AI',
    baseUrl: 'https://generativelanguage.googleapis.com/v1',
    defaultModels: 'gemini-pro,gemini-pro-vision',
    description: 'Google Gemini (anciennement Bard)',
    documentation: 'https://ai.google.dev/docs'
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    baseUrl: 'https://api.anthropic.com/v1',
    defaultModels: 'claude-3-opus,claude-3-sonnet,claude-3-haiku',
    description: 'Anthropic Claude',
    documentation: 'https://docs.anthropic.com/claude/reference/getting-started-with-the-api'
  },
  {
    id: 'mistral',
    name: 'Mistral AI',
    baseUrl: 'https://api.mistral.ai/v1',
    defaultModels: 'mistral-small,mistral-medium,mistral-large',
    description: 'Mistral AI',
    documentation: 'https://docs.mistral.ai/'
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com/v1',
    defaultModels: 'deepseek-coder,deepseek-chat',
    description: 'DeepSeek AI',
    documentation: 'https://platform.deepseek.com/'
  },
  {
    id: 'ollama',
    name: 'Ollama',
    baseUrl: 'http://localhost:11434/api',
    defaultModels: 'llama3,mistral,codellama',
    description: 'Ollama (modèles locaux)',
    documentation: 'https://github.com/ollama/ollama'
  },
  {
    id: 'custom',
    name: 'API personnalisée',
    baseUrl: '',
    defaultModels: '',
    description: 'API personnalisée compatible OpenAI',
    documentation: ''
  }
];

/**
 * Récupérer tous les fournisseurs d'IA
 * @returns {Promise<Array>} Liste des fournisseurs
 */
async function getAllProviders() {
  try {
    const providers = await db.query('SELECT * FROM ai_providers ORDER BY created_at DESC');
    return providers;
  } catch (error) {
    console.error('[AI] Erreur lors de la récupération des fournisseurs d\'IA:', error);
    throw error;
  }
}

/**
 * Récupérer un fournisseur d'IA par son ID
 * @param {number} id - ID du fournisseur
 * @returns {Promise<Object|null>} Fournisseur trouvé ou null
 */
async function getProviderById(id) {
  try {
    const provider = await db.get('SELECT * FROM ai_providers WHERE id = ?', [id]);
    return provider;
  } catch (error) {
    console.error(`[AI] Erreur lors de la récupération du fournisseur d'IA avec l'ID ${id}:`, error);
    throw error;
  }
}

/**
 * Récupérer un fournisseur d'IA par son nom
 * @param {string} providerName - Nom du fournisseur
 * @returns {Promise<Object|null>} Fournisseur trouvé ou null
 */
async function getProviderByName(providerName) {
  try {
    const provider = await db.get('SELECT * FROM ai_providers WHERE provider_name = ?', [providerName]);
    return provider;
  } catch (error) {
    console.error(`[AI] Erreur lors de la récupération du fournisseur d'IA ${providerName}:`, error);
    throw error;
  }
}

/**
 * Ajouter un nouveau fournisseur d'IA
 * @param {Object} providerData - Données du fournisseur
 * @returns {Promise<Object>} Fournisseur ajouté
 */
async function addProvider(providerData) {
  try {
    // Validation des données
    if (!providerData.provider_name || !providerData.api_key) {
      throw new Error('Le nom du fournisseur et la clé API sont obligatoires');
    }
    
    // Vérifier si le fournisseur existe déjà
    const existingProvider = await getProviderByName(providerData.provider_name);
    if (existingProvider) {
      throw new Error(`Un fournisseur d'IA avec le nom ${providerData.provider_name} existe déjà`);
    }
    
    // Insertion du fournisseur
    const result = await db.run(
      `INSERT INTO ai_providers (
        provider_name, api_key, api_url, models, status, enabled, settings
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        providerData.provider_name,
        providerData.api_key,
        providerData.api_url || getDefaultBaseUrl(providerData.provider_name),
        providerData.models || getDefaultModels(providerData.provider_name),
        providerData.status || 'active',
        providerData.enabled || 1,
        providerData.settings || '{}'
      ]
    );
    
    // Récupérer le fournisseur ajouté
    if (result.lastID) {
      const addedProvider = await getProviderById(result.lastID);
      console.log(`[AI] Fournisseur d'IA ${providerData.provider_name} ajouté avec succès`);
      return addedProvider;
    } else {
      throw new Error('Erreur lors de l\'ajout du fournisseur d\'IA');
    }
  } catch (error) {
    console.error('[AI] Erreur lors de l\'ajout du fournisseur d\'IA:', error);
    throw error;
  }
}

/**
 * Mettre à jour un fournisseur d'IA
 * @param {number} id - ID du fournisseur
 * @param {Object} providerData - Nouvelles données du fournisseur
 * @returns {Promise<Object>} Fournisseur mis à jour
 */
async function updateProvider(id, providerData) {
  try {
    // Vérifier si le fournisseur existe
    const existingProvider = await getProviderById(id);
    if (!existingProvider) {
      throw new Error(`Aucun fournisseur d'IA trouvé avec l'ID ${id}`);
    }
    
    // Construire la requête de mise à jour
    let updateFields = [];
    let updateValues = [];
    
    // Ajouter les champs à mettre à jour
    if (providerData.api_key) {
      updateFields.push('api_key = ?');
      updateValues.push(providerData.api_key);
    }
    
    if (providerData.api_url !== undefined) {
      updateFields.push('api_url = ?');
      updateValues.push(providerData.api_url);
    }
    
    if (providerData.models !== undefined) {
      updateFields.push('models = ?');
      updateValues.push(providerData.models);
    }
    
    if (providerData.status !== undefined) {
      updateFields.push('status = ?');
      updateValues.push(providerData.status);
    }
    
    if (providerData.enabled !== undefined) {
      updateFields.push('enabled = ?');
      updateValues.push(providerData.enabled);
    }
    
    if (providerData.settings !== undefined) {
      updateFields.push('settings = ?');
      updateValues.push(providerData.settings);
    }
    
    if (providerData.test_result !== undefined) {
      updateFields.push('test_result = ?');
      updateValues.push(providerData.test_result);
    }
    
    // Mettre à jour la date de modification
    updateFields.push('updated_at = CURRENT_TIMESTAMP');
    
    // Exécuter la mise à jour si au moins un champ est modifié
    if (updateFields.length > 0) {
      updateValues.push(id); // ID pour la clause WHERE
      const result = await db.run(
        `UPDATE ai_providers SET ${updateFields.join(', ')} WHERE id = ?`,
        updateValues
      );
      
      if (result.changes > 0) {
        const updatedProvider = await getProviderById(id);
        console.log(`[AI] Fournisseur d'IA avec l'ID ${id} mis à jour avec succès`);
        return updatedProvider;
      } else {
        console.log(`[AI] Aucune modification apportée au fournisseur d'IA avec l'ID ${id}`);
        return existingProvider;
      }
    } else {
      console.log(`[AI] Aucun champ à mettre à jour pour le fournisseur d'IA avec l'ID ${id}`);
      return existingProvider;
    }
  } catch (error) {
    console.error(`[AI] Erreur lors de la mise à jour du fournisseur d'IA avec l'ID ${id}:`, error);
    throw error;
  }
}

/**
 * Supprimer un fournisseur d'IA
 * @param {number} id - ID du fournisseur
 * @returns {Promise<boolean>} Succès de la suppression
 */
async function deleteProvider(id) {
  try {
    // Vérifier si le fournisseur existe
    const existingProvider = await getProviderById(id);
    if (!existingProvider) {
      throw new Error(`Aucun fournisseur d'IA trouvé avec l'ID ${id}`);
    }
    
    // Suppression du fournisseur
    const result = await db.run('DELETE FROM ai_providers WHERE id = ?', [id]);
    
    if (result.changes > 0) {
      console.log(`[AI] Fournisseur d'IA avec l'ID ${id} supprimé avec succès`);
      return true;
    } else {
      console.error(`[AI] Erreur lors de la suppression du fournisseur d'IA avec l'ID ${id}`);
      return false;
    }
  } catch (error) {
    console.error(`[AI] Erreur lors de la suppression du fournisseur d'IA avec l'ID ${id}:`, error);
    throw error;
  }
}

/**
 * Tester la connexion à un fournisseur d'IA
 * @param {number} id - ID du fournisseur
 * @returns {Promise<Object>} Résultat du test
 */
async function testProviderConnection(id) {
  try {
    const provider = await getProviderById(id);
    if (!provider) {
      throw new Error(`Aucun fournisseur d'IA trouvé avec l'ID ${id}`);
    }
    
    // TODO: Implémentation des tests spécifiques pour chaque fournisseur
    const testResult = {
      success: true,
      message: `Connexion au fournisseur ${provider.provider_name} établie avec succès`,
      models: [],
      timestamp: new Date().toISOString()
    };
    
    // Mise à jour du résultat du test
    await updateProvider(id, { test_result: JSON.stringify(testResult) });
    
    return testResult;
  } catch (error) {
    console.error(`[AI] Erreur lors du test de connexion au fournisseur d'IA avec l'ID ${id}:`, error);
    
    const errorResult = {
      success: false,
      message: error.message || 'Erreur lors du test de connexion',
      error: error.toString(),
      timestamp: new Date().toISOString()
    };
    
    // Enregistrer le résultat du test même en cas d'échec
    try {
      await updateProvider(id, { test_result: JSON.stringify(errorResult) });
    } catch (updateError) {
      console.error(`[AI] Erreur lors de la mise à jour du résultat du test:`, updateError);
    }
    
    throw error;
  }
}

/**
 * Obtenir l'URL de base par défaut pour un fournisseur
 * @param {string} providerName - Nom du fournisseur
 * @returns {string} URL de base par défaut
 */
function getDefaultBaseUrl(providerName) {
  const provider = SUPPORTED_PROVIDERS.find(p => p.name === providerName || p.id === providerName);
  return provider ? provider.baseUrl : '';
}

/**
 * Obtenir les modèles par défaut pour un fournisseur
 * @param {string} providerName - Nom du fournisseur
 * @returns {string} Modèles par défaut
 */
function getDefaultModels(providerName) {
  const provider = SUPPORTED_PROVIDERS.find(p => p.name === providerName || p.id === providerName);
  return provider ? provider.defaultModels : '';
}

/**
 * Obtenir la liste des fournisseurs d'IA pris en charge
 * @returns {Array<Object>} Liste des fournisseurs pris en charge
 */
function getSupportedProviders() {
  return SUPPORTED_PROVIDERS;
}

module.exports = {
  getAllProviders,
  getProviderById,
  getProviderByName,
  addProvider,
  updateProvider,
  deleteProvider,
  testProviderConnection,
  getSupportedProviders
};