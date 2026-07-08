// localStorage 存档
const KEY = 'mt_save_v1';
const SAVE_VERSION = 2;

const DEFAULT = {
  v: SAVE_VERSION,
  best: 0,          // 历史最高波
  diamonds: 0,      // 局外货币
  runs: 0,          // 总局数
  up: {},           // 升级档位 { id: tier }
  lastSeen: 0,      // 离线结算时间戳
  coupon: false,    // 下局开局金币 +50% 券
  muted: false,
  adDiamondDay: '', // 当日看广告领钻计数
  adDiamondCount: 0,
  lastDiagnosisKey: '',
  lastDiagnosisCount: 0,
};

function asInt(value, fallback = 0) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.floor(n));
}

function asBool(value) {
  return value === true;
}

function asString(value, fallback = '') {
  return typeof value === 'string' ? value : fallback;
}

function cleanUpgrades(up) {
  const out = {};
  if (!up || typeof up !== 'object' || Array.isArray(up)) return out;
  for (const [id, value] of Object.entries(up)) out[id] = asInt(value);
  return out;
}

export function sanitizeSave(raw = {}) {
  const src = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  return {
    ...DEFAULT,
    v: SAVE_VERSION,
    best: asInt(src.best),
    diamonds: asInt(src.diamonds),
    runs: asInt(src.runs),
    up: cleanUpgrades(src.up),
    lastSeen: asInt(src.lastSeen),
    coupon: asBool(src.coupon),
    muted: asBool(src.muted),
    adDiamondDay: asString(src.adDiamondDay),
    adDiamondCount: asInt(src.adDiamondCount),
    lastDiagnosisKey: asString(src.lastDiagnosisKey),
    lastDiagnosisCount: asInt(src.lastDiagnosisCount),
  };
}

export function loadSave() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return sanitizeSave();
    const parsed = JSON.parse(raw);
    const save = sanitizeSave(parsed);
    if (save.v !== parsed.v) writeSave(save);
    return save;
  } catch (e) {
    const clean = sanitizeSave();
    try { localStorage.setItem(KEY, JSON.stringify(clean)); } catch (_) {}
    return clean;
  }
}

export function writeSave(s) {
  const clean = sanitizeSave(s);
  if (s && typeof s === 'object') Object.assign(s, clean);
  try { localStorage.setItem(KEY, JSON.stringify(clean)); } catch (e) {}
  return clean;
}

export function touchSave(s, patch = {}) {
  if (!s || typeof s !== 'object') return sanitizeSave();
  Object.assign(s, patch, { lastSeen: Date.now() });
  return writeSave(s);
}

export function resetSave() {
  const clean = sanitizeSave();
  try { localStorage.setItem(KEY, JSON.stringify(clean)); } catch (e) {}
  return clean;
}

export function tier(s, id) { return s?.up?.[id] || 0; }

// 已解锁元素：火冰电初始；毒随局内波次自然入池；光暂走局外解锁
export function unlockedElements(s, wave = 1) {
  const list = ['fire', 'ice', 'lightning'];
  if (wave >= 8 || tier(s, 'unlockPoison')) list.push('poison');
  if (tier(s, 'unlockLight')) list.push('light');
  return list;
}
