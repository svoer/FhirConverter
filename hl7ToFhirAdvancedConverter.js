/**
 * Convertisseur avancé HL7 v2.5 vers FHIR R4
 * Spécialement optimisé pour les messages ADT français
 * Compatible avec les exigences de l'ANS
 * 
 * Utilise simple-hl7 pour le parsing avancé des messages HL7
 * et fhir.js pour la manipulation des ressources FHIR
 */

const uuid = require('uuid');
const hl7 = require('simple-hl7');

/**
 * Convertit un message HL7 en bundle FHIR
 * @param {string} hl7Message - Message HL7 au format texte
 * @returns {Object} Bundle FHIR au format R4
 */
function convertHL7ToFHIR(hl7Message) {
  try {
    console.log('[CONVERTER] Démarrage de la conversion HL7 vers FHIR');
    
    // Parser le message HL7 avec simple-hl7
    // Format du message à analyser
    // 1. Remplacer \n par \r si nécessaire pour obtenir un format valide
    const normalizedMessage = hl7Message.replace(/\n/g, '\r');
    
    // 2. Créer le parser et parser le message
    const parser = new hl7.Parser();
    const parsedMessage = parser.parse(normalizedMessage);
    
    // 3. Vérifier la validité du message parsé
    if (!parsedMessage) {
      throw new Error('Message HL7 invalide ou vide');
    }
    
    console.log('[CONVERTER] Structure parsée:', JSON.stringify(parsedMessage).substring(0, 100) + '...');
    
    // 4. Extraire les segments du message
    const segments = {};
    // Extraire le segment MSH
    if (parsedMessage.header && parsedMessage.header.name === 'MSH') {
      if (!segments['MSH']) segments['MSH'] = [];
      segments['MSH'].push(parsedMessage.header);
    }
    
    // Extraire les autres segments
    if (parsedMessage.segments && Array.isArray(parsedMessage.segments)) {
      parsedMessage.segments.forEach(segment => {
        const segmentName = segment.name;
        if (!segments[segmentName]) {
          segments[segmentName] = [];
        }
        segments[segmentName].push(segment);
      });
    }
    
    console.log(`[CONVERTER] Message HL7 parsé avec succès: ${Object.keys(segments).length} types de segments`);
    
    // Créer un identifiant unique pour le Bundle
    const bundleId = `bundle-${Date.now()}`;
    
    // Créer le Bundle FHIR
    const bundle = {
      resourceType: 'Bundle',
      id: bundleId,
      type: 'transaction',
      timestamp: new Date().toISOString(),
      entry: []
    };
    
    // Patient (à partir du segment PID)
    if (segments.PID && segments.PID.length > 0) {
      const patientResource = createPatientResource(segments.PID[0], segments.PD1 ? segments.PD1[0] : null);
      bundle.entry.push(patientResource);
      
      // Encounter (à partir du segment PV1)
      if (segments.PV1 && segments.PV1.length > 0) {
        const encounterResource = createEncounterResource(segments.PV1[0], patientResource.fullUrl);
        bundle.entry.push(encounterResource);
      }
      
      // Organisation (à partir du segment MSH)
      if (segments.MSH && segments.MSH.length > 0) {
        const sendingOrganizationResource = createOrganizationResource(segments.MSH[0], 4); // Sending facility
        if (sendingOrganizationResource) {
          bundle.entry.push(sendingOrganizationResource);
        }
        
        const receivingOrganizationResource = createOrganizationResource(segments.MSH[0], 6); // Receiving facility
        if (receivingOrganizationResource && 
            (!sendingOrganizationResource || 
             sendingOrganizationResource.resource.id !== receivingOrganizationResource.resource.id)) {
          bundle.entry.push(receivingOrganizationResource);
        }
      }
      
      // Praticiens (à partir des segments ROL)
      if (segments.ROL && segments.ROL.length > 0) {
        segments.ROL.forEach(rolSegment => {
          const practitionerResource = createPractitionerResource(rolSegment);
          if (practitionerResource) {
            bundle.entry.push(practitionerResource);
            
            // Créer aussi le PractitionerRole si un encounter existe
            if (segments.PV1 && segments.PV1.length > 0) {
              const practitionerRoleResource = createPractitionerRoleResource(
                rolSegment, 
                practitionerResource.fullUrl, 
                `urn:uuid:encounter-${Date.now()}`
              );
              if (practitionerRoleResource) {
                bundle.entry.push(practitionerRoleResource);
              }
            }
          }
        });
      }
      
      // Proches (à partir des segments NK1)
      if (segments.NK1 && segments.NK1.length > 0) {
        segments.NK1.forEach(nk1Segment => {
          const relatedPersonResource = createRelatedPersonResource(nk1Segment, patientResource.fullUrl);
          if (relatedPersonResource) {
            bundle.entry.push(relatedPersonResource);
          }
        });
      }
      
      // Couverture d'assurance (à partir des segments IN1/IN2)
      if (segments.IN1 && segments.IN1.length > 0) {
        segments.IN1.forEach((in1Segment, index) => {
          const in2Segment = segments.IN2 && segments.IN2.length > index ? segments.IN2[index] : null;
          const coverageResource = createCoverageResource(in1Segment, in2Segment, patientResource.fullUrl);
          if (coverageResource) {
            bundle.entry.push(coverageResource);
          }
        });
      }
      
      // Traitement des segments Z (spécifiques français)
      // Ces segments peuvent contenir des informations essentielles pour le contexte français
      
      // ZBE - Mouvement hospitalier selon spécifications françaises
      if (segments.ZBE && segments.ZBE.length > 0) {
        const zbeData = processZBESegment(segments.ZBE[0]);
        
        // Si nous avons un encounter et des données ZBE, enrichir l'encounter
        const encounterEntry = bundle.entry.find(e => e.resource && e.resource.resourceType === 'Encounter');
        if (encounterEntry && zbeData) {
          // Ajouter les extensions ANS pour le mouvement hospitalier
          if (!encounterEntry.resource.extension) {
            encounterEntry.resource.extension = [];
          }
          
          // Extension pour le type de mouvement (entrée, sortie, mutation)
          if (zbeData.movementType) {
            encounterEntry.resource.extension.push({
              url: 'https://interop.esante.gouv.fr/ig/fhir/core/StructureDefinition/healthevent-type',
              valueCodeableConcept: {
                coding: [{
                  system: 'https://mos.esante.gouv.fr/NOS/TRE_R305-TypeRencontre/FHIR/TRE-R305-TypeRencontre',
                  code: zbeData.movementType,
                  display: getMovementTypeDisplay(zbeData.movementType)
                }]
              }
            });
          }
          
          // Extension pour l'identifiant du mouvement
          if (zbeData.movementId) {
            encounterEntry.resource.extension.push({
              url: 'https://interop.esante.gouv.fr/ig/fhir/core/StructureDefinition/healthevent-identifier',
              valueIdentifier: {
                system: 'urn:oid:1.2.250.1.71.4.2.1',
                value: zbeData.movementId
              }
            });
          }
          
          // Extension pour l'unité fonctionnelle
          if (zbeData.functionalUnit) {
            encounterEntry.resource.serviceProvider = {
              identifier: {
                system: 'urn:oid:1.2.250.1.71.4.2.2',
                value: zbeData.functionalUnit
              },
              display: zbeData.functionalUnitDisplay || 'Unité fonctionnelle'
            };
          }
        }
      }
      
      // ZFP - Informations sur le séjour du patient selon spécifications françaises
      if (segments.ZFP && segments.ZFP.length > 0) {
        const zfpData = processZFPSegment(segments.ZFP[0]);
        
        // Enrichir le patient avec des informations de séjour si disponibles
        const patientEntry = bundle.entry.find(e => e.resource && e.resource.resourceType === 'Patient');
        if (patientEntry && zfpData) {
          // Ajouter des extensions françaises au patient
          if (!patientEntry.resource.extension) {
            patientEntry.resource.extension = [];
          }
          
          // Ajouter des informations spécifiques selon les données ZFP disponibles
          // Implémentation selon les besoins spécifiques
        }
      }
      
      // ZFV - Informations de visite/séjour selon spécifications françaises
      if (segments.ZFV && segments.ZFV.length > 0) {
        const zfvData = processZFVSegment(segments.ZFV[0]);
        
        // Enrichir l'encounter avec des informations de visite
        const encounterEntry = bundle.entry.find(e => e.resource && e.resource.resourceType === 'Encounter');
        if (encounterEntry && zfvData) {
          // Compléter l'encounter avec des informations françaises spécifiques
          if (zfvData.encounterClass) {
            encounterEntry.resource.class = zfvData.encounterClass;
          }
          
          if (zfvData.priorityCode) {
            encounterEntry.resource.priority = {
              coding: [{
                system: 'https://mos.esante.gouv.fr/NOS/TRE_R213-ModePriseEnCharge/FHIR/TRE-R213-ModePriseEnCharge',
                code: zfvData.priorityCode,
                display: zfvData.priorityDisplay || 'Mode de prise en charge'
              }]
            };
          }
        }
      }
      
      // ZFM - Information médicale française
      if (segments.ZFM && segments.ZFM.length > 0) {
        const zfmData = processZFMSegment(segments.ZFM[0]);
        
        // Utiliser les données ZFM pour enrichir le bundle avec des informations médicales françaises
        // Par exemple, ajouter des Conditions, des Observations, etc.
        if (zfmData && Object.keys(zfmData).length > 0) {
          // Implémentation selon besoins spécifiques
          // Les segments ZFM peuvent contenir des informations importantes pour le contexte clinique français
        }
      }
    }
    
    console.log(`[CONVERTER] Conversion terminée avec ${bundle.entry.length} ressources FHIR générées`);
    return bundle;
  } catch (error) {
    console.error('[CONVERTER] Erreur lors de la conversion:', error);
    throw error;
  }
}

