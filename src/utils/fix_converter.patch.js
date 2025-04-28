/**
 * Script pour appliquer un correctif au module convertisseur HL7 vers FHIR
 * Ce script doit être exécuté avant de démarrer l'application
 */

const fs = require('fs');
const path = require('path');

// Le chemin vers le fichier convertisseur
const converterFilePath = path.resolve(__dirname, 'hl7ToFhirConverter.js');

// Le chemin vers le module de correction des noms français
const fixPath = path.resolve(__dirname, 'french_names_fix.js');

// Vérifier si le fichier convertisseur existe
if (!fs.existsSync(converterFilePath)) {
  console.error(`Erreur: Le fichier ${converterFilePath} n'existe pas`);
  process.exit(1);
}

// Vérifier si le module de correction existe
if (!fs.existsSync(fixPath)) {
  console.error(`Erreur: Le fichier ${fixPath} n'existe pas`);
  process.exit(1);
}

console.log('Application du correctif pour l\'extraction des noms français...');

try {
  // Lire le contenu du fichier convertisseur
  const content = fs.readFileSync(converterFilePath, 'utf8');
  
  // Vérifier si le fichier contient déjà les imports nécessaires
  const hasImports = content.includes('const frenchNamesFix =');
  
  if (hasImports) {
    console.log('Le fichier a déjà été corrigé');
    process.exit(0);
  }
  
  // Trouver la ligne d'import des modules
  const importRegex = /const\s+frenchAdapter\s*=\s*require\(['"]\.\/french_terminology_adapter['"]\);/;
  const importMatch = content.match(importRegex);
  
  if (!importMatch) {
    console.error('Erreur: Impossible de trouver la ligne d\'import des modules');
    process.exit(1);
  }
  
  // Ajouter l'import du module de correction
  const importLine = importMatch[0];
  const newImportLine = `${importLine}\n// Importer le module de correction des noms français\nconst frenchNamesFix = require('./french_names_fix');`;
  
  // Remplacer la ligne d'import
  let modifiedContent = content.replace(importLine, newImportLine);
  
  // Trouver la fonction convertHl7Content
  const functionRegex = /function convertHl7Content\(hl7Content, filename = null, options = {}\) {/;
  const functionMatch = modifiedContent.match(functionRegex);
  
  if (!functionMatch) {
    console.error('Erreur: Impossible de trouver la fonction convertHl7Content');
    process.exit(1);
  }
  
  // Trouver la ligne où le bundle FHIR est retourné
  const returnRegex = /return\s*{\s*hl7Message(.*?)bundle(.*?)}/s;
  const returnMatch = modifiedContent.match(returnRegex);
  
  if (!returnMatch) {
    console.error('Erreur: Impossible de trouver la ligne de retour du bundle FHIR');
    process.exit(1);
  }
  
  // Ajouter l'appel à la fonction de correction avant le retour
  const returnLine = returnMatch[0];
  const newReturnLine = `// Appliquer le correctif pour les noms français\n  if (options.fixFrenchNames !== false) {\n    bundle = frenchNamesFix.fixFrenchNamesInFhirBundle(bundle, hl7Content);\n  }\n\n  ${returnLine}`;
  
  // Remplacer la ligne de retour
  modifiedContent = modifiedContent.replace(returnLine, newReturnLine);
  
  // Écrire le contenu modifié dans le fichier
  fs.writeFileSync(converterFilePath, modifiedContent, 'utf8');
  
  console.log('Correctif appliqué avec succès');
  process.exit(0);
} catch (error) {
  console.error('Erreur lors de l\'application du correctif:', error);
  process.exit(1);
}