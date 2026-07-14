// Lightweight procedural 2.5D sprites aligned with the forest reference art.
// Keeps M4 package size tiny while the final hand-painted atlas is still absent.
import { ELEMENTS, ENEMY_TYPES } from './config.js';

export const PAINTED_TOWER_ATLAS = 'tower_atlas_painted';
export const PAINTED_TOWER_ATLAS_IMAGE = 'assets/towers/towers-painted-v1.webp';
export const PAINTED_TOWER_ATLAS_JSON = 'assets/towers/towers-painted-v1.json';

const PAINTED_TOWER_FRAMES = {
  fire: { base: 'fire_base', a: 'fire_explosive_a', b: 'fire_molten_core_b' },
  ice: { base: 'ice_base', a: 'ice_glacier_a', b: 'ice_shatter_b' },
  lightning: { base: 'lightning_base', a: 'lightning_storm_a', b: 'lightning_stun_node_b' },
  poison: { base: 'poison_base', a: 'poison_plague_a', b: 'poison_corrosion_b' },
  light: { base: 'light_base', a: 'light_judgement_a', b: 'light_radiance_b' },
};

export function paintedTowerFrameKey(element, level = 1, branch = null) {
  const variant = level >= 4 && (branch === 'a' || branch === 'b') ? branch : 'base';
  return PAINTED_TOWER_FRAMES[element]?.[variant] || PAINTED_TOWER_FRAMES[element]?.base || null;
}

export function towerTextureSpec(scene, element, level = 1, branch = null) {
  const frame = paintedTowerFrameKey(element, level, branch);
  const texture = scene.textures.exists(PAINTED_TOWER_ATLAS)
    ? scene.textures.get(PAINTED_TOWER_ATLAS)
    : null;
  if (frame && texture?.frames?.[frame]) {
    return { key: PAINTED_TOWER_ATLAS, frame, painted: true };
  }
  return { key: `tower_${element}`, frame: null, painted: false };
}

export function addTowerImage(scene, x, y, element, level = 1, branch = null) {
  const spec = towerTextureSpec(scene, element, level, branch);
  return spec.frame
    ? scene.add.image(x, y, spec.key, spec.frame)
    : scene.add.image(x, y, spec.key);
}

export function applyTowerImage(image, scene, element, level = 1, branch = null) {
  const spec = towerTextureSpec(scene, element, level, branch);
  if (spec.frame) image.setTexture(spec.key, spec.frame);
  else image.setTexture(spec.key);
  return image;
}

export function fitTowerImageHeight(image, displayHeight) {
  return image.setScale(displayHeight / image.height);
}

export const PAINTED_ENEMY_LEGACY_ATLAS = 'enemy_atlas';
export const PAINTED_ENEMY_KEYS = ['slime', 'mini', 'runner', 'tank', 'flyer', 'splitter', 'priest', 'boss'];
export const PAINTED_ENEMY_SOURCE_DIRECTIONS = ['front', 'left', 'front_left'];
export const PAINTED_ENEMY_PLAY_DIRECTIONS = ['front', 'left', 'right', 'front_left', 'front_right'];
export const PAINTED_ENEMY_MIN_FRAMES = 5;
export const PAINTED_ENEMY_MAX_FRAMES = 8;

const PAINTED_ENEMY_MIRROR_SOURCES = {
  right: 'left',
  front_right: 'front_left',
};

const PAINTED_ENEMY_SOURCE_FALLBACKS = {
  front: ['front', 'front_left', 'left'],
  left: ['left', 'front_left', 'front'],
  front_left: ['front_left', 'left', 'front'],
};

export function paintedEnemyKey(typeKey) {
  return PAINTED_ENEMY_KEYS.includes(typeKey) ? typeKey : 'slime';
}

export function paintedEnemyAnimKey(typeKey, direction = 'left') {
  return `enemy_${paintedEnemyKey(typeKey)}_${direction}`;
}

export function paintedEnemyAtlasKey(typeKey) {
  return `enemy_atlas_${paintedEnemyKey(typeKey)}`;
}

