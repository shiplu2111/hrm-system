import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const WEBSITE_ROOT = path.resolve(import.meta.dirname, '..');
const NEXT_STATIC_DIR = path.join(WEBSITE_ROOT, '.next', 'static');
const SRC_DIR = path.join(WEBSITE_ROOT, 'src');

// Performance Budgets
const BUDGETS = {
  maxSingleJsChunkGzipBytes: 95 * 1024, // 95 KB gzip max for any single JS chunk
  maxTotalJsGzipBytes: 380 * 1024, // 380 KB gzip max across all client chunks
  maxSingleCssGzipBytes: 20 * 1024, // 20 KB gzip max for any single stylesheet
  maxTotalCssGzipBytes: 30 * 1024, // 30 KB gzip max total CSS
  minContrastRatioAA: 4.5,
};

function walkFiles(dir, extFilter, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkFiles(full, extFilter, out);
    } else if (!extFilter || extFilter.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

function formatKb(bytes) {
  return `${(bytes / 1024).toFixed(1)} KB`;
}

function relativeLuminance([r, g, b]) {
  const linear = [r, g, b].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

function contrastRatio(fg, bg) {
  const l1 = relativeLuminance(fg);
  const l2 = relativeLuminance(bg);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

function checkBundles() {
  if (!fs.existsSync(NEXT_STATIC_DIR)) {
    throw new Error(
      `Missing ${NEXT_STATIC_DIR}. Run "npm run build -w @hrm/website" before perf:budget.`,
    );
  }

  const jsFiles = walkFiles(path.join(NEXT_STATIC_DIR, 'chunks'), /\.js$/);
  const cssFiles = walkFiles(NEXT_STATIC_DIR, /\.css$/);

  if (jsFiles.length === 0) {
    throw new Error('No built JS chunks found in .next/static/chunks');
  }
  if (cssFiles.length === 0) {
    throw new Error('No built CSS files found in .next/static');
  }

  let totalJsGzip = 0;
  let largestJs = { file: '', raw: 0, gzip: 0 };

  for (const file of jsFiles) {
    const buf = fs.readFileSync(file);
    const gzip = zlib.gzipSync(buf, { level: 9 }).length;
    totalJsGzip += gzip;
    if (gzip > largestJs.gzip) {
      largestJs = { file: path.relative(WEBSITE_ROOT, file), raw: buf.length, gzip };
    }
  }

  let totalCssGzip = 0;
  let largestCss = { file: '', raw: 0, gzip: 0 };
  for (const file of cssFiles) {
    const buf = fs.readFileSync(file);
    const gzip = zlib.gzipSync(buf, { level: 9 }).length;
    totalCssGzip += gzip;
    if (gzip > largestCss.gzip) {
      largestCss = { file: path.relative(WEBSITE_ROOT, file), raw: buf.length, gzip };
    }
  }

  console.log('[perf:budget] Bundle sizes (gzip):', {
    jsChunks: jsFiles.length,
    totalJsGzip: formatKb(totalJsGzip),
    largestJsChunk: `${largestJs.file} (${formatKb(largestJs.gzip)} gzip / ${formatKb(largestJs.raw)} raw)`,
    cssFiles: cssFiles.length,
    totalCssGzip: formatKb(totalCssGzip),
    largestCssFile: `${largestCss.file} (${formatKb(largestCss.gzip)} gzip / ${formatKb(largestCss.raw)} raw)`,
  });

  if (largestJs.gzip > BUDGETS.maxSingleJsChunkGzipBytes) {
    throw new Error(
      `Performance budget exceeded: largest JS chunk ${largestJs.file} is ${formatKb(largestJs.gzip)} gzip (limit ${formatKb(BUDGETS.maxSingleJsChunkGzipBytes)})`,
    );
  }
  if (totalJsGzip > BUDGETS.maxTotalJsGzipBytes) {
    throw new Error(
      `Performance budget exceeded: total JS gzip is ${formatKb(totalJsGzip)} (limit ${formatKb(BUDGETS.maxTotalJsGzipBytes)})`,
    );
  }
  if (largestCss.gzip > BUDGETS.maxSingleCssGzipBytes) {
    throw new Error(
      `Performance budget exceeded: largest CSS file ${largestCss.file} is ${formatKb(largestCss.gzip)} gzip (limit ${formatKb(BUDGETS.maxSingleCssGzipBytes)})`,
    );
  }
  if (totalCssGzip > BUDGETS.maxTotalCssGzipBytes) {
    throw new Error(
      `Performance budget exceeded: total CSS gzip is ${formatKb(totalCssGzip)} (limit ${formatKb(BUDGETS.maxTotalCssGzipBytes)})`,
    );
  }
}

function checkA11yAndPerfGuards() {
  const nextConfig = fs.readFileSync(path.join(WEBSITE_ROOT, 'next.config.ts'), 'utf8');
  if (!nextConfig.includes('image/avif') || !nextConfig.includes('image/webp')) {
    throw new Error('next.config.ts must enable modern image formats (image/avif, image/webp)');
  }

  const globalsCss = fs.readFileSync(path.join(SRC_DIR, 'styles', 'globals.css'), 'utf8');
  if (!globalsCss.includes('prefers-reduced-motion: reduce')) {
    throw new Error('globals.css must include @media (prefers-reduced-motion: reduce) support');
  }

  // Parse semantic tokens and assert WCAG AA (>= 4.5:1) contrast on light surfaces
  const parseRgbToken = (name) => {
    const match = globalsCss.match(new RegExp(`${name}:\\s*(\\d+)\\s+(\\d+)\\s+(\\d+)\\s*;`));
    if (!match) {
      throw new Error(`Missing CSS token ${name} in globals.css`);
    }
    return [Number(match[1]), Number(match[2]), Number(match[3])];
  };

  const bgs = {
    '--bg-surface': parseRgbToken('--bg-surface'),
    '--bg-base': parseRgbToken('--bg-base'),
    '--bg-muted': parseRgbToken('--bg-muted'),
  };

  const fgs = [
    '--text-primary',
    '--text-secondary',
    '--text-muted',
    '--color-accent-600',
    '--color-success-600',
    '--color-warning-600',
    '--color-error-600',
  ];

  for (const fgName of fgs) {
    const fg = parseRgbToken(fgName);
    for (const [bgName, bg] of Object.entries(bgs)) {
      const ratio = contrastRatio(fg, bg);
      if (ratio < BUDGETS.minContrastRatioAA) {
        throw new Error(
          `WCAG AA contrast violation: ${fgName} on ${bgName} is ${ratio.toFixed(2)}:1 (< ${BUDGETS.minContrastRatioAA}:1)`,
        );
      }
    }
  }

  // Ensure all component images go through OptimizedImage (next/image), not raw <img>
  const sourceFiles = walkFiles(SRC_DIR, /\.(tsx|jsx)$/);
  for (const file of sourceFiles) {
    const content = fs.readFileSync(file, 'utf8');
    if (/<img\b/i.test(content)) {
      throw new Error(
        `Raw <img> found in ${path.relative(WEBSITE_ROOT, file)} — use OptimizedImage (next/image) instead`,
      );
    }
    if (/<script\b[^>]*\bsrc=/.test(content)) {
      throw new Error(
        `Raw external <script src=...> found in ${path.relative(WEBSITE_ROOT, file)} — use ConsentGatedScripts with next/script lazyOnload`,
      );
    }
  }

  console.log('[perf:budget] WCAG AA contrast, reduced-motion, image optimization, and script checks passed.');
}

checkBundles();
checkA11yAndPerfGuards();
