import Phaser from 'phaser';

export const VFX_SHADER_KEYS = Object.freeze({
  burst: 'ssa-vfx-burst',
  field: 'ssa-vfx-field',
  beam: 'ssa-vfx-beam',
});

export const VFX_SHADER_ASSETS = Object.freeze({
  [VFX_SHADER_KEYS.burst]: 'assets/shaders/vfx-burst.frag',
  [VFX_SHADER_KEYS.field]: 'assets/shaders/vfx-field.frag',
  [VFX_SHADER_KEYS.beam]: 'assets/shaders/vfx-beam.frag',
});

const QUALITY = Object.freeze({
  high: Object.freeze({ key: 'high', shaderScale: 1, particleScale: 1 }),
  low: Object.freeze({ key: 'low', shaderScale: 0.72, particleScale: 0.62 }),
  fallback: Object.freeze({ key: 'fallback', shaderScale: 0, particleScale: 0.52 }),
});

const BURST_STYLES = Object.freeze({
  fire: { variant: 0, colorA: [1, 0.16, 0.025, 1], colorB: [1, 0.86, 0.22, 1], opacity: 0.92, life: 0.42, aspect: 0.82 },
  frost: { variant: 1, colorA: [0.12, 0.56, 1, 1], colorB: [0.88, 0.99, 1, 1], opacity: 0.88, life: 0.52, aspect: 0.9 },
  poison: { variant: 2, colorA: [0.12, 0.42, 0.08, 1], colorB: [0.64, 1, 0.24, 1], opacity: 0.82, life: 0.58, aspect: 0.78 },
  holy: { variant: 3, colorA: [1, 0.62, 0.08, 1], colorB: [1, 1, 0.8, 1], opacity: 0.9, life: 0.48, aspect: 1 },
  merge: { variant: 4, colorA: [0.18, 0.7, 1, 1], colorB: [1, 0.96, 0.55, 1], opacity: 0.92, life: 0.46, aspect: 1 },
  boss: { variant: 5, colorA: [0.2, 0.75, 1, 1], colorB: [1, 1, 1, 1], opacity: 1, life: 0.7, aspect: 1 },
  blast: { variant: 0, colorA: [0.78, 0.035, 0.01, 1], colorB: [1, 0.93, 0.28, 1], opacity: 0.96, life: 0.46, aspect: 0.82 },
  molten: { variant: 5, colorA: [0.38, 0.008, 0.003, 1], colorB: [1, 0.72, 0.08, 1], opacity: 1, life: 0.58, aspect: 0.8 },
  glacier: { variant: 1, colorA: [0.025, 0.36, 0.88, 1], colorB: [0.9, 1, 1, 1], opacity: 0.96, life: 0.58, aspect: 0.94 },
  vortex: { variant: 4, colorA: [0.02, 0.34, 0.72, 1], colorB: [0.45, 1, 1, 1], opacity: 0.88, life: 0.68, aspect: 0.72 },
  mirror: { variant: 5, colorA: [0.18, 0.58, 0.98, 1], colorB: [0.94, 1, 1, 1], opacity: 0.92, life: 0.5, aspect: 1 },
  nexus: { variant: 3, colorA: [0.25, 0.12, 0.88, 1], colorB: [0.93, 0.86, 1, 1], opacity: 0.9, life: 0.42, aspect: 1 },
  magstorm: { variant: 4, colorA: [0.16, 0.05, 0.72, 1], colorB: [0.72, 0.62, 1, 1], opacity: 0.88, life: 0.48, aspect: 1 },
  refraction: { variant: 5, colorA: [0.08, 0.66, 1, 1], colorB: [1, 0.91, 0.38, 1], opacity: 0.94, life: 0.5, aspect: 1 },
  judgement: { variant: 3, colorA: [0.95, 0.5, 0.04, 1], colorB: [1, 1, 0.91, 1], opacity: 1, life: 0.56, aspect: 1 },
  radiance: { variant: 4, colorA: [0.82, 0.38, 0.03, 1], colorB: [1, 0.98, 0.68, 1], opacity: 0.86, life: 0.52, aspect: 1 },
  plague: { variant: 2, colorA: [0.22, 0.08, 0.3, 1], colorB: [0.68, 0.94, 0.3, 1], opacity: 0.9, life: 0.66, aspect: 0.84 },
  corrosion: { variant: 5, colorA: [0.2, 0.28, 0.01, 1], colorB: [0.92, 1, 0.32, 1], opacity: 0.9, life: 0.48, aspect: 0.9 },
  spores: { variant: 4, colorA: [0.04, 0.24, 0.12, 1], colorB: [0.54, 1, 0.38, 1], opacity: 0.82, life: 0.62, aspect: 0.88 },
});

