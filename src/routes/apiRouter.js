/**
 * Routeur API pour FHIRHub
 * Gère toutes les routes API de l'application
 */

const express = require('express');
const router = express.Router();
const { apiKeyAuth } = require('../middleware/apiKeyAuth');
const conversionLogService = require('../services/conversionLogService');
const nameExtractor = require('../utils/nameExtractor');
const { v4: uuidv4 } = require('uuid');

// Simple-HL7 pour la conversion HL7
const hl7 = require('simple-hl7');
// Segments processors
const segmentProcessors = require('../services/segmentProcessors');

// Middleware d'authentification par clé API
router.use(apiKeyAuth);

/**
 * Route de vérification de l'état du serveur
 * GET /api/health
 */
router.get('/health', (req, res) => {
  res.json({
    success: true,
    status: 'healthy',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

/**
 * Route de conversion HL7 vers FHIR
 * POST /api/convert
 */
router.post('/convert', async (req, res) => {
  const startTime = Date.now();
  
  try {
    // Vérifier si le contenu HL7 est présent
    if (!req.body.content) {
      return res.status(400).json({
        success: false,
        error: 'Contenu HL7 manquant',
        message: 'Le contenu HL7 à convertir est requis'
      });
    }
    
    const hl7Content = req.body.content;
    const options = req.body.options || {};
    
    console.log(`[CONVERT] Début de conversion HL7 vers FHIR. Taille: ${hl7Content.length} caractères`);
    
    // Parser le message HL7
    const parser = new hl7.Parser();
    let parsedMessage;
    
    try {
      parsedMessage = parser.parse(hl7Content);
    } catch (parseError) {
      console.error('[CONVERT] Erreur lors du parsing HL7:', parseError);
      
      await conversionLogService.logConversion({
        apiKeyId: req.apiKey.id,
        applicationId: req.apiKey.application_id,
        sourceType: 'direct',
        hl7Content: hl7Content,
        status: 'error',
        errorMessage: `Erreur de parsing HL7: ${parseError.message}`,
        processingTime: Date.now() - startTime
      });
      
      return res.status(400).json({
        success: false,
        error: 'Erreur de parsing HL7',
        message: parseError.message
      });
    }
    
    // Convertir le message HL7 en FHIR
    let fhirResources = [];
    let fhirBundle = null;
    
    try {
      // Extraire les noms français du message HL7
      const frenchNames = nameExtractor.extractFrenchNames(hl7Content);
      
      // Traiter chaque segment pour créer des ressources FHIR
      const segments = parsedMessage.segments;
      
      // Traitement des segments MSH (Message Header)
      const mshSegments = segments.filter(s => s.name === 'MSH');
      if (mshSegments.length > 0) {
        const messageHeader = segmentProcessors.processMSH(mshSegments[0].fields);
        fhirResources.push(messageHeader);
      }
      
      // Traitement des segments PID (Patient Identification)
      const pidSegments = segments.filter(s => s.name === 'PID');
      if (pidSegments.length > 0) {
        const patient = segmentProcessors.processPID(pidSegments[0].fields, { names: frenchNames });
        fhirResources.push(patient);
      }
      
      // Traitement des segments PV1 (Patient Visit)
      const pv1Segments = segments.filter(s => s.name === 'PV1');
      if (pv1Segments.length > 0) {
        const encounter = segmentProcessors.processPV1(pv1Segments[0].fields, { resources: fhirResources });
        fhirResources.push(encounter);
      }
      
      // Traitement des segments NK1 (Next of Kin)
      const nk1Segments = segments.filter(s => s.name === 'NK1');
      for (const nk1Segment of nk1Segments) {
        const relatedPerson = segmentProcessors.processNK1(nk1Segment.fields, { resources: fhirResources });
        fhirResources.push(relatedPerson);
      }
      
      // Traitement des segments OBR (Observation Request)
      const obrSegments = segments.filter(s => s.name === 'OBR');
      for (const obrSegment of obrSegments) {
        const serviceRequest = segmentProcessors.processOBR(obrSegment.fields, { resources: fhirResources, segments });
        fhirResources.push(serviceRequest);
      }
      
      // Traitement des segments OBX (Observation)
      const obxSegments = segments.filter(s => s.name === 'OBX');
      for (const obxSegment of obxSegments) {
        const observation = segmentProcessors.processOBX(obxSegment.fields, { resources: fhirResources, segments });
        fhirResources.push(observation);
      }
      
      // Traitement des segments SPM (Specimen)
      const spmSegments = segments.filter(s => s.name === 'SPM');
      for (const spmSegment of spmSegments) {
        const specimen = segmentProcessors.processSPM(spmSegment.fields, { resources: fhirResources });
        fhirResources.push(specimen);
      }
      
      // Créer un Bundle FHIR avec toutes les ressources
      fhirBundle = {
        resourceType: 'Bundle',
        id: `bundle-${uuidv4()}`,
        type: 'transaction',
        entry: fhirResources.map(resource => ({
          fullUrl: `urn:uuid:${resource.id}`,
          resource: resource,
          request: {
            method: 'POST',
            url: resource.resourceType
          }
        }))
      };
      
      // Ajouter des méta-informations au Bundle
      fhirBundle.meta = {
        lastUpdated: new Date().toISOString(),
        source: 'FHIRHub Converter'
      };
      
      // Si l'option de validation est activée
      if (options.validate) {
        // TODO: Implémenter la validation FHIR
        console.log('[CONVERT] Validation FHIR non implémentée');
      }
      
      const processingTime = Date.now() - startTime;
      
      // Journaliser la conversion réussie
      await conversionLogService.logConversion({
        apiKeyId: req.apiKey.id,
        applicationId: req.apiKey.application_id,
        sourceType: 'direct',
        hl7Content: hl7Content,
        fhirContent: JSON.stringify(fhirBundle),
        status: 'success',
        processingTime: processingTime
      });
      
      // Renvoyer le résultat
      res.json({
        success: true,
        message: 'Conversion réussie',
        processingTime: processingTime,
        data: fhirBundle,
        resourceCount: fhirResources.length
      });
    } catch (conversionError) {
      console.error('[CONVERT] Erreur lors de la conversion:', conversionError);
      
      await conversionLogService.logConversion({
        apiKeyId: req.apiKey.id,
        applicationId: req.apiKey.application_id,
        sourceType: 'direct',
        hl7Content: hl7Content,
        status: 'error',
        errorMessage: `Erreur de conversion: ${conversionError.message}`,
        processingTime: Date.now() - startTime
      });
      
      res.status(500).json({
        success: false,
        error: 'Erreur de conversion',
        message: conversionError.message
      });
    }
  } catch (error) {
    console.error('[CONVERT] Erreur interne du serveur:', error);
    
    res.status(500).json({
      success: false,
      error: 'Erreur interne du serveur',
      message: error.message
    });
  }
});

/**
 * Route pour obtenir les statistiques de conversion
 * GET /api/stats
 */
router.get('/stats', async (req, res) => {
  try {
    const applicationId = req.apiKey.application_id;
    const stats = await conversionLogService.getAppStats(applicationId);
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('[API] Erreur lors de la récupération des statistiques:', error);
    
    res.status(500).json({
      success: false,
      error: 'Erreur interne du serveur',
      message: error.message
    });
  }
});

/**
 * Route pour obtenir l'historique des conversions
 * GET /api/conversions
 */
router.get('/conversions', async (req, res) => {
  try {
    const applicationId = req.apiKey.application_id;
    const limit = parseInt(req.query.limit) || 10;
    const page = parseInt(req.query.page) || 1;
    
    const conversions = await conversionLogService.getConversions(applicationId, limit, page);
    
    res.json({
      success: true,
      data: conversions,
      page: page,
      limit: limit
    });
  } catch (error) {
    console.error('[API] Erreur lors de la récupération de l\'historique des conversions:', error);
    
    res.status(500).json({
      success: false,
      error: 'Erreur interne du serveur',
      message: error.message
    });
  }
});

/**
 * Route pour obtenir les détails d'une conversion
 * GET /api/conversions/:id
 */
router.get('/conversions/:id', async (req, res) => {
  try {
    const applicationId = req.apiKey.application_id;
    const conversionId = parseInt(req.params.id);
    
    if (!conversionId) {
      return res.status(400).json({
        success: false,
        error: 'ID de conversion invalide',
        message: 'L\'ID de conversion doit être un nombre entier'
      });
    }
    
    const conversion = await conversionLogService.getConversion(conversionId, applicationId);
    
    if (!conversion) {
      return res.status(404).json({
        success: false,
        error: 'Conversion non trouvée',
        message: 'La conversion demandée n\'existe pas ou n\'appartient pas à votre application'
      });
    }
    
    res.json({
      success: true,
      data: conversion
    });
  } catch (error) {
    console.error('[API] Erreur lors de la récupération des détails de la conversion:', error);
    
    res.status(500).json({
      success: false,
      error: 'Erreur interne du serveur',
      message: error.message
    });
  }
});

module.exports = router;