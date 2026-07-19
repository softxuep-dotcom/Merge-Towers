import { ELEMENTS, MAX_LV } from './config.js';
import { getLocale } from './i18n.js';

export const UPGRADE_COSTS = Object.freeze({ 2: 1, 3: 1, 4: 2, 5: 2, 6: 3, 7: 4, 8: 5 });
export const GROWTH_TRACKS = Object.freeze(['range', 'frequency', 'power']);

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
  fire: { range: ['扩爆装药', 'EXPANSIVE CHARGE'], frequency: ['易燃配方', 'VOLATILE MIX'], power: ['高温燃料', 'HIGH-HEAT FUEL'] },
  ice: { range: ['潮域扩张', 'TIDAL REACH'], frequency: ['回流脉冲', 'REFLUX PULSE'], power: ['深寒水压', 'DEEP-FROST PRESSURE'] },
  lightning: { range: ['导体网络', 'CONDUCTOR WEB'], frequency: ['快速充能', 'FAST CHARGE'], power: ['过载电压', 'OVERVOLTAGE'] },
  light: { range: ['光路展开', 'LIGHT PATH'], frequency: ['聚焦透镜', 'FOCUS LENS'], power: ['高能光束', 'HIGH-ENERGY BEAM'] },
  poison: { range: ['扩散培养', 'SPREAD CULTURE'], frequency: ['快速催化', 'FAST CATALYSIS'], power: ['致命毒株', 'LETHAL STRAIN'] },
});

const ULTIMATES = Object.freeze({
  fire: [
    { key: 'supernova', icon: '✹', zh: '超新星', en: 'SUPERNOVA', zhDesc: '技能范围×1.6，并周期性必定触发核心技能', enDesc: 'Skill area x1.6 and periodically guarantees the core skill' },
    { key: 'eternal', icon: '♨', zh: '永燃', en: 'ETERNAL FLAME', zhDesc: '燃烧与火区可叠2层，满层死亡时传播燃烧', enDesc: 'Burns and fire zones stack twice and spread on death' },
    { key: 'heatdeath', icon: '☀', zh: '热寂', en: 'HEAT DEATH', zhDesc: '对高血或低血敌人伤害+60%，Boss始终生效', enDesc: '+60% damage to high/low-HP enemies; always active vs Bosses' },
  ],
  ice: [
    { key: 'iceage', icon: '❄', zh: '冰封纪元', en: 'ICE AGE', zhDesc: '每8秒冻结射程内敌人，Boss只受短暂冻结', enDesc: 'Freeze enemies in range every 8s; shorter against Bosses' },
    { key: 'reverse', icon: '↶', zh: '逆潮', en: 'REVERSE TIDE', zhDesc: '技能可将普通敌人送回路径，Boss改为强减速', enDesc: 'Skills can rewind normal enemies; strongly slow Bosses instead' },
    { key: 'myriad', icon: '◇', zh: '万镜潮生', en: 'MYRIAD MIRRORS', zhDesc: '技能触发后以60%效果重复一次', enDesc: 'Repeat each triggered skill at 60% effect' },
  ],
  lightning: [
    { key: 'skynet', icon: 'ϟ', zh: '天穹雷网', en: 'SKYNET', zhDesc: '电技能目标上限+6，连锁不再衰减', enDesc: '+6 electric skill targets and no chain falloff' },
    { key: 'capacitor', icon: '∿', zh: '无限电容', en: 'INFINITE CAPACITOR', zhDesc: '技能触发返还30%攻击间隔，连续触发后强化', enDesc: 'Skill triggers refund 30% attack time and build a burst streak' },
    { key: 'stormeye', icon: '◉', zh: '风暴眼', en: 'STORM EYE', zhDesc: '同一敌人累计8次电击后引爆350%伤害', enDesc: 'Explode a target for 350% damage after 8 electric hits' },
  ],
  light: [
    { key: 'sevenlight', icon: '✧', zh: '七重天光', en: 'SEVENFOLD LIGHT', zhDesc: '每第7次攻击追加7道70%伤害的天光', enDesc: 'Every 7th attack calls 7 sky beams for 70% damage each' },
    { key: 'finaljudgement', icon: '⚖', zh: '最终审判', en: 'FINAL JUDGMENT', zhDesc: '强化精英处决，并随Boss失血持续增伤', enDesc: 'Stronger elite execution and rising damage as Boss HP falls' },
    { key: 'daylight', icon: '☀', zh: '永昼圣域', en: 'ETERNAL DAYLIGHT', zhDesc: '强化全队技能，且每波抵消基地首次受伤', enDesc: 'Boost allied skills and block the first base hit each wave' },
  ],
  poison: [
    { key: 'blackdeath', icon: '☣', zh: '黑死病', en: 'BLACK DEATH', zhDesc: '毒可叠3层，满层敌人死亡必定传播', enDesc: 'Poison stacks 3 times and full stacks always spread on death' },
    { key: 'dissolve', icon: '⬡', zh: '溶解装甲', en: 'ARMOR DISSOLVE', zhDesc: '毒伤完全无视护甲，溢出减甲转化为毒伤', enDesc: 'Poison fully ignores armor and excess shred becomes damage' },
    { key: 'hive', icon: '◌', zh: '菌群意识', en: 'HIVE MIND', zhDesc: '场上中毒敌人越多，毒塔攻速与技能伤害越高', enDesc: 'More poisoned enemies grant attack speed and skill damage' },
  ],
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
  const coreName = local(coreSkillDef(tower.elem, tower.skill)) || tower.skill;
  const ultimate = tower.ultimate ? ULTIMATES[tower.elem]?.find(def => def.key === tower.ultimate) : null;
  return ultimate ? `${coreName} / ${local(ultimate)}` : coreName;
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
    const vals = [10, 14, 18, 22, 26, 30];
    return zh ? `；圣辉增伤 ${vals[rank - 1]}%→${vals[rank]}%` : `; Radiance bonus ${vals[rank - 1]}%→${vals[rank]}%`;
  }
  return '';
}

