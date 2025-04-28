/**
 * Module de correction des problèmes dans l'historique des conversions
 * Ce module contient des fonctions utilitaires pour nettoyer et corriger
 * les données d'historique des conversions HL7 -> FHIR
 */

const path = require('path');
const fs = require('fs');
const dbService = require('../db/dbService');

/**
 * Appliquer des correctifs à l'historique des conversions
 */
function applyHistoryFixes() {
  console.log('Nettoyage de l\'historique: début');
  
  try {
    // Supprimer les entrées corrompues et recalculer les statistiques
    const fixResult = dbService.fixHistory();
    
    // Nettoyer les anciennes conversions selon les paramètres de rétention
    const cleanupResult = dbService.cleanupHistory();
    
    return {
      success: true,
      fixes: fixResult,
      cleanup: cleanupResult
    };
  } catch (error) {
    console.error('Erreur lors de la correction de l\'historique:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Nettoyer les ressources temporaires et fichiers obsolètes
 */
function cleanupTempResources() {
  console.log('Nettoyage des ressources temporaires: début');
  
  const tempDirs = [
    path.join(__dirname, '../../data/uploads'),
    path.join(__dirname, '../../data/in')
  ];
  
  const results = {
    filesDeleted: 0,
    errors: []
  };
  
  // Parcourir les répertoires temporaires
  tempDirs.forEach(dirPath => {
    if (fs.existsSync(dirPath)) {
      try {
        const files = fs.readdirSync(dirPath);
        
        // Supprimer les fichiers datant de plus de 24 heures
        files.forEach(file => {
          try {
            const filePath = path.join(dirPath, file);
            const stats = fs.statSync(filePath);
            
            const fileAge = new Date() - stats.mtime;
            const hoursOld = fileAge / (1000 * 60 * 60);
            
            if (hoursOld > 24) {
              fs.unlinkSync(filePath);
              results.filesDeleted++;
            }
          } catch (fileError) {
            results.errors.push(`Erreur avec le fichier ${file}: ${fileError.message}`);
          }
        });
      } catch (dirError) {
        results.errors.push(`Erreur avec le répertoire ${dirPath}: ${dirError.message}`);
      }
    }
  });
  
  return results;
}

module.exports = {
  applyHistoryFixes,
  cleanupTempResources
};