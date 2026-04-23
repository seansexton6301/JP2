/* ============================================================
   INGEN BIOSYN — Central Park Control Console
   script.js
   ============================================================ */

// ── Boot sequence ────────────────────────────────────────────
const BOOT_LINES = [
  "INGEN BIOSYN SYSTEMS — BIOS v2.1.4",
  "Copyright (c) 1993 International Genetic Technologies",
  "",
  "Performing POST...",
  "  CPU: Intel 486DX/66 ........... OK",
  "  RAM: 64MB Extended ............. OK",
  "  HDD: Seagate ST51080A .......... OK",
  "  NET: Token Ring 16Mbps ......... OK",
  "",
  "Loading UNIX System V — kernel 2.0.18",
  "Mounting /dev/hda1 (ext2) ......... done",
  "Starting network services ......... done",
  "Initializing InGen Security Suite .. done",
  "",
  "CENTRAL PARK CONTROL CONSOLE — v4.0.5 Alpha E",
  "Loading enclosure grid data ........",
  "  > Species database: 15 entries loaded",
  "  > Fence system: ONLINE",
  "  > Camera array: 32/32 active",
  "  > Gate locks: ENGAGED",
  "",
  "System ready. Type 'm' for menu.",
];

const WELCOME_LINES = [
  "╔══════════════════════════════════════════════════════╗",
  "║   JURASSIC PARK — SYSTEM SECURITY INTERFACE          ║",
  "║   Version 4.0.5, Alpha E                             ║",
  "║                                                      ║",
  "║   InGen Corporation — Restricted Access              ║",
  "║   All activities logged and monitored                ║",
  "╚══════════════════════════════════════════════════════╝",
  "",
  "  Welcome, Dr. Hammond.",
  "  Type 'm' for menu, '?' for help.",
  "",
];

// ── Commands ─────────────────────────────────────────────────
const COMMANDS = {
  m: cmdMenu,
  menu: cmdMenu,
  "1": cmdSecurityGrid,
  "security grid": cmdSecurityGrid,
  "2": cmdMainProgram,
  "main program": cmdMainProgram,
  "3": cmdCameras,
  "view cameras": cmdCameras,
  cameras: cmdCameras,
  "4": cmdLights,
  "control lights": cmdLights,
  lights: cmdLights,
  "5": cmdEmergencyPower,
  "emergency power": cmdEmergencyPower,
  "6": cmdSystemStatus,
  "system status": cmdSystemStatus,
  status: cmdSystemStatus,
  "7": cmdHelp,
  help: cmdHelp,
  "?": cmdHelp,
  clever: cmdCleverness,
  "life finds a way": cmdLifeFindsAWay,
  raptor: cmdRaptors,
  raptors: cmdRaptors,
  "spared no expense": cmdSparedNoExpense,
  nedry: triggerNedry,
  shutdown: cmdShutdown,
  reboot: cmdReboot,
  "hold on to your butts": cmdHoldOn,
  clear: cmdClear,
  cls: cmdClear,
};

// ── State ────────────────────────────────────────────────────
let commandHistory = [];
let historyIndex = -1;
let raptorBreachActive = false;
let badCommandCount = 0;

// ── DOM refs ─────────────────────────────────────────────────
const output = document.getElementById("output");
const input = document.getElementById("input");
const nedryEl = document.getElementById("nedry");
const nedryClose = document.getElementById("nedry-close");
const alertFlash = document.getElementById("alert-flash");
const threatValue = document.getElementById("threat-value");
const clockEl = document.getElementById("clock");

// ── Boot ─────────────────────────────────────────────────────
(function boot() {
  const overlay = document.getElementById("boot-overlay");
  const bootText = document.getElementById("boot-text");
  let i = 0;
  const iv = setInterval(() => {
    if (i < BOOT_LINES.length) {
      bootText.textContent += BOOT_LINES[i] + "\n";
      i++;
    } else {
      clearInterval(iv);
      setTimeout(() => {
        overlay.classList.add("hidden");
        setTimeout(() => {
          overlay.style.display = "none";
          printWelcome();
          input.focus();
        }, 800);
      }, 600);
    }
  }, 60);
})();

