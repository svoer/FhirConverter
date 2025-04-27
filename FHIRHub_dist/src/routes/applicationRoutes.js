/**
 * Routes API pour la gestion des applications
 * Permet de créer, modifier et gérer des applications et leurs paramètres
 */

const express = require('express');
const router = express.Router();
const appService = require('../services/applicationService');
const apiKeyService = require('../services/apiKeyService');
const { requireAdmin, requireAuth } = require('../services/authService');

// Route pour créer une nouvelle application (admin uniquement)
router.post('/', requireAdmin, async (req, res) => {
  try {
    // Ajouter l'ID de l'utilisateur créateur
    const appData = {
      ...req.body,
      created_by: req.user.userId
    };
    
    const newApp = appService.createApplication(appData);
    res.status(201).json(newApp);
  } catch (error) {
    console.error('Erreur lors de la création de l\'application:', error);
    res.status(400).json({ error: error.message });
  }
});

// Route pour obtenir la liste des applications
router.get('/', requireAuth, (req, res) => {
  try {
    const options = {
      active: req.query.active === 'true',
      search: req.query.search,
      sortBy: req.query.sortBy || 'name',
      sortOrder: req.query.sortOrder || 'asc',
      limit: parseInt(req.query.limit) || 100,
      offset: parseInt(req.query.offset) || 0
    };
    
    const apps = appService.listApplications(options);
    res.json(apps);
  } catch (error) {
    console.error('Erreur lors de la récupération des applications:', error);
    res.status(500).json({ error: error.message });
  }
});

// Route pour obtenir une application spécifique
router.get('/:id', requireAuth, (req, res) => {
  try {
    const appId = parseInt(req.params.id);
    const app = appService.getApplicationById(appId);
    
    if (!app) {
      return res.status(404).json({ error: 'Application non trouvée' });
    }
    
    res.json(app);
  } catch (error) {
    console.error('Erreur lors de la récupération de l\'application:', error);
    res.status(500).json({ error: error.message });
  }
});

// Route pour obtenir tous les détails d'une application (y compris paramètres et dossiers)
router.get('/:id/details', requireAuth, (req, res) => {
  try {
    const appId = parseInt(req.params.id);
    const details = appService.getApplicationDetails(appId);
    
    if (!details) {
      return res.status(404).json({ error: 'Application non trouvée' });
    }
    
    // Ajouter les clés API si disponibles (pour les administrateurs uniquement)
    if (req.user.role === 'admin') {
      details.apiKeys = apiKeyService.listApiKeys(appId, { active_only: false });
    }
    
    res.json(details);
  } catch (error) {
    console.error('Erreur lors de la récupération des détails de l\'application:', error);
    res.status(500).json({ error: error.message });
  }
});

// Route pour mettre à jour une application (admin uniquement)
router.put('/:id', requireAdmin, (req, res) => {
  try {
    const appId = parseInt(req.params.id);
    const updatedApp = appService.updateApplication(appId, req.body);
    
    if (!updatedApp) {
      return res.status(404).json({ error: 'Application non trouvée' });
    }
    
    res.json(updatedApp);
  } catch (error) {
    console.error('Erreur lors de la mise à jour de l\'application:', error);
    res.status(400).json({ error: error.message });
  }
});

// Route pour supprimer une application (admin uniquement)
router.delete('/:id', requireAdmin, (req, res) => {
  try {
    const appId = parseInt(req.params.id);
    const result = appService.deleteApplication(appId);
    
    if (!result) {
      return res.status(404).json({ error: 'Application non trouvée' });
    }
    
    res.json({ message: 'Application supprimée avec succès' });
  } catch (error) {
    console.error('Erreur lors de la suppression de l\'application:', error);
    res.status(500).json({ error: error.message });
  }
});

// Route pour ajouter un paramètre à une application (admin uniquement)
router.post('/:id/params', requireAdmin, (req, res) => {
  try {
    const appId = parseInt(req.params.id);
    const newParam = appService.addApplicationParam(appId, req.body);
    
    res.status(201).json(newParam);
  } catch (error) {
    console.error('Erreur lors de l\'ajout du paramètre:', error);
    res.status(400).json({ error: error.message });
  }
});

// Route pour obtenir tous les paramètres d'une application
router.get('/:id/params', requireAuth, (req, res) => {
  try {
    const appId = parseInt(req.params.id);
    const params = appService.listApplicationParams(appId);
    
    res.json(params);
  } catch (error) {
    console.error('Erreur lors de la récupération des paramètres:', error);
    res.status(500).json({ error: error.message });
  }
});

// Route pour supprimer un paramètre d'une application (admin uniquement)
router.delete('/:id/params/:key', requireAdmin, (req, res) => {
  try {
    const appId = parseInt(req.params.id);
    const paramKey = req.params.key;
    
    const result = appService.deleteApplicationParam(appId, paramKey);
    
    if (!result) {
      return res.status(404).json({ error: 'Paramètre non trouvé' });
    }
    
    res.json({ message: 'Paramètre supprimé avec succès' });
  } catch (error) {
    console.error('Erreur lors de la suppression du paramètre:', error);
    res.status(500).json({ error: error.message });
  }
});

// Route pour ajouter un dossier à une application (admin uniquement)
router.post('/:id/folders', requireAdmin, (req, res) => {
  try {
    const appId = parseInt(req.params.id);
    const newFolder = appService.addApplicationFolder(appId, req.body);
    
    res.status(201).json(newFolder);
  } catch (error) {
    console.error('Erreur lors de l\'ajout du dossier:', error);
    res.status(400).json({ error: error.message });
  }
});

// Route pour obtenir tous les dossiers d'une application
router.get('/:id/folders', requireAuth, (req, res) => {
  try {
    const appId = parseInt(req.params.id);
    const folders = appService.listApplicationFolders(appId);
    
    res.json(folders);
  } catch (error) {
    console.error('Erreur lors de la récupération des dossiers:', error);
    res.status(500).json({ error: error.message });
  }
});

// Route pour supprimer un dossier d'une application (admin uniquement)
router.delete('/:id/folders', requireAdmin, (req, res) => {
  try {
    const appId = parseInt(req.params.id);
    const folderPath = req.query.path;
    
    if (!folderPath) {
      return res.status(400).json({ error: 'Chemin du dossier requis' });
    }
    
    const result = appService.deleteApplicationFolder(appId, folderPath);
    
    if (!result) {
      return res.status(404).json({ error: 'Dossier non trouvé' });
    }
    
    res.json({ message: 'Dossier supprimé avec succès' });
  } catch (error) {
    console.error('Erreur lors de la suppression du dossier:', error);
    res.status(500).json({ error: error.message });
  }
});

// Route pour obtenir les statistiques d'une application
router.get('/:id/stats', requireAuth, (req, res) => {
  try {
    const appId = parseInt(req.params.id);
    const options = {
      start_date: req.query.start_date,
      end_date: req.query.end_date
    };
    
    const stats = appService.getApplicationStats(appId, options);
    res.json(stats);
  } catch (error) {
    console.error('Erreur lors de la récupération des statistiques:', error);
    res.status(500).json({ error: error.message });
  }
});

// Export du routeur
module.exports = router;