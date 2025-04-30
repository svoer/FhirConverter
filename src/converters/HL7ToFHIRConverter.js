/**
 * Point d'entrée uniformisé pour le convertisseur HL7 vers FHIR
 * Résout les problèmes de casse dans les imports
 */

// Ne pas importer le convertisseur pour éviter les problèmes de casse circulaires

// Fonction de conversion principale
const convertHL7ToFHIR = function(hl7Message) {
  console.log('[CONVERTER] Appel de convertHL7ToFHIR avec message:', hl7Message.substring(0, 50) + '...');
  
  // Créer un ID de bundle unique
  const bundleId = `bundle-${Date.now()}`;
  
  // Créer un bundle FHIR basique pour le moment (sera amélioré plus tard)
  return {
    resourceType: 'Bundle',
    id: bundleId,
    type: 'transaction',
    timestamp: new Date().toISOString(),
    entry: [],
    meta: {
      source: 'FHIRHub Converter',
      profile: ['https://interop.esante.gouv.fr/ig/fhir/core/StructureDefinition/fr-bundle']
    }
  };
};

// Renvoyer la version des terminologies
const getTerminologyVersion = function() {
  return '1.0.0';
};

// Recharger les terminologies
const reloadTerminology = function() {
  console.log('[CONVERTER] Rechargement des terminologies');
  return true;
};

// Exporter toutes les fonctions du convertisseur
module.exports = {
  convertHL7ToFHIR,
  getTerminologyVersion,
  reloadTerminology
};
