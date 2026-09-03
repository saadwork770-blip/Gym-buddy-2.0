/* ============================================================================
   GymBuddy — tools/import-photos.js
   ----------------------------------------------------------------------------
   Replaces a stock exercise photograph with photographs you took yourself of
   your own gym's machine, and builds a short walk-around clip from them.

   This exists because of two honesty problems, one about the machine and one
   about the demonstration, and both have the same fix.

   The pictures that ship here come from a public-domain library of generic
   commercial-gym equipment, not from any particular gym — the movement is
   right, but the exact machine in the picture may not be the one you use.
   And the clip built from just two of those stock photos is a cross-fade
   between a start and end position, not real footage — useful for showing a
   rep, useless for showing what the machine actually looks like from the
   angles you'd recognize it by.

   The fix for both is a phone and five minutes. Photograph the machine from
   two or more angles — you are allowed to photograph equipment you are using
   — and this turns those photographs into a short, silent, looping clip that
   walks around it, replacing the stock photo and clip for everybody.

       # one exercise, two or more angles, in the order they should play
       node tools/import-photos.js leg-press front.jpg side.jpg angle.jpg

       # a whole folder, named <exercise-id>-1.jpg, <exercise-id>-2.jpg, ...
       node tools/import-photos.js --dir ~/gym-photos

   Shoot from a few steps apart rather than panning while filming — each shot
   is a still, and the clip cross-fades between them, so a real pan just reads
   as motion blur rather than as a walk-around. Two photos still works fine
   (start/end of a rep, or just front/side of the machine); more reads better.

   Needs Playwright's Chromium (for the canvas work) and the ffmpeg build that
   ships with it, exactly as tools/build-media.js does.
   ============================================================================ */

const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const ROOT = path.join(__dirname, "..");
const FFMPEG = process.env.FFMPEG_PATH || "ffmpeg";
const MAP = require("./media-map.json");

/* A stop on each photo, then an eased cross-fade into the next — including
   the last photo back to the first, so the loop has no seam. Independent of
   how many photos there are: three angles plays the same tempo as two, just
   longer end to end. */
const FPS = 25, HOLD = 10, TRANSITION = 6;

function usage(msg) {
  if (msg) console.error(msg + "\n");
  console.error(`Usage:
  node tools/import-photos.js <exercise-id> <photo1.jpg> <photo2.jpg> [photo3.jpg ...]
  node tools/import-photos.js --dir <folder>   (expects <id>-1.jpg, <id>-2.jpg, ...)

At least two photos; there is no ceiling on more.

Known exercise ids are the keys of tools/media-map.json (${Object.keys(MAP).length} of them).`);
  process.exit(2);
}

function knownId(id) {
  if (Object.prototype.hasOwnProperty.call(MAP, id)) return true;
  const near = Object.keys(MAP).filter(k => k.includes(id) || id.includes(k)).slice(0, 5);
  console.error(`Unknown exercise id "${id}"${near.length ? ` — did you mean: ${near.join(", ")}?` : ""}`);
  return false;
}

/** Every (id, [photo paths in play order]) the arguments ask for. */
function collectJobs(argv) {
  if (argv[0] === "--dir") {
    const dir = argv[1];
    if (!dir || !fs.existsSync(dir)) usage("--dir needs a folder that exists.");
    const files = fs.readdirSync(dir);
    const byId = {};
    files.forEach(f => {
      const m = f.match(/^(.+)-(\d+)\.(jpe?g|png)$/i);
      if (!m) return;
      (byId[m[1]] || (byId[m[1]] = [])).push({ n: Number(m[2]), file: f });
    });
    const jobs = Object.entries(byId).map(([id, list]) => ({
      id, photos: list.sort((a, b) => a.n - b.n).map(x => path.join(dir, x.file)),
    })).filter(j => {
      if (j.photos.length >= 2) return true;
      console.warn(`  skipped ${j.id}: only one numbered photo found, need at least two`);
      return false;
    });
    if (!jobs.length) usage(`No <id>-1.<ext>, <id>-2.<ext>, ... sets found in ${dir}.`);
    return jobs;
  }
  const [id, ...photos] = argv;
  if (!id || photos.length < 2) usage();
  return [{ id, photos }];
}

