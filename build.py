"""Build self-contained TagpAI pages: the app source, its fonts and one package each.

    python3 build.py                          # every edition: editions/<name>/package.json -> dist/<name>/index.html
    python3 build.py <package.json> <out.html>  # any package

A package is { study, rater, package_id, codebook, codebooks, batches: [{ id, sessions }] } plus optional
edition, practice, intro, demo and storage (see the top of app/annotator.src.html). It is embedded as JSON
with "<" escaped, so no text in a conversation can end the script element. Standard library only.
"""
import base64
import hashlib
import json
import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
APP = HERE / "app"
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


def build(package: dict, out: Path) -> str:
    """Write the page and return its text without the fonts (for checks on what the page says)."""
    check(package)
    page = (APP / "annotator.src.html").read_text()
    data = json.dumps(package, ensure_ascii=False, separators=(",", ":")).replace("<", "\\u003c")
    assert page.count("__PACKAGE__") == 1
    page = page.replace("__PACKAGE__", data)
    readable = page
    for slot, name in FONTS.items():
        assert page.count(slot) == 1, slot
        page = page.replace(slot, base64.b64encode((APP / "fonts" / name).read_bytes()).decode())
    # The security policy allows exactly this page's one script, by its hash: no other script can run.
    assert page.count("__SCRIPT_HASH__") == 1
    assert page.count("<script>") == 1 and page.count("</script>") == 1
    script = page.split("<script>", 1)[1].split("</script>", 1)[0]
    allow = "'sha256-" + base64.b64encode(hashlib.sha256(script.encode()).digest()).decode() + "'"
    page, readable = page.replace("__SCRIPT_HASH__", allow), readable.replace("__SCRIPT_HASH__", allow)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(page)
    return readable


def main(args: list[str]) -> None:
    if args and len(args) != 2:
        sys.exit(__doc__)
    jobs = [(Path(args[0]), Path(args[1]))] if args else [
        (p, HERE / "dist" / p.parent.name / "index.html") for p in sorted((HERE / "editions").glob("*/package.json"))]
    for src, out in jobs:
        build(json.loads(src.read_text()), out)
        print(f"{out.relative_to(HERE) if out.is_relative_to(HERE) else out} {out.stat().st_size // 1024} KB")


if __name__ == "__main__":
    main(sys.argv[1:])
