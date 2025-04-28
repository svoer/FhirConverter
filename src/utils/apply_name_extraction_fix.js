/**
 * Script pour appliquer le correctif d'extraction des noms français
 * au convertisseur HL7 vers FHIR
 */
const fs = require('fs');

const converterFile = 'hl7ToFhirConverter.js';
console.log(`Application du correctif d'extraction des noms français au fichier ${converterFile}`);

// Lire le contenu actuel du fichier
const fileContent = fs.readFileSync(converterFile, 'utf8');

// Trouver la section de traitement des noms patients
const nameProcessingRegex = /\/\/ Ajouter le nom du patient avec traitement amélioré[^\n]*\s+patientResource\.name = \[\];[\s\S]*?\/\/ S'assurer qu'il y a au moins un nom[\s\S]*?family: hl7Data\.PID\.patientName.*\n.*\s+given: \[\]/g;

// Vérifier si nous avons trouvé la section
if (!nameProcessingRegex.test(fileContent)) {
  console.error('❌ Section de traitement des noms non trouvée dans le convertisseur.');
  console.log('Assurez-vous que le fichier contient la section commençant par "// Ajouter le nom du patient"');
  process.exit(1);
}

// Préparer le bloc de code de remplacement
const replacementCode = `// Ajouter le nom du patient avec traitement amélioré pour les noms composés français
      patientResource.name = [];
      
      // Traiter les noms du patient (PID-5) avec support pour noms français composés
      if (hl7Data.PID) {
        // Si nous avons accès aux segments bruts, analyser directement le champ PID-5
        if (hl7Data.segments) {
          const pidSegments = hl7Data.segments.filter(s => s.name === 'PID');
          if (pidSegments.length > 0) {
            const pidSegment = pidSegments[0];
            const nameField = pidSegment.fields.find(f => f.position === 5);
            
            if (nameField && nameField.value) {
              // Traiter les répétitions dans le champ nom (séparées par ~)
              const nameValues = nameField.value.split('~');
              
              // Pour chaque valeur de nom
              nameValues.forEach(nameVal => {
                const nameParts = nameVal.split('^');
                
                // Vérifier que nous avons au moins un nom de famille
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
                  
                  // Ajouter le prénom principal
                  if (nameParts.length > 1 && nameParts[1].trim() !== '') {
                    nameObj.given.push(nameParts[1].trim());
                  }
                  
                  // Ajouter les prénoms supplémentaires - CORRECTION POUR NOMS FRANÇAIS
                  if (nameParts.length > 2 && nameParts[2].trim() !== '') {
                    // Diviser les prénoms multiples par espace - ESSENTIEL POUR LES PRÉNOMS COMPOSÉS
                    const additionalNames = nameParts[2].trim().split(' ');
                    additionalNames.forEach(name => {
                      if (name.trim() !== '' && !nameObj.given.includes(name.trim())) {
                        nameObj.given.push(name.trim());
                      }
                    });
                  }
                  
                  // Ajouter le préfixe
                  if (nameParts.length > 4 && nameParts[4].trim() !== '') {
                    nameObj.prefix = [nameParts[4].trim()];
                  }
                  
                  // Ajouter le suffixe
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
        
        // Si aucun nom n'a été ajouté, utiliser les données parsées
        if (patientResource.name.length === 0 && hl7Data.PID.patientName) {
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
          
          patientResource.name.push(nameObj);
        }
        
        // S'assurer qu'il y a au moins un nom
        if (patientResource.name.length === 0) {
          patientResource.name = [{
            family: hl7Data.PID.patientName ? (hl7Data.PID.patientName.family || '') : '',
            given: []`;

// Appliquer le remplacement
const updatedContent = fileContent.replace(nameProcessingRegex, replacementCode);

// Écrire le contenu mis à jour dans le fichier
fs.writeFileSync(converterFile, updatedContent, 'utf8');

console.log('✅ Correctif appliqué avec succès!');
console.log('Pour tester le correctif, exécutez: node test_french_hl7.js');

// Mettre à jour la ressource Person pour qu'elle n'utilise pas directement patientResource.name
const personRegex = /(const personResource = {\s+resourceType: 'Person',\s+id: personId,\s+)name: patientResource\.name,/g;
const personReplacementCode = '$1name: JSON.parse(JSON.stringify(patientResource.name)), // Copie profonde pour éviter les problèmes de référence';

if (personRegex.test(updatedContent)) {
  const finalContent = updatedContent.replace(personRegex, personReplacementCode);
  fs.writeFileSync(converterFile, finalContent, 'utf8');
  console.log('✅ Correction supplémentaire appliquée à la ressource Person.');
} else {
  console.log('⚠️ Section de la ressource Person non trouvée pour correction.');
}