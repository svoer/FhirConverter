/**
 * Service de gestion des fichiers
 * Fournit des fonctions pour accéder aux répertoires de données
 * Note: La fonctionnalité de surveillance de répertoire a été supprimée
 */

const fs = require('fs');
const path = require('path');
const converter = require('./hl7ToFhirConverter');

// Configuration
const inputDir = path.join(process.cwd(), 'data', 'in');
const outputDir = path.join(process.cwd(), 'data', 'out');

// Créer les répertoires s'ils n'existent pas
if (!fs.existsSync(inputDir)) {
  fs.mkdirSync(inputDir, { recursive: true });
}
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

/**
 * Traiter un fichier HL7
 * @param {string} filePath - Chemin du fichier à traiter
 */
async function processFile(filePath) {
  console.log(`Traitement du fichier: ${filePath}`);
  
  try {
    // Vérifier l'extension du fichier
    if (!filePath.toLowerCase().endsWith('.hl7') && 
        !filePath.toLowerCase().endsWith('.txt')) {
      console.log(`Fichier ignoré (extension non supportée): ${filePath}`);
      return;
    }
    
    // Convertir le fichier
    const result = converter.convertHl7File(filePath);
    
    if (result.success) {
      console.log(`Conversion réussie: ${result.outputPath}`);
    } else {
      console.error(`Échec de la conversion: ${result.message}`);
    }
    
    return result;
  } catch (error) {
    console.error(`Erreur lors du traitement du fichier ${filePath}:`, error);
    throw error;
  }
}

// Fonctions fictives pour maintenir la compatibilité avec l'API existante
function startMonitoring() {
  console.log(`La surveillance des répertoires a été désactivée. Utilisez l'API pour convertir des fichiers.`);
  return { success: false, message: 'Fonctionnalité désactivée' };
}

function stopMonitoring() {
  console.log(`La surveillance des répertoires a été désactivée.`);
  return { success: false, message: 'Fonctionnalité désactivée' };
}

function scanDirectory() {
  console.log(`La surveillance des répertoires a été désactivée. Utilisez l'API pour convertir des fichiers.`);
  return { success: false, message: 'Fonctionnalité désactivée' };
}

module.exports = {
  processFile,
  startMonitoring,
  stopMonitoring,
  scanDirectory,
  inputDir,
  outputDir
};