import { useState, useEffect, useCallback } from "react";

// ─── SUPER ADMIN ──────────────────────────────────────────────
const SA = { username: "superadmin", pass: "hockey2026", name: "Super Admin" };

// El único grupo de la penca — código fijo
const THE_GROUP = { id: "penca_occ_2026", name: "Penca Hockey 2026", code: "OCC2026" };

// ─── ABREVIATURAS ─────────────────────────────────────────────
const ABBR = {
  "Países Bajos":"NED","Australia":"AUS","Chile":"CHI","Japón":"JPN",
  "Argentina":"ARG","Alemania":"GER","Estados Unidos":"USA","Escocia":"SCO",
  "Bélgica":"BEL","España":"ESP","Nueva Zelanda":"NZL","Irlanda":"IRL",
  "China":"CHN","Inglaterra":"ENG","India":"IND","Sudáfrica":"RSA"
};

// ─── PARTIDOS — horarios Uruguay (UTC-3) ──────────────────────
const POOLS = {
  A: { name:"Grupo A", venue:"Ámsterdam (NED)" },
  B: { name:"Grupo B", venue:"Wavre (BEL)" },
  C: { name:"Grupo C", venue:"Wavre (BEL)" },
  D: { name:"Grupo D", venue:"Ámsterdam (NED)" },
};
const MATCHES = [
  // Grupo A — Ámsterdam  (CEST = UTC+2, Uruguay = UTC-3, diff = -5h)
  {id:"A1",pool:"A",home:"Países Bajos",away:"Chile",         date:"Vie 15 Ago",time:"12:00"},
  {id:"A2",pool:"A",home:"Australia",   away:"Japón",         date:"Vie 15 Ago",time:"10:00"},
  {id:"A3",pool:"A",home:"Países Bajos",away:"Japón",         date:"Dom 17 Ago",time:"12:00"},
  {id:"A4",pool:"A",home:"Australia",   away:"Chile",         date:"Dom 17 Ago",time:"10:00"},
  {id:"A5",pool:"A",home:"Chile",       away:"Japón",         date:"Mar 19 Ago",time:"10:00"},
  {id:"A6",pool:"A",home:"Países Bajos",away:"Australia",     date:"Mar 19 Ago",time:"12:00"},
  // Grupo B — Wavre
  {id:"B1",pool:"B",home:"Alemania",    away:"Escocia",       date:"Vie 15 Ago",time:"06:00"},
  {id:"B2",pool:"B",home:"Argentina",   away:"Estados Unidos",date:"Vie 15 Ago",time:"08:00"},
  {id:"B3",pool:"B",home:"Argentina",   away:"Alemania",      date:"Dom 17 Ago",time:"08:00"},
  {id:"B4",pool:"B",home:"Estados Unidos",away:"Escocia",     date:"Dom 17 Ago",time:"06:00"},
  {id:"B5",pool:"B",home:"Argentina",   away:"Escocia",       date:"Mar 19 Ago",time:"02:00"},
  {id:"B6",pool:"B",home:"Alemania",    away:"Estados Unidos",date:"Mar 19 Ago",time:"06:00"},
  // Grupo C — Wavre
  {id:"C1",pool:"C",home:"Bélgica",     away:"Irlanda",       date:"Sáb 16 Ago",time:"06:00"},
  {id:"C2",pool:"C",home:"España",      away:"Nueva Zelanda", date:"Sáb 16 Ago",time:"08:00"},
  {id:"C3",pool:"C",home:"Bélgica",     away:"Nueva Zelanda", date:"Lun 18 Ago",time:"06:00"},
  {id:"C4",pool:"C",home:"España",      away:"Irlanda",       date:"Lun 18 Ago",time:"08:00"},
  {id:"C5",pool:"C",home:"Bélgica",     away:"España",        date:"Mié 20 Ago",time:"06:00"},
  {id:"C6",pool:"C",home:"Nueva Zelanda",away:"Irlanda",      date:"Mié 20 Ago",time:"08:00"},
  // Grupo D — Ámsterdam
  {id:"D1",pool:"D",home:"Inglaterra",  away:"Sudáfrica",     date:"Sáb 16 Ago",time:"10:00"},
  {id:"D2",pool:"D",home:"China",       away:"India",         date:"Sáb 16 Ago",time:"12:00"},
  {id:"D3",pool:"D",home:"China",       away:"Inglaterra",    date:"Lun 18 Ago",time:"10:00"},
  {id:"D4",pool:"D",home:"India",       away:"Sudáfrica",     date:"Lun 18 Ago",time:"12:00"},
  {id:"D5",pool:"D",home:"China",       away:"Sudáfrica",     date:"Mié 20 Ago",time:"10:00"},
  {id:"D6",pool:"D",home:"India",       away:"Inglaterra",    date:"Mié 20 Ago",time:"12:00"},
];

const RESULTS_KEY = "global_results_v2";
const MEMBERS_KEY = `members_${THE_GROUP.id}`;
const PREDS_KEY   = `preds_${THE_GROUP.id}`;
const CODES_KEY   = "access_codes_v1";

// ─── CÓDIGO MAESTRO (siempre válido, no se consume) ───────────
const MASTER_CODE = "OCCMASTER2026";

// ─── GENERA 500 CÓDIGOS ÚNICOS ────────────────────────────────
function generateCodes() {
  const prefix = ["HOC","PEN","OCC","FEM","MUN","GOL","LEO","CHP"];
  const codes = new Set();
  let i = 1;
  while (codes.size < 500) {
    const p = prefix[i % prefix.length];
    const n = String(i).padStart(3,"0");
    const r = Math.random().toString(36).slice(2,4).toUpperCase();
    codes.add(`${p}${n}${r}`);
    i++;
  }
  return [...codes];
}
const ALL_CODES = generateCodes();
// Los códigos son deterministas por sesión; para hacerlos fijos en storage
// los inicializamos en el primer uso (ver initCodes)
async function initCodes() {
  const existing = await dbGet(CODES_KEY);
  if (existing) return existing; // ya inicializados
  // Primer uso: guardamos todos como disponibles
  const codesObj = {};
  ALL_CODES.forEach(c => { codesObj[c] = { used: false, usedBy: null, usedAt: null }; });
  await dbSet(CODES_KEY, codesObj);
  return codesObj;
}

