/**
 * Convertisseur avancé HL7 v2.5 vers FHIR R4
 * Spécialement optimisé pour les messages ADT français
 * Compatible avec les exigences de l'ANS
 */
const uuid = require('uuid');
const hl7 = require('hl7-standard');

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
    const parsedMessage = hl7.parseMessage(normalizedMessage);
    
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
    const mshSegment = parsedMessage.getMSH();
    const pidSegment = hl7.getSegmentOfType(parsedMessage, 'PID');
    const pv1Segment = hl7.getSegmentOfType(parsedMessage, 'PV1');
    const rolSegments = hl7.getSegmentsOfType(parsedMessage, 'ROL');
    const nk1Segments = hl7.getSegmentsOfType(parsedMessage, 'NK1');
    const in1Segments = hl7.getSegmentsOfType(parsedMessage, 'IN1');
    
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
          const sendingOrgResource = createOrganizationResource(mshSegment, 4); // MSH-4 (sending)
          if (sendingOrgResource) {
            bundle.entry.push(sendingOrgResource);
          }
          
          const receivingOrgResource = createOrganizationResource(mshSegment, 6); // MSH-6 (receiving)
          if (receivingOrgResource && sendingOrgResource && 
              receivingOrgResource.resource.id !== sendingOrgResource.resource.id) {
            bundle.entry.push(receivingOrgResource);
          }
        }
        
        // Traiter les Practitioners (médecins)
        if (rolSegments && rolSegments.length > 0) {
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
      if (nk1Segments && nk1Segments.length > 0) {
        for (const nk1Segment of nk1Segments) {
          const relatedPersonResource = createRelatedPersonResource(nk1Segment, patientResource.fullUrl);
          if (relatedPersonResource) {
            bundle.entry.push(relatedPersonResource);
          }
        }
      }
      
      // Traiter les Coverages (assurances)
      if (in1Segments && in1Segments.length > 0) {
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
  const idField = pidSegment.getField(3); // PID-3 (Patient ID)
  const rawId = idField.value || `unknown-${Date.now()}`;
  
  // Extraction du premier ID numérique pour l'URI (sans les répétitions ou composants)
  const simpleId = rawId.replace(/\^.*$/, '');
  const patientId = `patient-${simpleId}`;
  
  // Créer la ressource Patient
  const patientResource = {
    resourceType: 'Patient',
    id: patientId,
    identifier: extractIdentifiers(idField),
    name: extractNames(pidSegment),
    gender: determineGender(pidSegment.getField(8)),
    birthDate: formatBirthDate(pidSegment.getField(7)),
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
 * Extrait les identifiants du patient du champ PID-3
 * @param {Object} idField - Champ d'identifiant
 * @returns {Array} Tableau d'identifiants FHIR
 */
function extractIdentifiers(idField) {
  if (!idField || !idField.value) {
    return [];
  }
  
  const identifiers = [];
  
  // Traiter chaque répétition comme un identifiant séparé
  const repetitions = idField.getRepetitions();
  
  for (const repetition of repetitions) {
    const components = repetition.getComponents();
    
    // ID (component 1)
    const idValue = components[0] ? components[0].value : '';
    
    // Système d'identification (components 4-5)
    let system = '';
    let assigner = '';
    
    if (components[4]) {
      assigner = components[4].value || '';
    }
    
    if (components[3] && components[4]) {
      // Format: namespace&OID&type
      const namespaceComp = components[3].getComponents();
      if (namespaceComp.length > 1 && namespaceComp[1].value) {
        system = `urn:oid:${namespaceComp[1].value}`;
      }
    }
    
    // Type d'identifiant (component 5)
    const idType = components[4] ? components[4].value : 'PI';
    
    if (idValue) {
      const identifier = {
        value: idValue,
        system: system || `urn:system:${assigner || 'unknown'}`
      };
      
      // Ajouter le type d'identifiant si disponible
      if (idType) {
        identifier.type = {
          coding: [{
            system: 'http://terminology.hl7.org/CodeSystem/v2-0203',
            code: idType,
            display: getIdentifierTypeDisplay(idType)
          }]
        };
      }
      
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
  
  // PID-5 (Patient Name)
  const nameFields = pidSegment.getField(5).getRepetitions();
  
  for (const nameField of nameFields) {
    const components = nameField.getComponents();
    
    // Nom de famille (component 1)
    const familyName = components[0] ? components[0].value : '';
    
    // Prénom(s) (components 2-7)
    const givenNames = [];
    
    // Prénom habituel (component 2)
    if (components[1] && components[1].value) {
      // Gérer les prénoms composés à la française (espaces)
      if (components[1].value.includes(' ')) {
        givenNames.push(...components[1].value.split(' '));
      } else {
        givenNames.push(components[1].value);
      }
    }
    
    // Autre(s) prénom(s) (components 3, 4, 5)
    for (let i = 2; i <= 4; i++) {
      if (components[i] && components[i].value) {
        givenNames.push(components[i].value);
      }
    }
    
    // Type d'utilisation du nom (component 7 - code + component 8 - contexte)
    let nameUse = 'official';
    if (components[6] && components[6].value) {
      nameUse = mapNameUseToFHIR(components[6].value);
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
      
      // Préfixe (titre) - component 5
      if (components[4] && components[4].value) {
        nameObj.prefix = [components[4].value];
      }
      
      // Suffixe - component 6
      if (components[5] && components[5].value) {
        nameObj.suffix = [components[5].value];
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
 * Détermine le genre du patient à partir du champ PID-8
 * @param {Object} genderField - Champ de genre
 * @returns {string} Genre FHIR
 */
function determineGender(genderField) {
  if (!genderField || !genderField.value) {
    return 'unknown';
  }
  
  switch (genderField.value.toUpperCase()) {
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
 * Formate la date de naissance à partir du champ PID-7
 * @param {Object} birthDateField - Champ de date de naissance
 * @returns {string} Date de naissance au format YYYY-MM-DD
 */
function formatBirthDate(birthDateField) {
  if (!birthDateField || !birthDateField.value) {
    return null;
  }
  
  const dateValue = birthDateField.value;
  
  // Format attendu: YYYYMMDD ou YYYYMMDDHHMMSS
  if (/^\d{8}/.test(dateValue)) {
    const year = dateValue.substring(0, 4);
    const month = dateValue.substring(4, 6);
    const day = dateValue.substring(6, 8);
    
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
  const phoneFields = pidSegment.getField(13).getRepetitions();
  
  for (const phoneField of phoneFields) {
    const components = phoneField.getComponents();
    
    // Numéro (component 1)
    const phoneNumber = components[0] ? components[0].value : '';
    
    // Type d'utilisation (component 2)
    const useCode = components[1] ? components[1].value : '';
    
    // Type d'équipement (component 3)
    const equipCode = components[2] ? components[2].value : '';
    
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
  const businessPhoneFields = pidSegment.getField(14).getRepetitions();
  
  for (const phoneField of businessPhoneFields) {
    const components = phoneField.getComponents();
    
    // Numéro (component 1)
    const phoneNumber = components[0] ? components[0].value : '';
    
    // Type d'équipement (component 3)
    const equipCode = components[2] ? components[2].value : '';
    
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
  const addressFields = pidSegment.getField(11).getRepetitions();
  
  for (const addressField of addressFields) {
    const components = addressField.getComponents();
    
    // Informations d'adresse
    const street1 = components[0] ? components[0].value : '';
    const street2 = components[1] ? components[1].value : '';
    const city = components[2] ? components[2].value : '';
    const state = components[3] ? components[3].value : '';
    const postalCode = components[4] ? components[4].value : '';
    const country = components[5] ? components[5].value : '';
    
    // Type d'adresse (component 7)
    const addrType = components[6] ? components[6].value : '';
    
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
  
  // Déterminer la classe d'encounter
  const patientClass = pv1Segment.getField(2).value || '';
  const encounterClass = mapPatientClassToFHIR(patientClass);
  
  // Statut de l'encounter
  const dischargeDisposition = pv1Segment.getField(36).value || '';
  const encounterStatus = determineEncounterStatus(dischargeDisposition);
  
  // Période de l'encounter
  const admitDate = formatHL7DateTime(pv1Segment.getField(44));
  const dischargeDate = formatHL7DateTime(pv1Segment.getField(45));
  
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
  
  // Numéro de visite/séjour
  const visitNumber = pv1Segment.getField(19).value;
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
 * @param {Object} dateField - Champ de date HL7
 * @returns {string|null} Date au format ISO ou null si non disponible
 */
function formatHL7DateTime(dateField) {
  if (!dateField || !dateField.value) {
    return null;
  }
  
  const dateValue = dateField.value;
  
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
 * @param {number} fieldIndex - Index du champ (4 pour sending, 6 pour receiving)
 * @returns {Object|null} Entrée de bundle pour une Organization ou null si non disponible
 */
function createOrganizationResource(mshSegment, fieldIndex) {
  const orgField = mshSegment.getField(fieldIndex);
  
  if (!orgField || !orgField.value) {
    return null;
  }
  
  const orgComponents = orgField.getComponents();
  const orgName = orgComponents[0] ? orgComponents[0].value : '';
  
  if (!orgName) {
    return null;
  }
  
  // Identifier comme OID s'il existe un namespace
  let orgId = orgName;
  if (orgComponents.length > 1 && orgComponents[1].value) {
    orgId = orgComponents[1].value;
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
  const rolePersonField = rolSegment.getField(4);
  
  if (!rolePersonField || !rolePersonField.value) {
    return null;
  }
  
  const components = rolePersonField.getComponents();
  
  // Identifier du praticien (component 1)
  const idValue = components[0] ? components[0].value : '';
  
  // Nom du praticien (components 2-3)
  const familyName = components[1] ? components[1].value : '';
  const givenName = components[2] ? components[2].value : '';
  
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
    // Système d'identification (composants 5-6)
    let system = '';
    if (components[5] && components[6]) {
      const namespaceComp = components[5].getComponents();
      if (namespaceComp.length > 1 && namespaceComp[1].value) {
        system = `urn:oid:${namespaceComp[1].value}`;
      }
    }
    
    practitionerResource.identifier.push({
      system: system || 'urn:oid:1.2.250.1.71.4.2.1',
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
  const roleType = rolSegment.getField(3).value;
  
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
  const nameField = nk1Segment.getField(2);
  // NK1-3 (Relation)
  const relationshipField = nk1Segment.getField(3);
  
  if (!nameField || !nameField.value) {
    return null;
  }
  
  const components = nameField.getComponents();
  const familyName = components[0] ? components[0].value : '';
  const givenName = components[1] ? components[1].value : '';
  
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
  if (relationshipField && relationshipField.value) {
    const relationship = relationshipField.getComponents();
    const relationshipCode = relationship[1] ? relationship[1].value : '';
    const relationshipSystem = relationship[0] ? relationship[0].value : '';
    
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
  const planIdField = in1Segment.getField(2);
  
  // IN1-3 (Insurance Company ID)
  const insuranceCompanyField = in1Segment.getField(3);
  
  // IN1-8 (Group Name)
  const groupNameField = in1Segment.getField(8);
  
  // IN1-12 (Policy Expiration Date)
  const expirationDateField = in1Segment.getField(12);
  
  // IN1-16 (Name of Insured)
  const insuredNameField = in1Segment.getField(16);
  
  // IN1-35 (Insurance Plan ID)
  const insurancePlanField = in1Segment.getField(35);
  
  if (!planIdField && !insuranceCompanyField && !insurancePlanField) {
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
  if (planIdField && planIdField.value) {
    coverageResource.type = {
      coding: [{
        system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
        code: planIdField.value,
        display: 'Insurance policy'
      }]
    };
  }
  
  // Ajouter la période de validité
  if (expirationDateField && expirationDateField.value) {
    const expirationDate = formatHL7DateTime(expirationDateField);
    if (expirationDate) {
      coverageResource.period = {
        end: expirationDate
      };
    }
  }
  
  // Ajouter le nom de l'assuré
  if (insuredNameField && insuredNameField.value) {
    const components = insuredNameField.getComponents();
    
    if (components[0] && components[0].value) {
      coverageResource.subscriberId = components[0].value;
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