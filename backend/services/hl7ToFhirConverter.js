/**
 * HL7-to-FHIR converter service
 * This service handles the conversion of HL7 v2.5 messages to FHIR R4 format
 */
const fs = require('fs').promises;
const path = require('path');
const config = require('../config');

/**
 * Convert HL7 v2.5 message to FHIR R4
 * @param {string} hl7Message - HL7 v2.5 message content
 * @returns {Object} Result object with success flag and FHIR data or error
 */
async function convertHl7ToFhir(hl7Message) {
  try {
    // Since we can't use the HAPI FHIR Converter directly from JavaScript,
    // we'll implement a manual mapping function
    const result = convertHl7ToFhirManually(hl7Message);
    
    if (result.success) {
      return {
        success: true,
        data: result.data,
        message: 'Conversion completed successfully'
      };
    } else {
      return {
        success: false,
        error: result.error || 'Unknown conversion error',
        message: 'Conversion failed'
      };
    }
  } catch (error) {
    console.error('HL7 to FHIR conversion error:', error);
    return {
      success: false,
      error: error.message || 'Unexpected error during conversion',
      message: 'Conversion failed with an exception'
    };
  }
}

/**
 * Alternative conversion method using hl7v2 parser and custom mapping
 * This is a fallback if the HAPI FHIR converter doesn't work as expected
 * @param {string} hl7Message - HL7 v2.5 message content
 * @returns {Object} Result object with success flag and FHIR data or error
 */
function convertHl7ToFhirManually(hl7Message) {
  try {
    // Parse the HL7 message
    const segments = hl7Message.split('\\r\\n');
    let msgData = {};
    
    // Process the message segment by segment
    segments.forEach(segment => {
      const fields = segment.split('|');
      const segmentType = fields[0];
      
      if (segmentType === 'MSH') {
        // Message Header segment
        msgData.sendingApp = fields[3];
        msgData.sendingFacility = fields[4];
        msgData.receivingApp = fields[5];
        msgData.receivingFacility = fields[6];
        msgData.messageTime = fields[7];
        msgData.messageType = fields[9];
        msgData.messageControlId = fields[10];
      } else if (segmentType === 'PID') {
        // Patient Identification segment
        const patientIdComponents = fields[3].split('^');
        const patientNameComponents = fields[5].split('^');
        const addressComponents = fields[11].split('^');
        
        msgData.patientId = patientIdComponents[0];
        msgData.patientLastName = patientNameComponents[0];
        msgData.patientFirstName = patientNameComponents[1];
        msgData.gender = fields[8];
        msgData.birthDate = fields[7];
        msgData.address = {
          line: addressComponents[0],
          city: addressComponents[2],
          state: addressComponents[3],
          postalCode: addressComponents[4],
          country: addressComponents[5]
        };
        msgData.phoneNumber = fields[13];
      } else if (segmentType === 'OBR') {
        // Observation Request segment
        msgData.orderNumber = fields[3];
        msgData.orderDateTime = fields[7];
        msgData.observationDateTime = fields[8];
        msgData.orderingProvider = fields[16];
        msgData.reason = fields[31];
      } else if (segmentType === 'OBX') {
        // Observation segment
        if (!msgData.observations) {
          msgData.observations = [];
        }
        
        msgData.observations.push({
          setId: fields[1],
          valueType: fields[2],
          observationId: fields[3],
          observationValue: fields[5],
          units: fields[6],
          referenceRange: fields[7],
          abnormalFlags: fields[8],
          observationDateTime: fields[14]
        });
      }
    });
    
    // Convert parsed HL7 data to FHIR format
    const fhirData = mapToFhirResources(msgData);
    
    return {
      success: true,
      data: fhirData
    };
  } catch (error) {
    console.error('Manual HL7 to FHIR conversion error:', error);
    return {
      success: false,
      error: error.message || 'Error in manual conversion'
    };
  }
}

/**
 * Map the parsed HL7 data to FHIR resources
 * @param {Object} hl7Data - Parsed HL7 message data
 * @returns {Object} FHIR Bundle containing resources
 */
