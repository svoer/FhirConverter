/**
 * Test pour la conversion des segments Z personnalisés (ZBE et ZFD)
 * 
 * Ce fichier permet de tester le traitement des segments Z personnalisés
 * dans la conversion HL7 vers FHIR
 */

const converter = require('./hl7ToFhirConverter');
const fs = require('fs');

// Message HL7 avec des segments Z personnalisés (ZBE et ZFD)
const hl7Message = `MSH|^~\\&|SENDING_APP|SENDING_FACILITY|RECEIVING_APP|RECEIVING_FACILITY|20230101120000||ADT^A01|MSG00001|P|2.5
EVN|A01|20230101120000|||ADMIN^JOHN^JAMES^^^^
PID|1||12345^^^HOPITAL^PI||DUPONT^JEAN^PIERRE^^^^||19800101|M|||1 RUE DE LA PAIX^^PARIS^^75001^FRANCE
PV1|1|I|CARDIOLOGIE^101^01|||||DOC01^MARTIN^JACQUES^^^^|||||||||V100
ZBE|EVENT_001|UPDATE|20230101120000|PREVIOUS_ROOM|CURRENT_ROOM|IMPORTANT_INDICATOR
ZFD|INS-NIR|20230101|VERIFIED|ADDITIONAL_INFO`;

// Créer un fichier temporaire avec le message HL7
const tempFile = 'temp_hl7_test.txt';
fs.writeFileSync(tempFile, hl7Message);

console.log('Test de conversion des segments Z personnalisés:');
console.log('--------------------------------------------');
console.log('Message HL7 original:');
console.log(hl7Message);
console.log('--------------------------------------------');

try {
  // Convertir le message HL7 en FHIR
  const result = converter.convertHl7Content(hl7Message);
  
  if (result.success) {
    console.log('Conversion réussie!');
    console.log('--------------------------------------------');
    
    // Vérifier si le bundle contient une ressource Provenance (pour ZBE)
    const provenanceResource = result.fhirData.entry.find(entry => 
      entry.resource && entry.resource.resourceType === 'Provenance'
    );
    
    if (provenanceResource) {
      console.log('✅ Segment ZBE correctement converti en ressource Provenance');
      console.log('Activité:', JSON.stringify(provenanceResource.resource.activity, null, 2));
    } else {
      console.log('❌ Segment ZBE non converti en ressource Provenance');
    }
    
    // Vérifier si le Patient contient des extensions (pour ZFD)
    const patientResource = result.fhirData.entry.find(entry => 
      entry.resource && entry.resource.resourceType === 'Patient'
    );
    
    if (patientResource && patientResource.resource.extension) {
      const zfdExtension = patientResource.resource.extension.find(ext => 
        ext.url.includes('insurance-type') || ext.url.includes('verification-date')
      );
      
      if (zfdExtension) {
        console.log('✅ Segment ZFD correctement converti en extension Patient');
        console.log('Extensions:', JSON.stringify(patientResource.resource.extension, null, 2));
      } else {
        console.log('❌ Segment ZFD non converti en extension Patient');
      }
    } else {
      console.log('❌ Patient sans extensions pour ZFD');
    }
    
    // Sauvegarder le résultat pour inspection
    fs.writeFileSync('test_z_result.json', JSON.stringify(result.fhirData, null, 2));
    console.log('Résultat complet sauvegardé dans test_z_result.json');
  } else {
    console.error('Échec de la conversion:', result.message);
  }
} catch (error) {
  console.error('Erreur lors du test:', error);
}

// Nettoyer
fs.unlinkSync(tempFile);
console.log('--------------------------------------------');
console.log('Test terminé');