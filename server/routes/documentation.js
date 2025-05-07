/**
 * Routes pour l'accès à la documentation markdown
 */

const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs').promises;
const { marked } = require('marked');

// Chemin vers le dossier de documentation
const DOCS_PATH = path.join(process.cwd(), 'docs');

/**
 * Affiche la page d'accueil de la documentation
 */
router.get('/', async (req, res) => {
  try {
    const readmePath = path.join(DOCS_PATH, 'README.md');
    const content = await fs.readFile(readmePath, 'utf8');
    const htmlContent = marked(content);
    
    res.render('documentation', {
      title: 'Documentation FHIRHub',
      content: htmlContent
    });
  } catch (error) {
    console.error('Erreur lors de la lecture du fichier README:', error);
    res.status(500).send('Erreur lors du chargement de la documentation');
  }
});

/**
 * Affiche un fichier de documentation spécifique
 */
router.get('/:filename', async (req, res) => {
  try {
    const filename = req.params.filename;
    // Vérifier l'extension pour sécuriser l'accès
    if (!filename.endsWith('.md')) {
      return res.status(400).send('Format de fichier non supporté');
    }
    
    const filePath = path.join(DOCS_PATH, filename);
    
    // Vérifier que le chemin est dans le dossier de documentation (éviter traversal)
    if (!filePath.startsWith(DOCS_PATH)) {
      return res.status(403).send('Accès non autorisé');
    }
    
    try {
      await fs.access(filePath);
    } catch (err) {
      return res.status(404).send('Documentation non trouvée');
    }
    
    const content = await fs.readFile(filePath, 'utf8');
    const htmlContent = marked(content);
    
    res.render('documentation', {
      title: getDocTitle(filename, content),
      content: htmlContent
    });
  } catch (error) {
    console.error('Erreur lors de la lecture du fichier de documentation:', error);
    res.status(500).send('Erreur lors du chargement de la documentation');
  }
});

/**
 * Extrait le titre d'un fichier markdown
 */
function getDocTitle(filename, content) {
  // Essaie d'extraire le titre du contenu markdown (première ligne commençant par #)
  const titleMatch = content.match(/^#\s+(.+)$/m);
  if (titleMatch && titleMatch[1]) {
    return titleMatch[1];
  }
  
  // Sinon, utilise le nom du fichier
  return filename.replace('.md', '').replace(/-/g, ' ');
}

module.exports = router;