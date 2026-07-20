import {
  BRANCH_START_LV, ELEMENTS, FIRE_BRANCH_BALANCE, MAX_LV, TOWER_BRANCHES, TOWER_RANGE_MULT,
  branchTierValue, towerDmg, towerRange,
} from '../config.js';
import { addTowerImage, applyTowerImage, fitTowerImageHeight } from '../textures.js';
import { coreSkillDef, frequencyRank, powerMultiplier, rangeRank } from '../towerUpgrades.js';

const BRANCH_MARKS = {
  fire: { a: '✹', b: '♨' },
  ice: { a: '❄', b: '✦' },
  lightning: { a: 'ϟ', b: '⌾' },
  poison: { a: '☣', b: '⬡' },
  light: { a: '✧', b: '☀' },
};
const BRANCH_ACCENTS = { a: 0xffd166, b: 0x72d6ff };

export class Tower {
  constructor(scene, slot, elem, lv, branch = null) {
    this.scene = scene;
    this.slot = slot;        // { x, y, tower } 引用
    this.elem = elem;
    this.lv = lv;
    this.id = scene.nextTowerId++;
    this.branch = null;
    this.skill = null;
    this.ranks = { range: 0, frequency: 0, power: 0 };
    this.attackCount = 0;
    this.hasMoved = false;
    this.cooldown = 0;
    this.dragging = false;
    this.selfBuffT = 0;

    const e = ELEMENTS[elem];
    this.shadow = scene.add.ellipse(0, 17, 68, 20, 0x000000, 0.24)
      .setAlpha(0)
      .setVisible(false);
    this.highlightGlow = scene.add.image(0, -22, 'glow')
      .setTint(e.color)
      .setAlpha(0)
      .setScale(1.05)
      .setVisible(false);
    this.targetSpriteHeight = 106 * (0.85 + lv * 0.07);
    this.spr = fitTowerImageHeight(
      addTowerImage(scene, 0, -22, elem, lv, this.visualBranch),
      this.targetSpriteHeight,
    );
    this.badge = scene.add.circle(20, 8, 13, 0x1c1f2e, 0.92).setStrokeStyle(2, e.color);
    this.lvText = scene.add.text(20, 8, String(lv), {
      fontFamily: 'Arial Black, sans-serif', fontSize: '16px', color: '#ffffff',
    }).setOrigin(0.5);
    const children = [this.shadow, this.highlightGlow];
    // 满级常驻光环
    if (lv >= MAX_LV) {
      this.aura = scene.add.image(0, -20, 'glow').setScale(2.6).setTint(e.color).setAlpha(0.8);
      children.push(this.aura);
      scene.tweens.add({ targets: this.aura, scale: 3.1, alpha: 0.5, duration: 800, yoyo: true, repeat: -1 });
    }
    children.push(this.spr, this.badge, this.lvText);
    this.c = scene.add.container(slot.x, slot.y - 8, children);
    this.c.setDepth(slot.y);
    // The painted crystal extends well above the base. Keep the entire visible
    // tower inside the hit area so grabbing the crystal works on touch screens.
    this.c.setSize(112, 180);
    this.c.setInteractive({ useHandCursor: true });
    this.c.towerRef = this;
  }

  get dmg() { return towerDmg(this.elem, this.lv) * powerMultiplier(this); }
  get range() { return towerRange(this.lv) * (TOWER_RANGE_MULT[this.elem] || 1) * (1 + 0.06 * rangeRank(this)); }
  get rate() {
    const branchMult = this.elem === 'fire' && this.skill === 'molten'
      ? (this.ranks.power >= 3 ? 0.85 : 0.8)
      : 1;
    return ELEMENTS[this.elem].rate * branchMult * (1 + 0.08 * frequencyRank(this));
  }
  get goldMult() { return 1; }
  get color() { return ELEMENTS[this.elem].color; }
  get branchDef() { return this.branch ? TOWER_BRANCHES[this.elem]?.[this.branch] : null; }
  get visualBranch() {
    if (!this.skill) return null;
    const defs = {
      fire: { blast: 'a', molten: 'b', scorched: 'a' },
      ice: { glacier: 'a', vortex: 'b', mirror: 'a' },
      lightning: { chain: 'a', nexus: 'b', magstorm: 'a' },
      poison: { plague: 'a', corrosion: 'b', spores: 'a' },
      light: { judgement: 'a', radiance: 'b', refraction: 'a' },
    };
    return defs[this.elem]?.[this.skill] || 'a';
  }

  // 攻击间隔计时；buffMult = 光 Lv7 全场攻速 buff
  tickCooldown(dts, buffMult) {
    if (this.selfBuffT > 0) this.selfBuffT = Math.max(0, this.selfBuffT - dts);
    const selfBuff = this.selfBuffT > 0 ? (this.selfBuffMult || 1.5) : 1;
    this.cooldown -= dts * this.rate * buffMult * selfBuff;
  }
  ready() { return this.cooldown <= 0; }
  resetCooldown() { this.cooldown = 1; }

