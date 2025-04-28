/**
 * Script de test pour le nouveau convertisseur HL7 vers FHIR
 * Vérifie que le convertisseur gère correctement l'intégralité des messages HL7
 */

const convertHL7ToFHIR = require('./src/services/hl7ToFhirConverter');
const fs = require('fs').promises;

// Messages HL7 de test
const TEST_MESSAGES = [
  // Premier message HL7 - Patient français avec prénoms composés
  `MSH|^~\\&|CEGI|CEGI|OSIRIS|OSIRIS|20240326100615||ADT^A01^ADT_A01|56468389|P|2.5|||||FRA|8859/15|FR||^^^ 
EVN||20240326100603|||SPICHER@PAUCHET.COM|20240326000000 
PID|1||442777^^^CEGI&&M^PI~~248098060602525^^^ASIP-SANTE-INS-NIR&1.2.250.1.213.1.4.8&ISO^INS^^^~1000345108^^^CEGI&&M^PIP||SECLET^^^^MME^^D~SECLET^MARYSE^MARYSE BERTHE ALICE^^^^L||19480909|F|||7 RUE DU BOUJONNIER^^FORMERIE^^60220^^H~^^^^^^BDL^^80606||^PRN^PH^^^^^^^^^0608987212~~~^NET^Internet^MARYSE.SECLET@WANADOO.FR|||||R000171104^^^CEGI&&M^AN|||||OISEMONT (80140)|||||||||VALI ROL|1|AD|ODRP|10100710366^LEFRANCOIS^PASCAL^^^DOC^^^ASIP-SANTE-PS&1.2.250.1.71.4.2.1&ISO^L^^^RPPS|||||||^^^^^^O 
NK1|1|REMY^AUDREY^^^^^D|UNK|^^^^^^H|^PRN^PH^^^^^^^^^0659530376||K^^^^ 
PV1|1|I|^^^CLINIQUE VICTOR PAUCHET&800009920&M|R|||10001850758^BARTOLI^PAULINE^^^Dr^^^&1.2.250.1.71.4.2.1&ISO^U^^^RPPS||||||||||||R000171104^^^CEGI&&M^AN|||||||||||||||||||||||||20240326000000 
PV2|||||||||20240326235900||| ZBE|ah-718077.1^CEGI^^M|20240326000000||INSERT|N||""^^^^^^UF^^^""||M ZFD|||||INSI|20240326095954|CN`,

  // Deuxième message HL7 - Patient avec segments d'assurance
  `MSH|^~\\&|1.2.250.1.211.7.1.200.1.2|MCK|EAI|EAI|20250417050534||ADT^A01^ADT_A01|131822802|P|2.5^FRA^2.5|50926931||||FRA|8859/1|||A01^IPG~ADD_ENTREE_HOPITAL^INTEG
EVN||20250417050503|||MAURICEM
PID|||1174024^^^MCK&1.2.250.1.211.10.200.1&ISO^PI~1121717802492545833548^^^ASIP-SANTE-INS-C&1.2.250.1.213.1.4.2&ISO^INS-C^^20170215~160059932710027^^^ASIP-SANTE-INS-NIR&1.2.250.1.213.1.4.8&ISO^INS||YEHOUESSI^HERMAS JEAN RICHARD^HERMAS JEAN RICHARD^^^^L||19600509000000|M|||8  AVENUE CONDORCET^^FORT DE FRANCE^^97200^FRA^H~^^^^^UNK^C~^^PORTO NUEVO^^99327^BEN^BDL^^99327||0696039637^PRN^PH~0596000093^PRN^PH~0696039637^PRN^CP|||M||562102580^^^MCK|||||PORTO NUEVO|||FRA||||N||VALI
PD1||||||||||||N
ROL||UC|ODRP|971219175^MERAUT SALOMON^RENEE^^^^^^^ADELI&2.16.840.1.113883.3.31.2.2&ISO^^^ADELI~1238140^MERAUT SALOMON^RENEE^^^^^^^MCK&1.2.250.1.211.12.1.1&ISO^^^EI|||||||8    AVECONDORCET^^^^97200^UNK^H~8    AVECONDORCET^^FORT DE FRANCE^^97200^UNK^H^^^^^EDI
NK1|1|YEHOUESSI^ELENA|OTH^^IHE^SPO^FEMME^MCK|^^^^^UNK^H~^^^^^UNK^H^^^^^EDI|||C||||||||||||||||||||||||||1150225
PV1||I||||||||||||85||N|||562102580^^^MCK&1.2.250.1.211.12.1.1&ISO^AN|C|03|N|||||||||||||||||||N|||20250417050400
ZBE|EH_11549556_1^MCK|20250417050400||INSERT|N||^^^^^^UF^^SI7771^7771|^^^^^^UF^^^66a3a0c6a3b34a9cd702949d|M
ZFP| | 
ZFV| 
ZFM|8||5
IN1|1|972|||||||||||20251231|||YEHOUESSI^HERMAS JEAN RICHARD|||||||||||||||||||||||||||||||||160059932710027
IN2||||||||||||||||||||||||||||^C`
];

