package com.tiendaropa.controller;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/v1/store")
public class StoreConfigController {

    @Value("${app.store.mp-alias:}")
    private String mpAlias;

    @Value("${app.store.mp-cvu:}")
    private String mpCvu;

    /** Public endpoint — returns store payment config for manual transfer instructions. */
    @GetMapping("/payment-config")
    public Map<String, String> paymentConfig() {
        return Map.of(
                "mpAlias", mpAlias,
                "mpCvu",   mpCvu
        );
    }
}
