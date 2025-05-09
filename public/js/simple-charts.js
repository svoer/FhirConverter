/**
 * simple-charts.js
 * Version simplifiée et robuste des graphiques du tableau de bord
 */

// Stockage global des références aux instances de graphiques
const charts = {};

// S'assurer que Chart.js est disponible avant d'initialiser les graphiques
document.addEventListener('DOMContentLoaded', function() {
  console.log("DOM chargé, initialisation des graphiques simples...");
  
  // Attendre que Chart.js soit chargé
  if (typeof Chart !== 'undefined') {
    // Initialiser les graphiques
    setTimeout(initializeAllCharts, 500);
  } else {
    console.error("Chart.js n'est pas chargé, attente...");
    
    // Vérifier périodiquement si Chart.js est chargé
    const checkChartJs = setInterval(function() {
      if (typeof Chart !== 'undefined') {
        clearInterval(checkChartJs);
        console.log("Chart.js chargé, initialisation des graphiques...");
        initializeAllCharts();
      }
    }, 100);
  }
});

// Configuration des couleurs (dégradé rouge-orange)
const colors = {
  redGradient: [
    'rgba(231, 76, 60, 0.7)',
    'rgba(241, 136, 5, 0.7)',
    'rgba(243, 156, 18, 0.7)',
    'rgba(246, 185, 59, 0.7)',
    'rgba(249, 231, 159, 0.7)'
  ],
  redGradientBorders: [
    'rgba(231, 76, 60, 1)',
    'rgba(241, 136, 5, 1)',
    'rgba(243, 156, 18, 1)',
    'rgba(246, 185, 59, 1)',
    'rgba(249, 231, 159, 1)'
  ],
  successError: [
    'rgba(46, 204, 113, 0.7)',
    'rgba(231, 76, 60, 0.7)'
  ],
  successErrorBorders: [
    'rgba(46, 204, 113, 1)',
    'rgba(231, 76, 60, 1)'
  ],
  memory: {
    background: 'rgba(243, 156, 18, 0.2)',
    border: 'rgba(243, 156, 18, 1)'
  },
  conversion: {
    background: 'rgba(231, 76, 60, 0.2)',
    border: 'rgba(231, 76, 60, 1)'
  }
};

