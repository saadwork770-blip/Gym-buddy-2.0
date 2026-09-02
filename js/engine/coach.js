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

    msgs.push(...phaseInsight(profile, phase));
    msgs.push(...todayInsight(profile, plan));
    msgs.push(...progressionInsights(profile, plan));
    msgs.push(...plateauInsights(profile));
    msgs.push(...Adaptation.volumeProposals(profile, plan).map(toMessage));
    msgs.push(...Adaptation.scheduleProposals(profile).map(toMessage));
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
      title: `${phase.label} — ${phase.headline}`,
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
        title: "Session logged for today",
        body: "Your next prescriptions have already been recalculated from what you just lifted — open the Program tab to see what changed.",
        weight: 9,
      }];
    }
    if (!session) {
      const rest = (plan.restDays || []).find(r => r.dayKey === todayKey);
      return [{
        key: `today-rest-${todayKey}`,
        category: "session", severity: "info",
        title: `${DAY_LABELS[todayKey]} is a rest day`,
        body: rest ? rest.suggestion : "No session scheduled today. Recovery is when the adaptation actually happens.",
        weight: 8,
      }];
    }
    const increases = session.blocks.filter(b => b.action === "increase").length;
    return [{
      key: `today-${todayKey}-${session.templateId}`,
      category: "session", severity: "action",
      title: `${session.name} today — about ${session.estMinutes} minutes`,
      body: `${session.totalSets} working sets across ${session.blocks.length} exercises${increases ? `, and ${increases} of them ${increases === 1 ? "has" : "have"} earned a weight increase` : ""}. Start the session and the coach will call the load and the rest period for every set.`,
      cta: { label: "Start session", href: `workout.html?day=${todayKey}` },
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
      const from = ev ? ev.weight : null;
      return `• ${c.exercise.name}: ${from != null ? `${from} → ` : ""}${Progression.fmtLoad(c.block.weight, c.exercise)}${ev ? ` (last: ${ev.reps.join("/")} reps${ev.avgRpe ? ` @ RPE ${ev.avgRpe}` : ""})` : ""}`;
    });

    return [{
      key: `prog-${changes.map(c => c.exercise.id + c.block.weight).join("|").slice(0, 60)}`,
      category: "progression",
      severity: "good",
      title: `${changes.length} lift${changes.length === 1 ? "" : "s"} moving up this week`,
      body: `You earned these by hitting the top of the rep range with reps to spare:\n${lines.join("\n")}${changes.length > top.length ? `\n…and ${changes.length - top.length} more.` : ""}`,
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
        title: `${p.exercise.name} has stalled`,
        body: `${p.sessions} logged sessions and the estimated 1RM trend is ${p.trend.slopePerWeek != null ? `${p.trend.slopePerWeek >= 0 ? "+" : ""}${p.trend.slopePerWeek} kg/week` : "flat"}. The engine has already cut the load to rebuild from, but if it stalls again the exercise itself is the problem rather than the weight on it.${alt ? ` ${alt.exercise.name} is the closest substitute: ${alt.why.charAt(0).toLowerCase()}${alt.why.slice(1)}` : ""}`,
        apply: alt ? { type: "swap_exercise", templateId: null, pattern: p.exercise.pattern, toId: alt.exercise.id, fromId: p.exerciseId } : null,
        applyLabel: alt ? `Swap in ${alt.exercise.name}` : null,
        weight: 6,
      };
    });
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
        title: `${a.pct}% attendance over the last 4 weeks`,
        body: `${a.done} of ${a.expected} scheduled sessions done${streak > 1 ? `, ${streak} weeks in a row` : ""}. Consistency at this level is what makes the load numbers on the other tabs mean anything.`,
        weight: 3,
      });
    } else if (a.expected >= 8 && a.pct < 55) {
      out.push({
        key: `adh-low-${a.done}`,
        category: "adherence", severity: "warn",
        title: `Only ${a.done} of ${a.expected} sessions in the last 4 weeks`,
        body: `A program you attend half the time is not the program you designed. Before changing anything about the training itself, it is worth trimming the schedule to days you will genuinely make — check the schedule suggestions below.`,
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
          title: "Bodyweight is not moving",
          body: `Over the last ${Math.round(days)} days your weight has gone ${dir === "flat" ? "nowhere" : `${dir} ${abs} kg/week`}. Training is doing its job — the log shows that — but fat loss is decided by the calorie balance around it. This app does not track food, and it is not going to pretend it can fix that from here.`,
          weight: 4,
        }];
      }
      if (pctPerWeek < -1.2) {
        return [{
          key: `bw-fast-${last.date}`, category: "nutrition", severity: "warn",
          title: `Losing ${abs} kg/week — faster than the useful range`,
          body: `That is about ${Math.abs(pctPerWeek).toFixed(1)}% of bodyweight per week, above the 0.5–1% band where strength is generally preserved. If your working weights start sliding on the Progress tab, that is the cost showing up. Slowing the rate usually keeps more muscle.`,
          weight: 4,
        }];
      }
      return [{
        key: `bw-good-${last.date}`, category: "nutrition", severity: "good",
        title: `Down ${abs} kg/week — right in the band`,
        body: `${Math.abs(pctPerWeek).toFixed(1)}% of bodyweight per week sits inside the 0.5–1% range where fat comes off while strength holds. Keep the load progressions honest and this is exactly what you want to see.`,
        weight: 3,
      }];
    }

    if (goal === "Muscle gain" && perWeek <= 0.02) {
      return [{
        key: `bw-nogain-${last.date}`, category: "nutrition", severity: "info",
        title: "Bodyweight is flat on a muscle-gain goal",
        body: `Weight has moved ${abs} kg/week over the last ${Math.round(days)} days. Beginners can gain muscle without gaining weight for a while, but if the working loads on the Progress tab also flatten out, the limiting factor is food rather than programming.`,
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
      title: `${entries.length} exercise${entries.length === 1 ? "" : "s"} flagged for joint pain`,
      body: `${entries.map(([exId, joint]) => `${(exerciseById(exId) || {}).name || exId} (${joint.replace("_", " ")})`).join(", ")}. The scheduler is routing around ${entries.length === 1 ? "it" : "them"} and filling the slot with a movement that spares that joint. Clear the flag from the exercise page once it settles — and if pain persists past a couple of weeks, that is a question for a physio, not a training app.`,
      weight: 5,
    }];
  }

  function planWarnings(plan) {
    if (!plan || !plan.warnings || !plan.warnings.length) return [];
    return plan.warnings.map((w, i) => ({
      key: `warn-${i}-${w.slice(0, 24)}`,
      category: "plan", severity: "info",
      title: "Plan adjustment",
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
      if (block.action === "increase") return `First set at the new weight. Expect it to feel heavier — target ${block.repLo}+ reps and stop with ${Math.round(10 - block.rpeCap)} in the tank.`;
      if (block.action === "calibrate") return `Feel-out set. Pick a weight you could do ${block.repHi + 3} times and stop at ${block.repHi}. The coach corrects from here.`;
      if (block.action === "deload") return `Deload set — this should feel easy and it is meant to. Move well, stop early.`;
      return `Target ${block.repLo}–${block.repHi} reps, capped at RPE ${block.rpeCap}.`;
    }

    const lastSet = done[done.length - 1];
    if (lastSet && lastSet.rpe != null && lastSet.rpe >= 9.5 && !isLast) {
      return `That was RPE ${lastSet.rpe} with ${block.sets - done.length} set${block.sets - done.length === 1 ? "" : "s"} to go. Take an extra 30 seconds of rest, or drop 5% — grinding the rest out at that effort costs more than it buys.`;
    }
    if (lastSet && lastSet.reps >= block.repHi && lastSet.rpe != null && lastSet.rpe <= 7) {
      return `${lastSet.reps} reps at RPE ${lastSet.rpe} — you have room. Match or beat that this set; you have earned a jump next session.`;
    }
    if (isLast) return `Last set. Everything left goes here — take it one rep past comfortable, stopping at RPE ${block.rpeCap}.`;
    return `Set ${setIndex + 1} of ${block.sets}. Match ${lastSet ? `${lastSet.reps} reps` : `${block.repLo}–${block.repHi}`}, same control.`;
  }

  /** End-of-session summary, written from what actually got logged. */
  function sessionDebrief(profile, session) {
    const logged = (session.sets || []).filter(s => s.done);
    if (!logged.length) return { headline: "Nothing logged", lines: [], tonnage: 0 };

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
        lines.push({ kind: "pr", text: `${ex.name}: estimated 1RM up to ${best} kg, past your previous best of ${previousBest} kg.` });
      }
      const block = (session.blocks || []).find(b => b.exerciseId === exId);
      if (block) {
        const allTop = sets.every(s => s.reps >= block.repHi);
        if (allTop) lines.push({ kind: "next", text: `${ex.name}: every set at ${block.repHi}+ reps — the load goes up next session.` });
        const avgRpe = sets.filter(s => s.rpe != null);
        if (avgRpe.length && avgRpe.every(s => s.rpe >= 9.5)) {
          lines.push({ kind: "warn", text: `${ex.name}: every set at RPE 9.5+. That is above the productive ceiling for this phase — the next prescription pulls the load back.` });
        }
      }
    });

    const headline = prs
      ? `${prs} personal best${prs === 1 ? "" : "s"} in that session`
      : logged.length >= 12 ? "Solid session logged" : "Session logged";

    return { headline, lines, tonnage, setsLogged: logged.length };
  }

  /* ------------------------------------------------------------------
     Readiness check-in
     ------------------------------------------------------------------ */

  const READINESS_QUESTIONS = [
    { id: "sleep",     label: "Sleep last night",  low: "Barely slept",   high: "Slept great",     weight: 0.30 },
    { id: "soreness",  label: "Muscle soreness",   low: "Very sore",      high: "No soreness",     weight: 0.25 },
    { id: "energy",    label: "Energy right now",  low: "Running on empty", high: "Full of beans", weight: 0.25 },
    { id: "stress",    label: "Stress load",       low: "Overwhelmed",    high: "Calm",            weight: 0.20 },
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
    return { ...answers, score, note: mod.note, loadScale: mod.loadScale, setDelta: mod.setDelta };
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
