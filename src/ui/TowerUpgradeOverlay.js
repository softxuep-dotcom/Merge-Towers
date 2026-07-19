import Phaser from 'phaser';
import { ELEMENTS, H, W } from '../config.js';
import { t } from '../i18n.js';
import { towerSkillName, upgradeCostFor } from '../towerUpgrades.js';

const FONT = 'Arial, "Microsoft YaHei", sans-serif';

export class TowerUpgradeOverlay {
  constructor(scene) {
    this.scene = scene;
    this.root = null;
    this.keyHandler = null;
  }

  isPortrait() {
    return this.scene.scale.height > this.scene.scale.width * 1.25;
  }

  begin(title, subtitle) {
    this.destroy();
    const s = this.scene;
    this.root = s.add.container(0, 0).setDepth(5200);
    const shade = s.add.rectangle(W / 2, H / 2, W, H, 0x02070d, 0.78).setInteractive();
    const topGlow = s.add.ellipse(W / 2, 130, 620, 230, 0xffdc72, 0.07);
    const heading = s.add.text(W / 2, 112, title, {
      fontFamily: FONT, fontSize: '38px', fontStyle: 'bold', color: '#ffe59a',
      stroke: '#25180a', strokeThickness: 5,
    }).setOrigin(0.5);
    const sub = s.add.text(W / 2, 158, subtitle, {
      fontFamily: FONT, fontSize: '18px', color: '#b8c7d6', align: 'center',
    }).setOrigin(0.5);
    this.root.add([shade, topGlow, heading, sub]);
    return this.root;
  }

  card({ x, y, w, h, color, icon, name, description, badge, index, onPick, compact = false }) {
    const s = this.scene;
    const c = s.add.container(x, y);
    const bg = s.add.rectangle(0, 0, w, h, 0x0e1a1d, 0.97).setRounded(18)
      .setStrokeStyle(2, color, 0.42);
    const line = s.add.rectangle(0, -h / 2 + 4, w - 28, 5, color, 0.9).setRounded(3);
    const number = s.add.text(-w / 2 + 18, -h / 2 + 15, String(index + 1), {
      fontFamily: FONT, fontSize: '13px', color: '#9cb1bd', fontStyle: 'bold',
    }).setOrigin(0, 0);
    const badgeText = s.add.text(w / 2 - 16, -h / 2 + 15, badge, {
      fontFamily: FONT, fontSize: '11px', color: '#cfe3d8', fontStyle: 'bold',
    }).setOrigin(1, 0);
    const iconY = compact ? -20 : -52;
    const iconCircle = s.add.circle(compact ? -w / 2 + 48 : 0, iconY, compact ? 27 : 34, 0x17282b, 1)
      .setStrokeStyle(2, color, 0.78);
    const iconText = s.add.text(iconCircle.x, iconY, icon, {
      fontFamily: FONT, fontSize: compact ? '26px' : '34px', color: '#ffffff', fontStyle: 'bold',
    }).setOrigin(0.5);
    const nameX = compact ? -w / 2 + 88 : 0;
    const nameY = compact ? -36 : 4;
    const title = s.add.text(nameX, nameY, name, {
      fontFamily: FONT, fontSize: compact ? '22px' : '21px', color: '#f4f7f2', fontStyle: 'bold',
      align: compact ? 'left' : 'center',
    }).setOrigin(compact ? 0 : 0.5, 0.5);
    const desc = s.add.text(compact ? -w / 2 + 88 : 0, compact ? -3 : 45, description, {
      fontFamily: FONT, fontSize: compact ? '15px' : '14px', color: '#b8c7c0',
      align: compact ? 'left' : 'center', wordWrap: { width: compact ? w - 112 : w - 24, useAdvancedWrap: true },
      lineSpacing: 3,
    }).setOrigin(compact ? 0 : 0.5, compact ? 0 : 0);
    c.add([bg, line, number, badgeText, iconCircle, iconText, title, desc]);
    c.setSize(w, h).setInteractive({ useHandCursor: true });
    c.on('pointerover', () => {
      bg.setFillStyle(0x19302b, 1).setStrokeStyle(3, 0xffdf82, 0.95);
      s.tweens.add({ targets: c, scale: 1.025, duration: 90 });
    });
    c.on('pointerout', () => {
      bg.setFillStyle(0x0e1a1d, 0.97).setStrokeStyle(2, color, 0.42);
      s.tweens.add({ targets: c, scale: 1, duration: 90 });
    });
    c.on('pointerdown', () => {
      c.disableInteractive();
      s.tweens.add({ targets: c, scale: 0.94, duration: 55, yoyo: true, onComplete: onPick });
    });
    this.root.add(c);
    return c;
  }

  bindKeys(items, onPick, onCancel) {
    this.keyHandler = event => {
      if (event.key === 'Escape') { onCancel?.(); return; }
      const index = Number(event.key) - 1;
      if (index >= 0 && index < items.length) onPick(items[index]);
    };
    window.addEventListener('keydown', this.keyHandler);
  }

