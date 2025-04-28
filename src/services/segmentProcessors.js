/**
 * Module de traitement des segments HL7 en ressources FHIR
 * 
 * Chaque processeur prend un segment HL7 en entrée et retourne une ressource FHIR.
 * Ce module implémente principalement le traitement des segments PID, PV1, OBR et OBX.
 */

const { v4: uuidv4 } = require('uuid');

/**
 * Traiter un segment PID en ressource Patient FHIR
 * @param {Object} pidSegment - Segment PID parsé
 * @param {number} index - Index du segment
 * @returns {Object} Ressource Patient FHIR
 */
function processPidSegment(pidSegment, index = 0) {
  try {
    // Vérifier que le segment est complet
    if (!pidSegment || !pidSegment.fields || pidSegment.fields.length < 6) {
      console.warn('Segment PID incomplet ou invalide');
      return null;
    }
    
    // Extraire les données de base du patient
    const patientId = pidSegment.fields[3] || '';
    const patientName = pidSegment.fields[5] || '';
    const birthDate = pidSegment.fields[7] || '';
    const gender = pidSegment.fields[8] || '';
    const address = pidSegment.fields[11] || '';
    const phone = pidSegment.fields[13] || '';
    
    // Créer un identifiant FHIR unique
    const fhirId = `patient-${uuidv4().substring(0, 8)}`;
    
    // Traiter le nom
    let name = [];
    if (patientName) {
      // Format HL7 standard: family^given1^given2^...
      const nameParts = patientName.split('^');
      
      if (nameParts.length > 0) {
        const nameObj = {
          family: nameParts[0] || '',
          given: [],
          use: 'official'
        };
        
        // Ajouter les prénoms
        for (let i = 1; i < nameParts.length; i++) {
          if (nameParts[i]) {
            nameObj.given.push(nameParts[i]);
          }
        }
        
        name.push(nameObj);
      }
    }
    
    // Traiter le genre
    let genderFhir = 'unknown';
    if (gender) {
      // Mapping HL7 vers FHIR
      switch (gender.toUpperCase()) {
        case 'M':
          genderFhir = 'male';
          break;
        case 'F':
          genderFhir = 'female';
          break;
        case 'O':
          genderFhir = 'other';
          break;
        case 'U':
          genderFhir = 'unknown';
          break;
        default:
          genderFhir = 'unknown';
      }
    }
    
    // Traiter la date de naissance
    let birthDateFhir = null;
    if (birthDate) {
      // Format HL7: YYYYMMDD
      if (birthDate.length >= 8) {
        const year = birthDate.substring(0, 4);
        const month = birthDate.substring(4, 6);
        const day = birthDate.substring(6, 8);
        
        birthDateFhir = `${year}-${month}-${day}`;
      }
    }
    
    // Traiter l'adresse
    let addressFhir = [];
    if (address) {
      // Format HL7: street^city^state^zip^country
      const addressParts = address.split('^');
      
      if (addressParts.length > 0) {
        const addressObj = {
          line: [addressParts[0] || ''],
          city: addressParts[1] || '',
          state: addressParts[2] || '',
          postalCode: addressParts[3] || '',
          country: addressParts[4] || '',
          use: 'home'
        };
        
        addressFhir.push(addressObj);
      }
    }
    
    // Traiter le téléphone
    let telecomFhir = [];
    if (phone) {
      // Format HL7: number^type^...
      const phoneParts = phone.split('^');
      
      if (phoneParts.length > 0 && phoneParts[0]) {
        const telecomObj = {
          system: 'phone',
          value: phoneParts[0],
          use: 'home'
        };
        
        telecomFhir.push(telecomObj);
      }
    }
    
    // Traiter l'identifiant
    let identifierFhir = [];
    if (patientId) {
      // Format HL7: id^type^...
      const idParts = patientId.split('^');
      
      if (idParts.length > 0 && idParts[0]) {
        const identifierObj = {
          system: 'urn:oid:1.2.250.1.213.1.4.8', // INS-NIR par défaut (France)
          value: idParts[0],
          use: 'official'
        };
        
        // Si un type d'identifiant est spécifié
        if (idParts.length > 1 && idParts[1]) {
          // Adapter le système en fonction du type
          switch (idParts[1].toUpperCase()) {
            case 'INS-NIR':
            case 'INS':
              identifierObj.system = 'urn:oid:1.2.250.1.213.1.4.8';
              break;
            case 'NDA':
              identifierObj.system = 'urn:oid:1.2.250.1.213.1.4.10';
              break;
            default:
              identifierObj.system = `urn:oid:${idParts[1]}`;
              break;
          }
        }
        
        identifierFhir.push(identifierObj);
      }
    }
    
    // Créer la ressource Patient
    const patientResource = {
      resourceType: 'Patient',
      id: fhirId,
      identifier: identifierFhir,
      name: name,
      gender: genderFhir,
      birthDate: birthDateFhir,
      address: addressFhir,
      telecom: telecomFhir
    };
    
    return patientResource;
  } catch (error) {
    console.error('Erreur lors du traitement du segment PID:', error);
    return null;
  }
}

/**
 * Traiter un segment PV1 en ressource Encounter FHIR
 * @param {Object} pv1Segment - Segment PV1 parsé
 * @param {Object} context - Contexte de conversion (références au patient, etc.)
 * @returns {Object} Ressource Encounter FHIR
 */
function processPv1Segment(pv1Segment, context = {}) {
  try {
    // Vérifier que le segment est complet
    if (!pv1Segment || !pv1Segment.fields || pv1Segment.fields.length < 44) {
      console.warn('Segment PV1 incomplet ou invalide');
      return null;
    }
    
    // Extraire les données de base de la visite
    const patientClass = pv1Segment.fields[2] || '';
    const assignedLocation = pv1Segment.fields[3] || '';
    const admissionType = pv1Segment.fields[4] || '';
    const attendingDoctor = pv1Segment.fields[7] || '';
    const visitNumber = pv1Segment.fields[19] || '';
    
    // Créer un identifiant FHIR unique
    const fhirId = `encounter-${uuidv4().substring(0, 8)}`;
    
    // Convertir la classe du patient
    let classFhir = 'outpatient';
    if (patientClass) {
      // Mapping HL7 vers FHIR
      switch (patientClass) {
        case 'I':
          classFhir = 'inpatient';
          break;
        case 'O':
          classFhir = 'outpatient';
          break;
        case 'E':
          classFhir = 'emergency';
          break;
        default:
          classFhir = 'outpatient';
      }
    }
    
    // Créer la ressource Encounter
    const encounterResource = {
      resourceType: 'Encounter',
      id: fhirId,
      status: 'in-progress',
      class: {
        system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
        code: classFhir,
        display: classFhir.charAt(0).toUpperCase() + classFhir.slice(1)
      }
    };
    
    // Ajouter la référence au patient si disponible
    if (context.patientId) {
      encounterResource.subject = {
        reference: `Patient/${context.patientId}`
      };
    }
    
    // Ajouter l'identifiant de la visite si disponible
    if (visitNumber) {
      // Format HL7: id^type^...
      const visitParts = visitNumber.split('^');
      
      if (visitParts.length > 0 && visitParts[0]) {
        encounterResource.identifier = [{
          system: 'urn:oid:1.2.250.1.213.1.4.10', // NDA par défaut (France)
          value: visitParts[0]
        }];
      }
    }
    
    return encounterResource;
  } catch (error) {
    console.error('Erreur lors du traitement du segment PV1:', error);
    return null;
  }
}

/**
 * Exporter les processeurs de segments
 */
module.exports = {
  processPidSegment,
  processPv1Segment
};