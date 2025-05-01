#!/bin/bash

# Script d'installation du service FHIRHub pour systemd (Linux)
# Ce script doit être exécuté avec les privilèges root (sudo)

echo "=========================================================="
echo "     Installation de FHIRHub comme service systemd"
echo "=========================================================="

# Vérifier si on est root
if [ "$EUID" -ne 0 ]; then
  echo "ERREUR: Ce script doit être exécuté en tant que root (utilisez sudo)"
  echo "Exemple: sudo ./install-service.sh"
  exit 1
fi

# Récupérer le chemin absolu du dossier de l'application
APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
echo "Répertoire de l'application: $APP_DIR"

# Récupérer l'utilisateur actuel (pour éviter de faire tourner le service en tant que root)
CURRENT_USER=$(logname 2>/dev/null || echo $SUDO_USER)
if [ -z "$CURRENT_USER" ]; then
  CURRENT_USER=$USER
fi
echo "Utilisateur courant: $CURRENT_USER"

# Vérifier la présence et l'installation de Node.js
if [ -f "./setup-nodejs.sh" ]; then
  echo "Utilisation du script d'installation Node.js spécifique à FHIRHub..."
  
  # Rendre le script exécutable si nécessaire
  chmod +x ./setup-nodejs.sh
  
  # Utiliser notre script d'installation de Node.js
  if [ "$EUID" -eq 0 ]; then
    # Si root, installer au niveau système
    ./setup-nodejs.sh
  else
    # Si non-root, on pourrait demander sudo
    echo "Pour une installation système de Node.js, sudo peut être nécessaire."
    sudo ./setup-nodejs.sh
  fi
  
  # Vérifier si une installation locale a été faite
  if [ -f "./.nodejsrc" ]; then
    echo "Configuration Node.js locale détectée, chargement..."
    source ./.nodejsrc
  fi
else
  # La méthode standard si le script spécifique n'est pas disponible
  if ! command -v node &> /dev/null; then
    echo "ERREUR: Node.js n'est pas installé et le script d'installation n'est pas disponible."
    echo "Veuillez installer Node.js v20 ou supérieur manuellement avant de continuer."
    echo "Visitez https://nodejs.org/en/download/ pour les instructions."
    exit 1
  fi
fi

# Vérifier que Node.js est bien détecté maintenant
if ! command -v node &> /dev/null; then
  echo "ERREUR: Node.js n'est toujours pas détecté dans le PATH après la tentative d'installation."
  echo "Veuillez vérifier l'installation de Node.js et réessayer."
  exit 1
fi

# Vérifier la version de Node.js
NODE_VERSION=$(node -v | cut -c 2- | cut -d '.' -f 1)
NODE_PATH=$(which node)
echo "Node.js détecté: $(node -v) à $NODE_PATH"

if [ "$NODE_VERSION" -lt 14 ]; then
  echo "AVERTISSEMENT: La version de Node.js ($NODE_VERSION) est inférieure à la version recommandée (20+)."
  echo "L'application pourrait rencontrer des problèmes de compatibilité."
  
  read -p "Voulez-vous continuer avec cette version? (o/n): " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Oo]$ ]]; then
    echo "Installation annulée. Veuillez installer Node.js 20 ou supérieur."
    exit 1
  fi
fi

# Vérifier si un service systemd existe déjà
if [ -f "/etc/systemd/system/fhirhub.service" ]; then
  echo "Un service FHIRHub existe déjà dans systemd."
  read -p "Voulez-vous le remplacer? (o/n): " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Oo]$ ]]; then
    echo "Installation annulée."
    exit 0
  fi
  
  echo "Arrêt et désactivation du service existant..."
  systemctl stop fhirhub.service
  systemctl disable fhirhub.service
fi

# Créer le fichier de service systemd
echo "Création du fichier de service systemd..."
cat > /etc/systemd/system/fhirhub.service << EOF
[Unit]
Description=FHIRHub - Convertisseur HL7 v2.5 vers FHIR R4
Documentation=https://github.com/votre-organisation/fhirhub
After=network.target

[Service]
Type=simple
User=$CURRENT_USER
WorkingDirectory=$APP_DIR
ExecStart=$NODE_PATH $APP_DIR/app.js
Restart=on-failure
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=fhirhub
Environment=NODE_ENV=production PORT=5000

# Configuration de sécurité (recommandée pour la production)
# Décommentez ces lignes si nécessaire
#PrivateTmp=true
#ProtectHome=true
#ProtectSystem=full
#NoNewPrivileges=true

[Install]
WantedBy=multi-user.target
EOF

# Créer le dossier de logs si nécessaire
mkdir -p "$APP_DIR/logs"
chown $CURRENT_USER:$CURRENT_USER "$APP_DIR/logs"

# Rechargement de systemd
echo "Rechargement de la configuration systemd..."
systemctl daemon-reload

# Activer le service pour qu'il démarre automatiquement au boot
echo "Activation du service FHIRHub..."
systemctl enable fhirhub.service

# Demander si l'utilisateur veut démarrer le service maintenant
read -p "Voulez-vous démarrer le service maintenant? (o/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Oo]$ ]]; then
  echo "Démarrage du service FHIRHub..."
  systemctl start fhirhub.service
  
  # Vérifier si le service a bien démarré
  sleep 2
  if systemctl is-active --quiet fhirhub.service; then
    echo "Service FHIRHub démarré avec succès!"
  else
    echo "Le service n'a pas pu démarrer correctement. Vérifiez les logs:"
    echo "  journalctl -u fhirhub.service"
  fi
else
  echo "Le service est installé mais n'a pas été démarré."
  echo "Vous pouvez le démarrer manuellement avec: sudo systemctl start fhirhub.service"
fi

echo
echo "=========================================================="
echo "L'application sera accessible à l'adresse: http://localhost:5000"
echo "Commandes utiles:"
echo "  Vérifier l'état:   sudo systemctl status fhirhub.service"
echo "  Afficher les logs: sudo journalctl -u fhirhub.service -f"
echo "  Redémarrer:        sudo systemctl restart fhirhub.service"
echo "  Arrêter:           sudo systemctl stop fhirhub.service"
echo "=========================================================="