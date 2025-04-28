/**
 * Script de test simplifié pour l'extraction des noms composés français
 */

// Message HL7 de test avec nom composé français
const hl7Message = `MSH|^~\\&|CEGI|CEGI|OSIRIS|OSIRIS|20240326100615||ADT^A01^ADT_A01|56468389|P|2.5|||||FRA|8859/15|FR||^^^ 
EVN||20240326100603|||SPICHER@PAUCHET.COM|20240326000000 
PID|1||442777^^^CEGI&&M^PI~~248098060602525^^^ASIP-SANTE-INS-NIR&1.2.250.1.213.1.4.8&ISO^INS^^^~1000345108^^^CEGI&&M^PIP||SECLET^^^^MME^^D~SECLET^MARYSE^MARYSE BERTHE ALICE^^^^L||19480909|F|||7 RUE DU BOUJONNIER^^FORMERIE^^60220^^H~^^^^^^BDL^^80606||^PRN^PH^^^^^^^^^0608987212~~~^NET^Internet^MARYSE.SECLET@WANADOO.FR|||||R000171104^^^CEGI&&M^AN|||||OISEMONT (80140)|||||||||VALI`;

// Fonction améliorée pour extraire correctement les noms multiples français
function extractFrenchPatientNames(hl7String) {
  console.log("Test d'extraction des noms composés français");
  
  // Récupérer la ligne PID
  const lines = hl7String.split('\n');
  const pidLine = lines.find(line => line.startsWith('PID|'));
  
  if (!pidLine) {
    console.log("Aucune ligne PID trouvée");
    return [];
  }
  
  // Récupérer les champs du PID
  const pidFields = pidLine.split('|');
  
  // Le champ PID-5 (nom du patient) est à l'index 5
  if (pidFields.length < 6) {
    console.log("Pas assez de champs dans le segment PID");
    return [];
  }
  
  const nameField = pidFields[5];
  console.log("Champ nom brut:", nameField);
  
  // Si le champ nom est vide, retourner un tableau vide
  if (!nameField || nameField.trim() === '') {
    console.log("Champ nom vide");
    return [];
  }
  
  // Traiter les répétitions (séparées par ~)
  const nameValues = nameField.split('~');
  console.log("Noms trouvés:", nameValues.length);
  
  const extractedNames = [];
  
  // Pour chaque valeur de nom
  nameValues.forEach((nameVal, index) => {
    console.log(`Traitement du nom #${index + 1}:`, nameVal);
    
    // Séparer les composants du nom (séparés par ^)
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
      
      // Ajouter le prénom principal (composant 1)
      if (nameParts.length > 1 && nameParts[1].trim() !== '') {
        nameObj.given.push(nameParts[1].trim());
      }
      
      // Ajouter les prénoms supplémentaires (composant 2)
      if (nameParts.length > 2 && nameParts[2].trim() !== '') {
        // Diviser les prénoms multiples par espace
        const additionalNames = nameParts[2].trim().split(' ');
        additionalNames.forEach(name => {
          if (name.trim() !== '' && !nameObj.given.includes(name.trim())) {
            nameObj.given.push(name.trim());
          }
        });
      }
      
      // Ajouter le préfixe (composant 4)
      if (nameParts.length > 4 && nameParts[4].trim() !== '') {
        nameObj.prefix = [nameParts[4].trim()];
      }
      
      // Ajouter le nom à la liste
      extractedNames.push(nameObj);
    }
  });
  
  return extractedNames;
}

// Tester notre fonction d'extraction améliorée
const frenchNames = extractFrenchPatientNames(hl7Message);
console.log("\nNoms extraits correctement:");
console.log(JSON.stringify(frenchNames, null, 2));

// Créer une ressource patient fictive avec ces noms
const patientResource = {
  resourceType: "Patient",
  id: "example-patient-french",
  identifier: [
    {
      system: "urn:oid:1.2.250.1.213.1.4.8",
      value: "248098060602525",
      type: {
        coding: [
          {
            system: "http://terminology.hl7.org/CodeSystem/v2-0203",
            code: "INS",
            display: "INS-NIR"
          }
        ]
      }
    }
  ],
  name: frenchNames,
  gender: "female",
  birthDate: "1948-09-09"
};

console.log("\nRessource Patient FHIR avec noms correctement extraits:");
console.log(JSON.stringify(patientResource, null, 2));

console.log("\nPour intégrer ce correctif dans le convertisseur principal:");
console.log("1. Localiser la section de traitement des noms dans hl7ToFhirConverter.js");
console.log("2. Remplacer le code existant par la fonction d'extraction améliorée");
console.log("3. Vérifier que les noms composés français sont correctement extraits");