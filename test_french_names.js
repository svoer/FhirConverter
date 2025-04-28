/**
 * Script de test pour l'extraction des noms français
 * Ce script vérifie le fonctionnement du module d'extraction des noms
 * avec différents formats de champs PID-5
 * 
 * ✦ Test avec le format: SECLET^^^^MME^^D~SECLET^MARYSE^MARYSE BERTHE ALICE^^^^L
 * ✦ Test avec le format: SECLET^MARYSE^MARYSE BERTHE ALICE^^^^L
 */

const { extractFrenchNames } = require('./src/utils/frenchNameExtractor');

// Cas de test 1: Message avec prénoms composés dans une deuxième occurrence
const testCase1 = `MSH|^~\\&|CEGI|CEGI|OSIRIS|OSIRIS|20240326100615||ADT^A01^ADT_A01|56468389|P|2.5|||||FRA|8859/15|FR||^^^ 
EVN||20240326100603|||SPICHER@PAUCHET.COM|20240326000000 
PID|1||442777^^^CEGI&&M^PI~~248098060602525^^^ASIP-SANTE-INS-NIR&1.2.250.1.213.1.4.8&ISO^INS^^^~1000345108^^^CEGI&&M^PIP||SECLET^^^^MME^^D~SECLET^MARYSE^MARYSE BERTHE ALICE^^^^L||19480909|F|||7 RUE DU BOUJONNIER^^FORMERIE^^60220^^H~^^^^^^BDL^^80606||^PRN^PH^^^^^^^^^0608987212~~~^NET^Internet^MARYSE.SECLET@WANADOO.FR|||||R000171104^^^CEGI&&M^AN|||||OISEMONT (80140)|||||||||VALI ROL|1|AD|ODRP|10100710366^LEFRANCOIS^PASCAL^^^DOC^^^ASIP-SANTE-PS&1.2.250.1.71.4.2.1&ISO^L^^^RPPS|||||||^^^^^^O`;

// Cas de test 2: Message avec prénoms composés directement dans la première occurrence
const testCase2 = `MSH|^~\\&|CEGI|CEGI|OSIRIS|OSIRIS|20240326100615||ADT^A01^ADT_A01|56468389|P|2.5|||||FRA|8859/15|FR||^^^ 
EVN||20240326100603|||SPICHER@PAUCHET.COM|20240326000000 
PID|1||442777^^^CEGI&&M^PI~~248098060602525^^^ASIP-SANTE-INS-NIR&1.2.250.1.213.1.4.8&ISO^INS^^^~1000345108^^^CEGI&&M^PIP||SECLET^MARYSE^MARYSE BERTHE ALICE^^^^L||19480909|F|||7 RUE DU BOUJONNIER^^FORMERIE^^60220^^H~^^^^^^BDL^^80606||^PRN^PH^^^^^^^^^0608987212~~~^NET^Internet^MARYSE.SECLET@WANADOO.FR|||||R000171104^^^CEGI&&M^AN|||||OISEMONT (80140)|||||||||VALI ROL|1|AD|ODRP|10100710366^LEFRANCOIS^PASCAL^^^DOC^^^ASIP-SANTE-PS&1.2.250.1.71.4.2.1&ISO^L^^^RPPS|||||||^^^^^^O`;

// Fonction pour formater l'affichage des résultats
function formatResult(names) {
  if (!names || names.length === 0) {
    return "ÉCHEC: Aucun nom extrait";
  }
  
  let result = `SUCCÈS: ${names.length} nom(s) extrait(s)\n`;
  
  names.forEach((name, index) => {
    result += `Nom #${index + 1}:\n`;
    result += `  Nom de famille: ${name.family}\n`;
    result += `  Prénom(s): ${name.given.join(', ')}\n`;
    if (name.prefix) {
      result += `  Préfixe: ${name.prefix.join(', ')}\n`;
    }
    result += `  Type: ${name.use}\n`;
    
    // Vérification des prénoms composés
    const hasCompositeGiven = name.given.includes('BERTHE') && name.given.includes('ALICE');
    result += `  Prénoms composés correctement extraits: ${hasCompositeGiven ? 'OUI ✅' : 'NON ❌'}\n`;
  });
  
  return result;
}

// Exécuter les tests
console.log("TEST 1: Format avec deux occurrences (SECLET^^^^MME^^D~SECLET^MARYSE^MARYSE BERTHE ALICE^^^^L)");
console.log("----------------------------------------------------------------------------------");
const result1 = extractFrenchNames(testCase1);
console.log(formatResult(result1));
console.log("\n");

console.log("TEST 2: Format avec une seule occurrence (SECLET^MARYSE^MARYSE BERTHE ALICE^^^^L)");
console.log("----------------------------------------------------------------------------------");
const result2 = extractFrenchNames(testCase2);
console.log(formatResult(result2));