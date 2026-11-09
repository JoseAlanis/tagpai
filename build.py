"""Build self-contained TagpAI pages: the app source, its fonts and one package each, and the project page.

    python3 build.py                            # the site: dist/site/index.html and dist/site/<edition>/index.html
    python3 build.py <package.json> <out.html>  # any package

A package is { study, rater, package_id, codebook, codebooks, batches: [{ id, sessions }] } plus optional
edition, practice, intro, demo and storage (see the top of app/annotator.src.html). It is embedded as JSON
with "<" escaped, so no text in a conversation can end the script element. dist/site holds exactly what
is published: only demos (demo: true, no batches), each with edition.name and edition.about for the project
page. Any other package, such as a study copy, is built on its own with the second form. Standard library only.
"""
import base64
import hashlib
import html
import json
import re
import shutil
import sys
from pathlib import Path

if sys.version_info < (3, 12):
    sys.exit(f"build.py needs Python 3.12 or later (this is {sys.version.split()[0]})")

HERE = Path(__file__).resolve().parent
APP = HERE / "app"
SITE = HERE / "site"
SLUG = re.compile(r"[a-z0-9]+(-[a-z0-9]+)*")   # an edition's folder name, which is also its address
FONTS = {"__READER_SERIF__": "SourceSerif4-latin.woff2", "__READER_SANS__": "AtkinsonHyperlegibleNext-latin.woff2"}
ID = re.compile(r"[A-Za-z0-9_.-]{1,40}")   # batch and session names, as the app checks them in batch files
# Names every JavaScript object inherits (Object.prototype): the app looks records up by name, so none may be one.
RESERVED = {"__defineGetter__", "__defineSetter__", "__lookupGetter__", "__lookupSetter__", "__proto__", "constructor",
            "hasOwnProperty", "isPrototypeOf", "propertyIsEnumerable", "toLocaleString", "toString", "valueOf"}


def name_ok(x) -> bool:
    return isinstance(x, str) and bool(ID.fullmatch(x)) and x not in RESERVED


def check(package: dict) -> None:
    """Refuse a package whose built-in batches the app would misread: names well formed and used once,
    every line { turn, speaker, text, raw? }."""
    batches, sessions = set(), set()
    for b in package.get("batches", []):
        if not name_ok(b.get("id")) or b["id"] in batches:
            raise SystemExit(f"batch {b.get('id')!r}: name missing, malformed, reserved or used twice")
        batches.add(b["id"])
        for x in b.get("sessions") or []:
            sid = x.get("id")
            if not name_ok(sid) or sid in sessions:
                raise SystemExit(f"session {sid!r}: name missing, malformed, reserved or used twice")
            sessions.add(sid)
            lines = x.get("lines")
            if not lines or not all(isinstance(l, dict) and type(l.get("turn")) is int and l["turn"] >= 0
                                    and l.get("speaker") in ("therapist", "patient") and isinstance(l.get("text"), str)
                                    and (l.get("raw") is None or isinstance(l["raw"], str)) for l in lines):
                raise SystemExit(f"session {sid}: every line needs turn, speaker (therapist or patient) and text")


def sha256(text: str) -> str:
    """The policy source that allows exactly this text: 'sha256-<base64 of its SHA-256>'."""
    return "'sha256-" + base64.b64encode(hashlib.sha256(text.encode()).digest()).decode() + "'"


