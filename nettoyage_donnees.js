/**
 * Script de nettoyage des données sensibles dans les fichiers de sortie
 * Ce script parcourt les fichiers de conversion dans les dossiers 'data/out' et 'data/backups'
 * et anonymise les données personnelles identifiables
 * 
 * @author FHIRHub Team
 * @version 1.0.0
 */

const fs = require('fs').promises;
const path = require('path');

// Configuration
const DIRECTORIES_TO_CLEAN = [
  path.join(__dirname, 'data', 'out'),
  path.join(__dirname, 'data', 'backups', 'out'),
  path.join(__dirname, 'test_data', 'fhir_results')
];

// Données à anonymiser (format: { pattern: /regex/, replacement: 'valeur anonymisée' })
const DATA_TO_ANONYMIZE = [
  // Noms et prénoms réels
  { pattern: /YEHOUESSI/g, replacement: 'DUPONT' },
  { pattern: /HERMAS JEAN RICHARD/g, replacement: 'JEAN PHILIPPE' },
  { pattern: /ELENA/g, replacement: 'MARIE' },
  { pattern: /SECLET/g, replacement: 'DURAND' },
  { pattern: /MARYSE/g, replacement: 'SYLVIE' },
  { pattern: /BERTHE ALICE/g, replacement: 'CLAIRE MARIE' },
  { pattern: /REMY/g, replacement: 'DURAND' },
  { pattern: /AUDREY/g, replacement: 'PIERRE' },
  
  // Identifiants INS (INS-A, INS-C, etc.)
  { pattern: /160059932710027/g, replacement: '123456789012345' },
  { pattern: /1121717802492545833548/g, replacement: '987654321987654' },
  { pattern: /248098060602525/g, replacement: '987654321654321' },
  
  // Adresses
  { pattern: /8\s+AVENUE CONDORCET/g, replacement: '8 RUE DE PARIS' },
  { pattern: /FORT DE FRANCE/g, replacement: 'PARIS' },
  { pattern: /97200/g, replacement: '75001' },
  { pattern: /PORTO NUEVO/g, replacement: 'PARIS' },
  { pattern: /99327/g, replacement: '75001' },
  { pattern: /BEN/g, replacement: 'FRA' },
  { pattern: /7 RUE DU BOUJONNIER/g, replacement: '7 RUE DE LA MAIRIE' },
  { pattern: /FORMERIE/g, replacement: 'PARIS' },
  { pattern: /60220/g, replacement: '75001' },
  { pattern: /80606/g, replacement: '75001' },
  { pattern: /OISEMONT \(80140\)/g, replacement: 'PARIS (75001)' },
  { pattern: /8\s+AVECONDORCET/g, replacement: '8 RUE DE LA SANTE' },
  
  // Numéros de téléphone
  { pattern: /0696039637/g, replacement: '0612345678' },
  { pattern: /0596000093/g, replacement: '0123456789' },
  { pattern: /0608987212/g, replacement: '0611223344' },
  { pattern: /0659530376/g, replacement: '0611223344' },
  
  // Emails
  { pattern: /MARYSE\.SECLET@WANADOO\.FR/g, replacement: 'SYLVIE.DURAND@EMAIL.FR' },
  { pattern: /SPICHER@PAUCHET\.COM/g, replacement: 'CONTACT@HOPITAL.COM' },
  
  // Identifiants médicaux
  { pattern: /562102580/g, replacement: '123456789' },
  { pattern: /442777/g, replacement: '123456' },
  { pattern: /1000345108/g, replacement: '987654321' },
  { pattern: /R000171104/g, replacement: 'R000000000' },
  { pattern: /1174024/g, replacement: '1234567' },
  
  // Médecins et professionnels de santé
  { pattern: /MERAUT SALOMON/g, replacement: 'MARTIN' },
  { pattern: /RENEE/g, replacement: 'PAUL' },
  { pattern: /971219175/g, replacement: '123456789' },
  { pattern: /1238140/g, replacement: '987654321' },
  { pattern: /CLINIQUE VICTOR PAUCHET/g, replacement: 'HOPITAL SAINT LOUIS' },
  { pattern: /800009920/g, replacement: '123456789' },
  { pattern: /10001850758/g, replacement: '123456789' },
  { pattern: /BARTOLI/g, replacement: 'DUBOIS' },
  { pattern: /PAULINE/g, replacement: 'MARIE' },
  { pattern: /10100710366/g, replacement: '987654321' },
  { pattern: /LEFRANCOIS/g, replacement: 'MARTIN' },
  { pattern: /PASCAL/g, replacement: 'JEAN' }
];

