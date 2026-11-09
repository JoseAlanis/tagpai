# Security

## Reporting a problem

Please report security problems privately through GitHub: open the
repository's **Security** tab and choose **Report a vulnerability**
([how it works](https://docs.github.com/en/code-security/how-tos/report-and-fix-vulnerabilities/report-privately)).
Your report is submitted privately to the maintainer through GitHub. Please
do not open a public issue for a security problem.

A useful report says what you found, on which page or in which file, the
version (shown at the bottom of the project page and in the app's help),
and the steps to see it happen.

TagpAI is maintained by one person; reports are answered as soon as
possible.

## Supported versions

Only the latest release. TagpAI is in an early demo phase (0.0.x) and not
yet for studies.

## Scope

The app (`app/`), the project page (`site/`), the build script
(`build.py`) and the workflows in `.github/`. Problems in GitHub's own
services go to [GitHub's bug bounty programme](https://bounty.github.com/).

## How the pages are built

- Each page is a single self-contained file. Its security policy allows no
  connections to any server, no form submissions and no change of base
  address, and takes images and fonts only from inside the page.
- The page's one script and one style block are allowed by their hashes,
  so an injected script, style block or style attribute does not run or
  apply. The project page has no script.
- The app refuses to run inside another page (a frame).
- Conversation text and notes are only ever inserted as text, never as
  markup. A file loaded into the app is checked whole before anything on
  the page changes.
- Only demos are published on the site; they keep nothing.
- The tests run on every pull request with read-only access. The workflow's
  actions are pinned to full commit ids, and Dependabot proposes updates.
