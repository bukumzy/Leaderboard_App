import { useState, useEffect, useCallback, useRef } from "react";
import { db, ref, set, onValue } from "./firebase";

const DB_PATH = "quiz";
const ADMIN_PASSWORD = import.meta.env.VITE_ADMIN_PASSWORD || "oakwood2024";

const YEAR_GROUPS = ["Year 1", "Year 2", "Year 3", "Year 4", "Year 5", "Year 6"];

const defaultData = {
  eventTitle: "Academic Quiz Championship",
  currentRound: 1,
  totalRounds: 5,
  teams: [],
  lastUpdated: null,
  scoreboardHidden: false,
  winnerRevealed: false,
  roundTimer: { duration: 0, startedAt: null, running: false },
  activeYearGroup: "Year 1",
  archivedResults: {}, // { "Year 1": { teams: [...sorted], lockedAt: "..." }, ... }
};

function generateId() {
  return Math.random().toString(36).substr(2, 9);
}

function normalizeTeams(val) {
  return {
    ...val,
    teams: val.teams
      ? Array.isArray(val.teams) ? val.teams : Object.values(val.teams)
      : [],
    archivedResults: val.archivedResults || {},
  };
}

function getTotal(team) {
  return Object.values(team.rounds || {}).reduce((s, v) => s + (v || 0), 0);
}

