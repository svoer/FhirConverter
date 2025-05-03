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

// Gestion de chargement des utilisateurs
async function loadUsers() {
  try {
    const usersTable = document.getElementById('users-table-body');
    if (!usersTable) return;
    
    usersTable.innerHTML = '<tr><td colspan="5" class="loading-row">Chargement des utilisateurs...</td></tr>';
    
    // Utiliser fetchWithAuth pour récupérer les utilisateurs
    const response = await window.FHIRHubAuth.fetchWithAuth('/api/users');
    
    if (!response || !response.success || !response.data) {
      throw new Error('Réponse vide ou invalide');
    }
    
    const users = response.data;
    
    if (users.length === 0) {
      usersTable.innerHTML = '<tr><td colspan="5" class="empty-row">Aucun utilisateur trouvé</td></tr>';
      return;
    }
    
    // Vider le tableau avant d'ajouter les utilisateurs
    usersTable.innerHTML = '';
    
    // Ajouter les utilisateurs au tableau
    users.forEach(user => {
      const row = document.createElement('tr');
      row.setAttribute('data-id', user.id);
      
      // Formater la date de création
      const createdDate = new Date(user.created_at);
      const formattedDate = createdDate.toLocaleDateString() + ' ' + createdDate.toLocaleTimeString();
      
      row.innerHTML = `
        <td>${user.id}</td>
        <td>${user.username}</td>
        <td><span class="badge badge-${user.role}">${user.role}</span></td>
        <td>${formattedDate}</td>
        <td class="actions">
          <button class="btn-edit" title="Modifier" onclick="editUser(${user.id})">
            <i class="fas fa-edit"></i>
          </button>
          <button class="btn-delete" title="Supprimer" onclick="deleteUser(${user.id})">
            <i class="fas fa-trash"></i>
          </button>
        </td>
      `;
      
      usersTable.appendChild(row);
    });
    console.log("Utilisateurs chargés avec succès:", users.length);
  } catch (error) {
    console.error('Erreur lors du chargement des utilisateurs:', error);
    const usersTable = document.getElementById('users-table-body');
    if (usersTable) {
      usersTable.innerHTML = `<tr><td colspan="5" class="empty-row error">Erreur: ${error.message}</td></tr>`;
    }
    // Afficher l'erreur dans la console de manière plus détaillée pour le débogage
    console.error("Détail de l'erreur:", error);
    console.trace("Stack trace:");
  }
}

// Gestion de chargement des applications
async function loadApplications() {
  try {
    const applicationsTable = document.getElementById('applications-table-body');
    if (!applicationsTable) return;
    
    applicationsTable.innerHTML = '<tr><td colspan="5" class="loading-row">Chargement des applications...</td></tr>';
    
    const response = await window.FHIRHubAuth.fetchWithAuth('/api/applications');
    
    if (!response || !response.success || !response.data) {
      throw new Error('Réponse vide ou invalide');
    }
    
    const applications = response.data;
    
    if (applications.length === 0) {
      applicationsTable.innerHTML = '<tr><td colspan="5" class="empty-row">Aucune application trouvée</td></tr>';
      return;
    }
    
    // Vider le tableau avant d'ajouter les applications
    applicationsTable.innerHTML = '';
    
    // Ajouter les applications au tableau
    applications.forEach(app => {
      const row = document.createElement('tr');
      row.setAttribute('data-id', app.id);
      
      // Formater la date de création
      const createdDate = new Date(app.created_at);
      const formattedDate = createdDate.toLocaleDateString() + ' ' + createdDate.toLocaleTimeString();
      
      row.innerHTML = `
        <td>${app.id}</td>
        <td>${app.name}</td>
        <td>${app.description || ''}</td>
        <td>${formattedDate}</td>
        <td class="actions">
          <button class="btn-edit" title="Modifier" onclick="editApplication(${app.id})">
            <i class="fas fa-edit"></i>
          </button>
          <button class="btn-delete" title="Supprimer" onclick="deleteApplication(${app.id})">
            <i class="fas fa-trash"></i>
          </button>
          <button class="btn-api-keys" title="Gérer les clés API" onclick="manageApiKeys(${app.id})">
            <i class="fas fa-key"></i>
          </button>
        </td>
      `;
      
      applicationsTable.appendChild(row);
    });
    console.log("Applications chargées avec succès:", applications.length);
  } catch (error) {
    console.error('Erreur lors du chargement des applications:', error);
    const applicationsTable = document.getElementById('applications-table-body');
    if (applicationsTable) {
      applicationsTable.innerHTML = `<tr><td colspan="5" class="empty-row error">Erreur: ${error.message}</td></tr>`;
    }
  }
}

