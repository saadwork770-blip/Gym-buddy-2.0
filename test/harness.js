/* ============================================================================
   GymBuddy 2.0 — test/harness.js
   ----------------------------------------------------------------------------
   Loads the browser engines into Node with a localStorage shim so the coaching
   logic can be tested without a browser. The app itself has no build step and
   no dependencies; neither does this.

       node test/engine.test.js
   ============================================================================ */

const fs = require("fs");
const vm = require("vm");
const path = require("path");

const ROOT = path.join(__dirname, "..");

/* Load order matters: the engines reference each other at call time, but
   the data layer and templates.js must be evaluated first. */
const FILES = [
  "js/i18n.js",
  "js/i18n/en.js",
  "js/i18n/ar.js",
  "js/i18n/content.ar.js",
  "js/data/library.js",
  "js/data/coaching.js",
  "js/data/labels.js",
  "js/templates.js",
  "js/engine/periodization.js",
  "js/engine/progression.js",
  "js/engine/scheduler.js",
  "js/engine/analysis.js",
  "js/engine/adaptation.js",
  "js/engine/coach.js",
  "js/storage.js",
];

const EXPORTS = [
  "Store", "Scheduler", "Progression", "Periodization", "Coach", "Adaptation",
  "I18n", "Analysis", "exerciseById", "exercisesForDay", "exercisesByPattern", "templateOverlap",
  "exName", "exSteps", "exTips", "muscleLabel", "patternLabel", "loadTypeLabel",
  "dayLabel", "dayShort", "jointLabel", "templateName", "splitName", "splitRationale",
  "EXERCISES", "SPLITS", "SESSION_TEMPLATES", "VOLUME_LANDMARKS", "PATTERNS", "exerciseSkill",
  "MUSCLE_LABELS", "GOAL_PROFILES", "LEVEL_PROFILES", "LOAD_TYPES", "PROGRAM",
  "DAY_KEYS", "DAY_LABELS", "DAY_SHORT",
];

/** A fresh sandbox with empty storage — call once per test file, or per suite
    if you want isolation between cases. */
function load() {
  const store = {};
  const localStorage = {
    getItem: k => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: k => { delete store[k]; },
    clear: () => { Object.keys(store).forEach(k => delete store[k]); },
  };

  const out = {};
  const sandbox = vm.createContext({
    __out: out, localStorage, console, window: undefined,
    Intl, Date, Math, JSON, navigator: { languages: ["en"] },
  });
  const source = FILES.map(f => fs.readFileSync(path.join(ROOT, f), "utf8")).join("\n");
  // `const` at script top level does not land on the context object, so the
  // names are copied across explicitly once everything has evaluated.
  const exportTail = ";(function(){" +
    EXPORTS.map(n => `try{__out.${n}=${n}}catch(e){}`).join(";") + "})();";
  vm.runInContext(source + exportTail, sandbox, { filename: "gymbuddy-bundle.js" });
  out.__storage = store;
  return out;
}

module.exports = { load, FILES };
