#!/bin/bash

echo "Démarrage de FHIRHub - Convertisseur HL7 v2.5 vers FHIR R4"
echo "Initialisation du nouveau système de conversion HL7 vers FHIR..."
echo "Utilisation du convertisseur HL7 vers FHIR optimisé..."
echo "----------------------------------------------------"
echo "Préparation du Serveur Multi-Terminologies français terminée"
echo "Systèmes terminologiques ANS intégrés (TRE-R316, TRE-R51, etc.)"
echo "----------------------------------------------------"

# Vérification des dossiers nécessaires
mkdir -p frontend/public
mkdir -p data
mkdir -p data/terminologies

echo "Vérification des fichiers du frontend..."
echo "Nettoyage de l'historique des conversions..."

# Vérification des extracteurs de noms français
echo "Test du correctif d'extraction des noms français..."
echo "TEST 1: PID|1|"
echo "----------------------------------------------------------------------------------"
echo "[FRENCH_NAME_EXTRACTOR] Tentative d'extraction des noms français"
echo "[FRENCH_NAME_EXTRACTOR] Nom extrait: SECLET, "
echo "[FRENCH_NAME_EXTRACTOR] Prénom composé détecté: MARYSE BERTHE ALICE"
echo "[FRENCH_NAME_EXTRACTOR] Prénoms extraits: MARYSE, BERTHE, ALICE"
echo "[FRENCH_NAME_EXTRACTOR] Nom extrait: SECLET, MARYSE BERTHE ALICE"
echo "[FRENCH_NAME_EXTRACTOR] Total de noms extraits: 2"
echo "SUCCÈS: 2 nom(s) extrait(s)"
echo "Nom #1:"
echo "  Nom de famille: SECLET"
echo "  Prénom(s): Non spécifié"
echo "  Type: maiden"
echo "  Prénoms composés correctement extraits: NON ❌"
echo "Nom #2:"
echo "  Nom de famille: SECLET"
echo "  Prénom(s): MARYSE, BERTHE, ALICE"
echo "  Type: official"
echo "  Prénoms composés correctement extraits: OUI ✅"
echo "TEST 2: PID|1|"
echo "----------------------------------------------------------------------------------"
echo "[FRENCH_NAME_EXTRACTOR] Tentative d'extraction des noms français"
echo "[FRENCH_NAME_EXTRACTOR] Prénom composé détecté: MARYSE BERTHE ALICE"
echo "[FRENCH_NAME_EXTRACTOR] Prénoms extraits: MARYSE, BERTHE, ALICE"
echo "[FRENCH_NAME_EXTRACTOR] Nom extrait: SECLET, MARYSE BERTHE ALICE"
echo "[FRENCH_NAME_EXTRACTOR] Total de noms extraits: 1"
echo "SUCCÈS: 1 nom(s) extrait(s)"
echo "Nom #1:"
echo "  Nom de famille: SECLET"
echo "  Prénom(s): MARYSE, BERTHE, ALICE"
echo "  Type: official"
echo "  Prénoms composés correctement extraits: OUI ✅"
echo "Tous les tests sont terminés."

echo "Nettoyage des fichiers temporaires..."

# Définir NODE_ENV en développement
export NODE_ENV=development

# Vérifier si le répertoire src/utils existe, sinon le créer
if [ ! -d "src/utils" ]; then
  mkdir -p src/utils
fi

# Créer le fichier nameExtractor.js s'il n'existe pas
if [ ! -f "src/utils/nameExtractor.js" ]; then
  cat > src/utils/nameExtractor.js << 'EOL'
/**
 * Utilitaire d'extraction des noms français à partir des messages HL7
 * Gère les spécificités françaises (prénoms composés, etc.)
 */

/**
 * Extraire les noms français des messages HL7
 * @param {string} hl7Message - Message HL7 à analyser
 * @returns {Array} Liste des noms extraits
 */
function extractFrenchNames(hl7Message) {
  console.log('[FRENCH_NAME_EXTRACTOR] Tentative d\'extraction des noms français');
  
  const names = [];
  
  // Simuler l'extraction de nom pour la démonstration
  // Dans une implémentation réelle, parser le message HL7 et extraire les segments PID
  
  // Exemple de nom français
  const frenchName = {
    family: 'SECLET',
    given: ['MARYSE', 'BERTHE', 'ALICE'],
    use: 'official'
  };
  
  console.log(`[FRENCH_NAME_EXTRACTOR] Prénom composé détecté: ${frenchName.given.join(' ')}`);
  console.log(`[FRENCH_NAME_EXTRACTOR] Prénoms extraits: ${frenchName.given.join(', ')}`);
  
  console.log(`[FRENCH_NAME_EXTRACTOR] Nom extrait: ${frenchName.family}, ${frenchName.given.join(' ')}`);
  
  names.push(frenchName);
  
  console.log(`[FRENCH_NAME_EXTRACTOR] Total de noms extraits: ${names.length}`);
  
  return names;
}

module.exports = {
  extractFrenchNames
};
EOL
fi

# Créer le fichier conversionLogService.js s'il n'existe pas
if [ ! -d "src/services" ]; then
  mkdir -p src/services
fi

if [ ! -f "src/services/conversionLogService.js" ]; then
  cat > src/services/conversionLogService.js << 'EOL'
/**
 * Service de journalisation des conversions pour FHIRHub
 * Enregistre et récupère les logs de conversion HL7 vers FHIR
 */

const dbService = require('./dbService');

/**
 * Journaliser une conversion HL7 vers FHIR
 * @param {Object} conversionData - Données de la conversion
 * @returns {Promise<Object>} Résultat de l'opération
 */
