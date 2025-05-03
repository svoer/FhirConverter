# Documentation Technique du Système de Terminologie de FHIRHub

## Présentation du système

Le système de gestion des terminologies de FHIRHub est conçu pour permettre la conversion précise des codes utilisés dans les messages HL7 vers les terminologies standardisées FHIR, avec un focus particulier sur les spécificités françaises requises par l'ANS (Agence du Numérique en Santé).

Ce document technique explique en détail l'implémentation interne, les mécanismes de traitement, et les procédures de mise à jour et d'extension des terminologies.

## Architecture et Organisation des Fichiers

### Structure des dossiers

```
FHIRHub/
├── french_terminology/             # Dossier principal des terminologies françaises
│   ├── ans_terminology_systems.json  # Fichier de mapping global des terminologies
│   ├── ans_oids.json                 # Mappings OID vers URI
│   ├── ans_common_codes.json         # Codes fréquemment utilisés (mise en cache)
│   ├── ans_specialites.json          # Terminologie des spécialités médicales
│   ├── ans_secteurs.json             # Terminologie des secteurs d'activité
│   └── ...                           # Autres fichiers de terminologie spécifiques
├── src/
│   ├── services/
│   │   ├── terminologyService.js     # Service principal de gestion des terminologies
│   │   └── offlineTerminologyService.js # Service de terminologie hors-ligne
│   └── terminology/
│       └── FrenchTerminologyManager.js # Gestionnaire spécifique aux terminologies FR
├── routes/
│   └── terminology.js                # Routes API pour la gestion des terminologies
├── utils/
│   └── terminologyUtils.js           # Utilitaires pour le traitement des terminologies
├── get_french_terminology.py         # Script de téléchargement des terminologies
└── extract_french_systems.py         # Script d'extraction des systèmes français
```

## Implémentation Technique du Système de Terminologie

### 1. Fichiers de Configuration Principaux

#### `french_terminology/ans_terminology_systems.json`

Ce fichier de mapping est le pivot central du système de terminologie. Il contient la correspondance entre les noms, URIs et OIDs de chaque système de terminologie.

```json
{
  "version": "20250503",
  "last_updated": "2025-05-03T14:30:24.342Z",
  "systems": {
    "TRE-R38-SpecialiteOrdinale": {
      "uri": "https://mos.esante.gouv.fr/NOS/TRE_R38-SpecialiteOrdinale/FHIR/TRE-R38-SpecialiteOrdinale",
      "oid": "1.2.250.1.213.1.1.4.5",
      "file": "ans_specialites.json"
    },
    "TRE-R02-SecteurActivite": {
      "uri": "https://mos.esante.gouv.fr/NOS/TRE_R02-SecteurActivite/FHIR/TRE-R02-SecteurActivite",
      "oid": "1.2.250.1.71.4.2.4",
      "file": "ans_secteurs.json"
    },
    // Autres systèmes...
  }
}
```

#### `french_terminology/ans_oids.json`

Ce fichier contient les mappings des OIDs (Object Identifiers) vers les URI FHIR correspondants, essentiels pour la traduction des identifiants HL7 en FHIR.

```json
{
  "oids": {
    "1.2.250.1.213.1.1.4.5": {
      "uri": "https://mos.esante.gouv.fr/NOS/TRE_R38-SpecialiteOrdinale/FHIR/TRE-R38-SpecialiteOrdinale",
      "type": "CodeSystem",
      "name": "TRE-R38-SpecialiteOrdinale"
    },
    "1.2.250.1.71.4.2.4": {
      "uri": "https://mos.esante.gouv.fr/NOS/TRE_R02-SecteurActivite/FHIR/TRE-R02-SecteurActivite",
      "type": "CodeSystem",
      "name": "TRE-R02-SecteurActivite"
    },
    "1.2.250.1.213.1.1.5.10": {
      "uri": "http://interopsante.org/fhir/CodeSystem/fr-v2-0203",
      "type": "CodeSystem",
      "name": "JDV_J65-SubjectIdentifierTypeCode-CISIS"
    },
    // Autres OIDs...
  },
  "ins_oids": [
    "1.2.250.1.213.1.4.8",
    "1.2.250.1.213.1.4.10",
    "1.2.250.1.213.1.4.11"
  ],
  "patient_id_oids": [
    "1.2.250.1.213.1.4.1.1",
    "1.2.250.1.213.1.4.1.2",
    "1.2.250.1.213.1.4.1.3"
  ]
}
```

