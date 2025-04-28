/**
 * Module de traitement des segments HL7 pour la conversion vers FHIR
 * Fournit des fonctions spécifiques pour chaque type de segment HL7
 * 
 * @module segmentProcessors
 * @author FHIRHub Team
 */

const { conversionRules } = require('./hl7ToFhirRules');
const { v4: uuidv4 } = require('uuid');

/**
 * Processeur pour le segment PID (Patient Identification)
 * @param {Object} pidSegment - Segment PID parsé
 * @param {Object} context - Contexte de conversion
 * @returns {Object} Ressource Patient FHIR
 */
function processPIDSegment(pidSegment, context) {
  const patientResource = {
    resourceType: 'Patient',
    id: `patient-${context.getUniqueId()}`,
    identifier: [],
    name: [],
    telecom: [],
    address: [],
    contact: []
  };
  
  // Traiter les identifiants (PID-3)
  if (pidSegment[3] && Array.isArray(pidSegment[3])) {
    pidSegment[3].forEach(idField => {
      if (!idField || !idField.value) return;
      
      const identifier = {
        value: idField.value
      };
      
      // Ajouter le système d'identification si disponible
      if (idField.assigningAuthority && idField.assigningAuthority.namespaceId) {
        const nsId = idField.assigningAuthority.namespaceId;
        const mappedSystem = conversionRules.PID.identifiers.systemMapping[nsId];
        identifier.system = mappedSystem || `urn:oid:${nsId}`;
      }
      
      patientResource.identifier.push(identifier);
    });
  }
  
  // Le traitement des noms est déjà géré par le module frenchNameExtractor
  // Nous ne traitons pas les noms ici pour éviter les conflits
  
  // Traiter la date de naissance (PID-7)
  if (pidSegment[7] && pidSegment[7].value) {
    let birthDate = pidSegment[7].value;
    // Formater la date pour FHIR (YYYY-MM-DD)
    if (birthDate.length >= 8) {
      const year = birthDate.substring(0, 4);
      const month = birthDate.substring(4, 6);
      const day = birthDate.substring(6, 8);
      patientResource.birthDate = `${year}-${month}-${day}`;
    }
  }
  
  // Traiter le genre (PID-8)
  if (pidSegment[8] && pidSegment[8].value) {
    const gender = pidSegment[8].value;
    patientResource.gender = conversionRules.PID.gender.mapping[gender] || 'unknown';
  }
  
  // Traiter les adresses (PID-11)
  if (pidSegment[11] && Array.isArray(pidSegment[11])) {
    pidSegment[11].forEach(addrField => {
      if (!addrField) return;
      
      const address = {
        line: []
      };
      
      // Ligne 1 de l'adresse
      if (addrField.streetAddress) {
        address.line.push(addrField.streetAddress);
      }
      
      // Ligne 2 de l'adresse (non définie dans HL7 v2.5 standard, mais parfois utilisée)
      if (addrField.otherDesignation) {
        address.line.push(addrField.otherDesignation);
      }
      
      // Ville
      if (addrField.city) {
        address.city = addrField.city;
      }
      
      // État/Région
      if (addrField.stateOrProvince) {
        address.state = addrField.stateOrProvince;
      }
      
      // Code postal
      if (addrField.zipOrPostalCode) {
        address.postalCode = addrField.zipOrPostalCode;
      }
      
      // Pays
      if (addrField.country) {
        address.country = addrField.country;
      }
      
      // Type d'adresse
      if (addrField.addressType) {
        const useCode = conversionRules.PID.address.useMapping[addrField.addressType] || 'home';
        address.use = useCode;
      }
      
      patientResource.address.push(address);
    });
  }
  
  // Traiter les numéros de téléphone (PID-13)
  if (pidSegment[13] && Array.isArray(pidSegment[13])) {
    pidSegment[13].forEach(telecomField => {
      if (!telecomField || !telecomField.telephoneNumber) return;
      
      const telecom = {
        value: telecomField.telephoneNumber
      };
      
      // Type de télécom (téléphone, e-mail, etc.)
      if (telecomField.telecommunicationEquipmentType) {
        const system = conversionRules.PID.telecom.systemMapping[telecomField.telecommunicationEquipmentType] || 'phone';
        telecom.system = system;
      } else {
        telecom.system = 'phone';
      }
      
      // Utilisation (domicile, travail, etc.)
      if (telecomField.telecommunicationUseCode) {
        const use = conversionRules.PID.telecom.useMapping[telecomField.telecommunicationUseCode] || 'home';
        telecom.use = use;
      }
      
      // Traitement spécial pour les e-mails
      if (telecomField.emailAddress) {
        telecom.system = 'email';
        telecom.value = telecomField.emailAddress;
      }
      
      patientResource.telecom.push(telecom);
    });
  }
  
  // Ajouter la ressource au contexte
  context.addResource(patientResource);
  
  return patientResource;
}