// Fonction pour charger les fichiers de terminologie
async function loadTerminologyFiles() {
  try {
    const filesTable = document.getElementById('terminology-files-table-body');
    if (!filesTable) return;
    
    filesTable.innerHTML = '<tr><td colspan="6" class="loading-row">Chargement des fichiers de terminologie...</td></tr>';
    
    const response = await window.FHIRHubAuth.fetchWithAuth('/api/terminology/files');
    console.log("Terminology files response:", response);
    
    if (!response || !response.success || !response.data) {
      throw new Error('Réponse vide ou invalide');
    }
    
    const files = response.data;
    
    if (files.length === 0) {
      filesTable.innerHTML = '<tr><td colspan="6" class="empty-row">Aucun fichier de terminologie trouvé</td></tr>';
      return 0;
    }
    
    // Vider le tableau avant d'ajouter les fichiers
    filesTable.innerHTML = '';
    
    // Ajouter les fichiers au tableau
    files.forEach(file => {
      const row = document.createElement('tr');
      row.setAttribute('data-file', file.name);
      
      // Formater la date de dernière modification
      const modifiedDate = new Date(file.lastModified);
      const formattedDate = modifiedDate.toLocaleDateString() + ' ' + modifiedDate.toLocaleTimeString();
      
      // Formater la taille du fichier
      const sizeKB = Math.round(file.size / 1024);
      const formattedSize = sizeKB > 1024 ? Math.round(sizeKB / 1024 * 10) / 10 + ' MB' : sizeKB + ' KB';
      
      // Déterminer le type de fichier pour affichage
      let fileType = file.type;
      if (fileType === 'object') fileType = 'Objet JSON';
      else if (fileType === 'array') fileType = 'Tableau JSON';
      else if (fileType === 'systems') fileType = 'Systèmes';
      else if (fileType === 'oids') fileType = 'OIDs';
      else if (fileType === 'valuesets') fileType = 'Jeux de valeurs';
      else if (fileType === 'codesystems') fileType = 'Systèmes de codes';
      else if (fileType === 'terminology') fileType = 'Terminologie';
      else if (fileType === 'config') fileType = 'Configuration';
      else if (fileType === 'report') fileType = 'Rapport';
      else if (fileType === 'invalid') fileType = 'JSON Invalide';
      else fileType = 'Autre';
      
      console.log("Processing file:", file);
      
      row.innerHTML = `
        <td>${file.name}</td>
        <td>${fileType}</td>
        <td>${file.items} éléments</td>
        <td>${formattedSize}</td>
        <td>${formattedDate}</td>
        <td class="actions">
          <button class="btn-action btn-view" title="Voir" onclick="viewTerminologyFile('${file.name}')">
            <i class="fas fa-eye"></i>
          </button>
          <button class="btn-action btn-download" title="Télécharger" onclick="downloadTerminologyFile('${file.name}')">
            <i class="fas fa-download"></i>
          </button>
          ${!file.required ? `
            <button class="btn-action btn-delete" title="Supprimer" onclick="deleteTerminologyFile('${file.name}')">
              <i class="fas fa-trash"></i>
            </button>
          ` : `
            <button class="btn-action btn-delete disabled" title="Fichier obligatoire" disabled>
              <i class="fas fa-lock"></i>
            </button>
          `}
        </td>
      `;
      
      filesTable.appendChild(row);
    });
    
    return files.length;
  } catch (error) {
    console.error('Erreur lors du chargement des fichiers de terminologie:', error);
    const filesTable = document.getElementById('terminology-files-table-body');
    if (filesTable) {
      filesTable.innerHTML = `<tr><td colspan="6" class="empty-row error">Erreur: ${error.message}</td></tr>`;
    }
    return 0;
  }
}

