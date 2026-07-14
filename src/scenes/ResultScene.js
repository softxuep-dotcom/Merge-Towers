import Phaser from 'phaser';

import { W, H, DEFAULT_DIFFICULTY, DIFFICULTIES } from '../config.js';
import { makeButton, makeDifficultySelector, makePanel, openShop, UI_THEME } from '../ui.js';
import { t } from '../i18n.js';

export class ResultScene extends Phaser.Scene {
  constructor() { super('Result'); }

  init(data) { this.data_ = data; }

  create() {
    const S = this.registry.get('save');
    const d = this.data_;
    const runDifficulty = DIFFICULTIES[d.difficulty] ? d.difficulty : DEFAULT_DIFFICULTY;
    let nextDifficulty = this.registry.get('difficulty') || runDifficulty;
    if (!DIFFICULTIES[nextDifficulty]) nextDifficulty = DEFAULT_DIFFICULTY;

    const viewW = this.scale.width || W;
    const viewH = this.scale.height || H;
    const cx = viewW / 2;
    const cy = viewH / 2;
    const top = Math.max(48, cy - 570);

    this.cameras.main.setBackgroundColor('#061019');
    const bg = this.add.graphics().setDepth(-10);
    bg.fillGradientStyle(0x153a3b, 0x102d3c, 0x081523, 0x050b12, 1);
    bg.fillRect(0, 0, viewW, viewH);
    bg.fillStyle(d.newBest ? 0xf3c95f : 0x63d6a3, d.newBest ? 0.075 : 0.04);
    bg.fillCircle(cx, top + 140, 420);
    bg.fillStyle(0xdaf7ff, 0.11);
    for (let i = 0; i < 26; i++) bg.fillCircle(30 + (i * 179) % viewW, 35 + (i * 251) % viewH, 1 + (i % 2));

    this.add.text(cx, top, 'RUN  SUMMARY', {
      fontFamily: 'Arial, sans-serif', fontSize: '14px', color: '#75d6ad', fontStyle: 'bold', letterSpacing: 4,
    }).setOrigin(0.5);
    this.add.text(cx, top + 55, d.newBest ? t('result.newBest') : t('result.over'), {
      fontFamily: 'Arial Black, "Microsoft YaHei", sans-serif', fontSize: '46px',
      color: d.newBest ? '#f5d675' : UI_THEME.text, fontStyle: 'bold', stroke: '#102434', strokeThickness: 7,
    }).setOrigin(0.5);
    this.add.text(cx, top + 118, t('result.wave', { wave: d.wave }), {
      fontFamily: 'Arial, "Microsoft YaHei", sans-serif', fontSize: '30px', color: UI_THEME.textSoft, fontStyle: 'bold',
    }).setOrigin(0.5);

    makePanel(this, cx, top + 235, 620, 178, {
      fill: UI_THEME.surface, alpha: 0.9, radius: 22, stroke: UI_THEME.line, strokeAlpha: 0.45,
      accentColor: d.newBest ? UI_THEME.gold : UI_THEME.primaryBright, accentWidth: 84,
    });
    const summaryLines = [
      t('result.kills', { value: d.kills }),
      t('result.best', { value: S.best }),
      t('result.difficulty', { value: DIFFICULTIES[runDifficulty].cn }),
      t('result.build', { value: d.diagnosis?.elements || 'NONE' }),
      t('result.earned', { value: d.dRun, bonus: d.deathBonus }),
      t('result.owned', { value: S.diamonds }),
    ];
    const summaryXs = [cx - 150, cx + 150];
    summaryLines.forEach((line, index) => {
      const row = Math.floor(index / 2);
      const col = index % 2;
      this.add.text(summaryXs[col], top + 190 + row * 43, line, {
        fontFamily: 'Arial, "Microsoft YaHei", sans-serif', fontSize: '18px',
        color: index >= 4 ? '#9fe8ff' : UI_THEME.textSoft, fontStyle: index < 2 ? 'bold' : 'normal',
        align: 'center', wordWrap: { width: 270 },
      }).setOrigin(0.5);
    });

    const waveDps = d.waveDps || { wave: d.wave, duration: 0, totalDps: 0, towers: [] };
    const formatDps = value => {
      if (value >= 1000) return `${(value / 1000).toFixed(1)}k`;
      if (value >= 100) return String(Math.round(value));
      return Number(value || 0).toFixed(1);
    };
    makePanel(this, cx, top + 500, 620, 310, {
      fill: 0x0b1926, alpha: 0.94, radius: 22, stroke: UI_THEME.lineSoft, strokeAlpha: 0.55,
      accent: false,
    });
    this.add.text(cx, top + 380,
      t('result.dps', { wave: waveDps.wave, dps: formatDps(waveDps.totalDps), seconds: waveDps.duration.toFixed(1) }), {
        fontFamily: 'Arial, "Microsoft YaHei", sans-serif', fontSize: '22px', color: '#f5d675', fontStyle: 'bold',
      }).setOrigin(0.5);

    const towerRows = waveDps.towers || [];
    if (!towerRows.length) {
      this.add.text(cx, top + 500, t('result.noDps'), {
        fontFamily: 'Arial, "Microsoft YaHei", sans-serif', fontSize: '18px', color: UI_THEME.textMuted,
      }).setOrigin(0.5);
    } else {
      const columns = towerRows.length > 6 ? 2 : 1;
      const rowsPerColumn = Math.ceil(towerRows.length / columns);
      const rowGap = Math.min(28, 220 / Math.max(1, rowsPerColumn - 1));
      const fontSize = rowsPerColumn > 10 ? 15 : rowsPerColumn > 8 ? 17 : 19;
      const startX = columns === 1 ? cx - 245 : cx - 280;
      const columnWidth = columns === 1 ? 0 : 290;
      towerRows.forEach((tower, index) => {
        const column = Math.floor(index / rowsPerColumn);
        const row = index % rowsPerColumn;
        this.add.text(startX + column * columnWidth, top + 420 + row * rowGap,
          `${index + 1}. ${tower.label}  ${formatDps(tower.dps)}`, {
            fontFamily: 'Arial, "Microsoft YaHei", sans-serif', fontSize: `${fontSize}px`,
            color: '#dce5ec', fontStyle: 'bold',
          }).setOrigin(0, 0.5);
      });
    }

    makePanel(this, cx, top + 708, 600, 104, {
      fill: d.diagnosis?.upgradeId ? 0x302a1d : 0x142534, alpha: 0.94, radius: 18,
      stroke: d.diagnosis?.upgradeId ? 0x9f8240 : UI_THEME.line, strokeAlpha: 0.55,
      shadowAlpha: 0.18, accent: false,
    });
    const diagnosis = this.add.text(cx, top + 708, d.diagnosis?.text || t('result.tip'), {
      fontFamily: 'Arial, "Microsoft YaHei", sans-serif', fontSize: '19px',
      color: d.diagnosis?.upgradeId ? '#f5d675' : UI_THEME.textSoft, fontStyle: 'bold',
      align: 'center', wordWrap: { width: 540 },
    }).setOrigin(0.5);
    if (d.diagnosis?.upgradeId) {
      diagnosis.setInteractive({ useHandCursor: true }).on('pointerdown', () => openShop(this, S));
    }

    makeDifficultySelector(this, top + 822, nextDifficulty, key => {
      nextDifficulty = key;
      this.registry.set('difficulty', key);
    }, { centerX: cx, buttonW: 128, buttonH: 46, gap: 142, fontSize: 17, titleSize: 18 });

    makeButton(this, cx, top + 918, 470, 72, t('result.retry'), {
      bg: UI_THEME.primary, stroke: UI_THEME.primaryBright, fontSize: 27, radius: 18,
      onClick: () => this.scene.start('Game', { difficulty: nextDifficulty }),
    });
    makeButton(this, cx, top + 1005, 470, 62, t('result.workshop'), {
      bg: 0x5e4d27, stroke: 0xd8b74f, fontSize: 22, radius: 16,
      onClick: () => openShop(this, S),
    });
    makeButton(this, cx, top + 1080, 470, 54, t('result.menu'), {
      bg: 0x263a4b, stroke: 0x587083, fontSize: 20, radius: 15,
      onClick: () => this.scene.start('Menu'),
    });
  }
}
