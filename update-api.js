/**
 * Script pour mettre à jour l'API afin d'utiliser les nouveaux modules
 * Ce script met à jour le fichier api.js pour qu'il utilise la nouvelle structure
 */

const fs = require('fs');
const path = require('path');

// Lire le contenu actuel de api.js
try {
  const apiPath = path.join(__dirname, 'api.js');
  let apiContent = fs.readFileSync(apiPath, 'utf8');
  
  // Remplacer les imports
  const replacements = [
    {
      from: "const applyFrenchNamesFix = require('./apply_french_names_fix');",
      to: "const { processFhirNames } = require('./src/services/fhirNameProcessor');"
    },
    {
      from: "const frenchTerminologyService = require('./french_terminology_service');",
      to: "const frenchTerminologyService = require('./src/services/frenchTerminologyService');"
    },
    {
      from: "const converter = require('./hl7ToFhirConverter.proxy');",
      to: "const converter = require('./src/converters/hl7ToFhirConverter.proxy');"
    },
    {
      from: "const frenchTerminologyAdapter = require('./french_terminology_adapter');",
      to: "const frenchTerminologyAdapter = require('./src/services/frenchTerminologyAdapter');"
    },
    {
      from: "// Appliquer le correctif pour les noms français composés\n    result = applyFrenchNamesFix(result, hl7Content);",
      to: "// Traiter les noms français composés avec notre service structuré\n    result = processFhirNames(result, hl7Content);"
    }
  ];
  
  // Appliquer les remplacements
  replacements.forEach(replacement => {
    if (apiContent.includes(replacement.from)) {
      apiContent = apiContent.replace(replacement.from, replacement.to);
      console.log(`Remplacement effectué: ${replacement.from} -> ${replacement.to}`);
    } else {
      // Essayer de trouver des variantes du pattern
      const fromPattern = replacement.from.replace(/\s+/g, '\\s+').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
      const regex = new RegExp(fromPattern, 'g');
      
      if (regex.test(apiContent)) {
        apiContent = apiContent.replace(regex, replacement.to);
        console.log(`Remplacement avec regex effectué: ${replacement.from} -> ${replacement.to}`);
      } else {
        console.log(`Motif non trouvé: ${replacement.from}`);
      }
    }
  });
  
  // Écrire le contenu mis à jour
  fs.writeFileSync(apiPath + '.new', apiContent);
  console.log(`Mise à jour terminée, le fichier résultant est: ${apiPath}.new`);
  console.log('Vérifiez le nouveau fichier avant de l\'utiliser.');
} catch (error) {
  console.error('Erreur lors de la mise à jour:', error);
}