const FIELD_STYLES = Object.freeze({
  fire: { variant: 0, colorA: [0.26, 0.015, 0.006, 1], colorB: [1, 0.27, 0.035, 1], opacity: 0.76, aspect: 0.48 },
  poison: { variant: 1, colorA: [0.035, 0.16, 0.025, 1], colorB: [0.44, 0.88, 0.12, 1], opacity: 0.68, aspect: 0.58 },
  scorched: { variant: 0, colorA: [0.2, 0.006, 0.002, 1], colorB: [1, 0.22, 0.018, 1], opacity: 0.82, aspect: 0.54 },
  spores: { variant: 1, colorA: [0.025, 0.12, 0.055, 1], colorB: [0.38, 0.9, 0.22, 1], opacity: 0.72, aspect: 0.62 },
  magstorm: { variant: 2, colorA: [0.055, 0.018, 0.28, 1], colorB: [0.54, 0.4, 1, 1], opacity: 0.76, aspect: 0.7 },
  radiance: { variant: 3, colorA: [0.34, 0.14, 0.008, 1], colorB: [1, 0.82, 0.28, 1], opacity: 0.64, aspect: 0.76 },
});

const PARTICLE_LANES = Object.freeze({
  fire: {
    texture: 'fire_ember', budget: 64, depth: 2110, blendMode: Phaser.BlendModes.ADD,
    config: { lifespan: { min: 360, max: 680 }, speed: { min: 90, max: 280 }, angle: { min: 205, max: 335 }, gravityY: 340, rotate: { min: -80, max: 80 }, scale: { start: 0.9, end: 0.04 }, alpha: { start: 1, end: 0 } },
  },
  frost: {
    texture: 'ice_shard', budget: 72, depth: 2110, blendMode: Phaser.BlendModes.ADD,
    config: { lifespan: { min: 360, max: 650 }, speed: { min: 90, max: 265 }, angle: { min: 0, max: 360 }, rotate: { min: -260, max: 260 }, scale: { start: 0.62, end: 0.04 }, alpha: { start: 1, end: 0 } },
  },
  poison: {
    texture: 'poison_drop', budget: 60, depth: 2080, blendMode: Phaser.BlendModes.NORMAL,
    config: { lifespan: { min: 420, max: 780 }, speed: { min: 75, max: 255 }, angle: { min: 0, max: 360 }, gravityY: 145, rotate: { min: -170, max: 170 }, tint: [0x4a9f36, 0x7ede55, 0xc8ff8c], scale: { start: 0.9, end: 0.08 }, alpha: { start: 0.94, end: 0 } },
  },
  plague: {
    texture: 'poison_drop', budget: 48, depth: 2084, blendMode: Phaser.BlendModes.NORMAL,
    config: { lifespan: { min: 420, max: 820 }, speed: { min: 85, max: 270 }, angle: { min: 0, max: 360 }, gravityY: 95, rotate: { min: -180, max: 180 }, tint: [0x78558f, 0x9d77b3, 0xa6d35f], scale: { start: 0.96, end: 0.06 }, alpha: { start: 0.96, end: 0 } },
  },
  corrosion: {
    texture: 'corrosion_shard', budget: 44, depth: 2106, blendMode: Phaser.BlendModes.ADD,
    config: { lifespan: { min: 240, max: 480 }, speed: { min: 80, max: 250 }, angle: { min: 0, max: 360 }, rotate: { min: -260, max: 260 }, tint: [0x9ebd24, 0xdfff62, 0xffffc5], scale: { start: 0.82, end: 0.05 }, alpha: { start: 1, end: 0 } },
  },
  spores: {
    texture: 'spore_mote', budget: 56, depth: 2082, blendMode: Phaser.BlendModes.ADD,
    config: { lifespan: { min: 520, max: 980 }, speed: { min: 45, max: 190 }, angle: { min: 195, max: 345 }, gravityY: -55, rotate: { min: -120, max: 120 }, tint: [0x57c968, 0x9ef07a, 0xd9ff9b], scale: { start: 0.92, end: 0.08 }, alpha: { start: 0.9, end: 0 } },
  },
  electric: {
    texture: 'electric_spark', budget: 64, depth: 2110, blendMode: Phaser.BlendModes.ADD,
    config: { lifespan: { min: 110, max: 260 }, speed: { min: 105, max: 310 }, angle: { min: 0, max: 360 }, rotate: { min: -180, max: 180 }, tint: [0x806bff, 0xb8a7ff, 0xe8e3ff, 0xffffff], scale: { start: 0.92, end: 0.06 }, alpha: { start: 1, end: 0 } },
  },
  conducted: {
    texture: 'electric_spark', budget: 48, depth: 2110, blendMode: Phaser.BlendModes.ADD,
    config: { lifespan: { min: 130, max: 290 }, speed: { min: 90, max: 260 }, angle: { min: 0, max: 360 }, rotate: { min: -150, max: 150 }, tint: [0xffd86a, 0xfff4c2, 0xffffff, 0x9ee8ff], scale: { start: 0.88, end: 0.05 }, alpha: { start: 1, end: 0 } },
  },
  holy: {
    texture: 'holy_mote', budget: 56, depth: 2117, blendMode: Phaser.BlendModes.ADD,
    config: { lifespan: { min: 280, max: 620 }, speed: { min: 65, max: 260 }, angle: { min: 0, max: 360 }, gravityY: -90, rotate: { min: -150, max: 150 }, tint: [0xffd95a, 0xfff3a8, 0xffffff], scale: { start: 0.9, end: 0.04 }, alpha: { start: 1, end: 0 } },
  },
  prism: {
    texture: 'prism_shard', budget: 52, depth: 2114, blendMode: Phaser.BlendModes.ADD,
    config: { lifespan: { min: 220, max: 460 }, speed: { min: 80, max: 260 }, angle: { min: 0, max: 360 }, rotate: { min: -230, max: 230 }, tint: [0x62d8ff, 0xffe36a, 0xff8de3, 0xffffff], scale: { start: 0.8, end: 0.04 }, alpha: { start: 1, end: 0 } },
  },
  merge: {
    texture: 'spark', budget: 64, depth: 2350, blendMode: Phaser.BlendModes.ADD,
    config: { lifespan: { min: 300, max: 560 }, speed: { min: 135, max: 340 }, angle: { min: 0, max: 360 }, tint: [0x64d8ff, 0xffe66d, 0xffffff], scale: { start: 1.05, end: 0.02 }, alpha: { start: 1, end: 0 } },
  },
});

