import Phaser from 'phaser';
import { W, H } from './config.js';
import { BootScene } from './scenes/BootScene.js';
import { MenuScene } from './scenes/MenuScene.js';
import { GameScene } from './scenes/GameScene.js';
import { ResultScene } from './scenes/ResultScene.js';
import { touchSave } from './save.js';
import { isMuted } from './audio.js';

const game = window.__game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: W,
  height: H,
  backgroundColor: '#12131f',
  scale: {
    mode: Phaser.Scale.EXPAND,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [BootScene, MenuScene, GameScene, ResultScene],
});

// Poki embeds the game in a scrollable page; gameplay keys must not scroll the host page.
const scrollKeys = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' ']);
window.addEventListener('keydown', event => {
  if (scrollKeys.has(event.key)) event.preventDefault();
}, { passive: false });

// 离开页面时记录离线时间戳（离线钻石结算依据）
function persistSessionExit() {
  const s = game.registry.get('save');
  if (s) touchSave(s, { muted: isMuted() });
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden) persistSessionExit();
});
window.addEventListener('pagehide', persistSessionExit);
window.addEventListener('beforeunload', persistSessionExit);
