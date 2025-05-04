const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const crypto = require('crypto');
const bcrypt = require('bcrypt');

// Configuration
const dbPath = path.join(__dirname, 'data', 'fhirhub.db');
const username = 'admin';
const newPassword = 'admin123';
const saltRounds = 10;

// Connexion à la base de données
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error(`Erreur de connexion à la base de données: ${err.message}`);
    process.exit(1);
  }
  console.log('Connecté à la base de données SQLite.');
});

// Hachage du mot de passe
bcrypt.hash(newPassword, saltRounds, (err, hash) => {
  if (err) {
    console.error(`Erreur lors du hachage du mot de passe: ${err.message}`);
    db.close();
    process.exit(1);
  }

  // Mise à jour du mot de passe
  const sql = `UPDATE users SET password = ? WHERE username = ?`;
  db.run(sql, [hash, username], function(err) {
    if (err) {
      console.error(`Erreur lors de la mise à jour du mot de passe: ${err.message}`);
    } else if (this.changes === 0) {
      console.error(`Aucun utilisateur trouvé avec le nom d'utilisateur: ${username}`);
    } else {
      console.log(`Le mot de passe de l'utilisateur ${username} a été réinitialisé avec succès.`);
      console.log(`Nouveau mot de passe: ${newPassword}`);
    }
    
    // Fermeture de la connexion
    db.close();
  });
});