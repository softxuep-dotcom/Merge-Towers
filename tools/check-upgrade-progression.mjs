import assert from 'node:assert/strict';

globalThis.localStorage = { getItem: () => 'zh-CN', setItem: () => {} };

const { ELEMENTS, MAX_LV } = await import('../src/config.js');
const {
  GOLD_PER_SOURCE,
  MAX_GROWTH_RANK,
  SOURCE_KILL_SHARE,
  SOURCE_PER_WAVE,
  UPGRADE_COSTS,
  applyTowerUpgrade,
  upgradeChoicesFor,
  upgradeCostFor,
} = await import('../src/towerUpgrades.js');

function makeTower(elem) {
  return {
    elem,
    lv: 1,
    skill: null,
    ranks: { range: 0, frequency: 0, power: 0 },
    refreshLevelVisual() {},
  };
}

function pick(tower, key) {
  const choice = upgradeChoicesFor(tower).find(card => card.key === key);
  assert.ok(choice, `missing ${key} choice for ${tower.elem} at Lv${tower.lv}`);
  assert.notEqual(choice.disabled, true, `${key} unexpectedly disabled at Lv${tower.lv}`);
  assert.equal(applyTowerUpgrade(tower, choice), true, `failed to apply ${key} at Lv${tower.lv}`);
}

function verifyRoute(elem, coreKey, sequence, expectedRanks) {
  const tower = makeTower(elem);
  pick(tower, coreKey);
  sequence.forEach(track => pick(tower, track));

  assert.equal(tower.lv, MAX_LV);
  assert.deepEqual(tower.ranks, expectedRanks);
  assert.deepEqual(upgradeChoicesFor(tower), []);
  assert.equal(upgradeCostFor(tower), Infinity);
}

for (const elem of Object.keys(ELEMENTS)) {
  const coreKeys = upgradeChoicesFor(makeTower(elem)).map(choice => choice.key);
  assert.equal(coreKeys.length, 3, `${elem} must have three core splits`);

  for (const coreKey of coreKeys) {
    verifyRoute(
      elem,
      coreKey,
      ['range', 'range', 'range', 'range', 'range', 'frequency', 'power'],
      { range: 5, frequency: 1, power: 1 },
    );
    verifyRoute(
      elem,
      coreKey,
      ['range', 'range', 'range', 'range', 'frequency', 'frequency', 'power'],
      { range: 4, frequency: 2, power: 1 },
    );
  }
}

const capped = makeTower('fire');
pick(capped, 'blast');
for (let i = 0; i < MAX_GROWTH_RANK; i++) pick(capped, 'range');
const cappedChoice = upgradeChoicesFor(capped).find(choice => choice.key === 'range');
assert.equal(cappedChoice.disabled, true);
assert.equal(cappedChoice.badge, 'MAX');
assert.equal(applyTowerUpgrade(capped, cappedChoice), false);

const costs = Object.values(UPGRADE_COSTS);
assert.deepEqual(costs, [1, 1, 1.5, 1.5, 2, 2, 2.5, 3]);
assert.ok(costs.every((cost, index) => index === 0 || cost >= costs[index - 1]));
assert.ok(costs.at(-1) / costs[0] <= 3, 'late upgrades must stay within 3x of the first upgrade');
assert.equal(SOURCE_PER_WAVE, 0.75);
assert.equal(SOURCE_KILL_SHARE, 0.58);
assert.equal(GOLD_PER_SOURCE, 140);

console.log('Upgrade progression OK: Lv9 routes, Rank 5 cap, compact 1-3 cost curve, balanced source rates.');
