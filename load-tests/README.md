# Load tests

Requiere [k6](https://k6.io/docs/get-started/installation/).

```bash
# contra local
k6 run catalog-load-test.js

# contra staging, con más carga
BASE_URL=https://tiendaropa-backend-staging.up.railway.app TARGET_RPS=200 DURATION=3m k6 run catalog-load-test.js
```

Leé el comentario al principio de `catalog-load-test.js` antes de correrlo contra
cualquier ambiente que te importe — el rate limiting global por IP (agregado en
`RateLimitFilter`) va a devolver 429 legítimamente si superás el límite configurado
desde una sola fuente, que es exactamente la protección que se agregó. Para medir
throughput real hace falta tráfico distribuido (múltiples IPs) o subir el límite
temporalmente en un ambiente de staging.

No corras esto contra producción sin avisar — aunque el objetivo es simular una
ráfaga, en un ambiente real con usuarios activos puede degradar el servicio.
