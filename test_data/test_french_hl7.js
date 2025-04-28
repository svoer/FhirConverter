/**
 * Test pour un message HL7 français complet avec segments ZBE et ZFD
 * 
 * Ce test vérifie la capacité du convertisseur à gérer un message HL7 français
 * avec des identifiants INS-NIR, des segments personnalisés et des données complexes.
 */

const converter = require('./hl7ToFhirConverter');
const fs = require('fs');

// Message HL7 français complet avec segments Z
const hl7Message = `MSH|^~\\&|CEGI|CEGI|OSIRIS|OSIRIS|20240326100615||ADT^A01^ADT_A01|56468389|P|2.5|||||FRA|8859/15|FR||^^^ 
EVN||20240326100603|||SPICHER@PAUCHET.COM|20240326000000 
PID|1||442777^^^CEGI&&M^PI~~248098060602525^^^ASIP-SANTE-INS-NIR&1.2.250.1.213.1.4.8&ISO^INS^^^~1000345108^^^CEGI&&M^PIP||SECLET^^^^MME^^D~SECLET^MARYSE^MARYSE BERTHE ALICE^^^^L||19480909|F|||7 RUE DU BOUJONNIER^^FORMERIE^^60220^^H~^^^^^^BDL^^80606||^PRN^PH^^^^^^^^^0608987212~~~^NET^Internet^MARYSE.SECLET@WANADOO.FR|||||R000171104^^^CEGI&&M^AN|||||OISEMONT (80140)|||||||||VALI
ROL|1|AD|ODRP|10100710366^LEFRANCOIS^PASCAL^^^DOC^^^ASIP-SANTE-PS&1.2.250.1.71.4.2.1&ISO^L^^^RPPS|||||||^^^^^^O 
NK1|1|REMY^AUDREY^^^^^D|UNK|^^^^^^H|^PRN^PH^^^^^^^^^0659530376||K^^^^ 
PV1|1|I|^^^CLINIQUE VICTOR PAUCHET&800009920&M|R|||10001850758^BARTOLI^PAULINE^^^Dr^^^&1.2.250.1.71.4.2.1&ISO^U^^^RPPS||||||||||||R000171104^^^CEGI&&M^AN|||||||||||||||||||||||||20240326000000 
PV2|||||||||20240326235900||| 
ZBE|ah-718077.1^CEGI^^M|20240326000000||INSERT|N||""^^^^^^UF^^^""||M 
ZFD|||||INSI|20240326095954|CN`;

// Créer un fichier temporaire avec le message HL7
const tempFile = 'temp_french_hl7_test.txt';
fs.writeFileSync(tempFile, hl7Message);

