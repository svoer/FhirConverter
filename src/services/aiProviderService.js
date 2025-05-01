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
    
    // Rechercher le fournisseur supporté correspondant
    const supportedProvider = SUPPORTED_PROVIDERS.find(p => p.id === provider.provider_name);
    if (!supportedProvider) {
      throw new Error(`Type de fournisseur non reconnu: ${provider.provider_name}`);
    }
    
    // Utiliser l'URL personnalisée ou l'URL par défaut
    const apiUrl = provider.api_url || supportedProvider.baseUrl;
    
    // Tester la connexion selon le type de fournisseur
    let testResult;
    
    switch (provider.provider_name) {
      case 'openai':
        testResult = await testOpenAI(provider.api_key, apiUrl);
        break;
      case 'google':
        testResult = await testGoogleAI(provider.api_key, apiUrl);
        break;
      case 'anthropic':
        testResult = await testAnthropic(provider.api_key, apiUrl);
        break;
      case 'mistral':
        testResult = await testMistral(provider.api_key, apiUrl);
        break;
      case 'deepseek':
        testResult = await testDeepSeek(provider.api_key, apiUrl);
        break;
      case 'ollama':
        testResult = await testOllama(apiUrl);
        break;
      case 'custom':
        testResult = await testCustomAPI(provider.api_key, apiUrl);
        break;
      default:
        // Pour les fournisseurs non spécifiés, test générique
        testResult = {
          success: true,
          message: `Fournisseur ${provider.provider_name} configuré (test générique)`,
          models: provider.models ? provider.models.split(',') : [],
          timestamp: new Date().toISOString()
        };
    }
    
    // Ajouter le timestamp
    testResult.timestamp = new Date().toISOString();
    
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

// Fonctions de test pour chaque fournisseur
async function testOpenAI(apiKey, baseUrl) {
  try {
    // Endpoint pour les modèles disponibles
    const url = `${baseUrl}/models`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Erreur OpenAI: ${error.error?.message || response.statusText}`);
    }
    
    const data = await response.json();
    const models = data.data.map(model => model.id).filter(id => id.startsWith('gpt-'));
    
    return {
      success: true,
      message: 'Connexion à OpenAI établie avec succès',
      models: models
    };
  } catch (error) {
    console.error('[AI] Erreur lors du test OpenAI:', error);
    throw new Error(`Connexion à OpenAI échouée: ${error.message}`);
  }
}

async function testGoogleAI(apiKey, baseUrl) {
  try {
    // Endpoint pour les modèles disponibles (Gemini)
    const url = `${baseUrl}/models?key=${apiKey}`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Erreur Google AI: ${error.error?.message || response.statusText}`);
    }
    
    const data = await response.json();
    const models = data.models.map(model => model.name.split('/').pop());
    
    return {
      success: true,
      message: 'Connexion à Google AI établie avec succès',
      models: models
    };
  } catch (error) {
    console.error('[AI] Erreur lors du test Google AI:', error);
    throw new Error(`Connexion à Google AI échouée: ${error.message}`);
  }
}

async function testAnthropic(apiKey, baseUrl) {
  try {
    // Endpoint pour vérifier l'authentification
    const url = `${baseUrl}/models`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Erreur Anthropic: ${error.error?.message || response.statusText}`);
    }
    
    const data = await response.json();
    const models = data.models.map(model => model.id);
    
    return {
      success: true,
      message: 'Connexion à Anthropic établie avec succès',
      models: models
    };
  } catch (error) {
    console.error('[AI] Erreur lors du test Anthropic:', error);
    throw new Error(`Connexion à Anthropic échouée: ${error.message}`);
  }
}

async function testMistral(apiKey, baseUrl) {
  try {
    // Endpoint pour les modèles disponibles
    const url = `${baseUrl}/models`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Erreur Mistral AI: ${error.error?.message || response.statusText}`);
    }
    
    const data = await response.json();
    const models = data.data.map(model => model.id);
    
    return {
      success: true,
      message: 'Connexion à Mistral AI établie avec succès',
      models: models
    };
  } catch (error) {
    console.error('[AI] Erreur lors du test Mistral AI:', error);
    throw new Error(`Connexion à Mistral AI échouée: ${error.message}`);
  }
}

async function testDeepSeek(apiKey, baseUrl) {
  try {
    // DeepSeek utilise une API compatible OpenAI
    const url = `${baseUrl}/models`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Erreur DeepSeek: ${error.error?.message || response.statusText}`);
    }
    
    const data = await response.json();
    const models = data.data.map(model => model.id);
    
    return {
      success: true,
      message: 'Connexion à DeepSeek établie avec succès',
      models: models
    };
  } catch (error) {
    console.error('[AI] Erreur lors du test DeepSeek:', error);
    throw new Error(`Connexion à DeepSeek échouée: ${error.message}`);
  }
}

async function testOllama(baseUrl) {
  try {
    // Endpoint pour les modèles disponibles dans Ollama
    const url = `${baseUrl}/tags`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error(`Erreur Ollama: ${response.statusText}`);
    }
    
    const data = await response.json();
    const models = data.models ? data.models.map(model => model.name) : [];
    
    return {
      success: true,
      message: 'Connexion à Ollama établie avec succès',
      models: models
    };
  } catch (error) {
    console.error('[AI] Erreur lors du test Ollama:', error);
    throw new Error(`Connexion à Ollama échouée: ${error.message}`);
  }
}

async function testCustomAPI(apiKey, baseUrl) {
  try {
    // Tenter de détecter le format de l'API
    let url = `${baseUrl}/models`;
    if (!url.startsWith('http')) {
      url = `https://${url}`;
    }
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error(`Erreur API personnalisée: ${response.statusText}`);
    }
    
    const data = await response.json();
    let models = [];
    
    // Tenter de détecter le format de la réponse
    if (data.data && Array.isArray(data.data)) {
      // Format OpenAI
      models = data.data.map(model => model.id);
    } else if (data.models && Array.isArray(data.models)) {
      // Format Google/Anthropic
      models = data.models.map(model => {
        return model.id || model.name || model;
      });
    }
    
    return {
      success: true,
      message: 'Connexion à l\'API personnalisée établie avec succès',
      models: models
    };
  } catch (error) {
    console.error('[AI] Erreur lors du test de l\'API personnalisée:', error);
    throw new Error(`Connexion à l'API personnalisée échouée: ${error.message}`);
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