import { ELEMENTS, MAX_LV } from './config.js';
import { getLocale } from './i18n.js';

// Keep late upgrades meaningful without making them several times slower than
// the opening choices. Half-point steps also stay readable in the HUD.
export const UPGRADE_COSTS = Object.freeze({ 2: 1, 3: 1, 4: 1.5, 5: 1.5, 6: 2, 7: 2, 8: 2.5, 9: 3 });
export const SOURCE_PER_WAVE = 0.75;
export const SOURCE_KILL_SHARE = 0.58;
export const GOLD_PER_SOURCE = 140;
export const GROWTH_TRACKS = Object.freeze(['range', 'frequency', 'power']);
export const MAX_GROWTH_RANK = 5;

const CORE = Object.freeze({
  fire: [
    { key: 'blast', icon: '✹', zh: '爆裂', en: 'BLAST', zhDesc: '溅射+20%；30%概率燃烧35%/秒，持续2秒', enDesc: '+20% splash; 30% chance to burn for 35%/s over 2s' },
    { key: 'molten', icon: '♨', zh: '熔核', en: 'MOLTEN CORE', zhDesc: '慢速重炮：命中+90%，20%概率造成2.5倍暴击', enDesc: 'Heavy cannon: +90% hit damage, 20% chance for 2.5x crit' },
    { key: 'scorched', icon: '▰', zh: '焦土', en: 'SCORCHED EARTH', zhDesc: '25%概率留下持续3秒的灼烧区域', enDesc: '25% chance to leave a burning zone for 3s' },
  ],
  ice: [
    { key: 'glacier', icon: '❄', zh: '冰河', en: 'GLACIER', zhDesc: '25%概率霜爆，造成范围伤害与群体减速', enDesc: '25% chance for an area frost burst and group slow' },
    { key: 'vortex', icon: '◉', zh: '漩涡', en: 'VORTEX', zhDesc: '20%概率卷回普通敌人并施加群体减速', enDesc: '20% chance to rewind normal enemies and slow an area' },
    { key: 'mirror', icon: '◇', zh: '水镜', en: 'WATER MIRROR', zhDesc: '每第4次攻击分裂为3枚继承减速的水箭', enDesc: 'Every 4th attack splits into 3 slowing bolts' },
  ],
  lightning: [
    { key: 'chain', icon: 'ϟ', zh: '连锁', en: 'CHAIN', zhDesc: '攻击弹射3个目标，每段伤害衰减20%', enDesc: 'Attacks chain through 3 targets with 20% falloff' },
    { key: 'nexus', icon: '⌾', zh: '雷枢', en: 'NEXUS', zhDesc: '取消弹射；命中+35%，18%概率眩晕0.8秒', enDesc: 'No chain; +35% hit damage and 18% chance to stun' },
    { key: 'magstorm', icon: '◉', zh: '磁暴', en: 'MAGSTORM', zhDesc: '每第5次攻击生成持续2.5秒的电场', enDesc: 'Every 5th attack creates a 2.5s electric field' },
  ],
  light: [
    { key: 'refraction', icon: '✧', zh: '折射', en: 'REFRACTION', zhDesc: '光束折射至2个目标，副光束造成40%伤害', enDesc: 'Beam refracts to 2 targets for 40% damage' },
    { key: 'judgement', icon: '⚖', zh: '审判', en: 'JUDGMENT', zhDesc: '处决生命低于12%的非Boss；Boss转为低血增伤', enDesc: 'Execute non-Bosses below 12%; gain low-HP damage vs Bosses' },
    { key: 'radiance', icon: '☀', zh: '圣辉', en: 'RADIANCE', zhDesc: 'R130内其他塔伤害+10%，不加成自身', enDesc: 'Other towers within R130 deal +10% damage' },
  ],
  poison: [
    { key: 'plague', icon: '☣', zh: '瘟疫', en: 'PLAGUE', zhDesc: '中毒敌人死亡时向附近3个目标传播毒素', enDesc: 'Poison spreads to 3 nearby targets on death' },
    { key: 'corrosion', icon: '⬡', zh: '腐蚀', en: 'CORROSION', zhDesc: '中毒目标减甲15%，受到全队伤害+8%', enDesc: 'Poisoned targets lose 15% armor and take +8% team damage' },
    { key: 'spores', icon: '◌', zh: '孢潮', en: 'SPORE TIDE', zhDesc: '每第5次攻击生成持续4秒的毒云', enDesc: 'Every 5th attack creates a poison cloud for 4s' },
  ],
});

