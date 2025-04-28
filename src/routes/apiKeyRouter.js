/**
 * Router pour la gestion des clés API
 * Gère les routes liées au tableau de bord intelligent des clés API
 */

const express = require('express');
const router = express.Router();
const apiKeyService = require('../services/apiKeyService');
const applicationService = require('../services/applicationService');
const { isAuthenticated, isAdmin } = require('../middleware/authMiddleware');

// Middleware d'authentification
router.use(isAuthenticated);

/**
 * GET /api/keys
 * Obtenir toutes les clés API pour une application
 */
router.get('/', async (req, res) => {
  try {
    const { application_id } = req.query;
    
    if (!application_id) {
      return res.status(400).json({
        success: false,
        error: 'Paramètre manquant',
        message: 'Le paramètre application_id est requis'
      });
    }
    
    // Vérifier si l'utilisateur a accès à cette application
    const hasAccess = await applicationService.checkUserAccess(req.user.id, application_id);
    
    if (!hasAccess && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Accès refusé',
        message: 'Vous n\'avez pas accès à cette application'
      });
    }
    
    const apiKeys = await apiKeyService.getApiKeysForApplication(application_id);
    
    res.json({
      success: true,
      data: apiKeys
    });
  } catch (error) {
    console.error('[API-KEY-ROUTER] Erreur lors de la récupération des clés API:', error);
    
    res.status(500).json({
      success: false,
      error: 'Erreur serveur',
      message: 'Une erreur est survenue lors de la récupération des clés API'
    });
  }
});

/**
 * GET /api/keys/:id
 * Obtenir les détails d'une clé API
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const apiKey = await apiKeyService.getApiKey(parseInt(id));
    
    if (!apiKey) {
      return res.status(404).json({
        success: false,
        error: 'Clé API non trouvée',
        message: `La clé API avec l'ID ${id} n'a pas été trouvée`
      });
    }
    
    // Vérifier si l'utilisateur a accès à cette application
    const hasAccess = await applicationService.checkUserAccess(req.user.id, apiKey.application_id);
    
    if (!hasAccess && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Accès refusé',
        message: 'Vous n\'avez pas accès à cette clé API'
      });
    }
    
    res.json({
      success: true,
      data: apiKey
    });
  } catch (error) {
    console.error('[API-KEY-ROUTER] Erreur lors de la récupération des détails de la clé API:', error);
    
    res.status(500).json({
      success: false,
      error: 'Erreur serveur',
      message: 'Une erreur est survenue lors de la récupération des détails de la clé API'
    });
  }
});

/**
 * POST /api/keys
 * Créer une nouvelle clé API
 */
router.post('/', async (req, res) => {
  try {
    const { application_id, name, environment, expires_at, rate_limit, daily_limit, monthly_limit, ip_restrictions } = req.body;
    
    if (!application_id || !name) {
      return res.status(400).json({
        success: false,
        error: 'Paramètres manquants',
        message: 'Les paramètres application_id et name sont requis'
      });
    }
    
    // Vérifier si l'utilisateur a accès à cette application
    const hasAccess = await applicationService.checkUserAccess(req.user.id, application_id);
    
    if (!hasAccess && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Accès refusé',
        message: 'Vous n\'avez pas accès à cette application'
      });
    }
    
    const apiKey = await apiKeyService.createApiKey({
      application_id,
      name,
      environment: environment || 'development',
      expires_at: expires_at || null,
      rate_limit: rate_limit || 100,
      daily_limit: daily_limit || 1000,
      monthly_limit: monthly_limit || 10000,
      ip_restrictions: ip_restrictions || null
    });
    
    res.status(201).json({
      success: true,
      data: apiKey,
      message: 'Clé API créée avec succès'
    });
  } catch (error) {
    console.error('[API-KEY-ROUTER] Erreur lors de la création de la clé API:', error);
    
    res.status(500).json({
      success: false,
      error: 'Erreur serveur',
      message: 'Une erreur est survenue lors de la création de la clé API'
    });
  }
});

