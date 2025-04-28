/**
 * Script de débogage spécifique pour l'extraction des noms français
 * Ce script isole le code de traitement des noms pour l'analyser précisément
 */

const fs = require('fs');

// Message HL7 de test avec nom composé français
const hl7Message = `MSH|^~\\&|CEGI|CEGI|OSIRIS|OSIRIS|20240326100615||ADT^A01^ADT_A01|56468389|P|2.5|||||FRA|8859/15|FR||^^^ 
EVN||20240326100603|||SPICHER@PAUCHET.COM|20240326000000 
PID|1||442777^^^CEGI&&M^PI~~248098060602525^^^ASIP-SANTE-INS-NIR&1.2.250.1.213.1.4.8&ISO^INS^^^~1000345108^^^CEGI&&M^PIP||SECLET^^^^MME^^D~SECLET^MARYSE^MARYSE BERTHE ALICE^^^^L||19480909|F|||7 RUE DU BOUJONNIER^^FORMERIE^^60220^^H~^^^^^^BDL^^80606||^PRN^PH^^^^^^^^^0608987212~~~^NET^Internet^MARYSE.SECLET@WANADOO.FR|||||R000171104^^^CEGI&&M^AN|||||OISEMONT (80140)|||||||||VALI`;

// Simuler le processus de parsing utilisé par le convertisseur
function parseHL7MessageSegment(message) {
  console.log("Parsing du message HL7 pour extraction des segments");
  
  // Structure des données pour simuler hl7Data, utilisé dans le convertisseur
  const hl7Data = {
    segments: [],
    PID: {
      patientName: {
        family: 'SECLET',
        prefix: 'MME'
      }
    }
  };
  
  const lines = message.split('\n');
  
  // Parcourir chaque ligne pour extraire les segments
  for (const line of lines) {
    // Vérifier que la ligne n'est pas vide
    if (!line.trim()) continue;
    
    // Extraire le nom du segment (les 3 premiers caractères)
    const segmentName = line.substring(0, 3);
    
    // Séparer les champs
    const fields = line.split('|');
    
    // Créer un objet pour représenter ce segment avec ses champs
    const segment = {
      name: segmentName,
      fields: []
    };
    
    // Ajouter chaque champ avec sa position
    for (let i = 0; i < fields.length; i++) {
      segment.fields.push({
        position: i, // Position basée sur 0 ici, mais le convertisseur utilise souvent des positions basées sur 1
        value: fields[i]
      });
    }
    
    // Ajouter le segment à la liste
    hl7Data.segments.push(segment);
  }
  
  return hl7Data;
}

