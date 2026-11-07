#!/bin/sh
# Check the builder, build the editions and a study copy from the test fixtures, then run the browser checks.
#   sh tests/run.sh       (from the repository root; needs Python 3.9 or later, Node 22 or later, Google Chrome)
set -eu
cd "$(dirname "$0")/.."
python3 -B tests/check_build.py
python3 build.py
python3 build.py tests/fixtures/study_package.json dist/test/study_copy.html
node tests/check_demo.mjs dist/clinical-dialogue/index.html dist/shots/demo
node tests/check_study_copy.mjs dist/test/study_copy.html dist/shots/study_copy
