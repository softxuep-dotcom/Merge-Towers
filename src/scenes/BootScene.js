import {
  createEnemyAnimations,
  generateTextures,
  PAINTED_ENEMY_KEYS,
  PAINTED_TOWER_ATLAS,
  PAINTED_TOWER_ATLAS_IMAGE,
  PAINTED_TOWER_ATLAS_JSON,
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
    this.load.on('progress', (value) => window.setLoadingProgress?.(value));
    // 森林背景图（可选资源：缺失时回退程序化绘制）
    this.load.image('map_bg', 'assets/maps/forest-grid-bg.png');
    this.load.spritesheet('vfx_frost_nova_seq', 'assets/vfx/frost-nova-seq.webp', { frameWidth: 320, frameHeight: 320 });
    this.load.atlas('ui_icons', 'assets/ui/ui-icons-v1.webp', 'assets/ui/ui-icons-v1.json');
    this.load.atlas('ui_components', 'assets/ui/ui-components-v1.webp', 'assets/ui/ui-components-v1.json');
    this.load.atlas(PAINTED_TOWER_ATLAS, PAINTED_TOWER_ATLAS_IMAGE, PAINTED_TOWER_ATLAS_JSON);
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
    this.scene.start(isEditor ? 'Game' : 'Menu');
    window.finishLoading?.();
  }
}
import Phaser from 'phaser';