console.log('Test de conversion d\'un message HL7 français avec segments personnalisés:');
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
    
    // 1. Patient avec identifiants INS
    const patientResource = bundle.entry.find(entry => 
      entry.resource && entry.resource.resourceType === 'Patient'
    );
    
    if (patientResource) {
      console.log('✅ Patient correctement créé');
      
      // Vérifier l'identifiant INS-NIR
      const insIdentifier = patientResource.resource.identifier.find(id => 
        (id.system && id.system.includes('ASIP-SANTE-INS-NIR')) ||
        (id.system && id.system.includes('1.2.250.1.213.1.4.8')) ||
        (id.type && id.type.coding && id.type.coding.some(coding => coding.code === 'INS'))
      );
      
      if (insIdentifier) {
        console.log(`   Identifiant INS-NIR: ${insIdentifier.value}`);
        console.log(`   Système: ${insIdentifier.system}`);
        if (insIdentifier.type && insIdentifier.type.coding) {
          console.log(`   Type: ${insIdentifier.type.coding[0].code}`);
        }
      } else {
        console.log('❌ Identifiant INS-NIR non trouvé');
      }
      
      // Vérifier tous les noms du patient
      if (patientResource.resource.name && patientResource.resource.name.length > 0) {
        console.log(`   Noms du patient (${patientResource.resource.name.length} variantes):`);
        patientResource.resource.name.forEach((name, index) => {
          console.log(`     ${index+1}. ${name.family} (${name.use || 'non spécifié'}): ${name.given ? name.given.join(' ') : '[Pas de prénom]'}${name.prefix ? ' (Préfixe: ' + name.prefix.join(' ') + ')' : ''}`);
        });
      }
      
      // Vérifier l'adresse
      if (patientResource.resource.address && patientResource.resource.address.length > 0) {
        const address = patientResource.resource.address[0];
        console.log(`   Adresse: ${address.line ? address.line.join(', ') : '[Non spécifiée]'}, ${address.postalCode || ''} ${address.city || ''}`);
      }
      
      // Vérifier si l'extension ZFD est présente
      if (patientResource.resource.extension) {
        const zfdExtensions = patientResource.resource.extension.filter(ext => 
          ext.url && ext.url.includes('esante.gouv.fr')
        );
        
        if (zfdExtensions.length > 0) {
          console.log('   Extensions ZFD présentes:');
          zfdExtensions.forEach(ext => {
            console.log(`      - ${ext.url}: ${ext.valueString || ext.valueDateTime || ext.valueCode || JSON.stringify(ext.valueReference) || '[Valeur complexe]'}`);
          });
        } else {
          console.log('❌ Extensions ZFD non trouvées');
        }
      }
    } else {
      console.log('❌ Patient non créé');
    }
    
    // 2. Praticiens (ROL et PV1)
    const practitionerResources = bundle.entry.filter(entry => 
      entry.resource && entry.resource.resourceType === 'Practitioner'
    );
    
    if (practitionerResources.length > 0) {
      console.log(`✅ ${practitionerResources.length} Practitioner(s) correctement créé(s)`);
      practitionerResources.forEach((practitioner, index) => {
        console.log(`   Praticien ${index + 1}: ${practitioner.resource.id}`);
        if (practitioner.resource.identifier) {
          const rppsIdentifier = practitioner.resource.identifier.find(id => 
            id.system && id.system.includes('RPPS')
          );
          
          if (rppsIdentifier) {
            console.log(`      Identifiant RPPS: ${rppsIdentifier.value}`);
          }
        }
        
        if (practitioner.resource.name && practitioner.resource.name.length > 0) {
          const name = practitioner.resource.name[0];
          console.log(`      Nom: ${name.family || '[Non spécifié]'}, ${name.given ? name.given.join(' ') : '[Non spécifié]'}`);
        }
      });
    } else {
      console.log('❌ Practitioners non créés');
    }
    
    // 3. Encounter (PV1)
    const encounterResource = bundle.entry.find(entry => 
      entry.resource && entry.resource.resourceType === 'Encounter'
    );
    
    if (encounterResource) {
      console.log('✅ Encounter correctement créé');
      console.log(`   Identifiant: ${encounterResource.resource.id}`);
      console.log(`   Status: ${encounterResource.resource.status}`);
      
      // Vérifier class (hospitalisation, etc.)
      if (encounterResource.resource.class) {
        console.log(`   Classe: ${encounterResource.resource.class.code}`);
      }
      
      // Vérifier le service/location
      if (encounterResource.resource.serviceProvider) {
        console.log(`   Établissement: ${encounterResource.resource.serviceProvider.display || encounterResource.resource.serviceProvider.reference || '[Non spécifié]'}`);
      }
    } else {
      console.log('❌ Encounter non créé');
    }
    
    // 4. RelatedPerson (NK1)
    const relatedPersonResource = bundle.entry.find(entry => 
      entry.resource && entry.resource.resourceType === 'RelatedPerson'
    );
    
    if (relatedPersonResource) {
      console.log('✅ RelatedPerson correctement créé');
      console.log(`   Identifiant: ${relatedPersonResource.resource.id}`);
      if (relatedPersonResource.resource.name && relatedPersonResource.resource.name.length > 0) {
        const name = relatedPersonResource.resource.name[0];
        console.log(`   Nom: ${name.family || '[Non spécifié]'}, ${name.given ? name.given.join(' ') : '[Non spécifié]'}`);
      }
      if (relatedPersonResource.resource.relationship && 
          relatedPersonResource.resource.relationship.coding && 
          relatedPersonResource.resource.relationship.coding.length > 0) {
        console.log(`   Relation: ${relatedPersonResource.resource.relationship.coding[0].code || 'Non spécifiée'}`);
      } else if (relatedPersonResource.resource.relationship) {
        console.log(`   Relation: ${JSON.stringify(relatedPersonResource.resource.relationship)}`);
      }
      if (relatedPersonResource.resource.telecom) {
        console.log(`   Contact: ${relatedPersonResource.resource.telecom[0].value || '[Non spécifié]'}`);
      }
    } else {
      console.log('❌ RelatedPerson non créé');
    }
    
    // 5. Provenance (ZBE)
    const provenanceResource = bundle.entry.find(entry => 
      entry.resource && entry.resource.resourceType === 'Provenance'
    );
    
    if (provenanceResource) {
      console.log('✅ Provenance correctement créé (segment ZBE)');
      console.log(`   Identifiant: ${provenanceResource.resource.id}`);
      
      // Vérifier l'activité
      if (provenanceResource.resource.activity && provenanceResource.resource.activity.coding) {
        console.log(`   Activité: ${provenanceResource.resource.activity.coding[0].code || '[Non spécifiée]'}`);
      }
      
      // Vérifier les extensions
      if (provenanceResource.resource.extension) {
        console.log('   Extensions ZBE présentes:');
        provenanceResource.resource.extension.forEach(ext => {
          console.log(`      - ${ext.url}: ${ext.valueString || ext.valueDateTime || ext.valueCode || JSON.stringify(ext.valueReference) || '[Valeur complexe]'}`);
        });
      }
    } else {
      console.log('❌ Provenance non créé (segment ZBE non traité)');
    }
    
    // Sauvegarder le résultat pour inspection
    fs.writeFileSync('french_hl7_result.json', JSON.stringify(result.fhirData, null, 2));
    console.log('Résultat complet sauvegardé dans french_hl7_result.json');
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