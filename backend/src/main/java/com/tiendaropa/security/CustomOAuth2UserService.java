package com.tiendaropa.security;

import com.tiendaropa.entity.User;
import com.tiendaropa.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.oauth2.client.userinfo.DefaultOAuth2UserService;
import org.springframework.security.oauth2.client.userinfo.OAuth2UserRequest;
import org.springframework.security.oauth2.core.OAuth2AuthenticationException;
import org.springframework.security.oauth2.core.user.DefaultOAuth2User;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.util.Locale;
import java.util.Map;

/**
 * Loads or creates a local User when Google or Facebook OAuth2 authentication succeeds.
 *
 * Flow:
 *  1. Provider redirects to /login/oauth2/code/{provider}
 *  2. Spring Security calls loadUser() here
 *  3. We find or create a User record keyed by email
 *  4. Our OAuth2SuccessHandler then issues a JWT and redirects to the frontend
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class CustomOAuth2UserService extends DefaultOAuth2UserService {

    private static final String REFERRAL_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    private static final SecureRandom SECURE_RANDOM = new SecureRandom();

    private final UserRepository userRepository;

    @Override
    @Transactional
    public OAuth2User loadUser(OAuth2UserRequest userRequest) throws OAuth2AuthenticationException {
        OAuth2User oAuth2User = super.loadUser(userRequest);

        String provider = userRequest.getClientRegistration().getRegistrationId();
        String email;
        String firstName;
        String lastName;
        String name;

        if ("facebook".equalsIgnoreCase(provider)) {
            // Facebook uses different attribute names
            email     = oAuth2User.getAttribute("email");
            firstName = oAuth2User.getAttribute("first_name");
            lastName  = oAuth2User.getAttribute("last_name");
            name      = oAuth2User.getAttribute("name");
        } else {
            // Google uses standard OAuth2 attribute names
            email     = oAuth2User.getAttribute("email");
            firstName = oAuth2User.getAttribute("given_name");
            lastName  = oAuth2User.getAttribute("family_name");
            name      = oAuth2User.getAttribute("name");
        }

        if (email == null) {
            throw new OAuth2AuthenticationException(provider + " account has no email address");
        }

        // Normalize name fallback
        if (firstName == null) {
            firstName = (name != null && name.contains(" "))
                    ? name.substring(0, name.indexOf(' '))
                    : (name != null ? name : "Usuario");
        }
        if (lastName == null) {
            lastName = (name != null && name.contains(" "))
                    ? name.substring(name.indexOf(' ') + 1)
                    : "";
        }

        final String finalFirstName = firstName;
        final String finalLastName  = lastName;

        User user = userRepository.findByEmail(email).orElseGet(() -> {
            log.info("Creating new user from {} OAuth: {}", provider, email);
            User newUser = User.builder()
                    .email(email)
                    .passwordHash("")          // no password for OAuth users
                    .firstName(finalFirstName)
                    .lastName(finalLastName)
                    .emailVerified(true)       // OAuth provider already verified the email
                    .referralCode(generateReferralCode(finalFirstName))
                    .build();
            return userRepository.save(newUser);
        });

        // Update name from OAuth provider if it changed
        if (!user.getFirstName().equals(finalFirstName) || !user.getLastName().equals(finalLastName)) {
            user.setFirstName(finalFirstName);
            user.setLastName(finalLastName);
            userRepository.save(user);
        }

        // Store the local user ID as an attribute so the success handler can read it
        Map<String, Object> attrs = new java.util.HashMap<>(oAuth2User.getAttributes());
        attrs.put("localUserId", user.getId());

        return new DefaultOAuth2User(oAuth2User.getAuthorities(), attrs, "email");
    }

    private String generateReferralCode(String firstName) {
        String prefix = firstName.replaceAll("[^A-Za-z]", "")
                .toUpperCase(Locale.ROOT);
        prefix = prefix.substring(0, Math.min(3, prefix.length()));
        if (prefix.length() < 3) prefix = (prefix + "XXX").substring(0, 3);

        StringBuilder sb = new StringBuilder(prefix);
        for (int i = 0; i < 6; i++) {
            sb.append(REFERRAL_ALPHABET.charAt(SECURE_RANDOM.nextInt(REFERRAL_ALPHABET.length())));
        }
        return sb.toString();
    }
}
