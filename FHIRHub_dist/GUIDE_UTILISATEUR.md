# Guide utilisateur - FHIRHub 1.0.0

## Introduction

FHIRHub est une plateforme spécialisée dans la conversion de messages HL7 v2.5 vers le format FHIR R4, adaptée aux spécificités du système de santé français. Ce guide vous accompagne dans l'utilisation quotidienne de l'application.

## Connexion à l'application

1. Ouvrez votre navigateur web et accédez à l'URL de FHIRHub (par défaut: `http://localhost:5000`)
2. Utilisez vos identifiants pour vous connecter:
   - Utilisateur standard: `user` / `userfhirhub`
   - Administrateur: `admin` / `adminfhirhub`

![Page de connexion](images/login.png)

## Interface principale

L'interface de FHIRHub est organisée en plusieurs sections accessibles depuis le menu latéral:

- **Tableau de bord**: Vue d'ensemble et statistiques système
- **Conversions**: Interface principale de conversion HL7 vers FHIR
- **Historique**: Journal des conversions précédentes
- **Applications**: Gestion des applications et clés API (admin uniquement)
- **Utilisateurs**: Gestion des comptes utilisateurs (admin uniquement)
- **Paramètres**: Configuration du système (admin uniquement)

## Conversion HL7 vers FHIR

### Méthode 1: Saisie directe

1. Accédez à la page **Conversions**
2. Dans la section "Saisie directe", collez votre message HL7
3. Cliquez sur **Convertir**
4. Le résultat FHIR s'affiche dans la section de droite
5. Utilisez le bouton **Copier** pour copier le résultat

### Méthode 2: Téléchargement de fichier

1. Accédez à la page **Conversions**
2. Dans la section "Téléchargement", cliquez sur **Parcourir**
3. Sélectionnez votre fichier HL7 (extension `.hl7` recommandée)
4. Cliquez sur **Convertir**
5. Le résultat FHIR s'affiche dans la section de droite
6. Utilisez le bouton **Télécharger** pour sauvegarder le résultat

### Utilisation des exemples préconfigurés

Pour faciliter les tests, FHIRHub propose des exemples préconfigurés:

1. Cliquez sur le bouton **Charger un exemple**
2. Sélectionnez l'exemple souhaité dans la liste
3. L'exemple est chargé dans la zone de saisie
4. Cliquez sur **Convertir** pour traiter l'exemple

## Consultation de l'historique

1. Accédez à la page **Historique**
2. Parcourez la liste des conversions précédentes
3. Utilisez les filtres pour affiner votre recherche
4. Cliquez sur une conversion pour afficher les détails
5. Vous pouvez télécharger ou copier à nouveau le résultat FHIR

## Administration (Utilisateurs administrateurs uniquement)

### Gestion des applications et clés API

1. Accédez à la page **Applications**
2. Pour ajouter une nouvelle application:
   - Cliquez sur **Nouvelle application**
   - Remplissez le formulaire avec les informations requises
   - Définissez les paramètres spécifiques (rétention des logs, dossiers autorisés)
   - Cliquez sur **Enregistrer**
3. Pour chaque application, vous pouvez:
   - Générer de nouvelles clés API (production/qualification)
   - Révoquer des clés existantes
   - Modifier les paramètres
   - Consulter les statistiques d'utilisation

### Gestion des utilisateurs

1. Accédez à la page **Utilisateurs**
2. Pour ajouter un nouvel utilisateur:
   - Cliquez sur **Nouvel utilisateur**
   - Remplissez le formulaire avec les informations requises
   - Sélectionnez le rôle (Admin ou User)
   - Cliquez sur **Enregistrer**
3. Pour chaque utilisateur, vous pouvez:
   - Réinitialiser le mot de passe
   - Modifier le rôle
   - Désactiver temporairement le compte
   - Supprimer le compte

### Configuration système

1. Accédez à la page **Paramètres**
2. Vous pouvez configurer:
   - Le port du serveur
   - La durée de rétention des logs
   - Les paramètres de sécurité
   - Les options de conversion

## Utilisation avancée

### Conversion via l'API

FHIRHub offre une API REST complète pour l'intégration avec d'autres systèmes. Consultez la documentation API pour plus de détails:

```
curl -X POST -H "Content-Type: text/plain" -H "x-api-key: dev-key" -d @exemple.hl7 http://localhost:5000/api/convert
```

### Personnalisation des mappings

Pour les utilisateurs avancés, FHIRHub permet de personnaliser certains mappings entre HL7 et FHIR:

1. Accédez à la page **Paramètres** > **Mappings avancés**
2. Sélectionnez la catégorie de mapping à modifier
3. Effectuez vos modifications
4. Cliquez sur **Enregistrer**

## Dépannage

### Messages d'erreur courants

- **"Message HL7 invalide"**: Vérifiez la structure de votre message HL7, en particulier le segment MSH
- **"Erreur de conversion"**: Un problème est survenu pendant la conversion, consultez les logs détaillés
- **"Accès refusé"**: Vérifiez vos droits d'accès ou votre clé API

### Logs système

Les administrateurs peuvent accéder aux logs système:

1. Accédez à la page **Paramètres** > **Logs système**
2. Filtrez par niveau de sévérité ou date
3. Téléchargez les logs pour analyse approfondie

## Assistance

Pour toute question technique supplémentaire, veuillez contacter votre administrateur système.

---

© 2025 FHIRHub - Tous droits réservés