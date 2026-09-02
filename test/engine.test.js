/* ============================================================================
   GymBuddy 2.0 — test/engine.test.js
   ----------------------------------------------------------------------------
   Behavioural checks on the coaching engine. These are the invariants that
   matter to someone standing in front of a machine: the load is one you can
   actually select, the plan does not prescribe more than you can recover from,
   a weight you set yourself is not silently overwritten, and a deload is
   actually lighter.

       node test/engine.test.js
   ============================================================================ */

const { load } = require("./harness");

let passed = 0, failed = 0;
const results = [];

function suite(name) { results.push({ heading: name }); }
function check(condition, message) {
  if (condition) passed++; else failed++;
  results.push({ ok: !!condition, message });
}

/* ------------------------------------------------------------------ */

const g = load();
const { Store, Progression, Periodization, Scheduler, Adaptation, exerciseById,
        DAY_KEYS, VOLUME_LANDMARKS, SESSION_TEMPLATES, I18n, exName, templateName,
        splitName } = g;

const baseProfile = {
  name: "Test Athlete", sex: "Male", age: 30, heightCm: 178, weightKg: 114,
  goal: "Fat loss", level: "Some experience",
};

/* ---------- 1. The source program is reproduced exactly ---------- */

suite("A four-day week reproduces the original Fitness Time plan");
{
  const p = Store.createProfile(baseProfile);
  Store.updateSettings(p.id, { trainingDays: ["mon", "tue", "thu", "fri"] });
  const plan = Store.getPlan(p.id);

  const expected = {
    upper_a: ["chest-press-machine", "lat-pulldown-wide", "seated-cable-row",
              "shoulder-press-machine", "cable-triceps-pushdown", "seated-db-bicep-curl"],
    lower_a: ["leg-press", "seated-leg-curl", "leg-extension",
              "hip-adduction-abduction", "standing-calf-raise-machine", "cable-crunch-ab-machine"],
    upper_b: ["smith-machine-incline-press", "assisted-pull-up-machine", "chest-fly-pec-deck",
              "dumbbell-lateral-raise", "cable-rope-face-pull", "db-overhead-triceps-extension"],
    lower_b: ["hack-squat-machine", "romanian-deadlift", "walking-lunges",
              "glute-kickback", "seated-calf-raise", "plank"],
  };

  check(plan.splitId === "upper_lower_4", "four days selects the Upper/Lower x2 split");
  Object.entries(expected).forEach(([tpl, ids]) => {
    const session = plan.sessions.find(s => s.templateId === tpl);
    const got = session ? session.blocks.map(b => b.exerciseId) : [];
    check(JSON.stringify(got) === JSON.stringify(ids),
      `${templateName(tpl)} matches the source plan exercise for exercise`);
  });
}

/* ---------- 2. Every prescribed load is selectable ---------- */

suite("Prescribed loads land on real equipment increments");
{
  const p = Store.createProfile(baseProfile);
  const offenders = [];
  DAY_KEYS.slice(0, 6).forEach((_, i) => {
    Store.updateSettings(p.id, { trainingDays: DAY_KEYS.slice(0, i + 1) });
    const plan = Store.getPlan(p.id);
    plan.sessions.forEach(s => s.blocks.forEach(b => {
      const ex = exerciseById(b.exerciseId);
      const inc = ex.loadSpec.increment;
      if (!inc || !b.weight) return;
      if (Math.abs(b.weight / inc - Math.round(b.weight / inc)) > 1e-6) {
        offenders.push(`${ex.name} ${b.weight} (step ${inc})`);
      }
    }));
  });
  check(offenders.length === 0,
    `no unselectable load across 1–6 day plans${offenders.length ? ": " + offenders.join(", ") : ""}`);
}

/* ---------- 3. Weekly volume never exceeds what is recoverable ---------- */

suite("Weekly volume stays under the recoverable ceiling");
{
  const p = Store.createProfile(baseProfile);
  [1, 2, 3, 4, 5, 6].forEach(n => {
    Store.updateSettings(p.id, { trainingDays: DAY_KEYS.slice(0, n) });
    const plan = Store.getPlan(p.id);
    const over = plan.volumeReport.filter(r => r.sets > r.landmarks.mrv);
    check(over.length === 0,
      `${n} training day${n === 1 ? "" : "s"}: nothing above MRV${over.length ? " — " + over.map(o => `${o.label} ${o.sets}`).join(", ") : ""}`);
  });
}

