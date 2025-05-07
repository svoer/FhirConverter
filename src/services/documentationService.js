/**
 * Service de gestion de la documentation technique
 * Ce service fournit des méthodes pour accéder à la documentation technique
 * et la rendre disponible pour le chatbot et les autres fonctionnalités de l'application
 */

const fs = require('fs');
const path = require('path');
const util = require('util');

// Convertir les fonctions asynchrones à promesses
const readdirAsync = util.promisify(fs.readdir);
const readFileAsync = util.promisify(fs.readFile);
const statAsync = util.promisify(fs.stat);

// Chemin vers le dossier de documentation
const DOCS_PATH = path.join(__dirname, '../../docs');
const CACHE_EXPIRY = 1000 * 60 * 60; // 1 heure

// Cache pour les fichiers de documentation
let docsCache = {
  files: {},
  lastUpdated: null,
  index: {}
};

/**
 * Initialise le service de documentation
 * @returns {Promise<void>}
 */
async function initialize() {
  console.log('[DOCS] Initialisation du service de documentation...');
  
  try {
    await refreshCache();
    console.log('[DOCS] Service de documentation initialisé avec succès');
  } catch (error) {
    console.error('[DOCS] Erreur lors de l\'initialisation du service de documentation:', error);
    throw error;
  }
}

/**
 * Rafraîchit le cache des fichiers de documentation
 * @returns {Promise<void>}
 */
async function refreshCache() {
  console.log('[DOCS] Rafraîchissement du cache de documentation...');
  
  try {
    // Récupérer la liste des fichiers et dossiers de documentation
    const docFiles = await getAllDocumentationFiles(DOCS_PATH);
    
    // Vider le cache actuel
    docsCache.files = {};
    docsCache.index = {};
    
    // Charger le contenu de chaque fichier dans le cache
    for (const filePath of docFiles) {
      const relativePath = path.relative(DOCS_PATH, filePath);
      const content = await readFileAsync(filePath, 'utf8');
      
      // Stocker le contenu dans le cache
      docsCache.files[relativePath] = {
        content,
        path: relativePath,
        lastUpdated: new Date()
      };
      
      // Indexer le contenu pour la recherche
      indexDocumentContent(relativePath, content);
    }
    
    docsCache.lastUpdated = new Date();
    console.log(`[DOCS] Cache rafraîchi avec ${Object.keys(docsCache.files).length} fichiers`);
  } catch (error) {
    console.error('[DOCS] Erreur lors du rafraîchissement du cache:', error);
    throw error;
  }
}

/**
 * Récupère récursivement tous les fichiers markdown dans un dossier
 * @param {string} dirPath - Chemin du dossier à explorer
 * @returns {Promise<string[]>} - Liste des chemins complets des fichiers
 */
async function getAllDocumentationFiles(dirPath) {
  const files = [];
  const entries = await readdirAsync(dirPath);
  
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry);
    const stats = await statAsync(fullPath);
    
    if (stats.isDirectory()) {
      // Récupérer récursivement les fichiers des sous-dossiers
      const subFiles = await getAllDocumentationFiles(fullPath);
      files.push(...subFiles);
    } else if (stats.isFile() && (entry.endsWith('.md') || entry.endsWith('.txt'))) {
      // Ajouter les fichiers markdown et texte
      files.push(fullPath);
    }
  }
  
  return files;
}

/**
 * Indexe le contenu d'un document pour la recherche
 * @param {string} filePath - Chemin relatif du fichier
 * @param {string} content - Contenu du fichier
 */
function indexDocumentContent(filePath, content) {
  // Diviser le contenu en mots et les ajouter à l'index
  const words = content.toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 2);
  
  // Dédupliquer les mots
  const uniqueWords = [...new Set(words)];
  
  // Ajouter à l'index
  uniqueWords.forEach(word => {
    if (!docsCache.index[word]) {
      docsCache.index[word] = [];
    }
    
    if (!docsCache.index[word].includes(filePath)) {
      docsCache.index[word].push(filePath);
    }
  });
}

/**
 * Récupère la liste des fichiers de documentation disponibles
 * @returns {Promise<string[]>} Liste des chemins relatifs des fichiers
 */
async function getDocumentationFiles() {
  // Vérifier si le cache doit être rafraîchi
  if (!docsCache.lastUpdated || (Date.now() - docsCache.lastUpdated > CACHE_EXPIRY)) {
    await refreshCache();
  }
  
  return Object.keys(docsCache.files);
}

/**
 * Récupère le contenu d'un fichier de documentation
 * @param {string} filePath - Chemin relatif du fichier
 * @returns {Promise<string>} Contenu du fichier
 */
async function getDocumentContent(filePath) {
  // Vérifier si le cache doit être rafraîchi
  if (!docsCache.lastUpdated || (Date.now() - docsCache.lastUpdated > CACHE_EXPIRY)) {
    await refreshCache();
  }
  
  // Vérifier si le fichier existe dans le cache
  if (!docsCache.files[filePath]) {
    throw new Error(`Fichier non trouvé: ${filePath}`);
  }
  
  return docsCache.files[filePath].content;
}

