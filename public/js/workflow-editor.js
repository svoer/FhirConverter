/**
 * Éditeur de workflow visuel pour FHIRHub
 * Basé sur ReactFlow pour une expérience similaire à n8n et ComfyUI
 * @author FHIRHub Team
 */

// Configuration globale pour l'éditeur
const workflowConfig = {
  nodeTypes: {
    'hl7-input': {
      name: 'Entrée HL7',
      description: 'Récupère un message HL7 comme source de données',
      icon: 'sign-in-alt',
      color: '#E63946',
      inputs: 0,
      outputs: 1,
      properties: [
        { name: 'name', label: 'Nom', type: 'text', default: 'Entrée HL7' },
        { name: 'description', label: 'Description', type: 'text', default: 'Récupère un message HL7' }
      ]
    },
    'fhir-converter': {
      name: 'Convertisseur FHIR',
      description: 'Convertit un message HL7 en resources FHIR',
      icon: 'exchange-alt',
      color: '#457B9D',
      inputs: 1,
      outputs: 1,
      properties: [
        { name: 'name', label: 'Nom', type: 'text', default: 'Convertisseur FHIR' },
        { name: 'messageType', label: 'Type de message', type: 'select', 
          options: ['ADT', 'ORU', 'SIU', 'MDM', 'ORM'], default: 'ADT' },
        { name: 'description', label: 'Description', type: 'text', default: 'Conversion HL7 vers FHIR' }
      ]
    },
    'segment-extractor': {
      name: 'Extracteur de segment',
      description: 'Extrait un segment spécifique d\'un message HL7',
      icon: 'filter',
      color: '#A8DADC',
      inputs: 1,
      outputs: 1,
      properties: [
        { name: 'name', label: 'Nom', type: 'text', default: 'Extracteur de segment' },
        { name: 'segment', label: 'Segment', type: 'select', 
          options: ['PID', 'PV1', 'OBR', 'OBX', 'MSH', 'EVN'], default: 'PID' },
        { name: 'description', label: 'Description', type: 'text', default: 'Extraire un segment spécifique' }
      ]
    },
    'fhir-output': {
      name: 'Sortie FHIR',
      description: 'Envoie les données FHIR vers une destination',
      icon: 'sign-out-alt',
      color: '#1D3557',
      inputs: 1,
      outputs: 0,
      properties: [
        { name: 'name', label: 'Nom', type: 'text', default: 'Sortie FHIR' },
        { name: 'format', label: 'Format de sortie', type: 'select', 
          options: ['JSON', 'XML', 'NDJSON'], default: 'JSON' },
        { name: 'description', label: 'Description', type: 'text', default: 'Sortie de données FHIR' }
      ]
    },
    'function': {
      name: 'Fonction JavaScript',
      description: 'Exécute du code JavaScript personnalisé',
      icon: 'code',
      color: '#3f51b5',
      inputs: 1,
      outputs: 1,
      properties: [
        { name: 'name', label: 'Nom', type: 'text', default: 'Fonction JavaScript' },
        { name: 'code', label: 'Code', type: 'code', default: '// Utilisez "msg" pour accéder aux données entrantes\n// Retournez un objet qui sera transmis au nœud suivant\n\nreturn msg;' },
        { name: 'description', label: 'Description', type: 'text', default: 'Traitement personnalisé' }
      ]
    },
    'condition': {
      name: 'Condition',
      description: 'Route les données selon une condition',
      icon: 'code-branch',
      color: '#9c27b0',
      inputs: 1,
      outputs: 2,
      properties: [
        { name: 'name', label: 'Nom', type: 'text', default: 'Condition' },
        { name: 'condition', label: 'Condition', type: 'code', default: '// Retourne true ou false\nreturn true;' },
        { name: 'description', label: 'Description', type: 'text', default: 'Routage conditionnel' }
      ]
    }
  },
  
  // Catégories de nœuds pour la palette
  categories: [
    {
      name: 'FHIRHub',
      icon: 'fire',
      types: ['hl7-input', 'fhir-converter', 'segment-extractor', 'fhir-output']
    },
    {
      name: 'Logique',
      icon: 'cogs',
      types: ['function', 'condition']
    }
  ]
};

// Classe principale de l'éditeur de workflow
class WorkflowEditor {
  constructor(containerId, options = {}) {
    this.container = document.getElementById(containerId);
    if (!this.container) {
      console.error(`Container with ID "${containerId}" not found`);
      return;
    }
    
    this.options = Object.assign({
      readOnly: false,
      autosave: true,
      workflowId: null
    }, options);
    
    this.nodes = [];
    this.edges = [];
    this.selectedNode = null;
    this.selectedEdge = null;
    this.nextNodeId = 1;
    this.isDragging = false;
    this.isPanning = false;
    this.isEdgeCreating = false;
    this.scale = 1;
    this.translate = { x: 0, y: 0 };
    this.mousePosition = { x: 0, y: 0 };
    this.startEdgeInfo = null;
    this.eventListeners = {};
    
    this.init();
  }
  
  // Initialisation de l'éditeur
  init() {
    this.container.classList.add('workflow-editor-container');
    this.container.innerHTML = '';
    
    // Créer les éléments principaux
    this.createCanvas();
    this.createNodePalette();
    this.createControls();
    
    // Attacher les événements
    this.attachEvents();
    
    // Charger le workflow si un ID est fourni
    if (this.options.workflowId) {
      this.loadWorkflow(this.options.workflowId);
    }
    
    // Première mise à jour du rendu
    this.update();
    
    console.log('Éditeur de workflow initialisé avec succès');
  }
  