const TRACK_NAMES = Object.freeze({
  blast: { range: ['扩爆装药', 'EXPANSIVE CHARGE'], frequency: ['易燃配方', 'VOLATILE MIX'], power: ['高温燃料', 'HIGH-HEAT FUEL'] },
  molten: { range: ['震荡弹壳', 'SHOCK SHELL'], frequency: ['临界点火', 'CRITICAL IGNITION'], power: ['熔核增压', 'CORE PRESSURE'] },
  scorched: { range: ['火域扩张', 'FIRE ZONE'], frequency: ['余烬循环', 'EMBER CYCLE'], power: ['地火增压', 'GROUND-FIRE BOOST'] },
  glacier: { range: ['冰爆扩散', 'FROST SPREAD'], frequency: ['寒潮回响', 'COLD ECHO'], power: ['极寒增压', 'DEEP-FROST BOOST'] },
  vortex: { range: ['涡流扩张', 'VORTEX REACH'], frequency: ['潮汐共振', 'TIDAL RESONANCE'], power: ['回卷增压', 'REWIND PRESSURE'] },
  mirror: { range: ['镜箭阵列', 'MIRROR ARRAY'], frequency: ['分流节拍', 'SPLIT RHYTHM'], power: ['镜面贯注', 'MIRROR FOCUS'] },
  chain: { range: ['导体网络', 'CONDUCTOR WEB'], frequency: ['连锁充能', 'CHAIN CHARGE'], power: ['过载电压', 'OVERVOLTAGE'] },
  nexus: { range: ['感应半径', 'SENSE RADIUS'], frequency: ['雷枢充能', 'NEXUS CHARGE'], power: ['裁决电压', 'JUDGMENT VOLTAGE'] },
  magstorm: { range: ['磁场扩张', 'FIELD EXPANSION'], frequency: ['磁暴循环', 'STORM CYCLE'], power: ['超导增压', 'SUPERCONDUCTOR'] },
  refraction: { range: ['光路展开', 'LIGHT PATH'], frequency: ['折射节拍', 'REFRACTION RHYTHM'], power: ['高能光束', 'HIGH-ENERGY BEAM'] },
  judgement: { range: ['审判扩散', 'JUDGMENT SPREAD'], frequency: ['裁决加速', 'VERDICT HASTE'], power: ['处决增幅', 'EXECUTION POWER'] },
  radiance: { range: ['圣辉领域', 'RADIANT FIELD'], frequency: ['共鸣频率', 'RESONANT RATE'], power: ['光环增幅', 'AURA POWER'] },
  plague: { range: ['扩散培养', 'SPREAD CULTURE'], frequency: ['快速催化', 'FAST CATALYSIS'], power: ['致命毒株', 'LETHAL STRAIN'] },
  corrosion: { range: ['腐蚀扩散', 'CORROSIVE SPREAD'], frequency: ['酸蚀成形', 'ACID FORMATION'], power: ['强酸配方', 'STRONG ACID'] },
  spores: { range: ['菌云扩张', 'SPORE CLOUD'], frequency: ['孢潮循环', 'SPORE CYCLE'], power: ['孢子增压', 'SPORE PRESSURE'] },
});

function isZh() { return getLocale() === 'zh-CN'; }
function local(def, desc = false) { return isZh() ? (desc ? def.zhDesc : def.zh) : (desc ? def.enDesc : def.en); }

export function upgradeCostFor(tower) {
  if (!tower || tower.lv >= MAX_LV) return Infinity;
  return UPGRADE_COSTS[tower.lv + 1] ?? Infinity;
}

export function coreSkillDef(elem, key) { return CORE[elem]?.find(def => def.key === key) || null; }
export function towerSkillName(tower) {
  if (!tower?.skill) return isZh() ? '尚未裂变' : 'UNSPLIT';
  return local(coreSkillDef(tower.elem, tower.skill)) || tower.skill;
}

