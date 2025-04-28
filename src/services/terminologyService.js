/**
 * Service de terminologie pour FHIRHub
 * Gère les terminologies médicales et les systèmes de codes
 */

const path = require('path');
const fs = require('fs');

// Chemin des fichiers de terminologie
const TERMINOLOGY_DIR = path.join(__dirname, '../../data/terminologies');
const FRENCH_SYSTEMS_FILE = path.join(TERMINOLOGY_DIR, 'french_systems.json');
const COMMON_SYSTEMS_FILE = path.join(TERMINOLOGY_DIR, 'common_systems.json');

// Cache mémoire pour les terminologies
const terminologyCache = {
  frenchSystems: null,
  commonSystems: null,
  validationResults: {}
};

/**
 * Initialiser le service de terminologie
 * @returns {Promise<boolean>} Succès de l'initialisation
 */
async function initialize() {
  console.log('[TERMINOLOGY] Initialisation du service de terminologie');
  
  try {
    // S'assurer que le répertoire de terminologie existe
    if (!fs.existsSync(TERMINOLOGY_DIR)) {
      console.log(`[TERMINOLOGY] Création du répertoire ${TERMINOLOGY_DIR}`);
      fs.mkdirSync(TERMINOLOGY_DIR, { recursive: true });
    }
    
    // Charger les systèmes français s'ils existent
    if (fs.existsSync(FRENCH_SYSTEMS_FILE)) {
      console.log('[TERMINOLOGY] Chargement des systèmes français');
      const frenchSystemsData = fs.readFileSync(FRENCH_SYSTEMS_FILE, 'utf8');
      terminologyCache.frenchSystems = JSON.parse(frenchSystemsData);
    } else {
      console.log('[TERMINOLOGY] Création des systèmes français par défaut');
      terminologyCache.frenchSystems = getDefaultFrenchSystems();
      await saveFrenchSystems(terminologyCache.frenchSystems);
    }
    
    // Charger les systèmes communs s'ils existent
    if (fs.existsSync(COMMON_SYSTEMS_FILE)) {
      console.log('[TERMINOLOGY] Chargement des systèmes communs');
      const commonSystemsData = fs.readFileSync(COMMON_SYSTEMS_FILE, 'utf8');
      terminologyCache.commonSystems = JSON.parse(commonSystemsData);
    } else {
      console.log('[TERMINOLOGY] Création des systèmes communs par défaut');
      terminologyCache.commonSystems = getDefaultCommonSystems();
      await saveCommonSystems(terminologyCache.commonSystems);
    }
    
    console.log('[TERMINOLOGY] Service de terminologie initialisé avec succès');
    return true;
  } catch (error) {
    console.error('[TERMINOLOGY] Erreur lors de l\'initialisation du service de terminologie:', error);
    return false;
  }
}

/**
 * Obtenir la liste des systèmes de terminologie français
 * @returns {Array} Liste des systèmes français
 */
function getFrenchSystems() {
  return terminologyCache.frenchSystems || getDefaultFrenchSystems();
}

/**
 * Obtenir la liste des systèmes de terminologie communs
 * @returns {Array} Liste des systèmes communs
 */
function getCommonSystems() {
  return terminologyCache.commonSystems || getDefaultCommonSystems();
}

/**
 * Systèmes de terminologie français par défaut
 * @returns {Array} Liste des systèmes français par défaut
 */
function getDefaultFrenchSystems() {
  return [
    {
      name: 'CCAM',
      url: 'https://mos.esante.gouv.fr/NOS/CCAM_2/FHIR/CCAM',
      oid: '1.2.250.1.213.2.5',
      description: 'Classification Commune des Actes Médicaux'
    },
    {
      name: 'CIM-10',
      url: 'https://mos.esante.gouv.fr/NOS/CIM-10/FHIR/CIM-10',
      oid: '1.2.250.1.213.2.4',
      description: 'Classification Internationale des Maladies - 10ème révision'
    },
    {
      name: 'NABM',
      url: 'https://mos.esante.gouv.fr/NOS/NABM/FHIR/NABM',
      oid: '1.2.250.1.213.1.1.5.5',
      description: 'Nomenclature des Actes de Biologie Médicale'
    },
    {
      name: 'SNOMED 3.5',
      url: 'https://mos.esante.gouv.fr/NOS/SNOMED_35/FHIR/SNOMED35',
      oid: '1.2.250.1.213.2.12',
      description: 'Systematized Nomenclature of Medicine - Version 3.5'
    },
    {
      name: 'UCD',
      url: 'https://mos.esante.gouv.fr/NOS/UCD/FHIR/UCD',
      oid: '1.2.250.1.213.2.3.1',
      description: 'Unité Commune de Dispensation'
    }
  ];
}

