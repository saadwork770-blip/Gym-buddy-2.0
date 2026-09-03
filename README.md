# GymBuddy 2.0

An adaptive training companion built from a real training plan —
**"4-Day Fat Loss Program — Fitness Time (Standard Commercial Gym)."**

Version 1 turned that plan into a browsable website. Version 2.0 keeps every bit
of that — the full program, the exercise library with real gym photographs and
animated demonstrations, the local profile — and puts a coaching engine
underneath it.

The engine does four things the static version could not:

1. **It picks your weights.** Not a fixed number printed on a page: the load for
   your next session is derived from the reps and effort you logged in the last
   one, and rounded to what the machine can actually select.
2. **It rebuilds your week around the days you can train.** Choose one to six
   days and it re-selects the split, re-orders the sessions so overlapping
   muscle work lands as far apart as the week allows, and re-sizes each session
   to the time you have.
3. **It changes the workouts.** Stalled lifts, missing equipment, a joint that
   hurts, volume above what you can recover from — each triggers a specific,
   explained modification that you accept or reject. Between blocks it rotates
   the program on its own, keeping your main lifts long enough to get strong at
   them and varying the work around them.
4. **It knows when you have been away.** Come back after five weeks and it
   brings the loads down and the effort ceiling with them, rather than handing
   you the bar you left with the word "increase" on it.

It runs in **English and Arabic**, with full right-to-left layout — including
the coaching prose, which is generated from your training data rather than
written in advance.

The library is **66 exercises**, every one with a real gym photograph and a
silent looping demonstration.

It is still a static site. No build step, no dependencies, no server, no
account. Everything you log stays in your browser.

---

## The coaching engine

Each module is a plain script under `js/engine/`. None of it is a black box:
every recommendation carries the numbers that produced it, and the interface
shows them.

### `progression.js` — what weight goes on next time

Four mechanisms combine:

| Mechanism | What it does |
|---|---|
| **Double progression** | Climb to the top of the rep range on every set, *then* add load. The safest default, and the one that runs when effort data is missing. |
| **RPE autoregulation** | How hard the last session felt decides the **size** of the jump. Three sets at RPE 6.5 earns a double increment; the same reps ground out at RPE 9 earns the smallest increment the equipment has. |
| **Effort-adjusted 1RM** | Every set becomes an estimated one-rep max using Epley plus the reps you left in reserve. One number, comparable across rep ranges — which is what plateau detection actually runs on. |
| **Mesocycle waving** | Volume and effort ramp across loading weeks, then a scheduled deload dumps fatigue before it becomes a stall. |
| **Detraining** | Time off costs strength, so coming back costs load. A break of eleven days or more brings the weight down on a curve — 5% at a fortnight, 25% past four months — and holds the effort ceiling down for one to three sessions while you climb back. |

Details that matter in a real gym:

- **Loads are rounded to the equipment.** A selectorised stack moves in 5 kg
  pins, a cable stack in 2.5, dumbbells in pairs. The engine never asks for a
  weight you cannot select, and where rounding would cancel a reduction it steps
  a full increment instead — so a deload is never secretly the same weight.
- **Assisted machines run backwards.** On an assisted pull-up machine the number
  on the stack is *help*. Progress means taking weight off, and strength is
  tracked as bodyweight minus assistance, so needing less help reads as getting
  stronger rather than weaker.
- **Warm-up ramps** are generated for compounds (roughly 45% / 70% / 87%).
- **Barbell work shows the plate maths** — what actually goes on each side.
- **A weight you set yourself is not overwritten.** Manual overrides hold until
  you log a session on them; progression then resumes from your number.
- **Coming back from a break is not "increase".** Two different gaps are read
  separately: a *layoff*, where training stopped and real strength is gone, and
  *movement rust*, where you kept training but this particular lift has not come
  up for a month and only the groove is missing. The first takes a percentage
  off and lowers the RPE ceiling; the second takes one honest step. A break of a
  fortnight or more also restarts the mesocycle, so nobody walks back in to
  "week 4 · deload".
