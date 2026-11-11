import * as vscode from 'vscode';
import { ColumnMode, INDICATOR_COL, LineColumns, fixedAreaRanges } from './core/columns';
import { RawDiagnostic, RuleCode, analyze } from './core/diagnostics';
import { SEQ_MAX, formatSeq, numberAfterPrevious, renumber } from './core/sequence';
import { registerLanguageFeatures } from './features';

const LANG = 'netcobol';
const DEBOUNCE_MS = 250;

let collection: vscode.DiagnosticCollection;
let dimDecoration: vscode.TextEditorDecorationType;
const timers = new Map<string, NodeJS.Timeout>();

export function activate(context: vscode.ExtensionContext): void {
  collection = vscode.languages.createDiagnosticCollection(LANG);
  dimDecoration = vscode.window.createTextEditorDecorationType({ opacity: '0.45' });
  context.subscriptions.push(collection, dimDecoration);

  context.subscriptions.push(
    vscode.workspace.onDidOpenTextDocument((d) => refresh(d)),
    vscode.workspace.onDidChangeTextDocument((e) => schedule(e.document)),
    vscode.workspace.onDidCloseTextDocument((d) => {
      collection.delete(d.uri);
      const t = timers.get(d.uri.toString());
      if (t) clearTimeout(t);
      timers.delete(d.uri.toString());
    }),
    vscode.window.onDidChangeVisibleTextEditors(() => vscode.window.visibleTextEditors.forEach(decorate)),
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration('netcobol')) refreshAll();
    }),
    vscode.commands.registerTextEditorCommand('netcobol.toggleLineComment', toggleLineComment),
    vscode.commands.registerTextEditorCommand('netcobol.renumberSequence', renumberSequence),
    vscode.languages.registerCodeActionsProvider(LANG, new SequenceQuickFix(), {
      providedCodeActionKinds: [vscode.CodeActionKind.QuickFix]
    })
  );

  registerLanguageFeatures(context);
  refreshAll();
}

export function deactivate(): void {
  timers.forEach((t) => clearTimeout(t));
  timers.clear();
}

// ------------------------------------------------------------------ settings
function settings(doc: vscode.TextDocument) {
  const cfg = vscode.workspace.getConfiguration('netcobol', doc.uri);
  return {
    mode: cfg.get<ColumnMode>('columnCounting', 'shiftjis'),
    enabled: cfg.get<boolean>('diagnostics.enabled', true),
    maxLineLength: cfg.get<number>('diagnostics.maxLineLength', 80),
    disabledRules: cfg.get<string[]>('diagnostics.disabledRules', []),
    dim: cfg.get<boolean>('dimFixedAreas', true),
    seqStart: cfg.get<number>('sequence.start', 10),
    seqStep: Math.max(1, cfg.get<number>('sequence.step', 10))
  };
}

// ------------------------------------------------------------------ refresh
function refreshAll(): void {
  vscode.workspace.textDocuments.forEach(refresh);
}

function schedule(doc: vscode.TextDocument): void {
  if (doc.languageId !== LANG) return;
  const key = doc.uri.toString();
  const old = timers.get(key);
  if (old) clearTimeout(old);
  timers.set(
    key,
    setTimeout(() => {
      timers.delete(key);
      refresh(doc);
    }, DEBOUNCE_MS)
  );
}

function refresh(doc: vscode.TextDocument): void {
  if (doc.languageId !== LANG) {
    collection.delete(doc.uri);
    return;
  }
  const s = settings(doc);
  if (!s.enabled) {
    collection.delete(doc.uri);
  } else {
    const lines: string[] = [];
    for (let i = 0; i < doc.lineCount; i++) lines.push(doc.lineAt(i).text);
    const raw = analyze(lines, { mode: s.mode, maxLineLength: s.maxLineLength, disabledRules: s.disabledRules });
    collection.set(doc.uri, raw.map(toDiagnostic));
  }
  vscode.window.visibleTextEditors.filter((e) => e.document === doc).forEach(decorate);
}

function toDiagnostic(r: RawDiagnostic): vscode.Diagnostic {
  const range = new vscode.Range(r.line, r.start, r.line, r.end);
  const sev =
    r.severity === 'error'
      ? vscode.DiagnosticSeverity.Error
      : r.severity === 'warning'
        ? vscode.DiagnosticSeverity.Warning
        : vscode.DiagnosticSeverity.Information;
  const d = new vscode.Diagnostic(range, message(r.code, r.args), sev);
  d.source = 'NetCOBOL';
  d.code = r.code;
  return d;
}

