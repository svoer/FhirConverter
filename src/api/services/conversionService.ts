/**
 * Service de conversion HL7 vers FHIR
 * Basé sur les librairies simple-hl7 et fhir
 */

import * as simpleHL7 from 'simple-hl7';
import * as fhir from 'fhir';

// Initialisation du parser HL7
const hl7Parser = new simpleHL7.Parser();

// Version simplifiée pour la validation sans utiliser Validator
class SimpleValidator {
  validate(message: any): boolean {
    // Vérification basique : présence du segment MSH
    return message && message.segments && message.segments.length > 0 && 
           message.segments[0] && message.segments[0].name === 'MSH';
  }
}

const hl7Validator = new SimpleValidator();

/**
 * Vérifie si un message HL7 est valide
 * @param hl7Message Message HL7 à valider
 * @returns True si le message est valide, sinon False
 */
export function isValidHL7(hl7Message: string): boolean {
  try {
    // Vérification basique de la structure du message
    if (!hl7Message.includes('MSH|')) {
      return false;
    }
    
    // Essayer de parser le message
    const parsedMessage = hl7Parser.parse(hl7Message);
    return hl7Validator.validate(parsedMessage);
  } catch (error) {
    console.error('[HL7 Validation Error]', error);
    return false;
  }
}

/**
 * Convertit un message HL7 v2.5 en ressource FHIR R4
 * @param hl7Message Message HL7 à convertir
 * @returns Ressource FHIR générée
 */
export function convertHL7ToFHIR(hl7Message: string): any {
  // Parser le message HL7
  const parsedHL7 = hl7Parser.parse(hl7Message);
  
  // Extraire les segments
  // Adapter au format de simple-hl7
  const segments = parsedHL7.segments;
  const mshSegment = segments.find((s: any) => s.name === 'MSH');
  const evnSegment = segments.find((s: any) => s.name === 'EVN');
  const pidSegments = segments.filter((s: any) => s.name === 'PID');
  const pd1Segments = segments.filter((s: any) => s.name === 'PD1');
  const pv1Segments = segments.filter((s: any) => s.name === 'PV1');
  const pv2Segments = segments.filter((s: any) => s.name === 'PV2');
  
  // Extraire les informations du patient (PID)
  const patientResource = createPatientResource(pidSegments[0], pd1Segments[0]);
  
  // Extraire les informations de l'encounter (PV1/PV2)
  const encounterResource = createEncounterResource(pv1Segments[0], pv2Segments[0], patientResource.id);
  
  // Créer le bundle FHIR
  const fhirBundle = createFHIRBundle([patientResource, encounterResource], mshSegment);
  
  return fhirBundle;
}

/**
 * Crée une ressource Patient FHIR à partir d'un segment PID HL7
 * @param pidSegment Segment PID du message HL7
 * @param pd1Segment Segment PD1 du message HL7 (optionnel)
 * @returns Ressource Patient FHIR
 */
function createPatientResource(pidSegment: any, pd1Segment?: any): any {
  if (!pidSegment) {
    throw new Error('Segment PID manquant dans le message HL7');
  }
  
  // Générer un identifiant unique pour le patient
  const patientId = `patient-${Date.now()}`;
  
  // Extraire les informations du patient
  const patientIdentifier = extractPatientIdentifier(pidSegment);
  const patientName = extractPatientName(pidSegment);
  const patientBirthDate = extractPatientBirthDate(pidSegment);
  const patientGender = extractPatientGender(pidSegment);
  const patientAddress = extractPatientAddress(pidSegment);
  const patientContact = extractPatientContact(pidSegment);
  
  // Créer la ressource Patient FHIR
  const patientResource = {
    resourceType: 'Patient',
    id: patientId,
    identifier: patientIdentifier,
    name: patientName,
    birthDate: patientBirthDate,
    gender: patientGender,
    address: patientAddress,
    telecom: patientContact,
    active: true
  };
  
  // Ajouter le médecin traitant si présent dans PD1
  if (pd1Segment) {
    const primaryPhysician = extractPrimaryPhysician(pd1Segment);
    if (primaryPhysician) {
      patientResource['generalPractitioner'] = [primaryPhysician];
    }
  }
  
  return patientResource;
}

/**
 * Crée une ressource Encounter FHIR à partir d'un segment PV1 HL7
 * @param pv1Segment Segment PV1 du message HL7
 * @param pv2Segment Segment PV2 du message HL7 (optionnel)
 * @param patientId Identifiant de la ressource Patient associée
 * @returns Ressource Encounter FHIR
 */
