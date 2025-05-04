/**
 * Service d'IA pour les suggestions d'aide et réponses aux questions
 * FHIRHub - Système d'aide contextuelle
 */

const { getAIProvider } = require('./aiProviderService');
const logger = require('../utils/logger');

/**
 * Service pour gérer les suggestions d'aide et réponses aux questions basées sur l'IA
 */
class AIHelpService {
    constructor() {
        // Initialisation du service
        this.guideSummaries = this._loadGuideSummaries();
        logger.info('[AI Help] Service initialisé');
    }

    /**
     * Obtient des suggestions d'aide contextuelles basées sur l'IA
     * @param {string} context - Contexte actuel (ex: workflow_editor, hl7_conversion)
     * @param {string} currentUrl - URL actuelle de l'utilisateur
     * @param {string} userRole - Rôle de l'utilisateur (ex: admin, user)
     * @returns {Promise<Array>} - Liste de suggestions d'aide
     */
    async getContextualHelpSuggestions(context, currentUrl, userRole) {
        try {
            // Vérifier si un service d'IA est disponible
            const aiProvider = await getAIProvider();
            if (!aiProvider) {
                logger.warn('[AI Help] Aucun fournisseur d\'IA disponible, utilisation des suggestions par défaut');
                return this._getDefaultSuggestions(context);
            }

            // Construire le prompt pour l'IA
            const prompt = this._buildContextualSuggestionsPrompt(context, currentUrl, userRole);

            // Obtenir la réponse de l'IA
            const response = await aiProvider.generateCompletion(prompt, {
                max_tokens: 800,
                temperature: 0.4,
                responseFormat: 'json'
            });

            // Analyser et valider la réponse
            const suggestions = this._parseSuggestionsResponse(response, context);
            return suggestions;

        } catch (error) {
            logger.error(`[AI Help] Erreur lors de la génération des suggestions: ${error.message}`);
            // En cas d'erreur, retourner des suggestions par défaut
            return this._getDefaultSuggestions(context);
        }
    }

    /**
     * Génère une réponse à une question utilisateur
     * @param {string} query - Question de l'utilisateur
     * @param {string} context - Contexte actuel
     * @param {string} currentUrl - URL actuelle
     * @returns {Promise<Object>} - Réponse et suggestions associées
     */
    async answerUserQuery(query, context, currentUrl) {
        try {
            // Vérifier si un service d'IA est disponible
            const aiProvider = await getAIProvider();
            if (!aiProvider) {
                logger.warn('[AI Help] Aucun fournisseur d\'IA disponible, utilisation des réponses par défaut');
                return {
                    answer: "Je suis désolé, le service d'intelligence artificielle n'est pas disponible actuellement. Veuillez réessayer ultérieurement ou consulter notre documentation.",
                    relatedSuggestions: this._getDefaultSuggestions('default')
                };
            }

            // Construire le prompt pour l'IA
            const prompt = this._buildQueryResponsePrompt(query, context, currentUrl);

            // Obtenir la réponse de l'IA
            const response = await aiProvider.generateCompletion(prompt, {
                max_tokens: 1000,
                temperature: 0.5,
                responseFormat: 'json'
            });

            // Analyser et valider la réponse
            const result = this._parseQueryResponse(response, context);
            return result;

        } catch (error) {
            logger.error(`[AI Help] Erreur lors de la génération de la réponse: ${error.message}`);
            // En cas d'erreur, retourner une réponse par défaut
            return {
                answer: "Je suis désolé, je ne peux pas répondre à cette question pour le moment. Veuillez réessayer ultérieurement.",
                relatedSuggestions: this._getDefaultSuggestions('default')
            };
        }
    }

    /**
     * Construit le prompt pour les suggestions contextuelles
     * @private
     */
    _buildContextualSuggestionsPrompt(context, currentUrl, userRole) {
        return `
Tu es l'assistant IA intégré au système d'aide contextuelle de FHIRHub, une plateforme spécialisée dans la conversion HL7 vers FHIR pour les systèmes de santé français.

L'utilisateur est actuellement dans le contexte "${context}" sur la page "${currentUrl}" avec le rôle "${userRole}".

Génère 3 suggestions d'aide pertinentes pour ce contexte. Chaque suggestion doit être claire, concise et spécifique.

Contextes possibles et leurs significations:
- workflow_editor: L'utilisateur est en train de créer ou modifier un workflow de traitement dans l'éditeur visuel.
- hl7_conversion: L'utilisateur est sur la page de conversion HL7 vers FHIR.
- dashboard: L'utilisateur consulte le tableau de bord avec les statistiques.
- default: Contexte général de l'application.

Chaque suggestion doit inclure:
1. Un titre court et clair (moins de 10 mots)
2. Une description informative mais concise (30-40 mots)
3. Une action associée (sous forme d'identifiant, ex: guide_workflow_nodes)

Réponds uniquement au format JSON avec la structure suivante:
{
  "suggestions": [
    {
      "title": "Titre de la suggestion 1",
      "description": "Description détaillée de la suggestion 1",
      "action": "guide_action_id"
    },
    ...
  ]
}

Les identifiants d'action doivent suivre le format guide_[nom_guide] et être cohérents avec le contenu de la suggestion.
`;
    }

