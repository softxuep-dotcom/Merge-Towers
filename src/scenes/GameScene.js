import {
  W, H, MAX_LV, ELEMENTS, ENEMY_TYPES, BASE_HP, LEAK_BOSS, LEAK_NORMAL,
  phaseFor, towerCost, waveHp, waveCount, spawnFloor, DIAMOND,
} from '../config.js';
import { Enemy, Path } from '../classes/Enemy.js';
import { Tower } from '../classes/Tower.js';
import { makeButton, toast } from '../ui.js';
import { Sfx, setMuted, isMuted } from '../audio.js';
import { Poki } from '../poki.js';
import { writeSave, tier, unlockedElements } from '../save.js';

// 地面路径（GDD §2：S 形，左上入口 → 右下基地）
const PATH_PTS = [
  { x: -60, y: 170 }, { x: 590, y: 170 }, { x: 590, y: 430 },
  { x: 130, y: 430 }, { x: 130, y: 690 }, { x: 645, y: 690 },
];
// 飞行兵直线航道（GDD §4.2：穿过中央塔位射程）
const FLY_PTS = [{ x: -60, y: 240 }, { x: 645, y: 690 }];
const SLOT_XS = [104, 232, 360, 488, 616];
const SLOT_YS = [300, 560, 820];
const TYPE_ICON = { slime: '🟣', runner: '💨', tank: '🛡️', flyer: '🐝', splitter: '🟠', boss: '💀', mini: '·' };

export class GameScene extends Phaser.Scene {
  constructor() { super('Game'); }

  create() {
    const S = this.S = this.registry.get('save');
    // ---- 局内状态 ----
    this.gold = Math.round((40 + 20 * tier(S, 'startGold')) * (S.coupon ? 1.5 : 1));
    if (S.coupon) { S.coupon = false; writeSave(S); }
    this.maxBase = BASE_HP + 2 * tier(S, 'baseArmor');
    this.baseHp = this.maxBase;
    this.wave = 1;
    this.bought = 0;
    this.kills = 0;
    this.diamondsRun = 0;
    this.highestLv = 1;
    this.revived = false;
    this.adGifts = 0;
    this.speedMult = 1;
    this.slowmoT = 0;
    this.atkBuffT = 0;
    this.waveGoldMult = 1;
    this.waveState = 'idle'; // prep | active
    this.spawnLeft = 0;
    this.dying = false;
    this.over = false;
    this.enemies = [];
    this.towers = [];
    this.burnZones = [];
    this.dmgCount = 0;
    this.coinCount = 0;
    this.lastKillSfx = 0;

    this.path = new Path(PATH_PTS);
    this.flyPath = new Path(FLY_PTS);

    this.buildField();
    this.buildUI();
    this.setupDrag();
    this.presetTowers();

    // 自动化（局外解锁）
    this.time.addEvent({ delay: 600, loop: true, callback: () => this.autoBuyTick() });
    this.time.addEvent({ delay: 800, loop: true, callback: () => this.autoMergeTick() });

    Poki.gameplayStart();
    this.startPrep();
  }

  // ================= 场景搭建 =================
  buildField() {
    const ph = phaseFor(1);
    this.bgAll = this.add.rectangle(W / 2, H / 2, W, H, ph.bg).setDepth(-20);
    this.ground = this.add.rectangle(W / 2, 470, 704, 830, ph.ground).setDepth(-19);

    // 路径（道路）
    const g = this.add.graphics().setDepth(-15);
    g.lineStyle(58, 0x2a2d40, 1);
    g.strokePoints(PATH_PTS.map(p => new Phaser.Math.Vector2(p.x, p.y)), false);
    PATH_PTS.slice(1, -1).forEach(p => { g.fillStyle(0x2a2d40, 1); g.fillCircle(p.x, p.y, 29); });
    g.lineStyle(46, 0x3a3e58, 1);
    g.strokePoints(PATH_PTS.map(p => new Phaser.Math.Vector2(p.x, p.y)), false);
    PATH_PTS.slice(1, -1).forEach(p => { g.fillStyle(0x3a3e58, 1); g.fillCircle(p.x, p.y, 23); });
    // 飞行航道（虚线示意）
    g.lineStyle(2, 0x7fe7e0, 0.25);
    const fa = FLY_PTS[0], fb = FLY_PTS[1];
    for (let t = 0; t < 1; t += 0.05) {
      g.lineBetween(fa.x + (fb.x - fa.x) * t, fa.y + (fb.y - fa.y) * t,
        fa.x + (fb.x - fa.x) * (t + 0.025), fa.y + (fb.y - fa.y) * (t + 0.025));
    }

    // 塔位
    this.slots = [];
    for (const y of SLOT_YS) for (const x of SLOT_XS) {
      this.add.image(x, y, 'slot').setDepth(-10);
      this.slots.push({ x, y, tower: null });
    }

    // 基地
    this.add.image(648, 640, 'base').setDepth(700);

    // 红色警示边缘（漏怪反馈）
    this.vignette = this.add.rectangle(W / 2, H / 2, W, H, 0xff2222, 0).setDepth(2900);
    // 白闪（最高级合成）
    this.flash = this.add.rectangle(W / 2, H / 2, W, H, 0xffffff, 0).setDepth(2950);
  }

