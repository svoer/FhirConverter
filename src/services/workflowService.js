/**
 * Service de gestion des workflows pour FHIRHub
 * Gère l'intégration avec Node-RED et les workflows personnalisés par application
 */

const db = require('./dbService');
const path = require('path');
const fs = require('fs');
const RED = require('node-red');
const http = require('http');
const express = require('express');

// État du service
let initialized = false;
let redSettings = null;
let redApp = null;
let redServer = null;

/**
 * Initialiser le service Node-RED
 * @returns {Promise<void>}
 */
async function initialize() {
  try {
    if (initialized) {
      return;
    }
    
    console.log('[WORKFLOW] Initialisation du service de workflow...');
    
    // Vérifier que la connexion à la base de données est établie
    if (!db.isInitialized()) {
      console.log('[WORKFLOW] Initialisation de la base de données requise');
      await db.initialize();
    }
    
    // Créer le répertoire pour les données Node-RED si nécessaire
    const userDir = path.join(process.cwd(), 'data', 'node-red');
    if (!fs.existsSync(userDir)) {
      fs.mkdirSync(userDir, { recursive: true });
    }
    
    // Créer une application Express dédiée à Node-RED
    redApp = express();
    
    // Créer un serveur HTTP pour Node-RED (utilisé en interne)
    redServer = http.createServer(redApp);
    
    // Configuration de Node-RED
    redSettings = {
      httpAdminRoot: '/',         // L'interface d'édition sera accessible sous /node-red/
      httpNodeRoot: '/api',       // Les API du flow seront sous /node-red/api/
      userDir: userDir,
      functionGlobalContext: {
        // On peut ajouter ici des objets accessibles dans les fonctions Node-RED
      },
      editorTheme: {
        page: {
          title: "FHIRHub Workflow",
          favicon: "/img/flame-icon.png",
          css: "/css/node-red-custom.css"
        },
        header: {
          title: "FHIRHub Workflow Editor",
          image: "/img/flame-icon-white.svg",
        },
        palette: {
          categories: [
            { id: "fhirhub", label: "FHIRHub" },
            { id: "common", label: "Standard" },
            { id: "function", label: "Fonctions" },
            { id: "input", label: "Entrées" },
            { id: "output", label: "Sorties" },
            { id: "parser", label: "Analyseurs" }
          ]
        }
      },
      logging: {
        console: {
          level: "info",
          metrics: false,
          audit: false
        }
      }
    };
    
    // Initialiser Node-RED
    RED.init(redServer, redSettings);
    
    // Charger les nœuds personnalisés
    try {
      // Spécifier le répertoire des nœuds personnalisés
      const nodesDir = path.join(process.cwd(), 'src', 'node-red', 'nodes');
      
      // Configuration pour les nœuds personnalisés
      redSettings.nodesDir = nodesDir;
      
      // Charger les nœuds manuellement en appelant leur fonction module
      const hl7InputNode = require(path.join(nodesDir, 'hl7-input.js'));
      const fhirConverterNode = require(path.join(nodesDir, 'fhir-converter.js'));
      const segmentExtractorNode = require(path.join(nodesDir, 'segment-extractor.js'));
      const fhirOutputNode = require(path.join(nodesDir, 'fhir-output.js'));
      
      // Enregistrer les nœuds dans Node-RED
      hl7InputNode(RED);
      fhirConverterNode(RED);
      segmentExtractorNode(RED);
      fhirOutputNode(RED);
      
      console.log('[WORKFLOW] Nœuds personnalisés FHIRHub enregistrés manuellement');
    } catch (error) {
      console.error('[WORKFLOW] Erreur lors du chargement des nœuds personnalisés:', error);
    }
    
    // Ajouter les routes de l'éditeur Node-RED à notre application Express
    redApp.use(redSettings.httpAdminRoot, RED.httpAdmin);
    
    // Ajouter les routes d'API Node-RED à notre application Express
    redApp.use(redSettings.httpNodeRoot, RED.httpNode);
    
    // Démarrer Node-RED sans serveur séparé, utiliser le même port que l'application principale
    await new Promise((resolve) => {
      RED.start().then(() => {
        // Stocker une référence à l'éditeur Node-RED pour y accéder plus tard
        global.nodeRedInitialized = true;
        console.log(`[WORKFLOW] Node-RED démarré et intégré à l'application principale`);
        console.log(`[WORKFLOW] Vous pouvez accéder à Node-RED via /node-red-editor/`);
        resolve();
      });
    });
    
    initialized = true;
    console.log('[WORKFLOW] Service de workflow initialisé avec succès');
  } catch (error) {
    console.error('[WORKFLOW] Erreur lors de l\'initialisation du service de workflow:', error);
    throw error;
  }
}

