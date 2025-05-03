/**
 * Routes pour la gestion des utilisateurs
 * @module routes/users
 */
const express = require('express');
const router = express.Router();
const jwtAuth = require('../middleware/jwtAuth');
const apiKeyAuth = require('../middleware/apiKeyAuth');
const authCombined = require('../middleware/authCombined');

// Fonctions utilitaires
const { hashPassword, verifyPassword } = require('../utils/auth');

/**
 * @swagger
 * /api/users:
 *   get:
 *     summary: Récupérer tous les utilisateurs
 *     description: Permet de récupérer la liste de tous les utilisateurs (réservé aux administrateurs)
 *     tags:
 *       - Utilisateurs
 *     security:
 *       - bearerAuth: []
 *       - apiKeyAuth: []
 *     responses:
 *       200:
 *         description: Liste des utilisateurs récupérée avec succès
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
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                       username:
 *                         type: string
 *                       role:
 *                         type: string
 *                       created_at:
 *                         type: string
 *                         format: date-time
 *       401:
 *         description: Non autorisé
 *       403:
 *         description: Accès refusé
 */
router.get('/', authCombined, async (req, res) => {
  try {
    // Vérifier si l'utilisateur est authentifié
    if (req.user) {
      // Vérifier si l'utilisateur est admin
      if (req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Accès refusé. Vous devez être administrateur pour effectuer cette action.'
        });
      }
    } else {
      return res.status(401).json({
        success: false,
        message: 'Authentification requise.'
      });
    }
    
    const db = req.app.locals.db;
    const users = db.prepare('SELECT id, username, role, created_at FROM users').all();
    
    res.json({
      success: true,
      data: users
    });
  } catch (error) {
    console.error('[USERS ERROR]', error);
    
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des utilisateurs'
    });
  }
});

/**
 * @swagger
 * /api/users/{id}:
 *   get:
 *     summary: Récupérer un utilisateur par son ID
 *     description: Permet de récupérer les détails d'un utilisateur spécifique (réservé aux administrateurs)
 *     tags:
 *       - Utilisateurs
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID de l'utilisateur
 *     security:
 *       - bearerAuth: []
 *       - apiKeyAuth: []
 *     responses:
 *       200:
 *         description: Utilisateur récupéré avec succès
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
 *                   properties:
 *                     id:
 *                       type: integer
 *                     username:
 *                       type: string
 *                     role:
 *                       type: string
 *                     created_at:
 *                       type: string
 *                       format: date-time
 *       401:
 *         description: Non autorisé
 *       403:
 *         description: Accès refusé
 *       404:
 *         description: Utilisateur non trouvé
 */
router.get('/:id', authCombined, async (req, res) => {
  try {
    // Vérifier si l'utilisateur est authentifié
    if (req.user) {
      // Vérifier si l'utilisateur est admin ou c'est son propre profil
      if (req.user.role !== 'admin' && req.user.id !== parseInt(req.params.id)) {
        return res.status(403).json({
          success: false,
          message: 'Accès refusé. Vous ne pouvez accéder qu\'à votre propre profil.'
        });
      }
    } else {
      return res.status(401).json({
        success: false,
        message: 'Authentification requise.'
      });
    }
    
    const db = req.app.locals.db;
    const user = db.prepare('SELECT id, username, role, created_at FROM users WHERE id = ?').get(req.params.id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
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
      message: 'Erreur lors de la récupération de l\'utilisateur'
    });
  }
});

/**
 * @swagger
 * /api/users:
 *   post:
 *     summary: Créer un nouvel utilisateur
 *     description: Permet de créer un nouvel utilisateur (réservé aux administrateurs)
 *     tags:
 *       - Utilisateurs
 *     security:
 *       - bearerAuth: []
 *       - apiKeyAuth: []
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
 *                 description: Nom d'utilisateur
 *               password:
 *                 type: string
 *                 description: Mot de passe
 *               role:
 *                 type: string
 *                 enum: [admin, user]
 *                 description: Rôle de l'utilisateur
 *     responses:
 *       201:
 *         description: Utilisateur créé avec succès
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
 *                   properties:
 *                     id:
 *                       type: integer
 *                     username:
 *                       type: string
 *                     role:
 *                       type: string
 *                     created_at:
 *                       type: string
 *                       format: date-time
 *       400:
 *         description: Requête invalide
 *       401:
 *         description: Non autorisé
 *       403:
 *         description: Accès refusé
 *       409:
 *         description: Conflit (nom d'utilisateur déjà utilisé)
 */