- **Starting loads can be measured instead of guessed.** Without help, the first
  weight on every bar comes from bodyweight, sex and a three-way experience
  dropdown whose middle option covers a lifter who benches 60 kg and one who
  benches 110. The Profile page's **Starting loads** tab takes one honest set on
  each main lift and seeds those from your own numbers; the ratio between what
  you lift and what the formula predicted carries to the rest, halved and
  clamped, because strength transfers between movements but not one for one.

### `scheduler.js` — the week

Four stages:

1. **Pick the split** from day count, experience and goal.
   One day → Full Body. Two → Full Body A/B. Three → Full Body A/B/C, or
   Push/Pull/Legs for an advanced lifter. Four → Upper/Lower x2 (your original
   plan). Five → Upper/Lower + PPL. Six → PPL x2.
2. **Place the sessions.** Every arrangement is scored on muscle overlap divided
   by the days between sessions, with a penalty for stacking two high-fatigue
   days back to back. With at most six sessions there are 720 arrangements, so
   it checks all of them rather than guessing.
3. **Fill the slots.** Templates are written as movement *patterns*, not fixed
   exercises. Each slot is filled with a real lift that respects your equipment,
   your pain flags and what you did last week — and every substitution comes
   with a sentence saying why. From the second block onward the template's own
   pick is a strong opinion rather than a veto, weighed against a per-block
   rotation draw, how much technique the movement demands against your
   experience, and what your goal actually needs. Each slot rotates on its own
   staggered clock — four blocks for a main lift, three for an accessory — so a
   new block changes about a third of the program rather than all of it, and a
   lift you are supposed to get strong at stays put long enough to measure.
4. **Fit the time and add cardio.** Sessions over your budget are trimmed
   finishers-first, protecting the main compounds. Cardio is dosed by goal and
   attached to training and rest days.

**With four days selected and default settings, your first block reproduces the
original Fitness Time program exactly, exercise for exercise.** There is a test
that asserts it. Rotation starts from the second block: the engine has not
earned the right to redesign a plan it has never watched you run.

### `periodization.js` — the calendar

A mesocycle of loading weeks closed by a planned deload (four weeks by default,
configurable 3–6). Loading weeks raise the RPE ceiling from 7.5 to 9; the deload
cuts volume to ~55% and load by ~10%. Every other engine asks it what week it is
before deciding anything.

Volume also **ramps across the block**: week 1 runs your program exactly as
prescribed, and the weeks after it add sets toward each muscle's adaptive volume
— onto accessory work first, since a fourth set of a cable movement costs far
less recovery than a fourth set of a heavy compound for the same entry in the
tally. The ramp only ever adds. Week 1 is never quietly cut down in the name of
periodisation, so the program you chose is the program you get.

### `adaptation.js` — changing the workouts

- **Substitutions** ranked by movement pattern first, then primary muscle,
  filtered by your equipment and pain flags.
- **Plateau detection** — a stall is two or more sessions without progress *and*
  a flat estimated-1RM trend. One hard session is not a plateau, and treating it
  like one is how people end up program-hopping.
- **Volume proposals** against the weekly landmarks (see below): which exercise
  gains or loses a set, and what that does to the muscle's weekly total.
- **Schedule proposals** from attendance. If you keep skipping Thursday and
  keep turning up on Wednesday, it offers to move the session — the plan should
  follow your week, not the other way round.

Everything here returns a *proposal* with a reason and an apply button. Nothing
rewrites your program behind your back.

### `analysis.js` — reading across sessions

Progression looks at one exercise's last session. This module looks across
exercises and across weeks, and answers what a coach standing next to you would
be asking. Every function is evidence-gated: silence is the correct output for a
log with three sessions in it.

| What it finds | How |
|---|---|
| **Strength imbalances** | Opposing patterns compared on *relative* strength — each lift scored against what someone of this bodyweight and experience should handle on it. Raw kilos are meaningless across patterns: a leg press moves two to three times a squat. Only raised when the weaker side has actually stalled or fallen behind expectation, because loads move in the increments the equipment has and a 20 kg stack climbing 5 kg gains 25% while a 100 kg press gains 5%. |
| **Accumulated fatigue** | Three signals over a fortnight: is the same work costing more RPE, are prescribed reps still being hit, has measured strength flattened. Two of three agreeing means the block has run its course ahead of the calendar — and the coach offers to bring the deload forward rather than grind three more weeks into it. |
| **Collapsing sets** | Reps falling more than ~30% from first set to last, sustained across sessions. Under that is normal fatigue. Above it, the fix is either load or rest — and the coach suggests rest first, because it is the cheaper one and usually the answer. |
| **Forecasting** | A least-squares projection to the next meaningful milestone, with R². Only shown when the line actually fits (R² ≥ 0.4) and the target is worth naming — "+0.8 kg, four days away" is noise dressed as insight. |
| **Session ordering** | Fatiguing accessory work placed ahead of the lift a session is built around. Cheap to check, easy to fix, and nobody notices it themselves. |

