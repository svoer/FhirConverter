/**
 * Routes pour la gestion des fournisseurs d'IA
 */

const express = require('express');
const router = express.Router();
const aiProviderService = require('../src/services/aiProviderService');
const jwtAuth = require('../middleware/jwtAuth');

/**
 * @swagger
 * tags:
 *   name: AI Providers
 *   description: API pour la gestion des fournisseurs d'IA
 */

/**
 * @swagger
 * /api/ai-providers:
 *   get:
 *     summary: Récupérer tous les fournisseurs d'IA
 *     tags: [AI Providers]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Liste des fournisseurs d'IA
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: integer
 *                   provider_name:
 *                     type: string
 *                   api_url:
 *                     type: string
 *                   models:
 *                     type: string
 *                   enabled:
 *                     type: boolean
 *       401:
 *         description: Non autorisé
 *       403:
 *         description: Accès refusé
 *       500:
 *         description: Erreur serveur
 */
router.get('/', jwtAuth({ roles: ['admin'] }), async (req, res) => {
  try {
    const providers = await aiProviderService.getAllProviders();
    
    // Masquer les clés API dans la réponse
    const sanitizedProviders = providers.map(provider => {
      const { api_key, ...rest } = provider;
      return {
        ...rest,
        has_api_key: Boolean(api_key)
      };
    });
    
    res.json(sanitizedProviders);
  } catch (error) {
    console.error('[API] Erreur lors de la récupération des fournisseurs d\'IA:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des fournisseurs d\'IA' });
  }
});

/**
 * @swagger
 * /api/ai-providers/supported:
 *   get:
 *     summary: Liste des fournisseurs d'IA pris en charge
 *     tags: [AI Providers]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Liste des fournisseurs d'IA pris en charge
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: string
 *                   name:
 *                     type: string
 *                   description:
 *                     type: string
 *       401:
 *         description: Non autorisé
 *       403:
 *         description: Accès refusé
 */
router.get('/supported', jwtAuth({ roles: ['admin'] }), async (req, res) => {
  try {
    const supportedProviders = aiProviderService.getSupportedProviders();
    res.json(supportedProviders);
  } catch (error) {
    console.error('[API] Erreur lors de la récupération des fournisseurs d\'IA pris en charge:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des fournisseurs d\'IA pris en charge' });
  }
});

/**
 * @swagger
 * /api/ai-providers/{id}:
 *   get:
 *     summary: Récupérer un fournisseur d'IA par son ID
 *     tags: [AI Providers]
 *     security:
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
 *         description: Fournisseur d'IA trouvé
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: integer
 *                 provider_name:
 *                   type: string
 *                 api_url:
 *                   type: string
 *                 models:
 *                   type: string
 *                 enabled:
 *                   type: boolean
 *       401:
 *         description: Non autorisé
 *       403:
 *         description: Accès refusé
 *       404:
 *         description: Fournisseur d'IA non trouvé
 *       500:
 *         description: Erreur serveur
 */
router.get('/:id', jwtAuth({ roles: ['admin'] }), async (req, res) => {
  try {
    // Vérifier si l'ID est un nombre pour éviter de confondre avec d'autres routes
    const id = parseInt(req.params.id);
    
    if (isNaN(id)) {
      return res.status(404).json({ error: 'ID de fournisseur d\'IA invalide' });
    }
    
    const provider = await aiProviderService.getProviderById(id);
    
    if (!provider) {
      return res.status(404).json({ error: 'Fournisseur d\'IA non trouvé' });
    }
    
    // Masquer la clé API dans la réponse
    const { api_key, ...sanitizedProvider } = provider;
    
    res.json({
      ...sanitizedProvider,
      has_api_key: Boolean(api_key)
    });
  } catch (error) {
    console.error(`[API] Erreur lors de la récupération du fournisseur d'IA avec l'ID ${req.params.id}:`, error);
    res.status(500).json({ error: 'Erreur lors de la récupération du fournisseur d\'IA' });
  }
});

/**
 * @swagger
 * /api/ai-providers:
 *   post:
 *     summary: Ajouter un nouveau fournisseur d'IA
 *     tags: [AI Providers]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - provider_name
 *               - api_key
 *             properties:
 *               provider_name:
 *                 type: string
 *               api_key:
 *                 type: string
 *               api_url:
 *                 type: string
 *               models:
 *                 type: string
 *               enabled:
 *                 type: boolean
 *               settings:
 *                 type: string
 *     responses:
 *       201:
 *         description: Fournisseur d'IA ajouté avec succès
 *       400:
 *         description: Données invalides
 *       401:
 *         description: Non autorisé
 *       403:
 *         description: Accès refusé
 *       500:
 *         description: Erreur serveur
 */