// Fonction qui initialise tous les graphiques
function initializeAllCharts() {
  console.log("Initialisation de tous les graphiques avec simple-charts.js");
  
  try {
    // Vérifier que Chart.js est bien chargé
    if (typeof Chart === 'undefined') {
      console.error("Chart.js n'est pas chargé. Impossible d'initialiser les graphiques.");
      return;
    }
    
    // Vérifier que les éléments canvas existent
    const memoryCanvas = document.getElementById('memoryChart');
    const conversionTrendCanvas = document.getElementById('conversionTrendChart');
    const resourceDistCanvas = document.getElementById('resourceDistChart');
    const successRateCanvas = document.getElementById('successRateChart');
    const messageTypesCanvas = document.getElementById('messageTypesChart');
    
    console.log("État des canvas:", {
      memory: memoryCanvas ? "OK" : "Manquant",
      conversionTrend: conversionTrendCanvas ? "OK" : "Manquant",
      resourceDist: resourceDistCanvas ? "OK" : "Manquant",
      successRate: successRateCanvas ? "OK" : "Manquant",
      messageTypes: messageTypesCanvas ? "OK" : "Manquant"
    });
    
    // Assurer la destruction des graphiques existants
    function safeDestroyChart(chartId) {
      try {
        const existingChart = Chart.getChart(chartId);
        if (existingChart) {
          console.log(`Destruction du graphique existant: ${chartId}`);
          existingChart.destroy();
        }
      } catch (e) {
        console.warn(`Erreur lors de la destruction du graphique ${chartId}:`, e);
      }
    }
    
    // Nettoyer les graphiques existants qui pourraient causer des conflits
    if (memoryCanvas) safeDestroyChart(memoryCanvas);
    if (conversionTrendCanvas) safeDestroyChart(conversionTrendCanvas);
    if (resourceDistCanvas) safeDestroyChart(resourceDistCanvas);
    if (successRateCanvas) safeDestroyChart(successRateCanvas);
    if (messageTypesCanvas) safeDestroyChart(messageTypesCanvas);
    
    // Réinitialiser l'objet charts pour s'assurer qu'on part d'un état propre
    Object.keys(charts).forEach(key => delete charts[key]);
    
    // Créer des graphiques vides un par un avec gestion d'erreur individuelle
    if (memoryCanvas) {
      try {
        console.log("Création du graphique mémoire...");
        createMemoryChart();
        console.log("Graphique mémoire créé avec succès");
      } catch (e) {
        console.error("Erreur lors de la création du graphique mémoire:", e);
      }
    }
    
    if (conversionTrendCanvas) {
      try {
        console.log("Création du graphique de tendance de conversion...");
        createConversionTrendChart();
        console.log("Graphique de tendance de conversion créé avec succès");
      } catch (e) {
        console.error("Erreur lors de la création du graphique de tendance de conversion:", e);
      }
    }
    
    if (resourceDistCanvas) {
      try {
        console.log("Création du graphique de distribution de ressources...");
        createResourceDistChart();
        console.log("Graphique de distribution de ressources créé avec succès");
      } catch (e) {
        console.error("Erreur lors de la création du graphique de distribution de ressources:", e);
      }
    }
    
    if (successRateCanvas) {
      try {
        console.log("Création du graphique de taux de succès...");
        createSuccessRateChart();
        console.log("Graphique de taux de succès créé avec succès");
      } catch (e) {
        console.error("Erreur lors de la création du graphique de taux de succès:", e);
      }
    }
    
    if (messageTypesCanvas) {
      try {
        console.log("Création du graphique de types de messages...");
        createMessageTypesChart();
        console.log("Graphique de types de messages créé avec succès");
      } catch (e) {
        console.error("Erreur lors de la création du graphique de types de messages:", e);
      }
    }
    
    // Première récupération des données
    console.log("Récupération initiale des données...");
    try {
      fetchAndUpdateCharts();
    } catch (e) {
      console.error("Erreur lors de la récupération des données:", e);
    }
    
    // Mettre à jour régulièrement les graphiques
    console.log("Configuration de la mise à jour périodique des graphiques...");
    setInterval(function() {
      try {
        fetchAndUpdateCharts();
      } catch (e) {
        console.error("Erreur lors de la mise à jour périodique des graphiques:", e);
      }
    }, 10000);
    
    // Vérifier l'état des graphiques après initialisation
    console.log("Vérification de l'état des graphiques après initialisation:", {
      memory: charts.memory ? "Initialisé" : "Non initialisé",
      conversionTrend: charts.conversionTrend ? "Initialisé" : "Non initialisé",
      resourceDist: charts.resourceDist ? "Initialisé" : "Non initialisé",
      successRate: charts.successRate ? "Initialisé" : "Non initialisé",
      messageTypes: charts.messageTypes ? "Initialisé" : "Non initialisé"
    });
    
  } catch (error) {
    console.error("Erreur lors de l'initialisation des graphiques:", error);
    // Affichage détaillé de l'erreur
    if (error.stack) {
      console.error("Stack trace:", error.stack);
    }
  }
}

// Fonction qui récupère les données et met à jour tous les graphiques
function fetchAndUpdateCharts() {
  console.log("Récupération des données pour les graphiques...");
  
  // Récupérer les statistiques générales
  fetch('/api/stats')
    .then(response => response.json())
    .then(data => {
      if (data.success) {
        console.log("Données reçues pour les graphiques:", data.data);
        updateDashboardCounters(data.data);
        
        // Mettre à jour les graphiques mémoire et tendance
        if (data.data.memory) {
          updateMemoryChart(data.data.memory);
        }
        
        if (data.data.conversionStats && data.data.conversionStats.lastTime) {
          updateConversionTrendChart(data.data.conversionStats.lastTime);
        }
        
        // Mettre à jour le taux de réussite avec une valeur par défaut
        // (toutes conversions réussies si pas d'info détaillée)
        updateSuccessRateChart(data.data.conversions, 0);
      }
    })
    .catch(error => {
      console.error("Erreur lors de la récupération des statistiques:", error);
    });
    
  // Récupérer les données de types de messages HL7
  fetch('/api/message-types')
    .then(response => response.json())
    .then(data => {
      if (data.success) {
        console.log("Données de types de messages HL7 reçues:", data.data);
        updateMessageTypesChart(data.data);
      }
    })
    .catch(error => {
      console.error("Erreur lors de la récupération des types de messages:", error);
    });
    
  // Récupérer les données de distribution des ressources (à implémenter)
  // Cette API pourrait ne pas encore exister
  fetch('/api/resource-distribution')
    .then(response => response.json())
    .then(data => {
      if (data.success) {
        console.log("Données de distribution des ressources reçues:", data.data);
        updateResourceDistChart(data.data);
      }
    })
    .catch(error => {
      // Ignorer les erreurs - cette API pourrait ne pas être disponible
      console.log("Distribution des ressources non disponible");
    });
    
  // Mettre à jour les timestamps
  updateTimestamps();
}

