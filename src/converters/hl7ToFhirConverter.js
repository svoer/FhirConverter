/**
 * Convertisseur HL7 v2.5 vers FHIR R4
 * Transforme des messages HL7 en ressources FHIR conformes à la spécification R4
 * 
 * Adapté pour les établissements de santé français et compatible
 * avec les terminologies françaises définies par l'Agence du Numérique en Santé (ANS)
 */

const fs = require('fs');
const path = require('path');
const hl7 = require('hl7-parser'); // Parser HL7 avancé pour l'extraction des segments
const frenchNameExtractor = require('../utils/frenchNameExtractor');
const { v4: uuidv4 } = require('uuid');

/**
 * Convertir un message HL7 v2.5 en ressources FHIR R4
 * @param {string} hl7Content - Contenu du message HL7 à convertir
 * @param {Object} options - Options de conversion
 * @returns {Object} Objet contenant le bundle FHIR et les logs de conversion
 */
async function convert(hl7Content, options = {}) {
  try {
    console.log('[HL7_CONVERTER] Début de la conversion HL7 vers FHIR');
    
    // Préparer le bundle FHIR
    const fhirBundle = {
      resourceType: 'Bundle',
      type: 'transaction',
      id: uuidv4(),
      timestamp: new Date().toISOString(),
      entry: []
    };
    
    // Parser le message HL7
    const parsedMessage = parseHL7Message(hl7Content);
    if (!parsedMessage) {
      throw new Error('Impossible de parser le message HL7');
    }
    
    console.log('[HL7_CONVERTER] Message HL7 parsé avec succès');
    
    // Extraire et convertir les données du patient
    const patientResource = extractPatient(parsedMessage, hl7Content, options);
    if (patientResource) {
      addToBundle(fhirBundle, patientResource, 'Patient');
    }
    
    // Extraire et convertir les données de l'organisation
    try {
      const organizationResource = extractOrganization(parsedMessage, options);
      if (organizationResource) {
        addToBundle(fhirBundle, organizationResource, 'Organization');
      }
    } catch (error) {
      console.error('[HL7_CONVERTER] Erreur lors de l\'extraction des données de l\'organisation:', error);
    }
    
    // Extraire et convertir les données de la rencontre/visite
    try {
      const encounterResource = extractEncounter(parsedMessage, options);
      if (encounterResource) {
        addToBundle(fhirBundle, encounterResource, 'Encounter');
      }
    } catch (error) {
      console.error('[HL7_CONVERTER] Erreur lors de l\'extraction des données de rencontre:', error);
    }
    
    // Extraire et convertir les données d'assurance/couverture
    try {
      const coverageResource = extractCoverage(parsedMessage, options);
      if (coverageResource) {
        addToBundle(fhirBundle, coverageResource, 'Coverage');
      }
    } catch (error) {
      console.error('[HL7_CONVERTER] Erreur lors de l\'extraction des données d\'assurance:', error);
    }
    
    // Extraire et convertir les segments OBX en observations FHIR
    try {
      const observations = extractObservations(parsedMessage, options);
      if (observations && observations.length > 0) {
        observations.forEach(observation => {
          addToBundle(fhirBundle, observation, 'Observation');
        });
      }
    } catch (error) {
      console.error('[HL7_CONVERTER] Erreur lors de l\'extraction des observations:', error);
    }
    
    // Extraire et convertir les segments ORC/RXE en prescriptions
    try {
      const medications = extractMedications(parsedMessage, options);
      if (medications && medications.length > 0) {
        medications.forEach(medication => {
          addToBundle(fhirBundle, medication, 'MedicationRequest');
        });
      }
    } catch (error) {
      console.error('[HL7_CONVERTER] Erreur lors de l\'extraction des prescriptions médicamenteuses:', error);
    }
    
    console.log(`[HL7_CONVERTER] Conversion terminée : ${fhirBundle.entry.length} ressources FHIR générées`);
    
    return { 
      fhir: fhirBundle,
      logs: [`Conversion terminée : ${fhirBundle.entry.length} ressources FHIR générées`]
    };
  } catch (error) {
    console.error('[HL7_CONVERTER] Erreur lors de la conversion HL7 vers FHIR:', error);
    
    return { 
      fhir: {
        resourceType: 'Bundle',
        type: 'transaction',
        id: uuidv4(),
        timestamp: new Date().toISOString(),
        entry: []
      },
      logs: [`Erreur : ${error.message}`],
      error: error.message
    };
  }
}

/**
 * Parser un message HL7 avec le parser approprié
 * @param {string} hl7Content - Contenu du message HL7
 * @returns {Object} Message HL7 parsé
 */
