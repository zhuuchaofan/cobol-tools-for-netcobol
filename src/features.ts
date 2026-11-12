/**
 * Outline, folding and go to definition (incl. COPY → copybook).
 */
import * as path from 'path';
import * as vscode from 'vscode';
import { ColumnMode } from './core/columns';
import { DEFAULT_COPY_EXTENSIONS, matchDir, matchEntry } from './core/copybook';
import { FormatSetting, detectFormat } from './core/format';
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

// ------------------------------------------------------------------ registration
export function registerLanguageFeatures(context: vscode.ExtensionContext): void {
  const selector: vscode.DocumentSelector = { language: LANG };
  context.subscriptions.push(
    vscode.languages.registerDocumentSymbolProvider(selector, new OutlineProvider(), { label: 'NetCOBOL' }),
    vscode.languages.registerFoldingRangeProvider(selector, new FoldingProvider()),
    vscode.languages.registerDefinitionProvider(selector, new DefinitionProvider()),
    vscode.workspace.onDidCloseTextDocument((d) => cache.delete(d.uri.toString()))
  );
}
