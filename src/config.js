import { t } from './i18n.js';

// 全部平衡数值集中在此，对应 GDD-UpgradeTowers-Review.md
export const W = 720, H = 1280;
export const MAX_LV = 9;
export const DEFAULT_DIFFICULTY = 'easy';
export const ENEMY_HP_MULT = 1.12;
// Waves are clock-driven now. Keep only a tiny reveal beat between waves so the
// next group arrives on schedule instead of waiting for the field to be clear.
export const PREP_DURATION_MS = 180;
export const EARLY_WAVE_CUTOFF = 5;
export const EARLY_WAVE_SPAWN_INTERVAL_MULT = 0.6;
export const DIFFICULTIES = {
  easy:   { key: 'easy',   cn: t('difficulty.easy'), hpBase: 20, color: 0x59c98f },
  normal: { key: 'normal', cn: t('difficulty.normal'), hpBase: 25, color: 0xffd34e },
  hard:   { key: 'hard',   cn: t('difficulty.hard'), hpBase: 29, color: 0xff7a7a },
};
// 固定五塔的基础等级成长保持温和，主要强度来自每级卡片决策。
export const DMG_GROWTH_EARLY = 1.35;
export const DMG_GROWTH_LATE = 1.35;

// 元素定义（GDD §3.2 / §3.3）
export const ELEMENTS = {
  fire:      { key: 'fire',      cn: t('element.fire'), color: 0xff5a3c, base: 12, rate: 0.8, desc: t('element.splash') },
  ice:       { key: 'ice',       cn: t('element.frost'), color: 0x4fc3ff, base: 7, rate: 1.0, desc: t('element.slow') },
  lightning: { key: 'lightning', cn: t('element.storm'), color: 0xffd94f, base: 9, rate: 1.2, desc: t('element.chain') },
  poison:    { key: 'poison',    cn: t('element.venom'), color: 0x7ede55, base: 4, rate: 1.5, desc: t('element.toxin') },
  light:     { key: 'light',     cn: t('element.light'), color: 0xfff3c4, base: 25, rate: 0.6, desc: t('element.execute') },
};

export const BRANCH_START_LV = 3;
export const BRANCH_BOOST_LV = 5;
export const BRANCH_CAPSTONE_LV = 7;

export function branchTierValue(lv, lv3, lv5, lv7) {
  return lv >= BRANCH_CAPSTONE_LV ? lv7 : (lv >= BRANCH_BOOST_LV ? lv5 : lv3);
}

// Lv3 分支进化，Lv5 / Lv7 分段强化（GDD §3.5）
export const TOWER_BRANCHES = {
  fire: {
    a: { key: 'a', cn: t('branch.fireA'), short: 'B', desc: t('branch.fireADesc') },
    b: { key: 'b', cn: t('branch.fireB'), short: 'C', desc: t('branch.fireBDesc') },
  },
  ice: {
    a: { key: 'a', cn: t('branch.iceA'), short: 'G', desc: t('branch.iceADesc') },
    b: { key: 'b', cn: t('branch.iceB'), short: 'S', desc: t('branch.iceBDesc') },
  },
  lightning: {
    a: { key: 'a', cn: t('branch.stormA'), short: 'T', desc: t('branch.stormADesc') },
    b: { key: 'b', cn: t('branch.stormB'), short: 'N', desc: t('branch.stormBDesc') },
  },
  poison: {
    a: { key: 'a', cn: t('branch.venomA'), short: 'P', desc: t('branch.venomADesc') },
    b: { key: 'b', cn: t('branch.venomB'), short: 'C', desc: t('branch.venomBDesc') },
  },
  light: {
    a: { key: 'a', cn: t('branch.lightA'), short: 'J', desc: t('branch.lightADesc') },
    b: { key: 'b', cn: t('branch.lightB'), short: 'R', desc: t('branch.lightBDesc') },
  },
};

export function towerDmg(elem, lv) {
  return ELEMENTS[elem].base * Math.pow(DMG_GROWTH_EARLY, Math.max(0, lv - 1));
}
// 等级伤害系数（与元素无关），供模拟器/展示用
export function dmgFactor(lv) {
  return towerDmg('fire', lv) / ELEMENTS.fire.base;
}
export function towerRange(lv) {
  return 200 * (1 + 0.05 * Math.floor(lv / 2));
}

export const TOWER_RANGE_MULT = {
  ice: 1.1,
  poison: 1.1,
};