#### `french_terminology/ans_common_codes.json`

Ce fichier de cache contient les codes les plus fréquemment utilisés pour accélérer les conversions.

```json
{
  "patient_identifier_types": {
    "INS-C": {
      "code": "INS-C",
      "display": "Identifiant National de Santé Calculé",
      "system": "http://interopsante.org/fhir/CodeSystem/fr-v2-0203"
    },
    "INS-NIR": {
      "code": "INS-NIR",
      "display": "NIR/RNIPP de l'INS",
      "system": "http://interopsante.org/fhir/CodeSystem/fr-v2-0203"
    },
    "IPP": {
      "code": "PI",
      "display": "Identifiant Patient Permanent",
      "system": "http://terminology.hl7.org/CodeSystem/v2-0203"
    }
  },
  "administrative_genders": {
    "M": {
      "code": "male",
      "system": "http://hl7.org/fhir/administrative-gender"
    },
    "F": {
      "code": "female",
      "system": "http://hl7.org/fhir/administrative-gender"
    },
    "U": {
      "code": "unknown",
      "system": "http://hl7.org/fhir/administrative-gender"
    }
  },
  // Autres groupes de codes...
}
```

### 2. Fichiers de Terminologie Spécifiques

Chaque fichier `ans_*.json` contient une terminologie spécifique avec tous ses codes, descriptions et métadonnées.

Structure type d'un fichier de terminologie:

```json
{
  "resourceType": "CodeSystem",
  "id": "TRE-R38-SpecialiteOrdinale",
  "meta": {
    "profile": ["http://hl7.org/fhir/StructureDefinition/shareablecodesystem"]
  },
  "identifier": {
    "system": "urn:ietf:rfc:3986",
    "value": "1.2.250.1.213.1.1.4.5"
  },
  "version": "1.2",
  "name": "TRE_R38-SpecialiteOrdinale",
  "title": "Spécialités Ordinales",
  "status": "active",
  "experimental": false,
  "date": "2022-09-14",
  "publisher": "ANS",
  "description": "Spécialités Ordinales",
  "content": "complete",
  "concept": [
    {
      "code": "SM01",
      "display": "Médecine générale"
    },
    {
      "code": "SM02",
      "display": "Anesthésie - Réanimation"
    },
    // Autres codes...
  ]
}
```

## Flux de Traitement des Terminologies

### 1. Initialisation du Système

Le processus d'initialisation se fait dans le fichier `src/services/terminologyService.js`:

