# Development

The app is one HTML file. Each edition adds a small package (its name,
description, codebook and practice), and `build.py` combines the two into a
page: a single self-contained file that works offline. The project page
lists the editions.

## Build

```sh
python3 build.py                            # the site: dist/site/index.html and dist/site/<edition>/index.html
python3 build.py <package.json> <out.html>  # any package
```

`dist/site/` holds exactly what is published: the project page and one
folder per edition. Only demos go there (`"demo": true`, no conversations of
their own); any other package is built on its own with the second command,
for use offline. The build needs Python 3.12 or later and nothing else.

## Test

```sh
sh tests/run.sh
```

The tests need Node 22 or later and Google Chrome (`google-chrome` on the
path, or its location in the `CHROME` environment variable). They:

- check what `build.py` writes into a page and which packages it refuses,
  and what `release.py` writes and refuses;
- open the pages in Chrome without a window and work through them as a
  person would, with mouse drags and key presses;
- open the pages as files, the way they are used offline; the site also
  from a small web server on the same computer, the way GitHub Pages serves
  it, following the link from the project page to the demo.

The same tests run on GitHub for every pull request and every change to
the `main` branch ([`.github/workflows/tests.yml`](.github/workflows/tests.yml)).
The *tests* badge in the README shows the latest result for `main`.

## Release

A release is published by pushing a signed version tag on `main`:

1. In a pull request, set the version in `app/annotator.src.html`
   (`const APP`) and date its entry in `CHANGELOG.md`, as in
   `## 0.0.1 (2026-11-12)`. Merge it.
2. Tag the merged commit and push the tag:

   ```sh
   git switch main && git pull
   git tag -s v0.0.1 -m "TagpAI v0.0.1"
   git push origin v0.0.1
   ```

3. The release workflow ([`.github/workflows/release.yml`](.github/workflows/release.yml))
   checks that the tag is signed and on `main` and matches the app's version
   and a dated changelog entry, runs all the tests on that commit, and
   prepares the release files from the tested build (`python3 release.py
   v0.0.1` does the same locally, into `dist/release/`). After approval it
   publishes the pages as downloads with their checksums (`SHA256SUMS`) in a
   GitHub release, then the same pages on GitHub Pages.

The prepared files are kept for seven days, so approve both steps within
seven days of pushing the tag. If a run fails or its files have expired,
re-run it on GitHub:

- If the Pages step failed and its files are still kept, re-run only that
  job.
- Otherwise re-run the whole workflow. It builds again from the same tagged
  commit, which gives the same files. If the release is already published,
  the release step checks that the new build matches it (`SHA256SUMS`) and
  lets the Pages step publish it; if they differ, the run stops.

## Layout

| Path | What |
|---|---|
| `app/annotator.src.html` | The app: HTML, CSS and JavaScript in one file, no dependencies |
| `app/fonts/` | The embedded fonts and their licences |
| `editions/<name>/package.json` | What an edition's page holds: name, description, codebook, practice |
| `site/index.html` | The project page; `build.py` adds the list of editions |
| `build.py` | Combines a package and the app into one page; builds the site |
| `release.py` | Checks a release tag and prepares the release files from the built site |
| `tests/` | The build and browser checks and their made-up test data |
| `.github/` | The workflows that run the tests and publish releases; Dependabot keeps their actions up to date |
