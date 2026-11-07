// Drive a built page in headless Chrome over the DevTools protocol, with real mouse drags, key presses and
// file uploads. No dependencies: Node 22 or later (global WebSocket and fetch) and Google Chrome (or the
// browser named in $CHROME). The page is opened from disk, as raters open it.
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const sleep = ms => new Promise(r => setTimeout(r, ms));
async function until(probe, label, timeout = 10000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) { const v = await probe(); if (v) return v; await sleep(80); }
  throw new Error(`timed out: ${label}`);
}
class Conn {
  constructor(url) {
    this.ws = new WebSocket(url); this.n = 0; this.wait = new Map(); this.events = [];
    this.opened = new Promise((ok, no) => { this.ws.onopen = ok; this.ws.onerror = no; });
    this.ws.onmessage = m => {
      const d = JSON.parse(m.data);
      if (d.method) { this.events.push(d); return; }
      const w = this.wait.get(d.id); if (!w) return; this.wait.delete(d.id);
      d.error ? w.no(new Error(JSON.stringify(d.error))) : w.ok(d.result);
    };
  }
  send(method, params = {}) { const id = ++this.n; this.ws.send(JSON.stringify({ id, method, params })); return new Promise((ok, no) => this.wait.set(id, { ok, no })); }
  close() { try { this.ws.close(); } catch { /* already closed */ } }
}

