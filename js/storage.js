/* ============================================================================
   GymBuddy 2.0 — storage.js
   ----------------------------------------------------------------------------
   Local-first persistence. Everything lives in this browser's localStorage on
   this device: no server, no account, no telemetry. That is a deliberate
   trade — your training log never leaves the machine, and the cost is that it
   does not sync between devices. The export/import pair below exists so you
   can move it yourself.

   Schema v2 adds everything the coaching engine needs on top of v1's profile:
   settings (days, equipment, time budget), the generated plan, per-exercise
   prescriptions with stall counters, a full set-by-set session log, readiness
   check-ins and the coach's message feed. v1 profiles are migrated on first
   load — nothing you already logged is lost.
   ============================================================================ */

const DB_KEY = "gymbuddy_profiles_v2";
const ACTIVE_KEY = "gymbuddy_active_profile_v2";
const LEGACY_DB_KEY = "gymbuddy_profiles_v1";
const LEGACY_ACTIVE_KEY = "gymbuddy_active_profile_v1";

function loadDB() {
  try {
    const raw = localStorage.getItem(DB_KEY);
    if (raw) return JSON.parse(raw);
    const migrated = migrateFromV1();
    if (migrated) return migrated;
    return {};
  } catch (e) {
    console.warn("GymBuddy: could not read local storage —", e);
    return {};
  }
}

function saveDB(db) {
  try {
    localStorage.setItem(DB_KEY, JSON.stringify(db));
  } catch (e) {
    // Quota is the realistic failure here (a very long session log).
    console.error("GymBuddy: could not save to local storage —", e);
    if (typeof window !== "undefined" && window.GymBuddyUI) {
      window.GymBuddyUI.toast(I18n.t("errors.storageFull"), "error");
    }
  }
}

/** Bring a v1 profile forward rather than starting the user from scratch. */
function migrateFromV1() {
  try {
    const raw = localStorage.getItem(LEGACY_DB_KEY);
    if (!raw) return null;
    const old = JSON.parse(raw);
    const db = {};
    Object.values(old).forEach(p => { db[p.id] = upgradeProfile(p); });
    localStorage.setItem(DB_KEY, JSON.stringify(db));
    const activeId = localStorage.getItem(LEGACY_ACTIVE_KEY);
    if (activeId && db[activeId]) localStorage.setItem(ACTIVE_KEY, activeId);
    return db;
  } catch (e) {
    return null;
  }
}

function defaultSettings() {
  return {
    trainingDays: ["mon", "tue", "thu", "fri"],   // the original 4-day plan's shape
    sessionMinutes: 75,
    equipment: { machine: true, cable: true, dumbbell: true, barbell: true, bodyweight: true },
    cardioPreference: "rotate",
    cardioOnRestDays: true,
    splitOverride: null,
    autoRegulate: true,
    increments: {},          // per-load-type overrides, e.g. { machine_stack: 2.5 }
    unit: "kg",
  };
}

/** Fill in every v2 field a profile might be missing, old or new. */
function upgradeProfile(p) {
  return {
    id: p.id,
    name: p.name || "Athlete",
    email: p.email || "",
    sex: p.sex || "Prefer not to say",
    age: Number(p.age) || 30,
    heightCm: Number(p.heightCm) || 175,
    weightKg: Number(p.weightKg) || 80,
    goal: p.goal || "Fat loss",
    level: p.level || "Some experience",
    createdAt: p.createdAt || Date.now(),
    schemaVersion: 2,
    settings: { ...defaultSettings(), ...(p.settings || {}) },
    meso: p.meso || Periodization.newCycle(),
    plan: p.plan || null,
    prescriptions: p.prescriptions || {},
    sessionLog: p.sessionLog || [],
    activeSession: p.activeSession || null,
    weightLog: p.weightLog && p.weightLog.length
      ? p.weightLog
      : [{ date: new Date().toISOString().slice(0, 10), weightKg: Number(p.weightKg) || 80 }],
    readinessLog: p.readinessLog || [],
    flags: p.flags || { pain: {}, excluded: [] },
    coachFeed: p.coachFeed || [],
    dismissed: p.dismissed || [],
    progress: p.progress || {},     // v1 checkbox state, kept so nothing is lost
  };
}