function queryParams() {
  try { return new URLSearchParams(window.location.search); } catch { return new URLSearchParams(); }
}

export function preloadVfxAssets(scene) {
  for (const [key, url] of Object.entries(VFX_SHADER_ASSETS)) {
    if (!scene.cache.shader.exists(key)) scene.load.glsl(key, url);
  }
}

export function detectVfxCapabilities(scene) {
  const renderer = scene.sys.renderer;
  const webgl = renderer?.type === Phaser.WEBGL;
  return Object.freeze({
    renderer: webgl ? 'webgl' : 'canvas',
    shader: webgl && typeof scene.add.shader === 'function',
    mesh: webgl && typeof scene.add.mesh2d === 'function',
    particles: typeof scene.add.particles === 'function',
  });
}

export function resolveVfxQuality(capabilities, params = queryParams()) {
  const requested = params.get('vfx');
  if (!capabilities.shader || requested === 'off' || requested === 'fallback') return QUALITY.fallback;
  if (requested === 'low') return QUALITY.low;
  if (requested === 'high') return QUALITY.high;
  const memory = Number(globalThis.navigator?.deviceMemory) || 0;
  const cores = Number(globalThis.navigator?.hardwareConcurrency) || 0;
  return (memory > 0 && memory <= 2) || (cores > 0 && cores <= 2) ? QUALITY.low : QUALITY.high;
}

function shaderState(overrides = {}) {
  return {
    time: 0, progress: 0, intensity: 1, resolution: [128, 128], direction: [1, 0],
    colorA: [1, 1, 1, 1], colorB: [1, 1, 1, 1], opacity: 1, variant: 0,
    ...overrides,
  };
}

