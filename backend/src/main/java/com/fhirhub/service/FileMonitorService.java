package com.fhirhub.service;

import com.fhirhub.config.AppConfig;
import com.fhirhub.model.ConversionLog;
import com.fhirhub.repository.ConversionLogRepository;
import lombok.extern.slf4j.Slf4j;
import org.hl7.fhir.r4.model.Resource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import javax.annotation.PostConstruct;
import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.LocalDateTime;
import java.util.Arrays;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Service for monitoring the input directory for HL7 files
 */
@Service
@Slf4j
public class FileMonitorService {

    @Autowired
    private AppConfig appConfig;

    @Autowired
    private Hl7ToFhirConverter converter;

    @Autowired
    private ConversionLogRepository conversionLogRepository;

    private Path inputDirPath;
    private Path outputDirPath;
    private List<String> allowedExtensions;

    @PostConstruct
    public void init() {
        inputDirPath = Paths.get(appConfig.getInputDir());
        outputDirPath = Paths.get(appConfig.getOutputDir());
        
        // Create directories if they don't exist
        try {
            Files.createDirectories(inputDirPath);
            Files.createDirectories(outputDirPath);
            log.info("Monitoring directories initialized - Input: {}, Output: {}", 
                    inputDirPath.toAbsolutePath(), outputDirPath.toAbsolutePath());
        } catch (IOException e) {
            log.error("Error creating monitoring directories", e);
        }
        
        // Parse allowed file extensions
        String extensions = System.getProperty("fhirhub.monitoring.file-extensions", ".hl7,.txt");
        allowedExtensions = Arrays.asList(extensions.split(","));
    }

    /**
     * Periodically scan the input directory for new HL7 files
     */
    @Scheduled(fixedDelayString = "${fhirhub.monitoring.polling-interval-ms:1000}")
    public void scanDirectory() {
        if (!appConfig.isFileMonitoringEnabled()) {
            return;
        }

        try {
            File inputDir = inputDirPath.toFile();
            
            if (!inputDir.exists() || !inputDir.isDirectory()) {
                log.warn("Input directory does not exist or is not a directory: {}", inputDirPath);
                return;
            }
            
            // Get all HL7 files in the input directory
            File[] files = inputDir.listFiles(file -> 
                    file.isFile() && isAllowedExtension(file.getName()));
            
            if (files == null || files.length == 0) {
                return;  // No files to process
            }
            
            log.info("Found {} HL7 files in input directory", files.length);
            
            // Process each file
            for (File file : files) {
                processFile(file);
            }
            
        } catch (Exception e) {
            log.error("Error scanning input directory", e);
        }
    }
    
    /**
     * Check if file has an allowed extension
     */
    private boolean isAllowedExtension(String filename) {
        return allowedExtensions.stream()
                .anyMatch(ext -> filename.toLowerCase().endsWith(ext.toLowerCase()));
    }

    /**
     * Process a single HL7 file
     */
    private void processFile(File file) {
        String filename = file.getName();
        log.info("Processing HL7 file: {}", filename);
        
        try {
            // Read the file content
            String hl7Content = Files.readString(file.toPath());
            
            // Convert HL7 to FHIR
            Hl7ToFhirConverter.ConversionResult result = converter.convertHl7ToFhir(hl7Content);
            
            if (result.isSuccess()) {
                // Generate output filename
                String outputFilename = generateOutputFilename(filename);
                Path outputPath = outputDirPath.resolve(outputFilename);
                
                // Convert FHIR resources to JSON and save to file
                String fhirJson = converter.convertFhirToJson((Resource) result.getFhir());
                Files.writeString(outputPath, fhirJson);
                
                // Log successful conversion to database
                saveConversionLog(filename, outputFilename, result, null);
                
                log.info("Successfully converted HL7 file: {} -> {}", filename, outputFilename);
                
            } else {
                // Log failed conversion to database
                saveConversionLog(filename, null, result, result.getErrorMessage());
                
                log.error("Failed to convert HL7 file: {} - {}", filename, result.getErrorMessage());
            }
            
            // Delete or move the processed file
            Files.delete(file.toPath());
            
        } catch (IOException e) {
            log.error("Error processing HL7 file: {}", filename, e);
            
            // Log error to database
            ConversionLog errorLog = ConversionLog.builder()
                    .originalFilename(filename)
                    .status(ConversionLog.ConversionStatus.ERROR)
                    .errorMessage("I/O error: " + e.getMessage())
                    .source(ConversionLog.ConversionSource.FILE_MONITOR)
                    .timestamp(LocalDateTime.now())
                    .build();
            
            conversionLogRepository.save(errorLog);
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
    
    /**
     * Save conversion log to database
     */
    private void saveConversionLog(String originalFilename, String outputFilename, 
                                  Hl7ToFhirConverter.ConversionResult result, String errorMessage) {
        
        ConversionLog log = ConversionLog.builder()
                .originalFilename(originalFilename)
                .outputFilename(outputFilename)
                .status(result.isSuccess() ? 
                        ConversionLog.ConversionStatus.SUCCESS : 
                        ConversionLog.ConversionStatus.ERROR)
                .errorMessage(errorMessage)
                .resourceCount(result.isSuccess() ? result.getResourceCount() : null)
                .source(ConversionLog.ConversionSource.FILE_MONITOR)
                .timestamp(LocalDateTime.now())
                .processingTimeMs(result.getProcessingTimeMs())
                .build();
        
        conversionLogRepository.save(log);
    }
}