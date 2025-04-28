/**
 * Convertisseur HL7 v2.5 vers FHIR R4 (simplifiée mais robuste)
 * Optimisé pour les messages ADT français
 * Compatible ANS
 */
const uuid = require('uuid');

/**
 * Convertit un message HL7 en bundle FHIR
 * @param {string} hl7Message - Message HL7 au format texte
 * @returns {Object} Bundle FHIR au format R4
 */
function convertHL7ToFHIR(hl7Message) {
  try {
    console.log('[CONVERTER] Démarrage de la conversion HL7 vers FHIR');
    
    // Normaliser les fins de ligne et parser le message HL7
    const normalizedMessage = hl7Message.replace(/\n/g, '\r').replace(/\r+/g, '\r');
    const segments = parseHL7Message(normalizedMessage);
    
    console.log(`[CONVERTER] Message HL7 parsé avec succès: ${Object.keys(segments).length} types de segments`);
    
    // Créer un identifiant unique pour le Bundle
    const bundleId = `bundle-${Date.now()}`;
    
    // Créer le Bundle FHIR
    const bundle = {
      resourceType: 'Bundle',
      id: bundleId,
      type: 'transaction',
      timestamp: new Date().toISOString(),
      entry: []
    };
    
    // Patient (à partir du segment PID)
    if (segments.PID && segments.PID.length > 0) {
      const patientResource = createPatientResource(segments.PID[0]);
      bundle.entry.push(patientResource);
      
      // Praticien (à partir du segment ROL)
      if (segments.ROL && segments.ROL.length > 0) {
        segments.ROL.forEach(rolSegment => {
          const practitionerResource = createPractitionerResource(rolSegment);
          if (practitionerResource) {
            bundle.entry.push(practitionerResource);
          }
        });
      }
      
      // Encounter (à partir du segment PV1)
      if (segments.PV1 && segments.PV1.length > 0) {
        const encounterResource = createEncounterResource(segments.PV1[0], patientResource.fullUrl);
        bundle.entry.push(encounterResource);
      }
      
      // Organisation (à partir du segment MSH)
      if (segments.MSH && segments.MSH.length > 0) {
        const organizationResource = createOrganizationResource(segments.MSH[0]);
        if (organizationResource) {
          bundle.entry.push(organizationResource);
        }
      }
      
      // Proches (à partir des segments NK1)
      if (segments.NK1 && segments.NK1.length > 0) {
        segments.NK1.forEach(nk1Segment => {
          const relatedPersonResource = createRelatedPersonResource(nk1Segment, patientResource.fullUrl);
          if (relatedPersonResource) {
            bundle.entry.push(relatedPersonResource);
          }
        });
      }
      
      // Couverture d'assurance (à partir des segments IN1)
      if (segments.IN1 && segments.IN1.length > 0) {
        segments.IN1.forEach(in1Segment => {
          const coverageResource = createCoverageResource(in1Segment, patientResource.fullUrl);
          if (coverageResource) {
            bundle.entry.push(coverageResource);
          }
        });
      }
    }
    
    console.log(`[CONVERTER] Conversion terminée avec ${bundle.entry.length} ressources FHIR générées`);
    return bundle;
  } catch (error) {
    console.error('[CONVERTER] Erreur lors de la conversion:', error);
    throw error;
  }
}

/**
 * Parse un message HL7 et le transforme en segments
 * @param {string} message - Message HL7
 * @returns {Object} Objet avec les segments regroupés par type
 */
function parseHL7Message(message) {
  const segmentLines = message.split('\r').filter(line => line.trim() !== '');
  const segments = {};
  
  for (const line of segmentLines) {
    if (!line) continue;
    
    const segmentParts = line.split('|');
    const segmentType = segmentParts[0];
    
    if (!segmentType) continue;
    
    if (!segments[segmentType]) {
      segments[segmentType] = [];
    }
    
    segments[segmentType].push(segmentParts);
  }
  
  return segments;
}

/**
 * Crée une ressource Patient FHIR à partir du segment PID
 * @param {Array} pidSegment - Segment PID parsé
 * @returns {Object} Entrée de bundle pour un Patient
 */
