import { W, H, DIAMOND } from '../config.js';
import { Sfx } from '../audio.js';

class GameVfx {
  zigzag(g, x1, y1, x2, y2) {
    const segs = 4;
    let px = x1, py = y1;
    for (let i = 1; i <= segs; i++) {
      const t = i / segs;
      const nx = x1 + (x2 - x1) * t + (i < segs ? Phaser.Math.Between(-12, 12) : 0);
      const ny = y1 + (y2 - y1) * t + (i < segs ? Phaser.Math.Between(-12, 12) : 0);
      g.lineBetween(px, py, nx, ny);
      px = nx; py = ny;
    }
  }

  ensureVfxAnimations() {
    const defs = [
      { key: 'vfx_frost_nova_anim', texture: 'vfx_frost_nova_seq', end: 11, frameRate: 24, repeat: 0 },
    ];
    for (const def of defs) {
      if (this.anims.exists(def.key) || !this.textures.exists(def.texture)) continue;
      this.anims.create({
        key: def.key,
        frames: this.anims.generateFrameNumbers(def.texture, { start: 0, end: def.end }),
        frameRate: def.frameRate,
        repeat: def.repeat,
      });
    }
  }

  playFireBurstFx(x, y, radius, color = 0xff7733) {
    const size = Phaser.Math.Clamp(radius, 34, 128);
    const unit = size / 64;

    // A dark, low ground contact keeps the explosion anchored to the 2.5D path.
    const ground = this.add.ellipse(x, y + 8, size * 1.65, size * 0.48, 0x71150d, 0.34)
      .setStrokeStyle(Math.max(2, size * 0.055), color, 0.62)
      .setScale(0.18)
      .setDepth(2087);
    this.tweens.add({
      targets: ground,
      scaleX: 1,
      scaleY: 1,
      alpha: 0,
      duration: 330,
      ease: 'Cubic.Out',
      onComplete: () => ground.destroy(),
    });

    // The white-hot core is intentionally brief; the silhouette carries the longer read.
    const flash = this.add.image(x, y - 2, 'glow')
      .setTint(0xfff2a8)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setAlpha(0.9)
      .setScale(0.16 * unit)
      .setDepth(2094);
    this.tweens.add({
      targets: flash,
      scale: 1.45 * unit,
      alpha: 0,
      duration: 190,
      ease: 'Quad.Out',
      onComplete: () => flash.destroy(),
    });

    const tongueCount = Phaser.Math.Clamp(Math.round(size / 9), 6, 12);
    for (let i = 0; i < tongueCount; i++) {
      const theta = Phaser.Math.DegToRad(Phaser.Math.Between(205, 335));
      const flameScale = unit * Phaser.Math.FloatBetween(0.38, 0.7);
      const flame = this.add.image(x, y + 6, 'fire_lick')
        .setOrigin(0.5, 0.86)
        .setAngle(Phaser.Math.RadToDeg(theta) + 90)
        .setScale(flameScale * 0.18)
        .setDepth(2091 + i);
      this.tweens.add({
        targets: flame,
        x: x + Math.cos(theta) * size * Phaser.Math.FloatBetween(0.32, 0.62),
        y: y + 4 + Math.sin(theta) * size * Phaser.Math.FloatBetween(0.3, 0.54),
        scaleX: flameScale * Phaser.Math.FloatBetween(0.72, 0.98),
        scaleY: flameScale * Phaser.Math.FloatBetween(0.95, 1.28),
        alpha: 0,
        delay: Phaser.Math.Between(0, 42),
        duration: Phaser.Math.Between(280, 390),
        ease: 'Cubic.Out',
        onComplete: () => flame.destroy(),
      });
    }

    for (let i = 0; i < (size > 72 ? 4 : 3); i++) {
      const smokeScale = unit * Phaser.Math.FloatBetween(0.28, 0.46);
      const smoke = this.add.image(
        x + Phaser.Math.Between(-Math.round(size * 0.28), Math.round(size * 0.28)),
        y - Phaser.Math.Between(0, Math.round(size * 0.18)),
        'smoke_puff',
      )
        .setTint(i % 2 ? 0x4a2523 : 0x6c3329)
        .setAlpha(0.3)
        .setScale(smokeScale)
        .setDepth(2089 + i);
      this.tweens.add({
        targets: smoke,
        y: smoke.y - size * Phaser.Math.FloatBetween(0.3, 0.55),
        x: smoke.x + Phaser.Math.Between(-18, 18),
        scale: smokeScale * Phaser.Math.FloatBetween(1.6, 2.15),
        alpha: 0,
        delay: 70 + i * 24,
        duration: Phaser.Math.Between(470, 650),
        ease: 'Sine.Out',
        onComplete: () => smoke.destroy(),
      });
    }

    const embers = this.add.particles(x, y, 'fire_ember', {
      angle: { min: 205, max: 335 },
      speed: { min: 90 * unit, max: 265 * unit },
      gravityY: 360,
      rotate: { min: -55, max: 55 },
      scale: { start: 0.82 * unit, end: 0.08 },
      alpha: { start: 1, end: 0 },
      lifespan: { min: 420, max: 680 },
      blendMode: Phaser.BlendModes.ADD,
      emitting: false,
    }).setDepth(2110);
    embers.explode(Phaser.Math.Clamp(Math.round(size * 0.28), 10, 30));
    this.time.delayedCall(760, () => embers.destroy());
  }

