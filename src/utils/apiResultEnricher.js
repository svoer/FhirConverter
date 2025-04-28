/**
 * Module d'enrichissement des résultats API pour FHIRHub
 * Ce module s'assure que les résultats de conversion renvoyés par l'API
 * contiennent toutes les ressources FHIR de manière complète et lisible
 */

/**
 * Enrichit les objets de résultat d'API de conversion pour inclure
 * toutes les ressources FHIR et pas seulement les références
 * 
 * @param {Object} apiResult - Résultat original de l'API
 * @returns {Object} Résultat enrichi
 */
function enrichApiResult(apiResult) {
  if (!apiResult) return apiResult;
  
  try {
    // Si le résultat contient déjà les ressources complètes, ne rien faire
    if (apiResult.fhir && apiResult.fhir.resourceType === 'Bundle' && 
        apiResult.fhir.entry && apiResult.fhir.entry.length > 0 &&
        apiResult.fhir.entry[0].resource && 
        Object.keys(apiResult.fhir.entry[0].resource).length > 3) {
      return apiResult;
    }
    
    // Si le résultat est un Bundle mais n'a pas les ressources complètes
    if (apiResult.fhir && apiResult.fhir.resourceType === 'Bundle' && 
        apiResult.fhir.entry && apiResult.fhir.entry.length > 0) {
      
      // Vérifier si fhirResources existe
      if (apiResult.fhirResources && Array.isArray(apiResult.fhirResources)) {
        // Remplacer les ressources incomplètes par les ressources complètes
        apiResult.fhir.entry.forEach((entry, index) => {
          if (entry.resource && entry.resource.resourceType) {
            // Chercher la ressource complète correspondante
            const fullResource = apiResult.fhirResources.find(r => 
              r.resourceType === entry.resource.resourceType && 
              (r.id === entry.resource.id || 
               r.id === entry.resource.id?.split('/').pop())
            );
            
            if (fullResource) {
              // Remplacer par la ressource complète
              entry.resource = fullResource;
            }
          }
        });
      } else if (apiResult.fullResult && typeof apiResult.fullResult === 'string') {
        // Si nous avons le résultat complet en JSON string, l'utiliser
        try {
          const fullResult = JSON.parse(apiResult.fullResult);
          if (fullResult.resourceType === 'Bundle' && fullResult.entry) {
            apiResult.fhir = fullResult;
          }
        } catch (e) {
          console.error('[API_ENRICHER] Erreur lors du parsing du fullResult:', e);
        }
      }
    }
    
    // Recalculer le nombre de ressources
    if (apiResult.fhir && apiResult.fhir.entry) {
      apiResult.resourceCount = apiResult.fhir.entry.length;
    }
    
    return apiResult;
  } catch (error) {
    console.error('[API_ENRICHER] Erreur lors de l\'enrichissement du résultat API:', error);
    return apiResult; // En cas d'erreur, retourner le résultat original
  }
}

/**
 * Enrichit un tableau de résultats d'API
 * 
 * @param {Array} apiResults - Tableau de résultats API
 * @returns {Array} Tableau de résultats enrichis
 */
function enrichApiResults(apiResults) {
  if (!Array.isArray(apiResults)) return apiResults;
  
  return apiResults.map(result => enrichApiResult(result));
}

/**
 * Applique l'enrichissement à toutes les réponses d'API
 * Fonction middleware pour Express
 * 
 * @param {Object} req - Requête Express
 * @param {Object} res - Réponse Express
 * @param {Function} next - Fonction next Express
 */
function apiResultEnricherMiddleware(req, res, next) {
  // Stocker la méthode json originale
  const originalJson = res.json;
  
  // Remplacer la méthode json
  res.json = function(obj) {
    // Enrichir le résultat avant de l'envoyer
    const enrichedObj = Array.isArray(obj) ? enrichApiResults(obj) : enrichApiResult(obj);
    
    // Appeler la méthode json originale avec le résultat enrichi
    return originalJson.call(this, enrichedObj);
  };
  
  next();
}

module.exports = {
  enrichApiResult,
  enrichApiResults,
  apiResultEnricherMiddleware
};