// ─── PUNTOS ───────────────────────────────────────────────────
function calcPoints(pred, res) {
  const ph=pred.home,pa=pred.away,rh=res.home,ra=res.away;
  if (ph===rh && pa===ra) return 3;
  const pd=ph===pa, rd=rh===ra;
  if (pd && rd) return 1;
  if (!pd && !rd && (ph-pa)===(rh-ra)) return 2;
  const ps=ph>pa?1:ph<pa?-1:0, rs=rh>ra?1:rh<ra?-1:0;
  if (ps!==0 && ps===rs) return 1;
  return 0;
}
function ptsLabel(n) {
  return ["Sin puntos","+1 ganador","+2 diferencia","+3 exacto"][n] || "?";
}
function ptsColor(n) {
  return ["#94a3b8","#93c5fd","#fcd34d","#4ade80"][n] || "#94a3b8";
}
function ptsBg(n) {
  return ["rgba(148,163,184,.1)","rgba(59,130,246,.15)","rgba(234,179,8,.15)","rgba(34,197,94,.15)"][n] || "";
}

function calcUserStats(username, preds, results) {
  const my=preds[username]||{};
  let total=0,exact=0,diff=0,winner=0,played=0;
  MATCHES.forEach(m=>{
    const p=my[m.id], r=results[m.id];
    if(!p||!r) return;
    played++;
    const pts=calcPoints(p,r);
    total+=pts;
    if(pts===3)exact++;else if(pts===2)diff++;else if(pts===1)winner++;
  });
  return{total,exact,diff,winner,played};
}

// ─── STORAGE — usa la API del servidor ───────────────────────
const API_BASE = '';  // mismo origen en producción