/**
 * Processeur pour le segment NK1 (Next of Kin)
 * @param {Object} nk1Segment - Segment NK1 parsé
 * @param {Object} context - Contexte de conversion
 * @returns {Object} Mise à jour de la ressource Patient ou nouvelle ressource RelatedPerson
 */
function processNK1Segment(nk1Segment, context) {
  // Récupérer la ressource Patient
  const patientResource = context.getResourceByType('Patient');
  
  if (!patientResource) {
    console.warn('Processeur NK1: Ressource Patient non trouvée dans le contexte');
    return null;
  }
  
  // Création du contact basé sur NK1
  const contact = {
    relationship: []
  };
  
  // Traiter le nom (NK1-2)
  if (nk1Segment[2]) {
    const familyName = nk1Segment[2].familyName?.surname;
    const givenName = nk1Segment[2].givenName;
    
    if (familyName || givenName) {
      contact.name = {
        family: familyName || '',
        given: givenName ? [givenName] : []
      };
    }
  }
  
  // Traiter la relation (NK1-3)
  if (nk1Segment[3]) {
    let relationshipCode = '';
    
    if (typeof nk1Segment[3] === 'string') {
      relationshipCode = nk1Segment[3];
    } else if (nk1Segment[3].identifier) {
      relationshipCode = nk1Segment[3].identifier;
    } else if (nk1Segment[3].text) {
      relationshipCode = nk1Segment[3].text;
    }
    
    if (relationshipCode) {
      const mappedRelationship = conversionRules.NK1.relationship.mapping[relationshipCode] || 'other';
      
      contact.relationship.push({
        coding: [{
          system: 'http://terminology.hl7.org/CodeSystem/v3-RoleCode',
          code: mappedRelationship
        }]
      });
    }
  }
  
  // Traiter l'adresse (NK1-4)
  if (nk1Segment[4]) {
    const addressField = nk1Segment[4];
    
    const address = {
      line: []
    };
    
    if (addressField.streetAddress) {
      address.line.push(addressField.streetAddress);
    }
    
    if (addressField.city) {
      address.city = addressField.city;
    }
    
    if (addressField.stateOrProvince) {
      address.state = addressField.stateOrProvince;
    }
    
    if (addressField.zipOrPostalCode) {
      address.postalCode = addressField.zipOrPostalCode;
    }
    
    if (addressField.country) {
      address.country = addressField.country;
    }
    
    contact.address = address;
  }
  
  // Traiter le téléphone (NK1-5)
  if (nk1Segment[5]) {
    const telecomField = nk1Segment[5];
    
    if (telecomField.telephoneNumber) {
      contact.telecom = [{
        system: 'phone',
        value: telecomField.telephoneNumber
      }];
    }
  }
  
  // Ajouter le contact à la ressource Patient
  if (Object.keys(contact).length > 1) { // Plus d'attributs que juste relationship
    if (!patientResource.contact) {
      patientResource.contact = [];
    }
    
    patientResource.contact.push(contact);
  }
  
  return patientResource;
}

/**
 * Processeur pour le segment PV1 (Patient Visit)
 * @param {Object} pv1Segment - Segment PV1 parsé
 * @param {Object} context - Contexte de conversion
 * @returns {Object} Ressource Encounter FHIR
 */
