/**
 * Script de compilation simplifié pour TypeScript
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('Compilation des fichiers TypeScript...');

try {
  // Vérifier si le dossier dist existe, sinon le créer
  const distDir = path.join(__dirname, 'dist');
  if (!fs.existsSync(distDir)) {
    fs.mkdirSync(distDir, { recursive: true });
  }

  // Compiler les fichiers TypeScript en mode production
  execSync('npx tsc', { stdio: 'inherit' });

  console.log('Compilation terminée avec succès.');
} catch (error) {
  console.error('Erreur lors de la compilation:', error.message);
  process.exit(1);
}