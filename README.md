# TagpAI

[![tests](https://github.com/JoseAlanis/tagpai/actions/workflows/tests.yml/badge.svg?branch=main)](https://github.com/JoseAlanis/tagpai/actions/workflows/tests.yml)
[![License: BSD-3-Clause](https://img.shields.io/badge/license-BSD--3--Clause-blue.svg)](LICENSE)

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
content. Not yet for studies. Changes between versions are listed in
[CHANGELOG.md](CHANGELOG.md).

## Development

To build the pages or run the tests, see [DEVELOPMENT.md](DEVELOPMENT.md).

## Privacy and security

The pages collect nothing about you; see [PRIVACY.md](PRIVACY.md). To
report a security problem, see [SECURITY.md](SECURITY.md).

## License

TagpAI is licensed under the BSD-3-Clause license; see [LICENSE](LICENSE).
The pages embed two fonts, Source Serif 4 and Atkinson Hyperlegible Next,
under the SIL Open Font License 1.1; their licence texts are in
[`app/fonts/`](app/fonts/).
