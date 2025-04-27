/**
 * Module d'intégration avec les API du Serveur Multi-Terminologies (SMT) de l'ANS
 * Ce module permet de se connecter aux API de l'ANS pour valider et enrichir les terminologies
 * utilisées dans les conversions HL7 vers FHIR.
 * 
 * URL du serveur: https://smt.esante.gouv.fr/fhir/
 * 
 * Les API nécessitent une authentification via le système SSO de l'ANS:
 * POST /ans/sso/auth/realms/ANS/protocol/openid-connect/token
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Configuration
const config = {
  baseUrl: 'https://smt.esante.gouv.fr',
  fhirEndpoint: '/fhir',
  authEndpoint: '/ans/sso/auth/realms/ANS/protocol/openid-connect/token',
  clientId: process.env.ANS_CLIENT_ID || '',
  clientSecret: process.env.ANS_CLIENT_SECRET || '',
  username: process.env.ANS_USERNAME || '',
  password: process.env.ANS_PASSWORD || '',
  cacheDir: path.join(process.cwd(), 'french_terminology', 'cache'),
  offlineMode: true, // Par défaut, utiliser le mode hors ligne
  terminologiesFile: path.join(process.cwd(), 'french_terminology', 'ans_terminology_systems.json'),
};

// Stockage du token d'authentification
let authToken = null;
let tokenExpiration = null;

// Terminologies importantes de l'ANS (extraites des réponses API)
const KEY_TERMINOLOGIES = [
  {
    id: 'TRE-R316-AutreCategorieEtablissement',
    url: 'https://mos.esante.gouv.fr/NOS/TRE_R316-AutreCategorieEtablissement/FHIR/TRE-R316-AutreCategorieEtablissement',
    oid: '1.2.250.1.213.1.6.1.239',
    version: '20240329120000'
  },
  {
    id: 'TRE-R51-DESCGroupe2Diplome',
    url: 'https://mos.esante.gouv.fr/NOS/TRE_R51-DESCGroupe2Diplome/FHIR/TRE-R51-DESCGroupe2Diplome',
    oid: '1.2.250.1.213.1.6.1.49',
    version: '20231215120000'
  },
  {
    id: 'TRE-G02-TypeProduit',
    url: 'https://mos.esante.gouv.fr/NOS/TRE_G02-TypeProduit/FHIR/TRE-G02-TypeProduit',
    oid: '1.2.250.1.71.1.2.2',
    version: '20231215120000'
  },
  {
    id: 'TRE-R217-ProtectionJuridique',
    url: 'https://mos.esante.gouv.fr/NOS/TRE_R217-ProtectionJuridique/FHIR/TRE-R217-ProtectionJuridique',
    oid: '1.2.250.1.213.1.1.4.327',
    version: '20231215120000'
  },
  {
    id: 'TRE-R302-ContexteCodeComplementaire',
    url: 'https://mos.esante.gouv.fr/NOS/TRE_R302-ContexteCodeComplementaire/FHIR/TRE-R302-ContexteCodeComplementaire',
    oid: '1.2.250.1.213.3.3.70',
    version: '20240426120000'
  },
  {
    id: 'TRE-R239-PublicPrisEnCharge',
    url: 'https://mos.esante.gouv.fr/NOS/TRE_R239-PublicPrisEnCharge/FHIR/TRE-R239-PublicPrisEnCharge',
    oid: '1.2.250.1.213.3.3.29',
    version: '20250328120000'
  },
  {
    id: 'TRE-A01-CadreExercice',
    url: 'https://mos.esante.gouv.fr/NOS/TRE_A01-CadreExercice/FHIR/TRE-A01-CadreExercice',
    oid: '1.2.250.1.213.1.1.4.9',
    version: '20240927120000'
  },
  {
    id: 'TRE-R303-HL7v3AdministrativeGender',
    url: 'https://mos.esante.gouv.fr/NOS/TRE_R303-HL7v3AdministrativeGender/FHIR/TRE-R303-HL7v3AdministrativeGender',
    oid: '1.2.250.1.213.1.1.5.1',
    version: '20231215120000'
  }
];

/**
 * Vérifier si nous avons les informations d'authentification nécessaires
 * @returns {boolean} True si les informations d'authentification sont disponibles
 */