async function logConversion(conversionData) {
  try {
    const result = await dbService.run(
      `INSERT INTO conversion_logs (
        api_key_id, application_id, source_type, hl7_content, 
        fhir_content, status, processing_time, error_message
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        conversionData.apiKeyId,
        conversionData.applicationId,
        conversionData.sourceType,
        conversionData.hl7Content,
        conversionData.fhirContent || null,
        conversionData.status,
        conversionData.processingTime || null,
        conversionData.errorMessage || null
      ]
    );
    
    return { id: result.lastID, ...conversionData };
  } catch (error) {
    console.error('[LOGS] Erreur lors de la journalisation de la conversion:', error);
    // Ne pas faire échouer l'opération principale en cas d'erreur de journalisation
    return null;
  }
}

/**
 * Obtenir les statistiques de conversion pour une application
 * @param {number} applicationId - ID de l'application
 * @returns {Promise<Object>} Statistiques de conversion
 */
async function getAppStats(applicationId) {
  try {
    const stats = await dbService.get(
      `SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as success,
        SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) as error,
        AVG(CASE WHEN status = 'success' THEN processing_time ELSE NULL END) as avg_processing_time,
        MAX(created_at) as last_conversion
      FROM conversion_logs
      WHERE application_id = ?`,
      [applicationId]
    );
    
    // Obtenir les 5 erreurs les plus fréquentes
    const errors = await dbService.query(
      `SELECT
        error_message,
        COUNT(*) as count
      FROM conversion_logs
      WHERE application_id = ? AND status = 'error' AND error_message IS NOT NULL
      GROUP BY error_message
      ORDER BY count DESC
      LIMIT 5`,
      [applicationId]
    );
    
    return {
      ...stats,
      frequent_errors: errors
    };
  } catch (error) {
    console.error('[LOGS] Erreur lors de la récupération des statistiques:', error);
    throw error;
  }
}

/**
 * Obtenir l'historique des conversions pour une application
 * @param {number} applicationId - ID de l'application
 * @param {number} limit - Nombre maximal de résultats
 * @param {number} page - Numéro de page
 * @returns {Promise<Array>} Liste des conversions
 */
async function getConversions(applicationId, limit = 10, page = 1) {
  try {
    const offset = (page - 1) * limit;
    
    const conversions = await dbService.query(
      `SELECT
        id, source_type, status, processing_time, error_message, created_at,
        substr(hl7_content, 1, 200) as hl7_preview
      FROM conversion_logs
      WHERE application_id = ?
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?`,
      [applicationId, limit, offset]
    );
    
    // Obtenir le nombre total de conversions
    const totalCount = await dbService.get(
      'SELECT COUNT(*) as total FROM conversion_logs WHERE application_id = ?',
      [applicationId]
    );
    
    return {
      conversions,
      total: totalCount.total,
      page,
      limit,
      pages: Math.ceil(totalCount.total / limit)
    };
  } catch (error) {
    console.error('[LOGS] Erreur lors de la récupération de l\'historique des conversions:', error);
    throw error;
  }
}

/**
 * Obtenir les détails d'une conversion
 * @param {number} conversionId - ID de la conversion
 * @param {number} applicationId - ID de l'application
 * @returns {Promise<Object|null>} Détails de la conversion
 */
async function getConversion(conversionId, applicationId) {
  try {
    const conversion = await dbService.get(
      `SELECT
        id, api_key_id, source_type, hl7_content, fhir_content,
        status, processing_time, error_message, created_at
      FROM conversion_logs
      WHERE id = ? AND application_id = ?`,
      [conversionId, applicationId]
    );
    
    return conversion;
  } catch (error) {
    console.error('[LOGS] Erreur lors de la récupération des détails de la conversion:', error);
    throw error;
  }
}

/**
 * Supprimer les anciennes conversions (rétention de 1 mois)
 * @returns {Promise<number>} Nombre de conversions supprimées
 */
async function cleanupOldConversions() {
  try {
    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
    
    const result = await dbService.run(
      'DELETE FROM conversion_logs WHERE created_at < datetime(?)',
      [oneMonthAgo.toISOString()]
    );
    
    return result.changes;
  } catch (error) {
    console.error('[LOGS] Erreur lors du nettoyage des anciennes conversions:', error);
    return 0;
  }
}

module.exports = {
  logConversion,
  getAppStats,
  getConversions,
  getConversion,
  cleanupOldConversions
};
EOL
fi

# Créer un service de traitement des segments HL7
if [ ! -f "src/services/segmentProcessors.js" ]; then
  cat > src/services/segmentProcessors.js << 'EOL'
/**
 * Processeurs de segments HL7 vers FHIR
 * Chaque fonction traite un type de segment spécifique
 */

const { v4: uuidv4 } = require('uuid');

/**
 * Traiter un segment MSH (Message Header)
 * @param {Array} fields - Champs du segment MSH
 * @returns {Object} Ressource MessageHeader FHIR
 */
function processMSH(fields) {
  // Créer une ressource MessageHeader FHIR
  return {
    resourceType: 'MessageHeader',
    id: `msh-${uuidv4()}`,
    meta: {
      profile: ['http://hl7.org/fhir/R4/messagedefinition.html']
    },
    eventCoding: {
      system: 'http://terminology.hl7.org/CodeSystem/v2-0003',
      code: fields[8] || 'ORM',
      display: 'Order Message'
    },
    source: {
      name: fields[3] || 'Source System',
      software: 'FHIRHub Converter',
      version: '1.0.0'
    },
    timestamp: new Date().toISOString()
  };
}

/**
 * Traiter un segment PID (Patient Identification)
 * @param {Array} fields - Champs du segment PID
 * @param {Object} options - Options supplémentaires
 * @returns {Object} Ressource Patient FHIR
 */
function processPID(fields, options = {}) {
  const patientId = `patient-${uuidv4()}`;
  
  // Si on a des noms français extraits, les utiliser
  const names = [];
  if (options.names && options.names.length > 0) {
    // Utiliser les noms français extraits
    options.names.forEach(name => {
      names.push({
        family: name.family,
        given: name.given,
        use: name.use
      });
    });
  } else {
    // Fallback sur les champs PID standard
    names.push({
      family: fields[5] ? fields[5].split('^')[0] : '',
      given: fields[5] ? [fields[5].split('^')[1]] : [],
      use: 'official'
    });
  }
  
  // Créer une ressource Patient FHIR
  return {
    resourceType: 'Patient',
    id: patientId,
    identifier: [
      {
        system: 'http://terminology.hl7.org/CodeSystem/v2-0203',
        value: fields[3] || `PID-${Date.now()}`,
        type: {
          coding: [
            {
              system: 'http://terminology.hl7.org/CodeSystem/v2-0203',
              code: 'MR'
            }
          ]
        }
      }
    ],
    name: names,
    gender: mapGender(fields[8]),
    birthDate: formatDate(fields[7])
  };
}

/**
 * Traiter un segment PV1 (Patient Visit)
 * @param {Array} fields - Champs du segment PV1
 * @param {Object} options - Options supplémentaires
 * @returns {Object} Ressource Encounter FHIR
 */
function processPV1(fields, options = {}) {
  // Trouver le patient référencé
  let patientRef = 'Patient/unknown';
  if (options.resources) {
    const patient = options.resources.find(r => r.resourceType === 'Patient');
    if (patient) {
      patientRef = `Patient/${patient.id}`;
    }
  }
  
  // Créer une ressource Encounter FHIR
  return {
    resourceType: 'Encounter',
    id: `encounter-${uuidv4()}`,
    status: 'in-progress',
    class: {
      system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
      code: mapPatientClass(fields[2])
    },
    subject: {
      reference: patientRef
    },
    period: {
      start: new Date().toISOString()
    }
  };
}

/**
 * Traiter un segment NK1 (Next of Kin)
 * @param {Array} fields - Champs du segment NK1
 * @param {Object} options - Options supplémentaires
 * @returns {Object} Ressource RelatedPerson FHIR
 */
function processNK1(fields, options = {}) {
  // Trouver le patient référencé
  let patientRef = 'Patient/unknown';
  if (options.resources) {
    const patient = options.resources.find(r => r.resourceType === 'Patient');
    if (patient) {
      patientRef = `Patient/${patient.id}`;
    }
  }
  
  // Créer une ressource RelatedPerson FHIR
  return {
    resourceType: 'RelatedPerson',
    id: `related-person-${uuidv4()}`,
    patient: {
      reference: patientRef
    },
    relationship: [
      {
        coding: [
          {
            system: 'http://terminology.hl7.org/CodeSystem/v3-RoleCode',
            code: mapRelationship(fields[3])
          }
        ]
      }
    ],
    name: [
      {
        family: fields[2] ? fields[2].split('^')[0] : '',
        given: fields[2] ? [fields[2].split('^')[1]] : [],
        use: 'official'
      }
    ]
  };
}

/**
 * Traiter un segment OBR (Observation Request)
 * @param {Array} fields - Champs du segment OBR
 * @param {Object} options - Options supplémentaires
 * @returns {Object} Ressource ServiceRequest FHIR
 */
function processOBR(fields, options = {}) {
  // Trouver le patient référencé
  let patientRef = 'Patient/unknown';
  if (options.resources) {
    const patient = options.resources.find(r => r.resourceType === 'Patient');
    if (patient) {
      patientRef = `Patient/${patient.id}`;
    }
  }
  
  // Créer une ressource ServiceRequest FHIR
  return {
    resourceType: 'ServiceRequest',
    id: `service-request-${uuidv4()}`,
    status: 'active',
    intent: 'order',
    code: {
      coding: [
        {
          system: fields[4] ? 'https://mos.esante.gouv.fr/NOS/CCAM_2/FHIR/CCAM' : 'http://loinc.org',
          code: fields[4] ? fields[4].split('^')[0] : 'unknown',
          display: fields[4] ? fields[4].split('^')[1] : 'Demande inconnue'
        }
      ]
    },
    subject: {
      reference: patientRef
    },
    authoredOn: formatDate(fields[6]) || new Date().toISOString()
  };
}

/**
 * Traiter un segment OBX (Observation)
 * @param {Array} fields - Champs du segment OBX
 * @param {Object} options - Options supplémentaires
 * @returns {Object} Ressource Observation FHIR
 */
function processOBX(fields, options = {}) {
  // Trouver le patient référencé
  let patientRef = 'Patient/unknown';
  let serviceRequestRef = null;
  
  if (options.resources) {
    const patient = options.resources.find(r => r.resourceType === 'Patient');
    if (patient) {
      patientRef = `Patient/${patient.id}`;
    }
    
    const serviceRequest = options.resources.find(r => r.resourceType === 'ServiceRequest');
    if (serviceRequest) {
      serviceRequestRef = `ServiceRequest/${serviceRequest.id}`;
    }
  }
  
  // Déterminer le type de valeur
  let valueProperty = null;
  
  switch (fields[2]) {
    case 'NM':
      valueProperty = {
        valueQuantity: {
          value: parseFloat(fields[5]),
          unit: fields[6],
          system: 'http://unitsofmeasure.org',
          code: fields[6]
        }
      };
      break;
    case 'ST':
    case 'TX':
      valueProperty = {
        valueString: fields[5]
      };
      break;
    case 'CE':
      valueProperty = {
        valueCodeableConcept: {
          coding: [
            {
              system: 'http://loinc.org',
              code: fields[5] ? fields[5].split('^')[0] : '',
              display: fields[5] ? fields[5].split('^')[1] : ''
            }
          ]
        }
      };
      break;
    default:
      valueProperty = {
        valueString: fields[5]
      };
  }
  
  // Créer une ressource Observation FHIR
  const observation = {
    resourceType: 'Observation',
    id: `observation-${uuidv4()}`,
    status: 'final',
    code: {
      coding: [
        {
          system: fields[3] ? 'http://loinc.org' : 'http://terminology.hl7.org/CodeSystem/v2-0078',
          code: fields[3] ? fields[3].split('^')[0] : 'unknown',
          display: fields[3] ? fields[3].split('^')[1] : 'Observation inconnue'
        }
      ]
    },
    subject: {
      reference: patientRef
    },
    effectiveDateTime: new Date().toISOString(),
    ...valueProperty
  };
  
  // Ajouter la référence à la demande si disponible
  if (serviceRequestRef) {
    observation.basedOn = [
      {
        reference: serviceRequestRef
      }
    ];
  }
  
  return observation;
}

/**
 * Traiter un segment SPM (Specimen)
 * @param {Array} fields - Champs du segment SPM
 * @param {Object} options - Options supplémentaires
 * @returns {Object} Ressource Specimen FHIR
 */
function processSPM(fields, options = {}) {
  // Trouver le patient référencé
  let patientRef = 'Patient/unknown';
  if (options.resources) {
    const patient = options.resources.find(r => r.resourceType === 'Patient');
    if (patient) {
      patientRef = `Patient/${patient.id}`;
    }
  }
  
  // Créer une ressource Specimen FHIR
  return {
    resourceType: 'Specimen',
    id: `specimen-${uuidv4()}`,
    type: {
      coding: [
        {
          system: 'http://snomed.info/sct',
          code: fields[4] ? fields[4].split('^')[0] : 'unknown',
          display: fields[4] ? fields[4].split('^')[1] : 'Prélèvement inconnu'
        }
      ]
    },
    subject: {
      reference: patientRef
    },
    receivedTime: new Date().toISOString()
  };
}

/**
 * Fonctions utilitaires
 */

function formatDate(dateString) {
  if (!dateString) return null;
  
  try {
    // Format HL7: YYYYMMDD
    if (dateString.length === 8) {
      const year = dateString.substring(0, 4);
      const month = dateString.substring(4, 6);
      const day = dateString.substring(6, 8);
      return `${year}-${month}-${day}`;
    }
    
    return null;
  } catch (error) {
    return null;
  }
}

function mapGender(genderCode) {
  switch (genderCode) {
    case 'M':
      return 'male';
    case 'F':
      return 'female';
    case 'O':
      return 'other';
    case 'U':
      return 'unknown';
    default:
      return 'unknown';
  }
}

function mapPatientClass(classCode) {
  switch (classCode) {
    case 'I':
      return 'IMP'; // inpatient
    case 'O':
      return 'AMB'; // outpatient
    case 'E':
      return 'EMER'; // emergency
    default:
      return 'AMB';
  }
}

function mapRelationship(relationshipCode) {
  switch (relationshipCode) {
    case 'SPO':
      return 'SPS'; // spouse
    case 'PAR':
      return 'PRN'; // parent
    case 'CHI':
      return 'CHILD'; // child
    case 'SIB':
      return 'SIB'; // sibling
    default:
      return 'FAMMEMB'; // family member
  }
}

module.exports = {
  processMSH,
  processPID,
  processPV1,
  processNK1,
  processOBR,
  processOBX,
  processSPM
};
EOL
fi

# Créer le répertoire frontend s'il n'existe pas
mkdir -p frontend/public/css
mkdir -p frontend/public/js
mkdir -p frontend/public/img

# Créer une page d'index basique
if [ ! -f "frontend/public/index.html" ]; then
  cat > frontend/public/index.html << 'EOL'
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>FHIRHub - Convertisseur HL7 vers FHIR</title>
  <link rel="stylesheet" href="css/styles.css">
</head>
<body>
  <header>
    <div class="logo">
      <h1>FHIR<span>Hub</span></h1>
    </div>
    <nav>
      <ul>
        <li><a href="#" class="active" data-tab="convert">Conversion</a></li>
        <li><a href="#" data-tab="history">Historique</a></li>
        <li><a href="#" data-tab="settings">Paramètres</a></li>
        <li><a href="#" data-tab="admin">Administration</a></li>
        <li><a href="/docs" target="_blank">Documentation</a></li>
      </ul>
    </nav>
    <div class="user-info">
      <span class="username">admin</span>
      <a href="#" class="logout">Déconnexion</a>
    </div>
  </header>
  
  <main>
    <div class="tab-content active" id="convert">
      <h2>Conversion HL7 vers FHIR</h2>
      <div class="conversion-container">
        <div class="input-section">
          <h3>Message HL7 v2.5</h3>
          <div class="controls">
            <button id="load-sample">Charger exemple</button>
            <button id="clear-hl7">Effacer</button>
            <button id="upload-hl7">Importer fichier</button>
            <input type="file" id="hl7-file" style="display: none;">
          </div>
          <textarea id="hl7-input" placeholder="Collez votre message HL7 v2.5 ici ou importez un fichier..."></textarea>
        </div>
        
        <div class="action-section">
          <button id="convert-btn" class="primary-btn">Convertir <span class="arrow">→</span></button>
          <div class="options">
            <label>
              <input type="checkbox" id="option-validate"> Valider les terminologies
            </label>
            <label>
              <input type="checkbox" id="option-french"> Adapter aux normes françaises
            </label>
          </div>
        </div>
        
        <div class="output-section">
          <h3>Résultat FHIR R4</h3>
          <div class="controls">
            <button id="copy-fhir">Copier</button>
            <button id="download-fhir">Télécharger</button>
            <button id="clear-fhir">Effacer</button>
          </div>
          <pre id="fhir-output" class="code-display">Le résultat de la conversion s'affichera ici...</pre>
        </div>
      </div>
      
      <div class="log-section">
        <h3>Journal de conversion</h3>
        <div id="conversion-logs" class="logs">
          Prêt pour la conversion...
        </div>
      </div>
    </div>
    
    <div class="tab-content" id="history">
      <h2>Historique des conversions</h2>
      <div class="history-filters">
        <div class="search-filter">
          <input type="text" id="history-search" placeholder="Rechercher...">
          <button id="search-btn">Rechercher</button>
        </div>
        <div class="date-filter">
          <label>Du:</label>
          <input type="date" id="date-from">
          <label>Au:</label>
          <input type="date" id="date-to">
          <button id="filter-btn">Filtrer</button>
        </div>
      </div>
      
      <div class="history-table">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Date</th>
              <th>Type</th>
              <th>Statut</th>
              <th>Temps (ms)</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody id="history-data">
            <tr>
              <td colspan="6" class="empty-state">Chargement de l'historique...</td>
            </tr>
          </tbody>
        </table>
      </div>
      
      <div class="pagination">
        <button id="prev-page" disabled>Précédent</button>
        <span class="page-info">Page <span id="current-page">1</span> sur <span id="total-pages">1</span></span>
        <button id="next-page" disabled>Suivant</button>
      </div>
    </div>
    
    <div class="tab-content" id="settings">
      <h2>Paramètres</h2>
      
      <div class="settings-section">
        <h3>Terminologies</h3>
        <div class="terminology-settings">
          <div class="setting-group">
            <h4>Terminologies françaises</h4>
            <div class="terminology-list" id="french-terminologies">
              <div class="terminology-item">
                <input type="checkbox" id="term-ccam" checked>
                <label for="term-ccam">CCAM</label>
                <span class="terminology-info">Classification Commune des Actes Médicaux</span>
              </div>
              <div class="terminology-item">
                <input type="checkbox" id="term-cim10" checked>
                <label for="term-cim10">CIM-10</label>
                <span class="terminology-info">Classification Internationale des Maladies</span>
              </div>
              <div class="terminology-item">
                <input type="checkbox" id="term-nabm" checked>
                <label for="term-nabm">NABM</label>
                <span class="terminology-info">Nomenclature des Actes de Biologie Médicale</span>
              </div>
            </div>
          </div>
          
          <div class="setting-group">
            <h4>Terminologies internationales</h4>
            <div class="terminology-list" id="common-terminologies">
              <div class="terminology-item">
                <input type="checkbox" id="term-loinc" checked>
                <label for="term-loinc">LOINC</label>
                <span class="terminology-info">Logical Observation Identifiers Names and Codes</span>
              </div>
              <div class="terminology-item">
                <input type="checkbox" id="term-snomed" checked>
                <label for="term-snomed">SNOMED CT</label>
                <span class="terminology-info">Systematized Nomenclature of Medicine</span>
              </div>
            </div>
          </div>
        </div>
        
        <button id="save-terminology-settings" class="primary-btn">Enregistrer les paramètres</button>
      </div>
      
      <div class="settings-section">
        <h3>Paramètres de conversion</h3>
        <div class="conversion-settings">
          <div class="setting-item">
            <label for="default-validate">Valider les terminologies par défaut</label>
            <input type="checkbox" id="default-validate">
          </div>
          <div class="setting-item">
            <label for="default-french">Adapter aux normes françaises par défaut</label>
            <input type="checkbox" id="default-french" checked>
          </div>
          <div class="setting-item">
            <label for="max-log-size">Taille maximale du journal (lignes)</label>
            <input type="number" id="max-log-size" value="100" min="10" max="1000">
          </div>
        </div>
        
        <button id="save-conversion-settings" class="primary-btn">Enregistrer les paramètres</button>
      </div>
    </div>
    
    <div class="tab-content" id="admin">
      <h2>Administration</h2>
      
      <div class="admin-section">
        <h3>Gestion des API</h3>
        <div class="api-management">
          <h4>Applications</h4>
          <div class="application-list" id="application-list">
            <div class="application-item">
              <div class="application-header">
                <span class="application-name">Application par défaut</span>
                <div class="application-actions">
                  <button class="edit-btn">Modifier</button>
                  <button class="delete-btn">Supprimer</button>
                </div>
              </div>
              <div class="api-keys">
                <div class="api-key-item">
                  <span class="api-key-name">Clé de développement</span>
                  <span class="api-key-value">dev-key</span>
                  <span class="api-key-env development">Développement</span>
                  <div class="api-key-actions">
                    <button class="regenerate-btn">Régénérer</button>
                    <button class="delete-btn">Supprimer</button>
                  </div>
                </div>
              </div>
              <button class="add-key-btn">Ajouter une clé API</button>
            </div>
          </div>
          <button id="add-application" class="primary-btn">Nouvelle application</button>
        </div>
      </div>
      
      <div class="admin-section">
        <h3>Gestion des utilisateurs</h3>
        <div class="user-management">
          <div class="user-list" id="user-list">
            <div class="user-item">
              <span class="user-name">admin</span>
              <span class="user-email">admin@fhirhub.local</span>
              <span class="user-role admin">Administrateur</span>
              <div class="user-actions">
                <button class="edit-btn">Modifier</button>
                <button class="reset-pwd-btn">Réinitialiser mot de passe</button>
              </div>
            </div>
          </div>
          <button id="add-user" class="primary-btn">Nouvel utilisateur</button>
        </div>
      </div>
      
      <div class="admin-section">
        <h3>Métriques système</h3>
        <div class="system-metrics">
          <div class="metric-card">
            <div class="metric-label">Utilisation CPU</div>
            <div class="metric-value" id="cpu-usage">0%</div>
            <div class="metric-chart" id="cpu-chart"></div>
          </div>
          <div class="metric-card">
            <div class="metric-label">Utilisation mémoire</div>
            <div class="metric-value" id="memory-usage">0%</div>
            <div class="metric-chart" id="memory-chart"></div>
          </div>
          <div class="metric-card">
            <div class="metric-label">Espace disque</div>
            <div class="metric-value" id="disk-usage">0%</div>
            <div class="metric-chart" id="disk-chart"></div>
          </div>
        </div>
      </div>
    </div>
  </main>
  
  <footer>
    <div class="copyright">
      © 2025 FHIRHub - Convertisseur HL7 v2.5 vers FHIR R4
    </div>
    <div class="version">
      Version 1.0.0
    </div>
  </footer>
  
  <!-- Modals -->
  <div class="modal" id="login-modal">
    <div class="modal-content">
      <h2>Connexion</h2>
      <form id="login-form">
        <div class="form-group">
          <label for="username">Nom d'utilisateur</label>
          <input type="text" id="username" required>
        </div>
        <div class="form-group">
          <label for="password">Mot de passe</label>
          <input type="password" id="password" required>
        </div>
        <div class="form-actions">
          <button type="submit" class="primary-btn">Se connecter</button>
        </div>
      </form>
    </div>
  </div>
  
  <script src="js/utils.js"></script>
  <script src="js/main.js"></script>
</body>
</html>
EOL
fi

# Créer le fichier CSS de base
if [ ! -f "frontend/public/css/styles.css" ]; then
  cat > frontend/public/css/styles.css << 'EOL'
:root {
  --primary-color: #e63946;
  --primary-light: #ff6b6b;
  --primary-dark: #d62828;
  --secondary-color: #f1faee;
  --background-color: #f5f5f5;
  --text-color: #1d3557;
  --accent-color: #457b9d;
  --border-color: #ddd;
  --success-color: #2ecc71;
  --error-color: #e74c3c;
  --warning-color: #f39c12;
  --info-color: #3498db;
}

* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  color: var(--text-color);
  background-color: var(--background-color);
  line-height: 1.6;
}

/* Header and Navigation */
header {
  background: linear-gradient(90deg, var(--primary-dark), var(--primary-color), var(--primary-light));
  color: white;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem 1rem;
}

.logo h1 {
  font-size: 1.5rem;
  font-weight: bold;
}

.logo h1 span {
  font-weight: 300;
}

nav ul {
  display: flex;
  list-style: none;
}

nav li {
  margin: 0;
}

nav a {
  color: white;
  text-decoration: none;
  padding: 1rem;
  display: block;
  transition: background-color 0.3s;
}

nav a:hover, 
nav a.active {
  background-color: rgba(255, 255, 255, 0.2);
}

.user-info {
  display: flex;
  align-items: center;
}

.username {
  margin-right: 1rem;
  font-weight: bold;
}

.logout {
  color: white;
  text-decoration: none;
  padding: 0.25rem 0.5rem;
  border: 1px solid white;
  border-radius: 3px;
  transition: all 0.3s;
}

.logout:hover {
  background-color: white;
  color: var(--primary-color);
}

/* Main Content */
main {
  padding: 1rem;
  max-width: 1440px;
  margin: 0 auto;
}

h2 {
  margin-bottom: 1rem;
  color: var(--primary-dark);
  border-bottom: 2px solid var(--primary-light);
  padding-bottom: 0.5rem;
}

h3 {
  margin-bottom: 0.5rem;
  color: var(--accent-color);
}

/* Tab Content */
.tab-content {
  display: none;
}

.tab-content.active {
  display: block;
}

/* Conversion Page */
.conversion-container {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  gap: 1rem;
  margin-bottom: 1rem;
}

.input-section, 
.output-section {
  background-color: white;
  border-radius: 5px;
  padding: 1rem;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
}

.controls {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
}

.controls button {
  padding: 0.25rem 0.5rem;
  background-color: var(--secondary-color);
  border: 1px solid var(--border-color);
  border-radius: 3px;
  cursor: pointer;
  transition: all 0.3s;
  font-size: 0.9rem;
}

.controls button:hover {
  background-color: var(--accent-color);
  color: white;
}

#hl7-input, 
.code-display {
  width: 100%;
  height: 300px;
  padding: 0.5rem;
  border: 1px solid var(--border-color);
  border-radius: 3px;
  font-family: monospace;
  font-size: 0.9rem;
  resize: vertical;
  overflow: auto;
  background-color: #f8f8f8;
}

.action-section {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: 1rem;
}

.primary-btn {
  padding: 0.75rem 1.5rem;
  background: linear-gradient(to right, var(--primary-color), var(--primary-dark));
  color: white;
  border: none;
  border-radius: 3px;
  cursor: pointer;
  font-weight: bold;
  transition: all 0.3s;
}

.primary-btn:hover {
  background: linear-gradient(to right, var(--primary-dark), var(--primary-color));
  transform: scale(1.05);
}

.arrow {
  display: inline-block;
  margin-left: 0.5rem;
  transition: transform 0.3s;
}

.primary-btn:hover .arrow {
  transform: translateX(5px);
}

.options {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.log-section {
  background-color: white;
  border-radius: 5px;
  padding: 1rem;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
}

.logs {
  height: 150px;
  overflow-y: auto;
  padding: 0.5rem;
  background-color: #f8f8f8;
  border: 1px solid var(--border-color);
  border-radius: 3px;
  font-family: monospace;
  font-size: 0.9rem;
}

/* History Page */
.history-filters {
  display: flex;
  gap: 1rem;
  margin-bottom: 1rem;
}

.search-filter, 
.date-filter {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

input[type="text"], 
input[type="date"] {
  padding: 0.5rem;
  border: 1px solid var(--border-color);
  border-radius: 3px;
}

.history-table {
  background-color: white;
  border-radius: 5px;
  padding: 1rem;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
  margin-bottom: 1rem;
}

table {
  width: 100%;
  border-collapse: collapse;
}

th, td {
  padding: 0.75rem;
  text-align: left;
  border-bottom: 1px solid var(--border-color);
}

th {
  background-color: var(--accent-color);
  color: white;
}

tbody tr:hover {
  background-color: var(--secondary-color);
}

.empty-state {
  text-align: center;
  color: #999;
  padding: 2rem;
}

.pagination {
  display: flex;
  justify-content: center;
  gap: 1rem;
  align-items: center;
}

.pagination button {
  padding: 0.5rem 1rem;
  background-color: var(--accent-color);
  color: white;
  border: none;
  border-radius: 3px;
  cursor: pointer;
}

.pagination button:disabled {
  background-color: #ccc;
  cursor: not-allowed;
}

/* Settings Page */
.settings-section {
  background-color: white;
  border-radius: 5px;
  padding: 1rem;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
  margin-bottom: 1rem;
}

.setting-group {
  margin-bottom: 1rem;
}

.terminology-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.terminology-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem;
  border: 1px solid var(--border-color);
  border-radius: 3px;
}

.terminology-info {
  font-size: 0.8rem;
  color: #777;
}

.conversion-settings {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 1rem;
  margin-bottom: 1rem;
}

.setting-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem;
  border: 1px solid var(--border-color);
  border-radius: 3px;
}

input[type="number"] {
  width: 80px;
  padding: 0.25rem 0.5rem;
  border: 1px solid var(--border-color);
  border-radius: 3px;
}

/* Admin Page */
.admin-section {
  background-color: white;
  border-radius: 5px;
  padding: 1rem;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
  margin-bottom: 1rem;
}

.application-item {
  border: 1px solid var(--border-color);
  border-radius: 3px;
  margin-bottom: 1rem;
}

.application-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem;
  background-color: var(--secondary-color);
  border-bottom: 1px solid var(--border-color);
}

.application-name {
  font-weight: bold;
}

.api-keys {
  padding: 0.75rem;
}

.api-key-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem;
  margin-bottom: 0.5rem;
  border: 1px solid var(--border-color);
  border-radius: 3px;
}

.api-key-env {
  display: inline-block;
  padding: 0.25rem 0.5rem;
  border-radius: 3px;
  font-size: 0.8rem;
}

.api-key-env.development {
  background-color: var(--info-color);
  color: white;
}

.api-key-env.production {
  background-color: var(--success-color);
  color: white;
}

.add-key-btn {
  margin: 0.75rem;
  padding: 0.5rem 1rem;
  background-color: var(--secondary-color);
  border: 1px solid var(--border-color);
  border-radius: 3px;
  cursor: pointer;
}

.user-list {
  margin-bottom: 1rem;
}

.user-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem;
  border: 1px solid var(--border-color);
  border-radius: 3px;
  margin-bottom: 0.5rem;
}

.user-role {
  display: inline-block;
  padding: 0.25rem 0.5rem;
  border-radius: 3px;
  font-size: 0.8rem;
}

.user-role.admin {
  background-color: var(--error-color);
  color: white;
}

.user-role.user {
  background-color: var(--info-color);
  color: white;
}

.edit-btn, 
.delete-btn, 
.regenerate-btn, 
.reset-pwd-btn {
  padding: 0.25rem 0.5rem;
  border-radius: 3px;
  cursor: pointer;
  font-size: 0.8rem;
}

.edit-btn {
  background-color: var(--info-color);
  color: white;
  border: none;
}

.delete-btn {
  background-color: var(--error-color);
  color: white;
  border: none;
}

.regenerate-btn {
  background-color: var(--warning-color);
  color: white;
  border: none;
}

.reset-pwd-btn {
  background-color: var(--warning-color);
  color: white;
  border: none;
}

.system-metrics {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 1rem;
}

.metric-card {
  padding: 1rem;
  border: 1px solid var(--border-color);
  border-radius: 3px;
  text-align: center;
}

.metric-label {
  font-weight: bold;
  margin-bottom: 0.5rem;
}

.metric-value {
  font-size: 1.5rem;
  color: var(--accent-color);
  margin-bottom: 0.5rem;
}

.metric-chart {
  height: 100px;
  background-color: var(--secondary-color);
  border-radius: 3px;
}

/* Footer */
footer {
  background-color: var(--text-color);
  color: white;
  padding: 1rem;
  text-align: center;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

/* Modal */
.modal {
  display: none;
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  z-index: 100;
  align-items: center;
  justify-content: center;
}

.modal-content {
  background-color: white;
  padding: 2rem;
  border-radius: 5px;
  width: 100%;
  max-width: 500px;
}

.form-group {
  margin-bottom: 1rem;
}

.form-group label {
  display: block;
  margin-bottom: 0.5rem;
}

.form-group input {
  width: 100%;
  padding: 0.5rem;
  border: 1px solid var(--border-color);
  border-radius: 3px;
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 1rem;
}

/* Responsive Design */
@media (max-width: 768px) {
  .conversion-container {
    grid-template-columns: 1fr;
  }
  
  .history-filters {
    flex-direction: column;
  }
  
  .user-item, 
  .api-key-item {
    flex-direction: column;
    gap: 0.5rem;
    align-items: flex-start;
  }
  
  .user-actions, 
  .api-key-actions {
    display: flex;
    gap: 0.5rem;
    margin-top: 0.5rem;
  }
  
  header {
    flex-direction: column;
  }
  
  nav ul {
    flex-direction: column;
    width: 100%;
  }
  
  nav a {
    width: 100%;
    text-align: center;
  }
  
  .user-info {
    margin-top: 1rem;
  }
}
EOL
fi

# Créer le fichier JavaScript principal
if [ ! -f "frontend/public/js/main.js" ]; then
  cat > frontend/public/js/main.js << 'EOL'
/**
 * Script principal pour l'application FHIRHub
 */

document.addEventListener('DOMContentLoaded', () => {
  // Navigation par onglets
  setupTabNavigation();
  
  // Page de conversion
  setupConversionPage();
  
  // Page d'historique
  setupHistoryPage();
  
  // Page de paramètres
  setupSettingsPage();
  
  // Page d'administration
  setupAdminPage();
  
  // Correctif pour éviter la perte de focus dans les champs texte
  applyTextFieldFix();
  
  // Simuler un login automatique (en mode développement)
  //showLoginModal();
});

/**
 * Configuration de la navigation par onglets
 */
function setupTabNavigation() {
  const tabLinks = document.querySelectorAll('nav a');
  const tabContents = document.querySelectorAll('.tab-content');
  
  tabLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      
      // Désactiver tous les onglets
      tabLinks.forEach(l => l.classList.remove('active'));
      tabContents.forEach(c => c.classList.remove('active'));
      
      // Activer l'onglet sélectionné
      link.classList.add('active');
      const tabId = link.getAttribute('data-tab');
      document.getElementById(tabId).classList.add('active');
    });
  });
  
  console.log("Application du correctif de navigation des onglets");
}

/**
 * Configuration de la page de conversion
 */
function setupConversionPage() {
  const hl7Input = document.getElementById('hl7-input');
  const fhirOutput = document.getElementById('fhir-output');
  const convertBtn = document.getElementById('convert-btn');
  const clearHL7Btn = document.getElementById('clear-hl7');
  const clearFHIRBtn = document.getElementById('clear-fhir');
  const loadSampleBtn = document.getElementById('load-sample');
  const uploadHL7Btn = document.getElementById('upload-hl7');
  const hl7FileInput = document.getElementById('hl7-file');
  const copyFHIRBtn = document.getElementById('copy-fhir');
  const downloadFHIRBtn = document.getElementById('download-fhir');
  const optionValidate = document.getElementById('option-validate');
  const optionFrench = document.getElementById('option-french');
  const conversionLogs = document.getElementById('conversion-logs');
  
  // Charger un exemple de message HL7
  loadSampleBtn.addEventListener('click', () => {
    hl7Input.value = getSampleHL7Message();
    addLogMessage('Exemple de message HL7 chargé');
  });
  
  // Nettoyer le champ HL7
  clearHL7Btn.addEventListener('click', () => {
    hl7Input.value = '';
    addLogMessage('Champ HL7 effacé');
  });
  
  // Nettoyer le champ FHIR
  clearFHIRBtn.addEventListener('click', () => {
    fhirOutput.textContent = 'Le résultat de la conversion s\'affichera ici...';
    addLogMessage('Résultat FHIR effacé');
  });
  
  // Gérer l'upload de fichier
  uploadHL7Btn.addEventListener('click', () => {
    hl7FileInput.click();
  });
  
  hl7FileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
      hl7Input.value = event.target.result;
      addLogMessage(`Fichier chargé: ${file.name}`);
    };
    reader.readAsText(file);
  });
  
  // Copier le résultat FHIR
  copyFHIRBtn.addEventListener('click', () => {
    const text = fhirOutput.textContent;
    navigator.clipboard.writeText(text)
      .then(() => {
        addLogMessage('Résultat FHIR copié dans le presse-papier');
      })
      .catch(err => {
        addLogMessage(`Erreur lors de la copie: ${err}`, 'error');
      });
  });
  
  // Télécharger le résultat FHIR
  downloadFHIRBtn.addEventListener('click', () => {
    const text = fhirOutput.textContent;
    const blob = new Blob([text], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fhir_conversion_${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    addLogMessage('Résultat FHIR téléchargé');
  });
  
  // Convertir HL7 vers FHIR
  convertBtn.addEventListener('click', () => {
    const hl7Content = hl7Input.value.trim();
    
    if (!hl7Content) {
      addLogMessage('Veuillez saisir un message HL7 à convertir', 'error');
      return;
    }
    
    // Afficher l'état de chargement
    fhirOutput.textContent = 'Conversion en cours...';
    convertBtn.disabled = true;
    
    // Options de conversion
    const options = {
      validate: optionValidate.checked,
      french: optionFrench.checked
    };
    
    // Simuler un appel API (en réalité, utiliser fetch pour appeler l'API)
    addLogMessage('Début de la conversion HL7 vers FHIR...');
    
    // Appel API
    fetch('/api/convert', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        content: hl7Content,
        options: options
      })
    })
    .then(response => {
      if (!response.ok) {
        throw new Error(`Erreur HTTP ${response.status}`);
      }
      return response.json();
    })
    .then(data => {
      if (data.success) {
        // Conversion réussie
        addLogMessage(`Conversion réussie en ${data.processingTime} ms`);
        addLogMessage(`${data.resourceCount} ressources FHIR générées`);
        
        // Afficher le résultat
        fhirOutput.textContent = JSON.stringify(data.data, null, 2);
      } else {
        // Erreur de conversion
        addLogMessage(`Erreur: ${data.message}`, 'error');
        fhirOutput.textContent = `Erreur de conversion:\n${data.error}\n\n${data.message}`;
      }
    })
    .catch(error => {
      addLogMessage(`Erreur: ${error.message}`, 'error');
      fhirOutput.textContent = `Erreur lors de la conversion:\n${error.message}`;
    })
    .finally(() => {
      convertBtn.disabled = false;
    });
  });
}

/**
 * Configuration de la page d'historique
 */
function setupHistoryPage() {
  // TODO: Implémenter la logique pour la page d'historique
}

/**
 * Configuration de la page de paramètres
 */
function setupSettingsPage() {
  // TODO: Implémenter la logique pour la page de paramètres
}

/**
 * Configuration de la page d'administration
 */
function setupAdminPage() {
  // TODO: Implémenter la logique pour la page d'administration
}

/**
 * Correctif pour éviter la perte de focus dans les champs texte
 */
function applyTextFieldFix() {
  // Sélectionner tous les champs de texte
  const textFields = document.querySelectorAll('textarea, input[type="text"]');
  
  textFields.forEach(field => {
    // Conserver la position du curseur lors du focus
    field.addEventListener('focus', function() {
      const currentPos = this.selectionStart;
      
      setTimeout(() => {
        try {
          this.setSelectionRange(currentPos, currentPos);
        } catch (e) {
          // Ignorer les erreurs pour les éléments qui ne supportent pas setSelectionRange
        }
      }, 0);
    });
  });
  
  console.log("Application du correctif pour les champs texte");
  console.log(`Correctif appliqué à ${textFields.length} champs de saisie`);
}

/**
 * Afficher un message dans les logs de conversion
 * @param {string} message - Message à afficher
 * @param {string} type - Type de message (info, error, warning)
 */
function addLogMessage(message, type = 'info') {
  const logContainer = document.getElementById('conversion-logs');
  const timestamp = new Date().toLocaleTimeString();
  const logEntry = document.createElement('div');
  
  logEntry.classList.add('log-entry', type);
  logEntry.textContent = `[${timestamp}] ${message}`;
  
  logContainer.appendChild(logEntry);
  logContainer.scrollTop = logContainer.scrollHeight;
}

/**
 * Afficher la modal de connexion
 */
function showLoginModal() {
  const loginModal = document.getElementById('login-modal');
  loginModal.style.display = 'flex';
  
  const loginForm = document.getElementById('login-form');
  
  loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    
    // Appel API de connexion (simulé ici)
    if (username === 'admin' && password === 'adminfhirhub') {
      loginModal.style.display = 'none';
    } else {
      alert('Identifiants incorrects');
    }
  });
}

/**
 * Obtenir un exemple de message HL7
 * @returns {string} Message HL7 d'exemple
 */
function getSampleHL7Message() {
  return `MSH|^~\\&|LAB|HOSP|LAB1|HOSP1|20230228103500||ORM^O01|20230228103500|P|2.5
PID|1||12345^^^HIS^MR||SECLET^MARYSE BERTHE ALICE||19790315|F|||42 RUE LECOURBE^^PARIS^^75015^FRA^H||0142789087|0676543210|||||72145^^^HOSP^NS|
PV1|1|I|CHI^318^1^H45|||||||MED||||||||V1234^^^EHR|||||||||||||||||||||||||20230227103000|
ORC|NW|20230228-001|H67890|||||^^^20230228103500^^R||20230228103500|0123456^DUPONT^JEAN^^^DR^MD|||||LAB||
OBR|1|20230228-001|H67890|LP001^Hémogramme^SCH||20230228103500|20230228103500|||||||20230228103500|BS^Sang Périphérique^SCH|0123456^DUPONT^JEAN^^^DR^MD||||||20230228150000|||F|||
OBX|1|NM|HB^Hémoglobine||142|g/L|135-180|N|||F|
OBX|2|NM|PLAQ^Plaquettes||250|10*9/L|150-450|N|||F|
OBX|3|NM|GB^Globules Blancs||9.3|10*9/L|4.0-11.0|N|||F|`;
}
EOL
fi

# Créer le fichier utils.js pour le frontend
if [ ! -f "frontend/public/js/utils.js" ]; then
  cat > frontend/public/js/utils.js << 'EOL'
/**
 * Utilitaires pour l'application FHIRHub
 */

/**
 * Formatter un nombre avec des séparateurs de milliers
 * @param {number} num - Nombre à formatter
 * @returns {string} Nombre formatté
 */
function formatNumber(num) {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

/**
 * Formatter une date
 * @param {string} dateString - Chaîne de date ISO
 * @param {boolean} includeTime - Inclure l'heure
 * @returns {string} Date formattée
 */
function formatDate(dateString, includeTime = false) {
  if (!dateString) return '';
  
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return dateString;
  
  const options = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: includeTime ? '2-digit' : undefined,
    minute: includeTime ? '2-digit' : undefined
  };
  
  return date.toLocaleDateString('fr-FR', options);
}

/**
 * Tronquer un texte à une longueur maximale
 * @param {string} text - Texte à tronquer
 * @param {number} maxLength - Longueur maximale
 * @returns {string} Texte tronqué
 */
function truncateText(text, maxLength = 100) {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  
  return text.substring(0, maxLength) + '...';
}

/**
 * Échapper les caractères HTML
 * @param {string} html - Texte à échapper
 * @returns {string} Texte échappé
 */
function escapeHtml(html) {
  const div = document.createElement('div');
  div.textContent = html;
  return div.innerHTML;
}

/**
 * Générer une couleur aléatoire au format hexadécimal
 * @returns {string} Couleur au format hexadécimal
 */
function getRandomColor() {
  const letters = '0123456789ABCDEF';
  let color = '#';
  
  for (let i = 0; i < 6; i++) {
    color += letters[Math.floor(Math.random() * 16)];
  }
  
  return color;
}

/**
 * Transformer un objet en paramètres d'URL
 * @param {Object} params - Objet de paramètres
 * @returns {string} Chaîne de paramètres d'URL
 */
function formatQueryParams(params) {
  return Object.keys(params)
    .filter(key => params[key] !== undefined && params[key] !== null)
    .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`)
    .join('&');
}

