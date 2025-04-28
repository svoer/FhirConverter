/**
 * Script de test pour l'extraction des noms français
 * Ce script vérifie que le module d'extraction des noms fonctionne correctement
 * avec les formats de noms composés français
 */

const frenchNameExtractor = require('./src/utils/frenchNameExtractor');

// Cas de test 1: Format avec deux occurrences
const testCase1 = `MSH|^~\\&|LAB|GENERAL_HOSPITAL|LAB|CLINIC|20230512094327||ORU^R01|20230512094327|P|2.5.1|||||FRA|8859/1
PID|1||12345678^^^GENERAL_HOSPITAL^PI||SECLET^^^^MME^^D~SECLET^MARYSE^MARYSE BERTHE ALICE^^^^L||19540426|F||1|1 RUE EXAMPLE^^PARIS^^75001^FRA||0123456789^^^seclet@example.com|||||
PV1|1|O|GENERAL_HOSPITAL^ROOM1^BED1||||0123456^DUPONT^JEAN||||||||||V001|||||||||||||||||||||||||20230512||||||`;

// Cas de test 2: Format avec une seule occurrence
const testCase2 = `MSH|^~\\&|LAB|GENERAL_HOSPITAL|LAB|CLINIC|20230512094327||ORU^R01|20230512094327|P|2.5.1|||||FRA|8859/1
PID|1||12345678^^^GENERAL_HOSPITAL^PI||SECLET^MARYSE^MARYSE BERTHE ALICE^^^^L||19540426|F||1|1 RUE EXAMPLE^^PARIS^^75001^FRA||0123456789^^^seclet@example.com|||||
PV1|1|O|GENERAL_HOSPITAL^ROOM1^BED1||||0123456^DUPONT^JEAN||||||||||V001|||||||||||||||||||||||||20230512||||||`;

// Fonction pour vérifier si les prénoms composés sont correctement extraits
function checkExtractedNames(testName, hl7Message) {
  console.log(`TEST ${testName}: ${hl7Message.split('\n')[1].split('||')[0].split('~')[0]}`);
  console.log('-'.repeat(82));
  
  const names = frenchNameExtractor.extractFrenchNames(hl7Message);
  
  if (!names || names.length === 0) {
    console.error('ÉCHEC: Aucun nom extrait');
    return false;
  }
  
  console.log(`SUCCÈS: ${names.length} nom(s) extrait(s)`);
  
  names.forEach((name, index) => {
    console.log(`Nom #${index + 1}:`);
    console.log(`  Nom de famille: ${name.family}`);
    console.log(`  Prénom(s): ${name.given.join(', ')}`);
    console.log(`  Type: ${name.use}`);
    
    // Vérifier si les prénoms composés sont correctement extraits
    const hasComposedNames = name.given && name.given.length > 1;
    console.log(`  Prénoms composés correctement extraits: ${hasComposedNames ? 'OUI ✅' : 'NON ❌'}`);
  });
  
  return true;
}

// Exécuter les tests
console.log('');
checkExtractedNames('1', testCase1);
console.log('');
checkExtractedNames('2', testCase2);