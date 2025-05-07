/**
 * Service pour l'intelligence artificielle spécialisée dans HL7 et FHIR
 * Ce service fournit des fonctionnalités avancées basées sur l'IA pour faciliter
 * la compréhension, l'analyse et la conversion des messages HL7 et des ressources FHIR
 */

const axios = require('axios');
const dbService = require('../db/dbService');
const { promiseWithTimeout } = require('../utils/promiseUtils');
const fs = require('fs');
const path = require('path');

// Durée maximale d'une requête IA (en ms)
const AI_REQUEST_TIMEOUT = 60000; // Augmenté à 60 secondes pour correspondre au timeout d'Axios

// Configuration du mode hors ligne pour les analyses IA
const OFFLINE_MODE_ENABLED = false; // Mode hors ligne désactivé suite à la demande de l'utilisateur
const OFFLINE_DATA_PATH = path.join(__dirname, '../../data/ai_responses');

/**
 * Système d'instructions pour l'assistant IA spécialisé HL7-FHIR
 */
const HL7_FHIR_SYSTEM_INSTRUCTIONS = `
Vous êtes un expert en interopérabilité des systèmes de santé, spécialisé dans les standards HL7 v2.x et FHIR.
Votre rôle est d'analyser et d'expliquer avec précision les structures de données de santé.

Quelques règles importantes à suivre:
1. Vos explications doivent être techniques et factuelles, basées sur les spécifications officielles
2. Pour HL7 v2.x, référez-vous aux standards officiels de Health Level Seven International
3. Pour FHIR, référez-vous à la version R4 (4.0.1) qui est la version de référence en France (ANS)
4. Incluez toujours des détails sur les mappings/correspondances entre HL7 v2.x et FHIR
5. Tenez compte des spécificités françaises lorsqu'elles sont pertinentes (ex: systèmes de codage nationaux, réglementation)
6. Structurez vos réponses avec des sections claires et des exemples précis
7. Ne fournissez que des informations vérifiables et conformes aux standards

Formats de réponse:
- Utilisez un format structuré avec des titres et sous-titres clairs
- Incluez des tableaux de comparaison lorsque pertinent
- Fournissez des exemples de code ou de structures de données

Terminologies françaises à connaître:
- CIM-10 (ICD-10): Classification Internationale des Maladies
- CCAM: Classification Commune des Actes Médicaux
- UCD: Unité Commune de Dispensation (médicaments)
- RPPS: Répertoire Partagé des Professionnels intervenant dans le système de Santé
- INS: Identifiant National de Santé
`;

/**
 * Analyser un message HL7 v2.5 et fournir des insights avec l'IA
 * @param {string} hl7Message - Le message HL7 v2.5 à analyser
 * @param {string} [providerName='mistral'] - Le fournisseur d'IA à utiliser
 * @returns {Promise<Object>} Les insights générés par l'IA
 */
