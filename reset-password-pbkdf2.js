const crypto = require('crypto');
const sqlite3 = require('better-sqlite3');
const path = require('path');

// Configuration
const dbPath = path.join(__dirname, 'data', 'fhirhub.db');
const username = 'admin';
const newPassword = 'admin123';

// Générer un salt aléatoire
const salt = crypto.randomBytes(16).toString('hex');

// Dériver la clé à partir du mot de passe et du sel
const hash = crypto.pbkdf2Sync(newPassword, salt, 10000, 64, 'sha512').toString('hex');

// Combiner le sel et le hash pour le stockage
const passwordToStore = `${salt}:${hash}`;

console.log(`Nouveau mot de passe formaté: ${passwordToStore}`);

try {
    // Connexion à la base de données
    const db = new sqlite3(dbPath);
    
    // Mise à jour du mot de passe
    const stmt = db.prepare('UPDATE users SET password = ? WHERE username = ?');
    const result = stmt.run(passwordToStore, username);
    
    if (result.changes === 0) {
        console.error(`Aucun utilisateur trouvé avec le nom d'utilisateur: ${username}`);
    } else {
        console.log(`Le mot de passe de l'utilisateur ${username} a été réinitialisé avec succès.`);
        console.log(`Utilisez ces identifiants pour vous connecter:`);
        console.log(`Nom d'utilisateur: ${username}`);
        console.log(`Mot de passe: ${newPassword}`);
    }
    
    // Fermer la connexion
    db.close();
} catch (error) {
    console.error(`Erreur lors de la mise à jour du mot de passe:`, error);
}