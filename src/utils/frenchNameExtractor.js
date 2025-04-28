/**
 * Module spécifique pour l'extraction correcte des noms français
 * Gère particulièrement les prénoms composés français comme "MARYSE BERTHE ALICE"
 * 
 * @module frenchNameExtractor
 * @author FHIRHub Team
 */

/**
 * Extraire correctement les noms français à partir d'un segment PID HL7
 * @param {string} hl7Message - Message HL7 complet
 * @returns {Array} Tableau d'objets nom FHIR avec prénoms correctement extraits
 */
function extractFrenchNames(hl7Message) {
  try {
    console.log("[FRENCH_NAME_EXTRACTOR] Tentative d'extraction des noms français");
    
    if (!hl7Message) {
      console.log("[FRENCH_NAME_EXTRACTOR] Aucun message HL7 fourni");
      return [];
    }
    
    // Extraire le segment PID du message HL7
    const pidSegmentMatch = hl7Message.match(/PID\|[^]*?(?=\r|\n|$)/);
    if (!pidSegmentMatch) {
      console.log("[FRENCH_NAME_EXTRACTOR] Segment PID non trouvé");
      return [];
    }
    
    const pidSegment = pidSegmentMatch[0];
    console.log("[FRENCH_NAME_EXTRACTOR] Segment PID trouvé");
    
    // Extraire le champ PID-5 (nom du patient)
    const pidFieldsSeparator = hl7Message.charAt(3); // Généralement |
    const pidFields = pidSegment.split(pidFieldsSeparator);
    
    if (pidFields.length < 6) {
      console.log("[FRENCH_NAME_EXTRACTOR] Champ PID-5 non trouvé");
      return [];
    }
    
    const pid5Field = pidFields[5]; // Le champ PID-5 est à l'index 5 (après le séparateur de segment)
    console.log(`[FRENCH_NAME_EXTRACTOR] Champ PID-5 brut: "${pid5Field}"`);
    
    // Séparateur de répétition de champ (généralement ~)
    const repetitionSeparator = hl7Message.charAt(5);
    
    // Séparateur de composants (généralement ^)
    const componentSeparator = hl7Message.charAt(4);
    
    // Diviser les noms (il peut y avoir plusieurs noms séparés par ~)
    const nameValues = pid5Field.split(repetitionSeparator);
    console.log(`[FRENCH_NAME_EXTRACTOR] ${nameValues.length} valeurs de nom trouvées`);
    
    // Trouver le nom avec le type L (Legal)
    const legalNameValue = nameValues.find(name => name.includes("^^^^L"));
    
    if (!legalNameValue) {
      // Chercher simplement le dernier nom si aucun n'est marqué comme légal
      console.log("[FRENCH_NAME_EXTRACTOR] Aucun nom légal trouvé, utilisation du dernier nom");
      return extractNameComponents(nameValues[nameValues.length - 1], componentSeparator);
    }
    
    console.log(`[FRENCH_NAME_EXTRACTOR] Nom légal trouvé: "${legalNameValue}"`);
    return extractNameComponents(legalNameValue, componentSeparator);
  } catch (error) {
    console.error("[FRENCH_NAME_EXTRACTOR] Erreur lors de l'extraction:", error);
    return [];
  }
}

/**
 * Extraire les composants de nom à partir d'un champ HL7 PID-5
 * @param {string} nameValue - Valeur du nom (une partie du champ PID-5)
 * @param {string} separator - Séparateur de composants (généralement ^)
 * @returns {Array} Tableau d'objets nom au format FHIR
 */
function extractNameComponents(nameValue, separator) {
  if (!nameValue) {
    return [];
  }
  
  // Diviser le nom en composants
  const nameComponents = nameValue.split(separator);
  
  // Structure PID-5: FamilyName^GivenName^MiddleName^Suffix^Prefix^...
  const familyName = nameComponents[0] || "";
  console.log(`[FRENCH_NAME_EXTRACTOR] Nom de famille: "${familyName}"`);
  
  // Prénom principal (premier prénom)
  const givenName = nameComponents[1] || "";
  console.log(`[FRENCH_NAME_EXTRACTOR] Prénom principal: "${givenName}"`);
  
  // Prénoms composés (dans le champ middleName)
  const middleName = nameComponents[2] || "";
  console.log(`[FRENCH_NAME_EXTRACTOR] Prénoms composés: "${middleName}"`);
  
  // Vérifier s'il y a des prénoms
  if (!givenName && !middleName) {
    console.log("[FRENCH_NAME_EXTRACTOR] Aucun prénom trouvé");
    return [];
  }
  
  // Si le middleName contient un espace, c'est probablement un prénom composé français
  // comme "MARYSE BERTHE ALICE"
  const givenNames = [];
  
  // Utiliser uniquement les prénoms composés si présents, sinon utiliser le prénom simple
  if (middleName && middleName.includes(" ")) {
    // Diviser le prénom composé en prénoms individuels
    const additionalNames = middleName.split(" ").filter(name => name.trim() !== "");
    givenNames.push(...additionalNames);
  } else if (middleName) {
    givenNames.push(middleName);
  } else if (givenName) {
    // Utiliser le givenName seulement si pas de middleName
    givenNames.push(givenName);
  }
  
  // Créer l'objet nom au format FHIR
  const fhirName = {
    family: familyName,
    given: givenNames,
    use: "official"
  };
  
  console.log(`[FRENCH_NAME_EXTRACTOR] Nom complet créé avec ${givenNames.length} prénoms:`, fhirName);
  
  return [fhirName];
}

/**
 * Vérifier si un objet nom contient des prénoms extraits
 * @param {Object} nameObj - Objet nom au format FHIR
 * @returns {boolean} True si l'objet contient des prénoms extraits
 */
function hasExtractedGivenNames(nameObj) {
  return nameObj && 
         nameObj.given && 
         Array.isArray(nameObj.given) && 
         nameObj.given.length >= 2 &&
         nameObj.given.every(name => name.trim() !== "");
}

module.exports = {
  extractFrenchNames,
  hasExtractedGivenNames
};