export function paintedEnemyAtlasImage(typeKey) {
  const key = paintedEnemyKey(typeKey);
  const version = key === 'boss' ? 'v6' : key === 'priest' ? 'v1' : 'v2';
  return `assets/enemies/enemy-${key}-smooth-${version}.webp`;
}

export function paintedEnemyAtlasJson(typeKey) {
  const key = paintedEnemyKey(typeKey);
  const version = key === 'boss' ? 'v6' : key === 'priest' ? 'v1' : 'v2';
  return `assets/enemies/enemy-${key}-smooth-${version}.json`;
}

export function paintedEnemyTextureKey(scene, typeKey) {
  const atlasKey = paintedEnemyAtlasKey(typeKey);
  if (scene.textures.exists(atlasKey)) return atlasKey;
  if (scene.textures.exists(PAINTED_ENEMY_LEGACY_ATLAS)) return PAINTED_ENEMY_LEGACY_ATLAS;
  return null;
}

export function paintedEnemyFrameKey(typeKey, direction, frame) {
  return `${paintedEnemyKey(typeKey)}_${direction}_${frame}`;
}

export function paintedEnemySourceDirection(direction) {
  return PAINTED_ENEMY_MIRROR_SOURCES[direction] || direction;
}

export function paintedEnemyDirectionFlipX(direction) {
  return direction === 'right' || direction === 'front_right';
}

export function paintedEnemyPlaybackDirection(dx, dy) {
  const ax = Math.abs(dx);
  const ay = Math.abs(dy);
  if (ax < 0.25 && ay < 0.25) return null;
  if (dy <= 0 && ax < 0.25) return null;
  if (dy > 0) {
    if (ax <= ay * 0.45) return 'front';
    if (ax <= ay * 1.6) return dx > 0 ? 'front_right' : 'front_left';
  }
  return dx > 0 ? 'right' : 'left';
}

export function paintedEnemyFrameNumbers(scene, typeKey, direction) {
  const textureKey = paintedEnemyTextureKey(scene, typeKey);
  if (!textureKey) return [];
  const texture = scene.textures.get(textureKey);
  const frames = [];
  for (let i = 1; i <= PAINTED_ENEMY_MAX_FRAMES; i++) {
    if (!texture?.frames?.[paintedEnemyFrameKey(typeKey, direction, i)]) break;
    frames.push(i);
  }
  return frames;
}

export function paintedEnemyHasFrames(scene, typeKey, direction) {
  return paintedEnemyFrameNumbers(scene, typeKey, direction).length >= PAINTED_ENEMY_MIN_FRAMES;
}

export function paintedEnemyAnimationSource(scene, typeKey, direction) {
  const source = paintedEnemySourceDirection(direction);
  const fallbacks = PAINTED_ENEMY_SOURCE_FALLBACKS[source] || [source, 'left', 'front'];
  return fallbacks.find(candidate => paintedEnemyHasFrames(scene, typeKey, candidate)) || null;
}

function paintedEnemyFrameRate(typeKey, frameCount) {
  // The Boss source preview is authored at roughly 5 FPS. Playing the same
  // five-frame gait at the generic 9 FPS makes its large side silhouette snap
  // between poses instead of reading as a heavy walk.
  if (typeKey === 'boss') return 5;
  const cyclesPerSecond = typeKey === 'runner' || typeKey === 'flyer' ? 2.25 : 1.75;
  return Math.max(1, Math.round(frameCount * cyclesPerSecond));
}

export function paintedEnemyFrameTarget(typeKey, type) {
  if (typeKey === 'boss') return 104;
  if (typeKey === 'tank') return 82;
  if (typeKey === 'flyer') return 78;
  if (typeKey === 'splitter') return 76;
  if (typeKey === 'priest') return 82;
  if (typeKey === 'runner') return 64;
  if (typeKey === 'mini') return 42;
  return (type.size + 8) * 2;
}

