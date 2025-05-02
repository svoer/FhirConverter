/**
 * Workflow Templates
 * Ce fichier contient les templates préconfigurés de workflows courants
 * pour faciliter la création de nouveaux workflows par les utilisateurs.
 */

const workflowTemplates = [
  {
    id: 'template-basic',
    name: 'Conversion simple HL7 vers FHIR',
    description: 'Template de base pour convertir un message HL7 en FHIR avec validation minimale.',
    thumbnail: '/img/templates/basic-conversion.png',
    nodes: [
      {
        id: 'node-1',
        type: 'inputHL7',
        label: 'Entrée HL7',
        position: { x: 1800, y: 1900 },
        data: { messageType: 'all' }
      },
      {
        id: 'node-2',
        type: 'convertHL7toFHIR',
        label: 'Convertir en FHIR',
        position: { x: 2000, y: 2000 },
        data: { conversionProfile: 'default' }
      },
      {
        id: 'node-3',
        type: 'outputFHIR',
        label: 'Sortie FHIR',
        position: { x: 2200, y: 2100 },
        data: { outputFormat: 'json' }
      }
    ],
    edges: [
      {
        id: 'edge-1-2',
        source: 'node-1',
        sourceHandle: 'output',
        target: 'node-2',
        targetHandle: 'input'
      },
      {
        id: 'edge-2-3',
        source: 'node-2',
        sourceHandle: 'output',
        target: 'node-3',
        targetHandle: 'input'
      }
    ]
  },
  {
    id: 'template-advanced',
    name: 'Conversion avancée avec validation',
    description: 'Template avec validation complète des messages HL7 et FHIR, incluant la gestion des erreurs.',
    thumbnail: '/img/templates/advanced-conversion.png',
    nodes: [
      {
        id: 'node-1',
        type: 'inputHL7',
        label: 'Entrée HL7',
        position: { x: 1800, y: 1900 },
        data: { messageType: 'all' }
      },
      {
        id: 'node-2',
        type: 'validateHL7',
        label: 'Valider HL7',
        position: { x: 1900, y: 2000 },
        data: { strictMode: true }
      },
      {
        id: 'node-3',
        type: 'convertHL7toFHIR',
        label: 'Convertir en FHIR',
        position: { x: 2050, y: 2000 },
        data: { conversionProfile: 'default' }
      },
      {
        id: 'node-4',
        type: 'validateFHIR',
        label: 'Valider FHIR',
        position: { x: 2200, y: 2000 },
        data: { profile: 'standard' }
      },
      {
        id: 'node-5',
        type: 'outputFHIR',
        label: 'Sortie FHIR',
        position: { x: 2350, y: 2000 },
        data: { outputFormat: 'json' }
      },
      {
        id: 'node-6',
        type: 'errorHandler',
        label: 'Gestion des erreurs',
        position: { x: 2050, y: 2150 },
        data: { logErrors: true, retryCount: 0 }
      }
    ],
    edges: [
      {
        id: 'edge-1-2',
        source: 'node-1',
        sourceHandle: 'output',
        target: 'node-2',
        targetHandle: 'input'
      },
      {
        id: 'edge-2-3',
        source: 'node-2',
        sourceHandle: 'output',
        target: 'node-3',
        targetHandle: 'input'
      },
      {
        id: 'edge-3-4',
        source: 'node-3',
        sourceHandle: 'output',
        target: 'node-4',
        targetHandle: 'input'
      },
      {
        id: 'edge-4-5',
        source: 'node-4',
        sourceHandle: 'output',
        target: 'node-5',
        targetHandle: 'input'
      },
      {
        id: 'edge-2-6',
        source: 'node-2',
        sourceHandle: 'error',
        target: 'node-6',
        targetHandle: 'input',
        animated: true,
        style: { stroke: '#e74c3c' }
      },
      {
        id: 'edge-3-6',
        source: 'node-3',
        sourceHandle: 'error',
        target: 'node-6',
        targetHandle: 'input',
        animated: true,
        style: { stroke: '#e74c3c' }
      },
      {
        id: 'edge-4-6',
        source: 'node-4',
        sourceHandle: 'error',
        target: 'node-6',
        targetHandle: 'input',
        animated: true,
        style: { stroke: '#e74c3c' }
      }
    ]
  },
  {
    id: 'template-french',
    name: 'Conversion adaptée aux terminologies françaises',
    description: 'Template optimisé pour les établissements français avec adaptation des codes et terminologies.',
    thumbnail: '/img/templates/french-conversion.png',
    nodes: [
      {
        id: 'node-1',
        type: 'inputHL7',
        label: 'Entrée HL7',
        position: { x: 1800, y: 1900 },
        data: { messageType: 'all' }
      },
      {
        id: 'node-2',
        type: 'validateHL7',
        label: 'Valider HL7',
        position: { x: 1950, y: 1900 },
        data: { strictMode: false }
      },
      {
        id: 'node-3',
        type: 'terminologyMapper',
        label: 'Mapper les terminologies',
        position: { x: 2000, y: 2050 },
        data: { sourceSystem: 'local', targetSystem: 'ASIP' }
      },
      {
        id: 'node-4',
        type: 'convertHL7toFHIR',
        label: 'Convertir en FHIR',
        position: { x: 2150, y: 2050 },
        data: { conversionProfile: 'french' }
      },
      {
        id: 'node-5',
        type: 'outputFHIR',
        label: 'Sortie FHIR',
        position: { x: 2300, y: 2050 },
        data: { outputFormat: 'json' }
      }
    ],
    edges: [
      {
        id: 'edge-1-2',
        source: 'node-1',
        sourceHandle: 'output',
        target: 'node-2',
        targetHandle: 'input'
      },
      {
        id: 'edge-2-3',
        source: 'node-2',
        sourceHandle: 'output',
        target: 'node-3',
        targetHandle: 'input'
      },
      {
        id: 'edge-3-4',
        source: 'node-3',
        sourceHandle: 'output',
        target: 'node-4',
        targetHandle: 'input'
      },
      {
        id: 'edge-4-5',
        source: 'node-4',
        sourceHandle: 'output',
        target: 'node-5',
        targetHandle: 'input'
      }
    ]
  },
  {
    id: 'template-batch',
    name: 'Traitement par lots',
    description: 'Template pour traiter des fichiers HL7 par lot avec historique de traitement.',
    thumbnail: '/img/templates/batch-processing.png',
    nodes: [
      {
        id: 'node-1',
        type: 'fileInput',
        label: 'Entrée fichier',
        position: { x: 1800, y: 1900 },
        data: { fileType: 'hl7', multiple: true }
      },
      {
        id: 'node-2',
        type: 'batchProcessor',
        label: 'Traitement par lot',
        position: { x: 2000, y: 1900 },
        data: { batchSize: 10, parallel: true }
      },
      {
        id: 'node-3',
        type: 'convertHL7toFHIR',
        label: 'Convertir en FHIR',
        position: { x: 2000, y: 2050 },
        data: { conversionProfile: 'default' }
      },
      {
        id: 'node-4',
        type: 'fileOutput',
        label: 'Sortie fichier',
        position: { x: 2000, y: 2200 },
        data: { outputFormat: 'json', createDirectory: true }
      },
      {
        id: 'node-5',
        type: 'batchReport',
        label: 'Rapport de traitement',
        position: { x: 2200, y: 2050 },
        data: { includeStats: true, includeErrors: true }
      }
    ],
    edges: [
      {
        id: 'edge-1-2',
        source: 'node-1',
        sourceHandle: 'output',
        target: 'node-2',
        targetHandle: 'input'
      },
      {
        id: 'edge-2-3',
        source: 'node-2',
        sourceHandle: 'output',
        target: 'node-3',
        targetHandle: 'input'
      },
      {
        id: 'edge-3-4',
        source: 'node-3',
        sourceHandle: 'output',
        target: 'node-4',
        targetHandle: 'input'
      },
      {
        id: 'edge-2-5',
        source: 'node-2',
        sourceHandle: 'stats',
        target: 'node-5',
        targetHandle: 'input'
      },
      {
        id: 'edge-3-5',
        source: 'node-3',
        sourceHandle: 'stats',
        target: 'node-5',
        targetHandle: 'input'
      }
    ]
  },
  {
    id: 'template-ai',
    name: 'HL7 vers FHIR avec assistance IA',
    description: 'Template utilisant l\'IA pour améliorer la qualité des données et compléter les informations manquantes.',
    thumbnail: '/img/templates/ai-assisted.png',
    nodes: [
      {
        id: 'node-1',
        type: 'inputHL7',
        label: 'Entrée HL7',
        position: { x: 1800, y: 1900 },
        data: { messageType: 'all' }
      },
      {
        id: 'node-2',
        type: 'validateHL7',
        label: 'Valider HL7',
        position: { x: 1800, y: 2000 },
        data: { strictMode: false }
      },
      {
        id: 'node-3',
        type: 'aiDataEnrichment',
        label: 'Enrichissement IA',
        position: { x: 2000, y: 1950 },
        data: { model: 'mistral', confidence: 0.7 }
      },
      {
        id: 'node-4',
        type: 'convertHL7toFHIR',
        label: 'Convertir en FHIR',
        position: { x: 2200, y: 1950 },
        data: { conversionProfile: 'enhanced' }
      },
      {
        id: 'node-5',
        type: 'aiQualityCheck',
        label: 'Vérification qualité IA',
        position: { x: 2200, y: 2050 },
        data: { checkCompleteness: true, checkConsistency: true }
      },
      {
        id: 'node-6',
        type: 'outputFHIR',
        label: 'Sortie FHIR',
        position: { x: 2400, y: 2000 },
        data: { outputFormat: 'json' }
      }
    ],
    edges: [
      {
        id: 'edge-1-2',
        source: 'node-1',
        sourceHandle: 'output',
        target: 'node-2',
        targetHandle: 'input'
      },
      {
        id: 'edge-2-3',
        source: 'node-2',
        sourceHandle: 'output',
        target: 'node-3',
        targetHandle: 'input'
      },
      {
        id: 'edge-3-4',
        source: 'node-3',
        sourceHandle: 'output',
        target: 'node-4',
        targetHandle: 'input'
      },
      {
        id: 'edge-4-5',
        source: 'node-4',
        sourceHandle: 'output',
        target: 'node-5',
        targetHandle: 'input'
      },
      {
        id: 'edge-5-6',
        source: 'node-5',
        sourceHandle: 'output',
        target: 'node-6',
        targetHandle: 'input'
      }
    ]
  }
];

// Fonction pour obtenir un template par ID
function getTemplateById(templateId) {
  return workflowTemplates.find(template => template.id === templateId);
}

// Fonction pour dupliquer un workflow existant
function duplicateWorkflow(workflow) {
  // Générer de nouveaux IDs pour chaque nœud et bord
  const idMap = {};
  
  // Dupliquer les nœuds avec de nouveaux IDs
  const nodes = workflow.nodes.map(node => {
    const newId = `node-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    idMap[node.id] = newId;
    
    return {
      ...node,
      id: newId,
      position: { ...node.position }
    };
  });
  
  // Dupliquer les bords avec les nouveaux IDs de nœuds
  const edges = workflow.edges.map(edge => {
    const newId = `edge-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    
    return {
      ...edge,
      id: newId,
      source: idMap[edge.source],
      target: idMap[edge.target]
    };
  });
  
  // Renvoyer le workflow dupliqué
  return {
    ...workflow,
    id: `workflow-${Date.now()}`,
    name: `${workflow.name} (copie)`,
    nodes,
    edges
  };
}