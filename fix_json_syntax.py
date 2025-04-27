#!/usr/bin/env python3
"""
Script pour corriger les erreurs de syntaxe JSON dans le fichier hl7ToFhirConverter.js
"""

import re
import sys

def fix_json_syntax(filename):
    # Lire le fichier
    with open(filename, 'r', encoding='utf-8') as f:
        content = f.read()

    # Correction 1: identifier arrays mal formés
    content = re.sub(r'identifier: \[\{([^}]+)\},\s*(\w+):', r'identifier: [{\1}],\n            \2:', content)
    
    # Correction 2: name arrays mal formés
    content = re.sub(r'name: \[\{([^}]+)\},\s*(\w+):', r'name: [{\1}],\n            \2:', content)
    
    # Correction 3: relationship arrays mal formés
    content = re.sub(r'relationship: \[\{([^}]+)\},\s*(\w+):', r'relationship: [{\1}],\n            \2:', content)
    
    # Correction 4: type arrays mal formés
    content = re.sub(r'type: \[\{([^}]+)\},\s*(\w+):', r'type: [{\1}],\n            \2:', content)
    
    # Correction 5: extension arrays mal formés
    content = re.sub(r'extension: \[\{([^}]+)\},\s*(\w+):', r'extension: [{\1}],\n            \2:', content)
    
    # Correction 6: code arrays mal formés
    content = re.sub(r'code: \[\{([^}]+)\},\s*(\w+):', r'code: [{\1}],\n            \2:', content)

    # Écrire le fichier corrigé
    with open(filename, 'w', encoding='utf-8') as f:
        f.write(content)

    print(f"Corrections appliquées au fichier {filename}")

if __name__ == "__main__":
    if len(sys.argv) > 1:
        filename = sys.argv[1]
    else:
        filename = "hl7ToFhirConverter.js"
    
    fix_json_syntax(filename)