import Phaser from 'phaser';
import {
  W, H, MAX_LV, DEFAULT_DIFFICULTY, DIFFICULTIES, ELEMENTS, ENEMY_TYPES, BASE_HP, LEAK_BOSS, LEAK_NORMAL,
  PHASES, phaseFor, towerPrice, towerBasePrice, waveHp, waveCount, spawnFloor, DIAMOND,
  towerDmg, towerRange,
  MERGE_SURGE, FIRE_BRANCH_BALANCE, ICE_RIVER, ICE_SHATTER, LIGHTNING_HUB, PLAGUE,
  ELITE, TOWER_BRANCHES, BOSS_AFFIXES,
  NON_BOSS_SPEED_CAP, nonBossSpeedMult, WAVE_EVENTS,
} from '../config.js';
import { Enemy, Path } from '../classes/Enemy.js';
import { Tower } from '../classes/Tower.js';
import { makeButton, makeHudButton, toast } from '../ui.js';
import {
  Sfx, setMuted, isMuted, unlockAudio,
  startStageAudio, stopStageAudio, setAudioPhase,
} from '../audio.js';
import { Poki } from '../poki.js';
import { writeSave, tier, unlockedElements } from '../save.js';
import { addTowerImage, fitTowerImageHeight } from '../textures.js';
import { getLocale, LOCALES, setLocale, t, t as tr } from '../i18n.js';
import { gameRunAnalysisMethods } from './gameRunAnalysis.js';
import { gameVfxMethods } from './gameVfx.js';