async function analyzeHL7Message(hl7Message, providerName = 'mistral') {
  try {
    // Détecter le type de message pour une meilleure analyse
    const messageType = detectHL7MessageType(hl7Message);
    console.log(`[AI] Type de message détecté: ${messageType}`);
    
    // Mode hors ligne activé et dossier ai_responses existe?
    if (OFFLINE_MODE_ENABLED) {
      try {
        console.log('[AI] Mode hors ligne activé. Utilisation des réponses précalculées.');
        
        // Vérifier que le dossier existe
        if (!fs.existsSync(OFFLINE_DATA_PATH)) {
          fs.mkdirSync(OFFLINE_DATA_PATH, { recursive: true });
          console.log(`[AI] Dossier ${OFFLINE_DATA_PATH} créé.`);
        }
        
        const genericResponsePath = path.join(OFFLINE_DATA_PATH, 'generic_hl7_analysis.md');
        
        if (fs.existsSync(genericResponsePath)) {
          console.log(`[AI] Utilisation de l'analyse générique depuis ${genericResponsePath}`);
          
          // Lire le fichier de réponse générique
          let analysis = fs.readFileSync(genericResponsePath, 'utf8');
          
          // Personnaliser légèrement la réponse en fonction du type de message
          if (messageType !== 'ADT') {
            analysis = analysis.replace(/ADT \(Admit Discharge Transfer\)/g, `${messageType} (Message ${messageType})`);
            analysis = analysis.replace(/ADT\^A01/g, `${messageType}`);
            analysis = analysis.replace(/ADT\^A01 \(Admission d'un patient\)/g, `${messageType} (Message ${messageType})`);
          }
          
          // Extraire des informations spécifiques du message HL7 pour personnaliser encore plus
          const mshSegment = hl7Message.split('\n').find(line => line.startsWith('MSH|'));
          const pidSegment = hl7Message.split('\n').find(line => line.startsWith('PID|'));
          
          if (mshSegment) {
            const mshParts = mshSegment.split('|');
            if (mshParts.length > 8) {
              const actualMessageType = mshParts[8].trim();
              analysis = analysis.replace(/ADT\^A01/g, actualMessageType);
            }
          }
          
          // Ajouter des détails sur les segments présents
          const segments = hl7Message.split('\n')
            .filter(line => line.trim().length > 0)
            .map(line => line.substring(0, 3));
          
          const uniqueSegments = [...new Set(segments)];
          const segmentsList = uniqueSegments.join(', ');
          
          analysis = analysis.replace(/## Description détaillée des segments présents[\s\S]*?(?=## Informations)/gm, 
            `## Description détaillée des segments présents\n\nSegments identifiés dans ce message: ${segmentsList}\n\n`);
          
          console.log('[AI] Analyse personnalisée préparée avec succès.');
          return analysis;
        } else {
          console.log('[AI] Fichier d\'analyse générique non trouvé. Création d\'une analyse simple.');
          
          // Créer une analyse basique
          return createSimpleHL7Analysis(hl7Message);
        }
      } catch (offlineError) {
        console.error('[AI] Erreur en mode hors ligne:', offlineError);
        return createSimpleHL7Analysis(hl7Message);
      }
    }
    
    // Mode en ligne - tenter d'utiliser l'API IA
    console.log('[AI] Tentative d\'analyse en ligne avec l\'API...');
    
    // Récupérer les informations du fournisseur d'IA
    const provider = await getAIProvider(providerName);
    
    if (!provider) {
      throw new Error(`Fournisseur d'IA '${providerName}' non trouvé ou non activé`);
    }
    
    // Créer le prompt pour l'analyse HL7
    const messages = [
      { role: 'system', content: HL7_FHIR_SYSTEM_INSTRUCTIONS },
      { role: 'user', content: `
Voici un message HL7 v2.5 à analyser en détail:

\`\`\`
${hl7Message}
\`\`\`

Merci de fournir une analyse complète avec les éléments suivants:
1. Type et structure du message (ADT, ORU, etc.)
2. Description détaillée de chaque segment présent
3. Informations cliniques ou administratives contenues dans le message
4. Correspondances FHIR pour les informations principales
5. Points d'attention ou particularités notables

Présentez l'analyse sous forme structurée avec des titres clairs.
` }
    ];
    
    // Envoyer la requête au modèle d'IA avec timeout
    const response = await promiseWithTimeout(
      sendAIRequest(provider, messages),
      AI_REQUEST_TIMEOUT,
      'La requête à l\'IA a pris trop de temps'
    );
    
    // Mettre à jour le compteur d'utilisation
    await updateProviderUsage(provider.id);
    
    // Sauvegarder cette réponse pour une utilisation future hors ligne
    try {
      const responseFilePath = path.join(OFFLINE_DATA_PATH, `hl7_analysis_${messageType}_${Date.now()}.md`);
      fs.writeFileSync(responseFilePath, response);
      console.log(`[AI] Réponse sauvegardée pour utilisation future: ${responseFilePath}`);
    } catch (saveError) {
      console.error('[AI] Erreur lors de la sauvegarde de la réponse:', saveError);
    }
    
    return response;
  } catch (error) {
    console.error('Erreur lors de l\'analyse HL7:', error);
    
    // En cas d'erreur, utiliser l'analyse simple
    try {
      return createSimpleHL7Analysis(hl7Message);
    } catch (fallbackError) {
      console.error('Erreur lors de l\'analyse de secours:', fallbackError);
      throw new Error(`Erreur d'analyse HL7: ${error.message}`);
    }
  }
}

/**
 * Créer une analyse simple d'un message HL7 sans utiliser l'IA
 * @param {string} hl7Message - Le message HL7 à analyser
 * @returns {string} Analyse basique du message
 */
function createSimpleHL7Analysis(hl7Message) {
  try {
    // Détecter le type de message
    const messageType = detectHL7MessageType(hl7Message);
    
    // Identifier les segments présents
    const segments = hl7Message.split('\n')
      .filter(line => line.trim().length > 0)
      .map(line => line.substring(0, 3));
    
    const uniqueSegments = [...new Set(segments)];
    const segmentsList = uniqueSegments.join(', ');
    
    // Extraire quelques informations basiques
    const hasPID = segments.includes('PID');
    const hasPV1 = segments.includes('PV1');
    const hasOBX = segments.includes('OBX');
    
    // Créer une analyse basique
    return `# Analyse de base du message HL7 v2.5 (${messageType})

## Type et structure du message
Ce message est de type **${messageType}**.

## Segments présents
Le message contient les segments suivants: ${segmentsList}

## Structure détectée
${hasPID ? '- Informations patient (PID) présentes' : '- Pas d\'informations patient détectées'}
${hasPV1 ? '- Informations de visite (PV1) présentes' : ''}
${hasOBX ? '- Résultats d\'observation (OBX) présents' : ''}

## Recommandations pour la conversion FHIR
${hasPID ? '- Créer une ressource Patient avec les informations du segment PID' : ''}
${hasPV1 ? '- Créer une ressource Encounter pour représenter la visite' : ''}
${hasOBX ? '- Créer des ressources Observation pour chaque segment OBX' : ''}

*Note: Cette analyse a été générée en mode hors ligne sans accès à l'IA.*
`;
  } catch (error) {
    console.error('Erreur lors de la création d\'analyse simple:', error);
    
    // En cas d'erreur lors de l'analyse simple, retourner un message encore plus basique
    return `# Analyse basique du message HL7

Ce message HL7 contient ${hl7Message.split('\n').filter(line => line.trim().length > 0).length} segments.

*Note: Analyse générée en mode dégradé suite à une erreur.*
`;
  }
}

/**
 * Analyser une ressource FHIR et fournir des insights avec l'IA
 * @param {Object|string} fhirResource - La ressource FHIR à analyser (objet ou JSON stringifié)
 * @param {string} [providerName='mistral'] - Le fournisseur d'IA à utiliser
 * @returns {Promise<Object>} Les insights générés par l'IA
 */
async function analyzeFHIRResource(fhirResource, providerName = 'mistral') {
  try {
    // S'assurer que la ressource est en format string pour l'analyse
    const fhirResourceStr = typeof fhirResource === 'string' 
      ? fhirResource 
      : JSON.stringify(fhirResource, null, 2);
    
    // Détecter le type de ressource FHIR
    const resourceType = detectFHIRResourceType(fhirResource);
    console.log(`[AI] Type de ressource FHIR détecté: ${resourceType}`);
    
    // Mode hors ligne activé?
    if (OFFLINE_MODE_ENABLED) {
      try {
        console.log('[AI] Mode hors ligne activé pour l\'analyse FHIR. Utilisation des réponses précalculées.');
        
        // Vérifier que le dossier existe
        if (!fs.existsSync(OFFLINE_DATA_PATH)) {
          fs.mkdirSync(OFFLINE_DATA_PATH, { recursive: true });
          console.log(`[AI] Dossier ${OFFLINE_DATA_PATH} créé.`);
        }
        
        const genericResponsePath = path.join(OFFLINE_DATA_PATH, 'generic_fhir_analysis.md');
        
        if (fs.existsSync(genericResponsePath)) {
          console.log(`[AI] Utilisation de l'analyse FHIR générique depuis ${genericResponsePath}`);
          
          // Lire le fichier de réponse générique
          let analysis = fs.readFileSync(genericResponsePath, 'utf8');
          
          // Personnaliser légèrement la réponse en fonction du type de ressource
          if (resourceType !== 'Patient') {
            analysis = analysis.replace(/Patient/g, resourceType);
            
            // Adapter certaines parties spécifiques à Patient
            if (resourceType === 'Observation') {
              analysis = analysis.replace(/démographiques/g, 'de mesure');
              analysis = analysis.replace(/administratives/g, 'cliniques');
            } else if (resourceType === 'Encounter') {
              analysis = analysis.replace(/démographiques/g, 'de visite');
              analysis = analysis.replace(/administratives/g, 'temporelles');
            }
          }
          
          console.log('[AI] Analyse FHIR personnalisée préparée avec succès.');
          return analysis;
        } else {
          console.log('[AI] Fichier d\'analyse FHIR générique non trouvé. Création d\'une analyse simple.');
          
          // Créer une analyse basique
          return createSimpleFHIRAnalysis(fhirResourceStr, resourceType);
        }
      } catch (offlineError) {
        console.error('[AI] Erreur en mode hors ligne pour FHIR:', offlineError);
        return createSimpleFHIRAnalysis(fhirResourceStr, resourceType);
      }
    }
    
    // Mode en ligne - tenter d'utiliser l'API IA
    console.log('[AI] Tentative d\'analyse FHIR en ligne avec l\'API...');
    
    // Récupérer les informations du fournisseur d'IA
    const provider = await getAIProvider(providerName);
    
    if (!provider) {
      throw new Error(`Fournisseur d'IA '${providerName}' non trouvé ou non activé`);
    }
    
    // Créer le prompt pour l'analyse FHIR
    const messages = [
      { role: 'system', content: HL7_FHIR_SYSTEM_INSTRUCTIONS },
      { role: 'user', content: `
Voici une ressource FHIR R4 à analyser en détail:

\`\`\`json
${fhirResourceStr}
\`\`\`

Merci de fournir une analyse complète avec les éléments suivants:
1. Type de ressource et aperçu général
2. Description détaillée des éléments principaux et leur signification
3. Références et relations avec d'autres ressources FHIR
4. Équivalents HL7 v2.x pour les informations principales
5. Conformité avec les profils français si applicable
6. Suggestions pour améliorer ou compléter la ressource

Présentez l'analyse sous forme structurée avec des titres clairs.
` }
    ];
    
    // Envoyer la requête au modèle d'IA avec timeout
    const response = await promiseWithTimeout(
      sendAIRequest(provider, messages),
      AI_REQUEST_TIMEOUT,
      'La requête à l\'IA a pris trop de temps'
    );
    
    // Mettre à jour le compteur d'utilisation
    await updateProviderUsage(provider.id);
    
    // Sauvegarder cette réponse pour une utilisation future hors ligne
    try {
      const responseFilePath = path.join(OFFLINE_DATA_PATH, `fhir_analysis_${resourceType}_${Date.now()}.md`);
      fs.writeFileSync(responseFilePath, response);
      console.log(`[AI] Réponse FHIR sauvegardée pour utilisation future: ${responseFilePath}`);
    } catch (saveError) {
      console.error('[AI] Erreur lors de la sauvegarde de la réponse FHIR:', saveError);
    }
    
    return response;
  } catch (error) {
    console.error('Erreur lors de l\'analyse FHIR:', error);
    
    try {
      // En cas d'erreur, utiliser l'analyse simple
      const resourceType = detectFHIRResourceType(fhirResource);
      const fhirResourceStr = typeof fhirResource === 'string' 
        ? fhirResource 
        : JSON.stringify(fhirResource, null, 2);
      
      return createSimpleFHIRAnalysis(fhirResourceStr, resourceType);
    } catch (fallbackError) {
      console.error('Erreur lors de l\'analyse FHIR de secours:', fallbackError);
      throw new Error(`Erreur d'analyse FHIR: ${error.message}`);
    }
  }
}

/**
 * Créer une analyse simple d'une ressource FHIR sans utiliser l'IA
 * @param {string} fhirResourceStr - La ressource FHIR en format string
 * @param {string} resourceType - Le type de ressource FHIR
 * @returns {string} Analyse basique de la ressource
 */
function createSimpleFHIRAnalysis(fhirResourceStr, resourceType) {
  try {
    // Tenter de parser la ressource pour l'analyser
    let resource;
    try {
      resource = typeof fhirResourceStr === 'string' 
        ? JSON.parse(fhirResourceStr) 
        : fhirResourceStr;
    } catch (parseError) {
      resource = { resourceType };
    }
    
    // Identifier les principales propriétés
    const keys = resource ? Object.keys(resource).filter(k => k !== 'resourceType') : [];
    const propertyList = keys.join(', ');
    
    // Créer une analyse basique
    return `# Analyse de base de la ressource FHIR ${resourceType}

## Type de ressource et aperçu général
Cette ressource est de type **${resourceType}**, qui est l'une des ressources standard du FHIR R4.

## Propriétés principales
La ressource contient les propriétés suivantes: ${propertyList || 'aucune propriété identifiée'}

## Correspondances avec HL7 v2.x
${resourceType === 'Patient' ? '- Correspond principalement au segment PID en HL7 v2.x' : ''}
${resourceType === 'Encounter' ? '- Correspond principalement au segment PV1 en HL7 v2.x' : ''}
${resourceType === 'Observation' ? '- Correspond principalement aux segments OBR et OBX en HL7 v2.x' : ''}
${resourceType === 'Medication' ? '- Correspond partiellement aux segments RXO et RXE en HL7 v2.x' : ''}
${resourceType === 'Practitioner' ? '- Correspond aux informations sur les praticiens dans divers segments HL7 v2.x' : ''}

*Note: Cette analyse a été générée en mode hors ligne sans accès à l'IA.*
`;
  } catch (error) {
    console.error('Erreur lors de la création d\'analyse FHIR simple:', error);
    
    // En cas d'erreur lors de l'analyse simple, retourner un message encore plus basique
    return `# Analyse basique de la ressource FHIR

Cette ressource FHIR semble être de type ${resourceType || 'non identifié'}.

*Note: Analyse générée en mode dégradé suite à une erreur.*
`;
  }
}

/**
 * Analyser une correspondance entre message HL7 et ressources FHIR
 * et suggérer des améliorations
 * @param {string} hl7Message - Le message HL7 v2.5 original
 * @param {Array<Object>|string} fhirResources - Les ressources FHIR générées (objet ou JSON stringifié)
 * @param {string} [providerName='mistral'] - Le fournisseur d'IA à utiliser
 * @returns {Promise<Object>} Les suggestions d'amélioration
 */
async function analyzeConversion(hl7Message, fhirResources, providerName = 'mistral') {
  try {
    // Récupérer les informations du fournisseur d'IA
    const provider = await getAIProvider(providerName);
    
    if (!provider) {
      throw new Error(`Fournisseur d'IA '${providerName}' non trouvé ou non activé`);
    }
    
    // S'assurer que les ressources FHIR sont en format string
    const fhirResourcesStr = typeof fhirResources === 'string' 
      ? fhirResources 
      : JSON.stringify(fhirResources, null, 2);
    
    // Créer le prompt pour l'analyse de conversion
    const messages = [
      { role: 'system', content: HL7_FHIR_SYSTEM_INSTRUCTIONS },
      { role: 'user', content: `
Je souhaite évaluer la qualité d'une conversion HL7 v2.5 vers FHIR.

Voici le message HL7 v2.5 original:
\`\`\`
${hl7Message}
\`\`\`

Et voici les ressources FHIR générées:
\`\`\`json
${fhirResourcesStr}
\`\`\`

Merci d'analyser cette conversion avec les éléments suivants:
1. Évaluation générale de la qualité de la conversion (complétude, conformité)
2. Vérification que toutes les informations du message HL7 se retrouvent dans les ressources FHIR
3. Identification des données manquantes ou mal converties
4. Suggestions d'améliorations spécifiques pour une meilleure conversion
5. Recommandations pour les cas particuliers ou complexes

Notez la conversion sur 10 et expliquez votre notation.
` }
    ];
    
    // Envoyer la requête au modèle d'IA avec timeout
    const response = await promiseWithTimeout(
      sendAIRequest(provider, messages),
      AI_REQUEST_TIMEOUT,
      'La requête à l\'IA a pris trop de temps'
    );
    
    // Mettre à jour le compteur d'utilisation
    await updateProviderUsage(provider.id);
    
    return response;
  } catch (error) {
    console.error('Erreur lors de l\'analyse de conversion:', error);
    throw new Error(`Erreur d'analyse de conversion: ${error.message}`);
  }
}

/**
 * Suggérer des améliorations pour un template de mapping HL7-FHIR
 * @param {Object} mappingTemplate - Le template de mapping à améliorer
 * @param {Array<Object>} conversionExamples - Exemples de conversions réussies
 * @param {string} [providerName='mistral'] - Le fournisseur d'IA à utiliser
 * @returns {Promise<Object>} Les suggestions d'amélioration
 */
async function suggestMappingImprovements(mappingTemplate, conversionExamples, providerName = 'mistral') {
  try {
    // Récupérer les informations du fournisseur d'IA
    const provider = await getAIProvider(providerName);
    
    if (!provider) {
      throw new Error(`Fournisseur d'IA '${providerName}' non trouvé ou non activé`);
    }
    
    // Convertir en string si nécessaire
    const mappingTemplateStr = typeof mappingTemplate === 'string' 
      ? mappingTemplate 
      : JSON.stringify(mappingTemplate, null, 2);
    
    // Préparer les exemples de conversion
    let examplesStr = '';
    if (conversionExamples && conversionExamples.length > 0) {
      examplesStr = `
Voici également des exemples de conversions réussies:
\`\`\`json
${JSON.stringify(conversionExamples, null, 2)}
\`\`\`
`;
    }
    
    // Créer le prompt pour l'amélioration de mapping
    const messages = [
      { role: 'system', content: HL7_FHIR_SYSTEM_INSTRUCTIONS },
      { role: 'user', content: `
J'ai besoin d'améliorer mon template de mapping HL7 v2.5 vers FHIR.

Voici mon template actuel:
\`\`\`json
${mappingTemplateStr}
\`\`\`
${examplesStr}

Merci de suggérer des améliorations avec les éléments suivants:
1. Analyse du template actuel et identification des forces et faiblesses
2. Suggestions pour améliorer la couverture des données (éléments manquants)
3. Recommandations pour optimiser les transformations et manipulations de données
4. Meilleures pratiques pour gérer les cas particuliers (valeurs nulles, formats spécifiques)
5. Propositions concrètes de modifications du template (avec exemples de code)

Votre réponse doit être axée sur des améliorations pragmatiques et conformes aux standards.
` }
    ];
    
    // Envoyer la requête au modèle d'IA avec timeout
    const response = await promiseWithTimeout(
      sendAIRequest(provider, messages),
      AI_REQUEST_TIMEOUT,
      'La requête à l\'IA a pris trop de temps'
    );
    
    // Mettre à jour le compteur d'utilisation
    await updateProviderUsage(provider.id);
    
    return response;
  } catch (error) {
    console.error('Erreur lors de la suggestion d\'améliorations de mapping:', error);
    throw new Error(`Erreur de suggestion d'améliorations: ${error.message}`);
  }
}

/**
 * Générer une documentation explicative pour un message HL7 ou une ressource FHIR
 * @param {string|Object} message - Le message HL7 ou la ressource FHIR 
 * @param {string} type - Le type de message ('hl7' ou 'fhir')
 * @param {string} [providerName='mistral'] - Le fournisseur d'IA à utiliser
 * @returns {Promise<Object>} La documentation générée
 */
async function generateDocumentation(message, type, providerName = 'mistral') {
  try {
    // Récupérer les informations du fournisseur d'IA
    const provider = await getAIProvider(providerName);
    
    if (!provider) {
      throw new Error(`Fournisseur d'IA '${providerName}' non trouvé ou non activé`);
    }
    
    // Convertir en string si nécessaire
    let messageStr = message;
    if (type === 'fhir' && typeof message === 'object') {
      messageStr = JSON.stringify(message, null, 2);
    }
    
    // Préparer l'instruction spécifique au type
    let instructionSpecifique = '';
    if (type === 'hl7') {
      instructionSpecifique = `
Merci de générer une documentation pédagogique pour ce message HL7 v2.5 avec:
1. Explication générale du type de message et de son utilisation
2. Description détaillée de chaque segment, champ et composant
3. Signification clinique ou administrative des informations présentes
4. Guide de lecture du message pour un nouvel utilisateur
5. Bonnes pratiques et points d'attention pour l'utilisation de ce type de message
`;
    } else {
      instructionSpecifique = `
Merci de générer une documentation pédagogique pour cette ressource FHIR avec:
1. Explication générale du type de ressource et de son utilisation
2. Description détaillée de chaque élément et attribut
3. Signification clinique ou administrative des informations présentes
4. Guide d'utilisation de la ressource pour un nouvel utilisateur
5. Bonnes pratiques et points d'attention pour l'utilisation de ce type de ressource
`;
    }
    
    // Créer le prompt pour la génération de documentation
    const messages = [
      { role: 'system', content: HL7_FHIR_SYSTEM_INSTRUCTIONS },
      { role: 'user', content: `
Je souhaite générer une documentation explicative et pédagogique pour mieux comprendre le contenu suivant:

\`\`\`${type === 'fhir' ? 'json' : ''}
${messageStr}
\`\`\`

${instructionSpecifique}

La documentation doit être structurée, claire et accessible, tout en restant techniquement précise.
` }
    ];
    
    // Envoyer la requête au modèle d'IA avec timeout
    const response = await promiseWithTimeout(
      sendAIRequest(provider, messages),
      AI_REQUEST_TIMEOUT,
      'La requête à l\'IA a pris trop de temps'
    );
    
    // Mettre à jour le compteur d'utilisation
    await updateProviderUsage(provider.id);
    
    return response;
  } catch (error) {
    console.error('Erreur lors de la génération de documentation:', error);
    throw new Error(`Erreur de génération de documentation: ${error.message}`);
  }
}

/**
 * Détecter le type d'un message HL7 (ADT, ORU, etc.)
 * @param {string} hl7Message - Le message HL7 à analyser
 * @returns {string} Le type de message détecté
 */
function detectHL7MessageType(hl7Message) {
  try {
    // Rechercher la ligne MSH
    const lines = hl7Message.split('\n');
    const mshLine = lines.find(line => line.startsWith('MSH|'));
    
    if (!mshLine) {
      return 'Inconnu';
    }
    
    // Extraire le type de message (champ 9)
    const segments = mshLine.split('|');
    if (segments.length < 10) {
      return 'Inconnu';
    }
    
    const messageTypeField = segments[8];
    
    // Le format est généralement comme "ADT^A01"
    return messageTypeField.replace(/\^.*$/, '') || 'Inconnu';
  } catch (error) {
    console.error('Erreur lors de la détection du type de message HL7:', error);
    return 'Inconnu';
  }
}

/**
 * Détecter le type d'une ressource FHIR
 * @param {Object|string} fhirResource - La ressource FHIR à analyser
 * @returns {string} Le type de ressource détecté
 */
function detectFHIRResourceType(fhirResource) {
  try {
    // Convertir en objet si c'est une chaîne
    const resource = typeof fhirResource === 'string' 
      ? JSON.parse(fhirResource) 
      : fhirResource;
    
    // Extraire le type de ressource
    return resource.resourceType || 'Inconnu';
  } catch (error) {
    console.error('Erreur lors de la détection du type de ressource FHIR:', error);
    return 'Inconnu';
  }
}

/**
 * Envoyer une requête à un modèle d'IA générique
 * @param {Object} provider - Le fournisseur d'IA à utiliser
 * @param {Array<Object>} messages - Les messages à envoyer
 * @returns {Promise<string>} La réponse générée
 */
async function sendAIRequest(provider, messages) {
  try {
    // Extraire les paramètres du fournisseur
    const { provider_name: providerName, api_key: apiKey, api_url: apiUrl, models, settings } = provider;
    
    // Analyser les settings et les models
    let providerSettings = {};
    if (settings) {
      try {
        providerSettings = JSON.parse(settings);
      } catch (error) {
        console.warn(`Erreur de parsing des paramètres pour ${providerName}:`, error);
      }
    }
    
    let modelsList = [];
    if (models) {
      try {
        // Correction 2025-05-06: Gestion plus robuste du parsing des modèles
        if (typeof models === 'string') {
          if (models.startsWith('[') && models.endsWith(']')) {
            // Format JSON array
            modelsList = JSON.parse(models);
          } else if (models.includes(',')) {
            // Format séparé par des virgules
            modelsList = models.split(',').map(m => m.trim());
          } else {
            // Format de modèle unique
            modelsList = [models.trim()];
          }
        }
      } catch (error) {
        console.warn(`Erreur de parsing des modèles pour ${providerName}:`, error);
        // Fallback en cas d'erreur
        modelsList = models.startsWith('[') ? [] : [models];
      }
    }
    
    // Sélectionner le modèle par défaut (premier de la liste ou null - sera géré par chaque provider)
    // Éviter les valeurs en dur pour être compatible avec toutes les IA
    const model = modelsList[0] || null;
    
    // Adaptations spécifiques aux fournisseurs
    let response = null;
    
    switch (providerName.toLowerCase()) {
      case 'mistral':
        // Pour Mistral AI
        response = await sendMistralRequest(apiKey, apiUrl, model, messages, providerSettings);
        break;
        
      case 'openai':
        // Pour OpenAI
        response = await sendOpenAIRequest(apiKey, apiUrl, model, messages, providerSettings);
        break;
        
      case 'anthropic':
        // Pour Anthropic
        response = await sendAnthropicRequest(apiKey, apiUrl, model, messages, providerSettings);
        break;
        
      case 'gemini':
      case 'google':
        // Pour Google AI (Gemini)
        response = await sendGoogleAIRequest(apiKey, apiUrl, model, messages, providerSettings);
        break;
        
      case 'ollama':
        // Pour Ollama (local)
        response = await sendOllamaRequest(apiUrl, model, messages, providerSettings);
        break;
        
      default:
        throw new Error(`Fournisseur d'IA '${providerName}' non supporté`);
    }
    
    return response;
  } catch (error) {
    console.error('Erreur lors de l\'envoi de la requête IA:', error);
    throw new Error(`Erreur de requête IA: ${error.message}`);
  }
}

/**
 * Envoyer une requête à Mistral AI
 * @param {string} apiKey - La clé API Mistral
 * @param {string} apiUrl - L'URL de l'API (optionnel)
 * @param {string} model - Le modèle à utiliser
 * @param {Array<Object>} messages - Les messages à envoyer
 * @param {Object} settings - Paramètres supplémentaires
 * @returns {Promise<string>} La réponse générée
 */
async function sendMistralRequest(apiKey, apiUrl, model, messages, settings = {}) {
  // Correction 2025-05-07: URL complète pour API Mistral
  let url = apiUrl || 'https://api.mistral.ai/v1/chat/completions';
  
  // S'assurer que l'URL se termine par chat/completions
  if (!url.endsWith('/chat/completions')) {
    if (url.endsWith('/')) {
      url = `${url}chat/completions`;
    } else {
      url = `${url}/chat/completions`;
    }
  }
  
  // Valeur par défaut du modèle si non spécifié
  const defaultModel = 'mistral-medium';
  
  // Paramètres de base
  const params = {
    model: model || defaultModel,
    messages: messages,
    temperature: settings.temperature || 0.2,
    max_tokens: settings.max_tokens || 1500  // Réduire à 1500 tokens pour accélérer la réponse
  };
  
  // Ajouter d'autres paramètres si présents
  if (settings.top_p) params.top_p = settings.top_p;
  if (settings.safe_mode !== undefined) params.safe_mode = settings.safe_mode;
  
  console.log(`[AI] Envoi de requête Mistral à: ${url}`);
  console.log(`[AI] Modèle utilisé: ${params.model}`);
  console.log(`[AI] Messages envoyés: ${messages.length}`);
  
  try {
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    };
    
    // Timeout plus long pour éviter les erreurs avec Mistral
    const response = await axios.post(url, params, { 
      headers,
      timeout: 60000  // 60 secondes de timeout, pour correspondre à notre timeout global
    });
    
    console.log('[AI] Réponse Mistral reçue. Structure:', Object.keys(response.data).join(', '));
    
    // Vérification plus robuste du format de la réponse
    if (response.data.choices && response.data.choices.length > 0 && response.data.choices[0].message) {
      return response.data.choices[0].message.content;
    } else {
      console.error('[AI] Format de réponse Mistral inattendu:', JSON.stringify(response.data).substring(0, 500));
      throw new Error('Format de réponse Mistral inattendu');
    }
  } catch (error) {
    console.error('Erreur API Mistral:', error.response?.data || error.message);
    throw new Error(`Erreur API Mistral: ${error.response?.data?.message || error.message}`);
  }
}

/**
 * Envoyer une requête à OpenAI
 * @param {string} apiKey - La clé API OpenAI
 * @param {string} apiUrl - L'URL de l'API (optionnel)
 * @param {string} model - Le modèle à utiliser
 * @param {Array<Object>} messages - Les messages à envoyer
 * @param {Object} settings - Paramètres supplémentaires
 * @returns {Promise<string>} La réponse générée
 */
async function sendOpenAIRequest(apiKey, apiUrl, model, messages, settings = {}) {
  const url = apiUrl || 'https://api.openai.com/v1/chat/completions';
  
  // Paramètres de base
  const params = {
    model: model,
    messages: messages,
    temperature: settings.temperature || 0.2,
    max_tokens: settings.max_tokens || 4000
  };
  
  // Ajouter d'autres paramètres si présents
  if (settings.top_p) params.top_p = settings.top_p;
  if (settings.frequency_penalty) params.frequency_penalty = settings.frequency_penalty;
  if (settings.presence_penalty) params.presence_penalty = settings.presence_penalty;
  
  try {
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    };
    
    // Timeout identique à celui de Mistral pour tous les fournisseurs
    const response = await axios.post(url, params, { 
      headers,
      timeout: 60000  // 60 secondes de timeout
    });
    
    // Extraire et retourner le texte de la réponse
    return response.data.choices[0].message.content;
  } catch (error) {
    console.error('Erreur API OpenAI:', error.response?.data || error.message);
    throw new Error(`Erreur API OpenAI: ${error.response?.data?.error?.message || error.message}`);
  }
}

