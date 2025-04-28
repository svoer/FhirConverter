#!/bin/bash

# Script de démarrage pour FHIRHub
# Lance tous les composants nécessaires pour le convertisseur HL7 vers FHIR R4
# avec support pour les terminologies françaises

echo "Démarrage de FHIRHub - Convertisseur HL7 v2.5 vers FHIR R4"

# Création des répertoires nécessaires
mkdir -p data/uploads data/conversions data/history test_data/hl7_samples test_data/fhir_results

# Déplacer les fichiers de test dans les bons répertoires
find . -name "test_*.hl7" -not -path "./test_data/*" -exec mv {} test_data/hl7_samples/ \; 2>/dev/null
find . -name "test_*.json" -not -path "./test_data/*" -exec mv {} test_data/fhir_results/ \; 2>/dev/null

# Initialisation du nouveau système de conversion
echo "Initialisation du nouveau système de conversion HL7 vers FHIR..."

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

echo "----------------------------------------------------"
echo "Préparation du Serveur Multi-Terminologies français terminée"
echo "Systèmes terminologiques ANS intégrés (TRE-R316, TRE-R51, etc.)"
echo "----------------------------------------------------"

# Vérifier les fichiers du frontend
echo "Vérification des fichiers du frontend..."

# Nettoyer l'historique pour éviter les rémanences
echo "Nettoyage de l'historique des conversions..."
node -e "try { require('./src/utils/historyFix').applyHistoryFixes(); } catch(e) { console.error('Erreur:', e.message); }"

# Exécuter le script de test pour le nom français
echo "Test du correctif d'extraction des noms français..."
node test_french_names.js

# Supprimer tous les fichiers temporaires
echo "Nettoyage des fichiers temporaires..."
find . -maxdepth 1 -type f -name "*.bak" -delete
find . -maxdepth 1 -type f -name "*.new" -delete
find . -maxdepth 1 -type f -name "*.tmp" -delete
find . -maxdepth 1 -type f -name "*.temp" -delete

# Démarrer l'application principale
echo "Démarrage du serveur FHIRHub..."
node server.js