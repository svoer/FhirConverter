#!/bin/bash

# Script de test pour les outils de terminologie française
# Permet de vérifier la cohérence des OIDs et les fonctionnalités du service de terminologie

echo "=== OUTILS DE TEST POUR LES TERMINOLOGIES FRANÇAISES ==="
echo "Ce script permet de tester l'intégration des terminologies françaises"
echo "pour le convertisseur HL7 vers FHIR."
echo ""

# Créer les répertoires nécessaires
mkdir -p data/test
mkdir -p french_terminology

# Option 1: Vérification de cohérence des OIDs
function test_oid_consistency() {
  echo "Vérification de la cohérence des OIDs français..."
  echo ""
  node verify_french_oids.js
}

# Option 2: Tests fonctionnels des terminologies
function test_terminology_functions() {
  echo "Exécution des tests fonctionnels des terminologies françaises..."
  echo ""
  node test_french_terminology.js
}

# Option 3: Test de l'API REST
function test_rest_api() {
  echo "Test de l'API REST pour les terminologies françaises..."
  echo ""

  echo "1. Vérification de la configuration actuelle..."
  curl -s -X GET "http://localhost:5000/api/terminology/configure" -H "x-api-key: dev-key" | jq
  echo ""

  echo "2. Test de validation d'un code CCAM..."
  curl -s -X GET "http://localhost:5000/api/terminology/validate?system=https://mos.esante.gouv.fr/NOS/CCAM_2/FHIR/CCAM&code=AHQP003" -H "x-api-key: dev-key" | jq
  echo ""

  echo "3. Test de validation d'un bundle complet..."
  if [ -f data/test/test_bundle.json ]; then
    curl -s -X POST "http://localhost:5000/api/terminology/validate-bundle" -H "x-api-key: dev-key" -H "Content-Type: application/json" --data @data/test/test_bundle.json | jq
  else
    echo "Fichier test_bundle.json non trouvé. Exécutez d'abord les tests fonctionnels pour le créer."
  fi
  echo ""

  echo "4. Test de préchargement des terminologies..."
  curl -s -X GET "http://localhost:5000/api/terminology/preload" -H "x-api-key: dev-key" | jq
}

# Option 4: Lancer tous les tests
function run_all_tests() {
  test_oid_consistency
  echo ""
  test_terminology_functions
  echo ""
  test_rest_api
}

# Menu interactif
echo "Choisissez une option de test :"
echo "1) Vérifier la cohérence des OIDs"
echo "2) Exécuter les tests fonctionnels des terminologies"
echo "3) Tester l'API REST des terminologies"
echo "4) Exécuter tous les tests"
echo "q) Quitter"
echo ""
read -p "Votre choix : " choice

case $choice in
  1) test_oid_consistency ;;
  2) test_terminology_functions ;;
  3) test_rest_api ;;
  4) run_all_tests ;;
  q|Q) echo "Au revoir !" ; exit 0 ;;
  *) echo "Option invalide" ; exit 1 ;;
esac

echo ""
echo "=== TESTS TERMINÉS ==="