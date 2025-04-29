const message = "MSH|^~\&|1.2.250.1.211.7.1.200.1.2|MCK|EAI|EAI|20250417050534||ADT^A01^ADT_A01|131822802|P|2.5^FRA^2.5|50926931||||FRA|8859/1|||A01^IPG~ADD_ENTREE_HOPITAL^INTEG
EVN||20250417050503|||MAURICEM
PID|||1174024^^^MCK&1.2.250.1.211.10.200.1&ISO^PI~1121717802492545833548^^^ASIP-SANTE-INS-C&1.2.250.1.213.1.4.2&ISO^INS-C^^20170215~160059932710027^^^ASIP-SANTE-INS-NIR&1.2.250.1.213.1.4.8&ISO^INS||YEHOUESSI^HERMAS JEAN RICHARD^HERMAS JEAN RICHARD^^^^L||19600509000000|M|||8  AVENUE CONDORCET^^FORT DE FRANCE^^97200^FRA^H~^^^^^UNK^C~^^PORTO NUEVO^^99327^BEN^BDL^^99327||0696039637^PRN^PH~0596000093^PRN^PH~0696039637^PRN^CP|||M||562102580^^^MCK|||||PORTO NUEVO|||FRA||||N||VALI";

// Extraction des segments
const segments = message.split('\n');
const pidSegment = segments.find(s => s.startsWith('PID'));

if (pidSegment) {
  // Séparer les champs du segment PID
  const fields = pidSegment.split('|');
  
  // Le champ PID-3 contient les identifiants
  const pid3 = fields[3];
  
  if (pid3) {
    // Séparer les répétitions d'identifiants (séparés par ~)
    const identifiers = pid3.split('~');
    
    console.log('Tous les identifiants du segment PID-3:');
    identifiers.forEach((id, index) => {
      console.log(, id);
      
      // Décomposer l'identifiant en ses composants
      const parts = id.split('^');
      
      const idValue = parts[0] || '';
      const assigningAuthority = parts[3] || '';
      const idType = parts[4] || '';
      
      console.log();
      console.log();
      console.log();
      console.log('---');
    });
  }
}