function parseHL7Message(hl7Content) {
  if (!hl7Content || typeof hl7Content !== 'string') {
    throw new Error('Contenu HL7 invalide');
  }
  
  // Nettoyer le contenu (suppression des retours chariots, etc.)
  const cleanContent = hl7Content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  
  try {
    // Parser le message avec hl7-parser (utilise la fonction parse)
    const parsedMessage = hl7.parse(cleanContent);
    return parsedMessage;
  } catch (error) {
    console.error('[HL7_CONVERTER] Erreur lors du parsing du message HL7:', error);
    throw error;
  }
}

/**
 * Extraire et convertir les données du patient
 * @param {Object} parsedMessage - Message HL7 parsé
 * @param {string} rawHL7 - Message HL7 brut (pour extraction supplémentaire si nécessaire)
 * @param {Object} options - Options de conversion
 * @returns {Object} Ressource Patient FHIR
 */
function extractPatient(parsedMessage, rawHL7, options = {}) {
  console.log('[HL7_CONVERTER] Extraction des données du patient');
  
  // Initialiser la ressource Patient
  const patientResource = {
    resourceType: 'Patient',
    id: uuidv4(),
    identifier: [],
    active: true,
    name: [],
    telecom: [],
    address: [],
    contact: []
  };
  
  try {
    // Trouver le segment PID
    const pidSegment = findSegment(parsedMessage, 'PID');
    
    if (!pidSegment) {
      console.warn('[HL7_CONVERTER] Segment PID non trouvé, impossible de créer la ressource Patient');
      return null;
    }
    
    // Extraire les identifiants (PID-3)
    const identifiers = getFieldValues(pidSegment, 3);
    if (identifiers && identifiers.length > 0) {
      identifiers.forEach(identifier => {
        const id = getComponentValue(identifier, 1);  // ID number
        const type = getComponentValue(identifier, 5); // ID type
        const authority = getComponentValue(identifier, 4); // Authority
        
        if (id) {
          const fhirIdentifier = {
            value: id,
            system: authority ? `urn:oid:${authority}` : undefined,
            type: type ? { text: type } : undefined
          };
          
          // Ajouter l'identifiant seulement s'il a une valeur
          if (fhirIdentifier.value) {
            patientResource.identifier.push(fhirIdentifier);
          }
        }
      });
    }
    
    // Extraire les noms avec le module spécifique pour les noms français
    const names = frenchNameExtractor.extractFrenchNames(rawHL7);
    if (names && names.length > 0) {
      patientResource.name = names;
    } else {
      // Fallback: Extraire manuellement depuis le segment PID si l'extracteur spécifique échoue
      const nameField = getFieldValues(pidSegment, 5)[0];
      if (nameField) {
        const familyName = getComponentValue(nameField, 1);
        const givenName = getComponentValue(nameField, 2);
        
        if (familyName || givenName) {
          patientResource.name.push({
            family: familyName,
            given: givenName ? [givenName] : undefined,
            use: 'official'
          });
        }
      }
    }
    
    // Extraire la date de naissance (PID-7)
    const birthDateValue = getFieldValue(pidSegment, 7);
    if (birthDateValue) {
      // Convertir le format de date HL7 en format FHIR (YYYY-MM-DD)
      patientResource.birthDate = convertHL7DateToFHIR(birthDateValue);
    }
    
    // Extraire le genre (PID-8)
    const genderValue = getFieldValue(pidSegment, 8);
    if (genderValue) {
      patientResource.gender = mapHL7GenderToFHIR(genderValue);
    }
    
    // Extraire l'adresse (PID-11)
    const addressValues = getFieldValues(pidSegment, 11);
    if (addressValues && addressValues.length > 0) {
      addressValues.forEach(addressField => {
        const streetAddress = getComponentValue(addressField, 1);
        const city = getComponentValue(addressField, 3);
        const state = getComponentValue(addressField, 4);
        const postalCode = getComponentValue(addressField, 5);
        const country = getComponentValue(addressField, 6);
        
        const address = {
          use: 'home',
          line: streetAddress ? [streetAddress] : undefined,
          city: city || undefined,
          state: state || undefined,
          postalCode: postalCode || undefined,
          country: country || undefined
        };
        
        // N'ajouter l'adresse que si au moins un champ est rempli
        if (streetAddress || city || state || postalCode || country) {
          patientResource.address.push(address);
        }
      });
    }
    
    // Extraire les moyens de contact (PID-13, PID-14)
    const phoneNumbers = getFieldValues(pidSegment, 13);
    if (phoneNumbers && phoneNumbers.length > 0) {
      phoneNumbers.forEach(phoneField => {
        const phoneNumber = getComponentValue(phoneField, 1);
        const email = getComponentValue(phoneField, 4);
        
        if (phoneNumber) {
          patientResource.telecom.push({
            system: 'phone',
            value: phoneNumber,
            use: 'home'
          });
        }
        
        if (email) {
          patientResource.telecom.push({
            system: 'email',
            value: email
          });
        }
      });
    }
    
    // Extraire les contacts d'urgence (NK1)
    const nk1Segments = findAllSegments(parsedMessage, 'NK1');
    if (nk1Segments && nk1Segments.length > 0) {
      nk1Segments.forEach(nk1 => {
        const contactName = getFieldValues(nk1, 2)[0];
        const relationship = getFieldValues(nk1, 3)[0];
        const contactPhone = getFieldValues(nk1, 5)[0];
        
        if (contactName || relationship || contactPhone) {
          const contact = {
            relationship: relationship ? [{ text: getComponentValue(relationship, 1) }] : undefined,
            name: contactName ? {
              family: getComponentValue(contactName, 1),
              given: [getComponentValue(contactName, 2)]
            } : undefined,
            telecom: contactPhone ? [
              {
                system: 'phone',
                value: getComponentValue(contactPhone, 1),
                use: 'home'
              }
            ] : undefined
          };
          
          patientResource.contact.push(contact);
        }
      });
    }
    
    return patientResource;
  } catch (error) {
    console.error('[HL7_CONVERTER] Erreur lors de l\'extraction des données du patient:', error);
    return null;
  }
}

