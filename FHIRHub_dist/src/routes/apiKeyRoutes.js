/**
 * Routes API pour la gestion des clés API
 * Permet de créer, gérer et valider des clés API pour chaque application
 */

const express = require('express');
const router = express.Router();
const apiKeyService = require('../services/apiKeyService');
const { requireAdmin, requireAuth } = require('../services/authService');

// Route pour créer une nouvelle clé API pour une application (admin uniquement)
router.post('/:appId', requireAdmin, (req, res) => {
  try {
    const appId = parseInt(req.params.appId);
    const newKey = apiKeyService.createApiKey(appId, req.body);
    
    res.status(201).json(newKey);
  } catch (error) {
    console.error('Erreur lors de la création de la clé API:', error);
    res.status(400).json({ error: error.message });
  }
});

// Route pour lister les clés API d'une application (admin uniquement)
router.get('/:appId', requireAdmin, (req, res) => {
  try {
    const appId = parseInt(req.params.appId);
    const options = {
      active_only: req.query.active_only !== 'false',
      environment: req.query.environment,
      sortBy: req.query.sortBy || 'created_at',
      sortOrder: req.query.sortOrder || 'desc'
    };
    
    const keys = apiKeyService.listApiKeys(appId, options);
    res.json(keys);
  } catch (error) {
    console.error('Erreur lors de la récupération des clés API:', error);
    res.status(500).json({ error: error.message });
  }
});

// Route pour révoquer une clé API (admin uniquement)
router.put('/:id/revoke', requireAdmin, (req, res) => {
  try {
    const keyId = parseInt(req.params.id);
    const result = apiKeyService.revokeApiKey(keyId);
    
    if (!result) {
      return res.status(404).json({ error: 'Clé API non trouvée' });
    }
    
    res.json({ message: 'Clé API révoquée avec succès' });
  } catch (error) {
    console.error('Erreur lors de la révocation de la clé API:', error);
    res.status(500).json({ error: error.message });
  }
});

// Route pour prolonger la validité d'une clé API (admin uniquement)
router.put('/:id/extend', requireAdmin, (req, res) => {
  try {
    const keyId = parseInt(req.params.id);
    const days = parseInt(req.body.days || 365);
    
    if (isNaN(days) || days <= 0) {
      return res.status(400).json({ error: 'Nombre de jours invalide' });
    }
    
    const updatedKey = apiKeyService.extendApiKeyValidity(keyId, days);
    res.json(updatedKey);
  } catch (error) {
    console.error('Erreur lors de la prolongation de la clé API:', error);
    res.status(500).json({ error: error.message });
  }
});

// Route pour supprimer une clé API (admin uniquement)
router.delete('/:id', requireAdmin, (req, res) => {
  try {
    const keyId = parseInt(req.params.id);
    const result = apiKeyService.deleteApiKey(keyId);
    
    if (!result) {
      return res.status(404).json({ error: 'Clé API non trouvée' });
    }
    
    res.json({ message: 'Clé API supprimée avec succès' });
  } catch (error) {
    console.error('Erreur lors de la suppression de la clé API:', error);
    res.status(500).json({ error: error.message });
  }
});

// Route pour vérifier la validité d'une clé API (utilisée principalement en interne)
router.post('/verify', (req, res) => {
  try {
    const apiKey = req.body.api_key || req.headers['x-api-key'];
    
    if (!apiKey) {
      return res.status(400).json({ error: 'Clé API requise' });
    }
    
    const result = apiKeyService.validateApiKey(apiKey);
    
    if (!result) {
      return res.status(401).json({ error: 'Clé API invalide' });
    }
    
    res.json({
      valid: true,
      key: {
        id: result.key.id,
        environment: result.key.environment,
        expires_at: result.key.expires_at
      },
      app: {
        id: result.app.id,
        name: result.app.name
      }
    });
  } catch (error) {
    console.error('Erreur lors de la vérification de la clé API:', error);
    res.status(500).json({ error: error.message });
  }
});

// Middleware d'authentification par clé API
// Peut être utilisé par d'autres routes pour authentifier par API Key
function apiKeyAuth(req, res, next) {
  const apiKey = req.headers['x-api-key'];
  
  if (!apiKey) {
    return res.status(401).json({ error: 'Clé API requise' });
  }
  
  const result = apiKeyService.validateApiKey(apiKey);
  
  if (!result) {
    return res.status(401).json({ error: 'Clé API invalide ou expirée' });
  }
  
  // Ajouter les informations d'application à la requête
  req.apiKey = result.key;
  req.application = result.app;
  
  next();
}

// Export du routeur et du middleware
module.exports = {
  router,
  apiKeyAuth
};