    /**
     * Construit le prompt pour les réponses aux questions
     * @private
     */
    _buildQueryResponsePrompt(query, context, currentUrl) {
        return `
Tu es l'assistant IA intégré au système d'aide de FHIRHub, une plateforme spécialisée dans la conversion HL7 vers FHIR pour les systèmes de santé français.

L'utilisateur pose la question suivante dans le contexte "${context}" sur la page "${currentUrl}":

"${query}"

Réponds à cette question de manière précise, concise et utile. Ta réponse doit:
1. Être factuelle et basée uniquement sur les fonctionnalités réelles de FHIRHub
2. Être limitée à 250 mots maximum
3. Inclure des conseils pratiques ou des instructions étape par étape si c'est pertinent
4. Ne pas contenir d'informations techniques inutiles pour un utilisateur standard

Après ta réponse principale, suggère 2-3 sujets liés qui pourraient intéresser l'utilisateur.

Réponds uniquement au format JSON avec la structure suivante:
{
  "answer": "Ta réponse détaillée à la question",
  "relatedSuggestions": [
    {
      "title": "Titre de la suggestion liée 1",
      "description": "Description de la suggestion 1",
      "action": "guide_action_id"
    },
    ...
  ]
}

Les identifiants d'action doivent suivre le format guide_[nom_guide] et être cohérents avec le contenu de la suggestion.

Contexte de FHIRHub:
FHIRHub est une solution de conversion HL7 vers FHIR spécialisée pour le système de santé français. Elle inclut un éditeur visuel de workflows, une API complète, et gère les terminologies spécifiques françaises. La plateforme est développée pour fonctionner en mode portable (sans installation lourde) et utilise SQLite comme base de données.
`;
    }

    /**
     * Analyse et valide la réponse de suggestions
     * @private
     */
    _parseSuggestionsResponse(response, context) {
        try {
            // Tenter de parser la réponse comme du JSON
            let parsedResponse;
            
            if (typeof response === 'string') {
                // Si la réponse est une chaîne, on essaie de la parser comme du JSON
                try {
                    parsedResponse = JSON.parse(response);
                } catch (error) {
                    logger.error(`[AI Help] Erreur de parsing JSON: ${error.message}`);
                    return this._getDefaultSuggestions(context);
                }
            } else if (typeof response === 'object') {
                // Si la réponse est déjà un objet, on l'utilise directement
                parsedResponse = response;
            } else {
                // Si le format n'est pas reconnu, utiliser les suggestions par défaut
                logger.error(`[AI Help] Format de réponse non valide: ${typeof response}`);
                return this._getDefaultSuggestions(context);
            }

            // Vérifier que la structure est correcte
            if (!parsedResponse.suggestions || !Array.isArray(parsedResponse.suggestions)) {
                logger.error('[AI Help] Structure de réponse incorrecte');
                return this._getDefaultSuggestions(context);
            }

            // Valider et nettoyer chaque suggestion
            const validatedSuggestions = parsedResponse.suggestions.map(suggestion => {
                return {
                    title: suggestion.title || 'Suggestion',
                    description: suggestion.description || 'Aucune description disponible',
                    action: suggestion.action || 'guide_default'
                };
            }).filter(suggestion => suggestion.title.length > 0 && suggestion.description.length > 0);

            if (validatedSuggestions.length === 0) {
                logger.warn('[AI Help] Aucune suggestion valide trouvée dans la réponse');
                return this._getDefaultSuggestions(context);
            }

            return validatedSuggestions;

        } catch (error) {
            logger.error(`[AI Help] Erreur lors du traitement des suggestions: ${error.message}`);
            return this._getDefaultSuggestions(context);
        }
    }

