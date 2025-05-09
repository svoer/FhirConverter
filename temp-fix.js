// Fonction améliorée pour la mise à jour du graphique de distribution des ressources FHIR
function updateResourceDistChart(conversionStats, conversions) {
  if (!charts.resourceDist) {
    console.warn('Graphique resourceDist non initialisé');
    return;
  }
  
  // Détruire l'ancien graphique pour le recréer avec un message ou des données réelles
  charts.resourceDist.destroy();
  
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
      // Même avec resourcesDistribution présent, toutes les valeurs sont à 0
      // Basculer vers l'option de secours avec la moyenne
      createBackupResourceChart();
    }
  } else if (conversionStats && typeof conversionStats.avgResources !== 'undefined' && conversions > 0) {
    // Utiliser les statistiques disponibles lorsque les détails par catégorie ne sont pas disponibles
    createBackupResourceChart();
  } else {
    // Aucune donnée exploitable disponible
    createNoDataResourceChart();
  }
  
  // Fonction auxiliaire pour créer un graphique basé sur les ressources moyennes
  function createBackupResourceChart() {
    console.log("Données de distribution détaillée non disponibles, création d'un graphique informatif avec ressources moyennes");
    
    // Pour éviter de créer des données fictives, nous allons simplement indiquer la moyenne
    charts.resourceDist = new Chart(ctx, {
      type: 'pie',
      data: {
        labels: [`Moyenne de ${conversionStats.avgResources} ressource(s) par conversion`],
        datasets: [{
          label: 'Information',
          data: [conversions], // Utiliser le nombre total de conversions comme donnée
          backgroundColor: ['rgba(243, 156, 18, 0.7)'],
          borderColor: ['rgba(243, 156, 18, 1)'],
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
              label: function() {
                return `${conversions} conversion(s) avec une moyenne de ${conversionStats.avgResources} ressource(s)`;
              }
            }
          }
        }
      }
    });
  }
  
  // Fonction auxiliaire pour créer un graphique "aucune donnée"
  function createNoDataResourceChart() {
    console.log("Aucune donnée de distribution disponible, affichage d'un message informatif");
    
    // Créer un nouveau graphique avec un message d'information
    charts.resourceDist = new Chart(ctx, {
      type: 'pie',
      data: {
        labels: ['Aucune donnée disponible'],
        datasets: [{
          label: 'Information',
          data: [1],
          backgroundColor: ['rgba(200, 200, 200, 0.7)'],
          borderColor: ['rgba(200, 200, 200, 1)'],
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
              label: function() {
                return 'Aucune donnée de distribution disponible';
              }
            }
          },
          title: {
            display: true,
            text: 'Statistiques détaillées non disponibles',
            font: {
              size: 14
            },
            color: '#666'
          }
        }
      }
    });
  }
}