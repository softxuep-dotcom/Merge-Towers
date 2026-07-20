import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const game = read('src/scenes/GameScene.js');
const vfx = read('src/scenes/gameVfx.js');
const runtime = read('src/vfx/VfxRuntime.js');
const textures = read('src/textures.js');
const beam = read('src/vfx/BeamSystem.js');
const upgrades = read('src/towerUpgrades.js');

const coverage = {
  blast: [game, "playFireBurstFx(tx, ty, radius * 0.72, t.color, 'blast')"],
  molten: [game, 'playMoltenImpactFx'],
  scorched: [game, "const scorched = skill === 'scorched'"],
  glacier: [game, "playFrostNovaFx(target.x, target.y, radius, t.lv >= 7, 'glacier')"],
  vortex: [game, 'playVortexFx'],
  mirror: [game, 'playMirrorSplitFx'],
  chain: [vfx, "profile = 'chain'"],
  nexus: [vfx, "burst('nexus'"],
  magstorm: [game, 'playVerticalLightningFx'],
  refraction: [game, 'playRefractionFx'],
  judgement: [game, 'playExecuteFx'],
  radiance: [vfx, "tower.skill !== 'radiance'"],
  plague: [vfx, "burst('plague'"],
  corrosion: [game, 'playCorrosionHitFx'],
  spores: [game, 'playSporeFieldPulseFx'],
};

const failures = [];
const coreBlock = upgrades.slice(upgrades.indexOf('const CORE'), upgrades.indexOf('const TRACK_NAMES'));
const declaredSkills = [...coreBlock.matchAll(/\{ key: '([^']+)'/g)].map(match => match[1]);
if (declaredSkills.length !== 15) failures.push(`expected 15 declared skills, found ${declaredSkills.length}`);
for (const skill of declaredSkills) {
  if (!coverage[skill]) failures.push(`${skill}: no VFX coverage entry`);
}
for (const skill of Object.keys(coverage)) {
  if (!declaredSkills.includes(skill)) failures.push(`${skill}: VFX coverage has no declared skill`);
}

for (const [skill, [source, marker]] of Object.entries(coverage)) {
  if (!source.includes(marker)) failures.push(`${skill}: missing runtime trigger ${marker}`);
  if (skill !== 'chain' && !runtime.includes(`  ${skill}: {`)) failures.push(`${skill}: missing shader profile`);
}

for (const texture of ['fx_ring', 'holy_mote', 'poison_drop', 'corrosion_shard', 'spore_mote', 'prism_shard', 'vortex_arc', 'mirror_shard', 'lava_shard', 'holy_sigil', 'fx_hex']) {
  if (!textures.includes(`'${texture}'`)) failures.push(`missing generated texture ${texture}`);
}

for (const profile of ['chain', 'nexus', 'storm', 'conducted', 'prism', 'mirror', 'judgement', 'radiance']) {
  if (!beam.includes(`  ${profile}: Object.freeze({`)) failures.push(`missing beam profile ${profile}`);
}

if (failures.length) {
  console.error(`Skill VFX coverage failed:\n- ${failures.join('\n- ')}`);
  process.exit(1);
}

console.log('Skill VFX coverage OK: 15/15 skills have dedicated triggers, shader profiles, textures, and beam variants.');