/**
 * Obtenir tous les workflows
 * @returns {Promise<Array>} Liste des workflows
 */
async function getAllWorkflows() {
  try {
    await initialize();
    
    const workflows = await db.query(`
      SELECT w.*, a.name as application_name
      FROM workflows w
      JOIN applications a ON w.application_id = a.id
      ORDER BY w.updated_at DESC
    `);
    
    return workflows;
  } catch (error) {
    console.error('[WORKFLOW] Erreur lors de la récupération des workflows:', error);
    throw error;
  }
}

/**
 * Obtenir tous les workflows d'une application
 * @param {number} applicationId - ID de l'application
 * @returns {Promise<Array>} Liste des workflows de l'application
 */
async function getWorkflowsByApplicationId(applicationId) {
  try {
    await initialize();
    
    const workflows = await db.query(`
      SELECT w.*, a.name as application_name
      FROM workflows w
      JOIN applications a ON w.application_id = a.id
      WHERE w.application_id = ?
      ORDER BY w.updated_at DESC
    `, [applicationId]);
    
    return workflows;
  } catch (error) {
    console.error(`[WORKFLOW] Erreur lors de la récupération des workflows pour l'application ${applicationId}:`, error);
    throw error;
  }
}

/**
 * Obtenir un workflow par son ID
 * @param {number} id - ID du workflow
 * @returns {Promise<Object|null>} Workflow trouvé ou null
 */
async function getWorkflowById(id) {
  try {
    await initialize();
    
    const workflow = await db.get(`
      SELECT w.*, a.name as application_name
      FROM workflows w
      JOIN applications a ON w.application_id = a.id
      WHERE w.id = ?
    `, [id]);
    
    return workflow;
  } catch (error) {
    console.error(`[WORKFLOW] Erreur lors de la récupération du workflow ${id}:`, error);
    throw error;
  }
}

/**
 * Créer un nouveau workflow
 * @param {Object} workflowData - Données du workflow
 * @returns {Promise<Object>} Workflow créé
 */
async function createWorkflow(workflowData) {
  try {
    await initialize();
    
    // Validation des données obligatoires
    if (!workflowData.application_id || !workflowData.name) {
      throw new Error('L\'ID de l\'application et le nom du workflow sont obligatoires');
    }
    
    // Créer un flow JSON vide par défaut si non fourni
    if (!workflowData.flow_json) {
      workflowData.flow_json = JSON.stringify([]);
    }
    
    // Insertion en base de données
    const result = await db.run(`
      INSERT INTO workflows (
        application_id, name, description, is_active, flow_json
      ) VALUES (?, ?, ?, ?, ?)
    `, [
      workflowData.application_id,
      workflowData.name,
      workflowData.description || '',
      workflowData.is_active === undefined ? 1 : workflowData.is_active,
      typeof workflowData.flow_json === 'string' ? workflowData.flow_json : JSON.stringify(workflowData.flow_json)
    ]);
    
    if (result.lastID) {
      const newWorkflow = await getWorkflowById(result.lastID);
      console.log(`[WORKFLOW] Workflow "${workflowData.name}" créé avec succès`);
      return newWorkflow;
    } else {
      throw new Error('Erreur lors de la création du workflow');
    }
  } catch (error) {
    console.error('[WORKFLOW] Erreur lors de la création du workflow:', error);
    throw error;
  }
}

