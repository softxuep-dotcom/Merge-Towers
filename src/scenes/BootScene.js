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
import { preloadVfxAssets, warmupVfxShaders } from '../vfx/VfxRuntime.js';

export class BootScene extends Phaser.Scene {
  constructor() { super('Boot'); }

  preload() {
    this.load.on('progress', (value) => window.setLoadingProgress?.(value));
    preloadVfxAssets(this);
    // 森林背景图（可选资源：缺失时回退程序化绘制）
    this.load.image('map_bg', 'assets/maps/forest-grid-bg.png');
    this.load.spritesheet('vfx_frost_nova_seq', 'assets/vfx/frost-nova-seq.webp', { frameWidth: 320, frameHeight: 320 });
    this.load.glsl('upgrade_rift', 'assets/shaders/upgrade-rift.glsl');
    this.load.atlas('ui_icons', 'assets/ui/ui-icons-v1.webp', 'assets/ui/ui-icons-v1.json');
    this.load.atlas('ui_components', 'assets/ui/ui-components-v1.webp', 'assets/ui/ui-components-v1.json');
    this.load.atlas(PAINTED_TOWER_ATLAS, PAINTED_TOWER_ATLAS_IMAGE, PAINTED_TOWER_ATLAS_JSON);
    for (const key of PAINTED_ENEMY_KEYS) {
      this.load.atlas(paintedEnemyAtlasKey(key), paintedEnemyAtlasImage(key), paintedEnemyAtlasJson(key));
    }
  }

  create() {
    generateTextures(this);
    warmupVfxShaders(this);
    createEnemyAnimations(this);
    const save = loadSave();
    setMuted(save.muted);
    this.registry.set('save', save);
    // Poki 只会在 SDK 初始化完成后记录 gameplayStart；先完成加载上报，再进入玩法场景。
    Poki.init().then(async () => {
      Poki.gameLoadingFinished();
      window.finishLoading?.();
      // 给 Inspector 一帧处理加载完成事件；?skilltest 可直达技能测试场景。
      await new Promise(resolve => window.requestAnimationFrame(resolve));
      const skillTest = new URLSearchParams(window.location.search).has('skilltest');
      this.scene.start(skillTest ? 'SkillTest' : 'Menu');
    });
  }
}
import Phaser from 'phaser';
