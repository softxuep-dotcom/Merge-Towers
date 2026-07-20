import Phaser from 'phaser';
import { DEFAULT_DIFFICULTY, ELEMENTS, MAX_LV } from '../config.js';
import { Enemy, Path } from '../classes/Enemy.js';
import { Tower } from '../classes/Tower.js';
import { makeButton, makePanel, UI_THEME } from '../ui.js';
import { upgradeChoicesFor } from '../towerUpgrades.js';
import { GameScene } from './GameScene.js';

const ELEMENT_KEYS = Object.freeze(['fire', 'ice', 'lightning', 'poison', 'light']);
const RANK_KEYS = Object.freeze(['range', 'frequency', 'power']);
const RANK_LABELS = Object.freeze({ range: '范围', frequency: '频率', power: '强度' });
const RANK_ICONS = Object.freeze({ range: '◎', frequency: '↻', power: '▲' });
const DEFAULT_RANKS = Object.freeze({ range: 5, frequency: 1, power: 1 });
const TOTAL_GROWTH_RANKS = MAX_LV - 2;

function skillChoices(elem) {
  return upgradeChoicesFor({ elem, lv: 1, ranks: { range: 0, frequency: 0, power: 0 } });
}

function findSkill(key) {
  for (const elem of ELEMENT_KEYS) {
    const choice = skillChoices(elem).find(item => item.key === key);
    if (choice) return { elem, choice };
  }
  return null;
}

function normalizedRanks(value) {
  const ranks = Object.fromEntries(RANK_KEYS.map(key => [
    key,
    Phaser.Math.Clamp(Math.floor(Number(value?.[key]) || 0), 0, 5),
  ]));
  let total = RANK_KEYS.reduce((sum, key) => sum + ranks[key], 0);
  while (total < TOTAL_GROWTH_RANKS) {
    const key = RANK_KEYS.find(rank => ranks[rank] < 5);
    if (!key) break;
    ranks[key]++;
    total++;
  }
  while (total > TOTAL_GROWTH_RANKS) {
    const key = [...RANK_KEYS].reverse().find(rank => ranks[rank] > 0);
    if (!key) break;
    ranks[key]--;
    total--;
  }
  return ranks;
}

export class SkillTestScene extends GameScene {
  constructor() { super('SkillTest'); }

  init(data = {}) {
    const params = new URLSearchParams(window.location.search);
    const requested = data.skill || params.get('skill') || 'chain';
    const selected = findSkill(requested) || findSkill('chain');
    this.selectedElement = selected.elem;
    this.selectedSkill = selected.choice.key;
    this.ranks = normalizedRanks(data.ranks || DEFAULT_RANKS);
    this.autoFire = data.autoFire ?? true;
    this.focusKind = data.focusKind === 'boss' ? 'boss' : 'swarm';
    this.lowHp = data.lowHp ?? false;
  }

  create() {
    const w = this.scale.width;
    const h = this.scale.height;
    this.elapsed = 0;
    this.autoProcTimer = 0.6;
    this.totalDamage = 0;
    this.hitCount = 0;
    this.deathCount = 0;
    this.nextTowerId = 1;
    this.enemies = [];
    this.towers = [];
    this.effectZones = [];
    this.nextEffectZoneId = 1;
    this.burnZones = [];
    this.over = false;
    this.atkBuffT = 0;
    this.atkBuffMult = 1.3;
    this.maxBase = 15;
    this.baseHp = 15;
    this.holyHealThisWave = 0;
    this.ensureVfxAnimations();
    this.initializeCombatVfx();

    this.buildLabBackground(w, h);
    const layout = this.labLayout(w, h);
    this.createHeader(layout);
    this.createArena(layout);
    this.createSkillControls(layout);
    this.configureTower(layout);
    this.spawnTrainingGroup(layout);
    this.setFocus(this.focusKind);
    this.updateAutoLabel();
    this.updateLowHpLabel();
    this.updateRankSummary();

    this._onResize = () => {
      this._resizeTimer?.remove();
      this._resizeTimer = this.time.delayedCall(120, () => this.restartLab());
    };
    this.scale.on('resize', this._onResize);
    this.events.once('shutdown', () => {
      this.scale.off('resize', this._onResize);
      this._resizeTimer?.remove();
    });
  }

