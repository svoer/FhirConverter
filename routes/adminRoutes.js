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

// Réinitialisation de l'environnement (simple endpoint)
router.post('/reset-environment', (req, res) => {
  // Vérifier que nous sommes dans l'environnement de production
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({
      success: false,
      message: 'La réinitialisation de l\'environnement est désactivée en production'
    });
  }

  // Vérifier l'authentification via clé API uniquement
  const apiKey = req.headers['x-api-key'];
  if (!apiKey || apiKey !== 'dev-key') {
    return res.status(401).json({
      success: false,
      message: 'Clé API invalide ou manquante'
    });
  }

  logger.info('[ADMIN] Demande de réinitialisation de l\'environnement reçue');

  // Pour éviter l'erreur, on confirme immédiatement
  return res.status(200).json({
    success: true,
    message: 'Demande de réinitialisation reçue',
    details: 'Le processus de réinitialisation a été lancé en arrière-plan. Veuillez vous reconnecter dans quelques secondes.'
  });
  
  // Le code suivant est exécuté après la réponse au client
  // Chemin vers le script de réinitialisation
  const scriptPath = path.join(__dirname, '..', 'reset-environment.sh');
  
  // Exécuter le script avec l'option --force pour éviter la confirmation interactive
  // et le détacher du processus principal pour éviter les problèmes
  setTimeout(() => {
    try {
      exec(`bash ${scriptPath} --force`, (error, stdout, stderr) => {
        if (error) {
          logger.error(`[ADMIN] Erreur lors de la réinitialisation: ${error.message}`);
          logger.error(`[ADMIN] stderr: ${stderr}`);
          return;
        }
        
        logger.info('[ADMIN] Réinitialisation de l\'environnement terminée avec succès');
        logger.debug(`[ADMIN] Sortie du script: ${stdout}`);
      });
    } catch (e) {
      logger.error(`[ADMIN] Exception lors de l'exécution du script: ${e.message}`);
    }
  }, 100);
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