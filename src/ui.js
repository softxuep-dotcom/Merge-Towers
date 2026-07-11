// 通用 UI 组件
import { UPGRADES, DIAMOND, DEFAULT_DIFFICULTY, DIFFICULTIES } from './config.js';
import { tier, writeSave } from './save.js';
import { Sfx, unlockAudio } from './audio.js';
import { Poki } from './poki.js';
import { t } from './i18n.js';

export function makeButton(scene, x, y, w, h, label, opts = {}) {
  const bgColor = opts.bg ?? 0x3b4568;
  const bg = scene.add.rectangle(0, 0, w, h, bgColor, 1).setStrokeStyle(2, opts.stroke ?? 0x6b7ba8);
  // 手动圆角观感：叠一条高光
  const hi = scene.add.rectangle(0, -h / 2 + 3, w - 8, 4, 0xffffff, 0.12);
  const txt = scene.add.text(0, 0, label, {
    fontFamily: 'Arial, "Microsoft YaHei", sans-serif',
    fontSize: (opts.fontSize ?? 26) + 'px',
    color: opts.color ?? '#ffffff',
    fontStyle: 'bold',
    align: 'center',
  }).setOrigin(0.5);
  const c = scene.add.container(x, y, [bg, hi, txt]);
  c.setSize(w, h).setInteractive({ useHandCursor: true });
  c.bg = bg; c.label = txt;
  c.on('pointerover', () => bg.setFillStyle(Phaser.Display.Color.IntegerToColor(bgColor).brighten(12).color));
  c.on('pointerout', () => bg.setFillStyle(bgColor));
  c.on('pointerdown', () => {
    unlockAudio();
    scene.tweens.add({ targets: c, scale: 0.94, duration: 50, yoyo: true });
    if (opts.onClick) opts.onClick();
  });
  c.setEnabled = (on) => {
    c.disableInteractive();
    if (on) c.setInteractive({ useHandCursor: true });
    c.setAlpha(on ? 1 : 0.45);
  };
  return c;
}

export function makeDifficultySelector(scene, y, selectedKey = DEFAULT_DIFFICULTY, onChange = null, opts = {}) {
  const keys = ['easy', 'normal', 'hard'];
  let current = DIFFICULTIES[selectedKey] ? selectedKey : DEFAULT_DIFFICULTY;
  const centerX = opts.centerX ?? 360;
  const gap = opts.gap ?? 150;
  const buttonW = opts.buttonW ?? 132;
  const buttonH = opts.buttonH ?? 54;
  const fontSize = opts.fontSize ?? 21;
  const title = scene.add.text(centerX, y - buttonH / 2 - 28, '', {
    fontFamily: 'Arial, "Microsoft YaHei", sans-serif', fontSize: (opts.titleSize ?? 22) + 'px',
    color: '#c9d2f0', fontStyle: 'bold',
  }).setOrigin(0.5);
  const buttons = {};

  const refresh = () => {
    const selected = DIFFICULTIES[current];
    title.setText(t('difficulty.title', { name: selected.cn, hp: selected.hpBase }));
    keys.forEach(key => {
      const active = key === current;
      const def = DIFFICULTIES[key];
      buttons[key].label.setText(`${active ? '✓ ' : ''}${def.cn}`);
      buttons[key].bg.setStrokeStyle(active ? 4 : 2, active ? def.color : 0x6b7ba8, active ? 1 : 0.75);
      buttons[key].setAlpha(active ? 1 : 0.78);
    });
  };

  keys.forEach((key, index) => {
    const x = centerX + (index - 1) * gap;
    buttons[key] = makeButton(scene, x, y, buttonW, buttonH, DIFFICULTIES[key].cn, {
      bg: 0x30364d,
      stroke: 0x6b7ba8,
      fontSize,
      onClick: () => {
        current = key;
        refresh();
        if (onChange) onChange(key);
      },
    });
  });
  refresh();
  return { title, buttons, getSelected: () => current };
}

export function toast(scene, x, y, text, color = '#ffe97a', size = 30) {
  const t = scene.add.text(x, y, text, {
    fontFamily: 'Arial, "Microsoft YaHei", sans-serif', fontSize: size + 'px',
    color, fontStyle: 'bold', stroke: '#000000', strokeThickness: 5,
  }).setOrigin(0.5).setDepth(3000);
  scene.tweens.add({ targets: t, y: y - 70, alpha: 0, duration: 1400, ease: 'Cubic.Out', onComplete: () => t.destroy() });
  return t;
}

