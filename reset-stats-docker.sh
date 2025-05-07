#!/bin/bash

# Script pour réinitialiser directement les statistiques de FHIRHub dans Docker
# Contourne l'interface web pour éviter les problèmes de réinitialisation

# Couleurs pour les messages
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== Réinitialisation des statistiques FHIRHub (Docker) ===${NC}"

# Vérification si Docker est en cours d'exécution
if ! docker ps > /dev/null 2>&1; then
  echo -e "${RED}Erreur: Docker n'est pas en cours d'exécution. Veuillez démarrer Docker.${NC}"
  exit 1
fi

# Vérification si le conteneur FHIRHub est en cours d'exécution
if ! docker ps | grep -q fhirhub; then
  echo -e "${RED}Erreur: Conteneur FHIRHub non trouvé. Veuillez démarrer les conteneurs.${NC}"
  exit 1
fi

echo -e "${YELLOW}Réinitialisation des statistiques directement dans la base de données SQLite...${NC}"

# Exécuter les commandes SQL pour réinitialiser les statistiques
docker exec fhirhub bash -c "
sqlite3 /app/storage/db/fhirhub.db << 'EOF'
-- Réinitialiser les logs de conversion
DELETE FROM conversion_logs;

-- Réinitialiser les compteurs d'utilisation des API
UPDATE api_usage_limits SET current_daily_usage = 0, current_monthly_usage = 0;

-- Réinitialiser les compteurs des fournisseurs d'IA
UPDATE ai_providers SET usage_count = 0, current_usage = 0;

-- Réinitialiser les compteurs de workflows si la table existe
UPDATE workflows SET conversions_count = 0 WHERE EXISTS (SELECT 1 FROM pragma_table_info('workflows') WHERE name = 'conversions_count');

-- Ajouter un log système pour cette opération
INSERT INTO system_logs (event_type, message, severity) 
VALUES ('RESET_STATS', 'Réinitialisation manuelle des statistiques effectuée via script', 'INFO');
EOF
"

# Vérifier si la commande a réussi
if [ $? -eq 0 ]; then
  echo -e "${GREEN}✓ Statistiques réinitialisées avec succès${NC}"
else
  echo -e "${RED}× Échec de la réinitialisation des statistiques${NC}"
  exit 1
fi

echo -e "${YELLOW}Redémarrage du conteneur FHIRHub pour appliquer les changements...${NC}"
docker restart fhirhub

echo -e "${GREEN}Réinitialisation terminée !${NC}"
echo -e "${BLUE}Note: Si les statistiques ne sont toujours pas correctes dans l'interface,${NC}"
echo -e "${BLUE}      exécutez le script fix-docker-permissions.sh pour corriger les permissions.${NC}"