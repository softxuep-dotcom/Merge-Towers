# Merge Towers UI atlas v1

## Runtime files

- `ui-icons-v1.png` + `ui-icons-v1.json`: 24 named icons in a 6 x 4 atlas.
- `ui-components-v1.png` + `ui-components-v1.json`: 16 named component cells in a 4 x 4 atlas.

The `*-chromakey.png` and `*-source.png` files are retained under `art-source/ui/` as editable generation sources. Runtime code should load only the optimized alpha PNG and JSON pairs in this directory.

## Phaser loading

```js
this.load.atlas('ui_icons', 'assets/ui/ui-icons-v1.png', 'assets/ui/ui-icons-v1.json');
this.load.atlas('ui_components', 'assets/ui/ui-components-v1.png', 'assets/ui/ui-components-v1.json');
```

## Recommended display sizes

- HUD/resource icons: 28-36 px.
- Primary action icons: 48-64 px.
- Element choice icons: 56-72 px.
- Boss/affix icons: 34-48 px.
- Circular level badge: 36-52 px.

## Recommended 9-slice borders

Component atlas cells intentionally include transparent padding. Crop to visible alpha bounds before final 9-slice integration, then use these starting borders:

- Wide buttons: 38 px left/right, 24 px top/bottom.
- `panel_9slice`: 38 px on all sides.
- `card_portrait`: 34 px on all sides.
- `modal_panel`: 44 px left/right, 40 px top/bottom.
- `tooltip`: 28 px left/right, 24 px top and 38 px bottom.
- Bars: preserve both end caps; stretch only the center 30-40%.

## Frame naming

Icons use role-based names (`coin`, `build`, `element_fire`, `affix_armor`). Components use semantic names (`button_primary`, `panel_9slice`, `boss_bar`). Keep these names stable when repacking or optimizing the atlas.
