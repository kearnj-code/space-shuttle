/* ============================================================
   SPACE SHUTTLE DISCOVERY — COCKPIT LOGIC
   OV-103 Interactive Systems
   ============================================================ */

// ── State ─────────────────────────────────────────────────────
const state = {
  apu:       [false, false, false],
  hyd:       [false, false, false],
  fuelCell:  [false, false, false],
  ecs:       false,
  oms:       { L: false, R: false },
  comm:      {},
  gpc:       [false, false, false, false, false],
  masterAlarm: false,
  missionStart: null,
  timerInterval: null,
  // Sequence engine
  activeSequence: null,
  seqStartTime: null,
  seqTimeouts: [],
};

// ── Logging ───────────────────────────────────────────────────
function log(msg, type = 'info') {
  const el = document.getElementById('logEntries');
  const now = new Date();
  const ts = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}:${String(now.getSeconds()).padStart(2,'0')}`;
  const entry = document.createElement('div');
  entry.className = `log-entry ${type}`;
  entry.textContent = `[${ts}] ${msg}`;
  el.appendChild(entry);
  el.scrollTop = el.scrollHeight;
  // Keep last 40 entries
  while (el.children.length > 40) el.removeChild(el.firstChild);
}

function updateHUD() {
  const apuOn = state.apu.some(Boolean);
  const hydOn = state.hyd.some(Boolean);
  const fcOn  = state.fuelCell.some(Boolean);

  const setStatus = (id, on, sys) => {
    const el = document.getElementById(id);
    el.querySelector('b').textContent = on ? 'ON' : 'OFF';
    el.classList.toggle('on', on);
  };
  setStatus('statusAPU',  state.apu.some(Boolean),  'APU');
  setStatus('statusHYD',  state.hyd.some(Boolean),  'HYD');
  setStatus('statusFUEL', state.fuelCell.some(Boolean), 'FUEL');
  setStatus('statusECS',  state.ecs, 'ECS');
  setStatus('statusOMS',  state.oms.L || state.oms.R, 'OMS');
  setStatus('statusCOMM', Object.values(state.comm).some(Boolean), 'COMM');
}

// ── APU ───────────────────────────────────────────────────────
function toggleAPU(unit) {
  AudioEngine.click('toggle');
  const idx = unit - 1;
  if (!state.apu[idx]) {
    // Power on
    state.apu[idx] = true;
    const sw = document.getElementById(`swAPU${unit}`);
    const ind = document.getElementById(`indAPU${unit}`);
    sw.dataset.state = 'on';
    ind.textContent = 'SPOOL';
    ind.className = 'indicator-light amber-on';
    log(`APU ${unit} — POWER ON, spooling up…`, 'warn');

    AudioEngine.apuSpoolUp(unit, () => {
      ind.textContent = 'RUN';
      ind.className = 'indicator-light on';
      ind.classList.add('led-active');
      log(`APU ${unit} — RUNNING  ✓`, 'info');
      AudioEngine.apuRunning(unit);
      updateHUD();
    });
  } else {
    // Power off
    state.apu[idx] = false;
    const sw = document.getElementById(`swAPU${unit}`);
    const ind = document.getElementById(`indAPU${unit}`);
    sw.dataset.state = 'off';
    ind.textContent = 'OFF';
    ind.className = 'indicator-light';
    AudioEngine.apuShutdown(unit);
    log(`APU ${unit} — SHUTDOWN`, 'warn');
    updateHUD();
  }
}

// ── Hydraulic ─────────────────────────────────────────────────
function toggleHydraulic(unit) {
  AudioEngine.click('toggle');
  const idx = unit - 1;
  if (!state.hyd[idx]) {
    state.hyd[idx] = true;
    const sw  = document.getElementById(`swHYD${unit}`);
    const ind = document.getElementById(`indHYD${unit}`);
    sw.dataset.state = 'on';
    ind.textContent = 'PRESS';
    ind.className = 'indicator-light amber-on';
    log(`HYD SYS ${unit} — MAIN PUMP ON, pressurizing…`, 'warn');

    AudioEngine.hydraulicPumpSpool(unit);
    setTimeout(() => {
      ind.textContent = 'NORM';
      ind.className = 'indicator-light on';
      const psiEl = document.getElementById(`hyd${unit}p`);
      if (psiEl) { psiEl.textContent = '3000 PSI'; }
      log(`HYD SYS ${unit} — NOMINAL  3000 PSI`, 'info');
      updateHUD();
    }, 2200);
  } else {
    state.hyd[idx] = false;
    const sw  = document.getElementById(`swHYD${unit}`);
    const ind = document.getElementById(`indHYD${unit}`);
    sw.dataset.state = 'off';
    ind.textContent = 'OFF';
    ind.className = 'indicator-light';
    const psiEl = document.getElementById(`hyd${unit}p`);
    if (psiEl) psiEl.textContent = '--- PSI';
    AudioEngine.click('toggle');
    log(`HYD SYS ${unit} — MAIN PUMP OFF`, 'warn');
    updateHUD();
  }
}

// ── Fuel Cells ────────────────────────────────────────────────
function toggleFuelCell(unit) {
  AudioEngine.click('toggle');
  const idx = unit - 1;
  if (!state.fuelCell[idx]) {
    state.fuelCell[idx] = true;
    const sw  = document.getElementById(`swFC${unit}`);
    const ind = document.getElementById(`indFC${unit}`);
    sw.dataset.state = 'on';
    ind.textContent = 'INIT';
    ind.className = 'indicator-light amber-on';
    log(`FUEL CELL ${unit} — REACTANTS OPEN, initializing…`, 'warn');
    AudioEngine.fuelCellActivate();
    setTimeout(() => {
      ind.textContent = 'ON';
      ind.className = 'indicator-light on';
      const vEl = document.getElementById(`fc${unit}v`);
      if (vEl) vEl.textContent = '28.0 V';
      log(`FUEL CELL ${unit} — ONLINE  28.0 V  ✓`, 'info');
      updateHUD();
    }, 1800);
  } else {
    state.fuelCell[idx] = false;
    const sw  = document.getElementById(`swFC${unit}`);
    const ind = document.getElementById(`indFC${unit}`);
    sw.dataset.state = 'off';
    ind.textContent = 'OFF';
    ind.className = 'indicator-light';
    const vEl = document.getElementById(`fc${unit}v`);
    if (vEl) vEl.textContent = '---';
    log(`FUEL CELL ${unit} — SHUTDOWN`, 'warn');
    updateHUD();
  }
}

// ── ECS ───────────────────────────────────────────────────────
function toggleECS() {
  AudioEngine.click('toggle');
  const sw  = document.getElementById('swECSFan');
  const ind = document.getElementById('indECSFan');
  state.ecs = !state.ecs;
  sw.dataset.state = state.ecs ? 'on' : 'off';
  if (state.ecs) {
    ind.textContent = 'ON';
    ind.className = 'indicator-light on';
    AudioEngine.ecsStart();
    log('ECS — CABIN FANS ON, airflow nominal', 'info');
    // Start mission timer on first power-on of any system
    startMissionTimer();
  } else {
    ind.textContent = 'OFF';
    ind.className = 'indicator-light';
    AudioEngine.ecsStop();
    log('ECS — CABIN FANS OFF', 'warn');
  }
  updateHUD();
}

// ── OMS ───────────────────────────────────────────────────────
function toggleOMS(side) {
  AudioEngine.click('push');
  const ind = document.getElementById(`indOMS${side}`);
  const pb  = document.getElementById(`pbOMS${side}`);
  state.oms[side] = !state.oms[side];
  if (state.oms[side]) {
    ind.textContent = 'ARM';
    ind.className = 'indicator-light amber-on';
    pb.classList.add('active');
    log(`OMS ${side} ENGINE — ARMED`, 'warn');
  } else {
    ind.textContent = 'OFF';
    ind.className = 'indicator-light';
    pb.classList.remove('active');
    log(`OMS ${side} ENGINE — SAFE`, 'info');
  }
  updateHUD();
}

function omsFire() {
  AudioEngine.click('push');
  if (!state.oms.L && !state.oms.R) {
    log('OMS FIRE — INHIBITED: no engine armed', 'alert');
    triggerMasterAlarm('OMS NOT ARMED');
    return;
  }
  const pb = document.getElementById('pbOMSFire');
  pb.classList.add('active');
  log('OMS — IGNITION SEQUENCE INITIATED', 'alert');
  AudioEngine.omsFire();
  setTimeout(() => {
    pb.classList.remove('active');
    log('OMS — BURN COMPLETE, engines safing', 'info');
  }, 1400);
}

// ── GPC ───────────────────────────────────────────────────────
function gpcPower(unit) {
  AudioEngine.click('push');
  const idx = unit - 1;
  const pb  = document.getElementById(`pbGPC${unit}`);
  const ind = document.getElementById(`indGPC${unit}`);
  state.gpc[idx] = !state.gpc[idx];
  if (state.gpc[idx]) {
    ind.textContent = 'BOOT';
    ind.className = 'indicator-light amber-on';
    pb.classList.add('pressed');
    log(`GPC ${unit} — POWER ON, loading flight software…`, 'system');
    AudioEngine.gpcBoot(unit);
    setTimeout(() => {
      ind.textContent = 'RDY';
      ind.className = 'indicator-light on';
      pb.classList.remove('pressed');
      log(`GPC ${unit} — READY  OPS 1  ✓`, 'system');
    }, 1200);
  } else {
    ind.textContent = 'OFF';
    ind.className = 'indicator-light';
    pb.classList.remove('pressed');
    log(`GPC ${unit} — POWERED DOWN`, 'warn');
  }
}

// ── COMM ──────────────────────────────────────────────────────
function toggleComm(swId, indId, label) {
  AudioEngine.click('toggle');
  const sw  = document.getElementById(swId);
  const ind = document.getElementById(indId);
  const on  = sw.dataset.state !== 'on';
  sw.dataset.state = on ? 'on' : 'off';
  state.comm[swId] = on;
  if (on) {
    ind.textContent = 'ON';
    ind.className = 'indicator-light on';
    AudioEngine.commActivate();
    log(`${label} — TRANSMITTER ON`, 'system');
  } else {
    ind.textContent = 'OFF';
    ind.className = 'indicator-light';
    log(`${label} — TRANSMITTER OFF`, 'info');
  }
  updateHUD();
}

// ── Generic toggle ────────────────────────────────────────────
function genericToggle(swId, indId, label, soundType) {
  const sw  = document.getElementById(swId);
  const ind = document.getElementById(indId);
  const on  = sw.dataset.state !== 'on';
  sw.dataset.state = on ? 'on' : 'off';

  if (soundType === 'rcs' || soundType === 'oms') {
    AudioEngine.click('toggle');
  } else if (soundType === 'ecs') {
    AudioEngine.rockerThunk();
  } else {
    AudioEngine.click('toggle');
  }

  if (on) {
    ind.textContent = 'ON';
    ind.className = 'indicator-light on';
    log(`${label} — ON`, 'info');
  } else {
    ind.textContent = 'OFF';
    ind.className = 'indicator-light';
    log(`${label} — OFF`, 'info');
  }
}

// ── Rocker switch ─────────────────────────────────────────────
function rockerClick(id, state, label) {
  AudioEngine.rockerThunk();
  const el = document.getElementById(id);
  el.dataset.state = state.toLowerCase();
  // Visual: activate correct half
  const tops = el.querySelectorAll('.rocker-top, .rocker-bot');
  tops.forEach(r => r.classList.remove('active'));
  // Find which half was clicked — determined by label match
  tops.forEach(r => {
    if (r.textContent.trim().toUpperCase() === state.toUpperCase()) {
      r.classList.add('active');
    }
  });
  log(`${label}`, 'info');
}

// ── Push buttons ──────────────────────────────────────────────
function pushClick(label) {
  AudioEngine.click('push');
  log(`${label} — ACTIVATED`, 'system');
}

// ── SRB / ET Separation ───────────────────────────────────────
function srbSeparate() {
  AudioEngine.separationBang();
  const pb = document.getElementById('pbSRBSep');
  pb.classList.add('pressed');
  log('SRB SEPARATION — PYROS FIRED', 'alert');
  setTimeout(() => pb.classList.remove('pressed'), 500);
}

function etSeparate() {
  AudioEngine.separationBang();
  const pb = document.getElementById('pbETSep');
  pb.classList.add('pressed');
  log('ET SEPARATION — PYROS FIRED', 'alert');
  setTimeout(() => pb.classList.remove('pressed'), 500);
}

function abortMode() {
  AudioEngine.startAlarm();
  const pb = document.getElementById('pbAbort');
  pb.classList.add('pressed');
  document.getElementById('masterAlarm').classList.add('alarming');
  log('⚠ ABORT MODE SELECTED — CREW ALERT', 'alert');
  state.masterAlarm = true;
}

// ── Master Alarm ──────────────────────────────────────────────
function triggerMasterAlarm(reason) {
  AudioEngine.startAlarm();
  document.getElementById('masterAlarm').classList.add('alarming');
  log(`⚠ MASTER ALARM — ${reason}`, 'alert');
  state.masterAlarm = true;
}

function silenceAlarm() {
  AudioEngine.stopAlarm();
  AudioEngine.click('push');
  document.getElementById('masterAlarm').classList.remove('alarming');
  if (state.masterAlarm) {
    log('MASTER ALARM — SILENCED', 'warn');
    state.masterAlarm = false;
  }
}

// ── Mission Elapsed Time ──────────────────────────────────────
function startMissionTimer() {
  if (state.missionStart) return;
  state.missionStart = Date.now();
  state.timerInterval = setInterval(updateTimer, 1000);
  log('MISSION ELAPSED TIME — STARTED', 'system');
}

function updateTimer() {
  const elapsed = Math.floor((Date.now() - state.missionStart) / 1000);
  const d  = Math.floor(elapsed / 86400);
  const h  = Math.floor((elapsed % 86400) / 3600);
  const m  = Math.floor((elapsed % 3600) / 60);
  const s  = elapsed % 60;
  document.getElementById('missionTimer').textContent =
    `MET: ${String(d).padStart(2,'0')}:${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}

