/**
 * Routes pour la gestion des clés API
 */
import { Router, Request, Response } from 'express';
import { apiKeyAuth } from '../middleware/apiKeyAuth';
import { 
  createNewApiKey,
  revokeExistingApiKey,
  getApiKeysForApplication,
  getApiKeyDetails
} from '../services/apiKeyService';
import { getApplicationById } from '../db/database';

const router = Router();

/**
 * @swagger
 * /api/v1/api-keys:
 *   post:
 *     summary: Génère une nouvelle clé API
 *     description: Génère une nouvelle clé API pour une application existante
 *     tags: [API Keys]
 *     security:
 *       - ApiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               applicationId:
 *                 type: integer
 *                 description: ID de l'application
 *             required:
 *               - applicationId
 *     responses:
 *       201:
 *         description: Clé API générée avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/ApiKey'
 *       400:
 *         description: Requête invalide
 *       404:
 *         description: Application non trouvée
 *       401:
 *         description: Non autorisé (clé API invalide)
 *       500:
 *         description: Erreur serveur
 */
router.post('/', apiKeyAuth, (req: Request, res: Response) => {
  try {
    const { applicationId } = req.body;
    
    if (!applicationId || isNaN(parseInt(applicationId))) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'L\'ID d\'application est requis et doit être un nombre'
      });
    }
    
    // Vérifier que l'application existe
    const application = getApplicationById(parseInt(applicationId));
    
    if (!application) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Application non trouvée'
      });
    }
    
    // Créer la clé API
    const apiKey = createNewApiKey(parseInt(applicationId));
    
    return res.status(201).json({
      success: true,
      data: apiKey
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
 * /api/v1/api-keys/application/{applicationId}:
 *   get:
 *     summary: Récupère les clés API d'une application
 *     description: Récupère toutes les clés API associées à une application
 *     tags: [API Keys]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: applicationId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID de l'application
 *     responses:
 *       200:
 *         description: Clés API récupérées avec succès
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
 *                     $ref: '#/components/schemas/ApiKey'
 *       400:
 *         description: Requête invalide
 *       404:
 *         description: Application non trouvée
 *       401:
 *         description: Non autorisé (clé API invalide)
 *       500:
 *         description: Erreur serveur
 */
router.get('/application/:applicationId', apiKeyAuth, (req: Request, res: Response) => {
  try {
    const applicationId = parseInt(req.params.applicationId);
    
    if (isNaN(applicationId)) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'L\'ID d\'application doit être un nombre'
      });
    }
    
    // Vérifier que l'application existe
    const application = getApplicationById(applicationId);
    
    if (!application) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Application non trouvée'
      });
    }
    
    // Récupérer les clés API de l'application
    const apiKeys = getApiKeysForApplication(applicationId);
    
    return res.status(200).json({
      success: true,
      data: apiKeys
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
 * /api/v1/api-keys/{id}:
 *   get:
 *     summary: Récupère une clé API par son ID
 *     description: Récupère les détails d'une clé API spécifique
 *     tags: [API Keys]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID de la clé API
 *     responses:
 *       200:
 *         description: Clé API récupérée avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/ApiKey'
 *       400:
 *         description: Requête invalide
 *       404:
 *         description: Clé API non trouvée
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
    
    // Récupérer la clé API
    const apiKey = getApiKeyDetails(id);
    
    if (!apiKey) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Clé API non trouvée'
      });
    }
    
    return res.status(200).json({
      success: true,
      data: apiKey
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
 * /api/v1/api-keys/{id}/revoke:
 *   post:
 *     summary: Révoque une clé API
 *     description: Marque une clé API comme révoquée
 *     tags: [API Keys]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID de la clé API
 *     responses:
 *       200:
 *         description: Clé API révoquée avec succès
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
 *                   example: Clé API révoquée avec succès
 *       400:
 *         description: Requête invalide
 *       404:
 *         description: Clé API non trouvée
 *       401:
 *         description: Non autorisé (clé API invalide)
 *       500:
 *         description: Erreur serveur
 */
router.post('/:id/revoke', apiKeyAuth, (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    
    if (isNaN(id)) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'L\'ID doit être un nombre'
      });
    }
    
    // Vérifier que la clé API existe
    const apiKey = getApiKeyDetails(id);
    
    if (!apiKey) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Clé API non trouvée'
      });
    }
    
    // Révoquer la clé API
    const revoked = revokeExistingApiKey(id);
    
    if (!revoked) {
      return res.status(500).json({
        success: false,
        error: 'Internal Server Error',
        message: 'Erreur lors de la révocation de la clé API'
      });
    }
    
    return res.status(200).json({
      success: true,
      message: 'Clé API révoquée avec succès'
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