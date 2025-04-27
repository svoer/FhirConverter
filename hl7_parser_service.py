#!/usr/bin/env python3
"""
Service de parsing HL7 avec la bibliothèque 'hl7'
Permet d'analyser des messages HL7 v2.x et de les retourner sous forme structurée
pour la conversion en FHIR
"""

import json
import sys
import traceback
import hl7

def parse_hl7_message(hl7_content):
    """
    Parse un message HL7 et retourne une structure JSON
    """
    try:
        # Nettoyage du message
        # Supprimer les caractères non imprimables et les caractères de fin de ligne inutiles
        hl7_content = hl7_content.strip()
        
        # Détection du séparateur de segment
        # HL7 utilise généralement \r comme séparateur, mais on peut rencontrer \n ou \r\n
        segment_separator = "\r"
        if "\r\n" in hl7_content:
            segment_separator = "\r\n"
        elif "\n" in hl7_content and "\r" not in hl7_content:
            segment_separator = "\n"
        
        # Parser le message
        message = hl7.parse(hl7_content)
        
        # Extraire les informations d'en-tête MSH
        msh_segment = message[0]
        
        # Déterminer les séparateurs
        field_separator = str(msh_segment[0][0])
        component_separator = str(msh_segment[1][0])[:1]
        repetition_separator = str(msh_segment[1][0])[1:2] if len(str(msh_segment[1][0])) > 1 else '~'
        escape_char = str(msh_segment[1][0])[2:3] if len(str(msh_segment[1][0])) > 2 else '\\'
        subcomponent_separator = str(msh_segment[1][0])[3:4] if len(str(msh_segment[1][0])) > 3 else '&'
        
        # Extraire les informations principales du message
        message_info = {
            "messageType": str(msh_segment[9]),
            "messageControlId": str(msh_segment[10]),
            "messageDate": str(msh_segment[7]),
            "version": str(msh_segment[12]) if len(msh_segment) > 12 else None,
            "sendingApplication": str(msh_segment[3]),
            "sendingFacility": str(msh_segment[4]),
            "receivingApplication": str(msh_segment[5]),
            "receivingFacility": str(msh_segment[6]),
            "encoding": {
                "fieldSeparator": field_separator,
                "componentSeparator": component_separator,
                "repetitionSeparator": repetition_separator,
                "escapeCharacter": escape_char,
                "subcomponentSeparator": subcomponent_separator
            }
        }
        
        # Construction de la structure du message
        structured_message = {
            "messageInfo": message_info,
            "segments": []
        }
        
        # Traitement de tous les segments
        for segment in message:
            segment_id = str(segment[0])
            segment_data = {
                "segmentId": segment_id,
                "fields": []
            }
            
            # Traitement des champs du segment
            for i in range(1, len(segment)):
                field_value = str(segment[i])
                
                # Décomposer en composants si nécessaire
                field_components = []
                
                # Gérer les champs avec répétition
                if repetition_separator in field_value:
                    repetitions = field_value.split(repetition_separator)
                    for rep in repetitions:
                        if component_separator in rep:
                            components = rep.split(component_separator)
                            for j, comp in enumerate(components):
                                # Gérer les sous-composants si nécessaire
                                subcomponents = []
                                if subcomponent_separator in comp:
                                    subcomps = comp.split(subcomponent_separator)
                                    for subcomp in subcomps:
                                        subcomponents.append({"value": subcomp})
                                
                                field_components.append({
                                    "componentPosition": j + 1,
                                    "value": comp,
                                    "subcomponents": subcomponents
                                })
                        else:
                            # Pas de composants, juste une valeur
                            field_components.append({
                                "componentPosition": 1,
                                "value": rep,
                                "subcomponents": []
                            })
                elif component_separator in field_value:
                    components = field_value.split(component_separator)
                    for j, comp in enumerate(components):
                        # Gérer les sous-composants si nécessaire
                        subcomponents = []
                        if subcomponent_separator in comp:
                            subcomps = comp.split(subcomponent_separator)
                            for subcomp in subcomps:
                                subcomponents.append({"value": subcomp})
                        
                        field_components.append({
                            "componentPosition": j + 1,
                            "value": comp,
                            "subcomponents": subcomponents
                        })
                else:
                    # Pas de composants, juste une valeur
                    if field_value:  # Vérifier si la valeur n'est pas vide
                        field_components.append({
                            "componentPosition": 1,
                            "value": field_value,
                            "subcomponents": []
                        })
                
                field_data = {
                    "fieldPosition": i,
                    "value": field_value,
                    "components": field_components
                }
                
                segment_data["fields"].append(field_data)
            
            structured_message["segments"].append(segment_data)
        
        return {
            "success": True,
            "message": "Message HL7 parsé avec succès",
            "data": structured_message
        }
    
    except Exception as e:
        # Capture du stack trace pour le débogage
        stack_trace = traceback.format_exc()
        
        return {
            "success": False,
            "message": f"Erreur lors du parsing du message HL7: {str(e)}",
            "error": str(e),
            "stackTrace": stack_trace
        }

