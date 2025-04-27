# Problèmes connus - FHIRHub 1.0.0

Ce document liste les problèmes connus de la version actuelle de FHIRHub ainsi que les solutions de contournement recommandées.

## Conversion HL7 vers FHIR

### 1. Segments répétés avec identifiants complexes

**Problème**: Certains messages HL7 contenant des segments répétés avec des identifiants complexes imbriqués peuvent générer des références incorrectes dans le bundle FHIR.

**Solution**: Vérifiez que vos messages HL7 suivent strictement la norme HL7 v2.5 et que les segments répétés utilisent correctement les indices de répétition.

### 2. Caractères spéciaux dans les commentaires

**Problème**: Les caractères spéciaux (comme `|`, `^`, `~`) présents dans les champs de commentaires peuvent parfois être mal interprétés s'ils ne sont pas correctement échappés.

**Solution**: Assurez-vous que les caractères spéciaux dans les champs de texte libre sont correctement échappés selon la norme HL7 v2.5.

### 3. Traitement des dates historiques

**Problème**: Les dates antérieures à 1900 peuvent être incorrectement converties dans certains cas.

**Solution**: Pour les dates historiques, utilisez le format complet AAAAMMJJ au lieu du format court AAMMJJ.

## Interface utilisateur

### 1. Affichage sur certains navigateurs

**Problème**: Sur Safari Mobile, certains éléments de l'interface peuvent présenter des problèmes d'alignement.

**Solution**: Utilisez Chrome ou Firefox pour une expérience optimale.

### 2. Exportation PDF sur petits écrans

**Problème**: L'exportation en PDF peut générer des documents mal formatés sur les écrans de petite taille.

**Solution**: Ajustez la taille de la fenêtre du navigateur avant d'exporter, ou utilisez l'option "Taille d'impression" dans les paramètres d'impression.

## Performance

### 1. Traitement de très grands messages

**Problème**: Les messages HL7 de plus de 2 Mo peuvent entraîner des ralentissements sur certaines configurations.

**Solution**: Divisez les grands messages en plusieurs fichiers plus petits pour un traitement plus efficace.

### 2. Utilisation intensive de la mémoire

**Problème**: Une utilisation intensive sur de longues périodes peut entraîner une consommation croissante de mémoire.

**Solution**: Redémarrez périodiquement le serveur lors de sessions d'utilisation prolongées ou intensives.

## Terminologies françaises

### 1. Codes obsolètes

**Problème**: Certains codes obsolètes des terminologies françaises peuvent ne pas être correctement identifiés comme tels.

**Solution**: Vérifiez manuellement les codes rares ou potentiellement obsolètes en consultant la documentation de l'ANS.

### 2. OIDs personnalisés

**Problème**: Les OIDs personnalisés non standard peuvent ne pas être correctement gérés par le système.

**Solution**: Utilisez les OIDs standards définis par l'ANS pour assurer une compatibilité optimale.

## Sécurité et authentification

### 1. Sessions prolongées

**Problème**: Les sessions très longues peuvent rester actives même après inactivité.

**Solution**: Déconnectez-vous manuellement lorsque vous avez terminé d'utiliser l'application.

## Rapports et problèmes

Si vous rencontrez d'autres problèmes non listés ici, veuillez les signaler à votre administrateur système en fournissant:

1. Une description détaillée du problème
2. Les étapes pour reproduire le problème
3. Des captures d'écran si possible
4. Les logs système pertinents (pour les administrateurs)