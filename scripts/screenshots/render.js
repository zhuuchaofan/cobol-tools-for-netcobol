/*
 * Renders the README screenshots from the real grammar, diagnostics and outline code.
 *
 *   npm run screenshots              # all languages
 *   npm run screenshots -- ja en     # some of them
 *
 * Output: images/<lang>/*.png  (ja, en, zh-cn). Needs Chrome or Edge (set CHROME_PATH if not found)
 * and the "BIZ UDGothic" font (bundled with Windows; otherwise loaded from Google Fonts).
 */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const Module = require('module');
const vsctm = require('vscode-textmate');
const oniguruma = require('vscode-oniguruma');
const { launch } = require('./chrome');

const root = path.join(__dirname, '..', '..');
const out = (...p) => path.join(root, 'out', ...p);

// ------------------------------------------------------------------ l10n / vscode stub
let bundle = {};
const fmt = (s, args) => s.replace(/\{(\d+)\}/g, (_, i) => String(args[i]));
const vscodeStub = { l10n: { t: (msg, ...args) => fmt(bundle[msg] ?? msg, args) } };
const origLoad = Module._load;
Module._load = function (request, ...rest) {
  return request === 'vscode' ? vscodeStub : origLoad.call(this, request, ...rest);
};
const { message } = require(out('extension.js'));
const { analyze } = require(out('core', 'diagnostics.js'));
const { parseStructure } = require(out('core', 'structure.js'));
const { fixedAreaRanges } = require(out('core', 'columns.js'));
const { detectFormat, isDebugLine } = require(out('core', 'format.js'));
const { renumber, formatSeq } = require(out('core', 'sequence.js'));

const LANGS = ['ja', 'en', 'zh-cn'];
const nls = (lang) => JSON.parse(fs.readFileSync(path.join(root, lang === 'en' ? 'package.nls.json' : `package.nls.${lang}.json`), 'utf8'));
const loadBundle = (lang) => (lang === 'en' ? {} : JSON.parse(fs.readFileSync(path.join(root, 'l10n', `bundle.l10n.${lang}.json`), 'utf8')));

// workbench strings (as VS Code itself shows them in each display language)
const UI = {
  ja: {
    font: '"Yu Gothic UI", "Segoe UI", "Meiryo UI", sans-serif',
    explorer: 'エクスプローラー', outline: 'アウトライン', timeline: 'タイムライン',
    problems: '問題', output: '出力', debugConsole: 'デバッグ コンソール', terminal: 'ターミナル', ports: 'ポート',
    lnCol: (l, c) => `行 ${l}、列 ${c}`, spaces: 'スペース: 4', at: (l, c) => `[行 ${l}、列 ${c}]`,
    viewProblem: '問題の表示 (Alt+F8)', quickFixLink: 'クイック フィックス... (Ctrl+.)', quickFix: 'クイック フィックス',
    definitions: '1 個の定義', before: '振り直し前', after: '振り直し後',
    seq: '一連番号', ind: '標識', a: 'A領域', b: 'B領域', ident: '識別領域', wide: '全角は 2 桁として数える'
  },
  en: {
    font: '"Segoe UI", sans-serif',
    explorer: 'Explorer', outline: 'Outline', timeline: 'Timeline',
    problems: 'Problems', output: 'Output', debugConsole: 'Debug Console', terminal: 'Terminal', ports: 'Ports',
    lnCol: (l, c) => `Ln ${l}, Col ${c}`, spaces: 'Spaces: 4', at: (l, c) => `[Ln ${l}, Col ${c}]`,
    viewProblem: 'View Problem (Alt+F8)', quickFixLink: 'Quick Fix... (Ctrl+.)', quickFix: 'Quick Fix',
    definitions: '1 definition', before: 'Before', after: 'After',
    seq: 'Sequence', ind: 'Indicator', a: 'Area A', b: 'Area B', ident: 'Ident.', wide: 'full-width = 2 columns'
  },
  'zh-cn': {
    font: '"Microsoft YaHei UI", "Segoe UI", sans-serif',
    explorer: '资源管理器', outline: '大纲', timeline: '时间线',
    problems: '问题', output: '输出', debugConsole: '调试控制台', terminal: '终端', ports: '端口',
    lnCol: (l, c) => `行 ${l}，列 ${c}`, spaces: '空格: 4', at: (l, c) => `[行 ${l}，列 ${c}]`,
    viewProblem: '查看问题 (Alt+F8)', quickFixLink: '快速修复... (Ctrl+.)', quickFix: '快速修复',
    definitions: '1 个定义', before: '重新编号前', after: '重新编号后',
    seq: '序号区', ind: '指示区', a: 'A 区', b: 'B 区', ident: '标识区', wide: '全角按 2 列计算'
  }
};

// ------------------------------------------------------------------ sources
const sjis = (f) => new TextDecoder('shift_jis').decode(fs.readFileSync(path.join(root, f))).split(/\r?\n/);
const SAMPLE = sjis('samples/sample.cob');
const ERRORS = sjis('samples/errors.cob');
const COPYBOOK = sjis('samples/KYOTUREC.cpy');
while (SAMPLE.at(-1) === '') SAMPLE.pop();
while (ERRORS.at(-1) === '') ERRORS.pop();
while (COPYBOOK.at(-1) === '') COPYBOOK.pop();