// 地面路径（行进式像素描迹校准到石板路中轴线，2026-07-09）
const PATH_PTS = [
  { x: 118, y: -35 }, { x: 125, y: 40 }, { x: 150, y: 100 }, { x: 170, y: 158 },
  { x: 178, y: 220 }, { x: 165, y: 275 }, { x: 145, y: 305 }, { x: 172, y: 330 },
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
// 手绘背景两排平台的视觉中心略有不同，分别校准高亮圈。
const SLOT_RING_Y_OFFSETS = [0, -16];
const TYPE_ICON = { slime: '🟣', runner: '💨', tank: '🛡️', flyer: '🐝', splitter: '🟠', priest: '🍄', boss: '💀', mini: '·' };
const TYPE_CN = { slime: t('enemy.slime'), runner: t('enemy.runner'), tank: t('enemy.tank'), flyer: t('enemy.flyer'), splitter: t('enemy.splitter'), priest: t('enemy.priest'), boss: t('enemy.boss'), mini: t('enemy.mini') };
const ELITE_ICON = { shield: '🛡', haste: '🌀', split: '✹' };
const BOSS_AFFIX_KEYS = ['resilient', 'armored', 'twin', 'rage'];
const LANDSCAPE_SIDEBAR_MIN = 360;
const LANDSCAPE_SIDEBAR_MAX = 430;
const BONUS_TOWER_LIMIT = 1;

export class GameScene extends Phaser.Scene {
  constructor() { super('Game'); }

  init(data = {}) {
    const requested = data.difficulty || this.registry.get('difficulty') || DEFAULT_DIFFICULTY;
    this.difficulty = DIFFICULTIES[requested] ? requested : DEFAULT_DIFFICULTY;
    this.registry.set('difficulty', this.difficulty);
  }

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
    this.waveEvent = null;
    this.spawnLeft = 0;
    this.dying = false;
    this.over = false;
    this.isPaused = false;
    this.pauseLayer = null;
    this.settingsOpen = false;
    this.settingsLayer = null;
    this.settingsPrevTimeScale = null;
    this.settingsPrevTweenScale = null;
    this.enemies = [];
    this.towers = [];
    this.nextTowerId = 1;
    this.burnZones = [];
    this.waveCombatTime = 0;
    this.waveTowerDamage = new Map();
    this.leakStats = {};
    this.dmgCount = 0;
    this.coinCount = 0;
    this.firstRunTutorial = (S.tutorialVersion || 0) < 1;
    this.tutorialStep = this.firstRunTutorial ? 'build' : null;
    this.tutorialElem = 'fire';
    this.tutorialTowerA = null;
    this.tutorialTowerB = null;
    this.tutorialText = null;
    this.tutorialHighlight = null;
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
    if (this.firstRunTutorial) this.startFirstRunTutorial();
    else this.startPrep();
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
    SLOT_YS.forEach((y, row) => {
      for (const x of SLOT_XS) {
        if (!this.hasBg) this.add.image(x, y, 'slot').setDepth(-10);
        const ring = this.add.circle(x, y + SLOT_RING_Y_OFFSETS[row], 46, 0xffe97a, 0)
          .setStrokeStyle(3, 0xffe97a, 0).setDepth(-9);
        this.slots.push({ x, y, tower: null, ring });
        this.slotRings.push(ring);
      }
    });
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

  buildUI() {
    this.layoutBg = this.add.rectangle(W / 2, H / 2, W, H, 0x12131f, 1).setDepth(-40);
    this.sidebarBg = this.add.rectangle(W / 2, H / 2, 1, 1, 0x161825, 0.94).setDepth(995).setVisible(false);
    this.sidebarDivider = this.add.rectangle(W / 2, H / 2, 2, H, 0x2d3348, 1).setDepth(996).setVisible(false);

    // 朴素状态栏：信息直接落在半透明条上，只用细分隔线组织层级。
    this.topBar = this.add.rectangle(W / 2, 36, W, 72, 0x0b1421, 0.88).setDepth(1000);
    this.topAccent = this.add.rectangle(W / 2, 71, W, 2, 0x65c9a5, 0.34).setDepth(1001);
    this.topSep1 = this.add.rectangle(166, 36, 1, 34, 0x9bb2c8, 0.16).setDepth(1001);
    this.topSep2 = this.add.rectangle(258, 36, 1, 34, 0x9bb2c8, 0.16).setDepth(1001);
    this.topSep3 = this.add.rectangle(412, 36, 1, 34, 0x9bb2c8, 0.16).setDepth(1001);
    this.topSep4 = this.add.rectangle(548, 36, 1, 34, 0x9bb2c8, 0.16).setDepth(1001);
    const pill = (x, y, w, h) => this.add.rectangle(x, y, w, h, 0x0b1421, 0).setDepth(1001);
    this.wavePill = pill(84, 36, 158, 44);
    this.heartPill = pill(210, 36, 84, 44);
    this.goldPill = pill(334, 36, 144, 44);
    this.diamondPill = pill(480, 36, 124, 44);
    this.waveIcon = this.add.image(24, 36, 'ui_icons', 'wave').setDepth(1002).setDisplaySize(30, 30);
    this.heartIcon = this.add.image(184, 36, 'ui_icons', 'heart').setDepth(1002).setDisplaySize(28, 28);
    this.coinIcon = this.add.image(278, 36, 'ui_icons', 'coin').setDepth(1002).setDisplaySize(30, 30);
    this.diamondIcon = this.add.image(426, 36, 'ui_icons', 'diamond').setDepth(1002).setDisplaySize(28, 28);
    this.waveText = this.uiText(45, 36, '', 17, '#ffffff').setOrigin(0, 0.5).setDepth(1003);
    this.heartText = this.uiText(203, 36, '', 20, '#ff9a9a').setOrigin(0, 0.5).setDepth(1003);
    this.goldText = this.uiText(299, 36, '0', 21, '#ffd66b').setOrigin(0, 0.5).setDepth(1003);
    this.diamondText = this.uiText(446, 36, '0', 20, '#9fe8ff').setOrigin(0, 0.5).setDepth(1003);
    const iconButton = (x, frame, onClick) => {
      const button = this.add.image(x, 36, 'ui_icons', frame)
        .setDepth(1003).setDisplaySize(32, 32).setInteractive({ useHandCursor: true });
      button.on('pointerdown', () => {
        unlockAudio();
        this.tweens.add({ targets: button, scale: 0.88, duration: 45, yoyo: true });
        onClick();
      });
      return button;
    };
    this.settingsBtn = iconButton(590, 'settings', () => this.openSettings());
    this.pauseBtn = iconButton(635, 'pause', () => this.openPause());
    this.muteBtn = iconButton(680, 'audio', () => {
      const nextMuted = !isMuted();
      if (!nextMuted) unlockAudio();
      setMuted(nextMuted);
      this.S.muted = isMuted(); writeSave(this.S);
      this.refreshHudMute();
      if (!isMuted()) startStageAudio(phaseFor(this.wave));
    });
    this.refreshHudMute();

    // Boss HUD：保留头像识别，只使用细框与扁平血条。
    this.bossBarFrame = this.add.rectangle(W / 2, 94, 620, 40, 0x0b1421, 0.8)
      .setStrokeStyle(1, 0x6d7d91, 0.38).setDepth(1000).setVisible(false);
    this.bossHudIcon = this.add.image(72, 94, 'ui_icons', 'boss').setDepth(1002).setDisplaySize(36, 36).setVisible(false);
    this.bossBarBg = this.add.rectangle(102, 94, 520, 12, 0x05080d, 0.92).setOrigin(0, 0.5).setDepth(1001).setVisible(false);
    this.bossBar = this.add.rectangle(104, 94, 516, 8, 0xc83a57).setOrigin(0, 0.5).setDepth(1002).setVisible(false);

    // 下一波预告
    this.previewBg = this.add.rectangle(W / 2, 104, 430, 48, 0x0b1421, 0.7)
      .setStrokeStyle(1, 0x7892aa, 0.22).setDepth(999).setVisible(false);
    this.previewText = this.uiText(W / 2, 104, '', 18, '#d7e2ed').setOrigin(0.5).setAlign('center');

    // 底部面板（背景图模式半透明，露出城堡）
    this.bottomPanel = this.add.rectangle(W / 2, 1197, W, 166, 0x0b1421, this.hasBg ? 0.84 : 0.94).setDepth(1000);
    this.bottomAccent = this.add.rectangle(W / 2, 1114, W, 2, 0x65c9a5, 0.35).setDepth(1001);

    // 提前召唤
    this.callBtn = makeHudButton(this, W / 2, 1012, 370, 58, t('game.call'), {
      simple: true, frame: 'button_primary', icon: 'play', iconSize: 30, fontSize: 18,
      onClick: () => this.startWave(true),
    }).setDepth(1002).setVisible(false);

    // 买塔（核心按钮）
    this.buyBtn = makeHudButton(this, 350, 1170, 326, 112, '', {
      simple: true, frame: 'button_primary', icon: 'build', iconSize: 48, iconX: -104, labelX: 30, fontSize: 25,
      onClick: () => this.buyTower(),
    }).setDepth(1002);
    this.buyPriceText = this.add.text(108, 0, '', {
      fontFamily: 'Arial, "Microsoft YaHei", sans-serif', fontSize: '29px',
      color: '#ffe47a', fontStyle: 'bold', stroke: '#142033', strokeThickness: 3,
    }).setOrigin(0.5);
    this.buyBtn.add(this.buyPriceText);

    // 回收区
    this.sellRect = new Phaser.Geom.Rectangle(18, 1114, 142, 112);
    this.sellSkin = this.add.rectangle(89, 1170, 142, 112, 0x3d2932, 0.92)
      .setStrokeStyle(1, 0x76505e, 0.9).setDepth(1001);
    this.sellZone = this.add.rectangle(89, 1170, 142, 112, 0xffffff, 0.001).setDepth(1003);
    this.sellIcon = this.add.image(89, 1148, 'ui_icons', 'recycle').setDepth(1002).setDisplaySize(38, 38);
    this.sellText = this.uiText(89, 1190, t('game.sell'), 18, '#ffe8ec').setOrigin(0.5).setDepth(1002);
    this.sellZone.setInteractive({ useHandCursor: true }).on('pointerdown', () => {
      toast(this, W / 2, this.sellZone.y - 90, t('game.sellHint'), '#ffd7df', 18, 2800);
    });

    // 广告送塔
    this.giftBtn = makeHudButton(this, 625, 1138, 158, 58, '', {
      simple: true, frame: 'button_secondary', icon: 'gift', iconSize: 30, iconX: -50, labelX: 18, fontSize: 14,
      onClick: () => this.adGiftTower(),
    }).setDepth(1002);

    // 2 倍速（局外解锁后显示）
    this.speedBtn = makeHudButton(this, 625, 1202, 158, 58, '', {
      simple: true, frame: 'button_secondary', icon: 'speed2x', iconSize: 30, iconX: -50, labelX: 18, fontSize: 18,
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
    const panelH = 166;
    const panelY = bottom - panelH / 2;
    const callY = bottom - 198;
    const actionY = bottom - 74;

    this.sidebarBg.setVisible(false);
    this.sidebarDivider.setVisible(false);
    this.bottomPanel.setVisible(true);
    this.bottomAccent.setVisible(true);
    for (const sep of [this.topSep1, this.topSep2, this.topSep3, this.topSep4]) sep.setVisible(true);

    this.setUiRect(this.topBar, W / 2, 36, W, 72);
    this.setUiRect(this.topAccent, W / 2, 71, W, 2);
    this.setUiRect(this.topSep1, 166, 36, 1, 34);
    this.setUiRect(this.topSep2, 258, 36, 1, 34);
    this.setUiRect(this.topSep3, 412, 36, 1, 34);
    this.setUiRect(this.topSep4, 548, 36, 1, 34);
    this.setUiRect(this.wavePill, 84, 36, 158, 44);
    this.setUiRect(this.heartPill, 210, 36, 84, 44);
    this.setUiRect(this.goldPill, 334, 36, 144, 44);
    this.setUiRect(this.diamondPill, 480, 36, 124, 44);
    this.setUi(this.waveIcon, 24, 36).setDisplaySize(30, 30);
    this.setUi(this.heartIcon, 184, 36).setDisplaySize(28, 28);
    this.setUi(this.coinIcon, 278, 36).setDisplaySize(30, 30);
    this.setUi(this.diamondIcon, 426, 36).setDisplaySize(28, 28);
    this.setUi(this.waveText, 45, 36).setOrigin(0, 0.5);
    this.setUi(this.heartText, 203, 36).setOrigin(0, 0.5);
    this.setUi(this.goldText, 299, 36).setOrigin(0, 0.5);
    this.setUi(this.diamondText, 446, 36).setOrigin(0, 0.5);
    this.waveText.setFontSize(17);
    this.heartText.setFontSize(21);
    this.goldText.setFontSize(22);
    this.diamondText.setFontSize(20);
    this.setUi(this.settingsBtn, 590, 36).setDisplaySize(32, 32);
    this.setUi(this.pauseBtn, 635, 36).setDisplaySize(32, 32);
    this.setUi(this.muteBtn, 680, 36).setDisplaySize(32, 32);

    this.bossBarMaxWidth = 516;
    this.setUiRect(this.bossBarFrame, W / 2, 94, 620, 40);
    this.setUi(this.bossHudIcon, 72, 94).setDisplaySize(36, 36);
    this.setUiRect(this.bossBarBg, 102, 94, 520, 12);
    this.bossBar.setPosition(this.layout.x(104), 94);
    this.bossBar.height = 8;
    this.setUiRect(this.previewBg, W / 2, 104, 430, 48);
    this.setUi(this.previewText, W / 2, 104).setOrigin(0.5).setFontSize(18);

    this.setUiRect(this.bottomPanel, W / 2, panelY, W, panelH);
    this.setUiRect(this.bottomAccent, W / 2, bottom - panelH + 1, W, 2);
    this.setUi(this.callBtn, W / 2, callY);
    this.setUi(this.buyBtn, 350, actionY).setScale(0.76);
    this.sellRect = new Phaser.Geom.Rectangle(24, actionY - 40, 104, 80);
    this.setUiRect(this.sellZone, 76, actionY, 104, 80);
    this.setUiRect(this.sellSkin, 76, actionY, 104, 80);
    this.setUi(this.sellIcon, 76, actionY - 15).setDisplaySize(38, 38);
    this.sellIconBaseScaleX = this.sellIcon.scaleX;
    this.sellIconBaseScaleY = this.sellIcon.scaleY;
    this.setUi(this.sellText, 76, actionY + 16).setOrigin(0.5).setFontSize(15);
    this.setUi(this.giftBtn, 625, bottom - 106).setScale(0.8);
    this.setUi(this.speedBtn, 625, bottom - 48).setScale(0.8);
    this.buyBtn.label.setFontSize(24);
    this.buyPriceText.setFontSize(25);
    this.callBtn.label.setFontSize(18);
    this.giftBtn.label.setFontSize(14);
    this.speedBtn.label.setFontSize(18);
  }

  applyLandscapeUI() {
    const { viewW, viewH, sidebarW, fieldAreaW } = this.layout;
    const sideCenter = fieldAreaW + sidebarW / 2;
    const sideLeft = fieldAreaW + 24;
    const sideRight = fieldAreaW + sidebarW - 24;

    this.sidebarBg.setVisible(true);
    this.sidebarDivider.setVisible(true);
    this.bottomPanel.setVisible(false);
    this.bottomAccent.setVisible(false);
    this.setUiRect(this.sidebarBg, sideCenter, viewH / 2, sidebarW, viewH);
    this.setUiRect(this.sidebarDivider, fieldAreaW, viewH / 2, 2, viewH);

    this.setUiRect(this.topBar, sideCenter, 68, sidebarW - 28, 124);
    this.setUiRect(this.topAccent, sideCenter, 130, sidebarW - 44, 2);
    this.setUiRect(this.wavePill, sideLeft + 66, 40, 132, 50);
    this.setUiRect(this.heartPill, sideLeft + 40, 101, 80, 48);
    this.setUiRect(this.goldPill, sideLeft + 142, 101, 116, 48);
    this.setUiRect(this.diamondPill, sideLeft + 270, 101, 120, 48);
    this.setUi(this.waveIcon, sideLeft + 20, 40).setDisplaySize(30, 30);
    this.setUi(this.heartIcon, sideLeft + 16, 101).setDisplaySize(28, 28);
    this.setUi(this.coinIcon, sideLeft + 102, 101).setDisplaySize(30, 30);
    this.setUi(this.diamondIcon, sideLeft + 228, 101).setDisplaySize(28, 28);
    this.setUi(this.waveText, sideLeft + 45, 40).setOrigin(0, 0.5);
    this.setUi(this.heartText, sideLeft + 39, 101).setOrigin(0, 0.5);
    this.setUi(this.goldText, sideLeft + 127, 101).setOrigin(0, 0.5);
    this.setUi(this.diamondText, sideLeft + 253, 101).setOrigin(0, 0.5);
    this.waveText.setFontSize(21);
    this.heartText.setFontSize(23);
    this.goldText.setFontSize(23);
    this.diamondText.setFontSize(21);
    this.setUi(this.muteBtn, sideRight - 18, 40);
    this.setUi(this.pauseBtn, sideRight - 60, 40);
    this.setUi(this.settingsBtn, sideRight - 102, 40);
    this.topSep1.setVisible(false);
    this.topSep2.setVisible(false);
    this.topSep3.setVisible(false);
    this.topSep4.setVisible(false);

    this.bossBarMaxWidth = sidebarW - 116;
    this.setUiRect(this.bossBarFrame, sideCenter, 158, sidebarW - 34, 40);
    this.setUi(this.bossHudIcon, sideLeft + 28, 158).setDisplaySize(36, 36);
    this.setUiRect(this.bossBarBg, sideLeft + 58, 158, this.bossBarMaxWidth + 4, 12);
    this.bossBar.setPosition(this.layout.x(sideLeft + 60), 158);
    this.bossBar.height = 8;
    this.setUiRect(this.previewBg, sideCenter, 190, sidebarW - 44, 52);
    this.setUi(this.previewText, sideCenter, 188).setOrigin(0.5).setFontSize(20);

    this.setUi(this.callBtn, sideCenter, 248);
    this.setUi(this.buyBtn, sideCenter, 348).setScale(1);

    const sellX = sideCenter;
    const sellY = 468;
    this.sellRect = new Phaser.Geom.Rectangle(this.layout.x(sellX - 71), sellY - 56, 142, 112);
    this.setUiRect(this.sellZone, sellX, sellY, 142, 112);
    this.setUiRect(this.sellSkin, sellX, sellY, 142, 112);
    this.setUi(this.sellIcon, sellX, sellY - 22).setDisplaySize(50, 50);
    this.sellIconBaseScaleX = this.sellIcon.scaleX;
    this.sellIconBaseScaleY = this.sellIcon.scaleY;
    this.setUi(this.sellText, sellX, sellY + 20).setOrigin(0.5).setFontSize(18);
    this.setUi(this.giftBtn, sideCenter, 558).setScale(1);
    this.setUi(this.speedBtn, sideCenter, 624).setScale(1);
    this.buyBtn.label.setFontSize(28);
    this.buyPriceText.setFontSize(29);
    this.callBtn.label.setFontSize(19);
    this.giftBtn.label.setFontSize(19);
    this.speedBtn.label.setFontSize(20);
  }

  uiText(x, y, str, size = 24, color = '#ffffff') {
    return this.add.text(x, y, str, {
      fontFamily: 'Arial, "Microsoft YaHei", sans-serif', fontSize: size + 'px',
      color, fontStyle: 'bold',
    }).setDepth(1001);
  }

  refreshHudMute() {
    if (!this.muteBtn) return;
    this.muteBtn.setAlpha(isMuted() ? 0.46 : 1);
    if (isMuted()) this.muteBtn.setTint(0x8f99a8);
    else this.muteBtn.clearTint();
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
    this.waveText.setText(`${this.wave} · ${DIFFICULTIES[this.difficulty].cn}`);
    this.heartText.setText(String(Math.max(0, this.baseHp)));
    if (this.goldRollTween && this.gold < this.displayGold) {
      this.goldRollTween.stop();
      this.goldRollTween = null;
    }
    if (!this.goldRollTween) this.displayGold = this.gold;
    this.goldText.setText(String(Math.floor(this.displayGold)));
    this.diamondText.setText(String(this.S.diamonds + this.diamondsRun));
    const cost = towerPrice(this.wave, this.waveBought);
    const isBuilding = !this.pendingTowerDraft && !this.towerChoiceLayer;
    if (this.pendingTowerDraft) this.buyBtn.label.setText(t('game.place'));
    else if (this.towerChoiceLayer) this.buyBtn.label.setText(t('game.choose'));
    else this.buyBtn.label.setText(t('game.build', { cost }).split('\n')[0]);
    this.buyBtn.label.setX(isBuilding ? 10 : 38);
    this.buyPriceText.setText(String(cost)).setVisible(isBuilding);
    const afford = !this.pendingTowerDraft && !this.towerChoiceLayer && this.gold >= cost && this.slots.some(s => !s.tower);
    this.buyBtn.setSkin(afford ? 'button_primary' : 'button_disabled');
    const giftLeft = BONUS_TOWER_LIMIT - this.adGifts;
    this.giftBtn.label.setText(`${Math.max(0, giftLeft)}/${BONUS_TOWER_LIMIT}`);
    this.giftBtn.setEnabled(giftLeft > 0);
    if (this.firstRunTutorial) {
      this.giftBtn.setEnabled(false);
      this.speedBtn.setEnabled(false);
    }
  }

  // ================= 开局预置 =================
  presetTowers() {
    if (this.firstRunTutorial) {
      const slot = this.slots[6];
      this.tutorialTowerA = new Tower(this, slot, this.tutorialElem, 1);
      slot.tower = this.tutorialTowerA;
      this.towers.push(this.tutorialTowerA);
      return;
    }
    const elems = unlockedElements(this.S, this.wave);
    const elem = Phaser.Utils.Array.GetRandom(elems);
    const a = this.slots[6], b = this.slots[7]; // 下排相邻两格
    a.tower = new Tower(this, a, elem, 1);
    b.tower = new Tower(this, b, elem, 1);
    this.towers.push(a.tower, b.tower);
  }

  startFirstRunTutorial() {
    this.waveState = 'tutorial';
    this.setTutorialInstruction('game.tutorialBuild', 970);
    this.clearTutorialHighlight();
    this.tutorialHighlight = this.add.rectangle(this.buyBtn.x, this.buyBtn.y, 352, 132, 0x65e6ae, 0.035)
      .setStrokeStyle(5, 0x74efb8, 0.95)
      .setDepth(2390);
    this.tweens.add({ targets: this.tutorialHighlight, scale: 1.06, alpha: 0.42, duration: 620, yoyo: true, repeat: -1 });
    this.buyBtn.setEnabled(true);
    this.giftBtn.setEnabled(false);
    this.speedBtn.setEnabled(false);
  }

  setTutorialInstruction(key, y = 970) {
    const x = this.layout?.landscape ? this.layout.x(this.layout.fieldCenterScreen) : W / 2;
    if (!this.tutorialBanner) {
      this.tutorialBanner = this.add.rectangle(x, y, 570, 58, 0x091522, 0.9)
        .setStrokeStyle(2, 0x6dd6ac, 0.7).setDepth(2380);
      this.tutorialText = this.uiText(x, y, '', 24, '#eaf8f2').setOrigin(0.5).setDepth(2381);
    }
    this.tutorialBanner.setPosition(x, y);
    this.tutorialText.setPosition(x, y).setText(t(key));
  }

  clearTutorialHighlight() {
    if (!this.tutorialHighlight) return;
    this.tweens.killTweensOf(this.tutorialHighlight);
    this.tutorialHighlight.destroy();
    this.tutorialHighlight = null;
  }

  startMergeTutorial(a, b) {
    this.tutorialStep = 'merge';
    this.tutorialTowerA = a;
    this.tutorialTowerB = b;
    a.setHighlight(true);
    b.setHighlight(true);
    this.setTutorialInstruction('game.tutorialMerge', 390);
    if (this.tutorialHand) this.tutorialHand.destroy();
    this.tutorialHand = this.uiText(a.slot.x, a.slot.y - 92, '👆', 42).setOrigin(0.5).setDepth(2395);
    this.tweens.add({
      targets: this.tutorialHand,
      x: b.slot.x,
      y: b.slot.y - 92,
      duration: 900,
      hold: 260,
      repeatDelay: 260,
      repeat: -1,
      ease: 'Sine.InOut',
    });
  }

  completeFirstRunTutorial(mergedTower) {
    this.firstRunTutorial = false;
    this.tutorialStep = null;
    this.S.tutorialDone = true;
    this.S.tutorialVersion = 1;
    writeSave(this.S);
    mergedTower.setHighlight(false);
    this.clearTutorialHighlight();
    if (this.tutorialHand) { this.tweens.killTweensOf(this.tutorialHand); this.tutorialHand.destroy(); this.tutorialHand = null; }
    if (this.tutorialBanner) { this.tutorialBanner.destroy(); this.tutorialBanner = null; }
    if (this.tutorialText) { this.tutorialText.destroy(); this.tutorialText = null; }
    toast(this, W / 2, 390, t('game.tutorialReady'), '#8ff0b6', 25);
    this.updateUI();
    this.startPrep();
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
    if (w >= ENEMY_TYPES.priest.from) pool.push(['priest', 12]);
    const total = pool.reduce((s, p) => s + p[1], 0);
    const n = Math.ceil(waveCount(w) * (this.waveEvent?.countMult || 1));
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

  pickWaveEvent(w) {
    if (w < WAVE_EVENTS.fromWave || w % 5 === 0 || Math.random() >= WAVE_EVENTS.chance) return null;
    const keys = ['swarm', 'armored', 'haste'];
    return WAVE_EVENTS[Phaser.Utils.Array.GetRandom(keys)];
  }

  startPrep() {
    if (this.over || this.dying) return;
    this.waveState = 'prep';
    this.waveEvent = this.pickWaveEvent(this.wave);
    this.pending = this.composeWave(this.wave);
    // 预告图标（去重）
    const icons = this.previewIcons(this.pending);
    const eventKey = this.waveEvent ? `waveEvent.${this.waveEvent.key}` : 'waveEvent.normal';
    this.previewText.setText(t('game.nextInfo', {
      wave: this.wave,
      count: this.pending.length,
      icons,
      event: t(eventKey),
    }));
    this.previewBg.setVisible(true);
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
    this.previewBg.setVisible(false);
    this.waveState = 'active';
    this.beginWaveDps();
    Sfx.wave();
    this.banner(t('game.waveOnly', { value: this.wave }));
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
    const spawnOpts = { ...opts, difficulty: this.difficulty };
    if (!t.boss) {
      const event = this.waveEvent;
      if (event) {
        spawnOpts.hpMult = (spawnOpts.hpMult || 1) * (event.hpMult || 1);
        spawnOpts.armorBonus = (spawnOpts.armorBonus || 0) + (event.armorBonus || 0);
        spawnOpts.speedMult = (spawnOpts.speedMult || 1) * (event.speedMult || 1);
      }
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

  async endWave() {
    this.waveState = 'idle';
    this.resonanceGoldMult = 1;
    this.waveBought = 0; // 波内价格热度重置
    this.holyHealThisWave = 0;
    // 利息（GDD §5.3：5%/档，单波上限 50×档）
    const it = tier(this.S, 'interest');
    if (it > 0) {
      const gain = Math.min(Math.floor(this.gold * 0.05 * it), 50 * it);
      if (gain > 0) { this.gold += gain; toast(this, 380, 200, t('game.interest', { value: gain }), '#ffd34e', 24); }
    }
    const finished = this.wave;
    this.wave++;
    if (this.wave === 6) {
      this.banner(t('game.venomUnlock'));
      toast(this, W / 2, 245, t('game.venomTip'), '#7ede55', 28);
    }
    if (this.wave === 11) {
      this.banner(t('game.lightUnlock'));
      toast(this, W / 2, 245, t('game.lightTip'), '#fff3c4', 28);
    }
    // 里程碑钻石
    if (finished % 10 === 0) {
      this.diamondsRun += DIAMOND.milestone;
      toast(this, W / 2, 300, t('game.reward', { value: DIAMOND.milestone }), '#9fe8ff', 32);
      Sfx.diamond();
    }
    // 阶段色调切换（GDD §2）
    const oldPh = phaseFor(finished), newPh = phaseFor(this.wave);
    if (oldPh !== newPh) {
      setAudioPhase(newPh, { accent: true });
      this.playPhaseShiftFx(newPh);
      this.banner(t('game.phase', { name: newPh.name }));
      const speedMult = nonBossSpeedMult(this.wave);
      if (speedMult > 1) {
        toast(this, W / 2, 250, t('game.minionSpeed', { value: Math.round((speedMult - 1) * 100) }), '#ffe97a', 28);
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
    if ([20, 30, 40].includes(finished)) await Poki.commercialBreak();
    if (this.over || this.dying) return;
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
      toast(this, e.x, e.y - 78, t('game.elite', { value: DIAMOND.elite }), '#9fe8ff', 28);
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
          o.applyPoison(src.dps, 2, false, src.sourceTower, {
            branchEffects: false,
            sourceBonus: src.sourceBonus || 0,
          });
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
    toast(this, target.x, target.y - 78, t('game.twin', { value: Math.round(healed) }), '#ffb199', 26);
    this.burst(target.x, target.y, 0xe84a5f, 18, 1);
  }

  onBossRage(e) {
    toast(this, e.x, e.y - 84, t('game.rage'), '#ff9b45', 30);
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
    if (this.firstRunTutorial && this.tutorialStep !== 'build') return false;
    const cost = towerPrice(this.wave, this.waveBought);
    if (this.gold < cost) { if (!silent) toast(this, this.buyBtn.x, this.buyBtn.y - 135, t('common.noGold'), '#ff8888', 24); return false; }
    const free = this.slots.filter(s => !s.tower);
    if (!free.length) { if (!silent) toast(this, this.buyBtn.x, this.buyBtn.y - 135, t('game.full'), '#ff8888', 24); return false; }
    const lv = this.firstRunTutorial ? 1 : this.rollSpawnLv();
    const choices = this.firstRunTutorial
      ? [{ elem: this.tutorialElem, branch: null }]
      : this.buildTowerChoices(lv);
    if (this.firstRunTutorial) {
      this.tutorialStep = 'choose';
      this.clearTutorialHighlight();
      this.setTutorialInstruction('game.tutorialChoose', 760);
    }
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
    const title = this.uiText(centerX, titleY, t('game.pickTower', { count: choices.length, level: lv, cost }), wide ? 22 : 24, '#ffe97a')
      .setOrigin(0.5);
    const cancel = makeButton(this, cancelX, cancelY, 82, 42, t('game.cancel'), {
      bg: 0x51586e,
      fontSize: 18,
      onClick: () => this.cancelTowerPurchase(),
    });
    if (this.firstRunTutorial) cancel.setVisible(false);
    layer.add([blocker, panel, title, cancel]);

    const portraitPositions = expanded
      ? choices.map((_, i) => ({ x: W / 2, y: 845 + i * 72 }))
      : (choices.length === 1
          ? [{ x: W / 2, y: 1020 }]
          : choices.length === 2
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
    if (this.firstRunTutorial) {
      this.tutorialStep = 'place';
      this.setTutorialInstruction('game.tutorialPlace', 390);
    }
    const hintX = this.layout.landscape ? this.layout.x(this.layout.fieldCenterScreen) : W / 2;
    const hintY = this.layout.landscape ? Math.min(1120, this.layout.viewH - 150) : 905;
    if (!this.firstRunTutorial) {
      this.placementHint = this.uiText(hintX, hintY, t('game.placeHint', { element: ELEMENTS[elem].cn, level: lv }), 26, this.hexColor(ELEMENTS[elem].color))
        .setOrigin(0.5)
        .setDepth(2450);
      this.placementHint.setStroke('#000000', 5);
    }
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
      toast(this, this.buyBtn.x, this.buyBtn.y - 135, t('common.noGold'), '#ff8888', 24);
      this.cancelTowerPurchase();
      return true;
    }
    this.gold -= draft.cost;
    this.bought++;
    this.waveBought++;
    const placedTower = this.placeTower(nearest, draft.elem, draft.lv, draft.branch);
    Sfx.buy();
    this.clearPendingTowerDraft();
    this.clearHint();
    if (this.firstRunTutorial && this.tutorialStep === 'place') {
      this.startMergeTutorial(this.tutorialTowerA, placedTower);
    }
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
    this.ensureWaveTowerStat(t);
    return t;
  }

  doMerge(a, b, opts = {}) {
    if (a.merging || b.merging) return;
    // b 的位置保留，产出 lv+1
    const slot = b.slot, elem = a.elem, lv = a.lv + 1;
    const branch = this.mergeBranchFor(a, b, lv, opts);
    const completesTutorial = this.firstRunTutorial && this.tutorialStep === 'merge'
      && ((a === this.tutorialTowerA && b === this.tutorialTowerB)
        || (a === this.tutorialTowerB && b === this.tutorialTowerA));
    const pop = () => {
      a.destroy(); b.destroy();
      const mergedTower = this.placeTower(slot, elem, lv, branch, { animate: false, scale: 0.22 });
      this.mergeWaveTowerStats(mergedTower, [a, b]);
      mergedTower.c.setAlpha(0.85);
      const resonance = this.registerMergeResonance(mergedTower, !!opts.auto);
      this.playMergePop(mergedTower, resonance, !!opts.auto);
      this.clearHint();
      // 里程碑质变提示（GDD §3.3）
      if (lv === 4 || lv === 7) toast(this, slot.x, slot.y - 90, tr('game.milestone'), '#ffe97a', 26);
      if (lv === 4 && !opts.auto) this.showEvolutionChoice(mergedTower);
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
      if (completesTutorial) this.completeFirstRunTutorial(mergedTower);
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

    if (elem === 'ice') this.playIceMergeAbsorbFx(a, b, tx, ty);

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

  openPause() {
    if (this.isPaused || this.over || this.dying) return;
    this.isPaused = true;
    this.time.timeScale = 0;
    this.tweens.timeScale = 0;
    this.ensureResponsiveLayout();
    const cx = this.layout.x(this.layout.viewW / 2), cy = this.layout.viewH / 2;
    const layer = this.add.container(0, 0).setDepth(7000);
    this.pauseLayer = layer;
    layer.add(this.add.rectangle(cx, cy, this.layout.viewW, this.layout.viewH, 0x070a12, 0.82).setInteractive());
    layer.add(this.add.rectangle(cx, cy, 500, 470, 0x182238, 0.98).setStrokeStyle(3, 0x668cb2));
    layer.add(this.add.text(cx, cy - 150, t('game.pauseTitle'), {
      fontFamily: 'Arial Black, "Microsoft YaHei", sans-serif', fontSize: '46px', color: '#fff0a6',
    }).setOrigin(0.5));
    layer.add(this.add.text(cx, cy - 92, t('game.pauseDesc'), {
      fontFamily: 'Arial, "Microsoft YaHei", sans-serif', fontSize: '22px', color: '#aebfd5',
    }).setOrigin(0.5));
    layer.add(makeButton(this, cx, cy + 5, 360, 82, t('game.resume'), {
      bg: 0x2e755b, stroke: 0x65d6a0, fontSize: 30, onClick: () => this.closePause(),
    }));
    layer.add(makeButton(this, cx, cy + 110, 360, 70, t('game.home'), {
      bg: 0x35445e, stroke: 0x667b9b, fontSize: 25, onClick: () => this.openExitConfirm(),
    }));
  }

  openExitConfirm() {
    if (this.exitConfirmLayer) return;
    const cx = this.layout.x(this.layout.viewW / 2), cy = this.layout.viewH / 2;
    const layer = this.add.container(0, 0).setDepth(7300);
    this.exitConfirmLayer = layer;
    layer.add(this.add.rectangle(cx, cy, this.layout.viewW, this.layout.viewH, 0x03050a, 0.72).setInteractive());
    layer.add(this.add.rectangle(cx, cy, 540, 380, 0x172033, 0.99).setStrokeStyle(3, 0xe06b70));
    layer.add(this.add.text(cx, cy - 125, t('game.exitTitle'), {
      fontFamily: 'Arial Black, "Microsoft YaHei", sans-serif', fontSize: '36px', color: '#ffb0b0',
    }).setOrigin(0.5));
    layer.add(this.add.text(cx, cy - 45, t('game.exitWarning'), {
      fontFamily: 'Arial, "Microsoft YaHei", sans-serif', fontSize: '22px', color: '#e7edf5',
      align: 'center', lineSpacing: 10,
    }).setOrigin(0.5));
    layer.add(makeButton(this, cx - 125, cy + 105, 220, 66, t('game.exitCancel'), {
      bg: 0x35445e, stroke: 0x7183a0, fontSize: 23, onClick: () => this.closeExitConfirm(),
    }));
    layer.add(makeButton(this, cx + 125, cy + 105, 220, 66, t('game.exitConfirm'), {
      bg: 0x783942, stroke: 0xe06b70, fontSize: 21, onClick: () => {
        this.time.timeScale = 1;
        this.tweens.timeScale = 1;
        this.scene.start('Menu');
      },
    }));
  }

  closeExitConfirm() {
    if (this.exitConfirmLayer) this.exitConfirmLayer.destroy();
    this.exitConfirmLayer = null;
  }

  closePause() {
    if (!this.isPaused) return;
    this.isPaused = false;
    if (this.pauseLayer) this.pauseLayer.destroy();
    this.pauseLayer = null;
    this.time.timeScale = this.speedMult;
    this.tweens.timeScale = this.speedMult;
  }

  settingsCenter() {
    this.ensureResponsiveLayout();
    return {
      x: this.layout.x(this.layout.viewW / 2),
      y: this.layout.viewH / 2,
      width: this.layout.viewW,
      height: this.layout.viewH,
    };
  }

  openSettings() {
    if (this.settingsOpen || this.isPaused || this.over || this.dying || this.evolutionChoiceOpen) return;
    this.settingsOpen = true;
    this.settingsPrevTimeScale = this.time.timeScale;
    this.settingsPrevTweenScale = this.tweens.timeScale;
    this.time.timeScale = 0;
    this.tweens.timeScale = 0;
    this.showSettingsPanel();
  }

  showSettingsPanel() {
    if (this.settingsLayer) this.settingsLayer.destroy();
    const { x, y, width, height } = this.settingsCenter();
    const layer = this.add.container(0, 0).setDepth(7100);
    this.settingsLayer = layer;
    layer.add(this.add.rectangle(x, y, width, height, 0x050912, 0.82).setInteractive());
    layer.add(this.add.rectangle(x, y, 620, 720, 0x111d2e, 0.98).setStrokeStyle(2, 0x6585a2, 0.8));
    // 提审/真机测试入口：设置卡片左上角 2 秒内连点 7 次触发一次插屏。
    let secretAdTaps = 0;
    let secretAdDeadline = 0;
    let secretAdRunning = false;
    const secretAdHotspot = this.add.rectangle(x - 275, y - 315, 70, 70, 0x000000, 0.001).setInteractive();
    secretAdHotspot.on('pointerdown', async () => {
      const now = Date.now();
      if (now > secretAdDeadline) secretAdTaps = 0;
      secretAdDeadline = now + 2000;
      secretAdTaps++;
      if (secretAdTaps < 7 || secretAdRunning) return;
      secretAdTaps = 0;
      secretAdRunning = true;
      try { await Poki.commercialBreak(); }
      finally { secretAdRunning = false; }
    });
    layer.add(secretAdHotspot);
    layer.add(this.add.text(x, y - 310, t('settings.title'), {
      fontFamily: 'Arial Black, "Microsoft YaHei", sans-serif', fontSize: '42px', color: '#f5e9a7',
    }).setOrigin(0.5));
    layer.add(this.add.text(x, y - 250, t('settings.language'), {
      fontFamily: 'Arial, "Microsoft YaHei", sans-serif', fontSize: '21px', color: '#8fa5bb', fontStyle: 'bold',
    }).setOrigin(0.5));

    const current = getLocale();
    const chooseLanguage = locale => {
      if (locale === current) return;
      setLocale(locale);
      this.time.timeScale = 1;
      this.tweens.timeScale = 1;
      window.location.reload();
    };
    LOCALES.forEach((locale, index) => {
      const col = index % 3;
      const row = Math.floor(index / 3);
      layer.add(makeButton(this, x + (col - 1) * 190, y - 195 + row * 58, 176, 48, locale.label, {
        bg: current === locale.code ? 0x24624f : 0x2b374a,
        stroke: current === locale.code ? 0x65d6a0 : 0x53677f,
        fontSize: locale.label.length > 14 ? 14 : 17,
        onClick: () => chooseLanguage(locale.code),
      }));
    });
    layer.add(this.add.text(x, y + 42, t('settings.restart'), {
      fontFamily: 'Arial, "Microsoft YaHei", sans-serif', fontSize: '16px', color: '#65798e',
    }).setOrigin(0.5));

    layer.add(makeButton(this, x, y + 120, 486, 76, t('settings.help'), {
      bg: 0x273f59, stroke: 0x5f8bb0, fontSize: 29,
      onClick: () => this.showTowerCodex(),
    }));
    layer.add(this.add.text(x, y + 168, t('settings.helpDesc'), {
      fontFamily: 'Arial, "Microsoft YaHei", sans-serif', fontSize: '16px', color: '#7890a8',
    }).setOrigin(0.5));
    layer.add(makeButton(this, x, y + 265, 320, 60, t('common.close'), {
      bg: 0x3a4558, stroke: 0x65748b, fontSize: 24,
      onClick: () => this.closeSettings(),
    }));
  }

  showTowerCodex() {
    if (this.settingsLayer) this.settingsLayer.destroy();
    const { x, y, width, height } = this.settingsCenter();
    const layer = this.add.container(0, 0).setDepth(7150);
    this.settingsLayer = layer;
    layer.add(this.add.rectangle(x, y, width, height, 0x050912, 0.9).setInteractive());
    layer.add(this.add.rectangle(x, y, 664, 1180, 0x0e1929, 0.99).setStrokeStyle(2, 0x6585a2, 0.8));
    layer.add(this.add.text(x, 92, t('settings.codexTitle'), {
      fontFamily: 'Arial Black, "Microsoft YaHei", sans-serif', fontSize: '38px', color: '#f5e9a7',
    }).setOrigin(0.5));
    layer.add(this.add.text(x, 132, t('settings.codexHint'), {
      fontFamily: 'Arial, "Microsoft YaHei", sans-serif', fontSize: '15px', color: '#7890a8', fontStyle: 'bold',
    }).setOrigin(0.5));
    layer.add(makeButton(this, x - 284, 58, 112, 48, t('common.back'), {
      bg: 0x2b374a, stroke: 0x53677f, fontSize: 18,
      onClick: () => this.showSettingsPanel(),
    }));

    Object.keys(ELEMENTS).forEach((elem, index) => {
      const def = ELEMENTS[elem];
      const branches = TOWER_BRANCHES[elem];
      const rowY = 246 + index * 190;
      const row = this.add.rectangle(x, rowY, 610, 178, def.color, 0.055).setStrokeStyle(1, def.color, 0.35);
      const icon = fitTowerImageHeight(addTowerImage(this, x - 270, rowY - 38, elem, 4, 'a'), 74);
      const name = this.add.text(x - 218, rowY - 75, def.cn, {
        fontFamily: 'Arial Black, "Microsoft YaHei", sans-serif', fontSize: '22px', color: this.hexColor(def.color),
      }).setOrigin(0, 0.5);
      const base = this.add.text(x - 218, rowY - 49, t('settings.stats', {
        role: def.desc,
        lv1: Math.round(towerDmg(elem, 1)),
        lv4: Math.round(towerDmg(elem, 4)),
        lv7: Math.round(towerDmg(elem, 7)),
        rate: Number(def.rate.toFixed(1)),
        range: Math.round(towerRange(1) * (elem === 'ice' || elem === 'poison' ? 1.1 : 1)),
      }), {
        fontFamily: 'Arial, "Microsoft YaHei", sans-serif', fontSize: '13px', color: '#a9bbcc', fontStyle: 'bold',
      }).setOrigin(0, 0.5);
      const pathA4 = this.add.text(x - 218, rowY - 18, t(`codex.${elem}.a4`, { name: branches.a.cn }), {
        fontFamily: 'Arial, "Microsoft YaHei", sans-serif', fontSize: '13px', color: '#e0e7ef',
        wordWrap: { width: 500 },
      }).setOrigin(0, 0.5);
      const pathA7 = this.add.text(x - 218, rowY + 11, t(`codex.${elem}.a7`), {
        fontFamily: 'Arial, "Microsoft YaHei", sans-serif', fontSize: '13px', color: '#8fd9bd',
        wordWrap: { width: 500 },
      }).setOrigin(0, 0.5);
      const pathB4 = this.add.text(x - 218, rowY + 40, t(`codex.${elem}.b4`, { name: branches.b.cn }), {
        fontFamily: 'Arial, "Microsoft YaHei", sans-serif', fontSize: '13px', color: '#e0e7ef',
        wordWrap: { width: 500 },
      }).setOrigin(0, 0.5);
      const pathB7 = this.add.text(x - 218, rowY + 69, t(`codex.${elem}.b7`), {
        fontFamily: 'Arial, "Microsoft YaHei", sans-serif', fontSize: '13px', color: '#8fd9bd',
        wordWrap: { width: 500 },
      }).setOrigin(0, 0.5);
      layer.add([row, icon, name, base, pathA4, pathA7, pathB4, pathB7]);
    });

    const eliteTitle = this.add.text(x - 294, 1108, t('codex.elite.title'), {
      fontFamily: 'Arial Black, "Microsoft YaHei", sans-serif', fontSize: '16px', color: '#7fe7e0',
    });
    const eliteHaste = this.add.text(x - 294, 1134, t('codex.elite.haste'), {
      fontFamily: 'Arial, "Microsoft YaHei", sans-serif', fontSize: '13px', color: '#b8cbd8',
      wordWrap: { width: 588 },
    });
    layer.add([eliteTitle, eliteHaste]);
  }

  closeSettings() {
    if (!this.settingsOpen) return;
    this.settingsOpen = false;
    if (this.settingsLayer) this.settingsLayer.destroy();
    this.settingsLayer = null;
    this.time.timeScale = this.settingsPrevTimeScale ?? this.speedMult;
    this.tweens.timeScale = this.settingsPrevTweenScale ?? this.speedMult;
    this.settingsPrevTimeScale = null;
    this.settingsPrevTweenScale = null;
  }

  playIceMergeAbsorbFx(a, b, x, y) {
    const pullRing = this.add.circle(x, y - 18, 58, 0x8ee7ff, 0.05)
      .setStrokeStyle(4, 0xcff6ff, 0.78)
      .setScale(1.15)
      .setDepth(2699);
    this.tweens.add({
      targets: pullRing,
      scale: 0.12,
      alpha: 0,
      duration: 150,
      ease: 'Quad.In',
      onComplete: () => pullRing.destroy(),
    });

    const origins = [
      { x: a.slot.x, y: a.slot.y - 28 },
      { x: b.slot.x, y: b.slot.y - 28 },
    ];
    for (let i = 0; i < 12; i++) {
      const origin = origins[i % origins.length];
      const shard = this.add.image(
        origin.x + Phaser.Math.Between(-24, 24),
        origin.y + Phaser.Math.Between(-22, 22),
        i % 3 === 0 ? 'ice_mote' : 'ice_shard',
      )
        .setAlpha(0.9)
        .setScale(i % 3 === 0 ? 0.62 : Phaser.Math.FloatBetween(0.18, 0.34))
        .setAngle(Phaser.Math.Between(-70, 70))
        .setDepth(2702 + i);
      this.tweens.add({
        targets: shard,
        x: x + Phaser.Math.Between(-7, 7),
        y: y - 18 + Phaser.Math.Between(-7, 7),
        scale: 0.04,
        angle: shard.angle + Phaser.Math.Between(90, 210),
        alpha: 0,
        delay: i * 4,
        duration: Phaser.Math.Between(115, 155),
        ease: 'Cubic.In',
        onComplete: () => shard.destroy(),
      });
    }
  }

  playMergePop(t, resonance, auto) {
    const color = t.color;
    const x = t.slot.x;
    const y = t.slot.y - 24;
    // —— 合成爆点（GDD §6.1）——
    t.c.setDepth(t.slot.y + 220);
    if (t.elem === 'ice') this.playIceMergeBurstFx(x, y, t.lv, resonance.chain, auto);
    else this.mergeBurst(x, y, color, t.lv);
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

  playIceMergeBurstFx(x, y, lv, chain = 1, auto = false) {
    const power = Phaser.Math.Clamp(0.9 + lv * 0.08 + (chain - 1) * 0.06, 0.9, 1.55);
    const density = auto ? 0.62 : 1;

    const floorFrost = this.add.ellipse(x, y + 24, 112 * power, 38 * power, 0x69d7ff, 0.24)
      .setStrokeStyle(3, 0xdaf8ff, 0.72)
      .setScale(0.18)
      .setDepth(2338);
    this.tweens.add({
      targets: floorFrost,
      scaleX: 1.18,
      scaleY: 1,
      alpha: 0,
      duration: 520,
      ease: 'Cubic.Out',
      onComplete: () => floorFrost.destroy(),
    });

    const flash = this.add.image(x, y, 'glow')
      .setTint(0xf4fdff)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setAlpha(auto ? 0.58 : 0.9)
      .setScale(0.18 * power)
      .setDepth(2351);
    this.tweens.add({
      targets: flash,
      scale: 1.65 * power,
      alpha: 0,
      duration: 210,
      ease: 'Quad.Out',
      onComplete: () => flash.destroy(),
    });

    const outerRing = this.add.circle(x, y, 28, 0x74dfff, 0.02)
      .setStrokeStyle(6, 0x74dfff, auto ? 0.48 : 0.84)
      .setScale(0.2)
      .setDepth(2348);
    const innerRing = this.add.circle(x, y, 22, 0xffffff, 0)
      .setStrokeStyle(2, 0xffffff, auto ? 0.48 : 0.9)
      .setScale(0.2)
      .setDepth(2349);
    this.tweens.add({
      targets: outerRing,
      scale: 2.65 * power,
      alpha: 0,
      duration: 430,
      ease: 'Cubic.Out',
      onComplete: () => outerRing.destroy(),
    });
    this.tweens.add({
      targets: innerRing,
      scale: 3.05 * power,
      alpha: 0,
      delay: 35,
      duration: 310,
      ease: 'Cubic.Out',
      onComplete: () => innerRing.destroy(),
    });

    const shards = this.add.particles(x, y, 'ice_shard', {
      angle: { min: 200, max: 340 },
      speed: { min: 120 * power, max: 285 * power },
      gravityY: 330,
      rotate: { min: -120, max: 120 },
      scale: { start: 0.5 * power, end: 0.08 },
      alpha: { start: 1, end: 0 },
      lifespan: { min: 480, max: 720 },
      emitting: false,
    }).setDepth(2352);
    shards.explode(Math.round((12 + lv * 2) * density));
    this.time.delayedCall(820, () => shards.destroy());

    const motes = this.add.particles(x, y, 'ice_mote', {
      angle: { min: 0, max: 360 },
      speed: { min: 45, max: 155 * power },
      rotate: { min: -90, max: 90 },
      scale: { start: 0.72 * power, end: 0.16 },
      alpha: { start: 0.95, end: 0 },
      lifespan: { min: 520, max: 820 },
      emitting: false,
    }).setDepth(2353);
    motes.explode(Math.round((9 + chain * 3) * density));
    this.time.delayedCall(920, () => motes.destroy());

    for (let i = 0; i < (auto ? 2 : 4); i++) {
      const mistScale = power * Phaser.Math.FloatBetween(0.35, 0.58);
      const mist = this.add.image(
        x + Phaser.Math.Between(-30, 30),
        y + Phaser.Math.Between(-10, 16),
        'smoke_puff',
      )
        .setTint(i % 2 ? 0x8edfff : 0xd9f7ff)
        .setAlpha(0.24)
        .setScale(mistScale)
        .setDepth(2342 + i);
      this.tweens.add({
        targets: mist,
        x: mist.x + Phaser.Math.Between(-24, 24),
        y: mist.y - Phaser.Math.Between(20, 42),
        scale: mistScale * Phaser.Math.FloatBetween(1.5, 1.9),
        alpha: 0,
        duration: Phaser.Math.Between(520, 720),
        ease: 'Sine.Out',
        onComplete: () => mist.destroy(),
      });
    }
  }

  mergeBranchFor(a, b, lv, opts = {}) {
    if (lv < 4) return null;
    if (lv === 4) return opts.auto ? 'a' : null;
    return b.branch || a.branch || 'a';
  }

  showEvolutionChoice(tower) {
    if (this.evolutionLayer) this.evolutionLayer.destroy();
    this.evolutionChoiceOpen = true;
    this.slowmoT = Math.max(this.slowmoT, 0.5);
    this.evolutionPrevTimeScale = this.time.timeScale;
    this.evolutionPrevTweenScale = this.tweens.timeScale;
    this.time.timeScale = this.speedMult * 0.5;
    this.tweens.timeScale = this.speedMult * 0.5;

    const defs = TOWER_BRANCHES[tower.elem];
    const layer = this.add.container(0, 0).setDepth(4100);
    this.evolutionLayer = layer;
    layer.add(this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.68).setInteractive());

    const title = this.uiText(W / 2, 420, t('game.evolve', { element: ELEMENTS[tower.elem].cn }), 42, '#ffffff').setOrigin(0.5);
    title.setStroke('#000000', 8);
    layer.add(title);

    const choose = branch => {
      if (!this.evolutionChoiceOpen) return;
      tower.setBranch(branch);
      this.resumeEvolutionChoice();
      this.evolutionChoiceOpen = false;
      this.evolutionLayer = null;
      layer.destroy();
      const def = defs[branch];
      toast(this, tower.slot.x, tower.slot.y - 110, t('game.branch', { name: def.cn }), this.hexColor(tower.color), 28);
      this.burst(tower.slot.x, tower.slot.y - 26, tower.color, 18, 1.1);
    };

    const addCard = (x, branch) => {
      const def = defs[branch];
      const card = this.add.rectangle(x, 615, 270, 270, 0x1e2233, 0.96)
        .setStrokeStyle(3, tower.color, 0.92)
        .setInteractive({ useHandCursor: true });
      const icon = fitTowerImageHeight(addTowerImage(this, x, 520, tower.elem, tower.lv, branch), 112).setDepth(4101);
      const badge = this.add.circle(x - 100, 500, 21, tower.color, 0.36).setStrokeStyle(2, tower.color, 0.95);
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
      const pick = this.uiText(x, 725, t('game.select'), 24, '#ffffff').setOrigin(0.5);
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
      this.banner(tr('game.resonance'));
      this.applyGlobalResonanceSlow(t.color);
      Sfx.resonance(chain);
    } else if (chain === 5) {
      this.banner(tr('game.resonanceGift'));
      this.grantResonanceTower(t);
      this.cameras.main.shake(180, 0.004);
      Sfx.resonance(chain);
    } else if (chain === 7) {
      this.resonanceGoldMult = Math.max(this.resonanceGoldMult, 2);
      this.banner(tr('game.goldResonance'));
      toast(this, t.slot.x, t.slot.y - 120, tr('game.waveGold'), '#ffd34e', 28);
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
      toast(this, src.slot.x, src.slot.y - 120, t('game.slotsFull'), '#ff8888', 24);
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
    if (t.elem === 'ice') {
      this.playIceSurgeOriginFx(x, y, t.range, auto);
    } else {
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
    }
    Sfx.surge();

    if (t.elem === 'fire') this.surgeFire(t, multiplier);
    else if (t.elem === 'ice') this.surgeIce(t, multiplier, auto);
    else if (t.elem === 'lightning') this.surgeLightning(t, multiplier);
    else if (t.elem === 'poison') this.surgePoison(t, multiplier);
    else if (t.elem === 'light') this.surgeLight(t, multiplier);
  }

  playIceSurgeOriginFx(x, y, range, auto = false) {
    const radiusScale = Math.max(1.4, range / 74);
    const outerRing = this.add.circle(x, y, 74, 0x62d7ff, auto ? 0.025 : 0.06)
      .setStrokeStyle(auto ? 3 : 6, 0x62d7ff, auto ? 0.34 : 0.76)
      .setScale(0.16)
      .setDepth(2140);
    const innerRing = this.add.circle(x, y, 61, 0xffffff, 0)
      .setStrokeStyle(auto ? 1 : 2, 0xecfbff, auto ? 0.34 : 0.72)
      .setScale(0.16)
      .setDepth(2141);
    this.tweens.add({
      targets: outerRing,
      scale: radiusScale,
      alpha: 0,
      duration: auto ? 430 : 560,
      ease: 'Cubic.Out',
      onComplete: () => outerRing.destroy(),
    });
    this.tweens.add({
      targets: innerRing,
      scale: radiusScale * 1.12,
      alpha: 0,
      delay: 32,
      duration: auto ? 360 : 470,
      ease: 'Cubic.Out',
      onComplete: () => innerRing.destroy(),
    });

    const moteCount = auto ? 5 : 9;
    for (let i = 0; i < moteCount; i++) {
      const theta = (i / moteCount) * Math.PI * 2 - Math.PI / 2;
      const mote = this.add.image(x, y - 14, i % 3 === 0 ? 'ice_shard' : 'ice_mote')
        .setAlpha(auto ? 0.58 : 0.92)
        .setScale(i % 3 === 0 ? 0.28 : 0.68)
        .setAngle(Phaser.Math.RadToDeg(theta) + 90)
        .setDepth(2143 + i);
      this.tweens.add({
        targets: mote,
        x: x + Math.cos(theta) * range * Phaser.Math.FloatBetween(0.32, 0.54),
        y: y - 14 + Math.sin(theta) * range * Phaser.Math.FloatBetween(0.18, 0.32),
        scale: 0.08,
        alpha: 0,
        duration: auto ? 350 : 470,
        ease: 'Cubic.Out',
        onComplete: () => mote.destroy(),
      });
    }
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
          sourceTower: t,
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

    const embers = this.add.particles(0, 0, 'fire_ember', {
      angle: { min: 235, max: 305 },
      speed: { min: 24, max: 72 },
      gravityY: -18,
      rotate: { min: -45, max: 45 },
      scale: { start: 0.52, end: 0.05 },
      alpha: { start: 0.9, end: 0 },
      lifespan: { min: 380, max: 680 },
      blendMode: Phaser.BlendModes.ADD,
      emitting: false,
    }).setDepth(2072);
    const stride = Math.max(1, Math.floor(points.length / 22));
    for (let i = 0; i < points.length; i += stride) {
      embers.emitParticleAt(points[i].x, points[i].y - Phaser.Math.Between(0, 8), 1);
    }
    this.time.delayedCall(760, () => embers.destroy());
  }

  surgeIce(t, multiplier, auto = false) {
    const ground = this.enemies.filter(e => !e.dead && !e.flying);
    const center = ground.length ? Math.max(...ground.map(e => e.progress)) : this.path.total * 0.65;
    const span = 180 + t.lv * 18;
    const duration = (1 + 0.2 * t.lv) * multiplier;
    const pts = [];

    for (let d = Math.max(0, center - span); d <= Math.min(this.path.total, center + span); d += 42) {
      pts.push(this.path.pointAt(d));
    }

    if (pts.length > 1) this.playIcePathFreezeFx(pts, t.lv, auto);

    for (const e of ground) {
      if (Math.abs(e.progress - center) > span) continue;
      if (e.applyFreeze(duration)) this.showDmg(e.x, e.y - 42, tr('game.freeze'), '#bfe8ff');
    }
    Sfx.freeze();
  }

  playIcePathFreezeFx(points, lv, auto = false) {
    const vectors = points.map(p => new Phaser.Math.Vector2(p.x, p.y));
    const pathIce = this.add.graphics().setDepth(2128);
    pathIce.lineStyle(auto ? 16 : 24, 0x237fab, auto ? 0.1 : 0.16);
    pathIce.strokePoints(vectors, false);
    pathIce.lineStyle(auto ? 9 : 14, 0x60d7ff, auto ? 0.18 : 0.3);
    pathIce.strokePoints(vectors, false);
    pathIce.lineStyle(auto ? 2 : 4, 0xf2fdff, auto ? 0.42 : 0.72);
    pathIce.strokePoints(vectors, false);
    this.tweens.add({
      targets: pathIce,
      alpha: 0,
      duration: auto ? 480 : 680,
      ease: 'Sine.Out',
      onComplete: () => pathIce.destroy(),
    });

    const motes = this.add.particles(0, 0, 'ice_mote', {
      angle: { min: 225, max: 315 },
      speed: { min: 18, max: 62 },
      rotate: { min: -90, max: 90 },
      scale: { start: auto ? 0.42 : 0.58, end: 0.08 },
      alpha: { start: auto ? 0.6 : 0.9, end: 0 },
      lifespan: { min: 420, max: 720 },
      emitting: false,
    }).setDepth(2136);
    const moteStride = Math.max(1, Math.floor(points.length / (auto ? 8 : 16)));
    for (let i = 0; i < points.length; i += moteStride) {
      motes.emitParticleAt(points[i].x, points[i].y - Phaser.Math.Between(0, 8), auto ? 1 : 2);
    }
    this.time.delayedCall(840, () => motes.destroy());

    const crystalStride = Math.max(1, Math.floor(points.length / (auto ? 6 : 11)));
    let visibleIndex = 0;
    for (let i = 0; i < points.length; i += crystalStride) {
      const p = points[i];
      const order = visibleIndex++;
      this.time.delayedCall(order * (auto ? 18 : 26), () => {
        if (this.over) return;
        const shardScale = Phaser.Math.FloatBetween(0.38, 0.62) * (1 + Math.min(lv, 8) * 0.025);
        const shard = this.add.image(p.x, p.y + 8, 'ice_shard')
          .setOrigin(0.5, 0.86)
          .setAlpha(0.18)
          .setScale(0.06)
          .setAngle(Phaser.Math.Between(-24, 24))
          .setDepth(2134 + order);
        this.tweens.add({
          targets: shard,
          y: p.y - Phaser.Math.Between(4, 13),
          alpha: auto ? 0.62 : 0.94,
          scaleX: shardScale * Phaser.Math.FloatBetween(0.78, 1),
          scaleY: shardScale * Phaser.Math.FloatBetween(1, 1.3),
          duration: auto ? 120 : 155,
          ease: 'Back.Out',
          onComplete: () => {
            this.tweens.add({
              targets: shard,
              y: shard.y + 5,
              alpha: 0,
              scaleY: shard.scaleY * 0.72,
              delay: auto ? 90 : 170,
              duration: auto ? 190 : 270,
              ease: 'Sine.In',
              onComplete: () => shard.destroy(),
            });
          },
        });

        if (!auto && order % 3 === 1) {
          const mistScale = Phaser.Math.FloatBetween(0.22, 0.34);
          const mist = this.add.image(p.x, p.y + 4, 'smoke_puff')
            .setTint(0xa8ebff)
            .setAlpha(0.18)
            .setScale(mistScale)
            .setDepth(2130);
          this.tweens.add({
            targets: mist,
            y: mist.y - 18,
            scale: mistScale * 1.75,
            alpha: 0,
            duration: 480,
            ease: 'Sine.Out',
            onComplete: () => mist.destroy(),
          });
        }
      });
    }
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
      const sourceOwner = this.towerLineageOwner(t);
      const aliveStacks = e.poisons.filter(p =>
        p.t > 0 && this.towerLineageOwner(p.sourceTower) === sourceOwner
      ).length;
      e.applyPoison(t.dmg * multiplier * this.plagueDamageMult(t), aliveStacks + 1, false, t, { branchEffects: false });
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
          this.showDmg(e.x, e.y - 54, tr('game.execute'), '#fff8dc');
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
      toast(this, t.slot.x, t.slot.y - 110, tr('game.radianceGuard'), '#fff8dc', 24);
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
    const stat = this.waveTowerDamage.get(t.id);
    if (stat) stat.sold = true;
    t.slot.tower = null;
    this.towers = this.towers.filter(x => x !== t);
    this.burst(t.slot.x, t.slot.y - 20, 0xff9aa8, 10, 0.8);
    t.destroy();
    Sfx.sell();
    toast(this, this.sellZone.x, this.sellZone.y - 110, `+${refund}💰`, '#ffd34e', 26);
    this.updateUI();
  }

  async adGiftTower() {
    if (this.adGifts >= BONUS_TOWER_LIMIT) return;
    const free = this.slots.filter(s => !s.tower);
    if (!free.length) { toast(this, this.giftBtn.x, this.giftBtn.y - 84, t('game.slotsFull'), '#ff8888', 22); return; }
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
    if (this.firstRunTutorial || !tier(this.S, 'autoBuy') || this.over || this.dying || this.evolutionChoiceOpen || this.editorMode) return;
    this.buyTower(true);
  }

  autoMergeTick() {
    if (this.firstRunTutorial || !tier(this.S, 'autoMerge') || this.over || this.dying || this.evolutionChoiceOpen || this.editorMode) return;
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
    this.speedBtn.label.setText(this.runSpeedUnlocked ? `x${this.speedMult}` : 'x2');
  }

  async toggleSpeed() {
    if (!this.runSpeedUnlocked) {
      const ok = await Poki.rewardedBreak();
      if (!ok) return;
      this.runSpeedUnlocked = true;
      toast(this, this.speedBtn.x, this.speedBtn.y - 70, t('game.speedUnlock'), '#9fe8ff', 22);
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
      if (this.firstRunTutorial && (this.tutorialStep !== 'merge'
        || (t !== this.tutorialTowerA && t !== this.tutorialTowerB))) {
        obj.tutorialDragAllowed = false;
        return;
      }
      obj.tutorialDragAllowed = true;
      t.dragging = true;
      t.setDraggingVisual(true);
      obj.setDepth(2600);
      this.rangeCircle.setPosition(t.slot.x, t.slot.y).setRadius(t.range).setVisible(true);
      this.sellZone.setScale(1.06);
      this.sellSkin.setTint(0xffa4b2).setScale(1.06);
      this.sellIcon.setScale(this.sellIconBaseScaleX * 1.06, this.sellIconBaseScaleY * 1.06);
      this.showFreeSlots(true);
      // 高亮可合成目标
      for (const o of this.towers) {
        if (o !== t && o.elem === t.elem && o.lv === t.lv && t.lv < MAX_LV) o.setHighlight(true);
      }
    });

    this.input.on('drag', (pointer, obj, dragX, dragY) => {
      if (!obj.towerRef) return;
      if (this.firstRunTutorial && !obj.tutorialDragAllowed) return;
      obj.setPosition(pointer.worldX ?? dragX, pointer.worldY ?? dragY);
    });

    this.input.on('dragend', (pointer, obj) => {
      const t = obj.towerRef;
      if (!t) return;
      if (this.firstRunTutorial && !obj.tutorialDragAllowed) {
        t.moveTo(t.slot);
        return;
      }
      t.dragging = false;
      t.setDraggingVisual(false);
      this.rangeCircle.setVisible(false);
      this.sellZone.setScale(1);
      this.sellSkin.clearTint().setScale(1);
      this.sellIcon.setScale(this.sellIconBaseScaleX, this.sellIconBaseScaleY);
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
        const source = t.slot;
        const other = nearest.tower;
        source.tower = other;
        nearest.tower = t;
        other.moveTo(source);
        t.moveTo(nearest);
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
    const cellSize = ELITE.hasteCellSize;
    const enemyCol = Math.floor(enemy.x / cellSize);
    const enemyRow = Math.floor(enemy.y / cellSize);
    for (const e of this.enemies) {
      if (e.dead || e.eliteAffix !== 'haste') continue;
      const hasteCol = Math.floor(e.x / cellSize);
      const hasteRow = Math.floor(e.y / cellSize);
      if (Math.abs(hasteCol - enemyCol) <= 1 && Math.abs(hasteRow - enemyRow) <= 1) {
        return ELITE.auraSpeedMult;
      }
    }
    return 1;
  }

  updateEnemySupport(dts) {
    for (const priest of this.enemies) {
      if (priest.dead || !priest.type.healer) continue;
      priest.supportHealCooldown = (priest.supportHealCooldown ?? 1.5) - dts;
      if (priest.supportHealCooldown > 0) continue;
      priest.supportHealCooldown = 3;

      let target = null;
      let lowestRatio = 1;
      for (const enemy of this.enemies) {
        if (enemy.dead || enemy.hp >= enemy.maxHp) continue;
        if (Phaser.Math.Distance.Between(priest.x, priest.y, enemy.x, enemy.y) > 170) continue;
        const ratio = enemy.hp / enemy.maxHp;
        if (ratio < lowestRatio) { lowestRatio = ratio; target = enemy; }
      }
      if (!target) continue;

      const healed = Math.min(target.maxHp - target.hp, target.maxHp * 0.08);
      target.hp += healed;
      target.barBg.setVisible(true);
      target.bar.setVisible(true);
      target.bar.width = (target.healthBarWidth || (target.boss ? 80 : 42)) * (target.hp / target.maxHp);
      this.burst(priest.x, priest.y - 18, 0x42d9c7, 7, 0.55);
      this.showDmg(target.x, target.y - 42, `+${Math.ceil(healed)}`, '#72f0cb');
    }
  }

  sourceBonusFor(t) {
    let bonus = this.holyAuraBonus(t);
    return Math.min(1, bonus);
  }

  plagueDamageMult(t) {
    if (t.elem !== 'poison' || t.branch !== 'a' || t.lv < 4) return 1;
    return t.lv >= 7 ? PLAGUE.lv7DamageMult : PLAGUE.damageMult;
  }

  holyAuraBonus(t) {
    let bonus = 0;
    for (const aura of this.towers) {
      if (aura === t || aura.elem !== 'light' || aura.branch !== 'b' || aura.lv < 4) continue;
      // v1.19：230→170，圣辉从"全队常驻"收敛为"罩 3~4 塔的站位决策"
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
      toast(this, t.slot.x, t.slot.y - 110, tr('game.judgmentAll'), '#fff8dc', 22);
      this.playJudgementPulseFx(t, true);
    } else {
      t.selfBuffT = 3;
      toast(this, t.slot.x, t.slot.y - 110, tr('game.judgmentSelf'), '#fff8dc', 22);
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
    toast(this, 560, 940, tr('game.radianceHeal', { value: heal }), '#fff8dc', 26);
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
      let stunnedAny = false;
      chain.forEach((e, i) => {
        const ex = e.x, ey = e.y;
        const mult = (branch === 'a' && i === chain.length - 1) ? 1.75 : 1;
        const real = e.takeDamage(dmg * mult, { sourceTower: t, sourceBonus: this.sourceBonusFor(t, e) });
        this.showDmg(ex, ey - 40, real, '#fff2a8');
        if (branch === 'b' && !e.dead) {
          const chance = lv >= 7 ? LIGHTNING_HUB.lv7StunChance : LIGHTNING_HUB.stunChance;
          const duration = lv >= 7 ? LIGHTNING_HUB.lv7StunDuration : LIGHTNING_HUB.stunDuration;
          if (Math.random() < chance && e.applyStun(duration)) {
            stunnedAny = true;
            this.showDmg(ex, ey - 58, tr('game.stun'), '#fff2a8');
            this.playStunRingFx(ex, ey);
          }
        }
      });
      if (stunnedAny) Sfx.stun();
      Sfx.hit();
      return;
    }

    if (elem === 'light') {
      // 光束：瞬发 + 斩杀
      const tx = target.x, ty = target.y;
      this.lightBeam(sx, sy, tx, ty - 10);
      const threshold = branch === 'a' ? 0.25 : 0.15;
      if (!target.boss && target.hp / target.maxHp <= threshold) {
        this.showDmg(tx, ty - 50, tr('game.execute'), '#fff8dc');
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
    const isFireProjectile = elem === 'fire';
    const isIceProjectile = elem === 'ice';
    const projectileTexture = isFireProjectile ? 'fire_orb' : (isIceProjectile ? 'ice_bolt' : 'bullet');
    const b = this.add.image(sx, sy, projectileTexture).setDepth(2050);
    if (isFireProjectile) {
      const heading = Phaser.Math.Angle.Between(sx, sy, target.x, target.y - 10);
      const headingDeg = Phaser.Math.RadToDeg(heading);
      b
        .setScale(branch === 'b' ? 1.05 : 0.86)
        .setRotation(heading);
      const trail = this.add.particles(0, 0, 'fire_ember', {
        follow: b,
        frequency: 28,
        lifespan: { min: 180, max: 300 },
        angle: { min: headingDeg + 155, max: headingDeg + 205 },
        speed: { min: 12, max: 42 },
        rotate: { min: -35, max: 35 },
        scale: { start: branch === 'b' ? 0.7 : 0.5, end: 0.08 },
        alpha: { start: 0.9, end: 0 },
        blendMode: Phaser.BlendModes.ADD,
      }).setDepth(2049);
      b.setData('fireTrail', trail);
    } else if (isIceProjectile) {
      const heading = Phaser.Math.Angle.Between(sx, sy, target.x, target.y - 10);
      const headingDeg = Phaser.Math.RadToDeg(heading);
      b
        .setRotation(heading)
        .setScale((0.78 + Math.min(lv, 7) * 0.025) * (branch === 'a' ? 1.08 : 1))
        .setBlendMode(Phaser.BlendModes.ADD);
      const trail = this.add.particles(0, 0, 'ice_speck', {
        follow: b,
        frequency: branch === 'b' ? 24 : 32,
        lifespan: { min: 180, max: 320 },
        angle: { min: headingDeg + 155, max: headingDeg + 205 },
        speed: { min: 16, max: 48 },
        rotate: { min: -120, max: 120 },
        scale: { start: branch === 'b' ? 0.72 : 0.58, end: 0.08 },
        alpha: { start: 0.82, end: 0 },
        tint: [0x7cddff, 0xd9f8ff, 0xffffff],
        blendMode: Phaser.BlendModes.ADD,
      }).setDepth(2049);
      b.setData('iceTrail', trail);
    } else {
      b.setTint(color).setScale(0.9);
    }
    const dur = Phaser.Math.Distance.Between(sx, sy, target.x, target.y) / 1.4;
    this.tweens.add({
      targets: b, x: target.x, y: target.y - 10, duration: dur,
      onComplete: () => {
        const ix = b.x, iy = b.y;
        const fireTrail = b.getData('fireTrail');
        if (fireTrail) {
          fireTrail.stop();
          this.time.delayedCall(340, () => fireTrail.destroy());
        }
        const iceTrail = b.getData('iceTrail');
        if (iceTrail) {
          iceTrail.stop();
          this.time.delayedCall(340, () => iceTrail.destroy());
        }
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
            this.showDmg(tx, ty - 44, crit ? tr('game.crit', { value: Math.round(real) }) : real, crit ? '#ffe97a' : '#ffb199');
            this.playMoltenImpactFx(sx, sy, tx, ty, crit);
            return;
          }
          const radius = (62 + lv * 2) * (branch === 'a' ? 1.6 : 1);
          const impactMult = branch === 'a' ? FIRE_BRANCH_BALANCE.explosiveDamageMult : 1;
          this.playFireBurstFx(ix, iy, radius * (branch === 'a' ? 0.72 : 0.82), color);
          for (const e of [...this.enemies]) {
            if (e.dead) continue;
            if (Phaser.Math.Distance.Between(ix, iy, e.x, e.y) <= radius + this.enemySize(e) * 0.5) {
              const ex = e.x, ey = e.y;
              const real = e.takeDamage(dmg * impactMult, { sourceTower: t, sourceBonus: this.sourceBonusFor(t, e) });
              this.showDmg(ex, ey - 40, real, '#ffb199');
            }
          }
          if (branch === 'a') {
            this.addBurnZone(ix, iy, dmg * FIRE_BRANCH_BALANCE.explosiveBurnDpsMult, {
              duration: lv >= 7 ? 4 : 2,
              goldMult: t.goldMult,
              sourceBonus: this.sourceBonusFor(t, target),
              sourceTower: t,
            });
          }
        } else if (elem === 'ice') {
          const impact = this.add.particles(ix, iy, 'ice_speck', {
            emitting: false,
            lifespan: { min: 180, max: 360 },
            speed: { min: 45, max: 125 },
            angle: { min: 0, max: 360 },
            rotate: { min: -180, max: 180 },
            scale: { start: branch === 'b' ? 0.95 : 0.75, end: 0 },
            alpha: { start: 1, end: 0 },
            tint: [0x62d1ff, 0xc7f3ff, 0xffffff],
            blendMode: Phaser.BlendModes.ADD,
          }).setDepth(2052);
          impact.explode(branch === 'b' ? 9 : 6);
          this.time.delayedCall(420, () => impact.destroy());
          if (!target.dead) {
            const slowCap = 80;
            if (branch === 'a') {
              const novaChance = lv >= 7 ? ICE_RIVER.lv7NovaChance : ICE_RIVER.novaChance;
              if (Math.random() < novaChance) {
                const novaRadius = ICE_RIVER.novaRadius + lv * ICE_RIVER.novaRadiusPerLv;
                const mainMult = lv >= 7 ? ICE_RIVER.lv7MainDamageMult : ICE_RIVER.mainDamageMult;
                const splashMult = lv >= 7 ? ICE_RIVER.lv7SplashDamageMult : ICE_RIVER.splashDamageMult;
                const slowDuration = lv >= 7 ? 2.8 : 2.2;
                const cx = target.x, cy = target.y;
                this.playFrostNovaFx(cx, cy, novaRadius, lv >= 7);
                Sfx.iceNova();
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
              // 碎冰保留冰塔普攻伤害与减速，再独立判定无伤害的范围冻结。
              const cx = target.x, cy = target.y;
              const real = target.takeDamage(dmg, { sourceTower: t, sourceBonus: this.sourceBonusFor(t, target) });
              this.showDmg(cx, cy - 40, real, '#bfe8ff');
              if (!target.dead) target.applySlow(slowCap, 2, 20, 20);
              const chance = lv >= 7 ? ICE_SHATTER.lv7FreezeChance : ICE_SHATTER.freezeChance;
              if (Math.random() >= chance) return;
              const radius = lv >= 7 ? ICE_SHATTER.lv7Radius : ICE_SHATTER.radius;
              const duration = ICE_SHATTER.freezeDuration;
              this.playFrostNovaFx(cx, cy, radius, lv >= 7);
              for (const e of [...this.enemies]) {
                if (e.dead) continue;
                const distance = Phaser.Math.Distance.Between(cx, cy, e.x, e.y);
                if (distance > radius + this.enemySize(e) * 0.5) continue;
                if (e.applyFreeze(duration)) this.showDmg(e.x, e.y - 44, tr('game.freeze'), '#bfe8ff');
              }
              Sfx.shatterFreeze();
              return;
            }
            const tx = target.x, ty = target.y;
            const real = target.takeDamage(dmg, { sourceTower: t, sourceBonus: this.sourceBonusFor(t, target) });
            this.showDmg(tx, ty - 40, real, '#bfe8ff');
            if (!target.dead) target.applySlow(slowCap, 2, 20, 20);
          }
        } else if (elem === 'poison') {
          if (!target.dead) {
            target.applyPoison(
              dmg * this.plagueDamageMult(t),
              lv >= 4 ? 2 : 1,
              false,
              t,
              { sourceBonus: this.sourceBonusFor(t, target) },
            );
            this.showDmg(target.x, target.y - 40, '☠', '#9ef07a');
          }
        }
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
    this.banner(t('game.lastStand'));
    Sfx.lastStand();

    this.lastStandOverlay = this.add.rectangle(W / 2, H / 2, W, H, 0x9b1022, 0)
      .setDepth(2250);
    this.tweens.add({ targets: this.lastStandOverlay, alpha: 0.28, duration: 220 });
    this.lastStandText = this.uiText(W / 2, 160, t('game.lastStandTime', { value: '5.0' }), 34, '#ffccd2')
      .setOrigin(0.5)
      .setDepth(3000);
    this.lastStandText.setStroke('#390611', 7);
  }

  updateLastStand(realDt) {
    if (!this.lastStandActive) return;
    this.lastStandT -= realDt;
    if (this.lastStandText) this.lastStandText.setText(t('game.lastStandTime', { value: Math.max(0, this.lastStandT).toFixed(1) }));
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
      this.banner(t('game.clutch'));
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
      layer.add(this.uiText(W / 2, 420, t('game.baseCritical'), 44, '#ff7a7a').setOrigin(0.5));
      layer.add(this.uiText(W / 2, 490, t('game.waveOnly', { value: this.wave }), 28, '#c9d2f0').setOrigin(0.5));
      layer.add(makeButton(this, W / 2, 590, 420, 80, t('game.reviveAd'), {
        bg: 0x6b4a86, stroke: 0xb07fe0, fontSize: 25,
        onClick: async () => {
          const ok = await Poki.rewardedBreak();
          if (!ok) return;
          layer.destroy();
          this.revive();
        },
      }));
      layer.add(makeButton(this, W / 2, 690, 420, 70, t('game.endRun'), {
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
    this.banner(t('game.revived'));
    this.updateUI();
    this.waveState = 'idle';
    this.endWave();
  }

  async endRun() {
    if (this.over) return;
    this.over = true;
    stopStageAudio();
    Poki.gameplayStop();
    const S = this.S;
    const diagnosis = this.buildDeathAnalysis(S);
    const waveDps = this.buildWaveDpsSummary();
    const deathBonus = Math.floor(this.wave / DIAMOND.deathBonusPerWave);
    this.diamondsRun += deathBonus;
    S.diamonds += this.diamondsRun;
    const newBest = this.wave > S.best;
    if (newBest) S.best = this.wave;
    S.runs++;
    S.lastSeen = Date.now();
    writeSave(S);
    Sfx.gameOver();
    // 广告 SDK 偶尔不会回调，不能因此永久卡住死亡结算。
    await Promise.race([
      Poki.commercialBreak(),
      new Promise(resolve => window.setTimeout(resolve, 4000)),
    ]);
    this.scene.start('Result', {
      wave: this.wave, kills: this.kills, dRun: this.diamondsRun, newBest, deathBonus, diagnosis, waveDps,
      difficulty: this.difficulty,
    });
  }

  // ================= 主循环 =================
  update(time, delta) {
    this.ensureResponsiveLayout();
    if (this.over || this.editorMode || this.isPaused || this.settingsOpen) return;
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
    if (this.waveState === 'active') this.waveCombatTime += dts;

    // 敌人
    for (const e of [...this.enemies]) e.update(dts);
    this.updateEnemySupport(dts);

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
            e.takeDamage(z.dps * 0.25, {
              trueDmg: true,
              goldMult: z.goldMult,
              sourceBonus: z.sourceBonus || 0,
              sourceTower: z.sourceTower,
            });
          }
        }
      }
      if (z.t <= 0) {
        if (z.img) {
          for (const child of z.img.list || []) {
            this.tweens.killTweensOf(child);
            if (child.texture?.key === 'fire_ember' && child.stop) child.stop();
          }
          this.tweens.killTweensOf(z.img);
          this.tweens.add({
            targets: z.img,
            alpha: 0,
            scaleX: 0.92,
            scaleY: 0.86,
            duration: 180,
            ease: 'Quad.In',
            onComplete: () => z.img.destroy(),
          });
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
      this.bossBarFrame.setVisible(true);
      this.bossHudIcon.setVisible(true);
    } else {
      this.bossBarBg.setVisible(false);
      this.bossBar.setVisible(false);
      this.bossBarFrame.setVisible(false);
      this.bossHudIcon.setVisible(false);
    }
  }
}

Object.assign(GameScene.prototype, gameRunAnalysisMethods);
Object.defineProperties(GameScene.prototype, gameVfxMethods);
