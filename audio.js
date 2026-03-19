/* ============================================================
   SPACE SHUTTLE DISCOVERY — AUDIO ENGINE
   Web Audio API — Procedural sound generation
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

  // ── Mechanical click / toggle snap ──────────────────────────
  function click(type = 'toggle') {
    init(); resume();
    const t = ctx.currentTime;

    // Broadband noise burst
    const buf = ctx.createBuffer(1, ctx.sampleRate * 0.06, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (data.length * 0.08));
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buf;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = type === 'push' ? 2200 : 1400;
    filter.Q.value = 0.8;

    const env = ctx.createGain();
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(0.35, t + 0.002);
    env.gain.exponentialRampToValueAtTime(0.001, t + 0.05);

    // Body knock
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(type === 'push' ? 180 : 120, t);
    osc.frequency.exponentialRampToValueAtTime(60, t + 0.04);
    const oscGain = ctx.createGain();
    oscGain.gain.setValueAtTime(0.25, t);
    oscGain.gain.exponentialRampToValueAtTime(0.001, t + 0.04);

    noise.connect(filter);
    filter.connect(env);
    osc.connect(oscGain);
    env.connect(masterGain);
    oscGain.connect(masterGain);

    noise.start(t);
    noise.stop(t + 0.1);
    osc.start(t);
    osc.stop(t + 0.06);
  }

  // ── Rocker switch thunk ──────────────────────────────────────
  function rockerThunk() {
    init(); resume();
    const t = ctx.currentTime;
    const buf = ctx.createBuffer(1, ctx.sampleRate * 0.08, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (data.length * 0.1));
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buf;
    const filt = ctx.createBiquadFilter();
    filt.type = 'lowpass';
    filt.frequency.value = 900;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.3, t);
    env.gain.exponentialRampToValueAtTime(0.001, t + 0.07);
    noise.connect(filt);
    filt.connect(env);
    env.connect(masterGain);
    noise.start(t);
    noise.stop(t + 0.1);
  }

  // ── APU spool-up ─────────────────────────────────────────────
  function apuSpoolUp(unit = 1, cb) {
    init(); resume();
    const t = ctx.currentTime;
    const dur = 3.5;

    // Turbine whine — frequency sweeps from low to high
    const baseFreq = 55 + unit * 8;
    const topFreq  = 420 + unit * 30;

    const osc1 = ctx.createOscillator();
    osc1.type = 'sawtooth';
    osc1.frequency.setValueAtTime(baseFreq, t);
    osc1.frequency.exponentialRampToValueAtTime(topFreq, t + dur * 0.8);
    osc1.frequency.linearRampToValueAtTime(topFreq * 0.95 + 15, t + dur);

    const osc2 = ctx.createOscillator();
    osc2.type = 'sawtooth';
    osc2.frequency.setValueAtTime(baseFreq * 2.01, t);
    osc2.frequency.exponentialRampToValueAtTime(topFreq * 2.02, t + dur * 0.8);
    osc2.frequency.linearRampToValueAtTime(topFreq * 1.98 + 10, t + dur);

    // Noise component — adds "rushing air" texture
    const noiseBuf = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate);
    const nd = noiseBuf.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuf;
    const noiseHP = ctx.createBiquadFilter();
    noiseHP.type = 'highpass';
    noiseHP.frequency.setValueAtTime(200, t);
    noiseHP.frequency.linearRampToValueAtTime(2000, t + dur);
    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.04, t);
    noiseGain.gain.linearRampToValueAtTime(0.12, t + dur * 0.5);
    noiseGain.gain.linearRampToValueAtTime(0.08, t + dur);

    // Distortion for mechanical texture
    const dist = ctx.createWaveShaper();
    dist.curve = makeDistortionCurve(60);
    dist.oversample = '4x';

    const ampEnv = ctx.createGain();
    ampEnv.gain.setValueAtTime(0.001, t);
    ampEnv.gain.linearRampToValueAtTime(0.18, t + 0.3);
    ampEnv.gain.linearRampToValueAtTime(0.22, t + dur * 0.7);
    ampEnv.gain.linearRampToValueAtTime(0.20, t + dur);

    osc1.connect(dist);
    osc2.connect(dist);
    dist.connect(ampEnv);
    noise.connect(noiseHP);
    noiseHP.connect(noiseGain);
    noiseGain.connect(ampEnv);
    ampEnv.connect(masterGain);

    osc1.start(t); osc1.stop(t + dur + 0.1);
    osc2.start(t); osc2.stop(t + dur + 0.1);
    noise.start(t); noise.stop(t + dur + 0.1);

    if (cb) setTimeout(cb, (dur + 0.15) * 1000);
  }

  // ── APU running hum ──────────────────────────────────────────
  const apuNodes = {};
  function apuRunning(unit = 1) {
    init(); resume();
    if (apuNodes[unit]) return;
    const t = ctx.currentTime;
    const freq = 400 + unit * 28;

    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = freq;
    const osc2 = ctx.createOscillator();
    osc2.type = 'sawtooth';
    osc2.frequency.value = freq * 2.003;

    const dist = ctx.createWaveShaper();
    dist.curve = makeDistortionCurve(30);

    const filt = ctx.createBiquadFilter();
    filt.type = 'lowpass';
    filt.frequency.value = 1800;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.001, t);
    gain.gain.linearRampToValueAtTime(0.08, t + 0.3);

    osc.connect(dist);
    osc2.connect(dist);
    dist.connect(filt);
    filt.connect(gain);
    gain.connect(masterGain);
    osc.start(t); osc2.start(t);
    apuNodes[unit] = { osc, osc2, gain };
  }

  function apuShutdown(unit = 1) {
    if (!apuNodes[unit]) return;
    const { osc, osc2, gain } = apuNodes[unit];
    const t = ctx.currentTime;
    gain.gain.linearRampToValueAtTime(0.001, t + 1.5);
    osc.stop(t + 1.6); osc2.stop(t + 1.6);
    delete apuNodes[unit];
  }

  // ── Hydraulic pump spool ─────────────────────────────────────
  function hydraulicPumpSpool(unit = 1) {
    init(); resume();
    const t = ctx.currentTime;
    const dur = 2.0;

    // Electric motor whine
    const motorFreq = 180 + unit * 22;
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(motorFreq * 0.4, t);
    osc.frequency.exponentialRampToValueAtTime(motorFreq, t + dur * 0.7);
    osc.frequency.linearRampToValueAtTime(motorFreq * 0.98, t + dur);

    // Hydraulic fluid rushing
    const nBuf = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate);
    const nd = nBuf.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    const n = ctx.createBufferSource();
    n.buffer = nBuf;
    const nFilt = ctx.createBiquadFilter();
    nFilt.type = 'bandpass';
    nFilt.frequency.setValueAtTime(300, t);
    nFilt.frequency.linearRampToValueAtTime(900, t + dur);
    nFilt.Q.value = 1.5;

    const env = ctx.createGain();
    env.gain.setValueAtTime(0.001, t);
    env.gain.linearRampToValueAtTime(0.15, t + 0.2);
    env.gain.linearRampToValueAtTime(0.12, t + dur);

    const oscG = ctx.createGain();
    oscG.gain.value = 0.6;

    osc.connect(oscG); oscG.connect(env);
    n.connect(nFilt); nFilt.connect(env);
    env.connect(masterGain);
    osc.start(t); osc.stop(t + dur + 0.1);
    n.start(t); n.stop(t + dur + 0.1);
  }

  // ── Fuel cell activation ─────────────────────────────────────
  function fuelCellActivate() {
    init(); resume();
    const t = ctx.currentTime;

    // Relay click sequence
    for (let i = 0; i < 3; i++) {
      const delay = i * 0.18;
      const buf = ctx.createBuffer(1, ctx.sampleRate * 0.05, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let j = 0; j < d.length; j++) d[j] = (Math.random() * 2 - 1) * Math.exp(-j / (d.length * 0.05));
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const g = ctx.createGain();
      g.gain.value = 0.2;
      const f = ctx.createBiquadFilter();
      f.type = 'highpass';
      f.frequency.value = 1200;
      src.connect(f); f.connect(g); g.connect(masterGain);
      src.start(t + delay);
    }

    // Low hum on
    const hum = ctx.createOscillator();
    hum.type = 'sine';
    hum.frequency.value = 60;
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

    const nBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const nd = nBuf.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    const n = ctx.createBufferSource();
    n.buffer = nBuf;
    n.loop = true;

    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 600;
    bp.Q.value = 0.7;

    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.06, t + 1.2);

    n.connect(bp); bp.connect(g); g.connect(masterGain);
    n.start(t);
    ecsNode.src = n;
    ecsNode.gain = g;
    ecsNode.running = true;
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
    const dur = 1.2;

    const nBuf = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate);
    const nd = nBuf.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    const n = ctx.createBufferSource();
    n.buffer = nBuf;

    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 80;

    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 3000;

    const env = ctx.createGain();
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(0.5, t + 0.1);
    env.gain.linearRampToValueAtTime(0.4, t + dur * 0.7);
    env.gain.linearRampToValueAtTime(0, t + dur);

    n.connect(hp); hp.connect(lp); lp.connect(env); env.connect(masterGain);
    n.start(t); n.stop(t + dur + 0.1);
  }

  // ── GPC boot beep sequence ────────────────────────────────────
  function gpcBoot(unit = 1) {
    init(); resume();
    const t = ctx.currentTime;
    const freqs = [880, 1100, 1320, 1047];
    freqs.forEach((f, i) => {
      const osc = ctx.createOscillator();
      osc.type = 'square';
      osc.frequency.value = f;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t + i * 0.08);
      g.gain.linearRampToValueAtTime(0.08, t + i * 0.08 + 0.01);
      g.gain.linearRampToValueAtTime(0, t + i * 0.08 + 0.05);
      osc.connect(g); g.connect(masterGain);
      osc.start(t + i * 0.08);
      osc.stop(t + i * 0.08 + 0.07);
    });
  }

  // ── Comm system activate ─────────────────────────────────────
  function commActivate() {
    init(); resume();
    const t = ctx.currentTime;
    // Carrier tone ping
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

  // ── Separation bang ──────────────────────────────────────────
  function separationBang() {
    init(); resume();
    const t = ctx.currentTime;
    const nBuf = ctx.createBuffer(1, ctx.sampleRate * 0.8, ctx.sampleRate);
    const nd = nBuf.getChannelData(0);
    for (let i = 0; i < nd.length; i++) {
      nd[i] = (Math.random() * 2 - 1) * Math.pow(Math.max(0, 1 - i / (nd.length * 0.3)), 2);
    }
    const n = ctx.createBufferSource();
    n.buffer = nBuf;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 400;
    const g = ctx.createGain();
    g.gain.value = 0.9;
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
    osc.type = 'square';
    osc.frequency.value = 800;
    const lfo = ctx.createOscillator();
    lfo.type = 'square';
    lfo.frequency.value = 2.5;
    const lfoG = ctx.createGain();
    lfoG.gain.value = 0.5;
    lfo.connect(lfoG);
    lfoG.connect(osc.frequency);
    const g = ctx.createGain();
    g.gain.value = 0.15;
    osc.connect(g); g.connect(masterGain);
    osc.start(t); lfo.start(t);
    alarmNode = { osc, lfo };
  }

  function stopAlarm() {
    if (!alarmNode) return;
    alarmNode.osc.stop();
    alarmNode.lfo.stop();
    alarmNode = null;
  }

  // ── Distortion curve helper ──────────────────────────────────
  function makeDistortionCurve(amount) {
    const n = 256, curve = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const x = (i * 2) / n - 1;
      curve[i] = ((Math.PI + amount) * x) / (Math.PI + amount * Math.abs(x));
    }
    return curve;
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
    gpcBoot,
    commActivate,
    separationBang,
    startAlarm,
    stopAlarm,
  };
})();
