const express = require('express');
const Datastore = require('nedb');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ============================================================
// DATABASES
// ============================================================
const db = {
  users:       new Datastore({ filename: path.join(DATA_DIR, 'users.db'),       autoload: true }),
  grupos:      new Datastore({ filename: path.join(DATA_DIR, 'grupos.db'),      autoload: true }),
  members:     new Datastore({ filename: path.join(DATA_DIR, 'members.db'),     autoload: true }),
  results:     new Datastore({ filename: path.join(DATA_DIR, 'results.db'),     autoload: true }),
  predictions: new Datastore({ filename: path.join(DATA_DIR, 'predictions.db'), autoload: true }),
};

db.users.ensureIndex({ fieldName: 'username', unique: true });
db.grupos.ensureIndex({ fieldName: 'code', unique: true });
db.members.ensureIndex({ fieldName: 'grupoId_username' });
db.results.ensureIndex({ fieldName: 'matchId', unique: true });
db.predictions.ensureIndex({ fieldName: 'key', unique: true });

// Promisify nedb
function dbFind(col, query) {
  return new Promise((res, rej) => col.find(query, (e, d) => e ? rej(e) : res(d)));
}
function dbFindOne(col, query) {
  return new Promise((res, rej) => col.findOne(query, (e, d) => e ? rej(e) : res(d)));
}
function dbInsert(col, doc) {
  return new Promise((res, rej) => col.insert(doc, (e, d) => e ? rej(e) : res(d)));
}
function dbUpdate(col, query, update, opts = {}) {
  return new Promise((res, rej) => col.update(query, update, opts, (e, n) => e ? rej(e) : res(n)));
}
function dbRemove(col, query, opts = {}) {
  return new Promise((res, rej) => col.remove(query, opts, (e, n) => e ? rej(e) : res(n)));
}
function dbCount(col, query) {
  return new Promise((res, rej) => col.count(query, (e, n) => e ? rej(e) : res(n)));
}

// ============================================================
// HELPERS
// ============================================================
function genCode(len = 6) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}
function genId() {
  return 'grp_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
}

const SUPERADMIN_USER = process.env.ADMIN_USER || 'occadmin';
const SUPERADMIN_PASS = process.env.ADMIN_PASS || 'occ2026hockey';

function isSuperAdmin(username, password) {
  return username === SUPERADMIN_USER && password === SUPERADMIN_PASS;
}

async function verifyUser(username, password) {
  const user = await dbFindOne(db.users, { username });
  if (!user) return null;
  if (!bcrypt.compareSync(password, user.passwordHash)) return null;
  return user;
}

