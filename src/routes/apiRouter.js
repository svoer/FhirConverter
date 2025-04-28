/**
 * Routeur API pour FHIRHub
 * Fournit les routes pour l'API REST
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

// Services
const terminologyService = require('../services/terminologyService');
const conversionService = require('../services/conversionService');
const conversionLogService = require('../services/conversionLogService');

// Middleware
const apiKeyAuth = require('../middleware/apiKeyAuth');
const { apiResultEnricherMiddleware } = require('../utils/apiResultEnricher');

// Configuration pour le téléchargement de fichiers
const upload = multer({
  storage: multer.diskStorage({
    destination: function (req, file, cb) {
      const uploadDir = path.join(__dirname, '../../data/uploads');
      
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      
      cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
      const uniqueFilename = `${Date.now()}_${uuidv4()}_${file.originalname}`;
      cb(null, uniqueFilename);
    }
  }),
  limits: {
    fileSize: 1024 * 1024 * 10 // 10MB limite
  }
});

// Middleware
router.use(apiKeyAuth);
router.use(apiResultEnricherMiddleware);

/**
 * GET /health
 * Point d'entrée pour vérifier la santé du serveur
 */
router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'FHIRHub API',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

/**
 * GET /info
 * Informations sur le serveur
 */
router.get('/info', (req, res) => {
  res.json({
    name: 'FHIRHub API',
    description: 'Convertisseur HL7 v2.5 vers FHIR R4',
    version: '1.0.0',
    fhirVersion: '4.0.1',
    hl7Version: '2.5',
    terminologyService: terminologyService.getServiceInfo(),
    apiKey: req.apiKey ? { 
      description: req.apiKey.description,
      application: req.application.name
    } : null
  });
});

/**
 * GET /stats
 * Retourne des statistiques simples pour le dashboard
 */
router.get('/stats', async (req, res) => {
  try {
    const stats = await conversionLogService.getAppStats(req.application.id);
    res.json({
      success: true,
      stats
    });
  } catch (error) {
    console.error('Erreur lors de la récupération des statistiques:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur serveur',
      message: 'Impossible de récupérer les statistiques'
    });
  }
});

/**
 * GET /conversions
 * Retourne l'historique des conversions
 */
router.get('/conversions', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const page = parseInt(req.query.page) || 1;
    
    const conversions = await conversionLogService.getConversions(
      req.application.id,
      limit,
      page
    );
    
    res.json({
      success: true,
      data: conversions
    });
  } catch (error) {
    console.error('Erreur lors de la récupération des conversions:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur serveur',
      message: 'Impossible de récupérer l\'historique des conversions'
    });
  }
});

/**
 * GET /conversions/:id
 * Obtenir une conversion spécifique par ID
 */
router.get('/conversions/:id', async (req, res) => {
  try {
    const conversion = await conversionLogService.getConversion(
      req.params.id,
      req.application.id
    );
    
    if (!conversion) {
      return res.status(404).json({
        success: false,
        error: 'Non trouvé',
        message: 'Conversion non trouvée'
      });
    }
    
    res.json({
      success: true,
      data: conversion
    });
  } catch (error) {
    console.error('Erreur lors de la récupération de la conversion:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur serveur',
      message: 'Impossible de récupérer la conversion'
    });
  }
});

/**
 * POST /convert
 * Convertir du contenu HL7 en FHIR
 */