export function createEnemyAnimations(scene) {
  for (const key of PAINTED_ENEMY_KEYS) {
    const textureKey = paintedEnemyTextureKey(scene, key);
    if (!textureKey) continue;
    for (const direction of PAINTED_ENEMY_SOURCE_DIRECTIONS) {
      const frameNumbers = paintedEnemyFrameNumbers(scene, key, direction);
      if (frameNumbers.length < PAINTED_ENEMY_MIN_FRAMES) continue;
      const animKey = paintedEnemyAnimKey(key, direction);
      if (scene.anims.exists(animKey)) continue;
      scene.anims.create({
        key: animKey,
        frames: frameNumbers.map(i => ({ key: textureKey, frame: paintedEnemyFrameKey(key, direction, i) })),
        frameRate: paintedEnemyFrameRate(key, frameNumbers.length),
        repeat: -1,
      });
    }
  }
}

function shade(color, f) {
  const c = Phaser.Display.Color.IntegerToColor(color);
  const r = Math.min(255, Math.round(c.red * f));
  const g = Math.min(255, Math.round(c.green * f));
  const b = Math.min(255, Math.round(c.blue * f));
  return Phaser.Display.Color.GetColor(r, g, b);
}

function mix(color, toward, amount) {
  const a = Phaser.Display.Color.IntegerToColor(color);
  const b = Phaser.Display.Color.IntegerToColor(toward);
  return Phaser.Display.Color.GetColor(
    Math.round(a.red + (b.red - a.red) * amount),
    Math.round(a.green + (b.green - a.green) * amount),
    Math.round(a.blue + (b.blue - a.blue) * amount),
  );
}

function p(points) {
  return points.map(([x, y]) => ({ x, y }));
}

function drawOct(g, cx, cy, rx, ry, color, alpha = 1, ox = 0, oy = 0) {
  g.fillStyle(color, alpha);
  g.fillPoints(p([
    [cx - rx * 0.55 + ox, cy - ry + oy],
    [cx + rx * 0.55 + ox, cy - ry + oy],
    [cx + rx + ox, cy - ry * 0.38 + oy],
    [cx + rx + ox, cy + ry * 0.38 + oy],
    [cx + rx * 0.55 + ox, cy + ry + oy],
    [cx - rx * 0.55 + ox, cy + ry + oy],
    [cx - rx + ox, cy + ry * 0.38 + oy],
    [cx - rx + ox, cy - ry * 0.38 + oy],
  ]), true);
}

function strokeOct(g, cx, cy, rx, ry, color, alpha = 1) {
  g.lineStyle(2, color, alpha);
  g.strokePoints(p([
    [cx - rx * 0.55, cy - ry],
    [cx + rx * 0.55, cy - ry],
    [cx + rx, cy - ry * 0.38],
    [cx + rx, cy + ry * 0.38],
    [cx + rx * 0.55, cy + ry],
    [cx - rx * 0.55, cy + ry],
    [cx - rx, cy + ry * 0.38],
    [cx - rx, cy - ry * 0.38],
  ]), true, true);
}

function drawStoneBase(g, cx, cy, scale = 1, accent = 0x4fc3ff) {
  const rx = 34 * scale;
  const ry = 18 * scale;
  g.fillStyle(0x000000, 0.22);
  g.fillEllipse(cx, cy + 16 * scale, rx * 1.7, ry * 0.9);

  drawOct(g, cx, cy + 8 * scale, rx, ry, 0x242a32);
  drawOct(g, cx, cy + 2 * scale, rx, ry, 0x575e60);
  strokeOct(g, cx, cy + 2 * scale, rx, ry, 0x1a1e24, 0.55);

  drawOct(g, cx, cy - 3 * scale, rx * 0.78, ry * 0.72, 0x9a947c);
  drawOct(g, cx, cy - 6 * scale, rx * 0.66, ry * 0.58, 0xbeb58e);
  strokeOct(g, cx, cy - 6 * scale, rx * 0.66, ry * 0.58, 0x5b5646, 0.65);

  g.fillStyle(shade(accent, 0.7), 0.95);
  g.fillRoundedRect(cx - 19 * scale, cy + 3 * scale, 38 * scale, 12 * scale, 4 * scale);
  g.fillStyle(shade(accent, 1.12), 0.85);
  g.fillRoundedRect(cx - 14 * scale, cy + 1 * scale, 28 * scale, 6 * scale, 3 * scale);
}