/* ---------- 4. No session ever repeats an exercise ---------- */

suite("No session prescribes the same exercise twice");
{
  const p = Store.createProfile(baseProfile);
  const dupes = [];
  const scenarios = [
    { label: "default", apply: () => {} },
    { label: "no barbell or cables", apply: () => Store.updateSettings(p.id, {
        equipment: { machine: true, cable: false, dumbbell: true, barbell: false, bodyweight: true } }) },
    { label: "knee and shoulder pain flagged", apply: () => {
        Store.flagPain(p.id, "leg-press", "knee");
        Store.flagPain(p.id, "chest-press-machine", "shoulder"); } },
    { label: "several lifts excluded", apply: () => {
        ["hack-squat-machine", "lat-pulldown-wide", "seated-cable-row"].forEach(id => Store.toggleExcluded(p.id, id)); } },
  ];
  scenarios.forEach(sc => {
    sc.apply();
    [3, 4, 6].forEach(n => {
      Store.updateSettings(p.id, { trainingDays: DAY_KEYS.slice(0, n) });
      Store.getPlan(p.id).sessions.forEach(s => {
        const ids = s.blocks.map(b => b.exerciseId);
        if (new Set(ids).size !== ids.length) dupes.push(`${s.name} (${sc.label}, ${n} days)`);
      });
    });
  });
  check(dupes.length === 0, `no duplicates across equipment, pain and exclusion scenarios${dupes.length ? ": " + dupes.join("; ") : ""}`);
}

/* ---------- 5. Double progression behaves ---------- */

suite("Progression responds to reps and effort");
{
  const p = Store.createProfile(baseProfile);
  Store.updateSettings(p.id, { trainingDays: ["mon", "tue", "thu", "fri"] });

  const logSession = (dayKey, fill) => {
    const s = Store.startSession(p.id, dayKey, null);
    s.sets = [];
    s.blocks.forEach(b => {
      for (let i = 0; i < b.sets; i++) s.sets.push({ ...fill(b), exerciseId: b.exerciseId, setIndex: i, done: true });
    });
    Store.completeSession(p.id, s);
  };

  // Top of the range, easy → load goes up.
  logSession("mon", b => ({ weight: b.weight, reps: b.repHi, rpe: 7 }));
  let rx = Store.getProfile(p.id).prescriptions["chest-press-machine"];
  check(rx.action === "increase" && rx.delta > 0, `clearing the range at RPE 7 raises the load (+${rx.delta} kg)`);

  // Inside the range → hold the weight, chase a rep.
  const p2 = Store.createProfile({ ...baseProfile, name: "B" });
  Store.updateSettings(p2.id, { trainingDays: ["mon", "tue", "thu", "fri"] });
  const s2 = Store.startSession(p2.id, "mon", null);
  s2.sets = [];
  s2.blocks.forEach(b => { for (let i = 0; i < b.sets; i++)
    s2.sets.push({ exerciseId: b.exerciseId, setIndex: i, weight: b.weight, reps: b.repLo + 1, rpe: 8, done: true }); });
  Store.completeSession(p2.id, s2);
  const rx2 = Store.getProfile(p2.id).prescriptions["chest-press-machine"];
  check(rx2.action === "add_reps" && rx2.delta === 0, "landing mid-range holds the load and asks for a rep");

  // Missed the range at a very high effort → load comes down.
  const p3 = Store.createProfile({ ...baseProfile, name: "C" });
  Store.updateSettings(p3.id, { trainingDays: ["mon", "tue", "thu", "fri"] });
  const s3 = Store.startSession(p3.id, "mon", null);
  s3.sets = [];
  s3.blocks.forEach(b => { for (let i = 0; i < b.sets; i++)
    s3.sets.push({ exerciseId: b.exerciseId, setIndex: i, weight: b.weight, reps: Math.max(1, b.repLo - 3), rpe: 10, done: true }); });
  Store.completeSession(p3.id, s3);
  const rx3 = Store.getProfile(p3.id).prescriptions["chest-press-machine"];
  check(rx3.action === "reduce" && rx3.delta < 0, `failing the range at RPE 10 backs the load off (${rx3.delta} kg)`);
}

