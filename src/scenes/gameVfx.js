import { W, H, DIAMOND } from '../config.js';
import { Sfx } from '../audio.js';

const LIGHTNING_PROFILE_COLORS = Object.freeze({
  chain: 0xb8a7ff,
  nexus: 0xe2d7ff,
  storm: 0xa897ff,
  conducted: 0xfff4c2,
});

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

  playFireBurstFx(x, y, radius, color = 0xff7733, profile = 'blast') {
    const size = Phaser.Math.Clamp(radius, 34, 128);
    const unit = size / 64;
    this.vfxRuntime?.burst(profile, x, y, size, { intensity: profile === 'molten' ? 1.25 : 1 });

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

    const emberCount = Phaser.Math.Clamp(Math.round(size * 0.28), 10, 30);
    if (this.vfxRuntime?.hasParticleChannel('fire')) {
      this.vfxRuntime.emit('fire', x, y, emberCount);
    } else {
      const embers = this.add.particles(x, y, 'fire_ember', {
        angle: { min: 205, max: 335 }, speed: { min: 90 * unit, max: 265 * unit }, gravityY: 360,
        rotate: { min: -55, max: 55 }, scale: { start: 0.82 * unit, end: 0.08 },
        alpha: { start: 1, end: 0 }, lifespan: { min: 420, max: 680 },
        blendMode: Phaser.BlendModes.ADD, emitting: false,
      }).setDepth(2110);
      embers.explode(emberCount);
      this.time.delayedCall(760, () => embers.destroy());
    }
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
  playFrostNovaFx(x, y, radius, strong = false, profile = 'glacier') {
    this.vfxRuntime?.burst(profile, x, y, radius, { intensity: strong ? 1.2 : 1 });
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
    } else {
      this.burst(x, y, 0xbfe8ff, strong ? 54 : 38, strong ? 1.45 : 1.1);
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

    const shardCount = strong ? 18 : 12;
    if (this.vfxRuntime?.hasParticleChannel('frost')) {
      this.vfxRuntime.emit('frost', x, y, shardCount);
    } else {
      const shards = this.add.particles(x, y, 'ice_shard', {
        angle: { min: 0, max: 360 }, rotate: { min: 0, max: 360 },
        speed: { min: strong ? 110 : 75, max: strong ? 250 : 190 },
        scale: { start: strong ? 0.58 : 0.44, end: 0 }, lifespan: strong ? 620 : 500, emitting: false,
      }).setDepth(2095);
      shards.explode(shardCount);
      this.time.delayedCall(strong ? 760 : 620, () => shards.destroy());
    }

    this.cameras.main.shake(strong ? 210 : 140, strong ? 0.005 : 0.0032);
  }

  playVortexFx(x, y, radius, strong = false) {
    const size = Phaser.Math.Clamp(radius, 72, 170);
    this.vfxRuntime?.burst('vortex', x, y, size, { intensity: strong ? 1.2 : 1 });

    const well = this.add.ellipse(x, y + 5, size * 1.3, size * 0.56, 0x061a3d, 0.52)
      .setStrokeStyle(3, 0x58dcff, 0.58).setScale(0.2).setDepth(2088);
    this.tweens.add({
      targets: well, scaleX: 1, scaleY: 1, alpha: 0, duration: 620,
      ease: 'Cubic.Out', onComplete: () => well.destroy(),
    });

    const arcScale = size / 64;
    for (let i = 0; i < 3; i++) {
      const arc = this.add.image(x, y, 'vortex_arc')
        .setTint(i === 1 ? 0xbff8ff : 0x42bfe8).setAlpha(0.82 - i * 0.13)
        .setScale(arcScale * (0.24 + i * 0.08)).setAngle(i * 118).setDepth(2091 + i);
      this.tweens.add({
        targets: arc, angle: arc.angle + (i % 2 ? -310 : 310), scale: arcScale * (0.86 + i * 0.08),
        alpha: 0, duration: 520 + i * 70, ease: 'Cubic.Out', onComplete: () => arc.destroy(),
      });
    }

    const moteCount = strong ? 16 : 12;
    for (let i = 0; i < moteCount; i++) {
      const angle = Math.PI * 2 * i / moteCount + Phaser.Math.FloatBetween(-0.18, 0.18);
      const startRadius = size * Phaser.Math.FloatBetween(0.45, 0.72);
      const mote = this.add.image(x + Math.cos(angle) * startRadius, y + Math.sin(angle) * startRadius * 0.55, 'ice_mote')
        .setTint(i % 3 ? 0x78dcff : 0xffffff).setScale(Phaser.Math.FloatBetween(0.34, 0.58))
        .setAlpha(0.92).setDepth(2095);
      this.tweens.add({
        targets: mote, x: x + Math.cos(angle + 2.4) * size * 0.08, y: y + Math.sin(angle + 2.4) * size * 0.04,
        angle: 250, scale: 0.08, alpha: 0, delay: i * 12, duration: 430 + i * 10,
        ease: 'Cubic.In', onComplete: () => mote.destroy(),
      });
    }
    this.cameras.main.shake(strong ? 150 : 95, strong ? 0.0038 : 0.0024);
  }

  playMirrorSplitFx(x, y, targets = [], strong = false) {
    this.vfxRuntime?.burst('mirror', x, y - 8, strong ? 82 : 62, { intensity: strong ? 1.18 : 1 });
    this.vfxRuntime?.emit('frost', x, y, strong ? 14 : 9);

    const mirror = this.add.image(x, y - 12, 'mirror_shard')
      .setTint(0xc8f8ff).setAlpha(0.94).setScale(strong ? 1.2 : 0.92).setDepth(2104);
    this.tweens.add({
      targets: mirror, angle: 210, scaleX: 0.16, scaleY: strong ? 1.7 : 1.35, alpha: 0,
      duration: 420, ease: 'Cubic.Out', onComplete: () => mirror.destroy(),
    });

    for (const [index, target] of targets.entries()) {
      const color = index % 2 ? 0x74e6ff : 0xd9fbff;
      if (this.lightningBeams?.enabled) this.lightningBeams.emit(x, y - 10, target.x, target.y - 10, color, 'mirror');
      else this.lightBeam(x, y - 10, target.x, target.y - 10);
      const shard = this.add.image(target.x, target.y - 10, 'mirror_shard')
        .setTint(color).setAlpha(0.82).setScale(0.48).setDepth(2103);
      this.tweens.add({
        targets: shard, angle: index % 2 ? -150 : 150, scale: 1.05, alpha: 0,
        duration: 360, ease: 'Cubic.Out', onComplete: () => shard.destroy(),
      });
    }
  }

  playIceShatterFx(x, y, radius, strong = false) {
    const visualRadius = Phaser.Math.Clamp(radius, 88, 132);
    const power = visualRadius / 100;
    const shardCount = strong ? 12 : 10;
    const crackCount = strong ? 5 : 4;

    // 0-80ms: the cold core snaps inward before the actual fracture.
    const compressedCore = this.add.image(x, y - 5, 'glow')
      .setTint(0x8deaff)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setAlpha(0.42)
      .setScale(0.72 * power)
      .setDepth(2093);
    this.tweens.add({
      targets: compressedCore,
      scaleX: 0.16 * power,
      scaleY: 0.1 * power,
      alpha: 0.78,
      duration: 76,
      ease: 'Cubic.In',
      onComplete: () => compressedCore.destroy(),
    });

    // 80-140ms: a single white-blue peak, deliberately smaller than a nova.
    const flash = this.add.image(x, y - 5, 'glow')
      .setTint(0xf4fdff)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setAlpha(0)
      .setScale(0.12 * power)
      .setDepth(2097);
    this.tweens.add({
      targets: flash,
      alpha: 0.98,
      scaleX: 0.72 * power,
      scaleY: 0.5 * power,
      delay: 76,
      duration: 34,
      ease: 'Cubic.Out',
      onComplete: () => {
        this.tweens.add({
          targets: flash,
          alpha: 0,
          scaleX: 1.08 * power,
          scaleY: 0.72 * power,
          duration: 72,
          ease: 'Quad.Out',
          onComplete: () => flash.destroy(),
        });
      },
    });

    const cracks = this.add.graphics({ x, y: y - 4 }).setAlpha(0).setScale(0.24).setDepth(2095);
    const crackAngles = [];
    for (let i = 0; i < crackCount; i++) {
      const angle = (Math.PI * 2 * i / crackCount) + Phaser.Math.FloatBetween(-0.38, 0.38);
      crackAngles.push(angle);
      const inner = visualRadius * Phaser.Math.FloatBetween(0.05, 0.12);
      const mid = visualRadius * Phaser.Math.FloatBetween(0.25, 0.38);
      const outer = visualRadius * Phaser.Math.FloatBetween(0.48, 0.72);
      const bend = Phaser.Math.FloatBetween(-0.16, 0.16);
      const p0 = { x: Math.cos(angle) * inner, y: Math.sin(angle) * inner * 0.72 };
      const p1 = { x: Math.cos(angle + bend) * mid, y: Math.sin(angle + bend) * mid * 0.72 };
      const p2 = { x: Math.cos(angle - bend * 0.55) * outer, y: Math.sin(angle - bend * 0.55) * outer * 0.72 };
      cracks.lineStyle(strong ? 5 : 4, 0x42c9ef, 0.24);
      cracks.lineBetween(p0.x, p0.y, p1.x, p1.y);
      cracks.lineBetween(p1.x, p1.y, p2.x, p2.y);
      cracks.lineStyle(strong ? 2 : 1.5, 0xf2fdff, 0.96);
      cracks.lineBetween(p0.x, p0.y, p1.x, p1.y);
      cracks.lineBetween(p1.x, p1.y, p2.x, p2.y);
      if (i % 2 === 0) {
        const branchAngle = angle + (i % 4 === 0 ? 0.42 : -0.38);
        cracks.lineBetween(
          p1.x,
          p1.y,
          p1.x + Math.cos(branchAngle) * visualRadius * 0.18,
          p1.y + Math.sin(branchAngle) * visualRadius * 0.12,
        );
      }
    }
    this.tweens.add({
      targets: cracks,
      alpha: 1,
      scale: 1,
      delay: 80,
      duration: 48,
      ease: 'Cubic.Out',
      onComplete: () => {
        this.tweens.add({
          targets: cracks,
          alpha: 0,
          duration: 155,
          ease: 'Quad.In',
          onComplete: () => cracks.destroy(),
        });
      },
    });

    // 140-650ms: a few large facets lead, followed by more small splinters.
    for (let i = 0; i < shardCount; i++) {
      const tier = i < 2 ? 'large' : (i < (strong ? 6 : 5) ? 'medium' : 'small');
      const angle = (Math.PI * 2 * i / shardCount) + Phaser.Math.FloatBetween(-0.22, 0.22);
      const firstDistance = visualRadius * Phaser.Math.FloatBetween(0.42, 0.65);
      const secondDistance = visualRadius * Phaser.Math.FloatBetween(0.88, 1.24);
      const lift = tier === 'large' ? Phaser.Math.Between(9, 18) : Phaser.Math.Between(3, 13);
      const baseScale = power * (tier === 'large' ? 0.92 : tier === 'medium' ? 0.84 : 0.78);
      const shard = this.add.image(x, y - 5, `shatter_shard_${tier}`)
        .setAlpha(0)
        .setScale(baseScale * 0.12)
        .setAngle(Phaser.Math.RadToDeg(angle) + 90 + Phaser.Math.Between(-14, 14))
        .setDepth(2094 + (i % 3));
      const burstDelay = 112 + Phaser.Math.Between(0, 24);
      this.tweens.add({
        targets: shard,
        x: x + Math.cos(angle) * firstDistance,
        y: y - 5 + Math.sin(angle) * firstDistance * 0.68 - lift,
        alpha: 1,
        scale: baseScale,
        angle: shard.angle + Phaser.Math.Between(-80, 80),
        delay: burstDelay,
        duration: Phaser.Math.Between(105, 142),
        ease: 'Cubic.Out',
        onComplete: () => {
          this.tweens.add({
            targets: shard,
            x: x + Math.cos(angle) * secondDistance,
            y: y - 5 + Math.sin(angle) * secondDistance * 0.68 + visualRadius * Phaser.Math.FloatBetween(0.16, 0.34),
            alpha: 0,
            scaleX: baseScale * 0.72,
            scaleY: baseScale * 0.82,
            angle: shard.angle + Phaser.Math.Between(-150, 150),
            duration: Phaser.Math.Between(300, 410),
            ease: 'Quad.Out',
            onComplete: () => shard.destroy(),
          });
        },
      });
    }

    this.time.delayedCall(108, () => {
      const chips = this.add.particles(x, y - 5, 'shatter_chip', {
        angle: { min: 0, max: 360 },
        speed: { min: 125 * power, max: 295 * power },
        gravityY: 310,
        rotate: { min: -420, max: 420 },
        scale: { start: 0.72 * power, end: 0.12 },
        alpha: { start: 0.94, end: 0 },
        lifespan: { min: 360, max: 590 },
        tint: [0x58cfee, 0xa9efff, 0xf4fdff],
        emitting: false,
      }).setDepth(2098);
      chips.explode(strong ? 24 : 19);
      this.time.delayedCall(620, () => chips.destroy());
    });

    this.time.delayedCall(82, () => {
      this.cameras.main.shake(strong ? 115 : 90, strong ? 0.0032 : 0.0022);
    });
  }

  playPlagueBurstFx(x, y, radius, targets = []) {
    this.vfxRuntime?.burst('plague', x, y, radius, { intensity: targets.length ? 1.2 : 1 });
    const cloud = this.add.image(x, y, 'glow')
      .setTint(0x8d65a6)
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

    const ringScale = radius / 64;
    const ring = this.add.image(x, y, 'fx_ring').setTint(0x9d77b3).setAlpha(0.74)
      .setScale(ringScale * 0.18)
      .setDepth(2074);
    this.tweens.add({
      targets: ring,
      scale: ringScale,
      alpha: 0,
      duration: 440,
      ease: 'Cubic.Out',
      onComplete: () => ring.destroy(),
    });

    const sporeCount = 32 + Math.min(22, targets.length * 3);
    if (this.vfxRuntime?.hasParticleChannel('plague')) {
      this.vfxRuntime.emit('plague', x, y, sporeCount);
    } else {
      const spores = this.add.particles(x, y, 'poison_drop', {
        angle: { min: 0, max: 360 }, speed: { min: 90, max: 280 }, scale: { start: 1.1, end: 0 },
        lifespan: 760, tint: [0x78558f, 0x9d77b3, 0xa6d35f], emitting: false,
      }).setDepth(2080);
      spores.explode(sporeCount);
      this.time.delayedCall(960, () => spores.destroy());
    }

    if (!targets.length) return;
    const lines = this.add.graphics().setDepth(2079);
    lines.lineStyle(3, 0x9d77b3, 0.62);
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
        .setTint(i % 2 ? 0x9d77b3 : 0xa6d35f)
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
          this.vfxRuntime?.burst('plague', target.x, target.y, 24, { intensity: 0.65 });
          this.burst(target.x, target.y, 0x9ef07a, 5, 0.45);
        },
      });
    });
  }

  playCorrosionHitFx(x, y, strong = false) {
    this.vfxRuntime?.burst('corrosion', x, y - 8, strong ? 62 : 46, { intensity: strong ? 1.2 : 0.92 });
    this.vfxRuntime?.emit('corrosion', x, y - 8, strong ? 16 : 10);
    const hex = this.add.image(x, y - 10, 'fx_hex').setTint(0xdfff62).setAlpha(0.84)
      .setScale(strong ? 0.88 : 0.62).setAngle(30).setDepth(2105);
    this.tweens.add({
      targets: hex, angle: -35, scaleX: strong ? 1.25 : 0.92, scaleY: 0.18, alpha: 0,
      duration: strong ? 460 : 340, ease: 'Cubic.Out', onComplete: () => hex.destroy(),
    });
    const stain = this.add.ellipse(x, y + 6, strong ? 78 : 56, strong ? 25 : 18, 0x627d12, 0.32)
      .setStrokeStyle(2, 0xdfff62, 0.62).setScale(0.24).setDepth(2076);
    this.tweens.add({
      targets: stain, scale: 1, alpha: 0, duration: 520, ease: 'Cubic.Out', onComplete: () => stain.destroy(),
    });
  }

  playSporeFieldPulseFx(x, y, radius, strong = false) {
    this.vfxRuntime?.burst('spores', x, y, radius * 0.72, { intensity: strong ? 1.18 : 0.92 });
    this.vfxRuntime?.emit('spores', x, y, strong ? 22 : 14);
    const bubbleCount = strong ? 9 : 6;
    for (let i = 0; i < bubbleCount; i++) {
      const angle = Math.PI * 2 * i / bubbleCount + Phaser.Math.FloatBetween(-0.22, 0.22);
      const distance = radius * Phaser.Math.FloatBetween(0.28, 0.72);
      const bubbleScale = Phaser.Math.FloatBetween(0.48, 0.86);
      const bubble = this.add.image(x + Math.cos(angle) * distance, y + Math.sin(angle) * distance * 0.55, 'poison_bubble')
        .setTint(i % 2 ? 0x9ef07a : 0x57c968).setAlpha(0.68).setScale(bubbleScale)
        .setDepth(2084);
      this.tweens.add({
        targets: bubble, y: bubble.y - Phaser.Math.Between(24, 54), x: bubble.x + Phaser.Math.Between(-12, 12),
        scale: bubbleScale * 1.4, alpha: 0, delay: i * 35, duration: Phaser.Math.Between(520, 760),
        ease: 'Sine.Out', onComplete: () => bubble.destroy(),
      });
    }
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

    this.playFireBurstFx(x, y, crit ? 92 : 58, crit ? 0xffd34e : 0xff6428, 'molten');

    for (let i = 0; i < (crit ? 11 : 7); i++) {
      const angle = Phaser.Math.FloatBetween(-Math.PI, 0);
      const distance = Phaser.Math.FloatBetween(34, crit ? 96 : 68);
      const shard = this.add.image(x, y - 4, 'lava_shard')
        .setTint(i % 3 ? 0xff6a18 : 0xffd34e).setScale(Phaser.Math.FloatBetween(0.38, 0.72))
        .setRotation(angle + Math.PI * 0.5).setDepth(2107);
      this.tweens.add({
        targets: shard, x: x + Math.cos(angle) * distance, y: y + Math.sin(angle) * distance + 26,
        angle: shard.angle + Phaser.Math.Between(-180, 180), alpha: 0, duration: Phaser.Math.Between(320, 520),
        ease: 'Cubic.Out', onComplete: () => shard.destroy(),
      });
    }

    this.cameras.main.shake(crit ? 190 : 80, crit ? 0.006 : 0.002);
  }

  playLightningChainFx(sx, sy, chain, profile = 'chain') {
    const profileKey = profile === 'b' ? 'nexus' : profile === 'a' ? 'chain' : profile;
    const color = LIGHTNING_PROFILE_COLORS[profileKey] || LIGHTNING_PROFILE_COLORS.chain;
    if (this.lightningBeams?.enabled) {
      let fromX = sx;
      let fromY = sy;
      chain.forEach((enemy, index) => {
        const toY = enemy.y - 10;
        this.lightningBeams.emit(fromX, fromY, enemy.x, toY, color, profileKey);
        this.playLightningHitFx(enemy.x, enemy.y, profileKey !== 'chain' || index === chain.length - 1, color);
        fromX = enemy.x;
        fromY = toY;
      });
      return;
    }

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
    const strong = profileKey === 'nexus' || profileKey === 'storm';
    draw(strong ? 11 : 8, color, strong ? 0.32 : 0.22);
    draw(strong ? 6 : 5, 0xe8e3ff, 0.9);
    draw(2, 0xffffff, 0.98);
    this.tweens.add({
      targets: g,
      alpha: 0,
      duration: strong ? 240 : 190,
      ease: 'Quad.Out',
      onComplete: () => g.destroy(),
    });

    chain.forEach((e, i) => {
      this.playLightningHitFx(e.x, e.y, strong || i === chain.length - 1, color);
    });
  }

  playVerticalLightningFx(x, y) {
    this.playLightningChainFx(x, y - 270, [{ x, y: y + 10 }], 'storm');
  }

  playRefractionFx(sx, sy, primary, secondaries = [], focused = false) {
    const px = primary.x;
    const py = primary.y - 10;
    const mainColor = focused ? 0xffffff : 0xfff1a6;
    if (this.lightningBeams?.enabled) this.lightningBeams.emit(sx, sy, px, py, mainColor, 'prism');
    else this.lightBeam(sx, sy, px, py);

    this.vfxRuntime?.burst('refraction', px, py, focused ? 88 : 66, { intensity: focused ? 1.3 : 1 });
    this.vfxRuntime?.emit('prism', px, py, focused ? 18 : 12);
    const prism = this.add.image(px, py, 'prism_shard').setTint(0xffffff).setAlpha(0.96)
      .setScale(focused ? 1.25 : 0.94).setAngle(-18).setDepth(2114);
    this.tweens.add({
      targets: prism, angle: 170, scaleX: 0.18, scaleY: focused ? 1.65 : 1.3, alpha: 0,
      duration: focused ? 480 : 390, ease: 'Cubic.Out', onComplete: () => prism.destroy(),
    });

    const colors = [0x62d8ff, 0xffe36a, 0xff8de3, 0xffffff];
    secondaries.forEach((target, index) => {
      const color = colors[index % colors.length];
      if (this.lightningBeams?.enabled) this.lightningBeams.emit(px, py, target.x, target.y - 10, color, 'prism');
      else this.lightBeam(px, py, target.x, target.y - 10);
      const hit = this.add.image(target.x, target.y - 10, 'prism_shard').setTint(color).setAlpha(0.8)
        .setScale(0.42).setAngle(index * 55).setDepth(2111);
      this.tweens.add({
        targets: hit, angle: hit.angle + 160, scale: 0.95, alpha: 0, duration: 340,
        ease: 'Cubic.Out', onComplete: () => hit.destroy(),
      });
    });
  }

  playHolyBeamFx(sx, sy, target, profile = 'radiance') {
    const judgement = profile === 'judgement';
    const color = judgement ? 0xfff8dc : 0xffd95a;
    const tx = target.x;
    const ty = target.y - 10;
    if (this.lightningBeams?.enabled) this.lightningBeams.emit(sx, sy, tx, ty, color, profile);
    else this.lightBeam(sx, sy, tx, ty);

    const sigil = this.add.image(tx, ty, 'holy_sigil').setTint(color).setAlpha(judgement ? 0.72 : 0.52)
      .setScale(judgement ? 0.44 : 0.32).setAngle(judgement ? 45 : 0).setDepth(2112);
    this.tweens.add({
      targets: sigil, angle: sigil.angle + (judgement ? 90 : 180), scale: judgement ? 0.92 : 0.68,
      alpha: 0, duration: judgement ? 390 : 310, ease: 'Cubic.Out', onComplete: () => sigil.destroy(),
    });
    if (judgement) {
      const verdict = this.add.rectangle(tx, ty - 42, 5, 72, 0xfff8dc, 0.72).setDepth(2111);
      this.tweens.add({ targets: verdict, scaleX: 2.4, alpha: 0, duration: 260, ease: 'Quad.Out', onComplete: () => verdict.destroy() });
    }
  }

  playLightningHitFx(x, y, strong = false, color = LIGHTNING_PROFILE_COLORS.chain) {
    const flash = this.add.image(x, y - 8, 'glow')
      .setTint(strong ? color : 0xe8e3ff)
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
    if (strong && !this.lightningBeams?.enabled) this.burst(x, y, color, 10, 0.8);
  }

  playStunRingFx(x, y) {
    this.vfxRuntime?.burst('nexus', x, y - 12, 44, { intensity: 1.15 });
    this.playLightningHitFx(x, y, true, LIGHTNING_PROFILE_COLORS.nexus);
    const hex = this.add.image(x, y - 14, 'fx_hex').setTint(0xe2d7ff).setAlpha(0.84).setScale(0.44).setDepth(2106);
    this.tweens.add({ targets: hex, angle: 60, scale: 1.1, alpha: 0, duration: 420, ease: 'Cubic.Out', onComplete: () => hex.destroy() });
    const ring = this.add.circle(x, y - 14, 26, 0xe2d7ff, 0)
      .setStrokeStyle(3, 0xe2d7ff, 0.82)
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
    this.vfxRuntime?.burst('judgement', x, y - 8, 92, { intensity: 1.3 });
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

    if (this.vfxRuntime?.hasParticleChannel('holy')) {
      this.vfxRuntime.emit('holy', x, y - 10, 28);
    } else {
      const motes = this.add.particles(x, y - 10, 'holy_mote', {
        angle: { min: 235, max: 305 }, speed: { min: 110, max: 260 }, gravityY: -120,
        scale: { start: 0.95, end: 0 }, lifespan: 560, tint: 0xfff8dc, emitting: false,
      }).setDepth(2117);
      motes.explode(28);
      this.time.delayedCall(720, () => motes.destroy());
    }

    this.cameras.main.shake(130, 0.0035);
  }

  playJudgementPulseFx(t, global = false) {
    const x = t.slot.x;
    const y = t.slot.y - 24;
    const color = 0xfff8dc;
    this.vfxRuntime?.burst('judgement', x, y, global ? 126 : 76, { intensity: global ? 1.25 : 0.9 });
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

  createRadianceAuraFx(tower) {
    const x = tower.slot.x;
    const y = tower.slot.y - 16;
    const radius = 130 + 20 * (tower.ranks?.range || 0);
    const container = this.add.container(x, y).setDepth(2036);
    const ring = this.add.image(0, 16, 'fx_ring').setTint(0xffd95a).setAlpha(0.34).setScale(radius / 64, radius / 96);
    const sigil = this.add.image(0, 0, 'holy_sigil').setTint(0xfff1a6).setAlpha(0.44).setScale(0.82);
    container.add([ring, sigil]);
    for (let i = 0; i < 8; i++) {
      const angle = Math.PI * 2 * i / 8;
      container.add(this.add.image(Math.cos(angle) * radius * 0.72, 16 + Math.sin(angle) * radius * 0.42, 'holy_mote')
        .setTint(i % 2 ? 0xffd95a : 0xffffff).setAlpha(0.72).setScale(0.48));
    }
    const field = this.vfxRuntime?.field('radiance', x, y + 16, radius, { depth: 2034, opacity: 0.6 });
    this.vfxRuntime?.burst('radiance', x, y, 86, { intensity: 0.9 });
    this.vfxRuntime?.emit('holy', x, y, 14);
    return { tower, radius, container, ring, sigil, field, clock: 0 };
  }

  updatePersistentSkillVfx(dts) {
    this.skillAuraVfx ||= new Map();
    const active = new Set();
    for (const tower of this.towers || []) {
      if (tower.skill !== 'radiance' || !tower.slot) continue;
      active.add(tower);
      const expectedRadius = 130 + 20 * (tower.ranks?.range || 0);
      let aura = this.skillAuraVfx.get(tower);
      if (aura && aura.radius !== expectedRadius) {
        aura.field?.destroy();
        aura.container?.destroy(true);
        this.skillAuraVfx.delete(tower);
        aura = null;
      }
      if (!aura) {
        aura = this.createRadianceAuraFx(tower);
        this.skillAuraVfx.set(tower, aura);
      }
      aura.clock += dts;
      aura.container.setPosition(tower.slot.x, tower.slot.y - 16);
      aura.container.rotation += dts * 0.32;
      aura.ring.setAlpha(0.28 + Math.sin(aura.clock * 3.6) * 0.1);
      aura.sigil.setRotation(-aura.container.rotation * 1.6).setAlpha(0.38 + Math.sin(aura.clock * 4.2) * 0.12);
      aura.field?.shader?.setPosition(tower.slot.x, tower.slot.y);
    }
    for (const [tower, aura] of this.skillAuraVfx) {
      if (active.has(tower)) continue;
      aura.field?.destroy();
      aura.container?.destroy(true);
      this.skillAuraVfx.delete(tower);
    }
  }

  destroyPersistentSkillVfx() {
    for (const aura of this.skillAuraVfx?.values() || []) {
      aura.field?.destroy();
      aura.container?.destroy(true);
    }
    this.skillAuraVfx?.clear();
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
import Phaser from 'phaser';
