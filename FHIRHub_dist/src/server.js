/**
 * Serveur principal FHIRHub
 * Démarre le serveur HTTP pour l'application FHIRHub
 */

const app = require('./app');
const http = require('http');

// Port d'écoute
const port = process.env.PORT || 5000;

// Créer le serveur HTTP
const server = http.createServer(app);

// Démarrer le serveur
server.listen(port, '0.0.0.0', () => {
  console.log(`Serveur FHIRHub démarré sur le port ${port}`);
  console.log('Mode API uniquement: la surveillance automatique des fichiers est désactivée.');
});