/* ---------- 6. Assisted machines progress downward ---------- */

suite("Assisted machines progress by removing assistance");
{
  const p = Store.createProfile(baseProfile);
  Store.updateSettings(p.id, { trainingDays: ["mon", "tue", "thu", "fri"] });
  const s = Store.startSession(p.id, "thu", null);   // Upper B holds the assisted pull-up
  s.sets = [];
  s.blocks.forEach(b => { for (let i = 0; i < b.sets; i++)
    s.sets.push({ exerciseId: b.exerciseId, setIndex: i, weight: b.weight, reps: b.repHi, rpe: 7, done: true }); });
  const before = s.blocks.find(b => b.exerciseId === "assisted-pull-up-machine").weight;
  Store.completeSession(p.id, s);
  const rx = Store.getProfile(p.id).prescriptions["assisted-pull-up-machine"];
  check(rx.action === "increase" && rx.weight < before,
    `assistance drops as you get stronger (${before} -> ${rx.weight} kg of help)`);

  const series = Progression.strengthSeries(Store.getProfile(p.id), "assisted-pull-up-machine");
  check(series.length > 0 && series[0].e1rm > 0, "strength is tracked as bodyweight minus assistance, not the stack number");
}

/* ---------- 7. A manual override is not overwritten ---------- */

suite("A weight you set yourself survives");
{
  const p = Store.createProfile(baseProfile);
  Store.updateSettings(p.id, { trainingDays: ["mon", "tue", "thu", "fri"] });
  Store.setPrescription(p.id, "leg-press", { weight: 200, sets: 4, repLo: 8, repHi: 12 });

  const block = Store.getPlan(p.id).sessions
    .find(s => s.templateId === "lower_a").blocks.find(b => b.exerciseId === "leg-press");
  check(block.weight === 200, `override survives a plan rebuild (got ${block.weight} kg)`);
  check(block.manual === true, "the plan marks the load as manually set");

  const s = Store.startSession(p.id, "tue", null);
  s.sets = [];
  s.blocks.forEach(b => { for (let i = 0; i < b.sets; i++)
    s.sets.push({ exerciseId: b.exerciseId, setIndex: i, weight: b.weight, reps: b.repHi, rpe: 7, done: true }); });
  Store.completeSession(p.id, s);
  const rx = Store.getProfile(p.id).prescriptions["leg-press"];
  check(rx.weight > 200 && rx.action === "increase",
    `normal progression resumes from your number once logged (200 -> ${rx.weight} kg)`);
}

/* ---------- 8. Periodization ---------- */

suite("The mesocycle deload actually reduces the work");
{
  const p = Store.createProfile(baseProfile);
  Store.updateSettings(p.id, { trainingDays: ["mon", "tue", "thu", "fri"] });
  const s = Store.startSession(p.id, "tue", null);
  s.sets = [];
  s.blocks.forEach(b => { for (let i = 0; i < b.sets; i++)
    s.sets.push({ exerciseId: b.exerciseId, setIndex: i, weight: b.weight, reps: b.repHi, rpe: 7.5, done: true }); });
  Store.completeSession(p.id, s);

  const profile = Store.getProfile(p.id);
  const ex = exerciseById("leg-press");
  const loading = Periodization.phaseFor({ ...profile, meso: { startDate: today(0), weeks: 4 } });
  const deload = Periodization.phaseFor({ ...profile, meso: { startDate: today(-21), weeks: 4 } });

  check(loading.type !== "deload" && deload.type === "deload", "week 4 of a 4-week block is the deload");
  const a = Progression.recommend({ profile, exercise: ex, phase: loading });
  const b = Progression.recommend({ profile, exercise: ex, phase: deload });
  check(b.weight < a.weight, `deload drops the load (${a.weight} -> ${b.weight} kg)`);
  check(b.sets < a.sets, `deload drops the volume (${a.sets} -> ${b.sets} sets)`);
}

/* ---------- 9. Readiness modulation ---------- */

suite("Readiness scales the session");
{
  const g2 = load();
  const scores = [100, 60, 20].map(s => g2.Progression.readinessModifier(s));
  check(scores[0].loadScale === 1, "a fresh check-in runs the plan as written");
  check(scores[1].loadScale < 1, `a middling check-in trims the load (x${scores[1].loadScale})`);
  check(scores[2].loadScale < scores[1].loadScale && scores[2].setDelta < 0,
    "a poor check-in cuts both load and volume");
}

