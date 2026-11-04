#!/bin/sh
# docker-entrypoint.sh
#
# 1. Reads Docker secret files from /run/secrets/ as root (chmod 600 files are accessible)
# 2. Exports them as env vars — filename uppercased becomes the var name:
#      db_password      → DB_PASSWORD
#      jwt_secret       → JWT_SECRET
#      mp_access_token  → MP_ACCESS_TOKEN
#      (etc.)
# 3. Drops privileges to appuser via su-exec before starting the JVM.
#
# This keeps secrets out of `docker inspect` output while allowing
# the secret files to remain chmod 600 on the host.

set -e

# Read secret files (runs as root — can read 600 files)
if [ -d /run/secrets ]; then
    for secret_file in /run/secrets/*; do
        [ -f "$secret_file" ] || continue
        var_name=$(basename "$secret_file" | tr '[:lower:]' '[:upper:]' | tr '-' '_')
        val=$(cat "$secret_file")
        # Only export if not already set (allows explicit env vars to override secrets)
        eval "existing=\${${var_name}:-}"
        if [ -z "$existing" ]; then
            export "${var_name}=${val}"
        fi
    done
fi

# Drop to non-root user and exec the JVM
exec su-exec appuser java \
  -XX:+UseContainerSupport \
  -XX:MaxRAMPercentage=75.0 \
  -Djava.security.egd=file:/dev/./urandom \
  "$@" \
  -jar /app/app.jar
