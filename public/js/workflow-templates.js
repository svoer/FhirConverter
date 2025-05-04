/**
 * Gestion des templates de workflow pour l'éditeur visuel FHIRHub
 * 
 * Ce module gère la boîte de dialogue de sélection des templates, leur chargement
 * et leur application à l'éditeur visuel de workflow.
 */

// Créer un objet global templateManager
window.templateManager = (function() {
    // Référence à la boîte de dialogue de templates
    let templateDialog = null;
    // Référence à l'éditeur de workflow
    let workflowEditor = null;
    // Liste des templates disponibles
    let templates = [];
    // Catégorie actuellement sélectionnée
    let currentCategory = 'all';
    // Template actuellement sélectionné
    let selectedTemplateId = null;
    // Indique si le gestionnaire est initialisé
    let isInitialized = false;

    /**
     * Initialise le gestionnaire de templates
     * @param {Object} editor - Instance de l'éditeur de workflow
     */
    function initialize(editor) {
        console.log('[TemplateManager] Initialisation avec l\'éditeur:', editor);
        
        if (!editor) {
            console.error('[TemplateManager] Erreur: editor est undefined lors de l\'initialisation');
            return false;
        }
        
        // Stocker l'éditeur pour une utilisation ultérieure
        workflowEditor = editor;
        
        // Créer la boîte de dialogue des templates si elle n'existe pas déjà
        if (!isInitialized || !templateDialog) {
            createTemplateDialog();
        }
        
        // Charger les données des templates
        loadTemplateData();
        
        // Marquer comme initialisé
        isInitialized = true;
        
        console.log('[TemplateManager] Initialisation réussie avec l\'éditeur');
        return true;
    }
    
    // Initialiser les templates de base au démarrage (même sans éditeur)
    loadTemplateData();

    /**
     * Crée la boîte de dialogue de sélection des templates
     * @returns {boolean} - Indique si la création a réussi
     */
    function createTemplateDialog() {
        console.log('[TemplateManager] Tentative de création de la boîte de dialogue des templates');
        
        try {
            // Vérifier si la boîte de dialogue existe déjà
            const existingDialog = document.getElementById('template-dialog');
            if (existingDialog) {
                console.log('[TemplateManager] Boîte de dialogue existante trouvée');
                templateDialog = existingDialog;
                return true;
            }

            console.log('[TemplateManager] Création d\'une nouvelle boîte de dialogue');
            
            // Créer la boîte de dialogue
            templateDialog = document.createElement('div');
            templateDialog.id = 'template-dialog';
            templateDialog.className = 'template-dialog';
            templateDialog.style.display = 'none';

            // Structure de la boîte de dialogue
            templateDialog.innerHTML = `
                <div class="template-dialog-content">
                    <div class="template-dialog-header">
                        <h3>Sélectionner un template de workflow</h3>
                        <button class="close-dialog" id="close-template-dialog">&times;</button>
                    </div>
                    <div class="template-dialog-body">
                        <div class="template-filter">
                            <div class="category-filter">
                                <label>Catégorie:</label>
                                <select id="template-category-filter">
                                    <option value="all">Tous les templates</option>
                                    <option value="conversion">Conversion HL7</option>
                                    <option value="integration">Intégration des systèmes</option>
                                    <option value="interoperability">Interopérabilité</option>
                                    <option value="ai">Intelligence artificielle</option>
                                </select>
                            </div>
                            <div class="template-search">
                                <input type="text" placeholder="Rechercher..." id="template-search">
                                <i class="fas fa-search search-icon"></i>
                            </div>
                        </div>
                        <div class="templates-container" id="templates-container">
                            <div class="loading-templates">
                                <div class="spinner"></div>
                                <p>Chargement des templates...</p>
                            </div>
                        </div>
                    </div>
                    <div class="template-dialog-footer">
                        <button id="cancel-template-selection" class="button-ux2025 button-secondary">
                            <span>Annuler</span>
                        </button>
                        <button id="load-template-button" class="button-ux2025 button-primary" disabled>
                            <span>Charger le template</span>
                        </button>
                    </div>
                </div>
            `;

            // Ajouter la boîte de dialogue au document
            document.body.appendChild(templateDialog);
            
            console.log('[TemplateManager] Élément de boîte de dialogue ajouté au DOM');

            // Attacher les événements
            setTimeout(() => {
                try {
                    console.log('[TemplateManager] Attachement des gestionnaires d\'événements');
                    
                    const closeButton = document.getElementById('close-template-dialog');
                    const cancelButton = document.getElementById('cancel-template-selection');
                    const categoryFilter = document.getElementById('template-category-filter');
                    const searchInput = document.getElementById('template-search');
                    const loadButton = document.getElementById('load-template-button');
                    
                    if (closeButton) {
                        closeButton.addEventListener('click', closeTemplateDialog);
                    } else {
                        console.error('[TemplateManager] Bouton de fermeture non trouvé');
                    }
                    
                    if (cancelButton) {
                        cancelButton.addEventListener('click', closeTemplateDialog);
                    } else {
                        console.error('[TemplateManager] Bouton d\'annulation non trouvé');
                    }
                    
                    if (categoryFilter) {
                        categoryFilter.addEventListener('change', filterTemplatesByCategory);
                    } else {
                        console.error('[TemplateManager] Filtre de catégorie non trouvé');
                    }
                    
                    if (searchInput) {
                        searchInput.addEventListener('input', searchTemplates);
                    } else {
                        console.error('[TemplateManager] Champ de recherche non trouvé');
                    }
                    
                    if (loadButton) {
                        loadButton.addEventListener('click', function() {
                            if (selectedTemplateId) {
                                applyTemplate(selectedTemplateId);
                            }
                        });
                    } else {
                        console.error('[TemplateManager] Bouton de chargement non trouvé');
                    }

                    // Fermer la boîte de dialogue en cliquant en dehors
                    templateDialog.addEventListener('click', function(event) {
                        if (event.target === templateDialog) {
                            closeTemplateDialog();
                        }
                    });
                    
                    console.log('[TemplateManager] Boîte de dialogue créée avec succès');
                    return true;
                } catch (error) {
                    console.error('[TemplateManager] Erreur lors de l\'attachement des événements:', error);
                    return false;
                }
            }, 50); // Petit délai pour s'assurer que le DOM est mis à jour
            
            return true;
        } catch (error) {
            console.error('[TemplateManager] Erreur lors de la création de la boîte de dialogue:', error);
            return false;
        }
    }

    /**
     * Charge les données des templates depuis le serveur ou le stockage local
     */
    function loadTemplateData() {
        // Pour le moment, utiliser des données statiques
        // Dans une version future, cela pourrait être chargé depuis le serveur
        templates = [
            {
                id: 'hl7-to-fhir-basic',
                name: 'Conversion HL7 vers FHIR (Basique)',
                description: 'Convertit un message HL7 v2.5 en ressources FHIR R4 (patient, observation)',
                category: 'conversion',
                imageUrl: '/img/templates/hl7-to-fhir-basic.svg',
                flow: {
                    nodes: [
                        {
                            id: 'node-1',
                            type: 'hl7-input',
                            label: 'Entrée HL7',
                            position: { x: 100, y: 200 },
                            data: {}
                        },
                        {
                            id: 'node-2',
                            type: 'hl7-parser',
                            label: 'Analyseur HL7',
                            position: { x: 400, y: 200 },
                            data: {}
                        },
                        {
                            id: 'node-3',
                            type: 'hl7-to-fhir-converter',
                            label: 'Convertisseur FHIR',
                            position: { x: 700, y: 200 },
                            data: {}
                        },
                        {
                            id: 'node-4',
                            type: 'fhir-output',
                            label: 'Sortie FHIR',
                            position: { x: 1000, y: 200 },
                            data: {}
                        }
                    ],
                    edges: [
                        {
                            id: 'edge-1',
                            source: 'node-1',
                            target: 'node-2',
                            sourceOutput: 0,
                            targetInput: 0
                        },
                        {
                            id: 'edge-2',
                            source: 'node-2',
                            target: 'node-3',
                            sourceOutput: 0,
                            targetInput: 0
                        },
                        {
                            id: 'edge-3',
                            source: 'node-3',
                            target: 'node-4',
                            sourceOutput: 0,
                            targetInput: 0
                        }
                    ]
                }
            },
            {
                id: 'hl7-to-fhir-advanced',
                name: 'Conversion HL7 vers FHIR (Avancée)',
                description: 'Convertit un message HL7 v2.5 en ressources FHIR R4 avec validation et transformation',
                category: 'conversion',
                imageUrl: '/img/templates/hl7-to-fhir-advanced.svg',
                flow: {
                    nodes: [
                        {
                            id: 'node-1',
                            type: 'hl7-input',
                            label: 'Entrée HL7',
                            position: { x: 100, y: 200 },
                            data: {}
                        },
                        {
                            id: 'node-2',
                            type: 'hl7-validator',
                            label: 'Validation HL7',
                            position: { x: 400, y: 200 },
                            data: {}
                        },
                        {
                            id: 'node-3',
                            type: 'hl7-to-fhir-converter',
                            label: 'Convertisseur FHIR',
                            position: { x: 700, y: 200 },
                            data: {}
                        },
                        {
                            id: 'node-4',
                            type: 'fhir-validator',
                            label: 'Validation FHIR',
                            position: { x: 1000, y: 200 },
                            data: {}
                        },
                        {
                            id: 'node-5',
                            type: 'fhir-output',
                            label: 'Sortie FHIR',
                            position: { x: 1300, y: 200 },
                            data: {}
                        }
                    ],
                    edges: [
                        {
                            id: 'edge-1',
                            source: 'node-1',
                            target: 'node-2',
                            sourceOutput: 0,
                            targetInput: 0
                        },
                        {
                            id: 'edge-2',
                            source: 'node-2',
                            target: 'node-3',
                            sourceOutput: 0,
                            targetInput: 0
                        },
                        {
                            id: 'edge-3',
                            source: 'node-3',
                            target: 'node-4',
                            sourceOutput: 0,
                            targetInput: 0
                        },
                        {
                            id: 'edge-4',
                            source: 'node-4',
                            target: 'node-5',
                            sourceOutput: 0,
                            targetInput: 0
                        }
                    ]
                }
            },
            {
                id: 'laboratory-results',
                name: 'Résultats de laboratoire',
                description: 'Traite les messages ORU^R01 des résultats de laboratoire',
                category: 'integration',
                imageUrl: '/img/templates/laboratory-results.svg',
                flow: {
                    nodes: [
                        {
                            id: 'node-1',
                            type: 'hl7-input',
                            label: 'Entrée HL7',
                            position: { x: 100, y: 200 },
                            data: {}
                        },
                        {
                            id: 'node-2',
                            type: 'message-filter',
                            label: 'Filtre ORU^R01',
                            position: { x: 400, y: 200 },
                            data: { messageType: 'ORU^R01' }
                        },
                        {
                            id: 'node-3',
                            type: 'hl7-to-fhir-converter',
                            label: 'Convertisseur FHIR',
                            position: { x: 700, y: 200 },
                            data: { resourceTypes: ['Observation', 'DiagnosticReport'] }
                        },
                        {
                            id: 'node-4',
                            type: 'fhir-validator',
                            label: 'Validation FHIR',
                            position: { x: 1000, y: 200 },
                            data: {}
                        },
                        {
                            id: 'node-5',
                            type: 'fhir-server',
                            label: 'Serveur FHIR',
                            position: { x: 1300, y: 200 },
                            data: {}
                        }
                    ],
                    edges: [
                        {
                            id: 'edge-1',
                            source: 'node-1',
                            target: 'node-2',
                            sourceOutput: 0,
                            targetInput: 0
                        },
                        {
                            id: 'edge-2',
                            source: 'node-2',
                            target: 'node-3',
                            sourceOutput: 0,
                            targetInput: 0
                        },
                        {
                            id: 'edge-3',
                            source: 'node-3',
                            target: 'node-4',
                            sourceOutput: 0,
                            targetInput: 0
                        },
                        {
                            id: 'edge-4',
                            source: 'node-4',
                            target: 'node-5',
                            sourceOutput: 0,
                            targetInput: 0
                        }
                    ]
                }
            },
            {
                id: 'patient-demographics-sync',
                name: 'Synchronisation des données patients',
                description: 'Intègre les mises à jour des informations patients (ADT) dans le FHIR Repository',
                category: 'integration',
                imageUrl: '/img/templates/patient-sync.svg',
                flow: {
                    nodes: [
                        {
                            id: 'node-1',
                            type: 'hl7-input',
                            label: 'Entrée HL7',
                            position: { x: 100, y: 200 },
                            data: {}
                        },
                        {
                            id: 'node-2',
                            type: 'message-filter',
                            label: 'Filtre ADT',
                            position: { x: 400, y: 200 },
                            data: { messageType: 'ADT' }
                        },
                        {
                            id: 'node-3',
                            type: 'patient-mapper',
                            label: 'Mapping Patient',
                            position: { x: 700, y: 200 },
                            data: {}
                        },
                        {
                            id: 'node-4',
                            type: 'fhir-server',
                            label: 'Serveur FHIR',
                            position: { x: 1000, y: 200 },
                            data: {}
                        }
                    ],
                    edges: [
                        {
                            id: 'edge-1',
                            source: 'node-1',
                            target: 'node-2',
                            sourceOutput: 0,
                            targetInput: 0
                        },
                        {
                            id: 'edge-2',
                            source: 'node-2',
                            target: 'node-3',
                            sourceOutput: 0,
                            targetInput: 0
                        },
                        {
                            id: 'edge-3',
                            source: 'node-3',
                            target: 'node-4',
                            sourceOutput: 0,
                            targetInput: 0
                        }
                    ]
                }
            },
            {
                id: 'ai-assisted-mapping',
                name: 'Mapping assisté par IA',
                description: 'Utilise l\'IA pour améliorer la conversion HL7 vers FHIR avec analyse de contexte',
                category: 'ai',
                imageUrl: '/img/templates/ai-mapping.svg',
                flow: {
                    nodes: [
                        {
                            id: 'node-1',
                            type: 'hl7-input',
                            label: 'Entrée HL7',
                            position: { x: 100, y: 200 },
                            data: {}
                        },
                        {
                            id: 'node-2',
                            type: 'hl7-parser',
                            label: 'Analyseur HL7',
                            position: { x: 400, y: 150 },
                            data: {}
                        },
                        {
                            id: 'node-3',
                            type: 'ai-context-analyzer',
                            label: 'Analyse IA',
                            position: { x: 400, y: 350 },
                            data: {}
                        },
                        {
                            id: 'node-4',
                            type: 'enhanced-converter',
                            label: 'Convertisseur amélioré',
                            position: { x: 700, y: 200 },
                            data: {}
                        },
                        {
                            id: 'node-5',
                            type: 'fhir-output',
                            label: 'Sortie FHIR',
                            position: { x: 1000, y: 200 },
                            data: {}
                        }
                    ],
                    edges: [
                        {
                            id: 'edge-1',
                            source: 'node-1',
                            target: 'node-2',
                            sourceOutput: 0,
                            targetInput: 0
                        },
                        {
                            id: 'edge-2',
                            source: 'node-1',
                            target: 'node-3',
                            sourceOutput: 0,
                            targetInput: 0
                        },
                        {
                            id: 'edge-3',
                            source: 'node-2',
                            target: 'node-4',
                            sourceOutput: 0,
                            targetInput: 0
                        },
                        {
                            id: 'edge-4',
                            source: 'node-3',
                            target: 'node-4',
                            sourceOutput: 0,
                            targetInput: 1
                        },
                        {
                            id: 'edge-5',
                            source: 'node-4',
                            target: 'node-5',
                            sourceOutput: 0,
                            targetInput: 0
                        }
                    ]
                }
            },
            {
                id: 'data-validation-enrichment',
                name: 'Validation et enrichissement',
                description: 'Valide et enrichit les données FHIR avec des terminologies standards',
                category: 'interoperability',
                imageUrl: '/img/templates/data-validation.svg',
                flow: {
                    nodes: [
                        {
                            id: 'node-1',
                            type: 'fhir-input',
                            label: 'Entrée FHIR',
                            position: { x: 100, y: 200 },
                            data: {}
                        },
                        {
                            id: 'node-2',
                            type: 'terminology-validator',
                            label: 'Validation terminologique',
                            position: { x: 400, y: 200 },
                            data: {}
                        },
                        {
                            id: 'node-3',
                            type: 'data-enrichment',
                            label: 'Enrichissement',
                            position: { x: 700, y: 200 },
                            data: {}
                        },
                        {
                            id: 'node-4',
                            type: 'fhir-output',
                            label: 'Sortie FHIR',
                            position: { x: 1000, y: 200 },
                            data: {}
                        }
                    ],
                    edges: [
                        {
                            id: 'edge-1',
                            source: 'node-1',
                            target: 'node-2',
                            sourceOutput: 0,
                            targetInput: 0
                        },
                        {
                            id: 'edge-2',
                            source: 'node-2',
                            target: 'node-3',
                            sourceOutput: 0,
                            targetInput: 0
                        },
                        {
                            id: 'edge-3',
                            source: 'node-3',
                            target: 'node-4',
                            sourceOutput: 0,
                            targetInput: 0
                        }
                    ]
                }
            }
        ];
    }

    /**
     * Ferme la boîte de dialogue des templates
     */
    function closeTemplateDialog() {
        if (templateDialog) {
            templateDialog.classList.remove('visible');
            templateDialog.classList.remove('show');
            
            // Cacher complètement après l'animation
            setTimeout(() => {
                templateDialog.style.display = 'none';
            }, 300);
        }
    }

    /**
     * Filtre les templates par catégorie
     */
    function filterTemplatesByCategory() {
        const categoryFilter = document.getElementById('template-category-filter');
        if (categoryFilter) {
            currentCategory = categoryFilter.value;
            console.log('[TemplateManager] Filtrage par catégorie:', currentCategory);
        }
        
        renderTemplates();
    }

    /**
     * Recherche des templates par texte
     */
    function searchTemplates() {
        renderTemplates();
    }

    /**
     * Rend les templates dans la boîte de dialogue
     */
    function renderTemplates() {
        const container = document.getElementById('template-list-container');
        if (!container) {
            console.error('[TemplateManager] Container de templates non trouvé');
            return;
        }

        const searchInput = document.getElementById('template-search');
        const searchTerm = searchInput ? searchInput.value.toLowerCase() : '';
        
        console.log('[TemplateManager] Rendu des templates avec catégorie:', currentCategory, 'et recherche:', searchTerm);

        // Filtrer les templates selon la catégorie et le terme de recherche
        const filteredTemplates = templates.filter(template => {
            const matchesCategory = currentCategory === 'all' || template.category === currentCategory;
            const matchesSearch = !searchTerm ||
                template.name.toLowerCase().includes(searchTerm) ||
                template.description.toLowerCase().includes(searchTerm);
            return matchesCategory && matchesSearch;
        });

        // Vider le conteneur
        container.innerHTML = '';

        // Afficher un message si aucun template ne correspond
        if (filteredTemplates.length === 0) {
            container.innerHTML = '<p class="no-templates">Aucun template ne correspond à votre recherche.</p>';
            console.log('[TemplateManager] Aucun template ne correspond aux critères');
            return;
        }

        // Créer la grille de templates
        const templateGrid = document.createElement('div');
        templateGrid.className = 'template-grid';
        container.appendChild(templateGrid);
        
        console.log('[TemplateManager] Affichage de', filteredTemplates.length, 'templates');

        // Afficher les templates filtrés
        filteredTemplates.forEach(template => {
            const templateCard = document.createElement('div');
            templateCard.className = 'template-card';
            templateCard.setAttribute('data-template-id', template.id);

            // Structure du card avec dégradé e-santé
            const templateCardInner = document.createElement('div');
            templateCardInner.className = 'template-card-inner';
            
            const templatePreview = document.createElement('div');
            templatePreview.className = 'template-preview';
            
            // Image du template ou image par défaut
            const img = document.createElement('img');
            img.src = template.imageUrl || '/img/templates/default-template.svg';
            img.alt = template.name;
            img.onerror = function() {
                this.src = '/img/templates/default-template.svg';
            };
            templatePreview.appendChild(img);
            
            const templateInfo = document.createElement('div');
            templateInfo.className = 'template-info';
            
            const templateTitle = document.createElement('h4');
            templateTitle.textContent = template.name;
            
            const templateDescription = document.createElement('p');
            templateDescription.textContent = template.description;
            
            // Ajouter un bouton "Utiliser ce template"
            const useTemplateBtn = document.createElement('button');
            useTemplateBtn.className = 'use-template-btn';
            useTemplateBtn.textContent = 'Utiliser ce template';
            
            templateInfo.appendChild(templateTitle);
            templateInfo.appendChild(templateDescription);
            templateInfo.appendChild(useTemplateBtn);
            
            templateCardInner.appendChild(templatePreview);
            templateCardInner.appendChild(templateInfo);
            
            templateCard.appendChild(templateCardInner);

            // Ajouter le comportement de sélection
            templateCard.addEventListener('click', function(e) {
                // Vérifier si le clic était sur le bouton
                if (e.target === useTemplateBtn) {
                    // Appliquer immédiatement le template
                    applyTemplate(template.id);
                    return;
                }
                
                // Retirer la sélection précédente
                const selectedCard = document.querySelector('.template-card.selected');
                if (selectedCard) {
                    selectedCard.classList.remove('selected');
                }
                
                // Sélectionner cette carte
                this.classList.add('selected');
                selectTemplate(template.id);
                
                // Activer le bouton de chargement
                const loadButton = document.getElementById('load-template-button');
                if (loadButton) {
                    loadButton.disabled = false;
                }
                
                // Ajouter un effet ripple
                const ripple = document.createElement('span');
                ripple.className = 'ripple';
                this.appendChild(ripple);
                
                // Supprimer l'effet après animation
                setTimeout(() => ripple.remove(), 600);
            });

            templateGrid.appendChild(templateCard);
        });

        // Initialiser la sélection
        selectedTemplateId = null;
        
        // Configurer le bouton de chargement
        const loadButton = document.getElementById('load-template-button');
        if (loadButton) {
            loadButton.disabled = true;
            
            // Supprimer tous les écouteurs d'événements précédents
            const newLoadButton = loadButton.cloneNode(true);
            loadButton.parentNode.replaceChild(newLoadButton, loadButton);
            
            newLoadButton.addEventListener('click', function() {
                if (selectedTemplateId) {
                    applyTemplate(selectedTemplateId);
                }
            });
        }
        
        console.log('[TemplateManager] Rendu des templates terminé');
    }

    /**
     * Sélectionne un template spécifique
     * @param {string} templateId - ID du template à sélectionner
     */
    function selectTemplate(templateId) {
        selectedTemplateId = templateId;
        console.log('[TemplateManager] Template sélectionné:', templateId);
    }

    /**
     * Applique un template spécifique à l'éditeur de workflow
     * @param {string} templateId - ID du template à appliquer
     */
    function applyTemplate(templateId) {
        console.log('[TemplateManager] Application du template:', templateId);
        
        if (!workflowEditor) {
            console.error('[TemplateManager] Éditeur de workflow non disponible');
            alert('Erreur: Éditeur de workflow non disponible');
            return;
        }
        
        // Trouver le template correspondant
        const template = templates.find(t => t.id === templateId);
        if (!template) {
            console.error('[TemplateManager] Template non trouvé:', templateId);
            alert('Erreur: Template non trouvé');
            return;
        }
        
        try {
            // Charger le template dans l'éditeur
            workflowEditor.loadTemplate(template.flow);
            
            // Fermer la boîte de dialogue
            closeTemplateDialog();
            
            // Notification de succès
            if (window.workflowNotifications) {
                window.workflowNotifications.showNotification('success', `Template "${template.name}" appliqué avec succès`);
            } else {
                alert(`Template "${template.name}" appliqué avec succès`);
            }
        } catch (error) {
            console.error('[TemplateManager] Erreur lors de l\'application du template:', error);
            alert(`Erreur lors de l'application du template: ${error.message}`);
        }
    }

    /**
     * Ouvre la boîte de dialogue des templates
     */
    function openTemplateDialog() {
        console.log('[TemplateManager] Ouverture de la boîte de dialogue des templates');
        
        if (!templateDialog) {
            console.log('[TemplateManager] Création de la boîte de dialogue avant ouverture');
            createTemplateDialog();
        }
        
        // Recharger les templates
        loadTemplateData();
        
        // Afficher la boîte de dialogue
        templateDialog.style.display = 'flex';
        
        // Ajouter la classe pour l'animation après un court délai
        setTimeout(() => {
            templateDialog.classList.add('visible');
            templateDialog.classList.add('show');
        }, 10);
        
        // Réinitialiser la catégorie
        currentCategory = 'all';
        const categoryFilter = document.getElementById('template-category-filter');
        if (categoryFilter) {
            categoryFilter.value = 'all';
        }
        
        // Réinitialiser la recherche
        const searchInput = document.getElementById('template-search');
        if (searchInput) {
            searchInput.value = '';
        }
        
        // Afficher les templates
        renderTemplates();
    }

    /**
     * Précharge la boîte de dialogue des templates pour une ouverture plus rapide
     */
    function preloadTemplateDialog() {
        console.log('[TemplateManager] Préchargement de la boîte de dialogue des templates');
        
        // Créer la boîte de dialogue mais ne pas l'afficher
        createTemplateDialog();
        
        console.log('[TemplateManager] Boîte de dialogue préchargée avec succès');
    }

    // API publique
    return {
        initialize,
        openTemplateDialog,
        preloadTemplateDialog,
        closeTemplateDialog
    };
})();
