import { ENEMY_TYPES, waveHp } from '../config.js';

// 路径：折线 + 按距离取点
export class Path {
  constructor(points) {
    this.pts = points;
    this.lens = [];
    this.total = 0;
    for (let i = 1; i < points.length; i++) {
      const d = Phaser.Math.Distance.Between(points[i - 1].x, points[i - 1].y, points[i].x, points[i].y);
      this.lens.push(d);
      this.total += d;
    }
  }
  pointAt(dist) {
    let d = Phaser.Math.Clamp(dist, 0, this.total);
    for (let i = 0; i < this.lens.length; i++) {
      if (d <= this.lens[i]) {
        const a = this.pts[i], b = this.pts[i + 1], t = this.lens[i] === 0 ? 0 : d / this.lens[i];
        return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
      }
      d -= this.lens[i];
    }
    const last = this.pts[this.pts.length - 1];
    return { x: last.x, y: last.y };
  }
}

export class Enemy {
  constructor(scene, typeKey, wave, path, opts = {}) {
    this.scene = scene;
    this.typeKey = typeKey;
    this.type = ENEMY_TYPES[typeKey];
    this.path = path;
    this.maxHp = waveHp(wave) * this.type.hpMult * (opts.hpMult || 1);
    this.hp = this.maxHp;
    this.progress = opts.progress || 0;
    this.dead = false;
    this.armor = this.type.armor || 0;
    this.flying = !!this.type.flying;
    this.boss = !!this.type.boss;
    // 状态（秒数倒计时，随游戏速度缩放）
    this.slowT = 0; this.slowPct = 0;
    this.frozenT = 0;
    this.poisons = []; // {dps, t, lv7}
    this.bobPhase = Math.random() * Math.PI * 2;

    const p = path.pointAt(this.progress);
    const spriteY = this.flying ? -30 : 0;
    this.shadow = scene.add.image(0, 6, 'shadow').setScale(this.boss ? 1.8 : 0.8);
    this.spr = scene.add.image(0, spriteY, 'enemy_' + typeKey);
    const bw = this.boss ? 72 : 42;
    this.barBg = scene.add.rectangle(0, spriteY - this.type.size - 16, bw, 6, 0x000000, 0.55).setVisible(false);
    this.bar = scene.add.rectangle(0, spriteY - this.type.size - 16, bw, 6, 0x8bf05a).setVisible(false);
    this.c = scene.add.container(p.x, p.y, [this.shadow, this.spr, this.barBg, this.bar]);
    this.c.setDepth(p.y + (this.flying ? 220 : 0));
    // 入场弹跳
    this.c.setScale(0.3);
    scene.tweens.add({ targets: this.c, scale: 1, duration: 200, ease: 'Back.Out' });
  }

  get x() { return this.c.x; }
  get y() { return this.c.y; }

  applySlow(capPct) {
    this.slowPct = this.slowPct > 0 ? capPct : 30;
    this.slowT = 2;
    this.spr.setTint(0x88ccff);
  }

  applyFreeze(sec) {
    this.frozenT = Math.max(this.frozenT, sec);
    this.spr.setTint(0xaaddff);
  }

  applyPoison(dps, maxStacks, lv7) {
    const alive = this.poisons.filter(p => p.t > 0);
    if (alive.length < maxStacks) {
      alive.push({ dps, t: 5, lv7 });
    } else {
      // 刷新最快过期的一层
      let idx = 0;
      alive.forEach((p, i) => { if (p.t < alive[idx].t) idx = i; });
      alive[idx] = { dps: Math.max(alive[idx].dps, dps), t: 5, lv7 };
    }
    this.poisons = alive;
  }

  // 返回真实造成的伤害；trueDmg 无视护甲
  takeDamage(dmg, { trueDmg = false, cause = 'hit' } = {}) {
    if (this.dead) return 0;
    const real = trueDmg ? dmg : dmg * (1 - this.armor);
    this.hp -= real;
    this.barBg.setVisible(true); this.bar.setVisible(true);
    this.bar.width = Math.max(0, (this.boss ? 72 : 42) * (this.hp / this.maxHp));
    // 受击闪白（Phaser 4：setTintFill 已移除，改用 TintModes.FILL）
    this.spr.setTint(0xffffff).setTintMode(Phaser.TintModes.FILL);
    this.scene.time.delayedCall(45, () => { if (!this.dead) this.restoreTint(); });
    if (this.hp <= 0) this.die(cause);
    return real;
  }

  restoreTint() {
    this.spr.setTintMode(Phaser.TintModes.MULTIPLY);
    if (this.slowT > 0 || this.frozenT > 0) this.spr.setTint(0x88ccff);
    else this.spr.clearTint();
  }

  die(cause) {
    if (this.dead) return;
    this.dead = true;
    this.scene.onEnemyDead(this, cause);
  }

  update(dts) {
    if (this.dead) return;
    // 毒 DoT（无视护甲）
    let poisonDied = false;
    for (const p of this.poisons) {
      if (p.t <= 0) continue;
      const tick = Math.min(p.t, dts);
      p.t -= dts;
      this.hp -= p.dps * tick;
      if (this.hp <= 0) { poisonDied = true; break; }
    }
    if (poisonDied) {
      this.bar.width = 0;
      this.die('poison');
      return;
    }
    if (this.poisons.some(p => p.t > 0)) this.spr.setTint(0x99ee66);

    // 冻结 / 减速
    if (this.frozenT > 0) {
      this.frozenT -= dts;
      if (this.frozenT <= 0) this.restoreTint();
      else return; // 冻结不移动
    }
    let speedFactor = 1;
    if (this.slowT > 0) {
      this.slowT -= dts;
      speedFactor = 1 - this.slowPct / 100;
      if (this.slowT <= 0) { this.slowPct = 0; this.restoreTint(); }
    }

    this.progress += this.type.speed * speedFactor * dts;
    if (this.progress >= this.path.total) {
      this.scene.onEnemyLeak(this);
      return;
    }
    const p = this.path.pointAt(this.progress);
    this.c.setPosition(p.x, p.y);
    this.c.setDepth(p.y + (this.flying ? 220 : 0));
    if (this.flying) {
      this.bobPhase += dts * 6;
      this.spr.y = -30 + Math.sin(this.bobPhase) * 5;
    }
    if (this.hp < this.maxHp) {
      this.bar.width = Math.max(0, (this.boss ? 72 : 42) * (this.hp / this.maxHp));
    }
  }

  destroy() {
    this.c.destroy();
  }
}
