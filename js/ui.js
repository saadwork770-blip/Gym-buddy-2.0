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
    { href: "index.html",     key: "nav.home" },
    { href: "program.html",   key: "nav.program" },
    { href: "workout.html",   key: "nav.workout" },
    { href: "coach.html",     key: "nav.coach" },
    { href: "diet.html",      key: "nav.diet" },
    { href: "progress.html",  key: "nav.progress" },
    { href: "exercises.html", key: "nav.exercises" },
    { href: "profile.html",   key: "nav.profile" },
  ];

  /* Tab-bar glyphs. Stroked at the same weight as the logo so the bar reads as
     one set rather than as five borrowed icons. Drawn inline because the site
     makes no external requests. */
  const TAB_ICON = {
    home:      '<path d="M3 10.2 12 3l9 7.2V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
    program:   '<rect x="3" y="4.5" width="18" height="16" rx="2.5"/><path d="M3 9.5h18M8 3v3M16 3v3M7.5 14h4M7.5 17h7"/>',
    exercises: '<circle cx="11" cy="11" r="7"/><path d="M16.2 16.2 21 21"/>',
    workout:   '<path d="M3 12h2M19 12h2M6.5 8.5v7M17.5 8.5v7M9.5 6.5v11M14.5 6.5v11M9.5 12h5"/>',
    coach:     '<path d="M12 3a7 7 0 0 1 7 7c0 2.4-1.2 3.9-2.3 5.1-.8.9-1.2 1.6-1.2 2.6v.3H8.5v-.3c0-1-.4-1.7-1.2-2.6C6.2 13.9 5 12.4 5 10a7 7 0 0 1 7-7Z"/><path d="M9.5 21h5"/>',
    diet:      '<path d="M7 3v7a2 2 0 0 0 4 0V3"/><path d="M9 3v18"/><path d="M17 3c-1.6 0-2.5 1.6-2.5 4s.9 4 2.5 4v10"/>',
    profile:   '<circle cx="12" cy="8" r="3.6"/><path d="M4.5 20.5c.6-3.9 3.7-6 7.5-6s6.9 2.1 7.5 6"/>',
  };

  /* Seven destinations now. Exercises and Diet used to be reachable only from
     the home page's pre-profile links, or the desktop nav this same media
     query hides — so once a profile existed, there was no way back into
     either on a phone at all. Progress has the same gap and stays off the
     bar for now; an eight-item row is a menu, not a thumb reach. */
  const TABS = [
    { href: "index.html",     key: "nav.home",      icon: "home" },
    { href: "program.html",   key: "nav.program",   icon: "program" },
    { href: "exercises.html", key: "nav.exercises", icon: "exercises" },
    { href: "workout.html",   key: "nav.workout",   icon: "workout" },
    { href: "diet.html",      key: "nav.diet",      icon: "diet" },
    { href: "coach.html",     key: "nav.coach",     icon: "coach" },
    { href: "profile.html",   key: "nav.profile",   icon: "profile" },
  ];

  const LOGO = `<svg class="mark" viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round">
      <line x1="8" y1="32" x2="56" y2="32"/><rect x="4" y="24" width="8" height="16" rx="2"/>
      <rect x="52" y="24" width="8" height="16" rx="2"/><rect x="14" y="18" width="6" height="28" rx="2"/>
      <rect x="44" y="18" width="6" height="28" rx="2"/></svg>`;

  function mountChrome() {
    const current = location.pathname.split("/").pop() || "index.html";
    const profile = Store.getActiveProfile();
    /* Lets the stylesheet drop the introductory copy for somebody who has
       already been introduced. */
    document.body.classList.toggle("has-profile", !!profile);
    const phase = profile ? Periodization.phaseFor(profile) : null;

    const other = I18n.languages().find(l => l.id !== I18n.lang());

    const nav = document.createElement("nav");
    nav.className = "nav";
    nav.innerHTML = `
      <a href="#main" class="skip-link">${esc(I18n.t("nav.skipToContent"))}</a>
      <div class="wrap">
        <a href="index.html" class="brand">${LOGO}<span>GymBuddy<b class="ver">2.0</b></span></a>
        <button class="nav-toggle" aria-label="${esc(I18n.t("nav.menu"))}" aria-expanded="false"
                aria-controls="navLinks">☰</button>
        <ul class="nav-links" id="navLinks">
          ${NAV.map(n => `<li><a href="${n.href}" class="${n.href === current ? "active" : ""}"
              ${n.href === current ? 'aria-current="page"' : ""}>${esc(I18n.t(n.key))}</a></li>`).join("")}
        </ul>
        <button class="lang-switch" id="langSwitch" lang="${other.id}"
                title="${esc(I18n.t("nav.switchTo", { lang: other.nativeName }))}"
                aria-label="${esc(I18n.t("nav.switchTo", { lang: other.nativeName }))}">${esc(other.nativeName)}</button>
        ${profile ? `<a href="profile.html" class="nav-user">
            <span class="nav-avatar" aria-hidden="true">${esc(profile.name.trim().charAt(0).toUpperCase() || "?")}</span>
            <span class="nav-user-meta"><b>${esc(profile.name)}</b><span>${esc(phase.label)}</span></span>
          </a>` : `<a href="profile.html" class="btn btn-primary btn-sm">${esc(I18n.t("nav.createProfile"))}</a>`}
      </div>`;
    document.body.prepend(nav);

    const toggle = nav.querySelector(".nav-toggle");
    const links = nav.querySelector(".nav-links");
    toggle.addEventListener("click", () => {
      const open = links.classList.toggle("open");
      toggle.setAttribute("aria-expanded", String(open));
    });

    nav.querySelector("#langSwitch").addEventListener("click", () => {
      I18n.setLang(other.id);
      // A full reload is the honest way to re-render every page: the layout
      // direction flips, canvases must be repainted, and half the strings live
      // inside already-rendered markup.
      location.reload();
    });

    /* ---- Bottom tab bar (phones) ----
       A hamburger is a menu you have to open before you can go anywhere, which
       on a page you visit five times a session is five extra taps. The bar is
       CSS-hidden above phone widths, so the desktop nav is untouched. */
    if (!document.querySelector(".tabbar")) {
      const here = current === "" ? "index.html" : current;
      const bar = document.createElement("nav");
      bar.className = "tabbar";
      bar.setAttribute("aria-label", I18n.t("nav.primary"));
      bar.innerHTML = TABS.map(t => {
        const active = t.href === here;
        return `<a href="${t.href}" class="${active ? "active" : ""}"${active ? ' aria-current="page"' : ""}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"
               stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${TAB_ICON[t.icon]}</svg>
          <span>${esc(I18n.t(t.key))}</span></a>`;
      }).join("");
      document.body.appendChild(bar);
    }

    if (!document.querySelector("body > footer")) {
      const footer = document.createElement("footer");
      footer.innerHTML = `<div class="wrap">
        <span>${esc(I18n.t("footer.tagline"))}</span>
        <span>${esc(I18n.t("footer.privacy"))}</span>
      </div>`;
      document.body.appendChild(footer);
    }
    applyStaticStrings();
  }

  /**
   * Translate static markup in place.
   *
   * The page shells carry their own headings and hints, and rebuilding all of
   * that from JavaScript would mean an empty page for anyone whose scripts are
   * slow. Instead the markup carries `data-i18n` attributes and this fills them
   * in — the English in the HTML stays as a readable fallback.
   */
  function applyStaticStrings(root) {
    const scope = root || document;
    scope.querySelectorAll("[data-i18n]").forEach(el => {
      el.textContent = I18n.t(el.getAttribute("data-i18n"));
    });
    // Only for strings that legitimately contain inline markup (<b>, <br>).
    scope.querySelectorAll("[data-i18n-html]").forEach(el => {
      el.innerHTML = I18n.t(el.getAttribute("data-i18n-html"));
    });
    scope.querySelectorAll("[data-i18n-placeholder]").forEach(el => {
      el.setAttribute("placeholder", I18n.t(el.getAttribute("data-i18n-placeholder")));
    });
    scope.querySelectorAll("[data-i18n-aria]").forEach(el => {
      el.setAttribute("aria-label", I18n.t(el.getAttribute("data-i18n-aria")));
    });
    if (!root) {
      const title = document.querySelector("title[data-i18n]");
      if (title) document.title = title.textContent;
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
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          <h2>${esc(I18n.t("gate.title"))}</h2>
          <p>${esc(I18n.t("gate.body", { reason: I18n.t(`gate.${what || "program"}`) }))}</p>
          <a href="profile.html" class="btn btn-primary">${esc(I18n.t("gate.cta"))}</a>
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
    overlay.innerHTML = `<div class="modal ${options.wide ? "wide" : ""}" role="dialog" aria-modal="true">
      <button class="modal-close" aria-label="${esc(I18n.t("common.close"))}">&times;</button>${html}</div>`;
    document.body.appendChild(overlay);
    applyStaticStrings(overlay);
    const previouslyFocused = document.activeElement;

    /* Lock the page behind the dialog. Without this a drag anywhere on the
       overlay scrolls the document underneath it, so on a phone the dialog
       appears to float over a page sliding about on its own. The scroll
       position has to be restored by hand because `position: fixed` on the
       body discards it. */
    const body = document.body;
    const scrollY = window.scrollY;
    const alreadyLocked = body.style.position === "fixed";
    if (!alreadyLocked) {
      body.style.position = "fixed";
      body.style.top = `-${scrollY}px`;
      body.style.width = "100%";
    }

    const close = () => {
      overlay.remove();
      document.removeEventListener("keydown", onKey);
      if (!alreadyLocked) {
        body.style.position = "";
        body.style.top = "";
        body.style.width = "";
        /* The page scrolls smoothly by preference, which would animate this
           restore into a visible lurch. It is a restore, not a journey. */
        const root = document.documentElement;
        const priorBehavior = root.style.scrollBehavior;
        root.style.scrollBehavior = "auto";
        window.scrollTo(0, scrollY);
        root.style.scrollBehavior = priorBehavior;
      }
      if (previouslyFocused && previouslyFocused.focus) previouslyFocused.focus();
    };
    const onKey = e => {
      if (e.key === "Escape") { close(); return; }
      if (e.key !== "Tab") return;
      // Keep Tab inside the dialog — otherwise focus wanders onto the page
      // behind it, which for a screen-reader user means the dialog vanishes.
      const focusable = overlay.querySelectorAll(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])');
      if (!focusable.length) return;
      const first = focusable[0], last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    overlay.querySelector(".modal-close").addEventListener("click", close);
    overlay.addEventListener("click", e => { if (e.target === overlay) close(); });
    document.addEventListener("keydown", onKey);
    const firstField = overlay.querySelector("input, select, textarea, button:not(.modal-close), a[href]");
    (firstField || overlay.querySelector(".modal-close")).focus();
    return { el: overlay, close };
  }

  /* ---------------- Formatting ---------------- */

  const fmt = {
    load(weight, exercise) { return Progression.fmtLoad(weight, exercise); },
    num(n) { return I18n.num(n); },
    kg(n) { return I18n.t("engine.prog.loadKg", { n: I18n.num(Math.round(n * 10) / 10) }); },
    signed(n, unit) {
      const r = Math.round(n * 10) / 10;
      return `${r > 0 ? "+" : ""}${I18n.num(r)}${unit || ""}`;
    },
    /**
     * A signed number with its unit, as HTML, for a table cell.
     * "-1.2 kg" in an Arabic table renders as "kg 1.2-" if it is handed over
     * as one string: the sign is a neutral character, so it drifts to the far
     * end of the RTL run and ends up trailing the digits. Isolating the number
     * keeps the sign attached to it while the unit still sits where Arabic
     * wants it.
     */
    deltaCell(n, unit) {
      const r = Math.round(n * 10) / 10;
      const num = `${r > 0 ? "+" : ""}${I18n.num(r)}`;
      return `<span dir="ltr">${esc(num)}</span>&nbsp;${esc(unit || "")}`;
    },
    date(iso) { return I18n.date(iso); },
    relDate(iso) {
      const days = Math.round((Date.now() - new Date(iso).getTime()) / 86400000);
      if (days <= 0) return I18n.t("time.today");
      if (days === 1) return I18n.t("time.yesterday");
      if (days < 7) return I18n.t("time.daysAgo", { count: days });
      if (days < 14) return I18n.t("time.lastWeek");
      return I18n.t("time.weeksAgo", { count: Math.round(days / 7) });
    },
    clock(sec) {
      const s = Math.max(0, Math.round(sec));
      // Always LTR: a clock read right-to-left is a different time.
      return `${I18n.num(Math.floor(s / 60))}:${String(s % 60).padStart(2, "0")}`;
    },
    tonnage(kg) {
      return kg >= 1000
        ? `${I18n.num(Math.round(kg / 100) / 10)} ${I18n.t("common.tonnes")}`
        : I18n.t("engine.prog.loadKg", { n: I18n.num(Math.round(kg)) });
    },
  };

  /** Render an engine message object (or a plain string) and escape it. */
  function tx(message) { return esc(I18n.tx(message)); }
  /** Translate a key and escape it — the common case in page templates. */
  function t(key, params) { return esc(I18n.t(key, params)); }

  /** Small coloured pill describing what the engine decided. */
  function actionBadge(action) {
    const tone = (Progression.ACTIONS[action] || {}).tone || "neutral";
    return `<span class="pill ${tone}">${t(`action.${action}`)}</span>`;
  }

  /* ---------------- Exercise media ----------------
     Clips are silent WebM. Support is broad but not universal (Safari only
     gained it in 2021, iOS in 2022), so capability is checked once and the
     photograph is used on its own where it is missing — rather than shipping a
     <video> that renders as an empty box. */
  const CAN_PLAY_CLIPS = (() => {
    try {
      const v = document.createElement("video");
      return !!v.canPlayType && v.canPlayType('video/webm; codecs="vp8"') !== "";
    } catch (e) { return false; }
  })();

  function exerciseThumb(exId, cls) {
    const ex = exerciseById(exId);
    if (!ex) return "";
    return `<img class="thumb ${cls || ""}" src="${photoFor(ex.id)}" alt="" loading="lazy" decoding="async"
              width="52" height="40" data-clip="${clipFor(ex.id)}"
              onerror="this.classList.add('broken')">`;
  }

  /**
   * Hovering a thumbnail swaps the still for its clip, which is only fetched on
   * the first hover — the library grid holds sixty-odd of these and loading
   * them all up front would be several megabytes for nothing.
   */
  function wireThumbHover(root) {
    if (!CAN_PLAY_CLIPS) return;
    (root || document).querySelectorAll("img.thumb[data-clip]").forEach(img => {
      const host = img.closest("[data-hover-media]") || img;
      let video = null;
      host.addEventListener("mouseenter", () => {
        if (!video) {
          video = document.createElement("video");
          video.className = img.className;
          video.muted = true; video.loop = true; video.playsInline = true;
          video.setAttribute("aria-hidden", "true");
          video.src = img.dataset.clip;
        }
        img.replaceWith(video);
        video.play().catch(() => {});
      });
      host.addEventListener("mouseleave", () => {
        if (video && video.parentNode) { video.pause(); video.replaceWith(img); }
      });
    });
  }

  /**
   * The full-size demonstration for a detail view: the clip where it can play,
   * the photograph where it cannot. `autoplay muted playsinline` is the
   * combination browsers allow to start on its own; it is silent by design.
   */
  function exerciseClip(exId, alt) {
    const ex = exerciseById(exId);
    if (!ex) return "";
    if (!CAN_PLAY_CLIPS) {
      return `<img class="ex-clip" src="${photoFor(ex.id)}" alt="${esc(alt || "")}" loading="lazy">`;
    }
    return `<video class="ex-clip" autoplay muted loop playsinline preload="metadata"
                   poster="${photoFor(ex.id)}" aria-label="${esc(alt || "")}">
              <source src="${clipFor(ex.id)}" type="video/webm">
              <img src="${photoFor(ex.id)}" alt="${esc(alt || "")}">
            </video>`;
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
  /** Greedy word wrap against a measured width, for canvas text. */
  function wrapText(ctx, text, maxWidth) {
    const words = String(text || "").split(/\s+/).filter(Boolean);
    if (!words.length) return [];
    const lines = [];
    let line = words[0];
    for (let i = 1; i < words.length; i++) {
      const next = `${line} ${words[i]}`;
      if (ctx.measureText(next).width <= maxWidth) line = next;
      else { lines.push(line); line = words[i]; }
    }
    lines.push(line);
    return lines;
  }

  function lineChart(canvas, series, opts) {
    const o = opts || {};
    const { ctx, w, h } = prepCanvas(canvas);
    const padL = 44, padR = 12, padT = 14, padB = 26;
    const accent = o.color || CSSVAR("--accent") || "#1fd1a8";
    const grid = CSSVAR("--border") || "#262b33";
    const dim = CSSVAR("--text-faint") || "#6b7280";

    if (!series || series.length < 2) {
      /* Canvas does not wrap, and an empty-state sentence is long enough to
         run off the side of a narrow chart card and get clipped mid-word. */
      ctx.fillStyle = dim; ctx.font = "13px system-ui, sans-serif"; ctx.textAlign = "center";
      const lines = wrapText(ctx, o.emptyText || I18n.t("progress.notEnough"), w - 24);
      const lead = 17;
      lines.forEach((line, i) => {
        ctx.fillText(line, w / 2, h / 2 - ((lines.length - 1) * lead) / 2 + i * lead);
      });
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
      ctx.fillText(I18n.num(Math.round(v * 10) / 10), padL - 8, gy + 4);
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
        <div class="vol-row" title="${tx(r.message)}">
          <div class="vol-label">${esc(muscleLabel(r.muscle))}</div>
          <div class="vol-track">
            <span class="vol-zone mev" style="left:${pct(r.landmarks.mev)}%; width:${pct(r.landmarks.mav) - pct(r.landmarks.mev)}%"></span>
            <span class="vol-mark" style="left:${pct(r.landmarks.mrv)}%" title="Maximum recoverable volume"></span>
            <i class="vol-fill status-${r.status}" style="width:${pct(r.sets)}%"></i>
          </div>
          <div class="vol-val">${I18n.num(r.sets)}<span>${t("common.sets")}</span></div>
          <div class="vol-status status-${r.status}">${t(`volumeStatus.${r.status}`)}</div>
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
  /* ------------------------------------------------------------------
     Rest timer sound
     ------------------------------------------------------------------
     iOS will not let a page make a noise unless the audio context was
     created or resumed inside a real user gesture, and a rest timer by
     definition fires from a timer rather than from a tap. So the previous
     version — a fresh AudioContext per beep, built when the countdown hit
     zero — was silent on every iPhone, which is exactly the device someone
     props against the rack while they rest.

     One context is created and unlocked on the first touch or click
     anywhere in the app, then reused. Safari also suspends the context when
     the page goes to the background, so it is resumed before each beep.
     ------------------------------------------------------------------ */

  let audioCtx = null;

  function audioContext() {
    if (audioCtx) return audioCtx;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    try { audioCtx = new Ctx(); } catch (e) { return null; }
    return audioCtx;
  }

  /** Called from a real gesture, which is the only moment iOS will allow. */
  function unlockAudio() {
    const ctx = audioContext();
    if (!ctx) return;
    if (ctx.state === "suspended") ctx.resume().catch(() => {});
    if (ctx.state === "running") return;
    /* Some WebKit versions only truly unlock once a buffer has played, so a
       single silent sample is pushed through on the way past. */
    try {
      const src = ctx.createBufferSource();
      src.buffer = ctx.createBuffer(1, 1, 22050);
      src.connect(ctx.destination);
      src.start(0);
    } catch (e) { /* nothing to do; the beep is a nicety */ }
  }

  function beep(times) {
    try {
      const ctx = audioContext();
      if (!ctx) return;
      if (ctx.state === "suspended") ctx.resume().catch(() => {});
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
    esc, t, tx, mountChrome, refreshChrome, applyStaticStrings, requireProfile, toast, modal, fmt, actionBadge,
    exerciseThumb, exerciseClip, canPlayClips: () => CAN_PLAY_CLIPS, unlockAudio, wireThumbHover, lineChart, volumeBars, prepCanvas, beep, ready, hexA,
  };
})();

window.GymBuddyUI = UI;

/* Language has to be resolved before the first paint, otherwise the page
   renders left-to-right and then flips, which looks broken. */
I18n.detect();
UI.ready(UI.mountChrome);

/* Ask the browser not to evict this origin's storage on a routine cleanup.
   Best-effort — Chrome grants it on engagement, Firefox prompts, Safari has
   honoured it since 15.4 — which is why the Profile page still nags about
   exports rather than treating this as a backup. */
UI.ready(() => {
  const active = Store.getActiveId && Store.getActiveId();
  if (active) Store.requestPersistence(active);

  /* The first tap anywhere is the only chance iOS gives us to open an audio
     context, and it has to be taken whether or not the user is on the workout
     page yet — by the time the rest timer needs a sound it is far too late. */
  const arm = () => {
    UI.unlockAudio();
    document.removeEventListener("touchend", arm);
    document.removeEventListener("mousedown", arm);
    document.removeEventListener("keydown", arm);
  };
  document.addEventListener("touchend", arm, { passive: true });
  document.addEventListener("mousedown", arm);
  document.addEventListener("keydown", arm);
});
