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
  if (pidSegment[3]) {
    // Dans notre implémentation simplifiée, PID-3 peut contenir plusieurs identifiants séparés par ~
    const identifiers = pidSegment[3].split('~').filter(id => id && id.trim() !== '');
    
    identifiers.forEach(idStr => {
      // Format typique: 442777^^^CEGI&&M^PI
      const idParts = idStr.split('^');
      
      if (!idParts[0]) return;
      
      const identifier = {
        value: idParts[0]
      };
      
      // Extraire le système d'identification
      if (idParts[3]) {
        // Format potentiel: ASIP-SANTE-INS-NIR&1.2.250.1.213.1.4.8&ISO
        const systemParts = idParts[3].split('&');
        const systemName = systemParts[0];
        const oid = systemParts[1];
        
        // Appliquer le mapping si disponible
        if (systemName && conversionRules.PID.identifiers.systemMapping[systemName]) {
          identifier.system = conversionRules.PID.identifiers.systemMapping[systemName];
        } else if (oid) {
          identifier.system = `urn:oid:${oid}`;
        } else if (systemName) {
          identifier.system = `urn:oid:${systemName}`;
        }
      }
      
      // Ajouter le type d'identifiant si disponible (ex: PI = Patient Internal ID)
      if (idParts[4]) {
        identifier.type = {
          coding: [{
            system: "http://terminology.hl7.org/CodeSystem/v2-0203",
            code: idParts[4]
          }]
        };
      }
      
      patientResource.identifier.push(identifier);
    });
  }
  
  // Le traitement des noms est déjà géré par le module frenchNameExtractor
  // Nous ne traitons pas les noms ici pour éviter les conflits
  
  // Traiter la date de naissance (PID-7)
  if (pidSegment[7]) {
    let birthDate = pidSegment[7];
    // Formater la date pour FHIR (YYYY-MM-DD)
    if (birthDate.length >= 8) {
      const year = birthDate.substring(0, 4);
      const month = birthDate.substring(4, 6);
      const day = birthDate.substring(6, 8);
      patientResource.birthDate = `${year}-${month}-${day}`;
    }
  }
  
  // Traiter le genre (PID-8)
  if (pidSegment[8]) {
    const gender = pidSegment[8];
    patientResource.gender = conversionRules.PID.gender.mapping[gender] || 'unknown';
  }
  
  // Traiter les adresses (PID-11)
  if (pidSegment[11]) {
    // Format typique: 7 RUE DU BOUJONNIER^^FORMERIE^^60220^^H
    const addresses = pidSegment[11].split('~').filter(addr => addr && addr.trim() !== '');
    
    addresses.forEach(addrStr => {
      const addrParts = addrStr.split('^');
      
      const address = {
        line: []
      };
      
      // Ligne d'adresse (première partie)
      if (addrParts[0] && addrParts[0].trim() !== '') {
        address.line.push(addrParts[0]);
      }
      
      // Deuxième ligne d'adresse (deuxième partie, souvent vide)
      if (addrParts[1] && addrParts[1].trim() !== '') {
        address.line.push(addrParts[1]);
      }
      
      // Ville (troisième partie)
      if (addrParts[2] && addrParts[2].trim() !== '') {
        address.city = addrParts[2];
      }
      
      // État/Province/Département (quatrième partie, souvent vide en France)
      if (addrParts[3] && addrParts[3].trim() !== '') {
        address.state = addrParts[3];
      }
      
      // Code postal (cinquième partie)
      if (addrParts[4] && addrParts[4].trim() !== '') {
        address.postalCode = addrParts[4];
      }
      
      // Pays (sixième partie)
      if (addrParts[5] && addrParts[5].trim() !== '') {
        address.country = addrParts[5];
      }
      
      // Type d'adresse (septième partie)
      if (addrParts[6] && addrParts[6].trim() !== '') {
        const useCode = conversionRules.PID.address.useMapping[addrParts[6]] || 'home';
        address.use = useCode;
      }
      
      // N'ajouter l'adresse que si elle contient au moins une information
      if (address.line.length > 0 || address.city || address.postalCode) {
        patientResource.address.push(address);
      }
    });
  }
  
  // Traiter les numéros de téléphone et emails (PID-13)
  if (pidSegment[13]) {
    // Format typique: ^PRN^PH^^^^^^^^^0608987212~~~^NET^Internet^MARYSE.SECLET@WANADOO.FR
    const telecoms = pidSegment[13].split('~').filter(tel => tel && tel.trim() !== '');
    
    telecoms.forEach(telecomStr => {
      const telecomParts = telecomStr.split('^');
      
      // Vérifier si nous avons assez de parties dans le champ
      if (telecomParts.length < 3) return;
      
      // Le numéro de téléphone se trouve généralement à l'index 10
      // L'email se trouve généralement à l'index 3 si type=NET
      const value = telecomParts[10] || telecomParts[3] || '';
      
      if (!value || value.trim() === '') return;
      
      const telecom = {
        value: value
      };
      
      // Type d'équipement (téléphone, fax, email) à l'index 2
      const equipmentType = telecomParts[2] || '';
      
      if (equipmentType === 'PH' || equipmentType === 'CP') {
        telecom.system = 'phone';
      } else if (equipmentType === 'FX') {
        telecom.system = 'fax';
      } else if (equipmentType === 'NET' || equipmentType === 'Internet') {
        telecom.system = 'email';
      } else {
        telecom.system = 'phone'; // Par défaut
      }
      
      // Utilisation (domicile, travail, etc.) à l'index 1
      const useCode = telecomParts[1] || '';
      
      if (useCode === 'PRN') {
        telecom.use = 'home';
      } else if (useCode === 'WPN') {
        telecom.use = 'work';
      } else if (useCode === 'ORN') {
        telecom.use = 'old';
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
    // Format typique: DUPONT^MARIE^^^^^L
    const nameParts = nk1Segment[2].split('^');
    
    if (nameParts.length >= 2) {
      const familyName = nameParts[0];
      const givenName = nameParts[1];
      
      if (familyName || givenName) {
        contact.name = {
          family: familyName || '',
          given: givenName ? [givenName] : []
        };
      }
    }
  }
  
  // Traiter la relation (NK1-3)
  if (nk1Segment[3]) {
    // Format typique: SPO ou MTH (spouse ou mother)
    const relationshipCode = nk1Segment[3].split('^')[0];
    
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
    // Format similaire à PID-11
    const addrParts = nk1Segment[4].split('^');
    
    const address = {
      line: []
    };
    
    // Ligne d'adresse (première partie)
    if (addrParts[0] && addrParts[0].trim() !== '') {
      address.line.push(addrParts[0]);
    }
    
    // Deuxième ligne d'adresse (deuxième partie, souvent vide)
    if (addrParts[1] && addrParts[1].trim() !== '') {
      address.line.push(addrParts[1]);
    }
    
    // Ville (troisième partie)
    if (addrParts[2] && addrParts[2].trim() !== '') {
      address.city = addrParts[2];
    }
    
    // Code postal (cinquième partie)
    if (addrParts[4] && addrParts[4].trim() !== '') {
      address.postalCode = addrParts[4];
    }
    
    // N'ajouter l'adresse que si elle contient au moins une information
    if (address.line.length > 0 || address.city || address.postalCode) {
      contact.address = address;
    }
  }
  
  // Traiter le téléphone (NK1-5)
  if (nk1Segment[5]) {
    // Format similaire à PID-13
    const telecomParts = nk1Segment[5].split('^');
    
    // Si le numéro est disponible (généralement à l'index 10)
    if (telecomParts.length > 10 && telecomParts[10] && telecomParts[10].trim() !== '') {
      contact.telecom = [{
        system: 'phone',
        value: telecomParts[10],
        use: 'home'
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
  if (pv1Segment[2]) {
    const patientClass = pv1Segment[2];
    
    // Mapper le type de patient
    if (patientClass === 'I') {
      encounterResource.class.code = 'IMP'; // Hospitalisé
    } else if (patientClass === 'O') {
      encounterResource.class.code = 'AMB'; // Ambulatoire
    } else if (patientClass === 'E') {
      encounterResource.class.code = 'EMER'; // Urgence
    }
  }
  
  // Traiter le lieu/service (PV1-3)
  if (pv1Segment[3]) {
    // Format: PV1|1|O|MEDE^^^^MEDE^^^^Service de médecine^^^^SI
    const locationParts = pv1Segment[3].split('^');
    
    // Récupérer les informations du service
    let locationDisplay = '';
    
    // L'identifiant du service est généralement dans la 1ère partie
    if (locationParts[0] && locationParts[0].trim() !== '') {
      locationDisplay = locationParts[0];
    }
    
    // Le nom complet est souvent dans la 4ème partie
    if (locationParts[4] && locationParts[4].trim() !== '') {
      locationDisplay = locationParts[4];
    }
    
    // Ajouter la location à l'encounter
    if (locationDisplay) {
      encounterResource.location = [{
        status: 'active',
        location: {
          display: locationDisplay
        }
      }];
    }
  }
  
  // Traiter le praticien responsable (PV1-7)
  if (pv1Segment[7]) {
    // Format: DURANT^JEAN^^^^^D^^^RPPS&1.2.250.1.71.4.2.1&ISO^L^^^RPPS
    const practitionerParts = pv1Segment[7].split('^');
    
    if (practitionerParts.length >= 2) {
      const practitionerId = `practitioner-${context.getUniqueId()}`;
      const practitionerResource = {
        resourceType: 'Practitioner',
        id: practitionerId,
        identifier: []
      };
      
      // Traiter le nom du praticien (généralement les 2 premières parties)
      const familyName = practitionerParts[0];
      const givenName = practitionerParts[1];
      
      if (familyName || givenName) {
        practitionerResource.name = [{
          family: familyName || '',
          given: givenName ? [givenName] : []
        }];
      }
      
      // Traiter l'identifiant du praticien (souvent dans la 9ème partie)
      if (practitionerParts[9] && practitionerParts[9].trim() !== '') {
        practitionerResource.identifier.push({
          system: 'http://terminology.hl7.fr/CodeSystem/v2-0203',
          value: practitionerParts[9]
        });
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
  }
  
  // Traiter la date de début (PV1-44)
  if (pv1Segment[44]) {
    let admitDate = pv1Segment[44];
    
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
  if (inSegment[2]) {
    // Format potentiel: CPAM OISE^1111^CPAM OISE
    const insurerParts = inSegment[2].split('^');
    
    let insurerId = '';
    let insurerName = '';
    
    // L'identifiant est souvent dans la deuxième partie
    if (insurerParts[1] && insurerParts[1].trim() !== '') {
      insurerId = insurerParts[1];
    } else if (insurerParts[0] && insurerParts[0].trim() !== '') {
      // Si pas de deuxième partie, utiliser la première
      insurerId = insurerParts[0];
    }
    
    // Le nom est souvent dans la première ou troisième partie
    if (insurerParts[2] && insurerParts[2].trim() !== '') {
      insurerName = insurerParts[2];
    } else if (insurerParts[0] && insurerParts[0].trim() !== '') {
      insurerName = insurerParts[0];
    } else {
      insurerName = `Organisme ${insurerId}`;
    }
    
    // Créer une ressource Organization pour l'assureur
    const organizationId = `organization-${context.getUniqueId()}`;
    const organizationResource = {
      resourceType: 'Organization',
      id: organizationId,
      identifier: [{
        system: 'http://terminology.hl7.fr/CodeSystem/TRE-G08-TypeIdentifiantStructure',
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
  if (inSegment[13]) {
    // Format potentiel: 20231231
    let endDate = inSegment[13];
    
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
  
  // Traiter le numéro d'assuré (IN1-36)
  if (inSegment[36]) {
    coverageResource.identifier = [{
      system: 'http://terminology.hl7.fr/CodeSystem/v2-0203',
      value: inSegment[36]
    }];
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