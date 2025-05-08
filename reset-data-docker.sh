#!/bin/bash

# Script de réinitialisation des statistiques et des données de conversion pour Docker
# Ce script vide les volumes Docker contenant les résultats de conversion et réinitialise les statistiques dans la base de données

# Couleurs pour les messages
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Variable pour auto-confirmer toutes les actions
AUTO_CONFIRM=false

# Vérifier si l'option -y est utilisée
if [[ "$1" == "-y" ]]; then
    AUTO_CONFIRM=true
fi

# Fonction pour afficher un message de confirmation et demander à l'utilisateur de confirmer
confirm() {
    if [ "$AUTO_CONFIRM" = true ]; then
        return 0
    fi
    
    read -p "$(echo -e "${YELLOW}$1 [y/N] ${NC}")" response
    case "$response" in
        [yY][eE][sS]|[yY]) 
            return 0
            ;;
        *)
            return 1
            ;;
    esac
}

# Vérifier si Docker est installé
if ! command -v docker &> /dev/null; then
    echo -e "${RED}Erreur: Docker n'est pas installé. Ce script est conçu pour les installations Docker.${NC}"
    exit 1
fi

# Vérifier si docker-compose est installé
if ! command -v docker-compose &> /dev/null; then
    echo -e "${RED}Erreur: docker-compose n'est pas installé. Ce script est conçu pour les installations Docker.${NC}"
    exit 1
fi

echo -e "${BLUE}=== Script de réinitialisation des données FHIRHub (Docker) ===${NC}"
echo -e "${YELLOW}ATTENTION: Ce script va supprimer toutes les données de conversion et réinitialiser les statistiques.${NC}"
echo -e "${YELLOW}Cette action est irréversible. Assurez-vous d'avoir sauvegardé toutes les données importantes.${NC}"
echo ""

# Demander confirmation avant de poursuivre
if ! confirm "Êtes-vous sûr de vouloir réinitialiser toutes les données de conversion et les statistiques?"; then
    echo -e "${BLUE}Opération annulée.${NC}"
    exit 0
fi

# Vérifier si les conteneurs Docker sont en cours d'exécution
if ! docker ps | grep -q "fhirhub"; then
    echo -e "${YELLOW}Aucun conteneur FHIRHub en cours d'exécution détecté.${NC}"
    if ! confirm "Voulez-vous continuer quand même?"; then
        echo -e "${BLUE}Opération annulée.${NC}"
        exit 0
    fi
fi

echo -e "\n${BLUE}=== Nettoyage des volumes Docker ===${NC}"

# Trouver le conteneur FHIRHub
CONTAINER_ID=$(docker ps -a --filter name=fhirhub --format "{{.ID}}")

if [ -z "$CONTAINER_ID" ]; then
    echo -e "${YELLOW}Aucun conteneur FHIRHub trouvé. Vérification des volumes directement...${NC}"
    
    # Vérifier les volumes Docker nommés
    if docker volume ls | grep -q "fhirhub"; then
        echo -e "${GREEN}Volumes FHIRHub trouvés${NC}"
    else
        echo -e "${RED}Aucun volume FHIRHub trouvé. Impossible de continuer.${NC}"
        exit 1
    fi
else
    echo -e "${GREEN}Conteneur FHIRHub trouvé: $CONTAINER_ID${NC}"
fi

# Réinitialisation de la base de données via SQLite dans le conteneur
echo -e "\n${BLUE}=== Réinitialisation de la base de données ===${NC}"

# Créer un script SQL temporaire
TMP_SQL_FILE=$(mktemp)
cat > "$TMP_SQL_FILE" << EOF
DELETE FROM conversion_logs;
DELETE FROM api_activity_logs;
DELETE FROM system_logs WHERE event_type = 'conversion';
UPDATE api_usage_limits SET current_daily_usage = 0, current_monthly_usage = 0;
VACUUM;
EOF

# Exécuter le script SQL à l'intérieur du conteneur
if [ -n "$CONTAINER_ID" ]; then
    # Copier le script SQL dans le conteneur
    docker cp "$TMP_SQL_FILE" "$CONTAINER_ID:/tmp/reset.sql"
    
    # Exécuter le script SQL
    docker exec "$CONTAINER_ID" sqlite3 /app/storage/db/fhirhub.db < /tmp/reset.sql
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ Tables de la base de données réinitialisées avec succès${NC}"
    else
        echo -e "${RED}Erreur lors de la réinitialisation des tables de la base de données${NC}"
    fi
    
    # Vider les dossiers de conversion
    echo -e "\n${BLUE}=== Nettoyage des dossiers de conversion ===${NC}"
    docker exec "$CONTAINER_ID" sh -c "find /app/data/conversions -type f -not -path '*/\.*' -delete"
    docker exec "$CONTAINER_ID" sh -c "find /app/data/history -type f -not -path '*/\.*' -delete"
    docker exec "$CONTAINER_ID" sh -c "find /app/data/outputs -type f -not -path '*/\.*' -delete"
    
    echo -e "${GREEN}✓ Dossiers de conversion nettoyés avec succès${NC}"
else
    echo -e "${YELLOW}Impossible d'exécuter des commandes dans le conteneur.${NC}"
    echo -e "${YELLOW}Les volumes ont été nettoyés, mais la base de données n'a pas été réinitialisée.${NC}"
    echo -e "${YELLOW}Redémarrez les conteneurs avec docker-compose pour finaliser la réinitialisation.${NC}"
fi

# Supprimer le fichier SQL temporaire
rm "$TMP_SQL_FILE"

echo -e "\n${BLUE}=== Réinitialisation terminée ===${NC}"
echo -e "${GREEN}Toutes les données de conversion et statistiques ont été réinitialisées avec succès.${NC}"

# Suggérer un redémarrage si le conteneur est en cours d'exécution
if [ -n "$CONTAINER_ID" ]; then
    echo -e "\n${YELLOW}Pour que les changements soient entièrement pris en compte,${NC}"
    echo -e "${YELLOW}il est recommandé de redémarrer les conteneurs.${NC}"
    
    if confirm "Voulez-vous redémarrer les conteneurs maintenant?"; then
        echo "Redémarrage des conteneurs..."
        if [ -f "docker-compose.yml" ]; then
            docker-compose restart
        elif [ -f "docker-compose-minimal.yml" ]; then
            docker-compose -f docker-compose-minimal.yml restart
        else
            docker restart "$CONTAINER_ID"
        fi
        echo -e "${GREEN}✓ Conteneurs FHIRHub redémarrés${NC}"
    fi
fi

exit 0