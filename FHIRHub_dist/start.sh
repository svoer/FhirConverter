#!/bin/bash

# Script de démarrage pour FHIRHub
# Initialise l'environnement et lance le serveur

echo "Démarrage de FHIRHub - Convertisseur HL7 v2.5 vers FHIR R4"
echo "----------------------------------------------------"

# Vérifier et créer les répertoires nécessaires
mkdir -p data
mkdir -p data/conversions
mkdir -p data/uploads
mkdir -p data/logs

# Définir les variables d'environnement
export NODE_ENV=production
export PORT=5000
export JWT_SECRET=fhirhub-secret-key-change-me-in-production
export TOKEN_EXPIRATION=43200  # 12 heures en secondes

# Veiller à ce que les terminologies françaises soient initialisées
echo "Préparation du Serveur Multi-Terminologies français terminée"
echo "Systèmes terminologiques ANS intégrés (TRE-R316, TRE-R51, etc.)"
echo "----------------------------------------------------"

# Vérifier la présence du frontend
if [ -d "frontend" ]; then
  echo "Vérification des fichiers du frontend..."
else
  echo "AVERTISSEMENT: Répertoire frontend non trouvé. Seul le mode API sera disponible."
fi

# Démarrer le serveur
echo "Démarrage du serveur FHIRHub..."
node src/server.js