/**
 * Module principal de conversion HL7 vers FHIR
 * Ce module convertit les messages HL7 v2.5 en ressources FHIR R4
 * 
 * @module hl7ToFhirConverter
 * @author FHIRHub Team
 */

const hl7parser = require('hl7parser');
const { v4: uuidv4 } = require('uuid');
const frenchNameExtractor = require('../utils/frenchNameExtractor');

/**
 * Convertir un message HL7 en Bundle FHIR
 * @param {string} hl7Message - Message HL7 à convertir
 * @param {Object} options - Options de conversion
 * @returns {Object} Résultat de la conversion avec le Bundle FHIR
 */
async function convert(hl7Message, options = {}) {
  try {
    // Vérifier que le message HL7 est valide
    if (!hl7Message || typeof hl7Message !== 'string') {
      throw new Error('Message HL7 invalide ou vide');
    }

    // Normaliser les fins de ligne pour être sûr
    hl7Message = hl7Message.replace(/\r\n|\r|\n/g, '\r');

    // Parser le message HL7
    const parsedMessage = hl7parser.create(hl7Message);
    
    if (!parsedMessage) {
      throw new Error('Échec du parsing du message HL7');
    }

    // Créer un Bundle FHIR
    const bundle = createFhirBundle();
    
    // Extraire les informations du patient
    extractPatient(parsedMessage, bundle);
    
    // Extraire les informations du praticien
    extractPractitioner(parsedMessage, bundle);
    
    // Extraire les informations de l'organisation
    extractOrganization(parsedMessage, bundle);
    
    // Extraire les informations de rencontre/séjour
    extractEncounter(parsedMessage, bundle);
    
    // Extraire les informations d'assurance
    extractCoverage(parsedMessage, bundle);
    
    // Retourner le résultat
    return {
      status: 'success',
      message: 'Conversion réussie',
      fhir: bundle
    };
  } catch (error) {
    console.error('[HL7_CONVERTER] Erreur lors de la conversion:', error);
    return {
      status: 'error',
      message: 'Erreur lors de la conversion: ' + error.message,
      error: error.stack
    };
  }
}

/**
 * Créer un Bundle FHIR vide
 * @returns {Object} Bundle FHIR
 */
function createFhirBundle() {
  return {
    resourceType: 'Bundle',
    type: 'transaction',
    id: uuidv4(),
    meta: {
      lastUpdated: new Date().toISOString()
    },
    entry: []
  };
}

/**
 * Ajouter une ressource au Bundle FHIR
 * @param {Object} bundle - Bundle FHIR
 * @param {Object} resource - Ressource FHIR à ajouter
 * @param {string} method - Méthode HTTP (PUT, POST)
 */
function addResourceToBundle(bundle, resource, method = 'POST') {
  if (!resource || !resource.resourceType) {
    console.warn('[HL7_CONVERTER] Tentative d\'ajout d\'une ressource invalide au bundle');
    return;
  }
  
  // Générer un ID pour la ressource si elle n'en a pas
  if (!resource.id) {
    resource.id = uuidv4();
  }
  
  // Ajouter la ressource au Bundle
  bundle.entry.push({
    fullUrl: `urn:uuid:${resource.id}`,
    resource: resource,
    request: {
      method: method,
      url: `${resource.resourceType}/${resource.id}`
    }
  });
}

/**
 * Extraire les informations du patient depuis le message HL7
 * @param {Object} parsedMessage - Message HL7 parsé
 * @param {Object} bundle - Bundle FHIR
 */
