/**
 * Correctif pour l'extraction des noms français composés
 * Ce module peut être appliqué directement aux résultats FHIR générés
 */

// Fonction pour extraire correctement les prénoms composés français
function extractFrenchNames(hl7Message) {
  console.log("[FRENCH_NAMES_FIX] Extraction des noms français...");
  if (!hl7Message || typeof hl7Message !== 'string') return [];

  const extractedNames = [];
  
  try {
    // Extraire le segment PID
    const lines = hl7Message.split(/[\r\n]+/);
    const pidLine = lines.find(line => line.startsWith('PID|'));
    
    if (!pidLine) {
      console.log("[FRENCH_NAMES_FIX] Segment PID non trouvé");
      return [];
    }
    
    // Extraire le champ PID-5 (nom du patient)
    const pidFields = pidLine.split('|');
    if (pidFields.length < 6) {
      console.log("[FRENCH_NAMES_FIX] Champ PID-5 non trouvé");
      return [];
    }
    
    const nameField = pidFields[5]; // PID-5 est à l'index 5 (les champs commencent à 0 après le split)
    console.log("[FRENCH_NAMES_FIX] Champ PID-5: " + nameField);
    
    // Traiter les répétitions dans le champ nom
    const nameValues = nameField.split('~');
    console.log(`[FRENCH_NAMES_FIX] ${nameValues.length} valeurs de nom trouvées`);
    
    // Pour chaque répétition de nom
    nameValues.forEach((nameVal, index) => {
      console.log(`[FRENCH_NAMES_FIX] Traitement du nom #${index + 1}: "${nameVal}"`);
      
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
          console.log(`[FRENCH_NAMES_FIX] Prénoms composés trouvés: "${nameParts[2].trim()}"`);
          const additionalNames = nameParts[2].trim().split(' ');
          additionalNames.forEach(name => {
            if (name.trim() !== '' && !nameObj.given.includes(name.trim())) {
              nameObj.given.push(name.trim());
              console.log(`[FRENCH_NAMES_FIX] Prénom supplémentaire ajouté: "${name.trim()}"`);
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
    
    console.log(`[FRENCH_NAMES_FIX] ${extractedNames.length} noms extraits avec succès`);
    return extractedNames;
    
  } catch (error) {
    console.error("[FRENCH_NAMES_FIX] Erreur lors de l'extraction des noms:", error);
    return [];
  }
}

// Fonction pour corriger le bundle FHIR avec les noms français correctement extraits
function fixFrenchNamesInFhirBundle(fhirBundle, hl7Message) {
  if (!fhirBundle || !fhirBundle.entry || !hl7Message) {
    console.log("[FRENCH_NAMES_FIX] Bundle FHIR ou message HL7 invalide");
    return fhirBundle;
  }
  
  try {
    // Extraire les noms français correctement
    const correctNames = extractFrenchNames(hl7Message);
    
    if (correctNames.length === 0) {
      console.log("[FRENCH_NAMES_FIX] Aucun nom français correctement extrait");
      return fhirBundle;
    }
    
    console.log(`[FRENCH_NAMES_FIX] ${correctNames.length} noms français extraits correctement`);
    
    // Trouver la ressource Patient dans le bundle
    const patientEntry = fhirBundle.entry.find(entry => 
      entry.resource && entry.resource.resourceType === 'Patient');
    
    // Trouver la ressource Person dans le bundle
    const personEntry = fhirBundle.entry.find(entry => 
      entry.resource && entry.resource.resourceType === 'Person');
    
    if (patientEntry && patientEntry.resource) {
      console.log("[FRENCH_NAMES_FIX] Ressource Patient trouvée, application des noms corrigés");
      
      // Rechercher un nom avec l'usage 'official' (type L) parmi les noms extraits
      const officialName = correctNames.find(name => name.use === 'official');
      
      if (officialName) {
        console.log("[FRENCH_NAMES_FIX] Nom officiel trouvé avec des prénoms composés");
        console.log(`[FRENCH_NAMES_FIX] Prénoms: ${JSON.stringify(officialName.given)}`);
        
        // Si la ressource Patient a déjà des noms, mettre à jour seulement si nécessaire
        if (patientEntry.resource.name && patientEntry.resource.name.length > 0) {
          const existingOfficialIndex = patientEntry.resource.name.findIndex(n => n.use === 'official');
          
          if (existingOfficialIndex >= 0) {
            // Remplacer avec les prénoms correctement extraits
            patientEntry.resource.name[existingOfficialIndex].given = officialName.given;
            console.log("[FRENCH_NAMES_FIX] Nom officiel existant mis à jour avec prénoms composés");
          } else {
            // Ajouter le nom officiel complet
            patientEntry.resource.name.push(officialName);
            console.log("[FRENCH_NAMES_FIX] Nom officiel ajouté à la ressource Patient");
          }
        } else {
          // Créer la liste des noms si elle n'existe pas
          patientEntry.resource.name = [officialName];
          console.log("[FRENCH_NAMES_FIX] Liste des noms créée pour la ressource Patient");
        }
      }
    }
    
    // Appliquer également à la ressource Person si elle existe
    if (personEntry && personEntry.resource) {
      console.log("[FRENCH_NAMES_FIX] Ressource Person trouvée, application des noms corrigés");
      
      // Copier les noms de la ressource Patient vers la ressource Person
      if (patientEntry && patientEntry.resource && patientEntry.resource.name) {
        personEntry.resource.name = JSON.parse(JSON.stringify(patientEntry.resource.name));
        console.log("[FRENCH_NAMES_FIX] Noms copiés de Patient vers Person");
      }
    }
    
    console.log("[FRENCH_NAMES_FIX] Correction des noms français terminée");
    return fhirBundle;
    
  } catch (error) {
    console.error("[FRENCH_NAMES_FIX] Erreur lors de la correction des noms français:", error);
    return fhirBundle;
  }
}

module.exports = {
  extractFrenchNames,
  fixFrenchNamesInFhirBundle
};