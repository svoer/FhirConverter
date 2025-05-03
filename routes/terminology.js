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
router.get('/files', authMiddleware.authenticatedOrApiKey, (req, res) => {
  try {
    console.log('[TERMINOLOGY] Récupération de la liste des fichiers de terminologie');
    
    // Vérifier si l'utilisateur est authentifié ou si une clé API est utilisée
    const userInfo = req.user 
      ? `utilisateur ${req.user.username}` 
      : (req.apiKey ? `clé API ${req.apiKey.id}` : 'non authentifié');
    console.log(`[TERMINOLOGY] Requête par: ${userInfo}`);
    
    // Créer le dossier s'il n'existe pas
    if (!fs.existsSync(TERMINOLOGY_DIR)) {
      try {
        fs.mkdirSync(TERMINOLOGY_DIR, { recursive: true });
        logger.info(`[TERMINOLOGY] Dossier de terminologie créé: ${TERMINOLOGY_DIR}`);
      } catch (dirError) {
        logger.error(`[TERMINOLOGY] Erreur lors de la création du dossier: ${dirError.message}`);
        return res.status(500).json({
          success: false,
          message: 'Erreur lors de la création du dossier de terminologie',
          error: dirError.message
        });
      }
    }

    // Lire le contenu du dossier
    let files = [];
    try {
      const dirContents = fs.readdirSync(TERMINOLOGY_DIR);
      files = dirContents
        .filter(file => file.endsWith('.json') && !file.startsWith('.'))
        .map(file => {
          try {
            const filePath = path.join(TERMINOLOGY_DIR, file);
            const stats = fs.statSync(filePath);
            
            // Récupérer des informations de base sur le fichier
            return {
              name: file,
              size: stats.size,
              lastModified: stats.mtime
            };
          } catch (fileError) {
            logger.warn(`[TERMINOLOGY] Erreur lors de l'accès au fichier ${file}: ${fileError.message}`);
            return {
              name: file,
              size: 0,
              lastModified: new Date(),
              error: 'Erreur d\'accès au fichier'
            };
          }
        });
    } catch (readError) {
      logger.error(`[TERMINOLOGY] Erreur lors de la lecture du dossier: ${readError.message}`);
      return res.status(500).json({
        success: false,
        message: 'Erreur lors de la lecture du dossier de terminologie',
        error: readError.message
      });
    }

    // Renvoyer la liste des fichiers
    console.log(`[TERMINOLOGY] ${files.length} fichiers de terminologie trouvés`);
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
router.get('/stats', authMiddleware.authenticatedOrApiKey, (req, res) => {
  try {
    console.log('[TERMINOLOGY] Récupération des statistiques de terminologie');
    
    // Vérifier si l'utilisateur est authentifié ou si une clé API est utilisée
    const userInfo = req.user 
      ? `utilisateur ${req.user.username}` 
      : (req.apiKey ? `clé API ${req.apiKey.id}` : 'non authentifié');
    console.log(`[TERMINOLOGY] Requête stats par: ${userInfo}`);
    
    // Créer le dossier s'il n'existe pas
    if (!fs.existsSync(TERMINOLOGY_DIR)) {
      try {
        fs.mkdirSync(TERMINOLOGY_DIR, { recursive: true });
        logger.info(`[TERMINOLOGY] Dossier de terminologie créé: ${TERMINOLOGY_DIR}`);
      } catch (dirError) {
        logger.error(`[TERMINOLOGY] Erreur lors de la création du dossier: ${dirError.message}`);
        return res.status(500).json({
          success: false,
          message: 'Erreur lors de la création du dossier de terminologie',
          error: dirError.message
        });
      }
    }

    // Compter les fichiers
    let files = [];
    try {
      files = fs.readdirSync(TERMINOLOGY_DIR)
        .filter(file => file.endsWith('.json') && !file.startsWith('.'));
      console.log(`[TERMINOLOGY] ${files.length} fichiers de terminologie trouvés`);
    } catch (readError) {
      logger.error(`[TERMINOLOGY] Erreur lors de la lecture du dossier: ${readError.message}`);
      return res.status(500).json({
        success: false,
        message: 'Erreur lors de la lecture du dossier de terminologie',
        error: readError.message
      });
    }
    
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
        console.log('[TERMINOLOGY] Fichier de configuration chargé avec succès');
      } catch (configError) {
        logger.error(`[TERMINOLOGY] Erreur lors de la lecture du fichier de configuration: ${configError.message}`);
        console.log('[TERMINOLOGY] Utilisation de la configuration par défaut');
      }
    } else {
      console.log('[TERMINOLOGY] Fichier de configuration non trouvé, utilisation des valeurs par défaut');
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
          console.log(`[TERMINOLOGY] ${systemsCount} systèmes de terminologie trouvés`);
        }
      } catch (error) {
        logger.error(`[TERMINOLOGY] Erreur lors de la lecture des systèmes: ${error.message}`);
      }
    } else {
      console.log('[TERMINOLOGY] Fichier des systèmes de terminologie non trouvé');
    }

    // Si le fichier des OIDs existe, compter les entrées
    const oidsFile = path.join(TERMINOLOGY_DIR, 'ans_oids.json');
    if (fs.existsSync(oidsFile)) {
      try {
        const oidsData = fs.readFileSync(oidsFile, 'utf8');
        const parsedOids = JSON.parse(oidsData);
        if (Array.isArray(parsedOids)) {
          oidsCount = parsedOids.length;
          console.log(`[TERMINOLOGY] ${oidsCount} OIDs trouvés`);
        }
      } catch (error) {
        logger.error(`[TERMINOLOGY] Erreur lors de la lecture des OIDs: ${error.message}`);
      }
    } else {
      console.log('[TERMINOLOGY] Fichier des OIDs non trouvé');
    }

    // Renvoyer les statistiques
    console.log('[TERMINOLOGY] Statistiques récupérées avec succès');
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