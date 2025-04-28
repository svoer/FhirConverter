/**
 * Processeurs de segments HL7 pour la conversion vers FHIR
 * Chaque fonction traite un type de segment HL7 spécifique
 */

const { v4: uuidv4 } = require('uuid');

/**
 * Traiter un segment MSH (Message Header)
 * @param {Array} segment - Segment MSH
 * @param {Object} options - Options de conversion
 * @returns {Object} Ressource FHIR MessageHeader
 */
function processMSH(segment, options = {}) {
  const messageID = segment[10] ? segment[10][0] : uuidv4();
  const eventType = segment[9] ? segment[9][0] : '';
  const timestamp = segment[7] ? segment[7][0] : new Date().toISOString();
  
  // Créer une ressource MessageHeader
  const messageHeader = {
    resourceType: 'MessageHeader',
    id: `message-${messageID}`,
    meta: {
      profile: ['http://hl7.org/fhir/StructureDefinition/MessageHeader']
    },
    eventCoding: {
      system: 'http://terminology.hl7.org/CodeSystem/v2-0003',
      code: eventType
    },
    source: {
      name: segment[3] ? segment[3][0] : 'Unknown',
      software: segment[3] ? segment[3][0] : 'Unknown',
      endpoint: `urn:oid:${segment[4] ? segment[4][0] : '0.0.0.0'}`
    },
    timestamp: timestamp
  };
  
  return messageHeader;
}

/**
 * Traiter un segment PID (Patient Identification)
 * @param {Array} segment - Segment PID
 * @param {Object} context - Contexte de conversion
 * @returns {Object} Ressource FHIR Patient
 */
function processPID(segment, context = {}) {
  const { names } = context;
  const patientID = segment[3] && segment[3].length > 0 ? segment[3][0][0] : uuidv4();
  const patientIdentifiers = [];
  
  // Gestion des identifiants
  if (segment[3]) {
    segment[3].forEach(id => {
      if (id.length > 0) {
        const identifier = {
          system: id[4] ? `http://terminology.hl7.org/CodeSystem/v2-0203/${id[4]}` : 'http://example.org/identifiers',
          value: id[0]
        };
        patientIdentifiers.push(identifier);
      }
    });
  }
  
  // Obtenir les noms depuis l'extracteur de noms français ou créer un nom par défaut
  let humanNames = names || [];
  
  // Si aucun nom n'a été extrait, essayer de le faire à partir du segment PID
  if (humanNames.length === 0 && segment[5]) {
    segment[5].forEach(name => {
      if (name.length > 1) {
        const nameObj = {
          family: name[0],
          given: name[1] ? [name[1]] : [],
          use: 'official'
        };
        
        if (name[6] === 'D') {
          nameObj.use = 'maiden';
        }
        
        humanNames.push(nameObj);
      }
    });
  }
  
  // Extraire la date de naissance
  let birthDate = null;
  if (segment[7] && segment[7][0]) {
    const dateStr = segment[7][0];
    // Format AAAAMMJJ
    if (dateStr.length === 8) {
      birthDate = `${dateStr.substring(0, 4)}-${dateStr.substring(4, 6)}-${dateStr.substring(6, 8)}`;
    }
  }
  
  // Extraire le sexe
  let gender = 'unknown';
  if (segment[8] && segment[8][0]) {
    const genderCode = segment[8][0];
    switch (genderCode) {
      case 'M': gender = 'male'; break;
      case 'F': gender = 'female'; break;
      case 'O': gender = 'other'; break;
      case 'U': gender = 'unknown'; break;
      default: gender = 'unknown';
    }
  }
  
  // Adresses
  const addresses = [];
  if (segment[11]) {
    segment[11].forEach(addr => {
      if (addr.length > 0) {
        const address = {
          line: [addr[0] || '', addr[1] || ''],
          city: addr[2] || '',
          state: addr[3] || '',
          postalCode: addr[4] || '',
          country: addr[5] || ''
        };
        addresses.push(address);
      }
    });
  }
  
  // Téléphones
  const telecoms = [];
  if (segment[13]) {
    segment[13].forEach(phone => {
      if (phone.length > 0) {
        const telecom = {
          system: 'phone',
          value: phone[0] || '',
          use: 'home'
        };
        telecoms.push(telecom);
      }
    });
  }
  
  // Créer la ressource Patient
  const patient = {
    resourceType: 'Patient',
    id: `patient-${patientID}`,
    meta: {
      profile: ['http://hl7.org/fhir/StructureDefinition/Patient']
    },
    identifier: patientIdentifiers,
    name: humanNames,
    gender: gender,
    telecom: telecoms,
    address: addresses
  };
  
  // Ajouter la date de naissance si disponible
  if (birthDate) {
    patient.birthDate = birthDate;
  }
  
  return patient;
}