  addBurnZone(x, y, dps, opts = {}) {
    const duration = opts.duration ?? 2;
    const radius = opts.radius ?? 58;
    let img = null;
    if (opts.visual !== false) {
      const visualRadius = opts.visualRadius ?? radius;
      const unit = visualRadius / 64;
      const targetAlpha = opts.alpha ?? 0.92;
      img = this.add.container(x, y).setAlpha(0).setScale(0.82).setDepth(opts.depth ?? 100);

      const heat = this.add.image(0, 3, 'glow')
        .setTint(0xff5a20)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setAlpha(0.36)
        .setScale(unit * 1.25, unit * 0.42);
      const bed = this.add.ellipse(0, 6, visualRadius * 1.82, visualRadius * 0.62, 0x30110e, 0.74)
        .setStrokeStyle(Math.max(2, visualRadius * 0.032), opts.color ?? 0xff6428, 0.55);
      const innerBed = this.add.ellipse(0, 5, visualRadius * 1.32, visualRadius * 0.4, 0xff6a1f, 0.14)
        .setStrokeStyle(Math.max(1, visualRadius * 0.016), 0xffd34e, 0.36);
      const cracks = this.add.graphics();
      cracks.lineStyle(Math.max(1, visualRadius * 0.022), 0xff8a24, 0.72);
      cracks.lineBetween(-visualRadius * 0.62, 4, -visualRadius * 0.34, -1);
      cracks.lineBetween(-visualRadius * 0.34, -1, -visualRadius * 0.18, 6);
      cracks.lineBetween(-visualRadius * 0.06, 1, visualRadius * 0.13, -4);
      cracks.lineBetween(visualRadius * 0.13, -4, visualRadius * 0.31, 4);
      cracks.lineBetween(visualRadius * 0.36, 3, visualRadius * 0.64, -2);
      img.add([heat, bed, innerBed, cracks]);

      const flameLayout = [
        [-0.5, 0.02, 0.43], [-0.22, -0.08, 0.58], [0.08, 0.02, 0.48],
        [0.36, -0.05, 0.62], [0.58, 0.05, 0.38],
      ];
      for (let i = 0; i < flameLayout.length; i++) {
        const [px, py, ps] = flameLayout[i];
        const baseScale = unit * ps;
        const flame = this.add.image(px * visualRadius, py * visualRadius, 'fire_lick')
          .setOrigin(0.5, 0.86)
          .setAngle(Phaser.Math.Between(-9, 9))
          .setScale(baseScale * Phaser.Math.FloatBetween(0.9, 1.08));
        img.add(flame);
        this.tweens.add({
          targets: flame,
          y: flame.y - visualRadius * Phaser.Math.FloatBetween(0.06, 0.13),
          scaleX: baseScale * Phaser.Math.FloatBetween(0.76, 0.94),
          scaleY: baseScale * Phaser.Math.FloatBetween(1.12, 1.35),
          angle: flame.angle + Phaser.Math.Between(-7, 7),
          alpha: Phaser.Math.FloatBetween(0.74, 0.92),
          duration: Phaser.Math.Between(310, 480),
          delay: i * 54,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.InOut',
        });
      }

      const risingEmbers = this.add.particles(0, -3, 'fire_ember', {
        x: { min: -visualRadius * 0.62, max: visualRadius * 0.62 },
        y: { min: -visualRadius * 0.12, max: visualRadius * 0.08 },
        angle: { min: 248, max: 292 },
        speed: { min: 22, max: 58 },
        gravityY: -24,
        rotate: { min: -35, max: 35 },
        scale: { start: 0.38 * unit, end: 0.05 },
        alpha: { start: 0.85, end: 0 },
        lifespan: { min: 520, max: 880 },
        frequency: 145,
        blendMode: Phaser.BlendModes.ADD,
      });
      img.add(risingEmbers);

      this.tweens.add({
        targets: img,
        alpha: targetAlpha,
        scale: 1,
        duration: 160,
        ease: 'Cubic.Out',
      });
      this.tweens.add({
        targets: img,
        alpha: targetAlpha * 0.82,
        scaleX: 1.025,
        scaleY: 0.985,
        delay: 190,
        duration: 460,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.InOut',
      });
    }
    this.burnZones.push({
      x, y, dps, t: duration, img, tick: 0, radius,
      goldMult: opts.goldMult || 1,
      sourceBonus: opts.sourceBonus || 0,
      sourceTower: opts.sourceTower || null,
    });
  }