function extractPatient(parsedMessage, bundle) {
  try {
    // Récupérer le segment PID (Patient Identification)
    const pidSegment = parsedMessage.getSegment('PID');
    
    if (!pidSegment) {
      console.warn('[HL7_CONVERTER] Aucun segment PID trouvé');
      return;
    }
    
    // Créer la ressource Patient
    const patient = {
      resourceType: 'Patient',
      id: uuidv4(),
      identifier: [],
      active: true
    };
    
    // Extraire l'identifiant du patient
    const patientId = pidSegment.getField(3);
    if (patientId && patientId.value) {
      patient.identifier.push({
        system: 'urn:oid:1.2.250.1.213.1.4.8',
        value: patientId.value.toString()
      });
    }
    
    // Extraire le nom du patient en utilisant l'extracteur de noms français
    const names = frenchNameExtractor.extractFrenchNames(parsedMessage.toString());
    
    if (names && names.length > 0) {
      patient.name = names;
    } else {
      // Fallback si l'extracteur spécifique échoue
      const familyName = pidSegment.getComponent(5, 1);
      const givenName = pidSegment.getComponent(5, 2);
      
      if (familyName || givenName) {
        patient.name = [{
          family: familyName ? familyName.toString() : '',
          given: givenName ? [givenName.toString()] : []
        }];
      }
    }
    
    // Extraire la date de naissance
    const birthDate = pidSegment.getField(7);
    if (birthDate && birthDate.value) {
      // Formater la date au format YYYY-MM-DD
      const date = birthDate.value.toString();
      if (date.length >= 8) {
        patient.birthDate = `${date.substr(0, 4)}-${date.substr(4, 2)}-${date.substr(6, 2)}`;
      }
    }
    
    // Extraire le genre
    const gender = pidSegment.getField(8);
    if (gender && gender.value) {
      const genderValue = gender.value.toString();
      // Mapper les codes de genre HL7 vers FHIR
      switch (genderValue) {
        case 'M':
          patient.gender = 'male';
          break;
        case 'F':
          patient.gender = 'female';
          break;
        case 'O':
          patient.gender = 'other';
          break;
        case 'U':
          patient.gender = 'unknown';
          break;
        default:
          patient.gender = 'unknown';
      }
    }
    
    // Extraire l'adresse
    const address1 = pidSegment.getField(11);
    if (address1 && address1.value) {
      const streetAddress = pidSegment.getComponent(11, 1);
      const city = pidSegment.getComponent(11, 3);
      const postalCode = pidSegment.getComponent(11, 5);
      const country = pidSegment.getComponent(11, 6);
      
      patient.address = [{
        use: 'home',
        line: streetAddress ? [streetAddress.toString()] : [],
        city: city ? city.toString() : '',
        postalCode: postalCode ? postalCode.toString() : '',
        country: country ? country.toString() : 'FR'  // Par défaut en France
      }];
    }
    
    // Extraire le téléphone
    const phone = pidSegment.getField(13);
    if (phone && phone.value) {
      patient.telecom = [{
        system: 'phone',
        value: phone.value.toString(),
        use: 'home'
      }];
    }
    
    // Ajouter la ressource Patient au Bundle
    addResourceToBundle(bundle, patient);
    
  } catch (error) {
    console.error('[HL7_CONVERTER] Erreur lors de l\'extraction des données du patient:', error);
  }
}

/**
 * Extraire les informations du praticien depuis le message HL7
 * @param {Object} parsedMessage - Message HL7 parsé
 * @param {Object} bundle - Bundle FHIR
 */
function extractPractitioner(parsedMessage, bundle) {
  try {
    // Vérifier si nous avons un segment PV1 (Patient Visit)
    const pv1Segment = parsedMessage.getSegment('PV1');
    if (!pv1Segment) {
      return;
    }
    
    // Extraire l'identifiant du médecin traitant
    const attendingDoctor = pv1Segment.getField(7);
    if (!attendingDoctor || !attendingDoctor.value) {
      return;
    }
    
    // Créer la ressource Practitioner
    const practitioner = {
      resourceType: 'Practitioner',
      id: uuidv4(),
      identifier: []
    };
    
    // Extraire l'identifiant du praticien
    const practitionerId = pv1Segment.getComponent(7, 1);
    if (practitionerId) {
      practitioner.identifier.push({
        system: 'urn:oid:1.2.250.1.71.4.2.1',  // OID pour RPPS en France
        value: practitionerId.toString()
      });
    }
    
    // Extraire le nom du praticien
    const familyName = pv1Segment.getComponent(7, 2);
    const givenName = pv1Segment.getComponent(7, 3);
    
    if (familyName || givenName) {
      practitioner.name = [{
        family: familyName ? familyName.toString() : '',
        given: givenName ? [givenName.toString()] : []
      }];
    }
    
    // Ajouter la ressource Practitioner au Bundle
    addResourceToBundle(bundle, practitioner);
    
    // Créer également une ressource PractitionerRole
    const practitionerRole = {
      resourceType: 'PractitionerRole',
      id: uuidv4(),
      practitioner: {
        reference: `Practitioner/${practitioner.id}`
      },
      code: [
        {
          coding: [
            {
              system: 'urn:oid:1.2.250.1.213.1.1.4.5',  // Nomenclature des professions de santé
              code: '10',  // Code pour médecin
              display: 'Médecin'
            }
          ]
        }
      ],
      specialty: [
        {
          coding: [
            {
              system: 'urn:oid:1.2.250.1.213.1.1.4.16',  // Spécialités médicales
              code: 'SM01',  // Code générique
              display: 'Médecine générale'
            }
          ]
        }
      ]
    };
    
    // Ajouter la ressource PractitionerRole au Bundle
    addResourceToBundle(bundle, practitionerRole);
    
  } catch (error) {
    console.error('[HL7_CONVERTER] Erreur lors de l\'extraction des données du praticien:', error);
  }
}