/**
 * Recherche dans la documentation
 * @param {string} query - Termes de recherche
 * @returns {Promise<Array<Object>>} Résultats de recherche
 */
async function searchDocumentation(query) {
  // Vérifier si le cache doit être rafraîchi
  if (!docsCache.lastUpdated || (Date.now() - docsCache.lastUpdated > CACHE_EXPIRY)) {
    await refreshCache();
  }
  
  // Diviser la requête en mots
  const searchTerms = query.toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 2);
  
  // Si aucun terme valide n'est fourni, retourner une liste vide
  if (searchTerms.length === 0) {
    return [];
  }
  
  // Compter les occurrences de chaque fichier
  const fileScores = {};
  
  // Pour chaque terme de recherche, trouver les fichiers correspondants
  searchTerms.forEach(term => {
    // Rechercher des correspondances exactes
    if (docsCache.index[term]) {
      docsCache.index[term].forEach(filePath => {
        if (!fileScores[filePath]) {
          fileScores[filePath] = 0;
        }
        // Les correspondances exactes ont un score plus élevé
        fileScores[filePath] += 2;
      });
    }
    
    // Rechercher des correspondances partielles
    Object.keys(docsCache.index).forEach(indexTerm => {
      if (indexTerm.includes(term)) {
        docsCache.index[indexTerm].forEach(filePath => {
          if (!fileScores[filePath]) {
            fileScores[filePath] = 0;
          }
          // Les correspondances partielles ont un score plus faible
          fileScores[filePath] += 1;
        });
      }
    });
  });
  
  // Convertir en tableau de résultats
  const results = Object.entries(fileScores)
    .map(([filePath, score]) => ({
      path: filePath,
      score,
      title: getDocumentTitle(filePath, docsCache.files[filePath].content),
      preview: getDocumentPreview(docsCache.files[filePath].content, searchTerms)
    }))
    .filter(result => result.score > 0)
    .sort((a, b) => b.score - a.score);
  
  return results;
}

/**
 * Extrait le titre d'un document markdown
 * @param {string} filePath - Chemin relatif du fichier
 * @param {string} content - Contenu du fichier
 * @returns {string} Titre du document
 */
function getDocumentTitle(filePath, content) {
  // Essayer de trouver un titre H1 dans le contenu
  const titleMatch = content.match(/^#\s+(.+)$/m);
  if (titleMatch) {
    return titleMatch[1];
  }
  
  // Utiliser le nom de fichier comme fallback
  const fileName = path.basename(filePath, path.extname(filePath));
  return fileName.replace(/[_-]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

/**
 * Génère un aperçu du document avec le contexte des termes recherchés
 * @param {string} content - Contenu du document
 * @param {string[]} searchTerms - Termes de recherche
 * @returns {string} Aperçu du document
 */
function getDocumentPreview(content, searchTerms) {
  // Rechercher la première occurrence d'un terme de recherche dans le contenu
  let previewStart = 0;
  
  for (const term of searchTerms) {
    const termIndex = content.toLowerCase().indexOf(term);
    if (termIndex !== -1) {
      // Trouver le début de la phrase contenant le terme
      previewStart = content.lastIndexOf('.', termIndex);
      if (previewStart === -1) previewStart = 0;
      else previewStart += 1; // Exclure le point
      break;
    }
  }
  
  // Extraire un aperçu de 200 caractères autour du terme
  let preview = content.substring(previewStart, previewStart + 200).trim();
  
  // Ajouter des ellipses si le preview est coupé
  if (previewStart > 0) preview = '...' + preview;
  if (previewStart + 200 < content.length) preview += '...';
  
  return preview;
}

/**
 * Récupère un résumé de la documentation pour un sujet spécifique
 * @param {string} topic - Sujet recherché
 * @returns {Promise<Object>} Résumé de la documentation
 */
async function getDocumentationSummary(topic) {
  // Rechercher dans la documentation
  const searchResults = await searchDocumentation(topic);
  
  // Si aucun résultat n'est trouvé, retourner null
  if (searchResults.length === 0) {
    return null;
  }
  
  // Prendre les deux meilleurs résultats
  const topResults = searchResults.slice(0, 2);
  
  // Extraire le contenu pertinent
  const relevantContent = await Promise.all(
    topResults.map(async result => {
      const content = await getDocumentContent(result.path);
      
      // Tronquer pour ne pas dépasser les limites de taille
      return {
        title: result.title,
        path: result.path,
        content: content.substring(0, 1500) // Limiter à 1500 caractères par document
      };
    })
  );
  
  return {
    query: topic,
    results: relevantContent
  };
}

module.exports = {
  initialize,
  refreshCache,
  getDocumentationFiles,
  getDocumentContent,
  searchDocumentation,
  getDocumentationSummary
};