// 局外升级商店（Menu / Result 共用）
export function openShop(scene, save, onClose) {
  const W = 720, H = 1280;
  const enabledUpgradeIds = new Set(['speed2x']);
  const layer = scene.add.container(0, 0).setDepth(5000);
  const dim = scene.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.75).setInteractive();
  layer.add(dim);
  const panel = scene.add.rectangle(W / 2, H / 2, 640, 1130, 0x1e2233, 1).setStrokeStyle(3, 0x4a5578);
  layer.add(panel);
  layer.add(scene.add.text(W / 2, 120, t('shop.title'), {
    fontFamily: 'Arial, "Microsoft YaHei", sans-serif', fontSize: '40px', color: '#ffe97a', fontStyle: 'bold',
  }).setOrigin(0.5));
  const dText = scene.add.text(W / 2, 172, '', {
    fontFamily: 'Arial, "Microsoft YaHei", sans-serif', fontSize: '28px', color: '#9fe8ff', fontStyle: 'bold',
  }).setOrigin(0.5);
  layer.add(dText);

  const rows = [];
  const refresh = () => {
    dText.setText(`💎 ${save.diamonds}`);
    rows.forEach(r => r());
  };

  UPGRADES.forEach((u, i) => {
    const y = 250 + i * 92;
    const currentTier = () => tier(save, u.id);
    const nameText = scene.add.text(70, y - 16, u.cn, {
      fontFamily: 'Arial, "Microsoft YaHei", sans-serif', fontSize: '27px', color: '#ffffff', fontStyle: 'bold',
    });
    layer.add(nameText);
    const descText = scene.add.text(70, y + 18, u.desc, {
      fontFamily: 'Arial, "Microsoft YaHei", sans-serif', fontSize: '19px', color: '#8f9ab8',
    });
    layer.add(descText);
    const tierText = scene.add.text(430, y, '', {
      fontFamily: 'Arial, "Microsoft YaHei", sans-serif', fontSize: '22px', color: '#9fe8ff',
    }).setOrigin(0.5);
    layer.add(tierText);
    const btn = makeButton(scene, 570, y, 140, 62, '', {
      bg: 0x2e6b4f, stroke: 0x59c98f, fontSize: 22,
      onClick: () => {
        if (!enabledUpgradeIds.has(u.id)) return;
        const cur = currentTier();
        if (cur >= u.tiers) return;
        const cost = u.cost(cur);
        if (save.diamonds < cost) { toast(scene, 570, y - 40, t('shop.noDiamonds'), '#ff8888', 22); return; }
        save.diamonds -= cost;
        save.up[u.id] = cur + 1;
        writeSave(save);
        Sfx.diamond();
        toast(scene, 570, y - 40, t('shop.upgraded'), '#8bf05a', 22);
        refresh();
      },
    });
    layer.add(btn);
    rows.push(() => {
      const cur = currentTier();
      const available = enabledUpgradeIds.has(u.id);
      tierText.setText(u.tiers > 1 ? `${cur}/${u.tiers}` : (cur ? t('common.unlocked') : ''));
      nameText.setColor(available ? '#ffffff' : '#70798a');
      descText.setColor(available ? '#8f9ab8' : '#555d6c');
      tierText.setColor(available ? '#9fe8ff' : '#606978');
      if (!available) {
        btn.label.setText(t('common.locked'));
        btn.bg.setFillStyle(0x343947).setStrokeStyle(2, 0x555c6b);
        btn.setEnabled(false);
      } else if (cur >= u.tiers) {
        btn.label.setText('MAX');
        btn.bg.setFillStyle(0x343947).setStrokeStyle(2, 0x555c6b);
        btn.setEnabled(false);
      } else {
        btn.label.setText(`💎${u.cost(cur)}`);
        btn.bg.setFillStyle(0x2e6b4f).setStrokeStyle(2, 0x59c98f);
        btn.setEnabled(true);
      }
    });
  });

  // 看广告领钻石（每日限 3 次）
  const today = new Date().toISOString().slice(0, 10);
  if (save.adDiamondDay !== today) { save.adDiamondDay = today; save.adDiamondCount = 0; }
  const adBtn = makeButton(scene, W / 2, 250 + UPGRADES.length * 92 + 10, 380, 66, '', {
    bg: 0x6b4a86, stroke: 0xb07fe0, fontSize: 24,
    onClick: async () => {
      if (save.adDiamondCount >= 3) return;
      const ok = await Poki.rewardedBreak();
      if (!ok) return;
      save.diamonds += DIAMOND.adDaily;
      save.adDiamondCount++;
      writeSave(save);
      Sfx.diamond();
      refreshAd();
      refresh();
    },
  });
  const refreshAd = () => {
    const left = 3 - save.adDiamondCount;
    adBtn.label.setText(left > 0 ? t('shop.ad', { value: DIAMOND.adDaily, left }) : t('shop.adDone'));
    adBtn.setEnabled(left > 0);
  };
  refreshAd();
  layer.add(adBtn);

  layer.add(makeButton(scene, W / 2, H - 120, 300, 74, t('common.close'), {
    bg: 0x51586e, fontSize: 28,
    onClick: () => { layer.destroy(); if (onClose) onClose(); },
  }));

  refresh();
  return layer;
}
