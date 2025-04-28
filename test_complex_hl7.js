/**
 * Test pour un message HL7 complexe avec plusieurs segments
 * 
 * Ce test vérifie la capacité du convertisseur à gérer un message HL7 complet
 * provenant d'un système externe, avec de nombreux segments différents.
 */

const converter = require('./hl7ToFhirConverter');
const fs = require('fs');

// Message HL7 complexe (exemple international)
const hl7Message = `MSH|^~\\&|MESA_ADT|XYZ_ADMITTING|iFW|ZYX_HOSPITAL|||ADT^A04|103102|P|2.4||||||||
EVN||200007010800||||200007010800
PID|||583295^^^ADT1||DOE^JANE||19610615|M-||2106-3|123 MAIN STREET^^GREENSBORO^NC^27401-1020|GL|(919)379-1212|(919)271-3434~(919)277-3114||S||PATID12345001^2^M10|123456789|9-87654^NC
NK1|1|BATES^RONALD^L|SPO|||||20011105
PV1||E||||||5101^NELL^FREDERICK^P^^DR|||||||||||V1295^^^ADT1|||||||||||||||||||||||||200007010800||||||||
PV2|||^ABDOMINAL PAIN
OBX|1|HD|SR Instance UID||1.123456.2.2000.31.2.1||||||F||||||
AL1|1||^PENICILLIN||PRODUCES HIVES~RASH
AL1|2||^CAT DANDER
DG1|001|I9|1550|MAL NEO LIVER, PRIMARY|19880501103005|F||
PR1|2234|M11|111^CODE151|COMMON PROCEDURES|198809081123
ROL|45^RECORDER^ROLE MASTER LIST|AD|CP|KATE^SMITH^ELLEN|199505011201
GT1|1122|1519|BILL^GATES^A
IN1|001|A357|1234|BCMD|||||132987
IN2|ID1551001|SSN12345678`;

// Créer un fichier temporaire avec le message HL7
const tempFile = 'temp_complex_hl7_test.txt';
fs.writeFileSync(tempFile, hl7Message);

console.log('Test de conversion d\'un message HL7 complexe international:');
console.log('--------------------------------------------');
console.log('Message HL7 original:');
console.log(hl7Message);
console.log('--------------------------------------------');

