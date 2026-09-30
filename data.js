/* Progression Lab: preset progressions, cadences and meters.
   Each chord is [defId, ext, inversion, length in bars]; presets use one bar per chord.
   Def ids live in theory.js. */
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

// Each chord is [defId, ext, inversion, length in bars]. Lengths are kept in bars so a chord keeps
// its share of the bar when the meter changes (one bar of 4/4 becomes one bar of 3/4).
const toInsts = prog => prog.map(([id, ext = 'triad', inv = 0, len = 1]) => ({ id, ext, inv, len }));

/* Meters. The bar is counted in eighth-note pulses: `beats` lists how many pulses each felt beat
   holds, `strong` lists the beats that take an accent, and `perBeat` says how many pulses the
   tempo's beat note spans (2 for ♩, 3 for ♩.). 7/8 counts its tempo in quarter notes, so its
   last beat is half again as long as the first two. */
const METERS = [
  { id: '2/4', beats: [2, 2], strong: [0], perBeat: 2, beatNote: '♩', kind: 'Simple duple', desc: 'Two beats, each split into two eighth notes.' },
  { id: '3/4', beats: [2, 2, 2], strong: [0], perBeat: 2, beatNote: '♩', kind: 'Simple triple', desc: 'Three beats, each split into two eighth notes.' },
  { id: '4/4', beats: [2, 2, 2, 2], strong: [0, 2], perBeat: 2, beatNote: '♩', kind: 'Simple quadruple', desc: 'Four beats, each split into two. Beat 3 takes a lighter accent.' },
  { id: '5/4', beats: [2, 2, 2, 2, 2], strong: [0, 3], perBeat: 2, beatNote: '♩', kind: 'Irregular, 3 + 2', desc: 'Five beats grouped 3 + 2, with a lighter accent on beat 4.' },
  { id: '6/8', beats: [3, 3], strong: [0], perBeat: 3, beatNote: '♩.', kind: 'Compound duple', desc: 'Two beats, each split into three eighth notes.' },
  { id: '7/8', beats: [2, 2, 3], strong: [0], perBeat: 2, beatNote: '♩', kind: 'Irregular, 2 + 2 + 3', desc: 'Seven eighth notes grouped 2 + 2 + 3. The last beat is half again as long as the others.' },
  { id: '9/8', beats: [3, 3, 3], strong: [0], perBeat: 3, beatNote: '♩.', kind: 'Compound triple', desc: 'Three beats, each split into three eighth notes.' },
  { id: '12/8', beats: [3, 3, 3, 3], strong: [0, 2], perBeat: 3, beatNote: '♩.', kind: 'Compound quadruple', desc: 'Four beats, each split into three. Common in slow blues and ballads.' },
];
const meterById = id => METERS.find(m => m.id === id) || METERS[2];
const barPulses = meter => meter.beats.reduce((s, n) => s + n, 0);
// Pulse position of beat b counted from the start of the song. Beats cycle through the meter's
// groups bar after bar, so in 7/8 beat 3 (the third of each bar) is always the long one.
function beatPulse(meter, b) {
  const n = meter.beats.length;
  let p = Math.floor(b / n) * barPulses(meter);
  for (let k = 0; k < b % n; k++) p += meter.beats[k];
  return p;
}

// Counting syllables for each pulse: the beat number, then "&" in twos or "la li" in threes.
function meterCounts(meter) {
  const out = [];
  meter.beats.forEach((n, b) => {
    out.push({ text: String(b + 1), beat: b, start: true });
    for (let k = 1; k < n; k++) out.push({ text: n === 3 ? ['la', 'li'][k - 1] : '&', beat: b, start: false });
  });
  return out;
}
