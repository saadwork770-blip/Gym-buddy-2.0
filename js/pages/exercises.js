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
    { id: "all", key: "library.filterAll" },
    { id: "inplan", key: "library.filterInPlan" },
    { id: "compound", key: "library.filterCompound" },
    { id: "isolation", key: "library.filterIsolation" },
    { id: "flagged", key: "library.filterFlagged" },
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
        `<button class="chip ${m === activeMuscle ? "active" : ""}" data-muscle="${m}"
          aria-pressed="${m === activeMuscle}">${UI.t(m === "all" ? "library.allMuscles" : `muscle.${m}`)}</button>`).join("");
    document.getElementById("extraFilters").innerHTML =
      EXTRA_FILTERS.map(f => `<button class="chip ${f.id === activeExtra ? "active" : ""}" data-extra="${f.id}"
        aria-pressed="${f.id === activeExtra}">${UI.t(f.key)}</button>`).join("");

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
    const media =
      `<img class="ex-photo" src="${photoFor(ex.id)}" alt="${UI.esc(exName(ex.id))}" loading="lazy" decoding="async"
            data-clip="${clipFor(ex.id)}">
       ${UI.canPlayClips() ? `<span class="play-badge">${UI.t("library.badgeClip")}</span>` : ""}
       <span class="icon-fallback" aria-hidden="true">${ICONS[ex.icon] || ""}</span>`;

    return `
      <div class="ex-card" style="--accent-cat:${color}" data-id="${ex.id}" role="button" tabindex="0">
        <div class="ex-media">${media}</div>
        <div class="ex-body">
          <h3>${UI.esc(exName(ex.id))}</h3>
          <div class="ex-meta">
            <span class="badge" style="--accent-cat:${color}">${UI.esc(muscleLabel(ex.muscle))}</span>
            <span class="badge" style="--accent-cat:#8892a0">${UI.esc(exEquipment(ex.id))}</span>
            ${inPlan ? `<span class="badge" style="--accent-cat:var(--accent)">${UI.t("library.badgeInPlan")}</span>` : ""}
            ${flagged ? `<span class="badge" style="--accent-cat:#ffd43b">${UI.t("library.badgePain", { joint: jointLabel(flagged) })}</span>` : ""}
            ${excluded ? `<span class="badge" style="--accent-cat:#ff6b6b">${UI.t("library.badgeExcluded")}</span>` : ""}
          </div>
          <div class="ex-sets"><b>${UI.esc(prescriptionText(ex))}</b> · ${UI.esc(patternLabel(ex.pattern))}</div>
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
      return [exName(ex.id), ex.name, exEquipment(ex.id), equipmentLabel(ex.equipment), ex.equipment,
              patternLabel(ex.pattern), muscleLabel(ex.muscle)]
        .join(" ").toLowerCase().includes(q);
    });

    grid.innerHTML = list.map(ex => cardTemplate(ex, ctx)).join("");
    emptyState.style.display = list.length ? "none" : "block";

    grid.querySelectorAll(".ex-card").forEach(card => {
      card.addEventListener("click", () => openDetail(card.dataset.id));
      card.addEventListener("keydown", e => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openDetail(card.dataset.id); }
      });
      const img = card.querySelector(".ex-photo");
      if (!img) return;
      img.addEventListener("error", () => card.classList.add("no-photo"), { once: true });
      if (!UI.canPlayClips()) return;
      let clip = null;
      card.addEventListener("mouseenter", () => {
        if (!clip) {
          clip = document.createElement("video");
          clip.className = "ex-photo";
          clip.muted = true; clip.loop = true; clip.playsInline = true;
          clip.setAttribute("aria-hidden", "true");
          clip.src = img.dataset.clip;          // fetched on first hover only
        }
        if (img.parentNode) { img.replaceWith(clip); clip.play().catch(() => {}); }
      });
      card.addEventListener("mouseleave", () => {
        if (clip && clip.parentNode) { clip.pause(); clip.replaceWith(img); }
      });
    });
  }

  /* ---------------- Detail ---------------- */

  const JOINTS = ["shoulder", "elbow", "knee", "hip", "lower_back", "ankle"];

  /* Which session of the source program an exercise belongs to, by its day. */
  const DAY_TEMPLATE = { 1: "upper_a", 2: "lower_a", 4: "upper_b", 5: "lower_b" };
  function templateNameForDay(ex) {
    return DAY_TEMPLATE[ex.day] ? templateName(DAY_TEMPLATE[ex.day]) : patternLabel(ex.pattern);
  }

  function openDetail(id) {
    const ex = exerciseById(id);
    if (!ex) return;
    const p = Store.getActiveProfile();
    const color = MUSCLE_COLORS[ex.muscle];
    const pain = (p && p.flags && p.flags.pain) || {};
    const excluded = new Set((p && p.flags && p.flags.excluded) || []);
    const rx = p ? (p.prescriptions || {})[id] : null;
    const series = p ? Progression.strengthSeries(p, id) : [];

    const mediaBlock = `
      <figure class="clip-figure">
        ${UI.exerciseClip(ex.id, exName(ex.id))}
        <figcaption>${UI.esc(exMediaNote(ex.id) || I18n.t("library.clipCaption"))}</figcaption>
      </figure>`;

    const m = UI.modal(`
      <div class="modal-head" style="--accent-cat:${color}"><div>
        <span class="badge" style="--accent-cat:${color}">${UI.esc(muscleLabel(ex.muscle))}</span>
        <h3 style="margin-top:10px;">${UI.esc(exName(ex.id))}</h3>
        <div class="hint">${UI.esc(exEquipment(ex.id))} · ${UI.esc(patternLabel(ex.pattern))} · ${UI.esc(loadTypeLabel(ex.loadType))}</div>
      </div></div>
      <div class="modal-body">
        ${mediaBlock}

        ${p ? `<h4>${UI.t("library.yourLoad")}</h4>
          <div class="ev" style="display:flex;gap:20px;flex-wrap:wrap;font-size:.86rem;color:var(--text-dim);margin-bottom:6px;">
            <span>${UI.t("library.prescribed")} <b style="color:var(--accent)">${rx ? UI.esc(UI.fmt.load(rx.weight, ex)) : UI.t("common.notStarted")}</b></span>
            ${rx ? `<span>${I18n.num(rx.sets)} × ${I18n.num(rx.repLo)}–${I18n.num(rx.repHi)}</span>` : ""}
            ${series.length ? `<span>${UI.t("library.e1rm", {
              value: series[series.length - 1].e1rm, sessions: series.length })}</span>` : ""}
          </div>
          ${rx && rx.reason ? `<p style="font-size:.86rem;">${UI.tx(rx.reason)}</p>` : ""}` : ""}

        <h4>${UI.t("library.setsInPlan")}</h4>
        <p style="color:var(--text);font-weight:700;">${UI.esc(prescriptionText(ex))}</p>

        <h4>${UI.t("library.howTo")}</h4>
        <ol>${exSteps(ex.id).map(step => `<li>${UI.esc(step)}</li>`).join("")}</ol>

        <h4>${UI.t("library.tips")}</h4>
        <ul class="tips">${exTips(ex.id).map(tip => `<li>${UI.esc(tip)}</li>`).join("")}</ul>

        <h4>${UI.t("library.coachKnows")}</h4>
        <div class="ev" style="display:flex;gap:18px;flex-wrap:wrap;font-size:.82rem;color:var(--text-faint);">
          <span>${UI.t("library.metaPattern")} <b style="color:var(--text-dim)">${UI.esc(patternLabel(ex.pattern))}</b></span>
          <span>${UI.t("library.metaRole")} <b style="color:var(--text-dim)">${UI.esc(roleLabel(ex.role))}</b></span>
          <span>${UI.t("library.metaSteps", { value: ex.loadSpec.increment || "—", unit: ex.loadSpec.unit })}</span>
          <span>${UI.t("library.metaFatigue", { value: ex.fatigue || "—" })}</span>
          <span>${UI.t("library.metaJoints", {
            joints: (ex.jointStress || []).map(j => jointLabel(j)).join(I18n.isRTL() ? "، " : ", ")
                    || I18n.t("library.metaNoJoints") })}</span>
        </div>

        ${p ? `
        <h4>${UI.t("library.notWorking")}</h4>
        <p style="font-size:.86rem;">${UI.t("library.notWorkingBody")}</p>
        <div class="field" style="max-width:260px;margin-bottom:14px;">
          <label for="painSelect">${UI.t("library.painLabel")}</label>
          <select id="painSelect">
            <option value="">${UI.t("library.noPain")}</option>
            ${JOINTS.map(j => `<option value="${j}" ${pain[id] === j ? "selected" : ""}>${UI.esc(jointLabel(j))}</option>`).join("")}
          </select>
        </div>
        <div class="inline-actions">
          <button class="btn btn-ghost btn-sm" id="excludeBtn">${UI.t(excluded.has(id) ? "library.includeBtn" : "library.excludeBtn")}</button>
          <button class="btn btn-ghost btn-sm" id="altBtn">${UI.t("library.altBtn")}</button>
        </div>` : `<div class="source-note">${UI.t("library.noProfile")}</div>`}

        <div class="source-note">${UI.t("library.fromPlan", {
          day: ex.day ? I18n.t("library.dayOf", { n: ex.day, name: templateNameForDay(ex) })
                      : patternLabel(ex.pattern) })}</div>
      </div>`, { wide: false });

    if (!p) return;

    m.el.querySelector("#painSelect").addEventListener("change", e => {
      Store.flagPain(p.id, id, e.target.value || null);
      UI.toast(e.target.value
        ? I18n.t("library.painFlagged", { name: exName(id), joint: jointLabel(e.target.value) })
        : I18n.t("library.painCleared"));
      render();
    });

    m.el.querySelector("#excludeBtn").addEventListener("click", () => {
      Store.toggleExcluded(p.id, id);
      m.close(); render();
      UI.toast(I18n.t(excluded.has(id) ? "library.included" : "library.excluded", { name: exName(id) }));
    });

    m.el.querySelector("#altBtn").addEventListener("click", () => {
      const alts = Adaptation.alternativesFor(id, Store.getActiveProfile(), { avoidJoint: pain[id] || null, limit: 6 });
      m.close();
      UI.modal(`
        <div class="modal-head"><div><span class="pill info">${UI.t("library.altTitle")}</span>
          <h3 style="margin-top:10px;">${UI.t("library.altHeading", { name: exName(id) })}</h3></div></div>
        <div class="modal-body">
          ${alts.length ? `<table class="rx-table">${alts.map(a => `
            <tr><td><div class="rx-name">${UI.exerciseThumb(a.exercise.id)}<span>${UI.esc(exName(a.exercise.id))}</span></div>
              <div class="hint" style="margin-top:6px;">${UI.tx(a.why)}</div></td></tr>`).join("")}</table>`
            : `<p>${UI.t("library.altNone")}</p>`}
          <div class="source-note" data-i18n-html="library.altNote"></div>
        </div>`, { wide: true });
    });
  }

  searchInput.addEventListener("input", e => { query = e.target.value; render(); });
  buildFilters();
  render();

  const deep = new URLSearchParams(location.search).get("ex");
  if (deep && exerciseById(deep)) openDetail(deep);
});
