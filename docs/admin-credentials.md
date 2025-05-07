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

Si vous avez besoin de réinitialiser les mots de passe administrateur :

1. Pour FHIRHub, utilisez le script de réinitialisation de mot de passe :
   ```bash
   node reset-password-pbkdf2.js admin admin123
   ```

2. Pour Grafana, vous pouvez :
   - Modifier le fichier `docker-compose.yml` pour définir `GF_SECURITY_ADMIN_PASSWORD=admin123`
   - Ou utiliser l'API Grafana pour réinitialiser le mot de passe

## Recommandations de sécurité

Pour les environnements de production :

1. Changez les mots de passe par défaut après l'installation
2. Utilisez des mots de passe complexes et uniques pour chaque interface
3. Activez l'authentification à deux facteurs lorsque disponible
4. Limitez l'accès aux interfaces administratives par IP ou VPN