/**
 * Script pour mettre à jour le convertisseur HL7 vers FHIR
 * en améliorant le traitement des noms français composés.
 */

const fs = require('fs');
const path = require('path');

// Chemin du fichier du convertisseur
const converterPath = path.join(__dirname, 'hl7ToFhirConverter.js');

// Lire le contenu du fichier du convertisseur
console.log(`Lecture du fichier ${converterPath}...`);
const content = fs.readFileSync(converterPath, 'utf8');

// Créer une sauvegarde du fichier original
const backupPath = path.join(__dirname, 'hl7ToFhirConverter.js.backup2');
console.log(`Création d'une sauvegarde dans ${backupPath}...`);
fs.writeFileSync(backupPath, content);

// Code original à remplacer - chercher la section qui traite les noms
const originalCode = `      // Ajouter le nom du patient avec traitement amélioré
      patientResource.name = [];
      
      // Traiter le nom principal (PID-5)
      if (hl7Data.PID.patientName && (hl7Data.PID.patientName.raw || hl7Data.PID.patientName.family)) {
        const nameObj = {
          family: hl7Data.PID.patientName.family || '',
          given: [],
          use: 'official'
        };
        
        // Ajouter tous les prénoms disponibles
        const allGivenNames = new Set();
        
        // Traitement plus complet du nom: 
        // Analyser en profondeur toutes les parties du nom disponibles
        
        // Ajouter le prénom principal
        if (hl7Data.PID.patientName.given && hl7Data.PID.patientName.given.trim() !== '') {
          allGivenNames.add(hl7Data.PID.patientName.given.trim());
        }
        
        // Ajouter les autres prénoms s'ils sont disponibles
        if (hl7Data.PID.patientName.middle && hl7Data.PID.patientName.middle.trim() !== '') {
          // Diviser les prénoms multiples s'ils sont séparés par des espaces
          const middleNames = hl7Data.PID.patientName.middle.split(' ');
          middleNames.forEach(name => {
            if (name.trim() !== '' && name.trim() !== hl7Data.PID.patientName.given) {
              allGivenNames.add(name.trim());
            }
          });
        }
        
        // Si nous avons la valeur brute, l'analyser pour des informations supplémentaires
        if (hl7Data.PID.patientName.raw) {
          const nameParts = hl7Data.PID.patientName.raw.split('^');
          // Vérifier si nous avons des parties de nom qui pourraient contenir des prénoms
          if (nameParts.length > 1 && nameParts[1].trim() !== '' && 
              !allGivenNames.has(nameParts[1].trim())) {
            allGivenNames.add(nameParts[1].trim());
          }
          
          // Vérifier les prénoms supplémentaires (partie 3 du format HL7)
          if (nameParts.length > 2 && nameParts[2].trim() !== '') {
            // Diviser les prénoms supplémentaires s'ils sont séparés par des espaces
            const additionalGivenNames = nameParts[2].trim().split(' ');
            additionalGivenNames.forEach(name => {
              if (name.trim() !== '' && !allGivenNames.has(name.trim())) {
                allGivenNames.add(name.trim());
              }
            });
          }
        }
        
        // Convertir le Set en tableau
        nameObj.given = Array.from(allGivenNames);
        
        // Ajouter le préfixe (exemple: "MME")
        if (hl7Data.PID.patientName.prefix && hl7Data.PID.patientName.prefix.trim() !== '') {
          nameObj.prefix = [hl7Data.PID.patientName.prefix];
        }
        
        // Ajouter le suffixe si disponible
        if (hl7Data.PID.patientName.suffix && hl7Data.PID.patientName.suffix.trim() !== '') {
          nameObj.suffix = [hl7Data.PID.patientName.suffix];
        }
        
        // Déterminer l'utilisation du nom (usage officiel ou courant)
        const fullNameParts = hl7Data.PID.patientName.raw.split('^');
        if (fullNameParts.length > 6 && fullNameParts[6] === 'D') {
          nameObj.use = 'usual';
        } else if (fullNameParts.length > 6 && fullNameParts[6] === 'L') {
          nameObj.use = 'official';
        }
        
        patientResource.name.push(nameObj);
      }
      
      // Traiter les noms supplémentaires s'ils existent (autres répétitions de PID-5)
      if (hl7Data.PID.alternatePatientName && hl7Data.PID.alternatePatientName.raw) {
        const altNameParts = hl7Data.PID.alternatePatientName.raw.split('^');
        if (altNameParts.length > 0 && altNameParts[0].trim() !== '') {
          const altNameObj = {
            family: altNameParts[0] || '',
            given: [],
            use: 'maiden' // Par défaut pour les noms alternatifs
          };
          
          // Ajouter les prénoms si disponibles
          if (altNameParts.length > 1 && altNameParts[1].trim() !== '') {
            altNameObj.given.push(altNameParts[1]);
          }
          
          if (altNameParts.length > 2 && altNameParts[2].trim() !== '') {
            altNameObj.given.push(altNameParts[2]);
          }
          
          // Déterminer l'utilisation du nom alternatif
          if (altNameParts.length > 6) {
            switch (altNameParts[6]) {
              case 'D': altNameObj.use = 'usual'; break;
              case 'L': altNameObj.use = 'official'; break;
              case 'M': altNameObj.use = 'maiden'; break;
              case 'N': altNameObj.use = 'nickname'; break;
              default: altNameObj.use = 'old';
            }
          }
          
          patientResource.name.push(altNameObj);
        }
      }
      
      // S'assurer qu'il y a au moins un nom
      if (patientResource.name.length === 0) {
        patientResource.name = [{
          family: hl7Data.PID.patientName ? (hl7Data.PID.patientName.family || '') : '',
          given: []
        }];
      }`;

