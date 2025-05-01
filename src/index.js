/**
 * FHIRHub - Convertisseur HL7 v2.5 vers FHIR R4
 * 
 * Point d'entrée principal de l'application
 * Expose les fonctionnalités nécessaires pour le convertisseur
 */

// const HL7ToFHIRConverter = require('./converters/HL7ToFHIRConverter');
// Note: Ce chemin doit correspondre exactement au nom du fichier tel qu'il existe sur le disque
// Utiliser le nom de fichier en minuscules pour assurer la compatibilité Linux
const HL7ToFHIRConverter = require('./converters/hl7ToFhirConverter');
const FrenchTerminologyAdapter = require('./terminology/FrenchTerminologyAdapter');

// Exporter tout ce qui est nécessaire
module.exports = {
  // Conversions
  convertHL7ToFHIR: HL7ToFHIRConverter.convertHL7ToFHIR,
  
  // Terminologie
  frenchTerminology: FrenchTerminologyAdapter,
  getTerminologyVersion: HL7ToFHIRConverter.getTerminologyVersion,
  reloadTerminology: HL7ToFHIRConverter.reloadTerminology,
  
  // Version
  version: '1.1.0'
};