  // ================= 特效工具 =================
  playFrostNovaFx(x, y, radius, strong = false) {
    this.ensureVfxAnimations();
    if (this.textures.exists('vfx_frost_nova_seq') && this.anims.exists('vfx_frost_nova_anim')) {
      const baseScale = (radius * (strong ? 2.85 : 2.55)) / 320;
      const nova = this.add.sprite(x, y, 'vfx_frost_nova_seq')
        .setAlpha(strong ? 0.98 : 0.92)
        .setScale(baseScale)
        .setAngle(Phaser.Math.Between(-18, 18))
        .setDepth(2092);
      nova.play('vfx_frost_nova_anim');
      nova.once('animationcomplete', () => nova.destroy());
    } else if (!this.textures.exists('vfx_frost_nova')) {
      this.burst(x, y, 0xbfe8ff, strong ? 54 : 38, strong ? 1.45 : 1.1);
    } else {
      const baseScale = (radius * (strong ? 2.85 : 2.55)) / 512;
      const nova = this.add.image(x, y, 'vfx_frost_nova')
        .setAlpha(0)
        .setScale(baseScale * 0.28)
        .setAngle(Phaser.Math.Between(-18, 18))
        .setDepth(2092);
      this.tweens.add({
        targets: nova,
        alpha: strong ? 0.98 : 0.9,
        scale: baseScale,
        duration: 170,
        ease: 'Back.Out',
        onComplete: () => {
          this.tweens.add({
            targets: nova,
            alpha: 0,
            scale: baseScale * 1.08,
            duration: strong ? 540 : 440,
            ease: 'Sine.Out',
            onComplete: () => nova.destroy(),
          });
        },
      });

      const afterImage = this.add.image(x, y, 'vfx_frost_nova')
        .setAlpha(strong ? 0.28 : 0.2)
        .setScale(baseScale * 0.9)
        .setAngle(nova.angle + 30)
        .setDepth(2089);
      this.tweens.add({
        targets: afterImage,
        alpha: 0,
        scale: baseScale * 1.34,
        duration: strong ? 760 : 620,
        ease: 'Cubic.Out',
        onComplete: () => afterImage.destroy(),
      });
    }

    const core = this.add.image(x, y, 'glow')
      .setTint(0xffffff)
      .setAlpha(0.92)
      .setScale(0.22)
      .setDepth(2094);
    this.tweens.add({
      targets: core,
      scale: strong ? 1.8 : 1.38,
      alpha: 0,
      duration: 260,
      ease: 'Quad.Out',
      onComplete: () => core.destroy(),
    });

    const shards = this.add.particles(x, y, 'ice_shard', {
      angle: { min: 0, max: 360 },
      rotate: { min: 0, max: 360 },
      speed: { min: strong ? 110 : 75, max: strong ? 250 : 190 },
      scale: { start: strong ? 0.58 : 0.44, end: 0 },
      lifespan: strong ? 620 : 500,
      emitting: false,
    }).setDepth(2095);
    shards.explode(strong ? 18 : 12);
    this.time.delayedCall(strong ? 760 : 620, () => shards.destroy());

    this.cameras.main.shake(strong ? 210 : 140, strong ? 0.005 : 0.0032);
  }

