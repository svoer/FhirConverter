/**
 * Test minimal du parseur HL7 avec hl7parser
 */

const hl7parser = require('hl7parser');

// Message HL7 simple
const simpleHL7 = `MSH|^~\\&|SENDING_APP|SENDING_FACILITY|RECEIVING_APP|RECEIVING_FACILITY|20190101121000||ADT^A01|123456|P|2.3
PID|1||12345^^^^MR||DOE^JOHN||19800101|M`;

try {
  console.log("Parsing d'un message HL7 simple avec hl7parser...");
  
  // Parser le message
  const message = hl7parser.create(simpleHL7);
  
  console.log("\nRésultat du parsing:");
  console.log(JSON.stringify(message, null, 2));
  
  console.log("\nTest complété avec succès!");
} catch (error) {
  console.error("Erreur lors du test:", error);
}