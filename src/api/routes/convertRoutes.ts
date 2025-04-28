/**
 * Routes pour la conversion HL7 vers FHIR
 */

import express, { Request, Response } from 'express';
import multer from 'multer';
import { isValidHL7, convertHL7ToFHIR, logConversion } from '../services/conversionService';
import { apiKeyAuth } from '../middleware/apiKeyAuth';

const router = express.Router();

// Configuration de multer pour le téléchargement de fichiers
const storage = multer.memoryStorage();
const upload = multer({ 
  storage,
  limits: { fileSize: 5 * 1024 * 1024 } // Limite de 5MB
});

/**
 * @swagger
 * /api/convert:
 *   post:
 *     summary: Convertit un message HL7 en ressource FHIR
 *     description: Convertit un message HL7 v2.5 en ressource FHIR R4 compatible avec les terminologies françaises
 *     tags: [Conversion]
 *     security:
 *       - ApiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               hl7Message:
 *                 type: string
 *                 description: Message HL7 à convertir
 *             required:
 *               - hl7Message
 *     responses:
 *       200:
 *         description: Message HL7 converti avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   description: Ressource FHIR générée
 *                 processingTime:
 *                   type: number
 *                   description: Temps de traitement en millisecondes
 *       400:
 *         description: Message HL7 invalide
 *       401:
 *         description: Non autorisé (clé API invalide)
 *       500:
 *         description: Erreur serveur lors de la conversion
 */
router.post('/', apiKeyAuth, (req: Request, res: Response): void => {
  const startTime = Date.now();
  let hl7Message = req.body.hl7Message as string;
  
  // Vérifier que le message HL7 est fourni
  if (!hl7Message) {
    res.status(400).json({
      success: false,
      error: 'Bad Request',
      message: 'Le message HL7 est requis'
    });
    return;
  }
  
  // Vérifier que le message HL7 est valide
  if (!isValidHL7(hl7Message)) {
    res.status(400).json({
      success: false,
      error: 'Bad Request',
      message: 'Le message HL7 est invalide'
    });
    return;
  }
  
  try {
    // Convertir le message HL7 en FHIR
    const fhirResource = convertHL7ToFHIR(hl7Message);
    const processingTime = Date.now() - startTime;
    
    // Journaliser la conversion
    if (req.apiKey) {
      logConversion(
        req.apiKey.id,
        'HL7v2.5',
        hl7Message,
        JSON.stringify(fhirResource),
        'success',
        processingTime
      );
    }
    
    // Renvoyer la ressource FHIR
    res.status(200).json({
      success: true,
      data: fhirResource,
      processingTime
    });
  } catch (error: any) {
    const processingTime = Date.now() - startTime;
    
    // Journaliser l'erreur
    if (req.apiKey) {
      logConversion(
        req.apiKey.id,
        'HL7v2.5',
        hl7Message,
        '',
        'error',
        processingTime,
        error.message
      );
    }
    
    // Renvoyer l'erreur
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: error.message
    });
  }
});

/**
 * @swagger
 * /api/convert/file:
 *   post:
 *     summary: Convertit un fichier HL7 en ressource FHIR
 *     description: Convertit un fichier contenant un message HL7 v2.5 en ressource FHIR R4
 *     tags: [Conversion]
 *     security:
 *       - ApiKeyAuth: []
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Fichier HL7 converti avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   description: Ressource FHIR générée
 *       400:
 *         description: Fichier HL7 invalide
 *       401:
 *         description: Non autorisé (clé API invalide)
 *       500:
 *         description: Erreur serveur lors de la conversion
 */
router.post('/file', apiKeyAuth, upload.single('file'), (req: Request, res: Response): void => {
  const startTime = Date.now();
  
  // Vérifier que le fichier est fourni
  if (!req.file) {
    res.status(400).json({
      success: false,
      error: 'Bad Request',
      message: 'Le fichier HL7 est requis'
    });
    return;
  }
  
  // Extraire le contenu du fichier
  const hl7Message = req.file.buffer.toString('utf-8');
  
  // Vérifier que le message HL7 est valide
  if (!isValidHL7(hl7Message)) {
    res.status(400).json({
      success: false,
      error: 'Bad Request',
      message: 'Le fichier HL7 est invalide'
    });
    return;
  }
  
  try {
    // Convertir le message HL7 en FHIR
    const fhirResource = convertHL7ToFHIR(hl7Message);
    const processingTime = Date.now() - startTime;
    
    // Journaliser la conversion
    if (req.apiKey) {
      logConversion(
        req.apiKey.id,
        'HL7v2.5 (file)',
        hl7Message,
        JSON.stringify(fhirResource),
        'success',
        processingTime
      );
    }
    
    // Renvoyer la ressource FHIR
    res.status(200).json({
      success: true,
      data: fhirResource,
      processingTime
    });
  } catch (error: any) {
    const processingTime = Date.now() - startTime;
    
    // Journaliser l'erreur
    if (req.apiKey) {
      logConversion(
        req.apiKey.id,
        'HL7v2.5 (file)',
        hl7Message,
        '',
        'error',
        processingTime,
        error.message
      );
    }
    
    // Renvoyer l'erreur
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: error.message
    });
  }
});

/**
 * @swagger
 * /api/convert/validate:
 *   post:
 *     summary: Valide un message HL7
 *     description: Vérifie si un message HL7 v2.5 est valide sans effectuer la conversion
 *     tags: [Conversion]
 *     security:
 *       - ApiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               hl7Message:
 *                 type: string
 *                 description: Message HL7 à valider
 *             required:
 *               - hl7Message
 *     responses:
 *       200:
 *         description: Résultat de la validation
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 isValid:
 *                   type: boolean
 *                   description: Indique si le message HL7 est valide
 *       400:
 *         description: Requête invalide
 *       401:
 *         description: Non autorisé (clé API invalide)
 *       500:
 *         description: Erreur serveur lors de la validation
 */
router.post('/validate', apiKeyAuth, (req: Request, res: Response): void => {
  const hl7Message = req.body.hl7Message as string;
  
  // Vérifier que le message HL7 est fourni
  if (!hl7Message) {
    res.status(400).json({
      success: false,
      error: 'Bad Request',
      message: 'Le message HL7 est requis'
    });
    return;
  }
  
  try {
    // Valider le message HL7
    const isValid = isValidHL7(hl7Message);
    
    // Renvoyer le résultat de la validation
    res.status(200).json({
      success: true,
      isValid
    });
  } catch (error: any) {
    // Renvoyer l'erreur
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: error.message
    });
  }
});

export default router;