// ── FDAI animation (idle drift) ───────────────────────────────
let fdaiAngle = 0;
function animateFDAI() {
  fdaiAngle += 0.003;
  const pitch = Math.sin(fdaiAngle * 0.7) * 2;
  const roll  = Math.sin(fdaiAngle * 1.1) * 1.5;
  const yaw   = Math.sin(fdaiAngle * 0.5) * 3;

  ['L','R'].forEach(s => {
    const sphere = document.getElementById(`fdaiSphere${s}`);
    if (sphere) {
      sphere.style.transform = `rotate(${roll}deg) translateY(${pitch * 0.5}px)`;
    }
  });

  document.getElementById('dispPitch').textContent =
    (pitch >= 0 ? '+' : '') + pitch.toFixed(1).padStart(6,' ');
  document.getElementById('dispRoll').textContent =
    (roll >= 0 ? '+' : '') + roll.toFixed(1).padStart(6,' ');
  document.getElementById('dispYaw').textContent =
    (yaw >= 0 ? '+' : '') + yaw.toFixed(1).padStart(6,' ');

  requestAnimationFrame(animateFDAI);
}

// ── TACAN ─────────────────────────────────────────────────────
function toggleTACAN(unit) {
  AudioEngine.click('toggle');
  const sw  = document.getElementById(`swTACAN${unit}`);
  const ind = document.getElementById(`indTACAN${unit}`);
  const on  = sw.dataset.state !== 'on';
  sw.dataset.state = on ? 'on' : 'off';
  if (on) {
    ind.textContent = 'ACQ';
    ind.className = 'indicator-light amber-on';
    log(`TACAN ${unit} — ACQUIRING…`, 'system');
    AudioEngine.tacanLock();
    setTimeout(() => {
      ind.textContent = 'LK';
      ind.className = 'indicator-light on';
      AudioEngine.tacanLock();
      log(`TACAN ${unit} — LOCKED  ✓`, 'system');
    }, 1600);
  } else {
    ind.textContent = 'OFF';
    ind.className = 'indicator-light';
    log(`TACAN ${unit} — OFF`, 'info');
  }
}

