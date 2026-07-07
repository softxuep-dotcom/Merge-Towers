import { W, H } from './config.js';
import { BootScene } from './scenes/BootScene.js';
import { MenuScene } from './scenes/MenuScene.js';
import { GameScene } from './scenes/GameScene.js';
import { ResultScene } from './scenes/ResultScene.js';
import { writeSave } from './save.js';
import { isMuted } from './audio.js';

const game = window.__game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: W,
  height: H,
  backgroundColor: '#12131f',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [BootScene, MenuScene, GameScene, ResultScene],
});

// 离开页面时记录离线时间戳（离线钻石结算依据）
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    const s = game.registry.get('save');
    if (s) {
      s.lastSeen = Date.now();
      s.muted = isMuted();
      writeSave(s);
    }
  }
});
