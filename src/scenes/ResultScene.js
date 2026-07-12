import { W, H, DEFAULT_DIFFICULTY, DIFFICULTIES } from '../config.js';
import { makeButton, makeDifficultySelector, openShop } from '../ui.js';
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
    this.add.rectangle(W / 2, H / 2, W, H, 0x1a1d2e);
    this.add.rectangle(W / 2, 580, 620, 900, 0x1e2233).setStrokeStyle(3, 0x4a5578);

    this.add.text(W / 2, 205, d.newBest ? t('result.newBest') : t('result.over'), {
      fontFamily: 'Arial, "Microsoft YaHei", sans-serif', fontSize: '48px',
      color: d.newBest ? '#ffe97a' : '#c9d2f0', fontStyle: 'bold',
    }).setOrigin(0.5);

    this.add.text(W / 2, 290, t('result.wave', { wave: d.wave }), {
      fontFamily: 'Arial, "Microsoft YaHei", sans-serif', fontSize: '36px', color: '#ffffff', fontStyle: 'bold',
    }).setOrigin(0.5);

    const lines = [
      t('result.kills', { value: d.kills }),
      t('result.best', { value: S.best }),
      t('result.difficulty', { value: DIFFICULTIES[runDifficulty].cn }),
      t('result.build', { value: d.diagnosis?.elements || 'NONE' }),
      t('result.earned', { value: d.dRun, bonus: d.deathBonus }),
      t('result.owned', { value: S.diamonds }),
    ];
    this.add.text(W / 2, 405, lines.join('\n'), {
      fontFamily: 'Arial, "Microsoft YaHei", sans-serif', fontSize: '22px', color: '#c9d2f0',
      align: 'center', lineSpacing: 6,
    }).setOrigin(0.5);

    const waveDps = d.waveDps || { wave: d.wave, duration: 0, totalDps: 0, towers: [] };
    const formatDps = value => {
      if (value >= 1000) return `${(value / 1000).toFixed(1)}k`;
      if (value >= 100) return String(Math.round(value));
      return Number(value || 0).toFixed(1);
    };
    this.add.text(
      W / 2,
      525,
      t('result.dps', { wave: waveDps.wave, dps: formatDps(waveDps.totalDps), seconds: waveDps.duration.toFixed(1) }),
      {
        fontFamily: 'Arial, "Microsoft YaHei", sans-serif',
        fontSize: '24px',
        color: '#ffe97a',
        fontStyle: 'bold',
      },
    ).setOrigin(0.5);

    const towerRows = waveDps.towers || [];
    if (!towerRows.length) {
      this.add.text(W / 2, 590, t('result.noDps'), {
        fontFamily: 'Arial, "Microsoft YaHei", sans-serif', fontSize: '20px', color: '#8f9ab8',
      }).setOrigin(0.5);
    } else {
      const columns = towerRows.length > 6 ? 2 : 1;
      const rowsPerColumn = Math.ceil(towerRows.length / columns);
      const rowGap = Math.min(29, 235 / Math.max(1, rowsPerColumn - 1));
      const fontSize = rowsPerColumn > 10 ? 15 : rowsPerColumn > 8 ? 17 : 19;
      const startX = columns === 1 ? 135 : 60;
      const columnWidth = columns === 1 ? 0 : 315;
      towerRows.forEach((tower, index) => {
        const column = Math.floor(index / rowsPerColumn);
        const row = index % rowsPerColumn;
        this.add.text(
          startX + column * columnWidth,
          575 + row * rowGap,
          `${index + 1}. ${tower.label}  ${formatDps(tower.dps)}`,
          {
            fontFamily: 'Arial, "Microsoft YaHei", sans-serif',
            fontSize: `${fontSize}px`,
            color: '#dce5ff',
            fontStyle: 'bold',
          },
        ).setOrigin(0, 0.5);
      });
    }

    const diagnosis = this.add.text(W / 2, 840, d.diagnosis?.text || t('result.tip'), {
      fontFamily: 'Arial, "Microsoft YaHei", sans-serif',
      fontSize: '20px',
      color: d.diagnosis?.upgradeId ? '#ffe97a' : '#c9d2f0',
      fontStyle: 'bold',
      align: 'center',
      wordWrap: { width: 520 },
      stroke: '#000000',
      strokeThickness: 4,
    }).setOrigin(0.5);
    if (d.diagnosis?.upgradeId) {
      diagnosis.setInteractive({ useHandCursor: true })
        .on('pointerdown', () => openShop(this, S));
    }

    makeDifficultySelector(this, 950, nextDifficulty, key => {
      nextDifficulty = key;
      this.registry.set('difficulty', key);
    }, { buttonW: 120, buttonH: 46, gap: 135, fontSize: 18, titleSize: 19 });

    makeButton(this, W / 2, 1025, 440, 70, t('result.retry'), {
      bg: 0x2e6b4f, stroke: 0x59c98f, fontSize: 29,
      onClick: () => this.scene.start('Game', { difficulty: nextDifficulty }),
    });
    makeButton(this, W / 2, 1110, 440, 60, t('result.workshop'), {
      bg: 0x6b5a2e, stroke: 0xd8b74f, fontSize: 24,
      onClick: () => openShop(this, S),
    });
    makeButton(this, W / 2, 1185, 440, 52, t('result.menu'), {
      bg: 0x51586e, fontSize: 21,
      onClick: () => this.scene.start('Menu'),
    });
  }
}
import Phaser from 'phaser';
