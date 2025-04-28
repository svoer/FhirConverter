/**
 * Module principal de conversion HL7 vers FHIR
 * Implémente la logique complète de conversion des messages HL7 v2.5 vers FHIR R4
 * 
 * @module hl7ToFhirConverter
 * @author FHIRHub Team
 */

const hl7parser = require('hl7parser');
const { 
  processPIDSegment,
  processNK1Segment,
  processPV1Segment,
  processZSegment,
  processInsuranceSegment,
  ConversionContext 
} = require('./segmentProcessors');
const { processFhirNames } = require('./fhirNameProcessor');
const { cleanBundle } = require('../utils/fhirCleaner');

/**
 * Vérifier si un segment est de type Z (segment personnalisé)
 * @param {string} segmentType - Type de segment
 * @returns {boolean} True si c'est un segment Z
 */
function isZSegment(segmentType) {
  return segmentType && segmentType.startsWith('Z');
}

/**
 * Vérifier si un segment est lié à l'assurance
 * @param {string} segmentType - Type de segment
 * @returns {boolean} True si c'est un segment d'assurance
 */
function isInsuranceSegment(segmentType) {
  return segmentType === 'IN1' || segmentType === 'IN2';
}

/**
 * Convertir un message HL7 en ressources FHIR
 * @param {string} hl7Message - Message HL7 complet
 * @returns {Object} Bundle FHIR contenant les ressources converties
 */
function convertHL7ToFHIR(hl7Message) {
  try {
    console.log("[HL7_TO_FHIR] Début de la conversion HL7 vers FHIR");
    
    if (!hl7Message) {
      console.error("[HL7_TO_FHIR] Message HL7 vide ou non défini");
      return {
        success: false,
        message: "Le message HL7 est vide ou non défini",
        fhirData: null
      };
    }
    
    // Créer un contexte de conversion
    const context = new ConversionContext();
    
    // Parser le message HL7
    let hl7Segments;
    try {
      // Diviser le message en segments en utilisant le retour à la ligne
      hl7Segments = hl7Message.split(/\r|\n|\r\n/).filter(line => line.trim() !== '');
      
      // Parser chaque segment individuellement
      console.log(`[HL7_TO_FHIR] Message HL7 divisé en ${hl7Segments.length} segments`);
    } catch (parseError) {
      console.error("[HL7_TO_FHIR] Erreur lors du parsing du message HL7:", parseError);
      return {
        success: false,
        message: `Erreur lors du parsing du message HL7: ${parseError.message}`,
        fhirData: null
      };
    }
    
    // Structure pour stocker les segments parsés
    const segments = [];
    
    // Parser chaque segment et le traiter
    for (let i = 0; i < hl7Segments.length; i++) {
      const segmentText = hl7Segments[i].trim();
      
      // Ignorer les segments vides
      if (!segmentText) continue;
      
      // Extraire le type de segment (les 3 premiers caractères)
      const segmentType = segmentText.substring(0, 3);
      
      console.log(`[HL7_TO_FHIR] Traitement du segment ${segmentType}`);
      
      // Parser le segment en tableau de champs
      const fields = segmentText.split('|');
      
      // Traiter le segment en fonction de son type
      switch (segmentType) {
        case 'PID':
          processPIDSegment(segment.toArray(), context);
          break;
        
        case 'NK1':
          processNK1Segment(segment.toArray(), context);
          break;
        
        case 'PV1':
          processPV1Segment(segment.toArray(), context);
          break;
        
        default:
          // Traiter les segments Z (segments personnalisés)
          if (isZSegment(segmentType)) {
            processZSegment(segmentType, segment.toArray(), context);
          }
          // Traiter les segments d'assurance
          else if (isInsuranceSegment(segmentType)) {
            processInsuranceSegment(segment.toArray(), segmentType, context);
          }
          // Autres segments non traités spécifiquement
          else {
            console.log(`[HL7_TO_FHIR] Segment ${segmentType} non traité spécifiquement`);
          }
          break;
      }
    }
    
    // Obtenir le bundle FHIR
    const fhirBundle = context.getFhirBundle();
    
    // Traiter les noms français
    const enhancedResult = processFhirNames({
      success: true,
      message: "Conversion réussie",
      fhirData: fhirBundle
    }, hl7Message);
    
    // Nettoyage final du bundle
    enhancedResult.fhirData = cleanBundle(enhancedResult.fhirData);
    
    console.log("[HL7_TO_FHIR] Conversion terminée avec succès");
    
    return enhancedResult;
  } catch (error) {
    console.error("[HL7_TO_FHIR] Erreur lors de la conversion:", error);
    return {
      success: false,
      message: `Erreur lors de la conversion: ${error.message}`,
      fhirData: null
    };
  }
}

module.exports = convertHL7ToFHIR;