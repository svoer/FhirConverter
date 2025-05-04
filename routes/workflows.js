/**
 * Routes pour la gestion des workflows
 */

const express = require('express');
const router = express.Router();
const workflowService = require('../src/services/workflowService');
const jwtAuth = require('../middleware/jwtAuth');

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

/**
 * @swagger
 * /api/workflows/execute:
 *   post:
 *     summary: Exécuter un workflow pour une application
 *     tags: [Workflows]
 *     security:
 *       - ApiKey: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - application_id
 *               - data
 *             properties:
 *               application_id:
 *                 type: integer
 *                 description: ID de l'application pour laquelle exécuter le workflow
 *               data:
 *                 type: object
 *                 description: Données d'entrée pour le workflow
 *     responses:
 *       200:
 *         description: Résultat de l'exécution du workflow
 *       400:
 *         description: Données invalides
 *       404:
 *         description: Workflow non trouvé
 *       500:
 *         description: Erreur serveur
 */
router.post('/execute', async (req, res) => {
  try {
    const { application_id, data } = req.body;
    
    if (!application_id) {
      return res.status(400).json({ error: 'L\'ID de l\'application est obligatoire' });
    }
    
    // Convertir en nombre si ce n'est pas déjà le cas
    const applicationId = parseInt(application_id);
    
    if (isNaN(applicationId)) {
      return res.status(400).json({ error: 'L\'ID de l\'application doit être un nombre valide' });
    }
    
    // Exécuter le workflow
    const result = await workflowService.executeWorkflow(applicationId, data || {});
    
    if (!result) {
      return res.status(404).json({ 
        error: 'Aucun workflow actif trouvé pour cette application',
        application_id: applicationId
      });
    }
    
    res.json(result);
  } catch (error) {
    console.error(`[API] Erreur lors de l'exécution du workflow:`, error);
    res.status(500).json({ 
      error: 'Erreur lors de l\'exécution du workflow',
      message: error.message
    });
  }
});

/**
 * @swagger
 * /api/workflows/{id}/execute:
 *   post:
 *     summary: Exécuter un workflow spécifique par son ID
 *     tags: [Workflows]
 *     security:
 *       - ApiKey: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID du workflow à exécuter
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               data:
 *                 type: object
 *                 description: Données d'entrée pour le workflow
 *     responses:
 *       200:
 *         description: Résultat de l'exécution du workflow
 *       400:
 *         description: Données invalides
 *       404:
 *         description: Workflow non trouvé
 *       500:
 *         description: Erreur serveur
 */
router.post('/:id/execute', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    
    if (isNaN(id)) {
      return res.status(400).json({ error: 'ID de workflow invalide' });
    }
    
    // Récupérer le workflow
    const workflow = await workflowService.getWorkflowById(id);
    
    if (!workflow) {
      return res.status(404).json({ error: 'Workflow non trouvé' });
    }
    
    // S'assurer que le workflow est actif
    if (!workflow.is_active) {
      return res.status(400).json({ 
        error: 'Ce workflow est inactif',
        workflow_id: id
      });
    }
    
    // Obtenir l'ID de l'application depuis le workflow
    const applicationId = workflow.application_id;
    
    // Exécuter le workflow avec les données fournies
    const result = await workflowService.executeWorkflow(applicationId, req.body.data || {});
    
    res.json(result);
  } catch (error) {
    console.error(`[API] Erreur lors de l'exécution du workflow ${req.params.id}:`, error);
    res.status(500).json({ 
      error: 'Erreur lors de l\'exécution du workflow',
      message: error.message
    });
  }
});

/**
 * @swagger
 * /api/workflows/{id}/export-template:
 *   get:
 *     summary: Exporter un workflow comme template
 *     tags: [Workflows]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID du workflow à exporter comme template
 *     responses:
 *       200:
 *         description: Template de workflow exporté
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *       401:
 *         description: Non autorisé
 *       404:
 *         description: Workflow non trouvé
 *       500:
 *         description: Erreur serveur
 */
