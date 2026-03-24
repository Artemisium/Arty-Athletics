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

const HYROX_LABELS = [
  "SKI","PUSH","PULL","BBJ","ROW","CARRY","LUNGE","WB",
  "R1","R2","R3","R4","R5","R6","R7","R8",
  "ROXZONE",
];

const HYROX_BOUNDS = {
  SKI:[450,160], PUSH:[180,42],  PULL:[300,85],  BBJ:[360,105],
  ROW:[460,175], CARRY:[180,52], LUNGE:[310,100], WB:[430,170],
  R1:[540,190],  R2:[560,200],  R3:[570,205],   R4:[575,208],
  R5:[575,208],  R6:[570,205],  R7:[565,200],   R8:[550,190],
  ROXZONE:[720,180],
};

const HYROX_SERIES_DATA = {
  current: {
    SKI:232, PUSH:85,  PULL:166, BBJ:161, ROW:262, CARRY:81, LUNGE:147, WB:207,
    R1:232,  R2:272,  R3:292,  R4:296,  R5:295,  R6:287,  R7:294,  R8:240,
    ROXZONE:480,
  },
  maxPerf: {
    SKI:195, PUSH:72,  PULL:145, BBJ:145, ROW:230, CARRY:70, LUNGE:128, WB:190,
    R1:210,  R2:248,  R3:265,  R4:270,  R5:268,  R6:260,  R7:265,  R8:215,
    ROXZONE:300,
  },
  target: {
    SKI:205, PUSH:75,  PULL:150, BBJ:150, ROW:240, CARRY:74, LUNGE:135, WB:200,
    R1:222,  R2:258,  R3:275,  R4:280,  R5:278,  R6:270,  R7:275,  R8:228,
    ROXZONE:360,
  },
  elite: {
    SKI:190, PUSH:60,  PULL:105, BBJ:133, ROW:215, CARRY:68, LUNGE:122, WB:213,
    R1:218,  R2:222,  R3:225,  R4:228,  R5:226,  R6:223,  R7:225,  R8:219,
    ROXZONE:240,
  },
};

const HYROX_SERIES_META = [
  { key:"current", label:"Doubles Est", color:"#f0a500" },
  { key:"maxPerf", label:"Max Perf",    color:"#00d4aa" },
  { key:"target",  label:"Target",      color:"#7c6af7" },
  { key:"elite",   label:"2025 10th",   color:"#ff6b6b" },
];

function hyroxNorm(seconds, [floor, ceiling]) {
  return Math.max(0, Math.min(100, Math.round((floor - seconds) / (floor - ceiling) * 100)));
}

