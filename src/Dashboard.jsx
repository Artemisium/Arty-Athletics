import { useState, useEffect, useRef } from "react";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis } from "recharts";

const PROFILE = {
  name: "Artem",
  weight: 176,
  hyroxPB: "1:04:14 (Doubles)",
  runSplits: [232, 272, 292, 296, 295, 287, 294, 240],
  benchmarks: { DL: 385, SQ: 275, BP: 185, OHP: 125, FTP: 290, HM: "1:39:30" },
  stations: { ski: 232, sledPush: 85, sledPull: 166, bbj: 161, row: 262, carry: 81, lunges: 147, wallBalls: 207 },
  // Strength profile: Pull = elite tier (chin +65, pull +55). Push = primary weakness (BP 185, OHP 125).
  // Race calendar: Hyrox Singles Open Toronto Oct 4 2026 (A race), Toronto Waterfront Marathon Oct 18 2026 (B race)
  // Current phase: BASE — aerobic foundation. Singles station targets pending benchmark research.
  races: [
    { name: "Toronto Waterfront Marathon", date: "2026-10-18", priority: "B", type: "marathon" },
    { name: "Hyrox Singles Open Toronto", date: "2026-10-04", priority: "A", type: "hyrox" },
  ]
};

const SESSION_TYPES = [
  { id: "hyrox_sim", label: "HYROX SIM", icon: "🏟", color: "#f0a500" },
  { id: "strength", label: "STRENGTH", icon: "🏋", color: "#7c6af7" },
  { id: "run", label: "RUN", icon: "🏃", color: "#00d4aa" },
  { id: "bike", label: "BIKE", icon: "🚴", color: "#00aaff" },
  { id: "ski", label: "SKI", icon: "⛷", color: "#a0d4ff" },
  { id: "climb", label: "CLIMB", icon: "🧗", color: "#ff7043" },
  { id: "swim", label: "SWIM", icon: "🏊", color: "#29b6f6" },
  { id: "recovery", label: "RECOVERY", icon: "💤", color: "#4caf50" },
];

const C = {
  bg: "#0a0a0d",
  surface: "#13131a",
  card: "#18181f",
  border: "#22222e",
  accent: "#f0a500",
  teal: "#00d4aa",
  purple: "#7c6af7",
  danger: "#ff4d4d",
  warn: "#ffaa00",
  text: "#e2e2e8",
  muted: "#55555f",
  light: "#88889a",
};

// Scores vs elite Hyrox Open field (100 = top athlete benchmark)
// Run: HM 1:39:30 vs elite ~1:15 · FTP: 3.63 W/kg vs elite ~4.5
// VO2 Max: 51 ml/kg/min vs elite ~65 (floor 35) · Vert: 22" vs elite ~30" (floor 14")
// Push: BP 1.05×BW vs elite ~1.5× · Pull: chin +65 lbs — elite tier
// Lower: DL 2.19×BW, SQ 1.56×BW vs elite 2.8×/2.2× · Stations: doubles PB extrapolated to singles
const RADAR_DATA = [
  { metric: "RUN",      score: 58 },
  { metric: "FTP",      score: 65 },
  { metric: "VO2 MAX",  score: 53 },
  { metric: "PUSH",     score: 55 },
  { metric: "PULL",     score: 85 },
  { metric: "LOWER",    score: 62 },
  { metric: "STATIONS", score: 68 },
  { metric: "VERT",     score: 50 },
];

