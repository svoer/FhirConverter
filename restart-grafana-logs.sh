#!/bin/bash

# Couleurs pour les messages
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== Redémarrage des services pour activation des logs dans Grafana ===${NC}"

# Vérification si Docker est en cours d'exécution
if ! docker ps > /dev/null 2>&1; then
  echo -e "${RED}Erreur: Docker n'est pas en cours d'exécution. Veuillez démarrer Docker.${NC}"
  exit 1
fi

echo -e "${YELLOW}Redémarrage du service FHIRHub pour activer le nouvel exportateur de logs...${NC}"
docker restart fhirhub

echo -e "${YELLOW}Redémarrage de Prometheus pour récupérer les nouvelles métriques...${NC}"
docker restart fhirhub-prometheus

echo -e "${YELLOW}Redémarrage de Grafana pour charger les nouveaux dashboards...${NC}"
docker restart fhirhub-grafana

echo -e "${GREEN}Tous les services ont été redémarrés avec succès!${NC}"
echo -e "${BLUE}Le dashboard de logs Grafana devrait maintenant être disponible.${NC}"
echo -e "${YELLOW}Vous pouvez y accéder à l'adresse: http://localhost:3000${NC}"
echo -e "${YELLOW}Identifiants par défaut: admin / admin123${NC}"
echo -e ""
echo -e "${BLUE}Si les logs n'apparaissent toujours pas:${NC}"
echo -e "1. Assurez-vous que des conversions ont été effectuées récemment"
echo -e "2. Vérifiez les tableaux de bord disponibles dans Grafana:"
echo -e "   - 'Logs de Conversion FHIRHub' - Vue générale"
echo -e "   - 'Logs FHIRHub (Détaillé)' - Vue détaillée avec filtrage par date/heure/erreurs"
echo -e "3. Ajustez la plage de temps dans le coin supérieur droit de Grafana"
echo -e "4. Utilisez les filtres disponibles pour affiner l'affichage des logs"