/**
 * Routes pour l'API de suggestions d'aide IA
 * FHIRHub - Système d'aide contextuelle
 */

const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/authCombined');
const aiService = require('../src/services/aiService');

/**
 * @swagger
 * /api/ai/help-suggestion:
 *   post:
 *     summary: Obtenir des suggestions d'aide basées sur le contexte
 *     description: Retourne des suggestions d'aide intelligentes basées sur le contexte actuel de l'utilisateur
 *     security:
 *       - bearerAuth: []
 *       - apiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               context:
 *                 type: string
 *                 description: Identifiant du contexte actuel (ex. workflow_editor, hl7_conversion)
 *               currentUrl:
 *                 type: string
 *                 description: URL actuelle de l'utilisateur
 *               userRole:
 *                 type: string
 *                 description: Rôle de l'utilisateur (ex. admin, user)
 *     responses:
 *       200:
 *         description: Suggestions générées avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 suggestions:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       title:
 *                         type: string
 *                       description:
 *                         type: string
 *                       action:
 *                         type: string
 */
router.post('/help-suggestion', authMiddleware, async (req, res) => {
    try {
        const { context, currentUrl, userRole } = req.body;
        
        // Vérifier si les paramètres sont valides
        if (!context) {
            return res.status(400).json({ 
                success: false, 
                message: 'Le paramètre context est requis'
            });
        }
        
        // Obtenir des suggestions du service d'IA
        // Si le service d'IA n'est pas configuré ou échoue, utiliser des suggestions par défaut
        let suggestions;
        
        try {
            // Essayer d'obtenir des suggestions du service d'IA
            suggestions = await aiService.getContextualHelpSuggestions(context, currentUrl, userRole);
        } catch (error) {
            console.error('[AI Help] Erreur lors de la génération des suggestions:', error);
            
            // Utiliser des suggestions par défaut en cas d'erreur
            suggestions = getDefaultSuggestions(context);
        }
        
        res.json({ 
            success: true, 
            suggestions 
        });
    } catch (error) {
        console.error('[AI Help] Erreur:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Erreur lors de la génération des suggestions'
        });
    }
});

/**
 * @swagger
 * /api/ai/help-suggestion/query:
 *   post:
 *     summary: Répondre à une question utilisateur
 *     description: Utilise l'IA pour répondre à une question spécifique de l'utilisateur
 *     security:
 *       - bearerAuth: []
 *       - apiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               query:
 *                 type: string
 *                 description: Question de l'utilisateur
 *               context:
 *                 type: string
 *                 description: Identifiant du contexte actuel
 *               currentUrl:
 *                 type: string
 *                 description: URL actuelle de l'utilisateur
 *     responses:
 *       200:
 *         description: Réponse générée avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 answer:
 *                   type: string
 *                 relatedSuggestions:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       title:
 *                         type: string
 *                       description:
 *                         type: string
 *                       action:
 *                         type: string
 */
router.post('/help-suggestion/query', authMiddleware, async (req, res) => {
    try {
        const { query, context, currentUrl } = req.body;
        
        // Vérifier si les paramètres sont valides
        if (!query) {
            return res.status(400).json({ 
                success: false, 
                message: 'Le paramètre query est requis'
            });
        }
        
        // Récupérer la réponse du service d'IA
        let answer, relatedSuggestions;
        
        try {
            // Essayer d'obtenir une réponse du service d'IA
            const result = await aiService.answerUserQuery(query, context, currentUrl);
            answer = result.answer;
            relatedSuggestions = result.relatedSuggestions;
        } catch (error) {
            console.error('[AI Help] Erreur lors de la génération de la réponse:', error);
            
            // Message par défaut en cas d'erreur
            answer = "Je suis désolé, je ne peux pas répondre à cette question pour le moment. Veuillez réessayer ultérieurement.";
            relatedSuggestions = getDefaultSuggestions('default');
        }
        
        res.json({ 
            success: true, 
            answer, 
            relatedSuggestions 
        });
    } catch (error) {
        console.error('[AI Help] Erreur:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Erreur lors du traitement de la requête'
        });
    }
});

