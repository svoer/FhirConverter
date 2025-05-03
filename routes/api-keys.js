/**
 * Routes pour la gestion des clés API
 */
const express = require('express');
const router = express.Router();
const authCombined = require('../middleware/authCombined');

/**
 * @swagger
 * tags:
 *   name: API Keys
 *   description: Gestion des clés API
 */

/**
 * @swagger
 * /api/api-keys:
 *   get:
 *     summary: Récupérer toutes les clés API
 *     description: Récupère la liste de toutes les clés API
 *     tags: [API Keys]
 *     security:
 *       - ApiKeyAuth: []
 *     responses:
 *       200:
 *         description: Liste des clés API récupérée avec succès
 *       401:
 *         description: Non autorisé
 *       500:
 *         description: Erreur serveur
 */
router.get('/', authCombined, (req, res) => {
  try {
    const db = req.app.locals.db;
    
    const apiKeys = db.prepare(`
      SELECT ak.*, a.name as application_name
      FROM api_keys ak
      JOIN applications a ON ak.application_id = a.id
      ORDER BY ak.created_at DESC
    `).all();
    
    res.json({
      success: true,
      data: apiKeys
    });
  } catch (error) {
    console.error('[API KEYS ERROR]', error);
    
    res.status(500).json({
      success: false,
      error: 'Server Error',
      message: error.message || 'Erreur lors de la récupération des clés API'
    });
  }
});

/**
 * @swagger
 * /api/api-keys/{id}:
 *   get:
 *     summary: Récupérer une clé API par son ID
 *     description: Récupère les détails d'une clé API spécifique
 *     tags: [API Keys]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: integer
 *         required: true
 *         description: ID de la clé API
 *     responses:
 *       200:
 *         description: Détails de la clé API récupérés avec succès
 *       404:
 *         description: Clé API non trouvée
 *       500:
 *         description: Erreur serveur
 */
router.get('/:id', authCombined, (req, res) => {
  try {
    const { id } = req.params;
    const db = req.app.locals.db;
    
    const apiKey = db.prepare(`
      SELECT ak.*, a.name as application_name
      FROM api_keys ak
      JOIN applications a ON ak.application_id = a.id
      WHERE ak.id = ?
    `).get(id);
    
    if (!apiKey) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Clé API non trouvée'
      });
    }
    
    res.json({
      success: true,
      data: apiKey
    });
  } catch (error) {
    console.error('[API KEYS ERROR]', error);
    
    res.status(500).json({
      success: false,
      error: 'Server Error',
      message: error.message || 'Erreur lors de la récupération de la clé API'
    });
  }
});

/**
 * @swagger
 * /api/api-keys:
 *   post:
 *     summary: Créer une nouvelle clé API
 *     description: Crée une nouvelle clé API pour une application
 *     tags: [API Keys]
 *     security:
 *       - ApiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - application_id
 *             properties:
 *               application_id:
 *                 type: integer
 *               description:
 *                 type: string
 *               expires_at:
 *                 type: string
 *                 format: date-time
 *               custom_key:
 *                 type: string
 *                 description: Clé API personnalisée (sinon une clé sera générée automatiquement)
 *     responses:
 *       201:
 *         description: Clé API créée avec succès
 *       400:
 *         description: Requête invalide
 *       500:
 *         description: Erreur serveur
 */
