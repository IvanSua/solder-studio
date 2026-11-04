package com.tiendaropa.shared.util;

/**
 * Detects image MIME types by inspecting the raw file header (magic bytes),
 * not by trusting the Content-Type header sent by the client.
 *
 * <p>Supported formats and their signatures:</p>
 * <ul>
 *   <li>PNG  — starts with {@code 89 50 4E 47 0D 0A 1A 0A}</li>
 *   <li>JPEG — starts with {@code FF D8 FF}</li>
 *   <li>WebP — starts with {@code RIFF????WEBP} (bytes 0-3 and 8-11)</li>
 * </ul>
 */
public final class FileTypeDetector {

    private FileTypeDetector() {}

    /**
     * Inspects the first bytes of a file and returns its MIME type.
     *
     * @param header at least the first 12 bytes of the file
     * @return MIME type string, or {@code null} if the format is unrecognised
     */
    public static String detectMimeType(byte[] header) {
        if (header == null || header.length < 3) {
            return null;
        }

        // ── PNG: 89 50 4E 47 (‰PNG) ──────────────────────────────────────────
        if (header.length >= 4
                && (header[0] & 0xFF) == 0x89
                && (header[1] & 0xFF) == 0x50   // P
                && (header[2] & 0xFF) == 0x4E   // N
                && (header[3] & 0xFF) == 0x47) { // G
            return "image/png";
        }

        // ── JPEG: FF D8 FF ────────────────────────────────────────────────────
        if ((header[0] & 0xFF) == 0xFF
                && (header[1] & 0xFF) == 0xD8
                && (header[2] & 0xFF) == 0xFF) {
            return "image/jpeg";
        }

        // ── WebP: bytes 0-3 = "RIFF", bytes 8-11 = "WEBP" ───────────────────
        if (header.length >= 12
                && header[0] == 'R' && header[1] == 'I'
                && header[2] == 'F' && header[3] == 'F'
                && header[8] == 'W' && header[9] == 'E'
                && header[10] == 'B' && header[11] == 'P') {
            return "image/webp";
        }

        return null;
    }
}
