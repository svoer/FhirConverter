/**
 * Test du module de nettoyage FHIR
 */
const fhirCleaner = require('./fhir_cleaner');
const fs = require('fs');
const path = require('path');

// Exemple de ressource FHIR avec des champs vides
const testResource = {
  resourceType: "Practitioner",
  name: [
    {
      family: "MARTIN",
      given: [
        "JEAN"
      ]
    }
  ],
  telecom: [],
  active: true,
  qualification: [
    {
      code: {
        coding: [
          {
            system: "http://terminology.hl7.org/CodeSystem/v2-0443",
            code: "ODRP",
            display: "Unknown Qualification"
          }
        ]
      }
    }
  ],
  address: [
    {
      line: [
        "8    AVECONDORCET"
      ],
      city: "",
      state: "",
      postalCode: "97200",
      country: "UNK"
    }
  ]
};

// Créer un bundle avec cette ressource
const testBundle = {
  resourceType: "Bundle",
  type: "transaction",
  entry: [
    {
      fullUrl: "http://example.org/Practitioner/test",
      resource: testResource,
      request: {
        method: "POST",
        url: "Practitioner"
      }
    }
  ]
};

console.log("AVANT nettoyage:");
console.log(JSON.stringify(testBundle, null, 2));

// Nettoyer le bundle
const cleanedBundle = fhirCleaner.cleanBundle(testBundle);

console.log("\nAPRÈS nettoyage:");
console.log(JSON.stringify(cleanedBundle, null, 2));

// Sauvegarder le résultat pour comparaison
const outputDir = path.join(process.cwd(), 'data', 'test');
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

fs.writeFileSync(
  path.join(outputDir, 'avant_nettoyage.json'), 
  JSON.stringify(testBundle, null, 2)
);

fs.writeFileSync(
  path.join(outputDir, 'apres_nettoyage.json'), 
  JSON.stringify(cleanedBundle, null, 2)
);

console.log("\nRésultats enregistrés dans data/test/");