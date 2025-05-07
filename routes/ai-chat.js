/**
 * Routes pour l'API de chat IA
 * Ces routes permettent d'interagir avec les fournisseurs d'IA configurés
 * pour alimenter le chatbot de support.
 */

const express = require('express');
const router = express.Router();
const jwtAuth = require('../middleware/jwtAuth');
const aiProviderService = require('../src/services/aiProviderService');
const axios = require('axios');

/**
 * @swagger
 * tags:
 *   name: AI Chat
 *   description: API pour interagir avec les modèles d'IA
 */

/**
 * @swagger
 * /api/ai/chat:
 *   post:
 *     summary: Envoie une requête au modèle d'IA
 *     description: Permet d'envoyer une conversation au modèle d'IA configuré et de recevoir une réponse
 *     tags: [AI Chat]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - provider
 *               - messages
 *             properties:
 *               provider:
 *                 type: string
 *                 description: Nom du fournisseur d'IA à utiliser
 *               messages:
 *                 type: array
 *                 description: Historique des messages de la conversation
 *                 items:
 *                   type: object
 *                   properties:
 *                     role:
 *                       type: string
 *                       enum: [system, user, assistant]
 *                     content:
 *                       type: string
 *               max_tokens:
 *                 type: integer
 *                 description: Nombre maximum de tokens à générer
 *                 default: 1000
 *     responses:
 *       200:
 *         description: Réponse générée avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 content:
 *                   type: string
 *                   description: Contenu de la réponse générée
 *       400:
 *         description: Paramètres invalides
 *       404:
 *         description: Fournisseur d'IA non trouvé
 *       500:
 *         description: Erreur serveur
 */
router.post('/ai/chat', async (req, res) => {
  try {
    console.log('[AI CHAT ROUTE] Nouvelle requête de chat reçue sur /api/ai/chat');
    console.log('[AI CHAT ROUTE] Auth JWT désactivée temporairement pour déboguer');
    console.log('[AI CHAT ROUTE] Body reçu:', JSON.stringify(req.body).substring(0, 1000));
    
    // Vérifiez si c'est un appel simple de test (sans body complet)
    if (!req.body || Object.keys(req.body).length === 0) {
      console.log('[AI CHAT ROUTE] Requête de test détectée, utilisation des valeurs par défaut');
      
      // Simuler une requête simple pour tester l'API
      const testResult = await axios.post(
        'https://api.mistral.ai/v1/chat/completions',
        {
          model: 'mistral-medium',
          messages: [{ role: 'user', content: 'Réponds simplement "Connexion réussie"' }]
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer VNjTxMwJ1UwOpQBDERIAwdWKK4LHsCXd'
          },
          timeout: 15000
        }
      );
      
      console.log('[AI CHAT ROUTE] Test direct réussi!');
      return res.status(200).json({ 
        content: `Test réussi! Réponse de l'API: ${testResult.data.choices[0].message.content.substring(0, 100)}` 
      });
    }
    
    const { provider, messages, max_tokens = 1000 } = req.body;
    
    if (!provider || !messages || !Array.isArray(messages)) {
      console.error('[AI CHAT ROUTE] Paramètres manquants:', { provider, messagesIsArray: Array.isArray(messages) });
      return res.status(400).json({ error: 'Les paramètres provider et messages sont requis.' });
    }
    
    // Récupérer le fournisseur d'IA spécifié
    console.log('[AI CHAT ROUTE] Recherche du fournisseur:', provider);
    const aiProvider = await aiProviderService.getProviderByName(provider);
    console.log('[AI CHAT ROUTE] Fournisseur trouvé:', aiProvider ? 'Oui' : 'Non');
    
    if (!aiProvider) {
      console.error(`[AI CHAT ROUTE] Fournisseur d'IA "${provider}" non trouvé`);
      return res.status(404).json({ error: `Fournisseur d'IA "${provider}" non trouvé.` });
    }
    
    if (!aiProvider.enabled) {
      console.log(`[AI CHAT ROUTE] Fournisseur d'IA "${provider}" désactivé`);
      return res.status(400).json({ error: `Le fournisseur d'IA "${provider}" est désactivé.` });
    }
    
    console.log(`[AI CHAT ROUTE] Traitement de la requête avec le fournisseur: ${provider}`);
    console.log(`[AI CHAT ROUTE] Clé API disponible:`, !!aiProvider.api_key);
    
    // Traiter la requête selon le fournisseur d'IA
    let response;
    
    switch (provider.toLowerCase()) {
      case 'mistral':
        response = await handleMistralRequest(aiProvider, messages, max_tokens);
        break;
        
      case 'openai':
        response = await handleOpenAIRequest(aiProvider, messages, max_tokens);
        break;
        
      case 'anthropic':
        response = await handleAnthropicRequest(aiProvider, messages, max_tokens);
        break;
        
      case 'google':
        response = await handleGoogleRequest(aiProvider, messages, max_tokens);
        break;
        
      case 'deepseek':
        response = await handleDeepSeekRequest(aiProvider, messages, max_tokens);
        break;
        
      case 'ollama':
        response = await handleOllamaRequest(aiProvider, messages, max_tokens);
        break;
        
      default:
        console.log(`[AI] Type de fournisseur "${provider}" non pris en charge`);
        return res.status(400).json({ error: `Type de fournisseur "${provider}" non pris en charge.` });
    }
    
    // Mettre à jour les statistiques d'utilisation
    await aiProviderService.updateProviderUsage(aiProvider.id);
    
    console.log('[AI] Réponse générée avec succès');
    return res.status(200).json(response);
    
  } catch (error) {
    console.error('[AI] Erreur lors de la requête au modèle d\'IA:', error);
    return res.status(500).json({ error: `Erreur lors de la communication avec l'IA: ${error.message}` });
  }
});

