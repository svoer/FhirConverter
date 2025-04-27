#!/bin/bash
# Script pour remplacer les références à FHIR R5 par FHIR R4 dans le convertisseur

echo "Remplacement des références à FHIR R5 par FHIR R4..."
sed -i 's/obligatoire en R5/obligatoire en R4/g' hl7ToFhirConverter.js
sed -i 's/En FHIR R5/En FHIR R4/g' hl7ToFhirConverter.js
sed -i 's/pour R5/pour R4/g' hl7ToFhirConverter.js
sed -i 's/valide en R5/valide en R4/g' hl7ToFhirConverter.js
sed -i 's/(R5 est strict)/(R4 est strict)/g' hl7ToFhirConverter.js

# Correction de la structure Encounter pour R4
# Dans R4, la propriété 'class' est un objet Coding unique et non un tableau comme dans R5
sed -i 's/class: \[\{/class: {/g' hl7ToFhirConverter.js
sed -i 's/}\],/},/g' hl7ToFhirConverter.js

echo "Mise à jour terminée."