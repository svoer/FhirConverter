# Checklist d'installation - FHIRHub 1.0.0

Utilisez cette checklist pour vous assurer que l'installation de FHIRHub a été effectuée correctement.

## Prérequis

- [ ] Node.js 18.x ou supérieur est installé
- [ ] 2 Go de RAM minimum disponible
- [ ] 500 Mo d'espace disque minimum disponible
- [ ] Privilèges suffisants pour installer des packages npm
- [ ] Port 5000 disponible (ou configuration d'un autre port)

## Installation

- [ ] Archive de FHIRHub décompressée dans le répertoire cible
- [ ] Script `verify_system.sh` exécuté pour vérifier la compatibilité du système
- [ ] Commande `npm install` exécutée avec succès
- [ ] Script `install.sh` exécuté avec succès
- [ ] Répertoires de données créés correctement

## Configuration

- [ ] Fichier `config.json` configuré selon vos besoins spécifiques
- [ ] Port du serveur ajusté si nécessaire (5000 par défaut)
- [ ] Paramètres d'API configurés (clés, limites)
- [ ] Paramètres de conversion ajustés si nécessaire
- [ ] Configuration des répertoires vérifiée

## Démarrage et validation

- [ ] Script `start.sh` exécuté avec succès
- [ ] Message de confirmation du démarrage du serveur affiché
- [ ] Accès à l'interface via le navigateur fonctionnel
- [ ] Connexion avec identifiants par défaut réussie
- [ ] Test de conversion avec exemple.hl7 réussi
- [ ] API accessible via curl ou autre client REST

## Sécurité

- [ ] Mot de passe administrateur par défaut changé
- [ ] Clé API par défaut (dev-key) remplacée en production
- [ ] Paramètres de session sécurisés configurés
- [ ] Limitation de taux activée pour l'API

## Documentation

- [ ] Documentation installée et accessible
- [ ] Guide utilisateur communiqué aux utilisateurs finaux
- [ ] Documentation API disponible pour les intégrateurs
- [ ] Procédures de sauvegarde établies

## Spécifique à votre environnement

- [ ] _Ajoutez ici les éléments spécifiques à votre environnement..._
- [ ] _Exemple: Configuration d'un proxy inverse (nginx, Apache)_
- [ ] _Exemple: Intégration avec votre SSO d'entreprise_
- [ ] _Exemple: Configuration des sauvegardes automatiques_

## Problèmes connus

Si vous rencontrez l'un des problèmes suivants lors de l'installation, consultez les solutions proposées:

1. **Erreur "Port déjà utilisé"**
   - Solution: Modifiez le port dans config.json et redémarrez

2. **Erreur "Module not found"**
   - Solution: Vérifiez que npm install a bien été exécuté sans erreur

3. **Accès refusé aux répertoires de données**
   - Solution: Vérifiez les permissions sur les répertoires data/

---

Date d'installation: ______________________

Installé par: ______________________

Version: 1.0.0