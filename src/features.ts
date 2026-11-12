/**
 * Outline, folding, go to definition (incl. COPY → copybook) and data item sizes.
 */
import * as path from 'path';
import * as vscode from 'vscode';
import { ColumnMode } from './core/columns';
import { DEFAULT_COPY_EXTENSIONS, matchDir, matchEntry } from './core/copybook';
import { FormatSetting, detectFormat } from './core/format';
import { DEFAULT_SIZE_OPTIONS, SizeRow, layout } from './core/datasize';
import { CopyRef, Span, StructNode, Structure, copyAt, namesBeforeReplacing, parseStructure, qualify } from './core/structure';
import { WORD, WORD_RE } from './core/words';

const LANG = 'netcobol';
const MAX_COPY_DEPTH = 3;
const LISTING_TTL_MS = 3000;
const QUALIFIER_RE = new RegExp(`^\\s+(?:OF|IN)\\s+(${WORD})`, 'i');

// ------------------------------------------------------------------ structure cache
const cache = new Map<string, { version: number; mode: ColumnMode; format: FormatSetting; s: Structure }>();

function modeOf(doc: vscode.TextDocument): ColumnMode {
  return vscode.workspace.getConfiguration('netcobol', doc.uri).get<ColumnMode>('columnCounting', 'shiftjis');
}

export function structureOf(doc: vscode.TextDocument): Structure {
  const key = doc.uri.toString();
  const mode = modeOf(doc);
  const format = vscode.workspace.getConfiguration('netcobol', doc.uri).get<FormatSetting>('sourceFormat', 'auto');
  const hit = cache.get(key);
  if (hit && hit.version === doc.version && hit.mode === mode && hit.format === format) return hit.s;
  const lines: string[] = [];
  for (let i = 0; i < doc.lineCount; i++) lines.push(doc.lineAt(i).text);
  const s = parseStructure(lines, mode, detectFormat(lines, format));
  cache.set(key, { version: doc.version, mode, format, s });
  return s;
}

const toRange = (sp: Span) => new vscode.Range(sp.line, sp.start, sp.line, sp.end);

// ------------------------------------------------------------------ outline
function symbolKind(n: StructNode): vscode.SymbolKind {
  switch (n.kind) {
    case 'program':
      return n.detail === 'CLASS' ? vscode.SymbolKind.Class : n.detail === 'METHOD' ? vscode.SymbolKind.Method : vscode.SymbolKind.Module;
    case 'division':
      return vscode.SymbolKind.Namespace;
    case 'section':
      return vscode.SymbolKind.Package;
    case 'paragraph':
      return vscode.SymbolKind.Function;
    case 'file':
      return vscode.SymbolKind.File;
    case 'copy':
      return vscode.SymbolKind.Object;
    case 'data':
      if (n.level === 88) return vscode.SymbolKind.EnumMember;
      if (n.level === 77 || n.level === 66) return vscode.SymbolKind.Variable;
      return n.children.some((c) => c.level !== 88) ? vscode.SymbolKind.Struct : vscode.SymbolKind.Field;
  }
}

class OutlineProvider implements vscode.DocumentSymbolProvider {
  provideDocumentSymbols(doc: vscode.TextDocument): vscode.DocumentSymbol[] {
    const conv = (n: StructNode): vscode.DocumentSymbol => {
      const end = Math.min(n.endLine, doc.lineCount - 1);
      const range = new vscode.Range(n.startLine, 0, end, doc.lineAt(end).text.length);
      let sel = toRange(n.nameSpan);
      if (!range.contains(sel)) sel = new vscode.Range(n.startLine, 0, n.startLine, 0);
      const sym = new vscode.DocumentSymbol(n.label, n.kind === 'program' ? '' : n.detail ?? '', symbolKind(n), range, sel);
      sym.children = n.children.map(conv);
      return sym;
    };
    return structureOf(doc).roots.map(conv);
  }
}

