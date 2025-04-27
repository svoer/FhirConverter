package com.fhirhub.service;

import ca.uhn.fhir.context.FhirContext;
import ca.uhn.fhir.parser.IParser;
import ca.uhn.hl7v2.DefaultHapiContext;
import ca.uhn.hl7v2.HL7Exception;
import ca.uhn.hl7v2.HapiContext;
import ca.uhn.hl7v2.model.Message;
import ca.uhn.hl7v2.parser.Parser;
import lombok.extern.slf4j.Slf4j;
import org.hl7.fhir.r4.model.Bundle;
import org.hl7.fhir.r4.model.Resource;
import org.springframework.stereotype.Service;

import java.util.Collections;
import java.util.List;

/**
 * Service for converting HL7 v2.5 messages to FHIR R4
 */
@Service
@Slf4j
public class Hl7ToFhirConverter {

    private final FhirContext fhirContext;
    private final HapiContext hapiContext;

    public Hl7ToFhirConverter() {
        // Initialize FHIR context for R4
        this.fhirContext = FhirContext.forR4();
        
        // Initialize HAPI context for HL7 v2.x
        this.hapiContext = new DefaultHapiContext();
    }

    /**
     * Convert HL7 v2.5 message to FHIR R4 resources
     * 
     * @param hl7Message The HL7 v2.5 message content
     * @return Conversion result containing success status and FHIR data or error
     */
    public ConversionResult convertHl7ToFhir(String hl7Message) {
        long startTime = System.currentTimeMillis();
        
        try {
            // Parse the HL7 message
            Parser parser = hapiContext.getPipeParser();
            Message message = parser.parse(hl7Message);
            
            log.info("Successfully parsed HL7 message of type: {}", message.getName());
            
            // TODO: Implement the actual conversion using HAPI FHIR Converter
            // This is a placeholder until we implement the actual converter logic
            // In a real implementation, we would use:
            // 1. org.hl7.fhir.convertors.NullVersionConverterAdvisor60
            // 2. org.hl7.fhir.convertors.conv10_50.VersionConvertor_10_50
            // 3. Or other HAPI FHIR converters for HL7v2 to FHIR

            // For now, create a simple Bundle with basic info
            Bundle fhirBundle = new Bundle();
            fhirBundle.setType(Bundle.BundleType.COLLECTION);
            
            // Calculate processing time
            long endTime = System.currentTimeMillis();
            long processingTime = endTime - startTime;
            
            return new ConversionResult(true, fhirBundle, null, processingTime);
            
        } catch (HL7Exception e) {
            log.error("Error parsing HL7 message: {}", e.getMessage(), e);
            
            // Calculate processing time even for failures
            long endTime = System.currentTimeMillis();
            long processingTime = endTime - startTime;
            
            return new ConversionResult(false, null, 
                    "Error parsing HL7 message: " + e.getMessage(), processingTime);
        } catch (Exception e) {
            log.error("Unexpected error during conversion: {}", e.getMessage(), e);
            
            // Calculate processing time even for failures
            long endTime = System.currentTimeMillis();
            long processingTime = endTime - startTime;
            
            return new ConversionResult(false, null, 
                    "Unexpected error during conversion: " + e.getMessage(), processingTime);
        }
    }
    
    /**
     * Convert a FHIR resource to JSON string
     */
    public String convertFhirToJson(Resource resource) {
        IParser jsonParser = fhirContext.newJsonParser().setPrettyPrint(true);
        return jsonParser.encodeResourceToString(resource);
    }

    /**
     * Class representing the result of a conversion operation
     */
    public static class ConversionResult {
        private final boolean success;
        private final Object fhir;
        private final String errorMessage;
        private final long processingTimeMs;
        
        public ConversionResult(boolean success, Object fhir, String errorMessage, long processingTimeMs) {
            this.success = success;
            this.fhir = fhir;
            this.errorMessage = errorMessage;
            this.processingTimeMs = processingTimeMs;
        }

        public boolean isSuccess() {
            return success;
        }

        public Object getFhir() {
            return fhir;
        }
        
        public List<Resource> getResources() {
            if (fhir instanceof Bundle) {
                return ((Bundle) fhir).getEntry().stream()
                        .map(Bundle.BundleEntryComponent::getResource)
                        .toList();
            } else if (fhir instanceof Resource) {
                return Collections.singletonList((Resource) fhir);
            }
            return Collections.emptyList();
        }

        public String getErrorMessage() {
            return errorMessage;
        }
        
        public long getProcessingTimeMs() {
            return processingTimeMs;
        }
        
        public int getResourceCount() {
            return getResources().size();
        }
    }
}