// Fonction pour télécharger un fichier de terminologie
window.downloadTerminologyFile = function(filename) {
  try {
    const downloadUrl = `/api/terminology/download/${filename}`;
    
    // Créer un lien temporaire et simuler un clic
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    
    console.log(`Téléchargement du fichier ${filename} initié`);
  } catch (error) {
    console.error(`Erreur lors du téléchargement du fichier ${filename}:`, error);
    alert(`Erreur lors du téléchargement: ${error.message}`);
  }
};

// Fonction pour télécharger tous les fichiers de terminologie
window.downloadAllTerminologyFiles = function() {
  try {
    const downloadUrl = `/api/terminology/download-all`;
    
    // Créer un lien temporaire et simuler un clic
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = 'fhirhub-terminologies.zip';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    
    console.log(`Téléchargement de tous les fichiers initié`);
  } catch (error) {
    console.error(`Erreur lors du téléchargement de tous les fichiers:`, error);
    alert(`Erreur lors du téléchargement: ${error.message}`);
  }
};

// Fonction pour afficher les notifications
function showNotification(message, type = 'success') {
  // Utiliser une alerte simple si la fonction est appelée directement
  if (typeof message === 'string') {
    if (type === 'error') {
      alert(`Erreur: ${message}`);
    } else {
      alert(message);
    }
  }
}

// Fonction pour afficher les erreurs
function showError(message) {
  showNotification(message, 'error');
}

// Fonction pour prévisualiser un fichier de terminologie
window.viewTerminologyFile = async function(filename) {
  try {
    // Afficher le modal
    const modal = document.getElementById('file-preview-modal');
    const modalTitle = document.getElementById('file-preview-title');
    const modalContent = document.getElementById('file-preview-content');
    
    if (!modal || !modalTitle || !modalContent) {
      alert('Erreur: Éléments du modal introuvables');
      return;
    }
    
    // Mettre à jour le titre et montrer le modal
    modalTitle.textContent = `Prévisualisation: ${filename}`;
    modalContent.innerHTML = '<div class="loading-spinner"><i class="fas fa-spinner fa-spin"></i> Chargement du fichier...</div>';
    modal.style.display = 'block';
    
    try {
      // Récupérer le contenu du fichier
      const response = await window.FHIRHubAuth.fetchWithAuth(`/api/terminology/files/${filename}`);
      
      if (!response) {
        throw new Error('Réponse vide');
      }
      
      // Formater et afficher le contenu JSON
      let content = '';
      if (typeof response === 'object') {
        content = JSON.stringify(response, null, 2);
      } else {
        content = String(response);
      }
      
      // Créer un élément pre pour afficher le JSON formaté
      modalContent.innerHTML = `<pre class="json-content">${content}</pre>`;
      
    } catch (error) {
      console.error(`Erreur fetch:`, error);
      modalContent.innerHTML = `<div class="error-message">
        <i class="fas fa-exclamation-circle"></i> 
        Erreur lors du chargement: ${error.message || 'Erreur inconnue'}
      </div>`;
    }
    
    // Ajouter les gestionnaires d'événements pour fermer le modal
    const closeButtons = modal.querySelectorAll('.close, .close-modal');
    closeButtons.forEach(button => {
      button.onclick = function() {
        modal.style.display = 'none';
      }
    });
    
    // Fermer le modal en cliquant à l'extérieur
    window.onclick = function(event) {
      if (event.target === modal) {
        modal.style.display = 'none';
      }
    }
    
  } catch (error) {
    console.error(`Erreur lors de l'affichage du fichier ${filename}:`, error);
    alert(`Erreur lors de l'affichage du fichier: ${error.message}`);
  }
};

// Fonction pour supprimer un fichier de terminologie
window.deleteTerminologyFile = function(filename) {
  if (!confirm(`Êtes-vous sûr de vouloir supprimer le fichier ${filename} ? Cette action est irréversible.`)) {
    return;
  }
  
  try {
    window.FHIRHubAuth.fetchWithAuth(`/api/terminology/files/${filename}`, {
      method: 'DELETE'
    })
    .then(response => {
      if (response && response.success) {
        // Recharger les fichiers
        loadTerminologyFiles();
        // Recharger les statistiques
        loadTerminologyStats();
        showNotification(`Le fichier ${filename} a été supprimé avec succès.`);
      } else {
        showError(`Erreur lors de la suppression: ${response.message || 'Réponse invalide'}`);
      }
    })
    .catch(error => {
      console.error(`Erreur lors de la suppression du fichier ${filename}:`, error);
      showError(`Erreur lors de la suppression: ${error.message}`);
    });
  } catch (error) {
    console.error(`Erreur lors de la suppression du fichier ${filename}:`, error);
    showError(`Erreur lors de la suppression: ${error.message}`);
  }
};

