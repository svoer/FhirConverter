package com.fhirhub.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import javax.persistence.*;
import java.time.LocalDateTime;

/**
 * Entity class for storing HL7 to FHIR conversion logs
 */
@Entity
@Table(name = "conversion_logs")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ConversionLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /**
     * Original filename of the HL7 message
     */
    @Column(nullable = false)
    private String originalFilename;

    /**
     * Output filename where the FHIR result is stored
     */
    private String outputFilename;

    /**
     * Conversion status: SUCCESS or ERROR
     */
    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private ConversionStatus status;

    /**
     * Error message if conversion failed
     */
    @Column(length = 1000)
    private String errorMessage;

    /**
     * Number of FHIR resources created
     */
    private Integer resourceCount;

    /**
     * Source of the conversion request (FILE_MONITOR, API, etc.)
     */
    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private ConversionSource source;

    /**
     * Timestamp when conversion occurred
     */
    @Column(nullable = false)
    private LocalDateTime timestamp;

    /**
     * Conversion processing time in milliseconds
     */
    private Long processingTimeMs;

    /**
     * Possible conversion statuses
     */
    public enum ConversionStatus {
        SUCCESS, ERROR
    }

    /**
     * Possible conversion sources
     */
    public enum ConversionSource {
        FILE_MONITOR, API, MANUAL
    }
}