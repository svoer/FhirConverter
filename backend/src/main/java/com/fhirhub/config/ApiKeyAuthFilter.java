package com.fhirhub.config;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import javax.servlet.FilterChain;
import javax.servlet.ServletException;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.io.IOException;

/**
 * Filter to validate API key for API requests
 */
@Component
public class ApiKeyAuthFilter extends OncePerRequestFilter {

    @Autowired
    private AppConfig appConfig;

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {
        
        // Only apply filter to /api/* endpoints
        if (!request.getRequestURI().startsWith("/api/")) {
            filterChain.doFilter(request, response);
            return;
        }

        // Get API key from header or query parameter
        String apiKey = request.getHeader("X-API-Key");
        if (apiKey == null || apiKey.isEmpty()) {
            apiKey = request.getParameter("apiKey");
        }

        // Validate API key
        if (apiKey == null || !apiKey.equals(appConfig.getApiKey())) {
            response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
            response.setContentType("application/json");
            response.getWriter().write("{\"error\":\"Unauthorized\",\"message\":\"Invalid or missing API key\"}");
            return;
        }

        // API key is valid, proceed with the request
        filterChain.doFilter(request, response);
    }
}