/* ---------- 10. Scheduling reacts to the days chosen ---------- */

suite("The split follows the days you pick");
{
  const p = Store.createProfile(baseProfile);
  const expectations = [
    [["sat"], "full_1"], [["mon", "thu"], "full_2"], [["mon", "wed", "fri"], "full_3"],
    [["mon", "tue", "thu", "fri"], "upper_lower_4"],
    [["mon", "tue", "wed", "thu", "fri"], "ul_ppl_5"],
    [["mon", "tue", "wed", "thu", "fri", "sat"], "ppl_6"],
  ];
  expectations.forEach(([days, splitId]) => {
    Store.updateSettings(p.id, { trainingDays: days });
    const plan = Store.getPlan(p.id);
    check(plan.splitId === splitId, `${days.length} day${days.length === 1 ? "" : "s"} -> ${splitName(plan.splitId)}`);
    check(plan.sessions.length === days.length, `  ...and produces ${days.length} session${days.length === 1 ? "" : "s"}`);
  });
}

/* ---------- 11. Equipment and pain routing ---------- */

suite("Missing equipment and painful joints are routed around");
{
  const p = Store.createProfile(baseProfile);
  Store.updateSettings(p.id, {
    trainingDays: ["mon", "tue", "thu", "fri"],
    equipment: { machine: true, cable: false, dumbbell: true, barbell: false, bodyweight: true },
  });
  let plan = Store.getPlan(p.id);
  const used = plan.sessions.flatMap(s => s.blocks.map(b => exerciseById(b.exerciseId)));
  check(!used.some(e => e.loadType === "cable_stack" || e.loadType === "barbell"),
    "no cable or barbell movement survives when that equipment is off");
  check(plan.sessions.some(s => s.notes.length > 0), "and the substitutions are explained in the session notes");

  Store.updateSettings(p.id, { equipment: { machine: true, cable: true, dumbbell: true, barbell: true, bodyweight: true } });
  Store.flagPain(p.id, "leg-press", "knee");
  plan = Store.getPlan(p.id);
  const lower = plan.sessions.find(s => s.templateId === "lower_a");
  check(!lower.blocks.some(b => b.exerciseId === "leg-press"), "a flagged exercise is dropped from the plan");
  check(lower.blocks.length >= 5, "and the session is refilled rather than left with a hole");
}

/* ---------- 12. Time budget ---------- */

suite("Sessions are trimmed to the time available");
{
  const p = Store.createProfile(baseProfile);
  Store.updateSettings(p.id, { trainingDays: ["mon", "tue", "thu", "fri"], sessionMinutes: 40 });
  const short = Store.getPlan(p.id);
  Store.updateSettings(p.id, { sessionMinutes: 90 });
  const long = Store.getPlan(p.id);

  check(short.sessions.every(s => s.estMinutes <= 44), "a 40-minute budget produces sessions that fit it");
  check(long.sessions[0].totalSets > short.sessions[0].totalSets, "a longer budget keeps more work");
  check(short.sessions.every(s => s.blocks.some(b => b.role === "primary")),
    "the main compounds are protected when trimming");
}

/* ---------- 13. The analysis engine ---------- */

/** Log `weeks` of sessions, letting a callback shape what gets lifted. */
function simulate(g, profileId, weeks, shape) {
  const idx = { mon: 0, tue: 1, wed: 2, thu: 3, fri: 4, sat: 5, sun: 6 };
  for (let w = weeks - 1; w >= 0; w--) {
    g.Store.getPlan(profileId).sessions.forEach(planned => {
      const now = new Date(), today = (now.getDay() + 6) % 7;
      const d = new Date(now);
      d.setDate(now.getDate() - today - (w * 7) + idx[planned.dayKey]);
      if (d > now) return;
      const s = g.Store.startSession(profileId, planned.dayKey, null);
      if (!s) return;
      s.date = d.toISOString().slice(0, 10);
      s.startedAt = d.getTime();
      s.sets = [];
      s.blocks.forEach(b => {
        for (let i = 0; i < b.sets; i++) {
          s.sets.push({ exerciseId: b.exerciseId, setIndex: i, weight: b.weight, done: true,
            ...shape(b, i, w) });
        }
      });
      g.Store.completeSession(profileId, s);
    });
  }
}

