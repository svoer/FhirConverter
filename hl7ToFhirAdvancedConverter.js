/**
 * Convertisseur avancé HL7 v2.5 vers FHIR R4
 * Spécialement optimisé pour les messages ADT français
 * Compatible avec les exigences de l'ANS
 * 
 * Intègre les terminologies et systèmes de codification français
 * Conforme au guide d'implémentation FHIR de l'ANS
 * 
 * @version 1.1.1
 * @updated 2025-04-29
 * @module hl7ToFhirAdvancedConverter
 */

// Module UUID pour générer des identifiants uniques
const uuid = {
  v4: function() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }
};

// Import de l'adaptateur de terminologie française
const frenchTerminology = require('./french_terminology_adapter');
const hl7Parser = require('./hl7Parser');

/**
 * Convertit un message HL7 en bundle FHIR conforme aux spécifications ANS (France)
 * Optimisé pour les identifiants INS/INS-C et terminologies françaises
 * @version 1.1.1
 * @updated 2025-04-29
 * @param {string} hl7Message - Message HL7 au format texte
 * @returns {Object} Bundle FHIR au format R4 conforme ANS
 */
function convertHL7ToFHIR(hl7Message) {
  try {
    console.log('[CONVERTER] Démarrage de la conversion HL7 vers FHIR');
    
    // Parser le message HL7 avec notre module de parsing optimisé
    const parsedMessage = hl7Parser.parseHL7Message(hl7Message);
    
    if (!parsedMessage || !parsedMessage.segments) {
      throw new Error('Message HL7 invalide ou vide');
    }
    
    // Vérifier que les segments essentiels sont présents
    const segments = parsedMessage.segments;
    if (!segments.MSH) {
      throw new Error('Segment MSH requis manquant dans le message HL7');
    }
    
    console.log(`[CONVERTER] Message HL7 parsé avec succès: ${Object.keys(segments).length} types de segments`);
    
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
        console.log("[CONVERTER] Traitement de segments ROL:", segments.ROL.length, "segment(s) trouvé(s)");
        
        // Trouver l'Encounter existant s'il y en a un
        let encounterReference = null;
        if (bundle.entry.length > 1 && bundle.entry[1].resource && bundle.entry[1].resource.resourceType === 'Encounter') {
          encounterReference = bundle.entry[1].fullUrl;
          console.log("[CONVERTER] Référence d'Encounter trouvée:", encounterReference);
        } else {
          console.log("[CONVERTER] Pas de référence d'Encounter trouvée dans le bundle");
        }
        
        segments.ROL.forEach((rolSegment, index) => {
          console.log(`[CONVERTER] Traitement du segment ROL #${index + 1}:`, JSON.stringify(rolSegment).substring(0, 100) + "...");
          
          try {
            console.log("[CONVERTER] Segment ROL complet:", JSON.stringify(rolSegment));
            
            // 1. Traitement pour les systèmes d'identifiants français
            let practitionerIdentifiers = [];
            let practitionerName = {};
            
            // Récupérer le code du praticien (ROL-3)
            const roleCode = rolSegment[3] || 'UNKN';
            
            // Récupérer les informations d'identification du praticien (ROL-4)
            if (rolSegment[4]) {
              const rolePerson = rolSegment[4];
              console.log("[CONVERTER] Analyse du segment ROL-4 pour praticien:", typeof rolePerson);
              
              // Gestion des identifiants français spécifiques (ADELI, RPPS)
              try {
                // Format tableau complexe pour les identifiants français:
                if (Array.isArray(rolePerson)) {
                  // Pour chaque identifiant dans le segment ROL-4
                  rolePerson.forEach(id => {
                    if (Array.isArray(id) && id.length > 2) {
                      // Identifiant principal
                      const idValue = id[0] || '';
                      const familyName = id[1] || '';
                      const givenName = id[2] || '';
                      
                      // Vérifier si l'identifiant contient une autorité (ADELI, RPPS, etc.)
                      let system = 'urn:oid:1.2.250.1.71.4.2.1'; // OID par défaut
                      let typeCode = '';
                      
                      // Traitement des autorités d'assignation françaises
                      if (id.length > 9 && Array.isArray(id[9])) {
                        const authority = id[9];
                        if (Array.isArray(authority) && authority.length > 1) {
                          // Format: ["ADELI", "2.16.840.1.113883.3.31.2.2", "ISO"]
                          typeCode = authority[0] || '';
                          if (authority[1]) {
                            system = `urn:oid:${authority[1]}`;
                          }
                        }
                      }
                      
                      // Ajouter l'identifiant structuré
                      if (idValue) {
                        practitionerIdentifiers.push({
                          system: system,
                          value: idValue,
                          type: typeCode ? {
                            coding: [{
                              system: "http://terminology.hl7.org/CodeSystem/v2-0203",
                              code: typeCode
                            }]
                          } : undefined
                        });
                      }
                      
                      // Construire le nom
                      if (familyName) {
                        practitionerName = {
                          family: familyName,
                          given: givenName ? [givenName] : []
                        };
                      }
                    } else if (typeof id === 'string') {
                      // Format chaîne simple (cas plus rare)
                      const parts = id.split('^');
                      const idValue = parts[0] || '';
                      
                      if (idValue) {
                        practitionerIdentifiers.push({
                          system: "urn:oid:1.2.250.1.71.4.2.1",
                          value: idValue
                        });
                      }
                    }
                  });
                } else if (typeof rolePerson === 'string') {
                  // Format chaîne pour compatibilité: "987654321^DUPONT^JEAN^^DR^DR"
                  const parts = rolePerson.split('^');
                  const idValue = parts[0] || '';
                  const familyName = parts[1] || '';
                  const givenName = parts[2] || '';
                  
                  if (idValue) {
                    practitionerIdentifiers.push({
                      system: "urn:oid:1.2.250.1.71.4.2.1",
                      value: idValue
                    });
                  }
                  
                  if (familyName) {
                    practitionerName = {
                      family: familyName,
                      given: givenName ? [givenName] : []
                    };
                  }
                }
              } catch (err) {
                console.error("[CONVERTER] Erreur lors de l'extraction des identifiants:", err);
              }
            }
            
            // Si aucun identifiant n'a pu être extrait, créer un identifiant par défaut
            if (practitionerIdentifiers.length === 0) {
              practitionerIdentifiers.push({
                system: "urn:oid:1.2.250.1.71.4.2.1",
                value: `unknown-${Date.now()}`
              });
            }
            
            // Si aucun nom n'a pu être extrait, utiliser un nom par défaut
            if (!practitionerName.family) {
              practitionerName = {
                family: "Praticien non spécifié"
              };
            }
            
            // 2. Création de la ressource Practitioner conforme au format français
            const practitionerId = `practitioner-${uuid.v4()}`;
            const practitionerResource = {
              fullUrl: `urn:uuid:${practitionerId}`,
              resource: {
                resourceType: 'Practitioner',
                id: practitionerId,
                identifier: practitionerIdentifiers,
                name: [practitionerName],
                // Extensions françaises recommandées par l'ANS
                extension: [{
                  url: "https://apifhir.annuaire.sante.fr/ws-sync/exposed/structuredefinition/practitioner-nationality",
                  valueCodeableConcept: {
                    coding: [{
                      system: "https://mos.esante.gouv.fr/NOS/TRE_R20-Pays/FHIR/TRE-R20-Pays",
                      code: "FRA",
                      display: "France"
                    }]
                  }
                }]
              },
              request: {
                method: 'POST',
                url: 'Practitioner'
              }
            };
            
            // Ajouter la ressource Practitioner
            bundle.entry.push(practitionerResource);
            console.log("[CONVERTER] Ressource Practitioner créée avec succès:", practitionerResource.fullUrl);
            
            // Créer aussi une ressource PractitionerRole si un encounter existe
            if (encounterReference) {
              const practitionerRoleId = `practitionerrole-${uuid.v4()}`;
              const practitionerRoleResource = {
                fullUrl: `urn:uuid:${practitionerRoleId}`,
                resource: {
                  resourceType: 'PractitionerRole',
                  id: practitionerRoleId,
                  practitioner: {
                    reference: practitionerResource.fullUrl
                  },
                  active: true,
                  code: [{
                    coding: [{
                      system: 'https://mos.esante.gouv.fr/NOS/TRE_R94-ProfessionSocial/FHIR/TRE-R94-ProfessionSocial',
                      code: roleCode,
                      display: getRoleTypeDisplay(roleCode)
                    }]
                  }],
                  encounter: {
                    reference: encounterReference
                  },
                  // Extensions spécifiques au format français
                  extension: [{
                    url: "https://interop.esante.gouv.fr/ig/fhir/core/StructureDefinition/practitionerRole-profession",
                    valueCodeableConcept: {
                      coding: [{
                        system: "https://mos.esante.gouv.fr/NOS/TRE_G15-ProfessionSante/FHIR/TRE-G15-ProfessionSante",
                        code: roleCode,
                        display: getRoleTypeDisplay(roleCode)
                      }]
                    }
                  }]
                },
                request: {
                  method: 'POST',
                  url: 'PractitionerRole'
                }
              };
              
              bundle.entry.push(practitionerRoleResource);
              console.log("[CONVERTER] Ressource PractitionerRole créée avec succès");
            } else {
              console.log("[CONVERTER] Pas de création de PractitionerRole (pas d'Encounter)");
            }
          } catch (error) {
            console.error("[CONVERTER] Erreur lors du traitement du segment ROL:", error);
          }
        });
      } else {
        console.log("[CONVERTER] Aucun segment ROL trouvé dans le message");
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
                value: Array.isArray(zbeData.movementId) ? zbeData.movementId[0] : zbeData.movementId // Assurer une valeur unique (string) et non un tableau
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
 * @param {Array} pidSegmentFields - Champs du segment PID parsé
 * @param {Array} pd1SegmentFields - Champs du segment PD1 parsé (optionnel)
 * @returns {Object} Entrée de bundle pour un Patient
 */
function createPatientResource(pidSegmentFields, pd1SegmentFields) {
  // PID-3 (Patient Identifiers) - Champ 3
  const patientIdentifiers = extractIdentifiers(pidSegmentFields[3]);
  
  // Extraction d'un ID simple pour l'URI
  const mainId = pidSegmentFields[3] ? (Array.isArray(pidSegmentFields[3]) ? 
    (pidSegmentFields[3][0] || '') : pidSegmentFields[3]) : '';
  
  let patientId = `patient-${Date.now()}`;
  if (mainId && typeof mainId === 'string') {
    patientId = `patient-${mainId.split('^')[0]}`;
  } else if (patientIdentifiers.length > 0 && patientIdentifiers[0].value) {
    patientId = `patient-${patientIdentifiers[0].value}`;
  }
  
  // Optimiser la gestion des identifiants selon les spécifications ANS
  // Nous voulons un seul identifiant PI pour l'IPP, et un identifiant NI pour l'INS-C avec l'OID spécifique
  
  // Classification des identifiants par type
  let ippIdentifier = null;
  let insIdentifier = null;
  let otherIdentifiers = [];
  
  // D'abord, parcourir tous les identifiants et les trier par catégorie
  patientIdentifiers.forEach(id => {
    const idType = id.type?.coding?.[0]?.code || 'PI';
    
    // Identifiant INS/INS-C - priorité nationale
    if (idType === 'NI' && (id.system === 'urn:oid:1.2.250.1.213.1.4.8' || id.system === 'urn:oid:1.2.250.1.213.1.4.2')) {
      // Si nous n'avons pas encore d'INS OU si nous avons déjà un INS-C mais que celui-ci est un INS (priorité à l'INS)
      if (!insIdentifier || (insIdentifier.system === 'urn:oid:1.2.250.1.213.1.4.2' && id.system === 'urn:oid:1.2.250.1.213.1.4.8')) {
        insIdentifier = id;
      }
    }
    // Identifiant Patient Interne (IPP) - établissement
    else if (idType === 'PI') {
      // Si nous n'avons pas encore d'IPP OU si l'IPP a un system plus spécifique (pas "unknown")
      if (!ippIdentifier || (ippIdentifier.system === 'urn:system:unknown' && id.system !== 'urn:system:unknown')) {
        ippIdentifier = id;
      }
    }
    // Tous les autres identifiants
    else {
      otherIdentifiers.push(id);
    }
  });
  
  // Construire la liste finale selon les priorités ANS
  const optimizedIdentifiers = [];
  
  // 1. D'abord l'IPP - obligatoire
  if (ippIdentifier) {
    // Si l'IPP n'a pas de système spécifique, utiliser le format ANS
    if (ippIdentifier.system === 'urn:system:unknown') {
      ippIdentifier.system = 'urn:oid:1.2.250.1.71.4.2.7'; // OID standard pour les IPP en France
    }
    optimizedIdentifiers.push(ippIdentifier);
  }
  
  // 2. Ensuite l'INS/INS-C - prioritaire pour l'identification nationale
  if (insIdentifier) {
    optimizedIdentifiers.push(insIdentifier);
  }
  
  // 3. Tous les autres identifiants (limités à 1-2 maximum)
  optimizedIdentifiers.push(...otherIdentifiers.slice(0, 2));
  
  // Créer la ressource Patient
  const patientResource = {
    resourceType: 'Patient',
    id: patientId,
    identifier: optimizedIdentifiers,  // Utilisation des identifiants optimisés
    name: extractNames(pidSegmentFields[5]),
    gender: determineGender(pidSegmentFields[8]),
    birthDate: formatBirthDate(pidSegmentFields[7]),
    telecom: extractTelecoms(pidSegmentFields[13], pidSegmentFields[14]),
    address: extractAddresses(pidSegmentFields[11]),
    maritalStatus: determineMaritalStatus(pidSegmentFields[16]),
    contact: []
  };
  
  // Ajouter les extensions françaises si PD1 est disponible
  if (pd1SegmentFields) {
    addFrenchExtensions(patientResource, pd1SegmentFields);
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
 * @param {Array|string} identifierField - Champ d'identifiants
 * @returns {Array} Tableau d'identifiants FHIR
 */
function extractIdentifiers(identifierField) {
  if (!identifierField) {
    return [];
  }
  
  const identifiers = [];
  
  // Si nous avons une chaîne, traiter directement
  if (typeof identifierField === 'string') {
    const components = identifierField.split('^');
    const idValue = components[0];
    const idType = components[4] || 'PI';
    const assigningAuthority = components[3] || '';
    
    if (idValue) {
      // Configuration standard
      let system = 'urn:system:unknown';
      let officialType = '';
      
      // Traiter l'autorité d'assignation et l'OID pour conformité ANS
      if (assigningAuthority) {
        const authParts = assigningAuthority.split('&');
        const namespaceName = authParts[0] || '';
        const oid = authParts.length > 1 ? authParts[1] : '';
        
        // Détection des identifiants français basée sur le nom et l'OID
        // En conformité stricte avec les recommandations ANS
        if (namespaceName.includes('ASIP-SANTE-INS-NIR') || namespaceName.includes('INSEE-NIR')) {
          officialType = 'INS';
          system = 'urn:oid:1.2.250.1.213.1.4.8'; // OID officiel pour INS-NIR
          idType = 'NI'; // National identifier pour INS
        } else if (namespaceName.includes('ASIP-SANTE-INS-C')) {
          officialType = 'INS-C';
          system = 'urn:oid:1.2.250.1.213.1.4.2'; // OID officiel pour INS-C
          idType = 'NI'; // National identifier pour INS-C
        } else if (namespaceName.includes('ADELI')) {
          officialType = 'ADELI';
          system = 'urn:oid:1.2.250.1.71.4.2.1'; // OID officiel pour ADELI
        } else if (namespaceName.includes('RPPS')) {
          officialType = 'RPPS';
          system = 'urn:oid:1.2.250.1.71.4.2.1'; // OID officiel pour RPPS
        } else if (namespaceName.includes('FINESS')) {
          officialType = 'FINESS';
          system = 'urn:oid:1.2.250.1.71.4.2.2'; // OID officiel pour FINESS
        } else if (namespaceName.includes('SIRET')) {
          officialType = 'SIRET';
          system = 'urn:oid:1.2.250.1.71.4.2.2'; // OID officiel pour SIRET
        } else if (oid) {
          // Utiliser l'OID directement si fourni
          system = `urn:oid:${oid}`;
          
          // Détection des identifiants français basée sur l'OID uniquement
          if (oid === '1.2.250.1.213.1.4.8') {
            officialType = 'INS';
            idType = 'NI'; // National identifier pour INS
          } else if (oid === '1.2.250.1.213.1.4.2') {
            officialType = 'INS-C';
            idType = 'NI'; // National identifier pour INS-C
          } else if (oid === '1.2.250.1.71.4.2.1') {
            officialType = idType === 'ADELI' ? 'ADELI' : 'RPPS';
          } else if (oid === '1.2.250.1.71.4.2.2') {
            officialType = idType === 'FINESS' ? 'FINESS' : 'SIRET';
          }
        } else {
          // Si pas d'OID mais un namespace, utiliser le namespace comme système
          system = `urn:system:${namespaceName}`;
        }
      } else if (idType === 'PI' || idType === 'NH') {
        // IPP (Patient Internal) ou Numéro d'hospitalisation
        system = 'urn:oid:1.2.250.1.71.4.2.7'; // OID pour identifiants internes
      }
      
      // Utiliser les mappings de terminologie française
      if (officialType) {
        const idInfo = frenchTerminology.getIdentifierInfo(officialType);
        
        // Créer l'identifiant avec les informations françaises
        const identifier = {
          value: idValue,
          system: idInfo.system,
          type: {
            coding: [{
              system: 'http://terminology.hl7.org/CodeSystem/v2-0203',
              code: officialType === 'INS' || officialType === 'INS-C' ? 'NI' : idInfo.typeCode,
              display: officialType === 'INS' || officialType === 'INS-C' ? 'National unique identifier' : idInfo.display
            }]
          }
        };
        
        // Ajouter l'établissement d'assignation si disponible
        if (assigningAuthority) {
          identifier.assigner = { 
            display: assigningAuthority.split('&')[0] 
          };
        }
        
        // Extensions spécifiques françaises
        if (officialType === 'INS') {
          identifier.extension = [{
            url: frenchTerminology.FRENCH_EXTENSIONS.INS_STATUS,
            valueCode: 'VALI'
          }];
        }
        
        identifiers.push(identifier);
      } else {
        // Identifiants standard (non français)
        const identifier = {
          value: idValue,
          system: system
        };
        
        // Ajouter l'établissement d'assignation si disponible
        if (assigningAuthority) {
          identifier.assigner = { 
            display: assigningAuthority.split('&')[0] 
          };
        }
        
        // Ajouter le type d'identifiant
        identifier.type = {
          coding: [{
            system: 'http://terminology.hl7.org/CodeSystem/v2-0203',
            code: idType,
            display: getIdentifierTypeDisplay(idType)
          }]
        };
        
        identifiers.push(identifier);
      }
    }
  }
  // Si nous avons un tableau, traiter chaque élément
  else if (Array.isArray(identifierField)) {
    // Garder une trace des identifiants déjà traités pour éviter les doublons
    const processedIds = new Set();
    
    // Traiter chaque élément comme un identifiant potentiel
    identifierField.forEach(item => {
      if (typeof item === 'string') {
        const ids = extractIdentifiers(item);
        // Filtrer les identifiants pour éviter les duplications
        ids.forEach(id => {
          const idKey = `${id.system}|${id.value}`;
          if (!processedIds.has(idKey)) {
            identifiers.push(id);
            processedIds.add(idKey);
          }
        });
      } else if (Array.isArray(item)) {
        item.forEach(subItem => {
          if (typeof subItem === 'string') {
            const ids = extractIdentifiers(subItem);
            // Filtrer les identifiants pour éviter les duplications
            ids.forEach(id => {
              const idKey = `${id.system}|${id.value}`;
              if (!processedIds.has(idKey)) {
                identifiers.push(id);
                processedIds.add(idKey);
              }
            });
          }
        });
      }
    });
  }
  
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
    'INS': 'National unique identifier',
    'INS-C': 'National unique identifier',
    'NI': 'National unique identifier',
    'NH': 'Numéro d\'hospitalisation'
  };
  
  return typeMap[idType] || idType;
}

/**
 * Extrait les noms du patient à partir du champ PID-5
 * @param {Array|string} nameFields - Tableau ou chaîne de noms
 * @returns {Array} Tableau de noms FHIR
 */
function extractNames(nameFields) {
  console.log('[CONVERTER] Extraction des noms à partir de:', JSON.stringify(nameFields));
  
  if (!nameFields) {
    console.log('[CONVERTER] Aucun champ de nom fourni');
    return [];
  }
  
  const names = [];
  
  // Si nous avons une chaîne, c'est un seul nom
  if (typeof nameFields === 'string') {
    console.log('[CONVERTER] Traitement du nom (chaîne):', nameFields);
    const parts = nameFields.split('^');
    const familyName = parts[0] || '';
    const givenName = parts[1] || '';
    const middleName = parts[2] || '';
    const suffix = parts[3] || '';
    const prefix = parts[4] || '';
    const degree = parts[5] || '';
    
    // 7ème composant (XPN.7) contient le type d'utilisation du nom (D=maiden, L=legal)
    const useCode = parts[6] || '';
    
    // Construction des objets de nom selon la structure et type détectés
    if (familyName || givenName || middleName) {
      // Type de nom selon composant 7
      let useType = 'official';
      if (useCode === 'D') {
        useType = 'maiden';
      } else if (useCode === 'L') {
        useType = 'official';
      }
      
      // Objet nom selon spécifications FHIR
      const nameObj = {
        use: useType
      };
      
      if (familyName) {
        nameObj.family = familyName;
      }
      
      const givenNames = [];
      
      // Prénom principal
      if (givenName) {
        // Traiter les prénoms composés (spécificité française)
        if (givenName.includes(' ')) {
          givenNames.push(...givenName.split(' ').filter(Boolean));
        } else {
          givenNames.push(givenName);
        }
      }
      
      // Prénom secondaire / nom d'usage
      if (middleName) {
        // Traiter les prénoms composés pour le middle name aussi
        if (middleName.includes(' ')) {
          givenNames.push(...middleName.split(' ').filter(Boolean));
        } else {
          givenNames.push(middleName);
        }
      }
      
      if (givenNames.length > 0) {
        nameObj.given = givenNames;
      }
      
      // Préfixe (Monsieur, Madame, etc.)
      if (prefix) {
        nameObj.prefix = [prefix];
      }
      
      // Suffixe (Jr, PhD, etc.)
      if (suffix || degree) {
        const suffixes = [];
        if (suffix) suffixes.push(suffix);
        if (degree) suffixes.push(degree);
        nameObj.suffix = suffixes;
      }
      
      console.log('[CONVERTER] Nom extrait:', JSON.stringify(nameObj));
      names.push(nameObj);
    }
    
    return names;
  }
  
  // Si nous avons un tableau (format pour les nouveaux parsers HL7)
  if (Array.isArray(nameFields)) {
    console.log('[CONVERTER] Traitement des noms (tableau):', JSON.stringify(nameFields).substring(0, 200));
    
    // Parcourir chaque élément du tableau
    nameFields.forEach(field => {
      if (!field) return;
      
      // Si c'est une chaîne dans un tableau
      if (typeof field === 'string') {
        const fieldNames = extractNames(field);
        names.push(...fieldNames);
      }
      // Si c'est un tableau ou un objet
      else if (Array.isArray(field) || typeof field === 'object') {
        // Cas 1: C'est un tableau direct (structure [family, given, middle, ...])
        if (Array.isArray(field)) {
          const familyName = field[0] || '';
          const givenName = field[1] || '';
          const middleName = field[2] || '';
          const suffix = field[3] || '';
          const prefix = field[4] || '';
          const degree = field[5] || '';
          const useCode = field.length > 6 ? field[6] || '' : '';
          
          // Type de nom selon composant 7
          let useType = 'official';
          if (useCode === 'D') {
            useType = 'maiden';
          } else if (useCode === 'L') {
            useType = 'official';
          }
          
          if (familyName || givenName || middleName) {
            const nameObj = {
              use: useType
            };
            
            if (familyName) {
              nameObj.family = familyName;
            }
            
            const givenNames = [];
            
            // Prénom principal
            if (givenName) {
              if (typeof givenName === 'string' && givenName.includes(' ')) {
                givenNames.push(...givenName.split(' ').filter(Boolean));
              } else {
                givenNames.push(givenName);
              }
            }
            
            // Prénom secondaire
            if (middleName) {
              if (typeof middleName === 'string' && middleName.includes(' ')) {
                givenNames.push(...middleName.split(' ').filter(Boolean));
              } else {
                givenNames.push(middleName);
              }
            }
            
            if (givenNames.length > 0) {
              nameObj.given = givenNames;
            }
            
            // Préfixe
            if (prefix) {
              nameObj.prefix = [prefix];
            }
            
            // Suffixe
            if (suffix || degree) {
              const suffixes = [];
              if (suffix) suffixes.push(suffix);
              if (degree) suffixes.push(degree);
              nameObj.suffix = suffixes;
            }
            
            console.log('[CONVERTER] Nom extrait (tableau):', JSON.stringify(nameObj));
            names.push(nameObj);
          }
        }
        // Cas 2: C'est un objet avec des composants (format habituel de simple-hl7)
        else if (field.components) {
          const components = field.components;
          
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
            
            console.log('[CONVERTER] Nom extrait (objet):', JSON.stringify(nameObj));
            names.push(nameObj);
          }
        }
      }
    });
  }
  
  console.log('[CONVERTER] Total noms extraits:', names.length);
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
 * @param {Object|string} genderField - Champ de genre
 * @returns {string} Genre FHIR
 */
function determineGender(genderField) {
  console.log('[CONVERTER] Gender field received:', typeof genderField, genderField);
  
  if (!genderField) {
    return 'unknown';
  }
  
  // Extraire la valeur du champ selon son type
  let genderValue = '';
  
  if (typeof genderField === 'string') {
    // Si c'est une chaîne, l'utiliser directement
    genderValue = genderField;
  } else if (typeof genderField === 'object') {
    // Si c'est un objet, essayer différentes façons d'extraire la valeur
    if (genderField.value) {
      genderValue = genderField.value;
    } else if (genderField.toString && typeof genderField.toString === 'function') {
      genderValue = genderField.toString();
    }
  }
  
  // Normaliser et traiter la valeur du genre
  if (!genderValue) {
    return 'unknown';
  }
  
  const gender = genderValue.toString().toUpperCase().trim();
  
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
 * @param {Object|string} birthDateField - Champ de date de naissance
 * @returns {string} Date de naissance au format YYYY-MM-DD
 */
function formatBirthDate(birthDateField) {
  if (!birthDateField) {
    return null;
  }
  
  // Extraire la valeur du champ selon son type
  let dateValue = '';
  
  if (typeof birthDateField === 'string') {
    // Si c'est une chaîne, l'utiliser directement
    dateValue = birthDateField;
  } else if (typeof birthDateField === 'object') {
    // Si c'est un objet, essayer différentes façons d'extraire la valeur
    if (birthDateField.value) {
      dateValue = birthDateField.value;
    } else if (birthDateField.toString && typeof birthDateField.toString === 'function') {
      dateValue = birthDateField.toString();
    }
  }
  
  if (!dateValue) {
    return null;
  }
  
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
 * @param {Object|string} maritalStatusField - Champ d'état civil
 * @returns {Object} État civil FHIR
 */
function determineMaritalStatus(maritalStatusField) {
  if (!maritalStatusField) {
    return null;
  }
  
  // Extraire la valeur du champ selon son type
  let maritalStatus = '';
  
  if (typeof maritalStatusField === 'string') {
    // Si c'est une chaîne, l'utiliser directement
    maritalStatus = maritalStatusField;
  } else if (typeof maritalStatusField === 'object') {
    // Si c'est un objet, essayer différentes façons d'extraire la valeur
    if (maritalStatusField.value) {
      maritalStatus = maritalStatusField.value;
    } else if (maritalStatusField.toString && typeof maritalStatusField.toString === 'function') {
      maritalStatus = maritalStatusField.toString();
    }
  }
  
  if (!maritalStatus) {
    return null;
  }
  
  // Normaliser pour le traitement
  maritalStatus = maritalStatus.toString().trim().toUpperCase().charAt(0);
  
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
 * @param {Array} pv1Segment - Segment PV1 parsé
 * @param {string} patientReference - Référence à la ressource Patient
 * @returns {Object} Entrée de bundle pour un Encounter
 */
function createEncounterResource(pv1Segment, patientReference) {
  if (!pv1Segment) {
    return null;
  }
  
  // Utiliser un UUID v4 conforme aux recommandations de l'ANS
  const encounterId = uuid.v4();
  
  // Déterminer la classe d'encounter (PV1-2)
  const patientClass = pv1Segment[2] || '';
  const encounterClass = mapPatientClassToFHIR(patientClass);
  
  // Statut de l'encounter (PV1-36 = disposition)
  const dischargeDisposition = pv1Segment.length > 36 ? pv1Segment[36] || '' : '';
  const encounterStatus = determineEncounterStatus(dischargeDisposition);
  
  // Période de l'encounter
  let admitDate = null;
  if (pv1Segment.length > 44 && pv1Segment[44]) {
    admitDate = formatHL7DateTime(pv1Segment[44]);
  }
  
  // Numéro de visite/séjour (PV1-19 = visit number)
  let visitNumber = null;
  // Assurer que la valeur est une chaîne et non un tableau
  if (pv1Segment.length > 19) {
    if (Array.isArray(pv1Segment[19])) {
      // Si c'est un tableau, prendre la première valeur non vide
      visitNumber = pv1Segment[19].find(v => v && (typeof v === 'string' || v.value));
      // Extraire la valeur si c'est un objet
      if (visitNumber && typeof visitNumber === 'object' && visitNumber.value) {
        visitNumber = visitNumber.value;
      }
    } else if (pv1Segment[19] && typeof pv1Segment[19] === 'object' && pv1Segment[19].value) {
      // Si c'est un objet avec une propriété value
      visitNumber = pv1Segment[19].value;
    } else {
      // Si c'est une chaîne ou autre valeur primitive
      visitNumber = pv1Segment[19];
    }
  }
  
  // Créer la ressource Encounter avec extensions françaises
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
    },
    // Extensions françaises selon les spécifications ANS
    extension: []
  };
  
  // Extension pour le mode de prise en charge (spécification française)
  if (patientClass) {
    const frenchClassMapping = {
      'I': { code: 'HOSPITALT', display: 'Hospitalisation traditionnelle' },
      'O': { code: 'CONSULT', display: 'Consultation externe' },
      'E': { code: 'URMG', display: 'Urgences' },
      'P': { code: 'CONSULT', display: 'Consultation externe' },
      'R': { code: 'HOSPITALT', display: 'Hospitalisation traditionnelle' },
      'B': { code: 'CONSULT', display: 'Consultation externe' },
      'N': { code: 'HOSPITALT', display: 'Hospitalisation traditionnelle' }
    };
    
    if (frenchClassMapping[patientClass]) {
      encounterResource.extension.push({
        url: "https://interop.esante.gouv.fr/ig/fhir/core/StructureDefinition/fr-mode-prise-en-charge",
        valueCodeableConcept: {
          coding: [{
            system: frenchTerminology.FRENCH_SYSTEMS.MODE_PRISE_EN_CHARGE,
            code: frenchClassMapping[patientClass].code,
            display: frenchClassMapping[patientClass].display
          }]
        }
      });
    }
  }
  
  // Ajouter la période si disponible
  if (admitDate) {
    encounterResource.period = {
      start: admitDate
    };
  }
  
  // Ajouter l'identifiant de visite si disponible avec format français
  if (visitNumber) {
    // S'assurer que la valeur est bien une chaîne
    const visitNumberStr = typeof visitNumber === 'string' ? visitNumber : String(visitNumber);
    
    encounterResource.identifier = [{
      system: 'urn:oid:1.2.250.1.71.4.2.7', // OID français conforme à l'ANS pour identifiants internes
      value: visitNumberStr, // Valeur unique sous forme de chaîne (pas de tableau)
      type: {
        coding: [{
          system: "http://terminology.hl7.org/CodeSystem/v2-0203",
          code: "VN",
          display: "Numéro de visite"
        }]
      }
    }];
  }
  
  // Si pas d'extensions ajoutées, supprimer le tableau vide
  if (encounterResource.extension && encounterResource.extension.length === 0) {
    delete encounterResource.extension;
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
 * @param {Array} mshSegment - Segment MSH parsé
 * @param {number} fieldIndex - Index du champ (4 pour sending, 6 pour receiving)
 * @returns {Object|null} Entrée de bundle pour une Organization ou null si non disponible
 */
function createOrganizationResource(mshSegment, fieldIndex) {
  if (!mshSegment || mshSegment.length <= fieldIndex) {
    return null;
  }
  
  const field = mshSegment[fieldIndex];
  if (!field) {
    return null;
  }
  
  // Si le champ est une chaîne, le traiter
  let orgName = '';
  let orgId = '';
  let oid = null;
  
  if (typeof field === 'string') {
    // Parser les composants s'il y en a
    const fieldParts = field.split('^');
    
    // Identifier et nom (component 1)
    orgName = fieldParts[0] || '';
    if (!orgName) {
      return null;
    }
    
    // Identifiant de l'organisation (component 2)
    // Générer un identifiant stable basé sur le nom plutôt qu'un horodatage
    if (fieldParts.length > 1 && fieldParts[1]) {
      orgId = fieldParts[1];
    } else {
      // Utiliser le nom de l'organisation pour générer un ID stable
      // Nous convertissons le nom en un identifiant alphanumérique sans caractères spéciaux
      orgId = `org-${orgName.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()}`;
    }
    
    // Namespace (component 3)
    if (fieldParts.length > 2 && fieldParts[2] && fieldParts[2].includes('&')) {
      const namespaceComponents = fieldParts[2].split('&');
      if (namespaceComponents.length > 1) {
        oid = namespaceComponents[1];
      }
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
 * @param {Array} rolSegment - Segment ROL parsé
 * @returns {Object|null} Entrée de bundle pour un Practitioner ou null si non disponible
 */
function createPractitionerResource(rolSegment) {
  console.log('[CONVERTER] Création de ressource Practitioner à partir de:', JSON.stringify(rolSegment).substring(0, 200));
  
  if (!rolSegment || rolSegment.length <= 4) {
    console.log('[CONVERTER] Échec: segment ROL trop court');
    return null;
  }
  
  // ROL-4 (Role Person)
  const rolePerson = rolSegment[4];
  if (!rolePerson) {
    console.log('[CONVERTER] Échec: ROL-4 (Role Person) manquant');
    return null;
  }
  
  let idValue = '';
  let familyName = '';
  let givenName = '';
  let oid = '1.2.250.1.71.4.2.1'; // OID par défaut
  
  console.log('[CONVERTER] Type de ROL-4:', typeof rolePerson, 'Valeur:', JSON.stringify(rolePerson));
  
  try {
    // Si c'est une chaîne, parser les composants
    if (typeof rolePerson === 'string') {
      console.log('[CONVERTER] Parsing de ROL-4 (chaîne):', rolePerson);
      const rolePersonParts = rolePerson.split('^');
      
      // Identifiant (component 1)
      idValue = rolePersonParts[0] || '';
      
      // Nom (components 2-3)
      familyName = rolePersonParts.length > 1 ? rolePersonParts[1] || '' : '';
      givenName = rolePersonParts.length > 2 ? rolePersonParts[2] || '' : '';
      
      // ROL-4.4 (Assigning Authority)
      if (rolePersonParts.length > 3 && rolePersonParts[3] && rolePersonParts[3].includes('&')) {
        const assigningAuthority = rolePersonParts[3];
        const authorityComponents = assigningAuthority.split('&');
        if (authorityComponents.length > 1 && authorityComponents[1]) {
          oid = authorityComponents[1];
        }
      }
    }
    // Si c'est un tableau (cas du nouveau parser)
    else if (Array.isArray(rolePerson)) {
      console.log('[CONVERTER] Parsing de ROL-4 (tableau):', JSON.stringify(rolePerson));
      
      // Identifiant (component 1)
      idValue = rolePerson[0] || '';
      
      // Nom (components 2-3)
      familyName = rolePerson.length > 1 ? rolePerson[1] || '' : '';
      givenName = rolePerson.length > 2 ? rolePerson[2] || '' : '';
      
      // ROL-4.4 (Assigning Authority)
      if (rolePerson.length > 3 && rolePerson[3] && typeof rolePerson[3] === 'string' && rolePerson[3].includes('&')) {
        const assigningAuthority = rolePerson[3];
        const authorityComponents = assigningAuthority.split('&');
        if (authorityComponents.length > 1 && authorityComponents[1]) {
          oid = authorityComponents[1];
        }
      } else if (rolePerson.length > 3 && rolePerson[3] && typeof rolePerson[3] === 'object') {
        // Si c'est un objet complexe, essayons de trouver l'OID
        const assigningAuth = rolePerson[3];
        if (assigningAuth.namespaceId && assigningAuth.universalId) {
          oid = assigningAuth.universalId;
        }
      }
    }
    
    console.log('[CONVERTER] Données extraites - ID:', idValue, 'Nom:', familyName, 'Prénom:', givenName);
  } catch (error) {
    console.error('[CONVERTER] Erreur lors de l\'extraction des données du praticien:', error);
    // Définir des valeurs par défaut en cas d'erreur
    idValue = idValue || `unknown-${Date.now()}`;
    familyName = familyName || 'Nom non spécifié';
  }
  
  console.log('[CONVERTER] Tentative de création du praticien avec ID:', idValue, 'Nom:', familyName, 'Prénom:', givenName);
  if (!idValue && !familyName && !givenName) {
    console.log('[CONVERTER] Données insuffisantes pour créer un praticien');
    return null;
  }
  
  const practitionerId = `practitioner-${idValue || uuid.v4()}`;
  
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
  
  // Optimisation des identifiants pour conformité ANS
  if (practitionerResource.identifier && practitionerResource.identifier.length > 0) {
    // Déterminer si nous avons un identifiant RPPS ou ADELI
    let hasRppsOrAdeli = false;
    
    practitionerResource.identifier.forEach(id => {
      if (id.system && id.system.includes('1.2.250.1.71.4.2.1')) {
        // Identifier le type selon le système ou la valeur
        if (id.value) {
          // Ajouter le type d'identifiant explicite selon les spécifications ANS
          id.type = {
            coding: [{
              system: 'http://terminology.hl7.org/CodeSystem/v2-0203',
              code: id.value.length === 11 ? 'RPPS' : 'ADELI',
              display: id.value.length === 11 ? 'Numéro RPPS' : 'Numéro ADELI'
            }]
          };
          hasRppsOrAdeli = true;
        }
      }
    });
    
    // Si pas d'identifiant RPPS ou ADELI, marquer l'identifiant comme PI
    if (!hasRppsOrAdeli && practitionerResource.identifier.length > 0) {
      practitionerResource.identifier[0].type = {
        coding: [{
          system: 'http://terminology.hl7.org/CodeSystem/v2-0203',
          code: 'PI',
          display: 'Identifiant interne'
        }]
      };
    }
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
 * @param {Array} rolSegment - Segment ROL parsé
 */
function addFrenchPractitionerExtensions(practitionerResource, rolSegment) {
  // Ajouter les extensions spécifiques aux praticiens français
  practitionerResource.extension = practitionerResource.extension || [];
  
  // Extension pour la spécialité médicale
  if (rolSegment.length > 3 && rolSegment[3]) {
    const roleCode = rolSegment[3];
    const roleInfo = frenchTerminology.getProfessionInfo(roleCode);
    
    // Extension pour la profession selon la nomenclature ANS
    practitionerResource.extension.push({
      url: frenchTerminology.FRENCH_EXTENSIONS.PRACTITIONER_PROFESSION,
      valueCodeableConcept: {
        coding: [{
          system: frenchTerminology.FRENCH_SYSTEMS.PROFESSION,
          code: roleInfo.code,
          display: roleInfo.display
        }]
      }
    });
  }
  
  // Extension pour la nationalité (par défaut française)
  practitionerResource.extension.push({
    url: frenchTerminology.FRENCH_EXTENSIONS.NATIONALITY,
    valueCodeableConcept: {
      coding: [{
        system: frenchTerminology.FRENCH_SYSTEMS.PAYS,
        code: "FRA",
        display: "France"
      }]
    }
  });
  
  // Identifier l'ID (RPPS ou ADELI) dans les identifiants et l'ajouter comme extension
  const rppsId = practitionerResource.identifier.find(id => 
    id.system && (id.system.includes('1.2.250.1.71.4.2.1') || id.system.includes('1.2.250.1.213.1.1.1')));
  
  if (rppsId) {
    // Créer l'extension avec la qualification selon ANS
    practitionerResource.qualification = [{
      identifier: [{
        system: rppsId.system,
        value: rppsId.value
      }],
      code: {
        coding: [{
          system: frenchTerminology.FRENCH_SYSTEMS.PROFESSION,
          code: rolSegment.length > 3 ? rolSegment[3] : "ODRP",
          display: rolSegment.length > 3 ? getRoleTypeDisplay(rolSegment[3]) : "Médecin"
        }]
      }
    }];
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
 * @param {Array} rolSegment - Segment ROL parsé
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
  const roleCode = rolSegment.length > 3 ? rolSegment[3] : null;
  
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
 * @param {Array} nk1Segment - Segment NK1 parsé
 * @param {string} patientReference - Référence à la ressource Patient
 * @returns {Object|null} Entrée de bundle pour un RelatedPerson ou null si non disponible
 */
function createRelatedPersonResource(nk1Segment, patientReference) {
  console.log('[CONVERTER] Création de ressource RelatedPerson à partir de:', JSON.stringify(nk1Segment).substring(0, 200));
  
  if (!nk1Segment || !patientReference || nk1Segment.length <= 2) {
    console.log('[CONVERTER] Échec: segment NK1 trop court ou référence patient manquante');
    return null;
  }
  
  // NK1-2 (Nom)
  const nameField = nk1Segment[2];
  if (!nameField) {
    console.log('[CONVERTER] Échec: NK1-2 (Nom) manquant');
    return null;
  }
  
  let familyName = '';
  let givenName = '';
  
  console.log('[CONVERTER] Type de NK1-2:', typeof nameField, 'Valeur:', JSON.stringify(nameField));
  
  // Si le champ est une chaîne, analyser les composants
  if (typeof nameField === 'string') {
    console.log('[CONVERTER] Parsing de NK1-2 (chaîne):', nameField);
    const nameParts = nameField.split('^');
    familyName = nameParts[0] || '';
    givenName = nameParts.length > 1 ? nameParts[1] || '' : '';
  }
  // Si c'est un tableau (cas du nouveau parser)
  else if (Array.isArray(nameField)) {
    console.log('[CONVERTER] Parsing de NK1-2 (tableau):', JSON.stringify(nameField));
    
    // Nom (components 1-2)
    familyName = nameField.length > 0 ? nameField[0] || '' : '';
    givenName = nameField.length > 1 ? nameField[1] || '' : '';
  }
  
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
  if (nk1Segment.length > 3 && nk1Segment[3]) {
    const relationshipField = nk1Segment[3];
    let relationshipCode = '';
    
    console.log('[CONVERTER] Type de NK1-3:', typeof relationshipField, 'Valeur:', JSON.stringify(relationshipField));
    
    // Si c'est une chaîne, traiter directement
    if (typeof relationshipField === 'string') {
      console.log('[CONVERTER] Parsing de NK1-3 (chaîne):', relationshipField);
      // Essayer de trouver un code standard
      const relationCodes = ['SPO', 'DOM', 'CHD', 'PAR', 'SIB', 'GRD'];
      
      // Chercher dans les composants (séparés par ^)
      const relationParts = relationshipField.split('^');
      
      for (const part of relationParts) {
        if (relationCodes.includes(part)) {
          relationshipCode = part;
          break;
        }
      }
      
      // Si aucun code standard n'est trouvé, utiliser le premier composant
      if (!relationshipCode && relationParts.length > 0) {
        relationshipCode = relationParts[0];
      }
    }
    // Si c'est un tableau (cas du nouveau parser)
    else if (Array.isArray(relationshipField)) {
      console.log('[CONVERTER] Parsing de NK1-3 (tableau):', JSON.stringify(relationshipField));
      // Essayer de trouver un code standard dans le tableau
      const relationCodes = ['SPO', 'DOM', 'CHD', 'PAR', 'SIB', 'GRD'];
      
      // Parcourir le tableau à la recherche d'un code connu
      for (const part of relationshipField) {
        if (typeof part === 'string' && relationCodes.includes(part)) {
          relationshipCode = part;
          break;
        }
      }
      
      // Si aucun code standard n'est trouvé, utiliser le premier élément du tableau s'il existe
      if (!relationshipCode && relationshipField.length > 0 && typeof relationshipField[0] === 'string') {
        relationshipCode = relationshipField[0];
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
 * @param {Array} in1Segment - Segment IN1 parsé
 * @param {Array} in2Segment - Segment IN2 parsé (optionnel)
 * @param {string} patientReference - Référence à la ressource Patient
 * @returns {Object|null} Entrée de bundle pour un Coverage ou null si non disponible
 */
function createCoverageResource(in1Segment, in2Segment, patientReference) {
  if (!in1Segment || !patientReference) {
    return null;
  }
  
  // IN1-2 (Plan ID)
  const planId = in1Segment.length > 2 ? in1Segment[2] || '' : '';
  
  // IN1-12 (Policy Expiration Date)
  const expirationDate = in1Segment.length > 12 ? in1Segment[12] || '' : '';
  
  // IN1-16 (Name of Insured)
  const insuredNameField = in1Segment.length > 16 ? in1Segment[16] : null;
  
  if (!planId && !insuredNameField) {
    return null;
  }
  
  // Générer un ID stable basé sur l'identifiant du plan plutôt qu'un horodatage
  const coverageId = `coverage-${planId ? planId.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase() : uuid.v4()}`;
  
  // Créer la ressource Coverage
  const coverageResource = {
    resourceType: 'Coverage',
    id: coverageId,
    status: 'active',
    beneficiary: {
      reference: patientReference
    }
  };
  
  // Ajouter le type de couverture selon les normes ANS
  if (planId) {
    // Mappages vers les codes de type de couverture français (TRE_R28-TypeCouverture)
    // Nous utilisons des codes ANS standards au lieu des codes ActCode
    let coverageType = 'AMO'; // Assurance Maladie Obligatoire par défaut
    
    // Tenter de déterminer le type exact de couverture
    if (typeof planId === 'string') {
      // Si c'est une couverture complémentaire (mutuelle)
      if (planId.toUpperCase().includes('MUTUEL') || planId.toUpperCase().includes('COMPLEMENT')) {
        coverageType = 'AMC'; // Assurance Maladie Complémentaire
      }
      // Si c'est une prise en charge à 100%
      else if (planId.toUpperCase().includes('ALD') || planId.toUpperCase().includes('100%')) {
        coverageType = 'ALD'; // Affection Longue Durée
      }
      // Si c'est lié à un accident du travail
      else if (planId.toUpperCase().includes('AT') || planId.toUpperCase().includes('MP')) {
        coverageType = 'ATMP'; // Accident du Travail - Maladie Professionnelle
      }
    }
    
    coverageResource.type = {
      coding: [{
        system: frenchTerminology.FRENCH_SYSTEMS.TYPE_COUVERTURE,
        code: coverageType,
        display: coverageType === 'AMO' ? 'Assurance Maladie Obligatoire' :
                coverageType === 'AMC' ? 'Assurance Maladie Complémentaire' :
                coverageType === 'ALD' ? 'Affection Longue Durée' :
                coverageType === 'ATMP' ? 'Accident du Travail - Maladie Professionnelle' : 'Assurance Maladie'
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
  if (insuredNameField && typeof insuredNameField === 'string') {
    const components = insuredNameField.split('^');
    if (components.length > 0 && components[0]) {
      coverageResource.subscriberId = components[0];
    }
  }
  
  // Extension française: numéro AMC/AMO
  if (in1Segment.length > 36 && in1Segment[36]) {
    const insuredId = in1Segment[36];
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
 * @param {Array} zbeSegment - Segment ZBE parsé
 * @returns {Object} Données extraites du segment ZBE
 */
function processZBESegment(zbeSegment) {
  if (!zbeSegment) {
    return {};
  }
  
  const zbeData = {};
  
  // ZBE-1 (Mouvement : EH_xxxx)
  if (zbeSegment.length > 1 && zbeSegment[1]) {
    zbeData.movementId = zbeSegment[1];
  }
  
  // ZBE-2 (Date d'effet)
  if (zbeSegment.length > 2 && zbeSegment[2]) {
    zbeData.effectiveDate = formatHL7DateTime(zbeSegment[2]);
  }
  
  // ZBE-4 (Type de mouvement)
  if (zbeSegment.length > 4 && zbeSegment[4]) {
    zbeData.movementType = zbeSegment[4];
  }
  
  // ZBE-7 (Unité fonctionnelle)
  if (zbeSegment.length > 7 && zbeSegment[7]) {
    const unitField = zbeSegment[7];
    
    if (typeof unitField === 'string' && unitField.includes('^')) {
      const ufComponents = unitField.split('^');
      if (ufComponents.length > 8) {
        zbeData.functionalUnit = ufComponents[8];
        zbeData.functionalUnitDisplay = ufComponents.length > 9 ? ufComponents[9] : null;
      }
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
  // Utiliser l'adaptateur de terminologie française pour la conformité ANS
  return frenchTerminology.getMovementTypeInfo(movementType).display;
}

/**
 * Traite les données du segment ZFP (spécifique français - infos patient)
 * @param {Array} zfpSegment - Segment ZFP parsé
 * @returns {Object} Données extraites du segment ZFP
 */
function processZFPSegment(zfpSegment) {
  if (!zfpSegment) {
    return {};
  }
  
  const zfpData = {};
  
  // ZFP-1 (Informations administratives patient)
  if (zfpSegment.length > 1 && zfpSegment[1]) {
    zfpData.administrativeInfo = zfpSegment[1];
  }
  
  // ZFP-2 (Informations complémentaires patient)
  if (zfpSegment.length > 2 && zfpSegment[2]) {
    zfpData.additionalInfo = zfpSegment[2];
  }
  
  return zfpData;
}

/**
 * Traite les données du segment ZFV (spécifique français - infos visite)
 * @param {Array} zfvSegment - Segment ZFV parsé
 * @returns {Object} Données extraites du segment ZFV
 */
function processZFVSegment(zfvSegment) {
  if (!zfvSegment) {
    return {};
  }
  
  const zfvData = {};
  
  // ZFV-1 (Encodage classe d'encounter)
  if (zfvSegment.length > 1 && zfvSegment[1]) {
    const encounterClassValue = zfvSegment[1];
    
    // Mapping des codes français vers les classes FHIR conformes à l'ANS
    const classMappings = {
      'H': { 
        code: 'IMP', 
        display: 'Hospitalisation',
        frenchSystem: frenchTerminology.FRENCH_SYSTEMS.MODE_PRISE_EN_CHARGE,
        frenchCode: 'HOSPITALT'
      },
      'U': { 
        code: 'EMER', 
        display: 'Urgences',
        frenchSystem: frenchTerminology.FRENCH_SYSTEMS.MODE_PRISE_EN_CHARGE,
        frenchCode: 'URMG'
      },
      'C': { 
        code: 'AMB', 
        display: 'Consultation externe',
        frenchSystem: frenchTerminology.FRENCH_SYSTEMS.MODE_PRISE_EN_CHARGE,
        frenchCode: 'CONSULT'
      },
      'E': { 
        code: 'AMB', 
        display: 'Consultation externe',
        frenchSystem: frenchTerminology.FRENCH_SYSTEMS.MODE_PRISE_EN_CHARGE,
        frenchCode: 'CONSULT'
      }
    };
    
    if (encounterClassValue && classMappings[encounterClassValue]) {
      // Structure standard pour le code de classe d'encounter
      zfvData.encounterClass = {
        system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
        code: classMappings[encounterClassValue].code,
        display: classMappings[encounterClassValue].display
      };
      
      // Extension française avec les codes de la terminologie ANS
      zfvData.modePriseEnCharge = {
        system: classMappings[encounterClassValue].frenchSystem,
        code: classMappings[encounterClassValue].frenchCode,
        display: classMappings[encounterClassValue].display
      };
    }
  }
  
  return zfvData;
}

/**
 * Traite les données du segment ZFM (spécifique français - infos médicales)
 * @param {Array} zfmSegment - Segment ZFM parsé
 * @returns {Object} Données extraites du segment ZFM
 */
function processZFMSegment(zfmSegment) {
  if (!zfmSegment) {
    return {};
  }
  
  const zfmData = {};
  
  // ZFM-1 (Type d'hospitalisation)
  if (zfmSegment.length > 1 && zfmSegment[1]) {
    zfmData.hospitalizationType = zfmSegment[1];
  }
  
  // ZFM-2 (Mode d'entrée)
  if (zfmSegment.length > 2 && zfmSegment[2]) {
    zfmData.admissionMode = zfmSegment[2];
  }
  
  // ZFM-3 (Mode de sortie)
  if (zfmSegment.length > 3 && zfmSegment[3]) {
    zfmData.dischargeMode = zfmSegment[3];
  }
  
  return zfmData;
}

module.exports = {
  convertHL7ToFHIR
};