// ── Air Data Probes ───────────────────────────────────────────
function deployProbe(side) {
  AudioEngine.click('push');
  const ind = document.getElementById(`indProbe${side}`);
  const pb  = document.getElementById(`pbProbe${side}`);
  ind.textContent = 'EXTD';
  ind.className = 'indicator-light amber-on';
  pb.classList.add('pressed');
  log(`AIR DATA PROBE ${side} — EXTENDING`, 'warn');
  AudioEngine.probeExtend();
  setTimeout(() => {
    ind.textContent = 'RDY';
    ind.className = 'indicator-light on';
    pb.classList.remove('pressed');
    log(`AIR DATA PROBE ${side} — EXTENDED  ✓`, 'info');
  }, 1200);
}

// ── Flash Evaporator ──────────────────────────────────────────
function toggleFES() {
  AudioEngine.click('toggle');
  const sw  = document.getElementById('swFES');
  const ind = document.getElementById('indFES');
  const on  = sw.dataset.state !== 'on';
  sw.dataset.state = on ? 'on' : 'off';
  if (on) {
    ind.textContent = 'ON';
    ind.className = 'indicator-light on';
    AudioEngine.pressurizationHiss(2.0);
    log('FLASH EVAPORATOR SYS A — ON, cooling active', 'info');
  } else {
    ind.textContent = 'OFF';
    ind.className = 'indicator-light';
    log('FLASH EVAPORATOR SYS A — OFF', 'info');
  }
}

