#!/bin/bash

echo "Préparation du package de distribution FHIRHub..."

# Créer un dossier pour le package
PACKAGE_DIR="FHIRHub_dist"
mkdir -p $PACKAGE_DIR

# Copier les fichiers essentiels
echo "Copie des fichiers essentiels..."
cp api.js $PACKAGE_DIR/
cp app.js $PACKAGE_DIR/
cp fileMonitor.js $PACKAGE_DIR/
cp hl7ToFhirConverter.js $PACKAGE_DIR/
cp fhir_cleaner.js $PACKAGE_DIR/
cp french_terminology_adapter.js $PACKAGE_DIR/
cp french_terminology_service.js $PACKAGE_DIR/
cp french_terminology_service_offline.js $PACKAGE_DIR/
cp package.json $PACKAGE_DIR/
cp start.sh $PACKAGE_DIR/
cp LISEZMOI.md $PACKAGE_DIR/

# Copier les répertoires nécessaires
mkdir -p $PACKAGE_DIR/french_terminology
cp -r french_terminology/fhir_r4_french_systems.json $PACKAGE_DIR/french_terminology/
mkdir -p $PACKAGE_DIR/french_terminology/cache

mkdir -p $PACKAGE_DIR/frontend/public
cp -r frontend/public/conversions.html $PACKAGE_DIR/frontend/public/
cp -r frontend/public/index.html $PACKAGE_DIR/frontend/public/
cp -r frontend/public/dashboard.html $PACKAGE_DIR/frontend/public/
mkdir -p $PACKAGE_DIR/frontend/public/css
cp -r frontend/public/css/styles.css $PACKAGE_DIR/frontend/public/css/

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

# Créer un exemple avancé
cat > $PACKAGE_DIR/exemple_avance.hl7 << EOL
MSH|^~\\&|1.2.250.1.211.7.1.200.1.2|MCK|EAI|EAI|20250417050534||ADT^A01^ADT_A01|131822802|P|2.5^FRA^2.5|50926931||||FRA|8859/1|||A01^IPG~ADD_ENTREE_HOPITAL^INTEG
EVN||20250417050503|||MAURICEM
PID|||1174024^^^MCK&1.2.250.1.211.10.200.1&ISO^PI~1121717802492545833548^^^ASIP-SANTE-INS-C&1.2.250.1.213.1.4.2&ISO^INS-C^^20170215~160059932710027^^^ASIP-SANTE-INS-NIR&1.2.250.1.213.1.4.8&ISO^INS||YEHOUESSI^HERMAS JEAN RICHARD^HERMAS JEAN RICHARD^^^^L||19600509000000|M|||8  AVENUE CONDORCET^^FORT DE FRANCE^^97200^FRA^H~^^^^^UNK^C~^^PORTO NUEVO^^99327^BEN^BDL^^99327||0696039637^PRN^PH~0596000093^PRN^PH~0696039637^PRN^CP|||M||562102580^^^MCK|||||PORTO NUEVO|||FRA||||N||VALI
PD1||||||||||||N
ROL||UC|ODRP|971219175^MERAUT SALOMON^RENEE^^^^^^^ADELI&2.16.840.1.113883.3.31.2.2&ISO^^^ADELI~1238140^MERAUT SALOMON^RENEE^^^^^^^MCK&1.2.250.1.211.12.1.1&ISO^^^EI|||||||8    AVECONDORCET^^^^97200^UNK^H~8    AVECONDORCET^^FORT DE FRANCE^^97200^UNK^H^^^^^EDI
NK1|1|YEHOUESSI^ELENA|OTH^^IHE^SPO^FEMME^MCK|^^^^^UNK^H~^^^^^UNK^H^^^^^EDI|||C||||||||||||||||||||||||||1150225
PV1||I||||||||||||85||N|||562102580^^^MCK&1.2.250.1.211.12.1.1&ISO^AN|C|03|N|||||||||||||||||||N|||20250417050400
ZBE|EH_11549556_1^MCK|20250417050400||INSERT|N||^^^^^^UF^^SI7771^7771|^^^^^^UF^^^66a3a0c6a3b34a9cd702949d|M
ZFP| | 
ZFV| 
ZFM|8||5
IN1|1|972|||||||||||20251231|||YEHOUESSI^HERMAS JEAN RICHARD|||||||||||||||||||||||||||||||||160059932710027
IN2||||||||||||||||||||||||||||^C
EOL

# Créer un guide d'utilisation
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

echo "Le package de distribution est prêt dans le répertoire: $PACKAGE_DIR"
echo "Vous pouvez créer une archive en utilisant la commande:"
echo "zip -r FHIRHub_dist.zip $PACKAGE_DIR"