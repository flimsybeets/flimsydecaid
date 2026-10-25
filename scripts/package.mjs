// Zips dist/ into release/<id>-<version>.zip with index.html and
// skin-manifest.json at the archive root, as Decaid expects.
// The manifest version is taken from package.json (or a v* tag via
// SKIN_VERSION) so the two never drift. No dependencies: a minimal
// zip writer using Node's built-in deflate.
import { readFileSync, writeFileSync, readdirSync, statSync, mkdirSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { deflateRawSync, crc32 } from 'node:zlib';

const root = new URL('..', import.meta.url).pathname;
const dist = join(root, 'dist');
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const version = (process.env.SKIN_VERSION || pkg.version).replace(/^v/, '');

if (!/^\d+(\.\d+)*$/.test(version)) {
  // Decaid compares numeric dot-segments; text in a version degrades silently.
  console.error(`Version "${version}" must be numeric dot-segments, e.g. 0.2.1`);
  process.exit(1);
}

const manifestPath = join(dist, 'skin-manifest.json');
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
manifest.version = version;
if (process.env.SKIN_ID_SUFFIX) manifest.id += process.env.SKIN_ID_SUFFIX;
writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

const files = walk(dist).sort();
for (const required of ['index.html', 'skin-manifest.json']) {
  if (!files.includes(join(dist, required))) {
    console.error(`dist/${required} is missing`);
    process.exit(1);
  }
}

const locals = [];
const centrals = [];
let offset = 0;
const dosTime = 0;
const dosDate = (1 << 5) | 1; // 1980-01-01, keeps builds reproducible

for (const file of files) {
  const name = Buffer.from(relative(dist, file).split(sep).join('/'));
  const data = readFileSync(file);
  const packed = deflateRawSync(data, { level: 9 });
  const crc = crc32(data);

  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(20, 4);
  local.writeUInt16LE(0x0800, 6); // UTF-8 names
  local.writeUInt16LE(8, 8); // deflate
  local.writeUInt16LE(dosTime, 10);
  local.writeUInt16LE(dosDate, 12);
  local.writeUInt32LE(crc, 14);
  local.writeUInt32LE(packed.length, 18);
  local.writeUInt32LE(data.length, 22);
  local.writeUInt16LE(name.length, 26);
  locals.push(local, name, packed);

  const central = Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50, 0);
  central.writeUInt16LE(20, 4);
  central.writeUInt16LE(20, 6);
  central.writeUInt16LE(0x0800, 8);
  central.writeUInt16LE(8, 10);
  central.writeUInt16LE(dosTime, 12);
  central.writeUInt16LE(dosDate, 14);
  central.writeUInt32LE(crc, 16);
  central.writeUInt32LE(packed.length, 20);
  central.writeUInt32LE(data.length, 24);
  central.writeUInt16LE(name.length, 28);
  central.writeUInt32LE(offset, 42);
  centrals.push(central, name);

  offset += local.length + name.length + packed.length;
}

const centralSize = centrals.reduce((n, b) => n + b.length, 0);
const end = Buffer.alloc(22);
end.writeUInt32LE(0x06054b50, 0);
end.writeUInt16LE(files.length, 8);
end.writeUInt16LE(files.length, 10);
end.writeUInt32LE(centralSize, 12);
end.writeUInt32LE(offset, 16);

mkdirSync(join(root, 'release'), { recursive: true });
const out = join(root, 'release', `${manifest.id}-${version}.zip`);
writeFileSync(out, Buffer.concat([...locals, ...centrals, end]));
console.log(`Packaged ${files.length} files → ${relative(root, out)}`);