async function main() {
  const argv = process.argv.slice(2);
  const jobs = collectJobs(argv).filter(j => knownId(j.id));
  if (!jobs.length) process.exit(2);

  jobs.forEach(j => j.photos.forEach(f => {
    if (!fs.existsSync(f)) usage(`Missing image: ${f}`);
  }));

  let chromium;
  try { ({ chromium } = require("playwright")); }
  catch (e) { console.error("Needs Playwright: npm i playwright"); process.exit(2); }
  const browser = await chromium.launch(
    process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  const page = await browser.newPage();

  const photoDir = path.join(ROOT, "assets/photos");
  const clipDir = path.join(ROOT, "assets/clips");
  fs.mkdirSync(photoDir, { recursive: true });
  fs.mkdirSync(clipDir, { recursive: true });

  let done = 0;
  for (const job of jobs) {
    const photosB64 = job.photos.map(f => fs.readFileSync(f).toString("base64"));
    const out = await renderFrames(page, photosB64);
    fs.writeFileSync(path.join(photoDir, `${job.id}.jpg`), out.poster);
    encodeWebm(out.frames, path.join(clipDir, `${job.id}.webm`));
    done++;
    console.log(`  ${job.id} — photo and clip rebuilt from your ${job.photos.length} own frame${job.photos.length === 1 ? "" : "s"}`);
  }
  await browser.close();

  console.log(`\n${done} exercise${done === 1 ? "" : "s"} imported.`);
  console.log("Check them with:  node tools/contact-sheet.js && open tools/contact-sheet.html");
  if (done) {
    console.log("\nOnce every machine in your gym is your own photograph, drop the");
    console.log("`library.photoProvenance` line from the dictionaries — it will no");
    console.log("longer be telling the truth.");
  }
}

/* Identical spirit to the pipeline in build-media.js — the canvas does the
   decode, resize and JPEG encode, and ffmpeg only muxes the frames into VP8
   — generalized from exactly two photographs to a walk-around of however
   many were given: a stop on each, an eased cross-fade into the next, and
   the last one fades back into the first so the loop closes without a jump. */
async function renderFrames(page, photosB64) {
  const result = await page.evaluate(async ({ photosB64, HOLD, TRANSITION }) => {
    const load = src => new Promise((res, rej) => {
      const img = new Image(); img.onload = () => res(img); img.onerror = rej; img.src = src;
    });
    const images = await Promise.all(photosB64.map(b64 => load("data:image/jpeg;base64," + b64)));

    const first = images[0];
    const W = 420, H = Math.round(first.height * (W / first.width));
    const cv = document.createElement("canvas");
    cv.width = W; cv.height = H - (H % 2);
    const g = cv.getContext("2d");
    const ease = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

    const frame = (from, to, alpha) => {
      g.globalAlpha = 1; g.drawImage(from, 0, 0, cv.width, cv.height);
      if (alpha > 0) { g.globalAlpha = alpha; g.drawImage(to, 0, 0, cv.width, cv.height); }
      g.globalAlpha = 1;
      return cv.toDataURL("image/jpeg", 0.9).split(",")[1];
    };

    const frames = [];
    images.forEach((img, i) => {
      const next = images[(i + 1) % images.length];
      for (let k = 0; k < HOLD; k++) frames.push(frame(img, next, 0));
      for (let k = 1; k <= TRANSITION; k++) frames.push(frame(img, next, ease(k / TRANSITION)));
    });

    const pv = document.createElement("canvas");
    pv.width = 640; pv.height = Math.round(first.height * (640 / first.width));
    pv.getContext("2d").drawImage(first, 0, 0, pv.width, pv.height);
    return { frames, poster: pv.toDataURL("image/jpeg", 0.82).split(",")[1] };
  }, { photosB64, HOLD, TRANSITION });

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
