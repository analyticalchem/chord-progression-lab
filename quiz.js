/* Progression Lab: ear-training quiz. */
const Quiz = (() => {
  'use strict';
  const MODES = {
    prog: { label: 'Progressions', prompt: 'Which progression is this?' },
    cad: { label: 'Cadences', prompt: 'How does this phrase end?' },
    deg: { label: 'Chord in the key', prompt: 'After the key is set up, which chord plays last?' },
  };
  const PROG_POOL = ['Axis', '1950s', 'Axis from vi', 'ii–V–I', 'Andalusian cadence', 'Mixolydian vamp', 'Minor pop loop', 'The minor iv'];
  const pick = a => a[Math.floor(Math.random() * a.length)];
  const shuffle = a => a.map(x => [Math.random(), x]).sort((p, q) => p[0] - q[0]).map(p => p[1]);
  const esc = s => Views.esc(s);

  let el, api, body, status;
  const state = { mode: 'prog', randomKey: true, right: 0, total: 0, streak: 0, q: null, playing: -1, clip: false };

  // "an authentic cadence", "a Phrygian half cadence" (Phrygian is a proper name and keeps its capital).
  function cadenceName(name) {
    const n = name.startsWith('Phrygian') ? name : name.toLowerCase();
    return `${/^[aeiou]/i.test(n) ? 'an' : 'a'} ${n} cadence`;
  }

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
        answer: CADENCES.indexOf(target), reveal: cadenceName(target.name),
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
    const voiced = Theory.voice(chords.filter(Boolean), 'smooth');
    let k = 0;
    const voicings = chords.map(c => (c ? voiced[k++] : null));
    Sound.sequence(voicings, q.durs, i => { state.playing = i; renderPlaying(); }, () => endClip());
    state.clip = true;
    renderReplay();
  }
  function endClip() {
    state.clip = false;
    state.playing = -1;
    renderPlaying();
    renderReplay();
  }

  function answer(i) {
    const q = state.q;
    if (!q || q.picked != null) return;
    q.picked = i;
    state.total++;
    const right = i === q.answer;
    if (right) { state.right++; state.streak++; } else state.streak = 0;
    const where = `in ${q.key.name} ${q.key.mode}`;
    status.className = 'qz-status ' + (right ? 'good' : 'bad');
    Chrome.setText(status, right
      ? `✓ Correct. That was ${q.reveal} ${where}. Score ${state.right} of ${state.total}.`
      : `✕ Not this time. That was ${q.reveal} ${where}. Score ${state.right} of ${state.total}.`);
    renderScore();
    renderBody();
    // The answer buttons are now disabled, so focus moves on to the next step.
    const nextBtn = body.querySelector('[data-q="next"]');
    if (nextBtn) nextBtn.focus();
  }

  function next() {
    state.q = makeQuestion();
    status.className = 'qz-status';
    Chrome.setText(status, MODES[state.mode].prompt);
    renderBody();
    play();
    const first = body.querySelector('.qz-opt');
    if (first) first.focus();
  }

  function renderPlaying() {
    body.querySelectorAll('.qz-beat').forEach((d, i) => d.classList.toggle('on', i === state.playing));
  }
  function renderReplay() {
    const b = body.querySelector('[data-q="replay"]');
    if (b) Chrome.setText(b, state.clip ? 'Stop' : 'Hear it again');
  }
  function renderScore() {
    Chrome.setText(el.querySelector('#qzRight'), String(state.right));
    Chrome.setText(el.querySelector('#qzTotal'), String(state.total));
    Chrome.setText(el.querySelector('#qzStreak'), `Streak ${state.streak}`);
  }
  function renderModes() {
    el.querySelectorAll('[data-qmode]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.qmode === state.mode)));
  }

  function renderBody() {
    const q = state.q;
    if (!q) {
      body.innerHTML = `<div class="qz-empty"><p>${MODES[state.mode].prompt} Press Start and listen. Each question plays in ${state.randomKey ? 'a random key' : 'the current key'}.</p>
        <button type="button" class="btn primary" data-q="start">Start</button></div>`;
      return;
    }
    const done = q.picked != null;
    const beats = q.insts.map(i => `<span class="qz-beat${i ? '' : ' rest'}"></span>`).join('');
    const opts = q.options.map((o, i) => {
      const isRight = done && i === q.answer, isWrong = done && i === q.picked && !isRight;
      const mark = isRight ? '<span class="qz-mark">✓ Answer</span>' : isWrong ? '<span class="qz-mark">✕ Your pick</span>' : '';
      return `<button type="button" class="qz-opt${isRight ? ' right' : ''}${isWrong ? ' wrong' : ''}" data-opt="${i}" ${done ? 'disabled' : ''}>
        <span class="${o.rn ? 'qz-rn' : 'qz-label'}">${esc(o.label)}</span>${o.sub ? `<span class="qz-sub">${esc(o.sub)}</span>` : ''}${mark}</button>`;
    }).join('');
    body.innerHTML = `<div class="qz-play">
        <button type="button" class="btn" data-q="replay">${state.clip ? 'Stop' : 'Hear it again'}</button>
        <div class="qz-beats" aria-hidden="true">${beats}</div>
      </div>
      <div class="qz-opts${state.mode === 'deg' ? ' seven' : ''}" role="group" aria-label="Answers">${opts}</div>
      ${done ? `<div class="qz-after"><button type="button" class="btn primary" data-q="next">Next question</button>
        <button type="button" class="btn" data-q="load">Open in builder</button></div>` : ''}`;
  }

  function init(root, appApi) {
    el = root;
    api = appApi;
    const modes = Object.entries(MODES).map(([k, m]) =>
      `<button type="button" class="chip" data-qmode="${k}" aria-pressed="${state.mode === k}">${m.label}</button>`).join('');
    el.innerHTML = `<div class="qz-head">
        <div class="presets" role="group" aria-label="Quiz type">${modes}</div>
        <label class="check"><input type="checkbox" id="qzRandom" ${state.randomKey ? 'checked' : ''}> Random key</label>
        <p class="qz-score"><strong id="qzRight">0</strong> / <span id="qzTotal">0</span> correct<span id="qzStreak">Streak 0</span></p>
      </div>
      <p class="qz-status" id="qzStatus" role="status"></p>
      <div class="qz-body" id="qzBody"></div>`;
    body = el.querySelector('#qzBody');
    status = el.querySelector('#qzStatus');
    Sound.onChange(on => { if (!on && state.clip) endClip(); });
    el.addEventListener('click', e => {
      const b = e.target.closest('button');
      if (!b) return;
      if (b.dataset.qmode) {
        state.mode = b.dataset.qmode;
        state.q = null;
        if (state.clip) Sound.stop();
        status.className = 'qz-status';
        Chrome.setText(status, '');
        renderModes();
        renderBody();
        return;
      }
      if (b.dataset.opt != null) { answer(+b.dataset.opt); return; }
      const act = b.dataset.q;
      if (act === 'start' || act === 'next') next();
      else if (act === 'replay') { if (state.clip) Sound.stop(); else play(); }
      else if (act === 'load' && state.q) api.load(state.q.insts.filter(Boolean), state.q.key.mode, state.q.key.pc);
    });
    el.addEventListener('change', e => {
      if (e.target.id === 'qzRandom') { state.randomKey = e.target.checked; if (!state.q) renderBody(); }
    });
    renderBody();
  }

  return { init };
})();