```javascript
/**
 * Initialise le service de terminologie
 * @returns {boolean} True si l'initialisation a réussi
 */
function initialize() {
  console.log('[TERMINOLOGY] Initialisation du service de terminologie française');
  
  try {
    // Charger les systèmes de terminologie
    if (fs.existsSync(CONFIG.terminologySystemsFile)) {
      const data = fs.readFileSync(CONFIG.terminologySystemsFile, 'utf8');
      terminologySystems = JSON.parse(data);
      console.log(`[TERMINOLOGY] ${Object.keys(terminologySystems.systems).length} systèmes de terminologie chargés`);
    } else {
      console.warn(`[TERMINOLOGY] Fichier des systèmes de terminologie non trouvé: ${CONFIG.terminologySystemsFile}`);
    }
    
    // Charger les codes communs
    if (fs.existsSync(CONFIG.commonCodesFile)) {
      const data = fs.readFileSync(CONFIG.commonCodesFile, 'utf8');
      commonCodes = JSON.parse(data);
      console.log(`[TERMINOLOGY] ${Object.keys(commonCodes).length} ensembles de codes communs chargés`);
    } else {
      console.warn(`[TERMINOLOGY] Fichier des codes communs non trouvé: ${CONFIG.commonCodesFile}`);
    }
    
    // Charger les données d'OID
    if (fs.existsSync(CONFIG.oidsFile)) {
      const data = fs.readFileSync(CONFIG.oidsFile, 'utf8');
      oidData = JSON.parse(data);
      console.log(`[TERMINOLOGY] Données d'OID chargées`);
    } else {
      console.warn(`[TERMINOLOGY] Fichier des OID non trouvé: ${CONFIG.oidsFile}`);
    }
    
    return terminologySystems !== null && commonCodes !== null && oidData !== null;
  } catch (error) {
    console.error('[TERMINOLOGY] Erreur lors de l\'initialisation du service de terminologie:', error);
    return false;
  }
}
```

### 2. Conversion de Code HL7 à FHIR

Le processus de conversion d'un code HL7 vers FHIR se fait en plusieurs étapes:

```javascript
/**
 * Obtenir la représentation FHIR d'un code
 * @param {string} code - Code à convertir
 * @param {string} system - Système du code (URI ou OID)
 * @param {string} display - Affichage du code (optionnel)
 * @returns {Object} Représentation FHIR du code
 */
function getCodeableConcept(code, system, display = null) {
  // Étape 1: Vérifier s'il s'agit d'un OID et le convertir en URI si nécessaire
  if (system && system.startsWith('1.2.')) {
    system = getSystemUriFromOid(system);
  }

  // Étape 2: Vérifier si nous avons un cache pour ce code
  const cachedCodeType = findCodeTypeInCommonCodes(code, system);
  if (cachedCodeType) {
    return {
      coding: [
        {
          system: cachedCodeType.system,
          code: cachedCodeType.code,
          display: cachedCodeType.display || display
        }
      ],
      text: cachedCodeType.display || display || code
    };
  }

  // Étape 3: Rechercher dans les terminologies spécifiques
  const termInfo = findCodeInTerminology(code, system);
  if (termInfo) {
    return {
      coding: [
        {
          system: termInfo.system,
          code: termInfo.code,
          display: termInfo.display || display
        }
      ],
      text: termInfo.display || display || code
    };
  }

  // Étape 4: Si aucune correspondance n'est trouvée, utiliser les valeurs d'origine
  return {
    coding: [
      {
        system: system || 'http://terminology.hl7.org/CodeSystem/v2-0203',
        code: code,
        display: display || code
      }
    ],
    text: display || code
  };
}
```

### 3. Analyse des OIDs et Détection des Identifiants

La détection du type d'identifiant basé sur les OIDs est une fonction critique:

```javascript
/**
 * Déterminer le type d'identifiant en fonction de l'OID
 * @param {string} oid - OID du système d'identification
 * @returns {string} Type d'identifiant (INS, IPP, etc.)
 */
