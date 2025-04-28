/**
 * Fonctions utilitaires pour FHIRHub
 * Contient des fonctions communes utilisées par plusieurs modules
 */

/**
 * Effectue une requête à l'API FHIRHub
 * @param {string} endpoint - Endpoint API sans le préfixe /api/
 * @param {Object} options - Options de la requête fetch
 * @returns {Promise<Object>} - Réponse de l'API
 */
async function apiRequest(endpoint, options = {}) {
  // Assurer que les en-têtes sont initialisés
  options.headers = options.headers || {};
  
  // Obtenir la clé API depuis le localStorage ou utiliser la clé de développement par défaut
  const apiKey = localStorage.getItem('apiKey') || 'dev-key';
  
  // Ajouter la clé API à la fois dans les en-têtes et dans l'URL (pour compatibilité)
  options.headers['x-api-key'] = apiKey;
  
  // Construire l'URL avec la clé API en paramètre de requête
  let url = `/api/${endpoint}`;
  if (url.includes('?')) {
    url += `&apiKey=${apiKey}`;
  } else {
    url += `?apiKey=${apiKey}`;
  }
  
  console.log(`Requête API: ${options.method || 'GET'} ${url}`);
  
  try {
    const response = await fetch(url, options);
    
    if (!response.ok) {
      console.error(`Erreur API: ${response.status} ${response.statusText}`);
      const errorText = await response.text();
      console.error('Détails:', errorText);
      
      try {
        // Essayer de parser comme JSON
        const errorJson = JSON.parse(errorText);
        throw new Error(errorJson.message || errorJson.error || `Erreur ${response.status}`);
      } catch (e) {
        // Si ce n'est pas du JSON, renvoyer le texte brut
        throw new Error(`Erreur ${response.status}: ${errorText.substring(0, 100)}...`);
      }
    }
    
    // Analyser la réponse comme JSON
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Erreur lors de la requête API:', error);
    throw error;
  }
}