router.post('/convert', async (req, res) => {
  try {
    const startTime = Date.now();
    let hl7Content = '';
    let options = {};
    
    // Déterminer le format d'entrée (texte brut ou JSON avec options)
    if (typeof req.body === 'string') {
      hl7Content = req.body;
    } else if (req.body && req.body.content) {
      hl7Content = req.body.content;
      options = req.body.options || {};
    } else {
      return res.status(400).json({
        success: false,
        error: 'Format invalide',
        message: 'Le corps de la requête doit être du texte HL7 brut ou un objet JSON avec une propriété "content"'
      });
    }
    
    // Appliquer la validation selon les options/paramètres
    options.validate = options.validate || req.query.validate === 'true';
    
    // Convertir le contenu HL7 en FHIR
    const result = await conversionService.convertHL7ToFHIR(hl7Content, options);
    
    // Calculer le temps de traitement
    const processingTime = Date.now() - startTime;
    req.processingTime = processingTime;
    
    // Journaliser la conversion
    await conversionLogService.logConversion({
      apiKeyId: req.apiKey.id,
      applicationId: req.application.id,
      sourceType: 'direct',
      hl7Content,
      fhirContent: JSON.stringify(result),
      status: 'success',
      processingTime
    });
    
    res.json({
      success: true,
      data: result,
      processingTime
    });
  } catch (error) {
    console.error('Erreur lors de la conversion:', error);
    
    // Journaliser l'erreur
    if (req.body && (typeof req.body === 'string' || req.body.content)) {
      const hl7Content = typeof req.body === 'string' ? req.body : req.body.content;
      
      await conversionLogService.logConversion({
        apiKeyId: req.apiKey.id,
        applicationId: req.application.id,
        sourceType: 'direct',
        hl7Content,
        status: 'error',
        errorMessage: error.message
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Erreur de conversion',
      message: error.message,
      details: error.details || null
    });
  }
});

/**
 * POST /upload
 * Télécharger et convertir un fichier HL7
 */
router.post('/upload', upload.single('file'), async (req, res) => {
  try {
    const startTime = Date.now();
    
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'Fichier manquant',
        message: 'Aucun fichier n\'a été téléchargé'
      });
    }
    
    // Lire le contenu du fichier
    const hl7Content = fs.readFileSync(req.file.path, 'utf8');
    
    // Options de conversion
    const options = {
      validate: req.query.validate === 'true',
      fileInfo: {
        originalName: req.file.originalname,
        size: req.file.size,
        mimetype: req.file.mimetype
      }
    };
    
    // Convertir le contenu HL7 en FHIR
    const result = await conversionService.convertHL7ToFHIR(hl7Content, options);
    
    // Calculer le temps de traitement
    const processingTime = Date.now() - startTime;
    
    // Générer un fichier de sortie FHIR
    const fhirContent = JSON.stringify(result, null, 2);
    const fhirFileName = path.basename(req.file.originalname, path.extname(req.file.originalname)) + '.fhir.json';
    const fhirFilePath = path.join(__dirname, '../../data/outputs', fhirFileName);
    
    // Créer le répertoire de sortie s'il n'existe pas
    const outputDir = path.dirname(fhirFilePath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    // Écrire le fichier de sortie
    fs.writeFileSync(fhirFilePath, fhirContent);
    
    // Journaliser la conversion
    await conversionLogService.logConversion({
      apiKeyId: req.apiKey.id,
      applicationId: req.application.id,
      sourceType: 'file',
      hl7Content,
      fhirContent,
      status: 'success',
      processingTime
    });
    
    res.json({
      success: true,
      data: result,
      file: {
        original: req.file.originalname,
        output: fhirFileName,
        outputPath: `/api/files/fhir/${fhirFileName}`
      },
      processingTime
    });
  } catch (error) {
    console.error('Erreur lors de la conversion du fichier:', error);
    
    // Journaliser l'erreur
    if (req.file) {
      try {
        const hl7Content = fs.readFileSync(req.file.path, 'utf8');
        
        await conversionLogService.logConversion({
          apiKeyId: req.apiKey.id,
          applicationId: req.application.id,
          sourceType: 'file',
          hl7Content,
          status: 'error',
          errorMessage: error.message
        });
      } catch (logError) {
        console.error('Erreur lors de la journalisation:', logError);
      }
    }
    
    res.status(500).json({
      success: false,
      error: 'Erreur de conversion',
      message: error.message,
      details: error.details || null
    });
  } finally {
    // Nettoyer le fichier téléchargé
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
  }
});

/**
 * GET /files/fhir/:filename
 * Récupérer un fichier FHIR
 */
router.get('/files/fhir/:filename', (req, res) => {
  const filename = req.params.filename;
  const filePath = path.join(__dirname, '../../data/outputs', filename);
  
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({
      success: false,
      error: 'Fichier non trouvé',
      message: `Le fichier ${filename} n'existe pas`
    });
  }
  
  res.download(filePath, filename);
});

/**
 * GET /terminology/systems
 * Récupérer tous les systèmes de terminologie disponibles
 */
router.get('/terminology/systems', (req, res) => {
  try {
    const systems = terminologyService.getAllTerminologySystems();
    res.json({
      success: true,
      data: systems
    });
  } catch (error) {
    console.error('Erreur lors de la récupération des systèmes de terminologie:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur serveur',
      message: 'Impossible de récupérer les systèmes de terminologie'
    });
  }
});

/**
 * GET /terminology/oid/:oid
 * Récupérer un système de terminologie par son OID
 */
router.get('/terminology/oid/:oid', (req, res) => {
  try {
    const system = terminologyService.getCodeSystemByOid(req.params.oid);
    
    if (!system) {
      return res.status(404).json({
        success: false,
        error: 'Non trouvé',
        message: `Système de terminologie avec OID ${req.params.oid} non trouvé`
      });
    }
    
    res.json({
      success: true,
      data: system
    });
  } catch (error) {
    console.error('Erreur lors de la récupération du système de terminologie:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur serveur',
      message: 'Impossible de récupérer le système de terminologie'
    });
  }
});

/**
 * GET /terminology/search
 * Rechercher dans les systèmes de terminologie
 */
router.get('/terminology/search', (req, res) => {
  try {
    const query = req.query.q;
    
    if (!query) {
      return res.status(400).json({
        success: false,
        error: 'Requête invalide',
        message: 'Paramètre de recherche "q" manquant'
      });
    }
    
    const results = terminologyService.searchTerminology(query);
    
    res.json({
      success: true,
      data: results
    });
  } catch (error) {
    console.error('Erreur lors de la recherche dans les terminologies:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur serveur',
      message: 'Impossible d\'effectuer la recherche dans les terminologies'
    });
  }
});

module.exports = router;