router.post('/', authCombined, async (req, res) => {
  try {
    // Vérifier si l'utilisateur est authentifié
    if (req.user) {
      // Vérifier si l'utilisateur est admin
      if (req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Accès refusé. Vous devez être administrateur pour effectuer cette action.'
        });
      }
    } else {
      return res.status(401).json({
        success: false,
        message: 'Authentification requise.'
      });
    }
    
    const { username, password, role } = req.body;
    
    // Validation des données
    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: 'Le nom d\'utilisateur et le mot de passe sont requis'
      });
    }
    
    if (role !== 'admin' && role !== 'user') {
      return res.status(400).json({
        success: false,
        message: 'Le rôle doit être "admin" ou "user"'
      });
    }
    
    const db = req.app.locals.db;
    
    // Vérifier si le nom d'utilisateur existe déjà
    const existingUser = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'Ce nom d\'utilisateur est déjà utilisé'
      });
    }
    
    // Hachage du mot de passe
    const hashedPassword = hashPassword(password);
    
    // Insertion de l'utilisateur
    const result = db.prepare(`
      INSERT INTO users (username, password, role, created_at)
      VALUES (?, ?, ?, datetime('now'))
    `).run(username, hashedPassword, role);
    
    // Récupérer l'utilisateur créé
    const newUser = db.prepare('SELECT id, username, role, created_at FROM users WHERE id = ?').get(result.lastInsertRowid);
    
    res.status(201).json({
      success: true,
      data: newUser
    });
  } catch (error) {
    console.error('[USERS ERROR]', error);
    
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la création de l\'utilisateur'
    });
  }
});

/**
 * @swagger
 * /api/users/{id}:
 *   put:
 *     summary: Mettre à jour un utilisateur
 *     description: Permet de mettre à jour les informations d'un utilisateur (réservé aux administrateurs ou à l'utilisateur lui-même)
 *     tags:
 *       - Utilisateurs
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID de l'utilisateur
 *     security:
 *       - bearerAuth: []
 *       - apiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               username:
 *                 type: string
 *                 description: Nouveau nom d'utilisateur
 *               password:
 *                 type: string
 *                 description: Nouveau mot de passe (optionnel)
 *               role:
 *                 type: string
 *                 enum: [admin, user]
 *                 description: Nouveau rôle (admin uniquement)
 *     responses:
 *       200:
 *         description: Utilisateur mis à jour avec succès
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
 *                   properties:
 *                     id:
 *                       type: integer
 *                     username:
 *                       type: string
 *                     role:
 *                       type: string
 *                     created_at:
 *                       type: string
 *                       format: date-time
 *       400:
 *         description: Requête invalide
 *       401:
 *         description: Non autorisé
 *       403:
 *         description: Accès refusé
 *       404:
 *         description: Utilisateur non trouvé
 *       409:
 *         description: Conflit (nom d'utilisateur déjà utilisé)
 */
