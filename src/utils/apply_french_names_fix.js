/**
 * Module pour appliquer automatiquement le correctif d'extraction des noms français
 * Ce script intercepte les résultats de conversion pour y appliquer le correctif
 * et est utilisé comme un middleware dans l'API
 */

const fs = require('fs');
const path = require('path');

/**
 * Extraire correctement les noms français à partir d'un segment PID HL7
 * @param {string} hl7Message - Message HL7 complet
 * @returns {Array|null} Tableau d'objets nom FHIR avec prénoms correctement extraits ou null en cas d'erreur
 */
function extractFrenchNames(hl7Message) {
  try {
    console.log("[FRENCH_NAMES_FIX] Tentative d'extraction des noms français");
    
    if (!hl7Message || typeof hl7Message !== 'string') {
      console.log("[FRENCH_NAMES_FIX] Message HL7 invalide");
      return null;
    }
    
    const lines = hl7Message.split(/[\r\n]+/);
    const pidLine = lines.find(line => line.startsWith('PID|'));
    
    if (!pidLine) {
      console.log("[FRENCH_NAMES_FIX] Segment PID non trouvé");
      return null;
    }
    
    console.log("[FRENCH_NAMES_FIX] Segment PID trouvé dans le message brut");
    const pidFields = pidLine.split('|');
    
    if (pidFields.length < 6) {
      console.log("[FRENCH_NAMES_FIX] Segment PID incomplet");
      return null;
    }
    
    const nameField = pidFields[5]; // PID-5 est à l'index 5 car les séparateurs | sont comptés
    if (!nameField) {
      console.log("[FRENCH_NAMES_FIX] Champ nom manquant");
      return null;
    }
    
    console.log(`[FRENCH_NAMES_FIX] Champ PID-5 brut: "${nameField}"`);
    
    let nameValues = [];
    if (nameField.includes('~')) {
      // Plusieurs valeurs de nom séparées par ~
      nameValues = nameField.split('~');
      console.log(`[FRENCH_NAMES_FIX] ${nameValues.length} valeurs de nom trouvées`);
    } else {
      // Une seule valeur
      nameValues = [nameField];
    }
    
    // RECHERCHE SPÉCIFIQUE DU NOM AVEC TYPE "L" (légal) QUI CONTIENT LES PRÉNOMS COMPOSÉS
    const legalNameValue = nameValues.find(val => val.includes('^') && val.includes('L'));
    
    if (!legalNameValue) {
      console.log("[FRENCH_NAMES_FIX] Nom légal non trouvé");
      return null;
    }
    
    console.log(`[FRENCH_NAMES_FIX] Nom légal trouvé: "${legalNameValue}"`);
    const parts = legalNameValue.split('^');
    
    // Récupérer les informations du nom légal
    const family = parts[0]?.trim() || '';
    const given1 = parts[1]?.trim() || '';
    const middleNames = parts[2]?.trim() || '';
    
    console.log(`[FRENCH_NAMES_FIX] Nom de famille: "${family}"`);
    console.log(`[FRENCH_NAMES_FIX] Prénom principal: "${given1}"`);
    console.log(`[FRENCH_NAMES_FIX] Prénoms composés: "${middleNames}"`);
    
    // Création de l'objet nom avec tous les prénoms extraits
    const fullNameObj = {
      family: family,
      given: [],
      use: 'official'
    };
    
    // Ajout du prénom principal
    if (given1) {
      fullNameObj.given.push(given1);
    }
    
    // Ajout des prénoms composés séparés par espaces
    if (middleNames) {
      const additionalNames = middleNames.split(' ');
      additionalNames.forEach(name => {
        if (name.trim() && !fullNameObj.given.includes(name.trim())) {
          fullNameObj.given.push(name.trim());
        }
      });
    }
    
    // Ajout du préfixe si présent
    if (parts.length > 4 && parts[4]?.trim()) {
      fullNameObj.prefix = [parts[4].trim()];
    }
    
    // Si nous avons extrait des prénoms, retourner l'objet nom
    if (fullNameObj.given.length > 0) {
      console.log(`[FRENCH_NAMES_FIX] Nom complet créé avec ${fullNameObj.given.length} prénoms:`, fullNameObj);
      return [fullNameObj];
    }
    
    return null;
  } catch (error) {
    console.error("[FRENCH_NAMES_FIX] Erreur lors de l'extraction des noms français:", error);
    return null;
  }
}

/**
 * Appliquer le correctif des noms français au résultat de conversion FHIR
 * @param {Object} conversionResult - Résultat de la conversion HL7 vers FHIR
 * @param {string} hl7Message - Message HL7 original
 * @returns {Object} Résultat de conversion avec noms corrigés
 */
function applyFrenchNamesFix(conversionResult, hl7Message) {
  try {
    console.log("[FRENCH_NAMES_FIX] Application du correctif pour noms français");
    
    // Si la conversion a échoué ou s'il n'y a pas de données FHIR, retourner le résultat tel quel
    if (!conversionResult || !conversionResult.success || !conversionResult.fhirData) {
      console.log("[FRENCH_NAMES_FIX] Conversion échouée ou pas de données FHIR");
      return conversionResult;
    }
    
    // Extraire correctement les noms français
    const frenchNames = extractFrenchNames(hl7Message);
    
    if (!frenchNames || frenchNames.length === 0) {
      console.log("[FRENCH_NAMES_FIX] Aucun nom français extrait");
      return conversionResult;
    }
    
    // Vérifier si le bundle a des entrées
    if (!conversionResult.fhirData.entry || !Array.isArray(conversionResult.fhirData.entry)) {
      console.log("[FRENCH_NAMES_FIX] Pas d'entrées dans le bundle FHIR");
      return conversionResult;
    }
    
    // Trouver l'entrée de type Patient
    const patientEntry = conversionResult.fhirData.entry.find(entry => 
      entry.resource && entry.resource.resourceType === 'Patient');
    
    if (!patientEntry || !patientEntry.resource) {
      console.log("[FRENCH_NAMES_FIX] Ressource Patient non trouvée dans le bundle");
      return conversionResult;
    }
    
    // Récupérer la ressource Patient
    const patientResource = patientEntry.resource;
    
    // Vérifier si le patient a déjà des noms
    if (!patientResource.name) {
      patientResource.name = [];
    }
    
    // Ajouter les noms français extraits au début du tableau des noms
    frenchNames.forEach(name => {
      // Vérifier si un nom identique existe déjà
      const isDuplicate = patientResource.name.some(n => 
        n.family === name.family && 
        n.use === name.use && 
        JSON.stringify(n.given) === JSON.stringify(name.given));
      
      if (!isDuplicate) {
        // Ajouter le nom en première position pour qu'il soit prioritaire
        patientResource.name.unshift(name);
        console.log("[FRENCH_NAMES_FIX] Nom français ajouté à la ressource Patient");
      } else {
        console.log("[FRENCH_NAMES_FIX] Nom français déjà présent dans la ressource Patient");
      }
    });
    
    // Mettre à jour la ressource Patient dans le bundle
    patientEntry.resource = patientResource;
    
    // Mettre à jour le résultat de conversion avec le bundle corrigé
    conversionResult.fhirData = conversionResult.fhirData;
    console.log("[FRENCH_NAMES_FIX] Correctif appliqué avec succès");
    
    return conversionResult;
  } catch (error) {
    console.error("[FRENCH_NAMES_FIX] Erreur lors de l'application du correctif:", error);
    return conversionResult; // Retourner le résultat original en cas d'erreur
  }
}

module.exports = applyFrenchNamesFix;