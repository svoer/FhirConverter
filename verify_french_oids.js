/**
 * Vérificateur de cohérence des OIDs français
 * Compare les OIDs dans la documentation avec ceux utilisés dans le code
 */

const fs = require('fs');
const path = require('path');
const frenchTerminologyAdapter = require('./french_terminology_adapter');

// Chemins des fichiers
const docsPath = path.join(__dirname, 'docs', 'french_oids_documentation.md');

/**
 * Extraire les OIDs de la documentation markdown
 */
function extractOidsFromDocs() {
  console.log('Extraction des OIDs depuis la documentation...');
  const content = fs.readFileSync(docsPath, 'utf8');
  
  // Utiliser une regex pour extraire les OIDs (1.2.250.1.213.x.x.x)
  const oidRegex = /1\.2\.250\.1\.\d+(?:\.\d+){2,}/g;
  const allOids = content.match(oidRegex) || [];
  
  // Éliminer les doublons
  const uniqueOids = [...new Set(allOids)];
  console.log(`${uniqueOids.length} OIDs uniques trouvés dans la documentation`);
  
  return uniqueOids;
}

/**
 * Extraire les mappings d'OIDs du code source
 */
function extractOidsFromCode() {
  console.log('Extraction des OIDs depuis le code...');
  
  // Initialiser l'adaptateur pour accéder à ses systèmes
  frenchTerminologyAdapter.initialize();
  
  const systemMappings = {};
  
  // Ajouter les mappings d'identifiants
  const identifierSystems = frenchTerminologyAdapter.getIdentifierMappings();
  for (const [type, system] of Object.entries(identifierSystems)) {
    if (system.startsWith('urn:oid:')) {
      const oid = system.replace('urn:oid:', '');
      systemMappings[oid] = { type, usage: 'identifier' };
    }
  }
  
  // Ajouter les mappings de codes
  const codeSystems = frenchTerminologyAdapter.getCodeSystemMappings();
  for (const [type, system] of Object.entries(codeSystems)) {
    if (system.startsWith('urn:oid:')) {
      const oid = system.replace('urn:oid:', '');
      systemMappings[oid] = { type, usage: 'codeSystem' };
    }
  }
  
  console.log(`${Object.keys(systemMappings).length} OIDs uniques trouvés dans le code`);
  return systemMappings;
}

/**
 * Comparer les OIDs de la documentation avec ceux du code
 */
function compareOids() {
  const docsOids = extractOidsFromDocs();
  const codeOids = extractOidsFromCode();
  
  console.log('\n=== VÉRIFICATION DE COHÉRENCE DES OIDS ===');
  
  // Vérifier les OIDs dans la documentation mais pas dans le code
  const missingInCode = docsOids.filter(oid => !codeOids[oid]);
  if (missingInCode.length > 0) {
    console.log('\nOIDs présents dans la documentation mais non utilisés dans le code:');
    missingInCode.forEach(oid => console.log(`  - ${oid}`));
  } else {
    console.log('\nTous les OIDs de la documentation sont utilisés dans le code ✓');
  }
  
  // Vérifier les OIDs dans le code mais pas dans la documentation
  const missingInDocs = Object.keys(codeOids).filter(oid => !docsOids.includes(oid));
  if (missingInDocs.length > 0) {
    console.log('\nOIDs utilisés dans le code mais absents de la documentation:');
    missingInDocs.forEach(oid => {
      const info = codeOids[oid];
      console.log(`  - ${oid} (${info.usage}: ${info.type})`);
    });
  } else {
    console.log('\nTous les OIDs du code sont documentés ✓');
  }
  
  // Résumé
  console.log('\nRésumé:');
  console.log(`  - ${docsOids.length} OIDs dans la documentation`);
  console.log(`  - ${Object.keys(codeOids).length} OIDs dans le code`);
  console.log(`  - ${missingInCode.length} OIDs manquants dans le code`);
  console.log(`  - ${missingInDocs.length} OIDs manquants dans la documentation`);
  
  return {
    docsOids,
    codeOids,
    missingInCode,
    missingInDocs
  };
}

/**
 * Générer des recommandations pour corriger les incohérences
 */
function generateRecommendations(results) {
  console.log('\n=== RECOMMANDATIONS ===');
  
  if (results.missingInCode.length > 0) {
    console.log('\nPour les OIDs présents dans la documentation mais non utilisés dans le code:');
    console.log('1. Ajoutez ces mappings dans french_terminology_adapter.js:');
    results.missingInCode.forEach(oid => {
      console.log(`   - Ajouter le mapping pour l'OID ${oid} dans la fonction appropriée`);
    });
  }
  
  if (results.missingInDocs.length > 0) {
    console.log('\nPour les OIDs utilisés dans le code mais absents de la documentation:');
    console.log('1. Ajoutez ces OIDs à la documentation dans docs/french_oids_documentation.md:');
    results.missingInDocs.forEach(oid => {
      const info = results.codeOids[oid];
      console.log(`   - Documenter l'OID ${oid} (${info.usage}: ${info.type})`);
    });
  }
  
  if (results.missingInCode.length === 0 && results.missingInDocs.length === 0) {
    console.log('\nFélicitations ! Les OIDs sont parfaitement cohérents entre la documentation et le code.');
  }
}

/**
 * Fonction principale
 */
function main() {
  console.log('Vérification de la cohérence des OIDs français...');
  
  if (!fs.existsSync(docsPath)) {
    console.error(`Documentation non trouvée: ${docsPath}`);
    return;
  }
  
  const results = compareOids();
  generateRecommendations(results);
}

// Exécuter le script si appelé directement
if (require.main === module) {
  main();
}

module.exports = {
  extractOidsFromDocs,
  extractOidsFromCode,
  compareOids,
  generateRecommendations,
  main
};