import Phaser from 'phaser';
import { VFX_SHADER_KEYS } from './VfxRuntime.js';

const POINT_COUNT = 10;
const ENERGY_TEXTURE = 'ssa_vfx_beam_energy';

const BEAM_PROFILES = Object.freeze({
  chain: Object.freeze({
    life: 0.15, jitter: 15, refresh: 0.035, outerAlpha: 0.76, energyAlpha: 0.9,
    coreAlpha: 0.96, outerWidth: 13, impact: 'electric', sparks: 5,
  }),
  nexus: Object.freeze({
    life: 0.2, jitter: 19, refresh: 0.03, outerAlpha: 0.88, energyAlpha: 1,
    coreAlpha: 1, outerWidth: 17, impact: 'electric', sparks: 8,
  }),
  storm: Object.freeze({
    life: 0.22, jitter: 22, refresh: 0.028, outerAlpha: 0.9, energyAlpha: 1,
    coreAlpha: 1, outerWidth: 18, impact: 'electric', sparks: 9,
  }),
  conducted: Object.freeze({
    life: 0.18, jitter: 8, refresh: 0.04, outerAlpha: 0.8, energyAlpha: 0.94,
    coreAlpha: 1, outerWidth: 12, impact: 'conducted', sparks: 6,
  }),
  prism: Object.freeze({
    life: 0.2, jitter: 4.5, refresh: 0.045, outerAlpha: 0.82, energyAlpha: 0.96,
    coreAlpha: 1, outerWidth: 11, impact: 'prism', sparks: 6,
  }),
  mirror: Object.freeze({
    life: 0.19, jitter: 2.8, refresh: 0.05, outerAlpha: 0.78, energyAlpha: 0.92,
    coreAlpha: 0.98, outerWidth: 10, impact: 'frost', sparks: 5,
  }),
  judgement: Object.freeze({
    life: 0.2, jitter: 1.8, refresh: 0.055, outerAlpha: 0.84, energyAlpha: 0.98,
    coreAlpha: 1, outerWidth: 10, impact: 'holy', sparks: 7,
  }),
  radiance: Object.freeze({
    life: 0.18, jitter: 3.2, refresh: 0.05, outerAlpha: 0.72, energyAlpha: 0.9,
    coreAlpha: 0.96, outerWidth: 9, impact: 'holy', sparks: 5,
  }),
});

function makePoints() {
  return Array.from({ length: POINT_COUNT }, () => ({ x: 0, y: 0 }));
}

function makeGeometry() {
  const vertices = new Array(POINT_COUNT * 2 * 4).fill(0);
  const indices = [];
  for (let i = 0; i < POINT_COUNT - 1; i++) {
    const a = i * 2;
    const b = a + 1;
    const c = a + 2;
    const d = a + 3;
    indices.push(a, b, c, 0, b, c, d, 0);
  }
  return { vertices, indices };
}

function brighten(color, amount = 0.36) {
  const r = (color >> 16) & 0xff;
  const g = (color >> 8) & 0xff;
  const b = color & 0xff;
  return ((Math.round(r + (255 - r) * amount) << 16)
    | (Math.round(g + (255 - g) * amount) << 8)
    | Math.round(b + (255 - b) * amount)) >>> 0;
}

// Adapted from the author's Vampire Survivors-like project. Each pooled slot
// shares one animated centerline across a soft outer ribbon, energy ribbon and
// white-hot core so rapid chains feel alive without allocating Graphics objects.
export class BeamSystem {
  constructor(scene, runtime, { maxSlots = 24 } = {}) {
    this.scene = scene;
    this.runtime = runtime;
    this.slots = [];
    this.cursor = 0;
    this.energySource = null;
    this.enabled = runtime.capabilities.mesh && runtime.quality.key !== 'fallback';
    if (!this.enabled) return;

    this.prepareEnergyTexture();
    const capacity = runtime.quality.key === 'low' ? Math.max(8, Math.floor(maxSlots * 0.5)) : maxSlots;
    for (let i = 0; i < capacity; i++) this.slots.push(this.createSlot());
  }

  prepareEnergyTexture() {
    if (!this.runtime.capabilities.shader || this.runtime.quality.shaderScale <= 0) return;
    if (this.scene.textures.exists(ENERGY_TEXTURE)) this.scene.textures.remove(ENERGY_TEXTURE);
    const handle = this.runtime.createShader(VFX_SHADER_KEYS.beam, {
      x: 0, y: 0, width: 256, height: 16, depth: -10000,
      uniforms: {
        progress: 0.4, intensity: 1.1, direction: [1, 0],
        colorA: [0.72, 0.72, 0.72, 1], colorB: [1, 1, 1, 1], opacity: 1,
      },
    });
    if (!handle) return;
    handle.shader.setRenderToTexture(ENERGY_TEXTURE).setVisible(false);
    this.scene.textures.get(ENERGY_TEXTURE).setWrap(
      Phaser.Textures.WrapMode.REPEAT,
      Phaser.Textures.WrapMode.CLAMP_TO_EDGE,
    );
    this.energySource = handle;
  }

  createMesh(texture, depth) {
    const geometry = makeGeometry();
    const mesh = this.scene.add.mesh2d(0, 0, texture, geometry.vertices, geometry.indices, false)
      .setDepth(depth).setBlendMode(Phaser.BlendModes.NORMAL).setVisible(false);
    mesh.buildOrderedIndices(1, true);
    return mesh;
  }

  createSlot() {
    return {
      points: makePoints(),
      outer: this.createMesh('beam_outer', 2098),
      energy: this.energySource ? this.createMesh(ENERGY_TEXTURE, 2100) : null,
      core: this.createMesh('beam_core', 2102),
      active: false, x1: 0, y1: 0, x2: 0, y2: 0, life: 0, maxLife: 0,
      refreshT: 0, energyPhase: 0, profile: BEAM_PROFILES.chain, color: 0xffffff,
    };
  }

