// WebAudio 程序化音效：零资源文件，包体友好
let ctx = null;
let muted = false;

function ac() {
  if (!ctx) {
    try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return null; }
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

export function setMuted(m) { muted = m; }
export function isMuted() { return muted; }

function tone({ freq = 440, end = null, dur = 0.15, type = 'sine', vol = 0.25, delay = 0 }) {
  const c = ac();
  if (!c || muted) return;
  const t0 = c.currentTime + delay;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  if (end) o.frequency.exponentialRampToValueAtTime(end, t0 + dur);
  g.gain.setValueAtTime(vol, t0);
  g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  o.connect(g).connect(c.destination);
  o.start(t0);
  o.stop(t0 + dur + 0.02);
}

function noise({ dur = 0.08, vol = 0.15, delay = 0 }) {
  const c = ac();
  if (!c || muted) return;
  const t0 = c.currentTime + delay;
  const len = Math.floor(c.sampleRate * dur);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = c.createBufferSource();
  src.buffer = buf;
  const g = c.createGain();
  g.gain.setValueAtTime(vol, t0);
  src.connect(g).connect(c.destination);
  src.start(t0);
}

// 大调音阶 do re mi fa so la si do —— 合成等级越高音越高（GDD §6.8）
const SCALE = [0, 2, 4, 5, 7, 9, 11, 12];
export const Sfx = {
  merge(lv) {
    const semi = SCALE[Math.min(lv - 1, SCALE.length - 1)];
    const f = 330 * Math.pow(2, semi / 12);
    tone({ freq: f, dur: 0.12, type: 'triangle', vol: 0.3 });
    tone({ freq: f * 1.5, dur: 0.2, type: 'sine', vol: 0.22, delay: 0.07 });
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
  freeze() { tone({ freq: 1200, end: 400, dur: 0.2, type: 'sine', vol: 0.12 }); },
};
