import { W, H, DEFAULT_DIFFICULTY, DIFFICULTIES, ELEMENTS, offlineDiamonds } from '../config.js';
import { makeButton, makeDifficultySelector, toast, openShop } from '../ui.js';
import { writeSave } from '../save.js';
import { Sfx } from '../audio.js';
import { Poki } from '../poki.js';
import { addTowerImage, fitTowerImageHeight } from '../textures.js';
import { getLocale, setLocale, t } from '../i18n.js';

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
    const panelY = wide ? 640 : 790;
    this.menuCenterX = wide ? viewW / 2 : W / 2;
    this.menuViewW = viewW;

    this.cameras.main.setBackgroundColor('#0b1020');
    makeButton(this, wide ? viewW - 82 : W - 65, 48, 94, 40, t('language.label'), {
      bg: 0x19283b, stroke: 0x405d78, fontSize: 17,
      onClick: () => { setLocale(getLocale() === 'en' ? 'zh' : 'en'); window.location.reload(); },
    }).setDepth(100);
    const bg = this.add.graphics().setDepth(-30);
    bg.fillGradientStyle(0x193b43, 0x162f42, 0x0c1829, 0x080e19, 1);
    bg.fillRect(0, 0, viewW, viewH);
    bg.fillStyle(0x63d6b0, 0.045); bg.fillCircle(heroX, wide ? 390 : 360, wide ? 540 : 390);
    bg.fillStyle(0x7099d0, 0.025); bg.fillCircle(wide ? viewW * 0.82 : 620, 970, 520);
    bg.lineStyle(1, 0xaad8ff, 0.018);
    for (let x = 0; x < viewW; x += 80) bg.lineBetween(x, 0, x, viewH);
    for (let y = 0; y < viewH; y += 80) bg.lineBetween(0, y, viewW, y);
    bg.fillStyle(0xdaf7ff, 0.12);
    for (let i = 0; i < 24; i++) bg.fillCircle(24 + (i * 173) % viewW, 45 + (i * 257) % viewH, 1 + (i % 3));

    const brandY = wide ? 315 : 190;
    const towerY = wide ? 815 : 480;
    const towerGap = wide ? 150 : 120;
    const towerStart = heroX - towerGap * 2;
    const elems = Object.keys(ELEMENTS);
    for (let i = 0; i < 5; i++) {
      const portraitHeights = [104, 126, 154, 126, 104];
      const targetHeight = wide ? (i === 2 ? 178 : 145) : portraitHeights[i];
      const halo = this.add.circle(towerStart + i * towerGap, towerY - 22, i === 2 ? 68 : 50, ELEMENTS[elems[i]].color, i === 2 ? 0.13 : 0.065);
      const img = fitTowerImageHeight(addTowerImage(this, towerStart + i * towerGap, towerY, elems[i]), targetHeight).setAlpha(i === 2 ? 1 : 0.86);
      this.tweens.add({ targets: [img, halo], y: '-=12', duration: 1300 + i * 130, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    }

    this.add.text(heroX, brandY - (wide ? 135 : 112), 'STRATEGY  ·  MERGE  ·  DEFEND', {
      fontFamily: 'Arial, sans-serif', fontSize: wide ? '22px' : '15px', color: '#6dc8a8', fontStyle: 'bold', letterSpacing: 4,
    }).setOrigin(0.5);
    this.add.text(heroX, brandY, 'MERGE\nTOWERS', {
      fontFamily: 'Arial Black, sans-serif', fontSize: wide ? '108px' : '76px', color: '#f8e8a0',
      align: 'center', stroke: '#203b55', strokeThickness: 9, lineSpacing: -18,
    }).setOrigin(0.5);
    this.add.text(heroX, brandY + (wide ? 145 : 116), t('menu.tagline'), {
      fontFamily: 'Arial, "Microsoft YaHei", sans-serif', fontSize: wide ? '26px' : '18px', color: '#9eb2c6', fontStyle: 'bold',
    }).setOrigin(0.5);

    const cardW = wide ? 720 : 636;
    const cardH = wide ? 520 : 460;
    const card = this.add.graphics();
    card.fillStyle(0x07101f, 0.25); card.fillRoundedRect(panelX - cardW / 2 + 7, panelY - cardH / 2 + 9, cardW, cardH, 26);
    card.fillStyle(0x101c2d, 0.78); card.fillRoundedRect(panelX - cardW / 2, panelY - cardH / 2, cardW, cardH, 26);
    card.lineStyle(1, 0x8fc4eb, 0.14); card.strokeRoundedRect(panelX - cardW / 2, panelY - cardH / 2, cardW, cardH, 26);
    card.fillStyle(0x62cba3, 0.8); card.fillRoundedRect(panelX - 42, panelY - cardH / 2, 84, 3, 2);

    const statY = panelY - cardH / 2 + 57;
    const statGap = wide ? 250 : 225;
    const bestX = panelX - statGap / 2;
    const diamondX = panelX + statGap / 2;
    this.add.text(bestX, statY - 17, t('menu.best'), { fontFamily: 'Arial, "Microsoft YaHei"', fontSize: '18px', color: '#7389a6' }).setOrigin(0.5);
    this.add.text(bestX, statY + 18, `★  ${t('menu.waveValue', { value: S.best || 0 })}`, { fontFamily: 'Arial, "Microsoft YaHei"', fontSize: '25px', color: '#e9eef5', fontStyle: 'bold' }).setOrigin(0.5);
    this.add.rectangle(panelX, statY + 3, 1, 62, 0x8aa3bd, 0.2);
    this.add.text(diamondX, statY - 17, t('menu.resources'), { fontFamily: 'Arial, "Microsoft YaHei"', fontSize: '18px', color: '#7389a6' }).setOrigin(0.5);
    this.dText = this.add.text(diamondX, statY + 18, `◆  ${S.diamonds}`, { fontFamily: 'Arial, "Microsoft YaHei"', fontSize: '25px', color: '#8bd6e7', fontStyle: 'bold' }).setOrigin(0.5);

    const difficultyY = panelY - cardH / 2 + 175;
    makeDifficultySelector(this, difficultyY, difficulty, key => {
      difficulty = key;
      this.registry.set('difficulty', key);
    }, { centerX: panelX, gap: wide ? 185 : 150, buttonW: wide ? 164 : 132, buttonH: 58, titleSize: 20 });

    const startY = panelY + (wide ? 40 : 44);
    makeButton(this, panelX, startY, wide ? 590 : 554, 92, t('menu.start'), {
      bg: 0x24624f, stroke: 0x55bb8e, fontSize: 34,
      onClick: () => this.scene.start('Game', { difficulty }),
    });
    makeButton(this, panelX, startY + 96, wide ? 590 : 554, 64, t('menu.workshop'), {
      bg: 0x30394a, stroke: 0x68758a, fontSize: 23,
      onClick: () => openShop(this, S, () => this.dText.setText(`💎 ${S.diamonds}`)),
    });

    this.add.text(panelX, startY + 147, t('menu.mergeHint'), {
      fontFamily: 'Arial, "Microsoft YaHei", sans-serif', fontSize: '17px', color: '#61758c',
    }).setOrigin(0.5);

    this.checkOfflineChest(S);
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
    const layer = this.add.container(0, 0).setDepth(6000);
    layer.add(this.add.rectangle(cx, H / 2, this.menuViewW || W, H, 0x000000, 0.75).setInteractive());
    layer.add(this.add.rectangle(cx, 600, 560, 470, 0x1e2233).setStrokeStyle(3, 0x4a5578));
    layer.add(this.add.text(cx, 430, t('menu.offlineTitle'), {
      fontFamily: 'Arial, "Microsoft YaHei", sans-serif', fontSize: '42px', color: '#ffe97a', fontStyle: 'bold',
    }).setOrigin(0.5));
    layer.add(this.add.text(cx, 510, t('menu.offlineBody', { value: d }), {
      fontFamily: 'Arial, "Microsoft YaHei", sans-serif', fontSize: '26px', color: '#c9d2f0', align: 'center',
    }).setOrigin(0.5));

    const claim = (mult) => {
      S.diamonds += d * mult;
      S.coupon = true;
      writeSave(S);
      Sfx.diamond();
      this.dText.setText(`💎 ${S.diamonds}`);
      toast(this, cx, 560, `+${d * mult}💎`, '#9fe8ff', 36);
      layer.destroy();
    };
    layer.add(makeButton(this, cx, 630, 420, 78, t('menu.claimDouble', { value: d * 2 }), {
      bg: 0x6b4a86, stroke: 0xb07fe0, fontSize: 26,
      onClick: async () => { if (await Poki.rewardedBreak()) claim(2); },
    }));
    layer.add(makeButton(this, cx, 730, 420, 70, t('menu.claim', { value: d }), {
      bg: 0x51586e, fontSize: 24,
      onClick: () => claim(1),
    }));
  }
}
