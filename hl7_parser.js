/**
 * Module de parsing HL7 avec hl7-standard
 * Permet d'analyser des messages HL7 v2.x et de les retourner sous forme structurée
 * pour la conversion en FHIR
 */

const HL7 = require('hl7-standard');
const fs = require('fs');

/**
 * Parse un message HL7 et retourne une structure JSON
 * @param {string} hl7Content - Le contenu du message HL7 à parser
 * @returns {Object} Résultat du parsing avec succès/erreur et données structurées
 */
function parseHL7Message(hl7Content) {
  try {
    // Nettoyage du message HL7
    hl7Content = hl7Content.trim();
    
    // Détection du séparateur de segment
    let segmentSeparator = "\r";
    if (hl7Content.includes("\r\n")) {
      segmentSeparator = "\r\n";
    } else if (hl7Content.includes("\n") && !hl7Content.includes("\r")) {
      segmentSeparator = "\n";
    }
    
    // Standardiser les séparateurs pour le parser
    const normalizedContent = hl7Content.split(/\r\n|\n|\r/).join('\r');
    
    // Vérifier que le contenu commence bien par MSH
    if (!normalizedContent.startsWith('MSH')) {
      throw new Error("Le message HL7 doit commencer par un segment MSH");
    }
    
    // Parser le message
    const message = new HL7(normalizedContent);
    
    // Extraction des segments
    const segments = message.getSegments();
    
    if (!segments || segments.length === 0) {
      throw new Error("Aucun segment trouvé dans le message HL7");
    }
    
    // Obtenir les séparateurs à partir du segment MSH
    const mshSegment = segments.find(seg => seg.name === 'MSH');
    if (!mshSegment) {
      throw new Error("Segment MSH non trouvé dans le message HL7");
    }
    
    const fieldSeparator = mshSegment.fields[0] || '|';
    const encodingChars = mshSegment.fields[1] || '^~\\&';
    
    const componentSeparator = encodingChars[0] || '^';
    const repetitionSeparator = encodingChars[1] || '~';
    const escapeChar = encodingChars[2] || '\\';
    const subcomponentSeparator = encodingChars[3] || '&';
    
    // Extraire les informations principales du message
    const messageInfo = {
      messageType: getMSHValue(mshSegment, 9),
      messageControlId: getMSHValue(mshSegment, 10),
      messageDate: getMSHValue(mshSegment, 7),
      version: getMSHValue(mshSegment, 12),
      sendingApplication: getMSHValue(mshSegment, 3),
      sendingFacility: getMSHValue(mshSegment, 4),
      receivingApplication: getMSHValue(mshSegment, 5),
      receivingFacility: getMSHValue(mshSegment, 6),
      encoding: {
        fieldSeparator,
        componentSeparator,
        repetitionSeparator,
        escapeCharacter: escapeChar,
        subcomponentSeparator
      }
    };
    
    // Construction de la structure du message
    const structuredMessage = {
      messageInfo,
      segments: []
    };
    
    // Traitement de tous les segments pour notre format standard
    segments.forEach(segment => {
      const segmentData = {
        segmentId: segment.name,
        fields: []
      };
      
      // Traitement des champs du segment
      // Note: Pour MSH, on commence à l'indice 2 car les deux premiers sont spéciaux
      const startIndex = segment.name === 'MSH' ? 2 : 0;
      
      for (let i = startIndex; i < segment.fields.length; i++) {
        const fieldValue = segment.fields[i] || '';
        const fieldComponents = [];
        
        // Ajouter les champs spéciaux MSH manquants
        if (segment.name === 'MSH') {
          if (i === 2) {
            // Ajouter MSH.1 (Field Separator)
            segmentData.fields.push({
              fieldPosition: 1,
              value: fieldSeparator,
              components: [{
                componentPosition: 1,
                value: fieldSeparator,
                subcomponents: []
              }]
            });
            
            // Ajouter MSH.2 (Encoding Characters)
            segmentData.fields.push({
              fieldPosition: 2,
              value: encodingChars,
              components: [{
                componentPosition: 1,
                value: encodingChars,
                subcomponents: []
              }]
            });
          }
        }
        
        // Décomposer en composants si nécessaire
        if (fieldValue.includes(componentSeparator)) {
          const components = fieldValue.split(componentSeparator);
          components.forEach((comp, j) => {
            const subcomponents = [];
            
            // Gérer les sous-composants si nécessaire
            if (comp.includes(subcomponentSeparator)) {
              const subcomps = comp.split(subcomponentSeparator);
              subcomps.forEach(subcomp => {
                subcomponents.push({ value: subcomp });
              });
            }
            
            fieldComponents.push({
              componentPosition: j + 1,
              value: comp,
              subcomponents
            });
          });
        } else if (fieldValue) {
          // Pas de composants, juste une valeur
          fieldComponents.push({
            componentPosition: 1,
            value: fieldValue,
            subcomponents: []
          });
        }
        
        // Ajouter le champ au segment
        segmentData.fields.push({
          fieldPosition: segment.name === 'MSH' ? i + 1 : i + 1,
          value: fieldValue,
          components: fieldComponents
        });
      }
      
      structuredMessage.segments.push(segmentData);
    });
    
    return {
      success: true,
      message: "Message HL7 parsé avec succès",
      data: structuredMessage
    };
  } catch (error) {
    console.error("[HL7 PARSER] Erreur lors du parsing:", error);
    
    return {
      success: false,
      message: `Erreur lors du parsing du message HL7: ${error.message}`,
      error: error.message,
      stackTrace: error.stack
    };
  }
}