  labLayout(w, h) {
    const wide = w >= 1050;
    if (wide) {
      const sidebarW = 390;
      return {
        w, h, wide,
        arena: { x: 28, y: 82, w: w - sidebarW - 48, h: h - 110 },
        controls: { x: w - sidebarW + 8, y: 82, w: sidebarW - 28, h: h - 110 },
      };
    }
    const arenaY = 84;
    const arenaH = Math.min(520, h * 0.42);
    const controlsY = arenaY + arenaH + 16;
    return {
      w, h, wide,
      arena: { x: 20, y: arenaY, w: w - 40, h: arenaH },
      controls: { x: 20, y: controlsY, w: w - 40, h: h - controlsY - 18 },
    };
  }

  buildLabBackground(w, h) {
    this.cameras.main.setBackgroundColor('#061019');
    const bg = this.add.graphics().setDepth(-30);
    bg.fillGradientStyle(0x143847, 0x102a38, 0x071521, 0x050b12, 1);
    bg.fillRect(0, 0, w, h);
    bg.fillStyle(0x63d6a3, 0.055);
    bg.fillCircle(w * 0.36, h * 0.42, Math.min(w, h) * 0.42);
    bg.lineStyle(1, 0xa8dce2, 0.045);
    for (let x = -h; x < w + h; x += 80) bg.lineBetween(x, 0, x - h, h);
    bg.lineStyle(1, 0x70a4b4, 0.035);
    for (let y = 0; y < h; y += 80) bg.lineBetween(0, y, w, y);
  }

  createHeader(layout) {
    const { w, wide } = layout;
    makeButton(this, 62, 34, 94, 42, '← 菜单', {
      bg: 0x1a2d3e, stroke: 0x567487, fontSize: 15, radius: 12,
      onClick: () => this.scene.start('Menu'),
    }).setDepth(3000);
    this.add.text(w / 2, 34, '技能测试场景', {
      fontFamily: 'Arial Black, "Microsoft YaHei", sans-serif', fontSize: wide ? '30px' : '25px',
      color: '#f5d675', stroke: '#07111b', strokeThickness: 5,
    }).setOrigin(0.5).setDepth(3000);
    this.add.text(w - 22, 34, 'SKILL LAB', {
      fontFamily: 'Arial, sans-serif', fontSize: '13px', color: '#79a9b8', fontStyle: 'bold',
    }).setOrigin(1, 0.5).setDepth(3000);
  }