try {
  // Convertir le message HL7 en FHIR
  const result = converter.convertHl7Content(hl7Message);
  
  if (result.success) {
    console.log('✅ Conversion réussie!');
    console.log('--------------------------------------------');
    
    // Vérifier les différents types de ressources créées
    const bundle = result.fhirData;
    const resourceTypes = new Set();
    
    // Collecter tous les types de ressources
    bundle.entry.forEach(entry => {
      if (entry.resource && entry.resource.resourceType) {
        resourceTypes.add(entry.resource.resourceType);
      }
    });
    
    console.log('Types de ressources FHIR générés:');
    console.log(Array.from(resourceTypes).join(', '));
    console.log('--------------------------------------------');
    
    // Vérifier si certains segments spécifiques ont été convertis correctement
    
    // 1. Patient
    const patientResource = bundle.entry.find(entry => 
      entry.resource && entry.resource.resourceType === 'Patient'
    );
    
    if (patientResource) {
      console.log('✅ Patient correctement créé');
      console.log(`   Identifiant: ${patientResource.resource.id}`);
      if (patientResource.resource.name && patientResource.resource.name.length > 0) {
        console.log(`   Nom: ${patientResource.resource.name[0].family}, ${patientResource.resource.name[0].given.join(' ')}`);
      }
    } else {
      console.log('❌ Patient non créé');
    }
    
    // 2. Encounter (PV1)
    const encounterResource = bundle.entry.find(entry => 
      entry.resource && entry.resource.resourceType === 'Encounter'
    );
    
    if (encounterResource) {
      console.log('✅ Encounter correctement créé');
      console.log(`   Identifiant: ${encounterResource.resource.id}`);
      console.log(`   Status: ${encounterResource.resource.status}`);
    } else {
      console.log('❌ Encounter non créé');
    }
    
    // 3. AllergyIntolerance (AL1)
    const allergyResources = bundle.entry.filter(entry => 
      entry.resource && entry.resource.resourceType === 'AllergyIntolerance'
    );
    
    if (allergyResources.length > 0) {
      console.log(`✅ ${allergyResources.length} AllergyIntolerance correctement créées`);
      allergyResources.forEach(allergy => {
        if (allergy.resource.code && allergy.resource.code.coding) {
          console.log(`   Allergie: ${allergy.resource.code.coding[0].display || allergy.resource.code.text || 'Non spécifiée'}`);
        }
      });
    } else {
      console.log('❌ AllergyIntolerance non créées');
    }
    
    // 4. Observation (OBX)
    const observationResource = bundle.entry.find(entry => 
      entry.resource && entry.resource.resourceType === 'Observation'
    );
    
    if (observationResource) {
      console.log('✅ Observation correctement créée');
      console.log(`   Identifiant: ${observationResource.resource.id}`);
      if (observationResource.resource.code) {
        console.log(`   Code: ${observationResource.resource.code.text || 'Non spécifié'}`);
      }
    } else {
      console.log('❌ Observation non créée');
    }
    
    // 5. Condition (DG1)
    const conditionResource = bundle.entry.find(entry => 
      entry.resource && entry.resource.resourceType === 'Condition'
    );
    
    if (conditionResource) {
      console.log('✅ Condition correctement créée');
      console.log(`   Identifiant: ${conditionResource.resource.id}`);
      if (conditionResource.resource.code) {
        console.log(`   Code: ${conditionResource.resource.code.text || 'Non spécifié'}`);
      }
    } else {
      console.log('❌ Condition non créée');
    }
    
    // 6. Procedure (PR1)
    const procedureResource = bundle.entry.find(entry => 
      entry.resource && entry.resource.resourceType === 'Procedure'
    );
    
    if (procedureResource) {
      console.log('✅ Procedure correctement créée');
      console.log(`   Identifiant: ${procedureResource.resource.id}`);
      if (procedureResource.resource.code) {
        console.log(`   Code: ${procedureResource.resource.code.text || 'Non spécifié'}`);
      }
    } else {
      console.log('❌ Procedure non créée');
    }
    
    // 7. RelatedPerson (NK1)
    const relatedPersonResource = bundle.entry.find(entry => 
      entry.resource && entry.resource.resourceType === 'RelatedPerson'
    );
    
    if (relatedPersonResource) {
      console.log('✅ RelatedPerson correctement créé');
      console.log(`   Identifiant: ${relatedPersonResource.resource.id}`);
      if (relatedPersonResource.resource.name && relatedPersonResource.resource.name.length > 0) {
        console.log(`   Nom: ${relatedPersonResource.resource.name[0].family}, ${relatedPersonResource.resource.name[0].given.join(' ')}`);
      }
      if (relatedPersonResource.resource.relationship) {
        console.log(`   Relation: ${relatedPersonResource.resource.relationship.coding[0].code || 'Non spécifiée'}`);
      }
    } else {
      console.log('❌ RelatedPerson non créé');
    }
    
    // 8. Practitioner (référence à 5101^NELL^FREDERICK dans PV1)
    const practitionerResource = bundle.entry.find(entry => 
      entry.resource && entry.resource.resourceType === 'Practitioner'
    );
    
    if (practitionerResource) {
      console.log('✅ Practitioner correctement créé');
      console.log(`   Identifiant: ${practitionerResource.resource.id}`);
      if (practitionerResource.resource.name && practitionerResource.resource.name.length > 0) {
        console.log(`   Nom: ${practitionerResource.resource.name[0].family}, ${practitionerResource.resource.name[0].given.join(' ')}`);
      }
    } else {
      console.log('❌ Practitioner non créé');
    }
    
    // 9. Coverage (IN1)
    const coverageResource = bundle.entry.find(entry => 
      entry.resource && entry.resource.resourceType === 'Coverage'
    );
    
    if (coverageResource) {
      console.log('✅ Coverage correctement créé');
      console.log(`   Identifiant: ${coverageResource.resource.id}`);
    } else {
      console.log('❌ Coverage non créé');
    }
    
    // Sauvegarder le résultat pour inspection
    fs.writeFileSync('complex_hl7_result.json', JSON.stringify(result.fhirData, null, 2));
    console.log('Résultat complet sauvegardé dans complex_hl7_result.json');
  } else {
    console.error('❌ Échec de la conversion:', result.message);
  }
} catch (error) {
  console.error('❌ Erreur lors du test:', error);
}

// Nettoyer
fs.unlinkSync(tempFile);
console.log('--------------------------------------------');
console.log('Test terminé');