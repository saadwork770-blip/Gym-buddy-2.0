/* ============================================================================
   GymBuddy 2.0 — pages/workout.js
   ----------------------------------------------------------------------------
   The live session. Three states:
     1. Picker    — no session running, choose which day to train
     2. Readiness — a four-question check-in that modulates the whole session
     3. Player    — set-by-set logging, rest timer, live coaching cues

   Everything is written to the active session on every interaction, so
   closing the tab mid-workout loses nothing.
   ============================================================================ */

UI.ready(() => {
  const profile = UI.requireProfile("root", "A workout session needs your prescriptions, which come from your profile and training history.");
  if (!profile) return;

  const root = document.getElementById("root");
  const params = new URLSearchParams(location.search);

  let restTimer = null;
  let restEnds = 0;
  let restTotal = 0;

  /* =====================================================================
     State 1 — pick a session
     ===================================================================== */

  function renderPicker() {
    const p = Store.getActiveProfile();
    const plan = Store.getPlan(p.id);
    const todayKey = DAY_KEYS[(new Date().getDay() + 6) % 7];

    if (plan.empty) {
      root.innerHTML = `<div class="gate"><h2>No training days selected</h2>
        <p>Choose the days you can train and the coach will build the sessions.</p>
        <a href="program.html" class="btn btn-primary">Set your training days</a></div>`;
      return;
    }

    const today = plan.sessions.find(s => s.dayKey === todayKey);
    root.innerHTML = `
      <div class="section-head">
        <div class="kicker">Workout</div>
        <h2>${today ? `${UI.esc(today.name)} is on today` : "No session scheduled today"}</h2>
        <p>${today
          ? `${today.totalSets} working sets, about ${today.estMinutes} minutes of lifting. The coach will call the load for every set and time your rest.`
          : "Today is a rest day on your current schedule — but you can run any session from the list below if your week has shifted."}</p>
      </div>
      <div class="session-grid">
        ${plan.sessions.map(s => `
          <div class="session-card ${s.dayKey === todayKey ? "today" : ""}">
            <div class="sh"><div><h3>${UI.esc(s.name)}</h3>
              <div class="sub">${DAY_LABELS[s.dayKey]} · ${s.totalSets} sets · ~${s.estMinutes} min</div></div>
              ${s.dayKey === todayKey ? `<span class="pill good">Today</span>` : ""}</div>
            <div class="sb">${s.blocks.map(b => `
              <div class="ex-line"><span class="nm"><b>${UI.esc(exerciseById(b.exerciseId).name)}</b></span>
              <span class="ld"><b>${UI.esc(UI.fmt.load(b.weight, exerciseById(b.exerciseId)))}</b>
              <span>${b.sets} x ${b.repLo}–${b.repHi}</span></span></div>`).join("")}</div>
            <div class="sf"><button class="btn ${s.dayKey === todayKey ? "btn-primary" : "btn-ghost"} btn-sm"
              data-start="${s.dayKey}">Start ${UI.esc(s.short)}</button></div>
          </div>`).join("")}
      </div>`;

    root.querySelectorAll("[data-start]").forEach(btn =>
      btn.addEventListener("click", () => renderReadiness(btn.dataset.start)));
  }

  /* =====================================================================
     State 2 — readiness check-in
     ===================================================================== */

  function renderReadiness(dayKey) {
    const p = Store.getActiveProfile();
    const plan = Store.getPlan(p.id);
    const planned = plan.sessions.find(s => s.dayKey === dayKey);
    if (!planned) { UI.toast("That session is not in your current plan.", "error"); return renderPicker(); }

    const answers = {};
    root.innerHTML = `
      <div style="max-width:620px;margin:0 auto;">
        <div class="section-head">
          <div class="kicker">${UI.esc(planned.name)}</div>
          <h2>How are you feeling?</h2>
          <p>Four questions, fifteen seconds. A session you go into under-recovered should not carry the same load as
          one you go into fresh — the coach uses this to scale today's weights and volume before you start, rather
          than letting you find out on set three.</p>
        </div>
        <div class="card">
          ${Coach.READINESS_QUESTIONS.map(q => `
            <div class="readiness-q">
              <label>${UI.esc(q.label)}</label>
              <div class="readiness-scale" data-q="${q.id}">
                ${[1, 2, 3, 4, 5].map(v => `<button data-v="${v}">${v}</button>`).join("")}
              </div>
              <div class="readiness-ends"><span>${UI.esc(q.low)}</span><span>${UI.esc(q.high)}</span></div>
            </div>`).join("")}
          <div id="readinessVerdict" class="hint" style="margin:6px 0 16px;"></div>
          <div class="form-actions">
            <button class="btn btn-primary" id="beginBtn" disabled>Start the session</button>
            <button class="btn btn-ghost" id="skipBtn">Skip — just use the plan</button>
          </div>
        </div>
      </div>`;

    root.querySelectorAll(".readiness-scale").forEach(scale => {
      scale.querySelectorAll("button").forEach(btn => {
        btn.addEventListener("click", () => {
          scale.querySelectorAll("button").forEach(b => b.classList.remove("on"));
          btn.classList.add("on");
          answers[scale.dataset.q] = Number(btn.dataset.v);
          const complete = Coach.READINESS_QUESTIONS.every(q => answers[q.id]);
          document.getElementById("beginBtn").disabled = !complete;
          if (complete) {
            const r = Coach.scoreReadiness(answers);
            document.getElementById("readinessVerdict").innerHTML =
              `<b style="color:var(--accent)">Readiness ${r.score}/100.</b> ${UI.esc(r.note)}`;
          }
        });
      });
    });

    document.getElementById("beginBtn").addEventListener("click", () => begin(dayKey, Coach.scoreReadiness(answers)));
    document.getElementById("skipBtn").addEventListener("click", () => begin(dayKey, null));
  }

  function begin(dayKey, readiness) {
    const p = Store.getActiveProfile();
    const session = Store.startSession(p.id, dayKey, readiness);
    if (!session) { UI.toast("Could not start that session.", "error"); return renderPicker(); }
    renderPlayer();
  }

  /* =====================================================================
     State 3 — the player
     ===================================================================== */

  function renderPlayer() {
    const p = Store.getActiveProfile();
    const session = p.activeSession;
    if (!session) return renderPicker();

    const loggedFor = exId => session.sets.filter(s => s.exerciseId === exId && s.done);
    const totalSets = session.blocks.reduce((n, b) => n + b.sets, 0);
    const doneSets = session.sets.filter(s => s.done).length;
    const pct = totalSets ? Math.round((doneSets / totalSets) * 100) : 0;
    const activeBlockIdx = session.blocks.findIndex(b => loggedFor(b.exerciseId).length < b.sets);

    root.innerHTML = `
      <div class="section-head" style="margin-bottom:18px;">
        <div class="kicker">${UI.esc(session.phaseLabel)}${session.readiness ? ` · readiness ${session.readiness.score}/100` : ""}</div>
        <h2>${UI.esc(session.name)}</h2>
      </div>
      <div class="rest-bar hidden" id="restBar">
        <div class="t" id="restTime">0:00</div>
        <div class="lbl"><b id="restLabel">Rest</b><span id="restNext"></span></div>
        <button class="btn btn-ghost btn-sm" id="restSkip">Skip rest</button>
        <button class="btn btn-ghost btn-sm" id="restPlus">+30s</button>
        <i class="bar" id="restProgress"></i>
      </div>

      <div class="workout-shell">
        <div>
          ${session.readiness && session.readiness.score < 70 ? `
            <div class="coach-card sev-warn" style="margin-bottom:16px;">
              <h3>Today's session has been scaled back</h3>
              <p>${UI.esc(session.readiness.note)} The loads below already include that adjustment — they are not the numbers from your plan, and that is deliberate.</p>
            </div>` : ""}
          <div id="blocks"></div>
          <div class="inline-actions" style="margin-top:24px;">
            <button class="btn btn-primary" id="finishBtn">Finish &amp; save session</button>
            <button class="btn btn-danger" id="abandonBtn">Discard session</button>
          </div>
        </div>

        <aside class="wo-side">
          <div class="card">
            <h4>Session progress</h4>
            <div class="wo-progress-ring">
              <div class="num">${pct}<span>%</span></div>
              <div style="flex:1;">
                <div class="bar" style="height:8px;background:var(--border);border-radius:99px;overflow:hidden;">
                  <i style="display:block;height:100%;width:${pct}%;background:var(--accent);"></i></div>
                <div class="hint" style="margin:8px 0 0;">${doneSets} of ${totalSets} sets logged</div>
              </div>
            </div>
          </div>
          <div class="card">
            <h4>Volume so far</h4>
            <div class="num" style="font-size:1.6rem;font-weight:800;">${UI.fmt.tonnage(Progression.sessionTonnage(session))}</div>
            <div class="hint" style="margin:4px 0 0;">Total load moved — sets x reps x weight.</div>
          </div>
          ${session.cardio ? `
          <div class="card">
            <h4>Cardio finisher</h4>
            <p style="font-size:.9rem;margin:0 0 10px;"><b style="color:var(--text)">${UI.esc(session.cardio.name)}</b><br>
              ${session.cardio.minutes} min — ${UI.esc(session.cardio.intensity)}</p>
            <label class="toggle ${session.cardio.done ? "on" : ""}">
              <input type="checkbox" id="cardioDone" ${session.cardio.done ? "checked" : ""}> Completed
            </label>
          </div>` : ""}
          <div class="card">
            <h4>Session notes</h4>
            <textarea id="sessionNotes" class="search-input" style="width:100%;min-height:88px;border-radius:8px;resize:vertical;"
              placeholder="Anything worth remembering — a machine that was taken, a niggle, how it felt.">${UI.esc(session.notes || "")}</textarea>
          </div>
        </aside>
      </div>`;

    renderBlocks(session, activeBlockIdx);
    wirePlayer(session);
  }

  function renderBlocks(session, activeIdx) {
    const host = document.getElementById("blocks");
    host.innerHTML = session.blocks.map((b, bi) => {
      const ex = exerciseById(b.exerciseId);
      const logged = session.sets.filter(s => s.exerciseId === b.exerciseId && s.done);
      const complete = logged.length >= b.sets;
      const isActive = bi === activeIdx;
      const cue = isActive ? Coach.setCue(b, logged.length, session.sets) : null;

      const rows = Array.from({ length: b.sets }, (_, si) => {
        const rec = session.sets.find(s => s.exerciseId === b.exerciseId && s.setIndex === si);
        const isDone = rec && rec.done;
        const prevReps = logged.length ? logged[logged.length - 1].reps : "";
        return `
          <div class="set-row ${isDone ? "logged" : ""}" data-ex="${b.exerciseId}" data-set="${si}">
            <div class="set-no">${si + 1}</div>
            <div class="f"><label>${ex.loadType === "bodyweight" ? "Added kg" : ex.loadSpec.unit === "sec" ? "Seconds" : "Weight kg"}</label>
              <input type="number" step="0.5" min="0" class="in-weight" value="${isDone ? rec.weight : b.weight}" ${isDone ? "disabled" : ""}></div>
            <div class="f"><label>${ex.loadType === "timed" ? "Held sec" : "Reps"}</label>
              <input type="number" step="1" min="0" class="in-reps" value="${isDone ? rec.reps : (prevReps || "")}"
                placeholder="${b.repLo}–${b.repHi}" ${isDone ? "disabled" : ""}></div>
            <div class="f"><label>RPE</label>
              <select class="in-rpe" ${isDone ? "disabled" : ""}>
                <option value="">—</option>
                ${[6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10].map(v =>
                  `<option value="${v}" ${isDone && Number(rec.rpe) === v ? "selected" : ""}>${v}</option>`).join("")}
              </select></div>
            <button class="log-btn ${isDone ? "undo" : ""}">${isDone ? "Undo" : "Log set"}</button>
          </div>`;
      }).join("");

      return `
        <div class="wo-card ${complete ? "done" : ""} ${isActive ? "active" : ""}" data-hover-media>
          <div class="wo-head">
            ${UI.exerciseThumb(b.exerciseId, "lg")}
            <div class="meta">
              <h3>${UI.esc(ex.name)}</h3>
              <div class="sub">${UI.esc(PATTERNS[ex.pattern] || "")} · ${UI.esc(ex.loadSpec.label)} · rest ${b.restSec}s
                ${complete ? " · complete" : ""}</div>
            </div>
            <div class="wo-target">
              <b>${UI.esc(UI.fmt.load(b.weight, ex))}</b>
              <span>${b.sets} x ${b.repLo}–${b.repHi} @ RPE ≤ ${b.rpeCap}</span>
            </div>
          </div>
          ${cue ? `<div class="wo-cue">${UI.esc(cue)}</div>` : ""}
          ${b.warmups && b.warmups.length && !logged.length ? `
            <div class="wo-warmup"><b>Warm-up ramp:</b> ${b.warmups.map(w => `${w.weight} kg x ${w.reps}`).join("  →  ")}  →  working sets</div>` : ""}
          <details class="wo-why">
            <summary>Why this weight?</summary>
            <div class="body">${UI.esc(b.reason)}
              ${b.readinessAdjusted ? `<p style="margin:10px 0 0;color:var(--warn)">Adjusted for today's readiness: ${b.readinessAdjusted.from} kg → ${b.readinessAdjusted.to} kg.</p>` : ""}
              ${b.evidence ? `<div class="ev">
                <span>Last session <b>${UI.fmt.relDate(b.evidence.date)}</b></span>
                <span>Reps <b>${b.evidence.reps.join(" / ")}</b></span>
                ${b.evidence.avgRpe ? `<span>Avg RPE <b>${b.evidence.avgRpe}</b></span>` : ""}
                <span>Est. 1RM <b>${b.evidence.e1rm} kg</b></span>
              </div>` : ""}
            </div>
          </details>
          ${rows}
        </div>`;
    }).join("");
    UI.wireThumbHover(host);
  }

  function wirePlayer(session) {
    const p = Store.getActiveProfile();

    document.querySelectorAll(".set-row").forEach(row => {
      const btn = row.querySelector(".log-btn");
      btn.addEventListener("click", () => {
        const exId = row.dataset.ex;
        const setIndex = Number(row.dataset.set);
        const current = Store.getActiveProfile().activeSession;
        const existingIdx = current.sets.findIndex(s => s.exerciseId === exId && s.setIndex === setIndex);

        if (existingIdx !== -1 && current.sets[existingIdx].done) {
          current.sets.splice(existingIdx, 1);                 // undo
          Store.saveActiveSession(p.id, current);
          stopRest();
          return renderPlayer();
        }

        const weight = Number(row.querySelector(".in-weight").value);
        const reps = Number(row.querySelector(".in-reps").value);
        const rpeRaw = row.querySelector(".in-rpe").value;
        if (!reps || reps <= 0) { UI.toast("Enter the reps you actually got before logging the set.", "warn"); return; }

        const entry = { exerciseId: exId, setIndex, weight, reps, rpe: rpeRaw === "" ? null : Number(rpeRaw), done: true, at: Date.now() };
        if (existingIdx !== -1) current.sets[existingIdx] = entry; else current.sets.push(entry);
        Store.saveActiveSession(p.id, current);

        const block = current.blocks.find(b => b.exerciseId === exId);
        const remaining = block.sets - current.sets.filter(s => s.exerciseId === exId && s.done).length;
        renderPlayer();
        if (remaining > 0) startRest(block.restSec, `${exerciseById(exId).name} — set ${setIndex + 2} of ${block.sets}`);
        else startRest(Math.round(block.restSec * 0.8), "Next exercise");
      });
    });

    const notes = document.getElementById("sessionNotes");
    if (notes) notes.addEventListener("change", () => {
      const current = Store.getActiveProfile().activeSession;
      current.notes = notes.value;
      Store.saveActiveSession(p.id, current);
    });

    const cardio = document.getElementById("cardioDone");
    if (cardio) cardio.addEventListener("change", () => {
      const current = Store.getActiveProfile().activeSession;
      current.cardio.done = cardio.checked;
      Store.saveActiveSession(p.id, current);
      cardio.closest(".toggle").classList.toggle("on", cardio.checked);
    });

    document.getElementById("finishBtn").addEventListener("click", finish);
    document.getElementById("abandonBtn").addEventListener("click", () => {
      if (!confirm("Discard this session? Every set you logged in it will be lost.")) return;
      stopRest();
      Store.discardActiveSession(p.id);
      renderPicker();
    });

    const restBar = document.getElementById("restBar");
    restBar.querySelector("#restSkip").addEventListener("click", stopRest);
    restBar.querySelector("#restPlus").addEventListener("click", () => { restEnds += 30000; restTotal += 30; });
  }

  /* ---------------- Rest timer ---------------- */

  function startRest(seconds, nextLabel) {
    stopRest();
    restTotal = seconds;
    restEnds = Date.now() + seconds * 1000;
    const bar = document.getElementById("restBar");
    if (!bar) return;
    bar.classList.remove("hidden");
    document.getElementById("restNext").textContent = nextLabel || "";
    tickRest();
    restTimer = setInterval(tickRest, 250);
  }

  function tickRest() {
    const left = (restEnds - Date.now()) / 1000;
    const timeEl = document.getElementById("restTime");
    if (!timeEl) return stopRest();
    if (left <= 0) {
      timeEl.textContent = "0:00";
      document.getElementById("restLabel").textContent = "Rest complete — go";
      document.getElementById("restProgress").style.width = "100%";
      UI.beep(2);
      clearInterval(restTimer); restTimer = null;
      setTimeout(() => { const b = document.getElementById("restBar"); if (b) b.classList.add("hidden"); }, 4000);
      return;
    }
    timeEl.textContent = UI.fmt.clock(left);
    document.getElementById("restLabel").textContent = "Resting";
    document.getElementById("restProgress").style.width = `${Math.min(100, ((restTotal - left) / restTotal) * 100)}%`;
  }

  function stopRest() {
    if (restTimer) { clearInterval(restTimer); restTimer = null; }
    const bar = document.getElementById("restBar");
    if (bar) bar.classList.add("hidden");
  }

  /* ---------------- Finish ---------------- */

  function finish() {
    const p = Store.getActiveProfile();
    const session = p.activeSession;
    const logged = session.sets.filter(s => s.done);
    if (!logged.length) { UI.toast("Log at least one set before saving the session.", "warn"); return; }

    const notes = document.getElementById("sessionNotes");
    if (notes) session.notes = notes.value;

    const debrief = Coach.sessionDebrief(p, session);
    stopRest();
    Store.completeSession(p.id, session);
    const after = Store.getActiveProfile();

    // What changed for next time, computed from the session just saved.
    const phase = Periodization.phaseFor(after);
    const changes = [...new Set(logged.map(s => s.exerciseId))].map(exId => {
      const ex = exerciseById(exId);
      const rx = after.prescriptions[exId];
      if (!rx) return null;
      return { ex, rx };
    }).filter(Boolean);

    UI.modal(`
      <div class="modal-head"><div>
        <span class="pill good">Session saved</span>
        <h3 style="margin-top:10px;">${UI.esc(debrief.headline)}</h3>
        <div class="hint">${debrief.setsLogged} sets · ${UI.fmt.tonnage(debrief.tonnage)} moved${session.durationMin ? ` · ${session.durationMin} min` : ""}</div>
      </div></div>
      <div class="modal-body">
        ${debrief.lines.length ? `<h4>What stood out</h4><ul class="tips">${debrief.lines.map(l =>
          `<li style="color:${l.kind === "warn" ? "var(--warn)" : l.kind === "pr" ? "var(--good)" : "var(--text-dim)"}">${UI.esc(l.text)}</li>`).join("")}</ul>` : ""}
        <h4>Next session's loads</h4>
        <table class="rx-table">
          ${changes.map(c => `<tr>
            <td class="rx-name">${UI.esc(c.ex.name)}</td>
            <td class="rx-load">${UI.esc(UI.fmt.load(c.rx.weight, c.ex))}
              ${c.rx.delta ? `<span class="delta ${c.rx.delta > 0 ? "up" : "down"}">${UI.fmt.signed(c.rx.delta, " kg")}</span>` : ""}</td>
            <td style="text-align:right;">${UI.actionBadge(c.rx.action)}</td>
          </tr>`).join("")}
        </table>
        <div class="source-note">These are already saved. The Coach tab shows the full reasoning behind each one.</div>
        <div class="form-actions">
          <a href="coach.html" class="btn btn-primary">See the coach's reasoning</a>
          <a href="program.html" class="btn btn-ghost">Back to the program</a>
        </div>
      </div>`, { wide: true });

    renderPicker();
  }

  /* ---------------- Boot ---------------- */

  const existing = Store.getActiveSession(profile.id);
  if (existing) renderPlayer();
  else if (params.get("day")) renderReadiness(params.get("day"));
  else renderPicker();
});