// Mise à jour des compteurs du tableau de bord
function updateDashboardCounters(data) {
  // Compteur de conversion
  const conversionsCount = document.getElementById('conversionsCount');
  if (conversionsCount) conversionsCount.textContent = data.conversions;
  
  // Statistiques de conversion
  if (data.conversionStats) {
    const stats = data.conversionStats;
    
    // Temps moyen de conversion
    const avgConversionTime = document.getElementById('avg-conversion-time');
    if (avgConversionTime) avgConversionTime.textContent = `${stats.avgTime} ms`;
    
    // Dernier temps de conversion
    const lastConversionTime = document.getElementById('last-conversion-time');
    if (lastConversionTime) lastConversionTime.textContent = `${stats.lastTime} ms`;
    
    // Temps min/max
    const minmaxConversionTime = document.getElementById('minmax-conversion-time');
    if (minmaxConversionTime) minmaxConversionTime.textContent = `${stats.minTime} / ${stats.maxTime} ms`;
    
    // Ressources moyennes
    const avgResources = document.getElementById('avg-resources');
    if (avgResources) avgResources.textContent = stats.avgResources;
  }
  
  // Temps économisé
  const timeSaved = document.getElementById('time-saved');
  if (timeSaved && data.timeSavedHours) {
    timeSaved.textContent = data.timeSavedHours.toFixed(1);
  }
}

// Mise à jour des timestamps
function updateTimestamps() {
  const now = new Date();
  const timeStr = now.toLocaleTimeString();
  
  const elements = [
    document.getElementById('lastUpdateTime'),
    document.getElementById('statsUpdateTime')
  ];
  
  elements.forEach(element => {
    if (element) element.textContent = timeStr;
  });
}

// Création et mise à jour du graphique mémoire
function createMemoryChart() {
  const ctx = document.getElementById('memoryChart');
  if (!ctx) return;
  
  const data = {
    labels: Array(10).fill(''),
    datasets: [{
      label: 'Utilisation mémoire (MB)',
      data: Array(10).fill(0),
      borderColor: colors.memory.border,
      backgroundColor: colors.memory.background,
      borderWidth: 1,
      tension: 0.4,
      fill: true
    }]
  };
  
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      y: {
        beginAtZero: true,
        title: {
          display: true,
          text: 'MB'
        }
      },
      x: {
        display: false
      }
    },
    plugins: {
      legend: {
        display: false
      }
    }
  };
  
  charts.memory = new Chart(ctx, {
    type: 'line',
    data: data,
    options: options
  });
}

function updateMemoryChart(memoryData) {
  if (!charts.memory) return;
  
  // Conversion de bytes à MB pour une meilleure lisibilité
  const memoryMB = Math.round(memoryData.rss / (1024 * 1024));
  
  // Récupérer les anciennes données
  const oldData = [...charts.memory.data.datasets[0].data];
  
  // Mettre à jour les données
  oldData.push(memoryMB);
  if (oldData.length > 10) {
    oldData.shift();
  }
  
  // Mise à jour du graphique
  charts.memory.data.datasets[0].data = oldData;
  charts.memory.update();
}

