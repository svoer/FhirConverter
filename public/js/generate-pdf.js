/**
 * Script pour générer un PDF de la documentation technique
 * Utilise html2pdf.js pour convertir la documentation en PDF
 */
document.addEventListener('DOMContentLoaded', function() {
  // Vérifier si le bouton de téléchargement existe
  const downloadPdfBtn = document.querySelector('.download-pdf-btn');
  
  if (downloadPdfBtn) {
    // Ajouter un gestionnaire d'événements au bouton
    downloadPdfBtn.addEventListener('click', function(e) {
      e.preventDefault();
      
      // Ajouter une animation de chargement
      const originalText = downloadPdfBtn.innerHTML;
      downloadPdfBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Génération en cours...';
      downloadPdfBtn.style.pointerEvents = 'none';
      
      // Sélectionner le contenu de la documentation
      const documentationContent = document.querySelector('.container');
      
      // Configuration pour html2pdf
      const opt = {
        margin: [10, 10, 10, 10],
        filename: 'FHIRHub_Documentation_Technique.pdf',
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { 
          scale: 2,
          useCORS: true,
          logging: false
        },
        jsPDF: { 
          unit: 'mm', 
          format: 'a4', 
          orientation: 'portrait' 
        },
        pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
      };
      
      // Créer une copie du contenu pour la génération du PDF (sans le menu de navigation et les boutons)
      const contentForPdf = documentationContent.cloneNode(true);
      
      // Supprimer les éléments non nécessaires pour le PDF
      const elementsToRemove = [
        '.section-nav',
        '.doc-actions',
        '.back-to-top',
        'script'
      ];
      
      elementsToRemove.forEach(selector => {
        const elements = contentForPdf.querySelectorAll(selector);
        elements.forEach(el => {
          if (el && el.parentNode) {
            el.parentNode.removeChild(el);
          }
        });
      });
      
      // Ajouter un style pour le PDF
      const style = document.createElement('style');
      style.textContent = `
        body {
          font-family: 'Roboto', sans-serif;
          color: #333;
          line-height: 1.6;
        }
        .container {
          padding: 20px;
        }
        h1 {
          font-size: 24px;
          color: #e74c3c;
          margin-bottom: 10px;
        }
        h2 {
          font-size: 20px;
          color: #e74c3c;
          margin-top: 25px;
          margin-bottom: 15px;
          border-bottom: 1px solid #ddd;
          padding-bottom: 5px;
        }
        h3 {
          font-size: 18px;
          color: #333;
          margin-top: 20px;
          margin-bottom: 10px;
        }
        .code-block {
          background-color: #f5f5f5;
          padding: 10px;
          border-radius: 5px;
          font-family: monospace;
          font-size: 12px;
          white-space: pre-wrap;
          word-break: break-all;
          margin: 15px 0;
        }
      `;
      
      contentForPdf.appendChild(style);
      
      // Créer un div temporaire pour contenir la version à exporter
      const tempContainer = document.createElement('div');
      tempContainer.appendChild(contentForPdf);
      tempContainer.style.position = 'absolute';
      tempContainer.style.left = '-9999px';
      document.body.appendChild(tempContainer);
      
      // Générer le PDF
      html2pdf()
        .from(tempContainer)
        .set(opt)
        .save()
        .then(() => {
          // Nettoyer et restaurer le bouton
          document.body.removeChild(tempContainer);
          downloadPdfBtn.innerHTML = originalText;
          downloadPdfBtn.style.pointerEvents = 'auto';
        })
        .catch(error => {
          console.error('Erreur lors de la génération du PDF:', error);
          downloadPdfBtn.innerHTML = originalText;
          downloadPdfBtn.style.pointerEvents = 'auto';
          alert('Une erreur est survenue lors de la génération du PDF. Veuillez réessayer.');
        });
    });
  }
});