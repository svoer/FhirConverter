/**
 * Script pour déboguer le traitement des noms dans le parseur HL7
 */
const fs = require('fs');
const converter = require('./hl7ToFhirConverter');

const hl7Message = `MSH|^~\\&|CEGI|CEGI|OSIRIS|OSIRIS|20240326100615||ADT^A01^ADT_A01|56468389|P|2.5|||||FRA|8859/15|FR||^^^ 
EVN||20240326100603|||SPICHER@PAUCHET.COM|20240326000000 
PID|1||442777^^^CEGI&&M^PI~~248098060602525^^^ASIP-SANTE-INS-NIR&1.2.250.1.213.1.4.8&ISO^INS^^^~1000345108^^^CEGI&&M^PIP||SECLET^^^^MME^^D~SECLET^MARYSE^MARYSE BERTHE ALICE^^^^L||19480909|F|||7 RUE DU BOUJONNIER^^FORMERIE^^60220^^H~^^^^^^BDL^^80606||^PRN^PH^^^^^^^^^0608987212~~~^NET^Internet^MARYSE.SECLET@WANADOO.FR|||||R000171104^^^CEGI&&M^AN|||||OISEMONT (80140)|||||||||VALI`;

// Convertir le message HL7 en FHIR
const result = converter.convertHl7Content(hl7Message);

// Examiner le résultat
if (result.success) {
  console.log('✅ Conversion réussie!');
  
  // Extraire et afficher les données brutes du parseur
  console.log('\nDonnées de conversion:');
  console.log(Object.keys(result).join(', '));
  
  // Utiliser directement le parseur HL7
  const hl7Parser = require('./hl7_parser');
  const parsedHL7 = hl7Parser.processHL7Content(hl7Message);
  
  console.log('\nDonnées HL7 analysées par le parseur:');
  if (parsedHL7.success) {
    console.log('\nInfo patient:');
    console.log(JSON.stringify(parsedHL7.patientInfo, null, 2));
    
    // Afficher spécifiquement les identifiants INS
    if (parsedHL7.patientInfo && parsedHL7.patientInfo.identifiers) {
      const insIdentifier = parsedHL7.patientInfo.identifiers.find(id => 
        (id.system && id.system.includes('ASIP-SANTE-INS-NIR')) ||
        (id.oid && id.oid.includes('1.2.250.1.213.1.4.8'))
      );
      
      if (insIdentifier) {
        console.log('\nIdentifiant INS trouvé dans le PID:');
        console.log(JSON.stringify(insIdentifier, null, 2));
      }
    }
    
    // Afficher spécifiquement les noms du patient
    if (parsedHL7.patientInfo && parsedHL7.patientInfo.names) {
      console.log('\nTous les noms du patient:');
      console.log(JSON.stringify(parsedHL7.patientInfo.names, null, 2));
    }
  } else {
    console.error('\nErreur lors du parsing HL7:', parsedHL7.message);
  }
  
  // Afficher les ressources FHIR générées
  console.log('\nRessources FHIR générées:');
  const patientResource = result.fhirData.entry.find(entry => 
    entry.resource && entry.resource.resourceType === 'Patient'
  );
  
  if (patientResource) {
    console.log('\nRessource Patient:');
    console.log(JSON.stringify(patientResource.resource, null, 2));
  }
  
  const personResource = result.fhirData.entry.find(entry => 
    entry.resource && entry.resource.resourceType === 'Person'
  );
  
  if (personResource) {
    console.log('\nRessource Person:');
    console.log(JSON.stringify(personResource.resource.name, null, 2));
  }
} else {
  console.error('❌ Échec de la conversion:', result.message);
}