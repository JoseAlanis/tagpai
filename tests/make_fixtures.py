"""Write the test fixtures: a study copy's package (one built-in batch) and two batch files, one for its rater
and one for another rater. Made-up sessions: Bill's second and third sessions, after the practice's first.

    python3 tests/make_fixtures.py

A batch file carries the SHA-256 of its sessions' compact JSON, which the page recomputes (JSON.stringify
gives the same bytes) before adding them.
"""
import hashlib
import json
from pathlib import Path

OUT = Path(__file__).resolve().parent / "fixtures"


def dialogue(opener, replies):
    """Opener is turn 0; then each turn is the patient's reply followed by the therapist's. A reply may be
    a pair (cleaned text, raw output)."""
    lines = [{"turn": 0, "speaker": "therapist", "text": opener}]
    for k, r in enumerate(replies):
        text, raw = r if isinstance(r, tuple) else (r, None)
        line = {"turn": k // 2 + 1, "speaker": "therapist" if k % 2 else "patient", "text": text}
        if raw is not None:
            line["raw"] = raw
        lines.append(line)
    return lines


SECOND = dialogue("Welcome back, Bill. Last time you tried the first minute of your talk here. How has the week been?", [
    "Mixed. I practised the talk twice at home, and that went fine. But on Thursday I skipped the seminar because I knew I'd have to speak.",
    "Practising twice is real work. What happened on Thursday morning, before you decided to stay away?",
    "I woke up with my stomach in knots. I kept picturing everyone staring at me, and I couldn't face it.",
    "So the picture of everyone staring came first, and then the urge to stay away. How did you feel once you'd decided?",
    ("Relieved for an hour or so. Then I felt like a failure for the rest of the day.",
     "Relieved for an hour or so. Then I felt like a failure for the rest of the day. *sighs*"),
    "Relief first, then a heavy feeling afterwards. Next week, shall we plan the seminar together, one step at a time?",
])
THIRD = dialogue("Good to see you, Bill. How did the seminar go this week?", [
    "I went. My voice shook at the start, but after a minute it settled.",
    "You went, and you stayed while your voice shook. What did you notice after that first minute?",
    "That nobody seemed to care as much as I thought. A few people were even nodding.",
    "That's worth remembering. Shall we write it down, so you can read it before the presentation?",
])

package = {"study": "fixture", "rater": "R01", "package_id": "fixture-R01", "codebook": "pbt", "codebooks": ["pbt"],
           "practice": "bill", "batches": [{"id": "B1", "sessions": [{"id": "S01", "lines": SECOND}]}]}
(OUT / "study_package.json").write_text(json.dumps(package, indent=1, ensure_ascii=False) + "\n")

sessions = [{"id": "S02", "lines": THIRD}]
digest = hashlib.sha256(json.dumps(sessions, separators=(",", ":"), ensure_ascii=False).encode()).hexdigest()
for rater in ("R01", "R99"):
    batch = {"format": "dialogue-batch", "schema": 0, "study": "fixture", "rater": rater, "batch": "B2",
             "sessions": sessions, "sha256": digest}
    (OUT / f"batch_{rater}_B2.json").write_text(json.dumps(batch, indent=1, ensure_ascii=False) + "\n")
print("B2", digest[:12])