function getIdentifierTypeFromOid(oid) {
  // Vérifier si c'est un OID d'INS
  if (oidData.ins_oids.includes(oid)) {
    // Détecter le sous-type d'INS
    if (oid === '1.2.250.1.213.1.4.8') {
      return 'INS-NIR';
    } else if (oid === '1.2.250.1.213.1.4.10') {
      return 'INS-NIA';
    } else if (oid === '1.2.250.1.213.1.4.11') {
      return 'INS-C';
    }
    return 'INS';
  }
  
  // Vérifier si c'est un OID d'identifiant patient local
  if (oidData.patient_id_oids.includes(oid)) {
    return 'IPP';
  }
  
  // Autres types d'identifiants
  if (oid === '1.2.250.1.71.4.2.1') {
    return 'ADELI';
  } else if (oid === '1.2.250.1.71.4.2.2') {
    return 'RPPS';
  } else if (oid === '1.2.250.1.213.1.1.5') {
    return 'FINESS';
  }
  
  // Par défaut
  return 'unknown';
}
```

## Mécanisme d'Ajout et de Mise à Jour des Terminologies

### 1. Processus d'Ajout de Nouvelles Terminologies

Pour ajouter une nouvelle terminologie, le processus se déroule en 3 étapes:

#### Étape 1: Récupération des données depuis l'API de l'ANS
Cette étape est réalisée par le script `get_french_terminology.py`:

```python
def fetch_ans_terminology(url, output_file):
    """Récupérer une terminologie ANS et la sauvegarder en JSON"""
    print(f"🔄 Récupération de {url}...")
    
    try:
        response = requests.get(url, headers={"Accept": "application/json"})
        response.raise_for_status()
        
        data = response.json()
        
        # Sauvegarder le fichier JSON
        with open(output_file, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
            
        print(f"✅ Terminologie sauvegardée: {output_file}")
        return True
    except Exception as e:
        print(f"❌ Erreur lors de la récupération de {url}: {str(e)}")
        return False
```

#### Étape 2: Mise à jour du fichier de mapping global
Effectuée par la fonction `generate_mapping_file` dans `extract_french_systems.py`:

```python
def generate_mapping_file(base_dir):
    """Génère un fichier de mapping global des terminologies"""
    mapping = {
        "version": datetime.now().strftime("%Y%m%d"),
        "last_updated": datetime.now().isoformat(),
        "systems": {}
    }
    
    # Parcourir tous les fichiers JSON
    for filename in os.listdir(base_dir):
        if filename.endswith('.json') and filename.startswith('ans_'):
            try:
                with open(os.path.join(base_dir, filename), 'r', encoding='utf-8') as f:
                    data = json.load(f)
                
                system_name = data.get('name', filename.replace('.json', ''))
                system_url = data.get('url', '')
                system_oid = data.get('identifier', {}).get('value', '')
                
                mapping["systems"][system_name] = {
                    "uri": system_url,
                    "oid": system_oid,
                    "file": filename
                }
            except Exception as e:
                print(f"❌ Erreur lors du traitement de {filename}: {str(e)}")
    
    # Sauvegarder le mapping
    with open(os.path.join(base_dir, "ans_terminology_systems.json"), 'w', encoding='utf-8') as f:
        json.dump(mapping, f, ensure_ascii=False, indent=2)
```

#### Étape 3: Intégration dans le système de cache commun
Effectuée manuellement ou via un script d'extraction qui met à jour le fichier `ans_common_codes.json`.

### 2. API REST pour la Gestion des Terminologies

Les routes définies dans `routes/terminology.js` permettent la gestion des terminologies via l'API:

```javascript
// Obtenir la liste des fichiers de terminologie
router.get('/files', adminAuthMiddleware, async (req, res) => {
  try {
    const files = fs.readdirSync(TERMINOLOGY_DIR)
      .filter(file => file.endsWith('.json'))
      .map(file => {
        const stats = fs.statSync(path.join(TERMINOLOGY_DIR, file));
        return {
          name: file,
          size: stats.size,
          lastModified: stats.mtime.toISOString()
        };
      });
    
    res.json({
      success: true,
      data: files
    });
  } catch (error) {
    console.error('[API] Erreur lors de la récupération des fichiers de terminologie :', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des fichiers de terminologie'
    });
  }
});

// Télécharger un fichier de terminologie
router.get('/files/:name', adminAuthMiddleware, (req, res) => {
  const fileName = req.params.name;
  const filePath = path.join(TERMINOLOGY_DIR, fileName);
  
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({
      success: false,
      message: 'Fichier de terminologie non trouvé'
    });
  }
  
  res.download(filePath);
});

// Téléverser un fichier de terminologie
router.post('/files', adminAuthMiddleware, upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Aucun fichier n\'a été fourni'
      });
    }
    
    const fileName = req.file.filename;
    
    // Vérifier le format du fichier
    const filePath = path.join(TERMINOLOGY_DIR, fileName);
    try {
      const fileContent = fs.readFileSync(filePath, 'utf8');
      JSON.parse(fileContent); // Test de validité JSON
    } catch (e) {
      // Suppression du fichier si JSON invalide
      fs.unlinkSync(filePath);
      return res.status(400).json({
        success: false,
        message: 'Le fichier n\'est pas un JSON valide'
      });
    }
    
    res.status(201).json({
      success: true,
      message: 'Fichier de terminologie téléversé avec succès',
      file: fileName
    });
  } catch (error) {
    console.error('[API] Erreur lors du téléversement du fichier de terminologie :', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors du téléversement du fichier de terminologie'
    });
  }
});

