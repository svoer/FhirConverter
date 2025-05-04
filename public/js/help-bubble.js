/**
 * Système de bulle d'aide contextuelle avec suggestions alimentées par IA
 * Pour FHIRHub - Conversion HL7 vers FHIR
 */

class HelpBubbleSystem {
    constructor(options = {}) {
        this.options = {
            aiEndpoint: '/api/ai/help-suggestion', // Point d'accès API pour les suggestions d'IA
            introMessage: 'Besoin d\'aide ? Je suis là pour vous aider avec FHIRHub.',
            defaultSuggestions: [
                {
                    title: 'Comment commencer avec FHIRHub',
                    description: 'Un guide rapide pour vous familiariser avec FHIRHub et ses fonctionnalités.',
                    action: 'guide_intro'
                },
                {
                    title: 'Convertir un message HL7',
                    description: 'Apprenez à convertir un message HL7 au format FHIR.',
                    action: 'guide_convert'
                },
                {
                    title: 'Créer un workflow personnalisé',
                    description: 'Découvrez comment créer un workflow pour automatiser vos conversions.',
                    action: 'guide_workflow'
                }
            ],
            contextualElements: [
                {
                    selector: '#workflow-editor-container', // Éditeur de workflow
                    context: 'workflow_editor',
                    suggestions: [
                        {
                            title: 'Construire votre premier workflow',
                            description: 'Comment ajouter et connecter des nœuds pour créer un workflow efficace.',
                            action: 'guide_workflow_nodes' 
                        },
                        {
                            title: 'Nœuds disponibles',
                            description: 'Description de tous les types de nœuds et leur utilité dans les workflows.',
                            action: 'guide_node_types'
                        },
                        {
                            title: 'Automatiser des conversions',
                            description: 'Configurer un workflow pour traiter automatiquement des messages HL7.',
                            action: 'guide_workflow_automation'
                        }
                    ]
                },
                {
                    selector: '.hl7-conversion-container', // Page de conversion HL7
                    context: 'hl7_conversion',
                    suggestions: [
                        {
                            title: 'Format HL7 accepté',
                            description: 'Formats HL7 compatibles et structure recommandée pour une conversion optimale.',
                            action: 'guide_hl7_format'
                        },
                        {
                            title: 'Comprendre les résultats FHIR',
                            description: 'Comment interpréter les résultats de la conversion au format FHIR.',
                            action: 'guide_fhir_results'
                        },
                        {
                            title: 'Résolution des erreurs courantes',
                            description: 'Solutions aux problèmes courants lors de la conversion HL7 vers FHIR.',
                            action: 'guide_troubleshooting'
                        }
                    ]
                },
                {
                    selector: '.dashboard-container', // Tableau de bord
                    context: 'dashboard',
                    suggestions: [
                        {
                            title: 'Comprendre les métriques',
                            description: 'Explications des différentes métriques et statistiques du tableau de bord.',
                            action: 'guide_metrics'
                        },
                        {
                            title: 'Optimiser vos conversions',
                            description: 'Comment utiliser les statistiques pour améliorer vos conversions.',
                            action: 'guide_optimization'
                        }
                    ]
                }
            ],
            ...options
        };

        this.currentContext = 'default';
        this.isVisible = false;
        this.hasNewSuggestions = false;
        this.loadingSuggestions = false;
        this.aiSuggestions = [];
        this.activeContextualElements = [];
        
        this.initialize();
    }

    /**
     * Initialise le système de bulles d'aide
     */
    initialize() {
        this.createDOMElements();
        this.setupEventListeners();
        this.scanForContextualElements();
        this.setInitialSuggestions();
        console.log('[HelpBubble] Système initialisé avec succès');
    }

