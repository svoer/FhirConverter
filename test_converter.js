/**
 * Script de test pour le convertisseur HL7 vers FHIR
 * Ce script permet de tester la conversion d'un message HL7 v2.5 en FHIR R4
 * et d'identifier les problèmes éventuels dans le processus de conversion.
 */

const fs = require('fs');
const path = require('path');
const converter = require('./hl7ToFhirConverter');

// Pour un débogage plus détaillé
const DEBUG = true;

/**
 * Fonction principale de test
 */
async function testConversion() {
  console.log('=== TEST DE CONVERSION HL7 VERS FHIR ===');
  
  try {
    // Charger le message HL7 de test
    const hl7Message = fs.readFileSync(path.join(__dirname, 'data/in/test_complex.hl7'), 'utf8');
    console.log(`Message HL7 chargé: ${hl7Message.length} caractères`);
    
    if (DEBUG) {
      console.log('\nPremière étape: Analyse du message HL7');
      const hl7Data = converter.parseHl7Message(hl7Message);
      console.log('Structure HL7 analysée:');
      
      // Afficher les segments présents dans le message
      console.log('\nSegments détectés:');
      Object.keys(hl7Data).forEach(segment => {
        console.log(`  - ${segment}: ${typeof hl7Data[segment] === 'object' && Array.isArray(hl7Data[segment]) ? hl7Data[segment].length : 1} entrée(s)`);
      });
      
      // Examiner le segment MSH
      if (hl7Data.MSH) {
        console.log('\nDétails du segment MSH:');
        console.log(JSON.stringify(hl7Data.MSH, null, 2));
      }
      
      // Examiner le segment PID
      if (hl7Data.PID) {
        console.log('\nDétails du segment PID:');
        console.log(JSON.stringify(hl7Data.PID, null, 2));
      }
    }
    
    console.log('\nDeuxième étape: Conversion en FHIR');
    const fhirBundle = converter.convertHl7ToFhir(hl7Message);
    
    console.log('\nRésultat de la conversion:');
    if (fhirBundle && Object.keys(fhirBundle).length > 0) {
      console.log(`  - Type de bundle: ${fhirBundle.resourceType} / ${fhirBundle.type}`);
      console.log(`  - ID de bundle: ${fhirBundle.id}`);
      console.log(`  - Nombre d'entrées: ${fhirBundle.entry ? fhirBundle.entry.length : 0}`);
      
      // Enregistrer le résultat FHIR dans un fichier
      const outputFile = path.join(__dirname, 'data/test_output.json');
      fs.writeFileSync(outputFile, JSON.stringify(fhirBundle, null, 2));
      console.log(`\nRésultat FHIR enregistré dans: ${outputFile}`);
      
      if (DEBUG && fhirBundle.entry && fhirBundle.entry.length > 0) {
        console.log('\nRessources créées:');
        fhirBundle.entry.forEach((entry, index) => {
          if (entry.resource) {
            console.log(`  ${index + 1}. ${entry.resource.resourceType} ${entry.resource.id ? `(ID: ${entry.resource.id})` : ''}`);
          }
        });
      }
    } else {
      console.error('Erreur: La conversion n\'a produit aucun résultat ou un objet vide.');
      console.log('Contenu du résultat:');
      console.log(JSON.stringify(fhirBundle, null, 2));
    }
    
    console.log('\n=== TEST TERMINÉ ===');
  } catch (error) {
    console.error(`\nErreur lors du test de conversion: ${error.message}`);
    console.error(error.stack);
  }
}

// Exécuter le test
testConversion();