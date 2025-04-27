/**
 * Routes pour les statistiques de conversion
 * Fournit les endpoints API pour obtenir les statistiques de conversion
 */

const express = require('express');
const router = express.Router();
const conversionLogService = require('../services/conversionLogService');

/**
 * GET /api/stats
 * Obtenir les statistiques globales ou spécifiques à une application
 */
router.get('/', (req, res) => {
  try {
    const appId = req.query.appId ? parseInt(req.query.appId) : null;
    
    if (appId) {
      // Statistiques pour une application spécifique
      const stats = conversionLogService.getAppStats(appId);
      res.json({ success: true, data: stats });
    } else {
      // Statistiques globales
      const stats = conversionLogService.getGlobalStats();
      res.json({ success: true, data: stats });
    }
  } catch (error) {
    console.error('Erreur lors de la récupération des statistiques:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;