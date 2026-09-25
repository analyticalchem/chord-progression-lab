/* Progression Lab: app state and UI wiring. */
(() => {
  const $ = s => document.querySelector(s);
  const esc = Views.esc;
  const pick = a => a[Math.floor(Math.random() * a.length)];
  const FUNC = {
    T: { name: 'Tonic', say: 'Home. It sounds stable and finished.' },
    S: { name: 'Predominant', say: 'Moves away from home and sets up the dominant.' },
    D: { name: 'Dominant', say: 'Builds tension that wants to resolve to the tonic.' },
  };
  const ROLE = { R: 'root', 2: '2nd', 3: '3rd', 4: '4th', 5: '5th', 6: '6th', 7: '7th', 9: '9th' };

  let uidN = 0;
  const withUid = i => ({ ...i, uid: ++uidN });
  const state = {
    tonic: 0, mode: 'major', prog: toInsts(PRESETS[0].prog).map(withUid),
    selected: null, current: -1, playing: false,
    tempo: 92, style: 'sustain', voicing: 'smooth', loop: true, tab: 'library',
    bassLevel: 100, bassOctave: false, circleClick: 'key',
  };
  let D = {}; // derived: key, chords, voicings

  // ---------- Persistence (per-viewer convenience only) ----------
  const STORE = 'progression-lab-v1';
  function save() {
    try {
      const { tonic, mode, tempo, style, voicing, loop, tab, bassLevel, bassOctave, circleClick } = state;
      const prog = state.prog.map(({ id, ext, inv }) => [id, ext, inv]);
      localStorage.setItem(STORE, JSON.stringify({ tonic, mode, tempo, style, voicing, loop, tab, bassLevel, bassOctave, circleClick, prog }));
    } catch (e) { /* storage unavailable */ }
  }
  function restore() {
    try {
      const s = JSON.parse(localStorage.getItem(STORE) || 'null');
      if (!s) return;
      Object.assign(state, {
        tonic: s.tonic ?? 0, mode: s.mode === 'minor' ? 'minor' : 'major', tempo: s.tempo || 92,
        style: s.style || 'sustain', voicing: s.voicing || 'smooth', loop: s.loop !== false, tab: s.tab || 'library',
        bassLevel: Number.isFinite(s.bassLevel) ? s.bassLevel : 100, bassOctave: !!s.bassOctave,
        circleClick: s.circleClick === 'play' ? 'play' : 'key',
      });
      if (Array.isArray(s.prog)) state.prog = toInsts(s.prog).filter(i => Theory.BY_ID[state.mode][i.id]).map(withUid);
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

  function update() {
    compute();
    save();
    renderTransport();
    renderTimeline();
    renderPalette();
    renderInspector();
    renderViews();
    renderTabs();
  }
  function renderViews() {
    renderPiano();
    renderCircle();
    renderVoiceLeading();
    renderTension();
  }

  // ---------- Transport ----------
  function renderTransport() {
    const names = Theory.tonicNames(state.mode);
    $('#tonic').innerHTML = names.map((n, pc) => `<option value="${pc}"${pc === state.tonic ? ' selected' : ''}>${n}</option>`).join('');
    document.querySelectorAll('[data-mode]').forEach(b => { const on = b.dataset.mode === state.mode; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); });
    document.querySelectorAll('[data-voicing]').forEach(b => { const on = b.dataset.voicing === state.voicing; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); });
    $('#tempo').value = state.tempo;
    $('#tempoOut').textContent = state.tempo;
    $('#bassLevel').value = state.bassLevel;
    $('#bassOut').textContent = state.bassLevel;
    $('#bassOct').checked = state.bassOctave;
    $('#style').value = state.style;
    $('#loop').checked = state.loop;
    $('#play').classList.toggle('on', state.playing);
    $('#play').querySelector('span').textContent = state.playing ? 'Stop' : 'Play';
    $('#keyName').textContent = `${D.key.name} ${state.mode}`;
    $('#keySig').textContent = Theory.keySignature(D.key);
    $('#scale').innerHTML = Theory.scaleNames(D.key).map(n => `<span>${n}</span>`).join('');
  }

  function play() {
    if (!state.prog.length) return;
    state.playing = true;
    Sound.start({
      getBars: () => D.voicings,
      tempo: () => state.tempo, style: () => state.style, loop: () => state.loop,
      onChord: i => highlight(i),
      onEnd: () => { state.playing = false; state.current = -1; update(); },
    });
    renderTransport();
  }
  function stop() {
    Sound.stop();
    state.playing = false;
    state.current = -1;
    update();
  }
  function highlight(i) {
    state.current = i;
    document.querySelectorAll('.slot[data-uid]').forEach((el, k) => el.classList.toggle('playing', k === i));
    if (!state.selected) renderInspector();
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

  // ---------- Timeline ----------
  function renderTimeline() {
    const sel = state.selected;
    const items = D.chords.map((c, i) => {
      const inst = state.prog[i];
      const tag = c.def.tag || FUNC[c.func].name;
      return `<li class="slot c-${c.color}${inst.uid === sel ? ' sel' : ''}${state.playing && i === state.current ? ' playing' : ''}"
          data-uid="${inst.uid}" draggable="true" tabindex="0" aria-label="Bar ${i + 1}: ${esc(c.text)}, ${esc(c.name)}">
        <span class="slot-bar">${i + 1}</span>
        <button type="button" class="slot-x" data-del="${inst.uid}" aria-label="Remove bar ${i + 1}">×</button>
        <span class="slot-rn">${c.html}</span>
        <span class="slot-name">${esc(c.name)}</span>
        <span class="slot-tag">${esc(tag)}</span>
        <span class="slot-meter" title="Tension ${c.tension}"><span style="width:${c.tension}%"></span></span>
      </li>`;
    }).join('');
    const addLabel = state.prog.length ? 'Drop a chord here' : 'Pick chords below to start';
    $('#timeline').innerHTML = items + `<li class="slot add" data-add="1"><span>+</span><small>${addLabel}</small></li>`;
    $('#count').textContent = `${state.prog.length} bar${state.prog.length === 1 ? '' : 's'}`;
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
    state.prog.splice(i, 1);
    if (state.selected === uid) {
      const next = state.prog[Math.min(i, state.prog.length - 1)];
      state.selected = next ? next.uid : null;
    }
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
      const isLikely = likely.includes(d.id);
      return `<button type="button" class="chip c-${c.color}${isLikely ? ' likely' : ''}" data-id="${d.id}" draggable="true"
          title="${esc(c.name)}${isLikely ? ' (common next chord)' : ''}">
        <span class="chip-rn">${c.html}</span><span class="chip-name">${esc(c.name)}</span>
        ${d.tag ? `<span class="chip-tag">${esc(d.tag)}</span>` : ''}</button>`;
    };
    const defs = Theory.DEFS[state.mode];
    $('#palDiatonic').innerHTML = defs.filter(d => d.src === 'diatonic').map(chip).join('');
    $('#palExtra').innerHTML = defs.filter(d => d.src !== 'diatonic').map(chip).join('');
    $('#palHint').textContent = ref
      ? `Click a chord to add it to the end, or drag it onto a bar to replace that bar. Dots mark chords that often follow ${ref.text}.`
      : 'Click a chord to add it. Keys 1–7 add the chords of the key.';
  }

  // ---------- Inspector (chord color, inversion) ----------
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
    const applyAll = `<div class="insp-row"><span class="lbl">Every bar</span><div class="chips-sm">
      <button type="button" class="mini" data-all="triad">Triads</button>
      <button type="button" class="mini" data-all="seventh">Diatonic 7ths</button>
      <button type="button" class="mini" data-all="nine">Add 9ths</button>
      <button type="button" class="mini" data-all="sus">Sus4 on dominants</button></div></div>`;
    if (i < 0) {
      $('#inspector').innerHTML = `<p class="insp-empty">Select a bar in your progression to change its color and inversion.</p>${applyAll}`;
      return;
    }
    const c = D.chords[i], inst = state.prog[i];
    const exts = Theory.extOptions(c.def).map(e => {
      const label = e === 'triad' ? c.tones[0].name + Theory.suffix(c.def, 'triad') : c.tones[0].name + Theory.suffix(c.def, e);
      return `<button type="button" class="mini${c.ext === e ? ' on' : ''}" data-ext="${e}" aria-pressed="${c.ext === e}">${esc(label)}</button>`;
    }).join('');
    const invs = Array.from({ length: Theory.invCount(c.ext) }, (_, k) => {
      const label = ['Root', '1st', '2nd', '3rd'][k];
      return `<button type="button" class="mini${c.inv === k ? ' on' : ''}" data-inv="${k}" aria-pressed="${c.inv === k}">${label} <em>${esc(c.tones[k].name)}</em></button>`;
    }).join('');
    $('#inspector').innerHTML = `
      <div class="insp-head c-${c.color}">
        <div class="insp-rn">${c.html}</div>
        <div class="insp-meta">
          <div class="insp-name">${esc(c.name)} <span class="insp-bar">bar ${i + 1}</span></div>
          <div><span class="pill">${FUNC[c.func].name}</span>${c.def.tag ? ` <span class="pill ghost">${esc(c.def.tag)}</span>` : ''} <span class="insp-t">tension ${c.tension}</span></div>
        </div>
      </div>
      <p class="insp-say">${esc(describe(c, D.key))}</p>
      <div class="insp-notes">${c.tones.map(t => `<span><small>${ROLE[t.role]}</small>${esc(t.name)}</span>`).join('')}</div>
      <div class="insp-row"><label class="lbl" for="inspChord">Chord</label><div>
        <select id="inspChord">${Theory.DEFS[state.mode].map(d => {
          const r = Theory.resolve({ id: d.id }, D.key);
          return `<option value="${d.id}"${d.id === inst.id ? ' selected' : ''}>${esc(r.text)}  ${esc(r.name)}</option>`;
        }).join('')}</select></div></div>
      <div class="insp-row"><span class="lbl">Color</span><div class="chips-sm">${exts}</div></div>
      <div class="insp-row"><span class="lbl">Inversion</span><div class="chips-sm">${invs}</div></div>
      <div class="insp-row"><span class="lbl">Bar</span><div class="chips-sm">
        <button type="button" class="mini" data-act="left" ${i === 0 ? 'disabled' : ''}>Move left</button>
        <button type="button" class="mini" data-act="right" ${i === state.prog.length - 1 ? 'disabled' : ''}>Move right</button>
        <button type="button" class="mini" data-act="dup">Duplicate</button>
        <button type="button" class="mini" data-act="del">Remove</button></div></div>
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
  function renderPiano() {
    const i = focusIndex();
    if (i < 0) { piano.show([]); $('#pianoNow').textContent = 'No chord selected'; return; }
    const c = D.chords[i], v = D.voicings[i];
    const nameOf = m => (c.tones.find(t => t.pc === m % 12) || {}).name || '';
    piano.show([{ midi: v.bass, role: 'bass', name: nameOf(v.bass), color: c.color },
      ...v.upper.map(m => ({ midi: m, role: 'upper', name: nameOf(m), color: c.color }))]);
    $('#pianoNow').innerHTML = `Bar ${i + 1}: <strong>${esc(c.name)}</strong>`;
  }

  function renderCircle() {
    const key = D.key;
    const numerals = (pc, q) => {
      const d = Theory.DEFS[state.mode].find(x => x.src === 'diatonic' && Theory.mod(key.pc + x.root) === pc
        && (Theory.quality(x.third, x.fifth) === q));
      return d ? Theory.resolve({ id: d.id }, key).text : '';
    };
    Views.circle($('#circle'), { key, chords: D.chords, current: state.playing ? state.current : -1, numerals, onPick: pickCircle });
    document.querySelectorAll('[data-cof]').forEach(b => {
      const on = b.dataset.cof === state.circleClick;
      b.classList.toggle('on', on);
      b.setAttribute('aria-pressed', on);
    });
    const clickHelp = state.circleClick === 'key'
      ? 'Click any wedge to hear its chord and move the key there.'
      : 'Click any wedge to hear its chord. The key stays where it is.';
    const m = Views.rootMotion(D.chords);
    const moves = Math.max(0, D.chords.length - 1);
    const parts = [[m.fall5, 'falling fifth', 'falling fifths'], [m.rise5, 'rising fifth', 'rising fifths'],
      [m.step, 'step', 'steps'], [m.third, 'third or tritone', 'thirds or tritones'], [m.same, 'repeat', 'repeats']]
      .filter(p => p[0]).map(p => `<span><strong>${p[0]}</strong> ${p[0] === 1 ? p[1] : p[2]}</span>`).join('');
    $('#circleStats').innerHTML = moves
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
    const noteName = (i, m) => (D.chords[i].tones.find(t => t.pc === m % 12) || {}).name || '';
    Views.voiceLeading($('#vl'), { chords: D.chords, voicings: D.voicings, current: state.playing ? state.current : -1, noteName });
    if (D.chords.length < 2) { $('#vlStats').innerHTML = '<p>Add at least two chords to see how the voices move.</p>'; return; }
    const smooth = Theory.motionStats(Theory.voice(D.chords, 'smooth'));
    const block = Theory.motionStats(Theory.voice(D.chords, 'block'));
    const now = state.voicing === 'smooth' ? smooth : block;
    const other = state.voicing === 'smooth' ? ['Block', block] : ['Smooth', smooth];
    $('#vlStats').innerHTML = `<div class="stat-row">
        <span><strong>${now.total}</strong> semitones of upper-voice motion</span>
        <span><strong>${now.held}</strong> common tones held</span>
        <span><strong>${now.leaps}</strong> leaps</span>
        <span class="muted">${other[0]} voicing: ${other[1].total} semitones, ${other[1].held} held</span></div>`;
  }

  function renderTension() {
    const cur = state.playing ? state.current : indexOf(state.selected);
    Views.tension($('#tension'), { chords: D.chords, current: cur });
    const c = D.chords[cur];
    $('#tensionNow').textContent = c ? `Bar ${cur + 1}, ${c.text}: ${c.tension}` : '';
  }

  // ---------- Library and cadences ----------
  const rnLine = (prog, mode) => {
    const key = Theory.makeKey(state.tonic, mode);
    return toInsts(prog).map(i => Theory.resolve(i, key).html).join('<span class="dash">–</span>');
  };
  function renderTabs() {
    document.querySelectorAll('[data-tab]').forEach(b => {
      const on = b.dataset.tab === state.tab;
      b.classList.toggle('on', on);
      b.setAttribute('aria-selected', on);
    });
    ['library', 'cadences', 'quiz'].forEach(t => { $('#tab-' + t).hidden = t !== state.tab; });
    const card = (p, i, kind) => `<article class="card">
        <div class="card-top"><h3>${esc(p.name)}</h3><span class="card-kind">${esc(p.genre || p.short)}</span></div>
        <p class="card-rn">${rnLine(p.prog, p.mode)}</p>
        <p class="card-about">${esc(p.about)}</p>
        <div class="card-actions"><button type="button" class="btn" data-hear="${kind}:${i}">Listen</button>
          <button type="button" class="btn ghost" data-load="${kind}:${i}">Load into builder</button>
          <span class="card-mode">${p.mode}</span></div></article>`;
    $('#tab-library').innerHTML = `<div class="cards">${PRESETS.map((p, i) => card(p, i, 'p')).join('')}</div>`;
    $('#tab-cadences').innerHTML = `<p class="tab-intro">A cadence is the way a phrase ends. Listen to each one in ${esc(Theory.makeKey(state.tonic, 'major').name)}, then load it and try other endings.</p>
      <div class="cards">${CADENCES.map((p, i) => card(p, i, 'c')).join('')}</div>`;
  }
  const itemFor = ref => { const [k, i] = ref.split(':'); return (k === 'p' ? PRESETS : CADENCES)[+i]; };
  function hear(item) {
    stopMain();
    const key = Theory.makeKey(state.tonic, item.mode);
    const v = Theory.voice(toInsts(item.prog).map(i => Theory.resolve(i, key)), state.voicing);
    Sound.sequence(v, v.map((_, i) => (i === v.length - 1 ? 2.2 : 60 / state.tempo * 4)));
  }
  function load(insts, mode, tonic) {
    state.mode = mode;
    if (tonic != null) state.tonic = tonic;
    state.prog = insts.map(i => withUid({ id: i.id, ext: i.ext || 'triad', inv: i.inv || 0 }));
    state.selected = state.prog[0].uid;
    update();
    document.querySelector('.builder').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  function stopMain() {
    if (state.playing) stop();
    else Sound.stop();
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
    $('#play').addEventListener('click', () => (state.playing ? stop() : play()));
    $('#loop').addEventListener('change', e => { state.loop = e.target.checked; save(); });
    $('#tonic').addEventListener('change', e => setKey(+e.target.value));
    $('#down').addEventListener('click', () => setKey(state.tonic - 1));
    $('#up').addEventListener('click', () => setKey(state.tonic + 1));
    document.querySelectorAll('[data-mode]').forEach(b => b.addEventListener('click', () => setKey(state.tonic, b.dataset.mode)));
    document.querySelectorAll('[data-voicing]').forEach(b => b.addEventListener('click', () => { state.voicing = b.dataset.voicing; update(); }));
    $('#tempo').addEventListener('input', e => { state.tempo = +e.target.value; $('#tempoOut').textContent = state.tempo; save(); });
    $('#style').addEventListener('change', e => { state.style = e.target.value; save(); });
    // Bass level applies live; releasing the slider or toggling +8va previews the current bass note.
    const applyBass = () => Sound.setBass(state.bassLevel / 100, state.bassOctave);
    const previewBass = () => {
      const i = focusIndex();
      if (!state.playing && i >= 0) Sound.playNote(D.voicings[i].bass, true);
    };
    $('#bassLevel').addEventListener('input', e => { state.bassLevel = +e.target.value; $('#bassOut').textContent = state.bassLevel; applyBass(); save(); });
    $('#bassLevel').addEventListener('change', previewBass);
    $('#bassOct').addEventListener('change', e => { state.bassOctave = e.target.checked; applyBass(); save(); previewBass(); });
    document.querySelectorAll('[data-cof]').forEach(b => b.addEventListener('click', () => {
      state.circleClick = b.dataset.cof;
      save();
      renderCircle();
    }));
    $('#suggest').addEventListener('click', suggest);
    $('#clear').addEventListener('click', () => { if (state.playing) stop(); state.prog = []; state.selected = null; update(); });

    const tl = $('#timeline');
    tl.addEventListener('click', e => {
      const del = e.target.closest('[data-del]');
      if (del) { removeChord(+del.dataset.del); return; }
      const slot = e.target.closest('.slot[data-uid]');
      if (slot) selectChord(+slot.dataset.uid);
      else if (e.target.closest('[data-add]')) $('#palDiatonic .chip')?.focus();
    });
    tl.addEventListener('keydown', e => {
      const slot = e.target.closest('.slot[data-uid]');
      if (slot && e.key === 'Enter') { e.preventDefault(); selectChord(+slot.dataset.uid); }
    });

    // Drag and drop: chips replace or append, slots reorder
    document.addEventListener('dragstart', e => {
      const chip = e.target.closest('.chip'), slot = e.target.closest('.slot[data-uid]');
      if (chip) e.dataTransfer.setData('text/plain', JSON.stringify({ id: chip.dataset.id }));
      else if (slot) e.dataTransfer.setData('text/plain', JSON.stringify({ uid: +slot.dataset.uid }));
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

    document.querySelector('.palette').addEventListener('click', e => {
      const chip = e.target.closest('.chip');
      if (chip) addChord(chip.dataset.id);
    });

    $('#inspector').addEventListener('click', e => {
      const b = e.target.closest('button');
      if (!b) return;
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
      e.stopPropagation();
      playColumn(+col.dataset.col, true);
    });

    $('#inspector').addEventListener('change', e => {
      if (e.target.id !== 'inspChord') return;
      const i = indexOf(state.selected);
      if (i < 0) return;
      state.prog[i] = { ...state.prog[i], id: e.target.value, ext: 'triad', inv: 0 };
      update();
      if (!state.playing) Sound.playChord(D.voicings[i]);
    });

    document.querySelectorAll('[data-tab]').forEach(b => b.addEventListener('click', () => { state.tab = b.dataset.tab; save(); renderTabs(); }));
    document.querySelector('.tabs').addEventListener('click', e => {
      const h = e.target.closest('[data-hear]'), l = e.target.closest('[data-load]');
      if (h) hear(itemFor(h.dataset.hear));
      if (l) { const it = itemFor(l.dataset.load); load(toInsts(it.prog), it.mode); }
    });

    document.addEventListener('keydown', e => {
      if (e.target.closest('input, select, textarea') || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === ' ') { e.preventDefault(); state.playing ? stop() : play(); }
      else if (/^[1-7]$/.test(e.key)) addChord('d' + (+e.key - 1));
      else if ((e.key === 'Delete' || e.key === 'Backspace') && state.selected) { e.preventDefault(); removeChord(state.selected); }
      else if (e.key === 'Escape' && state.selected) { state.selected = null; update(); }
    });
  }

  restore();
  Sound.setBass(state.bassLevel / 100, state.bassOctave);
  state.selected = state.prog.length ? state.prog[0].uid : null;
  piano =Views.Piano($('#piano'), 36, 88, m => Sound.playNote(m));
  bind();
  update();
  Quiz.init($('#tab-quiz'), { key: () => D.key, stopMain, load });
})();
