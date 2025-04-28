/**
 * Script de test pour convertir directement un message HL7 en FHIR avec détails
 */

const fs = require('fs');
const convertHL7ToFHIR = require('./src/services/hl7ToFhirConverter');

// Lire le message HL7 depuis le fichier
const filePath = process.argv[2] || 'test_message.hl7';
const hl7Message = fs.readFileSync(filePath, 'utf8');

console.log('=== CONVERSION HL7 VERS FHIR DÉTAILLÉE ===\n');
console.log(`Message HL7 source: ${filePath}`);
console.log(`Longueur: ${hl7Message.length} caractères`);

// Convertir le message
const result = convertHL7ToFHIR(hl7Message);

// Vérifier le résultat
if (result.success) {
  console.log('\n✅ Conversion réussie !\n');
  
  // Extraire les ressources du bundle
  const bundle = result.fhirData;
  const resources = bundle.entry.map(entry => entry.resource);
  
  console.log(`Nombre de ressources générées: ${resources.length}`);
  console.log(`Types de ressources: ${resources.map(r => r.resourceType).join(', ')}\n`);
  
  // Examiner chaque ressource
  resources.forEach(resource => {
    console.log(`Ressource ${resource.resourceType} (ID: ${resource.id}):`);
    
    switch (resource.resourceType) {
      case 'Patient':
        // Identifiants
        if (resource.identifier && resource.identifier.length > 0) {
          console.log(`  Identifiants (${resource.identifier.length}):`);
          resource.identifier.forEach(id => {
            console.log(`    - ${id.system || 'Sans système'}: ${id.value || 'Sans valeur'}`);
          });
        } else {
          console.log('  Aucun identifiant');
        }
        
        // Noms
        if (resource.name && resource.name.length > 0) {
          console.log(`  Noms (${resource.name.length}):`);
          resource.name.forEach(name => {
            console.log(`    - ${name.family || 'Sans nom'}, ${(name.given || []).join(' ') || 'Sans prénom'} (${name.use || 'usage non spécifié'})`);
          });
        } else {
          console.log('  Aucun nom');
        }
        
        // Genre
        if (resource.gender) {
          console.log(`  Genre: ${resource.gender}`);
        }
        
        // Date de naissance
        if (resource.birthDate) {
          console.log(`  Date de naissance: ${resource.birthDate}`);
        }
        
        // Adresses
        if (resource.address && resource.address.length > 0) {
          console.log(`  Adresses (${resource.address.length}):`);
          resource.address.forEach(addr => {
            const lines = addr.line ? addr.line.join(', ') : '';
            console.log(`    - ${lines} ${addr.city || ''} ${addr.postalCode || ''} ${addr.country || ''} (${addr.use || 'usage non spécifié'})`);
          });
        } else {
          console.log('  Aucune adresse');
        }
        
        // Contacts
        if (resource.telecom && resource.telecom.length > 0) {
          console.log(`  Contacts (${resource.telecom.length}):`);
          resource.telecom.forEach(contact => {
            console.log(`    - ${contact.system || 'Système non spécifié'}: ${contact.value || 'Valeur non spécifiée'}`);
          });
        } else {
          console.log('  Aucun contact');
        }
        break;
        
      case 'Encounter':
        console.log(`  Statut: ${resource.status || 'Non spécifié'}`);
        console.log(`  Classe: ${resource.class?.code || 'Non spécifiée'}`);
        if (resource.subject) {
          console.log(`  Patient: ${resource.subject.reference || 'Référence non spécifiée'}`);
        }
        if (resource.period) {
          console.log(`  Période: début=${resource.period.start || 'Non spécifié'}, fin=${resource.period.end || 'Non spécifié'}`);
        }
        break;
        
      case 'Organization':
        console.log(`  Nom: ${resource.name || 'Non spécifié'}`);
        if (resource.identifier && resource.identifier.length > 0) {
          console.log(`  Identifiants (${resource.identifier.length}):`);
          resource.identifier.forEach(id => {
            console.log(`    - ${id.system || 'Sans système'}: ${id.value || 'Sans valeur'}`);
          });
        }
        break;
        
      case 'Coverage':
        console.log(`  Statut: ${resource.status || 'Non spécifié'}`);
        if (resource.beneficiary) {
          console.log(`  Bénéficiaire: ${resource.beneficiary.reference || 'Référence non spécifiée'}`);
        }
        if (resource.payor && resource.payor.length > 0) {
          console.log(`  Payeurs (${resource.payor.length}):`);
          resource.payor.forEach(payor => {
            console.log(`    - ${payor.reference || 'Référence non spécifiée'}`);
          });
        }
        break;
        
      default:
        console.log(`  Ressource de type non détaillé`);
    }
    
    console.log('');
  });
  
  // Enregistrer le résultat dans un fichier
  const outputFile = 'conversion_result_detailed.json';
  fs.writeFileSync(outputFile, JSON.stringify(result.fhirData, null, 2));
  console.log(`Résultat enregistré dans ${outputFile}`);
  
} else {
  console.log('\n❌ Échec de la conversion');
  console.log(`Erreur: ${result.message}`);
}