/**
 * Crée une ressource Patient FHIR à partir du segment PID
 * @param {Object} pidSegment - Segment PID parsé
 * @param {Object} pd1Segment - Segment PD1 parsé (optionnel)
 * @returns {Object} Entrée de bundle pour un Patient
 */
function createPatientResource(pidSegment, pd1Segment) {
  // PID-3 (Patient Identifiers)
  const patientIdentifiers = extractIdentifiers(pidSegment.fields[3]);
  
  // Extraction d'un ID simple pour l'URI
  let patientId = `patient-${Date.now()}`;
  if (patientIdentifiers.length > 0 && patientIdentifiers[0].value) {
    patientId = `patient-${patientIdentifiers[0].value}`;
  }
  
  // Créer la ressource Patient
  const patientResource = {
    resourceType: 'Patient',
    id: patientId,
    identifier: patientIdentifiers,
    name: extractNames(pidSegment.fields[5]),
    gender: determineGender(pidSegment.fields[8]),
    birthDate: formatBirthDate(pidSegment.fields[7]),
    telecom: extractTelecoms(pidSegment.fields[13], pidSegment.fields[14]),
    address: extractAddresses(pidSegment.fields[11]),
    maritalStatus: determineMaritalStatus(pidSegment.fields[16]),
    contact: []
  };
  
  // Ajouter les extensions françaises si PD1 est disponible
  if (pd1Segment) {
    addFrenchExtensions(patientResource, pd1Segment);
  }
  
  return {
    fullUrl: `urn:uuid:${patientId}`,
    resource: patientResource,
    request: {
      method: 'POST',
      url: 'Patient'
    }
  };
}

/**
 * Extrait les identifiants du patient à partir du champ PID-3
 * @param {Array} identifierFields - Tableau de champs d'identifiants
 * @returns {Array} Tableau d'identifiants FHIR
 */
