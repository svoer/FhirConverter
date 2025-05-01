/**
 * Routes pour la gestion des workflows
 */

const express = require('express');
const router = express.Router();
const workflowService = require('../src/services/workflowService');
const jwtAuth = require('../middleware/jwtAuth');
const { adminRequired } = require('../middleware/authMiddleware');

/**
 * @swagger
 * tags:
 *   name: Workflows
 *   description: API pour la gestion des workflows
 */

/**
 * @swagger
 * /api/workflows:
 *   get:
 *     summary: Récupérer tous les workflows
 *     tags: [Workflows]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Liste des workflows
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: integer
 *                   application_id:
 *                     type: integer
 *                   application_name:
 *                     type: string
 *                   name:
 *                     type: string
 *                   description:
 *                     type: string
 *                   is_active:
 *                     type: boolean
 *                   created_at:
 *                     type: string
 *                   updated_at:
 *                     type: string
 *       401:
 *         description: Non autorisé
 *       500:
 *         description: Erreur serveur
 */
router.get('/', jwtAuth({ roles: ['admin'] }), async (req, res) => {
  try {
    const workflows = await workflowService.getAllWorkflows();
    res.json(workflows);
  } catch (error) {
    console.error('[API] Erreur lors de la récupération des workflows:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des workflows' });
  }
});

/**
 * @swagger
 * /api/workflows/application/{id}:
 *   get:
 *     summary: Récupérer les workflows d'une application
 *     tags: [Workflows]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID de l'application
 *     responses:
 *       200:
 *         description: Liste des workflows de l'application
 *       401:
 *         description: Non autorisé
 *       500:
 *         description: Erreur serveur
 */
router.get('/application/:id', jwtAuth({ roles: ['admin'] }), async (req, res) => {
  try {
    const applicationId = parseInt(req.params.id);
    
    if (isNaN(applicationId)) {
      return res.status(400).json({ error: 'ID d\'application invalide' });
    }
    
    const workflows = await workflowService.getWorkflowsByApplicationId(applicationId);
    res.json(workflows);
  } catch (error) {
    console.error(`[API] Erreur lors de la récupération des workflows pour l'application ${req.params.id}:`, error);
    res.status(500).json({ error: 'Erreur lors de la récupération des workflows' });
  }
});

/**
 * @swagger
 * /api/workflows/{id}:
 *   get:
 *     summary: Récupérer un workflow par son ID
 *     tags: [Workflows]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID du workflow
 *     responses:
 *       200:
 *         description: Workflow trouvé
 *       401:
 *         description: Non autorisé
 *       404:
 *         description: Workflow non trouvé
 *       500:
 *         description: Erreur serveur
 */
router.get('/:id', jwtAuth({ roles: ['admin'] }), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    
    if (isNaN(id)) {
      return res.status(400).json({ error: 'ID de workflow invalide' });
    }
    
    const workflow = await workflowService.getWorkflowById(id);
    
    if (!workflow) {
      return res.status(404).json({ error: 'Workflow non trouvé' });
    }
    
    res.json(workflow);
  } catch (error) {
    console.error(`[API] Erreur lors de la récupération du workflow ${req.params.id}:`, error);
    res.status(500).json({ error: 'Erreur lors de la récupération du workflow' });
  }
});

/**
 * @swagger
 * /api/workflows:
 *   post:
 *     summary: Créer un nouveau workflow
 *     tags: [Workflows]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - application_id
 *               - name
 *             properties:
 *               application_id:
 *                 type: integer
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               is_active:
 *                 type: boolean
 *               flow_json:
 *                 type: string
 *     responses:
 *       201:
 *         description: Workflow créé avec succès
 *       400:
 *         description: Données invalides
 *       401:
 *         description: Non autorisé
 *       500:
 *         description: Erreur serveur
 */