/**
 * Systèmes de terminologie communs par défaut
 * @returns {Array} Liste des systèmes communs par défaut
 */
function getDefaultCommonSystems() {
  return [
    {
      name: 'LOINC',
      url: 'http://loinc.org',
      description: 'Logical Observation Identifiers Names and Codes'
    },
    {
      name: 'SNOMED CT',
      url: 'http://snomed.info/sct',
      description: 'Systematized Nomenclature of Medicine - Clinical Terms'
    },
    {
      name: 'CVX',
      url: 'http://hl7.org/fhir/sid/cvx',
      description: 'Codes de vaccins'
    },
    {
      name: 'RxNorm',
      url: 'http://www.nlm.nih.gov/research/umls/rxnorm',
      description: 'Nomenclature de médicaments'
    }
  ];
}

/**
 * Sauvegarder les systèmes de terminologie français
 * @param {Array} systems - Systèmes à sauvegarder
 * @returns {Promise<void>}
 */
async function saveFrenchSystems(systems) {
  return new Promise((resolve, reject) => {
    try {
      fs.writeFileSync(FRENCH_SYSTEMS_FILE, JSON.stringify(systems, null, 2));
      terminologyCache.frenchSystems = systems;
      resolve();
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Sauvegarder les systèmes de terminologie communs
 * @param {Array} systems - Systèmes à sauvegarder
 * @returns {Promise<void>}
 */
async function saveCommonSystems(systems) {
  return new Promise((resolve, reject) => {
    try {
      fs.writeFileSync(COMMON_SYSTEMS_FILE, JSON.stringify(systems, null, 2));
      terminologyCache.commonSystems = systems;
      resolve();
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Valider un code dans un système de terminologie
 * @param {string} system - URL du système
 * @param {string} code - Code à valider
 * @returns {Promise<boolean>} Validité du code
 */
async function validateCode(system, code) {
  // Créer une clé de cache pour cette validation
  const cacheKey = `${system}|${code}`;
  
  // Vérifier si le résultat est en cache
  if (terminologyCache.validationResults[cacheKey] !== undefined) {
    return terminologyCache.validationResults[cacheKey];
  }
  
  // Pour l'instant, considérer tous les codes comme valides
  // Dans une version future, implémenter la validation réelle avec le Serveur Multi-Terminologies
  const isValid = true;
  
  // Mettre en cache le résultat de validation
  terminologyCache.validationResults[cacheKey] = isValid;
  
  return isValid;
}

/**
 * Rechercher un système de terminologie par son OID
 * @param {string} oid - OID à rechercher
 * @returns {Object|null} Système de terminologie ou null si non trouvé
 */
function findSystemByOid(oid) {
  // Nettoyer l'OID des préfixes éventuels
  const cleanOid = oid.replace('urn:oid:', '');
  
  // Rechercher dans les systèmes français
  const frenchSystems = getFrenchSystems();
  const foundSystem = frenchSystems.find(system => system.oid === cleanOid);
  
  return foundSystem || null;
}

/**
 * Rechercher un système de terminologie par son URL
 * @param {string} url - URL à rechercher
 * @returns {Object|null} Système de terminologie ou null si non trouvé
 */
function findSystemByUrl(url) {
  // Rechercher dans les systèmes français
  const frenchSystems = getFrenchSystems();
  let foundSystem = frenchSystems.find(system => system.url === url);
  
  if (foundSystem) {
    return foundSystem;
  }
  
  // Rechercher dans les systèmes communs
  const commonSystems = getCommonSystems();
  foundSystem = commonSystems.find(system => system.url === url);
  
  return foundSystem || null;
}

module.exports = {
  initialize,
  getFrenchSystems,
  getCommonSystems,
  validateCode,
  findSystemByOid,
  findSystemByUrl
};