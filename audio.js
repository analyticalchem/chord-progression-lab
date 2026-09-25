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
    master.gain.value = 0.9;
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

  const PATTERNS = {
    sustain: { beats: 4, ev: [{ b: 0, part: 'bass', d: 4 }, { b: 0, part: 'chord', d: 4, roll: 0.012 }] },
    pulse: {
      beats: 4,
      ev: [{ b: 0, part: 'bass', d: 4 }, { b: 0, part: 'chord', d: 0.85, v: 0.95 }, { b: 1, part: 'chord', d: 0.85, v: 0.65 },
        { b: 2, part: 'chord', d: 0.85, v: 0.8 }, { b: 3, part: 'chord', d: 0.85, v: 0.65 }],
    },
    arpeggio: { beats: 4, arp: true },
    waltz: {
      beats: 3,
      ev: [{ b: 0, part: 'bass', d: 1.5, v: 0.9 }, { b: 1, part: 'chord', d: 0.8, v: 0.7 }, { b: 2, part: 'chord', d: 0.8, v: 0.62 }],
    },
  };

  function scheduleBar(v, t, style, tempo, out) {
    const spb = 60 / tempo;
    const p = PATTERNS[style] || PATTERNS.sustain;
    if (p.arp) {
      bass(out, v.bass, t, 4 * spb, 0.85);
      const up = [...v.upper].sort((a, b) => a - b);
      const cycle = up.concat(up.slice(1, -1).reverse());
      for (let i = 0; i < 8; i++) keys(out, cycle[i % cycle.length], t + i * spb / 2, 1.3 * spb, i % 4 === 0 ? 0.85 : 0.65);
    } else {
      p.ev.forEach(e => {
        const at = t + e.b * spb, dur = e.d * spb, vel = e.v ?? 0.85;
        if (e.part === 'bass') bass(out, v.bass, at, dur, vel);
        else v.upper.forEach((m, i) => keys(out, m, at + (e.roll || 0) * i, dur, vel * 0.9));
      });
    }
    return p.beats * spb;
  }

  function later(r, time, fn) {
    r.timers.push(setTimeout(fn, Math.max(0, (time - ctx.currentTime) * 1000)));
  }

  // opts: { getBars, tempo, style, loop, onChord(i), onEnd() }. tempo/style/loop may be getters.
  function start(opts) {
    init();
    stop();
    const bus = ctx.createGain();
    bus.connect(master);
    const r = { ...opts, bus, i: 0, next: ctx.currentTime + 0.08, timers: [], ended: false };
    run = r;
    const tick = () => {
      const bars = r.getBars();
      while (!r.ended && r.next < ctx.currentTime + 0.15) {
        if (r.i >= bars.length) {
          if (val(r.loop) && bars.length) r.i = 0;
          else {
            r.ended = true;
            later(r, r.next, () => { if (run === r) { stop(); r.onEnd && r.onEnd(); } });
            break;
          }
        }
        const idx = r.i, at = r.next;
        r.next += scheduleBar(bars[idx], at, val(r.style), val(r.tempo), r.bus);
        later(r, at, () => r.onChord && r.onChord(idx));
        r.i++;
      }
    };
    r.interval = setInterval(tick, 25);
    tick();
  }

  function stop() {
    if (!run) return;
    const r = run;
    run = null;
    clearInterval(r.interval);
    r.timers.forEach(clearTimeout);
    r.bus.gain.setTargetAtTime(0, ctx.currentTime, 0.04);
    setTimeout(() => r.bus.disconnect(), 600);
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

  return { init, start, stop, sequence, playChord, playNote, setBass, isPlaying: () => !!run };
})();
