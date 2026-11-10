"""Prepare a release from the built and tested site: check the tag against the app's version and the
changelog, then write the release files.

    python3 release.py v0.0.1    # after the site is built (python3 build.py, or sh tests/run.sh)

The built site must hold exactly the project page and one page for each edition configured in editions/,
as plain files (no symbolic links). dist/release/ gets each of those pages as a download, byte for byte,
named tagpai-project-page-<tag>.html and tagpai-edition-<name>-<tag>.html, and SHA256SUMS for them;
dist/release-notes.md gets the changelog's entry for the version and where the pages are online.
Standard library only.
"""
import hashlib
import os
import re
import shutil
import sys
from pathlib import Path

import build

ONLINE = "https://josealanis.github.io/tagpai/"


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def notes(version: str, changelog: str) -> str:
    """The changelog's entry for `version`, which must carry its release date: ## 1.2.3 (YYYY-MM-DD)."""
    entry = re.search(rf"^## {re.escape(version)} \(\d{{4}}-\d{{2}}-\d{{2}}\)\n(.*?)(?=^## |\Z)", changelog, re.M | re.S)
    if not entry or not entry.group(1).strip():
        raise SystemExit(f"CHANGELOG.md: no dated entry '## {version} (YYYY-MM-DD)' with its changes")
    return entry.group(1).strip()


def site_files(site: Path) -> list:
    """Every file under `site`, as relative paths. Symbolic links are refused: an upload would follow them."""
    if not site.is_dir() or site.is_symlink():
        raise SystemExit(f"{site}: build the site first")
    found = []
    for root, dirs, files in os.walk(site, followlinks=False):
        for name in dirs + files:
            path = Path(root) / name
            if path.is_symlink():
                raise SystemExit(f"{path}: a symbolic link; the site may hold only plain files and folders")
            if name in files:
                found.append(path.relative_to(site).as_posix())
    return sorted(found)


def prepare(tag: str, site: Path, out: Path, notes_file: Path, changelog: Path, editions: list) -> list:
    """Write the release files for the site built from `editions` (their folder names); return the names."""
    m = re.fullmatch(r"v(\d+\.\d+\.\d+)", tag)
    if not m:
        raise SystemExit(f"{tag!r}: a release tag looks like v1.2.3")
    version = m.group(1)
    if version != build.version():
        raise SystemExit(f"tag {tag}, but the app says version {build.version()}")
    text = notes(version, changelog.read_text())
    if not editions or not all(build.SLUG.fullmatch(e) for e in editions):
        raise SystemExit(f"editions {editions!r}: needs at least one, each a folder name of lowercase letters, digits and dashes")
    expected = sorted(["index.html"] + [f"{e}/index.html" for e in editions])
    if site_files(site) != expected:
        raise SystemExit(f"{site}: must hold exactly {', '.join(expected)}")
    if out.exists() and any(out.iterdir()):
        raise SystemExit(f"{out}: not empty")
    names = {"index.html": f"tagpai-project-page-{tag}.html", **{f"{e}/index.html": f"tagpai-edition-{e}-{tag}.html" for e in editions}}
    if len(set(names.values())) != len(names):
        raise SystemExit("two release files would share a name")
    out.mkdir(parents=True, exist_ok=True)
    for src, name in names.items():
        shutil.copyfile(site / src, out / name)
    (out / "SHA256SUMS").write_text("".join(f"{sha256(out / n)}  {n}\n" for n in sorted(names.values())))
    online = "\n".join(f"- `{n}`: {ONLINE}{'' if src == 'index.html' else src[:-len('index.html')]}" for src, n in names.items())
    notes_file.write_text(f"{text}\n\n### Files\n\nThe same pages as online, for use offline:\n\n{online}\n\n"
                          f"`SHA256SUMS` lists their checksums: `sha256sum --check --ignore-missing SHA256SUMS`.\n")
    return sorted(names.values()) + ["SHA256SUMS"]


def main(args: list) -> None:
    if len(args) != 1:
        sys.exit(__doc__)
    dist = build.HERE / "dist"
    editions = sorted(p.parent.name for p in (build.HERE / "editions").glob("*/package.json"))
    for name in prepare(args[0], dist / "site", dist / "release", dist / "release-notes.md", build.HERE / "CHANGELOG.md", editions):
        print(f"dist/release/{name}")


if __name__ == "__main__":
    main(sys.argv[1:])
