/**
 * Router principal pour FHIRHub
 * Gère toutes les routes de l'application
 */

const express = require('express');
const router = express.Router();
const apiRouter = require('./apiRouter');
const apiKeyRouter = require('./apiKeyRouter');
const applicationRouter = require('./applicationRouter');
const { isAuthenticated } = require('../middleware/authMiddleware');

// Routes API
router.use('/api', apiRouter);

// Routes pour les clés API
router.use('/api/keys', apiKeyRouter);

// Routes pour les applications
router.use('/api/applications', applicationRouter);

// Route pour la page d'accueil
router.get('/', (req, res) => {
  res.sendFile('index.html', { root: './frontend/public' });
});

// Route pour la page de documentation
router.get('/docs', (req, res) => {
  res.sendFile('docs.html', { root: './frontend/public' });
});

// Route pour la page des clés API
router.get('/api-keys', isAuthenticated, (req, res) => {
  res.sendFile('api-keys.html', { root: './frontend/public' });
});

// Route pour la page des applications
router.get('/applications', isAuthenticated, (req, res) => {
  res.sendFile('applications.html', { root: './frontend/public' });
});

// Route pour la page de profil
router.get('/profile', isAuthenticated, (req, res) => {
  res.sendFile('profile.html', { root: './frontend/public' });
});

// Route pour la page de conversion
router.get('/conversion', (req, res) => {
  res.sendFile('conversion.html', { root: './frontend/public' });
});

module.exports = router;