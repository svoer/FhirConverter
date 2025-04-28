/**
 * Module de nettoyage des ressources FHIR
 * Optimise les ressources FHIR pour éviter les erreurs de validation et les rejets
 * en supprimant les données vides, redondantes ou non significatives
 * 
 * @module fhirCleaner
 * @author FHIRHub Team
 */

/**
 * Nettoie un tableau en supprimant les éléments vides
 * @param {Array} arr - Tableau à nettoyer
 * @returns {Array} Tableau nettoyé
 */
function cleanArray(arr) {
  if (!Array.isArray(arr)) return arr;
  
  // Nettoyer les éléments du tableau récursivement
  const cleanedArr = arr
    .filter(item => {
      // Suppression des chaînes vides
      if (typeof item === 'string') return item.trim() !== '';
      
      // Suppression des objets vides ou null/undefined
      if (item === null || item === undefined) return false;
      if (typeof item === 'object' && Object.keys(item).length === 0) return false;
      
      return true;
    })
    .map(item => {
      // Nettoyer récursivement les objets dans le tableau
      if (typeof item === 'object' && item !== null) {
        return cleanResource(item);
      }
      return item;
    });
  
  return cleanedArr.length > 0 ? cleanedArr : undefined;
}

/**
 * Nettoie un attribut FHIR name qui contient des entrées avec des prénoms vides
 * @param {Array} nameArray - Attribut name d'une ressource FHIR
 * @returns {Array} Attribut name nettoyé
 */
function cleanNames(nameArray) {
  if (!Array.isArray(nameArray) || nameArray.length === 0) return nameArray;
  
  return nameArray.filter(name => {
    // Garder uniquement les noms qui ont au moins un prénom non vide
    return name.given && Array.isArray(name.given) && 
           name.given.some(g => g && g.trim() !== '');
  });
}

/**
 * Nettoie une ressource FHIR en supprimant les données vides ou non significatives
 * @param {Object} resource - Ressource FHIR à nettoyer
 * @returns {Object} Ressource FHIR nettoyée
 */
function cleanResource(resource) {
  if (!resource || typeof resource !== 'object') return resource;
  
  const cleanedResource = { ...resource };
  
  // Nettoyer les propriétés de la ressource
  Object.entries(cleanedResource).forEach(([key, value]) => {
    // Traitement spécifique pour l'attribut name
    if (key === 'name' && Array.isArray(value)) {
      cleanedResource[key] = cleanNames(value);
      return;
    }
    
    // Nettoyage des tableaux
    if (Array.isArray(value)) {
      cleanedResource[key] = cleanArray(value);
      // Supprimer la propriété si le tableau est vide après nettoyage
      if (!cleanedResource[key] || cleanedResource[key].length === 0) {
        delete cleanedResource[key];
      }
      return;
    }
    
    // Nettoyage récursif des objets
    if (value && typeof value === 'object') {
      cleanedResource[key] = cleanResource(value);
      // Supprimer la propriété si l'objet est vide après nettoyage
      if (!cleanedResource[key] || Object.keys(cleanedResource[key]).length === 0) {
        delete cleanedResource[key];
      }
      return;
    }
    
    // Supprimer les chaînes vides
    if (typeof value === 'string' && value.trim() === '') {
      delete cleanedResource[key];
      return;
    }
    
    // Supprimer les valeurs null ou undefined
    if (value === null || value === undefined) {
      delete cleanedResource[key];
    }
  });
  
  return cleanedResource;
}

/**
 * Nettoie un bundle FHIR en appliquant le nettoyage à toutes les ressources
 * @param {Object} bundle - Bundle FHIR à nettoyer
 * @returns {Object} Bundle FHIR nettoyé
 */
function cleanBundle(bundle) {
  if (!bundle || typeof bundle !== 'object') return bundle;
  
  // Copie du bundle pour ne pas modifier l'original
  const cleanedBundle = { ...bundle };
  
  // Nettoyer les entrées du bundle
  if (cleanedBundle.entry && Array.isArray(cleanedBundle.entry)) {
    cleanedBundle.entry = cleanedBundle.entry.map(entry => {
      const cleanedEntry = { ...entry };
      
      // Nettoyer la ressource si elle existe
      if (cleanedEntry.resource) {
        cleanedEntry.resource = cleanResource(cleanedEntry.resource);
      }
      
      return cleanedEntry;
    });
  }
  
  return cleanedBundle;
}

module.exports = {
  cleanResource,
  cleanBundle,
  cleanNames
};