  buildUI() {
    // 顶部状态栏
    this.add.rectangle(W / 2, 30, W, 60, 0x161825, 0.9).setDepth(1000);
    this.waveText = this.uiText(20, 30, '', 26, '#ffffff').setOrigin(0, 0.5);
    this.heartText = this.uiText(180, 30, '', 24, '#ff7a7a').setOrigin(0, 0.5);
    this.add.image(332, 30, 'coin').setDepth(1001).setScale(1.2);
    this.goldText = this.uiText(350, 30, '0', 26, '#ffd34e').setOrigin(0, 0.5);
    this.add.image(516, 30, 'diamond').setDepth(1001).setScale(0.9);
    this.diamondText = this.uiText(534, 30, '0', 26, '#9fe8ff').setOrigin(0, 0.5);
    this.muteBtn = this.uiText(688, 30, isMuted() ? '🔇' : '🔊', 28).setOrigin(0.5).setInteractive({ useHandCursor: true })
      .on('pointerdown', () => {
        setMuted(!isMuted());
        this.S.muted = isMuted(); writeSave(this.S);
        this.muteBtn.setText(isMuted() ? '🔇' : '🔊');
      });

    // Boss 血条
    this.bossBarBg = this.add.rectangle(W / 2, 74, 604, 14, 0x000000, 0.6).setDepth(1000).setVisible(false);
    this.bossBar = this.add.rectangle(W / 2 - 300, 74, 600, 10, 0xe84a5f).setOrigin(0, 0.5).setDepth(1001).setVisible(false);

    // 下一波预告
    this.previewText = this.uiText(W / 2, 110, '', 24, '#c9d2f0').setOrigin(0.5);

    // 底部面板
    this.add.rectangle(W / 2, 1090, W, 380, 0x161825, 0.95).setDepth(1000);

    // 提前召唤
    this.callBtn = makeButton(this, W / 2, 935, 340, 62, '⚔ 提前召唤 +10%金币', {
      bg: 0x6b5a2e, stroke: 0xd8b74f, fontSize: 24,
      onClick: () => this.startWave(true),
    }).setDepth(1002).setVisible(false);

    // 买塔（核心按钮）
    this.buyBtn = makeButton(this, 360, 1105, 290, 150, '', {
      bg: 0x2e6b4f, stroke: 0x59c98f, fontSize: 30,
      onClick: () => this.buyTower(),
    }).setDepth(1002);

    // 回收区
    this.sellRect = new Phaser.Geom.Rectangle(30, 1030, 160, 150);
    this.sellZone = this.add.rectangle(110, 1105, 160, 150, 0x5a2e35, 1).setStrokeStyle(2, 0x9c4a58).setDepth(1001);
    this.sellText = this.uiText(110, 1105, '♻\n回收 50%', 22, '#ff9aa8').setOrigin(0.5).setDepth(1002);

    // 广告送塔
    this.giftBtn = makeButton(this, 610, 1040, 180, 74, '', {
      bg: 0x6b4a86, stroke: 0xb07fe0, fontSize: 20,
      onClick: () => this.adGiftTower(),
    }).setDepth(1002);

    // 2 倍速（局外解锁后显示）
    this.speedBtn = makeButton(this, 610, 1140, 180, 74, '▶ x1', {
      bg: 0x3b4568, fontSize: 24,
      onClick: () => this.toggleSpeed(),
    }).setDepth(1002).setVisible(tier(this.S, 'speed2x') > 0);

    this.updateUI();
  }

  uiText(x, y, str, size = 24, color = '#ffffff') {
    return this.add.text(x, y, str, {
      fontFamily: 'Arial, "Microsoft YaHei", sans-serif', fontSize: size + 'px',
      color, fontStyle: 'bold',
    }).setDepth(1001);
  }

  updateUI() {
    this.waveText.setText(`第 ${this.wave} 波`);
    this.heartText.setText(`❤ ${Math.max(0, this.baseHp)}`);
    this.goldText.setText(String(Math.floor(this.gold)));
    this.diamondText.setText(String(this.S.diamonds + this.diamondsRun));
    const cost = towerCost(this.bought);
    this.buyBtn.label.setText(`造 塔\n💰 ${cost}`);
    const afford = this.gold >= cost && this.slots.some(s => !s.tower);
    this.buyBtn.bg.setFillStyle(afford ? 0x2e6b4f : 0x33384a);
    const giftLeft = 2 - this.adGifts;
    this.giftBtn.label.setText(giftLeft > 0 ? `📺 送高级塔\n(剩${giftLeft}次)` : '📺 已用完');
    this.giftBtn.setEnabled(giftLeft > 0);
  }

