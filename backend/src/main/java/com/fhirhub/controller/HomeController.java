package com.fhirhub.controller;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

/**
 * Controller for serving the main application page
 */
@Controller
public class HomeController {

    /**
     * Serve the index page
     */
    @GetMapping("/")
    public String index() {
        // Will resolve to src/main/resources/templates/index.html
        return "index";
    }
}