// Nouveau code pour remplacer - amélioré pour traiter correctement les noms français composés
const newCode = `      // Ajouter le nom du patient avec traitement amélioré pour les messages français
      patientResource.name = [];
      
      // Traitement standard basé sur les données structurées
      if (hl7Data.PID && hl7Data.PID.patientName && (hl7Data.PID.patientName.raw || hl7Data.PID.patientName.family)) {
        const nameObj = {
          family: hl7Data.PID.patientName.family || '',
          given: [],
          use: 'official'
        };
        
        // Récupérer le prénom principal
        if (hl7Data.PID.patientName.given && hl7Data.PID.patientName.given.trim() !== '') {
          nameObj.given.push(hl7Data.PID.patientName.given.trim());
        }
        
        // Récupérer les autres prénoms
        if (hl7Data.PID.patientName.middle && hl7Data.PID.patientName.middle.trim() !== '') {
          const middleNames = hl7Data.PID.patientName.middle.split(' ');
          middleNames.forEach(name => {
            if (name.trim() !== '' && !nameObj.given.includes(name.trim())) {
              nameObj.given.push(name.trim());
            }
          });
        }
        
        // Récupérer le préfixe (M./Mme/etc.)
        if (hl7Data.PID.patientName.prefix && hl7Data.PID.patientName.prefix.trim() !== '') {
          nameObj.prefix = [hl7Data.PID.patientName.prefix.trim()];
        }
        
        // Récupérer le suffixe
        if (hl7Data.PID.patientName.suffix && hl7Data.PID.patientName.suffix.trim() !== '') {
          nameObj.suffix = [hl7Data.PID.patientName.suffix.trim()];
        }
        
        // Déterminer l'usage du nom (official/usual)
        if (hl7Data.PID.patientName.raw) {
          const fullNameParts = hl7Data.PID.patientName.raw.split('^');
          if (fullNameParts.length > 6) {
            switch (fullNameParts[6]) {
              case 'D': nameObj.use = 'usual'; break;
              case 'L': nameObj.use = 'official'; break;
              case 'M': nameObj.use = 'maiden'; break;
              case 'N': nameObj.use = 'nickname'; break;
              default: nameObj.use = 'official';
            }
          }
        }
        
        // Ajouter le nom à la liste
        if (nameObj.family && nameObj.family.trim() !== '') {
          patientResource.name.push(nameObj);
        }
      }
      
      // AMÉLIORATION SPÉCIFIQUE: Traitement direct des segments pour les messages français
      // Cette partie est essentielle pour traiter correctement les noms composés français
      // comme "SECLET^MARYSE^MARYSE BERTHE ALICE^^^^L"
      if (hl7Data.segments) {
        const pidSegments = hl7Data.segments.filter(s => s.name === 'PID');
        if (pidSegments.length > 0) {
          const pidSegment = pidSegments[0];
          
          // Chercher le champ PID-5 (position 5)
          const nameField = pidSegment.fields.find(f => f.position === 5);
          
          if (nameField && nameField.value && nameField.value.includes('~')) {
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
      
      // Traiter les noms supplémentaires du parseur (PID-5 répétitions)
      if (hl7Data.PID && hl7Data.PID.alternatePatientName && hl7Data.PID.alternatePatientName.raw) {
        const altNameParts = hl7Data.PID.alternatePatientName.raw.split('^');
        if (altNameParts.length > 0 && altNameParts[0].trim() !== '') {
          const altNameObj = {
            family: altNameParts[0] || '',
            given: [],
            use: 'maiden' // Par défaut pour les noms alternatifs
          };
          
          // Ajouter les prénoms si disponibles
          if (altNameParts.length > 1 && altNameParts[1].trim() !== '') {
            altNameObj.given.push(altNameParts[1]);
          }
          
          if (altNameParts.length > 2 && altNameParts[2].trim() !== '') {
            // Gérer les prénoms multiples séparés par des espaces
            const additionalGivenNames = altNameParts[2].trim().split(' ');
            additionalGivenNames.forEach(name => {
              if (name.trim() !== '' && !altNameObj.given.includes(name.trim())) {
                altNameObj.given.push(name.trim());
              }
            });
          }
          
          // Déterminer l'utilisation du nom alternatif
          if (altNameParts.length > 6) {
            switch (altNameParts[6]) {
              case 'D': altNameObj.use = 'usual'; break;
              case 'L': altNameObj.use = 'official'; break;
              case 'M': altNameObj.use = 'maiden'; break;
              case 'N': altNameObj.use = 'nickname'; break;
              default: altNameObj.use = 'old';
            }
          }
          
          // Vérifier si ce nom est déjà présent
          const isDuplicate = patientResource.name.some(n => 
            n.family === altNameObj.family && 
            n.use === altNameObj.use);
          
          if (!isDuplicate) {
            patientResource.name.push(altNameObj);
          }
        }
      }
      
      // S'assurer qu'il y a au moins un nom
      if (patientResource.name.length === 0) {
        patientResource.name = [{
          family: hl7Data.PID && hl7Data.PID.patientName ? (hl7Data.PID.patientName.family || '') : '',
          given: []
        }];
      }`;

// Rechercher et remplacer le code dans le fichier
console.log('Application de la correction...');
const updatedContent = content.replace(originalCode, newCode);

// Vérifier si la correction a fonctionné
if (updatedContent === content) {
  console.log('❌ Échec de la mise à jour: pattern non trouvé');
} else {
  // Écrire le fichier mis à jour
  fs.writeFileSync(converterPath, updatedContent);
  console.log('✅ Convertisseur mis à jour avec succès!');
  console.log('\nVous pouvez maintenant tester avec:');
  console.log('node test_french_hl7.js');
  console.log('\nEn cas de problème, restaurez le fichier original avec:');
  console.log(`mv ${backupPath} ${converterPath}`);
}