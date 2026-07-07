// 全部平衡数值集中在此，对应 GDD-MergeTowers.md
export const W = 720, H = 1280;
export const MAX_LV = 8;
export const DMG_GROWTH = 2.1;

// 元素定义（GDD §3.2 / §3.3）
export const ELEMENTS = {
  fire:      { key: 'fire',      cn: '火', color: 0xff5a3c, base: 12, rate: 0.8,  desc: '溅射' },
  ice:       { key: 'ice',       cn: '冰', color: 0x4fc3ff, base: 6,  rate: 1.0,  desc: '减速' },
  lightning: { key: 'lightning', cn: '电', color: 0xffd94f, base: 9,  rate: 1.2,  desc: '连锁' },
  poison:    { key: 'poison',    cn: '毒', color: 0x7ede55, base: 4,  rate: 1.5,  desc: '剧毒' },
  light:     { key: 'light',     cn: '光', color: 0xfff3c4, base: 25, rate: 0.6,  desc: '斩杀' },
};

export function towerDmg(elem, lv) {
  return ELEMENTS[elem].base * Math.pow(DMG_GROWTH, lv - 1);
}
export function towerRange(lv) {
  return 175 * (1 + 0.1 * Math.floor((lv - 1) / 2));
}
// 买塔价格：20 × 1.15^n（n=已购买次数）
export function towerCost(bought) {
  return Math.round(20 * Math.pow(1.15, bought));
}

// 波次数值（GDD §4.3）
export function waveHp(w)    { return 15 * Math.pow(1.17, w); }
export function waveCount(w) { return Math.min(30, 6 + Math.floor(0.8 * w)); }
// 生成等级地板（GDD §3.1）
export function spawnFloor(w) { return w >= 30 ? 4 : w >= 20 ? 3 : w >= 10 ? 2 : 1; }

// 敌人类型（GDD §4.2）
export const ENEMY_TYPES = {
  slime:    { hpMult: 1,    speed: 90,  goldMult: 1,   color: 0xb08cff, size: 24, from: 1 },
  runner:   { hpMult: 0.6,  speed: 165, goldMult: 0.8, color: 0xff9cc4, size: 20, from: 4 },
  tank:     { hpMult: 3,    speed: 58,  goldMult: 2.5, color: 0x9aa7b8, size: 28, armor: 0.2, from: 7 },
  flyer:    { hpMult: 0.8,  speed: 85,  goldMult: 1.2, color: 0x7fe7e0, size: 22, flying: true, from: 12 },
  splitter: { hpMult: 1.2,  speed: 80,  goldMult: 1.5, color: 0xffc46b, size: 26, splits: true, from: 16 },
  mini:     { hpMult: 0.35, speed: 115, goldMult: 0.3, color: 0xffc46b, size: 15, from: 99 },
  boss:     { hpMult: 12,   speed: 42,  goldMult: 8,   color: 0xe84a5f, size: 44, boss: true, from: 5 },
};

// 基地
export const BASE_HP = 20;
export const LEAK_NORMAL = 1, LEAK_BOSS = 10;

// 阶段色调（GDD §2）
export const PHASES = [
  { from: 1,  bg: 0x2a3d2f, ground: 0x35503b, name: '白天' },
  { from: 11, bg: 0x3d3226, ground: 0x4d4030, name: '黄昏' },
  { from: 21, bg: 0x252244, ground: 0x312d55, name: '夜晚' },
  { from: 31, bg: 0x3a1e26, ground: 0x4a2830, name: '血月' },
];
export function phaseFor(w) {
  let p = PHASES[0];
  for (const ph of PHASES) if (w >= ph.from) p = ph;
  return p;
}

// 局外升级（GDD §5.3），cost(t) t 为已购档数
export const UPGRADES = [
  { id: 'startLv',   cn: '精工锻造', desc: '买塔 +5%/档 概率升 1 级',   tiers: 10, cost: t => 8 + t * 6 },
  { id: 'startGold', cn: '起始资金', desc: '开局金币 +20/档',           tiers: 10, cost: t => 8 + t * 5 },
  { id: 'baseArmor', cn: '基地装甲', desc: '基地血量 +2/档',            tiers: 5,  cost: t => 10 + t * 8 },
  { id: 'interest',  cn: '战场利息', desc: '每波按存款 5%/档 生息(有上限)', tiers: 3, cost: t => 15 + t * 15 },
  { id: 'unlockPoison', cn: '解锁 ☠毒', desc: '毒元素入池：叠毒无视护甲', tiers: 1, cost: () => 25 },
  { id: 'unlockLight',  cn: '解锁 ✨光', desc: '光元素入池：低血斩杀',   tiers: 1, cost: () => 120 },
  { id: 'autoBuy',   cn: '自动买塔', desc: '金币足够时自动购买',        tiers: 1,  cost: () => 60 },
  { id: 'autoMerge', cn: '自动合成', desc: '自动合并同色同级塔',        tiers: 1,  cost: () => 90 },
  { id: 'speed2x',   cn: '2倍速',    desc: '永久解锁 2 倍速按钮',       tiers: 1,  cost: () => 80 },
];

// 钻石经济（GDD §5.3 基准数值）
export const DIAMOND = { boss: 2, milestone: 3, deathBonusPerWave: 5, adDaily: 5 };
// 离线钻石（GDD §5.1）：每小时 1 + floor(最高波/10)，上限 8h
export function offlineDiamonds(bestWave, hours) {
  return Math.floor(Math.min(hours, 8) * (1 + Math.floor(bestWave / 10)));
}