// ------------------------------------------------------------------ folding
class FoldingProvider implements vscode.FoldingRangeProvider {
  provideFoldingRanges(doc: vscode.TextDocument): vscode.FoldingRange[] {
    return structureOf(doc).folds.map(
      (f) => new vscode.FoldingRange(f.start, f.end, f.kind === 'comment' ? vscode.FoldingRangeKind.Comment : vscode.FoldingRangeKind.Region)
    );
  }
}

// ------------------------------------------------------------------ copybooks
const listings = new Map<string, { at: number; entries: [string, vscode.FileType][] }>();

async function list(dir: vscode.Uri): Promise<[string, vscode.FileType][]> {
  const key = dir.toString();
  const hit = listings.get(key);
  if (hit && Date.now() - hit.at < LISTING_TTL_MS) return hit.entries;
  let entries: [string, vscode.FileType][] = [];
  try {
    entries = await vscode.workspace.fs.readDirectory(dir);
  } catch {
    // missing directory: treat as empty
  }
  listings.set(key, { at: Date.now(), entries });
  return entries;
}

function searchDirs(doc: vscode.TextDocument): vscode.Uri[] {
  const dirs: vscode.Uri[] = [];
  if (doc.uri.scheme !== 'untitled') dirs.push(vscode.Uri.joinPath(doc.uri, '..'));
  const cfg = vscode.workspace.getConfiguration('netcobol', doc.uri);
  const wf = vscode.workspace.getWorkspaceFolder(doc.uri) ?? vscode.workspace.workspaceFolders?.[0];
  for (const raw of cfg.get<string[]>('copybook.paths', [])) {
    const p = raw.replace(/\$\{workspaceFolder\}/g, wf?.uri.fsPath ?? '');
    if (path.isAbsolute(p)) dirs.push(vscode.Uri.file(p));
    else if (wf) dirs.push(vscode.Uri.joinPath(wf.uri, p));
  }
  return dirs;
}

export async function resolveCopy(doc: vscode.TextDocument, ref: CopyRef): Promise<vscode.Uri | undefined> {
  const exts = vscode.workspace.getConfiguration('netcobol', doc.uri).get<string[]>('copybook.extensions', DEFAULT_COPY_EXTENSIONS);
  const isFile = (t: vscode.FileType) => (t & vscode.FileType.File) !== 0;
  const isDir = (t: vscode.FileType) => (t & vscode.FileType.Directory) !== 0;

  for (const dir of searchDirs(doc)) {
    // COPY "sub/name.cbl": relative path as written
    if (ref.quoted && /[\\/.]/.test(ref.name)) {
      const direct = vscode.Uri.joinPath(dir, ref.name.replace(/\\/g, '/'));
      try {
        if (isFile((await vscode.workspace.fs.stat(direct)).type)) return direct;
      } catch {
        // not there
      }
    }
    const entries = await list(dir);
    if (ref.lib) {
      const sub = matchDir(entries.filter(([, t]) => isDir(t)).map(([n]) => n), ref.lib);
      if (sub) {
        const subDir = vscode.Uri.joinPath(dir, sub);
        const hit = matchEntry((await list(subDir)).filter(([, t]) => isFile(t)).map(([n]) => n), ref.name, exts);
        if (hit) return vscode.Uri.joinPath(subDir, hit);
      }
    }
    const hit = matchEntry(entries.filter(([, t]) => isFile(t)).map(([n]) => n), ref.name, exts);
    if (hit) return vscode.Uri.joinPath(dir, hit);
  }
  return undefined;
}

