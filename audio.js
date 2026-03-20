/* ============================================================
   SPACE SHUTTLE DISCOVERY — AUDIO ENGINE v2
   Web Audio API — Procedural sound generation
   APU/turbine sounds use AM-modulated noise (whirring), not oscillators
   ============================================================ */

const AudioEngine = (() => {
  let ctx = null;
  let masterGain = null;

  function init() {
    if (ctx) return;
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    masterGain = ctx.createGain();
    masterGain.gain.value = 0.7;
    masterGain.connect(ctx.destination);
  }

  function resume() {
    if (ctx && ctx.state === 'suspended') ctx.resume();
  }

  // ── Noise buffer factory ─────────────────────────────────────
  function makeNoise(seconds) {
    const buf = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  // ── Amplitude modulation helper ──────────────────────────────
  // Connects an oscillator (as AM source) to a VCA gain param
  // with a DC offset of 1 so gain swings between (1-depth) and (1+depth)
  function connectAM(amOsc, vcaGain, depth) {
    const dc = ctx.createConstantSource();
    dc.offset.value = 1.0;
    dc.connect(vcaGain.gain);
    dc.start();

    const depthGain = ctx.createGain();
    depthGain.gain.value = depth;
    amOsc.connect(depthGain);
    depthGain.connect(vcaGain.gain);
    return dc; // caller stops this
  }

  // ── Mechanical click / toggle snap ──────────────────────────
  function click(type = 'toggle') {
    init(); resume();
    const t = ctx.currentTime;

    const noise = ctx.createBufferSource();
    noise.buffer = makeNoise(0.06);

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = type === 'push' ? 2200 : 1400;
    filter.Q.value = 0.8;

    const env = ctx.createGain();
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(0.35, t + 0.002);
    env.gain.exponentialRampToValueAtTime(0.001, t + 0.05);

    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(type === 'push' ? 180 : 120, t);
    osc.frequency.exponentialRampToValueAtTime(60, t + 0.04);
    const oscGain = ctx.createGain();
    oscGain.gain.setValueAtTime(0.25, t);
    oscGain.gain.exponentialRampToValueAtTime(0.001, t + 0.04);

    noise.connect(filter); filter.connect(env);
    osc.connect(oscGain);
    env.connect(masterGain);
    oscGain.connect(masterGain);
    noise.start(t); noise.stop(t + 0.1);
    osc.start(t); osc.stop(t + 0.06);
  }

  // ── Rocker switch thunk ──────────────────────────────────────
  function rockerThunk() {
    init(); resume();
    const t = ctx.currentTime;
    const noise = ctx.createBufferSource();
    noise.buffer = makeNoise(0.08);
    const filt = ctx.createBiquadFilter();
    filt.type = 'lowpass';
    filt.frequency.value = 900;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.3, t);
    env.gain.exponentialRampToValueAtTime(0.001, t + 0.07);
    noise.connect(filt); filt.connect(env); env.connect(masterGain);
    noise.start(t); noise.stop(t + 0.1);
  }

  // ── APU spool-up (AM noise — whirring turbine, not organ) ────
  // Key technique: white noise × AM oscillator sweeping 15→280 Hz
  // gives the characteristic "wrrrRRRRR" spinning sound.
  // Bandpass filter also sweeps up adding turbine character.
  function apuSpoolUp(unit = 1, cb) {
    init(); resume();
    const t = ctx.currentTime;
    const dur = 4.0;

    // ── Layer 1: AM-modulated noise (main whirring body) ────────
    const noise1 = ctx.createBufferSource();
    noise1.buffer = makeNoise(dur + 0.2);

    // Bandpass sweeps from low rumble to turbine mid frequencies
    const bp1 = ctx.createBiquadFilter();
    bp1.type = 'bandpass';
    bp1.frequency.setValueAtTime(60, t);
    bp1.frequency.exponentialRampToValueAtTime(900, t + dur * 0.85);
    bp1.frequency.linearRampToValueAtTime(850, t + dur);
    bp1.Q.value = 3.0;

    // VCA for AM
    const vca1 = ctx.createGain();
    vca1.gain.value = 0; // driven by AM

    // AM oscillator: rotation rate sweeps from 15 Hz to 280 Hz
    // This gives the "blade chop" / whirring sensation
    const amOsc1 = ctx.createOscillator();
    amOsc1.type = 'sine';
    amOsc1.frequency.setValueAtTime(15, t);
    amOsc1.frequency.exponentialRampToValueAtTime(280, t + dur * 0.88);
    amOsc1.frequency.linearRampToValueAtTime(265, t + dur);

    const dc1 = connectAM(amOsc1, vca1, 0.85);

    // Overall envelope
    const env1 = ctx.createGain();
    env1.gain.setValueAtTime(0, t);
    env1.gain.linearRampToValueAtTime(0.18, t + 0.15);
    env1.gain.linearRampToValueAtTime(0.22, t + dur * 0.7);
    env1.gain.linearRampToValueAtTime(0.20, t + dur);

    noise1.connect(bp1); bp1.connect(vca1); vca1.connect(env1);

    // ── Layer 2: High-frequency rush (air intake noise) ─────────
    const noise2 = ctx.createBufferSource();
    noise2.buffer = makeNoise(dur + 0.2);

    const hp2 = ctx.createBiquadFilter();
    hp2.type = 'highpass';
    hp2.frequency.setValueAtTime(400, t);
    hp2.frequency.exponentialRampToValueAtTime(3500, t + dur);

    const env2 = ctx.createGain();
    env2.gain.setValueAtTime(0, t);
    env2.gain.linearRampToValueAtTime(0.03, t + 0.4);
    env2.gain.linearRampToValueAtTime(0.07, t + dur * 0.6);
    env2.gain.linearRampToValueAtTime(0.05, t + dur);

    noise2.connect(hp2); hp2.connect(env2);

    // ── Layer 3: Low mechanical rumble (structure vibration) ────
    const noise3 = ctx.createBufferSource();
    noise3.buffer = makeNoise(dur + 0.2);

    const lp3 = ctx.createBiquadFilter();
    lp3.type = 'lowpass';
    lp3.frequency.value = 120;

    const env3 = ctx.createGain();
    env3.gain.setValueAtTime(0.08, t);
    env3.gain.linearRampToValueAtTime(0.04, t + dur * 0.5);
    env3.gain.exponentialRampToValueAtTime(0.001, t + dur * 0.9);

    noise3.connect(lp3); lp3.connect(env3);

    // ── Connect all to master ────────────────────────────────────
    env1.connect(masterGain);
    env2.connect(masterGain);
    env3.connect(masterGain);

    noise1.start(t); noise1.stop(t + dur + 0.3);
    noise2.start(t); noise2.stop(t + dur + 0.3);
    noise3.start(t); noise3.stop(t + dur + 0.3);
    amOsc1.start(t); amOsc1.stop(t + dur + 0.3);
    dc1.stop(t + dur + 0.3);

    if (cb) setTimeout(cb, (dur + 0.2) * 1000);
  }

  // ── APU running steady (AM noise at settled RPM) ─────────────
  const apuNodes = {};
  function apuRunning(unit = 1) {
    init(); resume();
    if (apuNodes[unit]) return;
    const t = ctx.currentTime;

    // Steady AM-noise turbine hum
    const noiseSrc = ctx.createBufferSource();
    noiseSrc.buffer = makeNoise(4);
    noiseSrc.loop = true;

    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 900 + unit * 40;
    bp.Q.value = 2.5;

    const vca = ctx.createGain();
    vca.gain.value = 0;

    const amOsc = ctx.createOscillator();
    amOsc.type = 'sine';
    amOsc.frequency.value = 265 + unit * 8; // settled RPM

    const dc = connectAM(amOsc, vca, 0.6);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.07, t + 0.4);

    // Air rush layer
    const airSrc = ctx.createBufferSource();
    airSrc.buffer = makeNoise(4);
    airSrc.loop = true;
    const airHp = ctx.createBiquadFilter();
    airHp.type = 'highpass';
    airHp.frequency.value = 3000;
    const airGain = ctx.createGain();
    airGain.gain.setValueAtTime(0, t);
    airGain.gain.linearRampToValueAtTime(0.04, t + 0.4);

    noiseSrc.connect(bp); bp.connect(vca); vca.connect(gain);
    airSrc.connect(airHp); airHp.connect(airGain);
    gain.connect(masterGain);
    airGain.connect(masterGain);

    noiseSrc.start(t); airSrc.start(t);
    amOsc.start(t);

    apuNodes[unit] = { noiseSrc, airSrc, amOsc, gain, airGain, dc };
  }

  function apuShutdown(unit = 1) {
    if (!apuNodes[unit]) return;
    const { noiseSrc, airSrc, amOsc, gain, airGain, dc } = apuNodes[unit];
    const t = ctx.currentTime;

    // Wind down
    gain.gain.linearRampToValueAtTime(0, t + 2.5);
    airGain.gain.linearRampToValueAtTime(0, t + 2.5);
    noiseSrc.stop(t + 2.7);
    airSrc.stop(t + 2.7);
    amOsc.stop(t + 2.7);
    dc.stop(t + 2.7);
    delete apuNodes[unit];
  }

  // ── Hydraulic pump spool (AM noise, not oscillator) ──────────
  function hydraulicPumpSpool(unit = 1) {
    init(); resume();
    const t = ctx.currentTime;
    const dur = 2.2;

    // AM noise for electric motor whirring up
    const noise = ctx.createBufferSource();
    noise.buffer = makeNoise(dur + 0.2);

    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(80, t);
    bp.frequency.exponentialRampToValueAtTime(600, t + dur * 0.75);
    bp.frequency.linearRampToValueAtTime(580, t + dur);
    bp.Q.value = 2.5;

    const vca = ctx.createGain();
    vca.gain.value = 0;

    const amOsc = ctx.createOscillator();
    amOsc.type = 'sine';
    amOsc.frequency.setValueAtTime(20, t);
    amOsc.frequency.exponentialRampToValueAtTime(120, t + dur * 0.8);
    amOsc.frequency.linearRampToValueAtTime(115, t + dur);

    const dc = connectAM(amOsc, vca, 0.7);

    const env = ctx.createGain();
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(0.16, t + 0.18);
    env.gain.linearRampToValueAtTime(0.13, t + dur);

    // Fluid hiss
    const fluidNoise = ctx.createBufferSource();
    fluidNoise.buffer = makeNoise(dur + 0.2);
    const fluidFilt = ctx.createBiquadFilter();
    fluidFilt.type = 'bandpass';
    fluidFilt.frequency.setValueAtTime(500, t);
    fluidFilt.frequency.linearRampToValueAtTime(1200, t + dur);
    fluidFilt.Q.value = 1.0;
    const fluidGain = ctx.createGain();
    fluidGain.gain.setValueAtTime(0, t);
    fluidGain.gain.linearRampToValueAtTime(0.05, t + 0.3);
    fluidGain.gain.linearRampToValueAtTime(0.04, t + dur);

    noise.connect(bp); bp.connect(vca); vca.connect(env);
    fluidNoise.connect(fluidFilt); fluidFilt.connect(fluidGain);
    env.connect(masterGain);
    fluidGain.connect(masterGain);

    noise.start(t); noise.stop(t + dur + 0.3);
    fluidNoise.start(t); fluidNoise.stop(t + dur + 0.3);
    amOsc.start(t); amOsc.stop(t + dur + 0.3);
    dc.stop(t + dur + 0.3);
  }

  // ── Fuel cell activation ─────────────────────────────────────
  function fuelCellActivate() {
    init(); resume();
    const t = ctx.currentTime;
    for (let i = 0; i < 3; i++) {
      const delay = i * 0.18;
      const n = ctx.createBufferSource();
      n.buffer = makeNoise(0.05);
      const g = ctx.createGain(); g.gain.value = 0.2;
      const f = ctx.createBiquadFilter();
      f.type = 'highpass'; f.frequency.value = 1200;
      n.connect(f); f.connect(g); g.connect(masterGain);
      n.start(t + delay);
    }
    const hum = ctx.createOscillator();
    hum.type = 'sine'; hum.frequency.value = 60;
    const hg = ctx.createGain();
    hg.gain.setValueAtTime(0, t);
    hg.gain.linearRampToValueAtTime(0.04, t + 0.5);
    hum.connect(hg); hg.connect(masterGain);
    hum.start(t); hum.stop(t + 1.5);
  }

  // ── ECS / cabin fans ─────────────────────────────────────────
  const ecsNode = {};
  function ecsStart() {
    init(); resume();
    if (ecsNode.running) return;
    const t = ctx.currentTime;
    const n = ctx.createBufferSource();
    n.buffer = makeNoise(3); n.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass'; bp.frequency.value = 600; bp.Q.value = 0.7;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.06, t + 1.2);
    n.connect(bp); bp.connect(g); g.connect(masterGain);
    n.start(t);
    ecsNode.src = n; ecsNode.gain = g; ecsNode.running = true;
  }
  function ecsStop() {
    if (!ecsNode.running) return;
    const t = ctx.currentTime;
    ecsNode.gain.gain.linearRampToValueAtTime(0, t + 1.0);
    ecsNode.src.stop(t + 1.1);
    ecsNode.running = false;
  }

  // ── OMS engine fire burst ─────────────────────────────────────
  function omsFire() {
    init(); resume();
    const t = ctx.currentTime;
    const dur = 1.4;
    const n = ctx.createBufferSource();
    n.buffer = makeNoise(dur + 0.2);
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 80;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 3000;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(0.5, t + 0.1);
    env.gain.linearRampToValueAtTime(0.4, t + dur * 0.7);
    env.gain.linearRampToValueAtTime(0, t + dur);
    n.connect(hp); hp.connect(lp); lp.connect(env); env.connect(masterGain);
    n.start(t); n.stop(t + dur + 0.3);
  }

  // ── SSME main engine start (3-engine roar) ────────────────────
  function ssmeStart() {
    init(); resume();
    const t = ctx.currentTime;
    const dur = 6.0;

    // Three-engine ignition: staggered by 120ms each
    for (let eng = 0; eng < 3; eng++) {
      const delay = eng * 0.12;

      const n = ctx.createBufferSource();
      n.buffer = makeNoise(dur);
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(300, t + delay);
      lp.frequency.exponentialRampToValueAtTime(2500, t + delay + 1.5);
      lp.frequency.linearRampToValueAtTime(2000, t + dur);

      const env = ctx.createGain();
      env.gain.setValueAtTime(0, t + delay);
      env.gain.linearRampToValueAtTime(0.22, t + delay + 0.4);
      env.gain.linearRampToValueAtTime(0.20, t + dur);

      // Low rumble adds to body shake feel
      const rumble = ctx.createBiquadFilter();
      rumble.type = 'lowpass';
      rumble.frequency.value = 80;
      const rumbleGain = ctx.createGain();
      rumbleGain.gain.value = 0.5;

      const n2 = ctx.createBufferSource();
      n2.buffer = makeNoise(dur);
      n2.connect(rumble); rumble.connect(rumbleGain); rumbleGain.connect(env);
      n.connect(lp); lp.connect(env); env.connect(masterGain);

      n.start(t + delay); n.stop(t + dur + 0.3);
      n2.start(t + delay); n2.stop(t + dur + 0.3);
    }
  }

  // ── GPC boot beep sequence ────────────────────────────────────
  function gpcBoot(unit = 1) {
    init(); resume();
    const t = ctx.currentTime;
    const freqs = [880, 1100, 1320, 1047];
    freqs.forEach((f, i) => {
      const osc = ctx.createOscillator();
      osc.type = 'square'; osc.frequency.value = f;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t + i * 0.08);
      g.gain.linearRampToValueAtTime(0.08, t + i * 0.08 + 0.01);
      g.gain.linearRampToValueAtTime(0, t + i * 0.08 + 0.05);
      osc.connect(g); g.connect(masterGain);
      osc.start(t + i * 0.08); osc.stop(t + i * 0.08 + 0.07);
    });
  }

  // ── Comm system activate ─────────────────────────────────────
  function commActivate() {
    init(); resume();
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(2400, t);
    osc.frequency.exponentialRampToValueAtTime(1200, t + 0.3);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.12, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    osc.connect(g); g.connect(masterGain);
    osc.start(t); osc.stop(t + 0.35);
  }

  // ── Countdown tone (T-10 each second) ────────────────────────
  function countdownTone(final = false) {
    init(); resume();
    const t = ctx.currentTime;
    const freq = final ? 1200 : 880;
    const dur  = final ? 0.35 : 0.12;
    const osc = ctx.createOscillator();
    osc.type = 'sine'; osc.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.12, t);
    g.gain.linearRampToValueAtTime(0, t + dur);
    osc.connect(g); g.connect(masterGain);
    osc.start(t); osc.stop(t + dur + 0.05);
  }

  // ── Pressurization hiss ───────────────────────────────────────
  function pressurizationHiss(dur = 3.0) {
    init(); resume();
    const t = ctx.currentTime;
    const n = ctx.createBufferSource();
    n.buffer = makeNoise(dur + 0.2);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass'; bp.frequency.value = 1800; bp.Q.value = 0.5;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(0.12, t + 0.3);
    env.gain.linearRampToValueAtTime(0.10, t + dur * 0.6);
    env.gain.linearRampToValueAtTime(0, t + dur);
    n.connect(bp); bp.connect(env); env.connect(masterGain);
    n.start(t); n.stop(t + dur + 0.3);
  }

  // ── Separation bang ──────────────────────────────────────────
  function separationBang() {
    init(); resume();
    const t = ctx.currentTime;
    const n = ctx.createBufferSource();
    n.buffer = makeNoise(0.8);
    const d = n.buffer.getChannelData(0);
    for (let i = 0; i < d.length; i++)
      d[i] *= Math.pow(Math.max(0, 1 - i / (d.length * 0.3)), 2);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 400;
    const g = ctx.createGain(); g.gain.value = 0.9;
    n.connect(lp); lp.connect(g); g.connect(masterGain);
    n.start(t); n.stop(t + 0.9);
  }

  // ── Master alarm buzzer ──────────────────────────────────────
  let alarmNode = null;
  function startAlarm() {
    if (alarmNode) return;
    init(); resume();
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'square'; osc.frequency.value = 800;
    const lfo = ctx.createOscillator();
    lfo.type = 'square'; lfo.frequency.value = 2.5;
    const lfoG = ctx.createGain(); lfoG.gain.value = 0.5;
    lfo.connect(lfoG); lfoG.connect(osc.frequency);
    const g = ctx.createGain(); g.gain.value = 0.15;
    osc.connect(g); g.connect(masterGain);
    osc.start(t); lfo.start(t);
    alarmNode = { osc, lfo };
  }
  function stopAlarm() {
    if (!alarmNode) return;
    alarmNode.osc.stop(); alarmNode.lfo.stop();
    alarmNode = null;
  }

  // ── Air data probe deploy (pneumatic) ─────────────────────────
  function probeExtend() {
    init(); resume();
    const t = ctx.currentTime;
    // Clunk
    const n = ctx.createBufferSource();
    n.buffer = makeNoise(0.12);
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 600;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.4, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    n.connect(f); f.connect(g); g.connect(masterGain);
    n.start(t); n.stop(t + 0.15);
    // Hiss follow
    setTimeout(() => pressurizationHiss(0.8), 50);
  }

  // ── TACAN navigation radio (brief static burst on lock) ────────
  function tacanLock() {
    init(); resume();
    const t = ctx.currentTime;
    for (let i = 0; i < 5; i++) {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = 1350 + i * 110;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t + i * 0.04);
      g.gain.linearRampToValueAtTime(0.07, t + i * 0.04 + 0.01);
      g.gain.linearRampToValueAtTime(0, t + i * 0.04 + 0.03);
      osc.connect(g); g.connect(masterGain);
      osc.start(t + i * 0.04); osc.stop(t + i * 0.04 + 0.05);
    }
  }

  return {
    click,
    rockerThunk,
    apuSpoolUp,
    apuRunning,
    apuShutdown,
    hydraulicPumpSpool,
    fuelCellActivate,
    ecsStart,
    ecsStop,
    omsFire,
    ssmeStart,
    gpcBoot,
    commActivate,
    countdownTone,
    pressurizationHiss,
    separationBang,
    startAlarm,
    stopAlarm,
    probeExtend,
    tacanLock,
  };
})();