  createArena(layout) {
    const box = layout.arena;
    makePanel(this, box.x + box.w / 2, box.y + box.h / 2, box.w, box.h, {
      fill: 0x091923, alpha: 0.9, stroke: 0x426879, strokeAlpha: 0.58,
      accentColor: ELEMENTS[this.selectedElement].color, accentWidth: 132,
    }).setDepth(-5);
    const floor = this.add.ellipse(box.x + box.w * 0.56, box.y + box.h * 0.62, box.w * 0.78, box.h * 0.48, 0x102b31, 0.72)
      .setStrokeStyle(2, 0x4c7780, 0.32).setDepth(-3);
    const grid = this.add.graphics().setDepth(-2);
    grid.lineStyle(1, 0x77a8ad, 0.08);
    for (let i = -4; i <= 4; i++) {
      const y = floor.y + i * 30;
      grid.lineBetween(box.x + box.w * 0.16, y, box.x + box.w * 0.95, y);
    }

    const buttonY = box.y + 34;
    const targetW = Math.min(132, box.w * 0.2);
    this.swarmButton = makeButton(this, box.x + box.w / 2 - targetW / 2 - 6, buttonY, targetW, 38, '群体假人', {
      bg: 0x183447, stroke: 0x5a8393, fontSize: 14, radius: 11,
      onClick: () => this.setFocus('swarm'),
    }).setDepth(2500);
    this.bossButton = makeButton(this, box.x + box.w / 2 + targetW / 2 + 6, buttonY, targetW, 38, 'Boss 假人', {
      bg: 0x322b2b, stroke: 0x8f6a59, fontSize: 14, radius: 11,
      onClick: () => this.setFocus('boss'),
    }).setDepth(2500);

    const actionY = box.y + box.h - 34;
    const actionW = Math.min(142, (box.w - 42) / 4);
    this.autoButton = makeButton(this, box.x + box.w / 2 - actionW * 1.5 - 9, actionY, actionW, 42, '', {
      bg: 0x1f4a3d, stroke: 0x65d6a0, fontSize: 14, radius: 12,
      onClick: () => this.toggleAuto(),
    }).setDepth(2500);
    makeButton(this, box.x + box.w / 2 - actionW * 0.5 - 3, actionY, actionW, 42, '释放一次', {
      bg: 0x23405a, stroke: 0x6da6c5, fontSize: 14, radius: 12,
      onClick: () => this.releaseOnce(false),
    }).setDepth(2500);
    makeButton(this, box.x + box.w / 2 + actionW * 0.5 + 3, actionY, actionW, 42, '强制触发', {
      bg: 0x5c4120, stroke: 0xe2ad53, fontSize: 14, radius: 12,
      onClick: () => this.releaseOnce(true),
    }).setDepth(2500);
    makeButton(this, box.x + box.w / 2 + actionW * 1.5 + 9, actionY, actionW, 42, '重置假人', {
      bg: 0x3a2d3b, stroke: 0x8c668f, fontSize: 14, radius: 12,
      onClick: () => this.resetDummies(),
    }).setDepth(2500);

    this.statusText = this.add.text(box.x + box.w - 18, box.y + 62, '', {
      fontFamily: 'Consolas, "Microsoft YaHei", monospace', fontSize: '13px', color: '#b8d6dd',
      align: 'right', backgroundColor: '#07111bcc', padding: { x: 7, y: 5 },
    }).setOrigin(1, 0).setDepth(2500);
  }