function mapToFhirResources(hl7Data) {
  // Create a FHIR Bundle
  const bundle = {
    resourceType: 'Bundle',
    type: 'transaction',
    entry: []
  };
  
  // Add Patient resource
  const patientResource = {
    resourceType: 'Patient',
    id: `patient-${hl7Data.patientId}`,
    identifier: [{
      system: 'http://example.org/fhir/identifier/mrn',
      value: hl7Data.patientId
    }],
    name: [{
      family: hl7Data.patientLastName || 'Unknown',
      given: [hl7Data.patientFirstName || 'Unknown']
    }],
    gender: mapGender(hl7Data.gender),
    birthDate: formatDate(hl7Data.birthDate)
  };
  
  // Add address if available
  if (hl7Data.address) {
    patientResource.address = [{
      line: [hl7Data.address.line],
      city: hl7Data.address.city,
      state: hl7Data.address.state,
      postalCode: hl7Data.address.postalCode,
      country: hl7Data.address.country
    }];
  }
  
  // Add telecom if available
  if (hl7Data.phoneNumber) {
    patientResource.telecom = [{
      system: 'phone',
      value: hl7Data.phoneNumber,
      use: 'home'
    }];
  }
  
  // Add Patient to Bundle
  bundle.entry.push({
    fullUrl: `urn:uuid:${patientResource.id}`,
    resource: patientResource,
    request: {
      method: 'PUT',
      url: `Patient/${patientResource.id}`
    }
  });
  
  // Add ServiceRequest resource if order information exists
  if (hl7Data.orderNumber) {
    const serviceRequest = {
      resourceType: 'ServiceRequest',
      id: `servicerequest-${hl7Data.orderNumber}`,
      status: 'active',
      intent: 'order',
      subject: {
        reference: `Patient/${patientResource.id}`
      },
      authoredOn: formatDate(hl7Data.orderDateTime),
      requester: {
        display: hl7Data.orderingProvider
      }
    };
    
    // Add reason for order if available
    if (hl7Data.reason) {
      serviceRequest.reasonCode = [{
        text: hl7Data.reason
      }];
    }
    
    bundle.entry.push({
      fullUrl: `urn:uuid:${serviceRequest.id}`,
      resource: serviceRequest,
      request: {
        method: 'PUT',
        url: `ServiceRequest/${serviceRequest.id}`
      }
    });
  }
  
  // Add Observation resources if observations exist
  if (hl7Data.observations && hl7Data.observations.length > 0) {
    hl7Data.observations.forEach((obs, index) => {
      const observation = {
        resourceType: 'Observation',
        id: `observation-${hl7Data.patientId}-${index}`,
        status: 'final',
        code: {
          text: obs.observationId
        },
        subject: {
          reference: `Patient/${patientResource.id}`
        },
        effectiveDateTime: formatDate(obs.observationDateTime) || formatDate(hl7Data.observationDateTime),
        issued: formatDate(obs.observationDateTime) || formatDate(hl7Data.observationDateTime)
      };
      
      // Add value based on the value type
      if (obs.valueType === 'NM' || obs.valueType === 'SN') {
        // Numeric value
        observation.valueQuantity = {
          value: parseFloat(obs.observationValue),
          unit: obs.units,
          system: 'http://unitsofmeasure.org',
          code: obs.units
        };
      } else if (obs.valueType === 'ST' || obs.valueType === 'TX') {
        // String or text value
        observation.valueString = obs.observationValue;
      } else if (obs.valueType === 'CE') {
        // Coded entry
        observation.valueCodeableConcept = {
          text: obs.observationValue
        };
      } else {
        // Default to string
        observation.valueString = obs.observationValue;
      }
      
      // Add reference range if available
      if (obs.referenceRange) {
        observation.referenceRange = [{
          text: obs.referenceRange
        }];
      }
      
      // Add interpretation (abnormal flags) if available
      if (obs.abnormalFlags) {
        observation.interpretation = [{
          text: obs.abnormalFlags
        }];
      }
      
      bundle.entry.push({
        fullUrl: `urn:uuid:${observation.id}`,
        resource: observation,
        request: {
          method: 'PUT',
          url: `Observation/${observation.id}`
        }
      });
    });
  }
  
  return bundle;
}

/**
 * Map HL7 gender codes to FHIR gender values
 * @param {string} hl7Gender - HL7 gender code
 * @returns {string} FHIR gender code
 */
function mapGender(hl7Gender) {
  const genderMap = {
    'M': 'male',
    'F': 'female',
    'O': 'other',
    'A': 'other',
    'N': 'unknown',
    'U': 'unknown'
  };
  
  return genderMap[hl7Gender] || 'unknown';
}

/**
 * Format HL7 dates to FHIR ISO format
 * @param {string} hl7Date - HL7 date in various formats
 * @returns {string} ISO formatted date string or null if invalid
 */
function formatDate(hl7Date) {
  if (!hl7Date) return null;
  
  try {
    // Handle HL7 format YYYYMMDD
    if (hl7Date.length === 8) {
      return `${hl7Date.substring(0, 4)}-${hl7Date.substring(4, 6)}-${hl7Date.substring(6, 8)}`;
    }
    
    // Handle HL7 format YYYYMMDDHHMMSS
    if (hl7Date.length === 14) {
      return `${hl7Date.substring(0, 4)}-${hl7Date.substring(4, 6)}-${hl7Date.substring(6, 8)}T` +
             `${hl7Date.substring(8, 10)}:${hl7Date.substring(10, 12)}:${hl7Date.substring(12, 14)}+00:00`;
    }
    
    // Try to parse as ISO date
    const date = new Date(hl7Date);
    if (!isNaN(date.getTime())) {
      return date.toISOString();
    }
    
    return null;
  } catch (error) {
    console.error('Date parsing error:', error);
    return null;
  }
}

/**
 * Attempt conversion using primary method, fallback to secondary if necessary
 * @param {string} hl7Message - HL7 v2.5 message content
 * @returns {Object} Conversion result
 */
async function convertWithFallback(hl7Message) {
  // We're only using the manual conversion for now
  return await convertHl7ToFhir(hl7Message);
}

module.exports = {
  convertHl7ToFhir,
  convertWithFallback
};