router.get('/:id/export-template', jwtAuth({ roles: ['admin'] }), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    
    if (isNaN(id)) {
      return res.status(400).json({ error: 'ID de workflow invalide' });
    }
    
    // Récupérer le workflow
    const workflow = await workflowService.getWorkflowById(id);
    
    if (!workflow) {
      return res.status(404).json({ error: 'Workflow non trouvé' });
    }
    
    // Créer une version template en nettoyant les identifiants spécifiques
    let flowJson;
    try {
      flowJson = JSON.parse(workflow.flow_json);
      
      // Nettoyer les identifiants spécifiques pour en faire un template générique
      // 1. Générer de nouveaux IDs génériques pour les nœuds
      const nodeIdMap = {};
      if (flowJson.nodes) {
        flowJson.nodes.forEach((node, index) => {
          nodeIdMap[node.id] = `template_node_${index + 1}`;
          node.id = nodeIdMap[node.id];
          // Nettoyer les données spécifiques comme les chemins de fichiers absolus, etc.
          if (node.data && node.data.filePath) {
            node.data.filePath = ''; // Réinitialiser les chemins de fichiers
          }
        });
      }
      
      // 2. Mettre à jour les références dans les arêtes
      if (flowJson.edges) {
        flowJson.edges.forEach((edge, index) => {
          edge.id = `template_edge_${index + 1}`;
          edge.source = nodeIdMap[edge.source] || edge.source;
          edge.target = nodeIdMap[edge.target] || edge.target;
        });
      }
    } catch (error) {
      console.error(`[API] Erreur lors du parsing du JSON du workflow pour l'export:`, error);
      return res.status(500).json({ error: 'Format JSON du workflow invalide' });
    }
    
    // Créer l'objet template
    const template = {
      name: workflow.name,
      description: workflow.description,
      category: 'export',
      tags: ['export', 'template'],
      flow: flowJson,
      metadata: {
        exported_from: workflow.id,
        exported_at: new Date().toISOString(),
        version: '1.0'
      }
    };
    
    // Définir les headers pour le téléchargement
    res.setHeader('Content-Disposition', `attachment; filename="${workflow.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_template.json"`);
    res.setHeader('Content-Type', 'application/json');
    
    res.json(template);
  } catch (error) {
    console.error(`[API] Erreur lors de l'export du template:`, error);
    res.status(500).json({ error: 'Erreur lors de l\'export du template' });
  }
});

/**
 * @swagger
 * /api/workflows/import-template:
 *   post:
 *     summary: Importer un workflow depuis un template
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
 *               - template
 *             properties:
 *               application_id:
 *                 type: integer
 *                 description: ID de l'application pour laquelle créer le workflow
 *               name:
 *                 type: string
 *                 description: Nom du nouveau workflow (optionnel, sinon utilise le nom du template)
 *               description:
 *                 type: string
 *                 description: Description du nouveau workflow (optionnel)
 *               template:
 *                 type: object
 *                 description: Template de workflow à importer
 *     responses:
 *       201:
 *         description: Workflow importé avec succès
 *       400:
 *         description: Données invalides
 *       401:
 *         description: Non autorisé
 *       500:
 *         description: Erreur serveur
 */
router.post('/import-template', jwtAuth({ roles: ['admin'] }), async (req, res) => {
  try {
    const { application_id, name, description, template } = req.body;
    
    if (!application_id || !template || !template.flow) {
      return res.status(400).json({ error: 'L\'ID de l\'application et le template complet sont obligatoires' });
    }
    
    // Convertir les identifiants de template en identifiants uniques
    const flowJson = template.flow;
    
    // 1. Générer de nouveaux IDs uniques pour les nœuds
    const nodeIdMap = {};
    if (flowJson.nodes) {
      flowJson.nodes.forEach((node, index) => {
        const oldId = node.id;
        const newId = `node_${Date.now()}_${index}`;
        nodeIdMap[oldId] = newId;
        node.id = newId;
      });
    }
    
    // 2. Mettre à jour les références dans les arêtes
    if (flowJson.edges) {
      flowJson.edges.forEach((edge, index) => {
        edge.id = `edge_${Date.now()}_${index}`;
        edge.source = nodeIdMap[edge.source] || edge.source;
        edge.target = nodeIdMap[edge.target] || edge.target;
      });
    }
    
    // Préparer les données du workflow
    const workflowData = {
      application_id: application_id,
      name: name || template.name || `Template importé ${new Date().toLocaleString()}`,
      description: description || template.description || '',
      is_active: 1,
      flow_json: JSON.stringify(flowJson)
    };
    
    // Créer le nouveau workflow
    const newWorkflow = await workflowService.createWorkflow(workflowData);
    
    res.status(201).json({
      success: true,
      message: 'Template importé avec succès',
      workflow: newWorkflow
    });
  } catch (error) {
    console.error(`[API] Erreur lors de l'import du template:`, error);
    res.status(500).json({ error: 'Erreur lors de l\'import du template' });
  }
});

module.exports = router;