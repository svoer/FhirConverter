/**
 * Script de chatbot spécifique pour la page workflows
 * Cette version est adaptée à la structure DOM existante dans workflows.html
 */

document.addEventListener('DOMContentLoaded', () => {
  if (!localStorage.getItem('token')) {
    console.log('Utilisateur non authentifié, le chatbot ne sera pas chargé.');
    return;
  }

  console.log('Initialisation du chatbot pour workflows.html');
  
  // Petit délai pour s'assurer que le DOM est entièrement chargé
  setTimeout(() => {
    // Charger le fournisseur d'IA
    loadAIProvider();
    
    // Attacher les événements spécifiques à cette page
    setupChatbotEvents();
    
    console.log('Vérification des éléments DOM:');
    console.log('Header:', document.querySelector('.chatbot-header'));
    console.log('Messages:', document.getElementById('chatbot-messages'));
    console.log('Input:', document.getElementById('chatbot-input'));
    console.log('Send button:', document.getElementById('chatbot-send'));
  }, 500);
});

// Variables globales
let aiProvider = null;
let messageHistory = [];
let isWaitingForResponse = false;

// Instructions système pour le chatbot
const systemInstructions = `Tu es un assistant intégré dans l'application FHIRHub, qui est une plateforme de conversion HL7 vers FHIR pour le système de santé français.

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

/**
 * Configuration des événements pour le chatbot
 */
function setupChatbotEvents() {
  const chatbotHeader = document.querySelector('.chatbot-header');
  const chatbotInput = document.getElementById('chatbot-input');
  const chatbotSend = document.getElementById('chatbot-send');
  const chatbotToggle = document.querySelector('.chatbot-toggle');
  
  if (!chatbotHeader || !chatbotInput || !chatbotSend) {
    console.error("Éléments du chatbot manquants dans le DOM de workflows.html");
    return;
  }
  
  // Gestion de l'ouverture/fermeture du chatbot
  chatbotHeader.addEventListener('click', function() {
    const container = document.querySelector('.chatbot-container');
    container.classList.toggle('open');
    
    if (container.classList.contains('open')) {
      setTimeout(() => chatbotInput.focus(), 300);
    }
  });
  
  // Envoi du message via le bouton
  chatbotSend.addEventListener('click', function() {
    handleSendMessage();
  });
  
  // Envoi du message via Entrée
  chatbotInput.addEventListener('keypress', function(event) {
    if (event.key === 'Enter') {
      event.preventDefault();
      handleSendMessage();
    }
  });
  
  console.log('Événements du chatbot workflows configurés avec succès');
}

/**
 * Gestion de l'envoi d'un message
 */
async function handleSendMessage() {
  if (isWaitingForResponse) return;
  
  const inputField = document.getElementById('chatbot-input');
  if (!inputField) return;
  
  const message = inputField.value.trim();
  if (!message) return;
  
  if (!aiProvider) {
    addMessage('system', "Je suis désolé, mais je ne peux pas vous répondre pour le moment car aucun fournisseur d'IA n'est configuré.");
    inputField.value = '';
    return;
  }
  
  // Ajouter le message de l'utilisateur
  addMessage('user', message);
  
  // Effacer le champ
  inputField.value = '';
  
  // Afficher l'indicateur de chargement
  const loadingIndicator = document.createElement('div');
  loadingIndicator.className = 'message system typing';
  loadingIndicator.id = 'typing-indicator';
  loadingIndicator.innerHTML = 'Chargement...';
  document.getElementById('chatbot-messages').appendChild(loadingIndicator);
  
  // Marquer comme en attente
  isWaitingForResponse = true;
  
  try {
    // Obtenir la réponse
    const response = await getAIResponse(message);
    
    // Supprimer l'indicateur
    const indicator = document.getElementById('typing-indicator');
    if (indicator) indicator.remove();
    
    // Ajouter la réponse
    addMessage('system', response);
  } catch (error) {
    console.error('Erreur IA:', error);
    
    // Supprimer l'indicateur
    const indicator = document.getElementById('typing-indicator');
    if (indicator) indicator.remove();
    
    // Message d'erreur
    addMessage('system', "Désolé, je n'ai pas pu traiter votre demande. Veuillez réessayer ultérieurement.");
  }
  
  isWaitingForResponse = false;
}

/**
 * Ajoute un message au chatbot
 */
function addMessage(type, content) {
  const messagesContainer = document.getElementById('chatbot-messages');
  if (!messagesContainer) return;
  
  const messageElement = document.createElement('div');
  messageElement.className = `message ${type}`;
  messageElement.textContent = content;
  
  messagesContainer.appendChild(messageElement);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
  
  messageHistory.push({ role: type === 'system' ? 'assistant' : 'user', content });
}

/**
 * Charge le fournisseur d'IA
 */
async function loadAIProvider() {
  try {
    const response = await fetch('/api/ai/providers/active', {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    });
    
    if (!response.ok) {
      console.error("Erreur lors du chargement des fournisseurs d'IA");
      return;
    }
    
    const providers = await response.json();
    
    if (providers && providers.length > 0) {
      aiProvider = providers[0];
      console.log(`Fournisseur d'IA chargé: ${aiProvider.provider_name}`);
    } else {
      console.warn("Aucun fournisseur d'IA actif disponible");
    }
  } catch (error) {
    console.error("Erreur:", error);
  }
}

/**
 * Obtient une réponse de l'IA
 */
async function getAIResponse(userMessage) {
  try {
    const contextualizedMessage = `[Contexte: L'utilisateur est sur la page des workflows de FHIRHub]\n\nQuestion: ${userMessage}`;
    
    const recentHistory = messageHistory.slice(-10);
    
    const response = await fetch('/api/ai/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify({
        provider: aiProvider.provider_name,
        messages: [
          { role: 'system', content: systemInstructions },
          ...recentHistory.map(msg => ({ role: msg.role, content: msg.content })),
          { role: 'user', content: contextualizedMessage }
        ],
        max_tokens: 1000
      })
    });
    
    if (!response.ok) {
      throw new Error(`Erreur ${response.status}`);
    }
    
    const result = await response.json();
    return result.content || "Je suis désolé, je n'ai pas pu générer une réponse appropriée.";
  } catch (error) {
    console.error('Erreur IA:', error);
    throw error;
  }
}