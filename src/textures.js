// 程序化生成全部贴图：伪 2.5D 风格，零图片资源
import { ELEMENTS, ENEMY_TYPES } from './config.js';

function shade(color, f) {
  const c = Phaser.Display.Color.IntegerToColor(color);
  const r = Math.min(255, Math.round(c.red * f)), g = Math.min(255, Math.round(c.green * f)), b = Math.min(255, Math.round(c.blue * f));
  return Phaser.Display.Color.GetColor(r, g, b);
}

export function generateTextures(scene) {
  const g = scene.make.graphics({ x: 0, y: 0 }, false);

  // ---- 塔位：等距菱形砖（2.5D 感的核心元素）----
  g.clear();
  g.fillStyle(0x000000, 0.25);
  g.fillPoints([{ x: 60, y: 12 }, { x: 116, y: 40 }, { x: 60, y: 68 }, { x: 4, y: 40 }], true); // 底影
  g.fillStyle(0x51586e, 1);
  g.fillPoints([{ x: 60, y: 6 }, { x: 116, y: 34 }, { x: 60, y: 62 }, { x: 4, y: 34 }], true);
  g.fillStyle(0x6b7590, 1);
  g.fillPoints([{ x: 60, y: 2 }, { x: 112, y: 28 }, { x: 60, y: 54 }, { x: 8, y: 28 }], true);
  g.lineStyle(2, 0x8b95b5, 0.6);
  g.strokePoints([{ x: 60, y: 2 }, { x: 112, y: 28 }, { x: 60, y: 54 }, { x: 8, y: 28 }], true, true);
  g.generateTexture('slot', 120, 72);

  // ---- 各元素塔身：宝石水晶造型，左亮右暗做立体 ----
  for (const [key, e] of Object.entries(ELEMENTS)) {
    g.clear();
    const c = e.color;
    // 底座
    g.fillStyle(0x2b2f40, 1);
    g.fillPoints([{ x: 36, y: 62 }, { x: 62, y: 74 }, { x: 36, y: 86 }, { x: 10, y: 74 }], true);
    g.fillStyle(0x3d4358, 1);
    g.fillPoints([{ x: 36, y: 58 }, { x: 60, y: 70 }, { x: 36, y: 82 }, { x: 12, y: 70 }], true);
    // 水晶左面（亮）
    g.fillStyle(shade(c, 1.15), 1);
    g.fillPoints([{ x: 36, y: 6 }, { x: 36, y: 70 }, { x: 14, y: 56 }, { x: 20, y: 24 }], true);
    // 水晶右面（暗）
    g.fillStyle(shade(c, 0.62), 1);
    g.fillPoints([{ x: 36, y: 6 }, { x: 36, y: 70 }, { x: 58, y: 56 }, { x: 52, y: 24 }], true);
    // 高光
    g.fillStyle(0xffffff, 0.5);
    g.fillPoints([{ x: 32, y: 14 }, { x: 34, y: 40 }, { x: 26, y: 34 }, { x: 27, y: 20 }], true);
    g.generateTexture('tower_' + key, 72, 90);
  }

  // ---- 敌人 ----
  for (const [key, t] of Object.entries(ENEMY_TYPES)) {
    g.clear();
    const s = t.size, c = t.color, cx = s + 4, cy = s + 4, D = (s + 4) * 2;
    if (key === 'tank') {
      g.fillStyle(shade(c, 0.5), 1); g.fillRoundedRect(cx - s, cy - s * 0.7 + 4, s * 2, s * 1.5, 6);
      g.fillStyle(c, 1); g.fillRoundedRect(cx - s, cy - s * 0.85, s * 2, s * 1.5, 6);
      g.fillStyle(shade(c, 1.3), 1); g.fillRoundedRect(cx - s + 4, cy - s * 0.85 + 4, s * 2 - 8, s * 0.5, 4);
    } else if (key === 'runner') {
      g.fillStyle(shade(c, 0.55), 1); g.fillTriangle(cx - s, cy + s * 0.75, cx + s, cy + 4, cx - s, cy - s * 0.55);
      g.fillStyle(c, 1); g.fillTriangle(cx - s, cy + s * 0.6, cx + s, cy, cx - s, cy - s * 0.6);
    } else if (key === 'flyer') {
      g.fillStyle(c, 0.5); g.fillEllipse(cx - s * 0.8, cy, s * 1.1, s * 0.5); g.fillEllipse(cx + s * 0.8, cy, s * 1.1, s * 0.5);
      g.fillStyle(c, 1); g.fillEllipse(cx, cy, s * 1.1, s * 0.9);
      g.fillStyle(shade(c, 1.35), 1); g.fillEllipse(cx - 3, cy - 3, s * 0.55, s * 0.4);
    } else if (key === 'boss') {
      g.fillStyle(shade(c, 0.5), 1); g.fillCircle(cx, cy + 5, s);
      // 尖刺
      for (let i = 0; i < 8; i++) {
        const a = i / 8 * Math.PI * 2;
        g.fillStyle(shade(c, 0.8), 1);
        g.fillTriangle(cx + Math.cos(a) * s * 0.8, cy + Math.sin(a) * s * 0.8,
          cx + Math.cos(a + 0.3) * s * 0.7, cy + Math.sin(a + 0.3) * s * 0.7,
          cx + Math.cos(a + 0.15) * s * 1.18, cy + Math.sin(a + 0.15) * s * 1.18);
      }
      g.fillStyle(c, 1); g.fillCircle(cx, cy, s * 0.85);
      g.fillStyle(shade(c, 1.4), 1); g.fillCircle(cx - s * 0.22, cy - s * 0.22, s * 0.4);
      g.fillStyle(0x1a0a10, 1); g.fillCircle(cx - s * 0.25, cy - s * 0.1, 5); g.fillCircle(cx + s * 0.25, cy - s * 0.1, 5);
    } else if (key === 'splitter') {
      g.fillStyle(shade(c, 0.55), 1); g.fillCircle(cx - s * 0.42, cy + 4, s * 0.72); g.fillCircle(cx + s * 0.42, cy + 4, s * 0.72);
      g.fillStyle(c, 1); g.fillCircle(cx - s * 0.4, cy, s * 0.7); g.fillCircle(cx + s * 0.4, cy, s * 0.7);
      g.fillStyle(shade(c, 1.35), 1); g.fillCircle(cx - s * 0.55, cy - s * 0.2, s * 0.28); g.fillCircle(cx + s * 0.25, cy - s * 0.2, s * 0.28);
    } else { // slime / mini
      g.fillStyle(shade(c, 0.55), 1); g.fillEllipse(cx, cy + s * 0.35, s * 2, s * 1.2);
      g.fillStyle(c, 1); g.fillEllipse(cx, cy, s * 1.9, s * 1.6);
      g.fillStyle(shade(c, 1.35), 1); g.fillEllipse(cx - s * 0.3, cy - s * 0.35, s * 0.7, s * 0.5);
      g.fillStyle(0x241a38, 1); g.fillCircle(cx - s * 0.3, cy, 3.5); g.fillCircle(cx + s * 0.3, cy, 3.5);
    }
    g.generateTexture('enemy_' + key, D, D);
  }

  // ---- 通用粒子 / 弹道 ----
  g.clear(); g.fillStyle(0xffffff, 1); g.fillCircle(6, 6, 6); g.generateTexture('spark', 12, 12);
  g.clear(); g.fillStyle(0xffffff, 1); g.fillCircle(8, 8, 8);
  g.fillStyle(0xffffff, 0.4); g.fillCircle(8, 8, 8); g.generateTexture('bullet', 16, 16);
  g.clear();
  for (let r = 32; r > 0; r -= 2) { g.fillStyle(0xffffff, 0.045); g.fillCircle(32, 32, r); }
  g.generateTexture('glow', 64, 64);
  // 阴影
  g.clear(); g.fillStyle(0x000000, 0.3); g.fillEllipse(24, 10, 48, 20); g.generateTexture('shadow', 48, 20);
  // 钻石
  g.clear();
  g.fillStyle(0x7fd8ff, 1); g.fillPoints([{ x: 12, y: 0 }, { x: 24, y: 9 }, { x: 12, y: 26 }, { x: 0, y: 9 }], true);
  g.fillStyle(0xc9efff, 1); g.fillPoints([{ x: 12, y: 0 }, { x: 17, y: 9 }, { x: 12, y: 26 }, { x: 7, y: 9 }], true);
  g.generateTexture('diamond', 24, 26);
  // 金币
  g.clear(); g.fillStyle(0xc9930a, 1); g.fillCircle(9, 10, 8); g.fillStyle(0xffd34e, 1); g.fillCircle(9, 8, 8);
  g.fillStyle(0xffeeaa, 1); g.fillCircle(6.5, 5.5, 3); g.generateTexture('coin', 18, 20);
  // 基地水晶塔
  g.clear();
  g.fillStyle(0x2b2f40, 1); g.fillEllipse(45, 96, 84, 26);
  g.fillStyle(0x8b6cd9, 1); g.fillPoints([{ x: 45, y: 4 }, { x: 45, y: 92 }, { x: 16, y: 74 }, { x: 24, y: 30 }], true);
  g.fillStyle(0x5a3fa8, 1); g.fillPoints([{ x: 45, y: 4 }, { x: 45, y: 92 }, { x: 74, y: 74 }, { x: 66, y: 30 }], true);
  g.fillStyle(0xffffff, 0.45); g.fillPoints([{ x: 40, y: 16 }, { x: 42, y: 50 }, { x: 32, y: 44 }, { x: 34, y: 26 }], true);
  g.generateTexture('base', 90, 108);

  g.destroy();
}
