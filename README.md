# TagpAI

A human annotation tool for AI research. Say *tag-pie*, like magpie.

For now, TagpAI supports annotating conversations turn by turn: read one
reply at a time, mark passages, tag them with a codebook, and answer a few
questions per conversation. Other kinds of material may follow.

It runs as a single offline web page: no login, no server behind it, and
the app makes no network requests of its own, so you can work with your
data locally on your computer.

## Editions

Editions configure the same app for a domain. The current one, TagpAI for
Clinical Dialogue, helps clinicians and researchers annotate symptoms,
change processes and therapist strategies in therapist-patient
conversations. A guided practice on a made-up session gets you started.

## Status

Early demo phase (v0.0.x): the code and a public demo with made-up
content. Not yet for studies.

## Build and test

The repository holds the app's source; `build.py` turns it into pages,
one per edition, each a single self-contained file:

```sh
python3 build.py                            # every edition: dist/<edition>/index.html
python3 build.py <package.json> <out.html>  # any package
sh tests/run.sh                             # check the builder, build, run the browser checks
```

The build needs Python 3.9 or later and nothing else. The browser checks
need Node 22 or later and Google Chrome: they open the pages in headless
Chrome, from disk and over HTTP, and work through them with real mouse
drags and key presses.

| Path | What |
|---|---|
| `app/annotator.src.html` | The app: HTML, CSS and JavaScript in one file, no dependencies |
| `app/fonts/` | The embedded fonts and their licences |
| `editions/<name>/package.json` | What an edition's page holds: name, codebook, practice |
| `build.py` | A package and the app into one page |
| `tests/` | The build and browser checks and their made-up fixtures |

## Fonts

The pages embed two fonts under the SIL Open Font License 1.1: Source
Serif 4 and Atkinson Hyperlegible Next, the Latin subsets served by
Google Fonts. Their licence texts are in `app/fonts/`.

## License

TagpAI is licensed under a BSD-3-Clause license (click below for details).

[![License: 
BSD-3-Clause](https://img.shields.io/badge/license-BSD--3--Clause-blue.svg)](LICENSE)
