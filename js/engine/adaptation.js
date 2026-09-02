/* ============================================================================
   GymBuddy 2.0 — engine/adaptation.js
   ----------------------------------------------------------------------------
   Progression handles "how much weight next time". This handles the bigger
   question: is this still the right exercise, the right amount of work, and
   the right set of days?

   Every function here returns a PROPOSAL — a described change with a reason
   and an `apply` payload — rather than mutating anything. The user accepts or
   dismisses it in the Coach tab. A coach that silently rewrites your program
   behind your back is not a coach, it is a bug.
   ============================================================================ */

const Adaptation = (function () {

  /* ------------------------------------------------------------------
     Exercise swaps
     ------------------------------------------------------------------ */

  /**
   * Alternatives for one exercise, ranked. Same movement pattern first (a true
   * like-for-like swap), then same primary muscle. Anything needing absent
   * equipment or loading a flagged joint is excluded, and the reason why each
   * one is a sensible stand-in is spelled out.
   */
  function alternativesFor(exerciseId, profile, opts) {
    const source = exerciseById(exerciseId);
    if (!source) return [];
    const options = opts || {};
    const settings = profile.settings || {};
    const excluded = new Set((profile.flags && profile.flags.excluded) || []);
    const painJoints = new Set(Object.values((profile.flags && profile.flags.pain) || {}).filter(Boolean));
    const avoidJoint = options.avoidJoint;

    return EXERCISES
      .filter(ex => ex.id !== exerciseId && ex.role !== "cardio")
      .filter(ex => !excluded.has(ex.id))
      .filter(ex => Scheduler.equipmentAvailable(ex, settings))
      .filter(ex => !(ex.jointStress || []).some(j => painJoints.has(j)))
      .filter(ex => !avoidJoint || !(ex.jointStress || []).includes(avoidJoint))
      .map(ex => {
        const samePattern = ex.pattern === source.pattern;
        const sameMuscle = ex.muscle === source.muscle;
        const sameRole = ex.role === source.role;
        if (!samePattern && !sameMuscle) return null;
        let score = (samePattern ? 60 : 0) + (sameMuscle ? 25 : 0) + (sameRole ? 10 : 0);
        const jointsSpared = (source.jointStress || []).filter(j => !(ex.jointStress || []).includes(j));
        if (avoidJoint && jointsSpared.includes(avoidJoint)) score += 40;
        if (ex.hasMedia === false) score -= 5;
        const sparesJoint = avoidJoint && jointsSpared.includes(avoidJoint);
        let why;
        if (sparesJoint && samePattern) {
          why = `Same ${PATTERNS[source.pattern].toLowerCase()} work, but it does not load your ${avoidJoint.replace("_", " ")}.`;
        } else if (sparesJoint) {
          why = `A ${PATTERNS[ex.pattern].toLowerCase()} movement rather than a ${PATTERNS[source.pattern].toLowerCase()} one, so it still trains ${MUSCLE_LABELS[ex.muscle] || ex.muscle} with nothing going through your ${avoidJoint.replace("_", " ")}.`;
        } else if (samePattern) {
          why = `Direct like-for-like: same ${PATTERNS[source.pattern].toLowerCase()} work on ${(LOAD_TYPES[ex.loadType] || {}).label || "different equipment"} instead of ${(LOAD_TYPES[source.loadType] || {}).label || "the original"}.`;
        } else {
          why = `A ${PATTERNS[ex.pattern].toLowerCase()} movement instead, but it trains ${MUSCLE_LABELS[ex.muscle] || ex.muscle} the same way — a reasonable stand-in when the pattern itself is what is bothering you.`;
        }
        return { exercise: ex, score, why, samePattern, jointsSpared };
      })
      .filter(Boolean)
      .sort((a, b) => b.score - a.score)
      .slice(0, options.limit || 5);
  }

  /**
   * Exercises that have stopped moving. A stall is two-plus sessions with no
   * progression AND a flat estimated-1RM trend — one hard session is not a
   * plateau, and treating it like one is how people end up program-hopping.
   */
  function detectPlateaus(profile) {
    const out = [];
    Object.entries(profile.prescriptions || {}).forEach(([exId, rx]) => {
      const ex = exerciseById(exId);
      if (!ex) return;
      const series = Progression.strengthSeries(profile, exId);
      if (series.length < 3) return;
      const trend = Progression.strengthTrend(series);
      const stalls = rx.stalls || 0;
      if (stalls >= 2 || (trend.slopePerWeek != null && trend.slopePerWeek <= 0 && series.length >= 4)) {
        out.push({
          exerciseId: exId,
          exercise: ex,
          stalls,
          trend,
          sessions: series.length,
          alternatives: alternativesFor(exId, profile, { limit: 3 }),
        });
      }
    });
    return out;
  }

  /* ------------------------------------------------------------------
     Volume adjustments
     ------------------------------------------------------------------ */

  /**
   * Compare the plan's weekly sets per muscle against the landmarks and
   * propose concrete fixes: which exercise gains or loses a set, and why.
   */
  function volumeProposals(profile, plan) {
    if (!plan || plan.empty) return [];
    const proposals = [];
    (plan.volumeReport || []).forEach(row => {
      if (row.status === "optimal" || row.status === "high") return;

      if (row.status === "under" || row.status === "maintenance") {
        const candidate = findBlockForMuscle(plan, row.muscle, "add");
        if (!candidate) return;
        proposals.push({
          key: `vol-add-${row.muscle}`,
          kind: "volume",
          severity: row.status === "under" ? "warn" : "info",
          title: `${row.label} is under-trained at ${row.sets} sets/week`,
          body: `${row.message} Adding one set to ${candidate.exercise.name} on ${DAY_LABELS[candidate.dayKey]} takes ${row.label.toLowerCase()} to about ${Math.round((row.sets + (candidate.exercise.contribution[row.muscle] || 1)) * 10) / 10} sets — into the range where it actually grows.`,
          apply: { type: "set_delta", exerciseId: candidate.exercise.id, delta: +1 },
          applyLabel: `Add a set of ${candidate.exercise.name}`,
        });
      }

      if (row.status === "excessive") {
        const candidate = findBlockForMuscle(plan, row.muscle, "remove");
        if (!candidate) return;
        proposals.push({
          key: `vol-cut-${row.muscle}`,
          kind: "volume",
          severity: "warn",
          title: `${row.label} volume is above what you can recover from`,
          body: `${row.message} Cutting one set from ${candidate.exercise.name} on ${DAY_LABELS[candidate.dayKey]} brings it back under the ceiling. More sets past this point buy fatigue, not muscle.`,
          apply: { type: "set_delta", exerciseId: candidate.exercise.id, delta: -1 },
          applyLabel: `Drop a set of ${candidate.exercise.name}`,
        });
      }
    });
    return proposals;
  }

  /** The best block to add to / take from for a muscle: isolation work first. */
  function findBlockForMuscle(plan, muscle, direction) {
    const candidates = [];
    plan.sessions.forEach(s => s.blocks.forEach(b => {
      const ex = exerciseById(b.exerciseId);
      if (!ex || !(ex.contribution || {})[muscle]) return;
      candidates.push({ dayKey: s.dayKey, block: b, exercise: ex });
    }));
    if (!candidates.length) return null;
    candidates.sort((a, b) => {
      // Add to (or cut from) isolation work before touching a main compound.
      const aIso = a.exercise.role === "isolation" ? 1 : 0;
      const bIso = b.exercise.role === "isolation" ? 1 : 0;
      if (aIso !== bIso) return bIso - aIso;
      return direction === "add" ? a.block.sets - b.block.sets : b.block.sets - a.block.sets;
    });
    const pick = candidates.find(c => direction === "add" ? c.block.sets < 5 : c.block.sets > 2);
    return pick || null;
  }

  /* ------------------------------------------------------------------
     Schedule adaptation
     ------------------------------------------------------------------ */

  const DAY_INDEX = { mon: 0, tue: 1, wed: 2, thu: 3, fri: 4, sat: 5, sun: 6 };

  /**
   * Which of your chosen days you actually turn up on.
   * If one weekday is repeatedly missed while another keeps getting used, the
   * plan is fighting your calendar — and the plan should move, not you.
   */
  function attendanceByDay(profile, weeks) {
    const w = weeks || 6;
    const since = new Date(); since.setDate(since.getDate() - w * 7);
    const planned = (profile.settings || {}).trainingDays || [];
    const counts = {}; DAY_KEYS.forEach(d => counts[d] = 0);
    (profile.sessionLog || [])
      .filter(s => new Date(s.date) >= since)
      .forEach(s => {
        const idx = (new Date(s.date).getDay() + 6) % 7;
        counts[DAY_KEYS[idx]]++;
      });
    const weeksElapsed = Math.max(1, Math.min(w, Math.ceil(((Date.now() - new Date(profile.createdAt).getTime()) / 86400000) / 7)));
    return {
      weeks: weeksElapsed,
      counts,
      plannedRate: planned.map(d => ({ dayKey: d, sessions: counts[d], rate: counts[d] / weeksElapsed })),
      unplannedUse: DAY_KEYS.filter(d => !planned.includes(d) && counts[d] > 0)
        .map(d => ({ dayKey: d, sessions: counts[d], rate: counts[d] / weeksElapsed })),
    };
  }

  /**
   * Propose a different set of training days when the evidence supports it:
   * a day you consistently skip, paired with a day you consistently train on
   * anyway. Needs at least three weeks of history before it will say anything.
   */
  function scheduleProposals(profile) {
    const att = attendanceByDay(profile);
    if (att.weeks < 3 || (profile.sessionLog || []).length < 6) return [];
    const proposals = [];

    const weak = att.plannedRate.filter(d => d.rate < 0.4).sort((a, b) => a.rate - b.rate);
    const strong = att.unplannedUse.filter(d => d.rate >= 0.5).sort((a, b) => b.rate - a.rate);

    if (weak.length && strong.length) {
      const drop = weak[0], add = strong[0];
      const next = (profile.settings.trainingDays || []).filter(d => d !== drop.dayKey).concat(add.dayKey);
      const ordered = DAY_KEYS.filter(d => next.includes(d));
      proposals.push({
        key: `sched-move-${drop.dayKey}-${add.dayKey}`,
        kind: "schedule",
        severity: "action",
        title: `Move your ${DAY_LABELS[drop.dayKey]} session to ${DAY_LABELS[add.dayKey]}`,
        body: `Over the last ${att.weeks} weeks you trained on ${DAY_LABELS[drop.dayKey]} ${drop.sessions} time${drop.sessions === 1 ? "" : "s"}, but turned up on ${DAY_LABELS[add.dayKey]} ${add.sessions} time${add.sessions === 1 ? "" : "s"} without it being scheduled. The plan should follow your week, not the other way round — the coach will re-space the sessions so nothing lands back to back.`,
        apply: { type: "training_days", days: ordered },
        applyLabel: `Switch to ${ordered.map(d => DAY_SHORT[d]).join(" · ")}`,
      });
    } else if (weak.length >= 2) {
      const keep = (profile.settings.trainingDays || []).filter(d => !weak.slice(0, 1).map(x => x.dayKey).includes(d));
      proposals.push({
        key: `sched-reduce-${keep.length}`,
        kind: "schedule",
        severity: "info",
        title: `Consider dropping to ${keep.length} days a week`,
        body: `You are hitting about ${Math.round(att.plannedRate.reduce((s, d) => s + d.rate, 0) / att.plannedRate.length * 100)}% of your scheduled sessions. ${keep.length} well-attended days beat ${att.plannedRate.length} half-attended ones — the coach will rebuild the split so the same weekly volume fits into fewer, slightly longer sessions.`,
        apply: { type: "training_days", days: keep },
        applyLabel: `Rebuild for ${keep.length} days`,
      });
    }

    return proposals;
  }

  /* ------------------------------------------------------------------
     Applying a proposal
     ------------------------------------------------------------------ */

  /** Commit an accepted proposal. Every path ends in a plan rebuild. */
  function apply(profileId, payload) {
    const profile = Store.getProfile(profileId);
    if (!profile || !payload) return null;

    switch (payload.type) {
      case "training_days":
        return Store.updateSettings(profileId, { trainingDays: payload.days });

      case "swap_exercise": {
        const overrides = { ...((profile.settings || {}).slotOverrides || {}) };
        /* A swap raised from a plateau knows the exercise but not which session
           it sits in, so resolve that from the current plan — and apply it to
           every session using the movement, since the stall is the movement's,
           not one day's. */
        const slots = [];
        if (payload.templateId) {
          slots.push({ templateId: payload.templateId, pattern: payload.pattern });
        } else {
          /* Find where the movement actually sits right now. Matching on the
             pattern as well used to fail as soon as an earlier swap had moved
             it into a neighbouring slot, and the button did nothing without
             saying so. */
          ((profile.plan && profile.plan.sessions) || []).forEach(s => {
            s.blocks.forEach(b => {
              if (b.exerciseId === payload.fromId) slots.push({ templateId: s.templateId, pattern: b.pattern });
            });
          });
        }
        if (!slots.length) return null;
        slots.forEach(sl => { overrides[`${sl.templateId}:${sl.pattern}`] = payload.toId; });
        return Store.updateSettings(profileId, { slotOverrides: overrides });
      }

      case "set_delta": {
        const rx = (profile.prescriptions || {})[payload.exerciseId] || {};
        const ex = exerciseById(payload.exerciseId);
        const current = rx.sets || (ex && ex.defaultSets) || 3;
        return Store.setPrescription(profileId, payload.exerciseId, {
          sets: Math.max(2, Math.min(6, current + payload.delta)),
        });
      }

      case "flag_pain":
        return Store.flagPain(profileId, payload.exerciseId, payload.joint);

      case "clear_pain":
        return Store.flagPain(profileId, payload.exerciseId, null);

      case "new_cycle":
        return Store.startNewCycle(profileId, payload.weeks);

      case "session_minutes":
        return Store.updateSettings(profileId, { sessionMinutes: payload.minutes });

      default:
        return null;
    }
  }

  return {
    alternativesFor, detectPlateaus, volumeProposals, scheduleProposals,
    attendanceByDay, apply,
  };
})();
