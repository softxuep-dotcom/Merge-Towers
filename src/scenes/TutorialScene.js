import Phaser from 'phaser';
import { ELEMENTS, H, W } from '../config.js';
import { makeButton, makePanel } from '../ui.js';
import { addTowerImage, fitTowerImageHeight } from '../textures.js';
import { writeSave } from '../save.js';
import { t } from '../i18n.js';

export class TutorialScene extends Phaser.Scene {
  constructor() { super('Tutorial'); }

  init(data = {}) {
    this.difficulty = data.difficulty || this.registry.get('difficulty') || 'easy';
  }

  create() {
    this.add.rectangle(W / 2, H / 2, W, H, 0x07131d);
    const bg = this.add.graphics();
    bg.fillGradientStyle(0x173e3d, 0x16384a, 0x07131d, 0x040a10, 1).fillRect(0, 0, W, H);
    makeButton(this, 72, 54, 110, 48, t('common.back'), { bg: 0x193041, fontSize: 18, onClick: () => this.scene.start('Menu') });
    this.add.text(W / 2, 86, '升级塔防训练', {
      fontFamily: 'Arial Black, "Microsoft YaHei"', fontSize: '40px', color: '#ffe29a',
    }).setOrigin(0.5);
    this.add.text(W / 2, 132, '固定五塔 · 源能升级 · 每级三选一', {
      fontFamily: 'Arial, "Microsoft YaHei"', fontSize: '18px', color: '#a9bdca', fontStyle: 'bold',
    }).setOrigin(0.5);

    const order = ['fire', 'ice', 'lightning', 'light', 'poison'];
    order.forEach((elem, i) => {
      const x = 96 + i * 132;
      const halo = this.add.circle(x, 258, 50, ELEMENTS[elem].color, 0.12);
      fitTowerImageHeight(addTowerImage(this, x, 278, elem, 1), i === 2 ? 122 : 105);
      this.add.text(x, 352, ELEMENTS[elem].cn, {
        fontFamily: 'Arial, "Microsoft YaHei"', fontSize: '17px', color: '#eaf3f2', fontStyle: 'bold',
      }).setOrigin(0.5);
      this.tweens.add({ targets: halo, scale: 1.14, alpha: 0.05, duration: 900 + i * 80, yoyo: true, repeat: -1 });
    });

    const cards = [
      ['01  固定五塔', '开局直接拥有火、水、电、光、毒五座 Lv1 塔。\n不再购买、拖动或合成塔。', 0x65d6a0],
      ['02  源能升级', '击杀与过波获得 ◆源能。点击“升级防御塔”，\n先决定升级哪座塔。', 0x72d6ff],
      ['03  每级决策', 'Lv1→Lv2 选择核心裂变；Lv3→Lv7 选择范围、\n频率或强度；Lv8 选择终极变异。', 0xffd166],
    ];
    cards.forEach(([title, desc, color], i) => {
      const y = 485 + i * 178;
      makePanel(this, W / 2, y, 620, 142, { fill: 0x10202b, alpha: 0.95, stroke: color, strokeAlpha: 0.55, accentColor: color, accentWidth: 78 });
      this.add.text(78, y - 40, title, { fontFamily: 'Arial, "Microsoft YaHei"', fontSize: '25px', color: '#f3f6f4', fontStyle: 'bold' });
      this.add.text(78, y, desc, { fontFamily: 'Arial, "Microsoft YaHei"', fontSize: '18px', color: '#b7c8d1', lineSpacing: 7 });
    });

    makeButton(this, W / 2, 1125, 470, 76, t('tutorial.start'), {
      bg: 0x2e8061, stroke: 0x68dfaa, fontSize: 28,
      onClick: () => {
        const save = this.registry.get('save');
        if (save) { save.tutorialDone = true; save.tutorialVersion = 3; writeSave(save); }
        this.scene.start('Game', { difficulty: this.difficulty });
      },
    });
  }
}
