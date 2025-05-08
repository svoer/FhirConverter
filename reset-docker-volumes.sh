#!/bin/bash

# Script de réinitialisation des volumes Docker pour FHIRHub
# Ce script nettoie les volumes Docker nommés contenant les données de conversion et les statistiques

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

echo -e "${BLUE}=== Script de réinitialisation des volumes Docker FHIRHub ===${NC}"
echo -e "${YELLOW}ATTENTION: Ce script va supprimer toutes les données des volumes Docker FHIRHub.${NC}"
echo -e "${YELLOW}Cette action est irréversible et nécessite un redémarrage des conteneurs.${NC}"
echo ""

# Demander confirmation avant de poursuivre
if ! confirm "Êtes-vous sûr de vouloir réinitialiser tous les volumes Docker FHIRHub?"; then
    echo -e "${BLUE}Opération annulée.${NC}"
    exit 0
fi

# Arrêter les conteneurs s'ils sont en cours d'exécution
echo -e "\n${BLUE}=== Vérification et arrêt des conteneurs Docker en cours d'exécution ===${NC}"
if docker ps -q --filter "name=fhirhub" | grep -q .; then
    echo -e "${YELLOW}Des conteneurs FHIRHub sont en cours d'exécution. Ils doivent être arrêtés pour continuer.${NC}"
    
    if ! confirm "Voulez-vous arrêter les conteneurs FHIRHub en cours d'exécution?"; then
        echo -e "${BLUE}Opération annulée.${NC}"
        exit 0
    fi
    
    echo "Arrêt des conteneurs FHIRHub..."
    docker stop $(docker ps -q --filter "name=fhirhub")
    echo -e "${GREEN}✓ Conteneurs FHIRHub arrêtés avec succès${NC}"
else
    echo -e "${GREEN}Aucun conteneur FHIRHub en cours d'exécution détecté${NC}"
fi

# Déterminer quelle configuration docker-compose est utilisée
DOCKER_COMPOSE_FILE=""
if [ -f "docker-compose.yml" ]; then
    DOCKER_COMPOSE_FILE="docker-compose.yml"
    echo -e "${GREEN}Configuration standard (docker-compose.yml) détectée${NC}"
elif [ -f "docker-compose-minimal.yml" ]; then
    DOCKER_COMPOSE_FILE="docker-compose-minimal.yml"
    echo -e "${GREEN}Configuration minimale (docker-compose-minimal.yml) détectée${NC}"
else
    echo -e "${RED}Aucun fichier docker-compose.yml ou docker-compose-minimal.yml trouvé.${NC}"
    echo -e "${RED}Impossible de déterminer les volumes à nettoyer.${NC}"
    
    if ! confirm "Voulez-vous continuer et tenter de nettoyer tous les volumes FHIRHub disponibles?"; then
        echo -e "${BLUE}Opération annulée.${NC}"
        exit 0
    fi
fi

# Lister les volumes à réinitialiser
echo -e "\n${BLUE}=== Identification des volumes Docker à réinitialiser ===${NC}"

# Définir les volumes selon la configuration Docker
if [ "$DOCKER_COMPOSE_FILE" == "docker-compose.yml" ]; then
    VOLUMES=(
        "fhirhub_db"
        "fhirhub_data"
        "fhirhub_logs"
        "fhirhub_backups"
        "fhirhub_terminology"
    )
    echo -e "${GREEN}Volumes standard identifiés${NC}"
elif [ "$DOCKER_COMPOSE_FILE" == "docker-compose-minimal.yml" ]; then
    VOLUMES=(
        "fhirhub_db_minimal"
        "fhirhub_data_minimal"
        "fhirhub_logs_minimal"
        "fhirhub_backups_minimal"
        "fhirhub_terminology_minimal"
    )
    echo -e "${GREEN}Volumes minimaux identifiés${NC}"