/**
 * @swagger
 * /api/guides/{guideId}:
 *   get:
 *     summary: Récupérer le contenu d'un guide d'aide
 *     description: Retourne le contenu détaillé d'un guide d'aide spécifique
 *     security:
 *       - bearerAuth: []
 *       - apiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: guideId
 *         required: true
 *         schema:
 *           type: string
 *         description: Identifiant du guide à récupérer
 *     responses:
 *       200:
 *         description: Guide récupéré avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 title:
 *                   type: string
 *                 content:
 *                   type: string
 */
router.get('/guides/:guideId', authMiddleware, async (req, res) => {
    try {
        const { guideId } = req.params;
        
        // Dans une implémentation réelle, on récupérerait le contenu depuis une base de données
        // ou un système de gestion de contenu
        
        // Pour le moment, on retourne un contenu statique basé sur l'identifiant
        const guideContent = getGuideContent(guideId);
        
        if (!guideContent) {
            return res.status(404).json({ 
                success: false, 
                message: 'Guide non trouvé'
            });
        }
        
        res.json(guideContent);
    } catch (error) {
        console.error('[AI Help] Erreur guide:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Erreur lors de la récupération du guide'
        });
    }
});

/**
 * Fonction utilitaire pour obtenir des suggestions par défaut basées sur le contexte
 */
function getDefaultSuggestions(context) {
    // Suggestions par défaut pour différents contextes
    const suggestionMap = {
        default: [
            {
                title: 'Guide de démarrage rapide',
                description: 'Apprenez les bases de FHIRHub en quelques minutes.',
                action: 'guide_intro'
            },
            {
                title: 'Convertir un message HL7',
                description: 'Comment convertir un message HL7 au format FHIR.',
                action: 'guide_convert'
            },
            {
                title: 'Utiliser les workflows',
                description: 'Créez des workflows pour automatiser vos conversions.',
                action: 'guide_workflow'
            }
        ],
        workflow_editor: [
            {
                title: 'Ajouter et connecter des nœuds',
                description: 'Comment construire un workflow efficace avec des nœuds.',
                action: 'guide_workflow_nodes'
            },
            {
                title: 'Types de nœuds disponibles',
                description: 'Découvrez tous les types de nœuds et leur utilité.',
                action: 'guide_node_types'
            },
            {
                title: 'Automatiser les conversions',
                description: 'Configurez un workflow pour traiter automatiquement des messages.',
                action: 'guide_workflow_automation'
            }
        ],
        hl7_conversion: [
            {
                title: 'Formats HL7 acceptés',
                description: 'Formats HL7 compatibles et structure recommandée.',
                action: 'guide_hl7_format'
            },
            {
                title: 'Comprendre les résultats FHIR',
                description: 'Comment interpréter les résultats de conversion.',
                action: 'guide_fhir_results'
            },
            {
                title: 'Résoudre les erreurs courantes',
                description: 'Solutions aux problèmes courants de conversion.',
                action: 'guide_troubleshooting'
            }
        ],
        dashboard: [
            {
                title: 'Comprendre les métriques',
                description: 'Explication des statistiques et métriques du tableau de bord.',
                action: 'guide_metrics'
            },
            {
                title: 'Optimiser vos conversions',
                description: 'Utiliser les statistiques pour améliorer vos conversions.',
                action: 'guide_optimization'
            }
        ]
    };
    
    // Retourner les suggestions pour le contexte spécifié ou des suggestions par défaut
    return suggestionMap[context] || suggestionMap.default;
}

/**
 * Fonction utilitaire pour obtenir le contenu d'un guide spécifique
 */