function fmtHMS(s) {
  return `${Math.floor(s/3600)}:${String(Math.floor((s%3600)/60)).padStart(2,"0")}:${String(s%60).padStart(2,"0")}`;
}
function fmtMSS(s) {
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
function parseMSS(str) {
  const parts = String(str).trim().split(":");
  if (parts.length === 2) {
    const m = parseInt(parts[0], 10);
    const s = parseInt(parts[1], 10);
    if (!isNaN(m) && !isNaN(s) && s < 60) return m * 60 + s;
  }
  const n = parseInt(str, 10);
  return isNaN(n) ? null : n;
}

const HYROX_STATION_KEYS = ["SKI","PUSH","PULL","BBJ","ROW","CARRY","LUNGE","WB"];
const STATION_LONG = {
  SKI:"Ski Erg", PUSH:"Sled Push", PULL:"Sled Pull", BBJ:"Burpee BJ",
  ROW:"Row",     CARRY:"Farmer Carry", LUNGE:"Lunges",  WB:"Wall Balls",
};
// How much slower than fresh-max each station becomes mid-race (fatigue × position)
const STATION_FATIGUE = {
  SKI:1.15, PUSH:1.18, PULL:1.22, BBJ:1.25,
  ROW:1.28, CARRY:1.30, LUNGE:1.33, WB:1.35,
};
// Per-run pacing multipliers relative to base 1 km (R1..R8)
const RUN_FACTORS = [0.98, 1.02, 1.04, 1.05, 1.06, 1.05, 1.07, 1.04];

function computeSinglesCalc(ttStr, stationStrs) {
  const ttSecs = parseMSS(ttStr);
  if (!ttSecs) return null;
  const stn = {};
  for (const k of HYROX_STATION_KEYS) {
    const s = parseMSS(stationStrs[k]);
    if (!s) return null;
    stn[k] = s;
  }
  const splits = {};
  for (const k of HYROX_STATION_KEYS) splits[k] = Math.round(stn[k] * STATION_FATIGUE[k]);
  const base = Math.round((ttSecs / 10) * 1.10);
  for (let i = 0; i < 8; i++) splits[`R${i + 1}`] = Math.round(base * RUN_FACTORS[i]);
  splits.ROXZONE = 300;
  return splits;
}

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
const HYROX_DATA_KEY = "arty:hyrox_data";
const BODY_KEY = "arty:body_metrics";
const CLIMB_KEY = "arty:climb_log";

const BOULDER_GRADES = ["VB","V0","V1","V2","V3","V4","V5","V6","V7","V8","V9","V10"];
const TR_GRADES = ["5.6","5.7","5.8","5.9","5.10a","5.10b","5.10c","5.10d","5.11a","5.11b","5.11c","5.11d","5.12a","5.12b","5.12c","5.12d","5.13a"];
const GRADE_COLORS = {
  VB:"#4caf50",V0:"#4caf50",V1:"#66bb6a",V2:"#81c784",V3:"#f0a500",V4:"#f0a500",V5:"#ff9800",
  V6:"#ff6b6b",V7:"#ff4d4d",V8:"#e53935",V9:"#b71c1c",V10:"#880e4f",
  "5.6":"#4caf50","5.7":"#66bb6a","5.8":"#81c784","5.9":"#a5d6a7",
  "5.10a":"#f0a500","5.10b":"#f0a500","5.10c":"#ff9800","5.10d":"#ff9800",
  "5.11a":"#ff6b6b","5.11b":"#ff6b6b","5.11c":"#ff4d4d","5.11d":"#ff4d4d",
  "5.12a":"#e53935","5.12b":"#e53935","5.12c":"#b71c1c","5.12d":"#b71c1c","5.13a":"#880e4f",
};

const CLIMB_WORKOUTS = {
  boulder: [
    { name: "Pyramid Session", desc: "Warm up V0-V1 × 3 each. Then pyramid: V2, V3, V4, V5, V4, V3, V2. 3 attempts max per problem. Rest 2-3 min between harder grades.", focus: "Project-level power + volume", duration: "60-75 min" },
    { name: "4×4 Endurance", desc: "Pick 4 problems at V2-V3 (2 grades below max). Climb all 4 back-to-back, no rest. Rest 4 min. Repeat 4 sets. Focus: pump tolerance.", focus: "Forearm endurance", duration: "45-60 min" },
    { name: "Limit Bouldering", desc: "Warm up 20 min. Spend 45 min on 3-4 problems at V5-V6 (limit grade). Work individual moves, link sequences. 5 min rest between burns. Quality over quantity.", focus: "Max difficulty + recruitment", duration: "60-75 min" },
    { name: "Volume Session", desc: "Flash as many V1-V4 problems as possible in 60 min. Aim for 25+ sends. Focus on silent feet, open-hand grip, precise footwork. No falling.", focus: "Movement quality + mileage", duration: "60 min" },
  ],
  toprope: [
    { name: "Endurance Laps", desc: "Warm up on 5.8-5.9 × 2. Then climb 5.10a-5.10d continuously — up, lower, move to next route. 4-6 routes with minimal rest. Focus on breathing and efficient movement.", focus: "Route endurance + pump management", duration: "60-75 min" },
    { name: "Project Burns", desc: "Warm up 15 min. Pick 2-3 routes at 5.11a-5.11b. Work each route 3 times with full rest (5 min). Note where you fall and rehearse moves.", focus: "Redpoint strength", duration: "60-75 min" },
    { name: "Technique Pyramid", desc: "Climb 5.9, 5.10a, 5.10b, 5.10c, 5.10d, then back down. Focus on silent feet, no readjusting, smooth clips. Down-climb the last 5.9.", focus: "Technique under increasing difficulty", duration: "45-60 min" },
  ],
  fingerboard: [
    { name: "Repeaters (Endurance)", desc: "Large edge (35mm): 7s hang / 3s rest × 6 reps = 1 set. 3 min rest. 4-5 sets. Bodyweight only. Half crimp grip. Focus on consistent form.", focus: "Tendon conditioning + capillarity", duration: "20-25 min", board: "Metolius Sim 3D — large rung" },
    { name: "Max Hangs (Strength)", desc: "20mm edge: 10s hang, 3 min rest × 5 sets. Add weight until 10s is near-max. Start at bodyweight, progress +5lbs/week. Half crimp only.", focus: "Max finger strength", duration: "20-25 min", board: "Metolius Sim 3D — medium edge" },
    { name: "Min Edge Protocol", desc: "Progressively smaller edges: 35mm × 3 hangs, 25mm × 3 hangs, 20mm × 3 hangs. 10s each, 2 min rest. Bodyweight. Stop if form breaks.", focus: "Contact strength on small holds", duration: "15-20 min", board: "Metolius Sim 3D — descending edges" },
    { name: "Pocket & Pinch Work", desc: "2-finger pockets (middle+ring): 5s hang × 3 reps, 2 min rest. 3 sets. Then pinch block or Metolius pinch holds: 10s × 5 sets. Light weight.", focus: "Grip variety + weak position strength", duration: "15-20 min", board: "Metolius Sim 3D — pockets + pinches" },
  ],
};

const BODY_GOALS = {
  weight: { current: 176, target: 171, unit: "lbs" },
  bodyFat: { current: 13.2, target: 10.0, unit: "%" },
  leanMass: { current: 152.7, unit: "lbs" },
};

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
  const [bodyMetrics, setBodyMetrics] = useState([]);
  const [bodyForm, setBodyForm] = useState({ weight: "", bodyFat: "", muscleMass: "", bmi: "", water: "", notes: "" });
  const [climbLog, setClimbLog] = useState([]);
  const [climbSession, setClimbSession] = useState({ type: null, sends: {}, notes: "" }); // type: "boulder" | "toprope" | null
  const [climbView, setClimbView] = useState("log"); // "log" | "workouts"
  const [vitalsView, setVitalsView] = useState("body"); // "body" | "dashboard" | "metrics"
  const [garminData, setGarminData] = useState(null);
  const [garminStatus, setGarminStatus] = useState("idle"); // idle | loading | ok | not_configured | error
  const [hyroxActive, setHyroxActive] = useState({ current:true, maxPerf:true, target:true, elite:true });
  const [hyroxView,   setHyroxView]   = useState("overlay");
  const [hyroxData,   setHyroxData]   = useState(() => ({
    current: { ...HYROX_SERIES_DATA.current },
    maxPerf: { ...HYROX_SERIES_DATA.maxPerf },
    target:  { ...HYROX_SERIES_DATA.target  },
    elite:   { ...HYROX_SERIES_DATA.elite   },
  }));
  const [calcTT,       setCalcTT]       = useState("");
  const [calcStations, setCalcStations] = useState(
    Object.fromEntries(HYROX_STATION_KEYS.map(k => [k, ""]))
  );
  const splitTableRef    = useRef(null);
  const [splitEditorVer, setSplitEditorVer] = useState(0);

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
    fetchGarmin();
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
    try {
      const bm = await window.storage.get(BODY_KEY);
      if (bm) setBodyMetrics(JSON.parse(bm.value));
    } catch {}
    try {
      const cl = await window.storage.get(CLIMB_KEY);
      if (cl) setClimbLog(JSON.parse(cl.value));
    } catch {}
    try {
      const clLocal = localStorage.getItem(CLIMB_KEY);
      if (clLocal) { const p = JSON.parse(clLocal); if (p.length) setClimbLog(p); }
    } catch {}
    try {
      const bmLocal = localStorage.getItem(BODY_KEY);
      if (bmLocal) {
        const parsed = JSON.parse(bmLocal);
        if (parsed.length) setBodyMetrics(parsed);
      }
    } catch {}
    try {
      let hyroxLoaded = null;
      try {
        const local = localStorage.getItem(HYROX_DATA_KEY);
        if (local) hyroxLoaded = JSON.parse(local);
      } catch {}
      if (!hyroxLoaded) {
        const hd = await window.storage.get(HYROX_DATA_KEY);
        if (hd) hyroxLoaded = JSON.parse(hd.value);
      }
      if (hyroxLoaded) {
        setHyroxData(hyroxLoaded);
        setSplitEditorVer(v => v + 1);
      }
    } catch {}
    setLoaded(true);
  }

  async function fetchGarmin() {
    setGarminStatus("loading");
    try {
      const resp = await fetch("/api/garmin-sync");
      const json = await resp.json();
      if (json.status === "ok" && json.data) {
        setGarminData(json.data);
        setGarminStatus("ok");
      } else if (json.status === "not_configured") {
        setGarminStatus("not_configured");
      } else {
        setGarminStatus("error");
        if (json.data) setGarminData(json.data); // use cached
      }
    } catch {
      setGarminStatus("error");
    }
  }

  async function saveWorkouts(arr) {
    await window.storage.set(WORKOUTS_KEY, JSON.stringify(arr));
    setWorkouts(arr);
  }
  async function saveHrv(arr) {
    await window.storage.set(HRV_KEY, JSON.stringify(arr));
    setHrvLog(arr);
  }

  async function saveBodyMetrics(arr) {
    const json = JSON.stringify(arr);
    try { localStorage.setItem(BODY_KEY, json); } catch {}
    try { await window.storage.set(BODY_KEY, json); } catch {}
    setBodyMetrics(arr);
  }

  async function saveClimbLog(arr) {
    const json = JSON.stringify(arr);
    try { localStorage.setItem(CLIMB_KEY, json); } catch {}
    try { await window.storage.set(CLIMB_KEY, json); } catch {}
    setClimbLog(arr);
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

  function toggleHyroxSeries(key) {
    setHyroxActive(prev => ({ ...prev, [key]: !prev[key] }));
  }
  function updateHyroxTime(seriesKey, segment, seconds) {
    setHyroxData(prev => ({
      ...prev,
      [seriesKey]: { ...prev[seriesKey], [segment]: seconds },
    }));
  }
  async function persistHyroxData(data) {
    const json = JSON.stringify(data);
    try { localStorage.setItem(HYROX_DATA_KEY, json); } catch {}
    try { await window.storage.set(HYROX_DATA_KEY, json); } catch {}
  }
  async function saveHyroxEdits() {
    if (!splitTableRef.current) return;
    const next = {
      current: { ...hyroxData.current },
      maxPerf: { ...hyroxData.maxPerf },
      target:  { ...hyroxData.target  },
      elite:   { ...hyroxData.elite   },
    };
    splitTableRef.current.querySelectorAll("input[data-series]").forEach(inp => {
      const v = parseMSS(inp.value);
      if (v !== null) next[inp.dataset.series][inp.dataset.segment] = v;
    });
    setHyroxData(next);
    await persistHyroxData(next);
    showToast("SPLITS SAVED ✓");
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

      {/* Quick vitals preview — tap to go to VITALS */}
      {garminStatus === "ok" && garminData && (
        <button onClick={() => setTab("VITALS")} style={{ width: "100%", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
          <Card>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <T size={11} color={C.teal} weight="600" style={{ letterSpacing: 2, textTransform: "uppercase" }}>Vitals Snapshot</T>
              <T size={9} color={C.accent} weight="600">TAP FOR DETAILS →</T>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
              {garminData.heartRate?.resting && (
                <div style={{ textAlign: "center" }}>
                  <T size={20} mono weight="700" color={C.danger} style={{ display: "block" }}>{garminData.heartRate.resting}</T>
                  <T size={9} color={C.muted}>RHR</T>
                </div>
              )}
              {(garminData.hrv?.lastNight || lastHrv) && (
                <div style={{ textAlign: "center" }}>
                  <T size={20} mono weight="700" color={C.teal} style={{ display: "block" }}>{garminData.hrv?.lastNight || lastHrv}</T>
                  <T size={9} color={C.muted}>HRV</T>
                </div>
              )}
              {garminData.sleep?.quality && (
                <div style={{ textAlign: "center" }}>
                  <T size={20} mono weight="700" color={C.purple} style={{ display: "block" }}>{garminData.sleep.quality}</T>
                  <T size={9} color={C.muted}>Sleep</T>
                </div>
              )}
            </div>
          </Card>
        </button>
      )}
      {garminStatus === "not_configured" && (
        <Card style={{ borderColor: C.warn + "40" }}>
          <T size={11} color={C.warn} weight="600" style={{ letterSpacing: 2, textTransform: "uppercase", display: "block", marginBottom: 6 }}>Garmin — Not Connected</T>
          <T size={12} color={C.muted} style={{ lineHeight: 1.5 }}>Add GARMIN_EMAIL and GARMIN_PASSWORD to your Vercel environment variables to enable live sync from your Epix Pro.</T>
        </Card>
      )}

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
        <T size={22} weight="800" style={{ display: "block", marginBottom: 4 }}>MORE</T>
        <T size={12} color={C.muted} style={{ display: "block", marginBottom: 12 }}>{workouts.length} sessions logged</T>

        {/* Quick links */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 16 }}>
          <button onClick={() => setTab("BODY")} style={{ background: C.accent + "12", border: `1px solid ${C.accent}30`, borderRadius: 10, padding: "12px", cursor: "pointer", textAlign: "center" }}>
            <T size={18} style={{ display: "block" }}>⚖</T>
            <T size={11} color={C.accent} weight="700" style={{ letterSpacing: 1 }}>LOG WEIGH-IN</T>
          </button>
          <button onClick={() => setTab("WEEK")} style={{ background: C.purple + "12", border: `1px solid ${C.purple}30`, borderRadius: 10, padding: "12px", cursor: "pointer", textAlign: "center" }}>
            <T size={18} style={{ display: "block" }}>📅</T>
            <T size={11} color={C.purple} weight="700" style={{ letterSpacing: 1 }}>WEEK PLAN</T>
          </button>
        </div>

        <T size={14} weight="700" color={C.text} style={{ display: "block", marginBottom: 10, letterSpacing: 1, textTransform: "uppercase" }}>Session History</T>

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

  // HYROX TAB
  const HyroxTab = () => {
    const HyroxTick = ({ x, y, cx, cy, payload }) => {
      const dx = x - cx; const dy = y - cy;
      const len = Math.sqrt(dx*dx + dy*dy) || 1;
      const ox = (dx/len)*10; const oy = (dy/len)*10;
      const anchor = dx > 2 ? "start" : dx < -2 ? "end" : "middle";
      const baseline = dy > 2 ? "hanging" : dy < -2 ? "auto" : "central";
      return (
        <text x={x+ox} y={y+oy} textAnchor={anchor} dominantBaseline={baseline}
          style={{ fontFamily:"'Syne'", fontSize:8, fontWeight:700, fill:C.light, letterSpacing:0.5 }}>
          {payload.value}
        </text>
      );
    };

    const SmallTick = ({ x, y, cx, cy, payload }) => {
      const dx = x - cx; const dy = y - cy;
      const len = Math.sqrt(dx*dx + dy*dy) || 1;
      const ox = (dx/len)*8; const oy = (dy/len)*8;
      const anchor = dx > 2 ? "start" : dx < -2 ? "end" : "middle";
      const baseline = dy > 2 ? "hanging" : dy < -2 ? "auto" : "central";
      return (
        <text x={x+ox} y={y+oy} textAnchor={anchor} dominantBaseline={baseline}
          style={{ fontFamily:"'Syne'", fontSize:7, fontWeight:700, fill:C.muted, letterSpacing:0.3 }}>
          {payload.value}
        </text>
      );
    };

    const hyroxRadarData = HYROX_LABELS.map(k => ({
      metric:  k,
      current: hyroxNorm(hyroxData.current[k], HYROX_BOUNDS[k]),
      maxPerf: hyroxNorm(hyroxData.maxPerf[k],  HYROX_BOUNDS[k]),
      target:  hyroxNorm(hyroxData.target[k],   HYROX_BOUNDS[k]),
      elite:   hyroxNorm(hyroxData.elite[k],    HYROX_BOUNDS[k]),
    }));
    const hyroxTotals = Object.fromEntries(
      Object.entries(hyroxData).map(([k,v]) => [k, fmtHMS(Object.values(v).reduce((a,b)=>a+b,0))])
    );

    return (
      <div className="fade-in" style={{ padding: "16px 16px 0" }}>
        {/* Header */}
        <div style={{ marginBottom: 14 }}>
          <T size={11} color={C.muted} weight="600" style={{ letterSpacing: 2, textTransform: "uppercase", display: "block" }}>Race Analysis</T>
          <T size={26} weight="800" color={C.accent} style={{ display: "block", fontFamily: "'Syne'" }}>HYROX FOCUS</T>
          <T size={11} color={C.muted} style={{ display: "block" }}>16-segment profile · Singles · Oct 2026</T>
        </div>

        {/* Series toggles + view toggle */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12, alignItems: "center" }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, flex: 1 }}>
            {HYROX_SERIES_META.map(s => {
              const active = hyroxActive[s.key];
              return (
                <button key={s.key} onClick={() => toggleHyroxSeries(s.key)} style={{
                  background: active ? s.color + "20" : "transparent",
                  border: `1px solid ${active ? s.color : C.border}`,
                  borderRadius: 20, padding: "6px 12px",
                  cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
                  opacity: active ? 1 : 0.5, transition: "all 0.2s",
                }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: active ? s.color : "transparent", border: `2px solid ${s.color}`, display: "inline-block", flexShrink: 0 }} />
                  <T size={11} color={active ? s.color : C.muted} weight="700" style={{ textTransform: "uppercase", letterSpacing: 0.5 }}>{s.label}</T>
                </button>
              );
            })}
          </div>
          <button onClick={() => setHyroxView(v => v === "overlay" ? "sidebyside" : "overlay")} style={{
            background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8,
            padding: "6px 12px", cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
            color: C.light, fontSize: 11, fontFamily: "'Syne'", fontWeight: 700, letterSpacing: 0.5,
            whiteSpace: "nowrap",
          }}>
            {hyroxView === "overlay" ? "⊞ Side by Side" : "⊟ Overlay"}
          </button>
        </div>

        {/* Chart area */}
        {hyroxView === "overlay" ? (
          <Card>
            <T size={11} color={C.muted} weight="600" style={{ letterSpacing: 2, textTransform: "uppercase", display: "block", marginBottom: 8 }}>Overlay — All Series</T>
            <ResponsiveContainer width="100%" height={300}>
              <RadarChart data={hyroxRadarData} margin={{ top: 16, right: 28, bottom: 16, left: 28 }}>
                <PolarGrid stroke={C.border} />
                <PolarAngleAxis dataKey="metric" tick={HyroxTick} />
                <PolarRadiusAxis domain={[0,100]} tick={false} axisLine={false} />
                <Radar dataKey={() => 100} stroke={C.border} fill={C.border} fillOpacity={0.08} strokeDasharray="4 3" strokeWidth={1} dot={false} />
                {HYROX_SERIES_META.map(s => hyroxActive[s.key] ? (
                  <Radar key={s.key} dataKey={s.key} stroke={s.color} fill={s.color} fillOpacity={0.15} strokeWidth={2}
                    dot={{ r: 2, fill: s.color, strokeWidth: 0 }} activeDot={{ r: 4, fill: s.color }} />
                ) : null)}
                <Tooltip contentStyle={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 11, color: C.text }}
                  formatter={(v, name, props) => {
                    const secs = hyroxData[name]?.[props.payload.metric];
                    return [secs != null ? fmtMSS(secs) : `${v}`, HYROX_SERIES_META.find(s => s.key === name)?.label || name];
                  }} />
              </RadarChart>
            </ResponsiveContainer>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 8, justifyContent: "center" }}>
              {HYROX_SERIES_META.map(s => (
                <div key={s.key} style={{ display: "flex", alignItems: "center", gap: 5, opacity: hyroxActive[s.key] ? 1 : 0.3 }}>
                  <div style={{ width: 20, height: 2, background: s.color, borderRadius: 1 }} />
                  <T size={10} color={s.color} weight="600" style={{ textTransform: "uppercase" }}>{s.label}</T>
                </div>
              ))}
            </div>
          </Card>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
            {HYROX_SERIES_META.map(s => {
              const active = hyroxActive[s.key];
              return (
                <div key={s.key} style={{
                  background: C.card,
                  border: `1px solid ${active ? s.color + "60" : C.border}`,
                  borderRadius: 12, padding: "10px",
                  opacity: active ? 1 : 0.4,
                  transition: "opacity 0.2s, border-color 0.2s",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: s.color }} />
                    <T size={10} color={s.color} weight="700" style={{ textTransform: "uppercase", letterSpacing: 1 }}>{s.label}</T>
                  </div>
                  <ResponsiveContainer width="100%" height={180}>
                    <RadarChart data={hyroxRadarData} margin={{ top: 12, right: 20, bottom: 12, left: 20 }}>
                      <PolarGrid stroke={C.border} />
                      <PolarAngleAxis dataKey="metric" tick={SmallTick} />
                      <PolarRadiusAxis domain={[0,100]} tick={false} axisLine={false} />
                      <Radar dataKey={() => 100} stroke={C.border} fill={C.border} fillOpacity={0.06} strokeDasharray="3 2" strokeWidth={1} dot={false} />
                      <Radar dataKey={s.key} stroke={s.color} fill={s.color} fillOpacity={0.2} strokeWidth={1.5} dot={false} />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
              );
            })}
          </div>
        )}

        {/* Stats card */}
        <Card>
          <T size={11} color={C.muted} weight="600" style={{ letterSpacing: 2, textTransform: "uppercase", display: "block", marginBottom: 10 }}>Est. Total Race Time</T>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8 }}>
            {HYROX_SERIES_META.map(s => (
              <div key={s.key} style={{
                background: hyroxActive[s.key] ? s.color + "15" : C.surface,
                border: `1px solid ${hyroxActive[s.key] ? s.color + "40" : C.border}`,
                borderRadius: 8, padding: "8px 6px", textAlign: "center",
                opacity: hyroxActive[s.key] ? 1 : 0.4, transition: "all 0.2s",
              }}>
                <T size={9} color={hyroxActive[s.key] ? s.color : C.muted} weight="700" style={{ display: "block", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>{s.label}</T>
                <T size={12} color={hyroxActive[s.key] ? s.color : C.muted} mono weight="700" style={{ display: "block" }}>{hyroxTotals[s.key]}</T>
              </div>
            ))}
          </div>
        </Card>

        {/* Split Editor */}
        <Card style={{ marginTop: 12, marginBottom: 16 }}>
          <T size={11} color={C.muted} weight="600" style={{ letterSpacing: 2, textTransform: "uppercase", display: "block", marginBottom: 10 }}>Split Editor · edit cells then Save</T>
          <div ref={splitTableRef} key={splitEditorVer} style={{ overflowX: "auto" }}>
            <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 340 }}>
              <thead>
                <tr>
                  <th style={{ padding: "4px 8px", textAlign: "left", width: 46 }}></th>
                  {HYROX_SERIES_META.map(s => (
                    <th key={s.key} style={{ padding: "4px 6px", textAlign: "center" }}>
                      <T size={9} color={s.color} weight="700" style={{ textTransform: "uppercase", letterSpacing: 0.8 }}>{s.label}</T>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {HYROX_LABELS.map(label => (
                  <tr key={label} style={{ borderTop: `1px solid ${C.border}` }}>
                    <td style={{ padding: "4px 8px" }}>
                      <T size={10} color={C.muted} weight="700" style={{ textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</T>
                    </td>
                    {HYROX_SERIES_META.map(s => (
                      <td key={s.key} style={{ padding: "2px 4px" }}>
                        <input
                          key={`${s.key}-${label}`}
                          type="text"
                          defaultValue={fmtMSS(hyroxData[s.key][label])}
                          onFocus={e => e.target.select()}
                          data-series={s.key}
                          data-segment={label}
                          style={{
                            background: "transparent",
                            border: "none",
                            borderBottom: `1px solid ${C.border}`,
                            color: s.color,
                            fontFamily: "'JetBrains Mono', monospace",
                            fontSize: 13,
                            width: "100%",
                            textAlign: "center",
                            padding: "4px 2px",
                            outline: "none",
                          }}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 10 }}>
            <button onClick={saveHyroxEdits} style={{
              background: C.accent + "20", border: `1px solid ${C.accent}`,
              borderRadius: 8, padding: "7px 18px", cursor: "pointer",
              color: C.accent, fontSize: 11, fontFamily: "'Syne'", fontWeight: 700, letterSpacing: 0.5,
            }}>Save ✓</button>
          </div>
        </Card>

        {/* Singles Race Calculator */}
        {(() => {
          const calcResult = computeSinglesCalc(calcTT, calcStations);
          const iStyle = {
            background: C.surface, border: `1px solid ${C.border}`, borderRadius: 6,
            color: C.light, fontFamily: "'JetBrains Mono', monospace", fontSize: 13,
            padding: "5px 8px", outline: "none", textAlign: "center", width: "100%",
          };
          return (
            <Card style={{ marginTop: 12, marginBottom: 16 }}>
              <T size={11} color={C.muted} weight="600" style={{ letterSpacing: 2, textTransform: "uppercase", display: "block", marginBottom: 2 }}>Singles Race Calculator</T>
              <T size={10} color={C.muted} style={{ display: "block", marginBottom: 12 }}>Fresh max · open weight · full distance → race estimate</T>

              {/* 10km TT */}
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, paddingBottom: 12, borderBottom: `1px solid ${C.border}` }}>
                <T size={11} color={C.light} weight="700" style={{ flexShrink: 0, width: 70 }}>10 km TT</T>
                <input type="text" placeholder="38:30" defaultValue={calcTT}
                  onBlur={e => setCalcTT(e.target.value)}
                  style={{ ...iStyle, width: 90 }} />
                <T size={10} color={C.muted}>m:ss</T>
              </div>

              {/* Station inputs */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 16px", marginBottom: 14 }}>
                {HYROX_STATION_KEYS.map(k => (
                  <div key={k} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <T size={10} color={C.muted} weight="700" style={{ width: 76, flexShrink: 0 }}>{STATION_LONG[k]}</T>
                    <input type="text" placeholder="m:ss" defaultValue={calcStations[k]}
                      onBlur={e => setCalcStations(prev => ({ ...prev, [k]: e.target.value }))}
                      style={iStyle} />
                  </div>
                ))}
              </div>

              {/* Results */}
              {calcResult ? (
                <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 12 }}>
                  <T size={11} color={C.muted} weight="600" style={{ letterSpacing: 2, textTransform: "uppercase", display: "block", marginBottom: 8 }}>Estimated Singles Splits</T>
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 260 }}>
                      <thead>
                        <tr>
                          <th style={{ padding: "2px 8px", textAlign: "left" }}><T size={9} color={C.muted} weight="700">SEG</T></th>
                          <th style={{ padding: "2px 6px", textAlign: "center" }}><T size={9} color={C.muted} weight="700">FRESH</T></th>
                          <th style={{ padding: "2px 6px", textAlign: "center" }}><T size={9} color={C.muted} weight="700">RACE EST</T></th>
                          <th style={{ padding: "2px 6px", textAlign: "center" }}><T size={9} color={C.muted} weight="700">+%</T></th>
                        </tr>
                      </thead>
                      <tbody>
                        {HYROX_LABELS.map((label, i) => {
                          const isStation = i < 8;
                          const fresh = isStation ? parseMSS(calcStations[label]) : null;
                          const est = calcResult[label];
                          const pct = fresh ? `+${Math.round((est / fresh - 1) * 100)}%` : null;
                          return (
                            <tr key={label} style={{ borderTop: `1px solid ${C.border}` }}>
                              <td style={{ padding: "4px 8px" }}>
                                <T size={10} color={isStation ? C.accent : C.light} weight="700" style={{ textTransform: "uppercase" }}>{label}</T>
                              </td>
                              <td style={{ padding: "4px 6px", textAlign: "center" }}>
                                <T size={10} color={C.muted} mono>{fresh ? fmtMSS(fresh) : "—"}</T>
                              </td>
                              <td style={{ padding: "4px 6px", textAlign: "center" }}>
                                <T size={12} color={C.light} mono weight="700">{fmtMSS(est)}</T>
                              </td>
                              <td style={{ padding: "4px 6px", textAlign: "center" }}>
                                <T size={9} color={C.muted}>{pct ?? ""}</T>
                              </td>
                            </tr>
                          );
                        })}
                        <tr style={{ borderTop: `2px solid ${C.border}` }}>
                          <td colSpan={2} style={{ padding: "6px 8px" }}>
                            <T size={10} color={C.muted} weight="700">TOTAL</T>
                          </td>
                          <td colSpan={2} style={{ padding: "6px 8px", textAlign: "center" }}>
                            <T size={14} color={C.accent} mono weight="700">
                              {fmtHMS(HYROX_LABELS.reduce((sum, k) => sum + calcResult[k], 0))}
                            </T>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  <button
                    onClick={() => {
                      const next = { ...hyroxData, maxPerf: { ...hyroxData.maxPerf, ...calcResult } };
                      setHyroxData(next);
                      persistHyroxData(next);
                      setSplitEditorVer(v => v + 1);
                    }}
                    style={{
                      marginTop: 10, width: "100%", background: C.accent + "20",
                      border: `1px solid ${C.accent}`, borderRadius: 8, padding: "8px 12px",
                      cursor: "pointer", color: C.accent, fontSize: 11,
                      fontFamily: "'Syne'", fontWeight: 700, letterSpacing: 0.5,
                    }}>
                    Apply to Max Perf ↗
                  </button>
                </div>
              ) : (
                <T size={10} color={C.muted} style={{ display: "block", textAlign: "center", padding: "8px 0" }}>
                  Fill all fields above to see estimated splits
                </T>
              )}
            </Card>
          );
        })()}
      </div>
    );
  };

  // CLIMB TAB
  const ClimbTab = () => {
    const grades = climbSession.type === "boulder" ? BOULDER_GRADES : TR_GRADES;
    const totalSends = Object.values(climbSession.sends).reduce((a, b) => a + b, 0);
    const hardestSend = grades.slice().reverse().find(g => (climbSession.sends[g] || 0) > 0);

    const sorted = [...climbLog].sort((a, b) => new Date(b.date) - new Date(a.date));
    const last30 = sorted.filter(s => (Date.now() - new Date(s.date)) < 30 * 86400000);
    const boulderSessions = last30.filter(s => s.type === "boulder");
    const trSessions = last30.filter(s => s.type === "toprope");

    // Grade distribution for charts
    const gradeStats = (sessions, gradeList) => {
      const counts = {};
      gradeList.forEach(g => counts[g] = 0);
      sessions.forEach(s => Object.entries(s.sends || {}).forEach(([g, n]) => { if (counts[g] !== undefined) counts[g] += n; }));
      return gradeList.map(g => ({ grade: g, count: counts[g] })).filter(d => d.count > 0);
    };

    async function submitClimb() {
      if (totalSends === 0) { showToast("Log at least one send", C.danger); return; }
      const entry = {
        id: Date.now(),
        date: new Date().toISOString(),
        type: climbSession.type,
        sends: { ...climbSession.sends },
        totalSends,
        hardest: hardestSend,
        notes: climbSession.notes,
      };
      await saveClimbLog([...climbLog, entry]);
      setClimbSession({ type: null, sends: {}, notes: "" });
      showToast("CLIMB SESSION LOGGED ✓");
    }

    function addSend(grade) {
      setClimbSession(prev => ({
        ...prev,
        sends: { ...prev.sends, [grade]: (prev.sends[grade] || 0) + 1 },
      }));
    }
    function removeSend(grade) {
      setClimbSession(prev => {
        const n = (prev.sends[grade] || 0) - 1;
        const next = { ...prev.sends };
        if (n <= 0) delete next[grade]; else next[grade] = n;
        return { ...prev, sends: next };
      });
    }

    return (
      <div className="fade-in" style={{ padding: "16px 16px 0" }}>
        <div style={{ marginBottom: 14 }}>
          <T size={11} color={C.muted} weight="600" style={{ letterSpacing: 2, textTransform: "uppercase", display: "block" }}>Climbing</T>
          <T size={26} weight="800" color={C.accent} style={{ display: "block", fontFamily: "'Syne'" }}>CLIMB</T>
          <T size={11} color={C.muted} style={{ display: "block" }}>V3–V5 Boulder · 5.10–5.11 Top Rope · Metolius Sim 3D</T>
        </div>

        {/* View toggle */}
        <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
          {[["log","LOG SESSION"],["workouts","WORKOUTS"]].map(([v, label]) => (
            <button key={v} onClick={() => setClimbView(v)} style={{
              flex: 1, background: climbView === v ? C.accent + "20" : C.card,
              border: `1px solid ${climbView === v ? C.accent : C.border}`,
              borderRadius: 10, padding: "10px", cursor: "pointer",
              color: climbView === v ? C.accent : C.muted, fontSize: 12,
              fontFamily: "'Syne'", fontWeight: 700, letterSpacing: 1,
            }}>{label}</button>
          ))}
        </div>

        {climbView === "log" && (
          <>
            {/* Type selector */}
            {!climbSession.type && (
              <div className="slide-up" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
                <button onClick={() => setClimbSession({ ...climbSession, type: "boulder" })} style={{
                  background: C.card, border: `1px solid ${C.accent}40`, borderRadius: 12, padding: "20px 12px",
                  cursor: "pointer", textAlign: "center",
                }}>
                  <span style={{ fontSize: 32, display: "block", marginBottom: 6 }}>🪨</span>
                  <T size={14} weight="700" color={C.accent} style={{ textTransform: "uppercase" }}>Bouldering</T>
                  <T size={10} color={C.muted} style={{ display: "block", marginTop: 4 }}>V-scale grades</T>
                </button>
                <button onClick={() => setClimbSession({ ...climbSession, type: "toprope" })} style={{
                  background: C.card, border: `1px solid ${C.teal}40`, borderRadius: 12, padding: "20px 12px",
                  cursor: "pointer", textAlign: "center",
                }}>
                  <span style={{ fontSize: 32, display: "block", marginBottom: 6 }}>🧗</span>
                  <T size={14} weight="700" color={C.teal} style={{ textTransform: "uppercase" }}>Top Rope</T>
                  <T size={10} color={C.muted} style={{ display: "block", marginTop: 4 }}>YDS grades</T>
                </button>
              </div>
            )}

            {/* Grade buttons */}
            {climbSession.type && (
              <div className="slide-up">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 22 }}>{climbSession.type === "boulder" ? "🪨" : "🧗"}</span>
                    <T size={16} weight="700" color={climbSession.type === "boulder" ? C.accent : C.teal} style={{ textTransform: "uppercase" }}>
                      {climbSession.type === "boulder" ? "Bouldering" : "Top Rope"}
                    </T>
                  </div>
                  <button onClick={() => setClimbSession({ type: null, sends: {}, notes: "" })} style={{
                    background: "none", border: `1px solid ${C.muted}40`, borderRadius: 8,
                    padding: "4px 10px", cursor: "pointer", color: C.muted, fontSize: 11, fontFamily: "'Syne'",
                  }}>Change</button>
                </div>

                <T size={11} color={C.muted} weight="600" style={{ letterSpacing: 2, textTransform: "uppercase", display: "block", marginBottom: 8 }}>Tap grade to add send</T>

                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
                  {grades.map(g => {
                    const count = climbSession.sends[g] || 0;
                    const gc = GRADE_COLORS[g] || C.accent;
                    return (
                      <button key={g} onClick={() => addSend(g)} style={{
                        position: "relative",
                        background: count > 0 ? gc + "25" : C.card,
                        border: `1px solid ${count > 0 ? gc : C.border}`,
                        borderRadius: 8, padding: "10px 6px", cursor: "pointer",
                        minWidth: climbSession.type === "boulder" ? 52 : 56,
                        textAlign: "center", transition: "all 0.15s",
                      }}>
                        <T size={13} weight="700" color={count > 0 ? gc : C.light} mono style={{ display: "block" }}>{g}</T>
                        {count > 0 && (
                          <div style={{ position: "absolute", top: -6, right: -6, background: gc, color: "#000",
                            width: 20, height: 20, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
                            fontSize: 11, fontWeight: 800, fontFamily: "'JetBrains Mono'" }}>{count}</div>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Current sends summary */}
                {totalSends > 0 && (
                  <Card>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                      <T size={11} color={C.muted} weight="600" style={{ textTransform: "uppercase", letterSpacing: 2 }}>This Session</T>
                      <T size={14} mono weight="700" color={C.accent}>{totalSends} sends</T>
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {grades.filter(g => climbSession.sends[g]).map(g => (
                        <div key={g} style={{ display: "flex", alignItems: "center", gap: 4, background: (GRADE_COLORS[g] || C.accent) + "15",
                          border: `1px solid ${(GRADE_COLORS[g] || C.accent)}30`, borderRadius: 8, padding: "6px 10px" }}>
                          <T size={13} mono weight="700" color={GRADE_COLORS[g] || C.accent}>{g} × {climbSession.sends[g]}</T>
                          <button onClick={(e) => { e.stopPropagation(); removeSend(g); }} style={{
                            background: "none", border: "none", color: C.danger, cursor: "pointer",
                            fontSize: 16, padding: "0 2px", lineHeight: 1,
                          }}>−</button>
                        </div>
                      ))}
                    </div>
                    {hardestSend && (
                      <T size={12} color={C.muted} style={{ display: "block", marginTop: 8 }}>Hardest: <T size={12} mono weight="700" color={GRADE_COLORS[hardestSend] || C.accent}>{hardestSend}</T></T>
                    )}
                  </Card>
                )}

                <div style={{ marginBottom: 12 }}>
                  <T size={11} color={C.muted} style={{ display: "block", marginBottom: 6, textTransform: "uppercase", letterSpacing: 1 }}>Notes</T>
                  <input type="text" placeholder="Felt strong on crimps, slopers still weak..." value={climbSession.notes}
                    onChange={e => setClimbSession({ ...climbSession, notes: e.target.value })} />
                </div>

                <Btn onPress={submitClimb} full color={climbSession.type === "boulder" ? C.accent : C.teal}>SAVE SESSION ✓</Btn>
              </div>
            )}

            {/* Grade distribution charts */}
            {boulderSessions.length > 0 && (
              <Card style={{ marginTop: 14 }}>
                <T size={11} color={C.muted} weight="600" style={{ letterSpacing: 2, textTransform: "uppercase", display: "block", marginBottom: 10 }}>Boulder Sends — Last 30 Days</T>
                <ResponsiveContainer width="100%" height={120}>
                  <BarChart data={gradeStats(boulderSessions, BOULDER_GRADES)} margin={{ top: 0, right: 4, left: -20, bottom: 0 }}>
                    <XAxis dataKey="grade" tick={{ fontSize: 10, fill: C.muted }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 9, fill: C.muted }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <Bar dataKey="count" radius={[4, 4, 0, 0]}
                      fill={C.accent}
                      label={{ position: "top", fontSize: 10, fill: C.muted }} />
                    <Tooltip contentStyle={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 12, color: C.text }}
                      formatter={(v) => [`${v} sends`]} />
                  </BarChart>
                </ResponsiveContainer>
              </Card>
            )}

            {trSessions.length > 0 && (
              <Card style={{ marginTop: 10 }}>
                <T size={11} color={C.muted} weight="600" style={{ letterSpacing: 2, textTransform: "uppercase", display: "block", marginBottom: 10 }}>Top Rope Sends — Last 30 Days</T>
                <ResponsiveContainer width="100%" height={120}>
                  <BarChart data={gradeStats(trSessions, TR_GRADES)} margin={{ top: 0, right: 4, left: -20, bottom: 0 }}>
                    <XAxis dataKey="grade" tick={{ fontSize: 9, fill: C.muted }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 9, fill: C.muted }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <Bar dataKey="count" radius={[4, 4, 0, 0]} fill={C.teal}
                      label={{ position: "top", fontSize: 10, fill: C.muted }} />
                    <Tooltip contentStyle={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 12, color: C.text }}
                      formatter={(v) => [`${v} sends`]} />
                  </BarChart>
                </ResponsiveContainer>
              </Card>
            )}

            {/* Session history */}
            {sorted.length > 0 && (
              <Card style={{ marginTop: 10 }}>
                <T size={11} color={C.muted} weight="600" style={{ letterSpacing: 2, textTransform: "uppercase", display: "block", marginBottom: 10 }}>Recent Sessions</T>
                {sorted.slice(0, 8).map(s => (
                  <div key={s.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: `1px solid ${C.border}` }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 16 }}>{s.type === "boulder" ? "🪨" : "🧗"}</span>
                      <div>
                        <T size={12} weight="600" color={s.type === "boulder" ? C.accent : C.teal} style={{ textTransform: "uppercase" }}>{s.type === "boulder" ? "Boulder" : "Top Rope"}</T>
                        <T size={10} color={C.muted} mono style={{ display: "block" }}>{new Date(s.date).toLocaleDateString("en-CA", { month: "short", day: "numeric" })}</T>
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                      <T size={13} mono weight="600" color={C.text}>{s.totalSends} sends</T>
                      {s.hardest && <T size={12} mono weight="700" color={GRADE_COLORS[s.hardest] || C.accent} style={{ background: (GRADE_COLORS[s.hardest] || C.accent) + "15", padding: "2px 8px", borderRadius: 6 }}>{s.hardest}</T>}
                      <button onClick={async () => {
                        await saveClimbLog(climbLog.filter(x => x.id !== s.id));
                        showToast("Deleted", C.danger);
                      }} style={{ background: "none", border: "none", color: C.danger, cursor: "pointer", fontSize: 14, padding: "4px" }}>×</button>
                    </div>
                  </div>
                ))}
              </Card>
            )}
          </>
        )}

        {climbView === "workouts" && (
          <>
            {/* Bouldering workouts */}
            <div style={{ marginBottom: 16 }}>
              <T size={13} weight="800" color={C.accent} style={{ textTransform: "uppercase", letterSpacing: 2, display: "block", marginBottom: 10 }}>🪨 Bouldering</T>
              {CLIMB_WORKOUTS.boulder.map((w, i) => (
                <Card key={i}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                    <T size={14} weight="700" color={C.text}>{w.name}</T>
                    <T size={10} mono color={C.muted} style={{ flexShrink: 0 }}>{w.duration}</T>
                  </div>
                  <T size={12} color={C.light} style={{ display: "block", lineHeight: 1.6, marginBottom: 6 }}>{w.desc}</T>
                  <T size={10} color={C.accent} weight="600" style={{ textTransform: "uppercase", letterSpacing: 1 }}>{w.focus}</T>
                </Card>
              ))}
            </div>

            {/* Top Rope workouts */}
            <div style={{ marginBottom: 16 }}>
              <T size={13} weight="800" color={C.teal} style={{ textTransform: "uppercase", letterSpacing: 2, display: "block", marginBottom: 10 }}>🧗 Top Rope</T>
              {CLIMB_WORKOUTS.toprope.map((w, i) => (
                <Card key={i}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                    <T size={14} weight="700" color={C.text}>{w.name}</T>
                    <T size={10} mono color={C.muted} style={{ flexShrink: 0 }}>{w.duration}</T>
                  </div>
                  <T size={12} color={C.light} style={{ display: "block", lineHeight: 1.6, marginBottom: 6 }}>{w.desc}</T>
                  <T size={10} color={C.teal} weight="600" style={{ textTransform: "uppercase", letterSpacing: 1 }}>{w.focus}</T>
                </Card>
              ))}
            </div>

            {/* Fingerboard workouts */}
            <div style={{ marginBottom: 16 }}>
              <T size={13} weight="800" color={C.purple} style={{ textTransform: "uppercase", letterSpacing: 2, display: "block", marginBottom: 10 }}>🤏 Fingerboard — Metolius Sim 3D</T>
              {CLIMB_WORKOUTS.fingerboard.map((w, i) => (
                <Card key={i}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                    <T size={14} weight="700" color={C.text}>{w.name}</T>
                    <T size={10} mono color={C.muted} style={{ flexShrink: 0 }}>{w.duration}</T>
                  </div>
                  <T size={12} color={C.light} style={{ display: "block", lineHeight: 1.6, marginBottom: 6 }}>{w.desc}</T>
                  {w.board && <T size={10} color={C.muted} style={{ display: "block", marginBottom: 4, fontStyle: "italic" }}>{w.board}</T>}
                  <T size={10} color={C.purple} weight="600" style={{ textTransform: "uppercase", letterSpacing: 1 }}>{w.focus}</T>
                </Card>
              ))}
            </div>

            {/* Benchmarks */}
            <Card accent>
              <T size={11} color={C.accent} weight="600" style={{ letterSpacing: 2, textTransform: "uppercase", display: "block", marginBottom: 10 }}>Current Level & Benchmarks</T>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 16px" }}>
                {[
                  ["Boulder", "V3–V5"],
                  ["Top Rope", "5.10–5.11"],
                  ["Hangboard (20mm)", "BW × 5s"],
                  ["Target Hang", "BW+20% × 5s"],
                  ["Weighted Chin", "+65 lbs"],
                  ["Weighted Pull", "+55 lbs"],
                ].map(([k, v]) => (
                  <div key={k} style={{ display: "flex", justifyContent: "space-between" }}>
                    <T size={12} color={C.muted}>{k}</T>
                    <T size={12} color={C.accent} mono weight="600">{v}</T>
                  </div>
                ))}
              </div>
              <T size={10} color={C.muted} style={{ display: "block", marginTop: 10, lineHeight: 1.5 }}>
                To reach V6–V8: hang +20-30% BW on 20mm for 5s. Your pull strength (+65 chin) is already elite-tier — finger strength is the unlock.
              </T>
            </Card>
          </>
        )}
      </div>
    );
  };

  // BODY TAB
  // ─── VITALS TAB ──────────────────────────────────────────────────────────────
  const VitalsTab = () => {
    // Demo data — dates are relative to today so they always look current
    const demoDate = (daysAgo, h, m) => { const d = new Date(); d.setDate(d.getDate() - daysAgo); d.setHours(h, m, 0, 0); return d.toISOString(); };
    const DEMO = {
      heartRate: { resting: 52, min: 48, max: 172 },
      sleep: { duration: 7.4, quality: 82, deepSleep: 68, remSleep: 94 },
      dailyStats: { steps: 9842, calories: 2680, restingHR: 52, activeMinutes: 74, stressLevel: 28 },
      hrv: { lastNight: 62, weeklyAvg: 58, status: "BALANCED" },
      activities: [
        { id: 1, name: "Easy Run", type: "running", date: demoDate(0, 7, 30), duration: 2460, distance: 6200, avgHR: 142, maxHR: 158, avgPace: 397, calories: 520, avgRunningCadence: 172, elevationGain: 34, trainingEffect: 2.3, anaerobicTE: 0.4 },
        { id: 2, name: "Strength Training", type: "strength_training", date: demoDate(1, 17, 0), duration: 3600, distance: 0, avgHR: 128, maxHR: 165, calories: 380, trainingEffect: 3.1, anaerobicTE: 2.1 },
        { id: 3, name: "Zone 2 Run", type: "running", date: demoDate(2, 6, 45), duration: 3300, distance: 8100, avgHR: 148, maxHR: 162, avgPace: 407, calories: 640, avgRunningCadence: 170, elevationGain: 52, trainingEffect: 2.8, anaerobicTE: 0.2 },
        { id: 4, name: "Indoor Cycling", type: "indoor_cycling", date: demoDate(3, 12, 0), duration: 2700, distance: 18000, avgHR: 138, maxHR: 155, calories: 420, trainingEffect: 2.5, anaerobicTE: 0.8 },
        { id: 5, name: "Long Run", type: "running", date: demoDate(4, 7, 0), duration: 5400, distance: 14200, avgHR: 146, maxHR: 168, avgPace: 380, calories: 1100, avgRunningCadence: 174, elevationGain: 87, trainingEffect: 3.8, anaerobicTE: 0.6 },
      ],
      syncedAt: new Date().toISOString(),
    };
    const isLive = garminStatus === "ok" && garminData;
    const g = isLive ? garminData : DEMO;
    const hr = g.heartRate || {};
    const sleep = g.sleep || {};
    const daily = g.dailyStats || {};
    const hrv = g.hrv || {};
    const acts = (g.activities || []).slice(0, 20);
    const syncTime = g.syncedAt ? new Date(g.syncedAt).toLocaleTimeString("en-CA", { hour: "2-digit", minute: "2-digit" }) : null;

    // Body metrics
    const sortedBody = [...bodyMetrics].sort((a, b) => new Date(a.date) - new Date(b.date));
    const lastBody = sortedBody[sortedBody.length - 1];
    const leanMass = lastBody?.weight && lastBody?.bodyFat ? +(lastBody.weight * (1 - lastBody.bodyFat / 100)).toFixed(1) : 153;
    const bw = lastBody?.weight || PROFILE.weight;
    const bf = lastBody?.bodyFat || 13.2;

    // HRV trend
    const hrvTrend = hrvLog.length > 1 ? hrvLog.slice(-14).map((h, i) => ({ i, v: h.value })) :
      [48, 55, 52, 60, 58, 63, 56, 61, 59, 64, 58, 62, 60, 65].map((v, i) => ({ i, v }));

    // Readiness score
    const rhr = hr.resting || 52;
    const hrvVal = hrv.lastNight || lastHrv || 62;
    const sleepQ = sleep.quality || 82;
    const stressVal = daily.stressLevel || 28;
    const rFactors = [
      Math.min(100, Math.round((hrvVal / 80) * 100)),
      sleepQ,
      Math.max(0, 100 - stressVal),
      Math.min(100, Math.round(((80 - rhr) / 30) * 100)),
    ];
    const readiness = Math.round(rFactors.reduce((a, b) => a + b, 0) / rFactors.length);
    const rC = readiness >= 75 ? C.teal : readiness >= 50 ? C.accent : C.danger;

    // Activity helpers
    const actIcon = (type) => ({ running: "🏃", cycling: "🚴", swimming: "🏊", strength_training: "🏋", walking: "🚶", hiking: "⛰", indoor_cycling: "🚴", treadmill_running: "🏃" }[type] || "🏟");
    const fmtDur = (s) => { const m = Math.floor(s / 60); const h = Math.floor(m / 60); return h > 0 ? `${h}h ${m % 60}m` : `${m}m`; };
    const fmtPace = (s) => s ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}` : null;

    // Animated pulse phase for body map (using CSS animations via inline keyframes)
    const glowKeyframes = `@keyframes vitalPulse { 0%,100% { opacity: 0.3; } 50% { opacity: 0.8; } }
      @keyframes heartBeat { 0%,100% { r: 5; } 25% { r: 8; } 50% { r: 5; } 75% { r: 7; } }
      @keyframes scanLine { 0% { transform: translateY(-180px); } 100% { transform: translateY(180px); } }
      @keyframes dataFlow { 0% { stroke-dashoffset: 20; } 100% { stroke-dashoffset: 0; } }
      @keyframes ringPulse { 0%,100% { opacity: 0.15; transform: scale(1); } 50% { opacity: 0.35; transform: scale(1.08); } }`;

    // ─── SUB-VIEW: BODY MAP (high-tech) ───────────────────────────────────────
    const BodyMapView = () => (
      <div style={{ position: "relative" }}>
        <style>{glowKeyframes}</style>

        {/* Readiness Arc — larger, more detailed */}
        <div style={{ textAlign: "center", marginBottom: 4 }}>
          <svg width="200" height="110" viewBox="0 0 200 110" style={{ display: "block", margin: "0 auto" }}>
            {/* Background ring segments */}
            <path d="M 20 95 A 80 80 0 0 1 180 95" fill="none" stroke={C.border} strokeWidth="4" strokeLinecap="round" opacity="0.3" />
            <path d="M 20 95 A 80 80 0 0 1 180 95" fill="none" stroke={C.border} strokeWidth="10" strokeLinecap="round" opacity="0.08" />
            {/* Active arc */}
            <path d="M 20 95 A 80 80 0 0 1 180 95" fill="none" stroke={rC} strokeWidth="5" strokeLinecap="round"
              strokeDasharray={`${(readiness / 100) * 251} 251`} style={{ transition: "stroke-dasharray 1s ease", filter: `drop-shadow(0 0 6px ${rC})` }} />
            {/* Tick marks */}
            {[0, 25, 50, 75, 100].map(p => {
              const a = Math.PI - (p / 100) * Math.PI;
              const x1 = 100 + 85 * Math.cos(a), y1 = 95 - 85 * Math.sin(a);
              const x2 = 100 + 78 * Math.cos(a), y2 = 95 - 78 * Math.sin(a);
              return <line key={p} x1={x1} y1={y1} x2={x2} y2={y2} stroke={C.muted} strokeWidth="1" opacity="0.5" />;
            })}
            <text x="100" y="72" textAnchor="middle" style={{ fontFamily: "'JetBrains Mono'", fontSize: 36, fontWeight: 800, fill: rC, filter: `drop-shadow(0 0 8px ${rC}60)` }}>{readiness}</text>
            <text x="100" y="92" textAnchor="middle" style={{ fontFamily: "'Syne'", fontSize: 10, fontWeight: 700, fill: C.muted, letterSpacing: 3 }}>READINESS</text>
            <text x="100" y="106" textAnchor="middle" style={{ fontFamily: "'JetBrains Mono'", fontSize: 8, fontWeight: 600, fill: rC, letterSpacing: 1 }}>
              {readiness >= 75 ? "▲ OPTIMAL" : readiness >= 50 ? "● MODERATE" : "▼ RECOVER"}
            </text>
          </svg>
        </div>

        {/* Body diagram with stats — 3 column layout */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 160px 1fr", gap: 0, alignItems: "start", minHeight: 400 }}>
          {/* LEFT STATS */}
          <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-end", paddingRight: 4, paddingTop: 20 }}>
            {/* Heart Rate */}
            <div style={{ background: C.danger + "08", border: `1px solid ${C.danger}20`, borderRadius: 10, padding: "8px 10px", textAlign: "right", width: "100%" }}>
              <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 4, marginBottom: 2 }}>
                <T size={8} color={C.danger} weight="700" style={{ letterSpacing: 1.5, textTransform: "uppercase" }}>HEART</T>
                <div style={{ width: 6, height: 6, borderRadius: 3, background: C.danger, animation: "vitalPulse 1.2s ease-in-out infinite" }} />
              </div>
              <T size={26} mono weight="800" color={C.danger} style={{ display: "block", lineHeight: 1, filter: `drop-shadow(0 0 4px ${C.danger}40)` }}>{rhr}</T>
              <T size={8} color={C.muted} mono>bpm resting</T>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 6, marginTop: 3 }}>
                <T size={8} color={C.muted} mono>min {hr.min || 48}</T>
                <T size={8} color={C.danger} mono>max {hr.max || 172}</T>
              </div>
            </div>
            {/* HRV */}
            <div style={{ background: C.teal + "08", border: `1px solid ${C.teal}20`, borderRadius: 10, padding: "8px 10px", textAlign: "right", width: "100%" }}>
              <T size={8} color={C.teal} weight="700" style={{ letterSpacing: 1.5, textTransform: "uppercase", display: "block", marginBottom: 2 }}>HRV</T>
              <T size={26} mono weight="800" color={C.teal} style={{ display: "block", lineHeight: 1, filter: `drop-shadow(0 0 4px ${C.teal}40)` }}>{hrvVal}</T>
              <T size={8} color={C.muted} mono>ms last night</T>
              <T size={8} color={C.teal} mono style={{ display: "block" }}>{hrv.status || "BALANCED"}</T>
            </div>
            {/* Sleep */}
            <div style={{ background: C.purple + "08", border: `1px solid ${C.purple}20`, borderRadius: 10, padding: "8px 10px", textAlign: "right", width: "100%" }}>
              <T size={8} color={C.purple} weight="700" style={{ letterSpacing: 1.5, textTransform: "uppercase", display: "block", marginBottom: 2 }}>SLEEP</T>
              <T size={26} mono weight="800" color={C.purple} style={{ display: "block", lineHeight: 1, filter: `drop-shadow(0 0 4px ${C.purple}40)` }}>{sleepQ}</T>
              <T size={8} color={C.muted} mono>score · {sleep.duration || 7.4}h</T>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 6, marginTop: 2 }}>
                <T size={7} color={C.muted} mono>deep {sleep.deepSleep || 68}m</T>
                <T size={7} color={C.muted} mono>rem {sleep.remSleep || 94}m</T>
              </div>
            </div>
            {/* Stress */}
            <div style={{ background: (stressVal > 50 ? C.warn : C.teal) + "08", border: `1px solid ${(stressVal > 50 ? C.warn : C.teal)}20`, borderRadius: 10, padding: "8px 10px", textAlign: "right", width: "100%" }}>
              <T size={8} color={stressVal > 50 ? C.warn : C.teal} weight="700" style={{ letterSpacing: 1.5, textTransform: "uppercase", display: "block", marginBottom: 2 }}>STRESS</T>
              <T size={26} mono weight="800" color={stressVal > 50 ? C.warn : C.teal} style={{ display: "block", lineHeight: 1 }}>{stressVal}</T>
              <T size={8} color={C.muted} mono>{stressVal <= 25 ? "very low" : stressVal <= 50 ? "low" : stressVal <= 75 ? "medium" : "high"}</T>
            </div>
          </div>

          {/* CENTER — Wireframe Body Diagram */}
          <div style={{ display: "flex", justifyContent: "center", position: "relative" }}>
            <svg width="160" height="400" viewBox="0 0 160 400" style={{ filter: `drop-shadow(0 0 15px ${rC}12)` }}>
              <defs>
                <linearGradient id="scanGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={rC} stopOpacity="0" />
                  <stop offset="50%" stopColor={rC} stopOpacity="0.2" />
                  <stop offset="100%" stopColor={rC} stopOpacity="0" />
                </linearGradient>
              </defs>

              {/* Scan line */}
              <rect x="20" y="190" width="120" height="10" fill="url(#scanGrad)" opacity="0.4" rx="2">
                <animateTransform attributeName="transform" type="translate" values="0 -200; 0 200" dur="4s" repeatCount="indefinite" />
              </rect>

              {/* ═══ WIREFRAME BODY ═══ */}
              {/* Head — circle */}
              <circle cx="80" cy="28" r="18" fill="none" stroke={C.accent} strokeWidth="1.2" opacity="0.6" />
              {/* Cross-hairs on head */}
              <line x1="80" y1="12" x2="80" y2="44" stroke={C.accent} strokeWidth="0.3" opacity="0.15" />
              <line x1="64" y1="28" x2="96" y2="28" stroke={C.accent} strokeWidth="0.3" opacity="0.15" />

              {/* Neck */}
              <line x1="74" y1="46" x2="74" y2="62" stroke={C.accent} strokeWidth="1" opacity="0.5" />
              <line x1="86" y1="46" x2="86" y2="62" stroke={C.accent} strokeWidth="1" opacity="0.5" />

              {/* Shoulders — horizontal bar */}
              <line x1="32" y1="68" x2="128" y2="68" stroke={C.accent} strokeWidth="1.2" opacity="0.55" />
              {/* Shoulder joints */}
              <circle cx="32" cy="68" r="4" fill="none" stroke={C.accent} strokeWidth="1" opacity="0.5" />
              <circle cx="128" cy="68" r="4" fill="none" stroke={C.accent} strokeWidth="1" opacity="0.5" />

              {/* Torso — wireframe trapezoid */}
              <line x1="48" y1="68" x2="42" y2="200" stroke={C.accent} strokeWidth="1" opacity="0.5" />
              <line x1="112" y1="68" x2="118" y2="200" stroke={C.accent} strokeWidth="1" opacity="0.5" />
              {/* Waist line */}
              <line x1="50" y1="155" x2="110" y2="155" stroke={C.accent} strokeWidth="0.6" opacity="0.25" />
              {/* Hip line */}
              <line x1="42" y1="200" x2="118" y2="200" stroke={C.accent} strokeWidth="1" opacity="0.5" />

              {/* Torso cross-sections (wireframe rings) */}
              {[82, 100, 118, 136, 155, 175, 192].map((y, i) => {
                const t = (y - 68) / (200 - 68);
                const wL = 48 + (42 - 48) * t;
                const wR = 112 + (118 - 112) * t;
                return <line key={`cs${i}`} x1={wL} y1={y} x2={wR} y2={y} stroke={C.accent} strokeWidth="0.3" opacity="0.12" />;
              })}
              {/* Center line (spine) */}
              <line x1="80" y1="62" x2="80" y2="200" stroke={C.accent} strokeWidth="0.5" opacity="0.2" strokeDasharray="3 4" />

              {/* Upper arms */}
              <line x1="32" y1="68" x2="16" y2="148" stroke={C.accent} strokeWidth="1" opacity="0.45" />
              <line x1="128" y1="68" x2="144" y2="148" stroke={C.accent} strokeWidth="1" opacity="0.45" />
              {/* Elbow joints */}
              <circle cx="16" cy="148" r="3" fill="none" stroke={C.accent} strokeWidth="0.8" opacity="0.4" />
              <circle cx="144" cy="148" r="3" fill="none" stroke={C.accent} strokeWidth="0.8" opacity="0.4" />
              {/* Forearms */}
              <line x1="16" y1="148" x2="10" y2="210" stroke={C.accent} strokeWidth="0.8" opacity="0.35" />
              <line x1="144" y1="148" x2="150" y2="210" stroke={C.accent} strokeWidth="0.8" opacity="0.35" />
              {/* Hands (small circles) */}
              <circle cx="10" cy="212" r="4" fill="none" stroke={C.accent} strokeWidth="0.6" opacity="0.25" />
              <circle cx="150" cy="212" r="4" fill="none" stroke={C.accent} strokeWidth="0.6" opacity="0.25" />

              {/* Hip joints */}
              <circle cx="60" cy="200" r="5" fill="none" stroke={C.accent} strokeWidth="0.8" opacity="0.4" />
              <circle cx="100" cy="200" r="5" fill="none" stroke={C.accent} strokeWidth="0.8" opacity="0.4" />

              {/* Upper legs (femurs) */}
              <line x1="60" y1="205" x2="52" y2="300" stroke={C.accent} strokeWidth="1" opacity="0.45" />
              <line x1="100" y1="205" x2="108" y2="300" stroke={C.accent} strokeWidth="1" opacity="0.45" />
              {/* Knee joints */}
              <circle cx="52" cy="300" r="4" fill="none" stroke={C.accent} strokeWidth="0.8" opacity="0.4" />
              <circle cx="108" cy="300" r="4" fill="none" stroke={C.accent} strokeWidth="0.8" opacity="0.4" />
              {/* Lower legs */}
              <line x1="52" y1="304" x2="46" y2="375" stroke={C.accent} strokeWidth="0.8" opacity="0.35" />
              <line x1="108" y1="304" x2="114" y2="375" stroke={C.accent} strokeWidth="0.8" opacity="0.35" />
              {/* Ankle joints */}
              <circle cx="46" cy="375" r="3" fill="none" stroke={C.accent} strokeWidth="0.6" opacity="0.3" />
              <circle cx="114" cy="375" r="3" fill="none" stroke={C.accent} strokeWidth="0.6" opacity="0.3" />
              {/* Feet */}
              <line x1="46" y1="378" x2="36" y2="388" stroke={C.accent} strokeWidth="0.6" opacity="0.25" />
              <line x1="36" y1="388" x2="52" y2="390" stroke={C.accent} strokeWidth="0.6" opacity="0.25" />
              <line x1="114" y1="378" x2="124" y2="388" stroke={C.accent} strokeWidth="0.6" opacity="0.25" />
              <line x1="124" y1="388" x2="108" y2="390" stroke={C.accent} strokeWidth="0.6" opacity="0.25" />

              {/* ═══ ORGAN INDICATORS (minimal) ═══ */}
              {/* Heart — pulsing dot */}
              <circle cx="72" cy="95" r="4" fill={C.danger + "30"} stroke={C.danger} strokeWidth="0.8" opacity="0.8">
                <animate attributeName="r" values="3.5;5.5;3.5" dur="1s" repeatCount="indefinite" />
              </circle>
              <circle cx="72" cy="95" r="8" fill="none" stroke={C.danger} strokeWidth="0.3" opacity="0.15">
                <animate attributeName="r" values="8;14;8" dur="1s" repeatCount="indefinite" />
                <animate attributeName="opacity" values="0.2;0;0.2" dur="1s" repeatCount="indefinite" />
              </circle>

              {/* Lungs — breathing wireframe */}
              <ellipse cx="64" cy="110" rx="10" ry="16" fill="none" stroke={C.teal} strokeWidth="0.6" opacity="0.35">
                <animate attributeName="rx" values="9;11;9" dur="3.5s" repeatCount="indefinite" />
              </ellipse>
              <ellipse cx="96" cy="110" rx="10" ry="16" fill="none" stroke={C.teal} strokeWidth="0.6" opacity="0.35">
                <animate attributeName="rx" values="9;11;9" dur="3.5s" repeatCount="indefinite" />
              </ellipse>

              {/* Core region */}
              <rect x="58" y="155" width="44" height="40" rx="6" fill="none" stroke={C.purple} strokeWidth="0.5" opacity="0.2" />

              {/* Brain indicator */}
              <circle cx="80" cy="24" r="8" fill="none" stroke={C.purple} strokeWidth="0.5" opacity="0.3" />

              {/* ═══ DATA CALLOUT LINES ═══ */}
              {/* Heart → left */}
              <line x1="68" y1="95" x2="0" y2="95" stroke={C.danger} strokeWidth="0.4" opacity="0.2" strokeDasharray="3 3">
                <animate attributeName="stroke-dashoffset" values="12;0" dur="1.5s" repeatCount="indefinite" />
              </line>
              {/* Lung → left */}
              <line x1="54" y1="110" x2="0" y2="130" stroke={C.teal} strokeWidth="0.4" opacity="0.2" strokeDasharray="3 3">
                <animate attributeName="stroke-dashoffset" values="12;0" dur="1.5s" repeatCount="indefinite" />
              </line>
              {/* Brain → left */}
              <line x1="72" y1="24" x2="0" y2="55" stroke={C.purple} strokeWidth="0.4" opacity="0.2" strokeDasharray="3 3">
                <animate attributeName="stroke-dashoffset" values="12;0" dur="1.5s" repeatCount="indefinite" />
              </line>
              {/* Weight → right */}
              <line x1="118" y1="120" x2="160" y2="95" stroke={C.accent} strokeWidth="0.4" opacity="0.2" strokeDasharray="3 3">
                <animate attributeName="stroke-dashoffset" values="12;0" dur="2s" repeatCount="indefinite" />
              </line>
              {/* Core → right */}
              <line x1="102" y1="175" x2="160" y2="175" stroke={C.purple} strokeWidth="0.4" opacity="0.15" strokeDasharray="3 3">
                <animate attributeName="stroke-dashoffset" values="12;0" dur="2s" repeatCount="indefinite" />
              </line>

              {/* ═══ MEASUREMENT ANNOTATIONS ═══ */}
              {/* Height dimension line */}
              <line x1="155" y1="10" x2="155" y2="390" stroke={C.muted} strokeWidth="0.3" opacity="0.15" />
              <line x1="152" y1="10" x2="158" y2="10" stroke={C.muted} strokeWidth="0.3" opacity="0.15" />
              <line x1="152" y1="390" x2="158" y2="390" stroke={C.muted} strokeWidth="0.3" opacity="0.15" />
              <text x="155" y="200" textAnchor="middle" transform="rotate(-90, 155, 200)" style={{ fontFamily: "'JetBrains Mono'", fontSize: 5, fill: C.muted, opacity: 0.3, letterSpacing: 1 }}>176 LBS · 5'10"</text>

              {/* Horizontal reference lines */}
              <line x1="4" y1="68" x2="156" y2="68" stroke={C.muted} strokeWidth="0.2" opacity="0.08" strokeDasharray="2 6" />
              <line x1="4" y1="200" x2="156" y2="200" stroke={C.muted} strokeWidth="0.2" opacity="0.08" strokeDasharray="2 6" />
              <line x1="4" y1="300" x2="156" y2="300" stroke={C.muted} strokeWidth="0.2" opacity="0.08" strokeDasharray="2 6" />

              {/* Section labels */}
              <text x="3" y="66" style={{ fontFamily: "'JetBrains Mono'", fontSize: 4.5, fill: C.muted, opacity: 0.25 }}>SHOULDER</text>
              <text x="3" y="198" style={{ fontFamily: "'JetBrains Mono'", fontSize: 4.5, fill: C.muted, opacity: 0.25 }}>HIP</text>
              <text x="3" y="298" style={{ fontFamily: "'JetBrains Mono'", fontSize: 4.5, fill: C.muted, opacity: 0.25 }}>KNEE</text>
            </svg>
          </div>

          {/* RIGHT STATS */}
          <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-start", paddingLeft: 4, paddingTop: 20 }}>
            {/* Weight / Body Comp */}
            <div style={{ background: C.accent + "08", border: `1px solid ${C.accent}20`, borderRadius: 10, padding: "8px 10px", width: "100%" }}>
              <T size={8} color={C.accent} weight="700" style={{ letterSpacing: 1.5, textTransform: "uppercase", display: "block", marginBottom: 2 }}>WEIGHT</T>
              <T size={26} mono weight="800" color={C.accent} style={{ display: "block", lineHeight: 1, filter: `drop-shadow(0 0 4px ${C.accent}40)` }}>{bw}</T>
              <T size={8} color={C.muted} mono>lbs</T>
              <div style={{ display: "flex", gap: 6, marginTop: 3 }}>
                <T size={8} color={C.purple} mono>{bf}% bf</T>
                <T size={8} color={C.teal} mono>{leanMass} lean</T>
              </div>
            </div>
            {/* Steps */}
            <div style={{ background: C.accent + "08", border: `1px solid ${C.accent}20`, borderRadius: 10, padding: "8px 10px", width: "100%" }}>
              <T size={8} color={C.accent} weight="700" style={{ letterSpacing: 1.5, textTransform: "uppercase", display: "block", marginBottom: 2 }}>STEPS</T>
              <T size={26} mono weight="800" color={C.accent} style={{ display: "block", lineHeight: 1 }}>{((daily.steps || 9842) / 1000).toFixed(1)}k</T>
              <T size={8} color={C.muted} mono>today</T>
            </div>
            {/* Calories */}
            <div style={{ background: C.accent + "08", border: `1px solid ${C.accent}20`, borderRadius: 10, padding: "8px 10px", width: "100%" }}>
              <T size={8} color={C.accent} weight="700" style={{ letterSpacing: 1.5, textTransform: "uppercase", display: "block", marginBottom: 2 }}>ENERGY</T>
              <T size={26} mono weight="800" color={C.accent} style={{ display: "block", lineHeight: 1 }}>{((daily.calories || 2680) / 1000).toFixed(1)}k</T>
              <T size={8} color={C.muted} mono>kcal burned</T>
            </div>
            {/* Active Minutes */}
            <div style={{ background: C.teal + "08", border: `1px solid ${C.teal}20`, borderRadius: 10, padding: "8px 10px", width: "100%" }}>
              <T size={8} color={C.teal} weight="700" style={{ letterSpacing: 1.5, textTransform: "uppercase", display: "block", marginBottom: 2 }}>ACTIVE</T>
              <T size={26} mono weight="800" color={C.teal} style={{ display: "block", lineHeight: 1 }}>{daily.activeMinutes || 74}</T>
              <T size={8} color={C.muted} mono>minutes</T>
            </div>
          </div>
        </div>

        {/* HRV sparkline below body */}
        <Card style={{ marginTop: 8 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
            <T size={9} color={C.teal} weight="700" style={{ letterSpacing: 1.5, textTransform: "uppercase" }}>HRV — 14 Day Trend</T>
            <T size={9} color={C.muted} mono>avg {hrv.weeklyAvg || 58}ms</T>
          </div>
          <ResponsiveContainer width="100%" height={50}>
            <LineChart data={hrvTrend} margin={{ top: 2, right: 2, left: 2, bottom: 0 }}>
              <Line type="monotone" dataKey="v" stroke={C.teal} strokeWidth={1.5} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </Card>

        {/* Sync status */}
        <div style={{ textAlign: "center", marginTop: 6, paddingBottom: 8 }}>
          {isLive ? (
            <T size={9} color={C.teal} mono>● LIVE — Garmin synced {syncTime}</T>
          ) : (
            <T size={9} color={C.muted} mono>◌ DEMO DATA — deploy to Vercel for live sync</T>
          )}
        </div>
      </div>
    );

    // ─── SUB-VIEW: DASHBOARD (simple high-tech) ──────────────────────────────
    const DashboardView = () => (
      <div>
        {/* Top stat row */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, marginBottom: 8 }}>
          {[
            { v: rhr, u: "bpm", l: "Resting HR", c: C.danger },
            { v: hrvVal, u: "ms", l: "HRV", c: C.teal },
            { v: sleepQ, u: "pts", l: "Sleep Score", c: C.purple },
          ].map(s => (
            <div key={s.l} style={{ textAlign: "center", background: s.c + "08", border: `1px solid ${s.c}20`, borderRadius: 10, padding: "14px 6px" }}>
              <T size={30} mono weight="800" color={s.c} style={{ display: "block", lineHeight: 1, filter: `drop-shadow(0 0 4px ${s.c}40)` }}>{s.v}</T>
              <T size={8} color={C.muted} mono style={{ display: "block", marginTop: 2 }}>{s.u}</T>
              <T size={8} color={s.c} weight="700" style={{ textTransform: "uppercase", letterSpacing: 1, display: "block", marginTop: 4 }}>{s.l}</T>
            </div>
          ))}
        </div>

        {/* Readiness */}
        <Card>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <div>
              <T size={11} color={C.muted} weight="600" style={{ letterSpacing: 2, textTransform: "uppercase" }}>Readiness</T>
              <T size={9} color={C.muted} mono style={{ display: "block" }}>HRV · Sleep · Stress · RHR</T>
            </div>
            <div style={{ textAlign: "right" }}>
              <T size={24} mono weight="800" color={rC} style={{ filter: `drop-shadow(0 0 4px ${rC}40)` }}>{readiness}%</T>
              <T size={9} color={rC} weight="600" style={{ display: "block" }}>{readiness >= 75 ? "OPTIMAL" : readiness >= 50 ? "MODERATE" : "RECOVER"}</T>
            </div>
          </div>
          <div style={{ background: C.border, borderRadius: 4, height: 6, overflow: "hidden" }}>
            <div style={{ background: `linear-gradient(90deg, ${rC}80, ${rC})`, height: "100%", width: `${readiness}%`, borderRadius: 4, transition: "width 0.6s ease", boxShadow: `0 0 8px ${rC}60` }} />
          </div>
        </Card>

        {/* 2x2 daily stats */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 6 }}>
          {[
            { v: (daily.steps || 9842).toLocaleString(), l: "Steps", c: C.accent },
            { v: (daily.calories || 2680).toLocaleString(), l: "Calories", c: C.accent },
            { v: stressVal, l: "Stress", c: stressVal > 50 ? C.warn : C.teal },
            { v: daily.activeMinutes || 74, l: "Active Min", c: C.teal },
          ].map(s => (
            <div key={s.l} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: "12px" }}>
              <T size={8} color={s.c} weight="700" style={{ letterSpacing: 1.5, textTransform: "uppercase", display: "block", marginBottom: 4 }}>{s.l}</T>
              <T size={22} mono weight="700" color={s.c} style={{ display: "block" }}>{s.v}</T>
            </div>
          ))}
        </div>

        {/* Sleep */}
        <Card>
          <T size={9} color={C.purple} weight="700" style={{ letterSpacing: 2, textTransform: "uppercase", display: "block", marginBottom: 8 }}>Sleep Breakdown</T>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
            {[
              { v: `${sleep.duration || 7.4}h`, l: "Total" },
              { v: `${sleep.deepSleep || 68}m`, l: "Deep" },
              { v: `${sleep.remSleep || 94}m`, l: "REM" },
            ].map(s => (
              <div key={s.l} style={{ textAlign: "center" }}>
                <T size={20} mono weight="700" color={C.purple} style={{ display: "block" }}>{s.v}</T>
                <T size={8} color={C.muted}>{s.l}</T>
              </div>
            ))}
          </div>
        </Card>

        {/* HRV Trend */}
        <Card>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <T size={9} color={C.teal} weight="700" style={{ letterSpacing: 2, textTransform: "uppercase" }}>HRV Trend</T>
            <T size={9} color={C.muted} mono>14d avg {hrv.weeklyAvg || 58}ms</T>
          </div>
          <ResponsiveContainer width="100%" height={70}>
            <LineChart data={hrvTrend} margin={{ top: 4, right: 4, left: -30, bottom: 0 }}>
              <XAxis dataKey="i" tick={false} axisLine={false} />
              <YAxis tick={{ fontSize: 9, fill: C.muted }} axisLine={false} tickLine={false} />
              <Line type="monotone" dataKey="v" stroke={C.teal} strokeWidth={2} dot={false} />
              <Tooltip contentStyle={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 12, color: C.text }} formatter={(v) => [`${v}ms`, "HRV"]} />
            </LineChart>
          </ResponsiveContainer>
        </Card>

        {/* Body comp row */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
          {[
            { v: bw, u: "lbs", l: "Weight", c: C.accent },
            { v: `${bf}%`, u: "", l: "Body Fat", c: C.purple },
            { v: leanMass, u: "lbs", l: "Lean Mass", c: C.teal },
          ].map(s => (
            <div key={s.l} style={{ background: s.c + "08", border: `1px solid ${s.c}20`, borderRadius: 10, padding: "10px", textAlign: "center" }}>
              <T size={20} mono weight="700" color={s.c} style={{ display: "block" }}>{s.v}</T>
              <T size={8} color={C.muted}>{s.l}</T>
            </div>
          ))}
        </div>

        <div style={{ textAlign: "center", marginTop: 8, paddingBottom: 4 }}>
          {isLive ? <T size={9} color={C.teal} mono>● LIVE — synced {syncTime}</T> : <T size={9} color={C.muted} mono>◌ DEMO DATA</T>}
        </div>
      </div>
    );

    // ─── SUB-VIEW: ACTIVITY FEED ──────────────────────────────────────────────
    const ActivityView = () => (
      <div>
        {acts.length === 0 && (
          <Card style={{ textAlign: "center", padding: 32 }}>
            <T size={32} style={{ display: "block", marginBottom: 8 }}>🏟</T>
            <T size={14} color={C.muted}>No activities synced yet</T>
          </Card>
        )}
        {acts.map(a => (
          <div key={a.id} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: "14px 16px", marginBottom: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <span style={{ fontSize: 22 }}>{actIcon(a.type)}</span>
                <div>
                  <T size={13} weight="700" color={C.text} style={{ display: "block" }}>{a.name || a.type?.replace(/_/g, " ")}</T>
                  <T size={10} color={C.muted} mono>{new Date(a.date).toLocaleDateString("en-CA", { weekday: "short", month: "short", day: "numeric" })}</T>
                </div>
              </div>
              <T size={12} mono weight="600" color={C.light}>{fmtDur(a.duration)}</T>
            </div>
            <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
              {a.distance > 0 && <div style={{ background: C.accent + "12", borderRadius: 6, padding: "3px 8px" }}><T size={11} mono weight="700" color={C.accent}>{(a.distance / 1000).toFixed(2)} km</T></div>}
              {a.avgPace && <div style={{ background: C.teal + "12", borderRadius: 6, padding: "3px 8px" }}><T size={11} mono weight="700" color={C.teal}>{fmtPace(a.avgPace)} /km</T></div>}
              {a.avgHR && <div style={{ background: C.danger + "12", borderRadius: 6, padding: "3px 8px" }}><T size={11} mono weight="600" color={C.danger}>{a.avgHR}{a.maxHR ? `/${a.maxHR}` : ""} bpm</T></div>}
              {a.trainingEffect && <div style={{ background: C.purple + "12", borderRadius: 6, padding: "3px 8px" }}><T size={11} mono weight="600" color={C.purple}>TE {a.trainingEffect}</T></div>}
              {a.anaerobicTE && <div style={{ background: C.warn + "12", borderRadius: 6, padding: "3px 8px" }}><T size={11} mono weight="600" color={C.warn}>AnTE {a.anaerobicTE}</T></div>}
              {a.calories && <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 6, padding: "3px 8px" }}><T size={10} mono color={C.light}>{a.calories} cal</T></div>}
              {a.elevationGain > 0 && <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 6, padding: "3px 8px" }}><T size={10} mono color={C.light}>↑{a.elevationGain}m</T></div>}
              {a.avgRunningCadence && <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 6, padding: "3px 8px" }}><T size={10} mono color={C.light}>{a.avgRunningCadence} spm</T></div>}
            </div>
          </div>
        ))}
      </div>
    );

    // ─── MAIN RENDER ──────────────────────────────────────────────────────────
    return (
      <div className="fade-in" style={{ padding: "16px 16px 0" }}>
        <div style={{ marginBottom: 14 }}>
          <T size={11} color={C.muted} weight="600" style={{ letterSpacing: 2, textTransform: "uppercase", display: "block" }}>Garmin · Renpho · Performance</T>
          <T size={26} weight="800" color={C.accent} style={{ display: "block", fontFamily: "'Syne'" }}>VITALS</T>
        </div>

        {/* View toggle */}
        <div style={{ display: "flex", gap: 0, background: C.surface, borderRadius: 10, overflow: "hidden", marginBottom: 14, border: `1px solid ${C.border}` }}>
          {[["body", "BODY MAP"], ["dashboard", "DASHBOARD"], ["activity", "ACTIVITY"]].map(([id, label]) => (
            <button key={id} onClick={() => setVitalsView(id)} style={{
              flex: 1, padding: "10px 0", background: vitalsView === id ? C.accent + "15" : "transparent",
              border: "none", borderBottom: vitalsView === id ? `2px solid ${C.accent}` : "2px solid transparent",
              color: vitalsView === id ? C.accent : C.muted, cursor: "pointer",
              fontFamily: "'Syne'", fontSize: 10, fontWeight: 700, letterSpacing: 1,
            }}>{label}</button>
          ))}
        </div>

        {vitalsView === "body" && <BodyMapView />}
        {vitalsView === "dashboard" && <DashboardView />}
        {vitalsView === "activity" && <ActivityView />}
      </div>
    );
  };

  const BodyTab = () => {
    const sorted = [...bodyMetrics].sort((a, b) => new Date(a.date) - new Date(b.date));
    const last = sorted[sorted.length - 1];
    const last7 = sorted.slice(-7);
    const last30 = sorted.slice(-30);
    const avgWeight7 = last7.filter(m => m.weight).length ? (last7.filter(m => m.weight).reduce((s, m) => s + m.weight, 0) / last7.filter(m => m.weight).length).toFixed(1) : null;
    const avgBf7 = last7.filter(m => m.bodyFat).length ? (last7.filter(m => m.bodyFat).reduce((s, m) => s + m.bodyFat, 0) / last7.filter(m => m.bodyFat).length).toFixed(1) : null;

    const chartData = sorted.slice(-30).map(m => ({
      date: new Date(m.date).toLocaleDateString("en-CA", { month: "short", day: "numeric" }),
      weight: m.weight || null,
      bodyFat: m.bodyFat || null,
      muscleMass: m.muscleMass || null,
      leanMass: m.weight && m.bodyFat ? +(m.weight * (1 - m.bodyFat / 100)).toFixed(1) : null,
    }));

    const weightProgress = last?.weight ? Math.min(100, Math.max(0, Math.round(((BODY_GOALS.weight.current - last.weight) / (BODY_GOALS.weight.current - BODY_GOALS.weight.target)) * 100))) : 0;
    const bfProgress = last?.bodyFat ? Math.min(100, Math.max(0, Math.round(((BODY_GOALS.bodyFat.current - last.bodyFat) / (BODY_GOALS.bodyFat.current - BODY_GOALS.bodyFat.target)) * 100))) : 0;

    async function submitBody() {
      const entry = {
        id: Date.now(),
        date: new Date().toISOString(),
        weight: bodyForm.weight ? Number(bodyForm.weight) : null,
        bodyFat: bodyForm.bodyFat ? Number(bodyForm.bodyFat) : null,
        muscleMass: bodyForm.muscleMass ? Number(bodyForm.muscleMass) : null,
        bmi: bodyForm.bmi ? Number(bodyForm.bmi) : null,
        water: bodyForm.water ? Number(bodyForm.water) : null,
        notes: bodyForm.notes || "",
      };
      if (!entry.weight && !entry.bodyFat) {
        showToast("Enter weight or body fat", C.danger);
        return;
      }
      const updated = [...bodyMetrics, entry];
      await saveBodyMetrics(updated);
      setBodyForm({ weight: "", bodyFat: "", muscleMass: "", bmi: "", water: "", notes: "" });
      showToast("BODY METRICS LOGGED ✓");
    }

    return (
      <div className="fade-in" style={{ padding: "16px 16px 0" }}>
        <div style={{ marginBottom: 14 }}>
          <T size={11} color={C.muted} weight="600" style={{ letterSpacing: 2, textTransform: "uppercase", display: "block" }}>Body Composition</T>
          <T size={26} weight="800" color={C.accent} style={{ display: "block", fontFamily: "'Syne'" }}>BODY METRICS</T>
          <T size={11} color={C.muted} style={{ display: "block" }}>Renpho Scale · Weight · Body Fat · Lean Mass</T>
        </div>

        {/* Current Stats */}
        <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
          <Pill label="Weight" value={last?.weight ? `${last.weight}` : `${BODY_GOALS.weight.current}`} color={C.accent} />
          <Pill label="Body Fat" value={last?.bodyFat ? `${last.bodyFat}%` : `${BODY_GOALS.bodyFat.current}%`} color={C.purple} />
          <Pill label="Lean Mass" value={last?.weight && last?.bodyFat ? `${(last.weight * (1 - last.bodyFat / 100)).toFixed(1)}` : `${BODY_GOALS.leanMass.current}`} color={C.teal} />
        </div>

        {/* Goal Progress */}
        <Card>
          <T size={11} color={C.muted} weight="600" style={{ letterSpacing: 2, textTransform: "uppercase", display: "block", marginBottom: 12 }}>Race Day Targets</T>
          {/* Weight goal */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <T size={12} color={C.light}>Weight</T>
              <T size={12} mono color={C.accent} weight="600">{last?.weight || BODY_GOALS.weight.current} → {BODY_GOALS.weight.target} lbs</T>
            </div>
            <div style={{ background: C.border, borderRadius: 4, height: 6, overflow: "hidden" }}>
              <div style={{ background: C.accent, height: "100%", width: `${weightProgress}%`, borderRadius: 4, transition: "width 0.4s ease" }} />
            </div>
            <T size={10} color={C.muted} mono style={{ display: "block", marginTop: 4, textAlign: "right" }}>{weightProgress}% to goal</T>
          </div>
          {/* Body fat goal */}
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <T size={12} color={C.light}>Body Fat</T>
              <T size={12} mono color={C.purple} weight="600">{last?.bodyFat || BODY_GOALS.bodyFat.current}% → {BODY_GOALS.bodyFat.target}%</T>
            </div>
            <div style={{ background: C.border, borderRadius: 4, height: 6, overflow: "hidden" }}>
              <div style={{ background: C.purple, height: "100%", width: `${bfProgress}%`, borderRadius: 4, transition: "width 0.4s ease" }} />
            </div>
            <T size={10} color={C.muted} mono style={{ display: "block", marginTop: 4, textAlign: "right" }}>{bfProgress}% to goal</T>
          </div>
        </Card>

        {/* Weight Trend Chart */}
        {chartData.length > 1 && (
          <Card>
            <T size={11} color={C.muted} weight="600" style={{ letterSpacing: 2, textTransform: "uppercase", display: "block", marginBottom: 12 }}>Weight Trend — Last 30 Entries</T>
            <ResponsiveContainer width="100%" height={140}>
              <LineChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <XAxis dataKey="date" tick={{ fontSize: 9, fill: C.muted }} axisLine={false} tickLine={false} />
                <YAxis domain={["dataMin - 2", "dataMax + 2"]} tick={{ fontSize: 9, fill: C.muted }} axisLine={false} tickLine={false} />
                <ReferenceLine y={BODY_GOALS.weight.target} stroke={C.teal} strokeDasharray="4 4" strokeWidth={1} />
                <Line type="monotone" dataKey="weight" stroke={C.accent} strokeWidth={2} dot={{ r: 3, fill: C.accent }} connectNulls />
                <Tooltip contentStyle={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 12, color: C.text }} formatter={(v) => [`${v} lbs`, "Weight"]} />
              </LineChart>
            </ResponsiveContainer>
            <div style={{ display: "flex", justifyContent: "center", gap: 16, marginTop: 6 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <div style={{ width: 16, height: 2, background: C.accent, borderRadius: 1 }} />
                <T size={10} color={C.muted}>Weight</T>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <div style={{ width: 16, height: 2, background: C.teal, borderRadius: 1, borderStyle: "dashed" }} />
                <T size={10} color={C.muted}>Target ({BODY_GOALS.weight.target})</T>
              </div>
            </div>
          </Card>
        )}

        {/* Body Fat Trend */}
        {chartData.filter(d => d.bodyFat).length > 1 && (
          <Card>
            <T size={11} color={C.muted} weight="600" style={{ letterSpacing: 2, textTransform: "uppercase", display: "block", marginBottom: 12 }}>Body Fat % Trend</T>
            <ResponsiveContainer width="100%" height={120}>
              <LineChart data={chartData.filter(d => d.bodyFat)} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <XAxis dataKey="date" tick={{ fontSize: 9, fill: C.muted }} axisLine={false} tickLine={false} />
                <YAxis domain={["dataMin - 1", "dataMax + 1"]} tick={{ fontSize: 9, fill: C.muted }} axisLine={false} tickLine={false} />
                <ReferenceLine y={BODY_GOALS.bodyFat.target} stroke={C.teal} strokeDasharray="4 4" strokeWidth={1} />
                <Line type="monotone" dataKey="bodyFat" stroke={C.purple} strokeWidth={2} dot={{ r: 3, fill: C.purple }} connectNulls />
                <Tooltip contentStyle={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 12, color: C.text }} formatter={(v) => [`${v}%`, "Body Fat"]} />
              </LineChart>
            </ResponsiveContainer>
          </Card>
        )}

        {/* Lean Mass Trend */}
        {chartData.filter(d => d.leanMass).length > 1 && (
          <Card>
            <T size={11} color={C.muted} weight="600" style={{ letterSpacing: 2, textTransform: "uppercase", display: "block", marginBottom: 12 }}>Lean Mass Trend</T>
            <ResponsiveContainer width="100%" height={100}>
              <LineChart data={chartData.filter(d => d.leanMass)} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <XAxis dataKey="date" tick={{ fontSize: 9, fill: C.muted }} axisLine={false} tickLine={false} />
                <YAxis domain={["dataMin - 1", "dataMax + 1"]} tick={{ fontSize: 9, fill: C.muted }} axisLine={false} tickLine={false} />
                <Line type="monotone" dataKey="leanMass" stroke={C.teal} strokeWidth={2} dot={{ r: 3, fill: C.teal }} connectNulls />
                <Tooltip contentStyle={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 12, color: C.text }} formatter={(v) => [`${v} lbs`, "Lean Mass"]} />
              </LineChart>
            </ResponsiveContainer>
          </Card>
        )}

        {/* 7-Day Averages */}
        {(avgWeight7 || avgBf7) && (
          <Card>
            <T size={11} color={C.muted} weight="600" style={{ letterSpacing: 2, textTransform: "uppercase", display: "block", marginBottom: 10 }}>7-Day Rolling Average</T>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {avgWeight7 && (
                <div style={{ textAlign: "center", background: C.accent + "12", borderRadius: 8, padding: "10px" }}>
                  <T size={22} mono weight="700" color={C.accent} style={{ display: "block" }}>{avgWeight7}</T>
                  <T size={10} color={C.muted}>Avg Weight (lbs)</T>
                </div>
              )}
              {avgBf7 && (
                <div style={{ textAlign: "center", background: C.purple + "12", borderRadius: 8, padding: "10px" }}>
                  <T size={22} mono weight="700" color={C.purple} style={{ display: "block" }}>{avgBf7}%</T>
                  <T size={10} color={C.muted}>Avg Body Fat</T>
                </div>
              )}
            </div>
          </Card>
        )}

        {/* Log Form */}
        <Card accent>
          <T size={11} color={C.accent} weight="600" style={{ letterSpacing: 2, textTransform: "uppercase", display: "block", marginBottom: 12 }}>Log Weigh-In</T>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
            <div>
              <T size={11} color={C.muted} style={{ display: "block", marginBottom: 6, textTransform: "uppercase", letterSpacing: 1 }}>Weight (lbs)</T>
              <input type="number" step="0.1" placeholder="176.0" value={bodyForm.weight} onChange={e => setBodyForm({ ...bodyForm, weight: e.target.value })} />
            </div>
            <div>
              <T size={11} color={C.muted} style={{ display: "block", marginBottom: 6, textTransform: "uppercase", letterSpacing: 1 }}>Body Fat %</T>
              <input type="number" step="0.1" placeholder="13.2" value={bodyForm.bodyFat} onChange={e => setBodyForm({ ...bodyForm, bodyFat: e.target.value })} />
            </div>
            <div>
              <T size={11} color={C.muted} style={{ display: "block", marginBottom: 6, textTransform: "uppercase", letterSpacing: 1 }}>Muscle Mass (lbs)</T>
              <input type="number" step="0.1" placeholder="" value={bodyForm.muscleMass} onChange={e => setBodyForm({ ...bodyForm, muscleMass: e.target.value })} />
            </div>
            <div>
              <T size={11} color={C.muted} style={{ display: "block", marginBottom: 6, textTransform: "uppercase", letterSpacing: 1 }}>Body Water %</T>
              <input type="number" step="0.1" placeholder="" value={bodyForm.water} onChange={e => setBodyForm({ ...bodyForm, water: e.target.value })} />
            </div>
          </div>
          <div style={{ marginBottom: 12 }}>
            <T size={11} color={C.muted} style={{ display: "block", marginBottom: 6, textTransform: "uppercase", letterSpacing: 1 }}>Notes</T>
            <input type="text" placeholder="Morning fasted, post-run, etc." value={bodyForm.notes} onChange={e => setBodyForm({ ...bodyForm, notes: e.target.value })} />
          </div>
          <Btn onPress={submitBody} full color={C.accent}>LOG WEIGH-IN ✓</Btn>
        </Card>

        {/* History */}
        {sorted.length > 0 && (
          <Card>
            <T size={11} color={C.muted} weight="600" style={{ letterSpacing: 2, textTransform: "uppercase", display: "block", marginBottom: 10 }}>Recent Entries</T>
            {[...sorted].reverse().slice(0, 10).map(m => (
              <div key={m.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: `1px solid ${C.border}` }}>
                <div>
                  <T size={12} color={C.muted} mono>{new Date(m.date).toLocaleDateString("en-CA", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</T>
                  {m.notes && <T size={10} color={C.muted} style={{ display: "block", fontStyle: "italic" }}>{m.notes}</T>}
                </div>
                <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
                  {m.weight && <T size={14} mono weight="700" color={C.accent}>{m.weight}</T>}
                  {m.bodyFat && <T size={14} mono weight="700" color={C.purple}>{m.bodyFat}%</T>}
                  {m.muscleMass && <T size={12} mono color={C.teal}>{m.muscleMass}lbs</T>}
                  <button onClick={async () => {
                    const updated = bodyMetrics.filter(x => x.id !== m.id);
                    await saveBodyMetrics(updated);
                    showToast("Deleted", C.danger);
                  }} style={{ background: "none", border: "none", color: C.danger, cursor: "pointer", fontSize: 14, padding: "4px" }}>×</button>
                </div>
              </div>
            ))}
          </Card>
        )}
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
    { id: "VITALS",  icon: "♡", label: "VITALS" },
    { id: "LOG",     icon: "+", label: "LOG" },
    { id: "HYROX",   icon: "⬡", label: "HYROX" },
    { id: "CLIMB",   icon: "△", label: "CLIMB" },
    { id: "HISTORY", icon: "≡", label: "MORE" },
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
        {tab === "VITALS"  && <VitalsTab />}
        {tab === "WEEK"    && <WeekTab />}
        {tab === "LOG"     && <LogTab />}
        {tab === "BODY"    && <BodyTab />}
        {tab === "CLIMB"   && <ClimbTab />}
        {tab === "HISTORY" && <HistoryTab />}
        {tab === "HYROX"   && <HyroxTab />}
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
