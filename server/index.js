// ─── server/index.js ──────────────────────────────────────────
// Express + JSONBin storage para Penca Hockey 2026
// Variables de entorno necesarias:
//   JSONBIN_KEY   → X-Master-Key de jsonbin.io
//   JSONBIN_BIN   → ID del bin (se crea automáticamente la primera vez)
//   PORT          → Railway lo inyecta automáticamente

import express from 'express';
import cors from 'cors';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// ─── STORAGE ──────────────────────────────────────────────────
// Usa JSONBin si hay JSONBIN_KEY, sino usa un archivo local (dev)
const JSONBIN_KEY = process.env.JSONBIN_KEY;
const DATA_FILE   = join(__dirname, '../data.json');

async function readDB() {
  if (JSONBIN_KEY) {
    const binId = process.env.JSONBIN_BIN;
    if (!binId) return {};
    try {
      const r = await fetch(`https://api.jsonbin.io/v3/b/${binId}/latest`, {
        headers: { 'X-Master-Key': JSONBIN_KEY }
      });
      const j = await r.json();
      return j.record || {};
    } catch (e) {
      console.error('JSONBin read error:', e.message);
      return {};
    }
  }
  // Local fallback
  if (!existsSync(DATA_FILE)) return {};
  try { return JSON.parse(readFileSync(DATA_FILE, 'utf8')); }
  catch { return {}; }
}

async function writeDB(data) {
  if (JSONBIN_KEY) {
    const binId = process.env.JSONBIN_BIN;
    if (!binId) return;
    try {
      await fetch(`https://api.jsonbin.io/v3/b/${binId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'X-Master-Key': JSONBIN_KEY },
        body: JSON.stringify(data)
      });
    } catch (e) {
      console.error('JSONBin write error:', e.message);
    }
    return;
  }
  writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

// Helper para leer/escribir claves individuales
async function dbGet(key) {
  const db = await readDB();
  return db[key] ?? null;
}
async function dbSet(key, value) {
  const db = await readDB();
  db[key] = value;
  await writeDB(db);
}

// ─── RUTA: crear bin JSONBin (una sola vez) ───────────────────
app.post('/api/admin/init-bin', async (req, res) => {
  const { masterKey } = req.body;
  if (!masterKey) return res.status(400).json({ error: 'masterKey requerido' });
  try {
    const r = await fetch('https://api.jsonbin.io/v3/b', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Master-Key': masterKey,
        'X-Bin-Name': 'penca-hockey-2026',
        'X-Bin-Private': 'true'
      },
      body: JSON.stringify({ initialized: true, createdAt: new Date().toISOString() })
    });
    const j = await r.json();
    res.json({ binId: j.metadata?.id, message: 'Bin creado. Guardá este ID como JSONBIN_BIN' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── RUTAS DE STORAGE GENÉRICO ────────────────────────────────
// GET /api/store/:key
app.get('/api/store/:key', async (req, res) => {
  try {
    const value = await dbGet(req.params.key);
    res.json({ key: req.params.key, value });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PUT /api/store/:key
app.put('/api/store/:key', async (req, res) => {
  try {
    await dbSet(req.params.key, req.body.value);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE /api/store/:key (set to null)
app.delete('/api/store/:key', async (req, res) => {
  try {
    const db = await readDB();
    delete db[req.params.key];
    await writeDB(db);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── HEALTH CHECK ─────────────────────────────────────────────
app.get('/api/health', (_, res) => res.json({ ok: true, ts: Date.now() }));

// ─── SIRVE EL FRONTEND ────────────────────────────────────────
const DIST = join(__dirname, '../dist');
app.use(express.static(DIST));
app.get('*', (_, res) => res.sendFile(join(DIST, 'index.html')));

app.listen(PORT, () => console.log(`🏑 Penca Hockey corriendo en puerto ${PORT}`));
