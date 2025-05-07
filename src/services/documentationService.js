/**
 * Service de documentation technique
 * Permet au chatbot d'accéder aux fichiers de documentation du projet
 */

const fs = require('fs').promises;
const path = require('path');
const { createHash } = require('crypto');
const util = require('util');
const { promisify } = util;
const exec = promisify(require('child_process').exec);

// Configuration
const DOCS_DIR = path.join(process.cwd(), 'docs');
const CACHE_LIFETIME = 24 * 60 * 60 * 1000; // 24 heures en millisecondes

// Cache pour les documents et l'index de recherche
let documentCache = {
  lastUpdated: 0,
  documents: {}, // {filename: {content, hash, lastUpdated}}
  searchIndex: {} // {term: [filenames]}
};

/**
 * Rafraîchit le cache de documentation
 * Scanne le répertoire docs/, indexe tous les fichiers et les ajoute au cache
 */
async function refreshCache() {
  console.log('[DOCS] Rafraîchissement du cache de documentation...');
  
  try {
    // Vérifier que le répertoire docs existe, le créer sinon
    try {
      await fs.access(DOCS_DIR);
    } catch (err) {
      console.log('[DOCS] Création du répertoire docs...');
      await fs.mkdir(DOCS_DIR, { recursive: true });
      
      // Création d'un fichier README.md initial
      const readmePath = path.join(DOCS_DIR, 'README.md');
      await fs.writeFile(readmePath, `# Documentation technique de FHIRHub\n\nCe répertoire contient la documentation technique du projet FHIRHub.\n\n## Sections\n\n- Architecture : structure générale du projet\n- Conversion : détails techniques sur la conversion HL7 vers FHIR\n- API : documentation de l'API REST\n- Workflows : documentation sur le système de workflows\n`);
    }
    
    // Réinitialiser le cache
    documentCache = {
      lastUpdated: Date.now(),
      documents: {},
      searchIndex: {}
    };
    
    // Récupérer tous les fichiers Markdown du répertoire docs et ses sous-répertoires
    const files = await getAllMarkdownFiles(DOCS_DIR);
    
    // Indexer chaque fichier
    for (const filePath of files) {
      try {
        const relativePath = path.relative(DOCS_DIR, filePath);
        const content = await fs.readFile(filePath, 'utf8');
        const hash = createHash('md5').update(content).digest('hex');
        
        // Ajouter au cache des documents
        documentCache.documents[relativePath] = {
          content,
          hash,
          lastUpdated: Date.now(),
          path: relativePath
        };
        
        // Indexer le contenu pour la recherche
        indexDocumentContent(relativePath, content);
      } catch (error) {
        console.error(`[DOCS] Erreur lors de l'indexation du fichier ${filePath}:`, error);
      }
    }
    
    console.log(`[DOCS] ${Object.keys(documentCache.documents).length} fichiers de documentation indexés.`);
    return true;
  } catch (error) {
    console.error('[DOCS] Erreur lors du rafraîchissement du cache:', error);
    throw error;
  }
}

/**
 * Découpe et indexe le contenu d'un document pour la recherche
 * Extrait les mots-clés et les associe au fichier dans l'index de recherche
 * @param {string} fileName - Nom du fichier à indexer
 * @param {string} content - Contenu du fichier
 */