    /**
     * Crée les éléments DOM nécessaires pour la bulle d'aide
     */
    createDOMElements() {
        // Création du conteneur principal
        this.container = document.createElement('div');
        this.container.className = 'help-bubble-container';
        
        // Création du bouton de la bulle
        this.toggleButton = document.createElement('div');
        this.toggleButton.className = 'help-bubble-toggle';
        this.toggleButton.innerHTML = '<i class="fas fa-question"></i>';
        
        // Ajout du point de notification
        this.notificationDot = document.createElement('div');
        this.notificationDot.className = 'notification-dot';
        this.toggleButton.appendChild(this.notificationDot);
        
        // Création du panneau de la bulle
        this.panel = document.createElement('div');
        this.panel.className = 'help-bubble-panel';
        
        // En-tête du panneau
        this.header = document.createElement('div');
        this.header.className = 'help-bubble-header';
        this.header.innerHTML = `
            <span>Aide intelligente</span>
            <button class="close-btn">&times;</button>
        `;
        
        // Contenu du panneau
        this.content = document.createElement('div');
        this.content.className = 'help-bubble-content';
        
        // Zone de saisie
        this.inputArea = document.createElement('div');
        this.inputArea.className = 'help-bubble-input';
        this.inputArea.innerHTML = `
            <input type="text" placeholder="Posez votre question...">
            <button>Envoyer</button>
        `;
        
        // Pied de page
        this.footer = document.createElement('div');
        this.footer.className = 'help-bubble-footer';
        this.footer.innerHTML = 'FHIRHub - Assistance intelligente';
        
        // Assemblage des éléments
        this.panel.appendChild(this.header);
        this.panel.appendChild(this.content);
        this.panel.appendChild(this.inputArea);
        this.panel.appendChild(this.footer);
        
        this.container.appendChild(this.toggleButton);
        this.container.appendChild(this.panel);
        
        // Ajout au corps du document
        document.body.appendChild(this.container);
        
        // Références aux éléments d'entrée
        this.inputField = this.inputArea.querySelector('input');
        this.sendButton = this.inputArea.querySelector('button');
    }