function hasAuthCredentials() {
  return config.clientId && config.clientSecret && 
         config.username && config.password;
}

/**
 * Obtenir un token d'authentification pour les API du SMT
 * @returns {Promise<string|null>} Token d'accès ou null si non autorisé
 */
async function getAccessToken() {
  // Si nous sommes en mode hors ligne, ne pas essayer d'obtenir un token
  if (config.offlineMode) {
    console.log('[ANS API] Mode hors ligne activé, pas de requête d\'authentification');
    return null;
  }

  // Vérifier si nous avons les informations d'authentification nécessaires
  if (!hasAuthCredentials()) {
    console.warn('[ANS API] Informations d\'authentification manquantes pour l\'API ANS');
    return null;
  }

  // Vérifier si nous avons déjà un token valide
  if (authToken && tokenExpiration && Date.now() < tokenExpiration) {
    return authToken;
  }

  try {
    const tokenUrl = `${config.baseUrl}${config.authEndpoint}`;
    const params = new URLSearchParams();
    params.append('grant_type', 'password');
    params.append('client_id', config.clientId);
    params.append('client_secret', config.clientSecret);
    params.append('username', config.username);
    params.append('password', config.password);

    const response = await axios.post(tokenUrl, params);
    
    if (response.data && response.data.access_token) {
      authToken = response.data.access_token;
      // Définir l'expiration du token (généralement 1 heure)
      const expiresIn = response.data.expires_in || 3600; // Par défaut 1 heure
      tokenExpiration = Date.now() + (expiresIn * 1000);
      
      console.log('[ANS API] Token d\'authentification obtenu avec succès');
      return authToken;
    }
  } catch (error) {
    console.error('[ANS API] Erreur lors de l\'obtention du token d\'authentification:', error.message);
  }
  
  return null;
}

/**
 * Construire les en-têtes HTTP avec authentification si disponible
 * @returns {Promise<Object>} En-têtes HTTP
 */
async function buildHeaders() {
  const headers = {
    'Accept': 'application/fhir+json',
    'Content-Type': 'application/fhir+json'
  };
  
  // Ajouter le token d'authentification si disponible
  const token = await getAccessToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  return headers;
}

/**
 * Récupérer un CodeSystem par son ID
 * @param {string} id - Identifiant du CodeSystem
 * @returns {Promise<Object|null>} CodeSystem ou null si non trouvé
 */
async function getCodeSystem(id) {
  if (config.offlineMode) {
    // En mode hors ligne, charger depuis le fichier de cache
    return loadCachedTerminology('CodeSystem', id);
  }
  
  try {
    const url = `${config.baseUrl}${config.fhirEndpoint}/CodeSystem/${id}`;
    const headers = await buildHeaders();
    
    const response = await axios.get(url, { headers });
    
    if (response.data) {
      // Mettre en cache pour une utilisation future
      cacheTerminology('CodeSystem', id, response.data);
      return response.data;
    }
  } catch (error) {
    console.error(`[ANS API] Erreur lors de la récupération du CodeSystem ${id}:`, error.message);
  }
  
  return null;
}

/**
 * Rechercher dans les CodeSystems
 * @param {Object} params - Paramètres de recherche
 * @returns {Promise<Object|null>} Résultats de recherche ou null en cas d'erreur
 */
