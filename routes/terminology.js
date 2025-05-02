/**
 * Routes de gestion des terminologies pour FHIRHub
 */

const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const authMiddleware = require('../middleware/authMiddleware');
const logger = require('../src/utils/logger');

// Dossier contenant les fichiers de terminologie
const TERMINOLOGY_DIR = path.join(__dirname, '..', 'french_terminology');

// Route pour obtenir la liste des fichiers de terminologie
router.get('/files', authMiddleware.authenticatedOrApiKey, async (req, res) => {
  try {
    if (!fs.existsSync(TERMINOLOGY_DIR)) {
      fs.mkdirSync(TERMINOLOGY_DIR, { recursive: true });
      logger.info(`[TERMINOLOGY] Dossier de terminologie créé: ${TERMINOLOGY_DIR}`);
    }

    // Lire le contenu du dossier
    const files = fs.readdirSync(TERMINOLOGY_DIR)
      .filter(file => file.endsWith('.json') && !file.startsWith('.'))
      .map(file => {
        const filePath = path.join(TERMINOLOGY_DIR, file);
        const stats = fs.statSync(filePath);
        
        // Récupérer des informations de base sur le fichier
        return {
          name: file,
          size: stats.size,
          lastModified: stats.mtime
        };
      });

    // Renvoyer la liste des fichiers
    return res.status(200).json({
      success: true,
      data: files
    });
  } catch (error) {
    logger.error(`[TERMINOLOGY] Erreur lors de la récupération des fichiers: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des fichiers de terminologie',
      error: error.message
    });
  }
});

// Route pour obtenir les statistiques de terminologie
router.get('/stats', authMiddleware.authenticatedOrApiKey, async (req, res) => {
  try {
    if (!fs.existsSync(TERMINOLOGY_DIR)) {
      fs.mkdirSync(TERMINOLOGY_DIR, { recursive: true });
      logger.info(`[TERMINOLOGY] Dossier de terminologie créé: ${TERMINOLOGY_DIR}`);
    }

    // Compter les fichiers
    const files = fs.readdirSync(TERMINOLOGY_DIR)
      .filter(file => file.endsWith('.json') && !file.startsWith('.'));
    
    // Vérifier si le fichier de configuration existe
    const configFile = path.join(TERMINOLOGY_DIR, 'config.json');
    let config = {
      version: 'v1.0',
      last_updated: new Date().toISOString()
    };

    if (fs.existsSync(configFile)) {
      try {
        const configData = fs.readFileSync(configFile, 'utf8');
        const parsedConfig = JSON.parse(configData);
        config = { ...config, ...parsedConfig };
      } catch (configError) {
        logger.error(`[TERMINOLOGY] Erreur lors de la lecture du fichier de configuration: ${configError.message}`);
      }
    }

    // Compter les systèmes et OIDs
    let systemsCount = 0;
    let oidsCount = 0;

    // Si le fichier des systèmes existe, compter les entrées
    const systemsFile = path.join(TERMINOLOGY_DIR, 'ans_terminology_systems.json');
    if (fs.existsSync(systemsFile)) {
      try {
        const systemsData = fs.readFileSync(systemsFile, 'utf8');
        const parsedSystems = JSON.parse(systemsData);
        if (Array.isArray(parsedSystems)) {
          systemsCount = parsedSystems.length;
        }
      } catch (error) {
        logger.error(`[TERMINOLOGY] Erreur lors de la lecture des systèmes: ${error.message}`);
      }
    }

    // Si le fichier des OIDs existe, compter les entrées
    const oidsFile = path.join(TERMINOLOGY_DIR, 'ans_oids.json');
    if (fs.existsSync(oidsFile)) {
      try {
        const oidsData = fs.readFileSync(oidsFile, 'utf8');
        const parsedOids = JSON.parse(oidsData);
        if (Array.isArray(parsedOids)) {
          oidsCount = parsedOids.length;
        }
      } catch (error) {
        logger.error(`[TERMINOLOGY] Erreur lors de la lecture des OIDs: ${error.message}`);
      }
    }

    // Renvoyer les statistiques
    return res.status(200).json({
      success: true,
      data: {
        version: config.version,
        last_updated: config.last_updated,
        files_count: files.length,
        systems_count: systemsCount,
        oids_count: oidsCount
      }
    });
  } catch (error) {
    logger.error(`[TERMINOLOGY] Erreur lors de la récupération des statistiques: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des statistiques de terminologie',
      error: error.message
    });
  }
});

module.exports = router;