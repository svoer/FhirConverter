/**
 * Script pour restructurer les fichiers du projet
 * Ce script déplace les fichiers dans une structure plus propre
 * et corrige les imports
 */

const fs = require('fs');
const path = require('path');

// Assurer que les répertoires existent
function ensureDirectoryExists(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

// Structure des répertoires
const directories = [
  'src/core',
  'src/api',
  'src/utils',
  'src/services',
  'src/middleware',
  'src/config',
  'src/models',
  'src/converters'
];

// Créer les répertoires
directories.forEach(dir => {
  ensureDirectoryExists(dir);
  console.log(`Répertoire créé: ${dir}`);
});

// Liste des fichiers à déplacer avec leur destination
const filesToMove = [
  // Convertisseur
  { source: 'hl7ToFhirConverter.js', dest: 'src/converters/hl7ToFhirConverter.js' },
  { source: 'hl7ToFhirConverter.proxy.js', dest: 'src/converters/hl7ToFhirConverter.proxy.js' },
  
  // API et serveur
  { source: 'api.js', dest: 'src/api/index.js' },
  { source: 'server.js', dest: 'src/server.js' },
  
  // Terminologie
  { source: 'french_terminology_adapter.js', dest: 'src/services/frenchTerminologyAdapter.js' },
  { source: 'french_terminology_service.js', dest: 'src/services/frenchTerminologyService.js' },
  { source: 'french_terminology_service_offline.js', dest: 'src/services/frenchTerminologyServiceOffline.js' },

  // Utilitaires
  { source: 'fhir_cleaner.js', dest: 'src/utils/fhirCleaner.js' }
];

// Déplacer les fichiers s'ils existent
filesToMove.forEach(file => {
  if (fs.existsSync(file.source)) {
    const destDir = path.dirname(file.dest);
    ensureDirectoryExists(destDir);
    
    // Copier le fichier plutôt que le déplacer pour éviter les problèmes pendant la transition
    fs.copyFileSync(file.source, file.dest);
    console.log(`Fichier copié: ${file.source} -> ${file.dest}`);
  } else {
    console.log(`Fichier source non trouvé: ${file.source}`);
  }
});

console.log('Restructuration terminée avec succès!');
console.log('Note: Les fichiers originaux n\'ont pas été supprimés par sécurité.');
console.log('Une fois que tout fonctionne, vous pouvez les supprimer manuellement.');