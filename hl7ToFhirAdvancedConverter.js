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
const { extractFrenchNames } = require('./src/utils/frenchNameExtractor');

/**
 * Convertit un message HL7 en bundle FHIR conforme aux spécifications ANS (France)
 * Optimisé pour les identifiants INS/INS-C et terminologies françaises
 * @version 1.1.2
 * @updated 2025-04-29
 * @param {string} hl7Message - Message HL7 au format texte
 * @returns {Object} Bundle FHIR au format R4 conforme ANS
 */
function convertHL7ToFHIR(hl7Message) {
  // Variable globale pour stocker toutes les entrées du bundle, y compris les ressources additionnelles
  // comme les organismes d'assurance
  const bundleEntries = [];
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
      
      // Encounter (à partir des segments PV1 et PV2)
      if (segments.PV1 && segments.PV1.length > 0) {
        // Récupérer le segment PV2 s'il est disponible
        const pv2Segment = segments.PV2 && segments.PV2.length > 0 ? segments.PV2[0] : null;
        
        if (pv2Segment) {
          console.log('[CONVERTER] Segment PV2 trouvé, contenu:', JSON.stringify(pv2Segment));
          
          // Chercher explicitement la date de sortie prévue dans le segment
          for (let i = 0; i < pv2Segment.length; i++) {
            if (pv2Segment[i] && /^\d{8,14}$/.test(pv2Segment[i])) {
              console.log(`[CONVERTER] Date potentielle à l'index ${i}:`, pv2Segment[i]);
            }
          }
        }
        
        const encounterResource = createEncounterResource(segments.PV1[0], patientResource.fullUrl, pv2Segment);
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
    
    // Ajouter les entrées additionnelles (comme les payors d'assurance) au bundle final
    if (bundleEntries && bundleEntries.length > 0) {
      console.log(`[CONVERTER] Ajout de ${bundleEntries.length} ressources additionnelles au bundle (organismes payeurs, etc.)`);
      bundle.entry = bundle.entry.concat(bundleEntries);
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
  
  // Log du PID-13 et PID-14 pour le debugging des téléphones
  console.log('[CONVERTER] PID-13 (Home Phone):', JSON.stringify(pidSegmentFields[13]));
  console.log('[CONVERTER] PID-14 (Work Phone):', JSON.stringify(pidSegmentFields[14]));
  
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
  
  // Extraire les télécom avec notre fonction standard
  let telecomData = extractTelecoms(pidSegmentFields[13], pidSegmentFields[14]);
  
  // Si aucun télécom n'a été trouvé, utiliser une extraction de secours directe
  if (!telecomData || telecomData.length === 0) {
    console.log('[CONVERTER] Aucun télécom trouvé avec la méthode standard, tentative directe...');
    telecomData = [];
    
    // Extraction directe du téléphone mobile
    if (pidSegmentFields[13] && Array.isArray(pidSegmentFields[13])) {
      // Format spécifique français PID-13: [["","PRN","PH","","","","","","","","","0608987212"]]
      pidSegmentFields[13].forEach(field => {
        if (Array.isArray(field) && field.length >= 12 && field[11]) {
          const phoneNumber = field[11];
          if (phoneNumber && /^\d+$/.test(phoneNumber)) {
            console.log('[CONVERTER] Numéro de téléphone trouvé directement:', phoneNumber);
            
            // Déterminer si c'est un mobile (06/07)
            const isMobile = phoneNumber.startsWith('06') || phoneNumber.startsWith('07');
            
            telecomData.push({
              system: 'phone',
              value: phoneNumber,
              use: isMobile ? 'mobile' : 'home'
            });
          }
        }
      });
    }
    
    // Extraction directe de l'email
    if (pidSegmentFields[13] && Array.isArray(pidSegmentFields[13])) {
      pidSegmentFields[13].forEach(field => {
        // Format typique français: ["","NET","Internet","MARYSE.SECLET@WANADOO.FR"]
        if (Array.isArray(field) && field.length >= 4 && field[1] === 'NET' && field[3]) {
          const email = field[3];
          if (email && email.includes('@')) {
            console.log('[CONVERTER] Email trouvé directement:', email);
            telecomData.push({
              system: 'email',
              value: email,
              use: 'home'
            });
          }
        }
        
        // Recherche dans les profondeurs du format HL7 (tout ce qui contient un @)
        if (field && typeof field === 'string' && field.includes('@')) {
          console.log('[CONVERTER] Email trouvé dans champ spécial:', field);
          telecomData.push({
            system: 'email',
            value: field,
            use: 'home'
          });
        }
        
        // Parcourir récursivement pour trouver les emails
        if (field && Array.isArray(field)) {
          field.forEach(subField => {
            if (subField && typeof subField === 'string' && subField.includes('@')) {
              console.log('[CONVERTER] Email trouvé dans sous-champ:', subField);
              telecomData.push({
                system: 'email',
                value: subField,
                use: 'home'
              });
            }
          });
        }
      });
    }
  }
  
  // Créer la ressource Patient
  const patientResource = {
    resourceType: 'Patient',
    id: patientId,
    identifier: optimizedIdentifiers,  // Utilisation des identifiants optimisés
    name: extractNames(pidSegmentFields[5]),
    gender: determineGender(pidSegmentFields[8]),
    birthDate: formatBirthDate(pidSegmentFields[7]),
    telecom: telecomData,
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
 * Gestion optimisée des identifiants selon les spécifications ANS (France)
 * @param {Array|string} identifierField - Champ d'identifiants
 * @returns {Array} Tableau d'identifiants FHIR
 */
function extractIdentifiers(identifierField) {
  console.log('[CONVERTER] Extraction des identifiants à partir de:', JSON.stringify(identifierField).substring(0, 200));
  
  if (!identifierField) {
    console.log('[CONVERTER] Pas d\'identifiants fournis');
    return [];
  }
  
  const identifiers = [];
  let hasINS = false; // Pour traquer si un INS a été trouvé
  let hasIPP = false; // Pour traquer si un IPP a été trouvé
  
  // Si nous avons une chaîne, traiter directement
  if (typeof identifierField === 'string') {
    const components = identifierField.split('^');
    const idValue = components[0];
    const idType = components[4] || 'PI';
    const assigningAuthority = components[3] || '';
    
    if (idValue) {
      console.log('[CONVERTER] Traitement identifiant:',idValue,'type:',idType,'autorité:',assigningAuthority);
      
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
        if (namespaceName.includes('ASIP-SANTE-INS-NIR') || 
            namespaceName.includes('INSEE-NIR') || 
            namespaceName.includes('INS-NIR') ||
            idType === 'INS' || idType === 'INS-NIR') {
          console.log('[CONVERTER] Identifiant INS-NIR détecté');
          officialType = 'INS';
          system = 'urn:oid:1.2.250.1.213.1.4.8'; // OID officiel pour INS-NIR
          hasINS = true;
        } else if (namespaceName.includes('ASIP-SANTE-INS-C') || 
                   namespaceName.includes('INS-C') ||
                   idType === 'INS-C') {
          console.log('[CONVERTER] Identifiant INS-C détecté');
          officialType = 'INS-C';
          system = 'urn:oid:1.2.250.1.213.1.4.8'; // OID officiel pour INS conformément à ANS
          hasINS = true;
        } else if (namespaceName.includes('ASIP-SANTE-INS-A') || 
                   namespaceName.includes('INS-A') ||
                   idType === 'INS-A' ||
                   idType === 'INS') {  // Parfois INS est utilisé pour les deux
          console.log('[CONVERTER] Identifiant INS-A détecté');
          officialType = 'INS';  // Même traitement que l'INS standard
          system = 'urn:oid:1.2.250.1.213.1.4.8'; // OID officiel pour INS conformément à ANS
          hasINS = true;
        } else if (idType === 'PI' || idType === 'NH' || idType === '') {
          console.log('[CONVERTER] Identifiant interne (IPP) détecté');
          officialType = 'IPP';
          system = 'urn:oid:1.2.250.1.71.4.2.7'; // OID pour identifiants internes
          hasIPP = true;
        } else if (oid) {
          // Utiliser l'OID directement si fourni
          system = `urn:oid:${oid}`;
          
          // Détection des identifiants français basée sur l'OID uniquement
          if (oid === '1.2.250.1.213.1.4.8' || oid === '1.2.250.1.213.1.4.2') {
            console.log('[CONVERTER] Identifiant INS détecté via OID:', oid);
            officialType = 'INS';
            hasINS = true;
          } else if (oid === '1.2.250.1.71.4.2.7') {
            console.log('[CONVERTER] Identifiant IPP détecté via OID:', oid);
            officialType = 'IPP';
            hasIPP = true;
          }
        }
      } else if (idType === 'PI' || idType === 'NH' || idType === '') {
        // IPP (Patient Internal) ou Numéro d'hospitalisation
        system = 'urn:oid:1.2.250.1.71.4.2.7'; // OID pour identifiants internes
        officialType = 'IPP';
        hasIPP = true;
      }
      
      // Cas 1: INS (NIR ou INS-C) - conforme aux recommandations ANS
      if (officialType === 'INS' || officialType === 'INS-C') {
        // Créer l'identifiant INS avec les informations françaises
        identifiers.push({
          value: idValue,
          system: 'urn:oid:1.2.250.1.213.1.4.8', // OID officiel pour INS selon ANS
          type: {
            coding: [{
              system: 'http://terminology.hl7.org/CodeSystem/v2-0203',
              code: 'NI',
              display: 'Numéro d\'identification au répertoire national d\'identification des personnes physiques'
            }]
          },
          assigner: { 
            display: 'INSEE'
          },
          extension: [{
            url: 'https://apifhir.annuaire.sante.fr/ws-sync/exposed/structuredefinition/INSi-Status',
            valueCodeableConcept: {
              coding: [{
                system: 'https://mos.esante.gouv.fr/NOS/TRE_R338-ModaliteAccueil/FHIR/TRE-R338-ModaliteAccueil',
                code: 'VALI',
                display: 'Identité vérifiée'
              }]
            }
          }]
        });
      } 
      // Cas 2: IPP - identifiant interne conforme aux recommandations ANS
      else if (officialType === 'IPP') {
        // Identifiants standard (non français)
        identifiers.push({
          value: idValue,
          system: 'urn:oid:1.2.250.1.71.4.2.7', // OID standard pour identifiants internes
          type: {
            coding: [{
              system: 'http://terminology.hl7.org/CodeSystem/v2-0203',
              code: 'PI',
              display: 'Identifiant patient interne'
            }]
          },
          assigner: assigningAuthority ? { 
            display: assigningAuthority.split('&')[0] 
          } : undefined
        });
      }
      // Cas 3: Autres types d'identifiants
      else {
        identifiers.push({
          value: idValue,
          system: system,
          type: {
            coding: [{
              system: 'http://terminology.hl7.org/CodeSystem/v2-0203',
              code: idType || 'PI',
              display: getIdentifierTypeDisplay(idType || 'PI')
            }]
          },
          assigner: assigningAuthority ? { 
            display: assigningAuthority.split('&')[0] 
          } : undefined
        });
      }
    }
  }
  // Si nous avons un tableau, traiter chaque élément
  else if (Array.isArray(identifierField)) {
    // Garder une trace des identifiants déjà traités pour éviter les doublons
    const processedIds = new Set();
    
    // Traiter chaque élément comme un identifiant potentiel
    identifierField.forEach((item, index) => {
      console.log('[CONVERTER] Traitement élément #' + index + ' du tableau');
      
      if (typeof item === 'string') {
        const ids = extractIdentifiers(item);
        // Filtrer les identifiants pour éviter les duplications
        ids.forEach(id => {
          const idKey = `${id.system}|${id.value}`;
          if (!processedIds.has(idKey)) {
            identifiers.push(id);
            processedIds.add(idKey);
            
            // Mettre à jour les flags
            if (id.type?.coding?.[0]?.code === 'NI') hasINS = true;
            if (id.type?.coding?.[0]?.code === 'PI') hasIPP = true;
          }
        });
      } else if (Array.isArray(item)) {
        // Traiter directement cet élément comme un identifiant complet
        const idValue = item[0] || '';
        const idType = item[4] || '';
        const assigningAuth = item[3] || '';
        let assigningOID = '';
        
        // Essayer d'extraire l'OID de différentes structures possibles
        if (item[9]) {
          if (Array.isArray(item[9])) {
            assigningOID = item[9][1] || '';
          } else if (typeof item[9] === 'object') {
            assigningOID = item[9].universalId || '';
          }
        }
        
        console.log('[CONVERTER] Analysant identifiant tableau:', idValue, idType, assigningAuth, assigningOID);
        
        if (idValue) {
          // Détection INS - Plusieurs critères possibles
          const isINS = assigningAuth === 'INSEE' || 
                      idType === 'INS' || 
                      idType === 'INS-C' || 
                      idType === 'INS-NIR' || 
                      assigningOID === '1.2.250.1.213.1.4.8' || 
                      assigningOID === '1.2.250.1.213.1.4.2';
                      
          if (isINS) {
            console.log('[CONVERTER] INS détecté dans tableau:', idValue);
            hasINS = true;
            
            const insIdentifier = {
              value: idValue,
              system: 'urn:oid:1.2.250.1.213.1.4.8', // OID standard ANS
              type: {
                coding: [{
                  system: 'http://terminology.hl7.org/CodeSystem/v2-0203',
                  code: 'NI',
                  display: 'Numéro d\'identification au répertoire national d\'identification des personnes physiques'
                }]
              },
              assigner: { 
                display: 'INSEE'
              }
            };
            
            // Extension pour le statut INS
            insIdentifier.extension = [{
              url: 'https://apifhir.annuaire.sante.fr/ws-sync/exposed/structuredefinition/INSi-Status',
              valueCodeableConcept: {
                coding: [{
                  system: 'https://mos.esante.gouv.fr/NOS/TRE_R338-ModaliteAccueil/FHIR/TRE-R338-ModaliteAccueil',
                  code: 'VALI',
                  display: 'Identité vérifiée'
                }]
              }
            }];
            
            const idKey = `${insIdentifier.system}|${insIdentifier.value}`;
            if (!processedIds.has(idKey)) {
              identifiers.push(insIdentifier);
              processedIds.add(idKey);
            }
          } else {
            // Considérer comme un IPP par défaut
            console.log('[CONVERTER] IPP détecté dans tableau:', idValue);
            hasIPP = true;
            
            const ippIdentifier = {
              value: idValue,
              system: 'urn:oid:1.2.250.1.71.4.2.7', // OID standard pour IPP
              type: {
                coding: [{
                  system: 'http://terminology.hl7.org/CodeSystem/v2-0203',
                  code: 'PI',
                  display: 'Identifiant patient interne'
                }]
              }
            };
            
            // Ajouter l'assigner si disponible, avec nettoyage si nécessaire
            if (assigningAuth) {
              // Nettoyer les caractères spéciaux comme '&' qui peuvent être présents dans les séparateurs HL7
              let cleanAuth = assigningAuth;
              if (typeof cleanAuth === 'string') {
                // Supprimer tout ce qui suit un & (séparateur HL7 standard)
                cleanAuth = cleanAuth.split('&')[0];
                // Nettoyer les séparateurs réseau et chaînes vides
                cleanAuth = cleanAuth.replace(/\^+/g, ' ').trim();
              } else if (Array.isArray(cleanAuth)) {
                // Si c'est un tableau, prendre uniquement le premier élément
                cleanAuth = cleanAuth[0] || '';
              }
              
              ippIdentifier.assigner = {
                display: cleanAuth || 'Établissement local'
              };
            }
            
            const idKey = `${ippIdentifier.system}|${ippIdentifier.value}`;
            if (!processedIds.has(idKey)) {
              identifiers.push(ippIdentifier);
              processedIds.add(idKey);
            }
          }
        }
      }
    });
  }
  
  // Si nous n'avons trouvé aucun identifiant, ajouter un identifiant temporaire
  if (identifiers.length === 0) {
    console.log('[CONVERTER] Aucun identifiant trouvé, ajout d\'un ID temporaire');
    
    const generatedId = `tmp-${Date.now()}`;
    identifiers.push({
      value: generatedId,
      system: 'urn:oid:1.2.250.1.71.4.2.7',
      type: {
        coding: [{
          system: 'http://terminology.hl7.org/CodeSystem/v2-0203',
          code: 'PI',
          display: 'Identifiant patient interne'
        }]
      }
    });
    hasIPP = true;
  }
  
  // Si nous avons un INS mais pas d'IPP, générer un IPP basé sur l'INS
  // Important pour conformité française (besoin des deux types d'identifiants)
  if (hasINS && !hasIPP) {
    console.log('[CONVERTER] INS trouvé sans IPP, ajout d\'un IPP dérivé de l\'INS');
    
    const insIdentifier = identifiers.find(id => 
      id.type?.coding?.[0]?.code === 'NI' && 
      id.system === 'urn:oid:1.2.250.1.213.1.4.8'
    );
    
    if (insIdentifier) {
      // Générer un IPP dérivé de l'INS
      const insValue = insIdentifier.value;
      const derivedIPP = `${insValue.substring(0, 5)}-${Date.now().toString().substring(0, 5)}`;
      
      identifiers.push({
        value: derivedIPP,
        system: 'urn:oid:1.2.250.1.71.4.2.7',
        type: {
          coding: [{
            system: 'http://terminology.hl7.org/CodeSystem/v2-0203',
            code: 'PI',
            display: 'Identifiant patient interne'
          }]
        }
      });
    }
  }
  
  // Si nous avons un IPP mais pas d'INS (et si explicitement demandé pour tests)
  if (!hasINS && hasIPP && process.env.GENERATE_TEST_INS === 'true') {
    console.log('[CONVERTER] [TEST UNIQUEMENT] Génération d\'un INS simulé');
    
    const ippIdentifier = identifiers.find(id => 
      id.type?.coding?.[0]?.code === 'PI' && 
      id.system === 'urn:oid:1.2.250.1.71.4.2.7'
    );
    
    if (ippIdentifier) {
      // Format INS-C fictif pour tests uniquement - NE PAS UTILISER EN PRODUCTION
      const ippValue = ippIdentifier.value;
      const testINS = `2${ippValue.replace(/\D/g, '').padStart(13, '0').substring(0, 13)}00`;
      
      identifiers.push({
        value: testINS,
        system: 'urn:oid:1.2.250.1.213.1.4.8',
        type: {
          coding: [{
            system: 'http://terminology.hl7.org/CodeSystem/v2-0203',
            code: 'NI',
            display: 'Numéro d\'identification au répertoire national d\'identification des personnes physiques'
          }]
        },
        assigner: {
          display: 'INSEE'
        },
        extension: [{
          url: 'https://apifhir.annuaire.sante.fr/ws-sync/exposed/structuredefinition/INSi-Status',
          valueCodeableConcept: {
            coding: [{
              system: 'https://mos.esante.gouv.fr/NOS/TRE_R338-ModaliteAccueil/FHIR/TRE-R338-ModaliteAccueil',
              code: 'TEST',
              display: 'INS de test (non officiel)'
            }]
          }
        }]
      });
    }
  }
  
  console.log(`[CONVERTER] ${identifiers.length} identifiants extraits - INS: ${hasINS}, IPP: ${hasIPP}`);
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
 * Utilise l'utilitaire frenchNameExtractor pour une gestion optimisée des noms français
 * @param {Array|string} nameFields - Tableau ou chaîne de noms
 * @returns {Array} Tableau de noms FHIR
 */
function extractNames(nameFields) {
  console.log('[CONVERTER] Extraction des noms à partir de:', JSON.stringify(nameFields));
  
  if (!nameFields) {
    console.log('[CONVERTER] Aucun champ de nom fourni');
    return [];
  }
  
  // Set pour suivre les noms déjà traités et éviter les doublons
  const processedNamesMap = new Map();
  const result = [];
  
  /**
   * Ajoute un nom à la liste des résultats avec déduplication
   * @param {Object} nameObj - L'objet nom FHIR à ajouter
   */
  function addNameWithDeduplication(nameObj) {
    if (!nameObj) return;
    
    // Créer une clé unique basée sur les propriétés pertinentes de l'objet name
    const nameKey = `${nameObj.use || ''}|${nameObj.family || ''}|${(nameObj.given || []).join(',')}`;
    
    // Ignorer la lettre "L" isolée (problème spécifique aux données de test)
    if (nameObj.family === "L" && (!nameObj.given || nameObj.given.length === 0)) {
      console.log('[CONVERTER] Ignoré nom avec uniquement la lettre L');
      return;
    }
    
    // Stratégie de regroupement :
    // 1. Si on a un nom sans prénoms et qu'on a déjà mémorisé des prénoms sans nom
    if (nameObj.family && (!nameObj.given || nameObj.given.length === 0)) {
      // Chercher si on a déjà un élément avec des prénoms sans nom de famille
      const existingGivenOnlyObj = result.find(item => 
        !item.family && item.given && item.given.length > 0 && item.use === nameObj.use
      );
      
      if (existingGivenOnlyObj) {
        // Combiner en ajoutant le nom de famille
        existingGivenOnlyObj.family = nameObj.family;
        console.log('[CONVERTER] Nom de famille ajouté à un prénom existant:', JSON.stringify(existingGivenOnlyObj));
        return;
      }
    }
    
    // 2. Si on a des prénoms sans nom et qu'on a déjà mémorisé un nom avec ou sans prénoms
    if (nameObj.given && nameObj.given.length > 0 && !nameObj.family) {
      // Chercher si on a déjà un élément avec un nom de famille (avec ou sans prénoms)
      const existingFamilyObj = result.find(item => 
        item.family && item.use === nameObj.use
      );
      
      if (existingFamilyObj) {
        // Si l'objet existant n'a pas encore de prénoms, lui ajouter ceux du nouvel objet
        if (!existingFamilyObj.given || existingFamilyObj.given.length === 0) {
          existingFamilyObj.given = nameObj.given;
          console.log('[CONVERTER] Prénoms ajoutés à un nom de famille existant:', JSON.stringify(existingFamilyObj));
          return;
        }
        
        // Si l'objet existant a déjà exactement les mêmes prénoms, ne rien faire (c'est un doublon)
        const existingGivenStr = JSON.stringify(existingFamilyObj.given.sort());
        const newGivenStr = JSON.stringify(nameObj.given.sort());
        
        if (existingGivenStr === newGivenStr) {
          console.log('[CONVERTER] Prénoms ignorés car identiques à ceux existants avec le même nom de famille');
          return;
        }
      }
      
      // Si on n'a trouvé aucun objet avec nom de famille, cherchons s'il existe un autre objet
      // avec prénoms uniquement mais identiques (pour éviter les doublons de prénoms isolés)
      const existingGivenOnlyObj = result.find(item => 
        !item.family && item.given && item.given.length > 0 && item.use === nameObj.use
      );
      
      if (existingGivenOnlyObj) {
        // Comparer les prénoms pour voir s'ils sont identiques
        const existingGivenStr = JSON.stringify(existingGivenOnlyObj.given.sort());
        const newGivenStr = JSON.stringify(nameObj.given.sort());
        
        if (existingGivenStr === newGivenStr) {
          console.log('[CONVERTER] Prénoms isolés ignorés car identiques à ceux existants');
          return;
        }
      }
    }
    
    // Vérifier si ce nom existe déjà
    if (!processedNamesMap.has(nameKey)) {
      if (nameObj.family || (nameObj.given && nameObj.given.length > 0)) {
        result.push(nameObj);
        processedNamesMap.set(nameKey, true);
        console.log('[CONVERTER] Nom ajouté:', JSON.stringify(nameObj));
      }
    } else {
      console.log('[CONVERTER] Nom ignoré car doublon:', nameKey);
    }
  }
  
  // Si nous avons une chaîne, utiliser l'extracteur français avancé
  if (typeof nameFields === 'string') {
    console.log('[CONVERTER] Traitement du nom (chaîne) avec l\'extracteur français:', nameFields);
    
    // Utiliser notre module spécialisé pour les noms français
    const frenchNames = extractFrenchNames(nameFields);
    
    // Ajouter tous les noms extraits à notre résultat
    frenchNames.forEach(nameObj => {
      addNameWithDeduplication(nameObj);
    });
  }
  // Si nous avons un tableau (format pour les nouveaux parsers HL7)
  else if (Array.isArray(nameFields)) {
    console.log('[CONVERTER] Traitement des noms (tableau):', JSON.stringify(nameFields).substring(0, 200));
    
    // Parcourir chaque élément du tableau
    nameFields.forEach(field => {
      if (!field) return;
      
      // Si c'est une chaîne dans un tableau
      if (typeof field === 'string') {
        // Utiliser l'extracteur français avancé
        const frenchNames = extractFrenchNames(field);
        frenchNames.forEach(nameObj => {
          addNameWithDeduplication(nameObj);
        });
      }
      // Si c'est un tableau ou un objet
      else if (Array.isArray(field) || typeof field === 'object') {
        // Cas 1: C'est un tableau direct (structure [family, given, middle, ...])
        if (Array.isArray(field)) {
          // Reconstruire la chaîne au format HL7 à partir du tableau
          const hl7NameString = field.join('^');
          
          // Utiliser l'extracteur français avancé
          const frenchNames = extractFrenchNames(hl7NameString);
          frenchNames.forEach(nameObj => {
            addNameWithDeduplication(nameObj);
          });
        }
        // Cas 2: C'est un objet avec des composants (format habituel de simple-hl7)
        else if (field.components) {
          // Convertir le format simple-hl7 en chaîne HL7 standard
          const components = field.components;
          let hl7NameString = '';
          
          // Rassembler jusqu'à 7 composants (XPN.1 à XPN.7)
          for (let i = 0; i < 7; i++) {
            if (components[i] && components[i].value) {
              hl7NameString += components[i].value;
            }
            // Ajouter le séparateur même si le composant est vide
            if (i < 6) {
              hl7NameString += '^';
            }
          }
          
          // Utiliser l'extracteur français avancé sur la chaîne reconstruite
          const frenchNames = extractFrenchNames(hl7NameString);
          frenchNames.forEach(nameObj => {
            addNameWithDeduplication(nameObj);
          });
        }
      }
    });
  }
  
  console.log('[CONVERTER] Total noms extraits:', result.length);
  return result;

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
  // Si les paramètres sont undefined, utiliser des tableaux vides pour éviter les erreurs
  homePhoneFields = homePhoneFields || [];
  workPhoneFields = workPhoneFields || [];
  
  try {
    console.log('[CONVERTER] Extraction des télécom à partir de:', 
                homePhoneFields ? JSON.stringify(homePhoneFields).substring(0, 200) : 'aucun', '...');
  } catch (e) {
    console.log('[CONVERTER] Échec du log des télécom:', e.message);
  }
  
  // Création d'un tableau pour stocker les emails trouvés dans le format de message HL7 français
  const foundEmailsInHL7French = [];
  
  // Recherche directe au format string pour les cas comme "~^NET^Internet^MARYSE.SECLET@WANADOO.FR"
  if (homePhoneFields) {
    // Si nous avons une chaîne unique représentant le champ PID-13
    if (typeof homePhoneFields === 'string') {
      // 1. Recherche dans le format avec tilde '~'
      const tildePattern = /\~+\^NET\^[^\^]*\^([^\^~]+@[^\^~]+)/;
      const tildeParts = homePhoneFields.split('~');
      
      for (const part of tildeParts) {
        if (part.includes('@')) {
          const emailParts = part.split('^');
          let emailValue = '';
          
          for (const emailPart of emailParts) {
            if (emailPart.includes('@')) {
              emailValue = emailPart;
              break;
            }
          }
          
          if (emailValue) {
            console.log('[CONVERTER] Email trouvé dans format chaîne HL7 français avec ~:', emailValue);
            foundEmailsInHL7French.push({
              system: 'email',
              value: emailValue,
              use: 'home'
            });
          }
        }
      }
      
      // 2. Recherche directe par expression régulière
      const emailRegex = /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/gi;
      const emailMatches = homePhoneFields.match(emailRegex);
      
      if (emailMatches) {
        for (const emailMatch of emailMatches) {
          console.log('[CONVERTER] Email trouvé par regex dans le format HL7 français:', emailMatch);
          foundEmailsInHL7French.push({
            system: 'email',
            value: emailMatch,
            use: 'home'
          });
        }
      }
    }
    
    // Si nous avons un tableau, vérifier chaque élément
    if (Array.isArray(homePhoneFields)) {
      // Parcourir directement le tableau des champs télécom
      homePhoneFields.forEach(field => {
        // Format typique: ["","NET","Internet","MARYSE.SECLET@WANADOO.FR"]
        if (Array.isArray(field) && field.length >= 4 && field[1] === 'NET' && field[3] && field[3].includes('@')) {
          const emailValue = field[3];
          console.log('[CONVERTER] Email trouvé au format tableau français spécifique:', emailValue);
          foundEmailsInHL7French.push({
            system: 'email',
            value: emailValue,
            use: 'home'
          });
        }
      });
    }
  }
  
  // Détection spécifique des emails dans le format français
  if (Array.isArray(homePhoneFields)) {
    for (let i = 0; i < homePhoneFields.length; i++) {
      const field = homePhoneFields[i];
      
      // Format typique: ["","NET","Internet","MARYSE.SECLET@WANADOO.FR"]
      if (Array.isArray(field) && field.length >= 4 && field[1] === 'NET' && field[3] && field[3].includes('@')) {
        const emailValue = field[3];
        console.log('[CONVERTER] Email trouvé au format tableau français spécifique:', emailValue);
      }
      
      // Recherche dans les chaînes directes
      if (typeof field === 'string' && field.includes('@')) {
        console.log('[CONVERTER] Email trouvé directement dans champ:', field);
      }
    }
  }
  
  // Création directe du tableau des télécom
  const telecoms = [];
  
  // Set pour suivre les télécom déjà traités (éviter les doublons)
  const processedTelecoms = new Set();
  
  // Extraction directe des emails français
  if (Array.isArray(homePhoneFields)) {
    homePhoneFields.forEach(field => {
      if (Array.isArray(field) && field.length >= 4 && field[1] === 'NET' && field[3] && field[3].includes('@')) {
        const emailValue = field[3];
        console.log('[CONVERTER] Email français à format direct trouvé :', emailValue);
        
        const emailTelecom = {
          system: 'email',
          value: emailValue,
          use: 'home'
        };
        
        const key = `${emailTelecom.system}|${emailTelecom.use}|${emailTelecom.value}`;
        if (!processedTelecoms.has(key)) {
          telecoms.push(emailTelecom);
          processedTelecoms.add(key);
          console.log('[CONVERTER] Email français direct ajouté');
        }
      }
    });
  }
  
  // Optimisation spécifique pour les messages HL7 en format français avec des tableaux imbriqués
  // Spécifiquement pour gérer les cas comme : [["","PRN","PH","","","","","","","","","0608987212"]]
  function checkNestedArray(field, use = 'home') {
    // Format téléphone spécifique français
    if (Array.isArray(field) && field.length >= 12 && field[2] === 'PH' && field[11]) {
      // C'est un format spécifique avec le numéro en position 11
      const phoneNumber = field[11];
      console.log('[CONVERTER] Téléphone détecté dans format spécifique:', phoneNumber);
      
      // Normalization
      const normalized = normalizePhoneNumber(phoneNumber);
      if (normalized.isValid) {
        const telecomType = field[1] || 'PRN'; // PRN est souvent utilisé dans ce format
        const useFHIR = mapContactUseToFHIR(telecomType) || use;
        
        const phoneTelecom = {
          system: 'phone',
          value: normalized.value,
          use: normalized.isMobile ? 'mobile' : useFHIR
        };
        
        const telecomKey = `${phoneTelecom.system}|${phoneTelecom.use}|${phoneTelecom.value}`;
        if (!processedTelecoms.has(telecomKey)) {
          telecoms.push(phoneTelecom);
          processedTelecoms.add(telecomKey);
          console.log('[CONVERTER] Téléphone ajouté depuis format spécifique:', JSON.stringify(phoneTelecom));
          return true;
        }
      }
    } 
    // Format email spécifique français
    else if (Array.isArray(field) && field.length >= 4 && field[1] === 'NET' && field[3]) {
      // Format pour email: [,"NET","Internet","email@example.com"]
      const emailValue = field[3];
      if (emailValue && emailValue.includes('@')) {
        console.log('[CONVERTER] Email détecté dans format spécifique PRIORITAIRE:', emailValue);
        
        const emailTelecom = {
          system: 'email',
          value: emailValue,
          use: use
        };
        
        const telecomKey = `${emailTelecom.system}|${emailTelecom.use}|${emailTelecom.value}`;
        if (!processedTelecoms.has(telecomKey)) {
          telecoms.push(emailTelecom);
          processedTelecoms.add(telecomKey);
          console.log('[CONVERTER] Email ajouté depuis format spécifique:', JSON.stringify(emailTelecom));
          // Ne pas retourner true, continuer à chercher d'autres télécom
        }
      }
    }
    return false;
  }
  
  /**
   * Fonction utilitaire pour normaliser et vérifier les numéros de téléphone
   * Spécifiquement optimisée pour les numéros français
   * @param {string} phoneNumber - Le numéro à vérifier
   * @returns {Object} Le numéro normalisé et des informations sur son type
   */
  function normalizePhoneNumber(phoneNumber) {
    if (!phoneNumber) {
      return { isValid: false };
    }
    
    // Suppression des caractères non numériques sauf le +
    let normalized = phoneNumber.replace(/[^\d+]/g, '');
    
    // Si ce n'est qu'un caractère unique ou vide, ignorer
    if (normalized.length <= 1) {
      return { isValid: false };
    }
    
    // Détection des numéros de téléphone français
    let isMobile = false;
    
    // Format +33 6xx... ou +33 7xx... (internationaux français mobiles)
    if (normalized.startsWith('+336') || normalized.startsWith('+337')) {
      isMobile = true;
    }
    // Format 06xx... ou 07xx... (français mobiles)
    else if ((normalized.startsWith('06') || normalized.startsWith('07')) && 
             (normalized.length === 10 || normalized.length === 12)) {
      isMobile = true;
    }
    
    return {
      value: normalized,
      isValid: true,
      isMobile
    };
  }
  
  // Traitement des téléphones personnels (PID-13)
  if (homePhoneFields) {
    // Cas spécial: structure particulière des téléphones français
    if (Array.isArray(homePhoneFields)) {
      // Vérifier d'abord si nous avons le format spécifique au HL7 français
      let hasSpecificFormat = false;
      
      // Traiter chaque sous-tableau dans le tableau principal
      homePhoneFields.forEach(field => {
        if (Array.isArray(field)) {
          hasSpecificFormat = hasSpecificFormat || checkNestedArray(field, 'home');
        }
      });
      
      // Si on a trouvé un format spécifique, on peut s'arrêter ici
      if (hasSpecificFormat) {
        console.log('[CONVERTER] Téléphone personnel trouvé en format spécifique français');
      }
      
      // Continuer avec le traitement standard pour tout autre format
      homePhoneFields.forEach(field => {
        if (!field) return;
        
        // Cas 1: format de l'ancien parser avec components
        if (field.components) {
          const components = field.components;
          
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
          
          console.log('[CONVERTER] Télécom personnel (components) ajouté:', JSON.stringify(telecom));
          
          // Vérifier si ce télécom existe déjà (éviter doublons)
          const telecomKey = `${telecom.system}|${telecom.use}|${telecom.value}`;
          if (!processedTelecoms.has(telecomKey)) {
            telecoms.push(telecom);
            processedTelecoms.add(telecomKey);
          } else {
            console.log('[CONVERTER] Télécom ignoré car doublon:', telecomKey);
          }
        }
        // Cas 2: format du nouveau parser - tableau ou chaîne
        else {
          let parsedTelecom;
          
          // Si c'est une chaîne directe (numéro seul)
          if (typeof field === 'string') {
            const parts = field.split('^');
            
            // Numéro (component 1)
            const phoneNumber = parts[0] || '';
            if (!phoneNumber) return;
            
            parsedTelecom = {
              value: phoneNumber,
              use: 'home',
              system: 'phone'
            };
            
            // Type d'utilisation (component 2)
            if (parts[1]) {
              parsedTelecom.use = mapContactUseToFHIR(parts[1]);
            }
            
            // Type d'équipement (component 3)
            if (parts[2]) {
              parsedTelecom.system = mapEquipmentTypeToFHIR(parts[2]);
            }
          }
          // Si c'est un tableau (format du parser détaillé)
          else if (Array.isArray(field)) {
            const phoneNumber = field[0] || '';
            if (!phoneNumber) return;
            
            parsedTelecom = {
              value: phoneNumber,
              use: 'home',
              system: 'phone'
            };
            
            // Type d'utilisation (component 2)
            if (field.length > 1 && field[1]) {
              parsedTelecom.use = mapContactUseToFHIR(field[1]);
            }
            
            // Type d'équipement (component 3)
            if (field.length > 2 && field[2]) {
              parsedTelecom.system = mapEquipmentTypeToFHIR(field[2]);
            }
          }
          
          if (parsedTelecom) {
            console.log('[CONVERTER] Télécom personnel (simple) ajouté:', JSON.stringify(parsedTelecom));
            
            // Normalisation et vérification du numéro de téléphone pour FHIR
            if (parsedTelecom.system === 'phone' && parsedTelecom.value) {
              const normalized = normalizePhoneNumber(parsedTelecom.value);
              
              if (normalized.isValid) {
                // Utiliser le numéro normalisé
                parsedTelecom.value = normalized.value;
                
                // Détection des téléphones mobiles français
                if (normalized.isMobile) {
                  parsedTelecom.use = 'mobile';
                  console.log('[CONVERTER] Téléphone mobile français détecté:', parsedTelecom.value);
                }
              } else {
                // Numéro invalide, l'ignorer
                console.log('[CONVERTER] Numéro de téléphone invalide ignoré:', parsedTelecom.value);
                return;
              }
            }
            
            // Vérifier si ce télécom existe déjà (éviter doublons)
            const telecomKey = `${parsedTelecom.system}|${parsedTelecom.use}|${parsedTelecom.value}`;
            if (!processedTelecoms.has(telecomKey)) {
              telecoms.push(parsedTelecom);
              processedTelecoms.add(telecomKey);
            } else {
              console.log('[CONVERTER] Télécom ignoré car doublon:', telecomKey);
            }
            
            // Détection d'email - traitement particulier pour les cas HL7 français
            if (typeof field === 'string' && field.includes('@')) {
              const emailTelecom = {
                value: field,
                use: 'home',
                system: 'email'
              };
              console.log('[CONVERTER] Email détecté et ajouté:', JSON.stringify(emailTelecom));
              
              // Vérifier si l'email existe déjà
              const emailKey = `${emailTelecom.system}|${emailTelecom.use}|${emailTelecom.value}`;
              if (!processedTelecoms.has(emailKey)) {
                telecoms.push(emailTelecom);
                processedTelecoms.add(emailKey);
              } else {
                console.log('[CONVERTER] Email ignoré car doublon:', emailKey);
              }
            }
          }
        }
      });
    }
    // Si c'est une chaîne, essayer de l'interpréter directement
    else if (typeof homePhoneFields === 'string') {
      // Cas particulier: email direct
      if (homePhoneFields.includes('@')) {
        const emailTelecom = {
          value: homePhoneFields,
          use: 'home',
          system: 'email'
        };
        console.log('[CONVERTER] Email détecté et ajouté (direct):', JSON.stringify(emailTelecom));
        
        // Vérifier si cet email existe déjà
        const emailKey = `${emailTelecom.system}|${emailTelecom.use}|${emailTelecom.value}`;
        if (!processedTelecoms.has(emailKey)) {
          telecoms.push(emailTelecom);
          processedTelecoms.add(emailKey);
        } else {
          console.log('[CONVERTER] Email ignoré car doublon:', emailKey);
        }
      }
      // Cas d'un numéro de téléphone direct
      else {
        // Utiliser la fonction de normalisation pour vérifier
        const normalized = normalizePhoneNumber(homePhoneFields);
        
        if (normalized.isValid) {
          const phoneTelecom = {
            value: normalized.value,
            use: normalized.isMobile ? 'mobile' : 'home',
            system: 'phone'
          };
          
          console.log('[CONVERTER] Téléphone personnel ajouté (direct):', JSON.stringify(phoneTelecom));
          
          // Vérifier si ce téléphone existe déjà
          const phoneKey = `${phoneTelecom.system}|${phoneTelecom.use}|${phoneTelecom.value}`;
          if (!processedTelecoms.has(phoneKey)) {
            telecoms.push(phoneTelecom);
            processedTelecoms.add(phoneKey);
          } else {
            console.log('[CONVERTER] Téléphone ignoré car doublon:', phoneKey);
          }
        } else {
          console.log('[CONVERTER] Numéro de téléphone invalide ignoré:', homePhoneFields);
        }
      }
    }
  }
  
  // Traitement des téléphones professionnels (PID-14)
  if (workPhoneFields) {
    // Cas spécial: structure particulière des téléphones français professionnels
    if (Array.isArray(workPhoneFields)) {
      // Vérifier d'abord si nous avons le format spécifique au HL7 français
      let hasSpecificFormat = false;
      
      // Traiter chaque sous-tableau dans le tableau principal
      workPhoneFields.forEach(field => {
        if (Array.isArray(field)) {
          hasSpecificFormat = hasSpecificFormat || checkNestedArray(field, 'work');
        }
      });
      
      // Si on a trouvé un format spécifique, on peut s'arrêter ici
      if (hasSpecificFormat) {
        console.log('[CONVERTER] Téléphone professionnel trouvé en format spécifique français');
      }
      
      // Continuer avec le traitement standard pour tout autre format
      workPhoneFields.forEach(field => {
        if (!field) return;
        
        // Cas 1: format de l'ancien parser avec components
        if (field.components) {
          const components = field.components;
          
          // Numéro (component 1)
          const phoneNumber = components[0] ? components[0].value : '';
          if (!phoneNumber) return;
          
          const telecom = {
            value: phoneNumber,
            use: 'work',
            system: 'phone'
          };
          
          // Type d'équipement (component 3)
          if (components[2] && components[2].value) {
            telecom.system = mapEquipmentTypeToFHIR(components[2].value);
          }
          
          console.log('[CONVERTER] Télécom professionnel ajouté:', JSON.stringify(telecom));
          
          // Vérifier si ce télécom existe déjà
          const telecomKey = `${telecom.system}|${telecom.use}|${telecom.value}`;
          if (!processedTelecoms.has(telecomKey)) {
            telecoms.push(telecom);
            processedTelecoms.add(telecomKey);
          } else {
            console.log('[CONVERTER] Télécom professionnel ignoré car doublon:', telecomKey);
          }
        }
        // Cas 2: format du nouveau parser
        else {
          let parsedTelecom;
          
          // Si c'est une chaîne directe
          if (typeof field === 'string') {
            const parts = field.split('^');
            
            // Numéro (component 1)
            const phoneNumber = parts[0] || '';
            if (!phoneNumber) return;
            
            parsedTelecom = {
              value: phoneNumber,
              use: 'work',
              system: 'phone'
            };
            
            // Type d'équipement (component 3)
            if (parts.length > 2 && parts[2]) {
              parsedTelecom.system = mapEquipmentTypeToFHIR(parts[2]);
            }
          }
          // Si c'est un tableau
          else if (Array.isArray(field)) {
            const phoneNumber = field[0] || '';
            if (!phoneNumber) return;
            
            parsedTelecom = {
              value: phoneNumber,
              use: 'work',
              system: 'phone'
            };
            
            // Type d'équipement (component 3)
            if (field.length > 2 && field[2]) {
              parsedTelecom.system = mapEquipmentTypeToFHIR(field[2]);
            }
          }
          
          if (parsedTelecom) {
            console.log('[CONVERTER] Télécom professionnel (simple) ajouté:', JSON.stringify(parsedTelecom));
            
            // Normalisation et vérification du numéro de téléphone pour FHIR
            if (parsedTelecom.system === 'phone' && parsedTelecom.value) {
              const normalized = normalizePhoneNumber(parsedTelecom.value);
              
              if (normalized.isValid) {
                // Utiliser le numéro normalisé
                parsedTelecom.value = normalized.value;
                
                // Détection des téléphones mobiles français (même au travail)
                if (normalized.isMobile) {
                  // On peut garder 'work' comme use mais ajouter une extension pour le mobile
                  parsedTelecom.extension = [{
                    url: "https://interop.esante.gouv.fr/ig/fhir/core/StructureDefinition/telecom-mobilite",
                    valueBoolean: true
                  }];
                  console.log('[CONVERTER] Téléphone mobile professionnel français détecté:', parsedTelecom.value);
                }
              } else {
                // Numéro invalide, l'ignorer
                console.log('[CONVERTER] Numéro de téléphone professionnel invalide ignoré:', parsedTelecom.value);
                return;
              }
            }
            
            // Vérifier si ce télécom existe déjà
            const telecomKey = `${parsedTelecom.system}|${parsedTelecom.use}|${parsedTelecom.value}`;
            if (!processedTelecoms.has(telecomKey)) {
              telecoms.push(parsedTelecom);
              processedTelecoms.add(telecomKey);
            } else {
              console.log('[CONVERTER] Télécom professionnel simple ignoré car doublon:', telecomKey);
            }
          }
        }
      });
    }
    // Si c'est une chaîne, essayer de l'interpréter directement
    else if (typeof workPhoneFields === 'string') {
      // Cas particulier: email direct
      if (workPhoneFields.includes('@')) {
        const emailTelecom = {
          value: workPhoneFields,
          use: 'work',
          system: 'email'
        };
        console.log('[CONVERTER] Email professionnel détecté et ajouté (direct):', JSON.stringify(emailTelecom));
        telecoms.push(emailTelecom);
      }
      // Cas d'un numéro de téléphone direct
      else {
        // Utiliser la fonction de normalisation pour vérifier
        const normalized = normalizePhoneNumber(workPhoneFields);
        
        if (normalized.isValid) {
          const phoneTelecom = {
            value: normalized.value,
            use: 'work',
            system: 'phone'
          };
          
          // Ajouter une extension pour les mobiles français utilisés au travail
          if (normalized.isMobile) {
            phoneTelecom.extension = [{
              url: "https://interop.esante.gouv.fr/ig/fhir/core/StructureDefinition/telecom-mobilite",
              valueBoolean: true
            }];
          }
          
          console.log('[CONVERTER] Téléphone professionnel ajouté (direct):', JSON.stringify(phoneTelecom));
          
          // Vérifier les doublons
          const telecomKey = `${phoneTelecom.system}|${phoneTelecom.use}|${phoneTelecom.value}`;
          if (!processedTelecoms.has(telecomKey)) {
            telecoms.push(phoneTelecom);
            processedTelecoms.add(telecomKey);
          } else {
            console.log('[CONVERTER] Téléphone professionnel ignoré car doublon:', telecomKey);
          }
        } else {
          console.log('[CONVERTER] Numéro de téléphone professionnel invalide ignoré:', workPhoneFields);
        }
      }
    }
  }
  
  // Ajouter les emails français détectés spécifiquement au début
  if (foundEmailsInHL7French && foundEmailsInHL7French.length > 0) {
    console.log('[CONVERTER] Ajout des emails français spécifiquement détectés:', foundEmailsInHL7French.length);
    
    // Éviter les doublons en vérifiant chaque email avant de l'ajouter
    foundEmailsInHL7French.forEach(emailTelecom => {
      const telecomKey = `${emailTelecom.system}|${emailTelecom.use}|${emailTelecom.value}`;
      if (!processedTelecoms.has(telecomKey)) {
        telecoms.push(emailTelecom);
        processedTelecoms.add(telecomKey);
        console.log('[CONVERTER] Email français ajouté à la liste finale:', JSON.stringify(emailTelecom));
      }
    });
  }
  
  // Recherche explicite de l'email français dans une dernière tentative
  if (Array.isArray(homePhoneFields)) {
    for (const field of homePhoneFields) {
      if (Array.isArray(field) && field.length >= 4 && field[1] === 'NET' && field[3] && field[3].includes('@')) {
        const emailValue = field[3];
        console.log('[CONVERTER] Ajout direct de l\'email français au format NET:', emailValue);
        
        const emailTelecom = {
          system: 'email',
          value: emailValue,
          use: 'home'
        };
        
        const telecomKey = `${emailTelecom.system}|${emailTelecom.use}|${emailTelecom.value}`;
        if (!processedTelecoms.has(telecomKey)) {
          telecoms.push(emailTelecom);
          processedTelecoms.add(telecomKey);
        }
      }
    }
  }
  
  console.log(`[CONVERTER] Total de télécom extraits: ${telecoms.length}`);
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
  // S'assurer que addressFields est défini pour éviter les erreurs
  addressFields = addressFields || [];
  
  try {
    console.log('[CONVERTER] Extraction des adresses à partir de:', 
                addressFields ? JSON.stringify(addressFields).substring(0, 200) : 'aucune', '...');
  } catch (e) {
    console.log('[CONVERTER] Échec du log des adresses:', e.message);
  }
  
  if (!addressFields) {
    console.log('[CONVERTER] Pas de champ d\'adresse fourni');
    return [];
  }
  
  const addresses = [];
  
  // Si c'est un tableau, parcourir chaque élément
  if (Array.isArray(addressFields)) {
    addressFields.forEach(field => {
      if (!field) return;
      
      // Cas 1: Format ancien parser avec components
      if (field.components) {
        const components = field.components;
        
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
          
          console.log('[CONVERTER] Adresse extraite (components):', JSON.stringify(address));
          addresses.push(address);
        }
      }
      // Cas 2: Format du nouveau parser (chaîne ou tableau)
      else {
        let parsedAddress;
        
        // Si c'est une chaîne
        if (typeof field === 'string') {
          const parts = field.split('^');
          
          // Informations d'adresse
          const street1 = parts[0] || '';
          const street2 = parts[1] || '';
          const city = parts[2] || '';
          const state = parts[3] || '';
          const postalCode = parts[4] || '';
          const country = parts[5] || '';
          
          // Type d'adresse (component 7)
          const addrType = parts.length > 6 ? parts[6] : '';
          
          if (street1 || city || postalCode || country) {
            parsedAddress = {
              use: mapAddressUseToFHIR(addrType),
              type: mapAddressTypeToFHIR(addrType)
            };
            
            // Lignes d'adresse
            const lines = [];
            if (street1) lines.push(street1);
            if (street2) lines.push(street2);
            
            if (lines.length > 0) {
              parsedAddress.line = lines;
            }
            
            if (city) parsedAddress.city = city;
            if (state) parsedAddress.state = state;
            if (postalCode) parsedAddress.postalCode = postalCode;
            if (country) parsedAddress.country = country;
          }
        }
        // Si c'est un tableau
        else if (Array.isArray(field)) {
          // Informations d'adresse
          const street1 = field[0] || '';
          const street2 = field[1] || '';
          const city = field[2] || '';
          const state = field[3] || '';
          const postalCode = field[4] || '';
          const country = field[5] || '';
          
          // Type d'adresse (component 7)
          const addrType = field.length > 6 ? field[6] : '';
          
          if (street1 || city || postalCode || country) {
            parsedAddress = {
              use: mapAddressUseToFHIR(addrType),
              type: mapAddressTypeToFHIR(addrType)
            };
            
            // Lignes d'adresse
            const lines = [];
            if (street1) lines.push(street1);
            if (street2) lines.push(street2);
            
            if (lines.length > 0) {
              parsedAddress.line = lines;
            }
            
            if (city) parsedAddress.city = city;
            if (state) parsedAddress.state = state;
            if (postalCode) parsedAddress.postalCode = postalCode;
            if (country) parsedAddress.country = country;
          }
        }
        
        if (parsedAddress) {
          console.log('[CONVERTER] Adresse extraite (simple):', JSON.stringify(parsedAddress));
          addresses.push(parsedAddress);
        }
      }
    });
  }
  // Si c'est une chaîne (adresse directe)
  else if (typeof addressFields === 'string') {
    // Si l'adresse contient des séparateurs standard HL7 (^)
    if (addressFields.includes('^')) {
      const parts = addressFields.split('^');
      
      // Informations d'adresse
      const street1 = parts[0] || '';
      const street2 = parts[1] || '';
      const city = parts[2] || '';
      const state = parts[3] || '';
      const postalCode = parts[4] || '';
      const country = parts[5] || '';
      
      if (street1 || city || postalCode || country) {
        const address = {
          use: 'home',
          type: 'physical'
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
        
        console.log('[CONVERTER] Adresse extraite (chaîne directe):', JSON.stringify(address));
        addresses.push(address);
      }
    }
    // Si c'est une adresse simple, traiter comme une ligne de rue
    else {
      console.log('[CONVERTER] Adresse simple détectée:', addressFields);
      addresses.push({
        use: 'home',
        type: 'physical',
        line: [addressFields]
      });
    }
  }
  
  // Format spécifique français - Extension pour les codes INSEE des communes
  addresses.forEach(address => {
    if (address.city && address.postalCode) {
      // Détection du format français avec code INSEE entre parenthèses
      const codeInseeMatch = address.city.match(/\((\d{5})\)/);
      if (codeInseeMatch) {
        address.extension = [{
          url: 'https://interop.esante.gouv.fr/ig/fhir/core/StructureDefinition/commune-cog-insee',
          valueString: codeInseeMatch[1]
        }];
        
        // Nettoyer le nom de la ville
        address.city = address.city.replace(/\s*\(\d{5}\)\s*/, '');
      }
    }
  });
  
  console.log(`[CONVERTER] Total d'adresses extraites: ${addresses.length}`);
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
function createEncounterResource(pv1Segment, patientReference, pv2Segment = null) {
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
  
  // Date de sortie prévue (PV2-9 ou PV2-30 ou PV2-40 selon les implémentations)
  let expectedExitDate = null;
  
  if (pv2Segment) {
    console.log('[CONVERTER] Analyse PV2 pour date de sortie:', JSON.stringify(pv2Segment).substring(0, 100) + '...');
    
    // Recherche dynamique de la date de sortie prévue dans tout le segment
    for (let i = 0; i < pv2Segment.length; i++) {
      if (pv2Segment[i] && 
          /^\d{8}/.test(pv2Segment[i]) && 
          (i === 9 || i === 30 || i === 40)) {
        
        expectedExitDate = formatHL7DateTime(pv2Segment[i]);
        console.log(`[CONVERTER] Date de sortie prévue trouvée à l'index ${i}:`, pv2Segment[i], '→', expectedExitDate);
        break;
      }
    }
    
    // Si aucune date n'a été trouvée aux positions connues, chercher n'importe où dans le segment
    if (!expectedExitDate) {
      for (let i = 0; i < pv2Segment.length; i++) {
        if (pv2Segment[i] && /^\d{8}/.test(pv2Segment[i])) {
          expectedExitDate = formatHL7DateTime(pv2Segment[i]);
          console.log(`[CONVERTER] Date potentielle trouvée à l'index ${i}:`, pv2Segment[i], '→', expectedExitDate);
          break;
        }
      }
    }
    
    // Si toujours aucune date n'est trouvée mais qu'on a une date d'admission, l'utiliser comme fallback
    if (!expectedExitDate && admitDate) {
      expectedExitDate = admitDate;
      console.log('[CONVERTER] Aucune date de sortie prévue trouvée, utilisation de la date d\'admission comme fallback:', admitDate);
    }
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
  
  // Ajout de l'extension de date de sortie prévue si disponible
  if (expectedExitDate) {
    // Vérifier d'abord que le tableau extension existe
    if (!encounterResource.extension) {
      encounterResource.extension = [];
    }
    
    // Ajouter ensuite l'extension de date de sortie prévue
    encounterResource.extension.push({
      url: "http://hl7.org/fhir/StructureDefinition/encounter-expectedExitDate",
      valueDateTime: expectedExitDate
    });
    console.log('[CONVERTER] Extension de date de sortie prévue ajoutée:', expectedExitDate);
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
    
    // Vérifier si le nom semble être un horodatage (format commun: YYYYMMDDhhmmss)
    // Si c'est le cas, le remplacer par un nom plus descriptif
    if (/^\d{8,14}$/.test(orgName)) {
      console.log('[CONVERTER] Nom d\'organisation semble être un horodatage:', orgName);
      // Déterminer si c'est une organisation d'envoi ou de réception
      const isSender = fieldIndex === 4;
      
      // Remplacer l'horodatage par un nom descriptif
      if (isSender) {
        orgName = `Établissement émetteur`;
      } else {
        orgName = `Établissement destinataire`;
      }
      
      // Conserver l'horodatage original comme identifiant
      orgId = `org-${fieldParts[0]}`;
      
      console.log('[CONVERTER] Nom d\'organisation remplacé par:', orgName);
    } else {
      // Identifiant de l'organisation (component 2)
      // Générer un identifiant stable basé sur le nom plutôt qu'un horodatage
      if (fieldParts.length > 1 && fieldParts[1]) {
        orgId = fieldParts[1];
      } else {
        // Utiliser le nom de l'organisation pour générer un ID stable
        // Nous convertissons le nom en un identifiant alphanumérique sans caractères spéciaux
        orgId = `org-${orgName.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()}`;
      }
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
  
  // Récupération des données du praticien depuis ROL-4 (Role Person)
  const rolePerson = rolSegment[4];
  if (!rolePerson) {
    console.log('[CONVERTER] Échec: ROL-4 (Role Person) manquant');
    return null;
  }
  
  console.log('[CONVERTER] Type de ROL-4:', typeof rolePerson, 'Valeur:', JSON.stringify(rolePerson));
  
  // Variables pour extraire les informations du professionnel
  let rppsOrAdeliId = '';  // Identifiant RPPS ou ADELI
  let internalId = '';     // Identifiant interne
  let familyName = '';     // Nom de famille
  let givenName = '';      // Prénom(s)
  let oid = '1.2.250.1.71.4.2.1'; // OID pour RPPS/ADELI en France
  let authorityName = '';  // Nom de l'autorité d'assignation
  let profession = '';     // Code de profession
  
  try {
    // Cas 1: Format chaîne de caractères (modèle classique)
    if (typeof rolePerson === 'string') {
      console.log('[CONVERTER] Parsing de ROL-4 (chaîne):', rolePerson);
      const rolePersonParts = rolePerson.split('^');
      
      // Identifier les composants
      rppsOrAdeliId = rolePersonParts[0] || '';
      familyName = rolePersonParts.length > 1 ? rolePersonParts[1] || '' : '';
      givenName = rolePersonParts.length > 2 ? rolePersonParts[2] || '' : '';
      
      // Récupérer le type de praticien et l'autorité d'assignation si disponible
      if (rolePersonParts.length > 3 && rolePersonParts[3]) {
        profession = rolePersonParts.length > 6 ? rolePersonParts[6] || 'DOC' : 'DOC';
        
        // Autorité d'assignation et OID
        if (rolePersonParts[3].includes('&')) {
          const assigningAuthority = rolePersonParts[3];
          const authorityComponents = assigningAuthority.split('&');
          authorityName = authorityComponents[0] || '';
          
          if (authorityComponents.length > 1 && authorityComponents[1]) {
            oid = authorityComponents[1];
          }
          
          // Détection spécifique RPPS vs ADELI via l'autorité d'assignation
          if (authorityName.includes('RPPS') || 
              oid === '1.2.250.1.71.4.2.1' || 
              (rppsOrAdeliId && rppsOrAdeliId.length === 11)) {
            console.log('[CONVERTER] Numéro RPPS détecté:', rppsOrAdeliId);
          } else if (authorityName.includes('ADELI')) {
            console.log('[CONVERTER] Numéro ADELI détecté:', rppsOrAdeliId);
          }
        }
      }
    }
    // Cas 2: Format tableau (modèle du nouveau parser)
    else if (Array.isArray(rolePerson)) {
      console.log('[CONVERTER] Parsing de ROL-4 (tableau):', JSON.stringify(rolePerson));
      
      // Extraire les valeurs de base
      rppsOrAdeliId = rolePerson[0] || '';
      familyName = rolePerson.length > 1 ? rolePerson[1] || '' : '';
      givenName = rolePerson.length > 2 ? rolePerson[2] || '' : '';
      
      // Extraire les détails de l'autorité d'assignation
      if (rolePerson.length > 3 && rolePerson[3]) {
        profession = rolePerson.length > 6 ? rolePerson[6] || 'DOC' : 'DOC';
        
        // Cas 1: Autorité sous forme de chaîne
        if (typeof rolePerson[3] === 'string') {
          if (rolePerson[3].includes('&')) {
            const authorityParts = rolePerson[3].split('&');
            authorityName = authorityParts[0] || '';
            oid = authorityParts.length > 1 ? authorityParts[1] : oid;
          } else {
            authorityName = rolePerson[3];
          }
        }
        // Cas 2: Autorité sous forme d'objet
        else if (typeof rolePerson[3] === 'object') {
          const assigningAuth = rolePerson[3];
          if (assigningAuth.namespaceId) {
            authorityName = assigningAuth.namespaceId;
          }
          if (assigningAuth.universalId) {
            oid = assigningAuth.universalId;
          }
        }
        
        // Détection spécifique RPPS vs ADELI
        if (authorityName.includes('RPPS') || 
            oid === '1.2.250.1.71.4.2.1' || 
            (rppsOrAdeliId && rppsOrAdeliId.length === 11)) {
          console.log('[CONVERTER] Numéro RPPS détecté:', rppsOrAdeliId);
        } else if (authorityName.includes('ADELI')) {
          console.log('[CONVERTER] Numéro ADELI détecté:', rppsOrAdeliId);
        }
      }
    }
    
    // Extraire également l'identifiant interne si disponible (ROL-1)
    if (rolSegment[1]) {
      internalId = typeof rolSegment[1] === 'string' ? rolSegment[1] : 
                   (Array.isArray(rolSegment[1]) && rolSegment[1][0] ? rolSegment[1][0] : '');
    }
    
    console.log('[CONVERTER] Données extraites - RPPS/ADELI:', rppsOrAdeliId, 
                'Interne:', internalId,
                'Nom:', familyName, 
                'Prénom:', givenName, 
                'Autorité:', authorityName);
    
  } catch (error) {
    console.error('[CONVERTER] Erreur lors de l\'extraction des données du praticien:', error);
    // En cas d'erreur, utiliser les valeurs par défaut
    if (!familyName) familyName = 'Praticien';
    if (!givenName) givenName = '';
  }
  
  // Si nous n'avons pas d'identifiant RPPS/ADELI mais un identifiant interne, l'utiliser
  if (!rppsOrAdeliId && internalId) {
    rppsOrAdeliId = internalId;
  }
  
  // Si nous n'avons ni identifiant, ni nom, c'est insuffisant
  if (!rppsOrAdeliId && !familyName) {
    console.log('[CONVERTER] Données insuffisantes pour créer un praticien');
    return null;
  }
  
  // Générer un identifiant unique pour le praticien
  // Prendre en priorité le RPPS/ADELI, puis l'ID interne, sinon générer un UUID
  const practitionerId = `practitioner-${rppsOrAdeliId || uuid.v4()}`;
  
  // Créer la ressource Practitioner
  const practitionerResource = {
    resourceType: 'Practitioner',
    id: practitionerId
  };
  
  // Ajouter le nom (toujours requis pour ANS)
  if (familyName || givenName) {
    const humanName = {
      use: 'official'
    };
    
    // Nom de famille obligatoire
    humanName.family = familyName || 'Praticien';
    
    // Prénom(s) facultatif(s)
    if (givenName) {
      // Gérer les prénoms composés (splitter sur espace)
      if (givenName.includes(' ')) {
        humanName.given = givenName.split(' ').filter(Boolean);
      } else {
        humanName.given = [givenName];
      }
    }
    
    practitionerResource.name = [humanName];
  } else {
    // Nom par défaut requis pour la validité ANS
    practitionerResource.name = [{
      use: 'official',
      family: 'Praticien'
    }];
  }
  
  // Ajouter les identifiants selon les règles de l'ANS
  practitionerResource.identifier = [];
  
  // 1. Identifiant RPPS/ADELI (Prioritaire)
  if (rppsOrAdeliId) {
    const isRpps = rppsOrAdeliId.length === 11 || 
                  authorityName.includes('RPPS') || 
                  (profession && profession === 'MD');
    
    const identifierType = isRpps ? 'RPPS' : 'ADELI';
    const identifierDisplay = isRpps ? 'Numéro RPPS' : 'Numéro ADELI';
    
    practitionerResource.identifier.push({
      system: `urn:oid:${oid}`,
      value: rppsOrAdeliId,
      type: {
        coding: [{
          system: 'http://terminology.hl7.org/CodeSystem/v2-0203',
          code: identifierType,
          display: identifierDisplay
        }]
      }
    });
    
    // Ajouter l'autorité d'assignation si disponible
    if (authorityName) {
      practitionerResource.identifier[0].assigner = {
        display: authorityName
      };
    }
  }
  
  // 2. Identifiant interne (secondaire)
  if (internalId && internalId !== rppsOrAdeliId) {
    practitionerResource.identifier.push({
      system: 'urn:system:local',
      value: internalId,
      type: {
        coding: [{
          system: 'http://terminology.hl7.org/CodeSystem/v2-0203',
          code: 'PI',
          display: 'Identifiant interne'
        }]
      }
    });
  }
  
  // Si aucun identifiant n'est disponible, ajouter un identifiant temporaire
  if (practitionerResource.identifier.length === 0) {
    const temporaryId = uuid.v4();
    practitionerResource.identifier.push({
      system: 'urn:system:temporary',
      value: temporaryId,
      type: {
        coding: [{
          system: 'http://terminology.hl7.org/CodeSystem/v2-0203',
          code: 'TEMP',
          display: 'Identifiant temporaire'
        }]
      }
    });
  }
  
  // Ajouter les extensions spécifiques françaises
  // Extensions pour RPPS, ADELI, spécialités, etc.
  addFrenchPractitionerExtensions(practitionerResource, rolSegment);
  
  console.log('[CONVERTER] Ressource Practitioner créée:', JSON.stringify(practitionerResource).substring(0, 200));
  
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
  
  // Générer un UUID unique pour chaque coverage afin d'éviter tout conflit
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
  
  // Ajouter le payeur (organisme d'assurance) si disponible
  // IN1-4 (Nom de la compagnie d'assurance)
  const insurerField = in1Segment.length > 4 ? in1Segment[4] : null;
  
  if (insurerField) {
    let insurerName = '';
    let insurerId = '';
    
    // Extraction du nom de l'assureur
    if (Array.isArray(insurerField)) {
      if (insurerField.length > 0) {
        insurerId = insurerField[0] || '';
      }
      if (insurerField.length > 1) {
        insurerName = insurerField[1] || '';
      }
    } else if (typeof insurerField === 'string') {
      insurerId = insurerField;
      
      // Mapper les codes d'organismes français
      const frenchInsurers = {
        '101': 'CPAM',
        '102': 'MSA',
        '103': 'RSI',
        '104': 'MGEN',
        '105': 'Mutualité Fonction Publique',
        '106': 'CNMSS',
        '107': 'MGP',
        '972': 'CGSS Martinique'
      };
      
      insurerName = frenchInsurers[insurerId] || `Organisme ${insurerId}`;
    }
    
    if (insurerName || insurerId) {
      // Créer un ID unique pour l'organisme d'assurance
      const insurerOrgId = `organization-insurer-${insurerId || uuid.v4()}`;
      
      // Référencer l'organisme payeur
      coverageResource.payor = [
        {
          reference: `urn:uuid:${insurerOrgId}`,
          display: insurerName || `Organisme ${insurerId}`
        }
      ];
      
      // Ajouter l'organisation de l'assureur au bundle principal
      bundleEntries.push({
        fullUrl: `urn:uuid:${insurerOrgId}`,
        resource: {
          resourceType: 'Organization',
          id: insurerOrgId,
          identifier: [{
            system: 'urn:oid:1.2.250.1.71.4.2.2',
            value: insurerId || `ins-${uuid.v4().substring(0, 8)}`
          }],
          name: insurerName || `Organisme ${insurerId}`,
          active: true,
          type: [{
            coding: [{
              system: 'http://terminology.hl7.org/CodeSystem/organization-type',
              code: 'ins',
              display: 'Compagnie d\'assurance'
            }]
          }]
        },
        request: {
          method: 'POST',
          url: 'Organization'
        }
      });
    }
  }
  
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