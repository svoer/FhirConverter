const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const express = require('express');
const cors = require('cors');
const http = require('http');
const app = express();
const port = 5000;
const javaAppPort = 8080;

// État de l'application
const appState = {
  javaAppStarted: false,
  javaAppRunning: false,
  javaPath: null,
  startTime: new Date(),
  errors: []
};

// Activer CORS
app.use(cors());
app.use(express.json());

// Middleware pour servir les fichiers statiques du frontend si disponible
app.use(express.static(path.join(__dirname, 'frontend')));

// Fonction pour vérifier si le serveur Java est en cours d'exécution
function checkJavaAppStatus() {
  return new Promise((resolve) => {
    if (!appState.javaAppStarted) {
      return resolve(false);
    }
    
    const req = http.request({
      host: 'localhost',
      port: javaAppPort,
      path: '/api/status',
      method: 'GET',
      timeout: 1000
    }, (res) => {
      if (res.statusCode === 200) {
        appState.javaAppRunning = true;
        resolve(true);
      } else {
        resolve(false);
      }
    });
    
    req.on('error', () => {
      resolve(false);
    });
    
    req.end();
  });
}

// API pour vérifier que le serveur fonctionne
app.get('/api/status', async (req, res) => {
  const javaStatus = await checkJavaAppStatus();
  
  res.json({ 
    status: 'ok', 
    message: 'FHIRHub API server is running',
    javaApp: {
      started: appState.javaAppStarted,
      running: javaStatus,
      startTime: appState.startTime,
      uptime: Math.floor((new Date() - appState.startTime) / 1000) + ' seconds'
    },
    errors: appState.errors
  });
});

// Middleware pour rediriger les requêtes API vers le serveur Java
app.use('/api', async (req, res, next) => {
  // Si la route est /api/status, ne pas rediriger
  if (req.path === '/status') {
    return next();
  }
  
  const javaStatus = await checkJavaAppStatus();
  
  if (!javaStatus) {
    return res.status(503).json({
      status: 'error',
      message: 'Le serveur Java n\'est pas encore disponible. Veuillez réessayer dans quelques instants.',
      javaApp: {
        started: appState.javaAppStarted,
        running: false
      }
    });
  }
  
  // Préparer les options pour la requête proxy
  const options = {
    host: 'localhost',
    port: javaAppPort,
    path: req.url,
    method: req.method,
    headers: {
      ...req.headers,
      host: `localhost:${javaAppPort}`
    }
  };
  
  // Créer la requête proxy
  const proxyReq = http.request(options, (proxyRes) => {
    res.status(proxyRes.statusCode);
    
    // Copier les en-têtes de la réponse
    Object.keys(proxyRes.headers).forEach(key => {
      res.setHeader(key, proxyRes.headers[key]);
    });
    
    // Rediriger le flux de données
    proxyRes.pipe(res);
  });
  
  // Gérer les erreurs
  proxyReq.on('error', (error) => {
    console.error('Erreur de proxy vers le serveur Java:', error);
    res.status(500).json({
      status: 'error',
      message: 'Erreur lors de la communication avec le serveur Java'
    });
  });
  
  // Si la requête a un corps, le transmettre
  if (req.body) {
    proxyReq.write(JSON.stringify(req.body));
  }
  
  proxyReq.end();
});

