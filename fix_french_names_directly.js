/**
 * Script pour directement appliquer la correction d'extraction des noms français
 * Ce script va directement modifier le fichier résultat HL7 pour corriger les noms
 * sans passer par le convertisseur complet
 */
const fs = require('fs');

// Test d'extraction avec le message de test
const hl7Message = `MSH|^~\\&|CEGI|CEGI|OSIRIS|OSIRIS|20240326100615||ADT^A01^ADT_A01|56468389|P|2.5|||||FRA|8859/15|FR||^^^ 
EVN||20240326100603|||SPICHER@PAUCHET.COM|20240326000000 
PID|1||442777^^^CEGI&&M^PI~~248098060602525^^^ASIP-SANTE-INS-NIR&1.2.250.1.213.1.4.8&ISO^INS^^^~1000345108^^^CEGI&&M^PIP||SECLET^^^^MME^^D~SECLET^MARYSE^MARYSE BERTHE ALICE^^^^L||19480909|F|||7 RUE DU BOUJONNIER^^FORMERIE^^60220^^H~^^^^^^BDL^^80606||^PRN^PH^^^^^^^^^0608987212~~~^NET^Internet^MARYSE.SECLET@WANADOO.FR|||||R000171104^^^CEGI&&M^AN|||||OISEMONT (80140)|||||||||VALI`;

// Extraire les noms correctement
function extractFrenchNames(hl7Message) {
  // Trouver le segment PID
  const pidLine = hl7Message.split('\n').find(line => line.startsWith('PID|'));
  if (!pidLine) return null;
  
  // Extraire le champ du nom (PID-5)
  const pidFields = pidLine.split('|');
  if (pidFields.length < 6) return null;
  
  const nameField = pidFields[5];
  console.log("Champ nom brut:", nameField);
  
  // Extraire les noms
  const nameValues = nameField.split('~');
  const extractedNames = [];
  
  nameValues.forEach((nameVal, index) => {
    console.log(`Nom #${index + 1}:`, nameVal);
    const nameParts = nameVal.split('^');
    
    if (nameParts.length > 0 && nameParts[0]) {
      // Déterminer l'usage du nom
      let nameUse = 'official';
      if (nameParts.length > 6) {
        switch (nameParts[6]) {
          case 'L': nameUse = 'official'; break;
          case 'D': nameUse = 'usual'; break;
          case 'M': nameUse = 'maiden'; break;
          case 'N': nameUse = 'nickname'; break;
        }
      }
      
      // Créer l'objet nom
      const nameObj = {
        family: nameParts[0],
        given: [],
        use: nameUse
      };
      
      // Prénom principal
      if (nameParts.length > 1 && nameParts[1]) {
        nameObj.given.push(nameParts[1]);
      }
      
      // Prénoms supplémentaires (composés)
      if (nameParts.length > 2 && nameParts[2]) {
        const additionalNames = nameParts[2].split(' ');
        additionalNames.forEach(name => {
          if (name && name.trim() && !nameObj.given.includes(name.trim())) {
            nameObj.given.push(name.trim());
          }
        });
      }
      
      // Préfixe
      if (nameParts.length > 4 && nameParts[4]) {
        nameObj.prefix = [nameParts[4]];
      }
      
      extractedNames.push(nameObj);
    }
  });
  
  return extractedNames;
}

// Extraire les noms correctement
const correctNames = extractFrenchNames(hl7Message);
console.log("\nNoms correctement extraits:");
console.log(JSON.stringify(correctNames, null, 2));

// Charger et corriger le fichier résultat
const resultFile = 'french_hl7_result.json';
if (fs.existsSync(resultFile)) {
  console.log(`\nCorrection du fichier ${resultFile}...`);
  const data = JSON.parse(fs.readFileSync(resultFile, 'utf8'));
  
  // Trouver les ressources Patient et Person
  let patientIndex = -1;
  let personIndex = -1;
  
  data.entry.forEach((entry, index) => {
    if (entry.resource && entry.resource.resourceType === 'Patient') {
      patientIndex = index;
    } else if (entry.resource && entry.resource.resourceType === 'Person') {
      personIndex = index;
    }
  });
  
  // Appliquer les noms corrects
  if (patientIndex >= 0) {
    console.log("Correction de la ressource Patient...");
    data.entry[patientIndex].resource.name = correctNames;
  }
  
  if (personIndex >= 0) {
    console.log("Correction de la ressource Person...");
    data.entry[personIndex].resource.name = JSON.parse(JSON.stringify(correctNames));
  }
  
  // Enregistrer le fichier corrigé
  fs.writeFileSync('french_hl7_corrected.json', JSON.stringify(data, null, 2));
  console.log("✅ Fichier corrigé enregistré sous 'french_hl7_corrected.json'");
  
  // Afficher les noms corrigés
  if (patientIndex >= 0) {
    console.log("\nNoms corrigés dans la ressource Patient:");
    console.log(JSON.stringify(data.entry[patientIndex].resource.name, null, 2));
  }
  
  console.log("\n✅ CORRECTION TERMINÉE");
  console.log("Pour que la correction soit permanente, il faut modifier le code du convertisseur:");
  console.log("1. Inspecter la fonction qui traite le champ PID-5 dans hl7ToFhirConverter.js");
  console.log("2. Assurez-vous que les prénoms multiples (composant 2) sont correctement séparés par des espaces");
  console.log("3. Pour le débugger, utiliser: console.log('Segment PID:', segment) avant le traitement");
} else {
  console.log(`Fichier ${resultFile} non trouvé. Exécutez d'abord test_french_hl7.js`);
}