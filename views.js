/* Progression Lab: SVG and DOM views. Keyboard, circle of fifths, voice leading, tension curve. */
const Views = (() => {
  const NS = 'http://www.w3.org/2000/svg';
  const BLACK = [1, 3, 6, 8, 10];
  const PC_NAMES = ['C', 'C♯/D♭', 'D', 'D♯/E♭', 'E', 'F', 'F♯/G♭', 'G', 'G♯/A♭', 'A', 'A♯/B♭', 'B'];
  const cssPx = name => parseFloat(getComputedStyle(document.documentElement).getPropertyValue(name)) || 0;
  // A function's mark has its own shape as well as its colour, so it reads without colour
  // (circle tonic, square predominant, diamond dominant, triangle chromatic), sized to match areas.
  function mark(x, y, r, fn, cls) {
    const c = `class="${cls} fn-${fn}"`;
    if (fn === 'sub') return `<rect x="${x - r * 0.9}" y="${y - r * 0.9}" width="${r * 1.8}" height="${r * 1.8}" ${c}/>`;
    if (fn === 'dom') { const d = r * 1.25; return `<path d="M${x} ${y - d}L${x + d} ${y}L${x} ${y + d}L${x - d} ${y}Z" ${c}/>`; }
    if (fn === 'chrom') { const d = r * 1.35; return `<path d="M${x} ${y - d}L${x + d * 0.87} ${y + d * 0.5}L${x - d * 0.87} ${y + d * 0.5}Z" ${c}/>`; }
    return `<circle cx="${x}" cy="${y}" r="${r}" ${c}/>`;
  }
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

  // Drawn in three layers: the wedges (the buttons), then the progression (marks on the wedges
  // and arrows between them), then every label on top with a knockout halo in its wedge's fill, so
  // an arrow passing under a label never makes it hard to read. Labels ignore the pointer, so a click
  // on one reaches its wedge.
  function circle(svg, { key, chords, current, numerals, onPick, showPath }) {
    const relMajor = key.mode === 'major' ? key.pc : (key.pc + 3) % 12;
    const kp = FIFTHS.indexOf(relMajor);
    const near = p => [-1, 0, 1].some(d => (kp + d + 12) % 12 === p);
    // Label sizes in drawing units, the same formulas as the CSS: max(design size, minimum × --sch-u).
    // A wedge's name and numeral stack vertically, spaced by their line boxes, so they never meet
    // whatever the wedge's angle; the pair is centred on the middle of its ring.
    const u = parseFloat(svg.style.getPropertyValue('--sch-u')) || 1, cf = cssPx('--chart-font') || 12;
    const fName = Math.max(14, cf * 1.15 * u), fSmall = Math.max(12, cf * u), fKey = Math.max(30, cf * 2 * u);
    // Half line-box heights, measured: Figtree 0.61 × its size, Bodoni Moda 0.77 × (its tall ascenders).
    const FIG = 0.61, BOD = 0.77;
    const pair = (topHalf, bottomHalf) => topHalf + bottomHalf + 1; // centre-to-centre spacing of two stacked labels
    const pathWords = showPath ? ' Marks on the wedges show your chords\' roots, and arrows trace how they move.' : '';
    let h = `<title id="circle-title">Circle of fifths: major keys on the outer ring, minor keys on the inner ring. The shaded wedges are the chords of ${esc(key.name)} ${key.mode}. Each wedge is a button that plays its chord.${pathWords} The key and the counts of each kind of root motion are below the circle.</title>`;
    h += `<defs><marker id="cof-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 1L9 5L0 9z" class="cof-arrowhead"/></marker></defs>`;
    let wedges = '', labels = '';
    for (let p = 0; p < 12; p++) {
      const a0 = p * 30 - 15, a1 = p * 30 + 15;
      const inKey = near(p);
      const isTonicMaj = key.mode === 'major' && p === kp, isTonicMin = key.mode === 'minor' && p === kp;
      const majNum = inKey ? numerals(FIFTHS[p], 'maj') : '';
      const minNum = inKey ? numerals((FIFTHS[p] + 9) % 12, 'min') : '';
      const [mx, my] = polar((R_MID + R_OUT) / 2, p * 30), [nx, ny] = polar((R_IN + R_MID) / 2, p * 30);
      const so = majNum ? pair(FIG * fName, BOD * fSmall) / 2 : 0, si = minNum ? pair(FIG * fSmall, BOD * fSmall) / 2 : 0;
      const outer = `${inKey ? ' in-key' : ''}${isTonicMaj ? ' home' : ''}`, inner = `${inKey ? ' in-key' : ''}${isTonicMin ? ' home' : ''}`;
      wedges += `<g class="cof-seg${outer}" data-pc="${FIFTHS[p]}" data-mode="major" tabindex="0" role="button" aria-label="${MAJ_LABELS[p]} major${majNum ? `, ${majNum} in this key` : ''}"><path d="${wedge(R_MID, R_OUT, a0, a1)}"/></g>`;
      wedges += `<g class="cof-seg inner${inner}" data-pc="${(FIFTHS[p] + 9) % 12}" data-mode="minor" tabindex="0" role="button" aria-label="${MIN_LABELS[p].replace(/m$/, '')} minor${minNum ? `, ${minNum} in this key` : ''}"><path d="${wedge(R_IN, R_MID, a0, a1)}"/></g>`;
      labels += `<text x="${mx}" y="${my - so}" class="cof-name${outer}">${MAJ_LABELS[p]}</text>`;
      if (majNum) labels += `<text x="${mx}" y="${my + so}" class="cof-num${outer}">${majNum}</text>`;
      labels += `<text x="${nx}" y="${ny - si}" class="cof-name small${inner}">${MIN_LABELS[p]}</text>`;
      if (minNum) labels += `<text x="${nx}" y="${ny + si}" class="cof-num${inner}">${minNum}</text>`;
    }
    const sk = pair(BOD * fKey, FIG * fSmall) / 2;
    labels += `<text x="${C}" y="${C - sk}" class="cof-key">${esc(key.name)}</text><text x="${C}" y="${C + sk}" class="cof-mode">${key.mode}</text>`;

    // The progression's roots, marked on their own wedges near the ring's inner edge, with arrows
    // bowing toward the centre between them.
    let path = '';
    if (showPath) {
      const pts = chords.map(c => polar(isMinorish(c.quality) ? R_IN + 7 : R_MID + 8, chordPos(c) * 30));
      for (let i = 1; i < pts.length; i++) {
        const [x1, y1] = pts[i - 1], [x2, y2] = pts[i];
        if (Math.hypot(x2 - x1, y2 - y1) < 1) continue;
        const cx = (x1 + x2) / 2 + (C - (x1 + x2) / 2) * 0.35, cy = (y1 + y2) / 2 + (C - (y1 + y2) / 2) * 0.35;
        path += `<path d="M${x1} ${y1}Q${cx} ${cy} ${x2} ${y2}" class="cof-link" marker-end="url(#cof-arrow)"/>`;
      }
      // Marker sizes are CSS px converted to drawing units (u, above), so they hold their size on a phone.
      const r = (cssPx('--chart-marker') || 5) * u;
      const seen = new Set();
      pts.forEach(([x, y], i) => {
        const k = `${Math.round(x)},${Math.round(y)}`;
        if (!seen.has(k)) path += mark(x, y, r, chords[i].color, 'cof-dot');
        seen.add(k);
      });
      // The chord now playing: its own mark, larger, with a thick accent outline over a surface rim (8.6).
      if (current >= 0 && pts[current]) {
        const [x, y] = pts[current], fn = chords[current].color;
        path += mark(x, y, r * 1.6, fn, 'cof-now-rim') + mark(x, y, r * 1.6, fn, 'cof-dot cof-now');
      }
    }
    svg.innerHTML = h + wedges + `<g class="cof-path" aria-hidden="true">${path}</g><g class="cof-labels" aria-hidden="true">${labels}</g>`;
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
    // The chord now playing is shown on its own marks (bold heading, thick accent outlines on its
    // notes), never with a box drawn over the graph (style guide 8.6).
    const cur = i => (i === current ? ' cur' : '');
    chords.forEach((c, i) => {
      h += `<rect x="${LEFT + i * COL + 3}" y="4" width="${COL - 6}" height="${H - 8}" rx="8" class="vl-col" data-col="${i}"
        tabindex="0" role="button" aria-label="Play chord ${i + 1}, ${esc(c.name)}"><title>Play ${esc(c.name)}</title></rect>`;
      h += `<text x="${x(i)}" y="${22 * scale}" class="vl-num${cur(i)}">${esc(c.text)}</text><text x="${x(i)}" y="${38 * scale}" class="vl-chord${cur(i)}">${esc(c.name)}</text>`;
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
      h += `<g class="vl-hit${cur(i)}" data-midi="${v.bass}" data-bass="1" data-colnote="${i}"><title>Bass ${bn}</title>
        <circle cx="${x(i)}" cy="${y(v.bass)}" r="${HIT}" class="vl-target"/>
        <rect x="${x(i) - R - 1}" y="${y(v.bass) - R - 1}" width="${2 * R + 2}" height="${2 * R + 2}" rx="2" class="vl-bass"/></g>`;
      h += `<text x="${x(i) + lx}" y="${y(v.bass) + ly}" class="vl-label">${bn}</text>`;
      v.upper.forEach(m => {
        const nn = esc(noteName(i, m));
        h += `<g class="vl-hit${cur(i)}" data-midi="${m}" data-colnote="${i}"><title>${nn}</title>
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
    // Marker sizes are CSS px converted to drawing units, so dots keep their size when the curve is narrow.
    const u = parseFloat(svg.style.getPropertyValue('--sch-u')) || 1;
    const r = (cssPx('--chart-marker') || 5) * u;
    pts.forEach(([x, y], i) => {
      h += mark(x, y, i === current ? r * 1.5 : r, chords[i].color, `tn-dot${i === current ? ' now' : ''}`);
    });
    svg.innerHTML = h;
  }

  // ---------- Fitting drawings to their size (style guide 8.7) ----------
  // --sch-u is drawing units per CSS px. CSS sizes drawn text as max(design size, minimum × --sch-u),
  // so labels never shrink below the chart text on a phone. Returns true when the value changed,
  // so the caller knows to redraw marks sized in script.
  function fitSvg(svg) {
    const vb = svg.viewBox && svg.viewBox.baseVal, box = svg.getBoundingClientRect();
    if (!vb || !vb.width || !box.width) return false;
    const u = (1 / Math.min(box.width / vb.width, box.height / vb.height || Infinity)).toFixed(4);
    if (svg.style.getPropertyValue('--sch-u') === u) return false;
    svg.style.setProperty('--sch-u', u);
    return true;
  }
  // A scroll box is a named, focusable region only while it actually scrolls; a focusable box that
  // does not scroll would just be an extra tab stop.
  function fitScroll(box, label) {
    if (box.scrollWidth > box.clientWidth + 1) {
      box.tabIndex = 0;
      box.setAttribute('role', 'region');
      box.setAttribute('aria-label', `${label}, scrolls sideways`);
    } else {
      box.removeAttribute('tabindex');
      box.removeAttribute('role');
      box.removeAttribute('aria-label');
    }
  }

  return { Piano, circle, rootMotion, voiceLeading, tension, fitSvg, fitScroll, esc };
})();
