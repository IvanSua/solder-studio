# Solder Studio — Tienda de Ropa

> Proyecto personal de Iván Suárez. Esta es una copia pública para portfolio: las credenciales, los datos de contacto y los documentos internos fueron retirados. Las variables `change-me` deben reemplazarse por valores propios usando `.env.example`.

> **Reclutadores:** si querés probar la aplicación, pedime usuario y clave por [LinkedIn](https://www.linkedin.com/in/ivan-suarez-766b29228/). Se los comparto solo a reclutadores que pueda verificar, indicando empresa y búsqueda.

E-commerce de ropa con personalización de prendas en tiempo real. Los usuarios pueden diseñar sus propias prendas usando un editor de canvas y hacer el checkout con MercadoPago.

---

## Stack

| Capa | Tecnología |
|------|-----------|
| Backend | Spring Boot 3.4.3, Java 21 |
| Frontend | Angular 19, TypeScript 5.6 |
| Base de datos | PostgreSQL 16 |
| Cache / Sesiones | Redis 7 |
| Almacenamiento | MinIO (S3-compatible) |
| Pagos | MercadoPago SDK |
| Auth | JWT + OAuth2 (Google, Facebook) + TOTP 2FA |
| Monitoreo | Prometheus, Sentry, OpenTelemetry |
| Schema migrations | Flyway |
| Editor de diseño | Konva.js (canvas) |

---

## Arquitectura

```
┌─────────────────┐     HTTPS      ┌─────────────────────────────────┐
│  Angular 19 SPA │ ─────────────► │  Spring Boot 3.4.3              │
│  (puerto 4200)  │                │  (puerto 8080)                   │
└─────────────────┘                │                                 │
                                   │  ┌────────────┐  ┌──────────┐  │
                                   │  │ Controllers│  │ Security │  │
                                   │  │ Services   │  │ Filters  │  │
                                   │  │ Repos (JPA)│  │ JWT/OAuth│  │
                                   │  └──────┬─────┘  └──────────┘  │
                                   └─────────┼───────────────────────┘
                                             │
                    ┌─────────��──────────────┼──────────────────────┐
                    │                        │                      │
               ┌────▼─────┐          ┌───────▼──────┐      ┌───────▼──────┐
               │PostgreSQL│          │    Redis 7   │      │    MinIO     │
               │    16    │          │ Cache, Rate  │      │  Imágenes,   │
               │  :5433   │          │ Limit, Tokens│      │  Diseños     │
               └──────────┘          └──────────────┘      └──────────────┘
```

### Seguridad

- **JWT** con access token (24h) + refresh token (7d), rotación automática
- **Token blacklist** en Redis al hacer logout (TTL = vida restante del token)
- **Rate limiting distribuido** con Bucket4j + Redis (fallback in-memory)
- **2FA** TOTP con Google Authenticator
- **OAuth2** Google y Facebook — código temporal one-time para evitar JWT en URL
- **HTTP Security Headers** — HSTS, CSP, X-Frame-Options, X-Content-Type-Options
- **Account lockout** — 5 intentos fallidos → bloqueo 15 minutos
- **Security event logging** estructurado para auditoría

---

## Levantar en local

### Prerrequisitos

- Docker + Docker Compose
- Java 21
- Node.js 20+ y npm

### 1. Infraestructura

```bash
docker compose up -d
```

Levanta PostgreSQL (`:5433`), Redis (`:6379`) y MinIO (`:9000` / consola `:9001`).

### 2. Backend

```bash
cd backend
./mvnw spring-boot:run
```

Arranca en `http://localhost:8080`.
Swagger UI disponible en `http://localhost:8080/swagger-ui.html`.

### 3. Frontend

```bash
cd frontend
npm install
npm start
```

Arranca en `http://localhost:4200`.

---

## Variables de entorno

### Backend (requeridas en producción)

| Variable | Descripción | Default dev |
|----------|-------------|-------------|
| `JWT_SECRET` | Clave secreta JWT (mín. 32 chars) | placeholder inseguro |
| `DB_USERNAME` | Usuario PostgreSQL | `tiendaropa` |
| `DB_PASSWORD` | Contraseña PostgreSQL | `tiendaropa` |
| `REDIS_HOST` | Host Redis | `localhost` |
| `REDIS_PORT` | Puerto Redis | `6379` |
| `STORAGE_ENDPOINT` | URL MinIO/S3 | `http://localhost:9000` |
| `STORAGE_ACCESS_KEY` | Access key MinIO | `minioadmin` |
| `STORAGE_SECRET_KEY` | Secret key MinIO | `minioadmin` |
| `STORAGE_BUCKET` | Nombre del bucket | `tiendaropa` |
| `MP_ACCESS_TOKEN` | MercadoPago access token | — |
| `MP_WEBHOOK_SECRET` | MercadoPago webhook secret | — |
| `MP_NOTIFICATION_URL` | URL pública para notificaciones MP | — |
| `GOOGLE_CLIENT_ID` | OAuth2 Google client ID | — |
| `GOOGLE_CLIENT_SECRET` | OAuth2 Google client secret | — |
| `FACEBOOK_CLIENT_ID` | OAuth2 Facebook client ID | — |
| `FACEBOOK_CLIENT_SECRET` | OAuth2 Facebook client secret | — |
| `MAIL_HOST` | SMTP host | `smtp.gmail.com` |
| `MAIL_USERNAME` | Cuenta de email | — |
| `MAIL_PASSWORD` | Contraseña SMTP | — |
| `SENTRY_DSN` | DSN de Sentry | — |
| `FRONTEND_URL` | URL del frontend | `http://localhost:4200` |
| `CORS_ORIGINS` | Orígenes permitidos CORS | `http://localhost:4200` |
| `PUSH_VAPID_PUBLIC_KEY` | Clave VAPID pública (Web Push) | — |
| `PUSH_VAPID_PRIVATE_KEY` | Clave VAPID privada (Web Push) | — |
| `ACTUATOR_METRICS_USERNAME` | Usuario HTTP Basic para `/actuator/prometheus` y `/actuator/metrics/**` (scrape de Prometheus) | `prometheus` |
| `ACTUATOR_METRICS_PASSWORD` | Password HTTP Basic para esos mismos endpoints — **cambiar en producción** | placeholder inseguro |
| `DEV_SEED_PASSWORD` | Contraseña de los usuarios de prueba locales. Si no se define, no se crean | (vacío) |

**Generar claves VAPID:**
```bash
node -e "const w=require('web-push'); const k=w.generateVAPIDKeys(); console.log(JSON.stringify(k,null,2));"
```

### Perfil de producción

```bash
SPRING_PROFILES_ACTIVE=prod ./mvnw spring-boot:run
```

En producción: Redis fail-fast activado, logs en nivel INFO, Sentry habilitado, actuator restringido.

---

## API

Documentación interactiva completa en Swagger UI:

- **Local:** `http://localhost:8080/swagger-ui.html`
- **OpenAPI JSON:** `http://localhost:8080/api-docs`

### Autenticación

```
POST /api/v1/auth/register            Registrar cuenta
POST /api/v1/auth/login               Login con email/password
POST /api/v1/auth/logout              Revocar access token  [Bearer]
POST /api/v1/auth/refresh             Renovar tokens
POST /api/v1/auth/forgot-password     Solicitar reset de contraseña
POST /api/v1/auth/reset-password      Confirmar reset con token
GET  /api/v1/auth/verify-email        Verificar email
POST /api/v1/auth/2fa/setup           Configurar 2FA           [Bearer]
POST /api/v1/auth/2fa/enable          Activar 2FA              [Bearer]
POST /api/v1/auth/2fa/verify          Verificar código 2FA
```

### Principales recursos

```
GET    /api/v1/products               Catálogo con filtros y paginación
GET    /api/v1/products/{id}          Detalle de producto
GET    /api/v1/categories             Árbol de categorías
GET/POST /api/v1/cart                 Carrito                  [Bearer]
POST   /api/v1/checkout               Iniciar checkout         [Bearer]
GET    /api/v1/orders                 Mis pedidos              [Bearer]
POST   /api/v1/designs                Crear diseño             [Bearer]
GET    /api/v1/shipping               Calcular costo de envío
POST   /api/v1/payments/webhook       Webhook MercadoPago (público)
GET    /api/v1/promotions/active      Promociones activas
```

---

## Features

- **Catálogo** con filtros por categoría/talle/precio, búsqueda full-text y autocomplete
- **Diseño personalizado** — editor canvas (Konva.js) con subida de imágenes propias y selección de áreas de impresión
- **Carrito** persistente con reserva de stock (15 min TTL, liberación automática por scheduler)
- **Checkout** con validación de stock, cálculo de envío, aplicación de cupones y descuentos
- **Pagos** con MercadoPago, webhook seguro con verificación de firma, reintentos automáticos
- **Sistema de fidelidad** — puntos por compras, referidos, redención de puntos
- **Notificaciones push** Web Push con VAPID, gestión de suscripciones
- **Panel de administración** — 17 módulos: productos, variantes, órdenes, usuarios, promotions, devoluciones, stock, reportes, etc.
- **Blog** con editor de contenido
- **Wishlist**, historial de productos vistos, Q&A de productos, sistema de reviews con calificación
- **Newsletter** con opt-in en registro
- **Sitemap** dinámico para SEO
- **Programa de referidos** con bonos de puntos para referente y referido

---

## Testing

```bash
# Backend — unit + integration tests con reporte de cobertura
cd backend
./mvnw test

# Frontend — E2E con Playwright
cd frontend
npx playwright test
```

Cobertura mínima requerida: **70%** (verificada por JaCoCo en cada build).

---

## Monitoreo

| Endpoint | Descripción |
|----------|-------------|
| `/actuator/health` | Health check (DB + Redis) |
| `/actuator/prometheus` | Métricas para Prometheus |
| `http://localhost:9001` | MinIO Console |

Trazas distribuidas vía OpenTelemetry — configurar `OTEL_EXPORTER_OTLP_ENDPOINT` para enviar spans a Jaeger o Tempo.
