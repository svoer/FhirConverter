/**
 * Test du parseur HL7 avec simple-hl7
 */

const hl7 = require('simple-hl7');

// Créer un parser
const parser = new hl7.Parser();

// Message HL7 simple
const simpleHL7 = `MSH|^~\\&|SENDING_APP|SENDING_FACILITY|RECEIVING_APP|RECEIVING_FACILITY|20190101121000||ADT^A01|123456|P|2.3
PID|1||12345^^^^MR||DOE^JOHN||19800101|M`;

try {
  console.log("Parsing d'un message HL7 simple avec simple-hl7...");
  
  // Parser le message
  const message = parser.parse(simpleHL7);
  
  // Obtenir le segment MSH
  const msh = message.getSegment('MSH');
  
  console.log("\nInformations MSH:");
  console.log(`Sending Application: ${msh.getField(3)}`);
  console.log(`Sending Facility: ${msh.getField(4)}`);
  console.log(`Receiving Application: ${msh.getField(5)}`);
  console.log(`Receiving Facility: ${msh.getField(6)}`);
  console.log(`Message Type: ${msh.getField(9).getComponent(1)}`);
  console.log(`Message Event: ${msh.getField(9).getComponent(2)}`);
  console.log(`Message Control ID: ${msh.getField(10)}`);
  console.log(`Version: ${msh.getField(12)}`);
  
  // Obtenir le segment PID
  const pid = message.getSegment('PID');
  
  console.log("\nInformations PID:");
  console.log(`Patient ID: ${pid.getField(1)}`);
  
  // Obtenir un champ complexe
  const idField = pid.getField(3);
  if (idField) {
    console.log(`Identifiant: ${idField.getComponent(1)}`);
    console.log(`Type: ${idField.getComponent(5)}`);
  }
  
  const nameField = pid.getField(5);
  if (nameField) {
    console.log(`Nom: ${nameField.getComponent(1)}`);
    console.log(`Prénom: ${nameField.getComponent(2)}`);
  }
  
  console.log(`Date de naissance: ${pid.getField(7)}`);
  console.log(`Sexe: ${pid.getField(8)}`);
  
  // Afficher tous les segments
  console.log("\nListe des segments:");
  message.segments.forEach((segment, index) => {
    console.log(`- ${index}: ${segment.name} (${segment.fields.length} champs)`);
  });
  
  // Convertir en objet JSON pour analyse
  const jsonMessage = message.toJson();
  console.log("\nMessage en JSON:");
  console.log(JSON.stringify(jsonMessage, null, 2));
  
  console.log("\nTest complété avec succès!");
} catch (error) {
  console.error("Erreur lors du test:", error);
}