  // ================= 开局预置 =================
  presetTowers() {
    const elems = unlockedElements(this.S);
    const elem = Phaser.Utils.Array.GetRandom(elems);
    const a = this.slots[6], b = this.slots[7]; // 中排相邻两格
    a.tower = new Tower(this, a, elem, 1);
    b.tower = new Tower(this, b, elem, 1);
    this.towers.push(a.tower, b.tower);
    if (this.S.runs === 0) {
      // 首局手势引导：拖到一起
      this.hint = this.uiText(W / 2, 470, '👆 拖动合成同色塔！', 30, '#ffe97a').setOrigin(0.5).setDepth(2000);
      this.hintHand = this.uiText(a.x, a.y - 30, '👆', 40).setOrigin(0.5).setDepth(2001);
      this.tweens.add({ targets: this.hintHand, x: b.x, y: b.y - 30, duration: 900, repeat: -1, hold: 300, repeatDelay: 300 });
    }
  }

  clearHint() {
    if (this.hint) { this.hint.destroy(); this.hintHand.destroy(); this.hint = null; }
  }

  // ================= 波次系统 =================
  composeWave(w) {
    const list = [];
    if (w % 5 === 0) {
      const bosses = w < 20 ? 1 : w < 30 ? 2 : 3 + Math.floor((w - 30) / 20);
      for (let i = 0; i < bosses; i++) list.push('boss');
      if (w >= 10) {
        const guards = Math.min(14, waveCount(w) - bosses);
        for (let i = 0; i < guards; i++) list.push(Math.random() < 0.7 ? 'slime' : 'runner');
      }
      return list;
    }
    const pool = [['slime', 40]];
    if (w >= ENEMY_TYPES.runner.from) pool.push(['runner', 25]);
    if (w >= ENEMY_TYPES.tank.from) pool.push(['tank', 18]);
    if (w >= ENEMY_TYPES.flyer.from) pool.push(['flyer', 15]);
    if (w >= ENEMY_TYPES.splitter.from) pool.push(['splitter', 14]);
    const total = pool.reduce((s, p) => s + p[1], 0);
    const n = waveCount(w);
    for (let i = 0; i < n; i++) {
      let r = Math.random() * total;
      for (const [k, wgt] of pool) { r -= wgt; if (r <= 0) { list.push(k); break; } }
      if (list.length <= i) list.push('slime');
    }
    return list;
  }

  startPrep() {
    if (this.over || this.dying) return;
    this.waveState = 'prep';
    this.pending = this.composeWave(this.wave);
    // 预告图标（去重）
    const icons = [...new Set(this.pending)].map(k => TYPE_ICON[k]).join(' ');
    this.previewText.setText(`下一波 ▶ ${icons}`);
    this.callBtn.setVisible(true);
    this.prepTimer = this.time.delayedCall(4000, () => this.startWave(false));
    this.updateUI();
  }

  startWave(early) {
    if (this.waveState !== 'prep' || this.over || this.dying) return;
    if (this.prepTimer) this.prepTimer.remove();
    this.waveGoldMult = early ? 1.1 : 1.0;
    this.callBtn.setVisible(false);
    this.previewText.setText('');
    this.waveState = 'active';
    Sfx.wave();
    this.banner(`Wave ${this.wave}`);
    if (this.wave % 5 === 0) { Sfx.bossIn(); this.cameras.main.shake(350, 0.006); }

    const queue = this.pending.slice();
    this.spawnLeft = queue.length;
    const interval = Phaser.Math.Clamp(15 / queue.length, 0.35, 1.2) * 1000;
    let i = 0;
    this.spawnEvent = this.time.addEvent({
      delay: interval, repeat: queue.length - 1, startAt: interval - 200,
      callback: () => {
        if (this.over || this.dying) return;
        this.spawnEnemy(queue[i++]);
        this.spawnLeft--;
      },
    });
  }

  spawnEnemy(typeKey, opts = {}) {
    const t = ENEMY_TYPES[typeKey];
    const path = t.flying ? this.flyPath : this.path;
    const e = new Enemy(this, typeKey, this.wave, path, opts);
    e.spawnWave = this.wave;
    this.enemies.push(e);
    return e;
  }

  banner(text) {
    const b = this.uiText(W / 2, 400, text, 56, '#ffffff').setOrigin(0.5).setDepth(2500).setScale(0);
    b.setStroke('#000000', 8);
    this.tweens.add({
      targets: b, scale: 1, duration: 260, ease: 'Back.Out',
      onComplete: () => this.tweens.add({ targets: b, alpha: 0, y: 360, delay: 650, duration: 350, onComplete: () => b.destroy() }),
    });
  }

