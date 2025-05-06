/**
 * Service pour l'intelligence artificielle spécialisée dans HL7 et FHIR
 * Ce service fournit des fonctionnalités avancées basées sur l'IA pour faciliter
 * la compréhension, l'analyse et la conversion des messages HL7 et des ressources FHIR
 */

const aiProviderService = require('./aiProviderService');
const axios = require('axios');

/**
 * Système d'instructions pour l'assistant IA spécialisé HL7-FHIR
 */
const SYSTEM_INSTRUCTIONS = `Tu es un expert médical informatique spécialisé dans les standards HL7 v2.5 et FHIR R4.
Ton rôle est d'aider les utilisateurs à comprendre, analyser et améliorer la conversion entre les formats HL7 et FHIR.

Conseils techniques pour les messages HL7 v2.5:
- Structure: MSH (en-tête), PID (patient), PV1 (visite), OBR (requête), OBX (observation)
- Les séparateurs sont |^~\\&
- Les segments commencent par un code à 3 lettres suivi d'un |

Pour les ressources FHIR R4:
- Structure JSON avec resourceType, id, et attributs spécifiques au type
- Les ressources principales: Patient, Encounter, Observation, ServiceRequest, etc.
- Respecte les profils français (ANS)

Quand on te présente un message HL7 ou FHIR:
1. Analyse sa structure et ses composants clés
2. Identifie les informations essentielles (patient, date, observations, etc.)
3. Explique la signification médicale des codes présents
4. Suggère des améliorations pour la conformité aux standards

Pour les conversions:
- Vérifie que tous les éléments importants ont été transférés
- Identifie les pertes potentielles d'information
- Suggère des améliorations pour une conversion plus précise

Tu es concis, précis et pédagogique. Tu assumes toujours qu'un élément manquant peut avoir un impact critique sur les soins du patient.`;

/**
 * Analyser un message HL7 v2.5 et fournir des insights avec l'IA
 * @param {string} hl7Message - Le message HL7 v2.5 à analyser
 * @param {string} [providerName='mistral'] - Le fournisseur d'IA à utiliser
 * @returns {Promise<Object>} Les insights générés par l'IA
 */