/**
 * Extraire et convertir les données de l'organisation
 * @param {Object} parsedMessage - Message HL7 parsé
 * @param {Object} options - Options de conversion
 * @returns {Object} Ressource Organization FHIR
 */
function extractOrganization(parsedMessage, options = {}) {
  console.log('[HL7_CONVERTER] Extraction des données de l\'organisation');
  
  // Initialiser la ressource Organization
  const organizationResource = {
    resourceType: 'Organization',
    id: uuidv4(),
    identifier: [],
    active: true,
    type: [],
    name: '',
    telecom: [],
    address: []
  };
  
  try {
    // Trouver le segment MSH
    const mshSegment = findSegment(parsedMessage, 'MSH');
    
    if (!mshSegment) {
      console.warn('[HL7_CONVERTER] Segment MSH non trouvé, impossible de créer la ressource Organization');
      return null;
    }
    
    // Extraire le nom de l'établissement émetteur (MSH-4)
    const sendingFacility = getFieldValue(mshSegment, 4);
    if (sendingFacility) {
      organizationResource.name = sendingFacility;
      
      // Ajouter un identifiant basé sur le nom de l'établissement
      organizationResource.identifier.push({
        system: 'urn:oid:1.3.6.1.4.1.21367.2010.1.2.300',
        value: sendingFacility
      });
    }
    
    // Chercher des informations supplémentaires dans d'autres segments
    
    // PV1-3.6 contient souvent le nom du service
    const pv1Segment = findSegment(parsedMessage, 'PV1');
    if (pv1Segment) {
      const locationField = getFieldValues(pv1Segment, 3)[0];
      if (locationField) {
        const department = getComponentValue(locationField, 6);
        if (department) {
          // Ajouter un type d'organisation
          organizationResource.type.push({
            text: department
          });
        }
      }
    }
    
    return organizationResource;
  } catch (error) {
    console.error('[HL7_CONVERTER] Erreur lors de l\'extraction des données de l\'organisation:', error);
    return null;
  }
}

/**
 * Extraire et convertir les données de la rencontre/visite
 * @param {Object} parsedMessage - Message HL7 parsé
 * @param {Object} options - Options de conversion
 * @returns {Object} Ressource Encounter FHIR
 */
