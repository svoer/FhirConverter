/**
 * Convertisseur amélioré HL7 v2.5 vers FHIR R4
 * Spécialement optimisé pour les messages ADT français
 * Compatible avec les exigences de l'ANS
 */
const uuid = require('uuid');
const hl7 = require('simple-hl7');

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
    const parser = new hl7.Parser({ segmentSeperator: '\r' });
    const parsedMessage = parser.parse(normalizedMessage);
    
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
    
    // Extraire les segments
    const segments = {};
    parsedMessage.segments.forEach(segment => {
      const segmentType = segment.name;
      if (!segments[segmentType]) {
        segments[segmentType] = [];
      }
      segments[segmentType].push(segment);
    });
    
    // Traiter les segments spécifiques
    const mshSegment = segments.MSH ? segments.MSH[0] : null;
    const pidSegment = segments.PID ? segments.PID[0] : null;
    const pv1Segment = segments.PV1 ? segments.PV1[0] : null;
    const rolSegments = segments.ROL || [];
    const nk1Segments = segments.NK1 || [];
    const in1Segments = segments.IN1 || [];
    
    // Traiter le Patient
    if (pidSegment) {
      const patientResource = createPatientResource(pidSegment);
      bundle.entry.push(patientResource);
      
      // Traiter l'Encounter après le Patient pour avoir la référence
      if (pv1Segment) {
        const encounterResource = createEncounterResource(pv1Segment, patientResource.fullUrl);
        bundle.entry.push(encounterResource);
        
        // Référence de l'encounter pour les autres ressources
        const encounterReference = encounterResource.fullUrl;
        
        // Traiter les Organizations (établissements)
        if (mshSegment) {
          const sendingOrgResource = createOrganizationResource(mshSegment, 'sendingFacility');
          if (sendingOrgResource) {
            bundle.entry.push(sendingOrgResource);
          }
          
          const receivingOrgResource = createOrganizationResource(mshSegment, 'receivingFacility');
          if (receivingOrgResource && sendingOrgResource && 
              receivingOrgResource.resource.id !== sendingOrgResource.resource.id) {
            bundle.entry.push(receivingOrgResource);
          }
        }
        
        // Traiter les Practitioners (médecins)
        if (rolSegments.length > 0) {
          for (const rolSegment of rolSegments) {
            const practitionerResource = createPractitionerResource(rolSegment);
            if (practitionerResource) {
              bundle.entry.push(practitionerResource);
              
              // Ajouter le lien PractitionerRole
              const practitionerRoleResource = createPractitionerRoleResource(
                rolSegment, 
                practitionerResource.fullUrl, 
                encounterReference
              );
              
              if (practitionerRoleResource) {
                bundle.entry.push(practitionerRoleResource);
              }
            }
          }
        }
      }
      
      // Traiter les RelatedPersons (proches)
      if (nk1Segments.length > 0) {
        for (const nk1Segment of nk1Segments) {
          const relatedPersonResource = createRelatedPersonResource(nk1Segment, patientResource.fullUrl);
          if (relatedPersonResource) {
            bundle.entry.push(relatedPersonResource);
          }
        }
      }
      
      // Traiter les Coverages (assurances)
      if (in1Segments.length > 0) {
        for (const in1Segment of in1Segments) {
          const coverageResource = createCoverageResource(in1Segment, patientResource.fullUrl);
          if (coverageResource) {
            bundle.entry.push(coverageResource);
          }
        }
      }
    }
    
    console.log(`[CONVERTER] Conversion terminée avec ${bundle.entry.length} ressources`);
    return bundle;
  } catch (error) {
    console.error('[CONVERTER] Erreur lors de la conversion:', error);
    throw error;
  }
}

/**
 * Crée une ressource Patient FHIR à partir du segment PID
 * @param {Object} pidSegment - Segment PID parsé
 * @returns {Object} Entrée de bundle pour un Patient
 */
