/**
 * Test minimal du parseur HL7 avec un exemple basique
 */

const HL7 = require('hl7-standard');

// Message HL7 simple
const simpleHL7 = `MSH|^~\\&|SENDING_APP|SENDING_FACILITY|RECEIVING_APP|RECEIVING_FACILITY|20190101121000||ADT^A01|123456|P|2.3
PID|1||12345^^^^MR||DOE^JOHN||19800101|M`;

try {
  console.log("Parsing d'un message HL7 simple avec hl7-standard...");
  
  // Essayer de créer une instance
  const message = new HL7(simpleHL7);
  
  // Obtenir les segments
  const segments = message.getSegments();
  
  console.log("Segments trouvés:", segments.length);
  segments.forEach(seg => {
    console.log(`- Segment ${seg.name} avec ${seg.fields.length} champs`);
  });
  
  // Vérifier les données MSH
  const mshSegment = segments.find(seg => seg.name === 'MSH');
  if (mshSegment) {
    console.log("\nChamps MSH:");
    mshSegment.fields.forEach((field, i) => {
      console.log(`MSH.${i+1}: "${field}"`);
    });
  }
  
  // Vérifier les données PID
  const pidSegment = segments.find(seg => seg.name === 'PID');
  if (pidSegment) {
    console.log("\nChamps PID:");
    pidSegment.fields.forEach((field, i) => {
      console.log(`PID.${i+1}: "${field}"`);
    });
  }
  
  console.log("\nTest complété avec succès!");
} catch (error) {
  console.error("Erreur lors du test:", error);
}