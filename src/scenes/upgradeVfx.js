import Phaser from 'phaser';
import { H, W } from '../config.js';

const COLOR_RGB = color => [
  ((color >> 16) & 0xff) / 255,
  ((color >> 8) & 0xff) / 255,
  (color & 0xff) / 255,
];

export const upgradeVfxMethods = {
  playUpgradeRiftFx: function (tower, { maxLevel = false } = {}) {
    const x = tower.slot.x;
    const y = tower.slot.y - 26;
    const color = tower.color;
    const state = { progress: 0, alpha: 1 };

    if (this.sys.game.renderer.type === Phaser.WEBGL && this.cache.shader.exists('upgrade_rift')) {
      const size = maxLevel ? 760 : 430;
      const shader = this.add.shader({
        name: `UpgradeRift_${tower.id}_${this.time.now}`,
        fragmentKey: 'upgrade_rift',
        setupUniforms: setUniform => {
          setUniform('uProgress', state.progress);
          setUniform('uAlpha', state.alpha);
          setUniform('uTime', this.time.now / 1000);
          setUniform('uUltimate', maxLevel ? 1 : 0);
          setUniform('uColor', COLOR_RGB(color));
        },
      }, x, y, size, size).setDepth(2140).setBlendMode(Phaser.BlendModes.ADD);
      this.tweens.add({
        targets: state, progress: 1, alpha: 0, duration: maxLevel ? 920 : 620, ease: 'Cubic.Out',
        onComplete: () => shader.destroy(),
      });
    }

    this.playUpgradeParticles(tower, maxLevel);
    const ring = this.add.circle(x, y, 18, color, 0).setStrokeStyle(maxLevel ? 7 : 4, color, 0.95).setDepth(2142);
    this.tweens.add({
      targets: ring, radius: maxLevel ? 270 : 150, alpha: 0, duration: maxLevel ? 780 : 520,
      ease: 'Cubic.Out', onComplete: () => ring.destroy(),
    });
  },

  playUpgradeParticles: function (tower, maxLevel = false) {
    const x = tower.slot.x;
    const y = tower.slot.y - 22;
    const color = tower.color;
    const texture = tower.elem === 'fire' ? 'fire_ember' : tower.elem === 'ice' ? 'ice_shard' : 'spark';
    const count = maxLevel ? 92 : 44;
    const burst = this.add.particles(x, y, texture, {
      emitting: false,
      lifespan: { min: maxLevel ? 700 : 420, max: maxLevel ? 1350 : 850 },
      speed: { min: maxLevel ? 95 : 55, max: maxLevel ? 310 : 190 },
      angle: { min: 0, max: 360 },
      rotate: { min: -240, max: 240 },
      scale: { start: maxLevel ? 1.25 : 0.9, end: 0 },
      alpha: { start: 1, end: 0 },
      tint: [color, 0xffffff, color],
      blendMode: Phaser.BlendModes.ADD,
      gravityY: tower.elem === 'fire' ? -90 : 55,
    }).setDepth(2143);
    burst.explode(count);
    this.time.delayedCall(1500, () => burst.destroy());

    const orbit = this.add.particles(0, 0, 'spark', {
      emitting: false,
      lifespan: { min: 520, max: 980 },
      speed: { min: 35, max: 105 },
      angle: { min: 245, max: 295 },
      radial: true,
      scale: { start: maxLevel ? 0.85 : 0.55, end: 0 },
      alpha: { start: 0.9, end: 0 },
      tint: [color, 0xffffff],
      blendMode: Phaser.BlendModes.ADD,
    }).setDepth(2144);
    for (let i = 0; i < (maxLevel ? 36 : 18); i++) {
      orbit.emitParticleAt(x + Math.cos(i / 6 * Math.PI) * (maxLevel ? 110 : 64), y + Math.sin(i / 6 * Math.PI) * (maxLevel ? 55 : 34), 1);
    }
    this.time.delayedCall(1200, () => orbit.destroy());
  },

  playSkillProcParticles: function (tower, x, y, scale = 1) {
    const texture = tower.elem === 'fire' ? 'fire_ember'
      : tower.elem === 'ice' ? (tower.skill === 'mirror' ? 'mirror_shard' : 'ice_speck')
        : tower.elem === 'lightning' && this.textures.exists('electric_spark') ? 'electric_spark'
          : tower.elem === 'light' ? (tower.skill === 'refraction' ? 'prism_shard' : 'holy_mote')
            : tower.elem === 'poison' ? (tower.skill === 'corrosion' ? 'corrosion_shard' : tower.skill === 'spores' ? 'spore_mote' : 'poison_drop')
              : 'spark';
    const particles = this.add.particles(x, y, texture, {
      emitting: false, lifespan: { min: 180, max: 440 }, speed: { min: 35, max: 130 },
      angle: { min: 0, max: 360 }, rotate: { min: -180, max: 180 },
      scale: { start: 0.72 * scale, end: 0 }, alpha: { start: 0.95, end: 0 },
      tint: [tower.color, 0xffffff], blendMode: Phaser.BlendModes.ADD,
    }).setDepth(2078);
    particles.explode(Math.round(9 + 7 * scale));
    this.time.delayedCall(520, () => particles.destroy());
  },

  playMaxLevelScreenFx: function (tower) {
    const wash = this.add.rectangle(W / 2, H / 2, W, H, tower.color, 0.28).setDepth(5100);
    this.tweens.add({ targets: wash, alpha: 0, duration: 620, onComplete: () => wash.destroy() });
    this.cameras.main.shake(420, 0.009);
  },
};