// Supprimer un fichier de terminologie
router.delete('/files/:name', adminAuthMiddleware, (req, res) => {
  const fileName = req.params.name;
  
  // Protection des fichiers système
  if (fileName === 'ans_terminology_systems.json' || 
      fileName === 'ans_oids.json' || 
      fileName === 'ans_common_codes.json') {
    return res.status(403).json({
      success: false,
      message: 'Impossible de supprimer un fichier système protégé'
    });
  }
  
  const filePath = path.join(TERMINOLOGY_DIR, fileName);
  
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({
      success: false,
      message: 'Fichier de terminologie non trouvé'
    });
  }
  
  try {
    fs.unlinkSync(filePath);
    res.json({
      success: true,
      message: 'Fichier de terminologie supprimé avec succès'
    });
  } catch (error) {
    console.error('[API] Erreur lors de la suppression du fichier de terminologie :', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la suppression du fichier de terminologie'
    });
  }
});
```

## Usage dans le Processus de Conversion HL7 vers FHIR

### 1. Extraction des Codes du Message HL7

Lors de la conversion, les codes et identifiants sont extraits des messages HL7 suivant ce processus dans `hl7ToFhirAdvancedConverter.js`:

```javascript
/**
 * Extraire les données du segment PID
 * @param {Object} pid - Segment PID
 * @returns {Object} Données du patient
 */
function extractPatientData(pid) {
  const patient = {
    identifier: [],
    name: [],
    gender: null,
    birthDate: null,
    address: [],
    telecom: []
  };
  
  // Traitement des identifiants (PID-3)
  if (pid[3] && Array.isArray(pid[3])) {
    pid[3].forEach(id => {
      if (id && id[0]) {
        const idValue = id[0];
        const idType = id[4] ? id[4][0] : null;
        const idSystem = id[4] && id[4][2] ? id[4][2][0] : null;
        
        // Détecter le type d'identifiant spécifique français via l'OID
        const idTypeCode = terminologyService.getIdentifierTypeFromOid(idSystem);
        
        const identifier = {
          value: idValue,
          type: terminologyService.getCodeableConcept(
            idTypeCode || idType || 'PI', 
            'http://terminology.hl7.org/CodeSystem/v2-0203'
          )
        };
        
        // Ajouter le system URI basé sur l'OID
        if (idSystem) {
          identifier.system = terminologyService.getSystemUriFromOid(idSystem) || idSystem;
        }
        
        patient.identifier.push(identifier);
      }
    });
  }
  
  // Conversion du genre (PID-8)
  if (pid[8] && pid[8][0]) {
    const genderCode = pid[8][0];
    patient.gender = terminologyService.mapGenderCode(genderCode);
  }

  // Autres conversions...
  
  return patient;
}
```

### 2. Application des Concepts Codables FHIR

Les concepts codables FHIR sont créés à partir des codes HL7 via le service de terminologie:

```javascript
/**
 * Créer un objet ServiceRequest FHIR à partir d'un message ORM
 * @param {Object} order - Données de la commande
 * @returns {Object} ServiceRequest FHIR
 */