router.post('/', authCombined, (req, res) => {
  try {
    const { application_id, description, expires_at, custom_key } = req.body;
    
    if (!application_id) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'L\'ID de l\'application est requis'
      });
    }
    
    const db = req.app.locals.db;
    
    // Vérifier si l'application existe
    const application = db.prepare('SELECT id FROM applications WHERE id = ?').get(application_id);
    
    if (!application) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Application non trouvée'
      });
    }
    
    // Générer ou utiliser la clé API fournie
    const apiKey = custom_key || require('crypto').randomBytes(32).toString('hex');
    
    // Hacher la clé API pour le stockage
    const hashedKey = require('crypto').createHash('sha256').update(apiKey).digest('hex');
    
    // Insérer la clé API
    const result = db.prepare(`
      INSERT INTO api_keys (
        application_id, key, hashed_key, description, expires_at, created_at
      ) VALUES (?, ?, ?, ?, ?, datetime('now'))
    `).run(
      application_id,
      apiKey,
      hashedKey,
      description || null,
      expires_at || null
    );
    
    // Récupérer la clé API créée
    const createdApiKey = db.prepare(`
      SELECT ak.*, a.name as application_name
      FROM api_keys ak
      JOIN applications a ON ak.application_id = a.id
      WHERE ak.id = ?
    `).get(result.lastInsertRowid);
    
    res.status(201).json({
      success: true,
      data: createdApiKey
    });
  } catch (error) {
    console.error('[API KEYS ERROR]', error);
    
    res.status(500).json({
      success: false,
      error: 'Server Error',
      message: error.message || 'Erreur lors de la création de la clé API'
    });
  }
});

/**
 * @swagger
 * /api/api-keys/{id}/revoke:
 *   post:
 *     summary: Révoquer une clé API
 *     description: Désactive une clé API existante
 *     tags: [API Keys]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: integer
 *         required: true
 *         description: ID de la clé API
 *     responses:
 *       200:
 *         description: Clé API révoquée avec succès
 *       404:
 *         description: Clé API non trouvée
 *       500:
 *         description: Erreur serveur
 */
router.post('/:id/revoke', authCombined, (req, res) => {
  try {
    const { id } = req.params;
    const db = req.app.locals.db;
    
    // Vérifier si la clé API existe
    const apiKey = db.prepare('SELECT * FROM api_keys WHERE id = ?').get(id);
    
    if (!apiKey) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Clé API non trouvée'
      });
    }
    
    // Révoquer la clé API
    db.prepare(`
      UPDATE api_keys
      SET is_active = 0
      WHERE id = ?
    `).run(id);
    
    res.json({
      success: true,
      message: 'Clé API révoquée avec succès'
    });
  } catch (error) {
    console.error('[API KEYS ERROR]', error);
    
    res.status(500).json({
      success: false,
      error: 'Server Error',
      message: error.message || 'Erreur lors de la révocation de la clé API'
    });
  }
});

/**
 * @swagger
 * /api/api-keys/{id}/activate:
 *   post:
 *     summary: Activer une clé API
 *     description: Active une clé API révoquée
 *     tags: [API Keys]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: integer
 *         required: true
 *         description: ID de la clé API
 *     responses:
 *       200:
 *         description: Clé API activée avec succès
 *       404:
 *         description: Clé API non trouvée
 *       500:
 *         description: Erreur serveur
 */
router.post('/:id/activate', authCombined, (req, res) => {
  try {
    const { id } = req.params;
    const db = req.app.locals.db;
    
    // Vérifier si la clé API existe
    const apiKey = db.prepare('SELECT * FROM api_keys WHERE id = ?').get(id);
    
    if (!apiKey) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Clé API non trouvée'
      });
    }
    
    // Activer la clé API
    db.prepare(`
      UPDATE api_keys
      SET is_active = 1
      WHERE id = ?
    `).run(id);
    
    res.json({
      success: true,
      message: 'Clé API activée avec succès'
    });
  } catch (error) {
    console.error('[API KEYS ERROR]', error);
    
    res.status(500).json({
      success: false,
      error: 'Server Error',
      message: error.message || 'Erreur lors de l\'activation de la clé API'
    });
  }
});

