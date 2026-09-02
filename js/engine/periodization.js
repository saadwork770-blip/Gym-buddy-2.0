/* ============================================================================
   GymBuddy 2.0 — engine/periodization.js
   ----------------------------------------------------------------------------
   Training in a straight line stops working. Volume climbs, fatigue climbs
   faster, and somewhere in week five everything stalls at once.

   This module runs the calendar underneath the program: a mesocycle of
   loading weeks that ramp volume and effort, closed by a planned deload that
   dumps fatigue before it turns into a plateau. Every other engine asks it
   "what week are we in and what does that mean" before making a decision.
   ============================================================================ */

const Periodization = (function () {

  const DEFAULT_WEEKS = 4;   // 3 loading weeks + 1 deload

  /** Which mesocycle week a date falls in, counting from the cycle start. */
  function weekIndex(profile, date) {
    const meso = (profile && profile.meso) || {};
    const weeks = meso.weeks || DEFAULT_WEEKS;
    const start = meso.startDate ? new Date(meso.startDate) : new Date(profile.createdAt || Date.now());
    const now = date ? new Date(date) : new Date();
    const elapsedWeeks = Math.floor((startOfWeek(now) - startOfWeek(start)) / (7 * 86400000));
    const idx = ((elapsedWeeks % weeks) + weeks) % weeks;
    return { week: idx + 1, weeks, cycle: Math.floor(elapsedWeeks / weeks) + 1 };
  }

  function startOfWeek(d) {
    const x = new Date(d);
    const day = (x.getDay() + 6) % 7;          // Monday = 0
    x.setHours(0, 0, 0, 0);
    x.setDate(x.getDate() - day);
    return x.getTime();
  }

  /**
   * The phase descriptor every other engine consumes.
   *   volumeScale    — multiplier on prescribed sets
   *   intensityScale — multiplier on the size of load jumps
   *   setBonus       — extra hard sets added to compounds this week
   *   rpeCap         — how close to failure this week is allowed to get
   */
  function phaseFor(profile, date) {
    let { week, weeks, cycle } = weekIndex(profile, date);

    /* Somebody who has not trained in a fortnight is not mid-mesocycle any
       more, whatever the calendar says. Greeting them with "week 4 · deload"
       on the day they walk back in is both wrong and demoralising, so the
       block presents as week 1 immediately and the calendar is re-anchored
       for real once that first session back is filed. */
    const back = (typeof Progression !== "undefined" && Progression.layoffState)
      ? Progression.layoffState(profile, date) : null;
    const returning = !!(back && back.sessionsBack === 0 && back.gapDays >= 14);
    if (returning) week = 1;

    const isDeload = week === weeks && !returning;

    if (isDeload) {
      return {
        week, weeks, cycle, returning, type: "deload",
        label: I18n.t("engine.phase.labelDeload", { week }),
        volumeScale: 0.55, intensityScale: 0.9, setBonus: 0, volumeRamp: 0, rpeCap: 6.5,
        headline: I18n.t("engine.phase.deload.headline"),
        detail: I18n.t("engine.phase.deload.detail"),
      };
    }

    const loadingWeek = week;                        // 1..weeks-1
    const setBonus = loadingWeek >= 3 ? 1 : 0;
    /* Volume ramp: week 1 runs the plan as prescribed, later weeks add work
       toward each muscle's adaptive volume. Expressed as a fraction of the gap
       between what the plan prescribes and the MAV ceiling, so it never cuts
       below the program you actually chose — it only builds on it. */
    const volumeRamp = Math.min(1, (loadingWeek - 1) * 0.45);
    const rpeCap = Math.min(9, 7.5 + (loadingWeek - 1) * 0.5);   // 7.5 → 8.0 → 8.5
    const intense = loadingWeek >= 3;
    const copyKey = loadingWeek === 1 ? "w1" : loadingWeek === 2 ? "w2" : "w3";
    return {
      week, weeks, cycle, returning,
      type: intense ? "intensification" : "accumulation",
      label: I18n.t(intense ? "engine.phase.labelIntensification" : "engine.phase.labelAccumulation", { week }),
      volumeScale: 1, intensityScale: 1 + (loadingWeek - 1) * 0.1, setBonus, volumeRamp,
      rpeCap,
      headline: I18n.t(`engine.phase.${copyKey}.headline`),
      detail: I18n.t(`engine.phase.${copyKey}.detail`, { rpe: rpeCap }),
    };
  }

  /** Start (or restart) a mesocycle from today. */
  function newCycle(weeks) {
    return { startDate: new Date().toISOString().slice(0, 10), weeks: weeks || DEFAULT_WEEKS };
  }

  /** The whole block laid out, for the calendar strip in the UI. */
  function cycleOutline(profile) {
    const weeks = (profile.meso && profile.meso.weeks) || DEFAULT_WEEKS;
    const current = weekIndex(profile).week;
    return Array.from({ length: weeks }, (_, i) => {
      const w = i + 1;
      const isDeload = w === weeks;
      return {
        week: w,
        current: w === current,
        type: isDeload ? "deload" : (w >= 3 ? "intensification" : "accumulation"),
        label: isDeload ? I18n.t("engine.phase.weekLabel.deload")
             : w >= 3   ? I18n.t("engine.phase.weekLabel.peak")
             :            I18n.t("engine.phase.weekLabel.build", { n: w }),
      };
    });
  }

  return { phaseFor, weekIndex, newCycle, cycleOutline, DEFAULT_WEEKS };
})();