/**
 * Traiter un segment PV1 (Patient Visit)
 * @param {Array} segment - Segment PV1
 * @param {Object} context - Contexte de conversion
 * @returns {Object} Ressource FHIR Encounter
 */
function processPV1(segment, context = {}) {
  const { resources } = context;
  const encounterID = segment[1] ? segment[1][0] : uuidv4();
  
  // Patient référence (à partir des ressources existantes)
  let patientReference = null;
  if (resources) {
    const patient = resources.find(r => r.resourceType === 'Patient');
    if (patient) {
      patientReference = { reference: `Patient/${patient.id}` };
    }
  }
  
  // Type de rencontre
  let classCode = 'AMB';
  let classDisplay = 'Ambulatoire';
  
  if (segment[2]) {
    switch (segment[2][0]) {
      case 'I': 
        classCode = 'IMP'; 
        classDisplay = 'Hospitalisation'; 
        break;
      case 'O': 
        classCode = 'AMB'; 
        classDisplay = 'Ambulatoire'; 
        break;
      case 'E': 
        classCode = 'EMER'; 
        classDisplay = 'Urgences'; 
        break;
      default: 
        classCode = 'AMB'; 
        classDisplay = 'Ambulatoire';
    }
  }
  
  // Emplacement
  const locations = [];
  if (segment[3]) {
    const locationRef = {
      location: {
        reference: `Location/${uuidv4()}`,
        display: segment[3][0]
      }
    };
    locations.push(locationRef);
  }
  
  // Médecin traitant
  const practitioners = [];
  if (segment[7]) {
    const doctor = segment[7][0].split('^');
    const practitionerRef = {
      type: [{
        coding: [{
          system: 'http://terminology.hl7.org/CodeSystem/v3-ParticipationType',
          code: 'PPRF',
          display: 'Médecin responsable'
        }]
      }],
      individual: {
        reference: `Practitioner/${uuidv4()}`,
        display: doctor.length > 1 ? `${doctor[1]} ${doctor[0]}` : doctor[0]
      }
    };
    practitioners.push(practitionerRef);
  }
  
  // Déterminer le statut de la rencontre
  let status = 'in-progress';
  if (segment[36]) {
    switch (segment[36][0]) {
      case 'A': status = 'arrived'; break;
      case 'P': status = 'planned'; break;
      case 'C': status = 'cancelled'; break;
      case 'D': status = 'finished'; break;
      default: status = 'in-progress';
    }
  }
  
  // Date de début
  let period = {};
  if (segment[44]) {
    const startDate = segment[44][0];
    period.start = startDate;
  }
  
  // Créer la ressource Encounter
  const encounter = {
    resourceType: 'Encounter',
    id: `encounter-${encounterID}`,
    meta: {
      profile: ['http://hl7.org/fhir/StructureDefinition/Encounter']
    },
    status: status,
    class: {
      system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
      code: classCode,
      display: classDisplay
    },
    subject: patientReference,
    participant: practitioners,
    location: locations
  };
  
  // Ajouter la période si disponible
  if (Object.keys(period).length > 0) {
    encounter.period = period;
  }
  
  return encounter;
}

/**
 * Traiter un segment NK1 (Next of Kin)
 * @param {Array} segment - Segment NK1
 * @param {Object} context - Contexte de conversion
 * @returns {Object} Ressource FHIR RelatedPerson
 */