  emit(x1, y1, x2, y2, color = 0xb8a7ff, profileKey = 'chain') {
    if (!this.enabled || this.slots.length === 0) return false;
    let slot = this.slots.find(candidate => !candidate.active);
    if (!slot) {
      slot = this.slots[this.cursor];
      this.cursor = (this.cursor + 1) % this.slots.length;
    }

    const profile = BEAM_PROFILES[profileKey] || BEAM_PROFILES.chain;
    slot.active = true;
    slot.x1 = x1; slot.y1 = y1; slot.x2 = x2; slot.y2 = y2;
    slot.life = profile.life;
    slot.maxLife = profile.life;
    slot.refreshT = 0;
    slot.energyPhase = Math.random();
    slot.profile = profile;
    slot.color = color || 0xffffff;

    slot.outer.setPosition(x1, y1).setTint(slot.color).setAlpha(profile.outerAlpha).setVisible(true);
    slot.energy?.setPosition(x1, y1).setTint(brighten(slot.color)).setAlpha(profile.energyAlpha).setVisible(true);
    slot.core.setPosition(x1, y1).setTint(0xffffff).setAlpha(profile.coreAlpha).setVisible(true);
    this.refreshPoints(slot);
    this.scrollEnergy(slot, 0);
    if (profile.impact && profile.sparks > 0) this.runtime.emit(profile.impact, x2, y2, profile.sparks);
    return true;
  }

  refreshPoints(slot) {
    const dx = slot.x2 - slot.x1;
    const dy = slot.y2 - slot.y1;
    const length = Math.max(0.001, Math.hypot(dx, dy));
    const nx = -dy / length;
    const ny = dx / length;
    const alongX = dx / length;
    const alongY = dy / length;
    for (let i = 0; i < POINT_COUNT; i++) {
      const t = i / (POINT_COUNT - 1);
      const endpoint = i === 0 || i === POINT_COUNT - 1;
      const envelope = Math.sin(t * Math.PI);
      const side = endpoint ? 0 : (Math.random() * 2 - 1) * slot.profile.jitter * envelope;
      const along = endpoint ? 0 : (Math.random() * 2 - 1) * slot.profile.jitter * 0.14;
      slot.points[i].x = dx * t + nx * side + alongX * along;
      slot.points[i].y = dy * t + ny * side + alongY * along;
    }
    this.updateMesh(slot.outer, slot.points, slot.profile.outerWidth, 0);
    if (slot.energy) this.updateMesh(slot.energy, slot.points, slot.profile.outerWidth * 0.56, slot.energyPhase);
    this.updateMesh(slot.core, slot.points, Math.max(2.8, slot.profile.outerWidth * 0.24), 0);
    slot.refreshT = slot.profile.refresh;
  }

  updateMesh(mesh, points, halfWidth, phase) {
    const vertices = mesh.vertices;
    for (let i = 0; i < POINT_COUNT; i++) {
      const prev = points[Math.max(0, i - 1)];
      const next = points[Math.min(POINT_COUNT - 1, i + 1)];
      const dx = next.x - prev.x;
      const dy = next.y - prev.y;
      const length = Math.max(0.001, Math.hypot(dx, dy));
      const nx = -dy / length * halfWidth;
      const ny = dx / length * halfWidth;
      const u = i / (POINT_COUNT - 1) + phase;
      const top = i * 8;
      vertices[top] = points[i].x + nx;
      vertices[top + 1] = points[i].y + ny;
      vertices[top + 2] = u;
      vertices[top + 3] = 0;
      vertices[top + 4] = points[i].x - nx;
      vertices[top + 5] = points[i].y - ny;
      vertices[top + 6] = u;
      vertices[top + 7] = 1;
    }
  }

  scrollEnergy(slot, dt) {
    if (!slot.energy) return;
    slot.energyPhase = (slot.energyPhase + dt * 3.8) % 1;
    const vertices = slot.energy.vertices;
    for (let i = 0; i < POINT_COUNT; i++) {
      const u = i / (POINT_COUNT - 1) + slot.energyPhase;
      const top = i * 8;
      vertices[top + 2] = u;
      vertices[top + 6] = u;
    }
  }

  release(slot) {
    slot.active = false;
    slot.life = 0;
    slot.outer.setVisible(false);
    slot.energy?.setVisible(false);
    slot.core.setVisible(false);
  }

  update(dt) {
    for (const slot of this.slots) {
      if (!slot.active) continue;
      slot.life -= dt;
      if (slot.life <= 0) {
        this.release(slot);
        continue;
      }
      slot.refreshT -= dt;
      if (slot.refreshT <= 0) this.refreshPoints(slot);
      const progress = 1 - slot.life / slot.maxLife;
      const fade = 1 - Math.max(0, (progress - 0.56) / 0.44);
      this.scrollEnergy(slot, dt);
      slot.outer.setAlpha(slot.profile.outerAlpha * fade);
      slot.energy?.setAlpha(slot.profile.energyAlpha * fade);
      slot.core.setAlpha(slot.profile.coreAlpha * fade);
    }
  }

  activeCount() {
    return this.slots.reduce((count, slot) => count + (slot.active ? 1 : 0), 0);
  }

  destroy() {
    for (const slot of this.slots) {
      slot.outer.destroy();
      slot.energy?.destroy();
      slot.core.destroy();
    }
    this.slots.length = 0;
    this.energySource?.destroy();
    this.energySource = null;
    if (this.scene.textures.exists(ENERGY_TEXTURE)) this.scene.textures.remove(ENERGY_TEXTURE);
    this.enabled = false;
  }
}
