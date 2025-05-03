/**
 * Routes de gestion des terminologies pour FHIRHub
 */

const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const archiver = require('archiver');
const authMiddleware = require('../middleware/authMiddleware');
const logger = require('../src/utils/logger');

// Clé secrète pour vérifier les JWT (à déplacer dans une variable d'environnement en production)
const JWT_SECRET = process.env.JWT_SECRET || 'fhirhub-secret-key';

// Middleware personnalisé pour la terminologie qui permet l'accès sans authentification en développement
const terminologyAuth = (req, res, next) => {
  // En mode développement, autoriser l'accès sans authentification
  if (process.env.NODE_ENV === 'development') {
    console.log('[AUTH] Accès aux terminologies autorisé en mode développement');
    return next();
  }
  
  // Vérifier d'abord le token JWT dans l'en-tête Authorization
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      req.user = decoded;
      console.log(`[AUTH] Utilisateur authentifié par JWT: ${decoded.username}`);
      return next();
    } catch (err) {
      console.warn('[AUTH] JWT invalide:', err.message);
      // Continuer pour vérifier la clé API
    }
  }
  
  // Vérifier ensuite si une clé API est présente
  const apiKey = req.headers['x-api-key'];
  if (apiKey) {
    console.log(`[AUTH] Tentative d'authentification par clé API: ${apiKey.substring(0, 8)}...`);
    
    // Vérifier la clé API
    const db = req.app.locals.db;
    if (db) {
      try {
        const keyData = db.prepare(`
          SELECT ak.*, a.name as app_name
          FROM api_keys ak
          JOIN applications a ON ak.application_id = a.id
          WHERE ak.key = ? AND ak.is_active = 1
        `).get(apiKey);
        
        if (keyData) {
          console.log(`[AUTH] Authentification terminologie réussie via clé API: ${apiKey.substring(0, 8)}...`);
          req.apiKey = keyData;
          return next();
        }
      } catch (error) {
        console.error('[AUTH] Erreur lors de la vérification de la clé API pour les terminologies:', error);
      }
    }
  }
  
  // En production, renvoyer une erreur 401 si aucune authentification n'est valide
  if (process.env.NODE_ENV === 'production') {
    console.log('[AUTH] Authentification échouée pour les terminologies - Accès non autorisé');
    return res.status(401).json({
      success: false,
      error: 'Unauthorized',
      message: 'Authentification ou clé API valide requise'
    });
  } else {
    // En développement, autoriser l'accès même si l'authentification a échoué
    console.log('[AUTH] Accès aux terminologies autorisé sans authentification (mode développement)');
    return next();
  }
};

// Dossier contenant les fichiers de terminologie
const TERMINOLOGY_DIR = path.join(__dirname, '..', 'french_terminology');

