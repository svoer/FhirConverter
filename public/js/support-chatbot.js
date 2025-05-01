/**
 * Support Chatbot pour FHIRHub
 * Ce module gère le chatbot de support utilisateur intégré à l'application
 */

class FHIRHubChatbot {
  constructor() {
    this.initialized = false;
    this.isWaitingForResponse = false;
    this.aiProvider = null;
    this.messageHistory = [];
    this.expanded = false;
    this.currentContext = window.location.pathname;
    
    // Instructions système pour le chatbot
    this.systemInstructions = `Tu es un assistant intégré dans l'application FHIRHub, qui est une plateforme de conversion HL7 vers FHIR pour le système de santé français.
      
Tes réponses doivent être concises, professionnelles et adaptées au contexte de l'application.
Tu dois aider les utilisateurs avec leurs questions sur:
- L'utilisation de FHIRHub
- La conversion HL7 vers FHIR
- Les fonctionnalités de l'application
- Les problèmes techniques courants
- La documentation et les ressources disponibles

N'oublie pas:
- Tu n'analyses PAS les messages de santé; tu aides uniquement avec l'utilisation de l'application
- Tu ne traites PAS de données patient réelles
- Sois cordial et professionnel dans tes réponses
- Limite tes réponses à 2-3 phrases ou points concis
- Quand tu ne sais pas, suggère de consulter la documentation ou de contacter le support technique`;
    
    // Initialiser le chatbot après le chargement complet de la page
    document.addEventListener('DOMContentLoaded', () => this.init());
  }
  
  /**
   * Initialise le chatbot
   */
  async init() {
    // Vérifier si l'utilisateur est authentifié
    if (!this.isUserAuthenticated()) {
      console.log('Utilisateur non authentifié, le chatbot ne sera pas chargé.');
      return;
    }
    
    // Créer les éléments du chatbot
    this.createChatbotElements();
    
    // Charger le fournisseur d'IA configuré
    await this.loadAIProvider();
    
    // Ajouter les écouteurs d'événements
    this.addEventListeners();
    
    // Ajouter un message de bienvenue
    this.addMessage('assistant', 'Bonjour ! Je suis votre assistant FHIRHub. Comment puis-je vous aider aujourd\'hui ?');
    
    this.initialized = true;
    console.log('Chatbot FHIRHub initialisé avec succès.');
  }
  
  /**
   * Vérifie si l'utilisateur est authentifié
   * @returns {boolean} True si l'utilisateur est authentifié
   */
  isUserAuthenticated() {
    return localStorage.getItem('token') !== null;
  }
  
  /**
   * Crée les éléments HTML du chatbot
   */
  createChatbotElements() {
    // Vérifier si le chatbot existe déjà
    if (document.getElementById('fhirhub-chatbot')) {
      return;
    }
    
    // Ajouter Font Awesome s'il n'est pas déjà chargé
    if (!document.querySelector('link[href*="font-awesome"]')) {
      const fontAwesome = document.createElement('link');
      fontAwesome.rel = 'stylesheet';
      fontAwesome.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css';
      document.head.appendChild(fontAwesome);
    }
    
    // Créer le HTML du chatbot
    const chatbotHTML = `
      <div class="chatbot-container" id="fhirhub-chatbot">
        <div class="chatbot-header">
          <div class="chatbot-header-title">
            <i class="chatbot-header-icon fas fa-robot"></i>
            <span>Assistant FHIRHub</span>
          </div>
          <button class="chatbot-toggle" type="button">
            <i class="fas fa-chevron-up" id="chatbot-toggle-icon"></i>
          </button>
        </div>
        <div class="chatbot-body" id="chatbot-messages"></div>
        <div class="chatbot-footer">
          <input type="text" class="chatbot-input" id="chatbot-input" placeholder="Posez votre question ici...">
          <button class="chatbot-send" id="chatbot-send" type="button">
            <i class="fas fa-paper-plane"></i>
          </button>
        </div>
      </div>
    `;
    
    // Ajouter le HTML au DOM
    const chatbotWrapper = document.createElement('div');
    chatbotWrapper.innerHTML = chatbotHTML.trim();
    const chatbotElement = chatbotWrapper.firstChild;
    document.body.appendChild(chatbotElement);
  }
  
