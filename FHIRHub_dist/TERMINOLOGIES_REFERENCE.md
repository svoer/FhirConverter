# Référence des terminologies françaises - FHIRHub 1.0.0

Ce document liste les principales terminologies et systèmes de codes français supportés par FHIRHub, ainsi que leur utilisation dans les conversions HL7 vers FHIR.

## Systèmes d'identification

| Type d'identifiant | OID | URI FHIR | Description |
|---|---|---|---|
| INS-NIR | 1.2.250.1.213.1.4.8 | https://annuaire.sante.gouv.fr/fhir/NamingSystem/INS-NIR | Identifiant National de Santé (numéro de sécurité sociale) |
| INS-C | 1.2.250.1.213.1.4.2 | https://annuaire.sante.gouv.fr/fhir/NamingSystem/INS-C | Identifiant National de Santé calculé |
| RPPS | 1.2.250.1.71.4.2.1 | https://annuaire.sante.gouv.fr/fhir/NamingSystem/RPPS | Répertoire Partagé des Professionnels de Santé |
| ADELI | 1.2.250.1.71.4.2.2 | https://annuaire.sante.gouv.fr/fhir/NamingSystem/ADELI | Automatisation DEs LIstes (professionnels de santé) |
| FINESS | 1.2.250.1.71.4.2.3 | https://annuaire.sante.gouv.fr/fhir/NamingSystem/FINESS | Fichier National des Établissements Sanitaires et Sociaux |
| SIRET | 1.2.250.1.71.4.2.4 | https://annuaire.sante.gouv.fr/fhir/NamingSystem/SIRET | Système d'Identification du Répertoire des ÉTablissements |

## Terminologies principales (ANS)

| Nom | OID | URI FHIR | Description |
|---|---|---|---|
| TRE-R316-AutreCategorieEtablissement | 1.2.250.1.213.1.6.1.239 | https://mos.esante.gouv.fr/NOS/TRE_R316-AutreCategorieEtablissement | Catégories d'établissements de santé |
| TRE-R51-DESCGroupe2Diplome | 1.2.250.1.213.1.6.1.49 | https://mos.esante.gouv.fr/NOS/TRE_R51-DESCGroupe2Diplome | Diplômes et formations médicales |
| TRE-G02-TypeProduit | 1.2.250.1.71.1.2.2 | https://mos.esante.gouv.fr/NOS/TRE_G02-TypeProduit | Types de produits de santé |
| TRE-R217-ProtectionJuridique | 1.2.250.1.213.1.1.4.327 | https://mos.esante.gouv.fr/NOS/TRE_R217-ProtectionJuridique | Mesures de protection juridique |
| TRE-R302-ContexteCodeComplementaire | 1.2.250.1.213.3.3.70 | https://mos.esante.gouv.fr/NOS/TRE_R302-ContexteCodeComplementaire | Contextes des codes complémentaires |
| TRE-R239-PublicPrisEnCharge | 1.2.250.1.213.3.3.29 | https://mos.esante.gouv.fr/NOS/TRE_R239-PublicPrisEnCharge | Types de public pris en charge |
| TRE-A01-CadreExercice | 1.2.250.1.213.1.1.4.9 | https://mos.esante.gouv.fr/NOS/TRE_A01-CadreExercice | Cadres d'exercice des professionnels |
| TRE-R303-HL7v3AdministrativeGender | 1.2.250.1.213.1.1.5.1 | https://mos.esante.gouv.fr/NOS/TRE_R303-HL7v3AdministrativeGender | Correspondance genres HL7v3 |

## Mappings HL7 vers FHIR

### 1. Identifiants

| Segment HL7 | Champ HL7 | Ressource FHIR | Élément FHIR | Système utilisé |
|---|---|---|---|---|
| PID | PID-3 | Patient | identifier | Dépend du type d'identifiant |
| PID | PID-3 (INS-NIR) | Patient | identifier | https://annuaire.sante.gouv.fr/fhir/NamingSystem/INS-NIR |
| PID | PID-3 (INS-C) | Patient | identifier | https://annuaire.sante.gouv.fr/fhir/NamingSystem/INS-C |
| PRA | PRA-5 | Practitioner | identifier | https://annuaire.sante.gouv.fr/fhir/NamingSystem/RPPS |
| PRA | PRA-5 | Practitioner | identifier | https://annuaire.sante.gouv.fr/fhir/NamingSystem/ADELI |

### 2. Informations démographiques

| Segment HL7 | Champ HL7 | Ressource FHIR | Élément FHIR | Notes |
|---|---|---|---|---|
| PID | PID-5 | Patient | name | Format français: NOM^Prénom^AutrePrénom |
| PID | PID-7 | Patient | birthDate | Format français: AAAAMMJJ |
| PID | PID-8 | Patient | gender | Utilisation de TRE-R303-HL7v3AdministrativeGender |
| PID | PID-11 | Patient | address | Gestion spécifique du code postal français (5 chiffres) |
| PID | PID-13 | Patient | telecom | Format français: +33 n nn nn nn nn |

### 3. Contexte médical

| Segment HL7 | Champ HL7 | Ressource FHIR | Élément FHIR | Notes |
|---|---|---|---|---|
| PV1 | PV1-2 | Encounter | status | Statut adapté aux standards français |
| ROL | ROL-3 | PractitionerRole | code | Utilisation de TRE-R51-DESCGroupe2Diplome |
| ROL | ROL-9 | PractitionerRole | specialty | Spécialités médicales françaises |
| IN1 | IN1-2 | Coverage | payor | Organismes d'assurance maladie français |

## Extensions françaises

FHIRHub supporte les extensions FHIR officielles pour le contexte français:

| Extension | URI | Utilisation |
|---|---|---|
| INS Statut | https://apifhir.annuaire.sante.fr/ws-sync/exposed/structuredefinition/INS-Statut | Statut de l'identité INS |
| INS Source | https://apifhir.annuaire.sante.fr/ws-sync/exposed/structuredefinition/INS-Source | Source de l'identité INS |
| Lieu de naissance | https://apifhir.annuaire.sante.fr/ws-sync/exposed/structuredefinition/FrPatient-birthPlace | Commune de naissance |
| Date de décès | https://apifhir.annuaire.sante.fr/ws-sync/exposed/structuredefinition/FrPatient-deathDate | Date précise de décès |

## Accès aux terminologies

Les terminologies sont accessibles hors ligne dans FHIRHub, mais peuvent également être consultées via:

- Le Serveur Multi-Terminologies (SMT) de l'ANS: https://smt.esante.gouv.fr/
- Le Modèle des Objets de Santé (MOS): https://mos.esante.gouv.fr/
- Le Répertoire Opérationnel des Ressources (ROR): https://www.ror-if.fr/

## Validation des codes

FHIRHub effectue une validation des codes utilisés par rapport aux terminologies embarquées. Pour chaque erreur de validation, un message spécifique est généré dans les logs.

## Adaptation aux futures évolutions

Pour faciliter l'adaptation aux évolutions des terminologies françaises, FHIRHub implémente:

1. Un mécanisme de mise à jour des terminologies via fichiers JSON
2. Un service d'adaptation qui sépare la logique métier des mappings spécifiques
3. Une rétrocompatibilité pour les codes obsolètes mais encore en usage

---

© 2025 FHIRHub - Tous droits réservés