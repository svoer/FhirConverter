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
 * @route POST /api/ai/chat
 * @description Envoie une requête au modèle d'IA pour obtenir une réponse
 * @access Privé (Nécessite une authentification JWT)
 */
router.post('/chat', jwtAuth, async (req, res) => {
  try {
    const { provider, messages, max_tokens = 1000 } = req.body;
    
    if (!provider || !messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Les paramètres provider et messages sont requis.' });
    }
    
    // Récupérer le fournisseur d'IA spécifié
    const aiProvider = await aiProviderService.getProviderByName(provider);
    
    if (!aiProvider) {
      return res.status(404).json({ error: `Fournisseur d'IA "${provider}" non trouvé.` });
    }
    
    if (!aiProvider.enabled) {
      return res.status(400).json({ error: `Le fournisseur d'IA "${provider}" est désactivé.` });
    }
    
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
        return res.status(400).json({ error: `Type de fournisseur "${provider}" non pris en charge.` });
    }
    
    // Mettre à jour les statistiques d'utilisation
    await aiProviderService.updateProviderUsage(aiProvider.id);
    
    return res.status(200).json(response);
    
  } catch (error) {
    console.error('Erreur lors de la requête au modèle d\'IA:', error);
    return res.status(500).json({ error: `Erreur lors de la communication avec l'IA: ${error.message}` });
  }
});

/**
 * @route GET /api/ai/providers/active
 * @description Récupère la liste des fournisseurs d'IA actifs
 * @access Privé (Nécessite une authentification JWT)
 */
router.get('/providers/active', jwtAuth, async (req, res) => {
  try {
    const activeProviders = await aiProviderService.getActiveProviders();
    
    // Ne pas renvoyer les clés API dans la réponse pour des raisons de sécurité
    const sanitizedProviders = activeProviders.map(provider => {
      const { api_key, ...rest } = provider;
      return rest;
    });
    
    return res.status(200).json(sanitizedProviders);
  } catch (error) {
    console.error('Erreur lors de la récupération des fournisseurs d\'IA actifs:', error);
    return res.status(500).json({ error: `Erreur lors de la récupération des fournisseurs d'IA: ${error.message}` });
  }
});

/**
 * Gère les requêtes pour Mistral AI
 */
async function handleMistralRequest(provider, messages, max_tokens) {
  try {
    const url = provider.api_url || 'https://api.mistral.ai/v1/chat/completions';
    
    // Extraire le modèle à utiliser (par défaut mistral-medium)
    const models = provider.models ? provider.models.split(',').map(m => m.trim()) : ['mistral-medium'];
    const model = models[0];
    
    const response = await axios.post(url, {
      model,
      messages,
      max_tokens
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${provider.api_key}`
      }
    });
    
    return {
      message: response.data.choices[0].message.content,
      model: model,
      provider: 'mistral'
    };
  } catch (error) {
    console.error('Erreur Mistral AI:', error.response?.data || error.message);
    throw new Error(error.response?.data?.error?.message || error.message);
  }
}

/**
 * Gère les requêtes pour OpenAI
 */
async function handleOpenAIRequest(provider, messages, max_tokens) {
  try {
    const url = provider.api_url || 'https://api.openai.com/v1/chat/completions';
    
    // Extraire le modèle à utiliser (par défaut gpt-4o)
    const models = provider.models ? provider.models.split(',').map(m => m.trim()) : ['gpt-4o'];
    const model = models[0];
    
    const response = await axios.post(url, {
      model,
      messages,
      max_tokens
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${provider.api_key}`
      }
    });
    
    return {
      message: response.data.choices[0].message.content,
      model: model,
      provider: 'openai'
    };
  } catch (error) {
    console.error('Erreur OpenAI:', error.response?.data || error.message);
    throw new Error(error.response?.data?.error?.message || error.message);
  }
}

/**
 * Gère les requêtes pour Anthropic (Claude)
 */