    /**
     * Configure les écouteurs d'événements
     */
    setupEventListeners() {
        // Événement de bascule pour afficher/masquer le panneau
        this.toggleButton.addEventListener('click', () => {
            this.togglePanel();
        });
        
        // Événement de fermeture du panneau
        const closeBtn = this.header.querySelector('.close-btn');
        closeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.hidePanel();
        });
        
        // Événement d'envoi de question
        this.sendButton.addEventListener('click', () => {
            this.handleUserQuery();
        });
        
        // Envoi par la touche Entrée
        this.inputField.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.handleUserQuery();
            }
        });
        
        // Input change (activation/désactivation du bouton)
        this.inputField.addEventListener('input', () => {
            this.sendButton.disabled = this.inputField.value.trim().length === 0;
        });
        
        // Clic sur le document (fermer le panneau si clic en dehors)
        document.addEventListener('click', (e) => {
            if (this.isVisible && !this.container.contains(e.target)) {
                this.hidePanel();
            }
        });
        
        // Événement personnalisé pour les changements de contexte
        document.addEventListener('contextChanged', (e) => {
            if (e.detail && e.detail.context) {
                this.updateContext(e.detail.context);
            }
        });
        
        // Détection des éléments contextuels au scroll
        window.addEventListener('scroll', this.debounce(() => {
            this.scanForContextualElements();
        }, 300));
        
        // Détection des éléments contextuels au redimensionnement
        window.addEventListener('resize', this.debounce(() => {
            this.scanForContextualElements();
        }, 300));
    }

    /**
     * Fonction utilitaire pour limiter le nombre d'appels d'une fonction
     */
    debounce(func, delay) {
        let timeout;
        return function() {
            const context = this;
            const args = arguments;
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(context, args), delay);
        };
    }

    /**
     * Bascule l'affichage du panneau d'aide
     */
    togglePanel() {
        if (this.isVisible) {
            this.hidePanel();
        } else {
            this.showPanel();
        }
    }

    /**
     * Affiche le panneau d'aide
     */
    showPanel() {
        this.panel.classList.add('show');
        this.isVisible = true;
        
        // Réinitialiser la notification lorsque le panneau est ouvert
        this.notificationDot.classList.remove('show');
        this.hasNewSuggestions = false;
        
        // Focus sur le champ de saisie
        setTimeout(() => {
            this.inputField.focus();
        }, 300);
    }

    /**
     * Masque le panneau d'aide
     */
    hidePanel() {
        this.panel.classList.remove('show');
        this.isVisible = false;
    }

    /**
     * Définit les suggestions initiales
     */
    setInitialSuggestions() {
        this.renderSuggestions(this.options.defaultSuggestions);
        this.showWelcomeMessage();
    }

    /**
     * Affiche un message de bienvenue
     */
    showWelcomeMessage() {
        const welcomeElement = document.createElement('div');
        welcomeElement.className = 'help-suggestion';
        welcomeElement.innerHTML = `
            <div class="help-suggestion-title">👋 Bienvenue sur l'aide interactive</div>
            <div class="help-suggestion-description">${this.options.introMessage}</div>
        `;
        
        this.content.insertBefore(welcomeElement, this.content.firstChild);
    }

    /**
     * Parcourt la page pour détecter les éléments contextuels
     */
    scanForContextualElements() {
        this.activeContextualElements = [];
        
        // Parcoure tous les éléments contextuels définis
        this.options.contextualElements.forEach(contextElement => {
            const elements = document.querySelectorAll(contextElement.selector);
            
            if (elements.length > 0) {
                elements.forEach(element => {
                    if (this.isElementVisible(element)) {
                        this.activeContextualElements.push({
                            element: element,
                            context: contextElement.context,
                            suggestions: contextElement.suggestions
                        });
                    }
                });
            }
        });
        
        // Mettre à jour le contexte si nécessaire
        if (this.activeContextualElements.length > 0) {
            // Prioriser l'élément le plus visible
            const bestMatch = this.getMostVisibleElement(this.activeContextualElements);
            if (bestMatch && bestMatch.context !== this.currentContext) {
                this.updateContext(bestMatch.context, bestMatch.suggestions);
            }
        } else if (this.currentContext !== 'default') {
            // Revenir au contexte par défaut
            this.updateContext('default');
        }
    }

    /**
     * Vérifie si un élément est visible dans la fenêtre
     */
    isElementVisible(element) {
        const rect = element.getBoundingClientRect();
        return (
            rect.top >= 0 &&
            rect.left >= 0 &&
            rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
            rect.right <= (window.innerWidth || document.documentElement.clientWidth)
        );
    }

    /**
     * Détermine l'élément le plus visible parmi une liste
     */
    getMostVisibleElement(elements) {
        if (elements.length === 0) return null;
        if (elements.length === 1) return elements[0];
        
        // Calculer le pourcentage de visibilité pour chaque élément
        const visibleElements = elements.map(item => {
            const rect = item.element.getBoundingClientRect();
            const windowHeight = window.innerHeight || document.documentElement.clientHeight;
            const windowWidth = window.innerWidth || document.documentElement.clientWidth;
            
            const visibleHeight = Math.min(rect.bottom, windowHeight) - Math.max(rect.top, 0);
            const visibleWidth = Math.min(rect.right, windowWidth) - Math.max(rect.left, 0);
            
            const visibleArea = visibleHeight * visibleWidth;
            const totalArea = rect.width * rect.height;
            
            return {
                ...item,
                visibilityScore: visibleArea / totalArea
            };
        });
        
        // Trier par score de visibilité décroissant
        visibleElements.sort((a, b) => b.visibilityScore - a.visibilityScore);
        
        return visibleElements[0];
    }

    /**
     * Met à jour le contexte actuel et les suggestions
     */
    updateContext(context, contextSuggestions = null) {
        console.log(`[HelpBubble] Changement de contexte: ${this.currentContext} -> ${context}`);
        
        if (context === this.currentContext) return;
        
        this.currentContext = context;
        
        // Mettre à jour les suggestions basées sur le contexte
        if (contextSuggestions) {
            // Utiliser les suggestions fournies
            this.updateSuggestions(contextSuggestions);
        } else if (context === 'default') {
            // Revenir aux suggestions par défaut
            this.updateSuggestions(this.options.defaultSuggestions);
        } else {
            // Chercher les suggestions pour ce contexte
            const contextData = this.options.contextualElements.find(item => item.context === context);
            if (contextData && contextData.suggestions) {
                this.updateSuggestions(contextData.suggestions);
            } else {
                // Si aucune suggestion spécifique n'est trouvée, obtenir des suggestions IA
                this.getAISuggestions(context);
            }
        }
    }

    /**
     * Met à jour les suggestions affichées
     */
    updateSuggestions(suggestions) {
        this.renderSuggestions(suggestions);
        
        // Afficher la notification seulement si le panneau est fermé
        if (!this.isVisible) {
            this.notificationDot.classList.add('show');
            this.hasNewSuggestions = true;
        }
    }

    /**
     * Récupère des suggestions de l'IA basées sur le contexte
     */
    async getAISuggestions(context) {
        if (this.loadingSuggestions) return;
        
        this.loadingSuggestions = true;
        this.showLoadingIndicator();
        
        try {
            const response = await fetch(this.options.aiEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.getAuthToken()}`,
                    'X-API-KEY': 'dev-key'
                },
                body: JSON.stringify({
                    context: context,
                    currentUrl: window.location.pathname,
                    userRole: this.getUserRole()
                })
            });
            
            if (!response.ok) {
                throw new Error('Erreur lors de la récupération des suggestions');
            }
            
            const result = await response.json();
            
            this.aiSuggestions = result.suggestions || [];
            this.updateSuggestions(this.aiSuggestions);
            
        } catch (error) {
            console.error('[HelpBubble] Erreur IA:', error);
            // En cas d'erreur, afficher des suggestions génériques
            this.updateSuggestions(this.options.defaultSuggestions);
        } finally {
            this.hideLoadingIndicator();
            this.loadingSuggestions = false;
        }
    }

    /**
     * Affiche l'indicateur de chargement
     */
    showLoadingIndicator() {
        const loadingElement = document.createElement('div');
        loadingElement.className = 'help-loading';
        loadingElement.innerHTML = `
            <div class="spinner"></div>
            <div>Chargement des suggestions...</div>
        `;
        
        // Supprimer l'ancien indicateur s'il existe
        const existingLoader = this.content.querySelector('.help-loading');
        if (existingLoader) {
            existingLoader.remove();
        }
        
        this.content.appendChild(loadingElement);
    }

    /**
     * Masque l'indicateur de chargement
     */
    hideLoadingIndicator() {
        const loadingElement = this.content.querySelector('.help-loading');
        if (loadingElement) {
            loadingElement.remove();
        }
    }

    /**
     * Affiche les suggestions dans le panneau
     */
    renderSuggestions(suggestions) {
        // Vider le contenu actuel
        this.content.innerHTML = '';
        
        if (!suggestions || suggestions.length === 0) {
            this.content.innerHTML = '<div class="help-suggestion">Aucune suggestion disponible actuellement.</div>';
            return;
        }
        
        // Créer un élément pour chaque suggestion
        suggestions.forEach(suggestion => {
            const suggestionElement = document.createElement('div');
            suggestionElement.className = 'help-suggestion';
            
            let actionButton = '';
            if (suggestion.action) {
                actionButton = `<button class="help-suggestion-action" data-action="${suggestion.action}">Voir plus</button>`;
            }
            
            suggestionElement.innerHTML = `
                <div class="help-suggestion-title">${suggestion.title}</div>
                <div class="help-suggestion-description">${suggestion.description}</div>
                ${actionButton}
            `;
            
            // Ajouter l'événement de clic pour l'action
            const actionBtn = suggestionElement.querySelector('.help-suggestion-action');
            if (actionBtn) {
                actionBtn.addEventListener('click', () => {
                    this.handleSuggestionAction(suggestion.action);
                });
            }
            
            this.content.appendChild(suggestionElement);
        });
    }

    /**
     * Gère l'action lorsqu'un utilisateur clique sur une suggestion
     */
    handleSuggestionAction(action) {
        console.log(`[HelpBubble] Action déclenchée: ${action}`);
        
        // Implémenter les différentes actions possibles
        switch (action) {
            case 'guide_intro':
                this.showGuide('introduction');
                break;
            case 'guide_convert':
                this.showGuide('conversion');
                break;
            case 'guide_workflow':
                this.showGuide('workflow');
                break;
            case 'guide_workflow_nodes':
                this.showGuide('workflow_nodes');
                break;
            case 'guide_node_types':
                this.showGuide('node_types');
                break;
            case 'guide_workflow_automation':
                this.showGuide('workflow_automation');
                break;
            case 'guide_hl7_format':
                this.showGuide('hl7_format');
                break;
            case 'guide_fhir_results':
                this.showGuide('fhir_results');
                break;
            case 'guide_troubleshooting':
                this.showGuide('troubleshooting');
                break;
            case 'guide_metrics':
                this.showGuide('metrics');
                break;
            case 'guide_optimization':
                this.showGuide('optimization');
                break;
            default:
                console.warn(`[HelpBubble] Action non reconnue: ${action}`);
                this.showGuide('default');
        }
    }

    /**
     * Affiche un guide d'aide spécifique
     */
    showGuide(guideId) {
        // Cette fonction pourrait ouvrir une fenêtre modale, rediriger vers une page d'aide,
        // ou afficher des informations directement dans le panneau d'aide
        
        // Exemple simple : afficher des informations dans le panneau
        this.content.innerHTML = `
            <div class="help-suggestion">
                <div class="help-suggestion-title">Guide: ${guideId}</div>
                <div class="help-suggestion-description">Chargement du guide...</div>
            </div>
        `;
        
        // Simuler le chargement de contenu d'aide (à remplacer par un vrai chargement)
        setTimeout(() => {
            this.loadGuideContent(guideId);
        }, 500);
    }

    /**
     * Charge le contenu d'un guide d'aide
     * Dans une vraie implémentation, cette fonction chargerait le contenu depuis le serveur
     */
    async loadGuideContent(guideId) {
        try {
            // Dans une vraie implémentation, ici on ferait un appel API
            // pour récupérer le contenu du guide
            const response = await fetch(`/api/guides/${guideId}`, {
                headers: {
                    'Authorization': `Bearer ${this.getAuthToken()}`,
                    'X-API-KEY': 'dev-key'
                }
            }).catch(() => {
                // Si l'API n'existe pas encore, simuler une réponse
                return {
                    ok: true,
                    json: () => Promise.resolve({
                        title: `Guide: ${guideId}`,
                        content: `Le contenu détaillé pour ce guide sera bientôt disponible. 
                                 En attendant, n'hésitez pas à poser vos questions à notre assistant.`
                    })
                };
            });
            
            if (!response.ok) {
                throw new Error('Erreur lors du chargement du guide');
            }
            
            const guide = await response.json();
            
            this.content.innerHTML = `
                <div class="help-suggestion">
                    <div class="help-suggestion-title">${guide.title}</div>
                    <div class="help-suggestion-description">${guide.content}</div>
                    <button class="help-suggestion-action" id="back-to-suggestions">Retour aux suggestions</button>
                </div>
            `;
            
            // Ajouter l'événement de retour
            document.getElementById('back-to-suggestions').addEventListener('click', () => {
                // Revenir aux suggestions contextuelles
                if (this.currentContext === 'default') {
                    this.renderSuggestions(this.options.defaultSuggestions);
                } else {
                    const contextData = this.options.contextualElements.find(item => item.context === this.currentContext);
                    if (contextData && contextData.suggestions) {
                        this.renderSuggestions(contextData.suggestions);
                    } else {
                        this.renderSuggestions(this.aiSuggestions.length > 0 ? this.aiSuggestions : this.options.defaultSuggestions);
                    }
                }
            });
            
        } catch (error) {
            console.error('[HelpBubble] Erreur guide:', error);
            this.content.innerHTML = `
                <div class="help-suggestion">
                    <div class="help-suggestion-title">Erreur</div>
                    <div class="help-suggestion-description">Impossible de charger le guide. Veuillez réessayer ultérieurement.</div>
                    <button class="help-suggestion-action" id="back-to-suggestions">Retour aux suggestions</button>
                </div>
            `;
            
            document.getElementById('back-to-suggestions').addEventListener('click', () => {
                this.renderSuggestions(this.options.defaultSuggestions);
            });
        }
    }

    /**
     * Traite la requête de l'utilisateur
     */
    async handleUserQuery() {
        const query = this.inputField.value.trim();
        if (!query) return;
        
        // Réinitialiser le champ de saisie
        this.inputField.value = '';
        this.sendButton.disabled = true;
        
        // Afficher la question de l'utilisateur
        const userQueryElement = document.createElement('div');
        userQueryElement.className = 'help-suggestion';
        userQueryElement.innerHTML = `
            <div class="help-suggestion-title">Votre question</div>
            <div class="help-suggestion-description">${query}</div>
        `;
        
        this.content.appendChild(userQueryElement);
        
        // Afficher l'indicateur de chargement
        this.showLoadingIndicator();
        
        try {
            // Appel à l'API d'IA pour obtenir une réponse à la question
            const response = await fetch(`${this.options.aiEndpoint}/query`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.getAuthToken()}`,
                    'X-API-KEY': 'dev-key'
                },
                body: JSON.stringify({
                    query: query,
                    context: this.currentContext,
                    currentUrl: window.location.pathname
                })
            }).catch(() => {
                // Si l'API n'existe pas encore, simuler une réponse
                return {
                    ok: true,
                    json: () => Promise.resolve({
                        answer: `Je suis désolé, je ne peux pas répondre à cette question pour le moment. 
                                Le service AI est en cours d'implémentation. Veuillez réessayer plus tard.`,
                        relatedSuggestions: this.options.defaultSuggestions
                    })
                };
            });
            
            if (!response.ok) {
                throw new Error('Erreur lors de la récupération de la réponse');
            }
            
            const result = await response.json();
            
            // Masquer l'indicateur de chargement
            this.hideLoadingIndicator();
            
            // Afficher la réponse
            const answerElement = document.createElement('div');
            answerElement.className = 'help-suggestion';
            answerElement.innerHTML = `
                <div class="help-suggestion-title">Réponse</div>
                <div class="help-suggestion-description">${result.answer}</div>
            `;
            
            this.content.appendChild(answerElement);
            
            // Afficher les suggestions liées
            if (result.relatedSuggestions && result.relatedSuggestions.length > 0) {
                this.renderSuggestions(result.relatedSuggestions);
            }
            
        } catch (error) {
            console.error('[HelpBubble] Erreur requête:', error);
            
            // Masquer l'indicateur de chargement
            this.hideLoadingIndicator();
            
            // Afficher un message d'erreur
            const errorElement = document.createElement('div');
            errorElement.className = 'help-suggestion';
            errorElement.innerHTML = `
                <div class="help-suggestion-title">Erreur</div>
                <div class="help-suggestion-description">Désolé, je n'ai pas pu traiter votre demande. Veuillez réessayer ultérieurement.</div>
            `;
            
            this.content.appendChild(errorElement);
        }
    }

    /**
     * Ajoute une info-bulle contextuelle sur un élément
     */
    addContextualTooltip(element, message) {
        const tooltip = document.createElement('div');
        tooltip.className = 'help-context-tooltip';
        tooltip.innerText = message;
        
        // Positionner la bulle au-dessus de l'élément
        const rect = element.getBoundingClientRect();
        tooltip.style.left = `${rect.left + rect.width / 2}px`;
        tooltip.style.top = `${rect.top - 40}px`;
        
        document.body.appendChild(tooltip);
        
        // Supprimer la bulle après quelques secondes
        setTimeout(() => {
            tooltip.remove();
        }, 5000);
    }

    /**
     * Récupère le token d'authentification
     */
    getAuthToken() {
        // Cette fonction pourrait récupérer le token depuis le stockage local
        // ou depuis une fonction globale si elle existe
        if (typeof getToken === 'function') {
            return getToken();
        }
        return localStorage.getItem('auth_token') || '';
    }

    /**
     * Récupère le rôle de l'utilisateur actuel
     */
    getUserRole() {
        // Cette fonction pourrait récupérer le rôle de l'utilisateur depuis le stockage local
        // ou depuis une variable globale
        return localStorage.getItem('user_role') || 'user';
    }
}

// Initialiser le système de bulles d'aide au chargement de la page
document.addEventListener('DOMContentLoaded', () => {
    // Création de l'instance globale du système de bulles d'aide
    window.helpBubble = new HelpBubbleSystem();
});