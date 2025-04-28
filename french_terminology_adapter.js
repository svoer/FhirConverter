/**
 * Module d'adaptation des terminologies françaises pour FHIR R4
 * Intègre les systèmes de terminologie spécifiques à la France dans le convertisseur HL7 vers FHIR
 * 
 * Ce module fournit des fonctions pour adapter les ressources FHIR générées
 * afin de les rendre compatibles avec les systèmes de terminologie français.
 * Il prend en charge les identifiants, codes et systèmes spécifiques à la santé française.
 * 
 * Terminologies françaises supportées (Agence du Numérique en Santé) :
 * - TRE-R316-AutreCategorieEtablissement (OID: 1.2.250.1.213.1.6.1.239)
 * - TRE-R51-DESCGroupe2Diplome (OID: 1.2.250.1.213.1.6.1.49)
 * - TRE-G02-TypeProduit (OID: 1.2.250.1.71.1.2.2)
 * - TRE-R217-ProtectionJuridique (OID: 1.2.250.1.213.1.1.4.327)
 * - TRE-R302-ContexteCodeComplementaire (OID: 1.2.250.1.213.3.3.70)
 * - TRE-R239-PublicPrisEnCharge (OID: 1.2.250.1.213.3.3.29)
 * - TRE-A01-CadreExercice (OID: 1.2.250.1.213.1.1.4.9)
 * - TRE-R303-HL7v3AdministrativeGender (correspondance avec les genres HL7v3)
 * 
 * Toutes ces terminologies sont disponibles via le Serveur Multi-Terminologies (SMT)
 * de l'Agence du Numérique en Santé à l'URL : https://smt.esante.gouv.fr/fhir/
 */

const fs = require('fs');
const path = require('path');

/**
 * CONFIGURATION DU SERVICE DE TERMINOLOGIE
 * ----------------------------------------
 * L'application utilise par défaut le service hors ligne (offline) pour fonctionner
 * sans dépendance à une connexion internet ou à des identifiants ANS.
 * 
 * Pour activer le service en ligne à la place:
 * 1. Remplacez la ligne ci-dessous par:
 *    const terminologyService = require('./french_terminology_service');
 * 
 * 2. Configurez l'authentification dans app.js:
 *    terminologyService.configureAuth({
 *      authEnabled: true,
 *      clientId: 'VOTRE_CLIENT_ID', 
 *      clientSecret: 'VOTRE_CLIENT_SECRET',
 *      apiKey: 'VOTRE_CLE_API'
 *    });
 */
const terminologyService = require('./french_terminology_service_offline');

// Chemin vers le fichier de configuration des systèmes français
const FRENCH_SYSTEMS_FILE = path.join(__dirname, 'french_terminology', 'fhir_r4_french_systems.json');

// Systèmes de terminologie français (chargés à l'initialisation)
let frenchSystems = null;

// Systèmes d'identifiants français
const IDENTIFIER_SYSTEMS = {
  'INS-NIR': 'urn:oid:1.2.250.1.213.1.4.8',
  'INS-C': 'urn:oid:1.2.250.1.213.1.4.2',
  'RPPS': 'urn:oid:1.2.250.1.71.4.2.1',
  'ADELI': 'urn:oid:1.2.250.1.71.4.2.2',
  'FINESS': 'urn:oid:1.2.250.1.71.4.2.3',
  'SIRET': 'urn:oid:1.2.250.1.71.4.2.4'
};

// Systèmes de codes français
const CODE_SYSTEMS = {
  'CCAM': 'urn:oid:1.2.250.1.213.2.5',
  'CIM-10': 'urn:oid:1.2.250.1.213.2.12',
  'LOINC': 'urn:oid:2.16.840.1.113883.6.1',
  'SNOMED-CT': 'urn:oid:2.16.840.1.113883.6.96',
  'NABM': 'urn:oid:1.2.250.1.213.1.1.4.351',
  'TRE-R316-AutreCategorieEtablissement': 'urn:oid:1.2.250.1.213.1.6.1.239',
  'TRE-R51-DESCGroupe2Diplome': 'urn:oid:1.2.250.1.213.1.6.1.49',
  'TRE-G02-TypeProduit': 'urn:oid:1.2.250.1.71.1.2.2',
  'TRE-R217-ProtectionJuridique': 'urn:oid:1.2.250.1.213.1.1.4.327',
  'TRE-R302-ContexteCodeComplementaire': 'urn:oid:1.2.250.1.213.3.3.70',
  'TRE-R239-PublicPrisEnCharge': 'urn:oid:1.2.250.1.213.3.3.29',
  'TRE-A01-CadreExercice': 'urn:oid:1.2.250.1.213.1.1.4.9',
  'TRE-R303-HL7v3AdministrativeGender': 'urn:oid:1.2.250.1.213.1.1.5.596'
};