function printWelcome() {
  WELCOME_LINES.forEach((l, i) => {
    setTimeout(() => {
      printLine(l, i < 8 ? "dim" : "info");
    }, i * 40);
  });
}

// ── Output helpers ───────────────────────────────────────────
function printLine(text, cls = "info") {
  const span = document.createElement("span");
  span.className = "line " + cls;
  span.textContent = text;
  output.appendChild(span);
  output.appendChild(document.createTextNode("\n"));
  output.scrollTop = output.scrollHeight;
}

function printLines(lines, cls = "info", delay = 30) {
  lines.forEach((l, i) => {
    setTimeout(() => printLine(l, cls), i * delay);
  });
}

function printSep() {
  printLine("──────────────────────────────────────────────────────", "separator");
}

function printEmpty() { printLine("", "dim"); }

// ── Clock ─────────────────────────────────────────────────────
function updateClock() {
  const now = new Date();
  const h = String(now.getHours()).padStart(2, "0");
  const m = String(now.getMinutes()).padStart(2, "0");
  const s = String(now.getSeconds()).padStart(2, "0");
  clockEl.textContent = `${h}:${m}:${s}`;
}
setInterval(updateClock, 1000);
updateClock();

// ── Input handling ───────────────────────────────────────────
input.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    const raw = input.value.trim();
    if (!raw) return;
    commandHistory.unshift(raw);
    historyIndex = -1;
    input.value = "";
    printLine("> " + raw, "cmd");
    handleCommand(raw.toLowerCase());
  } else if (e.key === "ArrowUp") {
    if (historyIndex < commandHistory.length - 1) {
      historyIndex++;
      input.value = commandHistory[historyIndex];
    }
    e.preventDefault();
  } else if (e.key === "ArrowDown") {
    if (historyIndex > 0) {
      historyIndex--;
      input.value = commandHistory[historyIndex];
    } else {
      historyIndex = -1;
      input.value = "";
    }
    e.preventDefault();
  }
});

// ── Button handling ──────────────────────────────────────────
document.querySelectorAll(".cmd-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    const cmd = btn.dataset.cmd;
    input.value = "";
    printLine("> [" + btn.querySelector(".btn-label").textContent + "]", "cmd");
    handleCommand(cmd);
    input.focus();
  });
});

// ── Nedry close ──────────────────────────────────────────────
nedryClose.addEventListener("click", () => {
  nedryEl.classList.remove("active");
  const audio = document.getElementById("laughAudio");
  if (audio) audio.pause();
});

// ── Command router ───────────────────────────────────────────
const NEDRY_WARNINGS = [
  "  \u26a0  WARNING: Unrecognized command. Access attempt logged.",
  "  \u26a0  WARNING: Security violation. One more attempt will trigger lockdown.",
  "  \u26a0  FINAL WARNING: This is your last chance. Identify yourself.",
];

function handleCommand(raw) {
  const fn = COMMANDS[raw];
  if (fn) {
    badCommandCount = 0;
    fn();
  } else {
    if (raw.includes("please")) {
      badCommandCount = 0;
      printLine("  Access granted. (You said the magic word.)", "success");
    } else if (badCommandCount < 3) {
      printLine(NEDRY_WARNINGS[badCommandCount], "warn");
      triggerAlertFlash();
      badCommandCount++;
    } else {
      badCommandCount = 0;
      triggerNedry();
    }
  }
}

// ── Commands ─────────────────────────────────────────────────
function cmdMenu() {
  printEmpty();
  printLine("  ┌─ MAIN MENU ──────────────────────────────────┐", "dim");
  printLine("  │  1. Security Grid      2. Main Program       │", "info");
  printLine("  │  3. View Cameras       4. Control Lights     │", "info");
  printLine("  │  5. Emergency Power    6. System Status      │", "info");
  printLine("  │  7. Help                                     │", "info");
  printLine("  └──────────────────────────────────────────────┘", "dim");
  printEmpty();
}

