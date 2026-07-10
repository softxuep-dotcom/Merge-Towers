// 开发工具：点击式路径编辑器
// 用法：URL 加 ?editor=1 进入 → 在地图上点击加路径点（所见即所得，含平滑预览）
// → [导出] 把 PATH_PTS / FLY_PTS 代码打印到控制台并复制到剪贴板，粘回 GameScene.js 即可。
// 发布版无入口（仅 query 参数触发），保留无害；Poki 提审前可整体删除本文件与调用处。
import { W } from '../config.js';
import { makeButton } from '../ui.js';

export function startPathEditor(scene) {
  scene.editorMode = true;
  if (scene.prepTimer) scene.prepTimer.remove();
  if (scene.spawnEvent) scene.spawnEvent.remove();
  // 清场：编辑器只留地图
  for (const e of [...scene.enemies]) { e.dead = true; e.destroy(); }
  scene.enemies = [];
  for (const t of [...scene.towers]) { t.slot.tower = null; t.destroy(); }
  scene.towers = [];
  scene.clearHint?.();
  // 隐藏游戏 UI 防误触
  for (const k of ['buyBtn', 'giftBtn', 'speedBtn', 'callBtn', 'sellZone', 'sellText', 'previewText']) {
    scene[k]?.setVisible?.(false);
    scene[k]?.disableInteractive?.();
  }

  const state = { mode: 'ground', ground: [], fly: [] };
  const gfx = scene.add.graphics().setDepth(4000);
  const label = scene.add.text(W / 2, 80, '', {
    fontFamily: 'Arial, "Microsoft YaHei", sans-serif', fontSize: '24px',
    color: '#ffe97a', fontStyle: 'bold', stroke: '#000000', strokeThickness: 5,
  }).setOrigin(0.5).setDepth(4001);

  const drawSet = (pts, color) => {
    if (pts.length >= 3) {
      // 与运行时 Path 相同的 Catmull-Rom 平滑预览
      const spline = new Phaser.Curves.Spline(pts.flatMap(p => [p.x, p.y]));
      const dense = spline.getSpacedPoints(Math.max(32, Math.round(spline.getLength() / 10)));
      gfx.lineStyle(4, color, 0.9);
      gfx.strokePoints(dense, false);
    } else if (pts.length === 2) {
      gfx.lineStyle(4, color, 0.9);
      gfx.lineBetween(pts[0].x, pts[0].y, pts[1].x, pts[1].y);
    }
    pts.forEach((p, i) => {
      gfx.fillStyle(color, 1);
      gfx.fillCircle(p.x, p.y, 7);
      gfx.lineStyle(2, 0x000000, 0.8);
      gfx.strokeCircle(p.x, p.y, 7);
    });
  };

  const redraw = () => {
    gfx.clear();
    drawSet(state.ground, 0xff00ff);
    drawSet(state.fly, 0x00ffff);
    label.setText(`路径编辑 · ${state.mode === 'ground' ? '地面(品红)' : '飞行(青)'} · 已 ${state[state.mode].length} 点 · 点地图加点`);
  };

  scene.input.on('pointerdown', (pointer, objects) => {
    if (!scene.editorMode || (objects && objects.length)) return; // 点到按钮不加点
    state[state.mode].push({ x: Math.round(pointer.worldX ?? pointer.x), y: Math.round(pointer.worldY ?? pointer.y) });
    redraw();
  });

  const mkBtn = (x, text, onClick) => makeButton(scene, x, 1235, 155, 58, text, { fontSize: 20, onClick }).setDepth(4001);
  const modeBtn = mkBtn(95, '模式:地面', () => {
    state.mode = state.mode === 'ground' ? 'fly' : 'ground';
    modeBtn.label.setText(state.mode === 'ground' ? '模式:地面' : '模式:飞行');
    redraw();
  });
  mkBtn(265, '撤销', () => { state[state.mode].pop(); redraw(); });
  mkBtn(435, '清空', () => { state[state.mode] = []; redraw(); });
  mkBtn(605, '导出', () => {
    const fmt = pts => '[\n  ' + pts.map(p => `{ x: ${p.x}, y: ${p.y} }`).join(', ') + '\n]';
    const code = `const PATH_PTS = ${fmt(state.ground)};\nconst FLY_PTS = ${fmt(state.fly)};`;
    console.log('===== 路径导出 =====\n' + code);
    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(code).catch(() => {});
    label.setText('已导出：控制台 + 剪贴板');
  });

  redraw();
  return state;
}
