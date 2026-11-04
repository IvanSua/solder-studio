package com.tiendaropa.config;

import com.tiendaropa.config.properties.ApplicationProperties;
import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Contact;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.security.SecurityRequirement;
import io.swagger.v3.oas.models.security.SecurityScheme;
import io.swagger.v3.oas.models.servers.Server;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.List;

@Configuration
@RequiredArgsConstructor
public class OpenApiConfig {

    private static final String BEARER_SCHEME = "bearerAuth";

    private final ApplicationProperties appProperties;

    @Bean
    public OpenAPI openAPI() {
        return new OpenAPI()
                .info(new Info()
                        .title("Solder Studio API")
                        .version("1.0")
                        .description("API REST para la tienda de ropa con personalización de prendas. " +
                                "Autenticación vía JWT Bearer token — obtené tu token en `POST /api/auth/login`.")
                        .contact(new Contact()
                                .name("Solder Studio")
                                .url(appProperties.frontendUrl())))
                .servers(List.of(
                        new Server().url("http://localhost:8080").description("Desarrollo local"),
                        new Server().url(appProperties.frontendUrl()).description("Producción")))
                // Global security requirement — applies to all endpoints by default
                .addSecurityItem(new SecurityRequirement().addList(BEARER_SCHEME))
                .components(new Components()
                        .addSecuritySchemes(BEARER_SCHEME, new SecurityScheme()
                                .name(BEARER_SCHEME)
                                .type(SecurityScheme.Type.HTTP)
                                .scheme("bearer")
                                .bearerFormat("JWT")
                                .description("JWT token obtenido desde POST /api/auth/login. " +
                                        "Formato: Bearer {token}")));
    }
}
