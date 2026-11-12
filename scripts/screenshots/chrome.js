/*
 * Minimal headless Chrome / Edge driver over the DevTools protocol (no npm dependencies).
 * Needs Node 22+ (global WebSocket).
 */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

const CANDIDATES = [
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser'
].filter(Boolean);

function findBrowser() {
  const found = CANDIDATES.find((p) => fs.existsSync(p));
  if (!found) throw new Error('Chrome / Edge not found. Set CHROME_PATH.');
  return found;
}

async function launch() {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'netcobol-shots-'));
  const proc = spawn(
    findBrowser(),
    ['--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profile}`, '--hide-scrollbars', '--no-first-run', '--no-default-browser-check', 'about:blank'],
    { stdio: ['ignore', 'ignore', 'pipe'] }
  );
  const wsUrl = await new Promise((resolve, reject) => {
    let buf = '';
    const timer = setTimeout(() => reject(new Error('browser did not start')), 20000);
    proc.stderr.on('data', (d) => {
      buf += d;
      const m = /DevTools listening on (ws:\/\/\S+)/.exec(buf);
      if (m) {
        clearTimeout(timer);
        resolve(m[1]);
      }
    });
    proc.on('exit', () => reject(new Error('browser exited:\n' + buf)));
  });
  const port = new URL(wsUrl).port;
  const target = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' })).json();
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r, j) => {
    ws.onopen = r;
    ws.onerror = j;
  });
  let id = 0;
  const pending = new Map();
  const listeners = [];
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result);
    } else if (msg.method) {
      listeners.slice().forEach((l) => l(msg));
    }
  };
  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const n = ++id;
      pending.set(n, { resolve, reject });
      ws.send(JSON.stringify({ id: n, method, params }));
    });
  const once = (method) =>
    new Promise((resolve) => {
      const l = (m) => {
        if (m.method === method) {
          listeners.splice(listeners.indexOf(l), 1);
          resolve(m.params);
        }
      };
      listeners.push(l);
    });
  await send('Page.enable');
  await send('Emulation.setDefaultBackgroundColorOverride', { color: { r: 0, g: 0, b: 0, a: 0 } });

  return {
    /** Render an HTML file and save the element `#shot` as PNG (device scale `scale`). */
    async screenshot(htmlFile, outFile, scale = 2) {
      await send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 1200, deviceScaleFactor: scale, mobile: false });
      const loaded = once('Page.loadEventFired');
      await send('Page.navigate', { url: 'file:///' + htmlFile.replace(/\\/g, '/') });
      await loaded;
      await send('Runtime.evaluate', { expression: 'document.fonts.ready.then(() => new Promise(r => setTimeout(r, 300)))', awaitPromise: true });
      const { result } = await send('Runtime.evaluate', {
        expression: 'JSON.stringify((() => { const r = document.getElementById("shot").getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; })())',
        returnByValue: true
      });
      const clip = JSON.parse(result.value);
      await send('Emulation.setDeviceMetricsOverride', {
        width: Math.ceil(clip.x + clip.width),
        height: Math.ceil(clip.y + clip.height),
        deviceScaleFactor: scale,
        mobile: false
      });
      const { data } = await send('Page.captureScreenshot', { format: 'png', clip: { ...clip, scale: 1 }, captureBeyondViewport: true });
      fs.writeFileSync(outFile, Buffer.from(data, 'base64'));
    },
    async close() {
      ws.close();
      proc.kill();
      await new Promise((r) => setTimeout(r, 300));
      try {
        fs.rmSync(profile, { recursive: true, force: true });
      } catch {
        /* profile still locked on Windows; harmless */
      }
    }
  };
}

module.exports = { launch };
