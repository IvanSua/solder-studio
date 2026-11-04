package com.tiendaropa.controller;

import com.tiendaropa.dto.request.AddressRequest;
import com.tiendaropa.dto.response.AddressResponse;
import com.tiendaropa.service.AddressService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/addresses")
@RequiredArgsConstructor
public class AddressController {

    private final AddressService addressService;

    @GetMapping
    public List<AddressResponse> getAddresses(Authentication auth) {
        return addressService.getAddresses((Long) auth.getPrincipal());
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public AddressResponse createAddress(Authentication auth,
                                         @Valid @RequestBody AddressRequest request) {
        return addressService.createAddress((Long) auth.getPrincipal(), request);
    }

    @PutMapping("/{addressId}")
    public AddressResponse updateAddress(Authentication auth,
                                          @PathVariable Long addressId,
                                          @Valid @RequestBody AddressRequest request) {
        return addressService.updateAddress((Long) auth.getPrincipal(), addressId, request);
    }

    @DeleteMapping("/{addressId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteAddress(Authentication auth, @PathVariable Long addressId) {
        addressService.deleteAddress((Long) auth.getPrincipal(), addressId);
    }

    @PatchMapping("/{addressId}/default")
    public AddressResponse setDefault(Authentication auth, @PathVariable Long addressId) {
        return addressService.setDefault((Long) auth.getPrincipal(), addressId);
    }
}