function extractIdentifiers(identifierFields) {
  if (!identifierFields || !Array.isArray(identifierFields)) {
    return [];
  }
  
  const identifiers = [];
  
  identifierFields.forEach(field => {
    if (!field) return;
    
    const components = field.components || [];
    
    // ID (component 1)
    const idValue = components[0] ? components[0].value : '';
    if (!idValue) return;
    
    // Type d'identifiant (component 5)
    const idType = components[4] ? components[4].value : 'PI';
    
    // Autorité d'assignation (component 4)
    const assigningAuthority = components[3] ? components[3].value : '';
    
    // Configuration standard conforme à l'ANS
    let system = '';
    let isOfficialIdentifier = false;
    let officialType = '';
    
    // Analyse détaillée de l'assigningAuthority pour extraire l'OID conforme ANS
    if (assigningAuthority) {
      // Format: NAME&OID&TYPE - Extraction précise des sous-composants
      const authComponents = assigningAuthority.split('&');
      
      if (authComponents.length >= 2) {
        const namespaceName = authComponents[0] || '';
        const oid = authComponents[1] || '';
        const namespaceType = authComponents.length > 2 ? authComponents[2] : '';
        
        // Standardisation des OIDs selon ANS
        if (oid) {
          // Format conforme ANS qui utilise urn:oid: pour les identifiants standards
          system = `urn:oid:${oid}`;
          
          // Détection et traitement spécifiques pour les identifiants français officiels
          if (namespaceName.includes('ASIP-SANTE-INS-C') || oid === '1.2.250.1.213.1.4.2') {
            isOfficialIdentifier = true;
            officialType = 'INS-C';
          } else if (namespaceName.includes('ASIP-SANTE-INS-NIR') || namespaceName.includes('ASIP-SANTE-INS') || oid === '1.2.250.1.213.1.4.8') {
            isOfficialIdentifier = true;
            officialType = 'INS';
          } else if (oid.startsWith('1.2.250.1.71.') || oid.startsWith('1.2.250.1.213.')) {
            // Autres OIDs ANS standards
            isOfficialIdentifier = true;
          }
        } else if (namespaceName) {
          // Fallback pour les systèmes non standards
          system = `urn:system:${namespaceName}`;
        }
      } else {
        // Si le format n'inclut pas les sous-composants, utiliser comme système
        system = `urn:system:${assigningAuthority}`;
      }
    }
    
    // Valeurs par défaut si non spécifiés
    if (!system) {
      system = 'urn:system:unknown';
    }
    
    // Créer l'identifiant FHIR avec la structure conforme ANS
    const identifier = {
      value: idValue,
      system: system,
      assigner: assigningAuthority ? { display: assigningAuthority.split('&')[0] } : undefined
    };
    
    // Application du typage conforme ANS
    if (isOfficialIdentifier) {
      if (officialType === 'INS') {
        // Structure d'identifiant INS selon le cadre d'interopérabilité ANS
        identifier.system = 'urn:oid:1.2.250.1.213.1.4.8';
        identifier.type = {
          coding: [{
            system: 'http://terminology.hl7.org/CodeSystem/v2-0203',
            code: 'INS',
            display: 'Identifiant National de Santé'
          }]
        };
        
        // Ajout de l'extension de validité INS
        identifier.extension = [{
          url: 'https://apifhir.annuaire.sante.fr/ws-sync/exposed/structuredefinition/INS-Status',
          valueCode: 'VALI' // VALI=validé, PROV=provisoire, REFU=refusé
        }];
      } else if (officialType === 'INS-C') {
        // Structure d'identifiant INS-C selon le cadre d'interopérabilité ANS
        identifier.system = 'urn:oid:1.2.250.1.213.1.4.2';
        identifier.type = {
          coding: [{
            system: 'http://terminology.hl7.org/CodeSystem/v2-0203',
            code: 'INS-C',
            display: 'Identifiant National de Santé Calculé'
          }]
        };
      } else {
        // Autres identifiants officiels français
        identifier.type = {
          coding: [{
            system: 'http://terminology.hl7.org/CodeSystem/v2-0203',
            code: idType,
            display: getIdentifierTypeDisplay(idType)
          }]
        };
      }
    } else {
      // Identifiants non-officiels
      identifier.type = {
        coding: [{
          system: 'http://terminology.hl7.org/CodeSystem/v2-0203',
          code: idType,
          display: getIdentifierTypeDisplay(idType)
        }]
      };
    }
    
    identifiers.push(identifier);
  });
  
  return identifiers;
}

/**
 * Récupère le libellé pour un type d'identifiant
 * @param {string} idType - Code du type d'identifiant
 * @returns {string} Libellé du type d'identifiant
 */
function getIdentifierTypeDisplay(idType) {
  const typeMap = {
    'PI': 'Patient internal identifier',
    'PPN': 'Passport number',
    'MR': 'Medical record number',
    'INS': 'Identifiant National de Santé',
    'INS-C': 'Identifiant National de Santé Calculé',
    'NI': 'National identifier',
    'NH': 'Numéro d\'hospitalisation'
  };
  
  return typeMap[idType] || idType;
}

/**
 * Extrait les noms du patient à partir du champ PID-5
 * @param {Array} nameFields - Tableau de champs de noms
 * @returns {Array} Tableau de noms FHIR
 */
function extractNames(nameFields) {
  if (!nameFields || !Array.isArray(nameFields)) {
    return [];
  }
  
  const names = [];
  
  nameFields.forEach(field => {
    if (!field) return;
    
    const components = field.components || [];
    
    // Nom de famille (component 1)
    const familyName = components[0] ? components[0].value : '';
    
    // Prénom(s) (composants 2+)
    const givenNames = [];
    
    // Prénom principal (component 2)
    if (components[1] && components[1].value) {
      if (components[1].value.includes(' ')) {
        // Gérer les prénoms composés à la française
        givenNames.push(...components[1].value.split(' ').filter(Boolean));
      } else {
        givenNames.push(components[1].value);
      }
    }
    
    // Prénom additionnel (component 3)
    if (components[2] && components[2].value) {
      if (components[2].value.includes(' ')) {
        // Gérer les prénoms composés additionnels
        components[2].value.split(' ').filter(Boolean).forEach(name => {
          if (!givenNames.includes(name)) {
            givenNames.push(name);
          }
        });
      } else if (!givenNames.includes(components[2].value)) {
        givenNames.push(components[2].value);
      }
    }
    
    // Type d'utilisation du nom (component 7)
    let nameUse = 'official';
    if (components[6] && components[6].value) {
      nameUse = mapNameUseToFHIR(components[6].value);
    }
    
    if (familyName || givenNames.length > 0) {
      const nameObj = {
        use: nameUse
      };
      
      if (familyName) {
        nameObj.family = familyName;
      }
      
      if (givenNames.length > 0) {
        nameObj.given = givenNames;
      }
      
      // Préfixe (titre) si disponible (component 5)
      if (components[4] && components[4].value) {
        nameObj.prefix = [components[4].value];
      }
      
      // Suffixe si disponible (component 6)
      if (components[5] && components[5].value) {
        nameObj.suffix = [components[5].value];
      }
      
      names.push(nameObj);
    }
  });
  
  return names;
}

/**
 * Mappe le code d'utilisation du nom HL7 vers FHIR
 * @param {string} hl7NameUse - Code d'utilisation du nom HL7
 * @returns {string} Code d'utilisation du nom FHIR
 */
function mapNameUseToFHIR(hl7NameUse) {
  const nameUseMap = {
    'L': 'official', // Legal
    'D': 'usual',    // Display
    'M': 'maiden',   // Maiden
    'N': 'nickname', // Nickname
    'S': 'anonymous',// Pseudonym
    'A': 'anonymous',// Alias
    'I': 'old'       // Licence
  };
  
  return nameUseMap[hl7NameUse] || 'official';
}

/**
 * Détermine le genre du patient à partir du champ PID-8
 * @param {Object} genderField - Champ de genre
 * @returns {string} Genre FHIR
 */
