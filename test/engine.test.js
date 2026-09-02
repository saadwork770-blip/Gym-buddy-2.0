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
        DAY_KEYS, VOLUME_LANDMARKS, SESSION_TEMPLATES } = g;

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
      `${SESSION_TEMPLATES[tpl].name} matches the source plan exercise for exercise`);
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
    check(plan.splitId === splitId, `${days.length} day${days.length === 1 ? "" : "s"} -> ${plan.splitName}`);
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
