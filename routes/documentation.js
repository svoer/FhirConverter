/**
 * Routes pour l'accès à la documentation technique
 * Ces routes permettent d'accéder et de rechercher dans la documentation
 */

const express = require('express');
const router = express.Router();
const documentationService = require('../src/services/documentationService');
const authCombined = require('../middleware/authCombined');

/**
 * @swagger
 * tags:
 *   name: Documentation
 *   description: API pour accéder à la documentation technique
 */

/**
 * @swagger
 * /api/documentation/files:
 *   get:
 *     summary: Liste tous les fichiers de documentation disponibles
 *     tags: [Documentation]
 *     responses:
 *       200:
 *         description: Liste des fichiers de documentation
 *       500:
 *         description: Erreur serveur
 */
router.get('/documentation/files', authCombined.checkAuth, async (req, res) => {
  try {
    const files = await documentationService.getDocumentationFiles();
    return res.status(200).json(files);
  } catch (error) {
    console.error('[DOCS] Erreur lors de la récupération des fichiers de documentation:', error);
    return res.status(500).json({ error: `Erreur lors de la récupération des fichiers de documentation: ${error.message}` });
  }
});

/**
 * @swagger
 * /api/documentation/content/{path}:
 *   get:
 *     summary: Récupère le contenu d'un fichier de documentation
 *     tags: [Documentation]
 *     parameters:
 *       - in: path
 *         name: path
 *         required: true
 *         schema:
 *           type: string
 *         description: Chemin relatif du fichier de documentation
 *     responses:
 *       200:
 *         description: Contenu du fichier de documentation
 *       404:
 *         description: Fichier non trouvé
 *       500:
 *         description: Erreur serveur
 */
router.get('/documentation/content/:path(*)', authCombined.checkAuth, async (req, res) => {
  try {
    const filePath = req.params.path;
    const content = await documentationService.getDocumentContent(filePath);
    return res.status(200).json({ path: filePath, content });
  } catch (error) {
    if (error.message.includes('non trouvé')) {
      return res.status(404).json({ error: error.message });
    }
    console.error('[DOCS] Erreur lors de la récupération du contenu:', error);
    return res.status(500).json({ error: `Erreur lors de la récupération du contenu: ${error.message}` });
  }
});

/**
 * @swagger
 * /api/documentation/search:
 *   get:
 *     summary: Recherche dans la documentation
 *     tags: [Documentation]
 *     parameters:
 *       - in: query
 *         name: q
 *         required: true
 *         schema:
 *           type: string
 *         description: Termes de recherche
 *     responses:
 *       200:
 *         description: Résultats de recherche
 *       400:
 *         description: Requête invalide
 *       500:
 *         description: Erreur serveur
 */
router.get('/documentation/search', authCombined.checkAuth, async (req, res) => {
  try {
    const query = req.query.q;
    
    if (!query || query.trim().length < 2) {
      return res.status(400).json({ error: 'Le terme de recherche doit contenir au moins 2 caractères.' });
    }
    
    const results = await documentationService.searchDocumentation(query);
    return res.status(200).json(results);
  } catch (error) {
    console.error('[DOCS] Erreur lors de la recherche dans la documentation:', error);
    return res.status(500).json({ error: `Erreur lors de la recherche: ${error.message}` });
  }
});

/**
 * @swagger
 * /api/documentation/summary:
 *   get:
 *     summary: Récupère un résumé de la documentation sur un sujet spécifique
 *     description: Cette route est utilisée par le chatbot pour obtenir des informations contextuelles
 *     tags: [Documentation]
 *     parameters:
 *       - in: query
 *         name: topic
 *         required: true
 *         schema:
 *           type: string
 *         description: Sujet de recherche
 *     responses:
 *       200:
 *         description: Résumé de la documentation
 *       400:
 *         description: Requête invalide
 *       404:
 *         description: Aucune documentation trouvée sur ce sujet
 *       500:
 *         description: Erreur serveur
 */
router.get('/documentation/summary', authCombined.checkAuth, async (req, res) => {
  try {
    const topic = req.query.topic;
    
    if (!topic || topic.trim().length < 2) {
      return res.status(400).json({ error: 'Le sujet doit contenir au moins 2 caractères.' });
    }
    
    const summary = await documentationService.getDocumentationSummary(topic);
    
    if (!summary) {
      return res.status(404).json({ 
        error: `Aucune documentation pertinente trouvée pour "${topic}"`,
        message: `Aucune documentation pertinente trouvée pour "${topic}". Veuillez essayer avec des termes plus généraux ou consultez la documentation directement.` 
      });
    }
    
    return res.status(200).json(summary);
  } catch (error) {
    console.error('[DOCS] Erreur lors de la récupération du résumé de documentation:', error);
    return res.status(500).json({ error: `Erreur lors de la récupération du résumé: ${error.message}` });
  }
});

/**
 * @swagger
 * /api/documentation/refresh:
 *   post:
 *     summary: Rafraîchit le cache de documentation
 *     tags: [Documentation]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Cache rafraîchi avec succès
 *       500:
 *         description: Erreur serveur
 */
router.post('/documentation/refresh', authCombined.requireAdmin, async (req, res) => {
  try {
    await documentationService.refreshCache();
    return res.status(200).json({ message: 'Cache de documentation rafraîchi avec succès' });
  } catch (error) {
    console.error('[DOCS] Erreur lors du rafraîchissement du cache:', error);
    return res.status(500).json({ error: `Erreur lors du rafraîchissement du cache: ${error.message}` });
  }
});

module.exports = router;