import {
  createEnemyAnimations,
  generateTextures,
  PAINTED_ENEMY_KEYS,
  paintedEnemyAtlasImage,
  paintedEnemyAtlasJson,
  paintedEnemyAtlasKey,
} from '../textures.js';
import { loadSave } from '../save.js';
import { setMuted } from '../audio.js';
import { Poki } from '../poki.js';

export class BootScene extends Phaser.Scene {
  constructor() { super('Boot'); }

  preload() {
    // 森林背景图（可选资源：缺失时回退程序化绘制）
    this.load.image('map_bg', 'assets/maps/forest-grid-bg.png');
    for (const key of PAINTED_ENEMY_KEYS) {
      this.load.atlas(paintedEnemyAtlasKey(key), paintedEnemyAtlasImage(key), paintedEnemyAtlasJson(key));
    }
  }

  create() {
    generateTextures(this);
    createEnemyAnimations(this);
    const save = loadSave();
    setMuted(save.muted);
    this.registry.set('save', save);
    Poki.init().then(() => Poki.gameLoadingFinished());
    const isEditor = new URLSearchParams(window.location.search).has('editor');
    // 编辑模式必须进入 GameScene 才会挂载 pathEditor。
    this.scene.start(isEditor || save.runs === 0 ? 'Game' : 'Menu');
  }
}