function getGuideContent(guideId) {
    // Contenu statique pour les guides
    // Dans une vraie implémentation, ce contenu serait récupéré depuis une base de données
    const guides = {
        introduction: {
            title: 'Guide de démarrage rapide',
            content: `
                <h3>Bienvenue sur FHIRHub</h3>
                <p>FHIRHub est une plateforme spécialisée dans la conversion des messages HL7 vers le format FHIR, 
                optimisée pour l'interopérabilité des systèmes de santé français.</p>
                
                <h4>Principales fonctionnalités</h4>
                <ul>
                    <li>Conversion HL7 vers FHIR avec prise en charge complète des spécificités françaises</li>
                    <li>Éditeur visuel de workflows pour automatiser les conversions</li>
                    <li>Gestion des terminologies françaises spécifiques</li>
                    <li>Tableau de bord analytique pour suivre les conversions</li>
                </ul>
                
                <h4>Commencer</h4>
                <p>Pour commencer, rendez-vous sur la page <a href="/conversion.html">Conversion</a> pour transformer 
                un message HL7 individuel, ou explorez l'<a href="/workflows.html">Éditeur de workflows</a> 
                pour automatiser vos processus.</p>
            `
        },
        conversion: {
            title: 'Convertir un message HL7',
            content: `
                <h3>Conversion HL7 vers FHIR</h3>
                <p>La conversion de messages HL7 vers FHIR est la fonctionnalité principale de FHIRHub. Voici comment procéder :</p>
                
                <h4>Étapes de conversion</h4>
                <ol>
                    <li>Accédez à la page <a href="/conversion.html">Conversion</a></li>
                    <li>Collez votre message HL7 dans la zone de texte ou téléchargez un fichier</li>
                    <li>Sélectionnez les options de conversion appropriées</li>
                    <li>Cliquez sur "Convertir" pour démarrer le processus</li>
                </ol>
                
                <h4>Options de conversion</h4>
                <ul>
                    <li><strong>Version HL7</strong> : Sélectionnez la version exacte du message HL7 source</li>
                    <li><strong>Profil FHIR</strong> : Choisissez le profil FHIR pour la conversion (par défaut: France)</li>
                    <li><strong>Mode de validation</strong> : Niveau de validation à appliquer aux résultats</li>
                </ul>
                
                <h4>Résultats</h4>
                <p>Après la conversion, vous pourrez visualiser les ressources FHIR générées, les télécharger au format JSON, 
                ou les envoyer directement vers un serveur FHIR.</p>
            `
        },
        workflow: {
            title: 'Utiliser les workflows',
            content: `
                <h3>Workflows de conversion</h3>
                <p>Les workflows vous permettent d'automatiser et personnaliser vos processus de conversion.</p>
                
                <h4>Créer un workflow</h4>
                <ol>
                    <li>Accédez à la page <a href="/workflows.html">Workflows</a></li>
                    <li>Cliquez sur "Nouveau workflow"</li>
                    <li>Donnez un nom et une description à votre workflow</li>
                    <li>Utilisez l'éditeur visuel pour concevoir votre workflow</li>
                </ol>
                
                <h4>Composants clés</h4>
                <ul>
                    <li><strong>Nœuds sources</strong> : Points d'entrée des données (fichier, API, etc.)</li>
                    <li><strong>Nœuds de traitement</strong> : Transforment et manipulent les données</li>
                    <li><strong>Nœuds de sortie</strong> : Destinations des résultats (fichier, API, etc.)</li>
                </ul>
                
                <h4>Activation et exécution</h4>
                <p>Une fois votre workflow créé, activez-le en utilisant l'interrupteur. Les workflows actifs 
                peuvent être déclenchés manuellement ou via des événements programmés.</p>
            `
        },
        // Autres guides...
        default: {
            title: 'Aide FHIRHub',
            content: `
                <h3>Centre d'aide FHIRHub</h3>
                <p>Bienvenue dans le centre d'aide de FHIRHub. Explorez les différentes sections pour obtenir 
                des informations détaillées sur l'utilisation de la plateforme.</p>
                
                <h4>Sections principales</h4>
                <ul>
                    <li><a href="#" data-action="guide_intro">Guide de démarrage</a></li>
                    <li><a href="#" data-action="guide_convert">Conversion HL7</a></li>
                    <li><a href="#" data-action="guide_workflow">Workflows</a></li>
                    <li><a href="#" data-action="guide_troubleshooting">Dépannage</a></li>
                </ul>
                
                <p>Si vous ne trouvez pas ce que vous cherchez, posez votre question directement à 
                notre assistant d'aide intelligent.</p>
            `
        }
    };
    
    // Ajouter d'autres guides pour les différentes fonctionnalités
    
    return guides[guideId] || guides.default;
}

module.exports = router;