function createPatientResource(pidSegment) {
  // PID-3 (Patient ID)
  const patientIds = getRepeatedField(pidSegment, 3);
  
  // Extraction d'un ID simple pour l'URI
  const rawId = patientIds.length > 0 ? patientIds[0].split('^')[0] : Date.now().toString();
  const patientId = `patient-${rawId}`;
  
  // Créer la ressource Patient
  const patientResource = {
    resourceType: 'Patient',
    id: patientId,
    identifier: extractIdentifiers(patientIds),
    name: extractNames(getRepeatedField(pidSegment, 5)),
    gender: determineGender(pidSegment[8] || ''),
    birthDate: formatBirthDate(pidSegment[7] || ''),
    telecom: extractTelecoms(getRepeatedField(pidSegment, 13), getRepeatedField(pidSegment, 14)),
    address: extractAddresses(getRepeatedField(pidSegment, 11))
  };
  
  return {
    fullUrl: `urn:uuid:${patientId}`,
    resource: patientResource,
    request: {
      method: 'POST',
      url: 'Patient'
    }
  };
}

/**
 * Extrait les valeurs d'un champ potentiellement répété avec ~
 * @param {Array} segment - Segment HL7 parsé
 * @param {number} fieldIndex - Index du champ (1-based comme dans HL7)
 * @returns {Array} Tableau des valeurs répétées
 */
function getRepeatedField(segment, fieldIndex) {
  if (!segment || fieldIndex >= segment.length) {
    return [];
  }
  
  const fieldValue = segment[fieldIndex] || '';
  
  if (fieldValue.includes('~')) {
    return fieldValue.split('~');
  }
  
  return fieldValue ? [fieldValue] : [];
}

/**
 * Extrait les identifiants du patient
 * @param {Array} idValues - Valeurs des identifiants
 * @returns {Array} Tableau d'identifiants FHIR
 */
function extractIdentifiers(idValues) {
  if (!idValues || idValues.length === 0) {
    return [];
  }
  
  const identifiers = [];
  
  for (const idValue of idValues) {
    const components = idValue.split('^');
    
    // ID (component 1)
    const id = components[0] || '';
    
    if (!id) continue;
    
    // Système d'identification et assigneur
    let system = '';
    let assigner = '';
    let idType = 'PI';
    
    if (components.length > 3) {
      assigner = components[3];
    }
    
    if (components.length > 4) {
      const namespace = components[4] || '';
      
      if (namespace.includes('&')) {
        const namespaceComponents = namespace.split('&');
        if (namespaceComponents.length > 1) {
          system = `urn:oid:${namespaceComponents[1]}`;
        }
      }
    }
    
    if (components.length > 5) {
      idType = components[5] || 'PI';
    }
    
    // Si le composant 3 contient "INS" ou "INS-C", c'est un INS
    if (components.length > 2 && components[2] && components[2].includes('INS')) {
      idType = components[2];
    }
    
    const identifier = {
      value: id,
      system: system || `urn:system:${assigner || 'unknown'}`
    };
    
    // Ajouter le type d'identifiant
    identifier.type = {
      coding: [{
        system: 'http://terminology.hl7.org/CodeSystem/v2-0203',
        code: idType,
        display: getIdentifierTypeDisplay(idType)
      }]
    };
    
    identifiers.push(identifier);
  }
  
  return identifiers;
}

/**
 * Récupère le libellé pour un type d'identifiant
 * @param {string} idType - Code du type d'identifiant
 * @returns {string} Libellé du type d'identifiant
 */
function getIdentifierTypeDisplay(idType) {
  const typeMap = {
    'PI': 'Patient internal identifier',
    'PPN': 'Passport number',
    'MR': 'Medical record number',
    'INS': 'Identifiant National de Santé',
    'INS-C': 'Identifiant National de Santé Calculé',
    'NI': 'National identifier'
  };
  
  return typeMap[idType] || idType;
}

/**
 * Extrait les noms du patient
 * @param {Array} nameValues - Champs de nom
 * @returns {Array} Tableau de noms FHIR
 */