function extractEncounter(parsedMessage, options = {}) {
  console.log('[HL7_CONVERTER] Extraction des données de rencontre');
  
  // Initialiser la ressource Encounter
  const encounterResource = {
    resourceType: 'Encounter',
    id: uuidv4(),
    identifier: [],
    status: 'unknown',
    class: {
      system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
      code: 'AMB',
      display: 'ambulatory'
    },
    type: [],
    subject: {
      reference: 'Patient/' + (options.patientId || '')
    },
    period: {}
  };
  
  try {
    // Trouver le segment PV1
    const pv1Segment = findSegment(parsedMessage, 'PV1');
    
    if (!pv1Segment) {
      console.warn('[HL7_CONVERTER] Segment PV1 non trouvé, impossible de créer la ressource Encounter');
      return null;
    }
    
    // Extraire le numéro de visite (PV1-19)
    const visitNumber = getFieldValue(pv1Segment, 19);
    if (visitNumber) {
      encounterResource.identifier.push({
        system: 'urn:oid:1.3.6.1.4.1.21367.2010.1.2.300',
        value: visitNumber
      });
    }
    
    // Extraire le type de patient (PV1-2)
    const patientClass = getFieldValue(pv1Segment, 2);
    if (patientClass) {
      encounterResource.class = mapHL7PatientClassToFHIR(patientClass);
    }
    
    // Extraire le service (PV1-10)
    const hospitalService = getFieldValue(pv1Segment, 10);
    if (hospitalService) {
      encounterResource.type.push({
        text: hospitalService
      });
    }
    
    // Extraire les dates d'entrée et de sortie (PV1-44, PV1-45)
    const admitDate = getFieldValue(pv1Segment, 44);
    const dischargeDate = getFieldValue(pv1Segment, 45);
    
    if (admitDate) {
      encounterResource.period.start = convertHL7DateTimeToFHIR(admitDate);
    }
    
    if (dischargeDate) {
      encounterResource.period.end = convertHL7DateTimeToFHIR(dischargeDate);
    }
    
    // Déterminer le statut de la rencontre
    const patientStatus = getFieldValue(pv1Segment, 40);
    if (patientStatus) {
      encounterResource.status = mapHL7PatientStatusToFHIR(patientStatus);
    } else if (dischargeDate) {
      encounterResource.status = 'finished';
    } else if (admitDate) {
      encounterResource.status = 'in-progress';
    }
    
    // Ajouter la référence au médecin
    const attendingDoctor = getFieldValues(pv1Segment, 7)[0];
    if (attendingDoctor) {
      const doctorId = getComponentValue(attendingDoctor, 1);
      if (doctorId) {
        encounterResource.participant = [{
          type: [{
            coding: [{
              system: 'http://terminology.hl7.org/CodeSystem/v3-ParticipationType',
              code: 'ATND',
              display: 'attender'
            }]
          }],
          individual: {
            reference: `Practitioner/${doctorId}`
          }
        }];
      }
    }
    
    return encounterResource;
  } catch (error) {
    console.error('[HL7_CONVERTER] Erreur lors de l\'extraction des données de rencontre:', error);
    return null;
  }
}

/**
 * Extraire et convertir les données d'assurance/couverture
 * @param {Object} parsedMessage - Message HL7 parsé
 * @param {Object} options - Options de conversion
 * @returns {Object} Ressource Coverage FHIR
 */
function extractCoverage(parsedMessage, options = {}) {
  console.log('[HL7_CONVERTER] Extraction des données d\'assurance');
  
  // Initialiser la ressource Coverage
  const coverageResource = {
    resourceType: 'Coverage',
    id: uuidv4(),
    identifier: [],
    status: 'active',
    type: {
      text: 'Assurance maladie'
    },
    beneficiary: {
      reference: 'Patient/' + (options.patientId || '')
    },
    period: {}
  };
  
  try {
    // Trouver le segment IN1
    const in1Segment = findSegment(parsedMessage, 'IN1');
    
    if (!in1Segment) {
      console.warn('[HL7_CONVERTER] Segment IN1 non trouvé, impossible de créer la ressource Coverage');
      return null;
    }
    
    // Extraire le numéro d'assurance (IN1-2)
    const insuranceNumber = getFieldValue(in1Segment, 2);
    if (insuranceNumber) {
      coverageResource.identifier.push({
        system: 'urn:oid:1.3.6.1.4.1.21367.2010.1.2.300',
        value: insuranceNumber
      });
    }
    
    // Extraire le nom de la compagnie d'assurance (IN1-4)
    const insuranceCompany = getFieldValues(in1Segment, 4)[0];
    if (insuranceCompany) {
      coverageResource.payor = [{
        display: getComponentValue(insuranceCompany, 1)
      }];
    }
    
    // Extraire les dates de début et de fin de couverture (IN1-12, IN1-13)
    const startDate = getFieldValue(in1Segment, 12);
    const endDate = getFieldValue(in1Segment, 13);
    
    if (startDate) {
      coverageResource.period.start = convertHL7DateToFHIR(startDate);
    }
    
    if (endDate) {
      coverageResource.period.end = convertHL7DateToFHIR(endDate);
    }
    
    return coverageResource;
  } catch (error) {
    console.error('[HL7_CONVERTER] Erreur lors de l\'extraction des données d\'assurance:', error);
    return null;
  }
}

/**
 * Extraire et convertir les segments OBX en observations FHIR
 * @param {Object} parsedMessage - Message HL7 parsé
 * @param {Object} options - Options de conversion
 * @returns {Array} Liste des ressources Observation FHIR
 */