### `coach.js` — the voice

Reads all of the above, ranks it by consequence rather than category, and writes
it in plain language. Also produces the live per-set cues, the end-of-session
debrief, and the readiness scoring.

---

## Volume landmarks

Weekly hard sets per muscle are counted through a contribution table — a chest
press credits chest a full set and front delts and triceps a half set each — and
compared against four thresholds per muscle:

- **MV** maintenance volume — holds what you have
- **MEV** minimum effective volume — the floor for growth
- **MAV** adaptive volume — the productive middle
- **MRV** maximum recoverable volume — the ceiling

Anything above MRV is trimmed automatically before the plan is handed over
(isolation work first, compounds protected). Anything below MEV is flagged with
a specific fix. A six-day split can otherwise stack shoulders to nearly 40 sets
a week, which buys fatigue rather than muscle.

---

## Bodyweight is a bad instrument on its own

For a fat-loss goal the scale is the noisiest possible measure of whether the
plan is working. It moves with water, glycogen, salt and the hour of the day,
and it can sit still for a fortnight while the body underneath it changes shape
— which is the fortnight most people decide the diet has failed and stop.

So the Profile page logs a waist measurement alongside it, and optionally hips
for the waist-to-hip ratio. The pairing is the point. The coach reports a flat
scale with a falling waist as the good news it is and stands the stalled-scale
warning down rather than letting two cards argue; it also flags the reverse —
the scale falling while the waist holds — which is what an over-aggressive
deficit looks like and which nobody volunteers.

## The exercise library

66 movements, each with a photograph and a **silent looping demonstration**.

Version 2.0 shipped with 29 photographed exercises and 10 more that only had a
line drawing. That was enough for the original four-day machine program and not
much else — a plateau swap or a pain flag had nowhere to go, and the barbell
patterns were missing entirely. The library now covers every main pattern with
free-weight, machine and bodyweight options: the pull-up family, barbell squat,
deadlift and bench, unilateral work, and enough choice in each pattern that the
coach can always find a substitute.

**The demonstrations are built, not filmed.** `tools/build-media.js` takes the
source's two frames — start and end position — and assembles a ~1.2 second loop:
a hold at the bottom, a fast concentric, a brief squeeze, a slower eccentric.
The transitions are kept short deliberately, because a cross-fade between two
photographs ghosts, and the shorter it is the more it reads as motion blur
rather than double exposure. It is an animation from two stills, and the
interface says so rather than implying footage that does not exist.

```bash
node tools/build-media.js               # rebuild everything
node tools/build-media.js leg-press     # or one exercise
```

The pipeline uses tools already in the repo rather than adding dependencies:
Chromium does the image work (decode, resize, alpha compositing, JPEG encoding)
because it is already installed for the audit, and ffmpeg only muxes the frames
into VP8. Output is **WebM, about 45 KB per clip** — roughly 60% smaller than
the equivalent GIF, smoother, and now covering 66 exercises instead of 29.
Total media is 6.0 MB against the old 5.3 MB: slightly larger overall, for a
library more than twice the size. Per exercise it halved, from about 183 KB to
about 91 KB.

WebM support is broad but not universal (Safari 2021, iOS 2022), so the video is
feature-detected once and the photograph is used on its own where it is missing —
rather than shipping a `<video>` that renders as an empty box. In the library
grid a clip is only fetched on first hover; loading sixty of them up front would
be megabytes for nothing.

---

## Arabic and right-to-left

The whole app runs in Arabic: navigation, settings, the exercise library's form
cues, and — the part that actually took the work — the coaching engine's own
sentences.