function determineGender(genderField) {
  if (!genderField || !genderField.value) {
    return 'unknown';
  }
  
  const gender = genderField.value.toUpperCase();
  
  switch (gender) {
    case 'M':
      return 'male';
    case 'F':
      return 'female';
    case 'O':
      return 'other';
    case 'A':
      return 'other'; // Ambiguous
    case 'U':
      return 'unknown';
    default:
      return 'unknown';
  }
}

/**
 * Formate la date de naissance à partir du champ PID-7
 * @param {Object} birthDateField - Champ de date de naissance
 * @returns {string} Date de naissance au format YYYY-MM-DD
 */
function formatBirthDate(birthDateField) {
  if (!birthDateField || !birthDateField.value) {
    return null;
  }
  
  const dateValue = birthDateField.value;
  
  // Format attendu: YYYYMMDD ou YYYYMMDDHHMMSS
  if (/^\d{8}/.test(dateValue)) {
    const year = dateValue.substring(0, 4);
    const month = dateValue.substring(4, 6);
    const day = dateValue.substring(6, 8);
    
    return `${year}-${month}-${day}`;
  }
  
  return null;
}

/**
 * Détermine l'état civil à partir du champ PID-16
 * @param {Object} maritalStatusField - Champ d'état civil
 * @returns {Object} État civil FHIR
 */
function determineMaritalStatus(maritalStatusField) {
  if (!maritalStatusField || !maritalStatusField.value) {
    return null;
  }
  
  const maritalStatus = maritalStatusField.value;
  const maritalStatusMap = {
    'A': { code: 'A', display: 'Annulé' },
    'D': { code: 'D', display: 'Divorcé' },
    'M': { code: 'M', display: 'Marié' },
    'S': { code: 'S', display: 'Célibataire' },
    'W': { code: 'W', display: 'Veuf/Veuve' },
    'P': { code: 'P', display: 'Partenaire' },
    'I': { code: 'I', display: 'Séparé' },
    'B': { code: 'B', display: 'Bénéficiaire' },
    'C': { code: 'C', display: 'Enfant' },
    'G': { code: 'G', display: 'Conjoint' },
    'O': { code: 'O', display: 'Autre' },
    'U': { code: 'U', display: 'Inconnu' }
  };
  
  if (maritalStatusMap[maritalStatus]) {
    return {
      coding: [{
        system: 'http://terminology.hl7.org/CodeSystem/v3-MaritalStatus',
        code: maritalStatusMap[maritalStatus].code,
        display: maritalStatusMap[maritalStatus].display
      }]
    };
  }
  
  return null;
}

/**
 * Extrait les coordonnées de contact à partir des champs PID-13 et PID-14
 * @param {Array} homePhoneFields - Champs de téléphone personnel
 * @param {Array} workPhoneFields - Champs de téléphone professionnel
 * @returns {Array} Tableau de coordonnées FHIR
 */
function extractTelecoms(homePhoneFields, workPhoneFields) {
  const telecoms = [];
  
  // Traitement des téléphones personnels
  if (homePhoneFields && Array.isArray(homePhoneFields)) {
    homePhoneFields.forEach(field => {
      if (!field) return;
      
      const components = field.components || [];
      
      // Numéro (component 1)
      const phoneNumber = components[0] ? components[0].value : '';
      if (!phoneNumber) return;
      
      const telecom = {
        value: phoneNumber,
        use: 'home'
      };
      
      // Type d'utilisation (component 2)
      if (components[1] && components[1].value) {
        telecom.use = mapContactUseToFHIR(components[1].value);
      }
      
      // Type d'équipement (component 3)
      if (components[2] && components[2].value) {
        telecom.system = mapEquipmentTypeToFHIR(components[2].value);
      } else {
        telecom.system = 'phone';
      }
      
      telecoms.push(telecom);
    });
  }
  
  // Traitement des téléphones professionnels
  if (workPhoneFields && Array.isArray(workPhoneFields)) {
    workPhoneFields.forEach(field => {
      if (!field) return;
      
      const components = field.components || [];
      
      // Numéro (component 1)
      const phoneNumber = components[0] ? components[0].value : '';
      if (!phoneNumber) return;
      
      const telecom = {
        value: phoneNumber,
        use: 'work'
      };
      
      // Type d'équipement (component 3)
      if (components[2] && components[2].value) {
        telecom.system = mapEquipmentTypeToFHIR(components[2].value);
      } else {
        telecom.system = 'phone';
      }
      
      telecoms.push(telecom);
    });
  }
  
  return telecoms;
}

/**
 * Mappe le type d'équipement HL7 vers le système FHIR
 * @param {string} equipType - Type d'équipement HL7
 * @returns {string} Système FHIR
 */
function mapEquipmentTypeToFHIR(equipType) {
  const equipMap = {
    'PH': 'phone',     // Téléphone
    'CP': 'phone',     // Téléphone portable
    'FX': 'fax',       // Fax
    'BP': 'pager',     // Bipeur
    'Internet': 'email',// Email (conformité française)
    'X.400': 'email',   // Email
    'NET': 'email',     // Email
    'URI': 'url'        // URL
  };
  
  return equipMap[equipType] || 'other';
}

/**
 * Mappe l'utilisation du contact HL7 vers FHIR
 * @param {string} useCode - Code d'utilisation HL7
 * @returns {string} Utilisation FHIR
 */
function mapContactUseToFHIR(useCode) {
  const useMap = {
    'PRN': 'home',    // Primary
    'ORN': 'work',    // Other
    'WPN': 'work',    // Work
    'VHN': 'home',    // Vacation Home
    'ASN': 'temp',    // Answering Service
    'EMR': 'mobile',  // Emergency
    'NET': 'home',    // Network (email)
    'BPN': 'work'     // Beeper
  };
  
  return useMap[useCode] || 'home';
}

/**
 * Extrait les adresses à partir du champ PID-11
 * @param {Array} addressFields - Champs d'adresse
 * @returns {Array} Tableau d'adresses FHIR
 */