function cmdSecurityGrid() {
  printEmpty();
  printLine("  SECURITY GRID — ENCLOSURE STATUS", "success");
  printSep();
  const zones = [
    { name: "T-REX PADDOCK    (Zone A)", status: "SECURE", pwr: 100 },
    { name: "RAPTOR PEN       (Zone B)", status: "WARNING", pwr: 72 },
    { name: "DILOPHOSAUR      (Zone C)", status: "SECURE", pwr: 95 },
    { name: "TRICERATOPS      (Zone D)", status: "SECURE", pwr: 91 },
    { name: "VISITOR CENTER   (Zone E)", status: "SECURE", pwr: 88 },
    { name: "AVIARY           (Zone F)", status: "SECURE", pwr: 100 },
    { name: "GALLIMIMUS PLAIN (Zone G)", status: "SECURE", pwr: 97 },
  ];
  zones.forEach((z, i) => {
    setTimeout(() => {
      const bar = "█".repeat(Math.floor(z.pwr / 10)) + "░".repeat(10 - Math.floor(z.pwr / 10));
      const cls = z.status === "WARNING" ? "warn" : "info";
      printLine(`  ${z.name}  [${bar}] ${z.pwr}%  ${z.status}`, cls);
    }, i * 80);
  });
  setTimeout(() => {
    printEmpty();
    printLine("  ⚠  RAPTOR PEN: Fence segment B-7 degraded. Maintenance required.", "warn");
    printEmpty();
  }, zones.length * 80 + 50);
}

function cmdMainProgram() {
  printEmpty();
  printLine("  MAIN PROGRAM — CORE SYSTEMS", "success");
  printSep();
  const systems = [
    ["Visitor Tracking System", "ONLINE"],
    ["Dinosaur Telemetry Feed", "ONLINE"],
    ["InGen Asset Database", "ONLINE"],
    ["Automated Tour Vehicles", "STANDBY"],
    ["Emergency Bunker Access", "LOCKED"],
    ["Nedry Backdoor Protocol", "ERROR"],
  ];
  systems.forEach((s, i) => {
    setTimeout(() => {
      const cls = s[1] === "ERROR" ? "error" : s[1] === "STANDBY" ? "warn" : "info";
      printLine(`  > ${s[0].padEnd(32)} [ ${s[1]} ]`, cls);
    }, i * 70);
  });
  setTimeout(() => printEmpty(), systems.length * 70 + 50);
}

function cmdCameras() {
  printEmpty();
  printLine("  CAMERA ARRAY — 32 FEEDS ACTIVE", "success");
  printSep();
  const feeds = [
    ["CAM-01", "MAIN GATE",         "CLEAR"],
    ["CAM-02", "HELIPAD",           "CLEAR"],
    ["CAM-03", "VISITOR LOBBY",     "CLEAR"],
    ["CAM-04", "T-REX PADDOCK N",   "CLEAR"],
    ["CAM-05", "T-REX PADDOCK S",   "CLEAR"],
    ["CAM-06", "RAPTOR PEN — EAST", "MOTION DETECTED"],
    ["CAM-07", "RAPTOR PEN — WEST", "MOTION DETECTED"],
    ["CAM-08", "DILOPHOSAUR SEC7",  "CLEAR"],
    ["CAM-09", "TRICERATOPS PLAIN", "CLEAR"],
    ["CAM-10", "CONTROL ROOM",      "CLEAR"],
    ["CAM-11", "GENERATOR BAY",     "CLEAR"],
    ["CAM-12", "AVIARY",            "OFFLINE"],
  ];
  feeds.forEach((f, i) => {
    setTimeout(() => {
      const cls = f[2] === "OFFLINE" ? "error" : f[2].includes("MOTION") ? "warn" : "dim";
      printLine(`  ${f[0]}  ${f[1].padEnd(24)}  ${f[2]}`, cls);
    }, i * 50);
  });
  setTimeout(() => {
    printEmpty();
    printLine("  ⚠  CAM-12 (Aviary) offline — power relay disconnected.", "warn");
    printLine("  ⚠  Motion detected in Raptor Pen — reviewing footage.", "warn");
    printEmpty();
  }, feeds.length * 50 + 60);
}

