/**
 * Service de conversion HL7 vers FHIR
 */
import hl7 from 'simple-hl7';
import { v4 as uuidv4 } from 'uuid';

// Configuration du parseur HL7
const parser = new hl7.Parser();

/**
 * Convertit un message HL7 en ressource FHIR
 * 
 * @param hl7Message - Message HL7 à convertir
 * @returns Objet FHIR résultant de la conversion
 */
export function convertHL7ToFHIR(hl7Message: string): any {
  try {
    // Analyser le message HL7
    const parsedMessage = parser.parse(hl7Message);
    
    // Extraire les segments du message
    const segments = parsedMessage.segments;
    
    // Créer un bundle FHIR pour contenir toutes les ressources
    const fhirBundle = createFHIRBundle();
    
    // Traiter les segments du message HL7
    for (const segment of segments) {
      const segmentName = segment.name;
      
      switch (segmentName) {
        case 'MSH':
          processMessageHeader(segment, fhirBundle);
          break;
        case 'PID':
          processPatientIdentification(segment, fhirBundle);
          break;
        case 'PV1':
          processPatientVisit(segment, fhirBundle);
          break;
        case 'OBR':
          processObservationRequest(segment, fhirBundle);
          break;
        case 'OBX':
          processObservationResult(segment, fhirBundle);
          break;
        // Ajouter d'autres segments selon les besoins
      }
    }
    
    return fhirBundle;
  } catch (error: any) {
    throw new Error(`Erreur lors de la conversion HL7 vers FHIR: ${error.message}`);
  }
}

/**
 * Crée un bundle FHIR vide
 */
