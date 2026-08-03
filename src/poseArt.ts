/**
 * A drawing of a person for every stretch in the catalog.
 *
 * **Why this exists.** `Icon.tsx` is explicit that its stretch glyphs describe
 * the *movement* — a rotation, a fold — "rather than trying to depict a pose,
 * which no line-icon set can do honestly." That was the right call for a shared
 * icon set, and the wrong ceiling for the app: `open` was `maximize-2` for both
 * Butterfly and Pigeon, and nobody has ever learned a pose from a diagonal
 * arrow. So this is artwork, not icons, and the movement glyphs stay where they
 * still earn their place.
 *
 * **Figures, not paths.** Thirty hand-authored outlines would drift — in stroke
 * weight, in head size, in how tall a person is — and drift across a set is
 * exactly what makes a set look bought rather than drawn. So a pose is a
 * *skeleton*: a head and a handful of jointed strokes in one 64×64 box. Weight,
 * proportion and the curve through a limb come from this file's constants, so
 * every drawing is the same person in a different shape, and adding one is a
 * dozen coordinates rather than a bezier.
 *
 * **The conventions, which do most of the communicating:**
 *
 * - The torso is drawn heavier than the limbs. A single-weight skeleton reads as
 *   clip art; a body with weight in the middle of it reads as a person.
 * - A pose that happens on the floor has a floor line. A pose that doesn't,
 *   doesn't. This one detail carries "lie down" versus "stand up" on its own,
 *   which is otherwise the hardest thing to tell from a silhouette.
 * - Everything faces **right**, and every two-sided pose is drawn on the **left**
 *   side — so the halfway switch the timer announces means "mirror what you are
 *   looking at" rather than something the drawing contradicts.
 * - Props and cues (a door frame, a wall, the breath) are drawn `dim`. They are
 *   context, and a door frame at body weight competes with the body.
 *
 * The breath poses are all the same seated figure, because they *are* the same
 * seated figure — what differs is where the breath goes, so that is what the
 * dim marks show. Drawing five subtly different sitting people would have
 * implied a difference in the body that isn't there.
 */

export const POSE_BOX = 64;
export const POSE_VIEW_BOX = `0 0 ${POSE_BOX} ${POSE_BOX}`;

/** Head radius. Every figure's scale is read off this before anything else. */
export const HEAD_R = 4.6;

/**
 * Stroke weights, as a fraction of the box so a pose drawn at any size keeps its
 * proportions. `body` is the torso, `limb` is everything hinged off it, `dim` is
 * props and breath marks.
 */
export const WEIGHTS = { body: 4.4, limb: 2.9, dim: 1.8 } as const;

/** Props and cues are drawn at this opacity — context, not anatomy. */
export const DIM_OPACITY = 0.42;

export type Pt = readonly [number, number];

export type Stroke = {
  /** Joints, in drawing order. Two points is a straight line; more is a curve. */
  p: Pt[];
  /** Torso weight. Omit for a limb. */
  body?: true;
  /** A prop or a breath mark rather than part of the person. */
  dim?: true;
  /** Joins the last point back to the first — for circles and boxes. */
  closed?: true;
};

export type PoseArt = {
  /** Centre of the head. */
  head: Pt;
  strokes: Stroke[];
  /** The y of the floor, when the pose happens on one. */
  floor?: number;
};

/* ── curve ──────────────────────────────────────────────────────────────── */

/**
 * How much a joint rounds off. Catmull-Rom tension: 0 is a polyline, 1 bulges.
 *
 * Low on purpose. A knee is a corner and should still look like one — this only
 * takes the hard point off it, which is the difference between a body and a
 * folded pipe cleaner. Spines get the same treatment and, being drawn with more
 * points, come out genuinely curved.
 */
const TENSION = 0.34;

/**
 * An SVG path through the given joints.
 *
 * Catmull-Rom converted to cubics, so the curve passes *through* every joint —
 * a plain quadratic smoothing would round a knee away from where it was
 * authored, and these coordinates are the drawing.
 */
