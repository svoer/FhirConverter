/**
 * Script pour corriger la gestion des noms composés français dans le convertisseur HL7 -> FHIR
 * Pour corriger le problème avec les noms comme "SECLET^MARYSE^MARYSE BERTHE ALICE^^^^L"
 */

const fs = require('fs');
const path = require('path');
const converter = require('./hl7ToFhirConverter');

console.log("Début du test de correction pour les noms composés français");

// Message HL7 de test avec nom composé français
const hl7Message = `MSH|^~\\&|CEGI|CEGI|OSIRIS|OSIRIS|20240326100615||ADT^A01^ADT_A01|56468389|P|2.5|||||FRA|8859/15|FR||^^^ 
EVN||20240326100603|||SPICHER@PAUCHET.COM|20240326000000 
PID|1||442777^^^CEGI&&M^PI~~248098060602525^^^ASIP-SANTE-INS-NIR&1.2.250.1.213.1.4.8&ISO^INS^^^~1000345108^^^CEGI&&M^PIP||SECLET^^^^MME^^D~SECLET^MARYSE^MARYSE BERTHE ALICE^^^^L||19480909|F|||7 RUE DU BOUJONNIER^^FORMERIE^^60220^^H~^^^^^^BDL^^80606||^PRN^PH^^^^^^^^^0608987212~~~^NET^Internet^MARYSE.SECLET@WANADOO.FR|||||R000171104^^^CEGI&&M^AN|||||OISEMONT (80140)|||||||||VALI`;

// Fonction pour traiter les noms HL7 directement
function extractNamesFromHL7(hl7Message) {
  console.log("Extraction manuelle des noms du message HL7");
  
  // Récupérer la ligne PID
  const lines = hl7Message.split('\n');
  const pidLine = lines.find(line => line.startsWith('PID|'));
  
  if (!pidLine) {
    console.log("Aucune ligne PID trouvée");
    return [];
  }
  
  // Découper les champs du PID par le séparateur |
  const pidFields = pidLine.split('|');
  
  // Le champ PID-5 est à l'index 5 (positions basées sur 1, mais les tableaux sont basés sur 0)
  if (pidFields.length < 6) {
    console.log("Pas assez de champs dans le segment PID");
    return [];
  }
  
  // Le champ PID-5 contient le nom du patient, potentiellement avec répétitions
  const nameField = pidFields[5];
  
  // Si le champ est vide, retourner un tableau vide
  if (!nameField || nameField.trim() === '') {
    console.log("Champ nom vide");
    return [];
  }
  
  console.log("Champ nom brut:", nameField);
  
  // Le champ peut contenir plusieurs noms séparés par ~ (répétitions)
  const nameValues = nameField.split('~');
  
  // Traiter chaque valeur de nom
  const extractedNames = nameValues.map(nameVal => {
    // Séparer les composants par ^
    const components = nameVal.split('^');
    
    // Mapper les composants aux propriétés du nom
    // PID-5.1 = Nom de famille
    // PID-5.2 = Prénom
    // PID-5.3 = Second prénom (peut contenir des prénoms multiples)
    // PID-5.4 = Suffixe
    // PID-5.5 = Préfixe (Mr, Mme, etc.)
    // PID-5.6 = Type de nom
    // PID-5.7 = Code de type de nom (L=légal, D=usuel, etc.)
    
    // S'assurer que nous avons au moins un nom de famille
    if (components.length > 0 && components[0].trim() !== '') {
      const result = {
        family: components[0].trim(),
        given: [],
        use: 'official'
      };
      
      // Ajouter le prénom principal s'il existe
      if (components.length > 1 && components[1].trim() !== '') {
        result.given.push(components[1].trim());
      }
      
      // Ajouter les prénoms supplémentaires s'ils existent
      if (components.length > 2 && components[2].trim() !== '') {
        // Diviser par espace pour les prénoms multiples
        const middleNames = components[2].trim().split(' ');
        middleNames.forEach(name => {
          if (name.trim() !== '' && !result.given.includes(name.trim())) {
            result.given.push(name.trim());
          }
        });
      }
      
      // Ajouter le préfixe (M., Mme, etc.) s'il existe
      if (components.length > 4 && components[4].trim() !== '') {
        result.prefix = [components[4].trim()];
      }
      
      // Déterminer l'usage basé sur le code d'usage (Légal, Usuel, etc.)
      if (components.length > 6) {
        switch (components[6]) {
          case 'L': result.use = 'official'; break;
          case 'D': result.use = 'usual'; break;
          case 'M': result.use = 'maiden'; break;
          case 'N': result.use = 'nickname'; break;
          default: result.use = 'official'; break;
        }
      }
      
      return result;
    } else {
      return null;
    }
  }).filter(Boolean); // Filtrer les noms vides
  
  return extractedNames;
}

