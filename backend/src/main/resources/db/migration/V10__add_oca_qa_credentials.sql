-- Agrega columna api_key a carrier_configs (para CUIT u otros tokens específicos del carrier).
ALTER TABLE carrier_configs ADD COLUMN IF NOT EXISTS api_key VARCHAR(100);

-- Las credenciales del carrier se cargan por configuración, nunca en una migración.
