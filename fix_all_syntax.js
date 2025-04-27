/**
 * Script pour corriger toutes les erreurs de syntaxe JSON dans le convertisseur HL7 vers FHIR
 */

const fs = require('fs');
const path = require('path');

function fixFile(filePath) {
  try {
    // Lire le fichier
    let content = fs.readFileSync(filePath, 'utf8');

    // Remplacer les objets malformés en ajoutant [] aux propriétés array
    content = content.replace(/(\w+): \[{([^}]+)}\],?\s+(\w+):/g, (match, propName, inner, nextProp) => {
      return `${propName}: [{${inner}}],\n            ${nextProp}:`;
    });

    // Ajouter des crochets fermants aux arrays manquants
    content = content.replace(/(\w+): \[{([^}]+)}\},\s+(\w+):/g, (match, propName, inner, nextProp) => {
      return `${propName}: [{${inner}}],\n            ${nextProp}:`;
    });

    // Correction spécifique du bug de l'extension
    content = content.replace(/extension: \[{([^}]+)}\},\s+(active|period|telecom|address):/g, (match, inner, nextProp) => {
      return `extension: [{${inner}}],\n            ${nextProp}:`;
    });

    // Vérifier toutes les instances de active: true, period:
    content = content.replace(/active: true,\s+period:/g, 'active: true,\n            period:');

    // Si un objet se termine sans virgule avant la prochaine propriété
    content = content.replace(/\}\s+(\w+):/g, '},\n            $1:');

    // Écrire le contenu corrigé
    fs.writeFileSync(filePath, content);
    console.log(`Fichier ${filePath} corrigé avec succès.`);
    return true;
  } catch (error) {
    console.error(`Erreur lors de la correction du fichier ${filePath}:`, error);
    return false;
  }
}

// Exécuter le correcteur sur le convertisseur
const converterPath = './hl7ToFhirConverter.js';
if (fixFile(converterPath)) {
  console.log('Corrections appliquées avec succès.');
} else {
  console.error('Des erreurs sont survenues lors de la correction.');
}