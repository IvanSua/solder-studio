package com.tiendaropa.security;

import com.tiendaropa.config.properties.ApplicationProperties;
import com.tiendaropa.entity.User;
import com.tiendaropa.exception.BusinessException;
import com.tiendaropa.repository.UserRepository;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.security.web.authentication.SimpleUrlAuthenticationSuccessHandler;
import org.springframework.stereotype.Component;

import java.io.IOException;

/**
 * After a successful Google OAuth2 login, generates a short-lived one-time code
 * and redirects the browser back to the frontend.
 *
 * The frontend exchanges the code for real JWT tokens via POST /api/v1/auth/oauth-exchange.
 * This avoids exposing the JWT in the browser history, server logs, and Referer headers.
 *
 * Example redirect: https://solderstudio.com.ar/oauth-callback?code=<uuid>
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class OAuth2AuthenticationSuccessHandler extends SimpleUrlAuthenticationSuccessHandler {

    private final UserRepository userRepository;
    private final ApplicationProperties appProperties;
    private final OAuthCodeStore oAuthCodeStore;

    @Override
    public void onAuthenticationSuccess(HttpServletRequest request,
                                        HttpServletResponse response,
                                        Authentication authentication) throws IOException {
        OAuth2User oAuth2User = (OAuth2User) authentication.getPrincipal();

        Long localUserId = (Long) oAuth2User.getAttribute("localUserId");
        if (localUserId == null) {
            response.sendError(HttpServletResponse.SC_INTERNAL_SERVER_ERROR, "OAuth user not mapped");
            return;
        }

        userRepository.findById(localUserId)
                .orElseThrow(() -> new BusinessException("User not found", HttpStatus.NOT_FOUND));

        String code = oAuthCodeStore.generateCode(localUserId);
        String redirectUrl = appProperties.frontendUrl() + "/oauth-callback?code=" + code;

        log.info("OAuth2 login successful for userId={}, issuing one-time code", localUserId);
        getRedirectStrategy().sendRedirect(request, response, redirectUrl);
    }
}