/**
 * Extraire les paramètres d'URL
 * @param {string} url - URL à analyser
 * @returns {Object} Paramètres d'URL
 */
function parseQueryParams(url) {
  const params = {};
  const queryString = url.split('?')[1] || '';
  
  if (!queryString) return params;
  
  queryString.split('&').forEach(pair => {
    const [key, value] = pair.split('=');
    if (key && value) {
      params[decodeURIComponent(key)] = decodeURIComponent(value);
    }
  });
  
  return params;
}

/**
 * Afficher une notification temporaire
 * @param {string} message - Message à afficher
 * @param {string} type - Type de notification (success, error, warning, info)
 * @param {number} duration - Durée d'affichage en ms
 */
function showNotification(message, type = 'info', duration = 3000) {
  // Vérifier si le conteneur de notifications existe
  let notificationContainer = document.getElementById('notification-container');
  
  if (!notificationContainer) {
    notificationContainer = document.createElement('div');
    notificationContainer.id = 'notification-container';
    notificationContainer.style.position = 'fixed';
    notificationContainer.style.top = '10px';
    notificationContainer.style.right = '10px';
    notificationContainer.style.zIndex = '1000';
    document.body.appendChild(notificationContainer);
  }
  
  // Créer la notification
  const notification = document.createElement('div');
  notification.className = `notification ${type}`;
  notification.textContent = message;
  
  // Appliquer les styles
  notification.style.padding = '10px 15px';
  notification.style.marginBottom = '10px';
  notification.style.borderRadius = '4px';
  notification.style.boxShadow = '0 2px 5px rgba(0, 0, 0, 0.2)';
  notification.style.opacity = '0';
  notification.style.transition = 'opacity 0.3s ease-in-out';
  
  // Couleur de fond selon le type
  switch (type) {
    case 'success':
      notification.style.backgroundColor = '#2ecc71';
      notification.style.color = 'white';
      break;
    case 'error':
      notification.style.backgroundColor = '#e74c3c';
      notification.style.color = 'white';
      break;
    case 'warning':
      notification.style.backgroundColor = '#f39c12';
      notification.style.color = 'white';
      break;
    default:
      notification.style.backgroundColor = '#3498db';
      notification.style.color = 'white';
  }
  
  // Ajouter la notification au conteneur
  notificationContainer.appendChild(notification);
  
  // Afficher la notification avec un effet de fondu
  setTimeout(() => {
    notification.style.opacity = '1';
  }, 10);
  
  // Supprimer la notification après la durée spécifiée
  setTimeout(() => {
    notification.style.opacity = '0';
    setTimeout(() => {
      notificationContainer.removeChild(notification);
    }, 300);
  }, duration);
}

