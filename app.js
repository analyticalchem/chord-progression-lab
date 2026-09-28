/* Progression Lab: app state and UI wiring. */
(() => {
  'use strict';
  const $ = s => document.querySelector(s);
  const $$ = s => document.querySelectorAll(s);
  const esc = Views.esc;
  const setText = Chrome.setText;
  const pick = a => a[Math.floor(Math.random() * a.length)];
  const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
  const FUNC = {
    T: { name: 'Tonic', say: 'Home. It sounds stable and finished.' },
    S: { name: 'Predominant', say: 'Moves away from home and sets up the dominant.' },
    D: { name: 'Dominant', say: 'Builds tension that wants to resolve to the tonic.' },
  };
  const ROLE = { R: 'root', 2: '2nd', 3: '3rd', 4: '4th', 5: '5th', 6: '6th', 7: '7th', 9: '9th' };
  const PATTERNS = ['sustain', 'pulse', 'arpeggio', 'oompah'];
  const TABS = ['library', 'cadences', 'quiz'];

  let uidN = 0;
  const withUid = i => ({ ...i, uid: ++uidN });
  const state = {
    tonic: 0, mode: 'major', prog: toInsts(PRESETS[0].prog).map(withUid),
    selected: null, current: -1, pulse: -1, playing: false, preview: null,
    tempo: 92, meter: '4/4', pattern: 'sustain', volume: 80, voicing: 'smooth', loop: true, tab: 'library',
    bassLevel: 100, bassOctave: false, circleClick: 'key',
  };
  let D = {}; // derived: key, chords, voicings
  const meter = () => meterById(state.meter);

  // ---------- Persistence (this page genuinely needs to remember the progression) ----------
  const STORE = 'chord-progression-lab-settings', OLD_STORE = 'progression-lab-v1';
  const SAVED = ['tonic', 'mode', 'tempo', 'meter', 'pattern', 'volume', 'voicing', 'loop', 'tab', 'bassLevel', 'bassOctave', 'circleClick'];
  function save() {
    try {
      const s = {};
      SAVED.forEach(k => { s[k] = state[k]; });
      s.prog = state.prog.map(({ id, ext, inv }) => [id, ext, inv]);
      localStorage.setItem(STORE, JSON.stringify(s));
    } catch (e) { /* storage unavailable */ }
  }
  function restore() {
    try {
      const s = JSON.parse(localStorage.getItem(STORE) || localStorage.getItem(OLD_STORE) || 'null');
      if (!s || typeof s !== 'object') return;
      const num = (v, lo, hi, d) => (Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d);
      const waltz = s.style === 'waltz'; // older versions had a single "Waltz" rhythm
      state.tonic = num(s.tonic, 0, 11, 0);
      state.mode = s.mode === 'minor' ? 'minor' : 'major';
      state.tempo = num(s.tempo, 40, 180, 92);
      state.meter = METERS.some(m => m.id === s.meter) ? s.meter : waltz ? '3/4' : '4/4';
      state.pattern = PATTERNS.includes(s.pattern) ? s.pattern : waltz ? 'oompah' : PATTERNS.includes(s.style) ? s.style : 'sustain';
      state.volume = num(s.volume, 0, 100, 80);
      state.voicing = s.voicing === 'block' ? 'block' : 'smooth';
      state.loop = s.loop !== false;
      state.tab = TABS.includes(s.tab) ? s.tab : 'library';
      state.bassLevel = num(s.bassLevel, 0, 200, 100);
      state.bassOctave = !!s.bassOctave;
      state.circleClick = s.circleClick === 'play' ? 'play' : 'key';
      if (Array.isArray(s.prog)) state.prog = toInsts(s.prog).filter(i => Theory.BY_ID[state.mode][i.id]).slice(0, 16).map(withUid);
    } catch (e) { /* ignore bad data */ }
  }

  // ---------- Derived data ----------
  function compute() {
    const key = Theory.makeKey(state.tonic, state.mode);
    const chords = state.prog.map(i => Theory.resolve(i, key));
    D = { key, chords, voicings: Theory.voice(chords, state.voicing) };
  }
  const indexOf = uid => state.prog.findIndex(i => i.uid === uid);
  const focusIndex = () => {
    if (state.playing && state.current >= 0) return state.current;
    const s = indexOf(state.selected);
    return s >= 0 ? s : state.prog.length ? 0 : -1;
  };
  // Scientific pitch name for a spelled note (B♯3 sounds as C4, so the octave follows the letter).
  function sciName(name, midi) {
    const natural = [0, 2, 4, 5, 7, 9, 11][Theory.LETTERS.indexOf(name[0])];
    let alter = Theory.mod(midi - natural);
    if (alter > 6) alter -= 12;
    return name + (Math.floor((midi - alter) / 12) - 1);
  }

  // Re-rendering replaces elements, so focus is carried across by each control's data-focus key.
  let pendingFocus = null;
  function update() {
    const active = document.activeElement;
    const fk = pendingFocus || (active && active.dataset ? active.dataset.focus : null);
    pendingFocus = null;
    compute();
    save();
    renderTransport();
    renderBeats();
    renderTimeline();
    renderPalette();
    renderInspector();
    renderViews();
    renderTabs();
    if (fk) {
      const el = document.querySelector(`[data-focus="${fk}"]`);
      if (el && el !== document.activeElement) el.focus({ preventScroll: true });
    }
  }
  function renderViews() {
    renderPiano();
    renderCircle();
    renderVoiceLeading();
    renderTension();
  }

  // ---------- Transport ----------
  let tonicOptions = '';
  function pressed(sel, test) {
    $$(sel).forEach(b => b.setAttribute('aria-pressed', String(test(b))));
  }
  function renderTransport() {
    const options = Theory.tonicNames(state.mode).map((n, pc) => `<option value="${pc}">${n}</option>`).join('');
    if (options !== tonicOptions) { $('#tonic').innerHTML = options; tonicOptions = options; }
    $('#tonic').value = String(state.tonic);
    pressed('[data-mode]', b => b.dataset.mode === state.mode);
    pressed('[data-voicing]', b => b.dataset.voicing === state.voicing);
    const m = meter();
    $('#tempo').value = state.tempo;
    setText($('#tempoOut'), `${m.beatNote} = ${state.tempo} BPM`);
    setText($('#beatNoteName'), m.perBeat === 3 ? 'dotted quarter notes' : 'quarter notes');
    $('#meter').value = state.meter;
    setText($('#meterKind'), m.kind);
    setText($('#meterDesc'), m.desc);
    $('#pattern').value = state.pattern;
    $('#volume').value = state.volume;
    setText($('#volumeOut'), `${state.volume}%`);
    $('#bassLevel').value = state.bassLevel;
    setText($('#bassOut'), `${state.bassLevel}%`);
    $('#bassOct').checked = state.bassOctave;
    $('#loop').checked = state.loop;
    renderPlayButton();
    setText($('#keyName'), `${D.key.name} ${state.mode}`);
    setText($('#keySig'), cap(Theory.keySignature(D.key)));
    setText($('#scale'), Theory.scaleNames(D.key).join(' '));
  }
  // The main button stops any sound that is playing (a preview, a quiz clip, or the progression).
  function renderPlayButton() {
    const busy = Sound.isPlaying();
    $('#play').classList.toggle('on', busy);
    setText($('#play span'), busy ? 'Stop' : 'Play');
  }

  function play() {
    if (!state.prog.length) return;
    state.preview = null;
    state.playing = true;
    Sound.start({
      getBars: () => D.voicings,
      tempo: () => state.tempo, meter, pattern: () => state.pattern, loop: () => state.loop,
      onChord: i => highlight(i),
      onPulse: k => lightPulse(k),
      onEnd: () => { state.playing = false; state.current = -1; update(); },
    });
    renderTabs();
  }
  function stop() {
    Sound.stop();
    state.playing = false;
    state.current = -1;
    state.preview = null;
    update();
  }
  function stopMain() {
    if (state.playing) stop();
    else { Sound.stop(); state.preview = null; renderTabs(); }
  }
  function highlight(i) {
    state.current = i;
    $$('.slot[data-uid]').forEach((el, k) => el.classList.toggle('playing', k === i));
    renderViews();
  }

  function setKey(pc, mode) {
    if (mode && mode !== state.mode) {
      // A chord's own diatonic 7th stays diatonic in the new mode (vi7 in major becomes VImaj7 in minor)
      state.prog = state.prog.map(i => {
        const next = Theory.convert(i, mode);
        const was = Theory.BY_ID[state.mode][i.id];
        if (was && i.ext === Theory.natural7(was)) next.ext = Theory.natural7(Theory.BY_ID[mode][next.id]);
        return next;
      });
      state.mode = mode;
    }
    state.tonic = Theory.mod(pc);
    update();
  }

  // ---------- Beat strip ----------
  function renderBeats() {
    const m = meter(), counts = meterCounts(m);
    setText($('#beatMeter'), m.id);
    setText($('#beatCount'), `${m.kind}. Count: ${counts.map(c => c.text).join(' ')}`);
    const ol = $('#beats');
    if (ol.dataset.meter !== m.id) {
      ol.dataset.meter = m.id;
      let k = 0;
      ol.innerHTML = m.beats.map((n, b) => `<li class="beat-group">${Array.from({ length: n }, (_, j) => {
        const c = counts[k++];
        const strong = j === 0 && (b === 0 || m.strong.includes(b));
        return `<span class="pulse${j === 0 ? ' start' : ''}${strong ? ' strong' : ''}"><i></i><b>${c.text}</b></span>`;
      }).join('')}</li>`).join('');
    }
    lightPulse(state.playing ? state.pulse : -1);
  }
  function lightPulse(k) {
    state.pulse = k;
    $$('#beats .pulse').forEach((p, i) => p.classList.toggle('now', i === k));
  }

  // ---------- Timeline ----------
  function renderTimeline() {
    const items = D.chords.map((c, i) => {
      const inst = state.prog[i], sel = inst.uid === state.selected;
      const tag = c.def.tag || FUNC[c.func].name;
      return `<li class="slot fn-${c.color}${sel ? ' sel' : ''}${state.playing && i === state.current ? ' playing' : ''}" data-uid="${inst.uid}" draggable="true">
        <button type="button" class="slot-main" data-focus="slot-${inst.uid}" aria-pressed="${sel}">
          <span class="slot-bar">Bar ${i + 1}</span>
          <span class="slot-rn">${c.html}</span>
          <span class="slot-name">${esc(c.name)}</span>
          <span class="slot-tag">${esc(tag)}</span>
          <span class="slot-t">Tension ${c.tension}</span>
          <span class="slot-meter" aria-hidden="true"><span style="width:${c.tension}%"></span></span>
        </button>
        <button type="button" class="slot-x" data-del="${inst.uid}" aria-label="Remove bar ${i + 1}" title="Remove bar ${i + 1}">×</button>
      </li>`;
    }).join('');
    const addLabel = state.prog.length ? (state.prog.length >= 16 ? '16 bars is the limit' : 'Drop a chord here') : 'Add chords from below';
    $('#timeline').innerHTML = items + `<li class="slot add" data-add="1"><span aria-hidden="true">+</span>${addLabel}</li>`;
    setText($('#count'), `${state.prog.length} bar${state.prog.length === 1 ? '' : 's'}`);
  }

  function addChord(id) {
    if (state.prog.length >= 16) return;
    const inst = withUid({ id, ext: 'triad', inv: 0 });
    state.prog.push(inst);
    state.selected = inst.uid;
    compute();
    Sound.playChord(Theory.voice([Theory.resolve(inst, D.key)], 'smooth')[0]);
    update();
  }
  function removeChord(uid) {
    const i = indexOf(uid);
    if (i < 0) return;
    const wasFocused = document.activeElement && document.activeElement.closest && document.activeElement.closest('.timeline, .inspector');
    state.prog.splice(i, 1);
    const next = state.prog[Math.min(i, state.prog.length - 1)];
    if (state.selected === uid) state.selected = next ? next.uid : null;
    if (wasFocused) pendingFocus = next ? `slot-${next.uid}` : 'pal-d0';
    update();
  }
  function moveChord(uid, to) {
    const from = indexOf(uid);
    if (from < 0) return;
    const [inst] = state.prog.splice(from, 1);
    state.prog.splice(Math.max(0, Math.min(to, state.prog.length)), 0, inst);
    update();
  }
  function selectChord(uid) {
    state.selected = uid;
    const i = indexOf(uid);
    if (i >= 0 && !state.playing) Sound.playChord(D.voicings[i]);
    update();
  }

  // ---------- Palette ----------
  function renderPalette() {
    const ref = D.chords[D.chords.length - 1];
    const likely = ref ? ref.def.next : [];
    const chip = d => {
      const c = Theory.resolve({ id: d.id }, D.key);
      return `<button type="button" class="pal-chord fn-${c.color}" data-id="${d.id}" data-focus="pal-${d.id}" draggable="true">
        <span class="pal-rn">${c.html}</span><span class="pal-name">${esc(c.name)}</span>
        ${d.tag ? `<span class="pal-tag">${esc(d.tag)}</span>` : ''}${likely.includes(d.id) ? '<span class="pal-next">often next</span>' : ''}</button>`;
    };
    const defs = Theory.DEFS[state.mode];
    $('#palDiatonic').innerHTML = defs.filter(d => d.src === 'diatonic').map(chip).join('');
    $('#palExtra').innerHTML = defs.filter(d => d.src !== 'diatonic').map(chip).join('');
    setText($('#palHint'), ref
      ? `Click a chord to add it to the end, or drag it onto a bar to replace that bar. "Often next" marks chords that commonly follow ${ref.text}.`
      : 'Click a chord to add it to the progression.');
  }

  // ---------- Inspector (chord, color, inversion) ----------
  function describe(c, key) {
    const d = c.def;
    if (d.src === 'secondary') {
      const t = Theory.resolve({ id: d.targetId }, key);
      return `The V chord of ${t.name}. For a moment ${t.name} sounds like home, so this chord pulls toward it.`;
    }
    if (d.id === 'N') return 'A major chord on the lowered 2nd degree. It works as a predominant and usually moves to V.';
    if (d.id === 'pI') return 'A major tonic in a minor key, called a Picardy third. It brightens a final cadence.';
    if (d.id === 'dIV') return `Borrowed from ${key.name} Dorian. The raised 6th makes iv major.`;
    if (d.src === 'harmonic') {
      const lt = Theory.spell((key.letter + 6) % 7, key.pc + 11);
      return `Uses the raised 7th from harmonic minor (${lt}), which pulls up by a half step to ${key.name}.`;
    }
    if (d.src === 'borrowed') return `Borrowed from ${key.name} minor. The function stays the same and the color turns darker.`;
    return FUNC[c.func].say;
  }

  function renderInspector() {
    const i = indexOf(state.selected);
    const all = [['triad', 'Triads'], ['seventh', 'Diatonic 7ths'], ['nine', 'Add 9ths'], ['sus', 'Sus4 on dominants']]
      .map(([k, label]) => `<button type="button" class="chip" data-all="${k}" data-focus="all-${k}">${label}</button>`).join('');
    const applyAll = `<div class="insp-row"><span class="lbl" id="lbl-all">Every bar</span><div class="presets" role="group" aria-labelledby="lbl-all">${all}</div></div>`;
    if (i < 0) {
      $('#inspector').innerHTML = `<p class="insp-empty">Select a bar in your progression to change its chord, color and inversion.</p>${applyAll}`;
      return;
    }
    const c = D.chords[i], inst = state.prog[i];
    const exts = Theory.extOptions(c.def).map(e => {
      const label = c.tones[0].name + Theory.suffix(c.def, e);
      return `<button type="button" class="chip mono" data-ext="${e}" data-focus="ext-${e}" aria-pressed="${c.ext === e}">${esc(label)}</button>`;
    }).join('');
    const invs = Array.from({ length: Theory.invCount(c.ext) }, (_, k) => {
      const label = ['Root', '1st', '2nd', '3rd'][k];
      return `<button type="button" class="chip" data-inv="${k}" data-focus="inv-${k}" aria-pressed="${c.inv === k}">${label}, <em>${esc(c.tones[k].name)}</em> in bass</button>`;
    }).join('');
    const options = Theory.DEFS[state.mode].map(d => {
      const r = Theory.resolve({ id: d.id }, D.key);
      return `<option value="${d.id}"${d.id === inst.id ? ' selected' : ''}>${esc(r.text)}, ${esc(r.name)}</option>`;
    }).join('');
    $('#inspector').innerHTML = `
      <div class="insp-head fn-${c.color}">
        <div class="insp-rn">${c.html}</div>
        <div class="insp-meta">
          <div class="insp-name">${esc(c.name)} <span class="insp-bar">bar ${i + 1}</span></div>
          <div class="insp-tags"><span class="fn-pill"><span class="akey" aria-hidden="true"></span>${FUNC[c.func].name}</span>
            ${c.def.tag ? `<span>${esc(cap(c.def.tag))}</span>` : ''}<span>Tension ${c.tension}</span></div>
        </div>
      </div>
      <p class="insp-say">${esc(describe(c, D.key))}</p>
      <ul class="insp-notes" aria-label="Chord tones">${c.tones.map(t => `<li><small>${ROLE[t.role]}</small>${esc(t.name)}</li>`).join('')}</ul>
      <div class="insp-row"><label class="lbl" for="inspChord">Chord</label><div><select id="inspChord" data-focus="inspChord">${options}</select></div></div>
      <div class="insp-row"><span class="lbl" id="lbl-color">Color</span><div class="presets" role="group" aria-labelledby="lbl-color">${exts}</div></div>
      <div class="insp-row"><span class="lbl" id="lbl-inv">Inversion</span><div class="presets" role="group" aria-labelledby="lbl-inv">${invs}</div></div>
      <div class="insp-row"><span class="lbl" id="lbl-bar">Bar</span><div class="presets" role="group" aria-labelledby="lbl-bar">
        <button type="button" class="chip" data-act="left" data-focus="act-left" ${i === 0 ? 'disabled title="Already the first bar"' : ''}>Move left</button>
        <button type="button" class="chip" data-act="right" data-focus="act-right" ${i === state.prog.length - 1 ? 'disabled title="Already the last bar"' : ''}>Move right</button>
        <button type="button" class="chip" data-act="dup" data-focus="act-dup" ${state.prog.length >= 16 ? 'disabled title="16 bars is the limit"' : ''}>Duplicate</button>
        <button type="button" class="chip" data-act="del" data-focus="act-del">Remove</button></div></div>
      ${applyAll}`;
  }

  function applyAll(kind) {
    state.prog = state.prog.map(inst => {
      const d = Theory.BY_ID[state.mode][inst.id];
      const q = Theory.quality(d.third, d.fifth);
      if (kind === 'triad') return { ...inst, ext: 'triad', inv: 0 };
      if (kind === 'seventh') return { ...inst, ext: Theory.natural7(d) };
      if (kind === 'nine') return { ...inst, ext: q === 'maj' || q === 'min' ? 'nine' : Theory.natural7(d) };
      if (kind === 'sus') return d.func === 'D' && q === 'maj' ? { ...inst, ext: 'sus4', inv: 0 } : inst;
      return inst;
    });
    update();
  }

  // ---------- Views ----------
  let piano;
  const toneName = (c, m) => (c.tones.find(t => t.pc === m % 12) || {}).name || '';
  function renderPiano() {
    const i = focusIndex();
    if (i < 0) { piano.show([]); setText($('#pianoNow'), 'No chord selected'); return; }
    const c = D.chords[i], v = D.voicings[i];
    piano.show([{ midi: v.bass, role: 'bass', name: toneName(c, v.bass), color: c.color },
      ...v.upper.map(m => ({ midi: m, role: 'upper', name: toneName(c, m), color: c.color }))]);
    setText($('#pianoNow'), `${state.playing ? 'Playing bar' : 'Bar'} ${i + 1}: ${c.name}, bass ${sciName(toneName(c, v.bass), v.bass)}`);
  }

  function renderCircle() {
    const key = D.key;
    const numerals = (pc, q) => {
      const d = Theory.DEFS[state.mode].find(x => x.src === 'diatonic' && Theory.mod(key.pc + x.root) === pc
        && Theory.quality(x.third, x.fifth) === q);
      return d ? Theory.resolve({ id: d.id }, key).text : '';
    };
    Views.circle($('#circle'), { key, chords: D.chords, current: state.playing ? state.current : -1, numerals, onPick: pickCircle });
    pressed('[data-cof]', b => b.dataset.cof === state.circleClick);
    const clickHelp = state.circleClick === 'key'
      ? 'Click any wedge to hear its chord and move the key there.'
      : 'Click any wedge to hear its chord. The key stays where it is.';
    const m = Views.rootMotion(D.chords);
    const parts = [[m.fall5, 'falling fifth', 'falling fifths'], [m.rise5, 'rising fifth', 'rising fifths'],
      [m.step, 'step', 'steps'], [m.third, 'third or tritone', 'thirds or tritones'], [m.same, 'repeat', 'repeats']]
      .filter(p => p[0]).map(p => `<span><strong>${p[0]}</strong> ${p[0] === 1 ? p[1] : p[2]}</span>`).join('');
    $('#circleStats').innerHTML = D.chords.length > 1
      ? `<div class="stat-row">${parts}</div><p>Falling fifths (like V→I) move counter-clockwise and give the strongest sense of arrival. ${clickHelp}</p>`
      : `<p>Add a few chords to see their roots drawn on the circle. ${clickHelp}</p>`;
  }

  // A wedge click always sounds that wedge's triad; in "key" mode it also moves the key there.
  function pickCircle(pc, mode, viaKeyboard) {
    const chord = Theory.resolve({ id: 'd0' }, Theory.makeKey(pc, mode));
    Sound.playChord(Theory.voice([chord], 'smooth')[0]);
    if (state.circleClick === 'key') setKey(pc, mode);
    const seg = $(`#circle .cof-seg[data-pc="${pc}"][data-mode="${mode}"]`);
    if (seg) {
      seg.classList.add('flash');
      setTimeout(() => seg.classList.remove('flash'), 350);
      // Keep keyboard users on the wedge after the circle redraws; mouse clicks leave focus alone.
      if (viaKeyboard) seg.focus({ preventScroll: true });
    }
  }

  function renderVoiceLeading() {
    Views.voiceLeading($('#vl'), { chords: D.chords, voicings: D.voicings, current: state.playing ? state.current : -1, noteName: (i, m) => toneName(D.chords[i], m) });
    $('#vlTable tbody').innerHTML = D.chords.map((c, i) => {
      const v = D.voicings[i];
      const nm = m => esc(sciName(toneName(c, m), m));
      let move = '—', held = '—';
      if (i > 0) {
        const pairs = Theory.links(D.voicings[i - 1].upper, v.upper);
        move = pairs.reduce((s, [a, b]) => s + Math.abs(a - b), 0);
        held = pairs.filter(([a, b]) => a === b).length;
      }
      return `<tr><td>${i + 1}</td><td>${esc(c.text)}, ${esc(c.name)}</td><td class="notes-cell">${nm(v.bass)}</td>
        <td class="notes-cell">${v.upper.map(nm).join(', ')}</td><td class="num">${move}</td><td class="num">${held}</td></tr>`;
    }).join('');
    if (D.chords.length < 2) { $('#vlStats').innerHTML = '<p class="stat-row">Add at least two chords to see how the voices move.</p>'; return; }
    const smooth = Theory.motionStats(Theory.voice(D.chords, 'smooth'));
    const block = Theory.motionStats(Theory.voice(D.chords, 'block'));
    const now = state.voicing === 'smooth' ? smooth : block;
    const other = state.voicing === 'smooth' ? ['Block', block] : ['Smooth', smooth];
    $('#vlStats').innerHTML = `<div class="stat-row">
        <span><strong>${now.total}</strong> semitones of upper-voice motion</span>
        <span><strong>${now.held}</strong> common tones held</span>
        <span><strong>${now.leaps}</strong> leaps</span>
        <span>${other[0]} voicing: ${other[1].total} semitones, ${other[1].held} held</span></div>`;
  }

  function renderTension() {
    const cur = state.playing ? state.current : indexOf(state.selected);
    Views.tension($('#tension'), { chords: D.chords, current: cur });
    const c = D.chords[cur];
    setText($('#tensionNow'), c ? `${state.playing ? 'Playing bar' : 'Bar'} ${cur + 1}, ${c.text}: tension ${c.tension}` : '');
  }

  // ---------- Library and cadences ----------
  const rnLine = (prog, mode) => {
    const key = Theory.makeKey(state.tonic, mode);
    return toInsts(prog).map(i => Theory.resolve(i, key).html).join('<span class="dash" aria-hidden="true">–</span>');
  };
  function renderTabs() {
    const item = (p, i, kind) => {
      const ref = `${kind}-${i}`, playing = state.preview === ref;
      return `<article class="item">
        <div class="item-top"><h3>${esc(p.name)}</h3><span class="item-kind">${esc(p.genre || p.short)}</span></div>
        <p class="item-rn">${rnLine(p.prog, p.mode)}</p>
        <p class="item-about">${esc(p.about)}</p>
        <div class="item-actions">
          <button type="button" class="btn" data-hear="${ref}" data-focus="hear-${ref}" aria-label="${playing ? 'Stop' : 'Listen to'} ${esc(p.name)}">${playing ? 'Stop' : 'Listen'}</button>
          <button type="button" class="btn" data-load="${ref}" data-focus="load-${ref}" aria-label="Load ${esc(p.name)} into the builder">Load into builder</button>
          <span class="item-mode">${p.mode}</span></div></article>`;
    };
    $('#tab-library').innerHTML = `<div class="items">${PRESETS.map((p, i) => item(p, i, 'p')).join('')}</div>`;
    $('#tab-cadences').innerHTML = `<p class="tab-intro">A cadence is the way a phrase ends. Listen to each one in ${esc(Theory.makeKey(state.tonic, 'major').name)}, then load it and try other endings.</p>
      <div class="items">${CADENCES.map((p, i) => item(p, i, 'c')).join('')}</div>`;
  }
  const itemFor = ref => { const [k, i] = ref.split('-'); return (k === 'p' ? PRESETS : CADENCES)[+i]; };
  function hear(ref) {
    if (state.preview === ref) { stopMain(); return; }
    if (state.playing) { state.playing = false; state.current = -1; }
    const it = itemFor(ref);
    const key = Theory.makeKey(state.tonic, it.mode);
    const v = Theory.voice(toInsts(it.prog).map(i => Theory.resolve(i, key)), state.voicing);
    Sound.start({
      getBars: () => v, tempo: () => state.tempo, meter, pattern: () => state.pattern, loop: false,
      onEnd: () => { state.preview = null; update(); },
    });
    state.preview = ref;
    update();
  }
  function load(insts, mode, tonic) {
    state.mode = mode;
    if (tonic != null) state.tonic = tonic;
    state.prog = insts.map(i => withUid({ id: i.id, ext: i.ext || 'triad', inv: i.inv || 0 }));
    state.selected = state.prog[0].uid;
    pendingFocus = `slot-${state.selected}`;
    update();
    $('.builder').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function suggest() {
    const defs = Theory.BY_ID[state.mode];
    for (let tries = 0; tries < 60; tries++) {
      const seq = [pick(['d0', 'd0', 'd0', 'd5'])];
      while (seq.length < 4) seq.push(pick(defs[seq[seq.length - 1]].next));
      if (defs[seq[3]].next.includes(seq[0]) && new Set(seq).size >= 3) {
        state.prog = seq.map(id => withUid({ id, ext: 'triad', inv: 0 }));
        state.selected = state.prog[0].uid;
        update();
        return;
      }
    }
  }

  // ---------- Events ----------
  function bind() {
    $('#meter').innerHTML = METERS.map(m => `<option value="${m.id}">${m.id}</option>`).join('');
    $('#play').addEventListener('click', () => {
      if (state.playing) stop();
      else if (Sound.isPlaying()) stopMain();
      else play();
    });
    Sound.onChange(renderPlayButton);
    $('#loop').addEventListener('change', e => { state.loop = e.target.checked; save(); });
    $('#tonic').addEventListener('change', e => setKey(+e.target.value));
    $('#down').addEventListener('click', () => setKey(state.tonic - 1));
    $('#up').addEventListener('click', () => setKey(state.tonic + 1));
    $$('[data-mode]').forEach(b => b.addEventListener('click', () => setKey(state.tonic, b.dataset.mode)));
    $$('[data-voicing]').forEach(b => b.addEventListener('click', () => { state.voicing = b.dataset.voicing; update(); }));
    $('#tempo').addEventListener('input', e => {
      state.tempo = +e.target.value;
      setText($('#tempoOut'), `${meter().beatNote} = ${state.tempo} BPM`);
      save();
    });
    $('#meter').addEventListener('change', e => { state.meter = e.target.value; update(); });
    $('#pattern').addEventListener('change', e => { state.pattern = e.target.value; save(); });
    $('#volume').addEventListener('input', e => {
      state.volume = +e.target.value;
      setText($('#volumeOut'), `${state.volume}%`);
      Sound.setVolume(state.volume / 100);
      save();
    });
    // Bass level applies live; releasing the slider or toggling the octave previews the current bass note.
    const applyBass = () => Sound.setBass(state.bassLevel / 100, state.bassOctave);
    const previewBass = () => {
      const i = focusIndex();
      if (!Sound.isPlaying() && i >= 0) Sound.playNote(D.voicings[i].bass, true);
    };
    $('#bassLevel').addEventListener('input', e => { state.bassLevel = +e.target.value; setText($('#bassOut'), `${state.bassLevel}%`); applyBass(); save(); });
    $('#bassLevel').addEventListener('change', previewBass);
    $('#bassOct').addEventListener('change', e => { state.bassOctave = e.target.checked; applyBass(); save(); previewBass(); });
    $$('[data-cof]').forEach(b => b.addEventListener('click', () => { state.circleClick = b.dataset.cof; save(); renderCircle(); }));
    $('#suggest').addEventListener('click', suggest);
    $('#clear').addEventListener('click', () => { if (state.playing) stop(); state.prog = []; state.selected = null; update(); });

    const tl = $('#timeline');
    tl.addEventListener('click', e => {
      const del = e.target.closest('[data-del]');
      if (del) { removeChord(+del.dataset.del); return; }
      const slot = e.target.closest('.slot-main');
      if (slot) selectChord(+slot.closest('.slot').dataset.uid);
    });
    // Delete and Backspace act only on the focused bar (a component shortcut, not a page-wide one).
    tl.addEventListener('keydown', e => {
      const slot = e.target.closest('.slot-main');
      if (slot && (e.key === 'Delete' || e.key === 'Backspace')) { e.preventDefault(); removeChord(+slot.closest('.slot').dataset.uid); }
    });

    // Drag and drop is optional: the palette adds with a click and the Chord panel moves and replaces bars.
    document.addEventListener('dragstart', e => {
      const chip = e.target.closest && e.target.closest('.pal-chord'), slot = e.target.closest && e.target.closest('.slot[data-uid]');
      if (chip) e.dataTransfer.setData('text/plain', JSON.stringify({ id: chip.dataset.id }));
      else if (slot) e.dataTransfer.setData('text/plain', JSON.stringify({ uid: +slot.dataset.uid }));
      else return;
      e.dataTransfer.effectAllowed = 'copyMove';
    });
    tl.addEventListener('dragover', e => {
      const t = e.target.closest('.slot');
      if (!t) return;
      e.preventDefault();
      tl.querySelectorAll('.drop').forEach(x => x !== t && x.classList.remove('drop'));
      t.classList.add('drop');
    });
    tl.addEventListener('dragleave', e => { const t = e.target.closest('.slot'); if (t && !t.contains(e.relatedTarget)) t.classList.remove('drop'); });
    tl.addEventListener('drop', e => {
      const t = e.target.closest('.slot');
      if (!t) return;
      e.preventDefault();
      let data;
      try { data = JSON.parse(e.dataTransfer.getData('text/plain')); } catch (err) { return; }
      const target = t.dataset.uid ? indexOf(+t.dataset.uid) : state.prog.length;
      if (data.id) {
        if (t.dataset.uid) state.prog[target] = { ...state.prog[target], id: data.id, ext: 'triad', inv: 0 };
        else if (state.prog.length < 16) state.prog.push(withUid({ id: data.id, ext: 'triad', inv: 0 }));
        update();
      } else if (data.uid) {
        const from = indexOf(data.uid);
        moveChord(data.uid, from < target ? target - 1 + (t.dataset.uid ? 0 : 1) : target);
      }
    });

    $('.palette').addEventListener('click', e => {
      const chip = e.target.closest('.pal-chord');
      if (chip) addChord(chip.dataset.id);
    });

    $('#inspector').addEventListener('click', e => {
      const b = e.target.closest('button');
      if (!b || b.disabled) return;
      if (b.dataset.all) { applyAll(b.dataset.all); return; }
      const i = indexOf(state.selected);
      if (i < 0) return;
      const inst = state.prog[i];
      if (b.dataset.ext) { inst.ext = b.dataset.ext; inst.inv = Math.min(inst.inv, Theory.invCount(inst.ext) - 1); }
      else if (b.dataset.inv) inst.inv = +b.dataset.inv;
      else if (b.dataset.act === 'left') { moveChord(inst.uid, i - 1); return; }
      else if (b.dataset.act === 'right') { moveChord(inst.uid, i + 1); return; }
      else if (b.dataset.act === 'dup') { const copy = withUid({ ...inst }); state.prog.splice(i + 1, 0, copy); state.selected = copy.uid; }
      else if (b.dataset.act === 'del') { removeChord(inst.uid); return; }
      update();
      if ((b.dataset.ext || b.dataset.inv) && !state.playing) Sound.playChord(D.voicings[i]);
    });
    $('#inspector').addEventListener('change', e => {
      if (e.target.id !== 'inspChord') return;
      const i = indexOf(state.selected);
      if (i < 0) return;
      state.prog[i] = { ...state.prog[i], id: e.target.value, ext: 'triad', inv: 0 };
      update();
      if (!state.playing) Sound.playChord(D.voicings[i]);
    });

    // Voice leading: a dot plays its note, the rest of a column plays the whole chord and selects that bar.
    const vl = $('#vl');
    const flash = (el, cls) => { el.classList.add(cls); setTimeout(() => el.classList.remove(cls), 350); };
    const playColumn = (i, refocus) => {
      const inst = state.prog[i];
      if (!inst) return;
      Sound.playChord(D.voicings[i]);
      state.selected = inst.uid;
      update();
      const col = vl.querySelector(`[data-col="${i}"]`);
      if (col) { flash(col, 'flash'); if (refocus) col.focus({ preventScroll: true }); }
    };
    vl.addEventListener('click', e => {
      const note = e.target.closest('[data-midi]');
      if (note) { Sound.playNote(+note.dataset.midi, note.dataset.bass === '1'); flash(note, 'ring'); return; }
      const col = e.target.closest('[data-col]');
      if (col) playColumn(+col.dataset.col, false);
    });
    vl.addEventListener('keydown', e => {
      const col = e.target.closest('[data-col]');
      if (!col || (e.key !== 'Enter' && e.key !== ' ')) return;
      e.preventDefault();
      playColumn(+col.dataset.col, true);
    });

    $('.tabs-panel').addEventListener('click', e => {
      const h = e.target.closest('[data-hear]'), l = e.target.closest('[data-load]');
      if (h) hear(h.dataset.hear);
      if (l) { const it = itemFor(l.dataset.load); stopMain(); load(toInsts(it.prog), it.mode); }
    });
  }

  restore();
  Sound.setBass(state.bassLevel / 100, state.bassOctave);
  Sound.setVolume(state.volume / 100);
  state.selected = state.prog.length ? state.prog[0].uid : null;
  piano = Views.Piano($('#piano'), 36, 88, m => Sound.playNote(m));
  bind();
  update();
  const tabs = Chrome.tabs($('.tablist'), panelId => { state.tab = panelId.replace('tab-', ''); save(); });
  tabs.select('tab-' + state.tab);
  Quiz.init($('#tab-quiz'), { key: () => D.key, stopMain, load });
  Chrome.init({ refresh: renderViews });
  window.app = { state, derived: () => D };
})();
