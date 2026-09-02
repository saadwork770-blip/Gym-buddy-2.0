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

  /* ------------------------------------------------------------------
     Scoring a candidate for a slot
     ------------------------------------------------------------------
     The old version gave the template's own pick +100 against a rotation
     bonus worth at most 2.45, which is not a preference, it is a decision
     already made. Eight blocks of training produced one plan, half the
     library was unreachable at default settings, and a beginner and an
     advanced lifter were handed the same six machines.

     What the numbers mean now:

       BLOCK 1 is the program you were given, exactly. It is not the engine's
       place to redesign a plan on day one, and "the app changed my workout
       before I ran it once" is how people stop trusting a coach. So the
       template's pick still wins outright the first time through.

       FROM BLOCK 2 the template's pick is a strong opinion (+18) rather than
       a veto, and three things can outvote it: a per-block rotation draw
       (0–20), how well the movement suits the lifter's experience (−22..+16)
       and their goal (−18..+19). Whatever won the slot last block is pushed
       down hard, so something genuinely changes rather than the same
       arrangement being re-derived.

     The structural terms — a compound in a primary slot, a joint you have
     flagged — stay large enough that no amount of rotation can turn a
     primary slot into an arm exercise or put you back on a lift that hurts.
     ------------------------------------------------------------------ */

  const PREFER_FIRST_BLOCK = 100;   // block 1 reproduces the source plan
  const PREFER_LATER       = 18;    // afterwards, a strong opinion in a main slot
  const PREFER_LATER_MINOR = 10;    // and a lighter one in an accessory slot
  const ROTATION_RANGE     = 20;    // per-block variation, enough to outvote it
  const VARIETY_TOLERANCE  = 16;    // how much fit a change of scenery may cost

  /* How long a slot holds its exercise before rotating, in blocks.
     Your main squat is not supposed to change every month — you are supposed
     to get stronger at it, which takes longer than one block and needs an
     unbroken history to measure it against. Calf raises carry no such
     obligation. Each slot also gets its own offset in the cycle, so a new
     block changes about a third of the program rather than all of it at
     once: a week where every single exercise is unfamiliar is a week of bad
     sets and no comparable data. */
  const ROTATION_PERIOD = { primary: 4, secondary: 3, accessory: 3, finisher: 3 };

  /** A stable 0..ROTATION_RANGE draw for one exercise in one rotation era. */
  function rotationDraw(exerciseId, era, salt) {
    return (hashString(`${exerciseId}|${era}|${salt}`) % 1000) / 1000 * ROTATION_RANGE;
  }

  /**
   * Where a slot sits in its own rotation cycle.
   *   era      — increments once per period; the draw is fixed inside one era,
   *              so the exercise genuinely holds rather than being re-rolled
   *              every block and happening to land on the same answer.
   *   due      — this block is the era boundary for this slot: if the same
   *              exercise would win again, move it on.
   */
  function rotationClock(key, role, block) {
    const period = ROTATION_PERIOD[role] || 3;
    const offset = hashString(key) % period;          // stagger the slots
    const tick = (block - 1) + offset;
    return { era: Math.floor(tick / period), due: block > 1 && tick % period === 0 };
  }

  /**
   * How well a movement suits the lifter's experience.
   * A beginner training alone should not meet a barbell back squat in week
   * one; an experienced lifter should not be handed a program made entirely
   * of fixed-path machines. See exerciseSkill() for what the tiers mean.
   */
  function levelFit(ex, levelId) {
    const skill = exerciseSkill(ex);
    if (levelId === "beginner")  return skill === 1 ? 10 : skill === 2 ? 0 : -22;
    if (levelId === "advanced")  return skill === 1 ? -14 : skill === 2 ? 6 : 16;
    return skill === 1 ? 2 : skill === 2 ? 7 : 2;      // intermediate
  }

  /**
   * How well a movement serves the goal.
   * Strength is built on loaded compounds; hypertrophy tolerates — and often
   * prefers — stable movements you can take close to failure safely; fat loss
   * favours work that moves a lot of muscle per minute.
   */
  function goalFit(ex, goalId, slotRole) {
    let score = 0;
    /* A primary slot is where the load is meant to climb, and you cannot put
       2.5 kg on a press-up. Bodyweight compounds still belong there when they
       are genuinely hard — a pull-up survives this easily on the structural
       bonus — but they should not take the slot off a loadable lift purely on
       a rotation draw. */
    const unloadable = ex.loadType === "bodyweight" || ex.loadType === "timed";
    if (unloadable && slotRole === "primary") score -= 8;

    if (goalId === "strength") {
      if (ex.role === "compound") score += 5;
      if (ex.loadType === "barbell") score += 14;
      if (ex.loadType === "machine_stack" && ex.role === "isolation") score -= 4;
      if (unloadable) score -= 6;              // no way to add a kilo next week
    } else if (goalId === "hypertrophy") {
      if (ex.loadType === "cable_stack" || ex.loadType === "machine_stack") score += 3;
      if (ex.role === "isolation" && slotRole !== "primary") score += 3;
    } else if (goalId === "fat_loss") {
      if (ex.role === "compound") score += 4;
      if ((ex.contribution ? Object.keys(ex.contribution).length : 1) >= 3) score += 2;
    }
    return score;
  }

  function scoreCandidate(ex, slot, ctx, pain, era) {
    const { profile, usedInWeek, block } = ctx;
    const level = LEVEL_PROFILES[profile.level] || LEVEL_PROFILES["Some experience"];
    const goal = GOAL_PROFILES[profile.goal] || GOAL_PROFILES["General fitness"];
    const first = (block || 1) <= 1;
    let score = 0;

    if (ex.id === slot.prefer) {
      /* The template's opinion counts for less in the slots it matters least
         in. Which press you do is a decision; which of four cable movements
         finishes your triceps is a preference. */
      score += first ? PREFER_FIRST_BLOCK
             : slot.role === "primary" ? PREFER_LATER : PREFER_LATER_MINOR;
    }

    if (!first) score += rotationDraw(ex.id, era, ctx.variationSeed);

    score += levelFit(ex, level.id);
    score += goalFit(ex, goal.id, slot.role);

    /* A slot exists to train something specific. A candidate whose primary
       muscle differs from the slot's own pick is a legitimate option — a
       straight-arm pulldown belongs in an upper-back slot — but it is a
       change of subject, not an equal, so it takes the slot occasionally
       rather than a quarter of the time. */
    const prefEx = exerciseById(slot.prefer);
    if (prefEx && ex.muscle !== prefEx.muscle) score -= 5;

    // Structure: these have to outweigh everything above, because no amount of
    // rotation should turn a primary slot into an arm exercise.
    if (ex.role === "compound" && slot.role === "primary") score += 30;
    if (ex.role === "isolation" && slot.role === "accessory") score += 8;
    if (ex.role === "isolation" && slot.role === "primary") score -= 20;

    if (usedInWeek && usedInWeek.has(ex.id)) score -= 12;   // variety across the week
    if (ex.hasMedia === false) score -= 4;                  // photo + clip entries first
    score -= (ex.jointStress || []).filter(j => pain.has(j)).length * 40;

    return score;
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
    const block = ctx.block || 1;
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
            : I18n.m("engine.sched.subChosen", { name: I18n.ref("ex", ov.id) }),
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
    if (!viable.length) return { exercise: null, note: reasonSlotDropped(slot) };

    function usable(ex) {
      if (excluded.has(ex.id)) return false;
      if (flaggedIds.has(ex.id)) return false;
      if (!equipmentAvailable(ex, settings)) return false;
      if (usedInSession.has(ex.id)) return false;      // never the same lift twice
      return true;
    }

    const key = `${templateId}:${slot.pattern}`;
    const clock = rotationClock(key, slot.role, block);
    const scored = viable
      .map(ex => ({ ex, score: scoreCandidate(ex, slot, ctx, pain, clock.era) }))
      .sort((a, b) => b.score - a.score || (a.ex.id < b.ex.id ? -1 : 1));

    /* Rotation, stated as a rule rather than as a fudge factor: when a slot
       reaches the end of its cycle and the same exercise would win it again,
       take the next option — unless that option is a long way worse, because a
       plan that swaps your bench press for a press-up in the name of variety
       is not varied, it is just worse. The previous block's pick is the real
       one, replayed rather than inferred. */
    let winner = scored[0].ex;
    const lastBlock = ((ctx.previousPicks || {}).last || {})[key];
    if (clock.due && winner.id === lastBlock && scored.length > 1) {
      const alt = scored.find(c => c.ex.id !== winner.id);
      if (alt && scored[0].score - alt.score <= VARIETY_TOLERANCE) winner = alt.ex;
    }
    if (widened) {
      return {
        exercise: winner,
        note: I18n.m("engine.sched.slotWidened", {
          pattern: I18n.ref("pattern", slot.pattern), name: I18n.ref("ex", winner.id) }),
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
    const to = I18n.ref("ex", replacement.id), from = I18n.ref("ex", original.id);
    if (excluded.has(original.id)) return I18n.m("engine.sched.subExcluded", { to, from });
    if ((original.jointStress || []).some(j => pain.has(j))) {
      const joint = (original.jointStress || []).find(j => pain.has(j));
      return I18n.m("engine.sched.subPain", {
        to, from, joint: I18n.ref("joint", joint), pattern: I18n.ref("pattern", original.pattern) });
    }
    if (!equipmentAvailable(original, settings))
      return I18n.m("engine.sched.subEquipment", { to, from, equipment: I18n.ref("loadType", original.loadType) });
    return I18n.m("engine.sched.subRotation", { to, pattern: I18n.ref("pattern", original.pattern) });
  }

  function reasonSlotDropped(slot) {
    return I18n.m("engine.sched.slotDropped", { pattern: I18n.ref("pattern", slot.pattern) });
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
   * Replay slot selection from block one and return what the two blocks
   * before `block` put in each slot, keyed `templateId:pattern`.
   *
   * Each block's rotation depends on the block before it, so there is no
   * shortcut: guessing the previous block from a single un-rotated rebuild
   * produces a plan that quietly repeats itself, which is the bug this
   * replaces. Selection alone is cheap enough to make the honest version free.
   */
  function picksBefore(profile, phase, block) {
    if (!block || block <= 1) return { last: {}, before: {} };
    const settings = profile.settings || {};
    let dayKeys = DAY_KEYS.filter(d => (settings.trainingDays || []).includes(d)).slice(0, 6);
    if (!dayKeys.length) return { last: {}, before: {} };
    const { split } = chooseSplit({ ...profile, settings: { ...settings, trainingDays: dayKeys } });
    const placed = placeSessions(split, dayKeys);

    let history = { last: {}, before: {} };
    for (let b = 1; b < block; b++) {
      const pass = buildPlan(profile, {
        phase: { ...phase, block: b }, picksOnly: true, previousPicks: history, split, placed });
      const next = {};
      (pass.sessions || []).forEach(s => s.blocks.forEach(x => {
        next[`${s.templateId}:${x.pattern}`] = x.exerciseId;
      }));
      history = { last: next, before: history.last };
    }
    return history;
  }

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
      return { empty: true, warnings: [I18n.m("engine.sched.noDays")] };
    }
    if (dayKeys.length > 6) {
      warnings.push(I18n.m("engine.sched.sevenDays"));
      dayKeys = dayKeys.slice(0, 6);
    }

    /* Stages 1 and 2 do not depend on the block, so the replay below hands
       them in rather than making every replayed block re-run an exhaustive
       720-arrangement search that can only produce the same answer. */
    const { split, forced } = options.split
      ? { split: options.split, forced: false }
      : chooseSplit({ ...profile, settings: { ...settings, trainingDays: dayKeys } });
    const placed = options.placed || placeSessions(split, dayKeys);
    /* Rotation is keyed to the block number, which only ever climbs, and
       salted with the split so changing your training days reshuffles the
       variations rather than keeping the same ones under new names. */
    const block = phase.block || 1;
    const variationSeed = split.id || "seed";

    /* What the previous block actually put in each slot.
       It has to be what the user really saw, not an approximation: each block's
       choice depends on the one before it, so the chain is replayed from block
       one. `picksOnly` runs slot selection alone — no prescriptions, no cardio,
       no time budget — which is what makes replaying a couple of years of
       blocks cost less than a millisecond. Nothing is stored, so it stays
       correct when the equipment list, the goal or the training days changed
       somewhere in the middle. */
    const previousPicks = options.picksOnly ? (options.previousPicks || { last: {}, before: {} })
                        : picksBefore(profile, phase, block);

    const usedInWeek = new Set();
    const sessions = placed.map((slotDay, i) => {
      const template = SESSION_TEMPLATES[slotDay.templateId];
      const usedInSession = new Set();
      const blocks = [];
      const notes = [];

      template.slots.forEach(slot => {
        const { exercise, note } = chooseExercise(slot, {
          profile, usedInSession, usedInWeek, variationSeed,
          templateId: template.id, block, previousPicks });
        if (note) notes.push(note);
        if (!exercise) return;
        usedInSession.add(exercise.id);
        usedInWeek.add(exercise.id);

        if (options.picksOnly) {
          blocks.push({ exerciseId: exercise.id, pattern: slot.pattern, role: slot.role });
          return;
        }

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

      if (options.picksOnly) {
        return { dayKey: slotDay.dayKey, templateId: template.id, blocks, notes: [] };
      }

      const cardioEx = pickCardio(profile, i);
      const session = {
        dayKey: slotDay.dayKey,
        type: "training",
        templateId: template.id,
        gapToNext: slotDay.gapToNext,
        blocks,
        notes,
        cardio: cardioEx ? {
          exerciseId: cardioEx.id,
          minutes: Math.round(goal.cardioMinutes.training * (phase.type === "deload" ? 0.7 : 1)),
        } : null,
      };

      fitToBudget(session, settings.sessionMinutes || 75, level);
      session.estMinutes = sessionMinutes(session);
      session.totalMinutes = totalMinutes(session);
      session.totalSets = session.blocks.reduce((s, b) => s + b.sets, 0);
      return session;
    });

    if (options.picksOnly) return { picksOnly: true, sessions };

    /* Rest days, with a cardio suggestion if the user wants one. */
    const restDays = DAY_KEYS.filter(d => !dayKeys.includes(d)).map((d, i) => {
      const wantCardio = settings.cardioOnRestDays !== false;
      const ex = wantCardio ? pickCardio(profile, i + 3) : null;
      return {
        dayKey: d,
        type: "rest",
        suggestion: wantCardio && ex
          ? I18n.m("engine.sched.restCardio", {
              minutes: goal.cardioMinutes.rest, name: I18n.ref("ex", ex.id),
              intensity: I18n.m(`goal.cardioIntensity.${goal.cardioIntensityKey}`),
            })
          : I18n.m("engine.sched.restFull"),
        cardio: wantCardio && ex ? { exerciseId: ex.id, minutes: goal.cardioMinutes.rest } : null,
      };
    });

    /* Later weeks in the block add work toward each muscle's adaptive volume.
       This only ever adds: week 1 is the program as prescribed, so the plan you
       chose is never quietly cut down in the name of periodisation. */
    const rampAdded = applyVolumeRamp(sessions, phase.volumeRamp || 0, settings, level);
    if (rampAdded.length) {
      warnings.push(I18n.m("engine.sched.volumeRamp", {
        week: phase.week, count: rampAdded.length, names: I18n.refList("ex", rampAdded),
      }));
    }

    /* A six-day split can stack a muscle far past what anyone recovers from —
       shoulders were coming out at 39 sets a week against a 24-set ceiling.
       Trim back to the ceiling before the plan is handed over, taking sets off
       isolation work first so the main compounds keep their volume. */
    const ceilingCuts = enforceVolumeCeiling(sessions);
    if (ceilingCuts.length) {
      warnings.push(I18n.m("engine.sched.ceilingCut", {
        count: ceilingCuts.length,
        names: I18n.refList("ex", ceilingCuts.map(c => c.exerciseId)),
      }));
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
      warnings.push(I18n.m("engine.sched.trimmed", {
        session: I18n.ref("template", s.templateId),
        minutes: settings.sessionMinutes || 75,
        dropped: I18n.refList("ex", s.trimmed),
      }));
    }});

    /* What this block changed, so the app can say so plainly. A program that
       quietly swaps your exercises is indistinguishable from a broken one. */
    const rotated = [];
    sessions.forEach(s => s.blocks.forEach(b => {
      const before = (previousPicks.last || {})[`${s.templateId}:${b.pattern}`];
      if (before && before !== b.exerciseId) {
        rotated.push({ templateId: s.templateId, pattern: b.pattern, from: before, to: b.exerciseId });
      }
    }));

    return {
      empty: false,
      generatedAt: new Date().toISOString(),
      splitId: split.id,
      block, rotated,
      /* Only the structural part of the phase is stored. The labels and copy
         are re-derived at render time so they follow the current language. */
      phaseWeek: phase.week, phaseType: phase.type,
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
   * Add sets toward each muscle's adaptive volume, in proportion to how far
   * into the block we are. Sets go onto accessory work first — a fourth set of
   * a heavy compound costs far more recovery than a fourth set of a cable
   * movement, for the same entry in the volume tally.
   */
  function applyVolumeRamp(sessions, ramp, settings, level) {
    if (!ramp) return [];
    const added = [];
    const budget = settings.sessionMinutes || 75;

    for (let guard = 0; guard < 40; guard++) {
      const vol = weeklyVolume(sessions);
      // The muscle furthest below the week's target, as a fraction of its gap.
      const target = Object.entries(VOLUME_LANDMARKS).map(([muscle, lm]) => {
        const now = vol[muscle] || 0;
        const want = now + (lm.mav - now) * ramp;
        return { muscle, now, want, deficit: want - now, mrv: lm.mrv };
      }).filter(x => x.deficit >= 0.75 && x.now < x.mrv)
        .sort((a, b) => b.deficit - a.deficit)[0];
      if (!target) break;

      const candidates = [];
      sessions.forEach(s => s.blocks.forEach(b => {
        const ex = exerciseById(b.exerciseId);
        if (!ex || !(ex.contribution || {})[target.muscle]) return;
        if (b.sets >= 5) return;
        if (sessionMinutes(s) + blockMinutes({ ...b, sets: 1 }) / b.sets > budget) return;
        if (s.totalSets >= level.maxSetsPerSession) return;
        candidates.push({ session: s, block: b, ex, iso: ex.role === "isolation" ? 1 : 0 });
      }));
      if (!candidates.length) break;
      candidates.sort((a, b) => (b.iso - a.iso) || (a.block.sets - b.block.sets));

      const pick = candidates[0];
      pick.block.sets += 1;
      pick.session.totalSets = pick.session.blocks.reduce((n, b) => n + b.sets, 0);
      added.push(pick.ex.id);
    }
    const seen = new Set();
    return added.filter(id => (seen.has(id) ? false : (seen.add(id), true)));
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
      cuts.push({ exerciseId: victim.ex.id, muscle: over.muscle });
    }
    // Collapse repeats so the warning names each exercise once, not four times.
    const seen = new Set();
    return cuts.filter(c => (seen.has(c.exerciseId) ? false : (seen.add(c.exerciseId), true)));
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
      const status = sets < lm.mv ? "under"
                   : sets < lm.mev ? "maintenance"
                   : sets <= lm.mav ? "optimal"
                   : sets <= lm.mrv ? "high"
                   : "excessive";
      const message = I18n.m(`engine.sched.volume.${status}`, { sets, mv: lm.mv, mev: lm.mev, mav: lm.mav, mrv: lm.mrv });
      return { muscle, sets, status, message, landmarks: lm };
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
      splitId: plan.splitId,
      dayCount: plan.dayCount,
      sessionsPerWeek: plan.sessions.length,
      avgMinutes: Math.round(plan.sessions.reduce((s, x) => s + x.totalMinutes, 0) / plan.sessions.length),
      volume: plan.volume,
      volumeReport: plan.volumeReport,
      sessions: plan.sessions.map(s => ({ dayKey: s.dayKey, templateId: s.templateId, totalSets: s.totalSets, estMinutes: s.estMinutes })),
    };
  }

  return {
    buildPlan, previewForDays, chooseSplit, placeSessions, weeklyVolume,
    auditVolume, sessionMinutes, totalMinutes, blockMinutes, equipmentAvailable,
    pickCardio, enforceVolumeCeiling, applyVolumeRamp,
  };
})();
