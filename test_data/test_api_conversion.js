/**
 * Script de test pour la conversion HL7 vers FHIR via l'API
 * Ce script simule un appel à l'API pour vérifier que la conversion
 * avec le correctif des noms français fonctionne correctement
 */

const axios = require('axios');
const fs = require('fs');

// Message HL7 de test avec le cas spécifique de prénoms composés
const hl7Message = `MSH|^~\\&|CEGI|CEGI|OSIRIS|OSIRIS|20240326100615||ADT^A01^ADT_A01|56468389|P|2.5|||||FRA|8859/15|FR||^^^ 
EVN||20240326100603|||SPICHER@PAUCHET.COM|20240326000000 
PID|1||442777^^^CEGI&&M^PI~~248098060602525^^^ASIP-SANTE-INS-NIR&1.2.250.1.213.1.4.8&ISO^INS^^^~1000345108^^^CEGI&&M^PIP||SECLET^^^^MME^^D~SECLET^MARYSE^MARYSE BERTHE ALICE^^^^L||19480909|F|||7 RUE DU BOUJONNIER^^FORMERIE^^60220^^H~^^^^^^BDL^^80606||^PRN^PH^^^^^^^^^0608987212~~~^NET^Internet^MARYSE.SECLET@WANADOO.FR|||||R000171104^^^CEGI&&M^AN|||||OISEMONT (80140)|||||||||VALI ROL|1|AD|ODRP|10100710366^LEFRANCOIS^PASCAL^^^DOC^^^ASIP-SANTE-PS&1.2.250.1.71.4.2.1&ISO^L^^^RPPS|||||||^^^^^^O 
NK1|1|REMY^AUDREY^^^^^D|UNK|^^^^^^H|^PRN^PH^^^^^^^^^0659530376||K^^^^ 
PV1|1|I|^^^CLINIQUE VICTOR PAUCHET&800009920&M|R|||10001850758^BARTOLI^PAULINE^^^Dr^^^&1.2.250.1.71.4.2.1&ISO^U^^^RPPS||||||||||||R000171104^^^CEGI&&M^AN|||||||||||||||||||||||||20240326000000 
PV2|||||||||20240326235900||| ZBE|ah-718077.1^CEGI^^M|20240326000000||INSERT|N||""^^^^^^UF^^^""||M ZFD|||||INSI|20240326095954|CN`;

async function testApiConversion() {
  try {
    console.log("Test de conversion HL7 vers FHIR via l'API...");
    console.log("Envoi d'un message HL7 avec prénoms composés français");
    
    // Appel à l'API locale
    const response = await axios.post('http://localhost:5000/api/convert', hl7Message, {
      headers: {
        'Content-Type': 'text/plain',
        'X-API-Key': 'dev-key' // Clé API de développement
      }
    });
    
    console.log(`Statut de la réponse: ${response.status} ${response.statusText}`);
    
    if (response.status === 200) {
      // Vérifier si la conversion a réussi
      if (response.data.status === 'ok') {
        console.log("Conversion réussie!");
        
        // Vérifier si le bundle FHIR contient des entrées
        if (response.data.fhirData && response.data.fhirData.entry) {
          console.log(`Nombre de ressources dans le bundle: ${response.data.fhirData.entry.length}`);
          
          // Rechercher la ressource Patient
          const patientResource = response.data.fhirData.entry.find(entry => 
            entry.resource && entry.resource.resourceType === 'Patient');
          
          if (patientResource && patientResource.resource) {
            console.log("Ressource Patient trouvée!");
            
            // Vérifier si les noms sont présents
            if (patientResource.resource.name && patientResource.resource.name.length > 0) {
              console.log(`Nombre de noms dans la ressource Patient: ${patientResource.resource.name.length}`);
              
              // Afficher les noms
              patientResource.resource.name.forEach((name, index) => {
                console.log(`\nNom #${index + 1}:`);
                console.log(`  Nom de famille: ${name.family || 'Non défini'}`);
                console.log(`  Prénom(s): ${name.given ? name.given.join(', ') : 'Non défini'}`);
                console.log(`  Type: ${name.use || 'Non défini'}`);
                
                // Vérifier si les prénoms composés sont correctement extraits
                const hasCompositeGiven = name.given && 
                  name.given.includes('BERTHE') && 
                  name.given.includes('ALICE');
                
                console.log(`  Prénoms composés correctement extraits: ${hasCompositeGiven ? 'OUI ✅' : 'NON ❌'}`);
              });
            } else {
              console.log("⚠️ Aucun nom trouvé dans la ressource Patient!");
            }
          } else {
            console.log("⚠️ Ressource Patient non trouvée dans le bundle!");
          }
          
          // Sauvegarder le résultat FHIR pour analyse
          fs.writeFileSync('test_conversion_result.json', JSON.stringify(response.data.fhirData, null, 2));
          console.log("\nRésultat de la conversion enregistré dans test_conversion_result.json");
        } else {
          console.log("⚠️ Aucune entrée trouvée dans le bundle FHIR!");
        }
      } else {
        console.log(`⚠️ Erreur lors de la conversion: ${response.data.message}`);
      }
    } else {
      console.log(`⚠️ Erreur lors de l'appel à l'API: ${response.status} ${response.statusText}`);
    }
  } catch (error) {
    console.error("❌ Erreur lors du test:", error.message);
    
    if (error.response) {
      console.error("Détails de l'erreur:", error.response.data);
    }
  }
}

// Exécuter le test
testApiConversion();