suite("Strength imbalance between opposing patterns is detected");
{
  const g = load();
  const p = g.Store.createProfile(baseProfile);
  g.Store.updateProfile(p.id, { createdAt: Date.now() - 56 * 86400000 });
  g.Store.updateSettings(p.id, { trainingDays: ["mon", "tue", "thu", "fri"] });

  // Pressing climbs every week; rowing is logged but never progresses.
  simulate(g, p.id, 8, (b, i, w) => {
    const ex = g.exerciseById(b.exerciseId);
    const pressing = ["horizontal_push", "incline_push"].includes(ex.pattern);
    return pressing
      ? { reps: b.repHi, rpe: 7 }                 // clears the range, load keeps rising
      : { reps: b.repLo, rpe: 9.5 };              // never earns an increase
  });

  const profile = g.Store.getProfile(p.id);
  const pairs = g.Analysis.balance(profile);
  const pushPull = pairs.find(x => x.id === "push_pull");
  check(!!pushPull, `the push/pull pair has enough data to judge (${pairs.length} pairs assessed)`);
  check(pushPull && pushPull.status === "b_weak",
    `deliberate press-dominant training is flagged as rowing behind pressing (ratio ${pushPull && pushPull.ratio}×)`);
  check(pushPull && pushPull.shortfallKg > 0,
    `and it quantifies the gap (${pushPull && pushPull.shortfallKg} kg)`);

  const feed = g.Coach.buildFeed(profile);
  const insight = feed.find(m => m.category === "balance");
  check(!!insight, "the coach raises it as an insight");
  check(insight && insight.apply && insight.apply.type === "set_delta",
    "with an action that adds volume to the weaker side");
}

suite("A balanced lifter is told nothing about balance");
{
  const g = load();
  const p = g.Store.createProfile(baseProfile);
  g.Store.updateProfile(p.id, { createdAt: Date.now() - 56 * 86400000 });
  g.Store.updateSettings(p.id, { trainingDays: ["mon", "tue", "thu", "fri"] });
  simulate(g, p.id, 8, (b) => ({ reps: b.repHi, rpe: 7.5 }));   // everything progresses evenly

  const flagged = g.Analysis.balance(g.Store.getProfile(p.id)).filter(x => x.status !== "balanced");
  check(flagged.length === 0,
    `even progress produces no imbalance warnings${flagged.length ? ": " + flagged.map(f => f.id).join(", ") : ""}`);
}

suite("Accumulated fatigue is caught before the calendar deload");
{
  const g = load();
  const p = g.Store.createProfile(baseProfile);
  g.Store.updateProfile(p.id, { createdAt: Date.now() - 56 * 86400000 });
  g.Store.updateSettings(p.id, { trainingDays: ["mon", "tue", "thu", "fri"] });

  // Weeks 5–8 were fine; the last two weeks cost more effort for fewer reps.
  simulate(g, p.id, 8, (b, i, w) => (w >= 2
    ? { reps: b.repHi, rpe: 7.5 }
    : { reps: Math.max(1, b.repLo - 2), rpe: 9.5 }));

  const profile = g.Store.getProfile(p.id);
  const f = g.Analysis.fatigue(profile);
  check(f.ready, "there is enough history to assess fatigue");
  check(f.rpeDrift > 0, `effort has drifted upward (${f.rpeDrift} RPE)`);
  check(f.completion < 85, `rep completion has fallen (${f.completion}%)`);
  check(f.overreached, `two or more signals agree, so an early deload is proposed (${f.signals.join(", ")})`);

  const insight = g.Coach.buildFeed(profile).find(m => m.category === "fatigue");
  check(!!insight, "the coach surfaces it");
  check(insight && insight.apply && insight.apply.deloadNow === true,
    "and the action brings the deload forward rather than restarting the block");

  // Applying it must actually put this week into the deload.
  if (insight) {
    g.Adaptation.apply(p.id, insight.apply);
    const phase = g.Periodization.phaseFor(g.Store.getProfile(p.id));
    check(phase.type === "deload", `applying it puts you in the deload week immediately (${phase.label})`);
  }
}