function triggerDetail(tower, rank, zh) {
  const tables = {
    blast: [30, 50, 55, 60, 65, 70], molten: [20, 26, 32, 38, 44, 50], scorched: [25, 32, 39, 46, 53, 60],
    glacier: [25, 35, 40, 45, 50, 55], vortex: [20, 30, 35, 40, 45, 50], nexus: [18, 28, 34, 40, 46, 52],
  };
  const cadence = { mirror: [4, 3, 3, 3, 2, 2], magstorm: [5, 4, 4, 3, 3, 2], spores: [5, 4, 4, 3, 3, 2] };
  if (tables[tower.skill]) {
    const a = tables[tower.skill][rank - 1], b = tables[tower.skill][rank];
    return zh ? `；技能触发率 ${a}%→${b}%` : `; skill proc ${a}%→${b}%`;
  }
  if (cadence[tower.skill]) {
    const a = cadence[tower.skill][rank - 1], b = cadence[tower.skill][rank];
    return zh ? `；触发周期 ${a}→${b} 次攻击` : `; trigger cycle ${a}→${b} attacks`;
  }
  if (tower.skill === 'radiance') {
    const vals = [0, 2, 4, 6, 8, 10];
    return zh ? `；光环内友军攻速 +${vals[rank - 1]}%→+${vals[rank]}%` : `; allied aura speed +${vals[rank - 1]}%→+${vals[rank]}%`;
  }
  return '';
}

function growthDescription(tower, track, rank) {
  if (isZh()) {
    if (track === 'range') return `范围 Rank ${rank}：攻击射程+6%；技能半径+15~20，范围伤害+8~10%`;
    if (track === 'frequency') return `频率 Rank ${rank}：攻击速度+8%${triggerDetail(tower, rank, true)}`;
    const gain = tower.elem === 'fire' ? (rank === 1 ? 30 : 15) : tower.elem === 'poison' ? 20 : tower.elem === 'lightning' ? 18 : 15;
    const aura = tower.skill === 'radiance' ? '；圣辉增伤 +4 个百分点' : '';
    return `强度 Rank ${rank}：核心命中与技能伤害+${gain}%${aura}`;
  }
  if (track === 'range') return `RANGE Rank ${rank}: +6% range; +15–20 skill radius and +8–10% area damage`;
  if (track === 'frequency') return `FREQUENCY Rank ${rank}: +8% attack speed${triggerDetail(tower, rank, false)}`;
  const gain = tower.elem === 'fire' ? (rank === 1 ? 30 : 15) : tower.elem === 'poison' ? 20 : tower.elem === 'lightning' ? 18 : 15;
  return `POWER Rank ${rank}: +${gain}% core hit and skill damage`;
}

export function upgradeChoicesFor(tower) {
  if (!tower || tower.lv >= MAX_LV) return [];
  if (tower.lv === 1) return CORE[tower.elem].map(def => ({
    kind: 'core', key: def.key, icon: def.icon, name: local(def), description: local(def, true),
    badge: isZh() ? '核心裂变' : 'CORE SPLIT', color: ELEMENTS[tower.elem].color,
  }));
  return GROWTH_TRACKS.map(track => {
    const currentRank = tower.ranks?.[track] || 0;
    const maxed = currentRank >= MAX_GROWTH_RANK;
    const nextRank = Math.min(MAX_GROWTH_RANK, currentRank + 1);
    const pair = TRACK_NAMES[tower.skill]?.[track] || [track, track.toUpperCase()];
    return {
      kind: 'growth', key: track, icon: track === 'range' ? '◎' : track === 'frequency' ? '↻' : '▲',
      name: isZh() ? pair[0] : pair[1],
      description: maxed
        ? (isZh() ? '已达到 Rank 5 上限，请选择其他强化方向' : 'Rank 5 reached; choose another upgrade track')
        : growthDescription(tower, track, nextRank),
      badge: maxed ? 'MAX' : `RANK ${nextRank}`,
      disabled: maxed,
      color: ELEMENTS[tower.elem].color,
    };
  });
}

export function applyTowerUpgrade(tower, choice) {
  if (!tower || !choice || tower.lv >= MAX_LV) return false;
  if (choice.kind === 'core' && tower.lv === 1) tower.skill = choice.key;
  else if (choice.kind === 'growth' && tower.lv >= 2) {
    const rank = tower.ranks?.[choice.key] || 0;
    if (rank >= MAX_GROWTH_RANK) return false;
    tower.ranks[choice.key] = rank + 1;
  }
  else return false;
  tower.lv++;
  tower.refreshLevelVisual?.();
  return true;
}

export function growthRank(tower, key) { return tower?.ranks?.[key] || 0; }
export function frequencyRank(tower) { return growthRank(tower, 'frequency'); }
export function rangeRank(tower) { return growthRank(tower, 'range'); }
export function powerMultiplier(tower) {
  const n = growthRank(tower, 'power');
  if (!n) return 1;
  if (tower.elem === 'fire') return [1, 1.3, 1.45, 1.6, 1.75, 1.9][n];
  return 1 + (tower.elem === 'poison' ? 0.2 : tower.elem === 'lightning' ? 0.18 : 0.15) * n;
}
