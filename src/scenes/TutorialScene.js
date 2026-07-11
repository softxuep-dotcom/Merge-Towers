import { W, H, ELEMENTS } from '../config.js';
import { makeButton, toast } from '../ui.js';
import { addTowerImage, fitTowerImageHeight } from '../textures.js';
import { writeSave } from '../save.js';
import { t } from '../i18n.js';

export class TutorialScene extends Phaser.Scene {
  constructor() { super('Tutorial'); }

  init(data = {}) {
    this.difficulty = data.difficulty || this.registry.get('difficulty') || 'easy';
    this.firstRun = !!data.firstRun;
  }

  create() {
    this.step = 0; this.gold = 100; this.towers = [];
    this.add.rectangle(W / 2, H / 2, W, H, 0x10172a);
    const g = this.add.graphics();
    g.fillGradientStyle(0x274463, 0x274463, 0x10172a, 0x10172a, 1); g.fillRect(0, 0, W, H);
    makeButton(this, 70, 55, 100, 54, t('common.back'), { bg: 0x293650, fontSize: 20, onClick: () => this.scene.start('Menu') });
    this.add.text(W / 2, 58, t('tutorial.title'), { fontFamily: 'Arial Black, "Microsoft YaHei"', fontSize: '38px', color: '#fff0a6' }).setOrigin(0.5);
    this.progress = this.add.text(W / 2, 120, '', { fontFamily: 'Arial, "Microsoft YaHei"', fontSize: '21px', color: '#8eabc9' }).setOrigin(0.5);
    this.card = this.add.rectangle(W / 2, 230, 630, 145, 0x18243a, 0.96).setStrokeStyle(2, 0x557da2);
    this.title = this.add.text(75, 190, '', { fontFamily: 'Arial, "Microsoft YaHei"', fontSize: '31px', color: '#ffffff', fontStyle: 'bold' });
    this.desc = this.add.text(75, 238, '', { fontFamily: 'Arial, "Microsoft YaHei"', fontSize: '22px', color: '#b9cce5', wordWrap: { width: 565 } });
    this.goldText = this.add.text(620, 345, '', { fontFamily: 'Arial Black', fontSize: '26px', color: '#ffd761' }).setOrigin(1, 0.5);
    this.slots = [{ x: 220, y: 570 }, { x: 500, y: 570 }, { x: 360, y: 805 }];
    for (const s of this.slots) {
      s.tower = null;
      this.add.circle(s.x, s.y, 68, 0x243650, 0.8).setStrokeStyle(3, 0x6284a5, 0.85);
      this.add.circle(s.x, s.y, 51, 0x10182a, 0.65).setStrokeStyle(1, 0x9db5cc, 0.35);
    }
    this.sellZone = this.add.rectangle(360, 1010, 260, 100, 0x542d3c).setStrokeStyle(3, 0xb75e72);
    this.sellLabel = this.add.text(360, 1010, t('tutorial.sellZone'), { fontFamily: 'Arial, "Microsoft YaHei"', fontSize: '27px', color: '#ffabb9', fontStyle: 'bold' }).setOrigin(0.5);
    this.buyBtn = makeButton(this, W / 2, 1160, 430, 86, t('tutorial.buyButton'), { bg: 0x2e755b, stroke: 0x65d6a0, fontSize: 29, onClick: () => this.buy() });
    this.input.on('drag', (_p, obj, x, y) => obj.setPosition(x, y));
    this.input.on('dragend', (_p, obj) => this.drop(obj.towerRef));
    this.refresh();
  }

  refresh() {
    const copy = [
      [t('tutorial.buyTitle'), t('tutorial.buyDesc')],
      [t('tutorial.mergeTitle'), t('tutorial.mergeDesc')],
      [t('tutorial.sellTitle'), t('tutorial.sellDesc')],
      [t('tutorial.doneTitle'), t('tutorial.doneDesc')],
    ];
    this.progress.setText(t('tutorial.progress', { step: Math.min(this.step + 1, 3) }));
    this.title.setText(copy[this.step][0]); this.desc.setText(copy[this.step][1]); this.goldText.setText(`💰 ${this.gold}`);
    this.buyBtn.setVisible(this.step === 0).setEnabled(this.step === 0);
    this.sellZone.setAlpha(this.step === 2 ? 1 : 0.45); this.sellLabel.setAlpha(this.step === 2 ? 1 : 0.45);
    if (this.step === 3) {
      this.progress.setText(t('tutorial.doneProgress'));
      this.buyBtn.setVisible(true).setEnabled(true); this.buyBtn.label.setText(t('tutorial.start'));
      this.buyBtn.removeAllListeners('pointerdown');
      this.buyBtn.on('pointerdown', () => this.finishTutorial());
    }
  }

  finishTutorial() {
    const save = this.registry.get('save');
    if (save) {
      save.tutorialDone = true;
      writeSave(save);
    }
    this.scene.start('Game', { difficulty: this.difficulty });
  }

  buy() {
    if (this.step !== 0 || this.gold < 20) return;
    const slot = this.slots.find(s => !s.tower); if (!slot) return;
    this.gold -= 20; this.addTower(slot, 1);
    if (this.towers.length === 2) { this.step = 1; toast(this, W / 2, 410, t('tutorial.buyToast'), '#8ff0b6', 25); }
    this.refresh();
  }

  addTower(slot, lv) {
    const image = fitTowerImageHeight(addTowerImage(this, 0, -15, 'fire', lv), 126);
    const badge = this.add.circle(34, 28, 17, 0x172033).setStrokeStyle(2, ELEMENTS.fire.color);
    const label = this.add.text(34, 28, String(lv), { fontFamily: 'Arial Black', fontSize: '18px', color: '#fff' }).setOrigin(0.5);
    const c = this.add.container(slot.x, slot.y, [image, badge, label]).setSize(130, 145).setInteractive({ draggable: true, useHandCursor: true });
    const t = { slot, lv, c }; c.towerRef = t; slot.tower = t; this.towers.push(t); return t;
  }

  drop(t) {
    if (!t) return;
    if (this.step === 2 && Phaser.Geom.Rectangle.Contains(this.sellZone.getBounds(), t.c.x, t.c.y)) {
      this.gold += 20; t.slot.tower = null; this.towers = this.towers.filter(x => x !== t); t.c.destroy(); this.step = 3; this.refresh(); return;
    }
    const target = this.slots.find(s => s !== t.slot && s.tower && Phaser.Math.Distance.Between(t.c.x, t.c.y, s.x, s.y) < 100);
    if (this.step === 1 && target && target.tower.lv === t.lv) {
      const other = target.tower; t.slot.tower = null; target.tower = null;
      this.towers = this.towers.filter(x => x !== t && x !== other); t.c.destroy(); other.c.destroy(); this.addTower(target, 2);
      this.step = 2; toast(this, W / 2, 410, t('tutorial.mergeToast'), '#ffe37a', 25); this.refresh(); return;
    }
    t.c.setPosition(t.slot.x, t.slot.y);
  }
}