suite("A steady lifter is not told they are overreached");
{
  const g = load();
  const p = g.Store.createProfile(baseProfile);
  g.Store.updateProfile(p.id, { createdAt: Date.now() - 56 * 86400000 });
  g.Store.updateSettings(p.id, { trainingDays: ["mon", "tue", "thu", "fri"] });
  simulate(g, p.id, 8, (b) => ({ reps: b.repHi, rpe: 7.5 }));
  const f = g.Analysis.fatigue(g.Store.getProfile(p.id));
  check(f.ready && !f.overreached,
    `consistent, comfortable training raises no fatigue warning (signals: ${f.signals.join(", ") || "none"})`);
}

suite("Collapsing later sets are diagnosed");
{
  const g = load();
  const p = g.Store.createProfile(baseProfile);
  g.Store.updateProfile(p.id, { createdAt: Date.now() - 42 * 86400000 });
  g.Store.updateSettings(p.id, { trainingDays: ["mon", "tue", "thu", "fri"] });

  // First set strong, then falling away hard — the signature of too little rest.
  simulate(g, p.id, 6, (b, i) => ({ reps: Math.max(1, b.repHi - i * 3), rpe: 8 + i * 0.5 }));

  const drops = g.Analysis.dropOff(g.Store.getProfile(p.id));
  check(drops.length > 0, `a steep rep drop-off is detected (${drops.length} exercises)`);
  check(drops[0].dropPct >= 30, `and quantified (${drops[0].dropPct}% from set 1 to set ${drops[0].sets})`);

  const g2 = load();
  const p2 = g2.Store.createProfile(baseProfile);
  g2.Store.updateProfile(p2.id, { createdAt: Date.now() - 42 * 86400000 });
  g2.Store.updateSettings(p2.id, { trainingDays: ["mon", "tue", "thu", "fri"] });
  simulate(g2, p2.id, 6, (b, i) => ({ reps: Math.max(1, b.repHi - (i > 1 ? 1 : 0)), rpe: 8 }));
  check(g2.Analysis.dropOff(g2.Store.getProfile(p2.id)).length === 0,
    "normal end-of-exercise fatigue is not flagged");
}

suite("Progress is forecast only where the trend supports it");
{
  const g = load();
  const p = g.Store.createProfile(baseProfile);
  g.Store.updateProfile(p.id, { createdAt: Date.now() - 70 * 86400000 });
  g.Store.updateSettings(p.id, { trainingDays: ["mon", "tue", "thu", "fri"] });
  simulate(g, p.id, 10, (b) => ({ reps: b.repHi, rpe: 7 }));

  const f = g.Analysis.bestForecast(g.Store.getProfile(p.id));
  check(!!f, "a consistently rising lift produces a projection");
  if (f) {
    check(f.target > f.current, `it projects forward, not backward (${f.current} → ${f.target} kg)`);
    check(f.weeks > 0 && f.weeks <= 26, `within a useful horizon (${f.weeks} weeks, ${f.date})`);
    check(f.target - f.current >= 2.5, `and the milestone is worth naming (+${Math.round((f.target - f.current) * 10) / 10} kg, not a rounding step)`);
    check(f.r2 >= 0.4, `and only because the line fits (R² ${f.r2})`);
  }

  const g2 = load();
  const p2 = g2.Store.createProfile(baseProfile);
  g2.Store.updateSettings(p2.id, { trainingDays: ["mon", "tue", "thu", "fri"] });
  check(g2.Analysis.bestForecast(g2.Store.getProfile(p2.id)) === null,
    "a profile with no history is given no projection");
}

suite("Volume ramps across the block without cutting week 1");
{
  const g = load();
  const p = g.Store.createProfile(baseProfile);
  g.Store.updateSettings(p.id, { trainingDays: ["mon", "tue", "thu", "fri"] });

  const setsIn = plan => plan.sessions.reduce((n, s) => n + s.totalSets, 0);
  const week1 = setsIn(g.Store.getPlan(p.id));

  const atWeek = n => {
    const start = new Date(); start.setDate(start.getDate() - (n - 1) * 7);
    g.Store.updateProfile(p.id, { meso: { startDate: start.toISOString().slice(0, 10), weeks: 4 } });
    return g.Store.regeneratePlan(p.id).plan;
  };
  const week2 = setsIn(atWeek(2));
  const week3 = setsIn(atWeek(3));
  const week4 = setsIn(atWeek(4));

  check(week2 > week1, `week 2 adds volume (${week1} → ${week2} sets)`);
  check(week3 >= week2, `week 3 holds or adds again (${week3} sets)`);
  check(week4 < week1, `the deload week cuts below week 1 (${week4} sets)`);

  const over = g.Store.getPlan(p.id) && atWeek(3).volumeReport.filter(r => r.sets > r.landmarks.mrv);
  check(over.length === 0, "and the ramp never pushes a muscle past its recoverable ceiling");
}

