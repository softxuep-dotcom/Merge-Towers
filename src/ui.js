import Phaser from 'phaser';

// 通用 UI 组件
import { UPGRADES, DIAMOND, DEFAULT_DIFFICULTY, DIFFICULTIES } from './config.js';
import { tier, writeSave } from './save.js';
import { Sfx, unlockAudio } from './audio.js';
import { Poki } from './poki.js';
import { t } from './i18n.js';

export const UI_THEME = Object.freeze({
  ink: 0x07111b,
  surface: 0x0e1d2b,
  surfaceRaised: 0x17293a,
  surfaceSoft: 0x203448,
  line: 0x547284,
  lineSoft: 0x2e4658,
  primary: 0x287a5d,
  primaryBright: 0x63d6a3,
  gold: 0xf3c95f,
  danger: 0x9a4451,
  text: '#f4f7f8',
  textSoft: '#a8bac7',
  textMuted: '#718898',
});

export function makePanel(scene, x, y, w, h, opts = {}) {
  const radius = opts.radius ?? 24;
  const g = scene.add.graphics();
  if ((opts.shadowAlpha ?? 0.34) > 0) {
    g.fillStyle(opts.shadow ?? 0x02070b, opts.shadowAlpha ?? 0.34);
    g.fillRoundedRect(x - w / 2 + 7, y - h / 2 + 10, w, h, radius);
  }
  g.fillStyle(opts.fill ?? UI_THEME.surface, opts.alpha ?? 0.96);
  g.fillRoundedRect(x - w / 2, y - h / 2, w, h, radius);
  g.lineStyle(opts.strokeWidth ?? 1, opts.stroke ?? UI_THEME.line, opts.strokeAlpha ?? 0.48);
  g.strokeRoundedRect(x - w / 2, y - h / 2, w, h, radius);
  if (opts.accent !== false) {
    const accentW = Math.min(w - 44, opts.accentWidth ?? 96);
    g.fillStyle(opts.accentColor ?? UI_THEME.primaryBright, opts.accentAlpha ?? 0.82);
    g.fillRoundedRect(x - accentW / 2, y - h / 2, accentW, 3, 2);
  }
  return g;
}

export function makeButton(scene, x, y, w, h, label, opts = {}) {
  const bgColor = opts.bg ?? 0x3b4568;
  const radius = Math.min(opts.radius ?? 16, h / 2);
  const state = {
    fill: bgColor,
    fillAlpha: opts.bgAlpha ?? 0.98,
    stroke: opts.stroke ?? 0x6b7ba8,
    strokeWidth: opts.strokeWidth ?? 1,
    strokeAlpha: opts.strokeAlpha ?? 0.9,
  };
  const shadow = scene.add.graphics();
  const bg = scene.add.graphics();
  const redrawShadow = () => {
    shadow.clear();
    if (opts.shadow === false) return;
    shadow.fillStyle(0x02070b, opts.shadowAlpha ?? 0.34);
    shadow.fillRoundedRect(-w / 2 + 2, -h / 2 + 5, w - 4, h, radius);
  };
  const redrawBg = () => {
    bg.clear();
    bg.fillStyle(state.fill, state.fillAlpha);
    bg.fillRoundedRect(-w / 2, -h / 2, w, h, radius);
    bg.lineStyle(state.strokeWidth, state.stroke, state.strokeAlpha);
    bg.strokeRoundedRect(-w / 2, -h / 2, w, h, radius);
    bg.fillStyle(0xffffff, opts.highlightAlpha ?? 0.09);
    bg.fillRoundedRect(-w / 2 + radius, -h / 2 + 3, w - radius * 2, 2, 1);
  };
  bg.setFillStyle = (color, alpha = state.fillAlpha) => {
    state.fill = color;
    state.fillAlpha = alpha;
    redrawBg();
    return bg;
  };
  bg.setStrokeStyle = (width = state.strokeWidth, color = state.stroke, alpha = state.strokeAlpha) => {
    state.strokeWidth = width;
    state.stroke = color;
    state.strokeAlpha = alpha;
    redrawBg();
    return bg;
  };
  redrawShadow();
  redrawBg();
  const txt = scene.add.text(0, 0, label, {
    fontFamily: 'Arial, "Microsoft YaHei", sans-serif',
    fontSize: (opts.fontSize ?? 26) + 'px',
    color: opts.color ?? '#ffffff',
    fontStyle: 'bold',
    align: 'center',
    ...(opts.letterSpacing ? { letterSpacing: opts.letterSpacing } : {}),
    stroke: opts.textStroke ?? '#09111a',
    // 彩色 emoji 在部分 Canvas 字体回退中无法正确描边，默认用纯字形保证多语言与图标完整。
    strokeThickness: opts.textStrokeThickness ?? 0,
  }).setOrigin(0.5);
  const c = scene.add.container(x, y, [shadow, bg, txt]);
  c.setSize(w, h).setInteractive({ useHandCursor: true });
  c.bg = bg; c.label = txt;
  c.on('pointerover', () => {
    if (c.enabled === false) return;
    c._hoverFill = state.fill;
    bg.setFillStyle(Phaser.Display.Color.IntegerToColor(state.fill).brighten(10).color);
  });
  c.on('pointerout', () => bg.setFillStyle(c._hoverFill ?? state.fill));
  c.on('pointerdown', () => {
    if (c.enabled === false) return;
    unlockAudio();
    scene.tweens.add({ targets: c, scale: 0.965, y: '+=2', duration: 55, yoyo: true, ease: 'Quad.Out' });
    if (opts.onClick) opts.onClick();
  });
  c.enabled = true;
  c.setEnabled = (on) => {
    c.enabled = !!on;
    c.disableInteractive();
    if (on) c.setInteractive({ useHandCursor: true });
    c.setAlpha(on ? 1 : 0.45);
  };
  return c;
}

