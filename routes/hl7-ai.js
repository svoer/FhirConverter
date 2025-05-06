/**
 * Routes pour l'API d'IA spécialisée HL7-FHIR
 * Ces routes permettent d'accéder aux fonctionnalités avancées d'analyse
 * et d'aide à la conversion via l'IA
 */

const express = require('express');
const router = express.Router();
const authCombined = require('../middleware/authCombined');
const hl7AIService = require('../src/services/hl7AIService');
const { apiRequestCounter } = require('../src/metrics');

/**
 * @swagger
 * tags:
 *   name: HL7-FHIR AI
 *   description: API pour l'analyse intelligente des messages HL7 et ressources FHIR
 */

/**
 * @swagger
 * /api/hl7-ai/analyze-hl7:
 *   post:
 *     summary: Analyser un message HL7 v2.5 avec IA
 *     description: Fournit une analyse détaillée d'un message HL7 v2.5
 *     tags: [HL7-FHIR AI]
 *     security:
 *       - ApiKeyAuth: []
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - hl7Message
 *             properties:
 *               hl7Message:
 *                 type: string
 *                 description: Le message HL7 v2.5 à analyser
 *               provider:
 *                 type: string
 *                 description: Le fournisseur d'IA à utiliser (défaut mistral)
 *     responses:
 *       200:
 *         description: Analyse générée avec succès
 *       400:
 *         description: Paramètres invalides
 *       500:
 *         description: Erreur serveur
 */
router.post('/analyze-hl7', authCombined, apiRequestCounter, async (req, res) => {
  try {
    const { hl7Message, provider = 'mistral' } = req.body;

    if (!hl7Message) {
      return res.status(400).json({
        success: false,
        error: 'Message HL7 manquant',
        message: 'Vous devez fournir un message HL7 à analyser'
      });
    }

    const startTime = Date.now();
    const analysis = await hl7AIService.analyzeHL7Message(hl7Message, provider);
    const processingTime = Date.now() - startTime;

    // Détecter le type de message pour les métadonnées
    const messageType = hl7AIService.detectHL7MessageType(hl7Message);

    res.json({
      success: true,
      analysis,
      messageType,
      timestamp: new Date().toISOString(),
      processingTime
    });
  } catch (error) {
    console.error('Erreur lors de l\'analyse HL7:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de l\'analyse',
      message: error.message || 'Une erreur s\'est produite lors de l\'analyse du message HL7'
    });
  }
});

/**
 * @swagger
 * /api/hl7-ai/analyze-fhir:
 *   post:
 *     summary: Analyser une ressource FHIR avec IA
 *     description: Fournit une analyse détaillée d'une ressource FHIR
 *     tags: [HL7-FHIR AI]
 *     security:
 *       - ApiKeyAuth: []
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - fhirResource
 *             properties:
 *               fhirResource:
 *                 type: object
 *                 description: La ressource FHIR à analyser
 *               provider:
 *                 type: string
 *                 description: Le fournisseur d'IA à utiliser (défaut mistral)
 *     responses:
 *       200:
 *         description: Analyse générée avec succès
 *       400:
 *         description: Paramètres invalides
 *       500:
 *         description: Erreur serveur
 */
router.post('/analyze-fhir', authCombined, apiRequestCounter, async (req, res) => {
  try {
    const { fhirResource, provider = 'mistral' } = req.body;

    if (!fhirResource) {
      return res.status(400).json({
        success: false,
        error: 'Ressource FHIR manquante',
        message: 'Vous devez fournir une ressource FHIR à analyser'
      });
    }

    const startTime = Date.now();
    const analysis = await hl7AIService.analyzeFHIRResource(fhirResource, provider);
    const processingTime = Date.now() - startTime;

    // Détecter le type de ressource pour les métadonnées
    const resourceType = hl7AIService.detectFHIRResourceType(fhirResource);

    res.json({
      success: true,
      analysis,
      resourceType,
      timestamp: new Date().toISOString(),
      processingTime
    });
  } catch (error) {
    console.error('Erreur lors de l\'analyse FHIR:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de l\'analyse',
      message: error.message || 'Une erreur s\'est produite lors de l\'analyse de la ressource FHIR'
    });
  }
});

/**
 * @swagger
 * /api/hl7-ai/analyze-conversion:
 *   post:
 *     summary: Analyser une conversion HL7-FHIR avec IA
 *     description: Évalue la qualité d'une conversion HL7 vers FHIR et suggère des améliorations
 *     tags: [HL7-FHIR AI]
 *     security:
 *       - ApiKeyAuth: []
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - hl7Message
 *               - fhirResources
 *             properties:
 *               hl7Message:
 *                 type: string
 *                 description: Le message HL7 v2.5 original
 *               fhirResources:
 *                 type: array
 *                 items:
 *                   type: object
 *                 description: Les ressources FHIR générées
 *               provider:
 *                 type: string
 *                 description: Le fournisseur d'IA à utiliser (défaut mistral)
 *     responses:
 *       200:
 *         description: Analyse de conversion générée avec succès
 *       400:
 *         description: Paramètres invalides
 *       500:
 *         description: Erreur serveur
 */