  checkWaveClear() {
    if (this.waveState !== 'active' || this.over || this.dying) return;
    if (this.spawnLeft <= 0 && this.enemies.length === 0) this.endWave();
  }

  endWave() {
    this.waveState = 'idle';
    // 利息（GDD §5.3：5%/档，单波上限 50×档）
    const it = tier(this.S, 'interest');
    if (it > 0) {
      const gain = Math.min(Math.floor(this.gold * 0.05 * it), 50 * it);
      if (gain > 0) { this.gold += gain; toast(this, 380, 200, `利息 +${gain}💰`, '#ffd34e', 24); }
    }
    const finished = this.wave;
    this.wave++;
    // 里程碑钻石
    if (finished % 10 === 0) {
      this.diamondsRun += DIAMOND.milestone;
      toast(this, W / 2, 300, `里程碑! +${DIAMOND.milestone}💎`, '#9fe8ff', 32);
      Sfx.diamond();
    }
    // 阶段色调切换（GDD §2）
    const oldPh = phaseFor(finished), newPh = phaseFor(this.wave);
    if (oldPh !== newPh) {
      this.banner(`${newPh.name}降临`);
      this.tintTo(this.bgAll, oldPh.bg, newPh.bg);
      this.tintTo(this.ground, oldPh.ground, newPh.ground);
    }
    this.updateUI();
    this.startPrep();
  }

  tintTo(rect, from, to) {
    const a = Phaser.Display.Color.IntegerToColor(from), b = Phaser.Display.Color.IntegerToColor(to);
    this.tweens.addCounter({
      from: 0, to: 100, duration: 1200,
      onUpdate: tw => {
        const c = Phaser.Display.Color.Interpolate.ColorWithColor(a, b, 100, tw.getValue());
        rect.setFillStyle(Phaser.Display.Color.GetColor(c.r, c.g, c.b));
      },
    });
  }

  // ================= 敌人事件 =================
  onEnemyDead(e, cause) {
    this.enemies = this.enemies.filter(x => x !== e);
    if (this.over) { e.destroy(); return; }
    this.kills++;
    // 金币（GDD §4.3）
    const g = Math.max(1, Math.round(waveHp(e.spawnWave) * 0.1 * e.type.goldMult * this.waveGoldMult));
    this.gold += g;
    this.burst(e.x, e.y, e.type.color, e.boss ? 40 : 12, e.boss ? 1.6 : 1);
    this.coinFly(e.x, e.y);
    const now = this.time.now;
    if (now - this.lastKillSfx > 90) { Sfx.kill(); this.lastKillSfx = now; }

    if (e.boss) {
      this.diamondsRun += DIAMOND.boss;
      toast(this, e.x, e.y - 60, `+${DIAMOND.boss}💎`, '#9fe8ff', 34);
      Sfx.bossDie();
      this.cameras.main.shake(400, 0.012);
      this.slowmoT = 0.25;
    }
    // 分裂怪（GDD §4.2）
    if (e.type.splits && !this.dying) {
      this.spawnEnemy('mini', { progress: Math.max(0, e.progress - 18) });
      this.spawnEnemy('mini', { progress: e.progress + 18 });
      this.spawnLeft += 0; // 计数不变，enemies 数组已含
    }
    // 毒 Lv7 尸爆传染（GDD §3.3）
    if (cause === 'poison' && e.poisons.some(p => p.lv7)) {
      const src = e.poisons.find(p => p.lv7);
      this.burst(e.x, e.y, 0x7ede55, 20, 1.3);
      for (const o of this.enemies) {
        if (Phaser.Math.Distance.Between(e.x, e.y, o.x, o.y) < 95) o.applyPoison(src.dps, 2, true);
      }
    }
    e.destroy();
    this.updateUI();
    this.checkWaveClear();
  }

  onEnemyLeak(e) {
    e.dead = true;
    this.enemies = this.enemies.filter(x => x !== e);
    e.destroy();
    if (this.over || this.dying) return;
    this.baseHp -= e.boss ? LEAK_BOSS : LEAK_NORMAL;
    Sfx.leak();
    this.vignette.setAlpha(0.28);
    this.tweens.add({ targets: this.vignette, alpha: 0, duration: 400 });
    this.cameras.main.shake(150, 0.006);
    this.updateUI();
    if (this.baseHp <= 0) this.baseDestroyed();
    else this.checkWaveClear();
  }

  // ================= 买塔 / 合成 / 卖塔 =================
  smartRandomElem(spawnLv) {
    const unlocked = unlockedElements(this.S);
    // 智能随机（GDD §3.1）：60% 偏向可立即配对的颜色
    const pairable = [...new Set(this.towers.filter(t => t.lv === spawnLv).map(t => t.elem))]
      .filter(e => unlocked.includes(e));
    if (pairable.length && Math.random() < 0.6) return Phaser.Utils.Array.GetRandom(pairable);
    return Phaser.Utils.Array.GetRandom(unlocked);
  }

