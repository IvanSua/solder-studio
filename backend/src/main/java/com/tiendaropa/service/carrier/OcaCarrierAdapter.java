package com.tiendaropa.service.carrier;

import com.tiendaropa.dto.response.ShippingOptionResponse;
import com.tiendaropa.entity.CarrierConfig;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;
import org.w3c.dom.Document;
import org.w3c.dom.NodeList;

import javax.xml.parsers.DocumentBuilder;
import javax.xml.parsers.DocumentBuilderFactory;
import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * OCA e-Pak carrier adapter — integración SOAP real contra el ambiente QA de OCA.
 *
 * <p>Endpoint QA: https://integraciones.ocadev.com.ar/oep_tracking/Oep_TrackEPak.asmx
 *
 * <p>Operativas consultadas:
 * <ul>
 *   <li>64665 — Puerta a Puerta (2-3 días)</li>
 *   <li>62342 — Puerta a Sucursal (2-3 días)</li>
 * </ul>
 *
 * <p>Credenciales requeridas en CarrierConfig:
 * <ul>
 *   <li>{@code apiUsername}     — email de OCA Empresas</li>
 *   <li>{@code apiPassword}     — contraseña de OCA Empresas</li>
 *   <li>{@code apiClientNumber} — número de cuenta OCA</li>
 *   <li>{@code apiKey}          — CUIT del emisor</li>
 * </ul>
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class OcaCarrierAdapter implements CarrierAdapter {

    private static final String QA_ENDPOINT =
            "https://integraciones.ocadev.com.ar/oep_tracking/Oep_TrackEPak.asmx";

    private static final String SOAP_ACTION =
            "http://www.oca.com.ar/Tarifar_Envio_Corporativo";

    private static final String OCA_NAMESPACE = "http://www.oca.com.ar/";

    /** Operativas a consultar: código → nombre descriptivo de fallback. */
    private static final Map<String, String> OPERATIVAS = Map.of(
            "64665", "Puerta a Puerta",
            "62342", "Puerta a Sucursal"
    );

    private final RestTemplate restTemplate;

    @Override
    public String getCarrierCode() {
        return "OCA";
    }

    @Override
    public boolean isConfigured(CarrierConfig config) {
        return isNotBlank(config.getApiUsername())
                && isNotBlank(config.getApiPassword())
                && isNotBlank(config.getApiClientNumber())
                && isNotBlank(config.getApiKey());
    }

    @Override
    public List<ShippingOptionResponse> calculateRates(
            String originPostalCode,
            String destinationPostalCode,
            CarrierConfig config) {

        List<ShippingOptionResponse> results = new ArrayList<>();

        for (Map.Entry<String, String> entry : OPERATIVAS.entrySet()) {
            String operativaCode = entry.getKey();
            try {
                ShippingOptionResponse option = fetchRate(
                        originPostalCode, destinationPostalCode, config, operativaCode);
                if (option != null) {
                    results.add(option);
                }
            } catch (Exception e) {
                log.error("OCA SOAP call failed for operativa {} — skipping. Reason: {}",
                        operativaCode, e.getMessage());
            }
        }

        return results;
    }

    // ─── internals ────────────────────────────────────────────────────────────

    private ShippingOptionResponse fetchRate(
            String originPostalCode,
            String destinationPostalCode,
            CarrierConfig config,
            String operativa) throws Exception {

        String soapBody = buildSoapEnvelope(originPostalCode, destinationPostalCode, config, operativa);

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.parseMediaType("text/xml; charset=utf-8"));
        headers.set("SOAPAction", "\"" + SOAP_ACTION + "\"");

        HttpEntity<String> request = new HttpEntity<>(soapBody, headers);

        ResponseEntity<String> response = restTemplate.postForEntity(QA_ENDPOINT, request, String.class);

        String responseBody = response.getBody();
        if (responseBody == null || responseBody.isBlank()) {
            log.warn("OCA returned empty response for operativa {}", operativa);
            return null;
        }

        return parseResponse(responseBody, operativa);
    }

    private String buildSoapEnvelope(
            String originPostalCode,
            String destinationPostalCode,
            CarrierConfig config,
            String operativa) {

        return """
                <?xml version="1.0" encoding="utf-8"?>
                <soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"
                               xmlns:tns="%s">
                  <soap:Body>
                    <tns:Tarifar_Envio_Corporativo>
                      <tns:cUsuario>%s</tns:cUsuario>
                      <tns:cContrasena>%s</tns:cContrasena>
                      <tns:nCPOrigen>%s</tns:nCPOrigen>
                      <tns:nCPDestino>%s</tns:nCPDestino>
                      <tns:nBultos>1</tns:nBultos>
                      <tns:nKilos>0.5</tns:nKilos>
                      <tns:nAlto>20</tns:nAlto>
                      <tns:nAncho>15</tns:nAncho>
                      <tns:nLargo>10</tns:nLargo>
                      <tns:nValorDeclarado>5000</tns:nValorDeclarado>
                      <tns:cCuit>%s</tns:cCuit>
                      <tns:nOperativa>%s</tns:nOperativa>
                    </tns:Tarifar_Envio_Corporativo>
                  </soap:Body>
                </soap:Envelope>
                """.formatted(
                OCA_NAMESPACE,
                escapeXml(config.getApiUsername()),
                escapeXml(config.getApiPassword()),
                escapeXml(originPostalCode),
                escapeXml(destinationPostalCode),
                escapeXml(config.getApiKey()),
                escapeXml(operativa)
        );
    }

    private ShippingOptionResponse parseResponse(String xml, String operativaCode) throws Exception {
        DocumentBuilderFactory factory = DocumentBuilderFactory.newInstance();
        factory.setNamespaceAware(true);
        // Hardening contra XXE
        factory.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true);
        factory.setFeature("http://xml.org/sax/features/external-general-entities", false);
        factory.setFeature("http://xml.org/sax/features/external-parameter-entities", false);

        DocumentBuilder builder = factory.newDocumentBuilder();
        Document doc = builder.parse(
                new ByteArrayInputStream(xml.getBytes(StandardCharsets.UTF_8)));

        NodeList tables = doc.getElementsByTagName("Table");
        if (tables.getLength() == 0) {
            log.warn("OCA response has no <Table> element for operativa {}", operativaCode);
            return null;
        }

        // Tomamos el primer <Table> (cada llamada devuelve una sola operativa)
        org.w3c.dom.Element table = (org.w3c.dom.Element) tables.item(0);

        String precioStr = textContent(table, "PrecioTotal");
        String diasStr   = textContent(table, "Dias");
        String descripcion = textContent(table, "Descripcion");

        if (precioStr == null || precioStr.isBlank()) {
            log.warn("OCA: PrecioTotal vacío para operativa {}", operativaCode);
            return null;
        }

        // PrecioTotal viene como "1250.50" — convertir a centavos (long)
        double precioDecimal = Double.parseDouble(precioStr.trim());
        long priceAmount = Math.round(precioDecimal * 100);

        int dias = diasStr != null && !diasStr.isBlank()
                ? Integer.parseInt(diasStr.trim())
                : 3;

        String carrierName = (descripcion != null && !descripcion.isBlank())
                ? "OCA - " + descripcion.trim()
                : "OCA - " + OPERATIVAS.getOrDefault(operativaCode, operativaCode);

        return ShippingOptionResponse.builder()
                .id(null)
                .carrierName(carrierName)
                .priceAmount(priceAmount)
                .deliveryDaysMin(dias)
                .deliveryDaysMax(dias + 1)
                .isFree(false)
                .build();
    }

    private String textContent(org.w3c.dom.Element parent, String tagName) {
        NodeList nodes = parent.getElementsByTagName(tagName);
        if (nodes.getLength() == 0) return null;
        return nodes.item(0).getTextContent();
    }

    private String escapeXml(String value) {
        if (value == null) return "";
        return value
                .replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replace("\"", "&quot;")
                .replace("'", "&apos;");
    }

    private boolean isNotBlank(String value) {
        return value != null && !value.isBlank();
    }
}
