/**
 * Integration de l'éditeur de workflow avec l'UI de FHIRHub
 * 
 * Ce script gère l'intégration entre l'interface utilisateur FHIRHub
 * et l'éditeur visuel de workflow.
 */

document.addEventListener('DOMContentLoaded', function() {
    // Initialiser l'éditeur dans la modal si le conteneur existe
    let editor = null;
    
    // Référence de la modal d'éditeur
    const editorModal = document.getElementById('editor-modal');
    const editorContainer = document.getElementById('workflow-editor-container');
    
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
     * Attache les événements aux cartes de workflow
     */
    function attachWorkflowCardEvents() {
        // Trouver tous les boutons d'édition visuelle
        document.querySelectorAll('.editor-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                const workflowId = this.getAttribute('data-id');
                if (workflowId) {
                    openVisualEditor(workflowId);
                }
            });
        });
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
    
    // Exposer les fonctions pour pouvoir les appeler depuis d'autres scripts
    window.workflowIntegration = {
        openVisualEditor,
        attachWorkflowCardEvents
    };
});