# Penca Hockey 2026 — Setup en Railway
# =======================================

## Variables de entorno necesarias en Railway

### JSONBIN_KEY
Tu API key de jsonbin.io (la Master Key).
1. Creá cuenta gratis en https://jsonbin.io
2. En "API Keys" copiá tu X-Master-Key
3. Pegala en Railway como JSONBIN_KEY

### JSONBIN_BIN
El ID del bin donde se guardan los datos.
1. Creá un nuevo bin en jsonbin.io con contenido `{}`
2. El ID aparece en la URL: https://api.jsonbin.io/v3/b/ESTE_ES_EL_ID
3. Pegalo en Railway como JSONBIN_BIN

### PORT
Railway la inyecta automáticamente. No hace falta configurarla.

## Credenciales del sistema

Super Admin:
  usuario: superadmin
  contraseña: hockey2026

Código Maestro (registro ilimitado):
  OCCMASTER2026

## Pasos para publicar

1. Subí esta carpeta a un repo GitHub (privado)
2. En Railway: New Project → Deploy from GitHub repo
3. Agregá las variables JSONBIN_KEY y JSONBIN_BIN
4. Railway detecta nixpacks.toml y buildea automáticamente
5. En ~2 minutos tenés la URL pública lista