export function makeHudButton(scene, x, y, w, h, label, opts = {}) {
  const normalFrame = opts.frame ?? 'button_secondary';
  const disabledFrame = opts.disabledFrame ?? 'button_disabled';
  const simpleSkins = {
    button_primary: { fill: 0x285f4e, stroke: 0x5d9d82 },
    button_secondary: { fill: 0x263246, stroke: 0x52627a },
    button_danger: { fill: 0x3d2932, stroke: 0x76505e },
    button_disabled: { fill: 0x252b36, stroke: 0x444d5e },
  };
  const simpleSkin = frame => simpleSkins[frame] || simpleSkins.button_secondary;
  let simpleShadow = null;
  let bg;
  if (opts.simple) {
    const radius = Math.min(opts.radius ?? 16, h / 2);
    const skinState = {
      fill: opts.bg ?? simpleSkin(normalFrame).fill,
      alpha: opts.bgAlpha ?? 0.94,
      stroke: opts.stroke ?? simpleSkin(normalFrame).stroke,
      strokeWidth: opts.strokeWidth ?? 1,
      strokeAlpha: 0.9,
    };
    simpleShadow = scene.add.graphics();
    simpleShadow.fillStyle(0x02070b, opts.shadowAlpha ?? 0.26);
    simpleShadow.fillRoundedRect(-w / 2 + 2, -h / 2 + 4, w - 4, h, radius);
    bg = scene.add.graphics();
    const redraw = () => {
      bg.clear();
      bg.fillStyle(skinState.fill, skinState.alpha);
      bg.fillRoundedRect(-w / 2, -h / 2, w, h, radius);
      bg.lineStyle(skinState.strokeWidth, skinState.stroke, skinState.strokeAlpha);
      bg.strokeRoundedRect(-w / 2, -h / 2, w, h, radius);
      bg.fillStyle(0xffffff, 0.075);
      bg.fillRoundedRect(-w / 2 + radius, -h / 2 + 3, w - radius * 2, 2, 1);
    };
    bg.setFillStyle = (color, alpha = skinState.alpha) => {
      skinState.fill = color;
      skinState.alpha = alpha;
      redraw();
      return bg;
    };
    bg.setStrokeStyle = (width, color, alpha = skinState.strokeAlpha) => {
      skinState.strokeWidth = width;
      skinState.stroke = color;
      skinState.strokeAlpha = alpha;
      redraw();
      return bg;
    };
    redraw();
  } else {
    bg = scene.add.nineslice(0, 0, 'ui_components', normalFrame, w, h, 42, 42, 28, 28);
  }
  const iconSize = opts.iconSize ?? Math.min(54, h * 0.62);
  const iconX = opts.icon
    ? (opts.iconX ?? (-w / 2 + Math.max(30, iconSize * 0.72)))
    : 0;
  const icon = opts.icon
    ? scene.add.image(iconX, opts.iconY ?? 0, 'ui_icons', opts.icon).setDisplaySize(iconSize, iconSize)
    : null;
  const labelX = opts.labelX ?? (icon ? Math.min(w * 0.16, iconSize * 0.58) : 0);
  const txt = scene.add.text(labelX, opts.labelY ?? 0, label, {
    fontFamily: 'Arial, "Microsoft YaHei", sans-serif',
    fontSize: (opts.fontSize ?? 24) + 'px',
    color: opts.color ?? '#ffffff',
    fontStyle: 'bold',
    align: 'center',
    stroke: opts.stroke ?? '#142033',
    strokeThickness: opts.strokeThickness ?? 3,
  }).setOrigin(0.5);
  const c = scene.add.container(x, y, [...(simpleShadow ? [simpleShadow] : []), bg, ...(icon ? [icon] : []), txt]);
  c.setSize(w, h).setInteractive({ useHandCursor: true });
  c.bg = bg;
  c.icon = icon;
  c.label = txt;
  c.normalFrame = normalFrame;
  c.simple = !!opts.simple;
  c.enabled = true;
  c.setSkin = frame => {
    c.normalFrame = frame;
    if (c.simple) {
      const skin = simpleSkin(frame);
      bg.setFillStyle(skin.fill, opts.bgAlpha ?? 0.92).setStrokeStyle(opts.strokeWidth ?? 1, skin.stroke, 0.9);
    } else {
      bg.setTexture('ui_components', frame);
      bg.setSlices(w, h, 42, 42, 28, 28, true);
    }
    return c;
  };
  c.on('pointerover', () => {
    if (!c.enabled) return;
    if (c.simple) bg.setAlpha(0.92);
    else bg.setTint(0xffffff);
  });
  c.on('pointerout', () => {
    if (c.simple) bg.setAlpha(1);
    else bg.clearTint();
  });
  c.on('pointerdown', () => {
    if (!c.enabled) return;
    unlockAudio();
    scene.tweens.add({ targets: c, scale: 0.94, duration: 55, yoyo: true });
    if (opts.onClick) opts.onClick();
  });
  c.setEnabled = on => {
    c.enabled = !!on;
    c.disableInteractive();
    if (on) c.setInteractive({ useHandCursor: true });
    if (c.simple) {
      const skin = simpleSkin(on ? c.normalFrame : disabledFrame);
      bg.setFillStyle(skin.fill, opts.bgAlpha ?? 0.92).setStrokeStyle(opts.strokeWidth ?? 1, skin.stroke, 0.9);
    } else {
      bg.setTexture('ui_components', on ? c.normalFrame : disabledFrame);
      bg.setSlices(w, h, 42, 42, 28, 28, true);
    }
    if (icon) icon.setAlpha(on ? 1 : 0.45);
    txt.setAlpha(on ? 1 : 0.55);
    return c;
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
  const title = scene.add.text(centerX, y - buttonH / 2 - 30, '', {
    fontFamily: 'Arial, "Microsoft YaHei", sans-serif', fontSize: (opts.titleSize ?? 22) + 'px',
    color: UI_THEME.textSoft, fontStyle: 'bold', letterSpacing: 0.5,
  }).setOrigin(0.5);
  const buttons = {};

  const refresh = () => {
    const selected = DIFFICULTIES[current];
    title.setText(t('difficulty.title', { name: selected.cn, hp: selected.hpBase }));
    keys.forEach(key => {
      const active = key === current;
      const def = DIFFICULTIES[key];
      buttons[key].label.setText(`${active ? '✓ ' : ''}${def.cn}`);
      buttons[key].bg
        .setFillStyle(active ? 0x1d3a35 : 0x152433, active ? 1 : 0.88)
        .setStrokeStyle(active ? 2 : 1, active ? def.color : UI_THEME.line, active ? 1 : 0.58);
      buttons[key].label.setColor(active ? '#ffffff' : UI_THEME.textSoft);
      buttons[key].setAlpha(active ? 1 : 0.82);
    });
  };

  keys.forEach((key, index) => {
    const x = centerX + (index - 1) * gap;
    buttons[key] = makeButton(scene, x, y, buttonW, buttonH, DIFFICULTIES[key].cn, {
      bg: 0x152433,
      stroke: UI_THEME.line,
      radius: 12,
      shadowAlpha: 0.16,
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

export function toast(scene, x, y, text, color = '#ffe97a', size = 30, duration = 1400) {
  const t = scene.add.text(x, y, text, {
    fontFamily: 'Arial, "Microsoft YaHei", sans-serif', fontSize: size + 'px',
    color, fontStyle: 'bold', stroke: '#000000', strokeThickness: 5,
  }).setOrigin(0.5).setDepth(3000);
  scene.tweens.add({ targets: t, y: y - 70, alpha: 0, duration, ease: 'Cubic.Out', onComplete: () => t.destroy() });
  return t;
}

// 局外升级商店（Menu / Result 共用）
export function openShop(scene, save, onClose) {
  const W = 720, H = 1280;
  const viewW = scene.scale.width || W;
  const viewH = scene.scale.height || H;
  const cx = viewW / 2;
  const cy = viewH / 2;
  const sx = value => value + cx - W / 2;
  const sy = value => value + cy - H / 2;
  const enabledUpgradeIds = new Set(['speed2x']);
  const layer = scene.add.container(0, 0).setDepth(5000);
  const dim = scene.add.rectangle(cx, cy, viewW, viewH, 0x02070c, 0.84).setInteractive();
  layer.add(dim);
  const panel = makePanel(scene, cx, cy, 656, 1144, {
    fill: UI_THEME.surface, alpha: 0.99, radius: 26, stroke: UI_THEME.line,
    strokeAlpha: 0.7, accentColor: UI_THEME.gold, accentWidth: 110,
  });
  layer.add(panel);
  layer.add(scene.add.text(cx, sy(112), t('shop.title'), {
    fontFamily: 'Arial Black, "Microsoft YaHei", sans-serif', fontSize: '38px', color: '#f5d675', fontStyle: 'bold',
  }).setOrigin(0.5));
  layer.add(scene.add.text(cx, sy(154), 'PERMANENT  UPGRADES', {
    fontFamily: 'Arial, sans-serif', fontSize: '13px', color: UI_THEME.textMuted, fontStyle: 'bold', letterSpacing: 3,
  }).setOrigin(0.5));
  const dText = scene.add.text(cx, sy(194), '', {
    fontFamily: 'Arial, "Microsoft YaHei", sans-serif', fontSize: '25px', color: '#9fe8ff', fontStyle: 'bold',
  }).setOrigin(0.5);
  layer.add(dText);

  const rows = [];
  const refresh = () => {
    dText.setText(`💎 ${save.diamonds}`);
    rows.forEach(r => r());
  };

  UPGRADES.forEach((u, i) => {
    const y = sy(265 + i * 90);
    const currentTier = () => tier(save, u.id);
    layer.add(makePanel(scene, cx, y, 584, 76, {
      fill: UI_THEME.surfaceRaised, alpha: 0.72, radius: 14, stroke: UI_THEME.lineSoft,
      strokeAlpha: 0.5, shadowAlpha: 0.12, accent: false,
    }));
    const nameText = scene.add.text(sx(82), y - 14, u.cn, {
      fontFamily: 'Arial, "Microsoft YaHei", sans-serif', fontSize: '24px', color: UI_THEME.text, fontStyle: 'bold',
    });
    layer.add(nameText);
    const descText = scene.add.text(sx(82), y + 17, u.desc, {
      fontFamily: 'Arial, "Microsoft YaHei", sans-serif', fontSize: '17px', color: UI_THEME.textSoft,
    });
    layer.add(descText);
    const tierText = scene.add.text(sx(466), y, '', {
      fontFamily: 'Arial, "Microsoft YaHei", sans-serif', fontSize: '19px', color: '#9fe8ff', fontStyle: 'bold',
    }).setOrigin(0.5);
    layer.add(tierText);
    const btn = makeButton(scene, sx(582), y, 126, 54, '', {
      bg: UI_THEME.primary, stroke: UI_THEME.primaryBright, fontSize: 19, radius: 13, shadowAlpha: 0.2,
      onClick: () => {
        if (!enabledUpgradeIds.has(u.id)) return;
        const cur = currentTier();
        if (cur >= u.tiers) return;
        const cost = u.cost(cur);
        if (save.diamonds < cost) { toast(scene, sx(570), y - 40, t('shop.noDiamonds'), '#ff8888', 22); return; }
        save.diamonds -= cost;
        save.up[u.id] = cur + 1;
        writeSave(save);
        Sfx.diamond();
        toast(scene, sx(570), y - 40, t('shop.upgraded'), '#8bf05a', 22);
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
  const adBtn = makeButton(scene, cx, sy(265 + UPGRADES.length * 90 + 28), 420, 64, '', {
    bg: 0x68427f, stroke: 0xc186e2, fontSize: 21, radius: 16,
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

  layer.add(makeButton(scene, cx, sy(H - 104), 300, 64, t('common.close'), {
    bg: 0x263a4b, stroke: 0x587083, fontSize: 23, radius: 16,
    onClick: () => { layer.destroy(); if (onClose) onClose(); },
  }));

  refresh();
  return layer;
}
