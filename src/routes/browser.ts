/**
 * Browser Rendering Routes
 *
 * Uses Cloudflare Browser Rendering (Puppeteer) to:
 * - Search the web via DuckDuckGo and extract results
 * - Navigate to URLs and extract page content
 * - Provide real web access to HYDRA agents
 */

import { Hono } from "hono";
import puppeteer from "@cloudflare/puppeteer";

interface BrowserEnv {
  AI: any;
  BROWSER: any;
}

const browser = new Hono<{ Bindings: BrowserEnv }>();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function fetchPageContent(
  env: BrowserEnv,
  url: string,
  opts?: { waitFor?: string; timeout?: number }
): Promise<{ title: string; text: string; url: string }> {
  const instance = await puppeteer.launch(env.BROWSER);
  const page = await instance.newPage();

  try {
    await page.setViewport({ width: 1280, height: 720 });
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
    );

    await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: opts?.timeout ?? 15000,
    });

    if (opts?.waitFor) {
      await page.waitForSelector(opts.waitFor, { timeout: 5000 }).catch(() => {});
    }

    const title = await page.title();

    const text = await page.evaluate(() => {
      const remove = document.querySelectorAll(
        "script, style, nav, header, footer, iframe, noscript, svg, [role='banner'], [role='navigation']"
      );
      remove.forEach((el) => el.remove());
      const body = document.body;
      if (!body) return "";
      return (body.innerText || body.textContent || "")
        .replace(/\n{3,}/g, "\\n\\n")
        .replace(/[ \\t]+/g, " ")
        .trim()
        .slice(0, 8000);
    });

    return { title, text, url: page.url() };
  } finally {
    await page.close();
    await instance.close();
  }
}

interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

async function webSearch(env: BrowserEnv, query: string, numResults = 5): Promise<SearchResult[]> {
  // Use fetchPageContent on DDG Lite and parse text results - no CSS selectors needed
  const searchUrl = `https://lite.duckduckgo.com/lite/?q=${encodeURIComponent(query)}`;
  const page = await fetchPageContent(env, searchUrl, { timeout: 15000 });
  const text = page.text;
  const items: SearchResult[] = [];
  // DDG Lite format: numbered results with title, snippet, and URL on separate lines
  const lines = text.split("\n").map((l: string) => l.trim()).filter((l: string) => l);
  for (let i = 0; i < lines.length && items.length < numResults; i++) {
    // Match numbered results like "1. Title" or just find URLs
    const numMatch = lines[i].match(/^(\d+)\.\s+(.+)/);
    if (numMatch) {
      const title = numMatch[2];
      let snippet = "";
      let url = "";
      // Next lines contain snippet and URL
      for (let j = i + 1; j < Math.min(i + 5, lines.length); j++) {
        const line = lines[j];
        if (line.match(/^https?:\/\//)) { url = line; break; }
        if (line.match(/^\w+\.\w+/)) { url = "https://" + line.split(" ")[0].split("\t")[0]; break; }
        if (!snippet && line.length > 20 && !line.match(/^\d+\./)) { snippet = line.slice(0, 300); }
      }
      if (title && url) {
        items.push({ title, url, snippet });
      }
    }
  }
  return items;
}
browser.post("/search", async (c) => {
  const ai = (c.env as any).AI;
  if (!c.env.BROWSER) return c.json({ error: "BROWSER binding not configured" }, 503);
  let body: { query?: string; detailed?: boolean };
  try { body = await c.req.json(); } catch { return c.json({ error: "Invalid JSON body" }, 400); }
  if (!body.query) return c.json({ error: "query required" }, 400);
  const startTime = Date.now();
  try {
    const results = await webSearch(c.env, body.query, 5);
    if (results.length === 0) return c.json({ query: body.query, results: [], answer: "No search results found.", timing: Date.now() - startTime });
    let topPageContent = "";
    if (body.detailed && results[0]) { try { const p = await fetchPageContent(c.env, results[0].url, { timeout: 10000 }); topPageContent = `\\n\\nContent from ${results[0].title}:\\n${p.text.slice(0, 4000)}`; } catch {} }
    const searchContext = results.map((r, i) => `[${i + 1}] ${r.title}\\n    ${r.url}\\n    ${r.snippet}`).join("\\n\\n");
    let answer = "";
    if (ai){ try { const r = await ai.run("@cf/meta/llama-3.3-70b-instruct-fp8-fast", { messages: [{ role: "system", content: "You are a web search assistant. Based on the search results provided, give a concise and accurate answer. Cite sources by number [1], [2], etc." }, { role: "user", content: `Query: ${body.query}\\n\\nSearch Results:\\n${searchContext}${topPageContent}` }], max_tokens: 1024 }); answer = r.response || ""; } catch { answer = "LOM summarization failed."; } }
    return c.json({ query: body.query, results, answer, timing: Date.now() - startTime });
  } catch (e: any) { return c.json({ error: "Search failed", detail: e.message }, 502); }
});

browser.post("/browse", async (c) => {
  if (!c.env.BROWSER) return c.json({ error: "BROWSER binding not configured" }, 503);
  let body: { url?: string; waitFor?: string };
  try { body = await c.req.json(); } catch { return c.json({ error: "Invalid JSON body" }, 400); }
  if (!body.url) return c.json({ error: "url required" }, 400);
  try { new URL(body.url); } catch { return c.json({ error: "Invalid URL" }, 400); }
  const startTime = Date.now();
  try {
    const result = await fetchPageContent(c.env, body.url, { waitFor: body.waitFor, timeout: 15000 });
    return c.json({ ...result, timing: Date.now() - startTime });
  } catch (e: any) { return c.json({ error: "Browse failed", detail: e.message }, 502); }
});

browser.get("/status", (c) => {
  return c.json({ available: !!c.env.BROWSER, provider: "cloudflare-browser-rendering", capabilities: ["search", "browse", "screenshot"] });
});

export { browser, webSearch, fetchPageContent };
