/**
 * Module d'extraction et de traitement des noms français
 * Gère les cas spécifiques des noms composés, conventions de nommage 
 * et normalisation selon les standards FHIR
 * 
 * @module frenchNameExtractor
 * @version 1.0.0
 * @author FHIRHub Team
 */

/**
 * Analyse un nom potentiellement composé pour séparer nom de famille et prénoms
 * @param {string} nameString - Chaîne de caractères contenant le nom complet
 * @returns {Object} Objet contenant familyName et givenNames
 */
function analyzeComplexFrenchName(nameString) {
  if (!nameString || typeof nameString !== 'string') {
    return { familyName: null, givenNames: [] };
  }

  // Cas spécial: nom unique d'une lettre (souvent une erreur)
  if (nameString.length === 1) {
    return { familyName: null, givenNames: [] };
  }
  
  // Si le nom contient des espaces, possible nom composé français
  if (nameString.includes(' ')) {
    const parts = nameString.split(' ').filter(Boolean);
    
    // Si plus de 1 mot, possible nom+prénom composite
    if (parts.length > 1) {
      // Marqueurs de prénoms français courants
      const frenchNameIndicators = ['JEAN', 'MARIE', 'PIERRE', 'PAUL', 'LOUIS', 'ANNE', 'MARC'];
      
      // Vérifier si un des indicateurs de prénom composé est présent
      for (let i = 0; i < parts.length - 1; i++) {
        if (frenchNameIndicators.includes(parts[i])) {
          console.log('[FRENCH_NAME_EXTRACTOR] Prénom composé détecté:', nameString);
          return {
            familyName: null,
            givenNames: parts
          };
        }
      }
      
      // Si pas d'indicateur de prénom composé mais plusieurs parties, possible structure nom/prénom
      // Dans la convention française, le premier mot est généralement le nom de famille
      // et le reste sont les prénoms
      console.log('[FRENCH_NAME_EXTRACTOR] Nom avec plusieurs parties:', nameString);
      return {
        familyName: parts[0],
        givenNames: parts.slice(1)
      };
    }
  }
  
  // Si le nom est simple, le retourner comme nom de famille
  return { familyName: nameString, givenNames: [] };
}

/**
 * Extrait nom et prénom(s) depuis un format HL7 français
 * @param {string} nameString - Chaîne de type "NOM^PRENOM^COMPLEMENT"
 * @returns {Object} Objet avec nom et prénoms formatés pour FHIR
 */
function extractFrenchNameComponents(nameString) {
  if (!nameString || typeof nameString !== 'string') {
    return { family: null, given: [] };
  }
  
  console.log('[FRENCH_NAME_EXTRACTOR] Tentative d\'extraction des noms français');
  
  // Diviser selon le format HL7 standard
  const parts = nameString.split('^');
  let family = parts[0] || '';
  let given = [];
  
  // Analyser la partie nom de famille pour détecter prénom composé potentiel
  if (family && family.includes(' ')) {
    const analyzedFamily = analyzeComplexFrenchName(family);
    
    // Si le nom contient des prénoms
    if (analyzedFamily.givenNames && analyzedFamily.givenNames.length > 0) {
      console.log('[FRENCH_NAME_EXTRACTOR] Prénoms extraits:', analyzedFamily.givenNames.join(', '));
      given = [...analyzedFamily.givenNames];
      family = analyzedFamily.familyName || family; // Si null, on garde le nom original
    }
  }
  
  // Traiter la partie prénom (XPN.2)
  if (parts[1]) {
    const givenName = parts[1];
    
    // Prénoms composés avec espaces
    if (givenName.includes(' ')) {
      console.log('[FRENCH_NAME_EXTRACTOR] Prénom composé détecté:', givenName);
      given.push(...givenName.split(' ').filter(Boolean));
    } else {
      given.push(givenName);
    }
  }
  
  // Traiter l'éventuel prénom additionnel (XPN.3)
  if (parts[2]) {
    const middleName = parts[2];
    
    // Prénoms additionnels avec espaces
    if (middleName.includes(' ')) {
      const additionalNames = middleName.split(' ').filter(Boolean);
      given.push(...additionalNames);
    } else {
      given.push(middleName);
    }
  }
  
  // Dédupliquer les prénoms
  const uniqueGiven = [...new Set(given)];
  
  console.log('[FRENCH_NAME_EXTRACTOR] Nom extrait:', family, uniqueGiven.join(', '));
  return {
    family: family || null,
    given: uniqueGiven.length > 0 ? uniqueGiven : []
  };
}

