# Processus de conversion HL7 vers FHIR

Ce document décrit en détail le processus de conversion des messages HL7 v2.5 vers FHIR R4 dans FHIRHub.

## Introduction

La conversion de messages HL7 v2.5 vers FHIR R4 est une tâche complexe qui nécessite une compréhension approfondie des deux formats. FHIRHub implémente cette conversion selon les spécifications de l'ANS (Agence du Numérique en Santé) en France.

## Flux de conversion

Le processus de conversion suit les étapes suivantes :

1. **Analyse du message HL7** : Le message HL7 v2.5 est analysé pour extraire les segments, champs et composants.
2. **Identification du type de message** : Le type de message est identifié à partir du segment MSH.
3. **Correspondance des champs** : Les champs HL7 sont mappés vers les attributs FHIR correspondants.
4. **Création des ressources FHIR** : Les ressources FHIR sont créées avec les valeurs extraites du message HL7.
5. **Application des terminologies françaises** : Les codes et systèmes de codification français sont appliqués.
6. **Validation des ressources** : Les ressources FHIR créées sont validées selon les profils français.
7. **Création du Bundle FHIR** : Les ressources sont regroupées dans un Bundle de type Transaction.

## Types de messages supportés

FHIRHub prend en charge la conversion des types de messages HL7 v2.5 suivants :

- **ADT (Admission, Discharge, Transfer)** : Gestion des événements de patients
  - A01 : Admission d'un patient
  - A02 : Transfert d'un patient
  - A03 : Sortie d'un patient
  - A04 : Enregistrement d'un patient
  - A05 : Pré-admission d'un patient
  - A08 : Mise à jour des informations du patient
  - A11 : Annulation d'admission
  - A13 : Annulation de sortie
  
- **ORU (Observation Result)** : Résultats d'observations
  - R01 : Résultats d'observations

- **ORM (Order Message)** : Messages de commande
  - O01 : Demande d'examen

- **MDM (Medical Document Management)** : Gestion des documents médicaux
  - T02 : Document complet

## Mapping HL7 vers FHIR

### Segments HL7 vers ressources FHIR

Voici comment les principaux segments HL7 sont convertis en ressources FHIR :

- **MSH** → Bundle, MessageHeader
- **PID** → Patient
- **PV1** → Encounter
- **ORC** → ServiceRequest
- **OBR** → ServiceRequest, Procedure
- **OBX** → Observation
- **NK1** → RelatedPerson
- **AL1** → AllergyIntolerance
- **DG1** → Condition
- **IN1** → Coverage
- **TXA** → DocumentReference

### Conversion spécifique des identificateurs

Les identificateurs HL7 sont convertis en identificateurs FHIR selon les règles suivantes :

```
PID-3 (Patient ID) → Patient.identifier
ORC-2 (Placer Order Number) → ServiceRequest.identifier
OBR-3 (Filler Order Number) → ServiceRequest.identifier
```

## Terminologies françaises

FHIRHub gère automatiquement la conversion des terminologies françaises, notamment :

- RPPS (Répertoire Partagé des Professionnels de Santé)
- ADELI (Automatisation Des Listes)
- CIM-10 (Classification Internationale des Maladies, 10e révision)
- LOINC (Logical Observation Identifiers Names and Codes)
- CCAM (Classification Commune des Actes Médicaux)
- UCD (Unité Commune de Dispensation)

## Stratégies de cache

Pour améliorer les performances, FHIRHub utilise un système de cache pour les conversions fréquentes :

1. **Cache de messages** : Les messages HL7 identiques sont convertis une seule fois.
2. **Cache de segments** : Les segments identiques au sein de différents messages sont réutilisés.
3. **Cache de terminologies** : Les correspondances de terminologies sont mises en cache.

## Gestion des erreurs

La gestion des erreurs de conversion est une partie essentielle du processus :

1. **Erreurs d'analyse** : Erreurs lors de l'analyse du message HL7.
2. **Erreurs de mapping** : Champs obligatoires manquants ou incompatibles.
3. **Erreurs de terminologie** : Codes inconnus ou systèmes de codification non supportés.
4. **Erreurs de validation** : Ressources FHIR non conformes aux profils français.

Chaque erreur est enregistrée avec des informations détaillées pour faciliter le débogage.