/* ============================================================================
   GymBuddy 2.0 — engine/coach.js
   ----------------------------------------------------------------------------
   The voice on top of the maths.

   Progression, Scheduler, Periodization and Adaptation each produce numbers
   and proposals. This module reads all of them, decides what actually matters
   right now, ranks it, and writes it in the language a coach would use on the
   gym floor — always with the evidence attached, so nothing has to be taken on
   trust.

   Ranking is by consequence, not by category: a plateau you are about to grind
   into outranks a nice-to-know note about your calf volume.
   ============================================================================ */

const Coach = (function () {

  const SEVERITY_RANK = { action: 0, warn: 1, good: 2, info: 3 };

  /* ------------------------------------------------------------------
     Feed generation
     ------------------------------------------------------------------ */

  function buildFeed(profile) {
    if (!profile) return [];
    const plan = profile.plan;
    const phase = Periodization.phaseFor(profile);
    const dismissed = new Set(profile.dismissed || []);
    const msgs = [];

    msgs.push(...comebackInsight(profile));
    msgs.push(...phaseInsight(profile, phase));
    msgs.push(...todayInsight(profile, plan));
    msgs.push(...progressionInsights(profile, plan));
    msgs.push(...plateauInsights(profile));
    msgs.push(...Adaptation.volumeProposals(profile, plan).map(toMessage));
    msgs.push(...Adaptation.scheduleProposals(profile).map(toMessage));
    msgs.push(...fatigueInsights(profile, phase));
    msgs.push(...balanceInsights(profile));
    msgs.push(...dropOffInsights(profile));
    msgs.push(...forecastInsight(profile));
    msgs.push(...orderingInsights(plan));
    msgs.push(...adherenceInsights(profile));
    msgs.push(...bodyweightInsights(profile));
    msgs.push(...painInsights(profile));
    msgs.push(...planWarnings(plan));

    return msgs
      .filter(m => m && !dismissed.has(m.key))
      .sort((a, b) => (SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]) || (b.weight || 0) - (a.weight || 0))
      .slice(0, 24);
  }

  function toMessage(p) {
    return {
      key: p.key, category: p.kind, severity: p.severity,
      title: p.title, body: p.body,
      apply: p.apply || null, applyLabel: p.applyLabel || null,
      weight: p.weight || 0,
    };
  }

  /* ------------------------------------------------------------------
     Individual insight generators
     ------------------------------------------------------------------ */

  function phaseInsight(profile, phase) {
    return [{
      key: `phase-${phase.cycle}-${phase.week}`,
      category: "periodization",
      severity: phase.type === "deload" ? "warn" : "info",
      title: I18n.m("engine.coach.phaseTitle", { label: phase.label, headline: phase.headline }),
      body: phase.detail,
      weight: 5,
    }];
  }

  /** What is on today, and whether the coach thinks you should train it. */
  function todayInsight(profile, plan) {
    if (!plan || plan.empty) return [];
    const todayKey = DAY_KEYS[(new Date().getDay() + 6) % 7];
    const session = (plan.sessions || []).find(s => s.dayKey === todayKey);
    const alreadyDone = (profile.sessionLog || []).some(s => s.date === new Date().toISOString().slice(0, 10));

    if (alreadyDone) {
      return [{
        key: `today-done-${new Date().toISOString().slice(0, 10)}`,
        category: "session", severity: "good",
        title: I18n.m("engine.coach.todayDoneTitle"),
        body: I18n.m("engine.coach.todayDoneBody"),
        weight: 9,
      }];
    }
    if (!session) {
      const rest = (plan.restDays || []).find(r => r.dayKey === todayKey);
      return [{
        key: `today-rest-${todayKey}`,
        category: "session", severity: "info",
        title: I18n.m("engine.coach.todayRestTitle", { day: I18n.ref("day", todayKey) }),
        body: rest ? rest.suggestion : I18n.m("engine.coach.todayRestFallback"),
        weight: 8,
      }];
    }
    const increases = session.blocks.filter(b => b.action === "increase").length;
    return [{
      key: `today-${todayKey}-${session.templateId}`,
      category: "session", severity: "action",
      title: I18n.m("engine.coach.todayTitle", {
        name: I18n.ref("template", session.templateId), minutes: session.estMinutes }),
      body: I18n.m("engine.coach.todayBody", {
        sets: session.totalSets, exercises: session.blocks.length,
        increases: increases ? I18n.m("engine.coach.todayIncreases", { count: increases }) : "",
      }),
      cta: { labelKey: "engine.coach.todayCta", href: `workout.html?day=${todayKey}` },
      weight: 10,
    }];
  }

  /** The headline feature: which lifts are going up, with the receipts. */
  function progressionInsights(profile, plan) {
    if (!plan || plan.empty) return [];
    const changes = [];
    plan.sessions.forEach(s => s.blocks.forEach(b => {
      if (b.action === "increase" && b.delta) {
        const ex = exerciseById(b.exerciseId);
        changes.push({ session: s, block: b, exercise: ex });
      }
    }));
    if (!changes.length) return [];

    const top = changes.slice(0, 6);
    const lines = top.map(c => {
      const ev = c.block.evidence;
      return I18n.m("engine.coach.progLine", {
        name: I18n.ref("ex", c.exercise.id),
        from: ev ? I18n.m("engine.coach.progArrowed", { weight: ev.weight }) : "",
        to: I18n.ref("load", c.block.weight, c.exercise.id),
        evidence: ev ? I18n.m("engine.coach.progEvidence", {
          reps: ev.reps.join("/"),
          rpe: ev.avgRpe ? I18n.m("engine.coach.progEvidenceRpe", { rpe: ev.avgRpe }) : "",
        }) : "",
      });
    });
    const overflow = changes.length - top.length;

    return [{
      key: `prog-${changes.map(c => c.exercise.id + c.block.weight).join("|").slice(0, 60)}`,
      category: "progression",
      severity: "good",
      title: I18n.m("engine.coach.progTitle", { count: changes.length }),
      body: I18n.m("engine.coach.progBody", {
        lines: { $: "__lines", v: lines, x: overflow },
      }),
      weight: 7,
    }];
  }

  function plateauInsights(profile) {
    return Adaptation.detectPlateaus(profile).slice(0, 3).map(p => {
      const alt = p.alternatives[0];
      return {
        key: `plateau-${p.exerciseId}`,
        category: "plateau",
        severity: "warn",
        title: I18n.m("engine.coach.plateauTitle", { name: I18n.ref("ex", p.exerciseId) }),
        body: I18n.m("engine.coach.plateauBody", {
          sessions: p.sessions,
          trend: p.trend.slopePerWeek != null
            ? I18n.m("engine.coach.plateauTrendValue", { slope: Progression.signed(p.trend.slopePerWeek) })
            : I18n.m("engine.coach.plateauTrendFlat"),
          alt: alt ? I18n.m("engine.coach.plateauAlt", {
                 name: I18n.ref("ex", alt.exercise.id), why: alt.why }) : "",
        }),
        apply: alt ? { type: "swap_exercise", templateId: null, pattern: p.exercise.pattern, toId: alt.exercise.id, fromId: p.exerciseId } : null,
        applyLabel: alt ? I18n.m("engine.coach.plateauSwapLabel", { name: I18n.ref("ex", alt.exercise.id) }) : null,
        weight: 6,
      };
    });
  }

  /**
   * The block is scheduled to deload on a fixed week, which assumes fatigue
   * accumulates at the rate the calendar expects. When effort, rep completion
   * and measured strength all say otherwise, say so — an early deload is
   * cheaper than three more weeks of grinding into it.
   */
  function fatigueInsights(profile, phase) {
    if (phase.type === "deload") return [];
    const f = Analysis.fatigue(profile);
    if (!f.ready || !f.overreached) return [];
    return [{
      key: `fatigue-${f.signals.join("-")}-${f.completion}`,
      category: "fatigue", severity: "warn",
      title: I18n.m("engine.coach.fatigueTitle"),
      body: I18n.m("engine.coach.fatigueBody", {
        rpeFrom: f.priorRpe, rpeTo: f.recentRpe,
        drift: Progression.signed(f.rpeDrift),
        completion: f.completion,
        slope: f.slopePerWeek == null ? null : Progression.signed(f.slopePerWeek),
        week: phase.week, weeks: phase.weeks,
      }),
      apply: { type: "new_cycle", weeks: (profile.meso && profile.meso.weeks) || 4, deloadNow: true },
      applyLabel: I18n.m("engine.coach.fatigueApply"),
      weight: 9,
    }];
  }

  /**
   * Opposing patterns drifting apart is the imbalance people cannot see in
   * themselves — the bench climbs, the row does not follow, and the shoulder
   * pays for it eighteen months later.
   */
  function balanceInsights(profile) {
    return Analysis.balance(profile)
      .filter(p => p.status !== "balanced")
      .slice(0, 2)
      .map(p => ({
        key: `balance-${p.id}-${p.status}`,
        category: "balance", severity: "warn",
        title: I18n.m(`engine.coach.balance.${p.id}.${p.status}`),
        body: I18n.m("engine.coach.balanceBody", {
          weak: I18n.ref("ex", p.weakExerciseId),
          strong: I18n.ref("ex", p.strongExerciseId),
          ratio: p.ratio, ideal: p.ideal, low: p.low, high: p.high,
          shortfall: p.shortfallKg,
        }),
        apply: p.weakExerciseId ? { type: "set_delta", exerciseId: p.weakExerciseId, delta: +1 } : null,
        applyLabel: p.weakExerciseId
          ? I18n.m("engine.adapt.volAddLabel", { exercise: I18n.ref("ex", p.weakExerciseId) }) : null,
        weight: 6,
      }));
  }

  /**
   * Reps collapsing across sets is a specific problem with a specific fix, and
   * which fix depends on where it collapses — too heavy for the set count, or
   * not enough rest between them.
   */
  function dropOffInsights(profile) {
    return Analysis.dropOff(profile).slice(0, 2).map(d => ({
      key: `dropoff-${d.exerciseId}-${d.dropPct}`,
      category: "execution", severity: "info",
      title: I18n.m("engine.coach.dropOffTitle", { name: I18n.ref("ex", d.exerciseId) }),
      body: I18n.m("engine.coach.dropOffBody", {
        first: d.first, last: d.last, sets: d.sets, pct: d.dropPct,
        rest: d.restSec, restPlus: d.restSec ? d.restSec + 30 : null, sessions: d.sessions,
      }),
      weight: 5,
    }));
  }

  /** One forward-looking number, and only where the trend line actually fits. */
  function forecastInsight(profile) {
    const f = Analysis.bestForecast(profile);
    if (!f) return [];
    return [{
      key: `forecast-${f.exerciseId}-${f.target}`,
      category: "forecast", severity: "good",
      title: I18n.m("engine.coach.forecastTitle", {
        name: I18n.ref("ex", f.exerciseId), target: f.target,
      }),
      body: I18n.m("engine.coach.forecastBody", {
        name: I18n.ref("ex", f.exerciseId),
        current: f.current, target: f.target,
        rate: Progression.signed(f.slopePerWeek),
        weeks: f.weeks, date: I18n.date(f.date, { day: "numeric", month: "long" }),
        confidence: I18n.m(`engine.coach.confidence.${f.confidence}`),
        r2: f.r2,
      }),
      weight: 3,
    }];
  }

  /** Fatiguing accessories placed ahead of the lift the session is built on. */
  function orderingInsights(plan) {
    if (!plan || plan.empty) return [];
    const found = [];
    plan.sessions.forEach(s => Analysis.ordering(s).forEach(p => found.push(p)));
    if (!found.length) return [];
    const p = found[0];
    return [{
      key: `order-${p.templateId}-${p.before}-${p.primary}`,
      category: "execution", severity: "info",
      title: I18n.m("engine.coach.orderTitle", { session: I18n.ref("template", p.templateId) }),
      body: I18n.m("engine.coach.orderBody", {
        before: I18n.ref("ex", p.before), primary: I18n.ref("ex", p.primary),
        muscle: I18n.ref("muscle", p.muscle),
      }),
      weight: 4,
    }];
  }

  /**
   * Back after time off. This sits above everything else in the feed because
   * it reframes every number underneath it: the loads are down on purpose, and
   * a returning lifter who is not told that reads the drop as failure and
   * loads the bar back up.
   */
  function comebackInsight(profile) {
    const back = Progression.layoffState(profile);
    if (!back) return [];
    if (back.sessionsBack > 0) {
      return [{
        key: `comeback-ramp-${back.gapDays}-${back.sessionsBack}`,
        category: "session", severity: "info",
        title: I18n.m("engine.coach.comebackRampTitle", { n: back.sessionsBack + 1 }),
        body: I18n.m("engine.coach.comebackRampBody", { rpe: back.rpeCap, of: back.sessions }),
        weight: 7,
      }];
    }
    return [{
      key: `comeback-${back.gapDays}`,
      category: "session", severity: "warn",
      title: I18n.m("engine.coach.comebackTitle", {
        days: I18n.m("common.daysCount", { count: back.gapDays }) }),
      body: I18n.m("engine.coach.comebackBody", {
        pct: Math.round(back.loss * 100), rpe: back.rpeCap,
        sessions: I18n.m("common.sessions", { count: back.sessions }),
      }),
      weight: 11,
    }];
  }

  function adherenceInsights(profile) {
    // Judging attendance needs something to judge. A profile created this
    // morning has not "missed" sixteen sessions, and telling it so is both
    // wrong and discouraging.
    const weeksOld = (Date.now() - (profile.createdAt || Date.now())) / (7 * 86400000);
    if (weeksOld < 2 || (profile.sessionLog || []).length < 3) return [];
    const a = Store.adherence(profile, 4);
    const streak = Store.streakWeeks(profile);
    const out = [];
    if (a.expected >= 8 && a.pct >= 85) {
      out.push({
        key: `adh-good-${a.done}`,
        category: "adherence", severity: "good",
        title: I18n.m("engine.coach.adhGoodTitle", { pct: a.pct }),
        body: I18n.m("engine.coach.adhGoodBody", {
          done: a.done, expected: a.expected,
          streak: streak > 1 ? I18n.m("engine.coach.adhGoodStreak", { count: streak }) : "",
        }),
        weight: 3,
      });
    } else if (a.expected >= 8 && a.pct < 55) {
      out.push({
        key: `adh-low-${a.done}`,
        category: "adherence", severity: "warn",
        title: I18n.m("engine.coach.adhLowTitle", { done: a.done, expected: a.expected }),
        body: I18n.m("engine.coach.adhLowBody"),
        weight: 4,
      });
    }
    return out;
  }

  /**
   * Rate of bodyweight change against the goal.
   * 0.5–1% of bodyweight per week is the usual sustainable fat-loss band —
   * faster than that and you start paying for it in strength and muscle.
   */
  function bodyweightInsights(profile) {
    const log = (profile.weightLog || []).slice().sort((a, b) => a.date.localeCompare(b.date));
    if (log.length < 3) return [];
    const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 28);
    const recent = log.filter(w => new Date(w.date) >= cutoff);
    if (recent.length < 3) return [];

    const first = recent[0], last = recent[recent.length - 1];
    const days = Math.max(7, (new Date(last.date) - new Date(first.date)) / 86400000);
    const perWeek = ((last.weightKg - first.weightKg) / days) * 7;
    const pctPerWeek = (perWeek / last.weightKg) * 100;
    const goal = profile.goal;
    const dir = perWeek < 0 ? "down" : perWeek > 0 ? "up" : "flat";
    const abs = Math.abs(perWeek).toFixed(2);

    if (goal === "Fat loss") {
      if (perWeek >= -0.05) {
        return [{
          key: `bw-stall-${last.date}`, category: "nutrition", severity: "warn",
          title: I18n.m("engine.coach.bwStallTitle"),
          body: I18n.m("engine.coach.bwStallBody", {
            days: Math.round(days),
            direction: dir === "flat"
              ? I18n.m("engine.coach.bwStallNowhere")
              : I18n.m("engine.coach.bwStallDir", {
                  dir: I18n.m(dir === "down" ? "engine.coach.bwDirDown" : "engine.coach.bwDirUp"), amount: abs }),
          }),
          weight: 4,
        }];
      }
      if (pctPerWeek < -1.2) {
        return [{
          key: `bw-fast-${last.date}`, category: "nutrition", severity: "warn",
          title: I18n.m("engine.coach.bwFastTitle", { amount: abs }),
          body: I18n.m("engine.coach.bwFastBody", { pct: Math.abs(pctPerWeek).toFixed(1) }),
          weight: 4,
        }];
      }
      return [{
        key: `bw-good-${last.date}`, category: "nutrition", severity: "good",
        title: I18n.m("engine.coach.bwGoodTitle", { amount: abs }),
        body: I18n.m("engine.coach.bwGoodBody", { pct: Math.abs(pctPerWeek).toFixed(1) }),
        weight: 3,
      }];
    }

    if (goal === "Muscle gain" && perWeek <= 0.02) {
      return [{
        key: `bw-nogain-${last.date}`, category: "nutrition", severity: "info",
        title: I18n.m("engine.coach.bwNoGainTitle"),
        body: I18n.m("engine.coach.bwNoGainBody", { amount: abs, days: Math.round(days) }),
        weight: 3,
      }];
    }
    return [];
  }

  function painInsights(profile) {
    const pain = (profile.flags && profile.flags.pain) || {};
    const entries = Object.entries(pain).filter(([, j]) => j);
    if (!entries.length) return [];
    return [{
      key: `pain-${entries.map(e => e.join(":")).join("|")}`,
      category: "health", severity: "warn",
      title: I18n.m("engine.coach.painTitle", { count: entries.length }),
      body: I18n.m("engine.coach.painBody", {
        list: { $: "__painList", v: entries },
        them: I18n.m(entries.length === 1 ? "engine.coach.painThemOne" : "engine.coach.painThemMany"),
      }),
      weight: 5,
    }];
  }

  function planWarnings(plan) {
    if (!plan || !plan.warnings || !plan.warnings.length) return [];
    return plan.warnings.map((w, i) => ({
      key: `warn-${i}-${(w && w.k) || String(w).slice(0, 24)}`,
      category: "plan", severity: "info",
      title: I18n.m("engine.coach.warnTitle"),
      body: w,
      weight: 2,
    }));
  }

  /* ------------------------------------------------------------------
     Session-time coaching
     ------------------------------------------------------------------ */

  /**
   * A short cue for the set you are about to do. Called live in the workout
   * player, so it has to be immediately actionable — no essays between sets.
   */
  function setCue(block, setIndex, loggedSets) {
    const ex = exerciseById(block.exerciseId);
    const done = loggedSets.filter(s => s.exerciseId === block.exerciseId && s.done);
    const isFirst = done.length === 0;
    const isLast = setIndex === block.sets - 1;

    if (isFirst) {
      if (block.action === "increase")  return I18n.t("engine.coach.cueFirstIncrease", { lo: block.repLo, rir: Math.round(10 - block.rpeCap) });
      if (block.action === "calibrate") return I18n.t("engine.coach.cueFirstCalibrate", { plus: block.repHi + 3, hi: block.repHi });
      if (block.action === "deload")    return I18n.t("engine.coach.cueFirstDeload");
      return I18n.t("engine.coach.cueFirstDefault", { lo: block.repLo, hi: block.repHi, rpeCap: block.rpeCap });
    }

    const lastSet = done[done.length - 1];
    const remaining = block.sets - done.length;
    if (lastSet && lastSet.rpe != null && lastSet.rpe >= 9.5 && !isLast) {
      return I18n.t("engine.coach.cueTooHard", { rpe: lastSet.rpe, remaining });
    }
    if (lastSet && lastSet.reps >= block.repHi && lastSet.rpe != null && lastSet.rpe <= 7) {
      return I18n.t("engine.coach.cueRoomLeft", { reps: lastSet.reps, rpe: lastSet.rpe });
    }
    if (isLast) return I18n.t("engine.coach.cueLast", { rpeCap: block.rpeCap });
    return I18n.t("engine.coach.cueDefault", {
      n: setIndex + 1, total: block.sets,
      target: lastSet ? I18n.t("engine.coach.cueTargetReps", { reps: lastSet.reps })
                      : I18n.t("engine.coach.cueTargetRange", { lo: block.repLo, hi: block.repHi }),
    });
  }

  /** End-of-session summary, written from what actually got logged. */
  function sessionDebrief(profile, session) {
    const logged = (session.sets || []).filter(s => s.done);
    if (!logged.length) return { headline: I18n.t("engine.coach.debriefNothing"), lines: [], tonnage: 0 };

    const tonnage = Math.round(Progression.sessionTonnage(session));
    const byExercise = {};
    logged.forEach(s => { (byExercise[s.exerciseId] = byExercise[s.exerciseId] || []).push(s); });

    const lines = [];
    let prs = 0;
    Object.entries(byExercise).forEach(([exId, sets]) => {
      const ex = exerciseById(exId);
      if (!ex) return;
      const best = Progression.sessionBest1RM(sets, ex, Number(profile.weightKg) || 80);
      const history = Progression.strengthSeries(profile, exId);
      const previousBest = history.reduce((m, p) => Math.max(m, p.e1rm), 0);
      if (best > previousBest && previousBest > 0) {
        prs++;
        lines.push({ kind: "pr", text: I18n.t("engine.coach.debriefPrLine", { name: I18n.ref("ex", exId), best, previous: previousBest }) });
      }
      const block = (session.blocks || []).find(b => b.exerciseId === exId);
      if (block) {
        const allTop = sets.every(s => s.reps >= block.repHi);
        if (allTop) lines.push({ kind: "next", text: I18n.t("engine.coach.debriefNextLine", { name: I18n.ref("ex", exId), hi: block.repHi }) });
        const rated = sets.filter(s => s.rpe != null);
        if (rated.length && rated.every(s => s.rpe >= 9.5)) {
          lines.push({ kind: "warn", text: I18n.t("engine.coach.debriefWarnLine", { name: I18n.ref("ex", exId) }) });
        }
      }
    });

    const headline = prs
      ? I18n.t("engine.coach.debriefPr", { count: prs })
      : I18n.t(logged.length >= 12 ? "engine.coach.debriefSolid" : "engine.coach.debriefLogged");

    return { headline, lines, tonnage, setsLogged: logged.length };
  }

  /* ------------------------------------------------------------------
     Readiness check-in
     ------------------------------------------------------------------ */

  const READINESS_QUESTIONS = [
    { id: "sleep",    weight: 0.30 },
    { id: "soreness", weight: 0.25 },
    { id: "energy",   weight: 0.25 },
    { id: "stress",   weight: 0.20 },
  ];

  /** Weighted 1–5 answers → a 0–100 readiness score plus what it will do. */
  function scoreReadiness(answers) {
    let total = 0, weightSum = 0;
    READINESS_QUESTIONS.forEach(q => {
      const v = Number(answers[q.id]);
      if (!v) return;
      total += ((v - 1) / 4) * q.weight;
      weightSum += q.weight;
    });
    const score = weightSum ? Math.round((total / weightSum) * 100) : 70;
    const mod = Progression.readinessModifier(score);
    return { ...answers, score, noteKey: mod.noteKey, loadScale: mod.loadScale, setDelta: mod.setDelta };
  }

  /* ------------------------------------------------------------------
     Public
     ------------------------------------------------------------------ */

  /** Rebuild and persist the feed. Called after anything that changes state. */
  function refreshFeed(profile) {
    if (!profile) return [];
    const feed = buildFeed(profile);
    Store.setCoachFeed(profile.id, feed);
    return feed;
  }

  return {
    buildFeed, refreshFeed, setCue, sessionDebrief,
    scoreReadiness, READINESS_QUESTIONS,
  };
})();
