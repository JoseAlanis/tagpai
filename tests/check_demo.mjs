// The Clinical Dialogue demo: the guided practice on Bill's made-up
// session, step by step, and what a demo
// keeps (nothing). Then phone width, network, the security policy and framing; last, the page served over
// HTTP, as on GitHub Pages.
//   node tests/check_demo.mjs dist/clinical-dialogue/index.html dist/shots/demo
import { readdirSync, readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { run } from './browser.mjs';

const [htmlPath, shotDir] = process.argv.slice(2);
await run(htmlPath, shotDir, async ({ tab, js, check, shot, key, calm, select, click, centre, pick, st, open, offsite, requests, pageErrors, until, sleep, downloads }) => {
  const step = () => js(`state.tour.step`);
  const veiled = () => js(`!document.getElementById('dim').hidden && document.getElementById('coach').classList.contains('lifted')`);
  const lifted = () => js(`[...document.querySelectorAll('.line.lifted')].map(a => a.dataset.i).join()`);
  const goText = () => js(`document.getElementById('coach-go').hidden ? '' : document.getElementById('coach-go').textContent`);
  const title = () => js(`document.getElementById('coach-title').textContent`);
  const kw = () => js(`[...document.querySelectorAll('#coach-text .kw')].map(k => k.textContent + ':' + k.style.getPropertyValue('--rgb')).join(' ')`);
  const chips = () => js(`[...document.querySelectorAll('#toolbar .chip')].map(c => c.childNodes[1].textContent).join()`);
  const draft_ = () => js(`draft ? draft.picks.join() : null`);
  const mark = async (i, phrase, k, picks, version = 'text') => {
    await calm(); await select(i, phrase, version);
    await key(String(k));
    for (const p of picks) await click(await pick(p));
    await key('Enter');
  };

  // Welcome: the edition's name, the demo line instead of a rater code.
  check(await js(`document.title === 'TagpAI Clinical Dialogue' && document.querySelector('#welcome .brand').textContent === 'TagpAI Clinical DialogueA human annotation tool for AI research'`), 'the edition names the page and the welcome');
  check(await js(`document.querySelector('#welcome .sub').textContent.includes('made-up case') && !document.getElementById('w-rater')`), 'welcome shows the demo line');
  check(await js(`(() => { const t = document.querySelector('#welcome .sub').textContent; return t.includes('no network requests of its own') && !t.includes('sends nothing'); })()`), 'the demo line makes the qualified claim');
  check(await js(`document.getElementById('w-hosting').hidden`), 'opened from a file: no hosting notice');
  await shot('0-welcome');
  await click(await centre('#w-start'));
  check(await js(`state.view === 'tour' && cb() === CODEBOOKS.pbt && TOUR === TOUR_BILL`), 'the practice is Bill, with the process-based codebook');

  check(await veiled() && await title() === 'Welcome to this conversation annotation tool', 'the welcome panel comes first');
  await calm(); await shot('1-panel');
  await key(' ');
  check(await step() === 1 && await lifted() === '0', 'Start: the opening with its panel');
  await key(' ');
  check(await step() === 2 && (await st()).shown === 2 && await lifted() === '1' && await title() === "Let's look at Bill's reply together", 'Continue brings up Bill with a panel that explains it');
  check(await kw() === 'Clinical:124,92,230', 'the colour name in the panel is styled like its mark');
  await key(' ');
  await calm(); await shot('2-hint');
  await select(1, 'my heart starts racing');
  check(await chips() === 'Clinical,Process,Form', 'a patient reply offers Clinical, Process and Form');
  await key('1');
  check(await step() === 5, 'selecting and picking Clinical advance');
  check(await js(`[...document.querySelectorAll('#toolbar .pick-block')][0].textContent.includes('Fear of being judged')`), 'the symptom areas are the social anxiety ones');
  check(await js(`document.querySelector('#toolbar .tb-actions .btn.primary').disabled`), 'Clinical waits for a word or a note');
  await click(await pick('Physical symptoms')); await click(await pick('Named in the passage')); await key('Enter');
  check(await step() === 6, 'area and how it is known save the first mark');
  await key('Escape');
  await mark(1, "I'm socially awkward", 1, ['Negative self-image', 'Named in the passage']);
  check(await step() === 7 && (await st()).marks.filter(m => m.line === 1).length === 2, 'a second Clinical mark in the same reply');
  await key('Escape');
  await key(' ');
  check(await step() === 8 && await lifted() === '2', 'a stop at the therapist reply');
  await key(' ');
  check(await step() === 9 && await lifted() === '3' && await title() === 'Symptoms and processes', 'then Bill, with the panel on symptoms and processes');
  check((await kw()).includes('Process:16,152,173'), 'Process is named in its own colour');
  await key(' ');
  await calm();
  await select(3, "I can't stand that feeling");
  await key('2');
  check(await js(`(() => { const b = [...document.querySelectorAll('#toolbar .pick-block')]; return b.length === 2 && b[1].hidden; })()`), 'the side waits until a process is picked');
  check(await js(`document.querySelector('#toolbar textarea').spellcheck === false`), 'the note field is not spellchecked by the browser');
  await click(await pick('Distress tolerance'));
  check(await js(`(() => { const b = [...document.querySelectorAll('#toolbar .pick-block')][1]; return !b.hidden && !b.querySelector('.pick-hint').hidden; })()`), 'with a process, its side appears and asks');
  await calm(); await shot('3-process');
  await click(await pick('Maladaptive'));
  await click(await pick('Distress tolerance'));
  check(await draft_() === '' && await js(`[...document.querySelectorAll('#toolbar .pick-block')][1].hidden`), 'taking the process away takes its side with it');
  await click(await pick('Social skills')); await click(await pick('Distress tolerance')); await click(await pick('Maladaptive'));
  check(await draft_() === 'Distress tolerance,Maladaptive', 'one process per mark: a second replaces the first');
  await key('Enter');
  check(await step() === 11 && (await st()).marks.some(m => m.line === 3 && m.tag === 'process' && m.picks.join() === 'Distress tolerance,Maladaptive'), 'Process saved with its side');
  await key('Escape');
  await key(' ');
  check(await step() === 12 && await lifted() === '4', 'a stop at the therapist link');
  await key(' ');
  check(await step() === 13 && await title() === 'Processes have two sides', 'the adaptive side is explained first');
  await key(' ');
  await mark(5, 'I stayed until the end, and it was okay', 2, ['Distress tolerance', 'Adaptive']);
  check(await step() === 15, 'the adaptive side');
  await key('Escape');
  await mark(5, 'all I could think about was whether they could see my hands', 2, ['Self-focused attention', 'Maladaptive']);
  check(await step() === 16 && await title() === 'The raw output: a quality check', 'self-focused attention, then the raw output');
  await key('Escape');
  await calm(); await shot('4-raw');
  check(await js(`[...document.querySelectorAll('.text[data-i="5"][data-version="raw"] .removed')].map(s => s.textContent).join('')`) === '*looks at the floor*', 'raw output shown with the unseen part underlined');
  await key(' ');
  await mark(5, '*looks at the floor*', 5, ['Stage directions'], 'raw');
  check(await step() === 18 && (await st()).marks.some(m => m.version === 'raw' && m.quote === '*looks at the floor*' && m.tag === 'form'), 'the stage direction in the raw output, marked Form');
  await key('Escape');
  await key(' ');
  check(await step() === 19 && await title() === 'What the therapist does' && (await kw()).includes('Strategy:47,158,68'), 'the strategies are explained, in their colour');
  await key(' ');
  await calm();
  await select(6, 'give the first minute of your talk here, and let the anxiety be there without stopping');
  check(await chips() === 'Strategy,Assumes,Form', 'a therapist reply offers Strategy, Assumes and Form');
  await key('3'); await click(await pick('Exposure'));
  await calm(); await shot('5-strategy');
  await key('Enter');
  check(await step() === 21, 'Exposure');
  await key('Escape');
  await mark(6, 'keep your attention on me, your listener, not on your hands', 3, ['Attention training']);
  check(await step() === 22, 'Attention training');
  await key('Escape');
  await key(' ');
  const s = await st(), lines = await js(`PRACTICE.lines`);
  check(await step() === 23 && await goText() === 'Finish' && await js(`document.getElementById('wrap').classList.contains('lifted')`), 'the last panel lights up the marks and questions');
  check(s.marks.length === 8 && ['clinical', 'process', 'strategy', 'form'].every(t => s.marks.some(m => m.tag === t)), 'eight marks in four colours');
  check(s.marks.every(m => Array.from(m.version === 'raw' ? lines[m.line].raw : lines[m.line].text).slice(m.start, m.end).join('') === m.quote), 'every quote is the exact text at its offsets');
  check(await js(`document.getElementById('wrap').textContent.includes('Which process would you target first?')`), 'the questions are the process-based ones');
  await calm(); await shot('6-end');
  await click(await centre('#coach-go'));
  check(await js(`!document.getElementById('home').hidden && document.getElementById('home-sub').textContent === 'This copy holds the practice only.' && state.tour.done && state.practice === null && !Object.keys(state.books).some(k => Object.keys(state.books[k]).length)`), 'home: practice only; nothing from the practice is kept');
  check(await js(`document.querySelector('#home .brand').textContent.startsWith('TagpAI Clinical Dialogue') && document.getElementById('codebook-row').hidden`), 'home: the edition line, no codebook choice');
  await shot('7-home');
  await click(await centre('#help-btn'));
  check(await js(`(() => { const t = document.getElementById('legend').textContent; return ['Fear of being judged', 'Self-focused attention', 'Attention training', 'Relaxation'].every(x => t.includes(x)); })()`), 'help lists areas, processes and strategies');
  check(await js(`document.getElementById('about').textContent === 'TagpAI Clinical Dialogue, version ' + APP.version && /^\\d+\\.\\d+\\.\\d+$/.test(APP.version)`), 'help names the edition and the version');
  await shot('8-help');
  await key('Escape');

  // A demo keeps nothing: no storage, no Save, no experience questions; a reload starts afresh.
  check(await js(`localStorage.length === 0 && getComputedStyle(document.getElementById('save')).display === 'none' && getComputedStyle(document.getElementById('h-experience')).display === 'none'`), 'demo: nothing stored, no Save, no experience questions');
  await key('s', 2);
  await sleep(600);
  check(readdirSync(downloads).length === 0, 'demo: Ctrl+S saves nothing', readdirSync(downloads).join(' '));
  await tab.send('Page.reload');
  await open();
  check(await js(`!state.tour.done && state.view === 'welcome' && localStorage.length === 0`), 'demo: a reload starts afresh at the welcome');
  await click(await centre('#w-skip'));

  await tab.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  await sleep(300);
  check(await js(`document.documentElement.scrollWidth <= 390`), 'no horizontal scroll at phone width');
  await click(await centre('#home-practice'));
  await key(' '); await key(' '); await key(' ');
  await calm(); await shot('9-phone-hint');
  check(await js(`document.documentElement.scrollWidth <= 390`), 'no horizontal scroll in the practice at phone width');

  check(requests() > 0 && offsite().length === 0, 'no request leaves the device over the whole run', offsite().slice(0, 3).join(' '));
  check(await js(`(() => { const m = document.querySelector('meta[http-equiv="Content-Security-Policy"]').content; window.__ran = 0; const s = document.createElement('script'); s.textContent = 'window.__ran = 1'; document.body.append(s); return /script-src 'sha256-[^']+'/.test(m) && !/script-src[^;]*unsafe-inline/.test(m) && m.includes("base-uri 'none'") && m.includes("connect-src 'none'") && window.__ran === 0; })()`), "only the page's own script may run: an injected one is blocked");
  check(pageErrors().length === 0, 'no page errors', pageErrors().join(' | '));
  const page = readFileSync(htmlPath, 'utf8');
  await js(`(() => { const f = document.createElement('iframe'); f.id = 'framed'; f.srcdoc = ${JSON.stringify(page)}; document.body.append(f); return true; })()`);
  check(await until(() => js(`(() => { const d = document.getElementById('framed').contentDocument; return !!d && !!d.body && d.body.textContent.includes('does not run inside another page') && !d.getElementById('welcome'); })()`), 'framed copy refuses'), 'inside another page (a frame) the app refuses to start');

  // Served over HTTP at a Pages-like path: the hosting notice shows; the page asks for nothing but itself.
  const server = createServer((req, res) => {
    if (req.url === '/tagpai/clinical-dialogue/') { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); res.end(page); }
    else { res.writeHead(404); res.end(); }
  });
  await new Promise(ok => server.listen(0, '127.0.0.1', ok));
  const served = `http://127.0.0.1:${server.address().port}/tagpai/clinical-dialogue/`;
  try {
    await tab.send('Emulation.clearDeviceMetricsOverride');
    const from = tab.events.length;
    await tab.send('Page.navigate', { url: served });
    await until(() => tab.events.slice(from).some(e => e.method === 'Page.loadEventFired'), 'served load');
    await until(() => js(`typeof state !== 'undefined' && !document.getElementById('welcome').hidden`), 'served app');
    check(await js(`!document.getElementById('w-hosting').hidden && document.getElementById('w-hosting').textContent === "Hosted on GitHub Pages; GitHub logs visitors' IP addresses (see its privacy statement)."`), 'served over the web: the welcome carries the hosting notice');
    await calm(); await shot('10-served-welcome');
    await click(await centre('#w-start')); await key(' '); await key(' ');
    check(await js(`state.view === 'tour' && state.tour.step === 2`), 'served: the practice runs');
    check(await js(`(() => { window.__ran = 0; const s = document.createElement('script'); s.textContent = 'window.__ran = 1'; document.body.append(s); return window.__ran === 0; })()`), 'served: an injected script is blocked');
    const asked = tab.events.slice(from).filter(e => e.method === 'Network.requestWillBeSent').map(e => e.params.request.url).filter(u => !/^(data|blob):/.test(u));
    check(asked.length === 1 && asked[0] === served, 'served: the only request is the page itself', asked.join(' '));
    check(await js(`localStorage.length === 0 && sessionStorage.length === 0`), 'served: nothing stored');
    const errs = tab.events.slice(from).filter(e => e.method === 'Runtime.exceptionThrown' || (e.method === 'Runtime.consoleAPICalled' && e.params.type === 'error'));
    check(errs.length === 0, 'served: no page errors', errs.map(e => JSON.stringify(e.params).slice(0, 200)).join(' | '));
  } finally {
    server.close();
  }
});
