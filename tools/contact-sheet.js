/* ============================================================================
   GymBuddy 2.0 — tools/contact-sheet.js
   ----------------------------------------------------------------------------
   Writes tools/contact-sheet.html: every exercise in the library shown as its
   name, the source entry the media came from, its still and its clip, side by
   side in one scrollable page.

   This exists because reading media-map.json proves nothing. The mapping can
   be plausible on paper and wrong on screen — a "Bulgarian Split Squat" that
   is really a reverse lunge, a "Plank" still that is a photograph of someone
   kneeling on the floor — and the only way to catch that is to look at all of
   them at once. Sixty-six images take about two minutes to scan, and the last
   two passes found three genuine mismatches between them.

       node tools/contact-sheet.js && open tools/contact-sheet.html
   ============================================================================ */

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const MAP = require("./media-map.json");

const source = fs.readFileSync(path.join(ROOT, "js/data.js"), "utf8");
const names = {};
source.replace(/id:\s*"([^"]+)",\s*name:\s*"([^"]+)"/g, (_, id, name) => { names[id] = name; return _; });

const rows = Object.keys(MAP).map(id => {
  const spec = typeof MAP[id] === "string" ? { source: MAP[id] } : MAP[id];
  return {
    id, name: names[id] || id, source: spec.source,
    poster: spec.poster === "end" ? " · still from the end position" : "",
    photo: `../assets/photos/${id}.jpg`,
    clip: `../assets/clips/${id}.webm`,
    missing: !fs.existsSync(path.join(ROOT, "assets/photos", `${id}.jpg`)),
  };
});

const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>GymBuddy media contact sheet</title>
<style>
  body{ background:#faf9f7; color:#16150f; margin:0; padding:20px;
        font:14px/1.4 system-ui,-apple-system,"Segoe UI",sans-serif; }
  h1{ font-size:19px; margin:0 0 4px; }
  p.lede{ color:#585349; margin:0 0 20px; max-width:70ch; }
  .grid{ display:grid; grid-template-columns:repeat(auto-fill,minmax(230px,1fr)); gap:14px; }
  figure{ margin:0; background:#fff; border:1px solid #ddd9d0; border-radius:8px; overflow:hidden; }
  .media{ display:grid; grid-template-columns:1fr 1fr; background:#f2f0ec; }
  img,video{ width:100%; height:150px; object-fit:contain; display:block; background:#fff; }
  figcaption{ padding:8px 10px; }
  b{ display:block; font-size:13px; }
  span{ display:block; color:#6b6559; font-size:11.5px; margin-top:2px; }
  .missing{ border-color:#c0392b; }
  .missing b::after{ content:" — no photo"; color:#c0392b; }
</style></head><body>
<h1>Media contact sheet — ${rows.length} exercises</h1>
<p class="lede">Left: the still shown in the exercise list. Right: the looping clip.
Under each name is the free-exercise-db entry it was built from. Read the name,
look at the picture, and check they are the same movement.</p>
<div class="grid">
${rows.map(r => `  <figure class="${r.missing ? "missing" : ""}">
    <div class="media">
      <img src="${r.photo}" alt="" loading="lazy">
      <video src="${r.clip}" autoplay loop muted playsinline></video>
    </div>
    <figcaption><b>${r.name}</b><span>${r.source}${r.poster}</span></figcaption>
  </figure>`).join("\n")}
</div>
</body></html>`;

fs.writeFileSync(path.join(__dirname, "contact-sheet.html"), html);
console.log(`tools/contact-sheet.html — ${rows.length} exercises, ` +
            `${rows.filter(r => r.missing).length} missing a photo`);
