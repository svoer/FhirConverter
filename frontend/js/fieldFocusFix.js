/**
 * Correctif pour le problème de perte de focus dans les champs texte
 * Ce module corrige le bug où l'utilisateur perd le focus lors de la saisie de texte HL7
 * 
 * @module fieldFocusFix
 * @author FHIRHub Team
 */

/** 
 * Appliquer le correctif de focus aux champs texte
 * @param {Array} selectorsList - Liste des sélecteurs CSS pour les champs à corriger
 */
function applyFieldFocusFix(selectorsList = ['.hl7-input', '#hl7-textarea', '.conversion-input', '#message-input']) {
  console.log("Application du correctif pour les champs texte");
  
  // Compter combien de champs ont été corrigés
  let fixedCount = 0;

  // Parcourir tous les sélecteurs et appliquer le correctif
  selectorsList.forEach(selector => {
    const elements = document.querySelectorAll(selector);
    
    elements.forEach(element => {
      if (element && !element.dataset.focusFixed) {
        // Marquer l'élément comme corrigé pour éviter de l'appliquer plusieurs fois
        element.dataset.focusFixed = 'true';
        
        // Empêcher la perte de focus en capturant l'événement et en empêchant la propagation
        element.addEventListener('focus', function(e) {
          e.target.addEventListener('blur', function preventBlur(blurEvent) {
            // Ignorer les événements de blur légitimes (lorsque l'utilisateur clique ailleurs volontairement)
            if (!blurEvent.relatedTarget || 
                !blurEvent.relatedTarget.classList.contains('submit-button')) {
              blurEvent.preventDefault();
              blurEvent.stopPropagation();
              
              // Redonner le focus au champ après un court délai
              setTimeout(() => {
                e.target.focus();
              }, 0);
            }
            
            // Supprimer cet écouteur pour permettre le blur volontaire
            e.target.removeEventListener('blur', preventBlur);
          }, { once: true });
        });
        
        // Désactiver l'auto-correction et suggestions qui peuvent interférer
        element.setAttribute('autocomplete', 'off');
        element.setAttribute('spellcheck', 'false');
        element.setAttribute('autocorrect', 'off');
        element.setAttribute('autocapitalize', 'off');
        
        fixedCount++;
      }
    });
  });
  
  console.log(`Correctif appliqué à ${fixedCount} champs de saisie`);
  return fixedCount;
}

/**
 * Initialise le correctif et configure son application récurrente
 * pour attraper les éléments ajoutés dynamiquement
 */
function initFieldFocusFix() {
  // Appliquer le correctif immédiatement
  applyFieldFocusFix();
  
  // Appliquer le correctif toutes les 2 secondes pour les éléments ajoutés dynamiquement
  setInterval(applyFieldFocusFix, 2000);
  
  // Observer les mutations du DOM pour détecter les nouveaux champs
  if (window.MutationObserver) {
    const observer = new MutationObserver(mutations => {
      let shouldApplyFix = false;
      
      mutations.forEach(mutation => {
        if (mutation.addedNodes && mutation.addedNodes.length > 0) {
          shouldApplyFix = true;
        }
      });
      
      if (shouldApplyFix) {
        applyFieldFocusFix();
      }
    });
    
    // Observer tout le document pour les nouveaux éléments
    observer.observe(document.body, { 
      childList: true, 
      subtree: true 
    });
  }
}

// Exportation des fonctions du module
window.fieldFocusFix = {
  init: initFieldFocusFix,
  apply: applyFieldFocusFix
};

// Appliquer le correctif au chargement de la page
document.addEventListener('DOMContentLoaded', initFieldFocusFix);