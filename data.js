/* Progression Lab: preset progressions and cadences.
   Each chord is [defId, ext, inversion]. Def ids live in theory.js. */
const PRESETS = [
  {
    name: 'Axis', mode: 'major', genre: 'Pop',
    prog: [['d0'], ['d4'], ['d5'], ['d3']],
    about: 'The four-chord loop under a large share of pop since the 2000s. IV back to I avoids a hard V→I landing, so it can repeat forever.',
  },
  {
    name: '1950s', mode: 'major', genre: 'Doo-wop',
    prog: [['d0'], ['d5'], ['d3'], ['d4']],
    about: 'The doo-wop ballad loop. Ending each pass on V pulls you straight back to the top.',
  },
  {
    name: 'Axis from vi', mode: 'major', genre: 'Pop',
    prog: [['d5'], ['d3'], ['d0'], ['d4']],
    about: 'The same four chords as Axis, started on vi. Opening on the minor chord makes the loop sound sadder.',
  },
  {
    name: 'ii–V–I', mode: 'major', genre: 'Jazz',
    prog: [['d1', 'b7'], ['d4', 'b7'], ['d0', 'maj7'], ['d0', 'maj7']],
    about: 'The core jazz cadence. Each root falls a fifth, and the 7th of each chord steps down into the next.',
  },
  {
    name: '12-bar blues', mode: 'major', genre: 'Blues',
    prog: [['d0', 'b7'], ['d0', 'b7'], ['d0', 'b7'], ['d0', 'b7'], ['d3', 'b7'], ['d3', 'b7'],
      ['d0', 'b7'], ['d0', 'b7'], ['d4', 'b7'], ['d3', 'b7'], ['d0', 'b7'], ['d4', 'b7']],
    about: 'Every chord is a dominant 7th, so nothing fully settles. Bars 9–12 are the turnaround that sends you back to bar 1.',
  },
  {
    name: 'Pachelbel', mode: 'major', genre: 'Baroque',
    prog: [['d0'], ['d4'], ['d5'], ['d2'], ['d3'], ['d0'], ['d3'], ['d4']],
    about: 'The Canon in D pattern. The bass walks down while the roots alternate falling fourths and rising steps.',
  },
  {
    name: 'Andalusian cadence', mode: 'minor', genre: 'Flamenco',
    prog: [['d0'], ['d6'], ['d5'], ['hV']],
    about: 'Four chords over a bass that steps straight down to a major V. Common in flamenco and surf rock.',
  },
  {
    name: 'Mixolydian vamp', mode: 'major', genre: 'Rock',
    prog: [['d0'], ['bVII'], ['d3'], ['d0']],
    about: '♭VII, borrowed from minor, replaces V. The loop never uses the leading tone, which gives classic rock its open sound.',
  },
  {
    name: 'Minor pop loop', mode: 'minor', genre: 'Pop',
    prog: [['d0'], ['d5'], ['d2'], ['d6']],
    about: 'The Axis chords heard from the minor side. i–VI–III–VII is the same set of triads as vi–IV–I–V.',
  },
  {
    name: 'The minor iv', mode: 'major', genre: 'Ballad',
    prog: [['d0'], ['d3'], ['iv'], ['d0']],
    about: 'IV turns minor for one bar. The 6th scale degree drops a half step, then the phrase settles home.',
  },
  {
    name: 'Diatonic circle', mode: 'major', genre: 'Standards',
    prog: [['d0', 'maj7'], ['d3', 'maj7'], ['d6', 'b7'], ['d2', 'b7'], ['d5', 'b7'], ['d1', 'b7'], ['d4', 'b7'], ['d0', 'maj7']],
    about: 'Every root falls a fifth through all seven chords of the key. Watch the path wind around the circle of fifths.',
  },
  {
    name: 'Secondary dominants', mode: 'major', genre: 'Classical',
    prog: [['d0'], ['Vvi', 'b7'], ['d5'], ['VV', 'b7'], ['d4', 'b7'], ['d0']],
    about: 'Each secondary dominant treats the next chord as a temporary home, adding one note from outside the key.',
  },
  {
    name: 'Picardy ending', mode: 'minor', genre: 'Baroque',
    prog: [['d0'], ['d3'], ['hV', 'b7'], ['pI']],
    about: 'A minor phrase that ends on a major tonic. Baroque composers used it to brighten a final cadence.',
  },
  {
    name: 'Neapolitan', mode: 'minor', genre: 'Classical',
    prog: [['d0'], ['N', 'triad', 1], ['hV', 'b7'], ['d0']],
    about: '♭II in first inversion is a dramatic predominant. Its lowered 2nd falls to the leading tone of V.',
  },
];

const CADENCES = [
  {
    name: 'Authentic', short: 'V → I', mode: 'major',
    prog: [['d3'], ['d4', 'b7'], ['d0']],
    about: 'Dominant to tonic. The strongest way to end a phrase, like a period at the end of a sentence.',
  },
  {
    name: 'Plagal', short: 'IV → I', mode: 'major',
    prog: [['d0'], ['d3'], ['d0']],
    about: 'Subdominant to tonic. A softer landing, known from the "amen" at the end of hymns.',
  },
  {
    name: 'Half', short: '… → V', mode: 'major',
    prog: [['d0'], ['d1'], ['d4']],
    about: 'The phrase stops on the dominant. It sounds like a question or a comma.',
  },
  {
    name: 'Deceptive', short: 'V → vi', mode: 'major',
    prog: [['d3'], ['d4', 'b7'], ['d5']],
    about: 'After V the ear expects I and gets vi instead. Composers use it to keep a phrase going.',
  },
  {
    name: 'Phrygian half', short: 'iv⁶ → V', mode: 'minor',
    prog: [['d0'], ['d3', 'triad', 1], ['hV']],
    about: 'A minor-key half cadence. The bass falls a half step onto the root of V.',
  },
];

const toInsts = prog => prog.map(([id, ext = 'triad', inv = 0]) => ({ id, ext, inv }));