  playPlagueBurstFx(x, y, radius, targets = []) {
    const cloud = this.add.image(x, y, 'glow')
      .setTint(0x7ede55)
      .setAlpha(0.48)
      .setScale(radius / 34)
      .setDepth(2072);
    this.tweens.add({
      targets: cloud,
      scale: radius / 17,
      alpha: 0,
      duration: 740,
      ease: 'Cubic.Out',
      onComplete: () => cloud.destroy(),
    });

    const ring = this.add.circle(x, y, radius, 0x7ede55, 0.08)
      .setStrokeStyle(5, 0x9ef07a, 0.72)
      .setScale(0.18)
      .setDepth(2074);
    this.tweens.add({
      targets: ring,
      scale: 1,
      alpha: 0,
      duration: 440,
      ease: 'Cubic.Out',
      onComplete: () => ring.destroy(),
    });

    const spores = this.add.particles(x, y, 'spark', {
      angle: { min: 0, max: 360 },
      speed: { min: 90, max: 280 },
      scale: { start: 1.1, end: 0 },
      lifespan: 760,
      tint: 0x9ef07a,
      emitting: false,
    }).setDepth(2080);
    spores.explode(32 + Math.min(22, targets.length * 3));
    this.time.delayedCall(960, () => spores.destroy());

    if (!targets.length) return;
    const lines = this.add.graphics().setDepth(2079);
    lines.lineStyle(2, 0x9ef07a, 0.54);
    for (const target of targets.slice(0, 14)) {
      lines.lineBetween(x, y, target.x, target.y);
    }
    this.tweens.add({
      targets: lines,
      alpha: 0,
      duration: 360,
      ease: 'Quad.Out',
      onComplete: () => lines.destroy(),
    });

    targets.slice(0, 10).forEach((target, i) => {
      const spore = this.add.image(x, y, 'spark')
        .setTint(0x9ef07a)
        .setAlpha(0.95)
        .setScale(0.75)
        .setDepth(2084);
      this.tweens.add({
        targets: spore,
        x: target.x,
        y: target.y - 8,
        alpha: 0.35,
        scale: 1.15,
        delay: i * 18,
        duration: 210 + i * 10,
        ease: 'Cubic.Out',
        onComplete: () => {
          spore.destroy();
          this.burst(target.x, target.y, 0x9ef07a, 5, 0.45);
        },
      });
    });
  }