function createPatientResource(pidSegment) {
  // PID-3 (Patient ID)
  const patientIds = extractField(pidSegment, 3, true);
  
  // Extraction d'un ID pour l'URI
  const firstId = patientIds.length > 0 ? patientIds[0].split('^')[0] : Date.now().toString();
  const patientId = `patient-${firstId}`;
  
  // Créer la ressource Patient
  const patientResource = {
    resourceType: 'Patient',
    id: patientId,
    identifier: extractIdentifiers(patientIds),
    name: extractNames(pidSegment),
    gender: determineGender(extractField(pidSegment, 8)[0]),
    birthDate: formatBirthDate(extractField(pidSegment, 7)[0]),
    telecom: extractTelecoms(pidSegment),
    address: extractAddresses(pidSegment)
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
 * Extrait un champ d'un segment HL7
 * @param {Object} segment - Segment HL7 parsé
 * @param {number} fieldIndex - Index du champ à extraire (1-based)
 * @param {boolean} allowRepetition - Autoriser les répétitions
 * @returns {string[]} Valeurs du champ
 */
function extractField(segment, fieldIndex, allowRepetition = false) {
  try {
    if (!segment || !segment.fields || fieldIndex >= segment.fields.length) {
      return [];
    }

    // simple-hl7 uses 0-based indexing for fields but HL7 specs use 1-based
    // We'll adjust for that by subtracting 1
    const adjustedIndex = fieldIndex;
    
    const field = segment.fields[adjustedIndex];
    if (!field) return [];
    
    if (allowRepetition && field.indexOf('~') !== -1) {
      return field.split('~');
    }
    
    return [field];
  } catch (error) {
    console.error(`[EXTRACT FIELD] Erreur lors de l'extraction du champ ${fieldIndex}:`, error);
    return [];
  }
}

/**
 * Extrait les identifiants du patient des champs PID-3
 * @param {string[]} idValues - Valeurs des identifiants
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
    
    // Système d'identification (components 4-5)
    let system = '';
    let assigner = '';
    
    if (components.length > 3) {
      assigner = components[3] || '';
    }
    
    if (components.length > 4) {
      const namespaceComponents = components[4].split('&');
      if (namespaceComponents.length > 1) {
        system = `urn:oid:${namespaceComponents[1]}`;
      }
    }
    
    // Type d'identifiant (component 5)
    let idType = 'PI';
    if (components.length > 4) {
      const lastComponent = components[components.length - 1];
      if (['PI', 'MR', 'INS', 'INS-C', 'NI', 'PPN'].includes(lastComponent)) {
        idType = lastComponent;
      }
    }
    
    if (id) {
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
    'INS': 'INS',
    'INS-C': 'INS-C',
    'NI': 'National identifier'
  };
  
  return typeMap[idType] || idType;
}

/**
 * Extrait les noms du patient du segment PID
 * @param {Object} pidSegment - Segment PID parsé
 * @returns {Array} Tableau de noms FHIR
 */
function extractNames(pidSegment) {
  const names = [];
  const nameFields = extractField(pidSegment, 5, true);
  
  for (const nameField of nameFields) {
    const components = nameField.split('^');
    
    // Nom de famille (component 1)
    const familyName = components[0] || '';
    
    // Prénom(s) (components 2-5)
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
    
    // Autres prénoms
    for (let i = 2; i < 5; i++) {
      if (components.length > i && components[i]) {
        givenNames.push(components[i]);
      }
    }
    
    // Type d'utilisation du nom
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
 * Détermine le genre du patient à partir de PID-8
 * @param {string} genderValue - Valeur du genre
 * @returns {string} Genre FHIR
 */
function determineGender(genderValue) {
  if (!genderValue) {
    return 'unknown';
  }
  
  switch (genderValue.toUpperCase()) {
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
 * Formate la date de naissance à partir de PID-7
 * @param {string} birthDateValue - Date de naissance au format HL7
 * @returns {string} Date de naissance au format YYYY-MM-DD
 */
function formatBirthDate(birthDateValue) {
  if (!birthDateValue) {
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
 * Extrait les coordonnées de contact du segment PID
 * @param {Object} pidSegment - Segment PID parsé
 * @returns {Array} Tableau de coordonnées FHIR
 */
function extractTelecoms(pidSegment) {
  const telecoms = [];
  
  // PID-13 (Phone - Home)
  const phoneFields = extractField(pidSegment, 13, true);
  
  for (const phoneField of phoneFields) {
    const components = phoneField.split('^');
    
    // Numéro (component 1)
    const phoneNumber = components[0] || '';
    
    // Type d'utilisation (component 2)
    const useCode = components.length > 1 ? components[1] : '';
    
    // Type d'équipement (component 3)
    const equipCode = components.length > 2 ? components[2] : '';
    
    if (phoneNumber) {
      const telecom = {
        value: phoneNumber
      };
      
      // Système de contact
      if (equipCode) {
        telecom.system = mapEquipmentTypeToFHIR(equipCode);
      } else {
        telecom.system = 'phone';
      }
      
      // Utilisation du contact
      if (useCode) {
        telecom.use = mapContactUseToFHIR(useCode);
      }
      
      telecoms.push(telecom);
    }
  }
  
  // PID-14 (Phone - Business)
  const businessPhoneFields = extractField(pidSegment, 14, true);
  
  for (const phoneField of businessPhoneFields) {
    const components = phoneField.split('^');
    
    // Numéro (component 1)
    const phoneNumber = components[0] || '';
    
    // Type d'équipement (component 3)
    const equipCode = components.length > 2 ? components[2] : '';
    
    if (phoneNumber) {
      const telecom = {
        value: phoneNumber,
        use: 'work'
      };
      
      // Système de contact
      if (equipCode) {
        telecom.system = mapEquipmentTypeToFHIR(equipCode);
      } else {
        telecom.system = 'phone';
      }
      
      telecoms.push(telecom);
    }
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
 * Extrait les adresses du segment PID
 * @param {Object} pidSegment - Segment PID parsé
 * @returns {Array} Tableau d'adresses FHIR
 */
function extractAddresses(pidSegment) {
  const addresses = [];
  
  // PID-11 (Patient Address)
  const addressFields = extractField(pidSegment, 11, true);
  
  for (const addressField of addressFields) {
    const components = addressField.split('^');
    
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
 * @param {Object} pv1Segment - Segment PV1 parsé
 * @param {string} patientReference - Référence à la ressource Patient
 * @returns {Object} Entrée de bundle pour un Encounter
 */
function createEncounterResource(pv1Segment, patientReference) {
  const encounterId = `encounter-${Date.now()}`;
  
  // Déterminer la classe d'encounter (PV1-2)
  const patientClass = extractField(pv1Segment, 2)[0] || '';
  const encounterClass = mapPatientClassToFHIR(patientClass);
  
  // Statut de l'encounter (PV1-36 = disposition)
  const dischargeDisposition = extractField(pv1Segment, 36)[0] || '';
  const encounterStatus = determineEncounterStatus(dischargeDisposition);
  
  // Période de l'encounter
  const admitDate = formatHL7DateTime(extractField(pv1Segment, 44)[0]);
  const dischargeDate = formatHL7DateTime(extractField(pv1Segment, 45)[0]);
  
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
  if (admitDate || dischargeDate) {
    encounterResource.period = {};
    
    if (admitDate) {
      encounterResource.period.start = admitDate;
    }
    
    if (dischargeDate) {
      encounterResource.period.end = dischargeDate;
    }
  }
  
  // Numéro de visite/séjour (PV1-19 = visit number)
  const visitNumber = extractField(pv1Segment, 19)[0];
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
 * Crée une ressource Organization FHIR à partir d'un champ MSH
 * @param {Object} mshSegment - Segment MSH parsé
 * @param {string} fieldName - Nom du champ (sendingFacility ou receivingFacility)
 * @returns {Object|null} Entrée de bundle pour une Organization ou null si non disponible
 */
function createOrganizationResource(mshSegment, fieldName) {
  let fieldValue;
  
  if (fieldName === 'sendingFacility') {
    fieldValue = mshSegment.sendingFacility;
  } else if (fieldName === 'receivingFacility') {
    fieldValue = mshSegment.receivingFacility;
  } else {
    return null;
  }
  
  if (!fieldValue) {
    return null;
  }
  
  const components = fieldValue.split('^');
  const orgName = components[0] || '';
  
  if (!orgName) {
    return null;
  }
  
  // Identifiant comme OID s'il existe un namespace
  let orgId = orgName;
  if (components.length > 1 && components[1]) {
    orgId = components[1];
  }
  
  const organizationId = `organization-${orgId.replace(/[^a-zA-Z0-9]/g, '')}`;
  
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
 * @param {Object} rolSegment - Segment ROL parsé
 * @returns {Object|null} Entrée de bundle pour un Practitioner ou null si non disponible
 */
function createPractitionerResource(rolSegment) {
  // ROL-4 (Role Person)
  const rolePersonField = extractField(rolSegment, 4)[0];
  
  if (!rolePersonField) {
    return null;
  }
  
  const components = rolePersonField.split('^');
  
  // Identifier du praticien (component 1)
  const idValue = components[0] || '';
  
  // Nom du praticien (components 2-3)
  const familyName = components.length > 1 ? components[1] : '';
  const givenName = components.length > 2 ? components[2] : '';
  
  if (!idValue || (!familyName && !givenName)) {
    return null;
  }
  
  const practitionerId = `practitioner-${idValue.replace(/[^a-zA-Z0-9]/g, '')}`;
  
  // Créer la ressource Practitioner
  const practitionerResource = {
    resourceType: 'Practitioner',
    id: practitionerId,
    identifier: []
  };
  
  // Ajouter l'identifiant
  if (idValue) {
    // Système d'identification (component 9)
    let system = 'urn:oid:1.2.250.1.71.4.2.1';
    if (components.length > 8) {
      const namespaceComponents = components[8].split('&');
      if (namespaceComponents.length > 1) {
        system = `urn:oid:${namespaceComponents[1]}`;
      }
    }
    
    practitionerResource.identifier.push({
      system: system,
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
 * Crée une ressource PractitionerRole FHIR à partir du segment ROL
 * @param {Object} rolSegment - Segment ROL parsé
 * @param {string} practitionerReference - Référence à la ressource Practitioner
 * @param {string} encounterReference - Référence à la ressource Encounter
 * @returns {Object|null} Entrée de bundle pour un PractitionerRole ou null si non disponible
 */
function createPractitionerRoleResource(rolSegment, practitionerReference, encounterReference) {
  // ROL-3 (Role Code)
  const roleType = extractField(rolSegment, 3)[0];
  
  if (!roleType) {
    return null;
  }
  
  const practitionerRoleId = `practitionerrole-${uuid.v4()}`;
  
  // Créer la ressource PractitionerRole
  const practitionerRoleResource = {
    resourceType: 'PractitionerRole',
    id: practitionerRoleId,
    practitioner: {
      reference: practitionerReference
    },
    code: [{
      coding: [{
        system: 'http://terminology.hl7.org/CodeSystem/v3-ParticipationType',
        code: roleType,
        display: getRoleTypeDisplay(roleType)
      }]
    }],
    active: true
  };
  
  return {
    fullUrl: `urn:uuid:${practitionerRoleId}`,
    resource: practitionerRoleResource,
    request: {
      method: 'POST',
      url: 'PractitionerRole'
    }
  };
}

/**
 * Récupère le libellé pour un type de rôle
 * @param {string} roleType - Code du type de rôle
 * @returns {string} Libellé du type de rôle
 */
function getRoleTypeDisplay(roleType) {
  const roleTypeMap = {
    'CP': 'Consulting Provider',
    'PP': 'Primary Care Provider',
    'RP': 'Referring Provider',
    'AP': 'Admitting Provider',
    'ATND': 'Attending Provider',
    'CALLBCK': 'Callback Provider',
    'CON': 'Consultant',
    'ADMDX': 'Admitting Diagnostician',
    'ATTPHYS': 'Attending Physician',
    'DISPHYS': 'Discharging Physician',
    'FASST': 'First Assistant',
    'ODRP': 'Ordering Provider',
    'PRSCR': 'Prescriber',
    'REFDR': 'Referring Doctor',
    'SPCLST': 'Specialist'
  };
  
  return roleTypeMap[roleType] || roleType;
}

/**
 * Crée une ressource RelatedPerson FHIR à partir du segment NK1
 * @param {Object} nk1Segment - Segment NK1 parsé
 * @param {string} patientReference - Référence à la ressource Patient
 * @returns {Object|null} Entrée de bundle pour un RelatedPerson ou null si non disponible
 */
function createRelatedPersonResource(nk1Segment, patientReference) {
  // NK1-2 (Nom)
  const nameField = extractField(nk1Segment, 2)[0];
  
  // NK1-3 (Relation)
  const relationshipField = extractField(nk1Segment, 3)[0];
  
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
  
  // Ajouter la relation
  if (relationshipField) {
    const relationComponents = relationshipField.split('^');
    let relationshipCode = '';
    
    // Trouver le code de relation (généralement component 2, 3 ou 4)
    for (let i = 1; i < relationComponents.length; i++) {
      if (relationComponents[i] && ['SPO', 'DOM', 'CHD', 'PAR', 'SIB', 'GRD'].includes(relationComponents[i])) {
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
 * @param {Object} in1Segment - Segment IN1 parsé
 * @param {string} patientReference - Référence à la ressource Patient
 * @returns {Object|null} Entrée de bundle pour un Coverage ou null si non disponible
 */
function createCoverageResource(in1Segment, patientReference) {
  // IN1-2 (Plan ID)
  const planIdField = extractField(in1Segment, 2)[0];
  
  // IN1-3 (Insurance Company ID)
  const insuranceCompanyField = extractField(in1Segment, 3)[0];
  
  // IN1-12 (Policy Expiration Date)
  const expirationDateField = extractField(in1Segment, 12)[0];
  
  // IN1-16 (Name of Insured)
  const insuredNameField = extractField(in1Segment, 16)[0];
  
  if (!planIdField && !insuranceCompanyField && !insuredNameField) {
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
  if (planIdField) {
    coverageResource.type = {
      coding: [{
        system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
        code: planIdField,
        display: 'Insurance policy'
      }]
    };
  }
  
  // Ajouter la période de validité
  if (expirationDateField) {
    const expirationDate = formatHL7DateTime(expirationDateField);
    if (expirationDate) {
      coverageResource.period = {
        end: expirationDate
      };
    }
  }
  
  // Ajouter le nom de l'assuré
  if (insuredNameField) {
    const components = insuredNameField.split('^');
    
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