router.post('/', jwtAuth({ roles: ['admin'] }), async (req, res) => {
  try {
    const providerData = req.body;
    
    if (!providerData.provider_name || !providerData.api_key) {
      return res.status(400).json({ error: 'Le nom du fournisseur et la clé API sont obligatoires' });
    }
    
    const newProvider = await aiProviderService.addProvider(providerData);
    
    // Masquer la clé API dans la réponse
    const { api_key, ...sanitizedProvider } = newProvider;
    
    res.status(201).json({
      ...sanitizedProvider,
      has_api_key: true
    });
  } catch (error) {
    console.error('[API] Erreur lors de l\'ajout du fournisseur d\'IA:', error);
    
    if (error.message.includes('existe déjà')) {
      return res.status(409).json({ error: error.message });
    }
    
    res.status(500).json({ error: 'Erreur lors de l\'ajout du fournisseur d\'IA' });
  }
});

/**
 * @swagger
 * /api/ai-providers/{id}:
 *   put:
 *     summary: Mettre à jour un fournisseur d'IA
 *     tags: [AI Providers]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID du fournisseur d'IA
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               api_key:
 *                 type: string
 *               api_url:
 *                 type: string
 *               models:
 *                 type: string
 *               enabled:
 *                 type: boolean
 *               settings:
 *                 type: string
 *     responses:
 *       200:
 *         description: Fournisseur d'IA mis à jour avec succès
 *       401:
 *         description: Non autorisé
 *       403:
 *         description: Accès refusé
 *       404:
 *         description: Fournisseur d'IA non trouvé
 *       500:
 *         description: Erreur serveur
 */
router.put('/:id', jwtAuth({ roles: ['admin'] }), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    
    if (isNaN(id)) {
      return res.status(404).json({ error: 'ID de fournisseur d\'IA invalide' });
    }
    
    const providerData = req.body;
    
    const updatedProvider = await aiProviderService.updateProvider(id, providerData);
    
    if (!updatedProvider) {
      return res.status(404).json({ error: 'Fournisseur d\'IA non trouvé' });
    }
    
    // Masquer la clé API dans la réponse
    const { api_key, ...sanitizedProvider } = updatedProvider;
    
    res.json({
      ...sanitizedProvider,
      has_api_key: Boolean(api_key)
    });
  } catch (error) {
    console.error(`[API] Erreur lors de la mise à jour du fournisseur d'IA avec l'ID ${req.params.id}:`, error);
    
    if (error.message.includes('non trouvé')) {
      return res.status(404).json({ error: error.message });
    }
    
    res.status(500).json({ error: 'Erreur lors de la mise à jour du fournisseur d\'IA' });
  }
});

/**
 * @swagger
 * /api/ai-providers/{id}:
 *   delete:
 *     summary: Supprimer un fournisseur d'IA
 *     tags: [AI Providers]
 *     security:
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
 *         description: Fournisseur d'IA supprimé avec succès
 *       401:
 *         description: Non autorisé
 *       403:
 *         description: Accès refusé
 *       404:
 *         description: Fournisseur d'IA non trouvé
 *       500:
 *         description: Erreur serveur
 */
router.delete('/:id', jwtAuth({ roles: ['admin'] }), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    
    if (isNaN(id)) {
      return res.status(404).json({ error: 'ID de fournisseur d\'IA invalide' });
    }
    
    const result = await aiProviderService.deleteProvider(id);
    
    if (!result) {
      return res.status(404).json({ error: 'Fournisseur d\'IA non trouvé' });
    }
    
    res.json({ message: 'Fournisseur d\'IA supprimé avec succès' });
  } catch (error) {
    console.error(`[API] Erreur lors de la suppression du fournisseur d'IA avec l'ID ${req.params.id}:`, error);
    
    if (error.message.includes('non trouvé')) {
      return res.status(404).json({ error: error.message });
    }
    
    res.status(500).json({ error: 'Erreur lors de la suppression du fournisseur d\'IA' });
  }
});

/**
 * @swagger
 * /api/ai-providers/{id}/test:
 *   post:
 *     summary: Tester la connexion à un fournisseur d'IA
 *     tags: [AI Providers]
 *     security:
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
 *         description: Test de connexion réussi
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *       401:
 *         description: Non autorisé
 *       403:
 *         description: Accès refusé
 *       404:
 *         description: Fournisseur d'IA non trouvé
 *       500:
 *         description: Erreur serveur
 */
router.post('/:id/test', jwtAuth({ roles: ['admin'] }), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    
    if (isNaN(id)) {
      return res.status(404).json({ error: 'ID de fournisseur d\'IA invalide' });
    }
    
    const testResult = await aiProviderService.testProviderConnection(id);
    
    res.json(testResult);
  } catch (error) {
    console.error(`[API] Erreur lors du test de connexion au fournisseur d'IA avec l'ID ${req.params.id}:`, error);
    
    if (error.message.includes('non trouvé')) {
      return res.status(404).json({ error: error.message });
    }
    
    res.status(500).json({
      success: false,
      message: 'Erreur lors du test de connexion',
      error: error.message
    });
  }
});

module.exports = router;