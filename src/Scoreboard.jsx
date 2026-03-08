import { useState, useEffect, useRef } from "react";
import { db, ref, onValue } from "./firebase";

const DB_PATH = "quiz";
const MEDALS = ["🥇", "🥈", "🥉"];

function normalizeTeams(val) {
  return {
    ...val,
    teams: val.teams
      ? Array.isArray(val.teams) ? val.teams : Object.values(val.teams)
      : [],
  };
}

// ── Count-up animation ─────────────────────────────────────────────────────
function useCountUp(target, duration = 900) {
  const [value, setValue] = useState(0);
  const prev = useRef(0);
  useEffect(() => {
    const start = prev.current;
    const diff = target - start;
    if (diff === 0) return;
    const startTime = performance.now();
    const tick = (now) => {
      const progress = Math.min((now - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(start + diff * eased));
      if (progress < 1) requestAnimationFrame(tick);
      else { setValue(target); prev.current = target; }
    };
    requestAnimationFrame(tick);
  }, [target, duration]);
  return value;
}

function ScoreCounter({ value }) {
  return <>{useCountUp(value)}</>;
}

// ── Live Timer Display ─────────────────────────────────────────────────────
function LiveTimer({ timer }) {
  const [display, setDisplay] = useState("");
  const [urgent, setUrgent] = useState(false);

  useEffect(() => {
    if (!timer?.running || !timer?.startedAt) { setDisplay(""); return; }
    const tick = () => {
      const elapsed = Math.floor((Date.now() - timer.startedAt) / 1000);
      const remaining = Math.max(0, timer.duration - elapsed);
      const m = Math.floor(remaining / 60).toString().padStart(2, "0");
      const s = (remaining % 60).toString().padStart(2, "0");
      setDisplay(`${m}:${s}`);
      setUrgent(remaining <= 30 && remaining > 0);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [timer]);

  if (!display) return null;

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 8,
      background: urgent ? "rgba(231,76,60,0.12)" : "rgba(201,168,76,0.08)",
      border: `1px solid ${urgent ? "rgba(231,76,60,0.4)" : "rgba(201,168,76,0.2)"}`,
      borderRadius: 20, padding: "6px 18px",
    }}>
      <span style={{ fontSize: 13, color: urgent ? "#e74c3c" : "#888" }}>⏱</span>
      <span style={{
        fontSize: 22, fontWeight: 700, fontVariantNumeric: "tabular-nums",
        color: urgent ? "#e74c3c" : "#c9a84c",
        animation: urgent ? "urgentPulse 0.8s ease-in-out infinite" : "none",
      }}>{display}</span>
    </div>
  );
}