function createFHIRBundle(): any {
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
 * Traite le segment MSH (Message Header) du message HL7
 */
function processMessageHeader(segment: any, fhirBundle: any): void {
  const messageHeader = {
    resourceType: 'MessageHeader',
    id: uuidv4(),
    eventCoding: {
      system: 'http://terminology.hl7.org/CodeSystem/v2-0003',
      code: segment.getField(9).value[0][1].toString() || 'unknown',
      display: 'Message Type'
    },
    source: {
      name: segment.getField(3).value[0][0].toString() || 'Unknown Source',
      software: segment.getField(3).value[0][0].toString() || 'Unknown Software',
      version: segment.getField(12).toString() || '2.5',
      endpoint: `urn:oid:${segment.getField(4).toString() || '1.2.3.4'}`
    },
    timestamp: parseHL7Date(segment.getField(7).toString()) || new Date().toISOString()
  };
  
  addResourceToBundle(fhirBundle, messageHeader);
}

/**
 * Traite le segment PID (Patient Identification) du message HL7
 */
function processPatientIdentification(segment: any, fhirBundle: any): void {
  const patientId = segment.getField(3).toString() || uuidv4();
  
  const patient = {
    resourceType: 'Patient',
    id: patientId,
    identifier: [
      {
        system: 'urn:oid:1.2.250.1.213.1.4.8',
        value: segment.getField(3).toString() || 'Unknown'
      }
    ],
    name: [{
      family: segment.getField(5).value[0][0].toString() || 'Unknown',
      given: [segment.getField(5).value[0][1].toString() || 'Unknown']
    }],
    gender: mapGender(segment.getField(8).toString()),
    birthDate: parseHL7Date(segment.getField(7).toString())
  };
  
  // Ajouter l'adresse si disponible
  if (segment.getField(11).value && segment.getField(11).value.length > 0) {
    const address = {
      line: [
        segment.getField(11).value[0][0].toString() || '',
        segment.getField(11).value[0][1].toString() || ''
      ].filter(Boolean),
      city: segment.getField(11).value[0][2].toString() || '',
      postalCode: segment.getField(11).value[0][4].toString() || '',
      country: segment.getField(11).value[0][5].toString() || 'FR'
    };
    
    if (Object.values(address).some(val => val !== '')) {
      (patient as any).address = [address];
    }
  }
  
  // Ajouter le téléphone si disponible
  if (segment.getField(13).value && segment.getField(13).value.length > 0) {
    const phone = segment.getField(13).value[0][0].toString();
    if (phone) {
      (patient as any).telecom = [
        {
          system: 'phone',
          value: phone,
          use: 'home'
        }
      ];
    }
  }
  
  addResourceToBundle(fhirBundle, patient);
}

/**
 * Traite le segment PV1 (Patient Visit) du message HL7
 */
function processPatientVisit(segment: any, fhirBundle: any): void {
  const encounter = {
    resourceType: 'Encounter',
    id: uuidv4(),
    status: 'unknown',
    class: {
      system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
      code: 'AMB',
      display: 'ambulatory'
    },
    subject: {
      reference: `Patient/${fhirBundle.entry.find((e: any) => e.resource.resourceType === 'Patient')?.resource.id || 'unknown'}`
    },
    period: {
      start: parseHL7Date(segment.getField(44).toString())
    }
  };
  
  // Déterminer le statut de la visite
  const patientClass = segment.getField(2).toString();
  if (patientClass === 'I') {
    (encounter as any).status = 'in-progress';
    (encounter as any).class.code = 'IMP';
    (encounter as any).class.display = 'inpatient encounter';
  } else if (patientClass === 'O') {
    (encounter as any).status = 'finished';
    (encounter as any).class.code = 'AMB';
    (encounter as any).class.display = 'ambulatory';
  } else if (patientClass === 'E') {
    (encounter as any).status = 'in-progress';
    (encounter as any).class.code = 'EMER';
    (encounter as any).class.display = 'emergency';
  }
  
  addResourceToBundle(fhirBundle, encounter);
}

/**
 * Traite le segment OBR (Observation Request) du message HL7
 */
function processObservationRequest(segment: any, fhirBundle: any): void {
  const serviceRequest = {
    resourceType: 'ServiceRequest',
    id: uuidv4(),
    status: 'unknown',
    intent: 'order',
    subject: {
      reference: `Patient/${fhirBundle.entry.find((e: any) => e.resource.resourceType === 'Patient')?.resource.id || 'unknown'}`
    },
    encounter: {
      reference: `Encounter/${fhirBundle.entry.find((e: any) => e.resource.resourceType === 'Encounter')?.resource.id || 'unknown'}`
    },
    code: {
      coding: [
        {
          system: 'http://loinc.org',
          code: segment.getField(4).value[0][0].toString() || 'unknown',
          display: segment.getField(4).value[0][1].toString() || 'Unknown Test'
        }
      ]
    },
    authoredOn: parseHL7Date(segment.getField(6).toString())
  };
  
  addResourceToBundle(fhirBundle, serviceRequest);
}

/**
 * Traite le segment OBX (Observation Result) du message HL7
 */
function processObservationResult(segment: any, fhirBundle: any): void {
  const observation = {
    resourceType: 'Observation',
    id: uuidv4(),
    status: 'final',
    subject: {
      reference: `Patient/${fhirBundle.entry.find((e: any) => e.resource.resourceType === 'Patient')?.resource.id || 'unknown'}`
    },
    encounter: {
      reference: `Encounter/${fhirBundle.entry.find((e: any) => e.resource.resourceType === 'Encounter')?.resource.id || 'unknown'}`
    },
    code: {
      coding: [
        {
          system: 'http://loinc.org',
          code: segment.getField(3).value[0][0].toString() || 'unknown',
          display: segment.getField(3).value[0][1].toString() || 'Unknown Observation'
        }
      ]
    },
    effectiveDateTime: parseHL7Date(segment.getField(14).toString())
  };
  
  // Déterminer le type de valeur et l'ajouter
  const valueType = segment.getField(2).toString();
  const value = segment.getField(5).toString();
  
  if (value) {
    if (['NM', 'SN'].includes(valueType)) {
      (observation as any).valueQuantity = {
        value: parseFloat(value),
        unit: segment.getField(6).value ? segment.getField(6).value[0][0].toString() : '',
        system: 'http://unitsofmeasure.org',
        code: segment.getField(6).value ? segment.getField(6).value[0][0].toString() : ''
      };
    } else if (valueType === 'ST' || valueType === 'TX') {
      (observation as any).valueString = value;
    } else if (valueType === 'CWE' || valueType === 'CE') {
      (observation as any).valueCodeableConcept = {
        coding: [
          {
            system: 'http://terminology.hl7.org/CodeSystem/v2-0078',
            code: value,
            display: segment.getField(5).value ? segment.getField(5).value[0][1].toString() : ''
          }
        ]
      };
    }
  }
  
  addResourceToBundle(fhirBundle, observation);
}

/**
 * Ajoute une ressource au bundle FHIR
 */
function addResourceToBundle(bundle: any, resource: any): void {
  bundle.entry.push({
    fullUrl: `urn:uuid:${resource.id}`,
    resource,
    request: {
      method: 'POST',
      url: resource.resourceType
    }
  });
}

/**
 * Parse une date HL7 en format ISO 8601
 */
function parseHL7Date(hl7Date: string): string | undefined {
  if (!hl7Date) return undefined;

  // Format typique: YYYYMMDDHHMMSS
  const regex = /^(\d{4})(\d{2})(\d{2})(\d{2})?(\d{2})?(\d{2})?/;
  const match = hl7Date.match(regex);
  
  if (!match) return undefined;
  
  const year = match[1];
  const month = match[2];
  const day = match[3];
  const hour = match[4] || '00';
  const minute = match[5] || '00';
  const second = match[6] || '00';
  
  try {
    const date = new Date(
      parseInt(year, 10),
      parseInt(month, 10) - 1, // Les mois sont indexés à partir de 0 en JS
      parseInt(day, 10),
      parseInt(hour, 10),
      parseInt(minute, 10),
      parseInt(second, 10)
    );
    
    return date.toISOString();
  } catch (e) {
    return undefined;
  }
}

/**
 * Convertit le code de genre HL7 en code de genre FHIR
 */
function mapGender(hl7Gender: string): string {
  switch (hl7Gender.toUpperCase()) {
    case 'M':
      return 'male';
    case 'F':
      return 'female';
    case 'O':
      return 'other';
    case 'U':
      return 'unknown';
    case 'A':
      return 'other'; // Ambigüe
    case 'N':
      return 'other'; // Non applicable
    default:
      return 'unknown';
  }
}

/**
 * Vérifie si une chaîne est un message HL7 valide
 * 
 * @param message - Message à vérifier
 * @returns true si le message est un message HL7 valide
 */
export function isValidHL7(message: string): boolean {
  try {
    // Un message HL7 doit commencer par MSH
    if (!message.trim().startsWith('MSH')) {
      return false;
    }
    
    // Essayer de parser le message
    parser.parse(message);
    
    return true;
  } catch (error) {
    return false;
  }
}