function extractNames(nameValues) {
  if (!nameValues || nameValues.length === 0) {
    return [];
  }
  
  const names = [];
  
  for (const nameValue of nameValues) {
    const components = nameValue.split('^');
    
    // Nom de famille (component 1)
    const familyName = components[0] || '';
    
    // Prénom(s) (components 2+)
    const givenNames = [];
    
    // Prénom principal (component 2)
    if (components.length > 1 && components[1]) {
      if (components[1].includes(' ')) {
        // Gérer les prénoms composés à la française
        givenNames.push(...components[1].split(' '));
      } else {
        givenNames.push(components[1]);
      }
    }
    
    // Autres prénoms (component 3+)
    for (let i = 2; i < 5 && i < components.length; i++) {
      if (components[i]) {
        givenNames.push(components[i]);
      }
    }
    
    // Type d'utilisation du nom (component 7)
    let nameUse = 'official';
    if (components.length > 6 && components[6]) {
      nameUse = mapNameUseToFHIR(components[6]);
    }
    
    if (familyName || givenNames.length > 0) {
      const nameObj = {
        use: nameUse
      };
      
      if (familyName) {
        nameObj.family = familyName;
      }
      
      if (givenNames.length > 0) {
        nameObj.given = givenNames;
      }
      
      // Préfixe (titre) si disponible
      if (components.length > 4 && components[4]) {
        nameObj.prefix = [components[4]];
      }
      
      // Suffixe si disponible
      if (components.length > 5 && components[5]) {
        nameObj.suffix = [components[5]];
      }
      
      names.push(nameObj);
    }
  }
  
  return names;
}

/**
 * Mappe le code d'utilisation du nom HL7 vers FHIR
 * @param {string} hl7NameUse - Code d'utilisation du nom HL7
 * @returns {string} Code d'utilisation du nom FHIR
 */
function mapNameUseToFHIR(hl7NameUse) {
  const nameUseMap = {
    'L': 'official', // Legal
    'D': 'usual',    // Display
    'M': 'maiden',   // Maiden
    'N': 'nickname', // Nickname
    'S': 'anonymous',// Pseudonym
    'A': 'anonymous',// Alias
    'I': 'old'       // Licence
  };
  
  return nameUseMap[hl7NameUse] || 'official';
}

/**
 * Détermine le genre du patient
 * @param {string} genderValue - Valeur du genre
 * @returns {string} Genre FHIR
 */
function determineGender(genderValue) {
  if (!genderValue) {
    return 'unknown';
  }
  
  const gender = genderValue.toString().toUpperCase();
  
  switch (gender) {
    case 'M':
      return 'male';
    case 'F':
      return 'female';
    case 'O':
      return 'other';
    case 'A':
      return 'other'; // Ambiguous
    case 'U':
      return 'unknown';
    default:
      return 'unknown';
  }
}

/**
 * Formate la date de naissance
 * @param {string} birthDateValue - Date de naissance au format HL7 (YYYYMMDD)
 * @returns {string} Date de naissance au format YYYY-MM-DD
 */
function formatBirthDate(birthDateValue) {
  if (!birthDateValue || birthDateValue.length < 8) {
    return null;
  }
  
  // Format attendu: YYYYMMDD ou YYYYMMDDHHMMSS
  if (/^\d{8}/.test(birthDateValue)) {
    const year = birthDateValue.substring(0, 4);
    const month = birthDateValue.substring(4, 6);
    const day = birthDateValue.substring(6, 8);
    
    return `${year}-${month}-${day}`;
  }
  
  return null;
}

/**
 * Extrait les coordonnées de contact
 * @param {Array} homePhones - Téléphones personnels (PID-13)
 * @param {Array} workPhones - Téléphones professionnels (PID-14)
 * @returns {Array} Tableau de coordonnées FHIR
 */
function extractTelecoms(homePhones, workPhones) {
  const telecoms = [];
  
  // Téléphones personnels
  if (homePhones && homePhones.length > 0) {
    homePhones.forEach(phone => {
      const components = phone.split('^');
      
      // Numéro (component 1)
      const phoneNumber = components[0];
      
      if (!phoneNumber) return;
      
      const telecom = {
        value: phoneNumber,
        use: 'home'
      };
      
      // Type d'utilisation (component 2)
      if (components.length > 1 && components[1]) {
        telecom.use = mapContactUseToFHIR(components[1]);
      }
      
      // Type d'équipement (component 3)
      if (components.length > 2 && components[2]) {
        telecom.system = mapEquipmentTypeToFHIR(components[2]);
      } else {
        telecom.system = 'phone';
      }
      
      telecoms.push(telecom);
    });
  }
  
  // Téléphones professionnels
  if (workPhones && workPhones.length > 0) {
    workPhones.forEach(phone => {
      const components = phone.split('^');
      
      // Numéro (component 1)
      const phoneNumber = components[0];
      
      if (!phoneNumber) return;
      
      const telecom = {
        value: phoneNumber,
        use: 'work'
      };
      
      // Type d'équipement (component 3)
      if (components.length > 2 && components[2]) {
        telecom.system = mapEquipmentTypeToFHIR(components[2]);
      } else {
        telecom.system = 'phone';
      }
      
      telecoms.push(telecom);
    });
  }
  
  return telecoms;
}