// ── Team Row ───────────────────────────────────────────────────────────────
function TeamRow({ team, rank, totalRounds, currentRound, animDelay, isNew }) {
  const total = Object.values(team.rounds || {}).reduce((s, v) => s + (v || 0), 0);
  const rounds = Array.from({ length: totalRounds }, (_, i) => i + 1);
  const isTop = rank === 0;
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), animDelay);
    return () => clearTimeout(t);
  }, [animDelay]);

  return (
    <div style={{
      opacity: visible ? 1 : 0,
      transform: visible ? "translateY(0)" : "translateY(20px)",
      transition: "opacity 0.5s ease, transform 0.5s cubic-bezier(0.16,1,0.3,1)",
      background: isTop
        ? "linear-gradient(135deg, rgba(201,168,76,0.12) 0%, rgba(201,168,76,0.04) 100%)"
        : "rgba(255,255,255,0.02)",
      border: isTop ? "1px solid rgba(201,168,76,0.4)" : "1px solid rgba(255,255,255,0.06)",
      borderRadius: 14,
      padding: "clamp(14px,2vw,20px) clamp(14px,2.5vw,28px)",
      marginBottom: 8,
      display: "grid",
      gridTemplateColumns: `40px 1fr repeat(${totalRounds}, minmax(44px,60px)) 80px`,
      alignItems: "center",
      gap: "clamp(8px,1.5vw,16px)",
      position: "relative",
      overflow: "hidden",
    }}>
      {isTop && <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: "linear-gradient(90deg,transparent,#c9a84c,transparent)" }} />}

      {/* Rank */}
      <div style={{ textAlign: "center" }}>
        {rank < 3
          ? <span style={{ fontSize: "clamp(18px,3vw,26px)" }}>{MEDALS[rank]}</span>
          : <span style={{ fontSize: 14, fontWeight: 700, color: "#555", fontFamily: "'EB Garamond',Georgia,serif" }}>#{rank + 1}</span>
        }
      </div>

      {/* Name */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
        <div style={{ width: 9, height: 9, borderRadius: "50%", background: team.color, flexShrink: 0 }} />
        <span style={{ fontFamily: "'EB Garamond',Georgia,serif", fontSize: "clamp(14px,2vw,20px)", fontWeight: isTop ? 700 : 400, color: isTop ? "#e8d5a3" : "#c8bfa8", letterSpacing: 0.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{team.name}</span>
      </div>

      {/* Round scores */}
      {rounds.map((r) => (
        <div key={r} style={{ textAlign: "center" }}>
          <div style={{ fontSize: "clamp(12px,1.5vw,15px)", fontWeight: r === currentRound ? 700 : 400, color: r === currentRound ? "#c9a84c" : (team.rounds || {})[r] != null ? "#9a9080" : "#2a2a2a", fontFamily: "'EB Garamond',Georgia,serif" }}>
            {(team.rounds || {})[r] != null ? (team.rounds || {})[r] : "·"}
          </div>
          <div style={{ fontSize: 9, color: "#2a2a2a", letterSpacing: 0.5 }}>R{r}</div>
        </div>
      ))}

      {/* Total */}
      <div style={{ textAlign: "right" }}>
        <div style={{ fontSize: isTop ? "clamp(22px,3.5vw,32px)" : "clamp(18px,2.5vw,24px)", fontWeight: 700, fontFamily: "'EB Garamond',Georgia,serif", color: rank === 0 ? "#c9a84c" : rank === 1 ? "#b0b0b0" : rank === 2 ? "#cd7f32" : "#e8d5a3", lineHeight: 1 }}>
          <ScoreCounter value={total} />
        </div>
        <div style={{ fontSize: 10, color: "#444", letterSpacing: 1, textTransform: "uppercase" }}>pts</div>
      </div>
    </div>
  );
}

// ── Winner Screen ──────────────────────────────────────────────────────────
function WinnerScreen({ winner }) {
  const [show, setShow] = useState(false);
  useEffect(() => { const t = setTimeout(() => setShow(true), 100); return () => clearTimeout(t); }, []);

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 100,
      background: "radial-gradient(ellipse at center, #1a1400 0%, #08080e 70%)",
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      textAlign: "center", padding: 24,
      opacity: show ? 1 : 0, transition: "opacity 1s ease",
    }}>
      <style>{`
        @keyframes confetti { 0%{transform:translateY(-10px) rotate(0deg);opacity:1} 100%{transform:translateY(100vh) rotate(720deg);opacity:0} }
        @keyframes trophy { 0%,100%{transform:scale(1) rotate(-3deg)} 50%{transform:scale(1.1) rotate(3deg)} }
        @keyframes glow { 0%,100%{text-shadow:0 0 40px rgba(201,168,76,0.4)} 50%{text-shadow:0 0 80px rgba(201,168,76,0.8),0 0 120px rgba(201,168,76,0.4)} }
      `}</style>

      {/* Confetti particles */}
      {Array.from({ length: 30 }).map((_, i) => (
        <div key={i} style={{
          position: "fixed",
          left: `${Math.random() * 100}%`,
          top: `-${Math.random() * 20}%`,
          width: Math.random() * 10 + 5,
          height: Math.random() * 10 + 5,
          background: ["#c9a84c", "#e8d5a3", "#5cb85c", "#3498db", "#e74c3c"][Math.floor(Math.random() * 5)],
          borderRadius: Math.random() > 0.5 ? "50%" : 2,
          animation: `confetti ${Math.random() * 3 + 2}s ${Math.random() * 2}s ease-in forwards`,
        }} />
      ))}

      <div style={{ fontSize: "clamp(60px,12vw,120px)", animation: "trophy 2s ease-in-out infinite", marginBottom: 20 }}>🏆</div>

      <div style={{ fontSize: "clamp(12px,2vw,16px)", letterSpacing: 6, color: "#6a5f42", textTransform: "uppercase", marginBottom: 16 }}>
        And the winner is…
      </div>

      <h1 style={{
        fontFamily: "'EB Garamond',Georgia,serif",
        fontSize: "clamp(36px,8vw,80px)",
        fontWeight: 700,
        color: "#c9a84c",
        margin: "0 0 12px",
        animation: "glow 2s ease-in-out infinite",
        letterSpacing: 2,
      }}>
        {winner?.name}
      </h1>

      <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 8 }}>
        <div style={{ width: 14, height: 14, borderRadius: "50%", background: winner?.color }} />
        <span style={{ fontFamily: "'EB Garamond',Georgia,serif", fontSize: "clamp(20px,4vw,36px)", color: "#e8d5a3" }}>
          {Object.values(winner?.rounds || {}).reduce((s, v) => s + (v || 0), 0)} points
        </span>
      </div>

      <div style={{ marginTop: 40, display: "flex", gap: 8 }}>
        {["🎉","✨","🎊","⭐","🌟"].map((e, i) => (
          <span key={i} style={{ fontSize: "clamp(20px,3vw,32px)", animation: `trophy ${1 + i * 0.2}s ease-in-out infinite`, animationDelay: `${i * 0.1}s` }}>{e}</span>
        ))}
      </div>
    </div>
  );
}

