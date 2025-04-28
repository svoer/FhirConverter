/**
 * Module spécifique pour l'extraction correcte des noms français
 * Gère particulièrement les prénoms composés français comme "MARYSE BERTHE ALICE"
 */

/**
 * Extraire correctement les noms français à partir d'un segment PID HL7
 * @param {string} hl7Message - Message HL7 complet
 * @returns {Array} Tableau d'objets nom FHIR avec prénoms correctement extraits
 */
function extractFrenchNames(hl7Message) {
  try {
    console.log('[FRENCH_NAME_EXTRACTOR] Tentative d\'extraction des noms français');
    
    if (!hl7Message) {
      console.error('[FRENCH_NAME_EXTRACTOR] Message HL7 manquant');
      return null;
    }

    // Trouver le segment PID
    const lines = hl7Message.split(/\r|\n|\r\n/);
    const pidLine = lines.find(line => line.startsWith('PID|'));
    
    if (!pidLine) {
      console.error('[FRENCH_NAME_EXTRACTOR] Segment PID non trouvé');
      return null;
    }
    
    console.log('[FRENCH_NAME_EXTRACTOR] Segment PID trouvé');
    
    // Extraire le champ PID-5 (nom du patient)
    const pidFields = pidLine.split('|');
    
    if (pidFields.length < 6) {
      console.error('[FRENCH_NAME_EXTRACTOR] Format PID invalide, champ de nom manquant');
      return null;
    }
    
    const nameField = pidFields[5];
    console.log('[FRENCH_NAME_EXTRACTOR] Champ PID-5 brut:', JSON.stringify(nameField));
    
    // Diviser si plusieurs occurrences (séparées par ~)
    const nameValues = nameField.split('~');
    console.log(`[FRENCH_NAME_EXTRACTOR] ${nameValues.length} valeurs de nom trouvées`);
    
    const names = [];
    
    // Trouver le nom légal (type 'L')
    // Format typique: "SECLET^MARYSE^MARYSE BERTHE ALICE^^^^L"
    const legalNameValue = nameValues.find(val => val.includes('^^^^L'));
    
    if (legalNameValue) {
      console.log('[FRENCH_NAME_EXTRACTOR] Nom légal trouvé:', JSON.stringify(legalNameValue));
      
      // Extraire les composants du nom
      const nameComponents = legalNameValue.split('^');
      
      if (nameComponents.length >= 3) {
        // Composant 1: Nom de famille
        const familyName = nameComponents[0];
        console.log('[FRENCH_NAME_EXTRACTOR] Nom de famille:', JSON.stringify(familyName));
        
        // Composant 2: Prénom principal/usuel
        const primaryGiven = nameComponents[1];
        console.log('[FRENCH_NAME_EXTRACTOR] Prénom principal:', JSON.stringify(primaryGiven));
        
        // Composant 3: Tous les prénoms (composés)
        const allGivenNames = nameComponents[2];
        console.log('[FRENCH_NAME_EXTRACTOR] Prénoms composés:', JSON.stringify(allGivenNames));
        
        if (allGivenNames) {
          // Diviser les prénoms composés par espace
          const givenNamesList = allGivenNames.split(' ');
          
          // Créer l'objet nom FHIR
          const nameObj = {
            family: familyName,
            given: givenNamesList,
            use: 'official'
          };
          
          console.log(`[FRENCH_NAME_EXTRACTOR] Nom complet créé avec ${givenNamesList.length} prénoms:`, nameObj);
          
          names.push(nameObj);
        } else {
          // Fallback si le prénom composé est manquant
          names.push({
            family: familyName,
            given: primaryGiven ? [primaryGiven] : [],
            use: 'official'
          });
        }
      } else {
        // Format incomplet, utiliser ce qui est disponible
        if (nameComponents.length >= 1) {
          names.push({
            family: nameComponents[0],
            given: nameComponents.length >= 2 ? [nameComponents[1]] : [],
            use: 'official'
          });
        }
      }
    } else if (nameValues.length > 0) {
      // Aucun nom légal trouvé, utiliser la première valeur
      const defaultName = nameValues[0];
      const defaultComponents = defaultName.split('^');
      
      names.push({
        family: defaultComponents[0] || '',
        given: defaultComponents.length >= 2 ? [defaultComponents[1]] : [],
        use: 'official'
      });
    }
    
    return names;
  } catch (error) {
    console.error('[FRENCH_NAME_EXTRACTOR] Erreur lors de l\'extraction des noms français:', error);
    return null;
  }
}

/**
 * Vérifier si un objet nom contient déjà des prénoms extraits
 * @param {Object} nameObj - Objet nom FHIR
 * @returns {boolean} True si les prénoms sont déjà extraits
 */
function hasExtractedGivenNames(nameObj) {
  return nameObj && nameObj.given && nameObj.given.length > 1;
}

module.exports = {
  extractFrenchNames,
  hasExtractedGivenNames
};