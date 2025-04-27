/**
 * Service d'authentification pour FHIRHub
 * Gère l'inscription, la connexion et l'authentification des utilisateurs administrateurs
 */

const { db } = require('../db');
const { users } = require('../db/schema');
const { eq } = require('drizzle-orm');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

// Configuration
const JWT_SECRET = process.env.JWT_SECRET || 'fhirhub-secret-key-development-only';
const SALT_ROUNDS = 10;
const TOKEN_EXPIRY = '1d'; // 1 jour

/**
 * Créer un nouvel utilisateur administrateur
 * @param {Object} userData - Données de l'utilisateur
 * @returns {Promise<Object>} Utilisateur créé (sans mot de passe)
 */
async function createUser(userData) {
  const { username, password, email, fullName, role = 'user' } = userData;
  
  // Vérifier si l'utilisateur existe déjà
  const existingUser = await getUserByUsername(username);
  if (existingUser) {
    throw new Error('Un utilisateur avec ce nom existe déjà');
  }
  
  // Hasher le mot de passe
  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  
  // Insérer l'utilisateur dans la base de données
  const [user] = await db.insert(users)
    .values({
      username,
      passwordHash,
      email,
      fullName,
      role,
      active: true,
      createdAt: new Date()
    })
    .returning({
      id: users.id,
      username: users.username,
      email: users.email,
      fullName: users.fullName,
      role: users.role,
      active: users.active,
      createdAt: users.createdAt
    });
  
  return user;
}

/**
 * Récupérer un utilisateur par son nom d'utilisateur
 * @param {string} username - Nom d'utilisateur
 * @returns {Promise<Object|null>} Utilisateur trouvé ou null
 */
async function getUserByUsername(username) {
  const [user] = await db.select()
    .from(users)
    .where(eq(users.username, username));
  
  return user || null;
}

/**
 * Récupérer un utilisateur par son ID
 * @param {number} id - ID de l'utilisateur
 * @returns {Promise<Object|null>} Utilisateur trouvé ou null (sans mot de passe)
 */
async function getUserById(id) {
  const [user] = await db.select({
    id: users.id,
    username: users.username,
    email: users.email,
    fullName: users.fullName,
    role: users.role,
    active: users.active,
    createdAt: users.createdAt,
    lastLoginAt: users.lastLoginAt
  })
  .from(users)
  .where(eq(users.id, id));
  
  return user || null;
}

/**
 * Authentifier un utilisateur avec son nom d'utilisateur et mot de passe
 * @param {string} username - Nom d'utilisateur
 * @param {string} password - Mot de passe en clair
 * @returns {Promise<Object|null>} Informations de l'utilisateur et token JWT si l'authentification réussit, sinon null
 */
async function authenticateUser(username, password) {
  // Récupérer l'utilisateur
  const user = await getUserByUsername(username);
  if (!user || !user.active) return null;
  
  // Vérifier le mot de passe
  const passwordMatch = await bcrypt.compare(password, user.passwordHash);
  if (!passwordMatch) return null;
  
  // Mettre à jour la date de dernière connexion
  await db.update(users)
    .set({ lastLoginAt: new Date() })
    .where(eq(users.id, user.id));
  
  // Générer un token JWT
  const token = generateToken(user);
  
  // Retourner les informations utilisateur sans le hash du mot de passe
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    fullName: user.fullName,
    role: user.role,
    token
  };
}

/**
 * Générer un token JWT pour un utilisateur
 * @param {Object} user - Utilisateur pour lequel générer le token
 * @returns {string} Token JWT
 */
function generateToken(user) {
  const payload = {
    sub: user.id,
    username: user.username,
    role: user.role
  };
  
  return jwt.sign(payload, JWT_SECRET, { expiresIn: TOKEN_EXPIRY });
}

/**
 * Vérifier et décoder un token JWT
 * @param {string} token - Token JWT à vérifier
 * @returns {Object|null} Payload décodé si valide, sinon null
 */
function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
}

/**
 * Mettre à jour un utilisateur
 * @param {number} id - ID de l'utilisateur
 * @param {Object} userData - Données à mettre à jour
 * @returns {Promise<Object|null>} Utilisateur mis à jour ou null
 */
async function updateUser(id, userData) {
  const { email, fullName, role, active, password } = userData;
  
  // Préparer les données de mise à jour
  const updateData = {
    ...(email !== undefined && { email }),
    ...(fullName !== undefined && { fullName }),
    ...(role !== undefined && { role }),
    ...(active !== undefined && { active })
  };
  
  // Mettre à jour le mot de passe si fourni
  if (password) {
    updateData.passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  }
  
  // Effectuer la mise à jour
  const [user] = await db.update(users)
    .set(updateData)
    .where(eq(users.id, id))
    .returning({
      id: users.id,
      username: users.username,
      email: users.email,
      fullName: users.fullName,
      role: users.role,
      active: users.active
    });
  
  return user || null;
}

/**
 * Supprimer un utilisateur
 * @param {number} id - ID de l'utilisateur
 * @returns {Promise<boolean>} True si supprimé avec succès
 */
async function deleteUser(id) {
  const result = await db.delete(users)
    .where(eq(users.id, id));
  
  return result.count > 0;
}

/**
 * Récupérer tous les utilisateurs
 * @returns {Promise<Array>} Liste des utilisateurs (sans mots de passe)
 */
async function getAllUsers() {
  return await db.select({
    id: users.id,
    username: users.username,
    email: users.email,
    fullName: users.fullName,
    role: users.role,
    active: users.active,
    createdAt: users.createdAt,
    lastLoginAt: users.lastLoginAt
  })
  .from(users)
  .orderBy(users.username);
}

/**
 * Créer un utilisateur administrateur par défaut si aucun n'existe
 * @returns {Promise<boolean>} True si créé, false si existait déjà
 */
async function createDefaultAdminIfNeeded() {
  // Vérifier si un administrateur existe déjà
  const existingAdmins = await db.select({ count: sql`count(*)` })
    .from(users)
    .where(eq(users.role, 'admin'));
  
  if (existingAdmins[0]?.count > 0) {
    return false; // Un administrateur existe déjà
  }
  
  // Créer l'administrateur par défaut
  const defaultAdmin = {
    username: 'admin',
    password: 'FhirHub2025!', // Ce mot de passe devrait être changé immédiatement
    email: 'admin@fhirhub.local',
    fullName: 'Administrateur FHIRHub',
    role: 'admin'
  };
  
  await createUser(defaultAdmin);
  console.log('[AUTH] Administrateur par défaut créé. Veuillez changer le mot de passe.');
  return true;
}

module.exports = {
  createUser,
  getUserByUsername,
  getUserById,
  authenticateUser,
  verifyToken,
  updateUser,
  deleteUser,
  getAllUsers,
  createDefaultAdminIfNeeded
};