function processNK1(segment, context = {}) {
  const { resources } = context;
  const nk1ID = segment[1] ? segment[1][0] : uuidv4();
  
  // Patient référence
  let patientReference = null;
  if (resources) {
    const patient = resources.find(r => r.resourceType === 'Patient');
    if (patient) {
      patientReference = { reference: `Patient/${patient.id}` };
    }
  }
  
  // Nom
  const humanName = {
    use: 'official'
  };
  
  if (segment[2]) {
    const nameComponents = segment[2][0].split('^');
    if (nameComponents.length > 0) {
      humanName.family = nameComponents[0];
      if (nameComponents.length > 1) {
        humanName.given = [nameComponents[1]];
      }
    }
  }
  
  // Relation
  const relationship = [];
  if (segment[3]) {
    relationship.push({
      coding: [{
        system: 'http://terminology.hl7.org/CodeSystem/v3-RoleCode',
        code: 'FAMMEMB',
        display: segment[3][0]
      }]
    });
  }
  
  // Adresse
  const addresses = [];
  if (segment[4]) {
    const addrComponents = segment[4][0].split('^');
    const address = {
      line: [addrComponents[0] || ''],
      city: addrComponents[2] || '',
      state: addrComponents[3] || '',
      postalCode: addrComponents[4] || '',
      country: addrComponents[5] || ''
    };
    addresses.push(address);
  }
  
  // Téléphone
  const telecoms = [];
  if (segment[5]) {
    const phoneNum = segment[5][0].split('^');
    if (phoneNum.length > 0) {
      telecoms.push({
        system: 'phone',
        value: phoneNum[phoneNum.length - 1],
        use: 'home'
      });
    }
  }
  
  // Créer la ressource RelatedPerson
  const relatedPerson = {
    resourceType: 'RelatedPerson',
    id: `related-person-${nk1ID}`,
    meta: {
      profile: ['http://hl7.org/fhir/StructureDefinition/RelatedPerson']
    },
    patient: patientReference,
    relationship: relationship,
    name: [humanName],
    telecom: telecoms,
    address: addresses,
    active: true
  };
  
  return relatedPerson;
}

/**
 * Traiter un segment OBR (Observation Request)
 * @param {Array} segment - Segment OBR
 * @param {Object} context - Contexte de conversion
 * @returns {Object} Ressource FHIR ServiceRequest
 */
function processOBR(segment, context = {}) {
  const { resources, segments } = context;
  const obrID = segment[1] ? segment[1][0] : uuidv4();
  
  // Références
  let patientReference = null;
  let encounterReference = null;
  
  if (resources) {
    const patient = resources.find(r => r.resourceType === 'Patient');
    if (patient) {
      patientReference = { reference: `Patient/${patient.id}` };
    }
    
    const encounter = resources.find(r => r.resourceType === 'Encounter');
    if (encounter) {
      encounterReference = { reference: `Encounter/${encounter.id}` };
    }
  }
  
  // Code de la demande
  const coding = [];
  if (segment[4]) {
    const codeComponents = segment[4][0].split('^');
    if (codeComponents.length > 1) {
      coding.push({
        system: 'http://loinc.org',
        code: codeComponents[0],
        display: codeComponents[1]
      });
    } else {
      coding.push({
        code: codeComponents[0],
        display: codeComponents[0]
      });
    }
  }
  
  // Date de la demande
  let authoredOn = null;
  if (segment[6]) {
    authoredOn = segment[6][0];
  }
  
  // Médecin demandeur
  const requester = {};
  if (segment[16]) {
    const doctor = segment[16][0].split('^');
    requester.reference = `Practitioner/${uuidv4()}`;
    requester.display = doctor.length > 1 ? `${doctor[1]} ${doctor[0]}` : doctor[0];
  }
  
  // Créer la ressource ServiceRequest
  const serviceRequest = {
    resourceType: 'ServiceRequest',
    id: `service-request-${obrID}`,
    meta: {
      profile: ['http://hl7.org/fhir/StructureDefinition/ServiceRequest']
    },
    status: 'active',
    intent: 'order',
    code: {
      coding: coding
    },
    subject: patientReference,
    encounter: encounterReference,
    requester: requester
  };
  
  // Ajouter la date de la demande si disponible
  if (authoredOn) {
    serviceRequest.authoredOn = authoredOn;
  }
  
  return serviceRequest;
}

/**
 * Traiter un segment OBX (Observation/Result)
 * @param {Array} segment - Segment OBX
 * @param {Object} context - Contexte de conversion
 * @returns {Object} Ressource FHIR Observation
 */
