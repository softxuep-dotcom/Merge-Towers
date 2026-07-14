import { W, H, DEFAULT_DIFFICULTY, DIFFICULTIES, ELEMENTS, offlineDiamonds } from '../config.js';
import { makeButton, makeDifficultySelector, makePanel, toast, openShop, UI_THEME } from '../ui.js';
import { CURRENT_TUTORIAL_VERSION, writeSave } from '../save.js';
import { Sfx } from '../audio.js';
import { Poki } from '../poki.js';
import { addTowerImage, fitTowerImageHeight } from '../textures.js';
import { getLocale, getLocaleInfo, LOCALES, setLocale, t } from '../i18n.js';

export class MenuScene extends Phaser.Scene {
  constructor() { super('Menu'); }

  create() {
    const S = this.registry.get('save');
    let difficulty = this.registry.get('difficulty') || DEFAULT_DIFFICULTY;
    if (!DIFFICULTIES[difficulty]) difficulty = DEFAULT_DIFFICULTY;
    this.registry.set('difficulty', difficulty);
    const viewW = this.scale.width || W;
    const viewH = this.scale.height || H;
    const wide = viewW > viewH * 1.18;
    const heroX = wide ? viewW * 0.28 : W / 2;
    const panelX = wide ? viewW * 0.71 : W / 2;
    const brandY = wide ? 315 : Phaser.Math.Clamp(viewH * 0.165, 205, 255);
    const towerY = wide ? 815 : brandY + 315;
    const panelY = wide ? 640 : Math.min(viewH - 310, towerY + 500);
    this.menuCenterX = wide ? viewW / 2 : W / 2;
    this.menuViewW = viewW;
    this.menuViewH = viewH;
    this.languageLayer = null;

    this.cameras.main.setBackgroundColor('#061019');
    makeButton(this, wide ? viewW - 112 : W - 84, 52, 142, 46, `◎  ${getLocaleInfo().short}`, {
      bg: 0x102434, stroke: 0x426476, fontSize: 16, radius: 14, shadowAlpha: 0.2,
      onClick: () => this.showLanguageMenu(),
    }).setDepth(100);
    const bg = this.add.graphics().setDepth(-30);
    bg.fillGradientStyle(0x153c3d, 0x123144, 0x091827, 0x050c14, 1);
    bg.fillRect(0, 0, viewW, viewH);
    bg.fillStyle(0x61d5a2, 0.06); bg.fillCircle(heroX, brandY + 90, wide ? 560 : 440);
    bg.fillStyle(0x78a9d8, 0.035); bg.fillCircle(wide ? viewW * 0.82 : 620, panelY + 250, 560);
    bg.lineStyle(1, 0xb8e6ec, 0.022);
    for (let x = -viewH; x < viewW + viewH; x += 96) bg.lineBetween(x, 0, x - viewH, viewH);
    bg.fillStyle(0xdaf7ff, 0.15);
    for (let i = 0; i < 34; i++) bg.fillCircle(24 + (i * 173) % viewW, 45 + (i * 257) % viewH, 1 + (i % 3));
    bg.fillStyle(0x061019, 0.62);
    bg.fillTriangle(0, viewH, 0, viewH - 300, viewW * 0.42, viewH);
    bg.fillTriangle(viewW * 0.18, viewH, viewW * 0.58, viewH - 250, viewW, viewH);
    bg.fillTriangle(viewW * 0.58, viewH, viewW, viewH - 340, viewW, viewH);

    const towerGap = wide ? 150 : 120;
    const towerStart = heroX - towerGap * 2;
    const elems = Object.keys(ELEMENTS);
    for (let i = 0; i < 5; i++) {
      const portraitHeights = [104, 126, 154, 126, 104];
      const targetHeight = wide ? (i === 2 ? 178 : 145) : portraitHeights[i];
      const halo = this.add.circle(towerStart + i * towerGap, towerY - 22, i === 2 ? 72 : 52, ELEMENTS[elems[i]].color, i === 2 ? 0.17 : 0.08);
      const img = fitTowerImageHeight(addTowerImage(this, towerStart + i * towerGap, towerY, elems[i]), targetHeight).setAlpha(i === 2 ? 1 : 0.86);
      this.tweens.add({ targets: [img, halo], y: '-=12', duration: 1300 + i * 130, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    }

    this.add.text(heroX, brandY - (wide ? 135 : 108), 'STRATEGY  ·  MERGE  ·  DEFEND', {
      fontFamily: 'Arial, sans-serif', fontSize: wide ? '22px' : '15px', color: '#75d6ad', fontStyle: 'bold', letterSpacing: 4,
    }).setOrigin(0.5);
    this.add.text(heroX, brandY, 'MERGE\nTOWERS', {
      fontFamily: 'Arial Black, sans-serif', fontSize: wide ? '108px' : '78px', color: '#f5d675',
      align: 'center', stroke: '#18384a', strokeThickness: 10, lineSpacing: -18,
    }).setOrigin(0.5);
    this.add.text(heroX, brandY + (wide ? 145 : 116), t('menu.tagline'), {
      fontFamily: 'Arial, "Microsoft YaHei", sans-serif', fontSize: wide ? '26px' : '18px', color: UI_THEME.textSoft, fontStyle: 'bold',
    }).setOrigin(0.5);

    const cardW = wide ? 720 : 636;
    const cardH = wide ? 520 : 540;
    makePanel(this, panelX, panelY, cardW, cardH, {
      fill: 0x0c1b2a, alpha: 0.88, stroke: 0x5d8394, strokeAlpha: 0.34,
      accentColor: UI_THEME.primaryBright, accentWidth: 108,
    });

    const statY = panelY - cardH / 2 + 70;
    const statGap = wide ? 250 : 225;
    const bestX = panelX - statGap / 2;
    const diamondX = panelX + statGap / 2;
    this.add.rectangle(bestX, statY + 2, 206, 76, 0x152a3a, 0.72).setStrokeStyle(1, 0x49697c, 0.36);
    this.add.rectangle(diamondX, statY + 2, 206, 76, 0x152a3a, 0.72).setStrokeStyle(1, 0x49697c, 0.36);
    this.add.text(bestX, statY - 17, t('menu.best'), { fontFamily: 'Arial, "Microsoft YaHei"', fontSize: '16px', color: UI_THEME.textMuted, fontStyle: 'bold' }).setOrigin(0.5);
    this.add.text(bestX, statY + 17, `★  ${t('menu.waveValue', { value: S.best || 0 })}`, { fontFamily: 'Arial, "Microsoft YaHei"', fontSize: '24px', color: UI_THEME.text, fontStyle: 'bold' }).setOrigin(0.5);
    this.add.text(diamondX, statY - 17, t('menu.resources'), { fontFamily: 'Arial, "Microsoft YaHei"', fontSize: '16px', color: UI_THEME.textMuted, fontStyle: 'bold' }).setOrigin(0.5);
    this.dText = this.add.text(diamondX, statY + 18, `◆  ${S.diamonds}`, { fontFamily: 'Arial, "Microsoft YaHei"', fontSize: '25px', color: '#8bd6e7', fontStyle: 'bold' }).setOrigin(0.5);

    const difficultyY = panelY - cardH / 2 + 205;
    makeDifficultySelector(this, difficultyY, difficulty, key => {
      difficulty = key;
      this.registry.set('difficulty', key);
    }, { centerX: panelX, gap: wide ? 185 : 150, buttonW: wide ? 164 : 132, buttonH: 58, titleSize: 20 });

    const startY = panelY + (wide ? 40 : 72);
    const startW = wide ? 590 : 554;
    const forceTutorial = import.meta.env.DEV && new URLSearchParams(window.location.search).has('tutorial');
    const firstVisit = forceTutorial || (S.tutorialVersion || 0) < CURRENT_TUTORIAL_VERSION;
    const hasCompletedRun = (S.runs || 0) > 0;
    const startGlow = firstVisit
      ? this.add.rectangle(panelX, startY, startW + 18, 108, UI_THEME.primaryBright, 0.06)
        .setStrokeStyle(5, UI_THEME.primaryBright, 0.92).setDepth(5)
      : null;
    const startBtn = makeButton(this, panelX, startY, startW, 92, t('menu.start'), {
      bg: UI_THEME.primary, stroke: UI_THEME.primaryBright, fontSize: 33, radius: 20,
      shadowAlpha: 0.46, letterSpacing: 1.4, strokeWidth: firstVisit ? 3 : 1,
      onClick: () => this.scene.start('Game', { difficulty }),
    }).setDepth(6);
    const workshopBtn = makeButton(this, panelX, startY + 96, wide ? 590 : 554, 64, t('menu.workshop'), {
      bg: 0x1c3042, stroke: 0x587385, fontSize: 22, radius: 16,
      onClick: () => openShop(this, S, () => this.dText.setText(`💎 ${S.diamonds}`)),
    });
    if (firstVisit) {
      workshopBtn.setAlpha(0.58);
      const startArrow = this.add.triangle(panelX, startY - 66, -15, -10, 15, -10, 0, 12, UI_THEME.primaryBright, 1)
        .setDepth(7);
      this.tweens.add({
        targets: startGlow,
        scaleX: 1.025,
        scaleY: 1.14,
        alpha: 0.34,
        duration: 620,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.InOut',
      });
      this.tweens.add({
        targets: startArrow,
        y: startY - 52,
        duration: 520,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.InOut',
      });
      startBtn.label.setFontSize(35);
    }

    this.add.text(panelX, startY + 147, t('menu.mergeHint'), {
      fontFamily: 'Arial, "Microsoft YaHei", sans-serif', fontSize: '16px', color: UI_THEME.textMuted,
    }).setOrigin(0.5);

    // 至少完成一局后才显示离线收益；首次进入直接落到“开始游戏”界面。
    if (hasCompletedRun && !firstVisit) this.checkOfflineChest(S);
  }

  showLanguageMenu() {
    if (this.languageLayer) return;
    const cx = this.menuCenterX || W / 2;
    const viewW = this.menuViewW || W;
    const viewH = this.menuViewH || H;
    const cy = viewH / 2;
    const current = getLocale();
    const layer = this.add.container(0, 0).setDepth(7000);
    this.languageLayer = layer;

    const close = () => {
      layer.destroy();
      if (this.languageLayer === layer) this.languageLayer = null;
    };
    layer.add(this.add.rectangle(cx, cy, viewW, viewH, 0x000000, 0.78).setInteractive());
    layer.add(makePanel(this, cx, cy, 650, 690, {
      fill: UI_THEME.surface, radius: 26, stroke: UI_THEME.line, strokeAlpha: 0.72,
      accentColor: UI_THEME.primaryBright, accentWidth: 92,
    }));
    layer.add(this.add.text(cx, cy - 292, `🌐 ${t('settings.language')}`, {
      fontFamily: 'Arial Black, "Microsoft YaHei", sans-serif', fontSize: '34px', color: '#f5d675',
    }).setOrigin(0.5));

    LOCALES.forEach((locale, index) => {
      const col = index % 3;
      const row = Math.floor(index / 3);
      const active = locale.code === current;
      layer.add(makeButton(this, cx + (col - 1) * 198, cy - 205 + row * 78, 182, 62,
        `${active ? '✓ ' : ''}${locale.label}`, {
          bg: active ? 0x24624f : 0x26364a,
          stroke: active ? 0x65d6a0 : 0x53677f,
          fontSize: locale.label.length > 14 ? 14 : 17,
          onClick: () => {
            if (locale.code === current) { close(); return; }
            setLocale(locale.code);
            window.location.reload();
          },
        }));
    });

    layer.add(makeButton(this, cx, cy + 286, 300, 58, t('common.close'), {
      bg: 0x3a4558, stroke: 0x65748b, fontSize: 22, onClick: close,
    }));
  }

  checkOfflineChest(S) {
    if (S.lastSeen <= 0) return;
    const hours = (Date.now() - S.lastSeen) / 3600000;
    const d = offlineDiamonds(S.best, hours);
    S.lastSeen = Date.now();
    writeSave(S);
    if (d < 1) return;

    // 离线宝箱（GDD §5.1）
    const cx = this.menuCenterX || W / 2;
    const viewH = this.menuViewH || H;
    const cy = viewH / 2;
    const layer = this.add.container(0, 0).setDepth(6000);
    layer.add(this.add.rectangle(cx, cy, this.menuViewW || W, viewH, 0x02070c, 0.82).setInteractive());
    layer.add(makePanel(this, cx, cy, 560, 470, {
      fill: UI_THEME.surface, radius: 26, stroke: 0x6f758f, strokeAlpha: 0.76,
      accentColor: UI_THEME.gold, accentWidth: 92,
    }));
    layer.add(this.add.text(cx, cy - 165, t('menu.offlineTitle'), {
      fontFamily: 'Arial Black, "Microsoft YaHei", sans-serif', fontSize: '38px', color: '#f5d675', fontStyle: 'bold',
    }).setOrigin(0.5));
    layer.add(this.add.text(cx, cy - 78, t('menu.offlineBody', { value: d }), {
      fontFamily: 'Arial, "Microsoft YaHei", sans-serif', fontSize: '24px', color: UI_THEME.textSoft, align: 'center',
    }).setOrigin(0.5));

    const claim = (mult) => {
      S.diamonds += d * mult;
      S.coupon = true;
      writeSave(S);
      Sfx.diamond();
      this.dText.setText(`💎 ${S.diamonds}`);
      toast(this, cx, cy - 10, `+${d * mult}💎`, '#9fe8ff', 36);
      layer.destroy();
    };
    layer.add(makeButton(this, cx, cy + 65, 420, 76, t('menu.claimDouble', { value: d * 2 }), {
      bg: 0x68427f, stroke: 0xc186e2, fontSize: 24, radius: 18,
      onClick: async () => { if (await Poki.rewardedBreak()) claim(2); },
    }));
    layer.add(makeButton(this, cx, cy + 160, 420, 66, t('menu.claim', { value: d }), {
      bg: 0x263a4b, stroke: 0x587083, fontSize: 22, radius: 16,
      onClick: () => claim(1),
    }));
  }
}
import Phaser from 'phaser';
