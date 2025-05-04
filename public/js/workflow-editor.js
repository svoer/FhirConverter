/**
 * WorkflowEditor - Éditeur visuel de workflows pour FHIRHub
 * Version 1.0.0
 * 
 * Éditeur visuel de type n8n/ComfyUI pour la création et l'édition de workflows
 * dans l'application FHIRHub.
 * 
 * @author FHIRHub
 * @requires JavaScript ES6+
 */

class WorkflowEditor {
  /**
   * Crée une instance de l'éditeur de workflow
   * @param {string} containerId - ID du conteneur HTML
   * @param {Object} options - Options de configuration
   */
  constructor(containerId, options = {}) {
    // Configuration par défaut
    this.options = {
      readOnly: false,
      allowPanning: true,
      allowZooming: true,
      snapToGrid: true,
      gridSize: 20,
      initialScale: 1,
      minScale: 0.2,
      maxScale: 2,
      ...options
    };
    
    // État de l'éditeur
    this.container = document.getElementById(containerId);
    this.scale = this.options.initialScale;
    this.offset = { x: 0, y: 0 };
    this.isDragging = false;
    this.dragStart = { x: 0, y: 0 };
    this.nodes = [];
    this.edges = [];
    this.selectedNodeId = null;
    this.selectedEdgeId = null;
    this.nextNodeId = 1;
    this.nextEdgeId = 1;
    this.tempEdge = null;
    this.isCreatingEdge = false;
    this.sourceNodeId = null;
    this.sourcePortIndex = null;
    this.isInputPortSource = false; // Indique si on commence une arête depuis un port d'entrée
    this.workflowId = null;
    this.workflowName = '';
    this.workflowDescription = '';
    
    // Propriétés pour les événements
    this.eventListeners = {
      'nodeAdded': [],
      'nodeRemoved': [],
      'edgeAdded': [],
      'edgeRemoved': [],
      'nodeSelected': [],
      'edgeSelected': [],
      'nodePositionChanged': [],
      'workflowChanged': [],
      'workflowSaved': []
    };
    
    // Initialisation
    this.init();
  }
  
  /**
   * Initialise l'éditeur
   */
  init() {
    // Vérifier si le conteneur existe
    if (!this.container) {
      console.error('Conteneur d\'éditeur non trouvé');
      return;
    }
    
    // Créer les éléments de l'UI
    this.createCanvas();
    this.createNodePalette();
    this.createControls();
    
    // Ajouter les événements
    this.attachEvents();
    
    // Mettre à jour l'affichage
    this.update();
    
    console.log('Éditeur de workflow initialisé');
  }
  
  /**
   * Crée le canevas principal
   */
  createCanvas() {
    // Définir les dimensions du canvas pour un espace de travail très large
    this.canvasSize = {
      width: 4000,  // Grande taille pour supporter les workflows complexes
      height: 4000  // Grande taille pour supporter les workflows complexes
    };
    
    this.canvas = document.createElement('div');
    this.canvas.className = 'workflow-canvas';
    
    // Définir les dimensions explicitement
    this.canvas.style.width = this.canvasSize.width + 'px';
    this.canvas.style.height = this.canvasSize.height + 'px';
    
    this.container.appendChild(this.canvas);
    
    // Ajouter un SVG pour les liaisons avec des dimensions adaptées
    this.edgesLayer = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    this.edgesLayer.setAttribute('class', 'edges-layer');
    this.edgesLayer.setAttribute('width', this.canvasSize.width);
    this.edgesLayer.setAttribute('height', this.canvasSize.height);
    this.edgesLayer.style.position = 'absolute';
    this.edgesLayer.style.top = '0';
    this.edgesLayer.style.left = '0';
    this.edgesLayer.style.pointerEvents = 'none';
    this.edgesLayer.style.overflow = 'visible';
    this.canvas.appendChild(this.edgesLayer);
    
    // Ajouter la couche des noeuds
    this.nodesLayer = document.createElement('div');
    this.nodesLayer.className = 'nodes-layer';
    this.canvas.appendChild(this.nodesLayer);
    
    // Overlay de chargement
    this.loadingOverlay = document.createElement('div');
    this.loadingOverlay.className = 'loading-overlay';
    this.loadingOverlay.innerHTML = '<div class="loading-spinner"></div>';
    this.container.appendChild(this.loadingOverlay);
    
    // Centrer le canvas initialement
    this.centerCanvas();
  }
  
  /**
   * Centre le canvas pour que la vue soit au milieu du grand canvas
   * ou centre un point spécifique si des coordonnées sont fournies
   * @param {Object} point - Point à centrer { x, y }, optionnel
   * @param {boolean} animate - Indique si le centrage doit être animé, par défaut à true
   */
  centerCanvas(point = null, animate = true) {
    // Obtenir les dimensions du conteneur
    const containerRect = this.container.getBoundingClientRect();
    
    // Déterminer les coordonnées cibles
    const targetX = point ? 
      containerRect.width / 2 - point.x * this.scale : 
      containerRect.width / 2 - 2000 * this.scale; // 2000 = milieu du canvas
      
    const targetY = point ?
      containerRect.height / 2 - point.y * this.scale :
      containerRect.height / 2 - 2000 * this.scale; // 2000 = milieu du canvas
    
    if (animate) {
      // Animation douce du centrage avec requestAnimationFrame
      const startX = this.offset.x;
      const startY = this.offset.y;
      const deltaX = targetX - startX;
      const deltaY = targetY - startY;
      const duration = 300; // durée en ms
      const startTime = performance.now();
      
      const animateCenter = (currentTime) => {
        const elapsedTime = currentTime - startTime;
        const progress = Math.min(elapsedTime / duration, 1);
        
        // Fonction d'ease-out pour une animation plus naturelle
        const easeOutProgress = 1 - Math.pow(1 - progress, 2);
        
        this.offset.x = startX + deltaX * easeOutProgress;
        this.offset.y = startY + deltaY * easeOutProgress;
        
        this.updateTransform();
        
        if (progress < 1) {
          requestAnimationFrame(animateCenter);
        } else {
          // Mise à jour des arêtes une fois l'animation terminée
          this.updateEdges();
          
          if (point) {
            console.log(`[Workflow] Canvas centré sur le point (${point.x}, ${point.y})`);
          } else {
            console.log(`[Workflow] Canvas centré sur le milieu du canvas`);
          }
        }
      };
      
      requestAnimationFrame(animateCenter);
    } else {
      // Sans animation, mise à jour immédiate
      this.offset.x = targetX;
      this.offset.y = targetY;
      this.updateTransform();
      
      if (point) {
        console.log(`[Workflow] Canvas centré immédiatement sur le point (${point.x}, ${point.y})`);
      } else {
        console.log(`[Workflow] Canvas centré immédiatement sur le milieu du canvas`);
      }
    }
  }
  
  /**
   * Crée la palette de noeuds
   */
  createNodePalette() {
    this.nodePalette = document.createElement('div');
    this.nodePalette.className = 'node-palette';
    this.container.appendChild(this.nodePalette);
    
    // Titre de la palette
    const paletteTitle = document.createElement('h3');
    paletteTitle.textContent = 'Nœuds disponibles';
    this.nodePalette.appendChild(paletteTitle);
    
    // Rendre la palette déplaçable
    this.makeElementDraggable(this.nodePalette, paletteTitle);
    
    // Catégories de noeuds
    const categories = [
      {
        name: 'Entrées',
        nodes: [
          { type: 'hl7-input', label: 'Entrée HL7', icon: '📥' },
          { type: 'json-input', label: 'Entrée JSON', icon: '📄' },
          { type: 'file-input', label: 'Entrée fichier', icon: '📁' }
        ]
      },
      {
        name: 'Traitement',
        nodes: [
          { type: 'segment-extractor', label: 'Extraire segment', icon: '🔍' },
          { type: 'field-mapper', label: 'Mapper champs', icon: '🔀' },
          { type: 'condition', label: 'Condition', icon: '⚙️' },
          { type: 'transform', label: 'Transformer', icon: '🔄' }
        ]
      },
      {
        name: 'Conversion',
        nodes: [
          { type: 'fhir-converter', label: 'Convertir FHIR', icon: '🔥' },
          { type: 'template', label: 'Template JSON', icon: '📝' },
          { type: 'custom-script', label: 'Script JS', icon: '📜' }
        ]
      },
      {
        name: 'Sorties',
        nodes: [
          { type: 'fhir-output', label: 'Sortie FHIR', icon: '📤' },
          { type: 'api-call', label: 'Appel API', icon: '🌐' },
          { type: 'file-output', label: 'Sortie fichier', icon: '💾' }
        ]
      }
    ];
    
    // Créer les catégories
    categories.forEach(category => {
      const categoryDiv = document.createElement('div');
      categoryDiv.className = 'node-palette-category';
      
      const categoryTitle = document.createElement('h4');
      categoryTitle.textContent = category.name;
      categoryDiv.appendChild(categoryTitle);
      
      // Créer les éléments de noeuds
      category.nodes.forEach(node => {
        const nodeItem = document.createElement('div');
        nodeItem.className = 'node-palette-item';
        nodeItem.setAttribute('data-node-type', node.type);
        
        const nodeIcon = document.createElement('div');
        nodeIcon.className = 'node-palette-item-icon';
        nodeIcon.textContent = node.icon;
        
        const nodeLabel = document.createElement('div');
        nodeLabel.className = 'node-palette-item-label';
        nodeLabel.textContent = node.label;
        
        nodeItem.appendChild(nodeIcon);
        nodeItem.appendChild(nodeLabel);
        categoryDiv.appendChild(nodeItem);
        
        // Ajouter l'événement de drag & drop
        this.handleNodeDragStart(nodeItem, node.type);
      });
      
      this.nodePalette.appendChild(categoryDiv);
    });
  }
  
  /**
   * Crée les contrôles de l'éditeur
   */
  createControls() {
    this.controls = document.createElement('div');
    this.controls.className = 'editor-controls';
    this.container.appendChild(this.controls);
    
    // Boutons de zoom
    const zoomInBtn = document.createElement('button');
    zoomInBtn.innerHTML = '+';
    zoomInBtn.title = 'Zoom avant';
    zoomInBtn.addEventListener('click', () => this.zoomIn());
    
    const zoomOutBtn = document.createElement('button');
    zoomOutBtn.innerHTML = '-';
    zoomOutBtn.title = 'Zoom arrière';
    zoomOutBtn.addEventListener('click', () => this.zoomOut());
    
    const resetBtn = document.createElement('button');
    resetBtn.innerHTML = '↻';
    resetBtn.title = 'Réinitialiser la vue';
    resetBtn.addEventListener('click', () => this.resetView());
    
    // Bouton pour le One-Click Node Connection Wizard
    const connectNodesBtn = document.createElement('button');
    connectNodesBtn.innerHTML = '🔌';
    connectNodesBtn.title = 'Assistant de connexion rapide';
    connectNodesBtn.className = 'connect-nodes-btn';
    connectNodesBtn.addEventListener('click', () => this.activateConnectionWizard());
    
    this.controls.appendChild(zoomInBtn);
    this.controls.appendChild(zoomOutBtn);
    this.controls.appendChild(resetBtn);
    this.controls.appendChild(connectNodesBtn);
    
    // Panneau de propriétés des noeuds
    this.propertiesPanel = document.createElement('div');
    this.propertiesPanel.className = 'node-properties';
    
    const propertiesHeader = document.createElement('div');
    propertiesHeader.className = 'properties-header';
    
    const propertiesTitle = document.createElement('h3');
    propertiesTitle.id = 'properties-title';
    propertiesTitle.textContent = 'Propriétés';
    
    const closeBtn = document.createElement('button');
    closeBtn.className = 'close-properties';
    closeBtn.innerHTML = '×';
    closeBtn.addEventListener('click', () => {
      this.propertiesPanel.classList.remove('open');
    });
    
    propertiesHeader.appendChild(propertiesTitle);
    propertiesHeader.appendChild(closeBtn);
    
    // Rendre le panneau déplaçable
    this.makeElementDraggable(this.propertiesPanel, propertiesHeader);
    
    this.propertiesContent = document.createElement('div');
    this.propertiesContent.className = 'properties-content';
    
    this.propertiesPanel.appendChild(propertiesHeader);
    this.propertiesPanel.appendChild(this.propertiesContent);
    
    this.container.appendChild(this.propertiesPanel);
  }
  
