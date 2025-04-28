/**
 * Module de conversion de HL7 v2.5 vers FHIR R4
 * Implémentation en Node.js avec support complet des spécifications FHIR R4 (v4.0.1)
 * 
 * Ce module permet de convertir des messages HL7 v2.5 en ressources FHIR R4 conformes
 * aux spécifications de l'ANS (Agence du Numérique en Santé). Il gère les particularités 
 * de syntaxe HL7 comme les champs répétés, les composants multiples, et les systèmes 
 * d'identification complexes.
 * 
 * Conforme aux exigences françaises de l'ANS:
 * - Utilisation des OIDs standards français pour les systèmes d'identification
 * - Support des terminologies ANS (TRE-R316, TRE-R51, etc.)
 * - Format des références FHIR conforme à R4
 * - Traitement des spécificités des identifiants français (INS, RPPS, ADELI, etc.)
 * - Structures de ressources conformes aux profils français
 */

const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
// Importer l'adaptateur de terminologies françaises
const frenchAdapter = require('./french_terminology_adapter');
// Importer le module de nettoyage des ressources FHIR
const fhirCleaner = require('./fhir_cleaner');

// Base de données en mémoire pour les logs de conversion
const conversionLogs = [];

/**
 * Fonction utilitaire pour traiter les répétitions dans les champs HL7
 * @param {string} fieldValue - Valeur du champ qui peut contenir des répétitions
 * @returns {Array} Tableau des valeurs répétées
 */
function processRepeatedField(fieldValue) {
  if (!fieldValue) return [];
  return fieldValue.split('~').map(item => item.trim()).filter(item => item !== '');
}

/**
 * Analyser un message HL7 en objets JavaScript
 * @param {string} hl7Message - Message HL7 v2.5
 * @returns {Object} Objet JavaScript structuré
 */
