# Historique des versions - FHIRHub

## Version 1.0.0 (27 avril 2025)

Version initiale stable de FHIRHub.

### Fonctionnalités principales
- Conversion complète HL7 vers FHIR R4
- Support des segments ROL, NK1 et IN1
- Terminologies françaises
- Interface utilisateur intuitive
- Mode hors-ligne complet
- API REST sécurisée

### Améliorations
- Traitement optimisé des caractères spéciaux
- Gestion des identifiants français
- Nettoyage intelligent des ressources FHIR
- Logs détaillés des conversions

### Corrections
- Gestion correcte des sauts de ligne dans les messages HL7 multi-lignes
- Résolution des problèmes d'encodage avec les caractères accentués français
- Support des formats locaux de date et heure

## Version 0.9.5 (15 mars 2025)

Version Release Candidate.

### Fonctionnalités principales
- Première implémentation complète du convertisseur
- Intégration initiale des terminologies françaises
- Interface utilisateur fonctionnelle
- API REST basique

### Corrections
- Conversion des segments PV1 et ROL
- Gestion des erreurs pour les messages HL7 malformés

## Version 0.9.0 (1er février 2025)

Version bêta.

### Fonctionnalités principales
- Implémentation initiale du convertisseur HL7 vers FHIR
- Support basique des segments MSH, PID, PV1
- Interface utilisateur minimaliste
- Stockage des conversions en SQLite

## Version 0.5.0 (15 décembre 2024)

Version alpha.

### Fonctionnalités principales
- Preuve de concept du convertisseur
- Parsing des messages HL7 simples
- Génération de ressources FHIR Patient et Encounter
- Interface en ligne de commande uniquement