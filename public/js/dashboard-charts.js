/**
 * dashboard-charts.js
 * Script dédié à l'initialisation et à la mise à jour des graphiques du tableau de bord
 * Cette approche distincte permet d'isoler complètement la gestion des graphiques
 */

// Configuration globale des couleurs pour maintenir le dégradé rouge-orange
const chartColors = {
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
    background: 'rgba(241, 136, 5, 0.2)',
    border: '#f18805'
  },
  conversion: {
    background: 'rgba(231, 76, 60, 0.2)',
    border: '#e74c3c'
  }
};

// Stockage des références aux instances de graphiques
let charts = {
  resourceDist: null,
  successRate: null,
  messageTypes: null,
  memoryUsage: null,
  conversionTrend: null
};

// Initialisation de tous les graphiques au chargement de la page
document.addEventListener('DOMContentLoaded', function() {
  console.log('Initialisation des graphiques du tableau de bord...');
  
  // Initialiser les graphiques statiques (mémoire, tendance de conversion)
  initMemoryChart();
  initConversionTrendChart();
  
  // Préparer les graphiques dynamiques avec des données minimales
  initResourceDistChart();
  initSuccessRateChart();
  initMessageTypesChart();
  
  // Configurer les mises à jour planifiées
  console.log('Configuration des mises à jour périodiques des graphiques...');
});

// Fonction pour mettre à jour tous les graphiques dynamiques avec les données actuelles
function updateAllCharts(statsData) {
  if (!statsData) {
    console.warn('Données de statistiques non disponibles pour la mise à jour des graphiques');
    return;
  }
  
  console.log('Mise à jour de tous les graphiques avec les données fraîches:', statsData);
  
  const conversionStats = statsData.conversionStats || {};
  const conversions = statsData.conversions || 0;
  
  // Mettre à jour chaque graphique individuellement
  updateResourceDistChart(conversionStats, conversions);
  updateSuccessRateChart(conversionStats, conversions);
  updateMessageTypesChart(conversionStats, conversions);
  updateConversionTrendChart(conversionStats.lastTime || 250);
  
  // Mettre à jour les indicateurs de dernière mise à jour
  updateTimestamps();
}

// Mise à jour des horodatages
function updateTimestamps() {
  const now = new Date();
  const timeStr = now.toLocaleTimeString();
  
  const lastUpdateElement = document.getElementById('lastUpdateTime');
  if (lastUpdateElement) {
    lastUpdateElement.textContent = timeStr;
  }
  
  const statsUpdateElement = document.getElementById('statsUpdateTime');
  if (statsUpdateElement) {
    statsUpdateElement.textContent = timeStr;
  }
}

// Initialisation et gestion du graphique de distribution des ressources FHIR
function initResourceDistChart() {
  const ctx = document.getElementById('resourceDistChart');
  if (!ctx) {
    console.error('Canvas resourceDistChart non trouvé');
    return;
  }
  
  // Données initiales minimales
  const initialData = {
    labels: ['1 ressource', '2 ressources', '3 ressources', '4-5 ressources', '6+ ressources'],
    datasets: [{
      label: 'Nombre de conversions',
      data: [1, 1, 5, 1, 1],
      backgroundColor: chartColors.redGradient,
      borderColor: chartColors.redGradientBorders,
      borderWidth: 1
    }]
  };
  
  // Options du graphique
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
            return `${context.label}: ${context.raw} conversion(s)`;
          }
        }
      }
    }
  };
  
  // Création du graphique
  charts.resourceDist = new Chart(ctx, {
    type: 'pie',
    data: initialData,
    options: options
  });
}