  // Créer le canvas où les nœuds seront affichés
  createCanvas() {
    this.canvas = document.createElement('div');
    this.canvas.className = 'workflow-canvas';
    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';
    this.canvas.style.position = 'relative';
    this.canvas.style.overflow = 'hidden';
    this.canvas.style.userSelect = 'none';
    
    this.canvasContent = document.createElement('div');
    this.canvasContent.className = 'workflow-canvas-content';
    this.canvasContent.style.position = 'absolute';
    this.canvasContent.style.transformOrigin = '0 0';
    
    this.edgesLayer = document.createElement('svg');
    this.edgesLayer.className = 'workflow-edges-layer';
    this.edgesLayer.style.position = 'absolute';
    this.edgesLayer.style.width = '100%';
    this.edgesLayer.style.height = '100%';
    this.edgesLayer.style.pointerEvents = 'none';
    this.edgesLayer.style.overflow = 'visible';
    
    this.canvasContent.appendChild(this.edgesLayer);
    this.canvas.appendChild(this.canvasContent);
    this.container.appendChild(this.canvas);
  }
  
  // Créer la palette de nœuds
  createNodePalette() {
    this.palette = document.createElement('div');
    this.palette.className = 'node-palette';
    
    const header = document.createElement('div');
    header.className = 'node-palette-header';
    
    const title = document.createElement('h3');
    title.textContent = 'Palette de nœuds';
    
    const closeBtn = document.createElement('button');
    closeBtn.className = 'node-palette-close';
    closeBtn.innerHTML = '<i class="fas fa-times"></i>';
    closeBtn.addEventListener('click', () => {
      this.palette.style.display = 'none';
    });
    
    header.appendChild(title);
    header.appendChild(closeBtn);
    this.palette.appendChild(header);
    
    // Créer les catégories et les nœuds
    workflowConfig.categories.forEach(category => {
      const categoryEl = document.createElement('div');
      categoryEl.className = 'node-category';
      
      const categoryHeader = document.createElement('div');
      categoryHeader.className = 'category-header';
      categoryHeader.innerHTML = `
        <span><i class="fas fa-${category.icon}"></i> ${category.name}</span>
        <i class="fas fa-chevron-down"></i>
      `;
      
      const categoryContent = document.createElement('div');
      categoryContent.className = 'category-content';
      
      // Ajouter les nœuds de cette catégorie
      category.types.forEach(nodeType => {
        const nodeConfig = workflowConfig.nodeTypes[nodeType];
        if (!nodeConfig) return;
        
        const nodeItem = document.createElement('div');
        nodeItem.className = 'node-item';
        nodeItem.setAttribute('data-type', nodeType);
        nodeItem.innerHTML = `
          <div class="node-item-icon" style="background-color: ${nodeConfig.color}">
            <i class="fas fa-${nodeConfig.icon}" style="color: white"></i>
          </div>
          <span>${nodeConfig.name}</span>
        `;
        
        // Rendre le nœud draggable
        nodeItem.draggable = true;
        nodeItem.addEventListener('dragstart', (e) => this.handleNodeDragStart(e, nodeType));
        
        categoryContent.appendChild(nodeItem);
      });
      
      // Toggle pour ouvrir/fermer la catégorie
      categoryHeader.addEventListener('click', () => {
        categoryContent.classList.toggle('open');
        const icon = categoryHeader.querySelector('i.fas.fa-chevron-down');
        if (categoryContent.classList.contains('open')) {
          icon.className = 'fas fa-chevron-up';
        } else {
          icon.className = 'fas fa-chevron-down';
        }
      });
      
      categoryEl.appendChild(categoryHeader);
      categoryEl.appendChild(categoryContent);
      this.palette.appendChild(categoryEl);
    });
    
    // Ouvrir la première catégorie par défaut
    this.palette.querySelector('.category-content').classList.add('open');
    this.palette.querySelector('.category-header i.fas.fa-chevron-down').className = 'fas fa-chevron-up';
    
    this.container.appendChild(this.palette);
  }
  
  // Créer les contrôles de l'éditeur (zoom, sauvegarde, etc.)
  createControls() {
    const controls = document.createElement('div');
    controls.className = 'workflow-controls';
    
    // Bouton pour afficher/masquer la palette
    const paletteBtn = document.createElement('button');
    paletteBtn.className = 'control-button';
    paletteBtn.innerHTML = '<i class="fas fa-th-large"></i>';
    paletteBtn.title = 'Afficher/masquer la palette';
    paletteBtn.addEventListener('click', () => {
      this.palette.style.display = this.palette.style.display === 'none' ? 'block' : 'none';
    });
    
    // Bouton de zoom +
    const zoomInBtn = document.createElement('button');
    zoomInBtn.className = 'control-button';
    zoomInBtn.innerHTML = '<i class="fas fa-search-plus"></i>';
    zoomInBtn.title = 'Zoom avant';
    zoomInBtn.addEventListener('click', () => this.zoomIn());
    
    // Bouton de zoom -
    const zoomOutBtn = document.createElement('button');
    zoomOutBtn.className = 'control-button';
    zoomOutBtn.innerHTML = '<i class="fas fa-search-minus"></i>';
    zoomOutBtn.title = 'Zoom arrière';
    zoomOutBtn.addEventListener('click', () => this.zoomOut());
    
    // Bouton de réinitialisation de la vue
    const resetViewBtn = document.createElement('button');
    resetViewBtn.className = 'control-button';
    resetViewBtn.innerHTML = '<i class="fas fa-home"></i>';
    resetViewBtn.title = 'Réinitialiser la vue';
    resetViewBtn.addEventListener('click', () => this.resetView());
    
    // Bouton de sauvegarde
    const saveBtn = document.createElement('button');
    saveBtn.className = 'control-button';
    saveBtn.innerHTML = '<i class="fas fa-save"></i>';
    saveBtn.title = 'Sauvegarder le workflow';
    saveBtn.addEventListener('click', () => this.saveWorkflow());
    
    controls.appendChild(paletteBtn);
    controls.appendChild(zoomInBtn);
    controls.appendChild(zoomOutBtn);
    controls.appendChild(resetViewBtn);
    controls.appendChild(saveBtn);
    
    this.container.appendChild(controls);
  }
  
