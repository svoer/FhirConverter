/**
 * API REST pour FHIRHub
 * Fournit des endpoints pour la conversion HL7 vers FHIR R4
 * et l'accès aux terminologies françaises de santé
 */

const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const router = express.Router();
const converter = require('./hl7ToFhirConverter');
const fileMonitor = require('./fileMonitor');
const frenchTerminologyService = require('./french_terminology_service');
const terminologyValidationRouter = require('./api/terminology_validation');
const apiKeyService = require('./src/services/apiKeyService');
const conversionLogService = require('./src/services/conversionLogService');

// Configuration pour l'upload de fichiers
const upload = multer({
  dest: 'data/uploads/',
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB max
  }
});

// Middleware d'authentification par clé API
async function apiKeyAuth(req, res, next) {
  const apiKey = req.headers['x-api-key'];
  
  if (!apiKey) {
    return res.status(401).json({
      status: 'error',
      message: 'Clé API manquante'
    });
  }
  
  try {
    // Vérifier la validité de la clé API avec le service
    const keyInfo = await apiKeyService.validateApiKey(apiKey);
    
    if (!keyInfo) {
      return res.status(401).json({
        status: 'error',
        message: 'Clé API invalide'
      });
    }
    
    // Stocker les informations de la clé API dans la requête pour un usage ultérieur
    req.apiKeyInfo = keyInfo;
    next();
  } catch (error) {
    return res.status(500).json({
      status: 'error',
      message: `Erreur lors de la validation de la clé API: ${error.message}`
    });
  }
}

// Routes qui n'ont pas besoin d'authentification
router.get('/status', (req, res) => {
  res.json({
    status: 'ok',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

// Appliquer l'authentification aux autres routes seulement
router.use([
  '/convert', 
  '/upload', 
  '/conversions',
  '/stats',
  '/monitor', 
  '/terminology',
  '/files'
], apiKeyAuth);

// La route /status est déjà définie plus haut

/**
 * GET /api/conversions
 * Obtenir l'historique des conversions
 */
router.get('/conversions', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const offset = parseInt(req.query.offset) || 0;
    
    // Utiliser le service de logs de conversion
    const conversions = await conversionLogService.getConversionLogs(
      req.apiKeyInfo?.appId, // Filtrer par application si API key fournie
      limit,
      offset
    );
    
    res.json({
      status: 'ok',
      data: conversions
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: `Erreur lors de la récupération des conversions: ${error.message}`
    });
  }
});

/**
 * GET /api/conversions/:id
 * Obtenir une conversion spécifique par ID
 */
router.get('/conversions/:id', async (req, res) => {
  try {
    const conversion = await conversionLogService.getConversionById(req.params.id);
    
    if (!conversion) {
      return res.status(404).json({
        status: 'error',
        message: 'Conversion non trouvée'
      });
    }
    
    // Vérifier que la conversion appartient à l'application associée à la clé API
    if (req.apiKeyInfo && conversion.appId !== req.apiKeyInfo.appId) {
      return res.status(403).json({
        status: 'error',
        message: 'Accès non autorisé à cette conversion'
      });
    }
    
    res.json({
      status: 'ok',
      data: conversion
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: `Erreur lors de la récupération de la conversion: ${error.message}`
    });
  }
});

/**
 * GET /api/stats
 * Obtenir les statistiques de conversion
 */
router.get('/stats', async (req, res) => {
  try {
    // Utiliser le service de logs de conversion pour obtenir les statistiques
    const stats = await conversionLogService.getConversionStats(
      req.apiKeyInfo?.appId // Filtrer par application si API key fournie
    );
    
    res.json({
      status: 'ok',
      data: stats
    });
  } catch (error) {
    res.status(500).json({
      status: 'error', 
      message: `Erreur lors de la récupération des statistiques: ${error.message}`
    });
  }
});

/**
 * GET /api/files/fhir/:filename
 * Récupérer un fichier FHIR
 */
router.get('/files/fhir/:filename', (req, res) => {
  const filePath = path.join(fileMonitor.outputDir, req.params.filename);
  
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({
      status: 'error',
      message: 'Fichier non trouvé'
    });
  }
  
  try {
    const fileContent = fs.readFileSync(filePath, 'utf8');
    res.json(JSON.parse(fileContent));
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: `Erreur lors de la lecture du fichier: ${error.message}`
    });
  }
});

/**
 * POST /api/convert
 * Convertir du contenu HL7 en FHIR
 */