export function posePath(points: Pt[], closed = false): string {
  if (points.length === 0) return '';
  if (points.length === 1) {
    // A lone point still has to mark something — a hand, a foot — so it is drawn
    // as a zero-length segment and left to the round cap to make it a dot.
    const [x, y] = points[0];
    return `M ${x} ${y} L ${x} ${y}`;
  }
  if (points.length === 2 && !closed) {
    const [[x0, y0], [x1, y1]] = points;
    return `M ${x0} ${y0} L ${x1} ${y1}`;
  }

  const at = (i: number): Pt => {
    if (closed) return points[(i + points.length) % points.length];
    return points[Math.min(points.length - 1, Math.max(0, i))];
  };

  const last = closed ? points.length : points.length - 1;
  let d = `M ${points[0][0]} ${points[0][1]}`;

  for (let i = 0; i < last; i += 1) {
    const p0 = at(i - 1);
    const p1 = at(i);
    const p2 = at(i + 1);
    const p3 = at(i + 2);

    const c1: Pt = [p1[0] + ((p2[0] - p0[0]) * TENSION) / 3, p1[1] + ((p2[1] - p0[1]) * TENSION) / 3];
    const c2: Pt = [p2[0] - ((p3[0] - p1[0]) * TENSION) / 3, p2[1] - ((p3[1] - p1[1]) * TENSION) / 3];

    d += ` C ${c1[0]} ${c1[1]}, ${c2[0]} ${c2[1]}, ${p2[0]} ${p2[1]}`;
  }

  return closed ? `${d} Z` : d;
}

/* ── the drawings ───────────────────────────────────────────────────────── */

/**
 * The seated figure the five breath poses share, minus the arms.
 *
 * Front-on and cross-legged: sitting is the one pose where a profile says less
 * than a face-on view, because the crossed legs are the whole shape of it.
 */
const SEATED_BASE: Stroke[] = [
  { p: [[32, 17], [32, 35]], body: true },
  { p: [[32, 35], [20, 42], [30, 48]] },
  { p: [[32, 35], [44, 42], [34, 48]] },
];

/** Hands resting on the knees. The default for a breath pose with nothing to do. */
const SEATED_ARMS_RESTING: Stroke[] = [
  { p: [[30, 20], [25, 29], [21, 40]] },
  { p: [[34, 20], [39, 29], [43, 40]] },
];

const SEATED_HEAD: Pt = [32, 12];
const SEATED_FLOOR = 50;

function seated(...strokes: Stroke[]): PoseArt {
  return { head: SEATED_HEAD, strokes: [...SEATED_BASE, ...strokes], floor: SEATED_FLOOR };
}

/**
 * The standing figure, front-on. Used by the neck and shoulder work, which is
 * all done upright and mostly with the arms.
 */
const STANDING_BASE: Stroke[] = [
  { p: [[32, 17], [32, 36]], body: true },
  { p: [[32, 36], [28, 45], [28, 55]] },
  { p: [[32, 36], [36, 45], [36, 55]] },
];

const STANDING_ARMS: Stroke[] = [
  { p: [[30, 20], [26, 29], [25, 39]] },
  { p: [[34, 20], [38, 29], [39, 39]] },
];

const STANDING_FLOOR = 55;

function standing(head: Pt, ...strokes: Stroke[]): PoseArt {
  return { head, strokes: [...STANDING_BASE, ...strokes], floor: STANDING_FLOOR };
}

/**
 * Standing in profile, facing right.
 *
 * For the poses whose whole point happens *in front of* the body. Eagle Arms
 * drawn face-on is two arms crossing over the chest, which at this weight is
 * one lump where a torso used to be — the first pass of it was unreadable. In
 * profile the same arms cross in open space and the pose is obvious.
 */
const PROFILE_BASE: Stroke[] = [
  { p: [[30, 17], [30, 36]], body: true },
  { p: [[30, 36], [29, 46], [29, 55]] },
  { p: [[29, 55], [35, 55]] },
];

function profile(head: Pt, ...strokes: Stroke[]): PoseArt {
  return { head, strokes: [...PROFILE_BASE, ...strokes], floor: STANDING_FLOOR };
}

/**
 * Every pose in the app, keyed the way the catalog references them.
 *
 * Ids match `routineData.ts` step ids one-for-one and are never shared between
 * two steps — sharing is the failure this file exists to end.
 */
