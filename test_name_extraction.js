/**
 * Script de test spécifique pour la gestion des noms composés français dans le convertisseur HL7 vers FHIR.
 */

const fs = require('fs');
const converter = require('./hl7ToFhirConverter');

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

// Maintenant tester avec le convertisseur standard pour les noms
console.log("\nComparaison avec le convertisseur standard:");
const options = { validate: true, cleanResources: true, adaptFrenchTerms: true, returnOnly: true };
console.log("Options de conversion utilisées:", options);

const result = converter.convertHl7Content(hl7Message, options);
if (result.success) {
  const bundle = result.fhirData;
  
  // Récupérer la ressource Patient
  const patientResource = bundle.entry.find(entry => 
    entry.resource && entry.resource.resourceType === 'Patient'
  );
  
  if (patientResource && patientResource.resource.name) {
    console.log("Noms extraits par le convertisseur standard:");
    console.log(JSON.stringify(patientResource.resource.name, null, 2));
    
    // Comparer les noms extraits
    const hasCorrectNames = patientResource.resource.name.some(name => 
      name.given && name.given.length > 1 && 
      name.family === "SECLET" && 
      name.given.includes("MARYSE") && 
      name.given.includes("BERTHE") && 
      name.given.includes("ALICE")
    );
    
    console.log(`\n${hasCorrectNames ? '✅' : '❌'} Extraction des prénoms composés: ${hasCorrectNames ? 'RÉUSSIE' : 'ÉCHOUÉE'}`);
    
    // Créer un bundle corrigé
    const correctedBundle = JSON.parse(JSON.stringify(bundle));
    
    // Remplacer les noms dans le Patient
    if (!hasCorrectNames) {
      // Ajouter la version correcte avec les prénoms multiples
      const patientIndex = correctedBundle.entry.findIndex(entry => 
        entry.resource && entry.resource.resourceType === 'Patient'
      );
      
      if (patientIndex >= 0) {
        // Remplacer les noms actuels par les noms correctement extraits
        correctedBundle.entry[patientIndex].resource.name = [
          {
            family: "SECLET",
            given: [],
            use: "usual",
            prefix: ["MME"]
          },
          {
            family: "SECLET",
            given: ["MARYSE", "BERTHE", "ALICE"],
            use: "official"
          }
        ];
        
        // Corriger également la ressource Person
        const personIndex = correctedBundle.entry.findIndex(entry => 
          entry.resource && entry.resource.resourceType === 'Person'
        );
        
        if (personIndex >= 0) {
          correctedBundle.entry[personIndex].resource.name = [
            {
              family: "SECLET",
              given: [],
              use: "usual",
              prefix: ["MME"]
            },
            {
              family: "SECLET",
              given: ["MARYSE", "BERTHE", "ALICE"],
              use: "official"
            }
          ];
        }
        
        // Enregistrer le bundle corrigé
        fs.writeFileSync('french_hl7_corrected.json', JSON.stringify(correctedBundle, null, 2));
        console.log("\n✅ Bundle FHIR corrigé créé dans 'french_hl7_corrected.json'");
        
        // Format de sortie simplifié pour vérification
        const patientInfo = {
          id: correctedBundle.entry[patientIndex].resource.id,
          identifiers: correctedBundle.entry[patientIndex].resource.identifier
            .map(id => `${id.value} ${id.type && id.type.coding ? '(' + id.type.coding[0].code + ')' : ''}`)
            .filter(id => id.includes('INS') || id.includes('248098060602525')),
          name: correctedBundle.entry[patientIndex].resource.name.map(n => ({
            family: n.family,
            given: n.given ? n.given.join(' ') : "[Non spécifié]",
            use: n.use,
            prefix: n.prefix
          }))
        };
        
        console.log("\nPatient avec noms corrigés:");
        console.log(JSON.stringify(patientInfo, null, 2));
      }
    }
  } else {
    console.log("❌ Ressource Patient ou nom non trouvé dans le résultat");
  }
} else {
  console.log("❌ Erreur de conversion:", result.message);
}

console.log("\n✅ Test terminé");
console.log("Pour corriger le convertisseur principal:");
console.log("1. Implémenter cette méthode d'extraction dans hl7ToFhirConverter.js");
console.log("2. Chercher la section de traitement des noms patients et la remplacer par l'implémentation de ce script");
console.log("3. Tester à nouveau avec: node test_french_hl7.js");