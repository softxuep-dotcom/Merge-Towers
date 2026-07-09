import { createEnemyAnimations, generateTextures, PAINTED_ENEMY_ATLAS } from '../textures.js';
import { loadSave } from '../save.js';
import { setMuted } from '../audio.js';
import { Poki } from '../poki.js';

export class BootScene extends Phaser.Scene {
  constructor() { super('Boot'); }

  preload() {
    // 森林背景图（可选资源：缺失时回退程序化绘制）
    this.load.image('map_bg', 'assets/maps/forest-grid-bg.png');
    this.load.atlas(PAINTED_ENEMY_ATLAS, 'assets/enemies/enemies-front-left-v1.png', 'assets/enemies/enemies-front-left-v1.json');
  }

  create() {
    generateTextures(this);
    createEnemyAnimations(this);
    const save = loadSave();
    setMuted(save.muted);
    this.registry.set('save', save);
    Poki.init().then(() => Poki.gameLoadingFinished());
    // 首次进入直接开局（GDD §1：秒进游戏）；老玩家进菜单（有离线宝箱/强化）
    this.scene.start(save.runs === 0 ? 'Game' : 'Menu');
  }
}
