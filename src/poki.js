// Poki SDK 包装层：SDK 存在时走真实调用，否则 no-op（本地开发）
const sdk = () => (typeof window !== 'undefined' && window.PokiSDK) ? window.PokiSDK : null;

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
  async commercialBreak() {
    const s = sdk();
    if (!s) return;
    try { await s.commercialBreak(); } catch (e) {}
  },
  // 激励视频：返回 true=看完发奖励。本地开发始终返回 true 便于测试。
  async rewardedBreak() {
    const s = sdk();
    if (!s) return true;
    try { return await s.rewardedBreak(); } catch (e) { return false; }
  },
};