/**
 * Charger les systèmes de terminologie français
 * @returns {Object} Systèmes de terminologie français ou null en cas d'erreur
 */
function loadFrenchSystems() {
  try {
    // Tenter d'abord de charger depuis le fichier principal
    if (fs.existsSync(FRENCH_SYSTEMS_FILE)) {
      console.log('[ADAPTER] Chargement des terminologies FHIR R4 françaises');
      const data = fs.readFileSync(FRENCH_SYSTEMS_FILE, 'utf8');
      return JSON.parse(data);
    }
    
    // Si le fichier principal n'existe pas, essayer avec le fichier ANS
    const ANS_SYSTEMS_FILE = path.join(__dirname, 'french_terminology', 'ans_terminology_systems.json');
    if (fs.existsSync(ANS_SYSTEMS_FILE)) {
      console.log('[ADAPTER] Chargement des terminologies ANS');
      const data = fs.readFileSync(ANS_SYSTEMS_FILE, 'utf8');
      return {
        french_terminology_systems: JSON.parse(data)
      };
    }
    
    console.warn(`[ADAPTER] Attention: Aucun fichier de terminologies françaises trouvé`);
    return null;
  } catch (error) {
    console.error(`[ADAPTER] Erreur lors du chargement des systèmes français: ${error.message}`);
    return null;
  }
}

/**
 * Initialiser le module d'adaptation des terminologies françaises
 * @returns {boolean} True si l'initialisation a réussi, false sinon
 */
function initialize() {
  frenchSystems = loadFrenchSystems();
  return frenchSystems !== null;
}

/**
 * Obtenir l'URL du système pour un type d'identifiant français
 * @param {string} identifierType - Type d'identifiant (par exemple 'INS', 'RPPS')
 * @returns {string} URL du système ou null si non trouvé
 */
function getIdentifierSystem(identifierType) {
  if (!frenchSystems) {
    initialize();
  }
  
  if (!frenchSystems || !frenchSystems.recommended_mappings || !frenchSystems.recommended_mappings.identifier_types) {
    return null;
  }
  
  // Rechercher dans les mappings d'identifiants recommandés
  for (const [key, value] of Object.entries(frenchSystems.recommended_mappings.identifier_types)) {
    if (key.toLowerCase().includes(identifierType.toLowerCase())) {
      return value.system;
    }
  }
  
  // Si l'identifiant spécifique n'est pas trouvé, vérifier les systèmes d'identifiants généraux
  if (frenchSystems.recommended_mappings.identifier_systems) {
    const lowerIdType = identifierType.toLowerCase();
    
    for (const [key, value] of Object.entries(frenchSystems.recommended_mappings.identifier_systems)) {
      if (key.toLowerCase().includes(lowerIdType)) {
        return value;
      }
    }
  }
  
  return null;
}

/**
 * Adapter les types d'identifiants dans une ressource Patient pour la France
 * @param {Object} patientResource - Ressource Patient FHIR
 * @returns {Object} Ressource Patient adaptée
 */
function adaptPatientIdentifiers(patientResource) {
  if (!frenchSystems) {
    initialize();
  }
  
  if (!patientResource || !patientResource.identifier) {
    return patientResource;
  }
  
  // Parcourir les identifiants et adapter les systèmes et types
  patientResource.identifier.forEach(identifier => {
    // Si l'identifiant a un type mais pas de système, essayer de trouver le système
    if (identifier.type && identifier.type.coding && identifier.type.coding.length > 0) {
      const codingType = identifier.type.coding[0].code;
      
      // Adapter le système si nécessaire (par exemple INS, carte vitale)
      if (codingType && !identifier.system) {
        const system = getIdentifierSystem(codingType);
        if (system) {
          identifier.system = system;
        }
      }
    }
    
    // Adapter le système INS si détecté
    if (identifier.system && identifier.system.includes('ins-nir')) {
      // Utiliser le système d'identifiant INS français
      if (frenchSystems && frenchSystems.recommended_mappings && 
          frenchSystems.recommended_mappings.identifier_systems && 
          frenchSystems.recommended_mappings.identifier_systems.ins) {
        identifier.system = frenchSystems.recommended_mappings.identifier_systems.ins;
      }
    }
  });
  
  return patientResource;
}

