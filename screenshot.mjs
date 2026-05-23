import puppeteer from 'puppeteer';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCREENSHOT_DIR = path.join(__dirname, 'temporary screenshots');

const url = process.argv[2];
const label = process.argv[3];
const viewport = (process.argv[4] || 'desktop').toLowerCase();

const VIEWPORTS = {
  desktop: { width: 1440, height: 900, deviceScaleFactor: 2, isMobile: false },
  mobile: { width: 390, height: 844, deviceScaleFactor: 3, isMobile: true, hasTouch: true },
  tablet: { width: 834, height: 1112, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  og: { width: 1200, height: 630, deviceScaleFactor: 1, isMobile: false },
};

if (!url) {
  console.error('Usage: node screenshot.mjs <url> [label]');
  process.exit(1);
}

if (url.startsWith('file://')) {
  console.error('Refusing to screenshot a file:// URL. Serve via http://localhost:3000 instead.');
  process.exit(1);
}

if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

function nextScreenshotPath(label) {
  const files = fs.readdirSync(SCREENSHOT_DIR);
  let max = 0;
  for (const f of files) {
    const m = f.match(/^screenshot-(\d+)(?:-.*)?\.png$/);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  const n = max + 1;
  const suffix = label ? `-${label}` : '';
  return path.join(SCREENSHOT_DIR, `screenshot-${n}${suffix}.png`);
}

const outPath = nextScreenshotPath(label);

const vp = VIEWPORTS[viewport] || VIEWPORTS.desktop;

const browser = await puppeteer.launch({
  headless: 'new',
  defaultViewport: vp,
});

try {
  const page = await browser.newPage();
  await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });
  const fullPage = process.env.FULL !== '0';
  const scroll = parseInt(process.env.SCROLL || '0', 10);
  if (scroll > 0) {
    await page.evaluate((y) => {
      document.documentElement.style.scrollBehavior = 'auto';
      window.scrollTo({ top: y, behavior: 'instant' });
    }, scroll);
    await new Promise(r => setTimeout(r, 400));
  }
  await page.screenshot({ path: outPath, fullPage });
  console.log(outPath);
} catch (e) {
  console.error('Screenshot failed:', e.message);
  process.exitCode = 1;
} finally {
  await browser.close();
}
