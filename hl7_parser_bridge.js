/**
 * Module pont entre le parser HL7 Python et le convertisseur FHIR JavaScript
 * Utilise hl7apy via un script Python pour parser les messages HL7
 * et fournit les données structurées au convertisseur FHIR
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

/**
 * Parse un message HL7 en utilisant le service Python
 * @param {string} hl7Content - Contenu du message HL7 à parser
 * @returns {Object} Résultat du parsing avec la structure du message
 */
function parseHL7(hl7Content) {
  try {
    // Créer un fichier temporaire pour le contenu HL7
    const tempDir = os.tmpdir();
    const tempFilePath = path.join(tempDir, `hl7_${Date.now()}.txt`);
    
    // Écrire le contenu HL7 dans le fichier temporaire
    fs.writeFileSync(tempFilePath, hl7Content, 'utf8');
    
    console.log(`[HL7 PARSER] Parsing du message HL7 avec hl7apy...`);
    
    // Exécuter le script Python avec le fichier en entrée
    const result = execSync(`python hl7_parser_service.py "${tempFilePath}"`, {
      encoding: 'utf8',
      maxBuffer: 10 * 1024 * 1024 // 10MB max output
    });
    
    // Nettoyer le fichier temporaire
    fs.unlinkSync(tempFilePath);
    
    // Parser le résultat JSON
    const parsedResult = JSON.parse(result);
    
    if (!parsedResult.success) {
      console.error(`[HL7 PARSER] Erreur lors du parsing: ${parsedResult.message}`);
      throw new Error(parsedResult.message);
    }
    
    console.log(`[HL7 PARSER] Message HL7 parsé avec succès (${parsedResult.data.segments.length} segments)`);
    return parsedResult;
  } catch (error) {
    console.error(`[HL7 PARSER] Erreur critique: ${error.message}`);
    throw error;
  }
}

/**
 * Extrait les informations d'en-tête d'un message HL7 parsé
 * @param {Object} parsedMessage - Message HL7 parsé
 * @returns {Object} Informations d'en-tête du message
 */
function extractMessageHeader(parsedMessage) {
  if (!parsedMessage || !parsedMessage.data || !parsedMessage.data.messageInfo) {
    throw new Error('Format de message HL7 parsé invalide');
  }
  
  return parsedMessage.data.messageInfo;
}

/**
 * Récupère un segment spécifique du message HL7 parsé
 * @param {Object} parsedMessage - Message HL7 parsé
 * @param {string} segmentId - Identifiant du segment (ex: 'PID', 'MSH', etc.)
 * @returns {Object|null} Le segment trouvé ou null
 */
function getSegment(parsedMessage, segmentId) {
  if (!parsedMessage || !parsedMessage.data || !parsedMessage.data.segments) {
    return null;
  }
  
  return parsedMessage.data.segments.find(segment => segment.segmentId === segmentId) || null;
}

/**
 * Extrait les valeurs d'un champ dans un segment
 * @param {Object} segment - Segment HL7 parsé
 * @param {number} fieldPosition - Position du champ (commençant à 1)
 * @returns {string|null} Valeur du champ ou null si non trouvé
 */
function getFieldValue(segment, fieldPosition) {
  if (!segment || !segment.fields) {
    return null;
  }
  
  const field = segment.fields.find(f => f.fieldPosition === fieldPosition);
  return field ? field.value : null;
}

/**
 * Extrait les identifiants du patient à partir du segment PID
 * @param {Object} parsedMessage - Message HL7 parsé
 * @returns {Array} Liste des identifiants du patient
 */
function extractPatientIdentifiers(parsedMessage) {
  try {
    // Extraire le segment PID
    const pidSegment = getSegment(parsedMessage, 'PID');
    if (!pidSegment) {
      return [];
    }
    
    // Chercher le champ PID.3 (Patient Identifier List)
    const identifierField = pidSegment.fields.find(f => f.fieldPosition === 3);
    if (!identifierField) {
      return [];
    }
    
    // Extraire les identifiants
    const identifiers = [];
    
    // Si l'information est déjà disponible dans patientInfo, l'utiliser
    if (parsedMessage.patientInfo && parsedMessage.patientInfo.identifiers) {
      return parsedMessage.patientInfo.identifiers;
    }
    
    // Sinon, extraire manuellement
    for (const component of identifierField.components || []) {
      // Composant 1 est l'ID, composant 4 est le système, composant 5 est le type
      const idValue = component.value;
      const typeComponent = identifierField.components.find(c => c.componentPosition === 5);
      const systemComponent = identifierField.components.find(c => c.componentPosition === 4);
      
      identifiers.push({
        value: idValue,
        type: typeComponent ? typeComponent.value : null,
        system: systemComponent ? systemComponent.value : null
      });
    }
    
    return identifiers;
  } catch (error) {
    console.error(`[HL7 PARSER] Erreur lors de l'extraction des identifiants: ${error.message}`);
    return [];
  }
}

/**
 * Convertit un segment PV1 en informations de rencontre/visite
 * @param {Object} parsedMessage - Message HL7 parsé
 * @returns {Object|null} Informations de la rencontre ou null
 */
function extractEncounterInfo(parsedMessage) {
  try {
    // Extraire le segment PV1
    const pv1Segment = getSegment(parsedMessage, 'PV1');
    if (!pv1Segment) {
      return null;
    }
    
    // Chercher les champs pertinents
    const patientClass = getFieldValue(pv1Segment, 2);
    const assignedLocation = getFieldValue(pv1Segment, 3);
    const admissionType = getFieldValue(pv1Segment, 4);
    const admissionDate = getFieldValue(pv1Segment, 44);
    const dischargeDate = getFieldValue(pv1Segment, 45);
    
    return {
      class: patientClass,
      location: assignedLocation,
      type: admissionType,
      admissionDate: admissionDate,
      dischargeDate: dischargeDate
    };
  } catch (error) {
    console.error(`[HL7 PARSER] Erreur lors de l'extraction des infos de rencontre: ${error.message}`);
    return null;
  }
}

module.exports = {
  parseHL7,
  extractMessageHeader,
  getSegment,
  getFieldValue,
  extractPatientIdentifiers,
  extractEncounterInfo
};