  playMoltenImpactFx(sx, sy, x, y, crit = false) {
    const muzzle = this.add.image(sx, sy, 'glow')
      .setTint(0xffe2a3)
      .setAlpha(0.76)
      .setScale(crit ? 0.78 : 0.58)
      .setDepth(2075);
    this.tweens.add({
      targets: muzzle,
      scale: crit ? 1.36 : 0.96,
      alpha: 0,
      duration: 150,
      ease: 'Quad.Out',
      onComplete: () => muzzle.destroy(),
    });

    const trace = this.add.graphics().setDepth(2072);
    trace.lineStyle(crit ? 9 : 6, 0xff7a2f, crit ? 0.34 : 0.22);
    trace.lineBetween(sx, sy, x, y - 10);
    trace.lineStyle(crit ? 4 : 3, 0xfff2a8, 0.86);
    trace.lineBetween(sx, sy, x, y - 10);
    this.tweens.add({
      targets: trace,
      alpha: 0,
      duration: crit ? 210 : 170,
      ease: 'Quad.Out',
      onComplete: () => trace.destroy(),
    });

    this.playFireBurstFx(x, y, crit ? 92 : 58, crit ? 0xffd34e : 0xff6428);

    this.cameras.main.shake(crit ? 190 : 80, crit ? 0.006 : 0.002);
  }

  playLightningChainFx(sx, sy, chain, branch = null) {
    const segments = [];
    let from = { x: sx, y: sy };
    for (const e of chain) {
      const to = { x: e.x, y: e.y - 10 };
      const pts = [from];
      for (let i = 1; i <= 4; i++) {
        const t = i / 4;
        pts.push({
          x: from.x + (to.x - from.x) * t + (i < 4 ? Phaser.Math.Between(-14, 14) : 0),
          y: from.y + (to.y - from.y) * t + (i < 4 ? Phaser.Math.Between(-14, 14) : 0),
        });
      }
      segments.push(pts);
      from = to;
    }

    const g = this.add.graphics().setDepth(2102);
    const draw = (width, color, alpha) => {
      g.lineStyle(width, color, alpha);
      for (const pts of segments) {
        for (let i = 1; i < pts.length; i++) {
          g.lineBetween(pts[i - 1].x, pts[i - 1].y, pts[i].x, pts[i].y);
        }
      }
    };
    draw(branch === 'a' ? 10 : 8, 0x7df9ff, branch === 'a' ? 0.24 : 0.18);
    draw(5, 0xfff2a8, 0.9);
    draw(2, 0xffffff, 0.98);
    this.tweens.add({
      targets: g,
      alpha: 0,
      duration: branch === 'a' ? 240 : 190,
      ease: 'Quad.Out',
      onComplete: () => g.destroy(),
    });

    chain.forEach((e, i) => {
      this.playLightningHitFx(e.x, e.y, branch === 'a' && i === chain.length - 1);
    });
  }

  playLightningHitFx(x, y, strong = false) {
    const flash = this.add.image(x, y - 8, 'glow')
      .setTint(strong ? 0x7df9ff : 0xfff2a8)
      .setAlpha(strong ? 0.62 : 0.42)
      .setScale(strong ? 0.66 : 0.48)
      .setDepth(2103);
    this.tweens.add({
      targets: flash,
      scale: strong ? 1.45 : 1.02,
      alpha: 0,
      duration: strong ? 260 : 190,
      ease: 'Cubic.Out',
      onComplete: () => flash.destroy(),
    });
    if (strong) this.burst(x, y, 0x7df9ff, 10, 0.8);
  }

  playStunRingFx(x, y) {
    this.playLightningHitFx(x, y, true);
    const ring = this.add.circle(x, y - 14, 26, 0xfff2a8, 0)
      .setStrokeStyle(3, 0xfff2a8, 0.82)
      .setDepth(2105);
    this.tweens.add({
      targets: ring,
      y: y - 24,
      scale: 1.55,
      alpha: 0,
      duration: 360,
      ease: 'Cubic.Out',
      onComplete: () => ring.destroy(),
    });
  }