// ── Brake Test ────────────────────────────────────────────────
function brakeTest(sys) {
  AudioEngine.click('push');
  const el = document.getElementById(`dispBrk${sys}`);
  el.textContent = 'TEST…';
  log(`HYD BRAKE SYS ${sys} — PRESSURE TEST`, 'info');
  setTimeout(() => {
    const ok = state.hyd[sys - 1];
    el.textContent = ok ? '3000 PSI' : '--- PSI';
    log(`HYD BRAKE SYS ${sys} — ${ok ? '3000 PSI  ✓' : 'NO HYD PRESSURE'}`, ok ? 'info' : 'alert');
    if (!ok) triggerMasterAlarm(`HYD BRK SYS ${sys} LOW PRESS`);
  }, 800);
}

// ── SSME Start ────────────────────────────────────────────────
function ssmeStartSeq() {
  AudioEngine.click('push');
  const ind = document.getElementById('indSSME');
  ind.textContent = 'START';
  ind.className = 'indicator-light amber-on';
  log('SSME START SEQUENCE — T-6.6 SEC', 'alert');

  // Staggered engine ignition
  [0, 120, 240].forEach((ms, i) => {
    setTimeout(() => {
      log(`SSME ${i + 1} — IGNITION`, 'alert');
    }, ms);
  });

  AudioEngine.ssmeStart();
  setTimeout(() => {
    ind.textContent = 'RUN';
    ind.className = 'indicator-light on';
    log('SSME 1/2/3 — MAINSTAGE  ✓', 'info');
  }, 1500);
}