function message(code: RuleCode, a: string[]): string {
  switch (code) {
    case 'NC001':
      return vscode.l10n.t('Invalid character "{0}" in the indicator area (column 7). Use space, *, /, - or D.', a[0]);
    case 'NC002':
      return vscode.l10n.t('Full-width character "{0}" straddles columns {1} and {2}.', a[0], a[1], a[2]);
    case 'NC003':
      return vscode.l10n.t('Text continues past column 72. Columns 73 and later are the identification area and are ignored by the compiler.');
    case 'NC004':
      return vscode.l10n.t('Line is {1} columns long (limit {0}).', a[0], a[1]);
    case 'NC005':
      return vscode.l10n.t('"{0}" must start in area A (columns 8-11).', a[0]);
    case 'NC006':
      return vscode.l10n.t('Statement "{0}" starts in area A. Procedure statements belong in area B (column 12 or later).', a[0]);
    case 'NC007':
      return vscode.l10n.t('Literal is not closed before column 72 and the next line is not a continuation line ("-" in column 7).');
    case 'NC008':
      return vscode.l10n.t('A continued literal must resume with a quotation mark ({0}) in area B.', a[0]);
    case 'NC009':
      return vscode.l10n.t('Full-width space (U+3000) outside a literal or comment.');
    case 'NC010':
      return vscode.l10n.t('Tab character: column positions may not match what the compiler sees.');
    case 'NC011':
      return vscode.l10n.t('Area A (columns 8-11) of a continuation line must be blank.');
    case 'NC012':
      return a[0] === '1'
        ? vscode.l10n.t('Sequence area (columns 1-6) is blank.')
        : vscode.l10n.t('Sequence area (columns 1-6) is blank on {0} lines (lines {1}-{2}).', a[0], a[1], a[2]);
    case 'NC013':
      return vscode.l10n.t('Sequence area "{0}" is not a 6-digit number.', a[0]);
    case 'NC014':
      return vscode.l10n.t('Sequence number {0} is not greater than the previous number {1}.', a[0], a[1]);
  }
}

// ------------------------------------------------------------------ dimming
function decorate(editor: vscode.TextEditor): void {
  const doc = editor.document;
  if (doc.languageId !== LANG) return;
  const s = settings(doc);
  if (!s.dim) {
    editor.setDecorations(dimDecoration, []);
    return;
  }
  const ranges: vscode.Range[] = [];
  for (let i = 0; i < doc.lineCount; i++) {
    const text = doc.lineAt(i).text;
    if (!text) continue;
    const { sequenceEnd, identStart } = fixedAreaRanges(text, s.mode);
    if (sequenceEnd > 0) ranges.push(new vscode.Range(i, 0, i, sequenceEnd));
    if (identStart < text.length) ranges.push(new vscode.Range(i, identStart, i, text.length));
  }
  editor.setDecorations(dimDecoration, ranges);
}

// ------------------------------------------------------------------ comment toggle (column 7)
function toggleLineComment(editor: vscode.TextEditor, edit: vscode.TextEditorEdit): void {
  const doc = editor.document;
  const mode = settings(doc).mode;
  const lineSet = new Set<number>();
  for (const sel of editor.selections) {
    let last = sel.end.line;
    if (sel.end.line > sel.start.line && sel.end.character === 0) last--;
    for (let l = sel.start.line; l <= last; l++) lineSet.add(l);
  }
  const lines = [...lineSet].filter((l) => doc.lineAt(l).text.trim() !== '');
  if (lines.length === 0) return;

  const indicatorOf = (l: number) => {
    const lc = new LineColumns(doc.lineAt(l).text, mode);
    return { lc, cell: lc.cellAtCol(INDICATOR_COL) };
  };
  const allCommented = lines.every((l) => {
    const c = indicatorOf(l).cell;
    return !!c && c.col === INDICATOR_COL && (c.ch === '*' || c.ch === '/');
  });

  for (const l of lines) {
    const { lc, cell } = indicatorOf(l);
    if (allCommented) {
      if (cell) edit.replace(new vscode.Range(l, cell.start, l, cell.end), ' ');
      continue;
    }
    if (!cell) {
      // line shorter than 7 columns: pad to column 6 and add '*'
      edit.insert(new vscode.Position(l, lc.text.length), ' '.repeat(Math.max(0, 6 - lc.totalWidth)) + '*');
    } else if (cell.col === INDICATOR_COL && cell.width === 1) {
      edit.replace(new vscode.Range(l, cell.start, l, cell.end), '*');
    }
  }
}

