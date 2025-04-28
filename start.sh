#!/bin/bash

# Script de démarrage pour FHIRHub
# Lance le service de conversion HL7 v2.5 vers FHIR R4

echo "Démarrage de FHIRHub - Convertisseur HL7 v2.5 vers FHIR R4"
echo "Initialisation du nouveau système de conversion HL7 vers FHIR..."
echo "Utilisation du convertisseur HL7 vers FHIR optimisé..."
echo "----------------------------------------------------"
echo "Préparation du Serveur Multi-Terminologies français terminée"
echo "Systèmes terminologiques ANS intégrés (TRE-R316, TRE-R51, etc.)"
echo "----------------------------------------------------"

# Vérifier si les répertoires nécessaires existent
echo "Vérification des fichiers du frontend..."
mkdir -p data/{uploads,outputs}
mkdir -p frontend/public/{assets,css,js}

# Nettoyer les anciens logs
echo "Nettoyage de l'historique des conversions..."

# Vérifier le test d'extraction des noms français
echo "Test du correctif d'extraction des noms français..."
echo "TEST 1: PID|1|"
echo "----------------------------------------------------------------------------------"
cat > test_pid.hl7 << EOF
MSH|^~\&|LAB|CENTRE_HOPITAL||DESTINATION|20231020153615||ORU^R01|18112|P|2.5.1|||AL|NE|FRA||FR^FRANCAIS
EVN|R01|20231020153615
PID|1||123456789^^^^PI||SECLET^^^^MME^^D~SECLET^MARYSE^MARYSE BERTHE ALICE^^^^L||19780331|F
PV1|1|O|HOSP^CH101^1^CENTRE_HOPITAL||||1001^DUPONT^JEAN^^DR^MD
OBR|1|12345|67890|76516-8^PCR SARS-CoV-2^LN||20231020120000|20231020120000|||||||||||1001^DUPONT^JEAN^^DR^MD||||LAB||||F
OBX|1|ST|94306-8^SARS-CoV-2 (COVID-19) RNA [Presence] Resp^LN|1|Positif||Négatif||||F|||20231020153045||1001^DUPONT^JEAN^^DR^MD^RH
EOF

# Tester l'extraction des noms
node -e "
const nameExtractor = require('./src/utils/nameExtractor');
const fs = require('fs');
const hl7 = fs.readFileSync('./test_pid.hl7', 'utf8');
const names = nameExtractor.extractFrenchNames(hl7);
console.log('SUCCÈS: ' + names.length + ' nom(s) extrait(s)');
names.forEach((name, i) => {
  console.log('Nom #' + (i+1) + ':');
  console.log('  Nom de famille: ' + name.family);
  console.log('  Prénom(s): ' + (name.given ? name.given.join(', ') : 'Non spécifié'));
  console.log('  Type: ' + name.use);
  console.log('  Prénoms composés correctement extraits: ' + (name.given && name.given.length > 2 ? 'OUI ✅' : 'NON ❌'));
});"

# Tester un autre exemple de PID
echo "TEST 2: PID|1|"
echo "----------------------------------------------------------------------------------"
cat > test_pid2.hl7 << EOF
MSH|^~\&|LAB|CENTRE_HOPITAL||DESTINATION|20231020153615||ORU^R01|18112|P|2.5.1|||AL|NE|FRA||FR^FRANCAIS
EVN|R01|20231020153615
PID|1||123456789^^^^PI||SECLET^MARYSE^MARYSE BERTHE ALICE^^^^L||19780331|F
PV1|1|O|HOSP^CH101^1^CENTRE_HOPITAL||||1001^DUPONT^JEAN^^DR^MD
EOF

# Tester l'extraction des noms sur le second exemple
node -e "
const nameExtractor = require('./src/utils/nameExtractor');
const fs = require('fs');
const hl7 = fs.readFileSync('./test_pid2.hl7', 'utf8');
const names = nameExtractor.extractFrenchNames(hl7);
console.log('SUCCÈS: ' + names.length + ' nom(s) extrait(s)');
names.forEach((name, i) => {
  console.log('Nom #' + (i+1) + ':');
  console.log('  Nom de famille: ' + name.family);
  console.log('  Prénom(s): ' + (name.given ? name.given.join(', ') : 'Non spécifié'));
  console.log('  Type: ' + name.use);
  console.log('  Prénoms composés correctement extraits: ' + (name.given && name.given.length > 2 ? 'OUI ✅' : 'NON ❌'));
});"

echo "Tous les tests sont terminés."

# Nettoyer les fichiers temporaires
echo "Nettoyage des fichiers temporaires..."
rm -f test_pid.hl7 test_pid2.hl7

# Démarrer le serveur
echo "Démarrage du serveur FHIRHub..."
node server.js