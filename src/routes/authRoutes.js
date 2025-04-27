/**
 * Routes API d'authentification pour FHIRHub
 * Gère l'authentification et la gestion des utilisateurs
 */

const express = require('express');
const router = express.Router();
const authService = require('../services/authService');

// Route pour l'authentification (login)
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ error: 'Nom d\'utilisateur et mot de passe requis' });
    }
    
    const result = await authService.authenticateUser(username, password);
    res.json(result);
  } catch (error) {
    console.error('Erreur lors de l\'authentification:', error);
    res.status(401).json({ error: error.message });
  }
});

// Route pour créer un nouvel utilisateur (admin uniquement)
router.post('/users', authService.requireAdmin, async (req, res) => {
  try {
    const { username, password, fullname, email, role } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ error: 'Nom d\'utilisateur et mot de passe requis' });
    }
    
    const newUser = await authService.createUser({ username, password, fullname, email, role });
    res.status(201).json(newUser);
  } catch (error) {
    console.error('Erreur lors de la création de l\'utilisateur:', error);
    res.status(400).json({ error: error.message });
  }
});

// Route pour obtenir la liste des utilisateurs (admin uniquement)
router.get('/users', authService.requireAdmin, (req, res) => {
  try {
    const users = authService.listUsers();
    res.json(users);
  } catch (error) {
    console.error('Erreur lors de la récupération des utilisateurs:', error);
    res.status(500).json({ error: error.message });
  }
});

// Route pour obtenir les informations de l'utilisateur connecté
router.get('/me', authService.requireAuth, (req, res) => {
  try {
    const userId = req.user.userId;
    const user = authService.getUserById(userId);
    
    if (!user) {
      return res.status(404).json({ error: 'Utilisateur non trouvé' });
    }
    
    // Ne pas renvoyer le mot de passe
    const { password, ...userWithoutPassword } = user;
    
    res.json(userWithoutPassword);
  } catch (error) {
    console.error('Erreur lors de la récupération de l\'utilisateur:', error);
    res.status(500).json({ error: error.message });
  }
});

// Route pour mettre à jour un utilisateur
router.put('/users/:id', authService.requireAuth, (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    const requesterId = req.user.userId;
    
    // Vérifier les permissions: seul un administrateur peut modifier un autre utilisateur
    if (userId !== requesterId && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Action non autorisée' });
    }
    
    // Interdire à un utilisateur de changer son propre rôle
    if (userId === requesterId && req.body.role && req.body.role !== req.user.role) {
      return res.status(403).json({ error: 'Vous ne pouvez pas changer votre propre rôle' });
    }
    
    const updatedUser = authService.updateUser(userId, req.body);
    res.json(updatedUser);
  } catch (error) {
    console.error('Erreur lors de la mise à jour de l\'utilisateur:', error);
    res.status(400).json({ error: error.message });
  }
});

// Route pour changer son propre mot de passe
router.post('/change-password', authService.requireAuth, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { currentPassword, newPassword } = req.body;
    
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Mot de passe actuel et nouveau mot de passe requis' });
    }
    
    const result = await authService.changePassword(userId, currentPassword, newPassword);
    
    if (result) {
      res.json({ message: 'Mot de passe changé avec succès' });
    } else {
      res.status(400).json({ error: 'Échec du changement de mot de passe' });
    }
  } catch (error) {
    console.error('Erreur lors du changement de mot de passe:', error);
    res.status(400).json({ error: error.message });
  }
});

// Route pour réinitialiser le mot de passe d'un utilisateur (admin uniquement)
router.post('/reset-password/:id', authService.requireAdmin, async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    const { newPassword } = req.body;
    
    if (!newPassword) {
      return res.status(400).json({ error: 'Nouveau mot de passe requis' });
    }
    
    const result = await authService.resetPassword(userId, newPassword);
    
    if (result) {
      res.json({ message: 'Mot de passe réinitialisé avec succès' });
    } else {
      res.status(400).json({ error: 'Échec de la réinitialisation du mot de passe' });
    }
  } catch (error) {
    console.error('Erreur lors de la réinitialisation du mot de passe:', error);
    res.status(400).json({ error: error.message });
  }
});

// Route pour supprimer un utilisateur (admin uniquement)
router.delete('/users/:id', authService.requireAdmin, (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    const requesterId = req.user.userId;
    
    // Empêcher l'auto-suppression
    if (userId === requesterId) {
      return res.status(400).json({ error: 'Vous ne pouvez pas supprimer votre propre compte' });
    }
    
    const result = authService.deleteUser(userId);
    
    if (result) {
      res.json({ message: 'Utilisateur supprimé avec succès' });
    } else {
      res.status(404).json({ error: 'Utilisateur non trouvé' });
    }
  } catch (error) {
    console.error('Erreur lors de la suppression de l\'utilisateur:', error);
    res.status(500).json({ error: error.message });
  }
});

// Route pour vérifier la validité d'un token
router.get('/verify-token', (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.json({ valid: false });
    }
    
    const token = authHeader.split(' ')[1];
    const decoded = authService.verifyToken(token);
    
    res.json({
      valid: true,
      userId: decoded.userId,
      username: decoded.username,
      role: decoded.role
    });
  } catch (error) {
    res.json({ valid: false });
  }
});

// Export du routeur
module.exports = router;