function extractObservations(parsedMessage, options = {}) {
  console.log('[HL7_CONVERTER] Extraction des observations');
  
  const observations = [];
  
  try {
    // Trouver tous les segments OBX
    const obxSegments = findAllSegments(parsedMessage, 'OBX');
    
    if (!obxSegments || obxSegments.length === 0) {
      console.warn('[HL7_CONVERTER] Aucun segment OBX trouvé');
      return observations;
    }
    
    // Parcourir tous les segments OBX
    obxSegments.forEach(obxSegment => {
      // Initialiser la ressource Observation
      const observationResource = {
        resourceType: 'Observation',
        id: uuidv4(),
        identifier: [],
        status: 'final',
        code: {
          coding: [],
          text: ''
        },
        subject: {
          reference: 'Patient/' + (options.patientId || '')
        },
        effective: {},
        value: {}
      };
      
      // Extraire le type d'observation (OBX-3)
      const observationType = getFieldValues(obxSegment, 3)[0];
      if (observationType) {
        const code = getComponentValue(observationType, 1);
        const text = getComponentValue(observationType, 2);
        const system = getComponentValue(observationType, 3);
        
        if (code) {
          observationResource.code.coding.push({
            code: code,
            display: text,
            system: system ? `urn:oid:${system}` : undefined
          });
        }
        
        if (text) {
          observationResource.code.text = text;
        }
      }
      
      // Extraire la valeur de l'observation (OBX-5)
      const valueType = getFieldValue(obxSegment, 2);
      const valueField = getFieldValue(obxSegment, 5);
      
      if (valueField) {
        switch (valueType) {
          case 'NM': // Numérique
            observationResource.valueQuantity = {
              value: parseFloat(valueField),
              unit: getFieldValue(obxSegment, 6) || '',
              system: 'http://unitsofmeasure.org',
              code: getFieldValue(obxSegment, 6) || ''
            };
            break;
          case 'ST': // Chaîne de caractères
          case 'TX': // Texte
            observationResource.valueString = valueField;
            break;
          case 'CE': // Code
            observationResource.valueCodeableConcept = {
              coding: [{
                code: valueField,
                display: getFieldValue(obxSegment, 6) || ''
              }],
              text: getFieldValue(obxSegment, 6) || valueField
            };
            break;
          default:
            observationResource.valueString = valueField;
        }
      }
      
      // Extraire la date/heure de l'observation (OBX-14)
      const dateTime = getFieldValue(obxSegment, 14);
      if (dateTime) {
        observationResource.effectiveDateTime = convertHL7DateTimeToFHIR(dateTime);
      }
      
      // Extraire le statut de l'observation (OBX-11)
      const status = getFieldValue(obxSegment, 11);
      if (status) {
        switch (status) {
          case 'F':
            observationResource.status = 'final';
            break;
          case 'P':
            observationResource.status = 'preliminary';
            break;
          case 'C':
            observationResource.status = 'corrected';
            break;
          case 'X':
            observationResource.status = 'cancelled';
            break;
          default:
            observationResource.status = 'unknown';
        }
      }
      
      observations.push(observationResource);
    });
    
    return observations;
  } catch (error) {
    console.error('[HL7_CONVERTER] Erreur lors de l\'extraction des observations:', error);
    return [];
  }
}

/**
 * Extraire et convertir les segments ORC/RXE en prescriptions médicamenteuses
 * @param {Object} parsedMessage - Message HL7 parsé
 * @param {Object} options - Options de conversion
 * @returns {Array} Liste des ressources MedicationRequest FHIR
 */
