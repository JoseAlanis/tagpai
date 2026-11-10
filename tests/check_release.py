"""Check what release.py writes and refuses, without a browser.

    python3 tests/check_release.py

A release gets every page of the built site as a download, byte for byte, under names that cannot clash,
with checksums that match, and notes from the changelog. Refused: a tag that is not v1.2.3, a tag that
differs from the app's version, a changelog without a dated entry for it, a site that was not built, that
misses a configured edition, holds anything else or contains a symbolic link, and a release folder that is
not empty.
"""
import copy
import hashlib
import json
import shutil
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
sys.dont_write_bytecode = True
import build  # noqa: E402
import release  # noqa: E402

VERSION = build.version()
TAG = f"v{VERSION}"
CHANGES = "- One thing.\n- Another thing.\n"
DATED = f"# Changelog\n\n## {VERSION} (2026-01-02)\n\n{CHANGES}\n## 0.0.0 (2025-01-01)\n\n- Old.\n"
EDITIONS = sorted(p.parent.name for p in (ROOT / "editions").glob("*/package.json"))
DEMO = json.loads((ROOT / "editions/clinical-dialogue/package.json").read_text())
passed = []


def check(ok: bool, label: str) -> None:
    if not ok:
        raise SystemExit(f"check failed: {label}")
    passed.append(label)


def attempt(tmp: Path, tag: str = TAG, changelog: str = DATED, change_site=None, out_has=None, editions=None):
    """Prepare a release in `tmp` from a freshly built site; return the file names, or None if refused."""
    site = tmp / "site"
    if not site.exists():
        build.site(site)
    if change_site:
        change_site(site, tmp)
    (tmp / "CHANGELOG.md").write_text(changelog)
    out = tmp / "release"
    if out_has:
        out.mkdir(exist_ok=True)
        (out / out_has).write_text("x")
    try:
        return release.prepare(tag, site, out, tmp / "notes.md", tmp / "CHANGELOG.md", EDITIONS if editions is None else editions)
    except SystemExit:
        return None


def link_folder(site: Path, tmp: Path) -> None:
    """Replace an edition's folder with a symbolic link to a copy of it."""
    shutil.copytree(site / EDITIONS[0], tmp / "elsewhere")
    shutil.rmtree(site / EDITIONS[0])
    (site / EDITIONS[0]).symlink_to(tmp / "elsewhere", target_is_directory=True)


def link_file(site: Path, tmp: Path) -> None:
    """Replace an edition's page with a symbolic link to a copy of it."""
    shutil.copyfile(site / EDITIONS[0] / "index.html", tmp / "page.html")
    (site / EDITIONS[0] / "index.html").unlink()
    (site / EDITIONS[0] / "index.html").symlink_to(tmp / "page.html")


def extra_link(site: Path, tmp: Path) -> None:
    """Add a symbolic link to a folder outside the site, holding a page and more."""
    (tmp / "outside").mkdir()
    (tmp / "outside" / "index.html").write_text("<p>outside</p>")
    (tmp / "outside" / "data.json").write_text("{}")
    (site / "more").symlink_to(tmp / "outside", target_is_directory=True)


def extra_edition(site: Path, tmp: Path) -> None:
    (site / "unexpected-study").mkdir()
    (site / "unexpected-study" / "index.html").write_text("<p>not configured</p>")


with tempfile.TemporaryDirectory() as t:
    tmp = Path(t)
    names = attempt(tmp)
    site, out = tmp / "site", tmp / "release"
    check(names is not None and sorted(names) == sorted([f"tagpai-project-page-{TAG}.html", "SHA256SUMS"] + [f"tagpai-edition-{e}-{TAG}.html" for e in EDITIONS]),
          "a release gets the project page, one page per edition, and SHA256SUMS")
    check((out / f"tagpai-project-page-{TAG}.html").read_bytes() == (site / "index.html").read_bytes()
          and all((out / f"tagpai-edition-{e}-{TAG}.html").read_bytes() == (site / e / "index.html").read_bytes() for e in EDITIONS),
          "each download is its page in the built site, byte for byte")
    sums = dict(reversed(line.split("  ", 1)) for line in (out / "SHA256SUMS").read_text().splitlines())
    check(sorted(sums) == sorted(n for n in names if n != "SHA256SUMS")
          and all(hashlib.sha256((out / n).read_bytes()).hexdigest() == h for n, h in sums.items()),
          "SHA256SUMS lists every download with its checksum")
    notes = (tmp / "notes.md").read_text()
    check(notes.startswith(CHANGES.strip()) and "Old." not in notes and f"{release.ONLINE}{EDITIONS[0]}/" in notes,
          "the notes are the changelog's entry for this version, with where the pages are online")
    check(sorted(p.name for p in out.iterdir()) == sorted(names), "the release folder holds exactly the downloads (the notes are written elsewhere)")

with tempfile.TemporaryDirectory() as t:
    tmp = Path(t)
    src = tmp / "editions" / "project-page" / "package.json"
    src.parent.mkdir(parents=True)
    src.write_text(json.dumps(copy.deepcopy(DEMO)))
    build.site(tmp / "site", [src])
    names = attempt(tmp, editions=["project-page"])
    out = tmp / "release"
    check(names is not None and len(names) == 3
          and (out / f"tagpai-project-page-{TAG}.html").read_bytes() == (tmp / "site" / "index.html").read_bytes()
          and (out / f"tagpai-edition-project-page-{TAG}.html").read_bytes() == (tmp / "site" / "project-page" / "index.html").read_bytes(),
          "an edition named project-page gets its own download; the project page's is not overwritten")

for label, kwargs in (
        ("a tag without the v is refused", dict(tag=VERSION)),
        ("a tag with more than a version is refused", dict(tag=f"{TAG}-rc.1")),
        ("a tag that differs from the app's version is refused", dict(tag="v99.0.0")),
        ("a changelog whose entry is not dated is refused", dict(changelog=f"## {VERSION} (unreleased)\n\n{CHANGES}")),
        ("a changelog without an entry for the version is refused", dict(changelog="## 0.0.0 (2025-01-01)\n\n- Old.\n")),
        ("a changelog entry without changes is refused", dict(changelog=f"## {VERSION} (2026-01-02)\n\n## 0.0.0 (2025-01-01)\n\n- Old.\n")),
        ("a site that was not built is refused", dict(change_site=lambda s, t: [p.unlink() for p in s.rglob("*.html")])),
        ("a site holding anything else is refused", dict(change_site=lambda s, t: (s / "extra.txt").write_text("x"))),
        ("a site with a folder that is not a configured edition is refused", dict(change_site=extra_edition)),
        ("a site missing a configured edition is refused", dict(change_site=lambda s, t: shutil.rmtree(s / EDITIONS[0]))),
        ("a site with a symbolic link to a folder is refused", dict(change_site=link_folder)),
        ("a site with a symbolic link to a file is refused", dict(change_site=link_file)),
        ("a site with an added symbolic link to a folder outside it is refused", dict(change_site=extra_link)),
        ("the same, when that folder is named as an edition", dict(change_site=extra_link, editions=EDITIONS + ["more"])),
        ("an edition name unfit for a folder is refused", dict(editions=["../outside"])),
        ("a release folder that is not empty is refused", dict(out_has="left-over.html"))):
    with tempfile.TemporaryDirectory() as t:
        check(attempt(Path(t), **kwargs) is None, label)

print(json.dumps({"ok": True, "passed": passed}, indent=1))