async function analyzeHL7Message(hl7Message, providerName = 'mistral') {
  try {
    // Récupérer le fournisseur d'IA
    const aiProvider = await aiProviderService.getProviderByName(providerName);
    if (!aiProvider || !aiProvider.enabled) {
      throw new Error(`Le fournisseur d'IA "${providerName}" n'est pas disponible.`);
    }

    // Construire le prompt pour l'analyse
    const userMessage = `Voici un message HL7 v2.5 que j'aimerais analyser:\n\n\`\`\`\n${hl7Message}\n\`\`\`\n\nMerci de:
1. Identifier les segments clés et leur signification
2. Extraire les informations essentielles du patient et du contexte médical
3. Expliquer brièvement l'objectif de ce message
4. Identifier d'éventuels problèmes de conformité`;

    // Envoyer la requête au bon fournisseur d'IA
    const insights = await sendAIRequest(aiProvider, [
      { role: 'system', content: SYSTEM_INSTRUCTIONS },
      { role: 'user', content: userMessage }
    ]);

    // Structurer la réponse
    return {
      analysis: insights,
      messageType: detectHL7MessageType(hl7Message),
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error('[HL7-AI] Erreur lors de l\'analyse du message HL7:', error);
    throw new Error(`Erreur lors de l'analyse du message HL7: ${error.message}`);
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
    // Récupérer le fournisseur d'IA
    const aiProvider = await aiProviderService.getProviderByName(providerName);
    if (!aiProvider || !aiProvider.enabled) {
      throw new Error(`Le fournisseur d'IA "${providerName}" n'est pas disponible.`);
    }

    // Convertir la ressource en string si c'est un objet
    const fhirString = typeof fhirResource === 'object' 
      ? JSON.stringify(fhirResource, null, 2)
      : fhirResource;

    // Construire le prompt pour l'analyse
    const userMessage = `Voici une ressource FHIR R4 que j'aimerais analyser:\n\n\`\`\`json\n${fhirString}\n\`\`\`\n\nMerci de:
1. Identifier le type de ressource et ses attributs clés
2. Extraire les informations essentielles concernant le patient et le contexte médical
3. Expliquer brièvement l'objectif de cette ressource
4. Identifier d'éventuels problèmes de conformité avec le standard FHIR R4`;

    // Envoyer la requête au bon fournisseur d'IA
    const insights = await sendAIRequest(aiProvider, [
      { role: 'system', content: SYSTEM_INSTRUCTIONS },
      { role: 'user', content: userMessage }
    ]);

    // Détecter le type de ressource
    const resourceType = detectFHIRResourceType(fhirResource);

    // Structurer la réponse
    return {
      analysis: insights,
      resourceType: resourceType,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error('[FHIR-AI] Erreur lors de l\'analyse de la ressource FHIR:', error);
    throw new Error(`Erreur lors de l'analyse de la ressource FHIR: ${error.message}`);
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
    // Récupérer le fournisseur d'IA
    const aiProvider = await aiProviderService.getProviderByName(providerName);
    if (!aiProvider || !aiProvider.enabled) {
      throw new Error(`Le fournisseur d'IA "${providerName}" n'est pas disponible.`);
    }

    // Convertir les ressources FHIR en string si c'est un objet
    const fhirString = typeof fhirResources === 'object' 
      ? JSON.stringify(fhirResources, null, 2)
      : fhirResources;

    // Construire le prompt pour l'analyse
    const userMessage = `Je viens de convertir un message HL7 v2.5 en ressources FHIR R4. 
Merci d'analyser la qualité de cette conversion et d'identifier d'éventuelles pertes d'information ou améliorations possibles.

**Message HL7 v2.5 original:**
\`\`\`
${hl7Message}
\`\`\`

**Ressources FHIR R4 générées:**
\`\`\`json
${fhirString}
\`\`\`

Merci de répondre avec:
1. Un score de qualité de conversion de 1 à 10
2. Les points forts de cette conversion
3. Les problèmes ou pertes d'information identifiés
4. Des suggestions d'amélioration spécifiques`;

    // Envoyer la requête au bon fournisseur d'IA
    const analysis = await sendAIRequest(aiProvider, [
      { role: 'system', content: SYSTEM_INSTRUCTIONS },
      { role: 'user', content: userMessage }
    ]);

    // Structurer la réponse
    return {
      analysis: analysis,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error('[CONVERSION-AI] Erreur lors de l\'analyse de la conversion:', error);
    throw new Error(`Erreur lors de l'analyse de la conversion: ${error.message}`);
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
    // Récupérer le fournisseur d'IA
    const aiProvider = await aiProviderService.getProviderByName(providerName);
    if (!aiProvider || !aiProvider.enabled) {
      throw new Error(`Le fournisseur d'IA "${providerName}" n'est pas disponible.`);
    }

    // Convertir les objets en strings
    const templateString = JSON.stringify(mappingTemplate, null, 2);
    const examplesString = JSON.stringify(conversionExamples, null, 2);

    // Construire le prompt pour l'analyse
    const userMessage = `Je cherche à améliorer mon template de mapping HL7 v2.5 vers FHIR R4. 
Merci d'analyser ce template et les exemples de conversions réussies pour suggérer des améliorations.

**Template de mapping actuel:**
\`\`\`json
${templateString}
\`\`\`

**Exemples de conversions réussies:**
\`\`\`json
${examplesString}
\`\`\`

Merci de suggérer:
1. Des améliorations pour la précision du mapping
2. Des optimisations pour gérer plus de cas particuliers
3. Des ajouts de mappings manquants
4. Des corrections pour les mappings problématiques`;

    // Envoyer la requête au bon fournisseur d'IA
    const suggestions = await sendAIRequest(aiProvider, [
      { role: 'system', content: SYSTEM_INSTRUCTIONS },
      { role: 'user', content: userMessage }
    ]);

    // Structurer la réponse
    return {
      suggestions: suggestions,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error('[MAPPING-AI] Erreur lors de la suggestion d\'améliorations pour le mapping:', error);
    throw new Error(`Erreur lors de la suggestion d'améliorations pour le mapping: ${error.message}`);
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
    // Récupérer le fournisseur d'IA
    const aiProvider = await aiProviderService.getProviderByName(providerName);
    if (!aiProvider || !aiProvider.enabled) {
      throw new Error(`Le fournisseur d'IA "${providerName}" n'est pas disponible.`);
    }

    // Convertir le message en string si c'est un objet
    const messageString = typeof message === 'object' 
      ? JSON.stringify(message, null, 2)
      : message;

    // Construire le prompt selon le type
    let userMessage;
    if (type.toLowerCase() === 'hl7') {
      userMessage = `Merci de générer une documentation détaillée expliquant ce message HL7 v2.5 pour un nouveau développeur:

\`\`\`
${messageString}
\`\`\`

La documentation doit:
1. Expliquer chaque segment et ses champs importants
2. Clarifier la signification des codes et abréviations
3. Mettre en contexte le message dans un flux de travail clinique
4. Inclure des notes explicatives sur les particularités de ce message`;
    } else {
      userMessage = `Merci de générer une documentation détaillée expliquant cette ressource FHIR R4 pour un nouveau développeur:

\`\`\`json
${messageString}
\`\`\`

La documentation doit:
1. Expliquer le type de ressource et ses attributs importants
2. Clarifier la signification des codes et terminologies utilisés
3. Mettre en contexte la ressource dans un flux de travail clinique
4. Inclure des notes explicatives sur les particularités de cette ressource`;
    }

    // Envoyer la requête au bon fournisseur d'IA
    const documentation = await sendAIRequest(aiProvider, [
      { role: 'system', content: SYSTEM_INSTRUCTIONS },
      { role: 'user', content: userMessage }
    ]);

    // Structurer la réponse
    return {
      documentation: documentation,
      messageType: type.toLowerCase(),
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error('[DOC-AI] Erreur lors de la génération de documentation:', error);
    throw new Error(`Erreur lors de la génération de documentation: ${error.message}`);
  }
}

/**
 * Détecter le type d'un message HL7 (ADT, ORU, etc.)
 * @param {string} hl7Message - Le message HL7 à analyser
 * @returns {string} Le type de message détecté
 */
function detectHL7MessageType(hl7Message) {
  try {
    // Rechercher le segment MSH et extraire le type de message
    const mshRegex = /^MSH\|.*?\|.*?\|.*?\|.*?\|.*?\|(.*?)\|/m;
    const match = hl7Message.match(mshRegex);
    
    if (match && match[1]) {
      // Retourner le type de message (ex: ADT^A01)
      return match[1];
    }
    
    return 'Unknown';
  } catch (error) {
    console.error('[HL7-AI] Erreur lors de la détection du type de message HL7:', error);
    return 'Unknown';
  }
}

/**
 * Détecter le type d'une ressource FHIR
 * @param {Object|string} fhirResource - La ressource FHIR à analyser
 * @returns {string} Le type de ressource détecté
 */
function detectFHIRResourceType(fhirResource) {
  try {
    // Si la ressource est une chaîne, la parser en objet
    const resource = typeof fhirResource === 'string' 
      ? JSON.parse(fhirResource)
      : fhirResource;
    
    // Extraire le type de ressource
    if (resource && resource.resourceType) {
      return resource.resourceType;
    }
    
    // Si c'est un tableau, prendre le premier élément
    if (Array.isArray(resource) && resource.length > 0 && resource[0].resourceType) {
      return `Bundle[${resource[0].resourceType}]`;
    }
    
    return 'Unknown';
  } catch (error) {
    console.error('[FHIR-AI] Erreur lors de la détection du type de ressource FHIR:', error);
    return 'Unknown';
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
    // Construire l'URL selon le fournisseur
    let apiUrl;
    let requestData;
    let headers = {
      'Content-Type': 'application/json'
    };
    
    switch (provider.provider_name.toLowerCase()) {
      case 'mistral':
        apiUrl = `${provider.api_url || 'https://api.mistral.ai/v1'}/chat/completions`;
        requestData = {
          model: provider.models ? provider.models.split(',')[0].trim() : 'mistral-large-latest',
          messages: messages,
          max_tokens: 2000
        };
        headers['Authorization'] = `Bearer ${provider.api_key}`;
        break;
        
      case 'openai':
        apiUrl = `${provider.api_url || 'https://api.openai.com/v1'}/chat/completions`;
        requestData = {
          model: provider.models ? provider.models.split(',')[0].trim() : 'gpt-4o',
          messages: messages,
          max_tokens: 2000
        };
        headers['Authorization'] = `Bearer ${provider.api_key}`;
        break;
        
      case 'anthropic':
        apiUrl = `${provider.api_url || 'https://api.anthropic.com/v1'}/messages`;
        // Adapter au format Anthropic
        requestData = {
          model: provider.models ? provider.models.split(',')[0].trim() : 'claude-3-7-sonnet-20250219',
          messages: messages,
          max_tokens: 2000
        };
        headers['x-api-key'] = provider.api_key;
        headers['anthropic-version'] = '2023-06-01';
        break;
        
      default:
        throw new Error(`Fournisseur d'IA "${provider.provider_name}" non pris en charge pour les analyses HL7/FHIR.`);
    }
    
    // Envoyer la requête
    const response = await axios.post(apiUrl, requestData, { headers });
    
    // Extraire la réponse selon le format du fournisseur
    let content;
    
    if (provider.provider_name.toLowerCase() === 'anthropic') {
      content = response.data.content[0].text;
    } else {
      content = response.data.choices[0].message.content;
    }
    
    return content;
  } catch (error) {
    console.error(`[AI] Erreur lors de la requête au modèle d'IA (${provider.provider_name}):`, error);
    throw new Error(`Erreur lors de la communication avec l'IA: ${error.message}`);
  }
}

module.exports = {
  analyzeHL7Message,
  analyzeFHIRResource,
  analyzeConversion,
  suggestMappingImprovements,
  generateDocumentation
};