const RENUMBER_SRC = [
  '000100 PROCEDURE DIVISION.',
  '000200 MAIN-PROC SECTION.',
  '000300 開始処理.',
  '           OPEN INPUT URIAGE-FILE',
  '           PERFORM 2000-READ THRU 2000-EXIT',
  '000400     PERFORM UNTIL WS-EOF',
  '000350         ADD KINGAKU TO 合計金額',
  '000600         PERFORM 2000-READ THRU 2000-EXIT',
  '000700     END-PERFORM',
  '00080X     CLOSE URIAGE-FILE',
  '000900     STOP RUN.'
];

// ------------------------------------------------------------------ grammar + theme
let grammar;
let colorMap;
async function loadGrammar() {
  await oniguruma.loadWASM(fs.readFileSync(require.resolve('vscode-oniguruma/release/onig.wasm')).buffer);
  const registry = new vsctm.Registry({
    onigLib: Promise.resolve({
      createOnigScanner: (p) => new oniguruma.OnigScanner(p),
      createOnigString: (s) => new oniguruma.OnigString(s)
    }),
    loadGrammar: async (scope) => {
      if (scope !== 'source.netcobol') return null;
      const file = path.join(root, 'syntaxes/netcobol.tmLanguage.json');
      return vsctm.parseRawGrammar(fs.readFileSync(file, 'utf8'), file);
    }
  });
  const theme = JSON.parse(fs.readFileSync(path.join(__dirname, 'dark-modern.json'), 'utf8'));
  registry.setTheme({ name: 'dark', settings: [{ settings: { foreground: '#CCCCCC', background: '#1F1F1F' } }, ...theme.tokenColors] });
  colorMap = registry.getColorMap();
  grammar = await registry.loadGrammar('source.netcobol');
}

/** per-line arrays of { start, color, italic, bold } */
function tokenize(lines) {
  let state = vsctm.INITIAL;
  return lines.map((line) => {
    const r = grammar.tokenizeLine2(line, state);
    state = r.ruleStack;
    const toks = [];
    for (let i = 0; i < r.tokens.length; i += 2) {
      const m = r.tokens[i + 1];
      const fs = (m >>> 11) & 0xf;
      toks.push({ start: r.tokens[i], color: colorMap[(m >>> 15) & 0x1ff], italic: !!(fs & 1), bold: !!(fs & 2) });
    }
    return toks;
  });
}

// ------------------------------------------------------------------ html helpers
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const CH = 7; // px per half-width column (BIZ UDGothic 14px: half-width 0.5em, full-width 1em)
const LH = 20;
const GUTTER = 76; // glyph margin 18 + line numbers 40 + folding 18
const SEV_RANK = { info: 1, warning: 2, error: 3 };
const SEV_COLOR = { 1: '#3794FF', 2: '#CCA700', 3: '#F14C4C' };
const icon = (name, extra = '') => `<i class="codicon codicon-${name}" ${extra}></i>`;

/**
 * One document's state for rendering.
 * opts: { lines, diags?, marks?: [{line,start,end,cls}] }
 */
function prepare(lines, { diags = [], marks = [] } = {}) {
  const tokens = tokenize(lines);
  const fmtInfo = detectFormat(lines, 'auto');
  return lines.map((text, i) => {
    const n = text.length;
    const color = new Array(n).fill('#CCCCCC');
    const italic = new Array(n).fill(false);
    const bold = new Array(n).fill(false);
    const dim = new Array(n).fill(false);
    const sq = new Array(n).fill(0);
    const cls = new Array(n).fill('');
    const toks = tokens[i];
    toks.forEach((t, k) => {
      const end = k + 1 < toks.length ? toks[k + 1].start : n;
      for (let j = t.start; j < end; j++) {
        color[j] = t.color;
        italic[j] = t.italic;
        bold[j] = t.bold;
      }
    });
    if (text && fmtInfo.format !== 'free') {
      const { sequenceEnd, identStart } = fixedAreaRanges(text, 'shiftjis');
      for (let j = 0; j < sequenceEnd; j++) dim[j] = true;
      if (fmtInfo.format === 'fixed') for (let j = identStart; j < n; j++) dim[j] = true;
      if (!fmtInfo.debugging && isDebugLine(text))
        for (let j = sequenceEnd; j < n; j++) {
          dim[j] = true;
          italic[j] = true;
        }
    }
    for (const d of diags.filter((d) => d.line === i)) {
      const end = Math.max(d.end, d.start + 1);
      for (let j = d.start; j < Math.min(end, n); j++) sq[j] = Math.max(sq[j], SEV_RANK[d.severity]);
    }
    for (const m of marks.filter((m) => m.line === i)) for (let j = m.start; j < Math.min(m.end, n); j++) cls[j] = m.cls;
    return { text, color, italic, bold, dim, sq, cls };
  });
}