function parseHl7Message(hl7Message) {
  try {
    // Diviser le message en segments
    const segments = hl7Message.trim().split(/[\r\n]+/);
    const result = {
      MSH: {},
      EVN: null,
      PID: null,
      PD1: null,
      PV1: null,
      ROL: [],
      OBR: [],
      OBX: [],
      DG1: [],
      AL1: [],
      NK1: [],
      IN1: [],
      IN2: [],
      ZBE: [],
      ZFP: [],
      ZFV: [],
      ZFM: []
    };

    segments.forEach(segment => {
      const fields = segment.split('|');
      const segmentType = fields[0];

      switch (segmentType) {
        case 'MSH':
          // Traitement spécial pour MSH car le délimiteur | est inclus dans le segment
          // Format: MSH|^~\&|sending_app|sending_facility|receiving_app|receiving_facility|datetime...
          // Remarque: Le premier champ après MSH est le délimiteur lui-même, donc fields[1] = "^~\&"
          // On décale les index de champ pour tenir compte de cette particularité
          result.MSH = {
            fieldSeparator: '|',  
            componentSeparator: fields[1].charAt(0) || '^',
            repetitionSeparator: fields[1].charAt(1) || '~',
            escapeCharacter: fields[1].charAt(2) || '\\',
            subcomponentSeparator: fields[1].charAt(3) || '&',
            sendingApplication: fields[2] || '',
            sendingFacility: fields[3] || '',
            receivingApplication: fields[4] || '',
            receivingFacility: fields[5] || '',
            messageTimestamp: fields[6] || '',
            security: fields[7] || '',
            messageType: fields[8] || '',
            messageControlId: fields[9] || '',
            processingId: fields[10] || '',
            versionId: fields[11] || '',
            sequenceNumber: fields[12] || '',
            continuationPointer: fields[13] || '',
            acceptAcknowledgmentType: fields[14] || '',
            applicationAcknowledgmentType: fields[15] || '',
            countryCode: fields[16] || '',
            characterSet: fields[17] || '',
            principalLanguage: fields[18] || ''
          };
          break;
        case 'EVN':
          result.EVN = {
            eventTypeCode: fields[1] || '',
            recordedDateTime: fields[2] || '',
            dateTimePlannedEvent: fields[3] || '',
            eventReasonCode: fields[4] || '',
            operatorId: fields[5] || '',
            eventOccurred: fields[6] || ''
          };
          break;
        case 'PID':
          // Traiter les identifiants patient qui peuvent être répétés
          const patientIds = processRepeatedField(fields[3]);
          const patientIdentifiers = patientIds.map(id => {
            const parts = id.split('^');
            
            // Traitement de l'autorité d'assignation qui peut contenir des &
            let assigningAuthority = '';
            let assigningFacility = '';
            let assigningNamespaceId = '';
            
            if (parts[3]) {
              const authorityParts = parts[3].split('&');
              assigningNamespaceId = authorityParts[0] || '';
              
              // Si nous avons un OID dans les parties de l'autorité
              if (authorityParts.length > 1) {
                // Le deuxième élément est généralement l'OID
                assigningAuthority = authorityParts[1] || '';
              }
              
              // Si nous avons un type de système de nommage (comme "ISO")
              if (authorityParts.length > 2) {
                assigningFacility = authorityParts[2] || '';
              }
            }
            
            return {
              id: parts[0] || '',
              assigningAuthority: assigningAuthority,
              assigningAuthorityAll: parts[3] || '',
              assigningNamespaceId: assigningNamespaceId, 
              identifierType: parts[4] || '',
              assigningFacility: assigningFacility,
              raw: id
            };
          });
          
          // Traiter les téléphones qui peuvent être répétés
          const phoneNumbers = processRepeatedField(fields[13]);
          const phones = phoneNumbers.map(phone => {
            const parts = phone.split('^');
            return {
              number: parts[0] || '',
              useCode: parts[1] || '',
              type: parts[2] || '',
              raw: phone
            };
          });
          
          // Traiter les téléphones professionnels qui peuvent être répétés
          const businessPhoneNumbers = processRepeatedField(fields[14]);
          const businessPhones = businessPhoneNumbers.map(phone => {
            const parts = phone.split('^');
            return {
              number: parts[0] || '',
              useCode: parts[1] || '',
              type: parts[2] || '',
              raw: phone
            };
          });
          
          // Traiter les adresses qui peuvent être répétées
          const addresses = processRepeatedField(fields[11]);
          const patientAddresses = addresses.map(addr => {
            const parts = addr.split('^');
            return {
              street: parts[0] || '',
              otherDesignation: parts[1] || '',
              city: parts[2] || '',
              state: parts[3] || '',
              postalCode: parts[4] || '',
              country: parts[5] || '',
              addressType: parts[6] || '',
              raw: addr
            };
          });
          
          // Si aucune adresse n'a été trouvée, ajouter une par défaut
          if (patientAddresses.length === 0 && fields[11]) {
            const parts = fields[11].split('^');
            patientAddresses.push({
              street: parts[0] || '',
              otherDesignation: parts[1] || '',
              city: parts[2] || '',
              state: parts[3] || '',
              postalCode: parts[4] || '',
              country: parts[5] || '',
              addressType: parts[6] || '',
              raw: fields[11]
            });
          }
          
          result.PID = {
            setId: fields[1] || '',
            externalPatientId: fields[2] || '',
            patientIdentifiers: patientIdentifiers,
            alternatePatientId: fields[4] || '',
            patientName: fields[5] ? {
              family: fields[5].split('^')[0] || '',
              given: fields[5].split('^')[1] || '',
              middle: fields[5].split('^')[2] || '',
              suffix: fields[5].split('^')[3] || '',
              prefix: fields[5].split('^')[4] || '',
              raw: fields[5]
            } : { family: '', given: '', middle: '', suffix: '', prefix: '', raw: '' },
            motherMaidenName: fields[6] || '',
            dob: fields[7] || '',
            gender: fields[8] || '',
            patientAlias: fields[9] || '',
            race: fields[10] || '',
            addresses: patientAddresses,
            countyCode: fields[12] || '',
            phones: phones,
            businessPhones: businessPhones,
            primaryLanguage: fields[15] || '',
            maritalStatus: fields[16] || '',
            religion: fields[17] || '',
            accountNumber: fields[18] || '',
            ssn: fields[19] || '',
            patientId: patientIdentifiers.length > 0 ? patientIdentifiers[0].id : '' // Pour la compatibilité avec le code existant
          };
          break;
        case 'PV1':
          result.PV1 = {
            setId: fields[1] || '',
            patientClass: fields[2] || '',
            assignedPatientLocation: fields[3] || '',
            admissionType: fields[4] || '',
            preadmitNumber: fields[5] || '',
            priorPatientLocation: fields[6] || '',
            attendingDoctor: fields[7] || '',
            referringDoctor: fields[8] || '',
            consultingDoctor: fields[9] || '',
            hospitalService: fields[10] || '',
            temporaryLocation: fields[11] || '',
            preadmitTestIndicator: fields[12] || '',
            readmissionIndicator: fields[13] || '',
            admitSource: fields[14] || '',
            ambulatoryStatus: fields[15] || '',
            vipIndicator: fields[16] || '',
            admittingDoctor: fields[17] || '',
            patientType: fields[18] || '',
            visitNumber: fields[19] || '',
            financialClass: fields[20] || '',
            chargePriceIndicator: fields[21] || '',
            courtesyCode: fields[22] || '',
            creditRating: fields[23] || '',
            contractCode: fields[24] || '',
            contractEffectiveDate: fields[25] || '',
            contractAmount: fields[26] || '',
            contractPeriod: fields[27] || '',
            interestCode: fields[28] || '',
            transferToBadDebtCode: fields[29] || '',
            transferToBadDebtDate: fields[30] || '',
            badDebtAgencyCode: fields[31] || '',
            badDebtTransferAmount: fields[32] || '',
            badDebtRecoveryAmount: fields[33] || '',
            deleteAccountIndicator: fields[34] || '',
            deleteAccountDate: fields[35] || '',
            dischargeDisposition: fields[36] || '',
            dischargedToLocation: fields[37] || '',
            dietType: fields[38] || '',
            servicingFacility: fields[39] || '',
            bedStatus: fields[40] || '',
            accountStatus: fields[41] || '',
            pendingLocation: fields[42] || '',
            priorTemporaryLocation: fields[43] || '',
            admitDateTime: fields[44] || '',
            dischargeDateTime: fields[45] || ''
          };
          break;
        case 'OBR':
          result.OBR.push({
            setId: fields[1] || '',
            placerOrderNumber: fields[2] || '',
            fillerOrderNumber: fields[3] || '',
            universalServiceId: fields[4] || '',
            priority: fields[5] || '',
            requestedDateTime: fields[6] || '',
            observationDateTime: fields[7] || '',
            observationEndDateTime: fields[8] || '',
            collectionVolume: fields[9] || '',
            collectorIdentifier: fields[10] || '',
            specimenActionCode: fields[11] || '',
            dangerCode: fields[12] || '',
            relevantClinicalInfo: fields[13] || '',
            specimenReceivedDateTime: fields[14] || '',
            specimenSource: fields[15] || '',
            orderingProvider: fields[16] || '',
            orderCallbackPhoneNumber: fields[17] || '',
            placerField1: fields[18] || '',
            placerField2: fields[19] || '',
            fillerField1: fields[20] || '',
            fillerField2: fields[21] || '',
            resultRptStatusChngDateTime: fields[22] || '',
            chargeToPractice: fields[23] || '',
            diagnosticServSectId: fields[24] || '',
            resultStatus: fields[25] || '',
            parentResult: fields[26] || '',
            quantityTiming: fields[27] || '',
            resultCopiesTo: fields[28] || '',
            parent: fields[29] || '',
            transportationMode: fields[30] || '',
            reasonForStudy: fields[31] || '',
            principalResultInterpreter: fields[32] || '',
            assistantResultInterpreter: fields[33] || '',
            technician: fields[34] || '',
            transcriptionist: fields[35] || '',
            scheduledDateTime: fields[36] || '',
            numberOfSampleContainers: fields[37] || '',
            transportLogisticsOfCollectedSample: fields[38] || '',
            collectorComment: fields[39] || '',
            transportArrangementResponsibility: fields[40] || '',
            transportArranged: fields[41] || '',
            escortRequired: fields[42] || '',
            plannedPatientTransportComment: fields[43] || ''
          });
          break;
        case 'OBX':
          result.OBX.push({
            setId: fields[1] || '',
            valueType: fields[2] || '',
            observationIdentifier: fields[3] ? fields[3].split('^')[0] : '',
            observationName: fields[3] ? fields[3].split('^')[1] : '',
            observationSubId: fields[4] || '',
            observationValue: fields[5] || '',
            units: fields[6] ? fields[6].split('^')[0] : '',
            referenceRange: fields[7] || '',
            abnormalFlags: fields[8] || '',
            probability: fields[9] || '',
            natureOfAbnormalTest: fields[10] || '',
            observationResultStatus: fields[11] || '',
            effectiveDateOfReferenceRange: fields[12] || '',
            userDefinedAccessChecks: fields[13] || '',
            observationDateTime: fields[14] || '',
            producerID: fields[15] || '',
            responsibleObserver: fields[16] || '',
            observationMethod: fields[17] || '',
            equipmentInstanceIdentifier: fields[18] || '',
            analysisDateTime: fields[19] || ''
          });
          break;
        case 'NK1':
          result.NK1.push({
            setId: fields[1] || '',
            name: fields[2] || '',
            relationship: fields[3] || '',
            address: fields[4] || '',
            phoneNumber: fields[5] || '',
            businessPhoneNumber: fields[6] || '',
            contactRole: fields[7] || '',
            startDate: fields[8] || '',
            endDate: fields[9] || '',
            nextOfKinAssociatedPartiesJobTitle: fields[10] || '',
            nextOfKinAssociatedPartiesJobCodeClass: fields[11] || '',
            nextOfKinAssociatedPartiesEmployeeNumber: fields[12] || '',
            organizationNameNK1: fields[13] || '',
            maritalStatus: fields[14] || '',
            administrativeSex: fields[15] || '',
            dateTimeOfBirth: fields[16] || '',
            livingDependency: fields[17] || '',
            ambulatoryStatus: fields[18] || '',
            citizenship: fields[19] || '',
            primaryLanguage: fields[20] || '',
            livingArrangement: fields[21] || '',
            publicityCode: fields[22] || '',
            protectionIndicator: fields[23] || '',
            studentIndicator: fields[24] || '',
            religion: fields[25] || '',
            mothersMaidenName: fields[26] || '',
            nationality: fields[27] || '',
            ethnicGroup: fields[28] || '',
            contactReason: fields[29] || '',
            contactPersonsName: fields[30] || '',
            contactPersonsTelephoneNumber: fields[31] || '',
            contactPersonsAddress: fields[32] || '',
            nextOfKinAssociatedPartiesIdentifiers: fields[33] || '',
            jobStatus: fields[34] || '',
            race: fields[35] || '',
            handicap: fields[36] || '',
            contactPersonSocialSecurityNumber: fields[37] || ''
          });
          break;
        case 'DG1':
          result.DG1.push({
            setId: fields[1] || '',
            diagnosisCoding: fields[2] || '',
            diagnosisCode: fields[3] ? fields[3].split('^')[0] : '',
            diagnosisDescription: fields[3] ? fields[3].split('^')[1] : '',
            diagnosisDateTime: fields[4] || '',
            diagnosisType: fields[5] || '',
            majorDiagnosisCategory: fields[6] || '',
            diagnosticRelatedGroup: fields[7] || '',
            drGApprovalIndicator: fields[8] || '',
            drgGrouperReviewCode: fields[9] || '',
            outlierType: fields[10] || '',
            outlierDays: fields[11] || '',
            outlierCost: fields[12] || '',
            grouperVersionAndType: fields[13] || '',
            diagnosisPriority: fields[14] || '',
            diagnosingClinician: fields[15] || '',
            diagnosisClassification: fields[16] || '',
            confidentialIndicator: fields[17] || '',
            attestationDateTime: fields[18] || '',
            diagnosisIdentifier: fields[19] || '',
            diagnosisActionCode: fields[20] || '',
            codeSystem: 'http://hl7.org/fhir/sid/icd-10'
          });
          break;
        case 'AL1':
          result.AL1.push({
            setId: fields[1] || '',
            allergyType: fields[2] || '',
            allergyCodeMnemonic: fields[3] || '',
            allergyCode: fields[3] ? fields[3].split('^')[0] : '',
            allergyDescription: fields[3] ? fields[3].split('^')[1] : '',
            allergySeverity: fields[4] || '',
            allergyReaction: fields[5] || '',
            identificationDate: fields[6] || ''
          });
          break;
        case 'PD1':
          result.PD1 = {
            livingDependency: fields[1] || '',
            livingArrangement: fields[2] || '',
            patientPrimaryFacility: fields[3] || '',
            patientPrimaryCareProviderName: fields[4] || '',
            studentIndicator: fields[5] || '',
            handicap: fields[6] || '',
            livingWill: fields[7] || '',
            organDonor: fields[8] || '',
            separateBill: fields[9] || '',
            duplicatePatient: fields[10] || '',
            publicityIndicator: fields[11] || '',
            protectionIndicator: fields[12] || ''
          };
          break;
        case 'ROL':
          result.ROL.push({
            roleInstanceID: fields[1] || '',
            actionCode: fields[2] || '',
            role: fields[3] || '',
            rolePerson: fields[4] || '',
            roleBeginDateTime: fields[5] || '',
            roleEndDateTime: fields[6] || '',
            roleDuration: fields[7] || '',
            roleActionReason: fields[8] || '',
            providerType: fields[9] || '',
            organizationUnitType: fields[10] || '',
            officeHomeAddress: fields[11] || '',
            officeHomePhoneNumber: fields[12] || ''
          });
          break;
        case 'IN1':
          result.IN1.push({
            setID: fields[1] || '',
            insurancePlanID: fields[2] || '',
            insuranceCompanyID: fields[3] || '',
            insuranceCompanyName: fields[4] || '',
            insuranceCompanyAddress: fields[5] || '',
            insuranceCoContactPerson: fields[6] || '',
            insuranceCoPhoneNumber: fields[7] || '',
            groupNumber: fields[8] || '',
            groupName: fields[9] || '',
            insuredsGroupEmpID: fields[10] || '',
            insuredsGroupEmpName: fields[11] || '',
            planEffectiveDate: fields[12] || '',
            planExpirationDate: fields[13] || '',
            authorizationInformation: fields[14] || '',
            planType: fields[15] || '',
            nameOfInsured: fields[16] || '',
            insuredsRelationshipToPatient: fields[17] || '',
            insuredsDateOfBirth: fields[18] || '',
            insuredsAddress: fields[19] || '',
            assignmentOfBenefits: fields[20] || '',
            coordinationOfBenefits: fields[21] || '',
            coordOfBenPriority: fields[22] || '',
            noticeOfAdmissionFlag: fields[23] || '',
            noticeOfAdmissionDate: fields[24] || '',
            reportOfEligibilityFlag: fields[25] || '',
            reportOfEligibilityDate: fields[26] || '',
            releaseInformationCode: fields[27] || '',
            preAdmitCertPAC: fields[28] || '',
            verificationDateTime: fields[29] || '',
            verificationBy: fields[30] || '',
            typeOfAgreementCode: fields[31] || '',
            billingStatus: fields[32] || '',
            lifetimeReserveDays: fields[33] || '',
            delayBeforeLifetimeReserveDays: fields[34] || '',
            companyPlanCode: fields[35] || '',
            policyNumber: fields[36] || '',
            policyDeductible: fields[37] || '',
            policyLimitAmount: fields[38] || '',
            policyLimitDays: fields[39] || '',
            roomRateSemiPrivate: fields[40] || '',
            roomRatePrivate: fields[41] || '',
            insuredsEmploymentStatus: fields[42] || '',
            insuredsAdministrativeSex: fields[43] || '',
            insuredsEmployersAddress: fields[44] || '',
            verificationStatus: fields[45] || '',
            priorInsurancePlanID: fields[46] || '',
            coverageType: fields[47] || '',
            handicap: fields[48] || '',
            insuredsIDNumber: fields[49] || ''
          });
          break;
        case 'IN2':
          result.IN2.push({
            insuredsEmployeeID: fields[1] || '',
            insuredsSocialSecurityNumber: fields[2] || '',
            insuredsEmployerName: fields[3] || '',
            employerInformationData: fields[4] || '',
            mailClaimParty: fields[5] || '',
            medicareHealthInsCardNumber: fields[6] || '',
            medicaidCaseName: fields[7] || '',
            medicaidCaseNumber: fields[8] || '',
            militarySponsorName: fields[9] || '',
            militaryIDNumber: fields[10] || '',
            dependentOfMilitaryRecipient: fields[11] || '',
            militaryOrganization: fields[12] || '',
            militaryStation: fields[13] || '',
            militaryService: fields[14] || '',
            militaryRankGrade: fields[15] || '',
            militaryStatus: fields[16] || '',
            militaryRetireDate: fields[17] || '',
            militaryNonAvailCertOnFile: fields[18] || '',
            babyCoverage: fields[19] || '',
            combineBabyBill: fields[20] || '',
            bloodDeductible: fields[21] || '',
            specialCoverageApprovalName: fields[22] || '',
            specialCoverageApprovalTitle: fields[23] || '',
            nonCoveredInsuranceCode: fields[24] || '',
            payorID: fields[25] || '',
            payorSubscriberID: fields[26] || '',
            eligibilitySource: fields[27] || '',
            roomCoverageTypeAmount: fields[28] || '',
            policyTypeAmount: fields[29] || '',
            dailyDeductible: fields[30] || '',
            livingDependency: fields[31] || '',
            ambulatoryStatus: fields[32] || '',
            citizenship: fields[33] || '',
            primaryLanguage: fields[34] || '',
            livingArrangement: fields[35] || '',
            publicityIndicator: fields[36] || '',
            protectionIndicator: fields[37] || '',
            studentIndicator: fields[38] || '',
            religion: fields[39] || '',
            mothersMaidenName: fields[40] || '',
            nationality: fields[41] || '',
            ethnicGroup: fields[42] || '',
            maritalStatus: fields[43] || '',
            employmentStartDate: fields[44] || '',
            employmentStopDate: fields[45] || '',
            jobTitle: fields[46] || '',
            jobCodeClass: fields[47] || '',
            jobStatus: fields[48] || '',
            employerContactPersonName: fields[49] || '',
            employerContactPersonPhoneNumber: fields[50] || '',
            employerContactReason: fields[51] || '',
            insuredsContactPersonsName: fields[52] || '',
            insuredsContactPersonTelephone: fields[53] || '',
            insuredsContactPersonReason: fields[54] || '',
            relationshipToThePatientStartDate: fields[55] || '',
            relationshipToThePatientStopDate: fields[56] || '',
            insuranceCoContactReason: fields[57] || '',
            insuranceCoContactPhoneNumber: fields[58] || '',
            policyScope: fields[59] || '',
            policySource: fields[60] || '',
            patientMemberNumber: fields[61] || '',
            guarantorsRelationshipToInsured: fields[62] || '',
            insuredsPhoneNumberHome: fields[63] || '',
            insuredsEmployerPhoneNumber: fields[64] || '',
            militaryHandicappedProgram: fields[65] || '',
            suspendFlag: fields[66] || '',
            copayLimitFlag: fields[67] || '',
            stoplossLimitFlag: fields[68] || '',
            insuredOrganizationNameAndID: fields[69] || '',
            insuredEmployerOrganizationNameAndID: fields[70] || '',
            race: fields[71] || '',
            patientsRelationshipToInsured: fields[72] || ''
          });
          break;
        case 'ZBE':
          // ZBE: Segment spécifique français pour les mouvements (Établissements hospitaliers)
          result.ZBE.push({
            movementID: fields[1] || '',                      // ZBE-1: Identifiant du mouvement
            movementDateTime: fields[2] || '',                // ZBE-2: Date/heure du mouvement
            movementType: fields[3] || '',                    // ZBE-3: Type de mouvement
            actionType: fields[4] || '',                      // ZBE-4: Type d'action (INSERT, UPDATE, etc)
            indicator: fields[5] || '',                       // ZBE-5: Indicateur
            previousLocation: fields[6] || '',                // ZBE-6: Localisation précédente
            currentLocation: fields[7] || '',                 // ZBE-7: Localisation actuelle
            customData: fields.slice(8).join('|')             // Données supplémentaires
          });
          break;
        case 'ZFP':
          // ZFP: Segment spécifique français pour les données patient additionnelles
          result.ZFP.push({
            patientComplementaryData: fields[1] || '',        // ZFP-1: Données complémentaires patient
            patientAdditionalInfo: fields[2] || '',           // ZFP-2: Informations additionnelles
            customData: fields.slice(3).join('|')             // Données supplémentaires
          });
          break;
        case 'ZFV':
          // ZFV: Segment spécifique français pour les données de visite/séjour
          result.ZFV.push({
            visitComplementaryData: fields[1] || '',          // ZFV-1: Données complémentaires de visite
            customData: fields.slice(2).join('|')             // Données supplémentaires
          });
          break;
        case 'ZFM':
          // ZFM: Segment spécifique français pour les données de facturation/gestion
          result.ZFM.push({
            billingType: fields[1] || '',                     // ZFM-1: Type de facturation
            billingAmount: fields[2] || '',                   // ZFM-2: Montant de facturation
            managementData: fields[3] || '',                  // ZFM-3: Données de gestion
            customData: fields.slice(4).join('|')             // Données supplémentaires
          });
          break;
      }
    });

    return result;
  } catch (error) {
    console.error('Erreur lors de l\'analyse du message HL7:', error);
    throw new Error(`Erreur d'analyse HL7: ${error.message}`);
  }
}

/**
 * Formater une date HL7 au format ISO conforme à FHIR R4
 * @param {string} hl7Date - Date au format HL7
 * @param {boolean} [dateOnly=false] - Si true, renvoie seulement la date sans l'heure (pour les champs de type date)
 * @returns {string} Date au format ISO
 * 
 * FHIR R4 accepte ces formats:
 * - Pour les propriétés de type 'date', format YYYY-MM-DD sans partie horaire
 * - Pour les propriétés de type 'dateTime', format YYYY-MM-DDThh:mm:ss+zz:zz avec fuseau horaire (optionnel)
 */
