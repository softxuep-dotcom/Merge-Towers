// 数值模拟器：把每波的 收入/塔价/玩家DPS/需求DPS 跑成表，预测墓碑波
// 用法: node tools/balance-sim.mjs
// 数据源: 直接 import src/config.js —— 改数值后重跑即可看曲线，无需开游戏
const {
  waveHp, waveCount, spawnFloor, towerPrice, nonBossSpeedMult, dmgFactor,
  ENEMY_TYPES, ELEMENTS, ELITE, BASE_HP, MAX_LV,
} = await import('../src/config.js');

// ---------- 软参数（战斗抽象模型，锚定校准见 README 注释） ----------
const PATH_LEN = 2514;          // 地面路径像素长
const FLY_LEN = 1150;           // 飞行航道
const COVERAGE = 0.5;           // 路径被塔射程覆盖的比例（10 塔位满编估计）
const UTILIZATION = 0.85;       // 塔有目标可打的时间占比
const GROUP_MULT = 1.55;        // 溅射/连锁的群伤等效系数
const AVG_UNIT_DPS = (() => {   // 平均每个 Lv1 等效单位的 DPS（五元素均值）
  const es = Object.values(ELEMENTS);
  return es.reduce((s, e) => s + e.base * e.rate, 0) / es.length;
})();
const CONSOLIDATION = lv => dmgFactor(lv) / Math.pow(2, lv - 1); // 合成聚合加成：伤害系数/单位数（自动适配分段增长）
const BRANCH_MULT = 1.25;       // Lv5–6 分支平均战力系数（Lv3 较弱、Lv7 为终极强化）
const branchMultFor = lv => (lv >= 7 ? 1.35 : lv >= 5 ? BRANCH_MULT : lv >= 3 ? 1.15 : 1);
const SURGE_BONUS = 0.08;       // 手动玩家的合成冲击等效 DPS 加成

// ---------- 期望波构成（复刻 GameScene.composeWave 的权重，取期望值） ----------
function expectedWave(w) {
  const list = []; // {hpMult, goldMult, speed, weight(期望只数), flying, boss}
  if (w % 5 === 0) {
    const bosses = w < 20 ? 1 : w < 30 ? 2 : 3 + Math.floor((w - 30) / 20);
    list.push({ ...ENEMY_TYPES.boss, n: bosses, boss: true });
    if (w >= 10) {
      const guards = Math.min(14, waveCount(w) - bosses);
      list.push({ ...ENEMY_TYPES.slime, n: guards * 0.4 });
      list.push({ ...ENEMY_TYPES.runner, n: guards * 0.6 });
    }
    return list;
  }
  const pool = [['slime', 20]];
  if (w >= ENEMY_TYPES.runner.from) pool.push(['runner', 24]);
  if (w >= ENEMY_TYPES.tank.from) pool.push(['tank', 20]);
  if (w >= ENEMY_TYPES.flyer.from) pool.push(['flyer', 18]);
  if (w >= ENEMY_TYPES.splitter.from) pool.push(['splitter', 16]);
  const total = pool.reduce((s, p) => s + p[1], 0);
  const n = waveCount(w);
  for (const [k, wgt] of pool) {
    let cnt = n * wgt / total;
    list.push({ ...ENEMY_TYPES[k], n: cnt, key: k });
    if (k === 'splitter') list.push({ ...ENEMY_TYPES.mini, n: cnt * 2 }); // 分裂
  }
  // 精英：期望值替换 1 只（血x3 金x2 另+1钻）
  if (w >= ELITE.fromWave && w % 5 !== 0) {
    const ch = w >= ELITE.lateWave ? ELITE.lateChance : ELITE.chance;
    list.push({ hpMult: ELITE.hpMult, goldMult: 2, speed: 90, n: ch, elite: true });
  }
  return list;
}

function waveIncome(w) {
  let gold = 0;
  for (const e of expectedWave(w)) {
    gold += e.n * Math.max(1, Math.round(waveHp(w) * 0.1 * (e.goldMult ?? 1)));
  }
  return gold;
}

function waveStats(w) {
  const speedMult = nonBossSpeedMult(w);
  let totalHp = 0, exposure = 0, n = 0, leakCost = 0;
  for (const e of expectedWave(w)) {
    const hp = waveHp(w) * e.hpMult;
    totalHp += e.n * hp;
    const len = e.flying ? FLY_LEN : PATH_LEN;
    const spd = e.speed * (e.boss ? 1 : speedMult);
    exposure += e.n * (len * COVERAGE / spd);
    n += e.n;
    leakCost += e.n * (e.boss ? 10 : 1);
  }
  // 波时长 ≈ 刷兵间隔铺开 + 平均通过时间
  const interval = Math.min(1.2, Math.max(0.35, 15 / Math.max(1, n)));
  const duration = interval * n + exposure / Math.max(1, n);
  return { totalHp, n, duration, avgHpPer: totalHp / Math.max(1, n), leakCost };
}

// ---------- 价格公式 ----------
const PRICING = {
  legacy: {
    name: '旧(参考): 20×1.15^累计购买',
    cost: (state, w) => Math.round(20 * Math.pow(1.15, state.totalBuys)),
  },
  live: {
    name: '现行(config.towerPrice)',
    cost: (state, w) => towerPrice(w, state.buysThisWave),
  },
};

