"""Check what build.py writes and refuses, without a browser.

    python3 tests/check_build.py

Every built page has one style block and one script, each allowed by its own hash in the security policy,
no style attributes, and conversation text cannot end the script early or open a style block. Packages the app would misread are refused: a session or batch name used
twice, a reserved name, a malformed line.
"""
import base64
import copy
import hashlib
import json
import re
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
sys.dont_write_bytecode = True
import build  # noqa: E402

FIXTURE = json.loads((ROOT / "tests/fixtures/study_package.json").read_text())
passed = []


def check(ok: bool, label: str) -> None:
    if not ok:
        raise SystemExit(f"check failed: {label}")
    passed.append(label)


def refused(package: dict) -> bool:
    with tempfile.TemporaryDirectory() as tmp:
        try:
            build.build(package, Path(tmp) / "page.html")
        except SystemExit:
            return True
    return False


def variant(change) -> dict:
    d = copy.deepcopy(FIXTURE)
    change(d)
    return d


with tempfile.TemporaryDirectory() as tmp:
    hostile = variant(lambda d: d["batches"][0]["sessions"][0]["lines"][1].update(
        text="</script><script>alert(1)</script> <!-- x </style><style>body{display:none}</style>"))
    out = Path(tmp) / "page.html"
    build.build(hostile, out)
    page = out.read_text()
    script = page.split("<script>", 1)[1].split("</script>", 1)[0]
    allowed = re.search(r"script-src ('sha256-[^']+')", page).group(1)
    check(page.count("<script>") == 1 and page.count("</script>") == 1 and "alert(1)" in script, "text with </script> stays inside the one script")
    check(allowed == "'sha256-" + base64.b64encode(hashlib.sha256(script.encode()).digest()).decode() + "'", "the policy allows exactly that script, by its hash")
    check("unsafe-inline" not in page.split("script-src", 1)[1].split(";", 1)[0], "no inline scripts allowed otherwise")
    style = page.split("<style>", 1)[1].split("</style>", 1)[0]
    style_src = page.split("style-src", 1)[1].split(";", 1)[0].split()
    check(page.count("<style>") == 1 and page.count("</style>") == 1 and "display:none" in script, "text with </style> stays inside the one script")
    check(style_src == [build.sha256(style)] and "font/woff2;base64," in style, "the policy allows exactly the one style block, fonts included, by its hash")
    check(not re.search(r"\sstyle\s*=", page), "no style attributes in the page")
    for edition in sorted((ROOT / "editions").glob("*/package.json")):
        build.build(json.loads(edition.read_text()), Path(tmp) / f"{edition.parent.name}.html")
    check(True, "every edition builds")

check(refused(variant(lambda d: d["batches"][0]["sessions"].append(copy.deepcopy(d["batches"][0]["sessions"][0])))), "a session name used twice is refused")
check(refused(variant(lambda d: d["batches"].append(copy.deepcopy(d["batches"][0])))), "a batch name used twice is refused")
for name in ("constructor", "__proto__", "toString", "has space", ""):
    check(refused(variant(lambda d: d["batches"][0]["sessions"][0].update(id=name))), f"session name {name!r} is refused")
check(refused(variant(lambda d: d["batches"][0].update(id="valueOf"))), "batch name 'valueOf' is refused")
check(refused(variant(lambda d: d["batches"][0]["sessions"][0]["lines"][1].update(speaker="narrator"))), "a line with another speaker is refused")
check(refused(variant(lambda d: d["batches"][0]["sessions"][0]["lines"][1].update(turn="1"))), "a line whose turn is not a number is refused")
check(refused(variant(lambda d: d["batches"][0]["sessions"][0]["lines"][1].update(turn=True))), "a line whose turn is true or false is refused")
check(not refused(FIXTURE), "the fixture itself builds")
print(json.dumps({"ok": True, "passed": passed}, indent=1))
