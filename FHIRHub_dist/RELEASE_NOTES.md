# Notes de version - FHIRHub 1.0.0

Date de sortie : 27 avril 2025

## Nouveautés

- **Conversion complète HL7 vers FHIR R4** - Support des messages ADT avec génération de multiples ressources FHIR
- **Support des segments ROL, NK1 et IN1** - Prise en charge des données de rôle, personnes associées et couverture de santé
- **Terminologies françaises** - Intégration complète des systèmes et codes de l'ANS
- **Interface utilisateur intuitive** - Design aux couleurs e-Santé françaises
- **Mode hors-ligne complet** - Fonctionnement sans connexion internet
- **API REST sécurisée** - Gestion des clés API par application

## Améliorations

- **Traitement optimisé des caractères spéciaux** dans les messages HL7 complexes
- **Gestion des identifiants français** (INS, RPPS, ADELI, etc.)
- **Nettoyage intelligent des ressources FHIR** pour maximiser la compatibilité
- **Logs détaillés** des conversions avec conservation paramétrable

## Corrections

- Gestion correcte des sauts de ligne dans les messages HL7 multi-lignes
- Résolution des problèmes d'encodage avec les caractères accentués français
- Support des formats locaux de date et heure

## Prérequis

- Node.js 18.x ou supérieur
- 500 Mo d'espace disque minimum
- 2 Go de RAM recommandé

## Installation

Voir fichier README.md pour les instructions détaillées d'installation.

---

© 2025 FHIRHub - Tous droits réservés