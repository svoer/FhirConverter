/**
 * Script de mise à jour du convertisseur HL7 vers FHIR
 * Ce script installe le nouveau système de conversion dans la structure de production
 */

const fs = require('fs');
const path = require('path');

// Fonction pour créer un répertoire s'il n'existe pas
function ensureDirectoryExists(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
    console.log(`✓ Répertoire créé: ${dirPath}`);
  }
}

// Créer la structure de répertoires si elle n'existe pas
ensureDirectoryExists('./src');
ensureDirectoryExists('./src/services');
ensureDirectoryExists('./src/utils');

// Remplacer le convertisseur principal
const mainPath = './hl7ToFhirConverter.js';
if (fs.existsSync(mainPath)) {
  // Sauvegarder l'ancien convertisseur
  fs.copyFileSync(mainPath, `${mainPath}.bak`);
  console.log(`✓ Sauvegarde de l'ancien convertisseur: ${mainPath}.bak`);
  
  // Créer un adaptateur de proxy pour maintenir la compatibilité
  const proxyContent = `/**
 * Proxy du convertisseur HL7 vers FHIR
 * Ce fichier assure la rétrocompatibilité avec l'ancien système
 * en redirigeant les appels vers le nouveau module de conversion
 */

const convertHL7ToFHIR = require('./src/services/hl7ToFhirConverter');

// Export pour maintenir la compatibilité avec l'ancien code
module.exports = convertHL7ToFHIR;
`;
  
  fs.writeFileSync(mainPath, proxyContent);
  console.log(`✓ Installation du proxy de conversion: ${mainPath}`);
}

// Mettre à jour le script de démarrage
const startPath = './start.sh';
if (fs.existsSync(startPath)) {
  let startContent = fs.readFileSync(startPath, 'utf8');
  
  // Ajouter l'initialisation du nouveau système de conversion
  if (!startContent.includes('Initialisation du nouveau système de conversion')) {
    const initLine = `
# Initialisation du nouveau système de conversion
echo "Initialisation du nouveau système de conversion HL7 vers FHIR..."
`;
    
    // Insérer après la ligne "Démarrage de FHIRHub"
    startContent = startContent.replace(
      'echo "Démarrage de FHIRHub - Convertisseur HL7 v2.5 vers FHIR R4"',
      'echo "Démarrage de FHIRHub - Convertisseur HL7 v2.5 vers FHIR R4"\n' + initLine
    );
    
    fs.writeFileSync(startPath, startContent);
    console.log(`✓ Mise à jour du script de démarrage: ${startPath}`);
  }
}

// Mettre à jour l'API pour utiliser le nouveau système
const apiPath = './api.js';
if (fs.existsSync(apiPath)) {
  let apiContent = fs.readFileSync(apiPath, 'utf8');
  
  // Vérifier si l'API utilise déjà le nouveau traitement des noms
  if (!apiContent.includes('processFhirNames')) {
    console.log(`✗ L'API n'utilise pas encore le nouveau traitement des noms`);
    console.log(`  Exécutez 'node api.fix.js' pour mettre à jour l'API`);
  } else {
    console.log(`✓ L'API utilise déjà le nouveau traitement des noms`);
  }
}

console.log("\n✅ Mise à jour du système de conversion terminée!");
console.log("Pour tester le nouveau système, exécutez: node test_new_converter.js");