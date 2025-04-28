/**
 * Module spécifique pour l'extraction correcte des noms français
 * Gère particulièrement les prénoms composés français comme "MARYSE BERTHE ALICE"
 * Ce code est appelé directement par le convertisseur HL7 vers FHIR
 */

/**
 * Extraire correctement les noms français à partir d'un segment PID HL7
 * @param {string} hl7Message - Message HL7 complet
 * @returns {Array} Tableau d'objets nom FHIR avec prénoms correctement extraits
 */
function extractFrenchNames(hl7Message) {
  console.log("[FRENCH_NAMES_EXTRACTOR] Extraction spécifique des noms français");
  
  if (!hl7Message || typeof hl7Message !== 'string') {
    console.log("[FRENCH_NAMES_EXTRACTOR] Message HL7 invalide ou vide");
    return [];
  }
  
  const extractedNames = [];
  
  try {
    // Extraire le segment PID
    const lines = hl7Message.split(/[\r\n]+/);
    const pidLine = lines.find(line => line.startsWith('PID|'));
    
    if (!pidLine) {
      console.log("[FRENCH_NAMES_EXTRACTOR] Segment PID non trouvé");
      return [];
    }
    
    console.log("[FRENCH_NAMES_EXTRACTOR] Segment PID trouvé: " + pidLine.substring(0, 50) + "...");
    
    // Extraire le champ PID-5 (nom du patient)
    const pidFields = pidLine.split('|');
    if (pidFields.length < 6) {
      console.log("[FRENCH_NAMES_EXTRACTOR] Champ PID-5 non trouvé");
      return [];
    }
    
    const nameField = pidFields[5]; // PID-5 est à l'index 5 (les champs commencent à 0 après le split)
    console.log("[FRENCH_NAMES_EXTRACTOR] Champ PID-5: " + nameField);
    
    // Traiter les répétitions dans le champ nom
    const nameValues = nameField.split('~');
    console.log(`[FRENCH_NAMES_EXTRACTOR] ${nameValues.length} valeurs de nom trouvées`);
    
    // Pour chaque répétition de nom
    nameValues.forEach((nameVal, index) => {
      console.log(`[FRENCH_NAMES_EXTRACTOR] Traitement du nom #${index + 1}: "${nameVal}"`);
      
      // Découper en composants (séparés par ^)
      const nameParts = nameVal.split('^');
      
      // Vérifier qu'il y a au moins un nom de famille
      if (nameParts.length > 0 && nameParts[0].trim() !== '') {
        // Déterminer l'usage du nom
        let nameUse = 'official';
        if (nameParts.length > 6) {
          switch (nameParts[6]) {
            case 'L': nameUse = 'official'; break;
            case 'D': nameUse = 'usual'; break;
            case 'M': nameUse = 'maiden'; break;
            case 'N': nameUse = 'nickname'; break;
            default: nameUse = 'official';
          }
        }
        
        // Créer l'objet nom
        const nameObj = {
          family: nameParts[0].trim(),
          given: [],
          use: nameUse
        };
        
        // Prénom principal
        if (nameParts.length > 1 && nameParts[1].trim() !== '') {
          nameObj.given.push(nameParts[1].trim());
        }
        
        // Prénoms supplémentaires - SPÉCIFIQUE POUR LES NOMS FRANÇAIS COMPOSÉS
        if (nameParts.length > 2 && nameParts[2].trim() !== '') {
          console.log(`[FRENCH_NAMES_EXTRACTOR] Prénoms composés trouvés: "${nameParts[2].trim()}"`);
          const additionalNames = nameParts[2].trim().split(' ');
          additionalNames.forEach(name => {
            if (name.trim() !== '' && !nameObj.given.includes(name.trim())) {
              nameObj.given.push(name.trim());
              console.log(`[FRENCH_NAMES_EXTRACTOR] Prénom supplémentaire ajouté: "${name.trim()}"`);
            }
          });
        }
        
        // Préfixe (titre)
        if (nameParts.length > 4 && nameParts[4].trim() !== '') {
          nameObj.prefix = [nameParts[4].trim()];
        }
        
        extractedNames.push(nameObj);
      }
    });
    
    console.log(`[FRENCH_NAMES_EXTRACTOR] ${extractedNames.length} noms extraits avec succès`);
    return extractedNames;
    
  } catch (error) {
    console.error("[FRENCH_NAMES_EXTRACTOR] Erreur lors de l'extraction des noms:", error);
    return [];
  }
}

// Application pour vérifier si un nom vient d'être correctement extrait
function hasExtractedGivenNames(nameObj) {
  return nameObj && nameObj.given && nameObj.given.length > 0;
}

module.exports = {
  extractFrenchNames,
  hasExtractedGivenNames
};