// Route pour obtenir la liste des fichiers de terminologie
router.get('/files', terminologyAuth, (req, res) => {
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
            
            // Lire le contenu du fichier pour déterminer le type et le nombre d'éléments
            const content = fs.readFileSync(filePath, 'utf8');
            try {
              const jsonData = JSON.parse(content);
              let itemCount = 0;
              let fileType = 'unknown';
              
              // Déterminer le type et le nombre d'objets
              if (Array.isArray(jsonData)) {
                itemCount = jsonData.length;
                fileType = 'array';
                
                // Essayer de déterminer le type spécifique en fonction du nom ou du contenu
                if (file.includes('systems')) {
                  fileType = 'systems';
                } else if (file.includes('oids')) {
                  fileType = 'oids';
                } else if (file.includes('valuesets')) {
                  fileType = 'valuesets';
                } else if (file.includes('codesystems')) {
                  fileType = 'codesystems';
                } else if (jsonData.length > 0 && jsonData[0].system) {
                  fileType = 'terminology';
                }
              } else if (typeof jsonData === 'object') {
                // Pour les objets, compter les clés de premier niveau
                itemCount = Object.keys(jsonData).length;
                fileType = 'object';
                
                // Identifier le type de config
                if (file === 'config.json') {
                  fileType = 'config';
                } else if (jsonData.generated || jsonData.timestamp) {
                  fileType = 'report';
                }
              }
              
              // Déterminer si c'est un fichier obligatoire
              const isRequired = [
                'config.json', 
                'ans_terminology_systems.json', 
                'ans_oids.json',
                'fhir_valuesets.json',
                'fhir_codesystems.json'
              ].includes(file);
              
              return {
                name: file,
                size: stats.size,
                lastModified: stats.mtime,
                type: fileType,
                items: itemCount,
                required: isRequired
              };
            } catch (jsonError) {
              // Si le parsage JSON échoue, retourner les informations de base
              logger.warn(`[TERMINOLOGY] Erreur de parsage JSON du fichier ${file}: ${jsonError.message}`);
              return {
                name: file,
                size: stats.size,
                lastModified: stats.mtime,
                type: 'invalid',
                items: 0,
                required: false,
                error: 'Format JSON invalide'
              };
            }
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
router.get('/stats', terminologyAuth, (req, res) => {
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
        
        // Compter les systèmes, qu'ils soient dans un tableau ou un objet
        if (Array.isArray(parsedSystems)) {
          systemsCount = parsedSystems.length;
        } else if (typeof parsedSystems === 'object') {
          // Si c'est un objet, compter les clés ou essayer d'extraire les systèmes
          if (parsedSystems.systems && Array.isArray(parsedSystems.systems)) {
            systemsCount = parsedSystems.systems.length;
          } else {
            systemsCount = Object.keys(parsedSystems).length;
          }
        }
        
        console.log(`[TERMINOLOGY] ${systemsCount} systèmes de terminologie trouvés`);
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
        
        // Compter les OIDs, qu'ils soient dans un tableau ou un objet
        if (Array.isArray(parsedOids)) {
          oidsCount = parsedOids.length;
        } else if (typeof parsedOids === 'object') {
          // Si c'est un objet, compter les clés ou essayer d'extraire les OIDs
          if (parsedOids.oids && Array.isArray(parsedOids.oids)) {
            oidsCount = parsedOids.oids.length;
          } else {
            oidsCount = Object.keys(parsedOids).length;
          }
        }
        
        console.log(`[TERMINOLOGY] ${oidsCount} OIDs trouvés`);
      } catch (error) {
        logger.error(`[TERMINOLOGY] Erreur lors de la lecture des OIDs: ${error.message}`);
      }
    } else {
      console.log('[TERMINOLOGY] Fichier des OIDs non trouvé');
    }

    // Compter les éléments par type
    let totalItemCount = 0;
    let typeBreakdown = {
      systems: 0,
      oids: 0,
      valuesets: 0,
      codesystems: 0,
      terminology: 0,
      config: 0,
      report: 0,
      other: 0
    };
    
    // Parcourir tous les fichiers pour compter les éléments
    files.forEach(fileName => {
      if (!fileName.endsWith('.json') || fileName.startsWith('.')) return;
      
      try {
        const filePath = path.join(TERMINOLOGY_DIR, fileName);
        const content = fs.readFileSync(filePath, 'utf8');
        const jsonData = JSON.parse(content);
        
        let itemCount = 0;
        let fileType = 'other';
        
        // Déterminer le type et compter les éléments
        if (Array.isArray(jsonData)) {
          itemCount = jsonData.length;
          
          if (fileName.includes('systems')) {
            fileType = 'systems';
          } else if (fileName.includes('oids')) {
            fileType = 'oids';
          } else if (fileName.includes('valuesets')) {
            fileType = 'valuesets';
          } else if (fileName.includes('codesystems')) {
            fileType = 'codesystems';
          } else if (jsonData.length > 0 && jsonData[0].system) {
            fileType = 'terminology';
          }
        } else if (typeof jsonData === 'object') {
          // Pour les objets, compter les clés de premier niveau
          itemCount = Object.keys(jsonData).length;
          
          if (fileName === 'config.json') {
            fileType = 'config';
          } else if (jsonData.generated || jsonData.timestamp) {
            fileType = 'report';
          }
        }
        
        // Ajouter au total et au compteur par type
        totalItemCount += itemCount;
        if (typeBreakdown[fileType] !== undefined) {
          typeBreakdown[fileType] += itemCount;
        } else {
          typeBreakdown.other += itemCount;
        }
        
      } catch (error) {
        logger.warn(`[TERMINOLOGY] Erreur lors du comptage des éléments dans ${fileName}: ${error.message}`);
      }
    });
    
    // Renvoyer les statistiques
    console.log('[TERMINOLOGY] Statistiques récupérées avec succès');
    return res.status(200).json({
      success: true,
      data: {
        version: config.version,
        last_updated: config.last_updated,
        files_count: files.length,
        systems_count: systemsCount,
        oids_count: oidsCount,
        total_items: totalItemCount,
        types: typeBreakdown
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

// Liste des fichiers obligatoires qui ne peuvent pas être supprimés
const REQUIRED_FILES = [
  'config.json', 
  'ans_terminology_systems.json', 
  'ans_oids.json',
  'fhir_valuesets.json',
  'fhir_codesystems.json'
];

// Route pour supprimer un fichier de terminologie
router.delete('/files/:filename', terminologyAuth, (req, res) => {
  try {
    const filename = req.params.filename;
    console.log(`[TERMINOLOGY] Tentative de suppression du fichier: ${filename}`);
    
    // Vérifier si l'utilisateur est authentifié ou si une clé API est utilisée
    const userInfo = req.user 
      ? `utilisateur ${req.user.username}` 
      : (req.apiKey ? `clé API ${req.apiKey.id}` : 'non authentifié');
    console.log(`[TERMINOLOGY] Demande de suppression par: ${userInfo}`);
    
    // Vérifier que l'utilisateur est administrateur (sauf en dev)
    if (process.env.NODE_ENV !== 'development' && (!req.user || req.user.role !== 'admin')) {
      logger.warn(`[TERMINOLOGY] Tentative de suppression non autorisée par ${userInfo}`);
      return res.status(403).json({
        success: false,
        message: 'Seuls les administrateurs peuvent supprimer des fichiers de terminologie',
      });
    }
    
    // Empêcher la suppression des fichiers obligatoires
    if (REQUIRED_FILES.includes(filename)) {
      logger.warn(`[TERMINOLOGY] Tentative de suppression d'un fichier obligatoire: ${filename}`);
      return res.status(403).json({
        success: false,
        message: 'Ce fichier est obligatoire et ne peut pas être supprimé',
        required: true
      });
    }
    
    const filePath = path.join(TERMINOLOGY_DIR, filename);
    
    // Vérifier si le fichier existe
    if (!fs.existsSync(filePath)) {
      logger.warn(`[TERMINOLOGY] Fichier à supprimer non trouvé: ${filename}`);
      return res.status(404).json({
        success: false,
        message: 'Fichier non trouvé'
      });
    }
    
    // Vérifier que c'est bien un fichier JSON
    if (!filename.endsWith('.json')) {
      logger.warn(`[TERMINOLOGY] Tentative de suppression d'un fichier non JSON: ${filename}`);
      return res.status(400).json({
        success: false,
        message: 'Seuls les fichiers JSON peuvent être supprimés'
      });
    }
    
    // Supprimer le fichier
    fs.unlinkSync(filePath);
    logger.info(`[TERMINOLOGY] Fichier supprimé avec succès: ${filename}`);
    
    // Journaliser l'action
    const logData = {
      filename,
      timestamp: new Date().toISOString(),
      user: req.user ? req.user.username : 'système',
      action: 'delete_terminology_file'
    };
    
    console.log(`[TERMINOLOGY] Fichier ${filename} supprimé par ${userInfo}`);
    
    // Retourner une réponse de succès
    return res.status(200).json({
      success: true,
      message: `Le fichier ${filename} a été supprimé avec succès`
    });
  } catch (error) {
    logger.error(`[TERMINOLOGY] Erreur lors de la suppression du fichier: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: 'Erreur lors de la suppression du fichier',
      error: error.message
    });
  }
});

// Route pour télécharger un fichier de terminologie
router.get('/download/:filename', terminologyAuth, (req, res) => {
  try {
    const filename = req.params.filename;
    console.log(`[TERMINOLOGY] Demande de téléchargement du fichier: ${filename}`);
    
    const filePath = path.join(TERMINOLOGY_DIR, filename);
    
    // Vérifier si le fichier existe
    if (!fs.existsSync(filePath)) {
      logger.warn(`[TERMINOLOGY] Fichier à télécharger non trouvé: ${filename}`);
      return res.status(404).json({
        success: false,
        message: 'Fichier non trouvé'
      });
    }
    
    // Envoyer le fichier
    res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
    res.setHeader('Content-Type', 'application/json');
    
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
    
    logger.info(`[TERMINOLOGY] Fichier téléchargé: ${filename}`);
  } catch (error) {
    logger.error(`[TERMINOLOGY] Erreur lors du téléchargement du fichier: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: 'Erreur lors du téléchargement du fichier',
      error: error.message
    });
  }
});

// Route pour télécharger tous les fichiers de terminologie au format ZIP
router.get('/download-all', terminologyAuth, (req, res) => {
  try {
    console.log('[TERMINOLOGY] Demande de téléchargement de tous les fichiers de terminologie');
    
    // Vérifier si l'utilisateur est authentifié ou si une clé API est utilisée
    const userInfo = req.user 
      ? `utilisateur ${req.user.username}` 
      : (req.apiKey ? `clé API ${req.apiKey.id}` : 'non authentifié');
    console.log(`[TERMINOLOGY] Requête de téléchargement zip par: ${userInfo}`);
    
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
    
    // Lire les fichiers dans le dossier
    let files;
    try {
      files = fs.readdirSync(TERMINOLOGY_DIR)
        .filter(file => file.endsWith('.json') && !file.startsWith('.'));
      console.log(`[TERMINOLOGY] ${files.length} fichiers de terminologie trouvés pour l'archive`);
      
      if (files.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Aucun fichier de terminologie trouvé'
        });
      }
    } catch (readError) {
      logger.error(`[TERMINOLOGY] Erreur lors de la lecture du dossier: ${readError.message}`);
      return res.status(500).json({
        success: false,
        message: 'Erreur lors de la lecture du dossier de terminologie',
        error: readError.message
      });
    }
    
    // Configuration de la réponse
    res.attachment('fhirhub-terminologies.zip');
    res.setHeader('Content-Type', 'application/zip');
    
    // Créer un archive zip
    const archive = archiver('zip', {
      zlib: { level: 9 } // Niveau de compression maximal
    });
    
    // En cas d'erreur d'archivage
    archive.on('error', (err) => {
      logger.error(`[TERMINOLOGY] Erreur lors de la création de l'archive: ${err.message}`);
      return res.status(500).json({
        success: false,
        message: 'Erreur lors de la création de l\'archive',
        error: err.message
      });
    });
    
    // Pipe l'archive vers la réponse
    archive.pipe(res);
    
    // Ajouter tous les fichiers à l'archive
    files.forEach(file => {
      const filePath = path.join(TERMINOLOGY_DIR, file);
      archive.file(filePath, { name: file });
    });
    
    // Finaliser l'archive
    archive.finalize();
    
    logger.info(`[TERMINOLOGY] Archive de tous les fichiers créée avec succès`);
  } catch (error) {
    logger.error(`[TERMINOLOGY] Erreur lors de la création de l'archive: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: 'Erreur lors de la création de l\'archive',
      error: error.message
    });
  }
});

module.exports = router;