/**
 * Routes pour l'API de conversion sans analyse IA
 * Ces routes permettent d'accéder aux fonctionnalités de base de conversion
 * entre les différents formats (HL7, FHIR)
 */

const express = require('express');
const router = express.Router();
const authenticateToken = require('../middleware/jwtAuth');
const validateApiKey = require('../middleware/apiKeyAuth');
const converter = require('../src/services/conversionService');
// Le service statsService n'existe pas, utilisons le service de journalisation des conversions à la place
const conversionLogService = require('../src/services/conversionLogService');
const { apiRequestCounter } = require('../src/metrics');

/**
 * @swagger
 * tags:
 *   name: Conversion
 *   description: API pour la conversion entre différents formats standards de santé
 */

/**
 * @swagger
 * /api/convert/hl7-to-fhir:
 *   post:
 *     summary: Convertir un message HL7 v2.5 en FHIR
 *     description: Convertit un message HL7 v2.5 en ressources FHIR R4 correspondantes
 *     tags: [Conversion]
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
 *                 description: Le message HL7 v2.5 à convertir
 *               options:
 *                 type: object
 *                 description: Options supplémentaires pour la conversion
 *                 properties:
 *                   includeComments:
 *                     type: boolean
 *                     description: Inclure des commentaires dans le résultat FHIR
 *                   useIdentifiers:
 *                     type: boolean
 *                     description: Utiliser les identifiants HL7 dans les ressources FHIR
 *     responses:
 *       200:
 *         description: Conversion réussie
 *       400:
 *         description: Paramètres invalides
 *       500:
 *         description: Erreur serveur
 */
router.post('/hl7-to-fhir', authenticateToken, validateApiKey, apiRequestCounter, async (req, res) => {
  try {
    const { hl7Message, options = {} } = req.body;
    
    if (!hl7Message) {
      return res.status(400).json({ error: 'Le message HL7 est requis' });
    }
    
    // Tracer l'application_id depuis la clé API ou la session
    let application_id = req.apiKeyData ? req.apiKeyData.application_id : null;
    if (!application_id && req.user && req.user.default_application_id) {
      application_id = req.user.default_application_id;
    }
    
    // Convertir le message HL7 en FHIR
    try {
      const result = await converter.convertHL7ToFHIR(hl7Message, options);
      
      // Enregistrer la conversion dans les journaux
      try {
        await conversionLogService.logConversion({
          apiKeyId: req.apiKeyData ? req.apiKeyData.id : null,
          applicationId: application_id || 1,
          sourceType: 'direct',
          hl7Content: hl7Message,
          fhirContent: JSON.stringify(result),
          status: 'success',
          processingTime: result.processingTime || 0,
          errorMessage: null
        });
      } catch (logError) {
        console.error('Erreur lors de l\'enregistrement de la conversion:', logError);
      }
      
      return res.json(result);
    } catch (conversionError) {
      console.error('Erreur lors de la conversion HL7 vers FHIR:', conversionError);
      
      // Enregistrer l'échec dans les journaux
      try {
        await conversionLogService.logConversion({
          apiKeyId: req.apiKeyData ? req.apiKeyData.id : null,
          applicationId: application_id || 1,
          sourceType: 'direct',
          hl7Content: hl7Message,
          fhirContent: null,
          status: 'error',
          processingTime: 0,
          errorMessage: conversionError.message
        });
      } catch (logError) {
        console.error('Erreur lors de l\'enregistrement de l\'erreur de conversion:', logError);
      }
      
      return res.status(400).json({ error: conversionError.message });
    }
    
  } catch (error) {
    console.error('Erreur HL7 vers FHIR:', error);
    return res.status(500).json({ error: 'Erreur de serveur lors de la conversion' });
  }
});

/**
 * @swagger
 * /api/convert/fhir-to-hl7:
 *   post:
 *     summary: Convertir des ressources FHIR en message HL7 v2.5
 *     description: Convertit des ressources FHIR R4 en message HL7 v2.5 correspondant
 *     tags: [Conversion]
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
 *               - fhirResources
 *             properties:
 *               fhirResources:
 *                 type: object
 *                 description: Les ressources FHIR à convertir (peut être un bundle ou un objet individuel)
 *               options:
 *                 type: object
 *                 description: Options supplémentaires pour la conversion
 *                 properties:
 *                   hl7Version:
 *                     type: string
 *                     description: Version HL7 souhaitée (par défaut 2.5)
 *                   includeNotes:
 *                     type: boolean
 *                     description: Inclure des notes explicatives
 *     responses:
 *       200:
 *         description: Conversion réussie
 *       400:
 *         description: Paramètres invalides
 *       500:
 *         description: Erreur serveur
 */
router.post('/fhir-to-hl7', authenticateToken, validateApiKey, apiRequestCounter, async (req, res) => {
  try {
    const { fhirResources, options = {} } = req.body;
    
    if (!fhirResources) {
      return res.status(400).json({ error: 'Les ressources FHIR sont requises' });
    }
    
    // Tracer l'application_id depuis la clé API ou la session
    let application_id = req.apiKeyData ? req.apiKeyData.application_id : null;
    if (!application_id && req.user && req.user.default_application_id) {
      application_id = req.user.default_application_id;
    }
    
    // Convertir les ressources FHIR en HL7
    try {
      const result = await converter.convertFHIRToHL7(fhirResources, options);
      
      // Enregistrer la conversion dans les journaux
      try {
        await conversionLogService.logConversion({
          apiKeyId: req.apiKeyData ? req.apiKeyData.id : null,
          applicationId: application_id || 1,
          sourceType: 'direct',
          hl7Content: result.hl7Message || '',
          fhirContent: JSON.stringify(fhirResources),
          status: 'success',
          processingTime: result.processingTime || 0,
          errorMessage: null
        });
      } catch (logError) {
        console.error('Erreur lors de l\'enregistrement de la conversion:', logError);
      }
      
      return res.json(result);
    } catch (conversionError) {
      console.error('Erreur lors de la conversion FHIR vers HL7:', conversionError);
      
      // Enregistrer l'échec dans les journaux
      try {
        await conversionLogService.logConversion({
          apiKeyId: req.apiKeyData ? req.apiKeyData.id : null,
          applicationId: application_id || 1,
          sourceType: 'direct',
          hl7Content: null,
          fhirContent: JSON.stringify(fhirResources),
          status: 'error',
          processingTime: 0,
          errorMessage: conversionError.message
        });
      } catch (logError) {
        console.error('Erreur lors de l\'enregistrement de l\'erreur de conversion:', logError);
      }
      
      return res.status(400).json({ error: conversionError.message });
    }
    
  } catch (error) {
    console.error('Erreur FHIR vers HL7:', error);
    return res.status(500).json({ error: 'Erreur de serveur lors de la conversion' });
  }
});

module.exports = router;