/* Progression Lab: theory engine. Spelling, chord definitions, Roman numerals, voicing. */
const Theory = (() => {
  const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
  const LETTER_PC = [0, 2, 4, 5, 7, 9, 11];
  const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];
  const SCALES = {
    major: [0, 2, 4, 5, 7, 9, 11],
    minor: [0, 2, 3, 5, 7, 8, 10],
    harmonic: [0, 2, 3, 5, 7, 8, 11],
    dorian: [0, 2, 3, 5, 7, 9, 10],
  };
  const TONICS = {
    major: ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'],
    minor: ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'G#', 'A', 'Bb', 'B'],
  };
  const mod = (n, m = 12) => ((n % m) + m) % m;
  const signed = a => (a > 6 ? a - 12 : a);

  function accText(a) {
    if (a === 2) return '𝄪';
    if (a === -2) return '𝄫';
    return a > 0 ? '♯'.repeat(a) : '♭'.repeat(-a);
  }
  function spell(letter, pc) {
    return LETTERS[letter] + accText(signed(mod(pc - LETTER_PC[letter])));
  }

  // ---- Keys ----
  function makeKey(pc, mode) {
    pc = mod(pc);
    const letter = LETTERS.indexOf(TONICS[mode][pc][0]);
    return { pc, mode, letter, scale: SCALES[mode], name: spell(letter, pc) };
  }
  function tonicNames(mode) {
    return TONICS[mode].map((_, pc) => makeKey(pc, mode).name);
  }
  function keySignature(key) {
    let total = 0;
    key.scale.forEach((iv, d) => {
      total += signed(mod(key.pc + iv - LETTER_PC[(key.letter + d) % 7]));
    });
    if (!total) return 'no sharps or flats';
    const n = Math.abs(total);
    return `${n} ${total > 0 ? 'sharp' : 'flat'}${n > 1 ? 's' : ''}`;
  }
  function scaleNames(key) {
    return key.scale.map((iv, d) => spell((key.letter + d) % 7, key.pc + iv));
  }

  // ---- Chord definitions (relative to the tonic) ----
  function fromScale(scale, deg) {
    const at = n => scale[n % 7] + 12 * Math.floor(n / 7);
    const r = at(deg);
    return { deg, root: r, third: at(deg + 2) - r, fifth: at(deg + 4) - r, seventh: at(deg + 6) - r };
  }
  const chord = (id, deg, scale, props) => ({ id, src: 'diatonic', ...fromScale(scale, deg), ...props });
  const secondary = (id, target, scale, targetLabel, props) => ({
    id, src: 'secondary', deg: (target + 4) % 7, root: mod(scale[target] + 7),
    third: 4, fifth: 7, seventh: 10, target: targetLabel, func: 'D', color: 'dom', ...props,
  });

  const { major: MAJ, minor: MIN, harmonic: HARM, dorian: DOR } = SCALES;
  const DEFS = {
    major: [
      chord('d0', 0, MAJ, { func: 'T', color: 'tonic', tension: 5, next: ['d3', 'd4', 'd5', 'd1'] }),
      chord('d1', 1, MAJ, { func: 'S', color: 'sub', tension: 48, next: ['d4', 'd6'] }),
      chord('d2', 2, MAJ, { func: 'T', color: 'tonic', tension: 32, next: ['d5', 'd3'] }),
      chord('d3', 3, MAJ, { func: 'S', color: 'sub', tension: 40, next: ['d4', 'd0', 'd1'] }),
      chord('d4', 4, MAJ, { func: 'D', color: 'dom', tension: 78, next: ['d0', 'd5'] }),
      chord('d5', 5, MAJ, { func: 'T', color: 'tonic', tension: 22, next: ['d1', 'd3', 'd4'] }),
      chord('d6', 6, MAJ, { func: 'D', color: 'dom', tension: 88, next: ['d0'] }),
      chord('iv', 3, MIN, { src: 'borrowed', func: 'S', color: 'chrom', tension: 52, tag: 'borrowed', next: ['d0', 'd4'] }),
      chord('bVI', 5, MIN, { src: 'borrowed', func: 'S', color: 'chrom', tension: 46, tag: 'borrowed', next: ['bVII', 'd4', 'd0'] }),
      chord('bVII', 6, MIN, { src: 'borrowed', func: 'D', color: 'chrom', tension: 56, tag: 'borrowed', next: ['d0', 'd3'] }),
      chord('bIII', 2, MIN, { src: 'borrowed', func: 'T', color: 'chrom', tension: 36, tag: 'borrowed', next: ['bVI', 'd3'] }),
      secondary('VV', 4, MAJ, 'V', { targetId: 'd4', tension: 68, tag: 'V of V', next: ['d4'] }),
      secondary('Vvi', 5, MAJ, 'vi', { targetId: 'd5', tension: 72, tag: 'V of vi', next: ['d5'] }),
      secondary('Vii', 1, MAJ, 'ii', { targetId: 'd1', tension: 62, tag: 'V of ii', next: ['d1'] }),
      secondary('VIV', 3, MAJ, 'IV', { targetId: 'd3', tension: 56, tag: 'V of IV', next: ['d3'] }),
    ],
    minor: [
      chord('d0', 0, MIN, { func: 'T', color: 'tonic', tension: 5, next: ['d3', 'd5', 'd6', 'hV'] }),
      chord('d1', 1, MIN, { func: 'S', color: 'sub', tension: 60, next: ['hV', 'd4'] }),
      chord('d2', 2, MIN, { func: 'T', color: 'tonic', tension: 26, next: ['d5', 'd3'] }),
      chord('d3', 3, MIN, { func: 'S', color: 'sub', tension: 45, next: ['hV', 'd0', 'd6'] }),
      chord('d4', 4, MIN, { func: 'D', color: 'dom', tension: 55, next: ['d0', 'd5'] }),
      chord('d5', 5, MIN, { func: 'T', color: 'tonic', tension: 32, next: ['d3', 'd1', 'd6', 'hV'] }),
      chord('d6', 6, MIN, { func: 'D', color: 'dom', tension: 56, next: ['d2', 'd0'] }),
      chord('hV', 4, HARM, { src: 'harmonic', func: 'D', color: 'dom', tension: 84, tag: 'harmonic minor', next: ['d0', 'd5'] }),
      chord('hvii', 6, HARM, { src: 'harmonic', func: 'D', color: 'dom', tension: 90, tag: 'harmonic minor', next: ['d0'] }),
      chord('dIV', 3, DOR, { src: 'borrowed', func: 'S', color: 'chrom', tension: 44, tag: 'Dorian IV', next: ['d0', 'hV'] }),
      chord('pI', 0, MAJ, { src: 'borrowed', func: 'T', color: 'chrom', tension: 8, tag: 'Picardy', next: ['d3', 'dIV'] }),
      { id: 'N', src: 'chromatic', deg: 1, root: 1, third: 4, fifth: 7, seventh: 11, func: 'S', color: 'chrom', tension: 58, tag: 'Neapolitan', next: ['hV'] },
      secondary('VV', 4, MIN, 'V', { targetId: 'hV', tension: 70, tag: 'V of V', next: ['hV'] }),
    ],
  };
  const BY_ID = {
    major: Object.fromEntries(DEFS.major.map(d => [d.id, d])),
    minor: Object.fromEntries(DEFS.minor.map(d => [d.id, d])),
  };

  // Move a chord into the other mode. Diatonic chords keep their degree; chromatic ones keep their sound.
  function convert(inst, mode) {
    if (BY_ID[mode][inst.id]) return inst;
    const old = BY_ID[mode === 'major' ? 'minor' : 'major'][inst.id];
    if (!old) return { ...inst, id: 'd0' };
    const same = DEFS[mode].find(d => d.root === old.root && d.third === old.third && d.fifth === old.fifth);
    return { ...inst, id: same ? same.id : 'd' + old.deg };
  }

  // ---- Chord color (extensions) ----
  const quality = (t, f) => (t === 4 && f === 8 ? 'aug' : t === 4 ? 'maj' : f === 6 ? 'dim' : 'min');
  const SEVENTHS = { maj7: 11, b7: 10, dim7: 9 };
  const EXT_TENSION = { triad: 0, maj7: 4, b7: 10, dim7: 10, six: 2, add9: 4, nine: 9, sus2: 6, sus4: 14 };
  const INV_TENSION = [0, 4, 10, 8];

  function extOptions(d) {
    const q = quality(d.third, d.fifth);
    if (q === 'dim') return ['triad', 'b7', 'dim7'];
    if (q === 'aug') return ['triad', 'b7', 'maj7'];
    return ['triad', q === 'maj' ? 'maj7' : null, 'b7', 'six', 'add9', 'nine', 'sus2', 'sus4'].filter(Boolean);
  }
  function natural7(d) {
    return d.seventh === 11 ? 'maj7' : d.seventh === 9 ? 'dim7' : 'b7';
  }
  const invCount = ext => (ext in SEVENTHS || ext === 'six' ? 4 : 3);

  function tones(d, ext) {
    const t = [{ iv: 0, step: 0, role: 'R' }];
    if (ext === 'sus2') t.push({ iv: 2, step: 1, role: '2' });
    else if (ext === 'sus4') t.push({ iv: 5, step: 3, role: '4' });
    else t.push({ iv: d.third, step: 2, role: '3' });
    t.push({ iv: d.fifth, step: 4, role: '5' });
    const sev = ext in SEVENTHS ? SEVENTHS[ext] : ext === 'nine' ? d.seventh : null;
    if (sev != null) t.push({ iv: sev, step: 6, role: '7' });
    if (ext === 'six') t.push({ iv: 9, step: 5, role: '6' });
    if (ext === 'add9' || ext === 'nine') t.push({ iv: 14, step: 1, role: '9' });
    return t;
  }

  function suffix(d, ext) {
    const q = quality(d.third, d.fifth);
    const tri = { maj: '', min: 'm', dim: '°', aug: '+' }[q];
    switch (ext) {
      case 'maj7': return q === 'aug' ? '+maj7' : 'maj7';
      case 'b7': return { maj: '7', min: 'm7', dim: 'ø7', aug: '+7' }[q];
      case 'dim7': return '°7';
      case 'six': return tri + '6';
      case 'add9': return q === 'min' ? 'm(add9)' : 'add9';
      case 'nine': return q === 'min' ? 'm9' : d.seventh === 11 ? 'maj9' : '9';
      case 'sus2': return 'sus2';
      case 'sus4': return 'sus4';
      default: return tri;
    }
  }

  // ---- Roman numerals ----
  function numeral(d, ext, inv, key) {
    const q = quality(d.third, d.fifth);
    let base = 'V', acc = '';
    if (d.src !== 'secondary') {
      base = ROMAN[d.deg];
      if (d.src !== 'harmonic') acc = accText(signed(mod(d.root - key.scale[d.deg])));
      if (q === 'min' || q === 'dim') base = base.toLowerCase();
    }
    const qual = q === 'dim' ? (ext === 'b7' ? 'ø' : '°') : q === 'aug' ? '+' : '';
    let text = '', fig = [];
    if (ext in SEVENTHS) {
      fig = [['7'], ['6', '5'], ['4', '3'], ['4', '2']][inv];
      if (ext === 'maj7' && q !== 'aug') text = 'maj';
    } else if (ext === 'triad') {
      fig = [[], ['6'], ['6', '4']][inv];
    } else {
      text = { six: '6', add9: 'add9', nine: '9', sus2: 'sus2', sus4: 'sus4' }[ext];
    }
    return { acc, base, qual, text, fig, target: d.target || '' };
  }
  function numeralHTML(n) {
    const sup = n.qual || n.text ? `<sup>${n.qual}${n.text}</sup>` : '';
    const fig = n.fig.length ? `<span class="fig">${n.fig.map(x => `<span>${x}</span>`).join('')}</span>` : '';
    const acc = n.acc ? `<span class="rn-acc">${n.acc}</span>` : '';
    const target = n.target ? `<span class="rn-target">/${n.target}</span>` : '';
    return `<span class="rn">${acc}${n.base}${sup}${fig}${target}</span>`;
  }
  function numeralText(n) {
    return n.acc + n.base + n.qual + n.text + n.fig.join('/') + (n.target ? '/' + n.target : '');
  }

  // ---- Resolve a progression slot into a playable, labelled chord ----
  function resolve(inst, key) {
    const d = BY_ID[key.mode][inst.id] || BY_ID[key.mode].d0;
    const opts = extOptions(d);
    let ext = inst.ext || 'triad';
    if (!opts.includes(ext)) ext = ext in SEVENTHS && opts.includes(natural7(d)) ? natural7(d) : 'triad';
    const inv = Math.min(inst.inv || 0, invCount(ext) - 1);
    const rootLetter = (key.letter + d.deg) % 7;
    const rootPc = mod(key.pc + d.root);
    const ts = tones(d, ext).map(t => {
      const pc = mod(rootPc + t.iv);
      return { ...t, pc, name: spell((rootLetter + t.step) % 7, pc) };
    });
    const bass = ts[inv];
    const q = quality(d.third, d.fifth);
    const extT = ext === 'b7' && q === 'min' ? 5 : EXT_TENSION[ext];
    const num = numeral(d, ext, inv, key);
    return {
      inst, def: d, ext, inv, quality: q, tones: ts, bass, rootPc,
      name: ts[0].name + suffix(d, ext) + (inv ? '/' + bass.name : ''),
      num, html: numeralHTML(num), text: numeralText(num),
      func: d.func, color: d.color,
      tension: Math.max(0, Math.min(100, d.tension + extT + INV_TENSION[inv])),
    };
  }

  // ---- Voicing ----
  const bassStart = pc => 40 + mod(pc - 4);
  function nearestPc(pc, target, lo, hi) {
    let best = null;
    for (let m = lo; m <= hi; m++) {
      if (mod(m) === pc && (best === null || Math.abs(m - target) < Math.abs(best - target))) best = m;
    }
    return best;
  }
  const avg = a => a.reduce((s, x) => s + x, 0) / a.length;

  function motion(a, b) {
    if (a.length === b.length) return a.reduce((s, x, i) => s + Math.abs(x - b[i]), 0);
    const near = (x, arr) => Math.min(...arr.map(y => Math.abs(x - y)));
    return b.reduce((s, x) => s + near(x, a), 0) + 0.5 * a.reduce((s, x) => s + near(x, b), 0);
  }

  function blockVoicing(c) {
    const rot = c.tones.slice(c.inv).concat(c.tones.slice(0, c.inv));
    const upper = [];
    rot.forEach((t, i) => {
      if (i === 0) { upper.push(60 + t.pc); return; }
      let n = upper[i - 1] + 1;
      while (mod(n) !== t.pc) n++;
      upper.push(n);
    });
    return { bass: bassStart(c.bass.pc), upper };
  }

  function smoothVoicing(c, prev) {
    const bass = prev ? nearestPc(c.bass.pc, prev.bass, 36, 52) : bassStart(c.bass.pc);
    let ts = c.tones;
    if (ts.length > 4) ts = ts.filter(t => t.role !== '5');
    const lo = Math.max(bass + 3, 53), hi = 81;
    const options = ts.map(t => {
      const a = [];
      for (let m = lo; m <= hi; m++) if (mod(m) === t.pc) a.push(m);
      return a;
    });
    let best = null, bestCost = Infinity;
    const pick = (i, acc) => {
      if (i === options.length) {
        const s = [...acc].sort((x, y) => x - y);
        const span = s[s.length - 1] - s[0];
        if (span > 17 || s.some((x, k) => k && x === s[k - 1])) return;
        const cost = prev
          ? motion(prev.upper, s) + 0.25 * Math.abs(avg(s) - 67) + 0.05 * span
          : Math.abs(avg(s) - 66) + 0.4 * span;
        if (cost < bestCost) { bestCost = cost; best = s; }
        return;
      }
      for (const m of options[i]) { acc.push(m); pick(i + 1, acc); acc.pop(); }
    };
    pick(0, []);
    return { bass, upper: best || blockVoicing(c).upper };
  }

  function voice(chords, style) {
    const out = [];
    let prev = null;
    for (const c of chords) {
      const v = style === 'block' ? blockVoicing(c) : smoothVoicing(c, prev);
      out.push(v);
      prev = v;
    }
    return out;
  }

  // Pair each note with where it goes next, for drawing voice-leading lines.
  function links(a, b) {
    if (a.length === b.length) return a.map((x, i) => [x, b[i]]);
    const closest = (x, arr) => arr.reduce((p, q) => (Math.abs(q - x) < Math.abs(p - x) ? q : p));
    const pairs = b.map(y => [closest(y, a), y]);
    a.forEach(x => { if (!pairs.some(p => p[0] === x)) pairs.push([x, closest(x, b)]); });
    return pairs;
  }
  function motionStats(voicings) {
    let total = 0, held = 0, leaps = 0;
    for (let i = 1; i < voicings.length; i++) {
      links(voicings[i - 1].upper, voicings[i].upper).forEach(([x, y]) => {
        const d = Math.abs(x - y);
        total += d;
        if (d === 0) held++;
        if (d > 2) leaps++;
      });
    }
    return { total, held, leaps };
  }

  return {
    LETTERS, SCALES, DEFS, BY_ID, mod, spell,
    makeKey, tonicNames, keySignature, scaleNames, convert,
    quality, extOptions, natural7, invCount, suffix, resolve,
    voice, links, motionStats,
  };
})();