async function handleAnthropicRequest(provider, messages, max_tokens) {
  try {
    const url = provider.api_url || 'https://api.anthropic.com/v1/messages';
    
    // Extraire le modèle à utiliser (par défaut claude-3-7-sonnet-20250219)
    const models = provider.models ? provider.models.split(',').map(m => m.trim()) : ['claude-3-7-sonnet-20250219'];
    const model = models[0];
    
    // Convertir le format des messages pour compatibilité Anthropic
    const systemMessage = messages.find(m => m.role === 'system');
    const filteredMessages = messages.filter(m => m.role !== 'system');
    
    const response = await axios.post(url, {
      model,
      messages: filteredMessages,
      system: systemMessage?.content || '',
      max_tokens
    }, {
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': provider.api_key,
        'anthropic-version': '2023-06-01'
      }
    });
    
    return {
      message: response.data.content[0].text,
      model: model,
      provider: 'anthropic'
    };
  } catch (error) {
    console.error('Erreur Anthropic:', error.response?.data || error.message);
    throw new Error(error.response?.data?.error?.message || error.message);
  }
}

/**
 * Gère les requêtes pour Google (Gemini)
 */
async function handleGoogleRequest(provider, messages, max_tokens) {
  try {
    // Pour Google, l'URL doit inclure la clé API en tant que paramètre de requête
    const baseUrl = provider.api_url || 'https://generativelanguage.googleapis.com/v1beta/models';
    
    // Extraire le modèle à utiliser (par défaut gemini-pro)
    const models = provider.models ? provider.models.split(',').map(m => m.trim()) : ['gemini-pro'];
    const model = models[0];
    
    // Construire l'URL avec le modèle et la clé API
    const url = `${baseUrl}/${model}:generateContent?key=${provider.api_key}`;
    
    // Convertir le format des messages pour compatibilité Google
    const systemMessage = messages.find(m => m.role === 'system');
    const userMessages = messages.filter(m => m.role !== 'system');
    
    // Structure de la requête pour Google
    const requestBody = {
      contents: userMessages.map(msg => ({
        role: msg.role === 'assistant' ? 'MODEL' : 'USER',
        parts: [{ text: msg.content }]
      }))
    };
    
    // Ajouter les instructions système si présentes
    if (systemMessage) {
      requestBody.systemInstruction = { parts: [{ text: systemMessage.content }] };
    }
    
    const response = await axios.post(url, requestBody, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    return {
      message: response.data.candidates[0].content.parts[0].text,
      model: model,
      provider: 'google'
    };
  } catch (error) {
    console.error('Erreur Google:', error.response?.data || error.message);
    throw new Error(error.response?.data?.error?.message || error.message);
  }
}

/**
 * Gère les requêtes pour DeepSeek
 */
async function handleDeepSeekRequest(provider, messages, max_tokens) {
  try {
    const url = provider.api_url || 'https://api.deepseek.com/v1/chat/completions';
    
    // Extraire le modèle à utiliser (par défaut deepseek-chat)
    const models = provider.models ? provider.models.split(',').map(m => m.trim()) : ['deepseek-chat'];
    const model = models[0];
    
    const response = await axios.post(url, {
      model,
      messages,
      max_tokens
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${provider.api_key}`
      }
    });
    
    return {
      message: response.data.choices[0].message.content,
      model: model,
      provider: 'deepseek'
    };
  } catch (error) {
    console.error('Erreur DeepSeek:', error.response?.data || error.message);
    throw new Error(error.response?.data?.error?.message || error.message);
  }
}

/**
 * Gère les requêtes pour Ollama (auto-hébergé)
 */
async function handleOllamaRequest(provider, messages, max_tokens) {
  try {
    const url = provider.api_url || 'http://localhost:11434/api/chat';
    
    // Extraire le modèle à utiliser (par défaut llama2)
    const models = provider.models ? provider.models.split(',').map(m => m.trim()) : ['llama2'];
    const model = models[0];
    
    const response = await axios.post(url, {
      model,
      messages,
      stream: false
    }, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    return {
      message: response.data.message.content,
      model: model,
      provider: 'ollama'
    };
  } catch (error) {
    console.error('Erreur Ollama:', error.response?.data || error.message);
    throw new Error(error.response?.data?.error?.message || error.message);
  }
}

module.exports = router;