function processPV1Segment(pv1Segment, context) {
  // Récupérer la ressource Patient
  const patientResource = context.getResourceByType('Patient');
  
  if (!patientResource) {
    console.warn('Processeur PV1: Ressource Patient non trouvée dans le contexte');
    return null;
  }
  
  // Créer la ressource Encounter
  const encounterResource = {
    resourceType: 'Encounter',
    id: `encounter-${context.getUniqueId()}`,
    status: 'in-progress', // Par défaut
    class: {
      system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
      code: 'AMB' // Par défaut = ambulatoire
    },
    subject: {
      reference: `Patient/${patientResource.id}`
    }
  };
  
  // Traiter le type de patient (PV1-2)
  if (pv1Segment[2] && pv1Segment[2].value) {
    const patientClass = pv1Segment[2].value;
    const mappedClass = conversionRules.PV1.patientClass.mapping[patientClass];
    
    if (mappedClass) {
      encounterResource.class.code = mappedClass === 'inpatient' ? 'IMP' : 
                                     mappedClass === 'outpatient' ? 'AMB' : 
                                     mappedClass === 'emergency' ? 'EMER' : 'AMB';
    }
  }
  
  // Traiter le lieu/service (PV1-3)
  if (pv1Segment[3]) {
    let locationDisplay = null;
    let locationReference = null;
    
    // Extraire l'identifiant et le nom du lieu selon les règles
    conversionRules.PV1.location.extract.forEach(([index, attrName]) => {
      if (pv1Segment[3][index]) {
        if (attrName === 'identifier') {
          locationReference = pv1Segment[3][index];
        } else if (attrName === 'display') {
          locationDisplay = pv1Segment[3][index];
        }
      }
    });
    
    // Ajouter la location à l'encounter
    if (locationReference || locationDisplay) {
      encounterResource.location = [{
        status: 'active',
        location: {
          display: locationDisplay || 'Unknown location'
        }
      }];
    }
  }
  
  // Traiter le praticien responsable (PV1-7)
  if (pv1Segment[7]) {
    const practitionerId = `practitioner-${context.getUniqueId()}`;
    const practitionerResource = {
      resourceType: 'Practitioner',
      id: practitionerId,
      identifier: []
    };
    
    // Traiter l'identifiant du praticien
    if (pv1Segment[7].idNumber) {
      practitionerResource.identifier.push({
        value: pv1Segment[7].idNumber
      });
    }
    
    // Traiter le nom du praticien
    if (pv1Segment[7].familyName || pv1Segment[7].givenName) {
      practitionerResource.name = [{
        family: pv1Segment[7].familyName?.surname || '',
        given: pv1Segment[7].givenName ? [pv1Segment[7].givenName] : []
      }];
    }
    
    // Ajouter le praticien au contexte
    context.addResource(practitionerResource);
    
    // Référencer le praticien dans l'encounter
    encounterResource.participant = [{
      type: [{
        coding: [{
          system: 'http://terminology.hl7.org/CodeSystem/v3-ParticipationType',
          code: 'ATND'
        }]
      }],
      individual: {
        reference: `Practitioner/${practitionerId}`
      }
    }];
  }
  
  // Traiter la date de début (PV1-44)
  if (pv1Segment[44] && pv1Segment[44].value) {
    let admitDate = pv1Segment[44].value;
    
    // Formater la date pour FHIR (YYYY-MM-DDThh:mm:ss+zz:zz)
    if (admitDate.length >= 8) {
      const year = admitDate.substring(0, 4);
      const month = admitDate.substring(4, 6);
      const day = admitDate.substring(6, 8);
      let time = '00:00:00';
      
      if (admitDate.length >= 14) {
        const hour = admitDate.substring(8, 10);
        const minute = admitDate.substring(10, 12);
        const second = admitDate.substring(12, 14);
        time = `${hour}:${minute}:${second}`;
      }
      
      encounterResource.period = {
        start: `${year}-${month}-${day}T${time}+00:00`
      };
    }
  }
  
  // Ajouter la ressource au contexte
  context.addResource(encounterResource);
  
  return encounterResource;
}

/**
 * Processeur pour les segments Z (Z-segments personnalisés)
 * @param {string} segmentType - Type de segment Z (ZBE, ZFD, etc.)
 * @param {Object} zSegment - Segment Z parsé
 * @param {Object} context - Contexte de conversion
 * @returns {Array} Extensions FHIR créées
 */
function processZSegment(segmentType, zSegment, context) {
  // Vérifier si le type de segment Z est géré spécifiquement
  if (!conversionRules.Z.segments[segmentType]) {
    console.warn(`Processeur Z: Type de segment ${segmentType} non configuré`);
    return [];
  }
  
  const zRules = conversionRules.Z.segments[segmentType];
  const extensions = [];
  
  // Traiter le segment selon ses règles spécifiques
  Object.entries(zRules).forEach(([ruleName, fieldIndex]) => {
    if (typeof fieldIndex !== 'number' || !zSegment[fieldIndex]) return;
    
    const value = zSegment[fieldIndex].value || zSegment[fieldIndex];
    
    if (!value) return;
    
    // Créer l'extension FHIR
    const extension = {
      url: `${conversionRules.Z.general.extensionUrlPrefix}${segmentType.toLowerCase()}-${ruleName}`,
      valueString: value.toString()
    };
    
    extensions.push(extension);
  });
  
  // Si le segment est lié à un épisode de soins (ex: ZBE)
  if (segmentType === 'ZBE' && extensions.length > 0) {
    // Récupérer la ressource Encounter
    const encounterResource = context.getResourceByType('Encounter');
    
    if (encounterResource) {
      // Ajouter les extensions à l'encounter
      if (!encounterResource.extension) {
        encounterResource.extension = [];
      }
      
      encounterResource.extension.push(...extensions);
    }
  }
  
  return extensions;
}

