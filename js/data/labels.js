/* ============================================================================
   GymBuddy — data/labels.js
   ----------------------------------------------------------------------------
   The bridge between the library and the two languages it is read in.

   Three jobs. It registers the English source text from data/library.js into
   the English dictionary, so there is one copy of every English string and a
   missing Arabic entry shows up as a failed parity test rather than as silent
   English inside an Arabic page. It provides the label functions the rest of
   the app calls instead of touching dictionaries directly. And it registers
   the deferred-reference resolvers, because this is the module that knows how
   to turn an id into a name — the i18n layer only knows that something has to
   be looked up.

   Requires data/library.js and data/coaching.js to have loaded first.
   ============================================================================ */

(function registerEnglishContent() {
  const exercise = {};
  EXERCISES.forEach(ex => {
    exercise[ex.id] = { name: ex.name, steps: ex.steps, tips: ex.tips };
  });

  const guideline = {};
  PROGRAM.guidelines.forEach((g, i) => { guideline[i] = { title: g.title, text: g.text }; });
  const note = {};
  PROGRAM.notes.forEach((n, i) => { note[i] = n; });

  I18n.register("en", {
    exercise,
    mediaNote: MEDIA_NOTES,
    planContent: {
      title: PROGRAM.title,
      subtitle: PROGRAM.subtitle,
      split: PROGRAM.split,
      frequency: PROGRAM.frequency,
      guideline,
      note,
    },
  });
})();

/* ---------- Language-aware accessors ----------
   Everything that renders a name, a label or a form cue goes through these
   rather than reading the English constant directly, so a language switch
   re-renders the whole app instead of leaving English islands behind. */

function exName(id)     { return I18n.t(`exercise.${id}.name`); }
function exSteps(id)    { return I18n.list(`exercise.${id}.steps`); }
function exTips(id)     { return I18n.list(`exercise.${id}.tips`); }
function exMediaNote(id){ return I18n.has(`mediaNote.${id}`) ? I18n.t(`mediaNote.${id}`) : null; }

function muscleLabel(m)   { return I18n.t(`muscle.${m}`); }
function patternLabel(p)  { return I18n.t(`pattern.${p}`); }
function loadTypeLabel(l) { return I18n.t(`loadType.${l}`); }
function equipmentLabel(e){ return I18n.has(`equipment.${e}`) ? I18n.t(`equipment.${e}`) : e; }
function jointLabel(j)    { return I18n.t(`joint.${j}`); }
function goalLabel(g)     { return I18n.has(`goal.${g}`) ? I18n.t(`goal.${g}`) : g; }
function levelLabel(l)    { return I18n.has(`level.${l}`) ? I18n.t(`level.${l}`) : l; }
function sexLabel(s)      { return I18n.has(`sex.${s}`) ? I18n.t(`sex.${s}`) : s; }
function dayLabel(d)      { return I18n.t(`day.${d}`); }
function dayShort(d)      { return I18n.t(`day.short.${d}`); }
function roleLabel(r)     { return I18n.t(`role.${r}`); }
function volumeStatusLabel(s) { return I18n.t(`volumeStatus.${s}`); }
function goalNote(goal)      { const g = GOAL_PROFILES[goal]; return g ? I18n.t(`goal.note.${g.noteKey}`) : ""; }
function cardioIntensity(goal) {
  const g = GOAL_PROFILES[goal] || GOAL_PROFILES["General fitness"];
  return I18n.t(`goal.cardioIntensity.${g.cardioIntensityKey}`);
}

function planTitle()     { return I18n.t("planContent.title"); }
function planSubtitle()  { return I18n.t("planContent.subtitle"); }
function planGuidelines() {
  return PROGRAM.guidelines.map((g, i) => ({
    title: I18n.t(`planContent.guideline.${i}.title`),
    text: I18n.t(`planContent.guideline.${i}.text`),
  }));
}
function planNotes() {
  return PROGRAM.notes.map((n, i) => I18n.t(`planContent.note.${i}`));
}

/** The plan's own "4 x 10–12" text, rebuilt in the current language. */
function prescriptionText(ex) {
  if (ex.loadType === "timed") {
    return `${ex.defaultSets} × ${ex.defaultRepLo}–${ex.defaultRepHi} ${I18n.t("common.seconds")}`;
  }
  if (ex.defaultRepLo === ex.defaultRepHi) {
    return `${ex.defaultSets} × ${ex.defaultRepLo}`;
  }
  return `${ex.defaultSets} × ${ex.defaultRepLo}–${ex.defaultRepHi}`;
}

/* ---------- Deferred-reference resolvers ----------
   Registered here because this is the module that knows how to turn an id into
   a name. The i18n layer stores the reference; these turn it into text at the
   moment it is rendered, in whatever language is in force then. */
I18n.resolver("ex",        id => exName(id));
I18n.resolver("day",       d  => dayLabel(d));
I18n.resolver("dayShort",  d  => dayShort(d));
I18n.resolver("pattern",   p  => patternLabel(p));
I18n.resolver("joint",     j  => jointLabel(j));
I18n.resolver("muscle",    m  => muscleLabel(m));
I18n.resolver("loadType",  l  => loadTypeLabel(l));
I18n.resolver("role",      r  => roleLabel(r));
I18n.resolver("template",  id => templateName(id));
I18n.resolver("split",     id => splitName(id));
I18n.resolver("goal",      g  => goalLabel(g));
/* A load is a weight plus the exercise it belongs to, because "40 kg" and
   "40 kg of assistance" are different sentences. Progression is defined later
   in load order, so this is looked up lazily rather than captured. */
I18n.resolver("load", (weight, exerciseId) =>
  Progression.fmtLoad(weight, exerciseId ? exerciseById(exerciseId) : null));

/* Composite resolvers: a bulleted list of progression lines with an optional
   overflow tail, and the "Chest Press (shoulder)" pain list. Both have to be
   assembled at render time so the joined text follows the current language. */
I18n.resolver("__lines", (lines, overflow) => {
  const body = (lines || []).map(l => I18n.tx(l)).join("\n");
  return overflow > 0 ? `${body}\n${I18n.t("common.andMore", { count: overflow })}` : body;
});
I18n.resolver("__painList", entries =>
  (entries || [])
    .map(([exerciseId, joint]) => `${exName(exerciseId)} (${jointLabel(joint)})`)
    .join(I18n.isRTL() ? "، " : ", "));
