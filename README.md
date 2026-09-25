# Progression Lab

An interactive chord progression demo for the browser. Build progressions in any key, hear them on a synth piano, and see how they work.

**Try it:** https://analyticalchem.github.io/chord-progression-lab/

## Features

- **Progression builder:** add chords from the key or borrowed/chromatic chords (♭VII, minor iv, secondary dominants, Neapolitan, Picardy third), then reorder, replace, and edit each bar.
- **Function and tension:** chords are colored as tonic, predominant, dominant, or chromatic, with a tension curve across the progression.
- **Chord color:** triads, 7ths, 6ths, add9, 9ths, sus2, sus4, and inversions, labeled with Roman numerals and figured bass.
- **Voice leading:** a graph of how every voice moves between chords, with smooth and block voicings to compare. Click a note or a whole column to hear it.
- **Circle of fifths:** shows the current key's chords and the path your roots take. Click a wedge to hear its chord or move the key there.
- **Library and cadences:** 14 well-known progressions and 5 cadence types to hear or load.
- **Ear training:** quizzes on progressions, cadences, and chords within a key.

## Run locally

No build step or dependencies. Open `index.html` in a browser. Sound is generated with the Web Audio API.

## Files

| File | Purpose |
| --- | --- |
| `index.html` | Page structure |
| `styles.css`, `views.css` | Styles |
| `theory.js` | Spelling, chord definitions, Roman numerals, voicing |
| `data.js` | Preset progressions and cadences |
| `audio.js` | Synth and playback |
| `views.js` | Keyboard, circle of fifths, voice leading, tension curve |
| `quiz.js` | Ear-training quiz |
| `app.js` | App state and UI |