suite("Session ordering problems are spotted");
{
  const g = load();
  const p = g.Store.createProfile(baseProfile);
  g.Store.updateSettings(p.id, { trainingDays: ["mon", "tue", "thu", "fri"] });
  const plan = g.Store.getPlan(p.id);
  const problems = plan.sessions.flatMap(s => g.Analysis.ordering(s));
  check(problems.length === 0,
    `the generated plan puts the main lifts first${problems.length ? " — " + problems.map(x => x.before + " before " + x.primary).join(", ") : ""}`);

  // A deliberately bad order must be caught.
  const bad = {
    templateId: "upper_a",
    blocks: [
      { exerciseId: "chest-fly-pec-deck", role: "accessory" },
      { exerciseId: "barbell-bench-press", role: "primary" },
    ],
  };
  check(g.Analysis.ordering(bad).length === 1,
    "and a fatiguing accessory placed before a main lift is flagged");
}

/* ---------- 14. Localisation ---------- */

suite("Translations are complete and actually used");
{
  const en = I18n.keys("en");
  const ar = I18n.keys("ar");
  const arSet = new Set(ar), enSet = new Set(en);
  const missing = en.filter(k => !arSet.has(k));
  const orphan = ar.filter(k => !enSet.has(k));

  check(missing.length === 0,
    `every English key has an Arabic translation (${en.length} keys)${missing.length ? " — missing: " + missing.slice(0, 8).join(", ") : ""}`);
  check(orphan.length === 0,
    `no orphaned Arabic keys${orphan.length ? ": " + orphan.slice(0, 8).join(", ") : ""}`);

  // Every exercise in the library needs a name and form cues in both languages.
  const gaps = [];
  g.EXERCISES.forEach(ex => {
    ["name", "steps", "tips"].forEach(field => {
      if (!arSet.has(`exercise.${ex.id}.${field}`)) gaps.push(`${ex.id}.${field}`);
    });
  });
  check(gaps.length === 0,
    `all ${g.EXERCISES.length} exercises have Arabic names, steps and tips${gaps.length ? " — missing: " + gaps.slice(0, 6).join(", ") : ""}`);
}

suite("The coaching engine speaks both languages");
{
  const g2 = load();
  const p = g2.Store.createProfile(baseProfile);
  g2.Store.updateSettings(p.id, { trainingDays: ["mon", "tue", "thu", "fri"] });

  // Log a session so the engine produces a real, evidence-backed reason.
  const s = g2.Store.startSession(p.id, "mon", null);
  s.sets = [];
  s.blocks.forEach(b => { for (let i = 0; i < b.sets; i++)
    s.sets.push({ exerciseId: b.exerciseId, setIndex: i, weight: b.weight, reps: b.repHi, rpe: 7, done: true }); });
  g2.Store.completeSession(p.id, s);

  const plan = g2.Store.getPlan(p.id);
  const block = plan.sessions.find(x => x.templateId === "upper_a").blocks[0];

  // Reasons are stored as message objects, not baked English.
  check(block.reason && typeof block.reason === "object" && block.reason.k,
    "prescription reasons are stored as translatable message objects");

  const english = g2.I18n.tx(block.reason);
  g2.I18n.setLang("ar");
  const arabic = g2.I18n.tx(block.reason);

  check(english !== arabic && arabic.length > 20,
    "the same stored reason renders differently in each language");
  check(/[\u0600-\u06FF]/.test(arabic), "the Arabic rendering actually contains Arabic script");
  check(!/^[a-z.]+\.[a-z]/.test(arabic.trim()),
    `no raw translation key leaks into the output (got: ${arabic.slice(0, 40)}…)`);
  check(arabic.includes("\u2068") || !/[0-9]/.test(arabic),
    "numbers inside Arabic prose are wrapped in bidi isolates");

  // Whole-feed sweep: nothing should render as a dotted key.
  const feed = g2.Coach.buildFeed(g2.Store.getProfile(p.id));
  const leaked = [];
  feed.forEach(msgItem => {
    [msgItem.title, msgItem.body].forEach(field => {
      const text = g2.I18n.tx(field);
      if (/^[a-zA-Z]+(\.[a-zA-Z]+)+$/.test(text.trim())) leaked.push(text.trim());
    });
  });
  check(leaked.length === 0,
    `every coach insight renders in Arabic${leaked.length ? " — leaked keys: " + leaked.slice(0, 5).join(", ") : ` (${feed.length} insights checked)`}`);

  // And the library renders too.
  const noName = g2.EXERCISES.filter(ex => g2.exName(ex.id) === `exercise.${ex.id}.name`);
  check(noName.length === 0,
    `every exercise name resolves in Arabic${noName.length ? " — missing: " + noName.slice(0, 4).map(e => e.id).join(", ") : ""}`);

  g2.I18n.setLang("en");
}

