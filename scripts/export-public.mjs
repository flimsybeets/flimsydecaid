// Builds the public FlimsyDecent repo from this (personal) one.
//
//   node scripts/export-public.mjs <path to a flimsydecent checkout>
//
// Copies every shared file (tracked or new, not ignored) into the target,
// leaving out what is personal, then lays editions/public/ over the top
// (its own README, CLAUDE.md, manifest, edition folder, …) and fixes up
// package.json / package-lock.json (public name; the target keeps its own
// version, so releases there are numbered on their own). Files in the target
// that the export no longer has are deleted (its .git is left alone).
// Review the diff in the target, then commit and push there.

import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const target = process.argv[2];
if (!target || !existsSync(target)) {
  console.error('Usage: node scripts/export-public.mjs <flimsydecent checkout>');
  process.exit(1);
}

/** Personal only: never copied. editions/public/ supplies the public versions where one is needed. */
const PERSONAL = [
  'src/edition/',          // personal edition: Halloween ghosts, FlimsyBeets workflow and its illustrations
  'test/edition/',
  'scripts/ghost-art/',
  'scripts/guide-art/',    // generator for the personal illustrations
  'editions/',
  'scripts/export-public.mjs',
  'CLAUDE.md',
  'README.md',
  'index.html',
  'public/skin-manifest.json',
  '.github/workflows/release.yml',
];
const isPersonal = (f) => PERSONAL.some((p) => (p.endsWith('/') ? f.startsWith(p) : f === p));

const files = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], { cwd: root, encoding: 'utf8' })
  .split('\n')
  .filter((f) => f && existsSync(join(root, f)) && !isPersonal(f));

// What the export will contain (shared files + the public overlay), relative paths.
const overlayRoot = join(root, 'editions/public');
const walk = (dir) => readdirSync(dir).flatMap((n) => {
  const p = join(dir, n);
  return statSync(p).isDirectory() ? walk(p) : [relative(overlayRoot, p)];
});
const overlay = walk(overlayRoot).filter((f) => f !== 'package.overrides.json');
const wanted = new Set([...files, ...overlay, 'package.json', 'package-lock.json']);

// Remove target files that are no longer part of the export.
const targetFiles = (dir) => readdirSync(dir).flatMap((n) => {
  if (n === '.git' || n === 'node_modules' || n === 'dist' || n === 'release') return [];
  const p = join(dir, n);
  return statSync(p).isDirectory() ? targetFiles(p) : [relative(target, p)];
});
let removed = 0;
for (const f of targetFiles(target)) if (!wanted.has(f)) { rmSync(join(target, f)); removed++; }

const copy = (from, to) => { mkdirSync(dirname(to), { recursive: true }); cpSync(from, to); };
for (const f of files) if (f !== 'package.json' && f !== 'package-lock.json') copy(join(root, f), join(target, f));
for (const f of overlay) copy(join(overlayRoot, f), join(target, f));

// package.json: shared, with the public name/description, its own version and no personal scripts.
const over = JSON.parse(readFileSync(join(overlayRoot, 'package.overrides.json'), 'utf8'));
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const targetPkgPath = join(target, 'package.json');
const targetVersion = existsSync(targetPkgPath) ? JSON.parse(readFileSync(targetPkgPath, 'utf8')).version : over.version;
const out = { ...pkg, name: over.name, description: over.description, version: targetVersion };
for (const s of over.dropScripts ?? []) delete out.scripts[s];
writeFileSync(targetPkgPath, JSON.stringify(out, null, 2) + '\n');
const lock = JSON.parse(readFileSync(join(root, 'package-lock.json'), 'utf8'));
lock.name = over.name;
lock.version = targetVersion;
if (lock.packages?.['']) { lock.packages[''].name = over.name; lock.packages[''].version = targetVersion; }
writeFileSync(join(target, 'package-lock.json'), JSON.stringify(lock, null, 2) + '\n');

// Nothing personal should be left in shared code.
const LEAKS = /Halloween|ghostFrames|ghostPath|FlimsyBeets|IKAPE|Bookoo|Weber|Timemore|Grindenstein|guideScenes/;
const leaks = files
  .filter((f) => /\.(ts|svelte|css|js|mjs|cjs|html)$/.test(f))
  .filter((f) => LEAKS.test(readFileSync(join(root, f), 'utf8')));
console.log(`Exported ${files.length} shared files + ${overlay.length} public files to ${target}; removed ${removed}.`);
if (leaks.length) console.log(`Check these shared files for personal references:\n  ${leaks.join('\n  ')}`);
