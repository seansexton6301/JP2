/* ============================================================
   INGEN BIOSYN — Central Park Control Console
   script.js — Power-restore → Camera online flow
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
  "  > Camera array: OFFLINE — power interrupted",
  "  > Gate locks: ENGAGED",
  "",
  "!! WARNING: Camera subsystem offline — restore power first !!",
  "System ready. Type 'restore power' or press [5] to begin.",
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
  "  !! CAMERA ARRAY OFFLINE — Type 'restore power' to bring cameras online.",
  "",
];

// ── State ────────────────────────────────────────────────────
let commandHistory = [];
let historyIndex = -1;
let raptorBreachActive = false;
let badCommandCount = 0;
let powerRestored = false;
let cameraCanvases = {}; // { id: { canvas, ctx, animFrame } }

// ── DOM refs ─────────────────────────────────────────────────
const output      = document.getElementById("output");
const input       = document.getElementById("input");
const nedryEl     = document.getElementById("nedry");
const nedryClose  = document.getElementById("nedry-close");
const alertFlash  = document.getElementById("alert-flash");
const threatValue = document.getElementById("threat-value");
const clockEl     = document.getElementById("clock");

// ── Commands ─────────────────────────────────────────────────
const COMMANDS = {
  m: cmdMenu, menu: cmdMenu,
  "1": cmdSecurityGrid, "security grid": cmdSecurityGrid,
  "2": cmdMainProgram,  "main program": cmdMainProgram,
  "3": cmdCameras,      "view cameras": cmdCameras, cameras: cmdCameras,
  "4": cmdLights,       "control lights": cmdLights, lights: cmdLights,
  "5": cmdEmergencyPower, "emergency power": cmdEmergencyPower,
  "restore power": cmdEmergencyPower,
  "6": cmdSystemStatus, "system status": cmdSystemStatus, status: cmdSystemStatus,
  "7": cmdHelp, help: cmdHelp, "?": cmdHelp,
  clever: cmdCleverness,
  "life finds a way": cmdLifeFindsAWay,
  raptor: cmdRaptors, raptors: cmdRaptors,
  "spared no expense": cmdSparedNoExpense,
  nedry: triggerNedry,
  shutdown: cmdShutdown, reboot: cmdReboot,
  "hold on to your butts": cmdHoldOn,
  clear: cmdClear, cls: cmdClear,
};

// ── Boot ─────────────────────────────────────────────────────
(function boot() {
  const overlay  = document.getElementById("boot-overlay");
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
          // Show power prompt hint under cameras
          const pp = document.getElementById("power-prompt");
          if (pp) pp.classList.add("visible");
        }, 800);
      }, 600);
    }
  }, 55);
})();

function printWelcome() {
  WELCOME_LINES.forEach((l, i) => {
    setTimeout(() => {
      const cls = l.includes("!!") ? "warn" : i < 8 ? "dim" : "info";
      printLine(l, cls);
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
function printSep() {
  printLine("──────────────────────────────────────────────────────", "separator");
}
function printEmpty() { printLine("", "dim"); }

// ── Clock ─────────────────────────────────────────────────────
function updateClock() {
  const now = new Date();
  const h = String(now.getHours()).padStart(2,"0");
  const m = String(now.getMinutes()).padStart(2,"0");
  const s = String(now.getSeconds()).padStart(2,"0");
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
    if (historyIndex > 0) { historyIndex--; input.value = commandHistory[historyIndex]; }
    else { historyIndex = -1; input.value = ""; }
    e.preventDefault();
  }
});

// ── Button handling ──────────────────────────────────────────
document.querySelectorAll(".cmd-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    const cmd = btn.dataset.cmd;
    printLine("> [" + btn.querySelector(".btn-label").textContent + "]", "cmd");
    handleCommand(cmd);
    input.focus();
  });
});

nedryClose.addEventListener("click", () => {
  nedryEl.classList.remove("active");
});

// ── Command router ───────────────────────────────────────────
const NEDRY_WARNINGS = [
  "  ⚠  WARNING: Unrecognized command. Access attempt logged.",
  "  ⚠  WARNING: Security violation. One more attempt will trigger lockdown.",
  "  ⚠  FINAL WARNING: This is your last chance. Identify yourself.",
];

function handleCommand(raw) {
  const fn = COMMANDS[raw];
  if (fn) {
    badCommandCount = 0;
    fn();
  } else if (raw.includes("please")) {
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
    { name: "T-REX PADDOCK    (Zone A)", status: "SECURE",  pwr: 100 },
    { name: "RAPTOR PEN       (Zone B)", status: "WARNING", pwr: 72  },
    { name: "DILOPHOSAUR      (Zone C)", status: "SECURE",  pwr: 95  },
    { name: "TRICERATOPS      (Zone D)", status: "SECURE",  pwr: 91  },
    { name: "VISITOR CENTER   (Zone E)", status: "SECURE",  pwr: 88  },
    { name: "AVIARY           (Zone F)", status: "SECURE",  pwr: 100 },
    { name: "GALLIMIMUS PLAIN (Zone G)", status: "SECURE",  pwr: 97  },
  ];
  zones.forEach((z, i) => {
    setTimeout(() => {
      const bar = "█".repeat(Math.floor(z.pwr/10)) + "░".repeat(10 - Math.floor(z.pwr/10));
      printLine(`  ${z.name}  [${bar}] ${z.pwr}%  ${z.status}`, z.status === "WARNING" ? "warn" : "info");
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
    ["Visitor Tracking System",  "ONLINE"],
    ["Dinosaur Telemetry Feed",  "ONLINE"],
    ["InGen Asset Database",     "ONLINE"],
    ["Automated Tour Vehicles",  "STANDBY"],
    ["Emergency Bunker Access",  "LOCKED"],
    ["Nedry Backdoor Protocol",  "ERROR"],
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
  if (!powerRestored) {
    printLine("  !! CAMERA SUBSYSTEM OFFLINE", "error");
    printLine("  Power must be restored before cameras can be accessed.", "warn");
    printLine("  Type: restore power", "dim");
    printEmpty();
    return;
  }
  printLine("  CAMERA ARRAY — 32 FEEDS ACTIVE", "success");
  printSep();
  const feeds = [
    ["CAM-01", "MAIN GATE",         "CLEAR"],
    ["CAM-02", "HELIPAD",           "CLEAR"],
    ["CAM-03", "VISITOR LOBBY",     "CLEAR"],
    ["CAM-04", "T-REX PADDOCK N",   "CLEAR"],
    ["CAM-05", "T-REX PADDOCK S",   "CLEAR"],
    ["CAM-06", "RAPTOR PEN — EAST", "NO SIGNAL"],
    ["CAM-07", "RAPTOR PEN — WEST", "NO SIGNAL"],
    ["CAM-08", "DILOPHOSAUR SEC7",  "CLEAR"],
    ["CAM-09", "TRICERATOPS PLAIN", "CLEAR"],
    ["CAM-10", "CONTROL ROOM",      "CLEAR"],
    ["CAM-11", "GENERATOR BAY",     "CLEAR"],
    ["CAM-12", "AVIARY",            "OFFLINE"],
  ];
  feeds.forEach((f, i) => {
    setTimeout(() => {
      const cls = f[2] === "OFFLINE" || f[2] === "NO SIGNAL" ? "error" : "dim";
      printLine(`  ${f[0]}  ${f[1].padEnd(24)}  ${f[2]}`, cls);
    }, i * 50);
  });
  setTimeout(() => {
    printEmpty();
    printLine("  !! RAPTOR PEN cams: NO SIGNAL — feed corrupted or destroyed.", "error");
    printEmpty();
  }, feeds.length * 50 + 60);
}

function cmdLights() {
  printEmpty();
  printLine("  LIGHTING CONTROL", "success");
  printSep();
  const zones = ["Visitor Center","Main Lobby","Control Room","Perimeter Path","Generator Bay","Docking Bay"];
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

// ── EMERGENCY POWER / RESTORE POWER ──────────────────────────
function cmdEmergencyPower() {
  printEmpty();
  if (powerRestored) {
    printLine("  Power grid already online. All systems nominal.", "success");
    printEmpty();
    return;
  }

  printLine("  !! EMERGENCY POWER RESTORE INITIATED !!      ", "error");
  printSep();
  triggerAlertFlash();
  setThreat("HIGH");

  // Hide prompt
  const pp = document.getElementById("power-prompt");
  if (pp) pp.classList.remove("visible");

  const steps = [
    { txt: "  Rerouting power to primary grid...",           cls: "warn",    t: 0    },
    { txt: "  Shutting down non-essential systems...",       cls: "warn",    t: 900  },
    { txt: "  Activating backup generators (Gas Turbine)...",cls: "warn",    t: 1800 },
    { txt: "  Restoring fence grid — priority order:",       cls: "info",    t: 2600 },
    { txt: "    > T-Rex Paddock ......... RESTORED",         cls: "success", t: 3000 },
    { txt: "    > Raptor Pen ............ RESTORED",         cls: "success", t: 3500 },
    { txt: "    > Dilophosaur Sector .... RESTORED",         cls: "success", t: 4000 },
    { txt: "    > Visitor Center ........ RESTORED",         cls: "success", t: 4500 },
    { txt: "  Fence grid: ONLINE",                          cls: "success", t: 5000 },
    { txt: "  Emergency lighting: ACTIVE",                  cls: "info",    t: 5400 },
    { txt: "",                                               cls: "dim",     t: 5800 },
    { txt: "  Restoring camera subsystem...",               cls: "warn",    t: 6200 },
    { txt: "    > CAM-01 MAIN GATE ........... OK",          cls: "info",    t: 6700 },
    { txt: "    > CAM-04 T-REX PADDOCK ........ OK",         cls: "info",    t: 7100 },
    { txt: "    > CAM-09 RAPTOR PEN ........... SIGNAL LOST",cls: "error",  t: 7500 },
    { txt: "    > CAM-12 VISITOR CENTER ........ OK",        cls: "info",    t: 7900 },
    { txt: "  Camera array: PARTIAL (3/4 feeds active)",    cls: "warn",    t: 8400 },
    { txt: "",                                               cls: "dim",     t: 8700 },
    { txt: "  All enclosures reporting ONLINE.",             cls: "success", t: 9000 },
    { txt: "  Dr. Hammond notified.",                        cls: "dim",     t: 9400 },
  ];

  steps.forEach(s => {
    setTimeout(() => printLine(s.txt, s.cls), s.t);
  });

  // Trigger camera boot sequence
  setTimeout(() => bootCameras(), 6500);

  // Settle threat
  setTimeout(() => {
    setThreat("MEDIUM");
    powerRestored = true;
    printEmpty();
  }, 9800);
}

// ══════════════════════════════════════════════════════════════
//  CAMERA BOOT + CANVAS RENDERING
// ══════════════════════════════════════════════════════════════
const CAM_IDS = ["cam1", "cam2", "cam3", "cam4"];
const CAM_DELAYS = [0, 600, 1200, 1900]; // staggered boot

function bootCameras() {
  CAM_IDS.forEach((id, idx) => {
    setTimeout(() => bringCamOnline(id), CAM_DELAYS[idx]);
  });
}

function bringCamOnline(id) {
  const cell = document.getElementById(id);
  if (!cell) return;

  // Boot flash
  const flash = cell.querySelector(".cam-boot-flash");
  if (flash) {
    flash.classList.add("flashing");
    setTimeout(() => flash.classList.remove("flashing"), 600);
  }

  // Hide offline screen
  const offlineScreen = cell.querySelector(".cam-offline-screen");
  if (offlineScreen) offlineScreen.classList.add("hidden");

  if (id === "cam4") {
    // Raptor cam — NO SIGNAL
    const noSig = cell.querySelector(".cam-no-signal");
    if (noSig) noSig.classList.add("visible");
    // Update rec badge
    const rec = cell.querySelector(".cam-rec");
    if (rec) { rec.textContent = "✖ NO SIGNAL"; rec.style.color = "#ff2222"; rec.style.animation = "blink-text 0.4s infinite"; }
  } else {
    // Live canvas cam
    startCanvasCam(id, cell);
  }
}

// ── Dino canvas renderers ─────────────────────────────────────
function startCanvasCam(id, cell) {
  const canvas = cell.querySelector(".cam-canvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");

  // Match canvas resolution to display size
  function resize() {
    canvas.width  = cell.clientWidth  || 110;
    canvas.height = cell.clientHeight || 80;
  }
  resize();

  const dinoTypes = { cam1: "trex", cam2: "brachio", cam3: "raptor_pack" };
  const type = dinoTypes[id] || "trex";

  let frame = 0;
  let dinoX = -80;
  let dinoDir = 1;

  // Raptor pack state (cam3 has multiple)
  const raptors = [
    { x: -60, speed: 1.8, size: 0.85, phase: 0 },
    { x: -100, speed: 2.1, size: 0.75, phase: 1.2 },
    { x: -140, speed: 1.6, size: 0.9,  phase: 2.5 },
  ];

  function drawFrame() {
    resize();
    const W = canvas.width, H = canvas.height;

    // ── Grainy B&W background ──
    ctx.fillStyle = "#1a1a1a";
    ctx.fillRect(0, 0, W, H);

    // Dark jungle suggestion — layered rectangles
    // Ground
    const grd = ctx.createLinearGradient(0, H * 0.55, 0, H);
    grd.addColorStop(0, "#111");
    grd.addColorStop(1, "#0a0a0a");
    ctx.fillStyle = grd;
    ctx.fillRect(0, H * 0.55, W, H * 0.45);

    // Canopy layers (just dark silhouettes)
    drawCanopy(ctx, W, H, frame);

    // Draw dino
    if (type === "trex") {
      drawTRex(ctx, W, H, dinoX, frame);
      dinoX += 0.35 * dinoDir;
      if (dinoX > W + 80) dinoX = -80;
    } else if (type === "brachio") {
      drawBrachio(ctx, W, H, dinoX, frame);
      dinoX += 0.15 * dinoDir;
      if (dinoX > W + 60) dinoX = -80;
    } else if (type === "raptor_pack") {
      raptors.forEach(r => {
        drawRaptor(ctx, W, H, r.x, frame + r.phase, r.size);
        r.x += r.speed;
        if (r.x > W + 50) r.x = -40 - Math.random() * 60;
      });
    }

    // Film grain overlay
    applyGrain(ctx, W, H, frame);

    // Vignette
    const vig = ctx.createRadialGradient(W/2, H/2, H*0.2, W/2, H/2, H*0.85);
    vig.addColorStop(0, "rgba(0,0,0,0)");
    vig.addColorStop(1, "rgba(0,0,0,0.65)");
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, W, H);

    frame++;
    cameraCanvases[id] = requestAnimationFrame(drawFrame);
  }

  drawFrame();
}

// ── Canopy silhouette ─────────────────────────────────────────
function drawCanopy(ctx, W, H, frame) {
  const sway = Math.sin(frame * 0.015) * 4;
  ctx.save();
  ctx.fillStyle = "#0d0d0d";

  // Back layer — treetops
  ctx.beginPath();
  ctx.moveTo(0, H * 0.5);
  for (let x = 0; x <= W; x += 18) {
    const bump = Math.sin((x * 0.08) + frame * 0.008 + sway) * H * 0.1;
    ctx.lineTo(x, H * 0.38 - bump);
  }
  ctx.lineTo(W, 0); ctx.lineTo(0, 0); ctx.closePath();
  ctx.fill();

  // Mid layer
  ctx.fillStyle = "#080808";
  ctx.beginPath();
  ctx.moveTo(0, H * 0.62);
  for (let x = 0; x <= W; x += 12) {
    const bump = Math.sin((x * 0.12) + frame * 0.012 - sway * 0.5) * H * 0.08;
    ctx.lineTo(x, H * 0.5 - bump);
  }
  ctx.lineTo(W, 0); ctx.lineTo(0, 0); ctx.closePath();
  ctx.fill();

  ctx.restore();
}

// ── T-Rex silhouette ──────────────────────────────────────────
function drawTRex(ctx, W, H, x, frame) {
  const scale = H / 80;
  const bobY = Math.sin(frame * 0.08) * 1.5 * scale;
  const groundY = H * 0.72;
  const h = 38 * scale;
  const w = 28 * scale;

  ctx.save();
  ctx.translate(x, groundY - h + bobY);
  ctx.fillStyle = "#000";

  ctx.beginPath();
  // body
  ctx.ellipse(w * 0.5, h * 0.55, w * 0.35, h * 0.28, -0.25, 0, Math.PI * 2);
  ctx.fill();
  // head
  ctx.beginPath();
  ctx.ellipse(w * 0.15, h * 0.18, w * 0.22, h * 0.15, 0.4, 0, Math.PI * 2);
  ctx.fill();
  // neck connector
  ctx.beginPath();
  ctx.moveTo(w * 0.15, h * 0.28);
  ctx.lineTo(w * 0.38, h * 0.42);
  ctx.lineTo(w * 0.32, h * 0.48);
  ctx.lineTo(w * 0.1, h * 0.32);
  ctx.closePath();
  ctx.fill();
  // tail
  ctx.beginPath();
  ctx.moveTo(w * 0.82, h * 0.5);
  ctx.quadraticCurveTo(w * 1.15, h * 0.6, w * 1.3, h * 0.8);
  ctx.lineTo(w * 1.2, h * 0.82);
  ctx.quadraticCurveTo(w * 1.05, h * 0.65, w * 0.75, h * 0.62);
  ctx.closePath();
  ctx.fill();
  // legs (animated walk)
  const legSwing = Math.sin(frame * 0.18) * 6 * scale;
  // front leg
  ctx.beginPath();
  ctx.moveTo(w * 0.35, h * 0.75);
  ctx.lineTo(w * 0.35 + legSwing * 0.4, h);
  ctx.lineWidth = 5 * scale; ctx.strokeStyle = "#000"; ctx.stroke();
  // rear leg
  ctx.beginPath();
  ctx.moveTo(w * 0.6, h * 0.78);
  ctx.lineTo(w * 0.6 - legSwing * 0.4, h);
  ctx.stroke();
  // tiny arm
  ctx.beginPath();
  ctx.moveTo(w * 0.28, h * 0.45);
  ctx.lineTo(w * 0.18, h * 0.55);
  ctx.lineWidth = 2.5 * scale; ctx.stroke();

  ctx.restore();
}

// ── Brachiosaurus silhouette ──────────────────────────────────
function drawBrachio(ctx, W, H, x, frame) {
  const scale = H / 80;
  const bobY = Math.sin(frame * 0.05) * 2 * scale;
  const groundY = H * 0.76;
  const h = 52 * scale;
  const w = 44 * scale;

  ctx.save();
  ctx.translate(x, groundY - h + bobY);
  ctx.fillStyle = "#000";

  // body — large oval
  ctx.beginPath();
  ctx.ellipse(w * 0.55, h * 0.65, w * 0.42, h * 0.22, -0.15, 0, Math.PI * 2);
  ctx.fill();
  // neck — long angled
  ctx.beginPath();
  ctx.moveTo(w * 0.28, h * 0.5);
  ctx.quadraticCurveTo(w * 0.1, h * 0.25, w * 0.12, h * 0.04);
  ctx.quadraticCurveTo(w * 0.2, h * 0.0, w * 0.26, h * 0.04);
  ctx.quadraticCurveTo(w * 0.25, h * 0.25, w * 0.4, h * 0.52);
  ctx.closePath();
  ctx.fill();
  // head
  ctx.beginPath();
  ctx.ellipse(w * 0.13, h * 0.02, w * 0.1, h * 0.04, 0.5, 0, Math.PI * 2);
  ctx.fill();
  // tail
  ctx.beginPath();
  ctx.moveTo(w * 0.92, h * 0.62);
  ctx.quadraticCurveTo(w * 1.15, h * 0.7, w * 1.2, h * 0.9);
  ctx.lineTo(w * 1.1, h * 0.92);
  ctx.quadraticCurveTo(w * 1.05, h * 0.74, w * 0.88, h * 0.72);
  ctx.closePath();
  ctx.fill();
  // 4 legs
  const legSway = Math.sin(frame * 0.06) * 2 * scale;
  [[0.3, 0], [0.42, 1], [0.65, 2], [0.78, 3]].forEach(([lx, phase]) => {
    const sw = Math.sin(frame * 0.1 + phase) * 3 * scale;
    ctx.beginPath();
    ctx.moveTo(w * lx, h * 0.82);
    ctx.lineTo(w * lx + sw, h);
    ctx.lineWidth = 5 * scale; ctx.strokeStyle = "#000"; ctx.stroke();
  });

  ctx.restore();
}

// ── Raptor silhouette ─────────────────────────────────────────
function drawRaptor(ctx, W, H, x, frame, sizeScale) {
  const scale = (H / 80) * sizeScale;
  const bobY = Math.sin(frame * 0.22) * 1.2 * scale;
  const groundY = H * 0.74;
  const h = 26 * scale;
  const w = 22 * scale;

  ctx.save();
  ctx.translate(x, groundY - h + bobY);
  ctx.fillStyle = "#000";

  // body — horizontal oval (running posture)
  ctx.beginPath();
  ctx.ellipse(w * 0.5, h * 0.55, w * 0.42, h * 0.22, -0.3, 0, Math.PI * 2);
  ctx.fill();
  // head
  ctx.beginPath();
  ctx.ellipse(w * 0.08, h * 0.2, w * 0.18, h * 0.12, 0.3, 0, Math.PI * 2);
  ctx.fill();
  // snout extension
  ctx.beginPath();
  ctx.moveTo(w * -0.04, h * 0.18);
  ctx.lineTo(w * -0.14, h * 0.22);
  ctx.lineTo(w * -0.14, h * 0.26);
  ctx.lineTo(w * 0.0, h * 0.28);
  ctx.closePath();
  ctx.fill();
  // neck
  ctx.beginPath();
  ctx.moveTo(w * 0.18, h * 0.28);
  ctx.lineTo(w * 0.3, h * 0.4);
  ctx.lineTo(w * 0.24, h * 0.44);
  ctx.lineTo(w * 0.12, h * 0.32);
  ctx.closePath();
  ctx.fill();
  // tail — long and low
  ctx.beginPath();
  ctx.moveTo(w * 0.9, h * 0.52);
  ctx.quadraticCurveTo(w * 1.2, h * 0.55, w * 1.45, h * 0.48);
  ctx.lineTo(w * 1.42, h * 0.55);
  ctx.quadraticCurveTo(w * 1.15, h * 0.62, w * 0.88, h * 0.62);
  ctx.closePath();
  ctx.fill();
  // legs (fast run)
  const legSwing = Math.sin(frame * 0.28) * 8 * scale;
  ctx.beginPath();
  ctx.moveTo(w * 0.42, h * 0.7);
  ctx.lineTo(w * 0.42 + legSwing * 0.5, h);
  ctx.lineWidth = 3.5 * scale; ctx.strokeStyle = "#000"; ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(w * 0.58, h * 0.7);
  ctx.lineTo(w * 0.58 - legSwing * 0.5, h);
  ctx.stroke();
  // small claw arm
  ctx.beginPath();
  ctx.moveTo(w * 0.22, h * 0.44);
  ctx.lineTo(w * 0.12, h * 0.6);
  ctx.lineWidth = 1.5 * scale; ctx.stroke();

  ctx.restore();
}

// ── Film grain ────────────────────────────────────────────────
function applyGrain(ctx, W, H, frame) {
  // Only update grain every other frame for perf
  if (frame % 2 !== 0) return;
  const imageData = ctx.getImageData(0, 0, W, H);
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    const noise = (Math.random() - 0.5) * 55;
    data[i]   = Math.max(0, Math.min(255, data[i]   + noise));
    data[i+1] = Math.max(0, Math.min(255, data[i+1] + noise));
    data[i+2] = Math.max(0, Math.min(255, data[i+2] + noise));
  }
  ctx.putImageData(imageData, 0, 0);
}

// ── CCTV timestamps ───────────────────────────────────────────
function updateCCTVTimestamps() {
  const now = new Date();
  const d = `${String(now.getFullYear()).slice(2)}/${String(now.getMonth()+1).padStart(2,"0")}/${String(now.getDate()).padStart(2,"0")}`;
  const t = `${String(now.getHours()).padStart(2,"0")}:${String(now.getMinutes()).padStart(2,"0")}:${String(now.getSeconds()).padStart(2,"0")}`;
  const stamp = `${d} ${t}`;
  ["ts1","ts2","ts3","ts4"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = stamp;
  });
}
setInterval(updateCCTVTimestamps, 1000);
updateCCTVTimestamps();

// ── Other commands ────────────────────────────────────────────
function cmdSystemStatus() {
  printEmpty();
  printLine("  SYSTEM STATUS — FULL DIAGNOSTIC", "success");
  printSep();
  const stats = [
    ["CPU Load",          "34%",                              "info"],
    ["Memory",            "41MB / 64MB",                     "info"],
    ["Disk I/O",          "12 MB/s",                         "info"],
    ["Network",           "Token Ring — UP",                 "info"],
    ["Fence Grid",        "ONLINE (6/7 OK)",                 "warn"],
    ["Camera System",     powerRestored ? "3/4 ONLINE" : "OFFLINE", powerRestored ? "warn" : "error"],
    ["Power Supply",      "MAINS + BACKUP",                  "info"],
    ["Uptime",            "4d 7h 22m",                       "info"],
    ["Intrusions (24h)",  "3 ALERTS",                        "warn"],
    ["User Sessions",     "2 ACTIVE",                        "info"],
  ];
  stats.forEach((s, i) => {
    setTimeout(() => printLine(`  ${s[0].padEnd(26)} ${s[1]}`, s[2]), i * 60);
  });
  setTimeout(() => printEmpty(), stats.length * 60 + 60);
}

function cmdHelp() {
  printEmpty();
  printLine("  HELP — AVAILABLE COMMANDS", "success");
  printSep();
  const cmds = [
    ["m / menu",            "Show main menu"],
    ["1 / security grid",   "Enclosure fence status"],
    ["2 / main program",    "Core system status"],
    ["3 / cameras",         "Camera feed overview"],
    ["4 / lights",          "Lighting control"],
    ["5 / restore power",   "Restore power & bring cameras online"],
    ["6 / status",          "Full system diagnostic"],
    ["clear / cls",         "Clear terminal output"],
    ["↑ / ↓",              "Browse command history"],
    ["...",                 "Try some other things too."],
  ];
  cmds.forEach((c, i) => {
    setTimeout(() => printLine(`  ${c[0].padEnd(24)} — ${c[1]}`, "info"), i * 40);
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
    { name: "RAPTOR-01 (CLEVER GIRL)", loc: "PEN B — NORTH",     status: "CONTAINED"       },
    { name: "RAPTOR-02 (REXY)",        loc: "PEN B — SOUTH",     status: "CONTAINED"       },
    { name: "RAPTOR-03 (DELTA)",       loc: "PEN B — PERIMETER", status: "⚠ TESTING FENCE" },
  ];
  raptors.forEach((r, i) => {
    setTimeout(() => {
      printLine(`  ${r.name.padEnd(28)} ${r.loc.padEnd(20)} ${r.status}`, r.status.includes("⚠") ? "warn" : "info");
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
  printLine("  InGen R&D expenditure (FY1993): $3.2 Billion",   "info");
  printLine("  Park construction cost: $1.8 Billion",            "info");
  printLine("  Dennis Nedry salary: $83,000 / yr (underpaid)",   "warn");
  printLine("  Biosyn corporate espionage fund: CLASSIFIED",      "error");
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
    powerRestored = false;
    // Re-offline the cameras
    CAM_IDS.forEach(id => {
      const cell = document.getElementById(id);
      if (!cell) return;
      const offlineScreen = cell.querySelector(".cam-offline-screen");
      if (offlineScreen) offlineScreen.classList.remove("hidden");
      const noSig = cell.querySelector(".cam-no-signal");
      if (noSig) noSig.classList.remove("visible");
      // Cancel canvas animation
      if (cameraCanvases[id]) { cancelAnimationFrame(cameraCanvases[id]); delete cameraCanvases[id]; }
      // Clear canvas
      const canvas = cell.querySelector(".cam-canvas");
      if (canvas) { const ctx = canvas.getContext("2d"); ctx.clearRect(0, 0, canvas.width, canvas.height); }
      // Reset rec badge
      const rec = cell.querySelector(".cam-rec");
      if (rec) { rec.textContent = "● REC"; rec.style.color = ""; rec.style.animation = ""; }
    });
    // Show power prompt again
    const pp = document.getElementById("power-prompt");
    if (pp) pp.classList.add("visible");
    printWelcome();
    setThreat("LOW");
  }, 2000);
}

function cmdHoldOn() {
  printEmpty();
  printLine("  \"Hold on to your butts.\"  — Ray Arnold", "success");
  printEmpty();
}

function cmdClear() { output.innerHTML = ""; }

// ── Nedry ────────────────────────────────────────────────────
function triggerNedry() {
  nedryEl.classList.add("active");
  triggerAlertFlash();
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
  if (level === "HIGH")   threatValue.classList.add("danger");
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
    const rs = document.querySelector("#raptor-status .status-val");
    if (rs) { rs.textContent = "BREACH"; rs.className = "status-val offline"; }
    setTimeout(() => {
      printLine("  Breach contained. Fence segment re-energized.", "success");
      setThreat("MEDIUM");
      if (rs) { rs.textContent = "3 TRACKED"; rs.className = "status-val warn"; }
      raptorBreachActive = false;
    }, 8000);
  }
}
setInterval(raptorBreachEvent, 3000);

// ── Fence power fluctuation ───────────────────────────────────
setInterval(() => {
  document.querySelectorAll(".fence-fill").forEach(fill => {
    const current = parseInt(fill.style.width) || 100;
    const delta   = (Math.random() - 0.5) * 4;
    const newVal  = Math.min(100, Math.max(40, current + delta));
    fill.style.width = newVal + "%";
    fill.classList.toggle("warn", newVal < 80);
  });
}, 2500);

// ── Alert log ─────────────────────────────────────────────────
const alertMessages = [
  ["Motion — T-Rex Paddock perimeter", "ok"],
  ["Auth OK — Dr. Ellie Sattler",      "ok"],
  ["Fence test — Sector 3 passed",     "ok"],
  ["Power spike — Generator Bay",       "warn"],
  ["Unauthorized login attempt",        "warn"],
  ["Camera glitch — CAM-11",           "warn"],
];
function addRandomAlert() {
  const log = document.getElementById("alert-log");
  const msg = alertMessages[Math.floor(Math.random() * alertMessages.length)];
  const now  = new Date();
  const time = `${String(now.getHours()).padStart(2,"0")}:${String(now.getMinutes()).padStart(2,"0")}`;
  const div  = document.createElement("div");
  div.className = "alert-item " + msg[1];
  div.textContent = `[${time}] ${msg[0]}`;
  log.insertBefore(div, log.firstChild);
  while (log.children.length > 8) log.removeChild(log.lastChild);
}
setInterval(addRandomAlert, 18000);

// ── Keep input focused ────────────────────────────────────────
document.addEventListener("click", e => {
  if (!e.target.closest("#nedry")) input.focus();
});

// ── Left panel tab switching ──────────────────────────────────
document.querySelectorAll(".left-tab").forEach(tab => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".left-tab").forEach(t => t.classList.remove("active"));
    document.querySelectorAll(".tab-content").forEach(t => t.classList.remove("active"));
    tab.classList.add("active");
    document.getElementById("tab-" + tab.dataset.tab).classList.add("active");
  });
});
