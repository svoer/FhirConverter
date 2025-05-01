/**
 * Support Chatbot pour FHIRHub
 * 
 * Ce module implémente un assistant conversationnel pour aider les utilisateurs
 * à comprendre et utiliser efficacement FHIRHub.
 */

class FHIRHubSupportBot {
  constructor() {
    this.container = null;
    this.chatWindow = null;
    this.chatMessages = null;
    this.inputField = null;
    this.sendButton = null;
    this.toggleButton = null;
    this.isOpen = false;
    this.aiProvider = null;
    this.currentContext = '';
    this.messageHistory = [];
    this.isWaitingForResponse = false;

    // Instructions spécifiques pour le support HL7/FHIR
    this.systemInstructions = `
      Tu es l'assistant de support pour FHIRHub, un système de conversion HL7 vers FHIR.
      
      - Réponds de manière concise et précise, en utilisant un langage professionnel mais accessible.
      - Ton rôle est d'aider les utilisateurs à comprendre le fonctionnement de FHIRHub, les standards HL7 et FHIR, et à résoudre des problèmes techniques courants.
      - Ne demande jamais d'exemples de données de santé réelles.
      - Utilise uniquement des exemples fictifs et génériques pour illustrer tes explications.
      - Ne prétends pas pouvoir analyser ou traiter des messages HL7 contenant des données de santé.
      - Si l'utilisateur te demande d'analyser ou de convertir des données de santé, explique poliment que cela doit être fait directement dans l'application FHIRHub par souci de confidentialité.
      - Pour les explications techniques sur HL7 et FHIR, reste factuel et conforme aux standards officiels.

      FHIRHub offre les fonctionnalités suivantes:
      - Conversion de messages HL7 v2.5 vers FHIR R4 (standard 4.0.1 de l'ANS)
      - Gestion des applications et des clés API avec droits différenciés
      - Terminologies française intégrées et mises à jour via des fichiers JSON
      - Interface moderne avec dégradé rouge-orange (thème e-Santé)
      - Système portable installable sans dépendances lourdes
      - Base de données SQLite pour les logs (rétention d'un mois)
      - Authentification avec deux rôles: Admin (accès complet) et User (lecture seule)
    `;

    this.init();
  }

  /**
   * Initialise le chatbot
   */
  init() {
    this.createHtmlElements();
    this.setupEventListeners();
    this.loadAIProvider();
    this.detectCurrentPage();
    
    // Message de bienvenue
    setTimeout(() => {
      this.addBotMessage("Bonjour ! Je suis l'assistant FHIRHub. Comment puis-je vous aider aujourd'hui ?");
    }, 500);
  }

  /**
   * Crée les éléments HTML du chatbot
   */
  createHtmlElements() {
    // Création du conteneur principal
    this.container = document.createElement('div');
    this.container.className = 'support-chatbot-container';
    
    // Création du bouton de toggle
    this.toggleButton = document.createElement('button');
    this.toggleButton.className = 'chatbot-toggle-button';
    this.toggleButton.innerHTML = '<i class="fas fa-comment-dots"></i>';
    this.toggleButton.setAttribute('title', 'Assistance FHIRHub');
    
    // Création de la fenêtre de chat
    this.chatWindow = document.createElement('div');
    this.chatWindow.className = 'chatbot-window hidden';
    
    // En-tête du chat
    const chatHeader = document.createElement('div');
    chatHeader.className = 'chatbot-header';
    chatHeader.innerHTML = `
      <div class="chatbot-title">
        <i class="fas fa-comment-medical"></i>
        Assistant FHIRHub
      </div>
      <button class="chatbot-close"><i class="fas fa-times"></i></button>
    `;
    
    // Zone des messages
    this.chatMessages = document.createElement('div');
    this.chatMessages.className = 'chatbot-messages';
    
    // Zone de saisie
    const inputContainer = document.createElement('div');
    inputContainer.className = 'chatbot-input-container';
    
    this.inputField = document.createElement('input');
    this.inputField.type = 'text';
    this.inputField.className = 'chatbot-input';
    this.inputField.placeholder = 'Votre question...';
    
    this.sendButton = document.createElement('button');
    this.sendButton.className = 'chatbot-send-button';
    this.sendButton.innerHTML = '<i class="fas fa-paper-plane"></i>';
    
    // Assemblage des éléments
    inputContainer.appendChild(this.inputField);
    inputContainer.appendChild(this.sendButton);
    
    this.chatWindow.appendChild(chatHeader);
    this.chatWindow.appendChild(this.chatMessages);
    this.chatWindow.appendChild(inputContainer);
    
    this.container.appendChild(this.toggleButton);
    this.container.appendChild(this.chatWindow);
    
    // Ajout au body
    document.body.appendChild(this.container);
  }

