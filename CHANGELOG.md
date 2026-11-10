# Changelog

Versions 0.0.x are demos; 0.1.0 will be the first version for studies.

## 0.0.1 (2026-11-10)

The first public version: a demo, not yet for studies.

- **The app.** Read a conversation one reply at a time, mark passages, tag
  them with a codebook, and answer a few questions per conversation. A
  single self-contained page that works offline and makes no network
  requests of its own.
- **TagpAI Clinical Dialogue**, the first edition, as a demo: a guided
  practice on a made-up session, with a process-based codebook (symptoms,
  change processes, therapist strategies). The demo keeps nothing.
- **The project page**, listing the editions.
- **Security.** The page's script and styles are allowed only by their
  hashes; no connections to any server; the app refuses to run inside
  another page; files are checked whole before they are loaded.
- **Privacy notice and security policy**: the pages collect nothing;
  security problems are reported privately through GitHub.
- **Releases** come from signed tags on `main`, after all the tests pass on
  that commit. The same pages are published on GitHub Pages and as
  downloads, with their checksums in `SHA256SUMS`.
- **Tests** in headless Chrome, run on every pull request.
