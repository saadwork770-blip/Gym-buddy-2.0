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
        const why = sparesJoint && samePattern
          ? I18n.m("engine.adapt.whySparesSame", {
              pattern: I18n.ref("pattern", source.pattern), joint: I18n.ref("joint", avoidJoint) })
          : sparesJoint
          ? I18n.m("engine.adapt.whySparesOther", {
              newPattern: I18n.ref("pattern", ex.pattern), pattern: I18n.ref("pattern", source.pattern),
              muscle: I18n.ref("muscle", ex.muscle), joint: I18n.ref("joint", avoidJoint) })
          : samePattern
          ? I18n.m("engine.adapt.whySamePattern", {
              pattern: I18n.ref("pattern", source.pattern),
              newEquipment: I18n.ref("loadType", ex.loadType), equipment: I18n.ref("loadType", source.loadType) })
          : I18n.m("engine.adapt.whyOther", {
              newPattern: I18n.ref("pattern", ex.pattern), muscle: I18n.ref("muscle", ex.muscle) });
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
          title: I18n.m("engine.adapt.volAddTitle", { muscle: I18n.ref("muscle", row.muscle), sets: row.sets }),
          body: I18n.m("engine.adapt.volAddBody", {
            message: row.message, exercise: I18n.ref("ex", candidate.exercise.id),
            day: I18n.ref("day", candidate.dayKey), muscleLower: I18n.ref("muscle", row.muscle),
            projected: Math.round((row.sets + (candidate.exercise.contribution[row.muscle] || 1)) * 10) / 10,
          }),
          apply: { type: "set_delta", exerciseId: candidate.exercise.id, delta: +1 },
          applyLabel: I18n.m("engine.adapt.volAddLabel", { exercise: I18n.ref("ex", candidate.exercise.id) }),
        });
      }

      if (row.status === "excessive") {
        const candidate = findBlockForMuscle(plan, row.muscle, "remove");
        if (!candidate) return;
        proposals.push({
          key: `vol-cut-${row.muscle}`,
          kind: "volume",
          severity: "warn",
          title: I18n.m("engine.adapt.volCutTitle", { muscle: I18n.ref("muscle", row.muscle) }),
          body: I18n.m("engine.adapt.volCutBody", {
            message: row.message, exercise: I18n.ref("ex", candidate.exercise.id),
            day: I18n.ref("day", candidate.dayKey),
          }),
          apply: { type: "set_delta", exerciseId: candidate.exercise.id, delta: -1 },
          applyLabel: I18n.m("engine.adapt.volCutLabel", { exercise: I18n.ref("ex", candidate.exercise.id) }),
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
        title: I18n.m("engine.adapt.schedMoveTitle", {
          from: I18n.ref("day", drop.dayKey), to: I18n.ref("day", add.dayKey) }),
        body: I18n.m("engine.adapt.schedMoveBody", {
          weeks: att.weeks, from: I18n.ref("day", drop.dayKey), fromCount: drop.sessions,
          to: I18n.ref("day", add.dayKey), toCount: add.sessions,
        }),
        apply: { type: "training_days", days: ordered },
        applyLabel: I18n.m("engine.adapt.schedMoveLabel", { days: { $: "__list", v: ordered, x: "dayShort" } }),
      });
    } else if (weak.length >= 2) {
      const keep = (profile.settings.trainingDays || []).filter(d => !weak.slice(0, 1).map(x => x.dayKey).includes(d));
      proposals.push({
        key: `sched-reduce-${keep.length}`,
        kind: "schedule",
        severity: "info",
        title: I18n.m("engine.adapt.schedReduceTitle", { count: keep.length }),
        body: I18n.m("engine.adapt.schedReduceBody", {
          pct: Math.round(att.plannedRate.reduce((s, d) => s + d.rate, 0) / att.plannedRate.length * 100),
          keep: keep.length, planned: att.plannedRate.length,
        }),
        apply: { type: "training_days", days: keep },
        applyLabel: I18n.m("engine.adapt.schedReduceLabel", { count: keep.length }),
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