function lineHtml(L) {
  let html = '';
  let col = 0; // visual columns (for tabs)
  let i = 0;
  const key = (j) => [L.color[j], L.italic[j], L.bold[j], L.dim[j], L.sq[j], L.cls[j]].join('|');
  while (i < L.text.length) {
    const ch = L.text[i];
    if (ch === '\t' || ch === '　') {
      const style = spanStyle(L, i);
      if (ch === '\t') {
        const w = 4 - (col % 4);
        html += `<span ${style}><span class="ws">→</span>${' '.repeat(w - 1)}</span>`;
        col += w;
      } else {
        html += `<span ${style}><span class="ideo">　</span></span>`;
        col += 2;
      }
      i++;
      continue;
    }
    let j = i;
    let s = '';
    while (j < L.text.length && key(j) === key(i) && L.text[j] !== '\t' && L.text[j] !== '　') {
      s += L.text[j];
      col += L.text.charCodeAt(j) < 0x100 || (L.text.charCodeAt(j) >= 0xff61 && L.text.charCodeAt(j) <= 0xff9f) ? 1 : 2;
      j++;
    }
    html += `<span ${spanStyle(L, i)}>${esc(s)}</span>`;
    i = j;
  }
  return html;
}

function spanStyle(L, j) {
  const st = [`color:${L.color[j]}`];
  if (L.italic[j]) st.push('font-style:italic');
  if (L.bold[j]) st.push('font-weight:bold');
  if (L.dim[j]) st.push('opacity:.45');
  const cls = [];
  if (L.sq[j]) cls.push('sq' + L.sq[j]);
  if (L.cls[j]) cls.push(L.cls[j]);
  return `${cls.length ? `class="${cls.join(' ')}" ` : ''}style="${st.join(';')}"`;
}

/**
 * Editor body.
 * view: { doc (prepared), from, to (1-based inclusive), cursor?: {line, col}, rulers?, glyphs?: {line: html},
 *         zones?: {line: html (inserted after line)}, overlays?: {line: html (absolute, relative to row)}, width }
 */
function editor(view) {
  const rulers = view.rulers ?? [6, 7, 11, 72];
  const rulerHtml = rulers.map((c) => `<div class="ruler" style="left:${c * CH}px"></div>`).join('');
  let rows = '';
  for (let ln = view.from; ln <= view.to; ln++) {
    const L = view.doc[ln - 1];
    const cur = view.cursor && view.cursor.line === ln;
    const caret = cur ? `<div class="caret" style="left:${(view.cursor.col - 1) * CH}px"></div>` : '';
    rows += `<div class="row${cur ? ' cur' : ''}${view.rowClass?.[ln] ? ' ' + view.rowClass[ln] : ''}">
      <div class="glyph">${view.glyphs?.[ln] ?? ''}</div><div class="ln">${ln}</div><div class="fold">${view.folds?.[ln] ? icon('chevron-down') : ''}</div>
      <div class="code">${rulerHtml}<div class="txt">${lineHtml(L)}</div>${caret}</div>${view.overlays?.[ln] ?? ''}</div>`;
    if (view.zones?.[ln]) rows += view.zones[ln];
  }
  return `<div class="editor" style="width:${view.width}px">${rows}</div>`;
}

function tabs(list) {
  return `<div class="tabs">${list
    .map(
      (t) => `<div class="tab${t.active ? ' active' : ''}">${fileIcon()}<span>${esc(t.name)}</span>${t.badge ? `<span class="tbadge">${esc(t.badge)}</span>` : ''}${
        t.active ? icon('close', 'style="margin-left:6px;font-size:14px"') : ''
      }</div>`
    )
    .join('')}<div class="tabfill"></div></div>`;
}
const fileIcon = () => `<span class="fileicon">COB</span>`;

function breadcrumbs(parts) {
  return `<div class="crumbs">${parts
    .map((p, i) => `${i ? icon('chevron-right', 'class="sep"') : ''}${p.icon ? `<span class="sym" style="color:${p.color ?? '#ccc'}">${icon(p.icon)}</span>` : ''}<span>${esc(p.label)}</span>`)
    .join('')}</div>`;
}

function titleBar(title) {
  return `<div class="titlebar"><div class="tb-left">${icon('menu')}</div><div class="cc">${icon('arrow-left')}${icon('arrow-right')}<div class="ccbox">${icon('search')}<span>${esc(
    title
  )}</span></div></div><div class="tb-right"><span>${icon('chrome-minimize')}</span><span>${icon('chrome-maximize')}</span><span>${icon('chrome-close')}</span></div></div>`;
}

function activityBar(active = 'files') {
  const items = ['files', 'search', 'source-control', 'debug-alt', 'extensions'];
  return `<div class="activity">${items.map((n) => `<div class="act${n === active ? ' on' : ''}">${icon(n)}</div>`).join('')}<div style="flex:1"></div><div class="act">${icon(
    'account'
  )}</div><div class="act">${icon('settings-gear')}</div></div>`;
}

function statusBar(left, right) {
  return `<div class="status"><div class="st-remote">${icon('remote')}</div>${left.map((s) => `<span>${s}</span>`).join('')}<div style="flex:1"></div>${right
    .map((s) => `<span>${s}</span>`)
    .join('')}<span>${icon('bell')}</span></div>`;
}

const SYMBOL = {
  program: ['symbol-module', '#CCCCCC'],
  division: ['symbol-namespace', '#CCCCCC'],
  section: ['symbol-package', '#CCCCCC'],
  paragraph: ['symbol-method', '#B180D7'],
  file: ['symbol-file', '#CCCCCC'],
  copy: ['symbol-namespace', '#CCCCCC'],
  struct: ['symbol-structure', '#CCCCCC'],
  field: ['symbol-field', '#75BEFF'],
  variable: ['symbol-variable', '#75BEFF'],
  enumMember: ['symbol-enum-member', '#75BEFF']
};
function symbolOf(n) {
  if (n.kind === 'program') return SYMBOL.program;
  if (n.kind === 'copy') return ['symbol-object', '#EE9D28'];
  if (n.kind !== 'data') return SYMBOL[n.kind];
  if (n.level === 88) return SYMBOL.enumMember;
  if (n.level === 77 || n.level === 66) return SYMBOL.variable;
  return n.children.some((c) => c.level !== 88) ? SYMBOL.struct : SYMBOL.field;
}