  // Attacher les événements d'interaction à l'éditeur
  attachEvents() {
    // Événements du canvas pour la navigation
    this.canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const delta = e.deltaY < 0 ? 1.1 : 0.9;
      this.zoom(delta, { x: e.clientX, y: e.clientY });
    });
    
    this.canvas.addEventListener('mousedown', (e) => {
      if (e.button === 0) { // bouton gauche
        if (!e.target.closest('.workflow-node') && !e.target.closest('.node-handle')) {
          this.isPanning = true;
          this.lastPanPoint = { x: e.clientX, y: e.clientY };
          this.canvas.style.cursor = 'grabbing';
        }
      }
    });
    
    this.canvas.addEventListener('mousemove', (e) => {
      this.mousePosition = { x: e.clientX, y: e.clientY };
      
      if (this.isPanning) {
        const dx = e.clientX - this.lastPanPoint.x;
        const dy = e.clientY - this.lastPanPoint.y;
        
        this.translate.x += dx / this.scale;
        this.translate.y += dy / this.scale;
        
        this.lastPanPoint = { x: e.clientX, y: e.clientY };
        this.updateTransform();
      }
      
      if (this.isEdgeCreating) {
        this.updateTempEdge();
      }
    });
    
    this.canvas.addEventListener('mouseup', (e) => {
      if (e.button === 0) { // bouton gauche
        if (this.isPanning) {
          this.isPanning = false;
          this.canvas.style.cursor = '';
        }
        
        if (this.isEdgeCreating) {
          const targetHandle = e.target.closest('.node-handle');
          if (targetHandle && targetHandle.classList.contains('input')) {
            const targetNode = targetHandle.closest('.workflow-node');
            if (targetNode) {
              const targetNodeId = targetNode.getAttribute('data-id');
              this.createEdge(this.startEdgeInfo.nodeId, targetNodeId);
            }
          }
          
          this.isEdgeCreating = false;
          this.removeTempEdge();
        }
      }
    });
    
    // Gérer le drop des nœuds depuis la palette
    this.canvas.addEventListener('dragover', (e) => {
      e.preventDefault();
    });
    
    this.canvas.addEventListener('drop', (e) => {
      e.preventDefault();
      
      const nodeType = e.dataTransfer.getData('node-type');
      if (nodeType) {
        const rect = this.canvas.getBoundingClientRect();
        const x = (e.clientX - rect.left) / this.scale - this.translate.x;
        const y = (e.clientY - rect.top) / this.scale - this.translate.y;
        
        this.addNode(nodeType, { x, y });
      }
    });
    
    // Événements sur document pour capturer les clics même si la souris sort du canvas
    document.addEventListener('mouseup', (e) => {
      if (e.button === 0) {
        this.isPanning = false;
        this.canvas.style.cursor = '';
        
        if (this.isEdgeCreating) {
          this.isEdgeCreating = false;
          this.removeTempEdge();
        }
      }
    });
    
    // Événement pour la touche Delete
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (this.selectedNode) {
          this.deleteNode(this.selectedNode);
        } else if (this.selectedEdge) {
          this.deleteEdge(this.selectedEdge);
        }
      }
    });
  }
  
  // Gérer le drag start d'un nœud depuis la palette
  handleNodeDragStart(e, nodeType) {
    e.dataTransfer.setData('node-type', nodeType);
    e.dataTransfer.effectAllowed = 'copy';
    
    // Créer une image fantôme personnalisée pour le drag & drop
    const nodeConfig = workflowConfig.nodeTypes[nodeType];
    const ghost = document.createElement('div');
    ghost.className = 'workflow-node';
    ghost.style.width = '150px';
    ghost.style.height = '60px';
    ghost.style.backgroundColor = nodeConfig.color;
    ghost.style.borderRadius = '5px';
    ghost.style.color = 'white';
    ghost.style.padding = '10px';
    ghost.style.display = 'flex';
    ghost.style.alignItems = 'center';
    ghost.style.justifyContent = 'center';
    ghost.style.opacity = '0.7';
    ghost.textContent = nodeConfig.name;
    
    document.body.appendChild(ghost);
    e.dataTransfer.setDragImage(ghost, 75, 30);
    
    // Nettoyer après un instant
    setTimeout(() => {
      document.body.removeChild(ghost);
    }, 0);
  }
  
  // Créer un nœud dans l'éditeur
  addNode(type, position = { x: 100, y: 100 }) {
    const nodeConfig = workflowConfig.nodeTypes[type];
    if (!nodeConfig) return null;
    
    const nodeId = `node_${this.nextNodeId++}`;
    
    const node = {
      id: nodeId,
      type: type,
      position: position,
      data: {
        name: nodeConfig.properties.find(p => p.name === 'name')?.default || nodeConfig.name,
        ...Object.fromEntries(
          nodeConfig.properties
            .filter(p => p.name !== 'name')
            .map(p => [p.name, p.default])
        )
      }
    };
    
    this.nodes.push(node);
    this.createNodeElement(node);
    this.update();
    
    // Événement personnalisé
    this.emit('nodeAdded', node);
    
    // Auto-sauvegarde si configuré
    if (this.options.autosave) {
      this.saveWorkflow();
    }
    
    return node;
  }
  
  // Créer un élément DOM pour représenter un nœud
  createNodeElement(node) {
    const nodeConfig = workflowConfig.nodeTypes[node.type];
    
    // Créer l'élément nœud
    const nodeEl = document.createElement('div');
    nodeEl.className = `workflow-node node-${node.type}`;
    nodeEl.setAttribute('data-id', node.id);
    nodeEl.style.position = 'absolute';
    nodeEl.style.left = `${node.position.x}px`;
    nodeEl.style.top = `${node.position.y}px`;
    
    // En-tête du nœud avec l'icône et le nom
    const nodeHeader = document.createElement('div');
    nodeHeader.className = 'node-header';
    nodeHeader.innerHTML = `
      <div class="node-header-icon">
        <i class="fas fa-${nodeConfig.icon}"></i>
      </div>
      <span class="node-title">${node.data.name}</span>
    `;
    
    // Contenu du nœud
    const nodeContent = document.createElement('div');
    nodeContent.className = 'node-content';
    nodeContent.textContent = node.data.description || `Nœud ${node.type}`;
    
    // Ajouter les poignées d'entrée/sortie selon la configuration
    if (nodeConfig.inputs > 0) {
      const inputHandle = document.createElement('div');
      inputHandle.className = 'node-handle input';
      inputHandle.style.position = 'absolute';
      inputHandle.style.left = '-6px';
      inputHandle.style.top = '25px';
      nodeEl.appendChild(inputHandle);
      
      // Événement pour recevoir une connexion
      inputHandle.addEventListener('mousedown', (e) => {
        e.stopPropagation();
      });
    }
    
    if (nodeConfig.outputs > 0) {
      for (let i = 0; i < nodeConfig.outputs; i++) {
        const outputHandle = document.createElement('div');
        outputHandle.className = 'node-handle output';
        outputHandle.setAttribute('data-output-idx', i);
        outputHandle.style.position = 'absolute';
        outputHandle.style.right = '-6px';
        
        // Positionner verticalement selon le nombre de sorties
        if (nodeConfig.outputs === 1) {
          outputHandle.style.top = '25px';
        } else {
          const spacing = 30;
          const totalHeight = (nodeConfig.outputs - 1) * spacing;
          outputHandle.style.top = `${25 - totalHeight/2 + i * spacing}px`;
        }
        
        nodeEl.appendChild(outputHandle);
        
        // Événement pour démarrer une connexion
        outputHandle.addEventListener('mousedown', (e) => {
          e.stopPropagation();
          
          this.isEdgeCreating = true;
          this.startEdgeInfo = {
            nodeId: node.id,
            outputIdx: parseInt(outputHandle.getAttribute('data-output-idx')),
            x: node.position.x + nodeEl.offsetWidth,
            y: node.position.y + outputHandle.offsetTop + 6
          };
          
          this.createTempEdge();
        });
      }
    }
    
    // Ajouter les événements pour manipuler le nœud
    nodeEl.addEventListener('mousedown', (e) => {
      if (e.target.closest('.node-handle')) return;
      
      e.stopPropagation();
      
      // Mettre le nœud au premier plan
      nodeEl.style.zIndex = '10';
      
      // Sélectionner le nœud
      this.selectNode(node.id);
      
      // Démarrer le déplacement du nœud
      this.isDragging = true;
      this.dragOffset = {
        x: e.clientX - node.position.x * this.scale,
        y: e.clientY - node.position.y * this.scale
      };
      
      const onMouseMove = (e) => {
        if (!this.isDragging) return;
        
        const newX = (e.clientX - this.dragOffset.x) / this.scale;
        const newY = (e.clientY - this.dragOffset.y) / this.scale;
        
        // Mettre à jour la position
        node.position.x = newX;
        node.position.y = newY;
        
        // Mettre à jour l'affichage
        nodeEl.style.left = `${newX}px`;
        nodeEl.style.top = `${newY}px`;
        
        // Mettre à jour les connexions
        this.updateEdges();
      };
      
      const onMouseUp = () => {
        this.isDragging = false;
        
        // Réinitialiser le z-index
        setTimeout(() => {
          nodeEl.style.zIndex = '';
        }, 100);
        
        // Auto-sauvegarde si configuré
        if (this.options.autosave) {
          this.saveWorkflow();
        }
        
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
      };
      
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    });
    
    // Double-clic pour éditer les propriétés
    nodeEl.addEventListener('dblclick', () => {
      this.openNodeProperties(node.id);
    });
    
    // Assembler le nœud
    nodeEl.appendChild(nodeHeader);
    nodeEl.appendChild(nodeContent);
    
    // Ajouter au canvas
    this.canvasContent.appendChild(nodeEl);
  }
  
  // Sélectionner un nœud
  selectNode(nodeId) {
    // Désélectionner le nœud actuellement sélectionné
    if (this.selectedNode) {
      const oldNodeEl = this.canvasContent.querySelector(`.workflow-node[data-id="${this.selectedNode}"]`);
      if (oldNodeEl) {
        oldNodeEl.classList.remove('selected');
      }
    }
    
    // Désélectionner la connexion actuellement sélectionnée
    if (this.selectedEdge) {
      const oldEdgeEl = this.edgesLayer.querySelector(`.workflow-edge[data-id="${this.selectedEdge}"]`);
      if (oldEdgeEl) {
        oldEdgeEl.classList.remove('selected');
      }
      this.selectedEdge = null;
    }
    
    // Sélectionner le nouveau nœud
    this.selectedNode = nodeId;
    const nodeEl = this.canvasContent.querySelector(`.workflow-node[data-id="${nodeId}"]`);
    if (nodeEl) {
      nodeEl.classList.add('selected');
    }
    
    // Événement personnalisé
    this.emit('nodeSelected', this.getNodeById(nodeId));
  }
  
  // Supprimer un nœud
  deleteNode(nodeId) {
    // Supprimer les connexions liées à ce nœud
    this.edges = this.edges.filter(edge => {
      if (edge.source === nodeId || edge.target === nodeId) {
        // Supprimer l'élément de la connexion du DOM
        const edgeEl = this.edgesLayer.querySelector(`.workflow-edge[data-id="${edge.id}"]`);
        if (edgeEl) {
          edgeEl.remove();
        }
        return false;
      }
      return true;
    });
    
    // Supprimer le nœud de la liste
    this.nodes = this.nodes.filter(node => node.id !== nodeId);
    
    // Supprimer l'élément du nœud du DOM
    const nodeEl = this.canvasContent.querySelector(`.workflow-node[data-id="${nodeId}"]`);
    if (nodeEl) {
      nodeEl.remove();
    }
    
    // Réinitialiser la sélection si nécessaire
    if (this.selectedNode === nodeId) {
      this.selectedNode = null;
    }
    
    // Événement personnalisé
    this.emit('nodeDeleted', nodeId);
    
    // Auto-sauvegarde si configuré
    if (this.options.autosave) {
      this.saveWorkflow();
    }
  }
  
  // Créer une connexion entre deux nœuds
  createEdge(sourceId, targetId, sourceOutput = 0) {
    // Vérifier si les nœuds existent
    const sourceNode = this.getNodeById(sourceId);
    const targetNode = this.getNodeById(targetId);
    
    if (!sourceNode || !targetNode) {
      console.error('Les nœuds source ou cible n\'existent pas');
      return null;
    }
    
    // Vérifier qu'il n'y a pas déjà une connexion identique
    const existingEdge = this.edges.find(edge => 
      edge.source === sourceId && 
      edge.target === targetId && 
      edge.sourceOutput === sourceOutput
    );
    
    if (existingEdge) {
      console.warn('Une connexion identique existe déjà');
      return existingEdge;
    }
    
    // Créer la nouvelle connexion
    const edgeId = `edge_${Date.now()}`;
    const edge = {
      id: edgeId,
      source: sourceId,
      target: targetId,
      sourceOutput: sourceOutput
    };
    
    this.edges.push(edge);
    this.createEdgeElement(edge);
    
    // Événement personnalisé
    this.emit('edgeAdded', edge);
    
    // Auto-sauvegarde si configuré
    if (this.options.autosave) {
      this.saveWorkflow();
    }
    
    return edge;
  }
  
  // Créer un élément SVG pour représenter une connexion
  createEdgeElement(edge) {
    const sourceNode = this.getNodeById(edge.source);
    const targetNode = this.getNodeById(edge.target);
    
    if (!sourceNode || !targetNode) return;
    
    const sourceEl = this.canvasContent.querySelector(`.workflow-node[data-id="${edge.source}"]`);
    const targetEl = this.canvasContent.querySelector(`.workflow-node[data-id="${edge.target}"]`);
    
    if (!sourceEl || !targetEl) return;
    
    // Trouver les coordonnées des points de connexion
    const sourceOutput = sourceEl.querySelector(`.node-handle.output[data-output-idx="${edge.sourceOutput}"]`);
    const targetInput = targetEl.querySelector('.node-handle.input');
    
    if (!sourceOutput || !targetInput) return;
    
    const sourceRect = sourceOutput.getBoundingClientRect();
    const targetRect = targetInput.getBoundingClientRect();
    const canvasRect = this.canvas.getBoundingClientRect();
    
    const sourcePoint = {
      x: (sourceRect.left - canvasRect.left) / this.scale + 6,
      y: (sourceRect.top - canvasRect.top) / this.scale + 6
    };
    
    const targetPoint = {
      x: (targetRect.left - canvasRect.left) / this.scale + 6,
      y: (targetRect.top - canvasRect.top) / this.scale + 6
    };
    
    // Créer l'élément de connexion (chemin SVG)
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.classList.add('workflow-edge');
    g.setAttribute('data-id', edge.id);
    
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.classList.add('workflow-edge-path');
    
    // Calculer le chemin en courbe de Bézier
    const dx = Math.abs(targetPoint.x - sourcePoint.x);
    const pathString = `M ${sourcePoint.x} ${sourcePoint.y} C ${sourcePoint.x + dx/2} ${sourcePoint.y}, ${targetPoint.x - dx/2} ${targetPoint.y}, ${targetPoint.x} ${targetPoint.y}`;
    
    path.setAttribute('d', pathString);
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', '#bbb');
    path.setAttribute('stroke-width', '2');
    
    g.appendChild(path);
    this.edgesLayer.appendChild(g);
    
    // Ajouter un événement de clic pour sélectionner la connexion
    g.addEventListener('click', (e) => {
      e.stopPropagation();
      this.selectEdge(edge.id);
    });
  }
  
  // Sélectionner une connexion
  selectEdge(edgeId) {
    // Désélectionner la connexion actuellement sélectionnée
    if (this.selectedEdge) {
      const oldEdgeEl = this.edgesLayer.querySelector(`.workflow-edge[data-id="${this.selectedEdge}"]`);
      if (oldEdgeEl) {
        oldEdgeEl.classList.remove('selected');
      }
    }
    
    // Désélectionner le nœud actuellement sélectionné
    if (this.selectedNode) {
      const oldNodeEl = this.canvasContent.querySelector(`.workflow-node[data-id="${this.selectedNode}"]`);
      if (oldNodeEl) {
        oldNodeEl.classList.remove('selected');
      }
      this.selectedNode = null;
    }
    
    // Sélectionner la nouvelle connexion
    this.selectedEdge = edgeId;
    const edgeEl = this.edgesLayer.querySelector(`.workflow-edge[data-id="${edgeId}"]`);
    if (edgeEl) {
      edgeEl.classList.add('selected');
    }
    
    // Événement personnalisé
    this.emit('edgeSelected', this.getEdgeById(edgeId));
  }
  
  // Supprimer une connexion
  deleteEdge(edgeId) {
    // Supprimer la connexion de la liste
    this.edges = this.edges.filter(edge => edge.id !== edgeId);
    
    // Supprimer l'élément de la connexion du DOM
    const edgeEl = this.edgesLayer.querySelector(`.workflow-edge[data-id="${edgeId}"]`);
    if (edgeEl) {
      edgeEl.remove();
    }
    
    // Réinitialiser la sélection si nécessaire
    if (this.selectedEdge === edgeId) {
      this.selectedEdge = null;
    }
    
    // Événement personnalisé
    this.emit('edgeDeleted', edgeId);
    
    // Auto-sauvegarde si configuré
    if (this.options.autosave) {
      this.saveWorkflow();
    }
  }
  
  // Créer une connexion temporaire (pendant le drag & drop)
  createTempEdge() {
    const tempEdge = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    tempEdge.classList.add('workflow-temp-edge');
    
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.classList.add('workflow-edge-path');
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', '#f4845f');
    path.setAttribute('stroke-width', '2');
    path.setAttribute('stroke-dasharray', '5,5');
    
    tempEdge.appendChild(path);
    this.edgesLayer.appendChild(tempEdge);
  }
  
  // Mettre à jour la connexion temporaire pendant le drag
  updateTempEdge() {
    const tempEdge = this.edgesLayer.querySelector('.workflow-temp-edge');
    if (!tempEdge || !this.startEdgeInfo) return;
    
    const path = tempEdge.querySelector('path');
    
    const canvasRect = this.canvas.getBoundingClientRect();
    const endPoint = {
      x: (this.mousePosition.x - canvasRect.left) / this.scale,
      y: (this.mousePosition.y - canvasRect.top) / this.scale
    };
    
    const dx = Math.abs(endPoint.x - this.startEdgeInfo.x);
    const pathString = `M ${this.startEdgeInfo.x} ${this.startEdgeInfo.y} C ${this.startEdgeInfo.x + dx/2} ${this.startEdgeInfo.y}, ${endPoint.x - dx/2} ${endPoint.y}, ${endPoint.x} ${endPoint.y}`;
    
    path.setAttribute('d', pathString);
  }
  
  // Supprimer la connexion temporaire
  removeTempEdge() {
    const tempEdge = this.edgesLayer.querySelector('.workflow-temp-edge');
    if (tempEdge) {
      tempEdge.remove();
    }
  }
  
  // Mettre à jour toutes les connexions (après déplacement de nœuds)
  updateEdges() {
    // Supprimer toutes les connexions du DOM
    this.edgesLayer.innerHTML = '';
    
    // Recréer toutes les connexions
    this.edges.forEach(edge => {
      this.createEdgeElement(edge);
    });
  }
  
  // Ouvrir la boîte de dialogue des propriétés d'un nœud
  openNodeProperties(nodeId) {
    const node = this.getNodeById(nodeId);
    if (!node) return;
    
    const nodeConfig = workflowConfig.nodeTypes[node.type];
    if (!nodeConfig) return;
    
    // Créer un overlay pour le fond
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    
    // Créer la boîte de dialogue
    const dialog = document.createElement('div');
    dialog.className = 'node-properties-dialog';
    
    // En-tête
    const header = document.createElement('div');
    header.className = 'node-properties-header';
    header.innerHTML = `
      <h3>Propriétés: ${nodeConfig.name}</h3>
      <button class="node-properties-close"><i class="fas fa-times"></i></button>
    `;
    
    // Contenu
    const content = document.createElement('div');
    content.className = 'node-properties-content';
    
    // Créer les champs pour chaque propriété
    nodeConfig.properties.forEach(property => {
      const group = document.createElement('div');
      group.className = 'property-group';
      
      const label = document.createElement('label');
      label.className = 'property-label';
      label.textContent = property.label;
      
      let input;
      
      if (property.type === 'text') {
        input = document.createElement('input');
        input.className = 'property-input';
        input.type = 'text';
        input.name = property.name;
        input.value = node.data[property.name] || '';
      } else if (property.type === 'select') {
        input = document.createElement('select');
        input.className = 'property-select';
        input.name = property.name;
        
        property.options.forEach(option => {
          const optEl = document.createElement('option');
          optEl.value = option;
          optEl.textContent = option;
          if (node.data[property.name] === option) {
            optEl.selected = true;
          }
          input.appendChild(optEl);
        });
      } else if (property.type === 'code') {
        input = document.createElement('textarea');
        input.className = 'property-input property-code';
        input.name = property.name;
        input.value = node.data[property.name] || '';
        input.rows = 6;
      }
      
      group.appendChild(label);
      group.appendChild(input);
      content.appendChild(group);
    });
    
    // Pied
    const footer = document.createElement('div');
    footer.className = 'node-properties-footer';
    footer.innerHTML = `
      <button class="properties-button cancel">Annuler</button>
      <button class="properties-button apply">Appliquer</button>
    `;
    
    // Assembler
    dialog.appendChild(header);
    dialog.appendChild(content);
    dialog.appendChild(footer);
    
    // Ajouter au DOM
    this.container.appendChild(overlay);
    this.container.appendChild(dialog);
    
    // Attacher les événements
    const closeBtn = header.querySelector('.node-properties-close');
    const cancelBtn = footer.querySelector('.cancel');
    const applyBtn = footer.querySelector('.apply');
    
    const closeDialog = () => {
      dialog.remove();
      overlay.remove();
    };
    
    closeBtn.addEventListener('click', closeDialog);
    cancelBtn.addEventListener('click', closeDialog);
    
    applyBtn.addEventListener('click', () => {
      // Récupérer les valeurs des champs
      const inputs = content.querySelectorAll('input, select, textarea');
      inputs.forEach(input => {
        node.data[input.name] = input.value;
      });
      
      // Mettre à jour l'affichage du nœud
      const nodeEl = this.canvasContent.querySelector(`.workflow-node[data-id="${nodeId}"]`);
      if (nodeEl) {
        nodeEl.querySelector('.node-title').textContent = node.data.name;
        nodeEl.querySelector('.node-content').textContent = node.data.description || `Nœud ${node.type}`;
      }
      
      // Événement personnalisé
      this.emit('nodeUpdated', node);
      
      // Auto-sauvegarde si configuré
      if (this.options.autosave) {
        this.saveWorkflow();
      }
      
      closeDialog();
    });
  }
  
  // Opérations de zoom
  zoom(scale, center) {
    const oldScale = this.scale;
    this.scale *= scale;
    
    // Limiter le zoom
    this.scale = Math.max(0.1, Math.min(3, this.scale));
    
    // Ajuster la translation pour zoomer vers le point de la souris
    if (center && oldScale !== this.scale) {
      const rect = this.canvas.getBoundingClientRect();
      const mouse = {
        x: (center.x - rect.left) / oldScale,
        y: (center.y - rect.top) / oldScale
      };
      
      this.translate.x -= (mouse.x - this.translate.x) * (1 - oldScale / this.scale);
      this.translate.y -= (mouse.y - this.translate.y) * (1 - oldScale / this.scale);
    }
    
    this.updateTransform();
  }
  
  zoomIn() {
    this.zoom(1.2, {
      x: this.canvas.offsetWidth / 2,
      y: this.canvas.offsetHeight / 2
    });
  }
  
  zoomOut() {
    this.zoom(0.8, {
      x: this.canvas.offsetWidth / 2,
      y: this.canvas.offsetHeight / 2
    });
  }
  
  resetView() {
    this.scale = 1;
    this.translate = { x: 0, y: 0 };
    this.updateTransform();
  }
  
  updateTransform() {
    this.canvasContent.style.transform = `translate(${this.translate.x}px, ${this.translate.y}px) scale(${this.scale})`;
    this.updateEdges();
  }
  
  // Mettre à jour le rendu complet
  update() {
    // Mettre à jour la transformation
    this.updateTransform();
    
    // Mettre à jour les connexions
    this.updateEdges();
  }
  
  // Charger un workflow depuis le serveur
  async loadWorkflow(workflowId) {
    try {
      console.log(`Chargement du workflow ${workflowId}...`);
      
      const token = getToken ? getToken() : localStorage.getItem('token');
      
      const response = await fetch(`/api/workflows/${workflowId}`, {
        headers: {
          'Authorization': token ? `Bearer ${token}` : '',
          'X-API-KEY': 'dev-key'
        }
      });
      
      if (!response.ok) {
        throw new Error(`Erreur lors du chargement du workflow: ${response.status}`);
      }
      
      let data = await response.json();
      
      // Gérer différents formats de réponse
      if (data.success && data.data) {
        data = data.data;
      }
      
      console.log('Workflow chargé:', data);
      
      // Réinitialiser l'éditeur
      this.nodes = [];
      this.edges = [];
      this.canvasContent.querySelectorAll('.workflow-node').forEach(el => el.remove());
      this.edgesLayer.innerHTML = '';
      
      // Mettre à jour l'ID du workflow
      this.options.workflowId = workflowId;
      
      // Charger les données de flux stockées dans flow_json
      let flowData;
      try {
        flowData = typeof data.flow_json === 'string' 
          ? JSON.parse(data.flow_json) 
          : data.flow_json || {};
      } catch (e) {
        console.error('Erreur lors du parsing du JSON du workflow:', e);
        flowData = { nodes: [], edges: [] };
      }
      
      // Format attendu: { nodes: [], edges: [] }
      if (Array.isArray(flowData)) {
        // Ancien format: transformer en format attendu
        flowData = { nodes: flowData, edges: [] };
      }
      
      // Charger les nœuds
      if (flowData.nodes && Array.isArray(flowData.nodes)) {
        // Trouver l'ID maximum pour continuer l'auto-incrémentation
        let maxNodeId = 0;
        
        flowData.nodes.forEach(node => {
          this.nodes.push(node);
          this.createNodeElement(node);
          
          // Extraire l'ID numérique pour l'auto-incrémentation
          if (node.id && typeof node.id === 'string') {
            const idMatch = node.id.match(/node_(\d+)/);
            if (idMatch && idMatch[1]) {
              const idNum = parseInt(idMatch[1]);
              if (idNum > maxNodeId) {
                maxNodeId = idNum;
              }
            }
          }
        });
        
        this.nextNodeId = maxNodeId + 1;
      }
      
      // Charger les connexions
      if (flowData.edges && Array.isArray(flowData.edges)) {
        flowData.edges.forEach(edge => {
          this.edges.push(edge);
          this.createEdgeElement(edge);
        });
      }
      
      // Mise à jour complète
      this.update();
      
      // Événement personnalisé
      this.emit('workflowLoaded', data);
    } catch (error) {
      console.error('Erreur lors du chargement du workflow:', error);
    }
  }
  
  // Sauvegarder le workflow sur le serveur
  async saveWorkflow() {
    if (!this.options.workflowId) {
      console.warn('Impossible de sauvegarder: pas d\'ID de workflow');
      return;
    }
    
    try {
      console.log(`Sauvegarde du workflow ${this.options.workflowId}...`);
      
      // Préparer les données du flux
      const flowData = {
        nodes: this.nodes,
        edges: this.edges
      };
      
      // Convertir en JSON
      const flowJson = JSON.stringify(flowData);
      
      const token = getToken ? getToken() : localStorage.getItem('token');
      
      // Envoyer au serveur
      const response = await fetch(`/api/workflows/${this.options.workflowId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : '',
          'X-API-KEY': 'dev-key'
        },
        body: JSON.stringify({
          flow_json: flowJson
        })
      });
      
      if (!response.ok) {
        throw new Error(`Erreur lors de la sauvegarde du workflow: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('Workflow sauvegardé:', data);
      
      // Événement personnalisé
      this.emit('workflowSaved', data);
      
      // Notification
      this.showNotification('Workflow sauvegardé avec succès!', 'success');
    } catch (error) {
      console.error('Erreur lors de la sauvegarde du workflow:', error);
      
      // Notification d'erreur
      this.showNotification(`Erreur: ${error.message}`, 'error');
    }
  }
  
  // Afficher une notification
  showNotification(message, type = 'info') {
    // Vérifier si showNotification existe dans le contexte global
    if (typeof window.showNotification === 'function') {
      window.showNotification(message, type);
      return;
    }
    
    // Implémentation simple par défaut
    const notification = document.createElement('div');
    notification.className = `workflow-notification ${type}`;
    notification.textContent = message;
    notification.style.position = 'fixed';
    notification.style.bottom = '20px';
    notification.style.right = '20px';
    notification.style.padding = '10px 15px';
    notification.style.borderRadius = '4px';
    notification.style.color = 'white';
    notification.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.2)';
    notification.style.zIndex = '1000';
    
    if (type === 'error') {
      notification.style.backgroundColor = '#E63946';
    } else if (type === 'success') {
      notification.style.backgroundColor = '#4CAF50';
    } else {
      notification.style.backgroundColor = '#457B9D';
    }
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
      notification.style.opacity = '0';
      notification.style.transition = 'opacity 0.5s ease';
      
      setTimeout(() => {
        notification.remove();
      }, 500);
    }, 3000);
  }
  
  // Récupérer un nœud par son ID
  getNodeById(id) {
    return this.nodes.find(node => node.id === id);
  }
  
  // Récupérer une connexion par son ID
  getEdgeById(id) {
    return this.edges.find(edge => edge.id === id);
  }
  
  // Système d'événements personnalisés
  on(event, callback) {
    if (!this.eventListeners[event]) {
      this.eventListeners[event] = [];
    }
    this.eventListeners[event].push(callback);
  }
  
  off(event, callback) {
    if (!this.eventListeners[event]) return;
    
    if (callback) {
      this.eventListeners[event] = this.eventListeners[event].filter(cb => cb !== callback);
    } else {
      this.eventListeners[event] = [];
    }
  }
  
  emit(event, data) {
    if (!this.eventListeners[event]) return;
    
    this.eventListeners[event].forEach(callback => {
      try {
        callback(data);
      } catch (error) {
        console.error(`Erreur dans un gestionnaire d'événement ${event}:`, error);
      }
    });
  }
}

// Exporter la classe de l'éditeur
window.WorkflowEditor = WorkflowEditor;