function createEncounterResource(pv1Segment: any, pv2Segment?: any, patientId?: string): any {
  if (!pv1Segment) {
    throw new Error('Segment PV1 manquant dans le message HL7');
  }
  
  // Générer un identifiant unique pour l'encounter
  const encounterId = `encounter-${Date.now()}`;
  
  // Extraire les informations de l'encounter
  const encounterClass = extractEncounterClass(pv1Segment);
  const encounterType = extractEncounterType(pv1Segment, pv2Segment);
  const encounterStatus = extractEncounterStatus(pv1Segment);
  const encounterPeriod = extractEncounterPeriod(pv1Segment);
  const encounterLocation = extractEncounterLocation(pv1Segment);
  const encounterParticipants = extractEncounterParticipants(pv1Segment);
  
  // Créer la ressource Encounter FHIR
  const encounterResource = {
    resourceType: 'Encounter',
    id: encounterId,
    status: encounterStatus,
    class: encounterClass,
    type: encounterType,
    subject: {
      reference: patientId ? `Patient/${patientId}` : undefined
    },
    period: encounterPeriod,
    location: encounterLocation,
    participant: encounterParticipants
  };
  
  return encounterResource;
}

/**
 * Crée un Bundle FHIR à partir d'une liste de ressources
 * @param resources Liste des ressources FHIR à inclure dans le bundle
 * @param mshSegment Segment MSH du message HL7 d'origine (pour les métadonnées)
 * @returns Bundle FHIR
 */
function createFHIRBundle(resources: any[], mshSegment: any): any {
  // Générer un identifiant unique pour le bundle
  const bundleId = `bundle-${Date.now()}`;
  
  // Extraire les métadonnées du MSH
  const messageId = mshSegment.getField(10)?.toString() || `msg-${Date.now()}`;
  const messageDatetime = mshSegment.getField(7)?.toString() || new Date().toISOString();
  
  // Créer les entrées du bundle
  const entries = resources.map(resource => ({
    fullUrl: `urn:uuid:${resource.id}`,
    resource: resource,
    request: {
      method: 'POST',
      url: resource.resourceType
    }
  }));
  
  // Créer le bundle FHIR
  const fhirBundle = {
    resourceType: 'Bundle',
    id: bundleId,
    type: 'transaction',
    timestamp: new Date().toISOString(),
    meta: {
      lastUpdated: new Date().toISOString(),
      profile: ['http://esante.gouv.fr/ci-sis/fhir/StructureDefinition/FrBundle']
    },
    identifier: {
      system: 'urn:ietf:rfc:3986',
      value: `urn:uuid:${messageId}`
    },
    entry: entries
  };
  
  return fhirBundle;
}

// === Fonctions d'extraction pour Patient ===

function extractPatientIdentifier(pidSegment: any): any[] {
  try {
    const identifiers = [];
    
    // Identifiant principal (Field 3)
    const field3 = pidSegment.getField(3);
    if (field3 && field3.length > 0) {
      const id = field3.getComponent(0)?.toString();
      const system = field3.getComponent(3)?.toString() || 'urn:oid:1.2.250.1.213.1.4.10';
      
      if (id) {
        identifiers.push({
          use: 'official',
          system: system,
          value: id
        });
      }
    }
    
    // Numéro de sécurité sociale (Field 19)
    const field19 = pidSegment.getField(19);
    if (field19 && field19.length > 0) {
      const insuranceNumber = field19.getComponent(0)?.toString();
      
      if (insuranceNumber) {
        identifiers.push({
          use: 'official',
          system: 'urn:oid:1.2.250.1.213.1.4.8',
          value: insuranceNumber,
          type: {
            coding: [{
              system: 'http://terminology.hl7.org/CodeSystem/v2-0203',
              code: 'SS',
              display: 'Numéro de sécurité sociale'
            }]
          }
        });
      }
    }
    
    return identifiers;
  } catch (error) {
    console.error('[PatientIdentifier Error]', error);
    return [];
  }
}

function extractPatientName(pidSegment: any): any[] {
  try {
    const names = [];
    
    // Champ 5 - Nom et prénom du patient
    const field5 = pidSegment.getField(5);
    if (field5 && field5.length > 0) {
      const familyName = field5.getComponent(0)?.toString();
      const givenName = field5.getComponent(1)?.toString();
      
      if (familyName) {
        const nameParts = [];
        
        // Gérer les prénoms composés (spécifique à la France)
        if (givenName) {
          const givenNames = givenName.split(' ').filter(Boolean);
          nameParts.push(...givenNames);
        }
        
        names.push({
          use: 'official',
          family: familyName,
          given: nameParts.length > 0 ? nameParts : undefined,
          prefix: field5.getComponent(4)?.toString() ? [field5.getComponent(4).toString()] : undefined
        });
      }
    }
    
    return names;
  } catch (error) {
    console.error('[PatientName Error]', error);
    return [];
  }
}