function shaderConfig(fragmentKey, state) {
  return {
    name: fragmentKey,
    fragmentKey,
    setupUniforms: (setUniform) => {
      setUniform('uTime', state.time);
      setUniform('uProgress', state.progress);
      setUniform('uIntensity', state.intensity);
      setUniform('uResolution', state.resolution);
      setUniform('uDirection', state.direction);
      setUniform('uColorA', state.colorA);
      setUniform('uColorB', state.colorB);
      setUniform('uOpacity', state.opacity);
      setUniform('uVariant', state.variant);
      setUniform('uNoise', 0);
    },
  };
}

export function warmupVfxShaders(scene) {
  const capabilities = detectVfxCapabilities(scene);
  const quality = resolveVfxQuality(capabilities);
  if (!capabilities.shader || quality.shaderScale <= 0 || !scene.textures.exists('vfx_noise')) return null;
  const warmed = [];
  for (const key of Object.values(VFX_SHADER_KEYS)) {
    if (!scene.cache.shader.exists(key)) continue;
    try {
      const state = shaderState({ opacity: 0, resolution: [2, 2] });
      warmed.push(scene.add.shader(shaderConfig(key, state), 1, 1, 2, 2, ['vfx_noise']).setDepth(-10000));
    } catch (error) {
      console.warn(`[VFX] Shader warmup failed for ${key}; fallback remains active.`, error);
    }
  }
  const dispose = () => warmed.splice(0).forEach(shader => shader.scene && shader.destroy());
  scene.game.events.once('postrender', dispose);
  scene.events.once('shutdown', dispose);
  return warmed;
}

class ParticleBank {
  constructor(scene, quality, activeBudget) {
    this.emitters = new Map();
    this.activeBudget = activeBudget;
    if (!scene.add.particles) return;
    for (const [key, lane] of Object.entries(PARTICLE_LANES)) {
      if (!scene.textures.exists(lane.texture)) continue;
      const capacity = Math.max(1, Math.floor(lane.budget * quality.particleScale));
      const emitter = scene.add.particles(0, 0, lane.texture, {
        ...lane.config,
        emitting: false,
        frequency: -1,
        maxParticles: capacity,
        maxAliveParticles: capacity,
      }).setDepth(lane.depth).setBlendMode(lane.blendMode);
      this.emitters.set(key, emitter);
    }
  }

  aliveCount() {
    let total = 0;
    for (const emitter of this.emitters.values()) total += emitter.getAliveParticleCount();
    return total;
  }

  has(channel) { return this.emitters.has(channel); }

  emitAt(channel, x, y, count = 1) {
    const emitter = this.emitters.get(channel);
    if (!emitter) return 0;
    const amount = Math.min(Math.max(0, Math.floor(count)), Math.max(0, this.activeBudget - this.aliveCount()));
    if (amount <= 0) return 0;
    const before = emitter.getAliveParticleCount();
    emitter.emitParticleAt(x, y, amount);
    return emitter.getAliveParticleCount() - before;
  }

  destroy() {
    for (const emitter of this.emitters.values()) emitter.destroy();
    this.emitters.clear();
  }
}

export class VfxRuntime {
  constructor(scene, { particleBudget = 220, maxShaders = 18 } = {}) {
    this.scene = scene;
    this.capabilities = detectVfxCapabilities(scene);
    this.quality = resolveVfxQuality(this.capabilities);
    this.maxShaders = maxShaders;
    this.clock = 0;
    this.handles = new Set();
    this.active = [];
    this.particles = new ParticleBank(scene, this.quality, particleBudget);
  }

