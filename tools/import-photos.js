/* ============================================================================
   GymBuddy — tools/import-photos.js
   ----------------------------------------------------------------------------
   Replaces a stock exercise photograph with one you took yourself, and rebuilds
   the looping demonstration from it.

   This exists because of a licensing fact rather than a technical one. The
   exercises in this edition describe Technogym machines, but Technogym's
   product photography is theirs and is not licensed for redistribution, so the
   pictures that ship here are generic commercial-gym equivalents from a
   public-domain library. The movement is right; the machine in the picture is
   not the one in your gym.

   The fix is a phone and five minutes. Photograph each machine yourself — you
   are allowed to photograph equipment you are using — and this turns those
   photographs into the same photo-plus-clip pair the build pipeline produces.

       # one exercise, two photos: the start and the finish of the rep
       node tools/import-photos.js leg-press start.jpg end.jpg

       # a whole folder, named <exercise-id>-start.jpg / <exercise-id>-end.jpg
       node tools/import-photos.js --dir ~/gym-photos

       # file them under a brand, so only that brand's users see them
       node tools/import-photos.js --brand technogym --dir ~/technogym-photos

   Shoot both frames from the same spot, ideally on a tripod or propped against
   something: the clip cross-fades between them, and a camera that moved between
   shots reads as a jump rather than as a rep.

   Needs Playwright's Chromium (for the canvas work) and the ffmpeg build that
   ships with it, exactly as tools/build-media.js does.
   ============================================================================ */

const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const ROOT = path.join(__dirname, "..");
const FFMPEG = process.env.FFMPEG_PATH || "ffmpeg";
const MAP = require("./media-map.json");

/* Same rep timing as the main build, so an imported clip is indistinguishable
   in rhythm from a generated one. */
const FPS = 25, HOLD_START = 11, CONCENTRIC = 4, HOLD_END = 7, ECCENTRIC = 8;

function usage(msg) {
  if (msg) console.error(msg + "\n");
  console.error(`Usage:
  node tools/import-photos.js [--brand <id>] <exercise-id> <start.jpg> <end.jpg>
  node tools/import-photos.js [--brand <id>] --dir <folder>   (expects <id>-start.jpg / <id>-end.jpg)

  --brand files the photographs under that brand only, so a gym kitted out by
  someone else keeps the shared pictures. Without it they replace the shared
  set for everybody.

Known exercise ids are the keys of tools/media-map.json (${Object.keys(MAP).length} of them).`);
  process.exit(2);
}

function knownId(id) {
  if (Object.prototype.hasOwnProperty.call(MAP, id)) return true;
  const near = Object.keys(MAP).filter(k => k.includes(id) || id.includes(k)).slice(0, 5);
  console.error(`Unknown exercise id "${id}"${near.length ? ` — did you mean: ${near.join(", ")}?` : ""}`);
  return false;
}

/** Every (id, startPath, endPath) the arguments ask for. */
function collectJobs(argv) {
  if (argv[0] === "--dir") {
    const dir = argv[1];
    if (!dir || !fs.existsSync(dir)) usage("--dir needs a folder that exists.");
    const jobs = [];
    fs.readdirSync(dir).forEach(f => {
      const m = f.match(/^(.+)-start\.(jpe?g|png)$/i);
      if (!m) return;
      const id = m[1];
      const end = fs.readdirSync(dir).find(x => new RegExp(`^${id}-end\\.(jpe?g|png)$`, "i").test(x));
      if (!end) { console.warn(`  skipped ${id}: found a start frame but no matching -end`); return; }
      jobs.push({ id, start: path.join(dir, f), end: path.join(dir, end) });
    });
    if (!jobs.length) usage(`No <id>-start.<ext> / <id>-end.<ext> pairs found in ${dir}.`);
    return jobs;
  }
  const [id, start, end] = argv;
  if (!id || !start || !end) usage();
  return [{ id, start, end }];
}

