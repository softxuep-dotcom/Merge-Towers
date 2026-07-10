import {
  W, H, MAX_LV, ELEMENTS, ENEMY_TYPES, BASE_HP, LEAK_BOSS, LEAK_NORMAL,
  PHASES, phaseFor, towerPrice, towerBasePrice, waveHp, waveCount, spawnFloor, DIAMOND,
  MERGE_SURGE, SLOT_AFFIXES, ELITE, TOWER_BRANCHES, BOSS_AFFIXES,
  NON_BOSS_SPEED_CAP, nonBossSpeedMult,
} from '../config.js';
import { Enemy, Path } from '../classes/Enemy.js';
import { Tower } from '../classes/Tower.js';
import { makeButton, toast } from '../ui.js';
import {
  Sfx, setMuted, isMuted, unlockAudio,
  startStageAudio, stopStageAudio, setAudioPhase,
} from '../audio.js';
import { Poki } from '../poki.js';
import { writeSave, tier, unlockedElements } from '../save.js';
import { addTowerImage, fitTowerImageHeight } from '../textures.js';

// 地面路径（行进式像素描迹校准到石板路中轴线，2026-07-09）
const PATH_PTS = [
  { x: 118, y: -35 }, { x: 120, y: 40 }, { x: 135, y: 100 }, { x: 153, y: 158 },
  { x: 168, y: 220 }, { x: 160, y: 275 }, { x: 145, y: 305 }, { x: 172, y: 330 },
  { x: 230, y: 333 }, { x: 315, y: 333 }, { x: 410, y: 333 }, { x: 515, y: 333 },
  { x: 585, y: 338 }, { x: 628, y: 370 }, { x: 646, y: 425 }, { x: 646, y: 500 },
  { x: 644, y: 590 }, { x: 620, y: 640 }, { x: 575, y: 664 }, { x: 480, y: 666 },
  { x: 380, y: 666 }, { x: 280, y: 666 }, { x: 190, y: 666 }, { x: 130, y: 680 },
  { x: 92, y: 722 }, { x: 88, y: 775 }, { x: 118, y: 812 }, { x: 170, y: 825 },
  { x: 270, y: 825 }, { x: 370, y: 825 }, { x: 480, y: 825 }, { x: 555, y: 830 },
  { x: 595, y: 862 }, { x: 598, y: 902 }, { x: 560, y: 940 }, { x: 500, y: 975 },
  { x: 440, y: 1005 }, { x: 390, y: 1045 }, { x: 365, y: 1100 }, { x: 382, y: 1142 },
  { x: 430, y: 1168 }, { x: 470, y: 1158 }, { x: 492, y: 1130 },
];

// 飞行兵直线航道：与地面怪同一左上入口进场，直线抄近路飞向城堡（GDD §4.2）
const FLY_PTS = [{ x: 60, y: -30 }, { x: 480, y: 1015 }];
const SLOT_XS = [159, 260, 362, 464, 565];
const SLOT_YS = [458, 584];
const TYPE_ICON = { slime: '🟣', runner: '💨', tank: '🛡️', flyer: '🐝', splitter: '🟠', boss: '💀', mini: '·' };
const TYPE_CN = { slime: '小兵', runner: '疾行者', tank: '铁盾兵', flyer: '飞行兵', splitter: '分裂怪', boss: 'Boss', mini: '小怪' };
const ELITE_ICON = { shield: '🛡', haste: '🌀', split: '✹' };
const BOSS_AFFIX_KEYS = ['resilient', 'armored', 'twin', 'rage'];
const LANDSCAPE_SIDEBAR_MIN = 360;
const LANDSCAPE_SIDEBAR_MAX = 430;

export class GameScene extends Phaser.Scene {
  constructor() { super('Game'); }

  create() {
    const S = this.S = this.registry.get('save');
    // ---- 局内状态 ----
    this.gold = Math.round((40 + 20 * tier(S, 'startGold')) * (S.coupon ? 1.5 : 1));
    if (S.coupon) { S.coupon = false; writeSave(S); }
    this.displayGold = this.gold;
    this.goldRollTween = null;
    this.maxBase = BASE_HP + 2 * tier(S, 'baseArmor');
    this.baseHp = this.maxBase;
    this.wave = 1;
    this.bought = 0;
    this.waveBought = 0; // 波内购买计数（价格热度，每波重置）
    this.kills = 0;
    this.diamondsRun = 0;
    this.highestLv = 1;
    this.revived = false;
    this.lastStandUsed = false;
    this.lastStandActive = false;
    this.lastStandT = 0;
    this.lastStandLeaked = false;
    this.lastStandCanClutch = false;
    this.lastStandOverlay = null;
    this.lastStandText = null;
    this.deathWave = 0;
    this.adGifts = 0;
    this.runSpeedUnlocked = tier(S, 'speed2x') > 0;
    this.speedMult = 1;
    this.slowmoT = 0;
    this.atkBuffT = 0;
    this.atkBuffMult = 1.3;
    this.evolutionChoiceOpen = false;
    this.evolutionLayer = null;
    this.evolutionPrevTimeScale = null;
    this.evolutionPrevTweenScale = null;
    this.holyHealThisWave = 0;
    this.waveGoldMult = 1;
    this.resonanceGoldMult = 1;
    this.resonanceStacks = 0;
    this.resonanceDeadline = 0;
    this.resonanceRing = null;
    this.towerChoiceLayer = null;
    this.pendingTowerDraft = null;
    this.placementHint = null;
    this.waveState = 'idle'; // prep | active
    this.spawnLeft = 0;
    this.dying = false;
    this.over = false;
    this.enemies = [];
    this.towers = [];
    this.burnZones = [];
    this.leakStats = {};
    this.dmgCount = 0;
    this.coinCount = 0;
    this.lastKillSfx = 0;
    this.installAudioLifecycle();

    this.path = new Path(PATH_PTS);
    this.flyPath = new Path(FLY_PTS);

    this.buildField();
    this.buildUI();
    this.setupDrag();
    this.presetTowers();

    // 自动化（局外解锁）
    this.time.addEvent({ delay: 600, loop: true, callback: () => this.autoBuyTick() });
    this.time.addEvent({ delay: 800, loop: true, callback: () => this.autoMergeTick() });

    // 开发工具：?editor=1 进入点击式路径编辑器（见 src/dev/pathEditor.js）
    if (new URLSearchParams(window.location.search).has('editor')) {
      import('../dev/pathEditor.js').then(m => m.startPathEditor(this));
      return;
    }
    Poki.gameplayStart();
    this.startPrep();
  }

  // ================= 场景搭建 =================
  buildField() {
    const ph = phaseFor(1);
    this.hasBg = this.textures.exists('map_bg');

    if (this.hasBg) {
      // 森林手绘背景：平台/路径/城堡已在图中，逻辑坐标对齐即可
      this.add.image(W / 2, H / 2, 'map_bg').setDepth(-20);
      // 阶段色调改为半透明叠色层（白天 alpha=0）
      this.phaseOverlay = this.add.rectangle(W / 2, H / 2, W, H, ph.bg, 0).setDepth(-18);
    } else {
      this.bgAll = this.add.rectangle(W / 2, H / 2, W, H, ph.bg).setDepth(-20);
      this.ground = this.add.rectangle(W / 2, 490, 704, 940, ph.ground).setDepth(-19);
      const g = this.add.graphics().setDepth(-15);
      g.lineStyle(58, 0x2a2d40, 1);
      g.strokePoints(PATH_PTS.map(p => new Phaser.Math.Vector2(p.x, p.y)), false);
      PATH_PTS.slice(1, -1).forEach(p => { g.fillStyle(0x2a2d40, 1); g.fillCircle(p.x, p.y, 29); });
      g.lineStyle(46, 0x3a3e58, 1);
      g.strokePoints(PATH_PTS.map(p => new Phaser.Math.Vector2(p.x, p.y)), false);
      PATH_PTS.slice(1, -1).forEach(p => { g.fillStyle(0x3a3e58, 1); g.fillCircle(p.x, p.y, 23); });
      this.add.image(560, 1000, 'base').setDepth(1040);
    }

    // 飞行航道（虚线示意，两种模式都画）
    const fg = this.add.graphics().setDepth(-14);
    fg.lineStyle(2, 0x7fe7e0, this.hasBg ? 0.18 : 0.25);
    const fa = FLY_PTS[0], fb = FLY_PTS[1];
    for (let t = 0; t < 1; t += 0.05) {
      fg.lineBetween(fa.x + (fb.x - fa.x) * t, fa.y + (fb.y - fa.y) * t,
        fa.x + (fb.x - fa.x) * (t + 0.025), fa.y + (fb.y - fa.y) * (t + 0.025));
    }

    // 塔位（背景图已画好平台 → 只建逻辑格 + 拖拽时的高亮环）
    this.slots = [];
    this.slotRings = [];
    for (const y of SLOT_YS) for (const x of SLOT_XS) {
      if (!this.hasBg) this.add.image(x, y, 'slot').setDepth(-10);
      const ring = this.add.circle(x, y, 46, 0xffe97a, 0).setStrokeStyle(3, 0xffe97a, 0).setDepth(-9);
      this.slots.push({ x, y, tower: null, ring });
      this.slotRings.push(ring);
    }
    this.assignSlotAffixes();

    // 红色警示边缘（漏怪反馈）
    this.vignette = this.add.rectangle(W / 2, H / 2, W, H, 0xff2222, 0).setDepth(2900);
    // 白闪（最高级合成）
    this.flash = this.add.rectangle(W / 2, H / 2, W, H, 0xffffff, 0).setDepth(2950);
  }

  // 拖拽时高亮所有空塔位
  showFreeSlots(on) {
    for (const s of this.slots) {
      s.ring.setStrokeStyle(3, 0xffe97a, on && !s.tower ? 0.7 : 0);
    }
  }

