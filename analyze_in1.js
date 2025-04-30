// Script simple pour analyser la structure du segment IN1
const in1Segment = "IN1|1|123|||||||||||20251231|||DUPONT^JEAN MARIE|||||||||||||||||||||||||||||||||123456789012345";

console.log("Analyse du segment IN1:", in1Segment);
const fields = in1Segment.split('|');

console.log(`\nPositions de champs dans IN1 (total: ${fields.length}):`);
fields.forEach((field, index) => {
  if (field) {
    console.log(`IN1-${index}: "${field}"`);
    
    // Vérifier si c'est une date YYYYMMDD
    if (/^\d{8}$/.test(field) && field.startsWith('20')) {
      console.log(`  POSSIBLE DATE: ${field.substring(0, 4)}-${field.substring(4, 6)}-${field.substring(6, 8)}`);
    }
    
    // Vérifier si c'est un identifiant INS (15 chiffres)
    if (/^\d{15}$/.test(field)) {
      console.log(`  POSSIBLE INS: ${field}`);
    }
  }
});