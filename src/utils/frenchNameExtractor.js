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
  console.log('[FRENCH_NAME_EXTRACTOR] Tentative d\'extraction des noms français');
  
  if (!hl7Message) {
    console.warn('[FRENCH_NAME_EXTRACTOR] Message HL7 vide ou invalide');
    return [];
  }
  
  try {
    // Trouver le segment PID
    const lines = hl7Message.split('\n');
    const pidLine = lines.find(line => line.startsWith('PID|'));
    
    if (!pidLine) {
      console.warn('[FRENCH_NAME_EXTRACTOR] Segment PID non trouvé');
      return [];
    }
    
    console.log('[FRENCH_NAME_EXTRACTOR] Segment PID trouvé');
    
    // Extraire le champ PID-5 (nom du patient)
    const fields = pidLine.split('|');
    if (fields.length < 6) {
      console.warn('[FRENCH_NAME_EXTRACTOR] Champ PID-5 manquant');
      return [];
    }
    
    const nameField = fields[5];
    console.log(`[FRENCH_NAME_EXTRACTOR] Champ PID-5 brut: "${nameField}"`);
    
    // Analyser les différentes valeurs de noms (répétitions séparées par ~)
    const nameValues = nameField.split('~');
    console.log(`[FRENCH_NAME_EXTRACTOR] ${nameValues.length} valeurs de nom trouvées`);
    
    const names = [];
    
    // Trouver le nom légal (L) ou le nom officiel si le légal n'est pas présent
    let legalName = nameValues.find(name => name.includes('^^^^L') || name.endsWith('^^^^L'));
    
    if (!legalName) {
      // Utiliser le premier nom comme fallback
      legalName = nameValues[0];
    }
    
    console.log(`[FRENCH_NAME_EXTRACTOR] Nom légal trouvé: "${legalName}"`);
    
    if (legalName) {
      // Extraire les composants du nom (nom de famille, prénom, prénom composé, etc.)
      const nameParts = legalName.split('^');
      
      const family = nameParts[0];
      console.log(`[FRENCH_NAME_EXTRACTOR] Nom de famille: "${family}"`);
      
      const firstGiven = nameParts[1];
      console.log(`[FRENCH_NAME_EXTRACTOR] Prénom principal: "${firstGiven}"`);
      
      // Vérifier la présence de prénoms composés dans le champ 2 (XPN.2)
      const composedGivens = nameParts[2];
      console.log(`[FRENCH_NAME_EXTRACTOR] Prénoms composés: "${composedGivens}"`);
      
      if (composedGivens && composedGivens.includes(' ')) {
        // Séparer les prénoms composés
        const allGivens = composedGivens.split(' ');
        
        // Créer l'objet nom FHIR avec tous les prénoms
        const name = {
          family: family,
          given: allGivens.filter(g => g.trim().length > 0), // Filtrer les prénoms vides
          use: 'official'
        };
        
        console.log(`[FRENCH_NAME_EXTRACTOR] Nom complet créé avec ${name.given.length} prénoms:`, name);
        names.push(name);
      } else {
        // Pas de prénoms composés, utiliser les valeurs standard
        const givens = [];
        
        // Ajouter le prénom principal s'il existe
        if (firstGiven && firstGiven.trim()) {
          givens.push(firstGiven);
        }
        
        // Ajouter le deuxième prénom s'il existe et n'est pas déjà inclus
        if (composedGivens && composedGivens.trim() && !givens.includes(composedGivens)) {
          givens.push(composedGivens);
        }
        
        // Ajouter d'autres prénoms s'ils existent (XPN.3, XPN.4, etc.)
        for (let i = 3; i < nameParts.length; i++) {
          if (nameParts[i] && nameParts[i].trim() && !givens.includes(nameParts[i]) && !nameParts[i].startsWith('MM') && !nameParts[i].startsWith('D')) {
            givens.push(nameParts[i]);
          }
        }
        
        // Créer l'objet nom FHIR
        const name = {
          family: family,
          given: givens,
          use: 'official'
        };
        
        console.log(`[FRENCH_NAME_EXTRACTOR] Nom standard créé avec ${givens.length} prénoms:`, name);
        names.push(name);
      }
    }
    
    // Si au moins un nom a été trouvé avec des prénoms composés, l'utiliser
    // Sinon, vérifier les autres valeurs de noms
    if (names.length === 0 || !hasExtractedGivenNames(names[0])) {
      for (const nameValue of nameValues) {
        if (nameValue === legalName) continue; // Éviter de traiter 2 fois le même nom
        
        const nameParts = nameValue.split('^');
        
        if (nameParts.length >= 2) {
          const family = nameParts[0];
          const firstGiven = nameParts[1];
          
          const nameType = nameParts[7] || '';
          let use = 'usual';
          
          // Déterminer le type d'utilisation du nom
          if (nameType === 'L') use = 'official';
          else if (nameType === 'D') use = 'maiden';
          else if (nameType === 'M' || nameType.includes('MAI')) use = 'maiden';
          
          // Créer l'objet nom FHIR simple
          const name = {
            family: family,
            given: [firstGiven],
            use: use
          };
          
          // Ajouter seulement si ce type de nom n'existe pas déjà
          if (!names.some(n => n.use === use)) {
            names.push(name);
          }
        }
      }
    }
    
    return names;
  } catch (error) {
    console.error('[FRENCH_NAME_EXTRACTOR] Erreur lors de l\'extraction des noms:', error);
    return [];
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
  extractFrenchNames
};