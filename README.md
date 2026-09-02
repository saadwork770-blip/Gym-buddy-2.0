# GymBuddy 2.0

An adaptive training companion built from a real training plan —
**"4-Day Fat Loss Program — Fitness Time (Standard Commercial Gym)."**

Version 1 turned that plan into a browsable website. Version 2.0 keeps every bit
of that — the full program, the exercise library with real gym photographs and
animated demonstrations, the local profile — and puts a coaching engine
underneath it.

The engine does three things the static version could not:

1. **It picks your weights.** Not a fixed number printed on a page: the load for
   your next session is derived from the reps and effort you logged in the last
   one, and rounded to what the machine can actually select.
2. **It rebuilds your week around the days you can train.** Choose one to six
   days and it re-selects the split, re-orders the sessions so overlapping
   muscle work lands as far apart as the week allows, and re-sizes each session
   to the time you have.
3. **It changes the workouts.** Stalled lifts, missing equipment, a joint that
   hurts, volume above what you can recover from — each triggers a specific,
   explained modification that you accept or reject.

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
   with a sentence saying why.
4. **Fit the time and add cardio.** Sessions over your budget are trimmed
   finishers-first, protecting the main compounds. Cardio is dosed by goal and
   attached to training and rest days.

**With four days selected and default settings, the generated plan reproduces
the original Fitness Time program exactly, exercise for exercise.** There is a
test that asserts it.

### `periodization.js` — the calendar

A mesocycle of loading weeks closed by a planned deload (four weeks by default,
configurable 3–6). Loading weeks raise the RPE ceiling from 7.5 to 9 and add a
set to the compounds in week 3; the deload cuts volume to ~55% and load by ~10%.
Every other engine asks it what week it is before deciding anything.

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

## The pages

| Page | What it is |
|---|---|
| `index.html` | Landing page; adapts to whether you have a profile and a plan yet |
| `program.html` | The generated week, the day picker, the mesocycle strip, weekly volume |
| `workout.html` | The live session: readiness check-in, per-set logging, rest timer, coaching cues |
| `coach.html` | The insight feed and the full prescription table with its reasoning |
| `progress.html` | Estimated 1RM curves, tonnage, bodyweight, attendance, session history |
| `exercises.html` | The library, plus movement pattern, joint load, pain flags and substitutions |
| `profile.html` | Profile, training settings, bodyweight log, mesocycle, export/import |

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
node test/engine.test.js
```

46 behavioural checks on the engine: that the four-day plan reproduces the
source program exactly, that no prescribed load is unselectable on its
equipment, that weekly volume never exceeds MRV at any day count, that no
session repeats an exercise under any equipment or pain configuration, that
progression responds correctly to reps and effort, that assisted machines
progress downward, that manual overrides survive, and that a deload is
genuinely lighter. No test framework — the harness loads the browser scripts
into Node with a `localStorage` shim.

---

## Project structure

```
index.html program.html workout.html coach.html
progress.html exercises.html profile.html

css/style.css              v1 theme + the coaching components

js/data.js                 Exercise library, coaching metadata, volume
                           landmarks, goal and experience profiles
js/templates.js            Session blueprints as pattern slots; split definitions
js/storage.js              localStorage persistence, schema v2, v1 migration
js/ui.js                   Page chrome, formatting, charts, toasts, modals

js/engine/progression.js   Load selection: double progression, RPE, e1RM
js/engine/scheduler.js     Split choice, day placement, slot filling, time budget
js/engine/periodization.js Mesocycle weeks and the deload
js/engine/adaptation.js    Substitutions, plateaus, volume and schedule proposals
js/engine/coach.js         Insight feed, session cues, debriefs, readiness

js/pages/*.js              One controller per page

test/harness.js            Loads the engines into Node
test/engine.test.js        46 behavioural checks

assets/photos/*.jpg        Real gym photo per exercise (29)
assets/gifs/*.gif          Animated demonstration per exercise (29)
```

---

## Data, privacy and honesty

- **Everything is local.** Profiles, session logs, bodyweight, settings — all in
  this browser's `localStorage`, on this device. No account, no server, nothing
  transmitted. The trade-off is that it does not sync between devices; the
  export/import pair on the Profile page exists so you can move it yourself.
- **v1 profiles are migrated automatically** on first load. Nothing you already
  logged is lost.
- **Media is real and stored locally.** Every exercise from the original plan has
  a real gym photograph and a looping GIF, from
  [free-exercise-db](https://github.com/yuhonas/free-exercise-db) (public domain,
  Unlicense), committed into this repo — so the site makes zero external requests
  and works fully offline. The ten supplementary movements added in 2.0 (extra
  substitution options for thin patterns like vertical push and hip hinge) ship
  with line-art diagrams instead, and the interface labels them as diagrams
  rather than passing a drawing off as a photograph.
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
