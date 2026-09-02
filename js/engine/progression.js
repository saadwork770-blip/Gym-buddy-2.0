/* ============================================================================
   GymBuddy 2.0 — engine/progression.js
   ----------------------------------------------------------------------------
   The part that decides what weight goes on the bar next time.

   It is a rule engine, not a black box: every recommendation comes back with
   the numbers that produced it, so the app can tell you *why* it wants you to
   add 5 kg instead of just asserting it. Four mechanisms combine:

     1. Double progression — climb to the top of the rep range, then add load.
        The standard, and the safest default when effort data is missing.
     2. RPE autoregulation — how hard the last session actually felt decides
        the SIZE of the jump. Three sets at RPE 6.5 earns a bigger jump than
        three sets that barely scraped through at RPE 9.
     3. Estimated 1RM tracking — an effort-adjusted Epley estimate per set
        gives a single strength number that is comparable across rep ranges,
        which is what plateau detection is actually run against.
     4. Mesocycle waving — planned volume ramps and a scheduled deload, so
        fatigue is dumped on purpose instead of accumulating into a stall.

   Everything is rounded through the real increment of the real machine: a
   selectorised stack moves in 5 kg pins and the engine will never ask for 47.5.
   ============================================================================ */

const Progression = (function () {

  /* ---------------------------------------------------------------------
     Rounding & load maths
     --------------------------------------------------------------------- */

  /** Round a load to something you can actually select on that equipment. */
  function roundToIncrement(weight, loadType, overrides) {
    const spec = LOAD_TYPES[loadType] || LOAD_TYPES.machine_stack;
    const inc = (overrides && overrides[loadType]) || spec.increment;
    if (!inc) return Math.max(0, Math.round(weight));
    const rounded = Math.round(weight / inc) * inc;
    const floored = Math.max(spec.min || 0, rounded);
    // Kill floating point dust from 2.5/1.25 steps.
    return Math.round(floored * 100) / 100;
  }

  /**
   * Scale a load by a factor and round it to the equipment — guaranteeing the
   * result actually moves in the intended direction.
   *
   * Plain rounding is not enough: a 6% back-off from 35 kg on a machine with
   * 5 kg pins rounds to 35 kg, so the engine would announce a deload and then
   * prescribe the identical weight. Where the rounding cancels the change, step
   * one full increment instead. Works for assisted machines too, where "easier"
   * means MORE on the stack, because the direction is taken from the factor
   * rather than assumed.
   */
  function adjustedLoad(current, factor, exercise, increments) {
    const spec = exercise.loadSpec || LOAD_TYPES[exercise.loadType] || LOAD_TYPES.machine_stack;
    const inc = (increments && increments[exercise.loadType]) || spec.increment;
    const target = current * factor;
    let w = roundToIncrement(target, exercise.loadType, increments);
    if (!inc) return w;
    const wantLower = target < current;
    if (wantLower && w >= current) w = Math.max(spec.min || 0, current - inc);
    if (!wantLower && w <= current) w = current + inc;
    return Math.round(w * 100) / 100;
  }

  /** "+1.4" / "-0.6" — a signed number for prose, in the current locale. */
  function signed(value) {
    const v = Math.round(Number(value) * 100) / 100;
    return `${v > 0 ? "+" : ""}${I18n.num(v)}`;
  }

  /** Reps in reserve implied by a reported RPE (RPE 8 = 2 reps left). */
  function rirFromRpe(rpe) {
    if (rpe == null || isNaN(rpe)) return 2;
    return Math.max(0, 10 - Number(rpe));
  }

  /**
   * Effort-adjusted Epley estimate.
   * Plain Epley assumes the set was taken to failure. Adding the reps left in
   * reserve corrects for sets that stopped short, which is nearly all of them.
   */
  function estimate1RM(weight, reps, rpe) {
    const w = Number(weight) || 0;
    const r = Number(reps) || 0;
    if (w <= 0 || r <= 0) return 0;
    const effectiveReps = r + rirFromRpe(rpe);
    return Math.round(w * (1 + effectiveReps / 30) * 10) / 10;
  }

  /** Inverse: the load predicted to allow `reps` reps at a given RPE. */
  function loadForReps(e1rm, reps, targetRpe) {
    const effectiveReps = reps + rirFromRpe(targetRpe);
    return e1rm / (1 + effectiveReps / 30);
  }

  /**
   * Which plates go on each side of a barbell/Smith bar.
   * Small thing, but it is the difference between "put 62.5 kg on" and a
   * number you can actually load without doing arithmetic mid-session.
   */
  function plateBreakdown(totalKg, barKg) {
    const bar = barKg == null ? 20 : barKg;
    const plates = [25, 20, 15, 10, 5, 2.5, 1.25];
    let perSide = (totalKg - bar) / 2;
    if (perSide < 0) return { bar, perSide: [], exact: false };
    const out = [];
    plates.forEach(p => {
      while (perSide >= p - 0.001) { out.push(p); perSide = Math.round((perSide - p) * 100) / 100; }
    });
    return { bar, perSide: out, exact: perSide < 0.001 };
  }

  /* ---------------------------------------------------------------------
     History analysis
     --------------------------------------------------------------------- */

  /** All logged sets for one exercise, newest session first. */
  function historyFor(profile, exerciseId) {
    const out = [];
    const log = (profile && profile.sessionLog) || [];
    for (let i = log.length - 1; i >= 0; i--) {
      const session = log[i];
      const sets = (session.sets || []).filter(s => s.exerciseId === exerciseId && s.done && Number(s.reps) > 0);
      if (sets.length) out.push({ date: session.date, sessionId: session.id, sets });
    }
    return out;
  }

  /**
   * The load actually being moved by the body.
   * On an assisted machine the number on the stack is help, not resistance —
   * 40 kg of assistance means you lifted your bodyweight MINUS 40. Reading the
   * stack number straight would make "needing less help" look like getting
   * weaker, which is exactly backwards.
   */
  function effectiveLoad(weight, exercise, bodyweightKg) {
    if (!exercise) return Number(weight) || 0;
    if (exercise.inverseLoad) return Math.max(0, (bodyweightKg || 80) - (Number(weight) || 0));
    if (exercise.loadType === "bodyweight") return bodyweightKg || 0;
    if (exercise.unilateral && exercise.loadType === "dumbbell") return (Number(weight) || 0) * 2;
    return Number(weight) || 0;
  }

  /** Best effort-adjusted e1RM in a single session's worth of sets. */
  function sessionBest1RM(sets, exercise, bodyweightKg) {
    return sets.reduce((best, s) => {
      const load = exercise ? effectiveLoad(s.weight, exercise, bodyweightKg) : (Number(s.weight) || 0);
      return Math.max(best, estimate1RM(load, s.reps, s.rpe));
    }, 0);
  }

  /** e1RM per session, oldest first — the series the trend charts plot. */
  function strengthSeries(profile, exerciseId) {
    const ex = exerciseById(exerciseId);
    const bw = Number(profile && profile.weightKg) || 80;
    return historyFor(profile, exerciseId)
      .map(h => ({ date: h.date, e1rm: sessionBest1RM(h.sets, ex, bw) }))
      .filter(p => p.e1rm > 0)
      .reverse();
  }

  /**
   * Least-squares slope of the e1RM series, in kg per week.
   * Used for plateau detection: a flat or falling slope over several sessions
   * is a real stall, whereas one bad session usually is not.
   */
  function strengthTrend(series) {
    if (!series || series.length < 3) return { slopePerWeek: null, samples: series ? series.length : 0 };
    const t0 = new Date(series[0].date).getTime();
    const xs = series.map(p => (new Date(p.date).getTime() - t0) / (7 * 86400000));
    const ys = series.map(p => p.e1rm);
    const n = xs.length;
    const mx = xs.reduce((a, b) => a + b, 0) / n;
    const my = ys.reduce((a, b) => a + b, 0) / n;
    let num = 0, den = 0;
    for (let i = 0; i < n; i++) { num += (xs[i] - mx) * (ys[i] - my); den += (xs[i] - mx) ** 2; }
    if (!den) return { slopePerWeek: null, samples: n };
    return { slopePerWeek: Math.round((num / den) * 100) / 100, samples: n, first: ys[0], last: ys[n - 1] };
  }

  /* ---------------------------------------------------------------------
     Seeding a first weight
     --------------------------------------------------------------------- */

  /**
   * With no history at all there is nothing to progress from, so the first
   * session is a calibration session: a deliberately light estimate from
   * bodyweight, experience and sex, to be treated as a feel-out set rather
   * than a target. The engine says so in the reason string, and corrects
   * hard on the very next session once real data exists.
   */
  function seedWeight(exercise, profile, repRange) {
    const meta = exercise;
    if (!meta.startCoef) return 0;
    const bw = Number(profile.weightKg) || 80;
    const level = LEVEL_PROFILES[profile.level] || LEVEL_PROFILES["Some experience"];
    // Coefficients are calibrated against an average adult male frame; scale
    // for a lighter/female frame so the seed is not systematically too heavy.
    const sexScale = (profile.sex === "Female") ? 0.72 : 1;
    let raw = bw * meta.startCoef * level.strengthScale * sexScale;
    if (meta.inverseLoad) {
      // Assisted machines: the stack is help. A heavier, less experienced
      // lifter needs MORE assistance, so the coefficient runs the other way.
      raw = bw * meta.startCoef * (2 - level.strengthScale) * sexScale;
    }

    /* The coefficients describe a load for roughly 10 reps. A strength block
       asking for 4–6 needs a heavier bar and a 15-rep accessory needs a
       lighter one, so convert through an estimated 1RM rather than handing
       every goal the same number. Assisted machines are skipped — the
       relationship runs backwards there and the extra precision is not worth
       the risk of over-assisting. */
    if (repRange && !meta.inverseLoad && meta.loadType !== "bodyweight" && meta.loadType !== "timed") {
      const midReps = (repRange[0] + repRange[1]) / 2;
      if (Math.abs(midReps - 10) > 0.5) {
        const impliedE1RM = raw * (1 + (10 + 2) / 30);       // 10 reps @ RPE 8
        raw = loadForReps(impliedE1RM, midReps, 8);
      }
    }

    // A deliberate 10% haircut: the first session is a feel-out, and starting
    // too light costs one session while starting too heavy can cost weeks.
    return roundToIncrement(raw * 0.9, meta.loadType, profile.settings && profile.settings.increments);
  }

  /* ---------------------------------------------------------------------
     The recommendation
     --------------------------------------------------------------------- */

  /* Tone only — the visible label comes from `action.*` in the dictionaries. */
  const ACTIONS = {
    calibrate:   { tone: "info" },
    increase:    { tone: "good" },
    add_reps:    { tone: "good" },
    hold:        { tone: "neutral" },
    reduce:      { tone: "warn" },
    deload:      { tone: "warn" },
    stall_break: { tone: "warn" },
  };

  /**
   * Decide the prescription for one exercise's next session.
   *
   * ctx = { profile, exercise, phase, readiness }
   *   phase     — from Periodization.phaseFor(): { week, type, volumeScale,
   *               intensityScale, rpeCap }
   *   readiness — optional 0..100 from the pre-session check-in
   *
   * Returns a prescription object carrying the decision AND its evidence.
   */
  function recommend(ctx) {
    const { profile, exercise } = ctx;
    const phase = ctx.phase || { week: 1, type: "accumulation", volumeScale: 1, intensityScale: 1, rpeCap: 8.5 };
    const goal = GOAL_PROFILES[profile.goal] || GOAL_PROFILES["General fitness"];
    const level = LEVEL_PROFILES[profile.level] || LEVEL_PROFILES["Some experience"];
    const increments = (profile.settings && profile.settings.increments) || {};
    const inverse = !!exercise.inverseLoad;

    // Target rep range comes from the goal, not the printed plan text, so a
    // strength user gets 4–6 on compounds and a fat-loss user gets 8–12.
    const band = exercise.role === "compound" ? goal.repRange.compound : goal.repRange.isolation;
    let repLo = band[0], repHi = band[1];
    if (exercise.loadType === "timed") { repLo = 30; repHi = 60; }
    if (exercise.loadType === "bodyweight") { repLo = Math.max(repLo, 8); repHi = Math.max(repHi, 15); }

    const prior = (profile.prescriptions && profile.prescriptions[exercise.id]) || null;
    const history = historyFor(profile, exercise.id);
    const last = history[0] || null;

    const base = {
      exerciseId: exercise.id,
      loadType: exercise.loadType,
      unit: exercise.loadSpec.unit,
      inverse,
      sets: exercise.defaultSets || 3,
      repLo, repHi,
      restSec: Math.round((exercise.restSec || 90) * goal.restScale),
      rpeCap: Math.min(level.rpeCap, phase.rpeCap),
      stalls: prior ? (prior.stalls || 0) : 0,
      evidence: null,
    };

    /* ---- A manual override outranks the engine ----
       If you set the weight yourself, that stands until you have actually
       trained on it — otherwise the next plan rebuild would quietly throw your
       number away and put its own back, which is the opposite of an override.
       Once a session is logged the normal rules resume, progressing from the
       weight you chose. */
    if (prior && prior.manual && prior.weight != null &&
        (!last || new Date(`${last.date}T23:59:59`) < new Date(prior.updatedAt))) {
      return finish({
        ...base,
        weight: prior.weight,
        sets: prior.sets || base.sets,
        repLo: prior.repLo || repLo,
        repHi: prior.repHi || repHi,
        action: "hold",
        manual: true,
        delta: 0,
        confidence: "high",
        reason: I18n.m("engine.prog.manual", { load: I18n.ref("load", prior.weight, exercise.id) }),
      }, ctx, phase);
    }

    /* ---- No history: calibrate ---- */
    if (!last) {
      const seed = prior && prior.weight ? prior.weight : seedWeight(exercise, profile, [repLo, repHi]);
      return finish({
        ...base,
        weight: seed,
        action: "calibrate",
        delta: 0,
        confidence: "low",
        reason: I18n.m(prior && prior.weight ? "engine.prog.calibrateCarry" : "engine.prog.calibrateNew",
                       { load: I18n.ref("load", seed, exercise.id) }),
      }, ctx, phase);
    }

    /* ---- Read the last session ---- */
    const sets = last.sets;
    const workingSets = sets.filter(s => !s.warmup);
    const useSets = workingSets.length ? workingSets : sets;
    const reps = useSets.map(s => Number(s.reps) || 0);
    const weights = useSets.map(s => Number(s.weight) || 0);
    const rpes = useSets.map(s => (s.rpe == null ? null : Number(s.rpe))).filter(v => v != null);
    const topWeight = Math.max(...weights);
    const minReps = Math.min(...reps);
    const avgRpe = rpes.length ? rpes.reduce((a, b) => a + b, 0) / rpes.length : null;
    const lastRpe = rpes.length ? rpes[rpes.length - 1] : null;
    const e1rm = sessionBest1RM(useSets, exercise, Number(profile.weightKg) || 80);
    const priorRange = prior ? { lo: prior.repLo, hi: prior.repHi } : { lo: repLo, hi: repHi };
    const hitTop = reps.every(r => r >= priorRange.hi);
    const hitLow = reps.every(r => r >= priorRange.lo);
    const setsCompleted = useSets.length >= (prior ? prior.sets : base.sets);

    base.evidence = {
      date: last.date,
      weight: topWeight,
      reps, avgRpe: avgRpe == null ? null : Math.round(avgRpe * 10) / 10,
      e1rm, setsCompleted, hitTop, hitLow,
      target: `${priorRange.lo}–${priorRange.hi}`,
    };

    /* ---- Scheduled deload beats every other rule ---- */
    if (phase.type === "deload") {
      const w = adjustedLoad(topWeight, inverse ? 1.1 : 0.9, exercise, increments);
      return finish({
        ...base,
        weight: w,
        sets: Math.max(2, Math.round(base.sets * phase.volumeScale)),
        action: "deload",
        delta: Math.round((w - topWeight) * 100) / 100,
        confidence: "high",
        reason: I18n.m("engine.prog.deload", {
          week: phase.week,
          from: I18n.ref("load", topWeight, exercise.id), to: I18n.ref("load", w, exercise.id),
          pct: Math.round(phase.volumeScale * 100),
        }),
      }, ctx, phase);
    }

    /* ---- Plateau: three sessions with no meaningful progress ---- */
    const series = strengthSeries(profile, exercise.id);
    const trend = strengthTrend(series);
    const stalled = base.stalls >= 2 && (trend.slopePerWeek == null || trend.slopePerWeek <= 0.15);
    if (stalled) {
      const w = adjustedLoad(topWeight, inverse ? 1.08 : 0.92, exercise, increments);
      return finish({
        ...base,
        weight: w,
        stalls: 0,
        action: "stall_break",
        confidence: "high",
        delta: Math.round((w - topWeight) * 100) / 100,
        reason: I18n.m("engine.prog.stallBreak", {
          name: I18n.ref("ex", exercise.id),
          count: base.stalls + 1,
          trend: trend.slopePerWeek != null
            ? I18n.m("engine.prog.stallTrend", { slope: signed(trend.slopePerWeek) }) : "",
          to: I18n.ref("load", w, exercise.id),
        }),
      }, ctx, phase);
    }

    /* ---- Bodyweight / timed work progresses in reps or seconds ---- */
    if (exercise.loadType === "bodyweight" || exercise.loadType === "timed") {
      const timed = exercise.loadType === "timed";
      const unitKey = timed ? "engine.prog.unitSeconds" : "engine.prog.unitReps";
      if (hitTop) {
        const step = timed ? 10 : 2;
        const newHi = priorRange.hi + step;
        const newLo = priorRange.lo + step;
        return finish({
          ...base, weight: 0, repLo: newLo, repHi: newHi, action: "increase", delta: 0, confidence: "high",
          reason: I18n.m("engine.prog.bodyweightUp", {
            hi: priorRange.hi, lo: newLo, newHi, unit: I18n.m(unitKey) }),
        }, ctx, phase);
      }
      return finish({
        ...base, weight: 0, repLo: priorRange.lo, repHi: priorRange.hi, action: "add_reps", delta: 0, confidence: "medium",
        reason: I18n.m("engine.prog.bodyweightHold", {
          lo: priorRange.lo, hi: priorRange.hi, unit: I18n.m(unitKey),
          increment: I18n.m(timed ? "engine.prog.incrementSeconds" : "engine.prog.incrementRep"),
        }),
      }, ctx, phase);
    }

    /* ---- Failed the bottom of the range ---- */
    if (!hitLow || !setsCompleted) {
      const hard = avgRpe != null && avgRpe >= 9.3;
      if (hard) {
        const w = adjustedLoad(topWeight, inverse ? 1.06 : 0.94, exercise, increments);
        const drop = Math.round((topWeight - w) * 100) / 100;
        return finish({
          ...base, weight: w, action: "reduce", delta: Math.round((w - topWeight) * 100) / 100, confidence: "high",
          reason: I18n.m("engine.prog.reduce", {
            reps: reps.join("/"), from: I18n.ref("load", topWeight, exercise.id),
            lo: priorRange.lo, hi: priorRange.hi, rpe: base.evidence.avgRpe,
            drop: Math.abs(drop), to: I18n.ref("load", w, exercise.id),
          }),
        }, ctx, phase);
      }
      return finish({
        ...base, weight: topWeight, action: "hold", stalls: base.stalls + 1, delta: 0, confidence: "medium",
        reason: I18n.m("engine.prog.holdShort", {
          lo: priorRange.lo, reps: reps.join("/"),
          rpe: base.evidence.avgRpe ? I18n.m("engine.prog.holdShortRpe", { rpe: base.evidence.avgRpe }) : "",
        }),
      }, ctx, phase);
    }

    /* ---- Cleared the top of the range: load up ---- */
    if (hitTop && setsCompleted) {
      const relPct = (exercise.role === "compound" ? 0.035 : 0.05)
        * goal.progressionRate
        * level.progressionMultiplier
        * (phase.intensityScale || 1);
      let step = Math.max(exercise.loadSpec.increment, topWeight * relPct);

      // Autoregulation: how hard it felt sets the size of the jump.
      let effortNote = "";
      if (avgRpe != null) {
        const rpe = base.evidence.avgRpe;
        if (avgRpe <= 6.5)      { step *= 2.0; effortNote = I18n.m("engine.prog.effortVeryEasy", { rpe }); }
        else if (avgRpe <= 7.5) { step *= 1.4; effortNote = I18n.m("engine.prog.effortEasy", { rpe }); }
        else if (avgRpe >= 9)   { step = exercise.loadSpec.increment; effortNote = I18n.m("engine.prog.effortHard", { rpe }); }
      }
      // Never jump more than 10% in one go — but never less than the smallest
      // increment the equipment actually has, or a light dumbbell lift would
      // round straight back to the weight it is already using and never move.
      step = Math.max(exercise.loadSpec.increment, Math.min(step, topWeight * 0.10 || step));

      const w = roundToIncrement(topWeight + (inverse ? -step : step), exercise.loadType, increments);
      const realDelta = Math.round((w - topWeight) * 100) / 100;
      const direction = I18n.m(inverse ? "engine.prog.directionLess" : "engine.prog.directionMore");
      return finish({
        ...base,
        weight: w,
        action: "increase",
        delta: realDelta,
        stalls: 0,
        confidence: avgRpe != null ? "high" : "medium",
        reason: I18n.m("engine.prog.increase", {
          reps: reps.join("/"), from: I18n.ref("load", topWeight, exercise.id), effort: effortNote,
          to: I18n.ref("load", w, exercise.id), delta: Math.abs(realDelta), direction, lo: repLo,
        }),
      }, ctx, phase);
    }

    /* ---- Inside the range: chase reps before load ---- */
    const nextRepTarget = Math.min(priorRange.hi, minReps + 1);
    return finish({
      ...base,
      weight: topWeight,
      action: "add_reps",
      delta: 0,
      stalls: base.stalls,
      confidence: "high",
      reason: I18n.m("engine.prog.addReps", {
        load: I18n.ref("load", topWeight, exercise.id), lo: priorRange.lo, hi: priorRange.hi,
        reps: reps.join("/"),
        rpe: base.evidence.avgRpe ? I18n.m("engine.prog.addRepsRpe", { rpe: base.evidence.avgRpe }) : "",
        target: nextRepTarget, sets: base.sets,
      }),
    }, ctx, phase);
  }

  /* Apply mesocycle volume scaling and readiness modulation, then finalise. */
  function finish(rx, ctx, phase) {
    const profile = ctx.profile;
    const level = LEVEL_PROFILES[profile.level] || LEVEL_PROFILES["Some experience"];

    // Mesocycle volume wave (accumulation weeks add a set to compounds).
    if (phase.setBonus && rx.action !== "deload") {
      rx.sets = rx.sets + (rx.exerciseId && exerciseById(rx.exerciseId).role === "compound" ? phase.setBonus : 0);
    }
    if (phase.volumeScale && phase.type === "deload") {
      rx.sets = Math.max(2, Math.round(rx.sets * phase.volumeScale));
    }

    // Readiness modulation — a bad night's sleep should not be paid for with
    // the same load as a good one.
    const readiness = ctx.readiness;
    if (readiness && readiness.score != null && rx.action !== "calibrate") {
      const mod = readinessModifier(readiness.score);
      if (mod.loadScale !== 1) {
        const ex = exerciseById(rx.exerciseId);
        const adj = roundToIncrement(rx.weight * (ex.inverseLoad ? 2 - mod.loadScale : mod.loadScale),
                                     rx.loadType, profile.settings && profile.settings.increments);
        if (adj !== rx.weight) {
          rx.readinessAdjusted = { from: rx.weight, to: adj, noteKey: mod.noteKey };
          rx.weight = adj;
        }
      }
      if (mod.setDelta) rx.sets = Math.max(2, rx.sets + mod.setDelta);
      rx.rpeCap = Math.min(rx.rpeCap, mod.rpeCap || rx.rpeCap);
    }

    rx.sets = Math.max(1, Math.min(6, rx.sets));
    rx.rpeCap = Math.min(rx.rpeCap, level.rpeCap);
    rx.warmups = buildWarmups(rx);
    return rx;
  }

  /**
   * Readiness → session modulation.
   * A check-in score under 50 means the session is salvaged, not skipped: a
   * lighter, shorter session preserves the habit and still drives adaptation.
   */
  function readinessModifier(score) {
    if (score >= 85) return { loadScale: 1,    setDelta: 0,  rpeCap: 10,  noteKey: "engine.readiness.green" };
    if (score >= 70) return { loadScale: 1,    setDelta: 0,  rpeCap: 9,   noteKey: "engine.readiness.normal" };
    if (score >= 55) return { loadScale: 0.95, setDelta: 0,  rpeCap: 8.5, noteKey: "engine.readiness.slight" };
    if (score >= 40) return { loadScale: 0.90, setDelta: -1, rpeCap: 8,   noteKey: "engine.readiness.under" };
    return                  { loadScale: 0.80, setDelta: -1, rpeCap: 7,   noteKey: "engine.readiness.low" };
  }

  /**
   * Warm-up ramp for compounds. Isolation work does not need one once the
   * compound before it has warmed the joint.
   */
  function buildWarmups(rx) {
    const ex = exerciseById(rx.exerciseId);
    if (!ex || ex.role !== "compound" || !rx.weight || rx.inverse) return [];
    const inc = ex.loadSpec.increment || 5;
    const ramp = [[0.45, 8], [0.7, 5], [0.87, 3]];
    return ramp
      .map(([pct, reps]) => ({ weight: Math.max(inc, Math.round((rx.weight * pct) / inc) * inc), reps }))
      .filter((s, i, arr) => i === 0 || s.weight > arr[i - 1].weight);
  }

  /** Human-readable load, aware of assisted machines and bodyweight moves. */
  function fmtLoad(weight, exercise) {
    const n = I18n.num(weight);
    if (!exercise) return I18n.t("engine.prog.loadKg", { n });
    if (exercise.loadType === "bodyweight") return I18n.t("engine.prog.loadBodyweight");
    if (exercise.loadType === "timed") return I18n.t("engine.prog.loadSeconds", { n: I18n.num(weight || 0) });
    if (exercise.inverseLoad) return I18n.t("engine.prog.loadAssist", { n });
    if (exercise.unilateral && exercise.loadType === "dumbbell") return I18n.t("engine.prog.loadPerHand", { n });
    return I18n.t("engine.prog.loadKg", { n });
  }

  /** Total tonnage (kg lifted) for a completed session — a volume proxy. */
  function sessionTonnage(session) {
    return (session.sets || []).reduce((sum, s) => {
      if (!s.done) return sum;
      const ex = exerciseById(s.exerciseId);
      const perHand = ex && ex.unilateral && ex.loadType === "dumbbell" ? 2 : 1;
      if (ex && ex.inverseLoad) return sum;   // assistance is not load lifted
      return sum + (Number(s.weight) || 0) * (Number(s.reps) || 0) * perHand;
    }, 0);
  }

  return {
    roundToIncrement, adjustedLoad, rirFromRpe, estimate1RM, loadForReps, plateBreakdown,
    historyFor, sessionBest1RM, strengthSeries, strengthTrend, effectiveLoad,
    seedWeight, recommend, readinessModifier, fmtLoad, sessionTonnage, signed, ACTIONS,
  };
})();