// ── Hidden Screen ──────────────────────────────────────────────────────────
function HiddenScreen({ eventTitle }) {
  return (
    <div style={{
      minHeight: "100vh", background: "#08080e",
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      fontFamily: "'EB Garamond',Georgia,serif", textAlign: "center", padding: 24,
    }}>
      <div style={{ fontSize: 64, marginBottom: 20, opacity: 0.15 }}>🎓</div>
      <h1 style={{ fontSize: "clamp(22px,4vw,40px)", color: "#3a3020", margin: "0 0 12px", fontWeight: 700 }}>{eventTitle}</h1>
      <p style={{ color: "#2a2a2a", fontSize: "clamp(13px,2vw,16px)" }}>Scores are being updated… Stand by.</p>
      <div style={{ marginTop: 24, display: "flex", gap: 6 }}>
        {[0.2, 0.4, 0.6].map((d, i) => (
          <div key={i} style={{ width: 8, height: 8, borderRadius: "50%", background: "#2a2a2a", animation: `dotPulse 1.4s ${d}s ease-in-out infinite` }} />
        ))}
      </div>
      <style>{`@keyframes dotPulse{0%,80%,100%{transform:scale(0.8);opacity:0.3}40%{transform:scale(1.2);opacity:1}}`}</style>
    </div>
  );
}