function processOBX(segment, context = {}) {
  const { resources, segments } = context;
  const obxID = segment[1] ? segment[1][0] : uuidv4();
  
  // Références
  let patientReference = null;
  let encounterReference = null;
  let serviceRequestReference = null;
  
  if (resources) {
    const patient = resources.find(r => r.resourceType === 'Patient');
    if (patient) {
      patientReference = { reference: `Patient/${patient.id}` };
    }
    
    const encounter = resources.find(r => r.resourceType === 'Encounter');
    if (encounter) {
      encounterReference = { reference: `Encounter/${encounter.id}` };
    }
    
    const serviceRequest = resources.find(r => r.resourceType === 'ServiceRequest');
    if (serviceRequest) {
      serviceRequestReference = { reference: `ServiceRequest/${serviceRequest.id}` };
    }
  }
  
  // Code de l'observation
  const coding = [];
  if (segment[3]) {
    const codeComponents = segment[3][0].split('^');
    if (codeComponents.length > 1) {
      coding.push({
        system: 'http://loinc.org',
        code: codeComponents[0],
        display: codeComponents[1]
      });
    } else {
      coding.push({
        code: codeComponents[0],
        display: codeComponents[0]
      });
    }
  }
  
  // Valeur de l'observation
  let value = null;
  let valueType = segment[2] ? segment[2][0] : '';
  
  if (segment[5]) {
    switch (valueType) {
      case 'NM': // Numérique
        value = {
          valueQuantity: {
            value: parseFloat(segment[5][0]),
            unit: segment[6] ? segment[6][0] : '',
            system: 'http://unitsofmeasure.org',
            code: segment[6] ? segment[6][0] : ''
          }
        };
        break;
      case 'ST': // Chaîne
      case 'TX': // Texte
        value = {
          valueString: segment[5][0]
        };
        break;
      case 'CE': // Concept codé
        const codeComponents = segment[5][0].split('^');
        value = {
          valueCodeableConcept: {
            coding: [{
              code: codeComponents[0],
              display: codeComponents.length > 1 ? codeComponents[1] : codeComponents[0],
              system: 'http://terminology.hl7.org/CodeSystem/v2-0078'
            }]
          }
        };
        break;
      default:
        value = {
          valueString: segment[5][0]
        };
    }
  }
  
  // Statut
  let status = 'final';
  if (segment[11]) {
    switch (segment[11][0]) {
      case 'P': status = 'preliminary'; break;
      case 'F': status = 'final'; break;
      case 'X': status = 'cancelled'; break;
      case 'R': status = 'registered'; break;
      default: status = 'final';
    }
  }
  
  // Date de l'observation
  let effectiveDateTime = null;
  if (segment[14]) {
    effectiveDateTime = segment[14][0];
  }
  
  // Créer la ressource Observation
  const observation = {
    resourceType: 'Observation',
    id: `observation-${obxID}`,
    meta: {
      profile: ['http://hl7.org/fhir/StructureDefinition/Observation']
    },
    status: status,
    code: {
      coding: coding
    },
    subject: patientReference,
    encounter: encounterReference,
    basedOn: serviceRequestReference ? [serviceRequestReference] : undefined
  };
  
  // Ajouter la valeur si disponible
  if (value) {
    Object.assign(observation, value);
  }
  
  // Ajouter la date si disponible
  if (effectiveDateTime) {
    observation.effectiveDateTime = effectiveDateTime;
  }
  
  return observation;
}

/**
 * Traiter un segment SPM (Specimen)
 * @param {Array} segment - Segment SPM
 * @param {Object} context - Contexte de conversion
 * @returns {Object} Ressource FHIR Specimen
 */
function processSPM(segment, context = {}) {
  const { resources } = context;
  const spmID = segment[1] ? segment[1][0] : uuidv4();
  
  // Patient référence
  let patientReference = null;
  if (resources) {
    const patient = resources.find(r => r.resourceType === 'Patient');
    if (patient) {
      patientReference = { reference: `Patient/${patient.id}` };
    }
  }
  
  // Type d'échantillon
  const type = {
    coding: []
  };
  
  if (segment[4]) {
    const typeComponents = segment[4][0].split('^');
    type.coding.push({
      code: typeComponents[0],
      display: typeComponents.length > 1 ? typeComponents[1] : typeComponents[0],
      system: 'http://terminology.hl7.org/CodeSystem/v2-0487'
    });
  }
  
  // Date de collecte
  let collection = {};
  if (segment[17]) {
    collection.collectedDateTime = segment[17][0];
  }
  
  // Créer la ressource Specimen
  const specimen = {
    resourceType: 'Specimen',
    id: `specimen-${spmID}`,
    meta: {
      profile: ['http://hl7.org/fhir/StructureDefinition/Specimen']
    },
    subject: patientReference,
    type: type,
    collection: collection
  };
  
  return specimen;
}

module.exports = {
  processMSH,
  processPID,
  processPV1,
  processNK1,
  processOBR,
  processOBX,
  processSPM
};