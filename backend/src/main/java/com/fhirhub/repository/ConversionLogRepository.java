package com.fhirhub.repository;

import com.fhirhub.model.ConversionLog;
import com.fhirhub.model.ConversionLog.ConversionStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Repository for accessing conversion logs in the database
 */
@Repository
public interface ConversionLogRepository extends JpaRepository<ConversionLog, Long> {

    /**
     * Find conversions by status
     */
    List<ConversionLog> findByStatus(ConversionStatus status);

    /**
     * Find conversions by status with pagination
     */
    Page<ConversionLog> findByStatus(ConversionStatus status, Pageable pageable);
    
    /**
     * Find conversions in a date range
     */
    List<ConversionLog> findByTimestampBetween(LocalDateTime start, LocalDateTime end);
    
    /**
     * Find conversions by original filename
     */
    List<ConversionLog> findByOriginalFilenameContaining(String filenamePattern);
    
    /**
     * Count conversions by status
     */
    long countByStatus(ConversionStatus status);
    
    /**
     * Get conversion statistics
     */
    @Query("SELECT COUNT(c) as total, " +
           "SUM(CASE WHEN c.status = 'SUCCESS' THEN 1 ELSE 0 END) as successCount, " +
           "SUM(CASE WHEN c.status = 'ERROR' THEN 1 ELSE 0 END) as errorCount " +
           "FROM ConversionLog c")
    Object[] getConversionStats();
}