/**
 * Proxy du convertisseur HL7 vers FHIR
 * Ce fichier assure la rétrocompatibilité avec l'ancien système
 * en redirigeant les appels vers le nouveau module de conversion
 */

const convertHL7ToFHIR = require('./src/services/hl7ToFhirConverter');

// Export pour maintenir la compatibilité avec l'ancien code
module.exports = convertHL7ToFHIR;