function extractMedications(parsedMessage, options = {}) {
  console.log('[HL7_CONVERTER] Extraction des prescriptions médicamenteuses');
  
  const medications = [];
  
  try {
    // Trouver tous les segments ORC (commandes)
    const orcSegments = findAllSegments(parsedMessage, 'ORC');
    
    if (!orcSegments || orcSegments.length === 0) {
      console.warn('[HL7_CONVERTER] Aucun segment ORC trouvé');
      return medications;
    }
    
    // Parcourir tous les segments ORC
    orcSegments.forEach((orcSegment, index) => {
      // Trouver le segment RXE correspondant
      const rxeSegment = findSegmentAfter(parsedMessage, 'RXE', orcSegment);
      
      if (!rxeSegment) {
        console.warn(`[HL7_CONVERTER] Aucun segment RXE trouvé pour ORC #${index + 1}`);
        return;
      }
      
      // Initialiser la ressource MedicationRequest
      const medicationResource = {
        resourceType: 'MedicationRequest',
        id: uuidv4(),
        identifier: [],
        status: 'active',
        intent: 'order',
        medicationCodeableConcept: {
          coding: [],
          text: ''
        },
        subject: {
          reference: 'Patient/' + (options.patientId || '')
        },
        authoredOn: '',
        requester: {},
        dosageInstruction: []
      };
      
      // Extraire le numéro de commande (ORC-2)
      const orderNumber = getFieldValue(orcSegment, 2);
      if (orderNumber) {
        medicationResource.identifier.push({
          system: 'urn:oid:1.3.6.1.4.1.21367.2010.1.2.300',
          value: orderNumber
        });
      }
      
      // Extraire le médicament (RXE-2)
      const medication = getFieldValues(rxeSegment, 2)[0];
      if (medication) {
        const code = getComponentValue(medication, 1);
        const text = getComponentValue(medication, 2);
        const system = getComponentValue(medication, 3);
        
        if (code) {
          medicationResource.medicationCodeableConcept.coding.push({
            code: code,
            display: text,
            system: system ? `urn:oid:${system}` : undefined
          });
        }
        
        if (text) {
          medicationResource.medicationCodeableConcept.text = text;
        }
      }
      
      // Extraire la date de prescription (ORC-9)
      const dateTime = getFieldValue(orcSegment, 9);
      if (dateTime) {
        medicationResource.authoredOn = convertHL7DateTimeToFHIR(dateTime);
      }
      
      // Extraire le prescripteur (ORC-12)
      const prescriber = getFieldValues(orcSegment, 12)[0];
      if (prescriber) {
        const id = getComponentValue(prescriber, 1);
        const name = `${getComponentValue(prescriber, 3)} ${getComponentValue(prescriber, 2)}`;
        
        medicationResource.requester = {
          display: name
        };
        
        if (id) {
          medicationResource.requester.reference = `Practitioner/${id}`;
        }
      }
      
      // Extraire les instructions de dosage (RXE-3, RXE-4, RXE-5)
      const doseQuantity = getFieldValue(rxeSegment, 3);
      const doseUnits = getFieldValue(rxeSegment, 4);
      const frequency = getFieldValue(rxeSegment, 5);
      
      if (doseQuantity || frequency) {
        const dosage = {
          text: `${doseQuantity || ''} ${doseUnits || ''} ${frequency || ''}`.trim(),
          timing: {}
        };
        
        if (doseQuantity) {
          dosage.doseAndRate = [{
            doseQuantity: {
              value: parseFloat(doseQuantity),
              unit: doseUnits || '',
              system: 'http://unitsofmeasure.org',
              code: doseUnits || ''
            }
          }];
        }
        
        if (frequency) {
          dosage.timing.code = {
            text: frequency
          };
        }
        
        medicationResource.dosageInstruction.push(dosage);
      }
      
      // Extraire le statut de la commande (ORC-5)
      const status = getFieldValue(orcSegment, 5);
      if (status) {
        switch (status) {
          case 'CM': // Completed
            medicationResource.status = 'completed';
            break;
          case 'CA': // Cancelled
            medicationResource.status = 'cancelled';
            break;
          case 'SC': // In process
            medicationResource.status = 'active';
            break;
          default:
            medicationResource.status = 'unknown';
        }
      }
      
      medications.push(medicationResource);
    });
    
    return medications;
  } catch (error) {
    console.error('[HL7_CONVERTER] Erreur lors de l\'extraction des prescriptions médicamenteuses:', error);
    return [];
  }
}

// Fonctions utilitaires

/**
 * Ajouter une ressource au bundle FHIR
 * @param {Object} bundle - Bundle FHIR
 * @param {Object} resource - Ressource FHIR à ajouter
 * @param {string} resourceType - Type de ressource
 */
function addToBundle(bundle, resource, resourceType) {
  if (!resource || !resource.id) return;
  
  bundle.entry.push({
    fullUrl: `urn:uuid:${resource.id}`,
    resource: resource,
    request: {
      method: 'POST',
      url: resourceType
    }
  });
}

/**
 * Trouver un segment dans le message HL7 parsé
 * @param {Object} parsedMessage - Message HL7 parsé
 * @param {string} segmentName - Nom du segment à trouver
 * @returns {Object|null} Segment trouvé ou null
 */
function findSegment(parsedMessage, segmentName) {
  try {
    if (!parsedMessage || !parsedMessage.segments) return null;
    
    // Rechercher le segment dans la liste des segments
    return parsedMessage.segments.find(segment => segment.name === segmentName);
  } catch (error) {
    console.error(`[HL7_CONVERTER] Erreur lors de la recherche du segment ${segmentName}:`, error);
    return null;
  }
}

/**
 * Trouver tous les segments d'un type donné
 * @param {Object} parsedMessage - Message HL7 parsé
 * @param {string} segmentName - Nom du segment à trouver
 * @returns {Array} Liste des segments trouvés
 */