/**
 * @swagger
 * /api/ai/providers/active:
 *   get:
 *     summary: Récupère la liste des fournisseurs d'IA actifs
 *     description: Renvoie la liste des fournisseurs d'IA actifs sans leurs clés API
 *     tags: [AI Chat]
 *     responses:
 *       200:
 *         description: Liste des fournisseurs d'IA actifs
 *       500:
 *         description: Erreur serveur
 */
router.get('/ai/providers/active', async (req, res) => {
  try {
    console.log('[AI] Récupération des fournisseurs d\'IA actifs pour le chatbot');
    const activeProviders = await aiProviderService.getActiveProviders();
    
    // Ne pas renvoyer les clés API dans la réponse pour des raisons de sécurité
    const sanitizedProviders = activeProviders.map(provider => {
      const { api_key, ...rest } = provider;
      return rest;
    });
    
    console.log(`[AI] ${sanitizedProviders.length} fournisseurs d'IA actifs trouvés`);
    return res.status(200).json(sanitizedProviders);
  } catch (error) {
    console.error('[AI] Erreur lors de la récupération des fournisseurs d\'IA actifs:', error);
    return res.status(500).json({ error: `Erreur lors de la récupération des fournisseurs d'IA: ${error.message}` });
  }
});

/**
 * Gestion des requêtes pour Mistral AI
 */
