# Identifiants Administrateur FHIRHub

Ce document décrit les identifiants standardisés pour l'accès aux différentes interfaces administratives de FHIRHub.

## Standardisation des mots de passe

Pour simplifier l'accès et la maintenance, nous avons standardisé les mots de passe administrateur dans tout l'environnement FHIRHub.

### Application FHIRHub
- **Utilisateur**: `admin`
- **Mot de passe**: `admin123`

### Grafana (Tableau de bord de monitoring)
- **Utilisateur**: `admin`
- **Mot de passe**: `admin123`

### Prometheus (Métriques)
- Pas d'authentification configurée par défaut
- Accès sécurisé par le réseau Docker interne

## Résolution des erreurs 403 Forbidden

Si vous rencontrez des erreurs 403 Forbidden lors de l'accès à Grafana ou Prometheus, suivez ces étapes :

1. Exécutez le script de correction des permissions :
   ```bash
   sudo ./fix-grafana-permissions.sh
   ```

2. Vérifiez que les répertoires et fichiers ont les bonnes permissions :
   ```bash
   ls -la volumes/grafana/
   ls -la volumes/prometheus/
   ```

3. Redémarrez les conteneurs Docker :
   ```bash
   ./docker-safe-restart.sh
   ```

## Réinitialisation des mots de passe

Si vous avez besoin de réinitialiser les mots de passe administrateur, vous disposez de plusieurs options :

### Option 1: Réinitialisation automatique de tous les mots de passe (recommandé)

Utilisez le script de réinitialisation automatique pour mettre à jour tous les mots de passe administrateur en une seule opération :

```bash
# Réinitialiser avec le mot de passe par défaut (admin123)
./reset-all-admin-passwords.sh

# Spécifier un mot de passe personnalisé
./reset-all-admin-passwords.sh mon_nouveau_mot_de_passe

# Spécifier un mot de passe et un nom d'utilisateur
./reset-all-admin-passwords.sh mon_nouveau_mot_de_passe mon_utilisateur
```

Ce script va automatiquement :
- Mettre à jour le mot de passe dans la base de données
- Modifier le fichier `.env`
- Mettre à jour `docker-compose.yml` pour Grafana
- Fournir des instructions pour redémarrer les services Docker

### Option 2: Réinitialisation individuelle des mots de passe

1. Pour FHIRHub uniquement, utilisez le script de réinitialisation amélioré :
   ```bash
   # Format : node reset-password-pbkdf2.js [username] [nouveau_mot_de_passe]
   # Exemple pour réinitialiser le compte admin :
   node reset-password-pbkdf2.js admin admin123
   
   # Pour lister les utilisateurs existants (le script les affichera si l'utilisateur n'existe pas)
   node reset-password-pbkdf2.js non_existant
   ```

2. Pour Grafana uniquement, vous pouvez :
   - Modifier le fichier `docker-compose.yml` pour définir `GF_SECURITY_ADMIN_PASSWORD=admin123`
   - Redémarrer les conteneurs : `docker-compose restart`

## Recommandations de sécurité

Pour les environnements de production :

1. Changez les mots de passe par défaut après l'installation
2. Utilisez des mots de passe complexes et uniques pour chaque interface
3. Activez l'authentification à deux facteurs lorsque disponible
4. Limitez l'accès aux interfaces administratives par IP ou VPN