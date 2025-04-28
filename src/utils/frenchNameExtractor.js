/**
 * Module d'extraction des noms français à partir de messages HL7
 * 
 * Gère les spécificités des prénoms composés français dans le contexte de la conversion HL7 vers FHIR.
 * Par exemple: "MARYSE BERTHE ALICE" doit être correctement extrait comme 3 prénoms distincts.
 */

/**
 * Extraire les noms français d'un message HL7
 * @param {string} hl7Message - Message HL7 complet
 * @returns {Array} Tableau d'objets nom FHIR avec prénoms correctement extraits
 */
function extractNames(hl7Message) {
  try {
    console.log('[FHIR_NAME_PROCESSOR] Traitement des noms FHIR');
    
    // Utiliser le même extracteur de noms que dans apply_french_names_fix.js
    const names = extractFrenchNames(hl7Message);
    
    // Log des résultats
    if (names.length > 0) {
      console.log('[FHIR_NAME_PROCESSOR] Nom français ajouté à la ressource Patient');
    }
    
    console.log('[FHIR_NAME_PROCESSOR] Nettoyage FHIR et traitement terminés avec succès');
    
    return names;
  } catch (error) {
    console.error('[FHIR_NAME_PROCESSOR] Erreur lors du traitement des noms FHIR:', error);
    return [];
  }
}

/**
 * Fonction interne pour extraire les prénoms composés français
 * @param {string} hl7Content - Message HL7 complet
 * @returns {Array} Tableau des noms extraits avec leurs prénoms composés
 */
function extractFrenchNames(hl7Content) {
  try {
    console.log('[FRENCH_NAME_EXTRACTOR] Tentative d\'extraction des noms français');
    
    // Découper le message HL7 en segments
    const segments = hl7Content.split(/[\r\n]+/);
    
    // Chercher le segment PID
    const pidSegment = segments.find(seg => seg.startsWith('PID|'));
    
    if (!pidSegment) {
      console.log('[FRENCH_NAME_EXTRACTOR] Aucun segment PID trouvé');
      return [];
    }
    
    console.log('[FRENCH_NAME_EXTRACTOR] Segment PID trouvé');
    
    // Extraire le champ PID-5 (nom)
    const pidFields = pidSegment.split('|');
    if (pidFields.length < 6) {
      console.log('[FRENCH_NAME_EXTRACTOR] Champ PID-5 manquant');
      return [];
    }
    
    const nameField = pidFields[5];
    console.log(`[FRENCH_NAME_EXTRACTOR] Champ PID-5 brut: "${nameField}"`);
    
    if (!nameField) {
      console.log('[FRENCH_NAME_EXTRACTOR] Champ PID-5 vide');
      return [];
    }
    
    // Traiter les répétitions (plusieurs noms)
    const nameValues = nameField.split('~');
    console.log(`[FRENCH_NAME_EXTRACTOR] ${nameValues.length} valeurs de nom trouvées`);
    
    const names = [];
    
    // Chercher un nom légal (use=L)
    const legalNameValue = nameValues.find(val => val.includes('^^^^L'));
    
    if (legalNameValue) {
      console.log(`[FRENCH_NAME_EXTRACTOR] Nom légal trouvé: "${legalNameValue}"`);
      
      // Extraire les composants du nom
      const nameParts = legalNameValue.split('^');
      
      // Le format attendu est: family^given1^given2^given3^...
      const family = nameParts[0];
      console.log(`[FRENCH_NAME_EXTRACTOR] Nom de famille: "${family}"`);
      
      let given = [];
      let compositeGiven = null;
      
      // Premier prénom standard
      if (nameParts.length > 1 && nameParts[1]) {
        console.log(`[FRENCH_NAME_EXTRACTOR] Prénom principal: "${nameParts[1]}"`);
        given.push(nameParts[1]);
      }
      
      // Traitement spécial pour les prénoms composés français
      // Ils sont souvent mis dans le champ des prénoms supplémentaires
      if (nameParts.length > 2 && nameParts[2]) {
        // Vérifier si c'est un prénom composé (contient des espaces)
        if (nameParts[2].includes(' ')) {
          console.log(`[FRENCH_NAME_EXTRACTOR] Prénoms composés: "${nameParts[2]}"`);
          compositeGiven = nameParts[2];
          
          // Diviser le prénom composé en parties individuelles
          const compositeParts = nameParts[2].split(' ');
          
          // Si le premier prénom est déjà inclus, ne pas le dupliquer
          if (given.length > 0 && compositeParts[0] === given[0]) {
            // Ajouter seulement les prénoms supplémentaires
            given = [...given, ...compositeParts.slice(1)];
          } else {
            // Ajouter tous les prénoms
            given = [...given, ...compositeParts];
          }
        } else if (nameParts[2] !== given[0]) {
          // Simple deuxième prénom
          given.push(nameParts[2]);
        }
      }
      
      // Créer l'objet nom FHIR
      const name = {
        family: family,
        given: given,
        use: 'official'
      };
      
      console.log(`[FRENCH_NAME_EXTRACTOR] Nom complet créé avec ${given.length} prénoms:`, name);
      
      names.push(name);
    }
    
    return names;
  } catch (error) {
    console.error('[FRENCH_NAME_EXTRACTOR] Erreur lors de l\'extraction des noms:', error);
    return [];
  }
}

module.exports = {
  extractNames,
  extractFrenchNames  // Exporter aussi la fonction interne pour les tests
};