/**
 * Envoyer une requête à Anthropic
 * @param {string} apiKey - La clé API Anthropic
 * @param {string} apiUrl - L'URL de l'API (optionnel)
 * @param {string} model - Le modèle à utiliser
 * @param {Array<Object>} messages - Les messages à envoyer
 * @param {Object} settings - Paramètres supplémentaires
 * @returns {Promise<string>} La réponse générée
 */
async function sendAnthropicRequest(apiKey, apiUrl, model, messages, settings = {}) {
  const url = apiUrl || 'https://api.anthropic.com/v1/messages';
  
  // Convertir le format des messages au format Anthropic
  const anthropicMessages = messages.filter(msg => msg.role !== 'system');
  const systemMessage = messages.find(msg => msg.role === 'system')?.content || '';
  
  // Paramètres de base
  const params = {
    model: model,
    messages: anthropicMessages,
    max_tokens: settings.max_tokens || 4000
  };
  
  // Ajouter le message système si présent
  if (systemMessage) {
    params.system = systemMessage;
  }
  
  // Ajouter d'autres paramètres si présents
  if (settings.temperature) params.temperature = settings.temperature;
  if (settings.top_p) params.top_p = settings.top_p;
  if (settings.top_k) params.top_k = settings.top_k;
  
  try {
    const headers = {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    };
    
    // Timeout identique pour tous les fournisseurs
    const response = await axios.post(url, params, { 
      headers,
      timeout: 60000  // 60 secondes de timeout
    });
    
    // Extraire et retourner le texte de la réponse
    return response.data.content[0].text;
  } catch (error) {
    console.error('Erreur API Anthropic:', error.response?.data || error.message);
    throw new Error(`Erreur API Anthropic: ${error.response?.data?.error?.message || error.message}`);
  }
}

