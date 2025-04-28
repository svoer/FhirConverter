/**
 * Script de test spécifique pour la gestion des noms composés français dans le convertisseur HL7 vers FHIR.
 * Ce script utilise une fonction directe d'extraction qui corrige le problème, puis affiche le résultat.
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

// Utiliser le convertisseur standard pour comparer
console.log("\nComparaison avec le convertisseur standard:");
const conversionResult = converter.convertHl7Content(hl7Message);

if (conversionResult.success) {
  // Trouver la ressource Patient
  const patientResource = conversionResult.fhirData.entry.find(entry => 
    entry.resource && entry.resource.resourceType === 'Patient'
  );
  
  if (patientResource) {
    console.log("Noms extraits par le convertisseur standard:");
    console.log(JSON.stringify(patientResource.resource.name, null, 2));
    
    // Création d'un bundle FHIR modifié avec nos noms améliorés
    const correctedBundle = JSON.parse(JSON.stringify(conversionResult.fhirData));
    const correctedPatient = correctedBundle.entry.find(entry => 
      entry.resource && entry.resource.resourceType === 'Patient'
    );
    
    if (correctedPatient) {
      // Remplacer les noms par ceux que nous avons extraits
      correctedPatient.resource.name = frenchNames;
      
      // Écrire le bundle corrigé dans un fichier
      fs.writeFileSync('french_hl7_corrected.json', JSON.stringify(correctedBundle, null, 2));
      console.log("\n✅ Bundle FHIR corrigé créé dans 'french_hl7_corrected.json'");
      
      // Afficher le patient corrigé
      console.log("\nPatient avec noms corrigés:");
      const patientInfo = {
        id: correctedPatient.resource.id,
        identifiers: correctedPatient.resource.identifier
          .filter(id => id.system.includes('1.2.250.1.213.1.4.8'))
          .map(id => `${id.value} (${id.type?.coding?.[0]?.code || 'inconnu'})`),
        name: correctedPatient.resource.name.map(n => ({
          family: n.family,
          given: n.given?.join(' ') || '[Non spécifié]',
          use: n.use,
          prefix: n.prefix
        }))
      };
      
      console.log(JSON.stringify(patientInfo, null, 2));
    }
  }
}

console.log("\n✅ Test terminé");
console.log("Pour corriger le convertisseur principal:");
console.log("1. Implémenter cette méthode d'extraction dans hl7ToFhirConverter.js");
console.log("2. Chercher la section de traitement des noms patients et la remplacer par l'implémentation de ce script");
console.log("3. Tester à nouveau avec: node test_french_hl7.js");