import { W, H } from '../config.js';
import { makeButton, openShop } from '../ui.js';

export class ResultScene extends Phaser.Scene {
  constructor() { super('Result'); }

  init(data) { this.data_ = data; }

  create() {
    const S = this.registry.get('save');
    const d = this.data_;
    this.add.rectangle(W / 2, H / 2, W, H, 0x1a1d2e);
    this.add.rectangle(W / 2, 520, 580, 620, 0x1e2233).setStrokeStyle(3, 0x4a5578);

    this.add.text(W / 2, 300, d.newBest ? '🏆 新纪录!' : '⚔ 战斗结束', {
      fontFamily: 'Arial, "Microsoft YaHei", sans-serif', fontSize: '52px',
      color: d.newBest ? '#ffe97a' : '#c9d2f0', fontStyle: 'bold',
    }).setOrigin(0.5);

    this.add.text(W / 2, 410, `坚守到  第 ${d.wave} 波`, {
      fontFamily: 'Arial, "Microsoft YaHei", sans-serif', fontSize: '40px', color: '#ffffff', fontStyle: 'bold',
    }).setOrigin(0.5);

    const lines = [
      `击杀敌人：${d.kills}`,
      `历史最高：第 ${S.best} 波`,
      ``,
      `💎 本局获得：${d.dRun}（含阵亡补偿 ${d.deathBonus}）`,
      `💎 当前持有：${S.diamonds}`,
    ];
    this.add.text(W / 2, 560, lines.join('\n'), {
      fontFamily: 'Arial, "Microsoft YaHei", sans-serif', fontSize: '27px', color: '#c9d2f0',
      align: 'center', lineSpacing: 12,
    }).setOrigin(0.5);

    // 引导去强化：钻石够买任何一档时高亮提示
    this.add.text(W / 2, 720, '💡 去强化工坊变强，下局走得更远', {
      fontFamily: 'Arial, "Microsoft YaHei", sans-serif', fontSize: '22px', color: '#8f9ab8',
    }).setOrigin(0.5);

    makeButton(this, W / 2, 880, 440, 104, '🔁 再来一局', {
      bg: 0x2e6b4f, stroke: 0x59c98f, fontSize: 36,
      onClick: () => this.scene.start('Game'),
    });
    makeButton(this, W / 2, 1000, 440, 84, '⚒ 强化工坊', {
      bg: 0x6b5a2e, stroke: 0xd8b74f, fontSize: 28,
      onClick: () => openShop(this, S),
    });
    makeButton(this, W / 2, 1104, 440, 72, '主菜单', {
      bg: 0x51586e, fontSize: 24,
      onClick: () => this.scene.start('Menu'),
    });
  }
}
