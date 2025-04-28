/**
 * Module d'enrichissement des résultats API
 * Améliore les objets de réponse API avec des informations additionnelles
 * comme des métadonnées, liens et statistiques
 */

/**
 * Middleware d'enrichissement des résultats API
 * Enrichit les réponses JSON avec des informations supplémentaires
 * @param {Express.Request} req - Requête Express
 * @param {Express.Response} res - Réponse Express
 * @param {Function} next - Fonction middleware suivante
 */
function apiResultEnricherMiddleware(req, res, next) {
  // Sauvegarder la méthode json d'origine
  const originalJson = res.json;
  
  // Surcharger la méthode json
  res.json = function(obj) {
    // Si l'objet est déjà enrichi ou c'est une erreur, ne pas l'enrichir
    if (obj && (obj.meta || obj.error)) {
      return originalJson.call(this, obj);
    }
    
    // Créer un objet résultat enrichi
    const enrichedResult = {
      data: obj,
      meta: {
        timestamp: new Date().toISOString(),
        api: {
          version: '1.0.0',
          name: 'FHIRHub API'
        },
        request: {
          method: req.method,
          path: req.path,
          query: Object.keys(req.query).length > 0 ? req.query : undefined
        }
      }
    };
    
    // Ajouter des liens d'API pour les collections
    if (Array.isArray(obj) && req.path.startsWith('/api/')) {
      // Extraire les informations de pagination si disponibles
      const limit = parseInt(req.query.limit) || 20;
      const offset = parseInt(req.query.offset) || 0;
      const hasMore = obj.length === limit;
      
      enrichedResult.meta.pagination = {
        limit,
        offset,
        count: obj.length,
        hasMore
      };
      
      // Ajouter des liens HAL
      enrichedResult.links = {
        self: `${req.protocol}://${req.get('host')}${req.originalUrl}`,
      };
      
      // Ajouter des liens next/prev si c'est pertinent
      if (hasMore) {
        enrichedResult.links.next = `${req.protocol}://${req.get('host')}${req.path}?limit=${limit}&offset=${offset + limit}`;
      }
      
      if (offset > 0) {
        const prevOffset = Math.max(0, offset - limit);
        enrichedResult.links.prev = `${req.protocol}://${req.get('host')}${req.path}?limit=${limit}&offset=${prevOffset}`;
      }
    }
    
    // Appeler la méthode d'origine avec l'objet enrichi
    return originalJson.call(this, enrichedResult);
  };
  
  next();
}

module.exports = {
  apiResultEnricherMiddleware
};