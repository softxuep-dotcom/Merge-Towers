import { readFile, readdir } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BASE_TRANSLATION_KEYS, getMissingTranslations, LOCALES, ONBOARDING_KEYS } from '../src/i18n.js';

async function sourceFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const nested = await Promise.all(entries.map(entry => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return extname(entry.name) === '.js' ? [path] : [];
  }));
  return nested.flat();
}

const baseKeys = new Set(BASE_TRANSLATION_KEYS);
const unknownSourceKeys = new Set();
for (const file of await sourceFiles(fileURLToPath(new URL('../src', import.meta.url)))) {
  const source = await readFile(file, 'utf8');
  for (const match of source.matchAll(/\bt\(\s*['"]([^'"]+)['"]/g)) {
    if (!baseKeys.has(match[1])) unknownSourceKeys.add(match[1]);
  }
}

let failed = false;
if (unknownSourceKeys.size) {
  failed = true;
  console.error(`English base dictionary is missing source keys: ${[...unknownSourceKeys].sort().join(', ')}`);
}

for (const { code } of LOCALES) {
  const missing = getMissingTranslations(code, ONBOARDING_KEYS);
  if (missing.length) {
    failed = true;
    console.error(`${code}: missing onboarding translations: ${missing.join(', ')}`);
  }

  const fallbackCount = getMissingTranslations(code).length;
  if (fallbackCount) console.log(`${code}: ${fallbackCount} non-onboarding strings still use the English fallback`);
}

if (failed) process.exit(1);
console.log(`i18n onboarding coverage OK: ${LOCALES.length} locales, ${ONBOARDING_KEYS.length} keys`);