function cmdLights() {
  printEmpty();
  printLine("  LIGHTING CONTROL", "success");
  printSep();
  const zones = ["Visitor Center", "Main Lobby", "Control Room", "Perimeter Path", "Generator Bay", "Docking Bay"];
  zones.forEach((z, i) => {
    setTimeout(() => {
      const on = Math.random() > 0.2;
      printLine(`  ${z.padEnd(22)}  ${on ? "[████████] ON " : "[        ] OFF"}`, on ? "info" : "dim");
    }, i * 60);
  });
  setTimeout(() => {
    printEmpty();
    printLine("  Use 'lights [zone] on/off' to toggle individual circuits.", "dim");
    printEmpty();
  }, zones.length * 60 + 60);
}

function cmdEmergencyPower() {
  printEmpty();
  printLine("  !! EMERGENCY POWER PROTOCOL INITIATED !!      ", "error");
  printSep();
  triggerAlertFlash();
  setThreat("HIGH");
  const steps = [
    "  Rerouting power to primary grid...",
    "  Shutting down non-essential systems...",
    "  Activating backup generators (Gas Turbine)...",
    "  Restoring fence grid — priority order:",
    "    > T-Rex Paddock ......... RESTORED",
    "    > Raptor Pen ............ RESTORED",
    "    > Dilophosaur Sector .... RESTORED",
    "    > Visitor Center ........ RESTORED",
    "  Emergency lighting: ACTIVE",
    "  Intercom broadcast: ACTIVE",
    "",
    "  All enclosures reporting ONLINE.",
    "  Dr. Hammond notified.",
  ];
  steps.forEach((s, i) => {
    setTimeout(() => {
      const cls = s.includes("RESTORED") ? "success" : s.startsWith("  !") ? "error" : "warn";
      printLine(s, cls);
    }, i * 130);
  });
  setTimeout(() => {
    setThreat("MEDIUM");
    printEmpty();
  }, steps.length * 130 + 200);
}

function cmdSystemStatus() {
  printEmpty();
  printLine("  SYSTEM STATUS — FULL DIAGNOSTIC", "success");
  printSep();
  const stats = [
    ["CPU Load",           "34%",             "info"],
    ["Memory",             "41MB / 64MB",      "info"],
    ["Disk I/O",           "12 MB/s",          "info"],
    ["Network",            "Token Ring — UP",  "info"],
    ["Fence Grid",         "ONLINE (6/7 OK)",  "warn"],
    ["Camera System",      "31/32 ONLINE",     "warn"],
    ["Power Supply",       "MAINS + BACKUP",   "info"],
    ["Uptime",             "4d 7h 22m",        "info"],
    ["Intrusions (24h)",   "3 ALERTS",         "warn"],
    ["User Sessions",      "2 ACTIVE",         "info"],
  ];
  stats.forEach((s, i) => {
    setTimeout(() => {
      printLine(`  ${s[0].padEnd(26)} ${s[1]}`, s[2]);
    }, i * 60);
  });
  setTimeout(() => printEmpty(), stats.length * 60 + 60);
}

