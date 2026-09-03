/* ============================================================================
   GymBuddy — data/brands.js
   ----------------------------------------------------------------------------
   The same movement is the same movement everywhere, but the machine it is
   done on is not. "Chest Press Machine" is what the exercise is; "Chest Press
   (Selection)" is what is written on the frame in a gym kitted out by
   Technogym, and a member looking for it reads the frame.

   So the library underneath stays brand-neutral, and each brand supplies an
   overlay: a different name, a different equipment label, and setup cues that
   describe the adjustments that machine actually has. Anything a brand does
   not override falls through to the neutral entry, which is why an overlay can
   be as small as one exercise.

   A brand can also supply its own photographs, in assets/photos/<id>/ — see
   data/brand-photos.js for which ones exist and tools/import-photos.js for how
   to add them.

   Adding a brand is this file plus its Arabic half in i18n/brands.ar.js.
   ============================================================================ */

const BRANDS = {
  /* The neutral library, and the default. Names movements rather than
     products, which is right for a gym with mixed equipment. */
  generic: { id: "generic", photoDir: null },

  /* Technogym's Selection, Pure Strength, Pulley, Multipower, Excite and
     Skill lines. */
  technogym: { id: "technogym", photoDir: "technogym" },
};

const DEFAULT_BRAND = "generic";

/** Which brand the active profile's gym is kitted out with. */
function activeBrand() {
  try {
    const p = typeof Store !== "undefined" && Store.getActiveProfile && Store.getActiveProfile();
    const id = p && p.settings && p.settings.equipmentBrand;
    return BRANDS[id] ? id : DEFAULT_BRAND;
  } catch (e) {
    return DEFAULT_BRAND;
  }
}

/* ---------- The overlays ----------
   English is the source text, registered into the English dictionary the same
   way the neutral library is. The Arabic half lives in i18n/brands.ar.js. */

