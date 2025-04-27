/**
 * Tests du module de terminologies françaises
 * Permet de valider le fonctionnement des adaptations terminologiques
 * 
 * Ce module exécute plusieurs scénarios de test pour vérifier
 * que l'adaptation des terminologies françaises fonctionne correctement.
 */

const frenchTerminologyService = require('./french_terminology_service');
const frenchTerminologyAdapter = require('./french_terminology_adapter');
const fs = require('fs');
const path = require('path');

const TEST_DATA_DIR = path.join(__dirname, 'data', 'test');

/**
 * Tester l'adaptation des ressources Patient
 */
async function testPatientAdaptation() {
  console.log('\n--- Test d\'adaptation d\'une ressource Patient ---');
  
  const patientResource = {
    resourceType: 'Patient',
    id: 'test-patient',
    identifier: [
      {
        system: 'urn:oid:1.2.250.1.213.1.4.8', // OID pour INS-NIR
        value: '1234567890123'
      },
      {
        system: 'http://ancien-systeme/identifiants', // Système non reconnu
        value: 'ID-12345'
      }
    ],
    gender: 'male',
    birthDate: '1980-01-01'
  };
  
  console.log('Adaptation d\'une ressource Patient avec identifiants français...');
  const adaptedPatient = frenchTerminologyAdapter.adaptPatientIdentifiers(patientResource);
  
  console.log('Identifiants avant adaptation:');
  console.log(patientResource.identifier);
  
  console.log('\nIdentifiants après adaptation:');
  console.log(adaptedPatient.identifier);
  
  return adaptedPatient;
}

/**
 * Tester l'adaptation des ressources Observation
 */
async function testObservationAdaptation() {
  console.log('\n--- Test d\'adaptation d\'une ressource Observation ---');
  
  const observationResource = {
    resourceType: 'Observation',
    id: 'test-observation',
    status: 'final',
    code: {
      coding: [
        {
          system: 'urn:oid:1.2.250.1.213.2.5', // OID pour CCAM
          code: 'AHQP003',
          display: 'Électrocardiographie'
        }
      ]
    },
    subject: {
      reference: 'Patient/test-patient'
    }
  };
  
  console.log('Adaptation d\'une ressource Observation avec codes français...');
  const adaptedObservation = frenchTerminologyAdapter.adaptObservation(observationResource);
  
  console.log('Code avant adaptation:');
  console.log(observationResource.code);
  
  console.log('\nCode après adaptation:');
  console.log(adaptedObservation.code);
  
  return adaptedObservation;
}

/**
 * Tester l'adaptation complète d'un bundle FHIR
 */
async function testBundleAdaptation() {
  console.log('\n--- Test d\'adaptation d\'un bundle FHIR complet ---');
  
  // Charger ou créer un bundle de test
  const bundlePath = path.join(TEST_DATA_DIR, 'test_bundle.json');
  let bundle;
  
  if (fs.existsSync(bundlePath)) {
    console.log(`Chargement d'un bundle existant: ${bundlePath}`);
    bundle = JSON.parse(fs.readFileSync(bundlePath, 'utf8'));
  } else {
    console.log('Création d\'un bundle de test...');
    bundle = {
      resourceType: 'Bundle',
      type: 'transaction',
      id: 'test-bundle',
      entry: [
        {
          resource: {
            resourceType: 'Patient',
            id: 'test-patient',
            identifier: [
              {
                system: 'urn:oid:1.2.250.1.213.1.4.8',
                value: '1234567890123'
              }
            ],
            gender: 'male',
            birthDate: '1980-01-01'
          }
        },
        {
          resource: {
            resourceType: 'Observation',
            id: 'test-observation',
            status: 'final',
            code: {
              coding: [
                {
                  system: 'urn:oid:1.2.250.1.213.2.5',
                  code: 'AHQP003',
                  display: 'Électrocardiographie'
                }
              ]
            },
            subject: {
              reference: 'Patient/test-patient'
            }
          }
        }
      ]
    };
  }
  
  // Sauvegarder une copie avant adaptation
  const beforePath = path.join(TEST_DATA_DIR, 'avant_adaptation.json');
  fs.writeFileSync(beforePath, JSON.stringify(bundle, null, 2), 'utf8');
  console.log(`Bundle avant adaptation sauvegardé: ${beforePath}`);
  
  console.log('Adaptation du bundle complet avec terminologies françaises...');
  const adaptedBundle = await frenchTerminologyAdapter.adaptFhirBundle(bundle, false);
  
  // Sauvegarder une copie après adaptation
  const afterPath = path.join(TEST_DATA_DIR, 'apres_adaptation.json');
  fs.writeFileSync(afterPath, JSON.stringify(adaptedBundle, null, 2), 'utf8');
  console.log(`Bundle après adaptation sauvegardé: ${afterPath}`);
  
  return adaptedBundle;
}

/**
 * Tester la validation des codes
 */
async function testCodeValidation() {
  console.log('\n--- Test de validation des codes français ---');
  
  const codesToValidate = [
    { system: 'https://mos.esante.gouv.fr/NOS/CCAM_2/FHIR/CCAM', code: 'AHQP003' },
    { system: 'https://mos.esante.gouv.fr/NOS/CIM-10/FHIR/CIM-10', code: 'I21.0' },
    { system: 'https://mos.esante.gouv.fr/NOS/TRE_A01-CadreExercice/FHIR/TRE-A01-CadreExercice', code: 'S' }
  ];
  
  console.log('Validation de plusieurs codes français...');
  
  for (const { system, code } of codesToValidate) {
    try {
      const isValid = await frenchTerminologyService.validateCode(system, code);
      console.log(`Code ${code} (${system}): ${isValid ? 'VALIDE' : 'INVALIDE'}`);
    } catch (error) {
      console.log(`Erreur lors de la validation de ${code} (${system}): ${error.message}`);
    }
  }
}

/**
 * Exécuter tous les tests
 */
async function runAllTests() {
  console.log('=== TESTS DES TERMINOLOGIES FRANÇAISES ===');
  console.log('Démarrage des tests...');
  
  try {
    // Créer le répertoire de test s'il n'existe pas
    if (!fs.existsSync(TEST_DATA_DIR)) {
      fs.mkdirSync(TEST_DATA_DIR, { recursive: true });
    }
    
    // Initialiser l'adaptateur
    console.log('Initialisation de l\'adaptateur de terminologies françaises...');
    const initialized = frenchTerminologyAdapter.initialize();
    console.log(`Initialisation: ${initialized ? 'RÉUSSIE' : 'ÉCHOUÉE'}`);
    
    // Tester les différentes fonctionnalités
    await testPatientAdaptation();
    await testObservationAdaptation();
    await testBundleAdaptation();
    await testCodeValidation();
    
    console.log('\n=== TESTS TERMINÉS AVEC SUCCÈS ===');
  } catch (error) {
    console.error(`\nERREUR LORS DES TESTS: ${error.message}`);
    console.error(error.stack);
  }
}

// Si ce script est exécuté directement, lancer les tests
if (require.main === module) {
  runAllTests();
}

module.exports = {
  runAllTests,
  testPatientAdaptation,
  testObservationAdaptation,
  testBundleAdaptation,
  testCodeValidation
};