// Création et mise à jour du graphique tendance conversion
function createConversionTrendChart() {
  const ctx = document.getElementById('conversionTrendChart');
  if (!ctx) return;
  
  const data = {
    labels: Array(10).fill(''),
    datasets: [{
      label: 'Temps de traitement (ms)',
      data: Array(10).fill(0),
      borderColor: colors.conversion.border,
      backgroundColor: colors.conversion.background,
      borderWidth: 1,
      tension: 0.4,
      fill: true
    }]
  };
  
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      y: {
        beginAtZero: true,
        title: {
          display: true,
          text: 'ms'
        }
      },
      x: {
        display: false
      }
    },
    plugins: {
      legend: {
        display: false
      }
    }
  };
  
  charts.conversionTrend = new Chart(ctx, {
    type: 'line',
    data: data,
    options: options
  });
}

function updateConversionTrendChart(lastConversionTime) {
  if (!charts.conversionTrend) return;
  
  // Récupérer les anciennes données
  const oldData = [...charts.conversionTrend.data.datasets[0].data];
  
  // Ajouter la nouvelle valeur et retirer la plus ancienne
  oldData.push(lastConversionTime);
  if (oldData.length > 10) {
    oldData.shift();
  }
  
  // Mettre à jour les données du graphique
  charts.conversionTrend.data.datasets[0].data = oldData;
  charts.conversionTrend.update();
}

// Création et mise à jour du graphique distribution ressources FHIR
function createResourceDistChart() {
  const ctx = document.getElementById('resourceDistChart');
  if (!ctx) return;
  
  const chartContainer = document.getElementById('resourceDistChartContainer');
  const noDataMessage = document.getElementById('resourceDistNoData');
  
  // Message par défaut: pas de données
  if (chartContainer) chartContainer.style.display = 'none';
  if (noDataMessage) noDataMessage.style.display = 'flex';
  
  const data = {
    labels: ['Pas de données'],
    datasets: [{
      label: 'Distribution ressources',
      data: [1],
      backgroundColor: ['rgba(200,200,200,0.5)'],
      borderColor: ['rgba(200,200,200,1)'],
      borderWidth: 1
    }]
  };
  
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false
      }
    }
  };
  
  charts.resourceDist = new Chart(ctx, {
    type: 'pie',
    data: data,
    options: options
  });
}

function updateResourceDistChart(resourceData) {
  if (!charts.resourceDist) return;
  
  const chartContainer = document.getElementById('resourceDistChartContainer');
  const noDataMessage = document.getElementById('resourceDistNoData');
  const ctx = document.getElementById('resourceDistChart');
  
  // Détruire l'ancien graphique
  charts.resourceDist.destroy();
  
  // Vérifier si nous avons des données réelles
  if (resourceData && resourceData.length > 0) {
    // Afficher le graphique, masquer le message
    if (chartContainer) chartContainer.style.display = 'block';
    if (noDataMessage) noDataMessage.style.display = 'none';
    
    // Préparer les données
    const labels = resourceData.map(item => item.name);
    const values = resourceData.map(item => item.count);
    
    // Création du graphique
    charts.resourceDist = new Chart(ctx, {
      type: 'pie',
      data: {
        labels: labels,
        datasets: [{
          label: 'Distribution ressources',
          data: values,
          backgroundColor: colors.redGradient,
          borderColor: colors.redGradientBorders,
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'top',
            labels: {
              font: {
                size: 11
              }
            }
          }
        }
      }
    });
  } else {
    // Pas de données - afficher le message
    if (chartContainer) chartContainer.style.display = 'none';
    if (noDataMessage) noDataMessage.style.display = 'flex';
    
    // Créer un graphique vide (invisible)
    charts.resourceDist = new Chart(ctx, {
      type: 'pie',
      data: {
        labels: ['Pas de données'],
        datasets: [{
          label: 'Distribution ressources',
          data: [1],
          backgroundColor: ['rgba(200,200,200,0.5)'],
          borderColor: ['rgba(200,200,200,1)'],
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false
          }
        }
      }
    });
  }
}

