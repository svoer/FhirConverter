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

// Configuration pour l'upload de fichiers
const upload = multer({
  dest: 'data/uploads/',
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB max
  }
});

// Middleware d'authentification par clé API
const API_KEYS = ['dev-key', 'test-key']; // Clés d'API par défaut

function apiKeyAuth(req, res, next) {
  const apiKey = req.headers['x-api-key'];
  
  if (!apiKey || !API_KEYS.includes(apiKey)) {
    return res.status(401).json({
      status: 'error',
      message: 'Clé API invalide ou manquante'
    });
  }
  
  next();
}

// Appliquer l'authentification à toutes les routes
router.use(apiKeyAuth);

/**
 * GET /api/status
 * Vérifier l'état du serveur
 */
router.get('/status', (req, res) => {
  res.json({
    status: 'ok',
    message: 'FHIRHub API est opérationnelle',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

/**
 * GET /api/conversions
 * Obtenir l'historique des conversions
 */
router.get('/conversions', (req, res) => {
  const limit = parseInt(req.query.limit) || 100;
  const offset = parseInt(req.query.offset) || 0;
  
  res.json({
    status: 'ok',
    data: converter.getConversionLogs(limit, offset)
  });
});

/**
 * GET /api/conversions/:id
 * Obtenir une conversion spécifique par ID
 */
router.get('/conversions/:id', (req, res) => {
  const conversion = converter.getConversionLogById(req.params.id);
  
  if (!conversion) {
    return res.status(404).json({
      status: 'error',
      message: 'Conversion non trouvée'
    });
  }
  
  res.json({
    status: 'ok',
    data: conversion
  });
});

/**
 * GET /api/stats
 * Obtenir les statistiques de conversion
 */
router.get('/stats', (req, res) => {
  res.json({
    status: 'ok',
    data: converter.getConversionStats()
  });
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
router.post('/convert', express.text({ type: '*/*', limit: '5mb' }), (req, res) => {
  if (!req.body || req.body.trim() === '') {
    return res.status(400).json({
      status: 'error',
      message: 'Contenu HL7 manquant'
    });
  }
  
  try {
    const filename = req.query.filename || null;
    const result = converter.convertHl7Content(req.body, filename);
    
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
router.post('/upload', upload.single('file'), (req, res) => {
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