// Fonction d'extraction des noms inspirée du correctif
function extractPatientNames(hl7Data) {
  console.log("Extraction des noms du patient");
  const patientNames = [];
  
  // Première approche: utiliser les données du parseur si disponibles
  if (hl7Data.PID && hl7Data.PID.patientName) {
    const nameObj = {
      family: hl7Data.PID.patientName.family || '',
      given: [],
      use: 'official'
    };
    
    // Ajouter le préfixe s'il existe
    if (hl7Data.PID.patientName.prefix && hl7Data.PID.patientName.prefix.trim() !== '') {
      nameObj.prefix = [hl7Data.PID.patientName.prefix.trim()];
    }
    
    patientNames.push(nameObj);
    console.log("Nom ajouté depuis les données parsées:", JSON.stringify(nameObj));
  }
  
  // Deuxième approche: analyse directe du segment PID-5
  console.log("Recherche du segment PID...");
  const pidSegments = hl7Data.segments.filter(s => s.name === 'PID');
  
  if (pidSegments.length === 0) {
    console.log("Aucun segment PID trouvé!");
    return patientNames;
  }
  
  console.log("Segment PID trouvé, recherche du champ PID-5...");
  const pidSegment = pidSegments[0];
  
  // PID-5 est à la position 5 (index 4 + 1, car les positions sont 1-based dans HL7)
  // Mais nos objets de segment ont des positions 0-based pour les champs
  const pid5Field = pidSegment.fields.find(f => f.position === 5);
  
  if (!pid5Field || !pid5Field.value) {
    console.log("Champ PID-5 introuvable ou vide:", pid5Field);
    return patientNames;
  }
  
  console.log("Champ PID-5 trouvé:", pid5Field.value);
  
  // Vérifier si le champ contient des répétitions (séparées par ~)
  if (pid5Field.value.includes('~')) {
    console.log("Détection de noms multiples séparés par ~");
    
    // Traiter les répétitions
    const nameValues = pid5Field.value.split('~');
    console.log("Valeurs de noms trouvées:", nameValues);
    
    // Pour chaque valeur de nom
    nameValues.forEach((nameVal, index) => {
      console.log(`Traitement du nom #${index + 1}:`, nameVal);
      
      // Séparer les composants du nom
      const parts = nameVal.split('^');
      console.log("Composants du nom:", parts);
      
      // Vérifier que nous avons au moins un nom de famille
      if (parts.length > 0 && parts[0].trim() !== '') {
        // Déterminer l'usage du nom
        let nameUse = 'official';
        if (parts.length > 6) {
          switch (parts[6]) {
            case 'L': nameUse = 'official'; break;
            case 'D': nameUse = 'usual'; break;
            case 'M': nameUse = 'maiden'; break;
            case 'N': nameUse = 'nickname'; break;
            default: nameUse = 'official';
          }
        }
        
        console.log("Type d'usage déterminé:", nameUse);
        
        // Créer l'objet nom
        const nameObj = {
          family: parts[0].trim(),
          given: [],
          use: nameUse
        };
        
        // Ajouter le prénom principal (position 1)
        if (parts.length > 1 && parts[1].trim() !== '') {
          nameObj.given.push(parts[1].trim());
          console.log("Prénom principal ajouté:", parts[1].trim());
        }
        
        // Ajouter les prénoms supplémentaires (position 2)
        if (parts.length > 2 && parts[2].trim() !== '') {
          // Diviser les prénoms multiples par espace
          const additionalNames = parts[2].trim().split(' ');
          console.log("Prénoms supplémentaires trouvés:", additionalNames);
          
          additionalNames.forEach(name => {
            if (name.trim() !== '' && !nameObj.given.includes(name.trim())) {
              nameObj.given.push(name.trim());
              console.log("Prénom supplémentaire ajouté:", name.trim());
            }
          });
        }
        
        // Ajouter le préfixe (position 4)
        if (parts.length > 4 && parts[4].trim() !== '') {
          nameObj.prefix = [parts[4].trim()];
          console.log("Préfixe ajouté:", parts[4].trim());
        }
        
        console.log("Nom complet créé:", JSON.stringify(nameObj));
        
        // Vérifier si ce nom est une amélioration d'un nom existant
        const existingIndex = patientNames.findIndex(n => 
          n.family === nameObj.family && n.use === nameObj.use);
        
        if (existingIndex >= 0) {
          console.log("Nom similaire trouvé à l'index", existingIndex);
          
          // Si le nom existant a moins de prénoms, le remplacer
          const existing = patientNames[existingIndex];
          if (!existing.given || existing.given.length < nameObj.given.length) {
            console.log("Remplacement du nom existant par un nom plus complet");
            patientNames[existingIndex] = nameObj;
          } else {
            console.log("Conservation du nom existant qui est plus complet");
          }
        } else {
          // Sinon, ajouter ce nom à la liste
          console.log("Ajout d'un nouveau nom à la liste");
          patientNames.push(nameObj);
        }
      } else {
        console.log("Composants de nom invalides, ignorés");
      }
    });
  } else {
    console.log("Aucune répétition trouvée dans le champ PID-5");
  }
  
  console.log("Liste finale des noms:", JSON.stringify(patientNames, null, 2));
  return patientNames;
}

// Tester l'extraction
console.log("=== Test d'extraction des noms français ===");
const hl7Data = parseHL7MessageSegment(hl7Message);
const extractedNames = extractPatientNames(hl7Data);

console.log("\n=== Résultats de l'extraction ===");
console.log(JSON.stringify(extractedNames, null, 2));

if (extractedNames.length > 0 && 
    extractedNames.some(name => name.given && name.given.includes('MARYSE'))) {
  console.log("\n✅ Extraction réussie des prénoms multiples!");
} else {
  console.log("\n❌ Échec de l'extraction des prénoms multiples!");
  console.log("Vérifiez les erreurs dans les journaux ci-dessus");
}