function formatHl7Date(hl7Date, dateOnly = false) {
  if (!hl7Date) return null;
  
  let formattedDate;
  
  // Format YYYYMMDD
  if (hl7Date.length === 8) {
    const year = hl7Date.substring(0, 4);
    const month = hl7Date.substring(4, 6);
    const day = hl7Date.substring(6, 8);
    
    // Pour FHIR R5, si dateOnly est true, retourne seulement YYYY-MM-DD
    if (dateOnly) {
      formattedDate = `${year}-${month}-${day}`;
    } else {
      formattedDate = `${year}-${month}-${day}T00:00:00+00:00`;
    }
  }
  // Format YYYYMMDDhhmm
  else if (hl7Date.length === 12) {
    const year = hl7Date.substring(0, 4);
    const month = hl7Date.substring(4, 6);
    const day = hl7Date.substring(6, 8);
    const hour = hl7Date.substring(8, 10);
    const minute = hl7Date.substring(10, 12);
    
    // Pour FHIR R5, si dateOnly est true, retourne seulement YYYY-MM-DD
    if (dateOnly) {
      formattedDate = `${year}-${month}-${day}`;
    } else {
      formattedDate = `${year}-${month}-${day}T${hour}:${minute}:00+00:00`;
    }
  }
  // Format YYYYMMDDhhmmss
  else if (hl7Date.length === 14) {
    const year = hl7Date.substring(0, 4);
    const month = hl7Date.substring(4, 6);
    const day = hl7Date.substring(6, 8);
    const hour = hl7Date.substring(8, 10);
    const minute = hl7Date.substring(10, 12);
    const second = hl7Date.substring(12, 14);
    
    // Pour FHIR R5, si dateOnly est true, retourne seulement YYYY-MM-DD
    if (dateOnly) {
      formattedDate = `${year}-${month}-${day}`;
    } else {
      formattedDate = `${year}-${month}-${day}T${hour}:${minute}:${second}+00:00`;
    }
  } 
  // Si le format inclut déjà des tirets (pourrait être ISO déjà)
  else if (hl7Date.includes('-')) {
    // Date ISO sans heure (YYYY-MM-DD)
    if (hl7Date.length === 10 && hl7Date.match(/^\d{4}-\d{2}-\d{2}$/)) {
      formattedDate = hl7Date; // Déjà au format FHIR R5 pour les dates
    } 
    // Date ISO avec heure (YYYY-MM-DDThh:mm:ss)
    else if (hl7Date.includes('T')) {
      if (dateOnly) {
        // Extraire seulement la partie date
        formattedDate = hl7Date.split('T')[0];
      } else {
        // S'assurer qu'il y a un fuseau horaire pour FHIR R5
        formattedDate = hl7Date.includes('Z') || hl7Date.includes('+') ? 
                        hl7Date.replace('Z', '+00:00') : hl7Date + '+00:00';
      }
    } 
    // Autre format avec tirets mais pas standard
    else {
      if (dateOnly) {
        formattedDate = hl7Date; // Utiliser tel quel pour date
      } else {
        formattedDate = hl7Date + 'T00:00:00+00:00'; // Ajouter partie horaire
      }
    }
  } 
  // Format non supporté
  else {
    return null;
  }
  
  // Vérifier si la date est valide
  try {
    if (!dateOnly && formattedDate.includes('T')) {
      // Pour datetime, vérifier que c'est bien une date valide
      const testDate = new Date(formattedDate);
      if (isNaN(testDate.getTime())) {
        return null;
      }
    } else {
      // Pour date, vérifier le format YYYY-MM-DD
      if (!formattedDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
        return null;
      }
    }
  } catch (e) {
    return null;
  }
  
  return formattedDate;
}

/**
 * Mapper un code de genre HL7 vers un code FHIR
 * @param {string} hl7Gender - Code genre HL7
 * @returns {string} Code genre FHIR
 */
function mapGender(hl7Gender) {
  if (!hl7Gender) return 'unknown';
  
  switch(hl7Gender.toUpperCase()) {
    case 'M': return 'male';
    case 'F': return 'female';
    case 'O': return 'other';
    case 'U': return 'unknown';
    case 'A': return 'other'; // Ambiguous
    case 'N': return 'unknown'; // Not applicable
    default: return 'unknown';
  }
}

/**
 * Mapper un code de classe de patient HL7 vers un affichage FHIR
 * @param {string} patientClass - Code classe de patient HL7
 * @returns {string} Affichage de la classe de patient en FHIR
 */
function mapPatientClass(patientClass) {
  if (!patientClass) return 'Ambulatory';
  
  switch(patientClass.toUpperCase()) {
    case 'I': return 'Inpatient';
    case 'O': return 'Outpatient';
    case 'E': return 'Emergency';
    case 'P': return 'Preadmit';
    case 'R': return 'Recurring patient';
    case 'B': return 'Obstetrics';
    case 'C': return 'Commercial Account';
    case 'N': return 'Not Applicable';
    case 'U': return 'Unknown';
    default: return 'Ambulatory';
  }
}

/**
 * Mapper un code de sévérité d'allergie HL7 vers une criticité FHIR
 * @param {string} severity - Code sévérité HL7
 * @returns {string} Criticité FHIR
 */
function mapAllergySeverity(severity) {
  if (!severity) return 'low';
  
  switch(severity.toUpperCase()) {
    case 'SV': 
    case 'MI': return 'high';
    case 'MO': return 'moderate';
    case 'LA': 
    case 'U': return 'low';
    default: return 'low';
  }
}

/**
 * Mapper un code d'anomalie HL7 vers un code d'interprétation FHIR
 * @param {string} flag - Code d'anomalie HL7
 * @returns {string} Code d'interprétation FHIR
 */
function mapAbnormalFlag(flag) {
  if (!flag) return 'N';
  
  switch(flag.toUpperCase()) {
    case 'L': return 'L';
    case 'H': return 'H';
    case 'LL': return 'LL';
    case 'HH': return 'HH';
    case '<': return 'L';
    case '>': return 'H';
    case 'N': return 'N';
    case 'A': return 'A';
    case 'AA': return 'AA';
    case 'I': return 'I';
    default: return 'N';
  }
}

/**
 * Mapper un code de relation HL7 vers un code FHIR
 * @param {string} relationshipCode - Code ou description de relation HL7
 * @returns {string} Code de relation FHIR
 */
function mapRelationshipCode(relationshipCode) {
  if (!relationshipCode) return 'ONESELF';
  
  // Extraire le premier composant s'il y a des carets
  let code = relationshipCode.split('^')[0];
  
  // Extraire le premier composant s'il y a des ampersands
  code = code.split('&')[0];
  
  switch(code.toUpperCase()) {
    case 'SPO': 
    case 'SPOUSE': 
    case 'HUSB': 
    case 'WIFE': return 'SPS';
    case 'CHILD': 
    case 'CHLD': 
    case 'SON': 
    case 'DAU': return 'CHILD';
    case 'MOTHER': 
    case 'MTH': return 'MTH';
    case 'FATHER': 
    case 'FTH': return 'FTH';
    case 'PARENT': 
    case 'PAR': return 'PRN';
    case 'SIBLING': 
    case 'SIB': 
    case 'BRO': 
    case 'SIS': return 'SIB';
    case 'GRANDPARENT': 
    case 'GRNDPRT': 
    case 'GRMTH': 
    case 'GRFTH': return 'GRPRN';
    case 'GRANDCHILD': 
    case 'GRNCHLD': 
    case 'GRNDSON': 
    case 'GRNDDAU': return 'GRNDCHILD';
    case 'AUNT': 
    case 'AUN': return 'AUNT';
    case 'UNCLE': 
    case 'UNC': return 'UNCLE';
    case 'COUSIN': 
    case 'COU': return 'COUSN';
    case 'FRIEND': 
    case 'FRD': return 'FRND';
    case 'NEIGHBOR': 
    case 'NBOR': return 'NBOR';
    case 'STEPPARENT': 
    case 'STPPRN': 
    case 'STPMTH': 
    case 'STPFTH': return 'STPPRN';
    case 'STEPCHILD': 
    case 'STPCHLD': 
    case 'STPSON': 
    case 'STPDAU': return 'STPCHLD';
    case 'GUARDIAN': 
    case 'GUARD': return 'GUARD';
    case 'CAREGIVER': 
    case 'CAREGVR': return 'CAREGIVER';
    case 'OTH': 
    case 'OTHER': return 'EXT';
    case 'EMERGENCY': 
    case 'EMRG': 
    case 'EMC': 
    case 'EC': return 'ECON';
    default: return 'ONESELF';
  }
}

/**
 * Mapper un code de rôle professionnel HL7 vers un code du système français TRE_A01-CadreExercice
 * @param {string} roleCode - Code de rôle HL7
 * @returns {string} Code français pour le cadre d'exercice
 * 
 * Référence : Table des cadres d'exercice de l'ANS
 * urn:oid:1.2.250.1.213.1.1.4.9
 */
function mapFrenchRoleCode(roleCode) {
  if (!roleCode) return 'S'; // S = Médecin salarié (code par défaut)
  
  // Extraire le premier composant s'il y a des carets
  let code = typeof roleCode === 'string' ? roleCode.split('^')[0] : roleCode;
  
  // Extraire le premier composant s'il y a des ampersands
  code = typeof code === 'string' ? code.split('&')[0] : code;
  
  if (!code) return 'S';
  
  switch(code.toString().toUpperCase()) {
    // Rôles médicaux
    case 'DOC': 
    case 'DOCTOR':
    case 'MD': return 'L'; // L = Médecin libéral
    case 'MDSP': 
    case 'MEDSPE': return 'S'; // S = Médecin salarié
    case 'MDIR': 
    case 'DIR': return 'H'; // H = Hospitalier
    case 'GP': 
    case 'GENP': return 'L'; // L = Généraliste libéral
    
    // Rôles infirmiers
    case 'NURSE': 
    case 'NRS': return 'S_INFH'; // Infirmier hospitalier
    case 'RN': 
    case 'REGNURSE': return 'S_INFH'; // Infirmier diplômé
    case 'NP': 
    case 'NURPRAC': return 'L_INF'; // Infirmier libéral
    
    // Rôles paramédicaux
    case 'RT': 
    case 'RAD': 
    case 'RADTEC': return 'S_MER'; // Manipulateur en radiologie
    case 'PA': 
    case 'PHYSASST': return 'S_KINE'; // Kiné
    case 'PT': 
    case 'PHYSTEC': return 'S_KINE'; // Kiné
    
    // Rôles pharmaceutiques
    case 'PHARM': 
    case 'RPH': return 'L_PHAR'; // Pharmacien libéral
    case 'PHI': 
    case 'PHARMINT': return 'H_PHAR'; // Pharmacien hospitalier
    
    // Rôles administratifs
    case 'ADMIN': 
    case 'ADM': return 'ADM'; // Administratif
    case 'SEC': 
    case 'SECR': return 'SEC'; // Secrétaire
    
    // Étudiants et internes
    case 'RESIDENT': 
    case 'RES': return 'INT'; // Interne
    case 'INTERN': 
    case 'INT': return 'INT'; // Interne
    case 'STU': 
    case 'STUDENT': return 'ETU'; // Étudiant
    
    // Valeur par défaut
    default: return 'S';
  }
}

/**
 * Mapper un code d'action HL7 vers une description FHIR
 * @param {string} actionType - Code d'action HL7 (souvent dans segments Z)
 * @returns {string} Description de l'action FHIR
 */
function mapActionType(actionType) {
  if (!actionType) return 'Create';
  
  switch(actionType.toUpperCase()) {
    case 'INSERT': return 'Create';
    case 'ADD': return 'Create';
    case 'CREATE': return 'Create';
    case 'UPDATE': return 'Update';
    case 'REVISE': return 'Update';
    case 'MODIFY': return 'Update';
    case 'DELETE': return 'Delete';
    case 'REMOVE': return 'Delete';
    case 'CANCEL': return 'Delete';
    case 'INACTIVE': return 'Inactivate';
    case 'DEACTIVATE': return 'Inactivate';
    case 'MERGE': return 'Merge';
    case 'LINK': return 'Link';
    case 'UNLINK': return 'Unlink';
    default: return 'Create';
  }
}

/**
 * Convertir un message HL7 v2.5 en ressources FHIR R4
 * @param {string} hl7Message - Message HL7 v2.5
 * @returns {Object} Bundle FHIR R4
 * 
 * Cette fonction crée un Bundle FHIR R4 conforme aux spécifications de l'ANS:
 * - Utilisation des OIDs standards français (1.2.250.1.213.x.x.x)
 * - Support des nomenclatures françaises 
 * - Format des références FHIR conforme à R4
 * - Traitement des identifiants spécifiques (INS, RPPS, ADELI)
 * - Structure des ressources conformes aux standards français
 * 
 * Référence: spécifications FHIR v4.0.1 (R4) de l'ANS
 */