async function searchCodeSystems(params = {}) {
  if (config.offlineMode) {
    // En mode hors ligne, retourner une liste prédéfinie
    return { entry: KEY_TERMINOLOGIES.map(term => ({
      resource: {
        resourceType: 'CodeSystem',
        id: term.id,
        url: term.url,
        version: term.version
      }
    }))};
  }
  
  try {
    const url = `${config.baseUrl}${config.fhirEndpoint}/CodeSystem`;
    const headers = await buildHeaders();
    
    const response = await axios.get(url, { 
      headers,
      params
    });
    
    return response.data;
  } catch (error) {
    console.error('[ANS API] Erreur lors de la recherche des CodeSystems:', error.message);
  }
  
  return null;
}

/**
 * Valider un code dans un système
 * @param {string} system - URL du système
 * @param {string} code - Code à valider
 * @returns {Promise<boolean>} True si le code est valide, false sinon
 */
async function validateCode(system, code) {
  if (config.offlineMode) {
    // En mode hors ligne, considérer comme valide par défaut
    console.log(`[ANS API] Mode hors ligne: validation de code ignorée pour ${system}|${code}`);
    return true;
  }
  
  try {
    const url = `${config.baseUrl}${config.fhirEndpoint}/CodeSystem/$validate-code`;
    const headers = await buildHeaders();
    
    const response = await axios.get(url, { 
      headers,
      params: {
        system,
        code
      }
    });
    
    return response.data && response.data.parameter 
      ? response.data.parameter.find(p => p.name === 'result').valueBoolean 
      : false;
  } catch (error) {
    console.error(`[ANS API] Erreur lors de la validation du code ${code}:`, error.message);
  }
  
  return false;
}

/**
 * Charger une terminologie depuis le cache
 * @param {string} type - Type de ressource (CodeSystem, ValueSet)
 * @param {string} id - Identifiant de la ressource
 * @returns {Object|null} Ressource chargée ou null si non trouvée
 */
function loadCachedTerminology(type, id) {
  try {
    const filePath = path.join(config.cacheDir, type, `${id}.json`);
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error(`[ANS API] Erreur lors du chargement du cache pour ${type}/${id}:`, error.message);
  }
  
  return null;
}

/**
 * Mettre en cache une terminologie
 * @param {string} type - Type de ressource (CodeSystem, ValueSet)
 * @param {string} id - Identifiant de la ressource
 * @param {Object} data - Données à mettre en cache
 */
function cacheTerminology(type, id, data) {
  try {
    const dirPath = path.join(config.cacheDir, type);
    
    // Créer le répertoire s'il n'existe pas
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
    
    const filePath = path.join(dirPath, `${id}.json`);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  } catch (error) {
    console.error(`[ANS API] Erreur lors de la mise en cache pour ${type}/${id}:`, error.message);
  }
}

/**
 * Précharger les terminologies importantes depuis le fichier de configuration
 * @returns {Promise<Object>} Résultat du préchargement
 */