/**
 * Mappe le type d'équipement HL7 vers le système FHIR
 * @param {string} equipType - Type d'équipement HL7
 * @returns {string} Système FHIR
 */
function mapEquipmentTypeToFHIR(equipType) {
  const equipMap = {
    'PH': 'phone',     // Téléphone
    'CP': 'phone',     // Téléphone portable
    'FX': 'fax',       // Fax
    'BP': 'pager',     // Bipeur
    'Internet': 'email',// Email (conformité française)
    'X.400': 'email',   // Email
    'NET': 'email',     // Email
    'URI': 'url'        // URL
  };
  
  return equipMap[equipType] || 'other';
}

/**
 * Mappe l'utilisation du contact HL7 vers FHIR
 * @param {string} useCode - Code d'utilisation HL7
 * @returns {string} Utilisation FHIR
 */
function mapContactUseToFHIR(useCode) {
  const useMap = {
    'PRN': 'home',    // Primary
    'ORN': 'work',    // Other
    'WPN': 'work',    // Work
    'VHN': 'home',    // Vacation Home
    'ASN': 'temp',    // Answering Service
    'EMR': 'mobile',  // Emergency
    'NET': 'home',    // Network (email)
    'BPN': 'work'     // Beeper
  };
  
  return useMap[useCode] || 'home';
}

/**
 * Extrait les adresses
 * @param {Array} addressValues - Valeurs d'adresse
 * @returns {Array} Tableau d'adresses FHIR
 */
function extractAddresses(addressValues) {
  if (!addressValues || addressValues.length === 0) {
    return [];
  }
  
  const addresses = [];
  
  for (const addressValue of addressValues) {
    const components = addressValue.split('^');
    
    // Informations d'adresse
    const street1 = components[0] || '';
    const street2 = components.length > 1 ? components[1] : '';
    const city = components.length > 2 ? components[2] : '';
    const state = components.length > 3 ? components[3] : '';
    const postalCode = components.length > 4 ? components[4] : '';
    const country = components.length > 5 ? components[5] : '';
    
    // Type d'adresse (component 7)
    const addrType = components.length > 6 ? components[6] : '';
    
    if (street1 || city || postalCode || country) {
      const address = {
        use: mapAddressUseToFHIR(addrType),
        type: mapAddressTypeToFHIR(addrType)
      };
      
      // Lignes d'adresse
      const lines = [];
      if (street1) lines.push(street1);
      if (street2) lines.push(street2);
      
      if (lines.length > 0) {
        address.line = lines;
      }
      
      if (city) address.city = city;
      if (state) address.state = state;
      if (postalCode) address.postalCode = postalCode;
      if (country) address.country = country;
      
      addresses.push(address);
    }
  }
  
  return addresses;
}

/**
 * Mappe l'utilisation de l'adresse HL7 vers FHIR
 * @param {string} hl7AddressUse - Code d'utilisation de l'adresse HL7
 * @returns {string} Utilisation de l'adresse FHIR
 */
function mapAddressUseToFHIR(hl7AddressUse) {
  const addressUseMap = {
    'H': 'home',     // Home
    'B': 'work',     // Business
    'C': 'temp',     // Current/Temporary
    'BA': 'old',     // Bad Address
    'O': 'home',     // Office
    'V': 'home'      // Vacation
  };
  
  return addressUseMap[hl7AddressUse] || 'home';
}

/**
 * Mappe le type d'adresse HL7 vers FHIR
 * @param {string} hl7AddressType - Code de type d'adresse HL7
 * @returns {string} Type d'adresse FHIR
 */