suite("Stored plans re-render in whichever language you switch to");
{
  const g4 = load();
  const p = g4.Store.createProfile(baseProfile);
  g4.Store.updateSettings(p.id, { trainingDays: ["mon", "tue", "thu", "fri"] });
  g4.Store.flagPain(p.id, "leg-press", "knee");

  // Built entirely in English, then read entirely in Arabic — the case that
  // used to leave English exercise names embedded in Arabic sentences.
  const plan = g4.Store.getPlan(p.id);
  const note = plan.sessions.find(x => x.templateId === "lower_a").notes[0];
  const englishNote = g4.I18n.tx(note);
  check(/Hack Squat|Leg Press/.test(englishNote), "the substitution note names the exercises in English");

  g4.I18n.setLang("ar");
  const arabicNote = g4.I18n.tx(note);
  check(/[\u0600-\u06FF]/.test(arabicNote), "the same stored note renders in Arabic after switching");
  check(!/[A-Za-z]{4,}/.test(arabicNote),
    `no English words survive inside the Arabic note (got: ${arabicNote.slice(0, 60)}…)`);

  // Same check across every generated string in the plan.
  const strings = [];
  plan.sessions.forEach(sn => (sn.notes || []).forEach(n => strings.push(g4.I18n.tx(n))));
  (plan.warnings || []).forEach(w => strings.push(g4.I18n.tx(w)));
  (plan.restDays || []).forEach(r => strings.push(g4.I18n.tx(r.suggestion)));
  plan.sessions.forEach(sn => sn.blocks.forEach(b => strings.push(g4.I18n.tx(b.reason))));
  (plan.volumeReport || []).forEach(r => strings.push(g4.I18n.tx(r.message)));
  // "RPE" and "1RM" are deliberately left in Latin script.
  const withEnglish = strings.filter(x => /[A-Za-z]{4,}/.test(x.replace(/RPE|1RM|BW/g, "")));
  check(withEnglish.length === 0,
    `no English leaks into any of the ${strings.length} generated plan strings${withEnglish.length ? ` — e.g. "${withEnglish[0].slice(0, 70)}"` : ""}`);

  g4.I18n.setLang("en");
}

suite("Arabic plural forms are wired up");
{
  const g3 = load();
  g3.I18n.setLang("ar");
  const forms = [0, 1, 2, 3, 11, 100].map(n => g3.I18n.t("common.sessions", { count: n }));
  const distinct = new Set(forms).size;
  check(distinct >= 4, `Arabic picks distinct plural forms by count (${distinct} distinct across 0/1/2/3/11/100)`);
  g3.I18n.setLang("en");
  const enForms = [1, 2].map(n => g3.I18n.t("common.sessions", { count: n }));
  check(enForms[0] !== enForms[1], "English still distinguishes singular from plural");
}

/* ------------------------------------------------------------------ */

console.log("");
results.forEach(r => {
  if (r.heading) { console.log(`\n${r.heading}`); return; }
  console.log(`  ${r.ok ? "✓" : "✗"} ${r.message}`);
});
console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed ? 1 : 0);

function today(offsetDays) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}
