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

- check what `build.py` writes into a page and which packages it refuses;
- open the pages in Chrome without a window and work through them as a
  person would, with mouse drags and key presses;
- open the pages as files, the way they are used offline; the site also
  from a small web server on the same computer, the way GitHub Pages serves
  it, following the link from the project page to the demo.

The same tests run on GitHub for every pull request and every change to
the `main` branch ([`.github/workflows/tests.yml`](.github/workflows/tests.yml)).
The *tests* badge in the README shows the latest result for `main`.

## Layout

| Path | What |
|---|---|
| `app/annotator.src.html` | The app: HTML, CSS and JavaScript in one file, no dependencies |
| `app/fonts/` | The embedded fonts and their licences |
| `editions/<name>/package.json` | What an edition's page holds: name, description, codebook, practice |
| `site/index.html` | The project page; `build.py` adds the list of editions |
| `build.py` | Combines a package and the app into one page |
| `tests/` | The build and browser checks and their made-up test data |
| `.github/` | The workflow that runs the tests; Dependabot keeps its actions up to date |
