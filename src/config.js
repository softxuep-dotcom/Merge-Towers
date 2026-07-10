// 全部平衡数值集中在此，对应 GDD-MergeTowers.md
export const W = 720, H = 1280;
export const MAX_LV = 8;
// 分段伤害增长（v1.21 定版）：Lv1–3 幼年期 1.9，Lv4–8 段 2.0。
// Lv8 总量 ≈ base×115.5（v1.20 为 158，原始 2.1^7=180）。
// 注意：后期段=2.0 时合成的裸 DPS 收益恰好归零（合成塔=两塔之和），
// 合成动机完全转移到 塔位经济/里程碑/冲击共鸣/射程——设计上有意为之。
export const DMG_GROWTH_EARLY = 1.9; // Lv1–3
export const DMG_GROWTH_LATE = 2.0;  // Lv4–8

// 元素定义（GDD §3.2 / §3.3）
export const ELEMENTS = {
  fire:      { key: 'fire',      cn: '火', color: 0xff5a3c, base: 12, rate: 0.8,  desc: '溅射' },
  ice:       { key: 'ice',       cn: '冰', color: 0x4fc3ff, base: 6,  rate: 1.0,  desc: '减速' },
  lightning: { key: 'lightning', cn: '电', color: 0xffd94f, base: 9,  rate: 1.2,  desc: '连锁' },
  poison:    { key: 'poison',    cn: '毒', color: 0x7ede55, base: 4,  rate: 1.5,  desc: '剧毒' },
  light:     { key: 'light',     cn: '光', color: 0xfff3c4, base: 25, rate: 0.6,  desc: '斩杀' },
};

// Lv4 分支进化（GDD §3.5）
export const TOWER_BRANCHES = {
  fire: {
    a: { key: 'a', cn: '爆裂', short: '爆', desc: '溅射半径 +60%，命中留燃烧地面' },
    b: { key: 'b', cn: '熔核', short: '熔', desc: '单体重炮，攻速减半，伤害与暴击提高' },
  },
  ice: {
    a: { key: 'a', cn: '冰河', short: '河', desc: '20% 霜爆(Lv7 30%)：首次50%范围减速' },
    b: { key: 'b', cn: '碎冰', short: '碎', desc: '处刑受控：减速目标×2.2，冻结/眩晕×4.5；普攻不减速' },
  },
  lightning: {
    a: { key: 'a', cn: '风暴', short: '暴', desc: '连锁数量增加，链尾伤害提高' },
    b: { key: 'b', cn: '雷枢', short: '枢', desc: '命中概率眩晕，受 Boss 抗性修正' },
  },
  poison: {
    a: { key: 'a', cn: '瘟疫', short: '疫', desc: '毒死敌人时尸爆传染' },
    b: { key: 'b', cn: '腐蚀', short: '蚀', desc: '中毒敌人承受所有伤害提高' },
  },
  light: {
    a: { key: 'a', cn: '审判', short: '审', desc: '处决线提高，处决后获得攻速爆发' },
    b: { key: 'b', cn: '圣辉', short: '辉', desc: '相邻塔增伤，处决时治疗基地' },
  },
};

export function towerDmg(elem, lv) {
  const early = Math.pow(DMG_GROWTH_EARLY, Math.min(lv, 3) - 1);
  const late = Math.pow(DMG_GROWTH_LATE, Math.max(0, lv - 3));
  return ELEMENTS[elem].base * early * late;
}
// 等级伤害系数（与元素无关），供模拟器/展示用
export function dmgFactor(lv) {
  return towerDmg('fire', lv) / ELEMENTS.fire.base;
}
export function towerRange(lv) {
  return 200 * (1 + 0.1 * Math.floor((lv - 1) / 2));
}

// 塔位词缀（GDD §3.8）
export const SLOT_AFFIXES = {
  fountain: { key: 'fountain', icon: '💧', cn: '泉水位', color: 0x4fc3ff, rateMult: 1.15 },
  rock:     { key: 'rock',     icon: '◆', cn: '岩石位', color: 0xff9b45, dmgMult: 1.15 },
  gold:     { key: 'gold',     icon: '💰', cn: '金脉位', color: 0xffd34e, goldMult: 1.10 },
};

// 合成冲击 / 连锁共鸣（GDD §3.2 / §3.3）
export const MERGE_SURGE = {
  resonanceWindow: 4,
  resonanceStep: 0.4,
  resonanceCap: 3,
  autoMultiplier: 0.5,
  fireDuration: 3,
  fireRadius: 64,
  poisonRadius: 200,
  resonanceSlowPct: 30,
  resonanceSlowDuration: 2,
};

// 精英怪（GDD §4.2）
export const ELITE = {
  fromWave: 6,
  chance: 0.35,
  lateWave: 20,
  lateChance: 0.55,
  hpMult: 3,
  sizeMult: 1.3,
  goldMult: 2,
  auraRadius: 120,
  auraSpeedMult: 1.3,
  shieldHits: 3,
  affixes: {
    shield: { key: 'shield', icon: '🛡', cn: '护盾', color: 0x9fe8ff },
    haste:  { key: 'haste',  icon: '🌀', cn: '加速', color: 0x7fe7e0 },
    split:  { key: 'split',  icon: '✹', cn: '裂变', color: 0xff9b45 },
  },
};

