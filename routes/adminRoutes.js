/**
 * Routes d'administration pour FHIRHub
 * Ces routes sont protégées et accessibles uniquement aux administrateurs
 */

const express = require('express');
const router = express.Router();
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const authMiddleware = require('../middleware/authMiddleware');
const dbService = require('../src/services/dbService');
const logger = require('../src/utils/logger');

// Middleware pour vérifier que l'utilisateur est administrateur
function adminOnly(req, res, next) {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    return res.status(403).json({
      success: false,
      message: 'Accès refusé. Droits administrateur requis.'
    });
  }
}

// Réinitialisation de l'environnement
router.post('/reset-environment', authMiddleware.authenticatedOrApiKey, (req, res) => {
  // Vérifier que nous sommes dans l'environnement de production
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({
      success: false,
      message: 'La réinitialisation de l\'environnement est désactivée en production'
    });
  }

  logger.info('[ADMIN] Demande de réinitialisation de l\'environnement reçue');

  // Chemin vers le script de réinitialisation
  const scriptPath = path.join(__dirname, '..', 'reset-environment.sh');
  
  // Vérifier que le script existe
  if (!fs.existsSync(scriptPath)) {
    logger.error(`[ADMIN] Script de réinitialisation non trouvé: ${scriptPath}`);
    return res.status(500).json({
      success: false,
      message: 'Script de réinitialisation non trouvé'
    });
  }

  // Exécuter le script avec l'option --force pour éviter la confirmation interactive
  exec(`bash ${scriptPath} --force`, (error, stdout, stderr) => {
    if (error) {
      logger.error(`[ADMIN] Erreur lors de la réinitialisation: ${error.message}`);
      logger.error(`[ADMIN] stderr: ${stderr}`);
      return res.status(500).json({
        success: false,
        message: 'Erreur lors de la réinitialisation de l\'environnement',
        error: error.message
      });
    }
    
    logger.info('[ADMIN] Réinitialisation de l\'environnement terminée avec succès');
    logger.debug(`[ADMIN] Sortie du script: ${stdout}`);
    
    // L'enregistrement en base de données n'est pas possible car la base est remise à zéro
    // Nous enregistrons uniquement dans les logs
    
    return res.status(200).json({
      success: true,
      message: 'Environnement réinitialisé avec succès',
      details: stdout
    });
  });
});

// Récupération des logs système
router.get('/system-logs', authMiddleware.authenticated, adminOnly, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const logs = await dbService.query(
      'SELECT * FROM system_logs ORDER BY created_at DESC LIMIT ?',
      [limit]
    );
    
    return res.status(200).json({
      success: true,
      data: logs
    });
  } catch (error) {
    logger.error(`[ADMIN] Erreur lors de la récupération des logs: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des logs système',
      error: error.message
    });
  }
});

module.exports = router;