  showTowerPicker(towers, sourceEnergy, onPick, onCancel) {
    const portrait = this.isPortrait();
    this.begin(t('upgradeCards.chooseTower'), t('upgradeCards.energy', { value: sourceEnergy.toFixed(1) }));
    if (portrait) {
      towers.forEach((tower, i) => {
        const elem = ELEMENTS[tower.elem];
        const cost = upgradeCostFor(tower);
        const blocked = !Number.isFinite(cost) || tower.lastUpgradeWave === this.scene.wave || sourceEnergy + 1e-6 < cost;
        this.card({
          x: W / 2, y: 285 + i * 136, w: 650, h: 116, compact: true, index: i,
          color: blocked ? 0x53606a : elem.color, icon: elem.key === 'ice' ? '💧' : ['🔥', '⚡', '☀', '☣'][['fire', 'lightning', 'light', 'poison'].indexOf(tower.elem)] || '◆',
          name: `${elem.cn}  Lv${tower.lv}`,
          description: `${towerSkillName(tower)}  ·  ${Number.isFinite(cost) ? `${t('upgradeCards.cost')} ${cost}` : 'MAX'}`,
          badge: blocked ? t('upgradeCards.unavailable') : t('upgradeCards.select'),
          onPick: () => { if (!blocked) onPick(tower); },
        }).setAlpha(blocked ? 0.46 : 1);
      });
    } else {
      const w = 126, gap = 10, startX = W / 2 - ((w + gap) * 5 - gap) / 2 + w / 2;
      towers.forEach((tower, i) => {
        const elem = ELEMENTS[tower.elem];
        const cost = upgradeCostFor(tower);
        const blocked = !Number.isFinite(cost) || tower.lastUpgradeWave === this.scene.wave || sourceEnergy + 1e-6 < cost;
        this.card({
          x: startX + i * (w + gap), y: 610, w, h: 330, index: i, color: blocked ? 0x53606a : elem.color,
          icon: elem.key === 'ice' ? '💧' : ['🔥', '⚡', '☀', '☣'][['fire', 'lightning', 'light', 'poison'].indexOf(tower.elem)] || '◆',
          name: `${elem.cn}\nLv${tower.lv}`,
          description: `${towerSkillName(tower)}\n\n${Number.isFinite(cost) ? `${t('upgradeCards.cost')} ${cost}` : 'MAX'}`,
          badge: blocked ? t('upgradeCards.unavailable') : t('upgradeCards.select'),
          onPick: () => { if (!blocked) onPick(tower); },
        }).setAlpha(blocked ? 0.46 : 1);
      });
    }
    const cancel = sButton(this.scene, W / 2, 1120, t('upgradeCards.back'), onCancel);
    this.root.add(cancel);
    this.bindKeys(towers, tower => {
      const cost = upgradeCostFor(tower);
      if (Number.isFinite(cost) && tower.lastUpgradeWave !== this.scene.wave && sourceEnergy + 1e-6 >= cost) onPick(tower);
    }, onCancel);
  }

  showChoices(tower, choices, onPick, onCancel, options = {}) {
    const portrait = this.isPortrait();
    const elem = ELEMENTS[tower.elem];
    this.begin(`${elem.cn}  Lv${tower.lv} → Lv${tower.lv + 1}`, t('upgradeCards.lockedChoice'));
    if (portrait) {
      choices.forEach((choice, i) => this.card({
        x: W / 2, y: 330 + i * 190, w: 650, h: 166, compact: true, index: i,
        color: choice.color, icon: choice.icon, name: choice.name, description: choice.description,
        badge: choice.badge, onPick: () => onPick(choice),
      }));
    } else {
      const w = 205, gap = 18, startX = W / 2 - ((w + gap) * 3 - gap) / 2 + w / 2;
      choices.forEach((choice, i) => this.card({
        x: startX + i * (w + gap), y: 610, w, h: 350, index: i,
        color: choice.color, icon: choice.icon, name: choice.name, description: choice.description,
        badge: choice.badge, onPick: () => onPick(choice),
      }));
    }
    if (!options.mandatory) {
      const cancel = sButton(this.scene, W / 2, 1120, t('upgradeCards.back'), onCancel);
      this.root.add(cancel);
    }
    this.bindKeys(choices, onPick, options.mandatory ? null : onCancel);
  }

  showGlobalDraft(cards, onPick) {
    const portrait = this.isPortrait();
    this.begin('升级已就绪 · 4 选 1', '所有卡片等概率出现，可跨属性自由升级');
    if (portrait) {
      cards.forEach((card, i) => this.card({
        x: W / 2, y: 290 + i * 166, w: 650, h: 148, compact: true, index: i,
        color: card.color, icon: card.icon, name: card.name, description: card.description,
        badge: card.badge, onPick: () => onPick(card),
      }));
    } else {
      const w = 158, gap = 12, startX = W / 2 - ((w + gap) * 4 - gap) / 2 + w / 2;
      cards.forEach((card, i) => this.card({
        x: startX + i * (w + gap), y: 610, w, h: 360, index: i,
        color: card.color, icon: card.icon, name: card.name, description: card.description,
        badge: card.badge, onPick: () => onPick(card),
      }));
    }
    this.bindKeys(cards, onPick, null);
  }

  destroy() {
    if (this.keyHandler) window.removeEventListener('keydown', this.keyHandler);
    this.keyHandler = null;
    if (this.root) this.root.destroy(true);
    this.root = null;
  }
}

function sButton(scene, x, y, label, onClick) {
  const c = scene.add.container(x, y);
  const bg = scene.add.rectangle(0, 0, 190, 48, 0x18252e, 0.94).setRounded(14).setStrokeStyle(1, 0x748693, 0.6);
  const text = scene.add.text(0, 0, label, { fontFamily: FONT, fontSize: '17px', color: '#cbd7df', fontStyle: 'bold' }).setOrigin(0.5);
  c.add([bg, text]).setSize(190, 48).setInteractive({ useHandCursor: true }).on('pointerdown', onClick);
  return c;
}