  createSkillControls(layout) {
    const box = layout.controls;
    makePanel(this, box.x + box.w / 2, box.y + box.h / 2, box.w, box.h, {
      fill: 0x0b1825, alpha: 0.94, stroke: 0x48677c, strokeAlpha: 0.56,
      accentColor: ELEMENTS[this.selectedElement].color, accentWidth: 106,
    });
    const innerX = box.x + 14;
    const innerW = box.w - 28;
    const elementGap = 6;
    const elementW = (innerW - elementGap * 4) / 5;
    const elementY = box.y + 36;
    ELEMENT_KEYS.forEach((elem, index) => {
      const active = elem === this.selectedElement;
      makeButton(this, innerX + elementW / 2 + index * (elementW + elementGap), elementY, elementW, 44, ELEMENTS[elem].cn, {
        bg: active ? ELEMENTS[elem].color : 0x182a39,
        bgAlpha: active ? 0.62 : 0.96,
        stroke: active ? 0xffffff : 0x496174,
        color: active ? '#ffffff' : UI_THEME.textSoft,
        fontSize: layout.wide ? 13 : 12, radius: 11,
        onClick: () => this.selectElement(elem),
      });
    });

    const choices = skillChoices(this.selectedElement);
    const skillGap = 8;
    const skillW = (innerW - skillGap * 2) / 3;
    const skillY = box.y + 94;
    choices.forEach((choice, index) => {
      const active = choice.key === this.selectedSkill;
      const skillFontSize = layout.wide && choice.name.length > 10 ? 10 : (layout.wide ? 12 : 13);
      makeButton(this, innerX + skillW / 2 + index * (skillW + skillGap), skillY, skillW, 48, `${choice.icon} ${choice.name}`, {
        bg: active ? 0x315868 : 0x172837,
        stroke: active ? ELEMENTS[this.selectedElement].color : 0x415b6d,
        strokeWidth: active ? 2 : 1, color: active ? '#ffffff' : UI_THEME.textSoft,
        fontSize: skillFontSize, radius: 11,
        onClick: () => this.selectSkill(choice.key),
      });
    });

    const selected = choices.find(choice => choice.key === this.selectedSkill);
    this.add.text(box.x + box.w / 2, box.y + 143, selected?.description || '', {
      fontFamily: 'Arial, "Microsoft YaHei", sans-serif', fontSize: layout.wide ? '13px' : '12px',
      color: '#a9c4cd', align: 'center', wordWrap: { width: innerW - 8 },
    }).setOrigin(0.5, 0).setDepth(10);

    const rankTop = box.y + (layout.wide ? 208 : 202);
    const rankGap = layout.wide ? 66 : 58;
    RANK_KEYS.forEach((key, index) => {
      const y = rankTop + index * rankGap;
      const choicesForRank = upgradeChoicesFor({ elem: this.selectedElement, skill: this.selectedSkill, lv: 2, ranks: this.ranks });
      const def = choicesForRank.find(choice => choice.key === key);
      this.add.text(innerX + 4, y, `${RANK_ICONS[key]} ${def?.name || RANK_LABELS[key]}`, {
        fontFamily: 'Arial, "Microsoft YaHei", sans-serif', fontSize: layout.wide ? '15px' : '14px',
        color: '#e4eef1', fontStyle: 'bold',
      }).setOrigin(0, 0.5);
      makeButton(this, box.x + box.w - 118, y, 40, 36, '−', {
        bg: 0x253547, stroke: 0x566b80, fontSize: 22, radius: 10,
        onClick: () => this.adjustRank(key, -1),
      });
      this.add.text(box.x + box.w - 76, y, String(this.ranks[key]), {
        fontFamily: 'Arial Black, sans-serif', fontSize: '20px', color: '#f5d675',
      }).setOrigin(0.5);
      makeButton(this, box.x + box.w - 34, y, 40, 36, '+', {
        bg: 0x285f4e, stroke: 0x65d6a0, fontSize: 20, radius: 10,
        onClick: () => this.adjustRank(key, 1),
      });
    });

    const bottom = box.y + box.h;
    const summaryY = layout.wide ? bottom - 98 : rankTop + rankGap * 3 + 20;
    this.rankSummary = this.add.text(box.x + box.w / 2, summaryY, '', {
      fontFamily: 'Consolas, "Microsoft YaHei", monospace', fontSize: '13px', color: '#f5d675', align: 'center',
    }).setOrigin(0.5);
    this.lowHpButton = makeButton(this, box.x + box.w / 2, summaryY + 40, Math.min(260, innerW), 40, '', {
      bg: 0x3a2930, stroke: 0xa15d69, fontSize: 14, radius: 12,
      onClick: () => this.toggleLowHp(),
    });
    this.statsText = this.add.text(box.x + box.w / 2, summaryY + 78, '', {
      fontFamily: 'Consolas, monospace', fontSize: '12px', color: '#79a9b8', align: 'center',
    }).setOrigin(0.5);
  }

  configureTower(layout) {
    const box = layout.arena;
    const slot = {
      x: box.x + box.w * (layout.wide ? 0.25 : 0.22),
      y: box.y + box.h * 0.62,
      tower: null,
    };
    this.testTower = new Tower(this, slot, this.selectedElement, MAX_LV);
    this.testTower.skill = this.selectedSkill;
    this.testTower.ranks = { ...this.ranks };
    this.testTower.refreshLevelVisual();
    slot.tower = this.testTower;
    this.towers.push(this.testTower);
    this.testTower.cooldown = 0.08;
    this.playUpgradeRiftFx(this.testTower, { maxLevel: true });
    this.add.text(slot.x, slot.y + 62, `${ELEMENTS[this.selectedElement].cn} · Lv${MAX_LV}`, {
      fontFamily: 'Arial Black, "Microsoft YaHei", sans-serif', fontSize: '15px',
      color: '#f5f7f8', stroke: '#07111b', strokeThickness: 4,
    }).setOrigin(0.5).setDepth(2500);
  }

