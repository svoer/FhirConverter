/**
 * Routes pour la gestion des applications
 */
import { Router, Request, Response } from 'express';
import { apiKeyAuth } from '../middleware/apiKeyAuth';
import { 
  getAllApplications,
  getApplicationById,
  createApplication,
  updateApplication,
  deleteApplication
} from '../db/database';
import { Application, CreateApplicationDto, UpdateApplicationDto } from '../../types';

const router = Router();

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
router.get('/', apiKeyAuth, (req: Request, res: Response) => {
  try {
    const applications = getAllApplications();
    
    return res.status(200).json({
      success: true,
      data: applications
    });
  } catch (error: any) {
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
router.get('/:id', apiKeyAuth, (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    
    if (isNaN(id)) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'L\'ID doit être un nombre'
      });
    }
    
    const application = getApplicationById(id);
    
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
  } catch (error: any) {
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
router.post('/', apiKeyAuth, (req: Request, res: Response) => {
  try {
    const applicationData: CreateApplicationDto = req.body;
    
    // Vérifier que le nom est fourni
    if (!applicationData.name || applicationData.name.trim() === '') {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Le nom de l\'application est requis'
      });
    }
    
    // Créer l'application avec des valeurs par défaut si nécessaire
    const newApplication = createApplication({
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
  } catch (error: any) {
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
router.put('/:id', apiKeyAuth, (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    
    if (isNaN(id)) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'L\'ID doit être un nombre'
      });
    }
    
    const applicationData: UpdateApplicationDto = req.body;
    
    // Vérifier que l'application existe
    const existingApplication = getApplicationById(id);
    
    if (!existingApplication) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Application non trouvée'
      });
    }
    
    // Mettre à jour l'application
    const updatedApplication = updateApplication(id, applicationData);
    
    return res.status(200).json({
      success: true,
      data: updatedApplication
    });
  } catch (error: any) {
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
router.delete('/:id', apiKeyAuth, (req: Request, res: Response) => {
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
    const existingApplication = getApplicationById(id);
    
    if (!existingApplication) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Application non trouvée'
      });
    }
    
    // Supprimer l'application
    const deleted = deleteApplication(id);
    
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
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: error.message
    });
  }
});

export default router;