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
      suppressDuplicateMenu: true, // Activer par défaut pour éviter les menus dupliqués
      workflowId: null,
      workflowName: '',
      workflowDescription: '',
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
    this.workflowId = this.options.workflowId;
    this.workflowName = this.options.workflowName || '';
    this.workflowDescription = this.options.workflowDescription || '';
    
    console.log('[DEBUG] Constructor - workflowId:', this.workflowId);
    
    // État pour la sélection multiple
    this.selectionRect = null;
    this.selectionStartPoint = null;
    this.isSelecting = false;
    this.selectedNodes = [];
    
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
    // Définir les dimensions du canvas pour un espace de travail quasi "infini"
    this.canvasSize = {
      width: 20000,  // Taille extrêmement grande pour un effet "infini"
      height: 20000  // Taille extrêmement grande pour un effet "infini"
    };
    
    this.canvas = document.createElement('div');
    this.canvas.className = 'workflow-canvas';
    
    // Définir les dimensions explicitement
    this.canvas.style.width = this.canvasSize.width + 'px';
    this.canvas.style.height = this.canvasSize.height + 'px';
    
    // Définir le point central du canevas pour les calculs futurs
    this.canvasCenter = {
      x: this.canvasSize.width / 2,
      y: this.canvasSize.height / 2
    };
    
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
    
    // Ajouter le SVG au canvas
    this.canvas.appendChild(this.edgesLayer);
    
    // Ajouter la couche des noeuds
    this.nodesLayer = document.createElement('div');
    this.nodesLayer.className = 'nodes-layer';
    this.canvas.appendChild(this.nodesLayer);
    
    // Overlay de chargement
    this.loadingOverlay = document.createElement('div');
    this.loadingOverlay.className = 'loading-overlay';
    this.loadingOverlay.innerHTML = '<div class="loading-spinner"><span></span><span></span><span></span></div><p style="color: #555; margin-top: 15px;">Chargement en cours...</p>';
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
  centerCanvas(point = null, animate = false) {
    try {
      // Obtenir les dimensions du conteneur
      const containerRect = this.container.getBoundingClientRect();
      
      // Vérification préliminaire du point
      const validPoint = (point && typeof point.x === 'number' && typeof point.y === 'number') 
        ? point 
        : null;
      
      // Déterminer les coordonnées cibles
      let targetX, targetY;
      
      if (validPoint) {
        targetX = containerRect.width / 2 - validPoint.x * this.scale;
        targetY = containerRect.height / 2 - validPoint.y * this.scale;
      } else {
        // Utiliser le centre du canevas défini dans createCanvas (10000,10000)
        targetX = containerRect.width / 2 - this.canvasCenter.x * this.scale;
        targetY = containerRect.height / 2 - this.canvasCenter.y * this.scale;
      }
      
      // Vérification des valeurs calculées
      if (isNaN(targetX) || isNaN(targetY)) {
        console.warn("[Workflow] Coordonnées de centrage invalides, utilisation des valeurs par défaut");
        targetX = 0;
        targetY = 0;
      }
      
      // Appliquer directement sans animation pour éviter les problèmes
      this.offset.x = targetX;
      this.offset.y = targetY;
      this.updateTransform();
      
      // Mise à jour différée des arêtes pour laisser le temps au DOM de s'actualiser
      setTimeout(() => {
        try {
          this.updateEdges();
        } catch (edgeError) {
          console.warn("[Workflow] Erreur lors de la mise à jour des arêtes après centrage:", edgeError);
        }
      }, 50);
      
      // Log simplifié
      console.log(`[Workflow] Canvas centré`);
    } catch (error) {
      console.error("[Workflow] Erreur lors du centrage du canvas:", error);
      // En cas d'erreur, essayer de réinitialiser à l'origine
      this.offset.x = 0;
      this.offset.y = 0;
      this.updateTransform();
    }
  }
  
  /**
   * Crée la palette de noeuds
   */
  createNodePalette() {
    // Supprimer toutes les palettes existantes pour éviter la duplication
    const existingPalettes = document.querySelectorAll('.node-palette');
    existingPalettes.forEach(palette => {
      palette.remove();
    });
    
    console.log(`[Workflow] ${existingPalettes.length} palettes de nœuds supprimées`);
    
    // Créer une nouvelle palette
    this.nodePalette = document.createElement('div');
    this.nodePalette.className = 'node-palette';
    this.nodePalette.id = 'unique-node-palette';
    
    // Amélioration du style de la palette
    this.nodePalette.style.position = 'absolute';
    this.nodePalette.style.top = '10px';
    this.nodePalette.style.left = '10px';
    this.nodePalette.style.width = '250px';
    this.nodePalette.style.background = 'white';
    this.nodePalette.style.borderRadius = '8px';
    this.nodePalette.style.padding = '10px';
    this.nodePalette.style.boxShadow = '0 4px 15px rgba(0, 0, 0, 0.15)';
    this.nodePalette.style.zIndex = '100';
    this.nodePalette.style.maxHeight = 'calc(100% - 20px)';
    this.nodePalette.style.overflowY = 'auto';
    this.nodePalette.style.border = '1px solid #e0e0e0';
    this.nodePalette.style.resize = 'both';
    this.nodePalette.style.overflow = 'auto';
    this.nodePalette.style.minWidth = '200px';
    this.nodePalette.style.minHeight = '150px';
    
    // Ajouter un dégradé rouge-orange pour s'aligner avec le design FHIRHub
    this.nodePalette.style.borderTop = '4px solid transparent';
    this.nodePalette.style.borderImageSource = 'linear-gradient(to right, #e74c3c, #e67e22)';
    this.nodePalette.style.borderImageSlice = '1';
    
    this.container.appendChild(this.nodePalette);
    
    // Titre de la palette
    const paletteTitle = document.createElement('h3');
    paletteTitle.textContent = 'Nœuds disponibles';
    this.nodePalette.appendChild(paletteTitle);
    
    // Rendre la palette déplaçable
    this.makeElementDraggable(this.nodePalette, paletteTitle);
    
    // Champ de recherche pour filtrer les nœuds
    const searchContainer = document.createElement('div');
    searchContainer.className = 'node-palette-search';
    searchContainer.style.margin = '0 0 10px 0';
    searchContainer.style.padding = '5px';
    
    const searchInput = document.createElement('input');
    searchInput.type = 'text';
    searchInput.placeholder = 'Rechercher un nœud...';
    searchInput.className = 'node-palette-search-input';
    searchInput.style.width = '100%';
    searchInput.style.padding = '6px 8px';
    searchInput.style.border = '1px solid #ddd';
    searchInput.style.borderRadius = '4px';
    searchInput.style.fontSize = '13px';
    
    // Ajouter la fonctionnalité de recherche
    searchInput.addEventListener('input', (e) => {
      const searchTerm = e.target.value.toLowerCase();
      
      // Récupérer tous les éléments de nœud dans la palette
      const nodeItems = this.nodePalette.querySelectorAll('.node-palette-item');
      const nodeCategories = this.nodePalette.querySelectorAll('.node-palette-category');
      
      // Parcourir tous les nœuds et filtrer
      let foundNodesInCategory = new Map();
      
      nodeItems.forEach(nodeItem => {
        const nodeLabel = nodeItem.querySelector('.node-palette-item-label').textContent.toLowerCase();
        const nodeType = nodeItem.getAttribute('data-node-type').toLowerCase();
        const matchesSearch = nodeLabel.includes(searchTerm) || nodeType.includes(searchTerm);
        
        // Afficher ou masquer en fonction de la recherche
        nodeItem.style.display = matchesSearch ? 'flex' : 'none';
        
        // Si ce nœud correspond, marquer sa catégorie comme ayant des nœuds visibles
        if (matchesSearch) {
          const category = nodeItem.closest('.node-palette-category');
          foundNodesInCategory.set(category, true);
        }
      });
      
      // Masquer les catégories qui n'ont pas de nœuds correspondants
      nodeCategories.forEach(category => {
        category.style.display = foundNodesInCategory.has(category) ? 'block' : 'none';
      });
    });
    
    searchContainer.appendChild(searchInput);
    this.nodePalette.appendChild(searchContainer);
    
    // Catégories de noeuds avec meilleure organisation et plus de nœuds spécialisés pour en faire un véritable EAI
    const categories = [
      {
        name: '📥 Entrées/Sources',
        nodes: [
          { type: 'hl7-input', label: 'Entrée HL7', icon: '📨' },
          { type: 'json-input', label: 'Entrée JSON', icon: '📄' },
          { type: 'file-input', label: 'Entrée fichier', icon: '📁' },
          { type: 'ftp-input', label: 'Entrée FTP', icon: '📡' },
          { type: 'folder-watcher', label: 'Surveiller dossier', icon: '👁️' },
          { type: 'timer-trigger', label: 'Déclencheur temporel', icon: '⏲️' },
          { type: 'http-receiver', label: 'Récepteur HTTP', icon: '🔌' }
        ]
      },
      {
        name: '🔄 Conversion',
        nodes: [
          { type: 'fhir-converter', label: 'Convertir FHIR', icon: '🔥' },
          { type: 'hl7-to-fhir', label: 'HL7 vers FHIR', icon: '🔄' },
          { type: 'fhir-to-hl7', label: 'FHIR vers HL7', icon: '⚙️' },
          { type: 'cda-to-fhir', label: 'CDA vers FHIR', icon: '📋' },
          { type: 'dicom-to-fhir', label: 'DICOM vers FHIR', icon: '🔬' },
          { type: 'xml-to-json', label: 'XML vers JSON', icon: '🔄' },
          { type: 'json-to-xml', label: 'JSON vers XML', icon: '📄' },
          { type: 'template', label: 'Template JSON', icon: '📝' },
          { type: 'custom-script', label: 'Script JS', icon: '📜' },
          { type: 'xslt-transform', label: 'Transformation XSLT', icon: '🔄' }
        ]
      },
      {
        name: '⚙️ Traitement',
        nodes: [
          { type: 'field-mapper', label: 'Mapper champs', icon: '🔀' },
          { type: 'segment-extractor', label: 'Extraire segment', icon: '✂️' },
          { type: 'transform', label: 'Transformer', icon: '🔄' },
          { type: 'condition', label: 'Condition', icon: '🔍' },
          { type: 'split', label: 'Diviseur', icon: '🪓' },
          { type: 'merge', label: 'Fusionner', icon: '🔗' },
          { type: 'filter', label: 'Filtre', icon: '🧹' },
          { type: 'validator', label: 'Validateur', icon: '✓' },
          { type: 'sorter', label: 'Trieur', icon: '📊' },
          { type: 'batch-processor', label: 'Traitement par lot', icon: '📦' },
          { type: 'debatcher', label: 'Décomposition lot', icon: '📭' }
        ]
      },
      {
        name: '🔌 Intégration',
        nodes: [
          { type: 'api-call', label: 'Appel API', icon: '🌐' },
          { type: 'fhir-output', label: 'Sortie FHIR', icon: '📤' },
          { type: 'file-output', label: 'Sortie fichier', icon: '💾' },
          { type: 'database-query', label: 'Requête BDD', icon: '🗄️' },
          { type: 'email-sender', label: 'Envoi email', icon: '📧' },
          { type: 'sms-sender', label: 'Envoi SMS', icon: '📱' },
          { type: 'webhook-sender', label: 'Envoi webhook', icon: '🔔' },
          { type: 'queue-publisher', label: 'Publier file', icon: '📨' },
          { type: 'queue-consumer', label: 'Consommer file', icon: '📬' }
        ]
      },
      {
        name: '🏥 Systèmes Santé',
        nodes: [
          { type: 'hl7-v2', label: 'HL7 v2.x', icon: '📋' },
          { type: 'hl7-v3', label: 'HL7 v3', icon: '🏥' },
          { type: 'dicom', label: 'DICOM', icon: '🔬' },
          { type: 'sis', label: 'SIH', icon: '🏢' },
          { type: 'cda', label: 'CDA', icon: '📑' },
          { type: 'fhir-r4', label: 'FHIR R4', icon: '🔥' },
          { type: 'fhir-dstu2', label: 'FHIR DSTU2', icon: '🔥' },
          { type: 'fhir-stu3', label: 'FHIR STU3', icon: '🔥' },
          { type: 'loinc-mapper', label: 'Mappeur LOINC', icon: '🔀' },
          { type: 'snomed-mapper', label: 'Mappeur SNOMED', icon: '🔀' },
          { type: 'french-nih', label: 'NIH Français', icon: '🇫🇷' },
          { type: 'dmp-export', label: 'Export DMP', icon: '📊' },
          { type: 'rpps-lookup', label: 'Recherche RPPS', icon: '🔍' },
          { type: 'mssante', label: 'MSSanté', icon: '📧' },
          { type: 'ins-lookup', label: 'Recherche INS', icon: '🔑' },
          { type: 'sesam-vitale', label: 'SESAM-Vitale', icon: '💳' }
        ]
      },
      {
        name: '🔒 Sécurité',
        nodes: [
          { type: 'authentication', label: 'Authentification', icon: '🔐' },
          { type: 'authorization', label: 'Autorisation', icon: '🛡️' },
          { type: 'encryption', label: 'Chiffrement', icon: '🔒' },
          { type: 'decryption', label: 'Déchiffrement', icon: '🔓' },
          { type: 'anonymizer', label: 'Anonymisation', icon: '👤' },
          { type: 'data-masking', label: 'Masquage données', icon: '⬛' },
          { type: 'logger', label: 'Journalisation', icon: '📝' },
          { type: 'audit-trail', label: 'Piste d\'audit', icon: '🔍' }
        ]
      },
      {
        name: '🌐 Connecteurs',
        nodes: [
          { type: 'soap', label: 'SOAP Client', icon: '🧼' },
          { type: 'rest', label: 'REST Client', icon: '🔗' },
          { type: 'sftp', label: 'SFTP', icon: '📡' },
          { type: 'mllp', label: 'MLLP', icon: '📶' },
          { type: 'jdbc', label: 'JDBC', icon: '💾' },
          { type: 'ldap', label: 'LDAP', icon: '👥' },
          { type: 'mqtt', label: 'MQTT', icon: '📡' },
          { type: 'amqp', label: 'AMQP', icon: '🐰' },
          { type: 'kafka', label: 'Kafka', icon: '📢' },
          { type: 'websocket', label: 'WebSocket', icon: '🔌' },
          { type: 'grpc', label: 'gRPC', icon: '⚡' }
        ]
      },
      {
        name: '💡 IA & Analyse',
        nodes: [
          { type: 'nlp-processor', label: 'Processeur NLP', icon: '🧠' },
          { type: 'terminologie-mapper', label: 'Mappeur terminologie', icon: '📚' },
          { type: 'data-enricher', label: 'Enrichisseur données', icon: '✨' },
          { type: 'sentiment-analyzer', label: 'Analyse sentiment', icon: '😀' },
          { type: 'anomaly-detector', label: 'Détection anomalies', icon: '⚠️' },
          { type: 'diagnosis-suggester', label: 'Suggestion diagnostic', icon: '🏥' },
          { type: 'medical-ai', label: 'IA médicale', icon: '🤖' }
        ]
      },
      {
        name: '🧩 Avancé',
        nodes: [
          { type: 'error-handler', label: 'Gestionnaire erreurs', icon: '❌' },
          { type: 'retry-policy', label: 'Politique réessai', icon: '🔄' },
          { type: 'circuit-breaker', label: 'Disjoncteur', icon: '🔌' },
          { type: 'throttle', label: 'Limiteur débit', icon: '🚦' },
          { type: 'cache', label: 'Cache', icon: '💨' },
          { type: 'aggregator', label: 'Agrégateur', icon: '📊' },
          { type: 'scheduler', label: 'Planificateur', icon: '📆' },
          { type: 'subprocess', label: 'Sous-processus', icon: '🔄' }
        ]
      }
    ];
    
    // Créer les catégories
    categories.forEach(category => {
      const categoryDiv = document.createElement('div');
      categoryDiv.className = 'node-palette-category';
      
      const categoryTitle = document.createElement('h4');
      // Ne pas définir le texte du titre ici, il sera défini plus tard avec l'icône
      
      // Ajouter un style pour mettre en évidence les catégories
      categoryTitle.style.background = 'linear-gradient(to right, #f5f5f5, #ffffff)';
      categoryTitle.style.padding = '8px 10px';
      categoryTitle.style.borderLeft = '4px solid #e67e22';
      categoryTitle.style.borderRadius = '4px';
      categoryTitle.style.margin = '10px 0 8px 0';
      categoryTitle.style.fontSize = '14px';
      categoryTitle.style.fontWeight = 'bold';
      categoryTitle.style.cursor = 'pointer';
      
      // Nous utilisons maintenant categoryTitle.onclick plus bas, ne pas ajouter d'écouteur d'événement ici
      
      // Créer un conteneur pour les éléments de nœuds
      const nodesContainer = document.createElement('div');
      nodesContainer.className = 'node-palette-items-container';
      
      // Définir la catégorie comme repliée par défaut
      categoryTitle.setAttribute('data-collapsed', 'true');
      categoryTitle.style.opacity = '0.8';
      categoryTitle.style.cursor = 'pointer';
      
      // Ajouter un indicateur visuel pour montrer que c'est cliquable
      const arrowSpan = document.createElement('span');
      arrowSpan.innerHTML = '▶';
      arrowSpan.style.float = 'right';
      arrowSpan.style.fontSize = '12px';
      arrowSpan.style.marginRight = '5px';
      categoryTitle.appendChild(document.createTextNode(category.name + ' '));
      categoryTitle.appendChild(arrowSpan);
      
      // Ajouter l'événement de clic pour replier/déplier
      categoryTitle.onclick = function() {
        const isCollapsed = this.getAttribute('data-collapsed') === 'true';
        
        if (isCollapsed) {
          // Déplier
          this.setAttribute('data-collapsed', 'false');
          this.style.opacity = '1';
          arrowSpan.innerHTML = '▼';
          nodesContainer.style.display = 'block';
          console.log(`[Workflow] Catégorie "${category.name}" dépliée`);
        } else {
          // Replier
          this.setAttribute('data-collapsed', 'true');
          this.style.opacity = '0.8';
          arrowSpan.innerHTML = '▶';
          nodesContainer.style.display = 'none';
          console.log(`[Workflow] Catégorie "${category.name}" repliée`);
        }
      };
      
      categoryDiv.appendChild(categoryTitle);
      
      // Masquer le conteneur par défaut puisque toutes les catégories sont repliées au début
      nodesContainer.style.display = 'none';
      categoryDiv.appendChild(nodesContainer);
      
      // Créer les éléments de noeuds
      category.nodes.forEach(node => {
        const nodeItem = document.createElement('div');
        nodeItem.className = 'node-palette-item';
        nodeItem.setAttribute('data-node-type', node.type);
        
        // Style amélioré pour les éléments de la palette
        nodeItem.style.display = 'flex';
        nodeItem.style.alignItems = 'center';
        nodeItem.style.padding = '8px 10px';
        nodeItem.style.margin = '0 0 8px 0';
        nodeItem.style.backgroundColor = '#f9f9f9';
        nodeItem.style.border = '1px solid #eee';
        nodeItem.style.borderRadius = '4px';
        nodeItem.style.cursor = 'grab';
        nodeItem.style.transition = 'all 0.2s';
        nodeItem.style.boxShadow = '0 1px 3px rgba(0,0,0,0.05)';
        
        // Effet hover
        nodeItem.addEventListener('mouseenter', () => {
          nodeItem.style.backgroundColor = '#f0f0f0';
          nodeItem.style.transform = 'translateY(-2px)';
          nodeItem.style.boxShadow = '0 3px 6px rgba(0,0,0,0.1)';
          nodeItem.style.borderColor = '#ddd';
        });
        
        nodeItem.addEventListener('mouseleave', () => {
          nodeItem.style.backgroundColor = '#f9f9f9';
          nodeItem.style.transform = 'translateY(0)';
          nodeItem.style.boxShadow = '0 1px 3px rgba(0,0,0,0.05)';
          nodeItem.style.borderColor = '#eee';
        });
        
        const nodeIcon = document.createElement('div');
        nodeIcon.className = 'node-palette-item-icon';
        nodeIcon.textContent = node.icon;
        nodeIcon.style.width = '24px';
        nodeIcon.style.height = '24px';
        nodeIcon.style.marginRight = '10px';
        nodeIcon.style.display = 'flex';
        nodeIcon.style.alignItems = 'center';
        nodeIcon.style.justifyContent = 'center';
        nodeIcon.style.fontSize = '16px';
        
        const nodeLabel = document.createElement('div');
        nodeLabel.className = 'node-palette-item-label';
        nodeLabel.textContent = node.label;
        nodeLabel.style.fontSize = '13px';
        nodeLabel.style.fontWeight = '500';
        
        nodeItem.appendChild(nodeIcon);
        nodeItem.appendChild(nodeLabel);
        nodesContainer.appendChild(nodeItem); // Ajouter au conteneur de nœuds et non directement à la catégorie
        
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
    // Événements de la souris pour le panning et la sélection multiple
    if (this.options.allowPanning) {
      this.container.addEventListener('mousedown', (e) => {
        // Si la touche Shift est enfoncée, on commence une sélection multiple
        if (e.shiftKey && (e.target === this.canvas || e.target === this.nodesLayer || e.target === this.edgesLayer)) {
          this.isSelecting = true;
          
          // Convertir les coordonnées de la souris en coordonnées canvas
          const canvasRect = this.canvas.getBoundingClientRect();
          const scaledX = (e.clientX - canvasRect.left - this.offset.x) / this.scale;
          const scaledY = (e.clientY - canvasRect.top - this.offset.y) / this.scale;
          
          this.selectionStartPoint = { x: scaledX, y: scaledY };
          
          // Créer le rectangle de sélection
          this.selectionRect = document.createElement('div');
          this.selectionRect.className = 'selection-rect';
          this.selectionRect.style.left = `${scaledX}px`;
          this.selectionRect.style.top = `${scaledY}px`;
          this.selectionRect.style.width = '0';
          this.selectionRect.style.height = '0';
          this.canvas.appendChild(this.selectionRect);
          
          console.log("[Workflow] Début de la sélection multiple");
          
          // Empêcher le comportement par défaut
          e.preventDefault();
          
        // Si on clique sur le canvas (pas sur un noeud) sans Shift, on fait du panning
        } else if (e.target === this.canvas || e.target === this.nodesLayer || e.target === this.edgesLayer) {
          // Si on n'est pas en mode sélection, on fait du panning normal
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
          // Panning du canvas
          this.offset.x = e.clientX - this.dragStart.x;
          this.offset.y = e.clientY - this.dragStart.y;
          this.updateTransform();
        } else if (this.isSelecting && this.selectionRect) {
          // Mise à jour du rectangle de sélection
          const canvasRect = this.canvas.getBoundingClientRect();
          const currentX = (e.clientX - canvasRect.left - this.offset.x) / this.scale;
          const currentY = (e.clientY - canvasRect.top - this.offset.y) / this.scale;
          
          const startX = this.selectionStartPoint.x;
          const startY = this.selectionStartPoint.y;
          
          // Calculer la position et les dimensions du rectangle
          const left = Math.min(startX, currentX);
          const top = Math.min(startY, currentY);
          const width = Math.abs(currentX - startX);
          const height = Math.abs(currentY - startY);
          
          // Appliquer les dimensions au rectangle de sélection
          this.selectionRect.style.left = `${left}px`;
          this.selectionRect.style.top = `${top}px`;
          this.selectionRect.style.width = `${width}px`;
          this.selectionRect.style.height = `${height}px`;
          
          // Prévisualiser les nœuds qui seront sélectionnés
          this.updateSelectionPreview({ left, top, width, height });
          
        } else if (this.isCreatingEdge) {
          this.updateTempEdge(e);
        }
      });
      
      document.addEventListener('mouseup', (e) => {
        if (this.isDragging) {
          this.isDragging = false;
          this.container.style.cursor = 'default';
        }
        
        if (this.isSelecting) {
          this.finalizeSelection();
          this.isSelecting = false;
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
    
    // Événement pour supprimer des noeuds sélectionnés avec Delete
    document.addEventListener('keydown', (e) => {
      if ((e.key === 'Delete' || e.key === 'Del' || e.key === 'Suppr') && 
          !e.target.matches('input, textarea, select, [contenteditable="true"]')) {
        const deletedCount = this.deleteSelectedNodes();
        if (deletedCount === 0) {
          // Si on n'a supprimé aucun nœud et qu'une arête est sélectionnée, la supprimer
          if (this.selectedEdgeId) {
            this.deleteEdge(this.selectedEdgeId);
            console.log(`[Workflow] Arête supprimée: ${this.selectedEdgeId}`);
            this.showNotification('Arête supprimée', 'info');
          }
        }
        
        // Empêcher le comportement par défaut de la touche Delete/Suppr
        e.preventDefault();
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
    try {
      // S'assurer que le type est une chaîne valide
      const nodeType = typeof type === 'string' ? type : 'default';
      
      // S'assurer que la position est un objet valide
      const nodePosition = {
        x: position && typeof position.x === 'number' ? position.x : 100,
        y: position && typeof position.y === 'number' ? position.y : 100
      };
      
      // Convertir position à la grille si nécessaire
      if (this.options.snapToGrid) {
        nodePosition.x = Math.round(nodePosition.x / this.options.gridSize) * this.options.gridSize;
        nodePosition.y = Math.round(nodePosition.y / this.options.gridSize) * this.options.gridSize;
      }
      
      // Créer l'objet du noeud
      const nodeId = `node_${this.nextNodeId++}`;
      const nodeConfig = this.getNodeConfig(nodeType);
      
      const node = {
        id: nodeId,
        type: nodeType,
        label: nodeConfig.label || nodeType,
        position: nodePosition,
        width: 180,
        height: 100,
        inputs: nodeConfig.inputs || [],
        outputs: nodeConfig.outputs || [],
        data: {}
      };
      
      console.log(`[Workflow] Création du nœud de type ${nodeType}:`, node);
      
      // Ajouter le noeud à la liste
      this.nodes.push(node);
      console.log(`[Workflow] Après l'ajout du nœud, this.nodes contient ${this.nodes.length} nœuds`);
      
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
    } catch (error) {
      console.error(`[Workflow] Erreur lors de la création du nœud:`, error);
      
      // Créer un nœud générique en cas d'erreur
      const fallbackNode = {
        id: `node_${this.nextNodeId++}`,
        type: 'default',
        label: 'Nœud générique',
        position: { x: 100, y: 100 },
        width: 180,
        height: 100,
        inputs: [{ name: 'input', label: 'Entrée' }],
        outputs: [{ name: 'output', label: 'Sortie' }],
        data: {}
      };
      
      this.nodes.push(fallbackNode);
      this.createNodeElement(fallbackNode);
      return fallbackNode;
    }
  }
  
  /**
   * Obtient la configuration pour un type de noeud
   * @param {string} type - Type de noeud
   * @returns {Object} Configuration du noeud
   */
  getNodeConfig(type) {
    // Configurations par défaut pour les différents types de noeuds
    const configs = {
      // ===== ENTRÉES/SOURCES =====
      'hl7-input': {
        label: 'Entrée HL7',
        inputs: [],
        outputs: [{ name: 'message', label: 'Message' }],
        properties: [
          { name: 'source', label: 'Source', type: 'select', options: ['Manuel', 'Fichier', 'MLLP'], default: 'Manuel' },
          { name: 'format', label: 'Format', type: 'select', options: ['HL7 v2.5', 'HL7 v2.6', 'HL7 v2.3'], default: 'HL7 v2.5' }
        ]
      },
      'hl7-validator': {
        label: 'Validation HL7',
        inputs: [{ name: 'message', label: 'Message' }],
        outputs: [{ name: 'message', label: 'Message' }],
        properties: [
          { name: 'profile', label: 'Profil', type: 'select', options: ['Standard', 'Strict', 'Personnalisé'], default: 'Standard' },
          { name: 'skipInvalid', label: 'Ignorer invalides', type: 'boolean', default: false }
        ]
      },
      'hl7-to-fhir-converter': {
        label: 'Convertisseur FHIR',
        inputs: [{ name: 'message', label: 'Message HL7' }],
        outputs: [{ name: 'fhir', label: 'FHIR' }],
        properties: [
          { name: 'version', label: 'Version FHIR', type: 'select', options: ['R4', 'R5', 'STU3'], default: 'R4' },
          { name: 'mode', label: 'Mode de conversion', type: 'select', options: ['Standard', 'Avancé', 'Personnalisé'], default: 'Standard' }
        ]
      },
      'fhir-validator': {
        label: 'Validation FHIR',
        inputs: [{ name: 'fhir', label: 'FHIR' }],
        outputs: [{ name: 'fhir', label: 'FHIR validé' }],
        properties: [
          { name: 'profile', label: 'Profil', type: 'select', options: ['Base', 'FrenchMoH', 'Personnalisé'], default: 'Base' },
          { name: 'skipInvalid', label: 'Ignorer invalides', type: 'boolean', default: false }
        ]
      },
      'fhir-output': {
        label: 'Sortie FHIR',
        inputs: [{ name: 'fhir', label: 'FHIR' }],
        outputs: [],
        properties: [
          { name: 'destination', label: 'Destination', type: 'select', options: ['API', 'Fichier', 'Base de données'], default: 'API' },
          { name: 'format', label: 'Format', type: 'select', options: ['JSON', 'XML'], default: 'JSON' }
        ]
      },
      'json-input': {
        label: 'Entrée JSON',
        inputs: [],
        outputs: [{ name: 'json', label: 'JSON' }],
        properties: [
          { name: 'source', label: 'Source', type: 'select', options: ['Manuel', 'Fichier', 'API'], default: 'Manuel' },
          { name: 'schema', label: 'Schéma', type: 'text', default: '' }
        ]
      },
      'file-input': {
        label: 'Entrée fichier',
        inputs: [],
        outputs: [{ name: 'content', label: 'Contenu' }],
        properties: [
          { name: 'path', label: 'Chemin', type: 'text', default: '' },
          { name: 'encoding', label: 'Encodage', type: 'select', options: ['UTF-8', 'ISO-8859-1', 'ASCII'], default: 'UTF-8' },
          { name: 'format', label: 'Format', type: 'select', options: ['Texte', 'JSON', 'XML', 'CSV', 'HL7'], default: 'Texte' }
        ]
      },
      'ftp-input': {
        label: 'Entrée FTP',
        inputs: [],
        outputs: [{ name: 'files', label: 'Fichiers' }],
        properties: [
          { name: 'host', label: 'Hôte', type: 'text', default: '' },
          { name: 'port', label: 'Port', type: 'number', default: 21 },
          { name: 'username', label: 'Identifiant', type: 'text', default: '' },
          { name: 'password', label: 'Mot de passe', type: 'password', default: '' },
          { name: 'path', label: 'Chemin', type: 'text', default: '/' },
          { name: 'passive', label: 'Mode passif', type: 'boolean', default: true }
        ]
      },
      'folder-watcher': {
        label: 'Surveiller dossier',
        inputs: [],
        outputs: [{ name: 'file', label: 'Fichier' }],
        properties: [
          { name: 'path', label: 'Chemin', type: 'text', default: '' },
          { name: 'filter', label: 'Filtre', type: 'text', default: '*.*' },
          { name: 'recursive', label: 'Récursif', type: 'boolean', default: false },
          { name: 'interval', label: 'Intervalle (s)', type: 'number', default: 60 }
        ]
      },
      'timer-trigger': {
        label: 'Déclencheur temporel',
        inputs: [],
        outputs: [{ name: 'trigger', label: 'Déclencheur' }],
        properties: [
          { name: 'interval', label: 'Intervalle (s)', type: 'number', default: 60 },
          { name: 'cron', label: 'Expression Cron', type: 'text', default: '' },
          { name: 'payload', label: 'Contenu', type: 'json', default: '{}' }
        ]
      },
      'http-receiver': {
        label: 'Récepteur HTTP',
        inputs: [],
        outputs: [{ name: 'request', label: 'Requête' }],
        properties: [
          { name: 'path', label: 'Chemin', type: 'text', default: '/webhook' },
          { name: 'method', label: 'Méthode', type: 'select', options: ['POST', 'GET', 'PUT', 'DELETE'], default: 'POST' },
          { name: 'auth', label: 'Authentification', type: 'boolean', default: false }
        ]
      },
      
      // ===== CONVERSION =====
      'fhir-converter': {
        label: 'Convertir FHIR',
        inputs: [{ name: 'input', label: 'Entrée' }],
        outputs: [{ name: 'output', label: 'Sortie' }],
        properties: [
          { name: 'inputFormat', label: 'Format d\'entrée', type: 'select', options: ['JSON', 'XML'], default: 'JSON' },
          { name: 'outputFormat', label: 'Format de sortie', type: 'select', options: ['JSON', 'XML'], default: 'JSON' },
          { name: 'version', label: 'Version FHIR', type: 'select', options: ['R4', 'STU3', 'DSTU2'], default: 'R4' }
        ]
      },
      'hl7-to-fhir': {
        label: 'HL7 vers FHIR',
        inputs: [{ name: 'hl7', label: 'HL7' }],
        outputs: [{ name: 'fhir', label: 'FHIR' }],
        properties: [
          { name: 'hl7Version', label: 'Version HL7', type: 'select', options: ['2.5', '2.4', '2.3'], default: '2.5' },
          { name: 'fhirVersion', label: 'Version FHIR', type: 'select', options: ['R4', 'STU3'], default: 'R4' },
          { name: 'profile', label: 'Profil ANS', type: 'boolean', default: true }
        ]
      },
      'fhir-to-hl7': {
        label: 'FHIR vers HL7',
        inputs: [{ name: 'fhir', label: 'FHIR' }],
        outputs: [{ name: 'hl7', label: 'HL7' }],
        properties: [
          { name: 'fhirVersion', label: 'Version FHIR', type: 'select', options: ['R4', 'STU3'], default: 'R4' },
          { name: 'hl7Version', label: 'Version HL7', type: 'select', options: ['2.5', '2.4', '2.3'], default: '2.5' },
          { name: 'encoding', label: 'Encodage', type: 'select', options: ['UTF-8', 'ISO-8859-1'], default: 'UTF-8' }
        ]
      },
      'cda-to-fhir': {
        label: 'CDA vers FHIR',
        inputs: [{ name: 'cda', label: 'CDA' }],
        outputs: [{ name: 'fhir', label: 'FHIR' }],
        properties: [
          { name: 'cdaVersion', label: 'Version CDA', type: 'select', options: ['R2'], default: 'R2' },
          { name: 'fhirVersion', label: 'Version FHIR', type: 'select', options: ['R4', 'STU3'], default: 'R4' }
        ]
      },
      'dicom-to-fhir': {
        label: 'DICOM vers FHIR',
        inputs: [{ name: 'dicom', label: 'DICOM' }],
        outputs: [{ name: 'fhir', label: 'FHIR' }],
        properties: [
          { name: 'extractImages', label: 'Extraire les images', type: 'boolean', default: false },
          { name: 'patientMatch', label: 'Association patient', type: 'boolean', default: true }
        ]
      },
      'xml-to-json': {
        label: 'XML vers JSON',
        inputs: [{ name: 'xml', label: 'XML' }],
        outputs: [{ name: 'json', label: 'JSON' }],
        properties: [
          { name: 'ignoreAttributes', label: 'Ignorer attributs', type: 'boolean', default: false },
          { name: 'parseValues', label: 'Convertir valeurs', type: 'boolean', default: true }
        ]
      },
      'json-to-xml': {
        label: 'JSON vers XML',
        inputs: [{ name: 'json', label: 'JSON' }],
        outputs: [{ name: 'xml', label: 'XML' }],
        properties: [
          { name: 'rootElement', label: 'Élément racine', type: 'text', default: 'root' },
          { name: 'declaration', label: 'Déclaration XML', type: 'boolean', default: true }
        ]
      },
      'template': {
        label: 'Template JSON',
        inputs: [{ name: 'data', label: 'Données' }],
        outputs: [{ name: 'result', label: 'Résultat' }],
        properties: [
          { name: 'template', label: 'Template', type: 'textarea', default: '{}' },
          { name: 'engine', label: 'Moteur', type: 'select', options: ['Handlebars', 'Mustache', 'JSON Path'], default: 'Handlebars' }
        ]
      },
      'custom-script': {
        label: 'Script JS',
        inputs: [{ name: 'input', label: 'Entrée' }],
        outputs: [{ name: 'output', label: 'Sortie' }],
        properties: [
          { name: 'script', label: 'Script', type: 'code', language: 'javascript', default: 'function process(input) {\n  // Traitement\n  return input;\n}' }
        ]
      },
      'xslt-transform': {
        label: 'Transformation XSLT',
        inputs: [{ name: 'xml', label: 'XML' }],
        outputs: [{ name: 'result', label: 'Résultat' }],
        properties: [
          { name: 'xslt', label: 'XSLT', type: 'code', language: 'xml', default: '<xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform">\n  <xsl:template match="/">\n    <!-- Transformation -->\n  </xsl:template>\n</xsl:stylesheet>' }
        ]
      },
      
      // ===== TRAITEMENT =====
      'field-mapper': {
        label: 'Mapper champs',
        inputs: [{ name: 'input', label: 'Entrée' }],
        outputs: [{ name: 'output', label: 'Sortie' }],
        properties: [
          { name: 'mappings', label: 'Mappings', type: 'mappings', default: '[]' },
          { name: 'preserveOriginal', label: 'Préserver données originales', type: 'boolean', default: false }
        ]
      },
      'segment-extractor': {
        label: 'Extraire segment',
        inputs: [{ name: 'hl7', label: 'HL7' }],
        outputs: [{ name: 'segment', label: 'Segment' }],
        properties: [
          { name: 'segmentType', label: 'Type de segment', type: 'text', default: 'PID' },
          { name: 'multiple', label: 'Extraire multiples', type: 'boolean', default: false }
        ]
      },
      'transform': {
        label: 'Transformer',
        inputs: [{ name: 'input', label: 'Entrée' }],
        outputs: [{ name: 'output', label: 'Sortie' }],
        properties: [
          { name: 'operations', label: 'Opérations', type: 'array', default: '[]' }
        ]
      },
      'condition': {
        label: 'Condition',
        inputs: [{ name: 'input', label: 'Entrée' }],
        outputs: [
          { name: 'true', label: 'Vrai' },
          { name: 'false', label: 'Faux' }
        ],
        properties: [
          { name: 'condition', label: 'Condition', type: 'text', default: '' },
          { name: 'expressionType', label: 'Type d\'expression', type: 'select', options: ['JSONPath', 'JavaScript', 'Simple'], default: 'Simple' }
        ]
      },
      'split': {
        label: 'Diviseur',
        inputs: [{ name: 'input', label: 'Entrée' }],
        outputs: [{ name: 'items', label: 'Éléments' }],
        properties: [
          { name: 'path', label: 'Chemin', type: 'text', default: '' },
          { name: 'sendItems', label: 'Envoyer individuellement', type: 'boolean', default: true }
        ]
      },
      'merge': {
        label: 'Fusionner',
        inputs: [
          { name: 'input1', label: 'Entrée 1' },
          { name: 'input2', label: 'Entrée 2' }
        ],
        outputs: [{ name: 'merged', label: 'Fusionné' }],
        properties: [
          { name: 'strategy', label: 'Stratégie', type: 'select', options: ['Concat', 'Merge Objects', 'Join'], default: 'Merge Objects' }
        ]
      },
      'filter': {
        label: 'Filtre',
        inputs: [{ name: 'input', label: 'Entrée' }],
        outputs: [{ name: 'output', label: 'Sortie' }],
        properties: [
          { name: 'criteria', label: 'Critères', type: 'text', default: '' },
          { name: 'type', label: 'Type', type: 'select', options: ['JSONPath', 'JavaScript', 'SQL-like'], default: 'JSONPath' }
        ]
      },
      'validator': {
        label: 'Validateur',
        inputs: [{ name: 'input', label: 'Entrée' }],
        outputs: [
          { name: 'valid', label: 'Valide' },
          { name: 'invalid', label: 'Invalide' }
        ],
        properties: [
          { name: 'rules', label: 'Règles', type: 'array', default: '[]' },
          { name: 'schema', label: 'Schéma', type: 'textarea', default: '' }
        ]
      },
      'sorter': {
        label: 'Trieur',
        inputs: [{ name: 'input', label: 'Entrée' }],
        outputs: [{ name: 'sorted', label: 'Trié' }],
        properties: [
          { name: 'field', label: 'Champ', type: 'text', default: '' },
          { name: 'direction', label: 'Direction', type: 'select', options: ['Ascending', 'Descending'], default: 'Ascending' }
        ]
      },
      'batch-processor': {
        label: 'Traitement par lot',
        inputs: [{ name: 'items', label: 'Éléments' }],
        outputs: [{ name: 'batch', label: 'Lot' }],
        properties: [
          { name: 'size', label: 'Taille du lot', type: 'number', default: 10 },
          { name: 'timeout', label: 'Délai (ms)', type: 'number', default: 1000 }
        ]
      },
      'debatcher': {
        label: 'Décomposition lot',
        inputs: [{ name: 'batch', label: 'Lot' }],
        outputs: [{ name: 'item', label: 'Élément' }],
        properties: [
          { name: 'path', label: 'Chemin', type: 'text', default: '' }
        ]
      },
      
      // ===== INTÉGRATION =====
      'api-call': {
        label: 'Appel API',
        inputs: [{ name: 'input', label: 'Entrée' }],
        outputs: [{ name: 'response', label: 'Réponse' }],
        properties: [
          { name: 'url', label: 'URL', type: 'text', default: '' },
          { name: 'method', label: 'Méthode', type: 'select', options: ['GET', 'POST', 'PUT', 'DELETE'], default: 'GET' },
          { name: 'headers', label: 'En-têtes', type: 'json', default: '{}' },
          { name: 'auth', label: 'Authentification', type: 'select', options: ['None', 'Basic', 'Bearer', 'OAuth2'], default: 'None' }
        ]
      },
      'fhir-output': {
        label: 'Sortie FHIR',
        inputs: [{ name: 'fhir', label: 'FHIR' }],
        outputs: [{ name: 'response', label: 'Réponse' }],
        properties: [
          { name: 'server', label: 'Serveur', type: 'text', default: '' },
          { name: 'resourceType', label: 'Type de ressource', type: 'select', options: ['Patient', 'Observation', 'Encounter', 'Condition', 'Procedure'], default: 'Patient' },
          { name: 'operation', label: 'Opération', type: 'select', options: ['create', 'update', 'search'], default: 'create' }
        ]
      },
      'file-output': {
        label: 'Sortie fichier',
        inputs: [{ name: 'content', label: 'Contenu' }],
        outputs: [{ name: 'result', label: 'Résultat' }],
        properties: [
          { name: 'path', label: 'Chemin', type: 'text', default: '' },
          { name: 'format', label: 'Format', type: 'select', options: ['Auto', 'JSON', 'XML', 'Text'], default: 'Auto' },
          { name: 'encoding', label: 'Encodage', type: 'select', options: ['UTF-8', 'ISO-8859-1'], default: 'UTF-8' }
        ]
      },
      'database-query': {
        label: 'Requête BDD',
        inputs: [{ name: 'params', label: 'Paramètres' }],
        outputs: [{ name: 'results', label: 'Résultats' }],
        properties: [
          { name: 'connection', label: 'Connexion', type: 'select', options: ['Default', 'Custom'], default: 'Default' },
          { name: 'query', label: 'Requête', type: 'textarea', default: 'SELECT * FROM users WHERE id = :id' },
          { name: 'queryType', label: 'Type', type: 'select', options: ['Select', 'Insert', 'Update', 'Delete'], default: 'Select' }
        ]
      },
      'email-sender': {
        label: 'Envoi email',
        inputs: [{ name: 'content', label: 'Contenu' }],
        outputs: [{ name: 'result', label: 'Résultat' }],
        properties: [
          { name: 'to', label: 'Destinataire', type: 'text', default: '' },
          { name: 'subject', label: 'Sujet', type: 'text', default: '' },
          { name: 'from', label: 'Expéditeur', type: 'text', default: '' },
          { name: 'smtp', label: 'Serveur SMTP', type: 'text', default: '' }
        ]
      },
      'sms-sender': {
        label: 'Envoi SMS',
        inputs: [{ name: 'message', label: 'Message' }],
        outputs: [{ name: 'result', label: 'Résultat' }],
        properties: [
          { name: 'to', label: 'Destinataire', type: 'text', default: '' },
          { name: 'provider', label: 'Fournisseur', type: 'select', options: ['Twilio', 'SNS', 'Custom'], default: 'Twilio' }
        ]
      },
      'webhook-sender': {
        label: 'Envoi webhook',
        inputs: [{ name: 'payload', label: 'Contenu' }],
        outputs: [{ name: 'response', label: 'Réponse' }],
        properties: [
          { name: 'url', label: 'URL', type: 'text', default: '' },
          { name: 'headers', label: 'En-têtes', type: 'json', default: '{}' },
          { name: 'method', label: 'Méthode', type: 'select', options: ['POST', 'PUT'], default: 'POST' }
        ]
      },
      'queue-publisher': {
        label: 'Publier file',
        inputs: [{ name: 'message', label: 'Message' }],
        outputs: [{ name: 'result', label: 'Résultat' }],
        properties: [
          { name: 'queue', label: 'File', type: 'text', default: '' },
          { name: 'provider', label: 'Fournisseur', type: 'select', options: ['RabbitMQ', 'SQS', 'Kafka'], default: 'RabbitMQ' }
        ]
      },
      'queue-consumer': {
        label: 'Consommer file',
        inputs: [],
        outputs: [{ name: 'message', label: 'Message' }],
        properties: [
          { name: 'queue', label: 'File', type: 'text', default: '' },
          { name: 'provider', label: 'Fournisseur', type: 'select', options: ['RabbitMQ', 'SQS', 'Kafka'], default: 'RabbitMQ' },
          { name: 'autoAck', label: 'Acquittement auto', type: 'boolean', default: true }
        ]
      },
      
      // ===== SYSTÈMES SANTÉ =====
      'hl7-v2': {
        label: 'HL7 v2.x',
        inputs: [{ name: 'input', label: 'Entrée' }],
        outputs: [{ name: 'output', label: 'Sortie' }],
        properties: [
          { name: 'operation', label: 'Opération', type: 'select', options: ['Parse', 'Generate', 'Validate'], default: 'Parse' },
          { name: 'version', label: 'Version', type: 'select', options: ['2.5', '2.4', '2.3'], default: '2.5' }
        ]
      },
      'hl7-v3': {
        label: 'HL7 v3',
        inputs: [{ name: 'input', label: 'Entrée' }],
        outputs: [{ name: 'output', label: 'Sortie' }],
        properties: [
          { name: 'operation', label: 'Opération', type: 'select', options: ['Parse', 'Generate', 'Validate'], default: 'Parse' },
          { name: 'interactionId', label: 'ID d\'interaction', type: 'text', default: '' }
        ]
      },
      'dicom': {
        label: 'DICOM',
        inputs: [{ name: 'input', label: 'Entrée' }],
        outputs: [{ name: 'output', label: 'Sortie' }],
        properties: [
          { name: 'operation', label: 'Opération', type: 'select', options: ['Parse', 'Store', 'Query', 'Retrieve'], default: 'Parse' },
          { name: 'extractImage', label: 'Extraire image', type: 'boolean', default: false }
        ]
      },
      'sis': {
        label: 'SIH',
        inputs: [{ name: 'request', label: 'Requête' }],
        outputs: [{ name: 'response', label: 'Réponse' }],
        properties: [
          { name: 'system', label: 'Système', type: 'select', options: ['Generic', 'Hexagone', 'WebPIMS', 'Resurgences'], default: 'Generic' },
          { name: 'endpoint', label: 'Point d\'accès', type: 'text', default: '' }
        ]
      },
      'cda': {
        label: 'CDA',
        inputs: [{ name: 'input', label: 'Entrée' }],
        outputs: [{ name: 'output', label: 'Sortie' }],
        properties: [
          { name: 'operation', label: 'Opération', type: 'select', options: ['Parse', 'Generate', 'Validate'], default: 'Parse' },
          { name: 'template', label: 'Template', type: 'text', default: '' }
        ]
      },
      'fhir-r4': {
        label: 'FHIR R4',
        inputs: [{ name: 'input', label: 'Entrée' }],
        outputs: [{ name: 'output', label: 'Sortie' }],
        properties: [
          { name: 'operation', label: 'Opération', type: 'select', options: ['Read', 'Create', 'Update', 'Search'], default: 'Read' },
          { name: 'resourceType', label: 'Type de ressource', type: 'select', options: ['Patient', 'Observation', 'Encounter', 'Condition'], default: 'Patient' }
        ]
      },
      'fhir-dstu2': {
        label: 'FHIR DSTU2',
        inputs: [{ name: 'input', label: 'Entrée' }],
        outputs: [{ name: 'output', label: 'Sortie' }],
        properties: [
          { name: 'operation', label: 'Opération', type: 'select', options: ['Read', 'Create', 'Update', 'Search'], default: 'Read' },
          { name: 'resourceType', label: 'Type de ressource', type: 'select', options: ['Patient', 'Observation', 'Encounter', 'Condition'], default: 'Patient' }
        ]
      },
      'fhir-stu3': {
        label: 'FHIR STU3',
        inputs: [{ name: 'input', label: 'Entrée' }],
        outputs: [{ name: 'output', label: 'Sortie' }],
        properties: [
          { name: 'operation', label: 'Opération', type: 'select', options: ['Read', 'Create', 'Update', 'Search'], default: 'Read' },
          { name: 'resourceType', label: 'Type de ressource', type: 'select', options: ['Patient', 'Observation', 'Encounter', 'Condition'], default: 'Patient' }
        ]
      },
      'loinc-mapper': {
        label: 'Mappeur LOINC',
        inputs: [{ name: 'codes', label: 'Codes' }],
        outputs: [{ name: 'mapped', label: 'Mappés' }],
        properties: [
          { name: 'sourceSystem', label: 'Système source', type: 'text', default: '' },
          { name: 'language', label: 'Langue', type: 'select', options: ['fr-FR', 'en-US'], default: 'fr-FR' }
        ]
      },
      'snomed-mapper': {
        label: 'Mappeur SNOMED',
        inputs: [{ name: 'codes', label: 'Codes' }],
        outputs: [{ name: 'mapped', label: 'Mappés' }],
        properties: [
          { name: 'sourceSystem', label: 'Système source', type: 'text', default: '' },
          { name: 'edition', label: 'Édition', type: 'select', options: ['International', 'France'], default: 'France' }
        ]
      },
      'french-nih': {
        label: 'NIH Français',
        inputs: [{ name: 'patient', label: 'Patient' }],
        outputs: [{ name: 'result', label: 'Résultat' }],
        properties: [
          { name: 'operation', label: 'Opération', type: 'select', options: ['Search', 'Create', 'Validate'], default: 'Search' },
          { name: 'method', label: 'Méthode', type: 'select', options: ['INSi', 'INSI-SOAP', 'Manual'], default: 'INSi' }
        ]
      },
      'dmp-export': {
        label: 'Export DMP',
        inputs: [{ name: 'document', label: 'Document' }],
        outputs: [{ name: 'result', label: 'Résultat' }],
        properties: [
          { name: 'documentType', label: 'Type de document', type: 'select', options: ['CR-BIO', 'CR-RAD', 'LDL-EES', 'LDL-SES'], default: 'CR-BIO' },
          { name: 'patientConsent', label: 'Consentement patient', type: 'boolean', default: true }
        ]
      },
      'rpps-lookup': {
        label: 'Recherche RPPS',
        inputs: [{ name: 'query', label: 'Requête' }],
        outputs: [{ name: 'practitioner', label: 'Praticien' }],
        properties: [
          { name: 'type', label: 'Type', type: 'select', options: ['RPPS', 'ADELI'], default: 'RPPS' },
          { name: 'source', label: 'Source', type: 'select', options: ['ANS', 'Local', 'API'], default: 'ANS' }
        ]
      },
      'mssante': {
        label: 'MSSanté',
        inputs: [{ name: 'message', label: 'Message' }],
        outputs: [{ name: 'result', label: 'Résultat' }],
        properties: [
          { name: 'operation', label: 'Opération', type: 'select', options: ['Send', 'Receive', 'Search'], default: 'Send' },
          { name: 'endpoint', label: 'Point d\'accès', type: 'text', default: '' }
        ]
      },
      'ins-lookup': {
        label: 'Recherche INS',
        inputs: [{ name: 'patient', label: 'Patient' }],
        outputs: [{ name: 'ins', label: 'INS' }],
        properties: [
          { name: 'method', label: 'Méthode', type: 'select', options: ['TRAITS', 'CARTE-VITALE', 'PDSm'], default: 'TRAITS' },
          { name: 'source', label: 'Source', type: 'select', options: ['Téléservice', 'Local'], default: 'Téléservice' }
        ]
      },
      'sesam-vitale': {
        label: 'SESAM-Vitale',
        inputs: [{ name: 'request', label: 'Requête' }],
        outputs: [{ name: 'response', label: 'Réponse' }],
        properties: [
          { name: 'operation', label: 'Opération', type: 'select', options: ['ReadCard', 'Invoice', 'Status'], default: 'ReadCard' },
          { name: 'apiVersion', label: 'Version API', type: 'select', options: ['1.40', '1.31'], default: '1.40' }
        ]
      },
      
      // ===== SÉCURITÉ =====
      'authentication': {
        label: 'Authentification',
        inputs: [{ name: 'credentials', label: 'Identifiants' }],
        outputs: [
          { name: 'success', label: 'Succès' },
          { name: 'failure', label: 'Échec' }
        ],
        properties: [
          { name: 'method', label: 'Méthode', type: 'select', options: ['Basic', 'OAuth2', 'JWT', 'SAML'], default: 'Basic' },
          { name: 'provider', label: 'Fournisseur', type: 'text', default: '' }
        ]
      },
      'authorization': {
        label: 'Autorisation',
        inputs: [{ name: 'request', label: 'Requête' }],
        outputs: [
          { name: 'allowed', label: 'Autorisé' },
          { name: 'denied', label: 'Refusé' }
        ],
        properties: [
          { name: 'rules', label: 'Règles', type: 'json', default: '[]' },
          { name: 'role', label: 'Rôle requis', type: 'text', default: '' }
        ]
      },
      'encryption': {
        label: 'Chiffrement',
        inputs: [{ name: 'data', label: 'Données' }],
        outputs: [{ name: 'encrypted', label: 'Chiffré' }],
        properties: [
          { name: 'algorithm', label: 'Algorithme', type: 'select', options: ['AES-256', 'RSA', 'ChaCha20'], default: 'AES-256' },
          { name: 'keySource', label: 'Source de la clé', type: 'select', options: ['Secret', 'KeyStore', 'HSM'], default: 'Secret' }
        ]
      },
      'decryption': {
        label: 'Déchiffrement',
        inputs: [{ name: 'encrypted', label: 'Chiffré' }],
        outputs: [{ name: 'decrypted', label: 'Déchiffré' }],
        properties: [
          { name: 'algorithm', label: 'Algorithme', type: 'select', options: ['AES-256', 'RSA', 'ChaCha20'], default: 'AES-256' },
          { name: 'keySource', label: 'Source de la clé', type: 'select', options: ['Secret', 'KeyStore', 'HSM'], default: 'Secret' }
        ]
      },
      'anonymizer': {
        label: 'Anonymisation',
        inputs: [{ name: 'data', label: 'Données' }],
        outputs: [{ name: 'anonymized', label: 'Anonymisé' }],
        properties: [
          { name: 'level', label: 'Niveau', type: 'select', options: ['Complet', 'Partiel', 'Pseudonymisation'], default: 'Complet' },
          { name: 'fields', label: 'Champs', type: 'array', default: '[]' }
        ]
      },
      'data-masking': {
        label: 'Masquage données',
        inputs: [{ name: 'data', label: 'Données' }],
        outputs: [{ name: 'masked', label: 'Masqué' }],
        properties: [
          { name: 'rules', label: 'Règles', type: 'json', default: '[]' },
          { name: 'method', label: 'Méthode', type: 'select', options: ['Hash', 'Redact', 'Substitute'], default: 'Redact' }
        ]
      },
      'logger': {
        label: 'Journalisation',
        inputs: [{ name: 'event', label: 'Événement' }],
        outputs: [{ name: 'logged', label: 'Journalisé' }],
        properties: [
          { name: 'level', label: 'Niveau', type: 'select', options: ['INFO', 'WARNING', 'ERROR', 'DEBUG'], default: 'INFO' },
          { name: 'destination', label: 'Destination', type: 'select', options: ['File', 'Database', 'Service'], default: 'File' }
        ]
      },
      'audit-trail': {
        label: 'Piste d\'audit',
        inputs: [{ name: 'action', label: 'Action' }],
        outputs: [{ name: 'audit', label: 'Audit' }],
        properties: [
          { name: 'includeUser', label: 'Inclure utilisateur', type: 'boolean', default: true },
          { name: 'storePayload', label: 'Stocker contenu', type: 'boolean', default: false }
        ]
      },
      
      // ===== CONNECTEURS =====
      'soap': {
        label: 'SOAP Client',
        inputs: [{ name: 'request', label: 'Requête' }],
        outputs: [{ name: 'response', label: 'Réponse' }],
        properties: [
          { name: 'wsdl', label: 'WSDL', type: 'text', default: '' },
          { name: 'operation', label: 'Opération', type: 'text', default: '' },
          { name: 'auth', label: 'Authentification', type: 'select', options: ['None', 'Basic', 'WSSecurity'], default: 'None' }
        ]
      },
      'rest': {
        label: 'REST Client',
        inputs: [{ name: 'request', label: 'Requête' }],
        outputs: [{ name: 'response', label: 'Réponse' }],
        properties: [
          { name: 'url', label: 'URL', type: 'text', default: '' },
          { name: 'method', label: 'Méthode', type: 'select', options: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'], default: 'GET' },
          { name: 'headers', label: 'En-têtes', type: 'json', default: '{}' }
        ]
      },
      'sftp': {
        label: 'SFTP',
        inputs: [{ name: 'input', label: 'Entrée' }],
        outputs: [{ name: 'output', label: 'Sortie' }],
        properties: [
          { name: 'host', label: 'Hôte', type: 'text', default: '' },
          { name: 'port', label: 'Port', type: 'number', default: 22 },
          { name: 'username', label: 'Identifiant', type: 'text', default: '' },
          { name: 'operation', label: 'Opération', type: 'select', options: ['Get', 'Put', 'List'], default: 'Get' }
        ]
      },
      'mllp': {
        label: 'MLLP',
        inputs: [{ name: 'message', label: 'Message' }],
        outputs: [{ name: 'response', label: 'Réponse' }],
        properties: [
          { name: 'host', label: 'Hôte', type: 'text', default: '' },
          { name: 'port', label: 'Port', type: 'number', default: 2575 },
          { name: 'mode', label: 'Mode', type: 'select', options: ['Client', 'Server'], default: 'Client' }
        ]
      },
      'jdbc': {
        label: 'JDBC',
        inputs: [{ name: 'query', label: 'Requête' }],
        outputs: [{ name: 'results', label: 'Résultats' }],
        properties: [
          { name: 'connection', label: 'Connexion', type: 'text', default: '' },
          { name: 'driver', label: 'Pilote', type: 'select', options: ['MySQL', 'PostgreSQL', 'Oracle', 'SQLite'], default: 'PostgreSQL' }
        ]
      },
      'ldap': {
        label: 'LDAP',
        inputs: [{ name: 'query', label: 'Requête' }],
        outputs: [{ name: 'results', label: 'Résultats' }],
        properties: [
          { name: 'url', label: 'URL', type: 'text', default: '' },
          { name: 'baseDN', label: 'DN de base', type: 'text', default: '' },
          { name: 'operation', label: 'Opération', type: 'select', options: ['Search', 'Add', 'Modify', 'Delete'], default: 'Search' }
        ]
      },
      'mqtt': {
        label: 'MQTT',
        inputs: [{ name: 'message', label: 'Message' }],
        outputs: [{ name: 'received', label: 'Reçu' }],
        properties: [
          { name: 'broker', label: 'Broker', type: 'text', default: '' },
          { name: 'topic', label: 'Sujet', type: 'text', default: '' },
          { name: 'qos', label: 'QoS', type: 'select', options: ['0', '1', '2'], default: '1' }
        ]
      },
      'amqp': {
        label: 'AMQP',
        inputs: [{ name: 'message', label: 'Message' }],
        outputs: [{ name: 'received', label: 'Reçu' }],
        properties: [
          { name: 'url', label: 'URL', type: 'text', default: '' },
          { name: 'exchange', label: 'Exchange', type: 'text', default: '' },
          { name: 'queue', label: 'Queue', type: 'text', default: '' }
        ]
      },
      'kafka': {
        label: 'Kafka',
        inputs: [{ name: 'message', label: 'Message' }],
        outputs: [{ name: 'received', label: 'Reçu' }],
        properties: [
          { name: 'brokers', label: 'Brokers', type: 'text', default: '' },
          { name: 'topic', label: 'Sujet', type: 'text', default: '' },
          { name: 'groupId', label: 'ID de groupe', type: 'text', default: '' }
        ]
      },
      'websocket': {
        label: 'WebSocket',
        inputs: [{ name: 'message', label: 'Message' }],
        outputs: [{ name: 'received', label: 'Reçu' }],
        properties: [
          { name: 'url', label: 'URL', type: 'text', default: '' },
          { name: 'mode', label: 'Mode', type: 'select', options: ['Client', 'Server'], default: 'Client' }
        ]
      },
      'grpc': {
        label: 'gRPC',
        inputs: [{ name: 'request', label: 'Requête' }],
        outputs: [{ name: 'response', label: 'Réponse' }],
        properties: [
          { name: 'endpoint', label: 'Point d\'accès', type: 'text', default: '' },
          { name: 'service', label: 'Service', type: 'text', default: '' },
          { name: 'method', label: 'Méthode', type: 'text', default: '' }
        ]
      },
      
      // ===== IA & ANALYSE =====
      'nlp-processor': {
        label: 'Processeur NLP',
        inputs: [{ name: 'text', label: 'Texte' }],
        outputs: [{ name: 'analysis', label: 'Analyse' }],
        properties: [
          { name: 'operation', label: 'Opération', type: 'select', options: ['Entities', 'Sentiment', 'Keywords', 'Summary'], default: 'Entities' },
          { name: 'language', label: 'Langue', type: 'select', options: ['fr', 'en', 'auto'], default: 'fr' },
          { name: 'model', label: 'Modèle', type: 'select', options: ['Mistral', 'Claude', 'GPT-4o', 'Local'], default: 'Mistral' }
        ]
      },
      'terminologie-mapper': {
        label: 'Mappeur terminologie',
        inputs: [{ name: 'terms', label: 'Termes' }],
        outputs: [{ name: 'mapped', label: 'Mappés' }],
        properties: [
          { name: 'source', label: 'Source', type: 'text', default: '' },
          { name: 'target', label: 'Cible', type: 'text', default: '' },
          { name: 'method', label: 'Méthode', type: 'select', options: ['Exact', 'Fuzzy', 'AI'], default: 'Exact' }
        ]
      },
      'data-enricher': {
        label: 'Enrichisseur données',
        inputs: [{ name: 'data', label: 'Données' }],
        outputs: [{ name: 'enriched', label: 'Enrichies' }],
        properties: [
          { name: 'sources', label: 'Sources', type: 'array', default: '[]' },
          { name: 'strategy', label: 'Stratégie', type: 'select', options: ['Auto', 'Override', 'Merge'], default: 'Auto' }
        ]
      },
      'sentiment-analyzer': {
        label: 'Analyse sentiment',
        inputs: [{ name: 'text', label: 'Texte' }],
        outputs: [{ name: 'sentiment', label: 'Sentiment' }],
        properties: [
          { name: 'language', label: 'Langue', type: 'select', options: ['fr', 'en', 'auto'], default: 'fr' },
          { name: 'model', label: 'Modèle', type: 'select', options: ['Basic', 'Advanced', 'Medical'], default: 'Medical' }
        ]
      },
      'anomaly-detector': {
        label: 'Détection anomalies',
        inputs: [{ name: 'data', label: 'Données' }],
        outputs: [
          { name: 'normal', label: 'Normal' },
          { name: 'anomaly', label: 'Anomalie' }
        ],
        properties: [
          { name: 'method', label: 'Méthode', type: 'select', options: ['Statistical', 'ML', 'Rule-based'], default: 'Statistical' },
          { name: 'sensitivity', label: 'Sensibilité', type: 'number', default: 0.5 }
        ]
      },
      'diagnosis-suggester': {
        label: 'Suggestion diagnostic',
        inputs: [{ name: 'observations', label: 'Observations' }],
        outputs: [{ name: 'suggestions', label: 'Suggestions' }],
        properties: [
          { name: 'model', label: 'Modèle', type: 'select', options: ['Local', 'Mistral', 'Claude', 'GPT-4o'], default: 'Mistral' },
          { name: 'confidence', label: 'Seuil de confiance', type: 'number', default: 0.7 }
        ]
      },
      'medical-ai': {
        label: 'IA médicale',
        inputs: [{ name: 'data', label: 'Données' }],
        outputs: [{ name: 'analysis', label: 'Analyse' }],
        properties: [
          { name: 'model', label: 'Modèle', type: 'select', options: ['General', 'Radiology', 'Pathology', 'Cardiology'], default: 'General' },
          { name: 'operation', label: 'Opération', type: 'select', options: ['Analysis', 'Prediction', 'Classification'], default: 'Analysis' }
        ]
      },
      
      // ===== AVANCÉ =====
      'error-handler': {
        label: 'Gestionnaire erreurs',
        inputs: [{ name: 'error', label: 'Erreur' }],
        outputs: [
          { name: 'handled', label: 'Traitée' },
          { name: 'escalated', label: 'Escaladée' }
        ],
        properties: [
          { name: 'retryCount', label: 'Nombre de réessais', type: 'number', default: 3 },
          { name: 'logErrors', label: 'Journaliser erreurs', type: 'boolean', default: true },
          { name: 'errorTypes', label: 'Types d\'erreurs', type: 'array', default: '["all"]' }
        ]
      },
      'retry-policy': {
        label: 'Politique réessai',
        inputs: [{ name: 'action', label: 'Action' }],
        outputs: [
          { name: 'success', label: 'Succès' },
          { name: 'failure', label: 'Échec final' }
        ],
        properties: [
          { name: 'maxRetries', label: 'Nombre max', type: 'number', default: 3 },
          { name: 'delayMs', label: 'Délai initial (ms)', type: 'number', default: 1000 },
          { name: 'backoffFactor', label: 'Facteur d\'augmentation', type: 'number', default: 2 }
        ]
      },
      'circuit-breaker': {
        label: 'Disjoncteur',
        inputs: [{ name: 'action', label: 'Action' }],
        outputs: [
          { name: 'success', label: 'Succès' },
          { name: 'failure', label: 'Échec' },
          { name: 'open', label: 'Circuit ouvert' }
        ],
        properties: [
          { name: 'failureThreshold', label: 'Seuil d\'échecs', type: 'number', default: 5 },
          { name: 'resetTimeoutMs', label: 'Délai de réinitialisation (ms)', type: 'number', default: 30000 }
        ]
      },
      'throttle': {
        label: 'Limiteur débit',
        inputs: [{ name: 'input', label: 'Entrée' }],
        outputs: [{ name: 'output', label: 'Sortie' }],
        properties: [
          { name: 'rate', label: 'Débit', type: 'number', default: 10 },
          { name: 'per', label: 'Par', type: 'select', options: ['second', 'minute', 'hour'], default: 'second' },
          { name: 'burst', label: 'Rafale', type: 'number', default: 1 }
        ]
      },
      'cache': {
        label: 'Cache',
        inputs: [{ name: 'input', label: 'Entrée' }],
        outputs: [{ name: 'output', label: 'Sortie' }],
        properties: [
          { name: 'ttl', label: 'TTL (s)', type: 'number', default: 300 },
          { name: 'keyField', label: 'Champ clé', type: 'text', default: 'id' },
          { name: 'storageType', label: 'Type de stockage', type: 'select', options: ['Memory', 'Redis', 'File'], default: 'Memory' }
        ]
      },
      'aggregator': {
        label: 'Agrégateur',
        inputs: [{ name: 'input', label: 'Entrée' }],
        outputs: [{ name: 'aggregated', label: 'Agrégé' }],
        properties: [
          { name: 'strategy', label: 'Stratégie', type: 'select', options: ['Count', 'Batch', 'Correlation', 'Time'], default: 'Batch' },
          { name: 'count', label: 'Nombre', type: 'number', default: 10 },
          { name: 'timeoutMs', label: 'Délai (ms)', type: 'number', default: 60000 }
        ]
      },
      'scheduler': {
        label: 'Planificateur',
        inputs: [{ name: 'job', label: 'Tâche' }],
        outputs: [{ name: 'trigger', label: 'Déclencheur' }],
        properties: [
          { name: 'schedule', label: 'Planification', type: 'select', options: ['Interval', 'Cron', 'Once'], default: 'Interval' },
          { name: 'value', label: 'Valeur', type: 'text', default: '60' },
          { name: 'timezone', label: 'Fuseau horaire', type: 'text', default: 'Europe/Paris' }
        ]
      },
      'subprocess': {
        label: 'Sous-processus',
        inputs: [{ name: 'input', label: 'Entrée' }],
        outputs: [{ name: 'output', label: 'Sortie' }],
        properties: [
          { name: 'workflowId', label: 'ID du workflow', type: 'text', default: '' },
          { name: 'waitForCompletion', label: 'Attendre', type: 'boolean', default: true }
        ]
      },

      // Configuration par défaut pour les nouveaux types de noeuds
      'default': {
        label: 'Noeud générique',
        inputs: [{ name: 'input', label: 'Entrée' }],
        outputs: [{ name: 'output', label: 'Sortie' }],
        properties: []
      }
    };
    
    return configs[type] || { label: type, inputs: [], outputs: [] };
  }
  
  /**
   * Crée l'élément DOM pour un noeud
   * @param {Object} node - Noeud à créer
   * @returns {HTMLElement} L'élément DOM créé
   */
  createNodeElement(node) {
    try {
      // Vérifier que le nœud est un objet valide
      if (!node || typeof node !== 'object') {
        console.error('[Workflow] Nœud invalide:', node);
        return null;
      }
      
      // Vérifier que le nœud a un ID valide
      if (!node.id || typeof node.id !== 'string') {
        console.error('[Workflow] ID de nœud invalide:', node);
        return null;
      }
      
      // Vérifier que le nœud a une position valide
      if (!node.position || typeof node.position !== 'object' || 
          typeof node.position.x !== 'number' || typeof node.position.y !== 'number') {
        console.error('[Workflow] Position de nœud invalide:', node);
        node.position = { x: 100, y: 100 }; // Valeur par défaut
      }
      
      // S'assurer que les tableaux inputs et outputs existent
      node.inputs = Array.isArray(node.inputs) ? node.inputs : [];
      node.outputs = Array.isArray(node.outputs) ? node.outputs : [];
      
      // S'assurer que les données existent
      node.data = node.data || {};
      
      // Créer l'élément DOM principal pour le nœud
      const nodeElement = document.createElement('div');
      nodeElement.id = node.id;
      nodeElement.className = 'node';
      nodeElement.style.left = `${node.position.x}px`;
      nodeElement.style.top = `${node.position.y}px`;
      nodeElement.style.width = node.width ? `${node.width}px` : '180px';
      
      // En-tête du noeud
    const nodeHeader = document.createElement('div');
    nodeHeader.className = 'node-header';
    
    const nodeTitle = document.createElement('div');
    nodeTitle.className = 'node-title';
    nodeTitle.textContent = node.label;
    
    const nodeType = document.createElement('div');
    nodeType.className = 'node-type';
    nodeType.textContent = node.type;
    
    // Ajouter un bouton de suppression dans l'en-tête
    const deleteButton = document.createElement('button');
    deleteButton.className = 'node-delete-btn';
    deleteButton.innerHTML = '&times;'; // Symbole × (croix)
    deleteButton.title = 'Supprimer ce nœud';
    deleteButton.addEventListener('click', (e) => {
      e.stopPropagation(); // Empêcher la propagation pour ne pas sélectionner le nœud
      // Demander confirmation avant suppression
      if (confirm(`Voulez-vous vraiment supprimer ce nœud "${node.label}"?`)) {
        this.deleteNode(node.id);
        this.showNotification('Nœud supprimé', 'info');
      }
    });
    
    nodeHeader.appendChild(nodeTitle);
    nodeHeader.appendChild(nodeType);
    nodeHeader.appendChild(deleteButton);
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
    return nodeElement;
  } catch (error) {
    console.error('[Workflow] Erreur lors de la création du nœud:', error);
    return null;
  }
}
  
  /**
   * Met à jour l'aperçu de la sélection pendant le déplacement de la souris
   * @param {Object} rect - Rectangle de sélection {left, top, width, height}
   */
  updateSelectionPreview(rect) {
    // Remettre à zéro les sélections visuelles temporaires
    this.nodes.forEach(node => {
      const nodeElement = document.getElementById(node.id);
      if (nodeElement) {
        nodeElement.classList.remove('multi-selected');
      }
    });
    
    // Appliquer une prévisualisation aux noeuds qui seront sélectionnés
    this.nodes.forEach(node => {
      if (this.isNodeInSelectionRect(node, rect)) {
        const nodeElement = document.getElementById(node.id);
        if (nodeElement) {
          nodeElement.classList.add('multi-selected');
        }
      }
    });
  }
  
  /**
   * Vérifie si un noeud est dans le rectangle de sélection
   * @param {Object} node - Noeud à vérifier
   * @param {Object} rect - Rectangle de sélection {left, top, width, height}
   * @returns {boolean} Vrai si le noeud est dans le rectangle
   */
  isNodeInSelectionRect(node, rect) {
    // Si le noeud n'est pas valide, il n'est pas dans la sélection
    if (!node || !node.position) return false;
    
    // Calculer les coordonnées du noeud
    const nodeLeft = node.position.x;
    const nodeTop = node.position.y;
    const nodeWidth = 180; // Largeur par défaut, à améliorer en récupérant la taille réelle
    const nodeHeight = 100; // Hauteur par défaut, à améliorer en récupérant la taille réelle
    const nodeRight = nodeLeft + nodeWidth;
    const nodeBottom = nodeTop + nodeHeight;
    
    // Calculer les coordonnées du rectangle de sélection
    const rectRight = rect.left + rect.width;
    const rectBottom = rect.top + rect.height;
    
    // Vérifier si le noeud est entièrement contenu dans le rectangle
    return (
      nodeLeft >= rect.left &&
      nodeTop >= rect.top &&
      nodeRight <= rectRight &&
      nodeBottom <= rectBottom
    );
  }
  
  /**
   * Finalise la sélection multiple
   */
  finalizeSelection() {
    if (!this.selectionRect) return;
    
    // Récupérer les dimensions du rectangle de sélection
    const rect = {
      left: parseFloat(this.selectionRect.style.left),
      top: parseFloat(this.selectionRect.style.top),
      width: parseFloat(this.selectionRect.style.width),
      height: parseFloat(this.selectionRect.style.height)
    };
    
    // Supprimer le rectangle de sélection
    this.selectionRect.remove();
    this.selectionRect = null;
    
    // Collecter les noeuds sélectionnés
    this.selectedNodes = this.nodes.filter(node => this.isNodeInSelectionRect(node, rect));
    
    // Mettre à jour visuellement les nœuds sélectionnés
    this.nodes.forEach(node => {
      const nodeElement = document.getElementById(node.id);
      if (nodeElement) {
        nodeElement.classList.remove('multi-selected');
      }
    });
    
    // Si des nœuds sont sélectionnés, appliquer la classe multi-selected
    if (this.selectedNodes.length > 0) {
      this.selectedNodes.forEach(node => {
        const nodeElement = document.getElementById(node.id);
        if (nodeElement) {
          nodeElement.classList.add('multi-selected');
        }
      });
      
      console.log(`[Workflow] ${this.selectedNodes.length} nœuds sélectionnés`);
    } else {
      console.log(`[Workflow] Aucun nœud sélectionné`);
    }
  }
    
  /**
   * Désélectionne tous les noeuds
   */
  deselectAllNodes() {
    if (this.selectedNodeId) {
      const prevNode = document.getElementById(this.selectedNodeId);
      if (prevNode) {
        prevNode.classList.remove('selected');
      }
      this.selectedNodeId = null;
    }
    
    // Désélectionner tous les nœuds en sélection multiple
    this.selectedNodes.forEach(node => {
      const nodeElement = document.getElementById(node.id);
      if (nodeElement) {
        nodeElement.classList.remove('multi-selected');
      }
    });
    
    this.selectedNodes = [];
  }
  
  /**
   * Supprime tous les nœuds sélectionnés
   * @returns {number} Le nombre de nœuds supprimés
   */
  deleteSelectedNodes() {
    if (this.selectedNodes.length === 0) {
      // Si aucun nœud n'est sélectionné en multi-sélection, 
      // tenter de supprimer le nœud sélectionné individuellement
      if (this.selectedNodeId) {
        this.deleteNode(this.selectedNodeId);
        return 1;
      }
      return 0;
    }
    
    // Créer une copie du tableau pour éviter les problèmes lors de la suppression
    const nodesToDelete = [...this.selectedNodes];
    const count = nodesToDelete.length;
    
    // Supprimer chaque nœud
    nodesToDelete.forEach(node => {
      this.deleteNode(node.id);
    });
    
    // Vider la liste des nœuds sélectionnés
    this.selectedNodes = [];
    
    console.log(`[Workflow] ${count} nœuds supprimés`);
    this.showNotification(`${count} nœuds supprimés`, 'info');
    
    return count;
  }
  
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
    
    // Désélectionner tous les nœuds en sélection multiple
    this.selectedNodes.forEach(node => {
      const nodeElement = document.getElementById(node.id);
      if (nodeElement) {
        nodeElement.classList.remove('multi-selected');
      }
    });
    this.selectedNodes = [];
    
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
      
      // Validation complète des positions - notre méthode getPortPosition améliorée ne devrait plus
      // jamais retourner null, mais nous validons quand même par sécurité
      if (!sourcePortPosition || !targetPortPosition ||
          typeof sourcePortPosition.x !== 'number' || typeof sourcePortPosition.y !== 'number' ||
          typeof targetPortPosition.x !== 'number' || typeof targetPortPosition.y !== 'number') {
        console.warn("[Workflow] Positions des ports invalides pour l'arête:", edge.id);
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
      // Vérifications préliminaires robustes
      if (!node) {
        console.warn("[Workflow] Nœud inexistant pour calcul de position de port");
        // Retourner une position par défaut au lieu de null
        return { x: 0, y: 0 };
      }
      
      // S'assurer que le nœud a toujours une position valide
      if (!node.position || typeof node.position.x !== 'number' || typeof node.position.y !== 'number') {
        console.warn("[Workflow] Nœud avec position invalide, utilisation position par défaut");
        // Fournir une position par défaut
        node.position = { x: 0, y: 0 };
      }
      
      // Taille par défaut si non spécifiée
      const width = (node.width && typeof node.width === 'number') ? node.width : 200;
      const height = (node.height && typeof node.height === 'number') ? node.height : 100;
      
      // Vérifier l'élément DOM du nœud
      const nodeElem = document.getElementById(node.id);
      if (!nodeElem) {
        console.warn(`[Workflow] Élément DOM non trouvé pour le nœud: ${node.id}`);
        // Position de fallback calculée à partir de la position du nœud
        if (isOutput) {
          return {
            x: node.position.x + width,
            y: node.position.y + (height / 2) + (portIndex * 20)
          };
        } else {
          return {
            x: node.position.x,
            y: node.position.y + (height / 2) + (portIndex * 20)
          };
        }
      }
      
      // Vérifier que portIndex est un nombre valide
      portIndex = typeof portIndex === 'number' ? portIndex : 0;
      
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
      
      try {
        // Obtention des rectangles avec gestion d'erreurs
        const portRect = portElem.getBoundingClientRect();
        const nodeRect = nodeElem.getBoundingClientRect();
        
        if (!portRect || !nodeRect || !portRect.width || !nodeRect.width) {
          throw new Error("Calcul de rectangles invalide");
        }
        
        // Calculer la position relative du port par rapport au nœud
        const portRelativeX = portRect.left - nodeRect.left + (portRect.width / 2);
        const portRelativeY = portRect.top - nodeRect.top + (portRect.height / 2);
        
        // Vérification supplémentaire que les valeurs sont des nombres
        if (isNaN(portRelativeX) || isNaN(portRelativeY) || 
            isNaN(node.position.x) || isNaN(node.position.y)) {
          throw new Error("Valeurs de position non numériques");
        }
        
        // Calculer la position absolue du port en fonction de la position du nœud
        return {
          x: node.position.x + portRelativeX,
          y: node.position.y + portRelativeY
        };
      } catch (rectError) {
        console.warn("[Workflow] Erreur lors du calcul des rectangles:", rectError);
        
        // Position de fallback en cas d'erreur
        if (isOutput) {
          return {
            x: node.position.x + width,
            y: node.position.y + (height / 2) + (portIndex * 20)
          };
        } else {
          return {
            x: node.position.x,
            y: node.position.y + (height / 2) + (portIndex * 20)
          };
        }
      }
    } catch (err) {
      console.error("[Workflow] Erreur générale lors du calcul de la position du port:", err);
      // En cas d'erreur générale, toujours retourner une position valide
      return { x: 0, y: 0 };
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
   * avec un style visuel distinctif pour une meilleure expérience utilisateur
   */
  createTempEdge() {
    // Créer un groupe SVG pour l'arête temporaire
    this.tempEdge = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    this.tempEdge.setAttribute('class', 'temp-edge');
    
    // Créer le chemin SVG avec les attributs stylisés dès la création
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('stroke', '#ff5722');  // Couleur rouge-orange selon l'identité visuelle
    path.setAttribute('stroke-width', '3');
    path.setAttribute('stroke-dasharray', '7,3');  // Ligne pointillée plus distinctive
    path.setAttribute('fill', 'none');
    path.style.strokeLinecap = 'round';  // Extrémités arrondies pour un style plus doux
    
    // Ajouter le chemin au groupe
    this.tempEdge.appendChild(path);
    
    // Ajouter le groupe au calque SVG
    this.edgesLayer.appendChild(this.tempEdge);
    
    // Log pour le débogage
    console.log('[Workflow] Arête temporaire créée');
  }
  
  /**
   * Met à jour la position et l'affichage de l'arête temporaire durant le glisser-déposer
   * Utilise requestAnimationFrame pour optimiser les performances d'animation
   * @param {MouseEvent} e - Événement de la souris
   */
  updateTempEdge(e) {
    // Vérifications de base
    if (!this.tempEdge || !this.sourceNodeId) {
      return;
    }
    
    // Si une mise à jour est déjà prévue, ne pas en programmer une autre
    if (this.tempEdgeUpdateScheduled) {
      return;
    }
    
    // Marquer qu'une mise à jour est en cours
    this.tempEdgeUpdateScheduled = true;
    
    // Utiliser requestAnimationFrame pour optimiser les performances d'animation
    requestAnimationFrame(() => {
      try {
        // Réinitialiser le flag
        this.tempEdgeUpdateScheduled = false;
        
        // 1. Récupérer les données du nœud source
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
        
        // Même si getPortPosition ne devrait plus jamais retourner null, vérification par sécurité
        if (!start || typeof start.x !== 'number' || typeof start.y !== 'number') {
          console.warn("[Workflow] Position de départ invalide pour l'arête temporaire");
          return;
        }
        
        // 2. Conversion précise des coordonnées de la souris en coordonnées canvas
        // Utiliser le container comme référence de base
        const containerRect = this.container.getBoundingClientRect();
        
        // Calculer les coordonnées dans l'espace du canvas avec une meilleure précision
        // Cette formule corrige le problème de diagonale en tenant compte correctement
        // de l'échelle et du décalage
        const end = {
          x: (e.clientX - containerRect.left) / this.scale - this.offset.x / this.scale,
          y: (e.clientY - containerRect.top) / this.scale - this.offset.y / this.scale
        };
        
        // 3. Calculer une courbe de Bézier élégante
        const dx = Math.abs(end.x - start.x);
        const controlDistance = Math.min(dx * 0.5, 100);
        
        // S'assurer que la chaîne reste sur une seule ligne pour éviter les problèmes de SVG
        const d = `M ${start.x} ${start.y} C ${start.x + controlDistance} ${start.y}, ${end.x - controlDistance} ${end.y}, ${end.x} ${end.y}`;
        
        // 4. Mettre à jour le chemin avec des attributs visuels améliorés
        const path = this.tempEdge.querySelector('path');
        if (path) {
          path.setAttribute('d', d);
          // Améliorer la visibilité du fil temporaire avec une couleur plus vive
          // Gradient de couleur dans le style visuel de l'application (rouge-orange)
          path.setAttribute('stroke', '#ff5722');
          path.setAttribute('stroke-width', '3');
          path.setAttribute('stroke-dasharray', '7,3');
          path.setAttribute('fill', 'none');
          // Ajouter une animation légère pour mieux indiquer qu'il s'agit d'un fil temporaire
          path.style.strokeLinecap = 'round';
          // Pas d'animation pour éviter des problèmes de performance
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
      } catch (error) {
        console.error('[Workflow] Erreur dans updateTempEdge:', error);
      }
    });
  }
  
  /**
   * Nettoie les surlignages des ports
   */
  clearPortHighlights() {
    document.querySelectorAll('.port-handle.highlight').forEach(port => {
      port.classList.remove('highlight');
    });
  };
  
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
    // Récupérer les propriétés du nœud depuis la configuration centralisée
    const nodeConfig = this.getNodeConfig(nodeType);
    
    // Si la configuration contient des propriétés, les utiliser
    if (nodeConfig && nodeConfig.properties && Array.isArray(nodeConfig.properties)) {
      return nodeConfig.properties.map(prop => {
        // Convertir les options de type select en format attendu par l'interface
        if (prop.type === 'select' && Array.isArray(prop.options)) {
          return {
            ...prop,
            options: prop.options.map(opt => {
              if (typeof opt === 'string') {
                return { value: opt, label: opt };
              }
              return opt;
            })
          };
        }
        return prop;
      });
    }
    
    // Configuration par défaut pour les différents types de nœuds (pour compatibilité rétroactive)
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
    
    // Essayer d'abord la configuration centralisée, puis l'ancienne configuration, sinon retourner un tableau vide
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
            // Correction: utilisation de self.offset au lieu de self.pan
            const x = (newLeft - self.offset.x) / self.scale;
            const y = (newTop - self.offset.y) / self.scale;
            
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
  zoom(scale, center = { x: this.container.clientWidth / 2, y: this.container.clientHeight / 2 }, animate = false) {
    // Désactivation complète de l'animation pour régler les problèmes de performance
    // et éliminer les erreurs liées aux coordonnées

    try {
      const oldScale = this.scale;
      
      // Calculer la nouvelle échelle
      const targetScale = oldScale * scale;
      
      // Limiter l'échelle
      const newScale = Math.max(this.options.minScale, Math.min(this.options.maxScale, targetScale));
      
      // Si l'échelle n'a pas changé, sortir
      if (newScale === oldScale) {
        return;
      }
      
      // Vérification défensive des coordonnées du centre
      const centerX = typeof center.x === 'number' ? center.x : this.container.clientWidth / 2;
      const centerY = typeof center.y === 'number' ? center.y : this.container.clientHeight / 2;
      
      // Calculer les décalages cibles avec vérification numérique
      const targetOffsetX = centerX - (centerX - this.offset.x) * (newScale / oldScale);
      const targetOffsetY = centerY - (centerY - this.offset.y) * (newScale / oldScale);
      
      // Appliquer immédiatement les changements sans animation
      this.scale = newScale;
      this.offset.x = isNaN(targetOffsetX) ? this.offset.x : targetOffsetX;
      this.offset.y = isNaN(targetOffsetY) ? this.offset.y : targetOffsetY;
      
      // Mettre à jour le canvas
      this.updateTransform();
      
      // Mettre à jour les arêtes après un court délai pour laisser le temps au DOM de s'actualiser
      setTimeout(() => {
        try {
          this.updateEdges();
        } catch (edgeError) {
          console.warn("[Workflow] Erreur lors de la mise à jour des arêtes après zoom:", edgeError);
        }
      }, 50);
    } catch (error) {
      console.error("[Workflow] Erreur de zoom:", error);
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
    try {
      // Réinitialiser l'échelle à la valeur initiale
      this.scale = this.options.initialScale;
      
      // Si des nœuds existent, centrer sur eux
      if (this.nodes.length > 0) {
        // Calculer les limites du groupe de nœuds
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        
        this.nodes.forEach(node => {
          // Vérification défensive des valeurs
          if (node && node.position && typeof node.position.x === 'number' && typeof node.position.y === 'number') {
            const nodeWidth = (typeof node.width === 'number') ? node.width : 180;
            const nodeHeight = (typeof node.height === 'number') ? node.height : 100;
            
            minX = Math.min(minX, node.position.x);
            maxX = Math.max(maxX, node.position.x + nodeWidth);
            minY = Math.min(minY, node.position.y);
            maxY = Math.max(maxY, node.position.y + nodeHeight);
          }
        });
        
        // Vérifier que nous avons des valeurs valides
        if (minX !== Infinity && maxX !== -Infinity && minY !== Infinity && maxY !== -Infinity) {
          // Calculer le centre du groupe de nœuds
          const centerNodesX = minX + (maxX - minX) / 2;
          const centerNodesY = minY + (maxY - minY) / 2;
          
          console.log(`[Workflow] Vue réinitialisée sur les nœuds (${centerNodesX}, ${centerNodesY})`);
          
          // Centrer directement sans animation pour plus de stabilité
          this.centerCanvas({ x: centerNodesX, y: centerNodesY }, false);
        } else {
          // Valeurs invalides, centrer sur le point par défaut
          console.log('[Workflow] Vue réinitialisée au centre par défaut (valeurs invalides)');
          this.centerCanvas(null, false);
        }
      } else {
        // Pas de nœuds, centrer sur le milieu du canvas
        console.log('[Workflow] Vue réinitialisée au centre par défaut (pas de nœuds)');
        this.centerCanvas(null, false);
      }
    } catch (error) {
      console.error('[Workflow] Erreur lors de la réinitialisation de la vue:', error);
      // En cas d'erreur, réinitialiser aux valeurs par défaut
      this.scale = 1;
      this.offset = { x: 0, y: 0 };
      this.updateTransform();
    }
  }
  
  /**
   * Met à jour la transformation du canvas
   */
  updateTransform() {
    try {
      // Vérifier que les valeurs sont numériques et valides
      const offsetX = isNaN(this.offset.x) ? 0 : this.offset.x;
      const offsetY = isNaN(this.offset.y) ? 0 : this.offset.y;
      const scale = isNaN(this.scale) ? 1 : this.scale;
      
      // Appliquer les transformations au canvas avec l'origine au point (0,0)
      this.canvas.style.transformOrigin = '0 0';
      
      // Utiliser matrix3d pour une meilleure performance (évite les recalculs intermédiaires)
      // Format: matrix3d(scaleX, 0, 0, 0, 0, scaleY, 0, 0, 0, 0, 1, 0, translateX, translateY, 0, 1)
      this.canvas.style.transform = `matrix3d(${scale}, 0, 0, 0, 0, ${scale}, 0, 0, 0, 0, 1, 0, ${offsetX}, ${offsetY}, 0, 1)`;
    } catch (error) {
      console.error('[Workflow] Erreur lors de la mise à jour des transformations:', error);
      // Réinitialiser en cas d'erreur
      this.canvas.style.transform = 'none';
    }
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
      
      // Stocker l'ID du workflow de manière robuste
      this.workflowId = workflow.id;
      this.workflowName = workflow.name;
      this.workflowDescription = workflow.description || '';
      
      // Stockage redondant pour garantir la persistance de l'ID
      window.currentWorkflowId = workflow.id;
      sessionStorage.setItem('currentWorkflowId', workflow.id);
      console.log('[WorkflowEditor] ID du workflow chargé et enregistré:', workflow.id);
      
      // Effacer les noeuds et arêtes existants
      this.clearWorkflow();
      
      // Charger les noeuds et arêtes
      let flowData;
      try {
        // Si flow_json est une chaîne, essayer de la parser
        // Sinon, utiliser directement l'objet
        if (typeof workflow.flow_json === 'string') {
          try {
            flowData = JSON.parse(workflow.flow_json);
            console.log('[DEBUG] flow_json parsé depuis une chaîne:', flowData);
          } catch (parseError) {
            console.error('[DEBUG] Erreur de parsing du JSON:', parseError);
            flowData = { nodes: [], edges: [] };
          }
        } else {
          // Utiliser directement l'objet
          flowData = workflow.flow_json;
          console.log('[DEBUG] flow_json utilisé directement comme objet:', flowData);
        }
      } catch (e) {
        console.error('Erreur lors du traitement du flow_json du workflow:', e);
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
   * Charge un template de workflow prédéfini
   * @param {Object} templateData - Les données du template
   */
  loadTemplate(templateData) {
    try {
      console.log('[Workflow] Chargement du template:', templateData);
      this.showLoading(true);
      
      // Effacer les noeuds et arêtes existants
      this.clearWorkflow();
      
      // Marquer le workflow comme nouveau (il faudra le sauvegarder)
      this.workflowId = null; // Pas d'ID car c'est un nouveau workflow
      this.workflowName = 'Nouveau workflow'; // Nom par défaut
      this.workflowDescription = 'Créé à partir d\'un template'; // Description par défaut
      
      // Adapter au format approprié - les templates peuvent être sous forme template.flow ou directement template
      const flowData = templateData.flow || templateData;
      
      // Vérifier que nous avons des noeuds et des arêtes dans le template
      if (!flowData.nodes || !Array.isArray(flowData.nodes)) {
        console.error('[Workflow] Format de template invalide:', flowData);
        throw new Error('Format de template invalide: nodes manquant ou invalide');
      }
      
      if (flowData.nodes.length > 0) {
        // Trouver le prochain ID à utiliser
        const nodeIds = flowData.nodes.map(node => {
          // Supporter les deux formats "node-1" et "node_1"
          const idMatch = node.id.match(/node[-_](\d+)/);
          return idMatch ? parseInt(idMatch[1]) : 0;
        });
        this.nextNodeId = nodeIds.length > 0 ? Math.max(...nodeIds) + 1 : 1;
        
        // Créer tous les noeuds
        flowData.nodes.forEach(node => {
          // Vérifier que le type et la position sont valides
          if (!node.type || !node.position) {
            console.warn(`[Workflow] Nœud invalide ignoré:`, node);
            return;
          }
          
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
      
      // Créer les arêtes après un délai pour permettre au DOM de se mettre à jour
      if (flowData.edges && Array.isArray(flowData.edges)) {
        // Trouver le prochain ID à utiliser
        const edgeIds = flowData.edges.map(edge => {
          // Supporter les deux formats "edge-1" et "edge_1"
          const idMatch = edge.id.match(/edge[-_](\d+)/);
          return idMatch ? parseInt(idMatch[1]) : 0;
        });
        this.nextEdgeId = edgeIds.length > 0 ? Math.max(...edgeIds) + 1 : 1;
        
        // Stockons les arêtes à créer
        const edgesToCreate = [...flowData.edges];
        
        // Log d'information pour le débogage
        console.log(`[Workflow] Création de ${edgesToCreate.length} arêtes à partir du template...`);
        
        // Fonction pour vérifier si tous les éléments DOM des nœuds sont prêts
        const areNodesReady = () => {
          const allNodesExist = this.nodes.every(node => {
            const nodeElement = document.getElementById(node.id);
            return !!nodeElement;
          });
          
          return allNodesExist;
        };
        
        // Fonction pour créer les arêtes
        const createEdges = () => {
          if (areNodesReady()) {
            // Toutes les nœuds sont prêts, on peut créer les arêtes
            edgesToCreate.forEach(edge => {
              try {
                // Vérifier si les indices de sourceOutput et targetInput sont des nombres
                const sourceOutputIndex = typeof edge.sourceOutput === 'number' ? edge.sourceOutput : 0;
                const targetInputIndex = typeof edge.targetInput === 'number' ? edge.targetInput : 0;
                
                // Créer l'arête avec des valeurs par défaut si nécessaire
                this.createEdge(edge.source, edge.target, sourceOutputIndex, targetInputIndex);
                
                console.log(`[Workflow] Arête créée: ${edge.source} -> ${edge.target}`);
              } catch (err) {
                console.error(`[Workflow] Erreur lors de la création de l'arête: ${err.message}`);
              }
            });
            
            // Log de confirmation
            console.log('[Workflow] Toutes les arêtes créées à partir du template');
            this.showLoading(false);
            
            // Notifier
            this.showNotification('Template chargé avec succès', 'success');
            
            // Émettre l'événement de changement de workflow
            this.emit('workflowChanged', { 
              nodes: this.nodes, 
              edges: this.edges 
            });
          } else {
            // Les nœuds ne sont pas encore prêts, on réessaye après un délai
            console.log('[Workflow] Nœuds pas encore prêts, attente...');
            setTimeout(createEdges, 100);
          }
        };
        
        // Lancer la création des arêtes
        setTimeout(createEdges, 100);
      } else {
        this.showLoading(false);
      }
      
      // Centrer le workflow
      this.centerWorkflow();
      
    } catch (error) {
      console.error('Erreur lors du chargement du template:', error);
      this.showNotification('Erreur lors du chargement du template: ' + error.message, 'error');
      this.showLoading(false);
    }
  }
  
  /**
   * Centre la vue sur l'ensemble du workflow
   * Calcule le centre de tous les nœuds et ajuste la vue
   */
  centerWorkflow() {
    if (this.nodes.length === 0) {
      // S'il n'y a pas de nœuds, centrer simplement la vue
      this.centerCanvas();
      return;
    }
    
    // Calculer les limites du workflow (min/max x/y)
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    
    this.nodes.forEach(node => {
      minX = Math.min(minX, node.position.x);
      maxX = Math.max(maxX, node.position.x + 180); // Largeur approximative d'un nœud
      minY = Math.min(minY, node.position.y);
      maxY = Math.max(maxY, node.position.y + 100); // Hauteur approximative d'un nœud
    });
    
    // Calculer le centre du workflow
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    
    // Centrer la vue sur ce point
    this.centerCanvas({ x: centerX, y: centerY }, true);
    
    console.log(`[Workflow] Centrage du workflow (${this.nodes.length} nœuds, centre: ${centerX.toFixed(0)},${centerY.toFixed(0)})`);
  }
  
  /**
   * Sauvegarde le workflow sur le serveur
   */
  async saveWorkflow() {
    // Vérifier à partir de plusieurs sources
    if (!this.workflowId) {
      console.log('[DEBUG] WorkflowId non défini dans l\'instance, recherche alternative en utilisant toutes les sources disponibles...');
      
      // 1. Essayer de récupérer depuis la propriété statique de l'éditeur
      if (this.staticWorkflowId) {
        console.log('[DEBUG] ID du workflow récupéré depuis la propriété statique de l\'éditeur:', this.staticWorkflowId);
        this.workflowId = this.staticWorkflowId;
      }
      // 2. Essayer de récupérer depuis le champ caché dans le DOM
      else if (document.getElementById('current-workflow-id-field')) {
        const hiddenFieldValue = document.getElementById('current-workflow-id-field').value;
        console.log('[DEBUG] ID du workflow récupéré depuis le champ caché:', hiddenFieldValue);
        this.workflowId = hiddenFieldValue;
      }
      // 3. Essayer de récupérer depuis les options d'initialisation
      else if (this.options && this.options.workflowId) {
        console.log('[DEBUG] ID du workflow récupéré depuis les options d\'initialisation:', this.options.workflowId);
        this.workflowId = this.options.workflowId;
      }
      // 4. Essayer de récupérer depuis la variable globale window.currentWorkflowId
      else if (window.currentWorkflowId) {
        console.log('[DEBUG] ID du workflow récupéré depuis window.currentWorkflowId:', window.currentWorkflowId);
        this.workflowId = window.currentWorkflowId;
      } 
      // 5. Essayer de récupérer depuis l'attribut data-workflow-id de la modal
      else if (document.getElementById('editor-modal') && document.getElementById('editor-modal').getAttribute('data-workflow-id')) {
        const editorModal = document.getElementById('editor-modal');
        const modalWorkflowId = editorModal.getAttribute('data-workflow-id');
        
        console.log('[DEBUG] ID du workflow récupéré depuis data-workflow-id de la modal:', modalWorkflowId);
        this.workflowId = modalWorkflowId;
      }
      // 6. Essayer de récupérer directement depuis la propriété de la modal
      else if (document.getElementById('editor-modal') && document.getElementById('editor-modal').workflowId) {
        const editorModal = document.getElementById('editor-modal');
        console.log('[DEBUG] ID du workflow récupéré depuis la propriété workflowId de la modal:', editorModal.workflowId);
        this.workflowId = editorModal.workflowId;
      }
      // 7. Essayer de récupérer depuis sessionStorage
      else if (sessionStorage.getItem('currentWorkflowId')) {
        const storedId = sessionStorage.getItem('currentWorkflowId');
        console.log('[DEBUG] ID du workflow récupéré depuis sessionStorage:', storedId);
        this.workflowId = storedId;
      }
      // 8. Essayer de récupérer depuis l'URL
      else if (window.location.search) {
        const urlParams = new URLSearchParams(window.location.search);
        const urlWorkflowId = urlParams.get('editWorkflow');
        
        if (urlWorkflowId) {
          console.log('[DEBUG] ID du workflow récupéré depuis l\'URL:', urlWorkflowId);
          this.workflowId = urlWorkflowId;
        }
      }
      // 9. Échec - impossible de récupérer l'ID du workflow après vérification de toutes les sources
      else {
        this.showNotification('Impossible de sauvegarder: aucun workflow chargé', 'error');
        console.error('[DEBUG] Aucun ID de workflow trouvé dans aucune source');
        
        // Diagnostic complet de toutes les sources possibles
        console.log('[DEBUG] === DIAGNOSTIC COMPLET DES SOURCES D\'ID ===');
        console.log('[DEBUG] this.workflowId:', this.workflowId);
        console.log('[DEBUG] this.staticWorkflowId:', this.staticWorkflowId);
        console.log('[DEBUG] Champ caché:', document.getElementById('current-workflow-id-field') ? document.getElementById('current-workflow-id-field').value : 'Non trouvé');
        console.log('[DEBUG] this.options.workflowId:', this.options ? this.options.workflowId : 'Options non définies');
        console.log('[DEBUG] window.currentWorkflowId:', window.currentWorkflowId);
        
        const editorModal = document.getElementById('editor-modal');
        if (editorModal) {
          console.log('[DEBUG] Modal data-workflow-id:', editorModal.getAttribute('data-workflow-id'));
          console.log('[DEBUG] Modal propriété workflowId:', editorModal.workflowId);
        } else {
          console.log('[DEBUG] Modal non trouvée');
        }
        
        console.log('[DEBUG] sessionStorage - currentWorkflowId:', sessionStorage.getItem('currentWorkflowId'));
        console.log('[DEBUG] URL params:', window.location.search);
        console.log('[DEBUG] ========================================');
        
        return;
      }
    }
    
    try {
      this.showLoading(true);
      console.log('[DEBUG] Début de la sauvegarde du workflow ID:', this.workflowId);
      
      // Préparer les données du workflow en utilisant getConfig() pour garantir la bonne structure
      const flowData = this.getConfig();
      
      // Afficher des logs détaillés pour diagnostiquer le problème
      console.log('[DEBUG] État actuel des nœuds dans l\'instance:', this.nodes);
      console.log('[DEBUG] Structure du workflow à sauvegarder:', flowData);
      console.log('[DEBUG] Nombre de nœuds:', flowData.nodes ? flowData.nodes.length : 0, 
                 'Nombre d\'arêtes:', flowData.edges ? flowData.edges.length : 0);
      
      const workflowData = {
        name: this.workflowName,
        description: this.workflowDescription,
        flow_json: flowData  // Envoi direct de l'objet sans JSON.stringify pour éviter la double sérialisation
      };
      
      console.log('[DEBUG] Données du workflow à envoyer:', workflowData);
      
      // Obtenir le token d'authentification selon la méthode disponible
      let token = null;
      if (typeof getToken === 'function') {
        token = getToken(); // Fonction définie dans workflows.html
        console.log('[DEBUG] Token obtenu via getToken()', token ? 'Présent' : 'Absent');
      } else if (window.FHIRHubAuth && typeof window.FHIRHubAuth.getAuthToken === 'function') {
        token = window.FHIRHubAuth.getAuthToken(); // Fonction globale du système d'auth
        console.log('[DEBUG] Token obtenu via FHIRHubAuth', token ? 'Présent' : 'Absent');
      } else if (localStorage.getItem('token')) {
        token = localStorage.getItem('token'); // Accès direct au localStorage
        console.log('[DEBUG] Token obtenu via localStorage', token ? 'Présent' : 'Absent');
      } else {
        console.log('[DEBUG] Aucun token disponible');
      }
      
      // Envoyer les données au serveur
      console.log('[DEBUG] Envoi de la requête PUT à:', `/api/workflows/${this.workflowId}`);
      
      const headers = {
        'Content-Type': 'application/json',
        'X-API-KEY': 'dev-key'
      };
      
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      
      console.log('[DEBUG] Headers de la requête:', headers);
      
      try {
        const response = await fetch(`/api/workflows/${this.workflowId}`, {
          method: 'PUT',
          headers: headers,
          body: JSON.stringify(workflowData)
        });
        
        console.log('[DEBUG] Status de la réponse:', response.status, response.statusText);
        
        const responseText = await response.text();
        console.log('[DEBUG] Réponse brute:', responseText);
        
        if (!response.ok) {
          let errorMessage = 'Erreur lors de la sauvegarde du workflow';
          try {
            const errorData = JSON.parse(responseText);
            errorMessage = errorData.error || errorData.message || errorMessage;
            console.error('[DEBUG] Détails de l\'erreur:', errorData);
          } catch (parseError) {
            console.error('[DEBUG] Impossible de parser la réponse JSON:', parseError);
          }
          throw new Error(errorMessage);
        }
        
        try {
          const responseData = JSON.parse(responseText);
          console.log('[DEBUG] Données de réponse parsées:', responseData);
        } catch (parseError) {
          console.log('[DEBUG] La réponse n\'est pas au format JSON');
        }
        
        this.showNotification('Workflow sauvegardé avec succès', 'success');
        this.emit('workflowSaved', flowData);
      } catch (fetchError) {
        console.error('[DEBUG] Erreur réseau lors de la sauvegarde:', fetchError);
        throw fetchError;
      }
      
      this.showLoading(false);
    } catch (error) {
      console.error('[DEBUG] Erreur globale lors de la sauvegarde du workflow:', error);
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
   * Retourne la configuration courante du workflow (nœuds + arêtes)
   * @returns {{nodes: Array, edges: Array}}
   */
  getConfig() {
    console.log('[DEBUG] getConfig() appelé - Nœuds:', this.nodes.length, 'Arêtes:', this.edges.length);
    return {
      nodes: this.nodes,
      edges: this.edges
    };
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
      notification.classList.add('visible');
    }, 10);
    
    // Supprimer après un délai
    setTimeout(() => {
      notification.classList.remove('show');
      notification.classList.remove('visible');
      setTimeout(() => {
        notification.remove();
      }, 300);
    }, 3000);
  }
  
  /**
   * Charge un template de workflow dans l'éditeur
   * Cette méthode est appelée par le gestionnaire de templates
   * @param {Object} templateData - Données du template à charger
   */
  loadTemplate(templateData) {
    console.log('[WorkflowEditor] Chargement d\'un template:', templateData);
    
    try {
      // Vérifier que les données sont au bon format
      let flowData = templateData;
      
      // Si c'est une chaîne, tenter de la parser
      if (typeof templateData === 'string') {
        flowData = JSON.parse(templateData);
      }
      
      // Vider l'éditeur actuel
      this.clearAllNodes();
      
      // Plusieurs formats possibles
      // 1. Tableau d'objets {type: 'node'} ou {type: 'edge'}
      if (Array.isArray(flowData)) {
        console.log('[WorkflowEditor] Chargement du format tableau');
        // Première passe: charger tous les noeuds
        const nodeMap = new Map();
        
        // Compter les noeuds
        const nodeCount = flowData.filter(item => item.type === 'node').length;
        console.log(`[WorkflowEditor] ${nodeCount} noeuds à créer`);
        
        // Créer les noeuds
        flowData.forEach(item => {
          if (item.type === 'node') {
            try {
              // Créer le noeud
              const nodeType = item.nodeType || 'default';
              const position = item.position || { x: 100, y: 100 };
              const data = item.data || {};
              
              console.log(`[WorkflowEditor] Création du noeud ${nodeType} à la position (${position.x}, ${position.y})`);
              
              const newNode = this.addNode(nodeType, position, data);
              
              // Mémoriser pour la seconde passe
              nodeMap.set(item.id, newNode.id);
              console.log(`[WorkflowEditor] Noeud créé avec succès: ${item.id} -> ${newNode.id}`);
            } catch (error) {
              console.error(`[WorkflowEditor] Erreur lors de la création du noeud ${item.nodeType}:`, error);
            }
          }
        });
        
        // Deuxième passe: créer les liens
        const edgeCount = flowData.filter(item => item.type === 'edge').length;
        console.log(`[WorkflowEditor] ${edgeCount} liens à créer`);
        
        setTimeout(() => {
          flowData.forEach(item => {
            if (item.type === 'edge') {
              try {
                // Récupérer les IDs des noeuds
                const sourceId = nodeMap.get(item.source);
                const targetId = nodeMap.get(item.target);
                
                if (sourceId && targetId) {
                  // Créer le lien
                  console.log(`[WorkflowEditor] Création d'un lien de ${sourceId} à ${targetId}`);
                  this.createEdge(
                    sourceId,
                    targetId,
                    item.sourceHandle || 0,
                    item.targetHandle || 0
                  );
                } else {
                  console.warn(`[WorkflowEditor] Impossible de créer le lien: source=${sourceId}, target=${targetId}`);
                }
              } catch (error) {
                console.error('[WorkflowEditor] Erreur lors de la création du lien:', error);
              }
            }
          });
          
          // Centrer la vue sur le graph
          this.centerGraph();
          
          console.log('[WorkflowEditor] Template chargé avec succès');
          this.showNotification('Template chargé avec succès', 'success');
        }, 500); // Délai pour s'assurer que les noeuds sont bien rendus
        
        return true;
      } 
      // 2. Objet avec propriétés nodes et edges
      else if (flowData.nodes && Array.isArray(flowData.nodes)) {
        console.log('[WorkflowEditor] Chargement du format objet');
        // Créer une carte pour suivre les correspondances d'ID
        const nodeMap = new Map();
        
        // Première passe: créer tous les nœuds
        console.log(`[WorkflowEditor] ${flowData.nodes.length} noeuds à créer`);
        
        flowData.nodes.forEach(nodeTemplate => {
          try {
            // Créer le nœud avec sa position et son type
            const nodeType = nodeTemplate.type || 'default';
            const position = nodeTemplate.position || { x: 200, y: 200 };
            const data = nodeTemplate.data || {};
            
            console.log(`[WorkflowEditor] Création du noeud ${nodeType} à la position (${position.x}, ${position.y})`);
            
            const newNode = this.addNode(nodeType, position, data);
            
            // Enregistrer la correspondance des IDs
            nodeMap.set(nodeTemplate.id, newNode.id);
            console.log(`[WorkflowEditor] Noeud créé avec succès: ${nodeTemplate.id} -> ${newNode.id}`);
          } catch (error) {
            console.error(`[WorkflowEditor] Erreur lors de l'ajout du nœud ${nodeTemplate.type}:`, error);
          }
        });
        
        // Deuxième passe: créer les connexions
        if (flowData.edges && Array.isArray(flowData.edges)) {
          console.log(`[WorkflowEditor] ${flowData.edges.length} liens à créer`);
          
          setTimeout(() => {
            flowData.edges.forEach(edgeTemplate => {
              try {
                // Obtenir les nouveaux IDs
                const sourceId = nodeMap.get(edgeTemplate.source);
                const targetId = nodeMap.get(edgeTemplate.target);
                
                if (sourceId && targetId) {
                  // Créer la connexion
                  console.log(`[WorkflowEditor] Création d'un lien de ${sourceId} à ${targetId}`);
                  this.createEdge(
                    sourceId, 
                    targetId, 
                    edgeTemplate.sourceOutput || 0, 
                    edgeTemplate.targetInput || 0
                  );
                } else {
                  console.warn(`[WorkflowEditor] Impossible de créer le lien: source=${sourceId}, target=${targetId}`);
                }
              } catch (error) {
                console.error('[WorkflowEditor] Erreur lors de la création de la connexion:', error);
              }
            });
            
            // Centrer le workflow
            this.centerGraph();
            
            console.log('[WorkflowEditor] Template chargé avec succès');
            this.showNotification('Template chargé avec succès', 'success');
          }, 500); // Délai pour s'assurer que les noeuds sont bien rendus
        }
        
        return true;
      } else {
        console.error('[WorkflowEditor] Format de template invalide:', flowData);
        this.showNotification('Format de template invalide', 'error');
        return false;
      }
    } catch (error) {
      console.error('[WorkflowEditor] Erreur lors du chargement du template:', error);
      this.showNotification('Erreur lors du chargement du template: ' + error.message, 'error');
      return false;
    }
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