function cmdHelp() {
  printEmpty();
  printLine("  HELP — AVAILABLE COMMANDS", "success");
  printSep();
  const cmds = [
    ["m / menu",           "Show main menu"],
    ["1 / security grid",  "Enclosure fence status"],
    ["2 / main program",   "Core system status"],
    ["3 / cameras",        "Camera feed overview"],
    ["4 / lights",         "Lighting control"],
    ["5 / emergency power","Emergency power protocol"],
    ["6 / status",         "Full system diagnostic"],
    ["clear / cls",        "Clear terminal output"],
    ["↑ / ↓",             "Browse command history"],
    ["...",                "Try some other things too."],
  ];
  cmds.forEach((c, i) => {
    setTimeout(() => {
      printLine(`  ${c[0].padEnd(24)} — ${c[1]}`, "info");
    }, i * 40);
  });
  setTimeout(() => printEmpty(), cmds.length * 40 + 40);
}

function cmdCleverness() {
  printEmpty();
  printLine("  \"You were so preoccupied with whether you could,\"", "warn");
  printLine("  \"you didn't stop to think if you should.\"", "warn");
  printLine("                             — Dr. Ian Malcolm", "dim");
  printEmpty();
}

function cmdLifeFindsAWay() {
  printEmpty();
  printLine("  Dr. Malcolm — Chaos Theory Division", "success");
  printSep();
  printLine("  \"Life, uh... finds a way.\"", "info");
  printEmpty();
  printLine("  SYSTEM NOTE: Unauthorized breeding detected — Sector 4.", "warn");
  printLine("  Species population count exceeds projected totals by 37%.", "warn");
  printEmpty();
}

function cmdRaptors() {
  printEmpty();
  printLine("  RAPTOR STATUS — VELOCIRAPTORS (3 TRACKED)", "warn");
  printSep();
  triggerAlertFlash();
  const raptors = [
    { name: "RAPTOR-01 (CLEVER GIRL)", loc: "PEN B — NORTH",    status: "CONTAINED" },
    { name: "RAPTOR-02 (REXY)",        loc: "PEN B — SOUTH",    status: "CONTAINED" },
    { name: "RAPTOR-03 (DELTA)",       loc: "PEN B — PERIMETER", status: "⚠ TESTING FENCE" },
  ];
  raptors.forEach((r, i) => {
    setTimeout(() => {
      const cls = r.status.includes("⚠") ? "warn" : "info";
      printLine(`  ${r.name.padEnd(28)} ${r.loc.padEnd(20)} ${r.status}`, cls);
    }, i * 90);
  });
  setTimeout(() => {
    printEmpty();
    printLine("  Muldoon alert: \"They should all be destroyed.\"", "dim");
    printEmpty();
  }, raptors.length * 90 + 60);
}

function cmdSparedNoExpense() {
  printEmpty();
  printLine("  \"We've spared no expense.\"", "success");
  printLine("             — John Hammond", "dim");
  printEmpty();
  printLine("  BUDGET REPORT:", "info");
  printLine("  InGen R&D expenditure (FY1993): $3.2 Billion", "info");
  printLine("  Park construction cost: $1.8 Billion", "info");
  printLine("  Dennis Nedry salary: $83,000 / yr (underpaid)", "warn");
  printLine("  Biosyn corporate espionage fund: CLASSIFIED", "error");
  printEmpty();
}

function cmdShutdown() {
  printEmpty();
  printLine("  SHUTDOWN SEQUENCE INITIATED", "error");
  triggerAlertFlash();
  setThreat("HIGH");
  const seq = [
    "  Notifying InGen personnel...",
    "  Saving system state...",
    "  Engaging all gate locks...",
    "  Powering down tour vehicles...",
    "  Fences remain ACTIVE on battery backup.",
    "  ...",
    "  SYSTEM SHUTDOWN COMPLETE.",
    "  Have a safe trip, Dr. Hammond.",
  ];
  seq.forEach((s, i) => {
    setTimeout(() => printLine(s, i === seq.length - 1 ? "success" : "warn"), i * 200);
  });
  setTimeout(() => setThreat("LOW"), seq.length * 200 + 200);
}