// ------------------------------------------------------------------ go to definition
class DefinitionProvider implements vscode.DefinitionProvider {
  async provideDefinition(doc: vscode.TextDocument, pos: vscode.Position, token: vscode.CancellationToken) {
    const s = structureOf(doc);

    const copy = copyAt(s, pos.line, pos.character);
    if (copy) {
      const uri = await resolveCopy(doc, copy);
      return uri ? new vscode.Location(uri, new vscode.Position(0, 0)) : undefined;
    }

    const wordRange = doc.getWordRangeAtPosition(pos, WORD_RE);
    if (!wordRange) return undefined;
    const key = doc.getText(wordRange).toUpperCase();

    // qualification: WORD OF/IN GROUP [OF/IN ...]
    const qualifiers: string[] = [];
    let after = doc.lineAt(pos.line).text.slice(wordRange.end.character);
    for (let m = QUALIFIER_RE.exec(after); m; m = QUALIFIER_RE.exec(after)) {
      qualifiers.push(m[1].toUpperCase());
      after = after.slice(m[0].length);
    }

    const local = s.definitions.get(key);
    if (local?.length) return qualify(local, qualifiers).map((n) => new vscode.Location(doc.uri, toRange(n.nameSpan)));

    // not defined here: look through the copybooks this source includes
    const found: vscode.Location[] = [];
    const visited = new Set<string>([doc.uri.toString()]);
    const walk = async (d: vscode.TextDocument, st: Structure, depth: number, keys?: string[]): Promise<void> => {
      for (const ref of st.copies) {
        // names as they appear inside the copybook, undoing COPY ... REPLACING
        const names = keys ?? namesBeforeReplacing(key, ref.replacing);
        if (token.isCancellationRequested) return;
        const uri = await resolveCopy(d, ref);
        if (!uri || visited.has(uri.toString())) continue;
        visited.add(uri.toString());
        let cd: vscode.TextDocument;
        try {
          cd = await vscode.workspace.openTextDocument(uri);
        } catch {
          continue;
        }
        const cs = structureOf(cd);
        for (const name of names) {
          for (const n of cs.definitions.get(name) ?? []) found.push(new vscode.Location(uri, toRange(n.nameSpan)));
        }
        if (depth + 1 < MAX_COPY_DEPTH) await walk(cd, cs, depth + 1, names);
      }
    };
    await walk(doc, s, 0);
    return found;
  }
}

// ------------------------------------------------------------------ data item sizes
const SHOW_LAYOUT = 'netcobol.showDataLayout';

/** Data items that occupy storage (not 88 condition names or 66 RENAMES). */
const isStorageItem = (n: StructNode): boolean => n.kind === 'data' && n.level !== 88 && n.level !== 66;

/** The innermost storage item whose lines include `line`. */
function dataNodeAtLine(s: Structure, line: number): StructNode | undefined {
  let best: StructNode | undefined;
  const walk = (list: StructNode[]) => {
    for (const n of list) {
      if (n.startLine <= line && line <= n.endLine) {
        if (isStorageItem(n)) best = n;
        walk(n.children);
      }
    }
  };
  walk(s.roots);
  return best;
}

function sizeText(rows: SizeRow[]): string {
  const top = rows[0];
  if (top.bytes === undefined) {
    return vscode.l10n.t('size not computed: {0}', top.reason ?? '');
  }
  const bytes = vscode.l10n.t('{0} bytes', top.bytes);
  return top.occurs > 1 ? `${bytes} (${vscode.l10n.t('{0} bytes × {1} occurrences', top.unit ?? 0, top.occurs)})` : bytes;
}

class SizeHoverProvider implements vscode.HoverProvider {
  provideHover(doc: vscode.TextDocument, pos: vscode.Position): vscode.Hover | undefined {
    const s = structureOf(doc);
    // the name (or level number of a FILLER) in a definition, or a reference with exactly one definition
    let node: StructNode | undefined;
    let range: vscode.Range | undefined;
    const own = dataNodeAtLine(s, pos.line);
    if (own && own.startLine === pos.line && toRange(own.nameSpan).contains(pos)) {
      node = own;
      range = toRange(own.nameSpan);
    } else {
      const wr = doc.getWordRangeAtPosition(pos, WORD_RE);
      if (!wr) return undefined;
      const defs = (s.definitions.get(doc.getText(wr).toUpperCase()) ?? []).filter(isStorageItem);
      if (defs.length !== 1) return undefined;
      node = defs[0];
      range = wr;
    }
    const rows = layout(node, DEFAULT_SIZE_OPTIONS);
    const md = new vscode.MarkdownString(undefined, true);
    md.isTrusted = { enabledCommands: [SHOW_LAYOUT] };
    md.appendMarkdown(`**${node.label.replace(/^\d+\s+/, '')}** — ${sizeText(rows)}`);
    if (rows.some((r) => r.national)) md.appendMarkdown(`\n\n_${vscode.l10n.t('PIC N is counted as 2 bytes per character (Shift_JIS).')}_`);
    if (rows.length > 1) {
      const arg = encodeURIComponent(JSON.stringify([{ line: node.startLine }]));
      md.appendMarkdown(`\n\n[${vscode.l10n.t('Show layout')}](command:${SHOW_LAYOUT}?${arg})`);
    }
    return new vscode.Hover(md, range);
  }
}