/**
 * Tester la conversion HL7 vers FHIR pour tous les messages
 */
async function testConversion() {
  console.log("=== TEST DU NOUVEAU CONVERTISSEUR HL7 VERS FHIR ===\n");
  
  // Tester chaque message
  for (let i = 0; i < TEST_MESSAGES.length; i++) {
    console.log(`\n--- Test du message #${i + 1} ---`);
    
    const hl7Message = TEST_MESSAGES[i];
    console.log(`Message HL7 (${hl7Message.length} caractères)`);
    
    // Convertir le message
    const result = convertHL7ToFHIR(hl7Message);
    
    if (result.success) {
      console.log("✅ Conversion réussie !");
      
      // Vérifier les ressources générées
      if (result.fhirData && result.fhirData.entry) {
        console.log(`Nombre de ressources générées: ${result.fhirData.entry.length}`);
        
        // Afficher les types de ressources
        const resourceTypes = result.fhirData.entry.map(e => e.resource.resourceType);
        console.log("Types de ressources:", resourceTypes.join(", "));
        
        // Vérifier la ressource Patient
        const patientEntry = result.fhirData.entry.find(e => e.resource.resourceType === "Patient");
        if (patientEntry) {
          console.log("\nRessource Patient:");
          console.log(`  ID: ${patientEntry.resource.id}`);
          
          // Vérifier les identifiants
          if (patientEntry.resource.identifier && patientEntry.resource.identifier.length > 0) {
            console.log(`  Nombre d'identifiants: ${patientEntry.resource.identifier.length}`);
          } else {
            console.log("❌ Aucun identifiant trouvé");
          }
          
          // Vérifier les noms
          if (patientEntry.resource.name && patientEntry.resource.name.length > 0) {
            console.log(`  Nombre de noms: ${patientEntry.resource.name.length}`);
            
            // Vérifier les prénoms composés
            patientEntry.resource.name.forEach((name, index) => {
              console.log(`  Nom #${index + 1}:`);
              console.log(`    Famille: ${name.family || 'Non défini'}`);
              console.log(`    Prénoms: ${name.given ? name.given.join(", ") : 'Non défini'}`);
              console.log(`    Usage: ${name.use || 'Non défini'}`);
              
              // Vérifier si les prénoms composés sont correctement extraits
              const hasMultipleGivenNames = name.given && name.given.length > 1;
              console.log(`    Prénoms composés correctement extraits: ${hasMultipleGivenNames ? 'OUI ✅' : 'NON ❌'}`);
            });
          } else {
            console.log("❌ Aucun nom trouvé");
          }
        } else {
          console.log("❌ Ressource Patient non trouvée");
        }
        
        // Vérifier la ressource Encounter
        const encounterEntry = result.fhirData.entry.find(e => e.resource.resourceType === "Encounter");
        if (encounterEntry) {
          console.log("\nRessource Encounter:");
          console.log(`  ID: ${encounterEntry.resource.id}`);
          console.log(`  Statut: ${encounterEntry.resource.status}`);
          console.log(`  Classe: ${encounterEntry.resource.class?.code || 'Non défini'}`);
          
          // Vérifier la référence au patient
          if (encounterEntry.resource.subject) {
            console.log(`  Référence patient: ${encounterEntry.resource.subject.reference}`);
          } else {
            console.log("❌ Référence patient non trouvée");
          }
        } else {
          console.log("\n❌ Ressource Encounter non trouvée");
        }
        
        // Enregistrer le résultat dans un fichier JSON
        const filename = `test_conversion_result_${i + 1}.json`;
        await fs.writeFile(filename, JSON.stringify(result.fhirData, null, 2));
        console.log(`\nRésultat enregistré dans ${filename}`);
      } else {
        console.log("❌ Aucune ressource générée");
      }
    } else {
      console.log(`❌ Erreur de conversion: ${result.message}`);
    }
  }
}

// Exécuter le test
testConversion().catch(error => {
  console.error("Erreur lors des tests:", error);
});