**Why that is not just a string table.** The engine writes things like *"You hit
the top of the range on every set — 12/12/12 at 40 kg"* out of live numbers. If
those sentences were assembled as English text and stored, they could never be
translated. So the engines emit **message objects** instead — a key plus its
parameters — and rendering happens at display time:

```js
{ k: "engine.prog.increase", p: { reps: "12/12/12", from: ref("load", 40, "chest-press-machine"), … } }
```

Two consequences worth having:

- A reason stored months ago renders in whichever language you are reading
  **today**. Switching language re-renders your entire training history rather
  than leaving a trail of English inside an Arabic interface.
- Names inside those sentences are stored as **references**, not text. "Hack
  Squat Machine replaces Leg Press" is `ref("ex", …)` on both sides, resolved at
  render time — so the exercise names translate too, not just the sentence
  around them.

**Bidirectional text is handled explicitly.** Arabic training prose is full of
Latin-script numbers and units — "45 kg", "RPE 8.5", "12/12/12" — and without
isolation the bidi algorithm drags digits and punctuation to the wrong end of a
phrase. Every interpolated raw value is wrapped in a First Strong Isolate;
translated prose deliberately is **not**, because an Arabic phrase beginning
with a formatted number carries a left-to-right mark that would flip the whole
phrase. Directional arrows follow the language: `45 → 50` in English,
`45 ← 50` in Arabic.

**Other decisions:**

- **Western digits in both languages.** Arabic-Indic numerals are correct for
  literary Arabic, but the plates and machine stacks in the room are printed in
  Western digits, and a training app that disagrees with the equipment is not
  being helpful.
- **"RPE" and "1RM" stay in Latin script.** That is what is printed on coaching
  apps and said on the gym floor; translating them would be more faithful and
  less useful.
- **Arabic's six plural categories** are wired through `Intl.PluralRules`, so
  the dual is right: *أمس* / *قبل يومين* / *قبل 3 أيام*, not "قبل 2 أيام".
- **No web fonts.** The site makes zero external requests and works offline, so
  Arabic uses the system faces that ship with every major OS, with the scale and
  leading nudged up — Arabic glyphs sit smaller than Latin at the same point
  size. Uppercasing is switched off in Arabic: it is a no-op that only breaks
  letter joining.
- **The layout mirrors, it does not just right-align.** Progress bars fill from
  the right, the coloured edge of a card moves to its other side, disclosure
  carets point the other way, and the hero gradient flips. Numbers, clocks and
  number inputs stay left-to-right, because a time read right-to-left is a
  different time.

The language switcher sits in the header. Your choice is remembered; with no
choice saved, the browser's own preference decides.

---

## Audit

`node test/audit.js` drives the built site in a real browser and checks it in
**both languages**: accessibility, keyboard navigation, colour contrast, load
performance, storage growth, XSS handling, responsive layout at four widths, and
console/network errors.

```bash
python3 -m http.server 8099 &
node test/audit.js            # needs playwright; CHROMIUM_PATH to reuse a browser
```

It currently reports clean. Getting there fixed these:

| Finding | Fix |
|---|---|
| `--text-faint` measured **3.46:1** — under the 4.5:1 AA floor for the hints, sub-labels and table headers it was used for | Lightened to `#868f9d` (5.1:1 on every surface in the theme) |
| Header ran **213px past the viewport at 768px** once it carried seven links, a language switch and a user chip | Mobile nav breakpoint raised to 1020px; the redundant header CTA hides below 560px |
| Profile sidebar overflowed **34px at 360px** | Grid and flex children default to `min-width:auto`; set to `0` so one long word cannot push a column past the viewport |
| Heading-level jumps (h1→h3 on Home, h2→h4 on Profile) | Reordered to a continuous outline |
| Textareas fell back to **monospace**, breaking Arabic letter joining | Form controls inherit the page typography |
| Session log stored **5.2 KB each** — the coaching reason, warm-up ramp and evidence snapshot for every block, all re-derivable | Slimmed to the record rather than the narrative: **2.8 KB**, taking a 5 MB quota from ~4 to ~9 years of training |

