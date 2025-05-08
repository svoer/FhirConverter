/**
 * Script de correction spécifique pour l'ouverture des rubriques FAQ
 */
document.addEventListener('DOMContentLoaded', function() {
    // Solution directe pour le problème des flèches FAQ
    console.log("Chargement de la solution directe pour les FAQ");
    
    // Ajout d'un handler direct sur tous les h3 des FAQ
    const faqHeaders = document.querySelectorAll('.faq-item h3');
    console.log(`Nombre d'en-têtes FAQ trouvés: ${faqHeaders.length}`);
    
    faqHeaders.forEach(header => {
        header.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            
            console.log(`Clic sur: ${this.textContent.substring(0, 20)}...`);
            
            // Trouver le parent .faq-item et basculer sa classe active
            const faqItem = this.closest('.faq-item');
            console.log(`FAQ item trouvé? ${faqItem ? 'Oui' : 'Non'}`);
            
            if (faqItem) {
                // Si on ouvre cet élément, fermer les autres
                if (!faqItem.classList.contains('active')) {
                    document.querySelectorAll('.faq-item.active').forEach(item => {
                        if (item !== faqItem) {
                            item.classList.remove('active');
                        }
                    });
                }
                
                // Basculer l'état
                faqItem.classList.toggle('active');
                console.log(`État actif après toggle: ${faqItem.classList.contains('active')}`);
            }
        });
    });
    
    // Solution alternative avec délégation d'événements
    document.addEventListener('click', function(e) {
        // Vérifier si on a cliqué sur un h3 ou un élément à l'intérieur
        const header = e.target.closest('.faq-item h3');
        if (header) {
            e.preventDefault();
            e.stopPropagation();
            
            const faqItem = header.closest('.faq-item');
            if (faqItem) {
                // Si on ouvre cet élément, fermer les autres
                if (!faqItem.classList.contains('active')) {
                    document.querySelectorAll('.faq-item.active').forEach(item => {
                        if (item !== faqItem) {
                            item.classList.remove('active');
                        }
                    });
                }
                
                // Basculer l'état
                faqItem.classList.toggle('active');
            }
        }
    });
});