/**
 * Routes pour l'API d'IA spécialisée HL7-FHIR
 * Ces routes permettent d'accéder aux fonctionnalités avancées d'analyse
 * et d'aide à la conversion via l'IA
 */

const express = require('express');
const router = express.Router();
const hl7AIService = require('../src/services/hl7AIService');
const authCombined = require('../middleware/authCombined');

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
router.post('/analyze-hl7', authCombined, async (req, res) => {
  try {
    const { hl7Message, provider = 'mistral' } = req.body;
    
    if (!hl7Message) {
      return res.status(400).json({ error: 'Le message HL7 est requis' });
    }
    
    const analysis = await hl7AIService.analyzeHL7Message(hl7Message, provider);
    return res.status(200).json(analysis);
  } catch (error) {
    console.error('[HL7-AI] Erreur lors de l\'analyse HL7:', error);
    return res.status(500).json({ error: error.message });
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
router.post('/analyze-fhir', authCombined, async (req, res) => {
  try {
    const { fhirResource, provider = 'mistral' } = req.body;
    
    if (!fhirResource) {
      return res.status(400).json({ error: 'La ressource FHIR est requise' });
    }
    
    const analysis = await hl7AIService.analyzeFHIRResource(fhirResource, provider);
    return res.status(200).json(analysis);
  } catch (error) {
    console.error('[FHIR-AI] Erreur lors de l\'analyse FHIR:', error);
    return res.status(500).json({ error: error.message });
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
router.post('/analyze-conversion', authCombined, async (req, res) => {
  try {
    const { hl7Message, fhirResources, provider = 'mistral' } = req.body;
    
    if (!hl7Message || !fhirResources) {
      return res.status(400).json({ error: 'Le message HL7 et les ressources FHIR sont requis' });
    }
    
    const analysis = await hl7AIService.analyzeConversion(hl7Message, fhirResources, provider);
    return res.status(200).json(analysis);
  } catch (error) {
    console.error('[CONVERSION-AI] Erreur lors de l\'analyse de conversion:', error);
    return res.status(500).json({ error: error.message });
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
router.post('/suggest-mapping', authCombined, async (req, res) => {
  try {
    const { mappingTemplate, conversionExamples = [], provider = 'mistral' } = req.body;
    
    if (!mappingTemplate) {
      return res.status(400).json({ error: 'Le template de mapping est requis' });
    }
    
    const suggestions = await hl7AIService.suggestMappingImprovements(mappingTemplate, conversionExamples, provider);
    return res.status(200).json(suggestions);
  } catch (error) {
    console.error('[MAPPING-AI] Erreur lors de la suggestion de mapping:', error);
    return res.status(500).json({ error: error.message });
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
router.post('/generate-documentation', authCombined, async (req, res) => {
  try {
    const { message, type, provider = 'mistral' } = req.body;
    
    if (!message || !type) {
      return res.status(400).json({ error: 'Le message et le type sont requis' });
    }
    
    if (type !== 'hl7' && type !== 'fhir') {
      return res.status(400).json({ error: 'Le type doit être "hl7" ou "fhir"' });
    }
    
    const documentation = await hl7AIService.generateDocumentation(message, type, provider);
    return res.status(200).json(documentation);
  } catch (error) {
    console.error('[DOC-AI] Erreur lors de la génération de documentation:', error);
    return res.status(500).json({ error: error.message });
  }
});

module.exports = router;