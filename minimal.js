/**
 * Application FHIRHub minimale pour le débogage
 * @version 1.1.1
 * @updated 2025-04-29
 */

const express = require('express');
const fs = require('fs');
const path = require('path');

// Configuration de l'application
const app = express();
const PORT = process.env.PORT || 5000;

// Middleware de base
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Route de test simple
app.get('/api/test', (req, res) => {
  res.json({
    success: true,
    message: 'API FHIRHub en ligne',
    timestamp: new Date().toISOString()
  });
});

// Route simple pour la conversion
app.post('/api/convert', (req, res) => {
  try {
    const { hl7Message } = req.body;
    
    if (!hl7Message) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Le message HL7 est requis'
      });
    }
    
    return res.status(200).json({
      success: true,
      message: 'Message HL7 reçu',
      length: hl7Message.length
    });
  } catch (error) {
    console.error('[TEST ERROR]', error);
    
    return res.status(500).json({
      success: false,
      error: 'Internal Error',
      message: error.message || 'Erreur inconnue'
    });
  }
});

// Route par défaut pour les autres requêtes
app.get('*', (req, res) => {
  res.json({
    success: false,
    error: 'Not Found',
    message: 'Route non définie'
  });
});

// Démarrage du serveur
app.listen(PORT, () => {
  console.log(`[SERVER] FHIRHub (version minimale) démarré sur le port ${PORT}`);
});