  playExecuteFx(t, x, y) {
    const topY = Math.max(-90, y - 560);
    const h = y - topY + 96;
    const pillar = this.add.rectangle(x, topY + h / 2, 24, h, 0xfff8dc, 0.28)
      .setDepth(2114);
    this.tweens.add({
      targets: pillar,
      scaleX: 2.15,
      alpha: 0,
      duration: 280,
      ease: 'Quad.Out',
      onComplete: () => pillar.destroy(),
    });

    const core = this.add.image(x, y - 8, 'glow')
      .setTint(0xfff8dc)
      .setAlpha(0.86)
      .setScale(0.74)
      .setDepth(2115);
    this.tweens.add({
      targets: core,
      scale: 2.2,
      alpha: 0,
      duration: 300,
      ease: 'Cubic.Out',
      onComplete: () => core.destroy(),
    });

    const ring = this.add.circle(x, y, 42, 0xfff8dc, 0)
      .setStrokeStyle(6, 0xfff8dc, 0.86)
      .setScale(0.2)
      .setDepth(2116);
    this.tweens.add({
      targets: ring,
      scale: 2.0,
      alpha: 0,
      duration: 340,
      ease: 'Cubic.Out',
      onComplete: () => ring.destroy(),
    });

    const motes = this.add.particles(x, y - 10, 'spark', {
      angle: { min: 235, max: 305 },
      speed: { min: 110, max: 260 },
      gravityY: -120,
      scale: { start: 0.95, end: 0 },
      lifespan: 560,
      tint: 0xfff8dc,
      emitting: false,
    }).setDepth(2117);
    motes.explode(28);
    this.time.delayedCall(720, () => motes.destroy());

    this.cameras.main.shake(130, 0.0035);
  }

  playJudgementPulseFx(t, global = false) {
    const x = t.slot.x;
    const y = t.slot.y - 24;
    const color = 0xfff8dc;
    const glow = this.add.image(x, y, 'glow')
      .setTint(color)
      .setAlpha(global ? 0.42 : 0.3)
      .setScale(global ? 1.0 : 0.72)
      .setDepth(2110);
    this.tweens.add({
      targets: glow,
      scale: global ? 3.0 : 1.65,
      alpha: 0,
      duration: global ? 520 : 340,
      ease: 'Cubic.Out',
      onComplete: () => glow.destroy(),
    });

    const ring = this.add.circle(x, y, global ? 72 : 48, color, 0)
      .setStrokeStyle(global ? 7 : 5, color, global ? 0.76 : 0.64)
      .setScale(0.18)
      .setDepth(2111);
    this.tweens.add({
      targets: ring,
      scale: global ? 3.1 : 1.75,
      alpha: 0,
      duration: global ? 560 : 360,
      ease: 'Cubic.Out',
      onComplete: () => ring.destroy(),
    });

    if (global) this.screenGlow(color, 0.1);
  }

  mergeBurst(x, y, color, lv = 1) {
    const count = Phaser.Math.Clamp(18 + lv * 3, 22, 40);
    const p = this.add.particles(x, y, 'spark', {
      angle: { min: 0, max: 360 },
      speed: { min: 150, max: 280 },
      scale: { start: 1.05, end: 0 },
      lifespan: 460,
      tint: color,
      emitting: false,
    }).setDepth(2350);
    p.explode(count);
    this.time.delayedCall(720, () => p.destroy());

    const ring = this.add.circle(x, y, 24, color, 0)
      .setStrokeStyle(5, color, 0.82)
      .setDepth(2348);
    this.tweens.add({
      targets: ring,
      scale: 2.4,
      alpha: 0,
      duration: 340,
      ease: 'Cubic.Out',
      onComplete: () => ring.destroy(),
    });

    const core = this.add.image(x, y, 'glow')
      .setTint(color)
      .setAlpha(0.42)
      .setScale(0.75)
      .setDepth(2347);
    this.tweens.add({
      targets: core,
      scale: 1.7,
      alpha: 0,
      duration: 260,
      ease: 'Quad.Out',
      onComplete: () => core.destroy(),
    });
  }