  createShader(key, options = {}) {
    if (!this.capabilities.shader || this.quality.shaderScale <= 0 || this.handles.size >= this.maxShaders
      || !this.scene.cache.shader.exists(key) || !this.scene.textures.exists('vfx_noise')) return null;
    const displayWidth = Math.max(1, options.width || 128);
    const displayHeight = Math.max(1, options.height || 128);
    const width = Math.max(1, Math.round(displayWidth * this.quality.shaderScale));
    const height = Math.max(1, Math.round(displayHeight * this.quality.shaderScale));
    const state = shaderState({ resolution: [width, height], ...(options.uniforms || {}) });
    try {
      const shader = this.scene.add.shader(
        shaderConfig(key, state), options.x || 0, options.y || 0, width, height, ['vfx_noise'],
      );
      if (width !== displayWidth || height !== displayHeight) shader.setDisplaySize(displayWidth, displayHeight);
      shader.setDepth(options.depth ?? 2100);
      if (options.rotation !== undefined) shader.setRotation(options.rotation);
      if (options.blendMode !== undefined) shader.setBlendMode(options.blendMode);
      const handle = {
        shader,
        state,
        set: values => Object.assign(state, values),
        destroy: () => {
          this.handles.delete(handle);
          if (shader.scene) shader.destroy();
        },
      };
      this.handles.add(handle);
      return handle;
    } catch (error) {
      console.warn(`[VFX] Shader ${key} failed; using sprite fallback.`, error);
      return null;
    }
  }

  burst(styleKey, x, y, radius, options = {}) {
    const style = BURST_STYLES[styleKey];
    if (!style) return false;
    const size = radius * 2.2;
    const angle = options.angle ?? Math.random() * Math.PI * 2;
    const handle = this.createShader(VFX_SHADER_KEYS.burst, {
      x, y, width: size, height: size * style.aspect, depth: options.depth ?? 2090,
      blendMode: Phaser.BlendModes.ADD,
      uniforms: {
        direction: [Math.cos(angle), Math.sin(angle)],
        colorA: options.colorA || style.colorA, colorB: options.colorB || style.colorB,
        opacity: options.opacity ?? style.opacity, intensity: options.intensity ?? 1,
        variant: style.variant,
      },
    });
    if (!handle) return false;
    const life = options.life || style.life;
    this.active.push({ handle, age: 0, life });
    return true;
  }

  field(styleKey, x, y, radius, options = {}) {
    const style = FIELD_STYLES[styleKey];
    if (!style) return null;
    const angle = Math.random() * Math.PI * 2;
    const handle = this.createShader(VFX_SHADER_KEYS.field, {
      x, y, width: radius * 2.15, height: radius * 2.15 * style.aspect,
      depth: options.depth ?? 98,
      uniforms: {
        direction: [Math.cos(angle), Math.sin(angle)],
        colorA: style.colorA, colorB: style.colorB, opacity: options.opacity ?? style.opacity,
        intensity: options.intensity ?? 1, variant: style.variant,
      },
    });
    if (!handle) return null;
    return { shader: handle.shader, set: handle.set, destroy: handle.destroy };
  }

  beam(x1, y1, x2, y2, options = {}) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const length = Math.max(2, Math.hypot(dx, dy));
    const life = options.life || 0.22;
    const handle = this.createShader(VFX_SHADER_KEYS.beam, {
      x: (x1 + x2) * 0.5, y: (y1 + y2) * 0.5,
      width: length + 24, height: options.width || 34, rotation: Math.atan2(dy, dx), depth: options.depth ?? 2102,
      blendMode: Phaser.BlendModes.ADD,
      uniforms: {
        direction: [1, 0], colorA: options.colorA || [0.2, 0.88, 1, 1],
        colorB: options.colorB || [1, 0.96, 0.58, 1], opacity: options.opacity ?? 0.96,
        intensity: options.intensity ?? 1,
      },
    });
    if (!handle) return false;
    this.active.push({ handle, age: 0, life });
    return true;
  }

  emit(channel, x, y, count) { return this.particles.emitAt(channel, x, y, count); }

  hasParticleChannel(channel) { return this.particles.has(channel); }

  update(dt) {
    this.clock += dt;
    for (const handle of this.handles) handle.state.time = this.clock;
    for (let i = this.active.length - 1; i >= 0; i--) {
      const fx = this.active[i];
      fx.age += dt;
      fx.handle.set({ progress: Math.min(1, fx.age / fx.life) });
      if (fx.age < fx.life) continue;
      fx.handle.destroy();
      this.active.splice(i, 1);
    }
  }

  diagnostics() {
    return {
      renderer: this.capabilities.renderer,
      quality: this.quality.key,
      shaders: this.handles.size,
      particles: this.particles.aliveCount(),
    };
  }

  destroy() {
    this.active.length = 0;
    for (const handle of [...this.handles]) handle.destroy();
    this.particles.destroy();
  }
}