function extractAddresses(addressFields) {
  if (!addressFields || !Array.isArray(addressFields)) {
    return [];
  }
  
  const addresses = [];
  
  addressFields.forEach(field => {
    if (!field) return;
    
    const components = field.components || [];
    
    // Informations d'adresse
    const street1 = components[0] ? components[0].value : '';
    const street2 = components[1] ? components[1].value : '';
    const city = components[2] ? components[2].value : '';
    const state = components[3] ? components[3].value : '';
    const postalCode = components[4] ? components[4].value : '';
    const country = components[5] ? components[5].value : '';
    
    // Type d'adresse (component 7)
    const addrType = components[6] ? components[6].value : '';
    
    if (street1 || city || postalCode || country) {
      const address = {
        use: mapAddressUseToFHIR(addrType),
        type: mapAddressTypeToFHIR(addrType)
      };
      
      // Lignes d'adresse
      const lines = [];
      if (street1) lines.push(street1);
      if (street2) lines.push(street2);
      
      if (lines.length > 0) {
        address.line = lines;
      }
      
      if (city) address.city = city;
      if (state) address.state = state;
      if (postalCode) address.postalCode = postalCode;
      if (country) address.country = country;
      
      addresses.push(address);
    }
  });
  
  return addresses;
}

/**
 * Mappe l'utilisation de l'adresse HL7 vers FHIR
 * @param {string} hl7AddressUse - Code d'utilisation de l'adresse HL7
 * @returns {string} Utilisation de l'adresse FHIR
 */
function mapAddressUseToFHIR(hl7AddressUse) {
  const addressUseMap = {
    'H': 'home',     // Home
    'B': 'work',     // Business
    'C': 'temp',     // Current/Temporary
    'BA': 'old',     // Bad Address
    'O': 'home',     // Office
    'V': 'home'      // Vacation
  };
  
  return addressUseMap[hl7AddressUse] || 'home';
}

/**
 * Mappe le type d'adresse HL7 vers FHIR
 * @param {string} hl7AddressType - Code de type d'adresse HL7
 * @returns {string} Type d'adresse FHIR
 */
function mapAddressTypeToFHIR(hl7AddressType) {
  const addressTypeMap = {
    'M': 'postal',     // Mailing
    'P': 'physical',   // Physical
    'B': 'both',       // Both
    'H': 'physical',   // Home (France)
    'O': 'physical',   // Office
    'C': 'postal'      // Correspondence
  };
  
  return addressTypeMap[hl7AddressType] || 'both';
}

/**
 * Ajoute les extensions françaises au patient
 * @param {Object} patientResource - Ressource Patient FHIR
 * @param {Object} pd1Segment - Segment PD1 parsé
 */
function addFrenchExtensions(patientResource, pd1Segment) {
  // Si le patient est français, ajouter les extensions appropriées
  // Exemple : INS de confiance
  if (patientResource.identifier.some(id => id.system === 'urn:oid:1.2.250.1.213.1.4.8')) {
    patientResource.extension = patientResource.extension || [];
    
    // Exemple d'extension pour l'INS vérifié (à adapter selon besoins spécifiques)
    patientResource.extension.push({
      url: 'https://apifhir.annuaire.sante.fr/ws-sync/exposed/structuredefinition/INSi-Status',
      valueCodeableConcept: {
        coding: [{
          system: 'https://mos.esante.gouv.fr/NOS/TRE_R338-ModaliteAccueil/FHIR/TRE-R338-ModaliteAccueil',
          code: 'VALI',
          display: 'Identité vérifiée'
        }]
      }
    });
  }
}

/**
 * Crée une ressource Encounter FHIR à partir du segment PV1
 * @param {Object} pv1Segment - Segment PV1 parsé
 * @param {string} patientReference - Référence à la ressource Patient
 * @returns {Object} Entrée de bundle pour un Encounter
 */
function createEncounterResource(pv1Segment, patientReference) {
  if (!pv1Segment) {
    return null;
  }
  
  const encounterId = `encounter-${Date.now()}`;
  
  // Déterminer la classe d'encounter (PV1-2)
  const patientClass = pv1Segment.fields[2] ? pv1Segment.fields[2].value : '';
  const encounterClass = mapPatientClassToFHIR(patientClass);
  
  // Statut de l'encounter (PV1-36 = disposition)
  const dischargeDisposition = pv1Segment.fields[36] ? pv1Segment.fields[36].value : '';
  const encounterStatus = determineEncounterStatus(dischargeDisposition);
  
  // Période de l'encounter
  let admitDate = null;
  if (pv1Segment.fields[44] && pv1Segment.fields[44].value) {
    admitDate = formatHL7DateTime(pv1Segment.fields[44].value);
  }
  
  // Numéro de visite/séjour (PV1-19 = visit number)
  const visitNumber = pv1Segment.fields[19] ? pv1Segment.fields[19].value : null;
  
  // Créer la ressource Encounter
  const encounterResource = {
    resourceType: 'Encounter',
    id: encounterId,
    status: encounterStatus,
    class: {
      system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
      code: encounterClass.code,
      display: encounterClass.display
    },
    subject: {
      reference: patientReference
    }
  };
  
  // Ajouter la période si disponible
  if (admitDate) {
    encounterResource.period = {
      start: admitDate
    };
  }
  
  // Ajouter l'identifiant de visite si disponible
  if (visitNumber) {
    encounterResource.identifier = [{
      system: 'urn:oid:1.2.250.1.213.1.4.2',
      value: visitNumber
    }];
  }
  
  return {
    fullUrl: `urn:uuid:${encounterId}`,
    resource: encounterResource,
    request: {
      method: 'POST',
      url: 'Encounter'
    }
  };
}

/**
 * Mappe la classe de patient HL7 vers FHIR
 * @param {string} patientClass - Classe de patient HL7
 * @returns {Object} Classe d'encounter FHIR avec code et libellé
 */
function mapPatientClassToFHIR(patientClass) {
  const classMap = {
    'I': { code: 'IMP', display: 'inpatient encounter' },
    'O': { code: 'AMB', display: 'ambulatory' },
    'E': { code: 'EMER', display: 'emergency' },
    'P': { code: 'AMB', display: 'ambulatory' },
    'R': { code: 'ACUTE', display: 'acute inpatient encounter' },
    'B': { code: 'AMB', display: 'ambulatory' },
    'N': { code: 'NONAC', display: 'Non-acute inpatient encounter' }
  };
  
  return classMap[patientClass] || { code: 'IMP', display: 'inpatient encounter' };
}

/**
 * Détermine le statut de l'encounter à partir de la disposition de sortie
 * @param {string} dischargeDisposition - Disposition de sortie
 * @returns {string} Statut FHIR
 */
function determineEncounterStatus(dischargeDisposition) {
  if (!dischargeDisposition) {
    return 'in-progress';
  }
  
  if (['01', '02', '03', '04', '05', '06', '07', '08', '09'].includes(dischargeDisposition)) {
    return 'finished';
  }
  
  return 'in-progress';
}

/**
 * Formate une date/heure HL7 au format ISO
 * @param {string} dateValue - Date au format HL7
 * @returns {string|null} Date au format ISO ou null si non disponible
 */