export const POSES = {
  /* — breath: one figure, five different breaths ————————————————— */

  // A box, drawn as a box. Four equal sides is the whole instruction.
  breathing: seated(...SEATED_ARMS_RESTING, {
    p: [[42, 8], [51, 8], [51, 17], [42, 17]],
    dim: true,
    closed: true,
  }),

  // Short in, long out. The two lines are to scale with the counts.
  'long-exhale': seated(
    ...SEATED_ARMS_RESTING,
    { p: [[38, 9], [45, 9]], dim: true },
    { p: [[38, 15], [57, 15]], dim: true }
  ),

  // One hand on the chest, one on the belly, and the belly is the one that moves.
  // The elbows are pushed well out: at this weight a hand tucked against the
  // torso is not a hand, it is a thicker torso.
  'belly-breathing': seated(
    { p: [[29, 20], [22, 25], [30, 25]] },
    { p: [[35, 20], [43, 28], [34, 32]] },
    { p: [[27, 35], [32, 39], [37, 35]], dim: true }
  ),

  // Four, seven, eight — three marks, each as long as its own count.
  'four-seven-eight': seated(
    ...SEATED_ARMS_RESTING,
    { p: [[38, 7], [45, 7]], dim: true },
    { p: [[38, 12], [50, 12]], dim: true },
    { p: [[38, 17], [52, 17]], dim: true }
  ),

  // The one breath with a hand in it: thumb to the nose, other hand at rest.
  'alternate-nostril': seated(
    { p: [[30, 20], [25, 29], [21, 40]] },
    { p: [[34, 20], [43, 22], [37, 14]] }
  ),

  /* — neck & shoulders ————————————————————————————————————————— */

  // The head is drawn part-way round, with the circle it is travelling on.
  'neck-rolls': standing(
    [36, 13],
    ...STANDING_ARMS,
    { p: [[26, 15], [28, 8], [36, 6], [42, 11], [41, 18]], dim: true }
  ),

  // Both shoulders, each with its own circle.
  'shoulder-rolls': standing(
    [32, 12],
    ...STANDING_ARMS,
    { p: [[26, 17], [22, 21], [26, 25], [30, 21]], dim: true, closed: true },
    { p: [[38, 17], [34, 21], [38, 25], [42, 21]], dim: true, closed: true }
  ),

  // Head over to one side, and the hand that rests on it for a little weight.
  // The hand stops *on* the edge of the head rather than inside it: overlapping
  // is anatomically right and visually one blob.
  'ear-to-shoulder': standing(
    [37, 15],
    { p: [[30, 20], [26, 29], [25, 39]] },
    { p: [[34, 20], [46, 19], [40, 11]] }
  ),

  // Chin straight back, drawn as the arrow it is — the pose has no silhouette.
  'chin-tuck': profile(
    [32, 12],
    // Swung clear of the torso. An arm hanging straight down the profile line
    // is drawn exactly where the body already is, so it vanishes.
    { p: [[30, 21], [25, 29], [26, 38]] },
    { p: [[46, 12], [38, 12]], dim: true },
    { p: [[41, 9], [38, 12], [41, 15]], dim: true }
  ),

  // A door frame is the pose. Without it this is a person waving.
  'doorway-chest': {
    head: [28, 12],
    floor: STANDING_FLOOR,
    strokes: [
      { p: [[49, 4], [49, 58]], dim: true },
      { p: [[28, 17], [28, 36]], body: true },
      { p: [[28, 36], [24, 45], [24, 55]] },
      { p: [[28, 36], [32, 45], [33, 55]] },
      { p: [[26, 20], [22, 29], [21, 39]] },
      { p: [[31, 20], [41, 20], [45, 13]] },
    ],
  },

  // Forearms wrapped and lifted, drawn in profile so the crossing is visible.
  // The crossing point is the entire pose, and face-on it lands on the chest.
  'eagle-arms': profile(
    [30, 12],
    { p: [[31, 21], [42, 26], [38, 15]] },
    { p: [[31, 23], [39, 29], [43, 18]] }
  ),

  // Hips high, one shoulder down, and that arm slid away along the floor.
  'thread-the-needle': {
    head: [19, 51],
    floor: 54,
    strokes: [
      { p: [[42, 34], [33, 42], [24, 49]], body: true },
      { p: [[42, 35], [43, 45], [43, 54]] },
      { p: [[25, 49], [18, 53], [10, 54]] },
      { p: [[28, 46], [32, 50], [34, 54]] },
    ],
  },

  /* — back & spine ——————————————————————————————————————————— */

  // Both halves at once: the arch solid, the dip dim underneath it.
  'cat-cow': {
    // Head tucked under, which is both what the cat half of this actually does
    // and the only way it stops merging into the end of the arched spine.
    head: [47, 38],
    floor: 54,
    strokes: [
      { p: [[42, 32], [34, 27], [26, 29], [22, 34]], body: true },
      // The dip, well below the arch rather than just under it. Drawn close it
      // read as a chord across a hoop instead of as the other half of a
      // movement — which is the only thing this pose is.
      { p: [[42, 34], [34, 43], [26, 42], [22, 35]], dim: true },
      { p: [[42, 33], [43, 44], [43, 54]] },
      { p: [[22, 35], [19, 44], [19, 54]] },
    ],
  },

  // On the back, both knees hugged in.
  'knees-to-chest': {
    head: [13, 44],
    floor: 52,
    strokes: [
      { p: [[18, 46], [34, 47]], body: true },
      { p: [[34, 47], [30, 36], [20, 39]] },
      { p: [[20, 45], [24, 39], [30, 37]] },
    ],
  },

  // Knees rolled up and over to one side while the arm stays down on the floor
  // the other way. A twist has no profile, so the two directions are the pose.
  'supine-twist': {
    head: [13, 45],
    floor: 52,
    strokes: [
      { p: [[18, 47], [33, 47]], body: true },
      { p: [[33, 47], [37, 37], [47, 39]] },
      { p: [[21, 46], [28, 51], [36, 52]] },
    ],
  },

  // Face down, forearms flat, chest lifted off the floor.
  sphinx: {
    head: [21, 32],
    floor: 52,
    strokes: [
      { p: [[24, 36], [31, 44], [44, 50]], body: true },
      { p: [[26, 38], [24, 47], [14, 50]] },
      { p: [[44, 50], [54, 51]] },
    ],
  },

  // Sat up, one leg crossed over, turning toward the top knee.
  'seated-twist': {
    head: [29, 25],
    floor: 52,
    strokes: [
      { p: [[29, 30], [27, 40], [26, 48]], body: true },
      { p: [[27, 37], [36, 39], [30, 45]] },
      { p: [[26, 48], [37, 43], [34, 52]] },
      { p: [[26, 48], [38, 51], [47, 52]] },
    ],
  },

  // Hinged at the hips, head and arms hanging. Soft knees, drawn soft.
  'standing-fold': {
    head: [40, 42],
    floor: STANDING_FLOOR,
    strokes: [
      { p: [[28, 30], [35, 31], [38, 38]], body: true },
      { p: [[37, 34], [39, 45], [39, 53]] },
      { p: [[28, 31], [27, 44], [27, 55]] },
      { p: [[27, 55], [33, 55]] },
    ],
  },

  /* — hips & legs ————————————————————————————————————————————— */

  // Soles together, knees open. The diamond is the pose.
  butterfly: {
    head: [32, 14],
    floor: 50,
    strokes: [
      { p: [[32, 19], [32, 35]], body: true },
      { p: [[32, 36], [20, 43], [32, 48], [44, 43]], closed: true },
      { p: [[30, 22], [25, 33], [31, 44]] },
      { p: [[34, 22], [39, 33], [33, 44]] },
    ],
  },

  // On the back, knees toward the armpits, hands holding the feet.
  'happy-baby': {
    head: [13, 44],
    floor: 52,
    strokes: [
      { p: [[18, 46], [32, 47]], body: true },
      { p: [[32, 47], [28, 35], [35, 30]] },
      { p: [[20, 45], [27, 37], [34, 31]] },
    ],
  },

  // One leg up, held behind the thigh; the other stays down.
  'hamstring-reclined': {
    head: [13, 44],
    floor: 52,
    strokes: [
      { p: [[18, 46], [36, 47]], body: true },
      { p: [[36, 47], [39, 33], [39, 21]] },
      { p: [[36, 48], [46, 49], [55, 50]] },
      { p: [[22, 46], [30, 40], [38, 33]] },
    ],
  },

  // Legs out, hinged forward over them. The fold is drawn shallower than it
  // feels: at a true fold the torso, the arm and the legs all end up within a
  // couple of points of each other and the whole figure reads as a smudge.
  'seated-forward-fold': {
    head: [36, 35],
    floor: 52,
    strokes: [
      { p: [[20, 48], [24, 38], [31, 36]], body: true },
      { p: [[20, 50], [34, 51], [48, 51]] },
      { p: [[48, 51], [48, 46]] },
      { p: [[31, 38], [38, 44], [46, 49]] },
    ],
  },

  // Ankle across the opposite knee — the four, which is the name of the thing.
  'figure-four': {
    head: [13, 44],
    floor: 52,
    strokes: [
      { p: [[18, 46], [34, 47]], body: true },
      { p: [[34, 47], [32, 35], [39, 29]] },
      { p: [[34, 48], [43, 39], [30, 34]] },
      { p: [[22, 45], [28, 38], [33, 34]] },
    ],
  },

  // Back knee down, hips sinking between the two legs.
  'low-lunge': {
    head: [30, 17],
    floor: 54,
    strokes: [
      { p: [[30, 22], [30, 37]], body: true },
      { p: [[30, 37], [42, 42], [42, 54]] },
      { p: [[30, 37], [22, 48], [14, 54]] },
      { p: [[30, 25], [32, 33], [34, 39]] },
    ],
  },

  // Front shin across, back leg long. Drawn only leaning rather than fully
  // folded: flat over the front leg it is a horizontal smear, and the shape
  // that says "pigeon" is the two legs, which the lean leaves visible.
  pigeon: {
    head: [31, 31],
    floor: 54,
    strokes: [
      { p: [[32, 36], [34, 46]], body: true },
      { p: [[34, 48], [26, 50], [18, 51]] },
      { p: [[34, 48], [44, 51], [54, 53]] },
      { p: [[32, 37], [29, 44], [25, 49]] },
    ],
  },

  /* — winding down ————————————————————————————————————————————— */

  // Folded over the knees, arms long in front.
  'childs-pose': {
    head: [20, 49],
    floor: 54,
    strokes: [
      { p: [[42, 44], [32, 43], [24, 47]], body: true },
      { p: [[42, 45], [47, 51], [38, 54]] },
      { p: [[28, 46], [20, 52], [9, 53]] },
    ],
  },

  // Knees bent, feet flat, hands on the ribs. Nothing being held.
  'constructive-rest': {
    head: [13, 44],
    floor: 52,
    strokes: [
      { p: [[18, 46], [34, 47]], body: true },
      { p: [[34, 47], [40, 36], [46, 50]] },
      { p: [[46, 50], [51, 50]] },
      { p: [[21, 45], [26, 40], [31, 44]] },
    ],
  },

  // On the side, knees drawn up, and the pillow that makes it work.
  'side-lying-rest': {
    head: [14, 42],
    floor: 52,
    strokes: [
      { p: [[19, 44], [34, 46]], body: true },
      { p: [[34, 46], [44, 42], [42, 50]] },
      { p: [[20, 44], [28, 42], [36, 44]] },
      { p: [[8, 47], [12, 50], [18, 49], [15, 45]], dim: true, closed: true },
    ],
  },

  // The wall is the pose, so the wall is drawn.
  'legs-up-wall': {
    head: [13, 45],
    floor: 52,
    strokes: [
      { p: [[50, 5], [50, 52]], dim: true },
      { p: [[18, 47], [40, 48]], body: true },
      { p: [[40, 48], [45, 33], [46, 15]] },
      { p: [[22, 47], [27, 52]] },
    ],
  },

  // Flat out, arms a little away from the body. The least shape in the app.
  'final-relaxation': {
    head: [13, 45],
    floor: 52,
    strokes: [
      { p: [[18, 47], [40, 48]], body: true },
      { p: [[40, 48], [49, 49], [57, 51]] },
      { p: [[22, 47], [32, 51], [40, 53]] },
    ],
  },
} as const satisfies Record<string, PoseArt>;

export type PoseName = keyof typeof POSES;

export function poseArt(name: PoseName): PoseArt {
  return POSES[name];
}