function indexDocumentContent(fileName, content) {
  // Nettoyer le contenu (supprimer les caractères spéciaux, convertir en minuscules)
  const cleanContent = content
    .toLowerCase()
    .replace(/```[\s\S]*?```/g, '') // Supprimer les blocs de code
    .replace(/[#*_\[\]()>]/g, ' ') // Supprimer les caractères Markdown
    .replace(/\s+/g, ' ') // Remplacer plusieurs espaces par un seul
    .trim();
  
  // Extraire les mots uniques avec au moins 3 caractères
  const words = [...new Set(cleanContent.split(' ').filter(word => word.length >= 3))];
  
  // Extraire les termes techniques spécifiques (mots avec majuscules, comme HL7, FHIR, etc.)
  const technicalTerms = content.match(/\b[A-Z0-9]{2,}(?:\.[A-Z0-9]+)*\b/g) || [];
  
  // Ajouter les titres avec un poids plus élevé
  const titles = content.match(/#+\s+(.+)/g) || [];
  const cleanTitles = titles.map(title => 
    title.replace(/#+\s+/, '').toLowerCase().replace(/[^\w\s]/g, ' ').trim()
  );
  
  // Combiner tous les termes à indexer
  const allTerms = [...words, ...technicalTerms, ...cleanTitles];
  
  // Ajouter chaque terme à l'index de recherche
  allTerms.forEach(term => {
    if (!documentCache.searchIndex[term]) {
      documentCache.searchIndex[term] = [];
    }
    if (!documentCache.searchIndex[term].includes(fileName)) {
      documentCache.searchIndex[term].push(fileName);
    }
  });
}

/**
 * Récupère récursivement tous les fichiers Markdown d'un répertoire et ses sous-répertoires
 * @param {string} dir - Répertoire à scanner
 * @returns {Promise<string[]>} Liste des chemins absolus des fichiers Markdown
 */
async function getAllMarkdownFiles(dir) {
  const result = [];
  
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      
      if (entry.isDirectory()) {
        const subDirFiles = await getAllMarkdownFiles(fullPath);
        result.push(...subDirFiles);
      } else if (entry.name.endsWith('.md')) {
        result.push(fullPath);
      }
    }
  } catch (error) {
    console.error(`[DOCS] Erreur lors de la récupération des fichiers du répertoire ${dir}:`, error);
  }
  
  return result;
}

/**
 * Vérifie si le cache est périmé
 * @returns {boolean} True si le cache doit être rafraîchi
 */
function isCacheExpired() {
  const now = Date.now();
  return (now - documentCache.lastUpdated) > CACHE_LIFETIME || 
         Object.keys(documentCache.documents).length === 0;
}

/**
 * Récupère la liste des fichiers de documentation disponibles
 * @returns {Promise<Array>} Liste des fichiers disponibles
 */
async function getDocumentationFiles() {
  if (isCacheExpired()) {
    await refreshCache();
  }
  
  const files = Object.keys(documentCache.documents).map(fileName => {
    const doc = documentCache.documents[fileName];
    return {
      path: fileName,
      lastUpdated: doc.lastUpdated
    };
  });
  
  return {
    files,
    count: files.length,
    lastUpdated: documentCache.lastUpdated
  };
}

/**
 * Récupère le contenu d'un fichier de documentation
 * @param {string} filePath - Chemin du fichier (relatif au répertoire docs/)
 * @returns {Promise<string>} Contenu du fichier
 */
async function getDocumentContent(filePath) {
  if (isCacheExpired()) {
    await refreshCache();
  }
  
  // Normaliser le chemin pour éviter les problèmes de séparateurs
  const normalizedPath = filePath.replace(/\\/g, '/');
  
  if (!documentCache.documents[normalizedPath]) {
    // Vérifier si le fichier existe physiquement
    const fullPath = path.join(DOCS_DIR, normalizedPath);
    
    try {
      await fs.access(fullPath);
      
      // Le fichier existe mais n'est pas en cache, l'ajouter au cache
      const content = await fs.readFile(fullPath, 'utf8');
      const hash = createHash('md5').update(content).digest('hex');
      
      documentCache.documents[normalizedPath] = {
        content,
        hash,
        lastUpdated: Date.now(),
        path: normalizedPath
      };
      
      // Indexer le contenu pour la recherche
      indexDocumentContent(normalizedPath, content);
      
      return content;
    } catch (error) {
      throw new Error(`Fichier de documentation non trouvé: ${normalizedPath}`);
    }
  }
  
  return documentCache.documents[normalizedPath].content;
}

/**
 * Recherche dans la documentation
 * @param {string} query - Termes de recherche
 * @returns {Promise<Array>} Résultats de recherche
 */
async function searchDocumentation(query) {
  if (isCacheExpired()) {
    await refreshCache();
  }
  
  // Nettoyer et fractionner la requête en termes individuels
  const terms = query.toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(term => term.length >= 2);
  
  if (terms.length === 0) {
    return {
      query,
      results: [],
      count: 0
    };
  }
  
  // Initialiser le score pour chaque document
  const scores = {};
  
  // Pour chaque terme, trouver les documents correspondants
  terms.forEach(term => {
    // Recherche exacte
    if (documentCache.searchIndex[term]) {
      documentCache.searchIndex[term].forEach(fileName => {
        if (!scores[fileName]) {
          scores[fileName] = 0;
        }
        // Donner un score plus élevé pour les correspondances exactes
        scores[fileName] += 10;
      });
    }
    
    // Recherche partielle
    Object.keys(documentCache.searchIndex).forEach(indexTerm => {
      if (indexTerm.includes(term)) {
        documentCache.searchIndex[indexTerm].forEach(fileName => {
          if (!scores[fileName]) {
            scores[fileName] = 0;
          }
          // Donner un score plus faible pour les correspondances partielles
          scores[fileName] += 5;
        });
      }
    });
  });
  
  // Convertir les scores en tableau de résultats
  const results = Object.keys(scores)
    .map(fileName => {
      const doc = documentCache.documents[fileName];
      
      // Extraire un extrait contenant le premier terme de recherche
      let excerpt = '';
      const content = doc.content.toLowerCase();
      
      for (const term of terms) {
        const index = content.indexOf(term);
        if (index !== -1) {
          // Extraire 50 caractères avant et après la première occurrence du terme
          const start = Math.max(0, index - 50);
          const end = Math.min(content.length, index + term.length + 50);
          excerpt = '...' + content.substring(start, end) + '...';
          break;
        }
      }
      
      // Si aucun extrait n'a été trouvé, utiliser les 100 premiers caractères
      if (!excerpt && doc.content) {
        excerpt = doc.content.substring(0, 100) + '...';
      }
      
      return {
        path: fileName,
        score: scores[fileName],
        excerpt,
        title: extractTitle(doc.content)
      };
    })
    .sort((a, b) => b.score - a.score);
  
  return {
    query,
    results,
    count: results.length
  };
}

/**
 * Extrait le titre d'un document Markdown
 * @param {string} content - Contenu du document
 * @returns {string} Titre du document
 */
function extractTitle(content) {
  if (!content) return 'Sans titre';
  
  // Rechercher le premier titre de niveau 1 ou 2
  const titleMatch = content.match(/^#\s+(.+)$/m) || content.match(/^##\s+(.+)$/m);
  
  if (titleMatch && titleMatch[1]) {
    return titleMatch[1].trim();
  }
  
  // Si aucun titre n'est trouvé, utiliser la première ligne non vide
  const firstLine = content.split('\n').find(line => line.trim().length > 0);
  if (firstLine) {
    return firstLine.trim().substring(0, 50);
  }
  
  return 'Sans titre';
}

/**
 * Récupère un résumé de la documentation sur un sujet spécifique
 * Utilisé par le chatbot pour obtenir des informations contextuelles
 * @param {string} topic - Sujet de recherche
 * @returns {Promise<Object>} Résumé de la documentation
 */
async function getDocumentationSummary(topic) {
  try {
    // Rechercher des documents pertinents
    const searchResults = await searchDocumentation(topic);
    
    if (!searchResults.results.length) {
      return null;
    }
    
    // Prendre les 3 résultats les plus pertinents
    const topResults = searchResults.results.slice(0, 3);
    
    // Récupérer le contenu complet de chaque document
    const documents = await Promise.all(
      topResults.map(async result => {
        const content = await getDocumentContent(result.path);
        return {
          title: result.title,
          path: result.path,
          content
        };
      })
    );
    
    return {
      topic,
      documents,
      timestamp: Date.now()
    };
  } catch (error) {
    console.error('[DOCS] Erreur lors de la récupération du résumé de documentation:', error);
    return null;
  }
}

// Initialiser le cache au démarrage
(async () => {
  try {
    await refreshCache();
  } catch (error) {
    console.error('[DOCS] Erreur lors de l\'initialisation du cache de documentation:', error);
  }
})();

module.exports = {
  refreshCache,
  getDocumentationFiles,
  getDocumentContent,
  searchDocumentation,
  getDocumentationSummary
};