async function handleMistralRequest(provider, messages, max_tokens) {
  console.log('[MISTRAL DEBUG] Début du traitement de la requête Mistral');
  
  // Correction 2025-05-06: URL de l'API Mistral mise à jour vers le chemin exact
  // Correction 2025-05-07: URL complète pour API Mistral
  let apiUrl = provider.api_url || 'https://api.mistral.ai/v1/chat/completions';
  
  // S'assurer que l'URL se termine par chat/completions
  if (!apiUrl.endsWith('/chat/completions')) {
    if (apiUrl.endsWith('/')) {
      apiUrl = `${apiUrl}chat/completions`;
    } else {
      apiUrl = `${apiUrl}/chat/completions`;
    }
  }
  
  console.log('[MISTRAL DEBUG] URL de l\'API:', apiUrl);
  console.log('[MISTRAL DEBUG] Clé API disponible:', !!provider.api_key);
  console.log('[MISTRAL DEBUG] Longueur de la clé API:', provider.api_key ? provider.api_key.length : 0);
  console.log('[MISTRAL DEBUG] Début de clé API:', provider.api_key ? provider.api_key.substring(0, 5) : 'none');
  
  // Correction 2025-05-06: Parsing plus robuste du modèle Mistral
  let modelToUse = 'mistral-medium';  // Modèle par défaut
  try {
    if (provider.models) {
      console.log('[MISTRAL DEBUG] Models from DB:', provider.models);
      if (provider.models.startsWith('[') && provider.models.endsWith(']')) {
        // Format JSON array
        const modelsArray = JSON.parse(provider.models);
        modelToUse = modelsArray[0] || 'mistral-medium';
      } else if (provider.models.includes(',')) {
        // Format séparé par des virgules
        modelToUse = provider.models.split(',')[0].trim();
      } else {
        // Format de modèle unique
        modelToUse = provider.models.trim();
      }
    }
  } catch (error) {
    console.warn('[MISTRAL DEBUG] Erreur lors du parsing du modèle Mistral:', error);
  }
  
  console.log(`[MISTRAL DEBUG] Modèle sélectionné: ${modelToUse}`);
  console.log(`[MISTRAL DEBUG] Préparation de la requête`);
  
  // Log original messages
  console.log(`[MISTRAL DEBUG] Messages à traiter:`, JSON.stringify(messages).substring(0, 200) + '...');
  
  try {
    console.log(`[MISTRAL DEBUG] Envoi de la requête HTTP à ${apiUrl}`);
    
    const requestPayload = {
      model: modelToUse,
      messages: messages,
      max_tokens: max_tokens
    };
    
    console.log(`[MISTRAL DEBUG] Payload de la requête:`, JSON.stringify(requestPayload).substring(0, 500));
    
    const axios_config = {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${provider.api_key}`
      },
      timeout: 60000  // 60 secondes de timeout
    };
    
    console.log(`[MISTRAL DEBUG] Headers configurés (sans clé API)`);
    
    const response = await axios.post(apiUrl, requestPayload, axios_config);
    
    console.log(`[MISTRAL DEBUG] Réponse reçue avec statut: ${response.status}`);
    console.log(`[MISTRAL DEBUG] Headers de réponse: ${JSON.stringify(response.headers)}`);
    
    // Ajout de débogage pour voir la structure de la réponse
    console.log('[MISTRAL DEBUG] Structure de la réponse:', 
                Object.keys(response.data).join(', '),
                'choices:', response.data.choices ? response.data.choices.length : 'none');
    
    if (response.data) {
      console.log(`[MISTRAL DEBUG] Début de la réponse: ${JSON.stringify(response.data).substring(0, 300)}`);
    }
    
    // Vérification plus robuste des champs
    if (response.data.choices && response.data.choices.length > 0 && response.data.choices[0].message) {
      console.log('[MISTRAL DEBUG] Format de réponse correct, extraction du contenu');
      const content = response.data.choices[0].message.content;
      console.log(`[MISTRAL DEBUG] Contenu extrait (début): ${content.substring(0, 100)}...`);
      return {
        content: content
      };
    } else {
      console.error('[MISTRAL DEBUG] Format de réponse inattendu:', JSON.stringify(response.data).substring(0, 1000));
      throw new Error('Format de réponse Mistral inattendu');
    }
  } catch (error) {
    console.error('[MISTRAL DEBUG] Erreur complète:', error);
    console.error('[MISTRAL DEBUG] Message d\'erreur:', error.message);
    
    if (error.response) {
      console.error('[MISTRAL DEBUG] Statut de l\'erreur:', error.response.status);
      console.error('[MISTRAL DEBUG] Headers de l\'erreur:', JSON.stringify(error.response.headers));
      console.error('[MISTRAL DEBUG] Données de l\'erreur:', JSON.stringify(error.response.data));
    }
    
    if (error.config) {
      console.error('[MISTRAL DEBUG] URL de la requête:', error.config.url);
      console.error('[MISTRAL DEBUG] Méthode de la requête:', error.config.method);
      console.error('[MISTRAL DEBUG] Timeout configuré:', error.config.timeout);
    }
    
    throw new Error(`Erreur Mistral AI: ${error.response?.data?.error?.message || error.message}`);
  }
}

/**
 * Gestion des requêtes pour OpenAI
 */
async function handleOpenAIRequest(provider, messages, max_tokens) {
  // Construire l'URL complète en s'assurant que le chemin /chat/completions est présent
  let apiUrl = provider.api_url || 'https://api.openai.com/v1';
  if (!apiUrl.endsWith('/chat/completions')) {
    apiUrl = apiUrl.endsWith('/') ? `${apiUrl}chat/completions` : `${apiUrl}/chat/completions`;
  }
  
  const models = provider.models ? provider.models.split(',')[0].trim() : 'gpt-4o';
  
  console.log(`[AI] Envoi de requête OpenAI à: ${apiUrl}`);
  console.log(`[AI] Modèle utilisé: ${models}`);
  
  try {
    const response = await axios.post(
      apiUrl,
      {
        model: models,
        messages: messages,
        max_tokens: max_tokens
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${provider.api_key}`
        }
      }
    );
    
    return {
      content: response.data.choices[0].message.content
    };
  } catch (error) {
    console.error('Erreur OpenAI:', error.response?.data || error.message);
    throw new Error(`Erreur OpenAI: ${error.response?.data?.error?.message || error.message}`);
  }
}

