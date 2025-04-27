package com.fhirhub.controller;

import com.fhirhub.config.AppConfig;
import com.fhirhub.model.ConversionLog;
import com.fhirhub.service.ConversionLogService;
import com.fhirhub.service.Hl7ToFhirConverter;
import lombok.extern.slf4j.Slf4j;
import org.hl7.fhir.r4.model.Resource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

/**
 * REST API controller for the FHIR Hub application
 */
@RestController
@RequestMapping("/api")
@Slf4j
public class ApiController {

    @Autowired
    private AppConfig appConfig;

    @Autowired
    private Hl7ToFhirConverter converter;

    @Autowired
    private ConversionLogService conversionLogService;

    /**
     * Get conversion logs with pagination
     */
    @GetMapping("/conversions")
    public ResponseEntity<Map<String, Object>> getConversions(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        
        Page<ConversionLog> conversions = conversionLogService.getConversionLogs(page, size);
        
        Map<String, Object> response = new HashMap<>();
        response.put("data", conversions.getContent());
        response.put("currentPage", conversions.getNumber());
        response.put("totalItems", conversions.getTotalElements());
        response.put("totalPages", conversions.getTotalPages());
        
        return ResponseEntity.ok(response);
    }

    /**
     * Get conversion statistics
     */
    @GetMapping("/stats")
    public ResponseEntity<Map<String, Object>> getStats() {
        return ResponseEntity.ok(conversionLogService.getConversionStats());
    }

    /**
     * Get a specific conversion by ID
     */
    @GetMapping("/conversions/{id}")
    public ResponseEntity<?> getConversion(@PathVariable Long id) {
        return conversionLogService.getConversionLog(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    /**
     * Get a specific FHIR file
     */
    @GetMapping("/fhir/{filename}")
    public ResponseEntity<?> getFhirResource(@PathVariable String filename) {
        try {
            Path filePath = Paths.get(appConfig.getOutputDir(), filename);
            
            if (!Files.exists(filePath)) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND)
                        .body(Map.of("error", "FHIR file not found: " + filename));
            }
            
            String content = Files.readString(filePath);
            
            return ResponseEntity.ok()
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(content);
                    
        } catch (IOException e) {
            log.error("Error reading FHIR file: {}", filename, e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Error reading FHIR file: " + e.getMessage()));
        }
    }

    /**
     * Convert HL7 message to FHIR
     */
    @PostMapping("/convert")
    public ResponseEntity<?> convertHl7(
            @RequestBody Map<String, String> request) {
        
        String hl7Content = request.get("hl7");
        String filename = request.getOrDefault("filename", "manual_input_" + UUID.randomUUID() + ".hl7");
        
        if (hl7Content == null || hl7Content.isEmpty()) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", "Missing HL7 message in request body"));
        }
        
        // Perform conversion
        Hl7ToFhirConverter.ConversionResult result = converter.convertHl7ToFhir(hl7Content);
        
        if (!result.isSuccess()) {
            // Log failed conversion
            ConversionLog errorLog = ConversionLog.builder()
                    .originalFilename(filename)
                    .status(ConversionLog.ConversionStatus.ERROR)
                    .errorMessage(result.getErrorMessage())
                    .source(ConversionLog.ConversionSource.API)
                    .timestamp(LocalDateTime.now())
                    .processingTimeMs(result.getProcessingTimeMs())
                    .build();
            
            return ResponseEntity.badRequest()
                    .body(Map.of(
                            "error", "Conversion error",
                            "message", result.getErrorMessage()
                    ));
        }
        
        try {
            // Generate output filename
            String outputFilename = generateOutputFilename(filename);
            Path outputPath = Paths.get(appConfig.getOutputDir(), outputFilename);
            
            // Convert FHIR resources to JSON and save to file
            String fhirJson = converter.convertFhirToJson((Resource) result.getFhir());
            Files.writeString(outputPath, fhirJson);
            
            // Log successful conversion
            ConversionLog log = ConversionLog.builder()
                    .originalFilename(filename)
                    .outputFilename(outputFilename)
                    .status(ConversionLog.ConversionStatus.SUCCESS)
                    .resourceCount(result.getResourceCount())
                    .source(ConversionLog.ConversionSource.API)
                    .timestamp(LocalDateTime.now())
                    .processingTimeMs(result.getProcessingTimeMs())
                    .build();
            
            // Return the conversion result
            Map<String, Object> response = new HashMap<>();
            response.put("message", "Conversion successful");
            response.put("conversionId", log.getId());
            response.put("outputFilename", outputFilename);
            response.put("fhir", result.getFhir());
            
            return ResponseEntity.ok(response);
            
        } catch (IOException e) {
            log.error("Error saving FHIR output", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Error saving FHIR output: " + e.getMessage()));
        }
    }

    /**
     * Upload an HL7 file for processing
     */
    @PostMapping("/upload")
    public ResponseEntity<?> uploadHl7File(
            @RequestParam("file") MultipartFile file) {
        
        if (file.isEmpty()) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", "Uploaded file is empty"));
        }
        
        String originalFilename = file.getOriginalFilename();
        if (originalFilename == null) {
            originalFilename = "uploaded_file_" + UUID.randomUUID() + ".hl7";
        }
        
        try {
            // Save the uploaded file to the input directory
            Path inputPath = Paths.get(appConfig.getInputDir(), originalFilename);
            file.transferTo(inputPath);
            
            log.info("Saved uploaded HL7 file: {}", inputPath);
            
            return ResponseEntity.ok(Map.of(
                    "message", "File uploaded successfully. It will be processed by the file monitor.",
                    "filename", originalFilename
            ));
            
        } catch (IOException e) {
            log.error("Error saving uploaded file", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Error saving uploaded file: " + e.getMessage()));
        }
    }
    
    /**
     * Upload HL7 content directly (for use with the React frontend)
     */
    @PostMapping("/upload-content")
    public ResponseEntity<?> uploadHl7Content(
            @RequestBody Map<String, String> request) {
        
        String fileContent = request.get("fileContent");
        String filename = request.getOrDefault("filename", "manual_upload_" + UUID.randomUUID() + ".hl7");
        
        if (fileContent == null || fileContent.isEmpty()) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", "Missing file content in request body"));
        }
        
        try {
            // Save the content to the input directory
            Path inputPath = Paths.get(appConfig.getInputDir(), filename);
            Files.writeString(inputPath, fileContent);
            
            log.info("Saved uploaded HL7 content to file: {}", inputPath);
            
            return ResponseEntity.ok(Map.of(
                    "message", "File uploaded successfully. It will be processed by the file monitor.",
                    "filename", filename
            ));
            
        } catch (IOException e) {
            log.error("Error saving uploaded content", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Error saving uploaded content: " + e.getMessage()));
        }
    }

    /**
     * Generate a unique output filename for the FHIR result
     */
    private String generateOutputFilename(String originalFilename) {
        String baseName = originalFilename;
        int dotIndex = originalFilename.lastIndexOf('.');
        if (dotIndex > 0) {
            baseName = originalFilename.substring(0, dotIndex);
        }
        return baseName + "_" + UUID.randomUUID().toString() + ".json";
    }
}