// ---------- 玩家画像 ----------
const ARCHETYPES = {
  first:  { name: '首局零升级(手动)', startGold: 40, lvChance: 0,    interest: 0, armor: 0, maxBuysPerWave: 3, surge: SURGE_BONUS },
  run5:   { name: '第5局基础升级',    startGold: 100, lvChance: 0.10, interest: 1, armor: 1, maxBuysPerWave: 3, surge: SURGE_BONUS },
  greedy: { name: '狂买型(每波尽买)',  startGold: 40, lvChance: 0,    interest: 0, armor: 0, maxBuysPerWave: 9, surge: SURGE_BONUS },
};

function estimateMainLv(units) {
  // 假设塔的等级金字塔：最高塔 ≈ 用掉一半单位
  let lv = 1;
  while (lv < MAX_LV && Math.pow(2, lv) <= units * 0.55) lv++;
  return lv;
}

// 地板方案：current = config.spawnFloor（v2.0 已是 8/15/22/30/40 封顶 Lv6）
const FLOORS = {
  current: { name: '现行地板(config.spawnFloor)', fn: spawnFloor },
  legacy: { name: '旧地板 10/20/30→Lv4(参考)', fn: w => (w >= 30 ? 4 : w >= 20 ? 3 : w >= 10 ? 2 : 1) },
};

function simulate(archKey, priceKey, floorKey = 'current', maxWave = 70) {
  const A = ARCHETYPES[archKey];
  const P = PRICING[priceKey];
  const floorFn = FLOORS[floorKey].fn;
  const state = {
    gold: A.startGold, units: 2, totalBuys: 0, buysThisWave: 0,
    baseHp: BASE_HP + 2 * A.armor,
  };
  const rows = [];
  for (let w = 1; w <= maxWave; w++) {
    state.buysThisWave = 0;
    // 购买阶段（波前+波中简化为波前）
    const floor = floorFn(w);
    while (state.buysThisWave < A.maxBuysPerWave) {
      const cost = P.cost(state, w);
      if (state.gold < cost) break;
      state.gold -= cost;
      state.totalBuys++; state.buysThisWave++;
      const lv = floor + (Math.random() < A.lvChance ? 1 : 0);
      state.units += Math.pow(2, Math.min(MAX_LV, lv) - 1);
    }
    // 战斗结算（期望模型）
    const st = waveStats(w);
    const mainLv = estimateMainLv(state.units);
    const branch = branchMultFor(mainLv);
    const dps = state.units * AVG_UNIT_DPS * GROUP_MULT * CONSOLIDATION(mainLv) * branch * (1 + A.surge);
    const capacity = dps * st.duration * UTILIZATION;
    const clearRatio = Math.min(1, capacity / st.totalHp);
    const leakedHp = st.totalHp * (1 - clearRatio);
    const leaks = Math.min(st.leakCost, leakedHp / st.avgHpPer * (st.leakCost / st.n));
    state.baseHp -= leaks;
    // 收入（漏掉的不给钱）
    state.gold += waveIncome(w) * clearRatio;
    if (A.interest) state.gold += Math.min(Math.floor(state.gold * 0.05 * A.interest), 50 * A.interest);

    rows.push({
      w, income: Math.round(waveIncome(w)), cost1: P.cost({ ...state, buysThisWave: 0 }, w),
      buys: state.buysThisWave, units: Math.round(state.units), mainLv,
      dps: Math.round(dps), req: Math.round(st.totalHp / (st.duration * UTILIZATION)),
      ratio: (dps / (st.totalHp / (st.duration * UTILIZATION))).toFixed(2),
      hp: Math.max(0, state.baseHp).toFixed(1),
    });
    if (state.baseHp <= 0) return { dead: w, rows };
  }
  return { dead: null, rows };
}

// ---------- 输出 ----------
const SHOW = new Set([1, 3, 5, 8, 10, 12, 15, 18, 20, 22, 25, 28, 30, 33, 35, 40, 45, 50, 55, 60]);
console.log(`软参数: COVERAGE=${COVERAGE} UTIL=${UTILIZATION} GROUP=${GROUP_MULT} unitDPS=${AVG_UNIT_DPS.toFixed(1)} branch=${BRANCH_MULT}`);

const MATRIX = [
  ['legacy', 'legacy'],
  ['live', 'current'],
];

for (const [priceKey, floorKey] of MATRIX) {
  console.log(`\n========== [${PRICING[priceKey].name}] × [${FLOORS[floorKey].name}] ==========`);
  for (const archKey of Object.keys(ARCHETYPES)) {
    // 概率项(精工)用多次取平均墓碑
    let tombs = [];
    let sample = null;
    for (let i = 0; i < 7; i++) {
      const r = simulate(archKey, priceKey, floorKey);
      tombs.push(r.dead ?? 99);
      if (i === 0) sample = r;
    }
    const avgTomb = (tombs.reduce((a, b) => a + b, 0) / tombs.length).toFixed(1);
    console.log(`\n--- ${ARCHETYPES[archKey].name} → 墓碑波: ${avgTomb} ${tombs.every(t=>t===99)?'(>70 未死)':''}`);
    console.log('波 | 收入 | 首塔价 | 买 | 单位 | 主塔 | 玩家DPS | 需求DPS | 供需比 | 基地HP');
    for (const r of sample.rows) {
      if (SHOW.has(r.w) || r.w === sample.rows.length) {
        console.log(`${String(r.w).padStart(2)} | ${String(r.income).padStart(6)} | ${String(r.cost1).padStart(7)} | ${r.buys} | ${String(r.units).padStart(5)} | Lv${r.mainLv} | ${String(r.dps).padStart(8)} | ${String(r.req).padStart(8)} | ${r.ratio.padStart(5)} | ${r.hp}`);
      }
    }
  }
}