// Fonction pour charger et afficher les statistiques de terminologie
async function loadTerminologyStats() {
  try {
    const statsContainer = document.getElementById('terminology-stats-container');
    if (!statsContainer) return;
    
    const response = await window.FHIRHubAuth.fetchWithAuth('/api/terminology/stats');
    console.log("Terminology stats response:", response);
    
    if (!response || !response.success || !response.data) {
      throw new Error('Réponse vide ou invalide');
    }
    
    const stats = response.data;
    
    // Mettre à jour les statistiques
    document.getElementById('terminology-files-count').textContent = stats.files_count || 0;
    document.getElementById('terminology-systems-count').textContent = stats.systems_count || 0;
    document.getElementById('terminology-oids-count').textContent = stats.oids_count || 0;
    document.getElementById('terminology-total-items').textContent = stats.total_items || 0;
    
    // Charger les fichiers de terminologie
    const filesCount = await loadTerminologyFiles();
    
    // Activer le bouton de téléchargement global si des fichiers sont disponibles
    const downloadAllBtn = document.getElementById('download-all-terminology-btn');
    if (downloadAllBtn) {
      downloadAllBtn.disabled = filesCount === 0;
    }
    
    return true;
  } catch (error) {
    console.error('Erreur lors du chargement des statistiques de terminologie:', error);
    const statsContainer = document.getElementById('terminology-stats-container');
    if (statsContainer) {
      statsContainer.innerHTML = `<div class="alert alert-danger">Erreur lors du chargement des statistiques: ${error.message}</div>`;
    }
    return false;
  }
}

// Ajouter un rafraîchissement des données de terminologie
window.refreshTerminologyData = function() {
  // Afficher un indicateur de chargement
  const refreshButton = document.getElementById('refresh-terminology-btn');
  if (refreshButton) {
    refreshButton.innerHTML = '<i class="fas fa-sync fa-spin"></i> Rafraîchissement...';
    refreshButton.disabled = true;
  }
  
  // Recharger les statistiques et les fichiers
  loadTerminologyStats()
    .then(() => {
      // Rétablir le bouton après le chargement
      if (refreshButton) {
        refreshButton.innerHTML = '<i class="fas fa-sync"></i> Rafraîchir';
        refreshButton.disabled = false;
      }
    })
    .catch(error => {
      console.error('Erreur lors du rafraîchissement des données:', error);
      // Rétablir le bouton en cas d'erreur
      if (refreshButton) {
        refreshButton.innerHTML = '<i class="fas fa-sync"></i> Rafraîchir';
        refreshButton.disabled = false;
      }
    });
};