def finish(page: str, out: Path) -> str:
    """Embed the fonts, allow the page's style block and script by their hashes, write the page to `out`,
    and return its text without the fonts (for checks on what the page says)."""
    readable = page
    for slot, name in FONTS.items():
        if page.count(slot) != 1:
            raise SystemExit(f"{out.name}: needs the font slot {slot} once")
        page = page.replace(slot, base64.b64encode((APP / "fonts" / name).read_bytes()).decode())
    # The security policy allows exactly this page's one style block and its one script (if it has one) by
    # their hashes, taken on the final page with the fonts embedded: no other style block, style attribute
    # or script applies. A page without a hash slot for scripts may contain no script at all.
    for slot, tag in (("__STYLE_HASH__", "style"), ("__SCRIPT_HASH__", "script")):
        if slot not in page and tag == "script":
            if f"<{tag}" in page.lower():
                raise SystemExit(f"{out.name}: a script element without a hash slot in the policy")
            continue
        if page.count(slot) != 1 or page.count(f"<{tag}>") != 1 or page.count(f"</{tag}>") != 1:
            raise SystemExit(f"{out.name}: needs exactly one <{tag}> element and its hash slot {slot}")
        allow = sha256(page.split(f"<{tag}>", 1)[1].split(f"</{tag}>", 1)[0])
        page, readable = page.replace(slot, allow), readable.replace(slot, allow)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(page)
    return readable


def build(package: dict, out: Path) -> str:
    """Write the app page for one package and return its text without the fonts."""
    check(package)
    page = (APP / "annotator.src.html").read_text()
    data = json.dumps(package, ensure_ascii=False, separators=(",", ":")).replace("<", "\\u003c")
    assert page.count("__PACKAGE__") == 1
    return finish(page.replace("__PACKAGE__", data), out)


def version() -> str:
    """The app's version, as the app states it."""
    found = re.search(r'const APP = \{[^}]*version: "(\d+\.\d+\.\d+)"', (APP / "annotator.src.html").read_text())
    if not found:
        raise SystemExit("app/annotator.src.html: no version in const APP")
    return found.group(1)


def site(out: Path, editions=None) -> str:
    """Build the published site into the empty or new folder `out`: one folder per edition and the project
    page listing them. Return the project page's text without the fonts."""
    if out.exists() and any(out.iterdir()):
        raise SystemExit(f"{out}: not empty")
    cards = []
    for src in sorted(editions if editions is not None else (HERE / "editions").glob("*/package.json")):
        slug, package = src.parent.name, json.loads(src.read_text())
        edition = package.get("edition") or {}
        if not SLUG.fullmatch(slug):
            raise SystemExit(f"edition {slug!r}: the folder name must be lowercase letters, digits and dashes")
        if not all(isinstance(edition.get(k), str) and edition[k].strip() for k in ("name", "about")):
            raise SystemExit(f"edition {slug}: needs edition.name and edition.about")
        # Only demos are published: the app keeps nothing from a demo, and a demo brings no conversations of
        # its own (its practice is part of the app).
        if package.get("demo") is not True or package.get("batches"):
            raise SystemExit(f"edition {slug}: only a demo (demo: true, no batches) can go on the site")
        build(package, out / slug / "index.html")
        name = html.escape(edition["name"])
        cards.append(f'\n    <li class="edition"><h3>{name}</h3><p>{html.escape(edition["about"])}</p>'
                     f'<a class="open" href="{slug}/" aria-label="Open the demo: {name}">Open the demo</a></li>')
    if not cards:
        raise SystemExit("no editions")
    page = (SITE / "index.html").read_text()
    if page.count("__EDITIONS__") != 1 or "__VERSION__" not in page:
        raise SystemExit("site/index.html: needs __EDITIONS__ once and __VERSION__")
    page = page.replace("__EDITIONS__", "".join(cards) + "\n  ").replace("__VERSION__", version())
    return finish(page, out / "index.html")


def main(args: list[str]) -> None:
    if args and len(args) != 2:
        sys.exit(__doc__)
    if args:
        out = Path(args[1])
        build(json.loads(Path(args[0]).read_text()), out)
        written = [out]
    else:
        out = HERE / "dist" / "site"
        shutil.rmtree(out, ignore_errors=True)   # the site folder is rebuilt whole, so it holds only this build
        site(out)
        written = sorted(out.rglob("*.html"))
    for f in written:
        print(f"{f.relative_to(HERE) if f.is_relative_to(HERE) else f} {f.stat().st_size // 1024} KB")


if __name__ == "__main__":
    main(sys.argv[1:])