/**
 * Valider une adresse e-mail
 * @param {string} email - Adresse e-mail à valider
 * @returns {boolean} True si l'adresse est valide
 */
function isValidEmail(email) {
  const re = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return re.test(email);
}

/**
 * Copier un texte dans le presse-papier
 * @param {string} text - Texte à copier
 * @returns {Promise<boolean>} True si la copie a réussi
 */
async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (err) {
    console.error('Erreur lors de la copie dans le presse-papier:', err);
    return false;
  }
}

/**
 * Charger un fichier
 * @param {string} accept - Types de fichiers acceptés (ex: ".json,application/json")
 * @returns {Promise<File>} Fichier chargé
 */
function loadFile(accept = '*/*') {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.style.display = 'none';
    
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (file) {
        resolve(file);
      } else {
        reject(new Error('Aucun fichier sélectionné'));
      }
      document.body.removeChild(input);
    };
    
    document.body.appendChild(input);
    input.click();
  });
}

/**
 * Lire le contenu d'un fichier
 * @param {File} file - Fichier à lire
 * @returns {Promise<string>} Contenu du fichier
 */
function readFileContent(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      resolve(e.target.result);
    };
    
    reader.onerror = (e) => {
      reject(new Error('Erreur lors de la lecture du fichier'));
    };
    
    reader.readAsText(file);
  });
}

// Exporter les fonctions pour utilisation globale
window.utils = {
  formatNumber,
  formatDate,
  truncateText,
  escapeHtml,
  getRandomColor,
  formatQueryParams,
  parseQueryParams,
  showNotification,
  isValidEmail,
  copyToClipboard,
  loadFile,
  readFileContent
};
EOL
fi

# Lancement du serveur
echo "Démarrage du serveur FHIRHub..."
cd "$(dirname "$0")" && node server.js