export const FIRE_BRANCH_BALANCE = {
  explosiveDamageMult: 0.9,
  explosiveRadiusMult: { lv3: 1.35, lv5: 1.6, lv7: 1.6 },
  explosiveBurnDpsMult: { lv3: 0.35, lv5: 0.45, lv7: 0.45 },
  explosiveBurnDuration: { lv3: 2, lv5: 3, lv7: 4 },
  moltenDamageMult: { lv3: 1.7, lv5: 2.2, lv7: 2.2 },
  moltenRateMult: { lv3: 0.8, lv5: 0.7, lv7: 0.7 },
  moltenCritChance: { lv3: 0.15, lv5: 0.3, lv7: 0.5 },
};

export const ICE_SHATTER = {
  lv3FreezeChance: 0.18,
  lv3Radius: 80,
  lv3FreezeDuration: 0.9,
  lv5FreezeChance: 0.28,
  lv5Radius: 110,
  lv5FreezeDuration: 1.2,
  lv7FreezeChance: 0.35,
  lv7Radius: 130,
  lv7FreezeDuration: 1.2,
};

export const ICE_RIVER = {
  lv3NovaChance: 0.15,
  lv3MainDamageMult: 1.6,
  lv3SplashDamageMult: 0.6,
  lv3NovaRadius: 156,
  lv3SlowDuration: 2,
  lv5NovaChance: 0.22,
  lv5MainDamageMult: 2.2,
  lv5SplashDamageMult: 0.9,
  lv5NovaRadius: 180,
  lv5SlowDuration: 2.4,
  lv7NovaChance: 0.3,
  lv7MainDamageMult: 2.6,
  lv7SplashDamageMult: 1.2,
  lv7NovaRadius: 196,
  lv7SlowDuration: 2.8,
};

export const LIGHTNING_HUB = {
  lv3StunChance: 0.15,
  lv3StunDuration: 0.8,
  lv5StunChance: 0.25,
  lv5StunDuration: 1.2,
  lv7StunChance: 0.35,
  lv7StunDuration: 1.6,
};

export const PLAGUE = {
  lv3DamageMult: 1.2,
  lv3SpreadRadius: 70,
  lv5DamageMult: 1.4,
  lv5SpreadRadius: 110,
  lv7DamageMult: 1.6,
  lv7SpreadRadius: 190,
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
  fromWave: 3,
  chance: 0.35,
  lateWave: 20,
  lateChance: 0.55,
  hpMult: 3,
  sizeMult: 1.3,
  goldMult: 2,
  // 加速光环按地图格判定：自身格 + 周围 8 格（3x3 九宫格）。
  hasteCellSize: 100,
  auraSpeedMult: 1.3,
  shieldHits: 3,
  affixes: {
    shield: { key: 'shield', icon: '🛡', cn: 'SHIELD', color: 0x9fe8ff },
    haste:  { key: 'haste',  icon: '🌀', cn: 'HASTE', color: 0x7fe7e0 },
    split:  { key: 'split',  icon: '✹', cn: 'FISSION', color: 0xff9b45 },
  },
};

// Boss 抗性与词缀（GDD §4.2 / §4.4）
export const BOSS_CONTROL = {
  defaultResist: 0.25,
  resilientResist: 0.5,
  hardControlCd: 0.5,
};

export const BOSS_AFFIXES = {
  resilient: { key: 'resilient', icon: 'R', cn: 'RESILIENT', controlResist: BOSS_CONTROL.resilientResist },
  armored:   { key: 'armored',   icon: 'A', cn: 'ARMORED', armorBonus: 0.3 },
  twin:      { key: 'twin',      icon: 'T', cn: 'TWIN', twinHealPct: 0.2 },
  rage:      { key: 'rage',      icon: '!', cn: 'RAGE', rageSpeedMult: 1.25, rageSlowScale: 0.8 },
};

// 普通波阶段压力（GDD §4.2）
export const NON_BOSS_SPEED_CAP = 1.5;
export function nonBossSpeedMult(w) {
  if (w >= 41) return 1.25;
  if (w >= 31) return 1.2;
  if (w >= 21) return 1.1;
  return 1;
}

// 轻量波次事件：只在普通波出现，提前在准备阶段公开。
export const WAVE_EVENTS = {
  fromWave: 3,
  chance: 0.35,
  swarm: { key: 'swarm', countMult: 1.25, hpMult: 0.8 },
  armored: { key: 'armored', armorBonus: 0.18 },
  haste: { key: 'haste', speedMult: 1.25, hpMult: 0.9 },
};

