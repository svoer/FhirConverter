/**
 * Fonctions utilitaires pour la page de paramètres de FHIRHub
 * Ce script complète les fonctionnalités définies dans settings.html
 */

// Styles CSS supplémentaires pour les badges et autres éléments
document.addEventListener('DOMContentLoaded', function() {
  // Ajouter des styles pour les badges et autres éléments spécifiques à la page settings
  const styleElement = document.createElement('style');
  styleElement.textContent = `
    .badge {
      display: inline-block;
      padding: 0.25em 0.6em;
      font-size: 0.75rem;
      font-weight: 700;
      line-height: 1;
      text-align: center;
      white-space: nowrap;
      vertical-align: baseline;
      border-radius: 0.25rem;
    }
    
    .badge-admin {
      background-color: var(--primary-color);
      color: #fff;
    }
    
    .badge-user {
      background-color: #6c757d;
      color: #fff;
    }
    
    .status-badge {
      display: inline-block;
      padding: 0.25em 0.6em;
      font-size: 0.75rem;
      font-weight: 700;
      line-height: 1;
      text-align: center;
      white-space: nowrap;
      vertical-align: baseline;
      border-radius: 0.25rem;
    }
    
    .status-active {
      background-color: #28a745;
      color: #fff;
    }
    
    .status-inactive {
      background-color: #dc3545;
      color: #fff;
    }
    
    .loading-row {
      text-align: center;
      padding: 1rem;
      color: #777;
    }
    
    .empty-row {
      text-align: center;
      padding: 1rem;
      color: #777;
      font-style: italic;
    }
    
    .alert {
      padding: 0.75rem 1.25rem;
      margin-bottom: 1rem;
      border: 1px solid transparent;
      border-radius: 0.25rem;
    }
    
    .alert-info {
      color: #0c5460;
      background-color: #d1ecf1;
      border-color: #bee5eb;
    }
    
    .alert-warning {
      color: #856404;
      background-color: #fff3cd;
      border-color: #ffeeba;
    }
    
    .api-key-display {
      display: flex;
      align-items: center;
    }
    
    .api-key-display pre {
      background-color: #f5f5f5;
      padding: 0.5rem;
      border-radius: 0.25rem;
      margin: 0;
      flex-grow: 1;
      overflow-x: auto;
    }
    
    .btn-copy {
      margin-left: 0.5rem;
    }
    
    .hidden {
      display: none !important;
    }
    
    .mt-4 {
      margin-top: 1.5rem;
    }
    
    .ai-form-row {
      display: flex;
      gap: 1rem;
    }
    
    .ai-form-column {
      flex: 1;
    }
    
    @media (max-width: 768px) {
      .ai-form-row {
        flex-direction: column;
      }
    }
    
    .large-modal .modal-content {
      max-width: 700px;
    }
  `;
  
  document.head.appendChild(styleElement);
});

// Fonctions utilitaires complémentaires
function validateJSON(str) {
  try {
    JSON.parse(str);
    return true;
  } catch (e) {
    return false;
  }
}

// Ajout de styles spécifiques pour la terminologie
function initializeTerminologyStyles() {
  const styleElement = document.createElement('style');
  styleElement.textContent = `
    .stats-container {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
      gap: 1rem;
      margin-bottom: 1.5rem;
    }
    
    .stat-card {
      display: flex;
      align-items: center;
      background-color: #fff;
      border-radius: 0.25rem;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
      padding: 1rem;
      transition: all 0.3s ease;
    }
    
    .stat-card:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
    }
    
    .stat-icon {
      font-size: 1.5rem;
      margin-right: 1rem;
      color: var(--primary-color);
    }
    
    .stat-info h3 {
      font-size: 0.9rem;
      margin: 0 0 0.25rem;
      color: #777;
    }
    
    .stat-info p {
      font-size: 1.25rem;
      font-weight: 600;
      margin: 0;
      color: #333;
    }
    
    .data-table {
      width: 100%;
      border-collapse: collapse;
    }
    
    .data-table th, .data-table td {
      border: 1px solid #e1e1e1;
      padding: 0.75rem;
      text-align: left;
    }
    
    .data-table th {
      background-color: #f5f5f5;
      font-weight: 600;
    }
    
    .data-table tr:nth-child(even) {
      background-color: #f9f9f9;
    }
    
    .data-table tr:hover {
      background-color: #f0f0f0;
    }
    
    .log-container {
      height: 200px;
      overflow-y: auto;
      background-color: #f5f5f5;
      border-radius: 0.25rem;
      padding: 1rem;
      font-family: monospace;
      font-size: 0.9rem;
    }
    
    .log-empty {
      color: #777;
      font-style: italic;
      text-align: center;
      padding: 2rem 0;
    }
    
    /* Styles pour le dropzone */
    .dropzone-container {
      border: 2px dashed #e1e1e1;
      border-radius: 0.25rem;
      padding: 2rem;
      text-align: center;
      transition: all 0.3s ease;
      margin-bottom: 1.5rem;
    }
    
    .dropzone-container:hover, .dropzone-container.dragover {
      border-color: var(--primary-color);
      background-color: rgba(231, 76, 60, 0.05);
    }
    
    .dropzone-icon {
      font-size: 3rem;
      color: var(--primary-color);
      margin-bottom: 1rem;
    }
    
    .dropzone-title {
      font-size: 1.25rem;
      margin-bottom: 0.5rem;
    }
    
    .dropzone-desc {
      color: #777;
      margin-bottom: 1rem;
    }
    
    .dropzone-button {
      background: linear-gradient(135deg, var(--primary-gradient-start), var(--primary-gradient-end));
      color: white;
      border: none;
      padding: 0.5rem 1.5rem;
      border-radius: 0.25rem;
      cursor: pointer;
      font-weight: 500;
      transition: all 0.3s ease;
    }
    
    .dropzone-button:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
    }
  `;
  
  document.head.appendChild(styleElement);
}

// Initialisation des styles de terminologie au chargement de la page
document.addEventListener('DOMContentLoaded', initializeTerminologyStyles);