  buyTower(silent) {
    const cost = towerCost(this.bought);
    if (this.gold < cost) { if (!silent) toast(this, 360, 1020, '金币不足', '#ff8888', 24); return false; }
    const free = this.slots.filter(s => !s.tower);
    if (!free.length) { if (!silent) toast(this, 360, 1020, '塔位已满，先合成!', '#ff8888', 24); return false; }
    this.gold -= cost;
    this.bought++;
    let lv = spawnFloor(this.wave);
    if (Math.random() < 0.05 * tier(this.S, 'startLv')) lv = Math.min(MAX_LV, lv + 1);
    const elem = this.smartRandomElem(lv);
    const slot = Phaser.Utils.Array.GetRandom(free);
    this.placeTower(slot, elem, lv);
    Sfx.buy();
    this.updateUI();
    return true;
  }

  placeTower(slot, elem, lv) {
    const t = new Tower(this, slot, elem, lv);
    slot.tower = t;
    this.towers.push(t);
    t.c.setScale(0);
    this.tweens.add({ targets: t.c, scale: 1, duration: 240, ease: 'Back.Out' });
    this.burst(slot.x, slot.y - 20, ELEMENTS[elem].color, 8, 0.7);
    if (lv > this.highestLv) this.highestLv = lv;
    return t;
  }

  doMerge(a, b) {
    // b 的位置保留，产出 lv+1
    const slot = b.slot, elem = a.elem, lv = a.lv + 1;
    a.slot.tower = null; slot.tower = null;
    this.towers = this.towers.filter(t => t !== a && t !== b);
    a.destroy(); b.destroy();
    const t = this.placeTower(slot, elem, lv);
    // —— 合成爆点（GDD §6.1）——
    t.c.setScale(1.45);
    this.tweens.add({ targets: t.c, scale: 1, duration: 300, ease: 'Bounce.Out' });
    this.burst(slot.x, slot.y - 24, ELEMENTS[elem].color, 18, 1.1);
    Sfx.merge(lv);
    this.clearHint();
    // 里程碑质变提示（GDD §3.3）
    if (lv === 4 || lv === 7) toast(this, slot.x, slot.y - 90, '⭐ 里程碑质变!', '#ffe97a', 26);
    // 本局最高级：慢镜 + 白闪（GDD §6.2）
    if (lv > this.highestLv || lv === this.highestLv) {
      if (lv >= this.highestLv && lv > 2) {
        this.highestLv = lv;
        this.slowmoT = 0.3;
        this.flash.setAlpha(0.55);
        this.tweens.add({ targets: this.flash, alpha: 0, duration: 450 });
        Sfx.mergeTop();
      }
      this.highestLv = Math.max(this.highestLv, lv);
    }
    this.updateUI();
  }

  sellTower(t) {
    const refund = Math.round(towerCost(this.bought) * 0.5);
    this.gold += refund;
    t.slot.tower = null;
    this.towers = this.towers.filter(x => x !== t);
    this.burst(t.slot.x, t.slot.y - 20, 0xff9aa8, 10, 0.8);
    t.destroy();
    Sfx.sell();
    toast(this, 110, 1000, `+${refund}💰`, '#ffd34e', 26);
    this.updateUI();
  }

  async adGiftTower() {
    if (this.adGifts >= 2) return;
    const free = this.slots.filter(s => !s.tower);
    if (!free.length) { toast(this, 610, 980, '塔位已满', '#ff8888', 22); return; }
    const ok = await Poki.rewardedBreak();
    if (!ok) return;
    this.adGifts++;
    const lv = Math.min(MAX_LV, Math.max(3, spawnFloor(this.wave)));
    this.placeTower(Phaser.Utils.Array.GetRandom(free), this.smartRandomElem(lv), lv);
    Sfx.merge(lv);
    this.updateUI();
  }

  autoBuyTick() {
    if (!tier(this.S, 'autoBuy') || this.over || this.dying) return;
    this.buyTower(true);
  }

  autoMergeTick() {
    if (!tier(this.S, 'autoMerge') || this.over || this.dying) return;
    // 找最高等级的可合成对
    const groups = {};
    for (const t of this.towers) {
      if (t.lv >= MAX_LV || t.dragging) continue;
      const k = t.elem + '_' + t.lv;
      (groups[k] = groups[k] || []).push(t);
    }
    let best = null;
    for (const k in groups) {
      if (groups[k].length >= 2 && (!best || groups[k][0].lv > best[0].lv)) best = groups[k];
    }
    if (best) this.doMerge(best[0], best[1]);
  }