// Gestion de chargement des clés API
async function loadApiKeys() {
  try {
    const apiKeysTable = document.getElementById('api-keys-table-body');
    if (!apiKeysTable) return;
    
    apiKeysTable.innerHTML = '<tr><td colspan="6" class="loading-row">Chargement des clés API...</td></tr>';
    
    const response = await window.FHIRHubAuth.fetchWithAuth('/api/api-keys');
    
    if (!response || !response.success || !response.data) {
      throw new Error('Réponse vide ou invalide');
    }
    
    const apiKeys = response.data;
    
    if (apiKeys.length === 0) {
      apiKeysTable.innerHTML = '<tr><td colspan="6" class="empty-row">Aucune clé API trouvée</td></tr>';
      return;
    }
    
    // Vider le tableau avant d'ajouter les clés API
    apiKeysTable.innerHTML = '';
    
    // Ajouter les clés API au tableau
    apiKeys.forEach(key => {
      const row = document.createElement('tr');
      row.setAttribute('data-id', key.id);
      
      // Formater la date de création
      const createdDate = new Date(key.created_at);
      const formattedDate = createdDate.toLocaleDateString() + ' ' + createdDate.toLocaleTimeString();
      
      // Formater la date d'expiration
      let expiresAt = 'Jamais';
      if (key.expires_at) {
        const expiresDate = new Date(key.expires_at);
        expiresAt = expiresDate.toLocaleDateString() + ' ' + expiresDate.toLocaleTimeString();
      }
      
      row.innerHTML = `
        <td>${key.id}</td>
        <td>${key.application_name}</td>
        <td>
          <div class="api-key-display">
            <pre>${key.key}</pre>
            <button class="btn-copy" title="Copier" onclick="copyToClipboard('${key.key}')">
              <i class="fas fa-copy"></i>
            </button>
          </div>
        </td>
        <td>${key.description || ''}</td>
        <td>${formattedDate}</td>
        <td class="actions">
          <button class="btn-toggle ${key.is_active ? 'active' : 'inactive'}" title="${key.is_active ? 'Désactiver' : 'Activer'}" onclick="toggleApiKey(${key.id}, ${!key.is_active})">
            <i class="fas fa-${key.is_active ? 'toggle-on' : 'toggle-off'}"></i>
          </button>
          <button class="btn-delete" title="Supprimer" onclick="deleteApiKey(${key.id})">
            <i class="fas fa-trash"></i>
          </button>
        </td>
      `;
      
      apiKeysTable.appendChild(row);
    });
    console.log("Clés API chargées avec succès:", apiKeys.length);
  } catch (error) {
    console.error('Erreur lors du chargement des clés API:', error);
    const apiKeysTable = document.getElementById('api-keys-table-body');
    if (apiKeysTable) {
      apiKeysTable.innerHTML = `<tr><td colspan="6" class="empty-row error">Erreur: ${error.message}</td></tr>`;
    }
  }
}

// Initialiser les onglets et charger les données appropriées
document.addEventListener('DOMContentLoaded', function() {
  console.log("Initialisation des onglets et chargement des données");
  
  // Vérifier si la page Settings est chargée
  const settingsContainer = document.querySelector('.settings-container');
  if (!settingsContainer) {
    console.log("Page Settings non détectée, abandon de l'initialisation");
    return;
  }
  
  // Vérifier l'authentification avant tout
  if (!window.FHIRHubAuth || !window.FHIRHubAuth.isAuthenticated()) {
    console.error("Utilisateur non authentifié, redirection vers login");
    window.location.href = '/login.html';
    return;
  }
  
  // Sélectionner tous les onglets
  const tabButtons = document.querySelectorAll('.tab-button');
  const tabContents = document.querySelectorAll('.tab-content');
  
  // Fonction pour afficher un onglet spécifique
  window.showTab = function(tabId) {
    // Masquer tous les contenus d'onglets
    tabContents.forEach(content => {
      content.classList.remove('active');
    });
    
    // Désactiver tous les boutons d'onglets
    tabButtons.forEach(button => {
      button.classList.remove('active');
    });
    
    // Afficher l'onglet demandé
    const tabContent = document.getElementById(tabId);
    if (tabContent) {
      tabContent.classList.add('active');
    }
    
    // Activer le bouton correspondant
    const tabButton = document.querySelector(`.tab-button[data-tab="${tabId}"]`);
    if (tabButton) {
      tabButton.classList.add('active');
    }
    
    // Charger les données appropriées en fonction de l'onglet
    if (tabId === 'users-tab') {
      loadUsers();
    } else if (tabId === 'applications-tab') {
      loadApplications();
    } else if (tabId === 'api-keys-tab') {
      loadApiKeys();
    } else if (tabId === 'terminology-tab') {
      loadTerminologyStats();
    } else if (tabId === 'ai-settings-tab') {
      loadAiProviders();
    }
  };
  
  // Attacher les événements de clic aux boutons d'onglets
  tabButtons.forEach(button => {
    button.addEventListener('click', function() {
      const tabId = this.getAttribute('data-tab');
      showTab(tabId);
    });
  });
  
  // Activer l'onglet par défaut ou celui spécifié dans l'URL
  const urlParams = new URLSearchParams(window.location.search);
  const tab = urlParams.get('tab');
  
  if (tab && document.getElementById(tab)) {
    showTab(tab);
  } else {
    // Par défaut, afficher le premier onglet
    const defaultTab = tabButtons[0]?.getAttribute('data-tab');
    if (defaultTab) {
      showTab(defaultTab);
    }
  }
});