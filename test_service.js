const aiProviderService = require('./src/services/aiProviderService');
const dbService = require('./src/services/dbService');

async function testAiProviderService() {
  try {
    console.log('Initialisation des services...');
    await dbService.initialize();
    await aiProviderService.initialize();
    
    console.log('Services initialisés.');
    
    // Supprimer le fournisseur de test s'il existe
    try {
      const existingProvider = await aiProviderService.getProviderByName('test_provider');
      if (existingProvider) {
        console.log('Suppression du fournisseur de test existant...');
        await aiProviderService.deleteProvider(existingProvider.id);
      }
    } catch (error) {
      console.log('Aucun fournisseur de test existant:', error.message);
    }
    
    // Tester l'ajout d'un fournisseur
    const providerData = {
      provider_name: 'test_provider',
      api_key: 'test-key',
      api_url: 'https://example.com',
      models: 'model1,model2',
      enabled: true,
      settings: {
        temperature: 0.7,
        max_tokens: 4000
      }
    };
    
    console.log('Ajout du fournisseur de test...');
    const newProvider = await aiProviderService.addProvider(providerData);
    
    console.log('Fournisseur ajouté avec succès:', {
      id: newProvider.id,
      provider_name: newProvider.provider_name,
      settings: newProvider.settings
    });
    
    // Tester la récupération des fournisseurs
    console.log('Récupération de tous les fournisseurs...');
    const allProviders = await aiProviderService.getAllProviders();
    console.log(`${allProviders.length} fournisseur(s) trouvé(s)`);
    
    // Nettoyage
    console.log('Suppression du fournisseur de test...');
    await aiProviderService.deleteProvider(newProvider.id);
    console.log('Fournisseur supprimé.');
    
  } catch (error) {
    console.error('Erreur lors du test:', error);
  } finally {
    await dbService.close();
  }
}

testAiProviderService();