/** Offsets and lengths of an item and everything below it, in a read-only text document. */
async function showDataLayout(...args: unknown[]): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor || editor.document.languageId !== LANG) return;
  const doc = editor.document;
  const a = args[0] as { line?: number } | undefined;
  const line = typeof a?.line === 'number' ? a.line : editor.selection.active.line;
  const node = dataNodeAtLine(structureOf(doc), line);
  if (!node) {
    void vscode.window.showInformationMessage(vscode.l10n.t('Put the cursor on a data item (DATA DIVISION) first.'));
    return;
  }
  const rows = layout(node, DEFAULT_SIZE_OPTIONS);
  const num = (n: number | undefined, w: number) => (n === undefined ? '?' : String(n)).padStart(w);
  const head = `${rows[0].node.label.replace(/^\d+\s+/, '')} — ${sizeText(rows)}`;
  const out: string[] = [head, '', `${'Start'.padStart(7)} ${'End'.padStart(7)} ${'Bytes'.padStart(7)}  ${vscode.l10n.t('Item')}`];
  for (const r of rows) {
    const start = r.offset === undefined ? undefined : r.offset + 1;
    const end = r.offset === undefined || r.bytes === undefined ? undefined : r.offset + r.bytes;
    const pic = r.node.detail && r.node.level !== 88 ? `  ${r.node.detail}` : '';
    const note = r.bytes === undefined && r.reason ? `  [${vscode.l10n.t('not computed: {0}', r.reason)}]` : '';
    const occ = r.occurs > 1 ? `  OCCURS ${r.occurs}` : '';
    const red = r.redefines ? `  REDEFINES ${r.redefines}` : '';
    out.push(`${num(start, 7)} ${num(end, 7)} ${num(r.bytes, 7)}  ${'  '.repeat(r.depth)}${r.node.label}${pic}${occ}${red}${note}`);
  }
  if (rows.some((r) => r.national)) out.push('', vscode.l10n.t('PIC N is counted as 2 bytes per character (Shift_JIS).'));
  out.push(vscode.l10n.t('Start/End are 1-based byte positions from the start of the item. "?" = not computed.'));
  const d = await vscode.workspace.openTextDocument({ content: out.join('\n'), language: 'plaintext' });
  await vscode.window.showTextDocument(d, { viewColumn: vscode.ViewColumn.Beside, preview: true, preserveFocus: true });
}

// ------------------------------------------------------------------ registration
export function registerLanguageFeatures(context: vscode.ExtensionContext): void {
  const selector: vscode.DocumentSelector = { language: LANG };
  context.subscriptions.push(
    vscode.languages.registerDocumentSymbolProvider(selector, new OutlineProvider(), { label: 'NetCOBOL' }),
    vscode.languages.registerFoldingRangeProvider(selector, new FoldingProvider()),
    vscode.languages.registerDefinitionProvider(selector, new DefinitionProvider()),
    vscode.languages.registerHoverProvider(selector, new SizeHoverProvider()),
    vscode.commands.registerCommand(SHOW_LAYOUT, showDataLayout),
    vscode.workspace.onDidCloseTextDocument((d) => cache.delete(d.uri.toString()))
  );
}
