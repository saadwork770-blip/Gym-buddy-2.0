/* ============================================================================
   GymBuddy 2.0 — engine/scheduler.js
   ----------------------------------------------------------------------------
   You tell it which days you can actually get to the gym. It rebuilds the
   entire program around them.

   That is more than relabelling days. Changing from four days to three changes
   which SPLIT makes sense, which changes how many times a week each muscle is
   trained, which changes how much work each session has to carry. And the
   ORDER matters: two leg days back to back is a worse week than the same two
   leg days spread apart, even though the total is identical.

   So the scheduler runs four stages:
     1. Pick the split that fits the day count, experience and goal.
     2. Place sessions on the chosen weekdays so that overlapping muscle work
        lands as far apart as the week allows (exhaustive search — with six
        sessions there are only 720 arrangements, so it checks all of them).
     3. Fill every pattern slot with a real exercise, honouring the equipment
        you have, the joints that hurt, and what you did last week.
     4. Size each session to the time you actually have, and hang cardio off
        the right days at the right dose for the goal.
   ============================================================================ */

const Scheduler = (function () {

  /* ------------------------------------------------------------------
     Equipment
     ------------------------------------------------------------------ */

  const EQUIPMENT_KEYS = {
    machine_stack: "machine", plate_loaded: "machine", assisted: "machine",
    cable_stack: "cable", barbell: "barbell", dumbbell: "dumbbell",
    bodyweight: "bodyweight", timed: "bodyweight", cardio_time: "cardio",
  };

  function equipmentKey(ex) { return EQUIPMENT_KEYS[ex.loadType] || "machine"; }

  function equipmentAvailable(ex, settings) {
    const eq = (settings && settings.equipment) || {};
    const key = equipmentKey(ex);
    return eq[key] !== false;
  }

  /* ------------------------------------------------------------------
     Stage 1 — choose the split
     ------------------------------------------------------------------ */

  function chooseSplit(profile) {
    const settings = profile.settings || {};
    const days = (settings.trainingDays || []).filter(d => DAY_KEYS.includes(d));
    const level = LEVEL_PROFILES[profile.level] || LEVEL_PROFILES["Some experience"];
    const goal = GOAL_PROFILES[profile.goal] || GOAL_PROFILES["General fitness"];
    if (settings.splitOverride && SPLITS[settings.splitOverride]) {
      return { split: SPLITS[settings.splitOverride], forced: true };
    }
    return { split: selectSplit(days.length, level.id, goal.id), forced: false };
  }

  /* ------------------------------------------------------------------
     Stage 2 — place sessions across the chosen weekdays
     ------------------------------------------------------------------ */

  /** Circular gap in days between consecutive selected weekdays. */
  function gapsBetween(dayIdxs) {
    const gaps = [];
    for (let i = 0; i < dayIdxs.length; i++) {
      const a = dayIdxs[i];
      const b = dayIdxs[(i + 1) % dayIdxs.length];
      gaps.push(i === dayIdxs.length - 1 ? (b + 7 - a) : (b - a));
    }
    return gaps;
  }

  function permutations(arr) {
    if (arr.length <= 1) return [arr];
    const out = [];
    arr.forEach((item, i) => {
      const rest = [...arr.slice(0, i), ...arr.slice(i + 1)];
      permutations(rest).forEach(p => out.push([item, ...p]));
    });
    return out;
  }

  /**
   * Recovery cost of one arrangement.
   * For every consecutive pair of sessions, muscle overlap is divided by the
   * days between them: heavy overlap one day apart is expensive, the same
   * overlap three days apart is nearly free. High-fatigue sessions stacked on
   * consecutive days are penalised on top.
   */
  function arrangementCost(order, dayIdxs, canonical) {
    const gaps = gapsBetween(dayIdxs);
    let cost = 0;
    for (let i = 0; i < order.length; i++) {
      const a = order[i];
      const b = order[(i + 1) % order.length];
      const gap = Math.max(1, gaps[i]);
      const overlap = templateOverlap(a, b);
      cost += overlap / gap;
      if (gap === 1) {
        const fa = templateFatigue(a), fb = templateFatigue(b);
        cost += ((fa + fb) / 2 - 2.5) * 0.12;   // back-to-back heavy days
      }
    }
    // Tiny nudge toward the split's canonical order, so identical-cost
    // arrangements come out as the familiar Upper A → Lower A → Upper B → …
    order.forEach((t, i) => { if (canonical[i] !== t) cost += 0.012; });
    return cost;
  }

  function templateFatigue(templateId) {
    const t = SESSION_TEMPLATES[templateId];
    if (!t) return 2.5;
    const vals = t.slots.map(s => (exerciseById(s.prefer) || {}).fatigue || 2);
    return vals.reduce((a, b) => a + b, 0) / vals.length;
  }

  function placeSessions(split, dayKeys) {
    const dayIdxs = dayKeys.map(d => DAY_KEYS.indexOf(d)).sort((a, b) => a - b);
    const sequence = split.sequence.slice(0, dayIdxs.length);
    // If the user picked more days than the split has sessions (only possible
    // with a forced override), cycle the sequence to fill them.
    while (sequence.length < dayIdxs.length) sequence.push(split.sequence[sequence.length % split.sequence.length]);

    const canonical = sequence.slice();
    let best = null;
    permutations(sequence).forEach(order => {
      const cost = arrangementCost(order, dayIdxs, canonical);
      if (!best || cost < best.cost - 1e-9) best = { order, cost };
    });

    const gaps = gapsBetween(dayIdxs);
    return dayIdxs.map((idx, i) => ({
      dayKey: DAY_KEYS[idx],
      templateId: best.order[i],
      gapToNext: gaps[i],
    }));
  }

  /* ------------------------------------------------------------------
     Stage 3 — fill the pattern slots with real exercises
     ------------------------------------------------------------------ */

  function painJoints(profile) {
    const flags = (profile.flags && profile.flags.pain) || {};
    return new Set(Object.values(flags).filter(Boolean));
  }

  /**
   * Pick the best exercise for a slot.
   * Preference order: the plan's original choice, then anything else sharing
   * the pattern, then anything training the same primary muscle. Candidates
   * that use missing equipment, load a painful joint, or that you have
   * excluded are dropped outright — and if that empties the list the slot is
   * dropped with an explanation rather than silently filled with something
   * that will hurt.
   */
  function chooseExercise(slot, ctx) {
    const { profile, usedInSession, usedInWeek, variationSeed, templateId } = ctx;
    const settings = profile.settings || {};
    const excluded = new Set((profile.flags && profile.flags.excluded) || []);
    const pain = painJoints(profile);
    const prefEx = exerciseById(slot.prefer);
    const primaryMuscle = prefEx ? prefEx.muscle : null;

    /* A manual swap the user accepted from the Coach tab wins over everything
       else, as long as it is still legal (equipment present, joint not
       flagged). Keyed by template + pattern so the swap sticks to that slot
       rather than leaking into every session that shares the pattern. */
    const overrideId = (settings.slotOverrides || {})[`${templateId}:${slot.pattern}`];
    if (overrideId) {
      const ov = exerciseById(overrideId);
      if (ov && !excluded.has(ov.id) && equipmentAvailable(ov, settings) &&
          !(ov.jointStress || []).some(j => pain.has(j)) && !usedInSession.has(ov.id)) {
        return {
          exercise: ov,
          note: ov.id === slot.prefer ? null
            : `${ov.name} is in this slot because you chose it — it stays until you swap it back.`,
        };
      }
    }

    /* Two different strengths of "no".
       A pain flag names ONE exercise that hurts, so that exercise is out
       outright. Other movements loading the same joint are only penalised,
       not banned — a knee that dislikes the leg press is often fine on a leg
       curl, and banning the whole joint empties the session and replaces it
       with four copies of whatever machine is left. The soft penalty means a
       joint-sparing option always wins when one exists, without leaving you
       with nothing to train. */
    const painFlags = (profile.flags && profile.flags.pain) || {};
    const flaggedIds = new Set(Object.keys(painFlags).filter(k => painFlags[k]));

    let pool = exercisesByPattern(slot.pattern);
    const sameMuscle = EXERCISES.filter(e => e.muscle === primaryMuscle && e.role !== "cardio");
    let viable = pool.filter(ex => usable(ex));
    let widened = false;
    if (!viable.length) { viable = sameMuscle.filter(ex => usable(ex)); widened = true; }
    if (!viable.length) return { exercise: null, note: reasonSlotDropped(slot, prefEx, profile) };

    function usable(ex) {
      if (excluded.has(ex.id)) return false;
      if (flaggedIds.has(ex.id)) return false;
      if (!equipmentAvailable(ex, settings)) return false;
      if (usedInSession.has(ex.id)) return false;      // never the same lift twice
      return true;
    }

    const scored = viable.map(ex => {
      let score = 0;
      if (ex.id === slot.prefer) score += 100;                    // the plan's own pick
      if (usedInWeek.has(ex.id)) score -= 12;                     // prefer variety across the week
      if (ex.hasMedia === false) score -= 4;                      // photo+GIF entries first
      // These have to outweigh the variety penalty above: in a gym missing
      // half its equipment, "we already used this compound on Monday" is not
      // a good enough reason to put an isolation movement in a primary slot.
      if (ex.role === "compound" && slot.role === "primary") score += 20;
      if (ex.role === "isolation" && slot.role === "accessory") score += 8;
      // Soft avoidance of joints you have flagged elsewhere.
      const hits = (ex.jointStress || []).filter(j => pain.has(j)).length;
      score -= hits * 40;
      // Deterministic per-cycle rotation so variation is stable within a block
      // but changes between blocks, instead of reshuffling on every render.
      score += ((hashString(ex.id + variationSeed) % 7) * 0.35);
      return { ex, score };
    }).sort((a, b) => b.score - a.score);

    const winner = scored[0].ex;
    if (widened) {
      return {
        exercise: winner,
        note: `The ${PATTERNS[slot.pattern].toLowerCase()} slot is covered by ${winner.name} this week — no exercise in that exact pattern is available under your current equipment and pain settings, so the coach kept the muscle group and changed the pattern.`,
      };
    }
    let note = null;
    if (winner.id !== slot.prefer && prefEx) {
      note = substitutionReason(prefEx, winner, profile);
    }
    return { exercise: winner, note };
  }

  function substitutionReason(original, replacement, profile) {
    const settings = profile.settings || {};
    const pain = painJoints(profile);
    const excluded = new Set((profile.flags && profile.flags.excluded) || []);
    if (excluded.has(original.id))
      return `${replacement.name} replaces ${original.name} — you removed that one from your library.`;
    if ((original.jointStress || []).some(j => pain.has(j))) {
      const joint = (original.jointStress || []).find(j => pain.has(j));
      return `${replacement.name} replaces ${original.name} — you flagged ${joint.replace("_", " ")} pain, and this keeps the same ${PATTERNS[original.pattern].toLowerCase()} work with less load through that joint.`;
    }
    if (!equipmentAvailable(original, settings))
      return `${replacement.name} replaces ${original.name} — ${(LOAD_TYPES[original.loadType] || {}).label || "that equipment"} is marked unavailable at your gym.`;
    return `${replacement.name} covers the ${PATTERNS[original.pattern].toLowerCase()} slot this block — rotating variations keeps the stimulus fresh without changing what the session trains.`;
  }

  function reasonSlotDropped(slot, prefEx, profile) {
    return `The ${PATTERNS[slot.pattern].toLowerCase()} slot is empty this week: every option either needs equipment you marked unavailable or loads a joint you flagged as painful. Re-enable equipment in Settings, or clear the pain flag once it settles.`;
  }

  function hashString(str) {
    let h = 0;
    for (let i = 0; i < str.length; i++) { h = ((h << 5) - h + str.charCodeAt(i)) | 0; }
    return Math.abs(h);
  }

  /* ------------------------------------------------------------------
     Stage 4 — size the session and attach cardio
     ------------------------------------------------------------------ */

  /** Minutes a block will take: work time plus rest, plus a warm-up allowance. */
  function blockMinutes(block) {
    const ex = exerciseById(block.exerciseId);
    if (!ex) return 0;
    const secPerRep = ex.loadType === "timed" ? 1 : 3.5;
    const workSec = ex.loadType === "timed" ? block.repHi : block.repHi * secPerRep;
    const perSet = workSec + (block.restSec || 90);
    const setup = ex.role === "compound" ? 150 : 60;   // find the machine, warm up, adjust
    return (block.sets * perSet + setup) / 60;
  }

  /**
   * Minutes of LIFTING, including the general warm-up. The cardio finisher is
   * deliberately excluded: it is optional, it is often done separately, and
   * counting it against the budget was quietly deleting working sets to make
   * room for a treadmill walk. `totalMinutes` below is the door-to-door figure.
   */
  function sessionMinutes(session) {
    const lifting = session.blocks.reduce((sum, b) => sum + blockMinutes(b), 0);
    return Math.round(lifting + 6);   // +6 general warm-up
  }

  /** Door-to-door time including the cardio finisher. */
  function totalMinutes(session) {
    return sessionMinutes(session) + (session.cardio ? session.cardio.minutes : 0);
  }

  /**
   * Trim or pad a session to fit the time available.
   * Finishers go first, then accessories, then a set is shaved off what
   * remains — the primary compounds are protected, because they are what the
   * session is for.
   */
  function fitToBudget(session, budgetMin, level) {
    const trimmed = [];
    let guard = 0;
    while (sessionMinutes(session) > budgetMin && guard++ < 20) {
      const order = ["finisher", "accessory", "secondary"];
      let removed = false;
      for (const role of order) {
        const idx = [...session.blocks].reverse().findIndex(b => b.role === role);
        if (idx !== -1) {
          const realIdx = session.blocks.length - 1 - idx;
          const [gone] = session.blocks.splice(realIdx, 1);
          trimmed.push(gone.exerciseId);
          removed = true;
          break;
        }
      }
      if (!removed) {
        // Nothing left to cut: shave a set off the largest block instead.
        const biggest = session.blocks.reduce((a, b) => (b.sets > a.sets ? b : a), session.blocks[0]);
        if (!biggest || biggest.sets <= 2) break;
        biggest.sets -= 1;
      }
    }

    /* Deliberately no padding in the other direction. A session that comes in
       under the time budget is not a session that needs more sets bolted on —
       volume is decided by the prescription and the weekly landmarks, not by
       how much time happens to be left. If there is genuinely room for more
       work, the Coach tab proposes it against the landmarks and you decide. */

    const totalSets = session.blocks.reduce((s, b) => s + b.sets, 0);
    if (totalSets > level.maxSetsPerSession) {
      const overflow = totalSets - level.maxSetsPerSession;
      let left = overflow;
      session.blocks.slice().reverse().forEach(b => {
        while (left > 0 && b.sets > 2) { b.sets -= 1; left -= 1; }
      });
    }

    session.trimmed = trimmed;
    return session;
  }

  /** Cardio choice: honour the preference, respect impact limits and pain. */
  function pickCardio(profile, dayIndex) {
    const settings = profile.settings || {};
    const pain = painJoints(profile);
    const prefId = settings.cardioPreference;
    const options = cardioExercises().filter(ex => !(ex.jointStress || []).some(j => pain.has(j)));
    const pool = options.length ? options : cardioExercises();
    if (prefId && prefId !== "rotate") {
      const pref = pool.find(e => e.id === prefId);
      if (pref) return pref;
    }
    // Rotate through the low-impact options across the week.
    const lowImpact = pool.filter(e => e.impact === "low" || e.impact === "very_low");
    const rotation = (lowImpact.length ? lowImpact : pool);
    return rotation[dayIndex % rotation.length];
  }

  /* ------------------------------------------------------------------
     The plan
     ------------------------------------------------------------------ */

  /**
   * Build a full week. Pure function of the profile — nothing is written to
   * storage here, so the UI can preview a plan for settings you have not
   * committed to yet.
   */
  function buildPlan(profile, opts) {
    const options = opts || {};
    const settings = profile.settings || {};
    const level = LEVEL_PROFILES[profile.level] || LEVEL_PROFILES["Some experience"];
    const goal = GOAL_PROFILES[profile.goal] || GOAL_PROFILES["General fitness"];
    const phase = options.phase || Periodization.phaseFor(profile);
    const warnings = [];

    let dayKeys = (settings.trainingDays || []).filter(d => DAY_KEYS.includes(d));
    dayKeys = DAY_KEYS.filter(d => dayKeys.includes(d));       // canonical Mon→Sun order
    if (!dayKeys.length) {
      return { empty: true, warnings: ["No training days selected yet — pick the days you can get to the gym and the coach will build the week around them."] };
    }
    if (dayKeys.length > 6) {
      warnings.push("Seven training days leaves no recovery day. The coach has built six sessions and left your longest gap as a rest day — add it back only if you are keeping sessions genuinely easy.");
      dayKeys = dayKeys.slice(0, 6);
    }

    const { split, forced } = chooseSplit({ ...profile, settings: { ...settings, trainingDays: dayKeys } });
    const placed = placeSessions(split, dayKeys);
    const variationSeed = String((profile.meso && profile.meso.startDate) || "seed") + ":" + (phase.cycle || 1);

    const usedInWeek = new Set();
    const sessions = placed.map((slotDay, i) => {
      const template = SESSION_TEMPLATES[slotDay.templateId];
      const usedInSession = new Set();
      const blocks = [];
      const notes = [];

      template.slots.forEach(slot => {
        const { exercise, note } = chooseExercise(slot, { profile, usedInSession, usedInWeek, variationSeed, templateId: template.id });
        if (note) notes.push(note);
        if (!exercise) return;
        usedInSession.add(exercise.id);
        usedInWeek.add(exercise.id);

        const rx = Progression.recommend({ profile, exercise, phase });
        blocks.push({
          exerciseId: exercise.id,
          pattern: slot.pattern,
          role: slot.role,
          substitutedFrom: exercise.id !== slot.prefer ? slot.prefer : null,
          sets: rx.sets,
          repLo: rx.repLo,
          repHi: rx.repHi,
          restSec: rx.restSec,
          weight: rx.weight,
          rpeCap: rx.rpeCap,
          action: rx.action,
          manual: !!rx.manual,
          delta: rx.delta,
          reason: rx.reason,
          warmups: rx.warmups,
          evidence: rx.evidence,
        });
      });

      const cardioEx = pickCardio(profile, i);
      const session = {
        dayKey: slotDay.dayKey,
        dayLabel: DAY_LABELS[slotDay.dayKey],
        type: "training",
        templateId: template.id,
        name: template.name,
        short: template.short,
        emphasis: template.emphasis,
        gapToNext: slotDay.gapToNext,
        blocks,
        notes,
        cardio: cardioEx ? {
          exerciseId: cardioEx.id,
          name: cardioEx.name,
          minutes: Math.round(goal.cardioMinutes.training * (phase.type === "deload" ? 0.7 : 1)),
          intensity: goal.cardioIntensity,
        } : null,
      };

      fitToBudget(session, settings.sessionMinutes || 60, level);
      session.estMinutes = sessionMinutes(session);
      session.totalMinutes = totalMinutes(session);
      session.totalSets = session.blocks.reduce((s, b) => s + b.sets, 0);
      return session;
    });

    /* Rest days, with a cardio suggestion if the user wants one. */
    const restDays = DAY_KEYS.filter(d => !dayKeys.includes(d)).map((d, i) => {
      const wantCardio = settings.cardioOnRestDays !== false;
      const ex = wantCardio ? pickCardio(profile, i + 3) : null;
      return {
        dayKey: d,
        dayLabel: DAY_LABELS[d],
        type: "rest",
        suggestion: wantCardio && ex
          ? `${goal.cardioMinutes.rest} min ${ex.name.toLowerCase()} — ${goal.cardioIntensity}. Optional, and it should leave you fresher than it found you.`
          : "Full rest. Recovery is when the adaptation actually happens.",
        cardio: wantCardio && ex ? { exerciseId: ex.id, name: ex.name, minutes: goal.cardioMinutes.rest, intensity: goal.cardioIntensity } : null,
      };
    });

    /* A six-day split can stack a muscle far past what anyone recovers from —
       shoulders were coming out at 39 sets a week against a 24-set ceiling.
       Trim back to the ceiling before the plan is handed over, taking sets off
       isolation work first so the main compounds keep their volume. */
    const ceilingCuts = enforceVolumeCeiling(sessions);
    if (ceilingCuts.length) {
      warnings.push(`Weekly volume was over what most people recover from, so the coach trimmed ${ceilingCuts.length} set${ceilingCuts.length === 1 ? "" : "s"} from isolation work: ${ceilingCuts.map(c => c.name).join(", ")}. Sets past that ceiling buy fatigue, not muscle.`);
    }

    // Set counts moved, so the time estimates have to be recomputed.
    sessions.forEach(s => {
      s.estMinutes = sessionMinutes(s);
      s.totalMinutes = totalMinutes(s);
      s.totalSets = s.blocks.reduce((n, b) => n + b.sets, 0);
    });

    /* Weekly volume audit against the landmarks. */
    const volume = weeklyVolume(sessions);
    const volumeReport = auditVolume(volume, goal);

    sessions.forEach(s => { if (s.trimmed && s.trimmed.length) {
      warnings.push(`${s.name} was trimmed to fit your ${settings.sessionMinutes || 60}-minute session limit: ${s.trimmed.map(id => (exerciseById(id) || {}).name || id).join(", ")} dropped. Raise the time budget in Settings to keep them.`);
    }});

    return {
      empty: false,
      generatedAt: new Date().toISOString(),
      splitId: split.id,
      splitName: split.name,
      splitRationale: split.rationale,
      splitForced: forced,
      dayCount: dayKeys.length,
      trainingDays: dayKeys,
      phase,
      sessions,
      restDays,
      volume,
      volumeReport,
      warnings,
    };
  }

  /**
   * Shave sets until no muscle exceeds its maximum recoverable volume.
   * Isolation work goes first and compounds are protected, because the
   * compounds are what the session is built around.
   */
  function enforceVolumeCeiling(sessions) {
    const cuts = [];
    for (let guard = 0; guard < 80; guard++) {
      const vol = weeklyVolume(sessions);
      const over = Object.entries(VOLUME_LANDMARKS)
        .map(([m, lm]) => ({ muscle: m, excess: (vol[m] || 0) - lm.mrv }))
        .filter(x => x.excess > 0)
        .sort((a, b) => b.excess - a.excess)[0];
      if (!over) break;

      const candidates = [];
      sessions.forEach(s => s.blocks.forEach(b => {
        const ex = exerciseById(b.exerciseId);
        if (!ex || !(ex.contribution || {})[over.muscle]) return;
        if (b.sets <= 2) return;
        candidates.push({ block: b, ex, iso: ex.role === "isolation" ? 1 : 0 });
      }));
      if (!candidates.length) break;
      candidates.sort((a, b) => (b.iso - a.iso) || (b.block.sets - a.block.sets));
      const victim = candidates[0];
      victim.block.sets -= 1;
      cuts.push({ name: victim.ex.name, muscle: over.muscle });
    }
    // Collapse repeats so the warning reads "Lateral Raise" once, not four times.
    const seen = new Set();
    return cuts.filter(c => (seen.has(c.name) ? false : (seen.add(c.name), true)));
  }

  /** Hard sets per muscle per week, counted through the contribution table. */
  function weeklyVolume(sessions) {
    const acc = {};
    Object.keys(VOLUME_LANDMARKS).forEach(m => { acc[m] = 0; });
    sessions.forEach(s => s.blocks.forEach(b => {
      const ex = exerciseById(b.exerciseId);
      if (!ex) return;
      Object.entries(ex.contribution || {}).forEach(([m, w]) => {
        if (acc[m] === undefined) acc[m] = 0;
        acc[m] += b.sets * w;
      });
    }));
    Object.keys(acc).forEach(m => { acc[m] = Math.round(acc[m] * 10) / 10; });
    return acc;
  }

  /** Compare weekly volume to the landmarks and say what it means. */
  function auditVolume(volume, goal) {
    return Object.entries(VOLUME_LANDMARKS).map(([muscle, lm]) => {
      const sets = volume[muscle] || 0;
      let status, message;
      if (sets < lm.mv) {
        status = "under";
        message = `${sets} sets is below the ${lm.mv}-set maintenance floor — this muscle is being left behind.`;
      } else if (sets < lm.mev) {
        status = "maintenance";
        message = `${sets} sets maintains what you have but is under the ${lm.mev}-set threshold where growth usually starts.`;
      } else if (sets <= lm.mav) {
        status = "optimal";
        message = `${sets} sets sits in the productive ${lm.mev}–${lm.mav} range.`;
      } else if (sets <= lm.mrv) {
        status = "high";
        message = `${sets} sets is high but recoverable — fine for a few weeks, watch your recovery.`;
      } else {
        status = "excessive";
        message = `${sets} sets is past the ${lm.mrv}-set ceiling most people can recover from. Quality will drop before results improve.`;
      }
      return { muscle, label: MUSCLE_LABELS[muscle] || muscle, sets, status, message, landmarks: lm };
    });
  }

  /**
   * "What would change if I trained on these days instead?"
   * Used by the day picker to preview the consequences before committing.
   */
  function previewForDays(profile, dayKeys) {
    const shadow = { ...profile, settings: { ...(profile.settings || {}), trainingDays: dayKeys } };
    const plan = buildPlan(shadow);
    if (plan.empty) return plan;
    return {
      splitName: plan.splitName,
      splitRationale: plan.splitRationale,
      dayCount: plan.dayCount,
      sessionsPerWeek: plan.sessions.length,
      avgMinutes: Math.round(plan.sessions.reduce((s, x) => s + x.totalMinutes, 0) / plan.sessions.length),
      volume: plan.volume,
      volumeReport: plan.volumeReport,
      sessions: plan.sessions.map(s => ({ dayKey: s.dayKey, name: s.name, totalSets: s.totalSets, estMinutes: s.estMinutes })),
    };
  }

  return {
    buildPlan, previewForDays, chooseSplit, placeSessions, weeklyVolume,
    auditVolume, sessionMinutes, totalMinutes, blockMinutes, equipmentAvailable,
    pickCardio, enforceVolumeCeiling,
  };
})();
