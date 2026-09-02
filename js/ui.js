/* ============================================================================
   GymBuddy 2.0 — ui.js
   ----------------------------------------------------------------------------
   Shared front-end plumbing: page chrome, formatting, toasts, modals and the
   small hand-rolled chart set. No framework and no build step — the whole app
   is still a folder of files you can open with a double click.
   ============================================================================ */

const UI = (function () {

  /* ---------------- Escaping ----------------
     Profile names and session notes are user input and every page renders them
     through template strings, so everything user-supplied goes through here. */
  function esc(str) {
    return String(str == null ? "" : str)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  /* ---------------- Page chrome ---------------- */

  const NAV = [
    { href: "index.html",     label: "Home" },
    { href: "program.html",   label: "Program" },
    { href: "workout.html",   label: "Workout" },
    { href: "coach.html",     label: "Coach" },
    { href: "progress.html",  label: "Progress" },
    { href: "exercises.html", label: "Exercises" },
    { href: "profile.html",   label: "Profile" },
  ];

  const LOGO = `<svg class="mark" viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round">
      <line x1="8" y1="32" x2="56" y2="32"/><rect x="4" y="24" width="8" height="16" rx="2"/>
      <rect x="52" y="24" width="8" height="16" rx="2"/><rect x="14" y="18" width="6" height="28" rx="2"/>
      <rect x="44" y="18" width="6" height="28" rx="2"/></svg>`;

  function mountChrome() {
    const current = location.pathname.split("/").pop() || "index.html";
    const profile = Store.getActiveProfile();
    const phase = profile ? Periodization.phaseFor(profile) : null;

    const nav = document.createElement("nav");
    nav.className = "nav";
    nav.innerHTML = `
      <div class="wrap">
        <a href="index.html" class="brand">${LOGO}<span>GymBuddy<b class="ver">2.0</b></span></a>
        <button class="nav-toggle" aria-label="Toggle menu" aria-expanded="false">☰</button>
        <ul class="nav-links">
          ${NAV.map(n => `<li><a href="${n.href}" class="${n.href === current ? "active" : ""}">${n.label}</a></li>`).join("")}
        </ul>
        ${profile ? `<a href="profile.html" class="nav-user" title="${esc(profile.name)} — ${esc(phase.label)}">
            <span class="nav-avatar">${esc(profile.name.trim().charAt(0).toUpperCase() || "?")}</span>
            <span class="nav-user-meta"><b>${esc(profile.name)}</b><span>${esc(phase.label)}</span></span>
          </a>` : `<a href="profile.html" class="btn btn-primary btn-sm">Create profile</a>`}
      </div>`;
    document.body.prepend(nav);

    const toggle = nav.querySelector(".nav-toggle");
    const links = nav.querySelector(".nav-links");
    toggle.addEventListener("click", () => {
      const open = links.classList.toggle("open");
      toggle.setAttribute("aria-expanded", String(open));
    });

    if (!document.querySelector("body > footer")) {
      const footer = document.createElement("footer");
      footer.innerHTML = `<div class="wrap">
        <span>GymBuddy 2.0 — adaptive coaching built on your Fitness Time training plan.</span>
        <span>All data stays in this browser. Photos &amp; animations: free-exercise-db (public domain).</span>
      </div>`;
      document.body.appendChild(footer);
    }
  }

  /**
   * Re-draw the nav after something changes who is signed in or what week it
   * is — creating a profile, switching profile, starting a new mesocycle.
   * Without this the header keeps offering "Create profile" to someone who
   * just created one.
   */
  function refreshChrome() {
    const existing = document.querySelector("body > nav.nav");
    if (existing) existing.remove();
    mountChrome();
  }

  /**
   * Pages other than Home and Profile need a profile to say anything useful.
   * Rather than rendering an empty shell, they call this and get a proper
   * explanation of what is missing and a way to fix it.
   */
  function requireProfile(mountId, what) {
    const profile = Store.getActiveProfile();
    if (profile) return profile;
    const el = document.getElementById(mountId);
    if (el) {
      el.innerHTML = `
        <div class="gate">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          <h2>Create a profile first</h2>
          <p>${esc(what || "This page needs to know your bodyweight, goal and training days before it can coach you.")}
             It takes about twenty seconds and nothing leaves your browser.</p>
          <a href="profile.html" class="btn btn-primary">Set up your profile</a>
        </div>`;
    }
    return null;
  }

  /* ---------------- Toast ---------------- */

  let toastTimer = null;
  function toast(message, kind) {
    let host = document.querySelector(".toast-host");
    if (!host) {
      host = document.createElement("div");
      host.className = "toast-host";
      document.body.appendChild(host);
    }
    host.innerHTML = `<div class="toast ${kind || "info"}">${esc(message)}</div>`;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { host.innerHTML = ""; }, kind === "error" ? 6000 : 3400);
  }

  /* ---------------- Modal ---------------- */

  function modal(html, opts) {
    const options = opts || {};
    const overlay = document.createElement("div");
    overlay.className = "modal-overlay open";
    overlay.innerHTML = `<div class="modal ${options.wide ? "wide" : ""}">
      <button class="modal-close" aria-label="Close">&times;</button>${html}</div>`;
    document.body.appendChild(overlay);
    const close = () => { overlay.remove(); document.removeEventListener("keydown", onKey); };
    const onKey = e => { if (e.key === "Escape") close(); };
    overlay.querySelector(".modal-close").addEventListener("click", close);
    overlay.addEventListener("click", e => { if (e.target === overlay) close(); });
    document.addEventListener("keydown", onKey);
    return { el: overlay, close };
  }

  /* ---------------- Formatting ---------------- */

  const fmt = {
    load(weight, exercise) { return Progression.fmtLoad(weight, exercise); },
    kg(n) { return `${Math.round(n * 10) / 10} kg`; },
    signed(n, unit) { const r = Math.round(n * 10) / 10; return `${r > 0 ? "+" : ""}${r}${unit || ""}`; },
    date(iso) {
      const d = new Date(iso);
      return d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
    },
    relDate(iso) {
      const days = Math.round((Date.now() - new Date(iso).getTime()) / 86400000);
      if (days <= 0) return "today";
      if (days === 1) return "yesterday";
      if (days < 7) return `${days} days ago`;
      if (days < 14) return "last week";
      return `${Math.round(days / 7)} weeks ago`;
    },
    clock(sec) {
      const s = Math.max(0, Math.round(sec));
      return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
    },
    tonnage(kg) {
      return kg >= 1000 ? `${(kg / 1000).toFixed(1)} t` : `${Math.round(kg)} kg`;
    },
  };

  /** Small coloured pill describing what the engine decided. */
  function actionBadge(action) {
    const map = {
      increase:    { text: "Load up",    cls: "good" },
      add_reps:    { text: "Add a rep",  cls: "good" },
      hold:        { text: "Repeat",     cls: "neutral" },
      reduce:      { text: "Back off",   cls: "warn" },
      deload:      { text: "Deload",     cls: "warn" },
      stall_break: { text: "Stall break",cls: "warn" },
      calibrate:   { text: "Calibrate",  cls: "info" },
    };
    const m = map[action] || map.hold;
    return `<span class="pill ${m.cls}">${m.text}</span>`;
  }

  function exerciseThumb(exId, cls) {
    const ex = exerciseById(exId);
    if (!ex) return "";
    if (ex.hasMedia === false) {
      return `<span class="thumb diagram ${cls || ""}" style="--accent-cat:${MUSCLE_COLORS[ex.muscle]}">${ICONS[ex.icon] || ""}</span>`;
    }
    return `<img class="thumb ${cls || ""}" src="${photoFor(ex.id)}" alt="" loading="lazy"
              data-photo="${photoFor(ex.id)}" data-gif="${gifFor(ex.id)}"
              onerror="this.classList.add('broken')">`;
  }

  /** Hover any thumbnail to play its GIF; leave to fall back to the still. */
  function wireThumbHover(root) {
    (root || document).querySelectorAll("img.thumb[data-gif]").forEach(img => {
      const parent = img.closest("[data-hover-media]") || img;
      parent.addEventListener("mouseenter", () => { img.src = img.dataset.gif; });
      parent.addEventListener("mouseleave", () => { img.src = img.dataset.photo; });
    });
  }

  /* ---------------- Charts ----------------
     Hand-drawn on canvas: a charting library would be the single biggest
     dependency in the project, and these are four chart types. */

  function prepCanvas(canvas) {
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const w = rect.width || canvas.clientWidth || 600;
    const h = Number(canvas.dataset.height || 200);
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.height = h + "px";
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    return { ctx, w, h };
  }

  const CSSVAR = name => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

  /**
   * Line chart with optional trend line. `series` is [{date, value}].
   */
  function lineChart(canvas, series, opts) {
    const o = opts || {};
    const { ctx, w, h } = prepCanvas(canvas);
    const padL = 44, padR = 12, padT = 14, padB = 26;
    const accent = o.color || CSSVAR("--accent") || "#1fd1a8";
    const grid = CSSVAR("--border") || "#262b33";
    const dim = CSSVAR("--text-faint") || "#6b7280";

    if (!series || series.length < 2) {
      ctx.fillStyle = dim; ctx.font = "13px system-ui, sans-serif"; ctx.textAlign = "center";
      ctx.fillText(o.emptyText || "Not enough data yet — log a couple more sessions.", w / 2, h / 2);
      ctx.textAlign = "left";
      return;
    }

    const values = series.map(p => p.value);
    let min = Math.min(...values), max = Math.max(...values);
    if (min === max) { min -= 1; max += 1; }
    const range = max - min;
    min -= range * 0.12; max += range * 0.12;

    const x = i => padL + (i / (series.length - 1)) * (w - padL - padR);
    const y = v => h - padB - ((v - min) / (max - min)) * (h - padT - padB);

    // Grid + y labels
    ctx.strokeStyle = grid; ctx.lineWidth = 1;
    ctx.fillStyle = dim; ctx.font = "11px system-ui, sans-serif"; ctx.textAlign = "right";
    for (let i = 0; i <= 3; i++) {
      const v = max - (i / 3) * (max - min);
      const gy = Math.round(y(v)) + 0.5;
      ctx.beginPath(); ctx.moveTo(padL, gy); ctx.lineTo(w - padR, gy); ctx.stroke();
      ctx.fillText(`${Math.round(v * 10) / 10}`, padL - 8, gy + 4);
    }

    // Area fill
    const grad = ctx.createLinearGradient(0, padT, 0, h - padB);
    grad.addColorStop(0, hexA(accent, 0.28));
    grad.addColorStop(1, hexA(accent, 0));
    ctx.beginPath();
    series.forEach((p, i) => { const px = x(i), py = y(p.value); i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); });
    ctx.lineTo(x(series.length - 1), h - padB);
    ctx.lineTo(x(0), h - padB);
    ctx.closePath(); ctx.fillStyle = grad; ctx.fill();

    // Line
    ctx.beginPath();
    series.forEach((p, i) => { const px = x(i), py = y(p.value); i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); });
    ctx.strokeStyle = accent; ctx.lineWidth = 2.4; ctx.lineJoin = "round"; ctx.stroke();

    // Trend line
    if (o.trend && series.length >= 3) {
      const n = series.length;
      const mx = (n - 1) / 2;
      const my = values.reduce((a, b) => a + b, 0) / n;
      let num = 0, den = 0;
      values.forEach((v, i) => { num += (i - mx) * (v - my); den += (i - mx) ** 2; });
      const slope = den ? num / den : 0;
      ctx.beginPath();
      ctx.moveTo(x(0), y(my - slope * mx));
      ctx.lineTo(x(n - 1), y(my + slope * (n - 1 - mx)));
      ctx.strokeStyle = hexA(accent, 0.45); ctx.lineWidth = 1.4; ctx.setLineDash([5, 5]);
      ctx.stroke(); ctx.setLineDash([]);
    }

    // Points
    ctx.fillStyle = accent;
    series.forEach((p, i) => { ctx.beginPath(); ctx.arc(x(i), y(p.value), 3, 0, Math.PI * 2); ctx.fill(); });

    // x labels: first, middle, last. The outer two are anchored to their own
    // edge rather than centred, or half the label falls off the canvas and a
    // date like "Aug 30" silently renders as "Aug 3".
    ctx.fillStyle = dim; ctx.font = "11px system-ui, sans-serif";
    const last = series.length - 1;
    const marks = [[0, "left"], [Math.floor(last / 2), "center"], [last, "right"]];
    const drawn = new Set();
    marks.forEach(([i, align]) => {
      if (drawn.has(i)) return;
      drawn.add(i);
      ctx.textAlign = align;
      ctx.fillText(fmt.date(series[i].date), x(i), h - 8);
    });
    ctx.textAlign = "left";
  }

  /** Weekly-volume bars drawn against the MEV/MAV/MRV landmarks. */
  function volumeBars(container, report) {
    container.innerHTML = report.map(r => {
      const scale = Math.max(r.landmarks.mrv * 1.15, r.sets * 1.05, 1);
      const pct = v => Math.min(100, (v / scale) * 100);
      return `
        <div class="vol-row" title="${esc(r.message)}">
          <div class="vol-label">${esc(r.label)}</div>
          <div class="vol-track">
            <span class="vol-zone mev" style="left:${pct(r.landmarks.mev)}%; width:${pct(r.landmarks.mav) - pct(r.landmarks.mev)}%"></span>
            <span class="vol-mark" style="left:${pct(r.landmarks.mrv)}%" title="Maximum recoverable volume"></span>
            <i class="vol-fill status-${r.status}" style="width:${pct(r.sets)}%"></i>
          </div>
          <div class="vol-val">${r.sets}<span>sets</span></div>
          <div class="vol-status status-${r.status}">${r.status}</div>
        </div>`;
    }).join("");
  }

  function hexA(hex, alpha) {
    const h = hex.replace("#", "");
    const full = h.length === 3 ? h.split("").map(c => c + c).join("") : h;
    const n = parseInt(full, 16);
    return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
  }

  /* ---------------- Rest timer sound ----------------
     A short synthesised tone, so there is no audio file to ship and nothing
     to load. Silently does nothing if the browser blocks audio. */
  function beep(times) {
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      const ctx = new Ctx();
      const n = times || 2;
      for (let i = 0; i < n; i++) {
        const osc = ctx.createOscillator(), gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        osc.frequency.value = 880;
        osc.type = "sine";
        const t = ctx.currentTime + i * 0.28;
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(0.18, t + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
        osc.start(t); osc.stop(t + 0.24);
      }
    } catch (e) { /* audio is a nicety, never a requirement */ }
  }

  /* ---------------- Boot ---------------- */

  function ready(fn) {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", fn);
    else fn();
  }

  return {
    esc, mountChrome, refreshChrome, requireProfile, toast, modal, fmt, actionBadge,
    exerciseThumb, wireThumbHover, lineChart, volumeBars, prepCanvas, beep, ready, hexA,
  };
})();

window.GymBuddyUI = UI;
UI.ready(UI.mountChrome);
