// Poki SDK 包装层：SDK 存在时走真实调用，否则 no-op（本地开发）
import { setAudioPaused } from './audio.js';

const sdk = () => (typeof window !== 'undefined' && window.PokiSDK) ? window.PokiSDK : null;

let adBreakDepth = 0;
let inputSnapshot = null;

function setInputPaused(paused) {
  const game = typeof window !== 'undefined' ? window.__game : null;

  if (paused) {
    adBreakDepth += 1;
    if (adBreakDepth !== 1 || !game) return;
    inputSnapshot = {
      global: game.input ? { target: game.input, enabled: game.input.enabled } : null,
      scenes: game.scene.getScenes(true).map(scene => ({
        input: scene.input || null,
        inputEnabled: scene.input?.enabled,
        keyboard: scene.input?.keyboard || null,
        keyboardEnabled: scene.input?.keyboard?.enabled,
      })),
    };
    if (game.input) game.input.enabled = false;
    for (const scene of inputSnapshot.scenes) {
      if (scene.input) scene.input.enabled = false;
      if (scene.keyboard) scene.keyboard.enabled = false;
    }
    return;
  }

  if (adBreakDepth === 0) return;
  adBreakDepth -= 1;
  if (adBreakDepth !== 0 || !inputSnapshot) return;
  if (inputSnapshot.global) inputSnapshot.global.target.enabled = inputSnapshot.global.enabled;
  for (const scene of inputSnapshot.scenes) {
    if (scene.input) scene.input.enabled = scene.inputEnabled;
    if (scene.keyboard) scene.keyboard.enabled = scene.keyboardEnabled;
  }
  inputSnapshot = null;
}

export const Poki = {
  async init() {
    const s = sdk();
    if (!s) return;
    try { await s.init(); } catch (e) { /* adblock 等场景静默 */ }
  },
  gameLoadingFinished() { sdk()?.gameLoadingFinished?.(); },
  gameplayStart() { sdk()?.gameplayStart?.(); },
  gameplayStop()  { sdk()?.gameplayStop?.(); },
  // 插屏广告：resolve 后继续游戏
  async commercialBreak({ maxWaitMs = 0 } = {}) {
    const s = sdk();
    if (!s) return;
    setAudioPaused(true, 'poki');
    setInputPaused(true);
    try {
      const ad = Promise.resolve().then(() => s.commercialBreak()).catch(() => {});
      if (maxWaitMs > 0) {
        await Promise.race([
          ad,
          new Promise(resolve => window.setTimeout(resolve, maxWaitMs)),
        ]);
      } else {
        await ad;
      }
    } catch (e) {}
    finally {
      setInputPaused(false);
      setAudioPaused(adBreakDepth > 0, 'poki');
    }
  },
  // 激励视频：返回 true=看完发奖励。本地开发始终返回 true 便于测试。
  async rewardedBreak() {
    const s = sdk();
    if (!s) return true;
    setAudioPaused(true, 'poki');
    setInputPaused(true);
    try { return await s.rewardedBreak(); } catch (e) { return false; }
    finally {
      setInputPaused(false);
      setAudioPaused(adBreakDepth > 0, 'poki');
    }
  },
};