/**
 * Envoyer une requête à Google AI (Gemini)
 * @param {string} apiKey - La clé API Google
 * @param {string} apiUrl - L'URL de l'API (optionnel)
 * @param {string} model - Le modèle à utiliser
 * @param {Array<Object>} messages - Les messages à envoyer
 * @param {Object} settings - Paramètres supplémentaires
 * @returns {Promise<string>} La réponse générée
 */
async function sendGoogleAIRequest(apiKey, apiUrl, model, messages, settings = {}) {
  const geminiModel = model || 'gemini-pro';
  const url = apiUrl || `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${apiKey}`;
  
  // Convertir le format des messages au format Gemini
  const geminiContents = [];
  let systemPrompt = '';
  
  // Extraire le message système s'il existe
  const systemMessage = messages.find(msg => msg.role === 'system');
  if (systemMessage) {
    systemPrompt = systemMessage.content;
  }
  
  // Traiter les messages utilisateur et assistant
  messages.forEach(msg => {
    if (msg.role !== 'system') {
      geminiContents.push({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.content }]
      });
    }
  });
  
  // Paramètres de base
  const params = {
    contents: geminiContents,
    generationConfig: {
      temperature: settings.temperature || 0.2,
      maxOutputTokens: settings.max_tokens || 4000,
      topP: settings.top_p || 0.95,
      topK: settings.top_k || 40
    }
  };
  
  // Ajouter le message système comme une instruction si présent
  if (systemPrompt) {
    params.systemInstruction = { parts: [{ text: systemPrompt }] };
  }
  
  try {
    const headers = {
      'Content-Type': 'application/json'
    };
    
    // Timeout identique pour tous les fournisseurs
    const response = await axios.post(url, params, { 
      headers,
      timeout: 60000  // 60 secondes de timeout
    });
    
    // Extraire et retourner le texte de la réponse
    return response.data.candidates[0].content.parts[0].text;
  } catch (error) {
    console.error('Erreur API Google AI:', error.response?.data || error.message);
    throw new Error(`Erreur API Google AI: ${error.response?.data?.error?.message || error.message}`);
  }
}