/**
 * Extraire les informations de l'organisation depuis le message HL7
 * @param {Object} parsedMessage - Message HL7 parsé
 * @param {Object} bundle - Bundle FHIR
 */
function extractOrganization(parsedMessage, bundle) {
  try {
    // Vérifier si nous avons un segment MSH (Message Header)
    const mshSegment = parsedMessage.getSegment('MSH');
    if (!mshSegment) {
      return;
    }
    
    // Créer la ressource Organization
    const organization = {
      resourceType: 'Organization',
      id: uuidv4(),
      identifier: []
    };
    
    // Extraire l'identifiant de l'organisation émettrice
    const sendingFacility = mshSegment.getField(4);
    if (sendingFacility && sendingFacility.value) {
      organization.identifier.push({
        system: 'urn:oid:1.2.250.1.71.4.2.2',  // OID pour FINESS en France
        value: sendingFacility.value.toString()
      });
      
      organization.name = sendingFacility.value.toString();
    }
    
    // Ajouter la ressource Organization au Bundle
    addResourceToBundle(bundle, organization);
    
  } catch (error) {
    console.error('[HL7_CONVERTER] Erreur lors de l\'extraction des données de l\'organisation:', error);
  }
}

/**
 * Extraire les informations de rencontre/séjour depuis le message HL7
 * @param {Object} parsedMessage - Message HL7 parsé
 * @param {Object} bundle - Bundle FHIR
 */
