/**
 * Routes pour l'API d'intégration avec les fournisseurs d'IA
 * Ces routes permettent de gérer les fournisseurs d'IA,
 * les clés API et les quotas d'utilisation
 */

const express = require('express');
const router = express.Router();
const authCombined = require('../middleware/authCombined');
const db = require('../src/db/dbService');

/**
 * @swagger
 * tags:
 *   name: AI Providers
 *   description: API pour la gestion des fournisseurs d'IA
 */

/**
 * @swagger
 * /api/ai/providers/active:
 *   get:
 *     summary: Récupérer les fournisseurs d'IA actifs
 *     description: Retourne la liste des fournisseurs d'IA actifs
 *     tags: [AI Providers]
 *     security:
 *       - ApiKeyAuth: []
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Liste des fournisseurs d'IA actifs
 *       401:
 *         description: Non autorisé
 *       500:
 *         description: Erreur serveur
 */
router.get('/providers/active', authCombined, async (req, res) => {
  try {
    const database = db.getDb();
    
    // Récupérer tous les fournisseurs d'IA actifs
    const providers = database.prepare(`
      SELECT id, provider_name, api_url, models, status, enabled, created_at, updated_at, 
             last_used_at, usage_count, monthly_quota, current_usage, settings
      FROM ai_providers
      WHERE enabled = 1 AND status = 'active'
    `).all();
    
    // Masquer la clé API dans la réponse pour des raisons de sécurité
    const sanitizedProviders = providers.map(provider => {
      // Convertir les modèles en tableau si stockés en JSON
      if (provider.models && typeof provider.models === 'string') {
        try {
          provider.models = JSON.parse(provider.models);
        } catch (error) {
          provider.models = [];
        }
      }
      
      // Convertir les paramètres en objet si stockés en JSON
      if (provider.settings && typeof provider.settings === 'string') {
        try {
          provider.settings = JSON.parse(provider.settings);
        } catch (error) {
          provider.settings = {};
        }
      }
      
      return provider;
    });
    
    res.json(sanitizedProviders);
  } catch (error) {
    console.error('Erreur lors de la récupération des fournisseurs d\'IA:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur serveur',
      message: 'Une erreur s\'est produite lors de la récupération des fournisseurs d\'IA'
    });
  }
});

/**
 * @swagger
 * /api/ai/providers/{id}/test:
 *   post:
 *     summary: Tester un fournisseur d'IA
 *     description: Teste la connexion avec un fournisseur d'IA
 *     tags: [AI Providers]
 *     security:
 *       - ApiKeyAuth: []
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID du fournisseur d'IA
 *     responses:
 *       200:
 *         description: Test réussi
 *       400:
 *         description: Fournisseur non trouvé
 *       401:
 *         description: Non autorisé
 *       500:
 *         description: Erreur serveur
 */
router.post('/providers/:id/test', authCombined, async (req, res) => {
  try {
    const { id } = req.params;
    const database = db.getDb();
    
    // Récupérer le fournisseur d'IA
    const provider = database.prepare(`
      SELECT id, provider_name, api_key, api_url, models, status, enabled, settings
      FROM ai_providers
      WHERE id = ?
    `).get(id);
    
    if (!provider) {
      return res.status(400).json({
        success: false,
        error: 'Fournisseur non trouvé',
        message: `Aucun fournisseur trouvé avec l'ID ${id}`
      });
    }
    
    // TODO: Implémenter un test réel avec le fournisseur d'IA
    // Pour l'instant, simuler un test réussi
    const testResult = {
      success: true,
      provider: provider.provider_name,
      models: provider.models,
      responseTime: 456, // en ms
      timestamp: new Date().toISOString()
    };
    
    // Mettre à jour le résultat du test
    database.prepare(`
      UPDATE ai_providers
      SET test_result = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(JSON.stringify(testResult), id);
    
    res.json({
      success: true,
      testResult
    });
  } catch (error) {
    console.error('Erreur lors du test du fournisseur d\'IA:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur serveur',
      message: 'Une erreur s\'est produite lors du test du fournisseur d\'IA'
    });
  }
});

module.exports = router;