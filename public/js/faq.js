document.addEventListener('DOMContentLoaded', function() {
    // Ajouter interactivité aux questions FAQ
    const faqItems = document.querySelectorAll('.faq-item');
    
    faqItems.forEach(item => {
        const question = item.querySelector('.faq-question');
        
        question.addEventListener('click', () => {
            // Fermer toutes les autres questions
            faqItems.forEach(otherItem => {
                if (otherItem !== item && otherItem.classList.contains('active')) {
                    otherItem.classList.remove('active');
                }
            });
            
            // Basculer l'état actif de la question cliquée
            item.classList.toggle('active');
        });
    });

    // Ouvrir la première question par défaut
    if (faqItems.length > 0) {
        faqItems[0].classList.add('active');
    }
});