/**
 * Détermine l'utilisation du nom selon les normes françaises
 * @param {string} useCode - Code d'utilisation selon HL7
 * @returns {string} Code d'utilisation FHIR
 */
function determineNameUse(useCode) {
  const nameUseMap = {
    'L': 'official', // Légal
    'D': 'maiden',   // Nom de jeune fille (spécificité française)
    'M': 'maiden',   // Nom de jeune fille
    'N': 'nickname', // Surnom
    'S': 'old',      // Nom marital (spécificité française)
    'C': 'usual',    // Nom d'usage (spécificité française)
    'A': 'anonymous',// Pseudonyme
    'I': 'old'       // Précédent
  };
  
  return nameUseMap[useCode] || 'official';
}

/**
 * Crée un ensemble d'objets nom FHIR à partir d'une chaîne HL7
 * @param {string} nameString - Chaîne de type "NOM^PRENOM^COMPLEMENT"
 * @returns {Array} Tableau d'objets nom FHIR
 */
function extractFrenchNames(nameString) {
  if (!nameString) {
    return [];
  }
  
  const result = [];
  
  // Cas 1: format HL7 standard avec séparateur ^
  if (nameString.includes('^')) {
    const parts = nameString.split('^');
    const nameComponents = extractFrenchNameComponents(nameString);
    
    // Type d'utilisation du nom (7ème composant)
    const useCode = parts.length > 6 ? parts[6] : 'L'; // Par défaut 'L' = legal/official
    const useType = determineNameUse(useCode);
    
    // Construction de l'objet nom FHIR
    const nameObj = { use: useType };
    
    if (nameComponents.family) {
      nameObj.family = nameComponents.family;
    }
    
    if (nameComponents.given && nameComponents.given.length > 0) {
      nameObj.given = nameComponents.given;
    }
    
    // Préfixe (5ème composant)
    if (parts.length > 4 && parts[4]) {
      nameObj.prefix = [parts[4]];
    }
    
    // Suffixe (4ème et 6ème composants)
    const suffixes = [];
    if (parts.length > 3 && parts[3]) {
      suffixes.push(parts[3]);
    }
    if (parts.length > 5 && parts[5]) {
      suffixes.push(parts[5]);
    }
    
    if (suffixes.length > 0) {
      nameObj.suffix = suffixes;
    }
    
    result.push(nameObj);
  }
  // Cas 2: format simple (juste le nom)
  else {
    const analyzedName = analyzeComplexFrenchName(nameString);
    
    if (analyzedName.familyName || (analyzedName.givenNames && analyzedName.givenNames.length > 0)) {
      const nameObj = { use: 'official' };
      
      if (analyzedName.familyName) {
        nameObj.family = analyzedName.familyName;
      }
      
      if (analyzedName.givenNames && analyzedName.givenNames.length > 0) {
        nameObj.given = analyzedName.givenNames;
      }
      
      result.push(nameObj);
    } else {
      // Si pas d'analyse réussie, utiliser la chaîne comme nom de famille
      result.push({
        use: 'official',
        family: nameString
      });
    }
  }
  
  console.log('[FRENCH_NAME_EXTRACTOR] Total de noms extraits:', result.length);
  return result;
}

module.exports = {
  extractFrenchNames,
  analyzeComplexFrenchName,
  determineNameUse
};