function createServiceRequest(order) {
  const request = {
    resourceType: 'ServiceRequest',
    id: `sr-${generateUUID()}`,
    status: 'active',
    intent: 'order',
    subject: {
      reference: `Patient/${order.patientId}`
    }
  };

  // Ajouter le type de procédure
  if (order.procedureCode) {
    request.code = terminologyService.getCodeableConcept(
      order.procedureCode,
      order.procedureSystem || 'http://loinc.org',
      order.procedureDisplay
    );
  }

  // Ajouter la priorité
  if (order.priority) {
    request.priority = terminologyService.mapPriorityCode(order.priority);
  }

  return request;
}
```

## Extensibilité et Personnalisation

### 1. Ajout d'une Nouvelle Terminologie Spécifique à un Client

Pour ajouter une terminologie spécifique à un client, suivez ces étapes:

1. Créez un fichier JSON dans le format standard FHIR CodeSystem dans le dossier `french_terminology/`:

```json
{
  "resourceType": "CodeSystem",
  "id": "CLIENT-SpecialCodes",
  "meta": {
    "profile": ["http://hl7.org/fhir/StructureDefinition/shareablecodesystem"]
  },
  "identifier": {
    "system": "urn:ietf:rfc:3986",
    "value": "1.2.250.1.XXX.X.X.X"
  },
  "version": "1.0",
  "name": "CLIENT_SpecialCodes",
  "title": "Codes spécifiques du client",
  "status": "active",
  "experimental": false,
  "date": "2025-05-03",
  "publisher": "Client",
  "description": "Système de codes spécifique au client",
  "content": "complete",
  "concept": [
    {
      "code": "CODE1",
      "display": "Description du code 1"
    },
    {
      "code": "CODE2",
      "display": "Description du code 2"
    }
  ]
}
```

2. Mettez à jour le fichier `ans_terminology_systems.json` pour inclure la nouvelle terminologie:

```json
{
  "systems": {
    // Systèmes existants...
    "CLIENT-SpecialCodes": {
      "uri": "http://example.com/fhir/CodeSystem/client-special-codes",
      "oid": "1.2.250.1.XXX.X.X.X",
      "file": "client_special_codes.json"
    }
  }
}
```

3. Si nécessaire, ajoutez l'OID dans le fichier `ans_oids.json`:

```json
{
  "oids": {
    // OIDs existants...
    "1.2.250.1.XXX.X.X.X": {
      "uri": "http://example.com/fhir/CodeSystem/client-special-codes",
      "type": "CodeSystem",
      "name": "CLIENT-SpecialCodes"
    }
  }
}
```

4. Pour les codes fréquemment utilisés, ajoutez-les au fichier `ans_common_codes.json`:

```json
{
  // Groupes existants...
  "client_special_codes": {
    "CODE1": {
      "code": "CODE1",
      "display": "Description du code 1",
      "system": "http://example.com/fhir/CodeSystem/client-special-codes"
    },
    "CODE2": {
      "code": "CODE2",
      "display": "Description du code 2",
      "system": "http://example.com/fhir/CodeSystem/client-special-codes"
    }
  }
}
```

### 2. Modification du Mapping d'un Code Existant

Pour modifier le mapping d'un code existant:

1. Identifiez le fichier source dans le dossier `french_terminology/`
2. Modifiez directement le code dans le fichier JSON
3. Si le code est présent dans `ans_common_codes.json`, mettez également à jour ce fichier

### 3. Ajout d'un Nouveau Type d'Identifiant

Pour ajouter un nouveau type d'identifiant reconnu par le système:

1. Ajoutez l'OID dans le fichier `ans_oids.json` dans la section appropriée:

```json
{
  "oids": {
    // OIDs existants...
  },
  "ins_oids": [
    // OIDs existants...
  ],
  "patient_id_oids": [
    // OIDs existants...
    "1.2.250.1.XXX.X.X.X"  // Nouvel OID d'identifiant patient
  ],
  "custom_id_oids": [  // Nouvelle catégorie si nécessaire
    "1.2.250.1.YYY.Y.Y.Y"
  ]
}
```

2. Ajoutez la logique de détection dans `src/services/terminologyService.js`:

```javascript
function getIdentifierTypeFromOid(oid) {
  // Vérifications existantes...
  
  // Nouveau type d'identifiant
  if (oidData.custom_id_oids && oidData.custom_id_oids.includes(oid)) {
    return 'CUSTOM_ID';
  }
  
  // Suite du code...
}
```

## Considérations de Performance

### 1. Mécanisme de Cache

Le système utilise un mécanisme de cache à plusieurs niveaux:

1. **Cache mémoire**: Les terminologies fréquemment utilisées sont chargées en mémoire au démarrage
2. **Cache permanent**: Le fichier `ans_common_codes.json` contient les codes les plus utilisés
3. **Chargement paresseux**: Les fichiers de terminologie volumineux ne sont chargés que lorsqu'ils sont nécessaires

### 2. Optimisations de Recherche

Le service de terminologie utilise plusieurs optimisations pour accélérer les recherches:

```javascript
/**
 * Rechercher un code dans une terminologie
 * @param {string} code - Code à rechercher
 * @param {string} system - Système du code
 * @returns {Object|null} Information sur le code trouvé
 */