/**
 * Envoyer une requête à Ollama (instance locale)
 * @param {string} apiUrl - L'URL de l'API Ollama
 * @param {string} model - Le modèle à utiliser
 * @param {Array<Object>} messages - Les messages à envoyer
 * @param {Object} settings - Paramètres supplémentaires
 * @returns {Promise<string>} La réponse générée
 */
async function sendOllamaRequest(apiUrl, model, messages, settings = {}) {
  const url = apiUrl || 'http://localhost:11434/api/chat';
  
  // Paramètres de base
  const params = {
    model: model || 'llama3',
    messages: messages,
    stream: false,
    options: {
      temperature: settings.temperature || 0.2,
      num_predict: settings.max_tokens || 4000
    }
  };
  
  // Ajouter d'autres paramètres si présents
  if (settings.top_p) params.options.top_p = settings.top_p;
  if (settings.top_k) params.options.top_k = settings.top_k;
  
  try {
    const headers = {
      'Content-Type': 'application/json'
    };
    
    // Timeout identique pour tous les fournisseurs
    const response = await axios.post(url, params, { 
      headers,
      timeout: 60000  // 60 secondes de timeout
    });
    
    // Extraire et retourner le texte de la réponse
    return response.data.message.content;
  } catch (error) {
    console.error('Erreur API Ollama:', error.response?.data || error.message);
    throw new Error(`Erreur API Ollama: ${error.response?.data?.error || error.message}`);
  }
}