  toggleSpeed() {
    this.speedMult = this.speedMult === 1 ? 2 : 1;
    this.time.timeScale = this.speedMult;
    this.tweens.timeScale = this.speedMult;
    this.speedBtn.label.setText(`▶ x${this.speedMult}`);
  }

  // ================= 拖拽 =================
  setupDrag() {
    this.rangeCircle = this.add.circle(0, 0, 100, 0xffffff, 0.06).setStrokeStyle(2, 0xffffff, 0.35).setVisible(false).setDepth(900);

    this.input.on('dragstart', (pointer, obj) => {
      const t = obj.towerRef;
      if (!t || this.over) return;
      t.dragging = true;
      obj.setDepth(2600);
      this.rangeCircle.setPosition(t.slot.x, t.slot.y).setRadius(t.range).setVisible(true);
      this.sellZone.setStrokeStyle(3, 0xff6b7d).setScale(1.06);
      // 高亮可合成目标
      for (const o of this.towers) {
        if (o !== t && o.elem === t.elem && o.lv === t.lv && t.lv < MAX_LV) o.setHighlight(true);
      }
    });

    this.input.on('drag', (pointer, obj, dragX, dragY) => {
      if (!obj.towerRef) return;
      obj.setPosition(dragX, dragY);
    });

    this.input.on('dragend', (pointer, obj) => {
      const t = obj.towerRef;
      if (!t) return;
      t.dragging = false;
      this.rangeCircle.setVisible(false);
      this.sellZone.setStrokeStyle(2, 0x9c4a58).setScale(1);
      for (const o of this.towers) o.setHighlight(false);

      // 回收区
      if (this.sellRect.contains(obj.x, obj.y)) { this.sellTower(t); return; }
      // 找最近塔位
      let nearest = null, nd = 80;
      for (const s of this.slots) {
        const d = Phaser.Math.Distance.Between(obj.x, obj.y + 8, s.x, s.y);
        if (d < nd) { nd = d; nearest = s; }
      }
      if (!nearest || nearest === t.slot) { t.moveTo(t.slot); return; }
      if (!nearest.tower) {
        t.slot.tower = null;
        nearest.tower = t;
        t.moveTo(nearest);
      } else if (nearest.tower.elem === t.elem && nearest.tower.lv === t.lv && t.lv < MAX_LV) {
        this.doMerge(t, nearest.tower);
      } else {
        t.moveTo(t.slot);
      }
    });
  }

  // ================= 战斗 =================
  targetFor(tower) {
    let best = null, bestRemain = Infinity;
    for (const e of this.enemies) {
      if (e.dead) continue;
      const d = Phaser.Math.Distance.Between(tower.slot.x, tower.slot.y, e.x, e.y);
      if (d > tower.range + e.type.size * 0.5) continue;
      const remain = e.path.total - e.progress;
      if (remain < bestRemain) { bestRemain = remain; best = e; }
    }
    return best;
  }

