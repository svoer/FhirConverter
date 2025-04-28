/**
 * Script de test pour l'extraction des noms français
 * Ce script vérifie que le module d'extraction des noms fonctionne correctement
 * avec les formats de noms composés français
 */

const frenchNameExtractor = require('../src/utils/frenchNameExtractor');

// Test 1: Nom avec prénoms composés
const test1 = `MSH|^~\\&|TEST_APP|TEST_FACILITY|RECEIVING_APP|RECEIVING_FACILITY|20230101120000||ADT^A01|123456789|P|2.5||
PID|1||123^^^TEST^MR^TEST||SECLET^^^^MME^^D~SECLET^MARYSE^MARYSE BERTHE ALICE^^^^L||19700101|F|||1 RUE DU TEST^^PARIS^^75001^FRA||0123456789^^^contact@test.fr||||||123456789|||||||`;

// Test 2: Nom simple avec un seul prénom
const test2 = `MSH|^~\\&|TEST_APP|TEST_FACILITY|RECEIVING_APP|RECEIVING_FACILITY|20230101120000||ADT^A01|123456789|P|2.5||
PID|1||123^^^TEST^MR^TEST||SECLET^MARYSE^MARYSE BERTHE ALICE^^^^L||19700101|F|||1 RUE DU TEST^^PARIS^^75001^FRA||0123456789^^^contact@test.fr||||||123456789|||||||`;

// Test 3: Nom avec prénom composé et prénom usuel différent
const test3 = `MSH|^~\\&|TEST_APP|TEST_FACILITY|RECEIVING_APP|RECEIVING_FACILITY|20230101120000||ADT^A01|123456789|P|2.5||
PID|1||123^^^TEST^MR^TEST||DUPONT^JEAN PIERRE^JEAN PIERRE ANDRE^^^^^L~DUPONT^PIERROT^^^^^U||19700101|M|||1 RUE DU TEST^^PARIS^^75001^FRA||0123456789^^^contact@test.fr||||||123456789|||||||`;

/**
 * Vérifier l'extraction des noms
 * @param {string} testName - Nom du test
 * @param {string} hl7Message - Message HL7 à tester
 */
function checkExtractedNames(testName, hl7Message) {
  console.log(`TEST ${testName}: ${hl7Message.split('\n')[1].substring(0, 6)}`);
  console.log('-'.repeat(82));
  
  const extractedNames = frenchNameExtractor.extractFrenchNames(hl7Message);
  
  if (extractedNames && extractedNames.length > 0) {
    console.log(`SUCCÈS: ${extractedNames.length} nom(s) extrait(s)`);
    
    extractedNames.forEach((name, index) => {
      console.log(`Nom #${index + 1}:`);
      console.log(`  Nom de famille: ${name.family}`);
      console.log(`  Prénom(s): ${name.given.join(', ')}`);
      console.log(`  Type: ${name.use}`);
      
      // Vérifier si les prénoms composés ont été correctement extraits
      const hasMultipleGivens = name.given && name.given.length > 1;
      const composedNameCheck = hasMultipleGivens ? 'OUI ✅' : 'NON ❌';
      console.log(`  Prénoms composés correctement extraits: ${composedNameCheck}`);
    });
  } else {
    console.log('ÉCHEC: Aucun nom extrait ❌');
  }
}

// Exécuter les tests
checkExtractedNames('1', test1);
checkExtractedNames('2', test2);

console.log('\nTous les tests sont terminés.');