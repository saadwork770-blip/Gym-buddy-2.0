/* ============================================================================
   GymBuddy 2.0 — pages/index.js
   The landing page adapts to whether there is a profile and a plan yet.
   ============================================================================ */

UI.ready(() => {
  const p = Store.getActiveProfile();
  const actions = document.getElementById("heroActions");
  const stats = document.getElementById("heroStats");
  const card = document.getElementById("heroCard");

  if (!p) {
    actions.innerHTML = `
      <a href="profile.html" class="btn btn-primary">Set up your profile</a>
      <a href="exercises.html" class="btn btn-ghost">Browse the exercise library</a>`;
    stats.innerHTML = `
      <div class="stat"><b>${EXERCISES.length}</b><span>Exercises &amp; cardio options</span></div>
      <div class="stat"><b>1–6</b><span>Training days supported</span></div>
      <div class="stat"><b>7</b><span>Split templates</span></div>`;
    card.innerHTML = `
      <h3>The original plan, still intact</h3>
      <div class="day-row"><b>Day 1</b><span>Upper Body A</span></div>
      <div class="day-row"><b>Day 2</b><span>Lower Body A</span></div>
      <div class="day-row"><b>Day 3</b><span>Rest / light cardio</span></div>
      <div class="day-row"><b>Day 4</b><span>Upper Body B</span></div>
      <div class="day-row"><b>Day 5</b><span>Lower Body B</span></div>
      <div class="day-row"><b>Day 6–7</b><span>Rest / optional cardio</span></div>
      <p class="hint" style="margin:14px 0 0;">Pick four training days and version 2.0 reproduces this plan exactly,
      move for move — then starts adjusting it from what you log.</p>`;
    renderExplain();
    return;
  }

  const plan = Store.getPlan(p.id);
  const phase = Periodization.phaseFor(p);
  const todayKey = DAY_KEYS[(new Date().getDay() + 6) % 7];
  const today = plan.empty ? null : plan.sessions.find(s => s.dayKey === todayKey);
  const adherence = Store.adherence(p, 4);

  actions.innerHTML = `
    ${today ? `<a href="workout.html?day=${todayKey}" class="btn btn-primary">Start ${UI.esc(today.name)}</a>`
            : `<a href="program.html" class="btn btn-primary">See this week</a>`}
    <a href="coach.html" class="btn btn-ghost">What the coach is thinking</a>`;

  stats.innerHTML = `
    <div class="stat"><b>${(p.sessionLog || []).length}</b><span>Sessions logged</span></div>
    <div class="stat"><b>${plan.empty ? "—" : plan.dayCount}</b><span>Days a week</span></div>
    <div class="stat"><b>${adherence.pct}%</b><span>4-week attendance</span></div>`;

  card.innerHTML = `
    <h3>${UI.esc(phase.label)}</h3>
    ${plan.empty
      ? `<p style="margin:10px 0 0;">No training days picked yet.</p>
         <a href="program.html" class="btn btn-primary btn-sm" style="margin-top:12px;">Pick your days</a>`
      : plan.sessions.map(s => `
          <div class="day-row ${s.dayKey === todayKey ? "" : ""}">
            <b>${DAY_SHORT[s.dayKey]} — ${UI.esc(s.short)}</b>
            <span>${s.totalSets} sets · ${s.estMinutes} min</span>
          </div>`).join("") +
        `<p class="hint" style="margin:14px 0 0;">${UI.esc(plan.splitName)} · rebuilt ${UI.fmt.relDate(plan.generatedAt)}
         from your logged sessions.</p>`}`;

  renderExplain();
});

/** Three short, honest explanations of the mechanisms — no hand-waving. */
function renderExplain() {
  const items = [
    {
      title: "Double progression, then autoregulation",
      body: `Hit the top of the rep range on every set and the load goes up. How MUCH it goes up depends on how hard
             those sets felt: three sets at RPE 6.5 earns a double jump, the same reps at RPE 9 earns the smallest
             increment the machine has. Miss the bottom of the range at RPE 9.5 and the load comes back down about 6%.`,
    },
    {
      title: "Effort-adjusted 1RM, not raw weight",
      body: `Every set is converted to an estimated one-rep max using the reps you did plus the reps you left in
             reserve. That gives one number comparable across rep ranges, which is what plateau detection runs on — so
             a stall is three sessions of a flat trend line, not one bad day.`,
    },
    {
      title: "Volume landmarks and a planned deload",
      body: `Weekly hard sets per muscle are counted against maintenance, minimum-effective, adaptive and maximum
             recoverable volume. Anything over the recoverable ceiling is trimmed automatically; anything under the
             effective minimum is flagged. Every block ends in a deload week that dumps fatigue on purpose.`,
    },
  ];
  const host = document.getElementById("explainGrid");
  if (host) host.innerHTML = items.map(i => `
    <div class="card"><h3 style="font-size:1.02rem;">${i.title}</h3>
      <p style="font-size:.9rem;margin:0;">${i.body}</p></div>`).join("");
}