router.post('/analyze-conversion', authCombined, apiRequestCounter, async (req, res) => {
  try {
    const { hl7Message, fhirResources, provider = 'mistral' } = req.body;

    if (!hl7Message || !fhirResources) {
      return res.status(400).json({
        success: false,
        error: 'Données manquantes',
        message: 'Vous devez fournir à la fois le message HL7 original et les ressources FHIR générées'
      });
    }

    const startTime = Date.now();
    const analysis = await hl7AIService.analyzeConversion(hl7Message, fhirResources, provider);
    const processingTime = Date.now() - startTime;

    res.json({
      success: true,
      analysis,
      timestamp: new Date().toISOString(),
      processingTime
    });
  } catch (error) {
    console.error('Erreur lors de l\'analyse de conversion:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de l\'analyse',
      message: error.message || 'Une erreur s\'est produite lors de l\'analyse de la conversion'
    });
  }
});

/**
 * @swagger
 * /api/hl7-ai/suggest-mapping:
 *   post:
 *     summary: Suggérer des améliorations pour un template de mapping
 *     description: Analyse un template de mapping HL7-FHIR et propose des améliorations
 *     tags: [HL7-FHIR AI]
 *     security:
 *       - ApiKeyAuth: []
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - mappingTemplate
 *             properties:
 *               mappingTemplate:
 *                 type: object
 *                 description: Le template de mapping à améliorer
 *               conversionExamples:
 *                 type: array
 *                 description: Exemples de conversions réussies
 *               provider:
 *                 type: string
 *                 description: Le fournisseur d'IA à utiliser (défaut mistral)
 *     responses:
 *       200:
 *         description: Suggestions générées avec succès
 *       400:
 *         description: Paramètres invalides
 *       500:
 *         description: Erreur serveur
 */
router.post('/suggest-mapping', authCombined, apiRequestCounter, async (req, res) => {
  try {
    const { mappingTemplate, conversionExamples = [], provider = 'mistral' } = req.body;

    if (!mappingTemplate) {
      return res.status(400).json({
        success: false,
        error: 'Template de mapping manquant',
        message: 'Vous devez fournir un template de mapping à améliorer'
      });
    }

    const startTime = Date.now();
    const suggestions = await hl7AIService.suggestMappingImprovements(
      mappingTemplate,
      conversionExamples,
      provider
    );
    const processingTime = Date.now() - startTime;

    res.json({
      success: true,
      suggestions,
      timestamp: new Date().toISOString(),
      processingTime
    });
  } catch (error) {
    console.error('Erreur lors de la suggestion de mapping:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la génération des suggestions',
      message: error.message || 'Une erreur s\'est produite lors de la génération des suggestions'
    });
  }
});

/**
 * @swagger
 * /api/hl7-ai/generate-documentation:
 *   post:
 *     summary: Générer de la documentation pour un message HL7 ou une ressource FHIR
 *     description: Crée une documentation explicative et pédagogique pour un message ou une ressource
 *     tags: [HL7-FHIR AI]
 *     security:
 *       - ApiKeyAuth: []
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - message
 *               - type
 *             properties:
 *               message:
 *                 type: string
 *                 description: Le message HL7 ou la ressource FHIR (string ou objet)
 *               type:
 *                 type: string
 *                 enum: [hl7, fhir]
 *                 description: Le type de message
 *               provider:
 *                 type: string
 *                 description: Le fournisseur d'IA à utiliser (défaut mistral)
 *     responses:
 *       200:
 *         description: Documentation générée avec succès
 *       400:
 *         description: Paramètres invalides
 *       500:
 *         description: Erreur serveur
 */
router.post('/generate-documentation', authCombined, apiRequestCounter, async (req, res) => {
  try {
    const { message, type, provider = 'mistral' } = req.body;

    if (!message || !type) {
      return res.status(400).json({
        success: false,
        error: 'Données manquantes',
        message: 'Vous devez fournir le message et son type (hl7 ou fhir)'
      });
    }

    if (type !== 'hl7' && type !== 'fhir') {
      return res.status(400).json({
        success: false,
        error: 'Type invalide',
        message: 'Le type doit être "hl7" ou "fhir"'
      });
    }

    const startTime = Date.now();
    const documentation = await hl7AIService.generateDocumentation(message, type, provider);
    const processingTime = Date.now() - startTime;

    res.json({
      success: true,
      documentation,
      timestamp: new Date().toISOString(),
      processingTime
    });
  } catch (error) {
    console.error('Erreur lors de la génération de documentation:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la génération',
      message: error.message || 'Une erreur s\'est produite lors de la génération de la documentation'
    });
  }
});

module.exports = router;