function mapAddressTypeToFHIR(hl7AddressType) {
  const addressTypeMap = {
    'M': 'postal',     // Mailing
    'P': 'physical',   // Physical
    'B': 'both',       // Both
    'H': 'physical',   // Home (France)
    'O': 'physical',   // Office
    'C': 'postal'      // Correspondence
  };
  
  return addressTypeMap[hl7AddressType] || 'both';
}

/**
 * Crée une ressource Encounter FHIR à partir du segment PV1
 * @param {Array} pv1Segment - Segment PV1 parsé
 * @param {string} patientReference - Référence à la ressource Patient
 * @returns {Object} Entrée de bundle pour un Encounter
 */
function createEncounterResource(pv1Segment, patientReference) {
  const encounterId = `encounter-${Date.now()}`;
  
  // Déterminer la classe d'encounter (PV1-2)
  const patientClass = pv1Segment[2] || '';
  const encounterClass = mapPatientClassToFHIR(patientClass);
  
  // Statut de l'encounter (PV1-36 = disposition)
  const dischargeDisposition = pv1Segment[36] || '';
  const encounterStatus = determineEncounterStatus(dischargeDisposition);
  
  // Période de l'encounter
  const admitDate = formatHL7DateTime(pv1Segment[44] || '');
  
  // Créer la ressource Encounter
  const encounterResource = {
    resourceType: 'Encounter',
    id: encounterId,
    status: encounterStatus,
    class: {
      system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
      code: encounterClass.code,
      display: encounterClass.display
    },
    subject: {
      reference: patientReference
    }
  };
  
  // Ajouter la période si disponible
  if (admitDate) {
    encounterResource.period = {
      start: admitDate
    };
  }
  
  // Numéro de visite/séjour (PV1-19 = visit number)
  const visitNumber = pv1Segment[19];
  if (visitNumber) {
    encounterResource.identifier = [{
      system: 'urn:oid:1.2.250.1.213.1.4.2',
      value: visitNumber
    }];
  }
  
  return {
    fullUrl: `urn:uuid:${encounterId}`,
    resource: encounterResource,
    request: {
      method: 'POST',
      url: 'Encounter'
    }
  };
}

/**
 * Mappe la classe de patient HL7 vers FHIR
 * @param {string} patientClass - Classe de patient HL7
 * @returns {Object} Classe d'encounter FHIR avec code et libellé
 */
function mapPatientClassToFHIR(patientClass) {
  const classMap = {
    'I': { code: 'IMP', display: 'inpatient encounter' },
    'O': { code: 'AMB', display: 'ambulatory' },
    'E': { code: 'EMER', display: 'emergency' },
    'P': { code: 'AMB', display: 'ambulatory' },
    'R': { code: 'ACUTE', display: 'acute inpatient encounter' },
    'B': { code: 'AMB', display: 'ambulatory' },
    'N': { code: 'NONAC', display: 'Non-acute inpatient encounter' }
  };
  
  return classMap[patientClass] || { code: 'IMP', display: 'inpatient encounter' };
}

/**
 * Détermine le statut de l'encounter à partir de la disposition de sortie
 * @param {string} dischargeDisposition - Disposition de sortie
 * @returns {string} Statut FHIR
 */
function determineEncounterStatus(dischargeDisposition) {
  if (!dischargeDisposition) {
    return 'in-progress';
  }
  
  if (['01', '02', '03', '04', '05', '06', '07', '08', '09'].includes(dischargeDisposition)) {
    return 'finished';
  }
  
  return 'in-progress';
}

/**
 * Formate une date/heure HL7 au format ISO
 * @param {string} dateValue - Date au format HL7
 * @returns {string|null} Date au format ISO ou null si non disponible
 */
function formatHL7DateTime(dateValue) {
  if (!dateValue) {
    return null;
  }
  
  if (/^\d{8}/.test(dateValue)) {
    // Format YYYYMMDD
    if (dateValue.length === 8) {
      const year = dateValue.substring(0, 4);
      const month = dateValue.substring(4, 6);
      const day = dateValue.substring(6, 8);
      return `${year}-${month}-${day}`;
    }
    
    // Format YYYYMMDDHHMMSS
    if (dateValue.length >= 14) {
      const year = dateValue.substring(0, 4);
      const month = dateValue.substring(4, 6);
      const day = dateValue.substring(6, 8);
      const hour = dateValue.substring(8, 10);
      const minute = dateValue.substring(10, 12);
      const second = dateValue.substring(12, 14);
      return `${year}-${month}-${day}T${hour}:${minute}:${second}`;
    }
  }
  
  return null;
}

