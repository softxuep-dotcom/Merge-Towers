// WebAudio 程序化音效：零资源文件，包体友好
let ctx = null;
let muted = false;
let unlocked = false;
let masterGain = null;
let sfxGain = null;
let musicGain = null;
let ambienceGain = null;
let ambience = null;
let musicTimer = null;
let nextBeatTime = 0;
let beatStep = 0;
let stageActive = false;
let stageKey = 'day';
const pauseReasons = new Set();

const PHASE_AUDIO = {
  day: {
    root: 261.63, tempo: 76, lead: 'triangle', musicVol: 0.034, ambienceVol: 0.028,
    droneVol: 0.012, fifthVol: 0.007, noiseVol: 0.01, noiseFreq: 1800,
    pattern: [0, 2, 4, 7, 9, 7, 4, 2], bass: [-12, null, -5, null],
  },
  dusk: {
    root: 220, tempo: 84, lead: 'triangle', musicVol: 0.038, ambienceVol: 0.034,
    droneVol: 0.018, fifthVol: 0.012, noiseVol: 0.014, noiseFreq: 1200,
    pattern: [0, 3, 5, 7, 10, 7, 5, 3], bass: [-12, null, -7, null],
  },
  night: {
    root: 196, tempo: 92, lead: 'sine', musicVol: 0.041, ambienceVol: 0.041,
    droneVol: 0.025, fifthVol: 0.018, noiseVol: 0.018, noiseFreq: 780,
    pattern: [0, 2, 3, 7, 10, 7, 3, 2], bass: [-12, null, -5, -10],
  },
  blood: {
    root: 174.61, tempo: 104, lead: 'sawtooth', musicVol: 0.045, ambienceVol: 0.05,
    droneVol: 0.034, fifthVol: 0.026, noiseVol: 0.026, noiseFreq: 430,
    pattern: [0, 1, 6, 7, 10, 7, 6, 1], bass: [-12, -12, -6, -13],
  },
};

function phaseKey(phase) {
  const name = typeof phase === 'string' ? phase : (phase?.name || '');
  if (name.includes('血月') || phase?.from >= 31) return 'blood';
  if (name.includes('夜晚') || phase?.from >= 21) return 'night';
  if (name.includes('黄昏') || phase?.from >= 11) return 'dusk';
  return 'day';
}

function ramp(param, value, dur = 0.15) {
  if (!ctx || !param) return;
  const now = ctx.currentTime;
  param.cancelScheduledValues(now);
  param.setValueAtTime(Math.max(0.0001, param.value || 0.0001), now);
  param.linearRampToValueAtTime(value, now + dur);
}

function audioPaused() {
  return pauseReasons.size > 0 || (typeof document !== 'undefined' && document.hidden);
}

function updateMasterGain() {
  if (!masterGain || !ctx) return;
  ramp(masterGain.gain, muted || audioPaused() ? 0 : 1, 0.12);
}

function setupBuses(c) {
  masterGain = c.createGain();
  sfxGain = c.createGain();
  musicGain = c.createGain();
  ambienceGain = c.createGain();
  const comp = c.createDynamicsCompressor();
  masterGain.gain.value = muted || audioPaused() ? 0 : 1;
  sfxGain.gain.value = 0.85;
  musicGain.gain.value = 0;
  ambienceGain.gain.value = 0;
  sfxGain.connect(masterGain);
  musicGain.connect(masterGain);
  ambienceGain.connect(masterGain);
  masterGain.connect(comp).connect(c.destination);
}

function ac(create = unlocked) {
  if (!ctx) {
    if (!create || muted || typeof window === 'undefined') return null;
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      setupBuses(ctx);
    } catch (e) {
      return null;
    }
  }
  if (ctx.state === 'suspended') {
    const resume = ctx.resume();
    if (resume?.catch) resume.catch(() => {});
  }
  return ctx;
}

export function unlockAudio() {
  unlocked = true;
  const c = ac(true);
  if (!c) return false;
  updateMasterGain();
  if (stageActive) {
    ensureAmbience();
    applyStageTone(true);
    startMusicClock();
  }
  return true;
}

export function setMuted(m) {
  muted = m;
  if (!muted && unlocked) {
    const c = ac(true);
    if (c) {
      if (stageActive) {
        ensureAmbience();
        applyStageTone(true);
        startMusicClock();
      }
    }
  }
  updateMasterGain();
}
export function isMuted() { return muted; }

export function setAudioPaused(paused, reason = 'system') {
  if (paused) pauseReasons.add(reason);
  else pauseReasons.delete(reason);
  updateMasterGain();
}

export function startStageAudio(phase) {
  stageActive = true;
  setAudioPhase(phase, { immediate: true });
  if (ctx) startMusicClock();
}

