// localStorage 存档
const KEY = 'mt_save_v1';

const DEFAULT = {
  v: 1,
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

export function loadSave() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT };
    return { ...DEFAULT, ...JSON.parse(raw) };
  } catch (e) {
    return { ...DEFAULT };
  }
}

export function writeSave(s) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) {}
}

export function tier(s, id) { return s.up[id] || 0; }

// 已解锁元素：火冰电初始；毒随局内波次自然入池；光暂走局外解锁
export function unlockedElements(s, wave = 1) {
  const list = ['fire', 'ice', 'lightning'];
  if (wave >= 8 || tier(s, 'unlockPoison')) list.push('poison');
  if (tier(s, 'unlockLight')) list.push('light');
  return list;
}