// Boss 抗性与词缀（GDD §4.2 / §4.4）
export const BOSS_CONTROL = {
  defaultResist: 0.25,
  resilientResist: 0.5,
  hardControlCd: 0.5,
};

export const BOSS_AFFIXES = {
  resilient: { key: 'resilient', icon: '抗', cn: '坚韧', controlResist: BOSS_CONTROL.resilientResist },
  armored:   { key: 'armored',   icon: '甲', cn: '装甲', armorBonus: 0.3 },
  twin:      { key: 'twin',      icon: '链', cn: '双生', twinHealPct: 0.2 },
  rage:      { key: 'rage',      icon: '怒', cn: '狂怒', rageSpeedMult: 1.25, rageSlowScale: 0.8 },
};

// 普通波阶段压力（GDD §4.2）
export const NON_BOSS_SPEED_CAP = 1.5;
export function nonBossSpeedMult(w) {
  if (w >= 41) return 1.25;
  if (w >= 31) return 1.2;
  if (w >= 21) return 1.1;
  return 1;
}

// 波次数值（GDD §4.3）：HP 增速波 22 后压平 1.19→1.155，拉开不同强度玩家的墓碑差距
export function waveHp(w) {
  return 18 * Math.pow(1.19, Math.min(w, 22)) * Math.pow(1.155, Math.max(0, w - 22));
}
export function waveCount(w) { return Math.min(34, 8 + Math.floor(0.95 * w)); }
// 生成等级地板（GDD §3.1）：相位对齐撞墙区间，封顶 Lv6（Lv7/8 只能靠合成）
export function spawnFloor(w) { return w >= 40 ? 6 : w >= 30 ? 5 : w >= 22 ? 4 : w >= 15 ? 3 : w >= 8 ? 2 : 1; }

// 普通波平均金币系数（按 composeWave 随机池权重推得，推导见 tools/balance-sim.mjs）
function avgGoldMult(w) { return w >= 11 ? 1.47 : w >= 9 ? 1.35 : w >= 6 ? 1.39 : w >= 3 ? 0.89 : 1.0; }
// 期望单波收入（一律按普通波构成估算，Boss 波也用它定价，避免塔价随波型跳变）
export function expectedWaveIncome(w) {
  return waveCount(w) * waveHp(w) * 0.1 * avgGoldMult(w);
}
// 买塔价格（GDD §3.7）：当波收入 35% 起步，波内每多买一次 ×1.3，下波重置。
// 价格挂钩当期支付能力而非购买史 —— 任何玩家每波都稳定买得起 1~2 个，第 3 个要掂量。
export function towerBasePrice(w) {
  return Math.max(20, Math.round(expectedWaveIncome(w) * 0.35));
}
export function towerPrice(w, buysThisWave) {
  return Math.round(towerBasePrice(w) * Math.pow(1.3, buysThisWave));
}

// 敌人类型（GDD §4.2）
export const ENEMY_TYPES = {
  slime:    { hpMult: 1,    speed: 98,  goldMult: 1,   color: 0x87d64a, size: 24, from: 1 },
  runner:   { hpMult: 0.65, speed: 178, goldMult: 0.8, color: 0x55a8ff, size: 20, from: 3 },
  tank:     { hpMult: 3.3,  speed: 64,  goldMult: 2.5, color: 0x9aa17d, size: 28, armor: 0.2, from: 6 },
  flyer:    { hpMult: 0.9,  speed: 96,  goldMult: 1.2, color: 0x8c57d9, size: 22, flying: true, from: 9 },
  splitter: { hpMult: 1.35, speed: 90,  goldMult: 1.5, color: 0xd6c453, size: 26, splits: true, from: 11 },
  mini:     { hpMult: 0.35, speed: 115, goldMult: 0.3, color: 0x87d64a, size: 15, from: 99 },
  boss:     { hpMult: 15,   speed: 48,  goldMult: 14,  color: 0x748255, size: 44, boss: true, from: 5 },
};

// 基地
export const BASE_HP = 15;
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
  { id: 'unlockLight',  cn: '解锁 ✨光', desc: '光元素入池：低血斩杀',   tiers: 1, cost: () => 120 },
  { id: 'autoBuy',   cn: '自动买塔', desc: '金币足够时自动购买',        tiers: 1,  cost: () => 60 },
  { id: 'autoMerge', cn: '自动合成', desc: '自动合并同色同级塔',        tiers: 1,  cost: () => 90 },
  { id: 'speed2x',   cn: '2倍速',    desc: '永久解锁 2 倍速按钮',       tiers: 1,  cost: () => 80 },
];

// 钻石经济（GDD §5.3 基准数值）
export const DIAMOND = { boss: 2, elite: 1, milestone: 3, deathBonusPerWave: 5, adDaily: 5 };
// 离线钻石（GDD §5.1）：每小时 1 + floor(最高波/10)，上限 8h
export function offlineDiamonds(bestWave, hours) {
  const safeHours = Math.min(Math.max(Number(hours) || 0, 0), 8);
  const safeBest = Math.max(Number(bestWave) || 0, 0);
  return Math.floor(safeHours * (1 + Math.floor(safeBest / 10)));
}
