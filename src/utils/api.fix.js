/**
 * Script de correctif pour l'API de FHIRHub
 * Ce script applique la nouvelle organisation des fichiers à l'API
 */

const fs = require('fs');
const path = require('path');

// Chemin vers l'API
const apiPath = path.join(__dirname, 'api.js');

// Vérifier si le fichier existe
if (!fs.existsSync(apiPath)) {
  console.error(`Erreur: Le fichier API n'existe pas à l'emplacement ${apiPath}`);
  process.exit(1);
}

// Lire le contenu du fichier API
let apiContent = fs.readFileSync(apiPath, 'utf8');

// Ajouter l'import du module de traitement des noms FHIR
const importStatement = `const { processFhirNames } = require('./src/services/fhirNameProcessor');`;
if (!apiContent.includes('processFhirNames')) {
  // Chercher l'endroit où ajouter l'import (après les autres imports mais avant le code)
  const importPattern = /^const.*require.*;$/m;
  const lastImportMatch = apiContent.match(new RegExp(importPattern, 'gm'));
  
  if (lastImportMatch && lastImportMatch.length > 0) {
    const lastImport = lastImportMatch[lastImportMatch.length - 1];
    apiContent = apiContent.replace(lastImport, `${lastImport}\n${importStatement}`);
  } else {
    // Si aucun import n'est trouvé, ajouter au début du fichier
    apiContent = `${importStatement}\n${apiContent}`;
  }
  
  console.log('Import du module de traitement des noms FHIR ajouté');
}

// Appliquer le traitement des noms dans l'API de conversion
const conversionPattern = /try\s*{[^]*?const\s+result\s*=\s*hl7ToFhirConverter\(hl7Content\);[^]*?res\.json\(\{[^]*?status\s*:\s*['"]ok['"],/g;
const conversionReplacement = (match) => {
  // Vérifier si le match existe déjà dans le traitement des noms français
  if (match.includes('processFhirNames')) {
    return match; // Déjà modifié, ne rien faire
  }
  
  // Chercher l'endroit où insérer notre code
  const resultPattern = /const\s+result\s*=\s*hl7ToFhirConverter\(hl7Content\);/;
  return match.replace(resultPattern, 
    `const rawResult = hl7ToFhirConverter(hl7Content);\n` +
    `      // Appliquer le correctif pour les noms français\n` +
    `      const result = processFhirNames(rawResult, hl7Content);`);
};

apiContent = apiContent.replace(conversionPattern, conversionReplacement);
console.log('Traitement des noms français appliqué à l\'API de conversion');

// Écrire le fichier mis à jour
fs.writeFileSync(apiPath, apiContent, 'utf8');
console.log(`API mise à jour avec succès à ${apiPath}`);