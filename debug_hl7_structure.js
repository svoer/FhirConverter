/**
 * Script de débogage pour examiner la structure des données HL7 avant conversion
 */
const hl7converter = require('./hl7ToFhirConverter');
const fs = require('fs');
const path = require('path');

// Message HL7 de test avec nom composé français
const hl7Message = `MSH|^~\\&|CEGI|CEGI|OSIRIS|OSIRIS|20240326100615||ADT^A01^ADT_A01|56468389|P|2.5|||||FRA|8859/15|FR||^^^ 
EVN||20240326100603|||SPICHER@PAUCHET.COM|20240326000000 
PID|1||442777^^^CEGI&&M^PI~~248098060602525^^^ASIP-SANTE-INS-NIR&1.2.250.1.213.1.4.8&ISO^INS^^^~1000345108^^^CEGI&&M^PIP||SECLET^^^^MME^^D~SECLET^MARYSE^MARYSE BERTHE ALICE^^^^L||19480909|F|||7 RUE DU BOUJONNIER^^FORMERIE^^60220^^H~^^^^^^BDL^^80606||^PRN^PH^^^^^^^^^0608987212~~~^NET^Internet^MARYSE.SECLET@WANADOO.FR|||||R000171104^^^CEGI&&M^AN|||||OISEMONT (80140)|||||||||VALI`;

// 1. Exposer une fonction de parsing et d'accès aux segments bruts
const originalConvertHl7ToFhir = hl7converter.convertHl7ToFhir;

// 2. Créer un wrapper pour accéder aux segments
hl7converter.parseHL7ForDebug = function(hl7Content) {
  try {
    // Remplacer la fonction convertHl7ToFhir temporairement pour capturer les données
    let capturedData = null;
    hl7converter.convertHl7ToFhir = function(content) {
      console.log('Capturing HL7 data structure...');
      // Appeler la véritable implémentation pour capturer les segments
      const result = originalConvertHl7ToFhir.call(this, content);
      
      // À ce stade, nous avons accès à la structure des données HL7 complète
      if (this._hl7data) {
        capturedData = JSON.parse(JSON.stringify(this._hl7data));
      }
      
      return result;
    };
    
    // Effectuer une conversion pour déclencher le parsing
    hl7converter.convertHl7Content(hl7Content, null, {returnOnly: true});
    
    // Restaurer la fonction originale
    hl7converter.convertHl7ToFhir = originalConvertHl7ToFhir;
    
    return capturedData;
  } catch (error) {
    console.error('Erreur lors du parsing:', error);
    return null;
  }
};

// 3. Analyser directement le message pour voir les segments bruts
console.log('Analyse directe des segments...');
const lines = hl7Message.split('\n');
const pidLine = lines.find(line => line.startsWith('PID|'));
if (pidLine) {
  console.log('Segment PID brut:', pidLine);
  const pidFields = pidLine.split('|');
  const nameField = pidFields[5]; // PID-5
  console.log('Champ nom (PID-5):', nameField);
  
  if (nameField) {
    const nameValues = nameField.split('~');
    console.log(`${nameValues.length} valeurs trouvées:`, nameValues);
    
    // Analyser chaque nom
    nameValues.forEach((nameVal, index) => {
      console.log(`\nNom #${index + 1}:`, nameVal);
      const nameParts = nameVal.split('^');
      console.log('Composants:', nameParts);
      
      // Vérifier prénom composé
      if (nameParts.length > 2 && nameParts[2]) {
        console.log('Prénoms supplémentaires trouvés:', nameParts[2]);
        const additionalNames = nameParts[2].split(' ');
        if (additionalNames.length > 1) {
          console.log('Prénoms multiples détectés:', additionalNames);
        }
      }
    });
  }
}

// 4. Accéder à la structure complète avec notre fonction
const hl7data = hl7converter.parseHL7ForDebug(hl7Message);
fs.writeFileSync('hl7_data_structure.json', JSON.stringify(hl7data, null, 2));
console.log('\nStructure complète sauvegardée dans hl7_data_structure.json');

// Fixer directement le problème avec le parseur HL7
console.log('\n✅ DEBUG TERMINÉ: Modifier le code de hl7ToFhirConverter.js en utilisant ces informations');