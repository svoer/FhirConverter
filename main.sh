#!/bin/bash
set -x  # Activer le mode de débogage

# On sait que le JDK est déjà installé dans Replit grâce à Maven
echo "Recherche de Java..."
cd "$(dirname "$0")"

# Utiliser find pour trouver all les binaires java
JAVA_PATH=$(find /nix/store -type f -executable -name java | grep -v wrapper | head -1)

if [ -z "$JAVA_PATH" ]; then
    echo "Java n'a pas été trouvé. Impossible de démarrer l'application."
    exit 1
fi

echo "Utilisation de Java: $JAVA_PATH"

# Vérifiez si le fichier JAR existe déjà
if [ ! -f "target/fhirhub-1.0.0.jar" ]; then
    echo "Le fichier JAR n'existe pas. Compilation du projet..."
    mvn clean package -DskipTests
    if [ $? -ne 0 ]; then
        echo "La compilation a échoué."
        exit 1
    fi
fi

# Créer les répertoires nécessaires
mkdir -p ./data/in ./data/out

# Démarrer l'application
echo "Démarrage de FHIRHub sur le port 5000..."
"$JAVA_PATH" -Dserver.address=0.0.0.0 -jar target/fhirhub-1.0.0.jar