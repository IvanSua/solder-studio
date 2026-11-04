package com.tiendaropa.controller;

import com.tiendaropa.dto.request.ChangePasswordRequest;
import com.tiendaropa.dto.request.SavedSizesRequest;
import com.tiendaropa.dto.request.UpdateProfileRequest;
import com.tiendaropa.dto.response.LoyaltyProfileResponse;
import com.tiendaropa.dto.response.PointTransactionResponse;
import com.tiendaropa.dto.response.SavedSizeResponse;
import com.tiendaropa.dto.response.UserResponse;
import com.tiendaropa.entity.User;
import com.tiendaropa.exception.BusinessException;
import com.tiendaropa.repository.UserRepository;
import com.tiendaropa.service.PointsService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/profile")
@RequiredArgsConstructor
public class ProfileController {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final PointsService pointsService;

    @GetMapping
    public UserResponse getProfile(Authentication auth) {
        User user = loadUser(auth);
        return mapToResponse(user);
    }

    @PutMapping
    @Transactional
    public UserResponse updateProfile(Authentication auth,
                                      @Valid @RequestBody UpdateProfileRequest request) {
        User user = loadUser(auth);
        user.setFirstName(request.getFirstName());
        user.setLastName(request.getLastName());
        user.setPhone(request.getPhone());
        // cuit is optional; null clears it, blank normalised to null
        String cuit = request.getCuit();
        user.setCuit((cuit != null && !cuit.isBlank()) ? cuit.trim() : null);
        return mapToResponse(userRepository.save(user));
    }

    @PutMapping("/password")
    @Transactional
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void changePassword(Authentication auth,
                               @Valid @RequestBody ChangePasswordRequest request) {
        User user = loadUser(auth);

        if (!passwordEncoder.matches(request.getCurrentPassword(), user.getPasswordHash())) {
            throw new BusinessException("Current password is incorrect", HttpStatus.BAD_REQUEST);
        }

        user.setPasswordHash(passwordEncoder.encode(request.getNewPassword()));
        userRepository.save(user);
    }

    // ── Loyalty / Fidelización ────────────────────────────────────────────────

    @GetMapping("/loyalty")
    public LoyaltyProfileResponse getLoyalty(Authentication auth) {
        return pointsService.getLoyalty((Long) auth.getPrincipal());
    }

    @GetMapping("/points-history")
    public Page<PointTransactionResponse> getPointsHistory(
            Authentication auth,
            @PageableDefault(size = 10) Pageable pageable) {
        return pointsService.getHistory((Long) auth.getPrincipal(), pageable);
    }

    @PutMapping("/sizes")
    public List<SavedSizeResponse> saveSizes(
            Authentication auth,
            @Valid @RequestBody SavedSizesRequest request) {
        return pointsService.saveSizes((Long) auth.getPrincipal(), request.getSizes());
    }

    // ── helpers ──────────────────────────────────────────────────────────────

    private User loadUser(Authentication auth) {
        Long userId = (Long) auth.getPrincipal();
        return userRepository.findById(userId)
                .orElseThrow(() -> new BusinessException("User not found", HttpStatus.NOT_FOUND));
    }

    private UserResponse mapToResponse(User user) {
        return UserResponse.builder()
                .id(user.getId())
                .email(user.getEmail())
                .firstName(user.getFirstName())
                .lastName(user.getLastName())
                .phone(user.getPhone())
                .cuit(user.getCuit())
                .role(user.getRole().name())
                .enabled(user.isEnabled())
                .emailVerified(user.isEmailVerified())
                .twoFactorEnabled(user.isTwoFactorEnabled())
                .createdAt(user.getCreatedAt())
                .build();
    }
}
