# Penca Hockey Mundial Femenino 2026 - OCC

## Deploy en Railway (5 minutos)

### 1. Subir a GitHub

```bash
cd penca-hockey
git init
git add .
git commit -m "Penca Hockey 2026"
```

Creá un repo nuevo en github.com y seguí las instrucciones para subir.

### 2. Deploy en Railway

1. Entrá a **railway.app** y logueate con tu cuenta de GitHub
2. Click en **"New Project"**
3. Elegí **"Deploy from GitHub repo"**
4. Seleccioná tu repositorio `penca-hockey`
5. Railway lo detecta como Node.js y hace el deploy automático
6. En 2 minutos tenés una URL tipo `penca-hockey-production.up.railway.app`

### 3. Variables de entorno (opcional)

En Railway → Settings → Variables, podés cambiar:
- `ADMIN_USER` — usuario del super admin (default: `occadmin`)
- `ADMIN_PASS` — contraseña del super admin (default: `occ2026hockey`)
- `DB_PATH` — ruta de la base de datos (default: `./penca.db`)

### ⚠️ Importante sobre los datos

Railway tiene filesystem efímero en el plan gratuito — si el servidor se reinicia, la base de datos SQLite se puede perder.

**Para datos persistentes (recomendado):**
- En Railway agregá un servicio de **PostgreSQL** (gratis)
- O usá el plan Hobby de Railway ($5/mes) que tiene volúmenes persistentes

### Compartir con los jugadores

Una vez deployado, compartís la URL con todos. Cada uno:
1. Entra a la URL
2. Se registra con usuario y contraseña
3. Ingresa el código del grupo que vos les mandás

### Super Admin

- Usuario: `occadmin`
- Contraseña: `occ2026hockey`
- El super admin NO aparece en ningún grupo ni tabla
- Solo el super admin puede cargar resultados oficiales

## Desarrollo local

```bash
npm install
node server.js
# Abre http://localhost:3000
```
