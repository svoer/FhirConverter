/**
 * Adaptateur pour les terminologies françaises
 * Compatibilité avec les spécifications ANS pour FHIR
 */

// OIDs et systèmes de terminologie français
const FRENCH_OIDS = {
  // Identifiants patients
  "INS-C": "1.2.250.1.213.1.4.2",
  "INS-A": "1.2.250.1.213.1.4.11",
  "IPP": "1.2.250.1.213.1.4.8",
  
  // Organisations et établissements
  "FINESS": "1.2.250.1.71.4.2.2",
  "RPPS": "1.2.250.1.71.4.2.1",
  "ADELI": "1.2.250.1.71.4.2.3",
  "SIRET": "1.2.250.1.71.4.2.4",
  
  // Terminologies
  "SNOMED-CT-FR": "2.16.840.1.113883.6.96.1.2",
  "CIM-10-FR": "2.16.840.1.113883.6.3.1.2",
  "CCAM": "1.2.250.1.213.2.5",
  "UCD": "1.2.250.1.213.2.3.1"
};

// Systèmes d'URL utilisés dans FHIR
const FRENCH_SYSTEMS = {
  // Identifiants patients
  "INS-C": "https://mos.esante.gouv.fr/NOS/TRE_R92-IdentifiantNationalDeSante/FHIR/TRE-R92-IdentifiantNationalDeSante",
  "INS-NIR": "http://www.interopsante.org/fhir/id/ins-nir",
  "INS-NIA": "http://www.interopsante.org/fhir/id/ins-nia",
  
  // Identifiants professionnels
  "RPPS": "http://rpps.fr",
  "ADELI": "http://adeli.fr",
  
  // Identifiants structures
  "FINESS": "http://finess.sante.gouv.fr",
  "SIRET": "http://siret.fr",
  
  // Terminologies médicales
  "SNOMED-CT-FR": "http://snomed.info/sct/1.2.250.1.213.2.24",
  "CIM10": "http://terminology.hl7.org/CodeSystem/icd10",
  "CCAM": "https://mos.esante.gouv.fr/NOS/TRE_A_CCAM/FHIR/TRE-A-CCAM",
  "UCD": "https://mos.esante.gouv.fr/NOS/TRE_R08-UCD/FHIR/TRE-R08-UCD"
};

/**
 * Convertir un OID en URL système FHIR selon les spécifications françaises
 * @param {string} oid - OID à convertir
 * @returns {string} URL du système FHIR correspondant
 */
function oidToSystem(oid) {
  // Recherche inverse dans le tableau FRENCH_OIDS
  for (const [key, value] of Object.entries(FRENCH_OIDS)) {
    if (value === oid) {
      return FRENCH_SYSTEMS[key] || `urn:oid:${oid}`;
    }
  }
  
  // Si aucune correspondance n'est trouvée, retourner l'OID en format urn:oid
  return `urn:oid:${oid}`;
}

/**
 * Convertir une URL système FHIR en OID selon les spécifications françaises
 * @param {string} system - URL du système FHIR à convertir
 * @returns {string|null} OID correspondant ou null si non trouvé
 */
function systemToOid(system) {
  // Recherche inverse dans le tableau FRENCH_SYSTEMS
  for (const [key, value] of Object.entries(FRENCH_SYSTEMS)) {
    if (value === system) {
      return FRENCH_OIDS[key] || null;
    }
  }
  
  // Si l'URL est déjà au format urn:oid, extraire l'OID
  if (system.startsWith('urn:oid:')) {
    return system.substring(8);
  }
  
  return null;
}

module.exports = {
  FRENCH_OIDS,
  FRENCH_SYSTEMS,
  oidToSystem,
  systemToOid
};