  playBossDeathFx(x, y, color, rewardDiamonds = 0) {
    const flash = this.add.rectangle(W / 2, H / 2, W, H, 0x9fe8ff, 0.24)
      .setDepth(2942);
    this.tweens.add({
      targets: flash,
      alpha: 0,
      duration: 360,
      ease: 'Quad.Out',
      onComplete: () => flash.destroy(),
    });

    const core = this.add.image(x, y, 'glow')
      .setTint(color)
      .setAlpha(0.72)
      .setScale(1.1)
      .setDepth(2338);
    this.tweens.add({
      targets: core,
      scale: 2.6,
      alpha: 0,
      duration: 280,
      ease: 'Cubic.Out',
      onComplete: () => core.destroy(),
    });

    const firstRing = this.add.circle(x, y, 34, color, 0)
      .setStrokeStyle(8, color, 0.86)
      .setDepth(2340);
    this.tweens.add({
      targets: firstRing,
      scale: 2.8,
      alpha: 0,
      duration: 300,
      ease: 'Cubic.Out',
      onComplete: () => firstRing.destroy(),
    });

    const shards = this.add.particles(x, y, 'spark', {
      angle: { min: 0, max: 360 },
      speed: { min: 230, max: 420 },
      scale: { start: 1.4, end: 0 },
      lifespan: 620,
      tint: color,
      emitting: false,
    }).setDepth(2344);
    shards.explode(56);
    this.time.delayedCall(820, () => shards.destroy());

    this.time.delayedCall(120, () => {
      this.cameras.main.shake(280, 0.015);
      this.burst(x, y, 0xffffff, 36, 2.1);
      this.burst(x, y, color, 48, 2.0);

      const secondRing = this.add.circle(x, y, 48, 0x9fe8ff, 0)
        .setStrokeStyle(10, 0x9fe8ff, 0.78)
        .setDepth(2346);
      this.tweens.add({
        targets: secondRing,
        scale: 3.6,
        alpha: 0,
        duration: 420,
        ease: 'Cubic.Out',
        onComplete: () => secondRing.destroy(),
      });

      const plume = this.add.particles(x, y - 10, 'spark', {
        angle: { min: 205, max: 335 },
        speed: { min: 190, max: 360 },
        gravityY: 360,
        scale: { start: 1.2, end: 0 },
        lifespan: 700,
        tint: 0x9fe8ff,
        emitting: false,
      }).setDepth(2347);
      plume.explode(44);
      this.time.delayedCall(900, () => plume.destroy());

      this.diamondFountain(x, y - 8, rewardDiamonds);
      Sfx.diamond();
    });
  }

  burst(x, y, color, n = 12, scale = 1) {
    const p = this.add.particles(x, y, 'spark', {
      speed: { min: 60, max: 260 }, scale: { start: 0.85 * scale, end: 0 },
      lifespan: 420, tint: color, emitting: false,
    }).setDepth(2200);
    p.explode(n);
    this.time.delayedCall(700, () => p.destroy());
  }

  showDmg(x, y, val, color) {
    if (this.dmgCount > 34) return;
    this.dmgCount++;
    const str = typeof val === 'number' ? String(Math.max(0, Math.round(val))) : val;
    const t = this.add.text(x + Phaser.Math.Between(-14, 14), y, str, {
      fontFamily: 'Arial Black, sans-serif', fontSize: '22px', color, stroke: '#000000', strokeThickness: 4,
    }).setOrigin(0.5).setDepth(2300);
    this.tweens.add({
      targets: t, y: y - 48, alpha: 0, duration: 600, ease: 'Cubic.Out',
      onComplete: () => { t.destroy(); this.dmgCount--; },
    });
  }

