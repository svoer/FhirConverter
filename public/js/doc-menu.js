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
  let menuState = 'expanded'; // 'expanded', 'normal', 'collapsed'
  let activeSection = 'introduction';
  let hasScrolled = false; // Pour détecter si l'utilisateur a déjà fait défiler la page
  
  // Initialiser le suivi de la section active
  const sections = {};
  document.querySelectorAll('.documentation-section').forEach(section => {
    sections[section.id] = section.offsetTop - 100;
  });
  
  // Fonction pour complètement réduire le menu (juste l'icône hamburger)
  function collapseMenu() {
    if (menuState !== 'collapsed') {
      sectionNav.classList.remove('expanded');
      sectionNav.classList.add('collapsed');
      menuState = 'collapsed';
    }
  }
  
  // Fonction pour le menu en mode normal (non développé, non réduit)
  function normalMenu() {
    sectionNav.classList.remove('expanded');
    sectionNav.classList.remove('collapsed');
    menuState = 'normal';
  }
  
  // Fonction pour développer le menu
  function expandMenu() {
    sectionNav.classList.remove('collapsed');
    sectionNav.classList.add('expanded');
    menuState = 'expanded';
  }
  
  // Gestionnaire de clic sur le bouton de toggle
  if (toggleBtn) {
    toggleBtn.addEventListener('click', function(e) {
      e.stopPropagation(); // Empêcher la propagation pour éviter les conflits
      
      if (menuState === 'collapsed') {
        // Si menu réduit, on l'étend complètement
        expandMenu();
      } else {
        // Si menu non réduit, on le réduit
        collapseMenu();
      }
    });
  }
  
  // Gestionnaire de clic sur les liens de navigation
  navItems.forEach(item => {
    item.addEventListener('click', function(e) {
      // Si le menu est effondré, on empêche le clic pour permettre l'expansion d'abord
      if (menuState === 'collapsed') {
        e.preventDefault();
        expandMenu();
        return;
      }
      
      // Mettre à jour l'état actif
      navItems.forEach(link => link.classList.remove('active'));
      this.classList.add('active');
      
      // Réduire complètement le menu après un délai
      setTimeout(() => {
        if (hasScrolled) { // Ne réduire que si l'utilisateur a déjà fait défiler la page
          collapseMenu();
        }
      }, 500);
      
      // Mise à jour de la section active
      activeSection = this.getAttribute('href').substring(1);
    });
  });
  
  // Gestion du scroll
  window.addEventListener('scroll', function() {
    const scrollY = window.scrollY;
    
    // Marquer que l'utilisateur a fait défiler la page
    if (!hasScrolled && scrollY > 100) {
      hasScrolled = true;
    }
    
    // Afficher/masquer le bouton retour en haut
    if (scrollY > 300) {
      backToTopBtn.classList.add('visible');
    } else {
      backToTopBtn.classList.remove('visible');
    }
    
    // Réduire complètement le menu lors du défilement vers le bas si on a déjà scrollé
    if (scrollY > lastScrollY + 30 && hasScrolled) {
      collapseMenu();
      lastScrollY = scrollY;
    }
    
    // Restaurer le menu à son état normal lors du défilement vers le haut
    if (scrollY < lastScrollY - 100 && menuState === 'collapsed') {
      normalMenu();
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
  expandMenu(); // Toujours démarrer avec le menu étendu
  
  // Gestionnaire d'événements pour gérer les clics sur le body
  document.addEventListener('click', function(e) {
    // Si l'utilisateur clique en dehors du menu et que le menu est en état étendu
    // et que l'utilisateur a déjà fait défiler la page, réduire le menu
    if (!sectionNav.contains(e.target) && menuState === 'expanded' && hasScrolled) {
      collapseMenu();
    }
  });
  
  // Empêcher que le clic sur le menu réduit ferme le menu
  sectionNav.addEventListener('click', function(e) {
    if (menuState === 'collapsed') {
      e.stopPropagation();
      expandMenu();
    }
  });
});