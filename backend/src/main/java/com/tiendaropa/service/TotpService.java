package com.tiendaropa.service;

import org.springframework.stereotype.Service;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.security.InvalidKeyException;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Instant;

/**
 * TOTP (RFC 6238) implementation — no external libraries required.
 *
 * Algorithm:
 *  1. Decode the Base32 secret.
 *  2. Compute HMAC-SHA1 over the 8-byte big-endian time counter (epoch / 30).
 *  3. Dynamic truncation → 6-digit code.
 *
 * The service accepts codes in a ±1 time-step window to handle clock skew.
 */
@Service
public class TotpService {

    private static final int    TIME_STEP_SECONDS = 30;
    private static final int    DIGITS            = 6;
    private static final int    WINDOW            = 1; // steps to check on each side
    private static final int    SECRET_BYTES      = 20;
    private static final String BASE32_CHARS      = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
    private static final String ISSUER            = "SolderStudio";

    private final SecureRandom random = new SecureRandom();

    // ── Public API ────────────────────────────────────────────────────────────

    /** Generates a new random TOTP secret (Base32-encoded, 20 bytes → 32 chars). */
    public String generateSecret() {
        byte[] bytes = new byte[SECRET_BYTES];
        random.nextBytes(bytes);
        return base32Encode(bytes);
    }

    /**
     * Returns the {@code otpauth://} URI consumed by authenticator apps
     * (Google Authenticator, Authy, etc.).
     */
    public String buildOtpAuthUri(String email, String secret) {
        return "otpauth://totp/"
                + urlEncode(ISSUER + ":" + email)
                + "?secret=" + secret
                + "&issuer=" + urlEncode(ISSUER)
                + "&algorithm=SHA1&digits=" + DIGITS + "&period=" + TIME_STEP_SECONDS;
    }

    /**
     * Validates a 6-digit TOTP code against the secret.
     * Accepts codes within ±WINDOW time steps (±30 s by default).
     *
     * @param secret Base32-encoded secret stored for the user
     * @param code   6-digit code entered by the user (may include leading zeros)
     */
    public boolean verifyCode(String secret, String code) {
        if (secret == null || code == null || code.length() != DIGITS) return false;
        int providedCode;
        try {
            providedCode = Integer.parseInt(code);
        } catch (NumberFormatException e) {
            return false;
        }

        long timeIndex = Instant.now().getEpochSecond() / TIME_STEP_SECONDS;
        byte[] secretBytes;
        try {
            secretBytes = base32Decode(secret);
        } catch (IllegalArgumentException e) {
            return false;
        }

        for (int i = -WINDOW; i <= WINDOW; i++) {
            if (computeTotp(secretBytes, timeIndex + i) == providedCode) {
                return true;
            }
        }
        return false;
    }

    // ── TOTP computation ──────────────────────────────────────────────────────

    private int computeTotp(byte[] secretBytes, long timeIndex) {
        byte[] timeBytes = longToBytes(timeIndex);
        byte[] hash = hmacSha1(secretBytes, timeBytes);

        // Dynamic truncation
        int offset = hash[hash.length - 1] & 0x0F;
        int binary = ((hash[offset]     & 0x7F) << 24)
                   | ((hash[offset + 1] & 0xFF) << 16)
                   | ((hash[offset + 2] & 0xFF) <<  8)
                   |  (hash[offset + 3] & 0xFF);

        int pow10 = 1;
        for (int i = 0; i < DIGITS; i++) pow10 *= 10;
        return binary % pow10;
    }

    private byte[] hmacSha1(byte[] key, byte[] data) {
        try {
            Mac mac = Mac.getInstance("HmacSHA1");
            mac.init(new SecretKeySpec(key, "HmacSHA1"));
            return mac.doFinal(data);
        } catch (NoSuchAlgorithmException | InvalidKeyException e) {
            throw new IllegalStateException("HMAC-SHA1 not available", e);
        }
    }

    private byte[] longToBytes(long value) {
        byte[] result = new byte[8];
        for (int i = 7; i >= 0; i--) {
            result[i] = (byte) (value & 0xFF);
            value >>= 8;
        }
        return result;
    }

    // ── Base32 ────────────────────────────────────────────────────────────────

    private String base32Encode(byte[] data) {
        StringBuilder sb = new StringBuilder();
        int buffer = 0, bitsLeft = 0;
        for (byte b : data) {
            buffer = (buffer << 8) | (b & 0xFF);
            bitsLeft += 8;
            while (bitsLeft >= 5) {
                bitsLeft -= 5;
                sb.append(BASE32_CHARS.charAt((buffer >> bitsLeft) & 0x1F));
            }
        }
        if (bitsLeft > 0) {
            sb.append(BASE32_CHARS.charAt((buffer << (5 - bitsLeft)) & 0x1F));
        }
        return sb.toString();
    }

    private byte[] base32Decode(String input) {
        String cleaned = input.toUpperCase().replaceAll("[^A-Z2-7]", "");
        byte[] result = new byte[(cleaned.length() * 5) / 8];
        int buffer = 0, bitsLeft = 0, idx = 0;
        for (char c : cleaned.toCharArray()) {
            int val = BASE32_CHARS.indexOf(c);
            if (val < 0) throw new IllegalArgumentException("Invalid Base32 character: " + c);
            buffer = (buffer << 5) | val;
            bitsLeft += 5;
            if (bitsLeft >= 8) {
                bitsLeft -= 8;
                result[idx++] = (byte) ((buffer >> bitsLeft) & 0xFF);
            }
        }
        return result;
    }

    private String urlEncode(String s) {
        return s.replace("@", "%40")
                .replace(" ", "%20")
                .replace(":", "%3A");
    }
}
