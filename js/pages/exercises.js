/* ============================================================================
   GymBuddy 2.0 — pages/exercises.js
   The library, extended with the coaching metadata and per-exercise controls:
   flag a joint, exclude a movement, see substitutions and your own history.
   ============================================================================ */

UI.ready(() => {
  const grid = document.getElementById("exGrid");
  const emptyState = document.getElementById("emptyState");
  const searchInput = document.getElementById("search");

  let activeMuscle = "all";
  let activeExtra = "all";
  let query = "";

  const EXTRA_FILTERS = [
    { id: "all",       label: "Everything" },
    { id: "inplan",    label: "In my plan" },
    { id: "compound",  label: "Compounds" },
    { id: "isolation", label: "Isolation" },
    { id: "flagged",   label: "Flagged / excluded" },
  ];

  function planExerciseIds() {
    const p = Store.getActiveProfile();
    if (!p || !p.plan || p.plan.empty) return new Set();
    return new Set(p.plan.sessions.flatMap(s => s.blocks.map(b => b.exerciseId)
      .concat(s.cardio ? [s.cardio.exerciseId] : [])));
  }

  function buildFilters() {
    document.getElementById("muscleFilters").innerHTML =
      ["all", ...Object.keys(MUSCLE_LABELS)].map(m =>
        `<button class="chip ${m === activeMuscle ? "active" : ""}" data-muscle="${m}">${
          m === "all" ? "All muscle groups" : MUSCLE_LABELS[m]}</button>`).join("");
    document.getElementById("extraFilters").innerHTML =
      EXTRA_FILTERS.map(f => `<button class="chip ${f.id === activeExtra ? "active" : ""}" data-extra="${f.id}">${f.label}</button>`).join("");

    document.querySelectorAll("[data-muscle]").forEach(c =>
      c.addEventListener("click", () => { activeMuscle = c.dataset.muscle; buildFilters(); render(); }));
    document.querySelectorAll("[data-extra]").forEach(c =>
      c.addEventListener("click", () => { activeExtra = c.dataset.extra; buildFilters(); render(); }));
  }

  function cardTemplate(ex, ctx) {
    const color = MUSCLE_COLORS[ex.muscle];
    const flagged = ctx.pain[ex.id];
    const excluded = ctx.excluded.has(ex.id);
    const inPlan = ctx.inPlan.has(ex.id);
    const media = ex.hasMedia === false
      ? `<span class="icon-fallback" style="display:flex;align-items:center;justify-content:center;width:100%;height:100%;">${ICONS[ex.icon] || ""}</span>
         <span class="play-badge">Diagram</span>`
      : `<img class="ex-photo" src="${photoFor(ex.id)}" alt="${UI.esc(ex.name)}" loading="lazy"
              data-photo="${photoFor(ex.id)}" data-gif="${gifFor(ex.id)}">
         <span class="play-badge">▶ GIF</span>
         <span class="icon-fallback">${ICONS[ex.icon] || ""}</span>`;

    return `
      <div class="ex-card" style="--accent-cat:${color}" data-id="${ex.id}">
        <div class="ex-media">${media}</div>
        <div class="ex-body">
          <h3>${UI.esc(ex.name)}</h3>
          <div class="ex-meta">
            <span class="badge" style="--accent-cat:${color}">${MUSCLE_LABELS[ex.muscle]}</span>
            <span class="badge" style="--accent-cat:#8892a0">${UI.esc(ex.equipment)}</span>
            ${inPlan ? `<span class="badge" style="--accent-cat:var(--accent)">In plan</span>` : ""}
            ${flagged ? `<span class="badge" style="--accent-cat:#ffd43b">${UI.esc(flagged.replace("_", " "))} pain</span>` : ""}
            ${excluded ? `<span class="badge" style="--accent-cat:#ff6b6b">Excluded</span>` : ""}
          </div>
          <div class="ex-sets"><b>${UI.esc(ex.sets)}</b> · ${UI.esc(PATTERNS[ex.pattern] || ex.dayLabel)}</div>
        </div>
      </div>`;
  }

  function render() {
    const p = Store.getActiveProfile();
    const ctx = {
      pain: (p && p.flags && p.flags.pain) || {},
      excluded: new Set((p && p.flags && p.flags.excluded) || []),
      inPlan: planExerciseIds(),
    };

    const q = query.trim().toLowerCase();
    const list = EXERCISES.filter(ex => {
      if (activeMuscle !== "all" && ex.muscle !== activeMuscle) return false;
      if (activeExtra === "inplan" && !ctx.inPlan.has(ex.id)) return false;
      if (activeExtra === "compound" && ex.role !== "compound") return false;
      if (activeExtra === "isolation" && ex.role !== "isolation") return false;
      if (activeExtra === "flagged" && !ctx.pain[ex.id] && !ctx.excluded.has(ex.id)) return false;
      if (!q) return true;
      return [ex.name, ex.equipment, PATTERNS[ex.pattern] || "", MUSCLE_LABELS[ex.muscle] || ""]
        .join(" ").toLowerCase().includes(q);
    });

    grid.innerHTML = list.map(ex => cardTemplate(ex, ctx)).join("");
    emptyState.style.display = list.length ? "none" : "block";

    grid.querySelectorAll(".ex-card").forEach(card => {
      card.addEventListener("click", () => openDetail(card.dataset.id));
      const img = card.querySelector(".ex-photo");
      if (!img) return;
      card.addEventListener("mouseenter", () => { img.src = img.dataset.gif; });
      card.addEventListener("mouseleave", () => { img.src = img.dataset.photo; });
      img.addEventListener("error", () => card.classList.add("no-photo"), { once: true });
    });
  }

  /* ---------------- Detail ---------------- */

  const JOINTS = ["shoulder", "elbow", "knee", "hip", "lower_back", "ankle"];

  function openDetail(id) {
    const ex = exerciseById(id);
    if (!ex) return;
    const p = Store.getActiveProfile();
    const color = MUSCLE_COLORS[ex.muscle];
    const pain = (p && p.flags && p.flags.pain) || {};
    const excluded = new Set((p && p.flags && p.flags.excluded) || []);
    const rx = p ? (p.prescriptions || {})[id] : null;
    const series = p ? Progression.strengthSeries(p, id) : [];

    const mediaBlock = ex.hasMedia === false
      ? `<div class="source-note">This movement ships with the line-art diagram rather than a photograph — it is one of
           the extra options the coach can substitute in, and no public-domain photo of it is bundled with the app.
           The instructions below are the same as for every other entry.</div>`
      : `<figure class="gif-figure">
           <img src="${gifFor(ex.id)}?t=${Date.now()}" alt="${UI.esc(ex.name)} — animated demonstration">
           <figcaption>${UI.esc(MEDIA_NOTES[ex.id] || "Looping demonstration: start position → end position.")}</figcaption>
         </figure>`;

    const m = UI.modal(`
      <div class="modal-head" style="--accent-cat:${color}"><div>
        <span class="badge" style="--accent-cat:${color}">${MUSCLE_LABELS[ex.muscle]}</span>
        <h3 style="margin-top:10px;">${UI.esc(ex.name)}</h3>
        <div class="hint">${UI.esc(ex.equipment)} · ${UI.esc(PATTERNS[ex.pattern] || "")} · ${UI.esc(ex.loadSpec.label)}</div>
      </div></div>
      <div class="modal-body">
        ${mediaBlock}

        ${p ? `<h4>Your working load</h4>
          <div class="ev" style="display:flex;gap:20px;flex-wrap:wrap;font-size:.86rem;color:var(--text-dim);margin-bottom:6px;">
            <span>Prescribed <b style="color:var(--accent)">${rx ? UI.esc(UI.fmt.load(rx.weight, ex)) : "not started"}</b></span>
            ${rx ? `<span>${rx.sets} x ${rx.repLo}–${rx.repHi}</span>` : ""}
            ${series.length ? `<span>Est. 1RM <b>${series[series.length - 1].e1rm} kg</b> over ${series.length} sessions</span>` : ""}
          </div>
          ${rx && rx.reason ? `<p style="font-size:.86rem;">${UI.esc(rx.reason)}</p>` : ""}` : ""}

        <h4>Sets &amp; reps in the source plan</h4>
        <p style="color:var(--text);font-weight:700;">${UI.esc(ex.sets)}</p>

        <h4>How to perform it</h4>
        <ol>${ex.steps.map(s => `<li>${UI.esc(s)}</li>`).join("")}</ol>

        <h4>Tips</h4>
        <ul class="tips">${ex.tips.map(t => `<li>${UI.esc(t)}</li>`).join("")}</ul>

        <h4>What the coach knows about it</h4>
        <div class="ev" style="display:flex;gap:18px;flex-wrap:wrap;font-size:.82rem;color:var(--text-faint);">
          <span>Pattern <b style="color:var(--text-dim)">${UI.esc(PATTERNS[ex.pattern] || "—")}</b></span>
          <span>Role <b style="color:var(--text-dim)">${UI.esc(ex.role || "—")}</b></span>
          <span>Progresses in <b style="color:var(--text-dim)">${ex.loadSpec.increment || "—"} ${ex.loadSpec.unit}</b> steps</span>
          <span>Systemic cost <b style="color:var(--text-dim)">${ex.fatigue || "—"}/5</b></span>
          <span>Loads <b style="color:var(--text-dim)">${(ex.jointStress || []).map(j => j.replace("_", " ")).join(", ") || "no major joints"}</b></span>
        </div>

        ${p ? `
        <h4>Not working for you?</h4>
        <p style="font-size:.86rem;">Flag a joint and the scheduler stops using this movement and fills the slot with
        something that spares it. Excluding removes it from your library entirely.</p>
        <div class="field" style="max-width:260px;margin-bottom:14px;">
          <label>Joint pain on this exercise</label>
          <select id="painSelect">
            <option value="">No pain</option>
            ${JOINTS.map(j => `<option value="${j}" ${pain[id] === j ? "selected" : ""}>${j.replace("_", " ")}</option>`).join("")}
          </select>
        </div>
        <div class="inline-actions">
          <button class="btn btn-ghost btn-sm" id="excludeBtn">${excluded.has(id) ? "Put back in my library" : "Exclude from my plan"}</button>
          <button class="btn btn-ghost btn-sm" id="altBtn">Show alternatives</button>
        </div>` : `<div class="source-note">Create a profile to get a prescribed load, flag joint pain, or see
          substitutions for this movement.</div>`}

        <div class="source-note">From your 4-Day Fat Loss Program — ${UI.esc(ex.day ? `Day ${ex.day} · ${ex.dayLabel}` : ex.dayLabel)}.</div>
      </div>`, { wide: false });

    if (!p) return;

    m.el.querySelector("#painSelect").addEventListener("change", e => {
      Store.flagPain(p.id, id, e.target.value || null);
      UI.toast(e.target.value
        ? `Flagged. The coach will route around ${ex.name} and fill the slot with something that spares your ${e.target.value.replace("_", " ")}.`
        : "Pain flag cleared — the exercise is back in rotation.");
      render();
    });

    m.el.querySelector("#excludeBtn").addEventListener("click", () => {
      Store.toggleExcluded(p.id, id);
      m.close(); render();
      UI.toast(excluded.has(id) ? `${ex.name} is back in your library.` : `${ex.name} removed from your plan.`);
    });

    m.el.querySelector("#altBtn").addEventListener("click", () => {
      const alts = Adaptation.alternativesFor(id, Store.getActiveProfile(), { avoidJoint: pain[id] || null, limit: 6 });
      m.close();
      UI.modal(`
        <div class="modal-head"><div><span class="pill info">Substitutions</span>
          <h3 style="margin-top:10px;">Instead of ${UI.esc(ex.name)}</h3></div></div>
        <div class="modal-body">
          ${alts.length ? `<table class="rx-table">${alts.map(a => `
            <tr><td><div class="rx-name">${UI.exerciseThumb(a.exercise.id)}<span>${UI.esc(a.exercise.name)}</span></div>
              <div class="hint" style="margin:6px 0 0 64px;">${UI.esc(a.why)}</div></td></tr>`).join("")}</table>`
            : `<p>Nothing else in your library trains this pattern under your current equipment settings.</p>`}
          <div class="source-note">To actually put one of these into a session, use <b>Swap this exercise</b> on the
          Coach tab — that pins it to the right slot rather than changing your whole plan.</div>
        </div>`, { wide: true });
    });
  }

  searchInput.addEventListener("input", e => { query = e.target.value; render(); });
  buildFilters();
  render();

  const deep = new URLSearchParams(location.search).get("ex");
  if (deep && exerciseById(deep)) openDetail(deep);
});