// Création et mise à jour du graphique taux de réussite
function createSuccessRateChart() {
  const ctx = document.getElementById('successRateChart');
  if (!ctx) return;
  
  const chartContainer = document.getElementById('successRateChartContainer');
  const noDataMessage = document.getElementById('successRateNoData');
  
  // Montrer le graphique même vide
  if (chartContainer) chartContainer.style.display = 'block';
  if (noDataMessage) noDataMessage.style.display = 'none';
  
  const data = {
    labels: ['Réussi', 'Erreur'],
    datasets: [{
      label: 'Taux de réussite',
      data: [1, 0],
      backgroundColor: colors.successError,
      borderColor: colors.successErrorBorders,
      borderWidth: 1
    }]
  };
  
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
        labels: {
          font: {
            size: 11
          }
        }
      },
      tooltip: {
        callbacks: {
          label: function(context) {
            const total = context.dataset.data.reduce((a, b) => a + b, 0);
            const percent = total > 0 ? Math.round(context.raw / total * 100) : 0;
            return `${context.label}: ${context.raw} (${percent}%)`;
          }
        }
      }
    }
  };
  
  charts.successRate = new Chart(ctx, {
    type: 'doughnut',
    data: data,
    options: options
  });
}

function updateSuccessRateChart(successCount, errorCount) {
  if (!charts.successRate) return;
  
  // S'assurer que les valeurs sont numériques
  successCount = parseInt(successCount) || 0;
  errorCount = parseInt(errorCount) || 0;
  
  // Vérifier que nous avons des données
  if (successCount === 0 && errorCount === 0) {
    successCount = 1; // Valeur par défaut
  }
  
  // Mise à jour des données du graphique
  charts.successRate.data.datasets[0].data = [successCount, errorCount];
  charts.successRate.update();
}

// Création et mise à jour du graphique types de messages
function createMessageTypesChart() {
  const ctx = document.getElementById('messageTypesChart');
  if (!ctx) return;
  
  const chartContainer = document.getElementById('messageTypesChartContainer');
  const noDataMessage = document.getElementById('messageTypesNoData');
  
  // Message par défaut: pas de données
  if (chartContainer) chartContainer.style.display = 'none';
  if (noDataMessage) noDataMessage.style.display = 'flex';
  
  const data = {
    labels: ['Pas de données'],
    datasets: [{
      label: 'Types de messages',
      data: [1],
      backgroundColor: ['rgba(200,200,200,0.5)'],
      borderColor: ['rgba(200,200,200,1)'],
      borderWidth: 1
    }]
  };
  
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false
      }
    }
  };
  
  charts.messageTypes = new Chart(ctx, {
    type: 'bar',
    data: data,
    options: options
  });
}

function updateMessageTypesChart(messageData) {
  if (!charts.messageTypes) return;
  
  const chartContainer = document.getElementById('messageTypesChartContainer');
  const noDataMessage = document.getElementById('messageTypesNoData');
  const ctx = document.getElementById('messageTypesChart');
  
  // Détruire l'ancien graphique
  charts.messageTypes.destroy();
  
  // Vérifier si nous avons des données réelles
  if (messageData && messageData.length > 0) {
    console.log("Graphique des types de messages HL7 mis à jour avec les données réelles");
    
    // Afficher le graphique, masquer le message
    if (chartContainer) chartContainer.style.display = 'block';
    if (noDataMessage) noDataMessage.style.display = 'none';
    
    // Préparer les données
    const labels = messageData.map(item => item.message_type);
    const values = messageData.map(item => item.count);
    
    // Création du graphique
    charts.messageTypes = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: 'Nombre de messages',
          data: values,
          backgroundColor: colors.redGradient[0],
          borderColor: colors.redGradientBorders[0],
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              precision: 0
            }
          }
        },
        plugins: {
          legend: {
            display: false
          }
        }
      }
    });
  } else {
    // Pas de données - afficher le message
    if (chartContainer) chartContainer.style.display = 'none';
    if (noDataMessage) noDataMessage.style.display = 'flex';
    
    // Créer un graphique vide (invisible)
    charts.messageTypes = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: ['Pas de données'],
        datasets: [{
          label: 'Types de messages',
          data: [1],
          backgroundColor: ['rgba(200,200,200,0.5)'],
          borderColor: ['rgba(200,200,200,1)'],
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false
          }
        }
      }
    });
  }
}

// Initialiser les graphiques quand le DOM est chargé
document.addEventListener('DOMContentLoaded', function() {
  console.log("DOM chargé, initialisation des graphiques simples...");
  
  // Attendre un peu pour s'assurer que tous les éléments sont bien rendus
  setTimeout(initializeAllCharts, 500);
});