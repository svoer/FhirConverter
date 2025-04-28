/**
 * Proxy pour contourner les problèmes de syntaxe dans hl7ToFhirConverter.js
 * Ce module intercepte les appels au convertisseur original et applique directement notre correctif
 */

const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const applyFrenchNamesFix = require('./apply_french_names_fix');

// Constantes pour les chemins
const DATA_DIR = './data';
const INPUT_DIR = path.join(DATA_DIR, 'in');
const OUTPUT_DIR = path.join(DATA_DIR, 'out');

// Vérifier et créer les répertoires nécessaires
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(INPUT_DIR)) {
  fs.mkdirSync(INPUT_DIR, { recursive: true });
}
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

/**
 * Crée un bundle FHIR de base à partir d'un message HL7
 * Il s'agit d'une implémentation simplifiée qui ne traite que les informations de base
 * @param {string} hl7Content - Contenu du message HL7
 * @returns {Object} Bundle FHIR
 */
function createBasicFhirBundle(hl7Content) {
  // Extraire les informations de base du message HL7
  const lines = hl7Content.split(/[\r\n]+/);
  const pidLine = lines.find(line => line.startsWith('PID|'));
  
  if (!pidLine) {
    return null;
  }
  
  const pidFields = pidLine.split('|');
  
  // Si le segment PID est trop court, on ne peut pas extraire les informations
  if (pidFields.length < 6) {
    return null;
  }
  
  // Extraire le nom
  const nameField = pidFields[5]; // PID-5
  let family = '';
  let given = [];
  
  if (nameField) {
    const nameParts = nameField.split('^');
    family = nameParts[0] || '';
    if (nameParts.length > 1) {
      given = [nameParts[1]];
    }
  }
  
  // Extraire l'identifiant
  const idField = pidFields[3]; // PID-3
  let identifier = null;
  if (idField) {
    const idParts = idField.split('^');
    identifier = idParts[0] || '';
  }
  
  // Créer une ressource Patient de base
  const patientResource = {
    resourceType: 'Patient',
    id: `patient-${uuidv4().substring(0, 8)}`,
    identifier: identifier ? [
      {
        system: 'urn:oid:1.2.250.1.213.1.4.8',
        value: identifier
      }
    ] : [],
    name: [
      {
        family: family,
        given: given,
        use: 'official'
      }
    ]
  };
  
  // Créer un bundle FHIR simple
  return {
    resourceType: 'Bundle',
    type: 'transaction',
    entry: [
      {
        resource: patientResource,
        request: {
          method: 'POST',
          url: 'Patient'
        }
      }
    ]
  };
}

/**
 * Convertir un contenu HL7 en données FHIR
 * @param {string} hl7Content - Contenu HL7 à convertir
 * @param {string} filename - Nom du fichier source
 * @param {Object} options - Options de conversion
 * @returns {Object} Résultat de la conversion
 */
function convertHl7Content(hl7Content, filename = 'input.hl7', options = {}) {
  try {
    console.log(`[PROXY] Conversion de ${filename}`);
    
    // Créer un ID de conversion unique
    const conversionId = uuidv4();
    
    // Générer un nom de fichier de sortie
    const outputFilename = `${path.basename(filename, path.extname(filename))}_${Date.now()}.json`;
    const outputPath = path.join(OUTPUT_DIR, outputFilename);
    
    // Enregistrer le fichier d'entrée pour référence
    const inputPath = path.join(INPUT_DIR, `${conversionId}_${filename}`);
    fs.writeFileSync(inputPath, hl7Content);
    
    // Créer un bundle FHIR de base
    const fhirData = createBasicFhirBundle(hl7Content);
    
    if (!fhirData) {
      return {
        success: false,
        conversionId,
        message: 'Impossible d\'extraire les informations du message HL7',
        inputPath,
        outputPath: null,
        fhirData: null
      };
    }
    
    // Écrire les données FHIR dans un fichier
    fs.writeFileSync(outputPath, JSON.stringify(fhirData, null, 2));
    
    // Création d'un résultat de conversion
    const result = {
      success: true,
      conversionId,
      message: 'Conversion réussie avec le proxy',
      inputPath,
      outputPath,
      fhirData
    };
    
    // Appliquer notre correctif pour les noms français
    const fixedResult = applyFrenchNamesFix(result, hl7Content);
    
    // Mettre à jour le fichier de sortie avec les données corrigées
    fs.writeFileSync(outputPath, JSON.stringify(fixedResult.fhirData, null, 2));
    
    return fixedResult;
  } catch (error) {
    console.error('[PROXY] Erreur lors de la conversion:', error);
    return {
      success: false,
      message: `Erreur lors de la conversion: ${error.message}`,
      conversionId: uuidv4(),
      fhirData: null
    };
  }
}

/**
 * Convertir un fichier HL7 en fichier FHIR
 * @param {string} inputFile - Chemin vers le fichier HL7 d'entrée
 * @param {string} outputFile - Chemin vers le fichier FHIR de sortie (optionnel)
 * @param {Object} options - Options de conversion
 * @returns {Object} Résultat de la conversion
 */
function convertHl7File(inputFile, outputFile = null, options = {}) {
  try {
    // Vérifier que le fichier d'entrée existe
    if (!fs.existsSync(inputFile)) {
      return {
        success: false,
        message: `Le fichier ${inputFile} n'existe pas`,
        fhirData: null
      };
    }
    
    // Lire le contenu du fichier
    const hl7Content = fs.readFileSync(inputFile, 'utf8');
    
    // Convertir le contenu
    const result = convertHl7Content(hl7Content, path.basename(inputFile), options);
    
    // Si un fichier de sortie est spécifié, utiliser ce chemin
    if (outputFile && result.success) {
      fs.copyFileSync(result.outputPath, outputFile);
      result.outputPath = outputFile;
    }
    
    return result;
  } catch (error) {
    console.error('[PROXY] Erreur lors de la conversion du fichier:', error);
    return {
      success: false,
      message: `Erreur lors de la conversion du fichier: ${error.message}`,
      fhirData: null
    };
  }
}

module.exports = {
  convertHl7Content,
  convertHl7File
};