/* ============================================================
   SPACE SHUTTLE DISCOVERY — COCKPIT LOGIC
   OV-103 Interactive Systems
   ============================================================ */

// ── State ─────────────────────────────────────────────────────
const state = {
  apu:       [false, false, false],   // APU 1-3
  hyd:       [false, false, false],   // HYD 1-3
  fuelCell:  [false, false, false],   // FC 1-3
  ecs:       false,
  oms:       { L: false, R: false },
  comm:      {},
  gpc:       [false, false, false, false, false],
  masterAlarm: false,
  missionStart: null,
  timerInterval: null,
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

// ── Init ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  animateFDAI();
  log('OV-103 DISCOVERY — FLIGHT DECK POWER APPLIED', 'system');
  log('READY FOR PRE-LAUNCH CHECKLIST', 'info');

  // Set initial rocker active states
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