/**
 * @swagger
 * /api/api-keys/{id}:
 *   put:
 *     summary: Mettre à jour une clé API
 *     description: Met à jour les détails d'une clé API existante
 *     tags: [API Keys]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: integer
 *         required: true
 *         description: ID de la clé API
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               application_id:
 *                 type: integer
 *               description:
 *                 type: string
 *               is_active:
 *                 type: boolean
 *               expires_at:
 *                 type: string
 *                 format: date-time
 *     responses:
 *       200:
 *         description: Clé API mise à jour avec succès
 *       400:
 *         description: Requête invalide
 *       404:
 *         description: Clé API non trouvée
 *       500:
 *         description: Erreur serveur
 */

/**
 * @swagger
 * /api/api-keys/{id}:
 *   delete:
 *     summary: Supprimer une clé API
 *     description: Supprime définitivement une clé API
 *     tags: [API Keys]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: integer
 *         required: true
 *         description: ID de la clé API
 *     responses:
 *       200:
 *         description: Clé API supprimée avec succès
 *       404:
 *         description: Clé API non trouvée
 *       500:
 *         description: Erreur serveur
 */
router.delete('/:id', authCombined, (req, res) => {
  try {
    const { id } = req.params;
    const db = req.app.locals.db;
    
    // Vérifier si la clé API existe
    const apiKey = db.prepare('SELECT * FROM api_keys WHERE id = ?').get(id);
    
    if (!apiKey) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Clé API non trouvée'
      });
    }
    
    // Supprimer la clé API
    db.prepare('DELETE FROM api_keys WHERE id = ?').run(id);
    
    res.json({
      success: true,
      message: 'Clé API supprimée avec succès'
    });
  } catch (error) {
    console.error('[API KEYS ERROR]', error);
    
    res.status(500).json({
      success: false,
      error: 'Server Error',
      message: error.message || 'Erreur lors de la suppression de la clé API'
    });
  }
});

/**
 * Mettre à jour une clé API
 */
router.put('/:id', authCombined, (req, res) => {
  try {
    const { id } = req.params;
    const { application_id, description, is_active, expires_at } = req.body;
    const db = req.app.locals.db;
    
    // Vérifier si la clé API existe
    const apiKey = db.prepare('SELECT * FROM api_keys WHERE id = ?').get(id);
    
    if (!apiKey) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Clé API non trouvée'
      });
    }
    
    // Préparer les champs à mettre à jour
    const updates = [];
    const params = [];
    
    if (application_id !== undefined) {
      // Vérifier si l'application existe
      const application = db.prepare('SELECT id FROM applications WHERE id = ?').get(application_id);
      
      if (!application) {
        return res.status(400).json({
          success: false,
          error: 'Bad Request',
          message: 'Application non trouvée'
        });
      }
      
      updates.push('application_id = ?');
      params.push(application_id);
    }
    
    if (description !== undefined) {
      updates.push('description = ?');
      params.push(description || null);
    }
    
    if (is_active !== undefined) {
      updates.push('is_active = ?');
      params.push(is_active ? 1 : 0);
    }
    
    if (expires_at !== undefined) {
      updates.push('expires_at = ?');
      params.push(expires_at || null);
    }
    
    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Aucun champ à mettre à jour'
      });
    }
    
    // Ajouter l'ID pour la clause WHERE
    params.push(id);
    
    // Mettre à jour la clé API
    db.prepare(`
      UPDATE api_keys
      SET ${updates.join(', ')}
      WHERE id = ?
    `).run(...params);
    
    // Récupérer la clé API mise à jour
    const updatedApiKey = db.prepare(`
      SELECT ak.*, a.name as application_name
      FROM api_keys ak
      JOIN applications a ON ak.application_id = a.id
      WHERE ak.id = ?
    `).get(id);
    
    res.json({
      success: true,
      data: updatedApiKey,
      message: 'Clé API mise à jour avec succès'
    });
  } catch (error) {
    console.error('[API KEYS ERROR]', error);
    
    res.status(500).json({
      success: false,
      error: 'Server Error',
      message: error.message || 'Erreur lors de la mise à jour de la clé API'
    });
  }
});

module.exports = router;