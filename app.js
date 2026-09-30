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
    selected: null, selectedRest: null, current: -1, currentRest: null, pulse: -1, playing: false, preview: null,
    tempo: 92, meter: '4/4', pattern: 'sustain', volume: 80, voicing: 'smooth', loop: true, tab: 'library',
    bassLevel: 100, bassOctave: false, circleClick: 'play', circlePath: true,
  };
  let D = {}; // derived: key, chords, voicings, spans, song
  const meter = () => meterById(state.meter);
  const MAX_BARS = 4;
  const beatsPerBar = () => meter().beats.length;
  // Lengths and rests are stored in bars, so changing the meter keeps each one's share of the bar.
  // After an edit, every length and rest is set to exactly what is on screen, so the edit shows as made.
  const shown = () => ({ beats: D.spans.map(s => s.beats), rests: D.spans.map(s => s.restBeats) });
  function setTiming(beatsList, restsList) {
    const n = beatsPerBar();
    state.prog.forEach((inst, k) => { inst.len = beatsList[k] / n; inst.rest = restsList[k] / n; });
  }
  const posText = b => `bar ${Math.floor(b / beatsPerBar()) + 1}, beat ${(b % beatsPerBar()) + 1}`;
  const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
  const restPhrase = n => `a ${n}-beat rest`; // "a 2-beat rest": the length as an adjective
  function lenText(beats) {
    const n = beatsPerBar(), bars = Math.floor(beats / n), rest = beats % n;
    if (!bars) return plural(beats, 'beat');
    return `${plural(beats, 'beat')}, ${plural(bars, 'bar')}${rest ? ` and ${plural(rest, 'beat')}` : ''}`;
  }

  // ---------- Persistence (this page genuinely needs to remember the progression) ----------
  const STORE = 'chord-progression-lab-settings', OLD_STORE = 'progression-lab-v1';
  const SAVED = ['tonic', 'mode', 'tempo', 'meter', 'pattern', 'volume', 'voicing', 'loop', 'tab', 'bassLevel', 'bassOctave', 'circleClick', 'circlePath'];
  function save() {
    try {
      const s = {};
      SAVED.forEach(k => { s[k] = state[k]; });
      // Saved as circleMode: the older circleClick field held the old default for everyone, so it
      // is ignored and Play only becomes the starting choice once.
      s.circleMode = state.circleClick;
      delete s.circleClick;
      s.prog = state.prog.map(({ id, ext, inv, len, rest }) => [id, ext, inv, len, rest || 0]);
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
      state.circleClick = s.circleMode === 'key' ? 'key' : 'play';
      state.circlePath = s.circlePath !== false;
      if (Array.isArray(s.prog)) {
        state.prog = toInsts(s.prog).filter(i => Theory.BY_ID[state.mode][i.id]).slice(0, 16)
          .map(i => withUid({ ...i, len: Number.isFinite(i.len) && i.len > 0 ? Math.min(MAX_BARS, i.len) : 1,
            rest: Number.isFinite(i.rest) && i.rest > 0 ? Math.min(MAX_BARS, i.rest) : 0 }));
      }
    } catch (e) { /* ignore bad data */ }
  }

  // ---------- Derived data ----------
  function compute() {
    const key = Theory.makeKey(state.tonic, state.mode);
    const chords = state.prog.map(i => Theory.resolve(i, key));
    const voicings = Theory.voice(chords, state.voicing);
    const m = meter(), n = m.beats.length;
    // Round the boundaries (in bars) to beats, not each length on its own, so the total is kept when
    // the meter changes: two half-bar chords in 3/4 become 2 + 1 beats, not 2 + 2. Each chord may
    // have a rest before it (restStart to startBeat), where nothing plays.
    let acc = 0, b = 0;
    const spans = state.prog.map(inst => {
      acc += Math.min(MAX_BARS, Math.max(0, inst.rest || 0));
      const start = Math.min(b + MAX_BARS * n, Math.max(b, Math.round(acc * n)));
      acc += Math.min(MAX_BARS, inst.len || 1);
      const end = Math.min(start + MAX_BARS * n, Math.max(start + 1, Math.round(acc * n)));
      const s = { restStart: b, restBeats: start - b, startBeat: start, beats: end - start, start: beatPulse(m, start), end: beatPulse(m, end) };
      b = end;
      return s;
    });
    const gaps = spans.map((s, i) => ({ before: i, start: beatPulse(m, s.restStart), end: s.start })).filter(g => g.end > g.start);
    D = { key, chords, voicings, spans, totalBeats: b, song: { voicings, spans, gaps, total: beatPulse(m, b) } };
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
  // keepInspector: redraw everything but the Chord panel, so its Length slider is not replaced mid-drag.
  function update(opts = {}) {
    const active = document.activeElement;
    const fk = pendingFocus || (active && active.dataset ? active.dataset.focus : null);
    pendingFocus = null;
    compute();
    save();
    renderTransport();
    renderBeats();
    renderTimeline();
    renderPalette();
    if (!opts.keepInspector) renderInspector();
    renderViews();
    renderTabs();
    fitAll();
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
  // Drawings hold their text and marks at CSS size however wide they are drawn (style guide 8.7).
  // Redraw the ones whose marks are sized in script when their scale changes, and name each scroll
  // box as a region only while it scrolls. Runs after every redraw, on resize and on the
  // presentation toggle (a hidden page runs no observer callbacks, so it is also called directly).
  let laneWidth = 0;
  function fitAll() {
    // The lane wraps by whole bars, so a width change can change how many bars fit on a row.
    const w = $('#lane').clientWidth;
    if (w !== laneWidth) { laneWidth = w; const t = shown(); layoutTimeline(t.beats, t.rests); }
    if (Views.fitSvg($('#circle'))) renderCircle();
    if (Views.fitSvg($('#tension'))) renderTension();
    $$('.visual-scroll').forEach(box => Views.fitScroll(box, box.dataset.scrollLabel));
  }
  // Coalesce resize bursts with a short timer rather than requestAnimationFrame, which never runs in
  // a background tab and would leave the scroll boxes unchecked after a resize there.
  let fitQueued = false;
  function queueFit() {
    if (fitQueued) return;
    fitQueued = true;
    setTimeout(() => { fitQueued = false; fitAll(); }, 30);
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
      getSong: () => D.song,
      tempo: () => state.tempo, meter, pattern: () => state.pattern, loop: () => state.loop,
      onChord: i => highlight(i),
      onPulse: k => lightPulse(k),
      onEnd: () => { state.playing = false; state.current = -1; state.currentRest = null; update(); },
    });
    renderTabs();
  }
  function stop() {
    Sound.stop();
    state.playing = false;
    state.current = -1;
    state.currentRest = null;
    state.preview = null;
    update();
  }
  function stopMain() {
    if (state.playing) stop();
    else { Sound.stop(); state.preview = null; renderTabs(); }
  }
  // i >= 0: chord i starts; i < 0: the rest before chord (-1 - i) starts, and nothing sounds.
  function highlight(i) {
    const restOf = i < 0 ? state.prog[-1 - i] : null;
    state.current = i < 0 ? -1 : i;
    state.currentRest = restOf ? restOf.uid : null;
    const curUid = state.current >= 0 && state.prog[state.current] ? state.prog[state.current].uid : null;
    $$('.slot[data-uid]').forEach(el => el.classList.toggle('playing', +el.dataset.uid === curUid));
    $$('.slot[data-cont-of]').forEach(el => el.classList.toggle('playing', +el.dataset.contOf === curUid));
    $$('.slot[data-rest-for]').forEach(el => el.classList.toggle('playing', +el.dataset.restFor === state.currentRest));
    $$('.slot[data-cont-rest]').forEach(el => el.classList.toggle('playing', +el.dataset.contRest === state.currentRest));
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
  // Short forms of a chord's function or tag, shown on chords too narrow for the full word, so the
  // function is always written on the chord and never shown by colour alone.
  const SHORT = { Tonic: 'Ton', Predominant: 'Pre', Dominant: 'Dom', borrowed: 'Bor', 'harmonic minor': 'Harm', 'Dorian IV': 'Dor', Picardy: 'Pic', Neapolitan: 'Neap' };
  const shortTag = tag => SHORT[tag] || tag.replace(/^V of /, 'V/');

  function renderTimeline() {
    const full = state.prog.length >= 16;
    const items = D.chords.map((c, i) => {
      const inst = state.prog[i], uid = inst.uid, sel = uid === state.selected;
      const tag = c.def.tag || FUNC[c.func].name, sp = D.spans[i];
      // A rest before the chord: silence on playback, and a place a chord can be dropped or picked into.
      const restSel = state.selectedRest === uid;
      const rest = sp.restBeats ? `<li class="lane-item"><div class="slot rest${restSel ? ' sel' : ''}${state.playing && state.currentRest === uid ? ' playing' : ''}" data-rest-for="${uid}">
        <button type="button" class="rest-main" data-focus="rest-${uid}" aria-pressed="${restSel}">
          <span class="rest-name">Rest</span>
          <span class="slot-len">${plural(sp.restBeats, 'beat')}</span>
          <span class="rest-hint">${full ? '16 chords is the limit' : 'Drop or pick a chord here'}</span>
          <span class="visually-hidden">, before chord ${i + 1}</span>
        </button>
        <button type="button" class="slot-x" data-rest-del="${uid}" aria-label="Remove the rest before chord ${i + 1}" title="Remove this rest; the chords after it move earlier">×</button>
      </div></li>` : '';
      return `${rest}<li class="lane-item"><div class="slot fn-${c.color}${sel ? ' sel' : ''}${state.playing && i === state.current ? ' playing' : ''}" data-uid="${uid}" draggable="true">
        <button type="button" class="slot-main" data-focus="slot-${uid}" aria-pressed="${sel}">
          <span class="slot-bar"><span class="visually-hidden">Chord </span>${i + 1}</span>
          <span class="slot-rn">${c.html}</span>
          <span class="slot-name">${esc(c.name)}</span>
          <span class="slot-len visually-hidden">${plural(sp.beats, 'beat')}</span>
          <span class="slot-tag"><span class="tag-full">${esc(tag)}</span><span class="tag-short" aria-hidden="true">${esc(shortTag(tag))}</span></span>
          <span class="visually-hidden">, tension ${c.tension}</span>
          <span class="slot-meter" aria-hidden="true"><span style="width:${c.tension}%"></span></span>
        </button>
        <button type="button" class="slot-x" data-del="${uid}" aria-label="Remove chord ${i + 1}" title="Remove chord ${i + 1}">×</button>
        <span class="slot-grip left" data-grip-for="${uid}" aria-hidden="true" title="Drag to move where this chord starts; nothing else moves"></span>
        <span class="slot-grip right" data-grip-for="${uid}" aria-hidden="true" title="Drag to change how long this chord plays; the chords after it move"></span>
      </div></li>`;
    }).join('');
    const addLabel = state.prog.length ? (full ? '16 chords is the limit' : 'Drop a chord here') : 'Add chords from below';
    $('#timeline').innerHTML = items + `<li class="lane-item"><div class="slot add" data-add="1"><span aria-hidden="true">+</span>${addLabel}</div></li>`;
    const t = shown();
    layoutTimeline(t.beats, t.rests);
  }

  // Place the chords and rests on the time lane and draw its ruler. The lane wraps onto rows of whole
  // bars; anything that runs past a row's end continues in a box at the start of the next row (the
  // chord's right-edge grip moves to its last piece). Called with trial lengths while dragging, so it
  // never rebuilds the chords themselves. (A rest that a drag is just opening has no block yet; it
  // shows as empty lane until the drag ends.)
  const rootPx = () => parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
  const beatPx = () => 2.75 * rootPx(); // rem-based, so presentation mode widens the chords too
  const beatX = (b, px) => beatPulse(meter(), b) * px / meter().perBeat;
  const ROW_REM = { ruler: 1.7, box: 8.5, gap: 0.9 };
  let laneGeom = null;
  function layoutTimeline(beatsList, restsList) {
    const px = beatPx(), rem = rootPx(), n = beatsPerBar(), gap = 4, lane = $('#lane');
    const barW = beatX(n, px), bpr = Math.max(1, Math.floor((lane.clientWidth + 0.5) / barW));
    const rowBeats = bpr * n, rowW = bpr * barW, pitch = (ROW_REM.ruler + ROW_REM.box + ROW_REM.gap) * rem;
    const top = r => r * pitch + ROW_REM.ruler * rem;
    const xOf = (b, r) => beatX(b, px) - r * rowW;
    laneGeom = { px, rowBeats, rowW, pitch };
    const pieces = (from, to) => {
      const out = [];
      for (let a = from; a < to;) {
        const r = Math.floor(a / rowBeats), e = Math.min(to, (r + 1) * rowBeats);
        out.push({ r, x0: xOf(a, r), x1: xOf(e, r) });
        a = e;
      }
      return out;
    };
    const draw = (main, from, to, contAttr) => {
      const key = main.dataset.uid || main.dataset.restFor;
      const grip = $(`#timeline .slot-grip.right[data-grip-for="${key}"]`);
      if (grip && grip.parentElement !== main) main.appendChild(grip);
      $$(`#timeline [${contAttr}="${key}"]`).forEach(el => el.remove());
      const ps = pieces(from, to);
      main.hidden = !ps.length;
      ps.forEach((p, k) => {
        let el = main;
        if (k > 0) {
          el = document.createElement('div');
          el.className = `${main.className.replace(/\b(narrow|tiny|split-end|split-start|drop)\b/g, ' ')} cont`;
          el.setAttribute(contAttr, key);
          el.setAttribute('aria-hidden', 'true');
          main.parentElement.appendChild(el);
        }
        const last = k === ps.length - 1;
        el.style.left = `${p.x0}px`;
        el.style.top = `${top(p.r)}px`;
        el.style.width = `${Math.max(0, p.x1 - p.x0 - (last ? gap : 0))}px`;
        el.classList.toggle('split-end', !last);
        el.classList.toggle('split-start', k > 0);
      });
      if (!ps.length) return;
      const w = ps[0].x1 - ps[0].x0 - (ps.length === 1 ? gap : 0);
      main.classList.toggle('narrow', w < 6.2 * rem);
      main.classList.toggle('tiny', w < 3.8 * rem);
      if (grip && ps.length > 1) main.parentElement.lastElementChild.appendChild(grip);
    };
    let b = 0;
    $$('#timeline .slot[data-uid]').forEach((el, i) => {
      const restEl = $(`#timeline .slot[data-rest-for="${el.dataset.uid}"]`);
      if (restEl) { draw(restEl, b, b + restsList[i], 'data-cont-rest'); setText(restEl.querySelector('.slot-len'), plural(restsList[i], 'beat')); }
      b += restsList[i];
      draw(el, b, b + beatsList[i], 'data-cont-of');
      setText(el.querySelector('.slot-len'), plural(beatsList[i], 'beat'));
      b += beatsList[i];
    });
    // The box for adding at the end: after the last chord, or at the start of the next row.
    const add = $('#timeline .slot.add'), addW = 7 * rem;
    let ar = Math.floor(b / rowBeats), ax = xOf(b, ar);
    if (ax > 0 && ax + addW > rowW + 1) { ar += 1; ax = 0; }
    add.style.left = `${ax}px`;
    add.style.top = `${top(ar)}px`;
    const rows = ar + 1, bars = Math.ceil(b / n);
    let ruler = '';
    for (let r = 0; r < rows; r++) {
      const first = r * bpr, last = Math.min(bars, (r + 1) * bpr);
      if (first >= last) continue;
      ruler += `<span class="ruler-line" style="top:${top(r) - 8}px;width:${xOf(last * n, r)}px"></span>`;
      for (let bar = first; bar < last; bar++) {
        for (let j = 0; j < n; j++) {
          const k = bar * n + j;
          ruler += j === 0
            ? `<span class="bar-mark" style="left:${xOf(k, r)}px;top:${r * pitch}px">${bar + 1}</span>`
            : `<span class="beat-mark" style="left:${xOf(k, r)}px;top:${top(r) - 8 - 0.45 * rem}px"></span>`;
        }
      }
      ruler += `<span class="bar-mark" style="left:${xOf(last * n, r)}px;top:${r * pitch}px"></span>`;
    }
    $('#ruler').innerHTML = ruler;
    lane.style.height = `${rows * pitch - ROW_REM.gap * rem}px`;
    const rest = b % n;
    setText($('#count'), `${plural(state.prog.length, 'chord')}, ${rest ? plural(b, 'beat') : plural(b / n, 'bar')}`);
    setText($('#laneNote'), b && rest
      ? `The chords fill ${plural(Math.floor(b / n), 'bar')} and ${rest} of ${n} beats, so the last bar is played short when the progression loops.`
      : '');
  }

  function addChord(id) {
    if (state.selectedRest) { fillRest(state.selectedRest, { id, ext: 'triad', inv: 0 }); return; }
    if (state.prog.length >= 16) return;
    const inst = withUid({ id, ext: 'triad', inv: 0, len: 1, rest: 0 });
    state.prog.push(inst);
    state.selected = inst.uid;
    compute();
    Sound.playChord(Theory.voice([Theory.resolve(inst, D.key)], 'smooth')[0]);
    update();
  }
  // A chord put into the rest before chord `uid` fills that rest exactly; nothing else moves.
  function fillRest(uid, chord) {
    const i = indexOf(uid);
    if (i < 0 || !D.spans[i].restBeats || state.prog.length >= 16) return;
    const t = shown(), n = beatsPerBar();
    setTiming(t.beats, t.rests);
    const inst = withUid({ ...chord, len: t.rests[i] / n, rest: 0 });
    state.prog[i].rest = 0;
    state.prog.splice(i, 0, inst);
    state.selected = inst.uid;
    state.selectedRest = null;
    pendingFocus = `slot-${inst.uid}`;
    compute();
    if (!state.playing) Sound.playChord(Theory.voice([Theory.resolve(inst, D.key)], 'smooth')[0]);
    update();
  }
  // Drag an existing chord onto a rest: it leaves its old place (the chords after that place move
  // earlier, as when a chord is removed) and fills the rest.
  function moveIntoRest(fromUid, restUid) {
    const j = indexOf(fromUid);
    if (j < 0 || fromUid === restUid || !D.spans[indexOf(restUid)].restBeats) return;
    const t = shown(), n = beatsPerBar();
    setTiming(t.beats, t.rests);
    const restBeats = t.rests[indexOf(restUid)];
    const [moved] = state.prog.splice(j, 1);
    const i = indexOf(restUid);
    state.prog[i].rest = 0;
    state.prog.splice(i, 0, { ...moved, len: restBeats / n, rest: 0 });
    state.selected = moved.uid;
    state.selectedRest = null;
    update();
  }
  // Remove a rest: the chords after it move earlier to close the gap.
  function removeRest(uid) {
    const i = indexOf(uid);
    if (i < 0) return;
    const t = shown();
    setTiming(t.beats, t.rests);
    state.prog[i].rest = 0;
    if (state.selectedRest === uid) { state.selectedRest = null; state.selected = uid; }
    pendingFocus = `slot-${uid}`;
    update();
  }
  function selectRest(uid) {
    state.selectedRest = uid;
    state.selected = null;
    update();
  }
  function removeChord(uid) {
    const i = indexOf(uid);
    if (i < 0) return;
    const wasFocused = document.activeElement && document.activeElement.closest && document.activeElement.closest('.timeline, .inspector');
    state.prog.splice(i, 1); // its rest, if any, goes with it and the chords after it move earlier
    const next = state.prog[Math.min(i, state.prog.length - 1)];
    if (state.selected === uid) state.selected = next ? next.uid : null;
    if (state.selectedRest === uid) state.selectedRest = null;
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
    state.selectedRest = null;
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
        <span class="pal-tag">${esc(d.tag || FUNC[d.func].name)}</span>${likely.includes(d.id) ? '<span class="pal-next">often next</span>' : ''}</button>`;
    };
    const defs = Theory.DEFS[state.mode];
    $('#palDiatonic').innerHTML = defs.filter(d => d.src === 'diatonic').map(chip).join('');
    $('#palExtra').innerHTML = defs.filter(d => d.src !== 'diatonic').map(chip).join('');
    const ri = indexOf(state.selectedRest);
    setText($('#palHint'), ri >= 0
      ? `Click a chord to fill the ${D.spans[ri].restBeats}-beat rest before chord ${ri + 1}.`
      : ref
        ? `Click a chord to add it to the end, or drag it onto a chord in the progression to replace it, or onto a rest to fill it. "Often next" marks chords that commonly follow ${ref.text}.`
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
    const applyAll = `<div class="insp-row"><span class="lbl" id="lbl-all">Every chord</span><div class="presets" role="group" aria-labelledby="lbl-all">${all}</div></div>`;
    const ri = indexOf(state.selectedRest);
    if (ri >= 0 && D.spans[ri].restBeats) {
      const sp = D.spans[ri], full = state.prog.length >= 16;
      $('#inspector').innerHTML = `
        <div class="insp-head rest-head">
          <div class="insp-rn">Rest</div>
          <div class="insp-meta"><div class="insp-name">${lenText(sp.restBeats)} <span class="insp-bar">before chord ${ri + 1}, starts ${posText(sp.restStart)}</span></div></div>
        </div>
        <p class="insp-say">Nothing plays here; the beat keeps counting. ${full
          ? 'The progression already has 16 chords, the most it can hold, so remove a chord before filling this rest.'
          : 'Click a chord in the palette below to fill the rest exactly, or drag one onto it.'} Removing the rest closes the gap, and the chords after it move earlier.</p>
        <div class="insp-row"><span class="lbl" id="lbl-rest">Rest</span><div class="presets" role="group" aria-labelledby="lbl-rest">
          <button type="button" class="chip" data-act="rest-del" data-focus="act-rest-del">Remove rest</button>
          <button type="button" class="chip" data-act="rest-chord" data-focus="act-rest-chord">Select chord ${ri + 1}</button></div></div>
        ${applyAll}`;
      return;
    }
    if (i < 0) {
      $('#inspector').innerHTML = `<p class="insp-empty">Select a chord in your progression to change its length, color and inversion.</p>${applyAll}`;
      return;
    }
    const c = D.chords[i], inst = state.prog[i], sp = D.spans[i];
    const n = beatsPerBar();
    const at = posText(sp.startBeat);
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
          <div class="insp-name">${esc(c.name)} <span class="insp-bar">chord ${i + 1}, starts ${at}</span></div>
          <div class="insp-tags"><span class="fn-pill"><span class="akey" aria-hidden="true"></span>${FUNC[c.func].name}</span>
            ${c.def.tag ? `<span>${esc(cap(c.def.tag))}</span>` : ''}<span>Tension ${c.tension}</span></div>
        </div>
      </div>
      <p class="insp-say">${esc(describe(c, D.key))}</p>
      <ul class="insp-notes" aria-label="Chord tones">${c.tones.map(t => `<li><small>${ROLE[t.role]}</small>${esc(t.name)}</li>`).join('')}</ul>
      <div class="insp-row"><label class="lbl" for="inspChord">Chord</label><div><select id="inspChord" data-focus="inspChord">${options}</select></div></div>
      <div class="insp-row"><label class="lbl" for="inspLen">Length</label><div class="control">
        <div class="control-head"><span class="control-sub">1 beat to ${MAX_BARS} bars of ${esc(meter().id)}</span><output id="inspLenOut" for="inspLen" aria-live="off">${lenText(sp.beats)}</output></div>
        <input type="range" id="inspLen" data-focus="inspLen" min="1" max="${MAX_BARS * n}" step="1" value="${sp.beats}" aria-valuetext="${lenText(sp.beats)}" aria-describedby="inspLen-sub">
        <p class="control-sub" id="inspLen-sub">Snaps to each beat. The chords after this one move to make room. Dragging the chord's right edge does the same.</p></div></div>
      ${startRow(i)}
      <div class="insp-row"><span class="lbl" id="lbl-color">Color</span><div class="presets" role="group" aria-labelledby="lbl-color">${exts}</div></div>
      <div class="insp-row"><span class="lbl" id="lbl-inv">Inversion</span><div class="presets" role="group" aria-labelledby="lbl-inv">${invs}</div></div>
      <div class="insp-row"><span class="lbl" id="lbl-bar">Arrange</span><div class="presets" role="group" aria-labelledby="lbl-bar">
        <button type="button" class="chip" data-act="left" data-focus="act-left" ${i === 0 ? 'disabled title="Already the first chord"' : ''}>Move left</button>
        <button type="button" class="chip" data-act="right" data-focus="act-right" ${i === state.prog.length - 1 ? 'disabled title="Already the last chord"' : ''}>Move right</button>
        <button type="button" class="chip" data-act="dup" data-focus="act-dup" ${state.prog.length >= 16 ? 'disabled title="16 chords is the limit"' : ''}>Duplicate</button>
        <button type="button" class="chip" data-act="del" data-focus="act-del">Remove</button></div></div>
      ${applyAll}`;
  }

  // Where chord i may start when only its left side moves: no earlier than the end of the chord
  // before it (that chord never changes), at least one beat before its own end, and with neither the
  // rest nor the chord longer than MAX_BARS.
  function startBounds(i) {
    const sp = D.spans[i], end = sp.startBeat + sp.beats, max = MAX_BARS * beatsPerBar();
    return { lo: Math.max(sp.restStart, end - max), hi: Math.min(end - 1, sp.restStart + max) };
  }
  const STUCK = 'A one-beat chord right after the chord before it has no room to move its start. Make it longer first.';
  // Moving one of the two sliders changes both readouts, so the readouts are not live; the moved
  // slider's aria-valuetext announces the change once instead.
  function startRow(i) {
    const sp = D.spans[i], { lo, hi } = startBounds(i);
    const restNote = sp.restBeats ? ` after ${restPhrase(sp.restBeats)}` : '';
    return `<div class="insp-row"><label class="lbl" for="inspStart">Starts</label><div class="control">
        <div class="control-head"><span class="control-sub" id="inspStartRest">${restNote ? cap(restNote.trim()) : 'Right after the chord before'}</span><output id="inspStartOut" for="inspStart" aria-live="off">${posText(sp.startBeat)}</output></div>
        <input type="range" id="inspStart" data-focus="inspStart" min="${lo}" max="${hi}" step="1" value="${sp.startBeat}" aria-valuetext="${posText(sp.startBeat)}${restNote}" aria-describedby="inspStart-sub"${lo === hi ? ` disabled title="${STUCK}"` : ''}>
        <p class="control-sub" id="inspStart-sub">Moves only this chord's start; its end and every other chord stay put. Starting later leaves a rest, which plays silence and can take another chord. Dragging the chord's left edge does the same.</p></div></div>`;
  }
  // After either slider moves, bring the other slider, both readouts and the heading in line without rebuilding them.
  function syncTimingControls(i) {
    const sp = D.spans[i];
    const len = $('#inspLen');
    if (len) { len.value = sp.beats; len.setAttribute('aria-valuetext', lenText(sp.beats)); setText($('#inspLenOut'), lenText(sp.beats)); }
    const st = $('#inspStart');
    if (st) {
      const { lo, hi } = startBounds(i), restNote = sp.restBeats ? ` after ${restPhrase(sp.restBeats)}` : '';
      st.min = lo; st.max = hi; st.value = sp.startBeat;
      st.disabled = lo === hi;
      if (lo === hi) st.title = STUCK; else st.removeAttribute('title');
      st.setAttribute('aria-valuetext', posText(sp.startBeat) + restNote);
      setText($('#inspStartOut'), posText(sp.startBeat));
      setText($('#inspStartRest'), restNote ? cap(restNote.trim()) : 'Right after the chord before');
    }
    setText($('.insp-bar'), `chord ${i + 1}, starts ${posText(sp.startBeat)}`);
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
    if (state.playing && state.currentRest) {
      piano.show([]);
      setText($('#pianoNow'), `Rest before chord ${indexOf(state.currentRest) + 1}: nothing playing`);
      return;
    }
    const i = focusIndex();
    if (i < 0) { piano.show([]); setText($('#pianoNow'), 'No chord selected'); return; }
    const c = D.chords[i], v = D.voicings[i];
    piano.show([{ midi: v.bass, role: 'bass', name: toneName(c, v.bass), color: c.color },
      ...v.upper.map(m => ({ midi: m, role: 'upper', name: toneName(c, m), color: c.color }))]);
    setText($('#pianoNow'), `${state.playing ? 'Playing chord' : 'Chord'} ${i + 1}: ${c.name}, bass ${sciName(toneName(c, v.bass), v.bass)}`);
  }

  function renderCircle() {
    const key = D.key;
    const numerals = (pc, q) => {
      const d = Theory.DEFS[state.mode].find(x => x.src === 'diatonic' && Theory.mod(key.pc + x.root) === pc
        && Theory.quality(x.third, x.fifth) === q);
      return d ? Theory.resolve({ id: d.id }, key).text : '';
    };
    Views.circle($('#circle'), { key, chords: D.chords, current: state.playing ? state.current : -1, numerals, onPick: pickCircle, showPath: state.circlePath });
    $('#cofShow').checked = state.circlePath;
    $$('[data-cof-path]').forEach(li => { li.hidden = !state.circlePath; });
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
    const key = Theory.makeKey(pc, mode);
    const chord = Theory.resolve({ id: 'd0' }, key);
    Sound.playChord(Theory.voice([chord], 'smooth')[0]);
    if (state.circleClick === 'key') setKey(pc, mode);
    // The visible (and announced) equivalent of the sound: which chord played, and its notes.
    const played = `Played ${key.name} ${mode}: ${chord.tones.map(t => t.name).join(', ')}${state.circleClick === 'key' ? '. The key is now ' + key.name + ' ' + mode + '.' : '.'}`;
    const out = $('#cofPlayed');
    if (out.textContent === played) out.textContent = ''; // a repeat click is announced again
    setText(out, played);
    // Keep keyboard users on the wedge after the circle redraws; mouse clicks leave focus alone.
    const seg = $(`#circle .cof-seg[data-pc="${pc}"][data-mode="${mode}"]`);
    if (seg && viaKeyboard) seg.focus({ preventScroll: true });
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
      const sp = D.spans[i], n = beatsPerBar();
      return `<tr><td>${i + 1}</td><td>${esc(c.text)}, ${esc(c.name)}</td>
        <td>${FUNC[c.func].name}${c.def.tag ? `, ${esc(c.def.tag)}` : ''}</td>
        <td class="num">${sp.restBeats || '—'}</td>
        <td>Bar ${Math.floor(sp.startBeat / n) + 1}, beat ${(sp.startBeat % n) + 1}</td><td class="num">${sp.beats}</td><td class="num">${c.tension}</td>
        <td class="notes-cell">${nm(v.bass)}</td>
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
    const restAt = state.playing && state.currentRest ? indexOf(state.currentRest) : -1;
    setText($('#tensionNow'), restAt >= 0 ? `Rest before chord ${restAt + 1}`
      : c ? `${state.playing ? 'Playing chord' : 'Chord'} ${cur + 1}, ${c.text}: tension ${c.tension}` : '');
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
    const bar = barPulses(meter()); // previews play one bar per chord in the current meter
    const song = { voicings: v, spans: v.map((_, k) => ({ start: k * bar, end: (k + 1) * bar })), total: v.length * bar };
    Sound.start({
      getSong: () => song, tempo: () => state.tempo, meter, pattern: () => state.pattern, loop: false,
      onEnd: () => { state.preview = null; update(); },
    });
    state.preview = ref;
    update();
  }
  function load(insts, mode, tonic) {
    state.mode = mode;
    if (tonic != null) state.tonic = tonic;
    state.prog = insts.map(i => withUid({ id: i.id, ext: i.ext || 'triad', inv: i.inv || 0, len: i.len || 1, rest: i.rest || 0 }));
    state.selected = state.prog[0].uid;
    state.selectedRest = null;
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
        state.prog = seq.map(id => withUid({ id, ext: 'triad', inv: 0, len: 1, rest: 0 }));
        state.selected = state.prog[0].uid;
        state.selectedRest = null;
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
    $('#cofShow').addEventListener('change', e => { state.circlePath = e.target.checked; save(); renderCircle(); });
    $('#suggest').addEventListener('click', suggest);
    $('#clear').addEventListener('click', () => { if (state.playing) stop(); state.prog = []; state.selected = null; state.selectedRest = null; update(); });

    const tl = $('#timeline');
    tl.addEventListener('click', e => {
      const del = e.target.closest('[data-del]');
      if (del) { removeChord(+del.dataset.del); return; }
      const restDel = e.target.closest('[data-rest-del]');
      if (restDel) { removeRest(+restDel.dataset.restDel); return; }
      if (e.target.closest('.slot-grip')) return; // a drag ends by selecting its chord
      const rest = e.target.closest('.rest-main');
      if (rest) { selectRest(+rest.closest('.slot').dataset.restFor); return; }
      const slot = e.target.closest('.slot-main');
      if (slot) { selectChord(+slot.closest('.slot').dataset.uid); return; }
      // The continuation of a chord or rest on the next row selects it too (pointer only; the
      // chord's own button is the keyboard route).
      const cont = e.target.closest('[data-cont-of]'), contRest = e.target.closest('[data-cont-rest]');
      if (cont) selectChord(+cont.dataset.contOf);
      else if (contRest) selectRest(+contRest.dataset.contRest);
    });
    // Delete and Backspace act only on the focused chord or rest (a component shortcut, not a page-wide one).
    tl.addEventListener('keydown', e => {
      if (e.key !== 'Delete' && e.key !== 'Backspace') return;
      const slot = e.target.closest('.slot-main'), rest = e.target.closest('.rest-main');
      if (slot) { e.preventDefault(); removeChord(+slot.closest('.slot').dataset.uid); }
      else if (rest) { e.preventDefault(); removeRest(+rest.closest('.slot').dataset.restFor); }
    });

    // Resize by either edge, snapped to whole beats. The right edge changes the chord's length and
    // every chord after it shifts to make room. The left edge moves only the chord's start: its end
    // and every other chord stay put, so starting later leaves a rest (silence) before it, and it can
    // move back no earlier than the end of the chord before. The Chord panel's Length and Starts
    // sliders are the keyboard routes. Changes apply on release, so a cancelled drag undoes itself.
    tl.addEventListener('pointerdown', e => {
      const grip = e.target.closest('.slot-grip');
      if (!grip || e.button > 0) return;
      const uid = +grip.dataset.gripFor, slot = $(`#timeline .slot[data-uid="${uid}"]`), i = indexOf(uid);
      const fromLeft = grip.classList.contains('left');
      if (i < 0 || !slot) return;
      e.preventDefault();
      const t0 = shown(), trial = t0.beats.slice(), rests = t0.rests.slice(), sp = D.spans[i];
      const startBeat = sp.startBeat, end = sp.startBeat + sp.beats;
      const max = MAX_BARS * beatsPerBar();
      // Where the pointer is on the wrapped lane: which row, and how far along it.
      const at = ev => {
        const box = $('#lane').getBoundingClientRect();
        return { x: ev.clientX - box.left, row: Math.max(0, Math.floor((ev.clientY - box.top) / laneGeom.pitch)) };
      };
      // The beat (between lo and hi) nearest the pointer. A beat on a row boundary can be reached at
      // the end of one row or the start of the next; beats can be uneven, as in 7/8.
      const nearestBeat = (lo, hi, p) => {
        const g = laneGeom;
        const cost = (r, x) => Math.abs(r - p.row) * 1e5 + Math.abs(x - p.x);
        let best = lo, bestD = Infinity;
        for (let k = lo; k <= hi; k++) {
          const r = Math.floor(k / g.rowBeats);
          let d = cost(r, beatX(k, g.px) - r * g.rowW);
          if (k > 0 && k % g.rowBeats === 0) d = Math.min(d, cost(r - 1, g.rowW));
          if (d < bestD) { bestD = d; best = k; }
        }
        return best;
      };
      slot.draggable = false; // keep the browser's reorder drag from starting
      slot.classList.add('resizing');
      grip.classList.add('active');
      try { grip.setPointerCapture(e.pointerId); } catch (err) { /* capture refused: the window listeners below still see the drag */ }
      const move = ev => {
        const p = at(ev);
        if (fromLeft) {
          const { lo, hi } = startBounds(i), b = nearestBeat(lo, hi, p);
          if (end - b !== trial[i]) { trial[i] = end - b; rests[i] = b - sp.restStart; layoutTimeline(trial, rests); }
        } else {
          const k = nearestBeat(startBeat + 1, startBeat + max, p) - startBeat;
          if (k !== trial[i]) { trial[i] = k; layoutTimeline(trial, rests); }
        }
      };
      const done = ev => {
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', done);
        window.removeEventListener('pointercancel', done);
        slot.draggable = true;
        slot.classList.remove('resizing');
        grip.classList.remove('active');
        if (ev.type === 'pointercancel') { const t = shown(); layoutTimeline(t.beats, t.rests); return; }
        state.selected = uid;
        state.selectedRest = null;
        if (trial.some((v, k) => v !== t0.beats[k]) || rests.some((v, k) => v !== t0.rests[k])) setTiming(trial, rests);
        update();
      };
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', done);
      window.addEventListener('pointercancel', done);
    });

    // Drag and drop is optional: the palette adds with a click and the Chord panel moves and replaces chords.
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
    // A continuation box on the next row stands for the chord or rest it continues.
    const mainOf = el => {
      if (el && el.dataset.contOf) return $(`#timeline .slot[data-uid="${el.dataset.contOf}"]`);
      if (el && el.dataset.contRest) return $(`#timeline .slot[data-rest-for="${el.dataset.contRest}"]`);
      return el;
    };
    tl.addEventListener('drop', e => {
      const t = mainOf(e.target.closest('.slot'));
      if (!t) return;
      e.preventDefault();
      let data;
      try { data = JSON.parse(e.dataTransfer.getData('text/plain')); } catch (err) { return; }
      // Onto a rest: a palette chord or a chord from the timeline fills it exactly.
      tl.querySelectorAll('.drop').forEach(x => x.classList.remove('drop'));
      if (t.dataset.restFor) {
        if (data.id) fillRest(+t.dataset.restFor, { id: data.id, ext: 'triad', inv: 0 });
        else if (data.uid) moveIntoRest(data.uid, +t.dataset.restFor);
        return;
      }
      const target = t.dataset.uid ? indexOf(+t.dataset.uid) : state.prog.length;
      if (data.id) {
        if (t.dataset.uid) state.prog[target] = { ...state.prog[target], id: data.id, ext: 'triad', inv: 0 };
        else if (state.prog.length < 16) state.prog.push(withUid({ id: data.id, ext: 'triad', inv: 0, len: 1 }));
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
      if (b.dataset.act === 'rest-del') { removeRest(state.selectedRest); return; }
      if (b.dataset.act === 'rest-chord') { const uid = state.selectedRest; pendingFocus = `slot-${uid}`; selectChord(uid); return; }
      const i = indexOf(state.selected);
      if (i < 0) return;
      const inst = state.prog[i];
      if (b.dataset.ext) { inst.ext = b.dataset.ext; inst.inv = Math.min(inst.inv, Theory.invCount(inst.ext) - 1); }
      else if (b.dataset.inv) inst.inv = +b.dataset.inv;
      else if (b.dataset.act === 'left') { moveChord(inst.uid, i - 1); return; }
      else if (b.dataset.act === 'right') { moveChord(inst.uid, i + 1); return; }
      else if (b.dataset.act === 'dup') { const copy = withUid({ ...inst, rest: 0 }); state.prog.splice(i + 1, 0, copy); state.selected = copy.uid; }
      else if (b.dataset.act === 'del') { removeChord(inst.uid); return; }
      update();
      if ((b.dataset.ext || b.dataset.inv) && !state.playing) Sound.playChord(D.voicings[i]);
    });
    // Length and Starts sliders: apply on every step (arrow keys included) without rebuilding the
    // sliders themselves. Length moves the chords after this one; Starts moves nothing else.
    $('#inspector').addEventListener('input', e => {
      const id = e.target.id;
      if (id !== 'inspLen' && id !== 'inspStart') return;
      const i = indexOf(state.selected);
      if (i < 0) return;
      const t = shown(), v = +e.target.value, sp = D.spans[i];
      if (id === 'inspLen') t.beats[i] = v;
      else { t.beats[i] = sp.startBeat + sp.beats - v; t.rests[i] = v - sp.restStart; }
      setTiming(t.beats, t.rests);
      update({ keepInspector: true });
      syncTimingControls(i);
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
      // Show which chord sounded on its own notes (thick accent outlines), not with a wash over the column.
      vl.querySelectorAll(`[data-colnote="${i}"]`).forEach(g => flash(g, 'ring'));
      const col = vl.querySelector(`[data-col="${i}"]`);
      if (col && refocus) col.focus({ preventScroll: true });
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
  // Theme and presentation changes re-measure drawings; the lane's beat width follows the root size.
  Chrome.init({ refresh: () => { renderViews(); const t = shown(); layoutTimeline(t.beats, t.rests); fitAll(); } });
  if (window.ResizeObserver) {
    const ro = new ResizeObserver(queueFit);
    $$('.visual-scroll, #circle, #tension, #lane').forEach(el => ro.observe(el));
  }
  // Backstops: observer callbacks are held while a tab is hidden, so also re-fit on window resize
  // and when the tab comes back into view.
  window.addEventListener('resize', queueFit);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) queueFit(); });
  window.app = { state, derived: () => D };
})();