function extractEncounter(parsedMessage, bundle) {
  try {
    // Vérifier si nous avons un segment PV1 (Patient Visit)
    const pv1Segment = parsedMessage.getSegment('PV1');
    if (!pv1Segment) {
      return;
    }
    
    // Vérifier si le Bundle contient une ressource Patient
    const patientEntry = bundle.entry.find(entry => entry.resource.resourceType === 'Patient');
    if (!patientEntry) {
      return;
    }
    
    // Créer la ressource Encounter
    const encounter = {
      resourceType: 'Encounter',
      id: uuidv4(),
      status: 'in-progress',  // Par défaut
      class: {
        system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
        code: 'AMB',
        display: 'ambulatory'
      },
      subject: {
        reference: `Patient/${patientEntry.resource.id}`
      }
    };
    
    // Extraire le type d'admission
    const patientClass = pv1Segment.getField(2);
    if (patientClass && patientClass.value) {
      const classValue = patientClass.value.toString();
      // Mapper les codes de classe HL7 vers FHIR
      switch (classValue) {
        case 'I':
          encounter.class.code = 'IMP';
          encounter.class.display = 'inpatient';
          break;
        case 'O':
          encounter.class.code = 'AMB';
          encounter.class.display = 'ambulatory';
          break;
        case 'E':
          encounter.class.code = 'EMER';
          encounter.class.display = 'emergency';
          break;
        // Autres mappings possibles...
      }
    }
    
    // Extraire l'identifiant de la rencontre
    const visitNumber = pv1Segment.getField(19);
    if (visitNumber && visitNumber.value) {
      encounter.identifier = [{
        system: 'urn:oid:1.2.250.1.213.1.1.9',  // OID pour numéros de séjour
        value: visitNumber.value.toString()
      }];
    }
    
    // Extraire la date d'admission
    const admitDateTime = pv1Segment.getField(44);
    if (admitDateTime && admitDateTime.value) {
      const dateTimeStr = admitDateTime.value.toString();
      // Formater la date au format ISO
      if (dateTimeStr.length >= 14) {
        encounter.period = {
          start: `${dateTimeStr.substr(0, 4)}-${dateTimeStr.substr(4, 2)}-${dateTimeStr.substr(6, 2)}T${dateTimeStr.substr(8, 2)}:${dateTimeStr.substr(10, 2)}:${dateTimeStr.substr(12, 2)}+00:00`
        };
      }
    }
    
    // Extraire le statut
    const dischargeDisposition = pv1Segment.getField(36);
    if (dischargeDisposition && dischargeDisposition.value) {
      // Si on a une disposition de sortie, la rencontre est terminée
      encounter.status = 'finished';
    }
    
    // Lier au praticien si disponible
    const practitionerEntry = bundle.entry.find(entry => entry.resource.resourceType === 'Practitioner');
    if (practitionerEntry) {
      encounter.participant = [{
        individual: {
          reference: `Practitioner/${practitionerEntry.resource.id}`
        }
      }];
    }
    
    // Lier à l'organisation si disponible
    const organizationEntry = bundle.entry.find(entry => entry.resource.resourceType === 'Organization');
    if (organizationEntry) {
      encounter.serviceProvider = {
        reference: `Organization/${organizationEntry.resource.id}`
      };
    }
    
    // Ajouter la ressource Encounter au Bundle
    addResourceToBundle(bundle, encounter);
    
  } catch (error) {
    console.error('[HL7_CONVERTER] Erreur lors de l\'extraction des données de rencontre:', error);
  }
}

/**
 * Extraire les informations d'assurance depuis le message HL7
 * @param {Object} parsedMessage - Message HL7 parsé
 * @param {Object} bundle - Bundle FHIR
 */
function extractCoverage(parsedMessage, bundle) {
  try {
    // Vérifier si nous avons un segment IN1 (Insurance)
    const in1Segment = parsedMessage.getSegment('IN1');
    if (!in1Segment) {
      return;
    }
    
    // Vérifier si le Bundle contient une ressource Patient
    const patientEntry = bundle.entry.find(entry => entry.resource.resourceType === 'Patient');
    if (!patientEntry) {
      return;
    }
    
    // Créer la ressource Coverage
    const coverage = {
      resourceType: 'Coverage',
      id: uuidv4(),
      status: 'active',
      beneficiary: {
        reference: `Patient/${patientEntry.resource.id}`
      },
      relationship: {
        coding: [
          {
            system: 'http://terminology.hl7.org/CodeSystem/subscriber-relationship',
            code: 'self',
            display: 'Self'
          }
        ]
      }
    };
    
    // Extraire l'identifiant de l'assurance
    const insurancePlanId = in1Segment.getField(2);
    if (insurancePlanId && insurancePlanId.value) {
      coverage.identifier = [{
        system: 'urn:oid:1.2.250.1.213.4.1',  // OID pour régimes d'assurance en France
        value: insurancePlanId.value.toString()
      }];
    }
    
    // Extraire le nom de l'assurance
    const insuranceCompanyName = in1Segment.getField(4);
    if (insuranceCompanyName && insuranceCompanyName.value) {
      coverage.payor = [{
        display: insuranceCompanyName.value.toString()
      }];
    }
    
    // Extraire le numéro d'assuré
    const insuranceNumber = in1Segment.getField(36);
    if (insuranceNumber && insuranceNumber.value) {
      if (!coverage.identifier) {
        coverage.identifier = [];
      }
      
      coverage.identifier.push({
        system: 'urn:oid:1.2.250.1.213.1.4.2',  // OID pour numéros d'assuré social en France
        value: insuranceNumber.value.toString()
      });
    }
    
    // Ajouter la ressource Coverage au Bundle
    addResourceToBundle(bundle, coverage);
    
  } catch (error) {
    console.error('[HL7_CONVERTER] Erreur lors de l\'extraction des données d\'assurance:', error);
  }
}

module.exports = {
  convert
};