  spawnTrainingGroup(layout) {
    const box = layout.arena;
    const clusterX = box.x + box.w * (layout.wide ? 0.67 : 0.69);
    const clusterY = box.y + box.h * 0.48;
    const spreadX = Math.min(82, box.w * 0.12);
    const spreadY = Math.min(78, box.h * 0.14);
    const offsets = [[0, 0], [spreadX, -spreadY], [spreadX, spreadY], [-spreadX * 0.72, -spreadY], [-spreadX * 0.72, spreadY]];
    this.swarm = offsets.map(([dx, dy]) => this.spawnDummy('slime', clusterX + dx, clusterY + dy));
    this.boss = this.spawnDummy('boss', box.x + box.w * (layout.wide ? 0.82 : 0.76), box.y + box.h * 0.72);
    this.selectionRing = this.add.image(0, 0, 'glow')
      .setTint(ELEMENTS[this.selectedElement].color).setAlpha(0.45).setBlendMode(Phaser.BlendModes.ADD).setDepth(1);
  }

  spawnDummy(typeKey, x, y) {
    const path = new Path([{ x, y }, { x: x + 1000, y }]);
    const enemy = new Enemy(this, typeKey, 20, path, {
      difficulty: DEFAULT_DIFFICULTY,
      hpMult: typeKey === 'boss' ? 180 : 500,
      speedMult: Number.MIN_VALUE,
    });
    enemy.spawnWave = 20;
    enemy.labAnchor = { x, y };
    enemy.spr.setInteractive({ useHandCursor: true });
    enemy.spr.on('pointerup', () => this.setFocus(typeKey === 'boss' ? 'boss' : 'swarm', enemy));
    this.enemies.push(enemy);
    return enemy;
  }

  selectElement(elem) {
    const firstSkill = skillChoices(elem)[0]?.key;
    if (!firstSkill) return;
    this.selectSkill(firstSkill);
  }

  selectSkill(key) {
    const found = findSkill(key);
    if (!found || key === this.selectedSkill) return;
    const url = new URL(window.location.href);
    url.searchParams.set('skill', key);
    window.history.replaceState(null, '', url);
    this.restartLab({ skill: key });
  }

  adjustRank(key, direction) {
    const ranks = { ...this.ranks };
    if (direction > 0) {
      if (ranks[key] >= 5) return;
      const donor = RANK_KEYS.filter(rank => rank !== key && ranks[rank] > 0)
        .sort((a, b) => ranks[b] - ranks[a])[0];
      if (!donor) return;
      ranks[key]++;
      ranks[donor]--;
    } else {
      if (ranks[key] <= 0) return;
      const receiver = RANK_KEYS.filter(rank => rank !== key && ranks[rank] < 5)
        .sort((a, b) => ranks[a] - ranks[b])[0];
      if (!receiver) return;
      ranks[key]--;
      ranks[receiver]++;
    }
    this.restartLab({ ranks });
  }

  setFocus(kind, explicitTarget = null) {
    this.focusKind = kind === 'boss' ? 'boss' : 'swarm';
    this.focusTarget = explicitTarget || (this.focusKind === 'boss' ? this.boss : this.swarm.find(enemy => !enemy.dead));
    if (!this.focusTarget) return;
    if (this.lowHp) this.setDummyHp(this.focusTarget, 0.1);
    const size = (this.enemySize(this.focusTarget) + 28) * 2;
    this.selectionRing?.setPosition(this.focusTarget.x, this.focusTarget.y).setDisplaySize(size, size);
    this.swarmButton?.label.setText(`${this.focusKind === 'swarm' ? '● ' : ''}群体假人`);
    this.bossButton?.label.setText(`${this.focusKind === 'boss' ? '● ' : ''}Boss 假人`);
  }

  targetFor(tower) {
    if (this.focusTarget && !this.focusTarget.dead) return this.focusTarget;
    return this.enemies.find(enemy => !enemy.dead && Phaser.Math.Distance.Between(tower.slot.x, tower.slot.y, enemy.x, enemy.y) <= tower.range);
  }

  releaseOnce(forceProc) {
    const target = this.targetFor(this.testTower);
    if (!target) return;
    if (forceProc) {
      this.primeProcCounter();
      this.prepareForcedProcTarget(target);
    }
    this.testTower.cooldown = 0;
    this.fireTower(this.testTower, target, { forceProc });
  }