  /**
   * Ajoute les écouteurs d'événements
   */
  addEventListeners() {
    // Obtenir les éléments du DOM
    const chatbotHeader = document.querySelector('.chatbot-header');
    const toggleButton = document.querySelector('.chatbot-toggle');
    const toggleIcon = document.getElementById('chatbot-toggle-icon');
    
    // Fonction de toggle du chatbot
    const toggleChatbot = (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      const container = document.getElementById('fhirhub-chatbot');
      if (!container) return;
      
      this.expanded = !this.expanded;
      
      if (this.expanded) {
        container.classList.add('expanded');
        if (toggleIcon) {
          toggleIcon.classList.remove('fa-chevron-up');
          toggleIcon.classList.add('fa-chevron-down');
        }
      } else {
        container.classList.remove('expanded');
        if (toggleIcon) {
          toggleIcon.classList.remove('fa-chevron-down');
          toggleIcon.classList.add('fa-chevron-up');
        }
      }
      
      // Focus sur l'input quand le chatbot est ouvert
      if (this.expanded) {
        const inputField = document.getElementById('chatbot-input');
        if (inputField) {
          setTimeout(() => inputField.focus(), 300);
        }
      }
    };
    
    // Ajouter l'écouteur d'événements au header et au bouton toggle
    if (chatbotHeader) {
      chatbotHeader.addEventListener('click', toggleChatbot);
    }
    
    if (toggleButton) {
      toggleButton.addEventListener('click', toggleChatbot);
    }
    
    // Envoi de message avec le bouton
    const sendButton = document.getElementById('chatbot-send');
    sendButton.addEventListener('click', () => {
      this.sendMessage();
    });
    
    // Envoi de message avec la touche Entrée
    const inputField = document.getElementById('chatbot-input');
    inputField.addEventListener('keypress', (e) => {
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
      const response = await fetch('/api/ai/providers/active', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
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
      console.error('Erreur lors du chargement des fournisseurs d\'IA:', error);
    }
  }
  
  /**
   * Ajoute un message au chatbot
   * @param {string} role - Le rôle ('user' ou 'assistant')
   * @param {string} content - Le contenu du message
   */
  addMessage(role, content) {
    const messagesContainer = document.getElementById('chatbot-messages');
    const messageElement = document.createElement('div');
    
    messageElement.className = `chatbot-message ${role}`;
    messageElement.textContent = content;
    
    messagesContainer.appendChild(messageElement);
    
    // Faire défiler vers le bas
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
    
    // Ajouter à l'historique
    this.messageHistory.push({ role, content });
  }
  
  /**
   * Ajoute un indicateur de chargement pendant la réponse de l'IA
   */
  addLoadingIndicator() {
    const messagesContainer = document.getElementById('chatbot-messages');
    
    const loadingElement = document.createElement('div');
    loadingElement.className = 'chatbot-typing';
    loadingElement.id = 'chatbot-typing';
    
    for (let i = 0; i < 3; i++) {
      const dot = document.createElement('div');
      dot.className = 'chatbot-typing-dot';
      loadingElement.appendChild(dot);
    }
    
    messagesContainer.appendChild(loadingElement);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }
  
  /**
   * Supprime l'indicateur de chargement
   */
  removeLoadingIndicator() {
    const indicator = document.getElementById('chatbot-typing');
    if (indicator) {
      indicator.remove();
    }
  }
  
  /**
   * Envoie un message au chatbot
   */
  async sendMessage() {
    // Vérifier si on est déjà en attente d'une réponse
    if (this.isWaitingForResponse) {
      return;
    }
    
    // Récupérer le message
    const inputField = document.getElementById('chatbot-input');
    const message = inputField.value.trim();
    
    // Vérifier que le message n'est pas vide
    if (!message) {
      return;
    }
    
    // Vérifier que nous avons un fournisseur d'IA
    if (!this.aiProvider) {
      this.addMessage('assistant', "Je suis désolé, mais je ne peux pas vous répondre pour le moment car aucun fournisseur d'IA n'est configuré. Veuillez contacter l'administrateur.");
      inputField.value = '';
      return;
    }
    
    // Ajouter le message de l'utilisateur
    this.addMessage('user', message);
    
    // Effacer le champ de saisie
    inputField.value = '';
    
    // Afficher l'indicateur de chargement
    this.addLoadingIndicator();
    
    // Marquer comme en attente de réponse
    this.isWaitingForResponse = true;
    
    try {
      // Obtenir la réponse de l'IA
      const response = await this.getAIResponse(message);
      
      // Supprimer l'indicateur de chargement
      this.removeLoadingIndicator();
      
      // Ajouter la réponse
      this.addMessage('assistant', response);
    } catch (error) {
      console.error('Erreur lors de la communication avec l\'IA:', error);
      
      // Supprimer l'indicateur de chargement
      this.removeLoadingIndicator();
      
      // Ajouter un message d'erreur
      this.addMessage('assistant', "Je suis désolé, mais je n'ai pas pu traiter votre demande. Veuillez réessayer ultérieurement.");
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
          'Authorization': `Bearer ${localStorage.getItem('token')}`
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
      
      // Ajouter à l'historique du chatbot
      return result.content || "Je suis désolé, je n'ai pas pu générer une réponse appropriée.";
    } catch (error) {
      console.error('Erreur lors de la communication avec l\'IA:', error);
      throw error;
    }
  }
}

// Initialiser le chatbot
const chatbot = new FHIRHubChatbot();