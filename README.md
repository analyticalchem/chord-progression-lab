# Progression Lab

An interactive chord progression demo for the browser. Build progressions in any key and meter, hear them on a synth piano, and see how they work.

**Try it:** https://analyticalchem.github.io/chord-progression-lab/ (add `?present=1` to open in presentation mode)

## Features

- **Progression builder:** add chords from the key or borrowed/chromatic chords (♭VII, minor iv, secondary dominants, Neapolitan, Picardy third), then reorder, replace, and edit each bar.
- **Meters and patterns:** 2/4, 3/4, 4/4, 5/4 (3 + 2), 6/8, 7/8 (2 + 2 + 3), 9/8 and 12/8, each with sustained, pulse, arpeggio or bass + chords accompaniment. A beat strip shows the count ("1 la li 2 la li…") and lights each pulse as it plays. Compound meters count their tempo in dotted quarter notes.
- **Function and tension:** chords are marked as tonic, predominant, dominant, or chromatic, with a tension curve across the progression.
- **Chord color:** triads, 7ths, 6ths, add9, 9ths, sus2, sus4, and inversions, labeled with Roman numerals and figured bass.
- **Voice leading:** a graph of how every voice moves between chords, with smooth and block voicings to compare, and the same notes in a table. Click a note or a whole column to hear it.
- **Circle of fifths:** shows the current key's chords and the path your roots take. Click a wedge to hear its chord or move the key there.
- **Library and cadences:** 14 well-known progressions and 5 cadence types to hear or load.
- **Ear training:** quizzes on progressions, cadences, and chords within a key.

## Accessibility and presentation mode

The page follows the analyticalchem web style and targets WCAG 2.1 AA: keyboard operation throughout (no single-key shortcuts), visible focus, text alternatives for every visual, light and dark themes, and a presentation mode for lecture halls (Present button, Alt + Shift + P, or `?present=1`; Escape exits). The typefaces (Bodoni Moda, Figtree, JetBrains Mono) are a deliberate exception to the house system-font rule and fall back to system fonts.

## Run locally

No build step or dependencies. Open `index.html` in a browser. Sound is generated with the Web Audio API.

## Files

| File | Purpose |
| --- | --- |
| `index.html` | Page structure and the About the Model notes |
| `styles.css`, `views.css` | Tokens, layout, components, themes, presentation mode |
| `theory.js` | Spelling, chord definitions, Roman numerals, voicing |
| `data.js` | Preset progressions, cadences and meters |
| `audio.js` | Synth, accompaniment patterns and playback |
| `views.js` | Keyboard, circle of fifths, voice leading, tension curve |
| `chrome.js` | Theme switch, presentation mode, tabs |
| `quiz.js` | Ear-training quiz |
| `app.js` | App state and UI |