  primeProcCounter() {
    const frequency = this.ranks.frequency;
    const cadence = {
      mirror: [4, 3, 3, 3, 2, 2],
      magstorm: [5, 4, 4, 3, 3, 2],
      spores: [5, 4, 4, 3, 3, 2],
    }[this.selectedSkill]?.[frequency];
    if (cadence) this.testTower.attackCount = cadence - 1;
  }

  prepareForcedProcTarget(target) {
    if (this.selectedSkill === 'plague') {
      target.applyPoison(this.testTower.dmg, 1, false, this.testTower);
      target.hp = Math.min(target.hp, Math.max(1, this.testTower.dmg * 0.1));
      this.syncDummyHealth(target);
    } else if (this.selectedSkill === 'judgement') {
      target.hp = Math.min(target.hp, target.maxHp * 0.1);
      this.syncDummyHealth(target);
    }
  }

  toggleAuto() {
    this.autoFire = !this.autoFire;
    if (this.autoFire) this.testTower.cooldown = 0;
    this.updateAutoLabel();
  }

  updateAutoLabel() {
    this.autoButton?.label.setText(`自动：${this.autoFire ? '开' : '关'}`);
  }

  toggleLowHp() {
    this.lowHp = !this.lowHp;
    if (this.lowHp) this.setDummyHp(this.focusTarget, 0.1);
    else this.resetDummy(this.focusTarget);
    this.updateLowHpLabel();
  }

  updateLowHpLabel() {
    this.lowHpButton?.label.setText(`目标低血量：${this.lowHp ? '10%' : '关闭'}`);
  }

  updateRankSummary() {
    this.rankSummary?.setText(`Lv2→Lv9 · 七次强化 · ${this.ranks.range}/${this.ranks.frequency}/${this.ranks.power}`);
  }

  restartLab(overrides = {}) {
    this.scene.restart({
      skill: overrides.skill || this.selectedSkill,
      ranks: overrides.ranks || this.ranks,
      autoFire: this.autoFire,
      focusKind: this.focusKind,
      lowHp: this.lowHp,
    });
  }

  setDummyHp(enemy, ratio) {
    if (!enemy || enemy.dead) return;
    enemy.hp = Math.max(1, enemy.maxHp * ratio);
    this.syncDummyHealth(enemy);
  }

  syncDummyHealth(enemy) {
    enemy.barBg.setVisible(true);
    enemy.bar.setVisible(true);
    enemy.bar.width = enemy.healthBarWidth * Phaser.Math.Clamp(enemy.hp / enemy.maxHp, 0, 1);
  }

  resetDummy(enemy) {
    if (!enemy) return;
    enemy.dead = false;
    enemy.hp = enemy.maxHp;
    enemy.minHp = 0;
    enemy.poisons = [];
    enemy.slowT = 0;
    enemy.slowPct = 0;
    enemy.frozenT = 0;
    enemy.stunnedT = 0;
    enemy.hardControlImmuneT = 0;
    enemy.corrodedT = 0;
    enemy.corrosionPct = 0;
    enemy.corrosionArmorPct = 0;
    enemy.progress = 0;
    enemy.c.setPosition(enemy.labAnchor.x, enemy.labAnchor.y).setAlpha(1).setScale(1).setVisible(true);
    enemy.barBg.setVisible(false);
    enemy.bar.setVisible(false);
    enemy.restoreTint();
  }

  resetDummies() {
    for (const enemy of this.enemies) this.resetDummy(enemy);
    for (const zone of this.effectZones) {
      zone.particles?.destroy();
      zone.ring?.destroy();
      zone.shaderField?.destroy();
    }
    this.effectZones = [];
    this.totalDamage = 0;
    this.hitCount = 0;
    this.deathCount = 0;
    this.elapsed = 0;
    this.autoProcTimer = 0.6;
    this.setFocus(this.focusKind);
    if (this.lowHp) this.setDummyHp(this.focusTarget, 0.1);
  }

