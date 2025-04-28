"use strict";
/**
 * Point d'entrée principal pour l'application FHIRHub
 * Convertisseur HL7 v2.5 vers FHIR R4
 * Compatible avec les terminologies françaises
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const morgan_1 = __importDefault(require("morgan"));
const body_parser_1 = __importDefault(require("body-parser"));
const path_1 = __importDefault(require("path"));
const dotenv = __importStar(require("dotenv"));
const swagger_jsdoc_1 = __importDefault(require("swagger-jsdoc"));
const swagger_ui_express_1 = __importDefault(require("swagger-ui-express"));
// Routes
const convertRoutes_1 = __importDefault(require("./api/routes/convertRoutes"));
const apiKeyRoutes_1 = __importDefault(require("./api/routes/apiKeyRoutes"));
const applicationRoutes_1 = __importDefault(require("./api/routes/applicationRoutes"));
// Services
const database_1 = require("./api/db/database");
// Charger les variables d'environnement
dotenv.config();
const app = (0, express_1.default)();
const port = process.env.PORT || 3000;
// Middlewares
app.use((0, cors_1.default)());
app.use(body_parser_1.default.json());
app.use(body_parser_1.default.urlencoded({ extended: true }));
app.use((0, morgan_1.default)('dev'));
// Servir les fichiers statiques
app.use(express_1.default.static(path_1.default.join(__dirname, '../frontend/public')));
// Options de documentation Swagger
const swaggerOptions = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'API FHIRHub',
            version: '1.0.0',
            description: 'API de conversion HL7 v2.5 vers FHIR R4',
            contact: {
                name: 'Support FHIRHub',
                email: 'support@fhirhub.fr'
            }
        },
        servers: [
            {
                url: '/api/v1',
                description: 'Serveur principal'
            }
        ],
        components: {
            securitySchemes: {
                ApiKeyAuth: {
                    type: 'apiKey',
                    in: 'header',
                    name: 'X-API-KEY'
                }
            }
        },
        security: [
            {
                ApiKeyAuth: []
            }
        ]
    },
    apis: ['./src/api/routes/*.ts']
};
const swaggerSpec = (0, swagger_jsdoc_1.default)(swaggerOptions);
// Routes API
app.use('/api/v1/convert', convertRoutes_1.default);
app.use('/api/v1/apikeys', apiKeyRoutes_1.default);
app.use('/api/v1/applications', applicationRoutes_1.default);
// Documentation Swagger
app.use('/api-docs', swagger_ui_express_1.default.serve, swagger_ui_express_1.default.setup(swaggerSpec));
// Route par défaut pour l'interface utilisateur
app.get('/', (req, res) => {
    res.sendFile(path_1.default.join(__dirname, '../frontend/public/login.html'));
});
// Routes temporaires pour la migration
app.get('/api/stats', (req, res) => {
    res.json({
        success: true,
        data: {
            totalConversions: 0,
            successRate: 100,
            averageProcessingTime: 0
        }
    });
});
app.get('/api/conversions', (req, res) => {
    res.json({
        success: true,
        data: []
    });
});
app.get('/api/health', (req, res) => {
    res.json({
        success: true,
        message: 'FHIRHub fonctionne correctement',
        version: '1.0.0'
    });
});
// Gestionnaire d'erreurs 404
app.use((req, res) => {
    res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'La ressource demandée n\'existe pas'
    });
});
// Initialisation et démarrage du serveur
async function startServer() {
    // Initialiser la base de données
    (0, database_1.initDatabase)();
    // Démarrer le serveur
    app.listen(port, () => {
        console.log(`[SERVER] FHIRHub démarré sur le port ${port}`);
        console.log(`[SERVER] Documentation API disponible sur http://localhost:${port}/api-docs`);
    });
}
// Démarrer l'application
startServer().catch(error => {
    console.error('[SERVER] Erreur lors du démarrage:', error);
    process.exit(1);
});
