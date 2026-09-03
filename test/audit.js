/* ============================================================================
   GymBuddy 2.0 — test/audit.js
   ----------------------------------------------------------------------------
   A browser audit of the built site: accessibility, keyboard navigation,
   colour contrast, load performance, storage growth, XSS handling, responsive
   layout, and console/network errors — run against both languages.

   Needs a static server and Playwright's Chromium:

       python3 -m http.server 8099 &
       node test/audit.js [http://localhost:8099]

   Set CHROMIUM_PATH to use a browser you already have instead of letting
   Playwright download its own.

   It is deliberately separate from engine.test.js: that suite tests the
   coaching logic with no browser, this one tests the thing people actually use.
   ============================================================================ */

const BASE = process.argv[2] || "http://localhost:8099";
const PAGES = ["index", "program", "workout", "coach", "progress", "exercises", "profile"];

let chromium;
try { ({ chromium } = require("playwright")); }
catch (e) {
  console.error("This audit needs Playwright:  npm i playwright\n" +
                "The coaching-engine tests (node test/engine.test.js) have no dependencies.");
  process.exit(2);
}

const findings = [];
const log = (...a) => console.log(a.join(" "));
const fail = msg => { findings.push(msg); console.log("  ✗ " + msg); };
const pass = msg => console.log("  ✓ " + msg);

/* A profile with six weeks of logged training, so the audit exercises real
   populated pages rather than empty states. */
const SEED = () => {
  localStorage.clear();
  const p = Store.createProfile({ name: "Audit Athlete", sex: "Male", age: 30,
    heightCm: 178, weightKg: 114, goal: "Fat loss", level: "Some experience" });
  Store.updateProfile(p.id, { createdAt: Date.now() - 42 * 86400000 });
  Store.updateSettings(p.id, { trainingDays: ["mon", "tue", "thu", "fri"] });
  const idx = { mon: 0, tue: 1, wed: 2, thu: 3, fri: 4, sat: 5, sun: 6 };
  for (let w = 5; w >= 0; w--) {
    Store.getPlan(p.id).sessions.forEach(s => {
      const now = new Date(), ti = (now.getDay() + 6) % 7;
      const d = new Date(now); d.setDate(now.getDate() - ti - (w * 7) + idx[s.dayKey]);
      if (d > now) return;
      const ss = Store.startSession(p.id, s.dayKey, null); if (!ss) return;
      ss.date = d.toISOString().slice(0, 10);
      ss.startedAt = d.getTime() - 68 * 60000;
      ss.sets = [];
      ss.blocks.forEach(b => { for (let i = 0; i < b.sets; i++) {
        const r = Math.random();
        const reps = r < 0.72 ? b.repHi : (r < 0.93 ? b.repHi - 1 : b.repLo);
        ss.sets.push({ exerciseId: b.exerciseId, setIndex: i, weight: b.weight, reps, rpe: 8, done: true });
      }});
      Store.completeSession(p.id, ss);
    });
    Store.addWeightEntry(p.id, 114 - (5 - w) * 0.7);
  }
};

/* Runs in the page. Composites every background layer from the element itself
   upward — a button carrying its own background is not sitting on the page
   background, and skipping that produces a page of false failures. */
