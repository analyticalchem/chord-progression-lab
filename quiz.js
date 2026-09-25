/* Progression Lab: ear-training quiz. */
const Quiz = (() => {
  const MODES = {
    prog: { label: 'Progressions', prompt: 'Which progression is this?' },
    cad: { label: 'Cadences', prompt: 'How does this phrase end?' },
    deg: { label: 'Chord in the key', prompt: 'After the key is set up, which chord plays last?' },
  };
  const PROG_POOL = ['Axis', '1950s', 'Axis from vi', 'ii–V–I', 'Andalusian cadence', 'Mixolydian vamp', 'Minor pop loop', 'The minor iv'];
  const pick = a => a[Math.floor(Math.random() * a.length)];
  const shuffle = a => a.map(x => [Math.random(), x]).sort((p, q) => p[0] - q[0]).map(p => p[1]);

  let el, api;
  const state = { mode: 'prog', randomKey: true, right: 0, total: 0, streak: 0, q: null, playing: -1 };

  function numerals(insts, key) {
    return insts.map(i => Theory.resolve(i, key).text).join(' – ');
  }

  function makeQuestion() {
    const pc = state.randomKey ? Math.floor(Math.random() * 12) : api.key().pc;
    if (state.mode === 'prog') {
      const pool = PRESETS.filter(p => PROG_POOL.includes(p.name));
      const target = pick(pool);
      const opts = shuffle([target, ...shuffle(pool.filter(p => p !== target)).slice(0, 3)]);
      const key = Theory.makeKey(pc, target.mode);
      return {
        key, insts: toInsts(target.prog), durs: 1.4,
        options: opts.map(p => ({ label: p.name, sub: numerals(toInsts(p.prog), Theory.makeKey(pc, p.mode)) })),
        answer: opts.indexOf(target), reveal: target.name,
      };
    }
    if (state.mode === 'cad') {
      const target = pick(CADENCES);
      const key = Theory.makeKey(pc, target.mode);
      return {
        key, insts: toInsts(target.prog), durs: [1.2, 1.2, 2.4],
        options: CADENCES.map(c => ({ label: c.name, sub: c.short })),
        answer: CADENCES.indexOf(target), reveal: `${target.name} cadence`,
      };
    }
    const key = Theory.makeKey(pc, 'major');
    const deg = Math.floor(Math.random() * 7);
    const context = toInsts([['d0'], ['d3'], ['d4', 'b7'], ['d0']]);
    return {
      key, insts: [...context, null, { id: 'd' + deg, ext: 'triad', inv: 0 }],
      durs: [0.7, 0.7, 0.7, 1.1, 0.5, 2.2],
      options: Theory.DEFS.major.slice(0, 7).map(d => ({ label: Theory.resolve({ id: d.id }, key).text, rn: true })),
      answer: deg, reveal: Theory.resolve({ id: 'd' + deg }, key).text,
    };
  }

  function play() {
    const q = state.q;
    if (!q) return;
    api.stopMain();
    const chords = q.insts.map(i => (i ? Theory.resolve(i, q.key) : null));
    const real = chords.filter(Boolean);
    const voiced = Theory.voice(real, 'smooth');
    let k = 0;
    const voicings = chords.map(c => (c ? voiced[k++] : null));
    Sound.sequence(voicings, q.durs, i => { state.playing = i; renderPlaying(); }, () => { state.playing = -1; renderPlaying(); });
  }

  function answer(i) {
    const q = state.q;
    if (!q || q.picked != null) return;
    q.picked = i;
    state.total++;
    if (i === q.answer) { state.right++; state.streak++; } else state.streak = 0;
    render();
  }

  function next() {
    state.q = makeQuestion();
    render();
    play();
  }

  function renderPlaying() {
    const dots = el.querySelectorAll('.qz-beat');
    dots.forEach((d, i) => d.classList.toggle('on', i === state.playing));
  }

  function render() {
    const q = state.q;
    const tabs = Object.entries(MODES).map(([k, m]) =>
      `<button type="button" class="seg-btn${state.mode === k ? ' on' : ''}" data-qmode="${k}" aria-pressed="${state.mode === k}">${m.label}</button>`).join('');
    let body = '';
    if (!q) {
      body = `<div class="qz-empty"><p>${MODES[state.mode].prompt} Press start and listen. Each question plays in ${state.randomKey ? 'a random key' : 'the current key'}.</p>
        <button type="button" class="btn primary" data-q="start">Start</button></div>`;
    } else {
      const done = q.picked != null;
      const beats = q.insts.map(i => `<span class="qz-beat${i ? '' : ' rest'}"></span>`).join('');
      const opts = q.options.map((o, i) => {
        let cls = 'qz-opt';
        if (done && i === q.answer) cls += ' right';
        else if (done && i === q.picked) cls += ' wrong';
        return `<button type="button" class="${cls}" data-opt="${i}" ${done ? 'disabled' : ''}>
          <span class="${o.rn ? 'qz-rn' : 'qz-label'}">${Views.esc(o.label)}</span>${o.sub ? `<span class="qz-sub">${Views.esc(o.sub)}</span>` : ''}</button>`;
      }).join('');
      const fb = !done ? `<p class="qz-feedback">${MODES[state.mode].prompt}</p>`
        : q.picked === q.answer
          ? `<p class="qz-feedback good">Correct. That was ${Views.esc(q.reveal)} in ${Views.esc(q.key.name)} ${q.key.mode}.</p>`
          : `<p class="qz-feedback bad">Not this time. That was ${Views.esc(q.reveal)} in ${Views.esc(q.key.name)} ${q.key.mode}.</p>`;
      body = `<div class="qz-play">
          <button type="button" class="btn" data-q="replay">Hear it again</button>
          <div class="qz-beats" aria-hidden="true">${beats}</div>
        </div>
        ${fb}
        <div class="qz-opts${state.mode === 'deg' ? ' seven' : ''}">${opts}</div>
        ${done ? `<div class="qz-after"><button type="button" class="btn primary" data-q="next">Next question</button>
          <button type="button" class="btn" data-q="load">Open in builder</button></div>` : ''}`;
    }
    el.innerHTML = `<div class="qz-head">
        <div class="seg" role="group" aria-label="Quiz type">${tabs}</div>
        <label class="check"><input type="checkbox" id="qzRandom" ${state.randomKey ? 'checked' : ''}> Random key</label>
        <div class="qz-score" aria-live="polite"><strong>${state.right}</strong> / ${state.total} correct<span>Streak ${state.streak}</span></div>
      </div>${body}`;
  }

  function init(root, appApi) {
    el = root;
    api = appApi;
    el.addEventListener('click', e => {
      const b = e.target.closest('button');
      if (!b) return;
      if (b.dataset.qmode) { state.mode = b.dataset.qmode; state.q = null; render(); return; }
      if (b.dataset.opt != null) { answer(+b.dataset.opt); return; }
      const act = b.dataset.q;
      if (act === 'start' || act === 'next') next();
      else if (act === 'replay') play();
      else if (act === 'load' && state.q) {
        api.load(state.q.insts.filter(Boolean), state.q.key.mode, state.q.key.pc);
      }
    });
    el.addEventListener('change', e => {
      if (e.target.id === 'qzRandom') { state.randomKey = e.target.checked; if (!state.q) render(); }
    });
    render();
  }

  return { init };
})();
