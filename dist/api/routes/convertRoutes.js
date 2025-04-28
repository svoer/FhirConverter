"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Routes pour la conversion HL7 vers FHIR
 */
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const apiKeyAuth_1 = require("../middleware/apiKeyAuth");
const conversionService_1 = require("../services/conversionService");
const conversionLogService_1 = require("../services/conversionLogService");
const router = (0, express_1.Router)();
const upload = (0, multer_1.default)({ storage: multer_1.default.memoryStorage() });
/**
 * @swagger
 * /api/v1/convert:
 *   post:
 *     summary: Convertit un message HL7 en ressource FHIR
 *     description: Convertit un message HL7 v2.5 en ressource FHIR R4
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
 *       400:
 *         description: Message HL7 invalide
 *       401:
 *         description: Non autorisé (clé API invalide)
 *       500:
 *         description: Erreur serveur lors de la conversion
 */
router.post('/convert', apiKeyAuth_1.apiKeyAuth, (req, res) => {
    const startTime = Date.now();
    let hl7Message = req.body.hl7Message;
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
    if (!(0, conversionService_1.isValidHL7)(hl7Message)) {
        res.status(400).json({
            success: false,
            error: 'Bad Request',
            message: 'Le message HL7 est invalide'
        });
        return;
    }
    try {
        // Convertir le message HL7 en FHIR
        const fhirResource = (0, conversionService_1.convertHL7ToFHIR)(hl7Message);
        const processingTime = Date.now() - startTime;
        // Journaliser la conversion
        if (req.apiKey) {
            (0, conversionLogService_1.logConversion)(req.apiKey.id, 'HL7v2.5', hl7Message, JSON.stringify(fhirResource), 'success', processingTime);
        }
        // Renvoyer la ressource FHIR
        res.status(200).json({
            success: true,
            data: fhirResource,
            processingTime
        });
    }
    catch (error) {
        const processingTime = Date.now() - startTime;
        // Journaliser l'erreur
        if (req.apiKey) {
            (0, conversionLogService_1.logConversion)(req.apiKey.id, 'HL7v2.5', hl7Message, '', 'error', processingTime, error.message);
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
 * /api/v1/convert/file:
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
router.post('/convert/file', apiKeyAuth_1.apiKeyAuth, upload.single('file'), (req, res) => {
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
    if (!(0, conversionService_1.isValidHL7)(hl7Message)) {
        res.status(400).json({
            success: false,
            error: 'Bad Request',
            message: 'Le fichier HL7 est invalide'
        });
        return;
    }
    try {
        // Convertir le message HL7 en FHIR
        const fhirResource = (0, conversionService_1.convertHL7ToFHIR)(hl7Message);
        const processingTime = Date.now() - startTime;
        // Journaliser la conversion
        if (req.apiKey) {
            (0, conversionLogService_1.logConversion)(req.apiKey.id, 'HL7v2.5 (file)', hl7Message, JSON.stringify(fhirResource), 'success', processingTime);
        }
        // Renvoyer la ressource FHIR
        res.status(200).json({
            success: true,
            data: fhirResource,
            processingTime
        });
    }
    catch (error) {
        const processingTime = Date.now() - startTime;
        // Journaliser l'erreur
        if (req.apiKey) {
            (0, conversionLogService_1.logConversion)(req.apiKey.id, 'HL7v2.5 (file)', hl7Message, '', 'error', processingTime, error.message);
        }
        // Renvoyer l'erreur
        res.status(500).json({
            success: false,
            error: 'Internal Server Error',
            message: error.message
        });
    }
});
exports.default = router;