function uid(prefix) {
  return (prefix || "p_") + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

const Store = {

  /* ---------------- Profiles ---------------- */

  listProfiles() {
    return Object.values(loadDB()).sort((a, b) => a.createdAt - b.createdAt);
  },

  getProfile(id) {
    const db = loadDB();
    return db[id] ? upgradeProfile(db[id]) : null;
  },

  createProfile(data) {
    const db = loadDB();
    const id = uid();
    const profile = upgradeProfile({
      id,
      name: data.name,
      email: data.email,
      sex: data.sex,
      age: data.age,
      heightCm: data.heightCm,
      weightKg: data.weightKg,
      goal: data.goal,
      level: data.level,
      createdAt: Date.now(),
      settings: { ...defaultSettings(), ...(data.settings || {}) },
      meso: Periodization.newCycle(),
    });
    db[id] = profile;
    saveDB(db);
    this.setActive(id);
    this.regeneratePlan(id);
    return this.getProfile(id);
  },

  updateProfile(id, patch) {
    const db = loadDB();
    if (!db[id]) return null;
    Object.assign(db[id], patch);
    saveDB(db);
    return this.getProfile(id);
  },

  deleteProfile(id) {
    const db = loadDB();
    delete db[id];
    saveDB(db);
    if (this.getActiveId() === id) this.setActive(Object.keys(db)[0] || null);
  },

  setActive(id) {
    if (id) localStorage.setItem(ACTIVE_KEY, id);
    else localStorage.removeItem(ACTIVE_KEY);
  },

  getActiveId() { return localStorage.getItem(ACTIVE_KEY); },

  getActiveProfile() {
    const id = this.getActiveId();
    const p = id ? this.getProfile(id) : null;
    if (p) return p;
    const first = this.listProfiles()[0];
    if (first) { this.setActive(first.id); return first; }
    return null;
  },

  /* ---------------- Settings & plan ---------------- */

  updateSettings(id, patch) {
    const db = loadDB();
    if (!db[id]) return null;
    db[id].settings = { ...defaultSettings(), ...(db[id].settings || {}), ...patch };
    saveDB(db);
    return this.regeneratePlan(id);
  },

  /**
   * Rebuild the weekly plan from current settings, history and mesocycle week.
   * Called whenever anything that could change the plan changes: the training
   * days, the goal, the equipment list, a pain flag, or a completed session.
   */
  regeneratePlan(id) {
    const profile = this.getProfile(id);
    if (!profile) return null;
    const plan = Scheduler.buildPlan(profile);
    const db = loadDB();
    db[id].plan = plan;
    saveDB(db);
    const updated = this.getProfile(id);
    Coach.refreshFeed(updated);      // regenerate insights against the new plan
    return this.getProfile(id);
  },

  getPlan(id) {
    const p = this.getProfile(id);
    if (!p) return null;
    if (!p.plan || !p.plan.generatedAt) return this.regeneratePlan(id).plan;
    return p.plan;
  },

  /* ---------------- Mesocycle ---------------- */

  startNewCycle(id, weeks) {
    const db = loadDB();
    if (!db[id]) return null;
    db[id].meso = Periodization.newCycle(weeks || (db[id].meso && db[id].meso.weeks));
    saveDB(db);
    return this.regeneratePlan(id);
  },

  /* ---------------- Live sessions ---------------- */

  /**
   * Open a session for a given day. The prescription is snapshotted at start
   * so that mid-session edits and the readiness modifier stay stable even if
   * something else regenerates the plan underneath.
   */
  startSession(id, dayKey, readiness) {
    const profile = this.getProfile(id);
    if (!profile) return null;
    const plan = this.getPlan(id);
    const planned = (plan.sessions || []).find(s => s.dayKey === dayKey);
    if (!planned) return null;

    const phase = Periodization.phaseFor(profile);
    const blocks = planned.blocks.map(b => {
      const ex = exerciseById(b.exerciseId);
      const rx = Progression.recommend({ profile, exercise: ex, phase, readiness });
      return {
        exerciseId: b.exerciseId,
        role: b.role,
        sets: b.sets,
        repLo: rx.repLo, repHi: rx.repHi,
        restSec: rx.restSec,
        weight: rx.weight,
        rpeCap: rx.rpeCap,
        action: rx.action,
        reason: rx.reason,
        warmups: rx.warmups,
        readinessAdjusted: rx.readinessAdjusted || null,
        evidence: rx.evidence,
      };
    });

    const session = {
      id: uid("s_"),
      date: new Date().toISOString().slice(0, 10),
      startedAt: Date.now(),
      dayKey,
      templateId: planned.templateId,
      name: planned.name,
      phaseWeek: phase.week,
      readiness: readiness || null,
      blocks,
      sets: [],                    // filled as the user logs
      cardio: planned.cardio ? { ...planned.cardio, done: false, actualMinutes: null } : null,
      notes: "",
      completed: false,
    };

    const db = loadDB();
    db[id].activeSession = session;
    if (readiness) db[id].readinessLog.push({ date: session.date, ...readiness });
    saveDB(db);
    return session;
  },

  getActiveSession(id) {
    const p = this.getProfile(id);
    return p ? p.activeSession : null;
  },

  saveActiveSession(id, session) {
    const db = loadDB();
    if (!db[id]) return null;
    db[id].activeSession = session;
    saveDB(db);
    return session;
  },

  discardActiveSession(id) {
    const db = loadDB();
    if (!db[id]) return null;
    db[id].activeSession = null;
    saveDB(db);
  },

  /**
   * Close out a session: file it in the log, then re-run the progression
   * engine over every exercise it touched so the NEXT prescription is ready
   * before you have left the gym.
   */
  completeSession(id, session) {
    const db = loadDB();
    if (!db[id]) return null;

    /* Store the record, not the narrative.
       The live session carries each block's coaching reason, warm-up ramp and
       evidence snapshot — all of it re-derivable, and all of it dead weight
       once the session is filed. Keeping it cost about 2 KB per session, which
       is what fills a 5 MB storage quota after a couple of years of training.
       What stays is what the history view and the progression engine read. */
    const finished = {
      ...session,
      blocks: (session.blocks || []).map(b => ({
        exerciseId: b.exerciseId, role: b.role,
        sets: b.sets, repLo: b.repLo, repHi: b.repHi,
        weight: b.weight, rpeCap: b.rpeCap, action: b.action,
      })),
      completed: true,
      finishedAt: Date.now(),
      durationMin: session.startedAt ? Math.round((Date.now() - session.startedAt) / 60000) : null,
      tonnage: Math.round(Progression.sessionTonnage(session)),
    };
    db[id].sessionLog.push(finished);
    db[id].activeSession = null;
    saveDB(db);

    // Recompute forward prescriptions with the new session in history.
    const profile = this.getProfile(id);
    const phase = Periodization.phaseFor(profile);
    const touched = [...new Set(finished.sets.filter(s => s.done).map(s => s.exerciseId))];
    const db2 = loadDB();
    touched.forEach(exId => {
      const ex = exerciseById(exId);
      if (!ex) return;
      const rx = Progression.recommend({ profile, exercise: ex, phase });
      db2[id].prescriptions[exId] = {
        weight: rx.weight, repLo: rx.repLo, repHi: rx.repHi, sets: rx.sets,
        action: rx.action, reason: rx.reason, delta: rx.delta,
        stalls: rx.stalls || 0, confidence: rx.confidence,
        updatedAt: new Date().toISOString(),
      };
    });
    saveDB(db2);

    this.regeneratePlan(id);
    return this.getProfile(id);
  },

  /* ---------------- Logging & flags ---------------- */

  addWeightEntry(id, weightKg) {
    const db = loadDB();
    if (!db[id]) return null;
    const date = new Date().toISOString().slice(0, 10);
    const existing = db[id].weightLog.find(w => w.date === date);
    if (existing) existing.weightKg = Number(weightKg);
    else db[id].weightLog.push({ date, weightKg: Number(weightKg) });
    db[id].weightKg = Number(weightKg);
    db[id].weightLog.sort((a, b) => a.date.localeCompare(b.date));
    saveDB(db);
    return this.getProfile(id);
  },

  /** Flag a joint that hurts on a given lift — the scheduler routes around it. */
  flagPain(id, exerciseId, joint) {
    const db = loadDB();
    if (!db[id]) return null;
    db[id].flags = db[id].flags || { pain: {}, excluded: [] };
    if (joint) db[id].flags.pain[exerciseId] = joint;
    else delete db[id].flags.pain[exerciseId];
    saveDB(db);
    return this.regeneratePlan(id);
  },

  toggleExcluded(id, exerciseId) {
    const db = loadDB();
    if (!db[id]) return null;
    db[id].flags = db[id].flags || { pain: {}, excluded: [] };
    const set = new Set(db[id].flags.excluded || []);
    set.has(exerciseId) ? set.delete(exerciseId) : set.add(exerciseId);
    db[id].flags.excluded = [...set];
    saveDB(db);
    return this.regeneratePlan(id);
  },

  /** Manually override the working weight for one exercise. */
  setPrescription(id, exerciseId, patch) {
    const db = loadDB();
    if (!db[id]) return null;
    db[id].prescriptions[exerciseId] = {
      ...(db[id].prescriptions[exerciseId] || {}),
      ...patch,
      manual: true,
      updatedAt: new Date().toISOString(),
    };
    saveDB(db);
    return this.regeneratePlan(id);
  },

  /* ---------------- Coach feed ---------------- */

  setCoachFeed(id, feed) {
    const db = loadDB();
    if (!db[id]) return null;
    db[id].coachFeed = feed;
    saveDB(db);
  },

  dismissInsight(id, key) {
    const db = loadDB();
    if (!db[id]) return null;
    db[id].dismissed = [...new Set([...(db[id].dismissed || []), key])];
    db[id].coachFeed = (db[id].coachFeed || []).filter(m => m.key !== key);
    saveDB(db);
    return this.getProfile(id);
  },

  /* ---------------- Backup ---------------- */

  exportProfile(id) {
    const p = this.getProfile(id);
    if (!p) return null;
    return JSON.stringify({ app: "GymBuddy", schema: 2, exportedAt: new Date().toISOString(), profile: p }, null, 2);
  },

  importProfile(json) {
    const parsed = JSON.parse(json);
    const incoming = parsed.profile || parsed;
    if (!incoming || !incoming.name) throw new Error(I18n.t("errors.badExport"));
    const db = loadDB();
    const id = uid();
    db[id] = upgradeProfile({ ...incoming, id, createdAt: incoming.createdAt || Date.now() });
    saveDB(db);
    this.setActive(id);
    return this.regeneratePlan(id);
  },

  /* ---------------- Derived stats ---------------- */

  /**
   * Sessions completed vs planned over the last `weeks` weeks — but never over
   * a window longer than the profile has existed. Telling someone who signed
   * up on Tuesday that they have a 6% attendance rate is arithmetic, not
   * information.
   */
  adherence(profile, weeks) {
    const requested = weeks || 4;
    const ageWeeks = (Date.now() - (profile.createdAt || Date.now())) / (7 * 86400000);
    const w = Math.max(1, Math.min(requested, Math.ceil(ageWeeks) || 1));
    const since = new Date(); since.setDate(since.getDate() - w * 7);
    const done = (profile.sessionLog || []).filter(s => new Date(s.date) >= since).length;
    const perWeek = ((profile.settings || {}).trainingDays || []).length || 1;
    const expected = perWeek * w;
    return {
      done, expected, weeks: w,
      pct: expected ? Math.min(100, Math.round((done / expected) * 100)) : 0,
      partial: w < requested,
    };
  },

  /** Consecutive weeks with at least one completed session. */
  streakWeeks(profile) {
    const log = profile.sessionLog || [];
    if (!log.length) return 0;
    const weekKey = d => {
      const x = new Date(d); const day = (x.getDay() + 6) % 7;
      x.setDate(x.getDate() - day); return x.toISOString().slice(0, 10);
    };
    const weeks = new Set(log.map(s => weekKey(s.date)));
    let streak = 0;
    const cursor = new Date();
    for (;;) {
      const key = weekKey(cursor);
      if (weeks.has(key)) { streak++; cursor.setDate(cursor.getDate() - 7); }
      else if (streak === 0 && weeks.size) {
        // Allow the current week to be empty without breaking the streak.
        cursor.setDate(cursor.getDate() - 7);
        if (weeks.has(weekKey(cursor))) continue;
        break;
      } else break;
      if (streak > 260) break;
    }
    return streak;
  },
};