async function main() {
  let argv = process.argv.slice(2);
  let brand = null;
  const bi = argv.indexOf("--brand");
  if (bi !== -1) {
    brand = argv[bi + 1];
    if (!brand) usage("--brand needs a brand id, e.g. technogym.");
    argv = argv.slice(0, bi).concat(argv.slice(bi + 2));
  }

  const jobs = collectJobs(argv).filter(j => knownId(j.id));
  if (!jobs.length) process.exit(2);

  jobs.forEach(j => [j.start, j.end].forEach(f => {
    if (!fs.existsSync(f)) usage(`Missing image: ${f}`);
  }));

  let chromium;
  try { ({ chromium } = require("playwright")); }
  catch (e) { console.error("Needs Playwright: npm i playwright"); process.exit(2); }
  const browser = await chromium.launch(
    process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  const page = await browser.newPage();

  const photoDir = path.join(ROOT, "assets/photos", brand || "");
  const clipDir = path.join(ROOT, "assets/clips", brand || "");
  fs.mkdirSync(photoDir, { recursive: true });
  fs.mkdirSync(clipDir, { recursive: true });

  let done = 0;
  const imported = [];
  for (const job of jobs) {
    const a = fs.readFileSync(job.start).toString("base64");
    const b = fs.readFileSync(job.end).toString("base64");
    const out = await renderFrames(page, a, b);
    fs.writeFileSync(path.join(photoDir, `${job.id}.jpg`), out.poster);
    encodeWebm(out.frames, path.join(clipDir, `${job.id}.webm`));
    imported.push(job.id);
    done++;
    console.log(`  ${job.id} — photo and clip rebuilt from your own frames`);
  }
  await browser.close();

  if (brand) updateManifest(brand, imported);

  console.log(`\n${done} exercise${done === 1 ? "" : "s"} imported.`);
  console.log("Check them with:  node tools/contact-sheet.js && open tools/contact-sheet.html");
  if (done && brand) {
    console.log(`\njs/data/brand-photos.js now lists these under "${brand}", so only a`);
    console.log("profile set to that brand sees them. Everyone else keeps the shared set.");
  } else if (done) {
    console.log("\nOnce every machine in your gym is your own photograph, drop the");
    console.log("`library.photoProvenance` line from the dictionaries — it will no");
    console.log("longer be telling the truth.");
  }
}

/**
 * Record which exercises a brand now has its own photographs for.
 *
 * The site is static and cannot ask whether a file exists, so this list is how
 * it knows — an id in here is served from the brand folder, anything else
 * falls back to the shared set. Rewritten rather than appended so a deleted
 * photograph disappears from the list too.
 */
function updateManifest(brand, ids) {
  const file = path.join(ROOT, "js/data/brand-photos.js");
  const src = fs.readFileSync(file, "utf8");
  const dir = path.join(ROOT, "assets/photos", brand);
  const onDisk = fs.existsSync(dir)
    ? fs.readdirSync(dir).filter(f => f.endsWith(".jpg")).map(f => f.replace(/\.jpg$/, "")).sort()
    : [];
  const listed = onDisk.map(id => `    ${JSON.stringify(id)},`).join("\n");
  const block = `  ${JSON.stringify(brand)}: [\n${listed}\n  ],`;
  /* The key may be written quoted or bare; match either so a second import
     replaces the entry instead of adding a duplicate that shadows it. */
  const re = new RegExp(`  (?:"${brand}"|${brand}): \\[[^\\]]*\\],`);
  const next = re.test(src) ? src.replace(re, block)
                            : src.replace(/const BRAND_PHOTOS = \{/, `const BRAND_PHOTOS = {\n${block}`);
  fs.writeFileSync(file, next);
  console.log(`  manifest: ${onDisk.length} photograph${onDisk.length === 1 ? "" : "s"} under "${brand}"`);
}

/* Identical to the pipeline in build-media.js: the canvas does the decode,
   resize and JPEG encode, and ffmpeg only muxes the frames into VP8. */
async function renderFrames(page, aB64, bB64) {
  const result = await page.evaluate(async ({ aB64, bB64, HOLD_START, CONCENTRIC, HOLD_END, ECCENTRIC }) => {
    const load = src => new Promise((res, rej) => {
      const img = new Image(); img.onload = () => res(img); img.onerror = rej; img.src = src;
    });
    const a = await load("data:image/jpeg;base64," + aB64);
    const b = await load("data:image/jpeg;base64," + bB64);

    const W = 420, H = Math.round(a.height * (W / a.width));
    const cv = document.createElement("canvas");
    cv.width = W; cv.height = H - (H % 2);
    const g = cv.getContext("2d");
    const ease = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

    const frame = alpha => {
      g.globalAlpha = 1; g.drawImage(a, 0, 0, cv.width, cv.height);
      if (alpha > 0) { g.globalAlpha = alpha; g.drawImage(b, 0, 0, cv.width, cv.height); }
      g.globalAlpha = 1;
      return cv.toDataURL("image/jpeg", 0.9).split(",")[1];
    };

    const frames = [];
    for (let i = 0; i < HOLD_START; i++) frames.push(frame(0));
    for (let i = 1; i <= CONCENTRIC; i++) frames.push(frame(ease(i / CONCENTRIC)));
    for (let i = 0; i < HOLD_END; i++) frames.push(frame(1));
    for (let i = 1; i <= ECCENTRIC; i++) frames.push(frame(1 - ease(i / ECCENTRIC)));

    const pv = document.createElement("canvas");
    pv.width = 640; pv.height = Math.round(a.height * (640 / a.width));
    pv.getContext("2d").drawImage(a, 0, 0, pv.width, pv.height);
    return { frames, poster: pv.toDataURL("image/jpeg", 0.82).split(",")[1] };
  }, { aB64, bB64, HOLD_START, CONCENTRIC, HOLD_END, ECCENTRIC });

  return {
    frames: result.frames.map(f => Buffer.from(f, "base64")),
    poster: Buffer.from(result.poster, "base64"),
  };
}

function encodeWebm(frames, outPath) {
  execFileSync(FFMPEG, [
    "-y", "-hide_banner", "-loglevel", "error",
    "-f", "image2pipe", "-c:v", "mjpeg", "-r", String(FPS), "-i", "pipe:0",
    "-c:v", "libvpx", "-b:v", "260k", "-crf", "32", "-an", "-loop", "0", outPath,
  ], { input: Buffer.concat(frames), stdio: ["pipe", "ignore", "inherit"] });
}

main().catch(e => { console.error(e); process.exit(1); });