router.post('/convert', express.text({ type: '*/*', limit: '10mb' }), async (req, res) => {
  if (!req.body || req.body.trim() === '') {
    return res.status(400).json({
      status: 'error',
      message: 'Contenu HL7 manquant'
    });
  }
  
  try {
    const filename = req.query.filename || 'saisie_directe.hl7';
    const result = converter.convertHl7Content(req.body, filename);
    
    // Enregistrer la conversion dans la base de données
    if (req.apiKeyInfo) {
      try {
        await conversionLogService.logConversion({
          conversionId: result.conversionId,
          appId: req.apiKeyInfo.appId,
          apiKeyId: req.apiKeyInfo.id,
          sourceType: 'API',
          sourceName: filename,
          sourceSize: req.body.length,
          resourceCount: result.fhirData?.entry?.length || 0,
          status: result.success ? 'success' : 'error',
          errorMessage: result.success ? null : result.message
        });
      } catch (logError) {
        console.error('Erreur lors de l\'enregistrement de la conversion:', logError);
        // On continue malgré l'erreur de log pour ne pas bloquer la conversion
      }
    }
    
    res.status(result.success ? 200 : 400).json({
      status: result.success ? 'ok' : 'error',
      message: result.message,
      conversionId: result.conversionId,
      fhirData: result.success ? result.fhirData : null,
      outputPath: result.success ? path.basename(result.outputPath) : null
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: `Erreur inattendue: ${error.message}`
    });
  }
});

/**
 * POST /api/upload
 * Télécharger et convertir un fichier HL7
 */
router.post('/upload', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({
      status: 'error',
      message: 'Aucun fichier téléchargé'
    });
  }
  
  try {
    // Lire le contenu du fichier temporaire
    const filePath = req.file.path;
    const hl7Content = fs.readFileSync(filePath, 'utf8');
    
    // Nettoyer le fichier temporaire
    fs.unlinkSync(filePath);
    
    // Convertir le contenu
    const result = converter.convertHl7Content(hl7Content, req.file.originalname);
    
    // Enregistrer la conversion dans la base de données
    if (req.apiKeyInfo) {
      try {
        await conversionLogService.logConversion({
          conversionId: result.conversionId,
          appId: req.apiKeyInfo.appId,
          apiKeyId: req.apiKeyInfo.id,
          sourceType: 'FICHIER',
          sourceName: req.file.originalname,
          sourceSize: req.file.size,
          resourceCount: result.fhirData?.entry?.length || 0,
          status: result.success ? 'success' : 'error',
          errorMessage: result.success ? null : result.message
        });
      } catch (logError) {
        console.error('Erreur lors de l\'enregistrement de la conversion:', logError);
        // On continue malgré l'erreur de log pour ne pas bloquer la conversion
      }
    }
    
    res.status(result.success ? 200 : 400).json({
      status: result.success ? 'ok' : 'error',
      message: result.message,
      conversionId: result.conversionId,
      fhirData: result.success ? result.fhirData : null,
      outputPath: result.success ? path.basename(result.outputPath) : null
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: `Erreur inattendue: ${error.message}`
    });
  }
});

/**
 * POST /api/monitor/start
 * [Obsolète] Endpoint maintenu pour rétrocompatibilité
 */
router.post('/monitor/start', (req, res) => {
  res.status(410).json({
    status: 'deprecated',
    message: 'La fonctionnalité de surveillance des répertoires a été désactivée. Utilisez l\'API pour convertir des fichiers.'
  });
});

/**
 * POST /api/monitor/stop
 * [Obsolète] Endpoint maintenu pour rétrocompatibilité
 */
router.post('/monitor/stop', (req, res) => {
  res.status(410).json({
    status: 'deprecated',
    message: 'La fonctionnalité de surveillance des répertoires a été désactivée.'
  });
});

/**
 * POST /api/monitor/scan
 * [Obsolète] Endpoint maintenu pour rétrocompatibilité
 */
router.post('/monitor/scan', (req, res) => {
  res.status(410).json({
    status: 'deprecated',
    message: 'La fonctionnalité de surveillance des répertoires a été désactivée. Utilisez l\'API pour convertir des fichiers.'
  });
});

/**
 * GET /api/terminology/codesystem/:id
 * Récupérer un système de code par son identifiant
 */
router.get('/terminology/codesystem/:id', async (req, res) => {
  try {
    const codeSystem = await frenchTerminologyService.getCodeSystem(req.params.id);
    
    if (!codeSystem) {
      return res.status(404).json({
        status: 'error',
        message: 'CodeSystem non trouvé'
      });
    }
    
    res.json({
      status: 'ok',
      data: codeSystem
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: `Erreur lors de la récupération du CodeSystem: ${error.message}`
    });
  }
});

/**
 * GET /api/terminology/search
 * Rechercher dans les systèmes de terminologie
 */
router.get('/terminology/search', async (req, res) => {
  try {
    const results = await frenchTerminologyService.searchCodeSystems(req.query);
    
    if (!results) {
      return res.status(404).json({
        status: 'error',
        message: 'Aucun résultat trouvé'
      });
    }
    
    res.json({
      status: 'ok',
      data: results
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: `Erreur lors de la recherche: ${error.message}`
    });
  }
});

// Utiliser le module de validation des terminologies
// Cela remplace les routes individuelles par un routeur complet
router.use('/terminology', terminologyValidationRouter);

module.exports = router;