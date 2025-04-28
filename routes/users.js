/**
 * Routes pour la gestion des utilisateurs
 */
const express = require('express');
const router = express.Router();
const apiKeyAuth = require('../middleware/apiKeyAuth');

/**
 * @swagger
 * tags:
 *   name: Utilisateurs
 *   description: Gestion des utilisateurs
 */

/**
 * @swagger
 * /api/users:
 *   get:
 *     summary: Récupérer tous les utilisateurs
 *     description: Récupère la liste de tous les utilisateurs (admin uniquement)
 *     tags: [Utilisateurs]
 *     security:
 *       - ApiKeyAuth: []
 *     responses:
 *       200:
 *         description: Liste des utilisateurs récupérée avec succès
 *       401:
 *         description: Non autorisé
 *       500:
 *         description: Erreur serveur
 */
router.get('/', apiKeyAuth(), (req, res) => {
  try {
    const db = req.app.locals.db;
    
    // Récupérer tous les utilisateurs sans leur mot de passe
    const users = db.prepare(`
      SELECT id, username, role, created_at 
      FROM users
      ORDER BY username ASC
    `).all();
    
    res.json({
      success: true,
      data: users
    });
  } catch (error) {
    console.error('[USERS ERROR]', error);
    
    res.status(500).json({
      success: false,
      error: 'Server Error',
      message: error.message || 'Erreur lors de la récupération des utilisateurs'
    });
  }
});

/**
 * @swagger
 * /api/users/{id}:
 *   get:
 *     summary: Récupérer un utilisateur par son ID
 *     description: Récupère les détails d'un utilisateur spécifique
 *     tags: [Utilisateurs]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: integer
 *         required: true
 *         description: ID de l'utilisateur
 *     responses:
 *       200:
 *         description: Détails de l'utilisateur récupérés avec succès
 *       404:
 *         description: Utilisateur non trouvé
 *       500:
 *         description: Erreur serveur
 */
router.get('/:id', apiKeyAuth(), (req, res) => {
  try {
    const { id } = req.params;
    const db = req.app.locals.db;
    
    const user = db.prepare(`
      SELECT id, username, role, created_at 
      FROM users
      WHERE id = ?
    `).get(id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Utilisateur non trouvé'
      });
    }
    
    res.json({
      success: true,
      data: user
    });
  } catch (error) {
    console.error('[USERS ERROR]', error);
    
    res.status(500).json({
      success: false,
      error: 'Server Error',
      message: error.message || 'Erreur lors de la récupération de l\'utilisateur'
    });
  }
});

/**
 * @swagger
 * /api/users:
 *   post:
 *     summary: Créer un nouvel utilisateur
 *     description: Crée un nouvel utilisateur avec les paramètres fournis (admin uniquement)
 *     tags: [Utilisateurs]
 *     security:
 *       - ApiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *               - password
 *               - role
 *             properties:
 *               username:
 *                 type: string
 *               password:
 *                 type: string
 *               role:
 *                 type: string
 *                 enum: [admin, user]
 *     responses:
 *       201:
 *         description: Utilisateur créé avec succès
 *       400:
 *         description: Requête invalide
 *       500:
 *         description: Erreur serveur
 */
router.post('/', apiKeyAuth(), (req, res) => {
  try {
    const { username, password, role } = req.body;
    
    if (!username || !password || !role) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Nom d\'utilisateur, mot de passe et rôle sont requis'
      });
    }
    
    // Vérifier que le rôle est valide
    if (role !== 'admin' && role !== 'user') {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Le rôle doit être "admin" ou "user"'
      });
    }
    
    const db = req.app.locals.db;
    
    // Vérifier si l'utilisateur existe déjà
    const existingUser = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
    
    if (existingUser) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Ce nom d\'utilisateur existe déjà'
      });
    }
    
    // Hacher le mot de passe
    const hashedPassword = hashPassword(password);
    
    // Insérer l'utilisateur
    const result = db.prepare(`
      INSERT INTO users (username, password, role, created_at)
      VALUES (?, ?, ?, datetime('now'))
    `).run(username, hashedPassword, role);
    
    // Récupérer l'utilisateur créé sans le mot de passe
    const createdUser = db.prepare(`
      SELECT id, username, role, created_at 
      FROM users 
      WHERE id = ?
    `).get(result.lastInsertRowid);
    
    res.status(201).json({
      success: true,
      data: createdUser
    });
  } catch (error) {
    console.error('[USERS ERROR]', error);
    
    res.status(500).json({
      success: false,
      error: 'Server Error',
      message: error.message || 'Erreur lors de la création de l\'utilisateur'
    });
  }
});