else
    # Si aucun fichier docker-compose n'est trouvé, tenter de lister tous les volumes FHIRHub
    VOLUMES=($(docker volume ls --format "{{.Name}}" | grep "fhirhub"))
    
    if [ ${#VOLUMES[@]} -eq 0 ]; then
        echo -e "${RED}Aucun volume FHIRHub trouvé.${NC}"
        exit 1
    fi
    
    echo -e "${YELLOW}Volumes FHIRHub détectés automatiquement : ${VOLUMES[*]}${NC}"
fi

# Sauvegarde (optionnelle) avant de nettoyer
echo -e "\n${BLUE}=== Option de sauvegarde des volumes avant nettoyage ===${NC}"
if confirm "Voulez-vous créer une sauvegarde des volumes avant de les nettoyer?"; then
    BACKUP_DIR="./docker_volumes_backup_$(date +%Y%m%d_%H%M%S)"
    mkdir -p "$BACKUP_DIR"
    
    echo "Création des sauvegardes dans $BACKUP_DIR..."
    
    # Créer un conteneur temporaire pour chaque volume et copier les données
    for VOLUME in "${VOLUMES[@]}"; do
        echo "Sauvegarde du volume $VOLUME..."
        CONTAINER_NAME="backup_$VOLUME"
        
        # Créer un conteneur temporaire avec le volume monté
        docker run --rm -d --name "$CONTAINER_NAME" -v "$VOLUME:/data" alpine sleep 3600
        
        # Créer un répertoire pour la sauvegarde
        mkdir -p "$BACKUP_DIR/$VOLUME"
        
        # Copier les données du volume dans le répertoire de sauvegarde
        docker cp "$CONTAINER_NAME:/data/." "$BACKUP_DIR/$VOLUME/"
        
        # Arrêter et supprimer le conteneur temporaire
        docker stop "$CONTAINER_NAME"
    done
    
    echo -e "${GREEN}✓ Sauvegarde des volumes terminée${NC}"
fi

# Nettoyage des volumes
echo -e "\n${BLUE}=== Nettoyage des volumes Docker ===${NC}"
echo -e "${YELLOW}Les volumes suivants seront réinitialisés :${NC}"
for VOLUME in "${VOLUMES[@]}"; do
    echo "  - $VOLUME"
done
echo ""

if ! confirm "Confirmez-vous la réinitialisation de ces volumes?"; then
    echo -e "${BLUE}Opération annulée.${NC}"
    exit 0
fi

# Deux approches pour nettoyer les volumes :
# 1. Supprimer et recréer (plus rapide mais plus invasif)
# 2. Monter et vider (plus sûr mais peut laisser certains fichiers)

if confirm "Voulez-vous complètement supprimer les volumes et les recréer? (recommandé pour un nettoyage complet)"; then
    echo "Suppression des volumes..."
    
    # Supprimer tous les volumes
    for VOLUME in "${VOLUMES[@]}"; do
        if docker volume ls --format "{{.Name}}" | grep -q "^$VOLUME$"; then
            echo "Suppression du volume $VOLUME..."
            docker volume rm "$VOLUME"
        else
            echo -e "${YELLOW}Volume $VOLUME non trouvé, ignoré${NC}"
        fi
    done
    
    # Recréer les volumes vides
    echo "Recréation des volumes vides..."
    for VOLUME in "${VOLUMES[@]}"; do
        echo "Création du volume $VOLUME..."
        docker volume create "$VOLUME"
    done
    
    echo -e "${GREEN}✓ Volumes supprimés et recréés avec succès${NC}"
else
    echo "Nettoyage du contenu des volumes sans les supprimer..."
    
    # Pour chaque volume, créer un conteneur temporaire et vider le contenu
    for VOLUME in "${VOLUMES[@]}"; do
        if docker volume ls --format "{{.Name}}" | grep -q "^$VOLUME$"; then
            echo "Nettoyage du volume $VOLUME..."
            
            # Créer un conteneur temporaire
            CONTAINER_NAME="clean_$VOLUME"
            docker run --rm -d --name "$CONTAINER_NAME" -v "$VOLUME:/data" alpine sleep 60
            
            # Supprimer tout le contenu sauf les dossiers cachés
            docker exec "$CONTAINER_NAME" sh -c "find /data -mindepth 1 -not -path '/data/.*' -delete"
            
            # Arrêter et supprimer le conteneur temporaire
            docker stop "$CONTAINER_NAME"
            
            echo -e "${GREEN}✓ Volume $VOLUME nettoyé${NC}"
        else
            echo -e "${YELLOW}Volume $VOLUME non trouvé, ignoré${NC}"
        fi
    done
fi

# Redémarrer les conteneurs
echo -e "\n${BLUE}=== Redémarrage des conteneurs ===${NC}"
if confirm "Voulez-vous redémarrer les conteneurs FHIRHub maintenant?"; then
    echo "Redémarrage des conteneurs..."
    
    if [ -n "$DOCKER_COMPOSE_FILE" ]; then
        docker-compose -f "$DOCKER_COMPOSE_FILE" up -d
    else
        # Tenter de déterminer quel fichier utiliser
        if [ -f "docker-compose.yml" ]; then
            docker-compose up -d
        elif [ -f "docker-compose-minimal.yml" ]; then
            docker-compose -f docker-compose-minimal.yml up -d
        else
            echo -e "${RED}Impossible de redémarrer les conteneurs : aucun fichier docker-compose trouvé.${NC}"
            echo -e "${YELLOW}Veuillez démarrer les conteneurs manuellement.${NC}"
        fi
    fi
    
    echo -e "${GREEN}✓ Conteneurs FHIRHub redémarrés${NC}"
else
    echo -e "${YELLOW}N'oubliez pas de redémarrer les conteneurs manuellement :${NC}"
    if [ -n "$DOCKER_COMPOSE_FILE" ]; then
        echo -e "${BLUE}docker-compose -f $DOCKER_COMPOSE_FILE up -d${NC}"
    else
        echo -e "${BLUE}docker-compose up -d${NC}"
        echo -e "${BLUE}ou${NC}"
        echo -e "${BLUE}docker-compose -f docker-compose-minimal.yml up -d${NC}"
    fi
fi

echo -e "\n${BLUE}=== Réinitialisation des volumes Docker terminée ===${NC}"
echo -e "${GREEN}Tous les volumes Docker FHIRHub ont été réinitialisés avec succès.${NC}"
echo -e "${GREEN}L'application est maintenant prête avec des données propres.${NC}"

exit 0