  fireTower(t, target) {
    t.resetCooldown();
    t.recoil();
    const dmg = t.dmg;
    const lv = t.lv, elem = t.elem, color = t.color;
    const sx = t.slot.x, sy = t.slot.y - 50;

    if (elem === 'lightning') {
      // 连锁闪电：瞬发
      const chainN = lv >= 7 ? 5 : lv >= 4 ? 4 : 3;
      const chain = [target];
      while (chain.length < chainN) {
        const last = chain[chain.length - 1];
        let next = null, nd = 150;
        for (const e of this.enemies) {
          if (e.dead || chain.includes(e)) continue;
          const d = Phaser.Math.Distance.Between(last.x, last.y, e.x, e.y);
          if (d < nd) { nd = d; next = e; }
        }
        if (!next) break;
        chain.push(next);
      }
      const g = this.add.graphics().setDepth(2100);
      g.lineStyle(3, 0xfff2a8, 0.95);
      let px = sx, py = sy;
      for (const e of chain) { this.zigzag(g, px, py, e.x, e.y - 10); px = e.x; py = e.y - 10; }
      this.tweens.add({ targets: g, alpha: 0, duration: 180, onComplete: () => g.destroy() });
      chain.forEach((e, i) => {
        const mult = (lv >= 7 && i === chain.length - 1) ? 2 : 1;
        const real = e.takeDamage(dmg * mult);
        this.showDmg(e.x, e.y - 40, real, '#fff2a8');
      });
      Sfx.hit();
      return;
    }

    if (elem === 'light') {
      // 光束：瞬发 + 斩杀
      const g = this.add.graphics().setDepth(2100);
      g.lineStyle(5, 0xfff8dc, 0.9);
      g.lineBetween(sx, sy, target.x, target.y - 10);
      g.lineStyle(10, 0xfff8dc, 0.25);
      g.lineBetween(sx, sy, target.x, target.y - 10);
      this.tweens.add({ targets: g, alpha: 0, duration: 200, onComplete: () => g.destroy() });
      const threshold = lv >= 4 ? 0.20 : 0.15;
      if (target.hp / target.maxHp <= threshold) {
        this.showDmg(target.x, target.y - 50, '处决!', '#fff8dc');
        this.burst(target.x, target.y, 0xfff8dc, 16, 1.1);
        Sfx.execute();
        if (lv >= 7) { this.atkBuffT = 3; toast(this, sx, sy - 40, '⚡全场攻速+30%', '#fff8dc', 22); }
        target.takeDamage(target.hp + 1, { trueDmg: true, cause: 'execute' });
      } else {
        const mult = target.flying ? 1.5 : 1;
        const real = target.takeDamage(dmg * mult);
        this.showDmg(target.x, target.y - 40, real, '#fff8dc');
      }
      return;
    }

    // 弹道类：火 / 冰 / 毒
    const b = this.add.image(sx, sy, 'bullet').setTint(color).setDepth(2050).setScale(0.9);
    const dur = Phaser.Math.Distance.Between(sx, sy, target.x, target.y) / 1.4;
    this.tweens.add({
      targets: b, x: target.x, y: target.y - 10, duration: dur,
      onComplete: () => {
        const ix = b.x, iy = b.y;
        b.destroy();
        if (this.over) return;
        Sfx.hit();
        if (elem === 'fire') {
          const radius = (lv >= 4 ? 95 : 62) + lv * 2;
          this.burst(ix, iy, color, 14, 1);
          for (const e of [...this.enemies]) {
            if (e.dead) continue;
            if (Phaser.Math.Distance.Between(ix, iy, e.x, e.y) <= radius + e.type.size * 0.5) {
              const real = e.takeDamage(dmg);
              this.showDmg(e.x, e.y - 40, real, '#ffb199');
            }
          }
          if (lv >= 7) this.addBurnZone(ix, iy, dmg * 0.5);
        } else if (elem === 'ice') {
          if (!target.dead) {
            const real = target.takeDamage(dmg);
            this.showDmg(target.x, target.y - 40, real, '#bfe8ff');
            target.applySlow(lv >= 4 ? 70 : 60);
            if (lv >= 7 && Math.random() < 0.10 && !target.dead) { target.applyFreeze(1); Sfx.freeze(); this.burst(target.x, target.y, 0xbfe8ff, 10, 0.8); }
          }
        } else if (elem === 'poison') {
          if (!target.dead) {
            target.applyPoison(dmg, lv >= 4 ? 2 : 1, lv >= 7);
            this.showDmg(target.x, target.y - 40, '☠', '#9ef07a');
          }
        }
      },
    });
  }

  zigzag(g, x1, y1, x2, y2) {
    const segs = 4;
    let px = x1, py = y1;
    for (let i = 1; i <= segs; i++) {
      const t = i / segs;
      const nx = x1 + (x2 - x1) * t + (i < segs ? Phaser.Math.Between(-12, 12) : 0);
      const ny = y1 + (y2 - y1) * t + (i < segs ? Phaser.Math.Between(-12, 12) : 0);
      g.lineBetween(px, py, nx, ny);
      px = nx; py = ny;
    }
  }

  addBurnZone(x, y, dps) {
    const img = this.add.image(x, y, 'glow').setTint(0xff7733).setAlpha(0.55).setScale(1.8).setDepth(100);
    this.burnZones.push({ x, y, dps, t: 2, img, tick: 0 });
  }

  // ================= 特效工具 =================
  burst(x, y, color, n = 12, scale = 1) {
    const p = this.add.particles(x, y, 'spark', {
      speed: { min: 60, max: 260 }, scale: { start: 0.85 * scale, end: 0 },
      lifespan: 420, tint: color, emitting: false,
    }).setDepth(2200);
    p.explode(n);
    this.time.delayedCall(700, () => p.destroy());
  }

  showDmg(x, y, val, color) {
    if (this.dmgCount > 34) return;
    this.dmgCount++;
    const str = typeof val === 'number' ? String(Math.max(1, Math.round(val))) : val;
    const t = this.add.text(x + Phaser.Math.Between(-14, 14), y, str, {
      fontFamily: 'Arial Black, sans-serif', fontSize: '22px', color, stroke: '#000000', strokeThickness: 4,
    }).setOrigin(0.5).setDepth(2300);
    this.tweens.add({
      targets: t, y: y - 48, alpha: 0, duration: 600, ease: 'Cubic.Out',
      onComplete: () => { t.destroy(); this.dmgCount--; },
    });
  }

  coinFly(x, y) {
    if (this.coinCount > 7) return;
    this.coinCount++;
    const c = this.add.image(x, y, 'coin').setDepth(2400);
    this.tweens.add({
      targets: c, x: 340, y: 30, scale: 0.7, duration: 480, ease: 'Cubic.In',
      onComplete: () => { c.destroy(); this.coinCount--; Sfx.coin(); },
    });
  }