function findCodeInTerminology(code, system) {
  // Vérifier dans les codes communs d'abord (cache)
  const commonCode = findCodeInCommonCodes(code, system);
  if (commonCode) {
    return commonCode;
  }
  
  // Si pas de système spécifié, chercher dans tous les systèmes
  if (!system) {
    for (const systemName in terminologySystems.systems) {
      const foundCode = findCodeInSpecificSystem(code, systemName);
      if (foundCode) {
        return foundCode;
      }
    }
    return null;
  }
  
  // Si système spécifié par URI
  for (const systemName in terminologySystems.systems) {
    const sysInfo = terminologySystems.systems[systemName];
    if (sysInfo.uri === system) {
      return findCodeInSpecificSystem(code, systemName);
    }
  }
  
  // Si système spécifié par OID
  if (system.startsWith('1.2.')) {
    const uri = getSystemUriFromOid(system);
    if (uri) {
      return findCodeInTerminology(code, uri);
    }
  }
  
  return null;
}
```

## Sécurité et Validation

### 1. Validation des Terminologies Téléversées

Avant d'intégrer une nouvelle terminologie, le système vérifie son intégrité:

```javascript
// Vérifier le format du fichier
const filePath = path.join(TERMINOLOGY_DIR, fileName);
try {
  const fileContent = fs.readFileSync(filePath, 'utf8');
  const jsonContent = JSON.parse(fileContent); // Test de validité JSON
  
  // Vérifier que c'est un objet FHIR valide
  if (!jsonContent.resourceType || 
      (jsonContent.resourceType !== 'CodeSystem' && jsonContent.resourceType !== 'ValueSet')) {
    throw new Error('Format FHIR invalide');
  }
} catch (e) {
  // Suppression du fichier si JSON invalide
  fs.unlinkSync(filePath);
  return res.status(400).json({
    success: false,
    message: 'Le fichier n\'est pas une terminologie FHIR valide'
  });
}
```

### 2. Protection des Fichiers Système

Le système empêche la suppression des fichiers critiques:

```javascript
// Protection des fichiers système
if (fileName === 'ans_terminology_systems.json' || 
    fileName === 'ans_oids.json' || 
    fileName === 'ans_common_codes.json') {
  return res.status(403).json({
    success: false,
    message: 'Impossible de supprimer un fichier système protégé'
  });
}
```

## Dépannage et Diagnostic

### 1. Journalisation Détaillée

Le système intègre une journalisation détaillée pour faciliter le diagnostic:

```javascript
/**
 * Recherche un code dans toutes les terminologies
 * @param {string} code - Code à rechercher 
 * @returns {Object} Résultat de la recherche avec détails
 */