  /**
   * Attache les événements à l'éditeur
   */
  attachEvents() {
    // Événements de la souris pour le panning
    if (this.options.allowPanning) {
      this.container.addEventListener('mousedown', (e) => {
        // Si on clique sur le canvas (pas sur un noeud)
        if (e.target === this.canvas || e.target === this.nodesLayer || e.target === this.edgesLayer) {
          this.isDragging = true;
          this.dragStart = {
            x: e.clientX - this.offset.x,
            y: e.clientY - this.offset.y
          };
          this.container.style.cursor = 'grabbing';
        }
      });
      
      document.addEventListener('mousemove', (e) => {
        if (this.isDragging) {
          this.offset.x = e.clientX - this.dragStart.x;
          this.offset.y = e.clientY - this.dragStart.y;
          this.updateTransform();
        } else if (this.isCreatingEdge) {
          this.updateTempEdge(e);
        }
      });
      
      document.addEventListener('mouseup', (e) => {
        if (this.isDragging) {
          this.isDragging = false;
          this.container.style.cursor = 'default';
        }
        
        if (this.isCreatingEdge) {
          // Nous laissons le gestionnaire d'événements spécifique du port gérer cette partie
          // Mais ajoutons une protection supplémentaire pour éviter des arêtes incomplètes
          console.log("[Workflow] Fin de l'opération de création d'arête");
          
          // S'assurer que tout est bien nettoyé
          setTimeout(() => {
            if (this.isCreatingEdge) {
              console.warn("[Workflow] Nettoyage forcé après tentative de création d'arête");
              this.removeTempEdge();
              this.isCreatingEdge = false;
              this.sourceNodeId = null;
              this.sourcePortIndex = null;
              this.clearPortHighlights();
            }
          }, 100);
        }
      });
    }
    
    // Événement de la molette pour le zoom
    if (this.options.allowZooming) {
      this.container.addEventListener('wheel', (e) => {
        e.preventDefault();
        
        // Calculer le point central du zoom
        const rect = this.container.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        
        // Déterminer la direction du zoom
        const delta = e.deltaY < 0 ? 1.1 : 0.9;
        
        // Appliquer le zoom
        this.zoom(delta, { x: mouseX, y: mouseY });
      });
    }
    
    // Événement pour supprimer un noeud sélectionné avec Delete
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Delete' && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
        if (this.selectedNodeId) {
          this.deleteNode(this.selectedNodeId);
        } else if (this.selectedEdgeId) {
          this.deleteEdge(this.selectedEdgeId);
        }
      }
    });
  }
  
  /**
   * Gère le début du glisser-déposer d'un noeud depuis la palette
   * @param {HTMLElement} element - Élément HTML du noeud dans la palette
   * @param {string} nodeType - Type de noeud
   */
  handleNodeDragStart(element, nodeType) {
    element.addEventListener('mousedown', (e) => {
      e.preventDefault();
      
      // Créer un élément fantôme pour le drag & drop
      const ghost = element.cloneNode(true);
      ghost.style.position = 'absolute';
      ghost.style.zIndex = '1000';
      ghost.style.opacity = '0.7';
      ghost.style.pointerEvents = 'none';
      document.body.appendChild(ghost);
      
      // Position initiale
      const offsetX = e.clientX - element.getBoundingClientRect().left;
      const offsetY = e.clientY - element.getBoundingClientRect().top;
      
      // Déplacer le fantôme avec la souris
      const moveGhost = (moveEvent) => {
        ghost.style.left = (moveEvent.clientX - offsetX) + 'px';
        ghost.style.top = (moveEvent.clientY - offsetY) + 'px';
      };
      
      // Gérer le dépôt du noeud
      const dropGhost = (dropEvent) => {
        document.removeEventListener('mousemove', moveGhost);
        document.removeEventListener('mouseup', dropGhost);
        
        // Calculer la position dans le canvas
        const rect = this.canvas.getBoundingClientRect();
        if (
          dropEvent.clientX > rect.left && dropEvent.clientX < rect.right &&
          dropEvent.clientY > rect.top && dropEvent.clientY < rect.bottom
        ) {
          // Calculer le centre de la vue visible du canvas
          // On ne veut pas utiliser des coordonnées fixes mais plutôt le centre réel de la vue actuelle
          
          // Calculer le centre de la vue visible actuelle dans les coordonnées du canvas
          const containerRect = this.container.getBoundingClientRect();
          const containerCenterX = containerRect.width / 2;
          const containerCenterY = containerRect.height / 2;
          
          // Convertir les coordonnées du conteneur en coordonnées du canvas
          // en tenant compte du zoom et de l'offset actuels
          const canvasCenterX = (containerCenterX - this.offset.x) / this.scale;
          const canvasCenterY = (containerCenterY - this.offset.y) / this.scale;
          
          // Arrondir à la grille si nécessaire
          const nodeX = this.options.snapToGrid 
            ? Math.round(canvasCenterX / this.options.gridSize) * this.options.gridSize
            : canvasCenterX;
            
          const nodeY = this.options.snapToGrid
            ? Math.round(canvasCenterY / this.options.gridSize) * this.options.gridSize
            : canvasCenterY;
          
          console.log(`[Workflow] Ajout d'un nœud de type ${nodeType} au centre de la vue (${nodeX}, ${nodeY})`);
          
          // Ajouter le nœud au centre de la vue avec animation
          const node = this.addNode(nodeType, { x: nodeX, y: nodeY }, true);
          
          // Centrer la vue sur le nouveau nœud pour s'assurer qu'il est bien visible
          this.centerCanvas({ x: nodeX, y: nodeY }, true);
        }
        
        // Supprimer le fantôme
        ghost.remove();
      };
      
      // Ajouter les événements
      document.addEventListener('mousemove', moveGhost);
      document.addEventListener('mouseup', dropGhost);
      
      // Positionner le fantôme initialement
      moveGhost(e);
    });
  }
  
  /**
   * Ajoute un noeud au workflow
   * @param {string} type - Type de noeud
   * @param {Object} position - Position du noeud { x, y }
   * @param {boolean} animate - Indique si l'ajout doit être animé
   * @returns {Object} Le noeud créé
   */
  addNode(type, position = { x: 100, y: 100 }, animate = false) {
    // Convertir position à la grille si nécessaire
    if (this.options.snapToGrid) {
      position.x = Math.round(position.x / this.options.gridSize) * this.options.gridSize;
      position.y = Math.round(position.y / this.options.gridSize) * this.options.gridSize;
    }
    
    // Créer l'objet du noeud
    const nodeId = `node_${this.nextNodeId++}`;
    const nodeConfig = this.getNodeConfig(type);
    
    const node = {
      id: nodeId,
      type: type,
      label: nodeConfig.label || type,
      position: position,
      width: 180,
      height: 100,
      inputs: nodeConfig.inputs || [],
      outputs: nodeConfig.outputs || [],
      data: {}
    };
    
    // Ajouter le noeud à la liste
    this.nodes.push(node);
    
    // Créer l'élément DOM
    this.createNodeElement(node);
    
    // Ajouter un effet visuel d'apparition si l'animation est activée
    if (animate) {
      const nodeElement = document.getElementById(node.id);
      if (nodeElement) {
        // Appliquer un effet de fade in et de scale
        nodeElement.style.opacity = '0';
        nodeElement.style.transform = 'scale(0.8)';
        
        // Force un repaint avant de démarrer l'animation
        requestAnimationFrame(() => {
          nodeElement.style.transition = 'opacity 0.3s ease-out, transform 0.3s ease-out';
          nodeElement.style.opacity = '1';
          nodeElement.style.transform = 'scale(1)';
          
          // Nettoyer après l'animation
          setTimeout(() => {
            nodeElement.style.transition = '';
          }, 300);
        });
      }
    }
    
    // Émettre l'événement
    this.emit('nodeAdded', node);
    this.emit('workflowChanged', { nodes: this.nodes, edges: this.edges });
    
    // Sélectionner le nouveau noeud
    this.selectNode(nodeId);
    
    return node;
  }
  
  /**
   * Obtient la configuration pour un type de noeud
   * @param {string} type - Type de noeud
   * @returns {Object} Configuration du noeud
   */
  getNodeConfig(type) {
    // Configurations par défaut pour les différents types de noeuds
    const configs = {
      'hl7-input': {
        label: 'Entrée HL7',
        inputs: [],
        outputs: [{ name: 'message', label: 'Message' }]
      },
      'json-input': {
        label: 'Entrée JSON',
        inputs: [],
        outputs: [{ name: 'json', label: 'JSON' }]
      },
      'file-input': {
        label: 'Entrée fichier',
        inputs: [],
        outputs: [{ name: 'content', label: 'Contenu' }]
      },
      'segment-extractor': {
        label: 'Extraire segment',
        inputs: [{ name: 'message', label: 'Message' }],
        outputs: [{ name: 'segment', label: 'Segment' }]
      },
      'field-mapper': {
        label: 'Mapper champs',
        inputs: [{ name: 'input', label: 'Entrée' }],
        outputs: [{ name: 'output', label: 'Sortie' }]
      },
      'condition': {
        label: 'Condition',
        inputs: [{ name: 'value', label: 'Valeur' }],
        outputs: [
          { name: 'true', label: 'Vrai' },
          { name: 'false', label: 'Faux' }
        ]
      },
      'transform': {
        label: 'Transformer',
        inputs: [{ name: 'input', label: 'Entrée' }],
        outputs: [{ name: 'output', label: 'Sortie' }]
      },
      'fhir-converter': {
        label: 'Convertir FHIR',
        inputs: [{ name: 'hl7', label: 'HL7' }],
        outputs: [{ name: 'fhir', label: 'FHIR' }]
      },
      'template': {
        label: 'Template JSON',
        inputs: [{ name: 'data', label: 'Données' }],
        outputs: [{ name: 'result', label: 'Résultat' }]
      },
      'custom-script': {
        label: 'Script JS',
        inputs: [{ name: 'input', label: 'Entrée' }],
        outputs: [{ name: 'output', label: 'Sortie' }]
      },
      'fhir-output': {
        label: 'Sortie FHIR',
        inputs: [{ name: 'fhir', label: 'FHIR' }],
        outputs: []
      },
      'api-call': {
        label: 'Appel API',
        inputs: [{ name: 'data', label: 'Données' }],
        outputs: [{ name: 'response', label: 'Réponse' }]
      },
      'file-output': {
        label: 'Sortie fichier',
        inputs: [{ name: 'content', label: 'Contenu' }],
        outputs: []
      }
    };
    
    return configs[type] || { label: type, inputs: [], outputs: [] };
  }
  
  /**
   * Crée l'élément DOM pour un noeud
   * @param {Object} node - Noeud à créer
   */
  createNodeElement(node) {
    const nodeElement = document.createElement('div');
    nodeElement.id = node.id;
    nodeElement.className = 'node';
    nodeElement.style.left = `${node.position.x}px`;
    nodeElement.style.top = `${node.position.y}px`;
    nodeElement.style.width = `${node.width}px`;
    
    // En-tête du noeud
    const nodeHeader = document.createElement('div');
    nodeHeader.className = 'node-header';
    
    const nodeTitle = document.createElement('div');
    nodeTitle.className = 'node-title';
    nodeTitle.textContent = node.label;
    
    const nodeType = document.createElement('div');
    nodeType.className = 'node-type';
    nodeType.textContent = node.type;
    
    nodeHeader.appendChild(nodeTitle);
    nodeHeader.appendChild(nodeType);
    nodeElement.appendChild(nodeHeader);
    
    // Ajouter une poignée de redimensionnement
    const resizeHandle = document.createElement('div');
    resizeHandle.className = 'resize-handle';
    nodeElement.appendChild(resizeHandle);
    
    // Gérer le redimensionnement via la poignée
    resizeHandle.addEventListener('mousedown', (e) => {
      e.stopPropagation();
      e.preventDefault();
      
      const startX = e.clientX;
      const startY = e.clientY;
      const startWidth = nodeElement.offsetWidth;
      const startHeight = nodeElement.offsetHeight;
      
      const mousemove = (moveEvent) => {
        const dx = moveEvent.clientX - startX;
        const dy = moveEvent.clientY - startY;
        
        const newWidth = Math.max(150, startWidth + dx);
        const newHeight = Math.max(100, startHeight + dy);
        
        nodeElement.style.width = `${newWidth}px`;
        nodeElement.style.height = `${newHeight}px`;
        
        // Mettre à jour les dimensions dans l'objet nœud
        node.width = newWidth;
        node.height = newHeight;
        
        // Mettre à jour les connexions
        this.updateEdges();
      };
      
      const mouseup = () => {
        document.removeEventListener('mousemove', mousemove);
        document.removeEventListener('mouseup', mouseup);
        this.emit('workflowChanged', { nodes: this.nodes, edges: this.edges });
      };
      
      document.addEventListener('mousemove', mousemove);
      document.addEventListener('mouseup', mouseup);
    });
    
    // Rendre le nœud déplaçable par son en-tête
    this.makeElementDraggable(nodeElement, nodeHeader);
    
    // Corps du noeud
    const nodeBody = document.createElement('div');
    nodeBody.className = 'node-body';
    
    // Entrées
    if (node.inputs.length > 0) {
      const inputsContainer = document.createElement('div');
      inputsContainer.className = 'node-inputs';
      
      node.inputs.forEach((input, index) => {
        const portElement = document.createElement('div');
        portElement.className = 'node-port node-input';
        portElement.setAttribute('data-port-index', index);
        portElement.setAttribute('data-port-type', 'input');
        
        const portHandle = document.createElement('div');
        portHandle.className = 'port-handle';
        
        const portLabel = document.createElement('div');
        portLabel.className = 'port-label';
        portLabel.textContent = input.label;
        
        portElement.appendChild(portHandle);
        portElement.appendChild(portLabel);
        inputsContainer.appendChild(portElement);
        
        // Ajouter l'événement pour la connexion d'arêtes
        portHandle.addEventListener('mousedown', (e) => {
          e.stopPropagation();
          
          // Pour les ports d'entrée, nous autorisons aussi de commencer une connexion,
          // mais nous cherchons les ports de sortie comme cibles
          this.sourceNodeId = node.id;
          this.sourcePortIndex = index;
          this.isCreatingEdge = true;
          this.isInputPortSource = true; // Marquer qu'on part d'une entrée
          
          this.createTempEdge();
          
          const rect = portHandle.getBoundingClientRect();
          const canvasRect = this.canvas.getBoundingClientRect();
          const startX = rect.left + rect.width / 2 - canvasRect.left;
          const startY = rect.top + rect.height / 2 - canvasRect.top;
          
          this.updateTempEdge({ clientX: e.clientX, clientY: e.clientY });
          
          // Ajouter l'événement pour suivre la fin de l'arête
          const mousemove = (moveEvent) => {
            this.updateTempEdge(moveEvent);
          };
          
          const mouseup = (upEvent) => {
            document.removeEventListener('mousemove', mousemove);
            document.removeEventListener('mouseup', mouseup);
            
            // Vérifier si nous avons relâché sur un port de sortie
            const target = document.elementFromPoint(upEvent.clientX, upEvent.clientY);
            if (target && target.classList.contains('port-handle')) {
              const targetPort = target.closest('.node-port');
              
              if (targetPort && targetPort.getAttribute('data-port-type') === 'output') {
                const targetNode = targetPort.closest('.node');
                if (targetNode && targetNode.id !== node.id) {
                  const targetPortIndex = parseInt(targetPort.getAttribute('data-port-index'));
                  
                  // Créer l'arête (en inversant source et target car on part d'une entrée)
                  this.createEdge(
                    targetNode.id,
                    this.sourceNodeId,
                    targetPortIndex,
                    this.sourcePortIndex
                  );
                  
                  // Feedback visuel
                  this.showNotification('Connexion établie', 'success');
                }
              }
            }
            
            // S'assurer que tous les surlignages sont nettoyés
            this.clearPortHighlights();
            this.removeTempEdge();
            this.isCreatingEdge = false;
            this.sourceNodeId = null;
            this.sourcePortIndex = null;
            this.isInputPortSource = false;
          };
          
          document.addEventListener('mousemove', mousemove);
          document.addEventListener('mouseup', mouseup);
        });
      });
      
      nodeBody.appendChild(inputsContainer);
    }
    
    // Sorties
    if (node.outputs.length > 0) {
      const outputsContainer = document.createElement('div');
      outputsContainer.className = 'node-outputs';
      
      node.outputs.forEach((output, index) => {
        const portElement = document.createElement('div');
        portElement.className = 'node-port node-output';
        portElement.setAttribute('data-port-index', index);
        portElement.setAttribute('data-port-type', 'output');
        
        const portLabel = document.createElement('div');
        portLabel.className = 'port-label';
        portLabel.textContent = output.label;
        
        const portHandle = document.createElement('div');
        portHandle.className = 'port-handle';
        
        portElement.appendChild(portLabel);
        portElement.appendChild(portHandle);
        outputsContainer.appendChild(portElement);
        
        // Ajouter l'événement pour la création d'arêtes
        portHandle.addEventListener('mousedown', (e) => {
          e.stopPropagation();
          
          this.sourceNodeId = node.id;
          this.sourcePortIndex = index;
          this.isCreatingEdge = true;
          
          this.createTempEdge();
          
          const rect = portHandle.getBoundingClientRect();
          const canvasRect = this.canvas.getBoundingClientRect();
          const startX = rect.left + rect.width / 2 - canvasRect.left;
          const startY = rect.top + rect.height / 2 - canvasRect.top;
          
          this.updateTempEdge({ clientX: e.clientX, clientY: e.clientY });
          
          // Ajouter l'événement pour suivre la fin de l'arête
          const mousemove = (moveEvent) => {
            this.updateTempEdge(moveEvent);
          };
          
          const mouseup = (upEvent) => {
            document.removeEventListener('mousemove', mousemove);
            document.removeEventListener('mouseup', mouseup);
            
            // Vérifier si l'événement a bien été initié avec les données requises
            if (!this.sourceNodeId || this.sourcePortIndex === null) {
              console.warn("[Workflow] Impossible de créer l'arête: informations source incomplètes");
              this.clearPortHighlights();
              this.removeTempEdge();
              this.isCreatingEdge = false;
              this.sourceNodeId = null;
              this.sourcePortIndex = null;
              return;
            }
            
            // Vérifier si nous avons relâché sur un port d'entrée
            const target = document.elementFromPoint(upEvent.clientX, upEvent.clientY);
            if (target && target.classList.contains('port-handle')) {
              const targetPort = target.closest('.node-port');
              
              if (targetPort && targetPort.getAttribute('data-port-type') === 'input') {
                const targetNode = targetPort.closest('.node');
                if (targetNode && targetNode.id !== node.id) {
                  const targetPortIndex = parseInt(targetPort.getAttribute('data-port-index'));
                  
                  // Vérifier que les identifiants sont valides
                  if (this.sourceNodeId && targetNode.id) {
                    console.log(`[Workflow] Tentative de création d'arête: source=${this.sourceNodeId}, cible=${targetNode.id}, sourcePort=${this.sourcePortIndex}, targetPort=${targetPortIndex}`);
                    
                    // Créer l'arête
                    const newEdge = this.createEdge(
                      this.sourceNodeId,
                      targetNode.id,
                      this.sourcePortIndex,
                      targetPortIndex
                    );
                    
                    if (newEdge) {
                      // Feedback visuel
                      this.showNotification('Connexion établie', 'success');
                    } else {
                      this.showNotification('Échec de la connexion', 'error');
                    }
                  } else {
                    console.warn(`[Workflow] Identifiants de nœuds invalides: source=${this.sourceNodeId}, cible=${targetNode.id}`);
                  }
                }
              }
            }
            
            // S'assurer que tous les surlignages sont nettoyés
            this.clearPortHighlights();
            this.removeTempEdge();
            this.isCreatingEdge = false;
            this.sourceNodeId = null;
            this.sourcePortIndex = null;
          };
          
          document.addEventListener('mousemove', mousemove);
          document.addEventListener('mouseup', mouseup);
        });
      });
      
      nodeBody.appendChild(outputsContainer);
    }
    
    nodeElement.appendChild(nodeBody);
    
    // Événements du noeud
    nodeElement.addEventListener('mousedown', (e) => {
      if (e.target === nodeHeader || e.target === nodeTitle || e.target === nodeType) {
        // Dragging du noeud
        e.stopPropagation();
        
        // Ajouter une classe pour indiquer le déplacement en cours
        nodeElement.classList.add('dragging');
        
        // Mémoriser les positions initiales
        const startX = e.clientX;
        const startY = e.clientY;
        const startLeft = node.position.x;
        const startTop = node.position.y;
        
        // Collecter les arêtes connectées à ce nœud pour optimiser les mises à jour
        const connectedEdges = this.edges.filter(edge => 
          edge.source === node.id || edge.target === node.id
        );
        
        // Utiliser requestAnimationFrame pour limiter les mises à jour
        let animationFrameId = null;
        let lastX = startLeft;
        let lastY = startTop;
        
        const mousemove = (moveEvent) => {
          // Calculer la nouvelle position
          const dx = (moveEvent.clientX - startX) / this.scale;
          const dy = (moveEvent.clientY - startY) / this.scale;
          
          let newX = startLeft + dx;
          let newY = startTop + dy;
          
          // Snap to grid si nécessaire
          if (this.options.snapToGrid) {
            newX = Math.round(newX / this.options.gridSize) * this.options.gridSize;
            newY = Math.round(newY / this.options.gridSize) * this.options.gridSize;
          }
          
          // Annuler la dernière animation si elle est encore en attente
          if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
          }
          
          // Utiliser requestAnimationFrame pour optimiser les performances
          animationFrameId = requestAnimationFrame(() => {
            // Mettre à jour la position du noeud
            node.position.x = newX;
            node.position.y = newY;
            nodeElement.style.left = `${newX}px`;
            nodeElement.style.top = `${newY}px`;
            
            // Mettre à jour uniquement les arêtes connectées à ce nœud
            connectedEdges.forEach(edge => {
              // Marquer l'arête comme étant en cours de déplacement
              edge.pathChanged = (Math.abs(lastX - newX) > 5 || Math.abs(lastY - newY) > 5);
              this.updateEdgePath(edge);
            });
            
            lastX = newX;
            lastY = newY;
            
            // Émettre l'événement
            this.emit('nodePositionChanged', node);
            
            // Réinitialiser l'ID d'animation
            animationFrameId = null;
          });
        };
        
        const mouseup = () => {
          // Retirer l'indication de déplacement
          nodeElement.classList.remove('dragging');
          
          // Nettoyer les écouteurs d'événements
          document.removeEventListener('mousemove', mousemove);
          document.removeEventListener('mouseup', mouseup);
          
          // Annuler toute animation en cours
          if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
          }
          
          // Mettre à jour toutes les arêtes une fois à la fin du déplacement
          this.updateEdges();
          
          // Émettre l'événement de changement
          this.emit('workflowChanged', { nodes: this.nodes, edges: this.edges });
        };
        
        document.addEventListener('mousemove', mousemove);
        document.addEventListener('mouseup', mouseup);
      }
    });
    
    // Sélection du noeud
    nodeElement.addEventListener('click', (e) => {
      e.stopPropagation();
      this.selectNode(node.id);
      this.openNodeProperties(node.id);
    });
    
    this.nodesLayer.appendChild(nodeElement);
  }
  
  /**
   * Sélectionne un noeud
   * @param {string} nodeId - ID du noeud à sélectionner
   */
  selectNode(nodeId) {
    // Désélectionner le noeud précédemment sélectionné
    if (this.selectedNodeId) {
      const prevNode = document.getElementById(this.selectedNodeId);
      if (prevNode) {
        prevNode.classList.remove('selected');
      }
    }
    
    // Désélectionner l'arête précédemment sélectionnée
    if (this.selectedEdgeId) {
      const prevEdge = document.getElementById(this.selectedEdgeId);
      if (prevEdge) {
        prevEdge.classList.remove('selected');
      }
      this.selectedEdgeId = null;
    }
    
    // Sélectionner le nouveau noeud
    this.selectedNodeId = nodeId;
    const node = document.getElementById(nodeId);
    if (node) {
      node.classList.add('selected');
      this.emit('nodeSelected', this.getNodeById(nodeId));
    }
  }
  
  /**
   * Supprime un noeud
   * @param {string} nodeId - ID du noeud à supprimer
   */
  deleteNode(nodeId) {
    // Supprimer les arêtes connectées à ce noeud
    const connectedEdges = this.edges.filter(
      edge => edge.source === nodeId || edge.target === nodeId
    );
    
    connectedEdges.forEach(edge => {
      this.deleteEdge(edge.id);
    });
    
    // Supprimer le noeud de la liste
    const nodeIndex = this.nodes.findIndex(node => node.id === nodeId);
    if (nodeIndex !== -1) {
      const node = this.nodes[nodeIndex];
      this.nodes.splice(nodeIndex, 1);
      
      // Supprimer l'élément DOM
      const nodeElement = document.getElementById(nodeId);
      if (nodeElement) {
        nodeElement.remove();
      }
      
      // Désélectionner le noeud si c'était celui sélectionné
      if (this.selectedNodeId === nodeId) {
        this.selectedNodeId = null;
        this.propertiesPanel.classList.remove('open');
      }
      
      // Émettre l'événement
      this.emit('nodeRemoved', node);
      this.emit('workflowChanged', { nodes: this.nodes, edges: this.edges });
    }
  }
  
  /**
   * Crée une arête entre deux noeuds
   * @param {string} sourceId - ID du noeud source
   * @param {string} targetId - ID du noeud cible
   * @param {number} sourceOutput - Index de la sortie du noeud source
   * @param {number} targetInput - Index de l'entrée du noeud cible
   * @returns {Object|null} L'arête créée ou null si l'arête ne peut pas être créée
   */
  createEdge(sourceId, targetId, sourceOutput = 0, targetInput = 0) {
    // Vérifier que les nœuds source et cible existent
    const sourceNode = this.getNodeById(sourceId);
    const targetNode = this.getNodeById(targetId);
    
    if (!sourceNode || !targetNode) {
      console.warn(`[Workflow] Impossible de créer l'arête: nœuds manquants (source: ${sourceId}, target: ${targetId})`);
      return null;
    }
    
    // Vérifier si une arête similaire existe déjà
    const existingEdge = this.edges.find(
      edge => edge.source === sourceId && 
              edge.target === targetId && 
              edge.sourceOutput === sourceOutput &&
              edge.targetInput === targetInput
    );
    
    if (existingEdge) {
      return existingEdge;
    }
    
    // Créer l'objet de l'arête
    const edgeId = `edge_${this.nextEdgeId++}`;
    const edge = {
      id: edgeId,
      source: sourceId,
      target: targetId,
      sourceOutput: sourceOutput,
      targetInput: targetInput
    };
    
    // Ajouter l'arête à la liste
    this.edges.push(edge);
    
    // Vérifier que les éléments DOM des nœuds existent
    const sourceElement = document.getElementById(sourceId);
    const targetElement = document.getElementById(targetId);
    
    if (!sourceElement || !targetElement) {
      console.warn(`[Workflow] Les éléments DOM des nœuds n'existent pas encore, l'arête sera créée mais sans mise à jour visuelle immédiate`);
    } else {
      // Mettre à jour les ports pour ajouter la classe connected
      const sourcePort = sourceElement.querySelector(`.node-output[data-port-index="${sourceOutput}"] .port-handle`);
      const targetPort = targetElement.querySelector(`.node-input[data-port-index="${targetInput}"] .port-handle`);
      
      if (sourcePort && targetPort) {
        sourcePort.classList.add('connected');
        targetPort.classList.add('connected');
      }
    }
    
    // Créer l'élément DOM
    const edgeElement = this.createEdgeElement(edge);
    
    // Si l'élément DOM a été créé avec succès, émettre l'événement
    if (edgeElement) {
      this.emit('edgeAdded', edge);
      this.emit('workflowChanged', { nodes: this.nodes, edges: this.edges });
    }
    
    return edge;
  }
  
  /**
   * Crée l'élément DOM pour une arête
   * @param {Object} edge - Arête à créer
   * @returns {HTMLElement|null} L'élément créé ou null si l'arête ne peut pas être créée
   */
  createEdgeElement(edge) {
    // Vérifier que les nœuds source et cible existent avant de créer l'arête
    const sourceNode = this.getNodeById(edge.source);
    const targetNode = this.getNodeById(edge.target);
    
    if (!sourceNode || !targetNode) {
      console.warn(`[Workflow] Impossible de créer l'arête ${edge.id}: nœuds manquants (source: ${edge.source}, target: ${edge.target})`);
      return null;
    }
    
    // Vérifier que les éléments DOM des nœuds existent
    const sourceElement = document.getElementById(sourceNode.id);
    const targetElement = document.getElementById(targetNode.id);
    
    if (!sourceElement || !targetElement) {
      console.warn(`[Workflow] Impossible de créer l'arête ${edge.id}: éléments DOM des nœuds non trouvés`);
      return null;
    }
    
    // Créer l'élément d'arête
    const edgeElement = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    edgeElement.id = edge.id;
    edgeElement.setAttribute('class', 'edge');
    
    // Marquer l'arête comme "connectée" pour appliquer la couleur verte
    edgeElement.classList.add('connected');
    
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    // Initialiser avec la couleur verte et l'épaisseur cohérente avec le CSS
    path.setAttribute('stroke', '#4caf50');
    path.setAttribute('stroke-width', '3');
    path.setAttribute('fill', 'none');
    path.style.pointerEvents = 'auto';
    edgeElement.appendChild(path);
    
    // Ajouter l'événement pour la sélection
    edgeElement.addEventListener('click', (e) => {
      e.stopPropagation();
      this.selectEdge(edge.id);
    });
    
    this.edgesLayer.appendChild(edgeElement);
    
    // Positionner l'arête
    this.updateEdgePath(edge);
    
    return edgeElement;
  }
  
  /**
   * Met à jour le chemin d'une arête
   * @param {Object} edge - Arête à mettre à jour
   */
  updateEdgePath(edge) {
    try {
      // Validation de base des données d'arête
      if (!edge || !edge.source || !edge.target || typeof edge.sourceOutput === "undefined" || typeof edge.targetInput === "undefined") {
        console.warn("[Workflow] Arête mal formée:", edge);
        return;
      }
      
      // Récupérer les données des nœuds directement en utilisant getNodeById
      const sourceNode = this.getNodeById(edge.source);
      const targetNode = this.getNodeById(edge.target);
      
      if (!sourceNode || !targetNode) {
        console.warn("[Workflow] Nœuds non trouvés pour l'arête:", edge);
        return;
      }
      
      // Récupérer les positions des ports directement avec getPortPosition
      const sourcePortPosition = this.getPortPosition(sourceNode, true, edge.sourceOutput);
      const targetPortPosition = this.getPortPosition(targetNode, false, edge.targetInput);
      
      if (!sourcePortPosition || !targetPortPosition) {
        console.warn("[Workflow] Impossible de calculer les positions des ports");
        return;
      }
      
      // Marquer les ports visuellement comme connectés
      const sourceElement = document.getElementById(sourceNode.id);
      const targetElement = document.getElementById(targetNode.id);
      
      if (sourceElement && targetElement) {
        const sourcePortSelector = `.node-output[data-port-index="${edge.sourceOutput}"] .port-handle`;
        const targetPortSelector = `.node-input[data-port-index="${edge.targetInput}"] .port-handle`;
        
        const sourcePort = sourceElement.querySelector(sourcePortSelector);
        const targetPort = targetElement.querySelector(targetPortSelector);
        
        if (sourcePort) sourcePort.classList.add("connected");
        if (targetPort) targetPort.classList.add("connected");
      }
      
      // Calcul optimisé de la courbe de Bézier
      const dx = Math.abs(targetPortPosition.x - sourcePortPosition.x);
      const dy = Math.abs(targetPortPosition.y - sourcePortPosition.y);
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      // Ajustement adaptatif de la courbure en fonction de la distance
      const controlDistance = Math.max(50, Math.min(dx * 0.5, distance * 0.4));
      
      // Création du chemin SVG avec des points de contrôle optimaux
      const d = `M ${sourcePortPosition.x} ${sourcePortPosition.y} C ${sourcePortPosition.x + controlDistance} ${sourcePortPosition.y}, ${targetPortPosition.x - controlDistance} ${targetPortPosition.y}, ${targetPortPosition.x} ${targetPortPosition.y}`;
      
      // Récupérer ou créer l'élément DOM de l'arête
      let edgeElement = document.getElementById(edge.id);
      let path;
      
      if (edgeElement) {
        path = edgeElement.querySelector("path");
        if (path) {
          // Mettre à jour le chemin existant
          path.setAttribute("d", d);
          
          // Gérer l'animation selon l'état de l'arête
          if (!path.hasAttribute("data-length") || edge.pathChanged) {
            // Première initialisation ou changement significatif du chemin
            const length = path.getTotalLength();
            path.setAttribute("data-length", length);
            
            if (edge.isNew) {
              // Pour les nouvelles arêtes, configurer l'animation complète
              path.setAttribute("stroke-dasharray", length);
              path.setAttribute("stroke-dashoffset", length);
              
              // Forcer un repaint avant d'animer pour éviter les problèmes de timing
              requestAnimationFrame(() => {
                edge.isAnimating = true;
                path.style.transition = "stroke-dashoffset 0.4s ease-out";
                path.style.strokeDashoffset = "0";
                
                // Nettoyer les flags après l'animation
                setTimeout(() => {
                  edge.isNew = false;
                  edge.isAnimating = false;
                  edge.pathChanged = false;
                }, 400);
              });
            } else if (edge.isAnimating) {
              // Si déjà en animation, mettre à jour les paramètres sans réinitialiser
              path.setAttribute("stroke-dasharray", length);
            } else {
              // Pour les mises à jour normales (déplacement de nœud), transition plus subtile
              path.setAttribute("stroke-dasharray", "none");
              path.style.transition = "d 0.2s ease-out";
            }
          }
        }
      } else {
        // Créer un nouvel élément d'arête si nécessaire
        edge.isNew = true;
        this.createEdgeElement(edge);
      }
    } catch (err) {
      console.error("[Workflow] Erreur lors de la mise à jour de l'arête:", err, edge);
    }
  }
  
  /**
   * Calcule la position d'un port
   * @param {Object} node - Le nœud
   * @param {boolean} isOutput - Indique si c'est un port de sortie
   * @param {number} portIndex - Index du port
   * @returns {Object} Position du port { x, y }
   */
  getPortPosition(node, isOutput, portIndex) {
    try {
      if (!node || !node.position) {
        console.warn("[Workflow] Nœud sans position:", node);
        return null;
      }
      
      const nodeElem = document.getElementById(node.id);
      if (!nodeElem) {
        console.warn(`[Workflow] Élément DOM non trouvé pour le nœud: ${node.id}`);
        return null;
      }
      
      // Taille par défaut si non spécifiée
      const width = node.width || 200;
      const height = node.height || 100;
      
      const portSelector = isOutput 
        ? `.node-output[data-port-index="${portIndex}"] .port-handle` 
        : `.node-input[data-port-index="${portIndex}"] .port-handle`;
        
      const portElem = nodeElem.querySelector(portSelector);
      
      if (!portElem) {
        console.warn(`[Workflow] Port non trouvé: ${portSelector} sur nœud ${node.id}`);
        
        // Position de fallback calculée à partir de la position du nœud
        if (isOutput) {
          // Pour les ports de sortie, on les place à droite
          return {
            x: node.position.x + width,
            y: node.position.y + (height / 2) + (portIndex * 20)
          };
        } else {
          // Pour les ports d'entrée, on les place à gauche
          return {
            x: node.position.x,
            y: node.position.y + (height / 2) + (portIndex * 20)
          };
        }
      }
      
      // Obtenir les dimensions du port
      const portRect = portElem.getBoundingClientRect();
      const canvasRect = this.canvas.getBoundingClientRect();
      
      // Calculer la position relative du port par rapport au nœud
      const nodeRect = nodeElem.getBoundingClientRect();
      
      // Calculer la position relative du port par rapport au nœud
      const portRelativeX = portRect.left - nodeRect.left + (portRect.width / 2);
      const portRelativeY = portRect.top - nodeRect.top + (portRect.height / 2);
      
      // Calculer la position absolue du port en fonction de la position du nœud
      return {
        x: node.position.x + portRelativeX,
        y: node.position.y + portRelativeY
      };
    } catch (err) {
      console.error("[Workflow] Erreur lors du calcul de la position du port:", err);
      return null;
    }
  }
  
  /**
   * Sélectionne une arête
   * @param {string} edgeId - ID de l'arête à sélectionner
   */
  selectEdge(edgeId) {
    // Désélectionner l'arête précédemment sélectionnée
    if (this.selectedEdgeId) {
      const prevEdge = document.getElementById(this.selectedEdgeId);
      if (prevEdge) {
        prevEdge.classList.remove('selected');
      }
    }
    
    // Désélectionner le noeud précédemment sélectionné
    if (this.selectedNodeId) {
      const prevNode = document.getElementById(this.selectedNodeId);
      if (prevNode) {
        prevNode.classList.remove('selected');
      }
      this.selectedNodeId = null;
      this.propertiesPanel.classList.remove('open');
    }
    
    // Sélectionner la nouvelle arête
    this.selectedEdgeId = edgeId;
    const edge = document.getElementById(edgeId);
    if (edge) {
      edge.classList.add('selected');
      this.emit('edgeSelected', this.getEdgeById(edgeId));
    }
  }
  
  /**
   * Supprime une arête
   * @param {string} edgeId - ID de l'arête à supprimer
   */
  deleteEdge(edgeId) {
    const edgeIndex = this.edges.findIndex(edge => edge.id === edgeId);
    if (edgeIndex !== -1) {
      const edge = this.edges[edgeIndex];
      this.edges.splice(edgeIndex, 1);
      
      // Supprimer l'élément DOM
      const edgeElement = document.getElementById(edgeId);
      if (edgeElement) {
        edgeElement.remove();
      }
      
      // Mettre à jour les ports pour supprimer la classe connected
      const sourceNode = document.getElementById(edge.source);
      const targetNode = document.getElementById(edge.target);
      
      if (sourceNode && targetNode) {
        const sourcePort = sourceNode.querySelector(`.node-output[data-port-index="${edge.sourceOutput}"] .port-handle`);
        const targetPort = targetNode.querySelector(`.node-input[data-port-index="${edge.targetInput}"] .port-handle`);
        
        if (sourcePort) {
          // Vérifier si ce port a d'autres connexions
          const hasOtherConnections = this.edges.some(
            otherEdge => otherEdge.source === edge.source && otherEdge.sourceOutput === edge.sourceOutput
          );
          
          if (!hasOtherConnections) {
            sourcePort.classList.remove('connected');
          }
        }
        
        if (targetPort) {
          // Vérifier si ce port a d'autres connexions
          const hasOtherConnections = this.edges.some(
            otherEdge => otherEdge.target === edge.target && otherEdge.targetInput === edge.targetInput
          );
          
          if (!hasOtherConnections) {
            targetPort.classList.remove('connected');
          }
        }
      }
      
      // Désélectionner l'arête si c'était celle sélectionnée
      if (this.selectedEdgeId === edgeId) {
        this.selectedEdgeId = null;
      }
      
      // Émettre l'événement
      this.emit('edgeRemoved', edge);
      this.emit('workflowChanged', { nodes: this.nodes, edges: this.edges });
    }
  }
  
  /**
   * Crée une arête temporaire pendant le glisser-déposer
   */
  createTempEdge() {
    this.tempEdge = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    this.tempEdge.setAttribute('class', 'temp-edge');
    
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    this.tempEdge.appendChild(path);
    
    this.edgesLayer.appendChild(this.tempEdge);
  }
  
  /**
   * Met à jour la position de l'arête temporaire
   * @param {MouseEvent} e - Événement de la souris
   */
  updateTempEdge(e) {
    if (!this.tempEdge || !this.sourceNodeId) {
      return;
    }
    
    // 1. Utiliser directement getPortPosition pour le point de départ
    const sourceNodeData = this.getNodeById(this.sourceNodeId);
    if (!sourceNodeData) {
      return;
    }
    
    // Obtenir les coordonnées du port source dans le système de coordonnées du canvas
    const start = this.getPortPosition(
      sourceNodeData,
      !this.isInputPortSource, // true si port de sortie, false si entrée
      this.sourcePortIndex
    );
    
    if (!start) {
      console.warn("[Workflow] Impossible de déterminer la position du port source");
      return;
    }
    
    // 2. Convertir proprement les coordonnées de la souris en coordonnées canvas
    const rect = this.canvas.getBoundingClientRect();
    const end = {
      x: (e.clientX - rect.left - this.offset.x) / this.scale,
      y: (e.clientY - rect.top - this.offset.y) / this.scale
    };
    
    // 3. Calculer une courbe de Bézier élégante
    const dx = Math.abs(end.x - start.x);
    const controlDistance = Math.min(dx * 0.5, 100);
    
    // S'assurer que la chaîne reste sur une seule ligne pour éviter les problèmes de SVG
    const d = `M ${start.x} ${start.y} C ${start.x + controlDistance} ${start.y}, ${end.x - controlDistance} ${end.y}, ${end.x} ${end.y}`;
    
    // 4. Mettre à jour le chemin avec les attributs visuels
    const path = this.tempEdge.querySelector('path');
    if (path) {
      path.setAttribute('d', d);
      // S'assurer que le chemin temporaire est bien visible
      path.setAttribute('stroke', '#999');
      path.setAttribute('stroke-width', '2');
      path.setAttribute('stroke-dasharray', '5,5');
      path.setAttribute('fill', 'none');
    }
    
    // Désactiver la mise en évidence sur tous les ports
    this.clearPortHighlights();
    
    // Vérifier si nous survolons un port compatible et le mettre en évidence
    const target = document.elementFromPoint(e.clientX, e.clientY);
    if (target && target.classList.contains('port-handle')) {
      const targetPort = target.closest('.node-port');
      
      if (targetPort) {
        const targetNode = targetPort.closest('.node');
        if (targetNode && targetNode.id !== this.sourceNodeId) {
          // Si nous commençons par une entrée, chercher une sortie et vice versa
          const compatibleType = this.isInputPortSource ? 'output' : 'input';
          if (targetPort.getAttribute('data-port-type') === compatibleType) {
            target.classList.add('highlight');
          }
        }
      }
    }
  }
  
  /**
   * Nettoie les surlignages des ports
   */
  clearPortHighlights() {
    document.querySelectorAll('.port-handle.highlight').forEach(port => {
      port.classList.remove('highlight');
    });
  }
  
  /**
   * Supprime l'arête temporaire
   */
  removeTempEdge() {
    if (this.tempEdge) {
      this.tempEdge.remove();
      this.tempEdge = null;
    }
    // Nettoyer tous les surlignages de ports qui pourraient rester
    this.clearPortHighlights();
  }
  
  /**
   * Met à jour toutes les arêtes du workflow
   */
  updateEdges() {
    // Utiliser requestAnimationFrame pour améliorer la performance
    if (this.edgesUpdateScheduled) {
      return;
    }
    
    this.edgesUpdateScheduled = true;
    
    requestAnimationFrame(() => {
      this.edges.forEach(edge => {
        this.updateEdgePath(edge);
      });
      this.edgesUpdateScheduled = false;
    });
  }
  
  /**
   * Ouvre le panneau de propriétés pour un noeud
   * @param {string} nodeId - ID du noeud
   */
  openNodeProperties(nodeId) {
    const node = this.getNodeById(nodeId);
    if (!node) {
      return;
    }
    
    // Titre du panneau
    document.getElementById('properties-title').textContent = `Propriétés: ${node.label}`;
    
    // Contenu du panneau
    this.propertiesContent.innerHTML = '';
    
    // Groupe d'informations générales
    const infoGroup = document.createElement('div');
    infoGroup.className = 'property-group';
    
    const infoTitle = document.createElement('h4');
    infoTitle.textContent = 'Informations';
    infoGroup.appendChild(infoTitle);
    
    // Type du noeud (non modifiable)
    const typeRow = document.createElement('div');
    typeRow.className = 'property-row';
    
    const typeLabel = document.createElement('label');
    typeLabel.className = 'property-label';
    typeLabel.textContent = 'Type';
    
    const typeInput = document.createElement('input');
    typeInput.type = 'text';
    typeInput.className = 'property-input';
    typeInput.value = node.type;
    typeInput.disabled = true;
    
    typeRow.appendChild(typeLabel);
    typeRow.appendChild(typeInput);
    infoGroup.appendChild(typeRow);
    
    // Étiquette du noeud
    const labelRow = document.createElement('div');
    labelRow.className = 'property-row';
    
    const labelLabel = document.createElement('label');
    labelLabel.className = 'property-label';
    labelLabel.textContent = 'Étiquette';
    
    const labelInput = document.createElement('input');
    labelInput.type = 'text';
    labelInput.className = 'property-input';
    labelInput.value = node.label;
    labelInput.addEventListener('change', () => {
      node.label = labelInput.value;
      const nodeElement = document.getElementById(node.id);
      if (nodeElement) {
        nodeElement.querySelector('.node-title').textContent = node.label;
      }
      this.emit('workflowChanged', { nodes: this.nodes, edges: this.edges });
    });
    
    labelRow.appendChild(labelLabel);
    labelRow.appendChild(labelInput);
    infoGroup.appendChild(labelRow);
    
    // Note informative sur le redimensionnement
    const noteRow = document.createElement('div');
    noteRow.className = 'property-row';
    noteRow.style.fontSize = '12px';
    noteRow.style.fontStyle = 'italic';
    noteRow.style.color = '#888';
    noteRow.style.margin = '5px 0';
    noteRow.textContent = 'Utilisez la souris pour redimensionner le nœud en tirant depuis son coin inférieur droit.';
    infoGroup.appendChild(noteRow);
    
    this.propertiesContent.appendChild(infoGroup);
    
    // Groupe de configuration spécifique au type de noeud
    const configGroup = document.createElement('div');
    configGroup.className = 'property-group';
    
    const configTitle = document.createElement('h4');
    configTitle.textContent = 'Configuration';
    configGroup.appendChild(configTitle);
    
    // Initialiser les données du nœud si elles n'existent pas
    if (!node.data) {
      node.data = {};
    }
    
    // Récupérer les champs de configuration pour ce type de nœud
    const configFields = this.getNodeConfigFields(node.type);
    
    // Si aucun champ de configuration n'est défini, afficher un message
    if (configFields.length === 0) {
      const messageRow = document.createElement('div');
      messageRow.className = 'property-row';
      messageRow.style.fontStyle = 'italic';
      messageRow.style.color = '#888';
      messageRow.textContent = 'Aucune configuration spécifique pour ce type de nœud.';
      configGroup.appendChild(messageRow);
    } else {
      // Créer un champ de configuration pour chaque propriété
      configFields.forEach(field => {
        const fieldRow = document.createElement('div');
        fieldRow.className = 'property-row';
        
        const fieldLabel = document.createElement('label');
        fieldLabel.className = 'property-label';
        fieldLabel.textContent = field.label;
        
        let fieldInput;
        
        // Créer le contrôle approprié selon le type de champ
        switch (field.type) {
          case 'select':
            fieldInput = document.createElement('select');
            fieldInput.className = 'property-input';
            
            // Ajouter les options au select
            field.options.forEach(option => {
              const optionElement = document.createElement('option');
              optionElement.value = option.value;
              optionElement.textContent = option.label;
              
              // Sélectionner l'option si elle correspond à la valeur actuelle
              if (node.data[field.name] === option.value) {
                optionElement.selected = true;
              }
              
              fieldInput.appendChild(optionElement);
            });
            
            // Si aucune valeur n'est définie, utiliser la valeur par défaut
            if (node.data[field.name] === undefined && field.default !== undefined) {
              node.data[field.name] = field.default;
              fieldInput.value = field.default;
            }
            break;
            
          case 'textarea':
            fieldInput = document.createElement('textarea');
            fieldInput.className = 'property-input';
            fieldInput.style.minHeight = '80px';
            fieldInput.value = node.data[field.name] !== undefined ? node.data[field.name] : (field.default || '');
            break;
            
          case 'checkbox':
            fieldInput = document.createElement('input');
            fieldInput.type = 'checkbox';
            fieldInput.className = 'property-checkbox';
            fieldInput.checked = node.data[field.name] !== undefined ? node.data[field.name] : (field.default || false);
            break;
            
          default: // text par défaut
            fieldInput = document.createElement('input');
            fieldInput.type = 'text';
            fieldInput.className = 'property-input';
            fieldInput.value = node.data[field.name] !== undefined ? node.data[field.name] : (field.default || '');
        }
        
        // Ajouter une infobulle si une description est fournie
        if (field.description) {
          fieldInput.title = field.description;
          
          // Ajouter un icône d'information
          const infoIcon = document.createElement('span');
          infoIcon.textContent = ' ℹ️';
          infoIcon.title = field.description;
          infoIcon.style.cursor = 'help';
          fieldLabel.appendChild(infoIcon);
        }
        
        // Ajouter l'événement de changement
        fieldInput.addEventListener('change', () => {
          // Récupérer la valeur appropriée selon le type de champ
          let value;
          
          if (field.type === 'checkbox') {
            value = fieldInput.checked;
          } else if (field.type === 'select') {
            value = fieldInput.value;
          } else {
            value = fieldInput.value;
          }
          
          // Mettre à jour les données du nœud
          node.data[field.name] = value;
          
          // Émettre l'événement de changement
          this.emit('workflowChanged', { nodes: this.nodes, edges: this.edges });
        });
        
        fieldRow.appendChild(fieldLabel);
        fieldRow.appendChild(fieldInput);
        configGroup.appendChild(fieldRow);
      });
    }
    
    // Boutons d'action spécifiques au type de nœud
    const actionButtons = this.getNodeActionButtons(node.type);
    if (actionButtons.length > 0) {
      const actionGroup = document.createElement('div');
      actionGroup.className = 'property-group';
      
      const actionTitle = document.createElement('h4');
      actionTitle.textContent = 'Actions';
      actionGroup.appendChild(actionTitle);
      
      actionButtons.forEach(button => {
        const actionBtn = document.createElement('button');
        actionBtn.className = 'action-btn';
        actionBtn.textContent = button.label;
        actionBtn.title = button.description || '';
        actionBtn.style.margin = '5px';
        actionBtn.style.padding = '8px 12px';
        
        // Appliquer des styles spécifiques selon le type de bouton
        if (button.type === 'primary') {
          actionBtn.style.backgroundColor = '#4CAF50';
          actionBtn.style.color = 'white';
        } else if (button.type === 'danger') {
          actionBtn.style.backgroundColor = '#f44336';
          actionBtn.style.color = 'white';
        }
        
        actionBtn.addEventListener('click', () => {
          if (typeof button.action === 'function') {
            button.action(node);
          }
        });
        
        actionGroup.appendChild(actionBtn);
      });
      
      this.propertiesContent.appendChild(actionGroup);
    }
    
    this.propertiesContent.appendChild(configGroup);
    
    // Afficher le panneau
    this.propertiesPanel.classList.add('open');
  }
  
  /**
   * Obtient les champs de configuration pour un type de nœud spécifique
   * @param {string} nodeType - Type de nœud
   * @returns {Array} Tableau de champs de configuration
   */
  getNodeConfigFields(nodeType) {
    // Configuration par défaut pour les différents types de nœuds
    const configs = {
      'hl7-input': [
        {
          name: 'source',
          label: 'Source',
          type: 'select',
          options: [
            { value: 'manual', label: 'Saisie manuelle' },
            { value: 'file', label: 'Fichier' },
            { value: 'api', label: 'API' }
          ],
          default: 'manual',
          description: 'Source des messages HL7'
        },
        {
          name: 'exampleMessage',
          label: 'Message exemple',
          type: 'textarea',
          default: 'MSH|^~\\&|SENDING_APP|SENDING_FACILITY|RECEIVING_APP|RECEIVING_FACILITY|20230101000000||ADT^A01|MSG00001|P|2.5|',
          description: 'Message HL7 d\'exemple pour les tests'
        }
      ],
      'json-input': [
        {
          name: 'source',
          label: 'Source',
          type: 'select',
          options: [
            { value: 'manual', label: 'Saisie manuelle' },
            { value: 'file', label: 'Fichier' },
            { value: 'api', label: 'API' }
          ],
          default: 'manual'
        },
        {
          name: 'exampleData',
          label: 'Données exemple',
          type: 'textarea',
          default: '{\n  "patient": {\n    "id": "123",\n    "name": "Doe, John"\n  }\n}',
          description: 'Données JSON d\'exemple pour les tests'
        }
      ],
      'file-input': [
        {
          name: 'filePath',
          label: 'Chemin du fichier',
          type: 'text',
          default: './data/input.txt',
          description: 'Chemin relatif du fichier d\'entrée'
        },
        {
          name: 'format',
          label: 'Format',
          type: 'select',
          options: [
            { value: 'text', label: 'Texte' },
            { value: 'json', label: 'JSON' },
            { value: 'hl7', label: 'HL7' },
            { value: 'xml', label: 'XML' }
          ],
          default: 'text'
        }
      ],
      'segment-extractor': [
        {
          name: 'segmentType',
          label: 'Type de segment',
          type: 'text',
          default: 'PID',
          description: 'Code du segment HL7 à extraire (ex: MSH, PID, PV1)'
        },
        {
          name: 'extractAll',
          label: 'Extraire tous',
          type: 'checkbox',
          default: true,
          description: 'Extraire toutes les occurrences du segment'
        }
      ],
      'field-mapper': [
        {
          name: 'mappings',
          label: 'Mappings',
          type: 'textarea',
          default: '{\n  "PID-3": "Patient.identifier",\n  "PID-5": "Patient.name"\n}',
          description: 'Mappings au format JSON'
        },
        {
          name: 'keepUnmapped',
          label: 'Garder non mappés',
          type: 'checkbox',
          default: false,
          description: 'Conserver les champs non mappés dans le résultat'
        }
      ],
      'condition': [
        {
          name: 'expression',
          label: 'Expression',
          type: 'text',
          default: 'data.value === "test"',
          description: 'Expression JavaScript qui doit retourner true/false'
        }
      ],
      'transform': [
        {
          name: 'code',
          label: 'Code',
          type: 'textarea',
          default: 'return input.toUpperCase();',
          description: 'Code JavaScript de transformation'
        }
      ],
      'fhir-converter': [
        {
          name: 'targetFormat',
          label: 'Format cible',
          type: 'select',
          options: [
            { value: 'R4', label: 'FHIR R4' },
            { value: 'R5', label: 'FHIR R5' },
            { value: 'STU3', label: 'FHIR STU3' },
            { value: 'DSTU2', label: 'FHIR DSTU2' }
          ],
          default: 'R4'
        },
        {
          name: 'profile',
          label: 'Profil',
          type: 'text',
          default: '',
          description: 'URI du profil FHIR à utiliser (optionnel)'
        }
      ],
      'template': [
        {
          name: 'template',
          label: 'Template',
          type: 'textarea',
          default: '{\n  "resourceType": "Patient",\n  "id": "{{id}}",\n  "name": [{\n    "family": "{{familyName}}",\n    "given": ["{{givenName}}"]\n  }]\n}',
          description: 'Template JSON avec variables entre {{moustaches}}'
        }
      ],
      'custom-script': [
        {
          name: 'code',
          label: 'Code JavaScript',
          type: 'textarea',
          default: 'function processData(input) {\n  // Traitement personnalisé\n  return input;\n}\n\nreturn processData(input);',
          description: 'Code JavaScript personnalisé pour le traitement des données'
        }
      ],
      'fhir-output': [
        {
          name: 'destination',
          label: 'Destination',
          type: 'select',
          options: [
            { value: 'return', label: 'Retour API' },
            { value: 'file', label: 'Fichier' },
            { value: 'server', label: 'Serveur FHIR' }
          ],
          default: 'return'
        },
        {
          name: 'serverUrl',
          label: 'URL Serveur',
          type: 'text',
          default: 'https://hapi.fhir.org/baseR4',
          description: 'URL du serveur FHIR (si destination = server)'
        }
      ],
      'api-call': [
        {
          name: 'url',
          label: 'URL',
          type: 'text',
          default: 'https://api.example.com/endpoint',
          description: 'URL de l\'API à appeler'
        },
        {
          name: 'method',
          label: 'Méthode',
          type: 'select',
          options: [
            { value: 'GET', label: 'GET' },
            { value: 'POST', label: 'POST' },
            { value: 'PUT', label: 'PUT' },
            { value: 'DELETE', label: 'DELETE' }
          ],
          default: 'POST'
        },
        {
          name: 'headers',
          label: 'En-têtes',
          type: 'textarea',
          default: '{\n  "Content-Type": "application/json"\n}',
          description: 'En-têtes HTTP au format JSON'
        }
      ],
      'file-output': [
        {
          name: 'filePath',
          label: 'Chemin du fichier',
          type: 'text',
          default: './data/output.json',
          description: 'Chemin relatif où enregistrer le fichier'
        },
        {
          name: 'format',
          label: 'Format',
          type: 'select',
          options: [
            { value: 'json', label: 'JSON' },
            { value: 'xml', label: 'XML' },
            { value: 'text', label: 'Texte' }
          ],
          default: 'json'
        },
        {
          name: 'formatPretty',
          label: 'Formater',
          type: 'checkbox',
          default: true,
          description: 'Formater le fichier pour une meilleure lisibilité'
        }
      ]
    };
    
    return configs[nodeType] || [];
  }
  
  /**
   * Obtient les boutons d'action pour un type de nœud spécifique
   * @param {string} nodeType - Type de nœud
   * @returns {Array} Tableau de boutons d'action
   */
  getNodeActionButtons(nodeType) {
    // Actions par défaut pour les différents types de nœuds
    const actions = {
      'hl7-input': [
        {
          label: 'Tester la syntaxe',
          type: 'primary',
          description: 'Vérifier la syntaxe du message HL7',
          action: (node) => {
            // Simuler la validation du message HL7
            const message = node.data.exampleMessage || '';
            if (message.includes('MSH|') && message.includes('|')) {
              this.showNotification('Syntaxe valide', 'Le message HL7 a une syntaxe valide.', 'success');
            } else {
              this.showNotification('Erreur de syntaxe', 'Le message HL7 contient des erreurs de syntaxe.', 'error');
            }
          }
        }
      ],
      'file-input': [
        {
          label: 'Explorer',
          type: 'primary',
          description: 'Parcourir les fichiers disponibles',
          action: (node) => {
            this.showNotification('Explorateur de fichiers', 'Cette fonctionnalité sera disponible dans la version finale.', 'info');
          }
        }
      ],
      'fhir-converter': [
        {
          label: 'Vérifier',
          type: 'primary',
          description: 'Valider la configuration de conversion',
          action: (node) => {
            this.showNotification('Validation', 'La configuration de conversion est valide.', 'success');
          }
        }
      ],
      'api-call': [
        {
          label: 'Tester la connexion',
          type: 'primary',
          description: 'Vérifier la connexion à l\'API',
          action: (node) => {
            this.showNotification('Test de connexion', 'Cette fonctionnalité sera disponible dans la version finale.', 'info');
          }
        }
      ]
    };
    
    return actions[nodeType] || [];
  }
  
  /**
   * Affiche une notification
   * @param {string} title - Titre de la notification
   * @param {string} message - Message de la notification
   * @param {string} type - Type de la notification (info, success, warning, error)
   */
  showNotification(title, message, type = 'info') {
    // Créer l'élément de notification
    const notification = document.createElement('div');
    notification.className = `editor-notification ${type}`;
    
    const notificationTitle = document.createElement('div');
    notificationTitle.className = 'notification-title';
    notificationTitle.textContent = title;
    notificationTitle.style.fontWeight = 'bold';
    notificationTitle.style.marginBottom = '5px';
    
    const notificationMessage = document.createElement('div');
    notificationMessage.className = 'notification-message';
    notificationMessage.textContent = message;
    
    notification.appendChild(notificationTitle);
    notification.appendChild(notificationMessage);
    
    // Ajouter la notification au document
    document.body.appendChild(notification);
    
    // Afficher la notification
    setTimeout(() => {
      notification.classList.add('show');
    }, 10);
    
    // Supprimer la notification après un délai
    setTimeout(() => {
      notification.classList.remove('show');
      setTimeout(() => {
        notification.remove();
      }, 300);
    }, 5000);
  }
  
  /**
   * Rend un élément déplaçable
   * @param {HTMLElement} element - L'élément à rendre déplaçable
   * @param {HTMLElement} handle - L'élément servant de poignée pour le déplacement
   */
  makeElementDraggable(element, handle) {
    let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
    let isDragging = false;
    let animationFrameId = null;
    let elementId = element.id;
    let self = this; // Référence à l'instance WorkflowEditor
    
    // Utiliser will-change pour optimiser les performances de rendu
    element.style.willChange = 'transform';
    
    handle.onmousedown = dragMouseDown;
    
    function dragMouseDown(e) {
      e = e || window.event;
      e.preventDefault();
      
      // Position initiale du curseur
      pos3 = e.clientX;
      pos4 = e.clientY;
      
      // Indiquer que l'élément est en cours de déplacement
      isDragging = true;
      element.classList.add('dragging');
      
      // Configurer les gestionnaires d'événements
      document.onmouseup = closeDragElement;
      document.onmousemove = elementDrag;
      
      // Vérifier si l'élément est un nœud et stocker sa position initiale
      if (elementId && elementId.startsWith('node_')) {
        const node = self.getNodeById(elementId);
        if (node) {
          node.isDragging = true;
          node.initialDragPosition = { ...node.position };
        }
      }
    }
    
    function elementDrag(e) {
      e = e || window.event;
      e.preventDefault();
      
      if (!isDragging) return;
      
      // Annuler toute animation en cours
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
      
      // Calculer le déplacement
      pos1 = pos3 - e.clientX;
      pos2 = pos4 - e.clientY;
      pos3 = e.clientX;
      pos4 = e.clientY;
      
      // Utiliser requestAnimationFrame pour des animations plus fluides
      animationFrameId = requestAnimationFrame(() => {
        // Mettre à jour la position de l'élément avec transform pour de meilleures performances
        const newTop = element.offsetTop - pos2;
        const newLeft = element.offsetLeft - pos1;
        
        element.style.top = newTop + "px";
        element.style.left = newLeft + "px";
        
        // Si c'est un nœud, mettre à jour sa position dans le modèle et les arêtes associées
        if (elementId && elementId.startsWith('node_')) {
          const node = self.getNodeById(elementId);
          if (node) {
            // Calculer la position par rapport au canvas
            const canvasRect = self.canvas.getBoundingClientRect();
            const x = (newLeft - self.pan.x) / self.scale;
            const y = (newTop - self.pan.y) / self.scale;
            
            // Mettre à jour la position du nœud
            node.position = { x, y };
            
            // Mettre à jour les arêtes connectées
            self.updateEdges();
          }
        }
      });
    }
    
    function closeDragElement() {
      // Arrêter l'animation
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
      }
      
      // Marquer la fin du déplacement
      isDragging = false;
      element.classList.remove('dragging');
      
      // Nettoyer les gestionnaires d'événements
      document.onmouseup = null;
      document.onmousemove = null;
      
      // Restaurer les propriétés d'optimisation
      element.style.willChange = 'auto';
      
      // Si c'est un nœud, terminer le déplacement et vérifier s'il s'agit d'un vrai déplacement
      if (elementId && elementId.startsWith('node_')) {
        const node = self.getNodeById(elementId);
        if (node) {
          node.isDragging = false;
          
          // Vérifier si le nœud a réellement bougé
          if (node.initialDragPosition && 
              (Math.abs(node.initialDragPosition.x - node.position.x) > 2 ||
               Math.abs(node.initialDragPosition.y - node.position.y) > 2)) {
            // Émettre un événement signalant que le nœud a été déplacé
            self.emit('nodePositionChanged', {
              nodeId: node.id,
              position: node.position,
              previousPosition: node.initialDragPosition
            });
          }
          
          // Une dernière mise à jour des arêtes pour assurer la cohérence
          self.updateEdges();
        }
      }
    }
  }
  
  /**
   * Effectue un zoom à une échelle donnée
   * @param {number} scale - Facteur de zoom
   * @param {Object} center - Point central du zoom { x, y }
   * @param {boolean} animate - Indique si le zoom doit être animé, par défaut à true
   */
  zoom(scale, center = { x: this.container.clientWidth / 2, y: this.container.clientHeight / 2 }, animate = true) {
    const oldScale = this.scale;
    
    // Calculer la nouvelle échelle
    const targetScale = oldScale * scale;
    
    // Limiter l'échelle
    const newScale = Math.max(this.options.minScale, Math.min(this.options.maxScale, targetScale));
    
    // Si l'échelle n'a pas changé, sortir
    if (newScale === oldScale) {
      return;
    }
    
    // Calculer les décalages cibles
    const { x: centerX, y: centerY } = center;
    const targetOffsetX = centerX - (centerX - this.offset.x) * (newScale / oldScale);
    const targetOffsetY = centerY - (centerY - this.offset.y) * (newScale / oldScale);
    
    if (animate) {
      // Animation douce du zoom
      const startScale = this.scale;
      const startOffsetX = this.offset.x;
      const startOffsetY = this.offset.y;
      
      const deltaScale = newScale - startScale;
      const deltaOffsetX = targetOffsetX - startOffsetX;
      const deltaOffsetY = targetOffsetY - startOffsetY;
      
      const duration = 200; // durée en ms
      const startTime = performance.now();
      
      const animateZoom = (currentTime) => {
        const elapsedTime = currentTime - startTime;
        const progress = Math.min(elapsedTime / duration, 1);
        
        // Fonction d'ease-out pour une animation plus naturelle
        const easeOutProgress = 1 - Math.pow(1 - progress, 2);
        
        this.scale = startScale + deltaScale * easeOutProgress;
        this.offset.x = startOffsetX + deltaOffsetX * easeOutProgress;
        this.offset.y = startOffsetY + deltaOffsetY * easeOutProgress;
        
        this.updateTransform();
        
        if (progress < 1) {
          requestAnimationFrame(animateZoom);
        } else {
          // Mise à jour des arêtes une fois l'animation terminée
          this.updateEdges();
          console.log(`[Workflow] Zoom terminé: échelle ${this.scale.toFixed(2)}`);
        }
      };
      
      requestAnimationFrame(animateZoom);
    } else {
      // Sans animation, mise à jour immédiate
      this.scale = newScale;
      this.offset.x = targetOffsetX;
      this.offset.y = targetOffsetY;
      this.updateTransform();
      this.updateEdges();
    }
  }
  
  /**
   * Zoom avant
   */
  zoomIn() {
    this.zoom(1.2);
  }
  
  /**
   * Zoom arrière
   */
  zoomOut() {
    this.zoom(0.8);
  }
  
  /**
   * Réinitialise la vue
   */
  resetView() {
    // Sauvegarder l'échelle actuelle pour l'animation
    const oldScale = this.scale;
    
    // Réinitialiser l'échelle à la valeur initiale
    this.scale = this.options.initialScale;
    
    // Centre du canvas (2000,2000)
    const centerX = 2000;
    const centerY = 2000;
    
    // Animer le centrage et le zoom
    // Si des nœuds existent, essayer de centrer sur eux plutôt que sur un point fixe
    if (this.nodes.length > 0) {
      // Calculer le centre des nœuds existants
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      
      this.nodes.forEach(node => {
        minX = Math.min(minX, node.position.x);
        maxX = Math.max(maxX, node.position.x + (node.width || 180));
        minY = Math.min(minY, node.position.y);
        maxY = Math.max(maxY, node.position.y + (node.height || 100));
      });
      
      // Calculer le centre du groupe de nœuds
      const centerNodesX = minX + (maxX - minX) / 2;
      const centerNodesY = minY + (maxY - minY) / 2;
      
      console.log(`[Workflow] Réinitialisation de la vue centrée sur le groupe de nœuds (${centerNodesX}, ${centerNodesY})`);
      
      // Centrer sur le groupe de nœuds avec animation
      this.centerCanvas({ x: centerNodesX, y: centerNodesY }, true);
    } else {
      // Pas de nœuds, centrer sur le milieu du canvas
      console.log('[Workflow] Réinitialisation de la vue centrée sur le milieu du canvas');
      this.centerCanvas(null, true);
    }
    
    // Mettre à jour les arêtes (sera fait par centerCanvas)
  }
  
  /**
   * Met à jour la transformation du canvas
   */
  updateTransform() {
    this.canvas.style.transform = `translate(${this.offset.x}px, ${this.offset.y}px) scale(${this.scale})`;
  }
  
  /**
   * Met à jour l'affichage de l'éditeur
   */
  update() {
    // Mettre à jour les arêtes
    this.updateEdges();
  }
  
  /**
   * Charge un workflow depuis le serveur
   * @param {string} workflowId - ID du workflow à charger
   */
  async loadWorkflow(workflowId) {
    try {
      this.showLoading(true);
      
      // Récupérer les données du workflow depuis le serveur
      const response = await fetch(`/api/workflows/${workflowId}`, {
        headers: {
          'Authorization': `Bearer ${getToken ? getToken() : ''}`,
          'X-API-KEY': 'dev-key'
        }
      });
      
      if (!response.ok) {
        throw new Error('Erreur lors du chargement du workflow');
      }
      
      const result = await response.json();
      console.log('Workflow chargé:', result);
      
      let workflow;
      if (result.success && result.data) {
        workflow = result.data;
      } else {
        workflow = result;
      }
      
      // Stocker l'ID du workflow
      this.workflowId = workflow.id;
      this.workflowName = workflow.name;
      this.workflowDescription = workflow.description || '';
      
      // Effacer les noeuds et arêtes existants
      this.clearWorkflow();
      
      // Charger les noeuds et arêtes
      let flowData;
      try {
        flowData = typeof workflow.flow_json === 'string' 
          ? JSON.parse(workflow.flow_json) 
          : workflow.flow_json;
      } catch (e) {
        console.error('Erreur lors du parsing du JSON du workflow:', e);
        flowData = { nodes: [], edges: [] };
      }
      
      // Créer les noeuds
      if (flowData.nodes && Array.isArray(flowData.nodes)) {
        // Trouver le prochain ID à utiliser
        const nodeIds = flowData.nodes.map(node => {
          const idMatch = node.id.match(/node_(\d+)/);
          return idMatch ? parseInt(idMatch[1]) : 0;
        });
        this.nextNodeId = nodeIds.length > 0 ? Math.max(...nodeIds) + 1 : 1;
        
        flowData.nodes.forEach(node => {
          const nodeElement = this.addNode(node.type, node.position);
          
          // Copier les propriétés
          nodeElement.label = node.label || nodeElement.label;
          nodeElement.data = node.data || {};
          
          // Mettre à jour l'affichage du noeud
          const domNode = document.getElementById(nodeElement.id);
          if (domNode) {
            domNode.querySelector('.node-title').textContent = nodeElement.label;
          }
        });
      }
      
      // Créer les arêtes après un délai suffisant pour permettre au DOM de se mettre à jour
      if (flowData.edges && Array.isArray(flowData.edges)) {
        // Trouver le prochain ID à utiliser
        const edgeIds = flowData.edges.map(edge => {
          const idMatch = edge.id.match(/edge_(\d+)/);
          return idMatch ? parseInt(idMatch[1]) : 0;
        });
        this.nextEdgeId = edgeIds.length > 0 ? Math.max(...edgeIds) + 1 : 1;
        
        // Stockons les arêtes à créer
        const edgesToCreate = [...flowData.edges];
        
        // Log d'information pour le débogage
        console.log(`[Workflow] Création de ${edgesToCreate.length} arêtes après initialisation des nœuds...`);
        
        // Fonction pour vérifier si tous les éléments DOM des nœuds sont prêts
        const areNodesReady = () => {
          const allNodesExist = this.nodes.every(node => {
            const nodeElement = document.getElementById(node.id);
            return !!nodeElement;
          });
          
          if (allNodesExist) {
            console.log('[Workflow] Tous les nœuds sont prêts, création des arêtes...');
            return true;
          }
          return false;
        };
        
        // Fonction récursive qui tente de créer les arêtes jusqu'à ce que les nœuds soient prêts
        const tryCreateEdges = (attempts = 0) => {
          if (attempts >= 10) {
            console.warn('[Workflow] Nombre maximal de tentatives pour créer les arêtes atteint');
            return;
          }
          
          if (areNodesReady()) {
            // Tous les nœuds sont prêts, on peut créer les arêtes
            edgesToCreate.forEach(edge => {
              const sourceNode = this.getNodeById(edge.source);
              const targetNode = this.getNodeById(edge.target);
              
              // Vérifions que les éléments DOM existent aussi
              const sourceElement = document.getElementById(edge.source);
              const targetElement = document.getElementById(edge.target);
              
              if (sourceNode && targetNode && sourceElement && targetElement) {
                // Les nœuds existent et sont rendus dans le DOM, on peut créer l'arête
                this.createEdge(
                  edge.source,
                  edge.target,
                  edge.sourceOutput,
                  edge.targetInput
                );
              } else {
                console.warn(`[Workflow] Impossible de créer l'arête: nœuds manquants (source: ${edge.source}, target: ${edge.target})`);
              }
            });
          } else {
            // Attendre un peu plus longtemps et réessayer
            setTimeout(() => tryCreateEdges(attempts + 1), 200);
          }
        };
        
        // Premier appel à la fonction récursive après un délai initial
        setTimeout(() => tryCreateEdges(), 500); // Délai initial de 500ms pour laisser le temps au DOM de se mettre à jour
      }
      
      this.showNotification(`Workflow "${this.workflowName}" chargé avec succès`, 'success');
      this.showLoading(false);
    } catch (error) {
      console.error('Erreur lors du chargement du workflow:', error);
      this.showNotification(`Erreur: ${error.message}`, 'error');
      this.showLoading(false);
    }
  }
  
  /**
   * Efface le workflow actuel
   */
  clearWorkflow() {
    // Supprimer tous les noeuds et arêtes
    this.nodesLayer.innerHTML = '';
    this.edgesLayer.innerHTML = '';
    
    // Réinitialiser les tableaux
    this.nodes = [];
    this.edges = [];
    
    // Réinitialiser les sélections
    this.selectedNodeId = null;
    this.selectedEdgeId = null;
    
    // Fermer le panneau de propriétés
    this.propertiesPanel.classList.remove('open');
  }
  
  /**
   * Sauvegarde le workflow sur le serveur
   */
  async saveWorkflow() {
    if (!this.workflowId) {
      this.showNotification('Impossible de sauvegarder: aucun workflow chargé', 'error');
      return;
    }
    
    try {
      this.showLoading(true);
      
      // Préparer les données du workflow
      const flowData = {
        nodes: this.nodes,
        edges: this.edges
      };
      
      const workflowData = {
        name: this.workflowName,
        description: this.workflowDescription,
        flow_json: JSON.stringify(flowData)
      };
      
      // Envoyer les données au serveur
      const response = await fetch(`/api/workflows/${this.workflowId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getToken ? getToken() : ''}`,
          'X-API-KEY': 'dev-key'
        },
        body: JSON.stringify(workflowData)
      });
      
      if (!response.ok) {
        throw new Error('Erreur lors de la sauvegarde du workflow');
      }
      
      this.showNotification('Workflow sauvegardé avec succès', 'success');
      this.emit('workflowSaved', flowData);
      this.showLoading(false);
    } catch (error) {
      console.error('Erreur lors de la sauvegarde du workflow:', error);
      this.showNotification(`Erreur: ${error.message}`, 'error');
      this.showLoading(false);
    }
  }
  
  /**
   * Affiche une notification
   * @param {string} message - Message à afficher
   * @param {string} type - Type de notification (info, success, warning, error)
   */
  showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `editor-notification ${type}`;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    // Afficher avec animation
    setTimeout(() => {
      notification.classList.add('show');
    }, 10);
    
    // Masquer automatiquement après un délai
    setTimeout(() => {
      notification.classList.remove('show');
      setTimeout(() => {
        notification.remove();
      }, 300);
    }, 3000);
  }
  
  /**
   * Affiche ou masque l'overlay de chargement
   * @param {boolean} show - Indique si l'overlay doit être affiché
   */
  showLoading(show) {
    if (show) {
      this.loadingOverlay.classList.add('show');
    } else {
      this.loadingOverlay.classList.remove('show');
    }
  }
  
  /**
   * Récupère un noeud par son ID
   * @param {string} id - ID du noeud
   * @returns {Object|null} Le noeud trouvé ou null
   */
  getNodeById(id) {
    return this.nodes.find(node => node.id === id) || null;
  }
  
  /**
   * Récupère une arête par son ID
   * @param {string} id - ID de l'arête
   * @returns {Object|null} L'arête trouvée ou null
   */
  getEdgeById(id) {
    return this.edges.find(edge => edge.id === id) || null;
  }
  
  /**
   * Ajoute un écouteur d'événement
   * @param {string} event - Nom de l'événement
   * @param {Function} callback - Fonction de rappel
   */
  on(event, callback) {
    if (this.eventListeners[event]) {
      this.eventListeners[event].push(callback);
    }
  }
  
  /**
   * Supprime un écouteur d'événement
   * @param {string} event - Nom de l'événement
   * @param {Function} callback - Fonction de rappel à supprimer
   */
  off(event, callback) {
    if (this.eventListeners[event]) {
      this.eventListeners[event] = this.eventListeners[event].filter(
        cb => cb !== callback
      );
    }
  }
  
  /**
   * Émet un événement
   * @param {string} event - Nom de l'événement
   * @param {any} data - Données de l'événement
   */
  emit(event, data) {
    if (this.eventListeners[event]) {
      this.eventListeners[event].forEach(callback => {
        callback(data);
      });
    }
  }

  /**
   * Active l'assistant de connexion rapide de nœuds
   * Affiche une interface utilisateur pour sélectionner et connecter les nœuds facilement
   */
  activateConnectionWizard() {
    // Vérifier s'il y a au moins deux nœuds dans le workflow
    if (this.nodes.length < 2) {
      this.showNotification('Ajoutez au moins deux nœuds pour utiliser l\'assistant de connexion', 'warning');
      return;
    }
    
    // Créer l'interface de l'assistant
    this.createConnectionWizardUI();
  }
  
  /**
   * Crée l'interface utilisateur de l'assistant de connexion
   */
  createConnectionWizardUI() {
    // Créer l'overlay de l'assistant
    const wizardOverlay = document.createElement('div');
    wizardOverlay.className = 'connection-wizard-overlay';
    
    // Créer le panneau de l'assistant
    const wizardPanel = document.createElement('div');
    wizardPanel.className = 'connection-wizard-panel';
    
    // Créer l'en-tête
    const wizardHeader = document.createElement('div');
    wizardHeader.className = 'wizard-header';
    
    const wizardTitle = document.createElement('h3');
    wizardTitle.textContent = 'Assistant de connexion rapide';
    
    const closeBtn = document.createElement('button');
    closeBtn.innerHTML = '×';
    closeBtn.className = 'close-wizard';
    closeBtn.addEventListener('click', () => {
      wizardOverlay.remove();
    });
    
    wizardHeader.appendChild(wizardTitle);
    wizardHeader.appendChild(closeBtn);
    
    // Créer le contenu
    const wizardContent = document.createElement('div');
    wizardContent.className = 'wizard-content';
    
    // Lister tous les nœuds dans le workflow
    const nodeList = document.createElement('div');
    nodeList.className = 'node-connection-list';
    
    // Ajouter les nœuds à la liste
    this.nodes.forEach(node => {
      const nodeItem = document.createElement('div');
      nodeItem.className = 'node-connection-item';
      nodeItem.setAttribute('data-node-id', node.id);
      
      const nodeInfo = document.createElement('div');
      nodeInfo.className = 'node-info';
      
      const nodeType = document.createElement('span');
      nodeType.className = 'node-type';
      nodeType.textContent = node.label;
      
      nodeInfo.appendChild(nodeType);
      nodeItem.appendChild(nodeInfo);
      
      // Ajouter les ports de sortie disponibles
      if (node.outputs && node.outputs.length > 0) {
        const outputsContainer = document.createElement('div');
        outputsContainer.className = 'port-list outputs';
        
        node.outputs.forEach((output, index) => {
          const portItem = document.createElement('div');
          portItem.className = 'port-item output';
          portItem.setAttribute('data-port-index', index);
          portItem.textContent = output.label;
          
          // Ajouter l'événement pour sélectionner ce port comme source
          portItem.addEventListener('click', () => {
            // Désélectionner tous les autres ports sources
            document.querySelectorAll('.port-item.output.selected').forEach(el => {
              el.classList.remove('selected');
            });
            
            // Sélectionner ce port
            portItem.classList.add('selected');
            
            // Mettre à jour les connexions possibles
            this.updatePossibleConnections(node.id, index);
          });
          
          outputsContainer.appendChild(portItem);
        });
        
        nodeItem.appendChild(outputsContainer);
      }
      
      nodeList.appendChild(nodeItem);
    });
    
    // Conteneur pour afficher les connexions possibles
    const possibleConnectionsContainer = document.createElement('div');
    possibleConnectionsContainer.className = 'possible-connections';
    possibleConnectionsContainer.innerHTML = '<p>Sélectionnez un port de sortie pour voir les connexions possibles</p>';
    
    wizardContent.appendChild(document.createElement('h4')).textContent = 'Nœuds disponibles';
    wizardContent.appendChild(nodeList);
    wizardContent.appendChild(document.createElement('h4')).textContent = 'Connexions possibles';
    wizardContent.appendChild(possibleConnectionsContainer);
    
    // Assembler le panneau
    wizardPanel.appendChild(wizardHeader);
    wizardPanel.appendChild(wizardContent);
    wizardOverlay.appendChild(wizardPanel);
    
    // Ajouter l'overlay au conteneur
    this.container.appendChild(wizardOverlay);
  }
  
  /**
   * Met à jour la liste des connexions possibles à partir d'un port source
   * @param {string} sourceNodeId - ID du nœud source
   * @param {number} outputIndex - Index du port de sortie
   */
  updatePossibleConnections(sourceNodeId, outputIndex) {
    const sourceNode = this.getNodeById(sourceNodeId);
    const possibleConnectionsContainer = document.querySelector('.possible-connections');
    
    if (!sourceNode || !possibleConnectionsContainer) return;
    
    // Vider le conteneur
    possibleConnectionsContainer.innerHTML = '';
    
    // Titre
    const title = document.createElement('h4');
    title.textContent = `Connecter depuis: ${sourceNode.label} > ${sourceNode.outputs[outputIndex].label}`;
    possibleConnectionsContainer.appendChild(title);
    
    // Trouver tous les ports d'entrée compatibles
    let foundCompatible = false;
    
    this.nodes.forEach(targetNode => {
      // Ne pas proposer le même nœud comme cible
      if (targetNode.id === sourceNodeId) return;
      
      // Ne pas proposer les nœuds qui ont déjà une connexion depuis ce port
      const existingConnections = this.edges.filter(edge => 
        edge.source === sourceNodeId && 
        edge.sourceOutput === outputIndex &&
        edge.target === targetNode.id
      );
      
      if (existingConnections.length > 0) return;
      
      // Créer un élément pour le nœud cible s'il a des entrées
      if (targetNode.inputs && targetNode.inputs.length > 0) {
        const targetNodeItem = document.createElement('div');
        targetNodeItem.className = 'target-node-item';
        
        const nodeLabel = document.createElement('div');
        nodeLabel.className = 'target-node-label';
        nodeLabel.textContent = targetNode.label;
        targetNodeItem.appendChild(nodeLabel);
        
        // Liste des ports d'entrée
        const inputList = document.createElement('div');
        inputList.className = 'target-port-list';
        
        let hasCompatiblePorts = false;
        
        // Ajouter chaque port d'entrée
        targetNode.inputs.forEach((input, inputIndex) => {
          const portItem = document.createElement('div');
          portItem.className = 'target-port-item';
          portItem.textContent = input.label;
          
          // Vérifier si ce port d'entrée est déjà connecté
          const isConnected = this.edges.some(edge => 
            edge.target === targetNode.id && 
            edge.targetInput === inputIndex
          );
          
          if (isConnected) {
            portItem.classList.add('connected');
            portItem.title = 'Ce port est déjà connecté';
          } else {
            portItem.classList.add('available');
            hasCompatiblePorts = true;
            foundCompatible = true;
            
            // Ajouter l'événement pour créer la connexion
            portItem.addEventListener('click', () => {
              this.createOneClickConnection(sourceNodeId, targetNode.id, outputIndex, inputIndex);
              // Fermer l'assistant après la connexion
              document.querySelector('.connection-wizard-overlay').remove();
            });
          }
          
          inputList.appendChild(portItem);
        });
        
        // N'ajouter le nœud que s'il a au moins un port compatible
        if (hasCompatiblePorts) {
          targetNodeItem.appendChild(inputList);
          possibleConnectionsContainer.appendChild(targetNodeItem);
        }
      }
    });
    
    // Message si aucune connexion possible n'est trouvée
    if (!foundCompatible) {
      const noConnectionsMsg = document.createElement('p');
      noConnectionsMsg.className = 'no-connections-msg';
      noConnectionsMsg.textContent = 'Aucune connexion possible trouvée. Tous les ports compatibles sont déjà connectés.';
      possibleConnectionsContainer.appendChild(noConnectionsMsg);
      
      // Ajouter un bouton pour ajouter un nouveau nœud
      const addNodeBtn = document.createElement('button');
      addNodeBtn.className = 'add-compatible-node-btn';
      addNodeBtn.textContent = 'Ajouter un nœud compatible';
      addNodeBtn.addEventListener('click', () => {
        // Fermer l'assistant
        document.querySelector('.connection-wizard-overlay').remove();
        
        // Suggérer des types de nœuds compatibles selon le contexte
        this.suggestCompatibleNodeTypes(sourceNode, outputIndex);
      });
      
      possibleConnectionsContainer.appendChild(addNodeBtn);
    }
  }
  
  /**
   * Crée une connexion via l'assistant de connexion rapide
   * @param {string} sourceId - ID du nœud source
   * @param {string} targetId - ID du nœud cible
   * @param {number} sourceOutput - Index du port de sortie
   * @param {number} targetInput - Index du port d'entrée
   */
  createOneClickConnection(sourceId, targetId, sourceOutput, targetInput) {
    // Créer l'arête
    const edge = this.createEdge(sourceId, targetId, sourceOutput, targetInput);
    
    // Notification de succès
    this.showNotification('Connexion créée avec succès', 'success');
    
    // Mettre en évidence les nœuds connectés brièvement
    const sourceEl = document.querySelector(`[data-node-id="${sourceId}"]`);
    const targetEl = document.querySelector(`[data-node-id="${targetId}"]`);
    
    if (sourceEl && targetEl) {
      sourceEl.classList.add('highlight-connected');
      targetEl.classList.add('highlight-connected');
      
      setTimeout(() => {
        sourceEl.classList.remove('highlight-connected');
        targetEl.classList.remove('highlight-connected');
      }, 1500);
    }
    
    return edge;
  }
  
  /**
   * Suggère des types de nœuds compatibles selon le contexte
   * @param {Object} sourceNode - Nœud source
   * @param {number} outputIndex - Index du port de sortie
   */
  suggestCompatibleNodeTypes(sourceNode, outputIndex) {
    // Ici, on pourrait implémenter une logique plus sophistiquée
    // pour suggérer des types de nœuds compatibles selon la sortie du nœud source
    
    // Pour l'exemple, créons une boîte de dialogue simple
    const dialogOverlay = document.createElement('div');
    dialogOverlay.className = 'wizard-dialog-overlay';
    
    const dialogPanel = document.createElement('div');
    dialogPanel.className = 'wizard-dialog-panel';
    
    // En-tête
    const dialogHeader = document.createElement('div');
    dialogHeader.className = 'wizard-dialog-header';
    
    const dialogTitle = document.createElement('h3');
    dialogTitle.textContent = 'Suggérer un nœud compatible';
    
    const closeBtn = document.createElement('button');
    closeBtn.innerHTML = '×';
    closeBtn.className = 'close-wizard-dialog';
    closeBtn.addEventListener('click', () => {
      dialogOverlay.remove();
    });
    
    dialogHeader.appendChild(dialogTitle);
    dialogHeader.appendChild(closeBtn);
    
    // Contenu
    const dialogContent = document.createElement('div');
    dialogContent.className = 'wizard-dialog-content';
    
    dialogContent.innerHTML = `
      <p>Suggérer un nœud compatible avec <strong>${sourceNode.label}</strong> (sortie: <strong>${sourceNode.outputs[outputIndex].label}</strong>)</p>
    `;
    
    // Liste de nœuds suggérés (dans une implémentation réelle, cela dépendrait du contexte)
    const suggestedNodes = [
      { type: 'field-mapper', label: 'Mapper champs' },
      { type: 'transform', label: 'Transformer' },
      { type: 'condition', label: 'Condition' }
    ];
    
    // Si la sortie est HL7, suggérer le convertisseur FHIR
    if (sourceNode.outputs[outputIndex].name === 'message' || sourceNode.type === 'hl7-input') {
      suggestedNodes.unshift({ type: 'fhir-converter', label: 'Convertir FHIR' });
    }
    
    // Si la sortie est FHIR, suggérer la sortie FHIR
    if (sourceNode.outputs[outputIndex].name === 'fhir' || sourceNode.type === 'fhir-converter') {
      suggestedNodes.unshift({ type: 'fhir-output', label: 'Sortie FHIR' });
    }
    
    const nodeTypesList = document.createElement('div');
    nodeTypesList.className = 'suggested-node-types';
    
    suggestedNodes.forEach(nodeType => {
      const nodeTypeItem = document.createElement('div');
      nodeTypeItem.className = 'suggested-node-type';
      nodeTypeItem.setAttribute('data-node-type', nodeType.type);
      
      nodeTypeItem.textContent = nodeType.label;
      
      // Ajouter l'événement pour créer ce type de nœud
      nodeTypeItem.addEventListener('click', () => {
        // Fermer la boîte de dialogue
        dialogOverlay.remove();
        
        // Ajouter le nœud suggéré
        this.addSuggestedNodeAndConnect(nodeType.type, sourceNode.id, outputIndex);
      });
      
      nodeTypesList.appendChild(nodeTypeItem);
    });
    
    dialogContent.appendChild(nodeTypesList);
    
    // Assembler la boîte de dialogue
    dialogPanel.appendChild(dialogHeader);
    dialogPanel.appendChild(dialogContent);
    dialogOverlay.appendChild(dialogPanel);
    
    // Ajouter la boîte de dialogue au DOM
    this.container.appendChild(dialogOverlay);
  }
  
  /**
   * Ajoute un nœud suggéré et le connecte automatiquement au nœud source
   * @param {string} nodeType - Type de nœud à ajouter
   * @param {string} sourceNodeId - ID du nœud source
   * @param {number} outputIndex - Index du port de sortie du nœud source
   */
  addSuggestedNodeAndConnect(nodeType, sourceNodeId, outputIndex) {
    // Trouver le nœud source
    const sourceNode = this.getNodeById(sourceNodeId);
    if (!sourceNode) return;
    
    // Calculer une position à droite du nœud source
    // Mais en restant dans le centre de la zone visible
    const position = {
      x: 2000 + 200, // 200px à droite du centre
      y: 2000
    };
    
    // Ajouter le nouveau nœud
    const newNode = this.addNode(nodeType, position);
    
    // Attendre que le DOM soit mis à jour
    setTimeout(() => {
      // Connecter automatiquement le premier port d'entrée disponible
      if (newNode.inputs && newNode.inputs.length > 0) {
        this.createOneClickConnection(sourceNodeId, newNode.id, outputIndex, 0);
      }
      
      // Notification
      this.showNotification(`Nœud ${newNode.label} ajouté et connecté`, 'success');
    }, 100);
  }
  
  /**
   * Affiche une notification dans l'interface
   * @param {string} message - Message à afficher
   * @param {string} type - Type de notification (success, warning, error)
   */
  showNotification(message, type = 'info') {
    // Créer l'élément de notification
    const notification = document.createElement('div');
    notification.className = `workflow-notification ${type}`;
    notification.textContent = message;
    
    // Ajouter au conteneur
    this.container.appendChild(notification);
    
    // Animation d'entrée
    setTimeout(() => {
      notification.classList.add('show');
    }, 10);
    
    // Supprimer après un délai
    setTimeout(() => {
      notification.classList.remove('show');
      setTimeout(() => {
        notification.remove();
      }, 300);
    }, 3000);
  }
}

// Autodetection
document.addEventListener('DOMContentLoaded', function() {
  const container = document.getElementById('workflow-editor-container');
  if (container) {
    console.log('Initialisation de l\'éditeur de workflow');
    window.workflowEditor = new WorkflowEditor('workflow-editor-container');
  }
});