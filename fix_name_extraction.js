/**
 * Script pour appliquer directement la correction d'extraction des noms français 
 * au convertisseur HL7 vers FHIR.
 */

const fs = require('fs');
const path = require('path');

// Chemin du fichier du convertisseur
const converterPath = path.join(__dirname, 'hl7ToFhirConverter.js');

// Lire le contenu du fichier du convertisseur
console.log(`Lecture du fichier ${converterPath}...`);
const originalContent = fs.readFileSync(converterPath, 'utf8');

// Créer une sauvegarde du fichier original
const backupPath = path.join(__dirname, 'hl7ToFhirConverter.js.bak');
console.log(`Création d'une sauvegarde dans ${backupPath}...`);
fs.writeFileSync(backupPath, originalContent);

// Expression régulière pour trouver où les noms de patients sont traités
const patientNamePattern = /\/\/ Ajouter le nom du patient([\s\S]*?)(\/\/ Ajouter la date de naissance)/;

// Nouveau code pour le traitement des noms de patients
const newNameProcessingCode = `
      // Ajouter le nom du patient avec amélioration pour les messages français
      patientResource.name = [];
      
      // Première approche: utilisation des données parsées par le parseur HL7
      if (hl7Data.PID && hl7Data.PID.patientName) {
        const nameObj = {
          family: hl7Data.PID.patientName.family || '',
          given: [],
          use: 'official'
        };
        
        // Ajouter le prénom principal
        if (hl7Data.PID.patientName.given && hl7Data.PID.patientName.given.trim() !== '') {
          nameObj.given.push(hl7Data.PID.patientName.given.trim());
        }
        
        // Ajouter les prénoms supplémentaires
        if (hl7Data.PID.patientName.middle && hl7Data.PID.patientName.middle.trim() !== '') {
          const middleNames = hl7Data.PID.patientName.middle.split(' ');
          middleNames.forEach(name => {
            if (name.trim() !== '' && !nameObj.given.includes(name.trim())) {
              nameObj.given.push(name.trim());
            }
          });
        }
        
        // Ajouter le préfixe
        if (hl7Data.PID.patientName.prefix && hl7Data.PID.patientName.prefix.trim() !== '') {
          nameObj.prefix = [hl7Data.PID.patientName.prefix.trim()];
        }
        
        // Ajouter le suffixe
        if (hl7Data.PID.patientName.suffix && hl7Data.PID.patientName.suffix.trim() !== '') {
          nameObj.suffix = [hl7Data.PID.patientName.suffix.trim()];
        }
        
        // Déterminer l'usage du nom
        if (hl7Data.PID.patientName.nameTypeCode) {
          switch (hl7Data.PID.patientName.nameTypeCode) {
            case 'L': nameObj.use = 'official'; break;
            case 'D': nameObj.use = 'usual'; break;
            case 'M': nameObj.use = 'maiden'; break;
            case 'N': nameObj.use = 'nickname'; break;
            default: nameObj.use = 'official';
          }
        }
        
        // Ajouter le nom à la ressource Patient
        if (nameObj.family && nameObj.family.trim() !== '') {
          patientResource.name.push(nameObj);
        }
      }
      
      // Deuxième approche: traitement direct du segment PID pour les messages français
      if (hl7Data.segments) {
        const pidSegments = hl7Data.segments.filter(s => s.name === 'PID');
        if (pidSegments.length > 0) {
          const pidSegment = pidSegments[0];
          
          // Chercher le champ PID-5 (position 5)
          // Attention: les positions dans le tableau peuvent être basées sur 0 ou 1
          const nameField = pidSegment.fields.find(f => f.position === 5);
          
          if (nameField && nameField.value) {
            // Traiter les répétitions (séparées par ~)
            const nameValues = nameField.value.split('~');
            
            // Pour chaque répétition du nom
            nameValues.forEach(nameVal => {
              const nameParts = nameVal.split('^');
              
              // Vérifier qu'il y a au moins un nom de famille
              if (nameParts.length > 0 && nameParts[0].trim() !== '') {
                // Déterminer l'usage du nom
                let nameUse = 'official';
                if (nameParts.length > 6) {
                  switch (nameParts[6]) {
                    case 'L': nameUse = 'official'; break;
                    case 'D': nameUse = 'usual'; break;
                    case 'M': nameUse = 'maiden'; break;
                    case 'N': nameUse = 'nickname'; break;
                    default: nameUse = 'official';
                  }
                }
                
                // Créer l'objet nom
                const nameObj = {
                  family: nameParts[0].trim(),
                  given: [],
                  use: nameUse
                };
                
                // Ajouter le prénom principal (position 1)
                if (nameParts.length > 1 && nameParts[1].trim() !== '') {
                  nameObj.given.push(nameParts[1].trim());
                }
                
                // Ajouter les prénoms supplémentaires (position 2)
                if (nameParts.length > 2 && nameParts[2].trim() !== '') {
                  // Diviser les prénoms multiples par espace
                  const additionalNames = nameParts[2].trim().split(' ');
                  additionalNames.forEach(name => {
                    if (name.trim() !== '' && !nameObj.given.includes(name.trim())) {
                      nameObj.given.push(name.trim());
                    }
                  });
                }
                
                // Ajouter le préfixe (position 4)
                if (nameParts.length > 4 && nameParts[4].trim() !== '') {
                  nameObj.prefix = [nameParts[4].trim()];
                }
                
                // Ajouter le suffixe (position 3)
                if (nameParts.length > 3 && nameParts[3].trim() !== '') {
                  nameObj.suffix = [nameParts[3].trim()];
                }
                
                // Vérifier si ce nom est une amélioration d'un nom existant
                const existingIndex = patientResource.name.findIndex(n => 
                  n.family === nameObj.family && n.use === nameObj.use);
                
                if (existingIndex >= 0) {
                  // Si le nom existant a moins de prénoms, le remplacer
                  const existing = patientResource.name[existingIndex];
                  if (!existing.given || existing.given.length < nameObj.given.length) {
                    patientResource.name[existingIndex] = nameObj;
                  }
                } else {
                  // Sinon, ajouter ce nom à la liste
                  patientResource.name.push(nameObj);
                }
              }
            });
          }
        }
      }
      
      // S'assurer qu'il y a au moins un nom
      if (patientResource.name.length === 0) {
        patientResource.name = [{
          family: hl7Data.PID.patientName ? (hl7Data.PID.patientName.family || '') : '',
          given: []
        }];
      }
      
      $2`;

// Remplacer le code de traitement des noms dans le fichier
console.log('Application de la correction au convertisseur...');
const updatedContent = originalContent.replace(patientNamePattern, (match, p1, p2) => {
  return newNameProcessingCode;
});

// Vérifier si des modifications ont été apportées
if (updatedContent === originalContent) {
  console.log('❌ Échec: Aucune modification n\'a été faite. Le motif de recherche n\'a pas été trouvé.');
} else {
  // Écrire le fichier modifié
  console.log('Écriture du fichier modifié...');
  fs.writeFileSync(converterPath, updatedContent);
  console.log('✅ Correction appliquée avec succès!');
}

// Conseils pour tester la correction
console.log('\nPour tester la correction:');
console.log('1. Exécutez: node test_french_hl7.js');
console.log('2. Vérifiez que les noms dans la ressource Patient incluent les prénoms multiples');
console.log('En cas de problème, vous pouvez restaurer la sauvegarde avec:');
console.log(`mv ${backupPath} ${converterPath}`);