function findAllSegments(parsedMessage, segmentName) {
  try {
    if (!parsedMessage || !parsedMessage.segments) return [];
    
    // Rechercher tous les segments du type demandé
    return parsedMessage.segments.filter(segment => segment.name === segmentName);
  } catch (error) {
    console.error(`[HL7_CONVERTER] Erreur lors de la recherche des segments ${segmentName}:`, error);
    return [];
  }
}

/**
 * Trouver un segment après un autre segment
 * @param {Object} parsedMessage - Message HL7 parsé
 * @param {string} segmentName - Nom du segment à trouver
 * @param {Object} afterSegment - Segment après lequel chercher
 * @returns {Object|null} Segment trouvé ou null
 */
function findSegmentAfter(parsedMessage, segmentName, afterSegment) {
  try {
    if (!parsedMessage || !parsedMessage.segments || !afterSegment) return null;
    
    // Trouver l'index du segment de référence
    const segmentIndex = parsedMessage.segments.indexOf(afterSegment);
    
    if (segmentIndex === -1) return null;
    
    // Chercher le premier segment du type demandé après le segment de référence
    for (let i = segmentIndex + 1; i < parsedMessage.segments.length; i++) {
      if (parsedMessage.segments[i].name === segmentName) {
        return parsedMessage.segments[i];
      }
    }
    
    return null;
  } catch (error) {
    console.error(`[HL7_CONVERTER] Erreur lors de la recherche du segment ${segmentName} après un autre segment:`, error);
    return null;
  }
}

/**
 * Obtenir la valeur d'un champ d'un segment
 * @param {Object} segment - Segment HL7
 * @param {number} fieldIndex - Index du champ (1-based)
 * @returns {string|null} Valeur du champ ou null
 */
function getFieldValue(segment, fieldIndex) {
  try {
    if (!segment || !segment.fields) return null;
    
    // Ajuster l'index (HL7 est 1-based, JavaScript est 0-based)
    const adjustedIndex = fieldIndex - 1;
    
    if (adjustedIndex < 0 || adjustedIndex >= segment.fields.length) return null;
    
    const field = segment.fields[adjustedIndex];
    
    // Si le champ a plusieurs répétitions, renvoyer la première
    if (Array.isArray(field) && field.length > 0) {
      if (typeof field[0] === 'string') {
        return field[0];
      } else if (Array.isArray(field[0])) {
        return field[0][0]; // Première composante de la première répétition
      }
      return null;
    }
    
    // Si le champ est une composante
    if (Array.isArray(field)) {
      return field[0]; // Première composante
    }
    
    // Si le champ est une valeur simple
    return field;
  } catch (error) {
    console.error(`[HL7_CONVERTER] Erreur lors de l'obtention de la valeur du champ ${fieldIndex}:`, error);
    return null;
  }
}

/**
 * Obtenir toutes les valeurs d'un champ (pour les champs à répétition)
 * @param {Object} segment - Segment HL7
 * @param {number} fieldIndex - Index du champ (1-based)
 * @returns {Array} Liste des valeurs du champ
 */
function getFieldValues(segment, fieldIndex) {
  try {
    if (!segment || !segment.fields) return [];
    
    // Ajuster l'index (HL7 est 1-based, JavaScript est 0-based)
    const adjustedIndex = fieldIndex - 1;
    
    if (adjustedIndex < 0 || adjustedIndex >= segment.fields.length) return [];
    
    const field = segment.fields[adjustedIndex];
    
    // Si le champ a plusieurs répétitions
    if (Array.isArray(field)) {
      return field;
    }
    
    // Si le champ est une valeur simple
    return [field];
  } catch (error) {
    console.error(`[HL7_CONVERTER] Erreur lors de l'obtention des valeurs du champ ${fieldIndex}:`, error);
    return [];
  }
}

/**
 * Obtenir la valeur d'une composante d'un champ
 * @param {string|Array} field - Champ HL7
 * @param {number} componentIndex - Index de la composante (1-based)
 * @returns {string|null} Valeur de la composante ou null
 */
function getComponentValue(field, componentIndex) {
  try {
    if (!field) return null;
    
    // Ajuster l'index (HL7 est 1-based, JavaScript est 0-based)
    const adjustedIndex = componentIndex - 1;
    
    // Si le champ est un tableau (plusieurs composantes)
    if (Array.isArray(field)) {
      if (adjustedIndex < 0 || adjustedIndex >= field.length) return null;
      return field[adjustedIndex];
    }
    
    // Si le champ est une valeur simple et qu'on demande la première composante
    if (adjustedIndex === 0) {
      return field;
    }
    
    return null;
  } catch (error) {
    console.error(`[HL7_CONVERTER] Erreur lors de l'obtention de la valeur de la composante ${componentIndex}:`, error);
    return null;
  }
}

