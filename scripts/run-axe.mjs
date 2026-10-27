import fs from "node:fs/promises";
import puppeteer from "puppeteer-core";
import axeCore from "axe-core";

const [, , targetUri, reportPath] = process.argv;

const navTimeoutEnv = Number.parseInt(process.env.A11Y_NAV_TIMEOUT_MS ?? "300000", 10);
const axeTimeoutEnv = Number.parseInt(process.env.AXE_RUN_TIMEOUT_MS ?? "180000", 10);
const NAV_TIMEOUT_MS = Number.isFinite(navTimeoutEnv) ? navTimeoutEnv : 300000;
const AXE_RUN_TIMEOUT_MS = Number.isFinite(axeTimeoutEnv) ? axeTimeoutEnv : 180000;

if (!targetUri || !reportPath) {
  console.error("Usage: node scripts/run-axe.mjs <target-uri> <report-path>");
  process.exit(1);
}

const chromePath = process.env.CHROME_PATH;
if (!chromePath) {
  console.error("CHROME_PATH must be set to a Chrome/Chromium executable.");
  process.exit(1);
}

const chromeUserDataDir = process.env.CHROME_USER_DATA_DIR;
const launchArgs = ["--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage"];
if (chromeUserDataDir) {
  launchArgs.push(`--user-data-dir=${chromeUserDataDir}`);
}

const browser = await puppeteer.launch({
  executablePath: chromePath,
  headless: true,
  args: launchArgs,
});

try {
  const page = await browser.newPage();
  page.on("dialog", dialog => dialog.dismiss());
  page.setDefaultNavigationTimeout(NAV_TIMEOUT_MS);
  let hitNavigationTimeout = false;
  try {
    await page.goto(targetUri, { waitUntil: "domcontentloaded", timeout: NAV_TIMEOUT_MS });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!message.includes("Navigation timeout")) {
      throw error;
    }
    hitNavigationTimeout = true;
    console.warn(`Navigation timed out after ${NAV_TIMEOUT_MS}ms, proceeding with current DOM state.`);
  }

  if (!hitNavigationTimeout) {
    try {
      await page.waitForNetworkIdle({ idleTime: 500, timeout: 15000 });
    } catch {
      // Some generated pages never become fully idle due to timers/background work.
    }
  }

  try {
    await page.waitForFunction(() => document.readyState !== "loading", { timeout: 10000 });
  } catch {
    // Best-effort only; continue to axe injection.
  }

  await page.evaluate(axeCore.source);
  const result = await Promise.race([
    page.evaluate(async () => globalThis.axe.run({
      runOnly: {
        type: "tag",
        values: ["wcag2a", "wcag2aa", "wcag2aaa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"],
      },
    })),
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`axe.run timeout after ${AXE_RUN_TIMEOUT_MS}ms`)), AXE_RUN_TIMEOUT_MS);
    })
  ]);
  await fs.writeFile(reportPath, JSON.stringify(result, null, 2), "utf8");
} finally {
  await browser.close();
}