// ── Main Scoreboard ────────────────────────────────────────────────────────
export default function LiveScoreboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [pulseKey, setPulseKey] = useState(0);
  const [connected, setConnected] = useState(true);

  useEffect(() => {
    const dbRef = ref(db, DB_PATH);
    const connRef = ref(db, ".info/connected");
    const unsub = onValue(dbRef, (snapshot) => {
      const val = snapshot.val();
      if (val) {
        const normalized = normalizeTeams(val);
        setData((prev) => {
          if (prev && JSON.stringify(prev) !== JSON.stringify(normalized)) setPulseKey((k) => k + 1);
          return normalized;
        });
        setLastUpdated(new Date());
      }
      setLoading(false);
    });
    const unsubConn = onValue(connRef, (snap) => setConnected(!!snap.val()));
    return () => { unsub(); unsubConn(); };
  }, []);

  const sortedTeams = data
    ? [...(data.teams || [])].sort((a, b) =>
        Object.values(b.rounds || {}).reduce((s, v) => s + (v || 0), 0) -
        Object.values(a.rounds || {}).reduce((s, v) => s + (v || 0), 0)
      )
    : [];

  const totalRounds = data?.totalRounds || 5;
  const currentRound = data?.currentRound || 1;
  const winner = sortedTeams[0];

  if (loading) return (
    <div style={{ minHeight: "100vh", background: "#08080e", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "#c9a84c", fontFamily: "'EB Garamond',Georgia,serif" }}>
      <div style={{ fontSize: 48, marginBottom: 14 }}>🎓</div>
      <div style={{ fontSize: 18, letterSpacing: 3 }}>CONNECTING…</div>
    </div>
  );

  // Winner reveal screen
  if (data?.winnerRevealed && winner) return <WinnerScreen winner={winner} />;

  // Scoreboard hidden
  if (data?.scoreboardHidden) return <HiddenScreen eventTitle={data?.eventTitle || "Quiz"} />;

  // No teams yet
  if (!data || sortedTeams.length === 0) return (
    <div style={{ minHeight: "100vh", background: "#08080e", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "#555", fontFamily: "'EB Garamond',Georgia,serif", textAlign: "center", padding: 24 }}>
      <div style={{ fontSize: 64, marginBottom: 20, opacity: 0.2 }}>🏫</div>
      <div style={{ fontSize: "clamp(18px,3vw,26px)", marginBottom: 8, color: "#888" }}>Waiting for the quiz to begin…</div>
      <div style={{ fontSize: 14, color: "#2a2a2a" }}>The scoreboard will update automatically.</div>
    </div>
  );

  return (
    <div style={{
      minHeight: "100vh", background: "#08080e", color: "#e8d5a3",
      fontFamily: "'EB Garamond',Georgia,serif",
      backgroundImage: "radial-gradient(ellipse at 20% 0%,rgba(201,168,76,0.06) 0%,transparent 60%),radial-gradient(ellipse at 80% 100%,rgba(100,80,200,0.04) 0%,transparent 60%)",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=EB+Garamond:wght@400;600;700&display=swap');
        @keyframes shimmer { 0%{background-position:-200% center} 100%{background-position:200% center} }
        @keyframes liveDot { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.3;transform:scale(0.6)} }
        @keyframes urgentPulse { 0%,100%{opacity:1} 50%{opacity:0.5} }
        * { box-sizing: border-box; }
      `}</style>

      {/* ── Header ── */}
      <div style={{ textAlign: "center", padding: "clamp(28px,5vw,52px) 20px clamp(20px,3vw,36px)", borderBottom: "1px solid rgba(201,168,76,0.12)", position: "relative" }}>
        <div style={{ position: "absolute", top: 0, left: "50%", transform: "translateX(-50%)", width: 100, height: 3, background: "linear-gradient(90deg,transparent,#c9a84c,transparent)" }} />

        <div style={{ fontSize: "clamp(10px,1.2vw,13px)", letterSpacing: 4, color: "#5a4f32", textTransform: "uppercase", marginBottom: 10 }}>Live Leaderboard</div>

        <h1 style={{ fontSize: "clamp(22px,5vw,52px)", fontWeight: 700, margin: "0 0 4px", background: "linear-gradient(135deg,#c9a84c 0%,#e8d5a3 50%,#c9a84c 100%)", backgroundSize: "200% auto", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", animation: "shimmer 4s linear infinite", letterSpacing: 1 }}>
          {data.eventTitle}
        </h1>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "clamp(10px,2vw,20px)", marginTop: 14, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, background: "rgba(201,168,76,0.08)", border: "1px solid rgba(201,168,76,0.2)", borderRadius: 20, padding: "5px 14px", fontSize: "clamp(11px,1.3vw,13px)" }}>
            <span style={{ color: "#c9a84c", fontWeight: 700 }}>Round {currentRound}</span>
            <span style={{ color: "#444" }}>of {totalRounds}</span>
          </div>

          {data.roundTimer && <LiveTimer timer={data.roundTimer} />}

          <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: "clamp(10px,1.2vw,12px)" }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: connected ? "#5cb85c" : "#e74c3c", animation: connected ? "liveDot 2s ease-in-out infinite" : "none" }} />
            <span style={{ color: connected ? "#3a5a3a" : "#5a2a2a" }}>{connected ? "Live" : "Reconnecting…"}</span>
          </div>
        </div>
      </div>

      {/* ── Scoreboard ── */}
      <div style={{ maxWidth: 960, margin: "0 auto", padding: "0 clamp(12px,3vw,24px)" }}>
        {/* Column headers */}
        <div style={{ display: "grid", gridTemplateColumns: `40px 1fr repeat(${totalRounds}, minmax(44px,60px)) 80px`, gap: "clamp(8px,1.5vw,16px)", padding: "16px clamp(14px,2.5vw,28px) 8px", color: "#333", fontSize: 10, letterSpacing: 1.5, textTransform: "uppercase" }}>
          <div style={{ textAlign: "center" }}>Rank</div>
          <div>Team</div>
          {Array.from({ length: totalRounds }, (_, i) => (
            <div key={i} style={{ textAlign: "center", color: i + 1 === currentRound ? "#c9a84c55" : "#333" }}>R{i + 1}</div>
          ))}
          <div style={{ textAlign: "right" }}>Score</div>
        </div>

        {/* Rows */}
        <div style={{ paddingBottom: 48 }} key={pulseKey}>
          {sortedTeams.map((team, idx) => (
            <TeamRow key={team.id} team={team} rank={idx} totalRounds={totalRounds} currentRound={currentRound} animDelay={idx * 70} />
          ))}
        </div>

        <div style={{ textAlign: "center", paddingBottom: 28, fontSize: 11, color: "#1e1e1e", letterSpacing: 1 }}>
          {lastUpdated && `Updated ${lastUpdated.toLocaleTimeString()}`}
        </div>
      </div>
    </div>
  );
}