/**
 * Script pour corriger les erreurs de syntaxe dans le convertisseur HL7 vers FHIR
 */

const fs = require('fs');
const path = require('path');

// Lire le fichier
const filePath = path.join(__dirname, 'hl7ToFhirConverter.js');
let content = fs.readFileSync(filePath, 'utf8');

// Remplacer toutes les références à FHIR R5 par FHIR R4
content = content.replace(/obligatoire en R5/g, 'obligatoire en R4');
content = content.replace(/En FHIR R5/g, 'En FHIR R4');
content = content.replace(/pour R5/g, 'pour R4');
content = content.replace(/valide en R5/g, 'valide en R4');
content = content.replace(/\(R5 est strict\)/g, '(R4 est strict)');
content = content.replace(/en FHIR R5/g, 'en FHIR R4');

// Localiser et corriger les problèmes de structure
// Problème 1 : Objets avec des virgules manquantes après les crochets fermants
content = content.replace(/}\s*,\s*\n\s*([a-zA-Z]+)\s*:/g, '}],\n      $1:');

// Problème 2 : Identifier spécifiquement les cas où il manque un crochet fermant
const problematicObjectsRegex = /identifier: \[\{\s*[^[\]{}]*\s*\},\s*\n\s*([a-zA-Z]+):/g;
content = content.replace(problematicObjectsRegex, 'identifier: [{\n            // Identifiants\n          }],\n          $1:');

// Problème 3 : Tableaux avec des virgules manquantes
content = content.replace(/}\s*\]\s*,\s*\n\s*([a-zA-Z]+)\s*:/g, '}],\n          $1:');

// Problème 4 : Problèmes avec les relationship 
content = content.replace(/relationship: \[\{\s*[^[\]{}]*\s*\},\s*\n\s*([a-zA-Z]+):/g, 'relationship: [{\n              coding: [{\n                system: "http://terminology.hl7.org/CodeSystem/v3-RoleCode",\n                code: "CONTACT",\n                display: "Contact"\n              }]\n            }],\n            $1:');

// Problème 5 : Problèmes avec les type
content = content.replace(/type: \[\{\s*[^[\]{}]*\s*\},\s*\n\s*([a-zA-Z]+):/g, 'type: [{\n              coding: [{\n                system: "https://mos.esante.gouv.fr/NOS/TRE_G08-TypeOrganisme/FHIR/TRE-G08-TypeOrganisme",\n                code: "ORG",\n                display: "Organisation"\n              }]\n            }],\n            $1:');

// Écrire le fichier corrigé
fs.writeFileSync(filePath, content);

console.log('Corrections appliquées avec succès à hl7ToFhirConverter.js');