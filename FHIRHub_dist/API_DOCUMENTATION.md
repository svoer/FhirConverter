# Documentation API - FHIRHub 1.0.0

## Introduction

L'API REST de FHIRHub permet d'intégrer les fonctionnalités de conversion HL7 vers FHIR dans vos applications. Cette API est sécurisée par clé et supporte à la fois le contenu texte (HL7 brut) et les fichiers.

## Authentification

Toutes les requêtes API nécessitent une clé API valide, qui doit être fournie dans l'en-tête HTTP `x-api-key`.

Exemple:
```
x-api-key: dev-key
```

Par défaut, la clé de développement `dev-key` est activée. En production, il est fortement recommandé de créer de nouvelles clés via l'interface d'administration.

## Endpoints

### Vérifier l'état du serveur

```
GET /api/status
```

#### Réponse

```json
{
  "status": "ok",
  "version": "1.0.0",
  "uptime": "10h 32m",
  "conversions": 152
}
```

### Convertir du contenu HL7 en FHIR

```
POST /api/convert
Content-Type: text/plain
```

#### Corps de la requête
Contenu HL7 v2.5 brut

#### Réponse

```json
{
  "id": "8cd57ec3-f907-4428-8a6f-90c4c3bdabea",
  "timestamp": "2025-04-27T12:34:56.789Z",
  "source": "hl7",
  "sourceSize": 1024,
  "resourceCount": 8,
  "resources": [
    {
      "resourceType": "Patient",
      "id": "123456"
    },
    {
      "resourceType": "Encounter",
      "id": "789012"
    }
  ],
  "bundle": {
    "resourceType": "Bundle",
    "type": "transaction",
    "id": "8cd57ec3-f907-4428-8a6f-90c4c3bdabea",
    "entry": [...]
  }
}
```

### Télécharger et convertir un fichier HL7

```
POST /api/upload
Content-Type: multipart/form-data
```

#### Paramètres
- `file`: Fichier HL7 à convertir

#### Réponse
Même format que l'endpoint `/api/convert`

### Obtenir l'historique des conversions

```
GET /api/conversions
```

#### Paramètres de requête
- `limit`: Nombre maximum de résultats (défaut: 20)
- `offset`: Décalage pour la pagination (défaut: 0)

#### Réponse

```json
{
  "total": 152,
  "limit": 20,
  "offset": 0,
  "conversions": [
    {
      "id": "8cd57ec3-f907-4428-8a6f-90c4c3bdabea",
      "timestamp": "2025-04-27T12:34:56.789Z",
      "source": "hl7",
      "resourceCount": 8,
      "status": "success"
    },
    ...
  ]
}
```

### Obtenir une conversion spécifique

```
GET /api/conversions/:id
```

#### Paramètres de chemin
- `id`: Identifiant unique de la conversion

#### Réponse
Détails complets de la conversion, incluant le résultat FHIR

### Obtenir les statistiques de conversion

```
GET /api/stats
```

#### Réponse

```json
{
  "totalConversions": 152,
  "successRate": 98.5,
  "averageResourceCount": 7.2,
  "conversionsByDay": {
    "2025-04-26": 45,
    "2025-04-27": 107
  },
  "topResourceTypes": {
    "Patient": 152,
    "Encounter": 149,
    "Practitioner": 130
  }
}
```

### Récupérer un système de code par son identifiant

```
GET /api/terminology/codesystem/:id
```

#### Paramètres de chemin
- `id`: Identifiant du système (ex: TRE-R316-AutreCategorieEtablissement)

#### Réponse
Détails du système de code au format FHIR CodeSystem

### Rechercher dans les systèmes de terminologie

```
GET /api/terminology/search
```

#### Paramètres de requête
- `query`: Texte de recherche
- `type`: Type de système (optional)

#### Réponse
Liste des systèmes de terminologie correspondant aux critères

## Gestion des erreurs

Toutes les erreurs retournent un code HTTP approprié et un objet JSON avec les détails:

```json
{
  "error": true,
  "code": "INVALID_HL7",
  "message": "Message HL7 invalide: Segment MSH manquant",
  "details": "Le message fourni ne contient pas de segment MSH valide."
}
```

## Limites

- Taille maximale de fichier: 10 Mo
- Limite de requêtes: 100 par minute par clé API
- Durée de conservation des conversions: 30 jours

## Exemples d'utilisation

### Curl

```bash
# Convertir un message HL7 depuis un fichier
curl -X POST \
  -H "Content-Type: text/plain" \
  -H "x-api-key: dev-key" \
  --data-binary @exemple.hl7 \
  http://localhost:5000/api/convert
```

### JavaScript (Node.js)

```javascript
const axios = require('axios');
const fs = require('fs');

const hl7Content = fs.readFileSync('exemple.hl7', 'utf8');

axios.post('http://localhost:5000/api/convert', hl7Content, {
  headers: {
    'Content-Type': 'text/plain',
    'x-api-key': 'dev-key'
  }
})
.then(response => {
  console.log('Conversion réussie:', response.data);
})
.catch(error => {
  console.error('Erreur:', error.response?.data || error.message);
});
```

### Python

```python
import requests

with open('exemple.hl7', 'r') as file:
    hl7_content = file.read()

headers = {
    'Content-Type': 'text/plain',
    'x-api-key': 'dev-key'
}

response = requests.post('http://localhost:5000/api/convert', 
                        data=hl7_content, 
                        headers=headers)

if response.status_code == 200:
    print('Conversion réussie:', response.json())
else:
    print('Erreur:', response.json())
```