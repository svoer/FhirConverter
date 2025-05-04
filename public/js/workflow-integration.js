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
     * Modifie une carte de workflow existante pour ajouter l'interrupteur de statut
     * @param {HTMLElement} card - L'élément DOM de la carte de workflow
     * @param {Object} workflow - Données du workflow
     */
    function enhanceWorkflowCard(card, workflow) {
        // Trouver le header de la carte
        const header = card.querySelector('.workflow-header');
        if (!header) return;

        // Créer l'interrupteur
        const toggle = document.createElement('label');
        toggle.className = 'workflow-toggle';
        toggle.innerHTML = `
            <input type="checkbox" class="status-toggle" data-id="${workflow.id}" ${workflow.is_active ? 'checked' : ''}>
            <span class="toggle-slider"></span>
        `;

        // Ajouter l'interrupteur au header
        header.appendChild(toggle);

        // Ajouter l'événement de changement à l'interrupteur
        const toggleInput = toggle.querySelector('input');
        if (toggleInput) {
            toggleInput.addEventListener('change', function(e) {
                e.stopPropagation(); // Éviter de propager l'événement à la carte
                const workflowId = this.getAttribute('data-id');
                updateWorkflowStatus(workflowId, this.checked);
            });
        }
    }

    /**
     * Crée une carte de workflow avec le bloc de couleur dégradé et l'interrupteur
     * @param {Object} workflow - Données du workflow
     * @returns {HTMLElement} - Élément DOM de la carte de workflow
     */
    function createWorkflowCard(workflow) {
        // Créer la carte
        const card = document.createElement('div');
        card.className = 'workflow-card'; 
        
        // Formatage de la date pour l'affichage
        const now = new Date();
        const updated = new Date(workflow.updated_at);
        const diffMs = now - updated;
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        
        let timeText;
        if (diffDays === 0) {
            timeText = "aujourd'hui";
        } else if (diffDays === 1) {
            timeText = "hier";
        } else {
            timeText = `il y a ${diffDays} jours`;
        }
        
        // Structure HTML selon l'image fournie
        card.innerHTML = `
            <div class="workflow-header" style="background: linear-gradient(90deg, #e63946, #f4a261); color: white; padding: 15px; display: flex; justify-content: space-between; align-items: center;">
                <h3 style="margin: 0; font-size: 18px;">${workflow.name}</h3>
                <label class="workflow-toggle">
                    <input type="checkbox" class="status-toggle" data-id="${workflow.id}" ${workflow.is_active ? 'checked' : ''}>
                    <span class="toggle-slider"></span>
                </label>
            </div>
            <div class="workflow-body" style="padding: 15px; border: 1px solid #e0e0e0; border-top: none;">
                <p>Dernière mise à jour ${timeText}</p>
                <p>${workflow.description || 'Aucune description'}</p>
                <p>Application: ${workflow.application_name}</p>
                <p>Dernière mise à jour: ${new Date(workflow.updated_at).toLocaleString()}</p>
                <div style="margin-top: 15px; display: flex; gap: 10px;">
                    <button class="edit-btn" data-id="${workflow.id}" style="background: #f1f1f1; border: 1px solid #ddd; padding: 8px 12px; border-radius: 4px; cursor: pointer;">Modifier</button>
                    <button class="editor-btn" data-id="${workflow.id}" style="background: #f1f1f1; border: 1px solid #ddd; padding: 8px 12px; border-radius: 4px; cursor: pointer;">Éditeur</button>
                    <button class="delete-btn" data-id="${workflow.id}" style="background: #f1f1f1; border: 1px solid #ddd; padding: 8px 12px; border-radius: 4px; cursor: pointer; margin-left: auto;">Supprimer</button>
                </div>
            </div>
        `;
        
        // Ajouter l'événement de changement à l'interrupteur
        const toggleInput = card.querySelector('.status-toggle');
        if (toggleInput) {
            toggleInput.addEventListener('change', function(e) {
                e.stopPropagation(); // Éviter de propager l'événement à la carte
                const workflowId = this.getAttribute('data-id');
                updateWorkflowStatus(workflowId, this.checked);
            });
        }
        
        // Ajouter les gestionnaires d'événements pour les boutons
        card.querySelectorAll('button').forEach(btn => {
            btn.addEventListener('click', function(e) {
                e.stopPropagation();
                const action = this.className.split('-')[0]; // edit, editor, delete
                const workflowId = this.getAttribute('data-id');
                
                if (action === 'editor') {
                    openVisualEditor(workflowId);
                } else if (action === 'edit') {
                    editWorkflow(workflowId);
                } else if (action === 'delete') {
                    deleteWorkflow(workflowId);
                }
            });
        });
        
        return card;
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
        
        // Ajouter l'événement pour le bouton d'export
        menu.querySelector('.export-btn').addEventListener('click', function(e) {
            e.stopPropagation();
            const id = this.getAttribute('data-id');
            menu.remove();
            exportWorkflowTemplate(id);
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
     * Exporte un workflow comme template
     * @param {string} workflowId - ID du workflow à exporter
     */
    async function exportWorkflowTemplate(workflowId) {
        try {
            // Récupérer l'URL du template
            const response = await fetch(`/api/workflows/${workflowId}/export-template`, {
                headers: {
                    'Authorization': `Bearer ${getToken()}`,
                    'X-API-KEY': 'dev-key'
                }
            });
            
            if (!response.ok) {
                throw new Error('Erreur lors de l\'export du template');
            }
            
            // Récupérer le workflow pour avoir son nom
            const workflowResponse = await fetch(`/api/workflows/${workflowId}`, {
                headers: {
                    'Authorization': `Bearer ${getToken()}`,
                    'X-API-KEY': 'dev-key'
                }
            });
            
            if (!workflowResponse.ok) {
                throw new Error('Erreur lors de la récupération des détails du workflow');
            }
            
            const workflowData = await workflowResponse.json();
            const workflow = workflowData.data || workflowData;
            const fileName = `${workflow.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_template.json`;
            
            // Récupérer les données du template
            const templateData = await response.json();
            
            // Créer un objet Blob
            const blob = new Blob([JSON.stringify(templateData, null, 2)], { type: 'application/json' });
            
            // Créer un lien de téléchargement et cliquer dessus automatiquement
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            
            // Nettoyer
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
            
            showNotification('Template exporté avec succès', 'success');
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
    
    // Variable pour garder la trace du dernier appel à loadWorkflowsWithNewDesign
    let loadWorkflowsCounter = 0;
    
    /**
     * Charge et affiche les workflows avec le nouveau design
     * @param {string} applicationId - ID de l'application pour filtrer (ou 'all' pour toutes)
     * @returns {Promise<Array>} - Les workflows chargés
     */
    async function loadWorkflowsWithNewDesign(applicationId = 'all') {
        // Incrémenter le compteur d'appels
        const currentCallId = ++loadWorkflowsCounter;
        
        // Ajouter un log pour déboguer
        console.log(`[WorkflowIntegration] Appel #${currentCallId} à loadWorkflowsWithNewDesign(${applicationId})`);
        const stackTrace = new Error().stack;
        console.log(`[WorkflowIntegration] Trace d'appel: ${stackTrace}`);
        
        try {
            const workflowGrid = document.getElementById('workflow-grid');
            const loadingSpinner = document.getElementById('loading-spinner');
            
            if (!workflowGrid || !loadingSpinner) {
                console.warn('[WorkflowIntegration] Éléments DOM manquants pour l\'affichage des workflows');
                return [];
            }
            
            // Vérifier si cet appel est toujours le plus récent
            if (currentCallId !== loadWorkflowsCounter) {
                console.log(`[WorkflowIntegration] Abandon de l'appel #${currentCallId}, un appel plus récent #${loadWorkflowsCounter} existe`);
                return []; // Ne pas continuer si un appel plus récent a été fait
            }
            
            // Vider la grille et afficher le spinner
            workflowGrid.innerHTML = '';
            loadingSpinner.style.display = 'block';
            
            // Construire l'URL
            let url = '/api/workflows';
            if (applicationId !== 'all') {
                url = `/api/workflows/application/${applicationId}`;
            }
            
            // Faire la requête
            const response = await fetch(url, {
                headers: {
                    'Authorization': `Bearer ${getToken()}`,
                    'X-API-KEY': 'dev-key'
                }
            });
            
            // Vérifier à nouveau si cet appel est toujours le plus récent
            if (currentCallId !== loadWorkflowsCounter) {
                console.log(`[WorkflowIntegration] Abandon de l'appel #${currentCallId} après requête`);
                return []; // Ne pas continuer si un appel plus récent a été fait
            }
            
            if (!response.ok) {
                throw new Error('Erreur lors du chargement des workflows');
            }
            
            const result = await response.json();
            console.log(`[WorkflowIntegration] Workflows chargés (appel #${currentCallId}):`, result);
            
            // Vérifier à nouveau si cet appel est toujours le plus récent
            if (currentCallId !== loadWorkflowsCounter) {
                console.log(`[WorkflowIntegration] Abandon de l'appel #${currentCallId} après réception des données`);
                return []; 
            }
            
            loadingSpinner.style.display = 'none';
            
            // Vérifier que la réponse contient les données attendues
            let workflows = [];
            if (result.success && result.data) {
                workflows = result.data;
            } else if (Array.isArray(result)) {
                workflows = result;
            } else {
                console.warn('[WorkflowIntegration] Format de réponse inattendu pour les workflows:', result);
            }
            
            if (workflows.length === 0) {
                workflowGrid.innerHTML = '<p class="no-workflows">Aucun workflow trouvé.</p>';
                return [];
            }
            
            // Supprimer les doublons en utilisant un Map avec l'ID comme clé
            const uniqueWorkflows = new Map();
            workflows.forEach(workflow => {
                uniqueWorkflows.set(workflow.id, workflow);
            });
            
            // Vérifier une dernière fois si cet appel est toujours le plus récent
            if (currentCallId !== loadWorkflowsCounter) {
                console.log(`[WorkflowIntegration] Abandon de l'appel #${currentCallId} avant affichage`);
                return Array.from(uniqueWorkflows.values()); 
            }
            
            // Utiliser le nouveau format de carte pour chaque workflow unique
            uniqueWorkflows.forEach(workflow => {
                const card = createWorkflowCard(workflow);
                workflowGrid.appendChild(card);
            });
            
            // Attacher les événements aux nouvelles cartes
            attachWorkflowCardEvents();
            
            return Array.from(uniqueWorkflows.values());
        } catch (error) {
            console.error('[WorkflowIntegration] Erreur:', error);
            const loadingSpinner = document.getElementById('loading-spinner');
            if (loadingSpinner) {
                loadingSpinner.style.display = 'none';
            }
            
            // Afficher l'erreur seulement si c'est le dernier appel
            if (currentCallId === loadWorkflowsCounter) {
                const workflowGrid = document.getElementById('workflow-grid');
                if (workflowGrid) {
                    workflowGrid.innerHTML = `<p class="error-message">Erreur: ${error.message}</p>`;
                }
                showNotification('Erreur: ' + error.message, 'error');
            }
            
            return [];
        }
    }
    
    // Remplacer la fonction loadWorkflows originale pour éviter les appels en double
    if (window.loadWorkflows) {
        console.log('[WorkflowIntegration] Remplacement de la fonction loadWorkflows originale');
        window.loadWorkflows = function(applicationId = 'all') {
            console.log('[WorkflowIntegration] Redirection de loadWorkflows vers loadWorkflowsWithNewDesign');
            return loadWorkflowsWithNewDesign(applicationId);
        };
    } else {
        window.loadWorkflows = loadWorkflowsWithNewDesign;
    }
    
    // Initialiser le chargement des workflows au démarrage
    // Mais uniquement si nous sommes sur la page des workflows
    if (document.getElementById('workflow-grid')) {
        console.log('[WorkflowIntegration] Chargement initial des workflows');
        loadWorkflowsWithNewDesign();
    }
    
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
        createWorkflowCard,
        exportWorkflowTemplate
    };
});