// ── Password Gate ──────────────────────────────────────────────────────────
function PasswordGate({ onUnlock }) {
  const [input, setInput] = useState("");
  const [error, setError] = useState(false);
  const [shake, setShake] = useState(false);

  const attempt = () => {
    if (input === ADMIN_PASSWORD) {
      sessionStorage.setItem("quiz_admin_auth", "1");
      onUnlock();
    } else {
      setError(true); setShake(true);
      setTimeout(() => setShake(false), 500);
      setInput("");
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "#0f0f14", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Georgia, serif" }}>
      <style>{`@keyframes shake{0%,100%{transform:translateX(0)}20%{transform:translateX(-10px)}40%{transform:translateX(10px)}60%{transform:translateX(-6px)}80%{transform:translateX(6px)}}`}</style>
      <div style={{ background: "#16161f", border: "1px solid #2a2a3a", borderRadius: 20, padding: "48px 40px", width: 340, textAlign: "center", animation: shake ? "shake 0.5s ease" : "none" }}>
        <div style={{ fontSize: 42, marginBottom: 14 }}>🔐</div>
        <h2 style={{ color: "#e8d5a3", margin: "0 0 6px", fontSize: 22 }}>Admin Access</h2>
        <p style={{ color: "#555", fontSize: 13, marginBottom: 28 }}>Enter password to continue</p>
        <input type="password" value={input} autoFocus onChange={(e) => { setInput(e.target.value); setError(false); }} onKeyDown={(e) => e.key === "Enter" && attempt()} placeholder="Password"
          style={{ width: "100%", boxSizing: "border-box", background: "#1e1e2e", border: `1px solid ${error ? "#e74c3c" : "#2a2a3a"}`, color: "#e8d5a3", padding: "12px 16px", borderRadius: 10, fontFamily: "Georgia, serif", fontSize: 15, marginBottom: 10 }} />
        {error && <p style={{ color: "#e74c3c", fontSize: 13, margin: "0 0 12px" }}>Incorrect password. Try again.</p>}
        <button onClick={attempt} style={{ width: "100%", background: "linear-gradient(135deg,#c9a84c,#e8d5a3)", color: "#0f0f14", border: "none", borderRadius: 10, padding: "12px", fontSize: 15, fontWeight: 700, fontFamily: "Georgia, serif", cursor: "pointer" }}>Unlock</button>
      </div>
    </div>
  );
}

// ── Round Timer ────────────────────────────────────────────────────────────
function RoundTimerControl({ timer, onUpdate }) {
  const [minutes, setMinutes] = useState(5);
  const [display, setDisplay] = useState("05:00");

  useEffect(() => {
    if (!timer?.running || !timer?.startedAt) { setDisplay(`${String(minutes).padStart(2,"0")}:00`); return; }
    const tick = () => {
      const elapsed = Math.floor((Date.now() - timer.startedAt) / 1000);
      const remaining = Math.max(0, timer.duration - elapsed);
      setDisplay(`${Math.floor(remaining/60).toString().padStart(2,"0")}:${(remaining%60).toString().padStart(2,"0")}`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [timer, minutes]);

  return (
    <div style={{ background: "#16161f", borderRadius: 14, border: "1px solid #2a2a3a", padding: "16px 20px" }}>
      <h3 style={{ margin: "0 0 10px", fontSize: 11, letterSpacing: 1.2, textTransform: "uppercase", color: "#666" }}>Round Timer</h3>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <span style={{ fontSize: 30, fontWeight: 700, color: timer?.running ? "#c9a84c" : "#444", fontVariantNumeric: "tabular-nums", minWidth: 90 }}>{display}</span>
        <input type="number" min={1} max={60} value={minutes} onChange={(e) => setMinutes(Math.max(1,parseInt(e.target.value)||1))} disabled={timer?.running} style={{ width: 50, background: "#1e1e2e", border: "1px solid #2a2a3a", color: "#e8d5a3", padding: "6px 8px", borderRadius: 8, fontFamily: "Georgia, serif", fontSize: 14, textAlign: "center" }} />
        <span style={{ color: "#555", fontSize: 12 }}>min</span>
        {!timer?.running
          ? <button onClick={() => onUpdate({ duration: minutes*60, startedAt: Date.now(), running: true })} style={{ background: "#c9a84c", color: "#0f0f14", border: "none", borderRadius: 8, padding: "8px 16px", cursor: "pointer", fontFamily: "Georgia, serif", fontWeight: 700, fontSize: 13 }}>▶ Start</button>
          : <button onClick={() => onUpdate({ ...timer, running: false })} style={{ background: "#e74c3c", color: "#fff", border: "none", borderRadius: 8, padding: "8px 16px", cursor: "pointer", fontFamily: "Georgia, serif", fontWeight: 700, fontSize: 13 }}>⏸ Pause</button>
        }
        <button onClick={() => { setDisplay(`${String(minutes).padStart(2,"0")}:00`); onUpdate({ duration:0, startedAt:null, running:false }); }} style={{ background: "none", border: "1px solid #2a2a3a", color: "#666", borderRadius: 8, padding: "8px 14px", cursor: "pointer", fontFamily: "Georgia, serif", fontSize: 13 }}>↺ Reset</button>
      </div>
    </div>
  );
}

// ── Main Admin ─────────────────────────────────────────────────────────────
export default function AdminPanel() {
  const [authed, setAuthed] = useState(!!sessionStorage.getItem("quiz_admin_auth"));
  const [data, setData] = useState(defaultData);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState(null);
  const [connected, setConnected] = useState(true);
  const [newTeamName, setNewTeamName] = useState("");
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleInput, setTitleInput] = useState("");
  const [activeTab, setActiveTab] = useState("scores");
  const [editingTeamId, setEditingTeamId] = useState(null);
  const [editingTeamName, setEditingTeamName] = useState("");
  const debounceRef = useRef(null);

  useEffect(() => {
    if (!authed) return;
    const unsub = onValue(ref(db, DB_PATH), (snap) => {
      const val = snap.val();
      if (val) setData(normalizeTeams(val));
      setLoading(false);
    });
    const unsubConn = onValue(ref(db, ".info/connected"), (snap) => setConnected(!!snap.val()));
    return () => { unsub(); unsubConn(); };
  }, [authed]);

  const saveData = useCallback(async (newData) => {
    setSaving(true); setSaveStatus(null);
    const updated = { ...newData, lastUpdated: new Date().toISOString() };
    try {
      await set(ref(db, DB_PATH), updated);
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus(null), 2000);
    } catch { setSaveStatus("error"); }
    finally { setSaving(false); }
  }, []);

  const addTeam = () => {
    if (!newTeamName.trim()) return;
    const newTeam = { id: generateId(), name: newTeamName.trim(), rounds: {}, color: `hsl(${Math.floor(Math.random()*360)},65%,55%)` };
    saveData({ ...data, teams: [...(data.teams||[]), newTeam] });
    setNewTeamName("");
  };

  const removeTeam = (id) => saveData({ ...data, teams: data.teams.filter((t) => t.id !== id) });

  const renameTeam = (id) => {
    if (!editingTeamName.trim()) return;
    saveData({ ...data, teams: data.teams.map((t) => t.id === id ? { ...t, name: editingTeamName.trim() } : t) });
    setEditingTeamId(null);
  };

  const updateScore = (teamId, round, value) => {
    const parsed = value === "" ? null : parseInt(value, 10);
    const updatedTeams = data.teams.map((t) =>
      t.id === teamId ? { ...t, rounds: { ...t.rounds, [round]: isNaN(parsed) ? null : parsed } } : t
    );
    const updatedData = { ...data, teams: updatedTeams };
    setData(updatedData);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => saveData(updatedData), 800);
  };

  // ── Lock & Archive current year group results ──
  const archiveYearGroup = () => {
    const yearGroup = data.activeYearGroup || "Year 1";
    const sorted = [...(data.teams||[])].sort((a,b) => getTotal(b) - getTotal(a));
    const archivedResults = {
      ...(data.archivedResults || {}),
      [yearGroup]: {
        teams: sorted.map((t) => ({ id: t.id, name: t.name, color: t.color, total: getTotal(t), rounds: t.rounds || {} })),
        lockedAt: new Date().toISOString(),
      },
    };
    // Find the next year group
    const currentIdx = YEAR_GROUPS.indexOf(yearGroup);
    const nextYearGroup = YEAR_GROUPS[currentIdx + 1] || yearGroup;

    if (!window.confirm(`Lock ${yearGroup} results and move to ${nextYearGroup}? This will clear current teams and scores.`)) return;

    saveData({
      ...data,
      teams: [],
      archivedResults,
      activeYearGroup: nextYearGroup,
      currentRound: 1,
      roundTimer: { duration: 0, startedAt: null, running: false },
    });
  };

  const sortedTeams = [...(data.teams||[])].sort((a,b) => getTotal(b) - getTotal(a));
  const rounds = Array.from({ length: data.totalRounds }, (_, i) => i + 1);
  const archivedYears = Object.keys(data.archivedResults || {});

  if (!authed) return <PasswordGate onUnlock={() => setAuthed(true)} />;
  if (loading) return <div style={{ display:"flex",alignItems:"center",justifyContent:"center",height:"100vh",background:"#0f0f14",color:"#e8d5a3",fontFamily:"Georgia,serif" }}>Connecting to Firebase…</div>;

  return (
    <div style={{ minHeight: "100vh", background: "#0f0f14", color: "#e8d5a3", fontFamily: "Georgia, serif" }}>
      <style>{`
        @media(max-width:680px){.admin-header{flex-direction:column!important;gap:12px!important}.score-table{min-width:480px}}
        input[type=number]::-webkit-inner-spin-button{opacity:1}
      `}</style>

      {/* ── Header ── */}
      <div style={{ background: "#16161f", borderBottom: "2px solid #2a2a3a", padding: "0 24px", position: "sticky", top: 0, zIndex: 10 }}>
        <div className="admin-header" style={{ maxWidth: 1100, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 0", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 36, height: 36, background: "linear-gradient(135deg,#c9a84c,#e8d5a3)", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>🎓</div>
            <div>
              {editingTitle ? (
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <input value={titleInput} onChange={(e) => setTitleInput(e.target.value)} onKeyDown={(e) => e.key==="Enter" && (() => { saveData({...data,eventTitle:titleInput}); setEditingTitle(false); })()} style={{ background:"#1e1e2e",border:"1px solid #c9a84c",color:"#e8d5a3",padding:"4px 10px",borderRadius:6,fontFamily:"Georgia,serif",fontSize:14 }} autoFocus />
                  <button onClick={() => { saveData({...data,eventTitle:titleInput}); setEditingTitle(false); }} style={{ background:"#c9a84c",color:"#0f0f14",border:"none",borderRadius:6,padding:"4px 10px",cursor:"pointer",fontFamily:"Georgia,serif",fontSize:12 }}>Save</button>
                  <button onClick={() => setEditingTitle(false)} style={{ background:"transparent",color:"#888",border:"1px solid #333",borderRadius:6,padding:"4px 8px",cursor:"pointer",fontSize:12 }}>✕</button>
                </div>
              ) : (
                <div style={{ display:"flex",alignItems:"center",gap:8 }}>
                  <span style={{ fontSize:16,fontWeight:700 }}>{data.eventTitle}</span>
                  <button onClick={() => { setEditingTitle(true); setTitleInput(data.eventTitle); }} style={{ background:"none",border:"none",color:"#666",cursor:"pointer",fontSize:12 }}>✏️</button>
                </div>
              )}
              <div style={{ fontSize:11,color:"#555",marginTop:2,display:"flex",alignItems:"center",gap:5 }}>
                <span style={{ width:6,height:6,borderRadius:"50%",background:connected?"#5cb85c":"#e74c3c",display:"inline-block" }} />
                {connected?"Connected":"Offline"} · Admin ·
                <span style={{ color:"#c9a84c",fontWeight:700 }}> {data.activeYearGroup || "Year 1"}</span>
              </div>
            </div>
          </div>

          <div style={{ display:"flex",alignItems:"center",gap:8,flexWrap:"wrap" }}>
            <button onClick={() => saveData({...data,scoreboardHidden:!data.scoreboardHidden})} style={{ background:data.scoreboardHidden?"#e74c3c22":"#1e1e2e",border:`1px solid ${data.scoreboardHidden?"#e74c3c":"#2a2a3a"}`,color:data.scoreboardHidden?"#e74c3c":"#888",borderRadius:8,padding:"6px 12px",cursor:"pointer",fontFamily:"Georgia,serif",fontSize:12 }}>
              {data.scoreboardHidden?"👁‍🗨 Hidden":"👁 Visible"}
            </button>
            <button onClick={() => saveData({...data,winnerRevealed:!data.winnerRevealed})} style={{ background:data.winnerRevealed?"#c9a84c22":"#1e1e2e",border:`1px solid ${data.winnerRevealed?"#c9a84c":"#2a2a3a"}`,color:data.winnerRevealed?"#c9a84c":"#888",borderRadius:8,padding:"6px 12px",cursor:"pointer",fontFamily:"Georgia,serif",fontSize:12 }}>
              🏆 {data.winnerRevealed?"Winner Live":"Reveal Winner"}
            </button>
            {saveStatus==="saved" && <span style={{ color:"#5cb85c",fontSize:12 }}>✓ Synced</span>}
            {saveStatus==="error" && <span style={{ color:"#e74c3c",fontSize:12 }}>✗ Failed</span>}
            {saving && <span style={{ color:"#c9a84c",fontSize:12 }}>Saving…</span>}
            <span style={{ background:"#1e1e2e",border:"1px solid #2a2a3a",borderRadius:6,padding:"5px 10px",fontSize:11,color:"#555" }}>
              {data.lastUpdated?new Date(data.lastUpdated).toLocaleTimeString():"Never"}
            </span>
          </div>
        </div>

        <div style={{ maxWidth:1100,margin:"0 auto",display:"flex",gap:2 }}>
          {["scores","teams","results","settings"].map((tab) => (
            <button key={tab} onClick={() => setActiveTab(tab)} style={{ background:activeTab===tab?"#c9a84c":"transparent",color:activeTab===tab?"#0f0f14":"#888",border:"none",padding:"9px 18px",borderRadius:"8px 8px 0 0",cursor:"pointer",fontFamily:"Georgia,serif",fontSize:13,fontWeight:activeTab===tab?700:400,textTransform:"capitalize" }}>
              {tab}{tab==="results" && archivedYears.length>0 && <span style={{ marginLeft:5,background:"#c9a84c",color:"#0f0f14",borderRadius:10,padding:"1px 6px",fontSize:10,fontWeight:700 }}>{archivedYears.length}</span>}
            </button>
          ))}
        </div>
      </div>

      <div style={{ maxWidth:1100,margin:"0 auto",padding:"24px 20px" }}>

        {/* ── SCORES TAB ── */}
        {activeTab==="scores" && (
          <div style={{ display:"grid",gap:18 }}>
            <RoundTimerControl timer={data.roundTimer} onUpdate={(t) => saveData({...data,roundTimer:t})} />

            {/* Year group selector */}
            <div style={{ background:"#16161f",borderRadius:12,border:"1px solid #2a2a3a",padding:"14px 18px" }}>
              <div style={{ fontSize:11,letterSpacing:1.2,textTransform:"uppercase",color:"#666",marginBottom:10 }}>Active Year Group</div>
              <div style={{ display:"flex",gap:6,flexWrap:"wrap" }}>
                {YEAR_GROUPS.map((yg) => {
                  const isArchived = !!(data.archivedResults||{})[yg];
                  const isActive = data.activeYearGroup===yg;
                  return (
                    <button key={yg} onClick={() => !isArchived && saveData({...data,activeYearGroup:yg})}
                      style={{ padding:"6px 14px",borderRadius:8,fontSize:13,fontFamily:"Georgia,serif",fontWeight:isActive?700:400,cursor:isArchived?"not-allowed":"pointer",
                        background:isActive?"#c9a84c":isArchived?"#1a1a1a":"#1e1e2e",
                        color:isActive?"#0f0f14":isArchived?"#333":"#888",
                        border:isActive?"none":isArchived?"1px solid #222":"1px solid #2a2a3a",
                        opacity:isArchived?0.5:1,
                      }}>
                      {isArchived?"✓ ":""}{yg}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Round selector */}
            <div style={{ display:"flex",alignItems:"center",gap:12,background:"#16161f",borderRadius:12,padding:"13px 18px",border:"1px solid #2a2a3a",flexWrap:"wrap" }}>
              <span style={{ fontSize:13,color:"#888" }}>Current Round:</span>
              <div style={{ display:"flex",gap:5,flexWrap:"wrap" }}>
                {rounds.map((r) => (
                  <button key={r} onClick={() => saveData({...data,currentRound:r})} style={{ width:32,height:32,borderRadius:"50%",background:data.currentRound===r?"#c9a84c":"#1e1e2e",color:data.currentRound===r?"#0f0f14":"#888",border:data.currentRound===r?"none":"1px solid #2a2a3a",cursor:"pointer",fontFamily:"Georgia,serif",fontWeight:700,fontSize:13 }}>
                    {r}
                  </button>
                ))}
              </div>
            </div>

            {(data.teams||[]).length===0 ? (
              <div style={{ textAlign:"center",padding:60,color:"#555",border:"2px dashed #2a2a3a",borderRadius:16 }}>
                <div style={{ fontSize:36,marginBottom:10 }}>🏫</div>No teams yet — add them in the Teams tab.
              </div>
            ) : (
              <>
                <div style={{ overflowX:"auto" }}>
                  <table className="score-table" style={{ width:"100%",borderCollapse:"collapse",background:"#16161f",borderRadius:16,overflow:"hidden",border:"1px solid #2a2a3a" }}>
                    <thead>
                      <tr style={{ background:"#1e1e2e" }}>
                        <th style={{ padding:"12px 18px",textAlign:"left",fontSize:11,color:"#888",fontWeight:400,letterSpacing:1,textTransform:"uppercase" }}>Team</th>
                        {rounds.map((r) => <th key={r} style={{ padding:"12px 12px",textAlign:"center",fontSize:11,color:r===data.currentRound?"#c9a84c":"#888",fontWeight:r===data.currentRound?700:400,letterSpacing:1,textTransform:"uppercase" }}>Rd {r}{r===data.currentRound?" ▲":""}</th>)}
                        <th style={{ padding:"12px 18px",textAlign:"center",fontSize:11,color:"#e8d5a3",fontWeight:700,letterSpacing:1,textTransform:"uppercase" }}>Total</th>
                        <th style={{ padding:"12px 12px",textAlign:"center",fontSize:11,color:"#888",fontWeight:400,letterSpacing:1,textTransform:"uppercase" }}>Rank</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedTeams.map((team,idx) => (
                        <tr key={team.id} style={{ borderTop:"1px solid #2a2a3a",background:idx===0?"rgba(201,168,76,0.05)":"transparent" }}>
                          <td style={{ padding:"10px 18px" }}>
                            <div style={{ display:"flex",alignItems:"center",gap:8 }}>
                              <div style={{ width:9,height:9,borderRadius:"50%",background:team.color,flexShrink:0 }} />
                              <span style={{ fontSize:14,fontWeight:idx===0?700:400 }}>{team.name}</span>
                            </div>
                          </td>
                          {rounds.map((r) => (
                            <td key={r} style={{ padding:"6px 8px",textAlign:"center" }}>
                              <input type="number" min={0} value={(team.rounds||{})[r]??""} onChange={(e) => updateScore(team.id,r,e.target.value)} placeholder="—"
                                style={{ width:50,textAlign:"center",background:r===data.currentRound?"#1e2235":"#1a1a24",border:r===data.currentRound?"1px solid #c9a84c55":"1px solid #2a2a3a",borderRadius:8,color:"#e8d5a3",padding:"5px 3px",fontFamily:"Georgia,serif",fontSize:14 }} />
                            </td>
                          ))}
                          <td style={{ padding:"10px 18px",textAlign:"center" }}>
                            <span style={{ fontSize:18,fontWeight:700,color:idx===0?"#c9a84c":"#e8d5a3" }}>{getTotal(team)}</span>
                          </td>
                          <td style={{ padding:"10px 12px",textAlign:"center" }}>
                            <span style={{ display:"inline-block",width:26,height:26,borderRadius:"50%",lineHeight:"26px",background:idx===0?"#c9a84c":idx===1?"#aaa":idx===2?"#cd7f32":"#1e1e2e",color:idx<3?"#0f0f14":"#666",fontWeight:700,fontSize:12 }}>{idx+1}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",gap:12,paddingTop:4,flexWrap:"wrap" }}>
                  <div style={{ display:"flex",alignItems:"center",gap:8 }}>
                    {saving && <span style={{ color:"#c9a84c",fontSize:13 }}>⏳ Syncing…</span>}
                    {saveStatus==="saved" && <span style={{ color:"#5cb85c",fontSize:13 }}>✓ Auto-saved</span>}
                    {saveStatus==="error" && <span style={{ color:"#e74c3c",fontSize:13 }}>✗ Save failed</span>}
                    {!saving && !saveStatus && <span style={{ color:"#444",fontSize:12 }}>Scores auto-save as you type</span>}
                  </div>

                  {/* Lock & Archive button */}
                  <button onClick={archiveYearGroup}
                    style={{ background:"linear-gradient(135deg,#5cb85c,#4a9a4a)",color:"#fff",border:"none",borderRadius:10,padding:"10px 22px",fontSize:13,fontWeight:700,fontFamily:"Georgia,serif",cursor:"pointer",display:"flex",alignItems:"center",gap:8 }}>
                    🔒 Lock {data.activeYearGroup} & Move to Next
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* ── TEAMS TAB ── */}
        {activeTab==="teams" && (
          <div>
            <div style={{ background:"#16161f",borderRadius:14,border:"1px solid #2a2a3a",padding:20,marginBottom:18 }}>
              <h3 style={{ margin:"0 0 12px",fontSize:11,letterSpacing:1.2,textTransform:"uppercase",color:"#666" }}>Add Team — {data.activeYearGroup}</h3>
              <div style={{ display:"flex",gap:10 }}>
                <input value={newTeamName} onChange={(e) => setNewTeamName(e.target.value)} onKeyDown={(e) => e.key==="Enter"&&addTeam()} placeholder="Team name…"
                  style={{ flex:1,background:"#1e1e2e",border:"1px solid #2a2a3a",color:"#e8d5a3",padding:"11px 14px",borderRadius:10,fontFamily:"Georgia,serif",fontSize:14 }} />
                <button onClick={addTeam} style={{ background:"#c9a84c",color:"#0f0f14",border:"none",borderRadius:10,padding:"11px 20px",fontSize:14,fontWeight:700,fontFamily:"Georgia,serif",cursor:"pointer" }}>+ Add</button>
              </div>
            </div>
            {(data.teams||[]).length===0 ? (
              <div style={{ textAlign:"center",padding:60,color:"#555",border:"2px dashed #2a2a3a",borderRadius:16 }}>No teams yet.</div>
            ) : (
              <div style={{ display:"grid",gap:8 }}>
                {(data.teams||[]).map((team) => (
                  <div key={team.id} style={{ background:"#16161f",border:"1px solid #2a2a3a",borderRadius:12,padding:"13px 16px",display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,flexWrap:"wrap" }}>
                    <div style={{ display:"flex",alignItems:"center",gap:10,flex:1 }}>
                      <div style={{ width:11,height:11,borderRadius:"50%",background:team.color,flexShrink:0 }} />
                      {editingTeamId===team.id ? (
                        <div style={{ display:"flex",gap:8,alignItems:"center",flex:1 }}>
                          <input value={editingTeamName} onChange={(e) => setEditingTeamName(e.target.value)} onKeyDown={(e) => e.key==="Enter"&&renameTeam(team.id)} autoFocus
                            style={{ flex:1,background:"#1e1e2e",border:"1px solid #c9a84c",color:"#e8d5a3",padding:"5px 10px",borderRadius:6,fontFamily:"Georgia,serif",fontSize:14 }} />
                          <button onClick={() => renameTeam(team.id)} style={{ background:"#c9a84c",color:"#0f0f14",border:"none",borderRadius:6,padding:"5px 12px",cursor:"pointer",fontFamily:"Georgia,serif",fontSize:12 }}>Save</button>
                          <button onClick={() => setEditingTeamId(null)} style={{ background:"none",border:"1px solid #333",color:"#888",borderRadius:6,padding:"5px 8px",cursor:"pointer",fontSize:12 }}>✕</button>
                        </div>
                      ) : (
                        <>
                          <span style={{ fontSize:15 }}>{team.name}</span>
                          <span style={{ fontSize:12,color:"#555" }}>· {getTotal(team)} pts</span>
                        </>
                      )}
                    </div>
                    {editingTeamId!==team.id && (
                      <div style={{ display:"flex",gap:7 }}>
                        <button onClick={() => { setEditingTeamId(team.id); setEditingTeamName(team.name); }} style={{ background:"none",border:"1px solid #2a2a3a",color:"#888",borderRadius:8,padding:"5px 11px",cursor:"pointer",fontSize:12 }}>✏️ Rename</button>
                        <button onClick={() => removeTeam(team.id)} style={{ background:"none",border:"1px solid #3a2a2a",color:"#e74c3c",borderRadius:8,padding:"5px 11px",cursor:"pointer",fontSize:12 }}>Remove</button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── RESULTS TAB ── */}
        {activeTab==="results" && (
          <div>
            {archivedYears.length===0 ? (
              <div style={{ textAlign:"center",padding:60,color:"#555",border:"2px dashed #2a2a3a",borderRadius:16 }}>
                <div style={{ fontSize:36,marginBottom:10 }}>📋</div>No archived results yet. Lock a year group from the Scores tab.
              </div>
            ) : (
              <div style={{ display:"grid",gap:16 }}>
                {archivedYears.map((yg) => {
                  const result = data.archivedResults[yg];
                  return (
                    <div key={yg} style={{ background:"#16161f",borderRadius:14,border:"1px solid #2a2a3a",overflow:"hidden" }}>
                      <div style={{ background:"#1e1e2e",padding:"12px 18px",display:"flex",alignItems:"center",justifyContent:"space-between" }}>
                        <div style={{ display:"flex",alignItems:"center",gap:10 }}>
                          <span style={{ fontSize:13,fontWeight:700,color:"#c9a84c" }}>{yg}</span>
                          <span style={{ fontSize:11,color:"#444" }}>· {result.teams?.length||0} teams</span>
                        </div>
                        <span style={{ fontSize:11,color:"#333" }}>Locked {new Date(result.lockedAt).toLocaleTimeString()}</span>
                      </div>
                      <table style={{ width:"100%",borderCollapse:"collapse" }}>
                        <tbody>
                          {(result.teams||[]).map((team,idx) => (
                            <tr key={team.id} style={{ borderTop:"1px solid #2a2a3a",background:idx===0?"rgba(201,168,76,0.04)":"transparent" }}>
                              <td style={{ padding:"9px 16px",width:36 }}>
                                <span style={{ display:"inline-block",width:24,height:24,borderRadius:"50%",lineHeight:"24px",textAlign:"center",background:idx===0?"#c9a84c":idx===1?"#aaa":idx===2?"#cd7f32":"#1e1e2e",color:idx<3?"#0f0f14":"#555",fontWeight:700,fontSize:11 }}>{idx+1}</span>
                              </td>
                              <td style={{ padding:"9px 8px" }}>
                                <div style={{ display:"flex",alignItems:"center",gap:8 }}>
                                  <div style={{ width:8,height:8,borderRadius:"50%",background:team.color }} />
                                  <span style={{ fontSize:14,color:"#c8bfa8" }}>{team.name}</span>
                                </div>
                              </td>
                              <td style={{ padding:"9px 16px",textAlign:"right" }}>
                                <span style={{ fontSize:16,fontWeight:700,color:idx===0?"#c9a84c":"#e8d5a3" }}>{team.total}</span>
                                <span style={{ fontSize:11,color:"#555",marginLeft:4 }}>pts</span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── SETTINGS TAB ── */}
        {activeTab==="settings" && (
          <div style={{ display:"grid",gap:16 }}>
            <div style={{ background:"#16161f",borderRadius:14,border:"1px solid #2a2a3a",padding:20 }}>
              <h3 style={{ margin:"0 0 12px",fontSize:11,letterSpacing:1.2,textTransform:"uppercase",color:"#666" }}>Total Rounds</h3>
              <div style={{ display:"flex",gap:6,flexWrap:"wrap" }}>
                {[3,4,5,6,7,8,10].map((n) => (
                  <button key={n} onClick={() => saveData({...data,totalRounds:n})} style={{ width:38,height:38,borderRadius:8,background:data.totalRounds===n?"#c9a84c":"#1e1e2e",color:data.totalRounds===n?"#0f0f14":"#888",border:data.totalRounds===n?"none":"1px solid #2a2a3a",cursor:"pointer",fontFamily:"Georgia,serif",fontWeight:700 }}>{n}</button>
                ))}
              </div>
            </div>
            <div style={{ background:"#16161f",borderRadius:14,border:"1px solid #2a2a3a",padding:20 }}>
              <h3 style={{ margin:"0 0 6px",fontSize:11,letterSpacing:1.2,textTransform:"uppercase",color:"#666" }}>Scoreboard Visibility</h3>
              <p style={{ color:"#555",fontSize:12,marginBottom:12 }}>Hide the public board while updating scores between year groups.</p>
              <button onClick={() => saveData({...data,scoreboardHidden:!data.scoreboardHidden})} style={{ background:data.scoreboardHidden?"#e74c3c":"#1e1e2e",color:data.scoreboardHidden?"#fff":"#888",border:`1px solid ${data.scoreboardHidden?"#e74c3c":"#2a2a3a"}`,borderRadius:8,padding:"8px 16px",cursor:"pointer",fontFamily:"Georgia,serif",fontSize:13 }}>
                {data.scoreboardHidden?"👁‍🗨 Currently Hidden — Click to Show":"👁 Currently Visible — Click to Hide"}
              </button>
            </div>
            <div style={{ background:"#16161f",borderRadius:14,border:"1px solid #2a2a3a",padding:20 }}>
              <h3 style={{ margin:"0 0 6px",fontSize:11,letterSpacing:1.2,textTransform:"uppercase",color:"#666" }}>Winner Reveal</h3>
              <p style={{ color:"#555",fontSize:12,marginBottom:12 }}>Trigger the dramatic winner announcement on the public screen.</p>
              <button onClick={() => saveData({...data,winnerRevealed:!data.winnerRevealed})} style={{ background:data.winnerRevealed?"linear-gradient(135deg,#c9a84c,#e8d5a3)":"#1e1e2e",color:data.winnerRevealed?"#0f0f14":"#888",border:`1px solid ${data.winnerRevealed?"#c9a84c":"#2a2a3a"}`,borderRadius:8,padding:"8px 16px",cursor:"pointer",fontFamily:"Georgia,serif",fontSize:13,fontWeight:data.winnerRevealed?700:400 }}>
                {data.winnerRevealed?"🏆 Winner Revealed — Click to Dismiss":"🏆 Reveal Winner on Public Screen"}
              </button>
            </div>
            <div style={{ background:"#16161f",borderRadius:14,border:"1px solid #2a2a3a",padding:20 }}>
              <h3 style={{ margin:"0 0 6px",fontSize:11,letterSpacing:1.2,textTransform:"uppercase",color:"#e74c3c66" }}>Danger Zone</h3>
              <p style={{ color:"#555",fontSize:12,marginBottom:12 }}>Wipes all teams, scores and archived results.</p>
              <button onClick={() => { if(window.confirm("Reset everything? This cannot be undone.")) saveData({...defaultData,eventTitle:data.eventTitle}); }}
                style={{ background:"none",border:"1px solid #e74c3c",color:"#e74c3c",borderRadius:8,padding:"8px 16px",cursor:"pointer",fontFamily:"Georgia,serif",fontSize:13 }}>
                Reset All Data
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
