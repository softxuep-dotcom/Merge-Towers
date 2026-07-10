import { ENEMY_TYPES, ELITE, waveHp, BOSS_AFFIXES, BOSS_CONTROL } from '../config.js';
import {
  paintedEnemyAnimationSource,
  paintedEnemyAnimKey,
  paintedEnemyDirectionFlipX,
  paintedEnemyFrameKey,
  paintedEnemyFrameTarget,
  paintedEnemyKey,
  paintedEnemyPlaybackDirection,
  paintedEnemyTextureKey,
} from '../textures.js';

// 路径：Catmull-Rom 样条平滑 + 按距离取点（拐弯走圆弧而非折线急转）
export class Path {
  constructor(points) {
    this.raw = points;
    let pts = points;
    if (points.length >= 3) {
      const spline = new Phaser.Curves.Spline(points.flatMap(p => [p.x, p.y]));
      pts = spline.getSpacedPoints(Math.max(32, Math.round(spline.getLength() / 10)))
        .map(v => ({ x: v.x, y: v.y }));
    }
    this.pts = pts;
    this.lens = [];
    this.total = 0;
    for (let i = 1; i < pts.length; i++) {
      const d = Phaser.Math.Distance.Between(pts[i - 1].x, pts[i - 1].y, pts[i].x, pts[i].y);
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
    this.armor = Math.min(0.8, (this.type.armor || 0) + (opts.armorBonus || 0));
    this.flying = !!this.type.flying;
    this.boss = !!this.type.boss;
    this.bossAffixes = Array.isArray(opts.bossAffixes) ? opts.bossAffixes.slice() : [];
    this.controlResist = opts.controlResist ?? (this.boss ? BOSS_CONTROL.defaultResist : 0);
    this.hardControlCd = opts.hardControlCd ?? (this.boss ? BOSS_CONTROL.hardControlCd : 2);
    this.speedMult = opts.speedMult || 1;
    this.speedCap = opts.speedCap || Infinity;
    this.rage = !!opts.rage;
    this.rageActive = false;
    this.rageSpeedMult = opts.rageSpeedMult || 1;
    this.rageSlowScale = opts.rageSlowScale || 1;
    this.twinHealPct = opts.twinHealPct || 0;
    this.twinGroupId = opts.twinGroupId || null;
    this.elite = !!opts.eliteAffix;
    this.eliteAffix = opts.eliteAffix || null;
    this.eliteShield = this.eliteAffix === 'shield' ? ELITE.shieldHits : 0;
    this.rewardGoldMult = this.elite ? ELITE.goldMult : 1;
    this.killGoldMult = 1;
    // 状态（秒数倒计时，随游戏速度缩放）
    this.slowT = 0; this.slowPct = 0;
    this.frozenT = 0;
    this.stunnedT = 0;
    this.hardControlImmuneT = 0;
    this.corrodedT = 0;
    this.corrosionPct = 0;
    this.poisons = []; // {dps, t, lv7, goldMult, plague, plagueRadius, sourceBonus}
    this.bobPhase = Math.random() * Math.PI * 2;

    const p = path.pointAt(this.progress);
    const spriteY = this.flying ? -30 : 0;
    this.shadow = scene.add.image(0, 6, 'shadow').setScale((this.boss ? 1.8 : 0.8) * (this.elite ? 1.25 : 1));
    this.paintedKey = paintedEnemyKey(typeKey);
    this.paintedAtlasKey = paintedEnemyTextureKey(scene, this.paintedKey);
    this.usesPaintedSprite = !!this.paintedAtlasKey && !!paintedEnemyAnimationSource(scene, this.paintedKey, 'left');
    if (this.usesPaintedSprite) {
      const initialDirection = paintedEnemyAnimationSource(scene, this.paintedKey, 'left');
      this.spr = scene.add.sprite(0, spriteY, this.paintedAtlasKey, paintedEnemyFrameKey(this.paintedKey, initialDirection, 1));
      const target = paintedEnemyFrameTarget(this.paintedKey, this.type);
      this.spr.setScale(target / this.spr.height);
      const next = path.pointAt(Math.min(path.total, this.progress + 6));
      this.setFacingByDelta(next.x - p.x, next.y - p.y);
    } else {
      this.spr = scene.add.image(0, spriteY, 'enemy_' + typeKey);
    }
    this.shadow.y = this.flying ? 8 : spriteY + Math.max(14, this.spr.displayHeight * 0.38);
    const bw = this.boss ? 72 : 42;
    this.barBg = scene.add.rectangle(0, spriteY - this.type.size - 16, bw, 6, 0x000000, 0.55).setVisible(false);
    this.bar = scene.add.rectangle(0, spriteY - this.type.size - 16, bw, 6, 0x8bf05a).setVisible(false);
    const children = [this.shadow, this.spr, this.barBg, this.bar];
    if (this.elite) {
      const affix = ELITE.affixes[this.eliteAffix];
      this.eliteHalo = scene.add.image(0, spriteY, 'glow').setTint(affix.color).setAlpha(0.55).setScale(1.35);
      this.eliteIcon = scene.add.text(0, spriteY - this.type.size - 32, affix.icon, {
        fontFamily: 'Arial, "Microsoft YaHei", sans-serif',
        fontSize: '18px',
        color: '#ffffff',
        stroke: '#000000',
        strokeThickness: 4,
      }).setOrigin(0.5);
      children.unshift(this.eliteHalo);
      children.push(this.eliteIcon);
      scene.tweens.add({ targets: this.eliteHalo, scale: 1.68, alpha: 0.34, duration: 800, yoyo: true, repeat: -1 });
    }
    if (this.boss && this.bossAffixes.length) {
      const label = this.bossAffixes.map(k => BOSS_AFFIXES[k]?.icon || '?').join('');
      this.bossAffixIcon = scene.add.text(0, spriteY - this.type.size - 36, label, {
        fontFamily: 'Arial, "Microsoft YaHei", sans-serif',
        fontSize: '22px',
        color: '#ffe97a',
        stroke: '#000000',
        strokeThickness: 5,
      }).setOrigin(0.5);
      children.push(this.bossAffixIcon);
    }
    this.c = scene.add.container(p.x, p.y, children);
    this.c.setDepth(p.y + (this.flying ? 220 : 0));
    // 入场弹跳
    this.c.setScale(0.3);
    scene.tweens.add({ targets: this.c, scale: this.elite ? ELITE.sizeMult : 1, duration: 200, ease: 'Back.Out' });
  }

  get x() { return this.c.x; }
  get y() { return this.c.y; }

  controlScale() {
    return 1 - Phaser.Math.Clamp(this.controlResist || 0, 0, 0.95);
  }

  applySlow(capPct, duration = 2, basePct = 30, stackPct = 0) {
    const slowScale = this.controlScale() * (this.rageActive ? this.rageSlowScale : 1);
    const currentRawPct = slowScale > 0 ? this.slowPct / slowScale : this.slowPct;
    const rawPct = stackPct > 0
      ? Math.min(capPct, Math.max(basePct, currentRawPct + stackPct))
      : (this.slowPct > 0 ? capPct : basePct);
    const nextPct = rawPct * slowScale;
    this.slowPct = Math.max(this.slowPct, nextPct);
    this.slowT = Math.max(this.slowT, duration);
    this.spr.setTint(0x88ccff);
  }

  applyFreeze(sec) {
    if (this.hardControlImmuneT > 0 || this.frozenT > 0 || this.stunnedT > 0) return false;
    const duration = sec * this.controlScale();
    if (duration <= 0.02) return false;
    this.frozenT = Math.max(this.frozenT, duration);
    this.hardControlImmuneT = Math.max(this.hardControlImmuneT, this.hardControlCd);
    this.spr.setTint(0xaaddff);
    return true;
  }

  applyStun(sec) {
    if (this.hardControlImmuneT > 0 || this.frozenT > 0 || this.stunnedT > 0) return false;
    const duration = sec * this.controlScale();
    if (duration <= 0.02) return false;
    this.stunnedT = Math.max(this.stunnedT, duration);
    this.hardControlImmuneT = Math.max(this.hardControlImmuneT, this.hardControlCd);
    this.spr.setTint(0xfff2a8);
    return true;
  }

  applyCorrosion(pct, duration = 5) {
    this.corrosionPct = Math.max(this.corrosionPct || 0, pct);
    this.corrodedT = Math.max(this.corrodedT || 0, duration);
  }

  applyPoison(dps, maxStacks, lv7, sourceTower = null, opts = {}) {
    const alive = this.poisons.filter(p => p.t > 0);
    const goldMult = sourceTower?.goldMult || 1;
    const sourceBonus = opts.sourceBonus || 0;
    const branchEffects = opts.branchEffects !== false;
    const poisonBranch = branchEffects && sourceTower?.elem === 'poison' && sourceTower.lv >= 4 ? sourceTower.branch : null;
    const plague = poisonBranch === 'a';
    const plagueRadius = plague ? (sourceTower.lv >= 7 ? 190 : 95) : 0;
    if (poisonBranch === 'b') this.applyCorrosion(sourceTower.lv >= 7 ? 0.5 : 0.25, 5);
    const stack = { dps, t: 5, lv7, goldMult, plague, plagueRadius, sourceBonus };
    if (alive.length < maxStacks) {
      alive.push(stack);
    } else {
      // 刷新最快过期的一层
      let idx = 0;
      alive.forEach((p, i) => { if (p.t < alive[idx].t) idx = i; });
      alive[idx] = {
        ...stack,
        dps: Math.max(alive[idx].dps, dps),
        goldMult: Math.max(alive[idx].goldMult || 1, goldMult),
        plague: alive[idx].plague || plague,
        plagueRadius: Math.max(alive[idx].plagueRadius || 0, plagueRadius),
        sourceBonus: Math.max(alive[idx].sourceBonus || 0, sourceBonus),
      };
    }
    this.poisons = alive;
  }

  // 返回真实造成的伤害；trueDmg 无视护甲
  takeDamage(dmg, { trueDmg = false, cause = 'hit', sourceTower = null, goldMult = 1, sourceBonus = 0 } = {}) {
    if (this.dead) return 0;
    this.killGoldMult = Math.max(this.killGoldMult || 1, sourceTower?.goldMult || goldMult || 1);
    if (this.eliteShield > 0) {
      this.eliteShield--;
      this.barBg.setVisible(true); this.bar.setVisible(true);
      this.spr.setTint(0x9fe8ff).setTintMode(Phaser.TintModes.FILL);
      this.scene.time.delayedCall(70, () => { if (!this.dead) this.restoreTint(); });
      if (this.scene.showDmg) this.scene.showDmg(this.x, this.y - 50, '护盾', '#9fe8ff');
      return 0;
    }
    const amp = 1 + Math.min(1, Math.max(0, (this.corrodedT > 0 ? this.corrosionPct : 0) + (sourceBonus || 0)));
    const real = (trueDmg ? dmg : dmg * (1 - this.armor)) * amp;
    this.hp -= real;
    this.barBg.setVisible(true); this.bar.setVisible(true);
    this.bar.width = Math.max(0, (this.boss ? 72 : 42) * (this.hp / this.maxHp));
    // 受击闪白（Phaser 4：setTintFill 已移除，改用 TintModes.FILL）
    this.spr.setTint(0xffffff).setTintMode(Phaser.TintModes.FILL);
    this.scene.time.delayedCall(45, () => { if (!this.dead) this.restoreTint(); });
    if (this.hp <= 0) this.die(cause);
    return real;
  }

  heal(amount) {
    if (this.dead || amount <= 0) return 0;
    const before = this.hp;
    this.hp = Math.min(this.maxHp, this.hp + amount);
    const healed = this.hp - before;
    if (healed > 0) {
      this.barBg.setVisible(true);
      this.bar.setVisible(true);
      this.bar.width = Math.max(0, (this.boss ? 72 : 42) * (this.hp / this.maxHp));
    }
    return healed;
  }

  restoreTint() {
    this.spr.setTintMode(Phaser.TintModes.MULTIPLY);
    if (this.frozenT > 0) this.spr.setTint(0xaaddff);
    else if (this.stunnedT > 0) this.spr.setTint(0xfff2a8);
    else if (this.slowT > 0) this.spr.setTint(0x88ccff);
    else if (this.poisons.some(p => p.t > 0) || this.corrodedT > 0) this.spr.setTint(0x99ee66);
    else this.spr.clearTint();
  }

  die(cause) {
    if (this.dead) return;
    this.dead = true;
    this.scene.onEnemyDead(this, cause);
  }

  update(dts) {
    if (this.dead) return;
    if (this.hardControlImmuneT > 0) this.hardControlImmuneT = Math.max(0, this.hardControlImmuneT - dts);
    if (this.corrodedT > 0) this.corrodedT = Math.max(0, this.corrodedT - dts);
    // 毒 DoT（无视护甲）；每跳算一次伤害实例，可破精英护盾
    let poisonDied = false;
    for (const p of this.poisons) {
      if (p.t <= 0) continue;
      p.t -= dts;
      p.tick = (p.tick ?? 0) - dts;
      if (p.tick > 0) continue;
      p.tick = 0.25;
      this.killGoldMult = Math.max(this.killGoldMult || 1, p.goldMult || 1);
      if (this.eliteShield > 0) {
        this.eliteShield--;
        if (this.scene.showDmg) this.scene.showDmg(this.x, this.y - 50, '护盾', '#9fe8ff');
        continue;
      }
      const amp = 1 + Math.min(1, (this.corrodedT > 0 ? this.corrosionPct : 0) + (p.sourceBonus || 0));
      this.hp -= p.dps * 0.25 * amp;
      this.barBg.setVisible(true); this.bar.setVisible(true);
      this.bar.width = Math.max(0, (this.boss ? 72 : 42) * (this.hp / this.maxHp));
      if (this.hp <= 0) { poisonDied = true; break; }
    }
    if (poisonDied) {
      this.bar.width = 0;
      this.die('poison');
      return;
    }
    if (this.rage && !this.rageActive && this.hp / this.maxHp <= 0.4) {
      this.rageActive = true;
      this.slowPct *= this.rageSlowScale;
      if (this.scene.onBossRage) this.scene.onBossRage(this);
    }
    if (this.poisons.some(p => p.t > 0) && this.frozenT <= 0 && this.stunnedT <= 0) this.spr.setTint(0x99ee66);

    // 冻结 / 减速
    if (this.frozenT > 0) {
      this.frozenT -= dts;
      if (this.frozenT <= 0) this.restoreTint();
      else return; // 冻结不移动
    }
    if (this.stunnedT > 0) {
      this.stunnedT -= dts;
      if (this.stunnedT <= 0) this.restoreTint();
      else return; // 眩晕不移动
    }
    let speedFactor = 1;
    if (this.slowT > 0) {
      this.slowT -= dts;
      speedFactor = 1 - this.slowPct / 100;
      if (this.slowT <= 0) { this.slowPct = 0; this.restoreTint(); }
    }

    let speedMult = this.speedMult || 1;
    if (this.rageActive) speedMult *= this.rageSpeedMult || 1;
    if (this.scene.eliteSpeedFactorFor) speedMult *= this.scene.eliteSpeedFactorFor(this);
    speedMult = Math.min(speedMult, this.speedCap);
    this.progress += this.type.speed * speedFactor * speedMult * dts;
    if (this.progress >= this.path.total) {
      this.scene.onEnemyLeak(this);
      return;
    }
    const p = this.path.pointAt(this.progress);
    this.setFacingByDelta(p.x - this.c.x, p.y - this.c.y);
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

  setFacingByDelta(dx, dy) {
    if (!this.usesPaintedSprite || (Math.abs(dx) < 0.25 && Math.abs(dy) < 0.25)) return;
    const direction = paintedEnemyPlaybackDirection(dx, dy);
    if (!direction) return;
    const sourceDirection = paintedEnemyAnimationSource(this.scene, this.paintedKey, direction);
    if (!sourceDirection) return;
    const animKey = paintedEnemyAnimKey(this.paintedKey, sourceDirection);
    if (this.facingDirection !== direction || this.facingSourceDirection !== sourceDirection) {
      this.facingDirection = direction;
      this.facingSourceDirection = sourceDirection;
      this.spr.play(animKey);
    }
    this.spr.setFlipX(sourceDirection !== 'front' && paintedEnemyDirectionFlipX(direction));
  }
}