Also verified and left alone: all output is escaped (a `<img onerror>` payload in
a profile name renders as inert text), corrupt local storage degrades to an empty
profile list rather than crashing, pages load in under 200ms, and there are no
JavaScript or network errors on any page in either language.

Two things the audit deliberately does **not** flag, both correct as they stand:
the site makes 15 requests because it ships unbundled source with no build step,
and dark-on-accent text (buttons, chips, the skip link) measures 9.8:1 once the
element's own background is composited — an earlier version of the checker
missed that and produced a page of false failures.

---

## The pages

| Page | What it is |
|---|---|
| `index.html` | Landing page; adapts to whether you have a profile and a plan yet |
| `program.html` | The generated week, the day picker, the mesocycle strip, weekly volume |
| `workout.html` | The live session: readiness check-in, per-set logging, rest timer, coaching cues |
| `coach.html` | The insight feed and the full prescription table with its reasoning |
| `progress.html` | Estimated 1RM curves, tonnage, bodyweight, waist, attendance, session history |
| `exercises.html` | The library, plus movement pattern, joint load, pain flags and substitutions |
| `profile.html` | Profile, training settings, bodyweight and tape-measure log, starting-load calibration, mesocycle, export/import |

### The live session

Start a session and you get a four-question readiness check-in (sleep, soreness,
energy, stress). The score scales the whole session before you touch a weight —
a poor night's sleep should not be paid for with the same load as a good one,
and finding that out on set three is worse than being told up front.

Then, per set: the prescribed load, a live cue, weight/reps/RPE inputs, and a
rest timer that starts automatically and sounds when it is up. Everything is
written to storage as you go, so closing the tab mid-workout loses nothing.
Finish and the next session's prescriptions are recalculated before you have
left the building.

---

## Running it

A static site — no build, no dependencies.

```bash
# just open it
open index.html

# or serve it, which avoids any file:// quirks
python3 -m http.server 8000   # then visit http://localhost:8000
```

### Tests

```bash
node test/engine.test.js     # coaching engine — no dependencies
node test/audit.js           # browser audit — needs playwright
```

133 behavioural checks on the engine: that the four-day plan's first block
reproduces the source program exactly, that no prescribed load is unselectable
on its equipment, that weekly volume never exceeds MRV at any day count, that no
session repeats an exercise under any equipment or pain configuration, that
progression responds correctly to reps and effort, that assisted machines
progress downward, that manual overrides survive, and that a deload is
genuinely lighter.

The later additions are held to the same standard: that five weeks away
produces a re-entry rather than an increase and that a longer break gives back
more, that eight blocks produce eight distinct programs while no session
freezes for more than two blocks running, that all 61 strength exercises are
reachable at default settings, that a beginner meets far fewer technical lifts
in primary slots than an advanced lifter, that a calibrated lift is seeded from
its own set while the transfer to uncalibrated lifts stays damped and capped,
and that a flat scale with a shrinking waist is reported as good news rather
than as a stall.

The localisation checks are part of the same suite: that every English key has
an Arabic translation and none is orphaned, that all 66 exercises have Arabic
names and form cues, that Arabic picks distinct plural forms across 0/1/2/3/11/100,
and — the one that matters most — that **a plan generated entirely in English
renders with no English left in it after switching to Arabic**, across every
generated string in the plan.

The analysis engine is tested against simulated training histories shaped to
provoke it — a press-dominant lifter whose rowing never progresses, a block
where the last fortnight costs more effort for fewer reps, sets that collapse
from the first to the last. Each has a matching negative case, because a coach
that cries imbalance at someone training perfectly evenly is worse than one that
says nothing: an evenly-progressing lifter must raise **no** imbalance warning,
and a consistent one must raise **no** fatigue warning.

No test framework: the harness loads the browser scripts into Node with a
`localStorage` shim.

---

## Project structure

