/**
 * Script d'intégration de l'éditeur de workflow visuel avec l'interface FHIRHub
 */

// Variable globale pour l'éditeur de workflow
let workflowEditor = null;

// Initialiser l'éditeur quand la page est chargée
document.addEventListener('DOMContentLoaded', function() {
    console.log('Initialisation de l\'intégration workflow...');
    
    // Références aux éléments DOM
    const editorContainer = document.getElementById('workflow-editor-container');
    const workflowCards = document.getElementById('workflow-grid');
    const editorModal = document.getElementById('editor-modal');
    
    // Gestion du clic sur le bouton "Éditeur" des cartes de workflow
    function attachWorkflowCardEvents() {
        document.querySelectorAll('.editor-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                const id = this.getAttribute('data-id');
                openVisualEditor(id);
            });
        });
    }
    
    // Charger l'éditeur visuel pour un workflow spécifique
    function openVisualEditor(workflowId) {
        console.log(`Ouverture de l'éditeur visuel pour le workflow ${workflowId}`);
        
        // Récupérer les données du workflow
        getWorkflow(workflowId).then(workflow => {
            // Mise à jour du titre
            document.getElementById('editor-title').textContent = `Éditeur visuel: ${workflow.name}`;
            
            // Afficher la modal
            editorModal.style.display = 'block';
            
            // Initialiser l'éditeur visuel s'il n'existe pas déjà
            if (!workflowEditor) {
                console.log('Création d\'une nouvelle instance de l\'éditeur visuel');
                
                workflowEditor = new WorkflowEditor('workflow-editor-container', {
                    workflowId: workflowId,
                    autosave: true
                });
                
                // Événements de l'éditeur
                workflowEditor.on('workflowSaved', function(data) {
                    console.log('Workflow sauvegardé avec succès', data);
                    
                    // Mettre à jour la liste des workflows après sauvegarde
                    setTimeout(() => {
                        loadWorkflows(document.getElementById('application-filter').value);
                    }, 500);
                });
            } else {
                console.log('Chargement du workflow dans l\'éditeur existant');
                
                // Charger le nouveau workflow dans l'éditeur existant
                workflowEditor.options.workflowId = workflowId;
                workflowEditor.loadWorkflow(workflowId);
            }
        }).catch(error => {
            console.error('Erreur lors de l\'ouverture de l\'éditeur visuel', error);
            showNotification('Erreur: ' + error.message, 'error');
        });
    }
    
    // Surcharger la fonction pour ouvrir l'éditeur
    if (typeof window.openWorkflowEditor === 'function') {
        // Sauvegarder la fonction originale
        const originalOpenWorkflowEditor = window.openWorkflowEditor;
        
        // Remplacer par notre fonction
        window.openWorkflowEditor = function(id) {
            // Utiliser notre éditeur visuel au lieu de l'iframe Node-RED
            openVisualEditor(id);
        };
    }
    
    // Attacher les événements aux cartes de workflow existantes
    attachWorkflowCardEvents();
    
    // Observer le conteneur de cartes pour attacher les événements aux nouvelles cartes
    const observer = new MutationObserver(function(mutations) {
        mutations.forEach(function(mutation) {
            if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                attachWorkflowCardEvents();
            }
        });
    });
    
    // Démarrer l'observation
    if (workflowCards) {
        observer.observe(workflowCards, { childList: true });
    }
    
    // Gérer la fermeture de la modal
    document.getElementById('close-editor-modal').addEventListener('click', function() {
        editorModal.style.display = 'none';
    });
    
    document.getElementById('close-editor').addEventListener('click', function() {
        editorModal.style.display = 'none';
    });
    
    // Fermer la modal en cliquant en dehors
    window.addEventListener('click', function(event) {
        if (event.target === editorModal) {
            editorModal.style.display = 'none';
        }
    });
    
    console.log('Intégration workflow initialisée');
});