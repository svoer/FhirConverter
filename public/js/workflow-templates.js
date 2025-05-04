/**
 * Templates prédéfinis pour l'éditeur de workflow FHIRHub
 * 
 * Ce fichier contient une collection de templates de workflow prêts à l'emploi
 * qui peuvent être importés dans l'éditeur pour faciliter la création rapide
 * de scénarios d'interopérabilité santé courants.
 */

// Collection des templates prédéfinis
const WORKFLOW_TEMPLATES = [
  {
    id: 'convert-hl7-fhir',
    name: 'Conversion HL7 v2 vers FHIR',
    description: 'Convertit un message HL7 v2.5 en ressource FHIR Patient et exporte le résultat.',
    category: 'conversion',
    difficulty: 'Débutant',
    data: {
      nodes: [
        {
          id: 'node-input',
          type: 'hl7-input',
          label: 'Entrée HL7',
          position: { x: 100, y: 200 },
          width: 180,
          height: 100,
          inputs: [],
          outputs: [{ name: 'message', label: 'Message' }],
          data: { source: 'Manuel', format: 'HL7 v2.5' }
        },
        {
          id: 'node-convert',
          type: 'hl7-to-fhir',
          label: 'HL7 vers FHIR',
          position: { x: 400, y: 200 },
          width: 180,
          height: 100,
          inputs: [{ name: 'hl7', label: 'HL7' }],
          outputs: [{ name: 'fhir', label: 'FHIR' }],
          data: { 
            hl7Version: '2.5', 
            fhirVersion: 'R4', 
            profile: true 
          }
        },
        {
          id: 'node-output',
          type: 'fhir-output',
          label: 'Sortie FHIR',
          position: { x: 700, y: 200 },
          width: 180,
          height: 100,
          inputs: [{ name: 'fhir', label: 'FHIR' }],
          outputs: [],
          data: { 
            destination: 'return',
            resourceType: 'Patient'
          }
        }
      ],
      edges: [
        {
          id: 'edge-1',
          source: 'node-input',
          target: 'node-convert',
          sourceOutput: 0,
          targetInput: 0
        },
        {
          id: 'edge-2',
          source: 'node-convert',
          target: 'node-output',
          sourceOutput: 0,
          targetInput: 0
        }
      ]
    }
  },
  {
    id: 'nih-validation',
    name: 'Validation identité NIH',
    description: 'Valide l\'identité du patient avec le Système National d\'Identification des patients français.',
    category: 'integration',
    difficulty: 'Intermédiaire',
    data: {
      nodes: [
        {
          id: 'node-input',
          type: 'json-input',
          label: 'Entrée Patient',
          position: { x: 100, y: 200 },
          width: 180,
          height: 100,
          inputs: [],
          outputs: [{ name: 'json', label: 'JSON' }],
          data: { source: 'Manuel' }
        },
        {
          id: 'node-validate',
          type: 'french-nih',
          label: 'NIH Français',
          position: { x: 400, y: 200 },
          width: 180,
          height: 100,
          inputs: [{ name: 'patient', label: 'Patient' }],
          outputs: [{ name: 'result', label: 'Résultat' }],
          data: { 
            operation: 'Validate',
            method: 'INSi'
          }
        },
        {
          id: 'node-condition',
          type: 'condition',
          label: 'Valide?',
          position: { x: 700, y: 200 },
          width: 180,
          height: 100,
          inputs: [{ name: 'input', label: 'Entrée' }],
          outputs: [
            { name: 'true', label: 'Vrai' },
            { name: 'false', label: 'Faux' }
          ],
          data: { 
            expressionType: 'JSONPath',
            condition: '$.validated === true'
          }
        }
      ],
      edges: [
        {
          id: 'edge-1',
          source: 'node-input',
          target: 'node-validate',
          sourceOutput: 0,
          targetInput: 0
        },
        {
          id: 'edge-2',
          source: 'node-validate',
          target: 'node-condition',
          sourceOutput: 0,
          targetInput: 0
        }
      ]
    }
  },
  {
    id: 'medical-nlp',
    name: 'Analyse IA terminologie médicale',
    description: 'Analyse une terminologie médicale à l\'aide de l\'IA pour extraction et classification.',
    category: 'ai',
    difficulty: 'Avancé',
    data: {
      nodes: [
        {
          id: 'node-input',
          type: 'file-input',
          label: 'Entrée fichier',
          position: { x: 100, y: 200 },
          width: 180,
          height: 100,
          inputs: [],
          outputs: [{ name: 'content', label: 'Contenu' }],
          data: { 
            format: 'Texte',
            encoding: 'UTF-8'
          }
        },
        {
          id: 'node-nlp',
          type: 'nlp-processor',
          label: 'Processeur NLP',
          position: { x: 400, y: 200 },
          width: 180,
          height: 100,
          inputs: [{ name: 'text', label: 'Texte' }],
          outputs: [{ name: 'analysis', label: 'Analyse' }],
          data: { 
            operation: 'Entities',
            language: 'fr',
            model: 'Mistral'
          }
        },
        {
          id: 'node-mapper',
          type: 'terminologie-mapper',
          label: 'Mappeur terminologie',
          position: { x: 700, y: 200 },
          width: 180,
          height: 100,
          inputs: [{ name: 'terms', label: 'Termes' }],
          outputs: [{ name: 'mapped', label: 'Mappés' }],
          data: { 
            method: 'AI',
            source: 'LOINC',
            target: 'SNOMED-CT'
          }
        },
        {
          id: 'node-output',
          type: 'file-output',
          label: 'Sortie fichier',
          position: { x: 1000, y: 200 },
          width: 180,
          height: 100,
          inputs: [{ name: 'content', label: 'Contenu' }],
          outputs: [],
          data: { 
            format: 'JSON',
            encoding: 'UTF-8'
          }
        }
      ],
      edges: [
        {
          id: 'edge-1',
          source: 'node-input',
          target: 'node-nlp',
          sourceOutput: 0,
          targetInput: 0
        },
        {
          id: 'edge-2',
          source: 'node-nlp',
          target: 'node-mapper',
          sourceOutput: 0,
          targetInput: 0
        },
        {
          id: 'edge-3',
          source: 'node-mapper',
          target: 'node-output',
          sourceOutput: 0,
          targetInput: 0
        }
      ]
    }
  },
  {
    id: 'interoperability-hub',
    name: 'Hub d\'interopérabilité multi-format',
    description: 'Système d\'échange multi-format qui prend en charge des entrées HL7, FHIR, CDA et produit des sorties uniformisées.',
    category: 'interoperability',
    difficulty: 'Expert',
    data: {
      nodes: [
        {
          id: 'node-hl7-input',
          type: 'hl7-input',
          label: 'Entrée HL7',
          position: { x: 100, y: 100 },
          width: 180,
          height: 100,
          inputs: [],
          outputs: [{ name: 'message', label: 'Message' }],
          data: { source: 'MLLP', format: 'HL7 v2.5' }
        },
        {
          id: 'node-fhir-input',
          type: 'fhir-r4',
          label: 'FHIR R4',
          position: { x: 100, y: 300 },
          width: 180,
          height: 100,
          inputs: [],
          outputs: [{ name: 'output', label: 'Sortie' }],
          data: { 
            operation: 'Read',
            resourceType: 'Patient'
          }
        },
        {
          id: 'node-cda-input',
          type: 'cda',
          label: 'CDA',
          position: { x: 100, y: 500 },
          width: 180,
          height: 100,
          inputs: [],
          outputs: [{ name: 'output', label: 'Sortie' }],
          data: { operation: 'Parse' }
        },
        {
          id: 'node-hl7-convert',
          type: 'hl7-to-fhir',
          label: 'HL7 vers FHIR',
          position: { x: 400, y: 100 },
          width: 180,
          height: 100,
          inputs: [{ name: 'hl7', label: 'HL7' }],
          outputs: [{ name: 'fhir', label: 'FHIR' }],
          data: { 
            hl7Version: '2.5', 
            fhirVersion: 'R4', 
            profile: true 
          }
        },
        {
          id: 'node-cda-convert',
          type: 'cda-to-fhir',
          label: 'CDA vers FHIR',
          position: { x: 400, y: 500 },
          width: 180,
          height: 100,
          inputs: [{ name: 'cda', label: 'CDA' }],
          outputs: [{ name: 'fhir', label: 'FHIR' }],
          data: { 
            cdaVersion: 'R2',
            fhirVersion: 'R4'
          }
        },
        {
          id: 'node-merge',
          type: 'merge',
          label: 'Fusionner',
          position: { x: 700, y: 300 },
          width: 180,
          height: 150,
          inputs: [
            { name: 'input1', label: 'Entrée 1' },
            { name: 'input2', label: 'Entrée 2' }
          ],
          outputs: [{ name: 'merged', label: 'Fusionné' }],
          data: { strategy: 'Merge Objects' }
        },
        {
          id: 'node-api-output',
          type: 'api-call',
          label: 'Appel API',
          position: { x: 1000, y: 300 },
          width: 180,
          height: 100,
          inputs: [{ name: 'input', label: 'Entrée' }],
          outputs: [{ name: 'response', label: 'Réponse' }],
          data: { 
            method: 'POST',
            headers: '{"Content-Type": "application/json"}'
          }
        }
      ],
      edges: [
        {
          id: 'edge-1',
          source: 'node-hl7-input',
          target: 'node-hl7-convert',
          sourceOutput: 0,
          targetInput: 0
        },
        {
          id: 'edge-2',
          source: 'node-cda-input',
          target: 'node-cda-convert',
          sourceOutput: 0,
          targetInput: 0
        },
        {
          id: 'edge-3',
          source: 'node-hl7-convert',
          target: 'node-merge',
          sourceOutput: 0,
          targetInput: 0
        },
        {
          id: 'edge-4',
          source: 'node-fhir-input',
          target: 'node-merge',
          sourceOutput: 0,
          targetInput: 1
        },
        {
          id: 'edge-5',
          source: 'node-merge',
          target: 'node-api-output',
          sourceOutput: 0,
          targetInput: 0
        }
      ]
    }
  },
  {
    id: 'dmp-exporter',
    name: 'Exportateur DMP',
    description: 'Workflow d\'export vers le Dossier Médical Partagé français avec validation des documents.',
    category: 'integration',
    difficulty: 'Intermédiaire',
    data: {
      nodes: [
        {
          id: 'node-fhir-input',
          type: 'fhir-r4',
          label: 'FHIR R4',
          position: { x: 100, y: 200 },
          width: 180,
          height: 100,
          inputs: [],
          outputs: [{ name: 'output', label: 'Sortie' }],
          data: { 
            operation: 'Read',
            resourceType: 'DocumentReference'
          }
        },
        {
          id: 'node-validator',
          type: 'validator',
          label: 'Validateur',
          position: { x: 400, y: 200 },
          width: 180,
          height: 100,
          inputs: [{ name: 'input', label: 'Entrée' }],
          outputs: [
            { name: 'valid', label: 'Valide' },
            { name: 'invalid', label: 'Invalide' }
          ],
          data: { schema: 'DMP-Document-Schema' }
        },
        {
          id: 'node-dmp-export',
          type: 'dmp-export',
          label: 'Export DMP',
          position: { x: 700, y: 150 },
          width: 180,
          height: 100,
          inputs: [{ name: 'document', label: 'Document' }],
          outputs: [{ name: 'result', label: 'Résultat' }],
          data: { 
            documentType: 'CR-BIO',
            patientConsent: true
          }
        },
        {
          id: 'node-error',
          type: 'error-handler',
          label: 'Gestionnaire erreurs',
          position: { x: 700, y: 350 },
          width: 200,
          height: 100,
          inputs: [{ name: 'error', label: 'Erreur' }],
          outputs: [
            { name: 'handled', label: 'Traitée' },
            { name: 'escalated', label: 'Escaladée' }
          ],
          data: { 
            retryCount: 3,
            logErrors: true
          }
        }
      ],
      edges: [
        {
          id: 'edge-1',
          source: 'node-fhir-input',
          target: 'node-validator',
          sourceOutput: 0,
          targetInput: 0
        },
        {
          id: 'edge-2',
          source: 'node-validator',
          target: 'node-dmp-export',
          sourceOutput: 0,
          targetInput: 0
        },
        {
          id: 'edge-3',
          source: 'node-validator',
          target: 'node-error',
          sourceOutput: 1,
          targetInput: 0
        }
      ]
    }
  }
];

// Fonction pour obtenir un template par son ID
function getWorkflowTemplateById(templateId) {
  return WORKFLOW_TEMPLATES.find(template => template.id === templateId);
}

// Fonction pour obtenir les templates par catégorie
function getWorkflowTemplatesByCategory(category) {
  if (category === 'all') {
    return WORKFLOW_TEMPLATES;
  }
  return WORKFLOW_TEMPLATES.filter(template => template.category === category);
}