function searchCodeInAllTerminologies(code) {
  console.log(`[TERMINOLOGY] Recherche exhaustive du code ${code} dans toutes les terminologies`);
  
  const results = {
    code: code,
    matches: []
  };
  
  // Rechercher dans tous les systèmes
  for (const systemName in terminologySystems.systems) {
    const sysInfo = terminologySystems.systems[systemName];
    console.log(`[TERMINOLOGY] Recherche dans ${systemName}...`);
    
    try {
      const filePath = path.join(CONFIG.terminologyDir, sysInfo.file);
      if (fs.existsSync(filePath)) {
        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        
        if (data.concept && Array.isArray(data.concept)) {
          const matchingConcept = data.concept.find(c => c.code === code);
          
          if (matchingConcept) {
            console.log(`[TERMINOLOGY] Code ${code} trouvé dans ${systemName}`);
            results.matches.push({
              system: systemName,
              uri: sysInfo.uri,
              oid: sysInfo.oid,
              display: matchingConcept.display,
              definition: matchingConcept.definition
            });
          }
        }
      } else {
        console.warn(`[TERMINOLOGY] Fichier non trouvé pour ${systemName}: ${sysInfo.file}`);
      }
    } catch (error) {
      console.error(`[TERMINOLOGY] Erreur lors de la recherche dans ${systemName}:`, error);
    }
  }
  
  console.log(`[TERMINOLOGY] Recherche terminée, ${results.matches.length} correspondances trouvées`);
  return results;
}
```

### 2. Outils de Diagnostic

Le système inclut une API de diagnostic pour vérifier les terminologies:

```javascript
/**
 * Vérifier l'intégrité des fichiers de terminologie
 * @returns {Object} Résultat de la vérification
 */
function checkTerminologyIntegrity() {
  const result = {
    status: 'success',
    errors: [],
    warnings: [],
    files: {
      total: 0,
      valid: 0,
      invalid: 0
    },
    systems: {
      total: 0,
      missing_files: []
    }
  };
  
  // Vérifier les fichiers principaux
  const requiredFiles = [
    CONFIG.terminologySystemsFile,
    CONFIG.oidsFile,
    CONFIG.commonCodesFile
  ];
  
  for (const file of requiredFiles) {
    if (!fs.existsSync(file)) {
      result.status = 'error';
      result.errors.push(`Fichier système requis manquant: ${path.basename(file)}`);
    }
  }
  
  // Vérifier tous les fichiers de terminologie
  if (fs.existsSync(CONFIG.terminologyDir)) {
    const files = fs.readdirSync(CONFIG.terminologyDir)
      .filter(file => file.endsWith('.json'));
    
    result.files.total = files.length;
    
    for (const file of files) {
      const filePath = path.join(CONFIG.terminologyDir, file);
      try {
        const content = fs.readFileSync(filePath, 'utf8');
        JSON.parse(content); // Vérifier si JSON valide
        result.files.valid++;
      } catch (error) {
        result.files.invalid++;
        result.errors.push(`Fichier JSON invalide: ${file}`);
      }
    }
  } else {
    result.status = 'error';
    result.errors.push(`Répertoire de terminologie manquant: ${CONFIG.terminologyDir}`);
  }
  
  // Vérifier les références aux fichiers dans ans_terminology_systems.json
  if (fs.existsSync(CONFIG.terminologySystemsFile)) {
    try {
      const systems = JSON.parse(fs.readFileSync(CONFIG.terminologySystemsFile, 'utf8'));
      
      if (systems.systems) {
        result.systems.total = Object.keys(systems.systems).length;
        
        for (const sysName in systems.systems) {
          const sysInfo = systems.systems[sysName];
          const filePath = path.join(CONFIG.terminologyDir, sysInfo.file);
          
          if (!fs.existsSync(filePath)) {
            result.systems.missing_files.push(sysInfo.file);
            result.warnings.push(`Fichier référencé manquant: ${sysInfo.file} pour le système ${sysName}`);
          }
        }
      }
    } catch (error) {
      result.status = 'error';
      result.errors.push(`Erreur lors de la lecture de ans_terminology_systems.json: ${error.message}`);
    }
  }
  
  return result;
}
```

## Conclusion

Le système de terminologie de FHIRHub fournit une infrastructure robuste, extensible et performante pour gérer les conversions de codes entre HL7 et FHIR, avec un support spécifique pour les terminologies françaises de l'ANS.

Cette documentation offre une vue complète de l'architecture, de l'implémentation et des processus permettant d'ajouter, de modifier et de maintenir les terminologies dans le système, offrant ainsi la flexibilité nécessaire pour adapter FHIRHub aux besoins spécifiques de chaque client.