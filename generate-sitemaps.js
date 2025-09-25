// generate-sitemaps.js
// Usage: BASE_URL="https://mjm-travel.github.io/Directory/" node generate-sitemaps.js
// Optional env: SITEMAP_DIR (default: "sitemaps")

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const BASE_URL = (process.env.BASE_URL || '').replace(/\/$/, '') || 'https://mjm-travel.github.io/Directory/';
const SITEMAP_DIR = process.env.SITEMAP_DIR || 'sitemaps';
const ROOT = process.cwd();

const INCLUDE_EXTENSIONS = ['.html']; // change as needed
const EXCLUDE_DIRS = new Set(['.git', 'node_modules', SITEMAP_DIR, '.github', '.gitlab', 'dist', 'build', 'assets']);

function safeName(name) {
  return name.replace(/[^\w\-\.]/g, '-').toLowerCase();
}

function isExcludedDir(name) {
  return EXCLUDE_DIRS.has(name);
}

function getAllFilesRecursive(startPath) {
  let results = [];
  function walk(dir) {
    const entries = fs.readdirSync(dir);
    for (const e of entries) {
      const full = path.join(dir, e);
      const stat = fs.statSync(full);
      if (stat.isDirectory()) {
        if (!isExcludedDir(path.basename(full))) walk(full);
      } else if (stat.isFile()) {
        const ext = path.extname(full).toLowerCase();
        if (INCLUDE_EXTENSIONS.includes(ext)) results.push(full);
      }
    }
  }
  walk(startPath);
  return results;
}

function urlForFile(filePath) {
  const rel = path.relative(ROOT, filePath).split(path.sep).map(encodeURIComponent).join('/');
  return `${BASE_URL}/${rel}`;
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function writeXml(filename, content) {
  fs.writeFileSync(filename, content, 'utf8');
  console.log('WROTE', filename);
}

function generateSitemapXml(entries) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries.map(e => `  <url>
    <loc>${e.loc}</loc>
  </url>`).join('\n')}
</urlset>`;
}

function generateSitemapIndexXml(sitemaps) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemaps.map(s => `  <sitemap>
    <loc>${s.loc}</loc>
  </sitemap>`).join('\n')}
</sitemapindex>`;
}

// MAIN
ensureDir(SITEMAP_DIR);

// 1) find top-level folders
const topLevel = fs.readdirSync(ROOT)
  .filter(n => {
    const full = path.join(ROOT, n);
    return fs.existsSync(full) && fs.statSync(full).isDirectory() && !isExcludedDir(n);
  });

const sitemapMeta = [];

// For each top-level folder, gather files recursively and write sitemap
for (const folder of topLevel) {
  const folderPath = path.join(ROOT, folder);
  const files = getAllFilesRecursive(folderPath);
  if (!files.length) continue;

  const entries = files.map(f => ({ loc: urlForFile(f), lastmod: gitLastModifiedISO(f) }));
  // lastmod for the sitemap = newest lastmod in entries
  const sitemapLastmod = entries.map(e => e.lastmod).sort().reverse()[0] || new Date().toISOString();

  const sitemapFilename = `sitemap-${safeName(folder)}.xml`;
  const outPath = path.join(SITEMAP_DIR, sitemapFilename);
  writeXml(outPath, generateSitemapXml(entries));

  sitemapMeta.push({
    filename: sitemapFilename,
    loc: `${BASE_URL}/${SITEMAP_DIR}/${encodeURIComponent(sitemapFilename)}`,
    lastmod: sitemapLastmod
  });
}

// 2) files at repo root (not inside top-level dirs)
const rootFiles = fs.readdirSync(ROOT)
  .filter(f => {
    const full = path.join(ROOT, f);
    return fs.statSync(full).isFile() && INCLUDE_EXTENSIONS.includes(path.extname(full).toLowerCase());
  })
  .map(f => path.join(ROOT, f));

if (rootFiles.length) {
  const entries = rootFiles.map(f => ({ loc: urlForFile(f), lastmod: gitLastModifiedISO(f) }));
  const sitemapLastmod = entries.map(e => e.lastmod).sort().reverse()[0] || new Date().toISOString();
  const outPath = path.join(SITEMAP_DIR, 'sitemap-root.xml');
  writeXml(outPath, generateSitemapXml(entries));
  sitemapMeta.push({
    filename: 'sitemap-root.xml',
    loc: `${BASE_URL}/${SITEMAP_DIR}/sitemap-root.xml`,
    lastmod: sitemapLastmod
  });
}

// 3) write sitemap_index.xml at repo root
const indexPath = path.join(ROOT, 'sitemap_index.xml');
writeXml(indexPath, generateSitemapIndexXml(sitemapMeta.map(s => ({ loc: s.loc, lastmod: s.lastmod }))));

console.log('✅ Done. Generated', sitemapMeta.length, 'sitemaps and sitemap_index.xml');