/**
 * Récupérer les informations d'un fournisseur d'IA à partir de son nom
 * @param {string} providerName - Le nom du fournisseur
 * @returns {Promise<Object>} Les informations du fournisseur
 */
async function getAIProvider(providerName) {
  try {
    // Rechercher le fournisseur dans la base de données
    const provider = await dbService.get(`
      SELECT * FROM ai_providers 
      WHERE provider_name = ? AND enabled = 1
    `, [providerName]);
    
    if (!provider) {
      // Rechercher un fournisseur par défaut si celui demandé n'est pas trouvé
      console.log(`Fournisseur '${providerName}' non trouvé, utilisation du fournisseur par défaut`);
      return await dbService.get(`
        SELECT * FROM ai_providers 
        WHERE enabled = 1 
        ORDER BY id ASC 
        LIMIT 1
      `);
    }
    
    return provider;
  } catch (error) {
    console.error('Erreur lors de la récupération du fournisseur d\'IA:', error);
    return null;
  }
}

/**
 * Mettre à jour le compteur d'utilisation d'un fournisseur d'IA
 * @param {number} providerId - L'ID du fournisseur
 * @returns {Promise<void>}
 */
async function updateProviderUsage(providerId) {
  try {
    // Mettre à jour le compteur d'utilisation et la date de dernière utilisation
    await dbService.run(`
      UPDATE ai_providers 
      SET usage_count = usage_count + 1, 
          current_usage = current_usage + 1,
          last_used_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [providerId]);
    
  } catch (error) {
    console.error('Erreur lors de la mise à jour du compteur d\'utilisation:', error);
  }
}

module.exports = {
  analyzeHL7Message,
  analyzeFHIRResource,
  analyzeConversion,
  suggestMappingImprovements,
  generateDocumentation,
  detectHL7MessageType,
  detectFHIRResourceType
};