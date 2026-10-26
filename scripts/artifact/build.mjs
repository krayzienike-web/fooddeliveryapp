// Packs the Expo web export (dist/) as a claude.ai Artifact: a content-only page + supporting files.
// usage: npx expo export --platform web && node scripts/artifact/build.mjs
// out:   artifact-build/zhar.html, artifact-build/** (files), artifact-build/manifest.json (publish batches)
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const DIST = 'dist';
const OUT = 'artifact-build';
const FONT_WEIGHTS = ['Unbounded_600SemiBold', 'Unbounded_700Bold', 'Unbounded_800ExtraBold', 'Onest_400Regular', 'Onest_500Medium', 'Onest_600SemiBold', 'Onest_700Bold'];
const BATCH = 240; // the Artifact tool takes at most 255 files per publish

if (!existsSync(join(DIST, 'index.html'))) throw new Error('dist/ is missing: run `npx expo export --platform web` first');
rmSync(OUT, { recursive: true, force: true });
cpSync(DIST, OUT, { recursive: true });

const walk = (dir) => readdirSync(dir).flatMap((f) => (statSync(join(dir, f)).isDirectory() ? walk(join(dir, f)) : [join(dir, f)]));

// 1. Drop what the app never loads: other icon fonts, unused font weights, navigation header icons.
let dropped = 0;
for (const f of walk(join(OUT, 'assets'))) {
  const p = f.replaceAll('\\', '/');
  const iconFont = p.includes('/vector-icons/') && p.includes('/Fonts/') && !p.includes('MaterialCommunityIcons');
  const unusedWeight = p.includes('@expo-google-fonts') && !FONT_WEIGHTS.some((w) => p.includes(`/${w}.`));
  const navIcons = p.includes('@react-navigation/elements');
  if (iconFont || unusedWeight || navIcons) {
    rmSync(f);
    dropped++;
  }
}

// 2. Absolute URLs → relative: artifact files are served next to the page, not at the site root.
const jsDir = join(OUT, '_expo/static/js/web');
const bundle = readdirSync(jsDir).find((f) => f.endsWith('.js'));
const bundlePath = join(jsDir, bundle);
const js = readFileSync(bundlePath, 'utf8');
const rewritten = js.replaceAll('"/assets/', '"./assets/').replaceAll("'/assets/", "'./assets/");
// «_»-prefixed top-level paths are reserved by the artifact service: move the bundle to ./js/.
rmSync(join(OUT, '_expo'), { recursive: true });
mkdirSync(join(OUT, 'js'), { recursive: true });
writeFileSync(join(OUT, 'js', bundle), rewritten);
const left = (rewritten.match(/["']\/assets\//g) ?? []).length;
if (left) throw new Error(`${left} absolute asset URLs left in the bundle`);

// 3. The page: content only (the Artifact tool adds doctype/head/body). Single dark look, like the app.
rmSync(join(OUT, 'index.html'));
rmSync(join(OUT, 'favicon.ico'), { force: true });
rmSync(join(OUT, 'metadata.json'), { force: true });
const page = `<title>ЖАР</title>
<style>
  /* Full-screen phone app; the app paints its own themed surfaces. */
  :root { --bg: #120D0B; color-scheme: dark }
  html, body { height: 100%; }
  body { background: var(--bg); overflow: hidden; }
  #root { display: flex; height: 100%; flex: 1; }
</style>
<noscript>Для демо нужен JavaScript.</noscript>
<div id="root"></div>
<script src="./js/${bundle}" defer></script>
`;
writeFileSync(join(OUT, 'zhar.html'), page);

// 4. Publish batches: the bundle first, then assets.
const files = walk(OUT)
  .map((f) => relative(OUT, f).replaceAll('\\', '/'))
  .filter((f) => f !== 'zhar.html' && f !== 'manifest.json')
  .sort((a, b) => (a.startsWith('js/') ? -1 : b.startsWith('js/') ? 1 : a.localeCompare(b)));
const batches = [];
for (let i = 0; i < files.length; i += BATCH) batches.push(files.slice(i, i + BATCH));
const size = files.reduce((s, f) => s + statSync(join(OUT, f)).size, 0);
writeFileSync(join(OUT, 'manifest.json'), JSON.stringify({ bundle, batches }, null, 1));
console.log(`dropped ${dropped} unused files; ${files.length} files, ${(size / 1e6).toFixed(1)} MB in ${batches.length} batch(es)`);
