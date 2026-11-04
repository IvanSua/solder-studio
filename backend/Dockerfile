# ── Stage 1: Build ──────────────────────────────────────────────────────────
FROM eclipse-temurin:21-jdk-alpine AS builder

WORKDIR /build

# Cache dependency layer — copy pom first, then sources
COPY pom.xml .
COPY .mvn/ .mvn/
COPY mvnw .
RUN chmod +x mvnw && ./mvnw dependency:go-offline -q

COPY src/ src/
RUN ./mvnw package -DskipTests -q

# ── Stage 2: Runtime ─────────────────────────────────────────────────────────
FROM eclipse-temurin:21-jre-alpine AS runtime

# su-exec lets the entrypoint read secrets as root, then drop to appuser
RUN apk add --no-cache su-exec

# Non-root user for security (created here, used by the entrypoint via su-exec)
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

WORKDIR /app

# Copy the fat JAR from the build stage
COPY --from=builder /build/target/*.jar app.jar

# Entrypoint script:
#   1. Reads Docker secrets from /run/secrets/ (as root)
#   2. Exports them as env vars
#   3. Drops privileges to appuser via su-exec before exec'ing the JVM
COPY docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh

# Flyway migrations — mounted at runtime or baked in (already in jar via resources)
# If you use external migrations, uncomment:
# COPY --from=builder /build/migrations/ /app/migrations/

# Container starts as root so the entrypoint can read secret files,
# then drops to appuser before launching the JVM (see docker-entrypoint.sh).
EXPOSE 8080

# JVM flags:
# -XX:+UseContainerSupport  → respect cgroup CPU/memory limits
# -XX:MaxRAMPercentage=75   → use 75% of available container RAM for heap
# -Djava.security.egd      → faster SecureRandom startup
ENTRYPOINT ["/app/docker-entrypoint.sh"]