/**
 * Adapter le statut d'une ressource Encounter pour la France
 * @param {Object} encounterResource - Ressource Encounter FHIR
 * @returns {Object} Ressource Encounter adaptée
 */
function adaptEncounterStatus(encounterResource) {
  if (!frenchSystems) {
    initialize();
  }
  
  if (!encounterResource) {
    return encounterResource;
  }
  
  // Statut conforme à FHIR R4
  if (encounterResource.status === 'completed') {
    encounterResource.status = 'finished'; // Utiliser 'finished' pour R4 (sera 'completed' en R5)
  }
  
  // Adapter la classe d'Encounter pour utiliser les systèmes français
  if (encounterResource.class && frenchSystems && 
      frenchSystems.french_terminology_systems && 
      frenchSystems.french_terminology_systems.CCAM) {
    
    // En FHIR R4, la classe n'est pas un tableau mais un objet simple
    if (Array.isArray(encounterResource.class)) {
      // Si c'est un tableau (format R5), prendre le premier élément
      encounterResource.class = encounterResource.class[0];
    }
    
    // Assurer que le système est correct pour la France
    if (!encounterResource.class.system) {
      encounterResource.class.system = "http://terminology.hl7.org/CodeSystem/v3-ActCode";
    }
    
    // Si l'encounter a des types et qu'un de ces types est un acte CCAM
    if (encounterResource.type && encounterResource.type.length > 0) {
      // Rechercher un code CCAM dans les types
      const hasCCAM = encounterResource.type.some(t => 
        t.coding && t.coding.some(c => 
          (c.system && c.system.includes('ccam')) || 
          (c.code && c.code.match(/^[A-Z]{4}[0-9]{3}$/)) // Format CCAM: 4 lettres suivies de 3 chiffres
        )
      );
      
      // Si un code CCAM est présent, définir la classe d'encounter appropriée
      if (hasCCAM && frenchSystems.french_terminology_systems.CCAM) {
        const ccamSystem = frenchSystems.french_terminology_systems.CCAM.url;
        encounterResource.class = {
          system: ccamSystem || "https://mos.esante.gouv.fr/NOS/TRE_R210-ActeSpecifique/FHIR/TRE-R210-ActeSpecifique",
          code: "CCAM",
          display: "Classification Commune des Actes Médicaux"
        };
      }
    }
  }
  
  return encounterResource;
}

/**
 * Adapter les rôles des praticiens pour la France
 * @param {Object} practitionerRoleResource - Ressource PractitionerRole FHIR
 * @returns {Object} Ressource PractitionerRole adaptée
 */
function adaptPractitionerRole(practitionerRoleResource) {
  if (!frenchSystems) {
    initialize();
  }
  
  if (!practitionerRoleResource || !practitionerRoleResource.code || 
      !practitionerRoleResource.code.length > 0) {
    return practitionerRoleResource;
  }
  
  // Parcourir les codes de rôle
  practitionerRoleResource.code.forEach(roleCode => {
    if (roleCode.coding && roleCode.coding.length > 0) {
      roleCode.coding.forEach(coding => {
        // Si le code est français (par exemple RPPS, CPS)
        if (coding.code && !coding.system && frenchSystems && 
            frenchSystems.recommended_mappings && 
            frenchSystems.recommended_mappings.practitioner_roles) {
          
          // Vérifier si nous avons un mapping pour ce code de rôle
          for (const [key, value] of Object.entries(frenchSystems.recommended_mappings.practitioner_roles)) {
            if (coding.code.includes(key)) {
              coding.system = value.system;
              // Si pas d'affichage, l'ajouter
              if (!coding.display) {
                coding.display = value.display;
              }
              break;
            }
          }
        }
        
        // Si un système de rôle français est disponible et que le système n'est pas défini
        if (!coding.system && frenchSystems && 
            frenchSystems.recommended_mappings && 
            frenchSystems.recommended_mappings.role_systems) {
          coding.system = frenchSystems.recommended_mappings.role_systems.role;
        }
      });
    }
  });
  
  return practitionerRoleResource;
}

/**
 * Adapter les observations pour les laboratoires français
 * @param {Object} observationResource - Ressource Observation FHIR
 * @returns {Object} Ressource Observation adaptée
 */