```
index.html program.html workout.html coach.html
progress.html exercises.html profile.html

css/style.css              v1 theme + the coaching components

js/i18n.js                 Translation core: message objects, deferred
                           references, plurals, bidi isolation
js/i18n/en.js              English strings (source of truth)
js/i18n/ar.js              Arabic strings
js/i18n/content.ar.js      Arabic exercise library + the plan's own guidelines

js/data/library.js         The exercise library and the source program:
                           names, steps, tips, media paths, the four-day plan
js/data/coaching.js        What the engine reasons about: movement patterns,
                           load types, joint stress, muscle contribution,
                           volume landmarks, goal and experience profiles
js/data/labels.js          Registers the English source text and resolves
                           deferred references into the current language
js/templates.js            Session blueprints as pattern slots; split definitions
js/storage.js              localStorage persistence, schema v2, v1 migration
js/ui.js                   Page chrome, formatting, charts, toasts, modals

js/engine/progression.js   Load selection: double progression, RPE, e1RM,
                           detraining, calibration
js/engine/scheduler.js     Split choice, day placement, slot filling and
                           block rotation, time budget
js/engine/periodization.js Mesocycle weeks, volume ramp and the deload
js/engine/analysis.js      Imbalance, fatigue, rep drop-off, forecasting, ordering
js/engine/adaptation.js    Substitutions, plateaus, volume and schedule proposals
js/engine/coach.js         Insight feed, session cues, debriefs, readiness

js/pages/*.js              One controller per page

test/harness.js            Loads the engines into Node
test/engine.test.js        133 behavioural checks, including localisation
test/audit.js              Browser audit: a11y, contrast, perf, XSS, responsive

tools/build-media.js       Rebuilds photos and clips from free-exercise-db
tools/media-map.json       Exercise id -> source entry
tools/contact-sheet.js     Writes every exercise's name against its photo and
                           clip on one page, for reviewing the media by eye
tools/import-photos.js     Replaces a stock photo with one you took of your
                           own gym's machine, and rebuilds its clip

robots.txt                 Keeps the shared-by-link site out of search results

assets/photos/*.jpg        Real gym photograph per exercise (66)
assets/clips/*.webm        Silent looping demonstration per exercise (66)
```

---

## Data, privacy and honesty

- **Everything is local.** Profiles, session logs, bodyweight, settings — all in
  this browser's `localStorage`, on this device. No account, no server, nothing
  transmitted. The trade-off is that it does not sync between devices; the
  export/import pair on the Profile page exists so you can move it yourself.
- **The app tells you what a lost browser would cost.** Local storage can go
  without warning — Safari evicts site data after seven days without a visit,
  "clear browsing data" takes it with the cookies, a new phone never had it —
  so the Profile page says in one line how much is unsaved, and the coach raises
  it once roughly a fortnight of training has accumulated. The app also requests
  persistent storage on boot, which lowers the odds where the browser honours it
  but is not a backup and does not pretend to be.
- **The site is shared by link, not published.** `robots.txt` disallows every
  crawler and all seven pages carry `<meta name="robots" content="noindex,
  nofollow">`, so it should not turn up in search results. That is a request to
  well-behaved crawlers and a way of staying out of an index — it is not access
  control. Anyone who has the address can open the site, and because the
  repository is public the address is discoverable from it. Real gating would
  mean a private repository plus a host that can authenticate, which is a
  different setup from this one.
- **v1 profiles are migrated automatically** on first load. Nothing you already
  logged is lost.
- **Your language choice is stored locally too**, in the same browser storage as
  everything else.
- **Media is real and stored locally.** All 66 exercises have a real gym
  photograph and a silent looping demonstration, from
  [free-exercise-db](https://github.com/yuhonas/free-exercise-db) (public domain,
  Unlicense), committed into this repo — so the site makes zero external requests
  and works fully offline.
- **The demonstrations are animations, not footage.** They are built from the
  source's two photographs with a short eased cross-fade, and the interface
  describes them that way. No filmed video was available under a licence that
  allows redistribution, and dressing an animation up as one would be a lie
  about the thing you are trying to copy.
- **Where a photo shows a documented variation** rather than an exact match — the
  close-grip lat pulldown standing in for the assisted pull-up machine, which the
  plan itself lists as the substitution — the detail view says so.

## Disclaimer

The coaching engine is a transparent rule system built on well-established
training principles. It is not a medical device, it cannot see you train, and it
does not know what you ate. Every recommendation shows its reasoning so you can
override it — and you should: if a load feels wrong, it is wrong.

If an exercise causes joint pain rather than muscle fatigue, flag it in the
library so the scheduler routes around it, and see a physiotherapist. That is
not something an app can fix.