// 波次数值（GDD §4.3）：HP 增速波 22 后压平 1.19→1.155，拉开不同强度玩家的墓碑差距
export function waveHp(w, difficulty = DEFAULT_DIFFICULTY) {
  const hpBase = DIFFICULTIES[difficulty]?.hpBase ?? DIFFICULTIES[DEFAULT_DIFFICULTY].hpBase;
  return hpBase * ENEMY_HP_MULT * Math.pow(1.19, Math.min(w, 22)) * Math.pow(1.155, Math.max(0, w - 22));
}
// Fewer bodies keep the battlefield readable and reduce browser load. Pressure
// is carried by slightly tougher units, elites and affixes instead of crowding.
export function waveCount(w) { return w === 1 ? 8 : Math.min(42, 10 + Math.floor(w)); }
// 生成等级地板（GDD §3.1）：相位对齐撞墙区间，封顶 Lv6（Lv7/8 只能靠合成）
export function spawnFloor(w) { return w >= 40 ? 6 : w >= 30 ? 5 : w >= 22 ? 4 : w >= 15 ? 3 : w >= 8 ? 2 : 1; }

// 普通波平均金币系数（按 composeWave 当前随机池权重推得）。
function avgGoldMult(w) {
  if (w >= 14) return 1.51;
  if (w >= 10) return 1.47;
  if (w >= 7) return 1.42;
  if (w >= 5) return 1.46;
  return w >= 3 ? 0.89 : 1;
}
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
  tank:     { hpMult: 3.6,  speed: 64,  goldMult: 2.7, color: 0x9aa17d, size: 28, armor: 0.22, from: 5 },
  flyer:    { hpMult: 1.05, speed: 96,  goldMult: 1.3, color: 0x8c57d9, size: 22, flying: true, from: 7 },
  splitter: { hpMult: 1.55, speed: 90,  goldMult: 1.7, color: 0xd6c453, size: 26, splits: true, from: 10 },
  priest:   { hpMult: 1.35, speed: 78,  goldMult: 1.9, color: 0x42d9c7, size: 25, healer: true, from: 14 },
  mini:     { hpMult: 0.35, speed: 115, goldMult: 0.3, color: 0x87d64a, size: 15, from: 99 },
  boss:     { hpMult: 17,   speed: 48,  goldMult: 15,  color: 0x748255, size: 44, boss: true, from: 5 },
};

// 基地
export const BASE_HP = 15;
export const LEAK_NORMAL = 1, LEAK_BOSS = 10;

// 阶段色调（GDD §2）
export const PHASES = [
  { from: 1, bg: 0x2a3d2f, ground: 0x35503b, name: t('phase.day') },
  { from: 8, bg: 0x3d3226, ground: 0x4d4030, name: t('phase.dusk') },
  { from: 21, bg: 0x252244, ground: 0x312d55, name: t('phase.night') },
  { from: 31, bg: 0x3a1e26, ground: 0x4a2830, name: t('phase.blood') },
];
export function phaseFor(w) {
  let p = PHASES[0];
  for (const ph of PHASES) if (w >= ph.from) p = ph;
  return p;
}

// 局外升级（GDD §5.3），cost(t) t 为已购档数
export const UPGRADES = [
  { id: 'startLv', cn: t('upgrade.startLv'), desc: t('upgrade.startLvDesc'), tiers: 10, cost: n => 8 + n * 6 },
  { id: 'startGold', cn: t('upgrade.startGold'), desc: t('upgrade.startGoldDesc'), tiers: 10, cost: n => 8 + n * 5 },
  { id: 'baseArmor', cn: t('upgrade.baseArmor'), desc: t('upgrade.baseArmorDesc'), tiers: 5, cost: n => 10 + n * 8 },
  { id: 'interest', cn: t('upgrade.interest'), desc: t('upgrade.interestDesc'), tiers: 3, cost: n => 15 + n * 15 },
  { id: 'speed2x', cn: t('upgrade.speed2x'), desc: t('upgrade.speed2xDesc'), tiers: 1, cost: () => 80 },
];

// 钻石经济（GDD §5.3 基准数值）
export const DIAMOND = { boss: 2, elite: 1, milestone: 3, deathBonusPerWave: 5, adDaily: 30 };
// 离线钻石（GDD §5.1）：每小时 1 + floor(最高波/10)，上限 8h
export function offlineDiamonds(bestWave, hours) {
  const safeHours = Math.min(Math.max(Number(hours) || 0, 0), 8);
  const safeBest = Math.max(Number(bestWave) || 0, 0);
  return Math.floor(safeHours * (1 + Math.floor(safeBest / 10)));
}
