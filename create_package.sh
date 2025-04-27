#!/bin/bash

echo "Création du package FHIRHub..."

# Nettoyer d'abord le projet en évitant les restrictions
echo "Application du script de nettoyage..."
./clean_project.sh

# Ignorer les erreurs du script précédent
set -e

# Créer un dossier temporaire pour le package
PACKAGE_DIR="FHIRHub_$(date +%Y%m%d)"
mkdir -p $PACKAGE_DIR

# Copier les fichiers essentiels
echo "Copie des fichiers essentiels..."
cp -r api.js app.js server.js fileMonitor.js hl7ToFhirConverter.js fhir_cleaner.js $PACKAGE_DIR/
cp -r french_terminology_adapter.js french_terminology_service.js french_terminology_service_offline.js $PACKAGE_DIR/
cp -r package.json start.sh LISEZMOI.md $PACKAGE_DIR/
cp -r french_terminology $PACKAGE_DIR/
cp -r frontend $PACKAGE_DIR/
mkdir -p $PACKAGE_DIR/data/in $PACKAGE_DIR/data/out $PACKAGE_DIR/data/uploads

# Créer un exemple de fichier HL7
echo "Création d'un exemple HL7..."
cat > $PACKAGE_DIR/exemple.hl7 << EOL
MSH|^~\\&|SENDING_APPLICATION|SENDING_FACILITY|RECEIVING_APPLICATION|RECEIVING_FACILITY|20230427153203||ADT^A01|20230427153203|P|2.5.1|||||FRA|8859/15
EVN|A01|20230427153203|||admin^Dupont^Jean^Dr^^MD|20230427153203
PID|1||123456789^^^HOPITAL^PI||MARTIN^JEAN^ANDRÉ^^M.||19800101|M|||2 RUE DE LA PAIX^^PARIS^^75001^FRA^H||+33 1 23 45 67 89^PRN^PH||FR|M|CAT|111222333^^^SS^SS~INS-C 1 80 01 75 111 22^^^^^AN||||||||||N
PV1|1|I|CHIRURGIE^101^1|1|||456789^MARTIN^SOPHIE^L^^DR|123456^DUPONT^PIERRE^J^^DR|98765^JOUBERT^MARIE^^^DR|MED||||2|||||20230427||||||||||||||||||||||||||20230427153203
OBX|1|NM|8480-6^Pression artérielle systolique^LN||120|mm[Hg]|90-120|N|||F
OBX|2|NM|8462-4^Pression artérielle diastolique^LN||80|mm[Hg]|60-80|N|||F
OBX|3|NM|8310-5^Température corporelle^LN||37.1|Cel|36-38|N|||F
EOL

# Créer un README pour l'utilisation
echo "Création du guide d'utilisation rapide..."
cat > $PACKAGE_DIR/UTILISATION.txt << EOL
Guide d'utilisation rapide de FHIRHub
=====================================

1. Installation des dépendances :
   npm install

2. Démarrage de l'application :
   ./start.sh

3. Accès à l'interface :
   http://localhost:5000

4. Identifiants par défaut :
   - Admin : admin / adminfhirhub
   - Utilisateur : user / userfhirhub

5. Pour une conversion rapide :
   - Allez sur la page "Conversions"
   - Utilisez le bouton d'exemple ou collez votre message HL7
   - Cliquez sur "Convertir"

6. Utilisation de l'API :
   curl -X POST -H "Content-Type: text/plain" -H "x-api-key: dev-key" -d @exemple.hl7 http://localhost:5000/api/convert
EOL

# Créer l'archive
echo "Création de l'archive..."
zip -r "${PACKAGE_DIR}.zip" $PACKAGE_DIR

# Nettoyage
echo "Nettoyage..."
rm -rf $PACKAGE_DIR

echo "Package créé avec succès : ${PACKAGE_DIR}.zip"
echo "Vous pouvez maintenant distribuer cette archive."