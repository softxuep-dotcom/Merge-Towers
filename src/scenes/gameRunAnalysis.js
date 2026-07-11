import { ELEMENTS, TOWER_BRANCHES, towerPrice } from '../config.js';
import { t, t as tr } from '../i18n.js';

const TYPE_CN = {
  slime: t('enemy.slime'), runner: t('enemy.runner'), tank: t('enemy.tank'), flyer: t('enemy.flyer'),
  splitter: t('enemy.splitter'), boss: t('enemy.boss'), mini: t('enemy.mini'),
};

export const gameRunAnalysisMethods = {
  buildDeathAnalysis(S) {
    const wave = this.deathWave || this.wave;
    const candidates = [];
    const topLeak = Object.entries(this.leakStats).sort((a, b) => b[1] - a[1])[0];

    if (topLeak && topLeak[1] >= 3) candidates.push(this.leakDiagnosis(topLeak[0], topLeak[1], wave));
    if (wave % 5 === 0 || this.leakStats.boss > 0) {
      candidates.push({
        key: 'boss_wave',
        text: t('analysis.boss', { wave }),
      });
    }

    const expectedLv = this.expectedHighestLv(wave);
    if (this.highestLv < expectedLv) {
      candidates.push({
        key: 'low_highest_lv',
        text: t('analysis.level', { wave, level: this.highestLv }),
        upgradeId: 'startLv',
      });
    }

    const freeSlots = this.slots.filter(s => !s.tower).length;
    if (freeSlots > 0 && this.gold >= towerPrice(this.wave, 0)) {
      candidates.push({
        key: 'idle_gold_slots',
        text: t('analysis.slots', { wave, count: freeSlots }),
        upgradeId: 'startGold',
      });
    }

    candidates.push({
      key: 'fallback',
      text: t('analysis.fallback', { wave }),
    });

    const diagnosis = this.pickDiagnosis(candidates, S);
    diagnosis.elements = this.elementSummary();
    return diagnosis;
  },

  leakDiagnosis(typeKey, count, wave) {
    const name = TYPE_CN[typeKey] || typeKey;
    if (typeKey === 'tank') {
      return { key: 'leak_tank', text: t('analysis.tank', { wave, count }) };
    }
    if (typeKey === 'runner') {
      return { key: 'leak_runner', text: t('analysis.runner', { wave, count }) };
    }
    if (typeKey === 'flyer') {
      return {
        key: 'leak_flyer',
        text: t('analysis.flyer', { wave, count }),
      };
    }
    if (typeKey === 'splitter' || typeKey === 'mini') {
      return { key: 'leak_splitter', text: t('analysis.splitter', { wave, count }) };
    }
    return {
      key: `leak_${typeKey}`,
      text: t('analysis.generic', { wave, count, name }),
      upgradeId: 'startLv',
    };
  },

  expectedHighestLv(wave) {
    if (wave >= 30) return 7;
    if (wave >= 20) return 5;
    if (wave >= 10) return 3;
    if (wave >= 5) return 2;
    return 1;
  },

  pickDiagnosis(candidates, S) {
    const primary = candidates[0];
    const repeated = primary.key === S.lastDiagnosisKey ? (S.lastDiagnosisCount || 0) + 1 : 1;
    const chosen = repeated > 2 && candidates[1] ? candidates[1] : primary;
    S.lastDiagnosisCount = chosen.key === S.lastDiagnosisKey ? repeated : 1;
    S.lastDiagnosisKey = chosen.key;
    return { ...chosen };
  },

  elementSummary() {
    const counts = {};
    for (const t of this.towers) counts[t.elem] = (counts[t.elem] || 0) + 1;
    const parts = Object.entries(counts).map(([elem, count]) => `${ELEMENTS[elem].cn}×${count}`);
    return parts.length ? parts.join('  ') : t('analysis.none');
  },

  beginWaveDps() {
    this.waveCombatTime = 0;
    this.waveTowerDamage = new Map();
    for (const t of this.towers) this.ensureWaveTowerStat(t);
  },

  ensureWaveTowerStat(t) {
    if (this.waveState !== 'active' || !t) return null;
    let stat = this.waveTowerDamage.get(t.id);
    if (!stat) {
      stat = { tower: t, damage: 0, sold: false };
      this.waveTowerDamage.set(t.id, stat);
    }
    return stat;
  },

  mergeWaveTowerStats(result, parents) {
    if (this.waveState !== 'active') return;
    const resultStat = this.ensureWaveTowerStat(result);
    for (const parent of parents) {
      parent.dpsSuccessor = result;
      const stat = this.waveTowerDamage.get(parent.id);
      if (!stat) continue;
      resultStat.damage += stat.damage;
      this.waveTowerDamage.delete(parent.id);
    }
  },

  recordTowerDamage(tower, damage) {
    if (this.waveState !== 'active' || !tower || !Number.isFinite(damage) || damage <= 0) return;
    tower = this.towerLineageOwner(tower);
    const stat = this.ensureWaveTowerStat(tower);
    if (stat) stat.damage += damage;
  },

  towerLineageOwner(tower) {
    while (tower?.dpsSuccessor) tower = tower.dpsSuccessor;
    return tower || null;
  },

  towerDpsLabel(stat) {
    const t = stat.tower;
    const branchName = t.branch ? TOWER_BRANCHES[t.elem]?.[t.branch]?.cn : '';
    return `${ELEMENTS[t.elem].cn}${branchName ? `·${branchName}` : ''} Lv${t.lv}${stat.sold ? tr('analysis.sold') : ''}`;
  },

  buildWaveDpsSummary() {
    const duration = Math.max(0, this.waveCombatTime || 0);
    const divisor = duration > 0 ? duration : 1;
    const towers = [...this.waveTowerDamage.values()]
      .map(stat => ({
        id: stat.tower.id,
        label: this.towerDpsLabel(stat),
        damage: stat.damage,
        dps: stat.damage / divisor,
      }))
      .sort((a, b) => b.dps - a.dps || a.id - b.id);
    const totalDamage = towers.reduce((sum, tower) => sum + tower.damage, 0);
    return {
      wave: this.wave,
      duration,
      totalDamage,
      totalDps: totalDamage / divisor,
      towers,
    };
  },
};