// Tester notre fonction d'extraction directe
const extractedNames = extractNamesFromHL7(hl7Message);
console.log("\nNoms extraits directement du message HL7:");
console.log(JSON.stringify(extractedNames, null, 2));

// Convertir le message avec le convertisseur existant
console.log("\nTentative de conversion avec le convertisseur standard:");
const conversionResult = converter.convertHl7Content(hl7Message);

if (conversionResult.success) {
  // Trouver la ressource Patient
  const patientResource = conversionResult.fhirData.entry.find(entry => 
    entry.resource && entry.resource.resourceType === 'Patient'
  );
  
  if (patientResource) {
    console.log("\nNoms extraits par le convertisseur standard:");
    console.log(JSON.stringify(patientResource.resource.name, null, 2));
    
    // Comparer les résultats
    console.log("\nÉvaluation des résultats:");
    
    // Vérifier si le nom légal avec tous les prénoms est correctement extrait
    const hasCompleteName = patientResource.resource.name.some(name => 
      name.given && name.given.includes('MARYSE') && 
      name.given.some(given => given.includes('BERTHE'))
    );
    
    if (hasCompleteName) {
      console.log("✅ Le convertisseur extrait correctement les prénoms multiples");
    } else {
      console.log("❌ Le convertisseur ne parvient pas à extraire les prénoms multiples");
      console.log("\nCorrection recommandée: Implémenter la fonction d'extraction présentée ici");
    }
  } else {
    console.log("Ressource Patient non trouvée dans le résultat de la conversion");
  }
} else {
  console.log("Erreur de conversion:", conversionResult.message);
}

// Fonction pour corriger le convertisseur (à utiliser pour modifier le fichier)
function patchConverterFile() {
  const converterPath = path.join(__dirname, 'hl7ToFhirConverter.js');
  let content = fs.readFileSync(converterPath, 'utf8');
  
  // Chercher la section où les noms sont traités
  const nameProcessingPattern = /\/\/ Ajouter le nom du patient[\s\S]*?patientResource\.name = \[\];/;
  
  const patchedCode = `
      // Ajouter le nom du patient avec traitement amélioré des noms composés français
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
                  
                  // Ajouter les prénoms supplémentaires
                  if (nameParts.length > 2 && nameParts[2].trim() !== '') {
                    // Diviser les prénoms multiples par espace
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
            given: []
          }];
        }
      }`;
  
  // Remplacer la section du code
  const updatedContent = content.replace(nameProcessingPattern, patchedCode);
  
  if (updatedContent !== content) {
    // Écrire le fichier mis à jour
    fs.writeFileSync(converterPath + '.backup', content); // Créer une sauvegarde
    fs.writeFileSync(converterPath, updatedContent);
    console.log("\n✅ Le fichier du convertisseur a été mis à jour avec succès");
    console.log("Une sauvegarde a été créée: hl7ToFhirConverter.js.backup");
  } else {
    console.log("\n❌ Impossible de localiser la section à patcher dans le convertisseur");
  }
}

// Exécuter le correctif si demandé en ligne de commande
if (process.argv.includes('--apply')) {
  console.log("\nApplication du correctif au fichier hl7ToFhirConverter.js");
  patchConverterFile();
} else {
  console.log("\nPour appliquer le correctif, exécutez: node fix_converter.js --apply");
}