/**
 * PUT /api/keys/:id
 * Mettre à jour une clé API
 */
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, active, expires_at, rate_limit, daily_limit, monthly_limit, ip_restrictions } = req.body;
    
    // Récupérer la clé API
    const apiKey = await apiKeyService.getApiKey(parseInt(id));
    
    if (!apiKey) {
      return res.status(404).json({
        success: false,
        error: 'Clé API non trouvée',
        message: `La clé API avec l'ID ${id} n'a pas été trouvée`
      });
    }
    
    // Vérifier si l'utilisateur a accès à cette application
    const hasAccess = await applicationService.checkUserAccess(req.user.id, apiKey.application_id);
    
    if (!hasAccess && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Accès refusé',
        message: 'Vous n\'avez pas accès à cette clé API'
      });
    }
    
    // Mettre à jour la clé API
    const updatedApiKey = await apiKeyService.updateApiKey(parseInt(id), {
      name,
      active,
      expires_at,
      rate_limit,
      daily_limit,
      monthly_limit,
      ip_restrictions
    });
    
    res.json({
      success: true,
      data: updatedApiKey,
      message: 'Clé API mise à jour avec succès'
    });
  } catch (error) {
    console.error('[API-KEY-ROUTER] Erreur lors de la mise à jour de la clé API:', error);
    
    res.status(500).json({
      success: false,
      error: 'Erreur serveur',
      message: 'Une erreur est survenue lors de la mise à jour de la clé API'
    });
  }
});

/**
 * POST /api/keys/:id/regenerate
 * Régénérer une clé API
 */
router.post('/:id/regenerate', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Récupérer la clé API
    const apiKey = await apiKeyService.getApiKey(parseInt(id));
    
    if (!apiKey) {
      return res.status(404).json({
        success: false,
        error: 'Clé API non trouvée',
        message: `La clé API avec l'ID ${id} n'a pas été trouvée`
      });
    }
    
    // Vérifier si l'utilisateur a accès à cette application
    const hasAccess = await applicationService.checkUserAccess(req.user.id, apiKey.application_id);
    
    if (!hasAccess && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Accès refusé',
        message: 'Vous n\'avez pas accès à cette clé API'
      });
    }
    
    // Régénérer la clé API
    const regeneratedApiKey = await apiKeyService.regenerateApiKey(parseInt(id));
    
    res.json({
      success: true,
      data: regeneratedApiKey,
      message: 'Clé API régénérée avec succès'
    });
  } catch (error) {
    console.error('[API-KEY-ROUTER] Erreur lors de la régénération de la clé API:', error);
    
    res.status(500).json({
      success: false,
      error: 'Erreur serveur',
      message: 'Une erreur est survenue lors de la régénération de la clé API'
    });
  }
});

/**
 * DELETE /api/keys/:id
 * Supprimer une clé API
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Récupérer la clé API
    const apiKey = await apiKeyService.getApiKey(parseInt(id));
    
    if (!apiKey) {
      return res.status(404).json({
        success: false,
        error: 'Clé API non trouvée',
        message: `La clé API avec l'ID ${id} n'a pas été trouvée`
      });
    }
    
    // Vérifier si l'utilisateur a accès à cette application
    const hasAccess = await applicationService.checkUserAccess(req.user.id, apiKey.application_id);
    
    if (!hasAccess && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Accès refusé',
        message: 'Vous n\'avez pas accès à cette clé API'
      });
    }
    
    // Supprimer la clé API
    const success = await apiKeyService.deleteApiKey(parseInt(id));
    
    if (!success) {
      return res.status(500).json({
        success: false,
        error: 'Erreur de suppression',
        message: 'Une erreur est survenue lors de la suppression de la clé API'
      });
    }
    
    res.json({
      success: true,
      message: 'Clé API supprimée avec succès'
    });
  } catch (error) {
    console.error('[API-KEY-ROUTER] Erreur lors de la suppression de la clé API:', error);
    
    res.status(500).json({
      success: false,
      error: 'Erreur serveur',
      message: 'Une erreur est survenue lors de la suppression de la clé API'
    });
  }
});

/**
 * GET /api/keys/:id/stats
 * Obtenir les statistiques d'une clé API
 */
