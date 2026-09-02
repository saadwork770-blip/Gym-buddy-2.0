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
    const { week, weeks, cycle } = weekIndex(profile, date);
    const isDeload = week === weeks;

    if (isDeload) {
      return {
        week, weeks, cycle, type: "deload",
        label: `Week ${week} · Deload`,
        volumeScale: 0.55, intensityScale: 0.9, setBonus: 0, rpeCap: 6.5,
        headline: "Planned recovery week",
        detail: "Sets drop to just over half, loads come down about 10%, and nothing goes near failure. This is where the fatigue you have built up over the last three weeks actually clears — skipping it is how a good block turns into a stall.",
      };
    }

    const loadingWeek = week;                        // 1..weeks-1
    const setBonus = loadingWeek >= 3 ? 1 : 0;
    const rpeCap = 7.5 + (loadingWeek - 1) * 0.5;    // 7.5 → 8.0 → 8.5
    const labels = ["Accumulation", "Accumulation", "Intensification"];
    return {
      week, weeks, cycle, type: loadingWeek >= 3 ? "intensification" : "accumulation",
      label: `Week ${week} · ${labels[Math.min(loadingWeek - 1, labels.length - 1)]}`,
      volumeScale: 1, intensityScale: 1 + (loadingWeek - 1) * 0.1, setBonus,
      rpeCap: Math.min(9, rpeCap),
      headline: loadingWeek === 1 ? "Fresh week — rebuild the groove"
              : loadingWeek === 2 ? "Volume week — add reps, not ego"
              : "Peak week — heaviest loads of the block",
      detail: loadingWeek === 1
        ? "Coming off a deload, everything should feel easy. Stay at RPE 7.5 and bank clean reps; the load will climb on its own over the next fortnight."
        : loadingWeek === 2
        ? "Effort ceiling moves to RPE 8. Chase the top of every rep range — this is the week that earns next week's weight jumps."
        : `Hardest week of the block: an extra hard set on the compounds and an RPE ${Math.min(9, rpeCap)} ceiling. Push here, then take the deload that follows.`,
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
        label: isDeload ? "Deload" : (w >= 3 ? "Peak" : `Build ${w}`),
      };
    });
  }

  return { phaseFor, weekIndex, newCycle, cycleOutline, DEFAULT_WEEKS };
})();