export function stopStageAudio() {
  stageActive = false;
  if (musicTimer) {
    window.clearInterval(musicTimer);
    musicTimer = null;
  }
  if (ctx) {
    ramp(musicGain?.gain, 0, 0.35);
    ramp(ambienceGain?.gain, 0, 0.5);
  }
}

export function setAudioPhase(phase, opts = {}) {
  const next = phaseKey(phase);
  const changed = next !== stageKey;
  stageKey = next;
  if (!ctx) return;
  ensureAmbience();
  applyStageTone(!!opts.immediate);
  if (stageActive) startMusicClock();
  if (opts.accent && changed) phaseSting(next);
}

function ensureAmbience() {
  const c = ac(false);
  if (!c || ambience) return;

  const drone = c.createOscillator();
  const fifth = c.createOscillator();
  const droneGain = c.createGain();
  const fifthGain = c.createGain();
  drone.type = 'sine';
  fifth.type = 'triangle';
  droneGain.gain.value = 0;
  fifthGain.gain.value = 0;
  drone.connect(droneGain).connect(ambienceGain);
  fifth.connect(fifthGain).connect(ambienceGain);
  drone.start();
  fifth.start();

  const len = Math.floor(c.sampleRate * 2);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  const noiseSrc = c.createBufferSource();
  const noiseFilter = c.createBiquadFilter();
  const noiseGain = c.createGain();
  noiseSrc.buffer = buf;
  noiseSrc.loop = true;
  noiseFilter.type = 'lowpass';
  noiseFilter.frequency.value = 1200;
  noiseFilter.Q.value = 0.55;
  noiseGain.gain.value = 0;
  noiseSrc.connect(noiseFilter).connect(noiseGain).connect(ambienceGain);
  noiseSrc.start();

  ambience = { drone, fifth, droneGain, fifthGain, noiseFilter, noiseGain };
}

function applyStageTone(immediate = false) {
  if (!ctx || !ambience) return;
  const p = PHASE_AUDIO[stageKey] || PHASE_AUDIO.day;
  const dur = immediate ? 0.08 : 1.6;
  const now = ctx.currentTime;
  ambience.drone.frequency.cancelScheduledValues(now);
  ambience.fifth.frequency.cancelScheduledValues(now);
  ambience.noiseFilter.frequency.cancelScheduledValues(now);
  ambience.drone.frequency.setValueAtTime(Math.max(20, ambience.drone.frequency.value), now);
  ambience.fifth.frequency.setValueAtTime(Math.max(20, ambience.fifth.frequency.value), now);
  ambience.noiseFilter.frequency.setValueAtTime(Math.max(80, ambience.noiseFilter.frequency.value), now);
  ambience.drone.frequency.exponentialRampToValueAtTime(Math.max(20, p.root / 2), now + dur);
  ambience.fifth.frequency.exponentialRampToValueAtTime(Math.max(20, p.root * 0.75), now + dur);
  ambience.noiseFilter.frequency.exponentialRampToValueAtTime(Math.max(80, p.noiseFreq), now + dur);
  ramp(ambience.droneGain.gain, stageActive ? p.droneVol : 0, dur);
  ramp(ambience.fifthGain.gain, stageActive ? p.fifthVol : 0, dur);
  ramp(ambience.noiseGain.gain, stageActive ? p.noiseVol : 0, dur);
  ramp(ambienceGain.gain, stageActive ? p.ambienceVol : 0, dur);
  ramp(musicGain.gain, stageActive ? p.musicVol : 0, dur);
  if (!nextBeatTime || nextBeatTime < now) nextBeatTime = now + 0.12;
  else nextBeatTime = Math.min(nextBeatTime, now + 0.12);
}

function startMusicClock() {
  const c = ac(false);
  if (!c || musicTimer || !stageActive) return;
  nextBeatTime = c.currentTime + 0.08;
  beatStep = 0;
  scheduleMusic();
  musicTimer = window.setInterval(scheduleMusic, 160);
}

function scheduleMusic() {
  const c = ac(false);
  if (!c || !stageActive) return;
  const p = PHASE_AUDIO[stageKey] || PHASE_AUDIO.day;
  const beatDur = 60 / p.tempo / 2;
  if (nextBeatTime < c.currentTime - 0.5) nextBeatTime = c.currentTime + 0.05;
  while (nextBeatTime < c.currentTime + 0.45) {
    scheduleBeat(nextBeatTime, beatStep, p);
    nextBeatTime += beatDur;
    beatStep++;
  }
}

function note(root, semi) {
  return root * Math.pow(2, semi / 12);
}

function pluckAt(freq, t0, dur, type, vol, bus = musicGain) {
  const c = ac(false);
  if (!c || muted || audioPaused()) return;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0001, vol), t0 + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(bus);
  o.start(t0);
  o.stop(t0 + dur + 0.03);
}