// Run `body` against the page at `htmlPath`; print the checks that passed as JSON, and fail on the first that does not.
export async function run(htmlPath, shotDir, body) {
  mkdirSync(shotDir, { recursive: true });
  const downloads = mkdtempSync(join(tmpdir(), 'tagpai-dl-'));
  const profile = mkdtempSync(join(tmpdir(), 'tagpai-chrome-'));
  const chrome = spawn(process.env.CHROME || 'google-chrome', ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    `--user-data-dir=${profile}`, '--remote-debugging-port=0', '--window-size=1280,900', 'about:blank'], { stdio: 'ignore' });
  const passed = [], conns = [];
  let tab;
  const js = async expr => {
    const r = await tab.send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
    return r.result.value;
  };
  const check = (ok, label, detail = '') => { if (!ok) throw new Error(`check failed: ${label}${detail ? ` (${detail})` : ''}`); passed.push(label); };
  const shot = async name => { const { data } = await tab.send('Page.captureScreenshot', { format: 'png' }); writeFileSync(join(shotDir, `${name}.png`), Buffer.from(data, 'base64')); };
  const KEYS = { ' ': ['Space', 32], Escape: ['Escape', 27], Enter: ['Enter', 13] };
  const key = async (k, modifiers = 0) => {
    const [code, vk] = KEYS[k] || [/\d/.test(k) ? `Digit${k}` : `Key${k.toUpperCase()}`, k.toUpperCase().charCodeAt(0)];
    const text = modifiers ? undefined : k === 'Enter' ? '\r' : k.length === 1 ? k : undefined;
    await tab.send('Input.dispatchKeyEvent', { type: 'keyDown', key: k, code, windowsVirtualKeyCode: vk, text, modifiers });
    await tab.send('Input.dispatchKeyEvent', { type: 'keyUp', key: k, code, windowsVirtualKeyCode: vk, modifiers });
    await sleep(60);
  };
  // Wait until scrolling and the blend-in animation have stopped, so coordinates hold.
  const settle = () => js(`new Promise(r => { let last = -1, n = 0; const f = () => { if (scrollY === last && !document.querySelector('.enter') && !(typeof renderCoach !== 'undefined' && renderCoach.pending)) { if (++n > 4) return r(true); } else n = 0; last = scrollY; requestAnimationFrame(f); }; f(); })`);
  const calm = async (ms = 700) => { await settle(); await sleep(ms); };
  // Viewport point of the first or last character of `phrase` within a reply's text (scrolls it into view first).
  const point = async (i, version, phrase, edge) => { await settle(); return js(`(() => {
    const p = document.querySelector('.text[data-i="${i}"][data-version="${version}"]');
    const vr = p.getBoundingClientRect(); if (vr.top < 70 || vr.bottom > innerHeight - 20) p.scrollIntoView({ block: 'center' });
    const at = p.textContent.indexOf(${JSON.stringify(phrase)});
    if (at < 0) return null;
    const pos = ${edge === 'start' ? 'at' : `at + ${JSON.stringify(phrase)}.length`};
    const w = document.createTreeWalker(p, NodeFilter.SHOW_TEXT); let n, k = 0;
    while ((n = w.nextNode())) { if (${edge === 'start' ? 'pos < k + n.length' : 'pos <= k + n.length'}) break; k += n.length; }
    const r = document.createRange(); r.setStart(n, pos - k); r.setEnd(n, Math.min(pos - k + 1, n.length));
    const b = r.getClientRects()[0] || r.getBoundingClientRect();
    return { x: ${edge === 'start' ? 'b.left + 1' : 'b.left'}, y: b.top + b.height / 2 };
  })()`); };
  const drag = async (a, b) => {
    await tab.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: a.x, y: a.y, button: 'left', clickCount: 1 });
    await tab.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, button: 'left' });
    await tab.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: b.x, y: b.y, button: 'left' });
    await tab.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: b.x, y: b.y, button: 'left', clickCount: 1 });
    await sleep(120);
  };
  const select = async (i, phrase, version = 'text') => drag(await point(i, version, phrase, 'start'), await point(i, version, phrase, 'end'));
  const click = async p => {
    await tab.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: p.x, y: p.y, button: 'left', clickCount: 1 });
    await tab.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: p.x, y: p.y, button: 'left', clickCount: 1 });
    await sleep(120);
  };
  const centreEl = async expr => { await settle(); return js(`(() => { const e = ${expr}; e.scrollIntoView({ block: 'center' }); const r = e.getClientRects()[0] || e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`); };
  const centre = sel => centreEl(`document.querySelector(${JSON.stringify(sel)})`);
  const pick = label => centreEl(`[...document.querySelectorAll('#toolbar .pick')].find(b => b.textContent === ${JSON.stringify(label)})`);
  const st = () => js(`JSON.parse(JSON.stringify(sess()))`);
  const upload = async (selector, path) => {
    const { root } = await tab.send('DOM.getDocument');
    const { nodeId } = await tab.send('DOM.querySelector', { nodeId: root.nodeId, selector });
    await tab.send('DOM.setFileInputFiles', { nodeId, files: [path] });
    await sleep(400);
  };
  // Alerts and confirmations are collected instead of shown; `alerts()` and `confirms()` return and clear
  // them. A confirmation answers `window.__answer` (yes, unless a test says otherwise).
  const catchAlerts = () => js(`window.__alerts = []; window.__confirms = []; window.__answer = true; window.alert = m => window.__alerts.push(m); window.confirm = m => (window.__confirms.push(m), window.__answer); true`);
  const alerts = () => js(`window.__alerts.splice(0)`);
  const confirms = () => js(`window.__confirms.splice(0)`);
  const url = pathToFileURL(resolve(htmlPath)).href;
  // Open the page afresh (also a reload): wait for its load event, then for the app to stand.
  const open = async (ready = `!document.getElementById('welcome').hidden`) => {
    const from = tab.events.length;
    await tab.send('Page.navigate', { url });
    await until(() => tab.events.slice(from).some(e => e.method === 'Page.loadEventFired'), 'load');
    await until(() => js(`typeof state !== 'undefined' && ${ready}`), 'app');
    await catchAlerts();
  };
  // Every request over the whole run, not only at startup: the page itself, data: and blob: only.
  const offsite = () => tab.events.filter(e => e.method === 'Network.requestWillBeSent').map(e => e.params.request.url).filter(u => !/^(file|data|blob):/.test(u));
  const requests = () => tab.events.filter(e => e.method === 'Network.requestWillBeSent').length;
  const pageErrors = () => tab.events.filter(e => e.method === 'Runtime.exceptionThrown' || (e.method === 'Runtime.consoleAPICalled' && e.params.type === 'error'))
    .map(e => JSON.stringify(e.params).slice(0, 200));
  try {
    const portFile = join(profile, 'DevToolsActivePort');
    const port = await until(() => existsSync(portFile) && readFileSync(portFile, 'utf8').split('\n')[0], 'chrome');
    const version = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json();
    const page = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find(t => t.type === 'page');
    const browser = new Conn(version.webSocketDebuggerUrl); conns.push(browser); await browser.opened;
    await browser.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: downloads });
    tab = new Conn(page.webSocketDebuggerUrl); conns.push(tab); await tab.opened;
    await tab.send('Runtime.enable'); await tab.send('Page.enable'); await tab.send('Network.enable'); await tab.send('DOM.enable');
    await tab.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'light' }] });
    await open();
    await body({ tab, js, check, shot, key, settle, calm, point, drag, select, click, centre, centreEl, pick, st, upload,
                 alerts, confirms, open, offsite, requests, pageErrors, until, sleep, downloads, htmlPath });
    console.log(JSON.stringify({ ok: true, passed }, null, 1));
  } catch (e) {
    console.log(JSON.stringify({ ok: false, error: String(e), passed }, null, 1));
    process.exitCode = 1;
  } finally {
    conns.forEach(c => c.close());
    chrome.kill();
    await sleep(300);
    for (const dir of [downloads, profile]) try { rmSync(dir, { recursive: true, force: true }); } catch { /* left in the temp folder */ }
  }
}