  assignSlotAffixes() {
    const keys = Object.keys(SLOT_AFFIXES);
    const count = Phaser.Math.Between(2, 3);
    const picked = Phaser.Utils.Array.Shuffle(this.slots.slice()).slice(0, count);
    picked.forEach((slot, i) => {
      const affix = SLOT_AFFIXES[keys[i % keys.length]];
      slot.affix = affix;

      const glow = this.add.image(slot.x, slot.y + 2, 'glow')
        .setTint(affix.color)
        .setAlpha(0.42)
        .setScale(1.22)
        .setDepth(-8);
      const icon = this.uiText(slot.x + 30, slot.y - 18, affix.icon, 20, this.hexColor(affix.color))
        .setOrigin(0.5)
        .setDepth(-7);
      icon.setStroke('#1a1d2e', 4);
      const pulse = this.add.circle(slot.x, slot.y, 40, affix.color, 0)
        .setStrokeStyle(2, affix.color, 0.34)
        .setDepth(-7);
      this.tweens.add({ targets: glow, alpha: 0.22, scale: 1.4, duration: 1300, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
      this.tweens.add({ targets: pulse, scale: 1.12, alpha: 0.26, duration: 1100, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
      slot.affixFx = [glow, icon, pulse];
    });
  }

  buildUI() {
    this.layoutBg = this.add.rectangle(W / 2, H / 2, W, H, 0x12131f, 1).setDepth(-40);
    this.sidebarBg = this.add.rectangle(W / 2, H / 2, 1, 1, 0x161825, 0.94).setDepth(995).setVisible(false);
    this.sidebarDivider = this.add.rectangle(W / 2, H / 2, 2, H, 0x2d3348, 1).setDepth(996).setVisible(false);

    // 顶部状态栏
    this.topBar = this.add.rectangle(W / 2, 30, W, 60, 0x161825, 0.9).setDepth(1000);
    this.waveText = this.uiText(20, 30, '', 26, '#ffffff').setOrigin(0, 0.5);
    this.heartText = this.uiText(180, 30, '', 24, '#ff7a7a').setOrigin(0, 0.5);
    this.coinIcon = this.add.image(332, 30, 'coin').setDepth(1001).setScale(1.2);
    this.goldText = this.uiText(350, 30, '0', 26, '#ffd34e').setOrigin(0, 0.5);
    this.diamondIcon = this.add.image(516, 30, 'diamond').setDepth(1001).setScale(0.9);
    this.diamondText = this.uiText(534, 30, '0', 26, '#9fe8ff').setOrigin(0, 0.5);
    this.muteBtn = this.uiText(688, 30, isMuted() ? '🔇' : '🔊', 28).setOrigin(0.5).setInteractive({ useHandCursor: true })
      .on('pointerdown', () => {
        const nextMuted = !isMuted();
        if (!nextMuted) unlockAudio();
        setMuted(nextMuted);
        this.S.muted = isMuted(); writeSave(this.S);
        this.muteBtn.setText(isMuted() ? '🔇' : '🔊');
        if (!isMuted()) startStageAudio(phaseFor(this.wave));
      });

    // Boss 血条
    this.bossBarBg = this.add.rectangle(W / 2, 74, 604, 14, 0x000000, 0.6).setDepth(1000).setVisible(false);
    this.bossBar = this.add.rectangle(W / 2 - 300, 74, 600, 10, 0xe84a5f).setOrigin(0, 0.5).setDepth(1001).setVisible(false);

    // 下一波预告
    this.previewText = this.uiText(W / 2, 110, '', 24, '#c9d2f0').setOrigin(0.5);

    // 底部面板（背景图模式半透明，露出城堡）
    this.bottomPanel = this.add.rectangle(W / 2, 1130, W, 300, 0x161825, this.hasBg ? 0.82 : 0.95).setDepth(1000);

    // 提前召唤
    this.callBtn = makeButton(this, W / 2, 1012, 340, 58, '⚔ 提前召唤 +10%金币', {
      bg: 0x6b5a2e, stroke: 0xd8b74f, fontSize: 24,
      onClick: () => this.startWave(true),
    }).setDepth(1002).setVisible(false);

    // 买塔（核心按钮）
    this.buyBtn = makeButton(this, 360, 1155, 290, 130, '', {
      bg: 0x2e6b4f, stroke: 0x59c98f, fontSize: 30,
      onClick: () => this.buyTower(),
    }).setDepth(1002);

    // 回收区
    this.sellRect = new Phaser.Geom.Rectangle(30, 1090, 160, 130);
    this.sellZone = this.add.rectangle(110, 1155, 160, 130, 0x5a2e35, 1).setStrokeStyle(2, 0x9c4a58).setDepth(1001);
    this.sellText = this.uiText(110, 1155, '♻\n回收 50%', 22, '#ff9aa8').setOrigin(0.5).setDepth(1002);

    // 广告送塔
    this.giftBtn = makeButton(this, 610, 1105, 180, 70, '', {
      bg: 0x6b4a86, stroke: 0xb07fe0, fontSize: 20,
      onClick: () => this.adGiftTower(),
    }).setDepth(1002);

    // 2 倍速（局外解锁后显示）
    this.speedBtn = makeButton(this, 610, 1195, 180, 70, '', {
      bg: 0x3b4568, fontSize: 24,
      onClick: () => this.toggleSpeed(),
    }).setDepth(1002);
    this.updateSpeedButton();

    if (typeof this.applyResponsiveLayout === 'function') this.applyResponsiveLayout();
    this.updateUI();
  }

  applyResponsiveLayout() {
    const viewW = this.scale.width || W;
    const viewH = this.scale.height || H;
    const landscape = viewW > viewH && viewW > W + 160;
    const sidebarW = landscape
      ? Phaser.Math.Clamp(Math.round(viewW * 0.22), LANDSCAPE_SIDEBAR_MIN, LANDSCAPE_SIDEBAR_MAX)
      : 0;
    const gutter = landscape ? 36 : 0;
    const contentW = landscape ? Math.min(viewW, W + gutter + sidebarW) : W;
    const fieldOffset = landscape ? Math.max(0, Math.round((viewW - contentW) / 2)) : 0;
    const fieldAreaW = landscape ? fieldOffset + W + gutter : W;
    const fieldCenterScreen = landscape ? fieldOffset + W / 2 : W / 2;

    this.cameras.main.setZoom(1);
    this.cameras.main.setScroll(-fieldOffset, 0);
    this.cameras.main.setBackgroundColor('#12131f');
    this.layout = {
      key: `${viewW}x${viewH}`,
      viewW,
      viewH,
      landscape,
      sidebarW,
      fieldAreaW,
      fieldCenterScreen,
      fieldOffset,
      x: sx => sx - fieldOffset,
    };

    this.setRect(this.layoutBg, this.layout.x(viewW / 2), viewH / 2, viewW, viewH);
    this.setRect(this.vignette, this.layout.x(viewW / 2), viewH / 2, viewW, viewH);
    this.setRect(this.flash, this.layout.x(viewW / 2), viewH / 2, viewW, viewH);

    if (landscape) this.applyLandscapeUI();
    else this.applyPortraitUI();
  }

  ensureResponsiveLayout() {
    const key = `${this.scale.width || W}x${this.scale.height || H}`;
    if (!this.layout || this.layout.key !== key) this.applyResponsiveLayout();
  }

  setRect(rect, x, y, w, h) {
    rect.setPosition(x, y);
    if (rect.setSize) rect.setSize(w, h);
    rect.width = w;
    rect.height = h;
  }

  setUi(obj, screenX, screenY) {
    obj.setPosition(this.layout.x(screenX), screenY);
    return obj;
  }

  setUiRect(rect, screenX, screenY, w, h) {
    this.setRect(rect, this.layout.x(screenX), screenY, w, h);
    return rect;
  }

  applyPortraitUI() {
    const bottom = this.layout.viewH;
    const panelY = bottom - 150;
    const callY = bottom - 268;
    const actionY = bottom - 125;

    this.sidebarBg.setVisible(false);
    this.sidebarDivider.setVisible(false);
    this.bottomPanel.setVisible(true);

    this.setUiRect(this.topBar, W / 2, 30, W, 60);
    this.setUi(this.waveText, 20, 30).setOrigin(0, 0.5);
    this.setUi(this.heartText, 180, 30).setOrigin(0, 0.5);
    this.setUi(this.coinIcon, 332, 30).setScale(1.2);
    this.setUi(this.goldText, 350, 30).setOrigin(0, 0.5);
    this.setUi(this.diamondIcon, 516, 30).setScale(0.9);
    this.setUi(this.diamondText, 534, 30).setOrigin(0, 0.5);
    this.setUi(this.muteBtn, 688, 30).setOrigin(0.5);

    this.bossBarMaxWidth = 600;
    this.setUiRect(this.bossBarBg, W / 2, 74, 604, 14);
    this.bossBar.setPosition(this.layout.x(W / 2 - 300), 74);
    this.bossBar.height = 10;
    this.setUi(this.previewText, W / 2, 110).setOrigin(0.5);

    this.setUiRect(this.bottomPanel, W / 2, panelY, W, 300);
    this.setUi(this.callBtn, W / 2, callY);
    this.setUi(this.buyBtn, 360, actionY);
    this.sellRect = new Phaser.Geom.Rectangle(30, bottom - 190, 160, 130);
    this.setUiRect(this.sellZone, 110, actionY, 160, 130);
    this.setUi(this.sellText, 110, actionY).setOrigin(0.5);
    this.setUi(this.giftBtn, 610, bottom - 175);
    this.setUi(this.speedBtn, 610, bottom - 85);
  }

  applyLandscapeUI() {
    const { viewW, viewH, sidebarW, fieldAreaW } = this.layout;
    const sideCenter = fieldAreaW + sidebarW / 2;
    const sideLeft = fieldAreaW + 24;
    const sideRight = fieldAreaW + sidebarW - 24;

    this.sidebarBg.setVisible(true);
    this.sidebarDivider.setVisible(true);
    this.bottomPanel.setVisible(false);
    this.setUiRect(this.sidebarBg, sideCenter, viewH / 2, sidebarW, viewH);
    this.setUiRect(this.sidebarDivider, fieldAreaW, viewH / 2, 2, viewH);

    this.setUiRect(this.topBar, sideCenter, 76, sidebarW - 34, 120);
    this.setUi(this.waveText, sideLeft + 12, 42).setOrigin(0, 0.5);
    this.setUi(this.heartText, sideLeft + 150, 42).setOrigin(0, 0.5);
    this.setUi(this.coinIcon, sideLeft + 22, 93).setScale(1.1);
    this.setUi(this.goldText, sideLeft + 46, 93).setOrigin(0, 0.5);
    this.setUi(this.diamondIcon, sideLeft + 178, 93).setScale(0.82);
    this.setUi(this.diamondText, sideLeft + 200, 93).setOrigin(0, 0.5);
    this.setUi(this.muteBtn, sideRight - 20, 42).setOrigin(0.5);

    this.bossBarMaxWidth = sidebarW - 74;
    this.setUiRect(this.bossBarBg, sideCenter, 146, this.bossBarMaxWidth + 4, 14);
    this.bossBar.setPosition(this.layout.x(sideCenter - this.bossBarMaxWidth / 2), 146);
    this.bossBar.height = 10;
    this.setUi(this.previewText, sideCenter, 178).setOrigin(0.5);

    this.setUi(this.callBtn, sideCenter, 238);
    this.setUi(this.buyBtn, sideCenter, 352);

    const sellX = sideLeft + 82;
    const sellY = 514;
    this.sellRect = new Phaser.Geom.Rectangle(this.layout.x(sellX - 80), sellY - 65, 160, 130);
    this.setUiRect(this.sellZone, sellX, sellY, 160, 130);
    this.setUi(this.sellText, sellX, sellY).setOrigin(0.5);
    this.setUi(this.giftBtn, sideRight - 90, 490);
    this.setUi(this.speedBtn, sideRight - 90, 584);
  }

  uiText(x, y, str, size = 24, color = '#ffffff') {
    return this.add.text(x, y, str, {
      fontFamily: 'Arial, "Microsoft YaHei", sans-serif', fontSize: size + 'px',
      color, fontStyle: 'bold',
    }).setDepth(1001);
  }

  installAudioLifecycle() {
    startStageAudio(phaseFor(this.wave));
    this.input.on('pointerdown', this.unlockSceneAudio, this);
    this.events.once('shutdown', () => {
      this.input.off('pointerdown', this.unlockSceneAudio, this);
      stopStageAudio();
    });
  }

  unlockSceneAudio() {
    unlockAudio();
    setAudioPhase(phaseFor(this.wave), { immediate: true });
  }

  updateUI() {
    this.waveText.setText(`第 ${this.wave} 波`);
    this.heartText.setText(`❤ ${Math.max(0, this.baseHp)}`);
    if (this.goldRollTween && this.gold < this.displayGold) {
      this.goldRollTween.stop();
      this.goldRollTween = null;
    }
    if (!this.goldRollTween) this.displayGold = this.gold;
    this.goldText.setText(String(Math.floor(this.displayGold)));
    this.diamondText.setText(String(this.S.diamonds + this.diamondsRun));
    const cost = towerPrice(this.wave, this.waveBought);
    if (this.pendingTowerDraft) this.buyBtn.label.setText('点空位\n放 塔');
    else if (this.towerChoiceLayer) this.buyBtn.label.setText('选元素\n...');
    else this.buyBtn.label.setText(`造 塔\n💰 ${cost}`);
    const afford = !this.pendingTowerDraft && !this.towerChoiceLayer && this.gold >= cost && this.slots.some(s => !s.tower);
    this.buyBtn.bg.setFillStyle(afford ? 0x2e6b4f : 0x33384a);
    const giftLeft = 2 - this.adGifts;
    this.giftBtn.label.setText(giftLeft > 0 ? `📺 送高级塔\n(剩${giftLeft}次)` : '📺 已用完');
    this.giftBtn.setEnabled(giftLeft > 0);
  }

  // ================= 开局预置 =================
  presetTowers() {
    const elems = unlockedElements(this.S, this.wave);
    const elem = Phaser.Utils.Array.GetRandom(elems);
    const a = this.slots[6], b = this.slots[7]; // 下排相邻两格
    a.tower = new Tower(this, a, elem, 1);
    b.tower = new Tower(this, b, elem, 1);
    this.towers.push(a.tower, b.tower);
    if (this.S.runs === 0) {
      // 首局手势引导：拖到一起
      this.hint = this.uiText(W / 2, 545, '👆 拖动合成同色塔！', 30, '#ffe97a').setOrigin(0.5).setDepth(2000);
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
      const bosses = this.bossCountForWave(w);
      for (let i = 0; i < bosses; i++) {
        list.push({ type: 'boss', ...this.bossOptionsForWave(w, i) });
      }
      if (w >= 10) {
        const guards = Math.min(14, waveCount(w) - bosses);
        for (let i = 0; i < guards; i++) list.push(Math.random() < 0.4 ? 'slime' : 'runner');
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
    for (let i = 0; i < n; i++) {
      let r = Math.random() * total;
      for (const [k, wgt] of pool) { r -= wgt; if (r <= 0) { list.push(k); break; } }
      if (list.length <= i) list.push('slime');
    }
    this.markEliteWave(list, w);
    return list;
  }

  bossCountForWave(w) {
    if (w < 20) return 1;
    if (w === 20) return 2;
    if (w < 30) return 1;
    return 3 + Math.floor((w - 30) / 20);
  }

  bossOptionsForWave(w) {
    let affixes = [];
    if (w === 10) affixes = ['resilient'];
    else if (w === 15) affixes = ['armored'];
    else if (w === 20) affixes = ['twin'];
    else if (w === 25) affixes = ['rage'];
    else if (w === 30) affixes = [Phaser.Utils.Array.GetRandom(BOSS_AFFIX_KEYS)];
    else if (w > 30) {
      const count = w >= 45 && Math.random() < 0.5 ? 2 : 1;
      affixes = Phaser.Utils.Array.Shuffle(BOSS_AFFIX_KEYS.slice()).slice(0, count);
    }
    return this.bossOptionsFromAffixes(affixes);
  }

  bossOptionsFromAffixes(affixes) {
    const opts = { bossAffixes: affixes };
    for (const key of affixes) {
      const affix = BOSS_AFFIXES[key];
      if (!affix) continue;
      if (affix.controlResist != null) opts.controlResist = Math.max(opts.controlResist || 0, affix.controlResist);
      if (affix.armorBonus) opts.armorBonus = (opts.armorBonus || 0) + affix.armorBonus;
      if (affix.twinHealPct) opts.twinHealPct = Math.max(opts.twinHealPct || 0, affix.twinHealPct);
      if (affix.rageSpeedMult) {
        opts.rage = true;
        opts.rageSpeedMult = Math.max(opts.rageSpeedMult || 1, affix.rageSpeedMult);
        opts.rageSlowScale = Math.min(opts.rageSlowScale || 1, affix.rageSlowScale || 1);
      }
    }
    return opts;
  }

  markEliteWave(list, w) {
    if (w < ELITE.fromWave || w % 5 === 0 || !list.length) return;
    const chance = w >= ELITE.lateWave ? ELITE.lateChance : ELITE.chance;
    if (Math.random() >= chance) return;

    const idx = Phaser.Math.Between(0, list.length - 1);
    const affixKeys = Object.keys(ELITE.affixes);
    list[idx] = {
      type: list[idx],
      eliteAffix: Phaser.Utils.Array.GetRandom(affixKeys),
    };
  }

  startPrep() {
    if (this.over || this.dying) return;
    this.waveState = 'prep';
    this.pending = this.composeWave(this.wave);
    // 预告图标（去重）
    const icons = this.previewIcons(this.pending);
    this.previewText.setText(`下一波 ▶ ${icons}`);
    this.callBtn.setVisible(true);
    this.prepTimer = this.time.delayedCall(4000, () => this.startWave(false));
    this.updateUI();
  }

  startWave(early) {
    if (this.evolutionChoiceOpen) {
      this.prepTimer = this.time.delayedCall(300, () => this.startWave(early));
      return;
    }
    if (this.waveState !== 'prep' || this.over || this.dying) return;
    if (this.prepTimer) this.prepTimer.remove();
    this.waveGoldMult = early ? 1.1 : 1.0;
    this.holyHealThisWave = 0;
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
        const item = queue[i++];
        if (typeof item === 'string') {
          this.spawnEnemy(item);
        } else {
          const { type, ...opts } = item;
          if (opts.eliteAffix && !opts.hpMult) opts.hpMult = ELITE.hpMult;
          this.spawnEnemy(type, opts);
        }
        this.spawnLeft--;
      },
    });
  }

  previewIcons(list) {
    const icons = [];
    const seen = new Set();
    for (const item of list) {
      const type = typeof item === 'string' ? item : item.type;
      const eliteAffix = typeof item === 'string' ? null : item.eliteAffix;
      const bossAffixes = typeof item === 'string' ? [] : (item.bossAffixes || []);
      const affixIcon = bossAffixes.map(k => BOSS_AFFIXES[k]?.icon || '').join('');
      const icon = `${TYPE_ICON[type]}${eliteAffix ? ELITE_ICON[eliteAffix] : ''}${affixIcon}`;
      const key = eliteAffix || bossAffixes.length ? `${type}_${eliteAffix || ''}_${bossAffixes.join('_')}` : type;
      if (seen.has(key)) continue;
      seen.add(key);
      icons.push(icon);
    }
    return icons.join(' ');
  }

  spawnEnemy(typeKey, opts = {}) {
    const t = ENEMY_TYPES[typeKey];
    const path = t.flying ? this.flyPath : this.path;
    const spawnOpts = { ...opts };
    if (!t.boss) {
      spawnOpts.speedMult = (spawnOpts.speedMult || 1) * nonBossSpeedMult(this.wave);
      spawnOpts.speedCap = NON_BOSS_SPEED_CAP;
    }
    const e = new Enemy(this, typeKey, this.wave, path, spawnOpts);
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
    if (this.spawnLeft <= 0 && this.enemies.length === 0) {
      if (this.lastStandActive) {
        if (!this.lastStandLeaked) this.finishLastStand(true);
        return;
      }
      this.endWave();
    }
  }

  endWave() {
    this.waveState = 'idle';
    this.resonanceGoldMult = 1;
    this.waveBought = 0; // 波内价格热度重置
    this.holyHealThisWave = 0;
    // 利息（GDD §5.3：5%/档，单波上限 50×档）
    const it = tier(this.S, 'interest');
    if (it > 0) {
      const gain = Math.min(Math.floor(this.gold * 0.05 * it), 50 * it);
      if (gain > 0) { this.gold += gain; toast(this, 380, 200, `利息 +${gain}💰`, '#ffd34e', 24); }
    }
    const finished = this.wave;
    this.wave++;
    if (this.wave === 8) {
      this.banner('☠ 毒塔入池');
      toast(this, W / 2, 245, '新选择：毒塔克制铁盾', '#7ede55', 28);
    }
    // 里程碑钻石
    if (finished % 10 === 0) {
      this.diamondsRun += DIAMOND.milestone;
      toast(this, W / 2, 300, `里程碑! +${DIAMOND.milestone}💎`, '#9fe8ff', 32);
      Sfx.diamond();
    }
    // 阶段色调切换（GDD §2）
    const oldPh = phaseFor(finished), newPh = phaseFor(this.wave);
    if (oldPh !== newPh) {
      setAudioPhase(newPh, { accent: true });
      this.playPhaseShiftFx(newPh);
      this.banner(`${newPh.name}降临`);
      const speedMult = nonBossSpeedMult(this.wave);
      if (speedMult > 1) {
        toast(this, W / 2, 250, `小兵速度 +${Math.round((speedMult - 1) * 100)}%`, '#ffe97a', 28);
      }
      if (this.hasBg) {
        // 背景图模式：用叠色层做阶段氛围（白天透明，其余 0.22）
        this.phaseOverlay.setFillStyle(newPh.bg, this.phaseOverlay.fillAlpha);
        this.tweens.add({ targets: this.phaseOverlay, fillAlpha: newPh === PHASES[0] ? 0 : 0.22, duration: 1200 });
      } else {
        this.tintTo(this.bgAll, oldPh.bg, newPh.bg);
        this.tintTo(this.ground, oldPh.ground, newPh.ground);
      }
    }
    this.updateUI();
    this.startPrep();
  }

  playPhaseShiftFx(ph) {
    const tint = ph.bg || 0xffffff;
    const wash = this.add.rectangle(W / 2, H / 2, W, H, tint, 0.2).setDepth(2240);
    this.tweens.add({
      targets: wash,
      alpha: 0,
      duration: 760,
      ease: 'Quad.Out',
      onComplete: () => wash.destroy(),
    });

    const sweep = this.add.rectangle(-90, H / 2, 120, H * 1.45, 0xffffff, 0.16)
      .setAngle(-14)
      .setDepth(2241);
    this.tweens.add({
      targets: sweep,
      x: W + 110,
      alpha: 0,
      duration: 680,
      ease: 'Cubic.Out',
      onComplete: () => sweep.destroy(),
    });
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
    const g = Math.max(1, Math.round(waveHp(e.spawnWave) * 0.1 * e.type.goldMult * e.rewardGoldMult * e.killGoldMult * this.waveGoldMult * this.resonanceGoldMult));
    this.gold += g;
    this.rollGoldTo(this.gold);
    this.burst(e.x, e.y, e.type.color, e.boss ? 40 : 12, e.boss ? 1.6 : 1);
    this.coinFly(e.x, e.y, g);
    const now = this.time.now;
    if (now - this.lastKillSfx > 90) { Sfx.kill(); this.lastKillSfx = now; }

    if (e.boss) {
      const rewardDiamonds = DIAMOND.boss;
      this.diamondsRun += rewardDiamonds;
      toast(this, e.x, e.y - 72, `+${rewardDiamonds}💎`, '#9fe8ff', 38);
      this.playBossDeathFx(e.x, e.y, e.type.color, rewardDiamonds);
      Sfx.bossDie();
      this.cameras.main.shake(520, 0.018);
      this.slowmoT = Math.max(this.slowmoT, 0.36);
      this.applyTwinBossHeal(e);
    }
    if (e.elite) {
      this.diamondsRun += DIAMOND.elite;
      toast(this, e.x, e.y - 78, `精英 +${DIAMOND.elite}💎`, '#9fe8ff', 28);
      Sfx.diamond();
      this.burst(e.x, e.y, ELITE.affixes[e.eliteAffix].color, 24, 1.2);
    }
    // 分裂怪（GDD §4.2）
    if (e.type.splits && !this.dying) {
      this.spawnEnemy('mini', { progress: Math.max(0, e.progress - 18) });
      this.spawnEnemy('mini', { progress: e.progress + 18 });
      this.spawnLeft += 0; // 计数不变，enemies 数组已含
    }
    if (e.eliteAffix === 'split' && !this.dying) {
      for (let i = 0; i < 4; i++) {
        this.spawnEnemy('mini', { progress: e.progress + Phaser.Math.Between(-28, 28) });
      }
    }
    // 瘟疫分支尸爆传染（GDD §3.5 v1.19：中毒状态下死亡即触发，不限死因——主C抢人头也算瘟疫的）
    if (e.poisons.some(p => p.t > 0 && p.plague)) {
      const src = e.poisons.find(p => p.t > 0 && p.plague);
      const radius = src.plagueRadius || 95;
      const infected = [];
      for (const o of this.enemies) {
        if (!o.dead && Phaser.Math.Distance.Between(e.x, e.y, o.x, o.y) < radius) {
          infected.push({ x: o.x, y: o.y });
          o.applyPoison(src.dps, 2, false);
          o.killGoldMult = Math.max(o.killGoldMult || 1, src.goldMult || 1);
        }
      }
      this.playPlagueBurstFx(e.x, e.y, radius, infected);
    }
    e.destroy();
    this.updateUI();
    this.checkWaveClear();
  }

  applyTwinBossHeal(deadBoss) {
    if (!deadBoss.twinHealPct) return;
    const targets = this.enemies
      .filter(e => e.boss && !e.dead && e.spawnWave === deadBoss.spawnWave)
      .sort((a, b) => (a.hp / a.maxHp) - (b.hp / b.maxHp));
    const target = targets[0];
    if (!target) return;
    const healed = target.heal(target.maxHp * deadBoss.twinHealPct);
    if (healed <= 0) return;
    toast(this, target.x, target.y - 78, `双生 +${Math.round(healed)}`, '#ffb199', 26);
    this.burst(target.x, target.y, 0xe84a5f, 18, 1);
  }

  onBossRage(e) {
    toast(this, e.x, e.y - 84, '狂怒!', '#ff9b45', 30);
    this.burst(e.x, e.y, 0xff9b45, 24, 1.25);
    this.cameras.main.shake(180, 0.005);
  }

  onEnemyLeak(e) {
    const leakedType = e.typeKey;
    e.dead = true;
    this.enemies = this.enemies.filter(x => x !== e);
    e.destroy();
    if (this.over || this.dying) return;
    this.leakStats[leakedType] = (this.leakStats[leakedType] || 0) + 1;
    if (this.lastStandActive) this.lastStandLeaked = true;
    this.baseHp -= e.boss ? LEAK_BOSS : LEAK_NORMAL;
    Sfx.leak();
    this.vignette.setAlpha(0.28);
    this.tweens.add({ targets: this.vignette, alpha: 0, duration: 400 });
    this.cameras.main.shake(150, 0.006);
    this.updateUI();
    if (this.baseHp <= 0) {
      if (!this.lastStandActive) this.baseDestroyed();
    }
    else this.checkWaveClear();
  }

  // ================= 买塔 / 合成 / 卖塔 =================
  smartRandomElem(spawnLv) {
    const unlocked = unlockedElements(this.S, this.wave);
    // 自动/奖励生成用：偏向可立即配对的元素，手动买塔走三选一。
    const pairable = [...new Set(this.towers.filter(t => t.lv === spawnLv).map(t => t.elem))]
      .filter(e => unlocked.includes(e));
    if (pairable.length && Math.random() < 0.6) return Phaser.Utils.Array.GetRandom(pairable);
    return Phaser.Utils.Array.GetRandom(unlocked);
  }

  rollSpawnLv() {
    let lv = spawnFloor(this.wave);
    if (Math.random() < 0.05 * tier(this.S, 'startLv')) lv = Math.min(MAX_LV, lv + 1);
    return lv;
  }

  buildTowerChoices(spawnLv) {
    const unlocked = unlockedElements(this.S, this.wave);
    const choiceCount = spawnLv >= 4 ? 5 : 3;
    const choices = [];
    const add = (elem, branch = null) => {
      if (!elem || !unlocked.includes(elem)) return;
      const resolvedBranch = spawnLv >= 4 ? (branch || this.randomBranch(elem)) : null;
      if (choices.some(choice => choice.elem === elem && choice.branch === resolvedBranch)) return;
      choices.push({ elem, branch: resolvedBranch });
    };

    const counts = {};
    for (const t of this.towers) {
      if (t.lv === spawnLv && unlocked.includes(t.elem)) counts[t.elem] = (counts[t.elem] || 0) + 1;
    }
    const pairables = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    for (const [elem] of pairables) {
      if (choices.length >= 2) break;
      add(elem);
    }

    if (this.wave >= 8) add('poison');
    add('lightning');

    const shuffled = Phaser.Utils.Array.Shuffle(unlocked.slice());
    for (const elem of shuffled) {
      if (choices.length >= choiceCount) break;
      add(elem);
    }

    // Lv4+ 的卡片包含分支；元素不足 5 种时，用同元素的另一分支补足，仍保证五张卡不重复。
    if (spawnLv >= 4 && choices.length < choiceCount) {
      const branchChoices = Phaser.Utils.Array.Shuffle(unlocked.flatMap(elem =>
        Object.keys(TOWER_BRANCHES[elem] || {}).map(branch => ({ elem, branch }))
      ));
      for (const choice of branchChoices) {
        if (choices.length >= choiceCount) break;
        add(choice.elem, choice.branch);
      }
    }
    return choices.slice(0, choiceCount);
  }

  randomBranch(elem) {
    const keys = Object.keys(TOWER_BRANCHES[elem] || {});
    return Phaser.Utils.Array.GetRandom(keys);
  }

  buyTower(silent) {
    if (silent) return this.buyTowerSilently();
    if (this.evolutionChoiceOpen || this.towerChoiceLayer || this.pendingTowerDraft) return false;
    const cost = towerPrice(this.wave, this.waveBought);
    if (this.gold < cost) { if (!silent) toast(this, this.buyBtn.x, this.buyBtn.y - 135, '金币不足', '#ff8888', 24); return false; }
    const free = this.slots.filter(s => !s.tower);
    if (!free.length) { if (!silent) toast(this, this.buyBtn.x, this.buyBtn.y - 135, '塔位已满，先合成!', '#ff8888', 24); return false; }
    const lv = this.rollSpawnLv();
    const choices = this.buildTowerChoices(lv);
    this.showTowerChoices(lv, cost, choices);
    this.updateUI();
    return true;
  }

  buyTowerSilently() {
    if (this.evolutionChoiceOpen || this.towerChoiceLayer || this.pendingTowerDraft) return false;
    const cost = towerPrice(this.wave, this.waveBought);
    if (this.gold < cost) return false;
    const free = this.slots.filter(s => !s.tower);
    if (!free.length) return false;
    this.gold -= cost;
    this.bought++;
    this.waveBought++;
    const lv = this.rollSpawnLv();
    const elem = this.smartRandomElem(lv);
    const branch = lv >= 4 ? this.randomBranch(elem) : null;
    const slot = Phaser.Utils.Array.GetRandom(free);
    this.placeTower(slot, elem, lv, branch);
    Sfx.buy();
    this.updateUI();
    return true;
  }

  showTowerChoices(lv, cost, choices) {
    this.clearTowerChoiceLayer();
    this.ensureResponsiveLayout();
    const wide = this.layout.landscape;
    const sideCenterScreen = this.layout.fieldAreaW + this.layout.sidebarW / 2;
    const centerX = wide ? this.layout.x(sideCenterScreen) : W / 2;
    const expanded = choices.length > 3;
    const panelY = wide ? (expanded ? 382 : 350) : (expanded ? 990 : 1010);
    const panelW = wide ? this.layout.sidebarW - 46 : 650;
    const panelH = wide ? (expanded ? 370 : 286) : (expanded ? 465 : 160);
    const titleY = wide ? 214 : (expanded ? 785 : 940);
    const cancelX = wide ? this.layout.x(this.layout.fieldAreaW + this.layout.sidebarW - 66) : 650;
    const cancelY = titleY;

    const layer = this.add.container(0, 0).setDepth(2450);
    this.towerChoiceLayer = layer;

    const blocker = this.add.rectangle(
      wide ? this.layout.x(this.layout.viewW / 2) : W / 2,
      wide ? this.layout.viewH / 2 : H / 2,
      wide ? this.layout.viewW : W,
      wide ? this.layout.viewH : H,
      0x000000,
      0.001,
    )
      .setInteractive();
    const panel = this.add.rectangle(centerX, panelY, panelW, panelH, 0x171b29, 0.94)
      .setStrokeStyle(2, 0x4a5578);
    const title = this.uiText(centerX, titleY, `选择新塔（${choices.length}选1）  Lv${lv}  💰${cost}`, wide ? 22 : 24, '#ffe97a')
      .setOrigin(0.5);
    const cancel = makeButton(this, cancelX, cancelY, 82, 42, '取消', {
      bg: 0x51586e,
      fontSize: 18,
      onClick: () => this.cancelTowerPurchase(),
    });
    layer.add([blocker, panel, title, cancel]);

    const portraitPositions = expanded
      ? choices.map((_, i) => ({ x: W / 2, y: 845 + i * 72 }))
      : (choices.length === 2
          ? [{ x: 260, y: 1020 }, { x: 460, y: 1020 }]
          : [{ x: 160, y: 1020 }, { x: 360, y: 1020 }, { x: 560, y: 1020 }]);
    choices.forEach((choice, i) => {
      const { elem, branch } = choice;
      const def = ELEMENTS[elem];
      // Lv4+ 的分支在发牌时已经摇定并印在卡面上（规则透明，玩家点卡前可见血统）
      const bdef = branch ? TOWER_BRANCHES[elem][branch] : null;
      const x = wide ? centerX : portraitPositions[i].x;
      const y = wide ? (expanded ? 266 + i * 66 : 288 + i * 78) : portraitPositions[i].y;
      const card = this.add.container(x, y);
      const listCard = wide || expanded;
      const cardW = wide ? panelW - 54 : (expanded ? panelW - 80 : 178);
      const cardH = listCard ? 64 : 96;
      const iconX = listCard ? -cardW / 2 + 36 : -56;
      const textX = listCard ? -cardW / 2 + 76 : -18;
      const bg = this.add.rectangle(0, 0, cardW, cardH, 0x23283a, 1)
        .setStrokeStyle(3, def.color, 0.9);
      const glow = this.add.image(iconX, listCard ? 0 : -18, 'glow').setTint(def.color).setAlpha(0.34).setScale(listCard ? 0.6 : 0.72);
      const icon = fitTowerImageHeight(
        addTowerImage(this, iconX, listCard ? 4 : -12, elem, lv, branch),
        listCard ? 54 : 68,
      );
      const name = this.uiText(textX, listCard ? -16 : -22,
        bdef ? `${def.cn}·${bdef.cn}` : def.cn, listCard ? 24 : 28, this.hexColor(def.color)).setOrigin(0, 0.5);
      const desc = this.uiText(textX, listCard ? 17 : 20,
        bdef ? bdef.desc : def.desc, listCard ? 16 : 18, '#c9d2f0').setOrigin(0, 0.5);
      if (bdef) desc.setWordWrapWidth(listCard ? cardW - 92 : 130);
      card.add([bg, glow, icon, name, desc]);
      card.setSize(cardW, cardH).setInteractive({ useHandCursor: true });
      card.on('pointerover', () => bg.setFillStyle(0x30364d));
      card.on('pointerout', () => bg.setFillStyle(0x23283a));
      card.on('pointerdown', () => this.beginTowerPlacement(elem, lv, cost, branch));
      layer.add(card);
    });
  }

  beginTowerPlacement(elem, lv, cost, branch = null) {
    this.clearTowerChoiceLayer();
    this.ensureResponsiveLayout();
    if (lv >= 4 && !branch) branch = this.randomBranch(elem);
    this.pendingTowerDraft = { elem, lv, branch, cost };
    const hintX = this.layout.landscape ? this.layout.x(this.layout.fieldCenterScreen) : W / 2;
    const hintY = this.layout.landscape ? Math.min(1120, this.layout.viewH - 150) : 905;
    this.placementHint = this.uiText(hintX, hintY, `点一个空塔位放置 ${ELEMENTS[elem].cn} Lv${lv}`, 26, this.hexColor(ELEMENTS[elem].color))
      .setOrigin(0.5)
      .setDepth(2450);
    this.placementHint.setStroke('#000000', 5);
    this.showFreeSlots(true);
    this.updateUI();
  }

  cancelTowerPurchase() {
    this.clearTowerChoiceLayer();
    this.clearPendingTowerDraft();
    this.updateUI();
  }

  clearTowerChoiceLayer() {
    if (!this.towerChoiceLayer) return;
    this.towerChoiceLayer.destroy();
    this.towerChoiceLayer = null;
  }

  clearPendingTowerDraft() {
    this.pendingTowerDraft = null;
    if (this.placementHint) {
      this.placementHint.destroy();
      this.placementHint = null;
    }
    this.showFreeSlots(false);
  }

  tryPlacePendingTower(pointer) {
    if (!this.pendingTowerDraft || this.over || this.dying || this.evolutionChoiceOpen) return false;
    const px = pointer.worldX ?? pointer.x;
    const py = pointer.worldY ?? pointer.y;
    let nearest = null, nd = 58;
    for (const s of this.slots) {
      if (s.tower) continue;
      const d = Phaser.Math.Distance.Between(px, py, s.x, s.y);
      if (d < nd) { nd = d; nearest = s; }
    }
    if (!nearest) return false;

    const draft = this.pendingTowerDraft;
    if (this.gold < draft.cost) {
      toast(this, this.buyBtn.x, this.buyBtn.y - 135, '金币不足', '#ff8888', 24);
      this.cancelTowerPurchase();
      return true;
    }
    this.gold -= draft.cost;
    this.bought++;
    this.waveBought++;
    this.placeTower(nearest, draft.elem, draft.lv, draft.branch);
    Sfx.buy();
    this.clearPendingTowerDraft();
    this.clearHint();
    this.updateUI();
    return true;
  }

  placeTower(slot, elem, lv, branch = null, opts = {}) {
    const t = new Tower(this, slot, elem, lv, branch);
    slot.tower = t;
    this.towers.push(t);
    if (opts.animate !== false) {
      t.c.setScale(0);
      this.tweens.add({ targets: t.c, scale: 1, duration: 240, ease: 'Back.Out' });
      this.burst(slot.x, slot.y - 20, ELEMENTS[elem].color, 8, 0.7);
    } else {
      t.c.setScale(opts.scale ?? 1);
    }
    if (lv > this.highestLv) this.highestLv = lv;
    return t;
  }

  doMerge(a, b, opts = {}) {
    if (a.merging || b.merging) return;
    // b 的位置保留，产出 lv+1
    const slot = b.slot, elem = a.elem, lv = a.lv + 1;
    const branch = this.mergeBranchFor(a, b, lv, opts);
    const pop = () => {
      a.destroy(); b.destroy();
      const t = this.placeTower(slot, elem, lv, branch, { animate: false, scale: 0.22 });
      t.c.setAlpha(0.85);
      const resonance = this.registerMergeResonance(t, !!opts.auto);
      this.playMergePop(t, resonance, !!opts.auto);
      this.clearHint();
      // 里程碑质变提示（GDD §3.3）
      if (lv === 4 || lv === 7) toast(this, slot.x, slot.y - 90, '⭐ 里程碑质变!', '#ffe97a', 26);
      if (lv === 4 && !opts.auto) this.showEvolutionChoice(t);
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
    };

    a.merging = true;
    b.merging = true;
    a.dragging = false;
    b.dragging = false;
    a.c.disableInteractive();
    b.c.disableInteractive();
    a.slot.tower = null; slot.tower = null;
    this.towers = this.towers.filter(t => t !== a && t !== b);

    this.playMergeAbsorb(a, b, slot, elem, pop);
    this.updateUI();
  }

  playMergeAbsorb(a, b, slot, elem, onComplete) {
    const tx = slot.x;
    const ty = slot.y - 8;
    const color = ELEMENTS[elem].color;
    this.tweens.killTweensOf([a.c, b.c, a.spr, b.spr]);
    a.c.setDepth(2700);
    b.c.setDepth(2701);

    const pullGlow = this.add.image(tx, ty - 18, 'glow')
      .setTint(color)
      .setAlpha(0.25)
      .setScale(0.35)
      .setDepth(2698);
    this.tweens.add({
      targets: pullGlow,
      scale: 1.05,
      alpha: 0,
      duration: 170,
      ease: 'Cubic.Out',
      onComplete: () => pullGlow.destroy(),
    });

    this.tweens.add({
      targets: [a.c, b.c],
      x: tx,
      y: ty,
      scaleX: 1.16,
      scaleY: 0.72,
      angle: 0,
      duration: 115,
      ease: 'Quad.In',
      onComplete,
    });
  }

  playMergePop(t, resonance, auto) {
    const color = t.color;
    const x = t.slot.x;
    const y = t.slot.y - 24;
    // —— 合成爆点（GDD §6.1）——
    t.c.setDepth(t.slot.y + 220);
    this.mergeBurst(x, y, color, t.lv);
    Sfx.merge(t.lv, resonance.chain);
    this.tweens.add({
      targets: t.c,
      scaleX: 1.46,
      scaleY: 1.46,
      alpha: 1,
      duration: 105,
      ease: 'Back.Out',
      onComplete: () => {
        this.tweens.add({
          targets: t.c,
          scaleX: 0.92,
          scaleY: 1.08,
          duration: 70,
          ease: 'Quad.InOut',
          yoyo: true,
          onComplete: () => {
            t.c.setDepth(t.slot.y);
            this.tweens.add({ targets: t.c, scaleX: 1, scaleY: 1, duration: 95, ease: 'Back.Out' });
          },
        });
      },
    });
    this.triggerMergeSurge(t, resonance.multiplier, resonance.chain, auto);
  }

  mergeBranchFor(a, b, lv, opts = {}) {
    if (lv < 4) return null;
    if (lv === 4) return opts.auto ? 'a' : null;
    return b.branch || a.branch || 'a';
  }

  showEvolutionChoice(t) {
    if (this.evolutionLayer) this.evolutionLayer.destroy();
    this.evolutionChoiceOpen = true;
    this.slowmoT = Math.max(this.slowmoT, 0.5);
    this.evolutionPrevTimeScale = this.time.timeScale;
    this.evolutionPrevTweenScale = this.tweens.timeScale;
    this.time.timeScale = this.speedMult * 0.5;
    this.tweens.timeScale = this.speedMult * 0.5;

    const defs = TOWER_BRANCHES[t.elem];
    const layer = this.add.container(0, 0).setDepth(4100);
    this.evolutionLayer = layer;
    layer.add(this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.68).setInteractive());

    const title = this.uiText(W / 2, 420, `${ELEMENTS[t.elem].cn} Lv4 进化`, 42, '#ffffff').setOrigin(0.5);
    title.setStroke('#000000', 8);
    layer.add(title);

    const choose = branch => {
      if (!this.evolutionChoiceOpen) return;
      t.setBranch(branch);
      this.resumeEvolutionChoice();
      this.evolutionChoiceOpen = false;
      this.evolutionLayer = null;
      layer.destroy();
      const def = defs[branch];
      toast(this, t.slot.x, t.slot.y - 110, `${def.cn} 分支`, this.hexColor(t.color), 28);
      this.burst(t.slot.x, t.slot.y - 26, t.color, 18, 1.1);
    };

    const addCard = (x, branch) => {
      const def = defs[branch];
      const card = this.add.rectangle(x, 615, 270, 270, 0x1e2233, 0.96)
        .setStrokeStyle(3, t.color, 0.92)
        .setInteractive({ useHandCursor: true });
      const icon = fitTowerImageHeight(addTowerImage(this, x, 520, t.elem, t.lv, branch), 112).setDepth(4101);
      const badge = this.add.circle(x - 100, 500, 21, t.color, 0.36).setStrokeStyle(2, t.color, 0.95);
      const short = this.uiText(x - 100, 500, def.short, 20, '#ffffff').setOrigin(0.5);
      const name = this.uiText(x, 590, def.cn, 30, '#ffe97a').setOrigin(0.5);
      const desc = this.add.text(x, 645, def.desc, {
        fontFamily: 'Arial, "Microsoft YaHei", sans-serif',
        fontSize: '22px',
        color: '#dce5ff',
        fontStyle: 'bold',
        align: 'center',
        wordWrap: { width: 220 },
      }).setOrigin(0.5).setDepth(4101);
      const pick = this.uiText(x, 725, '选择', 24, '#ffffff').setOrigin(0.5);
      pick.setStroke('#000000', 5);

      card.on('pointerdown', () => choose(branch));
      card.on('pointerover', () => card.setFillStyle(0x2b3150, 1));
      card.on('pointerout', () => card.setFillStyle(0x1e2233, 0.96));
      for (const obj of [card, icon, badge, short, name, desc, pick]) layer.add(obj);
    };

    addCard(215, 'a');
    addCard(505, 'b');
  }

  resumeEvolutionChoice() {
    this.time.timeScale = this.evolutionPrevTimeScale ?? this.speedMult;
    this.tweens.timeScale = this.evolutionPrevTweenScale ?? this.speedMult;
    this.evolutionPrevTimeScale = null;
    this.evolutionPrevTweenScale = null;
  }

  registerMergeResonance(t, auto) {
    if (auto) {
      return { chain: 1, multiplier: MERGE_SURGE.autoMultiplier };
    }

    const now = this.time.now;
    this.resonanceStacks = now <= this.resonanceDeadline ? this.resonanceStacks + 1 : 1;
    this.resonanceDeadline = now + MERGE_SURGE.resonanceWindow * 1000;

    const chain = this.resonanceStacks;
    const multiplier = Math.min(
      MERGE_SURGE.resonanceCap,
      1 + MERGE_SURGE.resonanceStep * (chain - 1),
    );

    this.showResonanceWindow(t);
    if (chain > 1) this.comboPop(t, chain);
    this.applyResonanceMilestone(t, chain);
    return { chain, multiplier };
  }

  showResonanceWindow(t) {
    if (this.resonanceRing) this.resonanceRing.destroy();
    const ring = this.add.circle(t.slot.x, t.slot.y - 8, 58, t.color, 0.04)
      .setStrokeStyle(4, t.color, 0.9)
      .setDepth(2240);
    this.resonanceRing = ring;
    this.tweens.add({
      targets: ring,
      scale: 0.66,
      alpha: 0,
      duration: MERGE_SURGE.resonanceWindow * 1000,
      ease: 'Linear',
      onComplete: () => {
        if (this.resonanceRing === ring) this.resonanceRing = null;
        ring.destroy();
      },
    });
  }

  comboPop(t, chain) {
    const txt = this.uiText(t.slot.x + 38, t.slot.y - 94, `×${chain}`, 34, this.hexColor(t.color))
      .setOrigin(0.5)
      .setDepth(2600)
      .setScale(0.55);
    txt.setStroke('#000000', 7);
    this.tweens.add({
      targets: txt,
      y: txt.y - 42,
      scale: 1 + Math.min(chain, 7) * 0.06,
      alpha: 0,
      duration: 760,
      ease: 'Back.Out',
      onComplete: () => txt.destroy(),
    });
  }

  applyResonanceMilestone(t, chain) {
    if (chain >= 3) this.screenGlow(t.color, chain >= 5 ? 0.18 : 0.12);
    if (chain === 3) {
      this.banner('连锁共鸣!');
      this.applyGlobalResonanceSlow(t.color);
      Sfx.resonance(chain);
    } else if (chain === 5) {
      this.banner('共鸣馈赠!');
      this.grantResonanceTower(t);
      this.cameras.main.shake(180, 0.004);
      Sfx.resonance(chain);
    } else if (chain === 7) {
      this.resonanceGoldMult = Math.max(this.resonanceGoldMult, 2);
      this.banner('金币共鸣 ×2');
      toast(this, t.slot.x, t.slot.y - 120, '本波金币 ×2', '#ffd34e', 28);
      Sfx.resonance(chain);
    }
  }

  applyGlobalResonanceSlow(color) {
    for (const e of this.enemies) {
      if (e.dead) continue;
      e.applySlow(MERGE_SURGE.resonanceSlowPct, MERGE_SURGE.resonanceSlowDuration, MERGE_SURGE.resonanceSlowPct);
      this.burst(e.x, e.y, color, 4, 0.35);
    }
  }

  grantResonanceTower(src) {
    const free = this.slots.filter(s => !s.tower);
    if (!free.length) {
      toast(this, src.slot.x, src.slot.y - 120, '塔位已满', '#ff8888', 24);
      return;
    }

    const lv = spawnFloor(this.wave);
    const slot = Phaser.Utils.Array.GetRandom(free);
    const elem = this.smartRandomElem(lv);
    const branch = lv >= 4 ? this.randomBranch(elem) : null;
    const t = this.placeTower(slot, elem, lv, branch);
    t.c.setPosition(src.slot.x, src.slot.y - 88);
    t.c.setDepth(2650);
    this.tweens.add({
      targets: t.c,
      x: slot.x,
      y: slot.y - 8,
      duration: 520,
      ease: 'Cubic.Out',
      onComplete: () => t.moveTo(slot),
    });
    Sfx.buy();
  }

  triggerMergeSurge(t, multiplier, chain, auto) {
    const x = t.slot.x, y = t.slot.y - 8;
    const ring = this.add.circle(x, y, 74, t.color, auto ? 0.04 : 0.08)
      .setStrokeStyle(auto ? 3 : 5, t.color, auto ? 0.38 : 0.72)
      .setScale(0.18)
      .setDepth(2140);
    this.tweens.add({
      targets: ring,
      scale: Math.max(1.4, t.range / 74),
      alpha: 0,
      duration: 480,
      ease: 'Cubic.Out',
      onComplete: () => ring.destroy(),
    });
    this.burst(x, y - 18, t.color, auto ? 10 : 24, auto ? 0.8 : 1.2);
    Sfx.surge();

    if (t.elem === 'fire') this.surgeFire(t, multiplier);
    else if (t.elem === 'ice') this.surgeIce(t, multiplier);
    else if (t.elem === 'lightning') this.surgeLightning(t, multiplier);
    else if (t.elem === 'poison') this.surgePoison(t, multiplier);
    else if (t.elem === 'light') this.surgeLight(t, multiplier);
  }

  surgeFire(t, multiplier) {
    const pts = this.pathSamplesNear(this.path, t.slot.x, t.slot.y, t.range, 46)
      .sort((a, b) => a.progress - b.progress);
    const dps = t.dmg * 0.5 * multiplier;
    const targets = pts.length ? pts : [{ x: t.slot.x, y: t.slot.y, progress: 0 }];
    const visible = new Set();
    const visibleN = Math.min(3, targets.length);
    for (let i = 0; i < visibleN; i++) {
      visible.add(visibleN === 1 ? 0 : Math.round(i * (targets.length - 1) / (visibleN - 1)));
    }

    this.playMergeFireTrailFx(targets, t.color);
    targets.forEach((p, i) => {
      this.time.delayedCall(i * 22, () => {
        if (this.over) return;
        const showVisual = visible.has(i);
        this.addBurnZone(p.x, p.y, dps, {
          duration: MERGE_SURGE.fireDuration,
          radius: MERGE_SURGE.fireRadius,
          color: t.color,
          visual: false,
          goldMult: t.goldMult,
        });
        if (showVisual) {
          this.playFireBurstFx(p.x, p.y, MERGE_SURGE.fireRadius * 1.15, t.color);
          this.burst(p.x, p.y, t.color, 6, 0.42);
        }
      });
    });
  }

  playMergeFireTrailFx(points, color) {
    if (points.length < 2) return;
    const vectors = points.map(p => new Phaser.Math.Vector2(p.x, p.y));
    const g = this.add.graphics().setDepth(2070);
    g.lineStyle(14, 0x5f1708, 0.16);
    g.strokePoints(vectors, false);
    g.lineStyle(7, color, 0.26);
    g.strokePoints(vectors, false);
    g.lineStyle(3, 0xfff1a8, 0.54);
    g.strokePoints(vectors, false);
    this.tweens.add({
      targets: g,
      alpha: 0,
      duration: 620,
      ease: 'Cubic.Out',
      onComplete: () => g.destroy(),
    });
  }

  surgeIce(t, multiplier) {
    const ground = this.enemies.filter(e => !e.dead && !e.flying);
    const center = ground.length ? Math.max(...ground.map(e => e.progress)) : this.path.total * 0.65;
    const span = 180 + t.lv * 18;
    const duration = (1 + 0.2 * t.lv) * multiplier;
    const pts = [];

    for (let d = Math.max(0, center - span); d <= Math.min(this.path.total, center + span); d += 42) {
      pts.push(this.path.pointAt(d));
    }

    if (pts.length > 1) {
      const g = this.add.graphics().setDepth(2130);
      g.lineStyle(14, t.color, 0.28);
      g.strokePoints(pts.map(p => new Phaser.Math.Vector2(p.x, p.y)), false);
      g.lineStyle(4, 0xffffff, 0.52);
      g.strokePoints(pts.map(p => new Phaser.Math.Vector2(p.x, p.y)), false);
      this.tweens.add({ targets: g, alpha: 0, duration: 560, onComplete: () => g.destroy() });
    }

    for (const e of ground) {
      if (Math.abs(e.progress - center) > span) continue;
      if (e.applyFreeze(duration)) this.showDmg(e.x, e.y - 42, '冻结', '#bfe8ff');
    }
    Sfx.freeze();
  }

  surgeLightning(t, multiplier) {
    const targets = this.enemies
      .filter(e => !e.dead)
      .sort((a, b) => b.progress - a.progress)
      .slice(0, 3 + t.lv);
    if (!targets.length) return;

    const g = this.add.graphics().setDepth(2140);
    g.lineStyle(4, 0xfff2a8, 0.96);
    let px = t.slot.x, py = t.slot.y - 58;
    for (const e of targets) {
      this.zigzag(g, px, py, e.x, e.y - 10);
      px = e.x; py = e.y - 10;
    }
    this.tweens.add({ targets: g, alpha: 0, duration: 220, onComplete: () => g.destroy() });

    for (const e of targets) {
      if (e.dead) continue;
      const real = e.takeDamage(t.dmg * 1.5 * multiplier, { cause: 'surge', sourceTower: t });
      this.showDmg(e.x, e.y - 44, real, '#fff2a8');
      this.burst(e.x, e.y, t.color, 7, 0.6);
    }
    Sfx.hit();
  }

  surgePoison(t, multiplier) {
    const x = t.slot.x, y = t.slot.y;
    const cloud = this.add.image(x, y, 'glow')
      .setTint(t.color)
      .setAlpha(0.5)
      .setScale(MERGE_SURGE.poisonRadius / 30)
      .setDepth(2120);
    this.tweens.add({
      targets: cloud,
      scale: MERGE_SURGE.poisonRadius / 24,
      alpha: 0,
      duration: 850,
      ease: 'Cubic.Out',
      onComplete: () => cloud.destroy(),
    });

    for (const e of this.enemies) {
      if (e.dead) continue;
      const d = Phaser.Math.Distance.Between(x, y, e.x, e.y);
      if (d > MERGE_SURGE.poisonRadius + this.enemySize(e) * 0.5) continue;
      const aliveStacks = e.poisons.filter(p => p.t > 0).length;
      e.applyPoison(t.dmg * multiplier, aliveStacks + 1, false, t, { branchEffects: false });
      this.showDmg(e.x, e.y - 42, '☠', '#9ef07a');
    }
  }

  surgeLight(t, multiplier) {
    const count = Phaser.Math.Clamp(Math.floor(multiplier), 1, 3);
    const targets = this.enemies
      .filter(e => !e.dead && !e.boss)
      .sort((a, b) => (a.hp / a.maxHp) - (b.hp / b.maxHp))
      .slice(0, count);

    if (targets.length) {
      targets.forEach((e, i) => {
        this.time.delayedCall(i * 70, () => {
          if (e.dead) return;
          this.lightBeam(t.slot.x, t.slot.y - 70, e.x, e.y - 10);
          this.showDmg(e.x, e.y - 54, '处决!', '#fff8dc');
          this.playExecuteFx(t, e.x, e.y);
          e.takeDamage(e.hp + 1, { trueDmg: true, cause: 'execute', sourceTower: t });
        });
      });
      Sfx.execute();
      return;
    }

    const heal = Math.min(this.maxBase - this.baseHp, count);
    if (heal > 0) {
      this.baseHp += heal;
      toast(this, 560, 940, `+${heal}❤`, '#fff8dc', 30);
      this.updateUI();
    } else {
      toast(this, t.slot.x, t.slot.y - 110, '圣光守护', '#fff8dc', 24);
    }
    this.screenGlow(t.color, 0.12);
  }

  lightBeam(x1, y1, x2, y2) {
    const g = this.add.graphics().setDepth(2140);
    g.lineStyle(18, 0xfff8dc, 0.2);
    g.lineBetween(x1, y1, x2, y2);
    g.lineStyle(8, 0xfff8dc, 0.82);
    g.lineBetween(x1, y1, x2, y2);
    g.lineStyle(3, 0xffffff, 0.92);
    g.lineBetween(x1, y1, x2, y2);
    this.tweens.add({ targets: g, alpha: 0, duration: 240, ease: 'Quad.Out', onComplete: () => g.destroy() });

    const end = this.add.image(x2, y2, 'glow')
      .setTint(0xfff8dc)
      .setAlpha(0.46)
      .setScale(0.42)
      .setDepth(2141);
    this.tweens.add({
      targets: end,
      scale: 0.95,
      alpha: 0,
      duration: 240,
      ease: 'Cubic.Out',
      onComplete: () => end.destroy(),
    });
  }

  pathSamplesNear(path, x, y, radius, step) {
    const pts = [];
    for (let d = 0; d <= path.total; d += step) {
      const p = path.pointAt(d);
      if (Phaser.Math.Distance.Between(x, y, p.x, p.y) <= radius) pts.push({ ...p, progress: d });
    }
    return pts;
  }

  screenGlow(color, alpha) {
    this.ensureResponsiveLayout();
    const glow = this.add.rectangle(
      this.layout.x(this.layout.viewW / 2),
      this.layout.viewH / 2,
      this.layout.viewW,
      this.layout.viewH,
      color,
      alpha,
    ).setDepth(2940);
    this.tweens.add({ targets: glow, alpha: 0, duration: 520, onComplete: () => glow.destroy() });
  }

  hexColor(color) {
    return '#' + color.toString(16).padStart(6, '0');
  }

  sellTower(t) {
    const refund = Math.round(towerBasePrice(this.wave) * 0.5);
    this.gold += refund;
    t.slot.tower = null;
    this.towers = this.towers.filter(x => x !== t);
    this.burst(t.slot.x, t.slot.y - 20, 0xff9aa8, 10, 0.8);
    t.destroy();
    Sfx.sell();
    toast(this, this.sellZone.x, this.sellZone.y - 110, `+${refund}💰`, '#ffd34e', 26);
    this.updateUI();
  }

  async adGiftTower() {
    if (this.adGifts >= 2) return;
    const free = this.slots.filter(s => !s.tower);
    if (!free.length) { toast(this, this.giftBtn.x, this.giftBtn.y - 84, '塔位已满', '#ff8888', 22); return; }
    const ok = await Poki.rewardedBreak();
    if (!ok) return;
    this.adGifts++;
    const lv = Math.min(MAX_LV, Math.max(3, spawnFloor(this.wave)));
    const elem = this.smartRandomElem(lv);
    const branch = lv >= 4 ? this.randomBranch(elem) : null;
    this.placeTower(Phaser.Utils.Array.GetRandom(free), elem, lv, branch);
    Sfx.merge(lv);
    this.updateUI();
  }

  autoBuyTick() {
    if (!tier(this.S, 'autoBuy') || this.over || this.dying || this.evolutionChoiceOpen || this.editorMode) return;
    this.buyTower(true);
  }

  autoMergeTick() {
    if (!tier(this.S, 'autoMerge') || this.over || this.dying || this.evolutionChoiceOpen || this.editorMode) return;
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
    if (best) this.doMerge(best[0], best[1], { auto: true });
  }

  updateSpeedButton() {
    if (!this.speedBtn) return;
    this.speedBtn.label.setText(this.runSpeedUnlocked ? `▶ x${this.speedMult}` : '📺 x2');
  }

  async toggleSpeed() {
    if (!this.runSpeedUnlocked) {
      const ok = await Poki.rewardedBreak();
      if (!ok) return;
      this.runSpeedUnlocked = true;
      toast(this, this.speedBtn.x, this.speedBtn.y - 70, '本局 2 倍速解锁', '#9fe8ff', 22);
      this.speedMult = 1;
    }
    this.speedMult = this.speedMult === 1 ? 2 : 1;
    this.time.timeScale = this.speedMult;
    this.tweens.timeScale = this.speedMult;
    this.updateSpeedButton();
  }

  // ================= 拖拽 =================
  setupDrag() {
    this.rangeCircle = this.add.circle(0, 0, 100, 0xffffff, 0.06).setStrokeStyle(2, 0xffffff, 0.35).setVisible(false).setDepth(900);

    this.input.on('pointerdown', pointer => {
      this.tryPlacePendingTower(pointer);
    });

    this.input.on('dragstart', (pointer, obj) => {
      const t = obj.towerRef;
      if (!t || this.over || this.evolutionChoiceOpen || this.pendingTowerDraft) return;
      t.dragging = true;
      t.setDraggingVisual(true);
      obj.setDepth(2600);
      this.rangeCircle.setPosition(t.slot.x, t.slot.y).setRadius(t.range).setVisible(true);
      this.sellZone.setStrokeStyle(3, 0xff6b7d).setScale(1.06);
      this.showFreeSlots(true);
      // 高亮可合成目标
      for (const o of this.towers) {
        if (o !== t && o.elem === t.elem && o.lv === t.lv && t.lv < MAX_LV) o.setHighlight(true);
      }
    });

    this.input.on('drag', (pointer, obj, dragX, dragY) => {
      if (!obj.towerRef) return;
      obj.setPosition(pointer.worldX ?? dragX, pointer.worldY ?? dragY);
    });

    this.input.on('dragend', (pointer, obj) => {
      const t = obj.towerRef;
      if (!t) return;
      t.dragging = false;
      t.setDraggingVisual(false);
      this.rangeCircle.setVisible(false);
      this.sellZone.setStrokeStyle(2, 0x9c4a58).setScale(1);
      this.showFreeSlots(false);
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
      if (d > tower.range + this.enemySize(e) * 0.5) continue;
      const remain = e.path.total - e.progress;
      if (remain < bestRemain) { bestRemain = remain; best = e; }
    }
    return best;
  }

  enemySize(e) {
    return e.type.size * (e.elite ? ELITE.sizeMult : 1);
  }

  eliteSpeedFactorFor(enemy) {
    if (enemy.dead) return 1;
    for (const e of this.enemies) {
      if (e === enemy || e.dead || e.eliteAffix !== 'haste') continue;
      if (Phaser.Math.Distance.Between(e.x, e.y, enemy.x, enemy.y) <= ELITE.auraRadius) return ELITE.auraSpeedMult;
    }
    return 1;
  }

  sourceBonusFor(t) {
    let bonus = this.holyAuraBonus(t);
    return Math.min(1, bonus);
  }

  shatterDamageMult(lv) {
    return lv >= 7 ? 2.6 : 2.2;
  }

  holyAuraBonus(t) {
    let bonus = 0;
    for (const aura of this.towers) {
      if (aura === t || aura.elem !== 'light' || aura.branch !== 'b' || aura.lv < 4) continue;
      // v1.19：230→170，圣辉从"全队常驻"收敛为"罩 3~4 塔的站位决策"，与塔位词缀联动
      const d = Phaser.Math.Distance.Between(aura.slot.x, aura.slot.y, t.slot.x, t.slot.y);
      if (d <= 170) bonus += aura.lv >= 7 ? 0.3 : 0.2;
    }
    return Math.min(1, bonus);
  }

  applyJudgementBuff(t) {
    if (t.elem !== 'light' || t.branch !== 'a' || t.lv < 4) return;
    if (t.lv >= 7) {
      this.atkBuffT = 3;
      this.atkBuffMult = Math.max(this.atkBuffMult || 1.3, 1.5);
      toast(this, t.slot.x, t.slot.y - 110, '审判：全场攻速+50%', '#fff8dc', 22);
      this.playJudgementPulseFx(t, true);
    } else {
      t.selfBuffT = 3;
      toast(this, t.slot.x, t.slot.y - 110, '审判：攻速+50%', '#fff8dc', 22);
      this.playJudgementPulseFx(t, false);
    }
  }

  tryHolyHeal(t) {
    if (t.elem !== 'light' || t.branch !== 'b' || t.lv < 4) return;
    const amount = t.lv >= 7 ? 2 : 1;
    const heal = Math.min(amount, this.maxBase - this.baseHp, 3 - this.holyHealThisWave);
    if (heal <= 0) return;
    this.baseHp += heal;
    this.holyHealThisWave += heal;
    toast(this, 560, 940, `圣辉 +${heal}❤`, '#fff8dc', 26);
    this.updateUI();
  }

  fireTower(t, target) {
    t.resetCooldown();
    t.recoil();
    const dmg = t.dmg;
    const lv = t.lv, elem = t.elem, color = t.color;
    const branch = lv >= 4 ? t.branch : null;
    const sx = t.slot.x, sy = t.slot.y - 50;

    if (elem === 'lightning') {
      // 连锁闪电：瞬发
      const chainN = 3 + (branch === 'a' ? 2 + (lv >= 7 ? 1 : 0) : 0);
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
      this.playLightningChainFx(sx, sy, chain, branch);
      chain.forEach((e, i) => {
        const ex = e.x, ey = e.y;
        const mult = (branch === 'a' && i === chain.length - 1) ? 1.75 : 1;
        const real = e.takeDamage(dmg * mult, { sourceTower: t, sourceBonus: this.sourceBonusFor(t, e) });
        this.showDmg(ex, ey - 40, real, '#fff2a8');
        if (branch === 'b' && !e.dead) {
          const chance = lv >= 7 ? 0.25 : 0.15;
          if (Math.random() < chance && e.applyStun(0.5)) {
            this.showDmg(ex, ey - 58, '眩晕', '#fff2a8');
            this.playStunRingFx(ex, ey);
          }
        }
      });
      Sfx.hit();
      return;
    }

    if (elem === 'light') {
      // 光束：瞬发 + 斩杀
      const tx = target.x, ty = target.y;
      this.lightBeam(sx, sy, tx, ty - 10);
      const threshold = branch === 'a' ? 0.25 : 0.15;
      if (target.hp / target.maxHp <= threshold) {
        this.showDmg(tx, ty - 50, '处决!', '#fff8dc');
        this.playExecuteFx(t, tx, ty);
        Sfx.execute();
        this.applyJudgementBuff(t);
        this.tryHolyHeal(t);
        target.takeDamage(target.hp + 1, { trueDmg: true, cause: 'execute', sourceTower: t, sourceBonus: this.sourceBonusFor(t, target) });
      } else {
        const mult = target.flying ? 1.5 : 1;
        const real = target.takeDamage(dmg * mult, { sourceTower: t, sourceBonus: this.sourceBonusFor(t, target) });
        this.showDmg(tx, ty - 40, real, '#fff8dc');
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
          if (branch === 'b') {
            if (target.dead) return;
            const crit = Math.random() < (lv >= 7 ? 0.5 : 0.3);
            const hit = dmg * 2.2 * (crit ? 3 : 1);
            const tx = target.x, ty = target.y;
            const real = target.takeDamage(hit, { sourceTower: t, sourceBonus: this.sourceBonusFor(t, target) });
            this.showDmg(tx, ty - 44, crit ? `暴击 ${Math.round(real)}` : real, crit ? '#ffe97a' : '#ffb199');
            this.playMoltenImpactFx(sx, sy, tx, ty, crit);
            return;
          }
          const radius = (62 + lv * 2) * (branch === 'a' ? 1.6 : 1);
          this.burst(ix, iy, color, 14, 1);
          for (const e of [...this.enemies]) {
            if (e.dead) continue;
            if (Phaser.Math.Distance.Between(ix, iy, e.x, e.y) <= radius + this.enemySize(e) * 0.5) {
              const ex = e.x, ey = e.y;
              const real = e.takeDamage(dmg, { sourceTower: t, sourceBonus: this.sourceBonusFor(t, e) });
              this.showDmg(ex, ey - 40, real, '#ffb199');
            }
          }
          if (branch === 'a') {
            this.addBurnZone(ix, iy, dmg * 0.5, {
              duration: lv >= 7 ? 4 : 2,
              goldMult: t.goldMult,
              sourceBonus: this.sourceBonusFor(t, target),
            });
          }
        } else if (elem === 'ice') {
          if (!target.dead) {
            const slowCap = 80;
            if (branch === 'a') {
              const novaChance = lv >= 7 ? 0.3 : 0.2;
              if (Math.random() < novaChance) {
                const novaRadius = 86 + lv * 6;
                const mainMult = lv >= 7 ? 1.9 : 1.6;
                const splashMult = lv >= 7 ? 0.65 : 0.45;
                const slowDuration = lv >= 7 ? 2.8 : 2.2;
                const cx = target.x, cy = target.y;
                this.playFrostNovaFx(cx, cy, novaRadius, lv >= 7);
                for (const e of [...this.enemies]) {
                  if (e.dead) continue;
                  const d = Phaser.Math.Distance.Between(cx, cy, e.x, e.y);
                  if (d > novaRadius + this.enemySize(e) * 0.5) continue;
                  const mult = e === target ? mainMult : splashMult;
                  const ex = e.x, ey = e.y;
                  const real = e.takeDamage(dmg * mult, { sourceTower: t, sourceBonus: this.sourceBonusFor(t, e) });
                  this.showDmg(ex, ey - 40, real, e === target ? '#e8f6ff' : '#bfe8ff');
                  if (!e.dead) e.applySlow(slowCap, slowDuration, 50, 20);
                }
                return;
              }
            }
            if (branch === 'b') {
              // 碎冰 v1.18「处刑受控者」：普攻不施加减速——条件由冰河/雷枢/冰冲击提供
              const hardCC = target.frozenT > 0 || target.stunnedT > 0;
              const slowed = target.slowT > 0;
              const mult = hardCC ? (lv >= 7 ? 5.5 : 4.5) : slowed ? this.shatterDamageMult(lv) : 1;
              const tx = target.x, ty = target.y;
              const real = target.takeDamage(dmg * mult, { sourceTower: t, sourceBonus: this.sourceBonusFor(t, target) });
              this.showDmg(tx, ty - 44, hardCC ? `处刑 ${Math.round(real)}` : real, hardCC ? '#e8f6ff' : '#bfe8ff');
              if (hardCC) this.burst(tx, ty, 0xbfe8ff, 16, 1.15);
              return;
            }
            const tx = target.x, ty = target.y;
            const real = target.takeDamage(dmg, { sourceTower: t, sourceBonus: this.sourceBonusFor(t, target) });
            this.showDmg(tx, ty - 40, real, '#bfe8ff');
            if (!target.dead) target.applySlow(slowCap, 2, 20, 20);
          }
        } else if (elem === 'poison') {
          if (!target.dead) {
            target.applyPoison(dmg, lv >= 4 ? 2 : 1, false, t, { sourceBonus: this.sourceBonusFor(t, target) });
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

  ensureVfxAnimations() {
    const defs = [
      { key: 'vfx_fire_burst_anim', texture: 'vfx_fire_burst_seq', end: 9, frameRate: 26, repeat: 0 },
      { key: 'vfx_burn_loop_anim', texture: 'vfx_burn_loop_seq', end: 7, frameRate: 10, repeat: -1 },
      { key: 'vfx_frost_nova_anim', texture: 'vfx_frost_nova_seq', end: 11, frameRate: 24, repeat: 0 },
    ];
    for (const def of defs) {
      if (this.anims.exists(def.key) || !this.textures.exists(def.texture)) continue;
      this.anims.create({
        key: def.key,
        frames: this.anims.generateFrameNumbers(def.texture, { start: 0, end: def.end }),
        frameRate: def.frameRate,
        repeat: def.repeat,
      });
    }
  }

  playFireBurstFx(x, y, radius, color = 0xff7733) {
    this.ensureVfxAnimations();
    if (!this.textures.exists('vfx_fire_burst_seq') || !this.anims.exists('vfx_fire_burst_anim')) {
      this.burst(x, y, color, 12, 0.8);
      return;
    }
    const fx = this.add.sprite(x, y, 'vfx_fire_burst_seq')
      .setAlpha(0.98)
      .setOrigin(0.5, 0.86)
      .setScale((radius * 3.05) / 256)
      .setAngle(Phaser.Math.Between(-16, 16))
      .setDepth(2100);
    fx.play('vfx_fire_burst_anim');
    fx.once('animationcomplete', () => fx.destroy());
  }

  addBurnZone(x, y, dps, opts = {}) {
    const duration = opts.duration ?? 2;
    const radius = opts.radius ?? 58;
    let img = null;
    if (opts.visual !== false) {
      this.ensureVfxAnimations();
      const texture = this.textures.exists('vfx_burn_loop_seq')
        ? 'vfx_burn_loop_seq'
        : this.textures.exists('vfx_burning_ground') ? 'vfx_burning_ground' : 'glow';
      const visualRadius = opts.visualRadius ?? radius;
      const scale = opts.visualScale ?? (
        texture === 'vfx_burn_loop_seq'
          ? (visualRadius * (opts.visualScaleMult ?? 2.1)) / 256
          : texture === 'vfx_burning_ground'
          ? (visualRadius * (opts.visualScaleMult ?? 2.35)) / 512
          : (opts.scale ?? 1.8)
      );
      const targetAlpha = opts.alpha ?? (texture === 'glow' ? 0.55 : 0.78);
      img = texture === 'vfx_burn_loop_seq'
        ? this.add.sprite(x, y, texture)
        : this.add.image(x, y, texture);
      img
        .setAlpha(0)
        .setScale(scale * 0.82)
        .setAngle(Phaser.Math.Between(-18, 18))
        .setDepth(opts.depth ?? 100);
      if (texture === 'vfx_burn_loop_seq' && this.anims.exists('vfx_burn_loop_anim')) img.play('vfx_burn_loop_anim');
      if (texture === 'glow') img.setTint(opts.color ?? 0xff7733);
      this.tweens.add({
        targets: img,
        alpha: targetAlpha,
        scale,
        duration: 160,
        ease: 'Cubic.Out',
      });
      this.tweens.add({
        targets: img,
        alpha: targetAlpha * 0.76,
        scale: scale * 1.035,
        delay: 160,
        duration: 520,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.InOut',
      });
    }
    this.burnZones.push({ x, y, dps, t: duration, img, tick: 0, radius, goldMult: opts.goldMult || 1, sourceBonus: opts.sourceBonus || 0 });
  }

  // ================= 特效工具 =================
  playFrostNovaFx(x, y, radius, strong = false) {
    this.ensureVfxAnimations();
    if (this.textures.exists('vfx_frost_nova_seq') && this.anims.exists('vfx_frost_nova_anim')) {
      const baseScale = (radius * (strong ? 2.85 : 2.55)) / 320;
      const nova = this.add.sprite(x, y, 'vfx_frost_nova_seq')
        .setAlpha(strong ? 0.98 : 0.92)
        .setScale(baseScale)
        .setAngle(Phaser.Math.Between(-18, 18))
        .setDepth(2092);
      nova.play('vfx_frost_nova_anim');
      nova.once('animationcomplete', () => nova.destroy());
    } else if (!this.textures.exists('vfx_frost_nova')) {
      this.burst(x, y, 0xbfe8ff, strong ? 54 : 38, strong ? 1.45 : 1.1);
    } else {
      const baseScale = (radius * (strong ? 2.85 : 2.55)) / 512;
      const nova = this.add.image(x, y, 'vfx_frost_nova')
        .setAlpha(0)
        .setScale(baseScale * 0.28)
        .setAngle(Phaser.Math.Between(-18, 18))
        .setDepth(2092);
      this.tweens.add({
        targets: nova,
        alpha: strong ? 0.98 : 0.9,
        scale: baseScale,
        duration: 170,
        ease: 'Back.Out',
        onComplete: () => {
          this.tweens.add({
            targets: nova,
            alpha: 0,
            scale: baseScale * 1.08,
            duration: strong ? 540 : 440,
            ease: 'Sine.Out',
            onComplete: () => nova.destroy(),
          });
        },
      });

      const afterImage = this.add.image(x, y, 'vfx_frost_nova')
        .setAlpha(strong ? 0.28 : 0.2)
        .setScale(baseScale * 0.9)
        .setAngle(nova.angle + 30)
        .setDepth(2089);
      this.tweens.add({
        targets: afterImage,
        alpha: 0,
        scale: baseScale * 1.34,
        duration: strong ? 760 : 620,
        ease: 'Cubic.Out',
        onComplete: () => afterImage.destroy(),
      });
    }

    const core = this.add.image(x, y, 'glow')
      .setTint(0xffffff)
      .setAlpha(0.92)
      .setScale(0.22)
      .setDepth(2094);
    this.tweens.add({
      targets: core,
      scale: strong ? 1.8 : 1.38,
      alpha: 0,
      duration: 260,
      ease: 'Quad.Out',
      onComplete: () => core.destroy(),
    });

    const shards = this.add.particles(x, y, 'ice_shard', {
      angle: { min: 0, max: 360 },
      rotate: { min: 0, max: 360 },
      speed: { min: strong ? 110 : 75, max: strong ? 250 : 190 },
      scale: { start: strong ? 0.58 : 0.44, end: 0 },
      lifespan: strong ? 620 : 500,
      emitting: false,
    }).setDepth(2095);
    shards.explode(strong ? 18 : 12);
    this.time.delayedCall(strong ? 760 : 620, () => shards.destroy());

    this.cameras.main.shake(strong ? 210 : 140, strong ? 0.005 : 0.0032);
  }

  playPlagueBurstFx(x, y, radius, targets = []) {
    const cloud = this.add.image(x, y, 'glow')
      .setTint(0x7ede55)
      .setAlpha(0.48)
      .setScale(radius / 34)
      .setDepth(2072);
    this.tweens.add({
      targets: cloud,
      scale: radius / 17,
      alpha: 0,
      duration: 740,
      ease: 'Cubic.Out',
      onComplete: () => cloud.destroy(),
    });

    const ring = this.add.circle(x, y, radius, 0x7ede55, 0.08)
      .setStrokeStyle(5, 0x9ef07a, 0.72)
      .setScale(0.18)
      .setDepth(2074);
    this.tweens.add({
      targets: ring,
      scale: 1,
      alpha: 0,
      duration: 440,
      ease: 'Cubic.Out',
      onComplete: () => ring.destroy(),
    });

    const spores = this.add.particles(x, y, 'spark', {
      angle: { min: 0, max: 360 },
      speed: { min: 90, max: 280 },
      scale: { start: 1.1, end: 0 },
      lifespan: 760,
      tint: 0x9ef07a,
      emitting: false,
    }).setDepth(2080);
    spores.explode(32 + Math.min(22, targets.length * 3));
    this.time.delayedCall(960, () => spores.destroy());

    if (!targets.length) return;
    const lines = this.add.graphics().setDepth(2079);
    lines.lineStyle(2, 0x9ef07a, 0.54);
    for (const target of targets.slice(0, 14)) {
      lines.lineBetween(x, y, target.x, target.y);
    }
    this.tweens.add({
      targets: lines,
      alpha: 0,
      duration: 360,
      ease: 'Quad.Out',
      onComplete: () => lines.destroy(),
    });

    targets.slice(0, 10).forEach((target, i) => {
      const spore = this.add.image(x, y, 'spark')
        .setTint(0x9ef07a)
        .setAlpha(0.95)
        .setScale(0.75)
        .setDepth(2084);
      this.tweens.add({
        targets: spore,
        x: target.x,
        y: target.y - 8,
        alpha: 0.35,
        scale: 1.15,
        delay: i * 18,
        duration: 210 + i * 10,
        ease: 'Cubic.Out',
        onComplete: () => {
          spore.destroy();
          this.burst(target.x, target.y, 0x9ef07a, 5, 0.45);
        },
      });
    });
  }

  playMoltenImpactFx(sx, sy, x, y, crit = false) {
    const muzzle = this.add.image(sx, sy, 'glow')
      .setTint(0xffe2a3)
      .setAlpha(0.76)
      .setScale(crit ? 0.78 : 0.58)
      .setDepth(2075);
    this.tweens.add({
      targets: muzzle,
      scale: crit ? 1.36 : 0.96,
      alpha: 0,
      duration: 150,
      ease: 'Quad.Out',
      onComplete: () => muzzle.destroy(),
    });

    const trace = this.add.graphics().setDepth(2072);
    trace.lineStyle(crit ? 9 : 6, 0xff7a2f, crit ? 0.34 : 0.22);
    trace.lineBetween(sx, sy, x, y - 10);
    trace.lineStyle(crit ? 4 : 3, 0xfff2a8, 0.86);
    trace.lineBetween(sx, sy, x, y - 10);
    this.tweens.add({
      targets: trace,
      alpha: 0,
      duration: crit ? 210 : 170,
      ease: 'Quad.Out',
      onComplete: () => trace.destroy(),
    });

    const core = this.add.image(x, y, 'glow')
      .setTint(crit ? 0xfff2a8 : 0xff9b45)
      .setAlpha(crit ? 0.82 : 0.62)
      .setScale(crit ? 0.72 : 0.52)
      .setDepth(2084);
    this.tweens.add({
      targets: core,
      scale: crit ? 2.05 : 1.28,
      alpha: 0,
      duration: crit ? 290 : 220,
      ease: 'Cubic.Out',
      onComplete: () => core.destroy(),
    });

    const ring = this.add.circle(x, y, crit ? 48 : 34, 0xff9b45, 0)
      .setStrokeStyle(crit ? 8 : 5, crit ? 0xfff2a8 : 0xff9b45, crit ? 0.82 : 0.58)
      .setScale(0.18)
      .setDepth(2083);
    this.tweens.add({
      targets: ring,
      scale: crit ? 2.35 : 1.55,
      alpha: 0,
      duration: crit ? 360 : 260,
      ease: 'Cubic.Out',
      onComplete: () => ring.destroy(),
    });

    const sparks = this.add.particles(x, y, 'spark', {
      angle: { min: 0, max: 360 },
      speed: { min: crit ? 190 : 100, max: crit ? 420 : 280 },
      gravityY: crit ? 260 : 180,
      scale: { start: crit ? 1.32 : 0.9, end: 0 },
      lifespan: crit ? 650 : 460,
      tint: crit ? 0xffe97a : 0xff9b45,
      emitting: false,
    }).setDepth(2085);
    sparks.explode(crit ? 42 : 18);
    this.time.delayedCall(crit ? 840 : 620, () => sparks.destroy());

    this.cameras.main.shake(crit ? 190 : 80, crit ? 0.006 : 0.002);
  }

  playLightningChainFx(sx, sy, chain, branch = null) {
    const segments = [];
    let from = { x: sx, y: sy };
    for (const e of chain) {
      const to = { x: e.x, y: e.y - 10 };
      const pts = [from];
      for (let i = 1; i <= 4; i++) {
        const t = i / 4;
        pts.push({
          x: from.x + (to.x - from.x) * t + (i < 4 ? Phaser.Math.Between(-14, 14) : 0),
          y: from.y + (to.y - from.y) * t + (i < 4 ? Phaser.Math.Between(-14, 14) : 0),
        });
      }
      segments.push(pts);
      from = to;
    }

    const g = this.add.graphics().setDepth(2102);
    const draw = (width, color, alpha) => {
      g.lineStyle(width, color, alpha);
      for (const pts of segments) {
        for (let i = 1; i < pts.length; i++) {
          g.lineBetween(pts[i - 1].x, pts[i - 1].y, pts[i].x, pts[i].y);
        }
      }
    };
    draw(branch === 'a' ? 10 : 8, 0x7df9ff, branch === 'a' ? 0.24 : 0.18);
    draw(5, 0xfff2a8, 0.9);
    draw(2, 0xffffff, 0.98);
    this.tweens.add({
      targets: g,
      alpha: 0,
      duration: branch === 'a' ? 240 : 190,
      ease: 'Quad.Out',
      onComplete: () => g.destroy(),
    });

    chain.forEach((e, i) => {
      this.playLightningHitFx(e.x, e.y, branch === 'a' && i === chain.length - 1);
    });
  }

  playLightningHitFx(x, y, strong = false) {
    const flash = this.add.image(x, y - 8, 'glow')
      .setTint(strong ? 0x7df9ff : 0xfff2a8)
      .setAlpha(strong ? 0.62 : 0.42)
      .setScale(strong ? 0.66 : 0.48)
      .setDepth(2103);
    this.tweens.add({
      targets: flash,
      scale: strong ? 1.45 : 1.02,
      alpha: 0,
      duration: strong ? 260 : 190,
      ease: 'Cubic.Out',
      onComplete: () => flash.destroy(),
    });
    if (strong) this.burst(x, y, 0x7df9ff, 10, 0.8);
  }

  playStunRingFx(x, y) {
    this.playLightningHitFx(x, y, true);
    const ring = this.add.circle(x, y - 14, 26, 0xfff2a8, 0)
      .setStrokeStyle(3, 0xfff2a8, 0.82)
      .setDepth(2105);
    this.tweens.add({
      targets: ring,
      y: y - 24,
      scale: 1.55,
      alpha: 0,
      duration: 360,
      ease: 'Cubic.Out',
      onComplete: () => ring.destroy(),
    });
  }

  playExecuteFx(t, x, y) {
    const topY = Math.max(-90, y - 560);
    const h = y - topY + 96;
    const pillar = this.add.rectangle(x, topY + h / 2, 24, h, 0xfff8dc, 0.28)
      .setDepth(2114);
    this.tweens.add({
      targets: pillar,
      scaleX: 2.15,
      alpha: 0,
      duration: 280,
      ease: 'Quad.Out',
      onComplete: () => pillar.destroy(),
    });

    const core = this.add.image(x, y - 8, 'glow')
      .setTint(0xfff8dc)
      .setAlpha(0.86)
      .setScale(0.74)
      .setDepth(2115);
    this.tweens.add({
      targets: core,
      scale: 2.2,
      alpha: 0,
      duration: 300,
      ease: 'Cubic.Out',
      onComplete: () => core.destroy(),
    });

    const ring = this.add.circle(x, y, 42, 0xfff8dc, 0)
      .setStrokeStyle(6, 0xfff8dc, 0.86)
      .setScale(0.2)
      .setDepth(2116);
    this.tweens.add({
      targets: ring,
      scale: 2.0,
      alpha: 0,
      duration: 340,
      ease: 'Cubic.Out',
      onComplete: () => ring.destroy(),
    });

    const motes = this.add.particles(x, y - 10, 'spark', {
      angle: { min: 235, max: 305 },
      speed: { min: 110, max: 260 },
      gravityY: -120,
      scale: { start: 0.95, end: 0 },
      lifespan: 560,
      tint: 0xfff8dc,
      emitting: false,
    }).setDepth(2117);
    motes.explode(28);
    this.time.delayedCall(720, () => motes.destroy());

    this.cameras.main.shake(130, 0.0035);
  }

  playJudgementPulseFx(t, global = false) {
    const x = t.slot.x;
    const y = t.slot.y - 24;
    const color = 0xfff8dc;
    const glow = this.add.image(x, y, 'glow')
      .setTint(color)
      .setAlpha(global ? 0.42 : 0.3)
      .setScale(global ? 1.0 : 0.72)
      .setDepth(2110);
    this.tweens.add({
      targets: glow,
      scale: global ? 3.0 : 1.65,
      alpha: 0,
      duration: global ? 520 : 340,
      ease: 'Cubic.Out',
      onComplete: () => glow.destroy(),
    });

    const ring = this.add.circle(x, y, global ? 72 : 48, color, 0)
      .setStrokeStyle(global ? 7 : 5, color, global ? 0.76 : 0.64)
      .setScale(0.18)
      .setDepth(2111);
    this.tweens.add({
      targets: ring,
      scale: global ? 3.1 : 1.75,
      alpha: 0,
      duration: global ? 560 : 360,
      ease: 'Cubic.Out',
      onComplete: () => ring.destroy(),
    });

    if (global) this.screenGlow(color, 0.1);
  }

  mergeBurst(x, y, color, lv = 1) {
    const count = Phaser.Math.Clamp(18 + lv * 3, 22, 40);
    const p = this.add.particles(x, y, 'spark', {
      angle: { min: 0, max: 360 },
      speed: { min: 150, max: 280 },
      scale: { start: 1.05, end: 0 },
      lifespan: 460,
      tint: color,
      emitting: false,
    }).setDepth(2350);
    p.explode(count);
    this.time.delayedCall(720, () => p.destroy());

    const ring = this.add.circle(x, y, 24, color, 0)
      .setStrokeStyle(5, color, 0.82)
      .setDepth(2348);
    this.tweens.add({
      targets: ring,
      scale: 2.4,
      alpha: 0,
      duration: 340,
      ease: 'Cubic.Out',
      onComplete: () => ring.destroy(),
    });

    const core = this.add.image(x, y, 'glow')
      .setTint(color)
      .setAlpha(0.42)
      .setScale(0.75)
      .setDepth(2347);
    this.tweens.add({
      targets: core,
      scale: 1.7,
      alpha: 0,
      duration: 260,
      ease: 'Quad.Out',
      onComplete: () => core.destroy(),
    });
  }

  playBossDeathFx(x, y, color, rewardDiamonds = 0) {
    const flash = this.add.rectangle(W / 2, H / 2, W, H, 0x9fe8ff, 0.24)
      .setDepth(2942);
    this.tweens.add({
      targets: flash,
      alpha: 0,
      duration: 360,
      ease: 'Quad.Out',
      onComplete: () => flash.destroy(),
    });

    const core = this.add.image(x, y, 'glow')
      .setTint(color)
      .setAlpha(0.72)
      .setScale(1.1)
      .setDepth(2338);
    this.tweens.add({
      targets: core,
      scale: 2.6,
      alpha: 0,
      duration: 280,
      ease: 'Cubic.Out',
      onComplete: () => core.destroy(),
    });

    const firstRing = this.add.circle(x, y, 34, color, 0)
      .setStrokeStyle(8, color, 0.86)
      .setDepth(2340);
    this.tweens.add({
      targets: firstRing,
      scale: 2.8,
      alpha: 0,
      duration: 300,
      ease: 'Cubic.Out',
      onComplete: () => firstRing.destroy(),
    });

    const shards = this.add.particles(x, y, 'spark', {
      angle: { min: 0, max: 360 },
      speed: { min: 230, max: 420 },
      scale: { start: 1.4, end: 0 },
      lifespan: 620,
      tint: color,
      emitting: false,
    }).setDepth(2344);
    shards.explode(56);
    this.time.delayedCall(820, () => shards.destroy());

    this.time.delayedCall(120, () => {
      this.cameras.main.shake(280, 0.015);
      this.burst(x, y, 0xffffff, 36, 2.1);
      this.burst(x, y, color, 48, 2.0);

      const secondRing = this.add.circle(x, y, 48, 0x9fe8ff, 0)
        .setStrokeStyle(10, 0x9fe8ff, 0.78)
        .setDepth(2346);
      this.tweens.add({
        targets: secondRing,
        scale: 3.6,
        alpha: 0,
        duration: 420,
        ease: 'Cubic.Out',
        onComplete: () => secondRing.destroy(),
      });

      const plume = this.add.particles(x, y - 10, 'spark', {
        angle: { min: 205, max: 335 },
        speed: { min: 190, max: 360 },
        gravityY: 360,
        scale: { start: 1.2, end: 0 },
        lifespan: 700,
        tint: 0x9fe8ff,
        emitting: false,
      }).setDepth(2347);
      plume.explode(44);
      this.time.delayedCall(900, () => plume.destroy());

      this.diamondFountain(x, y - 8, rewardDiamonds);
      Sfx.diamond();
    });
  }

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
    const str = typeof val === 'number' ? String(Math.max(0, Math.round(val))) : val;
    const t = this.add.text(x + Phaser.Math.Between(-14, 14), y, str, {
      fontFamily: 'Arial Black, sans-serif', fontSize: '22px', color, stroke: '#000000', strokeThickness: 4,
    }).setOrigin(0.5).setDepth(2300);
    this.tweens.add({
      targets: t, y: y - 48, alpha: 0, duration: 600, ease: 'Cubic.Out',
      onComplete: () => { t.destroy(); this.dmgCount--; },
    });
  }

  diamondFountain(x, y, rewardDiamonds = 0) {
    const targetX = this.diamondIcon?.x ?? 516;
    const targetY = this.diamondIcon?.y ?? 30;
    const count = Math.max(6, rewardDiamonds * 3);
    for (let i = 0; i < count; i++) {
      const d = this.add.image(x, y, 'diamond')
        .setDepth(2425 + i)
        .setScale(0.55 + Math.random() * 0.18)
        .setAngle(Phaser.Math.Between(-25, 25));
      const angle = Phaser.Math.Between(210, 330) * Math.PI / 180;
      const dist = Phaser.Math.Between(62, 150);
      const apexX = x + Math.cos(angle) * dist;
      const apexY = y + Math.sin(angle) * dist - Phaser.Math.Between(18, 70);
      this.tweens.add({
        targets: d,
        x: apexX,
        y: apexY,
        scale: d.scaleX + 0.3,
        angle: d.angle + Phaser.Math.Between(-120, 120),
        duration: 190 + i * 10,
        ease: 'Cubic.Out',
        onComplete: () => {
          this.tweens.add({
            targets: d,
            x: targetX + Phaser.Math.Between(-8, 8),
            y: targetY + Phaser.Math.Between(-5, 5),
            scale: 0.42,
            angle: d.angle + Phaser.Math.Between(180, 420),
            alpha: 0.78,
            delay: i * 24,
            duration: 430 + Phaser.Math.Between(0, 130),
            ease: 'Cubic.In',
            onComplete: () => {
              d.destroy();
              if (i === count - 1) this.popDiamondText();
            },
          });
        },
      });
    }
  }

  popDiamondText() {
    this.tweens.killTweensOf(this.diamondText);
    this.diamondText.setScale(1);
    this.tweens.add({
      targets: this.diamondText,
      scale: 1.28,
      duration: 95,
      ease: 'Quad.Out',
      yoyo: true,
    });
  }

  rollGoldTo(targetGold) {
    const from = this.displayGold ?? targetGold;
    if (this.goldRollTween) this.goldRollTween.stop();
    this.goldRollTween = this.tweens.addCounter({
      from,
      to: targetGold,
      duration: 360,
      ease: 'Cubic.Out',
      onUpdate: tw => {
        this.displayGold = tw.getValue();
        this.goldText.setText(String(Math.floor(this.displayGold)));
      },
      onComplete: () => {
        this.displayGold = targetGold;
        this.goldRollTween = null;
        this.goldText.setText(String(Math.floor(this.displayGold)));
      },
    });
    this.tweens.killTweensOf(this.goldText);
    this.goldText.setScale(1);
    this.tweens.add({
      targets: this.goldText,
      scale: 1.18,
      duration: 90,
      ease: 'Quad.Out',
      yoyo: true,
    });
  }

  coinFly(x, y, amount = 0) {
    if (this.coinCount > 7) return;
    const targetX = this.coinIcon?.x ?? 332;
    const targetY = this.coinIcon?.y ?? 30;
    this.coinCount++;
    const c = this.add.image(x, y, 'coin').setDepth(2400);
    const label = amount > 0
      ? this.add.text(x + 18, y - 18, `+${amount}`, {
        fontFamily: 'Arial Black, sans-serif',
        fontSize: '22px',
        color: '#ffd34e',
        stroke: '#000000',
        strokeThickness: 4,
      }).setOrigin(0.5).setDepth(2401)
      : null;
    const targets = label ? [c, label] : [c];
    this.tweens.add({
      targets,
      x: targetX + 8,
      y: targetY,
      scale: 0.7,
      duration: 480,
      ease: 'Cubic.In',
      onComplete: () => {
        c.destroy();
        if (label) label.destroy();
        this.coinCount--;
        Sfx.coin();
      },
    });
  }

  // ================= 死亡 / 复活 / 结算 =================
  baseDestroyed() {
    if (this.dying || this.over || this.lastStandActive) return;
    this.deathWave = this.wave;
    if (!this.lastStandUsed) {
      this.startLastStand();
      return;
    }
    this.showDefeatChoices();
  }

  startLastStand() {
    this.lastStandUsed = true;
    this.lastStandActive = true;
    this.lastStandT = 5;
    this.lastStandLeaked = false;
    this.lastStandCanClutch = this.spawnLeft > 0 || this.enemies.some(e => !e.dead);
    this.baseHp = 0;
    this.updateUI();
    this.cameras.main.shake(500, 0.015);
    this.banner('最后一战!');
    Sfx.lastStand();

    this.lastStandOverlay = this.add.rectangle(W / 2, H / 2, W, H, 0x9b1022, 0)
      .setDepth(2250);
    this.tweens.add({ targets: this.lastStandOverlay, alpha: 0.28, duration: 220 });
    this.lastStandText = this.uiText(W / 2, 160, '最后一战 5.0', 34, '#ffccd2')
      .setOrigin(0.5)
      .setDepth(3000);
    this.lastStandText.setStroke('#390611', 7);
  }

  updateLastStand(realDt) {
    if (!this.lastStandActive) return;
    this.lastStandT -= realDt;
    if (this.lastStandText) this.lastStandText.setText(`最后一战 ${Math.max(0, this.lastStandT).toFixed(1)}`);
    if (this.lastStandCanClutch && !this.lastStandLeaked && this.spawnLeft <= 0 && this.enemies.length === 0) {
      this.finishLastStand(true);
    } else if (this.lastStandT <= 0) {
      this.finishLastStand(false);
    }
  }

  finishLastStand(success) {
    if (!this.lastStandActive) return;
    this.lastStandActive = false;
    this.lastStandCanClutch = false;
    this.clearLastStandFx();

    if (success) {
      this.baseHp = 1;
      this.updateUI();
      this.banner('绝地翻盘!');
      Sfx.clutch();
      this.flash.setFillStyle(0xffe97a, 0.72).setAlpha(0.72);
      this.tweens.add({
        targets: this.flash,
        alpha: 0,
        duration: 650,
        onComplete: () => this.flash.setFillStyle(0xffffff, 0),
      });
      this.checkWaveClear();
      return;
    }

    this.showDefeatChoices();
  }

  clearLastStandFx() {
    if (this.lastStandOverlay) {
      const overlay = this.lastStandOverlay;
      this.lastStandOverlay = null;
      this.tweens.add({ targets: overlay, alpha: 0, duration: 240, onComplete: () => overlay.destroy() });
    }
    if (this.lastStandText) {
      this.lastStandText.destroy();
      this.lastStandText = null;
    }
  }

  showDefeatChoices() {
    if (this.dying || this.over) return;
    this.dying = true;
    if (this.prepTimer) this.prepTimer.remove();
    if (this.spawnEvent) this.spawnEvent.remove();

    // 败北是终态模态：先收起所有造塔/进化交互，避免卡片与败北弹窗叠层。
    this.clearTowerChoiceLayer();
    this.clearPendingTowerDraft();
    if (this.evolutionChoiceOpen) {
      this.resumeEvolutionChoice();
      this.evolutionChoiceOpen = false;
      if (this.evolutionLayer) {
        this.evolutionLayer.destroy();
        this.evolutionLayer = null;
      }
    }

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

  buildDeathAnalysis(S) {
    const wave = this.deathWave || this.wave;
    const candidates = [];
    const leakEntries = Object.entries(this.leakStats).sort((a, b) => b[1] - a[1]);
    const topLeak = leakEntries[0];

    if (topLeak && topLeak[1] >= 3) candidates.push(this.leakDiagnosis(topLeak[0], topLeak[1], wave));
    if (wave % 5 === 0 || this.leakStats.boss > 0) {
      candidates.push({
        key: 'boss_wave',
        text: `你死于第 ${wave} 波：Boss 波前囤好合成对，连锁共鸣一波爆发`,
      });
    }

    const expectedLv = this.expectedHighestLv(wave);
    if (this.highestLv < expectedLv) {
      candidates.push({
        key: 'low_highest_lv',
        text: `你死于第 ${wave} 波：最高塔只有 Lv${this.highestLv} → 少买多合，等级就是战力`,
        upgradeId: 'startLv',
      });
    }

    const freeSlots = this.slots.filter(s => !s.tower).length;
    if (freeSlots > 0 && this.gold >= towerPrice(this.wave, 0)) {
      candidates.push({
        key: 'idle_gold_slots',
        text: `你死于第 ${wave} 波：还空着 ${freeSlots} 个塔位 → 金币别攥着，塔位空一格就是防线漏一格`,
        upgradeId: 'startGold',
      });
    }

    candidates.push({
      key: 'fallback',
      text: `你死于第 ${wave} 波：三选一优先凑对子，Boss 前留一次合成冲击`,
    });

    const diagnosis = this.pickDiagnosis(candidates, S);
    diagnosis.elements = this.elementSummary();
    return diagnosis;
  }

  leakDiagnosis(typeKey, count, wave) {
    const name = TYPE_CN[typeKey] || typeKey;
    if (typeKey === 'tank') {
      return {
        key: 'leak_tank',
        text: `你死于第 ${wave} 波：铁盾兵漏了 ${count} 只 → ☠毒塔无视护甲，专克铁罐头`,
      };
    }
    if (typeKey === 'runner') {
      return {
        key: 'leak_runner',
        text: `你死于第 ${wave} 波：疾行者漏了 ${count} 只 → ❄冰塔减速，先稳住跑得快的`,
      };
    }
    if (typeKey === 'flyer') {
      return {
        key: 'leak_flyer',
        text: `你死于第 ${wave} 波：飞行兵漏了 ${count} 只 → ✨光塔和⚡电塔更适合拦截空中目标`,
        upgradeId: 'unlockLight',
      };
    }
    if (typeKey === 'splitter' || typeKey === 'mini') {
      return {
        key: 'leak_splitter',
        text: `你死于第 ${wave} 波：分裂怪漏了 ${count} 只 → 🔥火塔溅射能更快清掉小怪群`,
      };
    }
    return {
      key: `leak_${typeKey}`,
      text: `你死于第 ${wave} 波：${name}漏了 ${count} 只 → 少买多合，把主力塔等级抬起来`,
      upgradeId: 'startLv',
    };
  }

  expectedHighestLv(wave) {
    if (wave >= 30) return 7;
    if (wave >= 20) return 5;
    if (wave >= 10) return 3;
    if (wave >= 5) return 2;
    return 1;
  }

  pickDiagnosis(candidates, S) {
    const primary = candidates[0];
    const repeated = primary.key === S.lastDiagnosisKey ? (S.lastDiagnosisCount || 0) + 1 : 1;
    const chosen = repeated > 2 && candidates[1] ? candidates[1] : primary;
    S.lastDiagnosisCount = chosen.key === S.lastDiagnosisKey ? repeated : 1;
    S.lastDiagnosisKey = chosen.key;
    return { ...chosen };
  }

  elementSummary() {
    const counts = {};
    for (const t of this.towers) counts[t.elem] = (counts[t.elem] || 0) + 1;
    const parts = Object.entries(counts).map(([elem, count]) => `${ELEMENTS[elem].cn}×${count}`);
    return parts.length ? parts.join('  ') : '无塔';
  }

  async endRun() {
    if (this.over) return;
    this.over = true;
    stopStageAudio();
    Poki.gameplayStop();
    const S = this.S;
    const diagnosis = this.buildDeathAnalysis(S);
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
      wave: this.wave, kills: this.kills, dRun: this.diamondsRun, newBest, deathBonus, diagnosis,
    });
  }

  // ================= 主循环 =================
  update(time, delta) {
    this.ensureResponsiveLayout();
    if (this.over || this.editorMode) return;
    let dts = (delta / 1000) * this.speedMult;
    if (this.lastStandActive) this.updateLastStand(delta / 1000);
    // 慢镜（按真实时间衰减）
    if (this.slowmoT > 0) {
      this.slowmoT -= delta / 1000;
      dts *= 0.3;
    }
    if (this.evolutionChoiceOpen) dts *= 0.5;
    if (this.lastStandActive) dts *= 0.5;
    if (this.dying) return;

    // 敌人
    for (const e of [...this.enemies]) e.update(dts);

    // 光 Lv7 攻速 buff
    if (this.atkBuffT > 0) this.atkBuffT -= dts;
    else this.atkBuffMult = 1.3;
    let buff = this.atkBuffT > 0 ? (this.atkBuffMult || 1.3) : 1;
    if (this.lastStandActive) buff *= 6;

    // 塔开火
    for (const t of this.towers) {
      if (t.dragging || (t.lv >= 4 && !t.branch)) continue;
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
          if (!e.dead && !e.flying && Phaser.Math.Distance.Between(z.x, z.y, e.x, e.y) < z.radius) {
            e.takeDamage(z.dps * 0.25, { trueDmg: true, goldMult: z.goldMult, sourceBonus: z.sourceBonus || 0 });
          }
        }
      }
      if (z.t <= 0) {
        if (z.img) {
          this.tweens.killTweensOf(z.img);
          z.img.destroy();
        }
      }
    }
    this.burnZones = this.burnZones.filter(z => z.t > 0);

    // Boss 血条
    const bosses = this.enemies.filter(e => e.boss);
    if (bosses.length) {
      const ratio = bosses.reduce((s, b) => s + Math.max(0, b.hp), 0) / bosses.reduce((s, b) => s + b.maxHp, 0);
      this.bossBarBg.setVisible(true);
      this.bossBar.setVisible(true).width = (this.bossBarMaxWidth || 600) * ratio;
    } else {
      this.bossBarBg.setVisible(false);
      this.bossBar.setVisible(false);
    }
  }
}