function outlineTree(roots, { collapsed = [], selected } = {}) {
  let html = '';
  const walk = (n, depth) => {
    const open = n.children.length && !collapsed.includes(n.label);
    const twisty = n.children.length ? icon(open ? 'chevron-down' : 'chevron-right') : '';
    const [ic, color] = symbolOf(n);
    html += `<div class="trow${n.label === selected ? ' sel' : ''}" style="padding-left:${8 + depth * 8}px"><span class="twisty">${twisty}</span><span class="sym" style="color:${color}">${icon(
      ic
    )}</span><span class="tlabel">${esc(n.label)}</span>${n.detail && n.kind === 'data' ? `<span class="tdetail">${esc(n.detail)}</span>` : ''}</div>`;
    if (open) n.children.forEach((c) => walk(c, depth + 1));
  };
  roots.forEach((r) => walk(r, 0));
  return html;
}

// ------------------------------------------------------------------ page
function page(body, ui, extraCss = '') {
  return `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@vscode/codicons@0.0.36/dist/codicon.css">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=BIZ+UDGothic&display=block">
<style>
/* BIZ UDGothic draws ASCII quotes as curly ones; take straight quotes from Consolas scaled to the same 0.5em advance */
@font-face { font-family: "CodeQuotes"; src: local("Consolas"); unicode-range: U+0022, U+0027, U+0060; size-adjust: 90.91%; }
:root { --code: "CodeQuotes", "BIZ UDGothic", "BIZ UDゴシック", monospace; }
* { box-sizing: border-box; }
html, body { margin: 0; background: transparent; }
body { font-family: ${ui.font}; font-size: 13px; color: #CCCCCC; -webkit-font-smoothing: antialiased; }
#shot { display: inline-block; padding: 24px 28px 34px; }
.window { background: #1F1F1F; border: 1px solid #3c3c3c; border-radius: 10px; overflow: hidden;
  box-shadow: 0 18px 40px rgba(0,0,0,.35), 0 4px 12px rgba(0,0,0,.25); display: flex; flex-direction: column; }
.codicon { font-size: 16px; line-height: 1; vertical-align: middle; }
.titlebar { height: 34px; background: #181818; border-bottom: 1px solid #2B2B2B; display: flex; align-items: center; padding: 0 0 0 10px; color: #9D9D9D; }
.tb-left { width: 120px; } .tb-right { width: 140px; display: flex; justify-content: flex-end; }
.tb-right span { width: 46px; text-align: center; }
.cc { flex: 1; display: flex; align-items: center; justify-content: center; gap: 10px; }
.ccbox { width: 46%; max-width: 420px; height: 24px; border: 1px solid #3c3c3c; background: #222; border-radius: 6px; display: flex; align-items: center; justify-content: center; gap: 6px; font-size: 12px; color: #9D9D9D; }
.ccbox .codicon { font-size: 14px; }
.wb { display: flex; flex: 1; min-height: 0; }
.activity { width: 48px; background: #181818; border-right: 1px solid #2B2B2B; display: flex; flex-direction: column; align-items: center; padding-top: 4px; }
.act { width: 48px; height: 48px; display: flex; align-items: center; justify-content: center; color: #868686; border-left: 2px solid transparent; }
.act .codicon { font-size: 24px; }
.act.on { color: #D7D7D7; border-left-color: #0078D4; }
.sidebar { background: #181818; border-right: 1px solid #2B2B2B; display: flex; flex-direction: column; overflow: hidden; }
.sb-title { height: 35px; display: flex; align-items: center; padding: 0 12px 0 20px; font-size: 11px; color: #CCCCCC; letter-spacing: .02em; }
.sb-title .codicon { margin-left: auto; }
.sb-sec { height: 22px; display: flex; align-items: center; font-size: 11px; font-weight: 700; color: #CCCCCC; padding-left: 2px; border-top: 1px solid #2B2B2B; }
.sb-sec .codicon { margin-right: 2px; }
.trow { height: 22px; display: flex; align-items: center; white-space: nowrap; font-size: 13px; }
.trow.sel { background: #04395E; outline: 1px solid #0078D4; outline-offset: -1px; }
.twisty { width: 18px; display: inline-flex; justify-content: center; color: #C5C5C5; }
.sym { width: 18px; display: inline-flex; justify-content: center; margin-right: 4px; }
.tdetail { color: #9D9D9D; font-size: 12px; margin-left: 8px; opacity: .85; }
.main { flex: 1; display: flex; flex-direction: column; min-width: 0; }
.tabs { height: 35px; display: flex; background: #181818; }
.tab { display: flex; align-items: center; gap: 6px; padding: 0 10px 0 12px; color: #9D9D9D; border-right: 1px solid #2B2B2B; border-bottom: 1px solid #2B2B2B; }
.tab.active { background: #1F1F1F; color: #FFFFFF; border-top: 1px solid #0078D4; border-bottom-color: transparent; }
.tabfill { flex: 1; border-bottom: 1px solid #2B2B2B; }
.tbadge { font-size: 11px; padding: 1px 7px; border-radius: 9px; background: #2B2B2B; color: #CCCCCC; margin-left: 4px; }
.fileicon { font: 700 8px/1 "Segoe UI", sans-serif; color: #fff; background: #3A6EA5; border-radius: 3px; padding: 3px 3px 2px; letter-spacing: .02em; }
.crumbs { height: 22px; display: flex; align-items: center; padding-left: 14px; color: #A9A9A9; font-size: 12.5px; white-space: nowrap; overflow: hidden; }
.crumbs .sep { margin: 0 2px; font-size: 14px; }
.crumbs .sym { width: 18px; margin-right: 2px; }
.crumbs .sym .codicon { font-size: 14px; }
.editor { font-family: var(--code); font-size: 14px; line-height: ${LH}px; background: #1F1F1F; padding: 2px 0 6px; position: relative; flex: 1; }
.row { display: flex; height: ${LH}px; position: relative; }
.row.cur .code { outline: 1px solid #282828; outline-offset: -1px; }
.row.hl .code { background: rgba(38, 79, 120, .45); }
.glyph { width: 18px; flex: none; display: flex; align-items: center; justify-content: center; }
.glyph .codicon { color: #FFCC00; font-size: 15px; }
.ln { width: 40px; flex: none; text-align: right; color: #6E7681; font-size: 13px; }
.row.cur .ln { color: #CCCCCC; }
.fold { width: 18px; flex: none; color: #8B8B8B; display: flex; align-items: center; justify-content: center; }
.fold .codicon { font-size: 14px; }
.code { position: relative; flex: 1; white-space: pre; }
.txt { position: relative; z-index: 1; }
.ruler { position: absolute; top: 0; bottom: 0; width: 1px; background: #5A5A5A; opacity: .55; }
.caret { position: absolute; top: 1px; width: 2px; height: ${LH - 2}px; background: #AEAFAD; z-index: 2; }
${[1, 2, 3].map((n) => `.sq${n} { background: url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='6' height='3'><path d='M0 2.5 L1.5 0.5 L3 2.5 L4.5 0.5 L6 2.5' fill='none' stroke='${SEV_COLOR[n]}' stroke-width='1'/></svg>`)}") repeat-x left bottom 1px; display: inline-block; height: ${LH}px; vertical-align: top; }`).join(' ')}
.ws { color: #6E7681; opacity: .8; }
.ideo { outline: 1px solid #b89500; outline-offset: -2px; }
.def { background: rgba(255, 143, 0, .28); outline: 1px solid rgba(255,143,0,.6); }
.link { text-decoration: underline; text-underline-offset: 2px; color: #4daafc !important; cursor: pointer; }
.changed { background: rgba(46, 160, 67, .30); }
.panel { background: #181818; border-top: 1px solid #2B2B2B; display: flex; flex-direction: column; }
.ptabs { height: 35px; display: flex; align-items: center; gap: 22px; padding: 0 20px; font-size: 11px; color: #9D9D9D; letter-spacing: .03em; }
.ptabs .on { color: #E7E7E7; border-bottom: 1px solid #0078D4; padding: 7px 0 6px; }
.pbadge { display: inline-block; min-width: 18px; text-align: center; font-size: 10px; background: #616161; color: #fff; border-radius: 9px; padding: 1px 5px; margin-left: 5px; }
.prow { height: 22px; display: flex; align-items: center; white-space: nowrap; overflow: hidden; padding-left: 20px; font-size: 13px; }
.prow .codicon { margin-right: 6px; font-size: 15px; }
.prow .src { color: #9D9D9D; margin-left: 8px; }
.prow.sel { background: #04395E; outline: 1px solid #0078D4; outline-offset: -1px; }
.status { height: 24px; background: #181818; border-top: 1px solid #2B2B2B; display: flex; align-items: center; font-size: 12px; color: #CCCCCC; }
.status span { padding: 0 8px; display: inline-flex; align-items: center; gap: 4px; }
.status .codicon { font-size: 14px; }
.st-remote { width: 34px; height: 100%; background: #0078D4; color: #fff; display: flex; align-items: center; justify-content: center; margin-right: 4px; }
.hover { position: absolute; z-index: 10; background: #202020; border: 1px solid #454545; border-radius: 4px; box-shadow: 0 2px 8px rgba(0,0,0,.36);
  font-family: ${ui.font}; font-size: 13px; line-height: 1.45; white-space: normal; color: #CCCCCC; }
.hover .hb { padding: 6px 10px 8px; }
.hover .hsrc { color: #9D9D9D; }
.hover .hact { border-top: 1px solid #454545; background: #181818; padding: 3px 10px; font-size: 12.5px; color: #4daafc; display: flex; gap: 16px; border-radius: 0 0 4px 4px; }
.qf { position: absolute; z-index: 10; background: #202020; border: 1px solid #454545; border-radius: 6px; box-shadow: 0 2px 8px rgba(0,0,0,.36); padding: 4px;
  font-family: ${ui.font}; font-size: 13px; white-space: nowrap; }
.qf .qh { color: #9D9D9D; font-size: 12px; padding: 2px 8px 4px; }
.qf .qi { display: flex; align-items: center; gap: 6px; padding: 3px 10px 3px 6px; border-radius: 4px; background: #04395E; outline: 1px solid #0078D4; }
.qf .qi .codicon { color: #FFCC00; font-size: 15px; }
.peek { border-top: 2px solid #3794FF; border-bottom: 2px solid #3794FF; margin: 0; }
.peek .ph { height: 28px; background: #252526; display: flex; align-items: center; padding: 0 10px; gap: 8px; font-family: ${ui.font}; font-size: 13px; }
.peek .ph .dim { color: #9D9D9D; }
.peek .pb { display: flex; }
.peek .pe { flex: 1; background: #1A1A1A; }
.peek .pe .editor { background: #1A1A1A; }
.peek .pr { width: 230px; background: #1F1F1F; border-left: 1px solid #2B2B2B; font-family: ${ui.font}; font-size: 13px; padding-top: 2px; }
${extraCss}
</style></head><body><div id="shot">${body}</div></body></html>`;
}

// ------------------------------------------------------------------ scenes
const RULER_LABEL_CSS = `
.areas { position: relative; height: 62px; margin-left: ${GUTTER}px; font-family: var(--ui); }
.areas .band { position: absolute; top: 38px; height: 16px; border-radius: 2px; font: 10px/16px "Segoe UI", sans-serif; text-align: center; color: rgba(255,255,255,.85); }
.areas .name { position: absolute; font-size: 12px; white-space: nowrap; color: #E5E5E5; }
.areas .lead { position: absolute; width: 1px; background: #E8A35A; }
.areas .ticks { position: absolute; top: 56px; height: 6px; left: 0; }
.areas .tick { position: absolute; bottom: 0; width: 1px; background: #5A5A5A; height: 3px; }
.areas .tick.t5 { height: 5px; } .areas .tick.t10 { height: 6px; background: #8A8A8A; }
.pill { position: absolute; z-index: 5; top: 1px; height: 18px; display: flex; align-items: center; gap: 4px; padding: 0 9px 0 7px; border-radius: 9px;
  background: #E8A35A; color: #1F1F1F; font: 600 12px/18px var(--ui); white-space: nowrap; }
`;

function sceneColumns(ui) {
  const doc = prepare(SAMPLE);
  const x = (col) => (col - 1) * CH;
  const band = (from, to, color, label) =>
    `<div class="band" style="left:${x(from)}px;width:${(to - from + 1) * CH}px;background:${color}">${label}</div>`;
  let ticks = '';
  for (let c = 1; c <= 80; c++) ticks += `<div class="tick${c % 10 === 0 ? ' t10' : c % 5 === 0 ? ' t5' : ''}" style="left:${x(c) + CH - 1}px"></div>`;
  const areas = `<div class="areas">
    ${band(1, 6, '#4B4F57', '1–6')}${band(7, 7, '#E8A35A', '')}${band(8, 11, '#2F6FA8', '')}${band(12, 72, '#2E7D5B', '12 – 72')}${band(73, 80, '#4B4F57', '73–80')}
    <div class="name" style="right:calc(100% - ${x(7) - 3}px);top:19px">${esc(ui.seq)}</div>
    <div class="name" style="left:${x(7) + CH / 2 - 0.5}px;top:0;transform:translateX(-50%);color:#E8A35A">${esc(ui.ind)}</div>
    <div class="lead" style="left:${x(7) + CH / 2 - 0.5}px;top:17px;height:21px"></div>
    <div class="name" style="left:${x(8) + 2}px;top:19px;color:#7FB7E8">${esc(ui.a)}</div>
    <div class="name" style="left:${x(42)}px;top:19px;transform:translateX(-50%);color:#7BD3A8">${esc(ui.b)}</div>
    <div class="name" style="left:${x(77)}px;top:19px;transform:translateX(-50%)">${esc(ui.ident)}</div>
    <div class="ticks">${ticks}</div>
  </div>`;
  const overlays = {
    22: `<div class="pill" style="left:${GUTTER + x(50)}px">${icon('arrow-left', 'style="font-size:13px"')}${esc(ui.wide)}</div>`
  };
  const body = `<div class="window" style="--ui:${esc(ui.font)}">
    ${tabs([{ name: 'sample.cob', active: true }])}
    <div style="background:#1F1F1F;padding-top:10px">${areas}</div>
    ${editor({ doc, from: 17, to: 31, width: 760, overlays })}
  </div>`;
  return page(body, ui, RULER_LABEL_CSS);
}

function sceneHighlight(ui) {
  const doc = prepare(SAMPLE);
  const s = parseStructure(SAMPLE, 'shiftjis');
  const tree = outlineTree(s.roots, { collapsed: ['IDENTIFICATION DIVISION', 'ENVIRONMENT DIVISION'], selected: '開始処理' });
  const folds = {};
  const markFold = (n) => {
    if (n.endLine > n.startLine) folds[n.startLine + 1] = true;
    n.children.forEach(markFold);
  };
  s.roots.forEach(markFold);
  const from = 26;
  const to = 56;
  const body = `<div class="window">
    ${titleBar('samples')}
    <div class="wb">
      ${activityBar('files')}
      <div class="sidebar" style="width:300px">
        <div class="sb-title">${esc(ui.explorer.toUpperCase())}${icon('ellipsis')}</div>
        <div class="sb-sec">${icon('chevron-right')}SAMPLES</div>
        <div class="sb-sec">${icon('chevron-down')}${esc(ui.outline.toUpperCase())}</div>
        <div style="flex:1">${tree}</div>
        <div class="sb-sec">${icon('chevron-right')}${esc(ui.timeline.toUpperCase())}</div>
      </div>
      <div class="main">
        ${tabs([{ name: 'sample.cob', active: true }, { name: 'KYOTUREC.cpy' }])}
        ${breadcrumbs([
          { label: 'samples' },
          { label: 'sample.cob' },
          { label: 'URIAGE01', icon: 'symbol-module' },
          { label: 'PROCEDURE DIVISION', icon: 'symbol-namespace' },
          { label: 'MAIN-PROC SECTION', icon: 'symbol-package' },
          { label: '開始処理', icon: 'symbol-method', color: '#B180D7' }
        ])}
        ${editor({ doc, from, to, width: 790, cursor: { line: 34, col: 13 }, folds })}
      </div>
    </div>
    ${statusBar([`${icon('error')} 0`, `${icon('warning')} 0`], [ui.lnCol(34, 13), ui.spaces, 'Shift JIS', 'CRLF', `${icon('bracket')} NetCOBOL`])}
  </div>`;
  return page(body, ui);
}

function diagnosticsOf(lines) {
  return analyze(lines, { mode: 'shiftjis', maxLineLength: 80 });
}

function sceneDiagnostics(ui) {
  const raw = diagnosticsOf(ERRORS);
  const doc = prepare(ERRORS, { diags: raw });
  const sorted = raw.slice().sort((a, b) => SEV_RANK[b.severity] - SEV_RANK[a.severity] || a.line - b.line || a.start - b.start);
  const sevIcon = { error: ['error', '#F14C4C'], warning: ['warning', '#CCA700'], info: ['info', '#3794FF'] };
  const target = raw.find((d) => d.code === 'NC002');
  const rows = sorted
    .slice(0, 9)
    .map(
      (d) =>
        `<div class="prow${d === target ? ' sel' : ''}" style="padding-left:36px">${icon(sevIcon[d.severity][0], `style="color:${sevIcon[d.severity][1]}"`)}<span>${esc(
          message(d.code, d.args)
        )}</span><span class="src">NetCOBOL(${d.code}) ${ui.at(d.line + 1, d.start + 1)}</span></div>`
    )
    .join('');
  const counts = raw.length;
  const hover = `<div class="hover" style="left:${GUTTER + 30 * CH}px;top:${LH}px;width:470px">
      <div class="hb">${esc(message(target.code, target.args))} <span class="hsrc">NetCOBOL(${target.code})</span></div>
      <div class="hact"><span>${esc(ui.viewProblem)}</span><span>${esc(ui.quickFixLink)}</span></div></div>`;
  const nErr = raw.filter((d) => d.severity === 'error').length;
  const nWarn = raw.filter((d) => d.severity === 'warning').length;
  const body = `<div class="window">
    ${titleBar('samples')}
    <div class="wb">
      ${activityBar('files')}
      <div class="main">
        ${tabs([{ name: 'errors.cob', active: true }])}
        ${breadcrumbs([{ label: 'samples' }, { label: 'errors.cob' }, { label: 'ERRSAMP', icon: 'symbol-module' }])}
        ${editor({ doc, from: 1, to: ERRORS.length, width: 900, overlays: { [target.line + 1]: hover }, cursor: { line: target.line + 1, col: 72 } })}
        <div class="panel">
          <div class="ptabs"><span class="on">${esc(ui.problems.toUpperCase())}<span class="pbadge">${counts}</span></span><span>${esc(ui.output.toUpperCase())}</span><span>${esc(
            ui.debugConsole.toUpperCase()
          )}</span><span>${esc(ui.terminal.toUpperCase())}</span><span>${esc(ui.ports.toUpperCase())}</span></div>
          <div class="prow">${icon('chevron-down')}${fileIcon()}<span style="margin-left:6px">errors.cob</span><span class="src">samples</span><span class="pbadge">${counts}</span></div>
          ${rows}
          <div style="height:6px"></div>
        </div>
      </div>
    </div>
    ${statusBar([`${icon('error')} ${nErr}`, `${icon('warning')} ${nWarn}`, `${icon('info')} ${raw.length - nErr - nWarn}`], [ui.lnCol(target.line + 1, 72), ui.spaces, 'Shift JIS', 'CRLF', `${icon('bracket')} NetCOBOL`])}
  </div>`;
  return page(body, ui);
}

function sceneRenumber(ui, nlsJson) {
  const before = RENUMBER_SRC;
  const raw = diagnosticsOf(before);
  const res = renumber(before, 'shiftjis', 0, before.length - 1, 10, 10);
  const after = before.slice();
  for (const e of res.edits) after[e.line] = e.newText + after[e.line].slice(e.end);
  const marks = res.edits.map((e) => ({ line: e.line, start: 0, end: 6, cls: 'changed' }));
  const W = 520;
  const firstIssue = raw[0].line + 1;
  const qf = `<div class="qf" style="left:${GUTTER + 24 * CH}px;top:${LH + 2}px"><div class="qh">${esc(ui.quickFix)}</div><div class="qi">${icon('lightbulb')}${esc(
    message === undefined ? '' : vscodeStub.l10n.t('Renumber the sequence area of the whole file')
  )}</div></div>`;
  const left = `<div class="window" style="flex:none">
    ${tabs([{ name: 'sample.cob', active: true, badge: ui.before }])}
    ${editor({ doc: prepare(before, { diags: raw }), from: 1, to: before.length, width: W, glyphs: { [firstIssue]: icon('lightbulb') }, overlays: { [firstIssue]: qf }, cursor: { line: firstIssue, col: 1 } })}
    ${statusBar([`${icon('error')} 0`, `${icon('warning')} 0`, `${icon('info')} ${raw.length}`], ['Shift JIS', 'NetCOBOL'])}
  </div>`;
  const msg = vscodeStub.l10n.t('Renumbered {0} lines ({1}-{2}).', res.edits.length, formatSeq(res.first), formatSeq(res.last));
  const right = `<div class="window" style="flex:none">
    ${tabs([{ name: 'sample.cob', active: true, badge: ui.after }])}
    ${editor({ doc: prepare(after, { marks }), from: 1, to: after.length, width: W })}
    ${statusBar([`${icon('check')} ${esc(msg)}`], ['Shift JIS', 'NetCOBOL'])}
  </div>`;
  const cmd = nlsJson['cmd.renumberSequence'];
  const body = `<div style="display:flex;align-items:center;gap:0">${left}
    <div style="width:64px;display:flex;flex-direction:column;align-items:center;gap:6px;color:#8A8A8A">${icon('arrow-right', 'style="font-size:30px;color:#9D9D9D"')}</div>
    ${right}</div>
    <div style="margin-top:14px;text-align:center;font-size:13px;color:#8A8A8A">NetCOBOL: ${esc(cmd)} &nbsp;·&nbsp; Ctrl+.</div>`;
  return page(body, ui);
}

function sceneDefinition(ui) {
  const at = SAMPLE.findIndex((l) => l.includes(':WS-CNT'));
  const start = SAMPLE[at].indexOf('WS-CNT');
  const doc = prepare(SAMPLE, { marks: [{ line: at, start, end: start + 6, cls: 'def' }] });
  const defLine = COPYBOOK.findIndex((l) => / WS-CNT /.test(l));
  const ds = COPYBOOK[defLine].indexOf('WS-CNT');
  const cdoc = prepare(COPYBOOK, { marks: [{ line: defLine, start: ds, end: ds + 6, cls: 'def' }] });
  const peekEditor = editor({ doc: cdoc, from: 1, to: COPYBOOK.length, width: 700, rowClass: { [defLine + 1]: 'hl' } });
  const peek = `<div class="peek">
    <div class="ph">${fileIcon()}<span>KYOTUREC.cpy</span><span class="dim">samples</span><span style="margin-left:auto" class="dim">${esc(ui.definitions)}</span>${icon('close')}</div>
    <div class="pb"><div class="pe">${peekEditor}</div><div class="pr">
      <div class="trow" style="padding-left:6px">${icon('chevron-down')}${fileIcon()}<span style="margin-left:6px">KYOTUREC.cpy</span><span class="tdetail">samples</span></div>
      <div class="trow sel" style="padding-left:36px;font-family:var(--code);font-size:12.5px">${esc(COPYBOOK[defLine].slice(7).trim())}</div>
    </div></div></div>`;
  const body = `<div class="window">
    ${titleBar('samples')}
    <div class="wb">
      ${activityBar('files')}
      <div class="main">
        ${tabs([{ name: 'sample.cob', active: true }])}
        ${breadcrumbs([{ label: 'samples' }, { label: 'sample.cob' }, { label: 'URIAGE01', icon: 'symbol-module' }, { label: 'PROCEDURE DIVISION', icon: 'symbol-namespace' }, { label: 'MAIN-PROC SECTION', icon: 'symbol-package' }, { label: '開始処理', icon: 'symbol-method', color: '#B180D7' }])}
        ${editor({ doc, from: at - 4, to: at + 5, width: 950, cursor: { line: at + 1, col: start + 4 }, zones: { [at + 1]: peek } })}
      </div>
    </div>
    ${statusBar([`${icon('error')} 0`, `${icon('warning')} 0`], [ui.lnCol(at + 1, start + 4), ui.spaces, 'Shift JIS', 'CRLF', `${icon('bracket')} NetCOBOL`])}
  </div>`;
  return page(body, ui);
}

const SCENES = {
  columns: sceneColumns,
  highlight: sceneHighlight,
  diagnostics: sceneDiagnostics,
  renumber: sceneRenumber,
  definition: sceneDefinition
};

// ------------------------------------------------------------------ main
(async () => {
  const langs = process.argv.slice(2).filter((a) => LANGS.includes(a));
  await loadGrammar();
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'netcobol-html-'));
  const browser = await launch();
  try {
    for (const lang of langs.length ? langs : LANGS) {
      bundle = loadBundle(lang);
      const ui = UI[lang];
      const dir = path.join(root, 'images', lang);
      fs.mkdirSync(dir, { recursive: true });
      for (const [name, fn] of Object.entries(SCENES)) {
        const html = path.join(tmp, `${lang}-${name}.html`);
        fs.writeFileSync(html, fn(ui, nls(lang)));
        const png = path.join(dir, `${name}.png`);
        await browser.screenshot(html, png);
        console.log('  ' + path.relative(root, png));
      }
    }
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