/**
 * Crée une ressource Organization FHIR à partir du segment MSH
 * @param {Array} mshSegment - Segment MSH parsé
 * @returns {Object|null} Entrée de bundle pour une Organization ou null si non disponible
 */
function createOrganizationResource(mshSegment) {
  // MSH-4 (Sending Facility)
  const sendingFacility = mshSegment[4] || '';
  
  if (!sendingFacility) {
    return null;
  }
  
  const components = sendingFacility.split('^');
  const orgName = components[0] || '';
  
  if (!orgName) {
    return null;
  }
  
  // Identifiant comme OID s'il existe
  let orgId = orgName.replace(/[^a-zA-Z0-9]/g, '');
  if (components.length > 1 && components[1]) {
    orgId = components[1];
  }
  
  const organizationId = `organization-${orgId}`;
  
  // Créer la ressource Organization
  const organizationResource = {
    resourceType: 'Organization',
    id: organizationId,
    identifier: [{
      system: 'urn:oid:1.2.250.1.71.4.2.2',
      value: orgId
    }],
    name: orgName,
    active: true
  };
  
  return {
    fullUrl: `urn:uuid:${organizationId}`,
    resource: organizationResource,
    request: {
      method: 'POST',
      url: 'Organization'
    }
  };
}

/**
 * Crée une ressource Practitioner FHIR à partir du segment ROL
 * @param {Array} rolSegment - Segment ROL parsé
 * @returns {Object|null} Entrée de bundle pour un Practitioner ou null si non disponible
 */
function createPractitionerResource(rolSegment) {
  // ROL-4 (Role Person)
  const rolePerson = rolSegment[4] || '';
  
  if (!rolePerson) {
    return null;
  }
  
  const components = rolePerson.split('^');
  
  // Identifiant (component 1)
  const idValue = components[0] || '';
  
  // Nom (components 2-3)
  const familyName = components.length > 1 ? components[1] : '';
  const givenName = components.length > 2 ? components[2] : '';
  
  if (!idValue && !familyName && !givenName) {
    return null;
  }
  
  const practitionerId = `practitioner-${idValue || uuid.v4()}`;
  
  // Créer la ressource Practitioner
  const practitionerResource = {
    resourceType: 'Practitioner',
    id: practitionerId,
    identifier: []
  };
  
  // Ajouter l'identifiant
  if (idValue) {
    practitionerResource.identifier.push({
      system: 'urn:oid:1.2.250.1.71.4.2.1',
      value: idValue
    });
  }
  
  // Ajouter le nom
  if (familyName || givenName) {
    const humanName = {};
    
    if (familyName) {
      humanName.family = familyName;
    }
    
    if (givenName) {
      humanName.given = [givenName];
    }
    
    practitionerResource.name = [humanName];
  }
  
  return {
    fullUrl: `urn:uuid:${practitionerId}`,
    resource: practitionerResource,
    request: {
      method: 'POST',
      url: 'Practitioner'
    }
  };
}

/**
 * Crée une ressource RelatedPerson FHIR à partir du segment NK1
 * @param {Array} nk1Segment - Segment NK1 parsé
 * @param {string} patientReference - Référence à la ressource Patient
 * @returns {Object|null} Entrée de bundle pour un RelatedPerson ou null si non disponible
 */