function convertHl7ToFhir(hl7Message) {
  try {
    console.log('[CONVERTER] Début de la conversion HL7 vers FHIR');
    
    // Initialiser l'adaptateur de terminologies françaises
    frenchAdapter.initialize();
    
    // Analyser le message HL7
    const hl7Data = parseHl7Message(hl7Message);
    console.log('[CONVERTER] Message HL7 analysé:', JSON.stringify(hl7Data.MSH));
    
    // Créer le Bundle FHIR R4 (conforme aux spécifications de l'ANS)
    const bundleId = uuidv4();
    const fhirBundle = {
      resourceType: 'Bundle',
      type: 'transaction',
      id: bundleId,
      timestamp: new Date().toISOString(),
      // Métadonnées ANS pour l'interopérabilité
      meta: {
        profile: [
          "https://interop.esante.gouv.fr/ig/fhir/hl7/StructureDefinition/hl7-bundle"
        ],
        security: [{
          system: "https://mos.esante.gouv.fr/NOS/TRE_R283-Confidentiality/FHIR/TRE-R283-Confidentiality",
          code: "N",
          display: "Normal"
        }],
        tag: [{
          system: "https://mos.esante.gouv.fr/NOS/TRE_R287-FormatCode/FHIR/TRE-R287-FormatCode",
          code: "urn:ans:ci-sis:hl7:v2.5",
          display: "HL7 v2.5 converti en FHIR R4 (ANS)"
        }]
      },
      entry: [] // Tableau pour stocker les ressources FHIR
    };
    
    // Base URL pour les fullUrl (recommandé par l'ANS)
    const baseUrl = 'https://fhir.org/FHIRHub'; 
    
    // Map pour stocker les références aux ressources créées
    // En FHIR R4, les références sont importantes pour les liens entre ressources
    const resourceRefs = {};
    
    // Créer une ressource Patient si les données PID sont disponibles
    if (hl7Data.PID) {
      const patientId = uuidv4();
      const patientFullUrl = `${baseUrl}/Patient/${patientId}`;
      resourceRefs.patient = 'Patient/' + patientId;
      resourceRefs.patientFullUrl = patientFullUrl;
      
      const patientResource = {
        resourceType: 'Patient',
        id: patientId,
        identifier: []
      };
      
      // Ajouter tous les identifiants du patient
      if (hl7Data.PID.patientIdentifiers && hl7Data.PID.patientIdentifiers.length > 0) {
        hl7Data.PID.patientIdentifiers.forEach(identifier => {
          // Construire le système d'identifiant FHIR
          let system = '';
          
          // Utiliser l'OID de l'autorité d'assignation si disponible (format standard)
          if (identifier.assigningAuthority && identifier.assigningAuthority.match(/^\d+(\.\d+)*$/)) {
            system = `urn:oid:${identifier.assigningAuthority}`;
          }
          // Sinon, utiliser la combinaison de l'ID d'espace de nom et le nom d'autorité
          else if (identifier.assigningNamespaceId) {
            if (identifier.assigningAuthority) {
              system = `urn:${identifier.assigningNamespaceId}:${identifier.assigningAuthority}`;
            } else {
              system = `urn:${identifier.assigningNamespaceId}`;
            }
          } 
          // Fallback sur un système par défaut
          else {
            system = 'urn:oid:1.2.36.146.595.217.0.1';
          }
          
          // Déterminer le type d'identifiant
          let idType = identifier.identifierType || '';
          let idTypeDisplay = '';
          
          switch(idType.toUpperCase()) {
            case 'PI': 
              idTypeDisplay = 'Patient internal identifier'; 
              break;
            case 'MR': 
              idTypeDisplay = 'Medical record number'; 
              break;
            case 'SS': 
              idTypeDisplay = 'Social Security number'; 
              break;
            case 'INS-C': 
              idTypeDisplay = 'Insurance Card'; 
              break;
            case 'INS-NIR': 
              idTypeDisplay = 'Social Insurance Number'; 
              break;
            default: 
              idTypeDisplay = idType || 'Patient Identifier';
          }
          
          // Créer l'identifiant FHIR
          const fhirIdentifier = {
            system: system,
            value: identifier.id
          };
          
          // Ajouter le type si disponible
          if (idType) {
            fhirIdentifier.type = {
              coding: [{
                system: 'http://terminology.hl7.org/CodeSystem/v2-0203',
                code: idType,
                display: idTypeDisplay
              }]
            };
          }
          
          // Gestion spécifique pour les INS français
          if (idType.toUpperCase() === 'INS-NIR' || 
              (system && system.includes('1.2.250.1.213.1.4.8')) || 
              (identifier.assigningNamespaceId === 'ASIP-SANTE-INS-NIR')) {
            
            // Récupérer le système correct pour l'INS français
            fhirIdentifier.system = 'urn:oid:1.2.250.1.213.1.4.8';
            
            // Ajouter l'extension pour l'INS vérifié selon ANS
            const today = new Date().toISOString().split('T')[0]; // Format YYYY-MM-DD
            
            // Extensions conformes au cadre d'interopérabilité ANS
            fhirIdentifier.extension = [
              {
                url: 'https://apifhir.annuaire.sante.fr/ws-sync/exposed/structuredefinition/INS-NIR-Verifie',
                valueBoolean: true
              },
              {
                url: 'https://apifhir.annuaire.sante.fr/ws-sync/exposed/structuredefinition/INS-Source',
                valueCode: 'RECUPERE'
              },
              {
                url: 'https://apifhir.annuaire.sante.fr/ws-sync/exposed/structuredefinition/INS-DateConsultation',
                valueDateTime: today
              }
            ];
          }
          
          // Gestion spécifique pour les INS-C français
          if (idType.toUpperCase() === 'INS-C' || 
              (system && system.includes('1.2.250.1.213.1.4.2')) || 
              (identifier.assigningNamespaceId === 'ASIP-SANTE-INS-C')) {
            
            fhirIdentifier.system = 'urn:oid:1.2.250.1.213.1.4.2';
            
            // Date de vérification si disponible dans l'identifiant
            const verificationDate = identifier.effectiveDate || 
                                    (hl7Data.MSH ? formatHl7Date(hl7Data.MSH.messageDateTime, true) : null);
            
            if (verificationDate) {
              fhirIdentifier.period = {
                start: verificationDate
              };
            }
          }
          
          // Ajouter l'assignateur si disponible
          if (identifier.assigningNamespaceId || identifier.assigningFacility) {
            fhirIdentifier.assigner = {
              display: identifier.assigningNamespaceId || identifier.assigningFacility
            };
          }
          
          patientResource.identifier.push(fhirIdentifier);
        });
      } else if (hl7Data.PID.patientId) {
        // Fallback pour la compatibilité avec l'ancien format
        patientResource.identifier.push({
          system: 'urn:oid:1.2.36.146.595.217.0.1',
          value: hl7Data.PID.patientId
        });
      }
      
      // Ajouter le nom du patient avec traitement amélioré
      patientResource.name = [];
      
      // Traiter le nom principal (PID-5)
      if (hl7Data.PID.patientName && hl7Data.PID.patientName.raw) {
        const nameObj = {
          family: hl7Data.PID.patientName.family || '',
          given: [],
          use: 'official'
        };
        
        // Ajouter tous les prénoms disponibles
        const allGivenNames = new Set();
        
        // Ajouter le prénom principal
        if (hl7Data.PID.patientName.given && hl7Data.PID.patientName.given.trim() !== '') {
          allGivenNames.add(hl7Data.PID.patientName.given);
        }
        
        // Ajouter les autres prénoms s'ils sont différents du premier
        if (hl7Data.PID.patientName.middle) {
          // Diviser les prénoms multiples s'ils sont séparés par des espaces
          const middleNames = hl7Data.PID.patientName.middle.split(' ');
          middleNames.forEach(name => {
            if (name.trim() !== '' && name !== hl7Data.PID.patientName.given) {
              allGivenNames.add(name.trim());
            }
          });
        }
        
        // Convertir le Set en tableau
        nameObj.given = Array.from(allGivenNames);
        
        // Ajouter le préfixe (exemple: "MME")
        if (hl7Data.PID.patientName.prefix && hl7Data.PID.patientName.prefix.trim() !== '') {
          nameObj.prefix = [hl7Data.PID.patientName.prefix];
        }
        
        // Ajouter le suffixe si disponible
        if (hl7Data.PID.patientName.suffix && hl7Data.PID.patientName.suffix.trim() !== '') {
          nameObj.suffix = [hl7Data.PID.patientName.suffix];
        }
        
        // Déterminer l'utilisation du nom (usage officiel ou courant)
        const fullNameParts = hl7Data.PID.patientName.raw.split('^');
        if (fullNameParts.length > 6 && fullNameParts[6] === 'D') {
          nameObj.use = 'usual';
        } else if (fullNameParts.length > 6 && fullNameParts[6] === 'L') {
          nameObj.use = 'official';
        }
        
        patientResource.name.push(nameObj);
      }
      
      // Traiter les noms supplémentaires s'ils existent (autres répétitions de PID-5)
      if (hl7Data.PID.alternatePatientName && hl7Data.PID.alternatePatientName.raw) {
        const altNameParts = hl7Data.PID.alternatePatientName.raw.split('^');
        if (altNameParts.length > 0 && altNameParts[0].trim() !== '') {
          const altNameObj = {
            family: altNameParts[0] || '',
            given: [],
            use: 'maiden' // Par défaut pour les noms alternatifs
          };
          
          // Ajouter les prénoms si disponibles
          if (altNameParts.length > 1 && altNameParts[1].trim() !== '') {
            altNameObj.given.push(altNameParts[1]);
          }
          
          if (altNameParts.length > 2 && altNameParts[2].trim() !== '') {
            altNameObj.given.push(altNameParts[2]);
          }
          
          // Déterminer l'utilisation du nom alternatif
          if (altNameParts.length > 6) {
            switch (altNameParts[6]) {
              case 'D': altNameObj.use = 'usual'; break;
              case 'L': altNameObj.use = 'official'; break;
              case 'M': altNameObj.use = 'maiden'; break;
              case 'N': altNameObj.use = 'nickname'; break;
              default: altNameObj.use = 'old';
            }
          }
          
          patientResource.name.push(altNameObj);
        }
      }
      
      // S'assurer qu'il y a au moins un nom
      if (patientResource.name.length === 0) {
        patientResource.name = [{
          family: hl7Data.PID.patientName ? (hl7Data.PID.patientName.family || '') : '',
          given: []
        }];
      }
      
      // Ajouter la date de naissance s'il y en a une
      if (hl7Data.PID.dob) {
        patientResource.birthDate = formatHl7Date(hl7Data.PID.dob, true); // true pour dateOnly, format YYYY-MM-DD
      }
      
      // Ajouter le genre s'il y en a un
      if (hl7Data.PID.gender) {
        patientResource.gender = mapGender(hl7Data.PID.gender);
      }
      
      // Ajouter les adresses
      if (hl7Data.PID.addresses && hl7Data.PID.addresses.length > 0) {
        patientResource.address = [];
        
        // Map pour suivre les adresses uniques par "use" (pour éviter les doublons)
        const uniqueAddresses = new Map();
        
        hl7Data.PID.addresses.forEach(addr => {
          // Vérifier si l'adresse a des données significatives
          const hasSignificantData = 
            (addr.street && addr.street.trim() !== '') || 
            (addr.city && addr.city.trim() !== '') || 
            (addr.state && addr.state.trim() !== '') || 
            (addr.postalCode && addr.postalCode.trim() !== '');
          
          // Ne pas créer d'adresse vide sans données significatives
          if (!hasSignificantData && (!addr.country || addr.country === 'UNK')) {
            return; // Skip cette adresse
          }
          
          const fhirAddress = {
            line: addr.street && addr.street.trim() !== '' ? [addr.street] : [],
            city: addr.city || '',
            state: addr.state || '',
            postalCode: addr.postalCode || '',
            country: addr.country && addr.country !== 'UNK' ? addr.country : 'FRA' // Par défaut 'FRA' pour la France
          };
          
          // Déterminer le type d'adresse
          let use = 'home'; // Type par défaut
          if (addr.addressType) {
            switch (addr.addressType.toUpperCase()) {
              case 'H': use = 'home'; break;
              case 'W': use = 'work'; break;
              case 'B': use = 'work'; break; // Business
              case 'M': use = 'home'; break; // Mailing
              case 'C': use = 'temp'; break; // Current/Temporary
              case 'P': use = 'old'; break;  // Permanent
              default: use = 'home';
            }
            fhirAddress.use = use;
          }
          
          // Ajouter la deuxième ligne si disponible
          if (addr.otherDesignation && addr.otherDesignation.trim() !== '') {
            fhirAddress.line.push(addr.otherDesignation);
          }
          
          // Traitement spécifique pour les adresses françaises (conformité ANS)
          if ((fhirAddress.country === 'FRA' || fhirAddress.country === 'FR' || !fhirAddress.country) && fhirAddress.postalCode) {
            // Extension pour le code INSEE de la commune française
            if (/^\d{5}$/.test(fhirAddress.postalCode)) {
              // Extraction du code département à partir du code postal
              const departementCode = fhirAddress.postalCode.substring(0, 2);
              // Code INSEE par défaut (code département + '000')
              // Dans une implémentation réelle, il faudrait interroger une API de référence
              const codeCommuneInsee = addr.censusTrack || `${departementCode}000`;
              
              fhirAddress.extension = fhirAddress.extension || [];
              fhirAddress.extension.push({
                url: 'https://interop.esante.gouv.fr/ig/fhir/annuaire/StructureDefinition/commune-cog-code',
                valueString: codeCommuneInsee
              });
              
              // Gestion des extensions pour les DOM-TOM
              if (['97', '98'].includes(departementCode)) {
                fhirAddress.extension.push({
                  url: 'http://hl7.org/fhir/StructureDefinition/iso21090-ADXP-precinct',
                  valueString: departementCode
                });
              }
            }
          }
          
          // Vérifier si nous avons déjà une adresse du même type
          if (uniqueAddresses.has(use)) {
            const existingAddr = uniqueAddresses.get(use);
            
            // Si l'adresse existante a moins d'informations, la remplacer
            const existingHasData = 
              existingAddr.line.length > 0 || 
              existingAddr.city.trim() !== '' || 
              existingAddr.state.trim() !== '' || 
              existingAddr.postalCode.trim() !== '' ||
              existingAddr.country.trim() !== '';
            
            if (!existingHasData && hasSignificantData) {
              uniqueAddresses.set(use, fhirAddress);
            }
          } else {
            // Ajouter l'adresse au Map des adresses uniques
            uniqueAddresses.set(use, fhirAddress);
          }
        });
        
        // Ajouter toutes les adresses uniques à la ressource patient
        for (const address of uniqueAddresses.values()) {
          patientResource.address.push(address);
        }
      }
      
      // Ajouter les téléphones et emails avec prise en charge améliorée
      patientResource.telecom = [];
      
      // Map pour suivre les téléphones uniques par "use" (pour éviter les doublons)
      const uniqueTelecoms = new Map();
      
      // AMÉLIORATION: Traitement détaillé des numéros dans PID-13 et PID-14
      // PID-13 contient souvent les numéros personnels et PID-14 les numéros professionnels
      // Format: [type]^[telecom type]^[equipment type]^[email/area code]^[phone]^[extension]^[any text]
      if (hl7Data.PID.phones && hl7Data.PID.phones.length > 0) {
        hl7Data.PID.phones.forEach(phone => {
          // Vérifier si le numéro est valide
          if (!phone.number || phone.number.trim() === '') {
            return; // Ignorer les numéros vides
          }
          
          // Déterminer le système (phone, email, fax, etc.) et l'usage (home, work, mobile)
          let system = 'phone';
          let use = 'home';
          
          // Traiter les différents types de télécommunications (PID-13.2 et PID-13.3)
          if (phone.telecomType) {
            if (phone.telecomType.toUpperCase() === 'NET' && phone.internetAddress) {
              // C'est une adresse email
              system = 'email';
              use = 'home';
              
              const telecomObj = {
                system: system,
                value: phone.internetAddress,
                use: use
              };
              
              const key = `${system}:${use}:${phone.internetAddress}`;
              if (!uniqueTelecoms.has(key)) {
                uniqueTelecoms.set(key, telecomObj);
              }
              return; // Continuer avec l'itération suivante
            }
            
            if (phone.telecomType.toUpperCase() === 'FAX') {
              system = 'fax';
            }
          }
          
          // Déterminer l'usage (maison, travail, mobile)
          if (phone.useCode) {
            switch (phone.useCode.toUpperCase()) {
              case 'WPN': use = 'work'; break;
              case 'PRN': use = 'home'; break;
              case 'NET': use = 'mobile'; break;
              case 'ORN': use = 'old'; break;
              case 'ASN': use = 'temp'; break; // Temporary
              default: use = 'home';
            }
          }
          
          // Normaliser le numéro de téléphone français
          let formattedNumber = phone.number;
          
          // Format français - +33 ou numéro commençant par 0
          if (formattedNumber.startsWith('+33') || (formattedNumber.startsWith('0') && formattedNumber.length === 10)) {
            // Convertir 0x xx xx xx xx en +33 x xx xx xx xx
            if (formattedNumber.startsWith('0')) {
              formattedNumber = '+33' + formattedNumber.substring(1);
            }
            
            // Ajouter une extension pour le format d'affichage français
            const telecomObj = {
              system: system,
              value: formattedNumber,
              use: use,
              extension: [{
                url: 'http://hl7.org/fhir/StructureDefinition/rendering-style',
                valueString: formattedNumber.startsWith('+33') ? '+33 n nn nn nn nn' : '0n nn nn nn nn'
              }]
            };
            
            // Vérifier si nous avons déjà un téléphone du même type avec le même numéro
            const key = `${system}:${use}:${formattedNumber}`;
            if (!uniqueTelecoms.has(key)) {
              uniqueTelecoms.set(key, telecomObj);
            }
          } else {
            // Format non français - conserver tel quel
            const key = `${system}:${use}:${phone.number}`;
            if (!uniqueTelecoms.has(key)) {
              uniqueTelecoms.set(key, {
                system: system,
                value: phone.number,
                use: use
              });
            }
          }
        });
      } else if (hl7Data.PID.phone && hl7Data.PID.phone.trim() !== '') {
        // Compatibilité avec l'ancien format
        const key = `phone:home:${hl7Data.PID.phone}`;
        uniqueTelecoms.set(key, {
          system: 'phone',
          value: hl7Data.PID.phone,
          use: 'home'
        });
      }
      
      // AMÉLIORATION: Prise en charge explicite des emails dans PID-13
      // Traiter l'adresse email si disponible dans le format structuré
      if (hl7Data.PID.emailAddress && hl7Data.PID.emailAddress.trim() !== '') {
        const key = `email:home:${hl7Data.PID.emailAddress}`;
        if (!uniqueTelecoms.has(key)) {
          uniqueTelecoms.set(key, {
            system: 'email',
            value: hl7Data.PID.emailAddress,
            use: 'home'
          });
        }
      }
      
      // Ajouter les numéros professionnels
      if (hl7Data.PID.businessPhones && hl7Data.PID.businessPhones.length > 0) {
        hl7Data.PID.businessPhones.forEach(phone => {
          // Vérifier si le numéro est valide
          if (!phone.number || phone.number.trim() === '') {
            return; // Ignorer les numéros vides
          }
          
          // Vérifier si nous avons déjà ce numéro
          const key = `phone:work:${phone.number}`;
          if (!uniqueTelecoms.has(key)) {
            uniqueTelecoms.set(key, {
              system: 'phone',
              value: phone.number,
              use: 'work'
            });
          }
        });
      } else if (hl7Data.PID.businessPhone && hl7Data.PID.businessPhone.trim() !== '') {
        // Compatibilité avec l'ancien format
        const key = `phone:work:${hl7Data.PID.businessPhone}`;
        uniqueTelecoms.set(key, {
          system: 'phone',
          value: hl7Data.PID.businessPhone,
          use: 'work'
        });
      }
      
      // Ajouter tous les téléphones uniques à la ressource patient
      for (const telecom of uniqueTelecoms.values()) {
        patientResource.telecom.push(telecom);
      }
      
      // AMÉLIORATION: Traitement du lieu de naissance (PID-23)
      if (hl7Data.PID.birthPlace && hl7Data.PID.birthPlace.trim() !== '') {
        patientResource.extension = patientResource.extension || [];
        patientResource.extension.push({
          url: 'http://hl7.org/fhir/StructureDefinition/patient-birthPlace',
          valueString: hl7Data.PID.birthPlace
        });
      }
      
      // AMÉLIORATION: Traitement du médecin traitant (PID-48 dans certaines implémentations françaises)
      if (hl7Data.PID.primaryCareProvider || hl7Data.PID.primaryCarePractitioner) {
        const gpCode = hl7Data.PID.primaryCareProvider || hl7Data.PID.primaryCarePractitioner;
        const gpParts = gpCode.split('^');
        
        if (gpParts.length > 1) {
          // Créer une ressource Practitioner pour le médecin traitant
          const gpId = uuidv4();
          const gpFullUrl = `${baseUrl}/Practitioner/${gpId}`;
          
          // Déterminer le système d'identification
          let identifierSystem = 'http://terminology.hl7.org/CodeSystem/v2-0203';
          
          // Vérifier si c'est un identifiant RPPS ou ADELI (spécifique à la France)
          if (gpCode.includes('RPPS') || gpCode.includes('1.2.250.1.71.4.2.1')) {
            identifierSystem = 'urn:oid:1.2.250.1.71.4.2.1'; // RPPS
          } else if (gpCode.includes('ADELI') || gpCode.includes('1.2.250.1.71.4.2.2')) {
            identifierSystem = 'urn:oid:1.2.250.1.71.4.2.2'; // ADELI
          }
          
          const practitionerResource = {
            resourceType: 'Practitioner',
            id: gpId,
            identifier: [
              {
                system: identifierSystem,
                value: gpParts[0]
              }
            ],
            name: [
              {
                family: gpParts[1] || '',
                given: gpParts[2] ? [gpParts[2]] : [],
                prefix: gpParts[3] ? [gpParts[3]] : []
              }
            ]
          };
          
          // Ajouter la ressource Practitioner au Bundle
          fhirBundle.entry.push({
            fullUrl: gpFullUrl,
            resource: practitionerResource,
            request: {
              method: 'POST',
              url: 'Practitioner'
            }
          });
          
          // Référencer le médecin traitant dans la ressource Patient
          patientResource.generalPractitioner = [
            {
              reference: gpFullUrl
            }
          ];
        }
      }
      
      // Ajouter la ressource Patient au Bundle avec fullUrl obligatoire en R4
      fhirBundle.entry.push({
        fullUrl: `${baseUrl}/Patient/${patientId}`,
        resource: patientResource,
        request: {
          method: 'POST',
          url: 'Patient'
        }
      });
      
      // Créer une ressource Person liée au Patient
      const personId = uuidv4();
      const personResource = {
        resourceType: 'Person',
        id: personId,
        name: patientResource.name,
        gender: patientResource.gender,
        birthDate: patientResource.birthDate,
        telecom: patientResource.telecom,
        address: patientResource.address,
        link: [{
          target: {
            reference: resourceRefs.patientFullUrl || resourceRefs.patient
          }
        }]
      };
      
      // Ajouter la ressource Person au Bundle avec fullUrl obligatoire en R4
      fhirBundle.entry.push({
        fullUrl: `${baseUrl}/Person/${personId}`,
        resource: personResource,
        request: {
          method: 'POST',
          url: 'Person'
        }
      });
    }
    
    // Créer une ressource Encounter si les données PV1 sont disponibles
    // En FHIR R4, la structure de l'Encounter a changé par rapport à R4
    if (hl7Data.PV1) {
      const encounterId = uuidv4();
      const encounterFullUrl = `${baseUrl}/Encounter/${encounterId}`;
      resourceRefs.encounter = 'Encounter/' + encounterId;
      resourceRefs.encounterFullUrl = encounterFullUrl;
      
      // En FHIR R4 (contrairement à R5), la propriété 'class' est un objet Coding unique
      const encounterResource = {
        resourceType: 'Encounter',
        id: encounterId,
        // En FHIR R4, le statut pour indiquer une rencontre terminée est "finished"
        status: 'finished',
        // En FHIR R4, la propriété 'class' est un objet Coding unique
        class: {
          system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
          code: hl7Data.PV1.patientClass || 'AMB',
          display: mapPatientClass(hl7Data.PV1.patientClass)
        },
        subject: {
          reference: resourceRefs.patientFullUrl || resourceRefs.patient
        },
        period: {}
      };
      
      // Ajouter la date d'entrée si disponible
      if (hl7Data.PV1.admitDateTime) {
        // Format de date spécifique pour les dateTime en R5
        encounterResource.period.start = formatHl7Date(hl7Data.PV1.admitDateTime);
      }
      
      // Ajouter la date de sortie si disponible
      if (hl7Data.PV1.dischargeDateTime) {
        // Format de date spécifique pour les dateTime en R5
        encounterResource.period.end = formatHl7Date(hl7Data.PV1.dischargeDateTime);
      }
      
      // Ajouter l'établissement si disponible
      if (hl7Data.PV1.assignedPatientLocation) {
        encounterResource.location = [{
          location: {
            display: hl7Data.PV1.assignedPatientLocation
          }
        }];
      }
      
      // Ajouter les praticiens si disponibles
      if (hl7Data.PV1.attendingDoctor) {
        const practitionerId = uuidv4();
        const practitionerFullUrl = `${baseUrl}/Practitioner/${practitionerId}`;
        resourceRefs.practitioner = 'Practitioner/' + practitionerId;
        resourceRefs.practitionerFullUrl = practitionerFullUrl;
        
        // Créer la ressource Practitioner
        const doctorParts = hl7Data.PV1.attendingDoctor.split('^');
        const practitionerResource = {
          resourceType: 'Practitioner',
          id: practitionerId,
          identifier: [{
            system: 'http://example.org/fhir/sid/provider-id', // Utiliser un système valide pour R4
            value: doctorParts[0] || ''
          }],
            name: [{
            family: doctorParts[1] || '',
            given: doctorParts[2] && doctorParts[2].trim() !== '' ? [doctorParts[2]] : [],
            prefix: doctorParts[4] && doctorParts[4].trim() !== '' ? [doctorParts[4]] : []
          }]
        };
        
        // Ajouter la ressource Practitioner au Bundle avec fullUrl obligatoire en R4
        fhirBundle.entry.push({
          fullUrl: `${baseUrl}/Practitioner/${practitionerId}`,
          resource: practitionerResource,
          request: {
            method: 'POST',
            url: 'Practitioner'
          }
        });
        
        // Ajouter le praticien à l'Encounter
        encounterResource.participant = [{
          individual: {
            reference: resourceRefs.practitionerFullUrl || resourceRefs.practitioner
          }
        }];
      }
      
      // Ajouter l'Encounter au Bundle avec fullUrl obligatoire en R4
      fhirBundle.entry.push({
        fullUrl: `${baseUrl}/Encounter/${encounterId}`,
        resource: encounterResource,
        request: {
          method: 'POST',
          url: 'Encounter'
        }
      });
    }
    
    // Créer des ressources Observation pour chaque segment OBX
    hl7Data.OBX.forEach(obx => {
      const observationId = uuidv4();
      const observationResource = {
        resourceType: 'Observation',
        id: observationId,
        status: 'final', // Le statut 'final' est toujours valide en R4
        code: {
          coding: [{
            system: 'http://loinc.org',
            code: obx.observationIdentifier,
            display: obx.observationName
          }]
        }
      };
      
      // Uniquement ajouter valueString si obx.observationValue n'est pas vide (R4 est strict)
      if (obx.observationValue && obx.observationValue.trim() !== '') {
        observationResource.valueString = obx.observationValue;
      }
      
      // Référencer le patient si disponible
      if (resourceRefs.patient) {
        observationResource.subject = {
          reference: resourceRefs.patientFullUrl || resourceRefs.patient
        };
      }
      
      // Référencer l'encounter si disponible
      if (resourceRefs.encounter) {
        observationResource.encounter = {
          reference: resourceRefs.encounterFullUrl || resourceRefs.encounter
        };
      }
      
      // Ajouter l'unité si disponible
      if (obx.units && obx.observationValue && obx.observationValue.trim() !== '') {
        // Seulement créer valueQuantity si observationValue est valide
        const numValue = parseFloat(obx.observationValue);
        if (!isNaN(numValue)) {
          observationResource.valueQuantity = {
            value: numValue,
            unit: obx.units,
            system: 'http://unitsofmeasure.org',
            code: obx.units
          };
          // Supprimer valueString uniquement s'il a été ajouté
          if (observationResource.valueString) {
            delete observationResource.valueString;
          }
        }
      }
      
      // Ajouter la date si disponible - format dateTime pour R4
      if (obx.observationDateTime) {
        observationResource.effectiveDateTime = formatHl7Date(obx.observationDateTime);
      }
      
      // Ajouter l'interprétation si disponible
      if (obx.abnormalFlags && obx.abnormalFlags.trim() !== '') {
        const flagCode = mapAbnormalFlag(obx.abnormalFlags);
        if (flagCode) {
          observationResource.interpretation = [{
            coding: [{
              system: 'http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation',
              code: flagCode,
              display: obx.abnormalFlags
            }]
          }];
        }
      }
      
      // Ajouter la ressource Observation au Bundle avec fullUrl obligatoire en R4
      fhirBundle.entry.push({
        fullUrl: `${baseUrl}/Observation/${observationId}`,
        resource: observationResource,
        request: {
          method: 'POST',
          url: 'Observation'
        }
      });
    });
    
    // Créer une ressource Condition si les données de diagnostic sont disponibles
    if (hl7Data.DG1 && hl7Data.DG1.length > 0) {
      hl7Data.DG1.forEach(dg1 => {
        const conditionResource = {
          resourceType: 'Condition',
          id: uuidv4(),
          clinicalStatus: {
            coding: [{
              system: 'http://terminology.hl7.org/CodeSystem/condition-clinical',
              code: 'active'
            }]
          },
          code: {
            coding: [{
              system: dg1.codeSystem || 'http://hl7.org/fhir/sid/icd-10',
              code: dg1.diagnosisCode || 'unknown',
              display: dg1.diagnosisDescription || 'Unknown Diagnosis'
            }]
          }
        };
        
        // Référencer le patient si disponible
        if (resourceRefs.patient) {
          conditionResource.subject = {
            reference: resourceRefs.patientFullUrl || resourceRefs.patient
          };
        }
        
        // Référencer l'encounter si disponible
        if (resourceRefs.encounter) {
          conditionResource.encounter = {
            reference: resourceRefs.encounterFullUrl || resourceRefs.encounter
          };
        }
        
        // Ajouter la date du diagnostic si disponible
        if (dg1.diagnosisDateTime) {
          conditionResource.recordedDate = formatHl7Date(dg1.diagnosisDateTime);
        }
        
        // Ajouter la ressource Condition au Bundle avec fullUrl obligatoire en R4
        fhirBundle.entry.push({
          fullUrl: `${baseUrl}/Condition/${conditionResource.id}`,
          resource: conditionResource,
          request: {
            method: 'POST',
            url: 'Condition'
          }
        });
      });
    }
    
    // Créer une ressource AllergyIntolerance si les données d'allergie sont disponibles
    if (hl7Data.AL1 && hl7Data.AL1.length > 0) {
      hl7Data.AL1.forEach(al1 => {
        const allergyResource = {
          resourceType: 'AllergyIntolerance',
          id: uuidv4(),
          type: 'allergy',
          criticality: mapAllergySeverity(al1.allergySeverity),
          code: {
            coding: [{
              system: 'http://terminology.hl7.org/CodeSystem/v3-AllergyIntolerance',
              code: al1.allergyCode || 'UNSP',
              display: al1.allergyDescription || 'Unspecified Allergy'
            }]
          }
        };
        
        // Référencer le patient si disponible
        if (resourceRefs.patient) {
          allergyResource.patient = {
            reference: resourceRefs.patientFullUrl || resourceRefs.patient
          };
        }
        
        // Ajouter la ressource AllergyIntolerance au Bundle avec fullUrl obligatoire en R4
        fhirBundle.entry.push({
          fullUrl: `${baseUrl}/AllergyIntolerance/${allergyResource.id}`,
          resource: allergyResource,
          request: {
            method: 'POST',
            url: 'AllergyIntolerance'
          }
        });
      });
    }
    
    // Créer une ressource Organization si les données MSH sont disponibles
    if (hl7Data.MSH && hl7Data.MSH.sendingFacility) {
      const organizationResource = {
        resourceType: 'Organization',
        id: uuidv4(),
        identifier: [{
          system: 'http://terminology.hl7.org/CodeSystem/v3-HL7',
          value: hl7Data.MSH.sendingFacility
        }],
            name: hl7Data.MSH.sendingFacility
      };
      
      // Ajouter la ressource Organization au Bundle avec fullUrl obligatoire en R4
      fhirBundle.entry.push({
        fullUrl: `${baseUrl}/Organization/${organizationResource.id}`,
        resource: organizationResource,
        request: {
          method: 'POST',
          url: 'Organization'
        }
      });
    }
    
    // Créer des ressources de Couverture (Coverage) à partir des segments IN1
    // Adaptation pour FHIR R4 et standards français
    if (hl7Data.IN1 && hl7Data.IN1.length > 0) {
      hl7Data.IN1.forEach((insurance, index) => {
        const coverageId = uuidv4();
        
        // Structure conforme à FHIR R4 pour l'assurance maladie française
        const coverageResource = {
          resourceType: 'Coverage',
          id: coverageId,
          status: 'active',
          type: {
            coding: [{
              // Utilisation du système de codes français pour les types d'assurance
              system: 'https://mos.esante.gouv.fr/NOS/JDV_J65-TypeMutuelles/FHIR/JDV-J65-TypeMutuelles',
              code: insurance.planType || 'AMO',
              display: insurance.planDescription || 'Assurance Maladie Obligatoire'
            }]
          },
          subscriberId: insurance.insuredsIDNumber,
          beneficiary: resourceRefs.patient ? {
            reference: resourceRefs.patientFullUrl || resourceRefs.patient
          } : undefined,
          period: {}
        };
        
        // Traitement spécifique pour l'identifiant du bénéficiaire français (NIR)
        if (insurance.insuredsIDNumber) {
          // En France, le NIR (numéro de sécurité sociale) a un format spécifique
          if (/^\d{13,15}$/.test(insurance.insuredsIDNumber)) {
            // Ajouter une extension pour le NIR conforme à l'ANS
            coverageResource.extension = [{
              url: 'https://interop.esante.gouv.fr/ig/fhir/ror/StructureDefinition/ror-organization-field-codeNir',
              valueString: insurance.insuredsIDNumber
            }];
          }
        }
        
        // Ajouter la date de début si disponible
        if (insurance.planEffectiveDate) {
          coverageResource.period.start = formatHl7Date(insurance.planEffectiveDate, true);
        }
        
        // Ajouter la date de fin si disponible
        if (insurance.planExpirationDate) {
          coverageResource.period.end = formatHl7Date(insurance.planExpirationDate, true);
        }
        
        // Gestion des droits spécifiques français (ALD, maternité, etc.)
        if (hl7Data.IN2 && hl7Data.IN2[index]) {
          const in2 = hl7Data.IN2[index];
          
          // Traitement des informations complémentaires de l'assurance 
          // (segments IN2 souvent utilisés en France pour les ALD, CMU, etc.)
          if (in2.specialCoverageInfo) {
            coverageResource.extension = coverageResource.extension || [];
            coverageResource.extension.push({
              url: 'https://interop.esante.gouv.fr/ig/fhir/identite/StructureDefinition/exonerationCode',
              valueCodeableConcept: {
                coding: [{
                  system: 'https://mos.esante.gouv.fr/NOS/TRE_R309-Motif-exoneration/FHIR/TRE-R309-Motif-exoneration',
                  code: in2.specialCoverageCode || '7',
                  display: in2.specialCoverageInfo
                }]
              }
            });
          }
        }
        
        // Ajouter le payeur (l'organisme d'assurance maladie français)
        if (insurance.insuranceCompanyName) {
          const payerId = uuidv4();
          
          // Créer une ressource Organization pour l'assureur avec les identifiants français
          const payerResource = {
            resourceType: 'Organization',
            id: payerId,
            identifier: [{
              // Utiliser le système d'identification officiel pour les organismes d'assurance français
              system: 'urn:oid:1.2.250.1.213.1.6.7',
              value: insurance.insuranceCompanyID || `${index + 1}`
            }],
            name: insurance.insuranceCompanyName,
            type: [{
              coding: [{
                system: 'https://mos.esante.gouv.fr/NOS/TRE_G08-TypeOrganisme/FHIR/TRE-G08-TypeOrganisme',
                code: 'CPAM',
                display: 'Caisse Primaire d\'Assurance Maladie'
              }]
            }]
          };
          
          // Ajouter le payeur au Bundle
          fhirBundle.entry.push({
            fullUrl: `${baseUrl}/Organization/${payerId}`,
            resource: payerResource,
            request: {
              method: 'POST',
              url: 'Organization'
            }
          });
          
          // Référencer le payeur dans la couverture
          coverageResource.payor = [{
            reference: `Organization/${payerId}`
          }];
        }
        
        // Ajouter la ressource Coverage au Bundle
        fhirBundle.entry.push({
          fullUrl: `${baseUrl}/Coverage/${coverageId}`,
          resource: coverageResource,
          request: {
            method: 'POST',
            url: 'Coverage'
          }
        });
      });
    }
    
    // Créer des ressources RelatedPerson à partir des segments NK1
    if (hl7Data.NK1 && hl7Data.NK1.length > 0) {
      hl7Data.NK1.forEach((nextOfKin) => {
        if (nextOfKin.name && resourceRefs.patient) {
          const relatedPersonId = uuidv4();
          
          // Extraire le nom
          const nameParts = nextOfKin.name.split('^');
          
          // Extraire la relation
          const relationshipRaw = nextOfKin.relationship || '';
          const relationshipParts = relationshipRaw.split('^');
          const relationshipCode = relationshipParts[0] || '';
          const relationshipText = relationshipParts.length > 1 ? relationshipParts[1] : relationshipCode;
          
          const relatedPersonResource = {
            resourceType: 'RelatedPerson',
            id: relatedPersonId,
            active: true,
            patient: {
              reference: resourceRefs.patientFullUrl || resourceRefs.patient
            },
            relationship: [{
              coding: [{
                system: 'http://terminology.hl7.org/CodeSystem/v3-RoleCode',
                code: mapRelationshipCode(relationshipCode),
                display: relationshipText || 'Contact'
              }]
            }],
            name: [{
              family: nameParts[0] || '',
              given: []
            }]
          };
          
          // Ajouter le prénom
          if (nameParts[1]) {
            relatedPersonResource.name[0].given.push(nameParts[1]);
          }
          
          // Ajouter le deuxième prénom
          if (nameParts[2]) {
            relatedPersonResource.name[0].given.push(nameParts[2]);
          }
          
          // Ajouter le suffixe
          if (nameParts[3]) {
            relatedPersonResource.name[0].suffix = [nameParts[3]];
          }
          
          // Ajouter le préfixe
          if (nameParts[4]) {
            relatedPersonResource.name[0].prefix = [nameParts[4]];
          }
          
          // Ajouter le téléphone si disponible
          relatedPersonResource.telecom = [];
          
          if (nextOfKin.phoneNumber) {
            // Traiter les répétitions dans le numéro de téléphone
            const phones = processRepeatedField(nextOfKin.phoneNumber);
            
            phones.forEach(phone => {
              const phoneParts = phone.split('^');
              const number = phoneParts[0] || '';
              const useCode = phoneParts[1] || '';
              
              let use = 'home';
              if (useCode) {
                switch (useCode.toUpperCase()) {
                  case 'WPN': use = 'work'; break;
                  case 'PRN': use = 'home'; break;
                  case 'NET': use = 'mobile'; break;
                  case 'ORN': use = 'old'; break;
                  default: use = 'home';
                }
              }
              
              relatedPersonResource.telecom.push({
                system: 'phone',
                value: number,
                use: use
              });
            });
          }
          
          // Ajouter le téléphone professionnel si disponible
          if (nextOfKin.businessPhoneNumber) {
            // Traiter les répétitions dans le numéro de téléphone professionnel
            const phones = processRepeatedField(nextOfKin.businessPhoneNumber);
            
            phones.forEach(phone => {
              const phoneParts = phone.split('^');
              relatedPersonResource.telecom.push({
                system: 'phone',
                value: phoneParts[0] || '',
                use: 'work'
              });
            });
          }
          
          // Ajouter l'adresse si disponible
          if (nextOfKin.address) {
            // Traiter les répétitions dans l'adresse
            const addresses = processRepeatedField(nextOfKin.address);
            relatedPersonResource.address = [];
            
            addresses.forEach(addr => {
              const addressParts = addr.split('^');
              const fhirAddress = {
                line: addressParts[0] ? [addressParts[0]] : [],
                city: addressParts[2] || '',
                state: addressParts[3] || '',
                postalCode: addressParts[4] || '',
                country: addressParts[5] || ''
              };
              
              // Ajouter la deuxième ligne si disponible
              if (addressParts[1]) {
                fhirAddress.line.push(addressParts[1]);
              }
              
              // Ajouter le type d'adresse si disponible
              if (addressParts[6]) {
                let use;
                switch (addressParts[6].toUpperCase()) {
                  case 'H': use = 'home'; break;
                  case 'W': use = 'work'; break;
                  case 'B': use = 'work'; break; // Business
                  case 'M': use = 'home'; break; // Mailing
                  case 'C': use = 'temp'; break; // Current/Temporary
                  case 'P': use = 'old'; break;  // Permanent
                  default: use = 'home';
                }
                fhirAddress.use = use;
              }
              
              relatedPersonResource.address.push(fhirAddress);
            });
          }
          
          // Ajouter la date de naissance si disponible
          if (nextOfKin.dateTimeOfBirth) {
            relatedPersonResource.birthDate = formatHl7Date(nextOfKin.dateTimeOfBirth);
          }
          
          // Ajouter le genre si disponible
          if (nextOfKin.administrativeSex) {
            relatedPersonResource.gender = mapGender(nextOfKin.administrativeSex);
          }
          
          // Ajouter la ressource RelatedPerson au Bundle avec fullUrl obligatoire en R4
          fhirBundle.entry.push({
            fullUrl: `${baseUrl}/RelatedPerson/${relatedPersonId}`,
            resource: relatedPersonResource,
            request: {
              method: 'POST',
              url: 'RelatedPerson'
            }
          });
        }
      });
    }
    
    // Créer des ressources Practitioner à partir des segments ROL
    if (hl7Data.ROL && hl7Data.ROL.length > 0) {
      hl7Data.ROL.forEach((role) => {
        if (role.rolePerson) {
          const practitionerId = uuidv4();
          
          // Extraire les informations du praticien
          const personParts = role.rolePerson.split('^');
          
          // Extraire les systèmes d'identification
          let systemName = 'http://example.org/fhir/sid/provider-id';
          let systemType = 'unknown';
          
          if (personParts.length > 8) {
            const idTypeInfo = personParts[8] || '';
            const idTypeParts = idTypeInfo.split('&');
            if (idTypeParts.length > 1) {
              systemType = idTypeParts[0] || 'unknown';
              systemName = idTypeParts[1] || systemName;
            }
          }
          
          const practitionerResource = {
            resourceType: 'Practitioner',
            id: practitionerId,
            identifier: [{
              system: `urn:oid:${systemName}`,
              value: personParts[0] || 'unknown',
              type: {
                coding: [{
                  system: 'http://terminology.hl7.org/CodeSystem/v2-0203',
                  code: systemType,
                  display: systemType === 'ADELI' ? 'ADELI' : 
                           systemType === 'RPPS' ? 'RPPS' : 
                           'Provider Number'
                }]
              }
            }],
            name: [{
              family: personParts[1] || '',
              given: [],
              prefix: personParts[4] ? [personParts[4]] : []
            }],
            active: true
          };
          
          // Ajouter le prénom si disponible
          if (personParts[2]) {
            practitionerResource.name[0].given.push(personParts[2]);
          }
          
          // Ajouter le deuxième prénom si disponible
          if (personParts[3]) {
            practitionerResource.name[0].given.push(personParts[3]);
          }
          
          // Ajouter les qualifications
          if (role.role) {
            const roleParts = role.role.split('^');
            practitionerResource.qualification = [{
              code: {
                coding: [{
                  system: 'http://terminology.hl7.org/CodeSystem/v2-0443',
                  code: roleParts[0] || 'UNKNOWN',
                  display: roleParts[1] || 'Unknown Qualification'
                }]
              }
            }];
          }
          
          // Ajouter l'adresse si disponible
          if (role.officeHomeAddress) {
            const addressParts = role.officeHomeAddress.split('^');
            practitionerResource.address = [{
              line: addressParts[0] ? [addressParts[0]] : [],
              city: addressParts[2] || '',
              state: addressParts[3] || '',
              postalCode: addressParts[4] || '',
              country: addressParts[5] || ''
            }];
          }
          
          // Ajouter le téléphone si disponible
          if (role.officeHomePhoneNumber) {
            practitionerResource.telecom = [{
              system: 'phone',
              value: role.officeHomePhoneNumber,
              use: 'work'
            }];
          }
          
          // Ajouter la ressource Practitioner au Bundle avec fullUrl obligatoire en R4
          fhirBundle.entry.push({
            fullUrl: `${baseUrl}/Practitioner/${practitionerId}`,
            resource: practitionerResource,
            request: {
              method: 'POST',
              url: 'Practitioner'
            }
          });
          
          // Créer une ressource PractitionerRole conforme aux standards français
          const roleCode = role.role ? role.role.split('^')[0] : '';
          const roleDisplay = role.role ? role.role.split('^')[1] || '' : '';
          const frenchRoleCode = mapFrenchRoleCode(roleCode);

          const practitionerRoleResource = {
            resourceType: 'PractitionerRole',
            id: uuidv4(),
            practitioner: {
              reference: `Practitioner/${practitionerId}`
            },
            // Utilisation du système français TRE_A01-CadreExercice pour les rôles professionnels
            code: [{
              coding: [
                {
                  system: 'https://mos.esante.gouv.fr/NOS/TRE_A01-CadreExercice/FHIR/TRE-A01-CadreExercice',
                  code: frenchRoleCode,
                  display: roleDisplay || 'Médecin'
                },
                // Garder également le codage original pour compatibilité
                {
                  system: 'http://terminology.hl7.org/CodeSystem/v2-0443',
                  code: roleCode || 'UNKNOWN',
                  display: roleDisplay || 'Unknown Role'
                }
              ]
            }],
            // Extension pour la spécialité médicale française (si disponible)
            extension: [{
              url: 'https://interop.esante.gouv.fr/ig/fhir/annuaire/StructureDefinition/practitionerRole-specialty',
              valueCodeableConcept: {
                coding: [{
                  system: 'https://mos.esante.gouv.fr/NOS/TRE_R38-SpecialiteOrdinale/FHIR/TRE-R38-SpecialiteOrdinale',
                  code: '01', // Code par défaut pour médecine générale
                  display: 'Médecine générale'
                }]
              }
            }],
            active: true,
            period: {}
          };
          
          // Ajouter la date de début si disponible
          if (role.roleBeginDateTime) {
            practitionerRoleResource.period.start = formatHl7Date(role.roleBeginDateTime);
          }
          
          // Ajouter la date de fin si disponible
          if (role.roleEndDateTime) {
            practitionerRoleResource.period.end = formatHl7Date(role.roleEndDateTime);
          }
          
          // Ajouter le patient si disponible
          if (resourceRefs.patient) {
            practitionerRoleResource.subject = {
              reference: resourceRefs.patientFullUrl || resourceRefs.patient
            };
          }
          
          // Ajouter la ressource PractitionerRole au Bundle avec fullUrl obligatoire en R4
          fhirBundle.entry.push({
            fullUrl: `${baseUrl}/PractitionerRole/${practitionerRoleResource.id}`,
            resource: practitionerRoleResource,
            request: {
              method: 'POST',
              url: 'PractitionerRole'
            }
          });
        }
      });
    }
    
    // Créer une ressource Procedure pour les ORC/OBR (ordres)
    if (hl7Data.OBR && hl7Data.OBR.length > 0) {
      hl7Data.OBR.forEach(obr => {
        const procedureResource = {
          resourceType: 'Procedure',
          id: uuidv4(),
          status: 'completed',
          code: {
            coding: []
          }
        };
        
        // Vérifier si le code pourrait être un code CCAM
        const universalServiceId = obr.universalServiceId || '';
        if (universalServiceId.match(/^[A-Z]{4}[0-9]{3}$/)) {
          // C'est un format de code CCAM (4 lettres + 3 chiffres)
          procedureResource.code.coding.push({
            system: 'https://smt.esante.gouv.fr/terminologie-ccam',
            code: universalServiceId,
            display: obr.universalServiceText || 'Acte médical (CCAM)'
          });
        } else {
          // Code standard
          procedureResource.code.coding.push({
            system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
            code: universalServiceId || 'unknown',
            display: obr.universalServiceText || universalServiceId || 'Unknown Procedure'
          });
        }
        
        // Référencer le patient si disponible
        if (resourceRefs.patient) {
          procedureResource.subject = {
            reference: resourceRefs.patientFullUrl || resourceRefs.patient
          };
        }
        
        // Référencer l'encounter si disponible
        if (resourceRefs.encounter) {
          procedureResource.encounter = {
            reference: resourceRefs.encounterFullUrl || resourceRefs.encounter
          };
        }
        
        // Ajouter la date de la procédure si disponible
        if (obr.observationDateTime) {
          procedureResource.performedDateTime = formatHl7Date(obr.observationDateTime);
        }
        
        // Ajouter la ressource Procedure au Bundle avec fullUrl
        fhirBundle.entry.push({
          fullUrl: `${baseUrl}/Procedure/${procedureResource.id}`,
          resource: procedureResource,
          request: {
            method: 'POST',
            url: 'Procedure'
          }
        });
      });
    }
    
    // Vérifier que le bundle contient des entrées
    console.log(`[CONVERTER] Bundle contient ${fhirBundle.entry.length} entrées`);
    
    // Si aucune entrée n'a été ajoutée, créer un bundle vide mais avec un commentaire
    if (fhirBundle.entry.length === 0) {
      console.log('[CONVERTER] Aucune entrée générée, création d\'un bundle minimal');
      
      // Ajouter une entrée MessageHeader pour documenter la conversion
      const messageHeaderId = uuidv4();
      const messageResource = {
        resourceType: 'MessageHeader',
        id: messageHeaderId,
        eventCoding: {
          system: 'http://terminology.hl7.org/CodeSystem/v2-0003',
          code: hl7Data.MSH.messageType || 'UNK',
          display: 'HL7v2 Message Converted to FHIR'
        },
        source: {
          name: 'FHIRHub Converter',
          software: 'FHIRHub',
          version: '1.0.0',
          endpoint: 'https://fhirhub.example.org'
        },
        sender: {
          display: hl7Data.MSH.sendingFacility || 'Unknown'
        },
        timestamp: new Date().toISOString()
      };
      
      fhirBundle.entry.push({
        fullUrl: `https://fhir.org/FHIRHub/MessageHeader/${messageHeaderId}`,
        resource: messageResource,
        request: {
          method: 'POST',
          url: 'MessageHeader'
        }
      });
    }
    
    // AMÉLIORATION: Traitement des segments Z personnalisés
    // ZBE: Segment d'événement spécifique
    if (hl7Data.ZBE && hl7Data.ZBE.length > 0) {
      console.log('[CONVERTER] Traitement des segments ZBE personnalisés');
      
      hl7Data.ZBE.forEach(zbeSegment => {
        // Créer une ressource Provenance pour capturer les informations du segment ZBE
        const provenanceId = uuidv4();
        const provenanceResource = {
          resourceType: 'Provenance',
          id: provenanceId,
          recorded: formatHl7Date(zbeSegment.movementDateTime) || new Date().toISOString(),
          activity: {
            coding: [{
              system: 'http://terminology.hl7.org/CodeSystem/v3-DataOperation',
              code: zbeSegment.actionType || 'CREATE',
              display: mapActionType(zbeSegment.actionType) || 'Create'
            }]
          },
          agent: [{
            type: {
              coding: [{
                system: 'http://terminology.hl7.org/CodeSystem/provenance-participant-type',
                code: 'author',
                display: 'Author'
              }]
            },
            who: {
              reference: resourceRefs.patientFullUrl || 'Patient/unknown'
            }
          }]
        };
        
        // Ajouter des informations supplémentaires dans les extensions
        if (zbeSegment.indicator || zbeSegment.previousLocation || zbeSegment.currentLocation || zbeSegment.customData) {
          provenanceResource.extension = [];
          
          if (zbeSegment.indicator) {
            provenanceResource.extension.push({
              url: 'https://interop.esante.gouv.fr/ig/fhir/extensions/StructureDefinition/event-indicator',
              valueString: zbeSegment.indicator
            });
          }
          
          if (zbeSegment.previousLocation) {
            provenanceResource.extension.push({
              url: 'https://interop.esante.gouv.fr/ig/fhir/extensions/StructureDefinition/previous-location',
              valueString: zbeSegment.previousLocation
            });
          }
          
          if (zbeSegment.currentLocation) {
            provenanceResource.extension.push({
              url: 'https://interop.esante.gouv.fr/ig/fhir/extensions/StructureDefinition/current-location',
              valueString: zbeSegment.currentLocation
            });
          }
          
          if (zbeSegment.customData) {
            provenanceResource.extension.push({
              url: 'https://interop.esante.gouv.fr/ig/fhir/extensions/StructureDefinition/custom-data',
              valueString: zbeSegment.customData
            });
          }
        }
        
        // Ajouter la ressource Provenance au Bundle
        fhirBundle.entry.push({
          fullUrl: `${baseUrl}/Provenance/${provenanceId}`,
          resource: provenanceResource,
          request: {
            method: 'POST',
            url: 'Provenance'
          }
        });
      });
    }
    
    // ZFD: Segment de données françaises spécifiques
    if (hl7Data.ZFD && hl7Data.ZFD.length > 0) {
      console.log('[CONVERTER] Traitement des segments ZFD personnalisés');
      
      hl7Data.ZFD.forEach(zfdSegment => {
        // Créer une extension sur la ressource Patient avec les données de ZFD
        if (resourceRefs.patientFullUrl && fhirBundle.entry.length > 0) {
          // Trouver la ressource Patient dans le bundle
          const patientEntry = fhirBundle.entry.find(entry => 
            entry.resource && entry.resource.resourceType === 'Patient' && 
            entry.fullUrl === resourceRefs.patientFullUrl
          );
          
          if (patientEntry) {
            patientEntry.resource.extension = patientEntry.resource.extension || [];
            
            // Ajouter les données ZFD comme extensions sur le Patient
            if (zfdSegment.insuranceType) {
              patientEntry.resource.extension.push({
                url: 'https://interop.esante.gouv.fr/ig/fhir/extensions/StructureDefinition/insurance-type',
                valueString: zfdSegment.insuranceType
              });
            }
            
            if (zfdSegment.verificationDate) {
              patientEntry.resource.extension.push({
                url: 'https://interop.esante.gouv.fr/ig/fhir/extensions/StructureDefinition/verification-date',
                valueDateTime: formatHl7Date(zfdSegment.verificationDate)
              });
            }
            
            if (zfdSegment.verificationStatus) {
              patientEntry.resource.extension.push({
                url: 'https://interop.esante.gouv.fr/ig/fhir/extensions/StructureDefinition/verification-status',
                valueCode: zfdSegment.verificationStatus
              });
            }
          }
        }
      });
    }
    
    // Adapter le Bundle aux terminologies françaises
    console.log('[CONVERTER] Adaptation aux terminologies françaises');
    const adaptedBundle = frenchAdapter.adaptFhirBundle(fhirBundle);
    
    // Nettoyer le Bundle des champs vides et non significatifs
    console.log('[CONVERTER] Nettoyage des ressources FHIR');
    const cleanedBundle = fhirCleaner.cleanBundle(adaptedBundle);
    
    // Vérifier le bundle final
    if (cleanedBundle && cleanedBundle.entry) {
      console.log('[CONVERTER] Bundle final contient', cleanedBundle.entry.length, 'entrées');
    } else {
      console.log('[CONVERTER] Bundle final créé mais sans entrées');
      cleanedBundle = {
        resourceType: 'Bundle',
        type: 'transaction',
        id: bundleId,
        timestamp: new Date().toISOString(),
        entry: []
      };
    }
    
    console.log('[CONVERTER] Fin de la conversion HL7 vers FHIR');
    
    return cleanedBundle;
  } catch (error) {
    console.error('Erreur lors de la conversion HL7 vers FHIR:', error);
    throw new Error(`Erreur de conversion: ${error.message}`);
  }
}

