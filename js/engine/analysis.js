/* ============================================================================
   GymBuddy 2.0 — engine/analysis.js
   ----------------------------------------------------------------------------
   Reading the training log for the things a single session cannot show you.

   Progression looks at one exercise's last session and decides the next load.
   This module looks across exercises and across weeks, and answers the
   questions a coach standing next to you would be asking:

     · Is anything badly out of balance with its opposite?
     · Is fatigue accumulating faster than the calendar assumes?
     · Are the later sets collapsing, and if so, is that load or rest?
     · At this rate, when does the number you want actually arrive?
     · Is the session ordered so the hard work happens while you are fresh?

   Everything here is read-only and evidence-gated: each function refuses to
   speak until it has enough data to mean it. Silence is the correct output for
   a log with three sessions in it.
   ============================================================================ */

const Analysis = (function () {

  /* ---------------------------------------------------------------------
     Strength balance
     ---------------------------------------------------------------------
     Reference ratios between opposing patterns. These are the widely quoted
     structural-balance figures, kept deliberately loose: they are a screen for
     a real imbalance, not a target to train toward. A ratio inside the band is
     reported as balanced and nothing is said about it.
     --------------------------------------------------------------------- */

  const BALANCE_PAIRS = [
    { id: "push_pull",      a: ["horizontal_push", "incline_push"], b: ["horizontal_pull"] },
    { id: "vert_pull_push", a: ["vertical_pull"],    b: ["vertical_push"] },
    { id: "quad_ham",       a: ["knee_extension"],   b: ["knee_flexion"] },
    { id: "squat_hinge",    a: ["squat"],            b: ["hinge"] },
  ];

  /* One side being roughly 40% further along than the other, relative to what
     each is expected to lift, is the point where it is worth mentioning.

     The band alone is not enough, though. Loads move in the increments the
     equipment has, so a 20 kg shoulder-press stack climbing 5 kg gains 25% in
     one session while a 100 kg leg press gains 5% — train everything perfectly
     evenly and the light lifts still race ahead on paper. An imbalance is only
     worth raising when the weaker side has actually stopped moving, or has
     fallen behind what it should be lifting outright. Two sides both
     progressing well is not a problem, whatever the ratio says. */
  const BALANCE_LOW = 0.70, BALANCE_HIGH = 1.43, BALANCE_IDEAL = 1.0;
  const STALLED_SLOPE = 0.15;      // kg/week of estimated 1RM
  const UNDER_EXPECTED = 0.85;     // relative to the expected load for this lifter

  /**
   * Comparing raw kilos across patterns is meaningless: a leg press moves two
   * to three times a squat, and a machine row is not a barbell row. So each
   * lift is scored against what someone of this bodyweight and experience would
   * be expected to handle on it — the same coefficients the engine uses to seed
   * a first working weight — and the patterns are compared on that.
   *
   * A relative score of 1.0 means "exactly where expected". The ratio between
   * two patterns then says which is further along, in units that survive the
   * comparison.
   */
  function expected1RM(exercise, profile) {
    const seed = Progression.seedWeight(exercise, profile, [10, 12]);
    const bodyweight = Number(profile.weightKg) || 80;
    /* Both sides of the comparison have to be in the same units. A logged
       strength series is an *effective* load — bodyweight minus assistance on
       an assisted machine, both dumbbells on a unilateral lift — so the
       expected seed goes through the same conversion before anything is
       divided by it. Without this, an assisted pull-up's expected figure is its
       assistance stack while its actual is what the lifter moved, and the ratio
       is arithmetic on unrelated numbers. */
    /* Bodyweight and timed movements have no calibrated expectation: there is
       no coefficient that says how many pull-ups a 114 kg beginner should
       manage, and inventing one would put a fabricated number into a real
       comparison. They are tracked for progress but sit out the balance
       check, which needs both sides scored the same way. */
    if (exercise.loadType === "bodyweight" || exercise.loadType === "timed") return 0;

    const raw = seed / 0.9;                      // undo the deliberate seed haircut
    const effective = Progression.effectiveLoad(raw, exercise, bodyweight);
    if (!effective) return 0;
    // A seed is a working weight for about ten reps; convert it to a 1RM.
    return Progression.estimate1RM(effective, 10, 8);
  }

  function patternStrength(profile, patterns) {
    let best = 0, bestId = null, bestRelative = 0, sessions = 0;
    EXERCISES.filter(ex => patterns.includes(ex.pattern)).forEach(ex => {
      const series = Progression.strengthSeries(profile, ex.id);
      if (series.length < 2) return;
      const expected = expected1RM(ex, profile);
      if (!expected) return;                       // bodyweight work has no seed to score against
      sessions = Math.max(sessions, series.length);
      const e1rm = series[series.length - 1].e1rm;
      const relative = e1rm / expected;
      if (relative > bestRelative) { bestRelative = relative; best = e1rm; bestId = ex.id; }
    });
    return { e1rm: best, relative: Math.round(bestRelative * 100) / 100, exerciseId: bestId, sessions };
  }

  /**
   * Compare opposing patterns. Needs both sides logged across at least two
   * sessions each, or the ratio is noise dressed up as a finding.
   */
  function balance(profile) {
    return BALANCE_PAIRS.map(pair => {
      const a = patternStrength(profile, pair.a);
      const b = patternStrength(profile, pair.b);
      if (!a.e1rm || !b.e1rm || a.sessions < 2 || b.sessions < 2) return null;
      if (!a.relative || !b.relative) return null;
      const ratio = Math.round((a.relative / b.relative) * 100) / 100;
      const status = ratio < BALANCE_LOW ? "a_weak" : ratio > BALANCE_HIGH ? "b_weak" : "balanced";
      const base = { ...pair, ratio, status, a, b, ideal: BALANCE_IDEAL, low: BALANCE_LOW, high: BALANCE_HIGH };
      if (status === "balanced") return base;

      // Which side needs the work, and roughly how many kilos of catching up.
      const weak = status === "a_weak" ? a : b;
      const strong = status === "a_weak" ? b : a;

      /* Only raise it if the weaker side is genuinely stuck or genuinely
         behind. A wide ratio between two lifts that are both climbing is an
         artefact of plate sizes, not something to change training over. */
      const weakTrend = Progression.strengthTrend(Progression.strengthSeries(profile, weak.exerciseId));
      const stalled = weakTrend.slopePerWeek != null && weakTrend.slopePerWeek <= STALLED_SLOPE;
      const behind = weak.relative < UNDER_EXPECTED;
      if (!stalled && !behind) return { ...base, status: "balanced", suppressed: true };
      const weakExpected = expected1RM(exerciseById(weak.exerciseId), profile);
      const targetRelative = strong.relative * BALANCE_LOW;
      return {
        ...base,
        weakExerciseId: weak.exerciseId,
        strongExerciseId: strong.exerciseId,
        weakStalled: stalled,
        shortfallKg: Math.max(0, Math.round((targetRelative * weakExpected - weak.e1rm) * 10) / 10),
      };
    }).filter(Boolean);
  }

  /* ---------------------------------------------------------------------
     Accumulated fatigue
     ---------------------------------------------------------------------
     A mesocycle deload is scheduled on the calendar, which assumes fatigue
     accumulates at the rate the calendar expects. Sometimes it does not — a bad
     fortnight of sleep, a stressful month, a block that was too aggressive.
     These three signals together say so before the calendar does.
     --------------------------------------------------------------------- */

  function fatigue(profile) {
    const log = (profile.sessionLog || []).slice().sort((x, y) => x.date.localeCompare(y.date));
    if (log.length < 8) return { ready: false, reason: "not enough sessions" };

    const now = Date.now();
    const inWindow = (s, fromDays, toDays) => {
      const age = (now - new Date(s.date).getTime()) / 86400000;
      return age >= toDays && age < fromDays;
    };
    const recent = log.filter(s => inWindow(s, 14, 0));
    const prior = log.filter(s => inWindow(s, 28, 14));
    if (recent.length < 3 || prior.length < 3) return { ready: false, reason: "not enough recent history" };

    /* 1. Effort at the same work: is it costing more RPE than it did? */
    const meanRpe = sessions => {
      const rpes = sessions.flatMap(s => (s.sets || []).filter(x => x.done && x.rpe != null).map(x => x.rpe));
      return rpes.length ? rpes.reduce((a, b) => a + b, 0) / rpes.length : null;
    };
    const recentRpe = meanRpe(recent), priorRpe = meanRpe(prior);
    const rpeDrift = (recentRpe != null && priorRpe != null)
      ? Math.round((recentRpe - priorRpe) * 100) / 100 : null;

    /* 2. Are the prescribed reps actually being hit? */
    const completion = sessions => {
      let hit = 0, total = 0;
      sessions.forEach(s => {
        const targets = Object.fromEntries((s.blocks || []).map(b => [b.exerciseId, b]));
        (s.sets || []).filter(x => x.done).forEach(x => {
          const t = targets[x.exerciseId];
          if (!t) return;
          total++; if (x.reps >= t.repLo) hit++;
        });
      });
      return total ? hit / total : null;
    };
    const recentCompletion = completion(recent);

    /* 3. Is measured strength still moving? */
    const slopes = Object.keys(profile.prescriptions || {})
      .map(id => Progression.strengthTrend(Progression.strengthSeries(profile, id)).slopePerWeek)
      .filter(v => v != null);
    const meanSlope = slopes.length ? slopes.reduce((a, b) => a + b, 0) / slopes.length : null;

    const signals = [];
    if (rpeDrift != null && rpeDrift >= 0.6) signals.push("effort");
    if (recentCompletion != null && recentCompletion < 0.85) signals.push("reps");
    if (meanSlope != null && meanSlope <= 0.05) signals.push("strength");

    return {
      ready: true,
      rpeDrift, recentRpe: round1(recentRpe), priorRpe: round1(priorRpe),
      completion: recentCompletion == null ? null : Math.round(recentCompletion * 100),
      slopePerWeek: meanSlope == null ? null : Math.round(meanSlope * 100) / 100,
      signals,
      /* Two of three is the threshold. One on its own is a bad week, not a
         block that has run its course. */
      overreached: signals.length >= 2,
    };
  }

  /* ---------------------------------------------------------------------
     Rep drop-off
     ---------------------------------------------------------------------
     Reps collapsing across the sets of one exercise is a specific, fixable
     problem — and which fix depends on where the collapse happens.
     --------------------------------------------------------------------- */

  function dropOff(profile) {
    const out = [];
    const log = (profile.sessionLog || []).slice(-6);
    const byExercise = {};
    log.forEach(s => {
      const sets = (s.sets || []).filter(x => x.done);
      const grouped = {};
      sets.forEach(x => { (grouped[x.exerciseId] = grouped[x.exerciseId] || []).push(x); });
      Object.entries(grouped).forEach(([id, list]) => {
        if (list.length < 3) return;
        const ordered = list.slice().sort((a, b) => a.setIndex - b.setIndex);
        const first = ordered[0].reps, last = ordered[ordered.length - 1].reps;
        if (!first) return;
        (byExercise[id] = byExercise[id] || []).push({
          drop: (first - last) / first, first, last, sets: ordered.length,
          restSec: (s.blocks || []).find(b => b.exerciseId === id)?.restSec || null,
        });
      });
    });

    Object.entries(byExercise).forEach(([id, records]) => {
      if (records.length < 2) return;                    // one session is not a pattern
      const mean = records.reduce((a, r) => a + r.drop, 0) / records.length;
      if (mean < 0.30) return;                           // under 30% is normal fatigue
      const latest = records[records.length - 1];
      out.push({
        exerciseId: id,
        dropPct: Math.round(mean * 100),
        first: latest.first, last: latest.last, sets: latest.sets,
        restSec: latest.restSec,
        sessions: records.length,
      });
    });
    return out.sort((a, b) => b.dropPct - a.dropPct);
  }

  /* ---------------------------------------------------------------------
     Forecasting
     ---------------------------------------------------------------------
     A projection is only worth showing with a measure of how well the line
     actually fits. A confident-sounding date drawn through scattered points is
     worse than saying nothing.
     --------------------------------------------------------------------- */

  function forecast(profile, exerciseId, targetWeight) {
    const series = Progression.strengthSeries(profile, exerciseId);
    if (series.length < 4) return null;

    const t0 = new Date(series[0].date).getTime();
    const xs = series.map(p => (new Date(p.date).getTime() - t0) / (7 * 86400000));
    const ys = series.map(p => p.e1rm);
    const n = xs.length;
    const mx = xs.reduce((a, b) => a + b, 0) / n;
    const my = ys.reduce((a, b) => a + b, 0) / n;
    let num = 0, den = 0;
    for (let i = 0; i < n; i++) { num += (xs[i] - mx) * (ys[i] - my); den += (xs[i] - mx) ** 2; }
    if (!den) return null;
    const slope = num / den, intercept = my - slope * mx;

    // R²: how much of the movement the straight line actually explains.
    let ssRes = 0, ssTot = 0;
    for (let i = 0; i < n; i++) {
      const pred = intercept + slope * xs[i];
      ssRes += (ys[i] - pred) ** 2;
      ssTot += (ys[i] - my) ** 2;
    }
    const r2 = ssTot ? Math.max(0, 1 - ssRes / ssTot) : 0;
    if (slope <= 0.05 || r2 < 0.4) return null;          // flat or too scattered to project

    const ex = exerciseById(exerciseId);
    const current = ys[n - 1];
    const rx = (profile.prescriptions || {})[exerciseId];
    /* The milestone has to be worth naming. Rounding to the next increment
       produces projections like "+0.8 kg, about four days away", which is
       noise dressed as insight. Aim at the next round five kilos beyond a 5%
       improvement, so the number means something when it arrives. */
    const target = targetWeight || Math.max(
      Math.ceil((current * 1.05) / 5) * 5,
      Math.ceil((current + 2.5) / 5) * 5,
    );
    if (target <= current) return null;

    const weeks = (target - current) / slope;
    if (weeks > 26) return null;                          // beyond a useful horizon
    const when = new Date(Date.now() + weeks * 7 * 86400000);
    return {
      exerciseId, current: Math.round(current * 10) / 10, target,
      slopePerWeek: Math.round(slope * 100) / 100,
      weeks: Math.round(weeks * 10) / 10,
      date: when.toISOString().slice(0, 10),
      confidence: r2 >= 0.75 ? "high" : "medium",
      r2: Math.round(r2 * 100) / 100,
      currentLoad: rx ? rx.weight : null,
    };
  }

  /** The lift with the clearest upward trend, for a single headline figure. */
  function bestForecast(profile) {
    return Object.keys(profile.prescriptions || {})
      .map(id => forecast(profile, id))
      .filter(Boolean)
      .sort((a, b) => (b.confidence === "high") - (a.confidence === "high") || a.weeks - b.weeks)[0] || null;
  }

  /* ---------------------------------------------------------------------
     Session ordering
     ---------------------------------------------------------------------
     Fatiguing work placed before a main lift takes weight off that lift for no
     benefit. Cheap to check, easy to fix, and nobody notices it themselves.
     --------------------------------------------------------------------- */

  function ordering(session) {
    const problems = [];
    const blocks = session.blocks || [];
    for (let i = 0; i < blocks.length; i++) {
      const here = exerciseById(blocks[i].exerciseId);
      if (!here || blocks[i].role !== "primary") continue;
      for (let j = 0; j < i; j++) {
        const before = exerciseById(blocks[j].exerciseId);
        if (!before) continue;
        const shared = Object.keys(before.contribution || {})
          .filter(m => (here.contribution || {})[m] >= 0.5);
        if (before.fatigue >= 2 && blocks[j].role !== "primary" && shared.length) {
          problems.push({
            before: blocks[j].exerciseId, primary: blocks[i].exerciseId,
            muscle: shared[0], templateId: session.templateId,
          });
        }
      }
    }
    return problems;
  }

  function round1(v) { return v == null ? null : Math.round(v * 10) / 10; }

  return { balance, fatigue, dropOff, forecast, bestForecast, ordering,
           patternStrength, expected1RM, BALANCE_PAIRS };
})();
