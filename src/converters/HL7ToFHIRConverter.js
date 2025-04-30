/**
 * Point d'entrée uniformisé pour le convertisseur HL7 vers FHIR
 * Résout les problèmes de casse dans les imports
 */

// Importer le vrai convertisseur (avec une casse cohérente)
const converter = require('./hl7ToFhirConverter');

// Exporter toutes les fonctions du convertisseur
module.exports = converter;
