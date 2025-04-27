#!/bin/bash

echo "Nettoyage du projet FHIRHub..."

# On ne supprime pas les fichiers Git directement
echo "Note: Les fichiers Git ne seront pas supprimés dans cet environnement"

# Supprimer les binaires Java et fichiers de build
echo "Suppression des binaires Java et fichiers de build..."
rm -rf target
rm -rf backend/target
rm -rf */target

# Supprimer uniquement les fichiers temporaires individuels
echo "Suppression des fichiers temporaires..."
rm -f *.log
rm -f debug.log
# Ne pas supprimer les répertoires cachés de Replit

# Supprimer les fichiers liés aux tests
echo "Suppression des fichiers de test..."
rm -f test_*.js
rm -f test_*.py
rm -f *_test.js
rm -f *_test.py
rm -f minimal_test*.js
rm -f simple_hl7_test.js
rm -f test_*.sh
rm -f fix_*.js
rm -f fix_*.py
rm -f fix-*.sh

# Conserver uniquement les fichiers essentiels
echo "Conservation uniquement des fichiers essentiels..."
mkdir -p backup_core
cp api.js backup_core/
cp app.js backup_core/
cp server.js backup_core/
cp fileMonitor.js backup_core/
cp hl7ToFhirConverter.js backup_core/
cp fhir_cleaner.js backup_core/
cp french_terminology_adapter.js backup_core/
cp french_terminology_service.js backup_core/
cp french_terminology_service_offline.js backup_core/
cp package.json backup_core/
cp start.sh backup_core/
cp -r french_terminology backup_core/
cp -r frontend backup_core/
cp -r data backup_core/

# Supprimer uniquement les fichiers non-essentiels spécifiques 
# au lieu d'un nettoyage global qui pourrait affecter des fichiers système
echo "Nettoyage des fichiers non-essentiels..."
rm -f extract_french_systems.py
rm -f fix_all_syntax.js
rm -f verify_french_oids.js
rm -f mllp_service.js
rm -f minimal_test.js
rm -f server.js
rm -f hl7_parser.js
rm -f hl7_parser_bridge.js
rm -f hl7_parser_service.py
rm -f *.md
rm -f run.sh
rm -f main.sh
# Ne pas utiliser find pour supprimer car cela pourrait toucher des fichiers système

# Restaurer les fichiers essentiels
echo "Restauration des fichiers essentiels..."
cp -r backup_core/* .
rm -rf backup_core

# Conserver la structure minimale
echo "Création de la structure de répertoires minimale..."
mkdir -p data/in data/out data/uploads
mkdir -p french_terminology/cache

echo "Nettoyage terminé. Le projet est prêt à être redistribué."