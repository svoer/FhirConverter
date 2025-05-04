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
    // Indique si le gestionnaire est initialisé
    let isInitialized = false;

    /**
     * Initialise le gestionnaire de templates
     * @param {Object} editor - Instance de l'éditeur de workflow
     */
    function initialize(editor) {
        console.log('[TemplateManager] Initialisation avec l\'éditeur:', editor);
        workflowEditor = editor;
        loadTemplateData();
        isInitialized = true;
        return true;
    }
    
    // Initialiser les templates de base au démarrage (même sans éditeur)
    loadTemplateData();

    /**
     * Crée la boîte de dialogue de sélection des templates
     */
    function createTemplateDialog() {
        // Vérifier si la boîte de dialogue existe déjà
        if (document.getElementById('template-dialog')) {
            return;
        }

        // Créer la boîte de dialogue
        templateDialog = document.createElement('div');
        templateDialog.id = 'template-dialog';
        templateDialog.className = 'template-dialog';
        templateDialog.style.display = 'none';

        // Structure de la boîte de dialogue
        templateDialog.innerHTML = `
            <div class="template-dialog-content">
                <div class="template-dialog-header">
                    <h3>Choisir un Template</h3>
                    <button class="close-dialog" id="close-template-dialog">&times;</button>
                </div>
                <div class="template-dialog-body">
                    <div class="template-filter">
                        <div class="category-filter">
                            <label>Catégorie:</label>
                            <select id="template-category-filter">
                                <option value="all">Toutes les catégories</option>
                                <option value="conversion">Conversion HL7</option>
                                <option value="integration">Intégration</option>
                                <option value="validation">Validation</option>
                                <option value="transformation">Transformation</option>
                                <option value="notification">Notification</option>
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
                </div>
            </div>
        `;

        // Ajouter la boîte de dialogue au document
        document.body.appendChild(templateDialog);

        // Attacher les événements
        document.getElementById('close-template-dialog').addEventListener('click', closeTemplateDialog);
        document.getElementById('cancel-template-selection').addEventListener('click', closeTemplateDialog);
        document.getElementById('template-category-filter').addEventListener('change', filterTemplatesByCategory);
        document.getElementById('template-search').addEventListener('input', searchTemplates);

        // Fermer la boîte de dialogue en cliquant en dehors
        templateDialog.addEventListener('click', function(event) {
            if (event.target === templateDialog) {
                closeTemplateDialog();
            }
        });
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
                id: 'dicom-to-fhir',
                name: 'Conversion DICOM vers FHIR',
                description: 'Convertit des données DICOM en ressources FHIR ImagingStudy',
                category: 'conversion',
                imageUrl: '/img/templates/dicom-to-fhir.svg',
                flow: {
                    nodes: [
                        {
                            id: 'node-1',
                            type: 'dicom-input',
                            label: 'Entrée DICOM',
                            position: { x: 100, y: 200 },
                            data: {}
                        },
                        {
                            id: 'node-2',
                            type: 'dicom-parser',
                            label: 'Analyseur DICOM',
                            position: { x: 400, y: 200 },
                            data: {}
                        },
                        {
                            id: 'node-3',
                            type: 'dicom-to-fhir-converter',
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
                id: 'sftp-to-fhir',
                name: 'SFTP vers FHIR API',
                description: 'Récupère des fichiers HL7 depuis un serveur SFTP et les expose via une API FHIR',
                category: 'integration',
                imageUrl: '/img/templates/sftp-to-fhir.svg',
                flow: {
                    nodes: [
                        {
                            id: 'node-1',
                            type: 'sftp-input',
                            label: 'Source SFTP',
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
                            type: 'fhir-api-output',
                            label: 'API FHIR',
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
                id: 'ehr-integration',
                name: 'Intégration avec DPI',
                description: 'Établit une connexion bidirectionnelle avec un DPI via HL7 et FHIR',
                category: 'integration',
                imageUrl: '/img/templates/ehr-integration.svg',
                flow: {
                    nodes: [
                        {
                            id: 'node-1',
                            type: 'ehr-connector',
                            label: 'Connecteur DPI',
                            position: { x: 400, y: 100 },
                            data: {}
                        },
                        {
                            id: 'node-2',
                            type: 'message-router',
                            label: 'Routeur de Messages',
                            position: { x: 700, y: 100 },
                            data: {}
                        },
                        {
                            id: 'node-3',
                            type: 'hl7-parser',
                            label: 'Analyseur HL7',
                            position: { x: 400, y: 300 },
                            data: {}
                        },
                        {
                            id: 'node-4',
                            type: 'hl7-to-fhir-converter',
                            label: 'HL7 → FHIR',
                            position: { x: 700, y: 300 },
                            data: {}
                        },
                        {
                            id: 'node-5',
                            type: 'fhir-to-hl7-converter',
                            label: 'FHIR → HL7',
                            position: { x: 400, y: 500 },
                            data: {}
                        },
                        {
                            id: 'node-6',
                            type: 'hl7-composer',
                            label: 'Composeur HL7',
                            position: { x: 700, y: 500 },
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
                            source: 'node-2',
                            target: 'node-5',
                            sourceOutput: 1,
                            targetInput: 0
                        },
                        {
                            id: 'edge-5',
                            source: 'node-5',
                            target: 'node-6',
                            sourceOutput: 0,
                            targetInput: 0
                        },
                        {
                            id: 'edge-6',
                            source: 'node-6',
                            target: 'node-1',
                            sourceOutput: 0,
                            targetInput: 1
                        }
                    ]
                }
            }
        ];

        // Rendre les templates disponibles
        renderTemplates();
    }

    /**
     * Ferme la boîte de dialogue des templates
     */
    function closeTemplateDialog() {
        if (templateDialog) {
            // Enlever d'abord la classe de visibilité pour l'animation
            templateDialog.classList.remove('visible');
            
            // Puis après un délai, cacher complètement
            setTimeout(() => {
                templateDialog.style.display = 'none';
            }, 300); // Délai correspondant à la durée de l'animation CSS
        }
    }

    /**
     * Filtre les templates par catégorie
     */
    function filterTemplatesByCategory() {
        const categorySelect = document.getElementById('template-category-filter');
        if (!categorySelect) return;

        currentCategory = categorySelect.value;
        renderTemplates();
    }

    /**
     * Recherche des templates par texte
     */
    function searchTemplates() {
        const searchInput = document.getElementById('template-search');
        if (!searchInput) return;

        renderTemplates();
    }

    /**
     * Rend les templates dans la boîte de dialogue
     */
    function renderTemplates() {
        const container = document.getElementById('templates-container');
        if (!container) return;

        const searchInput = document.getElementById('template-search');
        const searchTerm = searchInput ? searchInput.value.toLowerCase() : '';

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
            return;
        }

        // Afficher les templates filtrés
        filteredTemplates.forEach(template => {
            const templateCard = document.createElement('div');
            templateCard.className = 'template-card';
            templateCard.setAttribute('data-template-id', template.id);

            const templatePreview = document.createElement('div');
            templatePreview.className = 'template-preview';
            
            // Image du template ou image par défaut
            if (template.imageUrl) {
                const img = document.createElement('img');
                img.src = template.imageUrl;
                img.alt = template.name;
                img.onerror = function() {
                    this.src = '/img/templates/default-template.svg';
                };
                templatePreview.appendChild(img);
            } else {
                const img = document.createElement('img');
                img.src = '/img/templates/default-template.svg';
                img.alt = 'Template par défaut';
                templatePreview.appendChild(img);
            }
            
            const templateInfo = document.createElement('div');
            templateInfo.className = 'template-info';
            
            const templateTitle = document.createElement('h4');
            templateTitle.textContent = template.name;
            
            const templateDescription = document.createElement('p');
            templateDescription.textContent = template.description;
            
            const useButton = document.createElement('button');
            useButton.className = 'use-template-btn button-ux2025 button-primary';
            useButton.textContent = 'Utiliser ce template';
            useButton.addEventListener('click', function() {
                applyTemplate(template.id);
            });
            
            templateInfo.appendChild(templateTitle);
            templateInfo.appendChild(templateDescription);
            templateInfo.appendChild(useButton);
            
            templateCard.appendChild(templatePreview);
            templateCard.appendChild(templateInfo);
            
            container.appendChild(templateCard);
        });
    }

    /**
     * Applique un template spécifique à l'éditeur de workflow
     * @param {string} templateId - ID du template à appliquer
     */
    function applyTemplate(templateId) {
        // Trouver le template correspondant
        const template = templates.find(t => t.id === templateId);
        if (!template) {
            console.error(`[TemplateManager] Template non trouvé: ${templateId}`);
            return;
        }

        console.log(`[TemplateManager] Application du template: ${template.name}`);

        // Vérifier que l'éditeur est initialisé
        if (!workflowEditor) {
            console.error('[TemplateManager] Éditeur de workflow non initialisé');
            return;
        }

        // Charger le template dans l'éditeur
        workflowEditor.loadTemplate(template.flow);

        // Fermer la boîte de dialogue
        closeTemplateDialog();
    }

    /**
     * Ouvre la boîte de dialogue des templates
     */
    function openTemplateDialog() {
        console.log('[TemplateManager] Ouverture de la boîte de dialogue des templates');
        
        // Si la boîte de dialogue n'existe pas encore, la créer
        if (!templateDialog) {
            console.log('[TemplateManager] Création de la boîte de dialogue des templates (auto)');
            createTemplateDialog();
            
            // Si la création a échoué, sortir
            if (!templateDialog) {
                console.error('[TemplateManager] Impossible de créer la boîte de dialogue des templates');
                return;
            }
        }

        // Réinitialiser les filtres s'ils existent
        const categoryFilter = document.getElementById('template-category-filter');
        const searchInput = document.getElementById('template-search');
        
        if (categoryFilter) categoryFilter.value = 'all';
        if (searchInput) searchInput.value = '';
        
        currentCategory = 'all';

        // Rendre les templates
        renderTemplates();

        // Afficher la boîte de dialogue
        templateDialog.style.display = 'block';
        
        // Ajouter une animation d'apparition
        setTimeout(() => {
            templateDialog.classList.add('visible');
        }, 50);
    }

    // Exposer les fonctions publiques
    return {
        initialize,
        openTemplateDialog
    };
})();