/**
 * Mettre à jour un workflow
 * @param {number} id - ID du workflow
 * @param {Object} workflowData - Nouvelles données du workflow
 * @returns {Promise<Object>} Workflow mis à jour
 */
async function updateWorkflow(id, workflowData) {
  try {
    await initialize();
    
    // Vérifier si le workflow existe
    const existingWorkflow = await getWorkflowById(id);
    if (!existingWorkflow) {
      throw new Error(`Workflow avec l'ID ${id} non trouvé`);
    }
    
    // Construire la requête de mise à jour
    let updateFields = [];
    let updateValues = [];
    
    if (workflowData.name !== undefined) {
      updateFields.push('name = ?');
      updateValues.push(workflowData.name);
    }
    
    if (workflowData.description !== undefined) {
      updateFields.push('description = ?');
      updateValues.push(workflowData.description);
    }
    
    if (workflowData.is_active !== undefined) {
      updateFields.push('is_active = ?');
      updateValues.push(workflowData.is_active);
    }
    
    if (workflowData.flow_json !== undefined) {
      updateFields.push('flow_json = ?');
      updateValues.push(typeof workflowData.flow_json === 'string' 
        ? workflowData.flow_json 
        : JSON.stringify(workflowData.flow_json));
    }
    
    if (workflowData.application_id !== undefined) {
      updateFields.push('application_id = ?');
      updateValues.push(workflowData.application_id);
    }
    
    // Mettre à jour la date de modification
    updateFields.push('updated_at = CURRENT_TIMESTAMP');
    
    // Exécuter la mise à jour
    if (updateFields.length > 0) {
      updateValues.push(id);
      
      const result = await db.run(`
        UPDATE workflows 
        SET ${updateFields.join(', ')} 
        WHERE id = ?
      `, updateValues);
      
      if (result.changes > 0) {
        const updatedWorkflow = await getWorkflowById(id);
        console.log(`[WORKFLOW] Workflow avec l'ID ${id} mis à jour avec succès`);
        return updatedWorkflow;
      } else {
        console.log(`[WORKFLOW] Aucune modification apportée au workflow avec l'ID ${id}`);
        return existingWorkflow;
      }
    } else {
      console.log(`[WORKFLOW] Aucun champ à mettre à jour pour le workflow avec l'ID ${id}`);
      return existingWorkflow;
    }
  } catch (error) {
    console.error(`[WORKFLOW] Erreur lors de la mise à jour du workflow avec l'ID ${id}:`, error);
    throw error;
  }
}

/**
 * Supprimer un workflow
 * @param {number} id - ID du workflow
 * @returns {Promise<boolean>} Succès de la suppression
 */
async function deleteWorkflow(id) {
  try {
    await initialize();
    
    // Vérifier si le workflow existe
    const existingWorkflow = await getWorkflowById(id);
    if (!existingWorkflow) {
      throw new Error(`Workflow avec l'ID ${id} non trouvé`);
    }
    
    // Suppression
    const result = await db.run('DELETE FROM workflows WHERE id = ?', [id]);
    
    if (result.changes > 0) {
      console.log(`[WORKFLOW] Workflow avec l'ID ${id} supprimé avec succès`);
      return true;
    } else {
      console.error(`[WORKFLOW] Erreur lors de la suppression du workflow avec l'ID ${id}`);
      return false;
    }
  } catch (error) {
    console.error(`[WORKFLOW] Erreur lors de la suppression du workflow avec l'ID ${id}:`, error);
    throw error;
  }
}

/**
 * Exécuter un workflow pour une application
 * @param {number} applicationId - ID de l'application
 * @param {Object} inputData - Données d'entrée (message HL7)
 * @returns {Promise<Object>} Résultat du workflow
 */