/**
 * Enregistrer les données FHIR dans un fichier JSON
 * @param {Object} fhirData - Données FHIR
 * @param {string} [filename] - Nom de fichier (optionnel)
 * @returns {string} Chemin du fichier sauvegardé
 */
function saveFhirToFile(fhirData, filename = null) {
  try {
    const outputDir = path.join(process.cwd(), 'data', 'out');
    
    // Créer le répertoire s'il n'existe pas
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    // Générer un nom de fichier s'il n'est pas fourni
    if (!filename) {
      filename = `fhir_${new Date().getTime()}.json`;
    } else if (!filename.endsWith('.json')) {
      filename = `${filename}.json`;
    }
    
    const outputPath = path.join(outputDir, filename);
    
    // Écrire les données JSON dans le fichier
    fs.writeFileSync(outputPath, JSON.stringify(fhirData, null, 2));
    
    return outputPath;
  } catch (error) {
    console.error('Erreur lors de l\'enregistrement des données FHIR:', error);
    throw new Error(`Erreur d'enregistrement: ${error.message}`);
  }
}

/**
 * Enregistrer un journal de conversion
 * @param {Object} logData - Données de journal
 * @returns {Object} Entrée de journal enregistrée
 */
function logConversion(logData) {
  const logEntry = {
    id: uuidv4(),
    timestamp: new Date().toISOString(),
    ...logData
  };
  
  conversionLogs.push(logEntry);
  
  // Limiter la taille de la liste des logs
  if (conversionLogs.length > 1000) {
    conversionLogs.shift();
  }
  
  return logEntry;
}