/**
 * @swagger
 * /api/users/{id}/change-password:
 *   post:
 *     summary: Changer le mot de passe d'un utilisateur
 *     description: Change le mot de passe d'un utilisateur (admin uniquement ou l'utilisateur lui-même)
 *     tags: [Utilisateurs]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: integer
 *         required: true
 *         description: ID de l'utilisateur
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - password
 *             properties:
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Mot de passe changé avec succès
 *       404:
 *         description: Utilisateur non trouvé
 *       500:
 *         description: Erreur serveur
 */
router.post('/:id/change-password', apiKeyAuth(), (req, res) => {
  try {
    const { id } = req.params;
    const { password } = req.body;
    
    if (!password) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Le mot de passe est requis'
      });
    }
    
    const db = req.app.locals.db;
    
    // Vérifier si l'utilisateur existe
    const user = db.prepare('SELECT id FROM users WHERE id = ?').get(id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Utilisateur non trouvé'
      });
    }
    
    // Hacher le nouveau mot de passe
    const hashedPassword = hashPassword(password);
    
    // Mettre à jour le mot de passe
    db.prepare(`
      UPDATE users
      SET password = ?
      WHERE id = ?
    `).run(hashedPassword, id);
    
    res.json({
      success: true,
      message: 'Mot de passe changé avec succès'
    });
  } catch (error) {
    console.error('[USERS ERROR]', error);
    
    res.status(500).json({
      success: false,
      error: 'Server Error',
      message: error.message || 'Erreur lors du changement de mot de passe'
    });
  }
});

/**
 * @swagger
 * /api/users/{id}:
 *   delete:
 *     summary: Supprimer un utilisateur
 *     description: Supprime un utilisateur (admin uniquement, ne peut pas supprimer le dernier admin)
 *     tags: [Utilisateurs]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: integer
 *         required: true
 *         description: ID de l'utilisateur
 *     responses:
 *       200:
 *         description: Utilisateur supprimé avec succès
 *       404:
 *         description: Utilisateur non trouvé
 *       500:
 *         description: Erreur serveur
 */
router.delete('/:id', apiKeyAuth(), (req, res) => {
  try {
    const { id } = req.params;
    const db = req.app.locals.db;
    
    // Vérifier si l'utilisateur existe
    const user = db.prepare('SELECT id, role FROM users WHERE id = ?').get(id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Utilisateur non trouvé'
      });
    }
    
    // Si l'utilisateur est un admin, vérifier qu'il n'est pas le dernier
    if (user.role === 'admin') {
      const adminCount = db.prepare('SELECT COUNT(*) as count FROM users WHERE role = ?').get('admin');
      
      if (adminCount.count <= 1) {
        return res.status(400).json({
          success: false,
          error: 'Bad Request',
          message: 'Impossible de supprimer le dernier administrateur'
        });
      }
    }
    
    // Supprimer l'utilisateur
    db.prepare('DELETE FROM users WHERE id = ?').run(id);
    
    res.json({
      success: true,
      message: 'Utilisateur supprimé avec succès'
    });
  } catch (error) {
    console.error('[USERS ERROR]', error);
    
    res.status(500).json({
      success: false,
      error: 'Server Error',
      message: error.message || 'Erreur lors de la suppression de l\'utilisateur'
    });
  }
});

// Fonction pour hacher un mot de passe
function hashPassword(password) {
  const crypto = require('crypto');
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

module.exports = router;