/**
 * Extrait les informations du patient à partir d'un message HL7 parsé
 * @param {Object} parsedMessage - Le message HL7 parsé
 * @returns {Object} Informations du patient extraites
 */
function extractPatientInfo(parsedMessage) {
  try {
    const segments = parsedMessage.data.segments;
    
    // Rechercher le segment PID (Patient Identification)
    const pidSegment = segments.find(seg => seg.segmentId === 'PID');
    
    if (!pidSegment) {
      return {
        success: false,
        message: "Segment PID non trouvé dans le message HL7"
      };
    }
    
    // Fonction auxiliaire pour obtenir un champ par sa position
    function getField(segment, position) {
      return segment.fields.find(field => field.fieldPosition === position);
    }
    
    // Extraire les informations du patient
    const patientIdField = getField(pidSegment, 3);  // PID.3 - Patient Identifier List
    const patientNameField = getField(pidSegment, 5);  // PID.5 - Patient Name
    const birthDateField = getField(pidSegment, 7);  // PID.7 - Date/Time of Birth
    const genderField = getField(pidSegment, 8);  // PID.8 - Administrative Sex
    const addressField = getField(pidSegment, 11);  // PID.11 - Patient Address
    
    // Construire l'objet patient
    const patientInfo = {
      identifiers: [],
      names: [],
      birthDate: birthDateField?.value,
      gender: genderField?.value,
      addresses: []
    };
    
    // Traiter les identifiants (PID.3)
    if (patientIdField) {
      // Si le champ a des répétitions, c'est une liste d'identifiants
      if (patientIdField.value.includes('~')) {
        const identifiers = patientIdField.value.split('~');
        identifiers.forEach(identifier => {
          const parts = identifier.split('^');
          // Traitement spécial pour les identifiants avec OID (format HL7 complet)
          // Format complet: ID^Code^Libellé^System^Type
          // Exemple INS-NIR: 248098060602525^^^ASIP-SANTE-INS-NIR&1.2.250.1.213.1.4.8&ISO^INS
          let idSystem = parts[3] || '';
          let idOID = '';
          
          // Vérifier si le système contient un OID (format avec &)
          if (idSystem && idSystem.includes('&')) {
            const systemParts = idSystem.split('&');
            idOID = systemParts[1] || ''; // L'OID est généralement à la position 1
          }
          
          patientInfo.identifiers.push({
            value: parts[0] || '',
            type: parts[4] || '',
            system: idSystem || '',
            oid: idOID || '',
            // Ajouter la valeur brute complète pour un traitement plus détaillé
            raw: identifier
          });
        });
      } else {
        // Traiter les composants pour trouver l'identifiant, le type et le système
        const idValue = patientIdField.components.find(c => c.componentPosition === 1)?.value;
        const idType = patientIdField.components.find(c => c.componentPosition === 5)?.value;
        const idSystem = patientIdField.components.find(c => c.componentPosition === 4)?.value;
        
        if (idValue) {
          // Extraction de l'OID du système si présent
          let idOID = '';
          if (idSystem && idSystem.includes('&')) {
            const systemParts = idSystem.split('&');
            idOID = systemParts[1] || ''; // L'OID est généralement à la position 1
          }
          
          patientInfo.identifiers.push({
            value: idValue,
            type: idType || '',
            system: idSystem || '',
            oid: idOID || '',
            raw: patientIdField.value
          });
        }
      }
    }
    
    // Traiter les noms (PID.5)
    if (patientNameField) {
      // Extraire les composants du nom
      const family = patientNameField.components.find(c => c.componentPosition === 1)?.value || '';
      const given = patientNameField.components.find(c => c.componentPosition === 2)?.value || '';
      const middle = patientNameField.components.find(c => c.componentPosition === 3)?.value || '';
      const suffix = patientNameField.components.find(c => c.componentPosition === 4)?.value || '';
      const prefix = patientNameField.components.find(c => c.componentPosition === 5)?.value || '';
      const nameType = patientNameField.components.find(c => c.componentPosition === 7)?.value || '';

      // Stocker la valeur brute complète pour permettre un traitement plus détaillé
      const rawValue = patientNameField.components.map(c => c.value || '').join('^');
      
      patientInfo.names.push({
        family,
        given,
        middle,
        prefix,
        suffix,
        nameType,
        raw: rawValue
      });
      
      // Si le champ a des répétitions (format pour gérer plusieurs noms)
      if (patientNameField.value && patientNameField.value.includes('~')) {
        const additionalNames = patientNameField.value.split('~').slice(1); // Ignorer le premier, déjà traité
        
        for (const additionalName of additionalNames) {
          const parts = additionalName.split('^');
          patientInfo.names.push({
            family: parts[0] || '',
            given: parts[1] || '',
            middle: parts[2] || '',
            prefix: parts[4] || '',
            suffix: parts[3] || '',
            nameType: parts[6] || '',
            raw: additionalName
          });
        }
      }
    }
    
    // Traiter les adresses (PID.11)
    if (addressField) {
      const street = addressField.components.find(c => c.componentPosition === 1)?.value;
      const otherStreet = addressField.components.find(c => c.componentPosition === 2)?.value;
      const city = addressField.components.find(c => c.componentPosition === 3)?.value;
      const state = addressField.components.find(c => c.componentPosition === 4)?.value;
      const postalCode = addressField.components.find(c => c.componentPosition === 5)?.value;
      const country = addressField.components.find(c => c.componentPosition === 6)?.value;
      
      patientInfo.addresses.push({
        street,
        otherStreet,
        city,
        state,
        postalCode,
        country
      });
    }
    
    return {
      success: true,
      message: "Informations patient extraites avec succès",
      data: patientInfo
    };
  } catch (error) {
    console.error("[HL7 PARSER] Erreur lors de l'extraction des infos patient:", error);
    
    return {
      success: false,
      message: `Erreur lors de l'extraction des informations patient: ${error.message}`,
      error: error.message
    };
  }
}

