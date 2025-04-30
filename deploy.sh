#!/bin/bash

# Couleurs pour les messages
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Déploiement de FHIRHub...${NC}"

# Vérifier si Docker est installé
if command -v docker &> /dev/null && command -v docker-compose &> /dev/null; then
    echo -e "${GREEN}Docker et docker-compose sont installés. Déploiement via Docker...${NC}"
    
    # Exécuter le script de correction avant de construire l'image Docker
    if [ -f "fix_converters.sh" ]; then
        echo -e "${YELLOW}Application des corrections pour les modules...${NC}"
        bash fix_converters.sh
    fi
    
    # Vérifier si le Dockerfile existe et le mettre à jour pour éviter les problèmes avec pip
    if [ -f "Dockerfile" ]; then
        echo -e "${YELLOW}Mise à jour du Dockerfile pour éviter les problèmes avec pip...${NC}"
        # Sauvegarder le Dockerfile original
        cp Dockerfile Dockerfile.bak
        
        # Remplacer l'installation pip par apk pour requests
        sed -i 's/RUN pip3 install requests/# Utilisation de py3-requests au lieu de pip install requests pour éviter les erreurs PEP 668\nRUN apk add --no-cache python3 py3-pip bash py3-requests/' Dockerfile
    fi

    # Construire et démarrer le conteneur avec docker-compose
    echo -e "${YELLOW}Construction et démarrage du conteneur...${NC}"
    docker-compose up --build -d
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}Déploiement Docker réussi!${NC}"
        echo -e "FHIRHub est disponible à l'adresse: ${YELLOW}http://localhost:5000${NC}"
        echo -e "Pour voir les logs: ${YELLOW}docker-compose logs -f${NC}"
    else
        echo -e "${RED}Échec du déploiement Docker.${NC}"
        echo -e "${YELLOW}Tentative de déploiement en mode standard...${NC}"
        
        # Exécuter le script d'installation
        echo -e "${YELLOW}Installation des dépendances...${NC}"
        bash install.sh
        
        if [ $? -eq 0 ]; then
            # Démarrer l'application
            echo -e "${YELLOW}Démarrage de l'application...${NC}"
            bash start.sh
        else
            echo -e "${RED}L'installation a échoué.${NC}"
            exit 1
        fi
    fi
else
    echo -e "${YELLOW}Docker non détecté. Déploiement en mode standard...${NC}"
    
    # Exécuter le script d'installation
    echo -e "${YELLOW}Installation des dépendances...${NC}"
    bash install.sh
    
    if [ $? -eq 0 ]; then
        # Démarrer l'application
        echo -e "${YELLOW}Démarrage de l'application...${NC}"
        bash start.sh
    else
        echo -e "${RED}L'installation a échoué.${NC}"
        exit 1
    fi
fi