/**
 * Convertir une date HL7 en format FHIR
 * @param {string} hl7Date - Date au format HL7 (YYYYMMDD)
 * @returns {string} Date au format FHIR (YYYY-MM-DD)
 */
function convertHL7DateToFHIR(hl7Date) {
  if (!hl7Date || hl7Date.length < 8) return null;
  
  try {
    // Format HL7: YYYYMMDD
    const year = hl7Date.substring(0, 4);
    const month = hl7Date.substring(4, 6);
    const day = hl7Date.substring(6, 8);
    
    // Format FHIR: YYYY-MM-DD
    return `${year}-${month}-${day}`;
  } catch (error) {
    console.error('[HL7_CONVERTER] Erreur lors de la conversion de la date HL7:', error);
    return null;
  }
}

/**
 * Convertir une date/heure HL7 en format FHIR
 * @param {string} hl7DateTime - Date/heure au format HL7 (YYYYMMDDhhmmss)
 * @returns {string} Date/heure au format FHIR (YYYY-MM-DDThh:mm:ss+zz:zz)
 */
function convertHL7DateTimeToFHIR(hl7DateTime) {
  if (!hl7DateTime || hl7DateTime.length < 8) return null;
  
  try {
    // Format HL7: YYYYMMDDhhmmss
    const year = hl7DateTime.substring(0, 4);
    const month = hl7DateTime.substring(4, 6);
    const day = hl7DateTime.substring(6, 8);
    
    let hours = '00';
    let minutes = '00';
    let seconds = '00';
    
    if (hl7DateTime.length >= 10) {
      hours = hl7DateTime.substring(8, 10);
    }
    
    if (hl7DateTime.length >= 12) {
      minutes = hl7DateTime.substring(10, 12);
    }
    
    if (hl7DateTime.length >= 14) {
      seconds = hl7DateTime.substring(12, 14);
    }
    
    // Format FHIR: YYYY-MM-DDThh:mm:ss
    return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
  } catch (error) {
    console.error('[HL7_CONVERTER] Erreur lors de la conversion de la date/heure HL7:', error);
    return null;
  }
}

/**
 * Mapper le genre HL7 au format FHIR
 * @param {string} hl7Gender - Genre au format HL7 (M, F, O, U, A, N)
 * @returns {string} Genre au format FHIR (male, female, other, unknown)
 */
function mapHL7GenderToFHIR(hl7Gender) {
  if (!hl7Gender) return 'unknown';
  
  switch (hl7Gender.toUpperCase()) {
    case 'M':
      return 'male';
    case 'F':
      return 'female';
    case 'O':
      return 'other';
    case 'U':
    case 'A':
    case 'N':
    default:
      return 'unknown';
  }
}

/**
 * Mapper la classe de patient HL7 au format FHIR
 * @param {string} hl7Class - Classe de patient au format HL7 (I, O, E, P, R, B, C, N)
 * @returns {Object} Classe de patient au format FHIR
 */
function mapHL7PatientClassToFHIR(hl7Class) {
  if (!hl7Class) {
    return {
      system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
      code: 'AMB',
      display: 'ambulatory'
    };
  }
  
  switch (hl7Class.toUpperCase()) {
    case 'I':
      return {
        system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
        code: 'IMP',
        display: 'inpatient'
      };
    case 'O':
      return {
        system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
        code: 'AMB',
        display: 'ambulatory'
      };
    case 'E':
      return {
        system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
        code: 'EMER',
        display: 'emergency'
      };
    case 'P':
      return {
        system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
        code: 'AMB',
        display: 'ambulatory'
      };
    case 'R':
      return {
        system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
        code: 'ACUTE',
        display: 'acute'
      };
    case 'B':
      return {
        system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
        code: 'OBSENC',
        display: 'observation encounter'
      };
    case 'C':
      return {
        system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
        code: 'PRENC',
        display: 'pre-admission'
      };
    case 'N':
    default:
      return {
        system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
        code: 'AMB',
        display: 'ambulatory'
      };
  }
}

/**
 * Mapper le statut du patient HL7 au format FHIR
 * @param {string} hl7Status - Statut du patient au format HL7
 * @returns {string} Statut de la rencontre au format FHIR
 */
function mapHL7PatientStatusToFHIR(hl7Status) {
  if (!hl7Status) return 'unknown';
  
  switch (hl7Status.toUpperCase()) {
    case 'A': // Alive
      return 'in-progress';
    case 'D': // Discharged
      return 'finished';
    case 'C': // Cancelled
      return 'cancelled';
    case 'P': // Planned
      return 'planned';
    case 'E': // Emergency
      return 'in-progress';
    default:
      return 'unknown';
  }
}

module.exports = {
  convert
};