function drawCrystal(g, cx, top, h, half, color) {
  const yMid = top + h * 0.54;
  const bottom = top + h;
  const bright = mix(shade(color, 1.25), 0xffffff, 0.12);
  const mid = shade(color, 0.98);
  const dark = shade(color, 0.58);

  g.fillStyle(dark, 1);
  g.fillPoints(p([[cx, top], [cx + half, top + h * 0.3], [cx + half * 0.72, bottom], [cx, bottom - 4]]), true);
  g.fillStyle(mid, 1);
  g.fillPoints(p([[cx, top], [cx, bottom - 4], [cx - half * 0.72, bottom], [cx - half, top + h * 0.3]]), true);
  g.fillStyle(bright, 1);
  g.fillPoints(p([[cx, top + 5], [cx - half * 0.42, top + h * 0.34], [cx - 3, yMid], [cx, bottom - 8]]), true);
  g.fillStyle(0xffffff, 0.48);
  g.fillPoints(p([[cx - 5, top + 8], [cx - 8, top + h * 0.38], [cx - 2, top + h * 0.5], [cx - 1, top + 16]]), true);

  g.lineStyle(2, shade(color, 0.42), 0.5);
  g.strokePoints(p([[cx, top], [cx + half, top + h * 0.3], [cx + half * 0.72, bottom], [cx, bottom - 4], [cx - half * 0.72, bottom], [cx - half, top + h * 0.3]]), true, true);
}

function drawElementMark(g, key, cx, cy, color) {
  g.fillStyle(0x10141c, 0.74);
  g.fillCircle(cx, cy, 10);
  g.lineStyle(2, shade(color, 1.12), 0.9);
  g.strokeCircle(cx, cy, 10);

  g.fillStyle(shade(color, 1.25), 1);
  if (key === 'fire') {
    g.fillPoints(p([[cx, cy - 8], [cx + 6, cy + 3], [cx, cy + 8], [cx - 7, cy + 3]]), true);
    g.fillStyle(0xfff0a0, 0.9);
    g.fillTriangle(cx, cy - 3, cx + 3, cy + 4, cx - 3, cy + 5);
  } else if (key === 'ice') {
    g.lineStyle(2, shade(color, 1.35), 1);
    g.lineBetween(cx - 7, cy, cx + 7, cy);
    g.lineBetween(cx, cy - 7, cx, cy + 7);
    g.lineBetween(cx - 5, cy - 5, cx + 5, cy + 5);
    g.lineBetween(cx + 5, cy - 5, cx - 5, cy + 5);
  } else if (key === 'lightning') {
    g.fillPoints(p([[cx + 1, cy - 8], [cx - 6, cy + 1], [cx, cy + 1], [cx - 2, cy + 8], [cx + 7, cy - 2], [cx + 1, cy - 2]]), true);
  } else if (key === 'poison') {
    g.fillCircle(cx, cy - 2, 6);
    g.fillStyle(0x10141c, 1);
    g.fillCircle(cx - 2.6, cy - 3, 1.8);
    g.fillCircle(cx + 2.6, cy - 3, 1.8);
    g.fillRect(cx - 4, cy + 3, 8, 2);
  } else {
    g.fillCircle(cx, cy, 5);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      g.fillTriangle(
        cx + Math.cos(a) * 7, cy + Math.sin(a) * 7,
        cx + Math.cos(a + 0.18) * 4, cy + Math.sin(a + 0.18) * 4,
        cx + Math.cos(a - 0.18) * 4, cy + Math.sin(a - 0.18) * 4,
      );
    }
  }
}

function drawTower(g, key, e) {
  const cx = 42;
  drawStoneBase(g, cx, 78, 1, e.color);

  g.fillStyle(shade(e.color, 0.42), 0.8);
  g.fillRoundedRect(cx - 15, 52, 30, 28, 5);
  g.fillStyle(shade(e.color, 0.82), 0.95);
  g.fillRoundedRect(cx - 11, 48, 22, 29, 4);

  drawCrystal(g, cx, 8, 58, 18, e.color);
  g.fillStyle(0xffffff, 0.14);
  g.fillCircle(cx - 12, 20, 11);
  drawElementMark(g, key, cx, 72, e.color);

  g.generateTexture('tower_' + key, 84, 106);
}

