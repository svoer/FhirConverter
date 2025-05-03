/**
 * Routes d'administration pour FHIRHub
 * @module routes/adminRoutes
 */

const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const dbMaintenanceService = require('../src/services/dbMaintenanceService');
const dbService = require('../src/services/dbService');
const path = require('path');
const fs = require('fs');

// Route pour vérifier l'intégrité de la base de données
router.post('/database/check', authMiddleware.adminRequired, async (req, res) => {
  try {
    console.log('[ADMIN] Vérification de l\'intégrité de la base de données demandée par', req.user.username);
    
    const result = await dbMaintenanceService.checkDatabaseIntegrity();
    
    return res.status(200).json({
      success: true,
      message: 'Vérification de l\'intégrité de la base de données terminée',
      data: result
    });
  } catch (error) {
    console.error('[ADMIN] Erreur lors de la vérification de l\'intégrité de la base de données:', error);
    
    return res.status(500).json({
      success: false,
      message: 'Erreur lors de la vérification de l\'intégrité de la base de données',
      error: error.message
    });
  }
});

// Route pour créer une sauvegarde de la base de données
router.post('/database/backup', authMiddleware.adminRequired, async (req, res) => {
  try {
    console.log('[ADMIN] Sauvegarde de la base de données demandée par', req.user.username);
    
    const { prefix } = req.body;
    const backupPath = await dbMaintenanceService.createBackup(prefix || 'manual');
    
    return res.status(200).json({
      success: true,
      message: 'Sauvegarde de la base de données créée avec succès',
      data: {
        backup_path: backupPath
      }
    });
  } catch (error) {
    console.error('[ADMIN] Erreur lors de la création de la sauvegarde de la base de données:', error);
    
    return res.status(500).json({
      success: false,
      message: 'Erreur lors de la création de la sauvegarde de la base de données',
      error: error.message
    });
  }
});

// Route pour lister les sauvegardes disponibles
router.get('/database/backups', authMiddleware.adminRequired, (req, res) => {
  try {
    console.log('[ADMIN] Liste des sauvegardes de base de données demandée par', req.user.username);
    
    const backupDir = path.join(process.cwd(), 'backups');
    
    if (!fs.existsSync(backupDir)) {
      return res.status(200).json({
        success: true,
        message: 'Aucune sauvegarde disponible',
        data: []
      });
    }
    
    const backupFiles = fs.readdirSync(backupDir)
      .filter(file => file.endsWith('.db'))
      .map(file => {
        const filePath = path.join(backupDir, file);
        const stats = fs.statSync(filePath);
        
        return {
          name: file,
          size: stats.size,
          created_at: stats.mtime,
          path: filePath
        };
      })
      .sort((a, b) => b.created_at - a.created_at); // Plus récent en premier
    
    return res.status(200).json({
      success: true,
      message: `${backupFiles.length} sauvegardes trouvées`,
      data: backupFiles
    });
  } catch (error) {
    console.error('[ADMIN] Erreur lors de la récupération des sauvegardes:', error);
    
    return res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des sauvegardes',
      error: error.message
    });
  }
});

