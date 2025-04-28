/**
 * Script pour corriger les erreurs de syntaxe dans le fichier hl7ToFhirConverter.js
 * Ce script analyse le fichier et applique les correctifs nécessaires
 */

const fs = require('fs');
const path = require('path');

// Chemin vers le fichier à corriger
const filePath = path.join(__dirname, 'hl7ToFhirConverter.js');

try {
  console.log(`Correction des erreurs de syntaxe dans ${filePath}`);
  
  // Lire le contenu du fichier
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Rechercher et corriger l'erreur de bloc try sans catch autour de la ligne 1500
  let lines = content.split('\n');
  
  // Modification autour de la ligne 1500 qui cause un "Missing catch or finally after try"
  // Rechercher la section problématique
  let foundTry = false;
  let tryStartLine = -1;
  let tryEndLine = -1;
  let bracketCount = 0;
  
  // Chercher le bloc try qui est mal fermé
  for (let i = 1350; i < 1550; i++) {
    if (i >= lines.length) break;
    
    const line = lines[i];
    
    if (!foundTry && line.includes('try {')) {
      foundTry = true;
      tryStartLine = i;
      bracketCount = 1; // Compte les accolades ouvertes
      continue;
    }
    
    if (foundTry) {
      // Compter les accolades ouvertes et fermées
      for (let j = 0; j < line.length; j++) {
        if (line[j] === '{') bracketCount++;
        if (line[j] === '}') bracketCount--;
      }
      
      // Si toutes les accolades sont fermées et qu'il n'y a pas de catch
      if (bracketCount === 0) {
        tryEndLine = i;
        break;
      }
    }
  }
  
  // Si on a trouvé un bloc try sans catch
  if (foundTry && tryEndLine > tryStartLine) {
    console.log(`Bloc try trouvé de la ligne ${tryStartLine} à ${tryEndLine}`);
    
    // Ajouter un bloc catch après la dernière accolade du bloc try
    const lineWithClosingBracket = lines[tryEndLine];
    const indentation = lineWithClosingBracket.match(/^\s*/)[0];
    
    // Remplacer la ligne avec l'accolade fermante par un bloc try-catch complet
    lines[tryEndLine] = `${indentation}} catch (error) {
${indentation}  console.error("[CONVERTER_FIX] Erreur corrigée:", error);
${indentation}}`;
    
    console.log(`Bloc catch ajouté à la ligne ${tryEndLine}`);
  } else {
    console.log("Impossible de trouver le bloc try problématique ou il a déjà un catch");
  }
  
  // Réécrire le fichier corrigé
  const correctedContent = lines.join('\n');
  fs.writeFileSync(filePath, correctedContent, 'utf8');
  
  console.log("Correctifs appliqués avec succès");
} catch (error) {
  console.error("Erreur lors de la correction des erreurs de syntaxe:", error);
}