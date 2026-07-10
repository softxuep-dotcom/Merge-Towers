import { W, H, ELEMENTS, offlineDiamonds } from '../config.js';
import { makeButton, toast, openShop } from '../ui.js';
import { writeSave } from '../save.js';
import { Sfx } from '../audio.js';
import { Poki } from '../poki.js';
import { addTowerImage, fitTowerImageHeight } from '../textures.js';

export class MenuScene extends Phaser.Scene {
  constructor() { super('Menu'); }

  create() {
    const S = this.registry.get('save');
    this.add.rectangle(W / 2, H / 2, W, H, 0x1a1d2e);
    // 背景装饰塔
    const elems = Object.keys(ELEMENTS);
    for (let i = 0; i < 5; i++) {
      const img = fitTowerImageHeight(addTowerImage(this, 90 + i * 135, 900, elems[i]), 117).setAlpha(0.9);
      this.tweens.add({ targets: img, y: 890, duration: 1200 + i * 150, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    }

    this.add.text(W / 2, 300, 'MERGE\nTOWERS', {
      fontFamily: 'Arial Black, sans-serif', fontSize: '88px', color: '#ffe97a',
      align: 'center', stroke: '#5a3fa8', strokeThickness: 10,
    }).setOrigin(0.5);
    this.add.text(W / 2, 440, '合 成 塔 防', {
      fontFamily: 'Arial, "Microsoft YaHei", sans-serif', fontSize: '38px', color: '#c9d2f0', fontStyle: 'bold',
    }).setOrigin(0.5);

    if (S.best > 0) {
      this.add.text(W / 2, 540, `🏆 最高纪录：第 ${S.best} 波`, {
        fontFamily: 'Arial, "Microsoft YaHei", sans-serif', fontSize: '28px', color: '#9fe8ff', fontStyle: 'bold',
      }).setOrigin(0.5);
    }
    this.dText = this.add.text(W / 2, 600, `💎 ${S.diamonds}`, {
      fontFamily: 'Arial, "Microsoft YaHei", sans-serif', fontSize: '28px', color: '#9fe8ff', fontStyle: 'bold',
    }).setOrigin(0.5);

    makeButton(this, W / 2, 720, 420, 110, '⚔ 开始游戏', {
      bg: 0x2e6b4f, stroke: 0x59c98f, fontSize: 38,
      onClick: () => this.scene.start('Game'),
    });
    makeButton(this, W / 2, 860, 420, 90, '⚒ 强化工坊', {
      bg: 0x6b5a2e, stroke: 0xd8b74f, fontSize: 30,
      onClick: () => openShop(this, S, () => this.dText.setText(`💎 ${S.diamonds}`)),
    });

    this.checkOfflineChest(S);
  }

  checkOfflineChest(S) {
    if (S.lastSeen <= 0) return;
    const hours = (Date.now() - S.lastSeen) / 3600000;
    const d = offlineDiamonds(S.best, hours);
    S.lastSeen = Date.now();
    writeSave(S);
    if (d < 1) return;

    // 离线宝箱（GDD §5.1）
    const layer = this.add.container(0, 0).setDepth(6000);
    layer.add(this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.75).setInteractive());
    layer.add(this.add.rectangle(W / 2, 600, 560, 470, 0x1e2233).setStrokeStyle(3, 0x4a5578));
    layer.add(this.add.text(W / 2, 430, '🎁 离线宝箱', {
      fontFamily: 'Arial, "Microsoft YaHei", sans-serif', fontSize: '42px', color: '#ffe97a', fontStyle: 'bold',
    }).setOrigin(0.5));
    layer.add(this.add.text(W / 2, 510, `你不在时基地攒下了\n💎 ${d} 钻石 + 开局金币券(+50%)`, {
      fontFamily: 'Arial, "Microsoft YaHei", sans-serif', fontSize: '26px', color: '#c9d2f0', align: 'center',
    }).setOrigin(0.5));

    const claim = (mult) => {
      S.diamonds += d * mult;
      S.coupon = true;
      writeSave(S);
      Sfx.diamond();
      this.dText.setText(`💎 ${S.diamonds}`);
      toast(this, W / 2, 560, `+${d * mult}💎`, '#9fe8ff', 36);
      layer.destroy();
    };
    layer.add(makeButton(this, W / 2, 630, 420, 78, `📺 双倍领取 (+${d * 2}💎)`, {
      bg: 0x6b4a86, stroke: 0xb07fe0, fontSize: 26,
      onClick: async () => { if (await Poki.rewardedBreak()) claim(2); },
    }));
    layer.add(makeButton(this, W / 2, 730, 420, 70, `直接领取 (+${d}💎)`, {
      bg: 0x51586e, fontSize: 24,
      onClick: () => claim(1),
    }));
  }
}