const CONTRAST = () => {
  const lum = c => { const [r, g, b] = c.map(v => { v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
  const parse = s => { const m = String(s).match(/rgba?\(([^)]+)\)/); if (!m) return null;
    const q = m[1].split(",").map(parseFloat);
    return { c: q.slice(0, 3), a: q.length > 3 ? q[3] : 1 }; };
  const over = (f, b) => f.c.map((v, i) => v * f.a + b[i] * (1 - f.a));
  const ratio = (a, b) => { const l1 = lum(a), l2 = lum(b);
    return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05); };
  const pageBg = (parse(getComputedStyle(document.body).backgroundColor) || { c: [14, 16, 19] }).c;

  const out = [], seen = new Set();
  document.querySelectorAll("p,span,div,b,i,h1,h2,h3,h4,a,button,label,td,th,li,summary,figcaption,legend,small")
    .forEach(el => {
      const txt = el.textContent.trim();
      if (!txt || [...el.children].some(c => c.textContent.trim())) return;
      const cs = getComputedStyle(el);
      if (cs.visibility === "hidden" || cs.display === "none") return;
      const fg = parse(cs.color); if (!fg) return;

      const stack = []; let n = el, gradient = false;
      while (n) { const c2 = getComputedStyle(n);
        if (c2.backgroundImage && c2.backgroundImage !== "none") { gradient = true; break; }
        const q = parse(c2.backgroundColor); if (q && q.a > 0) stack.push(q);
        n = n.parentElement; }
      if (gradient) return;                     // cannot sample a gradient reliably
      let bg = pageBg;
      for (let i = stack.length - 1; i >= 0; i--) bg = over(stack[i], bg);

      const size = parseFloat(cs.fontSize), bold = +cs.fontWeight >= 700;
      const need = (size >= 24 || (size >= 18.66 && bold)) ? 3 : 4.5;
      const r = ratio(over(fg, bg), bg);
      const key = cs.color + "|" + size + "|" + (el.className || el.tagName);
      if (seen.has(key)) return; seen.add(key);
      if (r < need) out.push({ ratio: +r.toFixed(2), need, color: cs.color, size,
        cls: String(el.className || el.tagName).split(" ").slice(0, 2).join("."), txt: txt.slice(0, 24) });
    });
  return out;
};

/* Everything that only goes wrong when the thing pointing at the page is a
   finger. Run under touch emulation, because the rules that fix these are
   keyed to `pointer: coarse` rather than to a width. */
const TOUCH = () => {
  const out = { zoomers: [], smallTargets: [], squeezed: [] };
  const vw = document.documentElement.clientWidth;
  const seen = new Set();
  const name = el => `${el.tagName.toLowerCase()}.${String(el.className || "").split(" ")[0]}`;

  document.querySelectorAll("input, select, textarea").forEach(el => {
    const cs = getComputedStyle(el);
    if (cs.display === "none" || cs.visibility === "hidden") return;
    /* Under 16px, iOS Safari zooms the page in on focus and does not zoom
       back out — mid-set, on the field you just tapped. */
    const fs = parseFloat(cs.fontSize);
    if (fs < 16 && !seen.has("z" + name(el))) { seen.add("z" + name(el)); out.zoomers.push(`${name(el)} ${fs}px`); }
  });

  document.querySelectorAll('a[href], button, input, select, textarea, summary, [role="tab"]').forEach(el => {
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    if (!r.width || !r.height || cs.visibility === "hidden") return;
    // A checkbox is drawn at 16px by the browser; its label carries the target.
    const label = el.closest("label");
    const lr = label && label.getBoundingClientRect();
    if (lr && lr.height >= 43.5 && lr.width >= 43.5) return;
    if ((r.height < 43.5 || r.width < 43.5) && !seen.has("t" + name(el))) {
      seen.add("t" + name(el));
      out.smallTargets.push(`${name(el)} ${Math.round(r.width)}x${Math.round(r.height)}`);
    }
  });

  /* Text squeezed into a column too narrow for it — the "one word per line"
     collapse a flex row causes when a nowrap sibling takes the width. */
  document.querySelectorAll("h1,h2,h3,h4,p,span,b,div,td,label,summary").forEach(el => {
    if (el.children.length) return;
    const text = (el.textContent || "").trim();
    if (text.length < 18 || !/\s/.test(text)) return;
    const r = el.getBoundingClientRect();
    if (!r.height || r.width >= 160) return;
    const lh = parseFloat(getComputedStyle(el).lineHeight) || 20;
    const lines = Math.round(r.height / lh);
    if (lines >= 3 && text.split(/\s+/).length / lines < 1.6) {
      out.squeezed.push(`${name(el)} ${Math.round(r.width)}px over ${lines} lines — "${text.slice(0, 30)}"`);
    }
  });

  out.overflow = document.documentElement.scrollWidth - vw;
  return out;
};

const A11Y = () => {
  const issues = [];
  document.querySelectorAll("img").forEach(i => {
    if (!i.hasAttribute("alt")) issues.push("image without alt: " + i.src.split("/").pop());
  });
  document.querySelectorAll("button, a").forEach(el => {
    const name = (el.textContent || "").trim() || el.getAttribute("aria-label") || el.getAttribute("title");
    if (!name) issues.push(`${el.tagName.toLowerCase()} with no accessible name (.${el.className || el.id})`);
  });
  document.querySelectorAll("input:not([type=hidden]), select, textarea").forEach(el => {
    const labelled = (el.id && document.querySelector(`label[for="${CSS.escape(el.id)}"]`))
      || el.closest("label") || el.getAttribute("aria-label") || el.getAttribute("aria-labelledby");
    if (!labelled) issues.push("unlabelled field: " + (el.id || el.className));
  });
  const levels = [...document.querySelectorAll("h1,h2,h3,h4")].map(h => +h.tagName[1]);
  let prev = 0, jumps = 0;
  levels.forEach(l => { if (prev && l > prev + 1) jumps++; prev = l; });
  if (jumps) issues.push(`${jumps} heading-level jump(s)`);
  if (!levels.length) issues.push("no headings");
  if (!document.querySelector("main")) issues.push("no <main> landmark");
  if (!document.documentElement.getAttribute("lang")) issues.push("no lang on <html>");
  if (!document.documentElement.getAttribute("dir")) issues.push("no dir on <html>");
  return { issues, headings: levels.length, images: document.querySelectorAll("img").length };
};

(async () => {
  /* Honour an explicit browser path so this runs against a preinstalled
     Chromium rather than requiring `npx playwright install`. */
  const browser = await chromium.launch(
    process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
  const jsErrors = [], netFails = [];
  page.on("pageerror", e => jsErrors.push(`${page.url().split("/").pop()}: ${e.message}`));
  page.on("console", m => { if (m.type() === "error") jsErrors.push(`${page.url().split("/").pop()}: ${m.text()}`); });
  page.on("requestfailed", r => netFails.push(`${r.url()}: ${r.failure().errorText}`));
  page.on("response", r => { if (r.status() >= 400 && !/favicon/.test(r.url())) netFails.push(`${r.status()} ${r.url()}`); });

  await page.goto(`${BASE}/program.html`);
  await page.evaluate(SEED);

  for (const lang of ["en", "ar"]) {
    log(`\n=== ${lang === "ar" ? "ARABIC (RTL)" : "ENGLISH (LTR)"} ===`);
    await page.goto(`${BASE}/index.html`);
    await page.evaluate(l => localStorage.setItem("gymbuddy_lang", l), lang);

    log("\nAccessibility");
    for (const name of PAGES) {
      await page.goto(`${BASE}/${name}.html`);
      await page.waitForTimeout(550);
      const a = await page.evaluate(A11Y);
      if (a.issues.length) fail(`${name}: ${a.issues.slice(0, 4).join(" | ")}`);
      else pass(`${name} — ${a.headings} headings, ${a.images} images, landmarks and lang/dir present`);
    }

    log("\nColour contrast (WCAG AA: 4.5:1 body, 3:1 large)");
    let contrastFails = 0;
    for (const name of PAGES) {
      await page.goto(`${BASE}/${name}.html`);
      await page.waitForTimeout(450);
      const bad = await page.evaluate(CONTRAST);
      bad.slice(0, 5).forEach(c => { contrastFails++;
        fail(`${name}: ${c.ratio}:1 (needs ${c.need}) — ${c.color} at ${c.size}px on .${c.cls} "${c.txt}"`); });
    }
    if (!contrastFails) pass("every sampled text/background pair passes AA");

    log("\nResponsive layout");
    for (const [w, h, label] of [[360, 740, "small phone"], [390, 844, "phone"],
                                 [768, 1024, "tablet"], [1440, 900, "desktop"]]) {
      const p2 = await browser.newPage({ viewport: { width: w, height: h } });
      await p2.goto(`${BASE}/index.html`);
      await p2.evaluate(l => localStorage.setItem("gymbuddy_lang", l), lang);
      let worst = 0, culprit = "";
      for (const name of PAGES) {
        await p2.goto(`${BASE}/${name}.html`);
        await p2.waitForTimeout(400);
        const r = await p2.evaluate(() => {
          const docW = document.documentElement.clientWidth;
          const wide = [...document.querySelectorAll("*")]
            .filter(el => { const b = el.getBoundingClientRect(); return b.width > docW + 1 || b.right > docW + 1; })
            .map(el => String(el.className || el.tagName).split(" ")[0]);
          return { over: document.documentElement.scrollWidth - docW, wide: wide.slice(0, 2) };
        });
        if (r.over > worst) { worst = r.over; culprit = `${name} (${r.wide.join(", ")})`; }
      }
      if (worst > 1) fail(`${label} ${w}px: ${worst}px horizontal overflow — ${culprit}`);
      else pass(`${label} ${w}px: no horizontal overflow on any page`);
      await p2.close();
    }
  }

  log("\n=== MOBILE (touch emulation) ===");
  for (const lang of ["en", "ar"]) {
    for (const [w, h, dpr, label] of [[375, 667, 2, "iPhone SE"], [412, 915, 2.6, "Android phone"]]) {
      const ctx = await browser.newContext({
        viewport: { width: w, height: h }, deviceScaleFactor: dpr,
        isMobile: true, hasTouch: true, reducedMotion: "reduce",
      });
      const mp = await ctx.newPage();
      await mp.goto(`${BASE}/index.html`);
      await mp.evaluate(l => localStorage.setItem("gymbuddy_lang", l), lang);
      await mp.evaluate(SEED);

      const zoomers = new Set(), targets = new Set(), squeezed = new Set();
      let overflow = 0, culprit = "";
      for (const name of PAGES) {
        await mp.goto(`${BASE}/${name}.html`);
        await mp.waitForTimeout(420);
        const r = await mp.evaluate(TOUCH);
        r.zoomers.forEach(x => zoomers.add(`${name}: ${x}`));
        r.smallTargets.forEach(x => targets.add(`${name}: ${x}`));
        r.squeezed.forEach(x => squeezed.add(`${name}: ${x}`));
        if (r.overflow > overflow) { overflow = r.overflow; culprit = name; }
      }
      const tag = `${label} · ${lang}`;
      if (overflow > 1) fail(`${tag}: ${overflow}px horizontal overflow on ${culprit}`);
      else pass(`${tag}: no page scrolls sideways`);
      if (zoomers.size) fail(`${tag}: form controls under 16px, which makes iOS zoom in on focus — ${[...zoomers].slice(0, 3).join("; ")}`);
      else pass(`${tag}: every form control is at least 16px, so tapping one does not zoom the page`);
      if (targets.size) fail(`${tag}: touch targets under 44px — ${[...targets].slice(0, 4).join("; ")}`);
      else pass(`${tag}: every control is at least 44px in both directions`);
      if (squeezed.size) fail(`${tag}: text squeezed into a narrow column — ${[...squeezed].slice(0, 3).join("; ")}`);
      else pass(`${tag}: no text collapsed into a one-word-per-line column`);
      await ctx.close();
    }
  }

  log("\n=== SHARED ===");
  log("\nKeyboard navigation");
  await page.goto(`${BASE}/program.html`); await page.waitForTimeout(450);
  await page.keyboard.press("Tab");
  const firstStop = await page.evaluate(() => (document.activeElement.textContent || "").trim());
  if (/skip/i.test(firstStop) || /تخطَّ/.test(firstStop)) pass(`first Tab reaches the skip link ("${firstStop}")`);
  else fail(`first Tab reaches "${firstStop}", expected a skip link`);

  await page.goto(`${BASE}/exercises.html`); await page.waitForTimeout(450);
  await page.locator(".ex-card").first().press("Enter");
  await page.waitForSelector(".modal-overlay");
  const inside = await page.evaluate(() => !!document.activeElement.closest(".modal-overlay"));
  await page.keyboard.press("Escape");
  await page.waitForTimeout(200);
  const closed = await page.evaluate(() => !document.querySelector(".modal-overlay"));
  if (inside && closed) pass("dialogs open by keyboard, take focus, and close on Escape");
  else fail(`dialog keyboard handling — focus moved inside: ${inside}, Escape closed: ${closed}`);

  log("\nPerformance");
  for (const name of ["index", "program", "exercises"]) {
    const p3 = await browser.newPage();
    await p3.goto(`${BASE}/${name}.html`, { waitUntil: "load" });
    const m = await p3.evaluate(() => {
      const n = performance.getEntriesByType("navigation")[0];
      const r = performance.getEntriesByType("resource");
      return { load: Math.round(n.loadEventEnd), reqs: r.length,
               kb: Math.round(r.reduce((s, x) => s + (x.transferSize || 0), 0) / 1024) };
    });
    if (m.load > 2000) fail(`${name}: ${m.load}ms load`);
    else pass(`${name}: ${m.load}ms load, ${m.reqs} requests, ${m.kb} KB`);
    await p3.close();
  }

  log("\nStorage");
  const storage = await page.evaluate(() => {
    const key = "gymbuddy_profiles_v2";
    const good = localStorage.getItem(key);
    localStorage.setItem(key, "{ not json");
    let survives;
    try { survives = Store.listProfiles().length === 0; } catch (e) { survives = "threw: " + e.message; }
    localStorage.setItem(key, good);
    const p = Store.getActiveProfile();
    const perSession = p.sessionLog.length
      ? JSON.stringify(p.sessionLog).length / p.sessionLog.length / 1024 : 0;
    return { survives, kb: Math.round(new Blob([good]).size / 1024),
             sessions: p.sessionLog.length, perSession: Math.round(perSession * 10) / 10 };
  });
  if (storage.survives === true) pass("corrupt local storage degrades to an empty profile list, no crash");
  else fail(`corrupt local storage: ${storage.survives}`);
  const years = Math.round(5120 / (storage.perSession * 4 * 52) * 10) / 10;
  pass(`${storage.kb} KB after ${storage.sessions} sessions (${storage.perSession} KB each — about ${years} years of 4x/week before a 5 MB quota)`);

  log("\nInjection");
  await page.evaluate(() => {
    const p = Store.getActiveProfile();
    Store.updateProfile(p.id, { name: '<img src=x onerror="window.__xss=1">' });
  });
  await page.goto(`${BASE}/profile.html`); await page.waitForTimeout(600);
  const xss = await page.evaluate(() => !!window.__xss);
  if (xss) fail("stored script payload EXECUTED — output is not escaped");
  else pass("script payload in a profile name renders as inert text");
  await page.evaluate(() => {
    const p = Store.getActiveProfile();
    Store.updateProfile(p.id, { name: "Audit Athlete" });
  });

  log("\nErrors");
  const errs = [...new Set(jsErrors)];
  if (errs.length) errs.slice(0, 6).forEach(e => fail("JS error — " + e));
  else pass("no JavaScript errors on any page, in either language");
  const nets = [...new Set(netFails)];
  if (nets.length) nets.slice(0, 6).forEach(n => fail("request failed — " + n));
  else pass("no failed network requests");

  await browser.close();
  log("\n" + "=".repeat(60));
  log(findings.length ? `${findings.length} finding(s)` : "Clean — no findings.");
  process.exit(findings.length ? 1 : 0);
})();