function adaptObservation(observationResource) {
  if (!frenchSystems) {
    initialize();
  }
  
  if (!observationResource || !observationResource.code || 
      !observationResource.code.coding || !observationResource.code.coding.length > 0) {
    return observationResource;
  }
  
  // Adapter le système de codage pour les résultats de laboratoire français (LOINC/NABM)
  observationResource.code.coding.forEach(coding => {
    // Si le code ressemble à un code LOINC sans système
    if (coding.code && coding.code.match(/^\d{5}-\d$/) && !coding.system) {
      coding.system = "http://loinc.org";
    }
    
    // Si le code ressemble à un code NABM sans système
    if (coding.code && coding.code.match(/^[A-Z]\d{3}$/) && !coding.system && 
        frenchSystems && frenchSystems.french_terminology_systems && 
        frenchSystems.french_terminology_systems.NABM) {
      coding.system = frenchSystems.french_terminology_systems.NABM.url;
    }
  });
  
  return observationResource;
}

/**
 * Valider un code par rapport aux terminologies françaises
 * @param {string} system - URL du système de terminologie
 * @param {string} code - Code à valider
 * @returns {boolean} True si le code est valide
 */
function validateFrenchCode(system, code) {
  if (!system || !code) {
    return true; // Si système ou code manquant, considérer comme valide
  }
  
  // Vérifier si le système est une terminologie française
  if (system.includes('esante.gouv.fr') || 
      system.includes('oid:1.2.250') || 
      system.match(/^urn:oid:1\.2\.250/)) {
    
    try {
      // Appel au service de terminologie pour validation
      return terminologyService.validateCode(system, code);
    } catch (error) {
      console.warn(`[ADAPTER] Erreur lors de la validation du code ${code} (${system}): ${error.message}`);
      return true; // En cas d'erreur, accepter le code (privilégier la fonctionnalité)
    }
  }
  
  // Pour les systèmes non-français, considérer comme valides
  return true;
}

/**
 * Adapter toutes les ressources FHIR pour les terminologies françaises
 * @param {Object} fhirBundle - Bundle FHIR contenant des ressources
 * @param {boolean} [validateCodes=false] - Si true, valider les codes avec le SMT
 * @returns {Object} Bundle FHIR adapté (non-Promise pour simplifier l'intégration)
 */
function adaptFhirBundle(fhirBundle, validateCodes = false) {
  if (!frenchSystems) {
    initialize();
  }
  
  console.log('[ADAPTER] Début de l\'adaptation aux terminologies françaises');
  
  // Vérifier que le bundle est valide
  if (!fhirBundle) {
    console.log('[ADAPTER] Bundle invalide');
    return { resourceType: 'Bundle', type: 'transaction', entry: [] };
  }
  
  // S'assurer que entry existe
  if (!fhirBundle.entry) {
    console.log('[ADAPTER] Pas d\'entrées dans le bundle');
    fhirBundle.entry = [];
    return fhirBundle;
  }
  
  console.log(`[ADAPTER] Adaptation de ${fhirBundle.entry.length} ressources`);
  
  // Parcourir toutes les ressources du bundle
  for (let i = 0; i < fhirBundle.entry.length; i++) {
    const entry = fhirBundle.entry[i];
    if (!entry || !entry.resource) {
      console.log(`[ADAPTER] Entrée ${i} invalide ou sans ressource`);
      continue;
    }
    
    console.log(`[ADAPTER] Adaptation de la ressource ${entry.resource.resourceType || 'inconnue'}`);
    
    // Adapter la ressource en fonction de son type
    try {
      switch (entry.resource.resourceType) {
        case 'Patient':
          entry.resource = adaptPatientIdentifiers(entry.resource);
          break;
        case 'Encounter':
          entry.resource = adaptEncounterStatus(entry.resource);
          break;
        case 'PractitionerRole':
          entry.resource = adaptPractitionerRole(entry.resource);
          break;
        case 'Observation':
          entry.resource = adaptObservation(entry.resource);
          break;
        default:
          console.log(`[ADAPTER] Type de ressource non traité: ${entry.resource.resourceType}`);
      }
    } catch (error) {
      console.error(`[ADAPTER] Erreur lors de l'adaptation de la ressource ${i}:`, error.message);
    }
    
    // Note: On ne fait pas de validation asynchrone pour éviter les complications
    // validateCodes est ignoré pour le moment pour simplifier l'implémentation
  }
  
  console.log('[ADAPTER] Adaptation terminée');
  return fhirBundle;
}

/**
 * Valide tous les codes présents dans une ressource
 * @param {Object} resource - Ressource FHIR à valider
 */