  // ================= 死亡 / 复活 / 结算 =================
  baseDestroyed() {
    if (this.dying || this.over) return;
    this.dying = true;
    if (this.prepTimer) this.prepTimer.remove();
    if (this.spawnEvent) this.spawnEvent.remove();
    this.cameras.main.shake(500, 0.015);

    if (!this.revived) {
      // 广告复活（GDD §7）
      const layer = this.add.container(0, 0).setDepth(4000);
      layer.add(this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.7).setInteractive());
      layer.add(this.add.rectangle(W / 2, 560, 560, 420, 0x1e2233).setStrokeStyle(3, 0x4a5578));
      layer.add(this.uiText(W / 2, 420, '💔 基地告急!', 44, '#ff7a7a').setOrigin(0.5));
      layer.add(this.uiText(W / 2, 490, `第 ${this.wave} 波`, 28, '#c9d2f0').setOrigin(0.5));
      layer.add(makeButton(this, W / 2, 590, 420, 80, '📺 复活 (回50%血+清场)', {
        bg: 0x6b4a86, stroke: 0xb07fe0, fontSize: 25,
        onClick: async () => {
          const ok = await Poki.rewardedBreak();
          if (!ok) return;
          layer.destroy();
          this.revive();
        },
      }));
      layer.add(makeButton(this, W / 2, 690, 420, 70, '结束本局', {
        bg: 0x51586e, fontSize: 24,
        onClick: () => { layer.destroy(); this.endRun(); },
      }));
    } else {
      this.endRun();
    }
  }

  revive() {
    this.revived = true;
    this.baseHp = Math.ceil(this.maxBase / 2);
    // 清场
    for (const e of [...this.enemies]) {
      this.burst(e.x, e.y, 0xffffff, 10, 1);
      e.dead = true;
      e.destroy();
    }
    this.enemies = [];
    this.spawnLeft = 0;
    this.dying = false;
    this.flash.setAlpha(0.7);
    this.tweens.add({ targets: this.flash, alpha: 0, duration: 600 });
    this.banner('复活!');
    this.updateUI();
    this.waveState = 'idle';
    this.endWave();
  }

  async endRun() {
    if (this.over) return;
    this.over = true;
    Poki.gameplayStop();
    const S = this.S;
    const deathBonus = Math.floor(this.wave / DIAMOND.deathBonusPerWave);
    this.diamondsRun += deathBonus;
    S.diamonds += this.diamondsRun;
    const newBest = this.wave > S.best;
    if (newBest) S.best = this.wave;
    S.runs++;
    S.lastSeen = Date.now();
    writeSave(S);
    Sfx.gameOver();
    await Poki.commercialBreak();
    this.scene.start('Result', {
      wave: this.wave, kills: this.kills, dRun: this.diamondsRun, newBest, deathBonus,
    });
  }

  // ================= 主循环 =================
  update(time, delta) {
    if (this.over) return;
    let dts = (delta / 1000) * this.speedMult;
    // 慢镜（按真实时间衰减）
    if (this.slowmoT > 0) {
      this.slowmoT -= delta / 1000;
      dts *= 0.3;
    }
    if (this.dying) return;

    // 敌人
    for (const e of [...this.enemies]) e.update(dts);

    // 光 Lv7 攻速 buff
    if (this.atkBuffT > 0) this.atkBuffT -= dts;
    const buff = this.atkBuffT > 0 ? 1.3 : 1;

    // 塔开火
    for (const t of this.towers) {
      if (t.dragging) continue;
      t.tickCooldown(dts, buff);
      if (t.ready()) {
        const target = this.targetFor(t);
        if (target) this.fireTower(t, target);
      }
    }

    // 燃烧地面
    for (const z of this.burnZones) {
      z.t -= dts;
      z.tick -= dts;
      if (z.tick <= 0) {
        z.tick = 0.25;
        for (const e of [...this.enemies]) {
          if (!e.dead && !e.flying && Phaser.Math.Distance.Between(z.x, z.y, e.x, e.y) < 58) {
            e.takeDamage(z.dps * 0.25, { trueDmg: true });
          }
        }
      }
      if (z.t <= 0) z.img.destroy();
    }
    this.burnZones = this.burnZones.filter(z => z.t > 0);

    // Boss 血条
    const bosses = this.enemies.filter(e => e.boss);
    if (bosses.length) {
      const ratio = bosses.reduce((s, b) => s + Math.max(0, b.hp), 0) / bosses.reduce((s, b) => s + b.maxHp, 0);
      this.bossBarBg.setVisible(true);
      this.bossBar.setVisible(true).width = 600 * ratio;
    } else {
      this.bossBarBg.setVisible(false);
      this.bossBar.setVisible(false);
    }
  }
}