def extract_patient_info(parsed_message):
    """
    Extrait les informations du patient à partir d'un message HL7 parsé
    """
    try:
        segments = parsed_message.get("data", {}).get("segments", [])
        
        # Rechercher le segment PID (Patient Identification)
        pid_segment = next((s for s in segments if s.get("segmentId") == "PID"), None)
        
        if not pid_segment:
            return {
                "success": False,
                "message": "Segment PID non trouvé dans le message HL7"
            }
        
        # Fonction auxiliaire pour obtenir un champ par sa position
        def get_field(segment, position):
            for field in segment.get("fields", []):
                if field.get("fieldPosition") == position:
                    return field
            return None
        
        # Extraire les informations du patient
        patient_id_field = get_field(pid_segment, 3)  # PID.3 - Patient Identifier List
        patient_name_field = get_field(pid_segment, 5)  # PID.5 - Patient Name
        birth_date_field = get_field(pid_segment, 7)  # PID.7 - Date/Time of Birth
        gender_field = get_field(pid_segment, 8)  # PID.8 - Administrative Sex
        address_field = get_field(pid_segment, 11)  # PID.11 - Patient Address
        
        # Construire l'objet patient
        patient_info = {
            "identifiers": [],
            "names": [],
            "birthDate": birth_date_field.get("value") if birth_date_field else None,
            "gender": gender_field.get("value") if gender_field else None,
            "addresses": []
        }
        
        # Traiter les identifiants (PID.3)
        if patient_id_field:
            for component in patient_id_field.get("components", []):
                if component.get("componentPosition") == 1:  # ID
                    id_value = component.get("value")
                    
                    # Chercher le type d'identifiant (composant 5)
                    id_type = None
                    id_system = None
                    
                    for c in patient_id_field.get("components", []):
                        if c.get("componentPosition") == 5:  # Type d'ID
                            id_type = c.get("value")
                        elif c.get("componentPosition") == 4:  # Système d'attribution
                            id_system = c.get("value")
                    
                    patient_info["identifiers"].append({
                        "value": id_value,
                        "type": id_type,
                        "system": id_system
                    })
        
        # Traiter les noms (PID.5)
        if patient_name_field:
            family = None
            given = None
            middle = None
            prefix = None
            suffix = None
            
            for component in patient_name_field.get("components", []):
                position = component.get("componentPosition")
                value = component.get("value")
                
                if position == 1:  # Nom de famille
                    family = value
                elif position == 2:  # Prénom
                    given = value
                elif position == 3:  # Second prénom
                    middle = value
                elif position == 4:  # Suffixe
                    suffix = value
                elif position == 5:  # Préfixe
                    prefix = value
            
            patient_info["names"].append({
                "family": family,
                "given": given,
                "middle": middle,
                "prefix": prefix,
                "suffix": suffix
            })
        
        # Traiter les adresses (PID.11)
        if address_field:
            street = None
            other_street = None
            city = None
            state = None
            postal_code = None
            country = None
            
            for component in address_field.get("components", []):
                position = component.get("componentPosition")
                value = component.get("value")
                
                if position == 1:  # Rue
                    street = value
                elif position == 2:  # Autre ligne d'adresse
                    other_street = value
                elif position == 3:  # Ville
                    city = value
                elif position == 4:  # État/Province
                    state = value
                elif position == 5:  # Code postal
                    postal_code = value
                elif position == 6:  # Pays
                    country = value
            
            patient_info["addresses"].append({
                "street": street,
                "otherStreet": other_street,
                "city": city,
                "state": state,
                "postalCode": postal_code,
                "country": country
            })
        
        return {
            "success": True,
            "message": "Informations patient extraites avec succès",
            "data": patient_info
        }
    
    except Exception as e:
        return {
            "success": False,
            "message": f"Erreur lors de l'extraction des informations patient: {str(e)}",
            "error": str(e)
        }

def main():
    """
    Point d'entrée principal pour le traitement des messages HL7
    """
    # Si un fichier est fourni en argument
    if len(sys.argv) > 1:
        file_path = sys.argv[1]
        try:
            with open(file_path, 'r') as file:
                hl7_content = file.read()
                result = parse_hl7_message(hl7_content)
                
                # Si le parsing a réussi, essayer d'extraire les informations du patient
                if result.get("success"):
                    patient_info = extract_patient_info(result)
                    result["patientInfo"] = patient_info.get("data")
                
                print(json.dumps(result, indent=2))
        except Exception as e:
            print(json.dumps({
                "success": False,
                "message": f"Erreur lors de la lecture du fichier: {str(e)}",
                "error": str(e)
            }, indent=2))
    # Sinon, lire depuis stdin
    else:
        try:
            hl7_content = sys.stdin.read()
            result = parse_hl7_message(hl7_content)
            
            # Si le parsing a réussi, essayer d'extraire les informations du patient
            if result.get("success"):
                patient_info = extract_patient_info(result)
                result["patientInfo"] = patient_info.get("data")
            
            print(json.dumps(result, indent=2))
        except Exception as e:
            print(json.dumps({
                "success": False,
                "message": f"Erreur lors du traitement de l'entrée standard: {str(e)}",
                "error": str(e)
            }, indent=2))

if __name__ == "__main__":
    main()