// Route par défaut qui renvoie un message HTML simple
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>FHIRHub - HL7 vers FHIR Converter</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; margin: 0; padding: 20px; color: #333; }
          .container { max-width: 800px; margin: 0 auto; }
          h1 { color: #2c3e50; border-bottom: 1px solid #eee; padding-bottom: 10px; }
          .info { background: #f8f9fa; border-left: 4px solid #4CAF50; padding: 15px; margin: 20px 0; }
          .status { margin-top: 30px; }
          .status div { margin-bottom: 10px; }
          .status span { font-weight: bold; }
          .badge { display: inline-block; padding: 3px 7px; border-radius: 10px; font-size: 12px; font-weight: bold; }
          .success { background-color: #d4edda; color: #155724; }
          .pending { background-color: #fff3cd; color: #856404; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>FHIRHub - Convertisseur HL7 vers FHIR</h1>
          
          <div class="info">
            Cette application permet de convertir des messages HL7 v2.5 vers le format FHIR R4 conforme aux standards de l'ANS. Utilisez l'API ou l'interface pour convertir vos messages HL7.
          </div>
          
          <div class="status">
            <h2>État des services</h2>
            <div>Serveur proxy: <span class="badge success">Actif</span></div>
            <div>Application Java: <span class="badge pending">Démarrage...</span></div>
            <div>Frontend React: <span class="badge pending">En développement</span></div>
          </div>
          
          <p>Le serveur FHIRHub est en cours de démarrage. Veuillez patienter...</p>
        </div>
      </body>
    </html>
  `);
});

// Démarrer le serveur Express
app.listen(port, '0.0.0.0', () => {
  console.log(`Serveur proxy démarré sur le port ${port}`);
  
  // Lancer le processus Java en arrière-plan
  console.log('Recherche de Java...');
  
  // Premièrement, compiler le projet Java s'il n'est pas déjà compilé
  if (!fs.existsSync(path.join(__dirname, 'target', 'fhirhub-1.0.0.jar'))) {
    console.log('Compilation du projet Java...');
    exec('mvn clean package -DskipTests', (error, stdout, stderr) => {
      if (error) {
        console.error(`Erreur de compilation: ${error}`);
        return;
      }
      console.log('Compilation réussie!');
      startJavaApp();
    });
  } else {
    startJavaApp();
  }
});

function startJavaApp() {
  // Chercher le chemin Java
  exec('find /nix/store -type f -executable -name java | grep -v wrapper | head -1', (error, stdout, stderr) => {
    if (error || !stdout.trim()) {
      console.error('Java est introuvable!');
      appState.errors.push({
        time: new Date(),
        message: 'Java est introuvable dans le système'
      });
      return;
    }
    
    const javaPath = stdout.trim();
    appState.javaPath = javaPath;
    console.log(`Java trouvé à: ${javaPath}`);
    
    // Créer les répertoires nécessaires
    try {
      fs.mkdirSync('./data/in', { recursive: true });
      fs.mkdirSync('./data/out', { recursive: true });
    } catch (err) {
      console.error('Erreur lors de la création des répertoires:', err);
      appState.errors.push({
        time: new Date(),
        message: `Erreur lors de la création des répertoires: ${err.message}`
      });
    }
    
    // Lancer l'application Java sur un port différent (8080)
    console.log(`Démarrage de l'application Java sur le port ${javaAppPort}...`);
    
    try {
      const javaProcess = exec(
        `${javaPath} -Dserver.port=${javaAppPort} -Dserver.address=0.0.0.0 -jar target/fhirhub-1.0.0.jar`, 
        (error, stdout, stderr) => {
          if (error) {
            console.error(`Erreur au démarrage de l'application Java: ${error}`);
            appState.errors.push({
              time: new Date(),
              message: `Erreur au démarrage de l'application Java: ${error.message}`
            });
          }
      });
      
      // Marquer l'application comme démarrée
      appState.javaAppStarted = true;
      
      // Monitorer la sortie standard
      javaProcess.stdout.on('data', (data) => {
        console.log(`Java stdout: ${data}`);
        
        // Détecter le démarrage complet de Spring Boot
        if (data.toString().includes('Started FhirHubApplication')) {
          appState.javaAppRunning = true;
          console.log('Application Java prête à recevoir des requêtes!');
        }
      });
      
      // Monitorer la sortie d'erreur
      javaProcess.stderr.on('data', (data) => {
        console.error(`Java stderr: ${data}`);
        
        // Enregistrer les erreurs importantes
        const errorMsg = data.toString();
        if (errorMsg.includes('Error') || errorMsg.includes('Exception')) {
          appState.errors.push({
            time: new Date(),
            message: errorMsg.trim()
          });
        }
      });
      
      // Gérer la fin du processus
      javaProcess.on('close', (code) => {
        appState.javaAppRunning = false;
        appState.javaAppStarted = false;
        
        console.log(`Le processus Java s'est arrêté avec le code: ${code}`);
        if (code !== 0) {
          appState.errors.push({
            time: new Date(),
            message: `L'application Java s'est arrêtée anormalement avec le code: ${code}`
          });
        }
      });
      
      console.log('Application Java démarrée!');
    } catch (err) {
      console.error('Erreur lors du lancement du processus Java:', err);
      appState.errors.push({
        time: new Date(),
        message: `Erreur lors du lancement du processus Java: ${err.message}`
      });
    }
  });
}