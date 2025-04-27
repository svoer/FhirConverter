package com.fhirhub.service;

import com.fhirhub.model.ConversionLog;
import com.fhirhub.repository.ConversionLogRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;

import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

/**
 * Service for managing conversion logs
 */
@Service
@Slf4j
public class ConversionLogService {

    @Autowired
    private ConversionLogRepository conversionLogRepository;

    /**
     * Get all conversion logs with pagination
     * 
     * @param page Page number (0-based)
     * @param size Page size
     * @return Page of conversion logs
     */
    public Page<ConversionLog> getConversionLogs(int page, int size) {
        Pageable pageable = PageRequest.of(page, size, Sort.by("timestamp").descending());
        return conversionLogRepository.findAll(pageable);
    }

    /**
     * Get a specific conversion log by ID
     * 
     * @param id Conversion log ID
     * @return Optional containing the conversion log, or empty if not found
     */
    public Optional<ConversionLog> getConversionLog(Long id) {
        return conversionLogRepository.findById(id);
    }

    /**
     * Get conversion statistics
     * 
     * @return Map containing conversion statistics
     */
    public Map<String, Object> getConversionStats() {
        Map<String, Object> stats = new HashMap<>();
        
        try {
            Object[] rawStats = conversionLogRepository.getConversionStats();
            
            if (rawStats != null && rawStats.length >= 3) {
                long total = ((Number) rawStats[0]).longValue();
                long success = ((Number) rawStats[1]).longValue();
                long error = ((Number) rawStats[2]).longValue();
                
                stats.put("total", total);
                stats.put("success", success);
                stats.put("error", error);
                stats.put("successRate", total > 0 ? 
                        String.format("%.2f%%", (success * 100.0 / total)) : "0%");
            } else {
                // Fallback to count queries if the specialized query doesn't work
                long total = conversionLogRepository.count();
                long success = conversionLogRepository.countByStatus(ConversionLog.ConversionStatus.SUCCESS);
                long error = conversionLogRepository.countByStatus(ConversionLog.ConversionStatus.ERROR);
                
                stats.put("total", total);
                stats.put("success", success);
                stats.put("error", error);
                stats.put("successRate", total > 0 ? 
                        String.format("%.2f%%", (success * 100.0 / total)) : "0%");
            }
        } catch (Exception e) {
            log.error("Error getting conversion statistics", e);
            stats.put("total", 0);
            stats.put("success", 0);
            stats.put("error", 0);
            stats.put("successRate", "0%");
        }
        
        return stats;
    }
}