import test from "node:test";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import fs from "node:fs/promises";

const VIEWPORTS = [280, 320, 360, 375, 390, 640, 768, 960, 1024, 1120, 1280, 1440, 1920];
const PAGES = [
  { name: "index", url: "http://localhost:8000/index.html" },
  { name: "login", url: "http://localhost:8000/login.html" }
];
const SCREENSHOT_DIR = "quality/tests/screenshots";
const ARTIFACT_DIR = process.env.ARTIFACT_DIR || null;

test("Responsive yatay tasma ve ekran goruntuleri testi", async (t) => {
  let playwright;
  try {
    playwright = await import("playwright");
  } catch {
    t.skip("Playwright kurulu olmadığından responsive taşma testi atlandı.");
    return;
  }
  const { chromium } = playwright;

  // Klasörleri oluştur
  await mkdir(SCREENSHOT_DIR, { recursive: true });
  if (ARTIFACT_DIR) {
    await mkdir(ARTIFACT_DIR, { recursive: true });
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  const overflowResults = [];

  for (const pageInfo of PAGES) {
    await t.test(`Sayfa: ${pageInfo.name}`, async (st) => {
      for (const width of VIEWPORTS) {
        await page.setViewportSize({ width, height: 900 });
        await page.goto(pageInfo.url, { waitUntil: "networkidle" });
        
        // Dikey scrollbar kaynaklı daralmayı ve yatay taşmayı kontrol et
        const overflow = await page.evaluate(() => {
          const documentWidth = document.documentElement.scrollWidth;
          const viewportWidth = window.innerWidth;
          return {
            hasOverflow: documentWidth > viewportWidth,
            scrollWidth: documentWidth,
            clientWidth: viewportWidth
          };
        });

        // Ekran goruntusu isimleri
        const filename = `${pageInfo.name}_${width}.png`;
        const localPath = join(SCREENSHOT_DIR, filename);
        const artifactPath = join(ARTIFACT_DIR, filename);

        await page.screenshot({ path: localPath });
        if (ARTIFACT_DIR) {
          const artifactPath = join(ARTIFACT_DIR, filename);
          await page.screenshot({ path: artifactPath });
        }

        if (overflow.hasOverflow) {
          overflowResults.push({
            page: pageInfo.name,
            viewport: width,
            scrollWidth: overflow.scrollWidth,
            clientWidth: overflow.clientWidth,
            diff: overflow.scrollWidth - overflow.clientWidth
          });
        }

        console.log(`[TEST] Page: ${pageInfo.name} | Viewport: ${width}px | Scroll: ${overflow.scrollWidth}px | Client: ${overflow.clientWidth}px | Overflow: ${overflow.hasOverflow ? 'EVET (' + (overflow.scrollWidth - overflow.clientWidth) + 'px)' : 'HAYIR'}`);
      }
    });
  }

  await browser.close();

  // Rapor dosyalarını yaz
  const reportPath = "quality/tests/overflow-report.json";
  await fs.writeFile(reportPath, JSON.stringify(overflowResults, null, 2), "utf8");

  if (ARTIFACT_DIR) {
    const artifactReportPath = join(ARTIFACT_DIR, "overflow-report.json");
    await fs.writeFile(artifactReportPath, JSON.stringify(overflowResults, null, 2), "utf8");
  }
});