function createRelatedPersonResource(nk1Segment, patientReference) {
  // NK1-2 (Nom)
  const nameField = nk1Segment[2] || '';
  
  if (!nameField) {
    return null;
  }
  
  const components = nameField.split('^');
  const familyName = components[0] || '';
  const givenName = components.length > 1 ? components[1] : '';
  
  if (!familyName && !givenName) {
    return null;
  }
  
  const relatedPersonId = `relatedperson-${uuid.v4()}`;
  
  // Créer la ressource RelatedPerson
  const relatedPersonResource = {
    resourceType: 'RelatedPerson',
    id: relatedPersonId,
    patient: {
      reference: patientReference
    },
    active: true
  };
  
  // Ajouter le nom
  if (familyName || givenName) {
    const humanName = {
      use: 'official'
    };
    
    if (familyName) {
      humanName.family = familyName;
    }
    
    if (givenName) {
      humanName.given = [givenName];
    }
    
    relatedPersonResource.name = [humanName];
  }
  
  // NK1-3 (Relation)
  const relationshipField = nk1Segment[3] || '';
  
  if (relationshipField) {
    const relationComponents = relationshipField.split('^');
    let relationshipCode = '';
    
    // Trouver le code de relation
    for (let i = 0; i < relationComponents.length; i++) {
      if (['SPO', 'DOM', 'CHD', 'PAR', 'SIB', 'GRD'].includes(relationComponents[i])) {
        relationshipCode = relationComponents[i];
        break;
      }
    }
    
    if (relationshipCode) {
      relatedPersonResource.relationship = [{
        coding: [{
          system: 'http://terminology.hl7.org/CodeSystem/v3-RoleCode',
          code: relationshipCode,
          display: getRelationshipDisplay(relationshipCode)
        }]
      }];
    }
  }
  
  return {
    fullUrl: `urn:uuid:${relatedPersonId}`,
    resource: relatedPersonResource,
    request: {
      method: 'POST',
      url: 'RelatedPerson'
    }
  };
}

/**
 * Récupère le libellé pour un code de relation
 * @param {string} relationshipCode - Code de relation
 * @returns {string} Libellé de la relation
 */
function getRelationshipDisplay(relationshipCode) {
  const relationshipMap = {
    'SPO': 'Spouse',
    'DOM': 'Life partner',
    'CHD': 'Child',
    'GRD': 'Guardian',
    'PAR': 'Parent',
    'SIB': 'Sibling',
    'SIGOTHR': 'Significant other',
    'EMC': 'Emergency contact',
    'EME': 'Employee',
    'EMR': 'Employer',
    'EXF': 'Extended family',
    'FCH': 'Foster child',
    'FTH': 'Father',
    'MTH': 'Mother',
    'NFTH': 'Natural father',
    'NMTH': 'Natural mother',
    'NPRN': 'Natural parent',
    'STPPRN': 'Step parent'
  };
  
  return relationshipMap[relationshipCode] || relationshipCode;
}

/**
 * Crée une ressource Coverage FHIR à partir du segment IN1
 * @param {Array} in1Segment - Segment IN1 parsé
 * @param {string} patientReference - Référence à la ressource Patient
 * @returns {Object|null} Entrée de bundle pour un Coverage ou null si non disponible
 */
function createCoverageResource(in1Segment, patientReference) {
  // IN1-2 (Plan ID)
  const planId = in1Segment[2] || '';
  
  // IN1-12 (Policy Expiration Date)
  const expirationDate = in1Segment[12] || '';
  
  // IN1-16 (Name of Insured)
  const insuredName = in1Segment[16] || '';
  
  if (!planId && !insuredName) {
    return null;
  }
  
  const coverageId = `coverage-${uuid.v4()}`;
  
  // Créer la ressource Coverage
  const coverageResource = {
    resourceType: 'Coverage',
    id: coverageId,
    status: 'active',
    beneficiary: {
      reference: patientReference
    }
  };
  
  // Ajouter le type de couverture
  if (planId) {
    coverageResource.type = {
      coding: [{
        system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
        code: planId,
        display: 'Insurance policy'
      }]
    };
  }
  
  // Ajouter la période de validité
  if (expirationDate) {
    const expirationDateFormatted = formatHL7DateTime(expirationDate);
    if (expirationDateFormatted) {
      coverageResource.period = {
        end: expirationDateFormatted
      };
    }
  }
  
  // Ajouter le nom de l'assuré
  if (insuredName) {
    const components = insuredName.split('^');
    
    if (components[0]) {
      coverageResource.subscriberId = components[0];
    }
  }
  
  return {
    fullUrl: `urn:uuid:${coverageId}`,
    resource: coverageResource,
    request: {
      method: 'POST',
      url: 'Coverage'
    }
  };
}

module.exports = {
  convertHL7ToFHIR
};