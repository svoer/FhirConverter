/**
 * Router temporaire pour tester la configuration
 * Ce router fournit des endpoints basiques pour le tableau de bord
 */

const express = require('express');
const router = express.Router();
const os = require('os');

// Route racine
router.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'API FHIRHub - Test Router'
  });
});

// Route de statistiques
router.get('/stats', (req, res) => {
  // Générer des statistiques système de base
  const cpuUsage = Math.floor(Math.random() * 50) + 10; // 10-60%
  const memUsage = Math.floor((os.totalmem() - os.freemem()) / os.totalmem() * 100);
  const diskUsage = Math.floor(Math.random() * 30) + 5; // 5-35%
  
  res.json({
    success: true,
    data: {
      system: {
        cpu: cpuUsage,
        memory: memUsage,
        disk: diskUsage
      },
      activity: {
        totalConversions: 45,
        activeApiKeys: 3,
        totalApplications: 2,
        successRate: 98
      }
    }
  });
});

// Route de santé
router.get('/health', (req, res) => {
  res.json({
    success: true,
    status: 'healthy',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// Route de l'historique des conversions
router.get('/conversions', (req, res) => {
  // Données de démonstration pour les conversions
  const conversions = [
    {
      id: 1,
      timestamp: new Date(Date.now() - 5 * 60000).toISOString(),
      applicationName: 'Application par défaut',
      apiKey: 'dev-key',
      sourceType: 'HL7 v2.5',
      status: 'success',
      processingTime: 124
    },
    {
      id: 2,
      timestamp: new Date(Date.now() - 15 * 60000).toISOString(),
      applicationName: 'Application par défaut',
      apiKey: 'dev-key',
      sourceType: 'HL7 v2.5',
      status: 'success',
      processingTime: 98
    },
    {
      id: 3,
      timestamp: new Date(Date.now() - 60 * 60000).toISOString(),
      applicationName: 'Application par défaut',
      apiKey: 'dev-key',
      sourceType: 'HL7 v2.5',
      status: 'error',
      processingTime: 45,
      errorMessage: 'Format HL7 invalide'
    }
  ];
  
  res.json({
    success: true,
    data: conversions
  });
});

// Route pour lister les applications
router.get('/applications', (req, res) => {
  const applications = [
    {
      id: 1,
      name: 'Application par défaut',
      owner: 'admin',
      status: 'active',
      apiKeyCount: 2,
      totalUsage: 42,
      createdAt: new Date(Date.now() - 7 * 24 * 60 * 60000).toISOString()
    }
  ];
  
  res.json({
    success: true,
    data: applications
  });
});

// Route pour lister les clés API
router.get('/api-keys', (req, res) => {
  const apiKeys = [
    {
      id: 1,
      name: 'Clé de développement',
      key: 'dev-key',
      applicationId: 1,
      applicationName: 'Application par défaut',
      environment: 'development',
      status: 'active',
      usage: 42,
      expiresAt: null
    }
  ];
  
  res.json({
    success: true,
    data: apiKeys
  });
});

// Route POST pour la conversion HL7 vers FHIR
router.post('/convert', (req, res) => {
  // Simuler une conversion avec un délai
  setTimeout(() => {
    res.json({
      success: true,
      message: 'Conversion réussie',
      data: {
        resourceType: 'Bundle',
        type: 'transaction',
        entry: [
          {
            resource: {
              resourceType: 'Patient',
              id: 'example',
              name: [
                {
                  family: 'Dupont',
                  given: ['Jean']
                }
              ]
            }
          }
        ]
      }
    });
  }, 500);
});

module.exports = router;