package com.tiendaropa.service;

import com.lowagie.text.*;
import com.lowagie.text.pdf.*;
import com.lowagie.text.pdf.draw.LineSeparator;
import com.tiendaropa.entity.Order;
import com.tiendaropa.entity.OrderItem;
import com.tiendaropa.exception.BusinessException;
import com.tiendaropa.exception.ResourceNotFoundException;
import com.tiendaropa.repository.OrderRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.awt.Color;
import java.io.ByteArrayOutputStream;
import java.text.NumberFormat;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.Locale;

@Service
@RequiredArgsConstructor
public class InvoiceService {

    private final OrderRepository orderRepository;

    private static final String BRAND_NAME    = "Solder Studio";
    private static final Color  BLUE          = new Color(37, 99, 235);
    private static final Color  LIGHT_GRAY    = new Color(249, 250, 251);
    private static final Color  MED_GRAY      = new Color(229, 231, 235);
    private static final Color  TEXT_DARK     = new Color(17, 24, 39);
    private static final Color  TEXT_MUTED    = new Color(107, 114, 128);
    private static final DateTimeFormatter DATE_FMT =
            DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm").withZone(ZoneId.of("America/Argentina/Buenos_Aires"));

    @Transactional(readOnly = true)
    public byte[] generate(Long userId, Long orderId) {
        Order order = orderRepository.findByIdAndUserId(orderId, userId)
                .orElseThrow(() -> new ResourceNotFoundException("Order not found"));
        return buildPdf(order);
    }

    // ── PDF builder ────────────────────────────────────────────────────────────

