/**
 * Router pour la gestion des applications
 * Gère les routes liées aux applications qui utilisent les clés API
 */

const express = require('express');
const router = express.Router();
const applicationService = require('../services/applicationService');
const { isAuthenticated, isAdmin } = require('../middleware/authMiddleware');

// Middleware d'authentification
router.use(isAuthenticated);

/**
 * GET /api/applications
 * Obtenir toutes les applications de l'utilisateur
 */
router.get('/', async (req, res) => {
  try {
    let applications;
    
    if (req.user.role === 'admin') {
      applications = await applicationService.getAllApplications();
    } else {
      applications = await applicationService.getUserApplications(req.user.id);
    }
    
    res.json({
      success: true,
      data: applications
    });
  } catch (error) {
    console.error('[APPLICATION-ROUTER] Erreur lors de la récupération des applications:', error);
    
    res.status(500).json({
      success: false,
      error: 'Erreur serveur',
      message: 'Une erreur est survenue lors de la récupération des applications'
    });
  }
});

/**
 * GET /api/applications/:id
 * Obtenir les détails d'une application
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const application = await applicationService.getApplication(parseInt(id));
    
    if (!application) {
      return res.status(404).json({
        success: false,
        error: 'Application non trouvée',
        message: `L'application avec l'ID ${id} n'a pas été trouvée`
      });
    }
    
    // Vérifier si l'utilisateur a accès à cette application
    const hasAccess = application.owner_id === req.user.id || req.user.role === 'admin';
    
    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        error: 'Accès refusé',
        message: 'Vous n\'avez pas accès à cette application'
      });
    }
    
    res.json({
      success: true,
      data: application
    });
  } catch (error) {
    console.error('[APPLICATION-ROUTER] Erreur lors de la récupération des détails de l\'application:', error);
    
    res.status(500).json({
      success: false,
      error: 'Erreur serveur',
      message: 'Une erreur est survenue lors de la récupération des détails de l\'application'
    });
  }
});

/**
 * POST /api/applications
 * Créer une nouvelle application
 */
router.post('/', async (req, res) => {
  try {
    const { name, description } = req.body;
    
    if (!name) {
      return res.status(400).json({
        success: false,
        error: 'Paramètre manquant',
        message: 'Le paramètre name est requis'
      });
    }
    
    const application = await applicationService.createApplication({
      name,
      description: description || '',
      owner_id: req.user.id,
      status: 'active'
    });
    
    res.status(201).json({
      success: true,
      data: application,
      message: 'Application créée avec succès'
    });
  } catch (error) {
    console.error('[APPLICATION-ROUTER] Erreur lors de la création de l\'application:', error);
    
    res.status(500).json({
      success: false,
      error: 'Erreur serveur',
      message: 'Une erreur est survenue lors de la création de l\'application'
    });
  }
});

/**
 * PUT /api/applications/:id
 * Mettre à jour une application
 */
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, status } = req.body;
    
    // Récupérer l'application
    const application = await applicationService.getApplication(parseInt(id));
    
    if (!application) {
      return res.status(404).json({
        success: false,
        error: 'Application non trouvée',
        message: `L'application avec l'ID ${id} n'a pas été trouvée`
      });
    }
    
    // Vérifier si l'utilisateur a accès à cette application
    const hasAccess = application.owner_id === req.user.id || req.user.role === 'admin';
    
    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        error: 'Accès refusé',
        message: 'Vous n\'avez pas accès à cette application'
      });
    }
    
    // Seuls les administrateurs peuvent changer le statut
    if (status && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Accès refusé',
        message: 'Seuls les administrateurs peuvent changer le statut d\'une application'
      });
    }
    
    // Mettre à jour l'application
    const updatedApplication = await applicationService.updateApplication(parseInt(id), {
      name,
      description,
      status
    });
    
    res.json({
      success: true,
      data: updatedApplication,
      message: 'Application mise à jour avec succès'
    });
  } catch (error) {
    console.error('[APPLICATION-ROUTER] Erreur lors de la mise à jour de l\'application:', error);
    
    res.status(500).json({
      success: false,
      error: 'Erreur serveur',
      message: 'Une erreur est survenue lors de la mise à jour de l\'application'
    });
  }
});

/**
 * DELETE /api/applications/:id
 * Supprimer une application
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Récupérer l'application
    const application = await applicationService.getApplication(parseInt(id));
    
    if (!application) {
      return res.status(404).json({
        success: false,
        error: 'Application non trouvée',
        message: `L'application avec l'ID ${id} n'a pas été trouvée`
      });
    }
    
    // Vérifier si l'utilisateur a accès à cette application
    const hasAccess = application.owner_id === req.user.id || req.user.role === 'admin';
    
    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        error: 'Accès refusé',
        message: 'Vous n\'avez pas accès à cette application'
      });
    }
    
    // Supprimer l'application
    const success = await applicationService.deleteApplication(parseInt(id));
    
    if (!success) {
      return res.status(500).json({
        success: false,
        error: 'Erreur de suppression',
        message: 'Une erreur est survenue lors de la suppression de l\'application'
      });
    }
    
    res.json({
      success: true,
      message: 'Application supprimée avec succès'
    });
  } catch (error) {
    console.error('[APPLICATION-ROUTER] Erreur lors de la suppression de l\'application:', error);
    
    res.status(500).json({
      success: false,
      error: 'Erreur serveur',
      message: 'Une erreur est survenue lors de la suppression de l\'application'
    });
  }
});

/**
 * GET /api/applications/:id/stats
 * Obtenir les statistiques d'une application
 */
router.get('/:id/stats', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Récupérer l'application
    const application = await applicationService.getApplication(parseInt(id));
    
    if (!application) {
      return res.status(404).json({
        success: false,
        error: 'Application non trouvée',
        message: `L'application avec l'ID ${id} n'a pas été trouvée`
      });
    }
    
    // Vérifier si l'utilisateur a accès à cette application
    const hasAccess = application.owner_id === req.user.id || req.user.role === 'admin';
    
    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        error: 'Accès refusé',
        message: 'Vous n\'avez pas accès à cette application'
      });
    }
    
    // Récupérer les statistiques de l'application
    const stats = await applicationService.getApplicationStats(parseInt(id));
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('[APPLICATION-ROUTER] Erreur lors de la récupération des statistiques de l\'application:', error);
    
    res.status(500).json({
      success: false,
      error: 'Erreur serveur',
      message: 'Une erreur est survenue lors de la récupération des statistiques de l\'application'
    });
  }
});

module.exports = router;