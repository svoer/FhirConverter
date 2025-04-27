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
      try {
        // Statistiques pour une application spécifique
        const stats = conversionLogService.getAppStats(appId);
        return res.json({ success: true, data: stats });
      } catch (appError) {
        console.error('Erreur lors de la récupération des statistiques de l\'application:', appError);
        // En cas d'erreur, retourner des statistiques vides plutôt que de faire échouer la requête
        return res.json({
          success: true,
          data: {
            total: 0,
            success: 0,
            failed: 0,
            resources: 0,
            lastConversion: null
          }
        });
      }
    } else {
      try {
        // Statistiques globales
        const stats = conversionLogService.getGlobalStats();
        return res.json({ success: true, data: stats });
      } catch (globalError) {
        console.error('Erreur lors de la récupération des statistiques globales:', globalError);
        // En cas d'erreur, retourner des statistiques vides
        return res.json({
          success: true,
          data: {
            total: 0,
            success: 0,
            error: 0,
            resources: 0,
            lastConversion: null
          }
        });
      }
    }
  } catch (error) {
    console.error('Erreur lors de la récupération des statistiques:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;