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
      
      // Approche simplifiée : sélectionner directement tous les éléments de documentation
      const sections = document.querySelectorAll('.documentation-section');
      
      // Créer un conteneur pour le contenu du PDF
      const pdfContent = document.createElement('div');
      pdfContent.style.width = '210mm';  // Largeur A4
      pdfContent.style.padding = '10mm';
      
      // Ajouter le titre et le sous-titre
      const titleElement = document.createElement('h1');
      titleElement.textContent = 'Documentation Technique FHIRHub';
      titleElement.style.fontSize = '24px';
      titleElement.style.color = '#e74c3c';
      titleElement.style.fontFamily = 'Roboto, sans-serif';
      titleElement.style.marginBottom = '10px';
      
      const subtitleElement = document.createElement('p');
      subtitleElement.textContent = "Guide complet pour les développeurs et ingénieurs d\\'intégration";
      subtitleElement.style.fontSize = '16px';
      subtitleElement.style.color = '#666';
      subtitleElement.style.fontFamily = 'Roboto, sans-serif';
      subtitleElement.style.marginBottom = '30px';
      
      pdfContent.appendChild(titleElement);
      pdfContent.appendChild(subtitleElement);
      
      // Ajouter une table des matières
      const tocElement = document.createElement('div');
      tocElement.style.marginBottom = '20px';
      tocElement.style.padding = '15px';
      tocElement.style.backgroundColor = '#f9f9f9';
      tocElement.style.borderRadius = '5px';
      
      const tocTitle = document.createElement('h2');
      tocTitle.textContent = 'Table des matières';
      tocTitle.style.marginTop = '0';
      tocTitle.style.marginBottom = '10px';
      tocTitle.style.fontSize = '18px';
      tocTitle.style.color = '#e74c3c';
      tocElement.appendChild(tocTitle);
      
      const tocList = document.createElement('ul');
      tocList.style.listStyleType = 'none';
      tocList.style.padding = '0';
      
      sections.forEach((section, index) => {
        const titleText = section.querySelector('h2').textContent;
        const tocItem = document.createElement('li');
        tocItem.style.marginBottom = '8px';
        tocItem.textContent = `${index + 1}. ${titleText}`;
        tocList.appendChild(tocItem);
      });
      
      tocElement.appendChild(tocList);
      pdfContent.appendChild(tocElement);
      
      // Ajouter chaque section au conteneur PDF, en copiant juste leur contenu HTML
      sections.forEach(section => {
        const sectionClone = section.cloneNode(true);
        
        // Supprimer les éléments interactifs et scripts
        sectionClone.querySelectorAll('script, .back-to-top').forEach(el => {
          if (el.parentNode) {
            el.parentNode.removeChild(el);
          }
        });
        
        pdfContent.appendChild(sectionClone);
      });
      
      // Ajout de styles directement dans le conteneur
      const style = document.createElement('style');
      style.textContent = `
        * {
          font-family: 'Roboto', Arial, sans-serif;
        }
        .documentation-section {
          margin-bottom: 20px;
          page-break-inside: avoid;
        }
        h2 {
          font-size: 20px;
          color: #e74c3c;
          border-bottom: 1px solid #eee;
          padding-bottom: 5px;
          margin-top: 30px;
        }
        h3 {
          font-size: 16px;
          color: #333;
          margin-top: 20px;
        }
        p {
          font-size: 12px;
          line-height: 1.5;
          color: #333;
        }
        .code-block {
          background-color: #f5f5f5;
          padding: 10px;
          border-radius: 5px;
          font-family: monospace;
          font-size: 10px;
          white-space: pre-wrap;
          overflow-x: hidden;
          margin: 15px 0;
        }
        ul, ol {
          padding-left: 20px;
        }
        img {
          max-width: 100%;
        }
        table {
          width: 100%;
          border-collapse: collapse;
        }
        td, th {
          border: 1px solid #ddd;
          padding: 8px;
          font-size: 11px;
        }
        th {
          background-color: #f9f9f9;
        }
        .info-box, .warning-box, .tip-box {
          padding: 10px;
          margin: 10px 0;
          border-radius: 5px;
          font-size: 11px;
        }
        .info-box {
          background-color: #e7f5fd;
          border-left: 3px solid #3498db;
        }
        .warning-box {
          background-color: #fff3cd;
          border-left: 3px solid #ffc107;
        }
        .tip-box {
          background-color: #e7f7e7;
          border-left: 3px solid #27ae60;
        }
        .step-number {
          display: inline-block;
          width: 25px;
          height: 25px;
          background-color: #e74c3c;
          color: white;
          border-radius: 50%;
          text-align: center;
          line-height: 25px;
          margin-right: 10px;
        }
      `;
      
      pdfContent.appendChild(style);
      
      // Ajouter à un conteneur temporaire hors écran
      const tempContainer = document.createElement('div');
      tempContainer.appendChild(pdfContent);
      tempContainer.style.position = 'absolute';
      tempContainer.style.left = '-9999px';
      tempContainer.style.width = '210mm'; // Largeur A4
      document.body.appendChild(tempContainer);

      // Configuration pour html2pdf
      const opt = {
        margin: [10, 10, 10, 10],
        filename: 'FHIRHub_Documentation_Technique.pdf',
        image: { type: 'jpeg', quality: 0.95 },
        html2canvas: { 
          scale: 2, 
          useCORS: true,
          logging: true,
          letterRendering: true
        },
        jsPDF: { 
          unit: 'mm', 
          format: 'a4', 
          orientation: 'portrait',
          compress: true
        },
        pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
      };
      
      // Générer le PDF avec une méthode plus directe
      html2pdf().from(pdfContent).set(opt).save().then(() => {
        // Nettoyer et restaurer le bouton
        if (tempContainer.parentNode) {
          document.body.removeChild(tempContainer);
        }
        downloadPdfBtn.innerHTML = originalText;
        downloadPdfBtn.style.pointerEvents = 'auto';
      }).catch(error => {
        console.error('Erreur lors de la génération du PDF:', error);
        if (tempContainer.parentNode) {
          document.body.removeChild(tempContainer);
        }
        downloadPdfBtn.innerHTML = originalText;
        downloadPdfBtn.style.pointerEvents = 'auto';
        alert('Une erreur est survenue lors de la génération du PDF. Veuillez réessayer.');
      });
    });
  }
});