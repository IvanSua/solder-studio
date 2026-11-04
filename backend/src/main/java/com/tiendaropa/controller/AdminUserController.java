package com.tiendaropa.controller;

import com.tiendaropa.dto.response.UserResponse;
import com.tiendaropa.entity.User;
import com.tiendaropa.enums.UserRole;
import com.tiendaropa.exception.ResourceNotFoundException;
import com.tiendaropa.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/v1/admin/users")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class AdminUserController {

    private final UserRepository userRepository;

    @GetMapping
    public Page<UserResponse> listAll(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {

        return userRepository
                .findAll(PageRequest.of(page, size, Sort.by("createdAt").descending()))
                .map(this::mapToResponse);
    }

    @PatchMapping("/{id}/role")
    @Transactional
    public UserResponse updateRole(@PathVariable Long id,
                                   @RequestBody Map<String, String> body) {
        User user = loadUser(id);
        UserRole newRole = UserRole.valueOf(body.get("role").toUpperCase());
        user.setRole(newRole);
        return mapToResponse(userRepository.save(user));
    }

    @PatchMapping("/{id}/enabled")
    @Transactional
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void toggleEnabled(@PathVariable Long id,
                              @RequestBody Map<String, Boolean> body) {
        User user = loadUser(id);
        user.setEnabled(body.get("enabled"));
        userRepository.save(user);
    }

    // ── helpers ──────────────────────────────────────────────────────────────

    private User loadUser(Long id) {
        return userRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("User not found: " + id));
    }

    private UserResponse mapToResponse(User u) {
        return UserResponse.builder()
                .id(u.getId())
                .email(u.getEmail())
                .firstName(u.getFirstName())
                .lastName(u.getLastName())
                .phone(u.getPhone())
                .role(u.getRole().name())
                .enabled(u.isEnabled())
                .createdAt(u.getCreatedAt())
                .build();
    }
}
