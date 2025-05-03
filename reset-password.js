const crypto = require('crypto');
const sqlite3 = require('better-sqlite3');

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

// Connexion à la base de données
const db = new sqlite3('data/fhirhub.db');

// Hachage du mot de passe "admin"
const hashedPassword = hashPassword('admin');

console.log('Nouveau mot de passe haché:', hashedPassword);

// Mise à jour du mot de passe admin
const result = db.prepare('UPDATE users SET password = ? WHERE username = ?').run(hashedPassword, 'admin');
console.log('Mise à jour effectuée:', result.changes, 'utilisateur(s) modifié(s)');

// Fermeture de la connexion
db.close();