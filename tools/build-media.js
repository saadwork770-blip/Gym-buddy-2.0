/* ============================================================================
   GymBuddy 2.0 — tools/build-media.js
   ----------------------------------------------------------------------------
   Builds the exercise media from free-exercise-db (public domain, Unlicense).

   For each exercise it produces two files:

     assets/photos/<id>.jpg   a 640px still, normally of the start position
                              (see the `poster` override in media-map.json)
     assets/clips/<id>.webm   a ~1.2s looping demonstration

   The clip is assembled from the source's two frames — start and end position —
   with a short eased cross-fade between them and holds at each end, timed like
   a real rep: a fast concentric, a brief squeeze, a slower eccentric. It is an
   animation built from two photographs, not filmed video, and the interface
   says so.

   Why the pipeline looks like this: Chromium does the image work (decode,
   resize, blend, encode) because it is already installed for the audit and
   needs no image library; ffmpeg only muxes the JPEG frames into VP8. The
   result is about 60% smaller than the equivalent GIF and much smoother.

       node tools/build-media.js            # everything
       node tools/build-media.js leg-press  # one exercise
   ============================================================================ */

const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const ROOT = path.join(__dirname, "..");
const DB_URL = "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json";
const IMG_BASE = "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises";
const FFMPEG = process.env.FFMPEG_PATH || "ffmpeg";
const CACHE = path.join(__dirname, ".media-cache");

/* Rep timing, in frames at 25fps. Transitions are kept short: a cross-fade
   between two photographs ghosts, and the shorter it is the more it reads as
   motion blur rather than double exposure. */
const FPS = 25, HOLD_START = 11, CONCENTRIC = 4, HOLD_END = 7, ECCENTRIC = 8;

const MAP = require("./media-map.json");

async function main() {
  const only = process.argv[2];
  const ids = Object.keys(MAP).filter(id => !only || id === only);
  if (!ids.length) { console.error(`Unknown exercise: ${only}`); process.exit(1); }

  fs.mkdirSync(CACHE, { recursive: true });
  fs.mkdirSync(path.join(ROOT, "assets/photos"), { recursive: true });
  fs.mkdirSync(path.join(ROOT, "assets/clips"), { recursive: true });

  const db = await loadDb();
  const byName = Object.fromEntries(db.map(e => [e.name, e]));

  let chromium;
  try { ({ chromium } = require("playwright")); }
  catch (e) { console.error("Needs Playwright: npm i playwright"); process.exit(2); }
  const browser = await chromium.launch(
    process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  const page = await browser.newPage();

  let built = 0, failed = [];
  for (const id of ids) {
    const spec = typeof MAP[id] === "string" ? { source: MAP[id] } : MAP[id];
    const entry = byName[spec.source];
    if (!entry || (entry.images || []).length < 2) { failed.push(`${id}: no source images`); continue; }
    try {
      const [a, b] = await Promise.all(entry.images.slice(0, 2).map(fetchImage));
      const out = await renderFrames(page, a, b, spec.poster === "end");
      fs.writeFileSync(path.join(ROOT, "assets/photos", `${id}.jpg`), out.poster);
      encodeWebm(out.frames, path.join(ROOT, "assets/clips", `${id}.webm`));
      built++;
      process.stdout.write(`  ${String(built).padStart(2)}/${ids.length}  ${id.padEnd(32)} ` +
        `${(fs.statSync(path.join(ROOT, "assets/clips", `${id}.webm`)).size / 1024).toFixed(0)} KB\n`);
    } catch (e) { failed.push(`${id}: ${e.message}`); }
  }
  await browser.close();

  console.log(`\n${built} built, ${failed.length} failed`);
  failed.forEach(f => console.log("  " + f));
  process.exit(failed.length ? 1 : 0);
}

async function loadDb() {
  const cached = path.join(CACHE, "exercises.json");
  if (!fs.existsSync(cached)) {
    console.log("Fetching the exercise database…");
    fs.writeFileSync(cached, await get(DB_URL));
  }
  return JSON.parse(fs.readFileSync(cached, "utf8"));
}

async function fetchImage(rel) {
  const cached = path.join(CACHE, rel.replace(/\//g, "__"));
  if (!fs.existsSync(cached)) fs.writeFileSync(cached, await get(`${IMG_BASE}/${rel}`));
  return fs.readFileSync(cached).toString("base64");
}

function get(url) {
  return new Promise((resolve, reject) => {
    require("https").get(url, res => {
      if (res.statusCode >= 300 && res.headers.location) return get(res.headers.location).then(resolve, reject);
      if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
      const chunks = [];
      res.on("data", c => chunks.push(c));
      res.on("end", () => resolve(Buffer.concat(chunks)));
    }).on("error", reject);
  });
}

/* All the image work happens inside the page: canvas gives us decode, resize,
   alpha compositing and JPEG encoding without pulling in an image library. */
async function renderFrames(page, aB64, bB64, posterFromEnd) {
  const result = await page.evaluate(async ({ aB64, bB64, posterFromEnd, FPS, HOLD_START, CONCENTRIC, HOLD_END, ECCENTRIC }) => {
    const load = src => new Promise((res, rej) => {
      const img = new Image(); img.onload = () => res(img); img.onerror = rej; img.src = src;
    });
    const a = await load("data:image/jpeg;base64," + aB64);
    const b = await load("data:image/jpeg;base64," + bB64);

    const W = 420, H = Math.round(a.height * (W / a.width));
    const cv = document.createElement("canvas");
    cv.width = W; cv.height = H - (H % 2);          // VP8 wants even dimensions
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

    /* The still is normally the start position, which is what you set up
       into. For an isometric hold that is wrong: the "start" of a plank is
       kneeling on the floor, which is a photograph of nothing. Those entries
       ask for the end frame instead. */
    const still = posterFromEnd ? b : a;
    const pv = document.createElement("canvas");
    pv.width = 640; pv.height = Math.round(still.height * (640 / still.width));
    pv.getContext("2d").drawImage(still, 0, 0, pv.width, pv.height);
    return { frames, poster: pv.toDataURL("image/jpeg", 0.82).split(",")[1] };
  }, { aB64, bB64, posterFromEnd: !!posterFromEnd, FPS, HOLD_START, CONCENTRIC, HOLD_END, ECCENTRIC });

  return {
    frames: result.frames.map(f => Buffer.from(f, "base64")),
    poster: Buffer.from(result.poster, "base64"),
  };
}

/* ffmpeg here is only a muxer: JPEG frames in, VP8/WebM out. This build of it
   has no image decoders beyond mjpeg, which is exactly what canvas emits. */
function encodeWebm(frames, outPath) {
  execFileSync(FFMPEG, [
    "-y", "-hide_banner", "-loglevel", "error",
    "-f", "image2pipe", "-c:v", "mjpeg", "-framerate", String(FPS), "-i", "pipe:0",
    "-c:v", "libvpx", "-b:v", "0", "-crf", "36", "-an", "-pix_fmt", "yuv420p",
    "-metadata", "title=GymBuddy exercise demonstration",
    outPath,
  ], { input: Buffer.concat(frames), stdio: ["pipe", "ignore", "inherit"] });
}

main().catch(e => { console.error(e); process.exit(1); });
