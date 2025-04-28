/**
 * Module d'enrichissement des résultats API
 * Prépare les résultats pour affichage dans l'interface
 * 
 * @module apiResultEnricher
 * @author FHIRHub Team
 */

/**
 * Extraire les informations les plus importantes d'un bundle FHIR
 * @param {Object} fhirBundle - Bundle FHIR à analyser
 * @returns {Object} Informations extraites et formatées
 */
function extractBundleInfo(fhirBundle) {
  if (!fhirBundle || !fhirBundle.entry || !Array.isArray(fhirBundle.entry)) {
    return {
      resourceCount: 0,
      resourceTypes: [],
      patient: null,
      encounter: null,
      organizations: []
    };
  }

  // Extraire les ressources du bundle
  const resources = fhirBundle.entry.map(entry => entry.resource).filter(res => res);
  
  // Trouver les ressources spécifiques
  const patientResource = resources.find(res => res.resourceType === 'Patient');
  const encounterResource = resources.find(res => res.resourceType === 'Encounter');
  const organizationResources = resources.filter(res => res.resourceType === 'Organization');
  
  // Informations générales sur le bundle
  const info = {
    resourceCount: resources.length,
    resourceTypes: [...new Set(resources.map(res => res.resourceType))],
    patient: null,
    encounter: null,
    organizations: []
  };
  
  // Extraire les informations du patient
  if (patientResource) {
    info.patient = {
      id: patientResource.id,
      identifiers: (patientResource.identifier || []).map(id => ({
        system: id.system || 'N/A',
        value: id.value || 'N/A',
        type: id.type?.coding?.[0]?.code || 'N/A'
      })),
      names: (patientResource.name || []).map(name => ({
        family: name.family || 'N/A',
        given: name.given || [],
        use: name.use || 'N/A'
      })),
      gender: patientResource.gender || 'N/A',
      birthDate: patientResource.birthDate || 'N/A',
      addresses: (patientResource.address || []).map(addr => ({
        lines: addr.line || [],
        city: addr.city || 'N/A',
        postalCode: addr.postalCode || 'N/A',
        country: addr.country || 'N/A',
        use: addr.use || 'N/A'
      })),
      telecoms: (patientResource.telecom || []).map(tel => ({
        system: tel.system || 'N/A',
        value: tel.value || 'N/A',
        use: tel.use || 'N/A'
      }))
    };
  }
  
  // Extraire les informations de l'hospitalisation
  if (encounterResource) {
    info.encounter = {
      id: encounterResource.id,
      status: encounterResource.status || 'N/A',
      class: encounterResource.class?.code || 'N/A',
      patientRef: encounterResource.subject?.reference || 'N/A',
      period: {
        start: encounterResource.period?.start || 'N/A',
        end: encounterResource.period?.end || 'N/A'
      },
      extensions: (encounterResource.extension || []).map(ext => ({
        url: ext.url,
        value: ext.valueString || ext.valueCode || 'N/A'
      }))
    };
  }
  
  // Extraire les informations des organisations
  if (organizationResources.length > 0) {
    info.organizations = organizationResources.map(org => ({
      id: org.id,
      name: org.name || 'N/A',
      identifiers: (org.identifier || []).map(id => ({
        system: id.system || 'N/A',
        value: id.value || 'N/A'
      }))
    }));
  }
  
  return info;
}

/**
 * Enrichir le résultat API pour l'affichage
 * @param {Object} conversionResult - Résultat de la conversion
 * @returns {Object} Résultat enrichi
 */
function enrichApiResult(conversionResult) {
  if (!conversionResult || !conversionResult.success) {
    return conversionResult;
  }
  
  // Cloner le résultat pour ne pas modifier l'original
  const enriched = { ...conversionResult };
  
  // Ajouter des informations plus détaillées
  enriched.bundleInfo = extractBundleInfo(conversionResult.fhirData);
  
  return enriched;
}

module.exports = {
  enrichApiResult,
  extractBundleInfo
};