router.put('/:id', authCombined, async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    
    // Vérifier si l'utilisateur est authentifié
    if (req.user) {
      // Vérifier si l'utilisateur est admin ou c'est son propre profil
      if (req.user.role !== 'admin' && req.user.id !== userId) {
        return res.status(403).json({
          success: false,
          message: 'Accès refusé. Vous ne pouvez modifier que votre propre profil.'
        });
      }
      
      // Si non-admin, empêcher la modification du rôle
      if (req.user.role !== 'admin' && req.body.role) {
        return res.status(403).json({
          success: false,
          message: 'Accès refusé. Seul un administrateur peut modifier les rôles.'
        });
      }
    } else {
      return res.status(401).json({
        success: false,
        message: 'Authentification requise.'
      });
    }
    
    const { username, password, role } = req.body;
    
    if (!username) {
      return res.status(400).json({
        success: false,
        message: 'Le nom d\'utilisateur est requis'
      });
    }
    
    if (role && role !== 'admin' && role !== 'user') {
      return res.status(400).json({
        success: false,
        message: 'Le rôle doit être "admin" ou "user"'
      });
    }
    
    const db = req.app.locals.db;
    
    // Vérifier si l'utilisateur existe
    const user = db.prepare('SELECT id FROM users WHERE id = ?').get(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Utilisateur non trouvé'
      });
    }
    
    // Vérifier si le nouveau nom d'utilisateur est déjà utilisé par un autre utilisateur
    const existingUser = db.prepare('SELECT id FROM users WHERE username = ? AND id != ?').get(username, userId);
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'Ce nom d\'utilisateur est déjà utilisé'
      });
    }
    
    // Préparer la mise à jour
    let updateFields = [];
    let updateParams = [];
    
    // Nom d'utilisateur
    updateFields.push('username = ?');
    updateParams.push(username);
    
    // Mot de passe (si fourni)
    if (password) {
      updateFields.push('password = ?');
      updateParams.push(hashPassword(password));
    }
    
    // Rôle (si admin)
    if (role && req.user.role === 'admin') {
      updateFields.push('role = ?');
      updateParams.push(role);
    }
    
    // Ajouter l'ID pour la clause WHERE
    updateParams.push(userId);
    
    // Exécuter la mise à jour
    db.prepare(`
      UPDATE users
      SET ${updateFields.join(', ')}
      WHERE id = ?
    `).run(...updateParams);
    
    // Récupérer l'utilisateur mis à jour
    const updatedUser = db.prepare('SELECT id, username, role, created_at FROM users WHERE id = ?').get(userId);
    
    res.json({
      success: true,
      data: updatedUser
    });
  } catch (error) {
    console.error('[USERS ERROR]', error);
    
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la mise à jour de l\'utilisateur'
    });
  }
});

/**
 * @swagger
 * /api/users/{id}:
 *   delete:
 *     summary: Supprimer un utilisateur
 *     description: Permet de supprimer un utilisateur (réservé aux administrateurs)
 *     tags:
 *       - Utilisateurs
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID de l'utilisateur
 *     security:
 *       - bearerAuth: []
 *       - apiKeyAuth: []
 *     responses:
 *       200:
 *         description: Utilisateur supprimé avec succès
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
 *                   example: Utilisateur supprimé avec succès
 *       401:
 *         description: Non autorisé
 *       403:
 *         description: Accès refusé
 *       404:
 *         description: Utilisateur non trouvé
 */
router.delete('/:id', authCombined, async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    
    // Vérifier si l'utilisateur est authentifié
    if (req.user) {
      // Vérifier si l'utilisateur est admin
      if (req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Accès refusé. Vous devez être administrateur pour effectuer cette action.'
        });
      }
      
      // Empêcher la suppression de son propre compte
      if (req.user.id === userId) {
        return res.status(403).json({
          success: false,
          message: 'Vous ne pouvez pas supprimer votre propre compte.'
        });
      }
    } else {
      return res.status(401).json({
        success: false,
        message: 'Authentification requise.'
      });
    }
    
    const db = req.app.locals.db;
    
    // Vérifier si l'utilisateur existe
    const user = db.prepare('SELECT id FROM users WHERE id = ?').get(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Utilisateur non trouvé'
      });
    }
    
    // Supprimer l'utilisateur
    db.prepare('DELETE FROM users WHERE id = ?').run(userId);
    
    res.json({
      success: true,
      message: 'Utilisateur supprimé avec succès'
    });
  } catch (error) {
    console.error('[USERS ERROR]', error);
    
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la suppression de l\'utilisateur'
    });
  }
});

module.exports = router;