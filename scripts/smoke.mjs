/**
 * Drives the browser smoke check and prints its report.
 *
 * The check itself is `scripts/smoke-browser.ts`, loaded by `/smoke.html`. It has to run
 * in a browser — mil-sym-ts measures text with a canvas and degrades silently without a
 * `document`, so a Node assertion would pass while proving nothing. This script is only
 * the driver: it finds a Chrome, loads that page with `--dump-dom`, and strips the markup
 * off the report the page wrote into its `<pre>`.
 *
 * Usage: `npm run dev` in one terminal, `npm run smoke` in another.
 * Override the URL with `SMOKE_URL`, the browser with `CHROME`.
 */
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";

const URL_ = process.env.SMOKE_URL ?? "http://localhost:5173/smoke.html";

const CANDIDATES = [
  process.env.CHROME,
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
].filter(Boolean);

const chrome = CANDIDATES.find((path) => existsSync(path));
if (!chrome) {
  console.error("No Chrome or Edge found. Set CHROME to the executable.");
  process.exit(2);
}

const dom = execFileSync(
  chrome,
  [
    "--headless=new",
    "--disable-gpu",
    "--no-sandbox",
    // The page renders a few thousand catalog rows and a couple of hundred symbols
    // before it writes its report; without a budget the DOM is dumped mid-run.
    "--virtual-time-budget=60000",
    "--dump-dom",
    URL_,
  ],
  { encoding: "utf8", maxBuffer: 64 * 1024 * 1024, stdio: ["ignore", "pipe", "ignore"] },
);

const body = dom.match(/<pre id="out">([\s\S]*?)<\/pre>/);
if (!body) {
  console.error(`No report in the page at ${URL_}. Is \`npm run dev\` running?`);
  process.exit(2);
}
const report = body[1]
  .replace(/&lt;/g, "<")
  .replace(/&gt;/g, ">")
  .replace(/&quot;/g, '"')
  .replace(/&#39;/g, "'")
  .replace(/&amp;/g, "&");
console.log(report);
process.exit(report.includes("ALL CHECKS PASSED") ? 0 : 1);