async function preloadTerminologies() {
  console.log('[ANS API] Préchargement des terminologies françaises');
  
  try {
    // Créer le répertoire de cache s'il n'existe pas
    if (!fs.existsSync(config.cacheDir)) {
      fs.mkdirSync(config.cacheDir, { recursive: true });
    }
    
    // Charger le fichier de terminologies si disponible
    if (fs.existsSync(config.terminologiesFile)) {
      const data = fs.readFileSync(config.terminologiesFile, 'utf8');
      const terminologies = JSON.parse(data);
      
      console.log(`[ANS API] ${Object.keys(terminologies).length} terminologies chargées depuis le fichier`);
      
      return {
        success: true,
        terminologiesCount: Object.keys(terminologies).length,
        message: 'Terminologies chargées depuis le fichier'
      };
    } else {
      console.log('[ANS API] Fichier de terminologies non trouvé, création d\'un fichier par défaut');
      
      // Créer un fichier par défaut avec les terminologies clés
      const defaultTerminologies = {};
      KEY_TERMINOLOGIES.forEach(term => {
        defaultTerminologies[term.id] = {
          id: term.id,
          url: term.url,
          oid: term.oid,
          version: term.version
        };
      });
      
      fs.writeFileSync(
        config.terminologiesFile, 
        JSON.stringify(defaultTerminologies, null, 2)
      );
      
      return {
        success: true,
        terminologiesCount: KEY_TERMINOLOGIES.length,
        message: 'Fichier de terminologies par défaut créé'
      };
    }
  } catch (error) {
    console.error('[ANS API] Erreur lors du préchargement des terminologies:', error.message);
    
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Initialiser le module d'intégration avec les API de l'ANS
 * @returns {Promise<boolean>} True si l'initialisation a réussi
 */
async function initialize() {
  console.log('[ANS API] Initialisation du module d\'intégration avec les API de l\'ANS');
  
  // Vérifier si nous avons les informations d'authentification
  if (hasAuthCredentials()) {
    console.log('[ANS API] Informations d\'authentification détectées, mode en ligne disponible');
    config.offlineMode = false;
  } else {
    console.log('[ANS API] Informations d\'authentification manquantes, utilisation du mode hors ligne');
    config.offlineMode = true;
  }
  
  // Précharger les terminologies
  const preloadResult = await preloadTerminologies();
  
  // Récupérer un token d'authentification si possible
  if (!config.offlineMode) {
    const token = await getAccessToken();
    if (token) {
      console.log('[ANS API] Authentification réussie avec les API de l\'ANS');
    } else {
      console.warn('[ANS API] Échec de l\'authentification avec les API de l\'ANS, passage en mode hors ligne');
      config.offlineMode = true;
    }
  }
  
  return preloadResult.success;
}

/**
 * Obtenir la liste des terminologies françaises importantes
 * @returns {Array} Liste des terminologies françaises importantes
 */
function getKeyTerminologies() {
  return KEY_TERMINOLOGIES;
}

/**
 * Configurer le mode de fonctionnement (en ligne/hors ligne)
 * @param {Object} options - Options de configuration
 * @returns {Object} Configuration mise à jour
 */
function configure(options = {}) {
  // Mettre à jour la configuration
  if (options.offlineMode !== undefined) {
    config.offlineMode = options.offlineMode;
  }
  
  if (options.clientId) config.clientId = options.clientId;
  if (options.clientSecret) config.clientSecret = options.clientSecret;
  if (options.username) config.username = options.username;
  if (options.password) config.password = options.password;
  
  // Réinitialiser le token si les informations d'authentification ont changé
  if (options.clientId || options.clientSecret || options.username || options.password) {
    authToken = null;
    tokenExpiration = null;
  }
  
  return {
    offlineMode: config.offlineMode,
    hasCredentials: hasAuthCredentials()
  };
}

/**
 * Vérifier la connexion aux API de l'ANS
 * @returns {Promise<Object>} Résultat de la vérification
 */
async function checkConnection() {
  if (config.offlineMode) {
    return {
      success: false,
      mode: 'offline',
      message: 'Mode hors ligne activé'
    };
  }
  
  try {
    const token = await getAccessToken();
    if (!token) {
      return {
        success: false,
        mode: 'offline',
        message: 'Échec d\'authentification'
      };
    }
    
    // Tester la connexion avec une requête simple
    const url = `${config.baseUrl}${config.fhirEndpoint}/metadata`;
    const headers = await buildHeaders();
    
    const response = await axios.get(url, { headers });
    
    return {
      success: true,
      mode: 'online',
      message: 'Connexion réussie aux API de l\'ANS',
      serverVersion: response.data.software ? response.data.software.version : 'inconnu'
    };
  } catch (error) {
    console.error('[ANS API] Erreur lors de la vérification de la connexion:', error.message);
    
    return {
      success: false,
      mode: 'error',
      message: `Erreur de connexion: ${error.message}`
    };
  }
}

// Exporter les fonctions publiques
module.exports = {
  initialize,
  getAccessToken,
  getCodeSystem,
  searchCodeSystems,
  validateCode,
  getKeyTerminologies,
  configure,
  checkConnection
};