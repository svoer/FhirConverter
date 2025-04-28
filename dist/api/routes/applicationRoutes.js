"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Routes pour la gestion des applications
 */
const express_1 = require("express");
const apiKeyAuth_1 = require("../middleware/apiKeyAuth");
const database_1 = require("../db/database");
const router = (0, express_1.Router)();
/**
 * @swagger
 * /api/v1/applications:
 *   get:
 *     summary: Récupère la liste des applications
 *     description: Récupère toutes les applications enregistrées
 *     tags: [Applications]
 *     security:
 *       - ApiKeyAuth: []
 *     responses:
 *       200:
 *         description: Liste des applications récupérée avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Application'
 *       401:
 *         description: Non autorisé (clé API invalide)
 *       500:
 *         description: Erreur serveur
 */
router.get('/', apiKeyAuth_1.apiKeyAuth, (req, res) => {
    try {
        const applications = (0, database_1.getAllApplications)();
        return res.status(200).json({
            success: true,
            data: applications
        });
    }
    catch (error) {
        return res.status(500).json({
            success: false,
            error: 'Internal Server Error',
            message: error.message
        });
    }
});
/**
 * @swagger
 * /api/v1/applications/{id}:
 *   get:
 *     summary: Récupère une application par son ID
 *     description: Récupère les détails d'une application spécifique
 *     tags: [Applications]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID de l'application
 *     responses:
 *       200:
 *         description: Application récupérée avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/Application'
 *       404:
 *         description: Application non trouvée
 *       401:
 *         description: Non autorisé (clé API invalide)
 *       500:
 *         description: Erreur serveur
 */
router.get('/:id', apiKeyAuth_1.apiKeyAuth, (req, res) => {
    try {
        const id = parseInt(req.params.id);
        if (isNaN(id)) {
            return res.status(400).json({
                success: false,
                error: 'Bad Request',
                message: 'L\'ID doit être un nombre'
            });
        }
        const application = (0, database_1.getApplicationById)(id);
        if (!application) {
            return res.status(404).json({
                success: false,
                error: 'Not Found',
                message: 'Application non trouvée'
            });
        }
        return res.status(200).json({
            success: true,
            data: application
        });
    }
    catch (error) {
        return res.status(500).json({
            success: false,
            error: 'Internal Server Error',
            message: error.message
        });
    }
});
/**
 * @swagger
 * /api/v1/applications:
 *   post:
 *     summary: Crée une nouvelle application
 *     description: Crée une nouvelle application avec les détails fournis
 *     tags: [Applications]
 *     security:
 *       - ApiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateApplicationDto'
 *     responses:
 *       201:
 *         description: Application créée avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/Application'
 *       400:
 *         description: Requête invalide
 *       401:
 *         description: Non autorisé (clé API invalide)
 *       500:
 *         description: Erreur serveur
 */
router.post('/', apiKeyAuth_1.apiKeyAuth, (req, res) => {
    try {
        const applicationData = req.body;
        // Vérifier que le nom est fourni
        if (!applicationData.name || applicationData.name.trim() === '') {
            return res.status(400).json({
                success: false,
                error: 'Bad Request',
                message: 'Le nom de l\'application est requis'
            });
        }
        // Créer l'application avec des valeurs par défaut si nécessaire
        const newApplication = (0, database_1.createApplication)({
            name: applicationData.name,
            type: applicationData.type,
            description: applicationData.description,
            is_active: applicationData.is_active !== undefined ? applicationData.is_active : true,
            properties: applicationData.properties,
            cors_domain: applicationData.cors_domain
        });
        return res.status(201).json({
            success: true,
            data: newApplication
        });
    }
    catch (error) {
        return res.status(500).json({
            success: false,
            error: 'Internal Server Error',
            message: error.message
        });
    }
});
/**
 * @swagger
 * /api/v1/applications/{id}:
 *   put:
 *     summary: Met à jour une application
 *     description: Met à jour les détails d'une application existante
 *     tags: [Applications]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID de l'application
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateApplicationDto'
 *     responses:
 *       200:
 *         description: Application mise à jour avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/Application'
 *       400:
 *         description: Requête invalide
 *       404:
 *         description: Application non trouvée
 *       401:
 *         description: Non autorisé (clé API invalide)
 *       500:
 *         description: Erreur serveur
 */
router.put('/:id', apiKeyAuth_1.apiKeyAuth, (req, res) => {
    try {
        const id = parseInt(req.params.id);
        if (isNaN(id)) {
            return res.status(400).json({
                success: false,
                error: 'Bad Request',
                message: 'L\'ID doit être un nombre'
            });
        }
        const applicationData = req.body;
        // Vérifier que l'application existe
        const existingApplication = (0, database_1.getApplicationById)(id);
        if (!existingApplication) {
            return res.status(404).json({
                success: false,
                error: 'Not Found',
                message: 'Application non trouvée'
            });
        }
        // Mettre à jour l'application
        const updatedApplication = (0, database_1.updateApplication)(id, applicationData);
        return res.status(200).json({
            success: true,
            data: updatedApplication
        });
    }
    catch (error) {
        return res.status(500).json({
            success: false,
            error: 'Internal Server Error',
            message: error.message
        });
    }
});
/**
 * @swagger
 * /api/v1/applications/{id}:
 *   delete:
 *     summary: Supprime une application
 *     description: Supprime une application et toutes les clés API associées
 *     tags: [Applications]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID de l'application
 *     responses:
 *       200:
 *         description: Application supprimée avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Application supprimée avec succès
 *       400:
 *         description: Requête invalide
 *       404:
 *         description: Application non trouvée
 *       401:
 *         description: Non autorisé (clé API invalide)
 *       500:
 *         description: Erreur serveur
 */
router.delete('/:id', apiKeyAuth_1.apiKeyAuth, (req, res) => {
    try {
        const id = parseInt(req.params.id);
        if (isNaN(id)) {
            return res.status(400).json({
                success: false,
                error: 'Bad Request',
                message: 'L\'ID doit être un nombre'
            });
        }
        // Vérifier que l'application existe
        const existingApplication = (0, database_1.getApplicationById)(id);
        if (!existingApplication) {
            return res.status(404).json({
                success: false,
                error: 'Not Found',
                message: 'Application non trouvée'
            });
        }
        // Supprimer l'application
        const deleted = (0, database_1.deleteApplication)(id);
        if (!deleted) {
            return res.status(500).json({
                success: false,
                error: 'Internal Server Error',
                message: 'Erreur lors de la suppression de l\'application'
            });
        }
        return res.status(200).json({
            success: true,
            message: 'Application supprimée avec succès'
        });
    }
    catch (error) {
        return res.status(500).json({
            success: false,
            error: 'Internal Server Error',
            message: error.message
        });
    }
});
exports.default = router;
