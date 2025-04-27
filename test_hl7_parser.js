/**
 * Script de test pour le parser HL7
 * Analyse un message HL7 d'exemple et affiche les résultats
 */

const fs = require('fs');
const path = require('path');
const hl7Parser = require('./hl7_parser');

// Chemin vers un fichier HL7 d'exemple ou créer un message d'exemple
const SAMPLE_HL7_FILE = path.join(__dirname, 'sample_hl7.txt');
const SAMPLE_HL7 = `MSH|^~\\&|SENDING_APPLICATION|SENDING_FACILITY|RECEIVING_APPLICATION|RECEIVING_FACILITY|20250418134830||ADT^A01|20250418134830|P|2.3
EVN|A01|20250418134830
PID|1||12345^^^MRN^MR~67890^^^INS^PE||DOE^JOHN^M^^^^L||19800101|M|||123 MAIN ST^^ANYTOWN^NY^12345^USA^H||^PRN^PH^^^555^5551234||EN|S||12345678|123-45-6789||||||||||||
PV1|1|O|OP^ROOM1^BED1||||123456^SMITH^JANE||||SUR|||VIP||N|||||A|||||||||||||||||||1^^^20250418^^A
OBR|1||T-987654|24317-0^CBC W AUTO DIFFERENTIAL^LN|||20250418134830|||||||||123456^SMITH^JANE||||||20250419134830|||F||
OBX|1|NM|26453-1^WHITE BLOOD CELL COUNT^LN||10.5|10*3/uL|4.0-11.0||||F|||20250418134830|123^GOOD LABORATORY`;

// Vérifier si le fichier d'exemple existe, sinon le créer
if (!fs.existsSync(SAMPLE_HL7_FILE)) {
  console.log(`Création d'un fichier HL7 d'exemple: ${SAMPLE_HL7_FILE}`);
  fs.writeFileSync(SAMPLE_HL7_FILE, SAMPLE_HL7);
}

// Fonction principale de test
async function runTest() {
  console.log('=== TEST DU PARSER HL7 ===');
  
  try {
    // Lire le contenu du fichier HL7
    const hl7Content = fs.readFileSync(SAMPLE_HL7_FILE, 'utf8');
    
    console.log('Message HL7 en entrée:');
    console.log('-------------------');
    console.log(hl7Content);
    console.log('-------------------');
    
    // Parser le message HL7
    console.log('[HL7 PARSER] Parsing du message HL7...');
    const parsedMessage = hl7Parser.parseHL7Message(hl7Content);
    
    if (!parsedMessage.success) {
      console.error('[HL7 PARSER] Erreur lors du parsing:', parsedMessage.message);
      throw new Error(parsedMessage.message);
    }
    
    console.log('[HL7 PARSER] Parsing réussi');
    
    // Extraire les informations du patient
    console.log('[HL7 PARSER] Extraction des informations du patient...');
    const patientInfo = hl7Parser.extractPatientInfo(parsedMessage);
    
    if (!patientInfo.success) {
      console.error('[HL7 PARSER] Erreur lors de l\'extraction des infos patient:', patientInfo.message);
    } else {
      console.log('[HL7 PARSER] Extraction des infos patient réussie');
    }
    
    // Afficher les informations principales du message
    const messageInfo = parsedMessage.data.messageInfo;
    console.log('\nInformations principales du message:');
    console.log('----------------------------------');
    console.log(`Type: ${messageInfo.messageType}`);
    console.log(`ID: ${messageInfo.messageControlId}`);
    console.log(`Date: ${messageInfo.messageDate}`);
    console.log(`Version: ${messageInfo.version}`);
    console.log(`Application émettrice: ${messageInfo.sendingApplication}`);
    console.log(`Établissement émetteur: ${messageInfo.sendingFacility}`);
    
    // Afficher les informations du patient si disponibles
    if (patientInfo.success) {
      const patient = patientInfo.data;
      console.log('\nInformations patient:');
      console.log('--------------------');
      
      // Identifiants
      if (patient.identifiers.length > 0) {
        console.log('Identifiants:');
        patient.identifiers.forEach(id => {
          console.log(`- ${id.value} (Type: ${id.type || 'Non spécifié'}, Système: ${id.system || 'Non spécifié'})`);
        });
      }
      
      // Noms
      if (patient.names.length > 0) {
        const name = patient.names[0];
        console.log('Nom:');
        console.log(`- ${name.family || ''}, ${name.given || ''} ${name.middle || ''}`);
      }
      
      // Date de naissance et genre
      console.log(`Date de naissance: ${patient.birthDate || 'Non spécifiée'}`);
      console.log(`Genre: ${patient.gender || 'Non spécifié'}`);
      
      // Adresses
      if (patient.addresses.length > 0) {
        const address = patient.addresses[0];
        console.log('Adresse:');
        console.log(`- ${address.street || ''}`);
        if (address.otherStreet) console.log(`  ${address.otherStreet}`);
        console.log(`  ${address.city || ''}, ${address.state || ''} ${address.postalCode || ''}`);
        if (address.country) console.log(`  ${address.country}`);
      }
    }
    
    console.log('\n=== TEST TERMINÉ AVEC SUCCÈS ===');
    
  } catch (error) {
    console.error(`\nErreur lors du test: ${error.message}`);
    console.error(error.stack);
    process.exit(1);
  }
}

// Exécuter le test
runTest();