router.get('/:id/stats', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Récupérer la clé API
    const apiKey = await apiKeyService.getApiKey(parseInt(id));
    
    if (!apiKey) {
      return res.status(404).json({
        success: false,
        error: 'Clé API non trouvée',
        message: `La clé API avec l'ID ${id} n'a pas été trouvée`
      });
    }
    
    // Vérifier si l'utilisateur a accès à cette application
    const hasAccess = await applicationService.checkUserAccess(req.user.id, apiKey.application_id);
    
    if (!hasAccess && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Accès refusé',
        message: 'Vous n\'avez pas accès à cette clé API'
      });
    }
    
    // Récupérer les statistiques de la clé API
    const stats = await apiKeyService.getApiKeyStats(parseInt(id));
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('[API-KEY-ROUTER] Erreur lors de la récupération des statistiques de la clé API:', error);
    
    res.status(500).json({
      success: false,
      error: 'Erreur serveur',
      message: 'Une erreur est survenue lors de la récupération des statistiques de la clé API'
    });
  }
});

/**
 * POST /api/keys/:id/test
 * Tester une clé API
 */
router.post('/:id/test', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Récupérer la clé API
    const apiKey = await apiKeyService.getApiKey(parseInt(id));
    
    if (!apiKey) {
      return res.status(404).json({
        success: false,
        error: 'Clé API non trouvée',
        message: `La clé API avec l'ID ${id} n'a pas été trouvée`
      });
    }
    
    // Vérifier si l'utilisateur a accès à cette application
    const hasAccess = await applicationService.checkUserAccess(req.user.id, apiKey.application_id);
    
    if (!hasAccess && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Accès refusé',
        message: 'Vous n\'avez pas accès à cette clé API'
      });
    }
    
    // Vérifier si la clé est active
    if (!apiKey.active) {
      return res.json({
        success: false,
        error: 'Clé désactivée',
        message: 'Cette clé API est désactivée et ne peut pas être utilisée'
      });
    }
    
    // Vérifier si la clé a expiré
    if (apiKey.expires_at && new Date(apiKey.expires_at) < new Date()) {
      return res.json({
        success: false,
        error: 'Clé expirée',
        message: 'Cette clé API a expiré et ne peut plus être utilisée'
      });
    }
    
    // Vérifier les limites d'utilisation
    const limits = await apiKeyService.checkApiKeyLimits(parseInt(id));
    
    if (limits.dailyLimitExceeded || limits.monthlyLimitExceeded) {
      return res.json({
        success: false,
        error: 'Limite dépassée',
        message: limits.dailyLimitExceeded 
          ? 'La limite quotidienne a été atteinte pour cette clé API' 
          : 'La limite mensuelle a été atteinte pour cette clé API',
        limits: limits
      });
    }
    
    // Simuler une utilisation de la clé
    await apiKeyService.incrementApiKeyUsage(parseInt(id));
    
    // Simuler une activité API
    await apiKeyService.logApiActivity({
      api_key_id: parseInt(id),
      application_id: apiKey.application_id,
      endpoint: '/api/test',
      method: 'POST',
      status_code: 200,
      response_time: 50,
      ip_address: req.ip,
      user_agent: req.get('User-Agent')
    });
    
    res.json({
      success: true,
      message: 'Clé API testée avec succès',
      status: 'La clé API est valide et fonctionnelle',
      usage: {
        daily: limits.dailyUsage + 1,
        monthly: limits.monthlyUsage + 1,
        dailyLimit: limits.dailyLimit,
        monthlyLimit: limits.monthlyLimit
      }
    });
  } catch (error) {
    console.error('[API-KEY-ROUTER] Erreur lors du test de la clé API:', error);
    
    res.status(500).json({
      success: false,
      error: 'Erreur serveur',
      message: 'Une erreur est survenue lors du test de la clé API'
    });
  }
});

module.exports = router;