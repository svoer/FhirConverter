/**
 * Script pour gérer le chatbot de support FHIRHub en mode circulaire
 */
document.addEventListener('DOMContentLoaded', function() {
    // Référence au conteneur du chatbot
    const chatbotContainer = document.querySelector('.chatbot-container');
    
    if (!chatbotContainer) return;
    
    // Référence à l'en-tête pour les clics
    const chatbotHeader = chatbotContainer.querySelector('.chatbot-header');
    
    // Modifier le titre pour ajouter une icône centrale quand fermé
    const chatbotTitle = chatbotContainer.querySelector('.chatbot-title');
    if (chatbotTitle) {
        // Envelopper le texte existant dans un span
        const titleText = chatbotTitle.innerHTML;
        chatbotTitle.innerHTML = `<i class="fas fa-comment-dots"></i> <span>${titleText}</span>`;
    }
    
    // Ajouter un bouton de fermeture à l'en-tête
    if (chatbotHeader && !chatbotHeader.querySelector('.chatbot-close')) {
        const closeButton = document.createElement('button');
        closeButton.className = 'chatbot-close';
        closeButton.innerHTML = '<i class="fas fa-times"></i>';
        closeButton.style.background = 'transparent';
        closeButton.style.border = 'none';
        closeButton.style.color = 'white';
        closeButton.style.cursor = 'pointer';
        closeButton.style.fontSize = '16px';
        chatbotHeader.appendChild(closeButton);
        
        // Gestionnaire d'événements pour fermer le chatbot
        closeButton.addEventListener('click', function(e) {
            e.stopPropagation(); // Empêcher la propagation au header
            toggleChatbot(false);
        });
    }
    
    // Fonction pour basculer l'état du chatbot
    function toggleChatbot(open) {
        if (open === undefined) {
            open = !chatbotContainer.classList.contains('open');
        }
        
        if (open) {
            chatbotContainer.classList.add('opening');
            setTimeout(() => {
                chatbotContainer.classList.remove('opening');
                chatbotContainer.classList.add('open');
            }, 300);
        } else {
            chatbotContainer.classList.add('closing');
            chatbotContainer.classList.remove('open');
            setTimeout(() => {
                chatbotContainer.classList.remove('closing');
            }, 300);
        }
        
        // Sauvegarder l'état dans localStorage
        localStorage.setItem('chatbotOpen', open ? 'true' : 'false');
    }
    
    // Restaurer l'état du chatbot à partir de localStorage
    const savedState = localStorage.getItem('chatbotOpen');
    if (savedState === 'true') {
        toggleChatbot(true);
    }
    
    // Gestionnaire de clic pour ouvrir le chatbot en mode cercle
    chatbotContainer.addEventListener('click', function(e) {
        // Seulement réagir aux clics directs sur le conteneur ou le header
        if (!chatbotContainer.classList.contains('open')) {
            toggleChatbot(true);
        }
    });
    
    // Gestionnaire de clic pour l'en-tête quand le chatbot est ouvert
    if (chatbotHeader) {
        chatbotHeader.addEventListener('click', function(e) {
            // Ne pas réagir aux clics sur les boutons à l'intérieur de l'en-tête
            if (e.target.closest('.chatbot-close')) return;
            
            if (chatbotContainer.classList.contains('open')) {
                toggleChatbot(false);
            }
        });
    }
    
    // Périodiquement faire pulser le bouton s'il est fermé et a besoin d'attention
    setInterval(() => {
        // Conditions pour déclencher la pulsation (exemple : message non lu)
        const hasUnreadMessages = false; // À implémenter selon la logique de l'application
        
        if (!chatbotContainer.classList.contains('open') && hasUnreadMessages) {
            chatbotContainer.classList.add('pulse');
        } else {
            chatbotContainer.classList.remove('pulse');
        }
    }, 30000); // Vérifier toutes les 30 secondes
    
    console.log("Mode chatbot circulaire initialisé");
});