/**
 * Obtenir les journaux de conversion
 * @param {number} [limit=100] - Limite de résultats
 * @param {number} [offset=0] - Décalage pour la pagination
 * @returns {Array} Liste des journaux de conversion
 */
function getConversionLogs(limit = 100, offset = 0) {
  return conversionLogs
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    .slice(offset, offset + limit);
}

/**
 * Obtenir un journal de conversion par ID
 * @param {string} id - ID du journal
 * @returns {Object|null} Journal de conversion ou null si non trouvé
 */
function getConversionLogById(id) {
  return conversionLogs.find(log => log.id === id) || null;
}

/**
 * Obtenir des statistiques sur les conversions
 * @returns {Object} Statistiques
 */
function getConversionStats() {
  return {
    totalConversions: conversionLogs.length,
    lastConversion: conversionLogs.length > 0 ? conversionLogs[conversionLogs.length - 1].timestamp : null,
    successCount: conversionLogs.filter(log => log.success).length,
    errorCount: conversionLogs.filter(log => !log.success).length
  };
}

/**
 * Convertir un fichier HL7 en FHIR
 * @param {string} filePath - Chemin du fichier HL7
 * @returns {Object} Résultat de la conversion
 */
function convertHl7File(filePath) {
  try {
    // Vérifier que le fichier existe
    if (!fs.existsSync(filePath)) {
      throw new Error(`Le fichier n'existe pas: ${filePath}`);
    }
    
    const hl7Content = fs.readFileSync(filePath, 'utf8');
    const filename = path.basename(filePath);
    
    // Convertir le message HL7 en FHIR
    // Remarque: convertHl7ToFhir inclut déjà l'adaptation et le nettoyage
    const fhirData = convertHl7ToFhir(hl7Content);
    
    // Sauvegarder les données FHIR dans un fichier
    const outputPath = saveFhirToFile(fhirData, filename.replace(/\.[^.]+$/, '.json'));
    
    // Récupérer un ID patient de manière sécurisée
    let patientId = 'unknown';
    if (fhirData && fhirData.entry && fhirData.entry.length > 0) {
      // Chercher une ressource Patient
      const patientEntry = fhirData.entry.find(entry => 
        entry && entry.resource && entry.resource.resourceType === 'Patient');
        
      if (patientEntry && patientEntry.resource && patientEntry.resource.identifier && 
          patientEntry.resource.identifier.length > 0) {
        patientId = patientEntry.resource.identifier[0].value;
      }
    }
    
    // Enregistrer le journal de conversion
    const logEntry = logConversion({
      originalFilename: filename,
      outputFilename: path.basename(outputPath),
      success: true,
      patientId: patientId
    });
    
    return {
      success: true,
      message: 'Conversion réussie',
      conversionId: logEntry.id,
      fhirData: fhirData,
      outputPath: outputPath
    };
  } catch (error) {
    console.error('Erreur lors de la conversion du fichier HL7:', error);
    
    // Enregistrer le journal d'erreur
    const logEntry = logConversion({
      originalFilename: path.basename(filePath),
      success: false,
      error: error.message
    });
    
    return {
      success: false,
      message: `Erreur lors de la conversion: ${error.message}`,
      conversionId: logEntry.id
    };
  }
}