  /**
   * Configure les écouteurs d'événements
   */
  setupEventListeners() {
    // Ouverture/fermeture du chatbot
    this.toggleButton.addEventListener('click', () => this.toggleChat());
    
    // Fermeture du chat avec le bouton X
    const closeButton = this.chatWindow.querySelector('.chatbot-close');
    if (closeButton) {
      closeButton.addEventListener('click', () => this.toggleChat(false));
    }
    
    // Envoi d'un message
    this.sendButton.addEventListener('click', () => this.sendMessage());
    this.inputField.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        this.sendMessage();
      }
    });
  }

  /**
   * Charge le fournisseur d'IA configuré
   */
  async loadAIProvider() {
    try {
      // Récupérer la liste des fournisseurs d'IA configurés et actifs
      const response = await fetch('/api/ai-providers/active', {
        headers: {
          'Authorization': `Bearer ${FHIRHubAuth.getAuthToken()}`
        }
      });
      
      if (!response.ok) {
        console.error('Erreur lors du chargement des fournisseurs d\'IA:', response.statusText);
        return;
      }
      
      const providers = await response.json();
      
      // Utiliser le premier fournisseur actif disponible
      if (providers && providers.length > 0) {
        this.aiProvider = providers[0];
        console.log('Fournisseur d\'IA chargé:', this.aiProvider.provider_name);
      } else {
        console.warn('Aucun fournisseur d\'IA actif n\'est disponible.');
      }
    } catch (error) {
      console.error('Erreur lors du chargement du fournisseur d\'IA:', error);
    }
  }

  /**
   * Détecte la page actuelle pour fournir une aide contextuelle
   */
  detectCurrentPage() {
    const currentUrl = window.location.pathname;
    
    // Déterminer le contexte en fonction de l'URL
    if (currentUrl.includes('dashboard')) {
      this.currentContext = 'dashboard';
    } else if (currentUrl.includes('convert')) {
      this.currentContext = 'convert';
    } else if (currentUrl.includes('applications')) {
      this.currentContext = 'applications';
    } else if (currentUrl.includes('api-keys')) {
      this.currentContext = 'api-keys';
    } else if (currentUrl.includes('users')) {
      this.currentContext = 'users';
    } else if (currentUrl.includes('terminologies')) {
      this.currentContext = 'terminologies';
    } else if (currentUrl.includes('ai-settings')) {
      this.currentContext = 'ai-settings';
    } else if (currentUrl.includes('documentation')) {
      this.currentContext = 'documentation';
    } else if (currentUrl.includes('login')) {
      this.currentContext = 'login';
    } else {
      this.currentContext = 'general';
    }
  }

  /**
   * Ouvre ou ferme la fenêtre de chat
   */
  toggleChat(forceState = null) {
    this.isOpen = forceState !== null ? forceState : !this.isOpen;
    
    if (this.isOpen) {
      this.chatWindow.classList.remove('hidden');
      this.toggleButton.classList.add('active');
      this.inputField.focus();
    } else {
      this.chatWindow.classList.add('hidden');
      this.toggleButton.classList.remove('active');
    }
  }

  /**
   * Envoie un message au chatbot
   */
  async sendMessage() {
    const userMessage = this.inputField.value.trim();
    
    if (!userMessage || this.isWaitingForResponse) {
      return;
    }
    
    // Ajouter le message de l'utilisateur
    this.addUserMessage(userMessage);
    this.inputField.value = '';
    
    // Indiquer que nous attendons une réponse
    this.isWaitingForResponse = true;
    this.addTypingIndicator();
    
    try {
      if (this.aiProvider) {
        // Envoyer la requête à l'API d'IA
        const botResponse = await this.getAIResponse(userMessage);
        this.removeTypingIndicator();
        this.addBotMessage(botResponse);
      } else {
        // Réponse de secours si aucun fournisseur d'IA n'est configuré
        this.removeTypingIndicator();
        this.addBotMessage("Je suis désolé, je ne peux pas répondre pour le moment car aucun fournisseur d'IA n'est configuré. Veuillez contacter l'administrateur système.");
      }
    } catch (error) {
      console.error('Erreur lors de la communication avec l\'IA:', error);
      this.removeTypingIndicator();
      this.addBotMessage("Je suis désolé, une erreur s'est produite lors du traitement de votre demande. Veuillez réessayer ultérieurement.");
    }
    
    this.isWaitingForResponse = false;
  }

  /**
   * Obtient une réponse de l'IA
   */
  async getAIResponse(userMessage) {
    try {
      // Construire le contexte pour la requête IA
      const contextualizedMessage = `[Contexte: L'utilisateur est sur la page ${this.currentContext} de FHIRHub]\n\nQuestion de l'utilisateur: ${userMessage}`;
      
      // Historique des messages pour la conversation (limité aux 10 derniers échanges)
      const recentHistory = this.messageHistory.slice(-10);
      
      // Construire la requête pour l'API d'IA
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${FHIRHubAuth.getAuthToken()}`
        },
        body: JSON.stringify({
          provider: this.aiProvider.provider_name,
          messages: [
            { role: 'system', content: this.systemInstructions },
            ...recentHistory.map(msg => ({ role: msg.role, content: msg.content })),
            { role: 'user', content: contextualizedMessage }
          ],
          max_tokens: 1000
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Erreur ${response.status}: ${response.statusText}`);
      }
      
      const result = await response.json();
      
      // Ajouter à l'historique des messages
      this.messageHistory.push({ role: 'user', content: userMessage });
      this.messageHistory.push({ role: 'assistant', content: result.message });
      
      return result.message;
    } catch (error) {
      console.error('Erreur lors de la communication avec l\'API d\'IA:', error);
      return "Je suis désolé, je ne peux pas traiter votre demande pour le moment. Veuillez réessayer plus tard.";
    }
  }

  /**
   * Ajoute un message de l'utilisateur à la fenêtre de chat
   */
  addUserMessage(message) {
    const messageElement = document.createElement('div');
    messageElement.className = 'chatbot-message user-message';
    messageElement.innerHTML = `
      <div class="message-content">${this.escapeHtml(message)}</div>
    `;
    
    this.chatMessages.appendChild(messageElement);
    this.scrollToBottom();
  }

  /**
   * Ajoute un message du bot à la fenêtre de chat
   */
  addBotMessage(message) {
    const messageElement = document.createElement('div');
    messageElement.className = 'chatbot-message bot-message';
    
    // Formater le texte avec markdown basique
    const formattedMessage = this.formatMessage(message);
    
    messageElement.innerHTML = `
      <div class="message-avatar">
        <i class="fas fa-robot"></i>
      </div>
      <div class="message-content">${formattedMessage}</div>
    `;
    
    this.chatMessages.appendChild(messageElement);
    this.scrollToBottom();
  }

  /**
   * Ajoute un indicateur de saisie pendant l'attente de la réponse
   */
  addTypingIndicator() {
    const typingElement = document.createElement('div');
    typingElement.className = 'chatbot-message bot-message typing-indicator';
    typingElement.id = 'typing-indicator';
    
    typingElement.innerHTML = `
      <div class="message-avatar">
        <i class="fas fa-robot"></i>
      </div>
      <div class="message-content">
        <div class="typing-dots">
          <span></span>
          <span></span>
          <span></span>
        </div>
      </div>
    `;
    
    this.chatMessages.appendChild(typingElement);
    this.scrollToBottom();
  }

  /**
   * Retire l'indicateur de saisie
   */
  removeTypingIndicator() {
    const typingIndicator = document.getElementById('typing-indicator');
    if (typingIndicator) {
      typingIndicator.remove();
    }
  }

  /**
   * Fait défiler la fenêtre de chat vers le bas
   */
  scrollToBottom() {
    this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
  }

  /**
   * Formate un message avec un markdown simple
   */
  formatMessage(message) {
    if (!message) return '';
    
    // Échapper le HTML
    let formatted = this.escapeHtml(message);
    
    // Format simple pour les titres, listes et points importants
    formatted = formatted.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    formatted = formatted.replace(/\*(.*?)\*/g, '<em>$1</em>');
    formatted = formatted.replace(/\n\n/g, '<br><br>');
    formatted = formatted.replace(/\n- /g, '<br>• ');
    
    // Bloques de code
    formatted = formatted.replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>');
    formatted = formatted.replace(/`([^`]+)`/g, '<code>$1</code>');
    
    return formatted;
  }

  /**
   * Échappe les caractères HTML
   */
  escapeHtml(text) {
    const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    
    return text.replace(/[&<>"']/g, m => map[m]);
  }
}

// Initialiser le chatbot quand le DOM est chargé
document.addEventListener('DOMContentLoaded', function() {
  // Vérifier que l'utilisateur est connecté avant d'initialiser le chatbot
  if (typeof FHIRHubAuth !== 'undefined' && FHIRHubAuth.isAuthenticated()) {
    window.FHIRHubSupportBot = new FHIRHubSupportBot();
  }
});