package com.fhirhub.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import ca.uhn.hl7v2.DefaultHapiContext;
import ca.uhn.hl7v2.HapiContext;

@Configuration
public class AppConfig {

    @Value("${fhirhub.api.key}")
    private String apiKey;

    @Value("${fhirhub.paths.input-dir}")
    private String inputDir;

    @Value("${fhirhub.paths.output-dir}")
    private String outputDir;

    @Value("${fhirhub.monitoring.enabled}")
    private boolean fileMonitoringEnabled;

    @Value("${fhirhub.monitoring.polling-interval-ms}")
    private long fileMonitoringInterval;

    /**
     * CORS configuration to allow the React frontend to access the API
     */
    @Bean
    public WebMvcConfigurer corsConfigurer() {
        return new WebMvcConfigurer() {
            @Override
            public void addCorsMappings(CorsRegistry registry) {
                registry.addMapping("/api/**")
                        .allowedOrigins("*")
                        .allowedMethods("GET", "POST", "PUT", "DELETE")
                        .allowedHeaders("*");
            }
        };
    }

    /**
     * HAPI Context for parsing HL7 messages
     */
    @Bean
    public HapiContext hapiContext() {
        return new DefaultHapiContext();
    }

    // Getters for configuration values

    public String getApiKey() {
        return apiKey;
    }

    public String getInputDir() {
        return inputDir;
    }

    public String getOutputDir() {
        return outputDir;
    }

    public boolean isFileMonitoringEnabled() {
        return fileMonitoringEnabled;
    }

    public long getFileMonitoringInterval() {
        return fileMonitoringInterval;
    }
}