router.post('/', jwtAuth({ roles: ['admin'] }), async (req, res) => {
  try {
    if (!req.body.application_id || !req.body.name) {
      return res.status(400).json({ error: 'L\'ID de l\'application et le nom du workflow sont obligatoires' });
    }
    
    const workflow = await workflowService.createWorkflow(req.body);
    res.status(201).json(workflow);
  } catch (error) {
    console.error('[API] Erreur lors de la création du workflow:', error);
    res.status(500).json({ error: 'Erreur lors de la création du workflow' });
  }
});

/**
 * @swagger
 * /api/workflows/{id}:
 *   put:
 *     summary: Mettre à jour un workflow
 *     tags: [Workflows]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID du workflow
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               application_id:
 *                 type: integer
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               is_active:
 *                 type: boolean
 *               flow_json:
 *                 type: string
 *     responses:
 *       200:
 *         description: Workflow mis à jour avec succès
 *       400:
 *         description: Données invalides
 *       401:
 *         description: Non autorisé
 *       404:
 *         description: Workflow non trouvé
 *       500:
 *         description: Erreur serveur
 */
router.put('/:id', jwtAuth({ roles: ['admin'] }), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    
    if (isNaN(id)) {
      return res.status(400).json({ error: 'ID de workflow invalide' });
    }
    
    const workflow = await workflowService.updateWorkflow(id, req.body);
    
    if (!workflow) {
      return res.status(404).json({ error: 'Workflow non trouvé' });
    }
    
    res.json(workflow);
  } catch (error) {
    console.error(`[API] Erreur lors de la mise à jour du workflow ${req.params.id}:`, error);
    res.status(500).json({ error: 'Erreur lors de la mise à jour du workflow' });
  }
});

/**
 * @swagger
 * /api/workflows/{id}:
 *   delete:
 *     summary: Supprimer un workflow
 *     tags: [Workflows]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID du workflow
 *     responses:
 *       200:
 *         description: Workflow supprimé avec succès
 *       401:
 *         description: Non autorisé
 *       404:
 *         description: Workflow non trouvé
 *       500:
 *         description: Erreur serveur
 */
router.delete('/:id', jwtAuth({ roles: ['admin'] }), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    
    if (isNaN(id)) {
      return res.status(400).json({ error: 'ID de workflow invalide' });
    }
    
    const result = await workflowService.deleteWorkflow(id);
    
    if (!result) {
      return res.status(404).json({ error: 'Workflow non trouvé' });
    }
    
    res.json({ message: 'Workflow supprimé avec succès' });
  } catch (error) {
    console.error(`[API] Erreur lors de la suppression du workflow ${req.params.id}:`, error);
    res.status(500).json({ error: 'Erreur lors de la suppression du workflow' });
  }
});

/**
 * @swagger
 * /api/workflows/{id}/editor:
 *   get:
 *     summary: Obtenir l'URL de l'éditeur de workflow
 *     tags: [Workflows]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID du workflow
 *     responses:
 *       200:
 *         description: URL de l'éditeur
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 editor_url:
 *                   type: string
 *       401:
 *         description: Non autorisé
 *       404:
 *         description: Workflow non trouvé
 *       500:
 *         description: Erreur serveur
 */
router.get('/:id/editor', jwtAuth({ roles: ['admin'] }), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    
    if (isNaN(id)) {
      return res.status(400).json({ error: 'ID de workflow invalide' });
    }
    
    const workflow = await workflowService.getWorkflowById(id);
    
    if (!workflow) {
      return res.status(404).json({ error: 'Workflow non trouvé' });
    }
    
    const editorUrl = workflowService.getEditorUrl(id);
    res.json({ editor_url: editorUrl });
  } catch (error) {
    console.error(`[API] Erreur lors de la récupération de l'URL de l'éditeur pour le workflow ${req.params.id}:`, error);
    res.status(500).json({ error: 'Erreur lors de la récupération de l\'URL de l\'éditeur' });
  }
});

module.exports = router;