  diamondFountain(x, y, rewardDiamonds = 0) {
    const targetX = this.diamondIcon?.x ?? 516;
    const targetY = this.diamondIcon?.y ?? 30;
    const count = Math.max(6, rewardDiamonds * 3);
    for (let i = 0; i < count; i++) {
      const d = this.add.image(x, y, 'diamond')
        .setDepth(2425 + i)
        .setScale(0.55 + Math.random() * 0.18)
        .setAngle(Phaser.Math.Between(-25, 25));
      const angle = Phaser.Math.Between(210, 330) * Math.PI / 180;
      const dist = Phaser.Math.Between(62, 150);
      const apexX = x + Math.cos(angle) * dist;
      const apexY = y + Math.sin(angle) * dist - Phaser.Math.Between(18, 70);
      this.tweens.add({
        targets: d,
        x: apexX,
        y: apexY,
        scale: d.scaleX + 0.3,
        angle: d.angle + Phaser.Math.Between(-120, 120),
        duration: 190 + i * 10,
        ease: 'Cubic.Out',
        onComplete: () => {
          this.tweens.add({
            targets: d,
            x: targetX + Phaser.Math.Between(-8, 8),
            y: targetY + Phaser.Math.Between(-5, 5),
            scale: 0.42,
            angle: d.angle + Phaser.Math.Between(180, 420),
            alpha: 0.78,
            delay: i * 24,
            duration: 430 + Phaser.Math.Between(0, 130),
            ease: 'Cubic.In',
            onComplete: () => {
              d.destroy();
              if (i === count - 1) this.popDiamondText();
            },
          });
        },
      });
    }
  }

  popDiamondText() {
    this.tweens.killTweensOf(this.diamondText);
    this.diamondText.setScale(1);
    this.tweens.add({
      targets: this.diamondText,
      scale: 1.28,
      duration: 95,
      ease: 'Quad.Out',
      yoyo: true,
    });
  }

  rollGoldTo(targetGold) {
    const from = this.displayGold ?? targetGold;
    if (this.goldRollTween) this.goldRollTween.stop();
    this.goldRollTween = this.tweens.addCounter({
      from,
      to: targetGold,
      duration: 360,
      ease: 'Cubic.Out',
      onUpdate: tw => {
        this.displayGold = tw.getValue();
        this.goldText.setText(String(Math.floor(this.displayGold)));
      },
      onComplete: () => {
        this.displayGold = targetGold;
        this.goldRollTween = null;
        this.goldText.setText(String(Math.floor(this.displayGold)));
      },
    });
    this.tweens.killTweensOf(this.goldText);
    this.goldText.setScale(1);
    this.tweens.add({
      targets: this.goldText,
      scale: 1.18,
      duration: 90,
      ease: 'Quad.Out',
      yoyo: true,
    });
  }

  coinFly(x, y, amount = 0) {
    if (this.coinCount > 7) return;
    const targetX = this.coinIcon?.x ?? 332;
    const targetY = this.coinIcon?.y ?? 30;
    this.coinCount++;
    const c = this.add.image(x, y, 'coin').setDepth(2400);
    const label = amount > 0
      ? this.add.text(x + 18, y - 18, `+${amount}`, {
        fontFamily: 'Arial Black, sans-serif',
        fontSize: '22px',
        color: '#ffd34e',
        stroke: '#000000',
        strokeThickness: 4,
      }).setOrigin(0.5).setDepth(2401)
      : null;
    const targets = label ? [c, label] : [c];
    this.tweens.add({
      targets,
      x: targetX + 8,
      y: targetY,
      scale: 0.7,
      duration: 480,
      ease: 'Cubic.In',
      onComplete: () => {
        c.destroy();
        if (label) label.destroy();
        this.coinCount--;
        Sfx.coin();
      },
    });
  }

}

const { constructor, ...gameVfxMethods } = Object.getOwnPropertyDescriptors(GameVfx.prototype);
export { gameVfxMethods };