  branchLabel() {
    return coreSkillDef(this.elem, this.skill)?.icon || '?';
  }

  branchAccent() {
    return BRANCH_ACCENTS[this.visualBranch] || this.color;
  }

  refreshVisual() {
    applyTowerImage(this.spr, this.scene, this.elem, this.lv, this.visualBranch);
    fitTowerImageHeight(this.spr, this.targetSpriteHeight);
  }

  refreshLevelVisual() {
    this.targetSpriteHeight = 106 * (0.85 + this.lv * 0.07);
    this.lvText.setText(String(this.lv));
    this.refreshVisual();
    if (this.skill && !this.branchBadge) {
      this.branchBadge = this.scene.add.circle(-22, 8, 13, 0x1c1f2e, 0.92).setStrokeStyle(2, this.branchAccent());
      this.branchText = this.scene.add.text(-22, 8, this.branchLabel(), {
        fontFamily: 'Arial, "Microsoft YaHei", sans-serif', fontSize: '16px', color: '#ffffff',
      }).setOrigin(0.5);
      this.c.add([this.branchBadge, this.branchText]);
    }
    if (this.branchText) this.branchText.setText(this.branchLabel());
    if (this.branchBadge) this.branchBadge.setStrokeStyle(2, this.branchAccent());
    if (this.lv >= MAX_LV && !this.aura) {
      this.aura = this.scene.add.image(0, -20, 'glow').setScale(2.6).setTint(this.color).setAlpha(0.8);
      this.c.addAt(this.aura, 2);
      this.scene.tweens.add({ targets: this.aura, scale: 3.1, alpha: 0.5, duration: 800, yoyo: true, repeat: -1 });
    }
  }

  setBranch(branch) {
    this.branch = this.lv >= BRANCH_START_LV ? branch : null;
    this.refreshVisual();
    if (!this.branchText) return;
    this.branchText.setText(this.branchLabel());
    this.branchText.setColor(this.branch ? '#ffffff' : '#ffe97a');
    this.branchBadge.setAlpha(this.branch ? 1 : 0.72);
    this.branchBadge.setStrokeStyle(2, this.branchAccent());
  }

  // 开火后坐力小动画
  recoil() {
    this.scene.tweens.add({ targets: this.spr, scaleX: this.spr.scaleX * 0.88, scaleY: this.spr.scaleY * 1.1, duration: 60, yoyo: true });
  }

  setHighlight(on) {
    this.scene.tweens.killTweensOf(this.highlightGlow);
    if (on) {
      this.spr.setTint(0xffffff);
      this.highlightGlow
        .setVisible(true)
        .setScale(1.12)
        .setAlpha(0.24);
      this.highlightTween = this.scene.tweens.add({
        targets: this.highlightGlow,
        scale: 1.62,
        alpha: 0.52,
        duration: 520,
        ease: 'Sine.InOut',
        yoyo: true,
        repeat: -1,
      });
    } else {
      this.spr.clearTint();
      if (this.highlightTween) {
        this.highlightTween.stop();
        this.highlightTween = null;
      }
      this.highlightGlow
        .setAlpha(0)
        .setScale(1.05)
        .setVisible(false);
    }
  }

  setDraggingVisual(on) {
    this.scene.tweens.killTweensOf([this.c, this.shadow]);
    if (on) {
      this.shadow
        .setVisible(true)
        .setAlpha(0)
        .setScale(0.85);
      this.scene.tweens.add({
        targets: this.c,
        scaleX: 1.15,
        scaleY: 1.15,
        duration: 100,
        ease: 'Back.Out',
      });
      this.scene.tweens.add({
        targets: this.shadow,
        alpha: 0.34,
        scaleX: 1.18,
        scaleY: 1,
        duration: 100,
        ease: 'Quad.Out',
      });
    } else {
      this.scene.tweens.add({
        targets: this.c,
        scaleX: 1,
        scaleY: 1,
        duration: 120,
        ease: 'Quad.Out',
      });
      this.scene.tweens.add({
        targets: this.shadow,
        alpha: 0,
        scaleX: 0.85,
        scaleY: 0.85,
        duration: 110,
        ease: 'Quad.Out',
        onComplete: () => this.shadow.setVisible(false),
      });
    }
  }

  moveTo(slot, opts = {}) {
    this.slot = slot;
    this.scene.tweens.killTweensOf(this.c);
    const x = slot.x;
    const y = slot.y - 8;
    if (opts.animate === false) {
      this.c.setPosition(x, y);
      this.c.setScale(1);
      this.c.setDepth(slot.y);
      return;
    }
    this.c.setDepth(slot.y + 180);
    this.scene.tweens.add({
      targets: this.c,
      x,
      y,
      scaleX: 1,
      scaleY: 1,
      duration: 140,
      ease: 'Back.Out',
      onComplete: () => {
        this.c.setDepth(slot.y);
      },
    });
  }

  destroy() {
    this.scene.tweens.killTweensOf([this.c, this.spr, this.shadow, this.highlightGlow, this.aura].filter(Boolean));
    this.c.destroy();
  }
}
