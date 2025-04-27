package com.fhirhub;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class FhirHubApplication {

    public static void main(String[] args) {
        SpringApplication.run(FhirHubApplication.class, args);
    }
}