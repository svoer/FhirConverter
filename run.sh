#!/bin/bash

# Créer les répertoires nécessaires s'ils n'existent pas
mkdir -p ./data/in
mkdir -p ./data/out

# Vérifier si Maven est correctement installé
if ! command -v mvn &> /dev/null; then
    echo "Maven n'est pas installé. Installation de Maven..."
    sudo apt-get update
    sudo apt-get install maven -y
fi

# Afficher la version de Maven et Java
echo "Versions utilisées:"
echo "------------------------------------------------"
mvn --version
echo "------------------------------------------------"

# Compiler l'application avec Maven
echo "Compilation de l'application FHIRHub..."
mvn clean package -DskipTests

# Vérifier si la compilation a réussi
if [ $? -eq 0 ]; then
    echo "Compilation réussie. Démarrage de l'application..."
    # Trouver le chemin de Java
    JAVA_PATH=$(which java)
    if [ -z "$JAVA_PATH" ]; then
        # Si java n'est pas trouvé dans PATH, chercher dans les chemins typiques
        for path in /usr/bin/java /usr/local/bin/java /nix/store/*/bin/java
        do
            if [ -x "$path" ]; then
                JAVA_PATH="$path"
                break
            fi
        done
    fi
    
    # Exécuter l'application
    if [ -n "$JAVA_PATH" ]; then
        echo "Utilisation de Java depuis: $JAVA_PATH"
        # S'assurer que le serveur est accessible depuis l'extérieur
        LOG_FILE="app.log"
        echo "Démarrage de l'application. Les logs seront écrits dans $LOG_FILE"
        "$JAVA_PATH" -Dserver.address=0.0.0.0 -jar target/fhirhub-1.0.0.jar > $LOG_FILE 2>&1 &
        
        # Stocker le PID du processus
        APP_PID=$!
        echo "Application démarrée avec PID: $APP_PID"
        
        # Attendre que le serveur démarre (max 30 secondes)
        echo "En attente du démarrage du serveur sur le port 5000..."
        MAX_WAIT=30
        WAIT_COUNT=0
        
        while [ $WAIT_COUNT -lt $MAX_WAIT ]; do
            # Vérifier si le processus est toujours en cours d'exécution
            if ! ps -p $APP_PID > /dev/null; then
                echo "ERREUR: Le processus a échoué. Vérifiez les logs dans $LOG_FILE"
                cat $LOG_FILE
                exit 1
            fi
            
            # Vérifier si le port est ouvert
            if nc -z localhost 5000 2>/dev/null; then
                echo "Serveur démarré avec succès sur le port 5000!"
                break
            fi
            
            WAIT_COUNT=$((WAIT_COUNT + 1))
            sleep 1
            echo -n "."
        done
        
        if [ $WAIT_COUNT -eq $MAX_WAIT ]; then
            echo "AVERTISSEMENT: Le délai d'attente pour le démarrage du serveur a expiré."
            echo "Dernier contenu du fichier journal:"
            tail -n 50 $LOG_FILE
        fi
        
        # Rester actif pour laisser l'application tourner
        echo "L'application FHIRHub est en cours d'exécution. Ctrl+C pour arrêter."
        wait $APP_PID
    else
        echo "ERREUR: Java n'a pas été trouvé. Veuillez installer Java 21 ou supérieur."
        exit 1
    fi
else
    echo "Échec de la compilation. Vérifiez les erreurs ci-dessus."
    exit 1
fi