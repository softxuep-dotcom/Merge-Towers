import { ELEMENTS, MAX_LV, TOWER_BRANCHES, towerDmg, towerRange } from '../config.js';

export class Tower {
  constructor(scene, slot, elem, lv, branch = null) {
    this.scene = scene;
    this.slot = slot;        // { x, y, tower } 引用
    this.elem = elem;
    this.lv = lv;
    this.branch = lv >= 4 ? branch : null;
    this.cooldown = 0;
    this.dragging = false;
    this.selfBuffT = 0;

    const e = ELEMENTS[elem];
    this.spr = scene.add.image(0, -22, 'tower_' + elem).setScale(0.85 + lv * 0.07);
    this.badge = scene.add.circle(20, 8, 13, 0x1c1f2e, 0.92).setStrokeStyle(2, e.color);
    this.lvText = scene.add.text(20, 8, String(lv), {
      fontFamily: 'Arial Black, sans-serif', fontSize: '16px', color: '#ffffff',
    }).setOrigin(0.5);
    const children = [this.spr, this.badge, this.lvText];
    if (lv >= 4) {
      this.branchBadge = scene.add.circle(-22, 8, 13, 0x1c1f2e, this.branch ? 0.92 : 0.72).setStrokeStyle(2, e.color);
      this.branchText = scene.add.text(-22, 8, this.branchLabel(), {
        fontFamily: 'Arial Black, sans-serif', fontSize: '15px', color: this.branch ? '#ffffff' : '#ffe97a',
      }).setOrigin(0.5);
      children.push(this.branchBadge, this.branchText);
    }
    // Lv8 常驻光环
    if (lv >= MAX_LV) {
      this.aura = scene.add.image(0, -20, 'glow').setScale(2.6).setTint(e.color).setAlpha(0.8);
      children.unshift(this.aura);
      scene.tweens.add({ targets: this.aura, scale: 3.1, alpha: 0.5, duration: 800, yoyo: true, repeat: -1 });
    }
    this.c = scene.add.container(slot.x, slot.y - 8, children);
    this.c.setDepth(slot.y);
    this.c.setSize(96, 100);
    this.c.setInteractive({ draggable: true, useHandCursor: true });
    this.c.towerRef = this;
  }

  get dmg() { return towerDmg(this.elem, this.lv) * (this.slot.affix?.dmgMult || 1); }
  get range() { return towerRange(this.lv); }
  get rate() {
    const branchMult = this.elem === 'fire' && this.branch === 'b' && this.lv >= 4 ? 0.5 : 1;
    return ELEMENTS[this.elem].rate * (this.slot.affix?.rateMult || 1) * branchMult;
  }
  get goldMult() { return this.slot.affix?.goldMult || 1; }
  get color() { return ELEMENTS[this.elem].color; }
  get branchDef() { return this.branch ? TOWER_BRANCHES[this.elem]?.[this.branch] : null; }

  // 攻击间隔计时；buffMult = 光 Lv7 全场攻速 buff
  tickCooldown(dts, buffMult) {
    if (this.selfBuffT > 0) this.selfBuffT = Math.max(0, this.selfBuffT - dts);
    const selfBuff = this.selfBuffT > 0 ? 1.5 : 1;
    this.cooldown -= dts * this.rate * buffMult * selfBuff;
  }
  ready() { return this.cooldown <= 0; }
  resetCooldown() { this.cooldown = 1; }

  branchLabel() {
    return TOWER_BRANCHES[this.elem]?.[this.branch]?.short || '?';
  }

  setBranch(branch) {
    this.branch = this.lv >= 4 ? branch : null;
    if (!this.branchText) return;
    this.branchText.setText(this.branchLabel());
    this.branchText.setColor(this.branch ? '#ffffff' : '#ffe97a');
    this.branchBadge.setAlpha(this.branch ? 1 : 0.72);
  }

  // 开火后坐力小动画
  recoil() {
    this.scene.tweens.add({ targets: this.spr, scaleX: this.spr.scaleX * 0.88, scaleY: this.spr.scaleY * 1.1, duration: 60, yoyo: true });
  }

  setHighlight(on) {
    if (on) this.spr.setTint(0xffffff);
    else this.spr.clearTint();
  }

  moveTo(slot) {
    this.slot = slot;
    this.c.setPosition(slot.x, slot.y - 8);
    this.c.setDepth(slot.y);
  }

  destroy() {
    this.c.destroy();
  }
}