  recordTowerDamage(_tower, damage) {
    this.totalDamage += Math.max(0, damage || 0);
    this.hitCount++;
  }

  onEnemyDead(enemy) {
    this.deathCount++;
    const plague = enemy.poisons.find(poison => poison.t > 0 && poison.plague);
    if (plague) {
      const radius = plague.plagueRadius || 95;
      const infected = [];
      for (const target of this.nearbyEnemies(enemy.x, enemy.y, radius, [enemy]).slice(0, 3 + Math.floor((this.ranks.range + 1) / 2))) {
        target.applyPoison(plague.dps, 2, false, plague.sourceTower, { branchEffects: false });
        infected.push({ x: target.x, y: target.y });
      }
      this.playPlagueBurstFx(enemy.x, enemy.y, radius, infected);
    }
    this.burst(enemy.x, enemy.y, enemy.type.color, enemy.boss ? 28 : 14, enemy.boss ? 1.3 : 0.8);
    enemy.c.setAlpha(0.18);
    this.time.delayedCall(650, () => {
      this.resetDummy(enemy);
      if (this.lowHp && enemy === this.focusTarget) this.setDummyHp(enemy, 0.1);
    });
  }

  onEnemyLeak(enemy) {
    this.resetDummy(enemy);
  }

  update(_, deltaMs) {
    if (!this.testTower || !this.enemies.length) return;
    const dts = Math.min(deltaMs / 1000, 0.05);
    this.elapsed += dts;

    for (const enemy of this.enemies) {
      if (enemy.dead) continue;
      enemy.update(dts);
      enemy.progress = Math.min(enemy.progress, 0.001);
      enemy.c.setPosition(enemy.labAnchor.x, enemy.labAnchor.y);
    }
    this.updateElementZones(dts);
    this.updateCombatVfx(dts);

    this.testTower.tickCooldown(dts, 1);
    this.autoProcTimer -= dts;
    if (this.autoFire && this.testTower.ready()) {
      const target = this.targetFor(this.testTower);
      if (target) {
        const forceProc = this.autoProcTimer <= 0;
        if (forceProc) {
          this.primeProcCounter();
          this.prepareForcedProcTarget(target);
          this.autoProcTimer = 1.45;
        }
        this.fireTower(this.testTower, target, { forceProc });
      }
    }

    if (this.selectionRing && this.focusTarget) {
      this.selectionRing.setPosition(this.focusTarget.x, this.focusTarget.y)
        .setAlpha(0.34 + Math.sin(this.elapsed * 5) * 0.12);
    }

    if (!this._statsAt || this.elapsed >= this._statsAt) {
      this._statsAt = this.elapsed + 0.15;
      const target = this.focusTarget;
      const states = [];
      if (target?.slowT > 0) states.push(`减速${Math.round(target.slowPct)}%`);
      if (target?.frozenT > 0) states.push('冻结');
      if (target?.stunnedT > 0) states.push('眩晕');
      if (target?.corrodedT > 0) states.push('腐蚀');
      const poisonStacks = target?.poisons?.filter(poison => poison.t > 0).length || 0;
      if (poisonStacks) states.push(`中毒×${poisonStacks}`);
      const hp = target ? `${Math.max(0, target.hp / target.maxHp * 100).toFixed(1)}%` : '--';
      this.statusText?.setText(`目标 HP ${hp}\n${states.join(' · ') || '无状态'}`);
      const dps = this.elapsed > 0 ? this.totalDamage / this.elapsed : 0;
      const beams = this.lightningBeams?.activeCount() || 0;
      const vfx = this.vfxRuntime?.diagnostics();
      this.statsText?.setText(
        `FPS ${Math.round(this.game.loop.actualFps)} · DPS ${Math.round(dps)} · 命中 ${this.hitCount} · 击杀 ${this.deathCount}\n`
        + `VFX ${vfx?.quality || 'fallback'} · Shader ${vfx?.shaders || 0} · 粒子 ${vfx?.particles || 0} · 光束 ${beams} · 区域 ${this.effectZones.length}`,
      );
    }
  }
}