const BRAND_CONTENT = {
  technogym: {
    "chest-press-machine": {
      name: "Chest Press (Selection)",
      equipment: "Technogym Selection",
      steps: [
        "Set the seat so the handles sit at mid-chest. Note the number on the seat scale — it is the same every session.",
        "Sit back against the pad with your shoulder blades pulled down and together, feet flat.",
        "Press the handles forward until the arms are long, stopping short of locking the elbows.",
        "Return under control until you feel the chest stretch, without letting the stack touch down.",
      ],
      tips: [
        "If the machine has a range-of-motion selector, set the start so your hands begin level with your chest, not behind it.",
        "Rest 90–120 sec between sets (compound lift).",
      ],
    },
    "lat-pulldown-wide": {
      name: "Lat Machine (Selection)",
      equipment: "Technogym Selection",
      steps: [
        "Set the thigh pad so it pins your legs firmly — that pad is what stops you standing up under the load.",
        "Take the wide bar with a grip a little outside shoulder width, then sit with your chest tall.",
        "Pull the bar to your collarbone by driving your elbows down, not by leaning back.",
        "Let the bar rise until the arms are long and the shoulders reach up, then repeat.",
      ],
      tips: [
        "The Selection Lat Machine's handles rotate as you pull — let them, rather than fighting to keep the bar square.",
        "If your gym has the Vertical Traction machine, it trains the same pattern with a fixed arm path.",
      ],
    },
    "seated-cable-row": {
      name: "Seated Row (Pulley)",
      equipment: "Technogym Pulley",
      steps: [
        "Sit at the low pulley with your feet on the plate and a slight bend in the knees.",
        "Take the handle with your arms long and your chest up, torso close to upright.",
        "Pull to your navel by driving the elbows back, letting the shoulder blades come together.",
        "Return until the arms are straight and the blades open, without rocking backwards.",
      ],
      tips: [
        "Your torso should stay still. If it is rowing along with the handle, drop the pin a plate.",
        "Rest 90–120 sec between sets (compound lift).",
      ],
    },
    "shoulder-press-machine": {
      name: "Shoulder Press (Selection)",
      equipment: "Technogym Selection",
      steps: [
        "Set the seat so the handles start at about shoulder height — high enough to press, not so low that you dive under them.",
        "Sit with your back flat on the pad and your feet planted.",
        "Press up until the arms are long without locking out, keeping the ribs down.",
        "Lower under control until your hands are back level with your shoulders.",
      ],
      tips: [
        "If your lower back arches off the pad to finish a rep, that rep was the stack talking, not the shoulders.",
        "Rest 90–120 sec between sets (compound lift).",
      ],
    },
    "cable-triceps-pushdown": {
      name: "Triceps Pushdown (Pulley)",
      equipment: "Technogym Pulley",
      steps: [
        "Set the pulley to its highest position and clip on a bar or rope.",
        "Stand close with your elbows pinned to your ribs and your forearms parallel to the floor.",
        "Push down until your arms are straight, spreading a rope apart at the bottom.",
        "Let your hands rise only until your forearms are level again — the elbows never travel.",
      ],
      tips: [
        "If your elbows drift forward or your shoulders roll in, the lats have taken over the set.",
        "Rest 60–90 sec between sets (isolation).",
      ],
    },
    "leg-press": {
      name: "Leg Press (Pure Strength)",
      equipment: "Technogym Pure Strength",
      steps: [
        "Set the back pad so your knees start bent to roughly ninety degrees, no deeper.",
        "Place your feet mid-platform at shoulder width, whole foot in contact.",
        "Release the safety catches, then press until the legs are long without snapping the knees straight.",
        "Lower until your knees reach the start angle, keeping your lower back flat against the pad.",
      ],
      tips: [
        "The moment your hips curl up off the pad you have gone too deep — that is where lower backs get hurt.",
        "Re-engage the catches before you get out, every time.",
      ],
    },
    "seated-leg-curl": {
      name: "Leg Curl (Selection)",
      equipment: "Technogym Selection",
      steps: [
        "Set the seat back and the thigh pad so your knees sit level with the pivot and your legs are held down.",
        "Set the ankle roller just above your heels.",
        "Curl your heels down and under until the hamstrings are fully shortened.",
        "Return slowly to a long-leg position without letting the stack drop.",
      ],
      tips: [
        "The thigh pad should be snug. If your hips lift on the hard reps, tighten it.",
        "Rest 60–90 sec between sets (isolation).",
      ],
    },
    "leg-extension": {
      name: "Leg Extension (Selection)",
      equipment: "Technogym Selection",
      steps: [
        "Set the seat back so your knee joint lines up with the machine's pivot — the marked point on the side frame.",
        "Set the ankle pad to rest just above your shoes, not on your shins.",
        "Straighten your legs smoothly and pause for a beat at the top.",
        "Lower under control to the start angle without letting the plates touch down.",
      ],
      tips: [
        "Lining the knee up with the pivot is what keeps the load on the muscle rather than on the joint.",
        "Rest 60–90 sec between sets (isolation).",
      ],
    },
    "hip-adduction-abduction": {
      name: "Abductor / Adductor (Selection)",
      equipment: "Technogym Selection",
      steps: [
        "Sit right back in the seat with your spine against the pad.",
        "Set the pads: outside your knees to push out (abductor), inside them to squeeze in (adductor).",
        "Move the pads through the full range and hold the end position for a beat.",
        "Return slowly — this is the half most people give away.",
      ],
      tips: [
        "Technogym builds these as two separate machines. Do both; they train opposite jobs.",
        "Rest 60–90 sec between sets (isolation).",
      ],
    },
    "standing-calf-raise-machine": {
      name: "Rotary Calf (Selection)",
      equipment: "Technogym Selection",
      steps: [
        "Set the shoulder pads so you stand tall with a slight bend in the knees.",
        "Put the balls of your feet on the platform edge with your heels free.",
        "Press up onto your toes as high as the machine allows and hold for a count.",
        "Lower your heels below the platform until you feel the calf stretch.",
      ],
      tips: [
        "Calves answer to the pause at the top and the stretch at the bottom, not to the number on the stack.",
        "Rest 60–90 sec between sets (isolation).",
      ],
    },
    "cable-crunch-ab-machine": {
      name: "Abdominal Crunch (Selection)",
      equipment: "Technogym Selection",
      steps: [
        "Set the seat so the chest pad sits across your upper chest and your feet are hooked under the rollers.",
        "Take the handles beside your head without pulling on your neck.",
        "Curl your ribs down toward your hips — a short, hard contraction, not a bend at the hips.",
        "Return only until the stack is nearly down, keeping tension on the abs.",
      ],
      tips: [
        "Range is short by design. If you are travelling a long way, you are hinging at the hip, not crunching.",
        "Rest 45–60 sec between sets.",
      ],
    },
    "smith-machine-incline-press": {
      name: "Incline Press (Multipower)",
      equipment: "Technogym Multipower",
      steps: [
        "Set an adjustable bench to about thirty degrees under the Multipower bar.",
        "Lie back so the bar tracks down to your upper chest, and set the safety stops just below that.",
        "Unhook the bar, lower it to your upper chest under control, and touch lightly.",
        "Press back up without locking out hard, and re-hook only at the very end of the set.",
      ],
      tips: [
        "The fixed bar path is the point: you can push closer to failure safely than with free weights.",
        "Rest 90–120 sec between sets (compound lift).",
      ],
    },
    "assisted-pull-up-machine": {
      name: "Assisted Chin / Vertical Traction",
      equipment: "Technogym Selection",
      steps: [
        "Set the assistance: a HIGHER number on the stack means MORE help, which is the opposite of every other machine here.",
        "Kneel or stand on the pad and take the overhead grip.",
        "Pull until your chin clears your hands, keeping your chest up.",
        "Lower all the way to straight arms before the next rep.",
      ],
      tips: [
        "As you get stronger the number goes DOWN. The coach tracks it that way round.",
        "No assisted unit? Technogym's Vertical Traction trains the same pattern seated.",
      ],
    },
    "chest-fly-pec-deck": {
      name: "Pectoral (Selection)",
      equipment: "Technogym Selection",
      steps: [
        "Set the seat so the handles sit at chest height, and use the range-of-motion selector so you start with a stretch you can control.",
        "Sit back with your shoulder blades down and a soft, fixed bend in the elbows.",
        "Bring the pads together in front of your chest and hold for a beat.",
        "Open slowly until you feel the chest lengthen, keeping the elbow angle unchanged throughout.",
      ],
      tips: [
        "The elbow angle never changes on a fly. If it opens and closes, it has become a press.",
        "Rest 60–90 sec between sets (isolation).",
      ],
    },
    "cable-rope-face-pull": {
      name: "Face Pull (Pulley)",
      equipment: "Technogym Pulley",
      steps: [
        "Set the pulley to just above head height and clip on the rope.",
        "Step back until the cable is tight, arms long, thumbs pointing back.",
        "Pull the rope toward your forehead, spreading your hands apart as your elbows travel back.",
        "Finish with your knuckles beside your ears, hold, then return slowly.",
      ],
      tips: [
        "The single best thing you can do for shoulders that press a lot. Keep it light and clean.",
        "Rest 45–60 sec between sets.",
      ],
    },
    "hack-squat-machine": {
      name: "Hack Squat (Pure Strength)",
      equipment: "Technogym Pure Strength",
      steps: [
        "Set the shoulder pads so you stand with a soft knee and your back flat on the ramp.",
        "Place your feet mid-platform, shoulder width, toes turned slightly out.",
        "Unlock the catches and lower until your thighs reach about parallel.",
        "Drive back up through your whole foot without locking the knees at the top.",
      ],
      tips: [
        "Feet lower on the platform hits the quads harder; higher shares it with the glutes. Pick one and keep it.",
        "Rest 90–120 sec between sets (compound lift).",
      ],
    },
    "glute-kickback": {
      name: "Glute (Selection)",
      equipment: "Technogym Selection",
      steps: [
        "Set the pad and the roller so your working leg starts with the hip bent, chest supported.",
        "Brace against the pad so your lower back stays still.",
        "Drive the working leg back and up until the hip is straight — no further.",
        "Return slowly to the start, then repeat before swapping sides.",
      ],
      tips: [
        "Extra range at the top comes from arching your back, not from your glute. Stop at straight.",
        "Rest 45–60 sec between sets.",
      ],
    },
    "seated-calf-raise": {
      name: "Seated Calf (Pure Strength)",
      equipment: "Technogym Pure Strength",
      steps: [
        "Sit with the balls of your feet on the platform and the thigh pads locked down over your knees.",
        "Release the catch and let your heels sink until you feel the stretch.",
        "Press up onto your toes as far as the machine allows and hold briefly.",
        "Lower slowly back into the stretch.",
      ],
      tips: [
        "Bent knees put the soleus in charge, which is the half of the calf standing raises miss.",
        "Rest 60–90 sec between sets (isolation).",
      ],
    },
    "incline-treadmill-walk": {
      name: "Excite Run — incline walk",
      equipment: "Technogym Excite",
      steps: [
        "Step on, clip the safety key to your waistband, and start at a walking pace.",
        "Raise the incline until the effort is real but you could still hold a conversation.",
        "Walk tall and let your arms swing; do not hang off the handrails.",
        "Drop the incline for the last two minutes rather than stopping dead.",
      ],
      tips: [
        "Holding the rails removes most of the work and all of the point. Lower the incline instead.",
        "Low impact on the knees while still moving real calories — the right first choice at a heavier bodyweight.",
      ],
    },
    "stationary-bike": {
      name: "Excite Bike",
      equipment: "Technogym Excite",
      steps: [
        "Set the saddle so your knee stays slightly bent at the bottom of the pedal stroke.",
        "Note the saddle number on the post — it is the same every session.",
        "Ride at a steady cadence you can hold for the whole block.",
        "Spin easy for the last two minutes to cool down.",
      ],
      tips: [
        "A saddle set too low is the most common cause of sore knees on a bike.",
        "The Recline version puts your back against a pad if sitting upright is uncomfortable.",
      ],
    },
    "elliptical": {
      name: "Excite Synchro",
      equipment: "Technogym Excite",
      steps: [
        "Step on with a foot on each platform and take the moving handles.",
        "Start pedalling and let the machine find its rhythm before adding resistance.",
        "Push and pull with the arms as much as you drive with the legs.",
        "Ease the resistance down over the last two minutes.",
      ],
      tips: [
        "Almost no impact through the joints, which is why it suits heavier bodyweights and sore knees.",
        "The Vario version lengthens your stride as you speed up if you want more variety.",
      ],
    },
    "rowing-machine": {
      name: "Skillrow",
      equipment: "Technogym Skill",
      steps: [
        "Strap your feet in with the strap across the widest part of your foot.",
        "Drive with the legs first, then swing the torso back, then pull the handle to your ribs.",
        "Reverse it exactly: arms away, torso forward, then let the knees bend.",
        "Aim for a long, unhurried stroke rather than a fast, short one.",
      ],
      tips: [
        "Legs, back, arms — then arms, back, legs. Getting that order right is most of rowing.",
        "Whole-body and no impact, but it will find a weak lower back if you have one.",
      ],
    },
    "stairmaster": {
      name: "Excite Climb",
      equipment: "Technogym Excite",
      steps: [
        "Step on and start slowly — the steps keep moving whether you are ready or not.",
        "Stand tall and take full steps rather than short shuffles.",
        "Rest your hands lightly on the rails for balance, not for support.",
        "Slow the pace for the last two minutes instead of stepping straight off.",
      ],
      tips: [
        "Leaning on the rails turns a hard machine into an easy one. Slow it down instead.",
        "Higher effort than a walk for the same time — build up to it rather than starting here.",
      ],
    },
    "machine-chest-supported-row": {
      name: "Low Row (Selection)",
      equipment: "Technogym Selection",
      steps: [
        "Set the seat so the handles are level with your lower ribs and your chest rests against the pad.",
        "Take the handles with your arms long and your chest pressed into the pad.",
        "Pull the handles back until your elbows pass your ribs, squeezing the shoulder blades together.",
        "Return until the arms are straight and the shoulder blades separate, keeping your chest on the pad.",
      ],
      tips: [
        "The chest pad is the point of this machine: if your torso is coming off it, the weight is too heavy.",
        "Rest 90–120 sec between sets (compound lift).",
      ],
    },
    "cable-lateral-raise": {
      name: "Seated Lateral Raise (Pulley)",
      equipment: "Technogym Pulley",
      steps: [
        "Sit on a bench between two low pulleys and take the left handle in your right hand and the right in your left, so the cables cross in front of your shins.",
        "Fix a slight bend in each elbow and sit tall.",
        "Raise both arms out to the side to shoulder height, leading with the elbows.",
        "Lower slowly — crossed cables keep tension at the bottom where dumbbells lose it.",
      ],
      tips: [
        "Sitting takes the legs and lower back out of it, so nothing helps you cheat the weight up.",
        "Rest 45–60 sec between sets.",
      ],
    },
    "reverse-pec-deck": {
      name: "Rear Delt (Selection)",
      equipment: "Technogym Selection",
      steps: [
        "Set the seat so the handles are at shoulder height and your chest rests against the front pad.",
        "Take the handles with your thumbs up and your elbows almost straight.",
        "Sweep your arms out and back until they are level with your shoulders — no further.",
        "Return under control without letting the stack rest between reps.",
      ],
      tips: [
        "Lead with the little finger, not the hand: it keeps the work on the rear delt instead of the traps.",
        "This is the machine that pays back the hours you spend pressing. Do not rush it.",
      ],
    },
    "cable-crossover": {
      name: "Cable Crossover (Pulley)",
      equipment: "Technogym Pulley",
      steps: [
        "Set both pulleys high and take a handle in each hand.",
        "Step forward into a split stance with a soft, fixed bend in the elbows.",
        "Bring your hands together and slightly down in front of you, crossing a little at the end.",
        "Open slowly until you feel the chest stretch, keeping the elbow angle unchanged.",
      ],
      tips: [
        "Vary the pulley height between blocks — high hits the lower chest, low the upper.",
        "Rest 60–90 sec between sets (isolation).",
      ],
    },
    "straight-arm-pulldown": {
      name: "Straight-Arm Pulldown (Pulley)",
      equipment: "Technogym Pulley",
      steps: [
        "Set the pulley high and take a straight bar with your arms extended in front of you.",
        "Hinge forward slightly and lock a soft bend into your elbows.",
        "Sweep the bar down to your thighs using only the shoulder joint.",
        "Let it rise until you feel the lats lengthen overhead.",
      ],
      tips: [
        "This is a lat exercise with no elbow bend at all — if the arms are working, lighten it.",
        "Rest 45–60 sec between sets.",
      ],
    },
    "preacher-curl": {
      name: "Arm Curl (Selection)",
      equipment: "Technogym Selection",
      steps: [
        "Set the seat so your armpits rest on the top of the pad and your upper arms lie flat on it.",
        "Take the handles with your elbows slightly bent — never start from a locked-out arm.",
        "Curl until your forearms are vertical, keeping your upper arms glued to the pad.",
        "Lower slowly until just short of straight, then go again.",
      ],
      tips: [
        "The pad exists to stop your elbows travelling. If they are sliding up it, the weight is winning.",
        "Rest 60–90 sec between sets (isolation).",
      ],
    },
    "upright-row": {
      name: "Upright Row (Pulley)",
      equipment: "Technogym Pulley",
      steps: [
        "Set the pulley low and take a straight bar at about shoulder width — not narrow.",
        "Stand tall with the bar resting against your thighs.",
        "Pull it up the front of your body to lower-chest height, leading with the elbows.",
        "Lower under control all the way back to your thighs.",
      ],
      tips: [
        "Stop at the lower chest. Pulling to the chin is where shoulders get pinched.",
        "Skip this one entirely if your shoulders complain; the lateral raise trains the same thing safely.",
      ],
    },
    "cable-rear-delt-fly": {
      name: "Rear Delt Fly (Pulley)",
      equipment: "Technogym Pulley",
      steps: [
        "Set both pulleys to shoulder height and cross the cables, right handle in the left hand.",
        "Stand tall with your arms out in front and a soft bend in the elbows.",
        "Sweep your arms out and back until they are level with your shoulders.",
        "Return under control without letting your shoulders roll forward.",
      ],
      tips: [
        "Think about pulling your shoulder blades apart at the back, not about moving your hands.",
        "Rest 45–60 sec between sets.",
      ],
    },
  },
};

/* Register every overlay under `brand.<brand>.exercise.<id>.*`, which is where
   exName(), exSteps() and exTips() look before falling back to the neutral
   entry. */
(function registerBrandContent() {
  const exercise = {};
  Object.entries(BRAND_CONTENT).forEach(([brand, entries]) => {
    exercise[brand] = { exercise: {} };
    Object.entries(entries).forEach(([id, e]) => {
      exercise[brand].exercise[id] = { name: e.name, steps: e.steps, tips: e.tips };
    });
  });
  I18n.register("en", { brand: exercise });
  I18n.register("en", {
    brandName: { generic: "No particular brand", technogym: "Technogym" },
  });
})();

/** The equipment label for one exercise under the brand in force. */
function brandEquipment(id) {
  const o = (BRAND_CONTENT[activeBrand()] || {})[id];
  return o && o.equipment ? o.equipment : null;
}
