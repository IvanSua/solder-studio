package com.tiendaropa.service;

import com.tiendaropa.dto.request.AddressRequest;
import com.tiendaropa.dto.response.AddressResponse;
import com.tiendaropa.entity.Address;
import com.tiendaropa.entity.User;
import com.tiendaropa.exception.BusinessException;
import com.tiendaropa.exception.ResourceNotFoundException;
import com.tiendaropa.repository.AddressRepository;
import com.tiendaropa.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class AddressService {

    private final AddressRepository addressRepository;
    private final UserRepository userRepository;

    @Transactional(readOnly = true)
    public List<AddressResponse> getAddresses(Long userId) {
        return addressRepository.findByUserId(userId)
                .stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional
    public AddressResponse createAddress(Long userId, AddressRequest request) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));

        // If this is set as default, clear previous default
        if (request.isDefaultAddress()) {
            clearDefaultAddress(userId);
        }

        // If it's the user's first address, make it default automatically
        boolean isFirstAddress = addressRepository.findByUserId(userId).isEmpty();

        Address address = Address.builder()
                .user(user)
                .street(request.getStreet())
                .apartment(request.getApartment())
                .city(request.getCity())
                .province(request.getProvince())
                .postalCode(request.getPostalCode())
                .notes(request.getNotes())
                .defaultAddress(request.isDefaultAddress() || isFirstAddress)
                .build();

        return toResponse(addressRepository.save(address));
    }

    @Transactional
    public AddressResponse updateAddress(Long userId, Long addressId, AddressRequest request) {
        Address address = addressRepository.findByIdAndUserId(addressId, userId)
                .orElseThrow(() -> new ResourceNotFoundException("Address not found"));

        if (request.isDefaultAddress() && !address.isDefaultAddress()) {
            clearDefaultAddress(userId);
        }

        address.setStreet(request.getStreet());
        address.setApartment(request.getApartment());
        address.setCity(request.getCity());
        address.setProvince(request.getProvince());
        address.setPostalCode(request.getPostalCode());
        address.setNotes(request.getNotes());
        address.setDefaultAddress(request.isDefaultAddress());

        return toResponse(addressRepository.save(address));
    }

    @Transactional
    public void deleteAddress(Long userId, Long addressId) {
        Address address = addressRepository.findByIdAndUserId(addressId, userId)
                .orElseThrow(() -> new ResourceNotFoundException("Address not found"));

        if (address.isDefaultAddress()) {
            throw new BusinessException(
                    "No se puede eliminar la dirección predeterminada. Primero asigná otra como predeterminada.",
                    HttpStatus.BAD_REQUEST);
        }

        addressRepository.delete(address);
    }

    @Transactional
    public AddressResponse setDefault(Long userId, Long addressId) {
        Address address = addressRepository.findByIdAndUserId(addressId, userId)
                .orElseThrow(() -> new ResourceNotFoundException("Address not found"));

        clearDefaultAddress(userId);
        address.setDefaultAddress(true);
        return toResponse(addressRepository.save(address));
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    private void clearDefaultAddress(Long userId) {
        addressRepository.findByUserId(userId)
                .stream()
                .filter(Address::isDefaultAddress)
                .forEach(a -> {
                    a.setDefaultAddress(false);
                    addressRepository.save(a);
                });
    }

    private AddressResponse toResponse(Address a) {
        return AddressResponse.builder()
                .id(a.getId())
                .street(a.getStreet())
                .apartment(a.getApartment())
                .city(a.getCity())
                .province(a.getProvince())
                .postalCode(a.getPostalCode())
                .notes(a.getNotes())
                .defaultAddress(a.isDefaultAddress())
                .build();
    }
}