async function dbGet(key) {
  try {
    const r = await fetch(`${API_BASE}/api/store/${encodeURIComponent(key)}`);
    const j = await r.json();
    return j.value ?? null;
  } catch { return null; }
}
async function dbSet(key, val) {
  try {
    await fetch(`${API_BASE}/api/store/${encodeURIComponent(key)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value: val })
    });
    return true;
  } catch { return false; }
}

// ─── PALETA AZUL ─────────────────────────────────────────────
const C = {
  bg:"#06111f", hdr:"#091a30", card:"rgba(255,255,255,.04)",
  cardB:"rgba(30,90,180,.1)", cardY:"rgba(240,165,0,.07)",
  acc:"#2563eb", accHi:"#60a5fa", accDk:"#1d4ed8",
  gold:"#f0a500", goldHi:"#ffd166",
  text:"#dbeafe", muted:"#64748b",
  bdr:"rgba(37,99,235,.2)", bdrHi:"rgba(37,99,235,.45)",
  success:"#22c55e", danger:"#ef4444",
};

// ─── ESTILOS ──────────────────────────────────────────────────
const S = {
  wrap:{fontFamily:"'Barlow',system-ui,sans-serif",minHeight:"100vh",background:C.bg,color:C.text,paddingBottom:64},
  hdr:{background:C.hdr,borderBottom:`2px solid ${C.acc}`,padding:"12px 18px",
       display:"flex",alignItems:"center",justifyContent:"space-between",
       position:"sticky",top:0,zIndex:200,boxShadow:"0 2px 16px rgba(0,0,0,.6)"},
  logo:{fontFamily:"'Barlow Condensed',sans-serif",fontSize:"1.4rem",fontWeight:900,
        letterSpacing:1,color:C.accHi,lineHeight:1},
  logoSub:{fontSize:"0.68rem",color:C.muted,letterSpacing:.5,marginTop:2},
  cont:{maxWidth:820,margin:"0 auto",padding:"20px 14px"},
  card:{background:C.card,border:`1px solid ${C.bdr}`,borderRadius:12,padding:"18px 16px",marginBottom:12},
  cardB:{background:C.cardB,border:`1.5px solid ${C.bdrHi}`,borderRadius:12,padding:"18px 16px",marginBottom:12},
  cardY:{background:C.cardY,border:"1.5px solid rgba(240,165,0,.3)",borderRadius:12,padding:"18px 16px",marginBottom:12},
  h2:{fontFamily:"'Barlow Condensed',sans-serif",fontSize:"1.4rem",fontWeight:900,
      letterSpacing:1,color:C.accHi,marginBottom:14},
  h3:{fontFamily:"'Barlow Condensed',sans-serif",fontSize:"1.1rem",fontWeight:700,
      letterSpacing:.5,color:C.accHi,marginBottom:10},
  lbl:{display:"block",fontSize:"0.72rem",fontWeight:700,textTransform:"uppercase",
       letterSpacing:.8,color:C.muted,marginBottom:5},
  inp:{width:"100%",background:"rgba(255,255,255,.06)",border:`1.5px solid ${C.bdr}`,
       color:C.text,padding:"10px 13px",borderRadius:8,fontSize:"0.92rem",
       fontFamily:"inherit",boxSizing:"border-box",outline:"none"},
  btnP:{background:C.accDk,border:"none",color:"#fff",padding:"12px 20px",
        borderRadius:8,fontSize:"0.92rem",fontWeight:700,cursor:"pointer",width:"100%"},
  btnSm:{background:C.accDk,border:"none",color:"#fff",padding:"8px 16px",
         borderRadius:7,fontSize:"0.83rem",fontWeight:700,cursor:"pointer"},
  btnO:{background:"transparent",border:"1px solid rgba(255,255,255,.15)",color:C.muted,
        padding:"8px 16px",borderRadius:7,fontSize:"0.83rem",fontWeight:600,cursor:"pointer"},
  btnY:{background:C.gold,border:"none",color:"#06111f",padding:"8px 14px",
        borderRadius:7,fontSize:"0.8rem",fontWeight:800,cursor:"pointer"},
  btnR:{background:"rgba(239,68,68,.15)",border:"1px solid rgba(239,68,68,.35)",
        color:"#f87171",padding:"7px 12px",borderRadius:7,fontSize:"0.78rem",fontWeight:700,cursor:"pointer"},
  err:{background:"rgba(239,68,68,.1)",border:"1px solid rgba(239,68,68,.3)",
       color:"#f87171",padding:"9px 13px",borderRadius:8,fontSize:"0.85rem",marginBottom:12},
  sI:{width:40,height:40,background:"rgba(255,255,255,.07)",
      border:`2px solid ${C.bdr}`,color:C.text,
      textAlign:"center",fontSize:"1rem",fontWeight:700,
      borderRadius:7,fontFamily:"inherit",outline:"none"},
  gray:{color:C.muted,fontSize:"0.82rem"},
};

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700;900&family=Barlow:wght@400;500;600;700&display=swap');
.team-full{display:inline}
.team-abbr{display:none}
@media(max-width:500px){.team-full{display:none!important}.team-abbr{display:inline!important}}
`;

// ─── HELPERS ──────────────────────────────────────────────────
function TName({name,right=false}) {
  const a=ABBR[name]||name.slice(0,3).toUpperCase();
  const st={fontWeight:700,fontSize:"0.9rem",textAlign:right?"right":"left"};
  return <><span className="team-full" style={st}>{name}</span>
             <span className="team-abbr" style={st}>{a}</span></>;
}
function Spinner({msg="Cargando..."}) {
  return <div style={{textAlign:"center",padding:"48px 16px",color:C.muted}}>
    <div style={{fontSize:"2rem",marginBottom:8}}>🏑</div>{msg}
  </div>;
}
function Toast({msg}){
  if(!msg) return null;
  return <div style={{position:"fixed",bottom:70,right:16,zIndex:9999,
    background:C.hdr,border:`1.5px solid ${C.acc}`,color:C.text,
    padding:"11px 18px",borderRadius:11,fontSize:"0.87rem",fontWeight:600,
    maxWidth:280,boxShadow:"0 4px 20px rgba(0,0,0,.5)"}}>{msg}</div>;
}

// ─── BOTTOM NAV ───────────────────────────────────────────────
function BottomNav({active, onChange, isSA}) {
  const tabs = isSA
    ? [["resultados","⚙️","Resultados"],["tabla","📊","Tabla"],["miembros","👥","Miembros"],["codigos","🔑","Códigos"]]
    : [["partidos","🏑","Partidos"],["tabla","📊","Tabla"],["grupo","👥","Grupo"]];
  return (
    <div style={{position:"fixed",bottom:0,left:0,right:0,zIndex:150,
      background:C.hdr,borderTop:`1px solid ${C.bdr}`,
      display:"flex"}}>
      {tabs.map(([id,icon,label])=>(
        <button key={id} onClick={()=>onChange(id)} style={{
          flex:1,border:"none",background:"transparent",
          color:active===id?C.accHi:C.muted,
          padding:"8px 4px 10px",fontSize:"0.68rem",fontWeight:600,
          cursor:"pointer",display:"flex",flexDirection:"column",
          alignItems:"center",gap:3,transition:"color .15s"}}>
          <span style={{fontSize:"1.3rem"}}>{icon}</span>{label}
        </button>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
//  AUTH
// ─────────────────────────────────────────────────────────────
function AuthScreen({onLogin}) {
  const [mode,setMode]=useState("login");
  const [name,setName]=useState(""),  [user,setUser]=useState(""), [pass,setPass]=useState("");
  const [code,setCode]=useState("");
  const [err,setErr]=useState(""), [ok,setOk]=useState(""), [busy,setBusy]=useState(false);

  async function doLogin() {
    setErr(""); setBusy(true);
    const u=user.trim().toLowerCase();
    if(!u||!pass){setErr("Completá usuario y contraseña.");setBusy(false);return;}
    if(u===SA.username&&pass===SA.pass){
      onLogin({username:SA.username,name:SA.name,isSA:true});setBusy(false);return;
    }
    const users=(await dbGet("users_v2"))||{};
    if(!users[u]){setErr("Usuario no encontrado.");setBusy(false);return;}
    if(users[u].pass!==btoa(pass)){setErr("Contraseña incorrecta.");setBusy(false);return;}
    // check membership
    const members=(await dbGet(MEMBERS_KEY))||[];
    const inGroup=members.some(m=>m.username===u);
    onLogin({username:u,name:users[u].name,isSA:false,inGroup});
    setBusy(false);
  }

  async function doRegister() {
    setErr(""); setBusy(true);
    const n=name.trim(), u=user.trim().toLowerCase().replace(/\s+/g,"");
    const cd=code.trim().toUpperCase();
    if(!n||!u||!pass||!cd){setErr("Completá todos los campos.");setBusy(false);return;}
    if(pass.length<4){setErr("Contraseña mínimo 4 caracteres.");setBusy(false);return;}
    if(u===SA.username){setErr("Ese usuario no está disponible.");setBusy(false);return;}

    // ── Validar código de acceso ──────────────────────────────
    const isMaster = cd === MASTER_CODE;
    if (!isMaster) {
      const codes = await initCodes();
      if (!codes[cd]) {
        setErr("Código de acceso inválido. Pedile uno al administrador.");
        setBusy(false); return;
      }
      if (codes[cd].used) {
        setErr(`Ese código ya fue usado por ${codes[cd].usedBy||"otro participante"}.`);
        setBusy(false); return;
      }
    }

    const users=(await dbGet("users_v2"))||{};
    if(users[u]){setErr("Ese usuario ya existe.");setBusy(false);return;}
    users[u]={name:n,pass:btoa(pass)};
    await dbSet("users_v2",users);

    // ── Marcar código como usado (salvo master) ───────────────
    if (!isMaster) {
      const codes = await dbGet(CODES_KEY)||{};
      codes[cd] = { used:true, usedBy:u, usedByName:n, usedAt:Date.now() };
      await dbSet(CODES_KEY, codes);
    }

    // ── Agregar al grupo ──────────────────────────────────────
    const members=(await dbGet(MEMBERS_KEY))||[];
    if(!members.some(m=>m.username===u)){
      members.push({username:u,name:n,joinedAt:Date.now(),accessCode:isMaster?"MASTER":cd});
      await dbSet(MEMBERS_KEY,members);
    }
    onLogin({username:u,name:n,isSA:false,inGroup:true});
    setBusy(false);
  }

  return (
    <div style={{minHeight:"100vh",background:`linear-gradient(160deg,#071e55 0%,#1443a0 60%,#1a56c4 100%)`,
      display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
      <style>{CSS}</style>
      <div style={{background:"#fff",borderRadius:20,padding:"34px 28px",
        width:"100%",maxWidth:420,boxShadow:"0 20px 60px rgba(7,30,85,.5)"}}>
        <div style={{textAlign:"center",marginBottom:20}}>
          <img src="https://occstore.com.uy/wp-content/uploads/2024/03/cropped-OCCIco-1-300x300.png"
            style={{width:72,height:72,borderRadius:"50%",border:"3px solid #f0a500",objectFit:"cover"}}
            onError={e=>e.target.style.display="none"} alt="OCC"/>
        </div>
        <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:"1.6rem",fontWeight:900,
          color:"#071e55",textAlign:"center",lineHeight:1.1,marginBottom:4}}>
          PENCA MUNDIAL<br/>HOCKEY FEMENINO 2026
        </div>
        <div style={{fontSize:"0.8rem",color:"#718096",textAlign:"center",marginBottom:22}}>
          Bélgica · Países Bajos · 15–30 Agosto
        </div>

        {/* tabs */}
        <div style={{display:"flex",gap:4,background:"#eef0f3",borderRadius:8,padding:4,marginBottom:20}}>
          {[["login","Entrar"],["register","Registrarme"]].map(([id,lbl])=>(
            <button key={id} onClick={()=>{setMode(id);setErr("");setOk("");}}
              style={{flex:1,padding:"8px",border:"none",background:mode===id?"#fff":"transparent",
                borderRadius:6,fontSize:"0.9rem",fontWeight:600,
                color:mode===id?"#1443a0":"#718096",cursor:"pointer",
                boxShadow:mode===id?"0 1px 4px rgba(0,0,0,.1)":"none"}}>
              {lbl}
            </button>
          ))}
        </div>

        {err&&<div style={{background:"#fff5f5",border:"1px solid #fed7d7",color:"#c53030",
          borderRadius:8,padding:"9px 13px",fontSize:"0.85rem",marginBottom:12}}>{err}</div>}
        {ok&&<div style={{background:"#f0fff4",border:"1px solid #c6f6d5",color:"#276749",
          borderRadius:8,padding:"9px 13px",fontSize:"0.85rem",marginBottom:12}}>{ok}</div>}

        {mode==="login" ? (
          <>
            <div style={{marginBottom:13}}>
              <label style={{fontSize:"0.8rem",fontWeight:700,color:"#4a5568",display:"block",marginBottom:5}}>Usuario</label>
              <input style={{...S.inp,background:"#f8f9fa",border:"1.5px solid #dde1e7",color:"#1a202c"}}
                value={user} onChange={e=>setUser(e.target.value)} placeholder="tu usuario"
                autoCapitalize="none" onKeyDown={e=>e.key==="Enter"&&doLogin()}/>
            </div>
            <div style={{marginBottom:18}}>
              <label style={{fontSize:"0.8rem",fontWeight:700,color:"#4a5568",display:"block",marginBottom:5}}>Contraseña</label>
              <input type="password" style={{...S.inp,background:"#f8f9fa",border:"1.5px solid #dde1e7",color:"#1a202c"}}
                value={pass} onChange={e=>setPass(e.target.value)} placeholder="••••••••"
                onKeyDown={e=>e.key==="Enter"&&doLogin()}/>
            </div>
            <button style={S.btnP} onClick={doLogin} disabled={busy}>
              {busy?"Cargando...":"ENTRAR"}
            </button>
          </>
        ) : (
          <>
            <div style={{marginBottom:11}}>
              <label style={{fontSize:"0.8rem",fontWeight:700,color:"#4a5568",display:"block",marginBottom:5}}>Nombre para mostrar</label>
              <input style={{...S.inp,background:"#f8f9fa",border:"1.5px solid #dde1e7",color:"#1a202c"}}
                value={name} onChange={e=>setName(e.target.value)} placeholder="Ej: María G."/>
            </div>
            <div style={{marginBottom:11}}>
              <label style={{fontSize:"0.8rem",fontWeight:700,color:"#4a5568",display:"block",marginBottom:5}}>Usuario (sin espacios)</label>
              <input style={{...S.inp,background:"#f8f9fa",border:"1.5px solid #dde1e7",color:"#1a202c"}}
                value={user} onChange={e=>setUser(e.target.value)} placeholder="mariag"
                autoCapitalize="none"/>
            </div>
            <div style={{marginBottom:11}}>
              <label style={{fontSize:"0.8rem",fontWeight:700,color:"#4a5568",display:"block",marginBottom:5}}>Contraseña</label>
              <input type="password" style={{...S.inp,background:"#f8f9fa",border:"1.5px solid #dde1e7",color:"#1a202c"}}
                value={pass} onChange={e=>setPass(e.target.value)} placeholder="mínimo 4 caracteres"/>
            </div>
            <div style={{marginBottom:18}}>
              <label style={{fontSize:"0.8rem",fontWeight:700,color:"#4a5568",display:"block",marginBottom:5}}>Código de acceso personal</label>
              <input style={{...S.inp,background:"#f8f9fa",border:"1.5px solid #dde1e7",color:"#1a202c",
                textTransform:"uppercase",letterSpacing:2,fontWeight:700}}
                value={code} onChange={e=>setCode(e.target.value)} placeholder="Te lo da el administrador"/>
              <div style={{fontSize:"0.72rem",color:"#718096",marginTop:4}}>Cada código es de un solo uso 🔑</div>
            </div>
            <button style={S.btnP} onClick={doRegister} disabled={busy}>
              {busy?"Creando cuenta...":"CREAR CUENTA"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
//  USUARIO NORMAL — APP
// ─────────────────────────────────────────────────────────────
function UserApp({user, onLogout, showToast}) {
  const [tab,setTab]=useState("partidos");
  const [preds,setPreds]=useState(null);
  const [results,setResults]=useState(null);
  const [members,setMembers]=useState(null);
  const [users,setUsers]=useState(null);

  const load=useCallback(async()=>{
    const [p,r,m,u]=await Promise.all([
      dbGet(PREDS_KEY), dbGet(RESULTS_KEY), dbGet(MEMBERS_KEY), dbGet("users_v2")
    ]);
    setPreds(p||{}); setResults(r||{}); setMembers(m||[]); setUsers(u||{});
  },[]);
  useEffect(()=>{load();},[load]);

  // Refrescar resultados cuando se cambia a tabla/partidos
  useEffect(()=>{
    if(tab==="partidos"||tab==="tabla"){
      dbGet(RESULTS_KEY).then(r=>{ if(r) setResults(r); });
    }
  },[tab]);

  async function savePred(matchId,home,away) {
    const p={...(preds||{})};
    if(!p[user.username]) p[user.username]={};
    p[user.username][matchId]={home,away};
    await dbSet(PREDS_KEY,p);
    setPreds(p);
    showToast("✅ Pronóstico guardado");
  }

  const ranked=members&&preds&&results
    ?[...members].map(m=>{
        const st=calcUserStats(m.username,preds,results);
        return{...m,...st};
      }).sort((a,b)=>b.total-a.total)
    :[];

  const poolColors={"A":"#2563eb","B":"#7c3aed","C":"#0891b2","D":"#0f766e"};
  const medals=["🥇","🥈","🥉"];

  // ── PARTIDOS ──
  function renderPartidos() {
    if(!preds||!results) return <Spinner/>;
    const myPreds=preds[user.username]||{};
    return <>
      {["A","B","C","D"].map(pk=>(
        <div key={pk} style={{marginBottom:24}}>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
            <div style={{width:4,height:20,background:poolColors[pk],borderRadius:2}}/>
            <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,
              fontSize:"1rem",letterSpacing:1,color:C.accHi}}>
              {POOLS[pk].name}
              <span style={{fontSize:"0.72rem",color:C.muted,fontWeight:400,marginLeft:6}}>
                {POOLS[pk].venue}
              </span>
            </div>
          </div>
          {MATCHES.filter(m=>m.pool===pk).map(m=>{
            const r=results[m.id]||null;
            const pred=myPreds[m.id]||null;
            const pts=r&&pred?calcPoints(pred,r):null;
            return <MatchCard key={m.id} match={m} result={r} pred={pred} pts={pts} onSave={savePred}/>;
          })}
        </div>
      ))}
    </>;
  }

  // ── TABLA ──
  function renderTabla() {
    if(!members||!preds||!results) return <Spinner/>;
    return <>
      <div style={{...S.cardB,marginBottom:16}}>
        <div style={S.h3}>🏆 Clasificación</div>
        {ranked.length===0
          ?<div style={{...S.gray,textAlign:"center",padding:"20px 0"}}>Sin datos todavía</div>
          :ranked.map((r,i)=>(
            <div key={r.username} style={{
              display:"flex",alignItems:"center",gap:12,
              padding:"11px 0",
              borderBottom:i<ranked.length-1?`1px solid ${C.bdr}`:"none",
              background:r.username===user.username?"rgba(37,99,235,.08)":"transparent",
              borderRadius:6,paddingLeft:r.username===user.username?8:0}}>
              <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:"1.4rem",
                color:["#f1c40f","#bdc3c7","#e67e22"][i]||C.muted,minWidth:32,textAlign:"center"}}>
                {medals[i]||i+1}
              </div>
              <div style={{flex:1}}>
                <div style={{fontWeight:700,fontSize:"0.92rem"}}>
                  {r.name}
                  {r.username===user.username&&
                    <span style={{marginLeft:8,background:"rgba(37,99,235,.15)",
                      border:`1px solid ${C.bdrHi}`,color:C.accHi,
                      fontSize:"0.65rem",fontWeight:700,padding:"1px 7px",borderRadius:20}}>Vos</span>}
                </div>
                <div style={{fontSize:"0.72rem",color:C.muted,marginTop:2}}>
                  <span style={{color:"#4ade80"}}>⭐{r.exact}</span>{" "}
                  <span style={{color:"#fcd34d"}}>🎯{r.diff}</span>{" "}
                  <span style={{color:"#93c5fd"}}>✔️{r.winner}</span>{" "}
                  <span>{r.played} pronósticos</span>
                </div>
              </div>
              <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:"1.8rem",
                fontWeight:900,color:C.gold}}>{r.total}</div>
            </div>
          ))
        }
      </div>
      <div style={{...S.card,fontSize:"0.79rem",color:C.muted}}>
        <strong style={{color:C.text}}>Puntos: </strong>
        <span style={{color:"#4ade80"}}>3pts</span> exacto · {" "}
        <span style={{color:"#4ade80"}}>3pts</span> empate exacto · {" "}
        <span style={{color:"#fcd34d"}}>2pts</span> diferencia · {" "}
        <span style={{color:"#93c5fd"}}>1pt</span> ganador · {" "}
        <span style={{color:"#93c5fd"}}>1pt</span> empate (no exacto)
      </div>
    </>;
  }

  // ── MI GRUPO ──
  function renderGrupo() {
    return <>
      <div style={S.cardB}>
        <div style={S.h3}>🔑 Código de invitación</div>
        <div style={{background:C.hdr,color:C.goldHi,fontFamily:"monospace",
          fontSize:"1.8rem",fontWeight:700,textAlign:"center",
          padding:"14px",borderRadius:8,letterSpacing:6,marginBottom:8}}>
          {THE_GROUP.code}
        </div>
        <p style={{...S.gray,textAlign:"center"}}>Compartí este código para que se anoten.</p>
      </div>
      <div style={S.card}>
        <div style={S.h3}>👥 Participantes ({(members||[]).length})</div>
        {(members||[]).map(m=>(
          <div key={m.username} style={{padding:"9px 0",
            borderBottom:`1px solid ${C.bdr}`,fontSize:"0.9rem",
            display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <span>{m.name}</span>
            {m.username===user.username&&
              <span style={{fontSize:"0.7rem",color:C.accHi,
                background:"rgba(37,99,235,.1)",padding:"2px 8px",borderRadius:20}}>Vos</span>}
          </div>
        ))}
      </div>
    </>;
  }

  return (
    <div style={S.wrap}>
      <style>{CSS}</style>
      <header style={S.hdr}>
        <div>
          <div style={S.logo}>PENCA HOCKEY <span style={{color:C.gold}}>2026</span></div>
          <div style={S.logoSub}>Copa Mundial Femenino</div>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <span style={{...S.gray,fontSize:"0.8rem"}}>{user.name}</span>
          <button style={S.btnO} onClick={onLogout}>Salir</button>
        </div>
      </header>
      <div style={S.cont}>
        {tab==="partidos" && renderPartidos()}
        {tab==="tabla"    && renderTabla()}
        {tab==="grupo"    && renderGrupo()}
      </div>
      <BottomNav active={tab} onChange={setTab} isSA={false}/>
    </div>
  );
}

// ─── MATCH CARD ───────────────────────────────────────────────
function MatchCard({match:m, result, pred, pts, onSave}) {
  const [h,setH]=useState(pred?String(pred.home):"");
  const [a,setA]=useState(pred?String(pred.away):"");
  useEffect(()=>{setH(pred?String(pred.home):"");setA(pred?String(pred.away):"");},[pred]);

  function save(){
    const hv=parseInt(h),av=parseInt(a);
    if(isNaN(hv)||isNaN(av)||hv<0||av<0) return;
    onSave(m.id,hv,av);
  }

  return (
    <div style={{...S.card,
      borderColor:result?"rgba(240,165,0,.35)":pred?C.bdrHi:C.bdr,
      marginBottom:8}}>
      <div style={{fontSize:"0.68rem",color:C.muted,textTransform:"uppercase",
        letterSpacing:.5,marginBottom:8}}>
        {m.date} · {m.time} (UY)
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr auto 1fr",alignItems:"center",gap:8}}>
        {/* Home */}
        <div><TName name={m.home}/></div>
        {/* Score center */}
        <div style={{textAlign:"center",minWidth:100}}>
          {result ? (
            <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:"1.6rem",
              fontWeight:900,color:C.gold,letterSpacing:2}}>
              {result.home}–{result.away}
            </div>
          ) : (
            <div style={{display:"flex",alignItems:"center",gap:4,justifyContent:"center"}}>
              <input style={S.sI} type="number" min="0" max="20" value={h}
                onChange={e=>setH(e.target.value)} onBlur={save}/>
              <span style={{color:C.muted,fontWeight:700}}>–</span>
              <input style={S.sI} type="number" min="0" max="20" value={a}
                onChange={e=>setA(e.target.value)} onBlur={save}/>
            </div>
          )}
        </div>
        {/* Away */}
        <div style={{textAlign:"right"}}><TName name={m.away} right/></div>
      </div>
      {/* Bottom info */}
      {result && pred && (
        <div style={{marginTop:8,display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
          <span style={{fontSize:"0.75rem",color:C.muted}}>
            Tu pronóstico: <strong style={{color:C.text}}>{pred.home}–{pred.away}</strong>
          </span>
          {pts!==null&&(
            <span style={{fontSize:"0.72rem",fontWeight:700,padding:"2px 8px",borderRadius:20,
              background:ptsBg(pts),color:ptsColor(pts)}}>
              {ptsLabel(pts)}
            </span>
          )}
        </div>
      )}
      {!result && pred && (
        <div style={{marginTop:6,fontSize:"0.75rem",color:C.success,fontWeight:600}}>
          ✓ Guardado: {pred.home}–{pred.away}
          <button onClick={()=>{setH("");setA("");onSave(m.id,parseInt(h)||0,parseInt(a)||0);}}
            style={{...S.btnO,fontSize:"0.7rem",padding:"2px 8px",marginLeft:8}}>Editar</button>
        </div>
      )}
      {!result && !pred && (
        <div style={{marginTop:8,textAlign:"center"}}>
          <button style={{...S.btnSm,fontSize:"0.78rem",padding:"6px 16px"}} onClick={save}>
            💾 Guardar pronóstico
          </button>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
//  SUPER ADMIN APP
// ─────────────────────────────────────────────────────────────
function SuperAdminApp({onLogout,showToast}) {
  const [tab,setTab]=useState("resultados");
  const [results,setResults]=useState(null);
  const [members,setMembers]=useState(null);
  const [preds,setPreds]=useState(null);
  const [scores,setScores]=useState({});  // temp scores for inputs
  const [codes,setCodes]=useState(null);
  const [codeFilter,setCodeFilter]=useState("all"); // all | used | available

  const load=useCallback(async()=>{
    const [r,m,p,cd]=await Promise.all([
      dbGet(RESULTS_KEY), dbGet(MEMBERS_KEY), dbGet(PREDS_KEY), initCodes()
    ]);
    const re=r||{}, me=m||[], pr=p||{};
    setResults(re); setMembers(me); setPreds(pr); setCodes(cd||{});
    const init={};
    MATCHES.forEach(mm=>{
      const rv=re[mm.id];
      init[mm.id]={h:rv!=null?String(rv.home):"",a:rv!=null?String(rv.away):""};
    });
    setScores(init);
  },[]);
  useEffect(()=>{load();},[load]);

  async function saveResult(matchId) {
    const hv=parseInt(scores[matchId]?.h), av=parseInt(scores[matchId]?.a);
    if(isNaN(hv)||isNaN(av)||hv<0||av<0){showToast("⚠️ Valores inválidos");return;}
    const r={...(results||{})};
    r[matchId]={home:hv,away:av};
    await dbSet(RESULTS_KEY,r);
    setResults(r);
    showToast("✅ Resultado guardado para todos");
  }

  async function clearResult(matchId) {
    const r={...(results||{})};
    delete r[matchId];
    await dbSet(RESULTS_KEY,r);
    setResults(r);
    setScores(p=>({...p,[matchId]:{h:"",a:""}}));
    showToast("Resultado eliminado");
  }

  async function removeMember(username) {
    if(!window.confirm(`¿Eliminar a "${username}" del grupo?`)) return;
    const me=(await dbGet(MEMBERS_KEY))||[];
    const updated=me.filter(m=>m.username!==username);
    await dbSet(MEMBERS_KEY,updated);
    setMembers(updated);
    // also remove their predictions
    const pr=(await dbGet(PREDS_KEY))||{};
    delete pr[username];
    await dbSet(PREDS_KEY,pr);
    setPreds(pr);
    showToast(`🗑️ ${username} eliminado del grupo`);
  }

  const ranked=members&&preds&&results
    ?[...members].map(m=>({...m,...calcUserStats(m.username,preds,results)}))
       .sort((a,b)=>b.total-a.total)
    :[];
  const medals=["🥇","🥈","🥉"];
  const poolColors={"A":"#2563eb","B":"#7c3aed","C":"#0891b2","D":"#0f766e"};

  // ── RESULTADOS ──
  function renderResultados() {
    if(!results) return <Spinner/>;
    return <>
      <div style={{...S.cardY,marginBottom:16}}>
        <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:"1.1rem",fontWeight:900,
          color:C.gold,marginBottom:6,letterSpacing:.5}}>
          ⚙️ Resultados Oficiales
        </div>
        <p style={{...S.gray,marginBottom:0,fontSize:"0.8rem"}}>
          Aplican a todos los participantes. Los puntos se calculan automáticamente.
        </p>
      </div>
      {["A","B","C","D"].map(pk=>(
        <div key={pk} style={{marginBottom:20}}>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
            <div style={{width:4,height:18,background:poolColors[pk],borderRadius:2}}/>
            <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,
              fontSize:"0.95rem",letterSpacing:1,color:C.accHi}}>{POOLS[pk].name}</div>
          </div>
          {MATCHES.filter(m=>m.pool===pk).map(m=>{
            const r=results[m.id];
            return (
              <div key={m.id} style={{...S.card,marginBottom:6,
                borderColor:r?"rgba(240,165,0,.35)":C.bdr}}>
                <div style={{display:"grid",gridTemplateColumns:"1fr auto 1fr auto",
                  alignItems:"center",gap:8,flexWrap:"wrap"}}>
                  <div style={{fontSize:"0.82rem",fontWeight:600}}>
                    <TName name={m.home}/>
                  </div>
                  <div style={{display:"flex",alignItems:"center",gap:4}}>
                    <button style={{...S.btnO,width:28,height:28,padding:0,textAlign:"center",fontSize:"1rem"}}
                      onClick={()=>setScores(p=>({...p,[m.id]:{...p[m.id],h:String(Math.max(0,(parseInt(p[m.id]?.h)||0)-1))}}))}>−</button>
                    <span style={{minWidth:24,textAlign:"center",fontFamily:"'Barlow Condensed',sans-serif",
                      fontSize:"1.2rem",fontWeight:700,color:C.text}}>
                      {scores[m.id]?.h||"0"}
                    </span>
                    <button style={{...S.btnO,width:28,height:28,padding:0,textAlign:"center",fontSize:"1rem"}}
                      onClick={()=>setScores(p=>({...p,[m.id]:{...p[m.id],h:String((parseInt(p[m.id]?.h)||0)+1)}}))}>+</button>
                    <span style={{color:C.muted,fontWeight:700,margin:"0 2px"}}>–</span>
                    <button style={{...S.btnO,width:28,height:28,padding:0,textAlign:"center",fontSize:"1rem"}}
                      onClick={()=>setScores(p=>({...p,[m.id]:{...p[m.id],a:String(Math.max(0,(parseInt(p[m.id]?.a)||0)-1))}}))}>−</button>
                    <span style={{minWidth:24,textAlign:"center",fontFamily:"'Barlow Condensed',sans-serif",
                      fontSize:"1.2rem",fontWeight:700,color:C.text}}>
                      {scores[m.id]?.a||"0"}
                    </span>
                    <button style={{...S.btnO,width:28,height:28,padding:0,textAlign:"center",fontSize:"1rem"}}
                      onClick={()=>setScores(p=>({...p,[m.id]:{...p[m.id],a:String((parseInt(p[m.id]?.a)||0)+1)}}))}>+</button>
                  </div>
                  <div style={{fontSize:"0.82rem",fontWeight:600,textAlign:"right"}}>
                    <TName name={m.away} right/>
                  </div>
                  <div style={{display:"flex",gap:5,alignItems:"center"}}>
                    <button style={S.btnY} onClick={()=>saveResult(m.id)}>Guardar</button>
                    {r&&<button style={S.btnR} onClick={()=>clearResult(m.id)}>✕</button>}
                  </div>
                </div>
                {r&&<div style={{marginTop:6,fontSize:"0.72rem",color:C.gold,fontWeight:700}}>
                  ✓ Oficial: {r.home}–{r.away}
                </div>}
              </div>
            );
          })}
        </div>
      ))}
    </>;
  }

  // ── TABLA (SA ve todo) ──
  function renderTabla() {
    if(!members||!preds||!results) return <Spinner/>;
    return <>
      <div style={{...S.cardB,marginBottom:16}}>
        <div style={S.h3}>🏆 Clasificación — {(members||[]).length} participantes</div>
        {ranked.length===0
          ?<div style={{...S.gray,textAlign:"center",padding:"20px 0"}}>Sin datos todavía</div>
          :ranked.map((r,i)=>(
            <div key={r.username} style={{
              display:"flex",alignItems:"center",gap:12,
              padding:"11px 0",
              borderBottom:i<ranked.length-1?`1px solid ${C.bdr}`:"none"}}>
              <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:"1.4rem",
                color:["#f1c40f","#bdc3c7","#e67e22"][i]||C.muted,minWidth:32,textAlign:"center"}}>
                {medals[i]||i+1}
              </div>
              <div style={{flex:1}}>
                <div style={{fontWeight:700,fontSize:"0.92rem"}}>{r.name}</div>
                <div style={{fontSize:"0.72rem",color:C.muted,marginTop:2}}>
                  <span style={{color:"#4ade80"}}>⭐{r.exact}</span>{" "}
                  <span style={{color:"#fcd34d"}}>🎯{r.diff}</span>{" "}
                  <span style={{color:"#93c5fd"}}>✔️{r.winner}</span>{" "}
                  <span>{r.played} pronóst.</span>
                </div>
              </div>
              <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:"1.8rem",
                fontWeight:900,color:C.gold}}>{r.total}</div>
            </div>
          ))
        }
      </div>
      <div style={{...S.card,fontSize:"0.79rem",color:C.muted}}>
        <strong style={{color:C.text}}>Puntos: </strong>
        <span style={{color:"#4ade80"}}>3pts</span> exacto · {" "}
        <span style={{color:"#4ade80"}}>3pts</span> empate exacto · {" "}
        <span style={{color:"#fcd34d"}}>2pts</span> diferencia · {" "}
        <span style={{color:"#93c5fd"}}>1pt</span> ganador/empate (no exacto)
      </div>
    </>;
  }

  // ── MIEMBROS ──
  function renderMiembros() {
    if(!members) return <Spinner/>;
    return (
      <div style={S.card}>
        <div style={S.h3}>👥 Participantes ({members.length})</div>
        <div style={{...S.gray,marginBottom:14,fontSize:"0.79rem"}}>
          Podés eliminar participantes que no pagaron la penca.
        </div>
        {members.length===0
          ?<div style={{...S.gray,textAlign:"center",padding:"20px 0"}}>Sin participantes aún</div>
          :members.map(m=>(
            <div key={m.username} style={{
              display:"flex",alignItems:"center",gap:12,
              padding:"10px 0",borderBottom:`1px solid ${C.bdr}`}}>
              <div style={{flex:1}}>
                <div style={{fontWeight:700,fontSize:"0.9rem"}}>{m.name}</div>
                <div style={{...S.gray,fontSize:"0.75rem"}}>@{m.username}</div>
              </div>
              <button style={S.btnR} onClick={()=>removeMember(m.username)}>
                🗑️ Eliminar
              </button>
            </div>
          ))
        }
      </div>
    );
  }

  // ── CÓDIGOS DE ACCESO ──
  function renderCodigos() {
    if(!codes) return <Spinner/>;
    const allCodes    = Object.entries(codes);
    const used        = allCodes.filter(([,v])=>v.used);
    const available   = allCodes.filter(([,v])=>!v.used);
    const filtered    = codeFilter==="used"?"u":codeFilter==="available"?"a":"all";
    const displayed   = filtered==="u"?used:filtered==="a"?available:allCodes;

    async function revokeCode(code) {
      if(!window.confirm(`¿Revocar ${code}? Quedará inutilizable.`)) return;
      const cd=await dbGet(CODES_KEY)||{};
      cd[code]={used:true,usedBy:"[REVOCADO]",usedByName:"[Revocado por admin]",usedAt:Date.now()};
      await dbSet(CODES_KEY,cd); setCodes({...cd});
      showToast(`Código ${code} revocado`);
    }
    async function restoreCode(code) {
      if(!window.confirm(`¿Restaurar ${code} para que se pueda usar de nuevo?`)) return;
      const cd=await dbGet(CODES_KEY)||{};
      cd[code]={used:false,usedBy:null,usedByName:null,usedAt:null};
      await dbSet(CODES_KEY,cd); setCodes({...cd});
      showToast(`Código ${code} restaurado ✅`);
    }
    function copyAvailable() {
      const txt=available.map(([c])=>c).join("\n");
      navigator.clipboard.writeText(txt).then(()=>showToast(`📋 ${available.length} códigos copiados`));
    }

    return <>
      {/* Master code */}
      <div style={{...S.cardY,marginBottom:14}}>
        <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:"1rem",fontWeight:900,
          color:C.gold,marginBottom:6}}>👑 Código Maestro (uso ilimitado)</div>
        <div style={{fontFamily:"monospace",fontSize:"1.2rem",fontWeight:700,
          letterSpacing:4,color:C.text,background:"rgba(0,0,0,.25)",
          padding:"10px 16px",borderRadius:8,display:"inline-block",marginBottom:6}}>
          {MASTER_CODE}
        </div>
        <div style={{...S.gray,fontSize:"0.78rem"}}>
          Este código nunca se consume. Usalo en emergencias.
        </div>
      </div>

      {/* Stats */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,marginBottom:14}}>
        {[["Total",allCodes.length,C.accHi],["Usados",used.length,"#f87171"],["Disponibles",available.length,"#4ade80"]].map(([lbl,val,col])=>(
          <div key={lbl} style={{...S.card,textAlign:"center",padding:"12px 6px"}}>
            <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:"1.7rem",fontWeight:900,color:col}}>{val}</div>
            <div style={{...S.gray,fontSize:"0.7rem"}}>{lbl}</div>
          </div>
        ))}
      </div>

      {/* Filter + copy */}
      <div style={{display:"flex",gap:6,marginBottom:12,flexWrap:"wrap",alignItems:"center"}}>
        {[["all","Todos"],["available","Disponibles"],["used","Usados"]].map(([f,lbl])=>(
          <button key={f} onClick={()=>setCodeFilter(f)} style={{
            ...S.btnO,fontSize:"0.76rem",padding:"5px 11px",
            background:codeFilter===f?C.accDk:"transparent",
            color:codeFilter===f?"#fff":C.muted,
            border:codeFilter===f?`1px solid ${C.acc}`:"1px solid rgba(255,255,255,.12)"}}>
            {lbl}
          </button>
        ))}
        <button onClick={copyAvailable} style={{...S.btnSm,fontSize:"0.76rem",padding:"5px 12px",marginLeft:"auto"}}>
          📋 Copiar disponibles ({available.length})
        </button>
      </div>

      {/* List */}
      <div style={{...S.card,padding:"10px 12px",maxHeight:440,overflowY:"auto"}}>
        {displayed.length===0
          ?<div style={{...S.gray,textAlign:"center",padding:"20px 0"}}>Sin códigos</div>
          :displayed.map(([code,info])=>(
            <div key={code} style={{
              display:"flex",alignItems:"center",gap:8,
              padding:"6px 0",borderBottom:`1px solid ${C.bdr}`}}>
              <div style={{fontFamily:"monospace",fontSize:"0.85rem",fontWeight:700,
                minWidth:110,color:info.used?"#f87171":"#4ade80",letterSpacing:1}}>
                {code}
              </div>
              <div style={{flex:1,...S.gray,fontSize:"0.72rem",lineHeight:1.3}}>
                {info.used
                  ?<><strong style={{color:C.text}}>{info.usedByName||info.usedBy}</strong>
                    {info.usedAt?` · ${new Date(info.usedAt).toLocaleDateString("es-UY")}`:""}</>
                  :<span style={{color:"#4ade80"}}>Disponible</span>
                }
              </div>
              {info.used
                ?<button style={{...S.btnO,fontSize:"0.68rem",padding:"3px 8px"}} onClick={()=>restoreCode(code)}>↩</button>
                :<button style={{...S.btnR,fontSize:"0.68rem",padding:"3px 8px"}} onClick={()=>revokeCode(code)}>✕</button>
              }
            </div>
          ))
        }
      </div>
    </>;
  }

  return (
    <div style={S.wrap}>
      <style>{CSS}</style>
      <header style={S.hdr}>
        <div>
          <div style={S.logo}>PENCA HOCKEY <span style={{color:C.gold}}>2026</span></div>
          <div style={S.logoSub}>Panel Super Admin</div>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <span style={{background:"rgba(240,165,0,.12)",border:"1px solid rgba(240,165,0,.3)",
            color:C.gold,fontSize:"0.7rem",fontWeight:700,padding:"3px 9px",borderRadius:20}}>
            ⚙️ ADMIN
          </span>
          <button style={S.btnO} onClick={onLogout}>Salir</button>
        </div>
      </header>
      <div style={S.cont}>
        {tab==="resultados" && renderResultados()}
        {tab==="tabla"      && renderTabla()}
        {tab==="miembros"   && renderMiembros()}
        {tab==="codigos"    && renderCodigos()}
      </div>
      <BottomNav active={tab} onChange={setTab} isSA={true}/>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
//  ROOT
// ─────────────────────────────────────────────────────────────
export default function App() {
  const [session,setSession]=useState(()=>{
    try{const s=sessionStorage.getItem("ph26_v2");return s?JSON.parse(s):null;}catch{return null;}
  });
  const [toast,setToast]=useState(""); const tmr={current:null};

  function showToast(msg){setToast(msg);clearTimeout(tmr.current);tmr.current=setTimeout(()=>setToast(""),3000);}
  function login(u){sessionStorage.setItem("ph26_v2",JSON.stringify(u));setSession(u);}
  function logout(){sessionStorage.removeItem("ph26_v2");setSession(null);}

  if(!session) return <><AuthScreen onLogin={login}/><Toast msg={toast}/></>;
  if(session.isSA) return <><SuperAdminApp onLogout={logout} showToast={showToast}/><Toast msg={toast}/></>;
  return <><UserApp user={session} onLogout={logout} showToast={showToast}/><Toast msg={toast}/></>;
}
