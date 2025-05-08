/**
 * Script pour la page FAQ technique de FHIRHub
 * Gère la navigation, la recherche et l'interactivité
 */

document.addEventListener('DOMContentLoaded', function() {
    // Structure des catégories et des questions
    const faqCategories = [
        { id: 'terminology', name: 'Système de terminologie' },
        { id: 'conversion', name: 'Conversion HL7 vers FHIR' },
        { id: 'ai-integration', name: 'Intégration IA' },
        { id: 'auth-security', name: 'Authentification et sécurité' },
        { id: 'database', name: 'Base de données' },
        { id: 'workflows', name: 'Workflows et EAI' },
        { id: 'ui', name: 'Interface utilisateur' },
        { id: 'architecture', name: 'Architecture système' },
        { id: 'api', name: 'API et intégration' },
        { id: 'errors-logging', name: 'Erreurs et logging' },
        { id: 'performance', name: 'Performance' },
        { id: 'internationalization', name: 'Internationalisation' }
    ];

    // Éléments DOM
    const categoryList = document.getElementById('categoryList');
    const tocList = document.getElementById('tocList');
    const tocToggle = document.getElementById('tocToggle');
    // Éléments de recherche désactivés pour éviter les problèmes de performance
    // const faqSearch = document.getElementById('faqSearch');
    // const searchButton = document.getElementById('searchButton');
    
    // Générer la navigation par catégorie
    function generateCategoryNav() {
        categoryList.innerHTML = '';
        
        faqCategories.forEach(category => {
            const a = document.createElement('a');
            a.href = `#${category.id}`;
            a.textContent = category.name;
            a.dataset.category = category.id;
            
            // Ajouter une icône pour chaque catégorie
            const icon = document.createElement('i');
            icon.className = getCategoryIcon(category.id);
            a.insertBefore(icon, a.firstChild);
            
            categoryList.appendChild(a);
        });
        
        // Ajouter les gestionnaires d'événements
        categoryList.querySelectorAll('a').forEach(link => {
            link.addEventListener('click', function(e) {
                // Activer le lien cliqué
                categoryList.querySelectorAll('a').forEach(a => a.classList.remove('active'));
                this.classList.add('active');
            });
        });
    }
    
    // Fonction pour obtenir l'icône appropriée pour chaque catégorie
    function getCategoryIcon(categoryId) {
        const icons = {
            'terminology': 'fas fa-language',
            'conversion': 'fas fa-exchange-alt',
            'ai-integration': 'fas fa-robot',
            'auth-security': 'fas fa-shield-alt',
            'database': 'fas fa-database',
            'workflows': 'fas fa-sitemap',
            'ui': 'fas fa-desktop',
            'architecture': 'fas fa-cubes',
            'api': 'fas fa-plug',
            'errors-logging': 'fas fa-exclamation-triangle',
            'performance': 'fas fa-tachometer-alt',
            'internationalization': 'fas fa-globe'
        };
        
        return icons[categoryId] || 'fas fa-question-circle';
    }
    
    // Générer la table des matières
    function generateTableOfContents() {
        tocList.innerHTML = '';
        
        // Parcourir toutes les sections FAQ
        document.querySelectorAll('.faq-section').forEach(section => {
            const sectionId = section.id;
            const sectionTitle = section.querySelector('h2').textContent;
            
            // Ajouter le titre de la section
            const sectionLi = document.createElement('li');
            sectionLi.classList.add('section-title');
            sectionLi.textContent = sectionTitle;
            tocList.appendChild(sectionLi);
            
            // Ajouter chaque question de la section
            section.querySelectorAll('.faq-item h3').forEach(question => {
                const questionId = question.id;
                const questionText = question.textContent;
                
                const questionLi = document.createElement('li');
                const questionLink = document.createElement('a');
                questionLink.href = `#${questionId}`;
                questionLink.textContent = questionText;
                questionLink.dataset.section = sectionId;
                
                questionLi.appendChild(questionLink);
                tocList.appendChild(questionLi);
            });
        });
        
        // Ajouter les événements de clic
        tocList.querySelectorAll('a').forEach(link => {
            link.addEventListener('click', function(e) {
                // Activer la catégorie correspondante
                const section = this.dataset.section;
                categoryList.querySelectorAll('a').forEach(a => {
                    if (a.dataset.category === section) {
                        a.classList.add('active');
                    } else {
                        a.classList.remove('active');
                    }
                });
                
                // Ouvrir l'élément FAQ correspondant
                const targetId = this.getAttribute('href').substring(1);
                const targetElement = document.getElementById(targetId);
                if (targetElement) {
                    const faqItem = targetElement.closest('.faq-item');
                    if (faqItem && !faqItem.classList.contains('active')) {
                        faqItem.classList.add('active');
                    }
                    
                    // Faire défiler jusqu'à la question après un court délai
                    setTimeout(() => {
                        targetElement.scrollIntoView({ behavior: 'smooth' });
                    }, 100);
                }
            });
        });
    }
    
    // Configurer les interactions des FAQ items
    function setupFAQInteractions() {
        document.querySelectorAll('.faq-item h3').forEach(header => {
            header.addEventListener('click', function() {
                const parent = this.parentElement;
                
                // Toggle l'état actif
                const isActive = parent.classList.contains('active');
                
                // Si on ouvre cette FAQ, fermer les autres
                if (!isActive) {
                    const siblings = parent.parentElement.querySelectorAll('.faq-item');
                    siblings.forEach(item => {
                        if (item !== parent && item.classList.contains('active')) {
                            item.classList.remove('active');
                        }
                    });
                }
                
                // Toggle l'état de cette FAQ
                parent.classList.toggle('active');
            });
        });
    }
    
    // Gestionnaire pour le toggle de la table des matières
    function setupTOCToggle() {
        tocToggle.addEventListener('click', function() {
            const list = document.getElementById('tocList');
            list.classList.toggle('visible');
            this.querySelector('i').classList.toggle('fa-chevron-down');
            this.querySelector('i').classList.toggle('fa-chevron-up');
        });
    }
    
    // Fonction de recherche
    function setupSearch() {
        function performSearch() {
            const query = faqSearch.value.trim().toLowerCase();
            
            if (!query) {
                // Réinitialiser l'affichage si la recherche est vide
                document.querySelectorAll('.faq-item').forEach(item => {
                    item.style.display = '';
                    item.classList.remove('active');
                    
                    // Supprimer les surlignages précédents
                    const content = item.innerHTML;
                    item.innerHTML = content.replace(/<mark class="highlight(.*?)?">|<\/mark>/g, '');
                });
                return;
            }
            
            let foundResults = false;
            
            // Parcourir tous les éléments FAQ
            document.querySelectorAll('.faq-item').forEach(item => {
                const question = item.querySelector('h3').textContent.toLowerCase();
                const answer = item.querySelector('.faq-answer').textContent.toLowerCase();
                const matches = question.includes(query) || answer.includes(query);
                
                if (matches) {
                    item.style.display = '';
                    item.classList.add('active');
                    foundResults = true;
                    
                    // Surligner les occurrences
                    highlightText(item, query);
                } else {
                    item.style.display = 'none';
                }
            });
            
            // Afficher un message si aucun résultat
            const noResultsEl = document.getElementById('noResults');
            if (!foundResults) {
                if (!noResultsEl) {
                    const message = document.createElement('div');
                    message.id = 'noResults';
                    message.className = 'no-results';
                    message.innerHTML = `<p>Aucun résultat trouvé pour <strong>"${query}"</strong>.</p>`;
                    document.querySelector('.faq-container').prepend(message);
                }
            } else if (noResultsEl) {
                noResultsEl.remove();
            }
        }
        
        // Surligner le texte correspondant à la recherche
        function highlightText(element, query) {
            // Enlever les surlignages précédents
            const content = element.innerHTML;
            element.innerHTML = content.replace(/<mark class="highlight(.*?)?">|<\/mark>/g, '');
            
            // Créer une expression régulière pour la recherche insensible à la casse
            const regex = new RegExp(`(${query.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')})`, 'gi');
            
            // Fonction pour surligner le texte dans un nœud de texte
            function highlightInTextNode(textNode) {
                const parent = textNode.parentNode;
                
                // Sauter les noeuds dans les balises pre/code
                if (parent.tagName === 'CODE' || parent.tagName === 'PRE') {
                    return;
                }
                
                const content = textNode.nodeValue;
                if (regex.test(content)) {
                    const fragment = document.createDocumentFragment();
                    let match;
                    let lastIndex = 0;
                    regex.lastIndex = 0;
                    
                    while ((match = regex.exec(content)) !== null) {
                        // Ajouter le texte avant le match
                        if (match.index > lastIndex) {
                            fragment.appendChild(document.createTextNode(content.substring(lastIndex, match.index)));
                        }
                        
                        // Ajouter le texte surligné
                        const mark = document.createElement('mark');
                        mark.className = 'highlight highlight-pulse';
                        mark.appendChild(document.createTextNode(match[0]));
                        fragment.appendChild(mark);
                        
                        lastIndex = regex.lastIndex;
                    }
                    
                    // Ajouter le reste du texte
                    if (lastIndex < content.length) {
                        fragment.appendChild(document.createTextNode(content.substring(lastIndex)));
                    }
                    
                    parent.replaceChild(fragment, textNode);
                    return true;
                }
                return false;
            }
            
            // Fonction récursive pour parcourir tous les noeuds
            function walkTextNodes(node) {
                if (node.nodeType === 3) { // Noeud texte
                    return highlightInTextNode(node);
                } else if (node.nodeType === 1 && node.childNodes && 
                           !/(script|style|textarea)/i.test(node.tagName)) {
                    let hasHighlight = false;
                    for (let i = 0; i < node.childNodes.length; i++) {
                        const childNode = node.childNodes[i];
                        if (walkTextNodes(childNode)) {
                            hasHighlight = true;
                            // Ajuster l'index pour tenir compte des modifications dans le DOM
                            i += childNode.childNodes ? childNode.childNodes.length - 1 : 0;
                        }
                    }
                    return hasHighlight;
                }
                return false;
            }
            
            // Parcourir et surligner
            walkTextNodes(element);
        }
        
        // Écouter l'événement de recherche
        searchButton.addEventListener('click', performSearch);
        faqSearch.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                performSearch();
            }
        });
    }
    
    // Fonction pour gérer le bouton retour en haut de page
    function setupBackToTop() {
        const backToTopButton = document.getElementById('back-to-top');
        if (backToTopButton) {
            // Afficher le bouton quand on descend
            window.addEventListener('scroll', () => {
                if (window.scrollY > 300) {
                    backToTopButton.classList.add('visible');
                } else {
                    backToTopButton.classList.remove('visible');
                }
            });
            
            // Revenir en haut lors du clic
            backToTopButton.addEventListener('click', (e) => {
                e.preventDefault();
                window.scrollTo({
                    top: 0,
                    behavior: 'smooth'
                });
            });
        }
    }
    
    // Fonction pour naviguer vers une FAQ spécifique si l'URL contient un hash
    function navigateToHash() {
        if (window.location.hash) {
            const id = window.location.hash.substring(1);
            const targetElement = document.getElementById(id);
            
            if (targetElement) {
                // Si c'est un en-tête de question, ouvrir la FAQ correspondante
                if (targetElement.tagName === 'H3') {
                    const faqItem = targetElement.closest('.faq-item');
                    if (faqItem) {
                        faqItem.classList.add('active');
                    }
                }
                
                // Activer la catégorie correspondante
                const section = targetElement.closest('.faq-section');
                if (section) {
                    const sectionId = section.id;
                    categoryList.querySelectorAll('a').forEach(a => {
                        if (a.dataset.category === sectionId) {
                            a.classList.add('active');
                        }
                    });
                }
                
                // Faire défiler jusqu'à l'élément après un court délai
                setTimeout(() => {
                    targetElement.scrollIntoView({ behavior: 'smooth' });
                }, 100);
            }
        } else {
            // Si pas de hash, activer la première catégorie par défaut
            const firstCategoryLink = categoryList.querySelector('a');
            if (firstCategoryLink) {
                firstCategoryLink.classList.add('active');
            }
        }
    }
    
    // Initialiser tous les composants
    function init() {
        generateCategoryNav();
        generateTableOfContents();
        setupFAQInteractions();
        setupTOCToggle();
        setupSearch();
        setupBackToTop();
        
        // Naviguer vers le hash après que tout soit initialisé
        setTimeout(navigateToHash, 100);
        
        // Écouter les changements de hash pour la navigation
        window.addEventListener('hashchange', navigateToHash);
        
        console.log('FAQ technique initialisée avec succès');
    }
    
    // Démarrer l'initialisation
    init();
});