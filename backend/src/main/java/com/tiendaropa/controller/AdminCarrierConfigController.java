package com.tiendaropa.controller;

import com.tiendaropa.entity.CarrierConfig;
import com.tiendaropa.enums.CarrierMode;
import com.tiendaropa.exception.ResourceNotFoundException;
import com.tiendaropa.repository.CarrierConfigRepository;
import com.tiendaropa.service.carrier.CarrierAdapter;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/v1/admin/carriers")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class AdminCarrierConfigController {

    private final CarrierConfigRepository carrierConfigRepository;
    private final List<CarrierAdapter> adapters;

    @GetMapping
    public List<CarrierConfigView> list() {
        Map<String, CarrierAdapter> adapterMap = adapters.stream()
                .collect(Collectors.toMap(CarrierAdapter::getCarrierCode, Function.identity()));

        return carrierConfigRepository.findAll().stream()
                .map(c -> toView(c, adapterMap.get(c.getCarrierCode())))
                .toList();
    }

    @PutMapping("/{code}")
    public CarrierConfigView update(@PathVariable String code,
                                    @RequestBody CarrierConfigUpdate body) {
        CarrierConfig config = carrierConfigRepository.findByCarrierCode(code)
                .orElseThrow(() -> new ResourceNotFoundException("Carrier not found: " + code));

        if (body.mode() != null)            config.setMode(body.mode());
        if (body.enabled() != null)         config.setEnabled(body.enabled());
        if (body.apiUsername() != null)     config.setApiUsername(body.apiUsername().isBlank() ? null : body.apiUsername());
        if (body.apiPassword() != null)     config.setApiPassword(body.apiPassword().isBlank() ? null : body.apiPassword());
        if (body.apiClientNumber() != null) config.setApiClientNumber(body.apiClientNumber().isBlank() ? null : body.apiClientNumber());

        CarrierConfig saved = carrierConfigRepository.save(config);

        Map<String, CarrierAdapter> adapterMap = adapters.stream()
                .collect(Collectors.toMap(CarrierAdapter::getCarrierCode, Function.identity()));
        return toView(saved, adapterMap.get(saved.getCarrierCode()));
    }

    // ── Records ───────────────────────────────────────────────────────────────

    public record CarrierConfigView(
            Long id,
            String carrierCode,
            String carrierName,
            String mode,
            boolean enabled,
            boolean apiConfigured,
            boolean hasUsername,
            boolean hasPassword,
            boolean hasClientNumber
    ) {}

    public record CarrierConfigUpdate(
            CarrierMode mode,
            Boolean enabled,
            String apiUsername,
            String apiPassword,
            String apiClientNumber
    ) {}

    private CarrierConfigView toView(CarrierConfig c, CarrierAdapter adapter) {
        return new CarrierConfigView(
                c.getId(),
                c.getCarrierCode(),
                c.getCarrierName(),
                c.getMode().name(),
                c.isEnabled(),
                adapter != null && adapter.isConfigured(c),
                c.getApiUsername() != null && !c.getApiUsername().isBlank(),
                c.getApiPassword() != null && !c.getApiPassword().isBlank(),
                c.getApiClientNumber() != null && !c.getApiClientNumber().isBlank()
        );
    }
}
