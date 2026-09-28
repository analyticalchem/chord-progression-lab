/* Progression Lab: page chrome. Theme switch, presentation mode, tabs, and a write-on-change helper. */
const Chrome = (() => {
  'use strict';
  const root = document.documentElement;
  let refresh = () => {};

  // Write text only when it changes, so live regions (output, role="status") are not re-announced.
  function setText(el, text) {
    if (el && el.textContent !== text) el.textContent = text;
  }

  // ---------- Theme: auto → light → dark, stored per project ----------
  const THEME_KEY = 'chord-progression-lab-theme';
  const themes = ['auto', 'light', 'dark'];
  const themeBtn = document.getElementById('theme');
  function applyTheme(name) {
    if (name === 'auto') delete root.dataset.theme;
    else root.dataset.theme = name;
    themeBtn.textContent = 'Theme: ' + name;
    try { localStorage.setItem(THEME_KEY, name); } catch (e) { /* storage unavailable */ }
    refresh();
  }
  themeBtn.textContent = 'Theme: ' + (root.dataset.theme || 'auto');
  themeBtn.addEventListener('click', () => {
    const cur = root.dataset.theme || 'auto';
    applyTheme(themes[(themes.indexOf(cur) + 1) % themes.length]);
  });
  function watch(query) {
    if (!window.matchMedia) return;
    const mq = window.matchMedia(query);
    if (mq.addEventListener) mq.addEventListener('change', () => refresh());
    else if (mq.addListener) mq.addListener(() => refresh());
  }
  watch('(prefers-color-scheme: dark)');
  watch('(min-width: 900px)'); // presentation sizes switch at this width, so drawings re-measure

  // ---------- Presentation mode (not stored; ?present=1 opens in it) ----------
  const presentBtn = document.getElementById('present');
  const presentStatus = document.getElementById('present-status');
  const isPresent = () => root.hasAttribute('data-present');
  function setPresent(on) {
    root.toggleAttribute('data-present', on);
    presentBtn.setAttribute('aria-pressed', String(on));
    presentStatus.textContent = on ? 'Presentation mode on. Press Escape to exit.' : 'Presentation mode off.';
    refresh();
    try {
      if (on && document.fullscreenEnabled && !document.fullscreenElement) {
        root.requestFullscreen().catch(() => { /* refused: the mode still applies */ });
      } else if (!on && document.fullscreenElement && document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
    } catch (e) { /* Fullscreen API unavailable */ }
  }
  presentBtn.addEventListener('click', () => setPresent(!isPresent()));
  document.addEventListener('keydown', e => {
    if (e.altKey && e.shiftKey && e.code === 'KeyP') { e.preventDefault(); setPresent(!isPresent()); return; }
    if (e.key === 'Escape' && isPresent()) setPresent(false);
  });
  document.addEventListener('fullscreenchange', () => {
    if (!document.fullscreenElement && isPresent()) setPresent(false);
  });

  // ---------- Tabs (WAI-ARIA tabs pattern: arrow keys, Home and End move between tabs) ----------
  function tabs(list, onSelect) {
    const all = [...list.querySelectorAll('[role="tab"]')];
    function select(tab, focus) {
      all.forEach(t => {
        const on = t === tab;
        t.setAttribute('aria-selected', String(on));
        t.tabIndex = on ? 0 : -1;
        document.getElementById(t.getAttribute('aria-controls')).hidden = !on;
      });
      if (focus) tab.focus();
      onSelect(tab.getAttribute('aria-controls'));
    }
    list.addEventListener('click', e => {
      const t = e.target.closest('[role="tab"]');
      if (t) select(t, false);
    });
    list.addEventListener('keydown', e => {
      const i = all.indexOf(document.activeElement);
      if (i < 0) return;
      const n = all.length;
      const j = { ArrowRight: (i + 1) % n, ArrowLeft: (i - 1 + n) % n, Home: 0, End: n - 1 }[e.key];
      if (j === undefined) return;
      e.preventDefault();
      select(all[j], true);
    });
    return { select: panelId => select(all.find(t => t.getAttribute('aria-controls') === panelId) || all[0], false) };
  }

  function init(opts) {
    refresh = opts.refresh || refresh;
    if (new URLSearchParams(location.search).get('present') === '1') setPresent(true);
  }

  return { init, setText, tabs, isPresent };
})();