function noiseAt(t0, dur, vol, bus = musicGain) {
  const c = ac(false);
  if (!c || muted || audioPaused()) return;
  const len = Math.floor(c.sampleRate * dur);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = c.createBufferSource();
  const g = c.createGain();
  src.buffer = buf;
  g.gain.setValueAtTime(vol, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(g).connect(bus);
  src.start(t0);
}

function scheduleBeat(t0, step, p) {
  if (muted || audioPaused()) return;
  const leadSemi = p.pattern[step % p.pattern.length];
  if (leadSemi != null && step % 2 === 0) {
    pluckAt(note(p.root, leadSemi + 12), t0, 0.22, p.lead, stageKey === 'blood' ? 0.06 : 0.045);
  }
  const bassSemi = p.bass[step % p.bass.length];
  if (bassSemi != null && step % 4 === 0) {
    pluckAt(note(p.root, bassSemi), t0, 0.36, 'sine', stageKey === 'blood' ? 0.08 : 0.055);
  }
  if (stageKey === 'blood' && step % 8 === 4) noiseAt(t0, 0.09, 0.018);
}

function phaseSting(key) {
  const p = PHASE_AUDIO[key] || PHASE_AUDIO.day;
  const semis = key === 'blood' ? [-12, -6, -13] : key === 'night' ? [7, 3, 0] : [0, 5, 7, 12];
  semis.forEach((s, i) => pluckAt(note(p.root, s + 12), (ctx?.currentTime || 0) + i * 0.08, 0.28, p.lead, 0.16, sfxGain));
  if (key === 'blood') noise({ dur: 0.28, vol: 0.12, delay: 0.04 });
}

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', updateMasterGain);
}

function tone({ freq = 440, end = null, dur = 0.15, type = 'sine', vol = 0.25, delay = 0 }) {
  const c = ac();
  if (!c || muted || audioPaused()) return;
  const t0 = c.currentTime + delay;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  if (end) o.frequency.exponentialRampToValueAtTime(end, t0 + dur);
  g.gain.setValueAtTime(vol, t0);
  g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  o.connect(g).connect(sfxGain || c.destination);
  o.start(t0);
  o.stop(t0 + dur + 0.02);
}

function noise({ dur = 0.08, vol = 0.15, delay = 0 }) {
  const c = ac();
  if (!c || muted || audioPaused()) return;
  const t0 = c.currentTime + delay;
  const len = Math.floor(c.sampleRate * dur);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = c.createBufferSource();
  src.buffer = buf;
  const g = c.createGain();
  g.gain.setValueAtTime(vol, t0);
  src.connect(g).connect(sfxGain || c.destination);
  src.start(t0);
}

// 冰系使用带通噪声做出细碎冰晶质感，避免和命中/爆炸的宽频噪声混在一起。
function iceNoise({ freq = 4200, q = 1.4, dur = 0.08, vol = 0.08, delay = 0 }) {
  const c = ac();
  if (!c || muted || audioPaused()) return;
  const t0 = c.currentTime + delay;
  const len = Math.floor(c.sampleRate * dur);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 1.8);
  const src = c.createBufferSource();
  const filter = c.createBiquadFilter();
  const gain = c.createGain();
  src.buffer = buf;
  filter.type = 'bandpass';
  filter.frequency.setValueAtTime(freq, t0);
  filter.Q.setValueAtTime(q, t0);
  gain.gain.setValueAtTime(vol, t0);
  gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  src.connect(filter).connect(gain).connect(sfxGain || c.destination);
  src.start(t0);
}

