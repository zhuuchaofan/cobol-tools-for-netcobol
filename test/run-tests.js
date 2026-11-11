/* Plain-node tests: diagnostics core + TextMate grammar. Run: npm test */
'use strict';
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { analyze } = require('../out/core/diagnostics');
const { LineColumns, charWidth } = require('../out/core/columns');

const root = path.join(__dirname, '..');
const sjis = (f) => new TextDecoder('shift_jis').decode(fs.readFileSync(path.join(root, f))).split(/\r?\n/);

let passed = 0;
let failed = 0;
async function test(name, fn) {
  try {
    await fn();
    passed++;
    console.log('  ok   ' + name);
  } catch (e) {
    failed++;
    console.log('  FAIL ' + name + '\n       ' + (e && e.message));
  }
}

const OPTS = { mode: 'shiftjis', maxLineLength: 80 };
const codesAt = (diags) => diags.map((d) => `${d.line + 1}:${d.code}`).sort();

(async () => {
  console.log('columns');
  await test('Shift_JIS widths', () => {
    assert.strictEqual(charWidth('A'.codePointAt(0), 'shiftjis'), 1);
    assert.strictEqual(charWidth('漢'.codePointAt(0), 'shiftjis'), 2);
    assert.strictEqual(charWidth('ｱ'.codePointAt(0), 'shiftjis'), 1);
    assert.strictEqual(charWidth('漢'.codePointAt(0), 'utf8'), 3);
    assert.strictEqual(charWidth('漢'.codePointAt(0), 'character'), 1);
  });
  await test('column lookup with full-width characters', () => {
    const lc = new LineColumns('000100 01 名前X', 'shiftjis');
    assert.strictEqual(lc.totalWidth, 15);
    assert.strictEqual(lc.cellAtCol(11).ch, '名');
    assert.strictEqual(lc.cellAtCol(12).ch, '名');
    assert.strictEqual(lc.cellAtCol(15).ch, 'X');
    assert.strictEqual(lc.offsetAtCol(12), 11); // '前' (UTF-16 offset 11) is the first char at col >= 12
  });

  console.log('diagnostics');
  await test('clean sample has no diagnostics', () => {
    assert.deepStrictEqual(analyze(sjis('samples/sample.cob'), OPTS), []);
  });
  await test('errors sample reports each rule on the right line', () => {
    const got = codesAt(analyze(sjis('samples/errors.cob'), OPTS));
    const want = [
      '3:NC001', // '#' in column 7
      '6:NC005', // 01 in area B
      '7:NC003', // spills over column 72
      '7:NC007', // ...which leaves the literal open
      '8:NC002', // 漢 on columns 72-73
      '8:NC007',
      '11:NC006', // MOVE in area A
      '12:NC007', // unterminated literal
      '13:NC009', // full-width space
      '14:NC010', // tab
      '16:NC008', // continuation without quote
      '18:NC004', // > 80 columns
      // 19: kanji on 72-73 inside *> comment → nothing
      // 20: kanji on 72-73 on a comment line → nothing
      '21:NC012', // blank sequence area, lines 21-23 reported once
      '24:NC013', // "A02100"
      '26:NC014' // 001500 after 002200
    ].sort();
    assert.deepStrictEqual(got, want);
  });
  await test('72|73 straddle is ignored in comments but not in literals', () => {
    const pad = (s) => s + ' '.repeat(71 - s.length);
    const lines = [
      '000010 PROCEDURE DIVISION.',
      pad('000100     DISPLAY "A"  *> note') + '漢', // *> comment
      pad('000200*') + '漢', // comment line
      pad('000300     DISPLAY "A') + '漢"' // inside a literal → NC002
    ];
    const got = analyze(lines, OPTS).map((d) => `${d.line + 1}:${d.code}`);
    assert.ok(!got.includes('2:NC002') && !got.includes('2:NC003'), got.join(','));
    assert.ok(!got.includes('3:NC002'), got.join(','));
    assert.ok(got.includes('4:NC002'), got.join(','));
  });

  console.log('sequence area');
  const { analyzeSequence, renumber, numberAfterPrevious } = require('../out/core/sequence');
  await test('renumber whole file: blanks, empty lines, junk all get numbers', () => {
    const lines = ['       IDENTIFICATION DIVISION.', '', 'A00100 PROGRAM-ID. X.', '00', '000500*注記', ''];
    const r = renumber(lines, 'shiftjis', 0, lines.length - 1, 10, 10);
    const after = [...lines];
    for (const e of r.edits) after[e.line] = e.newText + after[e.line].slice(e.end);
    assert.deepStrictEqual(after, [
      '000010 IDENTIFICATION DIVISION.',
      '000020',
      '000030 PROGRAM-ID. X.',
      '000040',
      '000050*注記',
      '' // trailing empty line after the final newline is left alone
    ]);
    assert.strictEqual(r.first, 10);
    assert.strictEqual(r.last, 50);
    assert.deepStrictEqual(analyzeSequence(after, 'shiftjis'), []);
  });
  await test('renumber keeps columns when the old sequence area had full-width chars', () => {
    const r = renumber(['あいう DISPLAY "A".'], 'shiftjis', 0, 0, 10, 10);
    assert.strictEqual(r.edits[0].newText + 'あいう DISPLAY "A".'.slice(r.edits[0].end), '000010 DISPLAY "A".');
  });
  await test('renumber skips lines with a full-width char on columns 6-7', () => {
    const r = renumber(['00000あ DISPLAY "A".', '       X'], 'shiftjis', 0, 1, 10, 10);
    assert.deepStrictEqual(r.skipped, [0]);
    assert.deepStrictEqual(r.edits.map((e) => e.line), [1]);
    assert.strictEqual(r.edits[0].newText, '000020');
  });
  await test('partial renumber continues from the nearest number above', () => {
    const lines = ['000100 A', '       B', '       C'];
    assert.strictEqual(numberAfterPrevious(lines, 'shiftjis', 1, 10, 10), 110);
    assert.strictEqual(numberAfterPrevious(lines, 'shiftjis', 0, 10, 10), 10);
  });
  await test('renumber refuses to go past 999999', () => {
    const r = renumber(['       A', '       B'], 'shiftjis', 0, 1, 999990, 10);
    assert.strictEqual(r.overflow, true);
    assert.strictEqual(r.edits.length, 0);
  });
  await test('valid literal continuation is accepted', () => {
    const l1 = '000100     MOVE "ABCDEFGHIJ';
    const lines = [
      '000010 PROCEDURE DIVISION.',
      l1 + 'X'.repeat(72 - l1.length),
      '000200*   comment lines may sit in between',
      '000300-    "KLMNOP" TO WS-A.'
    ];
    assert.deepStrictEqual(analyze(lines, OPTS), []);
  });
  await test('column counting changes with mode', () => {
    // 33 full-width chars = 66 bytes → ends at column 73 in Shift_JIS, 40 in character mode
    const line = '000100*' + '注'.repeat(33);
    const code = '000100 01 X VALUE NC"' + 'あ'.repeat(26) + '".';
    assert.strictEqual(analyze([line], { mode: 'shiftjis', maxLineLength: 72 }).length, 1);
    assert.strictEqual(analyze([line], { mode: 'character', maxLineLength: 72 }).length, 0);
    assert.ok(analyze([code], OPTS).some((d) => d.code === 'NC007'));
    assert.ok(!analyze([code], { mode: 'character', maxLineLength: 80 }).some((d) => d.code === 'NC007'));
  });
  await test('disabledRules suppresses a rule', () => {
    const d = analyze(sjis('samples/errors.cob'), { ...OPTS, disabledRules: ['NC010', 'NC004'] });
    assert.ok(!d.some((x) => x.code === 'NC010' || x.code === 'NC004'));
  });
  await test('EXEC SQL lines and -- comments do not trip literal checks', () => {
    const lines = [
      '000010 PROCEDURE DIVISION.',
      "000100     EXEC SQL",
      "000200       SELECT A INTO :B FROM T -- it's a comment",
      "000300     END-EXEC."
    ];
    assert.deepStrictEqual(analyze(lines, OPTS), []);
  });

  console.log('structure');
  const { parseStructure, copyAt } = require('../out/core/structure');
  const { matchEntry, matchDir } = require('../out/core/copybook');
  const outline = (nodes, depth = 0, out = []) => {
    for (const n of nodes) {
      out.push(`${'  '.repeat(depth)}${n.label}`);
      outline(n.children, depth + 1, out);
    }
    return out;
  };
  const sample = parseStructure(sjis('samples/sample.cob'), 'shiftjis');
  await test('outline of the sample program', () => {
    assert.deepStrictEqual(outline(sample.roots), [
      'URIAGE01',
      '  IDENTIFICATION DIVISION',
      '  ENVIRONMENT DIVISION',
      '    CONFIGURATION SECTION',
      '    INPUT-OUTPUT SECTION',
      '  DATA DIVISION',
      '    FILE SECTION',
      '      FD URIAGE-FILE',
      '        01 URIAGE-REC',
      '          05 TOKUI-CD',
      '          05 得意先名',
      '          05 KINGAKU',
      '    WORKING-STORAGE SECTION',
      '      01 WS-FS',
      '        88 WS-EOF',
      '      01 合計金額',
      '      01 WS-MSG',
      '      01 WS-HEX',
      '      01 FILLER',
      '      COPY KYOTUREC',
      '  PROCEDURE DIVISION',
      '    MAIN-PROC SECTION',
      '      1000-開始',
      '      2000-READ',
      '      2000-EXIT'
    ]);
  });
  await test('ranges, details and definitions', () => {
    const lines = sjis('samples/sample.cob');
    const def = (k) => sample.definitions.get(k).map((n) => n.startLine + 1);
    assert.deepStrictEqual(def('2000-READ'), [50]);
    assert.deepStrictEqual(def('合計金額'), [27]);
    assert.deepStrictEqual(def('URIAGE-FILE'), [19]);
    const para = sample.definitions.get('1000-開始')[0];
    assert.deepStrictEqual([para.startLine + 1, para.endLine + 1], [34, 49]);
    const kin = sample.definitions.get('KINGAKU')[0];
    assert.strictEqual(kin.detail, 'PIC S9(09)V99');
    assert.strictEqual(sample.definitions.get('WS-EOF')[0].detail, 'VALUE "10"');
    assert.strictEqual(lines[kin.nameSpan.line].slice(kin.nameSpan.start, kin.nameSpan.end), 'KINGAKU');
    assert.ok(!sample.definitions.has('FILLER'));
  });
  await test('folding: divisions, paragraphs, comment block, EXEC SQL', () => {
    const f = sample.folds.map((r) => `${r.start + 1}-${r.end + 1}${r.kind === 'comment' ? 'c' : ''}`);
    for (const want of ['4-6c', '32-55', '34-49', '42-45', '20-23']) assert.ok(f.includes(want), `${want} not in ${f.join(' ')}`);
  });
  await test('COPY statements: plain, OF library, quoted, not inside literals', () => {
    const s = parseStructure(
      [
        '000010 WORKING-STORAGE SECTION.',
        '000020     COPY KYOTUREC.',
        '000030     COPY MEMBER1 OF LIBA.',
        '000040     COPY "sub/abc.cbl".',
        '000050 01  X PIC X(20) VALUE "COPY NOTME".',
        '000060*    COPY COMMENTED.'
      ],
      'shiftjis'
    );
    assert.deepStrictEqual(
      s.copies.map((c) => [c.name, c.lib ?? '', c.quoted]),
      [['KYOTUREC', '', false], ['MEMBER1', 'LIBA', false], ['sub/abc.cbl', '', true]]
    );
    assert.strictEqual(copyAt(s, 1, 18).name, 'KYOTUREC'); // cursor inside the name
    assert.strictEqual(copyAt(s, 1, 12), undefined); // on the COPY keyword
  });
  await test('copybook file matching', () => {
    const entries = ['kyoturec.cbl', 'KYOTUREC.CPY', 'other.cob', 'LIBA'];
    const exts = ['', '.cbl', '.cob', '.cpy'];
    assert.strictEqual(matchEntry(entries, 'KYOTUREC', exts), 'kyoturec.cbl'); // extension order wins
    assert.strictEqual(matchEntry(['KYOTUREC.cpy', 'kyoturec.CPY'], 'KYOTUREC', ['.cpy']), 'KYOTUREC.cpy'); // exact case first
    assert.strictEqual(matchEntry(entries, 'MISSING', exts), undefined);
    assert.strictEqual(matchDir(entries, 'liba'), 'LIBA');
  });
  await test('copybook without divisions and nested programs', () => {
    const cpy = parseStructure(sjis('samples/KYOTUREC.cpy'), 'shiftjis');
    assert.deepStrictEqual(outline(cpy.roots), ['01 KYOTU-AREA', '  05 WS-CNT', '  05 WS-DATE', '  05 処理区分', '    88 新規', '    88 更新']);
    const two = parseStructure(
      [
        '000010 IDENTIFICATION DIVISION.',
        '000020 PROGRAM-ID. A.',
        '000030 PROCEDURE DIVISION.',
        '000040 P1.',
        '000050     GOBACK.',
        '000060 END PROGRAM A.',
        '000070 ID DIVISION.',
        '000080 PROGRAM-ID. "B".',
        '000090 PROCEDURE DIVISION.',
        '000100 EXIT.'
      ],
      'shiftjis'
    );
    assert.deepStrictEqual(two.roots.map((r) => [r.label, r.startLine + 1, r.endLine + 1]), [['A', 1, 6], ['B', 7, 10]]);
    assert.deepStrictEqual(outline(two.roots[1].children), ['IDENTIFICATION DIVISION', 'PROCEDURE DIVISION']); // EXIT. is not a paragraph
  });

  console.log('grammar');
  const vsctm = require('vscode-textmate');
  const oniguruma = require('vscode-oniguruma');
  const wasm = fs.readFileSync(require.resolve('vscode-oniguruma/release/onig.wasm')).buffer;
  await oniguruma.loadWASM(wasm);
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
  const grammar = await registry.loadGrammar('source.netcobol');

  function tokenize(lines) {
    let state = vsctm.INITIAL;
    const out = [];
    for (const line of lines) {
      const r = grammar.tokenizeLine(line, state);
      for (const t of r.tokens) out.push({ text: line.slice(t.startIndex, t.endIndex), scopes: t.scopes.join(' ') });
      state = r.ruleStack;
    }
    return out;
  }
  const toks = tokenize(sjis('samples/sample.cob'));
  const scopeOf = (text, nth = 0) => {
    const m = toks.filter((t) => t.text === text);
    assert.ok(m[nth], `token "${text}" not found`);
    return m[nth].scopes;
  };
  const expectScope = (text, scope, nth = 0) => assert.ok(scopeOf(text, nth).includes(scope), `"${text}" → ${scopeOf(text, nth)} (wanted ${scope})`);

  await test('sequence area and comment lines', () => {
    expectScope('000100', 'meta.sequence-area');
    expectScope(' 売上集計バッチ  サンプル（NetCOBOL 固定形式）', 'comment.line.fixed');
  });
  await test('divisions, sections, paragraphs', () => {
    expectScope('PROCEDURE', 'keyword.control.division');
    expectScope('WORKING-STORAGE', 'keyword.control.section');
    expectScope('MAIN-PROC', 'entity.name.type.section');
    expectScope('1000-開始', 'entity.name.function.paragraph');
    expectScope('2000-READ', 'entity.name.function.paragraph'); // PERFORM target
    expectScope('URIAGE01', 'entity.name.function.program');
  });
  await test('data descriptions', () => {
    expectScope('05', 'constant.numeric.level');
    expectScope('得意先名', 'variable.other.definition');
    expectScope('S9(09)V99', 'constant.other.picture');
    expectScope('COMP-3', 'storage.type');
    expectScope('FILLER', 'storage.type');
    expectScope('KYOTUREC', 'entity.name.type.copybook');
  });
  await test('NetCOBOL literals and directives', () => {
    expectScope('NC', 'storage.modifier.literal-prefix');
    expectScope('処理が終了しました', 'string.quoted.double.prefixed');
    expectScope('X', 'storage.modifier.literal-prefix');
    expectScope('@OPTIONS', 'keyword.control.directive');
    expectScope('SYSERR', 'variable.language');
    expectScope('*> 浮動注記', 'comment.line.floating');
  });
  await test('debug line and EXEC SQL', () => {
    expectScope('D', 'keyword.other.debug-indicator');
    expectScope('WS-CNT', 'variable.other.host');
    expectScope('END-EXEC', 'keyword.control.exec');
  });
  await test('hyphenated names are not split into keywords', () => {
    const line = '000100     MOVE WS-MOVE-END TO END-X.';
    const t = tokenize([line]);
    assert.ok(t.some((x) => x.text === 'WS-MOVE-END' && x.scopes.includes('variable.other.netcobol')));
    assert.ok(t.some((x) => x.text === 'END-X' && x.scopes.includes('variable.other.netcobol')));
  });

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
})();