function formatHL7DateTime(dateValue) {
  if (!dateValue) {
    return null;
  }
  
  if (/^\d{8}/.test(dateValue)) {
    // Format YYYYMMDD
    if (dateValue.length === 8) {
      const year = dateValue.substring(0, 4);
      const month = dateValue.substring(4, 6);
      const day = dateValue.substring(6, 8);
      return `${year}-${month}-${day}`;
    }
    
    // Format YYYYMMDDHHMMSS
    if (dateValue.length >= 14) {
      const year = dateValue.substring(0, 4);
      const month = dateValue.substring(4, 6);
      const day = dateValue.substring(6, 8);
      const hour = dateValue.substring(8, 10);
      const minute = dateValue.substring(10, 12);
      const second = dateValue.substring(12, 14);
      return `${year}-${month}-${day}T${hour}:${minute}:${second}`;
    }
  }
  
  return null;
}

/**
 * Crée une ressource Organization FHIR à partir d'un champ MSH
 * @param {Object} mshSegment - Segment MSH parsé
 * @param {number} fieldIndex - Index du champ (4 pour sending, 6 pour receiving)
 * @returns {Object|null} Entrée de bundle pour une Organization ou null si non disponible
 */
function createOrganizationResource(mshSegment, fieldIndex) {
  if (!mshSegment || !mshSegment.fields[fieldIndex]) {
    return null;
  }
  
  const field = mshSegment.fields[fieldIndex];
  const components = field.components || [];
  
  // Identifier et nom (component 1)
  const orgName = components[0] ? components[0].value : '';
  if (!orgName) {
    return null;
  }
  
  // Identifiant comme OID s'il existe (component 2)
  let orgId = orgName.replace(/[^a-zA-Z0-9]/g, '');
  let oid = null;
  
  if (components[1] && components[1].value) {
    orgId = components[1].value;
  }
  
  // Namespace (component 3)
  if (components[2] && components[2].value && components[2].value.includes('&')) {
    const namespaceComponents = components[2].value.split('&');
    if (namespaceComponents.length > 1) {
      oid = namespaceComponents[1];
    }
  }
  
  const organizationId = `organization-${orgId}`;
  
  // Créer la ressource Organization
  const organizationResource = {
    resourceType: 'Organization',
    id: organizationId,
    identifier: [{
      system: oid ? `urn:oid:${oid}` : 'urn:oid:1.2.250.1.71.4.2.2',
      value: orgId
    }],
    name: orgName,
    active: true
  };
  
  // Utiliser une extension française spécifique si disponible
  if (oid) {
    organizationResource.extension = [{
      url: 'https://apifhir.annuaire.sante.fr/ws-sync/exposed/structuredefinition/Agency-NumberAssigningAuthority',
      valueIdentifier: {
        system: `urn:oid:${oid}`,
        value: orgId
      }
    }];
  }
  
  return {
    fullUrl: `urn:uuid:${organizationId}`,
    resource: organizationResource,
    request: {
      method: 'POST',
      url: 'Organization'
    }
  };
}

/**
 * Crée une ressource Practitioner FHIR à partir du segment ROL
 * @param {Object} rolSegment - Segment ROL parsé
 * @returns {Object|null} Entrée de bundle pour un Practitioner ou null si non disponible
 */
function createPractitionerResource(rolSegment) {
  if (!rolSegment) {
    return null;
  }
  
  // ROL-4 (Role Person)
  const rolePerson = rolSegment.fields[4];
  if (!rolePerson) {
    return null;
  }
  
  const components = rolePerson.components || [];
  
  // Identifiant (component 1)
  const idValue = components[0] ? components[0].value : '';
  
  // Nom (components 2-3)
  const familyName = components[1] ? components[1].value : '';
  const givenName = components[2] ? components[2].value : '';
  
  if (!idValue && !familyName && !givenName) {
    return null;
  }
  
  const practitionerId = `practitioner-${idValue || uuid.v4()}`;
  
  // Récupérer l'OID pour l'identifiant professionnel
  let oid = '1.2.250.1.71.4.2.1'; // OID par défaut
  
  // ROL-4.4 (Assigning Authority)
  if (components[3] && components[3].value && components[3].value.includes('&')) {
    const assigningAuthority = components[3].value;
    const authorityComponents = assigningAuthority.split('&');
    if (authorityComponents.length > 1 && authorityComponents[1]) {
      oid = authorityComponents[1];
    }
  }
  
  // Créer la ressource Practitioner
  const practitionerResource = {
    resourceType: 'Practitioner',
    id: practitionerId,
    identifier: []
  };
  
  // Ajouter l'identifiant
  if (idValue) {
    practitionerResource.identifier.push({
      system: `urn:oid:${oid}`,
      value: idValue
    });
  }
  
  // Ajouter le nom
  if (familyName || givenName) {
    const humanName = {};
    
    if (familyName) {
      humanName.family = familyName;
    }
    
    if (givenName) {
      // Gérer les prénoms composés
      if (givenName.includes(' ')) {
        humanName.given = givenName.split(' ').filter(Boolean);
      } else {
        humanName.given = [givenName];
      }
    }
    
    practitionerResource.name = [humanName];
  }
  
  // Traitement spécifique pour les médecins français
  // Extensions pour RPPS, ADELI, spécialités, etc.
  if (oid === '2.16.840.1.113883.3.31.2.2' || oid === '1.2.250.1.213.1.1.2') {
    // ADELI ou RPPS
    addFrenchPractitionerExtensions(practitionerResource, rolSegment);
  }
  
  return {
    fullUrl: `urn:uuid:${practitionerId}`,
    resource: practitionerResource,
    request: {
      method: 'POST',
      url: 'Practitioner'
    }
  };
}

/**
 * Ajoute les extensions françaises au praticien
 * @param {Object} practitionerResource - Ressource Practitioner FHIR
 * @param {Object} rolSegment - Segment ROL parsé
 */
function addFrenchPractitionerExtensions(practitionerResource, rolSegment) {
  // Ajouter les extensions spécifiques aux praticiens français
  practitionerResource.extension = practitionerResource.extension || [];
  
  // Extension pour la spécialité médicale
  if (rolSegment.fields[3] && rolSegment.fields[3].value) {
    const roleCode = rolSegment.fields[3].value;
    
    practitionerResource.extension.push({
      url: 'https://apifhir.annuaire.sante.fr/ws-sync/exposed/structuredefinition/practitionerRole-Specialty',
      valueCodeableConcept: {
        coding: [{
          system: 'https://mos.esante.gouv.fr/NOS/TRE_G15-ProfessionSante/FHIR/TRE-G15-ProfessionSante',
          code: roleCode,
          display: getRoleTypeDisplay(roleCode)
        }]
      }
    });
  }
}