function growthDescription(tower, track, rank) {
  if (isZh()) {
    if (track === 'range') return `范围 Rank ${rank}：攻击射程+6%；技能半径+15~20，范围伤害+8~10%`;
    if (track === 'frequency') return `频率 Rank ${rank}：攻击速度+8%${triggerDetail(tower, rank, true)}`;
    const gain = tower.elem === 'fire' ? (rank === 1 ? 30 : 15) : tower.elem === 'poison' ? 20 : tower.elem === 'lightning' ? 18 : 15;
    return `强度 Rank ${rank}：核心命中与技能伤害+${gain}%`;
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
  if (tower.lv < 7) return GROWTH_TRACKS.map(track => {
    const nextRank = (tower.ranks?.[track] || 0) + 1;
    const pair = TRACK_NAMES[tower.elem][track];
    return {
      kind: 'growth', key: track, icon: track === 'range' ? '◎' : track === 'frequency' ? '↻' : '▲',
      name: isZh() ? pair[0] : pair[1], description: growthDescription(tower, track, nextRank),
      badge: `RANK ${nextRank}`, color: ELEMENTS[tower.elem].color,
    };
  });
  return ULTIMATES[tower.elem].map(def => ({
    kind: 'ultimate', key: def.key, icon: def.icon, name: local(def), description: local(def, true),
    badge: isZh() ? '终极变异' : 'ULTIMATE', color: ELEMENTS[tower.elem].color,
  }));
}

export function applyTowerUpgrade(tower, choice) {
  if (!tower || !choice || tower.lv >= MAX_LV) return false;
  if (choice.kind === 'core' && tower.lv === 1) tower.skill = choice.key;
  else if (choice.kind === 'growth' && tower.lv >= 2 && tower.lv < 7) tower.ranks[choice.key] = Math.min(5, (tower.ranks[choice.key] || 0) + 1);
  else if (choice.kind === 'ultimate' && tower.lv === 7) tower.ultimate = choice.key;
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
