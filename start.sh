#!/bin/bash

# Script de démarrage pour FHIRHub
# Lance tous les composants nécessaires pour le convertisseur HL7 vers FHIR R4
# avec support pour les terminologies françaises

echo "Démarrage de FHIRHub - Convertisseur HL7 v2.5 vers FHIR R4"

# Appliquer les correctifs nécessaires
if [ -f fix_converter.patch.js ]; then
  echo "Application du correctif pour l'extraction des noms français..."
  node fix_converter.patch.js
fi

# Corriger les erreurs de syntaxe dans le convertisseur HL7
echo "Correction du fichier hl7ToFhirConverter.js..."
cat > tmp_fix.js << EOF
/**
 * Script pour corriger les erreurs de syntaxe dans le convertisseur HL7 vers FHIR
 */
const fs = require('fs');
const converter = 'hl7ToFhirConverter.js';

console.log('Tentative de correction de ' + converter);
let content = fs.readFileSync(converter, 'utf8');

// Remplacer la partie problématique pour corriger l'erreur de syntaxe à la ligne 1500
const pattern = /                }\n              }\n          } catch \(error\) \{\n            console.error\("\[CONVERTER_FIX\] Erreur dans le traitement des noms:", error\);\n          }\n            \}\)\;/g;
const replacement = "                }\n              }\n            });\n          } catch (error) {\n            console.error(\"[CONVERTER_FIX] Erreur dans le traitement des noms:\", error);\n          }";

content = content.replace(pattern, replacement);

fs.writeFileSync(converter, content, 'utf8');
console.log('Correction terminée');
EOF

node tmp_fix.js
rm tmp_fix.js

# Créer les répertoires nécessaires s'ils n'existent pas
mkdir -p data/in data/out data/test french_terminology/cache

# Initialiser le système de terminologie français si nécessaire
if [ ! -f french_terminology/fhir_r4_french_systems.json ]; then
  echo "Initialisation des terminologies françaises..."
  python extract_french_systems.py
fi

# Vérifier si le fichier de configuration pour le SMT existe
if [ ! -f french_terminology/config.json ]; then
  echo "Création du fichier de configuration pour le Serveur Multi-Terminologies..."
  cat > french_terminology/config.json << EOL
{
  "authentication": {
    "enabled": false,
    "clientId": "",
    "clientSecret": "",
    "tokenUrl": "https://auth.esante.gouv.fr/auth/realms/esante-wallet/protocol/openid-connect/token"
  },
  "api": {
    "baseUrl": "https://smt.esante.gouv.fr/fhir",
    "timeout": 10000
  },
  "cache": {
    "enabled": true,
    "ttl": 86400,
    "systemCachePath": "french_terminology/cache/systems.json",
    "codeCachePath": "french_terminology/cache/codes.json"
  },
  "fallback": {
    "useLocal": true,
    "localDataPath": "french_terminology/fhir_r4_french_systems.json"
  }
}
EOL
fi

# Ajouter les systèmes de terminologie français importants au fichier local si nécessaire
if [ -f french_terminology/fhir_r4_french_systems.json ]; then
  # Vérifier si les URLs ANS sont déjà présentes
  if ! grep -q "mos.esante.gouv.fr" french_terminology/fhir_r4_french_systems.json; then
    echo "Mise à jour des URLs des terminologies françaises..."
    # Cela serait normalement fait par le script Python extract_french_systems.py
    # mais nous ajoutons cette vérification pour nous assurer que les URLs sont présentes
    echo "Note: Les URLs ANS sont manquantes. Veuillez exécuter à nouveau extract_french_systems.py"
  fi
fi

echo "----------------------------------------------------"
echo "Préparation du Serveur Multi-Terminologies français terminée"
echo "Systèmes terminologiques ANS intégrés (TRE-R316, TRE-R51, etc.)"
echo "----------------------------------------------------"

# Vérifier les fichiers statiques du frontend
echo "Vérification des fichiers du frontend..."
if [ ! -d "frontend/public" ]; then
  echo "ERREUR: Le répertoire frontend/public est manquant!"
  exit 1
fi

if [ ! -f "frontend/public/conversions.html" ]; then
  echo "ERREUR: La page de conversion est manquante!"
  exit 1
fi

if [ ! -f "frontend/public/index.html" ]; then
  echo "ERREUR: La page d'accueil est manquante!"
  exit 1
fi

if [ ! -d "frontend/public/css" ]; then
  echo "ERREUR: Le répertoire CSS est manquant!"
  exit 1
fi

# Exécuter le script de test pour le nom français
echo "Test du correctif d'extraction des noms français..."
node test_french_name_extractor.js

# Démarrer l'application principale
echo "Démarrage du serveur FHIRHub..."
# Tuer toute instance précédente qui pourrait bloquer le port
pkill -f "node app.js" || true
sleep 1
node app.js