/**
 * Récupère le libellé pour un type de rôle
 * @param {string} roleType - Code du type de rôle
 * @returns {string} Libellé du type de rôle
 */
function getRoleTypeDisplay(roleType) {
  const roleTypeMap = {
    'ODRP': 'Médecin',
    'ODES': 'Sage-femme',
    'ODPH': 'Pharmacien',
    'ODCH': 'Chirurgien-dentiste',
    'PSYL': 'Psychologue',
    'INFI': 'Infirmier',
    'KINE': 'Masseur-kinésithérapeute'
  };
  
  return roleTypeMap[roleType] || roleType;
}

/**
 * Crée une ressource PractitionerRole FHIR à partir du segment ROL
 * @param {Object} rolSegment - Segment ROL parsé
 * @param {string} practitionerReference - Référence à la ressource Practitioner
 * @param {string} encounterReference - Référence à la ressource Encounter
 * @returns {Object|null} Entrée de bundle pour un PractitionerRole ou null si non disponible
 */
function createPractitionerRoleResource(rolSegment, practitionerReference, encounterReference) {
  if (!rolSegment || !practitionerReference) {
    return null;
  }
  
  const practitionerRoleId = `practitionerrole-${uuid.v4()}`;
  
  // ROL-3 (Role Code)
  const roleCode = rolSegment.fields[3] ? rolSegment.fields[3].value : null;
  
  if (!roleCode) {
    return null;
  }
  
  // Créer la ressource PractitionerRole
  const practitionerRoleResource = {
    resourceType: 'PractitionerRole',
    id: practitionerRoleId,
    practitioner: {
      reference: practitionerReference
    },
    active: true
  };
  
  // Ajouter le code de rôle
  practitionerRoleResource.code = [{
    coding: [{
      system: 'https://mos.esante.gouv.fr/NOS/TRE_R94-ProfessionSocial/FHIR/TRE-R94-ProfessionSocial',
      code: roleCode,
      display: getRoleTypeDisplay(roleCode)
    }]
  }];
  
  // Lier à l'encounter si disponible
  if (encounterReference) {
    practitionerRoleResource.encounter = {
      reference: encounterReference
    };
  }
  
  return {
    fullUrl: `urn:uuid:${practitionerRoleId}`,
    resource: practitionerRoleResource,
    request: {
      method: 'POST',
      url: 'PractitionerRole'
    }
  };
}

/**
 * Crée une ressource RelatedPerson FHIR à partir du segment NK1
 * @param {Object} nk1Segment - Segment NK1 parsé
 * @param {string} patientReference - Référence à la ressource Patient
 * @returns {Object|null} Entrée de bundle pour un RelatedPerson ou null si non disponible
 */
function createRelatedPersonResource(nk1Segment, patientReference) {
  if (!nk1Segment || !patientReference) {
    return null;
  }
  
  // NK1-2 (Nom)
  const nameField = nk1Segment.fields[2];
  if (!nameField) {
    return null;
  }
  
  const components = nameField.components || [];
  const familyName = components[0] ? components[0].value : '';
  const givenName = components[1] ? components[1].value : '';
  
  if (!familyName && !givenName) {
    return null;
  }
  
  const relatedPersonId = `relatedperson-${uuid.v4()}`;
  
  // Créer la ressource RelatedPerson
  const relatedPersonResource = {
    resourceType: 'RelatedPerson',
    id: relatedPersonId,
    patient: {
      reference: patientReference
    },
    active: true
  };
  
  // Ajouter le nom
  if (familyName || givenName) {
    const humanName = {
      use: 'official'
    };
    
    if (familyName) {
      humanName.family = familyName;
    }
    
    if (givenName) {
      // Gérer les prénoms composés
      if (givenName.includes(' ')) {
        humanName.given = givenName.split(' ').filter(Boolean);
      } else {
        humanName.given = [givenName];
      }
    }
    
    relatedPersonResource.name = [humanName];
  }
  
  // NK1-3 (Relation)
  const relationshipField = nk1Segment.fields[3];
  if (relationshipField) {
    const relationComponents = relationshipField.components || [];
    let relationshipCode = '';
    
    // Trouver le code de relation (souvent à l'index 3 ou 4)
    for (let i = 0; i < relationComponents.length; i++) {
      const component = relationComponents[i];
      if (component && component.value && 
          ['SPO', 'DOM', 'CHD', 'PAR', 'SIB', 'GRD'].includes(component.value)) {
        relationshipCode = component.value;
        break;
      }
    }
    
    if (relationshipCode) {
      relatedPersonResource.relationship = [{
        coding: [{
          system: 'http://terminology.hl7.org/CodeSystem/v3-RoleCode',
          code: relationshipCode,
          display: getRelationshipDisplay(relationshipCode)
        }]
      }];
    }
  }
  
  return {
    fullUrl: `urn:uuid:${relatedPersonId}`,
    resource: relatedPersonResource,
    request: {
      method: 'POST',
      url: 'RelatedPerson'
    }
  };
}

/**
 * Récupère le libellé pour un code de relation
 * @param {string} relationshipCode - Code de relation
 * @returns {string} Libellé de la relation
 */
function getRelationshipDisplay(relationshipCode) {
  const relationshipMap = {
    'SPO': 'Spouse',
    'DOM': 'Life partner',
    'CHD': 'Child',
    'GRD': 'Guardian',
    'PAR': 'Parent',
    'SIB': 'Sibling',
    'SIGOTHR': 'Significant other',
    'EMC': 'Emergency contact',
    'EME': 'Employee',
    'EMR': 'Employer',
    'EXF': 'Extended family',
    'FCH': 'Foster child',
    'FTH': 'Father',
    'MTH': 'Mother',
    'NFTH': 'Natural father',
    'NMTH': 'Natural mother',
    'NPRN': 'Natural parent',
    'STPPRN': 'Step parent'
  };
  
  return relationshipMap[relationshipCode] || relationshipCode;
}

/**
 * Crée une ressource Coverage FHIR à partir des segments IN1/IN2
 * @param {Object} in1Segment - Segment IN1 parsé
 * @param {Object} in2Segment - Segment IN2 parsé (optionnel)
 * @param {string} patientReference - Référence à la ressource Patient
 * @returns {Object|null} Entrée de bundle pour un Coverage ou null si non disponible
 */