function extractPatientBirthDate(pidSegment: any): string | undefined {
  try {
    // Champ 7 - Date de naissance
    const field7 = pidSegment.getField(7);
    if (field7 && field7.toString()) {
      const birthDate = field7.toString();
      
      // Formater en YYYY-MM-DD (format FHIR)
      if (birthDate.length >= 8) {
        const year = birthDate.substring(0, 4);
        const month = birthDate.substring(4, 6);
        const day = birthDate.substring(6, 8);
        return `${year}-${month}-${day}`;
      }
    }
    
    return undefined;
  } catch (error) {
    console.error('[PatientBirthDate Error]', error);
    return undefined;
  }
}

function extractPatientGender(pidSegment: any): string | undefined {
  try {
    // Champ 8 - Genre
    const field8 = pidSegment.getField(8);
    if (field8 && field8.toString()) {
      const gender = field8.toString();
      
      // Convertir le code HL7 en code FHIR
      switch (gender) {
        case 'M': return 'male';
        case 'F': return 'female';
        case 'O': return 'other';
        case 'U': return 'unknown';
        default: return 'unknown';
      }
    }
    
    return undefined;
  } catch (error) {
    console.error('[PatientGender Error]', error);
    return undefined;
  }
}

function extractPatientAddress(pidSegment: any): any[] {
  try {
    const addresses = [];
    
    // Champ 11 - Adresse du patient
    const field11 = pidSegment.getField(11);
    if (field11 && field11.length > 0) {
      const street = field11.getComponent(0)?.toString();
      const city = field11.getComponent(2)?.toString();
      const postalCode = field11.getComponent(4)?.toString();
      const country = field11.getComponent(5)?.toString();
      
      if (street || city || postalCode) {
        addresses.push({
          use: 'home',
          type: 'physical',
          line: street ? [street] : undefined,
          city: city,
          postalCode: postalCode,
          country: country || 'FRA'
        });
      }
    }
    
    return addresses;
  } catch (error) {
    console.error('[PatientAddress Error]', error);
    return [];
  }
}

function extractPatientContact(pidSegment: any): any[] {
  try {
    const telecoms = [];
    
    // Champ 13 - Téléphone et email
    const field13 = pidSegment.getField(13);
    if (field13 && field13.toString()) {
      const contactInfo = field13.toString().split('~');
      
      contactInfo.forEach(contact => {
        if (contact.includes('@')) {
          // Email
          telecoms.push({
            system: 'email',
            value: contact,
            use: 'home'
          });
        } else if (contact.match(/\d+/)) {
          // Téléphone
          let system = 'phone';
          let use = 'home';
          
          if (contact.includes('6') || contact.includes('7')) {
            // Téléphone mobile en France (commence souvent par 06 ou 07)
            system = 'phone';
            use = 'mobile';
          }
          
          telecoms.push({
            system: system,
            value: contact,
            use: use
          });
        }
      });
    }
    
    return telecoms;
  } catch (error) {
    console.error('[PatientContact Error]', error);
    return [];
  }
}

function extractPrimaryPhysician(pd1Segment: any): any | undefined {
  try {
    // Champ 4 - Médecin traitant
    const field4 = pd1Segment.getField(4);
    if (field4 && field4.toString()) {
      const physicianId = field4.getComponent(0)?.toString();
      const physicianName = field4.getComponent(2)?.toString();
      
      if (physicianId || physicianName) {
        return {
          reference: physicianId ? `Practitioner/${physicianId}` : undefined,
          display: physicianName || 'Médecin traitant'
        };
      }
    }
    
    return undefined;
  } catch (error) {
    console.error('[PrimaryPhysician Error]', error);
    return undefined;
  }
}

// === Fonctions d'extraction pour Encounter ===