/**
 * Utilitaire : obtient la valeur d'un champ du segment MSH
 * @param {Object} mshSegment - Le segment MSH
 * @param {number} position - La position du champ à obtenir
 * @returns {string} La valeur du champ
 */
function getMSHValue(mshSegment, position) {
  // Pour le segment MSH, la position 1 est le séparateur et la position 2 est les caractères d'encodage
  const adjustedPosition = position - 1;
  return mshSegment.fields[adjustedPosition] || '';
}

/**
 * Traiter un fichier HL7
 * @param {string} filePath - Chemin du fichier HL7 à traiter
 * @returns {Promise<Object>} Résultat du traitement
 */
async function processHL7File(filePath) {
  try {
    const content = await fs.promises.readFile(filePath, 'utf8');
    const parsedData = parseHL7Message(content);
    
    if (parsedData.success) {
      const patientInfo = extractPatientInfo(parsedData);
      parsedData.patientInfo = patientInfo.data;
    }
    
    return parsedData;
  } catch (error) {
    console.error(`[HL7 PARSER] Erreur lors du traitement du fichier ${filePath}:`, error);
    
    return {
      success: false,
      message: `Erreur lors du traitement du fichier: ${error.message}`,
      error: error.message
    };
  }
}

/**
 * Traiter un contenu HL7 directement
 * @param {string} content - Contenu HL7 à traiter
 * @returns {Object} Résultat du traitement
 */
function processHL7Content(content) {
  try {
    const parsedData = parseHL7Message(content);
    
    if (parsedData.success) {
      const patientInfo = extractPatientInfo(parsedData);
      parsedData.patientInfo = patientInfo.data;
    }
    
    return parsedData;
  } catch (error) {
    console.error("[HL7 PARSER] Erreur lors du traitement du contenu HL7:", error);
    
    return {
      success: false,
      message: `Erreur lors du traitement du contenu HL7: ${error.message}`,
      error: error.message
    };
  }
}

// Exporter les fonctions pour utilisation dans d'autres modules
module.exports = {
  parseHL7Message,
  extractPatientInfo,
  processHL7File,
  processHL7Content
};