/* Progression Lab: Web Audio electric-piano synth and a lookahead transport. */
const Sound = (() => {
  let ctx = null, master = null, run = null;
  const val = x => (typeof x === 'function' ? x() : x);
  const freq = m => 440 * Math.pow(2, (m - 69) / 12);

  function impulse(seconds, decay) {
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const data = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
    return buf;
  }

  // iPhone mutes Web Audio in silent mode unless the page's audio session is "playback".
  // iOS 17+ exposes that setting directly; older iOS switches to playback while a media element plays.
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  let silentEl = null;
  function silentWavUrl() {
    const rate = 8000, n = rate / 2;
    const buf = new ArrayBuffer(44 + n * 2), v = new DataView(buf);
    const str = (o, s) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
    str(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); str(8, 'WAVE'); str(12, 'fmt ');
    v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
    v.setUint32(24, rate, true); v.setUint32(28, rate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
    str(36, 'data'); v.setUint32(40, n * 2, true);
    return URL.createObjectURL(new Blob([buf], { type: 'audio/wav' }));
  }
  function playThroughSilentMode() {
    try {
      if (navigator.audioSession) { navigator.audioSession.type = 'playback'; return; }
    } catch (e) { /* fall through to the media-element approach */ }
    if (!isIOS) return;
    if (!silentEl) {
      silentEl = document.createElement('audio');
      silentEl.setAttribute('x-webkit-airplay', 'deny');
      silentEl.loop = true;
      silentEl.src = silentWavUrl();
      document.addEventListener('visibilitychange', () => { if (document.hidden) silentEl.pause(); });
    }
    if (silentEl.paused) silentEl.play().catch(() => {});
  }

  // Overall volume (0–1), applied to the master gain.
  const MASTER = 0.9;
  let volume = 0.8;
  function setVolume(v) {
    volume = Math.max(0, Math.min(1, v));
    if (master) master.gain.setTargetAtTime(MASTER * volume, ctx.currentTime, 0.02);
  }
  document.addEventListener('visibilitychange', () => { if (!document.hidden && ctx) resume(); });

  // Called from every tap that makes sound, so it also runs inside a user gesture.
  function init() {
    playThroughSilentMode();
    if (ctx) {
      // iOS can leave the context "interrupted" after a call or app switch; any non-running state resumes.
      resume();
      return ctx;
    }
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18;
    comp.ratio.value = 4;
    comp.attack.value = 0.004;
    comp.release.value = 0.25;
    master = ctx.createGain();
    master.gain.value = MASTER * volume;
    const verb = ctx.createConvolver();
    verb.buffer = impulse(2.4, 3.2);
    const wet = ctx.createGain();
    wet.gain.value = 0.2;
    master.connect(comp);
    master.connect(verb);
    verb.connect(wet);
    wet.connect(comp);
    comp.connect(ctx.destination);
    resume();
    return ctx;
  }
  function resume() {
    if (ctx.state === 'running') return;
    const p = ctx.resume(); // older Safari returns undefined instead of a promise
    if (p && p.catch) p.catch(() => {});
  }

  function panned(out, midi) {
    if (!ctx.createStereoPanner) return out;
    const p = ctx.createStereoPanner();
    p.pan.value = Math.max(-0.6, Math.min(0.6, (midi - 64) / 40));
    p.connect(out);
    return p;
  }

  // Two-operator FM gives a tine-like electric piano.
  function keys(out, midi, t, dur, vel) {
    const f = freq(midi);
    const car = ctx.createOscillator();
    car.frequency.value = f;
    const modOsc = ctx.createOscillator();
    modOsc.frequency.value = f;
    const modGain = ctx.createGain();
    const index = f * (midi < 55 ? 1.1 : 1.7) * vel;
    modGain.gain.setValueAtTime(index, t);
    modGain.gain.setTargetAtTime(index * 0.15, t + 0.01, 0.3);
    modOsc.connect(modGain);
    modGain.connect(car.frequency);

    const tine = ctx.createOscillator();
    tine.frequency.value = f * 4;
    const tineGain = ctx.createGain();
    tineGain.gain.setValueAtTime(0, t);
    tineGain.gain.linearRampToValueAtTime(0.045 * vel, t + 0.003);
    tineGain.gain.setTargetAtTime(0, t + 0.006, 0.035);
    tine.connect(tineGain);

    const amp = ctx.createGain();
    const peak = 0.15 * vel;
    amp.gain.setValueAtTime(0, t);
    amp.gain.linearRampToValueAtTime(peak, t + 0.006);
    amp.gain.setTargetAtTime(peak * 0.3, t + 0.02, 0.9);
    amp.gain.setTargetAtTime(0, t + dur, 0.09);
    car.connect(amp);
    tineGain.connect(amp);
    amp.connect(panned(out, midi));

    const end = t + dur + 0.7;
    [car, modOsc, tine].forEach(o => { o.start(t); o.stop(end); });
  }

  // Bass level (0–2) and octave doubling, set from the transport.
  let bassLevel = 1, bassOctave = false;
  function setBass(level, octave) {
    bassLevel = Math.max(0, Math.min(2, level));
    bassOctave = !!octave;
  }

  // Small speakers can't reproduce a 65–165 Hz fundamental, so the bass carries strong upper
  // harmonics; the ear rebuilds the low pitch from them.
  function bass(out, midi, t, dur, vel) {
    if (bassLevel <= 0) return;
    const f = freq(midi);
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 40;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.Q.value = 0.5;
    lp.frequency.value = Math.min(1500, f * 6);
    const amp = ctx.createGain();
    const peak = 0.26 * vel * bassLevel;
    amp.gain.setValueAtTime(0, t);
    amp.gain.linearRampToValueAtTime(peak, t + 0.012);
    amp.gain.setTargetAtTime(peak * 0.6, t + 0.03, 0.8);
    amp.gain.setTargetAtTime(0, t + dur, 0.08);
    // Pure sine harmonics (no sawtooth) keep the tone round while the 2nd–4th carry the pitch.
    const partials = [[1, 1], [2, 0.5], [3, 0.22], [4, 0.1]];
    const oscs = partials.map(([mult, gain]) => {
      const o = ctx.createOscillator();
      o.frequency.value = f * mult;
      const g = ctx.createGain();
      g.gain.value = gain;
      o.connect(g);
      g.connect(hp);
      return o;
    });
    hp.connect(lp);
    lp.connect(amp);
    amp.connect(out);
    const end = t + dur + 0.6;
    oscs.forEach(o => { o.start(t); o.stop(end); });
    keys(out, midi, t, dur, vel * 0.55 * bassLevel);
    if (bassOctave) keys(out, midi + 12, t, dur, vel * 0.5 * bassLevel);
  }

  // One bar of a pattern in a meter, timed in eighth-note pulses. Accents: the downbeat is loudest,
  // the meter's other strong beats next, remaining beats after that, and in-between pulses softest.
  function barEvents(meter, pattern) {
    const starts = [];
    let total = 0;
    meter.beats.forEach(n => { starts.push(total); total += n; });
    const accent = b => (b === 0 ? 1 : meter.strong.includes(b) ? 0.85 : 0.72);
    const ev = [];
    const add = (part, at, len, vel, extra) => ev.push({ part, at, len, vel, ...extra });
    if (pattern === 'pulse') {
      add('bass', 0, total, 0.85);
      starts.forEach((s, b) => add('chord', s, meter.beats[b] * 0.9, accent(b)));
    } else if (pattern === 'arpeggio') {
      add('bass', 0, total, 0.85);
      for (let i = 0; i < total; i++) {
        const b = starts.lastIndexOf(starts.filter(s => s <= i).pop());
        add('arp', i, 1.6, starts.includes(i) ? accent(b) * 0.85 : 0.55, { idx: i });
      }
    } else if (pattern === 'oompah') {
      // Beats of three become bass–chord–chord; beats of two alternate bass on strong beats, chord on the rest.
      starts.forEach((s, b) => {
        const n = meter.beats[b];
        if (n === 3) {
          add('bass', s, 1.2, accent(b));
          add('chord', s + 1, 0.9, 0.62);
          add('chord', s + 2, 0.9, 0.56);
        } else if (b === 0 || meter.strong.includes(b)) add('bass', s, n, accent(b));
        else add('chord', s, n * 0.8, accent(b));
      });
    } else {
      add('bass', 0, total, 0.85);
      add('chord', 0, total, 0.85, { roll: 0.012 });
    }
    return { total, ev };
  }

  const pulseSeconds = (meter, tempo) => 60 / tempo / meter.perBeat;
  const barSeconds = (meter, tempo) => meter.beats.reduce((s, n) => s + n, 0) * pulseSeconds(meter, tempo);

  // Schedule one bar (or the part of it from `offset`) of a song whose chords can start mid-bar
  // or last several bars. The pattern follows the meter; each note takes the chord sounding at
  // its moment and stops where that chord ends. song: { voicings, spans: [{ start, end }], total } in pulses.
  function scheduleSegment(song, pos, offset, len, t, meter, pattern, pulse, out) {
    const events = barEvents(meter, pattern).ev
      .filter(e => e.at >= offset && e.at < offset + len)
      .map(e => ({ ...e, g: pos + e.at - offset }));
    const starts = [];
    song.spans.forEach((s, i) => {
      if (s.start < pos || s.start >= pos + len) return;
      starts.push({ i, g: s.start });
      // A chord change always sounds its bass and chord at once, wherever it falls in the bar.
      if (!events.some(e => e.g === s.start && e.part === 'bass')) events.push({ part: 'bass', g: s.start, len: Infinity, vel: 0.85 });
      if (pattern !== 'arpeggio' && !events.some(e => e.g === s.start && e.part === 'chord')) {
        events.push({ part: 'chord', g: s.start, len: pattern === 'sustain' ? Infinity : 0.9, vel: 0.8, roll: 0.012 });
      }
    });
    const chordAt = g => song.spans.findIndex(s => g >= s.start && g < s.end);
    events.forEach(e => {
      const ci = chordAt(e.g);
      if (ci < 0) return;
      const v = song.voicings[ci];
      const end = Math.min(e.g + e.len, song.spans[ci].end, pos + len);
      const at = t + (e.g - pos) * pulse, dur = (end - e.g) * pulse;
      if (dur <= 0) return;
      if (e.part === 'bass') bass(out, v.bass, at, dur, e.vel);
      else if (e.part === 'arp') {
        const up = [...v.upper].sort((a, b) => a - b);
        const cycle = up.concat(up.slice(1, -1).reverse());
        keys(out, cycle[e.idx % cycle.length], at, dur, e.vel);
      } else {
        // A rolled chord starts each note a little later, so each also ends a little sooner.
        v.upper.forEach((m, i) => {
          const lag = (e.roll || 0) * i;
          keys(out, m, at + lag, Math.max(0.02, dur - lag), e.vel * 0.9);
        });
      }
    });
    return starts;
  }

  // Listeners hear whenever playback of any kind starts or stops, so every Stop control stays in step.
  const listeners = [];
  const notify = () => listeners.forEach(fn => fn(!!run));
  function onChange(fn) { listeners.push(fn); }

  function later(r, time, fn) {
    r.timers.push(setTimeout(fn, Math.max(0, (time - ctx.currentTime) * 1000)));
  }

  // opts: { getSong, tempo, meter, pattern, loop, onChord(i), onPulse(k), onEnd() }.
  // getSong() returns { voicings, spans, total } in pulses; it and tempo, meter, pattern and loop
  // are read as playback goes, so edits apply from the next bar. Each loop restarts at beat 1.
  function start(opts) {
    init();
    stop();
    const bus = ctx.createGain();
    bus.connect(master);
    const r = { ...opts, bus, pos: 0, next: ctx.currentTime + 0.08, timers: [], ended: false };
    run = r;
    const finish = () => {
      r.ended = true;
      later(r, r.next, () => { if (run === r) { stop(); r.onEnd && r.onEnd(); } });
    };
    const tick = () => {
      while (!r.ended && r.next < ctx.currentTime + 0.15) {
        const song = r.getSong();
        if (!song.total) { finish(); break; }
        if (r.pos >= song.total) {
          if (val(r.loop)) r.pos = 0;
          else { finish(); break; }
        }
        const meter = val(r.meter), pulse = pulseSeconds(meter, val(r.tempo));
        const barLen = meter.beats.reduce((s, n) => s + n, 0);
        // Normally a whole bar; shorter after a meter change mid-bar or when the song ends mid-bar.
        const offset = r.pos % barLen, len = Math.min(barLen - offset, song.total - r.pos), at = r.next;
        const starts = scheduleSegment(song, r.pos, offset, len, at, meter, val(r.pattern), pulse, r.bus);
        starts.forEach(s => later(r, at + (s.g - r.pos) * pulse, () => r.onChord && r.onChord(s.i)));
        if (r.onPulse) for (let k = 0; k < len; k++) later(r, at + k * pulse, () => r.onPulse(offset + k));
        r.next += len * pulse;
        r.pos += len;
      }
    };
    r.interval = setInterval(tick, 25);
    tick();
    notify();
  }

  function stop() {
    if (!run) return;
    const r = run;
    run = null;
    clearInterval(r.interval);
    r.timers.forEach(clearTimeout);
    r.bus.gain.setTargetAtTime(0, ctx.currentTime, 0.04);
    setTimeout(() => r.bus.disconnect(), 600);
    notify();
  }

  // Play voicings back to back with fixed durations (seconds). A null voicing is a rest.
  function sequence(voicings, durs, onChord, onEnd) {
    init();
    stop();
    const bus = ctx.createGain();
    bus.connect(master);
    const r = { bus, timers: [] };
    run = r;
    let t = ctx.currentTime + 0.06;
    voicings.forEach((v, i) => {
      const d = Array.isArray(durs) ? durs[i] : durs;
      if (v) {
        bass(bus, v.bass, t, d * 0.95, 0.8);
        v.upper.forEach((m, k) => keys(bus, m, t + k * 0.01, d * 0.95, 0.8));
        later(r, t, () => onChord && onChord(i));
      }
      t += d;
    });
    later(r, t, () => { if (run === r) { stop(); onEnd && onEnd(); } });
    notify();
  }

  function playChord(v, seconds = 1.6) {
    init();
    const t = ctx.currentTime + 0.02;
    bass(master, v.bass, t, seconds, 0.8);
    v.upper.forEach((m, i) => keys(master, m, t + i * 0.012, seconds, 0.8));
  }
  function playNote(midi, asBass) {
    init();
    const t = ctx.currentTime + 0.01;
    if (asBass) bass(master, midi, t, 1.2, 0.85);
    else keys(master, midi, t, 0.9, 0.85);
  }

  return { init, start, stop, sequence, playChord, playNote, setBass, setVolume, barSeconds, onChange, isPlaying: () => !!run };
})();
