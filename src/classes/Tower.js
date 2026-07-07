import { ELEMENTS, MAX_LV, towerDmg, towerRange } from '../config.js';

export class Tower {
  constructor(scene, slot, elem, lv) {
    this.scene = scene;
    this.slot = slot;        // { x, y, tower } 引用
    this.elem = elem;
    this.lv = lv;
    this.cooldown = 0;
    this.dragging = false;

    const e = ELEMENTS[elem];
    this.spr = scene.add.image(0, -18, 'tower_' + elem).setScale(0.72 + lv * 0.06);
    this.badge = scene.add.circle(20, 8, 13, 0x1c1f2e, 0.92).setStrokeStyle(2, e.color);
    this.lvText = scene.add.text(20, 8, String(lv), {
      fontFamily: 'Arial Black, sans-serif', fontSize: '16px', color: '#ffffff',
    }).setOrigin(0.5);
    const children = [this.spr, this.badge, this.lvText];
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

  get dmg() { return towerDmg(this.elem, this.lv); }
  get range() { return towerRange(this.lv); }
  get rate() { return ELEMENTS[this.elem].rate; }
  get color() { return ELEMENTS[this.elem].color; }

  // 攻击间隔计时；buffMult = 光 Lv7 全场攻速 buff
  tickCooldown(dts, buffMult) {
    this.cooldown -= dts * this.rate * buffMult;
  }
  ready() { return this.cooldown <= 0; }
  resetCooldown() { this.cooldown = 1; }

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