const fmt = {
  sec: (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`,
  pace: (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}/km`,
  date: (iso) => new Date(iso).toLocaleDateString("en-CA", { month: "short", day: "numeric" }),
  daysSince: (iso) => Math.floor((Date.now() - new Date(iso)) / 86400000),
};

const HYROX_RACE_DATE = "2026-10-04";
const MARATHON_RACE_DATE = "2026-10-18";
const WORKOUTS_KEY = "arty:workouts";
const HRV_KEY = "arty:hrv";
const MESO_KEY = "arty:mesocycle";
const WEEK1_KEY = "arty:week1_complete";

const WEEK1_PLAN = [
  { id: "mon_run",      day: "MON", date: "Mar 3", type: "run",       title: "Easy Run",                        details: "30 min · HR cap 150 · pace 6:15–6:50/km · walk if HR drifts",                                                         coach: "Walk breaks are built in. Connective tissue reconditioning — no ego." },
  { id: "mon_acc",      day: "MON", date: "Mar 3", type: "strength",  title: "Accessory A — Push Volume",       details: "15–18 min · Push-ups 3×15–20 · Pike push-ups 3×8–12 · Diamond 2×12 · Band pull-aparts 3×20",                         coach: "Stop 2–3 reps short of failure. Frequency, not destruction." },
  { id: "tue_climb",    day: "TUE", date: "Mar 4", type: "climb",     title: "Bouldering + Erg Warmup",         details: "60–75 min · V3–V5 · Warmup: 10 min ski erg + 5 min row @ Z1–Z2",                                                     coach: "Log your erg warmup on Garmin. Upper body pulling complements tomorrow's run." },
  { id: "tue_acc",      day: "TUE", date: "Mar 4", type: "recovery",  title: "Accessory B — Core + Run Prehab", details: "15–20 min · Dead bugs 3×10/side · Side planks 2×30s · Calf raises 3×15 · Tibialis raises 3×15",                     coach: "Tibialis raises are #1 prehab for Achilles/shin protection on zero-drop return." },
  { id: "wed_run",      day: "WED", date: "Mar 5", type: "run",       title: "Easy Run",                        details: "30 min · HR cap 152 · pace 6:15–6:50/km · cut to 25 min if calves sore",                                              coach: "Sharp localized pain = stop. Diffuse soreness = normal, keep going." },
  { id: "wed_acc",      day: "WED", date: "Mar 5", type: "strength",  title: "Accessory A — Push Volume",       details: "15–18 min · Same as Monday · reduce by 1 set if chest/shoulders sore",                                               coach: "Goal is push frequency 3x/week. Sub-maximal always." },
  { id: "thu_rest",     day: "THU", date: "Mar 6", type: "recovery",  title: "Full Rest",                       details: "No training · 8+ hrs sleep · 160–180g protein · optional foam rolling",                                               coach: "Neural freshness for Friday's push session. This rest is the prescription." },
  { id: "fri_strength", day: "FRI", date: "Mar 7", type: "strength",  title: "Full Strength — Push Priority",   details: "70–75 min · Warmup: 8 min row erg · Block 1: Bench + OHP first · Block 2: Squat/DL maintenance",                       coach: "Push goes first while you're sharpest. Add 2.5 lbs/week to bench and OHP through Week 8." },
  { id: "sat_hyrox",    day: "SAT", date: "Mar 8", type: "hyrox_sim", title: "Hyrox Endurance Class",           details: "~55 min · Target HR 155–165 avg · RPE 6–7 · walk transitions · 70–75% on ergs",                                       coach: "DO NOT chase times. TE 2–3 target. You are training for October, not performing for the class." },
  { id: "sun_run",      day: "SUN", date: "Mar 9", type: "run",       title: "Long Easy Run + Accessory B",     details: "35–40 min · HR cap 152 · planned walk at 20 min · lakefront recommended",                                             coach: "If Saturday left you fatigued, drop to 30 min. Never run through excessive fatigue in Week 1." },
];

const DEFAULT_MESO = {
  name: "Base Mesocycle — Aerobic Rebuild",
  phase: "BASE PHASE",
  week: 1,
  totalWeeks: 20,
  focus: "PRIORITY: Rebuild running base from zero. No running in 8+ weeks, last real run Sep 14 2025. Zone 2 pace estimated 6:30-7:00/km at HR 150-155 (was 6:00-6:15 pre-race). Saturday Altea spin must shift to Zone 2 or be replaced with easy run — currently always TE 4-5. Marathon long runs (Oct 18) double as Hyrox aerobic base work.",
  keyMetrics: ["Run 3x/wk minimum", "Zone 2 HR <155", "Long run weekly", "Altea: cap TE ≤2.5"],
  sessions: [
    "Mon/Wed: Easy run 5–8km @ HR <155, no exceptions — walk if needed",
    "Sat: REPLACE Altea spin with 60-75min Zone 2 run OR cap spin TE at 2.5",
    "Thu: Strength push focus (BP/OHP) + optional short Hyrox circuit finish",
  ],
};

export default function ArtyAthletics() {
  const [tab, setTab] = useState("HOME");
  const [workouts, setWorkouts] = useState([]);
  const [hrvLog, setHrvLog] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [toast, setToast] = useState(null);
  const [mesocycle, setMesocycle] = useState(DEFAULT_MESO);
  const [completedSessions, setCompletedSessions] = useState([]);

  // Log form state
  const [logForm, setLogForm] = useState({
    type: "", duration: "", hrAvg: "", hrMax: "", rpe: 7, hrv: "",
    notes: "", runPace: "", runSplits: "", location: "",
  });
  const [logStep, setLogStep] = useState(0); // 0=type, 1=data, 2=notes

  useEffect(() => {
    const link = document.createElement("link");
    link.href = "https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=JetBrains+Mono:wght@400;600&display=swap";
    link.rel = "stylesheet";
    document.head.appendChild(link);

    const style = document.createElement("style");
    style.textContent = `
      * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
      body { background: ${C.bg}; margin: 0; }
      input[type=range] { -webkit-appearance: none; width: 100%; height: 4px; background: ${C.border}; border-radius: 2px; outline: none; }
      input[type=range]::-webkit-slider-thumb { -webkit-appearance: none; width: 22px; height: 22px; background: ${C.accent}; border-radius: 50%; cursor: pointer; }
      input[type=number], input[type=text], textarea, select { background: ${C.surface}; border: 1px solid ${C.border}; color: ${C.text}; border-radius: 8px; padding: 12px; font-size: 16px; width: 100%; outline: none; font-family: inherit; }
      input[type=number]:focus, input[type=text]:focus, textarea:focus { border-color: ${C.accent}; }
      ::-webkit-scrollbar { width: 4px; } ::-webkit-scrollbar-track { background: transparent; } ::-webkit-scrollbar-thumb { background: ${C.border}; border-radius: 2px; }
      .pulse { animation: pulse 2s infinite; }
      @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }
      @keyframes slideUp { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
      .slide-up { animation: slideUp 0.3s ease forwards; }
      @keyframes fadeIn { from{opacity:0} to{opacity:1} }
      .fade-in { animation: fadeIn 0.4s ease; }
    `;
    document.head.appendChild(style);

    loadData();
  }, []);

  async function loadData() {
    try {
      const w = await window.storage.get(WORKOUTS_KEY);
      if (w) setWorkouts(JSON.parse(w.value));
    } catch {}
    try {
      const h = await window.storage.get(HRV_KEY);
      if (h) setHrvLog(JSON.parse(h.value));
    } catch {}
    try {
      const m = await window.storage.get(MESO_KEY);
      if (m) setMesocycle(JSON.parse(m.value));
    } catch {}
    try {
      const wk = await window.storage.get(WEEK1_KEY);
      if (wk) setCompletedSessions(JSON.parse(wk.value));
    } catch {}
    setLoaded(true);
  }

  async function saveWorkouts(arr) {
    await window.storage.set(WORKOUTS_KEY, JSON.stringify(arr));
    setWorkouts(arr);
  }
  async function saveHrv(arr) {
    await window.storage.set(HRV_KEY, JSON.stringify(arr));
    setHrvLog(arr);
  }

  function showToast(msg, color = C.teal) {
    setToast({ msg, color });
    setTimeout(() => setToast(null), 2500);
  }

  async function toggleSession(id) {
    const updated = completedSessions.includes(id)
      ? completedSessions.filter(s => s !== id)
      : [...completedSessions, id];
    setCompletedSessions(updated);
    await window.storage.set(WEEK1_KEY, JSON.stringify(updated));
  }

  async function submitLog() {
    if (!logForm.type) return;
    const entry = {
      id: Date.now(),
      date: new Date().toISOString(),
      ...logForm,
      rpe: Number(logForm.rpe),
    };
    const updated = [entry, ...workouts];
    await saveWorkouts(updated);

    if (logForm.hrv) {
      const hrvEntry = { date: new Date().toISOString(), value: Number(logForm.hrv) };
      const updatedHrv = [hrvEntry, ...hrvLog].slice(0, 60);
      await saveHrv(updatedHrv);
    }

    setLogForm({ type: "", duration: "", hrAvg: "", hrMax: "", rpe: 7, hrv: "", notes: "", runPace: "", runSplits: "", location: "" });
    setLogStep(0);
    showToast("SESSION LOGGED ✓");
    setTab("HOME");
  }

  // ─── COMPUTED DATA ─────────────────────────────────────────────────────────
  const daysToHyrox = Math.max(0, Math.ceil((new Date(HYROX_RACE_DATE) - Date.now()) / 86400000));
  const daysToMarathon = Math.max(0, Math.ceil((new Date(MARATHON_RACE_DATE) - Date.now()) / 86400000));
  const lastHrv = hrvLog[0]?.value;
  const avgHrv7 = hrvLog.slice(0, 7).length ? (hrvLog.slice(0, 7).reduce((a, b) => a + b.value, 0) / hrvLog.slice(0, 7).length) : null;
  const hrvStatus = !lastHrv || !avgHrv7 ? "none" : lastHrv >= avgHrv7 * 0.95 ? "green" : lastHrv >= avgHrv7 * 0.90 ? "yellow" : "red";
  const hrvColor = { green: C.teal, yellow: C.warn, red: C.danger, none: C.muted };

  const weekVolume = workouts.filter(w => fmt.daysSince(w.date) <= 7).length;
  const typeIcon = (t) => SESSION_TYPES.find(s => s.id === t)?.icon || "📋";
  const typeColor = (t) => SESSION_TYPES.find(s => s.id === t)?.color || C.muted;

  const hrvChartData = [...hrvLog].reverse().slice(-14).map(h => ({
    date: fmt.date(h.date), v: h.value, avg: avgHrv7 ? Math.round(avgHrv7) : null
  }));

  const weeklyVolumeData = (() => {
    const days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(); d.setDate(d.getDate() - (6 - i));
      return d.toLocaleDateString("en-CA");
    });
    return days.map(day => ({
      day: day.slice(5),
      sessions: workouts.filter(w => w.date.startsWith(day)).length,
    }));
  })();

  // ─── COMPONENTS ────────────────────────────────────────────────────────────
  const T = ({ children, size = 14, weight = "400", color = C.text, mono = false, style = {} }) => (
    <span style={{ fontSize: size, fontWeight: weight, color, fontFamily: mono ? "'JetBrains Mono', monospace" : "'Syne', sans-serif", lineHeight: 1.4, ...style }}>{children}</span>
  );

  const Card = ({ children, style = {}, accent = false }) => (
    <div className="slide-up" style={{ background: C.card, border: `1px solid ${accent ? C.accent + "44" : C.border}`, borderRadius: 12, padding: "16px", marginBottom: 12, ...style }}>
      {children}
    </div>
  );

  const Pill = ({ label, value, color = C.accent }) => (
    <div style={{ background: color + "15", border: `1px solid ${color}30`, borderRadius: 8, padding: "8px 12px", flex: 1, minWidth: 0 }}>
      <div style={{ color: C.muted, fontSize: 10, fontFamily: "'Syne'", fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>{label}</div>
      <div style={{ color, fontSize: 18, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{value}</div>
    </div>
  );

  const Btn = ({ children, onPress, color = C.accent, full = false, small = false, outline = false }) => (
    <button onClick={onPress} style={{
      background: outline ? "transparent" : color,
      border: outline ? `1px solid ${color}` : "none",
      color: outline ? color : "#000",
      borderRadius: 10, padding: small ? "10px 16px" : "14px 20px",
      fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: small ? 13 : 15,
      width: full ? "100%" : "auto", cursor: "pointer", letterSpacing: 0.5,
      textTransform: "uppercase",
    }}>{children}</button>
  );

  // ─── TABS ──────────────────────────────────────────────────────────────────

  // HOME TAB
  const HomeTab = () => (
    <div className="fade-in" style={{ padding: "16px 16px 0" }}>
      {/* Header */}
      <div style={{ marginBottom: 14 }}>
        {/* Title row */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div>
            <T size={11} color={C.muted} weight="600" style={{ letterSpacing: 2, textTransform: "uppercase", display: "block" }}>Performance OS</T>
            <T size={26} weight="800" color={C.accent} style={{ display: "block", fontFamily: "'Syne'" }}>ARTY'S ATHLETICS</T>
          </div>
          {mesocycle.phase !== "TBD" && (
            <div style={{ textAlign: "right" }}>
              <T size={10} color={C.purple} weight="700" mono style={{ textTransform: "uppercase", letterSpacing: 1 }}>{mesocycle.phase}</T>
              {mesocycle.week && mesocycle.totalWeeks && (
                <T size={10} color={C.muted} mono style={{ display: "block" }}>Wk {mesocycle.week}/{mesocycle.totalWeeks}</T>
              )}
            </div>
          )}
        </div>

        {/* Race countdowns — full width */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div style={{ textAlign: "center", background: C.accent + "15", border: `1px solid ${C.accent}30`, borderRadius: 12, padding: "14px 10px" }}>
            <T size={44} weight="800" color={C.accent} mono style={{ display: "block", lineHeight: 1 }}>{daysToHyrox}</T>
            <T size={10} color={C.muted} weight="600" style={{ textTransform: "uppercase", letterSpacing: 1, display: "block", marginTop: 6 }}>Days to Hyrox</T>
            <T size={10} color={C.muted} mono style={{ display: "block" }}>Oct 4, 2026</T>
          </div>
          <div style={{ textAlign: "center", background: C.teal + "15", border: `1px solid ${C.teal}30`, borderRadius: 12, padding: "14px 10px" }}>
            <T size={44} weight="800" color={C.teal} mono style={{ display: "block", lineHeight: 1 }}>{daysToMarathon}</T>
            <T size={10} color={C.muted} weight="600" style={{ textTransform: "uppercase", letterSpacing: 1, display: "block", marginTop: 6 }}>Days to Marathon</T>
            <T size={10} color={C.muted} mono style={{ display: "block" }}>Oct 18, 2026</T>
          </div>
        </div>
      </div>

      {/* Mesocycle Focus Card */}
      <div style={{ background: `linear-gradient(135deg, ${C.purple}18, ${C.card})`, border: `1px solid ${C.purple}40`, borderRadius: 12, padding: "14px 16px", marginBottom: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <T size={11} color={C.purple} weight="700" style={{ textTransform: "uppercase", letterSpacing: 2 }}>Current Mesocycle</T>
          {mesocycle.week && mesocycle.totalWeeks && (
            <div style={{ display: "flex", gap: 3 }}>
              {Array.from({ length: mesocycle.totalWeeks }, (_, i) => (
                <div key={i} style={{ width: 8, height: 8, borderRadius: 2, background: i < mesocycle.week ? C.purple : C.border }} />
              ))}
            </div>
          )}
        </div>
        <T size={17} weight="800" color={C.text} style={{ display: "block", marginBottom: 6 }}>{mesocycle.name}</T>
        <T size={13} color={C.light} style={{ display: "block", lineHeight: 1.6 }}>{mesocycle.focus}</T>
        {mesocycle.keyMetrics.length > 0 && (
          <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
            {mesocycle.keyMetrics.map((m, i) => (
              <span key={i} style={{ background: C.purple + "20", border: `1px solid ${C.purple}40`, borderRadius: 6, padding: "4px 10px", color: C.purple, fontSize: 11, fontFamily: "'Syne'", fontWeight: 700 }}>{m}</span>
            ))}
          </div>
        )}
        {mesocycle.sessions.length > 0 && (
          <div style={{ marginTop: 10, borderTop: `1px solid ${C.border}`, paddingTop: 10 }}>
            <T size={10} color={C.muted} style={{ textTransform: "uppercase", letterSpacing: 1.5, display: "block", marginBottom: 6 }}>This Week's Priority Sessions</T>
            {mesocycle.sessions.map((s, i) => (
              <T key={i} size={12} color={C.light} style={{ display: "block", paddingLeft: 8, borderLeft: `2px solid ${C.purple}`, marginBottom: 4 }}>{s}</T>
            ))}
          </div>
        )}
      </div>

      {/* Status row */}
      <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
        <Pill label="HRV Status" value={!lastHrv ? "—" : `${lastHrv}ms`} color={hrvColor[hrvStatus]} />
        <Pill label="This Week" value={`${weekVolume} sessions`} color={C.teal} />
        <Pill label="FTP" value={`${PROFILE.benchmarks.FTP}W`} color={C.purple} />
      </div>

      {/* HRV chart */}
      {hrvChartData.length > 1 && (
        <Card>
          <T size={11} color={C.muted} weight="600" style={{ letterSpacing: 2, textTransform: "uppercase", display: "block", marginBottom: 12 }}>HRV — 14 Day Trend</T>
          <ResponsiveContainer width="100%" height={90}>
            <LineChart data={hrvChartData} margin={{ top: 4, right: 4, left: -30, bottom: 0 }}>
              <XAxis dataKey="day" tick={{ fontSize: 9, fill: C.muted }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 9, fill: C.muted }} axisLine={false} tickLine={false} />
              {avgHrv7 && <ReferenceLine y={Math.round(avgHrv7)} stroke={C.muted} strokeDasharray="3 3" />}
              <Line type="monotone" dataKey="v" stroke={hrvColor[hrvStatus]} strokeWidth={2} dot={false} />
              <Tooltip contentStyle={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 12, color: C.text }} labelStyle={{ color: C.muted }} formatter={(v) => [`${v}ms`, "HRV"]} />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      )}

      {/* Weekly volume */}
      <Card>
        <T size={11} color={C.muted} weight="600" style={{ letterSpacing: 2, textTransform: "uppercase", display: "block", marginBottom: 12 }}>Sessions — This Week</T>
        <ResponsiveContainer width="100%" height={80}>
          <BarChart data={weeklyVolumeData} margin={{ top: 0, right: 4, left: -30, bottom: 0 }}>
            <XAxis dataKey="day" tick={{ fontSize: 10, fill: C.muted }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 9, fill: C.muted }} axisLine={false} tickLine={false} />
            <Bar dataKey="sessions" fill={C.accent} radius={[4, 4, 0, 0]} />
            <Tooltip contentStyle={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 12, color: C.text }} />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      {/* Last 3 sessions */}
      {workouts.slice(0, 3).map(w => (
        <Card key={w.id}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 24 }}>{typeIcon(w.type)}</span>
              <div>
                <T size={14} weight="700" color={typeColor(w.type)} style={{ display: "block", textTransform: "uppercase" }}>{w.type?.replace(/_/g, " ")}</T>
                <T size={12} color={C.muted} mono>{fmt.date(w.date)} · {w.duration}min</T>
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <T size={20} weight="700" color={C.accent} mono style={{ display: "block" }}>RPE {w.rpe}</T>
              {w.hrAvg && <T size={12} color={C.muted} mono>HR {w.hrAvg}/{w.hrMax}</T>}
            </div>
          </div>
          {w.notes && <T size={12} color={C.light} style={{ display: "block", marginTop: 8, borderTop: `1px solid ${C.border}`, paddingTop: 8 }}>{w.notes}</T>}
        </Card>
      ))}

      {workouts.length === 0 && (
        <Card style={{ textAlign: "center", padding: 32 }}>
          <T size={32} style={{ display: "block", marginBottom: 8 }}>🏟</T>
          <T size={16} weight="700" color={C.accent}>Log your first session</T><br />
          <T size={13} color={C.muted}>Hit LOG below to start tracking</T>
        </Card>
      )}

      {/* Hyrox benchmark quick ref */}
      <Card accent>
        <T size={11} color={C.muted} weight="600" style={{ letterSpacing: 2, textTransform: "uppercase", display: "block", marginBottom: 10 }}>PB Benchmarks</T>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 16px" }}>
          {[
            ["Hyrox PB", PROFILE.hyroxPB],
            ["Half Marathon", PROFILE.benchmarks.HM],
            ["FTP", `${PROFILE.benchmarks.FTP}W`],
            ["Deadlift", `${PROFILE.benchmarks.DL}lbs`],
            ["Squat", `${PROFILE.benchmarks.SQ}lbs`],
            ["Bench", `${PROFILE.benchmarks.BP}lbs`],
          ].map(([k, v]) => (
            <div key={k} style={{ display: "flex", justifyContent: "space-between" }}>
              <T size={12} color={C.muted}>{k}</T>
              <T size={12} color={C.accent} mono weight="600">{v}</T>
            </div>
          ))}
        </div>
      </Card>

      {/* Elite comparison radar */}
      <Card>
        <T size={11} color={C.muted} weight="600" style={{ letterSpacing: 2, textTransform: "uppercase", display: "block", marginBottom: 2 }}>vs Elite Hyrox Open Field</T>
        <T size={10} color={C.muted} style={{ display: "block", marginBottom: 4 }}>100% = top athlete benchmark</T>

        <ResponsiveContainer width="100%" height={230}>
          <RadarChart data={RADAR_DATA} margin={{ top: 10, right: 24, bottom: 10, left: 24 }}>
            <PolarGrid stroke={C.border} />
            <PolarAngleAxis
              dataKey="metric"
              tick={({ x, y, payload, cx, cy }) => {
                const score = RADAR_DATA.find(d => d.metric === payload.value)?.score ?? 0;
                const color = score >= 80 ? C.teal : score >= 65 ? C.accent : C.danger;
                const dx = x - cx; const dy = y - cy;
                const len = Math.sqrt(dx*dx + dy*dy) || 1;
                const ox = (dx/len) * 8; const oy = (dy/len) * 8;
                return (
                  <g>
                    <text x={x + ox} y={y + oy} textAnchor="middle" dominantBaseline="central"
                      style={{ fontFamily: "'Syne'", fontSize: 9, fontWeight: 700, fill: color, letterSpacing: 1 }}>
                      {payload.value}
                    </text>
                    <text x={x + ox} y={y + oy + 12} textAnchor="middle" dominantBaseline="central"
                      style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, fontWeight: 600, fill: color }}>
                      {score}%
                    </text>
                  </g>
                );
              }}
            />
            <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
            {/* Elite ceiling */}
            <Radar dataKey={() => 100} stroke={C.border} fill={C.border} fillOpacity={0.08} strokeDasharray="4 3" strokeWidth={1} dot={false} />
            {/* Artem */}
            <Radar dataKey="score" stroke={C.accent} fill={C.accent} fillOpacity={0.18} strokeWidth={2}
              dot={{ r: 3, fill: C.accent, strokeWidth: 0 }} activeDot={{ r: 5, fill: C.accent }} />
            <Tooltip
              contentStyle={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 12, color: C.text }}
              formatter={(v) => [`${v}%`, "Score"]}
            />
          </RadarChart>
        </ResponsiveContainer>

        {/* Gap callouts */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 6, marginTop: 4 }}>
          {RADAR_DATA.map(d => {
            const color = d.score >= 80 ? C.teal : d.score >= 65 ? C.accent : C.danger;
            return (
              <div key={d.metric} style={{ background: color + "12", border: `1px solid ${color}30`, borderRadius: 8, padding: "6px 4px", textAlign: "center" }}>
                <T size={13} weight="800" color={color} mono style={{ display: "block", lineHeight: 1 }}>{d.score}%</T>
                <T size={8} color={C.muted} weight="600" style={{ textTransform: "uppercase", letterSpacing: 0.3, display: "block", marginTop: 3 }}>{d.metric}</T>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );

  // LOG TAB
  const LogTab = () => (
    <div className="fade-in" style={{ padding: "16px" }}>
      <T size={22} weight="800" color={C.text} style={{ display: "block", marginBottom: 4 }}>LOG SESSION</T>
      <T size={12} color={C.muted} style={{ display: "block", marginBottom: 20 }}>{new Date().toLocaleDateString("en-CA", { weekday: "long", month: "long", day: "numeric" })}</T>

      {logStep === 0 && (
        <div className="slide-up">
          <T size={11} color={C.muted} weight="600" style={{ letterSpacing: 2, textTransform: "uppercase", display: "block", marginBottom: 12 }}>Session Type</T>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {SESSION_TYPES.map(s => (
              <button key={s.id} onClick={() => { setLogForm({ ...logForm, type: s.id }); setLogStep(1); }}
                style={{ background: logForm.type === s.id ? s.color + "25" : C.card, border: `1px solid ${logForm.type === s.id ? s.color : C.border}`, borderRadius: 12, padding: "16px 12px", cursor: "pointer", display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 22 }}>{s.icon}</span>
                <T size={13} weight="700" color={logForm.type === s.id ? s.color : C.text} style={{ textTransform: "uppercase" }}>{s.label}</T>
              </button>
            ))}
          </div>
        </div>
      )}

      {logStep === 1 && (
        <div className="slide-up">
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
            <span style={{ fontSize: 28 }}>{typeIcon(logForm.type)}</span>
            <T size={18} weight="700" color={typeColor(logForm.type)} style={{ textTransform: "uppercase" }}>{logForm.type?.replace(/_/g, " ")}</T>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
            <div>
              <T size={11} color={C.muted} style={{ display: "block", marginBottom: 6, textTransform: "uppercase", letterSpacing: 1 }}>Duration (min)</T>
              <input type="number" placeholder="60" value={logForm.duration} onChange={e => setLogForm({ ...logForm, duration: e.target.value })} />
            </div>
            <div>
              <T size={11} color={C.muted} style={{ display: "block", marginBottom: 6, textTransform: "uppercase", letterSpacing: 1 }}>Morning HRV</T>
              <input type="number" placeholder="55" value={logForm.hrv} onChange={e => setLogForm({ ...logForm, hrv: e.target.value })} />
            </div>
            <div>
              <T size={11} color={C.muted} style={{ display: "block", marginBottom: 6, textTransform: "uppercase", letterSpacing: 1 }}>HR Avg</T>
              <input type="number" placeholder="150" value={logForm.hrAvg} onChange={e => setLogForm({ ...logForm, hrAvg: e.target.value })} />
            </div>
            <div>
              <T size={11} color={C.muted} style={{ display: "block", marginBottom: 6, textTransform: "uppercase", letterSpacing: 1 }}>HR Max</T>
              <input type="number" placeholder="178" value={logForm.hrMax} onChange={e => setLogForm({ ...logForm, hrMax: e.target.value })} />
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
              <T size={11} color={C.muted} style={{ textTransform: "uppercase", letterSpacing: 1 }}>RPE</T>
              <T size={18} mono weight="700" color={logForm.rpe >= 8 ? C.danger : logForm.rpe >= 6 ? C.warn : C.teal}>{logForm.rpe}/10</T>
            </div>
            <input type="range" min="1" max="10" value={logForm.rpe} onChange={e => setLogForm({ ...logForm, rpe: e.target.value })} />
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
              <T size={10} color={C.muted}>Easy</T><T size={10} color={C.muted}>Moderate</T><T size={10} color={C.muted}>Max</T>
            </div>
          </div>

          {["run", "hyrox_sim"].includes(logForm.type) && (
            <div style={{ marginBottom: 10 }}>
              <T size={11} color={C.muted} style={{ display: "block", marginBottom: 6, textTransform: "uppercase", letterSpacing: 1 }}>Run Splits (comma separated, sec)</T>
              <input type="text" placeholder="232, 272, 292, 296..." value={logForm.runSplits} onChange={e => setLogForm({ ...logForm, runSplits: e.target.value })} />
            </div>
          )}

          <Btn onPress={() => setLogStep(2)} full color={C.accent}>Next: Add Notes →</Btn>
          <div style={{ marginTop: 10 }}>
            <Btn onPress={() => setLogStep(0)} full outline color={C.muted} small>← Change Type</Btn>
          </div>
        </div>
      )}

      {logStep === 2 && (
        <div className="slide-up">
          <T size={14} weight="700" color={typeColor(logForm.type)} style={{ display: "block", textTransform: "uppercase", marginBottom: 16 }}>
            {typeIcon(logForm.type)} {logForm.type?.replace(/_/g, " ")} · {logForm.duration}min · RPE {logForm.rpe}
          </T>

          <div style={{ marginBottom: 10 }}>
            <T size={11} color={C.muted} style={{ display: "block", marginBottom: 6, textTransform: "uppercase", letterSpacing: 1 }}>Location</T>
            <input type="text" placeholder="Altea / Basecamp / Outdoor / Condo..." value={logForm.location} onChange={e => setLogForm({ ...logForm, location: e.target.value })} />
          </div>

          <div style={{ marginBottom: 16 }}>
            <T size={11} color={C.muted} style={{ display: "block", marginBottom: 6, textTransform: "uppercase", letterSpacing: 1 }}>Notes (what failed? legs or lungs?)</T>
            <textarea rows={4} placeholder="Sled push — legs failed at 80m. Wall balls broke at rep 12. Compromised run felt strong..." value={logForm.notes} onChange={e => setLogForm({ ...logForm, notes: e.target.value })} style={{ resize: "vertical" }} />
          </div>

          <Btn onPress={submitLog} full color={C.accent}>SAVE SESSION ✓</Btn>
          <div style={{ marginTop: 10 }}>
            <Btn onPress={() => setLogStep(1)} full outline color={C.muted} small>← Back</Btn>
          </div>
        </div>
      )}
    </div>
  );

  // HISTORY TAB
  const HistoryTab = () => {
    const [expanded, setExpanded] = useState(null);
    return (
      <div className="fade-in" style={{ padding: "16px" }}>
        <T size={22} weight="800" style={{ display: "block", marginBottom: 4 }}>HISTORY</T>
        <T size={12} color={C.muted} style={{ display: "block", marginBottom: 20 }}>{workouts.length} sessions logged</T>

        {workouts.length === 0 && (
          <Card style={{ textAlign: "center", padding: 40 }}>
            <T size={32} style={{ display: "block", marginBottom: 8 }}>📋</T>
            <T size={14} color={C.muted}>No sessions yet. Log your first workout.</T>
          </Card>
        )}

        {workouts.map(w => (
          <div key={w.id} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, marginBottom: 10, overflow: "hidden" }}>
            <button onClick={() => setExpanded(expanded === w.id ? null : w.id)} style={{ width: "100%", background: "none", border: "none", cursor: "pointer", padding: "14px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ fontSize: 22 }}>{typeIcon(w.type)}</span>
                <div style={{ textAlign: "left" }}>
                  <T size={14} weight="700" color={typeColor(w.type)} style={{ display: "block", textTransform: "uppercase" }}>{w.type?.replace(/_/g, " ")}</T>
                  <T size={11} color={C.muted} mono>{fmt.date(w.date)} {w.location && `· ${w.location}`}</T>
                </div>
              </div>
              <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
                <div style={{ textAlign: "right" }}>
                  <T size={13} mono weight="600" color={C.text}>{w.duration}min</T><br />
                  <T size={12} mono color={w.rpe >= 8 ? C.danger : w.rpe >= 6 ? C.warn : C.teal}>RPE {w.rpe}</T>
                </div>
                <T size={16} color={C.muted}>{expanded === w.id ? "▲" : "▼"}</T>
              </div>
            </button>
            {expanded === w.id && (
              <div className="slide-up" style={{ padding: "0 16px 16px", borderTop: `1px solid ${C.border}` }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginTop: 12 }}>
                  {w.hrAvg && <div style={{ textAlign: "center" }}>
                    <T size={18} mono weight="700" color={C.accent} style={{ display: "block" }}>{w.hrAvg}</T>
                    <T size={10} color={C.muted}>HR AVG</T>
                  </div>}
                  {w.hrMax && <div style={{ textAlign: "center" }}>
                    <T size={18} mono weight="700" color={C.danger} style={{ display: "block" }}>{w.hrMax}</T>
                    <T size={10} color={C.muted}>HR MAX</T>
                  </div>}
                  {w.hrv && <div style={{ textAlign: "center" }}>
                    <T size={18} mono weight="700" color={C.teal} style={{ display: "block" }}>{w.hrv}ms</T>
                    <T size={10} color={C.muted}>HRV</T>
                  </div>}
                </div>
                {w.runSplits && (
                  <div style={{ marginTop: 12 }}>
                    <T size={11} color={C.muted} style={{ textTransform: "uppercase", letterSpacing: 1, display: "block", marginBottom: 6 }}>Run Splits</T>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {w.runSplits.split(",").map((s, i) => (
                        <T key={i} size={13} mono color={C.accent} style={{ background: C.accent + "15", padding: "4px 8px", borderRadius: 6 }}>km{i + 1}: {s.trim()}s</T>
                      ))}
                    </div>
                  </div>
                )}
                {w.notes && <T size={13} color={C.light} style={{ display: "block", marginTop: 12, lineHeight: 1.6 }}>{w.notes}</T>}
                <button onClick={async () => {
                  const updated = workouts.filter(x => x.id !== w.id);
                  await saveWorkouts(updated);
                  showToast("Deleted", C.danger);
                }} style={{ marginTop: 12, background: "none", border: `1px solid ${C.danger}30`, color: C.danger, borderRadius: 8, padding: "8px 14px", fontSize: 12, cursor: "pointer", fontFamily: "'Syne'" }}>
                  Delete
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    );
  };

  // WEEK TAB
  const WeekTab = () => {
    const total = WEEK1_PLAN.length;
    const done = completedSessions.length;
    const pct = Math.round((done / total) * 100);

    const days = [...new Set(WEEK1_PLAN.map(s => s.day))];

    return (
      <div className="fade-in" style={{ padding: "16px" }}>
        <T size={22} weight="800" color={C.text} style={{ display: "block", marginBottom: 2 }}>WEEK 1</T>
        <T size={12} color={C.muted} style={{ display: "block", marginBottom: 16 }}>Mar 3–9 · Base Phase</T>

        {/* Progress bar */}
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: "14px 16px", marginBottom: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <T size={11} color={C.muted} weight="600" style={{ textTransform: "uppercase", letterSpacing: 2 }}>Week Progress</T>
            <T size={14} weight="700" color={pct === 100 ? C.teal : C.accent} mono>{done}/{total} sessions</T>
          </div>
          <div style={{ background: C.border, borderRadius: 4, height: 6, overflow: "hidden" }}>
            <div style={{ background: pct === 100 ? C.teal : C.accent, height: "100%", width: `${pct}%`, borderRadius: 4, transition: "width 0.4s ease" }} />
          </div>
          {pct === 100 && (
            <T size={12} color={C.teal} weight="700" style={{ display: "block", marginTop: 8, textAlign: "center", letterSpacing: 1 }}>WEEK COMPLETE ✓</T>
          )}
        </div>

        {/* Sessions grouped by day */}
        {days.map(day => {
          const sessions = WEEK1_PLAN.filter(s => s.day === day);
          const date = sessions[0].date;
          const allDone = sessions.every(s => completedSessions.includes(s.id));
          return (
            <div key={day} style={{ marginBottom: 18 }}>
              {/* Day header */}
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                <T size={12} weight="800" color={allDone ? C.muted : C.accent} style={{ textTransform: "uppercase", letterSpacing: 2, minWidth: 36 }}>{day}</T>
                <T size={12} color={C.muted} mono>{date}</T>
                {allDone && <T size={11} color={C.teal} weight="700">✓</T>}
                <div style={{ flex: 1, height: 1, background: C.border }} />
              </div>

              {/* Session cards */}
              {sessions.map(s => {
                const isDone = completedSessions.includes(s.id);
                const color = typeColor(s.type);
                return (
                  <button key={s.id} onClick={() => toggleSession(s.id)} style={{
                    width: "100%", background: isDone ? C.surface : C.card,
                    border: `1px solid ${isDone ? C.border : color + "40"}`,
                    borderRadius: 12, padding: "14px", marginBottom: 8,
                    cursor: "pointer", textAlign: "left", display: "block",
                    opacity: isDone ? 0.6 : 1, transition: "opacity 0.2s, border-color 0.2s",
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      {/* Checkbox */}
                      <div style={{
                        width: 24, height: 24, borderRadius: "50%", flexShrink: 0,
                        border: `2px solid ${isDone ? C.teal : color}`,
                        background: isDone ? C.teal : "transparent",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        transition: "background 0.2s",
                      }}>
                        {isDone && <span style={{ color: "#000", fontSize: 13, fontWeight: 900, lineHeight: 1 }}>✓</span>}
                      </div>
                      {/* Icon + title */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
                          <span style={{ fontSize: 15 }}>{typeIcon(s.type)}</span>
                          <T size={14} weight="700" color={isDone ? C.muted : color}
                            style={{ textDecoration: isDone ? "line-through" : "none", textTransform: "uppercase", letterSpacing: 0.5 }}>
                            {s.title}
                          </T>
                        </div>
                        <T size={12} color={C.muted} mono style={{ display: "block", lineHeight: 1.5 }}>{s.details}</T>
                        {!isDone && (
                          <div style={{ marginTop: 8, paddingTop: 8, borderTop: `1px solid ${C.border}` }}>
                            <T size={11} color={C.light} style={{ display: "block", lineHeight: 1.5, fontStyle: "italic" }}>
                              💬 {s.coach}
                            </T>
                          </div>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
    );
  };

  // ─── RENDER ────────────────────────────────────────────────────────────────
  if (!loaded) return (
    <div style={{ background: C.bg, height: "100dvh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div className="pulse" style={{ textAlign: "center" }}>
        <T size={40} style={{ display: "block" }}>🏟</T>
        <T size={16} weight="700" color={C.accent}>LOADING</T>
      </div>
    </div>
  );

  const NAV_ITEMS = [
    { id: "HOME",    icon: "⌂", label: "HOME" },
    { id: "WEEK",    icon: "☑", label: "WEEK" },
    { id: "LOG",     icon: "+", label: "LOG" },
    { id: "HISTORY", icon: "≡", label: "HISTORY" },
  ];

  return (
    <div style={{ background: C.bg, minHeight: "100dvh", maxWidth: 480, width: "100%", margin: "0 auto", fontFamily: "'Syne', sans-serif", paddingBottom: 80, position: "relative", overflowX: "hidden" }}>

      {/* Toast */}
      {toast && (
        <div style={{ position: "fixed", top: 20, left: "50%", transform: "translateX(-50%)", background: toast.color, color: "#000", padding: "10px 20px", borderRadius: 10, fontSize: 13, fontWeight: 700, zIndex: 999, fontFamily: "'Syne'", letterSpacing: 1 }}>
          {toast.msg}
        </div>
      )}

      {/* Content */}
      <div style={{ paddingTop: 8, overflowY: "auto", maxHeight: "calc(100dvh - 72px)" }}>
        {tab === "HOME"    && <HomeTab />}
        {tab === "WEEK"    && <WeekTab />}
        {tab === "LOG"     && <LogTab />}
        {tab === "HISTORY" && <HistoryTab />}
      </div>

      {/* Bottom nav */}
      <div style={{ position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 480, background: C.surface, borderTop: `1px solid ${C.border}`, display: "flex", zIndex: 100 }}>
        {NAV_ITEMS.map(n => (
          <button key={n.id} onClick={() => setTab(n.id)} style={{
            flex: 1, background: "none", border: "none", cursor: "pointer", padding: "12px 0",
            display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
          }}>
            <span style={{ fontSize: n.id === "LOG" ? 28 : 18, color: tab === n.id ? C.accent : C.muted, fontWeight: 700 }}>{n.icon}</span>
            <T size={9} color={tab === n.id ? C.accent : C.muted} weight="600" style={{ letterSpacing: 1, textTransform: "uppercase" }}>{n.label}</T>
          </button>
        ))}
      </div>
    </div>
  );
}