    private byte[] buildPdf(Order order) {
        try (ByteArrayOutputStream baos = new ByteArrayOutputStream()) {

            Document doc = new Document(PageSize.A4, 50, 50, 60, 60);
            PdfWriter.getInstance(doc, baos);
            doc.open();

            Font titleFont    = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 22, BLUE);
            Font headingFont  = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 11, TEXT_DARK);
            Font labelFont    = FontFactory.getFont(FontFactory.HELVETICA_BOLD,  9, TEXT_MUTED);
            Font valueFont    = FontFactory.getFont(FontFactory.HELVETICA,       9, TEXT_DARK);
            Font tablHead     = FontFactory.getFont(FontFactory.HELVETICA_BOLD,  9, Color.WHITE);
            Font tablCell     = FontFactory.getFont(FontFactory.HELVETICA,       9, TEXT_DARK);
            Font totalLabel   = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 10, TEXT_DARK);
            Font grandTotal   = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 12, BLUE);
            Font footFont     = FontFactory.getFont(FontFactory.HELVETICA,       8, TEXT_MUTED);

            // ── Header bar ──────────────────────────────────────────────────
            PdfPTable header = new PdfPTable(2);
            header.setWidthPercentage(100);
            header.setWidths(new float[]{3f, 2f});
            header.setSpacingAfter(20);

            PdfPCell brandCell = new PdfPCell();
            brandCell.setBorder(Rectangle.NO_BORDER);
            brandCell.setPadding(12);
            brandCell.setBackgroundColor(BLUE);
            Paragraph brandPara = new Paragraph(BRAND_NAME, titleFont);
            brandPara.setAlignment(Element.ALIGN_LEFT);
            brandCell.addElement(brandPara);
            Paragraph subBrand = new Paragraph("Ropa personalizada · Argentina", footFont);
            subBrand.getFont().setColor(new Color(191, 219, 254));
            brandCell.addElement(subBrand);
            header.addCell(brandCell);

            PdfPCell invoiceCell = new PdfPCell();
            invoiceCell.setBorder(Rectangle.NO_BORDER);
            invoiceCell.setPadding(12);
            invoiceCell.setBackgroundColor(new Color(239, 246, 255));
            invoiceCell.setHorizontalAlignment(Element.ALIGN_RIGHT);
            Font invoiceFont = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 14, TEXT_DARK);
            Paragraph invoicePara = new Paragraph("COMPROBANTE DE COMPRA", invoiceFont);
            invoicePara.setAlignment(Element.ALIGN_RIGHT);
            invoiceCell.addElement(invoicePara);
            Paragraph orderNumPara = new Paragraph("Pedido #" + order.getId(), headingFont);
            orderNumPara.setAlignment(Element.ALIGN_RIGHT);
            invoiceCell.addElement(orderNumPara);
            Font dateFont = FontFactory.getFont(FontFactory.HELVETICA, 9, TEXT_MUTED);
            Paragraph datePara = new Paragraph(DATE_FMT.format(order.getCreatedAt()), dateFont);
            datePara.setAlignment(Element.ALIGN_RIGHT);
            invoiceCell.addElement(datePara);
            header.addCell(invoiceCell);
            doc.add(header);

            // ── Customer + Shipping info row ─────────────────────────────────
            PdfPTable infoRow = new PdfPTable(2);
            infoRow.setWidthPercentage(100);
            infoRow.setWidths(new float[]{1f, 1f});
            infoRow.setSpacingAfter(16);

            // Customer info
            PdfPCell custCell = infoCell("CLIENTE", LIGHT_GRAY);
            String custName = order.getUser().getFirstName() + " " + order.getUser().getLastName();
            addLabelValue(custCell, labelFont, valueFont, "Nombre", custName);
            addLabelValue(custCell, labelFont, valueFont, "Email", order.getUser().getEmail());
            infoRow.addCell(custCell);

            // Shipping info
            PdfPCell shipCell = infoCell("ENVÍO", LIGHT_GRAY);
            if (order.getShippingAddress() != null) {
                var addr = order.getShippingAddress();
                String street = addr.getStreet() + (addr.getApartment() != null ? ", " + addr.getApartment() : "");
                addLabelValue(shipCell, labelFont, valueFont, "Dirección", street);
                addLabelValue(shipCell, labelFont, valueFont, "Ciudad", addr.getCity() + ", " + addr.getProvince());
                if (addr.getPostalCode() != null) {
                    addLabelValue(shipCell, labelFont, valueFont, "CP", addr.getPostalCode());
                }
            } else {
                Paragraph noop = new Paragraph("Sin dirección registrada", valueFont);
                shipCell.addElement(noop);
            }
            infoRow.addCell(shipCell);
            doc.add(infoRow);

            // ── Items table ─────────────────────────────────────────────────
            PdfPTable items = new PdfPTable(4);
            items.setWidthPercentage(100);
            items.setWidths(new float[]{5f, 2f, 2f, 2f});
            items.setSpacingAfter(0);

            // Table header
            String[] headers = {"Producto", "Variante", "Cant.", "Subtotal"};
            for (String h : headers) {
                PdfPCell th = new PdfPCell(new Phrase(h, tablHead));
                th.setBackgroundColor(BLUE);
                th.setPadding(8);
                th.setBorder(Rectangle.NO_BORDER);
                items.addCell(th);
            }

            // Table rows
            boolean alt = false;
            for (OrderItem item : order.getItems()) {
                Color rowBg = alt ? new Color(243, 244, 246) : Color.WHITE;
                alt = !alt;

                PdfPCell nameCell = styledCell(item.getProductName(), tablCell, rowBg);
                nameCell.setPaddingLeft(8);
                items.addCell(nameCell);

                String variant = nullSafe(item.getVariantColor()) + " / " + nullSafe(item.getVariantSize());
                items.addCell(styledCell(variant, tablCell, rowBg));
                items.addCell(styledCell(String.valueOf(item.getQuantity()), tablCell, rowBg));

                long lineTotal = item.getUnitPriceAmount() * item.getQuantity();
                items.addCell(styledCell(formatMoney(lineTotal, order.getCurrencyCode()), tablCell, rowBg));
            }

            // Bottom border row
            for (int i = 0; i < 4; i++) {
                PdfPCell borderCell = new PdfPCell(new Phrase(""));
                borderCell.setBorder(Rectangle.BOTTOM);
                borderCell.setBorderColor(MED_GRAY);
                borderCell.setBorderWidthBottom(1f);
                borderCell.setPadding(0);
                items.addCell(borderCell);
            }
            doc.add(items);

            // ── Totals ──────────────────────────────────────────────────────
            PdfPTable totals = new PdfPTable(2);
            totals.setWidthPercentage(45);
            totals.setHorizontalAlignment(Element.ALIGN_RIGHT);
            totals.setSpacingBefore(8);
            totals.setSpacingAfter(20);

            String curr = order.getCurrencyCode();
            addTotalRow(totals, "Subtotal",  formatMoney(order.getSubtotalAmount(), curr), totalLabel, valueFont, Color.WHITE);
            if (order.getDiscountAmount() != null && order.getDiscountAmount() > 0) {
                Font discountFont = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 10, new Color(22, 163, 74));
                addTotalRow(totals, "Descuento", "- " + formatMoney(order.getDiscountAmount(), curr), totalLabel, discountFont, Color.WHITE);
            }
            if (order.getTaxAmount() != null && order.getTaxAmount() > 0) {
                addTotalRow(totals, "Impuestos", formatMoney(order.getTaxAmount(), curr), totalLabel, valueFont, Color.WHITE);
            }
            if (order.getShippingAmount() != null && order.getShippingAmount() > 0) {
                addTotalRow(totals, "Envío", formatMoney(order.getShippingAmount(), curr), totalLabel, valueFont, Color.WHITE);
            }
            addTotalRow(totals, "TOTAL", formatMoney(order.getTotalAmount(), curr), grandTotal, grandTotal, new Color(239, 246, 255));
            doc.add(totals);

            // ── Payment info ────────────────────────────────────────────────
            if (order.getPaymentMethod() != null) {
                Font payLabel = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 9, TEXT_MUTED);
                Font payValue = FontFactory.getFont(FontFactory.HELVETICA, 9, TEXT_DARK);
                Paragraph payPara = new Paragraph();
                payPara.add(new Chunk("Método de pago: ", payLabel));
                String method = humanizePayment(order.getPaymentMethod(), order.getInstallments());
                payPara.add(new Chunk(method, payValue));
                payPara.setSpacingAfter(4);
                doc.add(payPara);
            }

            // Status badge text
            Paragraph statusPara = new Paragraph();
            Font statusLabel = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 9, TEXT_MUTED);
            Font statusValue = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 9, statusColor(order.getStatus().name()));
            statusPara.add(new Chunk("Estado: ", statusLabel));
            statusPara.add(new Chunk(humanizeStatus(order.getStatus().name()), statusValue));
            statusPara.setSpacingAfter(16);
            doc.add(statusPara);

            // ── Footer ───────────────────────────────────────────────────────
            LineSeparator sep = new LineSeparator(0.5f, 100, MED_GRAY, Element.ALIGN_CENTER, -3);
            doc.add(new Chunk(sep));
            Paragraph footer = new Paragraph(
                    BRAND_NAME + " · solderstudio.com.ar · hola@solderstudio.com.ar\n" +
                    "Gracias por tu compra. Ante cualquier consulta no dudes en contactarnos.", footFont);
            footer.setAlignment(Element.ALIGN_CENTER);
            footer.setSpacingBefore(8);
            doc.add(footer);

            doc.close();
            return baos.toByteArray();

        } catch (Exception e) {
            throw new BusinessException("Error generating invoice PDF", HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    // ── Layout helpers ─────────────────────────────────────────────────────────

    private PdfPCell infoCell(String sectionTitle, Color bg) {
        PdfPCell cell = new PdfPCell();
        cell.setBorder(Rectangle.NO_BORDER);
        cell.setPadding(12);
        cell.setPaddingTop(10);
        cell.setBackgroundColor(bg);
        Font sectionFont = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 8, TEXT_MUTED);
        Paragraph title = new Paragraph(sectionTitle, sectionFont);
        title.setSpacingAfter(4);
        cell.addElement(title);
        return cell;
    }

    private void addLabelValue(PdfPCell cell, Font labelFont, Font valueFont, String label, String value) {
        Paragraph p = new Paragraph();
        p.add(new Chunk(label + ": ", labelFont));
        p.add(new Chunk(value != null ? value : "—", valueFont));
        p.setSpacingAfter(2);
        cell.addElement(p);
    }

    private PdfPCell styledCell(String text, Font font, Color bg) {
        PdfPCell cell = new PdfPCell(new Phrase(text, font));
        cell.setBorder(Rectangle.NO_BORDER);
        cell.setBackgroundColor(bg);
        cell.setPadding(7);
        return cell;
    }

    private void addTotalRow(PdfPTable table, String label, String value, Font labelFont, Font valueFont, Color bg) {
        PdfPCell lc = new PdfPCell(new Phrase(label, labelFont));
        lc.setBorder(Rectangle.NO_BORDER);
        lc.setBackgroundColor(bg);
        lc.setPadding(6);
        lc.setPaddingLeft(10);
        table.addCell(lc);

        PdfPCell vc = new PdfPCell(new Phrase(value, valueFont));
        vc.setBorder(Rectangle.NO_BORDER);
        vc.setBackgroundColor(bg);
        vc.setPadding(6);
        vc.setPaddingRight(10);
        vc.setHorizontalAlignment(Element.ALIGN_RIGHT);
        table.addCell(vc);
    }

    // ── Formatting helpers ─────────────────────────────────────────────────────

    private String formatMoney(long centavos, String currency) {
        double amount = centavos / 100.0;
        NumberFormat nf = NumberFormat.getInstance(new Locale("es", "AR"));
        nf.setMinimumFractionDigits(2);
        nf.setMaximumFractionDigits(2);
        return currency + " " + nf.format(amount);
    }

    private String humanizePayment(String method, Integer installments) {
        String base = switch (method.toUpperCase()) {
            case "MERCADOPAGO" -> "MercadoPago";
            case "TRANSFER"    -> "Transferencia bancaria";
            case "CASH"        -> "Efectivo";
            default            -> method;
        };
        if ("MERCADOPAGO".equalsIgnoreCase(method) && installments != null && installments > 1) {
            base += " (" + installments + " cuotas)";
        }
        return base;
    }

    private String humanizeStatus(String status) {
        return switch (status) {
            case "PENDING"          -> "Pendiente";
            case "AWAITING_PAYMENT" -> "Esperando pago";
            case "PAID"             -> "Pago confirmado";
            case "PREPARING"        -> "En preparación";
            case "SHIPPED"          -> "Enviado";
            case "DELIVERED"        -> "Entregado";
            case "CANCELLED"        -> "Cancelado";
            case "REFUNDED"         -> "Reembolsado";
            default                 -> status;
        };
    }

    private Color statusColor(String status) {
        return switch (status) {
            case "DELIVERED"        -> new Color(22, 163, 74);
            case "SHIPPED"          -> new Color(37, 99, 235);
            case "PAID", "PREPARING"-> new Color(16, 185, 129);
            case "CANCELLED"        -> new Color(220, 38, 38);
            case "REFUNDED"         -> new Color(107, 114, 128);
            default                 -> TEXT_DARK;
        };
    }

    private String nullSafe(String s) {
        return s != null ? s : "—";
    }
}