// ============================================================
// AUTH
// ============================================================
app.post('/api/register', async (req, res) => {
  try {
    const { username, password, displayName } = req.body;
    if (!username || !password || !displayName) return res.status(400).json({ error: 'Faltan campos.' });
    if (username === SUPERADMIN_USER) return res.status(400).json({ error: 'Nombre de usuario no disponible.' });
    const exists = await dbFindOne(db.users, { username });
    if (exists) return res.status(409).json({ error: 'Ese usuario ya existe.' });
    const passwordHash = bcrypt.hashSync(password, 8);
    await dbInsert(db.users, { username, displayName, passwordHash, createdAt: new Date() });
    res.json({ ok: true, username, displayName });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Faltan campos.' });
    if (isSuperAdmin(username, password)) {
      return res.json({ ok: true, username, displayName: 'Super Admin', isAdmin: true });
    }
    const user = await dbFindOne(db.users, { username });
    if (!user) return res.status(401).json({ error: 'Usuario no encontrado.' });
    if (!bcrypt.compareSync(password, user.passwordHash)) return res.status(401).json({ error: 'Contraseña incorrecta.' });
    res.json({ ok: true, username, displayName: user.displayName, isAdmin: false });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ============================================================
// GRUPOS
// ============================================================
app.get('/api/grupos', async (req, res) => {
  try {
    const { username, password } = req.query;
    if (!username || !password) return res.status(401).json({ error: 'No autorizado.' });
    if (!isSuperAdmin(username, password)) {
      const user = await verifyUser(username, password);
      if (!user) return res.status(401).json({ error: 'No autorizado.' });
    }
    const memberships = await dbFind(db.members, { username });
    const grupoIds = memberships.map(m => m.grupoId);
    const grupos = await dbFind(db.grupos, { id: { $in: grupoIds } });
    const result = await Promise.all(grupos.map(async g => {
      const mems = await dbFind(db.members, { grupoId: g.id });
      return { ...g, members: mems.map(m => m.username) };
    }));
    res.json(result);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/grupos', async (req, res) => {
  try {
    const { username, password, name } = req.body;
    const user = await verifyUser(username, password);
    if (!user) return res.status(401).json({ error: 'No autorizado.' });
    if (!name) return res.status(400).json({ error: 'Falta el nombre.' });
    const id = genId();
    let code = genCode();
    while (await dbFindOne(db.grupos, { code })) code = genCode();
    const grupo = { id, name, code, creator: username, createdAt: new Date() };
    await dbInsert(db.grupos, grupo);
    await dbInsert(db.members, { grupoId: id, username, grupoId_username: id + '_' + username });
    res.json({ ok: true, ...grupo, members: [username] });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/grupos/join', async (req, res) => {
  try {
    const { username, password, code } = req.body;
    const user = await verifyUser(username, password);
    if (!user) return res.status(401).json({ error: 'No autorizado.' });
    const grupo = await dbFindOne(db.grupos, { code: code.toUpperCase() });
    if (!grupo) return res.status(404).json({ error: 'Código no encontrado.' });
    const already = await dbFindOne(db.members, { grupoId: grupo.id, username });
    if (!already) {
      await dbInsert(db.members, { grupoId: grupo.id, username, grupoId_username: grupo.id + '_' + username });
    }
    const mems = await dbFind(db.members, { grupoId: grupo.id });
    res.json({ ok: true, ...grupo, members: mems.map(m => m.username) });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/grupos/:id', async (req, res) => {
  try {
    const { username, password } = req.query;
    if (!username || !password) return res.status(401).json({ error: 'No autorizado.' });
    const grupo = await dbFindOne(db.grupos, { id: req.params.id });
    if (!grupo) return res.status(404).json({ error: 'Grupo no encontrado.' });
    const mems = await dbFind(db.members, { grupoId: req.params.id });
    const memberDetails = await Promise.all(mems.map(async m => {
      const u = await dbFindOne(db.users, { username: m.username });
      return { username: m.username, display_name: u ? u.displayName : m.username };
    }));
    res.json({ ...grupo, members: memberDetails });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ============================================================
// RESULTS
// ============================================================
app.get('/api/results', async (req, res) => {
  try {
    const results = await dbFind(db.results, {});
    const map = {};
    results.forEach(r => { map[r.matchId] = { home: r.home, away: r.away }; });
    res.json(map);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/results/:matchId', async (req, res) => {
  try {
    const { username, password, home, away } = req.body;
    if (!isSuperAdmin(username, password)) return res.status(403).json({ error: 'Solo el super admin puede cargar resultados.' });
    await dbUpdate(db.results, { matchId: req.params.matchId },
      { $set: { matchId: req.params.matchId, home: parseInt(home), away: parseInt(away), updatedAt: new Date() } },
      { upsert: true });
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ============================================================
// PREDICTIONS
// ============================================================
app.get('/api/predictions/:grupoId', async (req, res) => {
  try {
    const { username, password } = req.query;
    if (!username || !password) return res.status(401).json({ error: 'No autorizado.' });
    const grupo = await dbFindOne(db.grupos, { id: req.params.grupoId });
    const isCreator = grupo && grupo.creator === username;
    const isMember = await dbFindOne(db.members, { grupoId: req.params.grupoId, username });
    if (!isMember && !isCreator && !isSuperAdmin(username, password)) {
      return res.status(403).json({ error: 'No sos miembro de este grupo.' });
    }
    const all = await dbFind(db.predictions, { grupoId: req.params.grupoId });
    const filtered = isCreator ? all : all.filter(p => p.username === username);
    const map = {};
    filtered.forEach(p => {
      if (!map[p.username]) map[p.username] = {};
      map[p.username][p.matchId] = { home: p.home, away: p.away };
    });
    res.json(map);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/predictions/:grupoId/:matchId', async (req, res) => {
  try {
    const { username, password, home, away } = req.body;
    const user = await verifyUser(username, password);
    if (!user) return res.status(401).json({ error: 'No autorizado.' });
    const result = await dbFindOne(db.results, { matchId: req.params.matchId });
    if (result) return res.status(400).json({ error: 'Este partido ya tiene resultado oficial. No se puede pronosticar.' });
    const key = req.params.grupoId + '_' + username + '_' + req.params.matchId;
    await dbUpdate(db.predictions,
      { key },
      { $set: { key, grupoId: req.params.grupoId, username, matchId: req.params.matchId, home: parseInt(home), away: parseInt(away) } },
      { upsert: true });
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/predictions/:grupoId/:matchId', async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await verifyUser(username, password);
    if (!user) return res.status(401).json({ error: 'No autorizado.' });
    const result = await dbFindOne(db.results, { matchId: req.params.matchId });
    if (result) return res.status(400).json({ error: 'No podés editar después del resultado oficial.' });
    await dbRemove(db.predictions, { grupoId: req.params.grupoId, username, matchId: req.params.matchId });
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ============================================================
// LEADERBOARD
// ============================================================
app.get('/api/leaderboard/:grupoId', async (req, res) => {
  try {
    const { username, password } = req.query;
    if (!username || !password) return res.status(401).json({ error: 'No autorizado.' });
    const mems = await dbFind(db.members, { grupoId: req.params.grupoId });
    const results = await dbFind(db.results, {});
    const resultsMap = {};
    results.forEach(r => { resultsMap[r.matchId] = { home: r.home, away: r.away }; });
    const allPreds = await dbFind(db.predictions, { grupoId: req.params.grupoId });

    function calcPts(ph, pa, rh, ra) {
      if (ph === rh && pa === ra) return 3;
      if ((ph - pa) === (rh - ra)) return 2;
      const pw = ph > pa ? 'H' : ph < pa ? 'A' : 'D';
      const rw = rh > ra ? 'H' : rh < ra ? 'A' : 'D';
      if (pw === rw) return 1;
      return 0;
    }

    const scores = await Promise.all(mems.map(async m => {
      const u = await dbFindOne(db.users, { username: m.username });
      const userPreds = allPreds.filter(p => p.username === m.username);
      let total = 0, played = 0;
      userPreds.forEach(p => {
        const r = resultsMap[p.matchId];
        if (r) { total += calcPts(p.home, p.away, r.home, r.away); played++; }
      });
      return { username: m.username, displayName: u ? u.displayName : m.username, total, played };
    }));
    scores.sort((a, b) => b.total - a.total || b.played - a.played);
    res.json(scores);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ============================================================
// ADMIN
// ============================================================
app.get('/api/admin/grupos', async (req, res) => {
  try {
    const { username, password } = req.query;
    if (!isSuperAdmin(username, password)) return res.status(403).json({ error: 'No autorizado.' });
    const grupos = await dbFind(db.grupos, {});
    const result = await Promise.all(grupos.map(async g => {
      const count = await dbCount(db.members, { grupoId: g.id });
      return { ...g, member_count: count };
    }));
    res.json(result);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// Serve frontend
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => console.log(`🏑 Penca Hockey 2026 en puerto ${PORT}`));