// Route pour restaurer une sauvegarde
router.post('/database/restore', authMiddleware.adminRequired, async (req, res) => {
  try {
    console.log('[ADMIN] Restauration de la base de données demandée par', req.user.username);
    
    const { backup_name } = req.body;
    
    if (!backup_name) {
      return res.status(400).json({
        success: false,
        message: 'Nom de sauvegarde non spécifié'
      });
    }
    
    const backupDir = path.join(process.cwd(), 'backups');
    const backupPath = path.join(backupDir, backup_name);
    
    if (!fs.existsSync(backupPath)) {
      return res.status(404).json({
        success: false,
        message: 'Sauvegarde non trouvée'
      });
    }
    
    // Fermer la connexion à la base de données actuelle
    await dbService.close();
    
    // Sauvegarder la base de données actuelle avant la restauration
    const currentDbPath = path.join(process.cwd(), 'data', 'fhirhub.db');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const preRestorePath = path.join(backupDir, `pre_restore_${timestamp}.db`);
    
    try {
      fs.copyFileSync(currentDbPath, preRestorePath);
      console.log('[ADMIN] Sauvegarde de sécurité créée:', preRestorePath);
    } catch (backupError) {
      console.error('[ADMIN] Erreur lors de la création de la sauvegarde de sécurité:', backupError);
    }
    
    // Restaurer la sauvegarde
    try {
      fs.copyFileSync(backupPath, currentDbPath);
      console.log('[ADMIN] Base de données restaurée avec succès depuis', backupPath);
      
      // Réinitialiser la connexion à la base de données
      await dbService.initialize();
      
      return res.status(200).json({
        success: true,
        message: 'Base de données restaurée avec succès',
        data: {
          restored_from: backupPath,
          safety_backup: preRestorePath
        }
      });
    } catch (restoreError) {
      console.error('[ADMIN] Erreur lors de la restauration de la base de données:', restoreError);
      
      // Tenter de réinitialiser la connexion à la base de données
      try {
        await dbService.initialize();
      } catch (initError) {
        console.error('[ADMIN] Erreur lors de la réinitialisation de la connexion à la base de données:', initError);
      }
      
      return res.status(500).json({
        success: false,
        message: 'Erreur lors de la restauration de la base de données',
        error: restoreError.message
      });
    }
  } catch (error) {
    console.error('[ADMIN] Erreur lors de la restauration de la base de données:', error);
    
    return res.status(500).json({
      success: false,
      message: 'Erreur lors de la restauration de la base de données',
      error: error.message
    });
  }
});

// Route pour obtenir des statistiques sur la base de données
router.get('/database/stats', authMiddleware.adminRequired, async (req, res) => {
  try {
    console.log('[ADMIN] Statistiques de la base de données demandées par', req.user.username);
    
    // Compter le nombre d'utilisateurs
    const userCount = await dbService.get('SELECT COUNT(*) as count FROM users');
    
    // Compter le nombre d'applications
    const appCount = await dbService.get('SELECT COUNT(*) as count FROM applications');
    
    // Compter le nombre de clés API
    const apiKeyCount = await dbService.get('SELECT COUNT(*) as count FROM api_keys');
    
    // Compter le nombre de workflows
    const workflowCount = await dbService.get('SELECT COUNT(*) as count FROM workflows');
    
    // Compter le nombre de conversions
    const conversionCount = await dbService.get('SELECT COUNT(*) as count FROM conversion_logs');
    
    // Taille du fichier de base de données
    const dbPath = path.join(process.cwd(), 'data', 'fhirhub.db');
    let dbSize = 0;
    
    if (fs.existsSync(dbPath)) {
      const stats = fs.statSync(dbPath);
      dbSize = stats.size;
    }
    
    // Utilisation des tables
    const tableStats = await dbService.query('SELECT name, type FROM sqlite_master WHERE type = "table"');
    
    // Informations sur les tables
    const tableInfo = [];
    for (const table of tableStats) {
      try {
        const count = await dbService.get(`SELECT COUNT(*) as count FROM ${table.name}`);
        tableInfo.push({
          name: table.name,
          row_count: count ? count.count : 0
        });
      } catch (tableError) {
        console.error(`[ADMIN] Erreur lors de la récupération des informations pour la table ${table.name}:`, tableError);
      }
    }
    
    return res.status(200).json({
      success: true,
      data: {
        users: userCount ? userCount.count : 0,
        applications: appCount ? appCount.count : 0,
        api_keys: apiKeyCount ? apiKeyCount.count : 0,
        workflows: workflowCount ? workflowCount.count : 0,
        conversions: conversionCount ? conversionCount.count : 0,
        database_size: dbSize,
        database_size_human: formatBytes(dbSize),
        tables: tableInfo
      }
    });
  } catch (error) {
    console.error('[ADMIN] Erreur lors de la récupération des statistiques de la base de données:', error);
    
    return res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des statistiques de la base de données',
      error: error.message
    });
  }
});

/**
 * Formater les octets en taille lisible
 * @param {number} bytes - Taille en octets
 * @param {number} [decimals=2] - Nombre de décimales
 * @returns {string} Taille formatée
 */
function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

module.exports = router;