// ── SRB Ignite ────────────────────────────────────────────────
function srbIgnite() {
  AudioEngine.separationBang();
  const ind = document.getElementById('indSRBIgn');
  const pb  = document.getElementById('pbSRBIgnite');
  ind.textContent = 'IGN';
  ind.className = 'indicator-light red-on';
  pb.classList.add('pressed');
  log('⚠ SRB IGNITION — LIFTOFF', 'alert');
  startMissionTimer();
  setTimeout(() => { pb.classList.remove('pressed'); }, 600);
}

// ═══════════════════════════════════════════════════════════════
// SEQUENCE ENGINE
// ═══════════════════════════════════════════════════════════════
function updateSeqDisplay(header, step, next) {
  document.getElementById('seqStatusHeader').textContent = header;
  document.getElementById('seqStep').textContent = step;
  document.getElementById('seqNext').textContent = next || '---';
  if (state.seqStartTime) {
    const elapsed = Math.floor((Date.now() - state.seqStartTime) / 1000);
    document.getElementById('seqTime').textContent =
      `T+${String(Math.floor(elapsed / 60)).padStart(2,'0')}:${String(elapsed % 60).padStart(2,'0')}`;
  }
}

function runSequence(name, steps) {
  if (state.activeSequence) {
    log(`SEQUENCE BUSY — ${state.activeSequence} ACTIVE`, 'alert');
    return;
  }
  state.activeSequence = name;
  state.seqStartTime = Date.now();
  updateSeqDisplay(name, 'INIT', steps[0]?.label || '---');
  log(`SEQUENCE START — ${name}`, 'system');

  steps.forEach((step, i) => {
    const tid = setTimeout(() => {
      step.action();
      updateSeqDisplay(
        name,
        step.label,
        steps[i + 1]?.label || 'COMPLETE'
      );
      if (i === steps.length - 1) {
        setTimeout(() => {
          state.activeSequence = null;
          updateSeqDisplay('SEQUENCE COMPLETE', '---', '---');
          log(`SEQUENCE COMPLETE — ${name}`, 'system');
        }, 1500);
      }
    }, step.delay);
    state.seqTimeouts.push(tid);
  });
}