function drawSlime(g, cx, cy, s, color, eyes = true) {
  g.fillStyle(shade(color, 0.42), 1);
  g.fillEllipse(cx, cy + s * 0.42, s * 2.05, s * 0.96);
  g.fillStyle(shade(color, 0.9), 1);
  g.fillEllipse(cx, cy + s * 0.1, s * 1.92, s * 1.55);
  g.fillStyle(shade(color, 1.18), 1);
  g.fillEllipse(cx - s * 0.3, cy - s * 0.28, s * 0.72, s * 0.46);
  g.fillStyle(0xffffff, 0.3);
  g.fillEllipse(cx - s * 0.42, cy - s * 0.18, s * 0.28, s * 0.18);
  if (eyes) {
    g.fillStyle(0x172019, 1);
    g.fillCircle(cx - s * 0.32, cy + s * 0.05, Math.max(2.5, s * 0.12));
    g.fillCircle(cx + s * 0.32, cy + s * 0.05, Math.max(2.5, s * 0.12));
  }
}

function drawGolem(g, cx, cy, s, color, boss = false) {
  const stone = shade(color, boss ? 0.82 : 0.92);
  const dark = shade(color, 0.45);
  const moss = boss ? 0x9ee35b : 0x76865f;
  g.fillStyle(dark, 1);
  g.fillRoundedRect(cx - s * 1.1, cy - s * 0.06, s * 0.56, s * 0.84, 5);
  g.fillRoundedRect(cx + s * 0.54, cy - s * 0.06, s * 0.56, s * 0.84, 5);
  g.fillStyle(stone, 1);
  g.fillRoundedRect(cx - s * 0.78, cy - s * 0.72, s * 1.56, s * 1.4, 8);
  g.fillStyle(shade(color, 1.1), 1);
  g.fillRoundedRect(cx - s * 0.52, cy - s * 1.04, s * 1.04, s * 0.68, 7);
  g.fillStyle(0x10141c, 1);
  g.fillCircle(cx - s * 0.24, cy - s * 0.78, Math.max(3, s * 0.11));
  g.fillCircle(cx + s * 0.24, cy - s * 0.78, Math.max(3, s * 0.11));
  g.fillStyle(moss, 0.78);
  g.fillRoundedRect(cx - s * 0.42, cy - s * 0.22, s * 0.84, s * 0.18, 3);
  g.lineStyle(2, dark, 0.55);
  g.strokeRoundedRect(cx - s * 0.78, cy - s * 0.72, s * 1.56, s * 1.4, 8);
  if (boss) {
    g.fillStyle(0xfff18a, 0.95);
    g.fillCircle(cx - s * 0.24, cy - s * 0.78, Math.max(2, s * 0.07));
    g.fillCircle(cx + s * 0.24, cy - s * 0.78, Math.max(2, s * 0.07));
  }
}

function drawEnemy(g, key, t) {
  const s = t.size;
  const c = t.color;
  const cx = s + 8;
  const cy = s + 8;
  const d = (s + 8) * 2;

  if (key === 'tank') {
    drawGolem(g, cx, cy + 2, s, c, false);
  } else if (key === 'runner') {
    g.fillStyle(shade(c, 0.46), 1);
    g.fillEllipse(cx, cy + s * 0.52, s * 1.32, s * 0.42);
    g.fillStyle(shade(c, 0.72), 1);
    g.fillTriangle(cx - s * 0.85, cy + s * 0.18, cx + s * 0.86, cy, cx - s * 0.42, cy - s * 0.72);
    g.fillStyle(shade(c, 1.12), 1);
    g.fillTriangle(cx - s * 0.56, cy + s * 0.06, cx + s * 0.7, cy - s * 0.06, cx - s * 0.28, cy - s * 0.54);
    g.fillStyle(0xffffff, 0.65);
    g.fillCircle(cx + s * 0.24, cy - s * 0.12, Math.max(2, s * 0.11));
  } else if (key === 'flyer') {
    g.fillStyle(shade(c, 0.58), 1);
    g.fillPoints(p([[cx - s * 1.28, cy], [cx - s * 0.38, cy - s * 0.35], [cx - s * 0.16, cy + s * 0.28], [cx - s * 0.86, cy + s * 0.46]]), true);
    g.fillPoints(p([[cx + s * 1.28, cy], [cx + s * 0.38, cy - s * 0.35], [cx + s * 0.16, cy + s * 0.28], [cx + s * 0.86, cy + s * 0.46]]), true);
    g.fillStyle(shade(c, 0.95), 1);
    g.fillEllipse(cx, cy, s * 0.9, s * 1.18);
    g.fillStyle(shade(c, 1.35), 1);
    g.fillEllipse(cx - s * 0.18, cy - s * 0.22, s * 0.32, s * 0.24);
  } else if (key === 'boss') {
    drawGolem(g, cx, cy + s * 0.18, s, c, true);
    g.fillStyle(0x000000, 0.18);
    g.fillEllipse(cx, cy + s * 1.1, s * 2.55, s * 0.55);
  } else if (key === 'splitter') {
    drawSlime(g, cx - s * 0.42, cy + 1, s * 0.72, c);
    drawSlime(g, cx + s * 0.42, cy + 1, s * 0.72, shade(c, 1.1));
  } else {
    drawSlime(g, cx, cy, s, c, key !== 'mini');
  }
  g.generateTexture('enemy_' + key, d, d);
}

