/* Progression Lab: SVG and DOM views. Keyboard, circle of fifths, voice leading, tension curve. */
const Views = (() => {
  const NS = 'http://www.w3.org/2000/svg';
  const BLACK = [1, 3, 6, 8, 10];
  const PC_NAMES = ['C', 'C♯/D♭', 'D', 'D♯/E♭', 'E', 'F', 'F♯/G♭', 'G', 'G♯/A♭', 'A', 'A♯/B♭', 'B'];
  const cssPx = name => parseFloat(getComputedStyle(document.documentElement).getPropertyValue(name)) || 0;
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  // ---------- Keyboard ----------
  function Piano(el, lo, hi, onKey) {
    const whites = [];
    for (let m = lo; m <= hi; m++) if (!BLACK.includes(m % 12)) whites.push(m);
    const w = 100 / whites.length;
    const keys = {}, names = {};
    el.innerHTML = '';
    let wi = 0;
    for (let m = lo; m <= hi; m++) {
      const black = BLACK.includes(m % 12);
      const oct = Math.floor(m / 12) - 1;
      names[m] = PC_NAMES[m % 12].split('/').map(n => n + oct).join(' / ');
      const k = document.createElement('button');
      k.type = 'button';
      k.className = 'key ' + (black ? 'black' : 'white');
      k.style.left = (black ? wi * w - w * 0.32 : wi * w) + '%';
      k.style.width = (black ? w * 0.64 : w) + '%';
      k.setAttribute('aria-label', names[m]);
      k.innerHTML = `<span class="key-name"></span>${!black && m % 12 === 0 ? `<span class="key-oct" aria-hidden="true">C${oct}</span>` : ''}`;
      k.addEventListener('click', () => onKey && onKey(m));
      keys[m] = k;
      el.appendChild(k);
      if (!black) wi++;
    }
    return {
      show(notes) {
        Object.entries(keys).forEach(([m, k]) => {
          k.className = k.className.replace(/\s*\b(on|bass|fn-\w+)\b/g, '');
          k.firstChild.textContent = '';
          k.setAttribute('aria-label', names[m]);
        });
        notes.forEach(n => {
          const k = keys[n.midi];
          if (!k) return;
          k.classList.add('on', 'fn-' + n.color);
          if (n.role === 'bass') k.classList.add('bass');
          k.firstChild.textContent = n.name;
          k.setAttribute('aria-label', `${names[n.midi]}, ${n.role === 'bass' ? 'bass note' : 'chord tone'} ${n.name}`);
        });
      },
    };
  }

  // ---------- Circle of fifths ----------
  const FIFTHS = [0, 7, 2, 9, 4, 11, 6, 1, 8, 3, 10, 5];
  const MAJ_LABELS = ['C', 'G', 'D', 'A', 'E', 'B', 'F♯', 'D♭', 'A♭', 'E♭', 'B♭', 'F'];
  const MIN_LABELS = ['Am', 'Em', 'Bm', 'F♯m', 'C♯m', 'G♯m', 'E♭m', 'B♭m', 'Fm', 'Cm', 'Gm', 'Dm'];
  const C = 210, R_OUT = 200, R_MID = 142, R_IN = 94;
  const polar = (r, deg) => [C + r * Math.cos((deg - 90) * Math.PI / 180), C + r * Math.sin((deg - 90) * Math.PI / 180)];
  function wedge(r1, r2, a0, a1) {
    const [x1, y1] = polar(r2, a0), [x2, y2] = polar(r2, a1), [x3, y3] = polar(r1, a1), [x4, y4] = polar(r1, a0);
    return `M${x1} ${y1} A${r2} ${r2} 0 0 1 ${x2} ${y2} L${x3} ${y3} A${r1} ${r1} 0 0 0 ${x4} ${y4}Z`;
  }
  const isMinorish = q => q === 'min' || q === 'dim';
  const chordPos = c => FIFTHS.indexOf(isMinorish(c.quality) ? (c.rootPc + 3) % 12 : c.rootPc);

  function circle(svg, { key, chords, current, numerals, onPick }) {
    const relMajor = key.mode === 'major' ? key.pc : (key.pc + 3) % 12;
    const kp = FIFTHS.indexOf(relMajor);
    const near = p => [-1, 0, 1].some(d => (kp + d + 12) % 12 === p);
    let h = `<title id="circle-title">Circle of fifths: major keys on the outer ring, minor keys on the inner ring. The shaded wedges are the chords of ${esc(key.name)} ${key.mode}. Each wedge is a button that plays its chord. Arrows trace the roots of your progression; the counts of each kind of root motion are listed below the circle.</title>`;
    h += `<defs><marker id="cof-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 1L9 5L0 9z" class="cof-arrowhead"/></marker></defs>`;
    for (let p = 0; p < 12; p++) {
      const a0 = p * 30 - 15, a1 = p * 30 + 15;
      const inKey = near(p);
      const isTonicMaj = key.mode === 'major' && p === kp, isTonicMin = key.mode === 'minor' && p === kp;
      const majNum = inKey ? numerals(FIFTHS[p], 'maj') : '';
      const minNum = inKey ? numerals((FIFTHS[p] + 9) % 12, 'min') : '';
      const [mx, my] = polar(majNum ? 182 : 174, p * 30), [mnx, mny] = polar(163, p * 30);
      const [nx, ny] = polar(minNum ? 129 : 120, p * 30), [nnx, nny] = polar(113, p * 30);
      h += `<g class="cof-seg${inKey ? ' in-key' : ''}${isTonicMaj ? ' home' : ''}" data-pc="${FIFTHS[p]}" data-mode="major" tabindex="0" role="button" aria-label="${MAJ_LABELS[p]} major${majNum ? `, ${majNum} in this key` : ''}">
        <path d="${wedge(R_MID, R_OUT, a0, a1)}"/>
        <text x="${mx}" y="${my + 5}" class="cof-name">${MAJ_LABELS[p]}</text>
        ${majNum ? `<text x="${mnx}" y="${mny + 4}" class="cof-num">${majNum}</text>` : ''}</g>`;
      h += `<g class="cof-seg inner${inKey ? ' in-key' : ''}${isTonicMin ? ' home' : ''}" data-pc="${(FIFTHS[p] + 9) % 12}" data-mode="minor" tabindex="0" role="button" aria-label="${MIN_LABELS[p].replace(/m$/, '')} minor${minNum ? `, ${minNum} in this key` : ''}">
        <path d="${wedge(R_IN, R_MID, a0, a1)}"/>
        <text x="${nx}" y="${ny + 4}" class="cof-name small">${MIN_LABELS[p]}</text>
        ${minNum ? `<text x="${nnx}" y="${nny + 3.5}" class="cof-num">${minNum}</text>` : ''}</g>`;
    }
    h += `<text x="${C}" y="${C - 6}" class="cof-key">${esc(key.name)}</text><text x="${C}" y="${C + 16}" class="cof-mode">${key.mode}</text>`;

    // Path of the progression's roots
    const pts = chords.map(c => {
      const r = isMinorish(c.quality) ? R_IN + 7 : R_MID + 8;
      return polar(r, chordPos(c) * 30);
    });
    let path = '';
    for (let i = 1; i < pts.length; i++) {
      const [x1, y1] = pts[i - 1], [x2, y2] = pts[i];
      if (Math.hypot(x2 - x1, y2 - y1) < 1) continue;
      const cx = (x1 + x2) / 2 + (C - (x1 + x2) / 2) * 0.35, cy = (y1 + y2) / 2 + (C - (y1 + y2) / 2) * 0.35;
      path += `<path d="M${x1} ${y1}Q${cx} ${cy} ${x2} ${y2}" class="cof-link" marker-end="url(#cof-arrow)"/>`;
    }
    const seen = new Set();
    pts.forEach(([x, y], i) => {
      const k = `${Math.round(x)},${Math.round(y)}`;
      if (!seen.has(k)) path += `<circle cx="${x}" cy="${y}" r="5" class="cof-dot fn-${chords[i].color}"/>`;
      seen.add(k);
    });
    if (current >= 0 && pts[current]) {
      const [x, y] = pts[current];
      path += `<circle cx="${x}" cy="${y}" r="11" class="cof-now"/>`;
    }
    svg.innerHTML = h + `<g class="cof-path" aria-hidden="true">${path}</g>`;
    svg.querySelectorAll('.cof-seg').forEach(g => {
      const pick = viaKeyboard => onPick(+g.dataset.pc, g.dataset.mode, viaKeyboard);
      g.addEventListener('click', () => pick(false));
      g.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); pick(true); } });
    });
  }

  function rootMotion(chords) {
    const counts = { fall5: 0, rise5: 0, step: 0, third: 0, same: 0 };
    for (let i = 1; i < chords.length; i++) {
      const iv = (chords[i].rootPc - chords[i - 1].rootPc + 12) % 12;
      if (iv === 0) counts.same++;
      else if (iv === 5) counts.fall5++;
      else if (iv === 7) counts.rise5++;
      else if ([1, 2, 10, 11].includes(iv)) counts.step++;
      else counts.third++;
    }
    return counts;
  }

  // ---------- Voice leading ----------
  function voiceLeading(svg, { chords, voicings, current, noteName }) {
    const title = `<title id="vl-title">Voice-leading graph: one column per bar, each note drawn at its pitch, with lines showing where each voice moves. The same notes are listed in the table below.</title>`;
    if (!chords.length) { svg.innerHTML = title; svg.setAttribute('viewBox', '0 0 10 10'); svg.setAttribute('width', 10); svg.setAttribute('height', 10); return; }
    // Spacing follows the drawn-text size so presentation mode's larger labels still fit.
    const scale = (cssPx('--chart-font') || 12) / 12;
    const COL = Math.round(104 * scale), LEFT = Math.round(40 * scale), TOP = Math.round(56 * scale), ROW = 6.5 * scale;
    const R = cssPx('--chart-marker') || 5, HIT = R * 2;
    const all = voicings.flatMap(v => [v.bass, ...v.upper]);
    const lo = Math.min(...all) - 2, hi = Math.max(...all) + 2;
    const W = LEFT + chords.length * COL + 12, H = TOP + (hi - lo) * ROW + 34 * scale;
    const y = m => TOP + (hi - m) * ROW;
    const x = i => LEFT + i * COL + COL / 2;
    let h = title;
    for (let m = lo; m <= hi; m++) {
      if (BLACK.includes(m % 12)) h += `<rect x="${LEFT}" y="${y(m) - ROW / 2}" width="${W - LEFT}" height="${ROW}" class="vl-black"/>`;
      if (m % 12 === 0) h += `<line x1="${LEFT}" x2="${W}" y1="${y(m) + ROW / 2}" y2="${y(m) + ROW / 2}" class="vl-c"/><text x="${LEFT - 6}" y="${y(m) + 3 * scale}" class="vl-oct">C${m / 12 - 1}</text>`;
    }
    if (current >= 0 && current < chords.length) h += `<rect x="${LEFT + current * COL + 3}" y="4" width="${COL - 6}" height="${H - 8}" rx="8" class="vl-now"/>`;
    chords.forEach((c, i) => {
      h += `<rect x="${LEFT + i * COL + 3}" y="4" width="${COL - 6}" height="${H - 8}" rx="8" class="vl-col" data-col="${i}"
        tabindex="0" role="button" aria-label="Play chord ${i + 1}, ${esc(c.name)}"><title>Play ${esc(c.name)}</title></rect>`;
      h += `<text x="${x(i)}" y="${22 * scale}" class="vl-num">${esc(c.text)}</text><text x="${x(i)}" y="${38 * scale}" class="vl-chord">${esc(c.name)}</text>`;
    });
    // Lines first so dots sit on top
    for (let i = 1; i < voicings.length; i++) {
      const a = voicings[i - 1], b = voicings[i];
      const line = (m1, m2, extra) => {
        const d = Math.abs(m1 - m2), cls = d === 0 ? 'hold' : d <= 2 ? 'step' : 'leap';
        const x1 = x(i - 1), x2 = x(i);
        h += `<path d="M${x1} ${y(m1)}C${x1 + COL / 2} ${y(m1)} ${x2 - COL / 2} ${y(m2)} ${x2} ${y(m2)}" class="vl-link ${cls}${extra}"/>`;
      };
      Theory.links(a.upper, b.upper).forEach(([m1, m2]) => line(m1, m2, ''));
      line(a.bass, b.bass, ' bassline');
      const moved = Theory.links(a.upper, b.upper).reduce((s, [m1, m2]) => s + Math.abs(m1 - m2), 0);
      h += `<text x="${LEFT + i * COL}" y="${H - 10 * scale}" class="vl-move">${moved}</text>`;
    }
    // Each note sits in a group with a larger invisible hit circle so it is easy to click.
    const lx = R * 2, ly = 3.5 * scale;
    voicings.forEach((v, i) => {
      const bn = esc(noteName(i, v.bass));
      h += `<g class="vl-hit" data-midi="${v.bass}" data-bass="1"><title>Bass ${bn}</title>
        <circle cx="${x(i)}" cy="${y(v.bass)}" r="${HIT}" class="vl-target"/>
        <rect x="${x(i) - R - 1}" y="${y(v.bass) - R - 1}" width="${2 * R + 2}" height="${2 * R + 2}" rx="2" class="vl-bass"/></g>`;
      h += `<text x="${x(i) + lx}" y="${y(v.bass) + ly}" class="vl-label">${bn}</text>`;
      v.upper.forEach(m => {
        const nn = esc(noteName(i, m));
        h += `<g class="vl-hit" data-midi="${m}"><title>${nn}</title>
          <circle cx="${x(i)}" cy="${y(m)}" r="${HIT}" class="vl-target"/>
          <circle cx="${x(i)}" cy="${y(m)}" r="${R + 0.5}" class="vl-note"/></g>`;
        h += `<text x="${x(i) + lx}" y="${y(m) + ly}" class="vl-label">${nn}</text>`;
      });
    });
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.setAttribute('width', W);
    svg.setAttribute('height', H);
    svg.innerHTML = h;
  }

  // ---------- Tension curve ----------
  function tension(svg, { chords, current }) {
    const W = 640, H = 96, P = 18;
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    if (!chords.length) { svg.innerHTML = ''; return; }
    const n = chords.length;
    const px = i => (n === 1 ? W / 2 : P + i * (W - 2 * P) / (n - 1));
    const py = t => H - 12 - (t / 100) * (H - 26);
    const pts = chords.map((c, i) => [px(i), py(c.tension)]);
    let h = [25, 50, 75].map(t => `<line x1="${P}" x2="${W - P}" y1="${py(t)}" y2="${py(t)}" class="tn-grid"/>`).join('');
    const line = pts.map((p, i) => (i ? 'L' : 'M') + p[0] + ' ' + p[1]).join('');
    if (n > 1) h += `<path d="${line}L${pts[n - 1][0]} ${py(0)}L${pts[0][0]} ${py(0)}Z" class="tn-area"/><path d="${line}" class="tn-line"/>`;
    pts.forEach(([x, y], i) => {
      const r = cssPx('--chart-marker') || 5;
      h += `<circle cx="${x}" cy="${y}" r="${i === current ? r + 2.5 : r}" class="tn-dot fn-${chords[i].color}${i === current ? ' now' : ''}"/>`;
    });
    svg.innerHTML = h;
  }

  return { Piano, circle, rootMotion, voiceLeading, tension, esc };
})();