function abortSequence() {
  AudioEngine.click('push');
  if (!state.activeSequence) { log('NO ACTIVE SEQUENCE', 'warn'); return; }
  state.seqTimeouts.forEach(clearTimeout);
  state.seqTimeouts = [];
  log(`SEQUENCE ABORT — ${state.activeSequence}`, 'alert');
  state.activeSequence = null;
  updateSeqDisplay('SEQUENCE ABORTED', '---', '---');
}

// ── Launch Sequence (T-31 auto) ────────────────────────────────
function runLaunchSequence() {
  AudioEngine.click('push');
  const ind = document.getElementById('indAutoSeq');
  ind.textContent = 'RUN';
  ind.className = 'indicator-light amber-on';

  runSequence('T-31 AUTO LAUNCH SEQUENCE', [
    { delay:    0, label: 'SEQUENCE START',      action: () => { log('T-31: AUTO SEQUENCE START', 'alert'); AudioEngine.countdownTone(); } },
    { delay: 1000, label: 'APU 1 START',         action: () => { if (!state.apu[0]) toggleAPU(1); } },
    { delay: 2500, label: 'APU 2 START',         action: () => { if (!state.apu[1]) toggleAPU(2); } },
    { delay: 4000, label: 'APU 3 START',         action: () => { if (!state.apu[2]) toggleAPU(3); } },
    { delay: 8000, label: 'HYD 1 PRESS',         action: () => { if (!state.hyd[0]) toggleHydraulic(1); } },
    { delay: 9000, label: 'HYD 2 PRESS',         action: () => { if (!state.hyd[1]) toggleHydraulic(2); } },
    { delay:10000, label: 'HYD 3 PRESS',         action: () => { if (!state.hyd[2]) toggleHydraulic(3); } },
    { delay:13000, label: 'GPC FLIGHT PROG',     action: () => { log('T-18: GPC TRANSITION FLIGHT PROGRAM', 'system'); AudioEngine.gpcBoot(1); } },
    { delay:15000, label: 'HATCH SEAL CHECK',    action: () => { AudioEngine.pressurizationHiss(1.5); log('T-16: CREW MODULE HATCH SEALED', 'info'); } },
    { delay:18000, label: 'LOX/LH2 ARM',         action: () => { log('T-13: PROPELLANT LOADING COMPLETE', 'info'); AudioEngine.rockerThunk(); } },
    { delay:20000, label: 'T-10 COUNTDOWN',      action: () => { log('T-10: TERMINAL COUNTDOWN', 'alert'); AudioEngine.countdownTone(); } },
    { delay:21000, label: 'T-09',                action: () => { AudioEngine.countdownTone(); log('T-9', 'alert'); } },
    { delay:22000, label: 'T-08',                action: () => { AudioEngine.countdownTone(); log('T-8', 'alert'); } },
    { delay:23000, label: 'T-07',                action: () => { AudioEngine.countdownTone(); log('T-7', 'alert'); } },
    { delay:24000, label: 'T-06',                action: () => { AudioEngine.countdownTone(); log('T-6 — SSME START', 'alert'); ssmeStartSeq(); } },
    { delay:25000, label: 'T-05',                action: () => { AudioEngine.countdownTone(); log('T-5', 'alert'); } },
    { delay:26000, label: 'T-04',                action: () => { AudioEngine.countdownTone(); log('T-4', 'alert'); } },
    { delay:27000, label: 'T-03',                action: () => { AudioEngine.countdownTone(); log('T-3', 'alert'); } },
    { delay:28000, label: 'T-02',                action: () => { AudioEngine.countdownTone(); log('T-2', 'alert'); } },
    { delay:29000, label: 'T-01',                action: () => { AudioEngine.countdownTone(); log('T-1', 'alert'); } },
    { delay:30000, label: 'LIFTOFF',             action: () => { AudioEngine.countdownTone(true); srbIgnite(); ind.textContent = 'CMPLT'; ind.className = 'indicator-light on'; } },
  ]);
}

