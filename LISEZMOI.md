# FHIRHub - Convertisseur HL7 v2.5 vers FHIR R4

FHIRHub est une application complète de conversion des messages HL7 v2.5 vers le format FHIR R4, spécialement adaptée pour l'interopérabilité des systèmes de santé français.

## Fonctionnalités

- **Conversion HL7 vers FHIR** : Transformation complète des messages HL7 v2.5 en ressources FHIR R4
- **Support des terminologies françaises** : Intégration des systèmes de terminologie de l'ANS
- **API REST sécurisée** : Interface API pour intégration facile dans d'autres systèmes
- **Interface utilisateur moderne** : Interface web intuitive pour les conversions manuelles
- **Mode hors-ligne** : Fonctionne entièrement sans connexion internet
- **Portable et léger** : Utilise SQLite, ne nécessite pas de base de données externe

## Prérequis

- Node.js 18.x ou supérieur
- Npm ou Yarn
- Navigateur web moderne (Chrome, Firefox, Edge)

## Installation rapide

1. Décompressez l'archive dans un dossier de votre choix
2. Ouvrez un terminal dans ce dossier
3. Installez les dépendances :
   ```
   npm install
   ```
4. Lancez l'application :
   ```
   ./start.sh
   ```
5. Accédez à l'application dans votre navigateur : http://localhost:5000

## Structure du projet

- `app.js` : Application principale
- `api.js` : Endpoints API REST
- `hl7ToFhirConverter.js` : Moteur de conversion
- `french_terminology_adapter.js` : Adaptation aux terminologies françaises
- `fhir_cleaner.js` : Optimisation des ressources FHIR
- `frontend/` : Interface utilisateur
- `data/` : Stockage des données et fichiers

## Utilisateurs par défaut

- Administrateur : admin / adminfhirhub
- Utilisateur : user / userfhirhub

## Formats supportés

- Messages HL7 v2.5 (ADT, ORU, etc.)
- FHIR R4 (version 4.0.1) conforme aux spécifications de l'ANS

## Support des segments HL7

Le convertisseur prend en charge les segments HL7 suivants :
- MSH (En-tête)
- PID (Patient)
- PV1 (Visite)
- NK1 (Personne liée)
- ROL (Rôle du praticien)
- IN1 (Assurance)
- OBX (Observation)
- Et bien d'autres...

## Terminologies françaises

FHIRHub intègre les principales terminologies françaises de l'ANS :
- TRE-R316-AutreCategorieEtablissement
- TRE-R51-DESCGroupe2Diplome
- TRE-G02-TypeProduit
- TRE-R217-ProtectionJuridique
- TRE-R302-ContexteCodeComplementaire
- TRE-R239-PublicPrisEnCharge
- TRE-A01-CadreExercice
- TRE-R303-HL7v3AdministrativeGender

## Configuration

La configuration de l'application se fait via le fichier `french_terminology/config.json`.

## Dépannage

- Si l'application ne démarre pas, vérifiez que le port 5000 est disponible
- En cas d'erreur de conversion, consultez les logs dans l'interface ou dans le terminal

## Support

Pour toute question ou assistance, veuillez contacter notre équipe de support.