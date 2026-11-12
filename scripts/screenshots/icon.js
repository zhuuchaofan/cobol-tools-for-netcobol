/*
 * images/icon.svg → images/icon.png (256 x 256).   npm run icon
 */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { launch } = require('./chrome');

const root = path.join(__dirname, '..', '..');

(async () => {
  const svg = fs.readFileSync(path.join(root, 'images', 'icon.svg'), 'utf8');
  const html = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'netcobol-icon-')), 'icon.html');
  fs.writeFileSync(html, `<!doctype html><html><body style="margin:0;background:transparent"><div id="shot" style="width:128px;height:128px;line-height:0">${svg}</div></body></html>`);
  const browser = await launch();
  try {
    await browser.screenshot(html, path.join(root, 'images', 'icon.png'), 2);
  } finally {
    await browser.close();
  }
  console.log('  images/icon.png');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
