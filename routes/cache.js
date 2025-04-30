/**
 * Routes pour la gestion du cache de conversion
 * @module routes/cache
 */

const express = require('express');
const router = express.Router();
const { getCacheStats, clearCache } = require('../src/cacheEnabledConverter');
const authCombined = require('../middleware/authCombined');

/**
 * @swagger
 * /api/cache/stats:
 *   get:
 *     summary: Obtenir les statistiques du cache
 *     description: Retourne des informations détaillées sur le cache de conversion
 *     tags:
 *       - Cache
 *     security:
 *       - ApiKeyAuth: []
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Statistiques récupérées avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     memory:
 *                       type: object
 *                     disk:
 *                       type: object
 *                     performance:
 *                       type: object
 *                     config:
 *                       type: object
 *       401:
 *         description: Non autorisé
 *       500:
 *         description: Erreur serveur
 */
router.get('/stats', authCombined, (req, res) => {
  try {
    const stats = getCacheStats();
    
    return res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('[API] Erreur lors de la récupération des statistiques du cache:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Erreur lors de la récupération des statistiques du cache'
    });
  }
});

/**
 * @swagger
 * /api/cache/clear:
 *   post:
 *     summary: Vider le cache de conversion
 *     description: Supprime toutes les entrées du cache (mémoire et disque)
 *     tags:
 *       - Cache
 *     security:
 *       - ApiKeyAuth: []
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Cache vidé avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Cache vidé avec succès
 *       401:
 *         description: Non autorisé
 *       500:
 *         description: Erreur serveur
 */
router.post('/clear', authCombined, (req, res) => {
  try {
    clearCache();
    
    return res.json({
      success: true,
      message: 'Cache vidé avec succès'
    });
  } catch (error) {
    console.error('[API] Erreur lors du vidage du cache:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Erreur lors du vidage du cache'
    });
  }
});

module.exports = router;