/**
 * Gestion du menu de documentation avec fonctionnalité de réduction/expansion
 */
document.addEventListener('DOMContentLoaded', function() {
  // Éléments du DOM
  const sectionNav = document.querySelector('.section-nav');
  const toggleBtn = document.querySelector('.toggle-menu');
  const navItems = document.querySelectorAll('.section-nav a');
  const backToTopBtn = document.getElementById('back-to-top');
  
  // Variables pour suivre l'état
  let lastScrollY = window.scrollY;
  let isExpanded = true;
  let activeSection = 'introduction';
  
  // Initialiser le suivi de la section active
  const sections = {};
  document.querySelectorAll('.documentation-section').forEach(section => {
    sections[section.id] = section.offsetTop - 100;
  });
  
  // Fonction pour compacter le menu en mode scroll
  function compactMenu() {
    if (isExpanded) {
      sectionNav.classList.remove('expanded');
      isExpanded = false;
    }
  }
  
  // Fonction pour développer le menu
  function expandMenu() {
    if (!isExpanded) {
      sectionNav.classList.add('expanded');
      isExpanded = true;
    }
  }
  
  // Gestionnaire de clic sur le bouton de toggle
  if (toggleBtn) {
    toggleBtn.addEventListener('click', function() {
      if (isExpanded) {
        compactMenu();
      } else {
        expandMenu();
      }
    });
  }
  
  // Gestionnaire de clic sur les liens de navigation
  navItems.forEach(item => {
    item.addEventListener('click', function(e) {
      // Mettre à jour l'état actif
      navItems.forEach(link => link.classList.remove('active'));
      this.classList.add('active');
      
      // Compacter automatiquement le menu après la sélection
      setTimeout(() => {
        compactMenu();
      }, 500);
      
      // Mise à jour de la section active
      activeSection = this.getAttribute('href').substring(1);
    });
  });
  
  // Gestion du scroll
  window.addEventListener('scroll', function() {
    const scrollY = window.scrollY;
    
    // Afficher/masquer le bouton retour en haut
    if (scrollY > 300) {
      backToTopBtn.classList.add('visible');
    } else {
      backToTopBtn.classList.remove('visible');
    }
    
    // Compacter le menu lors du défilement vers le bas
    if (scrollY > lastScrollY + 50) {
      compactMenu();
      lastScrollY = scrollY;
    }
    
    // Développer le menu lors du défilement vers le haut
    if (scrollY < lastScrollY - 150) {
      expandMenu();
      lastScrollY = scrollY;
    }
    
    // Mise à jour de la section active lors du défilement
    for (const section in sections) {
      if (scrollY >= sections[section]) {
        activeSection = section;
      }
    }
    
    // Mettre à jour le lien actif dans le menu
    navItems.forEach(item => {
      const href = item.getAttribute('href').substring(1);
      if (href === activeSection) {
        if (!item.classList.contains('active')) {
          navItems.forEach(link => link.classList.remove('active'));
          item.classList.add('active');
        }
      }
    });
  });
  
  // Initialiser l'état du menu au chargement
  if (window.innerWidth < 768) {
    compactMenu();
  } else {
    expandMenu();
  }
});