/**
 * Processeur pour les segments d'assurance (IN1, IN2)
 * @param {Object} inSegment - Segment IN1/IN2 parsé
 * @param {Object} context - Contexte de conversion
 * @returns {Object} Ressource Coverage FHIR
 */
function processInsuranceSegment(inSegment, segmentType, context) {
  // Récupérer la ressource Patient
  const patientResource = context.getResourceByType('Patient');
  
  if (!patientResource) {
    console.warn('Processeur IN: Ressource Patient non trouvée dans le contexte');
    return null;
  }
  
  // Créer la ressource Coverage seulement pour IN1
  if (segmentType !== 'IN1') {
    return null;
  }
  
  const coverageResource = {
    resourceType: 'Coverage',
    id: `coverage-${context.getUniqueId()}`,
    status: 'active',
    beneficiary: {
      reference: `Patient/${patientResource.id}`
    },
    payor: []
  };
  
  // Traiter l'identifiant de l'organisme d'assurance (IN1-2)
  if (inSegment[2] && inSegment[2].value) {
    const insurerId = inSegment[2].value;
    const insurerName = conversionRules.IN.insurerMapping[insurerId] || `Organisme ${insurerId}`;
    
    // Créer une ressource Organization pour l'assureur
    const organizationId = `organization-${context.getUniqueId()}`;
    const organizationResource = {
      resourceType: 'Organization',
      id: organizationId,
      identifier: [{
        value: insurerId
      }],
      name: insurerName
    };
    
    // Ajouter l'organisation au contexte
    context.addResource(organizationResource);
    
    // Référencer l'organisation dans la coverage
    coverageResource.payor.push({
      reference: `Organization/${organizationId}`
    });
  }
  
  // Traiter la période de validité (IN1-12 -> IN1-13 = début -> fin)
  if (inSegment[13] && inSegment[13].value) {
    let endDate = inSegment[13].value;
    
    // Formater la date pour FHIR (YYYY-MM-DD)
    if (endDate.length >= 8) {
      const year = endDate.substring(0, 4);
      const month = endDate.substring(4, 6);
      const day = endDate.substring(6, 8);
      
      coverageResource.period = {
        end: `${year}-${month}-${day}`
      };
    }
  }
  
  // Ajouter la ressource au contexte
  context.addResource(coverageResource);
  
  return coverageResource;
}

/**
 * Classe de contexte pour la conversion HL7 vers FHIR
 * Maintient l'état pendant le processus de conversion
 */
class ConversionContext {
  constructor() {
    this.resources = [];
    this.idCounter = 0;
  }
  
  /**
   * Générer un identifiant unique pour une ressource
   * @returns {string} Identifiant unique généré
   */
  getUniqueId() {
    return uuidv4().substring(0, 8);
  }
  
  /**
   * Ajouter une ressource au contexte
   * @param {Object} resource - Ressource FHIR à ajouter
   */
  addResource(resource) {
    // Vérifier si la ressource est déjà présente
    const existingIndex = this.resources.findIndex(r => 
      r.resourceType === resource.resourceType && r.id === resource.id);
    
    if (existingIndex >= 0) {
      // Mettre à jour la ressource existante
      this.resources[existingIndex] = resource;
    } else {
      // Ajouter la nouvelle ressource
      this.resources.push(resource);
    }
  }
  
  /**
   * Récupérer une ressource par type
   * @param {string} resourceType - Type de ressource FHIR à récupérer
   * @returns {Object} Première ressource correspondante ou null
   */
  getResourceByType(resourceType) {
    return this.resources.find(r => r.resourceType === resourceType) || null;
  }
  
  /**
   * Récupérer toutes les ressources dans un bundle FHIR
   * @param {string} bundleType - Type de bundle ('transaction', 'batch', 'collection')
   * @returns {Object} Bundle FHIR contenant toutes les ressources
   */
  getFhirBundle(bundleType = 'transaction') {
    return {
      resourceType: 'Bundle',
      type: bundleType,
      entry: this.resources.map(resource => ({
        resource,
        request: {
          method: 'POST',
          url: resource.resourceType
        }
      }))
    };
  }
}

module.exports = {
  processPIDSegment,
  processNK1Segment,
  processPV1Segment,
  processZSegment,
  processInsuranceSegment,
  ConversionContext
};