/**
 * Gestion des requêtes pour Anthropic
 */
async function handleAnthropicRequest(provider, messages, max_tokens) {
  // Construire l'URL complète en s'assurant que le chemin /messages est présent
  let apiUrl = provider.api_url || 'https://api.anthropic.com/v1';
  if (!apiUrl.endsWith('/messages')) {
    apiUrl = apiUrl.endsWith('/') ? `${apiUrl}messages` : `${apiUrl}/messages`;
  }
  
  const models = provider.models ? provider.models.split(',')[0].trim() : 'claude-3-7-sonnet-20250219';
  
  console.log(`[AI] Envoi de requête Anthropic à: ${apiUrl}`);
  console.log(`[AI] Modèle utilisé: ${models}`);
  
  try {
    // Convertir les messages au format Anthropic
    const anthropicMessages = messages.map(msg => ({
      role: msg.role === 'assistant' ? 'assistant' : 'user',
      content: msg.content
    }));
    
    const response = await axios.post(
      apiUrl,
      {
        model: models,
        messages: anthropicMessages,
        max_tokens: max_tokens
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': provider.api_key,
          'anthropic-version': '2023-06-01'
        }
      }
    );
    
    return {
      content: response.data.content[0].text
    };
  } catch (error) {
    console.error('Erreur Anthropic:', error.response?.data || error.message);
    throw new Error(`Erreur Anthropic: ${error.response?.data?.error?.message || error.message}`);
  }
}

/**
 * Gestion des requêtes pour Google
 */
async function handleGoogleRequest(provider, messages, max_tokens) {
  const apiUrl = provider.api_url || 'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent';
  
  try {
    // Convertir les messages au format Google
    const geminiMessages = messages.map(msg => ({
      role: msg.role,
      parts: [{ text: msg.content }]
    }));
    
    const response = await axios.post(
      `${apiUrl}?key=${provider.api_key}`,
      {
        contents: geminiMessages,
        generationConfig: {
          maxOutputTokens: max_tokens
        }
      },
      {
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );
    
    return {
      content: response.data.candidates[0].content.parts[0].text
    };
  } catch (error) {
    console.error('Erreur Google AI:', error.response?.data || error.message);
    throw new Error(`Erreur Google AI: ${error.response?.data?.error?.message || error.message}`);
  }
}

/**
 * Gestion des requêtes pour DeepSeek
 */
async function handleDeepSeekRequest(provider, messages, max_tokens) {
  // Construire l'URL complète en s'assurant que le chemin /chat/completions est présent
  let apiUrl = provider.api_url || 'https://api.deepseek.com/v1';
  if (!apiUrl.endsWith('/chat/completions')) {
    apiUrl = apiUrl.endsWith('/') ? `${apiUrl}chat/completions` : `${apiUrl}/chat/completions`;
  }
  
  const models = provider.models ? provider.models.split(',')[0].trim() : 'deepseek-chat';
  
  console.log(`[AI] Envoi de requête DeepSeek à: ${apiUrl}`);
  console.log(`[AI] Modèle utilisé: ${models}`);
  
  try {
    const response = await axios.post(
      apiUrl,
      {
        model: models,
        messages: messages,
        max_tokens: max_tokens
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${provider.api_key}`
        }
      }
    );
    
    return {
      content: response.data.choices[0].message.content
    };
  } catch (error) {
    console.error('Erreur DeepSeek:', error.response?.data || error.message);
    throw new Error(`Erreur DeepSeek: ${error.response?.data?.error?.message || error.message}`);
  }
}

/**
 * Gestion des requêtes pour Ollama
 */
async function handleOllamaRequest(provider, messages, max_tokens) {
  const apiUrl = provider.api_url || 'http://localhost:11434/api/chat';
  const models = provider.models ? provider.models.split(',')[0].trim() : 'llama2';
  
  try {
    const response = await axios.post(
      apiUrl,
      {
        model: models,
        messages: messages,
        options: {
          num_predict: max_tokens
        }
      },
      {
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );
    
    return {
      content: response.data.message.content
    };
  } catch (error) {
    console.error('Erreur Ollama:', error.response?.data || error.message);
    throw new Error(`Erreur Ollama: ${error.response?.data?.error?.message || error.message}`);
  }
}

module.exports = router;