// ── OMS-1 Insertion Burn Sequence ─────────────────────────────
function runOMS1Sequence() {
  AudioEngine.click('push');
  const ind = document.getElementById('indOMS1Seq');
  ind.textContent = 'RUN';
  ind.className = 'indicator-light amber-on';

  runSequence('OMS-1 INSERTION BURN', [
    { delay:    0, label: 'OMS PRESTART',    action: () => { log('OMS-1: PRESTART CHECKLIST', 'system'); AudioEngine.rockerThunk(); } },
    { delay:  800, label: 'ARM L ENGINE',    action: () => { if (!state.oms.L) toggleOMS('L'); } },
    { delay: 1600, label: 'ARM R ENGINE',    action: () => { if (!state.oms.R) toggleOMS('R'); } },
    { delay: 2800, label: 'PROP PRESS',      action: () => { AudioEngine.pressurizationHiss(1.2); log('OMS-1: PROPELLANT PRESSURIZED', 'info'); } },
    { delay: 4200, label: 'IGNITION',        action: () => { omsFire(); log('OMS-1: IGNITION  BURN NOMINAL', 'alert'); } },
    { delay: 5800, label: 'BURN +30s',       action: () => { log('OMS-1: BURN +30s  ΔV NOMINAL', 'info'); } },
    { delay: 7200, label: 'CUTOFF',          action: () => { log('OMS-1: CUTOFF  ORBIT INSERTION CONFIRMED', 'info'); AudioEngine.rockerThunk(); ind.textContent = 'CMPLT'; ind.className = 'indicator-light on'; } },
  ]);
}

// ── Deorbit Sequence ──────────────────────────────────────────
function runDeorbitSequence() {
  AudioEngine.click('push');
  const ind = document.getElementById('indDeorbit');
  ind.textContent = 'RUN';
  ind.className = 'indicator-light amber-on';

  runSequence('DEORBIT / ENTRY SEQUENCE', [
    { delay:    0, label: 'DEORBIT INIT',    action: () => { log('DEORBIT: SEQUENCE INITIATED', 'system'); AudioEngine.click('toggle'); } },
    { delay:  800, label: 'OMS ARM',         action: () => { if (!state.oms.L) toggleOMS('L'); if (!state.oms.R) toggleOMS('R'); } },
    { delay: 2000, label: 'DEORBIT BURN',    action: () => { omsFire(); log('DEORBIT: OMS BURN  -ΔV NOMINAL', 'alert'); } },
    { delay: 3500, label: 'ET JETT',         action: () => { log('DEORBIT: ET JETTISON CONFIRMED', 'info'); } },
    { delay: 5000, label: 'ENTRY ATTITUDE',  action: () => { log('DEORBIT: ENTRY ATTITUDE HOLD', 'info'); AudioEngine.rockerThunk(); } },
    { delay: 7000, label: 'AIR DATA PROBES', action: () => { deployProbe('L'); setTimeout(() => deployProbe('R'), 800); } },
    { delay: 9500, label: 'TACAN ACQUIRE',   action: () => { toggleTACAN(1); } },
    { delay:11000, label: 'FES COOLANT',     action: () => { if (document.getElementById('swFES').dataset.state !== 'on') toggleFES(); } },
    { delay:13000, label: 'NWS ARM',         action: () => { const sw = document.getElementById('swNWS'); if (sw.dataset.state !== 'on') { AudioEngine.click('toggle'); sw.dataset.state = 'on'; document.getElementById('indNWS').textContent = 'ON'; document.getElementById('indNWS').className = 'indicator-light on'; } log('LANDING: NWS ARMED', 'info'); } },
    { delay:14500, label: 'ANTI-SKID',       action: () => { genericToggle('swAntiSkid','indAntiSkid','ANTI-SKID ARM','click'); } },
    { delay:15500, label: 'LANDING LIGHTS',  action: () => { rockerClick('rkLandLights','ON','LANDING LIGHTS ON'); log('LANDING: LIGHTS ON', 'info'); } },
    { delay:16500, label: 'TOUCHDOWN',       action: () => { AudioEngine.separationBang(); log('TOUCHDOWN — WHEEL STOP', 'alert'); ind.textContent = 'CMPLT'; ind.className = 'indicator-light on'; } },
  ]);
}