function createCoverageResource(in1Segment, in2Segment, patientReference) {
  if (!in1Segment || !patientReference) {
    return null;
  }
  
  // IN1-2 (Plan ID)
  const planId = in1Segment.fields[2] ? in1Segment.fields[2].value : '';
  
  // IN1-12 (Policy Expiration Date)
  const expirationDate = in1Segment.fields[12] ? in1Segment.fields[12].value : '';
  
  // IN1-16 (Name of Insured)
  const insuredNameField = in1Segment.fields[16];
  
  if (!planId && !insuredNameField) {
    return null;
  }
  
  const coverageId = `coverage-${uuid.v4()}`;
  
  // Créer la ressource Coverage
  const coverageResource = {
    resourceType: 'Coverage',
    id: coverageId,
    status: 'active',
    beneficiary: {
      reference: patientReference
    }
  };
  
  // Ajouter le type de couverture
  if (planId) {
    coverageResource.type = {
      coding: [{
        system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
        code: planId,
        display: 'Insurance policy'
      }]
    };
  }
  
  // Ajouter la période de validité
  if (expirationDate) {
    const expirationDateFormatted = formatHL7DateTime(expirationDate);
    if (expirationDateFormatted) {
      coverageResource.period = {
        end: expirationDateFormatted
      };
    }
  }
  
  // Ajouter le nom de l'assuré
  if (insuredNameField) {
    const components = insuredNameField.components || [];
    
    if (components[0] && components[0].value) {
      coverageResource.subscriberId = components[0].value;
    }
  }
  
  // Extension française: numéro AMC/AMO
  if (in1Segment.fields[36] && in1Segment.fields[36].value) {
    const insuredId = in1Segment.fields[36].value;
    coverageResource.extension = [{
      url: 'https://apifhir.annuaire.sante.fr/ws-sync/exposed/structuredefinition/Coverage-InsuredID',
      valueIdentifier: {
        system: 'urn:oid:1.2.250.1.213.1.4.8',
        value: insuredId
      }
    }];
  }
  
  return {
    fullUrl: `urn:uuid:${coverageId}`,
    resource: coverageResource,
    request: {
      method: 'POST',
      url: 'Coverage'
    }
  };
}

/**
 * Traite les données du segment ZBE (spécifique français)
 * @param {Object} zbeSegment - Segment ZBE parsé
 * @returns {Object} Données extraites du segment ZBE
 */
function processZBESegment(zbeSegment) {
  if (!zbeSegment) {
    return {};
  }
  
  const zbeData = {};
  
  // ZBE-1 (Mouvement : EH_xxxx)
  if (zbeSegment.fields[1]) {
    zbeData.movementId = zbeSegment.fields[1].value;
  }
  
  // ZBE-2 (Date d'effet)
  if (zbeSegment.fields[2]) {
    zbeData.effectiveDate = formatHL7DateTime(zbeSegment.fields[2].value);
  }
  
  // ZBE-4 (Type de mouvement)
  if (zbeSegment.fields[4]) {
    zbeData.movementType = zbeSegment.fields[4].value;
  }
  
  // ZBE-7 (Unité fonctionnelle)
  if (zbeSegment.fields[7]) {
    const ufComponents = zbeSegment.fields[7].components || [];
    if (ufComponents.length > 8) {
      zbeData.functionalUnit = ufComponents[8].value;
      zbeData.functionalUnitDisplay = ufComponents[9] ? ufComponents[9].value : null;
    }
  }
  
  return zbeData;
}

/**
 * Récupère le libellé pour un type de mouvement
 * @param {string} movementType - Code du type de mouvement
 * @returns {string} Libellé du type de mouvement
 */
function getMovementTypeDisplay(movementType) {
  const movementTypeMap = {
    'INSERT': 'Entrée',
    'ADMIT': 'Admission',
    'TRANSFER': 'Transfert',
    'DISCHARGE': 'Sortie',
    'CANCEL': 'Annulation',
    'UPDATE': 'Mise à jour'
  };
  
  return movementTypeMap[movementType] || movementType;
}

/**
 * Traite les données du segment ZFP (spécifique français - infos patient)
 * @param {Object} zfpSegment - Segment ZFP parsé
 * @returns {Object} Données extraites du segment ZFP
 */
function processZFPSegment(zfpSegment) {
  if (!zfpSegment) {
    return {};
  }
  
  const zfpData = {};
  
  // ZFP-1 (Informations administratives patient)
  if (zfpSegment.fields[1]) {
    zfpData.administrativeInfo = zfpSegment.fields[1].value;
  }
  
  // ZFP-2 (Informations complémentaires patient)
  if (zfpSegment.fields[2]) {
    zfpData.additionalInfo = zfpSegment.fields[2].value;
  }
  
  return zfpData;
}

/**
 * Traite les données du segment ZFV (spécifique français - infos visite)
 * @param {Object} zfvSegment - Segment ZFV parsé
 * @returns {Object} Données extraites du segment ZFV
 */
function processZFVSegment(zfvSegment) {
  if (!zfvSegment) {
    return {};
  }
  
  const zfvData = {};
  
  // ZFV-1 (Encodage classe d'encounter)
  if (zfvSegment.fields[1]) {
    const encounterClassValue = zfvSegment.fields[1].value;
    
    // Mapping des codes français vers les classes FHIR
    const classMappings = {
      'H': { code: 'IMP', display: 'Hospitalisation' },
      'U': { code: 'EMER', display: 'Urgences' },
      'C': { code: 'AMB', display: 'Consultation' },
      'E': { code: 'AMB', display: 'Consultation externe' }
    };
    
    if (encounterClassValue && classMappings[encounterClassValue]) {
      zfvData.encounterClass = {
        system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
        code: classMappings[encounterClassValue].code,
        display: classMappings[encounterClassValue].display
      };
    }
  }
  
  return zfvData;
}

/**
 * Traite les données du segment ZFM (spécifique français - infos médicales)
 * @param {Object} zfmSegment - Segment ZFM parsé
 * @returns {Object} Données extraites du segment ZFM
 */
function processZFMSegment(zfmSegment) {
  if (!zfmSegment) {
    return {};
  }
  
  const zfmData = {};
  
  // ZFM-1 (Type d'hospitalisation)
  if (zfmSegment.fields[1]) {
    zfmData.hospitalizationType = zfmSegment.fields[1].value;
  }
  
  // ZFM-2 (Mode d'entrée)
  if (zfmSegment.fields[2]) {
    zfmData.admissionMode = zfmSegment.fields[2].value;
  }
  
  // ZFM-3 (Mode de sortie)
  if (zfmSegment.fields[3]) {
    zfmData.dischargeMode = zfmSegment.fields[3].value;
  }
  
  return zfmData;
}

module.exports = {
  convertHL7ToFHIR
};