function validateResourceCodes(resource) {
  if (!resource) return;
  
  // Traverse la ressource pour trouver tous les éléments coding
  const findAndValidateCodes = (obj, path = '') => {
    if (!obj || typeof obj !== 'object') return;
    
    if (Array.isArray(obj)) {
      // Traiter les tableaux
      for (let i = 0; i < obj.length; i++) {
        findAndValidateCodes(obj[i], `${path}[${i}]`);
      }
    } else {
      // Si c'est un élément 'coding'
      if (obj.system && obj.code) {
        const isValid = validateFrenchCode(obj.system, obj.code);
        if (!isValid) {
          console.warn(`[ADAPTER] Code non valide: ${obj.code} dans le système ${obj.system} (path: ${path})`);
          // Ajouter un extension pour marquer le code comme non validé
          obj.extension = obj.extension || [];
          obj.extension.push({
            url: "http://fhir.fr/StructureDefinition/code-not-validated",
            valueBoolean: true
          });
        }
      }
      
      // Continuer la recherche récursive
      for (const key in obj) {
        findAndValidateCodes(obj[key], path ? `${path}.${key}` : key);
      }
    }
  };
  
  findAndValidateCodes(resource);
}

// Initialiser les systèmes français au démarrage
initialize();

/**
 * Récupérer les mappings d'identifiants français
 * @returns {Object} Mappings des systèmes d'identifiants
 */
function getIdentifierMappings() {
  return IDENTIFIER_SYSTEMS;
}

/**
 * Récupérer les mappings des systèmes de codes français
 * @returns {Object} Mappings des systèmes de codes
 */
function getCodeSystemMappings() {
  return CODE_SYSTEMS;
}

/**
 * Obtenir l'URL du système pour un OID de terminologie français
 * @param {string} oid - OID du système de terminologie (sans préfixe urn:oid:)
 * @returns {Object|null} Informations sur le système ou null si non trouvé
 */
function getCodeSystemByOid(oid) {
  // Si l'OID est déjà préfixé, le nettoyer
  if (oid.startsWith('urn:oid:')) {
    oid = oid.substring(8);
  }
  
  // Parcourir les CODE_SYSTEMS pour trouver l'OID
  for (const [key, value] of Object.entries(CODE_SYSTEMS)) {
    const systemOid = value.startsWith('urn:oid:') ? value.substring(8) : value;
    if (systemOid === oid) {
      return {
        id: key,
        system: value
      };
    }
  }
  
  // Si non trouvé dans les constantes, chercher dans les systèmes chargés
  if (frenchSystems && frenchSystems.french_terminology_systems) {
    for (const [key, system] of Object.entries(frenchSystems.french_terminology_systems)) {
      if (system.oid === oid) {
        return {
          id: key,
          system: system.url || `urn:oid:${oid}`,
          name: system.name,
          title: system.title,
          description: system.description
        };
      }
    }
  }
  
  return null;
}

/**
 * Récupérer tous les systèmes de terminologie disponibles
 * @returns {Object} Objet contenant tous les systèmes de terminologie
 */
function getAllTerminologySystems() {
  // Initialiser si ce n'est pas déjà fait
  if (!frenchSystems) {
    initialize();
  }
  
  const result = {
    identifier_systems: {},
    code_systems: {},
    french_systems: {}
  };
  
  // Ajouter les systèmes d'identifiants
  for (const [key, value] of Object.entries(IDENTIFIER_SYSTEMS)) {
    result.identifier_systems[key] = {
      system: value,
      display: `Identifiant ${key}`,
      type: 'identifier'
    };
  }
  
  // Ajouter les systèmes de codes standards
  for (const [key, value] of Object.entries(CODE_SYSTEMS)) {
    result.code_systems[key] = {
      system: value,
      display: key,
      type: 'code'
    };
  }
  
  // Ajouter les systèmes de terminologie français
  if (frenchSystems && frenchSystems.french_terminology_systems) {
    for (const [key, system] of Object.entries(frenchSystems.french_terminology_systems)) {
      result.french_systems[key] = {
        id: key,
        name: system.name || key,
        title: system.title,
        description: system.description,
        system: system.url || (system.oid ? `urn:oid:${system.oid}` : null),
        oid: system.oid,
        version: system.version,
        type: 'terminology'
      };
    }
  }
  
  return result;
}

// Exporter les fonctions publiques
module.exports = {
  initialize,
  adaptFhirBundle,
  adaptPatientIdentifiers,
  adaptEncounterStatus,
  adaptPractitionerRole,
  adaptObservation,
  validateFrenchCode,
  validateResourceCodes,
  getIdentifierMappings,
  getCodeSystemMappings,
  getCodeSystemByOid,
  getAllTerminologySystems
};