/**
 * Anonymise le contenu d'un fichier JSON
 * @param {string} filePath - Chemin du fichier à traiter
 */
async function anonymizeFile(filePath) {
  try {
    console.log(`Traitement du fichier: ${filePath}`);
    
    // Lire le contenu du fichier
    const fileContent = await fs.readFile(filePath, 'utf8');
    
    // Vérifier si c'est un JSON valide
    try {
      JSON.parse(fileContent);
    } catch (e) {
      console.log(`  Ignoré: Fichier non-JSON`);
      return;
    }
    
    // Appliquer les règles d'anonymisation
    let anonymizedContent = fileContent;
    let hasChanged = false;
    
    for (const rule of DATA_TO_ANONYMIZE) {
      const originalContent = anonymizedContent;
      anonymizedContent = anonymizedContent.replace(rule.pattern, rule.replacement);
      
      if (originalContent !== anonymizedContent) {
        hasChanged = true;
        console.log(`  Anonymisation: ${rule.pattern} → ${rule.replacement}`);
      }
    }
    
    // Sauvegarder le fichier si des modifications ont été faites
    if (hasChanged) {
      await fs.writeFile(filePath, anonymizedContent, 'utf8');
      console.log(`  ✓ Fichier anonymisé et sauvegardé`);
    } else {
      console.log(`  ✓ Aucune donnée sensible trouvée`);
    }
  } catch (error) {
    console.error(`  ✗ Erreur lors du traitement du fichier ${filePath}:`, error.message);
  }
}

/**
 * Traite tous les fichiers d'un répertoire de manière récursive
 * @param {string} directory - Répertoire à traiter
 */
async function processDirectory(directory) {
  try {
    // Vérifier si le répertoire existe
    try {
      await fs.access(directory);
    } catch (e) {
      console.log(`Le répertoire ${directory} n'existe pas, ignoré.`);
      return;
    }
    
    console.log(`\nTraitement du répertoire: ${directory}`);
    
    // Lister les fichiers
    const files = await fs.readdir(directory);
    
    for (const file of files) {
      const filePath = path.join(directory, file);
      const stats = await fs.stat(filePath);
      
      if (stats.isDirectory()) {
        // Traiter les sous-répertoires récursivement
        await processDirectory(filePath);
      } else if (stats.isFile() && (file.endsWith('.json') || file.endsWith('.js'))) {
        // Traiter les fichiers JSON et JS
        await anonymizeFile(filePath);
      }
    }
  } catch (error) {
    console.error(`Erreur lors du traitement du répertoire ${directory}:`, error.message);
  }
}

/**
 * Fonction principale
 */
async function main() {
  console.log("=== SCRIPT DE NETTOYAGE DES DONNÉES SENSIBLES ===");
  console.log("Ce script va anonymiser les données personnelles dans les fichiers de sortie");
  console.log("Démarrage du nettoyage...\n");
  
  // Traiter chaque répertoire configuré
  for (const directory of DIRECTORIES_TO_CLEAN) {
    await processDirectory(directory);
  }
  
  console.log("\n=== NETTOYAGE TERMINÉ ===");
}

// Exécuter le script
main().catch(error => {
  console.error("Erreur globale:", error);
  process.exit(1);
});