// Fonction améliorée pour la mise à jour du graphique de distribution des ressources FHIR
function updateResourceDistChart(conversionStats, conversions) {
  if (!charts.resourceDist) {
    console.warn('Graphique resourceDist non initialisé');
    return;
  }
  
  // Détruire l'ancien graphique
  charts.resourceDist.destroy();
  
  // Éléments DOM
  const chartContainer = document.getElementById('resourceDistChartContainer');
  const noDataMessage = document.getElementById('resourceDistNoData');
  const ctx = document.getElementById('resourceDistChart');
  
  // Si les statistiques réelles de distribution sont disponibles
  if (conversionStats && conversionStats.resourcesDistribution) {
    console.log("Utilisation des données réelles de distribution des ressources:", conversionStats.resourcesDistribution);
    const distributionData = [
      conversionStats.resourcesDistribution.single || 0,
      conversionStats.resourcesDistribution.two || 0,
      conversionStats.resourcesDistribution.three || 0,
      conversionStats.resourcesDistribution.fourToFive || 0,
      conversionStats.resourcesDistribution.sixPlus || 0
    ];
    
    // Vérifier si nous avons de vraies données ou seulement des zéros
    const hasRealData = distributionData.some(value => value > 0);
    
    if (hasRealData) {
      // Afficher le container du graphique et masquer le message
      chartContainer.style.display = 'block';
      noDataMessage.style.display = 'none';
      
      // Création d'un nouveau graphique avec données réelles
      charts.resourceDist = new Chart(ctx, {
        type: 'pie',
        data: {
          labels: ['1 ressource', '2 ressources', '3 ressources', '4-5 ressources', '6+ ressources'],
          datasets: [{
            label: 'Nombre de conversions',
            data: distributionData,
            backgroundColor: chartColors.redGradient,
            borderColor: chartColors.redGradientBorders,
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
            },
            tooltip: {
              callbacks: {
                label: function(context) {
                  return `${context.label}: ${context.raw} conversion(s)`;
                }
              }
            }
          }
        }
      });
    } else {
      // Pas de données réelles, afficher le message
      createEmptyChart();
    }
  } else {
    // Pas de données réelles, afficher le message
    createEmptyChart();
  }
  
  // Fonction pour créer un graphique vide et afficher le message
  function createEmptyChart() {
    console.log("Données de distribution détaillée non disponibles, affichage d'un message d'information");
    
    // Masquer le container du graphique et afficher le message
    chartContainer.style.display = 'none';
    noDataMessage.style.display = 'flex';
    
    // Créer un graphique vide (invisible)
    charts.resourceDist = new Chart(ctx, {
      type: 'pie',
      data: {
        labels: [],
        datasets: [{
          label: '',
          data: [],
          backgroundColor: [],
          borderColor: [],
          borderWidth: 0
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
}function initSuccessRateChart() {
  const ctx = document.getElementById('successRateChart');
  if (!ctx) {
    console.error('Canvas successRateChart non trouvé');
    return;
  }
  
  // Données initiales
  const initialData = {
    labels: ['Réussi', 'Erreur'],
    datasets: [{
      label: 'Taux de réussite',
      data: [10, 1],
      backgroundColor: chartColors.successError,
      borderColor: chartColors.successErrorBorders,
      borderWidth: 1
    }]
  };
  
  // Options du graphique
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
  
  // Création du graphique
  charts.successRate = new Chart(ctx, {
    type: 'doughnut',
    data: initialData,
    options: options
  });
}

function updateSuccessRateChart(conversionStats, conversions) {
  if (!charts.successRate) {
    console.warn('Graphique successRate non initialisé');
    return;
  }
  
  // Détruire l'ancien graphique
  charts.successRate.destroy();
  
  // Éléments DOM
  const chartContainer = document.getElementById('successRateChartContainer');
  const noDataMessage = document.getElementById('successRateNoData');
  const ctx = document.getElementById('successRateChart');
  
  // Si les statistiques réelles détaillées sont disponibles
  if (conversionStats && typeof conversionStats.successCount !== 'undefined') {
    const successfulCount = conversionStats.successCount;
    const errorCount = conversionStats.errorCount || 0;
    
    // Afficher le container du graphique et masquer le message
    chartContainer.style.display = 'block';
    noDataMessage.style.display = 'none';
    
    // Créer un nouveau graphique avec les données réelles
    charts.successRate = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ['Réussi', 'Erreur'],
        datasets: [{
          label: 'Taux de réussite',
          data: [successfulCount, errorCount],
          backgroundColor: chartColors.successError,
          borderColor: chartColors.successErrorBorders,
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
      }
    });
    
    console.log("Données réelles taux de réussite:", { successfulCount, errorCount });
  } else {
    // Utiliser le nombre de conversions comme réussies si disponible
    let successfulCount = parseInt(conversions) || 0;
    let errorCount = 0;
    
    // Créer un nouveau graphique avec valeurs par défaut
    if (successfulCount > 0) {
      // Afficher le container du graphique et masquer le message
      chartContainer.style.display = 'block';
      noDataMessage.style.display = 'none';
      
      console.log(`Utilisation du nombre de conversions (${successfulCount}) comme taux de réussite par défaut`);
      charts.successRate = new Chart(ctx, {
        type: 'doughnut',
        data: {
          labels: ['Réussi', 'Erreur'],
          datasets: [{
            label: 'Taux de réussite',
            data: [successfulCount, errorCount],
            backgroundColor: chartColors.successError,
            borderColor: chartColors.successErrorBorders,
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
        }
      });
    } else {
      // S'il n'y a pas de données, afficher un message explicite
      console.log("Aucune donnée de taux de réussite disponible, affichage d'un message");
      
      // Masquer le container du graphique et afficher le message
      chartContainer.style.display = 'none';
      noDataMessage.style.display = 'flex';
      
      // Créer un graphique vide (invisible)
      charts.successRate = new Chart(ctx, {
        type: 'doughnut',
        data: {
          labels: [],
          datasets: [{
            label: '',
            data: [],
            backgroundColor: [],
            borderColor: [],
            borderWidth: 0
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
}

// Initialisation et gestion du graphique des types de messages HL7
function initMessageTypesChart() {
  const ctx = document.getElementById('messageTypesChart');
  if (!ctx) {
    console.error('Canvas messageTypesChart non trouvé');
    return;
  }
  
  // Données initiales
  const initialData = {
    labels: ['ADT', 'ORU', 'ORM', 'MDM', 'Autres'],
    datasets: [{
      label: 'Types de messages',
      data: [15, 6, 5, 2, 1],
      backgroundColor: chartColors.redGradient,
      borderColor: chartColors.redGradientBorders,
      borderWidth: 1
    }]
  };
  
  // Options du graphique
  const options = {
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
        position: 'top',
        labels: {
          font: {
            size: 11
          }
        }
      }
    }
  };
  
  // Création du graphique
  charts.messageTypes = new Chart(ctx, {
    type: 'bar',
    data: initialData,
    options: options
  });
}

function updateMessageTypesChart(conversionStats, conversions) {
  if (!charts.messageTypes) {
    console.warn('Graphique messageTypes non initialisé');
    return;
  }
  
  // Détruire l'ancien graphique pour le recréer avec un message ou des données réelles
  charts.messageTypes.destroy();
  
  const ctx = document.getElementById('messageTypesChart');
  
  // Référence au message 'Aucune donnée disponible'
  const noDataMessage = document.getElementById('noDataMessage');
  
  // Si les statistiques réelles sont disponibles
  if (conversionStats && conversionStats.messageTypesDistribution) {
    console.log("Utilisation des données réelles de distribution des types de messages:", conversionStats.messageTypesDistribution);
    
    // Masquer le message "Aucune donnée disponible"
    if (noDataMessage) noDataMessage.style.display = 'none';
    
    const labels = [];
    const data = [];
    
    // Construire les données réelles
    if (conversionStats.messageTypesDistribution.ADT) {
      labels.push('ADT');
      data.push(conversionStats.messageTypesDistribution.ADT);
    }
    if (conversionStats.messageTypesDistribution.ORU) {
      labels.push('ORU');
      data.push(conversionStats.messageTypesDistribution.ORU);
    }
    if (conversionStats.messageTypesDistribution.ORM) {
      labels.push('ORM');
      data.push(conversionStats.messageTypesDistribution.ORM);
    }
    if (conversionStats.messageTypesDistribution.MDM) {
      labels.push('MDM');
      data.push(conversionStats.messageTypesDistribution.MDM);
    }
    if (conversionStats.messageTypesDistribution.other) {
      labels.push('Autres');
      data.push(conversionStats.messageTypesDistribution.other);
    }
    
    // Création d'un nouveau graphique avec données réelles
    charts.messageTypes = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: 'Types de messages',
          data: data,
          backgroundColor: chartColors.redGradient.slice(0, data.length),
          borderColor: chartColors.redGradientBorders.slice(0, data.length),
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
    // Récupérer les données depuis l'API des types de messages HL7
    fetch('/api/message-types')
      .then(response => response.json())
      .then(messageTypesData => {
        console.log("Données de types de messages HL7 reçues:", messageTypesData);
        
        if (messageTypesData && messageTypesData.length > 0) {
          // Masquer le message "Aucune donnée disponible"
          if (noDataMessage) noDataMessage.style.display = 'none';
          
          const labels = messageTypesData.map(item => item.message_type);
          const data = messageTypesData.map(item => item.count);
          
          // Création du graphique avec les données réelles
          charts.messageTypes = new Chart(ctx, {
            type: 'bar',
            data: {
              labels: labels,
              datasets: [{
                label: 'Types de messages',
                data: data,
                backgroundColor: chartColors.redGradient.slice(0, data.length),
                borderColor: chartColors.redGradientBorders.slice(0, data.length),
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
          
          console.log("Graphique des types de messages HL7 recréé avec les données réelles");
        } else {
          // Afficher le message "Aucune donnée disponible"
          if (noDataMessage) noDataMessage.style.display = 'block';
          
          // Créer un graphique vide (invisible) derrière le message
          charts.messageTypes = new Chart(ctx, {
            type: 'bar',
            data: {
              labels: [],
              datasets: [{
                label: 'Types de messages',
                data: [],
                backgroundColor: [],
                borderColor: [],
                borderWidth: 0
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
                  position: 'top',
                  labels: {
                    font: {
                      size: 11
                    }
                  }
                },
                title: {
                  display: true,
                  text: 'Aucune donnée de type de message disponible',
                  font: {
                    size: 14
                  },
                  color: '#666'
                }
              }
            }
          });
          
          console.warn("Aucune donnée détaillée de types de messages disponible");
        }
      })
      .catch(error => {
        console.error("Erreur lors de la récupération des types de messages:", error);
        
        // Afficher le message "Aucune donnée disponible"
        if (noDataMessage) noDataMessage.style.display = 'block';
        
        // En cas d'erreur, créer un graphique vide (invisible) derrière le message
        charts.messageTypes = new Chart(ctx, {
          type: 'bar',
          data: {
            labels: [],
            datasets: [{
              label: 'Types de messages',
              data: [],
              backgroundColor: [],
              borderColor: [],
              borderWidth: 0
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
                position: 'top',
                labels: {
                  font: {
                    size: 11
                  }
                }
              },
              title: {
                display: true,
                text: 'Erreur lors de la récupération des données',
                font: {
                  size: 14
                },
                color: '#666'
              }
            }
          }
        });
      });
  }
}

// Initialisation et gestion du graphique d'utilisation mémoire
function initMemoryChart() {
  const ctx = document.getElementById('memoryChart');
  if (!ctx) {
    console.error('Canvas memoryChart non trouvé');
    return;
  }
  
  // Étiquettes temporelles
  const timeLabels = ['Il y a 100 sec', 'Il y a 80 sec', 'Il y a 60 sec', 'Il y a 40 sec', 'Il y a 20 sec'];
  
  // Données initiales
  const initialData = {
    labels: timeLabels,
    datasets: [{
      label: 'Utilisation mémoire (MB)',
      data: [15, 16, 15, 17, 16],
      backgroundColor: chartColors.memory.background,
      borderColor: chartColors.memory.border,
      borderWidth: 2,
      fill: true
    }]
  };
  
  // Options du graphique
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      y: {
        beginAtZero: true
      }
    },
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
  };
  
  // Création du graphique
  charts.memoryUsage = new Chart(ctx, {
    type: 'line',
    data: initialData,
    options: options
  });
}

// Initialisation et gestion du graphique de tendance de conversion
function initConversionTrendChart() {
  const ctx = document.getElementById('conversionTrendChart');
  if (!ctx) {
    console.error('Canvas conversionTrendChart non trouvé');
    return;
  }
  
  // Étiquettes temporelles
  const timeLabels = ['Il y a 100 sec', 'Il y a 80 sec', 'Il y a 60 sec', 'Il y a 40 sec', 'Il y a 20 sec'];
  
  // Données initiales
  const initialData = {
    labels: timeLabels,
    datasets: [{
      label: 'Temps de conversion (ms)',
      data: [250, 250, 250, 250, 250],
      backgroundColor: chartColors.conversion.background,
      borderColor: chartColors.conversion.border,
      borderWidth: 2
    }]
  };
  
  // Options du graphique
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      y: {
        beginAtZero: true
      }
    },
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
  };
  
  // Création du graphique
  charts.conversionTrend = new Chart(ctx, {
    type: 'line',
    data: initialData,
    options: options
  });
}

function updateConversionTrendChart(lastTime) {
  if (!charts.conversionTrend) {
    console.warn('Graphique conversionTrend non initialisé');
    return;
  }
  
  // Obtenir les anciennes données sauf la première valeur
  const oldData = charts.conversionTrend.data.datasets[0].data.slice(1);
  
  // Ajouter la nouvelle valeur à la fin
  oldData.push(lastTime || 250);
  
  // Mettre à jour le graphique avec les nouvelles données
  charts.conversionTrend.data.datasets[0].data = oldData;
  
  // Actualisation du graphique
  charts.conversionTrend.update();
}

// Exposer la fonction de mise à jour pour l'appeler depuis dashboard.html
window.updateDashboardCharts = updateAllCharts;