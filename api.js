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
// Utiliser le proxy pour contourner les problèmes de syntaxe dans le convertisseur original
const converter = require('./hl7ToFhirConverter.proxy');
const frenchTerminologyService = require('./french_terminology_service');
const terminologyValidationRouter = require('./api/terminology_validation');
const apiKeyService = require('./src/services/apiKeyService');
const conversionLogService = require('./src/services/conversionLogService');
// Module de traitement des noms FHIR français bien structuré
const { processFhirNames } = require('./src/services/fhirNameProcessor');

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
    let stats;
    
    // Utiliser le service de logs de conversion pour obtenir les statistiques
    if (req.apiKeyInfo?.appId) {
      // Si une API key est fournie, récupérer les stats de l'application
      stats = conversionLogService.getAppStats(req.apiKeyInfo.appId);
    } else {
      // Sinon, récupérer les stats globales
      stats = conversionLogService.getGlobalStats();
    }
    
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
  const outputDir = path.join(__dirname, 'data/conversions');
  const filePath = path.join(outputDir, req.params.filename);
  
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
 * Accepte soit du texte brut HL7 soit un objet JSON {content: "texte HL7", options: {...}}
 */
router.post('/convert', express.json({ limit: '10mb' }), async (req, res) => {
  let hl7Content = '';
  let options = {};
  
  // Détecter le format de la requête (JSON ou texte brut)
  if (req.body && typeof req.body === 'object' && req.body.content) {
    // Format JSON: {content: "MSH|...", options: {...}}
    hl7Content = req.body.content;
    options = req.body.options || {};
  } else if (req.body && typeof req.body === 'string') {
    // Texte brut
    hl7Content = req.body;
  } else {
    return res.status(400).json({
      status: 'error',
      message: 'Contenu HL7 manquant ou format non reconnu'
    });
  }
  
  // Vérifier que le contenu n'est pas vide
  if (!hl7Content || hl7Content.trim() === '') {
    return res.status(400).json({
      status: 'error',
      message: 'Contenu HL7 manquant'
    });
  }
  
  try {
    const filename = req.query.filename || 'saisie_directe.hl7';
    let result = converter.convertHl7Content(hl7Content, filename, options);
    
    // Traiter les noms français composés avec notre service structuré
    result = processFhirNames(result, hl7Content);
    
    // Enrichir le résultat pour l'affichage complet dans l'interface
    if (result.success && result.fhirData) {
      // Importer le module d'enrichissement
      const { enrichApiResult } = require('./src/utils/apiResultEnricher');
      result = enrichApiResult(result);
    }
    
    // Enregistrer la conversion dans la base de données
    if (req.apiKeyInfo) {
      try {
        await conversionLogService.logConversion({
          conversionId: result.conversionId,
          appId: req.apiKeyInfo.appId,
          apiKeyId: req.apiKeyInfo.id,
          sourceType: 'API',
          sourceName: filename,
          sourceSize: typeof hl7Content === 'string' ? hl7Content.length : JSON.stringify(req.body).length,
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
      bundleInfo: result.bundleInfo || null,
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
    let result = converter.convertHl7Content(hl7Content, req.file.originalname);
    
    // Traiter les noms français composés avec notre service structuré
    result = processFhirNames(result, hl7Content);
    
    // Enrichir le résultat pour l'affichage complet dans l'interface
    if (result.success && result.fhirData) {
      // Importer le module d'enrichissement
      const { enrichApiResult } = require('./src/utils/apiResultEnricher');
      result = enrichApiResult(result);
    }
    
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
      bundleInfo: result.bundleInfo || null,
      outputPath: result.success ? path.basename(result.outputPath) : null
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: `Erreur inattendue: ${error.message}`
    });
  }
});

// Les endpoints de surveillance de répertoires ont été entièrement supprimés

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
 * GET /api/terminology/systems
 * Récupérer tous les systèmes de terminologie disponibles
 */
router.get('/terminology/systems', (req, res) => {
  try {
    const frenchTerminologyAdapter = require('./french_terminology_adapter');
    const systems = frenchTerminologyAdapter.getAllTerminologySystems();
    
    res.json({
      status: 'ok',
      data: systems
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: `Erreur lors de la récupération des systèmes de terminologie: ${error.message}`
    });
  }
});

/**
 * GET /api/terminology/oid/:oid
 * Récupérer un système de terminologie par son OID
 */
router.get('/terminology/oid/:oid', (req, res) => {
  try {
    const frenchTerminologyAdapter = require('./french_terminology_adapter');
    const system = frenchTerminologyAdapter.getCodeSystemByOid(req.params.oid);
    
    if (!system) {
      return res.status(404).json({
        status: 'error',
        message: 'Système de terminologie non trouvé pour cet OID'
      });
    }
    
    res.json({
      status: 'ok',
      data: system
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: `Erreur lors de la récupération du système de terminologie: ${error.message}`
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