// ── Auto Power-Up Sequence ─────────────────────────────────────
function runPowerUpSequence() {
  AudioEngine.click('push');

  runSequence('AUTO POWER-UP CHECKLIST', [
    { delay:    0, label: 'FC 1 REACTANTS',  action: () => { if (!state.fuelCell[0]) toggleFuelCell(1); } },
    { delay:  600, label: 'FC 2 REACTANTS',  action: () => { if (!state.fuelCell[1]) toggleFuelCell(2); } },
    { delay: 1200, label: 'FC 3 REACTANTS',  action: () => { if (!state.fuelCell[2]) toggleFuelCell(3); } },
    { delay: 3000, label: 'GPC 1-5 POWER',   action: () => { [1,2,3,4,5].forEach((n,i) => setTimeout(() => { if (!state.gpc[n-1]) gpcPower(n); }, i * 300)); } },
    { delay: 5500, label: 'APU 1 START',     action: () => { if (!state.apu[0]) toggleAPU(1); } },
    { delay: 6000, label: 'APU 2 START',     action: () => { if (!state.apu[1]) toggleAPU(2); } },
    { delay: 6500, label: 'APU 3 START',     action: () => { if (!state.apu[2]) toggleAPU(3); } },
    { delay:10500, label: 'HYD 1-3 PRESS',   action: () => { [1,2,3].forEach((n,i) => setTimeout(() => { if (!state.hyd[n-1]) toggleHydraulic(n); }, i * 500)); } },
    { delay:13500, label: 'ECS FAN ON',      action: () => { if (!state.ecs) toggleECS(); } },
    { delay:14500, label: 'S-BAND XMTR',     action: () => { toggleComm('swSBand1','indSBand1','S-BAND XMTR 1'); } },
    { delay:15500, label: 'POWER UP CMPLT',  action: () => { log('AUTO POWER-UP COMPLETE — ALL SYSTEMS NOMINAL', 'system'); } },
  ]);
}

// ── Emergency Power Down ──────────────────────────────────────
function runEmergencyPowerDown() {
  AudioEngine.startAlarm();
  document.getElementById('masterAlarm').classList.add('alarming');
  state.masterAlarm = true;

  abortSequence();
  runSequence('EMERGENCY POWER DOWN', [
    { delay:    0, label: 'EMERG INIT',      action: () => { log('⚠ EMERGENCY POWER DOWN INITIATED', 'alert'); } },
    { delay:  200, label: 'APU 1 SHUTDOWN',  action: () => { if (state.apu[0]) toggleAPU(1); } },
    { delay:  400, label: 'APU 2 SHUTDOWN',  action: () => { if (state.apu[1]) toggleAPU(2); } },
    { delay:  600, label: 'APU 3 SHUTDOWN',  action: () => { if (state.apu[2]) toggleAPU(3); } },
    { delay: 1200, label: 'FC SHUTDOWN',     action: () => { [1,2,3].forEach(n => { if (state.fuelCell[n-1]) toggleFuelCell(n); }); } },
    { delay: 2000, label: 'ECS OFF',         action: () => { if (state.ecs) toggleECS(); } },
    { delay: 2500, label: 'PWR DOWN CMPLT',  action: () => { log('EMERGENCY POWER DOWN COMPLETE', 'alert'); } },
  ]);
}

// ── Init ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  animateFDAI();
  log('OV-103 DISCOVERY — FLIGHT DECK POWER APPLIED', 'system');
  log('READY FOR PRE-LAUNCH CHECKLIST', 'info');

  document.querySelectorAll('.rocker-switch').forEach(rk => {
    const initState = rk.dataset.state;
    if (initState) {
      rk.querySelectorAll('.rocker-top, .rocker-bot').forEach(half => {
        if (half.textContent.trim().toLowerCase() === initState.toLowerCase()) {
          half.classList.add('active');
        }
      });
    }
  });
});
