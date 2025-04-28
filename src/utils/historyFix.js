/**
 * Module de correction pour l'historique des conversions
 * Ce module nettoie l'historique des conversions pour éviter les rémanences
 * et restaure le fonctionnement correct de l'interface d'historique
 */

const { db } = require('../db/schema');

/**
 * Nettoyer les entrées d'historique corrompues ou incomplètes
 * @returns {number} Nombre d'entrées nettoyées
 */
function cleanupCorruptedHistory() {
  try {
    // Supprimer les entrées d'historique qui n'ont pas toutes les informations nécessaires
    const result = db.prepare(`
      DELETE FROM conversions
      WHERE source_name IS NULL 
         OR status IS NULL
         OR conversion_id IS NULL
    `).run();
    
    console.log(`Nettoyage de l'historique: ${result.changes} entrée(s) corrompue(s) supprimée(s)`);
    return result.changes;
  } catch (error) {
    console.error('Erreur lors du nettoyage de l\'historique corrompu:', error);
    return 0;
  }
}

/**
 * Régénérer les statistiques de conversion à partir de l'historique
 * @returns {boolean} Succès de la régénération
 */
function regenerateConversionStats() {
  try {
    // Supprimer toutes les statistiques existantes
    db.prepare('DELETE FROM app_stats').run();
    
    // Récupérer tous les IDs d'application distincts
    const apps = db.prepare('SELECT DISTINCT app_id FROM conversions WHERE app_id IS NOT NULL').all();
    
    // Pour chaque application, recalculer les statistiques
    apps.forEach(app => {
      // Obtenir la date du jour au format YYYY-MM-DD
      const today = new Date().toISOString().split('T')[0];
      
      // Calculer les statistiques pour cette application
      const stats = db.prepare(`
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as success_count,
          SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) as error_count,
          SUM(resource_count) as resource_count
        FROM conversions
        WHERE app_id = ?
      `).get(app.app_id);
      
      // Insérer les nouvelles statistiques
      db.prepare(`
        INSERT INTO app_stats (
          app_id, date, conversion_count, 
          success_count, error_count, resource_count
        )
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        app.app_id,
        today,
        stats.total || 0,
        stats.success_count || 0,
        stats.error_count || 0,
        stats.resource_count || 0
      );
    });
    
    console.log(`Statistiques régénérées pour ${apps.length} application(s)`);
    return true;
  } catch (error) {
    console.error('Erreur lors de la régénération des statistiques:', error);
    return false;
  }
}

/**
 * Réinitialiser complètement l'historique des conversions
 * @returns {boolean} Succès de la réinitialisation
 */
function resetConversionHistory() {
  try {
    // Supprimer toutes les conversions
    db.prepare('DELETE FROM conversions').run();
    
    // Supprimer toutes les statistiques
    db.prepare('DELETE FROM app_stats').run();
    
    console.log('Historique des conversions réinitialisé avec succès');
    return true;
  } catch (error) {
    console.error('Erreur lors de la réinitialisation de l\'historique:', error);
    return false;
  }
}

/**
 * Appliquer toutes les corrections à l'historique
 */
function applyHistoryFixes() {
  try {
    const cleanedEntries = cleanupCorruptedHistory();
    const statsRegenerated = regenerateConversionStats();
    
    console.log(`Corrections appliquées à l'historique:
      - ${cleanedEntries} entrées corrompues supprimées
      - Statistiques régénérées: ${statsRegenerated ? 'Oui' : 'Non'}
    `);
    
    return { cleanedEntries, statsRegenerated };
  } catch (error) {
    console.error('Erreur lors de l\'application des corrections à l\'historique:', error);
    return { cleanedEntries: 0, statsRegenerated: false, error: error.message };
  }
}

module.exports = {
  cleanupCorruptedHistory,
  regenerateConversionStats,
  resetConversionHistory,
  applyHistoryFixes
};