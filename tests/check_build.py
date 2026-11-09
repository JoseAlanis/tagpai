"""Check what build.py writes and refuses, without a browser.

    python3 tests/check_build.py

Every built page has one style block and one script, each allowed by its own hash in the security policy,
no style attributes, and conversation text cannot end the script early or open a style block. The site
folder holds the project page and one page per edition, nothing else; the project page has no script and
lists every edition, with its text escaped. Only demos go on the site: a study package, a package not
marked exactly as a demo, or a demo with conversations of its own is refused. Packages the app would misread are refused: a session or batch name used
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

DEMO = json.loads((ROOT / "editions/clinical-dialogue/package.json").read_text())
EDITIONS = sorted(p.parent.name for p in (ROOT / "editions").glob("*/package.json"))


def site_refused(tmp: Path, slug: str, change) -> bool:
    """Build a one-edition site from a changed copy of the demo package; True if the build refuses it."""
    package = copy.deepcopy(DEMO)
    change(package)
    src = tmp / "editions" / slug / "package.json"
    src.parent.mkdir(parents=True)
    src.write_text(json.dumps(package))
    try:
        build.site(tmp / "site", [src])
    except SystemExit:
        return True
    return False


with tempfile.TemporaryDirectory() as tmp:
    out = Path(tmp) / "site"
    build.site(out)
    files = sorted(str(p.relative_to(out)) for p in out.rglob("*") if p.is_file())
    check(files == sorted(["index.html"] + [f"{e}/index.html" for e in EDITIONS]), "the site holds the project page and one page per edition, nothing else")
    page = (out / "index.html").read_text()
    policy = re.search(r'Content-Security-Policy" content="([^"]+)"', page).group(1)
    style = page.split("<style>", 1)[1].split("</style>", 1)[0]
    check("<script" not in page.lower() and "script-src" not in policy and "default-src 'none'" in policy, "the project page has no script, and its policy allows none")
    check(policy.split("style-src", 1)[1].split(";", 1)[0].split() == [build.sha256(style)] and "font/woff2;base64," in style, "the project page's policy allows exactly its one style block, fonts included, by its hash")
    check(not re.search(r"\sstyle\s*=", page), "no style attributes in the project page")
    check(all(f'href="{e}/"' in page for e in EDITIONS) and f"version {build.version()}" in page, "the project page links every edition and states the version")

with tempfile.TemporaryDirectory() as tmp:
    src = Path(tmp) / "editions" / "test" / "package.json"
    src.parent.mkdir(parents=True)
    hostile = copy.deepcopy(DEMO)
    hostile["edition"].update(name='A <b>bold</b> "name"', about="</li><script>alert(1)</script> & more")
    src.write_text(json.dumps(hostile))
    text = build.site(Path(tmp) / "site", [src])
    check("&lt;/li&gt;&lt;script&gt;alert(1)&lt;/script&gt; &amp; more" in text and "A &lt;b&gt;bold&lt;/b&gt; &quot;name&quot;" in text
          and "<script" not in text.lower() and "<b>" not in text, "edition names and descriptions appear as text, never as markup")

for label, slug, change in (
        ("an edition without a description is refused", "test", lambda d: d["edition"].pop("about")),
        ("an edition without a name is refused", "test", lambda d: d["edition"].update(name=" ")),
        ("an edition folder name unfit for an address is refused", "Test_1", lambda d: None),
        ("a package not marked as a demo is refused for the site", "test", lambda d: d.pop("demo")),
        ("a package marked demo: false is refused for the site", "test", lambda d: d.update(demo=False)),
        ('a package marked demo: "true" (text, not true) is refused for the site', "test", lambda d: d.update(demo="true")),
        ("a package marked demo: 1 is refused for the site", "test", lambda d: d.update(demo=1)),
        ("a demo with conversations of its own is refused for the site", "test", lambda d: d.update(batches=copy.deepcopy(FIXTURE["batches"]))),
        ("a study package is refused for the site", "test", lambda d: (d.clear(), d.update(copy.deepcopy(FIXTURE), edition=dict(name="Study", about="Study copy"))))):
    with tempfile.TemporaryDirectory() as tmp:
        check(site_refused(Path(tmp), slug, change), label)
with tempfile.TemporaryDirectory() as tmp:
    (Path(tmp) / "site").mkdir()
    (Path(tmp) / "site" / "left-over.html").write_text("x")
    check(site_refused(Path(tmp), "test", lambda d: None), "a site folder that is not empty is refused")


def finish_refused(page: str) -> bool:
    with tempfile.TemporaryDirectory() as tmp:
        try:
            build.finish(page, Path(tmp) / "page.html")
        except SystemExit:
            return True
    return False


SHELL = "<style>__READER_SERIF__ __READER_SANS__</style>"
check(not finish_refused(f'<meta content="style-src __STYLE_HASH__">{SHELL}'), "a page with one style block and no script is finished")
check(finish_refused(f'<meta content="style-src __STYLE_HASH__">{SHELL}<script>alert(1)</script>'), "a page with a script but no hash slot for it is refused")
check(finish_refused(f'<meta content="style-src __STYLE_HASH__">{SHELL}<style>body{{}}</style>'), "a page with two style blocks is refused")
print(json.dumps({"ok": True, "passed": passed}, indent=1))