// 大调音阶 do re mi fa so la si do —— 合成等级越高音越高（GDD §6.8）
const SCALE = [0, 2, 4, 5, 7, 9, 11, 12];
export const Sfx = {
  merge(lv, chain = 1) {
    const idx = Math.max(0, lv - 1 + Math.max(0, chain - 1));
    const semi = SCALE[idx % SCALE.length] + 12 * Math.floor(idx / SCALE.length);
    const f = 330 * Math.pow(2, semi / 12);
    noise({ dur: 0.025, vol: 0.055 });
    tone({ freq: 180, end: 300, dur: 0.055, type: 'sine', vol: 0.14 });
    tone({ freq: f, dur: 0.12, type: 'triangle', vol: 0.3, delay: 0.025 });
    tone({ freq: f * 1.5, dur: 0.2, type: 'sine', vol: 0.22, delay: 0.095 });
  },
  mergeTop() { // 合出本局最高级：上行琶音
    [0, 4, 7, 12].forEach((s, i) => tone({ freq: 523 * Math.pow(2, s / 12), dur: 0.18, type: 'triangle', vol: 0.28, delay: i * 0.06 }));
  },
  coin()  { tone({ freq: 988, end: 1319, dur: 0.09, type: 'square', vol: 0.07 }); },
  buy()   { tone({ freq: 440, end: 660, dur: 0.1, type: 'triangle', vol: 0.2 }); },
  sell()  { tone({ freq: 500, end: 250, dur: 0.15, type: 'triangle', vol: 0.2 }); },
  hit()   { noise({ dur: 0.04, vol: 0.05 }); },
  kill()  { noise({ dur: 0.09, vol: 0.1 }); tone({ freq: 220, end: 110, dur: 0.1, type: 'square', vol: 0.06 }); },
  leak()  { tone({ freq: 200, end: 90, dur: 0.35, type: 'sawtooth', vol: 0.25 }); },
  bossIn() {
    tone({ freq: 65, dur: 0.6, type: 'sawtooth', vol: 0.35 });
    tone({ freq: 98, dur: 0.5, type: 'sawtooth', vol: 0.25, delay: 0.15 });
  },
  bossDie() {
    noise({ dur: 0.3, vol: 0.3 });
    [0, 0.12, 0.24].forEach(d => tone({ freq: 150 - d * 200, end: 60, dur: 0.25, type: 'sawtooth', vol: 0.25, delay: d }));
  },
  execute() { tone({ freq: 1568, dur: 0.25, type: 'sine', vol: 0.25 }); tone({ freq: 2093, dur: 0.3, type: 'sine', vol: 0.18, delay: 0.05 }); },
  wave()  { tone({ freq: 392, dur: 0.12, type: 'triangle', vol: 0.2 }); tone({ freq: 523, dur: 0.15, type: 'triangle', vol: 0.2, delay: 0.1 }); },
  gameOver() { [392, 330, 262, 196].forEach((f, i) => tone({ freq: f, dur: 0.3, type: 'triangle', vol: 0.22, delay: i * 0.18 })); },
  diamond() { tone({ freq: 1760, end: 2349, dur: 0.12, type: 'sine', vol: 0.15 }); },
  freeze() {
    // 短促上扬后锁定：用于路径冻结，听感像冰层瞬间结晶。
    iceNoise({ freq: 5200, q: 2.2, dur: 0.075, vol: 0.11 });
    tone({ freq: 740, end: 1480, dur: 0.09, type: 'triangle', vol: 0.105 });
    tone({ freq: 1480, end: 1120, dur: 0.2, type: 'sine', vol: 0.075, delay: 0.055 });
  },
  iceNova() {
    // 霜爆：低频扩张主体 + 向外散开的高频冰晶尾音。
    tone({ freq: 190, end: 82, dur: 0.32, type: 'sine', vol: 0.15 });
    iceNoise({ freq: 3600, q: 1.1, dur: 0.18, vol: 0.13 });
    [1568, 1175, 880, 659].forEach((f, i) => {
      tone({ freq: f, end: f * 0.72, dur: 0.18, type: 'triangle', vol: 0.08, delay: i * 0.026 });
    });
  },
  shatterFreeze() {
    // 碎冰：三次不规则脆裂，末尾补一个低频冻结落点。
    [0, 0.028, 0.064].forEach((delay, i) => {
      iceNoise({ freq: 6100 - i * 950, q: 3.2, dur: 0.055 + i * 0.012, vol: 0.105 - i * 0.016, delay });
      tone({ freq: 2100 - i * 370, end: 920 - i * 120, dur: 0.085, type: 'triangle', vol: 0.07, delay });
    });
    tone({ freq: 310, end: 155, dur: 0.24, type: 'sine', vol: 0.105, delay: 0.055 });
  },
  stun() {
    noise({ dur: 0.045, vol: 0.075 });
    tone({ freq: 2400, end: 520, dur: 0.11, type: 'square', vol: 0.065 });
    tone({ freq: 460, end: 180, dur: 0.14, type: 'sawtooth', vol: 0.08, delay: 0.025 });
  },
  surge() {
    noise({ dur: 0.12, vol: 0.16 });
    tone({ freq: 170, end: 420, dur: 0.16, type: 'sawtooth', vol: 0.13 });
  },
  resonance(chain) {
    const base = 392 + Math.min(chain, 7) * 26;
    [0, 4, 7].forEach((s, i) => tone({ freq: base * Math.pow(2, s / 12), dur: 0.14, type: 'triangle', vol: 0.18, delay: i * 0.045 }));
  },
  lastStand() {
    noise({ dur: 0.22, vol: 0.2 });
    [82, 123, 164].forEach((f, i) => tone({ freq: f, end: f * 0.72, dur: 0.45, type: 'sawtooth', vol: 0.22, delay: i * 0.08 }));
  },
  clutch() {
    [523, 659, 784, 1046].forEach((f, i) => tone({ freq: f, dur: 0.18, type: 'triangle', vol: 0.24, delay: i * 0.055 }));
  },
};
