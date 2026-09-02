/* ============================================================================
   GymBuddy 2.0 — i18n.js
   ----------------------------------------------------------------------------
   Bilingual support: English and Arabic, with full right-to-left layout.

   The hard part of translating this app is not the buttons — it is the
   coaching engine, which writes sentences like "You hit the top of the range
   on every set — 12/12/12 at 40 kg" out of live numbers. Baking those as
   English strings would make them untranslatable, so the engines emit
   **message objects** instead:

       { k: "prog.increase", p: { reps: "12/12/12", weight: "40 kg" } }

   Rendering happens at display time. That means a reason stored months ago
   still renders in whichever language you are reading today, and switching
   language re-renders your entire training history rather than leaving a
   trail of English in an Arabic interface.

   Bidirectional text is handled explicitly. Arabic sentences here are full of
   Latin-script numbers and units ("45 kg", "RPE 8.5", "12/12/12"), and without
   isolation the bidi algorithm reorders them into nonsense at the sentence
   boundary. Every interpolated value carrying digits or Latin letters is
   wrapped in a First Strong Isolate, which is what those characters are for.
   ============================================================================ */

const I18n = (function () {

  const STORAGE_KEY = "gymbuddy_lang";
  const DEFAULT_LANG = "en";

  const LANGUAGES = {
    en: { id: "en", name: "English",  nativeName: "English",  dir: "ltr", locale: "en-GB" },
    ar: { id: "ar", name: "Arabic",   nativeName: "العربية",  dir: "rtl", locale: "ar" },
  };

  const dictionaries = { en: {}, ar: {} };
  let current = DEFAULT_LANG;
  const listeners = [];

  /* ---------------------------------------------------------------------
     Registration
     --------------------------------------------------------------------- */

  /** Flatten a nested dictionary into dotted keys, so files stay readable. */
  function flatten(obj, prefix, out) {
    const target = out || {};
    Object.entries(obj).forEach(([key, value]) => {
      const full = prefix ? `${prefix}.${key}` : key;
      // A plural form is an object of category → string; it is a leaf, not a branch.
      if (value && typeof value === "object" && !Array.isArray(value) && !isPluralForm(value)) {
        flatten(value, full, target);
      } else {
        target[full] = value;
      }
    });
    return target;
  }

  const PLURAL_KEYS = ["zero", "one", "two", "few", "many", "other"];
  function isPluralForm(value) {
    const keys = Object.keys(value);
    return keys.length > 0 && keys.every(k => PLURAL_KEYS.includes(k));
  }

  function register(lang, obj) {
    if (!dictionaries[lang]) dictionaries[lang] = {};
    Object.assign(dictionaries[lang], flatten(obj));
  }

  /* ---------------------------------------------------------------------
     Lookup and rendering
     --------------------------------------------------------------------- */

  function raw(lang, key) {
    const dict = dictionaries[lang];
    return dict ? dict[key] : undefined;
  }

  /**
   * Translate a key.
   * Falls back to English, then to the key itself — a missing string shows up
   * as `coach.plateau.title` in the interface rather than as blank space, so
   * it gets noticed and fixed instead of silently shipping.
   */
  function t(key, params) {
    if (key == null) return "";
    let value = raw(current, key);
    if (value === undefined) value = raw("en", key);
    if (value === undefined) return key;
    if (value && typeof value === "object") value = selectPlural(value, params);
    return interpolate(value, params);
  }

  /** Is a string actually defined for this key (in any language)? */
  function has(key) {
    return raw(current, key) !== undefined || raw("en", key) !== undefined;
  }

  /**
   * Arabic has six plural categories against English's two, and the split is
   * not a matter of taste: "سِتّ حصص" and "١٥ حصة" take different noun forms.
   * Intl.PluralRules knows the rules for both languages, so the dictionaries
   * just supply the categories they need.
   */
  function selectPlural(forms, params) {
    const count = params && (params.count != null ? params.count : params.n);
    if (count == null) return forms.other || forms.one || Object.values(forms)[0];
    let category = "other";
    try {
      category = new Intl.PluralRules(LANGUAGES[current].locale).select(Number(count));
    } catch (e) { category = Number(count) === 1 ? "one" : "other"; }
    return forms[category] !== undefined ? forms[category]
         : forms.other !== undefined ? forms.other
         : Object.values(forms)[0];
  }

  const FSI = "⁨";   // First Strong Isolate
  const PDI = "⁩";   // Pop Directional Isolate
  const NEEDS_ISOLATE = /[0-9A-Za-z]/;

  function interpolate(template, params) {
    if (typeof template !== "string" || !params) return String(template == null ? "" : template);
    return template.replace(/\{(\w+)\}/g, (match, name) => {
      if (!(name in params)) return match;
      let value = params[name];
      let isProse = false;
      // A parameter can itself be a message object, so composed sentences
      // ("Leg Press replaces Hack Squat because …") stay translatable.
      if (value && typeof value === "object" && value.k) { value = tx(value); isProse = true; }
      // …or a deferred reference, resolved against the language in force now
      // rather than the one in force when the message was built.
      else if (value && typeof value === "object" && value.$) { value = resolveRef(value); isProse = true; }
      else if (typeof value === "number") value = num(value);
      value = String(value == null ? "" : value);

      /* Isolation applies to RAW values only — a bare number, a rep string
         like "12/12/12", a Latin identifier. Text that is already prose in the
         current language must NOT be isolated: an Arabic phrase that happens to
         begin with a formatted number carries a left-to-right mark, which would
         make the isolate resolve left-to-right and lay the whole Arabic phrase
         out backwards. */
      if (!isProse && LANGUAGES[current].dir === "rtl" && NEEDS_ISOLATE.test(value)
          && !(value.startsWith(FSI) && value.endsWith(PDI))) {
        return FSI + value + PDI;
      }
      return value;
    });
  }

  /**
   * Render whatever a field holds: a message object from the engine, a plain
   * string from an older stored session, or nothing.
   */
  function tx(message) {
    if (message == null) return "";
    if (typeof message === "string") return message;
    if (Array.isArray(message)) return message.map(tx).join(" ");
    if (message.k) return t(message.k, message.p);
    return String(message);
  }

  /** Build a message object. The engines call this instead of writing prose. */
  function m(key, params) {
    return params ? { k: key, p: params } : { k: key };
  }

  /* ---------------------------------------------------------------------
     Lazy references
     ---------------------------------------------------------------------
     A message like "Leg Extension replaces Leg Press" is built once, when the
     plan is generated, and then stored. If the exercise name were baked in at
     that moment, switching language would leave English names embedded inside
     Arabic sentences forever.

     So names are stored as references — `ref("ex", "leg-press")` — and
     resolved at render time. The resolvers themselves live in data.js, which
     is what knows how to turn an id into a name; this module only knows that
     something has to be looked up. */

  const resolvers = {};

  /** Register how to resolve one kind of reference. */
  function resolver(kind, fn) { resolvers[kind] = fn; }

  /** A deferred lookup: `ref("ex", id)`, `ref("load", weight, exerciseId)`. */
  function ref(kind, value, extra) { return { $: kind, v: value, x: extra }; }

  /** A list of references, joined with the language's own list separator. */
  function refList(kind, values) { return { $: "__list", v: values, x: kind }; }

  resolver("__list", (values, kind) => {
    const sep = LANGUAGES[current].dir === "rtl" ? "، " : ", ";
    return (values || []).map(v => resolveRef({ $: kind, v })).join(sep);
  });

  function resolveRef(value) {
    const fn = resolvers[value.$];
    if (!fn) return String(value.v);
    try { return String(fn(value.v, value.x)); } catch (e) { return String(value.v); }
  }

  /* ---------------------------------------------------------------------
     Formatting
     --------------------------------------------------------------------- */

  /**
   * Western digits in both languages. Arabic-Indic numerals are correct for
   * literary Arabic, but every gym in the region prints Western digits on the
   * plates and the machine stacks, and a training app that disagrees with the
   * equipment in the room is not being helpful.
   */
  function num(value, options) {
    if (value == null || isNaN(value)) return String(value == null ? "" : value);
    try {
      return new Intl.NumberFormat(LANGUAGES[current].locale + "-u-nu-latn", options).format(value);
    } catch (e) { return String(value); }
  }

  function date(iso, options) {
    const d = new Date(iso);
    if (isNaN(d)) return String(iso);
    try {
      return d.toLocaleDateString(LANGUAGES[current].locale + "-u-nu-latn",
        options || { day: "numeric", month: "short" });
    } catch (e) { return d.toISOString().slice(0, 10); }
  }

  /* ---------------------------------------------------------------------
     Language state
     --------------------------------------------------------------------- */

  function lang() { return current; }
  function dir() { return LANGUAGES[current].dir; }
  function isRTL() { return dir() === "rtl"; }
  function locale() { return LANGUAGES[current].locale; }
  function languages() { return Object.values(LANGUAGES); }

  function setLang(next, options) {
    if (!LANGUAGES[next] || next === current) return current;
    current = next;
    try { localStorage.setItem(STORAGE_KEY, next); } catch (e) { /* private mode */ }
    applyDocument();
    if (!options || options.notify !== false) listeners.forEach(fn => { try { fn(next); } catch (e) {} });
    return current;
  }

  function onChange(fn) { listeners.push(fn); }

  /** Stamp lang/dir on <html> so CSS logical properties and the browser agree. */
  function applyDocument() {
    if (typeof document === "undefined") return;
    const el = document.documentElement;
    el.setAttribute("lang", current);
    el.setAttribute("dir", dir());
    el.classList.toggle("rtl", isRTL());
  }

  /**
   * Choose a starting language: an explicit saved choice wins, then the
   * browser's own preference, then English.
   */
  function detect() {
    let stored = null;
    try { stored = localStorage.getItem(STORAGE_KEY); } catch (e) { /* private mode */ }
    if (stored && LANGUAGES[stored]) { current = stored; applyDocument(); return current; }
    const nav = (typeof navigator !== "undefined" && (navigator.languages || [navigator.language])) || [];
    const match = nav.map(l => String(l || "").slice(0, 2).toLowerCase()).find(l => LANGUAGES[l]);
    current = match || DEFAULT_LANG;
    applyDocument();
    return current;
  }

  /**
   * Array-valued entries (an exercise's steps and tips) with the same fallback
   * chain as `t`. Kept separate because `t` interpolates and joins, and a list
   * of form cues must stay a list.
   */
  function list(key) {
    let value = raw(current, key);
    if (value === undefined) value = raw("en", key);
    if (Array.isArray(value)) return value;
    return value == null ? [] : [String(value)];
  }

  /** Every key registered for a language — used by the translation-parity test. */
  function keys(language) { return Object.keys(dictionaries[language] || {}).sort(); }

  return {
    register, t, tx, m, ref, refList, resolver, has, num, date, keys, list,
    lang, setLang, dir, isRTL, locale, languages, onChange, detect, applyDocument,
    LANGUAGES, STORAGE_KEY,
  };
})();
