// A study copy (memory-only, the default) over three days, each with its own date: rate, save, close;
// reopen, load, rate, add a batch, save; reopen, load, save. Checks what the ratings file holds, which
// files the page refuses, and that a refused file leaves the work on the page as it was.
//   node tests/check_study_copy.mjs dist/test/study_copy.html dist/shots/study_copy
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { run } from './browser.mjs';

const [htmlPath, shotDir] = process.argv.slice(2);
const fixture = name => fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url));
const DAY = 86400000;
const dateIn = k => { const d = new Date(Date.now() + k * DAY), z = n => String(n).padStart(2, '0'); return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`; };
await run(htmlPath, shotDir, async ({ tab, js, check, shot, key, calm, select, click, centre, centreEl, pick, st, upload, alerts, confirms, open, offsite, requests, blocked, pageErrors, until, sleep, downloads }) => {
  // From the next opening on, the page's clock runs `k` days off, so each day has its own date.
  let shifted = null;
  const setDay = async k => {
    if (shifted) await tab.send('Page.removeScriptToEvaluateOnNewDocument', { identifier: shifted });
    ({ identifier: shifted } = await tab.send('Page.addScriptToEvaluateOnNewDocument', { source:
      `(() => { const shift = ${k * DAY}, D = Date; class Shifted extends D { constructor(...a) { super(...(a.length ? a : [D.now() + shift])); } static now() { return D.now() + shift; } } window.Date = Shifted; })();` }));
  };
  const saveNow = async (n, date) => {
    await click(await centre('#save'));
    const name = await until(() => readdirSync(downloads).find(f => f === `ratings_R01_${date}_0${n}.json`), `save ${n} on ${date}`);
    return [join(downloads, name), JSON.parse(readFileSync(join(downloads, name), 'utf8'))];
  };
  const markOn = async (i, phrase, k, picks, version = 'text') => {
    await calm(500); await select(i, phrase, version);
    await key(String(k)); for (const p of picks) await click(await pick(p)); await key('Enter'); await key('Escape');
  };
  const busy = async seconds => { for (let k = 0; k < seconds; k++) { await tab.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 600 + (k % 2) * 20, y: 400 }); await sleep(1000); } };
  const row = k => centreEl(`document.querySelectorAll('.srow')[${k}]`);
  const lines = await js(`SESSIONS[0].lines`);

  // Day 1, two days ago: experience, skip the practice, two marks, some active time, save.
  await setDay(-2); await open();
  check(await js(`today()`) === dateIn(-2), "day 1: the page's clock is two days back");
  check(await js(`document.title === 'TagpAI' && document.querySelector('#welcome .brand').textContent === 'TagpAIA human annotation tool for AI research'`), 'without an edition, the app names the page');
  check(await js(`document.querySelector('#welcome .sub').textContent.includes('does not store your work') && !!document.getElementById('w-load').offsetParent && localStorage.length === 0`), 'memory-only welcome: says so, offers to continue from a file');
  await click(await centreEl(`document.querySelectorAll('#w-experience .check')[0]`));
  await click(await centre('#w-skip'));
  check(await js(`document.getElementById('home-sub').textContent === 'Rater R01. 1 session in 1 batch.'`), 'home: rater code and the built-in batch');
  await click(await row(0));
  await key(' '); await key(' '); await key(' ');
  let s = await st();
  check(s.shown === 4 && s.read.slice(0, 3).every(Boolean), 'a session reads one reply at a time');
  await markOn(1, 'I skipped the seminar', 1, ['Avoidance', 'Named in the passage']);
  await markOn(3, 'my stomach in knots', 1, ['Physical symptoms', 'Named in the passage']);
  await busy(7);
  const [file1, s1] = await saveNow(1, dateIn(-2));
  const m1 = s1.sessions.S01.marks;
  check(s1.app && s1.app.name === 'TagpAI' && /^\d+\.\d+\.\d+$/.test(s1.app.version) && s1.app.version === await js(`APP.version`), 'the ratings file names the app and its version');
  check(s1.save_no === 1 && s1.saved_on === dateIn(-2) && s1.practice.done && s1.practice.skipped && s1.practice.date === dateIn(-2) && s1.experience.psychology === true && s1.experience.date === dateIn(-2), 'day 1 saved: save 1 with its date, practice skipped that day, experience');
  check(m1.map(m => m.seq).join() === '1,2' && s1.sessions.S01.active >= 5 && m1.every(m => Number.isInteger(m.t)) && s1.batches.map(b => b.id).join() === 'B1', 'day 1 saved: marks in order, active time, batch B1');
  check(await js(`localStorage.length === 0`), 'day 1: nothing written to browser storage');

  // Day 2, yesterday: a fresh page; continue from the file straight from the welcome, finish the session, add a batch.
  await setDay(-1); await open();
  check(await js(`today()`) === dateIn(-1) && await js(`!state.tour.done && !state.experience && !Object.keys(state.books).length`), 'day 2: a new date, and the page starts empty');
  await upload('#file', file1);
  check((await confirms()).length === 0 && await js(`!document.getElementById('home').hidden && state.tour.done && state.tour.skipped && state.tour.date === ${JSON.stringify(dateIn(-2))} && state.experience.psychology === true && state.experience.date === ${JSON.stringify(dateIn(-2))}`), "day 2: loading restores practice record and experience with day 1's dates");
  check(await js(`(() => { const st = state.books.pbt.S01; return st.marks.map(m => m.id + m.seq + ':' + m.t).join() === ${JSON.stringify(m1.map(m => m.id + m.seq + ':' + m.t).join())} && st.active === ${s1.sessions.S01.active} && state.saves === 1; })()`), 'day 2: marks, order, active time and save count restored');
  await click(await row(0));
  await key(' '); await key(' ');
  await markOn(5, 'I felt like a failure for the rest of the day', 1, ['Negative self-image', 'Named in the passage', 'Duration']);
  check(await js(`[...document.querySelectorAll('.text[data-i="5"][data-version="raw"] .removed')].map(s => s.textContent).join('')`) === '*sighs*', 'raw output shown with the unseen part underlined');
  await markOn(5, '*sighs*', 5, ['Stage directions'], 'raw');
  check((await st()).marks.some(m => m.version === 'raw' && m.tag === 'form' && m.quote === '*sighs*'), 'raw Form mark');
  while (!(await st()).done) await key(' ');
  await calm(500);
  for (const [q, n] of [[0, 0], [1, 1], [2, 2]]) await click(await centreEl(`document.querySelectorAll('.wrap .q')[${q}].querySelectorAll('.seg button')[${n}]`));
  await shot('1-wrap');
  await click(await centre('#submit'));
  s = await st();
  check(s.submitted === dateIn(-1) && s.answers.target_process === 'distress_tolerance' && s.answers.strategy_fit === 'partly' && s.answers.naturalness === 2, "session submitted with its answers and day 2's date");

  await click(await centre('#home-btn'));
  await upload('#batch-file', fixture('batch_R99_B2.json'));
  check((await alerts()).some(m => m.includes('rater R99, not for this copy')) && await js(`document.querySelectorAll('.srow').length === 1`), 'a batch for another rater is refused');
  const b2 = JSON.parse(readFileSync(fixture('batch_R01_B2.json'), 'utf8'));
  const batchVariant = (name, change) => { const d = JSON.parse(JSON.stringify(b2)); change(d); const f = join(downloads, name); writeFileSync(f, JSON.stringify(d)); return f; };
  await upload('#batch-file', await batchVariant('batch_R01_B4.json', d => { d.batch = 'B4'; d.sessions.push({ ...d.sessions[0], lines: d.sessions[0].lines.slice(0, 3) }); }));
  check((await alerts()).some(m => m.includes('a session name repeats')) && await js(`document.querySelectorAll('.srow').length === 1`), 'a batch naming two sessions alike is refused');
  await upload('#batch-file', await batchVariant('batch_R01_B5.json', d => { d.batch = 'B5'; d.sessions[0].id = 'S05'; d.sessions[0].lines[1].speaker = 'narrator'; }));
  check((await alerts()).some(m => m.includes('missing or malformed')), 'a batch with a malformed line is refused');
  for (const name of ['constructor', 'toString', '__proto__']) {
    await upload('#batch-file', batchVariant(`batch_R01_named_${name}.json`, d => { d.batch = `B-${name.length}`; d.sessions[0].id = name; }));
    check((await alerts()).some(m => m.includes('missing or malformed')) && await js(`document.querySelectorAll('.srow').length === 1`), `a session named ${name} is refused`);
  }
  await upload('#batch-file', batchVariant('batch_R01_named_hasOwnProperty.json', d => { d.batch = 'hasOwnProperty'; }));
  check((await alerts()).some(m => m.includes('not a batch of sessions')), 'a batch named hasOwnProperty is refused');
  await upload('#batch-file', fixture('batch_R01_B2.json'));
  check(await js(`document.querySelectorAll('.batch-head').length === 2 && document.querySelectorAll('.srow').length === 2`), 'our batch B2 is added');
  await upload('#batch-file', fixture('batch_R01_B2.json'));
  check((await alerts()).some(m => m.includes('already here')), 'the same batch twice is refused');
  await upload('#batch-file', await batchVariant('batch_R01_B3.json', d => { d.batch = 'B3'; d.sessions[0].id = 'S03'; }));
  check((await alerts()).some(m => m.includes('damaged')) && await js(`document.querySelectorAll('.srow').length === 2`), 'a batch whose content does not match its checksum is refused');
  await shot('2-home');
  await click(await row(1));
  check(await js(`document.getElementById('sid').textContent === 'S02' && session().lines.length === 5`), 'a session from the added batch opens');

  const [file2, s2] = await saveNow(2, dateIn(-1));
  const text = JSON.stringify(s2), marks = s2.sessions.S01.marks;
  check(s2.save_no === 2 && s2.saved_on === dateIn(-1) && JSON.stringify(s2.practice) === JSON.stringify(s1.practice) && JSON.stringify(s2.experience) === JSON.stringify(s1.experience), "day 2 saved: save 2 with its date; practice record and experience keep day 1's");
  check(marks.map(m => m.seq).join() === '1,2,3,4' && s2.sessions.S01.active >= s1.sessions.S01.active && s2.batches.map(b => b.id).join() === 'B1,B2' && s2.batches.every(b => /^[0-9a-f]{64}$/.test(b.sha256)) && s2.batches[1].added === dateIn(-1), 'day 2 saved: marks in order, time kept, both batches with checksums');
  check(marks.every(m => Array.from(m.version === 'raw' ? lines[m.line].raw : lines[m.line].text).slice(m.start, m.end).join('') === m.quote), 'saved quotes are the exact text at their offsets');
  check(!/\d{2}:\d{2}/.test(text.replace(/"(quote|note|text|raw)":"(?:[^"\\]|\\.)*"/g, '')), 'no clock time anywhere in the file or its name: dates only');
  check(marks.every(m => /^m[0-9a-f]{12}$/.test(m.id) && Number.isInteger(m.t)) && new Set(marks.map(m => m.seq)).size === marks.length, 'mark ids are random; order numbers unique; active seconds per mark');
  check(s2.codebook === 'pbt' && s2.codebook_spec.tags.map(t => t.id).join() === 'clinical,process,strategy,assumes,form', 'the file carries its codebook');

  // Day 3, today: the file covers batch B2, which came as a file: it must be added again first.
  await setDay(0); await open();
  check(await js(`today()`) === dateIn(0), 'day 3: today');
  await upload('#file', file2);
  check((await alerts()).some(m => m.includes('Add that batch file first')) && await js(`!Object.keys(state.books).length && !document.getElementById('welcome').hidden`), 'day 3: a file covering a batch not yet added is refused, with what to do');
  await click(await centre('#w-skip'));
  await upload('#batch-file', fixture('batch_R01_B2.json'));
  await upload('#file', file2);
  check((await alerts()).length === 0 && (await confirms()).length === 0 && await js(`state.books.pbt.S01.marks.length === 4 && state.books.pbt.S01.submitted === ${JSON.stringify(dateIn(-1))} && state.tour.date === ${JSON.stringify(dateIn(-2))} && state.experience.psychology === true && state.saves === 2`), "day 3: after adding the batch, the file loads, with day 1's practice date");

  // Refused files leave the work on the page exactly as it was, and say why.
  const kept = () => js(`JSON.stringify({ books: state.books, tour: state.tour, experience: state.experience, saves: state.saves, changedAt: state.changedAt, fileAt: state.fileAt })`);
  const before = await kept();
  const variant = (name, change) => { const d = JSON.parse(JSON.stringify(s2)); change(d); const f = join(downloads, name); writeFileSync(f, JSON.stringify(d)); return f; };
  const S01 = d => d.sessions.S01, first = d => d.sessions.S01.marks[0];
  for (const [name, change, says] of [
    ['other copy', d => { d.package_id = 'someone-else'; }, 'another study or copy'],
    ['other rater', d => { d.rater = 'R99'; }, 'belongs to rater R99'],
    ['no schema', d => { delete d.schema; }, 'not a saved ratings file'],
    ['sessions null', d => { d.sessions = null; }, 'not a saved ratings file'],
    ['practice not a record', d => { d.practice = 'done'; }, 'not a saved ratings file'],
    ['no batch list', d => { delete d.batches; }, 'does not list its batches'],
    ['empty batch list', d => { d.batches = []; }, 'from batches it does not list'],
    ['batch without checksum', d => { delete d.batches[0].sha256; }, 'does not list its batches'],
    ['other batch version', d => { d.batches[1].sha256 = 'f'.repeat(64); }, 'different version of batch B2'],
    ['read null', d => { S01(d).read = null; }, 'S01: read'],
    ['shown not a number', d => { S01(d).shown = 'invalid'; }, 'S01: shown'],
    ['shown past the end', d => { S01(d).shown = 99; }, 'S01: shown'],
    ['submitted not a date', d => { S01(d).submitted = 'yesterday'; }, 'S01: submitted'],
    ['answer out of range', d => { S01(d).answers.naturalness = 7; }, 'S01: answers'],
    ['unknown session', d => { d.sessions.S99 = S01(d); }, 'S99'],
    ['session named toString', d => { d.sessions.toString = S01(d); }, 'toString'],
    ['session named __proto__', d => { Object.defineProperty(d.sessions, '__proto__', { value: S01(d), enumerable: true }); }, '__proto__'],
    ['batch named constructor', d => { d.batches[0].id = 'constructor'; }, 'does not list its batches'],
    ['note over the limit', d => { first(d).note = 'x'.repeat(5001); }, ': note'],
    ['answer over the limit', d => { S01(d).answers.note = 'x'.repeat(5001); }, 'S01: answers'],
    ['moved quote', d => { first(d).start += 1; }, ': quote'],
    ['unknown colour', d => { first(d).tag = 'nonsense'; }, ': tag'],
    ['colour of the other speaker', d => { first(d).tag = 'strategy'; }, ': tag'],
    ['unknown word', d => { first(d).picks = ['Nonsense']; }, ': picks'],
    ['words out of order', d => { first(d).picks = [...first(d).picks].reverse(); }, ': picks'],
    ['mark id twice', d => { S01(d).marks[1].id = first(d).id; }, ': id'],
    ['offsets not numbers', d => { first(d).start = '0'; }, ': offsets'],
  ]) {
    await upload('#file', variant(`${name.replace(/ /g, '_')}.json`, change));
    const said = await alerts();
    check(said.some(m => m.includes(says) && m.endsWith('Nothing was loaded.')) && await kept() === before, `refused, work unchanged: ${name}`, said.join(' | '));
  }
  await click(await row(0));
  check(await js(`document.getElementById('sid').textContent === 'S01' && document.querySelectorAll('#dialogue .line').length === 7 && document.querySelectorAll('.hl').length >= 4 && !document.getElementById('wrap').hidden`), 'after the refusals the session still shows, with its marks');

  // Loading over work not yet in a file asks first; no keeps the work.
  await click(await centre('#home-btn'));
  await click(await row(1));
  await key(' ');
  await markOn(1, 'My voice shook at the start', 1, ['Physical symptoms', 'Named in the passage']);
  await js(`window.__answer = false`);
  await upload('#file', file2);
  check((await confirms()).some(m => m.includes('not saved in a file yet')) && await js(`state.books.pbt.S02.marks.length === 1`), 'loading over unsaved work asks first; no keeps the work');
  await js(`window.__answer = true`);
  await upload('#file', file2);
  check((await confirms()).length === 1 && await js(`state.books.pbt.S02.marks.length === 0 && !document.getElementById('home').hidden`), 'yes loads the file in its place');
  const [, s3] = await saveNow(3, dateIn(0));
  check(s3.save_no === 3 && s3.saved_on === dateIn(0) && JSON.stringify(s3.practice) === JSON.stringify(s1.practice) && JSON.stringify(s3.experience) === JSON.stringify(s1.experience) && JSON.stringify(s3.sessions) === JSON.stringify(s2.sessions), "day 3 saved: save 3 with today's date; practice record, experience and sessions intact");


  // A fresh page whose only work is one mark: removing it is unsaved work, so loading over it asks first.
  await open();
  await click(await centre('#w-skip'));
  await click(await row(0));
  await key(' ');
  await markOn(1, 'I practised the talk twice at home', 1, ['Anxiety', 'Inferred from context', 'Coping']);
  const [file4] = await saveNow(1, dateIn(0));
  await calm(500); await select(1, 'I practised the talk twice at home'); await key('1');
  await click(await centreEl(`[...document.querySelectorAll('#toolbar .btn')].find(b => b.textContent === 'Remove')`));
  check(await js(`Object.values(state.books.pbt).every(st => !st.marks.length && !Object.keys(st.answers).length) && state.unsaved === true`), 'the only mark removed: no marks left, but unsaved work');
  await js(`window.__answer = false`);
  await upload('#file', file4);
  check((await confirms()).some(m => m.includes('not saved in a file yet')) && await js(`state.books.pbt.S01.marks.length === 0`), 'loading over a removed mark asks first; no keeps the removal');
  await js(`window.__answer = true`);
  await upload('#file', file4);
  check((await confirms()).length === 1 && await js(`state.books.pbt.S01.marks.length === 1 && state.unsaved === false`), 'yes loads the file: the mark is back');

  // Text stops at the limit while typing and says so; a file saved at the limit loads again.
  await click(await row(0));
  await calm(500); await select(1, 'and that went fine'); await key('1');
  await tab.send('Input.insertText', { text: 'x'.repeat(5001) });
  check(await js(`document.querySelector('#toolbar textarea').value.length === 5000 && !document.querySelector('#toolbar .limit').hidden`), 'a note stops at 5,000 characters and says so');
  await key('Enter'); await key('Escape');
  while (!(await st()).done) await key(' ');
  await calm(500);
  await click(await centreEl(`document.querySelector('.wrap textarea')`));
  await tab.send('Input.insertText', { text: 'y'.repeat(5001) });
  check(await js(`document.querySelector('.wrap textarea').value.length === 5000 && !document.querySelector('.wrap .limit').hidden && sess().answers.note.length === 5000`), 'a written answer stops at 5,000 characters and says so');
  await shot('3-limit');
  check(await js(`document.documentElement.scrollWidth <= document.documentElement.clientWidth && [...document.querySelectorAll('.mitem small')].every(e => e.textContent.length < 200)`), 'a long note is cut short in the marks list; no horizontal scroll');
  const [file5, s5] = await saveNow(2, dateIn(0));
  check(s5.sessions.S01.marks.some(m => m.note.length === 5000) && s5.sessions.S01.answers.note.length === 5000, 'saved at the limit: note and answer');
  await upload('#file', file5);
  check((await alerts()).length === 0 && (await confirms()).length === 0 && await js(`state.books.pbt.S01.answers.note.length === 5000 && state.books.pbt.S01.marks.some(m => m.note.length === 5000)`), 'a file saved at the limit loads again');

  check(requests() > 0 && offsite().length === 0, 'no request leaves the device over three days', offsite().slice(0, 3).join(' '));
  check(await js(`localStorage.length === 0 && sessionStorage.length === 0`), 'nothing written to browser storage over three days');
  check(pageErrors().length === 0, 'no page errors', pageErrors().join(' | '));
  check(blocked().length === 0, 'the page broke no rule of its security policy over three days', blocked().join(' | '));
});
