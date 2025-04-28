/**
 * Script de test pour l'extraction des noms français
 * Ce script peut être utilisé pour vérifier que l'extraction des prénoms composés fonctionne correctement
 */

const applyFrenchNamesFix = require('./apply_french_names_fix');

// Message HL7 de test avec un prénom composé français
const testHL7Message = `MSH|^~\\&|MLLP_SENDER|ADT_A01|MLLP_RECEIVER|ADT_A01|20200727093040||ADT^A01^ADT_A01|12345|P|2.5.1
PID|||123456^^^HOSPITAL^MR~456789^^^NATIONAL_ID||SECLET^MARYSE^MARYSE BERTHE ALICE^^^^L||19720830|F|||123 RUE DE LA PAIX^^PARIS^^75001^FRA^HOME
PV1||I|3WEST^389^1||||12345^DOE^JOHN^^^DR|||SUR||||ADM|A0
`;

// Fonction pour simuler une réponse de conversion FHIR
function createMockFhirConversion() {
  return {
    success: true,
    conversionId: "test-1234",
    message: "Conversion réussie",
    fhirData: {
      resourceType: "Bundle",
      type: "transaction",
      entry: [
        {
          resource: {
            resourceType: "Patient",
            id: "test-patient-1",
            name: [
              {
                family: "SECLET",
                given: ["MARYSE"],
                use: "official"
              }
            ],
            gender: "female",
            birthDate: "1972-08-30"
          },
          request: {
            method: "POST",
            url: "Patient"
          }
        }
      ]
    },
    outputPath: "output/test.json"
  };
}

// Fonction pour tester l'extraction des noms français
function testFrenchNameExtraction() {
  console.log("=== TEST D'EXTRACTION DES NOMS FRANÇAIS ===");
  console.log("Message HL7 de test avec le prénom composé 'MARYSE BERTHE ALICE'");
  
  // Créer un résultat de conversion de base
  const mockResult = createMockFhirConversion();
  
  // Appliquer le correctif
  const fixedResult = applyFrenchNamesFix(mockResult, testHL7Message);
  
  // Vérifier le résultat
  const patientResource = fixedResult.fhirData.entry[0].resource;
  
  console.log("\nRésultat après application du correctif:");
  console.log("Nombre de noms:", patientResource.name.length);
  
  patientResource.name.forEach((name, index) => {
    console.log(`\nNom #${index + 1}:`);
    console.log("Nom de famille:", name.family);
    console.log("Prénoms:", name.given ? name.given.join(", ") : "aucun");
    console.log("Type:", name.use);
  });
  
  // Vérifier que le prénom composé a été correctement ajouté
  const hasComposedName = patientResource.name.some(name => 
    name.given && 
    name.given.length > 1 && 
    name.given.includes("MARYSE") && 
    name.given.includes("BERTHE") && 
    name.given.includes("ALICE")
  );
  
  console.log("\nVérification:");
  console.log("Le prénom composé 'MARYSE BERTHE ALICE' a été correctement extrait:", 
    hasComposedName ? "OUI ✅" : "NON ❌");
  
  return hasComposedName;
}

// Exécuter le test
const testResult = testFrenchNameExtraction();
console.log("\nRésultat du test:", testResult ? "SUCCÈS ✅" : "ÉCHEC ❌");

module.exports = { testFrenchNameExtraction };