function extractEncounterClass(pv1Segment: any): any {
  try {
    // Champ 2 - Type d'admission
    const field2 = pv1Segment.getField(2);
    if (field2 && field2.toString()) {
      const patientClass = field2.toString();
      
      // Convertir le code HL7 en code FHIR
      const classCoding = {
        system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode'
      };
      
      switch (patientClass) {
        case 'I': 
          return { coding: [{ ...classCoding, code: 'IMP', display: 'inpatient' }] };
        case 'O': 
          return { coding: [{ ...classCoding, code: 'AMB', display: 'ambulatory' }] };
        case 'E': 
          return { coding: [{ ...classCoding, code: 'EMER', display: 'emergency' }] };
        case 'P': 
          return { coding: [{ ...classCoding, code: 'PRENC', display: 'pre-admission' }] };
        case 'R': 
          return { coding: [{ ...classCoding, code: 'ACUTE', display: 'recurring patient' }] };
        case 'B': 
          return { coding: [{ ...classCoding, code: 'OBSENC', display: 'obstetrics' }] };
        case 'C': 
          return { coding: [{ ...classCoding, code: 'SS', display: 'day medicine' }] };
        case 'N': 
          return { coding: [{ ...classCoding, code: 'NONAC', display: 'non-acute' }] };
        default:
          return { coding: [{ ...classCoding, code: 'AMB', display: 'ambulatory' }] };
      }
    }
    
    return { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode', code: 'AMB', display: 'ambulatory' }] };
  } catch (error) {
    console.error('[EncounterClass Error]', error);
    return { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode', code: 'AMB', display: 'ambulatory' }] };
  }
}

function extractEncounterType(pv1Segment: any, pv2Segment?: any): any[] {
  try {
    const types = [];
    
    // PV1 Champ 10 - Type d'hospitalisation
    const field10 = pv1Segment.getField(10);
    if (field10 && field10.toString()) {
      const encounterType = field10.toString();
      
      types.push({
        coding: [{
          system: 'http://terminology.hl7.org/CodeSystem/v2-0007',
          code: encounterType,
          display: getEncounterTypeDisplay(encounterType)
        }]
      });
    }
    
    // PV2 Champ 3 - Motif d'admission
    if (pv2Segment) {
      const field3 = pv2Segment.getField(3);
      if (field3 && field3.toString()) {
        const admissionReason = field3.toString();
        
        types.push({
          text: admissionReason
        });
      }
    }
    
    return types;
  } catch (error) {
    console.error('[EncounterType Error]', error);
    return [];
  }
}

function getEncounterTypeDisplay(typeCode: string): string {
  switch (typeCode) {
    case 'A': return 'Accident';
    case 'E': return 'Urgence';
    case 'L': return 'Consultation';
    case 'R': return 'Consultation de routine';
    case 'C': return 'Contrôle';
    case 'G': return 'Grossesse';
    case 'N': return 'Naissance';
    case 'S': return 'Chirurgie';
    case 'O': return 'Autre';
    default: return 'Non spécifié';
  }
}

function extractEncounterStatus(pv1Segment: any): string {
  try {
    // On pourrait dériver cela d'autres champs, mais par défaut on met "in-progress"
    // car la plupart des messages ADT concernent des admissions en cours
    return 'in-progress';
  } catch (error) {
    console.error('[EncounterStatus Error]', error);
    return 'unknown';
  }
}

function extractEncounterPeriod(pv1Segment: any): any {
  try {
    const period: any = {};
    
    // Champ 44 - Date d'admission
    const field44 = pv1Segment.getField(44);
    if (field44 && field44.toString()) {
      const admitDate = field44.toString();
      
      // Formater en YYYY-MM-DDTHH:mm:ss+TZ (format FHIR)
      if (admitDate.length >= 8) {
        const year = admitDate.substring(0, 4);
        const month = admitDate.substring(4, 6);
        const day = admitDate.substring(6, 8);
        let time = 'T00:00:00+00:00';
        
        if (admitDate.length >= 14) {
          const hour = admitDate.substring(8, 10);
          const minute = admitDate.substring(10, 12);
          const second = admitDate.substring(12, 14);
          time = `T${hour}:${minute}:${second}+00:00`;
        }
        
        period.start = `${year}-${month}-${day}${time}`;
      }
    }
    
    // Champ 45 - Date de sortie
    const field45 = pv1Segment.getField(45);
    if (field45 && field45.toString()) {
      const dischargeDate = field45.toString();
      
      // Formater en YYYY-MM-DDTHH:mm:ss+TZ (format FHIR)
      if (dischargeDate.length >= 8) {
        const year = dischargeDate.substring(0, 4);
        const month = dischargeDate.substring(4, 6);
        const day = dischargeDate.substring(6, 8);
        let time = 'T00:00:00+00:00';
        
        if (dischargeDate.length >= 14) {
          const hour = dischargeDate.substring(8, 10);
          const minute = dischargeDate.substring(10, 12);
          const second = dischargeDate.substring(12, 14);
          time = `T${hour}:${minute}:${second}+00:00`;
        }
        
        period.end = `${year}-${month}-${day}${time}`;
      }
    }
    
    return Object.keys(period).length ? period : undefined;
  } catch (error) {
    console.error('[EncounterPeriod Error]', error);
    return undefined;
  }
}

function extractEncounterLocation(pv1Segment: any): any[] {
  try {
    const locations = [];
    
    // Champ 3 - Localisation du patient
    const field3 = pv1Segment.getField(3);
    if (field3 && field3.length > 0) {
      const point = field3.getComponent(0)?.toString();
      const room = field3.getComponent(1)?.toString();
      const bed = field3.getComponent(2)?.toString();
      const facility = field3.getComponent(3)?.toString();
      
      if (point || room || bed || facility) {
        let locationDisplay = '';
        
        if (facility) locationDisplay += facility;
        if (point) locationDisplay += (locationDisplay ? ' - ' : '') + 'Service: ' + point;
        if (room) locationDisplay += (locationDisplay ? ', ' : '') + 'Chambre: ' + room;
        if (bed) locationDisplay += (locationDisplay ? ', ' : '') + 'Lit: ' + bed;
        
        locations.push({
          status: 'active',
          location: {
            reference: `Location/${point || 'unknown'}`,
            display: locationDisplay || 'Emplacement non spécifié'
          }
        });
      }
    }
    
    return locations;
  } catch (error) {
    console.error('[EncounterLocation Error]', error);
    return [];
  }
}

function extractEncounterParticipants(pv1Segment: any): any[] {
  try {
    const participants = [];
    
    // Champ 7 - Médecin référent
    const field7 = pv1Segment.getField(7);
    if (field7 && field7.length > 0) {
      const id = field7.getComponent(0)?.toString();
      const lastName = field7.getComponent(1)?.toString();
      const firstName = field7.getComponent(2)?.toString();
      const title = field7.getComponent(5)?.toString();
      
      if (id || lastName) {
        let display = '';
        
        if (title) display += title + ' ';
        if (lastName) display += lastName;
        if (firstName) display += ' ' + firstName;
        
        participants.push({
          type: [{
            coding: [{
              system: 'http://terminology.hl7.org/CodeSystem/v3-ParticipationType',
              code: 'ATND',
              display: 'Médecin responsable'
            }]
          }],
          individual: {
            reference: id ? `Practitioner/${id}` : undefined,
            display: display || 'Médecin référent'
          }
        });
      }
    }
    
    // Champ 8 - Médecin consultant
    const field8 = pv1Segment.getField(8);
    if (field8 && field8.length > 0) {
      const id = field8.getComponent(0)?.toString();
      const lastName = field8.getComponent(1)?.toString();
      const firstName = field8.getComponent(2)?.toString();
      const title = field8.getComponent(5)?.toString();
      
      if (id || lastName) {
        let display = '';
        
        if (title) display += title + ' ';
        if (lastName) display += lastName;
        if (firstName) display += ' ' + firstName;
        
        participants.push({
          type: [{
            coding: [{
              system: 'http://terminology.hl7.org/CodeSystem/v3-ParticipationType',
              code: 'CON',
              display: 'Médecin consultant'
            }]
          }],
          individual: {
            reference: id ? `Practitioner/${id}` : undefined,
            display: display || 'Médecin consultant'
          }
        });
      }
    }
    
    return participants;
  } catch (error) {
    console.error('[EncounterParticipants Error]', error);
    return [];
  }
}

/**
 * Journalise une conversion HL7 vers FHIR
 * @param apiKeyId Identifiant de la clé API utilisée
 * @param sourceFormat Format source (HL7v2.5)
 * @param sourceContent Contenu source (message HL7)
 * @param resultContent Contenu résultat (JSON FHIR)
 * @param status Statut de la conversion (success, error, warning)
 * @param processingTime Temps de traitement en ms
 * @param errorMessage Message d'erreur (si applicable)
 */
export function logConversion(
  apiKeyId: number | string,
  sourceFormat: string,
  sourceContent: string,
  resultContent: string,
  status: 'success' | 'error' | 'warning',
  processingTime: number,
  errorMessage?: string
): void {
  // Cette fonction sera implémentée ultérieurement pour enregistrer les logs dans la BDD
  console.log(`[CONVERSION LOG] API Key: ${apiKeyId}, Status: ${status}, Time: ${processingTime}ms`);
  
  if (status === 'error' && errorMessage) {
    console.error(`[CONVERSION ERROR] ${errorMessage}`);
  }
}