/**
 * Convertir un contenu HL7 en chaîne de caractères
 * @param {string} hl7Content - Contenu HL7
 * @param {string} [filename] - Nom de fichier (optionnel)
 * @param {Object} [options={}] - Options supplémentaires pour la conversion
 * @param {boolean} [options.validate=true] - Valider les terminologies 
 * @param {boolean} [options.cleanResources=true] - Nettoyer les ressources FHIR
 * @param {boolean} [options.adaptFrenchTerms=true] - Adapter aux terminologies françaises
 * @returns {Object} Résultat de la conversion
 */
function convertHl7Content(hl7Content, filename = null, options = {}) {
  try {
    // Valeurs par défaut des options
    const defaultOptions = {
      validate: true,
      cleanResources: true,
      adaptFrenchTerms: true
    };
    
    // Fusion des options par défaut avec celles fournies
    const conversionOptions = { ...defaultOptions, ...options };
    
    // Afficher les options utilisées pour le débogage
    console.log('Options de conversion utilisées:', conversionOptions);
    
    // Générer un nom de fichier s'il n'est pas fourni
    const generatedFilename = filename || `hl7_${new Date().getTime()}.hl7`;
    
    // Convertir le message HL7 en FHIR
    // Remarque: convertHl7ToFhir inclut déjà l'adaptation et le nettoyage,
    // mais nous pouvons ajouter des options pour contrôler son comportement
    const fhirData = convertHl7ToFhir(hl7Content);
    
    // Sauvegarder les données FHIR dans un fichier
    const outputPath = saveFhirToFile(fhirData, generatedFilename.replace(/\.[^.]+$/, '.json'));
    
    // Récupérer un ID patient de manière sécurisée
    let patientId = 'unknown';
    if (fhirData && fhirData.entry && fhirData.entry.length > 0) {
      // Chercher une ressource Patient
      const patientEntry = fhirData.entry.find(entry => 
        entry && entry.resource && entry.resource.resourceType === 'Patient');
        
      if (patientEntry && patientEntry.resource && patientEntry.resource.identifier && 
          patientEntry.resource.identifier.length > 0) {
        patientId = patientEntry.resource.identifier[0].value;
      }
    }
    
    // Enregistrer le journal de conversion
    const logEntry = logConversion({
      originalFilename: generatedFilename,
      outputFilename: path.basename(outputPath),
      success: true,
      patientId: patientId
    });
    
    return {
      success: true,
      message: 'Conversion réussie',
      conversionId: logEntry.id,
      fhirData: fhirData,
      outputPath: outputPath
    };
  } catch (error) {
    console.error('Erreur lors de la conversion du contenu HL7:', error);
    
    // Enregistrer le journal d'erreur
    const logEntry = logConversion({
      originalFilename: filename || 'manual_input',
      success: false,
      error: error.message
    });
    
    return {
      success: false,
      message: `Erreur lors de la conversion: ${error.message}`,
      conversionId: logEntry.id
    };
  }
}

module.exports = {
  parseHl7Message,
  convertHl7ToFhir,
  convertHl7File,
  convertHl7Content,
  saveFhirToFile,
  logConversion,
  getConversionLogs,
  getConversionLogById,
  getConversionStats
};