function cmdReboot() {
  printEmpty();
  printLine("  REBOOT SEQUENCE — please wait...", "warn");
  setTimeout(() => {
    cmdClear();
    printWelcome();
    setThreat("LOW");
  }, 2000);
}

function cmdHoldOn() {
  printEmpty();
  printLine("  \"Hold on to your butts.\"  — Ray Arnold", "success");
  printEmpty();
}

function cmdClear() {
  output.innerHTML = "";
}

// ── Nedry ────────────────────────────────────────────────────
function triggerNedry() {
  nedryEl.classList.add("active");
  triggerAlertFlash();
  const audio = document.getElementById("laughAudio");
  if (audio) { audio.currentTime = 0; audio.play().catch(() => {}); }
  printLine("  ACCESS DENIED — You didn't say the magic word!", "error");
}

// ── Alert flash ───────────────────────────────────────────────
function triggerAlertFlash() {
  alertFlash.classList.remove("flash");
  void alertFlash.offsetWidth;
  alertFlash.classList.add("flash");
}

// ── Threat level ──────────────────────────────────────────────
function setThreat(level) {
  threatValue.textContent = level;
  threatValue.className = "";
  if (level === "MEDIUM") threatValue.classList.add("warn");
  if (level === "HIGH") threatValue.classList.add("danger");
}

// ── Raptor breach random event ────────────────────────────────
function raptorBreachEvent() {
  if (Math.random() < 0.006 && !raptorBreachActive) {
    raptorBreachActive = true;
    setThreat("HIGH");
    triggerAlertFlash();
    printEmpty();
    printLine("  !! ALERT !! RAPTOR PEN BREACH — SECTOR B-7 COMPROMISED !!", "error");
    printLine("  All personnel to emergency stations. Gates sealing now.", "warn");
    // Update raptor status in sidebar
    document.querySelector("#raptor-status .status-val").textContent = "BREACH";
    document.querySelector("#raptor-status .status-val").className = "status-val offline";

    setTimeout(() => {
      printLine("  Breach contained. Fence segment re-energized.", "success");
      setThreat("MEDIUM");
      document.querySelector("#raptor-status .status-val").textContent = "3 TRACKED";
      document.querySelector("#raptor-status .status-val").className = "status-val warn";
      raptorBreachActive = false;
    }, 8000);
  }
}
setInterval(raptorBreachEvent, 3000);

// ── Fence power fluctuation ───────────────────────────────────
setInterval(() => {
  const fills = document.querySelectorAll(".fence-fill");
  fills.forEach(fill => {
    const current = parseInt(fill.style.width) || 100;
    const delta = (Math.random() - 0.5) * 4;
    const newVal = Math.min(100, Math.max(40, current + delta));
    fill.style.width = newVal + "%";
    fill.classList.toggle("warn", newVal < 80);
  });
}, 2500);

// ── Add alert to log ─────────────────────────────────────────
const alertMessages = [
  ["Motion — T-Rex Paddock perimeter", "ok"],
  ["Auth OK — Dr. Ellie Sattler", "ok"],
  ["Fence test — Sector 3 passed", "ok"],
  ["Power spike — Generator Bay", "warn"],
  ["Unauthorized login attempt", "warn"],
  ["Camera glitch — CAM-11", "warn"],
];
function addRandomAlert() {
  const log = document.getElementById("alert-log");
  const msg = alertMessages[Math.floor(Math.random() * alertMessages.length)];
  const now = new Date();
  const time = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
  const div = document.createElement("div");
  div.className = "alert-item " + msg[1];
  div.textContent = `[${time}] ${msg[0]}`;
  log.insertBefore(div, log.firstChild);
  // Keep max 8 alerts
  while (log.children.length > 8) log.removeChild(log.lastChild);
}
setInterval(addRandomAlert, 18000);

// ── Keep input focused ────────────────────────────────────────
document.addEventListener("click", (e) => {
  if (!e.target.closest("#nedry")) input.focus();
});
