/**
 * Service de conversion HL7 vers FHIR pour FHIRHub
 * Fournit des méthodes pour convertir les messages HL7 v2.5 en ressources FHIR R4
 */

const hl7 = require('hl7');
const { v4: uuidv4 } = require('uuid');
const nameExtractor = require('../utils/nameExtractor');
const fhirCleaner = require('../utils/fhirCleaner');
const terminologyService = require('./terminologyService');

// Processeurs pour les différents segments HL7
const segmentProcessors = require('./segmentProcessors');

/**
 * Analyser un message HL7
 * @param {string} hl7Content - Contenu du message HL7
 * @returns {Object} Message HL7 parsé
 */
function parseHL7(hl7Content) {
  try {
    // Normalisation du message (retours à la ligne)
    const normalizedContent = hl7Content.replace(/\r\n|\n\r|\r|\n/g, '\r');
    
    // Parser le message
    const parsedMessage = hl7.parseString(normalizedContent);
    
    return parsedMessage;
  } catch (error) {
    console.error('Erreur lors du parsing HL7:', error);
    throw new Error(`Erreur de parsing HL7: ${error.message}`);
  }
}

/**
 * Extraire les segments d'un message HL7 parsé
 * @param {Object} parsedMessage - Message HL7 parsé
 * @returns {Object} Segments organisés par type
 */
function extractSegments(parsedMessage) {
  const segments = {};
  
  // Parcourir tous les segments
  parsedMessage.forEach(segment => {
    const segmentType = segment[0][0];
    
    // Si c'est le premier segment de ce type, créer un tableau
    if (!segments[segmentType]) {
      segments[segmentType] = [];
    }
    
    // Ajouter le segment au tableau correspondant
    segments[segmentType].push(segment);
  });
  
  return segments;
}

/**
 * Créer un Bundle FHIR à partir des ressources
 * @param {Array} resources - Tableau de ressources FHIR
 * @param {string} type - Type de Bundle ('transaction', 'batch', 'document', etc.)
 * @returns {Object} Bundle FHIR
 */
function createFHIRBundle(resources, type = 'transaction') {
  const bundleId = uuidv4();
  const timestamp = new Date().toISOString();
  
  const bundle = {
    resourceType: 'Bundle',
    id: bundleId,
    type: type,
    timestamp: timestamp,
    entry: []
  };
  
  // Ajouter chaque ressource au Bundle
  resources.forEach(resource => {
    // Générer un ID pour la ressource si elle n'en a pas
    if (!resource.id) {
      resource.id = uuidv4();
    }
    
    // Ajouter une entrée au Bundle
    bundle.entry.push({
      fullUrl: `urn:uuid:${resource.id}`,
      resource: resource,
      request: {
        method: 'POST',
        url: resource.resourceType
      }
    });
  });
  
  return bundle;
}

/**
 * Convertir un message HL7 en ressources FHIR
 * @param {Object} parsedMessage - Message HL7 parsé
 * @param {Object} segments - Segments organisés par type
 * @param {Object} options - Options de conversion
 * @returns {Array} Tableau de ressources FHIR
 */
function convertToFHIRResources(parsedMessage, segments, options) {
  const resources = [];
  
  // Traiter les segments MSH (en-tête du message)
  if (segments.MSH && segments.MSH.length > 0) {
    const messageHeader = segmentProcessors.processMSH(segments.MSH[0], options);
    if (messageHeader) {
      resources.push(messageHeader);
    }
  }
  
  // Traiter les segments PID (informations du patient)
  if (segments.PID && segments.PID.length > 0) {
    // Utiliser l'extracteur de noms français pour extraire correctement les noms
    const names = nameExtractor.extractFrenchNames(parsedMessage);
    
    const patient = segmentProcessors.processPID(segments.PID[0], { names, options });
    if (patient) {
      resources.push(patient);
    }
  }
  
  // Traiter les segments PV1 (visite, rencontre)
  if (segments.PV1 && segments.PV1.length > 0) {
    const encounter = segmentProcessors.processPV1(segments.PV1[0], { segments, resources, options });
    if (encounter) {
      resources.push(encounter);
    }
  }
  
  // Traiter les segments NK1 (contacts, famille)
  if (segments.NK1) {
    segments.NK1.forEach(nk1Segment => {
      const relatedPerson = segmentProcessors.processNK1(nk1Segment, { resources, options });
      if (relatedPerson) {
        resources.push(relatedPerson);
      }
    });
  }
  
  // Traiter les segments OBR (demandes d'examens)
  if (segments.OBR) {
    segments.OBR.forEach(obrSegment => {
      const serviceRequest = segmentProcessors.processOBR(obrSegment, { segments, resources, options });
      if (serviceRequest) {
        resources.push(serviceRequest);
      }
    });
  }
  
  // Traiter les segments OBX (résultats, observations)
  if (segments.OBX) {
    segments.OBX.forEach(obxSegment => {
      const observation = segmentProcessors.processOBX(obxSegment, { segments, resources, options });
      if (observation) {
        resources.push(observation);
      }
    });
  }
  
  // Traiter les segments SPM (échantillons)
  if (segments.SPM) {
    segments.SPM.forEach(spmSegment => {
      const specimen = segmentProcessors.processSPM(spmSegment, { resources, options });
      if (specimen) {
        resources.push(specimen);
      }
    });
  }
  
  return resources;
}

/**
 * Convertir un message HL7 en bundle FHIR
 * @param {string} hl7Content - Contenu du message HL7
 * @param {Object} options - Options de conversion
 * @returns {Promise<Object>} Bundle FHIR
 */
async function convertHL7ToFHIR(hl7Content, options = {}) {
  try {
    console.log('Début de la conversion HL7 vers FHIR');
    
    // Parser le message HL7
    const parsedMessage = parseHL7(hl7Content);
    console.log('Message HL7 parsé avec succès');
    
    // Extraire les segments
    const segments = extractSegments(parsedMessage);
    console.log(`Segments extraits: ${Object.keys(segments).join(', ')}`);
    
    // Convertir en ressources FHIR
    const resources = convertToFHIRResources(parsedMessage, segments, options);
    console.log(`${resources.length} ressource(s) FHIR générée(s)`);
    
    // Adapter les ressources pour les terminologies françaises
    const resourcesWithFrenchTerminology = resources.map(resource => {
      return terminologyService.adaptResourceForFrenchTerminology(resource);
    });
    
    // Créer un bundle FHIR
    let bundle = createFHIRBundle(resourcesWithFrenchTerminology);
    console.log('Bundle FHIR créé avec succès');
    
    // Nettoyer le bundle (supprimer les données vides ou non significatives)
    bundle = fhirCleaner.cleanBundle(bundle);
    console.log('Bundle FHIR nettoyé');
    
    return bundle;
  } catch (error) {
    console.error('Erreur lors de la conversion HL7 vers FHIR:', error);
    throw error;
  }
}

module.exports = {
  convertHL7ToFHIR,
  parseHL7
};