// ------------------------------------------------------------------ sequence area (columns 1-6)
const SEQ_CODES = new Set(['NC012', 'NC013', 'NC014']);

class SequenceQuickFix implements vscode.CodeActionProvider {
  provideCodeActions(_doc: vscode.TextDocument, _range: vscode.Range, ctx: vscode.CodeActionContext): vscode.CodeAction[] {
    const diags = ctx.diagnostics.filter((d) => d.source === 'NetCOBOL' && SEQ_CODES.has(String(d.code)));
    if (diags.length === 0) return [];
    const action = new vscode.CodeAction(vscode.l10n.t('Renumber the sequence area of the whole file'), vscode.CodeActionKind.QuickFix);
    action.diagnostics = diags;
    action.isPreferred = true;
    action.command = { command: 'netcobol.renumberSequence', title: action.title, arguments: [{ whole: true }] };
    return [action];
  }
}

/**
 * Renumber columns 1-6. Whole file when nothing is selected (or when called with {whole: true});
 * otherwise only the selected lines, continuing from the nearest number above each selection.
 */
function renumberSequence(editor: vscode.TextEditor, edit: vscode.TextEditorEdit, ...args: unknown[]): void {
  const doc = editor.document;
  const s = settings(doc);
  const lines: string[] = [];
  for (let i = 0; i < doc.lineCount; i++) lines.push(doc.lineAt(i).text);

  const whole = args.some((a) => !!a && typeof a === 'object' && (a as { whole?: boolean }).whole === true);
  const blocks: [number, number][] = [];
  if (!whole) {
    for (const sel of editor.selections) {
      if (sel.isEmpty) continue;
      let last = sel.end.line;
      if (sel.end.line > sel.start.line && sel.end.character === 0) last--;
      blocks.push([sel.start.line, last]);
    }
  }
  const partial = blocks.length > 0;
  if (!partial) blocks.push([0, lines.length - 1]);
  blocks.sort((x, y) => x[0] - y[0]);

  const work = [...lines]; // reflects earlier blocks so later blocks continue correctly
  const edits: { line: number; start: number; end: number; newText: string }[] = [];
  const skipped: number[] = [];
  let first: number | undefined;
  let last: number | undefined;
  for (const [from, to] of blocks) {
    const startNo = partial ? numberAfterPrevious(work, s.mode, from, s.seqStart, s.seqStep) : s.seqStart;
    const r = renumber(work, s.mode, from, to, startNo, s.seqStep);
    if (r.overflow) {
      vscode.window.showErrorMessage(
        vscode.l10n.t('Sequence numbers would exceed {0}. Use a smaller start or step (netcobol.sequence.start / netcobol.sequence.step).', formatSeq(SEQ_MAX))
      );
      return;
    }
    for (const e of r.edits) {
      work[e.line] = e.newText + work[e.line].slice(e.end);
      edits.push(e);
    }
    skipped.push(...r.skipped);
    if (r.first !== undefined && first === undefined) first = r.first;
    if (r.last !== undefined) last = r.last;
  }

  for (const e of edits) edit.replace(new vscode.Range(e.line, e.start, e.line, e.end), e.newText);

  if (edits.length === 0) {
    vscode.window.setStatusBarMessage(vscode.l10n.t('Sequence area is already in order.'), 4000);
  } else {
    vscode.window.setStatusBarMessage(
      vscode.l10n.t('Renumbered {0} lines ({1}-{2}).', edits.length, formatSeq(first ?? 0), formatSeq(last ?? 0)),
      4000
    );
  }
  if (skipped.length > 0) {
    vscode.window.showWarningMessage(
      vscode.l10n.t('{0} line(s) skipped because a full-width character straddles columns 6 and 7: line {1}', skipped.length, skipped.map((l) => l + 1).join(', '))
    );
  }
}
