#!/bin/bash

# Script de réinitialisation de l'environnement FHIRHub
# Ce script nettoie les fichiers temporaires, les logs et la base de données
# et remet l'application à son état initial

echo "=================================================="
echo "     Réinitialisation de l'environnement FHIRHub"
echo "=================================================="

# Vérifier que l'utilisateur est dans le bon répertoire
if [ ! -f "./app.js" ] || [ ! -d "./src" ]; then
    echo "❌ Erreur: Ce script doit être exécuté depuis le répertoire principal de FHIRHub"
    exit 1
fi

# Fonction pour assurer une confirmation de l'utilisateur
confirm() {
    echo ""
    echo "⚠️ ATTENTION: Cette opération va réinitialiser l'environnement FHIRHub"
    echo "   Les données suivantes seront effacées:"
    echo "    - Base de données (utilisateurs, workflows, configurations, etc.)"
    echo "    - Logs de l'application"
    echo "    - Fichiers temporaires et historique des conversions"
    echo "    - Fichiers de cache des terminologies"
    echo ""
    echo "   Cette action est IRRÉVERSIBLE!"
    read -p "Êtes-vous sûr de vouloir continuer? (oui/non): " response
    if [[ "$response" != "oui" ]]; then
        echo "🛑 Opération annulée."
        exit 0
    fi
}

# Si le script est appelé avec --force, pas de confirmation
if [ "$1" != "--force" ]; then
    confirm
fi

echo "🧹 Début de la réinitialisation..."

# Arrêt du serveur si en cours d'exécution
echo "1️⃣ Arrêt du serveur si en cours d'exécution..."
pkill -f "node app.js" || true
sleep 2  # Attendre que le serveur s'arrête complètement

# Sauvegarde de la base de données avant suppression
echo "2️⃣ Sauvegarde de la base de données actuelle..."
DB_PATH="./data/fhirhub.db"
BACKUP_PATH="./backups/fhirhub_backup_$(date +%Y%m%d_%H%M%S).db"
mkdir -p ./backups
if [ -f "$DB_PATH" ]; then
    cp "$DB_PATH" "$BACKUP_PATH"
    echo "   ✅ Base de données sauvegardée dans $BACKUP_PATH"
else
    echo "   ℹ️ Aucune base de données existante à sauvegarder"
fi

# Suppression des fichiers de la base de données
echo "3️⃣ Suppression de la base de données..."
rm -f "$DB_PATH"
echo "   ✅ Base de données supprimée"

# Suppression des logs
echo "4️⃣ Nettoyage des logs..."
find ./logs -type f -name "*.log" -delete
echo "   ✅ Logs nettoyés"

# Nettoyage des fichiers temporaires et historiques
echo "5️⃣ Nettoyage des fichiers temporaires et historiques..."
rm -rf ./data/conversions/*
rm -rf ./data/history/*
rm -rf ./data/outputs/*
rm -rf ./data/test/*
rm -rf ./temp/*
echo "   ✅ Fichiers temporaires et historiques nettoyés"

# Nettoyage du cache des terminologies
echo "6️⃣ Nettoyage du cache des terminologies françaises..."
rm -rf ./french_terminology/cache/*
echo "   ✅ Cache des terminologies nettoyé"

# Création de la structure de dossiers nécessaire
echo "7️⃣ Recréation de la structure des dossiers..."
mkdir -p ./data/conversions
mkdir -p ./data/history
mkdir -p ./data/outputs
mkdir -p ./data/test
mkdir -p ./logs
mkdir -p ./temp
mkdir -p ./french_terminology/cache
echo "   ✅ Structure des dossiers recréée"

# Recréation de la base de données en utilisant le script d'initialisation
echo "8️⃣ Recréation de la base de données..."

# Déterminer le chemin Node.js à utiliser (local ou système)
if [ -f "./.nodejsrc" ]; then
    source ./.nodejsrc
    if [ "$USE_LOCAL_NODEJS" = "1" ] && [ -n "$NODE_PATH" ]; then
        NODE_CMD="${NODE_PATH}/node"
    else
        NODE_CMD="node"
    fi
else
    NODE_CMD="node"
fi

# Créer un script temporaire pour initialiser la base de données
cat > ./init-db.js << 'EOL'
const dbService = require('./src/services/dbService');
const schema = require('./src/db/schema');

async function initializeDatabase() {
  console.log("[DB] Démarrage de l'initialisation de la base de données...");
  
  try {
    // Créer toutes les tables définies dans le schéma
    for (const table of schema.ALL_SCHEMAS) {
      console.log(`[DB] Création de la table ${table.tableName}...`);
      await dbService.createTable(table.tableName, table.columns);
    }
    
    // Créer l'utilisateur admin par défaut
    console.log("[DB] Création de l'utilisateur admin par défaut...");
    await dbService.query(
      'INSERT INTO users (username, password, role, email) VALUES (?, ?, ?, ?)',
      ['admin', '$2b$10$PeXcZgN6w9SYJ0CsVr3zxeVGoSGgvDIGQWIWjJQBkeVKdQ0.CH95W', 'admin', 'admin@example.com']
    );
    
    // Créer l'application par défaut
    console.log("[DB] Création de l'application par défaut...");
    await dbService.query(
      'INSERT INTO applications (name, description) VALUES (?, ?)',
      ['Default', 'Application par défaut pour le développement']
    );
    
    // Créer la clé API de développement
    console.log("[DB] Création de la clé API de développement...");
    await dbService.query(
      'INSERT INTO api_keys (application_id, key, name, environment) VALUES ((SELECT id FROM applications WHERE name = "Default"), ?, ?, ?)',
      ['dev-key', 'Clé de développement', 'development']
    );
    
    console.log("[DB] Initialisation de la base de données terminée avec succès!");
  } catch (error) {
    console.error("[DB] Erreur lors de l'initialisation de la base de données:", error);
    process.exit(1);
  }
  
  process.exit(0);
}

initializeDatabase();
EOL

# Exécuter le script avec Node.js
"$NODE_CMD" init-db.js

# Vérifier si l'initialisation a réussi
if [ $? -ne 0 ]; then
  echo "❌ Erreur lors de l'initialisation de la base de données. Vérifiez les logs pour plus de détails."
else
  echo "   ✅ Base de données initialisée avec succès"
  # Supprimer le script temporaire
  rm -f ./init-db.js
fi

echo "=================================================="
echo "     ✅ Réinitialisation terminée avec succès"
echo "=================================================="
echo ""
echo "Pour démarrer l'application :"
echo "  ./start.sh"
echo ""
echo "Identifiants par défaut :"
echo "  Utilisateur : admin"
echo "  Mot de passe : adminfhirhub"
echo ""
echo "Clé API de test : dev-key"
echo "=================================================="