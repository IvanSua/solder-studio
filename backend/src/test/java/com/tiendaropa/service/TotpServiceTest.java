package com.tiendaropa.service;

import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.RepeatedTest;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.*;

/**
 * Unit tests for TotpService.
 * No Spring context needed — TotpService has zero dependencies.
 */
class TotpServiceTest {

    private final TotpService totpService = new TotpService();

    // ── generateSecret ────────────────────────────────────────────────────────

    @Nested
    class GenerateSecret {

        @Test
        void returnsBase32EncodedString() {
            String secret = totpService.generateSecret();
            assertThat(secret).isNotNull().isNotBlank();
            // Base32 charset only
            assertThat(secret).matches("[A-Z2-7]+");
        }

        @Test
        void secretLengthMatchesExpected() {
            // 20 bytes → 32 Base32 chars
            String secret = totpService.generateSecret();
            assertThat(secret).hasSizeGreaterThanOrEqualTo(30);
        }

        @RepeatedTest(5)
        void eachCallReturnsUniqueSecret() {
            String s1 = totpService.generateSecret();
            String s2 = totpService.generateSecret();
            assertThat(s1).isNotEqualTo(s2);
        }
    }

    // ── buildOtpAuthUri ───────────────────────────────────────────────────────

    @Nested
    class BuildOtpAuthUri {

        @Test
        void uriContainsExpectedComponents() {
            String secret = totpService.generateSecret();
            String uri = totpService.buildOtpAuthUri("test@solder.com", secret);

            assertThat(uri).startsWith("otpauth://totp/");
            assertThat(uri).contains("secret=" + secret);
            assertThat(uri).contains("issuer=");
            assertThat(uri).contains("digits=6");
            assertThat(uri).contains("period=30");
        }

        @Test
        void uriEncodesAtSignInEmail() {
            String uri = totpService.buildOtpAuthUri("user@test.com", "AAAA");
            assertThat(uri).contains("%40");
            assertThat(uri).doesNotContain("user@test.com");
        }
    }

    // ── verifyCode ────────────────────────────────────────────────────────────

    @Nested
    class VerifyCode {

        @Test
        void nullSecretReturnsFalse() {
            assertThat(totpService.verifyCode(null, "123456")).isFalse();
        }

        @Test
        void nullCodeReturnsFalse() {
            assertThat(totpService.verifyCode(totpService.generateSecret(), null)).isFalse();
        }

        @Test
        void shortCodeReturnsFalse() {
            assertThat(totpService.verifyCode(totpService.generateSecret(), "12345")).isFalse();
        }

        @Test
        void longCodeReturnsFalse() {
            assertThat(totpService.verifyCode(totpService.generateSecret(), "1234567")).isFalse();
        }

        @Test
        void nonNumericCodeReturnsFalse() {
            assertThat(totpService.verifyCode(totpService.generateSecret(), "12345a")).isFalse();
        }

        @Test
        void invalidBase32SecretReturnsFalse() {
            // Invalid Base32 chars
            assertThat(totpService.verifyCode("INVALID!SECRET!", "123456")).isFalse();
        }

        @Test
        void wrongCodeReturnsFalse() {
            String secret = totpService.generateSecret();
            // Statistically impossible that 000000 is the valid code at this instant
            assertThat(totpService.verifyCode(secret, "000000")).isFalse();
        }

        @Test
        void emptyCodeReturnsFalse() {
            assertThat(totpService.verifyCode(totpService.generateSecret(), "      ")).isFalse();
        }
    }
}