export function generateTextures(scene) {
  const g = scene.make.graphics({ x: 0, y: 0 }, false);

  // Fallback tower slot. The painted map already includes these platforms.
  g.clear();
  drawStoneBase(g, 60, 36, 1.45, 0xbeb58e);
  g.generateTexture('slot', 120, 72);

  for (const [key, e] of Object.entries(ELEMENTS)) {
    g.clear();
    drawTower(g, key, e);
  }

  for (const [key, t] of Object.entries(ENEMY_TYPES)) {
    g.clear();
    drawEnemy(g, key, t);
  }

  // Particles / projectiles
  g.clear();
  g.fillStyle(0xffffff, 1);
  g.fillCircle(6, 6, 6);
  g.generateTexture('spark', 12, 12);

  // Fire VFX uses dedicated silhouettes instead of tinting the generic round spark.
  // The layered warm values keep the shapes readable both with normal and ADD blending.
  g.clear();
  g.fillStyle(0x9f1c12, 0.92);
  g.fillPoints(p([[18, 0], [27, 15], [32, 27], [28, 43], [18, 54], [7, 45], [3, 31], [9, 18], [12, 7]]), true);
  g.fillStyle(0xff6a1f, 1);
  g.fillPoints(p([[18, 8], [25, 21], [25, 34], [18, 48], [10, 39], [10, 28], [15, 18]]), true);
  g.fillStyle(0xffd34e, 1);
  g.fillPoints(p([[18, 18], [22, 28], [20, 40], [15, 43], [13, 34], [16, 27]]), true);
  g.fillStyle(0xfff7c2, 0.96);
  g.fillPoints(p([[18, 26], [20, 32], [17, 39], [15, 34]]), true);
  g.generateTexture('fire_lick', 36, 56);

  g.clear();
  g.fillStyle(0xb52212, 0.88);
  g.fillTriangle(0, 12, 18, 1, 18, 23);
  g.fillEllipse(23, 12, 32, 24);
  g.fillStyle(0xff7a20, 1);
  g.fillTriangle(7, 12, 22, 5, 22, 19);
  g.fillEllipse(25, 12, 23, 17);
  g.fillStyle(0xffd54d, 1);
  g.fillEllipse(28, 12, 15, 11);
  g.fillStyle(0xfff8ce, 1);
  g.fillEllipse(31, 11, 8, 6);
  g.generateTexture('fire_orb', 40, 24);

  g.clear();
  g.fillStyle(0xf04418, 0.9);
  g.fillPoints(p([[5, 0], [10, 6], [7, 17], [3, 17], [0, 7]]), true);
  g.fillStyle(0xffc83d, 1);
  g.fillPoints(p([[5, 3], [8, 7], [6, 14], [3, 11]]), true);
  g.fillStyle(0xfff5b0, 0.92);
  g.fillTriangle(5, 5, 6, 9, 4, 10);
  g.generateTexture('fire_ember', 10, 18);

  g.clear();
  g.fillStyle(0xffffff, 0.18);
  g.fillCircle(17, 25, 14);
  g.fillCircle(29, 23, 15);
  g.fillCircle(24, 13, 13);
  g.fillStyle(0xffffff, 0.11);
  g.fillCircle(13, 16, 9);
  g.fillCircle(35, 17, 9);
  g.generateTexture('smoke_puff', 48, 48);

  g.clear();
  g.fillStyle(0x9fe8ff, 0.94);
  g.fillPoints(p([[9, 0], [16, 8], [12, 25], [9, 28], [6, 25], [2, 8]]), true);
  g.fillStyle(0xffffff, 0.68);
  g.fillPoints(p([[9, 3], [12, 9], [9, 23], [6, 9]]), true);
  g.lineStyle(1, 0x4fc3ff, 0.55);
  g.strokePoints(p([[9, 0], [16, 8], [12, 25], [9, 28], [6, 25], [2, 8]]), true, true);
  g.generateTexture('ice_shard', 18, 30);

  // Shatter gets its own angular silhouettes. The violet-blue back faces keep
  // these readable as physical fragments instead of the frost nova's motes.
  const makeShatterShard = (key, w, h) => {
    const cx = w * 0.5;
    g.clear();
    g.fillStyle(0x34408f, 0.98);
    g.fillPoints(p([[cx, 0], [w - 1, h * 0.3], [w * 0.7, h - 1], [cx, h * 0.82], [1, h * 0.42]]), true);
    g.fillStyle(0x36bfe8, 1);
    g.fillPoints(p([[cx, 1], [w * 0.72, h * 0.31], [cx, h * 0.8], [w * 0.18, h * 0.4]]), true);
    g.fillStyle(0xbdf6ff, 0.98);
    g.fillPoints(p([[cx, 2], [w * 0.57, h * 0.32], [cx, h * 0.72], [w * 0.3, h * 0.39]]), true);
    g.fillStyle(0xffffff, 0.94);
    g.fillTriangle(cx, 2, w * 0.54, h * 0.3, w * 0.39, h * 0.38);
    g.lineStyle(Math.max(1, Math.round(w * 0.06)), 0xe9fdff, 0.92);
    g.strokePoints(p([[cx, 0], [w - 1, h * 0.3], [w * 0.7, h - 1], [cx, h * 0.82], [1, h * 0.42]]), true, true);
    g.generateTexture(key, w, h);
  };
  makeShatterShard('shatter_shard_large', 24, 46);
  makeShatterShard('shatter_shard_medium', 18, 34);
  makeShatterShard('shatter_shard_small', 12, 23);

  g.clear();
  g.fillStyle(0x2f4d9b, 0.96);
  g.fillTriangle(1, 7, 6, 0, 9, 9);
  g.fillStyle(0x68dcff, 1);
  g.fillTriangle(2, 6, 6, 1, 6, 8);
  g.fillStyle(0xf1fdff, 0.96);
  g.fillTriangle(4, 5, 6, 1, 6, 6);
  g.generateTexture('shatter_chip', 10, 10);

  g.clear();
  g.lineStyle(2, 0xe8f8ff, 0.98);
  g.lineBetween(9, 1, 9, 17);
  g.lineBetween(2, 5, 16, 13);
  g.lineBetween(2, 13, 16, 5);
  g.lineStyle(1, 0x75d9ff, 0.9);
  g.lineBetween(9, 4, 6, 2);
  g.lineBetween(9, 4, 12, 2);
  g.lineBetween(9, 14, 6, 16);
  g.lineBetween(9, 14, 12, 16);
  g.lineBetween(5, 7, 3, 9);
  g.lineBetween(13, 11, 15, 9);
  g.lineBetween(5, 11, 3, 9);
  g.lineBetween(13, 7, 15, 9);
  g.fillStyle(0xffffff, 1);
  g.fillCircle(9, 9, 2);
  g.generateTexture('ice_mote', 18, 18);

  // A directional, faceted ice bolt. It points to the right so the projectile
  // can simply rotate toward its target at runtime.
  g.clear();
  g.fillStyle(0x2b8fc4, 0.32);
  g.fillPoints(p([[1, 10], [13, 3], [36, 5], [47, 10], [36, 15], [13, 17]]), true);
  g.fillStyle(0x73d9ff, 0.94);
  g.fillPoints(p([[4, 10], [17, 3], [38, 6], [47, 10], [38, 14], [17, 17]]), true);
  g.fillStyle(0xd8f7ff, 0.95);
  g.fillPoints(p([[10, 9], [20, 5], [39, 7], [47, 10], [25, 11]]), true);
  g.fillStyle(0xffffff, 0.92);
  g.fillPoints(p([[20, 6], [39, 8], [47, 10], [28, 10]]), true);
  g.fillStyle(0x3aaee4, 0.8);
  g.fillTriangle(8, 10, 1, 4, 18, 8);
  g.fillTriangle(10, 11, 2, 17, 21, 12);
  g.lineStyle(1, 0xe9fbff, 0.9);
  g.strokePoints(p([[4, 10], [17, 3], [38, 6], [47, 10], [38, 14], [17, 17]]), true, true);
  g.lineBetween(17, 3, 25, 11);
  g.lineBetween(25, 11, 38, 14);
  g.generateTexture('ice_bolt', 48, 20);

  g.clear();
  g.fillStyle(0x78dcff, 0.65);
  g.fillPoints(p([[5, 0], [8, 5], [5, 10], [2, 5]]), true);
  g.fillStyle(0xf3fdff, 0.95);
  g.fillPoints(p([[5, 1], [6, 5], [5, 8], [4, 5]]), true);
  g.generateTexture('ice_speck', 10, 10);

  g.clear();
  g.fillStyle(0xffffff, 1);
  g.fillCircle(8, 8, 8);
  g.fillStyle(0xffffff, 0.35);
  g.fillCircle(8, 8, 8);
  g.generateTexture('bullet', 16, 16);

  g.clear();
  for (let r = 32; r > 0; r -= 2) {
    g.fillStyle(0xffffff, 0.045);
    g.fillCircle(32, 32, r);
  }
  g.generateTexture('glow', 64, 64);

  g.clear();
  g.fillStyle(0x000000, 0.3);
  g.fillEllipse(24, 10, 48, 20);
  g.generateTexture('shadow', 48, 20);

  // Currency icons use a more beveled UI look to match runtime reference shots.
  g.clear();
  g.fillStyle(0x0c5277, 1);
  g.fillPoints(p([[12, 0], [24, 9], [12, 27], [0, 9]]), true);
  g.fillStyle(0x20b9ff, 1);
  g.fillPoints(p([[12, 0], [20, 9], [12, 14], [4, 9]]), true);
  g.fillStyle(0x8fe8ff, 1);
  g.fillPoints(p([[12, 0], [16, 9], [12, 27], [8, 9]]), true);
  g.fillStyle(0xffffff, 0.72);
  g.fillTriangle(7, 7, 12, 2, 10, 11);
  g.generateTexture('diamond', 24, 28);

  g.clear();
  g.fillStyle(0x9b5a05, 1);
  g.fillCircle(10, 11, 9);
  g.fillStyle(0xffbd2e, 1);
  g.fillCircle(10, 9, 9);
  g.fillStyle(0xffe58a, 1);
  g.fillCircle(7, 6, 3);
  g.lineStyle(2, 0xb66d05, 0.8);
  g.strokeCircle(10, 9, 6);
  g.generateTexture('coin', 20, 22);

  // Fallback base, used only when the painted map is missing.
  g.clear();
  g.fillStyle(0x000000, 0.22);
  g.fillEllipse(45, 98, 84, 24);
  drawStoneBase(g, 45, 84, 1.08, 0x2f93d1);
  g.fillStyle(0x315e86, 1);
  g.fillRoundedRect(18, 38, 54, 44, 6);
  g.fillStyle(0x4f8fc0, 1);
  g.fillRoundedRect(24, 30, 42, 44, 5);
  g.fillStyle(0x1d3c5d, 1);
  g.fillTriangle(18, 38, 45, 12, 72, 38);
  g.fillStyle(0x2d79b4, 1);
  g.fillTriangle(25, 35, 45, 18, 65, 35);
  drawCrystal(g, 45, 4, 50, 16, 0x7fd8ff);
  g.generateTexture('base', 90, 110);

  g.destroy();
}
import Phaser from 'phaser';
