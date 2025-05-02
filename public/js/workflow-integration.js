/**
 * Integration de l'éditeur de workflow avec l'UI de FHIRHub
 * 
 * Ce script gère l'intégration entre l'interface utilisateur FHIRHub
 * et l'éditeur visuel de workflow selon le design épuré souhaité.
 */

document.addEventListener('DOMContentLoaded', function() {
    // Initialiser l'éditeur dans la modal si le conteneur existe
    let editor = null;
    
    // Référence de la modal d'éditeur
    const editorModal = document.getElementById('editor-modal');
    const editorContainer = document.getElementById('workflow-editor-container');
    
    // Référence aux onglets de la page workflows
    const workflowTabs = document.querySelectorAll('.workflow-tab');
    
    // Gestionnaire d'événements pour les onglets (Workflows, Credentials, Exécutions)
    workflowTabs.forEach(tab => {
        tab.addEventListener('click', function() {
            // Supprimer la classe active de tous les onglets
            workflowTabs.forEach(t => t.classList.remove('active'));
            // Ajouter la classe active à l'onglet cliqué
            this.classList.add('active');
            // Pour l'instant, nous n'affichons que l'onglet Workflows
            // Les autres onglets seraient implémentés dans une future version
        });
    });
    
    // Bouton pour sauvegarder les modifications de l'éditeur
    const saveEditorBtn = document.createElement('button');
    saveEditorBtn.className = 'save-btn';
    saveEditorBtn.textContent = 'Sauvegarder';
    saveEditorBtn.style.marginRight = '10px';
    
    // Ajouter le bouton de sauvegarde à la modal
    const modalFooter = document.querySelector('#editor-modal .modal-footer');
    if (modalFooter) {
        // Insérer avant le bouton Fermer
        modalFooter.insertBefore(saveEditorBtn, modalFooter.firstChild);
    }
    
    /**
     * Initialise l'éditeur visuel
     */
    function initializeWorkflowEditor() {
        if (editorContainer && !editor) {
            editor = new WorkflowEditor('workflow-editor-container', {
                readOnly: false,
                allowPanning: true,
                allowZooming: true,
                snapToGrid: true,
            });
            
            // Écouter les événements de l'éditeur
            editor.on('workflowChanged', function(data) {
                console.log('Workflow modifié:', data);
            });
            
            editor.on('workflowSaved', function(data) {
                console.log('Workflow sauvegardé:', data);
                showNotification('Workflow sauvegardé avec succès', 'success');
            });
            
            // Événement du bouton de sauvegarde
            saveEditorBtn.addEventListener('click', function() {
                if (editor) {
                    editor.saveWorkflow();
                }
            });
            
            console.log('Éditeur visuel initialisé');
        }
    }
    
    /**
     * Ouvre l'éditeur visuel pour un workflow spécifique
     * @param {string} workflowId - ID du workflow à éditer
     */
    function openVisualEditor(workflowId) {
        console.log('Ouverture de l\'éditeur visuel pour le workflow:', workflowId);
        
        // S'assurer que l'éditeur est initialisé
        if (!editor) {
            initializeWorkflowEditor();
        }
        
        // Afficher la modal
        editorModal.style.display = 'block';
        
        // Charger le workflow dans l'éditeur
        if (editor) {
            editor.loadWorkflow(workflowId);
        } else {
            console.error('Éditeur non initialisé');
            showNotification('Erreur: Impossible d\'initialiser l\'éditeur', 'error');
        }
    }
    
    /**
     * Crée une carte de workflow dans le nouveau design
     * @param {Object} workflow - Données du workflow
     * @returns {HTMLElement} - Élément DOM de la carte de workflow
     */
    function createWorkflowCard(workflow) {
        const item = document.createElement('div');
        item.className = 'workflow-item';
        
        // Formatage des dates pour l'affichage
        const lastUpdated = new Date(workflow.updated_at);
        const now = new Date();
        const diffDays = Math.floor((now - lastUpdated) / (1000 * 60 * 60 * 24));
        
        let timeText;
        if (diffDays === 0) {
            timeText = 'aujourd\'hui';
        } else if (diffDays === 1) {
            timeText = 'il y a 1 jour';
        } else {
            timeText = `il y a ${diffDays} jours`;
        }
        
        // Construction du HTML pour la carte de workflow
        item.innerHTML = `
            <div class="workflow-item-header">
                <h3 class="workflow-title">${workflow.name}</h3>
                <div class="workflow-controls">
                    <label class="workflow-toggle">
                        <input type="checkbox" class="status-toggle" data-id="${workflow.id}" ${workflow.is_active ? 'checked' : ''}>
                        <span class="toggle-slider"></span>
                    </label>
                    <button class="workflow-menu-button" data-id="${workflow.id}">
                        <i class="fas fa-ellipsis-v"></i>
                    </button>
                </div>
            </div>
            <div class="workflow-meta">
                <span class="workflow-meta-item time-indicator">Dernière mise à jour ${timeText}</span>
                <span class="workflow-meta-item">Créé le ${new Date(workflow.created_at).toLocaleDateString()}</span>
            </div>
            <p class="workflow-description">${workflow.description || 'Aucune description'}</p>
            <div class="workflow-footer">
                <div class="workflow-owner">
                    <div class="workflow-owner-avatar">
                        <i class="fas fa-user"></i>
                    </div>
                    <span>Personnel / ${workflow.application_name}</span>
                </div>
            </div>
        `;
        
        // Ajouter les gestionnaires d'événements
        const menuButton = item.querySelector('.workflow-menu-button');
        menuButton.addEventListener('click', function(e) {
            e.stopPropagation();
            const workflowId = this.getAttribute('data-id');
            showWorkflowMenu(workflowId, this);
        });
        
        // Gestion de la bascule actif/inactif
        const toggle = item.querySelector('.status-toggle');
        toggle.addEventListener('change', function() {
            const workflowId = this.getAttribute('data-id');
            updateWorkflowStatus(workflowId, this.checked);
        });
        
        // Ouvrir l'éditeur au clic sur la carte entière
        item.addEventListener('click', function() {
            const workflowId = item.querySelector('.workflow-menu-button').getAttribute('data-id');
            openVisualEditor(workflowId);
        });
        
        return item;
    }
    
    /**
     * Affiche le menu contextuel pour un workflow
     * @param {string} workflowId - ID du workflow
     * @param {HTMLElement} buttonElement - Élément bouton qui a déclenché l'affichage
     */
    function showWorkflowMenu(workflowId, buttonElement) {
        // Supprimer tout menu déjà ouvert
        const existingMenu = document.querySelector('.workflow-actions-menu');
        if (existingMenu) {
            existingMenu.remove();
        }
        
        // Créer le menu
        const menu = document.createElement('div');
        menu.className = 'workflow-actions-menu show';
        menu.innerHTML = `
            <button class="edit-btn" data-id="${workflowId}">Modifier</button>
            <button class="editor-btn" data-id="${workflowId}">Éditeur visuel</button>
            <button class="duplicate-btn" data-id="${workflowId}">Dupliquer</button>
            <button class="export-btn" data-id="${workflowId}">Exporter</button>
            <button class="delete-btn" data-id="${workflowId}">Supprimer</button>
        `;
        
        // Positionner le menu près du bouton
        const rect = buttonElement.getBoundingClientRect();
        menu.style.position = 'absolute';
        menu.style.top = `${rect.bottom + window.scrollY}px`;
        menu.style.right = `${window.innerWidth - rect.right - window.scrollX}px`;
        
        // Ajouter au document
        document.body.appendChild(menu);
        
        // Ajouter les gestionnaires d'événements
        menu.querySelector('.editor-btn').addEventListener('click', function(e) {
            e.stopPropagation();
            const id = this.getAttribute('data-id');
            menu.remove();
            openVisualEditor(id);
        });
        
        // Fermer le menu au clic à l'extérieur
        document.addEventListener('click', function closeMenu(e) {
            if (!menu.contains(e.target) && e.target !== buttonElement) {
                menu.remove();
                document.removeEventListener('click', closeMenu);
            }
        });
    }
    
    /**
     * Met à jour le statut actif/inactif d'un workflow
     * @param {string} workflowId - ID du workflow
     * @param {boolean} isActive - Nouvel état (actif/inactif)
     */
    async function updateWorkflowStatus(workflowId, isActive) {
        try {
            const response = await fetch(`/api/workflows/${workflowId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${getToken()}`,
                    'X-API-KEY': 'dev-key'
                },
                body: JSON.stringify({
                    is_active: isActive
                })
            });
            
            if (!response.ok) {
                throw new Error('Erreur lors de la mise à jour du statut');
            }
            
            showNotification(`Workflow ${isActive ? 'activé' : 'désactivé'}`, 'success');
        } catch (error) {
            console.error('Erreur:', error);
            showNotification('Erreur: ' + error.message, 'error');
        }
    }
    
    /**
     * Attache les événements aux cartes de workflow
     */
    function attachWorkflowCardEvents() {
        // Cet événement est maintenant géré à la création des cartes
    }
    
    // Initialiser au chargement de la page
    attachWorkflowCardEvents();
    
    // Réattacher les événements après un changement de la liste des workflows
    // (par exemple après un filtre ou un rechargement)
    if (window.loadWorkflows) {
        const originalLoadWorkflows = window.loadWorkflows;
        window.loadWorkflows = function(...args) {
            originalLoadWorkflows.apply(this, args).then(() => {
                attachWorkflowCardEvents();
            });
        };
    }
    
    /**
     * Charge et affiche les workflows avec le nouveau design
     * @param {string} applicationId - ID de l'application pour filtrer (ou 'all' pour toutes)
     */
    async function loadWorkflowsWithNewDesign(applicationId = 'all') {
        try {
            const workflowGrid = document.getElementById('workflow-grid');
            const loadingSpinner = document.getElementById('loading-spinner');
            
            if (workflowGrid && loadingSpinner) {
                workflowGrid.innerHTML = '';
                loadingSpinner.style.display = 'block';
                
                let url = '/api/workflows';
                if (applicationId !== 'all') {
                    url = `/api/workflows/application/${applicationId}`;
                }
                
                const response = await fetch(url, {
                    headers: {
                        'Authorization': `Bearer ${getToken()}`,
                        'X-API-KEY': 'dev-key'
                    }
                });
                
                if (!response.ok) {
                    throw new Error('Erreur lors du chargement des workflows');
                }
                
                const result = await response.json();
                console.log('Workflows chargés:', result);
                
                loadingSpinner.style.display = 'none';
                
                // Vérifier que la réponse contient les données attendues
                let workflows = [];
                if (result.success && result.data) {
                    workflows = result.data;
                } else if (Array.isArray(result)) {
                    workflows = result;
                } else {
                    console.warn('Format de réponse inattendu pour les workflows:', result);
                }
                
                if (workflows.length === 0) {
                    workflowGrid.innerHTML = '<p class="no-workflows">Aucun workflow trouvé.</p>';
                    return;
                }
                
                // Utiliser le nouveau format de carte pour chaque workflow
                workflows.forEach(workflow => {
                    const card = createWorkflowCard(workflow);
                    workflowGrid.appendChild(card);
                });
            }
        } catch (error) {
            console.error('Erreur:', error);
            const loadingSpinner = document.getElementById('loading-spinner');
            if (loadingSpinner) {
                loadingSpinner.style.display = 'none';
            }
            showNotification('Erreur: ' + error.message, 'error');
        }
    }
    
    // Initialiser le chargement des workflows au démarrage
    loadWorkflowsWithNewDesign();
    
    // Gérer la recherche
    const searchInput = document.getElementById('workflow-search');
    if (searchInput) {
        searchInput.addEventListener('input', debounce(function() {
            const query = this.value.toLowerCase();
            const workflowItems = document.querySelectorAll('.workflow-item');
            
            workflowItems.forEach(item => {
                const title = item.querySelector('.workflow-title').textContent.toLowerCase();
                const desc = item.querySelector('.workflow-description').textContent.toLowerCase();
                
                if (title.includes(query) || desc.includes(query)) {
                    item.style.display = 'flex';
                } else {
                    item.style.display = 'none';
                }
            });
        }, 300));
    }
    
    // Fonction utilitaire pour debouncer les événements
    function debounce(func, wait) {
        let timeout;
        return function(...args) {
            const context = this;
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(context, args), wait);
        };
    }
    
    // Exposer les fonctions pour pouvoir les appeler depuis d'autres scripts
    window.workflowIntegration = {
        openVisualEditor,
        attachWorkflowCardEvents,
        loadWorkflowsWithNewDesign,
        createWorkflowCard
    };
});