// The project page: what it says, its links, and that it asks for nothing and runs nothing; light, dark and
// phone width. Then the site served over HTTP at a Pages-like path: from the project page to an edition.
//   node tests/check_site.mjs dist/site dist/shots/site
import { createServer } from 'node:http';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { run } from './browser.mjs';

const [siteDir, shotDir] = process.argv.slice(2);
const editions = readdirSync(siteDir, { withFileTypes: true }).filter(d => d.isDirectory()).map(d => d.name).sort();

await run(join(siteDir, 'index.html'), shotDir, async ({ tab, js, check, shot, click, centreEl, offsite, requests, blocked, pageErrors, until, sleep }) => {
  await js('document.fonts.ready.then(() => true)');
  check(await js(`document.title === 'TagpAI' && document.querySelector('h1').textContent === 'TagpAI'`), 'the page names TagpAI');
  check(await js(`JSON.stringify([...document.querySelectorAll('.edition a.open')].map(a => a.getAttribute('href')).sort())`) === JSON.stringify(editions.map(e => `${e}/`)),
    'every edition is listed, with a link to its folder', editions.join(' '));
  check(await js(`[...document.querySelectorAll('.edition')].every(e => e.querySelector('h3').textContent.trim() && e.querySelector('p').textContent.trim())`), 'each edition has a name and a description');
  check(await js(`document.body.textContent.includes('Not yet for studies') && /version \\d+\\.\\d+\\.\\d+/.test(document.querySelector('footer').textContent)`), 'the status and the version are stated');
  check(await js(`(() => { const p = [...document.querySelectorAll('h2')].find(h => h.textContent === 'Privacy').nextElementSibling; return p.textContent.includes('GitHub logs the visitor') && p.querySelector('a').href.startsWith('https://docs.github.com/'); })()`), 'the privacy note says GitHub logs IP addresses, with a link to its documentation');
  check(await js(`[...[...document.querySelectorAll('h2')].find(h => h.textContent === 'Privacy').nextElementSibling.querySelectorAll('a')].some(a => a.href === 'https://github.com/JoseAlanis/tagpai/blob/main/PRIVACY.md')`), 'the privacy note links the privacy notice');
  check(await js(`document.querySelector('footer a').href === 'https://github.com/JoseAlanis/tagpai'`), 'the footer links the source code');
  check(await js(`document.fonts.check('17px "Reader Sans"') && getComputedStyle(document.body).fontFamily.startsWith('"Reader Sans"')`), 'the embedded font is used');
  await shot('1-light');

  check(await js(`document.scripts.length === 0`), 'the page has no script');
  check(blocked().length === 0, 'the page breaks no rule of its security policy', blocked().join(' | '));
  check(await js(`(() => {
    const m = document.querySelector('meta[http-equiv="Content-Security-Policy"]').content;
    window.__ran = 0; const s = document.createElement('script'); s.textContent = 'window.__ran = 1'; document.body.append(s);
    const st = document.createElement('style'); st.textContent = 'body { display: none !important; }'; document.head.append(st);
    const d = document.createElement('div'); d.setAttribute('style', 'width: 123px'); document.body.append(d);
    const ok = m.includes("default-src 'none'") && !m.includes('script-src') && /style-src 'sha256-[^']+';/.test(m) && window.__ran === 0
      && getComputedStyle(document.body).display !== 'none' && getComputedStyle(d).width !== '123px';
    s.remove(); st.remove(); d.remove(); return ok; })()`), 'nothing injected runs or applies: a script, a style block, a style attribute');
  check(blocked().length === 3, 'the policy reports what was blocked: the script, the style block, the style attribute', blocked().join(' | '));

  await tab.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'dark' }] });
  await sleep(200);
  check(await js(`getComputedStyle(document.body).backgroundColor === 'rgb(29, 29, 34)' && getComputedStyle(document.body).color === 'rgb(236, 236, 241)'`), 'dark mode follows the system setting');
  await shot('2-dark');
  await tab.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'light' }] });
  await tab.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  await sleep(300);
  check(await js(`document.documentElement.scrollWidth <= 390`), 'no horizontal scroll at phone width');
  await shot('3-phone');
  await tab.send('Emulation.clearDeviceMetricsOverride');

  check(requests() > 0 && offsite().length === 0, 'no request leaves the device', offsite().slice(0, 3).join(' '));
  check(await js(`localStorage.length === 0 && sessionStorage.length === 0 && document.cookie === ''`), 'nothing stored');
  check(pageErrors().length === 0, 'no page errors', pageErrors().join(' | '));

  // Served as GitHub Pages serves a project site: the project page at /tagpai/, each edition in its folder.
  const files = { '/tagpai/': join(siteDir, 'index.html') };
  for (const e of editions) files[`/tagpai/${e}/`] = join(siteDir, e, 'index.html');
  const server = createServer((req, res) => {
    const f = files[req.url];
    if (f && existsSync(f)) { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); res.end(readFileSync(f)); }
    else { res.writeHead(404); res.end(); }
  });
  await new Promise(ok => server.listen(0, '127.0.0.1', ok));
  const base = `http://127.0.0.1:${server.address().port}/tagpai/`;
  try {
    const from = tab.events.length, before = blocked().length;
    await tab.send('Page.navigate', { url: base });
    await until(() => tab.events.slice(from).some(e => e.method === 'Page.loadEventFired'), 'served load');
    check(await js(`document.querySelector('h1').textContent === 'TagpAI'`), 'served: the project page');
    const first = editions[0];
    const loads = tab.events.slice(from).filter(e => e.method === 'Page.loadEventFired').length;
    await click(await centreEl(`document.querySelector('.edition a.open[href="${first}/"]')`));
    await until(() => tab.events.slice(from).filter(e => e.method === 'Page.loadEventFired').length > loads, 'edition load');
    await until(() => js(`typeof state !== 'undefined' && !document.getElementById('welcome').hidden`), 'edition app');
    check(await js(`location.pathname === '/tagpai/${first}/' && !document.getElementById('w-hosting').hidden`), 'served: its link opens the edition, which shows the hosting notice');
    const asked = tab.events.slice(from).filter(e => e.method === 'Network.requestWillBeSent').map(e => e.params.request.url).filter(u => !/^(data|blob):/.test(u));
    check(asked.length === 2 && asked[0] === base && asked[1] === `${base}${first}/`, 'served: the only requests are the two pages', asked.join(' '));
    check(blocked().length === before, 'served: neither page breaks a rule of its policy', blocked().slice(before).join(' | '));
    const errs = tab.events.slice(from).filter(e => e.method === 'Runtime.exceptionThrown' || (e.method === 'Runtime.consoleAPICalled' && e.params.type === 'error'));
    check(errs.length === 0, 'served: no page errors', errs.map(e => JSON.stringify(e.params).slice(0, 200)).join(' | '));
  } finally {
    server.close();
  }
}, { app: false });
