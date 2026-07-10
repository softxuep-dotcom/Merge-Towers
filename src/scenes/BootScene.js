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
    // 森林背景图（可选资源：缺失时回退程序化绘制）
    this.load.image('map_bg', 'assets/maps/forest-grid-bg.png');
    this.load.image('vfx_frost_nova', 'assets/vfx/frost-nova-game.png');
    this.load.image('vfx_burning_ground', 'assets/vfx/burning-ground-game.png');
    this.load.spritesheet('vfx_fire_burst_seq', 'assets/vfx/fire-burst-seq.png', { frameWidth: 256, frameHeight: 256 });
    this.load.spritesheet('vfx_burn_loop_seq', 'assets/vfx/burn-loop-seq.png', { frameWidth: 256, frameHeight: 256 });
    this.load.spritesheet('vfx_frost_nova_seq', 'assets/vfx/frost-nova-seq.png', { frameWidth: 320, frameHeight: 320 });
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
    this.scene.start(isEditor || save.runs === 0 ? 'Game' : 'Menu');
  }
}