    /**
     * Analyse et valide la réponse à une question
     * @private
     */
    _parseQueryResponse(response, context) {
        try {
            // Tenter de parser la réponse comme du JSON
            let parsedResponse;
            
            if (typeof response === 'string') {
                try {
                    parsedResponse = JSON.parse(response);
                } catch (error) {
                    logger.error(`[AI Help] Erreur de parsing JSON pour la réponse: ${error.message}`);
                    return {
                        answer: "Je suis désolé, je n'ai pas pu générer une réponse valide. Veuillez reformuler votre question.",
                        relatedSuggestions: this._getDefaultSuggestions(context)
                    };
                }
            } else if (typeof response === 'object') {
                parsedResponse = response;
            } else {
                logger.error(`[AI Help] Format de réponse non valide: ${typeof response}`);
                return {
                    answer: "Je suis désolé, je n'ai pas pu générer une réponse valide. Veuillez reformuler votre question.",
                    relatedSuggestions: this._getDefaultSuggestions(context)
                };
            }

            // Vérifier que la structure est correcte
            if (!parsedResponse.answer || typeof parsedResponse.answer !== 'string') {
                logger.error('[AI Help] Structure de réponse incorrecte pour la question');
                return {
                    answer: "Je suis désolé, je n'ai pas pu générer une réponse valide. Veuillez reformuler votre question.",
                    relatedSuggestions: this._getDefaultSuggestions(context)
                };
            }

            // Valider et nettoyer les suggestions liées
            let relatedSuggestions = this._getDefaultSuggestions(context);
            
            if (parsedResponse.relatedSuggestions && Array.isArray(parsedResponse.relatedSuggestions)) {
                const validatedSuggestions = parsedResponse.relatedSuggestions.map(suggestion => {
                    return {
                        title: suggestion.title || 'Suggestion liée',
                        description: suggestion.description || 'Aucune description disponible',
                        action: suggestion.action || 'guide_default'
                    };
                }).filter(suggestion => suggestion.title.length > 0 && suggestion.description.length > 0);

                if (validatedSuggestions.length > 0) {
                    relatedSuggestions = validatedSuggestions;
                }
            }

            return {
                answer: parsedResponse.answer,
                relatedSuggestions
            };

        } catch (error) {
            logger.error(`[AI Help] Erreur lors du traitement de la réponse: ${error.message}`);
            return {
                answer: "Je suis désolé, une erreur s'est produite lors du traitement de votre question. Veuillez réessayer.",
                relatedSuggestions: this._getDefaultSuggestions(context)
            };
        }
    }

    /**
     * Charge les résumés des guides disponibles
     * @private
     */
    _loadGuideSummaries() {
        // Dans une vraie implémentation, ces résumés pourraient être chargés depuis une base de données
        return {
            guide_intro: {
                title: 'Guide de démarrage rapide',
                summary: 'Introduction aux fonctionnalités de base de FHIRHub'
            },
            guide_convert: {
                title: 'Conversion HL7 vers FHIR',
                summary: 'Comment utiliser l\'outil de conversion HL7 vers FHIR'
            },
            guide_workflow: {
                title: 'Utilisation des workflows',
                summary: 'Création et gestion des workflows de traitement automatisés'
            },
            guide_workflow_nodes: {
                title: 'Utilisation des nœuds de workflow',
                summary: 'Comment ajouter et connecter des nœuds dans l\'éditeur visuel'
            },
            guide_node_types: {
                title: 'Types de nœuds disponibles',
                summary: 'Description des différents types de nœuds et leurs fonctions'
            },
            guide_workflow_automation: {
                title: 'Automatisation des workflows',
                summary: 'Configuration des déclencheurs et des exécutions automatisées'
            },
            guide_hl7_format: {
                title: 'Formats HL7 acceptés',
                summary: 'Détails sur les formats et versions HL7 supportés'
            },
            guide_fhir_results: {
                title: 'Comprendre les résultats FHIR',
                summary: 'Comment interpréter et utiliser les résultats des conversions'
            },
            guide_troubleshooting: {
                title: 'Résolution des problèmes',
                summary: 'Solutions aux problèmes courants de conversion et d\'utilisation'
            },
            guide_metrics: {
                title: 'Métriques du tableau de bord',
                summary: 'Explication des différentes métriques et statistiques'
            },
            guide_optimization: {
                title: 'Optimisation des conversions',
                summary: 'Conseils pour améliorer la performance et la précision des conversions'
            },
            guide_default: {
                title: 'Aide FHIRHub',
                summary: 'Informations générales sur l\'utilisation de FHIRHub'
            }
        };
    }

    /**
     * Retourne des suggestions par défaut pour un contexte donné
     * @private
     */
    _getDefaultSuggestions(context) {
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
}

// Singleton pour le service d'IA d'aide
const aiHelpService = new AIHelpService();

module.exports = aiHelpService;