async function executeWorkflow(applicationId, inputData) {
  try {
    await initialize();
    
    // Récupérer les workflows actifs pour cette application
    const workflows = await db.query(`
      SELECT * FROM workflows
      WHERE application_id = ? AND is_active = 1
      ORDER BY updated_at DESC
      LIMIT 1
    `, [applicationId]);
    
    if (!workflows || workflows.length === 0) {
      console.log(`[WORKFLOW] Aucun workflow actif trouvé pour l'application ${applicationId}`);
      return null;
    }
    
    const workflow = workflows[0];
    console.log(`[WORKFLOW] Exécution du workflow "${workflow.name}" pour l'application ${applicationId}`);
    
    // Ici, en production, on exécuterait le workflow via l'API Node-RED
    // Pour simplifier, on se contente de retourner les données d'entrée telles quelles
    return inputData;
  } catch (error) {
    console.error(`[WORKFLOW] Erreur lors de l'exécution du workflow pour l'application ${applicationId}:`, error);
    throw error;
  }
}

/**
 * Obtenir l'URL de l'éditeur Node-RED
 * @param {number} workflowId - ID du workflow à éditer
 * @returns {string} URL de l'éditeur Node-RED
 */
function getEditorUrl(workflowId) {
  if (!initialized || !redSettings) {
    throw new Error('Le service de workflow n\'est pas initialisé');
  }
  
  // Dans Replit, nous devons utiliser le port 5000 et une route spécifique
  // qui sera configurée dans app.js pour accéder à Node-RED
  const editorUrl = `/node-red-editor/?workflowId=${workflowId}`;
  console.log(`[WORKFLOW] URL de l'éditeur Node-RED: ${editorUrl}`);
  
  return editorUrl;
}

/**
 * Exporter les définitions des nœuds personnalisés pour Node-RED
 * @returns {Object} Définitions des nœuds personnalisés
 */
function getCustomNodeDefinitions() {
  return {
    // Nœud d'entrée HL7
    'fhirhub-hl7-input': {
      category: 'fhirhub',
      color: '#E63946',
      defaults: {
        name: { value: '' }
      },
      inputs: 0,
      outputs: 1,
      icon: 'font-awesome/fa-sign-in',
      label: function() { return this.name || 'HL7 Input'; }
    },
    
    // Nœud de conversion FHIR
    'fhirhub-fhir-converter': {
      category: 'fhirhub',
      color: '#457B9D',
      defaults: {
        name: { value: '' },
        messageType: { value: 'ADT' }
      },
      inputs: 1,
      outputs: 1,
      icon: 'font-awesome/fa-exchange',
      label: function() { return this.name || 'FHIR Converter'; }
    },
    
    // Nœud de sortie FHIR
    'fhirhub-fhir-output': {
      category: 'fhirhub',
      color: '#1D3557',
      defaults: {
        name: { value: '' }
      },
      inputs: 1,
      outputs: 0,
      icon: 'font-awesome/fa-sign-out',
      label: function() { return this.name || 'FHIR Output'; }
    },
    
    // Nœud d'extraction de segments HL7
    'fhirhub-segment-extractor': {
      category: 'fhirhub',
      color: '#F1FAEE',
      defaults: {
        name: { value: '' },
        segment: { value: 'PID' }
      },
      inputs: 1,
      outputs: 1,
      icon: 'font-awesome/fa-filter',
      label: function() { return this.name || `Extract ${this.segment}`; }
    },
    
    // Nœud de validation FHIR
    'fhirhub-fhir-validator': {
      category: 'fhirhub',
      color: '#A8DADC',
      defaults: {
        name: { value: '' },
        resourceType: { value: 'Patient' }
      },
      inputs: 1,
      outputs: 1,
      icon: 'font-awesome/fa-check-circle',
      label: function() { return this.name || 'FHIR Validator'; }
    }
  };
}

// Exporter les fonctions du service
module.exports = {
  initialize,
  getAllWorkflows,
  getWorkflowsByApplicationId,
  getWorkflowById,
  createWorkflow,
  updateWorkflow,
  deleteWorkflow,
  executeWorkflow,
  getEditorUrl,
  getCustomNodeDefinitions,
  // Permet d'accéder à l'application Express Node-RED pour l'intégrer à notre app principale
  getRedApp: () => redApp
};